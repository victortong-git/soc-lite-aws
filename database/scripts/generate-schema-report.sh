#!/bin/bash
# Generate detailed schema report from RDS database
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Source configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -E "^(DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD)=" "$PROJECT_ROOT/.env" | xargs)
else
    echo -e "${RED}✗ .env file not found${NC}"
    exit 1
fi

OUTPUT_FILE="$PROJECT_ROOT/database/SCHEMA_REPORT_$(date +%Y%m%d_%H%M%S).txt"

echo -e "${BLUE}Generating schema report...${NC}"
echo "Output: $OUTPUT_FILE"
echo ""

PSQL_CMD="PGPASSWORD=$DB_PASSWORD psql \"sslmode=require host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER\""

{
    echo "=================================="
    echo "DATABASE SCHEMA REPORT"
    echo "=================================="
    echo "Generated: $(date)"
    echo "Database: $DB_HOST"
    echo "Database Name: $DB_NAME"
    echo ""
    
    echo "=================================="
    echo "TABLES"
    echo "=================================="
    eval "$PSQL_CMD -c \"SELECT tablename, schemaname FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;\""
    echo ""
    
    echo "=================================="
    echo "TABLE: waf_log"
    echo "=================================="
    eval "$PSQL_CMD -c \"\\d+ waf_log\""
    echo ""
    
    echo "=================================="
    echo "TABLE: user_accts"
    echo "=================================="
    eval "$PSQL_CMD -c \"\\d+ user_accts\""
    echo ""
    
    echo "=================================="
    echo "TABLE: analysis_jobs"
    echo "=================================="
    eval "$PSQL_CMD -c \"\\d+ analysis_jobs\""
    echo ""
    
    echo "=================================="
    echo "TABLE: event_timeline"
    echo "=================================="
    eval "$PSQL_CMD -c \"\\d+ event_timeline\""
    echo ""
    
    echo "=================================="
    echo "TABLE: smart_analysis_tasks"
    echo "=================================="
    eval "$PSQL_CMD -c \"\\d+ smart_analysis_tasks\""
    echo ""
    
    echo "=================================="
    echo "TABLE: smart_analysis_event_links"
    echo "=================================="
    eval "$PSQL_CMD -c \"\\d+ smart_analysis_event_links\""
    echo ""
    
    echo "=================================="
    echo "TABLE: smart_analysis_jobs"
    echo "=================================="
    eval "$PSQL_CMD -c \"\\d+ smart_analysis_jobs\""
    echo ""
    
    echo "=================================="
    echo "TABLE: escalation_events"
    echo "=================================="
    eval "$PSQL_CMD -c \"\\d+ escalation_events\""
    echo ""
    
    echo "=================================="
    echo "TABLE: blocklist_ip"
    echo "=================================="
    eval "$PSQL_CMD -c \"\\d+ blocklist_ip\""
    echo ""
    
    echo "=================================="
    echo "FOREIGN KEYS"
    echo "=================================="
    eval "$PSQL_CMD -c \"SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS referenced_table FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace ORDER BY conname;\""
    echo ""
    
    echo "=================================="
    echo "INDEXES"
    echo "=================================="
    eval "$PSQL_CMD -c \"SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;\""
    echo ""
    
    echo "=================================="
    echo "TRIGGERS"
    echo "=================================="
    eval "$PSQL_CMD -c \"SELECT tgname, tgrelid::regclass AS table_name FROM pg_trigger WHERE tgname LIKE 'trigger_%' ORDER BY tgname;\""
    echo ""
    
    echo "=================================="
    echo "TABLE SIZES"
    echo "=================================="
    eval "$PSQL_CMD -c \"SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;\""
    echo ""
    
    echo "=================================="
    echo "ROW COUNTS"
    echo "=================================="
    eval "$PSQL_CMD -c \"SELECT 'waf_log' AS table_name, COUNT(*) AS row_count FROM waf_log UNION ALL SELECT 'user_accts', COUNT(*) FROM user_accts UNION ALL SELECT 'analysis_jobs', COUNT(*) FROM analysis_jobs UNION ALL SELECT 'event_timeline', COUNT(*) FROM event_timeline UNION ALL SELECT 'smart_analysis_tasks', COUNT(*) FROM smart_analysis_tasks UNION ALL SELECT 'smart_analysis_event_links', COUNT(*) FROM smart_analysis_event_links UNION ALL SELECT 'smart_analysis_jobs', COUNT(*) FROM smart_analysis_jobs UNION ALL SELECT 'escalation_events', COUNT(*) FROM escalation_events UNION ALL SELECT 'blocklist_ip', COUNT(*) FROM blocklist_ip ORDER BY table_name;\""
    echo ""
    
} > "$OUTPUT_FILE" 2>&1

echo -e "${GREEN}✓ Schema report generated${NC}"
echo "File: $OUTPUT_FILE"
echo ""
echo "View with: cat $OUTPUT_FILE"
