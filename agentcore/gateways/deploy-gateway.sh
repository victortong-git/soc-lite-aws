#!/bin/bash
#
# Deploy AgentCore Gateway
# This script creates and configures the AgentCore Gateway for SOC Lite agents
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AgentCore Gateway Deployment${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
API_SPEC="$SCRIPT_DIR/agent-actions-api.yaml"

echo -e "${YELLOW}Gateway directory: $SCRIPT_DIR${NC}"
echo -e "${YELLOW}API specification: $API_SPEC${NC}\n"

# Check if API spec exists
if [ ! -f "$API_SPEC" ]; then
    echo -e "${RED}Error: API specification not found at $API_SPEC${NC}"
    exit 1
fi

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not found${NC}"
    echo "Please install AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    echo "Please run: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo -e "  Account: $ACCOUNT_ID"
echo -e "  Region: $AWS_REGION\n"

# Get backend API URL
echo -e "${YELLOW}Backend API Configuration${NC}"
echo -e "Enter your backend API URL (e.g., https://api.example.com)"
read -p "Backend API URL: " BACKEND_API_URL

if [ -z "$BACKEND_API_URL" ]; then
    echo -e "${RED}Error: Backend API URL is required${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Backend API URL: $BACKEND_API_URL${NC}\n"

# Gateway name
GATEWAY_NAME="soc-lite-gateway"
echo -e "${YELLOW}Gateway name: $GATEWAY_NAME${NC}\n"

# Check if agentcore CLI is available
if command -v agentcore &> /dev/null; then
    echo -e "${GREEN}Using agentcore CLI for deployment${NC}\n"
    USE_CLI=true
else
    echo -e "${YELLOW}agentcore CLI not found, will use AWS CLI${NC}\n"
    USE_CLI=false
fi

# Deploy gateway
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Creating AgentCore Gateway${NC}"
echo -e "${GREEN}========================================${NC}\n"

if [ "$USE_CLI" = true ]; then
    # Using agentcore CLI (if available)
    echo -e "${YELLOW}Creating gateway with agentcore CLI...${NC}"
    
    GATEWAY_OUTPUT=$(agentcore gateway create \
        --name "$GATEWAY_NAME" \
        --api-spec "$API_SPEC" \
        --backend-url "$BACKEND_API_URL" \
        --region "$AWS_REGION" 2>&1 | tee /dev/tty)
    
    # Extract gateway ID
    GATEWAY_ID=$(echo "$GATEWAY_OUTPUT" | grep -oP 'gateway-[a-zA-Z0-9-]+' | head -1)
    
else
    # Using AWS CLI (manual approach)
    echo -e "${YELLOW}Creating gateway with AWS CLI...${NC}"
    echo -e "${YELLOW}Note: This requires manual configuration in AWS Console${NC}\n"
    
    echo -e "${BLUE}Manual Steps Required:${NC}"
    echo -e "1. Go to AWS Bedrock Console → AgentCore → Gateways"
    echo -e "2. Click 'Create Gateway'"
    echo -e "3. Gateway name: $GATEWAY_NAME"
    echo -e "4. Upload API spec: $API_SPEC"
    echo -e "5. Backend URL: $BACKEND_API_URL"
    echo -e "6. Configure OAuth 2.0 (Client Credentials)"
    echo -e "7. Note the Gateway ID and OAuth credentials\n"
    
    read -p "Press Enter after creating the gateway in AWS Console..."
    echo ""
    
    read -p "Enter the Gateway ID: " GATEWAY_ID
fi

if [ -z "$GATEWAY_ID" ]; then
    echo -e "${RED}Failed to get Gateway ID${NC}"
    echo -e "${YELLOW}Please check AWS Console for gateway status${NC}"
    exit 1
fi

echo -e "\n${GREEN}✓ Gateway created successfully${NC}"
echo -e "  Gateway ID: $GATEWAY_ID\n"

# Save gateway configuration
CONFIG_FILE="$SCRIPT_DIR/.gateway_config"
cat > "$CONFIG_FILE" << EOF
# AgentCore Gateway Configuration
# Generated: $(date)

GATEWAY_ID=$GATEWAY_ID
GATEWAY_NAME=$GATEWAY_NAME
BACKEND_API_URL=$BACKEND_API_URL
AWS_REGION=$AWS_REGION
AWS_ACCOUNT_ID=$ACCOUNT_ID
EOF

echo -e "${GREEN}✓ Gateway configuration saved to .gateway_config${NC}\n"

# OAuth Configuration
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}OAuth 2.0 Configuration${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${YELLOW}OAuth credentials are required for agents to authenticate${NC}"
echo -e "${YELLOW}You can find these in the AWS Bedrock Console → Gateway → OAuth${NC}\n"

read -p "Enter OAuth Client ID: " OAUTH_CLIENT_ID
read -p "Enter OAuth Client Secret: " OAUTH_CLIENT_SECRET

if [ -n "$OAUTH_CLIENT_ID" ] && [ -n "$OAUTH_CLIENT_SECRET" ]; then
    # Save OAuth credentials securely
    cat >> "$CONFIG_FILE" << EOF

# OAuth Configuration
OAUTH_CLIENT_ID=$OAUTH_CLIENT_ID
OAUTH_CLIENT_SECRET=***REDACTED***
EOF
    
    # Save full credentials to a separate secure file
    OAUTH_FILE="$SCRIPT_DIR/.oauth_credentials"
    cat > "$OAUTH_FILE" << EOF
# OAuth Credentials - KEEP SECURE!
# Generated: $(date)

OAUTH_CLIENT_ID=$OAUTH_CLIENT_ID
OAUTH_CLIENT_SECRET=$OAUTH_CLIENT_SECRET
EOF
    
    chmod 600 "$OAUTH_FILE"
    
    echo -e "${GREEN}✓ OAuth credentials saved to .oauth_credentials${NC}"
    echo -e "${YELLOW}⚠ Keep .oauth_credentials secure! Add to .gitignore${NC}\n"
else
    echo -e "${YELLOW}⚠ OAuth credentials not provided${NC}"
    echo -e "${YELLOW}You'll need to configure these manually later${NC}\n"
fi

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${GREEN}Gateway Configuration:${NC}"
echo -e "  Gateway ID:   $GATEWAY_ID"
echo -e "  Gateway Name: $GATEWAY_NAME"
echo -e "  Backend URL:  $BACKEND_API_URL"
echo -e "  Region:       $AWS_REGION"

if [ -n "$OAUTH_CLIENT_ID" ]; then
    echo -e "\n${GREEN}OAuth Configuration:${NC}"
    echo -e "  Client ID:    $OAUTH_CLIENT_ID"
    echo -e "  Client Secret: ***REDACTED***"
fi

echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "  1. Update agent configurations with gateway ID:"
echo -e "     ./configure-agents.sh"
echo -e "  2. Redeploy agents with gateway configuration:"
echo -e "     cd ../runtime && ./deploy-agents.sh"
echo -e "  3. Test gateway connectivity:"
echo -e "     ./test-gateway.sh"

echo -e "\n${GREEN}Configuration Files:${NC}"
echo -e "  Gateway config: .gateway_config"
if [ -f "$OAUTH_FILE" ]; then
    echo -e "  OAuth creds:    .oauth_credentials (KEEP SECURE!)"
fi

echo -e "\n${GREEN}View gateway status:${NC}"
echo -e "  aws bedrock-agent get-agent-gateway --gateway-id $GATEWAY_ID --region $AWS_REGION"

echo -e "\n${GREEN}Done!${NC}\n"
