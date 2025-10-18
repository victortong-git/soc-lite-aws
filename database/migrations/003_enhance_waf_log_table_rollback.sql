-- Rollback migration for 003_enhance_waf_log_table.sql
-- This script removes all enhancements added in migration 003
-- USE WITH CAUTION: This will drop columns and data will be lost

-- Drop indexes
DROP INDEX IF EXISTS idx_waf_log_severity_rating;
DROP INDEX IF EXISTS idx_waf_log_action;
DROP INDEX IF EXISTS idx_waf_log_source_ip;
DROP INDEX IF EXISTS idx_waf_log_country;
DROP INDEX IF EXISTS idx_waf_log_country_code;
DROP INDEX IF EXISTS idx_waf_log_status;
DROP INDEX IF EXISTS idx_waf_log_processed;
DROP INDEX IF EXISTS idx_waf_log_created_at_desc;
DROP INDEX IF EXISTS idx_waf_log_ai_confidence;
DROP INDEX IF EXISTS idx_waf_log_is_known_threat;
DROP INDEX IF EXISTS idx_waf_log_action_severity;
DROP INDEX IF EXISTS idx_waf_log_status_created_at;
DROP INDEX IF EXISTS idx_waf_log_source_country;
DROP INDEX IF EXISTS idx_waf_log_ai_analysis_gin;
DROP INDEX IF EXISTS idx_waf_log_headers_gin;
DROP INDEX IF EXISTS idx_waf_log_event_detail_gin;

-- Drop trigger and function
DROP TRIGGER IF EXISTS trigger_update_waf_log_updated_at ON waf_log;
DROP FUNCTION IF EXISTS update_waf_log_updated_at();

-- Drop columns (WARNING: This will delete data in these columns)
ALTER TABLE waf_log DROP COLUMN IF EXISTS ai_analysis;
ALTER TABLE waf_log DROP COLUMN IF EXISTS ai_confidence;
ALTER TABLE waf_log DROP COLUMN IF EXISTS ai_analysis_timestamp;
ALTER TABLE waf_log DROP COLUMN IF EXISTS country_code;
ALTER TABLE waf_log DROP COLUMN IF EXISTS geo_location;
ALTER TABLE waf_log DROP COLUMN IF EXISTS threat_score;
ALTER TABLE waf_log DROP COLUMN IF EXISTS reputation_score;
ALTER TABLE waf_log DROP COLUMN IF EXISTS is_known_threat;
ALTER TABLE waf_log DROP COLUMN IF EXISTS incident_id;
ALTER TABLE waf_log DROP COLUMN IF EXISTS is_test_data;
