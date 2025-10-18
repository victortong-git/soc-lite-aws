-- Migration: Create Smart Analysis Jobs Table
-- Purpose: Job queue for processing smart analysis tasks (similar to analysis_jobs pattern)

CREATE TABLE IF NOT EXISTS smart_analysis_jobs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  processing_duration_ms INTEGER,
  CONSTRAINT fk_smart_analysis_task
    FOREIGN KEY (task_id)
    REFERENCES smart_analysis_tasks(id)
    ON DELETE CASCADE,
  CONSTRAINT valid_job_status CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'on_hold'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_smart_analysis_jobs_task_id ON smart_analysis_jobs(task_id);
CREATE INDEX IF NOT EXISTS idx_smart_analysis_jobs_status ON smart_analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_smart_analysis_jobs_status_priority_created ON smart_analysis_jobs(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_smart_analysis_jobs_created_at ON smart_analysis_jobs(created_at DESC);

-- Comments
COMMENT ON TABLE smart_analysis_jobs IS 'Job queue for processing smart analysis tasks with bulk AI analysis';
COMMENT ON COLUMN smart_analysis_jobs.task_id IS 'Reference to smart analysis task to be processed';
COMMENT ON COLUMN smart_analysis_jobs.status IS 'Job status: pending, queued, running, completed, failed, on_hold';
COMMENT ON COLUMN smart_analysis_jobs.priority IS 'Job priority (higher number = higher priority)';
COMMENT ON COLUMN smart_analysis_jobs.attempts IS 'Number of processing attempts';
COMMENT ON COLUMN smart_analysis_jobs.max_attempts IS 'Maximum number of retry attempts (default 3)';
COMMENT ON COLUMN smart_analysis_jobs.processing_duration_ms IS 'Time taken to process job in milliseconds';
