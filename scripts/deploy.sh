#!/bin/bash
# SOC-Lite Cloud Deployment Script
# This script deploys SOC-Lite to AWS
#
# Usage:
#   ./deploy-cloud.sh              # Full deployment
#   ./deploy-cloud.sh --skip-db    # Skip database migrations
#   ./deploy-cloud.sh --frontend-only  # Only deploy frontend
#   ./deploy-cloud.sh --backend-only   # Only deploy backend
#   ./deploy-cloud.sh --help       # Show help

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
SKIP_DB=false
FRONTEND_ONLY=false
BACKEND_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-db)
            SKIP_DB=true
            shift
            ;;
        --frontend-only)
            FRONTEND_ONLY=true
            shift
            ;;
        --backend-only)
            BACKEND_ONLY=true
            shift
            ;;
        --help|-h)
            echo "SOC-Lite Cloud Deployment Script"
            echo ""
            echo "Usage:"
            echo "  ./deploy-cloud.sh              # Full deployment"
            echo "  ./deploy-cloud.sh --skip-db    # Skip database migrations"
            echo "  ./deploy-cloud.sh --frontend-only  # Only deploy frontend"
            echo "  ./deploy-cloud.sh --backend-only   # Only deploy backend"
            echo "  ./deploy-cloud.sh --help       # Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run './deploy-cloud.sh --help' for usage"
            exit 1
            ;;
    esac
done

echo "🚀 SOC-Lite Cloud Deployment Started..."

# Check prerequisites
echo ""
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check for required commands
MISSING_DEPS=()
if ! command -v aws &> /dev/null; then
    MISSING_DEPS+=("aws-cli")
fi
if ! command -v jq &> /dev/null; then
    MISSING_DEPS+=("jq")
fi
if ! command -v npm &> /dev/null; then
    MISSING_DEPS+=("npm")
fi
if ! command -v psql &> /dev/null && [ "$SKIP_DB" = false ] && [ "$FRONTEND_ONLY" = false ]; then
    MISSING_DEPS+=("postgresql-client (psql)")
fi

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo -e "${RED}✗ Missing required dependencies:${NC}"
    for dep in "${MISSING_DEPS[@]}"; do
        echo "  - $dep"
    done
    echo ""
    echo "Please install missing dependencies and try again."
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"

# Configuration from .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
else
    echo -e "${RED}✗ .env file not found at $PROJECT_ROOT/.env${NC}"
    exit 1
fi

# Validate required variables
if [ -z "$DB_PASSWORD" ] || [ -z "$DB_HOST" ] || [ -z "$DB_USER" ]; then
    echo -e "${RED}✗ Required environment variables not set in .env${NC}"
    echo "Required: DB_PASSWORD, DB_HOST, DB_USER, DB_NAME, AWS_REGION"
    exit 1
fi

# Auto-discover all migration files (excluding rollback files)
# Sorted by filename to ensure they run in order (001, 002, 003, etc.)
DB_MIGRATION_FILES=()
while IFS= read -r -d '' file; do
    DB_MIGRATION_FILES+=("$file")
done < <(find "$PROJECT_ROOT/database/migrations" -name "*.sql" ! -name "*_rollback.sql" -print0 | sort -z)

echo ""
echo "========================================="
echo "  SOC-Lite Cloud Deployment"
echo "========================================="
echo ""
echo "📊 Configuration:"
echo "  Database: $DB_HOST"
echo "  Database Name: $DB_NAME"
echo "  AWS Region: $AWS_REGION"
echo "  Domain: aws1.c6web.com"
echo ""

# Step 1: Apply Database Migrations
if [ "$SKIP_DB" = true ] || [ "$FRONTEND_ONLY" = true ]; then
    echo ""
    echo -e "${YELLOW}Step 1: Skipping Database Migrations${NC}"
    echo "----------------------------------------"
    echo "Database migrations skipped (--skip-db or --frontend-only flag)"
else
    echo ""
    echo -e "${YELLOW}Step 1: Applying Database Migrations...${NC}"
    echo "----------------------------------------"

    MIGRATION_FAILED=0
