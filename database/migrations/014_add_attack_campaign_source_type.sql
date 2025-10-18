-- Migration: 014_add_attack_campaign_source_type.sql
-- Adds 'attack_campaign' to escalation_events source_type for monitoring agent
-- This allows one escalation to be created for multiple events in a campaign

-- Drop existing constraint
ALTER TABLE escalation_events
DROP CONSTRAINT IF EXISTS escalation_events_source_type_check;

-- Add new constraint with 'attack_campaign' option
ALTER TABLE escalation_events
ADD CONSTRAINT escalation_events_source_type_check
CHECK (source_type IN ('waf_event', 'smart_task', 'attack_campaign'));

-- Add comment
COMMENT ON CONSTRAINT escalation_events_source_type_check ON escalation_events IS
'Source type: waf_event (single event), smart_task (bulk analysis), attack_campaign (monitoring agent detected repeated attack)';
