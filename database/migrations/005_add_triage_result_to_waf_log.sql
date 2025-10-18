-- Migration: Add triage_result column to waf_log table
-- This column stores the triage analysis results from the analysis worker

ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS triage_result JSONB;

-- Create index for querying triage results
CREATE INDEX IF NOT EXISTS idx_waf_log_triage_result ON waf_log USING GIN (triage_result);

-- Add comment
COMMENT ON COLUMN waf_log.triage_result IS 'Triage analysis results from AI analysis worker';
