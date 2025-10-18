# SOC-Lite Infrastructure

AWS infrastructure management scripts organized by service category.

## Directory Structure

```
infrastructure/
├── compute/            # Lambda, API Gateway
│   ├── lambda/         # Lambda function management
│   ├── api-gateway/    # API Gateway management
│   └── README.md
│
├── storage/            # S3, RDS
│   ├── s3/             # S3 bucket management
│   ├── rds/            # RDS management (symlinks to database/rds/scripts/)
│   └── README.md
│
├── networking/         # CloudFront, GoDaddy DNS
│   ├── cloudfront/     # CloudFront CDN
│   ├── dns/            # GoDaddy DNS (not Route53)
│   └── README.md
│
├── security/           # WAF, IAM
│   ├── waf/            # Web Application Firewall
│   ├── iam/            # IAM roles
│   └── README.md
│
├── monitoring/         # CloudWatch, EventBridge, SNS
│   ├── cloudwatch/     # CloudWatch Logs
│   ├── eventbridge/    # EventBridge rules
│   ├── sns/            # SNS topics
│   └── README.md
│
├── deployment/         # Orchestration scripts
│   ├── deploy-all.sh
│   ├── deploy-frontend.sh
│   ├── cleanup.sh
│   └── README.md
│
├── config/             # Centralized configuration
│   ├── config.sh
│   ├── .env.example
│   └── README.md
│
└── README.md           # This file
```

## Quick Start

### 1. Configure Environment

```bash
cd config
cp .env.example ../../apps/backend/.env
# Edit .env with your AWS credentials and settings
```

### 2. Deploy Full Infrastructure

```bash
cd deployment
./deploy-all.sh
```

This deploys:
- Backend Lambda + API Gateway
- Frontend to S3 + CloudFront
- WAF Web ACL
- GoDaddy DNS records

## Service Categories

### [Compute](compute/README.md)
AWS compute services for running application code.

**Services:**
- **Lambda Functions** - Serverless compute for backend API
- **API Gateway** - HTTP API for frontend-backend communication

**Scripts:** `deploy-lambda.sh`, `update-lambda.sh`, `setup-api-gateway.sh`

### [Storage](storage/README.md)
Data storage and database services.

**Services:**
- **S3** - Object storage for frontend assets
- **RDS PostgreSQL** - Relational database for WAF events

**Scripts:** `create-bucket.sh`, `sync-frontend.sh`, `start-db.sh`, `stop-db.sh`

### [Networking](networking/README.md)
Content delivery and DNS management.

**Services:**
- **CloudFront** - Global CDN for frontend delivery
- **GoDaddy DNS** - Domain name management (not AWS Route53)

**Scripts:** `create-distribution.sh`, `invalidate-cache.sh`, `update-dns.sh`, `configure-domain.sh`

### [Security](security/README.md)
Security and access control services.

**Services:**
- **WAF** - Web Application Firewall for attack protection
- **IAM** - Identity and access management roles

**Scripts:** `setup-waf.sh`, `configure-rules.sh`, `create-roles.sh`

### [Monitoring](monitoring/README.md)
Logging, scheduling, and notifications.

**Services:**
- **CloudWatch Logs** - Centralized application logging
- **EventBridge** - Scheduled rules for background jobs
- **SNS** - Email notifications for security alerts

**Scripts:** `setup-logs.sh`, `create-rules.sh`, `setup-topics.sh`

### [Deployment](deployment/README.md)
Orchestration scripts for automated deployments.

**Scripts:** `deploy-all.sh`, `deploy-frontend.sh`, `cleanup.sh`

### [Config](config/README.md)
Centralized configuration and environment templates.

**Files:** `config.sh`, `.env.example`

## Common Tasks

### Deploy Backend
```bash
cd compute/lambda
./deploy-lambda.sh
```

### Update Backend Code
```bash
cd compute/lambda
./update-lambda.sh --function-name soc-lite-backend --code-path /path/to/package.zip
```

### Deploy Frontend
```bash
cd deployment
./deploy-frontend.sh
```

