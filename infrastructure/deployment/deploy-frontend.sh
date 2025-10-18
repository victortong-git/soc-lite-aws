#!/bin/bash

################################################################################
# Step 2: Deploy Frontend to S3 + CloudFront
################################################################################

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Load Lambda deployment info
if [ -f "$SCRIPT_DIR/lambda-deployment.env" ]; then
    source "$SCRIPT_DIR/lambda-deployment.env"
else
    log_error "Lambda deployment info not found. Run 01-deploy-lambda.sh first"
    exit 1
fi

echo "================================================================================"
echo "Step 2: Deploy Frontend to S3 + CloudFront"
echo "================================================================================"
echo ""

validate_aws_cli

# Step 1: Build Frontend
log_step "Building frontend application..."
cd "$SCRIPT_DIR/../frontend"

if [ ! -f "package.json" ]; then
    log_error "Frontend package.json not found"
    exit 1
fi

# Update .env with API endpoint
log_info "Updating frontend environment variables..."
cat > .env <<EOF
VITE_API_URL=${API_ENDPOINT}/api
EOF

log_info "Installing dependencies..."
npm install

log_info "Building frontend..."
npm run build

if [ ! -d "dist" ]; then
    log_error "Build failed - dist directory not found"
    exit 1
fi

log_info "Frontend build successful ✓"
echo ""

# Step 2: Create S3 bucket
log_step "Creating S3 bucket..."

# Use a unique bucket name
export S3_BUCKET_NAME="${S3_BUCKET_NAME_STATIC}-$(date +%Y%m%d)"

if aws s3 ls "s3://$S3_BUCKET_NAME" 2>/dev/null; then
    log_info "S3 bucket already exists: $S3_BUCKET_NAME"
else
    log_info "Creating S3 bucket: $S3_BUCKET_NAME"

    if [ "$REGION" = "us-east-1" ]; then
        aws s3api create-bucket \
            --bucket "$S3_BUCKET_NAME" \
            --region "$REGION"
    else
        aws s3api create-bucket \
            --bucket "$S3_BUCKET_NAME" \
            --region "$REGION" \
            --create-bucket-configuration LocationConstraint="$REGION"
    fi

    log_info "S3 bucket created ✓"
fi

# Block public access (CloudFront will access via OAI)
log_info "Configuring S3 bucket settings..."
aws s3api put-public-access-block \
    --bucket "$S3_BUCKET_NAME" \
    --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable versioning
aws s3api put-bucket-versioning \
    --bucket "$S3_BUCKET_NAME" \
    --versioning-configuration Status=Enabled

log_info "S3 bucket configured ✓"
echo ""

# Step 3: Upload frontend files
log_step "Uploading frontend files to S3..."

aws s3 sync dist/ "s3://$S3_BUCKET_NAME/" \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "index.html"

# Upload index.html with no-cache
aws s3 cp dist/index.html "s3://$S3_BUCKET_NAME/index.html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html"

log_info "Frontend files uploaded ✓"
echo ""

# Step 4: Create CloudFront Origin Access Identity
log_step "Setting up CloudFront..."

log_info "Creating CloudFront Origin Access Identity..."

OAI_ID=$(aws cloudfront list-cloud-front-origin-access-identities \
    --query "CloudFrontOriginAccessIdentityList.Items[?Comment=='${PROJECT_NAME}-oai'].Id" \
    --output text 2>/dev/null)

if [ -z "$OAI_ID" ] || [ "$OAI_ID" = "None" ]; then
    OAI_RESPONSE=$(aws cloudfront create-cloud-front-origin-access-identity \
        --cloud-front-origin-access-identity-config \
            CallerReference="$(date +%s)",Comment="${PROJECT_NAME}-oai")

    OAI_ID=$(echo "$OAI_RESPONSE" | jq -r '.CloudFrontOriginAccessIdentity.Id')
    OAI_CANONICAL_USER=$(echo "$OAI_RESPONSE" | jq -r '.CloudFrontOriginAccessIdentity.S3CanonicalUserId')

    log_info "OAI created: $OAI_ID ✓"
