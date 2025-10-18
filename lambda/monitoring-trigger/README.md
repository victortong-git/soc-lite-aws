# SOC Lite Monitoring Trigger Lambda

This Lambda function is triggered daily by EventBridge to invoke the Monitoring Agent and check for patterns in severity 3 WAF events.

## Overview

- **Trigger**: EventBridge scheduled rule `soc-lite-monitoring-daily` (daily at 9 AM UTC)
- **Purpose**: Queries severity 3 events from the last 24 hours and invokes the Monitoring Agent to detect patterns
- **Agent**: Invokes the Monitoring Agent via Amazon Bedrock AgentCore Runtime
- **Notifications**: Sends alerts via SNS when patterns are detected

## Architecture

```
EventBridge (Daily 9 AM UTC)
    ↓
Lambda Function (monitoring-trigger)
    ↓
Query PostgreSQL (severity 3 events, last 24h)
    ↓
Invoke Monitoring Agent (Bedrock AgentCore)
    ↓
Pattern Detection (3+ occurrences from same IP/URI)
    ↓
Send SNS Alerts (if patterns found)
```

## Deployment

### Prerequisites

1. Set environment variables in your shell or `.env` file:
   ```bash
   export DB_HOST="<YOUR_RDS_ENDPOINT>"
   export DB_PORT="5432"
   export DB_NAME="<YOUR_DB_NAME>"
   export DB_USER="<YOUR_DB_USER>"
   export DB_PASSWORD="<YOUR_DB_PASSWORD>"
   export MONITORING_AGENT_ARN="<YOUR_MONITORING_AGENT_ARN>"
   export SNS_TOPIC_ARN_MONITORING="<YOUR_SNS_TOPIC_ARN>"
   export ALERT_EMAIL="<YOUR_ALERT_EMAIL>"
   ```

2. Ensure you have AWS credentials configured with permissions for:
   - Lambda (create/update functions)
   - IAM (create/manage roles)
   - EventBridge (update targets)
   - Bedrock (invoke agents)

### Deploy

```bash
cd /aws/soc-lite/lambda/monitoring-trigger
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Create IAM role with necessary permissions
2. Install Node.js dependencies
3. Package the Lambda function
4. Create or update the Lambda function
5. Configure EventBridge trigger

## Manual Testing

Test the Lambda function manually:

```bash
aws lambda invoke \
  --function-name soc-lite-monitoring-trigger \
  --region us-east-1 \
  response.json

cat response.json
```

## Monitoring

View CloudWatch logs:

```bash
aws logs tail /aws/lambda/soc-lite-monitoring-trigger --follow --region us-east-1
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DB_HOST` | PostgreSQL database host |
| `DB_PORT` | PostgreSQL database port (default: 5432) |
| `DB_NAME` | Database name |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `DB_SSL` | Enable SSL for database connection (default: true) |
| `MONITORING_AGENT_ARN` | ARN of the Monitoring Agent |
| `SNS_TOPIC_ARN_MONITORING` | SNS topic for monitoring alerts |
| `ALERT_EMAIL` | Email address for alerts |

## Function Details

- **Runtime**: Node.js 22.x
- **Handler**: index.handler
- **Timeout**: 60 seconds
- **Memory**: 512 MB
- **Trigger**: EventBridge rule (daily at 9 AM UTC)

## Response Format

Success response:
```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "message": "Monitoring agent invoked successfully",
    "eventsChecked": 15,
    "patterns": [
      {
        "source_ip": "192.168.1.100",
        "uri": "/api/sensitive",
        "count": 5
      }
    ],
    "alertsSent": 1
  }
}
```

Error response:
```json
{
  "statusCode": 500,
  "body": {
    "success": false,
    "error": "Error message",
    "stack": "Error stack trace"
  }
}
```
