-- Migration: Create Smart Analysis Event Links Junction Table
-- Purpose: Links WAF events to smart analysis tasks (many-to-one relationship)

CREATE TABLE IF NOT EXISTS smart_analysis_event_links (
  id SERIAL PRIMARY KEY,
  smart_analysis_task_id INTEGER NOT NULL,
  waf_log_id INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_smart_analysis_task
    FOREIGN KEY (smart_analysis_task_id)
    REFERENCES smart_analysis_tasks(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_waf_log
    FOREIGN KEY (waf_log_id)
    REFERENCES waf_log(id)
    ON DELETE CASCADE,
  CONSTRAINT unique_task_event_link UNIQUE (smart_analysis_task_id, waf_log_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_smart_analysis_event_links_task_id ON smart_analysis_event_links(smart_analysis_task_id);
CREATE INDEX IF NOT EXISTS idx_smart_analysis_event_links_waf_log_id ON smart_analysis_event_links(waf_log_id);

-- Comments
COMMENT ON TABLE smart_analysis_event_links IS 'Junction table linking WAF events to smart analysis tasks';
COMMENT ON COLUMN smart_analysis_event_links.smart_analysis_task_id IS 'Reference to smart analysis task';
COMMENT ON COLUMN smart_analysis_event_links.waf_log_id IS 'Reference to WAF event (unique - each event linked to one task only)';
