#!/bin/bash
#
# Setup Python Virtual Environment for AgentCore Deployment
# This script creates and configures a Python venv with required dependencies
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AgentCore Python Environment Setup${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_DIR="$SCRIPT_DIR/.venv"

echo -e "${YELLOW}Script directory: $SCRIPT_DIR${NC}"
echo -e "${YELLOW}Virtual environment: $VENV_DIR${NC}\n"

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 not found${NC}"
    echo "Please install Python 3.8 or higher"
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
echo -e "${GREEN}✓ Found $PYTHON_VERSION${NC}\n"

# Remove existing venv if it exists
if [ -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Removing existing virtual environment...${NC}"
    rm -rf "$VENV_DIR"
    echo -e "${GREEN}✓ Removed${NC}\n"
fi

# Create new virtual environment
echo -e "${YELLOW}Creating new virtual environment...${NC}"
python3 -m venv "$VENV_DIR"
echo -e "${GREEN}✓ Virtual environment created${NC}\n"

# Activate virtual environment
echo -e "${YELLOW}Activating virtual environment...${NC}"
source "$VENV_DIR/bin/activate"
echo -e "${GREEN}✓ Activated${NC}\n"

# Upgrade pip
echo -e "${YELLOW}Upgrading pip...${NC}"
pip install --upgrade pip
echo -e "${GREEN}✓ pip upgraded${NC}\n"

# Install core dependencies
echo -e "${YELLOW}Installing core dependencies...${NC}"
pip install bedrock-agentcore>=0.1.7
pip install bedrock-agentcore-starter-toolkit>=0.1.19
pip install strands-agents>=1.11.0
pip install boto3>=1.34.0
pip install requests>=2.31.0
echo -e "${GREEN}✓ Core dependencies installed${NC}\n"

# Verify installations
echo -e "${YELLOW}Verifying installations...${NC}"
echo -e "Installed packages:"
pip list | grep -E "(bedrock|strands|boto3|requests)"
echo ""

# Check if agentcore CLI is available
if command -v agentcore &> /dev/null; then
    echo -e "${GREEN}✓ agentcore CLI is available${NC}"
    agentcore --version
else
    echo -e "${RED}Warning: agentcore CLI not found in PATH${NC}"
    echo -e "${YELLOW}You may need to activate the venv: source $VENV_DIR/bin/activate${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${YELLOW}To activate this environment:${NC}"
echo -e "  source $VENV_DIR/bin/activate"
echo ""
echo -e "${YELLOW}To deactivate:${NC}"
echo -e "  deactivate"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Activate the virtual environment"
echo -e "  2. Configure AWS credentials (aws configure)"
echo -e "  3. Run deployment scripts for individual agents"
echo ""
echo -e "${GREEN}Done!${NC}\n"
