# SOC Lite C6 SecOps AI Agent - AWS Deployment Guide

Complete guide for deploying SOC Lite to AWS with all required infrastructure and services.

## Prerequisites

### Required Tools
- **Node.js 22.x** - Backend and Lambda runtime
- **Python 3.8+** - Bedrock AgentCore agents
- **PostgreSQL client (psql)** - Database management
- **AWS CLI v2** - AWS resource management
- **Git** - Source code management

### AWS Account Requirements
- Active AWS account with billing enabled
- AWS CLI configured with credentials (`aws configure`)
- IAM permissions for:
  - Lambda, API Gateway, S3, CloudFront
  - RDS, VPC, Security Groups
  - Bedrock AgentCore
  - IAM role creation
  - CloudWatch, EventBridge, SNS
  - WAF

### AWS Service Access
- **Bedrock AgentCore** access enabled in us-east-1
- **Amazon Nova Micro** model access granted
- Service quotas sufficient for Lambda, RDS, and other services

### Verify Prerequisites
```bash
# Check Node.js version
node --version  # Should be 22.x

# Check Python version
python3 --version  # Should be 3.8+

# Check AWS CLI
aws --version  # Should be 2.x
aws sts get-caller-identity  # Verify credentials

# Check PostgreSQL client
psql --version

# Check Bedrock access
aws bedrock list-foundation-models --region us-east-1
```

## Deployment Order

Deploy components in this exact order to satisfy dependencies:

1. **Infrastructure Setup** (VPC, Security Groups, IAM Roles)
2. **Database** (RDS PostgreSQL)
3. **Storage** (S3 Buckets)
4. **Monitoring** (SNS Topics, EventBridge Rules)
5. **Bedrock AgentCore Agents**
6. **Lambda Functions**
7. **Backend API** (Lambda + API Gateway)
8. **Frontend** (S3 + CloudFront)

## Step 1: Initial Configuration

### 1.1 Clone Repository
```bash
git clone <repository-url>
cd soc-lite
```

### 1.2 Configure Environment Variables
```bash
# Copy example configuration
cp config/.env.example apps/backend/.env

# Edit with your settings
nano apps/backend/.env
```

**Required Configuration:**
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=<your-account-id>

# Database (will be created in Step 2)
DB_HOST=<will-be-set-after-rds-creation>
DB_PORT=5432
DB_NAME=agentdb
DB_USER=agenticsoc
DB_PASSWORD=<generate-secure-password>
DB_SSL=true

# JWT Authentication
JWT_SECRET=$(openssl rand -base64 64)
JWT_EXPIRY=7d

# Email Alerts
ALERT_EMAIL=<your-email@example.com>

# CORS (update after CloudFront deployment)
CORS_ORIGIN=http://localhost:5173
```

### 1.3 Generate JWT Secret
```bash
# Generate secure JWT secret
openssl rand -base64 64

# Add to apps/backend/.env as JWT_SECRET
```

## Step 2: Deploy Infrastructure

### 2.1 Create VPC and Security Groups
```bash
cd infrastructure/networking

# Create VPC (if not using default)
./create-vpc.sh

# Create security groups for RDS and Lambda
./create-security-groups.sh
```

### 2.2 Create IAM Roles
```bash
cd infrastructure/security

# Create Lambda execution role
./create-lambda-role.sh

# Create RDS access role
./create-rds-role.sh

# Create Bedrock access role
./create-bedrock-role.sh
```

## Step 3: Deploy Database

### 3.1 Create RDS Instance
```bash
cd infrastructure/storage

# Create RDS PostgreSQL instance
./create-rds.sh

# Wait for RDS to be available (5-10 minutes)
aws rds wait db-instance-available --db-instance-identifier soc-lite-db

# Get RDS endpoint
aws rds describe-db-instances \
  --db-instance-identifier soc-lite-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

### 3.2 Update Database Configuration
```bash
# Update apps/backend/.env with RDS endpoint
DB_HOST=<rds-endpoint-from-above>
```

### 3.3 Run Database Migrations
```bash
cd database/scripts

# Run all migrations
./run-migrations.sh

# Verify schema
./verify-schema.sh
```

### 3.4 Create Default Admin User
The migrations automatically create a default admin user:
- **Username**: `admin`
- **Password**: Set during migration (check migration output)

⚠️ **Change this password immediately after first login!**

## Step 4: Deploy Storage

### 4.1 Create S3 Buckets
```bash
cd infrastructure/storage

# Create frontend hosting bucket
./create-frontend-bucket.sh

# Create Lambda deployment bucket (if needed)
./create-lambda-bucket.sh
```

