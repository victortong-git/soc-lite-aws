# CloudWatch Logs

Scripts for managing CloudWatch log groups and retention policies.

## Scripts

### setup-logs.sh
Creates log groups with configurable retention and encryption.

**Usage:**
```bash
# Basic log group
./setup-logs.sh --log-group /aws/lambda/my-function

# With custom retention
./setup-logs.sh --log-group /aws/waf/my-webacl --retention 90

# With KMS encryption
./setup-logs.sh \
  --log-group /aws/lambda/my-function \
  --retention 365 \
  --kms-key-id arn:aws:kms:...
```

## Retention Periods

Valid retention periods (days): 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653

## Common Tasks

### View Logs
```bash
aws logs tail /aws/lambda/my-function --follow
```

### Query Logs
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/my-function \
  --filter-pattern "ERROR"
```

## Pricing

CloudWatch Logs pricing (as of 2025):
- Ingestion: $0.50 per GB
- Storage: $0.03 per GB per month
- Queries: $0.005 per GB scanned

## Related Documentation
- [Monitoring Overview](../README.md)
