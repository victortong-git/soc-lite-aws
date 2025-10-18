# AgentCore Deployment Guide

This directory contains the deployment setup for SOC Lite AgentCore agents in `/aws2/soc-lite/agentcore`.

## Directory Structure

```
runtime/
├── .venv/                          # Python virtual environment (created by setup)
├── setup-venv.sh                   # Setup script for Python environment
├── deploy-agents.sh                # Master deployment script
├── bulk-analysis-agent/
│   ├── bulk_analysis_agent.py      # Bulk analysis agent code
│   ├── requirements.txt            # Python dependencies
│   ├── deploy-bulk-analysis.sh     # Individual deployment script
│   └── .agent_arn                  # Saved ARN after deployment
└── secops-agent/
    ├── secops_agent.py             # SecOps multi-agent code
    ├── requirements.txt            # Python dependencies
    ├── deploy-secops.sh            # Individual deployment script
    └── .agent_arn                  # Saved ARN after deployment
```

## Prerequisites

1. **Python 3.8+** installed on your system
2. **AWS CLI** installed and configured
3. **AWS Credentials** configured with appropriate permissions
4. **Bedrock AgentCore** access enabled in your AWS account

## Initial Setup

### Step 1: Create Python Virtual Environment

Run the setup script to create a Python virtual environment with all required dependencies:

```bash
cd /aws2/soc-lite/agentcore/runtime
./setup-venv.sh
```

This will:
- Create a `.venv` directory with Python virtual environment
- Install `bedrock-agentcore` and `bedrock-agentcore-starter-toolkit`
- Install `strands-agents` for AI agent framework
- Install `boto3` and `requests` for AWS and HTTP operations

### Step 2: Activate Virtual Environment

```bash
source .venv/bin/activate
```

You should see `(.venv)` in your terminal prompt.

### Step 3: Configure AWS Credentials

If not already configured:

```bash
aws configure
```

Enter your:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., `us-east-1`)
- Default output format (e.g., `json`)

## Deployment Options

### Option 1: Deploy All Agents (Recommended)

Use the master deployment script with an interactive menu:

```bash
./deploy-agents.sh
```

This will:
1. Check prerequisites (venv, AWS credentials)
2. Show a menu to deploy:
   - Bulk Analysis Agent only
   - SecOps Agent only
   - Both agents
3. Deploy selected agents to AWS
4. Save ARNs to `.agent_arn` files

### Option 2: Deploy Individual Agents

#### Deploy Bulk Analysis Agent

```bash
cd bulk-analysis-agent
./deploy-bulk-analysis.sh
```

#### Deploy SecOps Agent

```bash
cd secops-agent
./deploy-secops.sh
```

## What Happens During Deployment

1. **Prerequisites Check**: Verifies venv, AWS CLI, and credentials
2. **Dependency Installation**: Installs/updates Python packages from `requirements.txt`
3. **AgentCore Configuration**: Creates `.bedrock_agentcore.yaml` if needed
4. **Agent Launch**: Deploys agent to AWS Bedrock AgentCore Runtime
5. **ARN Extraction**: Extracts and saves the agent ARN
6. **Summary**: Displays deployment results and next steps

## After Deployment

### 1. Update Backend Environment Variables

Add the agent ARNs to your backend `.env` file:

```bash
# For Bulk Analysis Agent
BULK_ANALYSIS_AGENT_ARN=arn:aws:bedrock-agentcore:us-east-1:123456789012:agent-runtime/bulk-analysis-agent-abc123

# For SecOps Agent
SECOPS_AGENT_ARN=arn:aws:bedrock-agentcore:us-east-1:123456789012:agent-runtime/secops-agent-xyz789
```

### 2. Test the Agents

#### Test Bulk Analysis Agent

```bash
cd bulk-analysis-agent
agentcore invoke '{
  "summary": {
    "source_ip": "192.168.1.100",
    "country": "US",
    "total_events": 10,
    "unique_uris": ["/admin", "/wp-login.php"]
  },
  "events": [
    {"timestamp": "2025-10-18T10:00:00Z", "action": "BLOCK", "uri": "/admin"}
  ]
}'
```

