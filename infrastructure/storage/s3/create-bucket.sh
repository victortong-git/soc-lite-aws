#!/bin/bash

# Create S3 Bucket with Versioning and Encryption
# Sets up S3 bucket for frontend hosting or general storage

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --bucket-name NAME      S3 bucket name (required)"
    echo "  --purpose PURPOSE       Bucket purpose: website|storage (default: storage)"
    echo "  --versioning            Enable versioning (default: enabled)"
    echo "  --public                Allow public access (default: private)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --bucket-name my-website-bucket --purpose website --public"
    echo "  $0 --bucket-name my-storage-bucket --purpose storage --versioning"
    exit 1
}

# Parse arguments
BUCKET_NAME=""
PURPOSE="storage"
ENABLE_VERSIONING=true
PUBLIC_ACCESS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --bucket-name)
            BUCKET_NAME="$2"
            shift 2
            ;;
        --purpose)
            PURPOSE="$2"
            shift 2
            ;;
        --versioning)
            ENABLE_VERSIONING=true
            shift
            ;;
        --public)
            PUBLIC_ACCESS=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required parameters
if [ -z "$BUCKET_NAME" ]; then
    log_error "Bucket name is required"
    usage
fi

echo "Creating S3 Bucket"
echo "=================="
echo ""
validate_aws_cli

# Check if bucket already exists
log_info "Checking if bucket $BUCKET_NAME exists..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
    log_warn "Bucket $BUCKET_NAME already exists"
    exit 0
fi

# Create bucket
log_step "Creating S3 bucket..."

if [ "$REGION" = "us-east-1" ]; then
    # us-east-1 doesn't need LocationConstraint
    aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --region "$REGION"
else
    aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --region "$REGION" \
        --create-bucket-configuration LocationConstraint="$REGION"
fi

log_info "Bucket created: $BUCKET_NAME ✓"
echo ""

# Configure public access block
log_step "Configuring public access..."

if [ "$PUBLIC_ACCESS" = true ]; then
    log_info "Allowing public access..."
    aws s3api put-public-access-block \
        --bucket "$BUCKET_NAME" \
        --public-access-block-configuration \
            "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
        --region "$REGION"
    log_info "Public access enabled ✓"
else
    log_info "Blocking public access (private bucket)..."
    aws s3api put-public-access-block \
        --bucket "$BUCKET_NAME" \
        --public-access-block-configuration \
            "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
        --region "$REGION"
    log_info "Public access blocked ✓"
fi

echo ""

# Enable versioning
if [ "$ENABLE_VERSIONING" = true ]; then
    log_step "Enabling versioning..."
    aws s3api put-bucket-versioning \
        --bucket "$BUCKET_NAME" \
        --versioning-configuration Status=Enabled \
        --region "$REGION"
    log_info "Versioning enabled ✓"
    echo ""
fi

# Enable encryption
log_step "Enabling encryption..."
aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            },
            "BucketKeyEnabled": true
        }]
    }' \
    --region "$REGION"

log_info "Encryption enabled (AES256) ✓"
echo ""

# Configure for website hosting if needed
if [ "$PURPOSE" = "website" ]; then
    log_step "Configuring website hosting..."

    aws s3api put-bucket-website \
        --bucket "$BUCKET_NAME" \
        --website-configuration '{
            "IndexDocument": {"Suffix": "index.html"},
            "ErrorDocument": {"Key": "index.html"}
        }' \
        --region "$REGION"

    log_info "Website hosting enabled ✓"

    # Add bucket policy for public read access
    if [ "$PUBLIC_ACCESS" = true ]; then
        aws s3api put-bucket-policy \
            --bucket "$BUCKET_NAME" \
            --policy "{
                \"Version\": \"2012-10-17\",
                \"Statement\": [{
                    \"Sid\": \"PublicReadGetObject\",
                    \"Effect\": \"Allow\",
                    \"Principal\": \"*\",
                    \"Action\": \"s3:GetObject\",
                    \"Resource\": \"arn:aws:s3:::$BUCKET_NAME/*\"
                }]
            }" \
            --region "$REGION"

        log_info "Public read policy applied ✓"
    fi

    echo ""
fi

# Add lifecycle policy for old versions (if versioning enabled)
if [ "$ENABLE_VERSIONING" = true ]; then
    log_step "Adding lifecycle policy..."

    aws s3api put-bucket-lifecycle-configuration \
        --bucket "$BUCKET_NAME" \
        --lifecycle-configuration '{
            "Rules": [{
                "Id": "DeleteOldVersions",
                "Status": "Enabled",
                "NoncurrentVersionExpiration": {
                    "NoncurrentDays": 90
                }
            }]
        }' \
        --region "$REGION"

    log_info "Lifecycle policy added (delete versions after 90 days) ✓"
    echo ""
fi

# Display bucket details
log_step "Bucket Details"
echo "  Bucket Name:     $BUCKET_NAME"
echo "  Region:          $REGION"
echo "  Purpose:         $PURPOSE"
echo "  Versioning:      $([ "$ENABLE_VERSIONING" = true ] && echo "Enabled" || echo "Disabled")"
echo "  Public Access:   $([ "$PUBLIC_ACCESS" = true ] && echo "Allowed" || echo "Blocked")"
echo "  Encryption:      AES256"
echo ""

if [ "$PURPOSE" = "website" ]; then
    WEBSITE_URL="http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
    echo "Website Endpoint: $WEBSITE_URL"
    echo ""
fi

echo "Bucket ARN: arn:aws:s3:::$BUCKET_NAME"
echo ""

log_info "S3 bucket created successfully! ✓"
echo ""
