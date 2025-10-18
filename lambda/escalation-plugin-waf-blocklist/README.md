# WAF Blocklist Escalation Plugin Lambda

Lambda function that automatically adds malicious IPs to AWS WAF blocklist IPSet based on high-severity escalations (severity 4-5).

## Overview

This plugin processes escalation events and adds attacker IPs to an AWS WAF IPSet for automatic blocking. It integrates with the existing escalation system, similar to the ServiceNow plugin.

## Architecture

- **Trigger**: EventBridge (every 5 minutes)
- **Runtime**: Node.js 20.x
- **Database**: PostgreSQL RDS (`escalation_events`, `blocklist_ip`, `waf_log` tables)
- **AWS Service**: WAF v2 (IPSet management)

## How It Works

1. Lambda triggered every 5 minutes by EventBridge
2. Queries `escalation_events` for severity 4-5 with `completed_waf_blocklist = FALSE`
3. Extracts source IP from escalation `detail_payload` or source WAF event
4. Checks if IP exists in `blocklist_ip` table:
   - **Exists**: Updates `last_seen_at` and increments `block_count`
   - **New**: Creates record with `created_at` timestamp
5. Adds IP to WAF IPSet `soc-lite-blocklist-ips` (with /32 CIDR)
6. Marks escalation as `completed_waf_blocklist = TRUE`
7. Records `waf_blocklist_added_at` and `waf_blocklist_ip` in escalation

## Dependencies

- `@aws-sdk/client-wafv2` (^3.490.0) - WAF IPSet management
- `pg` (^8.11.3) - PostgreSQL database access

## Environment Variables

### Database
- `DB_HOST` - PostgreSQL RDS hostname
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_SSL` - Enable SSL (default: true)

### WAF Configuration
- `AWS_REGION` - AWS region (us-east-1 for CloudFront WAF)
- `WAF_BLOCKLIST_IP_SET_NAME` - IPSet name (soc-lite-blocklist-ips)
- `WAF_BLOCKLIST_IP_SET_ID` - IPSet ID (from create-waf-blocklist-ipset.sh)

## Deployment

### Prerequisites

1. Run database migrations:
```bash
cd database/scripts
./run-migrations.sh  # Applies migrations 016 and 017
```

2. Create WAF IPSet:
```bash
cd infrastructure/security/waf
./create-waf-blocklist-ipset.sh
```

3. Ensure Lambda execution role has permissions:
   - WAFv2: `GetIPSet`, `UpdateIPSet`
   - RDS: Network access via VPC/Security Group
   - CloudWatch Logs: `CreateLogGroup`, `CreateLogStream`, `PutLogEvents`

### Deploy

```bash
cd lambda/escalation-plugin-waf-blocklist
./deploy.sh
```

The deploy script:
- Installs dependencies
- Creates deployment package
- Creates/updates Lambda function
- Configures EventBridge trigger (rate: 5 minutes)
- Sets up permissions

## Testing

### Manual Invocation
```bash
aws lambda invoke \
  --function-name escalation-plugin-waf-blocklist \
  --region us-east-1 \
  --log-type Tail \
  --query 'LogResult' \
  --output text response.json | base64 -d

