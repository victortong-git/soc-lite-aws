-- Enhancement migration for waf_log table
-- Adds AI analysis fields, enrichment data, and performance indexes
-- Migration: 003_enhance_waf_log_table.sql

-- Add AI Analysis columns
ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS ai_analysis JSONB;
ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS ai_confidence INTEGER CHECK (ai_confidence >= 0 AND ai_confidence <= 100);
ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS ai_analysis_timestamp TIMESTAMP WITH TIME ZONE;

-- Add Geo-location columns
ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);
ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS geo_location JSONB;

-- Add Enrichment columns
ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS threat_score INTEGER CHECK (threat_score >= 0 AND threat_score <= 100);
ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS reputation_score INTEGER CHECK (reputation_score >= 0 AND reputation_score <= 100);
ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS is_known_threat BOOLEAN DEFAULT FALSE;

-- Add incident linking
ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS incident_id INTEGER;

-- Add test data flag
ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN DEFAULT FALSE;

-- Create indexes for performance on commonly filtered columns
CREATE INDEX IF NOT EXISTS idx_waf_log_severity_rating ON waf_log(severity_rating);
CREATE INDEX IF NOT EXISTS idx_waf_log_action ON waf_log(action);
CREATE INDEX IF NOT EXISTS idx_waf_log_source_ip ON waf_log(source_ip);
CREATE INDEX IF NOT EXISTS idx_waf_log_country ON waf_log(country);
CREATE INDEX IF NOT EXISTS idx_waf_log_country_code ON waf_log(country_code);
CREATE INDEX IF NOT EXISTS idx_waf_log_status ON waf_log(status);
CREATE INDEX IF NOT EXISTS idx_waf_log_processed ON waf_log(processed);
CREATE INDEX IF NOT EXISTS idx_waf_log_created_at_desc ON waf_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waf_log_ai_confidence ON waf_log(ai_confidence) WHERE ai_confidence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_waf_log_is_known_threat ON waf_log(is_known_threat) WHERE is_known_threat = TRUE;

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_waf_log_action_severity ON waf_log(action, severity_rating);
CREATE INDEX IF NOT EXISTS idx_waf_log_status_created_at ON waf_log(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waf_log_source_country ON waf_log(source_ip, country);

-- Add GIN index for JSONB columns for better query performance
CREATE INDEX IF NOT EXISTS idx_waf_log_ai_analysis_gin ON waf_log USING GIN (ai_analysis);
CREATE INDEX IF NOT EXISTS idx_waf_log_headers_gin ON waf_log USING GIN (headers);
CREATE INDEX IF NOT EXISTS idx_waf_log_event_detail_gin ON waf_log USING GIN (event_detail);

-- Update existing function to handle new columns in updated_at trigger
-- (if waf_log doesn't have an updated_at trigger, this will create it)
CREATE OR REPLACE FUNCTION update_waf_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_waf_log_updated_at ON waf_log;
CREATE TRIGGER trigger_update_waf_log_updated_at
    BEFORE UPDATE ON waf_log
    FOR EACH ROW
    EXECUTE FUNCTION update_waf_log_updated_at();

-- Add comment to document the enhancement
COMMENT ON COLUMN waf_log.ai_analysis IS 'JSONB field containing AI analysis results including decision, risk level, recommendations';
COMMENT ON COLUMN waf_log.ai_confidence IS 'AI confidence score (0-100) for the analysis';
COMMENT ON COLUMN waf_log.ai_analysis_timestamp IS 'Timestamp when AI analysis was performed';
COMMENT ON COLUMN waf_log.country_code IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN waf_log.geo_location IS 'JSONB field containing detailed geo-location data (city, region, coordinates)';
COMMENT ON COLUMN waf_log.threat_score IS 'Threat assessment score (0-100) based on various indicators';
COMMENT ON COLUMN waf_log.reputation_score IS 'IP reputation score (0-100) from threat intelligence';
COMMENT ON COLUMN waf_log.is_known_threat IS 'Flag indicating if the source IP is a known threat';
COMMENT ON COLUMN waf_log.incident_id IS 'Foreign key linking to incidents table (if exists)';
COMMENT ON COLUMN waf_log.is_test_data IS 'Flag to mark test/demo data for easy filtering';
