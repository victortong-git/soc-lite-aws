/**
 * AWS Lambda Function: get-waf-alert
 *
 * This function retrieves WAF alerts from CloudWatch Logs and stores them in an RDS PostgreSQL database.
 * It checks for duplicate records before inserting to avoid duplicate entries.
 *
 * Environment Variables Required:
 * - DB_HOST: RDS PostgreSQL hostname
 * - DB_PORT: Database port (default: 5432)
 * - DB_NAME: Database name
 * - DB_USER: Database username
 * - DB_PASSWORD: Database password
 * - WAF_LOG_GROUP: CloudWatch Log Group name for WAF logs (optional)
 * - LOOKBACK_MINUTES: How far back to look for logs (default: 60)
 */

import pg from 'pg';
import zlib from 'zlib';
import { promisify } from 'util';
import { CloudWatchLogsClient, FilterLogEventsCommand, DescribeLogStreamsCommand } from '@aws-sdk/client-cloudwatch-logs';

const { Client } = pg;
const gunzip = promisify(zlib.gunzip);

// Database configuration from environment variables
// Note: AWS Lambda may escape special characters in environment variables
// We need to unescape them for the database password
const dbPassword = (process.env.DB_PASSWORD || '').replace(/\\!/g, '!');

const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: dbPassword,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000,
};

/**
 * Parse WAF log entry from CloudWatch Logs
 */
function parseWAFLogEntry(logEntry, rawMessage = null) {
    try {
        const log = typeof logEntry === 'string' ? JSON.parse(logEntry) : logEntry;

        // Extract unique request ID from CloudWatch log
        const requestId = log.httpRequest?.requestId || `fallback-${log.timestamp}-${log.httpRequest?.clientIp || 'unknown'}`;

        return {
            request_id: requestId,
            raw_message: rawMessage || log,  // Store complete raw message
            timestamp: new Date(log.timestamp || Date.now()),
            action: log.action || 'UNKNOWN',
            rule_id: log.terminatingRuleId || log.ruleGroupId || null,
            rule_name: log.terminatingRuleType || null,
            source_ip: log.httpRequest?.clientIp || 'unknown',
            host: log.httpRequest?.host || null,
            uri: log.httpRequest?.uri || null,
            http_method: log.httpRequest?.httpMethod || null,
            http_request: JSON.stringify(log.httpRequest || {}),
            country: log.httpRequest?.country || null,
            user_agent: log.httpRequest?.headers?.find(h => h.name?.toLowerCase() === 'user-agent')?.value || null,
            headers: log.httpRequest?.headers || null,
            rate_based_rule_list: log.rateBasedRuleList || null,
            non_terminating_matching_rules: log.nonTerminatingMatchingRules || null,
            event_detail: log,
            web_acl_id: log.webaclId || null,
            web_acl_name: log.webaclName || null,
        };
    } catch (error) {
        console.error('Error parsing WAF log entry:', error);
        throw error;
    }
}

/**
 * Check if a WAF event should be auto-closed
 * Auto-closes known-safe patterns:
 * - Static assets (CSS, JS, images, fonts)
 * - Safe API endpoints (all application API routes)
 * - Common safe files (favicon, robots.txt, etc.)
 * Everything else goes to AI analysis
 */
