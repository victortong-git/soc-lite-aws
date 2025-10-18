import axios from 'axios';
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
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// ServiceNow configuration
const SERVICENOW_INSTANCE_URL = process.env.SERVICENOW_INSTANCE_URL || '';
const SERVICENOW_USERNAME = process.env.SERVICENOW_USERNAME || '';
const SERVICENOW_PASSWORD = process.env.SERVICENOW_PASSWORD || '';
const SERVICENOW_ASSIGNMENT_GROUP = process.env.SERVICENOW_ASSIGNMENT_GROUP || 'SOC Team';

/**
 * Create ServiceNow incident via REST API
 */
async function createServiceNowIncident(escalation) {
  console.log(`Creating ServiceNow incident for escalation ${escalation.id}: ${escalation.title}`);

  // Map severity to ServiceNow urgency and impact
  const severityMapping = {
    5: { urgency: 1, impact: 1, priority: 1 }, // Critical
    4: { urgency: 1, impact: 2, priority: 2 }  // High
  };

  const mapping = severityMapping[escalation.severity] || { urgency: 3, impact: 3, priority: 3 };

  // Build incident description with detail payload
  let description = escalation.message;
  if (escalation.detail_payload) {
    description += '\n\n--- Event Details ---\n';
    description += JSON.stringify(escalation.detail_payload, null, 2);
  }

  // Add source information
  description += `\n\n--- Source Information ---\n`;
  description += `Source Type: ${escalation.source_type}\n`;
  description += `Escalation ID: ${escalation.id}\n`;
  description += `Created At: ${escalation.created_at}\n`;
  if (escalation.source_waf_event_id) {
    description += `WAF Event ID: ${escalation.source_waf_event_id}\n`;
  }
  if (escalation.source_smart_task_id) {
    description += `Smart Task ID: ${escalation.source_smart_task_id}\n`;
  }

  // Prepare incident payload
  const incidentPayload = {
    short_description: escalation.title,
    description: description,
    urgency: mapping.urgency,
    impact: mapping.impact,
    priority: mapping.priority,
    category: 'Security',
    subcategory: 'Intrusion Detection',
    assignment_group: SERVICENOW_ASSIGNMENT_GROUP,
    caller_id: SERVICENOW_USERNAME,
    contact_type: 'Alert',
    state: 1, // New
    u_source: 'SOC-Lite Automated Escalation' // Custom field (if exists)
  };

  console.log('ServiceNow incident payload:', JSON.stringify(incidentPayload, null, 2));

  // Create Basic Auth header
  const authHeader = 'Basic ' + Buffer.from(`${SERVICENOW_USERNAME}:${SERVICENOW_PASSWORD}`).toString('base64');

  // POST to ServiceNow incident API
  const apiUrl = `${SERVICENOW_INSTANCE_URL}/api/now/table/incident`;

  try {
    const response = await axios.post(apiUrl, incidentPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      timeout: 30000
    });

    console.log('ServiceNow API response status:', response.status);

    if (response.status === 201 && response.data && response.data.result) {
      const incident = response.data.result;
      const incidentNumber = incident.number;
      const sysId = incident.sys_id;

      console.log(`✓ ServiceNow incident created: ${incidentNumber} (sys_id: ${sysId})`);

      return {
        success: true,
        incident_number: incidentNumber,
        sys_id: sysId
      };
    } else {
      throw new Error(`Unexpected response from ServiceNow API: ${response.status}`);
    }

  } catch (error) {
    console.error('ServiceNow API error:', error.message);

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }

    throw new Error(`ServiceNow API error: ${error.message}`);
  }
}

/**
 * Lambda handler triggered by EventBridge every 5 minutes
 * Processes pending escalation events and creates ServiceNow incidents
 */
export const handler = async (event) => {
  console.log('ServiceNow Escalation Plugin Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors = [];

  try {
    // Check ServiceNow configuration
    if (!SERVICENOW_INSTANCE_URL || !SERVICENOW_USERNAME || !SERVICENOW_PASSWORD) {
      console.warn('ServiceNow not configured - escalations will not be sent to ServiceNow');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'ServiceNow credentials not configured',
          processed: 0,
          succeeded: 0,
          failed: 0
        })
      };
    }

    // Query for pending incident creation
    console.log('Querying for pending incident escalations...');
    const result = await pool.query(`
      SELECT * FROM escalation_events
      WHERE completed_incident = FALSE
      ORDER BY created_at ASC
      LIMIT 50
    `);

    const pendingEscalations = result.rows;
    console.log(`Found ${pendingEscalations.length} pending incident escalation(s)`);

    if (pendingEscalations.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No pending incident escalations to process',
          processed: 0,
          succeeded: 0,
          failed: 0,
          execution_time_ms: Date.now() - startTime
        })
      };
    }

    // Process each pending escalation
    for (const escalation of pendingEscalations) {
      processed++;
      console.log(`Processing escalation ${escalation.id}: ${escalation.title}`);

      try {
        // Create ServiceNow incident
        const incidentResult = await createServiceNowIncident(escalation);

        if (incidentResult.success) {
          console.log(`✓ ServiceNow incident created: ${incidentResult.incident_number}`);

          // Mark as complete in database
          await pool.query(`
            UPDATE escalation_events
            SET completed_incident = TRUE,
                servicenow_incident_created_at = CURRENT_TIMESTAMP,
                servicenow_incident_number = $2,
                servicenow_incident_sys_id = $3,
                servicenow_incident_error = NULL
            WHERE id = $1
          `, [escalation.id, incidentResult.incident_number, incidentResult.sys_id]);

          succeeded++;
          console.log(`✓ Escalation ${escalation.id} marked as completed (incident: ${incidentResult.incident_number})`);
        }

      } catch (error) {
        failed++;
        console.error(`✗ Failed to process escalation ${escalation.id}:`, error);

        // Log error in database
        await pool.query(`
          UPDATE escalation_events
          SET servicenow_incident_error = $2
          WHERE id = $1
        `, [escalation.id, error.message]);

        errors.push({
          escalation_id: escalation.id,
          error: error.message
        });
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ Processed ${processed} escalation(s): ${succeeded} succeeded, ${failed} failed in ${executionTime}ms`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Processed ${processed} escalation(s)`,
        processed,
        succeeded,
        failed,
        errors: errors.length > 0 ? errors : undefined,
        execution_time_ms: executionTime
      })
    };

  } catch (error) {
    console.error('Fatal error in ServiceNow escalation plugin:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        processed,
        succeeded,
        failed,
        execution_time_ms: Date.now() - startTime
      })
    };
  }
  // Don't end pool in Lambda - let it be reused across invocations
};
