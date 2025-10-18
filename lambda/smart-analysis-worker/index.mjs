import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';
import pg from 'pg';
import { randomUUID } from 'crypto';

const { Pool } = pg;

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// AgentCore client
const agentCoreClient = new BedrockAgentCoreClient({
  region: process.env.AWS_REGION || 'us-east-1',
  maxAttempts: 2 // Retry once on failure
});

const MAX_CONCURRENT_JOBS = 2;
const BULK_ANALYSIS_AGENT_ARN = process.env.BULK_ANALYSIS_AGENT_ARN;

/**
 * Get running jobs count
 */
async function getRunningCount() {
  const result = await pool.query(
    "SELECT COUNT(*) as count FROM smart_analysis_jobs WHERE status = 'running'"
  );
  return parseInt(result.rows[0].count);
}

/**
 * Clean up jobs stuck in queued or running state for too long
 */
async function cleanupStuckJobs() {
  const result = await pool.query(`
    UPDATE smart_analysis_jobs
    SET status = 'pending',
        attempts = attempts + 1,
        error_message = 'Job stuck - auto-reset by worker'
    WHERE status IN ('queued', 'running')
      AND (started_at < NOW() - INTERVAL '10 minutes' OR (started_at IS NULL AND created_at < NOW() - INTERVAL '10 minutes'))
      AND attempts < max_attempts
    RETURNING id
  `);

  if (result.rowCount > 0) {
    console.log(`Reset ${result.rowCount} stuck job(s) back to pending`);
  }

  // Mark jobs as failed if they reached max attempts
  const failedResult = await pool.query(`
    UPDATE smart_analysis_jobs
    SET status = 'failed',
        completed_at = CURRENT_TIMESTAMP,
        error_message = COALESCE(error_message, 'Max attempts reached')
    WHERE status = 'pending'
      AND attempts >= max_attempts
    RETURNING id
  `);

  if (failedResult.rowCount > 0) {
    console.log(`Marked ${failedResult.rowCount} job(s) as failed (max attempts reached)`);
  }
}

/**
 * Get next pending job atomically
 */
