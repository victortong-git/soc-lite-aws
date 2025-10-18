# AgentCore Gateway Configuration

This directory contains the AgentCore Gateway setup for SOC Lite agents, providing secure API access through OAuth 2.0 authentication.

## Quick Start

Deploy the gateway in 3 steps:

```bash
# 1. Deploy gateway
./deploy-gateway.sh

# 2. Configure agents
./configure-agents.sh

# 3. Test gateway
./test-gateway.sh
```

## Directory Structure

```
gateways/
├── agent-actions-api.yaml          # OpenAPI 3.0 API specification
├── deploy-gateway.sh               # Gateway deployment script
├── configure-agents.sh             # Agent configuration script
├── test-gateway.sh                 # Gateway testing script
├── GATEWAY_DEPLOYMENT_GUIDE.md     # Comprehensive deployment guide
├── README.md                       # This file
├── .gateway_config                 # Generated: Gateway configuration
├── .oauth_credentials              # Generated: OAuth credentials (SECURE!)
└── .gitignore                      # Git ignore file
```

## What is AgentCore Gateway?

The AgentCore Gateway provides:
- **Secure API Access**: OAuth 2.0 authentication for agents
- **Centralized Routing**: Single entry point for backend APIs
- **Request Validation**: OpenAPI spec validation
- **Monitoring**: CloudWatch logs and metrics

## Architecture

```
Agents → Gateway (OAuth) → Backend API
```

The gateway sits between agents and your backend API, handling:
1. OAuth token validation
2. API request routing
3. Request/response transformation
4. Error handling

## Scripts

### deploy-gateway.sh
Creates and configures the AgentCore Gateway:
- Prompts for backend API URL
- Creates gateway with API specification
- Configures OAuth 2.0
- Saves configuration to `.gateway_config`

**Usage:**
```bash
./deploy-gateway.sh
```

### configure-agents.sh
Updates agent configurations to use the gateway:
- Loads gateway configuration
- Updates agent `.bedrock_agentcore.yaml` files
- Adds OAuth credentials
- Creates environment file for deployment

**Usage:**
```bash
./configure-agents.sh
```

### test-gateway.sh
Tests gateway connectivity and authentication:
- Checks gateway status
- Tests OAuth authentication
- Tests gateway endpoints
- Tests backend API integration

**Usage:**
```bash
./test-gateway.sh
```

## API Specification

The `agent-actions-api.yaml` file defines 5 endpoints:

1. **POST /api/agent-actions/update-analysis** - Update event analysis
2. **POST /api/agent-actions/send-notification** - Send notifications
3. **GET /api/agent-actions/fetch-unprocessed** - Fetch unprocessed events
4. **GET /api/agent-actions/fetch-severity3** - Fetch medium severity events
5. **POST /api/agent-actions/update-status** - Update event status

## Prerequisites

- AWS CLI configured
- Backend API deployed and accessible
- Bedrock AgentCore access enabled
- IAM permissions for gateway creation

## Deployment Workflow

### 1. Deploy Gateway

```bash
./deploy-gateway.sh
```

You'll be prompted for:
- Backend API URL (e.g., `https://api.example.com`)
- OAuth Client ID (from AWS Console)
- OAuth Client Secret (from AWS Console)

**Output:**
- `.gateway_config` - Gateway configuration
- `.oauth_credentials` - OAuth credentials (keep secure!)

### 2. Configure Agents

```bash
./configure-agents.sh
```

This updates:
- `../runtime/bulk-analysis-agent/.bedrock_agentcore.yaml`
- `../runtime/secops-agent/.bedrock_agentcore.yaml`
- `../runtime/.gateway_env`

### 3. Test Gateway

```bash
./test-gateway.sh
```

Runs 4 tests:
1. Gateway status check
2. OAuth authentication
3. Gateway connectivity
4. Backend API integration

### 4. Redeploy Agents

```bash
cd ../runtime
source .gateway_env
./deploy-agents.sh
```

## Configuration Files

### .gateway_config
Contains gateway configuration:
```bash
GATEWAY_ID=gateway-abc123
GATEWAY_NAME=soc-lite-gateway
BACKEND_API_URL=https://api.example.com
AWS_REGION=us-east-1
```

