# S3 Bucket Management

Scripts for creating and managing S3 buckets for website hosting and storage.

## Scripts

### create-bucket.sh

Creates an S3 bucket with security best practices.

**Features:**
- Creates bucket in specified region
- Configures public access block (default: private)
- Enables versioning (optional)
- Enables AES256 encryption
- Configures website hosting (optional)
- Adds lifecycle policy for old versions
- Applies public read policy for websites

**Usage:**
```bash
# Create private storage bucket
./create-bucket.sh --bucket-name my-storage-bucket

# Create public website bucket
./create-bucket.sh \
  --bucket-name my-website-bucket \
  --purpose website \
  --public

# Create bucket with versioning
./create-bucket.sh \
  --bucket-name my-versioned-bucket \
  --versioning
```

**Options:**
- `--bucket-name` - S3 bucket name (required, must be globally unique)
- `--purpose` - Bucket purpose: website|storage (default: storage)
- `--versioning` - Enable versioning (default: enabled)
- `--public` - Allow public access (default: private)

**Output:**
- Bucket ARN
- Website endpoint (if purpose=website)

### sync-frontend.sh

Uploads frontend build to S3 and optionally invalidates CloudFront cache.

**Features:**
- Syncs frontend dist/ directory to S3
- Sets appropriate cache headers:
  - Long cache (1 year) for static assets (JS, CSS, images)
  - Short cache (0s) for HTML files
- Optionally deletes files not in source
- Invalidates CloudFront distribution cache
- Dry-run mode for testing

**Usage:**
```bash
# Basic sync
./sync-frontend.sh --bucket-name my-website-bucket

# Sync with CloudFront invalidation
./sync-frontend.sh \
  --bucket-name my-website-bucket \
  --distribution-id E1234567890ABC

# Delete removed files
./sync-frontend.sh \
  --bucket-name my-website-bucket \
  --delete

# Test without uploading
./sync-frontend.sh \
  --bucket-name my-website-bucket \
  --dry-run
```

**Options:**
- `--bucket-name` - S3 bucket name (required)
- `--source-dir` - Source directory (default: ../../../apps/frontend/dist)
- `--distribution-id` - CloudFront distribution ID for cache invalidation
- `--delete` - Delete files in S3 that don't exist in source
- `--dry-run` - Show what would be uploaded without uploading

**Cache Strategy:**
```
Static Assets (JS, CSS, fonts, images):
  Cache-Control: public, max-age=31536000, immutable
  (1 year cache, relies on content hashes in filenames)

HTML Files:
  Cache-Control: public, max-age=0, must-revalidate
  (No cache, always check for updates)
```

## Common Tasks

### Setup Website Hosting

```bash
# 1. Create website bucket
./create-bucket.sh \
  --bucket-name my-website \
  --purpose website \
  --public

# 2. Build frontend
cd ../../../apps/frontend
npm run build
cd ../../infrastructure/storage/s3

# 3. Sync to S3
./sync-frontend.sh --bucket-name my-website

# 4. Access website
# http://my-website.s3-website-us-east-1.amazonaws.com
```

### Deploy Frontend Updates

```bash
# 1. Build frontend
cd ../../../apps/frontend
npm run build
cd ../../infrastructure/storage/s3

# 2. Sync to S3 with CloudFront invalidation
./sync-frontend.sh \
  --bucket-name my-website \
  --distribution-id E1234567890ABC \
  --delete
```

### Enable Versioning on Existing Bucket

```bash
aws s3api put-bucket-versioning \
  --bucket my-bucket \
  --versioning-configuration Status=Enabled
```

### List Bucket Versions

```bash
aws s3api list-object-versions \
  --bucket my-bucket \
  --prefix index.html
```

### Restore Previous Version

```bash
# Copy old version to new version
aws s3api copy-object \
  --copy-source my-bucket/index.html?versionId=VERSION_ID \
  --bucket my-bucket \
  --key index.html
```

## S3 Security Best Practices

### Private Buckets (Default)
- Block all public access
- Use IAM policies for access control
- Enable versioning
- Enable encryption at rest
- Enable access logging

### Public Website Buckets
- Only allow public read access to objects
- Block public write access
- Use CloudFront for HTTPS and caching
- Enable versioning for rollback capability
- Monitor access with CloudWatch

## Pricing

S3 Standard pricing (as of 2025):
- Storage: $0.023 per GB/month
- PUT requests: $0.005 per 1,000 requests
- GET requests: $0.0004 per 1,000 requests
- Data transfer out: First 10 TB free to CloudFront, then $0.09/GB

Use lifecycle policies to move old data to cheaper storage classes (S3 IA, Glacier).

## Monitoring

Monitor S3 metrics:
```bash
# View storage metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name BucketSizeBytes \
  --dimensions Name=BucketName,Value=my-bucket Name=StorageType,Value=StandardStorage \
  --start-time 2025-10-01T00:00:00Z \
  --end-time 2025-10-13T23:59:59Z \
  --period 86400 \
  --statistics Average
```

## Related Documentation

- [CloudFront Distribution](../../networking/cloudfront/README.md)
- [Storage Services Overview](../README.md)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
