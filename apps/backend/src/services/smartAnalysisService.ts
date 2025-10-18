import { SmartAnalysisTaskModel } from '../models/SmartAnalysisTask';
import { SmartAnalysisEventLinkModel } from '../models/SmartAnalysisEventLink';
import { SmartAnalysisJobModel } from '../models/SmartAnalysisJob';
import { WafLogModel } from '../models/WafLog';

/**
 * Key event information extracted for AI analysis (no raw data)
 */
export interface EventKeyInfo {
  event_id: number;
  timestamp: string;
  action: string;
  rule_id?: string;
  rule_name?: string;
  uri?: string;
  http_method?: string;
  user_agent?: string;
  host?: string;
}

/**
 * Aggregated summary for bulk analysis
 */
export interface BulkAnalysisSummary {
  source_ip: string;
  country: string;
  total_events: number;
  time_range: {
    first: string;
    last: string;
    duration_minutes: number;
  };
  unique_uris: string[];
  unique_rules: string[];
  action_breakdown: { [key: string]: number };
  method_breakdown: { [key: string]: number };
}

/**
 * Complete payload for bulk AI analysis
 */
export interface BulkAnalysisPayload {
  action: string;
  summary: BulkAnalysisSummary;
  events: EventKeyInfo[];
}

/**
 * Generate smart review tasks from unlinked open events
 * Groups events by source IP + timestamp (minute precision)
 * Includes ALL events for each IP+time group (no 50-event limit)
 */
export async function generateReviewTasks(): Promise<{
  tasks_created: number;
  events_linked: number;
  source_ips_processed: string[];
}> {
  console.log('Generating smart review tasks from unlinked open events (IP+time grouping)...');

  // Get all IP+time groups with open unlinked events
  const ipTimeGroups = await WafLogModel.getIPTimeGroupsWithOpenUnlinkedEvents();
  console.log(`Found ${ipTimeGroups.length} IP+time groups with open unlinked events`);

  let tasksCreated = 0;
  let eventsLinked = 0;
  const sourceIPsProcessed: string[] = [];

  for (const { source_ip, time_group, country, count, min_timestamp, max_timestamp } of ipTimeGroups) {
    console.log(`Processing IP ${source_ip} @ ${time_group} (${country}) with ${count} events [${min_timestamp} - ${max_timestamp}]`);

    // Check if task already exists for this IP+time group
    const existingTask = await SmartAnalysisTaskModel.findBySourceIpAndTimeGroup(source_ip, time_group);
    if (existingTask) {
      console.log(`Task already exists for ${source_ip} @ ${time_group} (Task #${existingTask.id}), skipping`);
      continue;
    }

    // Get ALL unlinked events for this IP+time group (no limit)
    const events = await WafLogModel.findUnlinkedOpenEventsByIPAndTimeGroup(source_ip, time_group);

    if (events.length === 0) {
      console.log(`No events found for ${source_ip} @ ${time_group}, skipping`);
      continue;
    }

    // Create smart analysis task with time_group
    const task = await SmartAnalysisTaskModel.create(source_ip, events.length, time_group);
    console.log(`Created task ${task.id} for IP ${source_ip} @ ${time_group} with ${events.length} events`);

    // Link events to task
    const eventIds = events.map(e => e.id);
    const linkedCount = await SmartAnalysisEventLinkModel.bulkLinkEvents(task.id, eventIds);
    console.log(`Linked ${linkedCount} events to task ${task.id}`);

    // Update event records with task ID
    for (const event of events) {
      await WafLogModel.linkToSmartAnalysisTask(event.id, task.id);
    }

    tasksCreated++;
    eventsLinked += linkedCount;
    if (!sourceIPsProcessed.includes(source_ip)) {
      sourceIPsProcessed.push(source_ip);
    }
  }

  console.log(`✅ Generated ${tasksCreated} tasks, linked ${eventsLinked} events from ${sourceIPsProcessed.length} unique IPs`);

  return {
    tasks_created: tasksCreated,
    events_linked: eventsLinked,
    source_ips_processed: sourceIPsProcessed
  };
}

/**
 * Create analysis job for a task
 */
export async function createAnalysisJob(task_id: number, priority: number = 0): Promise<any> {
  const job = await SmartAnalysisJobModel.create(task_id, priority);
  console.log(`Created analysis job ${job.id} for task ${task_id}`);
  return job;
}

/**
 * Generate smart review tasks AND automatically queue them for analysis
 * This combines task generation with immediate job creation for auto-processing
 * Groups events by source IP + timestamp (minute precision)
 */
