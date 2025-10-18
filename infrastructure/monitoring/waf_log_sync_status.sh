#!/bin/bash
#
# WAF Log Sync Health Check Script
#
# Purpose: Verifies that WAF logs from CloudWatch are being properly synced to RDS database
#
# Usage: ./waf_log_sync_status.sh
#
# Exit codes:
#   0 - Healthy (all checks passed)
#   1 - Warning (some issues detected)
#   2 - Critical (major issues detected)
#

set -e

# Source central configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

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

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOG_GROUP="aws-waf-logs-soc-lite-cloudfront-waf-log"
LAMBDA_FUNCTION="get-waf-alert"
MAX_GAP_MINUTES=30  # Alert if DB is behind CloudWatch by more than this

# Health check results
HEALTH_STATUS="HEALTHY"
WARNINGS=0
ERRORS=0

echo "=========================================="
echo "WAF Log Sync Health Check"
echo "=========================================="
echo ""
echo "Checking WAF log synchronization status..."
echo ""

# Function to print status messages
print_status() {
    local status=$1
    local message=$2

    case $status in
        "OK")
            echo -e "${GREEN}✓${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠${NC} $message"
            WARNINGS=$((WARNINGS + 1))
            if [ "$HEALTH_STATUS" = "HEALTHY" ]; then
                HEALTH_STATUS="WARNING"
            fi
            ;;
        "ERROR")
            echo -e "${RED}✗${NC} $message"
            ERRORS=$((ERRORS + 1))
            HEALTH_STATUS="CRITICAL"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ${NC} $message"
            ;;
    esac
}