async function getNextPendingJob() {
  const result = await pool.query(`
    UPDATE smart_analysis_jobs
    SET status = 'queued'
    WHERE id = (
      SELECT id FROM smart_analysis_jobs
      WHERE status = 'pending' AND attempts < max_attempts
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  return result.rows[0] || null;
}

/**
 * Update job status
 */
async function updateJobStatus(id, status, data = {}) {
  const updates = ['status = $2'];
  const values = [id, status];
  let paramCount = 2;

  const optionalFields = [
    'started_at', 'completed_at', 'attempts',
    'error_message', 'processing_duration_ms'
  ];

  optionalFields.forEach(field => {
    if (data[field] !== undefined) {
      paramCount++;
      updates.push(`${field} = $${paramCount}`);
      values.push(data[field]);
    }
  });

  await pool.query(
    `UPDATE smart_analysis_jobs
     SET ${updates.join(', ')}
     WHERE id = $1`,
    values
  );
}

/**
 * Get task by ID (includes time_group for minute-precision grouping)
 */
async function getTask(taskId) {
  const result = await pool.query(
    'SELECT * FROM smart_analysis_tasks WHERE id = $1',
    [taskId]
  );
  return result.rows[0] || null;
}

/**
 * Get linked events for a task
 */
async function getLinkedEvents(taskId) {
  const result = await pool.query(`
    SELECT wl.*
    FROM waf_log wl
    INNER JOIN smart_analysis_event_links sel ON wl.id = sel.waf_log_id
    WHERE sel.smart_analysis_task_id = $1
    ORDER BY wl.timestamp ASC
  `, [taskId]);
  return result.rows;
}

/**
 * Extract key information from events (NO RAW DATA)
 */
function extractKeyInfo(events) {
  return events.map(event => ({
    event_id: event.id,
    timestamp: event.timestamp,
    action: event.action,
    rule_id: event.rule_id,
    rule_name: event.rule_name,
    uri: event.uri,
    http_method: event.http_method,
    user_agent: event.user_agent,
    host: event.host
  }));
}

/**
 * Generate aggregated summary from events
 * Groups ALL events for same IP+time (minute precision), no arbitrary limits
 */
function generateSummary(events, source_ip) {
  // Extract unique URIs
  const uniqueURIs = [...new Set(events.map(e => e.uri).filter(uri => uri))];

  // Extract unique rules
  const uniqueRules = [...new Set(events.map(e => e.rule_name).filter(rule => rule))];

  // Action breakdown
  const actionBreakdown = {};
  events.forEach(e => {
    const action = e.action || 'UNKNOWN';
    actionBreakdown[action] = (actionBreakdown[action] || 0) + 1;
  });

  // Method breakdown
  const methodBreakdown = {};
  events.forEach(e => {
    const method = e.http_method || 'UNKNOWN';
    methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
  });

  // Time range
  const timestamps = events.map(e => new Date(e.timestamp)).filter(d => !isNaN(d.getTime()));
  timestamps.sort((a, b) => a.getTime() - b.getTime());

  const first = timestamps[0] || new Date();
  const last = timestamps[timestamps.length - 1] || new Date();
  const durationMinutes = Math.round((last.getTime() - first.getTime()) / 60000);

  // Country (take from first event)
  const country = events[0]?.country || 'Unknown';

  return {
    source_ip,
    country,
    total_events: events.length,
    time_range: {
      first: first.toISOString(),
      last: last.toISOString(),
      duration_minutes: durationMinutes
    },
    unique_uris: uniqueURIs.slice(0, 20),
    unique_rules: uniqueRules.slice(0, 10),
    action_breakdown: actionBreakdown,
    method_breakdown: methodBreakdown
  };
}

/**
 * Format bulk payload for AI analysis
 * Processes all events grouped by IP+time (minute precision)
 * No 50-record limit - analyzes complete attack patterns within same minute
 */
function formatBulkPayload(task, events) {
  const keyInfo = extractKeyInfo(events);
  const summary = generateSummary(events, task.source_ip);

  return {
    action: 'bulk_analyze',
    summary,
    events: keyInfo
  };
}

/**
 * Invoke bulk analysis agent
 */
async function invokeBulkAnalysisAgent(payload) {
  if (!BULK_ANALYSIS_AGENT_ARN) {
    throw new Error('BULK_ANALYSIS_AGENT_ARN not configured');
  }

  const sessionId = `bulk-analysis-${randomUUID()}`;
  console.log(`Invoking bulk analysis agent for IP ${payload.summary?.source_ip} with ${payload.events?.length} events...`);

  // Send payload directly (not wrapped in {prompt: ...})
  const payloadBuffer = Buffer.from(JSON.stringify(payload));

  // Store raw prompt for troubleshooting
  const rawPrompt = JSON.stringify(payload, null, 2);
  console.log(`Raw payload being sent (first 500 chars): ${rawPrompt.substring(0, 500)}...`);

  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: BULK_ANALYSIS_AGENT_ARN,
    runtimeSessionId: sessionId,
    payload: payloadBuffer
  });

  // Add timeout using AbortController
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 60000); // 60 second timeout

  try {
    const response = await agentCoreClient.send(command, { abortSignal: abortController.signal });
    clearTimeout(timeoutId);

    // Process response
    let agentResponse = '';
    if (response.response) {
      const blob = response.response;
      if (blob.transformToString) {
        agentResponse = await blob.transformToString();
      } else if (blob.transformToByteArray) {
        const bytes = await blob.transformToByteArray();
        agentResponse = new TextDecoder().decode(bytes);
      } else if (Buffer.isBuffer(blob)) {
        agentResponse = blob.toString('utf-8');
      }
    }

    console.log(`Agent response received: ${agentResponse.substring(0, 200)}...`);

    // Store raw response for troubleshooting
    const rawResponse = agentResponse;

    // Parse response
    const parsed = JSON.parse(agentResponse);

    // Handle nested result structure
    let responseData = parsed;
    if (parsed.result) {
      responseData = JSON.parse(parsed.result);
    }

    // Validate required fields
    if (responseData.severity_rating === undefined || responseData.severity_rating === null) {
      throw new Error(`Missing severity_rating in agent response. Raw response: ${rawResponse.substring(0, 500)}`);
    }

    return {
      severity_rating: responseData.severity_rating,
      security_analysis: responseData.security_analysis || 'Analysis completed',
      recommended_actions: responseData.recommended_actions || 'No specific actions required',
      attack_type: responseData.attack_type || 'Unknown',
      // Include raw prompt and response for troubleshooting
      raw_prompt: rawPrompt,
      raw_response: rawResponse
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Agent invocation timed out after 60 seconds');
    }
    throw error;
  }
}

/**
 * Update task with analysis results
 */
async function updateTask(taskId, analysisResult) {
  await pool.query(`
    UPDATE smart_analysis_tasks
    SET severity_rating = $1,
        security_analysis = $2,
        recommended_actions = $3,
        attack_type = $4,
        analyzed_by = 'bulk-analysis-agent',
        analyzed_at = CURRENT_TIMESTAMP,
        status = 'completed',
        ai_prompt = $6,
        ai_response = $7
    WHERE id = $5
  `, [
    analysisResult.severity_rating,
    analysisResult.security_analysis,
    analysisResult.recommended_actions,
    analysisResult.attack_type || null,
    taskId,
    analysisResult.raw_prompt || null,
    analysisResult.raw_response || null
  ]);
}

/**
 * Create activity timeline entries for events
 */
async function createTimelineEntriesForEvents(eventIds, taskId, analysisResult, status) {
  if (eventIds.length === 0) {
    return;
  }

  console.log(`Creating timeline entries for ${eventIds.length} events...`);

  try {
    // Prepare timeline entries for bulk insert
    const timelineEntries = eventIds.map(eventId => ({
      event_id: eventId,
      event_type: 'bulk_analysis_completed',
      actor_type: 'system',
      actor_name: 'Bulk Analysis Agent',
      title: 'Bulk Analysis Completed',
      description: `Event analyzed via smart analysis task ${taskId}. Severity: ${analysisResult.severity_rating}, Status: ${status}`,
      metadata: JSON.stringify({
        task_id: taskId,
        severity: analysisResult.severity_rating,
        status: status,
        attack_type: analysisResult.attack_type,
        source: 'bulk-analysis-agent'
      })
    }));

    // Bulk insert timeline entries
    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    timelineEntries.forEach((entry, index) => {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6})`
      );
      values.push(
        entry.event_id,
        entry.event_type,
        entry.actor_type,
        entry.actor_name,
        entry.title,
        entry.description,
        entry.metadata
      );
      paramIndex += 7;
    });

    const insertQuery = `
      INSERT INTO event_timeline (
        event_id, event_type, actor_type, actor_name, title, description, metadata
      ) VALUES ${placeholders.join(', ')}
    `;

    await pool.query(insertQuery, values);

    console.log(`Created ${eventIds.length} timeline entries`);
  } catch (error) {
    console.error('Failed to create timeline entries:', error);
    // Don't throw - timeline creation failure shouldn't fail the entire job
  }
}

