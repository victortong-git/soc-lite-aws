# Smart Analysis Task Generator Lambda

This Lambda function automatically generates smart analysis tasks from unlinked WAF events and queues them for AI analysis. It runs unattended on a schedule via EventBridge.

## Overview

The Smart Analysis Task Generator is triggered every 15 minutes by EventBridge and automatically creates analysis tasks grouped by source IP + time (minute precision), then queues them for processing.

## Features

- **Unattended Operation**: Runs automatically every 15 minutes without human intervention
- **Time-Based Grouping**: Groups events by source IP + minute timestamp (format: `YYYYMMDD-HHMM`)
- **Auto-Queue**: Automatically creates jobs for the smart-analysis-worker to process
- **No Record Limits**: Analyzes ALL events within same IP+time group
- **Idempotent**: Skips IP+time groups that already have tasks
- **Parallel Processing**: Works alongside frontend UI manual triggers

## Architecture

```
EventBridge (every 15 min) → Lambda: task-generator
  ↓
1. Query waf_log for unlinked events (status='open', smart_analysis_task_id IS NULL)
2. Group by: source_ip + DATE_TRUNC('minute', timestamp)
3. For each IP+time group:
   - Create smart_analysis_task
   - Link events via smart_analysis_event_links
   - Create smart_analysis_job (status='pending')
  ↓
Smart Analysis Worker (every 5 min)
  ↓
Process jobs → AI analysis → Update results
```

## Two Generation Methods

### Method 1: Frontend UI (Manual)
- User clicks "Generate & Auto-Queue Analysis" button
- Calls backend API: `POST /api/smart-analysis/generate-and-queue`
- Immediate task generation and job creation

### Method 2: EventBridge Lambda (Unattended)
- **This Lambda** - runs every 15 minutes automatically
- No human intervention required
- Continuous monitoring and analysis

**Both methods create the same result**: Tasks + Jobs ready for smart-analysis-worker

## Deployment

### Prerequisites

Database credentials must be configured via environment variables:
- `DB_HOST`: Database hostname
- `DB_PORT`: Database port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password (set via .env or Lambda environment variables)
- `DB_SSL`: Enable SSL connection (true/false)

### Deploy Lambda

```bash
cd /aws/soc-lite/lambda/smart-analysis-task-generator
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Install dependencies (pg)
2. Package Lambda function (zip)
3. Create/update Lambda function
4. Create EventBridge rule (`rate(15 minutes)`)
5. Configure Lambda permissions
6. Set EventBridge target

### Verify Deployment

```bash
# Check Lambda exists
aws lambda get-function --function-name soc-lite-smart-analysis-task-generator --region us-east-1

# Check EventBridge rule
aws events describe-rule --name smart-analysis-task-generator-trigger --region us-east-1

# View targets
aws events list-targets-by-rule --rule smart-analysis-task-generator-trigger --region us-east-1
```

## Environment Variables

Set by deploy.sh automatically:
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_SSL`: Enable SSL (true/false)

## Testing

### Manual Invocation

Test the Lambda manually:
```bash
aws lambda invoke \
  --function-name soc-lite-smart-analysis-task-generator \
  --region us-east-1 \
  response.json

cat response.json
```

Expected response:
```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "message": "Generated 5 task(s) and created 5 job(s)",
    "tasks_created": 5,
    "jobs_created": 5,
    "events_linked": 47,
    "source_ips_processed": ["192.168.1.100", "10.0.0.5"],
    "execution_time_ms": 1245
  }
}
```

### Check Database Results

```sql
-- Check recently created tasks
SELECT id, source_ip, time_group, num_linked_events, created_at
FROM smart_analysis_tasks
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check queued jobs
SELECT id, task_id, status, created_at
FROM smart_analysis_jobs
WHERE status = 'pending'
ORDER BY created_at DESC;

-- Check event grouping
SELECT source_ip, time_group, COUNT(*) as events
FROM smart_analysis_tasks
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY source_ip, time_group;
```

## Monitoring

### CloudWatch Logs

View Lambda execution logs:
```bash
aws logs tail /aws/lambda/soc-lite-smart-analysis-task-generator --follow --region us-east-1
```

### EventBridge Metrics

Check invocation stats:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=soc-lite-smart-analysis-task-generator \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 900 \
  --statistics Sum
