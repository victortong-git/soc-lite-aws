# SecOps Agent - Unified Security Operations Center Agent

A unified AWS Bedrock AgentCore agent implementing 3 logical security agents using the Strands SDK framework for AI-powered security operations.

## Architecture

### Single AgentCore Agent with 3 Logical Agents

1. **Security Agent** (`security_analyst`)
   - AI-powered security analysis using Amazon Nova Lite
   - Analyzes WAF events for threats
   - Assigns severity ratings (0-5)
   - Provides security analysis and follow-up suggestions

2. **Monitor Agent** (`security_monitor`)
   - Monitors severity 3 (medium) events for patterns
   - Detects repeated IP + URI combinations
   - Identifies attack patterns and trends
   - Escalates significant patterns for investigation

3. **Triage Agent** (`incident_triager`)
   - Makes automated triage decisions based on severity
   - Routes events: auto-close (0-2), monitor (3), escalate (4-5)
   - Triggers notifications for critical incidents
   - Updates event status in database

## Workflows

### 1. Analyze Workflow
```
User/Lambda → Security Agent (AI Analysis) → Triage Agent (Decision) → Backend API (Update DB + Notify)
```

**Payload:**
```json
{
  "action": "analyze",
  "event": {
    "id": 123,
    "timestamp": "2025-10-09T12:00:00Z",
    "action": "BLOCK",
    "source_ip": "192.168.1.100",
    "uri": "/api/users",
    "http_method": "POST",
    "rule_name": "SQLi_BODY",
    "country": "US"
  }
}
```

### 2. Monitor Workflow
```
Scheduler → Monitor Agent (Pattern Detection) → Backend API (Fetch Events + Send Alerts)
```

**Payload:**
```json
{
  "action": "monitor",
  "hours": 24
}
```

### 3. Triage-Only Workflow
```
User → Triage Agent (Decision) → Backend API (Update Status + Notify)
```

**Payload:**
```json
{
  "action": "triage_only",
  "event": {...},
  "analysis": {
    "severity_rating": 4,
    "security_analysis": "...",
    "follow_up_suggestion": "..."
  }
}
```

## AgentCore Gateway Integration

The agent uses AgentCore Gateway to call backend APIs for:
- Fetching unprocessed events
- Fetching severity 3 events for monitoring
- Updating event analysis results
- Updating event status
- Sending notifications (SNS/Email)

Backend API endpoints are defined in `/aws/soc-lite/backend/agent-actions-api.yaml`

## Deployment

### Prerequisites
1. AWS Account with Bedrock AgentCore access (account: 581425340084, region: us-east-1)
2. Backend API deployed and accessible
3. `agentcore` CLI tool installed (`pip install bedrock-agentcore-starter-toolkit`)
4. Docker installed (optional - CodeBuild can build for you)

### Deployment Architecture

The deployment uses **AWS CodeBuild** to build ARM64 containers in the cloud:

```
Local Code → S3 Source Bucket → CodeBuild → ARM64 Docker Build → ECR → AgentCore Runtime
```

**Benefits:**
- ✅ No local Docker ARM64 build required (works on x86_64 systems)
- ✅ Automatic ECR repository creation and management
- ✅ Production-ready ARM64 images built in AWS
- ✅ OpenTelemetry instrumentation included automatically

### Deploy Steps

#### 1. Prepare Agent Code

Ensure your agent directory contains:
- `secops_agent.py` - Agent code
- `Dockerfile` - Docker configuration
- `requirements.txt` - Python dependencies
- `.bedrock_agentcore.yaml` - AgentCore configuration
- `.dockerignore` - Files to exclude from build

**Key Dockerfile Requirements:**
```dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app

# Environment variables
ENV UV_SYSTEM_PYTHON=1 \
    UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DOCKER_CONTAINER=1 \
    AWS_REGION=us-east-1 \
    AWS_DEFAULT_REGION=us-east-1

# Install dependencies with uv
COPY requirements.txt requirements.txt
RUN uv pip install -r requirements.txt

# Install OpenTelemetry (REQUIRED for AgentCore)
RUN uv pip install aws-opentelemetry-distro>=0.10.1

# Create non-root user
RUN useradd -m -u 1000 bedrock_agentcore
USER bedrock_agentcore

# Expose ports
EXPOSE 9000 8000 8080

# Copy agent code
COPY . .

# Run with OpenTelemetry instrumentation in module mode
CMD ["opentelemetry-instrument", "python", "-m", "secops_agent"]
```

