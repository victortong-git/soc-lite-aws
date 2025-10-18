-- Rollback Migration: 004_add_analysis_job_link_rollback.sql
-- Removes analysis_job_id from waf_log table

-- Drop index
DROP INDEX IF EXISTS idx_waf_log_analysis_job_id;

-- Drop foreign key constraint
ALTER TABLE waf_log DROP CONSTRAINT IF EXISTS fk_waf_log_analysis_job;

-- Drop column
ALTER TABLE waf_log DROP COLUMN IF EXISTS analysis_job_id;
