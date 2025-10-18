-- Migration: 016_create_blocklist_ip.sql
-- Creates blocklist_ip table for tracking attacker IPs blocked in WAF
-- Supports automatic IP blocking for high-severity escalations

-- Create blocklist_ip table
CREATE TABLE IF NOT EXISTS blocklist_ip (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  reason TEXT,
  severity INTEGER NOT NULL CHECK (severity >= 0 AND severity <= 5),
  source_escalation_id INTEGER REFERENCES escalation_events(id) ON DELETE SET NULL,
  source_waf_event_id INTEGER REFERENCES waf_log(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  block_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  removed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blocklist_ip_address ON blocklist_ip(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocklist_ip_is_active ON blocklist_ip(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_blocklist_ip_created_at ON blocklist_ip(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocklist_ip_last_seen_at ON blocklist_ip(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocklist_ip_severity ON blocklist_ip(severity);
CREATE INDEX IF NOT EXISTS idx_blocklist_ip_source_escalation ON blocklist_ip(source_escalation_id);
CREATE INDEX IF NOT EXISTS idx_blocklist_ip_source_waf_event ON blocklist_ip(source_waf_event_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_blocklist_ip_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_blocklist_ip_updated_at ON blocklist_ip;
CREATE TRIGGER trigger_update_blocklist_ip_updated_at
    BEFORE UPDATE ON blocklist_ip
    FOR EACH ROW
    EXECUTE FUNCTION update_blocklist_ip_updated_at();

-- Add comments for documentation
COMMENT ON TABLE blocklist_ip IS 'Tracks attacker IPs blocked in AWS WAF IPSet for high-severity events (4/5)';
COMMENT ON COLUMN blocklist_ip.ip_address IS 'IPv4 or IPv6 address blocked in WAF';
COMMENT ON COLUMN blocklist_ip.reason IS 'Human-readable reason for blocking (from escalation message)';
COMMENT ON COLUMN blocklist_ip.severity IS 'Original event severity that triggered blocking (typically 4 or 5)';
COMMENT ON COLUMN blocklist_ip.source_escalation_id IS 'Foreign key to escalation_events table for traceability';
COMMENT ON COLUMN blocklist_ip.source_waf_event_id IS 'Foreign key to waf_log table for original event';
COMMENT ON COLUMN blocklist_ip.created_at IS 'Timestamp when IP was first blocked';
COMMENT ON COLUMN blocklist_ip.last_seen_at IS 'Timestamp when IP was last seen in another attack (updated on duplicate)';
COMMENT ON COLUMN blocklist_ip.block_count IS 'Number of times this IP has triggered blocking (incremented on duplicate)';
COMMENT ON COLUMN blocklist_ip.is_active IS 'Whether IP is currently in WAF IPSet (false after manual removal)';
COMMENT ON COLUMN blocklist_ip.removed_at IS 'Timestamp when IP was removed from WAF IPSet';