## Step 5: Deploy Monitoring

### 5.1 Create SNS Topics
```bash
cd infrastructure/monitoring

# Create SNS topics for alerts
./create-sns-topics.sh

# Subscribe your email to topics
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:<ACCOUNT>:soc-lite-critical-alerts \
  --protocol email \
  --notification-endpoint <your-email@example.com>

# Confirm subscription via email
```

### 5.2 Update Environment with SNS ARNs
```bash
# Add to apps/backend/.env
SNS_TOPIC_ARN_CRITICAL=arn:aws:sns:us-east-1:<ACCOUNT>:soc-lite-critical-alerts
SNS_TOPIC_ARN_MONITORING=arn:aws:sns:us-east-1:<ACCOUNT>:soc-lite-monitoring
```

## Step 6: Deploy Bedrock AgentCore Agents

### 6.1 Setup Python Environment
```bash
cd agentcore/runtime

# Run quickstart script (first time only)
./QUICKSTART.sh

# Or manually:
./setup-venv.sh
source .venv/bin/activate
```

### 6.2 Deploy Agents
```bash
# Deploy all agents
./deploy-agents.sh

# Or deploy individually:
cd secops-agent
./deploy-secops.sh

cd ../bulk-analysis-agent
./deploy-bulk-analysis.sh
```

### 6.3 Get Agent ARNs
```bash
# Agent ARNs are saved in .bedrock_agentcore.yaml files
cat secops-agent/.bedrock_agentcore.yaml
cat bulk-analysis-agent/.bedrock_agentcore.yaml
```

### 6.4 Update Environment with Agent ARNs
```bash
# Add to apps/backend/.env
BEDROCK_AGENTCORE_SECOPS_AGENT_ARN=<secops-agent-arn>
BEDROCK_AGENTCORE_BULK_ANALYSIS_AGENT_ARN=<bulk-analysis-agent-arn>
```

### 6.5 Deploy Agent Action Gateways
```bash
cd agentcore/gateways

# Deploy API Gateway for agent callbacks
./deploy-gateway.sh

# Configure agents with gateway URL
./configure-agents.sh

# Test gateway
./test-gateway.sh
```

## Step 7: Deploy Lambda Functions

Deploy Lambda functions in dependency order:

### 7.1 Deploy Core Lambda Functions
```bash
# WAF event ingestion
cd lambda/get-waf-alert
./deploy.sh

# Event grouping
cd ../smart-analysis-task-generator
./deploy.sh

# Bulk analysis worker
cd ../smart-analysis-worker
./deploy.sh

# Manual analysis worker
cd ../manual-analysis-worker
./deploy.sh
```

### 7.2 Deploy Escalation Functions
```bash
# Escalation processor
cd lambda/escalation-processor
./deploy.sh

# WAF blocklist plugin
cd ../escalation-plugin-waf-blocklist
./deploy.sh

# ServiceNow plugin
cd ../escalation-plugin-servicenow
./deploy.sh
```

### 7.3 Deploy Monitoring Functions
```bash
# Monitoring trigger
cd lambda/monitoring-trigger
./deploy.sh

# Daily monitoring trigger
cd ../daily-monitoring-trigger
./deploy.sh
```

### 7.4 Configure Lambda Environment Variables
Each Lambda function needs environment variables set in AWS Console or via CLI:

```bash
# Example: Update smart-analysis-worker
aws lambda update-function-configuration \
  --function-name smart-analysis-worker \
  --environment Variables="{
    DB_HOST=<rds-endpoint>,
    DB_NAME=agentdb,
    DB_USER=agenticsoc,
    DB_PASSWORD=<password>,
    BEDROCK_AGENT_ARN=<bulk-analysis-agent-arn>
  }"
```

## Step 8: Deploy Backend API

### 8.1 Build Backend
```bash
cd apps/backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify build
ls -la dist/
```

### 8.2 Deploy Backend Lambda
```bash
cd infrastructure/compute

# Deploy backend as Lambda function
./deploy-backend-lambda.sh
```

### 8.3 Create API Gateway
```bash
# Create HTTP API Gateway
./create-api-gateway.sh

# Get API Gateway URL
aws apigatewayv2 get-apis \
  --query 'Items[?Name==`soc-lite-api`].ApiEndpoint' \
  --output text
```

### 8.4 Update CORS Configuration
```bash
# Update apps/backend/.env with API Gateway URL
CORS_ORIGIN=https://<api-gateway-url>,http://localhost:5173

# Redeploy backend with updated CORS
cd infrastructure/compute
./deploy-backend-lambda.sh
```

