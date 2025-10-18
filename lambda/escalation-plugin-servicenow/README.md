# ServiceNow Escalation Plugin Lambda

This Lambda function creates ServiceNow Security Incidents for escalation events in the SOC-Lite system.

## Overview

The ServiceNow escalation plugin integrates with ServiceNow's REST API to automatically create security incidents when escalation events are triggered. It processes pending escalation records from the database and creates corresponding incidents in ServiceNow.

## Architecture

- **Trigger**: EventBridge scheduled rule (every 5 minutes)
- **Runtime**: Node.js 20.x
- **Database**: PostgreSQL RDS (escalation_events table)
- **External API**: ServiceNow Incident Management API

## How It Works

1. Lambda is triggered every 5 minutes by EventBridge
2. Queries `escalation_events` table for records where `completed_incident = FALSE`
3. For each pending escalation:
   - Creates ServiceNow incident via REST API
   - Maps severity (4=High, 5=Critical) to ServiceNow urgency/impact
   - Includes event details, source information, and metadata
   - Stores incident number and sys_id in database
   - Marks `completed_incident = TRUE` on success
4. Handles errors and logs failures in database

## ServiceNow Incident Mapping

| Escalation Severity | ServiceNow Urgency | ServiceNow Impact | ServiceNow Priority |
|---------------------|--------------------|--------------------|---------------------|
| 5 (Critical)        | 1 (High)           | 1 (High)           | 1 (Critical)        |
| 4 (High)            | 1 (High)           | 2 (Medium)         | 2 (High)            |

### Incident Fields

- **short_description**: Escalation title
- **description**: Full message + detail_payload + source info
- **category**: Security
- **subcategory**: Intrusion Detection
- **state**: 1 (New)
- **assignment_group**: Configurable (default: "SOC Team")
- **caller_id**: ServiceNow API username

## Configuration

### Environment Variables

#### Database Connection
- `DB_HOST`: PostgreSQL RDS hostname
- `DB_PORT`: Database port (default: 5432)
- `DB_NAME`: Database name (default: agentdb)
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password
- `DB_SSL`: Enable SSL (default: true)