export async function generateAndQueueReviewTasks(): Promise<{
  tasks_created: number;
  jobs_created: number;
  events_linked: number;
  source_ips_processed: string[];
}> {
  console.log('Generating smart review tasks and auto-queuing for analysis (IP+time grouping)...');

  // Get all IP+time groups with open unlinked events
  const ipTimeGroups = await WafLogModel.getIPTimeGroupsWithOpenUnlinkedEvents();
  console.log(`Found ${ipTimeGroups.length} IP+time groups with open unlinked events`);

  let tasksCreated = 0;
  let jobsCreated = 0;
  let eventsLinked = 0;
  const sourceIPsProcessed: string[] = [];

  for (const { source_ip, time_group, country, count, min_timestamp, max_timestamp } of ipTimeGroups) {
    console.log(`Processing IP ${source_ip} @ ${time_group} (${country}) with ${count} events [${min_timestamp} - ${max_timestamp}]`);

    // Check if task already exists for this IP+time group
    const existingTask = await SmartAnalysisTaskModel.findBySourceIpAndTimeGroup(source_ip, time_group);
    if (existingTask) {
      console.log(`Task already exists for ${source_ip} @ ${time_group} (Task #${existingTask.id}), skipping`);
      continue;
    }

    // Get ALL unlinked events for this IP+time group (no limit)
    const events = await WafLogModel.findUnlinkedOpenEventsByIPAndTimeGroup(source_ip, time_group);

    if (events.length === 0) {
      console.log(`No events found for ${source_ip} @ ${time_group}, skipping`);
      continue;
    }

    // Create smart analysis task with time_group
    const task = await SmartAnalysisTaskModel.create(source_ip, events.length, time_group);
    console.log(`Created task ${task.id} for IP ${source_ip} @ ${time_group} with ${events.length} events`);

    // Link events to task
    const eventIds = events.map(e => e.id);
    const linkedCount = await SmartAnalysisEventLinkModel.bulkLinkEvents(task.id, eventIds);
    console.log(`Linked ${linkedCount} events to task ${task.id}`);

    // Update event records with task ID
    for (const event of events) {
      await WafLogModel.linkToSmartAnalysisTask(event.id, task.id);
    }

    // AUTO-QUEUE: Create analysis job immediately
    const job = await SmartAnalysisJobModel.create(task.id, 0);
    console.log(`✅ Auto-queued job ${job.id} for task ${task.id}`);

    tasksCreated++;
    jobsCreated++;
    eventsLinked += linkedCount;
    if (!sourceIPsProcessed.includes(source_ip)) {
      sourceIPsProcessed.push(source_ip);
    }
  }

  console.log(`✅ Generated ${tasksCreated} tasks, created ${jobsCreated} jobs, linked ${eventsLinked} events from ${sourceIPsProcessed.length} unique IPs`);

  return {
    tasks_created: tasksCreated,
    jobs_created: jobsCreated,
    events_linked: eventsLinked,
    source_ips_processed: sourceIPsProcessed
  };
}

/**
 * Extract key information from events (NO RAW DATA)
 * This reduces token usage and focuses AI on important fields
 */
function extractKeyInfo(events: any[]): EventKeyInfo[] {
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
 */
function generateSummary(events: any[], source_ip: string): BulkAnalysisSummary {
  // Extract unique URIs
  const uniqueURIs = [...new Set(events.map(e => e.uri).filter(uri => uri))];

  // Extract unique rules
  const uniqueRules = [...new Set(events.map(e => e.rule_name).filter(rule => rule))];

  // Action breakdown
  const actionBreakdown: { [key: string]: number } = {};
  events.forEach(e => {
    const action = e.action || 'UNKNOWN';
    actionBreakdown[action] = (actionBreakdown[action] || 0) + 1;
  });

  // Method breakdown
  const methodBreakdown: { [key: string]: number } = {};
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
    unique_uris: uniqueURIs.slice(0, 20), // Limit to top 20
    unique_rules: uniqueRules.slice(0, 10), // Limit to top 10
    action_breakdown: actionBreakdown,
    method_breakdown: methodBreakdown
  };
}

/**
 * Format bulk payload for AI analysis
 * Extracts only key info, generates summary, NO RAW DATA
 */
export async function formatBulkPayload(task_id: number): Promise<BulkAnalysisPayload> {
  // Get task
  const task = await SmartAnalysisTaskModel.findById(task_id);
  if (!task) {
    throw new Error(`Task ${task_id} not found`);
  }

  // Get all linked events
  const events = await SmartAnalysisEventLinkModel.getEventsByTaskId(task_id);
  if (events.length === 0) {
    throw new Error(`No events linked to task ${task_id}`);
  }

  console.log(`Formatting payload for task ${task_id} with ${events.length} events from IP ${task.source_ip}`);

  // Extract key info only (no raw data)
  const keyInfo = extractKeyInfo(events);

  // Generate aggregated summary
  const summary = generateSummary(events, task.source_ip);

  console.log(`✅ Formatted payload: ${summary.total_events} events, ${summary.unique_uris.length} unique URIs, ${summary.unique_rules.length} rules`);

  return {
    action: 'bulk_analyze',
    summary,
    events: keyInfo
  };
}

/**
 * Patch all linked events with analysis results
 */
export async function patchLinkedEvents(
  task_id: number,
  severity_rating: number,
  security_analysis: string,
  follow_up_suggestion: string,
  analyzed_by: string
): Promise<number> {
  // Get all event IDs linked to this task
  const eventIds = await SmartAnalysisEventLinkModel.getLinkedEventIds(task_id);

  if (eventIds.length === 0) {
    console.log(`No events to patch for task ${task_id}`);
    return 0;
  }

  console.log(`Patching ${eventIds.length} events with analysis results from task ${task_id}...`);

  // Determine status based on severity
  // Map to existing waf_log constraint values: 'open', 'closed', 'investigating', 'false_positive'
  let status = 'investigating'; // Default for medium severity
  if (severity_rating >= 4) {
    status = 'open'; // High/critical severity needs immediate attention
  } else if (severity_rating === 3) {
    status = 'investigating'; // Medium severity needs review
  } else if (severity_rating <= 1) {
    status = 'closed'; // Low/no risk
  }

  // Bulk update all events
  const updatedCount = await WafLogModel.bulkUpdateFromSmartAnalysis(
    eventIds,
    severity_rating,
    security_analysis,
    follow_up_suggestion,
    status,
    analyzed_by
  );

  console.log(`✅ Patched ${updatedCount} events with smart analysis results`);

  return updatedCount;
}
