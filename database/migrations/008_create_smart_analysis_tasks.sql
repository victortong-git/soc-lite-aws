-- Migration: Create Smart Analysis Tasks Table
-- Purpose: Group WAF events by source IP for bulk AI analysis

CREATE TABLE IF NOT EXISTS smart_analysis_tasks (
  id SERIAL PRIMARY KEY,
  source_ip VARCHAR(45) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  severity_rating INTEGER CHECK (severity_rating >= 0 AND severity_rating <= 5),
  security_analysis TEXT,
  recommended_actions TEXT,
  num_linked_events INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  analyzed_at TIMESTAMP WITH TIME ZONE,
  analyzed_by VARCHAR(100),
  CONSTRAINT valid_status CHECK (status IN ('open', 'in_review', 'completed', 'closed'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_smart_analysis_tasks_source_ip ON smart_analysis_tasks(source_ip);
CREATE INDEX IF NOT EXISTS idx_smart_analysis_tasks_status ON smart_analysis_tasks(status);
CREATE INDEX IF NOT EXISTS idx_smart_analysis_tasks_source_ip_status ON smart_analysis_tasks(source_ip, status);
CREATE INDEX IF NOT EXISTS idx_smart_analysis_tasks_status_created_at ON smart_analysis_tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_analysis_tasks_severity ON smart_analysis_tasks(severity_rating) WHERE severity_rating IS NOT NULL;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_smart_analysis_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_smart_analysis_tasks_updated_at ON smart_analysis_tasks;
CREATE TRIGGER trigger_update_smart_analysis_tasks_updated_at
    BEFORE UPDATE ON smart_analysis_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_smart_analysis_tasks_updated_at();

-- Comments
COMMENT ON TABLE smart_analysis_tasks IS 'Groups WAF events by source IP for bulk AI analysis';
COMMENT ON COLUMN smart_analysis_tasks.source_ip IS 'Source IP address that all linked events share';
COMMENT ON COLUMN smart_analysis_tasks.status IS 'Task status: open, in_review, completed, closed';
COMMENT ON COLUMN smart_analysis_tasks.severity_rating IS 'Overall severity rating (0-5) from bulk AI analysis';
COMMENT ON COLUMN smart_analysis_tasks.security_analysis IS 'Aggregated security analysis from AI';
COMMENT ON COLUMN smart_analysis_tasks.recommended_actions IS 'Recommended actions based on bulk analysis';
COMMENT ON COLUMN smart_analysis_tasks.num_linked_events IS 'Number of WAF events linked to this task';
