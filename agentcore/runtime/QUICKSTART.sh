#!/bin/bash
#
# Quick Start Script for AgentCore Deployment
# This script guides you through the complete setup process
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

clear
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}║        SOC Lite AgentCore - Quick Start Setup             ║${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_DIR="$SCRIPT_DIR/.venv"

echo -e "${YELLOW}This script will help you:${NC}"
echo -e "  1. Set up Python virtual environment"
echo -e "  2. Install required dependencies"
echo -e "  3. Configure AWS credentials (if needed)"
echo -e "  4. Deploy agents to AWS"
echo ""
read -p "Press Enter to continue or Ctrl+C to exit..."
echo ""

# Step 1: Check Python
echo -e "${GREEN}[Step 1/4] Checking Python installation...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 not found${NC}"
    echo -e "${YELLOW}Please install Python 3.8 or higher and try again${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo -e "${GREEN}✓ Found $PYTHON_VERSION${NC}\n"

# Step 2: Setup virtual environment
echo -e "${GREEN}[Step 2/4] Setting up Python virtual environment...${NC}"
if [ -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Virtual environment already exists${NC}"
    read -p "Do you want to recreate it? (y/N): " RECREATE
    if [[ $RECREATE =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Running setup-venv.sh...${NC}\n"
        ./setup-venv.sh
    else
        echo -e "${GREEN}✓ Using existing virtual environment${NC}\n"
    fi
else
    echo -e "${YELLOW}Running setup-venv.sh...${NC}\n"
    ./setup-venv.sh
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Step 3: Check AWS credentials
echo -e "${GREEN}[Step 3/4] Checking AWS credentials...${NC}"
if ! command -v aws &> /dev/null; then
    echo -e "${RED}✗ AWS CLI not found${NC}"
    echo -e "${YELLOW}Please install AWS CLI: https://aws.amazon.com/cli/${NC}"
    exit 1
fi

if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=$(aws configure get region || echo "us-east-1")
    echo -e "${GREEN}✓ AWS credentials configured${NC}"
    echo -e "  Account: $ACCOUNT_ID"
    echo -e "  Region: $AWS_REGION\n"
else
    echo -e "${YELLOW}AWS credentials not configured${NC}"
    echo -e "${YELLOW}Please run: aws configure${NC}"
    echo ""
    read -p "Do you want to configure AWS now? (y/N): " CONFIGURE_AWS
    if [[ $CONFIGURE_AWS =~ ^[Yy]$ ]]; then
        aws configure
        echo ""
    else
        echo -e "${RED}Cannot proceed without AWS credentials${NC}"
        exit 1
    fi
fi

# Step 4: Deploy agents
echo -e "${GREEN}[Step 4/4] Ready to deploy agents!${NC}\n"
echo -e "${YELLOW}Running deployment script...${NC}\n"
./deploy-agents.sh

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}║              Quick Start Complete!                        ║${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}Next steps:${NC}"
echo -e "  1. Check the .agent_arn files in each agent directory"
echo -e "  2. Update your backend .env file with the ARNs"
echo -e "  3. Test the agents with sample payloads"
echo -e "  4. View logs: aws logs tail /aws/bedrock-agentcore/<agent-name> --follow"
echo ""
echo -e "${YELLOW}For detailed documentation, see DEPLOYMENT_GUIDE.md${NC}\n"
