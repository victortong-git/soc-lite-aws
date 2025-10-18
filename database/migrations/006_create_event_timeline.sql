-- Create event_timeline table for tracking event activity
-- Migration: 006_create_event_timeline.sql

CREATE TABLE IF NOT EXISTS event_timeline (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES waf_log(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- e.g., 'status_change', 'ai_analysis', 'comment', 'update'
  actor_type VARCHAR(20) NOT NULL, -- 'user' or 'system'
  actor_name VARCHAR(255), -- username or 'System'
  actor_email VARCHAR(255), -- user email (optional)
  title VARCHAR(255) NOT NULL, -- Short description (e.g., "AI Analysis Completed")
  description TEXT, -- Detailed description (optional)
  metadata JSONB, -- Additional structured data about the event
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_event_timeline_event_id ON event_timeline(event_id);
CREATE INDEX idx_event_timeline_created_at ON event_timeline(created_at DESC);
CREATE INDEX idx_event_timeline_event_type ON event_timeline(event_type);
CREATE INDEX idx_event_timeline_actor_type ON event_timeline(actor_type);

-- GIN index for JSONB metadata
CREATE INDEX idx_event_timeline_metadata_gin ON event_timeline USING GIN (metadata);

-- Comments for documentation
COMMENT ON TABLE event_timeline IS 'Timeline of activities and changes for WAF events';
COMMENT ON COLUMN event_timeline.event_id IS 'Foreign key to waf_log table';
COMMENT ON COLUMN event_timeline.event_type IS 'Type of timeline event (status_change, ai_analysis, comment, etc.)';
COMMENT ON COLUMN event_timeline.actor_type IS 'Who performed the action: user or system';
COMMENT ON COLUMN event_timeline.actor_name IS 'Name of user or system that performed the action';
COMMENT ON COLUMN event_timeline.title IS 'Short title/summary of the timeline event';
COMMENT ON COLUMN event_timeline.description IS 'Detailed description of what happened';
COMMENT ON COLUMN event_timeline.metadata IS 'Additional structured data (old/new values, analysis results, etc.)';