## Step 9: Deploy Frontend

### 9.1 Configure Frontend Environment
```bash
cd apps/frontend

# Create production environment file
cat > .env.production << EOF
VITE_API_URL=https://<api-gateway-url>/api
EOF
```

### 9.2 Build Frontend
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Verify build
ls -la dist/
```

### 9.3 Deploy to S3
```bash
cd infrastructure/deployment

# Deploy frontend to S3
./deploy-frontend.sh
```

### 9.4 Create CloudFront Distribution
```bash
cd infrastructure/networking

# Create CloudFront distribution
./create-cloudfront.sh

# Get CloudFront domain
aws cloudfront list-distributions \
  --query 'DistributionList.Items[?Comment==`soc-lite-frontend`].DomainName' \
  --output text
```

### 9.5 Update CORS with CloudFront URL
```bash
# Update apps/backend/.env
CORS_ORIGIN=https://<cloudfront-domain>,http://localhost:5173

# Redeploy backend
cd infrastructure/compute
./deploy-backend-lambda.sh
```

## Step 10: Configure EventBridge Triggers

### 10.1 Create EventBridge Rules
```bash
cd infrastructure/monitoring

# Create scheduled rules
./create-eventbridge-rules.sh
```

### 10.2 Configure Triggers
```bash
# Smart analysis every 5 minutes
aws events put-rule \
  --name soc-lite-smart-analysis \
  --schedule-expression "rate(5 minutes)"

aws events put-targets \
  --rule soc-lite-smart-analysis \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:<ACCOUNT>:function:smart-analysis-task-generator"

# Daily monitoring at 9 AM UTC
aws events put-rule \
  --name soc-lite-daily-monitoring \
  --schedule-expression "cron(0 9 * * ? *)"

aws events put-targets \
  --rule soc-lite-daily-monitoring \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:<ACCOUNT>:function:daily-monitoring-trigger"
```

## Step 11: Configure WAF Log Ingestion

### 11.1 Create CloudWatch Log Subscription
```bash
cd infrastructure/monitoring

# Create log subscription filter
./create-waf-log-subscription.sh
```

### 11.2 Configure WAF Logging
```bash
# Enable WAF logging to CloudWatch
aws wafv2 put-logging-configuration \
  --logging-configuration ResourceArn=<waf-arn>,LogDestinationConfigs=<cloudwatch-log-group-arn>
```

## Step 12: Verification and Testing

### 12.1 Test Database Connection
```bash
cd database/rds/scripts
./test-db.sh
```

### 12.2 Test Backend API
```bash
# Health check
curl https://<api-gateway-url>/health

# Login
curl -X POST https://<api-gateway-url>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your-password>"}'
```

### 12.3 Test Agent Invocation
```bash
# Test secops-agent
aws bedrock-agentcore invoke-agent \
  --agent-id <secops-agent-id> \
  --agent-alias-id TSTALIASID \
  --session-id test-session \
  --input-text "Test connection" \
  --region us-east-1
```

### 12.4 Test Frontend
```bash
# Open CloudFront URL in browser
open https://<cloudfront-domain>

# Login with admin credentials
# Verify dashboard loads
# Check event list
```

### 12.5 Test Event Ingestion
```bash
# Trigger a test WAF event or wait for real events
# Check CloudWatch logs
aws logs tail /aws/lambda/get-waf-alert --follow

# Verify event in database
psql -h <rds-endpoint> -U agenticsoc -d agentdb -c "SELECT COUNT(*) FROM waf_log;"
```

### 12.6 Test Analysis Workflow
```bash
# Wait for smart-analysis-task-generator to run (5 min)
# Check analysis jobs
curl https://<api-gateway-url>/api/analysis-jobs \
  -H "Authorization: Bearer <token>"

# Check CloudWatch logs
aws logs tail /aws/lambda/smart-analysis-worker --follow
```

## Automated Deployment

For convenience, use the automated deployment script:

```bash
# Full deployment
./scripts/deploy.sh

# Backend only
./scripts/deploy.sh --backend-only

# Frontend only
./scripts/deploy.sh --frontend-only

# Skip database migrations
./scripts/deploy.sh --skip-db
```

## Post-Deployment Configuration

### Update DNS (Optional)
```bash
# Point your domain to CloudFront
# Create CNAME record: app.yourdomain.com -> <cloudfront-domain>

# Update SSL certificate in CloudFront
# Use AWS Certificate Manager (ACM) for custom domain
```

### Configure Custom Domain
```bash
# Request ACM certificate
aws acm request-certificate \
  --domain-name app.yourdomain.com \
  --validation-method DNS