function shouldAutoClose(logData) {
    // Must be ALLOW action
    if (logData.action !== 'ALLOW') {
        return false;
    }

    const uri = (logData.uri || '').toLowerCase();

    // Whitelist of safe patterns
    const safePatterns = [
        /^\/$/,  // Root
        /^\/dashboard$/,               // Dashboard page
        /^\/favicon\.(ico|svg|png)$/,
        /^\/robots\.txt$/,
        /^\/sitemap\.xml$/,
        /\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/,
        
        // Safe API endpoints - all application routes (with /api prefix)
        /^\/api\/events/,              // Events API (all operations)
        /^\/api\/smart-analysis/,      // Smart Analysis API (all operations)
        /^\/api\/escalations/,         // Escalations API
        /^\/api\/analysis-jobs/,       // Analysis Jobs API
        /^\/api\/smart-analysis-jobs/, // Smart Analysis Jobs API
        /^\/api\/agent-actions/,       // Agent Actions API
        /^\/api\/users/,               // Users API
        /^\/api\/blocklist/,           // Blocklist API
        /^\/api\/auth/,                // Authentication API
        /^\/api\/health$/,             // Health check endpoint
        /^\/health$/,                  // Health check endpoint
        
        // Safe API endpoints - without /api prefix (for API Gateway/CloudFront path rewriting)
        /^\/events/,                   // Events API (path rewritten)
        /^\/smart-analysis/,           // Smart Analysis API (path rewritten)
        /^\/escalations/,              // Escalations API (path rewritten)
        /^\/analysis-jobs/,            // Analysis Jobs API (path rewritten)
        /^\/smart-analysis-jobs/,      // Smart Analysis Jobs API (path rewritten)
        /^\/agent-actions/,            // Agent Actions API (path rewritten)
        /^\/users/,                    // Users API (path rewritten)
        /^\/blocklist/,                // Blocklist API (path rewritten)
        /^\/auth/                      // Authentication API (path rewritten)
    ];

    return safePatterns.some(pattern => pattern.test(uri));
}

/**
 * Create timeline entry for auto-closed events
 */
async function createAutoCloseTimelineEntry(client, eventId, logData) {
    try {
        const query = `
            INSERT INTO event_timeline (
                event_id, event_type, actor_type, actor_name,
                title, description, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `;

        const description = `Regular allowed traffic to safe resource (${logData.uri || 'unknown'}). Auto-closed at ingestion.`;

        const values = [
            eventId,
            'auto_close',
            'system',
            'ingestion-rule',
            'Automatically Closed',
            description
        ];

        await client.query(query, values);
        console.log(`Timeline entry created for auto-closed event ID: ${eventId}`);
    } catch (error) {
        // Log but don't throw - timeline entry failure shouldn't prevent event insertion
        console.error(`Failed to create timeline entry for event ${eventId}:`, error);
    }
}

/**
 * Create analysis job for an event
 * This queues the event for AI analysis by the analysis-worker Lambda
 */
async function createAnalysisJob(client, eventId) {
    try {
        const query = `
            INSERT INTO analysis_jobs (event_id, status, priority)
            VALUES ($1, 'pending', 0)
            RETURNING id
        `;

        const result = await client.query(query, [eventId]);
        const jobId = result.rows.length > 0 ? result.rows[0].id : null;

        if (jobId) {
            // Link the job to the event
            await client.query('UPDATE waf_log SET analysis_job_id = $1 WHERE id = $2', [jobId, eventId]);
            console.log(`Analysis job ${jobId} created for event ${eventId}`);
        }

        return jobId;
    } catch (error) {
        console.error(`Failed to create analysis job for event ${eventId}:`, error);
        // Don't throw - job creation failure shouldn't prevent event insertion
        return null;
    }
}

/**
 * Create timeline entry for auto-created analysis job
 */
async function createAnalysisJobTimelineEntry(client, eventId, jobId, logData) {
    try {
        const query = `
            INSERT INTO event_timeline (
                event_id, event_type, actor_type, actor_name,
                title, description, metadata, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
        `;

        const description = `Automatic AI analysis queued for blocked request from ${logData.source_ip} to ${logData.uri || 'unknown'}`;

        const values = [
            eventId,
            'ai_analysis_queued',
            'system',
            'ingestion-rule',
            'AI Analysis Queued',
            description,
            JSON.stringify({
                job_id: jobId,
                action: logData.action,
                source_ip: logData.source_ip,
                uri: logData.uri,
                rule_id: logData.rule_id
            })
        ];

        await client.query(query, values);
        console.log(`Timeline entry created for analysis job ${jobId}`);
    } catch (error) {
        // Log but don't throw - timeline entry failure shouldn't prevent event insertion
        console.error(`Failed to create timeline entry for job ${jobId}:`, error);
    }
}

