# RDS Schema Directory

## ⚠️ Important Notice

This directory previously contained outdated schema files that have been removed as of October 18, 2025.

## Current Schema Management

The **authoritative source** for database schema is:

📁 **`database/migrations/`** - Sequential migration files (001-018)

## How to Manage Schema

### Apply Migrations
```bash
cd database/scripts
./run-migrations.sh
```

### Verify Schema
```bash
cd database/scripts
./verify-schema.sh
```

### Create New Migrations
Add new numbered migration files to `database/migrations/`:
- Follow sequential numbering (e.g., `019_description.sql`)
- Include rollback file if needed (e.g., `019_description_rollback.sql`)
- Update `database/migrations/README.md`

## Removed Files (October 2025)

The following outdated files were removed:
- `004_add_analysis_job_link.sql` - Duplicate of migration 004
- `migrate_soc_agent_columns.sql` - Superseded by migration 003
- `migrate_waf_log_add_columns.sql` - Superseded by migration 003
- `migrate_waf_log_table.sql` - Dangerous destructive script, superseded by migrations
- `update_waf_log_schema.sql` - Outdated base schema, superseded by migrations

See `database/SCHEMA_AUDIT.md` for detailed analysis.

## This Directory's Purpose

This directory can be used for:
- RDS-specific configuration files
- Schema documentation
- Database utility scripts

But **NOT** for schema migrations - use `database/migrations/` instead.