### Setup WAF Protection
```bash
cd security/waf
./setup-waf.sh
```

### Create Scheduled Job
```bash
cd monitoring/eventbridge
./create-rules.sh \
  --rule-name daily-monitoring \
  --rule-type schedule \
  --schedule 'rate(1 day)' \
  --target-arn arn:aws:lambda:us-east-1:123456789012:function:monitoring-trigger
```

### Manage Database
```bash
cd storage/rds
./start-db.sh    # Start RDS instance
./status-db.sh   # Check status
./stop-db.sh     # Stop to save costs
```

### Sync Frontend to S3
```bash
cd storage/s3
./sync-frontend.sh \
  --bucket-name my-bucket \
  --distribution-id E1234567890ABC
```

### Update DNS Record
```bash
cd networking/dns
./configure-domain.sh \
  --domain example.com \
  --record-type CNAME \
  --record-name www \
  --record-value d111111abcdef8.cloudfront.net
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Internet                            │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴──────────┐
         │                      │
         ▼                      ▼
┌────────────────┐    ┌────────────────┐
│   CloudFront   │    │   API Gateway  │
│   (Frontend)   │    │   (Backend)    │
│      + WAF     │    │                │
└────────┬───────┘    └────────┬───────┘
         │                     │
         ▼                     ▼
┌────────────────┐    ┌────────────────┐
│   S3 Bucket    │    │     Lambda     │
│   (React App)  │    │   (Node.js)    │
└────────────────┘    └────────┬───────┘
                               │
         ┌─────────────────────┼─────────────────┐
         │                     │                 │
         ▼                     ▼                 ▼
┌────────────────┐    ┌────────────────┐  ┌──────────┐
│  RDS Postgres  │    │    Bedrock     │  │   SNS    │
│   (Database)   │    │   AgentCore    │  │ (Alerts) │
└────────────────┘    └────────────────┘  └──────────┘
         ▲                     ▲                 ▲
         │                     │                 │
         └─────────────────────┴─────────────────┘
                       EventBridge
                    (Scheduled Triggers)
```

### Data Flow

1. **User Access** → CloudFront serves React frontend from S3
2. **API Requests** → API Gateway routes to Lambda backend
3. **Database Queries** → Lambda queries RDS PostgreSQL
4. **AI Analysis** → Lambda invokes Bedrock AgentCore agents
5. **Scheduled Jobs** → EventBridge triggers monitoring Lambda
6. **Alerts** → SNS sends email notifications
7. **Security** → WAF protects CloudFront from attacks

## Script Conventions

All infrastructure scripts follow consistent patterns:

### Command-Line Interface
```bash
./script-name.sh [OPTIONS]
./script-name.sh --help  # Show usage information
```

### Configuration Loading
All scripts source `config/config.sh`:
```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"
```

### Logging Functions
- `log_info "Message"` - Green `[INFO]` for success
- `log_warn "Message"` - Yellow `[WARN]` for warnings
- `log_error "Message"` - Red `[ERROR]` for errors
- `log_step "Step Name"` - Cyan header for major steps

### Error Handling
- Validate required parameters
- Check preconditions before execution
- Exit with non-zero status on errors
- Provide helpful error messages

### AWS CLI Validation
```bash
validate_aws_cli  # Ensures AWS CLI is installed and configured
```

## Prerequisites

### Required Tools

Install these tools before running scripts:

```bash
# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# jq (JSON processor)
sudo apt install jq  # Debian/Ubuntu
sudo yum install jq  # CentOS/RHEL
brew install jq      # macOS

# Configure AWS CLI
aws configure
# Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output (json)
```

### AWS Permissions

IAM user/role needs these permissions:

**Compute:**
- `lambda:*` - Lambda function management
- `apigateway:*` - API Gateway management

**Storage:**
- `s3:*` - S3 bucket management
- `rds:Start*`, `rds:Stop*`, `rds:Describe*` - RDS management

**Networking:**
- `cloudfront:*` - CloudFront distribution management
- External: GoDaddy API access

**Security:**
- `wafv2:*` - WAF Web ACL management
- `iam:*` - IAM role management

