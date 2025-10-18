#!/bin/bash
#
# Deploy Bulk Analysis Agent to AWS AgentCore Runtime
# This script deploys bulk_analysis_agent from /aws2/soc-lite/agentcore
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Bulk Analysis Agent Deployment${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RUNTIME_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
VENV_DIR="$RUNTIME_DIR/.venv"

echo -e "${YELLOW}Agent directory: $SCRIPT_DIR${NC}"
echo -e "${YELLOW}Runtime directory: $RUNTIME_DIR${NC}"
echo -e "${YELLOW}Virtual environment: $VENV_DIR${NC}\n"

# Check if source file exists
if [ ! -f "$SCRIPT_DIR/bulk_analysis_agent.py" ]; then
    echo -e "${RED}Error: bulk_analysis_agent.py not found in $SCRIPT_DIR${NC}"
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

# Install/update dependencies
echo -e "${YELLOW}Installing dependencies from requirements.txt...${NC}"
pip install -q -r "$SCRIPT_DIR/requirements.txt"
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# Deploy Bulk Analysis Agent
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying Bulk Analysis Agent${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Change to agent directory
cd "$SCRIPT_DIR"

# Configure if needed
if [ ! -f ".bedrock_agentcore.yaml" ]; then
    echo -e "${YELLOW}Configuring Bulk Analysis Agent...${NC}"
    agentcore configure --entrypoint bulk_analysis_agent.py
    echo -e "${GREEN}✓ Configuration created${NC}\n"
fi

# Launch the agent
echo -e "${YELLOW}Launching Bulk Analysis Agent to AWS...${NC}"
BULK_ANALYSIS_OUTPUT=$(agentcore launch 2>&1 | tee /dev/tty)
BULK_ANALYSIS_AGENT_ARN=$(echo "$BULK_ANALYSIS_OUTPUT" | grep -oP 'arn:aws:bedrock-agentcore:[^:]+:[^:]+:agent-runtime/[a-zA-Z0-9_-]+' | head -1)

if [ -z "$BULK_ANALYSIS_AGENT_ARN" ]; then
    echo -e "${YELLOW}Warning: Could not extract ARN from launch output${NC}"
    echo -e "${YELLOW}Checking agentcore status...${NC}"
    BULK_ANALYSIS_AGENT_ARN=$(agentcore status 2>&1 | grep -oP 'arn:aws:bedrock-agentcore:[^:]+:[^:]+:agent-runtime/[a-zA-Z0-9_-]+' | head -1)
fi

if [ -z "$BULK_ANALYSIS_AGENT_ARN" ]; then
    echo -e "${RED}Failed to extract Bulk Analysis Agent ARN${NC}"
    echo -e "${YELLOW}Please check agentcore status manually:${NC}"
    echo -e "  agentcore status"
    exit 1
fi

echo -e "\n${GREEN}✓ Bulk Analysis Agent deployed successfully${NC}"
echo -e "  ARN: $BULK_ANALYSIS_AGENT_ARN\n"

# Save ARN to a file for easy reference
echo "$BULK_ANALYSIS_AGENT_ARN" > "$SCRIPT_DIR/.agent_arn"
echo -e "${GREEN}✓ ARN saved to .agent_arn${NC}\n"

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${GREEN}Bulk Analysis Agent ARN:${NC}"
echo -e "  $BULK_ANALYSIS_AGENT_ARN"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "  1. Update BULK_ANALYSIS_AGENT_ARN in your backend .env file:"
echo -e "     BULK_ANALYSIS_AGENT_ARN=$BULK_ANALYSIS_AGENT_ARN"
echo -e "  2. Redeploy smart-analysis-worker Lambda if needed"
echo -e "  3. Test the agent with: agentcore invoke '{\"test\": \"payload\"}'"

echo -e "\n${GREEN}View logs:${NC}"
echo -e "  aws logs tail /aws/bedrock-agentcore/bulk-analysis-agent --follow --region $AWS_REGION"

echo -e "\n${GREEN}Agent management:${NC}"
echo -e "  Status:  agentcore status"
echo -e "  Invoke:  agentcore invoke '{\"summary\": {...}, \"events\": [...]}'"
echo -e "  Delete:  agentcore delete"

echo -e "\n${GREEN}Done!${NC}\n"
