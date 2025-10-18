#!/bin/bash

# RDS Instance Status Script
# This script checks and displays the current status of the RDS PostgreSQL instance

# Configuration
DB_INSTANCE_ID="agentic-soc-agent"
REGION="${AWS_REGION:-us-east-1}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo "========================================="
echo "RDS Instance Status Check"
echo "========================================="
echo ""

# Get detailed instance information
INSTANCE_INFO=$(aws rds describe-db-instances \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --region "$REGION" \
    --query 'DBInstances[0]' \
    --output json 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Error: Failed to get DB instance information${NC}"
    echo "$INSTANCE_INFO"
    exit 1
fi

# Extract key information
STATUS=$(echo "$INSTANCE_INFO" | jq -r '.DBInstanceStatus')
ENGINE=$(echo "$INSTANCE_INFO" | jq -r '.Engine')
ENGINE_VERSION=$(echo "$INSTANCE_INFO" | jq -r '.EngineVersion')
INSTANCE_CLASS=$(echo "$INSTANCE_INFO" | jq -r '.DBInstanceClass')
STORAGE=$(echo "$INSTANCE_INFO" | jq -r '.AllocatedStorage')
STORAGE_TYPE=$(echo "$INSTANCE_INFO" | jq -r '.StorageType')
PUBLICLY_ACCESSIBLE=$(echo "$INSTANCE_INFO" | jq -r '.PubliclyAccessible')
MULTI_AZ=$(echo "$INSTANCE_INFO" | jq -r '.MultiAZ')
DB_NAME=$(echo "$INSTANCE_INFO" | jq -r '.DBName')
MASTER_USER=$(echo "$INSTANCE_INFO" | jq -r '.MasterUsername')
AVAILABILITY_ZONE=$(echo "$INSTANCE_INFO" | jq -r '.AvailabilityZone')
VPC_ID=$(echo "$INSTANCE_INFO" | jq -r '.DBSubnetGroup.VpcId')

# Get endpoint information (only if available)
ENDPOINT=$(echo "$INSTANCE_INFO" | jq -r '.Endpoint.Address // "N/A"')
PORT=$(echo "$INSTANCE_INFO" | jq -r '.Endpoint.Port // "N/A"')

# Determine status color and icon
case "$STATUS" in
    "available")
        STATUS_COLOR="$GREEN"
        STATUS_ICON="✓"
        STATUS_MESSAGE="Running"
        ;;
    "stopped")
        STATUS_COLOR="$RED"
        STATUS_ICON="●"
        STATUS_MESSAGE="Stopped"
        ;;
    "starting")
        STATUS_COLOR="$YELLOW"
        STATUS_ICON="⟳"
        STATUS_MESSAGE="Starting"
        ;;
    "stopping")
        STATUS_COLOR="$YELLOW"
        STATUS_ICON="⟳"
        STATUS_MESSAGE="Stopping"
        ;;
    "backing-up")
        STATUS_COLOR="$CYAN"
        STATUS_ICON="⟳"
        STATUS_MESSAGE="Backing Up"
        ;;
    "configuring-enhanced-monitoring")
        STATUS_COLOR="$YELLOW"
        STATUS_ICON="⟳"
        STATUS_MESSAGE="Configuring"
        ;;
    *)
        STATUS_COLOR="$BLUE"
        STATUS_ICON="◆"
        STATUS_MESSAGE="$STATUS"
        ;;
esac

# Display status header
echo -e "Instance ID:  ${CYAN}$DB_INSTANCE_ID${NC}"
echo -e "Status:       ${STATUS_COLOR}${STATUS_ICON} $STATUS_MESSAGE${NC}"
echo ""

# Display detailed information
echo "========================================="
echo "Instance Details"
echo "========================================="
echo -e "Engine:              ${BLUE}$ENGINE $ENGINE_VERSION${NC}"
echo -e "Instance Class:      $INSTANCE_CLASS"
echo -e "Storage:             ${STORAGE}GB ($STORAGE_TYPE)"
echo -e "Multi-AZ:            $MULTI_AZ"
echo -e "Publicly Accessible: $PUBLICLY_ACCESSIBLE"
echo -e "Availability Zone:   $AVAILABILITY_ZONE"
echo -e "VPC ID:              $VPC_ID"
echo ""

# Display connection information
echo "========================================="
echo "Connection Information"
echo "========================================="
echo -e "Database Name:  ${CYAN}$DB_NAME${NC}"
echo -e "Master User:    ${CYAN}$MASTER_USER${NC}"

if [ "$STATUS" = "available" ]; then
    echo -e "Endpoint:       ${GREEN}$ENDPOINT${NC}"
    echo -e "Port:           ${GREEN}$PORT${NC}"
    echo ""
    echo "Connection String:"
    echo -e "  ${CYAN}psql -h $ENDPOINT -p $PORT -U $MASTER_USER -d $DB_NAME${NC}"
else
    echo -e "Endpoint:       ${YELLOW}Not available (instance is $STATUS)${NC}"
    echo -e "Port:           ${YELLOW}N/A${NC}"
fi
echo ""

# Display available actions
echo "========================================="
echo "Available Actions"
echo "========================================="

if [ "$STATUS" = "available" ]; then
    echo -e "${GREEN}■${NC} Instance is running"
    echo "  • Test connection:  ./test-db.sh"
    echo "  • Stop instance:    ./stop_db.sh"
    echo "  • List WAF events:  ./list-waf-events.sh"
elif [ "$STATUS" = "stopped" ]; then
    echo -e "${RED}■${NC} Instance is stopped"
    echo "  • Start instance:   ./start_db.sh"
elif [ "$STATUS" = "starting" ]; then
    echo -e "${YELLOW}⟳${NC} Instance is starting..."
    echo "  • Wait for start:   ./start_db.sh (will wait)"
elif [ "$STATUS" = "stopping" ]; then
    echo -e "${YELLOW}⟳${NC} Instance is stopping..."
    echo "  • Wait for stop:    ./stop_db.sh (will wait)"
else
    echo -e "${BLUE}◆${NC} Instance status: $STATUS"
    echo "  • Check again:      ./status_db.sh"
fi

echo ""
echo "========================================="

exit 0
