# SOC Lite Lambda Functions

This directory contains Lambda functions for the SOC Lite system.

## Active Lambda Functions

### 1. get-waf-alert
**Purpose**: Ingests WAF events from CloudWatch Logs into RDS PostgreSQL database
- Auto-closes safe ALLOW events (static assets)
- Creates smart analysis tasks for BLOCK events (grouped by IP+time)
- Environment: `PAUSE_AUTO_ANALYSIS=true` (uses smart analysis only)
- Trigger: CloudWatch Logs subscription or scheduled polling

### 2. smart-analysis-task-generator
**Purpose**: Groups WAF events by source IP and time (minute precision)
- Creates smart_analysis_tasks for bulk processing
- Auto-queues jobs for analysis
- Schedule: Every 5 minutes (EventBridge)

### 3. smart-analysis-worker
**Purpose**: Processes bulk analysis jobs using bulk-analysis-agent
- Invokes AWS Bedrock AgentCore bulk-analysis-agent
- Updates all linked events with analysis results
- Creates escalations for high-severity threats
- Schedule: Every 3 minutes (EventBridge)

### 4. escalation-processor
**Purpose**: Handles escalation notifications
- Sends SNS/SES notifications for critical events

### 5. escalation-plugin-waf-blocklist
**Purpose**: Automatically blocks malicious IPs in WAF
- Processes escalation events
- Updates WAF IP blocklist

### 6. escalation-plugin-servicenow
**Purpose**: Creates ServiceNow incidents for escalations
- Integration with ServiceNow ITSM

### 7. monitoring-trigger
**Purpose**: Daily monitoring for pattern detection
- Schedule: Daily at 9 AM UTC

### 8. daily-monitoring-trigger
**Purpose**: Scheduled monitoring tasks
- Pattern detection and anomaly alerts

### 9. manual-analysis-worker
**Purpose**: Processes manual analysis jobs (triggered via "AI Analysis" button)
- Invokes secops-agent for individual event analysis
- Updates events with AI analysis results
- Memory: 256 MB, Timeout: 60 seconds
- Schedule: Every 5 minutes (EventBridge)
- Concurrency: 2 jobs at a time

## Archived Lambda Functions

Deprecated functions moved to `/aws2/not-in-use/`:

- **analysis-worker** (archived 2025-10-14): Individual event analysis worker
  - Replaced by smart-analysis-worker for bulk processing
  - Created individual analysis_jobs for each BLOCK event (caused overload)
  - EventBridge trigger `analysis-worker-trigger` deleted from AWS

## System Architecture

### WAF Event Processing Flow

1. **Ingestion**: `get-waf-alert` → Inserts events into `waf_log` table
2. **Grouping**: `smart-analysis-task-generator` → Groups by IP+time into `smart_analysis_tasks`
3. **Analysis**: `smart-analysis-worker` → Bulk AI analysis via Bedrock AgentCore
4. **Escalation**: `escalation-processor` + plugins → Handle high-severity threats

### Analysis Methods

- **Smart Analysis** (Automated): Groups events by IP+time, 1 AI call per group
  - Triggered automatically every 5 minutes
  - Handles bulk attacks efficiently
  - Primary method for all BLOCK events

- **Manual Analysis**: User-triggered analysis for specific events
  - User clicks "AI Analysis" button on event detail page
  - Creates job in `analysis_jobs` table
  - Processed by `manual-analysis-worker` every 5 minutes
  - Uses secops-agent for individual analysis

## Naming Convention

- Use kebab-case for folder names
- Each folder should be self-contained with its own `package.json` and `deploy.sh`
- Include a `README.md` in each function folder
- Prefix function names with `soc-lite-` in AWS

## Best Practices

1. **Environment Variables**: Store configuration in Lambda environment variables, not in code
2. **Error Handling**: Always include try/catch blocks and proper error logging
3. **Timeout**: Set appropriate timeout values based on function complexity
4. **Memory**: Start with 512 MB and adjust based on CloudWatch metrics
5. **IAM Permissions**: Follow principle of least privilege
6. **Logging**: Use console.log for CloudWatch logs with structured JSON
7. **Connection Pooling**: Reuse database connections across Lambda invocations
