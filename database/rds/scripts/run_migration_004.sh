#!/bin/bash

# Run migration 004_add_analysis_job_link.sql
# Adds analysis_job_id to waf_log table

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
    echo "Required: DB_PASSWORD, DB_HOST, DB_USER, DB_NAME"
    exit 1
fi

echo "========================================="
echo "Running Migration: 004_add_analysis_job_link"
echo "========================================="
echo "Host: $DB_HOST"
echo "Database: $DB_NAME"
echo "========================================="
echo ""

# Resolve hostname to IP
echo "Resolving hostname..."
DB_IP=$(nslookup $DB_HOST 8.8.8.8 | grep -A1 "Name:" | grep "Address:" | awk '{print $2}')
if [ -z "$DB_IP" ]; then
    echo "Warning: Could not resolve hostname, using hostname directly"
    DB_IP=$DB_HOST
else
    echo "Resolved $DB_HOST to $DB_IP"
fi
echo ""

# Set password
export PGPASSWORD="$DB_PASSWORD"

# First check if column already exists
echo "Checking if analysis_job_id column already exists..."
COLUMN_EXISTS=$(psql -h "$DB_IP" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='waf_log' AND column_name='analysis_job_id';")

if [ ! -z "$COLUMN_EXISTS" ]; then
    echo "✓ Column 'analysis_job_id' already exists in waf_log table"
    echo "Migration already applied. Skipping."
    exit 0
fi

echo "Column does not exist. Running migration..."
echo ""

# Run the migration
psql -h "$DB_IP" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f 004_add_analysis_job_link.sql

# Check if migration was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "✓ Migration completed successfully!"
    echo "========================================="

    # Verify the column was created
    echo ""
    echo "Verifying column was created..."
    psql -h "$DB_IP" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\d waf_log" | grep analysis_job_id

else
    echo ""
    echo "========================================="
    echo "✗ Migration failed!"
    echo "========================================="
    exit 1
fi

# Unset password
unset PGPASSWORD