**Monitoring:**
- `logs:*` - CloudWatch Logs
- `events:*` - EventBridge rules
- `sns:*` - SNS topics

### External Services

**GoDaddy DNS:**
- Create API key at https://developer.godaddy.com/keys
- Store in project root: `dns_api_key.txt` (format: `API_KEY:API_SECRET`)

## Cost Optimization

### Development Environment

**Save costs during development:**

```bash
# Stop RDS when not needed
cd storage/rds
./stop-db.sh

# Reduce Lambda memory
# Edit config.sh: LAMBDA_MEMORY=256

# Shorten log retention
cd monitoring/cloudwatch
./setup-logs.sh --log-group /aws/lambda/my-function --retention 7
```

### Production Environment

**Optimize production costs:**

1. **Use CloudFront caching** - Reduces origin requests and data transfer
2. **Configure S3 lifecycle policies** - Archive old versions to Glacier
3. **Set appropriate log retention** - Balance auditability with cost
4. **Use Lambda reserved concurrency** - Control concurrent executions
5. **Monitor CloudWatch metrics** - Identify and optimize expensive operations

### Cost Estimates

Monthly costs for moderate traffic (1M requests, 100GB transfer):

| Service | Cost |
|---------|------|
| Lambda (1M requests, 512MB, 500ms avg) | $0.20 |
| API Gateway HTTP API (1M requests) | $1.00 |
| S3 Storage (10GB) + Requests | $0.30 |
| CloudFront (100GB transfer, 1M requests) | $8.50 |
| WAF (1M requests inspected) | $6.00 |
| RDS t3.micro (730 hours) | $12.41 |
| CloudWatch Logs (10GB ingestion) | $5.00 |
| SNS (1000 emails) | $0.02 |
| **Total** | **~$33.43/month** |

**Savings tips:**
- Stop RDS during off-hours: Save ~$8/month
- Use CloudFront caching effectively: Reduce backend costs
- Set up billing alarms to track spending

## Security Best Practices

### Credential Management

**Never commit sensitive data:**
```bash
# .gitignore should include:
*.env
*_api_key.txt
deployment-*.env
```

**Use AWS IAM roles:**
- Prefer IAM roles over access keys when possible
- Rotate access keys every 90 days
- Enable MFA for AWS console access

**Secure API keys:**
- Store GoDaddy API key in `dns_api_key.txt` (not version controlled)
- Use AWS Secrets Manager for production credentials
- Rotate JWT secrets regularly

### Network Security

**Enable security features:**
```bash
# Always use HTTPS
- CloudFront: Redirect HTTP to HTTPS
- API Gateway: HTTPS only

# Enable WAF protection
cd security/waf
./setup-waf.sh

# Use VPC for database access
- Lambda functions use VPC to access RDS
- RDS not publicly accessible
```

### Access Control

**Follow least privilege:**
- Create service-specific IAM roles
- Use managed policies when available
- Regularly audit IAM permissions
- Enable CloudTrail for audit logging

### Monitoring Security

**Set up security monitoring:**
```bash
# WAF metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name BlockedRequests \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Lambda error rates
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=soc-lite-backend \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## Monitoring & Debugging

### View Logs

```bash
# Lambda logs
aws logs tail /aws/lambda/soc-lite-backend --follow

# WAF logs
aws logs tail /aws/wafv2/cloudfront/soc-lite --follow --region us-east-1

# Filter logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/soc-lite-backend \
  --filter-pattern "ERROR"
```

### Check Service Status

```bash
# Lambda function
aws lambda get-function --function-name soc-lite-backend

# API Gateway
aws apigatewayv2 get-api --api-id YOUR_API_ID

# CloudFront distribution
aws cloudfront get-distribution --id YOUR_DIST_ID

# RDS instance
aws rds describe-db-instances --db-instance-identifier agentic-soc-agent
```

### Test Endpoints

```bash
# API Gateway health check
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/health

# CloudFront
curl https://d111111abcdef8.cloudfront.net