/**
 * Insert WAF log entry into database if it doesn't already exist
 * Automatically closes safe ALLOW events (static assets, favicon, etc.)
 * Automatically creates analysis jobs for BLOCK events
 */
async function insertWAFLog(client, logData) {
    // Check if this event should be auto-closed
    const autoClose = shouldAutoClose(logData);
    
    // Log the decision for debugging
    console.log(`Event check: URI="${logData.uri}", Action="${logData.action}", AutoClose=${autoClose}`);

    let query, values;

    if (autoClose) {
        // Insert with auto-close fields
        query = `
            INSERT INTO waf_log (
                request_id, raw_message, timestamp, action, rule_id, rule_name, source_ip, host, uri, http_method,
                http_request, country, user_agent, headers, rate_based_rule_list,
                non_terminating_matching_rules, event_detail, web_acl_id, web_acl_name,
                status, severity_rating, analyzed_by, analyzed_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
            ON CONFLICT (request_id) DO NOTHING
            RETURNING id;
        `;

        values = [
            logData.request_id,
            JSON.stringify(logData.raw_message),
            logData.timestamp,
            logData.action,
            logData.rule_id,
            logData.rule_name,
            logData.source_ip,
            logData.host,
            logData.uri,
            logData.http_method,
            logData.http_request,
            logData.country,
            logData.user_agent,
            JSON.stringify(logData.headers),
            JSON.stringify(logData.rate_based_rule_list),
            JSON.stringify(logData.non_terminating_matching_rules),
            JSON.stringify(logData.event_detail),
            logData.web_acl_id,
            logData.web_acl_name,
            'closed',                    // status
            0,                           // severity_rating
            'auto-close-rule',           // analyzed_by
            new Date()                   // analyzed_at
        ];
    } else {
        // Normal insert - will go to AI analysis
        query = `
            INSERT INTO waf_log (
                request_id, raw_message, timestamp, action, rule_id, rule_name, source_ip, host, uri, http_method,
                http_request, country, user_agent, headers, rate_based_rule_list,
                non_terminating_matching_rules, event_detail, web_acl_id, web_acl_name
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            ON CONFLICT (request_id) DO NOTHING
            RETURNING id;
        `;

        values = [
            logData.request_id,
            JSON.stringify(logData.raw_message),
            logData.timestamp,
            logData.action,
            logData.rule_id,
            logData.rule_name,
            logData.source_ip,
            logData.host,
            logData.uri,
            logData.http_method,
            logData.http_request,
            logData.country,
            logData.user_agent,
            JSON.stringify(logData.headers),
            JSON.stringify(logData.rate_based_rule_list),
            JSON.stringify(logData.non_terminating_matching_rules),
            JSON.stringify(logData.event_detail),
            logData.web_acl_id,
            logData.web_acl_name,
        ];
    }

    try {
        const result = await client.query(query, values);
        const insertedId = result.rows.length > 0 ? result.rows[0].id : null;

        // If auto-closed and inserted successfully, create timeline entry
        if (autoClose && insertedId) {
            await createAutoCloseTimelineEntry(client, insertedId, logData);
        }

        // If BLOCK action and inserted successfully, create analysis job (unless paused)
        let jobQueued = false;
        if (!autoClose && insertedId && logData.action === 'BLOCK') {
            const pauseAutoAnalysis = process.env.PAUSE_AUTO_ANALYSIS === 'true';

            if (!pauseAutoAnalysis) {
                const jobId = await createAnalysisJob(client, insertedId);
                if (jobId) {
                    await createAnalysisJobTimelineEntry(client, insertedId, jobId, logData);
                    jobQueued = true;
                }
            } else {
                console.log(`Auto-analysis paused - BLOCK event ${insertedId} inserted without job creation (IP: ${logData.source_ip}, URI: ${logData.uri})`);
            }
        }

        return { id: insertedId, autoClosed: autoClose, jobQueued };
    } catch (error) {
        // If it's a duplicate key error, return null (record already exists)
        if (error.code === '23505') {
            return { id: null, autoClosed: false, jobQueued: false };
        }
        throw error;
    }
}