else
    log_info "OAI already exists: $OAI_ID ✓"
    OAI_CANONICAL_USER=$(aws cloudfront get-cloud-front-origin-access-identity \
        --id "$OAI_ID" \
        --query 'CloudFrontOriginAccessIdentity.S3CanonicalUserId' \
        --output text)
fi

# Update S3 bucket policy to allow CloudFront OAI
log_info "Updating S3 bucket policy for CloudFront access..."

cat > /tmp/s3-bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity $OAI_ID"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${S3_BUCKET_NAME}/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
    --bucket "$S3_BUCKET_NAME" \
    --policy file:///tmp/s3-bucket-policy.json

log_info "S3 bucket policy updated ✓"
echo ""

# Step 5: Create CloudFront distribution
log_step "Creating CloudFront distribution..."

# Check if distribution already exists
EXISTING_CF_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Comment=='$CF_COMMENT'].Id" \
    --output text 2>/dev/null)

if [ -n "$EXISTING_CF_ID" ] && [ "$EXISTING_CF_ID" != "None" ]; then
    log_info "CloudFront distribution already exists: $EXISTING_CF_ID"
    export CLOUDFRONT_ID="$EXISTING_CF_ID"

    export CLOUDFRONT_URL=$(aws cloudfront get-distribution \
        --id "$CLOUDFRONT_ID" \
        --query 'Distribution.DomainName' \
        --output text)
else
    log_info "Creating new CloudFront distribution (this may take 10-15 minutes)..."

    CALLER_REF="$(date +%s)"
    cat > /tmp/cf-distribution-config.json <<EOF
{
  "CallerReference": "$CALLER_REF",
  "Comment": "$CF_COMMENT",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-${S3_BUCKET_NAME}",
        "DomainName": "${S3_BUCKET_NAME}.s3.${REGION}.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": "origin-access-identity/cloudfront/${OAI_ID}"
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-${S3_BUCKET_NAME}",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "Compress": true,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    }
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "Enabled": true,
  "PriceClass": "$CF_PRICE_CLASS"
}
EOF

    CF_RESPONSE=$(aws cloudfront create-distribution \
        --distribution-config file:///tmp/cf-distribution-config.json)

    export CLOUDFRONT_ID=$(echo "$CF_RESPONSE" | jq -r '.Distribution.Id')
    export CLOUDFRONT_URL=$(echo "$CF_RESPONSE" | jq -r '.Distribution.DomainName')

    log_info "CloudFront distribution created: $CLOUDFRONT_ID ✓"
    log_warn "Distribution is deploying... This takes 10-15 minutes"
fi

echo ""
echo "================================================================================"
echo "Frontend Deployment Complete! ✓"
echo "================================================================================"
echo ""
echo "S3 Bucket:"
echo "  Name:           $S3_BUCKET_NAME"
echo "  Region:         $REGION"
echo ""
echo "CloudFront:"
echo "  ID:             $CLOUDFRONT_ID"
echo "  URL:            https://$CLOUDFRONT_URL"
echo "  Status:         Deploying (10-15 minutes)"
echo ""
echo "Next Steps:"
echo "  1. Wait for CloudFront deployment to complete"
echo "  2. Test: https://$CLOUDFRONT_URL"
echo "  3. Run 03-setup-waf.sh to add WAF protection"
echo "  4. Run 04-update-dns.sh to configure custom domain"
echo ""
echo "================================================================================"

# Save deployment info
cat > "$SCRIPT_DIR/frontend-deployment.env" <<EOF
export S3_BUCKET_NAME="$S3_BUCKET_NAME"
export CLOUDFRONT_ID="$CLOUDFRONT_ID"
export CLOUDFRONT_URL="$CLOUDFRONT_URL"
export OAI_ID="$OAI_ID"
EOF

log_info "Deployment info saved to frontend-deployment.env"
