-- Migration: Add smart_analysis_task_id column to waf_log table
-- Purpose: Link WAF events to smart analysis tasks for bulk analysis tracking

ALTER TABLE waf_log
ADD COLUMN IF NOT EXISTS smart_analysis_task_id INTEGER,
ADD CONSTRAINT fk_waf_log_smart_analysis_task
  FOREIGN KEY (smart_analysis_task_id)
  REFERENCES smart_analysis_tasks(id)
  ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_waf_log_smart_analysis_task_id ON waf_log(smart_analysis_task_id) WHERE smart_analysis_task_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN waf_log.smart_analysis_task_id IS 'Reference to smart analysis task (if event is part of bulk analysis)';