/**
 * Patch all linked events with analysis results
 */
async function patchLinkedEvents(taskId, analysisResult) {
  // Get all event IDs linked to this task
  const result = await pool.query(`
    SELECT waf_log_id FROM smart_analysis_event_links
    WHERE smart_analysis_task_id = $1
  `, [taskId]);

  const eventIds = result.rows.map(row => row.waf_log_id);

  if (eventIds.length === 0) {
    console.log(`No events to patch for task ${taskId}`);
    return 0;
  }

  console.log(`Patching ${eventIds.length} events with analysis results...`);

  // Determine status based on severity
  // Map to existing waf_log constraint values: 'open', 'closed', 'investigating', 'false_positive'
  let status = 'investigating'; // Default for medium severity
  if (analysisResult.severity_rating >= 4) {
    status = 'open'; // High/critical severity needs immediate attention
  } else if (analysisResult.severity_rating === 3) {
    status = 'investigating'; // Medium severity needs review
  } else if (analysisResult.severity_rating <= 2) {
    status = 'closed'; // Low/no risk (0=safe, 1=info, 2=low)
  }

  // Bulk update all events
  const updateResult = await pool.query(`
    UPDATE waf_log
    SET severity_rating = $1,
        security_analysis = $2,
        follow_up_suggestion = $3,
        status = $4,
        processed = TRUE,
        analyzed_at = CURRENT_TIMESTAMP,
        analyzed_by = 'bulk-analysis-agent'
    WHERE id = ANY($5::integer[])
  `, [
    analysisResult.severity_rating,
    analysisResult.security_analysis,
    analysisResult.recommended_actions,
    status,
    eventIds
  ]);

  console.log(`Patched ${updateResult.rowCount} events with smart analysis results`);

  // Create activity timeline entries for each event
  await createTimelineEntriesForEvents(eventIds, taskId, analysisResult, status);

  return updateResult.rowCount || 0;
}

