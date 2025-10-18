#!/bin/bash

# RDS Instance Stop Script
# This script stops the RDS PostgreSQL instance

set -e

# Configuration
DB_INSTANCE_ID="agentic-soc-agent"
REGION="${AWS_REGION:-us-east-1}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================="
echo "RDS Instance Stop Script"
echo "Instance: $DB_INSTANCE_ID"
echo "Region: $REGION"
echo "========================================="
echo ""

# Check current status
echo -e "${YELLOW}Checking current RDS instance status...${NC}"
CURRENT_STATUS=$(aws rds describe-db-instances \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --region "$REGION" \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to describe DB instance${NC}"
    echo "$CURRENT_STATUS"
    exit 1
fi

echo -e "Current Status: ${BLUE}$CURRENT_STATUS${NC}"
echo ""

# Check if already stopped
if [ "$CURRENT_STATUS" = "stopped" ]; then
    echo -e "${GREEN}✓ RDS instance is already stopped${NC}"
    echo ""
    echo "To start the instance, run:"
    echo "  ./start_db.sh"
    echo ""
    exit 0
fi

# Check if already stopping
if [ "$CURRENT_STATUS" = "stopping" ]; then
    echo -e "${YELLOW}⚠ RDS instance is already stopping${NC}"
    echo "Waiting for it to stop completely..."
else
    # Check if instance can be stopped
    if [ "$CURRENT_STATUS" != "available" ]; then
        echo -e "${YELLOW}Current status: $CURRENT_STATUS${NC}"
        echo -e "${YELLOW}⚠ Warning: Instance is not in 'available' state${NC}"
        echo ""
        read -p "Do you want to attempt to stop it anyway? (yes/no): " CONFIRM

        if [ "$CONFIRM" != "yes" ]; then
            echo "Operation cancelled"
            exit 0
        fi
        echo ""
    fi

    # Stop the instance
    echo -e "${YELLOW}Stopping RDS instance...${NC}"

    STOP_OUTPUT=$(aws rds stop-db-instance \
        --db-instance-identifier "$DB_INSTANCE_ID" \
        --region "$REGION" 2>&1)

    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to stop DB instance${NC}"
        echo "$STOP_OUTPUT"

        # Check if it's because of automated backups
        if echo "$STOP_OUTPUT" | grep -q "backup"; then
            echo ""
            echo -e "${YELLOW}Note: You may need to disable automated backups to stop this instance${NC}"
        fi

        exit 1
    fi

    echo -e "${GREEN}✓ Stop command issued successfully${NC}"
    echo ""
fi

# Wait for instance to stop
echo -e "${YELLOW}Waiting for RDS instance to stop...${NC}"
echo "This typically takes 2-3 minutes"
echo ""

WAIT_COUNT=0
MAX_WAIT=36  # 6 minutes (36 * 10 seconds)

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier "$DB_INSTANCE_ID" \
        --region "$REGION" \
        --query 'DBInstances[0].DBInstanceStatus' \
        --output text)

    WAIT_COUNT=$((WAIT_COUNT + 1))
    ELAPSED=$((WAIT_COUNT * 10))

    echo -e "[${ELAPSED}s] Current status: ${BLUE}$STATUS${NC}"

    if [ "$STATUS" = "stopped" ]; then
        echo ""
        echo -e "${GREEN}✓ RDS instance has been stopped successfully!${NC}"
        break
    fi

    if [ "$STATUS" = "available" ] || [ "$STATUS" = "starting" ]; then
        echo ""
        echo -e "${RED}✗ RDS instance did not stop (status: $STATUS)${NC}"
        exit 1
    fi

    sleep 10
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo ""
    echo -e "${RED}✗ Timeout waiting for RDS instance to stop${NC}"
    echo "Current status: $STATUS"
    exit 1
fi

# Get final information
echo ""
echo "========================================="
echo "RDS Instance Stopped Successfully"
echo "========================================="
echo ""
echo "Instance: $DB_INSTANCE_ID"
echo "Status:   stopped"
echo ""
echo "To start the instance again, run:"
echo "  ./start_db.sh"
echo ""
echo "Note: AWS will automatically start the instance"
echo "after 7 days if it remains stopped."
echo ""
echo "========================================="

exit 0
