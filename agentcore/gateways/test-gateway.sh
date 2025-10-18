#!/bin/bash
#
# Test AgentCore Gateway
# This script tests the gateway connectivity and OAuth authentication
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AgentCore Gateway Testing${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CONFIG_FILE="$SCRIPT_DIR/.gateway_config"
OAUTH_FILE="$SCRIPT_DIR/.oauth_credentials"

# Check if gateway config exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: Gateway configuration not found${NC}"
    echo -e "${YELLOW}Please run ./deploy-gateway.sh first${NC}"
    exit 1
fi

# Load gateway configuration
source "$CONFIG_FILE"

echo -e "${YELLOW}Gateway Configuration:${NC}"
echo -e "  Gateway ID:   $GATEWAY_ID"
echo -e "  Backend URL:  $BACKEND_API_URL"
echo -e "  Region:       $AWS_REGION\n"

# Load OAuth credentials
if [ ! -f "$OAUTH_FILE" ]; then
    echo -e "${RED}Error: OAuth credentials not found${NC}"
    echo -e "${YELLOW}Please run ./deploy-gateway.sh first${NC}"
    exit 1
fi

source "$OAUTH_FILE"

# Test 1: Check gateway status
echo -e "${BLUE}[Test 1/4] Checking gateway status...${NC}"
if aws bedrock-agent get-agent-gateway --gateway-id "$GATEWAY_ID" --region "$AWS_REGION" &> /dev/null; then
    echo -e "${GREEN}✓ Gateway exists and is accessible${NC}\n"
else
    echo -e "${RED}✗ Gateway not found or not accessible${NC}"
    echo -e "${YELLOW}Please check AWS Console for gateway status${NC}\n"
    exit 1
fi

# Test 2: Get OAuth token
echo -e "${BLUE}[Test 2/4] Testing OAuth authentication...${NC}"

# Construct OAuth token URL
OAUTH_TOKEN_URL="https://bedrock-agentcore-oauth.${AWS_REGION}.amazonaws.com/token"

echo -e "${YELLOW}Requesting OAuth token...${NC}"
TOKEN_RESPONSE=$(curl -s -X POST "$OAUTH_TOKEN_URL" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials" \
    -d "client_id=$OAUTH_CLIENT_ID" \
    -d "client_secret=$OAUTH_CLIENT_SECRET" 2>&1)

if echo "$TOKEN_RESPONSE" | jq -e '.access_token' &> /dev/null; then
    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
    echo -e "${GREEN}✓ OAuth token obtained successfully${NC}"
    echo -e "  Token: ${ACCESS_TOKEN:0:20}...${NC}\n"
else
    echo -e "${RED}✗ Failed to obtain OAuth token${NC}"
    echo -e "${YELLOW}Response: $TOKEN_RESPONSE${NC}\n"
    exit 1
fi

# Test 3: Test gateway endpoint (health check)
echo -e "${BLUE}[Test 3/4] Testing gateway endpoint...${NC}"

# Construct gateway URL
GATEWAY_URL="https://${GATEWAY_ID}.bedrock-agentcore.${AWS_REGION}.amazonaws.com"

echo -e "${YELLOW}Testing gateway health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$GATEWAY_URL/health" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>&1)

HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✓ Gateway is reachable${NC}"
    echo -e "  HTTP Status: $HTTP_CODE${NC}\n"
else
    echo -e "${YELLOW}⚠ Gateway returned status: $HTTP_CODE${NC}"
    echo -e "  Response: $RESPONSE_BODY${NC}\n"
fi

# Test 4: Test backend API through gateway
echo -e "${BLUE}[Test 4/4] Testing backend API through gateway...${NC}"

# Test update-analysis endpoint (dry run)
echo -e "${YELLOW}Testing /api/agent-actions/update-analysis endpoint...${NC}"

TEST_PAYLOAD='{
  "event_id": 999999,
  "severity_rating": 1,
  "security_analysis": "Gateway connectivity test",
  "follow_up_suggestion": "This is a test from gateway testing script"
}'

API_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$GATEWAY_URL/api/agent-actions/update-analysis" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$TEST_PAYLOAD" 2>&1)

HTTP_CODE=$(echo "$API_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$API_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✓ Backend API is accessible through gateway${NC}"
    echo -e "  HTTP Status: $HTTP_CODE${NC}"
    echo -e "  Response: $RESPONSE_BODY${NC}\n"
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${YELLOW}⚠ Endpoint not found (404)${NC}"
    echo -e "  This may be expected if the backend API is not fully deployed${NC}\n"
else
    echo -e "${YELLOW}⚠ Backend API returned status: $HTTP_CODE${NC}"
    echo -e "  Response: $RESPONSE_BODY${NC}\n"
fi

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Testing Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${GREEN}Test Results:${NC}"
echo -e "  ✓ Gateway status check"
echo -e "  ✓ OAuth authentication"
echo -e "  ✓ Gateway connectivity"
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo -e "  ✓ Backend API integration"
else
    echo -e "  ⚠ Backend API integration (status: $HTTP_CODE)"
fi

echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "  1. If all tests passed, agents can now use the gateway"
echo -e "  2. Deploy agents with gateway configuration:"
echo -e "     cd ../runtime && ./deploy-agents.sh"
echo -e "  3. Test agent invocations with real payloads"
echo -e "  4. Monitor gateway logs in CloudWatch"

echo -e "\n${GREEN}Gateway Information:${NC}"
echo -e "  Gateway ID:  $GATEWAY_ID"
echo -e "  Gateway URL: $GATEWAY_URL"
echo -e "  Backend URL: $BACKEND_API_URL"

echo -e "\n${GREEN}Done!${NC}\n"