/**
 * Create timeline entries for escalation events
 */
async function createEscalationTimelineEntries(eventIds, escalationId, task, analysisResult) {
  if (eventIds.length === 0) {
    return;
  }

  console.log(`Creating escalation timeline entries for ${eventIds.length} events...`);

  try {
    const severityLabel = analysisResult.severity_rating === 5 ? 'Critical' : 'High';
    const title = 'Escalation Created';
    const description = `${severityLabel} severity escalation #${escalationId} created for ${analysisResult.attack_type || 'security incident'} from IP ${task.source_ip}`;

    // Prepare timeline entries for bulk insert
    const timelineEntries = eventIds.map(eventId => ({
      event_id: eventId,
      event_type: 'escalation_created',
      actor_type: 'system',
      actor_name: 'Escalation System',
      title: title,
      description: description,
      metadata: JSON.stringify({
        escalation_id: escalationId,
        task_id: task.id,
        severity: analysisResult.severity_rating,
        attack_type: analysisResult.attack_type,
        source_ip: task.source_ip,
        source: 'bulk-analysis-escalation'
      })
    }));

    // Bulk insert timeline entries
    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    timelineEntries.forEach((entry) => {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6})`
      );
      values.push(
        entry.event_id,
        entry.event_type,
        entry.actor_type,
        entry.actor_name,
        entry.title,
        entry.description,
        entry.metadata
      );
      paramIndex += 7;
    });

    const insertQuery = `
      INSERT INTO event_timeline (
        event_id, event_type, actor_type, actor_name, title, description, metadata
      ) VALUES ${placeholders.join(', ')}
    `;

    await pool.query(insertQuery, values);

    console.log(`Created ${eventIds.length} escalation timeline entries`);
  } catch (error) {
    console.error('Failed to create escalation timeline entries:', error);
    // Don't throw - timeline creation failure shouldn't fail the escalation
  }
}

/**
 * Create escalation for high-severity tasks (severity >= 4)
 */
async function createEscalationIfNeeded(task, analysisResult, events) {
  // Only escalate severity 4 (High) and 5 (Critical)
  if (analysisResult.severity_rating < 4) {
    console.log(`Task ${task.id} severity ${analysisResult.severity_rating} does not require escalation`);
    return null;
  }

  // Check if escalation already exists for this task
  const existingEscalation = await pool.query(`
    SELECT id FROM escalation_events
    WHERE source_smart_task_id = $1
  `, [task.id]);

  if (existingEscalation.rows.length > 0) {
    console.log(`Escalation already exists for task ${task.id}`);
    return null;
  }

  const severityLabel = analysisResult.severity_rating === 5 ? 'Critical' : 'High';
  const title = `${severityLabel} Security Alert: ${analysisResult.attack_type || 'Suspicious Activity Detected'}`;

  const message = `Smart analysis identified ${severityLabel.toLowerCase()}-severity threat from IP ${task.source_ip}. ${analysisResult.security_analysis}`;

  // Build detail payload with linked events
  const eventIds = events.map(e => e.id);
  const uniqueURIs = [...new Set(events.map(e => e.uri).filter(uri => uri))];
  const uniqueRules = [...new Set(events.map(e => e.rule_name).filter(rule => rule))];

  const detailPayload = {
    task_id: task.id,
    source_ip: task.source_ip,
    country: events[0]?.country || 'Unknown',
    attack_type: analysisResult.attack_type,
    severity_rating: analysisResult.severity_rating,
    total_events: events.length,
    linked_event_ids: eventIds,
    unique_uris: uniqueURIs.slice(0, 10),
    unique_rules: uniqueRules.slice(0, 5),
    security_analysis: analysisResult.security_analysis,
    recommended_actions: analysisResult.recommended_actions,
    time_range: {
      first: events[0]?.timestamp,
      last: events[events.length - 1]?.timestamp
    }
  };

  console.log(`Creating escalation for task ${task.id} (severity ${analysisResult.severity_rating})...`);

  const result = await pool.query(`
    INSERT INTO escalation_events (
      title, message, detail_payload, severity, source_type, source_smart_task_id
    )
    VALUES ($1, $2, $3, $4, 'smart_task', $5)
    RETURNING id
  `, [
    title,
    message,
    JSON.stringify(detailPayload),
    analysisResult.severity_rating,
    task.id
  ]);

  const escalationId = result.rows[0]?.id;
  console.log(`Escalation ${escalationId} created for task ${task.id}`);

  // Create timeline entries for all affected events to indicate escalation
  await createEscalationTimelineEntries(eventIds, escalationId, task, analysisResult);

  return escalationId;
}

/**
 * Process a single job
 */
async function processJob(job) {
  const startTime = Date.now();
  console.log(`Processing smart analysis job ${job.id} for task ${job.task_id}`);

  try {
    // Mark job as running
    await updateJobStatus(job.id, 'running', {
      started_at: new Date(),
      attempts: job.attempts + 1
    });

    // Get task
    const task = await getTask(job.task_id);
    if (!task) {
      throw new Error(`Task ${job.task_id} not found`);
    }

    // Get all linked events
    const events = await getLinkedEvents(job.task_id);
    if (events.length === 0) {
      throw new Error(`No events linked to task ${job.task_id}`);
    }

    console.log(`Processing bulk analysis for IP ${task.source_ip} with ${events.length} events`);

    // Format bulk payload (key info extraction)
    const payload = formatBulkPayload(task, events);

    // Invoke bulk analysis agent
    const analysisResult = await invokeBulkAnalysisAgent(payload);

    console.log(`Bulk analysis complete: severity=${analysisResult.severity_rating}, attack_type=${analysisResult.attack_type}`);

    // Update task with results
    await updateTask(job.task_id, analysisResult);

    // Patch all linked events
    const patchedCount = await patchLinkedEvents(job.task_id, analysisResult);

    // Create escalation if severity is high (4) or critical (5)
    const escalationId = await createEscalationIfNeeded(task, analysisResult, events);

    // Calculate processing duration
    const processingDuration = Date.now() - startTime;

    // Update job as completed
    await updateJobStatus(job.id, 'completed', {
      completed_at: new Date(),
      processing_duration_ms: processingDuration
    });

    if (escalationId) {
      console.log(`Job ${job.id} completed in ${processingDuration}ms (${patchedCount} events patched, escalation ${escalationId} created)`);
    } else {
      console.log(`Job ${job.id} completed in ${processingDuration}ms (${patchedCount} events patched)`);
    }

  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);

    const processingDuration = Date.now() - startTime;

    // Mark job as failed or pending for retry
    const shouldRetry = job.attempts < job.max_attempts - 1;
    const newStatus = shouldRetry ? 'pending' : 'failed';

    await updateJobStatus(job.id, newStatus, {
      completed_at: newStatus === 'failed' ? new Date() : undefined,
      error_message: error.message,
      processing_duration_ms: processingDuration
    });

    console.log(`Job ${job.id} marked as ${newStatus} (attempts: ${job.attempts + 1}/${job.max_attempts})`);
  }
}

/**
 * Lambda handler
 */
export const handler = async (event) => {
  console.log('Smart analysis worker started');

  try {
    // Clean up any stuck jobs first
    await cleanupStuckJobs();

    // Check how many jobs are currently running
    const runningCount = await getRunningCount();
    console.log(`Currently running jobs: ${runningCount}/${MAX_CONCURRENT_JOBS}`);

    if (runningCount >= MAX_CONCURRENT_JOBS) {
      console.log('Max concurrent jobs reached, skipping this execution');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Max concurrent jobs reached',
          runningCount,
          maxConcurrent: MAX_CONCURRENT_JOBS
        })
      };
    }

    // Process ONE job per Lambda invocation (synchronous processing)
    // This ensures the job completes before Lambda exits
    // EventBridge will trigger the next Lambda execution for remaining jobs

    // Get next pending job
    const job = await getNextPendingJob();

    if (!job) {
      console.log('No pending jobs in queue');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No pending jobs to process',
          runningCount,
          maxConcurrent: MAX_CONCURRENT_JOBS
        })
      };
    }

    console.log(`Processing job ${job.id} for task ${job.task_id}`);

    // Process job and wait for completion
    await processJob(job);

    const processedJobs = [job.id];

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Smart analysis job completed',
        jobsCompleted: processedJobs.length,
        jobIds: processedJobs,
        runningCount: runningCount + 1  // Was running during processing
      })
    };

  } catch (error) {
    console.error('Worker error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Worker execution failed',
        message: error.message
      })
    };
  }
};
