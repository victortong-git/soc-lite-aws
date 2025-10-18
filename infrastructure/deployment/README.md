# Deployment Scripts

Orchestration scripts for deploying SOC-Lite infrastructure and applications.

## Scripts

### deploy-all.sh
Complete infrastructure deployment orchestrator.

**Usage:**
```bash
./deploy-all.sh
```

**Deploys:**
1. Backend Lambda + API Gateway
2. Frontend to S3 + CloudFront
3. WAF Web ACL
4. GoDaddy DNS updates

### deploy-frontend.sh
Deploys frontend application to S3 and CloudFront.

**Usage:**
```bash
./deploy-frontend.sh
```

**Steps:**
1. Builds React frontend
2. Creates/updates S3 bucket
3. Syncs build to S3
4. Creates/updates CloudFront distribution
5. Invalidates cache
6. Updates DNS records

### cleanup.sh
Removes deployed AWS resources.

**Usage:**
```bash
./cleanup.sh
```

**Warning:** This is destructive. Use with caution.

## Deployment Workflow

### First-Time Deployment

```bash
# 1. Configure environment
cd ../config
cp .env.example ../../apps/backend/.env
# Edit .env with your settings

# 2. Deploy AgentCore agents
cd ../../agentcore/runtime
./deploy-agents.sh

# 3. Run database migrations
cd ../../database/scripts
./run-migrations.sh

# 4. Deploy infrastructure
cd ../../infrastructure/deployment
./deploy-all.sh
```

### Update Deployment

```bash
# Backend only
cd ../compute/lambda
./update-lambda.sh --function-name soc-lite-backend --code-path /path/to/package.zip

# Frontend only
./deploy-frontend.sh

# Full redeployment
./deploy-all.sh
```

## Configuration

All deployment scripts use centralized configuration from `../config/config.sh`.

## Related Documentation

- [Compute Services](../compute/README.md)
- [Storage Services](../storage/README.md)
- [Networking Services](../networking/README.md)
- [Main Deployment Script](../../scripts/deploy.sh)
