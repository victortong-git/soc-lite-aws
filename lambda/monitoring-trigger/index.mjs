import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from "@aws-sdk/client-bedrock-agentcore";
import pg from 'pg';

const { Pool } = pg;

const agentCoreClient = new BedrockAgentCoreClient({ region: process.env.AWS_REGION || 'us-east-1' });

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 1, // Lambda - single connection
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Lambda handler triggered by EventBridge to run daily monitoring
 * Invokes the Monitoring Agent to check for severity 3 patterns
 */
export const handler = async (event) => {
  console.log('Monitoring trigger Lambda invoked:', JSON.stringify(event, null, 2));

  const monitoringAgentArn = process.env.MONITORING_AGENT_ARN;

  if (!monitoringAgentArn) {
    throw new Error('MONITORING_AGENT_ARN environment variable not set');
  }

  try {
    // Get severity 3 events from the last 24 hours
    const query = `
      SELECT id, timestamp, source_ip, uri, action, severity_rating, security_analysis
      FROM waf_log
      WHERE severity_rating = 3
        AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const client = await pool.connect();
    let events = [];

    try {
      const result = await client.query(query);
      events = result.rows;
      console.log(`Found ${events.length} severity 3 events in the last 24 hours`);
    } finally {
      client.release();
    }

    if (events.length === 0) {
      console.log('No severity 3 events to monitor');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No severity 3 events to monitor',
          eventsChecked: 0
        })
      };
    }

    // Prepare payload for monitoring agent
    const payload = {
      task: 'daily_monitoring',
      hours: 24,
      events: events,
      timestamp: new Date().toISOString()
    };

    // Invoke monitoring agent
    console.log('Invoking monitoring agent...');

    const payloadBuffer = Buffer.from(JSON.stringify(payload));

    // Generate a session ID that meets the 33+ character requirement
    const sessionId = `monitoring-${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;

    const command = new InvokeAgentRuntimeCommand({
      agentRuntimeArn: monitoringAgentArn,
      runtimeSessionId: sessionId,
      payload: payloadBuffer
    });

    const response = await agentCoreClient.send(command);

    // Process streaming response
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

    console.log('Monitoring agent response:', agentResponse);

    let result;
    try {
      result = JSON.parse(agentResponse);
    } catch (e) {
      result = { raw: agentResponse };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Monitoring agent invoked successfully',
        eventsChecked: events.length,
        patterns: result.patterns || [],
        alertsSent: result.alerts_sent || 0
      })
    };

  } catch (error) {
    console.error('Error invoking monitoring agent:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
  // Don't end pool in Lambda - let it be reused across invocations
};
