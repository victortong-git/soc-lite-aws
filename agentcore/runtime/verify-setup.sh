#!/bin/bash
#
# Verify AgentCore Setup
# This script checks if all required files and configurations are in place
#

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║        AgentCore Setup Verification                       ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ERRORS=0

# Check required scripts
echo "Checking required scripts..."
REQUIRED_SCRIPTS=(
    "setup-venv.sh"
    "deploy-agents.sh"
    "QUICKSTART.sh"
    "bulk-analysis-agent/deploy-bulk-analysis.sh"
    "secops-agent/deploy-secops.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ -f "$SCRIPT_DIR/$script" ] && [ -x "$SCRIPT_DIR/$script" ]; then
        echo -e "${GREEN}✓${NC} $script"
    else
        echo -e "${RED}✗${NC} $script (missing or not executable)"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""

# Check required documentation
echo "Checking documentation..."
REQUIRED_DOCS=(
    "README.md"
    "DEPLOYMENT_GUIDE.md"
    "SETUP_SUMMARY.md"
    "../MIGRATION_FROM_AWS.md"
)

for doc in "${REQUIRED_DOCS[@]}"; do
    if [ -f "$SCRIPT_DIR/$doc" ]; then
        echo -e "${GREEN}✓${NC} $doc"
    else
        echo -e "${RED}✗${NC} $doc (missing)"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""

# Check agent files
echo "Checking agent files..."
AGENT_FILES=(
    "bulk-analysis-agent/bulk_analysis_agent.py"
    "bulk-analysis-agent/requirements.txt"
    "secops-agent/secops_agent.py"
    "secops-agent/requirements.txt"
)

for file in "${AGENT_FILES[@]}"; do
    if [ -f "$SCRIPT_DIR/$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""

# Check Python
echo "Checking Python installation..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✓${NC} $PYTHON_VERSION"
else
    echo -e "${RED}✗${NC} Python 3 not found"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check AWS CLI
echo "Checking AWS CLI..."
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1 | cut -d' ' -f1)
    echo -e "${GREEN}✓${NC} $AWS_VERSION"
else
    echo -e "${YELLOW}⚠${NC} AWS CLI not found (required for deployment)"
fi

echo ""

# Check virtual environment
echo "Checking virtual environment..."
if [ -d "$SCRIPT_DIR/.venv" ]; then
    echo -e "${GREEN}✓${NC} Virtual environment exists at .venv/"
    
    # Check if agentcore is installed
    if [ -f "$SCRIPT_DIR/.venv/bin/agentcore" ]; then
        echo -e "${GREEN}✓${NC} agentcore CLI installed"
    else
        echo -e "${YELLOW}⚠${NC} agentcore CLI not found in venv"
    fi
else
    echo -e "${YELLOW}⚠${NC} Virtual environment not created yet (run ./setup-venv.sh)"
fi

echo ""

# Check deployed agents
echo "Checking deployed agents..."
if [ -f "$SCRIPT_DIR/bulk-analysis-agent/.agent_arn" ]; then
    BULK_ARN=$(cat "$SCRIPT_DIR/bulk-analysis-agent/.agent_arn")
    echo -e "${GREEN}✓${NC} Bulk Analysis Agent deployed"
    echo "  ARN: $BULK_ARN"
else
    echo -e "${YELLOW}⚠${NC} Bulk Analysis Agent not deployed yet"
fi

if [ -f "$SCRIPT_DIR/secops-agent/.agent_arn" ]; then
    SECOPS_ARN=$(cat "$SCRIPT_DIR/secops-agent/.agent_arn")
    echo -e "${GREEN}✓${NC} SecOps Agent deployed"
    echo "  ARN: $SECOPS_ARN"
else
    echo -e "${YELLOW}⚠${NC} SecOps Agent not deployed yet"
fi

echo ""
echo "════════════════════════════════════════════════════════════"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ Setup verification passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run ./QUICKSTART.sh to deploy agents (if not done yet)"
    echo "  2. Copy ARNs from .agent_arn files to backend .env"
    echo "  3. Test agents with sample payloads"
else
    echo -e "${RED}✗ Setup verification failed with $ERRORS error(s)${NC}"
    echo ""
    echo "Please ensure all required files are in place."
fi

echo ""