# Check 1: CloudWatch Log Group exists and has recent logs
echo "1. Checking CloudWatch Log Group..."
if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$AWS_REGION" --query 'logGroups[0].logGroupName' --output text &>/dev/null; then
    print_status "OK" "Log group '$LOG_GROUP' exists"

    # Get latest log event timestamp
    LATEST_CW_TIMESTAMP=$(aws logs filter-log-events \
        --log-group-name "$LOG_GROUP" \
        --start-time $(($(date +%s)*1000 - 3600000)) \
        --max-items 1 \
        --region "$AWS_REGION" \
        --query 'events[0].timestamp' \
        --output text 2>/dev/null | head -1)

    if [ -n "$LATEST_CW_TIMESTAMP" ] && [ "$LATEST_CW_TIMESTAMP" != "None" ] && [[ "$LATEST_CW_TIMESTAMP" =~ ^[0-9]+$ ]]; then
        CW_EPOCH=$((LATEST_CW_TIMESTAMP / 1000))
        CW_TIME=$(date -d "@${CW_EPOCH}" '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || echo "Invalid")
        print_status "OK" "Latest CloudWatch log: $CW_TIME"
    else
        print_status "WARN" "No recent logs in CloudWatch (last 1 hour)"
        LATEST_CW_TIMESTAMP="0"
        CW_EPOCH=0
    fi
else
    print_status "ERROR" "Log group '$LOG_GROUP' not found"
fi

echo ""

# Check 2: Lambda function status
echo "2. Checking Lambda Function..."
LAMBDA_STATE=$(aws lambda get-function \
    --function-name "$LAMBDA_FUNCTION" \
    --region "$AWS_REGION" \
    --query 'Configuration.State' \
    --output text 2>/dev/null || echo "NotFound")

if [ "$LAMBDA_STATE" = "Active" ]; then
    print_status "OK" "Lambda function '$LAMBDA_FUNCTION' is active"

    # Check recent errors
    ERROR_COUNT=$(aws logs filter-log-events \
        --log-group-name "/aws/lambda/$LAMBDA_FUNCTION" \
        --start-time $(($(date +%s)*1000 - 3600000)) \
        --filter-pattern "ERROR" \
        --region "$AWS_REGION" \
        --query 'length(events)' \
        --output text 2>/dev/null)

    if [ -z "$ERROR_COUNT" ] || [ "$ERROR_COUNT" = "None" ]; then
        ERROR_COUNT=0
    fi

    if [ "$ERROR_COUNT" -gt 0 ] 2>/dev/null; then
        print_status "WARN" "Found $ERROR_COUNT errors in Lambda logs (last 1 hour)"

        # Show latest error
        LATEST_ERROR=$(aws logs filter-log-events \
            --log-group-name "/aws/lambda/$LAMBDA_FUNCTION" \
            --start-time $(($(date +%s)*1000 - 3600000)) \
            --filter-pattern "ERROR" \
            --region "$AWS_REGION" \
            --max-items 1 \
            --query 'events[0].message' \
            --output text 2>/dev/null | head -1)

        if [ -n "$LATEST_ERROR" ]; then
            print_status "INFO" "Latest error: ${LATEST_ERROR:0:100}..."
        fi
    else
        print_status "OK" "No errors in Lambda logs (last 1 hour)"
    fi
else
    print_status "ERROR" "Lambda function state: $LAMBDA_STATE"
fi

echo ""

# Check 3: CloudWatch Subscription Filter
echo "3. Checking Subscription Filter..."
FILTER_DEST=$(aws logs describe-subscription-filters \
    --log-group-name "$LOG_GROUP" \
    --region "$AWS_REGION" \
    --query 'subscriptionFilters[0].destinationArn' \
    --output text 2>/dev/null || echo "None")

if [[ "$FILTER_DEST" == *"$LAMBDA_FUNCTION"* ]]; then
    print_status "OK" "Subscription filter configured correctly"

    FILTER_PATTERN=$(aws logs describe-subscription-filters \
        --log-group-name "$LOG_GROUP" \
        --region "$AWS_REGION" \
        --query 'subscriptionFilters[0].filterPattern' \
        --output text 2>/dev/null || echo "")

    if [ -z "$FILTER_PATTERN" ] || [ "$FILTER_PATTERN" = "None" ]; then
        print_status "OK" "Filter pattern: (all events)"
    else
        print_status "INFO" "Filter pattern: $FILTER_PATTERN"
    fi
else
    print_status "ERROR" "Subscription filter not configured or pointing to wrong Lambda"
fi

echo ""

# Check 4: Database connectivity and latest record
echo "4. Checking Database..."
DB_CHECK=$(PGPASSWORD="$DB_PASSWORD" psql \
    "sslmode=require host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER" \
    -t -c "SELECT 1" 2>/dev/null || echo "Failed")

if [ "$DB_CHECK" = "Failed" ]; then
    print_status "ERROR" "Cannot connect to database"
else
    print_status "OK" "Database connection successful"

    # Get latest WAF log from database
    LATEST_DB_RECORD=$(PGPASSWORD="$DB_PASSWORD" psql \
        "sslmode=require host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER" \
        -t -c "SELECT id, timestamp, source_ip, action, created_at FROM waf_log ORDER BY timestamp DESC LIMIT 1" 2>/dev/null)

    if [ -n "$LATEST_DB_RECORD" ]; then
        print_status "OK" "Latest database record found"
        print_status "INFO" "Details: $LATEST_DB_RECORD"

        # Extract timestamp and compare
        DB_TIMESTAMP=$(echo "$LATEST_DB_RECORD" | awk '{print $2, $3}')
        if [ -n "$DB_TIMESTAMP" ]; then
            DB_EPOCH=$(date -d "$DB_TIMESTAMP" +%s 2>/dev/null)
            if [ -z "$DB_EPOCH" ]; then
                DB_EPOCH=0
            fi
            NOW_EPOCH=$(date +%s)
            AGE_MINUTES=$(( (NOW_EPOCH - DB_EPOCH) / 60 ))

            if [ "$AGE_MINUTES" -gt "$MAX_GAP_MINUTES" ] 2>/dev/null; then
                print_status "WARN" "Latest DB record is $AGE_MINUTES minutes old (threshold: $MAX_GAP_MINUTES min)"
            else
                print_status "OK" "Database is up-to-date ($AGE_MINUTES minutes old)"
            fi
        fi
    else
        print_status "WARN" "No records found in waf_log table"
    fi

    # Get record count stats
    RECORD_COUNTS=$(PGPASSWORD="$DB_PASSWORD" psql \
        "sslmode=require host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER" \
        -t -c "SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '1 hour') as last_hour,
            COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as last_24h
        FROM waf_log" 2>/dev/null)

    if [ -n "$RECORD_COUNTS" ]; then
        print_status "INFO" "Records: Total=$(echo $RECORD_COUNTS | awk '{print $1}'), Last 1h=$(echo $RECORD_COUNTS | awk '{print $3}'), Last 24h=$(echo $RECORD_COUNTS | awk '{print $5}')"
    fi
fi

echo ""

# Check 5: Compare CloudWatch vs Database timestamps
echo "5. Sync Status Verification..."
if [ "$LATEST_CW_TIMESTAMP" != "0" ] && [ "$DB_EPOCH" != "0" ] 2>/dev/null; then
    CW_EPOCH_CHECK=$((LATEST_CW_TIMESTAMP / 1000))
    SYNC_GAP_MINUTES=$(( (CW_EPOCH_CHECK - DB_EPOCH) / 60 ))

    if [ $SYNC_GAP_MINUTES -lt 0 ]; then
        SYNC_GAP_MINUTES=$((SYNC_GAP_MINUTES * -1))
        print_status "OK" "Database is ahead of CloudWatch by $SYNC_GAP_MINUTES minutes (normal for real-time sync)"
    elif [ $SYNC_GAP_MINUTES -le 5 ]; then
        print_status "OK" "Sync gap: $SYNC_GAP_MINUTES minutes (excellent)"
    elif [ $SYNC_GAP_MINUTES -le $MAX_GAP_MINUTES ]; then
        print_status "WARN" "Sync gap: $SYNC_GAP_MINUTES minutes (acceptable but monitor)"
    else
        print_status "ERROR" "Sync gap: $SYNC_GAP_MINUTES minutes (sync lag detected!)"
    fi
else
    print_status "INFO" "Cannot compare timestamps (missing data)"
fi

echo ""
echo "=========================================="

# Final summary
if [ "$HEALTH_STATUS" = "HEALTHY" ]; then
    echo -e "${GREEN}Overall Status: HEALTHY${NC}"
    echo "All checks passed. WAF log sync is working correctly."
    exit 0
elif [ "$HEALTH_STATUS" = "WARNING" ]; then
    echo -e "${YELLOW}Overall Status: WARNING${NC}"
    echo "Found $WARNINGS warning(s). Please investigate."
    exit 1
else
    echo -e "${RED}Overall Status: CRITICAL${NC}"
    echo "Found $ERRORS error(s) and $WARNINGS warning(s). Immediate attention required!"
    exit 2
fi
