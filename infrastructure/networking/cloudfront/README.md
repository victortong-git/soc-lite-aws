# CloudFront CDN

Scripts for managing AWS CloudFront distributions for content delivery and caching.

## Scripts

### create-distribution.sh
Creates a CloudFront distribution for S3 website or custom origin.

**Usage:**
```bash
./create-distribution.sh --origin-domain my-bucket.s3-website-us-east-1.amazonaws.com
./create-distribution.sh --origin-domain api.example.com --origin-type custom --price-class all
```

### invalidate-cache.sh
Invalidates CloudFront cache for specified paths.

**Usage:**
```bash
./invalidate-cache.sh --distribution-id E1234567890ABC
./invalidate-cache.sh --distribution-id E1234567890ABC --paths '/index.html /assets/*'
./invalidate-cache.sh --distribution-id E1234567890ABC --wait
```

### check-status.sh
Checks CloudFront distribution deployment status.

**Usage:**
```bash
./check-status.sh --distribution-id E1234567890ABC
```

## Common Tasks

### Deploy Website with CloudFront
```bash
# Create distribution
./create-distribution.sh --origin-domain my-site.s3-website-us-east-1.amazonaws.com

# Check deployment status (takes 15-30 minutes)
./check-status.sh --distribution-id E1234567890ABC

# Once deployed, test
curl https://d111111abcdef8.cloudfront.net
```

### Update Website Content
```bash
# Sync new content to S3 (see storage/s3/sync-frontend.sh)
cd ../../storage/s3
./sync-frontend.sh --bucket-name my-site --distribution-id E1234567890ABC
# This automatically invalidates the cache
```

### Manual Cache Invalidation
```bash
# Invalidate all files
./invalidate-cache.sh --distribution-id E1234567890ABC --paths '/*'

# Invalidate specific files
./invalidate-cache.sh --distribution-id E1234567890ABC --paths '/index.html /about.html'
```

## CloudFront Benefits

- **Global CDN** - Content delivered from edge locations worldwide
- **HTTPS/SSL** - Free SSL certificates via AWS Certificate Manager
- **Performance** - Caching reduces origin load and improves speed
- **Security** - DDoS protection, WAF integration
- **Cost** - Reduces data transfer costs from origin

## Pricing

First 10 TB data transfer: Free to S3 origin
HTTP/HTTPS requests: $0.0075 per 10,000 requests
Invalidations: First 1,000 paths/month free, then $0.005 per path

## Related Documentation
- [S3 Sync Script](../../storage/s3/README.md)
- [DNS Configuration](../dns/README.md)
- [WAF Protection](../../security/waf/README.md)
