#!/bin/bash

# PostgreSQL RDS Connection Test Script
# This script connects to the RDS PostgreSQL instance and lists all tables

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
echo "Testing PostgreSQL RDS Connection"
echo "========================================="
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "========================================="
echo ""

# Resolve hostname to IP using Google DNS if local DNS fails
echo "Resolving hostname..."
DB_IP=$(nslookup $DB_HOST 8.8.8.8 | grep -A1 "Name:" | grep "Address:" | awk '{print $2}')
if [ -z "$DB_IP" ]; then
    echo "Warning: Could not resolve hostname, using hostname directly"
    DB_IP=$DB_HOST
else
    echo "Resolved $DB_HOST to $DB_IP"
fi
echo ""

# Set password environment variable to avoid password prompt
export PGPASSWORD="$DB_PASSWORD"

# Test connection and gather database statistics
echo "Connecting to database and gathering statistics..."
echo ""

# Get database statistics
psql -h "$DB_IP" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'

-- Database Overview
\echo '========================================='
\echo 'DATABASE OVERVIEW'
\echo '========================================='
SELECT
    current_database() AS database_name,
    pg_size_pretty(pg_database_size(current_database())) AS database_size,
    version() AS postgres_version;

\echo ''
\echo '========================================='
\echo 'TABLE STATISTICS'
\echo '========================================='

-- Total number of tables
SELECT COUNT(*) AS total_tables
FROM pg_catalog.pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');

\echo ''
\echo 'Tables with Record Counts and Sizes:'
\echo ''

-- List tables with row counts and sizes
SELECT
    schemaname AS schema,
    tablename AS table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    (SELECT COUNT(*) FROM information_schema.tables t
     WHERE t.table_schema = schemaname AND t.table_name = tablename) AS exists
FROM pg_catalog.pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;

\echo ''
\echo '========================================='
\echo 'TABLE DETAILS WITH ROW COUNTS'
\echo '========================================='

-- Get row counts for each table
DO $$
DECLARE
    r RECORD;
    row_count INTEGER;
BEGIN
    FOR r IN
        SELECT schemaname, tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY schemaname, tablename
    LOOP
        EXECUTE 'SELECT COUNT(*) FROM ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) INTO row_count;
        RAISE NOTICE 'Table: %.% | Rows: %', r.schemaname, r.tablename, row_count;
    END LOOP;
END $$;

\echo ''
\echo '========================================='
\echo 'INSTALLED EXTENSIONS'
\echo '========================================='

-- List installed extensions
SELECT
    extname AS extension_name,
    extversion AS version
FROM pg_extension
ORDER BY extname;

\echo ''
\echo '========================================='
\echo 'PGVECTOR SUPPORT STATUS'
\echo '========================================='

-- Check if pgvector is supported and installed
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
            '✓ ENABLED - pgvector ' || extversion || ' is installed and ready'
        WHEN EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
            '✗ AVAILABLE - pgvector is available but not enabled (run: CREATE EXTENSION vector;)'
        ELSE
            '✗ NOT AVAILABLE - pgvector is not supported on this database'
    END AS pgvector_status
FROM pg_extension
WHERE extname = 'vector'
UNION ALL
SELECT
    '✗ AVAILABLE - pgvector is available but not enabled (run: CREATE EXTENSION vector;)'
WHERE NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
  AND EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector')
UNION ALL
SELECT
    '✗ NOT AVAILABLE - pgvector is not supported on this database'
WHERE NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
  AND NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector')
LIMIT 1;

\echo ''
\echo '========================================='
\echo 'CONNECTION INFO'
\echo '========================================='

SELECT
    inet_server_addr() AS server_ip,
    inet_server_port() AS server_port,
    current_user AS connected_user,
    pg_backend_pid() AS backend_pid;

EOF

# Check if the connection was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "Connection successful!"
    echo "========================================="
else
    echo ""
    echo "========================================="
    echo "Connection failed!"
    echo "========================================="
    exit 1
fi

# Unset password variable for security
unset PGPASSWORD
