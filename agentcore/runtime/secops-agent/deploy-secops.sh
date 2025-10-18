#!/bin/bash
#
# Deploy SecOps Agent to AWS AgentCore Runtime
# This script deploys secops_agent from /aws2/soc-lite/agentcore
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SecOps Agent Deployment${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RUNTIME_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
VENV_DIR="$RUNTIME_DIR/.venv"

echo -e "${YELLOW}Agent directory: $SCRIPT_DIR${NC}"
echo -e "${YELLOW}Runtime directory: $RUNTIME_DIR${NC}"
echo -e "${YELLOW}Virtual environment: $VENV_DIR${NC}\n"

# Check if source file exists
if [ ! -f "$SCRIPT_DIR/secops_agent.py" ]; then
    echo -e "${RED}Error: secops_agent.py not found in $SCRIPT_DIR${NC}"
    exit 1
fi

# Check if requirements.txt exists
if [ ! -f "$SCRIPT_DIR/requirements.txt" ]; then
    echo -e "${RED}Error: requirements.txt not found in $SCRIPT_DIR${NC}"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${RED}Error: Virtual environment not found at $VENV_DIR${NC}"
    echo -e "${YELLOW}Please run setup-venv.sh first:${NC}"
    echo -e "  cd $RUNTIME_DIR"
    echo -e "  ./setup-venv.sh"
    exit 1
fi

# Activate virtual environment
echo -e "${YELLOW}Activating virtual environment...${NC}"
source "$VENV_DIR/bin/activate"
echo -e "${GREEN}✓ Virtual environment activated${NC}\n"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check if agentcore CLI is installed
if ! command -v agentcore &> /dev/null; then
    echo -e "${RED}Error: agentcore CLI not found${NC}"
    echo "The virtual environment may not be properly activated"
    echo "Try: source $VENV_DIR/bin/activate"
    exit 1
fi

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

# Check for BACKEND_API_URL environment variable
if [ -z "$BACKEND_API_URL" ]; then
    echo -e "${YELLOW}Warning: BACKEND_API_URL not set${NC}"
    echo -e "${YELLOW}The agent will use default: https://aws1.c6web.com/api${NC}"
    echo -e "${YELLOW}To set a custom URL, export BACKEND_API_URL before running this script${NC}\n"
fi

# Install/update dependencies
echo -e "${YELLOW}Installing dependencies from requirements.txt...${NC}"
pip install -q -r "$SCRIPT_DIR/requirements.txt"
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# Deploy SecOps Agent
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying SecOps Agent${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Change to agent directory
cd "$SCRIPT_DIR"

# Configure if needed
if [ ! -f ".bedrock_agentcore.yaml" ]; then
    echo -e "${YELLOW}Configuring SecOps Agent...${NC}"
    agentcore configure --entrypoint secops_agent.py
    echo -e "${GREEN}✓ Configuration created${NC}\n"
fi

# Launch the agent
echo -e "${YELLOW}Launching SecOps Agent to AWS...${NC}"
SECOPS_OUTPUT=$(agentcore launch 2>&1 | tee /dev/tty)
SECOPS_AGENT_ARN=$(echo "$SECOPS_OUTPUT" | grep -oP 'arn:aws:bedrock-agentcore:[^:]+:[^:]+:agent-runtime/[a-zA-Z0-9_-]+' | head -1)

if [ -z "$SECOPS_AGENT_ARN" ]; then
    echo -e "${YELLOW}Warning: Could not extract ARN from launch output${NC}"
    echo -e "${YELLOW}Checking agentcore status...${NC}"
    SECOPS_AGENT_ARN=$(agentcore status 2>&1 | grep -oP 'arn:aws:bedrock-agentcore:[^:]+:[^:]+:agent-runtime/[a-zA-Z0-9_-]+' | head -1)
fi

if [ -z "$SECOPS_AGENT_ARN" ]; then
    echo -e "${RED}Failed to extract SecOps Agent ARN${NC}"
    echo -e "${YELLOW}Please check agentcore status manually:${NC}"
    echo -e "  agentcore status"
    exit 1
fi

echo -e "\n${GREEN}✓ SecOps Agent deployed successfully${NC}"
echo -e "  ARN: $SECOPS_AGENT_ARN\n"

# Save ARN to a file for easy reference
echo "$SECOPS_AGENT_ARN" > "$SCRIPT_DIR/.agent_arn"
echo -e "${GREEN}✓ ARN saved to .agent_arn${NC}\n"

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${GREEN}SecOps Agent ARN:${NC}"
echo -e "  $SECOPS_AGENT_ARN"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "  1. Update SECOPS_AGENT_ARN in your backend .env file:"
echo -e "     SECOPS_AGENT_ARN=$SECOPS_AGENT_ARN"
echo -e "  2. Redeploy backend Lambda functions that use this agent"
echo -e "  3. Test the agent with sample payloads"

echo -e "\n${GREEN}Test analyze workflow:${NC}"
echo -e "  agentcore invoke '{\"action\": \"analyze\", \"event\": {\"id\": 123, \"source_ip\": \"1.2.3.4\"}}'"

echo -e "\n${GREEN}Test monitor workflow:${NC}"
echo -e "  agentcore invoke '{\"action\": \"monitor\", \"hours\": 24}'"

echo -e "\n${GREEN}View logs:${NC}"
echo -e "  aws logs tail /aws/bedrock-agentcore/secops-agent --follow --region $AWS_REGION"

echo -e "\n${GREEN}Agent management:${NC}"
echo -e "  Status:  agentcore status"
echo -e "  Invoke:  agentcore invoke '<json_payload>'"
echo -e "  Delete:  agentcore delete"

echo -e "\n${GREEN}Done!${NC}\n"
