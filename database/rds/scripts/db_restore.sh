#!/bin/bash

################################################################################
# PostgreSQL Database Restore Script for SOC-Lite RDS
#
# Description:
#   Restores a PostgreSQL database from a backup file created by db_backup.sh
#   - Supports compressed (.sql.gz) and uncompressed (.sql) backups
#   - Interactive mode with confirmation prompts
#   - Optional dry-run mode to preview without executing
#   - Pre-restore database validation
#   - Automatic backup before restore (safety feature)
#
# Usage:
#   ./db_restore.sh <backup_file> [OPTIONS]
#
# Options:
#   --dry-run        Preview restore without executing
#   --no-backup      Skip pre-restore backup (not recommended)
#   --force          Skip confirmation prompts
#
# Environment Variables (required):
#   DB_HOST     - Database hostname
#   DB_PORT     - Database port
#   DB_NAME     - Database name
#   DB_USER     - Database user
#   DB_PASSWORD - Database password
#
# Examples:
#   # Interactive restore with safety backup
#   ./db_restore.sh /aws/db_backup/soc_lite_backup_20251011_120000.sql.gz
#
#   # Dry-run to preview
#   ./db_restore.sh /aws/db_backup/soc_lite_backup_20251011_120000.sql.gz --dry-run
#
#   # Force restore without prompts (use with caution)
#   ./db_restore.sh /aws/db_backup/soc_lite_backup_20251011_120000.sql.gz --force
#
#   # Restore latest backup
#   ./db_restore.sh $(ls -t /aws/db_backup/soc_lite_backup_*.sql.gz | head -1)
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
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Use DB config from .env (fallback to defaults for DB_NAME if not critical)
DB_NAME="${DB_NAME:-postgres}"

# Default options
DRY_RUN=false
SKIP_BACKUP=false
FORCE=false
BACKUP_DIR="/aws/db_backup"

# Log functions
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

log_info() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] ℹ${NC} $1"
}

# Usage function
usage() {
    cat << EOF
Usage: $0 <backup_file> [OPTIONS]

Options:
  --dry-run        Preview restore without executing
  --no-backup      Skip pre-restore backup (not recommended)
  --force          Skip confirmation prompts
  -h, --help       Show this help message

Examples:
  $0 /aws/db_backup/soc_lite_backup_20251011_120000.sql.gz
  $0 /aws/db_backup/soc_lite_backup_20251011_120000.sql.gz --dry-run
  $0 \$(ls -t /aws/db_backup/soc_lite_backup_*.sql.gz | head -1) --force

EOF
    exit 1
}