#### ServiceNow Integration
- `SERVICENOW_INSTANCE_URL`: ServiceNow instance URL (e.g., https://dev211549.service-now.com)
- `SERVICENOW_USERNAME`: ServiceNow API username (e.g., api_user)
- `SERVICENOW_PASSWORD`: ServiceNow API password
- `SERVICENOW_ASSIGNMENT_GROUP`: ServiceNow assignment group (default: "SOC Team")

### ServiceNow Credentials

Credentials are stored in `sn_login.txt` in the project root:
```
login: api_user
password: eCCXIfOsJm+D1b_M@0J%qhD3UgHl-MVNyGct)mN[&chPBEGuO[xFsN4P[I_
url: https://dev211549.service-now.com
```

## Deployment

### Prerequisites

1. AWS Lambda execution role with permissions:
   - RDS network access (VPC/Security Group)
   - CloudWatch Logs write access

2. Database migration applied:
   ```bash
   cd database/scripts
   ./run-migrations.sh  # Applies 015_add_servicenow_fields.sql
   ```

3. ServiceNow account with API access and permissions to create incidents

### Deploy Lambda Function

```bash
cd lambda/escalation-plugin-servicenow

# Set environment variables (or use defaults)
export LAMBDA_ROLE_ARN="arn:aws:iam::ACCOUNT_ID:role/soc-lite-backend-role"
export SERVICENOW_PASSWORD="your-password"  # Optional, reads from sn_login.txt

# Deploy
chmod +x deploy.sh
./deploy.sh
```

### Setup EventBridge Trigger

After deployment, create EventBridge rule:

```bash
# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"

# Create rule (every 5 minutes)
aws events put-rule \
  --name soc-lite-servicenow-incident-processor \
  --schedule-expression "rate(5 minutes)" \
  --state ENABLED \
  --region $REGION

# Add Lambda as target
aws events put-targets \
  --rule soc-lite-servicenow-incident-processor \
  --targets "Id"="1","Arn"="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:escalation-plugin-servicenow" \
  --region $REGION

# Grant EventBridge permission
aws lambda add-permission \
  --function-name escalation-plugin-servicenow \
  --statement-id EventBridgeInvoke \
  --action 'lambda:InvokeFunction' \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:$REGION:$ACCOUNT_ID:rule/soc-lite-servicenow-incident-processor \
  --region $REGION
```

## Testing

### Manual Invocation

```bash
# Invoke Lambda manually
aws lambda invoke \
  --function-name escalation-plugin-servicenow \
  --region us-east-1 \
  --log-type Tail \
  --query 'LogResult' \
  --output text \
  response.json | base64 -d

# View response
cat response.json
```

### Check Logs

```bash
# Tail CloudWatch logs
aws logs tail /aws/lambda/escalation-plugin-servicenow --follow --region us-east-1
```

### Test with Sample Escalation

```sql
-- Create test escalation record
INSERT INTO escalation_events (
  title,
  message,
  detail_payload,
  severity,
  source_type
) VALUES (
  'Test Security Escalation',
  'This is a test escalation for ServiceNow integration',
  '{"test": true, "source_ip": "192.168.1.100"}',
  4,
  'waf_event'
);

-- Check status
SELECT id, title, completed_incident, servicenow_incident_number
FROM escalation_events
WHERE title = 'Test Security Escalation';
```

## Database Schema

New fields added to `escalation_events` table:

- `servicenow_incident_number` (VARCHAR 50): ServiceNow incident number (e.g., INC0001234)
- `servicenow_incident_created_at` (TIMESTAMP): Timestamp when incident was created
- `servicenow_incident_sys_id` (VARCHAR 50): ServiceNow sys_id (unique identifier)
- `servicenow_incident_error` (TEXT): Error message if creation failed

## Error Handling

- **Configuration Error**: Returns 200 with warning if ServiceNow credentials missing
- **API Errors**: Logs error in `servicenow_incident_error` field, escalation remains pending
- **Network Errors**: Caught and logged, allows retry on next execution
- **Timeout**: 300 seconds (5 minutes) Lambda timeout, 30 seconds ServiceNow API timeout

## Integration with Escalation Processor

This plugin works alongside the existing `escalation-processor` Lambda:

- **escalation-processor**: Sends SNS email notifications (`completed_sns`)
- **escalation-plugin-servicenow**: Creates ServiceNow incidents (`completed_incident`)

Both processors run independently and can complete in any order.

## Monitoring

### CloudWatch Metrics

- Lambda invocation count
- Lambda duration
- Lambda errors

### CloudWatch Logs

- Each execution logs:
  - Number of pending escalations found
  - ServiceNow API requests/responses
  - Success/failure for each escalation
  - Total processed, succeeded, failed counts

### Database Queries

```sql
-- Check pending incidents
SELECT COUNT(*) FROM escalation_events WHERE completed_incident = FALSE;

-- Check incident creation errors
SELECT id, title, servicenow_incident_error
FROM escalation_events
WHERE servicenow_incident_error IS NOT NULL;

-- View completed incidents
SELECT id, title, servicenow_incident_number, servicenow_incident_created_at
FROM escalation_events
WHERE completed_incident = TRUE
ORDER BY servicenow_incident_created_at DESC
LIMIT 10;
```

## Troubleshooting

### Issue: No incidents created

**Check**:
1. EventBridge rule is enabled and target is configured
2. Lambda has network access to RDS (VPC/Security Group)
3. ServiceNow credentials are correct
4. Pending escalations exist in database

### Issue: API authentication errors

**Solution**: Verify ServiceNow credentials:
```bash
# Test ServiceNow API manually
curl -X GET "https://dev211549.service-now.com/api/now/table/incident?sysparm_limit=1" \
  -H "Accept: application/json" \
  -u "api_user:YOUR_PASSWORD"
```

### Issue: Assignment group not found

**Solution**: Create assignment group in ServiceNow or update `SERVICENOW_ASSIGNMENT_GROUP` environment variable.

## API Documentation

ServiceNow Incident Table API:
- **Endpoint**: POST `/api/now/table/incident`
- **Authentication**: Basic Auth
- **Documentation**: https://docs.servicenow.com/bundle/tokyo-application-development/page/integrate/inbound-rest/concept/c_TableAPI.html

## Dependencies

- `axios` (^1.6.0): HTTP client for ServiceNow REST API
- `pg` (^8.11.3): PostgreSQL client for database access

## Security Considerations

- ServiceNow credentials stored as Lambda environment variables (encrypted at rest)
- Database password encrypted in Lambda environment
- SSL/TLS used for RDS connection
- HTTPS used for ServiceNow API calls
- IAM role follows principle of least privilege

## Future Enhancements

- Support for updating existing incidents
- Bi-directional sync (ServiceNow → SOC-Lite)
- Custom field mapping configuration
- Incident closure automation
- Multi-instance support (prod/dev ServiceNow)