**Key Requirements:**
- `bedrock-agentcore>=0.1.7` (not 0.1.0)
- `strands-agents>=1.11.0` (not 0.1.0)
- OpenTelemetry instrumentation is REQUIRED
- Run in module mode: `python -m secops_agent`
- Use non-root user for security

#### 2. Configure AgentCore

The `.bedrock_agentcore.yaml` file contains all deployment configuration:

```yaml
default_agent: secops_agent
agents:
  secops_agent:
    name: secops_agent
    entrypoint: secops_agent.py
    platform: linux/arm64  # CodeBuild handles ARM64
    container_runtime: docker
    aws:
      execution_role: arn:aws:iam::581425340084:role/AmazonBedrockAgentCoreSDKRuntime-us-east-1-c07010a437
      account: '581425340084'
      region: us-east-1
      ecr_repository: 581425340084.dkr.ecr.us-east-1.amazonaws.com/bedrock-agentcore-secops_agent
      ecr_auto_create: true
    codebuild:
      project_name: bedrock-agentcore-secops_agent-builder
      execution_role: arn:aws:iam::581425340084:role/AmazonBedrockAgentCoreSDKCodeBuild-us-east-1-8fd250891c
      source_bucket: bedrock-agentcore-codebuild-sources-581425340084-us-east-1
    memory:
      mode: STM_ONLY
      memory_id: secops_agent_mem-pFjGMyH4iq
```

**Key Configuration:**
- `platform: linux/arm64` - Targets ARM64 (built in CodeBuild)
- `ecr_auto_create: true` - Creates ECR repo automatically
- `codebuild` section - Defines CodeBuild project details

#### 3. Deploy Agent with CodeBuild

Navigate to agent directory and deploy:

```bash
cd /aws2/soc-lite/agentcore/runtime/secops-agent

# Deploy using CodeBuild (RECOMMENDED - no local Docker needed)
agentcore launch

# Alternative: Build locally then deploy (requires Docker + ARM64 support)
agentcore launch --local-build

# Alternative: Local development mode (runs locally, not in AWS)
agentcore launch --local
```

**What happens during `agentcore launch`:**

1. **Package Source** - Zips agent code respecting `.dockerignore`
2. **Upload to S3** - Uploads to CodeBuild source bucket
3. **Trigger CodeBuild** - Starts ARM64 container build in AWS
4. **Build Docker Image** - CodeBuild builds ARM64 image with OpenTelemetry
5. **Push to ECR** - Pushes image to ECR repository
6. **Deploy to AgentCore** - Creates/updates AgentCore runtime
7. **Configure Observability** - Sets up CloudWatch Logs, X-Ray tracing

**Deployment Output:**
```
✅ CodeBuild Deployment Successful!

Agent Details:
Agent Name: secops_agent
Agent ARN: arn:aws:bedrock-agentcore:us-east-1:581425340084:runtime/secops_agent-5htKASCV4N
ECR URI: 581425340084.dkr.ecr.us-east-1.amazonaws.com/bedrock-agentcore-secops_agent:latest
CodeBuild ID: bedrock-agentcore-secops_agent-builder:528c9cd6-212e-4720-94d6-f3e42396230b

🚀 ARM64 container deployed to Bedrock AgentCore

Next Steps:
   agentcore status
   agentcore invoke '{"prompt": "Hello"}'
```

#### 4. Verify Deployment

**Check agent status:**
```bash
agentcore status
```

**View logs:**
```bash
# Real-time logs
aws logs tail /aws/bedrock-agentcore/runtimes/secops_agent-5htKASCV4N-DEFAULT --follow

# Recent logs
aws logs tail /aws/bedrock-agentcore/runtimes/secops_agent-5htKASCV4N-DEFAULT --since 1h
```

**Test agent invocation:**
```bash
# Simple test
agentcore invoke '{"prompt": "Hello"}'

# Monitor workflow test
agentcore invoke '{"prompt": "{\"action\":\"monitor\",\"hours\":24}"}'
```

#### 5. Update Backend/Lambda

Copy the Agent ARN to your backend `.env` file:

```bash
# /aws2/soc-lite/apps/backend/.env
SECOPS_AGENT_ARN=arn:aws:bedrock-agentcore:us-east-1:581425340084:runtime/secops_agent-5htKASCV4N
```

Deploy backend to Lambda:
```bash
cd /aws2/soc-lite/apps/backend
npm run build
# Deploy to Lambda (see backend deployment docs)
```

### Troubleshooting

