-- Migration: 004_add_analysis_job_link.sql
-- Adds analysis_job_id to waf_log table to link events to their analysis jobs
-- This enables the frontend to show "Queued" status for events awaiting AI analysis

-- Add analysis_job_id column to waf_log table
ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS analysis_job_id INTEGER;

-- Add foreign key constraint to analysis_jobs table
ALTER TABLE waf_log
ADD CONSTRAINT fk_waf_log_analysis_job
FOREIGN KEY (analysis_job_id)
REFERENCES analysis_jobs(id)
ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_waf_log_analysis_job_id ON waf_log(analysis_job_id);

-- Add comment to document the field
COMMENT ON COLUMN waf_log.analysis_job_id IS 'Foreign key linking to analysis_jobs table - indicates if event has a pending/queued/running analysis job';
