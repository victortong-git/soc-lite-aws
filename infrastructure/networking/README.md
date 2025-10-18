# Networking Services

Infrastructure scripts for AWS networking services (CloudFront CDN, GoDaddy DNS).

## Directory Structure

```
networking/
├── cloudfront/          # CloudFront CDN management
│   ├── create-distribution.sh
│   ├── invalidate-cache.sh
│   ├── check-status.sh
│   └── README.md
├── dns/                 # GoDaddy DNS management
│   ├── update-dns.sh
│   ├── configure-domain.sh
│   └── README.md
└── README.md
```

## Quick Start

### Create CloudFront Distribution

```bash
cd cloudfront
./create-distribution.sh --origin-domain my-bucket.s3-website-us-east-1.amazonaws.com
```

### Invalidate CloudFront Cache

```bash
cd cloudfront
./invalidate-cache.sh --distribution-id E1234567890ABC --paths '/*'
```

### Update GoDaddy DNS

```bash
cd dns
./update-dns.sh --domain example.com --subdomain www --target d111111abcdef8.cloudfront.net
```

### Configure DNS Record

```bash
cd dns
./configure-domain.sh \
  --domain example.com \
  --record-type CNAME \
  --record-name www \
  --record-value d111111abcdef8.cloudfront.net
```

## Available Scripts

### CloudFront
- **create-distribution.sh** - Create CloudFront CDN distribution
- **invalidate-cache.sh** - Invalidate cached files
- **check-status.sh** - Check distribution deployment status

### DNS (GoDaddy)
- **update-dns.sh** - Update DNS records for website deployment
- **configure-domain.sh** - Configure specific DNS records (A, CNAME, TXT, etc.)

**Note:** This project uses GoDaddy for DNS management, not AWS Route53.

## Typical Workflow

### 1. Deploy Website with CloudFront

```bash
# Create S3 bucket for website
cd ../storage/s3
./create-bucket.sh --bucket-name my-site --purpose website --public

# Create CloudFront distribution
cd ../../networking/cloudfront
./create-distribution.sh --origin-domain my-site.s3-website-us-east-1.amazonaws.com

# Wait for deployment (15-30 minutes)
./check-status.sh --distribution-id E1234567890ABC

# Update DNS to point to CloudFront
cd ../dns
./configure-domain.sh \
  --domain example.com \
  --record-type CNAME \
  --record-name www \
  --record-value d111111abcdef8.cloudfront.net
```

### 2. Deploy Frontend Updates

```bash
# Build and sync frontend
cd ../storage/s3
./sync-frontend.sh \
  --bucket-name my-site \
  --distribution-id E1234567890ABC
```

The sync script automatically invalidates the CloudFront cache.

## Configuration

All scripts use the centralized configuration from `../config/config.sh`.

DNS scripts require `dns_api_key.txt` in the project root containing GoDaddy API credentials.

## Documentation

- [CloudFront Documentation](cloudfront/README.md)
- [DNS Documentation](dns/README.md)

## Related Services

- [S3 Bucket Management](../storage/s3/README.md)
- [WAF Protection](../security/waf/README.md)