#### Agent fails to start
**Error:** `TypeError: Agent.__init__() got an unexpected keyword argument 'instructions'`

**Cause:** Strands SDK v1.11.0+ doesn't support `instructions` parameter

**Fix:** Pass instructions in the prompt, not Agent initialization:
```python
# ❌ Wrong
agent = Agent(model="amazon.nova-lite-v1:0", instructions="You are...")

# ✅ Correct
agent = Agent(model="amazon.nova-lite-v1:0")
result = agent("You are a security analyst. Analyze this event...")
```

#### Health check timeout
**Error:** `RuntimeClientError: Runtime health check failed or timed out`

**Cause:** Missing OpenTelemetry instrumentation or wrong CMD format

**Fix:** Ensure Dockerfile has:
```dockerfile
RUN uv pip install aws-opentelemetry-distro>=0.10.1
CMD ["opentelemetry-instrument", "python", "-m", "secops_agent"]
```

#### ARM64 build fails on x86_64
**Error:** `exec /bin/sh: exec format error`

**Cause:** Trying to build ARM64 locally on x86_64 system

**Fix:** Use CodeBuild deployment (default):
```bash
agentcore launch  # No --local-build flag
```

#### CodeBuild access denied
**Error:** Permission denied errors during CodeBuild

**Fix:** Verify IAM roles exist:
- Runtime role: `AmazonBedrockAgentCoreSDKRuntime-us-east-1-*`
- CodeBuild role: `AmazonBedrockAgentCoreSDKCodeBuild-us-east-1-*`

### Monitoring and Observability

**CloudWatch Logs:**
- Runtime logs: `/aws/bedrock-agentcore/runtimes/secops_agent-5htKASCV4N-DEFAULT`
- OpenTelemetry logs: Search for `otel-rt-logs` stream

**GenAI Observability Dashboard:**
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#gen-ai-observability/agent-core
```

**X-Ray Tracing:**
- Automatic trace collection enabled
- View in CloudWatch GenAI Observability dashboard
- Transaction search available after ~10 minutes

### Updating the Agent

To update agent code after deployment:

```bash
# 1. Make code changes
vim secops_agent.py

# 2. Redeploy
agentcore launch

# 3. Agent runtime automatically picks up new image
# Wait ~30 seconds for new version to be active
```

**Note:** AgentCore automatically pulls latest image on next invocation

## Configuration

### Environment Variables
- `LOG_LEVEL`: Logging level (default: INFO)
- `AGENT_NAME`: Agent identifier (default: secops-agent)
- `AWS_REGION`: AWS region (default: us-east-1)

### Gateway Configuration
After creating the AgentCore Gateway, update `.bedrock_agentcore.yaml`:
```yaml
gateway_configuration:
  gateway_id: <your-gateway-id>
  oauth:
    client_id: <your-client-id>
    client_secret: <your-client-secret>
```

## Testing

### Local Testing
```bash
python secops_agent.py
```

### Test Payloads

**Security Analysis:**
```bash
curl -X POST https://your-agent-endpoint/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "action": "analyze",
    "event": {
      "id": 123,
      "action": "BLOCK",
      "source_ip": "192.168.1.100",
      "uri": "/api/users",
      "rule_name": "SQLi_BODY"
    }
  }'
```

**Monitoring:**
```bash
curl -X POST https://your-agent-endpoint/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "action": "monitor",
    "hours": 24
  }'
```

## Response Format

All workflows return a standardized response:
```json
{
  "status": "success",
  "workflow": "analyze|monitor|triage_only",
  "analysis": {...},
  "triage": {...},
  "backend_actions": {
    "update_analysis": {...},
    "send_notification": {...}
  }
}
```

## Benefits Over Previous Architecture

✅ **Single Deployment** - One agent instead of three separate agents
✅ **Strands Orchestration** - Workflow logic in agent, not backend
✅ **AgentCore Gateway** - Secure API access with OAuth
✅ **Easier Maintenance** - Centralized logic and configuration
✅ **Scalable** - Easy to add more logical agents
✅ **Better Observability** - Unified logging and tracing

## Next Steps

1. ✅ Phase 1: Backend API endpoints created
2. ✅ Phase 2: SecOps agent implemented
3. ⏳ Phase 3: Setup AgentCore Gateway
4. ⏳ Phase 4: Deploy agent to AWS
5. ⏳ Phase 5: Update Lambda integration
6. ⏳ Phase 6: Update backend to use new agent
7. ⏳ Phase 7: Test all workflows
