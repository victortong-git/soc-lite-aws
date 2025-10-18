-- Migration: Add time_group to smart_analysis_tasks
-- This enables grouping events by IP + timestamp (minute precision)
-- Format: YYYYMMDD-HHMM

-- Add time_group column
ALTER TABLE smart_analysis_tasks
ADD COLUMN IF NOT EXISTS time_group VARCHAR(16);

-- Create unique constraint to prevent duplicate tasks for same IP+time
-- Note: This will fail if there are existing duplicate IP+time combinations
-- Run cleanup script first if needed
CREATE UNIQUE INDEX IF NOT EXISTS idx_smart_analysis_tasks_ip_time_unique
ON smart_analysis_tasks(source_ip, time_group)
WHERE time_group IS NOT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_smart_analysis_tasks_time_group
ON smart_analysis_tasks(time_group)
WHERE time_group IS NOT NULL;

-- Create composite index for queries
CREATE INDEX IF NOT EXISTS idx_smart_analysis_tasks_source_ip_time_group
ON smart_analysis_tasks(source_ip, time_group)
WHERE time_group IS NOT NULL;

-- Add comment
COMMENT ON COLUMN smart_analysis_tasks.time_group IS 'Time group in YYYYMMDD-HHMM format for event grouping by minute';
