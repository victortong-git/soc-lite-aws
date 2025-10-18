# SOC-Lite Configuration Guide

## Configuration Files

### Backend Configuration
Copy `.env.example` to `apps/backend/.env` and update with your values:

```bash
cp config/.env.example apps/backend/.env
```

**Required Settings:**
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - RDS connection info
- `JWT_SECRET` - Generate a secure random string
- `AWS_REGION`, `AWS_ACCOUNT_ID` - Your AWS account details
- `BEDROCK_AGENTCORE_*_ARN` - Agent ARNs after deployment

### Frontend Configuration
Create `apps/frontend/.env`:

```bash
# Development
VITE_API_URL=http://localhost:3000/api

# Production
VITE_API_URL=https://aws1.c6web.com/api
```

### Infrastructure Configuration
Update `infrastructure/scripts/config.sh` with your deployment settings.

## Database Connection

### RDS Information
Get your RDS endpoint from AWS Console or use:

```bash
aws rds describe-db-instances --db-instance-identifier your-instance-name \
  --query 'DBInstances[0].Endpoint.Address' --output text
```

### Test Connection
```bash
cd database/rds/scripts
./test-db.sh
```

## Agent Deployment

### Deploy Agents
```bash
cd agents
./deploy-agents.sh
```

### Get Agent ARNs
```bash
# Check .bedrock_agentcore.yaml files for agent_arn values
cat agents/secops-agent/.bedrock_agentcore.yaml | grep agent_arn
cat agents/bulk-analysis-agent/.bedrock_agentcore.yaml | grep agent_arn
```

Update your backend `.env` with these ARNs.

## Security Notes

1. **Never commit `.env` files** - They contain sensitive credentials
2. **Use AWS Secrets Manager** for production credentials
3. **Rotate JWT secrets** regularly
4. **Restrict RDS security groups** to specific IPs
5. **Enable SSL/TLS** for all connections

## Deployment Checklist

- [ ] Copy `.env.example` to backend `.env`
- [ ] Update all database credentials
- [ ] Generate secure JWT secret
- [ ] Deploy agents and get ARNs
- [ ] Update agent ARNs in backend `.env`
- [ ] Configure SNS topics
- [ ] Set up alert email
- [ ] Test database connection
- [ ] Test agent invocations
- [ ] Deploy backend to Lambda
- [ ] Deploy frontend to S3/CloudFront
- [ ] Configure WAF
- [ ] Update DNS records
