#!/bin/bash

################################################################################
# PostgreSQL Database Backup Script for SOC-Lite RDS
#
# Description:
#   Creates a compressed backup of the PostgreSQL database including:
#   - Complete schema (tables, indexes, views, functions, triggers)
#   - All data from all tables
#   - Automatic timestamped backup files
#   - Backup retention management (keeps last 30 days)
#
# Usage:
#   ./db_backup.sh [backup_directory]
#
# Environment Variables (required):
#   DB_HOST     - Database hostname
#   DB_PORT     - Database port
#   DB_NAME     - Database name
#   DB_USER     - Database user
#   DB_PASSWORD - Database password
#
# Example:
#   ./db_backup.sh
#   ./db_backup.sh /custom/backup/path
################################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

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

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Use DB config from .env (fallback to defaults for DB_NAME if not in .env)
DB_NAME="${DB_NAME:-postgres}"

# Backup configuration
BACKUP_DIR="${1:-/aws/db_backup}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/soc_lite_backup_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"
RETENTION_DAYS=30

# Log function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1"
}

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    log_error "pg_dump command not found. Please install postgresql-client."
    exit 1
fi

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
fi

# Verify backup directory is writable
if [ ! -w "$BACKUP_DIR" ]; then
    log_error "Backup directory is not writable: $BACKUP_DIR"
    exit 1
fi

log "=========================================="
log "SOC-Lite Database Backup"
log "=========================================="
log "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
log "User: ${DB_USER}"
log "Backup directory: ${BACKUP_DIR}"
log "Timestamp: ${TIMESTAMP}"
log "=========================================="

# Export password for pg_dump
export PGPASSWORD="${DB_PASSWORD}"
export PGSSLMODE="require"

# Perform backup
log "Starting database backup..."

# Check pg_dump version compatibility
PG_DUMP_VERSION=$(pg_dump --version | grep -oP '\d+' | head -1)
SERVER_VERSION=$(PGPASSWORD="${DB_PASSWORD}" PGSSLMODE="require" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SHOW server_version;" 2>/dev/null | grep -oP '^\s*\K\d+' || echo "unknown")

if [ "$SERVER_VERSION" != "unknown" ] && [ "$PG_DUMP_VERSION" -lt "$SERVER_VERSION" ]; then
    log_warning "pg_dump version ($PG_DUMP_VERSION) is older than server version ($SERVER_VERSION)"
    log_warning "This may cause compatibility warnings but should still work"
fi

# Run pg_dump and capture stderr
BACKUP_STDERR=$(mktemp)
if pg_dump -h "$DB_HOST" \
           -p "$DB_PORT" \
           -U "$DB_USER" \
           -d "$DB_NAME" \
           --format=plain \
           --no-owner \
           --no-privileges \
           --file="$BACKUP_FILE" 2>"$BACKUP_STDERR"; then

    # Check if file was actually created and has content
    if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
        log_success "Database backup completed successfully"

        # Show warnings if any (but don't fail)
        if [ -s "$BACKUP_STDERR" ]; then
            log_warning "Backup completed with warnings:"
            grep -i "warning\|error" "$BACKUP_STDERR" | head -5 || true
        fi
    else
        log_error "Backup file not created or is empty"
        cat "$BACKUP_STDERR"
        rm -f "$BACKUP_STDERR"
        exit 1
    fi
    rm -f "$BACKUP_STDERR"

    # Get backup file size
    BACKUP_SIZE=$(du -h "$BACKUP_DIR" | cut -f1)
    log "Backup file size: ${BACKUP_SIZE}"

    # Compress backup
    log "Compressing backup file..."
    if gzip -f "$BACKUP_FILE"; then
        log_success "Backup compressed successfully"
        COMPRESSED_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)
        log "Compressed file size: ${COMPRESSED_SIZE}"
        log "Backup saved to: ${BACKUP_FILE_GZ}"
    else
        log_error "Failed to compress backup file"
        exit 1
    fi

    # Get table statistics
    log "Collecting database statistics..."
    TABLE_COUNT=$(PGPASSWORD="${DB_PASSWORD}" PGSSLMODE="require" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

    WAF_LOG_COUNT=$(PGPASSWORD="${DB_PASSWORD}" PGSSLMODE="require" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM waf_log;" 2>/dev/null | tr -d ' ' || echo "N/A")

    ANALYSIS_JOBS_COUNT=$(PGPASSWORD="${DB_PASSWORD}" PGSSLMODE="require" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM analysis_jobs;" 2>/dev/null | tr -d ' ' || echo "N/A")

    TIMELINE_COUNT=$(PGPASSWORD="${DB_PASSWORD}" PGSSLMODE="require" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM event_timeline;" 2>/dev/null | tr -d ' ' || echo "N/A")

    log "=========================================="
    log "Backup Statistics:"
    log "  - Total tables: ${TABLE_COUNT}"
    log "  - WAF log entries: ${WAF_LOG_COUNT}"
    log "  - Analysis jobs: ${ANALYSIS_JOBS_COUNT}"
    log "  - Timeline entries: ${TIMELINE_COUNT}"
    log "=========================================="

    # Clean up old backups (keep last 30 days)
    log "Cleaning up old backups (keeping last ${RETENTION_DAYS} days)..."
    DELETED_COUNT=0
    while IFS= read -r old_backup; do
        if [ -n "$old_backup" ]; then
            log_warning "Deleting old backup: $(basename "$old_backup")"
            rm -f "$old_backup"
            ((DELETED_COUNT++))
        fi
    done < <(find "$BACKUP_DIR" -name "soc_lite_backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS})

    if [ $DELETED_COUNT -gt 0 ]; then
        log_success "Deleted ${DELETED_COUNT} old backup(s)"
    else
        log "No old backups to delete"
    fi

    # List recent backups
    log "=========================================="
    log "Recent backups in ${BACKUP_DIR}:"
    find "$BACKUP_DIR" -name "soc_lite_backup_*.sql.gz" -type f -printf "%T@ %p\n" | sort -rn | head -5 | while read -r timestamp file; do
        SIZE=$(du -h "$file" | cut -f1)
        FILE_DATE=$(date -d "@${timestamp%.*}" "+%a %d %b %Y %H:%M:%S")
        echo "  $(basename "$file") (${SIZE}) - ${FILE_DATE}"
    done
    log "=========================================="

    log_success "Backup process completed successfully!"

else
    log_error "Database backup failed"
    # Clean up partial backup file if it exists
    [ -f "$BACKUP_FILE" ] && rm -f "$BACKUP_FILE"
    exit 1
fi

# Unset password
unset PGPASSWORD
unset PGSSLMODE

exit 0