cat response.json
```

### View Logs
```bash
aws logs tail /aws/lambda/escalation-plugin-waf-blocklist --follow --region us-east-1
```

### Create Test Escalation
```sql
INSERT INTO escalation_events (
  title, message, detail_payload, severity, source_type, source_waf_event_id
) VALUES (
  'Test WAF Blocklist',
  'Testing automatic IP blocking',
  '{"source_ip": "192.168.1.100"}',
  4,
  'waf_event',
  NULL
);
```

Wait 5 minutes, then check:
```sql
SELECT * FROM escalation_events WHERE title = 'Test WAF Blocklist';
SELECT * FROM blocklist_ip WHERE ip_address = '192.168.1.100';
```

## IP Extraction Logic

The Lambda tries multiple fields to extract source IP:
1. `detail_payload.source_ip`
2. `detail_payload.sourceIp`
3. `detail_payload.clientIp`
4. `detail_payload.ip_address`
5. `detail_payload.event.source_ip`
6. `detail_payload.waf_event.source_ip`
7. Query `waf_log` table if `source_waf_event_id` exists

## Database Schema

### `blocklist_ip` table
- `id` - Primary key
- `ip_address` - IP address (unique)
- `reason` - Why blocked (from escalation message)
- `severity` - Original escalation severity (4 or 5)
- `source_escalation_id` - FK to escalation_events
- `source_waf_event_id` - FK to waf_log
- `created_at` - First time blocked
- `last_seen_at` - Last time IP triggered blocking
- `block_count` - Number of times IP triggered blocking
- `is_active` - Currently in WAF IPSet
- `removed_at` - When removed from WAF

### `escalation_events` new columns
- `completed_waf_blocklist` - Boolean flag
- `waf_blocklist_added_at` - Timestamp when added
- `waf_blocklist_ip` - IP that was added
- `waf_blocklist_error` - Error message if failed

## Error Handling

- **No IP found**: Marks escalation complete with error message
- **IP already in WAF**: Logs info, continues successfully
- **WAF API error**: Logs error in `waf_blocklist_error`, escalation remains pending for retry
- **Database error**: Logs error, allows retry on next invocation

## Integration with Escalation System

Parallel processing with other escalation plugins:
- **escalation-processor**: Sends SNS notifications (`completed_sns`)
- **escalation-plugin-servicenow**: Creates ServiceNow incidents (`completed_incident`)
- **escalation-plugin-waf-blocklist**: Adds to WAF blocklist (`completed_waf_blocklist`)

All processors run independently every 5 minutes.

## Monitoring

### CloudWatch Metrics
- Lambda invocations
- Lambda duration
- Lambda errors

### CloudWatch Logs
Each execution logs:
- Pending escalations found
- IP extraction attempts
- WAF API operations
- Success/failure per escalation
- Summary: processed, succeeded, failed

### Database Queries
```sql
-- Pending WAF blocklist additions
SELECT COUNT(*) FROM escalation_events
WHERE completed_waf_blocklist = FALSE AND severity >= 4;

-- Recent blocks
SELECT * FROM blocklist_ip
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Repeat offenders
SELECT ip_address, block_count, last_seen_at
FROM blocklist_ip
WHERE is_active = TRUE
ORDER BY block_count DESC LIMIT 10;

-- Failed blocklist additions
SELECT id, title, waf_blocklist_error
FROM escalation_events
WHERE waf_blocklist_error IS NOT NULL;
```

## Troubleshooting

### Issue: No IPs added to blocklist
**Check**:
1. EventBridge rule enabled
2. Lambda has WAF permissions
3. WAF IPSet ID is correct
4. Escalations have severity 4-5
5. IP extractable from escalation payload

### Issue: IP already in IPSet errors
**Solution**: Normal behavior - Lambda logs info and continues

### Issue: Lock token errors
**Solution**: WAF uses optimistic locking - Lambda automatically retries with new lock token

## Related Scripts

- `infrastructure/security/waf/create-waf-blocklist-ipset.sh` - Creates WAF IPSet
- `infrastructure/security/waf/manage-whitelist.sh` - Manual IP management
- `database/migrations/016_create_blocklist_ip.sql` - Database table
- `database/migrations/017_add_waf_blocklist_to_escalations.sql` - Escalation columns

## API Endpoints

Frontend/backend can manage blocklist via API:
- `GET /api/blocklist` - List blocked IPs
- `GET /api/blocklist/stats` - Statistics
- `POST /api/blocklist` - Manually add IP
- `DELETE /api/blocklist/:id` - Remove IP
- `POST /api/blocklist/sync` - Sync DB ↔ WAF