/**
 * Fetch WAF logs from CloudWatch Logs
 */
async function fetchWAFLogsFromCloudWatch(logGroupName, lookbackMinutes) {
    const cloudwatchClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'us-east-1' });

    try {
        // Calculate time range
        const endTime = Date.now();
        const startTime = endTime - (lookbackMinutes * 60 * 1000);

        console.log(`Fetching logs from ${logGroupName} between ${new Date(startTime)} and ${new Date(endTime)}`);

        // Fetch log events using FilterLogEvents
        const command = new FilterLogEventsCommand({
            logGroupName: logGroupName,
            startTime: startTime,
            endTime: endTime,
            limit: 100,  // Maximum events to retrieve
        });

        const response = await cloudwatchClient.send(command);

        console.log(`Retrieved ${response.events?.length || 0} log events from CloudWatch`);

        return response.events || [];

    } catch (error) {
        console.error('Error fetching logs from CloudWatch:', error);
        throw error;
    }
}

/**
 * Process CloudWatch Logs subscription event
 * Decompresses and extracts log data from CloudWatch subscription filter
 */
async function processCloudWatchSubscriptionEvent(event) {
    try {
        // Decode base64 and decompress gzip
        const payload = Buffer.from(event.awslogs.data, 'base64');
        const decompressed = await gunzip(payload);
        const logData = JSON.parse(decompressed.toString('utf8'));

        console.log(`CloudWatch subscription event from log group: ${logData.logGroup}`);
        console.log(`Log stream: ${logData.logStream}`);
        console.log(`Number of log events: ${logData.logEvents?.length || 0}`);

        // Extract log group name and events
        return {
            logGroupName: logData.logGroup,
            logStream: logData.logStream,
            logEvents: (logData.logEvents || []).map(e => ({
                message: e.message,
                timestamp: e.timestamp,
                id: e.id
            }))
        };
    } catch (error) {
        console.error('Error processing CloudWatch subscription event:', error);
        throw error;
    }
}

/**
 * Generate sample WAF data for testing when no real WAF logs are available
 */
function generateSampleWAFData() {
    const now = Date.now();
    const samples = [];

    const actions = ['BLOCK', 'ALLOW', 'COUNT'];
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];
    const uris = ['/api/login', '/admin', '/wp-admin', '/', '/api/data'];
    const rules = [
        { id: 'AWS-AWSManagedRulesCommonRuleSet', name: 'GenericRFI' },
        { id: 'AWS-AWSManagedRulesSQLiRuleSet', name: 'SQLi_QUERYARGUMENTS' },
        { id: 'AWS-AWSManagedRulesKnownBadInputsRuleSet', name: 'ExploitablePaths' },
        { id: 'RateBasedRule', name: 'RateLimitExceeded' },
    ];

    for (let i = 0; i < 5; i++) {
        const rule = rules[Math.floor(Math.random() * rules.length)];
        const action = actions[Math.floor(Math.random() * actions.length)];

        samples.push({
            timestamp: now - (i * 60000), // Each sample 1 minute apart
            action: action,
            terminatingRuleId: rule.id,
            terminatingRuleType: rule.name,
            httpRequest: {
                clientIp: `192.168.1.${Math.floor(Math.random() * 255)}`,
                uri: uris[Math.floor(Math.random() * uris.length)],
                httpMethod: methods[Math.floor(Math.random() * methods.length)],
                country: 'US',
                headers: [
                    { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    { name: 'Host', value: 'example.com' }
                ]
            },
            webaclId: 'arn:aws:wafv2:us-east-1:123456789012:regional/webacl/test/a1b2c3d4',
            webaclName: 'test-web-acl',
            rateBasedRuleList: [],
            nonTerminatingMatchingRules: []
        });
    }

    return samples;
}

/**
 * Main Lambda handler
 */
