# Lambda Functions

Scripts for deploying and managing AWS Lambda functions.

## Scripts

### deploy-lambda.sh

Deploys the SOC-Lite backend Lambda function with API Gateway.

**Features:**
- Builds TypeScript application
- Creates deployment package
- Sets up IAM role with necessary permissions
- Creates or updates Lambda function
- Configures API Gateway HTTP API
- Sets up routes and integrations

**Usage:**
```bash
./deploy-lambda.sh
```

**Configuration:**
- Uses `../../config/config.sh` for centralized settings
- Builds from `../../../apps/backend/`
- Creates function with Node.js 22 runtime
- Configures VPC access for RDS connection

**Output:**
- Lambda function ARN
- API Gateway URL
- Test commands

### update-lambda.sh

Updates an individual Lambda function without full redeployment.

**Features:**
- Update function code from zip file
- Update function configuration (handler, runtime, memory, timeout)
- Update environment variables
- Waits for updates to complete

**Usage:**
```bash
# Update code only
./update-lambda.sh --function-name my-function --code-path /path/to/package.zip

# Update configuration
./update-lambda.sh --function-name my-function --memory 1024 --timeout 300

# Update environment variables
./update-lambda.sh --function-name my-function --env LOG_LEVEL=debug --env NODE_ENV=production
```

**Options:**
- `--function-name` - Lambda function name (required)
- `--code-path` - Path to deployment package
- `--handler` - Handler function
- `--runtime` - Runtime version
- `--memory` - Memory size in MB
- `--timeout` - Timeout in seconds
- `--env` - Environment variable (KEY=VALUE format, can be repeated)

## Common Tasks

### Deploy Backend for First Time
```bash
./deploy-lambda.sh
```

### Update Backend Code After Changes
```bash
# Build and package backend
cd ../../../apps/backend
npm run build
cd ../../infrastructure/compute/lambda

# Update Lambda
./update-lambda.sh --function-name soc-lite-backend --code-path ../../../apps/backend/lambda-package.zip
```

### Update Environment Variables
```bash
./update-lambda.sh \
  --function-name soc-lite-backend \
  --env DB_HOST=new-database-endpoint.rds.amazonaws.com \
  --env API_KEY=new-api-key
```

### Increase Memory and Timeout
```bash
./update-lambda.sh \
  --function-name analysis-worker \
  --memory 2048 \
  --timeout 900
```

## IAM Permissions

Lambda execution role includes:
- `AWSLambdaBasicExecutionRole` - CloudWatch Logs
- `AWSLambdaVPCAccessExecutionRole` - VPC networking for RDS
- Bedrock AgentCore invoke permissions
- SNS publish permissions

## Environment Variables

The Lambda functions use these environment variables from `.env`:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`, `JWT_EXPIRY`
- `CORS_ORIGIN`
- `AWS_REGION`
- Agent ARNs for Bedrock AgentCore

## Monitoring

View Lambda logs:
```bash
aws logs tail /aws/lambda/soc-lite-backend --follow
```

Monitor function metrics in CloudWatch.

## Related Documentation

- [API Gateway](../api-gateway/README.md)
- [Compute Services Overview](../README.md)
