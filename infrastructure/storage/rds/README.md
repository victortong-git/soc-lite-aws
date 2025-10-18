# RDS Database Management

Quick access scripts for RDS PostgreSQL database management.

## Scripts

These scripts are symlinks to the comprehensive RDS management tools in `../../../database/rds/scripts/`:

- **start-db.sh** - Start RDS PostgreSQL instance
- **stop-db.sh** - Stop RDS instance (saves costs when not in use)
- **status-db.sh** - Check RDS instance status and connection

## Quick Usage

```bash
# Start database
./start-db.sh

# Check status
./status-db.sh

# Stop database (to save costs)
./stop-db.sh
```

## Full RDS Management

For comprehensive RDS management including:
- Database backup and restore
- Connection testing
- Event querying
- Smart analysis cleanup
- Job verification

See the full documentation: [Database Documentation](../../../database/README.md)

## Available RDS Scripts

Located in `../../../database/rds/scripts/`:

**Lifecycle Management:**
- `start_db.sh` - Start RDS instance
- `stop_db.sh` - Stop RDS instance
- `status_db.sh` - Check instance status

**Backup & Restore:**
- `db_backup.sh` - Create database backup
- `db_restore.sh` - Restore from backup

**Testing & Monitoring:**
- `test-db.sh` - Test database connection
- `list-waf-events.sh` - Query WAF events
- `cleanup-smart-analysis.sh` - Clean up analysis data

**Verification:**
- `verify-job-10.sh` - Verify specific job
- `verify-job-19.sh` - Verify specific job

## Cost Optimization

RDS instances incur charges even when idle. Use these scripts to:

**Save Costs:**
```bash
./stop-db.sh    # Stop when not needed (evenings, weekends)
```

**Resume Work:**
```bash
./start-db.sh   # Start when needed
./status-db.sh  # Wait until available
```

**Note:** Stopped instances are automatically started after 7 days by AWS.

## Connection Information

Default connection details (from `.env`):
- Host: `agentic-soc-agent.cs32ggwceco2.us-east-1.rds.amazonaws.com`
- Port: `5432`
- Database: `agentdb`
- User: `agenticsoc`

## Monitoring

View RDS metrics in CloudWatch:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=agentic-soc-agent \
  --start-time 2025-10-13T00:00:00Z \
  --end-time 2025-10-13T23:59:59Z \
  --period 3600 \
  --statistics Average
```

## Related Documentation

- [Full Database Documentation](../../../database/README.md)
- [Database Migrations](../../../database/migrations/README.md)
- [Storage Services Overview](../README.md)