# Parse arguments
if [ $# -eq 0 ]; then
    log_error "No backup file specified"
    usage
fi

BACKUP_FILE=""

while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$1"
            else
                log_error "Unknown option: $1"
                usage
            fi
            shift
            ;;
    esac
done

# Validate backup file
if [ -z "$BACKUP_FILE" ]; then
    log_error "No backup file specified"
    usage
fi

if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
    log_error "psql command not found. Please install postgresql-client."
    exit 1
fi

# Export password for psql
export PGPASSWORD="${DB_PASSWORD}"
export PGSSLMODE="require"

# Determine if file is compressed
IS_COMPRESSED=false
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
    IS_COMPRESSED=true
    if ! command -v gunzip &> /dev/null; then
        log_error "gunzip command not found. Cannot decompress backup file."
        exit 1
    fi
fi

log "=========================================="
log "SOC-Lite Database Restore"
log "=========================================="
log "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
log "User: ${DB_USER}"
log "Backup file: ${BACKUP_FILE}"
log "File size: $(du -h "$BACKUP_FILE" | cut -f1)"
log "Compressed: ${IS_COMPRESSED}"
log "Dry-run mode: ${DRY_RUN}"
log "Skip pre-restore backup: ${SKIP_BACKUP}"
log "=========================================="

# Test database connection
log "Testing database connection..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    log_success "Database connection successful"
else
    log_error "Failed to connect to database"
    unset PGPASSWORD PGSSLMODE
    exit 1
fi

# Get current database statistics
log "Collecting current database statistics..."
CURRENT_TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

CURRENT_WAF_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM waf_log;" 2>/dev/null | tr -d ' ' || echo "0")

CURRENT_JOBS_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM analysis_jobs;" 2>/dev/null | tr -d ' ' || echo "0")

log "=========================================="
log "Current Database State:"
log "  - Tables: ${CURRENT_TABLE_COUNT}"
log "  - WAF logs: ${CURRENT_WAF_COUNT}"
log "  - Analysis jobs: ${CURRENT_JOBS_COUNT}"
log "=========================================="

# Confirmation prompt
if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
    log_warning "WARNING: This will OVERWRITE the current database!"
    log_warning "All existing data will be REPLACED with backup data."
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " -r CONFIRM
    if [[ ! $CONFIRM =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Restore cancelled by user"
        unset PGPASSWORD PGSSLMODE
        exit 0
    fi
fi

# Create pre-restore backup
if [ "$SKIP_BACKUP" = false ] && [ "$DRY_RUN" = false ]; then
    log "Creating pre-restore backup for safety..."
    PRERESTORE_BACKUP="${BACKUP_DIR}/prerestore_backup_$(date +"%Y%m%d_%H%M%S").sql.gz"

    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --format=plain --no-owner --no-privileges 2>/dev/null | gzip > "$PRERESTORE_BACKUP"; then
        log_success "Pre-restore backup saved to: $PRERESTORE_BACKUP"
    else
        log_error "Failed to create pre-restore backup"
        unset PGPASSWORD PGSSLMODE
        exit 1
    fi
fi

if [ "$DRY_RUN" = true ]; then
    log_info "DRY-RUN MODE: No changes will be made"
    log "Would decompress: ${IS_COMPRESSED}"
    log "Would restore to: ${DB_NAME}@${DB_HOST}"
    log "Would drop existing tables and recreate from backup"
    log_success "Dry-run completed successfully"
    unset PGPASSWORD PGSSLMODE
    exit 0
fi

# Perform restore
log "Starting database restore..."

if [ "$IS_COMPRESSED" = true ]; then
    log "Decompressing and restoring backup..."

    if gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 > /dev/null 2>&1; then
        log_success "Database restore completed successfully"
    else
        log_error "Database restore failed"
        log_error "Your database may be in an inconsistent state!"
        if [ "$SKIP_BACKUP" = false ]; then
            log_warning "Pre-restore backup available at: $PRERESTORE_BACKUP"
            log_info "To rollback, run: $0 $PRERESTORE_BACKUP --force"
        fi
        unset PGPASSWORD PGSSLMODE
        exit 1
    fi
else
    log "Restoring uncompressed backup..."

    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$BACKUP_FILE" > /dev/null 2>&1; then
        log_success "Database restore completed successfully"
    else
        log_error "Database restore failed"
        log_error "Your database may be in an inconsistent state!"
        if [ "$SKIP_BACKUP" = false ]; then
            log_warning "Pre-restore backup available at: $PRERESTORE_BACKUP"
            log_info "To rollback, run: $0 $PRERESTORE_BACKUP --force"
        fi
        unset PGPASSWORD PGSSLMODE
        exit 1
    fi
fi

# Get restored database statistics
log "Collecting restored database statistics..."
RESTORED_TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

RESTORED_WAF_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM waf_log;" 2>/dev/null | tr -d ' ' || echo "0")

RESTORED_JOBS_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM analysis_jobs;" 2>/dev/null | tr -d ' ' || echo "0")

log "=========================================="
log "Restored Database State:"
log "  - Tables: ${RESTORED_TABLE_COUNT}"
log "  - WAF logs: ${RESTORED_WAF_COUNT}"
log "  - Analysis jobs: ${RESTORED_JOBS_COUNT}"
log "=========================================="

# Verify restore
log "Verifying restore..."
VERIFY_ERRORS=0

if [ "$RESTORED_TABLE_COUNT" -lt 3 ]; then
    log_warning "Expected at least 3 tables, found ${RESTORED_TABLE_COUNT}"
    ((VERIFY_ERRORS++))
fi

if [ "$VERIFY_ERRORS" -gt 0 ]; then
    log_warning "Restore verification found ${VERIFY_ERRORS} warning(s)"
    log_warning "Please verify database manually"
else
    log_success "Restore verification passed"
fi

log "=========================================="
log_success "Restore process completed successfully!"

if [ "$SKIP_BACKUP" = false ]; then
    log_info "Pre-restore backup saved at: $PRERESTORE_BACKUP"
fi

log "=========================================="

# Unset password
unset PGPASSWORD
unset PGSSLMODE

exit 0
