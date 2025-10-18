# AgentCore Gateway Deployment Guide

This guide covers the complete setup and deployment of the AgentCore Gateway for SOC Lite agents.

## Overview

The AgentCore Gateway provides secure API access for agents to call backend services using OAuth 2.0 authentication. This eliminates the need for agents to manage credentials directly and provides centralized API routing.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  AgentCore Agents                       │
│  ┌──────────────────┐    ┌──────────────────┐         │
│  │ Bulk Analysis    │    │ SecOps Agent     │         │
│  │ Agent            │    │                  │         │
│  └────────┬─────────┘    └────────┬─────────┘         │
│           │                       │                     │
│           │ OAuth + API Calls     │                     │
└───────────┼───────────────────────┼─────────────────────┘
            │                       │
            └───────────┬───────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  AgentCore Gateway    │
            │  - OAuth 2.0 Auth     │
            │  - API Routing        │
            │  - Request Validation │
            └───────────┬───────────┘
                        │ Authenticated Requests
                        ▼
            ┌───────────────────────┐
            │   Backend API         │
            │   (Lambda + API GW)   │
            │   - Event Management  │
            │   - Analysis Storage  │
            │   - Notifications     │
            └───────────────────────┘
```

## Prerequisites

1. **AWS CLI** installed and configured
2. **Backend API** deployed and accessible
3. **AWS Bedrock AgentCore** access enabled
4. **IAM Permissions**:
   - `bedrock:CreateAgentGateway`
   - `bedrock:GetAgentGateway`
   - `bedrock:UpdateAgentGateway`
   - `iam:CreateRole`
   - `iam:AttachRolePolicy`

## Directory Structure

```
gateways/
├── agent-actions-api.yaml          # OpenAPI 3.0 specification
├── deploy-gateway.sh               # Gateway deployment script
├── configure-agents.sh             # Agent configuration script
├── test-gateway.sh                 # Gateway testing script
├── GATEWAY_DEPLOYMENT_GUIDE.md     # This file
├── README.md                       # Quick reference
├── .gateway_config                 # Generated: Gateway configuration
└── .oauth_credentials              # Generated: OAuth credentials (SECURE!)
```

## Deployment Steps

### Step 1: Deploy Backend API

Ensure your backend API is deployed and accessible:

```bash
# Get your backend API URL
# Example: https://abc123.execute-api.us-east-1.amazonaws.com/prod
```

### Step 2: Deploy Gateway

Run the deployment script:

```bash
cd /aws2/soc-lite/agentcore/gateways
./deploy-gateway.sh
```

This will:
1. Check prerequisites (AWS CLI, credentials)
2. Prompt for backend API URL
3. Create AgentCore Gateway with API specification
4. Configure OAuth 2.0 authentication
5. Save gateway configuration to `.gateway_config`
6. Save OAuth credentials to `.oauth_credentials`

**Example Output:**
```
========================================
AgentCore Gateway Deployment
========================================

Checking prerequisites...
✓ Prerequisites check passed
  Account: 123456789012
  Region: us-east-1

