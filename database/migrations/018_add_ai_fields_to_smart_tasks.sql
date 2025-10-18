-- Migration: 018_add_ai_fields_to_smart_tasks.sql
-- Documents additional AI analysis fields added to smart_analysis_tasks
-- These fields store raw AI prompts, responses, and attack classification

-- Add AI prompt and response fields
ALTER TABLE smart_analysis_tasks
ADD COLUMN IF NOT EXISTS ai_prompt TEXT,
ADD COLUMN IF NOT EXISTS ai_response TEXT,
ADD COLUMN IF NOT EXISTS attack_type VARCHAR(100);

-- Create index for attack_type filtering
CREATE INDEX IF NOT EXISTS idx_smart_analysis_tasks_attack_type
ON smart_analysis_tasks(attack_type);

-- Add comments for documentation
COMMENT ON COLUMN smart_analysis_tasks.ai_prompt IS 'Raw prompt sent to AI agent for bulk analysis';
COMMENT ON COLUMN smart_analysis_tasks.ai_response IS 'Raw response received from AI agent';
COMMENT ON COLUMN smart_analysis_tasks.attack_type IS 'Type of attack or activity identified by AI (e.g., SQL Injection, Directory Scanning, Benign Access)';
