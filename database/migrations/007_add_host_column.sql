-- Migration: Add host column to waf_log table
-- Extracts and stores the host/website from raw CloudWatch logs
-- Migration: 007_add_host_column.sql

-- Add host column
ALTER TABLE waf_log ADD COLUMN IF NOT EXISTS host VARCHAR(255);

-- Create index for filtering by host
CREATE INDEX IF NOT EXISTS idx_waf_log_host ON waf_log(host);

-- Backfill existing records by extracting host from raw_message JSON
-- Format: raw_message->'httpRequest'->>'host'
UPDATE waf_log
SET host = raw_message->'httpRequest'->>'host'
WHERE host IS NULL
  AND raw_message IS NOT NULL
  AND raw_message->'httpRequest' IS NOT NULL
  AND raw_message->'httpRequest'->>'host' IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN waf_log.host IS 'Host/website extracted from httpRequest.host in raw CloudWatch log';
