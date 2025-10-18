# EventBridge Rules

Scripts for creating EventBridge rules to trigger Lambda functions on schedule or events.

## Scripts

### create-rules.sh
Creates scheduled or event-pattern rules with Lambda targets.

**Usage:**
```bash
# Scheduled rule
./create-rules.sh \
  --rule-name daily-monitoring \
  --rule-type schedule \
  --schedule 'rate(1 day)' \
  --target-arn arn:aws:lambda:us-east-1:123456789012:function:monitoring-trigger

# Every hour
./create-rules.sh \
  --rule-name hourly-check \
  --rule-type schedule \
  --schedule 'rate(1 hour)' \
  --target-arn arn:aws:lambda:...

# Cron expression (weekdays at 9 AM UTC)
./create-rules.sh \
  --rule-name weekday-report \
  --rule-type schedule \
  --schedule 'cron(0 9 ? * MON-FRI *)' \
  --target-arn arn:aws:lambda:...
```

## Schedule Expressions

**Rate:**
- `rate(5 minutes)`
- `rate(1 hour)`
- `rate(1 day)`

**Cron:**
- `cron(0 12 * * ? *)` - Every day at noon UTC
- `cron(0 9 ? * MON-FRI *)` - Weekdays at 9 AM UTC
- `cron(0 */6 * * ? *)` - Every 6 hours

## Management

```bash
# Enable rule
aws events enable-rule --name my-rule

# Disable rule
aws events disable-rule --name my-rule

# Delete rule
aws events delete-rule --name my-rule
```

## Related Documentation
- [Lambda Functions](../../compute/lambda/README.md)
- [Monitoring Overview](../README.md)
