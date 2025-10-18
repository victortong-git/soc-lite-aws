# Database Schema Audit Report

**Date**: October 18, 2025  
**Auditor**: Kiro AI Assistant

## Summary

The `database/rds/schema/` directory contains **OUTDATED** schema files that are superseded by the migration files in `database/migrations/`. These schema files appear to be from an earlier development phase and should be archived or removed.

## Findings

### ✅ Current Source of Truth: `database/migrations/`
The migrations directory (001-018) represents the **current, authoritative schema** with 18 sequential migrations that build the complete database schema incrementally.

### ⚠️ Outdated Files: `database/rds/schema/`
The following files in `rds/schema/` are outdated and redundant:

| Schema File | Status | Covered By Migration | Notes |
|------------|--------|---------------------|-------|
| `004_add_analysis_job_link.sql` | **DUPLICATE** | `migrations/004_add_analysis_job_link.sql` | Exact duplicate - same content |
| `migrate_soc_agent_columns.sql` | **OUTDATED** | `migrations/003_enhance_waf_log_table.sql` | Old approach to adding AI analysis columns |
| `migrate_waf_log_add_columns.sql` | **OUTDATED** | `migrations/003_enhance_waf_log_table.sql` | Old approach to adding request_id and raw_message |
| `migrate_waf_log_table.sql` | **OUTDATED** | Initial table creation + multiple migrations | Destructive migration (drops table) - dangerous |
| `update_waf_log_schema.sql` | **OUTDATED** | Initial table creation + multiple migrations | Old table creation script |

## Detailed Analysis

### 1. `004_add_analysis_job_link.sql` (DUPLICATE)
- **Status**: Exact duplicate of migration 004
- **Action**: Can be safely deleted
- **Reason**: Same content exists in migrations directory

### 2. `migrate_soc_agent_columns.sql` (OUTDATED)
- **Old approach**: Adds columns like `severity_rating`, `security_analysis`, `follow_up_suggestion`, `status`, `analyzed_at`, `analyzed_by`
- **Superseded by**: Migration 003 which adds more comprehensive fields including `ai_analysis` (JSONB), `ai_confidence`, `threat_score`, etc.
- **Issue**: Uses different column names and structure than current schema
- **Action**: Should be archived or deleted

### 3. `migrate_waf_log_add_columns.sql` (OUTDATED)
- **Old approach**: Adds `request_id` and `raw_message` columns
- **Superseded by**: These columns are now part of the base table creation
- **Issue**: Migration 003 and later migrations assume these columns exist
- **Action**: Should be archived or deleted

### 4. `migrate_waf_log_table.sql` (DANGEROUS - OUTDATED)
- **Old approach**: Drops and recreates entire `waf_log` table
- **Superseded by**: Initial table creation + incremental migrations
- **Issue**: 
  - Destructive operation (drops table)
  - Missing many columns added in later migrations (003-018)
  - Would destroy all data if run
- **Action**: Should be archived with clear warning or deleted

### 5. `update_waf_log_schema.sql` (OUTDATED)
- **Old approach**: Creates `waf_log` table with basic structure
- **Superseded by**: Initial table creation + migrations 003-018
- **Issue**: Missing 18 migrations worth of schema enhancements
- **Action**: Should be archived or deleted

## Current Schema Evolution (Migrations)

The proper schema evolution path is:

```
001 → Create user_accts table
002 → Update admin password
003 → Enhance waf_log (AI analysis, geo-location, enrichment fields)
004 → Add analysis_job_id to waf_log
005 → Add triage_result to waf_log
006 → Create event_timeline table
007 → Add host column
008 → Create smart_analysis_tasks table
009 → Create smart_analysis_event_links table
010 → Create smart_analysis_jobs table
011 → Add smart_analysis_task_id to waf_log
012 → Add time_group to smart_tasks
013 → Create escalation_events table
014 → Add attack_campaign_source_type
015 → Add servicenow_fields
016 → Create blocklist_ip table
017 → Add waf_blocklist to escalations
018 → Add ai_fields to smart_tasks
```

## Recommendations

### Option 1: Archive (Recommended)
Create an archive directory and move old schema files:
```bash
mkdir -p database/rds/schema/archive
mv database/rds/schema/*.sql database/rds/schema/archive/
echo "These files are outdated and superseded by database/migrations/" > database/rds/schema/archive/README.md
```

### Option 2: Delete
Simply remove the outdated files:
```bash
rm database/rds/schema/004_add_analysis_job_link.sql
rm database/rds/schema/migrate_soc_agent_columns.sql
rm database/rds/schema/migrate_waf_log_add_columns.sql
rm database/rds/schema/migrate_waf_log_table.sql
rm database/rds/schema/update_waf_log_schema.sql
```

### Option 3: Keep with Clear Documentation
Add a README.md in `database/rds/schema/` explaining these are outdated:
```markdown
# ⚠️ OUTDATED SCHEMA FILES

These files are from an earlier development phase and are **NOT** the current schema.

**DO NOT USE THESE FILES**

For the current, authoritative database schema, use:
- `database/migrations/` - Sequential migration files (001-018)
- `database/scripts/run-migrations.sh` - Script to apply all migrations

These files are kept for historical reference only.
```

## Risk Assessment

### High Risk
- **`migrate_waf_log_table.sql`**: Contains `DROP TABLE` - would destroy all data if accidentally run

### Medium Risk
- Other schema files could cause confusion and lead to applying outdated schema changes

### Low Risk
- Files are in a separate directory and not referenced by deployment scripts

## Conclusion

The `database/rds/schema/` directory should be cleaned up to prevent confusion and potential data loss. The migration-based approach in `database/migrations/` is the correct and current schema management strategy.

**Recommended Action**: Archive or delete the outdated schema files and add clear documentation.
