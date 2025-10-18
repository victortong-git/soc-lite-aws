#!/bin/bash
#
# Deploy SOC Lite AgentCore Agents
# This script deploys agents from /aws2/soc-lite/agentcore to AWS
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SOC Lite AgentCore Deployment${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_DIR="$SCRIPT_DIR/.venv"

echo -e "${YELLOW}Runtime directory: $SCRIPT_DIR${NC}"
echo -e "${YELLOW}Virtual environment: $VENV_DIR${NC}\n"

# Check if virtual environment exists
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${RED}Error: Virtual environment not found at $VENV_DIR${NC}"
    echo -e "${YELLOW}Please run setup-venv.sh first:${NC}"
    echo -e "  cd $SCRIPT_DIR"
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

# Deployment menu
echo -e "${YELLOW}Which agents would you like to deploy?${NC}"
echo -e "  1) Bulk Analysis Agent only"
echo -e "  2) SecOps Agent only"
echo -e "  3) Both agents"
echo -e "  4) Exit"
echo ""
read -p "Enter your choice (1-4): " DEPLOY_CHOICE

case $DEPLOY_CHOICE in
    1)
        echo -e "\n${GREEN}Deploying Bulk Analysis Agent...${NC}\n"
        cd "$SCRIPT_DIR/bulk-analysis-agent"
        ./deploy-bulk-analysis.sh
        ;;
    2)
        echo -e "\n${GREEN}Deploying SecOps Agent...${NC}\n"
        cd "$SCRIPT_DIR/secops-agent"
        ./deploy-secops.sh
        ;;
    3)
        echo -e "\n${GREEN}Deploying Both Agents...${NC}\n"
        
        # Deploy Bulk Analysis Agent
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}1/2: Deploying Bulk Analysis Agent${NC}"
        echo -e "${GREEN}========================================${NC}\n"
        cd "$SCRIPT_DIR/bulk-analysis-agent"
        ./deploy-bulk-analysis.sh
        
        # Deploy SecOps Agent
        echo -e "\n${GREEN}========================================${NC}"
        echo -e "${GREEN}2/2: Deploying SecOps Agent${NC}"
        echo -e "${GREEN}========================================${NC}\n"
        cd "$SCRIPT_DIR/secops-agent"
        ./deploy-secops.sh
        
        # Summary
        echo -e "\n${GREEN}========================================${NC}"
        echo -e "${GREEN}All Agents Deployed!${NC}"
        echo -e "${GREEN}========================================${NC}\n"
        
        # Read ARNs from saved files
        BULK_ARN=$(cat "$SCRIPT_DIR/bulk-analysis-agent/.agent_arn" 2>/dev/null || echo "N/A")
        SECOPS_ARN=$(cat "$SCRIPT_DIR/secops-agent/.agent_arn" 2>/dev/null || echo "N/A")
        
        echo -e "${GREEN}Agent ARNs:${NC}"
        echo -e "  Bulk Analysis: $BULK_ARN"
        echo -e "  SecOps:        $SECOPS_ARN"
        
        echo -e "\n${YELLOW}Next Steps:${NC}"
        echo -e "  1. Update your backend .env file with these ARNs"
        echo -e "  2. Redeploy Lambda functions that use these agents"
        echo -e "  3. Test the agents with sample payloads"
        ;;
    4)
        echo -e "\n${YELLOW}Exiting...${NC}\n"
        exit 0
        ;;
    *)
        echo -e "\n${RED}Invalid choice. Exiting.${NC}\n"
        exit 1
        ;;
esac

echo -e "\n${GREEN}Done!${NC}\n"
