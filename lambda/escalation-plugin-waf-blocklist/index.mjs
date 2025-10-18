import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { WAFV2Client, GetIPSetCommand, UpdateIPSetCommand } = require('@aws-sdk/client-wafv2');
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

// WAF Configuration
const wafClient = new WAFV2Client({ region: 'us-east-1' });
const WAF_IP_SET_NAME = process.env.WAF_BLOCKLIST_IP_SET_NAME || 'soc-lite-blocklist-ips';
const WAF_IP_SET_ID = process.env.WAF_BLOCKLIST_IP_SET_ID || '';
const WAF_SCOPE = 'CLOUDFRONT';

/**
 * Extract source IP from escalation
 */
function extractSourceIp(escalation) {
  // Try to extract IP from detail_payload
  if (escalation.detail_payload) {
    const payload = typeof escalation.detail_payload === 'string'
      ? JSON.parse(escalation.detail_payload)
      : escalation.detail_payload;

    // Check various possible fields
    if (payload.source_ip) return payload.source_ip;
    if (payload.sourceIp) return payload.sourceIp;
    if (payload.clientIp) return payload.clientIp;
    if (payload.ip_address) return payload.ip_address;
    if (payload.ipAddress) return payload.ipAddress;

    // Check nested structures
    if (payload.event && payload.event.source_ip) return payload.event.source_ip;
    if (payload.waf_event && payload.waf_event.source_ip) return payload.waf_event.source_ip;
  }

  return null;
}

/**
 * Get source IP from WAF event if escalation has source_waf_event_id
 */
async function getSourceIpFromWafEvent(wafEventId) {
  const result = await pool.query(
    'SELECT source_ip FROM waf_log WHERE id = $1',
    [wafEventId]
  );

  return result.rows[0]?.source_ip || null;
}

/**
 * Add IP to WAF IPSet
 */
async function addIpToWAF(ipAddress) {
  console.log(`Adding IP ${ipAddress} to WAF IPSet...`);

  // Get current IPSet
  const getCommand = new GetIPSetCommand({
    Name: WAF_IP_SET_NAME,
    Scope: WAF_SCOPE,
    Id: WAF_IP_SET_ID
  });

  const getResponse = await wafClient.send(getCommand);
  const currentAddresses = getResponse.IPSet?.Addresses || [];
  const lockToken = getResponse.LockToken;

  // Add new IP (with /32 CIDR for IPv4)
  const ipWithCidr = ipAddress.includes('/') ? ipAddress : `${ipAddress}/32`;

  if (currentAddresses.includes(ipWithCidr)) {
    console.log(`IP ${ipAddress} already in WAF IPSet`);
    return true;
  }

  const newAddresses = [...currentAddresses, ipWithCidr];

  // Update IPSet
  const updateCommand = new UpdateIPSetCommand({
    Name: WAF_IP_SET_NAME,
    Scope: WAF_SCOPE,
    Id: WAF_IP_SET_ID,
    Addresses: newAddresses,
    LockToken: lockToken
  });

  await wafClient.send(updateCommand);
  console.log(`✓ IP ${ipAddress} added to WAF IPSet`);
  return true;
}

/**
 * Process single escalation
 */
async function processEscalation(escalation) {
  console.log(`Processing escalation ${escalation.id}: ${escalation.title}`);

  try {
    // Extract source IP
    let sourceIp = extractSourceIp(escalation);

    // If not in payload, try to get from source WAF event
    if (!sourceIp && escalation.source_waf_event_id) {
      sourceIp = await getSourceIpFromWafEvent(escalation.source_waf_event_id);
    }

    if (!sourceIp) {
      const errorMsg = 'Unable to extract source IP from escalation';
      console.warn(`⚠ Escalation ${escalation.id}: ${errorMsg}`);

      await pool.query(
        `UPDATE escalation_events
         SET completed_waf_blocklist = TRUE,
             waf_blocklist_error = $2
         WHERE id = $1`,
        [escalation.id, errorMsg]
      );

      return { success: false, error: errorMsg };
    }

    console.log(`Extracted source IP: ${sourceIp}`);

    // Check if IP already in blocklist_ip table
    const existingResult = await pool.query(
      'SELECT * FROM blocklist_ip WHERE ip_address = $1',
      [sourceIp]
    );

    if (existingResult.rows.length > 0) {
      // IP exists - update last_seen_at and increment block_count
      console.log(`IP ${sourceIp} already in blocklist - updating last_seen_at`);

      await pool.query(
        `UPDATE blocklist_ip
         SET last_seen_at = CURRENT_TIMESTAMP,
             block_count = block_count + 1
         WHERE ip_address = $1`,
        [sourceIp]
      );
    } else {
      // New IP - create record
      console.log(`Creating new blocklist record for IP ${sourceIp}`);

      await pool.query(
        `INSERT INTO blocklist_ip (
          ip_address, reason, severity, source_escalation_id, source_waf_event_id
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          sourceIp,
          escalation.message || escalation.title,
          escalation.severity,
          escalation.id,
          escalation.source_waf_event_id || null
        ]
      );
    }

    // Add IP to WAF IPSet
    await addIpToWAF(sourceIp);

    // Mark escalation as completed
    await pool.query(
      `UPDATE escalation_events
       SET completed_waf_blocklist = TRUE,
           waf_blocklist_added_at = CURRENT_TIMESTAMP,
           waf_blocklist_ip = $2,
           waf_blocklist_error = NULL
       WHERE id = $1`,
      [escalation.id, sourceIp]
    );

    console.log(`✓ Escalation ${escalation.id} processed successfully`);
    return { success: true, ip: sourceIp };

  } catch (error) {
    console.error(`✗ Failed to process escalation ${escalation.id}:`, error);

    // Log error in database
    await pool.query(
      `UPDATE escalation_events
       SET waf_blocklist_error = $2
       WHERE id = $1`,
      [escalation.id, error.message]
    );

    return { success: false, error: error.message };
  }
}

/**
 * Lambda handler triggered by EventBridge every 5 minutes
 * Processes pending escalation events and adds IPs to WAF blocklist
 */
export const handler = async (event) => {
  console.log('WAF Blocklist Plugin Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors = [];

  try {
    // Check WAF configuration
    if (!WAF_IP_SET_ID) {
      console.warn('WAF_BLOCKLIST_IP_SET_ID not configured - escalations will not be processed');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'WAF IPSet not configured',
          processed: 0,
          succeeded: 0,
          failed: 0
        })
      };
    }

    console.log(`WAF IPSet: ${WAF_IP_SET_NAME} (ID: ${WAF_IP_SET_ID})`);

    // Query for pending escalations (severity 4-5 only)
    console.log('Querying for pending WAF blocklist escalations...');
    const result = await pool.query(`
      SELECT * FROM escalation_events
      WHERE completed_waf_blocklist = FALSE
        AND severity >= 4
      ORDER BY created_at ASC
      LIMIT 50
    `);

    const pendingEscalations = result.rows;
    console.log(`Found ${pendingEscalations.length} pending escalation(s) for WAF blocklist`);

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
      const result = await processEscalation(escalation);

      if (result.success) {
        succeeded++;
      } else {
        failed++;
        errors.push({
          escalation_id: escalation.id,
          error: result.error
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
    console.error('Fatal error in WAF blocklist plugin:', error);
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