### .oauth_credentials
Contains OAuth credentials (KEEP SECURE!):
```bash
OAUTH_CLIENT_ID=client-abc123
OAUTH_CLIENT_SECRET=secret-xyz789
```

**Security:**
- File permissions: `600` (owner read/write only)
- Added to `.gitignore`
- Never commit to version control

## OAuth 2.0 Flow

1. Agent requests token from OAuth endpoint
2. OAuth server validates client credentials
3. Token issued with 1-hour lifetime
4. Agent includes token in API requests
5. Gateway validates token and routes request

## Monitoring

### View Gateway Logs
```bash
aws logs tail /aws/bedrock-agentcore/<gateway-id> --follow
```

### View Gateway Metrics
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/BedrockAgentCore \
  --metric-name RequestCount \
  --dimensions Name=GatewayId,Value=<gateway-id>
```

### Test Gateway Status
```bash
aws bedrock-agent get-agent-gateway --gateway-id <gateway-id>
```

## Troubleshooting

### Gateway Creation Failed
- Check IAM permissions
- Verify AWS CLI configuration
- Ensure Bedrock AgentCore is enabled

### OAuth Authentication Failed
- Verify credentials in `.oauth_credentials`
- Check OAuth endpoint URL
- Regenerate credentials in AWS Console

### Backend API Not Reachable
- Verify backend API URL
- Check security groups
- Test backend API directly: `curl https://your-api.com/health`

### Agent Can't Use Gateway
- Verify agent configuration: `cat ../runtime/secops-agent/.bedrock_agentcore.yaml`
- Reconfigure agents: `./configure-agents.sh`
- Redeploy agents: `cd ../runtime && ./deploy-agents.sh`

## Security Best Practices

1. **Secure Credentials**
   ```bash
   chmod 600 .oauth_credentials
   echo ".oauth_credentials" >> .gitignore
   ```

2. **Rotate Credentials Regularly**
   - Generate new credentials in AWS Console
   - Update `.oauth_credentials`
   - Reconfigure and redeploy agents

3. **Monitor Gateway Logs**
   - Set up CloudWatch alarms
   - Monitor for authentication failures
   - Track API usage patterns

4. **Restrict Backend Access**
   - Configure backend to only accept gateway requests
   - Validate `x-agentcore-gateway-id` header

## Updating Gateway

### Update API Specification
```bash
# Edit agent-actions-api.yaml
vim agent-actions-api.yaml

# Update gateway
aws bedrock-agent update-agent-gateway \
  --gateway-id <gateway-id> \
  --api-spec file://agent-actions-api.yaml
```

### Update Backend URL
```bash
aws bedrock-agent update-agent-gateway \
  --gateway-id <gateway-id> \
  --backend-url https://new-backend-url.com

# Update configuration
vim .gateway_config

# Reconfigure agents
./configure-agents.sh
```

## Documentation

- **[GATEWAY_DEPLOYMENT_GUIDE.md](GATEWAY_DEPLOYMENT_GUIDE.md)** - Comprehensive deployment guide
- **[agent-actions-api.yaml](agent-actions-api.yaml)** - OpenAPI 3.0 specification

## Related Files

- Backend implementation: `../../apps/backend/src/controllers/agentActionsController.ts`
- Backend routes: `../../apps/backend/src/routes/agentActions.ts`
- Agent runtime: `../runtime/`

## Cost Estimation

- Gateway requests: $0.00025 per request
- OAuth token requests: $0.0001 per request
- Estimated monthly cost (10K requests): ~$3-5

## Quick Reference

```bash
# Deploy gateway
./deploy-gateway.sh

# Configure agents
./configure-agents.sh

# Test gateway
./test-gateway.sh

# View gateway info
cat .gateway_config

# View gateway status
aws bedrock-agent get-agent-gateway --gateway-id $(grep GATEWAY_ID .gateway_config | cut -d= -f2)

# View logs
aws logs tail /aws/bedrock-agentcore/$(grep GATEWAY_ID .gateway_config | cut -d= -f2) --follow
```

## References

- [AWS Bedrock AgentCore Gateway Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-agentcore-gateway.html)
- [OAuth 2.0 Client Credentials Flow](https://oauth.net/2/grant-types/client-credentials/)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
