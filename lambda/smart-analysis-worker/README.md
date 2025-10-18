# Smart Analysis Worker Lambda

This Lambda function processes smart analysis jobs from the queue and performs bulk AI analysis on grouped WAF events.

## Overview

The Smart Analysis Worker is triggered every 5 minutes by EventBridge and processes up to 2 concurrent jobs. It groups WAF events by **source IP + time (minute precision)** and performs bulk AI analysis using the bulk-analysis-agent.

## Features

- **Max 2 Concurrent Jobs**: Enforces a limit of 2 running jobs to prevent system overload
- **Time-Based Grouping**: Groups events by source IP + minute timestamp (no arbitrary 50-record limit)
- **Attack Pattern Recognition**: Analyzes ALL events within same minute for better correlation
- **Key Information Extraction**: Sends only essential fields to AI (no raw data)
- **Automatic Event Patching**: Updates all linked events with analysis results
- **Retry Logic**: Failed jobs are retried up to 3 times

## Architecture

1. **Trigger**: EventBridge rule runs every 5 minutes
2. **Concurrency Check**: Verifies max 2 jobs are running
3. **Job Selection**: Atomically selects next pending job
4. **Data Gathering**: Fetches task and ALL linked events for IP+time group
5. **Payload Formatting**: Extracts key info and generates summary (no event limit)
6. **AI Analysis**: Invokes bulk-analysis-agent via Bedrock AgentCore
7. **Result Storage**: Updates task and patches all linked events

## Data Flow

```
EventBridge (5 min) → Lambda
  ↓
Check running jobs (max 2)
  ↓
Get pending job from smart_analysis_jobs
  ↓
Fetch task from smart_analysis_tasks
  ↓
Get linked events via smart_analysis_event_links
  ↓
Format payload (key info only):
  - Summary: IP, country, event count, time range, unique URIs/rules, action/method breakdowns
  - Events: timestamp, action, rule, uri, method, user_agent, host (NO raw data)
  ↓
Invoke bulk-analysis-agent
  ↓
Parse response:
  - severity_rating
  - security_analysis
  - recommended_actions
  - attack_type
  ↓
Update smart_analysis_tasks with results
  ↓
Bulk patch all linked waf_log events
```

## Key Information Extraction

The Lambda extracts ONLY these fields from events:
- `event_id`
- `timestamp`
- `action`
- `rule_id`
- `rule_name`
- `uri`
- `http_method`
- `user_agent`
- `host`

**NOT included**: `raw_message`, `headers`, `event_detail`, `http_request`

This reduces token usage and focuses AI on important security indicators.

## Aggregated Summary

The Lambda generates a summary with:
- `source_ip`
- `country`
- `total_events` (ALL events in IP+time group, no 50-record limit)
- `time_range` (first, last, duration_minutes)
- `unique_uris` (top 20)
- `unique_rules` (top 10)
- `action_breakdown` (ALLOW, BLOCK, etc.)
- `method_breakdown` (GET, POST, etc.)

**Note**: Time-based grouping format is `YYYYMMDD-HHMM` (minute precision)

## Deployment

```bash
cd /aws/soc-lite/lambda/smart-analysis-worker

# Set bulk analysis agent ARN (after deploying agent)
export BULK_ANALYSIS_AGENT_ARN="arn:aws:bedrock-agentcore:us-east-1:581425340084:runtime/bulk_analysis_agent-XXXXX"

# Deploy Lambda
./deploy.sh
```

## Environment Variables

Required environment variables (set by deploy.sh):
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_SSL`: Enable SSL (true/false)
- `BULK_ANALYSIS_AGENT_ARN`: Bedrock AgentCore ARN for bulk analysis agent

## Monitoring

Check Lambda logs:
```bash
aws logs tail /aws/lambda/soc-lite-smart-analysis-worker --follow
```

Check job stats in database:
```sql
SELECT status, COUNT(*)
FROM smart_analysis_jobs
GROUP BY status;
```

## Testing

Test the Lambda manually:
```bash
aws lambda invoke \
  --function-name soc-lite-smart-analysis-worker \
  --region us-east-1 \
  output.json

cat output.json
```

## Dependencies

- `@aws-sdk/client-bedrock-agentcore`: For invoking AI agents
- `pg`: PostgreSQL client

## Related Components

- **Backend Service**: `/aws/soc-lite/backend/src/services/smartAnalysisService.ts`
- **Models**: `/aws/soc-lite/backend/src/models/SmartAnalysis*.ts`
- **Agent**: `/aws/soc-lite/agents/bulk-analysis-agent/`
- **Analysis Worker**: `/aws/soc-lite/lambda/analysis-worker/` (similar pattern)

## Notes

- EventBridge schedule is 5 minutes (not 1 minute) to reduce costs and load
- Max 2 concurrent jobs prevents overwhelming the AI agent
- Jobs are processed asynchronously for better performance
- Failed jobs are automatically retried up to 3 times
- Key info extraction reduces AI token costs by ~80%
- **Time-based grouping**: Groups by IP+minute instead of arbitrary 50-record limit
- **Better attack correlation**: Events within same minute likely part of same attack campaign
