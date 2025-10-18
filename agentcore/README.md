# SOC Lite AgentCore

## Directory Structure

```
agentcore/
├── gateways/                       # API Gateway definitions
│   ├── agent-actions-api.yaml      # OpenAPI spec for agent actions
│   └── README.md
├── runtime/                        # Agent runtime implementations
│   ├── .venv/                      # Python virtual environment (created by setup)
│   ├── setup-venv.sh               # Setup script for Python environment
│   ├── deploy-agents.sh            # Master deployment script
│   ├── QUICKSTART.sh               # Guided first-time setup
│   ├── DEPLOYMENT_GUIDE.md         # Comprehensive deployment guide
│   ├── README.md                   # Quick reference
│   ├── SETUP_SUMMARY.md            # Setup summary
│   ├── bulk-analysis-agent/        # Bulk analysis agent
│   │   ├── bulk_analysis_agent.py
│   │   ├── requirements.txt
│   │   ├── deploy-bulk-analysis.sh
│   │   └── .agent_arn              # Saved ARN after deployment
│   └── secops-agent/               # SecOps multi-agent
│       ├── secops_agent.py
│       ├── requirements.txt
│       ├── deploy-secops.sh
│       └── .agent_arn              # Saved ARN after deployment

```

## Quick Start

For first-time setup:

```bash
cd runtime
./QUICKSTART.sh
```

This will guide you through:
1. Python virtual environment setup
2. Dependency installation
3. AWS credentials configuration
4. Agent deployment

## Agents

### 1. Bulk Analysis Agent
- **Purpose**: Analyzes grouped WAF events by source IP
- **Model**: Amazon Nova Micro
- **Input**: Summary of events (IP, country, event count, URIs, rules)
- **Output**: Severity rating (0-5), attack type, security analysis, recommendations

### 2. SecOps Agent
- **Purpose**: Multi-agent security operations (using Strands SDK)
- **Model**: Amazon Nova Micro
- **Logical Agents**:
  - Security Agent: AI-powered threat analysis
  - Triage Agent: Code-based decision routing
  - Monitoring Agent: Pattern detection for repeated attacks
- **Workflows**:
  - **Analyze**: Individual event analysis → triage → backend actions
  - **Monitor**: Daily pattern detection → bulk updates → campaign escalations

## Documentation

- **[runtime/README.md](runtime/README.md)** - Quick reference and commands
- **[runtime/DEPLOYMENT_GUIDE.md](runtime/DEPLOYMENT_GUIDE.md)** - Comprehensive deployment guide

## Prerequisites

- Python 3.8+
- AWS CLI configured
- Bedrock AgentCore access enabled

## Deployment

### Option 1: Quick Start (Recommended)
```bash
cd runtime
./QUICKSTART.sh
```

### Option 2: Manual Setup
```bash
cd runtime
./setup-venv.sh
source .venv/bin/activate
./deploy-agents.sh
```

### Option 3: Individual Agents
```bash
cd runtime
source .venv/bin/activate

# Deploy bulk analysis agent
cd bulk-analysis-agent
./deploy-bulk-analysis.sh

# Deploy secops agent
cd secops-agent
./deploy-secops.sh
```

## After Deployment

1. **Get ARNs**: Check `.agent_arn` files in each agent directory
2. **Update Backend**: Add ARNs to your backend `.env` file
3. **Test Agents**: Use `agentcore invoke` with sample payloads
4. **Monitor Logs**: `aws logs tail /aws/bedrock-agentcore/<agent-name> --follow`

## Architecture

```
┌──────────────────────────────────────────────────┐
│          Bedrock AgentCore Runtime               │
│                                                   │
│  ┌─────────────────────────────────────────┐    │
│  │     secops-agent (Strands SDK)          │    │
│  │  ┌────────────┬──────────┬────────────┐ │    │
│  │  │ Security   │ Triage   │ Monitor    │ │    │
│  │  │ Agent      │ Agent    │ Agent      │ │    │
│  │  └────────────┴──────────┴────────────┘ │    │
│  └─────────────────────────────────────────┘    │
│                                                   │
│  ┌─────────────────────────────────────────┐    │
│  │     bulk-analysis-agent                  │    │
│  │  (Bulk event pattern analysis)           │    │
│  └─────────────────────────────────────────┘    │
│                                                   │
└───────────────────┬──────────────────────────────┘
                    │ OAuth + API Calls
                    ▼
        ┌───────────────────────┐
        │  AgentCore Gateway    │
        │  (OAuth + Routing)    │
        └───────────┬───────────┘
                    │ Authenticated Requests
                    ▼
        ┌───────────────────────┐
        │   Backend API         │
        │   (Lambda + API GW)   │
        └───────────────────────┘
```

## Workflows

### 1. Security Analysis Workflow
```
WAF Event → Lambda → secops-agent → [Security + Triage] → Backend API → Database
```

### 2. Bulk Analysis Workflow
```
Grouped Events → Lambda → bulk-analysis-agent → Backend API → Database
```

### 3. Monitoring Workflow
```
EventBridge Schedule → Lambda → secops-agent (Monitor) → Backend API → SNS
```

## Key Features

- **Automated Setup**: One-command virtual environment and dependency setup
- **Interactive Deployment**: Menu-driven deployment for flexibility
- **ARN Management**: Automatic extraction and storage of agent ARNs
- **Comprehensive Documentation**: Multiple levels of documentation
- **Error Handling**: Robust validation and troubleshooting
- **Individual Deployments**: Update one agent without affecting others

## Integration

### Lambda Functions
Lambda functions invoke agents:
- `lambda/analysis-worker/` → secops-agent
- `lambda/smart-analysis-worker/` → bulk-analysis-agent
- `lambda/monitoring-trigger/` → secops-agent (Monitor)

### Backend API
Backend controllers handle agent callbacks:
- `apps/backend/src/controllers/agentActionsController.ts`
- `apps/backend/src/routes/agentActions.ts`
- `apps/backend/src/services/agentCoreService.ts`

## Support

For issues or questions:
1. Check [runtime/DEPLOYMENT_GUIDE.md](runtime/DEPLOYMENT_GUIDE.md) troubleshooting section
2. Review agent logs in CloudWatch
3. Verify AWS permissions and credentials
4. Check virtual environment activation

## Quick Reference

```bash
# Setup (one-time)
cd runtime
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

# Get ARN
cat .agent_arn
```

## Benefits

✅ **Single Deployment** - Consolidated agents with multi-agent architecture
✅ **Strands Orchestration** - Workflow logic in agent, not backend
✅ **AgentCore Gateway** - Secure API access with OAuth
✅ **Easier Maintenance** - Centralized logic and configuration
✅ **Automated Setup** - One-command environment setup
✅ **Scalable** - Easy to add more logical agents or functions

## Next Steps

1. Deploy agents: `cd runtime && ./QUICKSTART.sh`
2. Setup gateway: See `gateways/README.md`
3. Configure backend with agent ARNs from `.agent_arn` files
4. Test agent invocations
5. Deploy Lambda functions that use agents

## References

- [Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-agentcore.html)
- [Strands SDK Documentation](https://github.com/aws/strands)
- Backend integration: `../../apps/backend/src/services/agentCoreService.ts`
