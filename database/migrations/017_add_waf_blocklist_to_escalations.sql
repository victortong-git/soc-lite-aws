-- Migration: 017_add_waf_blocklist_to_escalations.sql
-- Adds WAF blocklist tracking fields to escalation_events table
-- Enables tracking of which escalations triggered IP blocking in WAF

-- Add WAF blocklist tracking columns
ALTER TABLE escalation_events
ADD COLUMN IF NOT EXISTS completed_waf_blocklist BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS waf_blocklist_added_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS waf_blocklist_ip VARCHAR(45),
ADD COLUMN IF NOT EXISTS waf_blocklist_error TEXT;

-- Create index for pending WAF blocklist additions (for Lambda processor)
CREATE INDEX IF NOT EXISTS idx_escalation_events_pending_waf_blocklist
ON escalation_events(completed_waf_blocklist, created_at)
WHERE completed_waf_blocklist = FALSE AND severity >= 4;

-- Create index for WAF blocklist IP lookups
CREATE INDEX IF NOT EXISTS idx_escalation_events_waf_blocklist_ip
ON escalation_events(waf_blocklist_ip)
WHERE waf_blocklist_ip IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN escalation_events.completed_waf_blocklist IS 'Boolean flag indicating if IP has been added to WAF blocklist IPSet';
COMMENT ON COLUMN escalation_events.waf_blocklist_added_at IS 'Timestamp when IP was successfully added to WAF blocklist';
COMMENT ON COLUMN escalation_events.waf_blocklist_ip IS 'IP address that was added to WAF blocklist (for quick reference)';
COMMENT ON COLUMN escalation_events.waf_blocklist_error IS 'Error message if WAF blocklist addition failed';

-- Update existing source_type constraint to include 'attack_campaign'
-- (This was added in a previous migration but might be missing)
ALTER TABLE escalation_events
DROP CONSTRAINT IF EXISTS escalation_events_source_type_check;

ALTER TABLE escalation_events
ADD CONSTRAINT escalation_events_source_type_check
CHECK (source_type IN ('waf_event', 'smart_task', 'attack_campaign'));
