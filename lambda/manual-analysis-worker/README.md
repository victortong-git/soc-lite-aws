# Manual Analysis Worker Lambda

**Function Name:** `soc-lite-manual-analysis-worker`
**Purpose:** Processes manual analysis jobs triggered by users clicking "AI Analysis" button

## Overview

This Lambda function processes individual event analysis jobs that are created when users manually trigger AI analysis from the frontend. It provides on-demand analysis for specific events that SOC analysts want to investigate further.

## Key Features

- **Manual Triggering**: Only processes jobs explicitly created by users via frontend
- **Individual Analysis**: Analyzes one event at a time using secops-agent
- **Concurrency Control**: Limits to 2 concurrent jobs to prevent overload
- **Automatic Retry**: Retries failed jobs up to 3 times
- **Timeline Tracking**: Creates detailed timeline entries for analysis progress

## Configuration

**Runtime:** Node.js 22
**Memory:** 256 MB
**Timeout:** 60 seconds
**Trigger:** EventBridge (every 5 minutes)
**EventBridge Rule:** `manual-analysis-worker-trigger`

### Environment Variables

```
DB_HOST=agentic-soc-agent.cs32ggwceco2.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=agentdb
DB_USER=agenticsoc
DB_PASSWORD=<password>
DB_SSL=true
NODE_ENV=production
SECURITY_AGENT_ARN=arn:aws:bedrock-agentcore:us-east-1:581425340084:runtime/secops_agent-5htKASCV4N
```

## Workflow

1. **EventBridge triggers** Lambda every 5 minutes
2. **Check concurrency**: Max 2 jobs running at once
3. **Fetch pending jobs** from `analysis_jobs` table (status='pending')
4. **Process job**:
   - Mark job as 'running'
   - Fetch event details from `waf_log` table
   - Invoke secops-agent via Bedrock AgentCore
   - Parse AI response (security analysis + triage)
   - Update event with analysis results
   - Create timeline entries
   - Execute triage actions (status updates, notifications)
5. **Mark job complete** or retry on failure

## Database Tables

### analysis_jobs
- `id`: Job identifier
- `event_id`: Link to waf_log event
- `status`: pending/queued/running/completed/failed
- `attempts`: Number of processing attempts
- `max_attempts`: Maximum retry limit (default: 3)
- `started_at`: When processing started
- `completed_at`: When processing finished
- `security_analysis`: AI analysis text
- `severity_rating`: 0-5 severity score
- `error_message`: Error details if failed

## Frontend Integration

User clicks "AI Analysis" button → Backend API creates job → This worker processes it

**API Endpoint:** `POST /api/events/:id/analyze`
**Response:** Job created with status 'pending'
**Frontend:** Polls for job completion, shows analysis when done

## Differences from Automated Analysis

| Feature | Manual Analysis | Smart Analysis |
|---------|----------------|----------------|
| Trigger | User button click | Automatic (every 5 min) |
| Scope | Single event | Grouped events (IP+time) |
| Table | `analysis_jobs` | `smart_analysis_jobs` |
| Agent | secops-agent | bulk-analysis-agent |
| Use Case | Specific investigation | Bulk event processing |

## Deployment

```bash
# Install dependencies
npm install

# Deploy to AWS
./deploy.sh
```

## Monitoring

**CloudWatch Logs:** `/aws/lambda/soc-lite-manual-analysis-worker`

**Key Metrics:**
- Jobs processed per invocation
- Average processing duration
- Error rate
- Concurrency usage

## Troubleshooting

**Jobs stuck in 'pending':**
- Check Lambda is invoked by EventBridge (CloudWatch logs)
- Verify environment variables are set correctly
- Check database connectivity

**Jobs failing:**
- Check error_message in analysis_jobs table
- Review CloudWatch logs for exceptions
- Verify secops-agent ARN is correct

**No results appearing:**
- Confirm job moved to 'completed' status
- Check event was updated with analysis results
- Verify timeline entries were created

## Architecture Notes

This worker was created after removing the old `analysis-worker` Lambda that caused overload issues. The key difference:

- **Old worker**: Auto-created jobs for every BLOCK event (caused 146 jobs for 146 events)
- **New worker**: Only processes manually requested analysis (much lower volume)

Automated bulk processing now handled by `smart-analysis-worker` system.
