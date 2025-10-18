# RDS Database Management Scripts

This directory contains scripts for managing the AWS RDS PostgreSQL instance and viewing WAF logs.

## Available Scripts

### Database Management

#### `status_db.sh` - Check Database Status
Shows the current status and details of the RDS instance.

```bash
./status_db.sh
```

**Output includes:**
- Current status (running/stopped/starting/stopping)
- Instance details (engine, class, storage)
- Connection information
- Available actions based on current state

#### `start_db.sh` - Start Database
Starts the stopped RDS instance and waits for it to become available.

```bash
./start_db.sh
```

**Features:**
- Checks current status before starting
- Waits up to 15 minutes for instance to become available
- Displays connection information when ready
- Shows real-time status updates

**Typical startup time:** 3-5 minutes

#### `stop_db.sh` - Stop Database
Stops the running RDS instance to save costs.

```bash
./stop_db.sh
```

**Features:**
- Checks current status before stopping
- Waits up to 6 minutes for instance to stop completely
- Shows real-time status updates
- Warns about automatic restart after 7 days

**Typical stop time:** 2-3 minutes

**Note:** AWS will automatically start a stopped RDS instance after 7 days.

### Database Operations

#### `test-db.sh` - Test Database Connection
Comprehensive database connection test with statistics.

```bash
./test-db.sh
```

**Shows:**
- Connection status
- Database overview (size, version)
- Table statistics with row counts
- Installed extensions (including pgvector)
- Connection details

#### `list-waf-events.sh` - View WAF Logs
Lists the latest WAF log events stored in the database.

```bash
./list-waf-events.sh
```

**Output:**
- Latest 10 WAF log events
- Event ID, details, and creation time
- Ordered by ID descending (newest first)

### Database Schema

#### `update_waf_log_schema.sql` - Initial Schema
Creates the `waf_log` table with all required fields and indexes.

```bash
export PGPASSWORD="<YOUR_DB_PASSWORD>"
export PGSSLMODE=require
psql -h <YOUR_RDS_ENDPOINT> \
     -U <YOUR_DB_USER> -d <YOUR_DB_NAME> -f update_waf_log_schema.sql
unset PGPASSWORD
unset PGSSLMODE
```

#### `migrate_waf_log_table.sql` - Migration Script
Drops existing table and recreates with new schema (includes backup).

```bash
export PGPASSWORD="<YOUR_DB_PASSWORD>"
export PGSSLMODE=require
psql -h <YOUR_RDS_ENDPOINT> \
     -U <YOUR_DB_USER> -d <YOUR_DB_NAME> -f migrate_waf_log_table.sql
unset PGPASSWORD
unset PGSSLMODE
```

## Database Connection Details

**Instance:** `agentic-soc-agent`
**Region:** `us-east-1`
**Endpoint:** `<YOUR_RDS_ENDPOINT>`
**Port:** `5432`
**Database:** `<YOUR_DB_NAME>`
**User:** `<YOUR_DB_USER>`
**Password:** `<YOUR_DB_PASSWORD>`

### Manual Connection

```bash
export PGPASSWORD="<YOUR_DB_PASSWORD>"
export PGSSLMODE=require
psql -h <YOUR_RDS_ENDPOINT> \
     -p 5432 -U <YOUR_DB_USER> -d <YOUR_DB_NAME>
```

**Important:** SSL mode is required for connections.

## Typical Workflow

### Daily Usage

```bash
# Check status
./status_db.sh

# Start database if stopped
./start_db.sh

# Test connection
./test-db.sh

# View WAF events
./list-waf-events.sh

# Stop database when done (to save costs)
./stop_db.sh
```

### Troubleshooting

```bash
# Check current status
./status_db.sh

# Test database connectivity
./test-db.sh

# Check CloudWatch Logs for Lambda
cd ../lambda
aws logs tail /aws/lambda/get-waf-alert --follow
```

## Cost Optimization

**To minimize costs:**
1. Stop the RDS instance when not in use: `./stop_db.sh`
2. Remember: AWS automatically starts stopped instances after 7 days
3. Monitor with: `./status_db.sh`

## Security Notes

1. **Security Group:** Currently allows connections from 0.0.0.0/0 (all IPs)
   - For production, restrict to specific IPs or security groups

2. **SSL/TLS:** Required for all connections
   - Use `PGSSLMODE=require` when connecting

3. **Credentials:** Stored in scripts for demo purposes
   - For production, use AWS Secrets Manager or Parameter Store

## Files in this Directory

```
rds/
├── README.md                      # This file
├── status_db.sh                   # Check RDS status ⭐
├── start_db.sh                    # Start RDS instance ⭐
├── stop_db.sh                     # Stop RDS instance ⭐
├── test-db.sh                     # Test database connection
├── list-waf-events.sh             # View WAF logs
├── update_waf_log_schema.sql      # Initial schema creation
└── migrate_waf_log_table.sql      # Schema migration
```

⭐ = New scripts added for database lifecycle management

## Related Components

### Lambda Function
The `get-waf-alert` Lambda function (in `../lambda/`) automatically:
- Fetches WAF alerts
- Stores them in the `waf_log` table
- Prevents duplicate entries
- Can be triggered manually or on a schedule

### WAF Log Table Schema
```sql
CREATE TABLE waf_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    action VARCHAR(20) NOT NULL,
    rule_id VARCHAR(255),
    rule_name VARCHAR(255),
    source_ip VARCHAR(45) NOT NULL,
    uri TEXT,
    http_method VARCHAR(10),
    http_request TEXT,
    country VARCHAR(10),
    user_agent TEXT,
    headers JSONB,
    rate_based_rule_list JSONB,
    non_terminating_matching_rules JSONB,
    event_detail JSONB,
    web_acl_id VARCHAR(255),
    web_acl_name VARCHAR(255),
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Support

For issues or questions:
1. Check RDS status: `./status_db.sh`
2. Review CloudWatch Logs for the instance
3. Check Lambda logs: `aws logs tail /aws/lambda/get-waf-alert --follow`
4. Verify security group rules allow your IP
