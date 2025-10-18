#!/bin/bash
# Quick script to run database migrations only
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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

echo "🔄 Running Database Migrations..."
echo "Database: $DB_HOST"
echo "Database Name: $DB_NAME"
echo ""

# Discover all migration files (excluding rollback files)
DB_MIGRATION_FILES=()
MIGRATION_DIR="$PROJECT_ROOT/database/migrations"

if [ ! -d "$MIGRATION_DIR" ]; then
    echo -e "${RED}✗ Migration directory not found: $MIGRATION_DIR${NC}"
    exit 1
fi

while IFS= read -r -d '' file; do
    DB_MIGRATION_FILES+=("$file")
done < <(find "$MIGRATION_DIR" -name "*.sql" ! -name "*_rollback.sql" -print0 | sort -z)

echo "Found ${#DB_MIGRATION_FILES[@]} migration files:"
for file in "${DB_MIGRATION_FILES[@]}"; do
    echo "  - $(basename $file)"
done
echo ""

MIGRATION_FAILED=0
for DB_MIGRATION_FILE in "${DB_MIGRATION_FILES[@]}"; do
    if [ -f "$DB_MIGRATION_FILE" ]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Applying: $(basename $DB_MIGRATION_FILE)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Run migration with SSL
        PGPASSWORD="$DB_PASSWORD" psql \
            "sslmode=require host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER" \
            -f "$DB_MIGRATION_FILE" 2>&1

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Success: $(basename $DB_MIGRATION_FILE)${NC}"
        else
            echo -e "${RED}✗ Failed: $(basename $DB_MIGRATION_FILE)${NC}"
            MIGRATION_FAILED=1
        fi
        echo ""
    fi
done

if [ $MIGRATION_FAILED -eq 1 ]; then
    echo -e "${RED}✗ Some migrations failed${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All migrations applied successfully!${NC}"
fi
