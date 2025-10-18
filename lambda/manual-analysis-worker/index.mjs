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

// AgentCore client (AWS_REGION is automatically provided by Lambda)
const agentCoreClient = new BedrockAgentCoreClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const MAX_CONCURRENT_JOBS = 2;

/**
 * Get running jobs count
 */
async function getRunningCount() {
  const result = await pool.query(
    "SELECT COUNT(*) as count FROM analysis_jobs WHERE status = 'running'"
  );
  return parseInt(result.rows[0].count);
}

/**
 * Get next pending job atomically
 */
async function getNextPendingJob() {
  const result = await pool.query(`
    UPDATE analysis_jobs
    SET status = 'queued'
    WHERE id = (
      SELECT id FROM analysis_jobs
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

  // Add optional fields
  const optionalFields = [
    'started_at', 'completed_at', 'attempts', 'severity_rating',
    'security_analysis', 'follow_up_suggestion', 'triage_result',
    'error_message', 'last_error', 'security_agent_session_id',
    'triage_agent_session_id', 'processing_duration_ms'
  ];

  optionalFields.forEach(field => {
    if (data[field] !== undefined) {
      paramCount++;
      if (field === 'triage_result') {
        updates.push(`${field} = $${paramCount}::jsonb`);
        values.push(JSON.stringify(data[field]));
      } else {
        updates.push(`${field} = $${paramCount}`);
        values.push(data[field]);
      }
    }
  });

  await pool.query(
    `UPDATE analysis_jobs
     SET ${updates.join(', ')}
     WHERE id = $1`,
    values
  );
}

/**
 * Get event by ID
 */
async function getEvent(eventId) {
  const result = await pool.query(
    'SELECT * FROM waf_log WHERE id = $1',
    [eventId]
  );
  return result.rows[0] || null;
}

/**
 * Update event with analysis results
 */
async function updateEvent(eventId, data) {
  const updates = [];
  const values = [eventId];
  let paramCount = 1;

  if (data.severity_rating !== undefined) {
    paramCount++;
    updates.push(`severity_rating = $${paramCount}`);
    values.push(data.severity_rating);
  }

  if (data.security_analysis !== undefined) {
    paramCount++;
    updates.push(`security_analysis = $${paramCount}`);
    values.push(data.security_analysis);
  }

  if (data.follow_up_suggestion !== undefined) {
    paramCount++;
    updates.push(`follow_up_suggestion = $${paramCount}`);
    values.push(data.follow_up_suggestion);
  }

  if (data.triage_result !== undefined) {
    paramCount++;
    updates.push(`triage_result = $${paramCount}::jsonb`);
    values.push(JSON.stringify(data.triage_result));
  }

  if (data.status !== undefined) {
    paramCount++;
    updates.push(`status = $${paramCount}`);
    values.push(data.status);
  }

  if (data.clearJobLink !== undefined && data.clearJobLink === true) {
    updates.push(`analysis_job_id = NULL`);
  }

  if (updates.length > 0) {
    await pool.query(
      `UPDATE waf_log SET ${updates.join(', ')} WHERE id = $1`,
      values
    );
  }
}

/**
 * Invoke AgentCore agent
 */
async function invokeAgent(agentArn, sessionId, payload) {
  console.log(`Invoking agent ${agentArn} with session ${sessionId}`);

  const payloadBuffer = Buffer.from(JSON.stringify(payload));

  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: agentArn,
    runtimeSessionId: sessionId,
    payload: payloadBuffer
  });

  const response = await agentCoreClient.send(command);

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

  console.log(`Agent response: ${agentResponse.substring(0, 200)}...`);
  return agentResponse;
}

/**
 * Process a single job
 */
async function processJob(job) {
  const startTime = Date.now();
  console.log(`Processing job ${job.id} for event ${job.event_id}`);

  try {
    // Mark job as running
    await updateJobStatus(job.id, 'running', {
      started_at: new Date(),
      attempts: job.attempts + 1
    });

    // Get event data
    const event = await getEvent(job.event_id);
    if (!event) {
      throw new Error(`Event ${job.event_id} not found`);
    }

    console.log(`Processing event: ${event.source_ip} ${event.action}`);

    // Step 1: SecOps Agent Analysis (handles both security + triage)
    const securitySessionId = `security-${randomUUID()}`;
    const eventData = {
      id: event.id,
      action: event.action,
      source_ip: event.source_ip,
      timestamp: event.timestamp,
      rule_id: event.rule_id || event.rule_name || 'N/A',
      rule_name: event.rule_name || 'N/A',
      uri: event.uri || 'N/A',
      http_method: event.http_method || 'N/A',
      country: event.country || event.country_code || 'Unknown',
      user_agent: event.user_agent || 'Unknown'
    };

    const securityPayload = {
      prompt: JSON.stringify({
        action: 'analyze',
        event: eventData
      })
    };

    const securityResponse = await invokeAgent(
      process.env.SECURITY_AGENT_ARN,
      securitySessionId,
      securityPayload
    );

    // Parse secops agent response (includes both security analysis and triage)
    let severityRating = null;
    let securityAnalysis = 'Analysis pending';
    let followUpSuggestion = 'No action required';
    let triageResult = null;
    let isBlockedByFilter = false;
    let responseData = null; // Declare outside try block for access in triage section

    try {
      const parsed = JSON.parse(securityResponse);

      // SecOps agent wraps response in {result: JSON.stringify({...})}
      responseData = parsed;
      if (parsed.result) {
        responseData = JSON.parse(parsed.result);
      }

      // Extract analysis data
      if (responseData.analysis) {
        securityAnalysis = responseData.analysis.security_analysis;
        followUpSuggestion = responseData.analysis.follow_up_suggestion;

        // Check if content was blocked by Bedrock safety filters
        const isContentBlocked =
          (securityAnalysis && (
            securityAnalysis.includes('blocked by our content filters') ||
            securityAnalysis.includes('blocked by content filter')
          )) ||
          (followUpSuggestion && (
            followUpSuggestion.includes('blocked by our content filters') ||
            followUpSuggestion.includes('blocked by content filter')
          ));

        if (isContentBlocked) {
          console.log('Bedrock content filter blocked the analysis - will NOT set severity_rating');
          isBlockedByFilter = true;
          severityRating = null; // Do not set severity when blocked
        } else {
          severityRating = responseData.analysis.severity_rating;
        }
      }

      // Extract triage data
      if (responseData.triage) {
        triageResult = responseData.triage;
        console.log(`Triage data extracted: action=${triageResult.action_taken}, status=${triageResult.status_update}, email=${triageResult.email_sent}`);
      } else {
        console.log('No triage data found in response');
      }

      console.log(`SecOps analysis complete: severity=${severityRating}, blocked=${isBlockedByFilter}, action=${triageResult?.action_taken || 'unknown'}`);

    } catch (e) {
      console.error(`Failed to parse secops response: ${e.message}`);
      // If parsing fails, try to extract basic info from text
      const severityMatch = securityResponse.match(/severity[:\s]+(\d+)/i);
      if (severityMatch) {
        severityRating = parseInt(severityMatch[1]);
      }
      securityAnalysis = securityResponse.substring(0, 500);
    }

    // Calculate processing duration
    const processingDuration = Date.now() - startTime;

    // Update job as completed
    await updateJobStatus(job.id, 'completed', {
      completed_at: new Date(),
      severity_rating: severityRating,
      security_analysis: securityAnalysis,
      follow_up_suggestion: followUpSuggestion,
      triage_result: triageResult,
      security_agent_session_id: securitySessionId,
      processing_duration_ms: processingDuration
    });

    // Update event with results and clear job link
    // Only include severity_rating if it was set (not blocked by content filter)
    const eventUpdateData = {
      security_analysis: securityAnalysis,
      follow_up_suggestion: followUpSuggestion,
      triage_result: triageResult,
      clearJobLink: true
    };

    if (severityRating !== null && severityRating !== undefined) {
      eventUpdateData.severity_rating = severityRating;
    }

    await updateEvent(job.event_id, eventUpdateData);

    // Create timeline entry for completed analysis
    const severityLabel = severityRating !== null && severityRating !== undefined
      ? (['Unknown', 'Info', 'Low', 'Medium', 'High', 'Critical'][severityRating] || 'Unknown')
      : 'Blocked by Content Filter';

    const description = severityRating !== null && severityRating !== undefined
      ? `Security analysis completed with ${severityLabel} severity rating`
      : `Security analysis completed (severity assessment blocked by AWS Bedrock content safety filters)`;

    await pool.query(`
      INSERT INTO event_timeline (
        event_id, event_type, actor_type, actor_name,
        title, description, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
    `, [
      job.event_id,
      'ai_analysis',
      'system',
      'secops-agent',
      'AI Analysis Completed',
      description,
      JSON.stringify({
        severity: severityRating,
        severity_label: severityLabel,
        processing_time_ms: processingDuration,
        job_id: job.id,
        blocked_by_filter: isBlockedByFilter
      })
    ]);
    console.log(`Timeline entry created: AI Analysis Completed (severity: ${severityLabel})`);

    // Create timeline entry for triage completion
    if (triageResult) {
      const triageDescription = triageResult.action_taken
        ? `Triage completed with action: ${triageResult.action_taken}. ${triageResult.status_update ? `Status will be updated to "${triageResult.status_update}".` : ''}`
        : 'Triage completed';

      await pool.query(`
        INSERT INTO event_timeline (
          event_id, event_type, actor_type, actor_name,
          title, description, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      `, [
        job.event_id,
        'triage',
        'system',
        'triage-agent',
        'Automated Triage Completed',
        triageDescription,
        JSON.stringify({
          severity: severityRating,
          action_taken: triageResult.action_taken,
          status_update: triageResult.status_update,
          email_sent: triageResult.email_sent || false,
          job_id: job.id
        })
      ]);
      console.log(`Timeline entry created: Automated Triage Completed (action: ${triageResult.action_taken})`);
    }

    // Execute backend actions (Strands SDK pattern)
    console.log('Starting triage execution phase...');
    console.log(`responseData exists: ${responseData !== null}, has backend_actions: ${responseData?.backend_actions !== undefined}, is array: ${Array.isArray(responseData?.backend_actions)}`);
    console.log(`triageResult exists: ${triageResult !== null}, has status_update: ${triageResult?.status_update !== undefined}`);

    // Check if agent returned backend_actions array
    if (responseData && responseData.backend_actions && Array.isArray(responseData.backend_actions)) {
      console.log(`Executing ${responseData.backend_actions.length} backend actions...`);
      for (const action of responseData.backend_actions) {
        if (action.type === 'update_status' && action.status) {
          await pool.query('UPDATE waf_log SET status = $1 WHERE id = $2', [action.status, job.event_id]);

          // Create detailed status change timeline entry
          const statusReason = triageResult?.action_taken
            ? `Automated triage determined action: ${triageResult.action_taken}. `
            : '';
          const severityContext = severityRating !== null
            ? `Event severity rating: ${severityRating}/5 (${severityLabel}). `
            : '';
          const timelineDescription = `${statusReason}${severityContext}Status changed to "${action.status}".`;

          await pool.query(`
            INSERT INTO event_timeline (event_id, event_type, actor_type, actor_name, title, description, metadata, created_at)
            VALUES ($1, 'status_change', 'system', 'triage-agent', 'Status Updated by Triage', $2, $3::jsonb, NOW())
          `, [
            job.event_id,
            timelineDescription,
            JSON.stringify({
              previous_status: 'open',
              new_status: action.status,
              reason: triageResult?.action_taken || 'automated_triage',
              severity: severityRating
            })
          ]);
          console.log(`Updated event ${job.event_id} status to ${action.status} (reason: ${triageResult?.action_taken || 'automated_triage'})`);
        }
        if (action.type === 'send_notification' && action.recipients) {
          // TODO: Implement SNS/SES notification
          await pool.query(`
            INSERT INTO event_timeline (event_id, event_type, actor_type, actor_name, title, description, metadata, created_at)
            VALUES ($1, 'notification', 'system', 'secops-agent', 'Notification Sent', $2, $3::jsonb, NOW())
          `, [job.event_id, `Security notification sent to ${action.recipients.length} recipient(s)`, JSON.stringify(action)]);
          console.log(`Notification queued for event ${job.event_id}`);
        }
      }
    }
    // Fallback: Execute based on triage result structure if no backend_actions
    else if (triageResult) {
      console.log('No backend_actions found, using fallback triage execution...');

      // Update status if specified
      if (triageResult.status_update) {
        await pool.query('UPDATE waf_log SET status = $1 WHERE id = $2', [triageResult.status_update, job.event_id]);

        // Create detailed status change timeline entry
        const statusReason = triageResult.action_taken
          ? `Automated triage determined action: ${triageResult.action_taken}. `
          : '';
        const severityContext = severityRating !== null
          ? `Event severity rating: ${severityRating}/5 (${severityLabel}). `
          : '';
        const timelineDescription = `${statusReason}${severityContext}Status changed to "${triageResult.status_update}".`;

        await pool.query(`
          INSERT INTO event_timeline (event_id, event_type, actor_type, actor_name, title, description, metadata, created_at)
          VALUES ($1, 'status_change', 'system', 'triage-agent', 'Status Updated by Triage', $2, $3::jsonb, NOW())
        `, [
          job.event_id,
          timelineDescription,
          JSON.stringify({
            previous_status: 'open',
            new_status: triageResult.status_update,
            reason: triageResult.action_taken || 'automated_triage',
            severity: severityRating,
            email_sent: triageResult.email_sent || false
          })
        ]);
        console.log(`Updated event ${job.event_id} status to ${triageResult.status_update} (reason: ${triageResult.action_taken || 'automated_triage'})`);
      }

      // Send notification if required
      if (triageResult.notification_required) {
        const notificationType = triageResult.notification_type || 'info';
        const actionTaken = triageResult.action_taken || 'reviewed';
        // TODO: Implement actual SNS/SES notification
        await pool.query(`
          INSERT INTO event_timeline (event_id, event_type, actor_type, actor_name, title, description, metadata, created_at)
          VALUES ($1, 'notification', 'system', 'secops-agent', $2, $3, $4::jsonb, NOW())
        `, [
          job.event_id,
          `${notificationType.charAt(0).toUpperCase() + notificationType.slice(1)} Notification Sent`,
          `Security team notified about ${actionTaken} action for this event`,
          JSON.stringify({
            notification_type: notificationType,
            action_taken: actionTaken,
            severity: severityRating
          })
        ]);
        console.log(`Notification sent for event ${job.event_id} (type: ${notificationType})`);
      }
    }

    console.log(`Job ${job.id} completed in ${processingDuration}ms`);

  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);

    const processingDuration = Date.now() - startTime;

    // Mark job as failed or pending for retry
    const shouldRetry = job.attempts < job.max_attempts - 1;
    const newStatus = shouldRetry ? 'pending' : 'failed';

    await updateJobStatus(job.id, newStatus, {
      completed_at: newStatus === 'failed' ? new Date() : undefined,
      last_error: error.message,
      error_message: error.message,
      processing_duration_ms: processingDuration
    });

    console.log(`Job ${job.id} marked as ${newStatus} (attempts: ${job.attempts + 1}/${job.max_attempts})`);
  }
}

/**
 * Clean up stale running jobs (stuck for > 10 minutes)
 */
async function cleanupStaleJobs() {
  const staleMinutes = 10;
  const result = await pool.query(`
    UPDATE analysis_jobs
    SET status = 'failed',
        completed_at = NOW(),
        error_message = 'Job stuck in running status for more than ${staleMinutes} minutes - marked as failed by cleanup',
        last_error = 'Stale job cleanup - exceeded maximum processing time'
    WHERE status = 'running'
      AND started_at < NOW() - INTERVAL '${staleMinutes} minutes'
    RETURNING id, event_id, started_at
  `);

  if (result.rowCount && result.rowCount > 0) {
    console.log(`Cleaned up ${result.rowCount} stale job(s):`);
    result.rows.forEach(job => {
      console.log(`  - Job ${job.id} (event ${job.event_id}) started at ${job.started_at}`);
    });
  }

  return result.rowCount || 0;
}

/**
 * Lambda handler
 */
export const handler = async (event) => {
  console.log('Analysis worker started');

  try {
    // Clean up stale jobs first
    const staleCount = await cleanupStaleJobs();
    if (staleCount > 0) {
      console.log(`Cleaned up ${staleCount} stale job(s) before processing`);
    }

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

    // Calculate how many slots are available
    const availableSlots = MAX_CONCURRENT_JOBS - runningCount;
    console.log(`Available slots: ${availableSlots}`);

    // Process available slots
    const processedJobs = [];

    for (let i = 0; i < availableSlots; i++) {
      // Get next pending job
      const job = await getNextPendingJob();

      if (!job) {
        console.log('No pending jobs in queue');
        break;
      }

      console.log(`Starting job ${job.id} in slot ${i + 1}`);

      // Process job asynchronously (don't await - let it run in background)
      processJob(job).catch(err => {
        console.error(`Error processing job ${job.id}:`, err);
      });

      processedJobs.push(job.id);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Jobs started',
        jobsStarted: processedJobs.length,
        jobIds: processedJobs,
        runningCount,
        availableSlots
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