Backend API Configuration
Enter your backend API URL (e.g., https://api.example.com)
Backend API URL: https://abc123.execute-api.us-east-1.amazonaws.com/prod
✓ Backend API URL: https://abc123.execute-api.us-east-1.amazonaws.com/prod

Gateway name: soc-lite-gateway

Creating gateway...
✓ Gateway created successfully
  Gateway ID: gateway-abc123xyz

OAuth 2.0 Configuration
Enter OAuth Client ID: client-abc123
Enter OAuth Client Secret: ********
✓ OAuth credentials saved

Deployment Complete!
```

### Step 3: Configure Agents

Update agent configurations to use the gateway:

```bash
./configure-agents.sh
```

This will:
1. Load gateway configuration from `.gateway_config`
2. Update agent `.bedrock_agentcore.yaml` files
3. Add OAuth credentials
4. Create `.gateway_env` file for deployment

**What it does:**
- Updates `../runtime/bulk-analysis-agent/.bedrock_agentcore.yaml`
- Updates `../runtime/secops-agent/.bedrock_agentcore.yaml`
- Creates `../runtime/.gateway_env` with environment variables

### Step 4: Test Gateway

Verify gateway connectivity and authentication:

```bash
./test-gateway.sh
```

This will:
1. Check gateway status
2. Test OAuth authentication
3. Test gateway endpoint connectivity
4. Test backend API through gateway

**Example Output:**
```
========================================
AgentCore Gateway Testing
========================================

[Test 1/4] Checking gateway status...
✓ Gateway exists and is accessible

[Test 2/4] Testing OAuth authentication...
✓ OAuth token obtained successfully

[Test 3/4] Testing gateway endpoint...
✓ Gateway is reachable

[Test 4/4] Testing backend API through gateway...
✓ Backend API is accessible through gateway

Testing Complete!
```

### Step 5: Redeploy Agents

Deploy agents with gateway configuration:

```bash
cd ../runtime
source .gateway_env
./deploy-agents.sh
```

## API Specification

The gateway uses the OpenAPI 3.0 specification defined in `agent-actions-api.yaml`:

### Available Endpoints

1. **POST /api/agent-actions/update-analysis**
   - Updates event with AI security analysis
   - Used by: Security Agent
   - Request: `{ event_id, severity_rating, security_analysis, follow_up_suggestion }`

2. **POST /api/agent-actions/send-notification**
   - Sends SNS/email notifications
   - Used by: Triage Agent
   - Request: `{ event_id, severity, message, notification_type }`

3. **GET /api/agent-actions/fetch-unprocessed**
   - Fetches events needing analysis
   - Used by: Security Agent
   - Query: `?limit=100`

4. **GET /api/agent-actions/fetch-severity3**
   - Fetches medium severity events
   - Used by: Monitor Agent
   - Query: `?hours=24`

5. **POST /api/agent-actions/update-status**
   - Updates event status
   - Used by: Triage Agent
   - Request: `{ event_id, status, reason }`

## OAuth 2.0 Configuration

### Client Credentials Flow

The gateway uses OAuth 2.0 Client Credentials flow:

1. **Agent requests token** from OAuth endpoint
2. **OAuth server validates** client_id and client_secret
3. **Token issued** with appropriate scopes
4. **Agent includes token** in API requests
5. **Gateway validates token** and routes request

### Token Management

- **Token Lifetime**: 1 hour (configurable)
- **Refresh**: Automatic by AgentCore SDK
- **Scope**: Limited to agent-actions API
- **Storage**: Managed by AgentCore runtime

## Security Best Practices

### 1. Secure Credential Storage

```bash
# .oauth_credentials file permissions
chmod 600 .oauth_credentials

# Add to .gitignore
echo ".oauth_credentials" >> .gitignore
echo ".gateway_config" >> .gitignore
```

### 2. Rotate Credentials Regularly

```bash
# Generate new OAuth credentials in AWS Console
# Update .oauth_credentials file
# Reconfigure agents: ./configure-agents.sh
# Redeploy agents
```

### 3. Monitor Gateway Logs

```bash
# View gateway logs
aws logs tail /aws/bedrock-agentcore/gateway-abc123 --follow --region us-east-1

# Filter for errors
aws logs filter-pattern /aws/bedrock-agentcore/gateway-abc123 \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

### 4. Restrict Backend API Access

Configure backend API to only accept requests from gateway:

```javascript
// Backend API validation
if (request.headers['x-agentcore-gateway-id'] !== 'gateway-abc123') {
  return { statusCode: 403, body: 'Forbidden' };
}
```

## Troubleshooting

### Gateway Creation Failed

**Problem**: Gateway creation fails with permission error

**Solution**:
```bash
# Check IAM permissions
aws iam get-user

# Ensure you have bedrock:CreateAgentGateway permission
# Contact AWS admin to grant permissions
```

### OAuth Authentication Failed

**Problem**: `401 Unauthorized` when testing gateway

**Solution**:
```bash
# Verify OAuth credentials
cat .oauth_credentials

# Test OAuth token manually
curl -X POST https://bedrock-agentcore-oauth.us-east-1.amazonaws.com/token \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"

# Regenerate credentials in AWS Console if needed
```

### Backend API Not Reachable

**Problem**: Gateway can't reach backend API

**Solution**:
```bash
# Verify backend API URL
curl -X GET https://your-backend-api.com/health

# Check security groups and network ACLs
# Ensure backend API allows traffic from AgentCore

# Update gateway backend URL
aws bedrock-agent update-agent-gateway \
  --gateway-id gateway-abc123 \
  --backend-url https://new-backend-url.com
```

### Agent Can't Use Gateway

**Problem**: Agent fails to call gateway endpoints

**Solution**:
```bash
# Verify agent configuration
cat ../runtime/secops-agent/.bedrock_agentcore.yaml

# Ensure gateway_id is correct
# Ensure OAuth credentials are set

# Reconfigure agents
./configure-agents.sh

# Redeploy agents
cd ../runtime && ./deploy-agents.sh
```

## Monitoring

### Gateway Metrics

```bash
# View gateway metrics in CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/BedrockAgentCore \
  --metric-name RequestCount \
  --dimensions Name=GatewayId,Value=gateway-abc123 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Gateway Logs

```bash
# Real-time logs
aws logs tail /aws/bedrock-agentcore/gateway-abc123 --follow

# Search for specific event
aws logs filter-log-events \
  --log-group-name /aws/bedrock-agentcore/gateway-abc123 \
  --filter-pattern "event_id=123"
```

### OAuth Token Usage

```bash
# Monitor token requests
aws logs filter-log-events \
  --log-group-name /aws/bedrock-agentcore/oauth \
  --filter-pattern "client_id=YOUR_CLIENT_ID"
```

## Updating Gateway

### Update API Specification

```bash
# Edit agent-actions-api.yaml
vim agent-actions-api.yaml

# Update gateway
aws bedrock-agent update-agent-gateway \
  --gateway-id gateway-abc123 \
  --api-spec file://agent-actions-api.yaml
```

### Update Backend URL

```bash
# Update backend URL
aws bedrock-agent update-agent-gateway \
  --gateway-id gateway-abc123 \
  --backend-url https://new-backend-url.com

# Update .gateway_config
vim .gateway_config

# Reconfigure agents
./configure-agents.sh
```

## Cleanup

### Delete Gateway

```bash
# Delete gateway
aws bedrock-agent delete-agent-gateway \
  --gateway-id gateway-abc123 \
  --region us-east-1

# Remove configuration files
rm .gateway_config .oauth_credentials

# Remove agent gateway configurations
cd ../runtime
rm bulk-analysis-agent/.bedrock_agentcore.yaml.backup
rm secops-agent/.bedrock_agentcore.yaml.backup
```

## Cost Estimation

- **Gateway Requests**: $0.00025 per request
- **OAuth Token Requests**: $0.0001 per request
- **Data Transfer**: Standard AWS data transfer rates

**Estimated monthly cost** (10,000 agent requests/month): ~$3-5/month

## References

- [AWS Bedrock AgentCore Gateway Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-agentcore-gateway.html)
- [OAuth 2.0 Client Credentials Flow](https://oauth.net/2/grant-types/client-credentials/)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)

## Support

For issues or questions:
1. Check this guide's troubleshooting section
2. Review gateway logs in CloudWatch
3. Test gateway connectivity with `./test-gateway.sh`
4. Verify OAuth credentials
5. Check backend API accessibility

## Quick Reference

```bash
# Deploy gateway
./deploy-gateway.sh

# Configure agents
./configure-agents.sh

# Test gateway
./test-gateway.sh

# View gateway status
aws bedrock-agent get-agent-gateway --gateway-id <gateway-id>

# View gateway logs
aws logs tail /aws/bedrock-agentcore/<gateway-id> --follow

# Update gateway
aws bedrock-agent update-agent-gateway --gateway-id <gateway-id> --backend-url <url>
```
