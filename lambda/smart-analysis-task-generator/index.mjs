import pg from 'pg';

const { Pool } = pg;

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 3, // Allow multiple concurrent connections for batch operations
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

/**
 * Lambda handler triggered by EventBridge to automatically generate smart analysis tasks
 * Groups WAF events by source IP + time (minute precision) and auto-queues for analysis
 * Runs every 15 minutes (configurable)
 */
export const handler = async (event) => {
  console.log('Smart Analysis Task Generator Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();
  let tasksCreated = 0;
  let jobsCreated = 0;
  let eventsLinked = 0;
  const sourceIPsProcessed = [];

  try {
    // Get all IP+time groups with open unlinked events
    console.log('Querying for IP+time groups with unlinked events...');

    const ipTimeGroupsResult = await pool.query(`
      SELECT
        source_ip,
        TO_CHAR(DATE_TRUNC('minute', timestamp), 'YYYYMMDD-HH24MI') as time_group,
        MAX(country) as country,
        COUNT(*) as count,
        MIN(timestamp) as min_timestamp,
        MAX(timestamp) as max_timestamp
      FROM waf_log
      WHERE status = 'open'
        AND smart_analysis_task_id IS NULL
      GROUP BY source_ip, DATE_TRUNC('minute', timestamp)
      HAVING COUNT(*) > 0
      ORDER BY min_timestamp DESC
    `);

    const ipTimeGroups = ipTimeGroupsResult.rows;
    console.log(`Found ${ipTimeGroups.length} IP+time groups with open unlinked events`);

    if (ipTimeGroups.length === 0) {
      console.log('No unlinked events to process');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No unlinked events to process',
          tasks_created: 0,
          jobs_created: 0,
          events_linked: 0,
          source_ips_processed: [],
          execution_time_ms: Date.now() - startTime
        })
      };
    }

    // Process each IP+time group
    for (const group of ipTimeGroups) {
      const { source_ip, time_group, country, count, min_timestamp, max_timestamp } = group;

      console.log(`Processing IP ${source_ip} @ ${time_group} (${country || 'Unknown'}) with ${count} events [${min_timestamp} - ${max_timestamp}]`);

      try {
        // Check if task already exists for this IP+time group
        const existingTaskResult = await pool.query(
          'SELECT id FROM smart_analysis_tasks WHERE source_ip = $1 AND time_group = $2',
          [source_ip, time_group]
        );

        if (existingTaskResult.rows.length > 0) {
          console.log(`Task already exists for ${source_ip} @ ${time_group} (Task #${existingTaskResult.rows[0].id}), skipping`);
          continue;
        }

        // Parse time_group format YYYYMMDD-HHMM back to timestamp range
        const year = parseInt(time_group.substring(0, 4));
        const month = parseInt(time_group.substring(4, 6));
        const day = parseInt(time_group.substring(6, 8));
        const hour = parseInt(time_group.substring(9, 11));
        const minute = parseInt(time_group.substring(11, 13));

        // Get ALL unlinked events for this IP+time group
        const eventsResult = await pool.query(`
          SELECT * FROM waf_log
          WHERE status = 'open'
            AND smart_analysis_task_id IS NULL
            AND source_ip = $1
            AND DATE_TRUNC('minute', timestamp) = TO_TIMESTAMP($2, 'YYYY-MM-DD HH24:MI:SS')
          ORDER BY timestamp ASC
        `, [
          source_ip,
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
        ]);

        const events = eventsResult.rows;

        if (events.length === 0) {
          console.log(`No events found for ${source_ip} @ ${time_group}, skipping`);
          continue;
        }

        // Create smart analysis task with time_group
        const taskResult = await pool.query(
          `INSERT INTO smart_analysis_tasks (source_ip, num_linked_events, time_group, status)
           VALUES ($1, $2, $3, 'open')
           RETURNING id`,
          [source_ip, events.length, time_group]
        );

        const taskId = taskResult.rows[0].id;
        console.log(`✓ Created task ${taskId} for IP ${source_ip} @ ${time_group} with ${events.length} events`);

        // Link events to task (bulk insert)
        const linkValues = events.map(e => `(${taskId}, ${e.id})`).join(', ');
        await pool.query(`
          INSERT INTO smart_analysis_event_links (smart_analysis_task_id, waf_log_id)
          VALUES ${linkValues}
        `);

        console.log(`✓ Linked ${events.length} events to task ${taskId}`);

        // Update event records with task ID (bulk update)
        const eventIds = events.map(e => e.id);
        await pool.query(
          `UPDATE waf_log
           SET smart_analysis_task_id = $1
           WHERE id = ANY($2::integer[])`,
          [taskId, eventIds]
        );

        // AUTO-QUEUE: Create analysis job immediately
        const jobResult = await pool.query(
          `INSERT INTO smart_analysis_jobs (task_id, status, priority, attempts, max_attempts)
           VALUES ($1, 'pending', 0, 0, 3)
           RETURNING id`,
          [taskId]
        );

        const jobId = jobResult.rows[0].id;
        console.log(`✓ Auto-queued job ${jobId} for task ${taskId}`);

        tasksCreated++;
        jobsCreated++;
        eventsLinked += events.length;

        if (!sourceIPsProcessed.includes(source_ip)) {
          sourceIPsProcessed.push(source_ip);
        }

      } catch (error) {
        console.error(`Error processing IP ${source_ip} @ ${time_group}:`, error);
        // Continue with next group even if one fails
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ Generated ${tasksCreated} tasks, created ${jobsCreated} jobs, linked ${eventsLinked} events from ${sourceIPsProcessed.length} unique IPs in ${executionTime}ms`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Generated ${tasksCreated} task(s) and created ${jobsCreated} job(s)`,
        tasks_created: tasksCreated,
        jobs_created: jobsCreated,
        events_linked: eventsLinked,
        source_ips_processed: sourceIPsProcessed,
        execution_time_ms: executionTime
      })
    };

  } catch (error) {
    console.error('Fatal error in task generator:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        execution_time_ms: Date.now() - startTime
      })
    };
  }
  // Don't end pool in Lambda - let it be reused across invocations
};
