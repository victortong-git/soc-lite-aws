# SNS Topics

Scripts for creating SNS topics and email subscriptions for notifications.

## Scripts

### setup-topics.sh
Creates SNS topics with optional email subscriptions.

**Usage:**
```bash
# Basic topic
./setup-topics.sh --topic-name alerts --display-name 'Alerts'

# With email subscriptions
./setup-topics.sh \
  --topic-name soc-lite-critical-alerts \
  --display-name 'SOC Critical Alerts' \
  --email admin@example.com \
  --email ops@example.com

# With encryption
./setup-topics.sh \
  --topic-name secure-alerts \
  --kms-key-id arn:aws:kms:...
```

## Email Confirmation

Email subscribers must confirm their subscription by clicking the confirmation link sent to their email.

## Publishing Messages

```bash
# Simple message
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:123456789012:alerts \
  --message 'Test message' \
  --subject 'Test'

# From Lambda
# See apps/backend/src/services/agentCoreService.ts for examples
```

## Pricing

SNS pricing (as of 2025):
- First 1 million requests: $0.50 per million
- Email notifications: $2.00 per 100,000 notifications
- No charge for subscriptions

## Related Documentation
- [Monitoring Overview](../README.md)
