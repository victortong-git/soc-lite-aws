# Web Application Firewall (WAF)

Scripts for managing AWS WAF Web ACLs and rules.

## Scripts

### setup-waf.sh
Creates Web ACL with AWS managed rule groups for common protections.

**Features:**
- AWS Managed Rules (Common Rule Set, Known Bad Inputs)
- Rate limiting (default: 2000 requests per 5 minutes)
- CloudWatch logging
- Associates with CloudFront distribution

**Usage:**
```bash
./setup-waf.sh
```

### configure-rules.sh
Adds custom rules to existing Web ACL.

**Usage:**
```bash
# Rate limiting
./configure-rules.sh \
  --web-acl-name soc-lite-waf \
  --rule-type rate-limit \
  --rule-name rate-limit-100 \
  --rate-limit 100

# IP blocking
./configure-rules.sh \
  --web-acl-name soc-lite-waf \
  --rule-type ip-set \
  --rule-name block-bad-ips \
  --ip-addresses '203.0.113.0/32,198.51.100.0/32' \
  --action block
```

## WAF Protection

### AWS Managed Rules Included
- **Core Rule Set** - OWASP Top 10 protections
- **Known Bad Inputs** - CVE patterns
- **SQL Injection** - Database attack protection
- **XSS** - Cross-site scripting prevention

### Custom Rules
- Rate limiting per IP
- IP whitelist/blacklist
- Geo-blocking
- Custom patterns

## Monitoring

WAF logs are sent to CloudWatch Logs and Kinesis Firehose for analysis by the SOC-Lite agents.

View WAF metrics:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name BlockedRequests \
  --start-time 2025-10-13T00:00:00Z \
  --end-time 2025-10-13T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

## Pricing

WAF pricing (as of 2025):
- Web ACL: $5.00 per month
- Rule: $1.00 per month per rule
- Requests: $0.60 per million requests

## Related Documentation
- [CloudFront Distribution](../../networking/cloudfront/README.md)
- [Security Overview](../README.md)
