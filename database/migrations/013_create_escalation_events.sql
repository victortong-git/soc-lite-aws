-- Migration: 013_create_escalation_events.sql
-- Creates escalation_events table for tracking security escalations
-- Provides traceability and audit trail for severity 4/5 events

-- Create escalation_events table
CREATE TABLE IF NOT EXISTS escalation_events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  detail_payload JSONB,
  severity INTEGER NOT NULL CHECK (severity >= 0 AND severity <= 5),
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('waf_event', 'smart_task')),
  source_waf_event_id INTEGER REFERENCES waf_log(id) ON DELETE SET NULL,
  source_smart_task_id INTEGER REFERENCES smart_analysis_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_sns BOOLEAN DEFAULT FALSE,
  completed_incident BOOLEAN DEFAULT FALSE,
  sns_sent_at TIMESTAMP WITH TIME ZONE,
  sns_message_id VARCHAR(255),
  sns_error TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_escalation_events_source_waf_event ON escalation_events(source_waf_event_id);
CREATE INDEX IF NOT EXISTS idx_escalation_events_source_smart_task ON escalation_events(source_smart_task_id);
CREATE INDEX IF NOT EXISTS idx_escalation_events_created_at ON escalation_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_events_completed_sns ON escalation_events(completed_sns) WHERE completed_sns = FALSE;
CREATE INDEX IF NOT EXISTS idx_escalation_events_completed_incident ON escalation_events(completed_incident) WHERE completed_incident = FALSE;
CREATE INDEX IF NOT EXISTS idx_escalation_events_severity ON escalation_events(severity);
CREATE INDEX IF NOT EXISTS idx_escalation_events_source_type ON escalation_events(source_type);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_escalation_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_escalation_events_updated_at ON escalation_events;
CREATE TRIGGER trigger_update_escalation_events_updated_at
    BEFORE UPDATE ON escalation_events
    FOR EACH ROW
    EXECUTE FUNCTION update_escalation_events_updated_at();

-- Add comments for documentation
COMMENT ON TABLE escalation_events IS 'Tracks security escalations for high severity events (4/5) requiring SNS notifications';
COMMENT ON COLUMN escalation_events.title IS 'Brief title describing the escalation';
COMMENT ON COLUMN escalation_events.message IS 'Full escalation message to be sent via SNS';
COMMENT ON COLUMN escalation_events.detail_payload IS 'JSONB containing full event details and metadata';
COMMENT ON COLUMN escalation_events.severity IS 'Severity level (typically 4 or 5 for escalations)';
COMMENT ON COLUMN escalation_events.source_type IS 'Type of source: waf_event or smart_task';
COMMENT ON COLUMN escalation_events.source_waf_event_id IS 'Foreign key to waf_log table for traceability';
COMMENT ON COLUMN escalation_events.source_smart_task_id IS 'Foreign key to smart_analysis_tasks table for traceability';
COMMENT ON COLUMN escalation_events.completed_sns IS 'Boolean flag indicating if SNS notification has been sent';
COMMENT ON COLUMN escalation_events.completed_incident IS 'Boolean flag for future incident management integration (Phase 2)';
COMMENT ON COLUMN escalation_events.sns_sent_at IS 'Timestamp when SNS notification was successfully sent';
COMMENT ON COLUMN escalation_events.sns_message_id IS 'AWS SNS message ID for tracking';
COMMENT ON COLUMN escalation_events.sns_error IS 'Error message if SNS sending failed';
