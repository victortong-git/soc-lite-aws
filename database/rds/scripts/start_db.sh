#!/bin/bash

# RDS Instance Start Script
# This script starts the RDS PostgreSQL instance

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
echo "RDS Instance Start Script"
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

# Check if already running
if [ "$CURRENT_STATUS" = "available" ]; then
    echo -e "${GREEN}✓ RDS instance is already running${NC}"

    # Get endpoint info
    ENDPOINT=$(aws rds describe-db-instances \
        --db-instance-identifier "$DB_INSTANCE_ID" \
        --region "$REGION" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)

    PORT=$(aws rds describe-db-instances \
        --db-instance-identifier "$DB_INSTANCE_ID" \
        --region "$REGION" \
        --query 'DBInstances[0].Endpoint.Port' \
        --output text)

    echo ""
    echo "========================================="
    echo "Database Connection Information"
    echo "========================================="
    echo "  Endpoint: $ENDPOINT"
    echo "  Port:     $PORT"
    echo "  Database: agentdb"
    echo "  User:     agenticsoc"
    echo "========================================="
    exit 0
fi

# Check if already starting
if [ "$CURRENT_STATUS" = "starting" ] || [ "$CURRENT_STATUS" = "configuring-enhanced-monitoring" ]; then
    echo -e "${YELLOW}⚠ RDS instance is already starting${NC}"
    echo "Waiting for it to become available..."
else
    # Start the instance
    if [ "$CURRENT_STATUS" = "stopped" ]; then
        echo -e "${YELLOW}Starting RDS instance...${NC}"

        START_OUTPUT=$(aws rds start-db-instance \
            --db-instance-identifier "$DB_INSTANCE_ID" \
            --region "$REGION" 2>&1)

        if [ $? -ne 0 ]; then
            echo -e "${RED}Error: Failed to start DB instance${NC}"
            echo "$START_OUTPUT"
            exit 1
        fi

        echo -e "${GREEN}✓ Start command issued successfully${NC}"
        echo ""
    else
        echo -e "${YELLOW}Current status: $CURRENT_STATUS${NC}"
        echo "Cannot start instance from this state"
        exit 1
    fi
fi

# Wait for instance to become available
echo -e "${YELLOW}Waiting for RDS instance to become available...${NC}"
echo "This typically takes 3-5 minutes"
echo ""

WAIT_COUNT=0
MAX_WAIT=90  # 15 minutes (90 * 10 seconds)

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier "$DB_INSTANCE_ID" \
        --region "$REGION" \
        --query 'DBInstances[0].DBInstanceStatus' \
        --output text)

    WAIT_COUNT=$((WAIT_COUNT + 1))
    ELAPSED=$((WAIT_COUNT * 10))

    echo -e "[${ELAPSED}s] Current status: ${BLUE}$STATUS${NC}"

    if [ "$STATUS" = "available" ]; then
        echo ""
        echo -e "${GREEN}✓ RDS instance is now available!${NC}"
        break
    fi

    if [ "$STATUS" = "stopped" ] || [ "$STATUS" = "stopping" ]; then
        echo ""
        echo -e "${RED}✗ RDS instance stopped or stopping${NC}"
        exit 1
    fi

    sleep 10
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo ""
    echo -e "${RED}✗ Timeout waiting for RDS instance to start${NC}"
    echo "Current status: $STATUS"
    exit 1
fi

# Get final endpoint information
echo ""
echo "========================================="
echo "RDS Instance Started Successfully"
echo "========================================="

ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --region "$REGION" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

PORT=$(aws rds describe-db-instances \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --region "$REGION" \
    --query 'DBInstances[0].Endpoint.Port' \
    --output text)

DB_ENGINE=$(aws rds describe-db-instances \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --region "$REGION" \
    --query 'DBInstances[0].[Engine,EngineVersion]' \
    --output text)

echo ""
echo "Connection Information:"
echo "  Endpoint:      $ENDPOINT"
echo "  Port:          $PORT"
echo "  Database:      agentdb"
echo "  User:          agenticsoc"
echo "  Engine:        $DB_ENGINE"
echo ""
echo "Test Connection:"
echo "  ./test-db.sh"
echo ""
echo "========================================="

exit 0