# Update CloudFront distribution with custom domain
# Update CORS_ORIGIN in backend .env
```

### Enable WAF Protection
```bash
cd infrastructure/security

# Create WAF web ACL
./create-waf.sh

# Associate with CloudFront
aws wafv2 associate-web-acl \
  --web-acl-arn <waf-arn> \
  --resource-arn <cloudfront-arn>
```

### Configure Backup
```bash
# Enable RDS automated backups
aws rds modify-db-instance \
  --db-instance-identifier soc-lite-db \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00"
```

## Monitoring and Maintenance

### View Logs
```bash
# Backend Lambda
aws logs tail /aws/lambda/soc-lite-backend --follow

# Agent logs
aws logs tail /aws/bedrock-agentcore/runtimes/<agent-id>-DEFAULT --follow

# WAF ingestion
aws logs tail /aws/lambda/get-waf-alert --follow
```

### Check Metrics
```bash
# Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=soc-lite-backend \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Update Application
```bash
# Pull latest code
git pull

# Redeploy
./scripts/deploy.sh
```

## Troubleshooting

### Database Connection Issues
```bash
# Check RDS status
aws rds describe-db-instances --db-instance-identifier soc-lite-db

# Check security groups
aws ec2 describe-security-groups --group-ids <sg-id>

# Test from Lambda VPC
cd database/rds/scripts
./test-db.sh
```

### Lambda Deployment Failures
```bash
# Check build
cd apps/backend
npm run build

# Check package size (must be < 50MB)
ls -lh soc-lite-backend.zip

# Check Lambda logs
aws logs tail /aws/lambda/soc-lite-backend --follow
```

### Agent Invocation Errors
```bash
# Check agent status
aws bedrock-agentcore describe-runtime --runtime-id <agent-id>

# View agent logs
aws logs tail /aws/bedrock-agentcore/runtimes/<agent-id>-DEFAULT --follow

# Verify IAM permissions
aws iam get-role --role-name bedrock-agent-role
```

### Frontend Not Loading
```bash
# Check S3 bucket
aws s3 ls s3://soc-lite-frontend/

# Check CloudFront distribution
aws cloudfront get-distribution --id <distribution-id>

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id <distribution-id> \
  --paths "/*"
```

### CORS Errors
```bash
# Verify CORS_ORIGIN in backend .env
# Must include CloudFront domain
CORS_ORIGIN=https://<cloudfront-domain>,http://localhost:5173

# Redeploy backend
cd infrastructure/compute
./deploy-backend-lambda.sh
```

## Security Checklist

- [ ] Change default admin password
- [ ] Rotate JWT secret regularly
- [ ] Enable MFA on AWS account
- [ ] Review IAM policies (principle of least privilege)
- [ ] Enable RDS encryption at rest
- [ ] Enable CloudWatch Logs encryption
- [ ] Configure VPC security groups (restrict access)
- [ ] Enable AWS CloudTrail for audit logging
- [ ] Set up AWS Config for compliance monitoring
- [ ] Configure SNS topic access policies
- [ ] Review Lambda function permissions
- [ ] Enable S3 bucket versioning
- [ ] Configure S3 bucket policies (block public access)
- [ ] Set up AWS Backup for RDS
- [ ] Enable GuardDuty for threat detection

## Cleanup / Teardown

To remove all AWS resources:

```bash
# Stop RDS to avoid charges
cd database/rds/scripts
./stop-db.sh

# Delete CloudFront distribution (takes 15-20 min)
aws cloudfront delete-distribution --id <distribution-id>

# Empty and delete S3 buckets
aws s3 rm s3://soc-lite-frontend --recursive
aws s3 rb s3://soc-lite-frontend

# Delete Lambda functions
aws lambda delete-function --function-name soc-lite-backend
# ... repeat for all Lambda functions

# Delete API Gateway
aws apigatewayv2 delete-api --api-id <api-id>

# Delete RDS instance
aws rds delete-db-instance \
  --db-instance-identifier soc-lite-db \
  --skip-final-snapshot

# Delete Bedrock agents
cd agentcore/runtime
# Delete via AWS Console or CLI

# Delete SNS topics
aws sns delete-topic --topic-arn <topic-arn>

# Delete EventBridge rules
aws events remove-targets --rule <rule-name> --ids "1"
aws events delete-rule --name <rule-name>
```

## Support

For deployment issues:
1. Check CloudWatch logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure AWS credentials have sufficient permissions
4. Review security group and VPC configurations
5. Check service quotas and limits

## Additional Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock/)
- [RDS PostgreSQL Documentation](https://docs.aws.amazon.com/rds/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