export const handler = async (event) => {
    console.log('Lambda function started');
    console.log('Event:', JSON.stringify(event, null, 2));

    let dbClient = null;
    let insertedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    let autoClosedCount = 0;
    let jobsQueuedCount = 0;

    try {
        // Connect to database
        console.log('Connecting to database...');
        dbClient = new Client(dbConfig);
        await dbClient.connect();
        console.log('Database connected successfully');

        let wafLogs = [];
        let logGroupName = null;
        const lookbackMinutes = parseInt(process.env.LOOKBACK_MINUTES || event.lookbackMinutes || '60');

        // MODE 1: CloudWatch Subscription Event (real-time processing)
        if (event.awslogs && event.awslogs.data) {
            console.log('Processing CloudWatch Subscription event...');
            const subscriptionData = await processCloudWatchSubscriptionEvent(event);
            logGroupName = subscriptionData.logGroupName;
            wafLogs = subscriptionData.logEvents;
            console.log(`Processing ${wafLogs.length} log events from subscription: ${logGroupName}`);
        }
        // MODE 2: Scheduled/Manual Invocation (poll from multiple CloudWatch log groups)
        else {
            console.log('Processing scheduled/manual invocation...');

            // Support multiple log groups: "group1,group2,group3"
            const logGroupsConfig = process.env.WAF_LOG_GROUP || event.logGroupName || '';
            const logGroups = logGroupsConfig.split(',').map(g => g.trim()).filter(Boolean);

            if (logGroups.length === 0) {
                console.log('No log groups configured, using sample data');
                wafLogs = generateSampleWAFData().map(log => ({
                    message: JSON.stringify(log)
                }));
            } else {
                console.log(`Fetching logs from ${logGroups.length} log group(s): ${logGroups.join(', ')}`);

                // Fetch from all configured log groups
                for (const group of logGroups) {
                    console.log(`Fetching from: ${group}`);
                    const logs = await fetchWAFLogsFromCloudWatch(group, lookbackMinutes);
                    console.log(`Retrieved ${logs.length} events from ${group}`);
                    wafLogs.push(...logs);
                }
            }
        }

        console.log(`Processing ${wafLogs.length} WAF log entries...`);

        // Process each log entry
        for (const logEvent of wafLogs) {
            try {
                // Parse the log entry and include raw message
                const logData = parseWAFLogEntry(logEvent.message, logEvent.message);
                const result = await insertWAFLog(dbClient, logData);

                if (result.id) {
                    insertedCount++;
                    if (result.autoClosed) {
                        autoClosedCount++;
                        console.log(`Auto-closed event ID: ${result.id}, URI: ${logData.uri}, IP: ${logData.source_ip}`);
                    } else {
                        if (result.jobQueued) {
                            jobsQueuedCount++;
                            console.log(`Inserted BLOCK event ID: ${result.id}, AI analysis job queued, IP: ${logData.source_ip}, URI: ${logData.uri}`);
                        } else {
                            console.log(`Inserted new record with ID: ${result.id}, request_id: ${logData.request_id}`);
                        }
                    }
                } else {
                    duplicateCount++;
                    console.log(`Duplicate record skipped: request_id ${logData.request_id}, IP: ${logData.source_ip}`);
                }
            } catch (error) {
                errorCount++;
                console.error('Error processing log entry:', error);
                console.error('Log event:', JSON.stringify(logEvent, null, 2));
            }
        }

        const result = {
            statusCode: 200,
            body: {
                message: 'WAF logs processed successfully',
                statistics: {
                    total_processed: wafLogs.length,
                    inserted: insertedCount,
                    auto_closed: autoClosedCount,
                    jobs_queued: jobsQueuedCount,
                    duplicates: duplicateCount,
                    errors: errorCount
                }
            }
        };

        console.log('Processing completed:', result.body);
        return result;

    } catch (error) {
        console.error('Lambda execution error:', error);
        return {
            statusCode: 500,
            body: {
                message: 'Error processing WAF logs',
                error: error.message,
                statistics: {
                    inserted: insertedCount,
                    auto_closed: autoClosedCount,
                    jobs_queued: jobsQueuedCount,
                    duplicates: duplicateCount,
                    errors: errorCount
                }
            }
        };
    } finally {
        if (dbClient) {
            await dbClient.end();
            console.log('Database connection closed');
        }
    }
};