for DB_MIGRATION_FILE in "${DB_MIGRATION_FILES[@]}"; do
    if [ -f "$DB_MIGRATION_FILE" ]; then
        echo "✓ Migration file found: $DB_MIGRATION_FILE"

        # Try to connect with SSL
        echo "Attempting to apply migration to cloud database..."
        PGPASSWORD="$DB_PASSWORD" psql \
            "sslmode=require host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER" \
            -f "$DB_MIGRATION_FILE" 2>&1 | tee /tmp/migration_$(basename "$DB_MIGRATION_FILE").log

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Migration applied: $(basename $DB_MIGRATION_FILE)${NC}"
        else
            echo -e "${RED}✗ Migration failed: $(basename $DB_MIGRATION_FILE)${NC}"
            MIGRATION_FAILED=1
        fi
        echo ""
    else
        echo -e "${YELLOW}⚠ Migration file not found (skipping): $DB_MIGRATION_FILE${NC}"
        echo ""
    fi
done

    if [ $MIGRATION_FAILED -eq 1 ]; then
        echo -e "${RED}✗ Some migrations failed. Check /tmp/migration_*.log${NC}"
        echo ""
        echo "Troubleshooting:"
        echo "1. Check RDS security group allows connections from this IP"
        echo "2. Verify database credentials in .env"
        echo "3. Run migrations manually from EC2 instance with RDS access"
        echo ""
        exit 1
    else
        echo -e "${GREEN}✓ All database migrations applied successfully!${NC}"
    fi
fi

# Step 2: Build Backend
if [ "$FRONTEND_ONLY" = true ]; then
    echo ""
    echo -e "${YELLOW}Step 2: Skipping Backend Build${NC}"
    echo "----------------------------------------"
    echo "Backend build skipped (--frontend-only flag)"
else
echo ""
echo -e "${YELLOW}Step 2: Building Backend...${NC}"
echo "----------------------------------------"
cd "$PROJECT_ROOT/apps/backend"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

# Build TypeScript
echo "Building TypeScript..."
npm run build

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Backend built successfully!${NC}"
    else
        echo -e "${RED}✗ Backend build failed${NC}"
        exit 1
    fi
fi

# Step 3: Build Frontend
if [ "$BACKEND_ONLY" = true ]; then
    echo ""
    echo -e "${YELLOW}Step 3: Skipping Frontend Build${NC}"
    echo "----------------------------------------"
    echo "Frontend build skipped (--backend-only flag)"
else
echo ""
echo -e "${YELLOW}Step 3: Building Frontend...${NC}"
echo "----------------------------------------"
cd "$PROJECT_ROOT/apps/frontend"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Build for production
echo "Building frontend for production..."
npm run build

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Frontend built successfully!${NC}"
        echo "  Build output: /aws/soc-lite/frontend/dist/"
    else
        echo -e "${RED}✗ Frontend build failed${NC}"
        exit 1
    fi
fi

# Step 4: Package Backend for Lambda
if [ "$FRONTEND_ONLY" = true ]; then
    echo ""
    echo -e "${YELLOW}Step 4: Skipping Backend Packaging${NC}"
    echo "----------------------------------------"
    echo "Backend packaging skipped (--frontend-only flag)"
else
echo ""
echo -e "${YELLOW}Step 4: Packaging Backend for Lambda...${NC}"
echo "----------------------------------------"
cd "$PROJECT_ROOT/apps/backend"

# Create deployment package
rm -f soc-lite-backend-new.zip
echo "Creating deployment package..."

# Include only necessary files
zip -r soc-lite-backend-new.zip \
    dist/ \
    node_modules/ \
    package.json \
    package-lock.json \
    .env \
    -x "node_modules/aws-sdk/*" \
    > /dev/null 2>&1

    if [ -f "soc-lite-backend-new.zip" ]; then
        SIZE=$(du -h soc-lite-backend-new.zip | cut -f1)
        echo -e "${GREEN}✓ Backend package created: soc-lite-backend-new.zip ($SIZE)${NC}"
    else
        echo -e "${RED}✗ Failed to create backend package${NC}"
        exit 1
    fi
fi

# Step 5: Deploy Frontend to S3
if [ "$BACKEND_ONLY" = true ]; then
    echo ""
    echo -e "${YELLOW}Step 5: Skipping Frontend Deployment${NC}"
    echo "----------------------------------------"
    echo "Frontend deployment skipped (--backend-only flag)"
