# AgentCore Runtime

This directory contains the runtime agents for SOC Lite AgentCore deployment in `/aws2/soc-lite/agentcore`.

## Quick Start

For first-time setup, run the quick start script:

```bash
./QUICKSTART.sh
```

This will guide you through:
1. Python virtual environment setup
2. Dependency installation
3. AWS credentials configuration
4. Agent deployment

## Agents

### 1. Bulk Analysis Agent
- **File**: `bulk-analysis-agent/bulk_analysis_agent.py`
- **Purpose**: Analyzes grouped WAF events by source IP
- **Model**: Amazon Nova Micro
- **Input**: Summary of events (IP, country, event count, URIs, rules)
- **Output**: Severity rating (0-5), attack type, security analysis, recommendations
- **Deploy**: `cd bulk-analysis-agent && ./deploy-bulk-analysis.sh`

### 2. SecOps Agent
- **File**: `secops-agent/secops_agent.py`
- **Purpose**: Multi-agent security operations (analyze & monitor workflows)
- **Model**: Amazon Nova Micro
- **Workflows**:
  - **Analyze**: Individual event analysis → triage → backend actions
  - **Monitor**: Daily pattern detection → bulk updates → campaign escalations
- **Deploy**: `cd secops-agent && ./deploy-secops.sh`

## Deployment Scripts

- **`setup-venv.sh`** - Creates Python virtual environment with dependencies
- **`deploy-agents.sh`** - Master deployment script with interactive menu
- **`QUICKSTART.sh`** - Guided setup for first-time users
- **`DEPLOYMENT_GUIDE.md`** - Comprehensive deployment documentation

## Prerequisites

- Python 3.8+
- AWS CLI configured
- Bedrock AgentCore access enabled

## Manual Setup

If you prefer manual setup over the quick start:

```bash
# 1. Setup virtual environment
./setup-venv.sh

# 2. Activate virtual environment
source .venv/bin/activate

# 3. Configure AWS (if needed)
aws configure

# 4. Deploy agents
./deploy-agents.sh
```

## Documentation

See **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** for:
- Detailed setup instructions
- Deployment options
- Testing procedures
- Troubleshooting
- Agent management commands

## Directory Structure

```
runtime/
├── .venv/                          # Python virtual environment
├── setup-venv.sh                   # Setup script
├── deploy-agents.sh                # Master deployment
├── QUICKSTART.sh                   # Quick start guide
├── DEPLOYMENT_GUIDE.md             # Full documentation
├── bulk-analysis-agent/
│   ├── bulk_analysis_agent.py
│   ├── requirements.txt
│   ├── deploy-bulk-analysis.sh
│   └── .agent_arn                  # Saved after deployment
└── secops-agent/
    ├── secops_agent.py
    ├── requirements.txt
    ├── deploy-secops.sh
    └── .agent_arn                  # Saved after deployment
```

## After Deployment

1. **Save ARNs**: Check `.agent_arn` files in each agent directory
2. **Update Backend**: Add ARNs to your backend `.env` file
3. **Test Agents**: Use `agentcore invoke` with sample payloads
4. **Monitor Logs**: `aws logs tail /aws/bedrock-agentcore/<agent-name> --follow`

## Quick Reference

```bash
# Setup (one-time)
./setup-venv.sh
source .venv/bin/activate

# Deploy all agents
./deploy-agents.sh

# Deploy individual agent
cd bulk-analysis-agent && ./deploy-bulk-analysis.sh
cd secops-agent && ./deploy-secops.sh

# Test agent
agentcore invoke '<json_payload>'

# View logs
aws logs tail /aws/bedrock-agentcore/<agent-name> --follow

# Check status
agentcore status
```