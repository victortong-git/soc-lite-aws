import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
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

// SNS client
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const SNS_TOPIC_ARN_CRITICAL = process.env.SNS_TOPIC_ARN_CRITICAL || '';
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'victor.tong@gmail.com';

/**
 * Lambda handler triggered by EventBridge every 5 minutes
 * Processes pending escalation events and sends SNS notifications
 */
export const handler = async (event) => {
  console.log('Escalation Processor Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors = [];

  try {
    // Check SNS configuration
    if (!SNS_TOPIC_ARN_CRITICAL) {
      console.warn('SNS_TOPIC_ARN_CRITICAL not configured - escalations will not be sent');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'SNS topic not configured',
          processed: 0,
          succeeded: 0,
          failed: 0
        })
      };
    }

    // Query for pending escalations
    console.log('Querying for pending escalations...');
    const result = await pool.query(`
      SELECT * FROM escalation_events
      WHERE completed_sns = FALSE
      ORDER BY created_at ASC
      LIMIT 50
    `);

    const pendingEscalations = result.rows;
    console.log(`Found ${pendingEscalations.length} pending escalation(s)`);

    if (pendingEscalations.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No pending escalations to process',
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
        // Prepare SNS message
        const subject = escalation.title;
        const message = escalation.message;

        // Send SNS notification
        const command = new PublishCommand({
          TopicArn: SNS_TOPIC_ARN_CRITICAL,
          Subject: subject,
          Message: message
        });

        const snsResponse = await snsClient.send(command);
        const messageId = snsResponse.MessageId;

        console.log(`✓ SNS sent successfully for escalation ${escalation.id} (MessageId: ${messageId})`);

        // Mark as complete in database
        await pool.query(`
          UPDATE escalation_events
          SET completed_sns = TRUE,
              sns_sent_at = CURRENT_TIMESTAMP,
              sns_message_id = $2,
              sns_error = NULL
          WHERE id = $1
        `, [escalation.id, messageId]);

        succeeded++;
        console.log(`✓ Escalation ${escalation.id} marked as completed`);

      } catch (error) {
        failed++;
        console.error(`✗ Failed to process escalation ${escalation.id}:`, error);

        // Log error in database
        await pool.query(`
          UPDATE escalation_events
          SET sns_error = $2
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
    console.error('Fatal error in escalation processor:', error);
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