else
echo ""
echo -e "${YELLOW}Step 5: Deploying Frontend to S3...${NC}"
echo "----------------------------------------"

# Check if AWS CLI is available and configured
if ! command -v aws &> /dev/null; then
    echo -e "${RED}✗ AWS CLI not found. Please install AWS CLI.${NC}"
    exit 1
fi

# Use fixed S3 bucket name - DO NOT CHANGE THIS!
# This bucket is ONLY for SOC Lite (aws1.c6web.com)
# Do NOT use web-hello-world-frontend (that's for monkeytour.com)
S3_BUCKET="soc-lite-frontend"

# Validation: Ensure we're deploying to the correct bucket
if [ "$S3_BUCKET" != "soc-lite-frontend" ]; then
    echo -e "${RED}✗ ERROR: Invalid S3 bucket name!${NC}"
    echo "  Expected: soc-lite-frontend"
    echo "  Got: $S3_BUCKET"
    echo ""
    echo "This script should ONLY deploy to soc-lite-frontend bucket."
    echo "If you need to deploy elsewhere, create a separate deployment script."
    exit 1
fi

# Check if bucket exists, create if it doesn't
echo "Checking S3 bucket: $S3_BUCKET..."
if ! aws s3 ls "s3://$S3_BUCKET" 2>/dev/null; then
    echo "S3 bucket does not exist. Creating..."

    # Create bucket
    aws s3 mb "s3://$S3_BUCKET" --region $AWS_REGION

    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to create S3 bucket${NC}"
        exit 1
    fi

    # Configure bucket for static website hosting
    aws s3 website "s3://$S3_BUCKET" \
        --index-document index.html \
        --error-document index.html

    # Set bucket policy for CloudFront OAI access
    echo "Setting bucket policy for CloudFront Origin Access Identity..."
    cat > /tmp/bucket-policy-cf.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontOAI",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity E2QXB2RA2BL75Q"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$S3_BUCKET/*"
        }
    ]
}
EOF

    aws s3api put-bucket-policy \
        --bucket "$S3_BUCKET" \
        --policy file:///tmp/bucket-policy-cf.json

    echo -e "${GREEN}✓ S3 bucket created and configured with CloudFront access${NC}"
fi

echo "Deploying frontend to S3 bucket: $S3_BUCKET..."

aws s3 sync "$PROJECT_ROOT/apps/frontend/dist/" s3://$S3_BUCKET/ --delete --cache-control "public,max-age=0,must-revalidate"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Frontend deployed to S3!${NC}"
        echo "  Bucket: s3://$S3_BUCKET"
    else
        echo -e "${RED}✗ Frontend deployment to S3 failed${NC}"
        exit 1
    fi
fi

# Step 6: Invalidate CloudFront Cache
if [ "$BACKEND_ONLY" = true ]; then
    echo ""
    echo -e "${YELLOW}Step 6: Skipping CloudFront Invalidation${NC}"
    echo "----------------------------------------"
    echo "CloudFront invalidation skipped (--backend-only flag)"
else
echo ""
echo -e "${YELLOW}Step 6: Invalidating CloudFront Cache...${NC}"
echo "----------------------------------------"

# Find CloudFront distribution for aws1.c6web.com
echo "Finding CloudFront distribution for aws1.c6web.com..."
CLOUDFRONT_ID=$(aws cloudfront list-distributions --output json | jq -r '.DistributionList.Items[] | select(.Aliases.Items[]? == "aws1.c6web.com") | .Id')

if [ -z "$CLOUDFRONT_ID" ]; then
    echo -e "${YELLOW}⚠ CloudFront distribution not found for aws1.c6web.com${NC}"
    echo "  Frontend deployed to S3 but cache not invalidated."
    echo "  You may need to wait for CloudFront TTL or invalidate manually."
else
    echo "Found CloudFront distribution: $CLOUDFRONT_ID"
    echo "Creating cache invalidation..."

    INVALIDATION_OUTPUT=$(aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_ID" \
        --paths "/*" \
        --output json)

    if [ $? -eq 0 ]; then
        INVALIDATION_ID=$(echo "$INVALIDATION_OUTPUT" | jq -r '.Invalidation.Id')
        echo -e "${GREEN}✓ CloudFront cache invalidation created!${NC}"
        echo "  Invalidation ID: $INVALIDATION_ID"
        echo "  Status: In Progress (typically completes in 1-3 minutes)"
    else
        echo -e "${YELLOW}⚠ CloudFront invalidation failed${NC}"
        echo "  You may need to invalidate manually or wait for TTL"
    fi
fi
fi

# Step 7: Deploy Backend to Lambda
if [ "$FRONTEND_ONLY" = true ]; then
    echo ""
    echo -e "${YELLOW}Step 7: Skipping Lambda Deployment${NC}"
    echo "----------------------------------------"
    echo "Lambda deployment skipped (--frontend-only flag)"
else
echo ""
echo -e "${YELLOW}Step 7: Deploying Backend to Lambda...${NC}"
echo "----------------------------------------"

LAMBDA_FUNCTION="soc-lite-backend"
LAMBDA_ZIP="$PROJECT_ROOT/apps/backend/soc-lite-backend-new.zip"

if [ ! -f "$LAMBDA_ZIP" ]; then
    echo -e "${RED}✗ Lambda package not found: $LAMBDA_ZIP${NC}"
    exit 1
fi

echo "Deploying backend to Lambda function: $LAMBDA_FUNCTION"
echo "Package: $LAMBDA_ZIP"

# Deploy to Lambda
aws lambda update-function-code \
    --function-name "$LAMBDA_FUNCTION" \
    --zip-file "fileb://$LAMBDA_ZIP" \
    --output json > /tmp/lambda-deploy.json

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend deployed to Lambda!${NC}"

    # Wait for Lambda to finish updating
    echo "Waiting for Lambda function to finish updating..."
    aws lambda wait function-updated --function-name "$LAMBDA_FUNCTION"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Lambda function updated successfully!${NC}"

        # Get function info
        LAMBDA_ARN=$(jq -r '.FunctionArn' /tmp/lambda-deploy.json)
        LAMBDA_VERSION=$(jq -r '.Version' /tmp/lambda-deploy.json)
        echo "  Function ARN: $LAMBDA_ARN"
        echo "  Version: $LAMBDA_VERSION"
    else
        echo -e "${YELLOW}⚠ Lambda update verification timed out${NC}"
        echo "  The function may still be updating. Check AWS Console."
    fi
else
    echo -e "${RED}✗ Lambda deployment failed${NC}"
    echo "  Check /tmp/lambda-deploy.json for details"
    exit 1
fi
fi

# Summary
echo ""
echo "========================================="
echo -e "${GREEN}  🎉 Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "✓ Database migrations: APPLIED"
echo "✓ Backend: BUILT & DEPLOYED to Lambda"
echo "✓ Frontend: BUILT & DEPLOYED to S3"
echo "✓ CloudFront cache: INVALIDATED"
echo ""
echo "📊 Deployment Details:"
echo "  Database: $DB_HOST"
echo "  Lambda Function: $LAMBDA_FUNCTION"
echo "  S3 Bucket: $S3_BUCKET"
if [ ! -z "$CLOUDFRONT_ID" ]; then
    echo "  CloudFront Distribution: $CLOUDFRONT_ID"
fi
echo ""
echo "🌐 Access Your Application:"
echo "  Frontend URL: https://aws1.c6web.com"
echo "  (CloudFront cache invalidation completes in 1-3 minutes)"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Test the deployment:"
echo "   - Visit https://aws1.c6web.com"
echo "   - Go to Analysis Jobs page to verify new features"
echo "   - Test job management functions (Pause, Resume, Clear)"
echo ""
echo "2. Monitor the deployment:"
echo "   - Lambda logs: aws logs tail /aws/lambda/$LAMBDA_FUNCTION --follow"
echo "   - CloudFront status: aws cloudfront get-distribution --id $CLOUDFRONT_ID"
echo ""
echo "3. If you see old content:"
echo "   - Wait 1-3 minutes for CloudFront invalidation"
echo "   - Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)"
echo "   - Check invalidation status:"
if [ ! -z "$INVALIDATION_ID" ]; then
    echo "     aws cloudfront get-invalidation --distribution-id $CLOUDFRONT_ID --id $INVALIDATION_ID"
fi
echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
