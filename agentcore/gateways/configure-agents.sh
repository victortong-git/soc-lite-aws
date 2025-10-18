#!/bin/bash
#
# Configure Agents with Gateway
# This script updates agent configurations to use the deployed gateway
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Configure Agents with Gateway${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RUNTIME_DIR="$SCRIPT_DIR/../runtime"
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
echo -e "  Gateway Name: $GATEWAY_NAME"
echo -e "  Backend URL:  $BACKEND_API_URL\n"

# Load OAuth credentials if available
if [ -f "$OAUTH_FILE" ]; then
    source "$OAUTH_FILE"
    echo -e "${GREEN}✓ OAuth credentials loaded${NC}\n"
else
    echo -e "${YELLOW}⚠ OAuth credentials not found${NC}"
    read -p "Enter OAuth Client ID: " OAUTH_CLIENT_ID
    read -p "Enter OAuth Client Secret: " OAUTH_CLIENT_SECRET
    echo ""
fi

# Check if runtime directory exists
if [ ! -d "$RUNTIME_DIR" ]; then
    echo -e "${RED}Error: Runtime directory not found at $RUNTIME_DIR${NC}"
    exit 1
fi

# Configure agents
echo -e "${GREEN}Configuring agents...${NC}\n"

AGENTS=("bulk-analysis-agent" "secops-agent")

for agent in "${AGENTS[@]}"; do
    AGENT_DIR="$RUNTIME_DIR/$agent"
    CONFIG_FILE_AGENT="$AGENT_DIR/.bedrock_agentcore.yaml"
    
    if [ ! -d "$AGENT_DIR" ]; then
        echo -e "${YELLOW}⚠ Agent directory not found: $agent${NC}"
        continue
    fi
    
    echo -e "${YELLOW}Configuring $agent...${NC}"
    
    # Create or update agent configuration
    if [ -f "$CONFIG_FILE_AGENT" ]; then
        echo -e "${YELLOW}  Updating existing configuration${NC}"
        # Backup existing config
        cp "$CONFIG_FILE_AGENT" "${CONFIG_FILE_AGENT}.backup"
    else
        echo -e "${YELLOW}  Creating new configuration${NC}"
    fi
    
    # Add gateway configuration to agent config
    cat >> "$CONFIG_FILE_AGENT" << EOF

# Gateway Configuration (added by configure-agents.sh)
gateway:
  gateway_id: $GATEWAY_ID
  backend_url: $BACKEND_API_URL
  oauth:
    client_id: $OAUTH_CLIENT_ID
    client_secret: $OAUTH_CLIENT_SECRET
    token_url: https://bedrock-agentcore-oauth.${AWS_REGION}.amazonaws.com/token
EOF
    
    echo -e "${GREEN}  ✓ $agent configured${NC}"
    echo -e "    Config: $CONFIG_FILE_AGENT\n"
done

# Create environment file for agents
ENV_FILE="$RUNTIME_DIR/.gateway_env"
cat > "$ENV_FILE" << EOF
# Gateway Environment Variables
# Source this file before deploying agents: source .gateway_env

export GATEWAY_ID=$GATEWAY_ID
export GATEWAY_NAME=$GATEWAY_NAME
export BACKEND_API_URL=$BACKEND_API_URL
export OAUTH_CLIENT_ID=$OAUTH_CLIENT_ID
export OAUTH_CLIENT_SECRET=$OAUTH_CLIENT_SECRET
export AWS_REGION=$AWS_REGION
EOF

echo -e "${GREEN}✓ Environment file created: $ENV_FILE${NC}\n"

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Configuration Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${GREEN}Configured Agents:${NC}"
for agent in "${AGENTS[@]}"; do
    if [ -f "$RUNTIME_DIR/$agent/.bedrock_agentcore.yaml" ]; then
        echo -e "  ✓ $agent"
    fi
done

echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "  1. Review agent configurations:"
echo -e "     cat $RUNTIME_DIR/bulk-analysis-agent/.bedrock_agentcore.yaml"
echo -e "     cat $RUNTIME_DIR/secops-agent/.bedrock_agentcore.yaml"
echo -e "  2. Redeploy agents with gateway configuration:"
echo -e "     cd $RUNTIME_DIR"
echo -e "     source .gateway_env"
echo -e "     ./deploy-agents.sh"
echo -e "  3. Test gateway connectivity:"
echo -e "     cd $SCRIPT_DIR"
echo -e "     ./test-gateway.sh"

echo -e "\n${GREEN}Done!${NC}\n"
