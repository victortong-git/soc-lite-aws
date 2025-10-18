#!/bin/bash

# Sync Frontend Assets to S3
# Uploads frontend build to S3 bucket and invalidates CloudFront cache

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --bucket-name NAME      S3 bucket name (required)"
    echo "  --source-dir PATH       Source directory to sync (default: ../../../apps/frontend/dist)"
    echo "  --distribution-id ID    CloudFront distribution ID for cache invalidation (optional)"
    echo "  --delete                Delete files in S3 that don't exist in source"
    echo "  --dry-run               Show what would be uploaded without uploading"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --bucket-name my-website-bucket"
    echo "  $0 --bucket-name my-website-bucket --distribution-id E1234567890ABC"
    echo "  $0 --bucket-name my-website-bucket --delete --dry-run"
    exit 1
}

# Parse arguments
BUCKET_NAME=""
SOURCE_DIR=""
DISTRIBUTION_ID=""
DELETE_FLAG=""
DRY_RUN_FLAG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --bucket-name)
            BUCKET_NAME="$2"
            shift 2
            ;;
        --source-dir)
            SOURCE_DIR="$2"
            shift 2
            ;;
        --distribution-id)
            DISTRIBUTION_ID="$2"
            shift 2
            ;;
        --delete)
            DELETE_FLAG="--delete"
            shift
            ;;
        --dry-run)
            DRY_RUN_FLAG="--dryrun"
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

# Default source directory
if [ -z "$SOURCE_DIR" ]; then
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../" && pwd)"
    SOURCE_DIR="$PROJECT_ROOT/apps/frontend/dist"
fi

echo "Syncing Frontend to S3"
echo "======================"
echo ""
validate_aws_cli

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    log_error "Source directory not found: $SOURCE_DIR"
    log_error "Did you build the frontend? Run: cd apps/frontend && npm run build"
    exit 1
fi

# Check if bucket exists
log_info "Checking if bucket $BUCKET_NAME exists..."
if ! aws s3api head-bucket --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
    log_error "Bucket $BUCKET_NAME does not exist or you don't have permission to access it"
    exit 1
fi

log_info "Bucket found: $BUCKET_NAME ✓"
echo ""

# Display sync details
log_step "Sync Details"
echo "  Source:        $SOURCE_DIR"
echo "  Destination:   s3://$BUCKET_NAME"
echo "  Region:        $REGION"
echo "  Delete:        $([ -n "$DELETE_FLAG" ] && echo "Yes" || echo "No")"
echo "  Dry Run:       $([ -n "$DRY_RUN_FLAG" ] && echo "Yes" || echo "No")"
echo ""

# Count files to upload
FILE_COUNT=$(find "$SOURCE_DIR" -type f | wc -l)
log_info "Files to process: $FILE_COUNT"
echo ""

# Sync files
log_step "Syncing files to S3..."

SYNC_ARGS=(
    "$SOURCE_DIR/"
    "s3://$BUCKET_NAME/"
    --region "$REGION"
)

# Add cache control headers for different file types
SYNC_ARGS+=(
    --cache-control "public, max-age=31536000, immutable"
    --exclude "*"
    --include "*.js"
    --include "*.css"
    --include "*.woff"
    --include "*.woff2"
    --include "*.ttf"
    --include "*.svg"
    --include "*.png"
    --include "*.jpg"
    --include "*.jpeg"
    --include "*.gif"
    --include "*.ico"
)

if [ -n "$DELETE_FLAG" ]; then
    SYNC_ARGS+=("$DELETE_FLAG")
fi

if [ -n "$DRY_RUN_FLAG" ]; then
    SYNC_ARGS+=("$DRY_RUN_FLAG")
fi

# First sync static assets with long cache
aws s3 sync "${SYNC_ARGS[@]}"

# Then sync HTML files with short cache (they contain hashes to static assets)
log_info "Syncing HTML files with short cache..."
aws s3 sync \
    "$SOURCE_DIR/" \
    "s3://$BUCKET_NAME/" \
    --region "$REGION" \
    --cache-control "public, max-age=0, must-revalidate" \
    --exclude "*" \
    --include "*.html" \
    $([ -n "$DELETE_FLAG" ] && echo "$DELETE_FLAG") \
    $([ -n "$DRY_RUN_FLAG" ] && echo "$DRY_RUN_FLAG")

log_info "Sync complete ✓"
echo ""

# Invalidate CloudFront cache if distribution ID provided
if [ -n "$DISTRIBUTION_ID" ] && [ -z "$DRY_RUN_FLAG" ]; then
    log_step "Invalidating CloudFront cache..."

    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id "$DISTRIBUTION_ID" \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)

    log_info "Invalidation created: $INVALIDATION_ID"
    log_info "This may take a few minutes to complete..."

    # Check invalidation status
    STATUS=$(aws cloudfront get-invalidation \
        --distribution-id "$DISTRIBUTION_ID" \
        --id "$INVALIDATION_ID" \
        --query 'Invalidation.Status' \
        --output text)

    echo "  Status: $STATUS"
    echo ""
fi

# Display bucket URL
BUCKET_URL="http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"

log_info "Frontend sync complete! ✓"
echo ""
echo "Bucket URL: $BUCKET_URL"

if [ -n "$DISTRIBUTION_ID" ]; then
    CLOUDFRONT_URL=$(aws cloudfront get-distribution \
        --id "$DISTRIBUTION_ID" \
        --query 'Distribution.DomainName' \
        --output text 2>/dev/null || echo "")

    if [ -n "$CLOUDFRONT_URL" ]; then
        echo "CloudFront URL: https://$CLOUDFRONT_URL"
    fi
fi

echo ""
