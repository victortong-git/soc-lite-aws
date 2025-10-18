#!/bin/bash
# Backfill host data from raw_message field for existing events
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Source central configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
else
    echo -e "${RED}✗ .env file not found at $PROJECT_ROOT/.env${NC}"
    exit 1
fi

# Validate required variables
if [ -z "$DB_PASSWORD" ] || [ -z "$DB_HOST" ] || [ -z "$DB_USER" ]; then
    echo -e "${RED}✗ Required environment variables not set in .env${NC}"
    echo "Required: DB_PASSWORD, DB_HOST, DB_USER, DB_NAME"
    exit 1
fi

echo "🔄 Backfilling host data from raw_message..."
echo "Database: $DB_HOST"
echo ""

# Update existing records to extract host from raw_message
PGPASSWORD="$DB_PASSWORD" psql \
    "sslmode=require host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER" \
    -c "
UPDATE waf_log
SET host = raw_message->'httpRequest'->>'host'
WHERE host IS NULL
  AND raw_message IS NOT NULL
  AND raw_message->'httpRequest' IS NOT NULL
  AND raw_message->'httpRequest'->>'host' IS NOT NULL;

SELECT
    COUNT(*) as total_events,
    COUNT(host) as events_with_host,
    COUNT(*) - COUNT(host) as events_without_host
FROM waf_log;
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Host data backfill completed!${NC}"
else
    echo -e "${RED}✗ Backfill failed${NC}"
    exit 1
fi
