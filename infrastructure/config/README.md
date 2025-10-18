# Configuration

Centralized configuration for all infrastructure scripts.

## Files

### config.sh
Centralized configuration loaded by all infrastructure scripts.

**Contains:**
- AWS region and account settings
- Function names and runtime configurations
- Color codes for terminal output
- Helper functions (log_info, log_error, etc.)
- AWS CLI validation

**Usage:**
```bash
# Load configuration in scripts
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"
```

### .env.example
Template for backend environment variables.

**Setup:**
```bash
cp .env.example ../../apps/backend/.env
# Edit .env with your actual credentials
```

## Environment Variables

Required variables (in `../../apps/backend/.env`):

### Database
- `DB_HOST` - RDS endpoint
- `DB_PORT` - Database port (5432)
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password

### JWT
- `JWT_SECRET` - Secret for token signing
- `JWT_EXPIRY` - Token expiration (e.g., 7d)

### AWS
- `AWS_REGION` - AWS region (e.g., us-east-1)
- `SECURITY_AGENT_ARN` - Bedrock AgentCore ARN
- `TRIAGE_AGENT_ARN` - Bedrock AgentCore ARN
- `MONITORING_AGENT_ARN` - Bedrock AgentCore ARN
- `BULK_ANALYSIS_AGENT_ARN` - Bedrock AgentCore ARN

### SNS
- `SNS_TOPIC_ARN_CRITICAL` - Critical alerts topic
- `SNS_TOPIC_ARN_MONITORING` - Monitoring alerts topic
- `ALERT_EMAIL` - Email for notifications

## Helper Functions

### Logging
```bash
log_info "Message"     # Green [INFO]
log_warn "Message"     # Yellow [WARN]
log_error "Message"    # Red [ERROR]
log_step "Step Name"   # Cyan step header
```

### Validation
```bash
validate_aws_cli       # Check AWS CLI installed and configured
```

## Security Best Practices

- Never commit `.env` files to version control
- Use strong, unique passwords
- Rotate JWT secrets regularly
- Store API keys in separate files (e.g., `bedrock_api_key.txt`, `dns_api_key.txt`)
- Use AWS IAM roles when possible instead of access keys

## Related Documentation

- [Deployment Scripts](../deployment/README.md)
- [Main Infrastructure README](../README.md)
