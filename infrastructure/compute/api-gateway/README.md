# API Gateway

Scripts for managing AWS API Gateway HTTP APIs.

## Scripts

### setup-api-gateway.sh

Creates an HTTP API Gateway and connects it to a Lambda function.

**Features:**
- Creates or gets existing API Gateway
- Configures CORS settings
- Creates Lambda integration with AWS_PROXY
- Sets up catch-all and root routes
- Creates API stage (default: prod)
- Adds Lambda invoke permissions

**Usage:**
```bash
# Basic setup
./setup-api-gateway.sh \
  --api-name soc-lite-api \
  --function-name soc-lite-backend

# With custom settings
./setup-api-gateway.sh \
  --api-name my-api \
  --function-name my-lambda \
  --stage dev \
  --cors-origin "https://example.com" \
  --description "My API Gateway"
```

**Options:**
- `--api-name` - API Gateway name (required)
- `--function-name` - Lambda function name (required)
- `--stage` - API stage (default: prod)
- `--cors-origin` - CORS allowed origin (default: *)
- `--description` - API description

**Output:**
- API ID
- API endpoint URL
- Test commands

## API Gateway Features

### HTTP API vs REST API

This script creates HTTP APIs (API Gateway v2) which offer:
- Lower cost (up to 71% cheaper)
- Lower latency
- Automatic deployments
- Built-in CORS support
- Simpler configuration

### Routes

The script creates two routes:
- `ANY /{proxy+}` - Catch-all route for all paths
- `ANY /` - Root route

These routes forward all HTTP methods (GET, POST, PUT, DELETE, etc.) to the Lambda function.

### CORS Configuration

CORS is configured with:
- Allowed origins (configurable)
- All HTTP methods
- Content-Type and Authorization headers
- Credentials support

## Common Tasks

### Create New API Gateway
```bash
./setup-api-gateway.sh --api-name my-api --function-name my-lambda
```

### Update CORS Settings
Use AWS CLI directly:
```bash
aws apigatewayv2 update-api \
  --api-id YOUR_API_ID \
  --cors-configuration "AllowOrigins=https://example.com,AllowMethods=*,AllowHeaders=*"
```

### Add Custom Domain
```bash
# Create domain name
aws apigatewayv2 create-domain-name \
  --domain-name api.example.com \
  --domain-name-configurations CertificateArn=arn:aws:acm:...

# Create API mapping
aws apigatewayv2 create-api-mapping \
  --domain-name api.example.com \
  --api-id YOUR_API_ID \
  --stage prod
```

### Monitor API Usage
```bash
# View CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiId,Value=YOUR_API_ID \
  --start-time 2025-10-13T00:00:00Z \
  --end-time 2025-10-13T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

## Integration with Lambda

The API Gateway is configured with:
- Integration type: `AWS_PROXY`
- Payload format: 2.0
- Auto-deploy enabled

Lambda receives requests in this format:
```json
{
  "version": "2.0",
  "routeKey": "ANY /api/events",
  "rawPath": "/api/events",
  "requestContext": { ... },
  "headers": { ... },
  "body": "..."
}
```

## Security

### Authentication

Add AWS IAM or JWT authorizer:
```bash
aws apigatewayv2 create-authorizer \
  --api-id YOUR_API_ID \
  --authorizer-type JWT \
  --identity-source '$request.header.Authorization' \
  --jwt-configuration Audience=...,Issuer=...
```

### Rate Limiting

Configure throttling:
```bash
aws apigatewayv2 update-stage \
  --api-id YOUR_API_ID \
  --stage-name prod \
  --throttle-settings RateLimit=1000,BurstLimit=2000
```

### WAF Protection

Attach Web ACL (see [Security/WAF](../../security/waf/README.md)).

## Pricing

HTTP APIs pricing (as of 2025):
- First 300 million requests: $1.00 per million
- Next 700 million requests: $0.90 per million
- Over 1 billion requests: $0.80 per million

No data transfer charges within AWS.

## Related Documentation

- [Lambda Functions](../lambda/README.md)
- [Compute Services Overview](../README.md)
- [AWS API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
