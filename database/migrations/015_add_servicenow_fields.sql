-- Migration: 015_add_servicenow_fields.sql
-- Adds ServiceNow incident tracking fields to escalation_events table
-- Enables integration with ServiceNow Security Incident Management

-- Add ServiceNow incident tracking columns
ALTER TABLE escalation_events
ADD COLUMN IF NOT EXISTS servicenow_incident_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS servicenow_incident_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS servicenow_incident_sys_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS servicenow_incident_error TEXT;

-- Create index for ServiceNow incident number lookups
CREATE INDEX IF NOT EXISTS idx_escalation_events_servicenow_incident
ON escalation_events(servicenow_incident_number)
WHERE servicenow_incident_number IS NOT NULL;

-- Create index for pending incident creation (for Lambda processor)
CREATE INDEX IF NOT EXISTS idx_escalation_events_pending_incident
ON escalation_events(completed_incident, created_at)
WHERE completed_incident = FALSE;

-- Add comments for documentation
COMMENT ON COLUMN escalation_events.servicenow_incident_number IS 'ServiceNow incident number (e.g., INC0001234)';
COMMENT ON COLUMN escalation_events.servicenow_incident_created_at IS 'Timestamp when ServiceNow incident was successfully created';
COMMENT ON COLUMN escalation_events.servicenow_incident_sys_id IS 'ServiceNow incident sys_id (unique identifier)';
COMMENT ON COLUMN escalation_events.servicenow_incident_error IS 'Error message if ServiceNow incident creation failed';