```

## Configuration

### Adjust Schedule Frequency

Edit EventBridge rule schedule:
```bash
# Every 30 minutes
aws events put-rule \
  --name smart-analysis-task-generator-trigger \
  --schedule-expression "rate(30 minutes)" \
  --state ENABLED \
  --region us-east-1

# Hourly
aws events put-rule \
  --name smart-analysis-task-generator-trigger \
  --schedule-expression "rate(1 hour)" \
  --state ENABLED \
  --region us-east-1

# Custom cron (every 15 min)
aws events put-rule \
  --name smart-analysis-task-generator-trigger \
  --schedule-expression "cron(0/15 * * * ? *)" \
  --state ENABLED \
  --region us-east-1
```

### Disable Automatic Generation

Disable EventBridge rule (keeps Lambda, stops automatic triggers):
```bash
aws events disable-rule \
  --name smart-analysis-task-generator-trigger \
  --region us-east-1
```

Re-enable:
```bash
aws events enable-rule \
  --name smart-analysis-task-generator-trigger \
  --region us-east-1
```

## Function Details

- **Runtime**: Node.js 22.x
- **Handler**: index.handler
- **Timeout**: 300 seconds (5 minutes)
- **Memory**: 512 MB
- **Trigger**: EventBridge rule (every 15 minutes)
- **IAM Role**: soc-lite-backend-role

## Time-Based Grouping Details

### Format
Time groups use format: `YYYYMMDD-HHMM`

Examples:
- `20251012-1430` - October 12, 2025 at 14:30
- `20251012-1431` - October 12, 2025 at 14:31

### Grouping Logic
Events are grouped if they match:
1. **Same source IP**
2. **Same minute** (timestamp truncated to minute precision)

### Example Scenario
```
Events:
- 192.168.1.100 @ 2025-10-12 14:30:15 → Group: 20251012-1430
- 192.168.1.100 @ 2025-10-12 14:30:45 → Group: 20251012-1430 (same)
- 192.168.1.100 @ 2025-10-12 14:31:10 → Group: 20251012-1431 (different)

Result:
- Task 1: IP 192.168.1.100 @ 20251012-1430 (2 events)
- Task 2: IP 192.168.1.100 @ 20251012-1431 (1 event)
```

## Benefits

✅ **Unattended**: Runs automatically every 15 minutes
✅ **No human intervention**: Works 24/7 without UI access
✅ **Continuous monitoring**: New WAF events analyzed within 15 minutes
✅ **Time-based grouping**: Better attack correlation (IP + minute)
✅ **Auto-queuing**: Jobs created immediately for worker processing
✅ **Scalable**: Lambda auto-scales with event volume
✅ **Cost-effective**: Only runs on schedule (15 min intervals)
✅ **Redundant**: Complements frontend UI manual triggers

## Troubleshooting

### Issue: No tasks being created

**Check unlinked events:**
```sql
SELECT COUNT(*) FROM waf_log
WHERE status = 'open' AND smart_analysis_task_id IS NULL;
```

**Check Lambda logs:**
```bash
aws logs tail /aws/lambda/soc-lite-smart-analysis-task-generator --follow
```

### Issue: EventBridge not triggering

**Check rule status:**
```bash
aws events describe-rule --name smart-analysis-task-generator-trigger --region us-east-1
```

**Verify Lambda has permission:**
```bash
aws lambda get-policy --function-name soc-lite-smart-analysis-task-generator --region us-east-1
```

### Issue: Duplicate tasks

Tasks are idempotent - Lambda checks for existing tasks before creating:
```javascript
// Check in code (index.mjs line 82-89):
const existingTask = await pool.query(
  'SELECT id FROM smart_analysis_tasks WHERE source_ip = $1 AND time_group = $2'
);
```

## Related Components

- **Smart Analysis Worker**: `/aws/soc-lite/lambda/smart-analysis-worker/` - Processes queued jobs
- **Backend Service**: `/aws/soc-lite/backend/src/services/smartAnalysisService.ts` - Manual UI triggers
- **Frontend UI**: `/aws/tmp/frontend/src/pages/SmartAIAnalysisPage.tsx` - Manual generation button
- **Bulk Analysis Agent**: `/aws/soc-lite/agents/bulk-analysis-agent/` - AI analysis

## Notes

- **Frequency**: 15 minutes is balanced for continuous monitoring without excessive costs
- **Coordination**: Works seamlessly with smart-analysis-worker (runs every 5 min)
- **Manual override**: Frontend UI button still available for immediate generation
- **No conflicts**: Idempotent design prevents duplicate tasks from multiple sources
