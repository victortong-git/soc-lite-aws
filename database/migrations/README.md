# Database Migrations

This directory contains SQL migration scripts for the SOC-Lite database schema.

## Migrations

### 001_create_user_accts.sql
Creates the `user_accts` table for authentication.
- User credentials storage
- Default admin user creation
- Indexes for performance

### 002_update_admin_password.sql
Updates the admin password hash.

### 003_enhance_waf_log_table.sql ✨ **NEW**
Enhances the `waf_log` table with professional features:
- **AI Analysis fields**: `ai_analysis` (JSONB), `ai_confidence`, `ai_analysis_timestamp`
- **Geo-location fields**: `country_code`, `geo_location` (JSONB)
- **Enrichment fields**: `threat_score`, `reputation_score`, `is_known_threat`
- **Linking fields**: `incident_id`, `is_test_data`
- **Performance indexes**: 16 indexes for optimized queries
- **Composite indexes**: For common query patterns
- **GIN indexes**: For JSONB column searches

## How to Apply Migrations

### Method 1: Using psql (Recommended)

```bash
# Connect to your database
export PGPASSWORD="your_password"
psql -h your_host -U your_user -d soc_lite -f migrations/003_enhance_waf_log_table.sql
```

### Method 2: Using Database Client

1. Open your preferred PostgreSQL client (pgAdmin, DBeaver, etc.)
2. Connect to the `soc_lite` database
3. Open and execute `003_enhance_waf_log_table.sql`

### Method 3: Using Docker (if running in container)

```bash
# Copy migration file to container
docker cp migrations/003_enhance_waf_log_table.sql soc-lite-db:/tmp/

# Execute migration
docker exec -it soc-lite-db psql -U postgres -d soc_lite -f /tmp/003_enhance_waf_log_table.sql
```

### Method 4: Direct SQL Execution

```bash
# Using environment variables from your .env file
cd /aws/soc-lite/backend
source .env
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f db/migrations/003_enhance_waf_log_table.sql
```

## Rollback

If you need to rollback migration 003:

```bash
psql -h your_host -U your_user -d soc_lite -f migrations/003_enhance_waf_log_table_rollback.sql
```

**⚠️ WARNING**: Rollback will **delete data** in the new columns. Make sure to backup your database first!

## Backup Before Migration

Always backup your database before applying migrations:

```bash
# Backup entire database
pg_dump -h your_host -U your_user -d soc_lite > backup_$(date +%Y%m%d_%H%M%S).sql

# Or backup just the waf_log table
pg_dump -h your_host -U your_user -d soc_lite -t waf_log > waf_log_backup_$(date +%Y%m%d_%H%M%S).sql
```

## Verify Migration Success

After applying migration 003, verify the changes:

```sql
-- Check if new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'waf_log'
  AND column_name IN ('ai_analysis', 'ai_confidence', 'country_code', 'threat_score');

-- Check if indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'waf_log'
  AND indexname LIKE 'idx_waf_log_%';

-- Count total indexes
SELECT COUNT(*) as total_indexes
FROM pg_indexes
WHERE tablename = 'waf_log';
```

Expected result: Should show 4 new columns and multiple new indexes.

## Migration Features Impact

### Performance Improvements
- **16 new indexes** significantly improve query performance
- Composite indexes optimize dashboard statistics queries
- GIN indexes enable fast JSONB field searches
- Filtered indexes reduce index size for specific conditions

### New Capabilities Enabled
- ✅ AI analysis storage and tracking
- ✅ Geo-location enrichment
- ✅ Threat intelligence integration
- ✅ Incident correlation
- ✅ Test data filtering
- ✅ Advanced filtering in UI
- ✅ Dashboard trend calculations

### Dashboard Features Now Supported
- Event trends by severity
- Top attacking IPs with country data
- AI analysis rate statistics
- Threat score visualization
- Incident linking

### Events Page Features Now Supported
- AI confidence display
- Country flags and geo-location
- Inline threat scores
- Advanced filtering by all new fields
- Test data exclusion

## Database Schema After Migration

```sql
waf_log table columns:
├── Original columns (id, timestamp, action, source_ip, uri, etc.)
├── AI Analysis
│   ├── ai_analysis (JSONB)
│   ├── ai_confidence (INTEGER 0-100)
│   └── ai_analysis_timestamp (TIMESTAMP)
├── Geo-location
│   ├── country_code (VARCHAR 2)
│   └── geo_location (JSONB)
├── Enrichment
│   ├── threat_score (INTEGER 0-100)
│   ├── reputation_score (INTEGER 0-100)
│   └── is_known_threat (BOOLEAN)
└── Metadata
    ├── incident_id (INTEGER)
    └── is_test_data (BOOLEAN)
```

## Troubleshooting

### Error: "column already exists"
This is safe - the migration uses `IF NOT EXISTS`. The column was likely added in a previous run.

### Error: "relation does not exist"
Make sure the `waf_log` table exists. Check if the initial schema has been created.

### Performance concerns after migration
The indexes will improve query performance but take some time to build. Monitor:
```sql
-- Check index build progress
SELECT now()::TIME, indexrelid::regclass AS index_name, phase, blocks_done, blocks_total
FROM pg_stat_progress_create_index;
```

## Testing After Migration

1. **Test API endpoints**:
   ```bash
   # Test stats endpoint
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/events/stats

   # Test trends endpoint
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/events/trends?hours=24

   # Test top sources
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/events/top-sources?limit=10
   ```

2. **Test AI analysis**:
   ```bash
   # Trigger AI analysis on an event
   curl -X POST -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/events/1/analyze
   ```

3. **Verify data integrity**:
   ```sql
   -- Check if existing data is intact
   SELECT COUNT(*) as total_events FROM waf_log;

   -- Verify new columns are NULL for existing data
   SELECT COUNT(*) as events_without_ai
   FROM waf_log
   WHERE ai_analysis IS NULL;
   ```

## Maintenance

### Reindex for Performance
If query performance degrades over time:
```sql
-- Reindex all waf_log indexes
REINDEX TABLE waf_log;
```

### Vacuum for Space Reclamation
```sql
-- Analyze and vacuum the table
VACUUM ANALYZE waf_log;
```

## Next Steps

After applying this migration:
1. ✅ Restart backend server to pick up new schema
2. ✅ Test the professional dashboard UI
3. ✅ Test the professional events page
4. ✅ Trigger AI analysis on sample events
5. ✅ Verify all statistics are calculating correctly
6. Consider adding geo-location enrichment service
7. Consider integrating threat intelligence APIs
8. Monitor query performance and optimize as needed

## Support

For issues or questions about migrations:
- Check PostgreSQL logs: `/var/log/postgresql/`
- Review application logs for database errors
- Verify database connection settings in `.env`
- Ensure database user has sufficient privileges