#### Test SecOps Agent (Analyze Workflow)

```bash
cd secops-agent
agentcore invoke '{
  "action": "analyze",
  "event": {
    "id": 123,
    "source_ip": "1.2.3.4",
    "action": "BLOCK",
    "uri": "/api/users"
  }
}'
```

#### Test SecOps Agent (Monitor Workflow)

```bash
cd secops-agent
agentcore invoke '{
  "action": "monitor",
  "hours": 24
}'
```

### 3. View Agent Logs

```bash
# Bulk Analysis Agent logs
aws logs tail /aws/bedrock-agentcore/bulk-analysis-agent --follow --region us-east-1

# SecOps Agent logs
aws logs tail /aws/bedrock-agentcore/secops-agent --follow --region us-east-1
```

### 4. Check Agent Status

```bash
cd bulk-analysis-agent  # or secops-agent
agentcore status
```

## Updating Agents

When you update agent code (`.py` files), redeploy using the same scripts:

```bash
# Update and redeploy Bulk Analysis Agent
cd bulk-analysis-agent
./deploy-bulk-analysis.sh

# Update and redeploy SecOps Agent
cd secops-agent
./deploy-secops.sh
```

The deployment script will:
- Use the existing `.bedrock_agentcore.yaml` configuration
- Deploy the updated code
- Preserve the same agent ARN (if possible)

## Troubleshooting

### Virtual Environment Not Found

```bash
cd /aws2/soc-lite/agentcore/runtime
./setup-venv.sh
```

### AgentCore CLI Not Found

Make sure the virtual environment is activated:

```bash
source .venv/bin/activate
which agentcore  # Should show path in .venv/bin/
```

### AWS Credentials Not Configured

```bash
aws configure
aws sts get-caller-identity  # Test credentials
```

### Agent Deployment Failed

1. Check AWS permissions (Bedrock, IAM, CloudWatch Logs)
2. Verify region supports Bedrock AgentCore
3. Check agent logs for errors
4. Try `agentcore delete` and redeploy

### ARN Not Extracted

Manually check agent status:

```bash
cd bulk-analysis-agent  # or secops-agent
agentcore status
```

Copy the ARN from the output.

## Agent Management Commands

```bash
# Check agent status
agentcore status

# Invoke agent with payload
agentcore invoke '<json_payload>'

# View agent configuration
cat .bedrock_agentcore.yaml

# Delete agent (removes from AWS)
agentcore delete

# Reconfigure agent
agentcore configure --entrypoint <agent_file>.py
```

## Environment Variables

### For SecOps Agent

Set `BACKEND_API_URL` before deployment if using a custom backend:

```bash
export BACKEND_API_URL=https://your-backend-api.com/api
./deploy-secops.sh
```

Default: `https://aws1.c6web.com/api`

## Dependencies

### Core Dependencies (installed by setup-venv.sh)

- `bedrock-agentcore>=0.1.7` - AgentCore runtime
- `bedrock-agentcore-starter-toolkit>=0.1.19` - CLI tools
- `strands-agents>=1.11.0` - AI agent framework
- `boto3>=1.34.0` - AWS SDK
- `requests>=2.31.0` - HTTP client

### Agent-Specific Dependencies

See `requirements.txt` in each agent directory.

## Best Practices

1. **Always activate venv** before running deployment scripts
2. **Test agents** after deployment with sample payloads
3. **Save ARNs** to your backend `.env` file immediately
4. **Monitor logs** during initial deployment
5. **Version control** your agent code changes
6. **Document** any custom configurations

## Support

For issues or questions:
1. Check agent logs: `aws logs tail /aws/bedrock-agentcore/<agent-name> --follow`
2. Verify AWS permissions and region support
3. Review AgentCore documentation: https://docs.aws.amazon.com/bedrock/
4. Check Strands SDK documentation for agent framework

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