# Test WAF rate limiting
for i in {1..2100}; do curl -s https://your-cloudfront-url; done
```

## Troubleshooting

### Common Issues

**"AWS CLI not found"**
```bash
# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

**"Permission denied" on scripts**
```bash
# Make all scripts executable
find infrastructure -name "*.sh" -exec chmod +x {} \;
```

**Lambda deployment fails**
```bash
# Check backend build
cd apps/backend
npm install
npm run build
ls -la dist/  # Verify dist/ exists

# Check .env file
ls -la .env
```

**CloudFront takes forever**
```bash
# This is normal - CloudFront deployments take 15-30 minutes
# Check status
aws cloudfront get-distribution --id E1234567890ABC --query 'Distribution.Status'
# Wait for "Deployed" status
```

**RDS connection fails**
```bash
# Check RDS status
cd storage/rds
./status-db.sh

# Start if stopped
./start-db.sh

# Test connection
cd ../../database/rds/scripts
./test-db.sh
```

**DNS not updating**
```bash
# Check DNS propagation (takes 5-10 minutes)
dig www.example.com
nslookup www.example.com

# Verify GoDaddy API key
cat dns_api_key.txt
# Should be: API_KEY:API_SECRET format
```

## Related Documentation

### Project Documentation
- [Main Project README](../README.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)
- [Architecture Documentation](../docs/ARCHITECTURE.md)

### Component Documentation
- [Database & Migrations](../database/README.md)
- [AgentCore Agents](../agentcore/README.md)
- [Lambda Functions](../lambda/README.md)
- [Backend Application](../apps/backend/README.md)
- [Frontend Application](../apps/frontend/README.md)

### Infrastructure Services
- [Compute Services](compute/README.md)
- [Storage Services](storage/README.md)
- [Networking Services](networking/README.md)
- [Security Services](security/README.md)
- [Monitoring Services](monitoring/README.md)
- [Deployment Scripts](deployment/README.md)
- [Configuration](config/README.md)

## Contributing

### Adding New Infrastructure Scripts

Follow these guidelines when creating new scripts:

1. **Location** - Place in appropriate service directory
   ```
   compute/, storage/, networking/, security/, or monitoring/
   ```

2. **Naming** - Use `action-resource.sh` format
   ```
   create-bucket.sh, update-lambda.sh, configure-domain.sh
   ```

3. **Structure** - Include standard sections:
   ```bash
   #!/bin/bash
   # Description
   # Configuration loading
   # Usage function
   # Argument parsing
   # Validation
   # Main logic
   # Output/summary
   ```

4. **Configuration** - Source centralized config
   ```bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   source "$SCRIPT_DIR/../../config/config.sh"
   ```

5. **Logging** - Use provided functions
   ```bash
   log_info "Success message"
   log_warn "Warning message"
   log_error "Error message"
   log_step "Major Step"
   ```

6. **Help** - Implement `--help` flag
   ```bash
   usage() {
       echo "Usage: $0 [OPTIONS]"
       echo "Options:"
       echo "  --option VALUE    Description"
       exit 1
   }
   ```

7. **Validation** - Check AWS CLI and permissions
   ```bash
   validate_aws_cli
   ```

8. **Documentation** - Update README.md
   - Add script to service README
   - Document usage examples
   - List requirements

9. **Permissions** - Make executable
   ```bash
   chmod +x script-name.sh
   ```

### Testing New Scripts

Before committing:
```bash
# Test with --help
./script-name.sh --help

# Test with invalid inputs
./script-name.sh --invalid-option

# Test successful execution
./script-name.sh --valid-options

# Test error handling
# (missing AWS credentials, invalid AWS resources, etc.)
```

## Support

For issues or questions:

1. **Check logs** - Review CloudWatch logs for errors
2. **Verify configuration** - Ensure `.env` and `config.sh` are correct
3. **Test AWS CLI** - Run `aws sts get-caller-identity`
4. **Check permissions** - Verify IAM policies
5. **Review documentation** - See service-specific READMEs
6. **Check troubleshooting** - See section above

## License

This infrastructure automation is part of the SOC-Lite project.
