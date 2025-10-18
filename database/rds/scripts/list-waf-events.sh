#!/bin/bash

# WAF Events Listing Script
# Lists the latest 10 WAF log events in descending order by ID

# Source central configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
else
    echo "Error: .env file not found at $PROJECT_ROOT/.env"
    exit 1
fi

# Validate required variables
if [ -z "$DB_PASSWORD" ] || [ -z "$DB_HOST" ] || [ -z "$DB_USER" ]; then
    echo "Error: Required environment variables not set in .env"
    echo "Required: DB_PASSWORD, DB_HOST, DB_USER"
    exit 1
fi

echo "========================================="
echo "Latest 10 WAF Log Events"
echo "========================================="
echo ""

# Resolve hostname to IP using Google DNS if local DNS fails
DB_IP=$(nslookup $DB_HOST 8.8.8.8 2>/dev/null | grep -A1 "Name:" | grep "Address:" | awk '{print $2}')
if [ -z "$DB_IP" ]; then
    DB_IP=$DB_HOST
fi

# Set password environment variable to avoid password prompt
export PGPASSWORD="$DB_PASSWORD"

# Query latest 10 events ordered by id descending
psql -h "$DB_IP" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
    id,
    status,
    created_at
FROM waf_log
ORDER BY id DESC
LIMIT 10;
"

# Check if the query was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "Query executed successfully"
    echo "========================================="
else
    echo ""
    echo "========================================="
    echo "Query failed!"
    echo "========================================="
    exit 1
fi

# Unset password variable for security
unset PGPASSWORD
