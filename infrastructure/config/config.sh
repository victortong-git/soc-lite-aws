#!/bin/bash

################################################################################
# SOC Lite Configuration File
# Centralized configuration for all deployment scripts
################################################################################

# Source central configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
else
    echo "Error: .env file not found at $PROJECT_ROOT/.env"
    exit 1
fi

# Validate required variables
if [ -z "$DB_PASSWORD" ] || [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$JWT_SECRET" ]; then
    echo "Error: Required environment variables not set in .env"
    echo "Required: DB_PASSWORD, DB_HOST, DB_USER, JWT_SECRET, DOMAIN_NAME"
    exit 1
fi

# Project Configuration
export PROJECT_NAME="soc-lite"
export ENVIRONMENT="production"
export REGION="${AWS_REGION}"

# Domain Configuration (from .env)
export CORS_ORIGIN="https://${DOMAIN_NAME}"

# Lambda Configuration
export LAMBDA_FUNCTION_NAME="${PROJECT_NAME}-backend"
export LAMBDA_RUNTIME="nodejs22.x"
export LAMBDA_HANDLER="dist/lambda.handler"
export LAMBDA_MEMORY=512
export LAMBDA_TIMEOUT=30

# API Gateway Configuration
export API_NAME="${PROJECT_NAME}-api"
export API_STAGE="prod"

# S3 Configuration
export S3_BUCKET_NAME="${PROJECT_NAME}-frontend-$(date +%s)"
export S3_BUCKET_NAME_STATIC="${PROJECT_NAME}-frontend"

# CloudFront Configuration
export CF_PRICE_CLASS="PriceClass_100"  # US, Canada, Europe
export CF_COMMENT="SOC Lite Frontend Distribution"

# WAF Configuration
export WAF_ACL_NAME="${PROJECT_NAME}-cloudfront-waf"
export WAF_RATE_LIMIT=2000  # requests per 5 minutes per IP
export WAF_LOG_GROUP="/aws/wafv2/cloudfront/${PROJECT_NAME}"

# Colors for output
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export RED='\033[0;31m'
export BLUE='\033[0;34m'
export NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Validate AWS CLI
validate_aws_cli() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi

    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS CLI is not configured. Run 'aws configure'"
        exit 1
    fi

    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    export AWS_ACCOUNT_ID="$ACCOUNT_ID"
    log_info "AWS Account ID: $AWS_ACCOUNT_ID"
}

# Save deployment info
save_deployment_info() {
    local output_file="$1"
    cat > "$output_file" <<EOF
# SOC Lite Deployment Info
# Generated: $(date)

AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID
REGION=$REGION

# Lambda
LAMBDA_FUNCTION_NAME=$LAMBDA_FUNCTION_NAME
LAMBDA_ARN=$LAMBDA_ARN
API_GATEWAY_ID=$API_GATEWAY_ID
API_GATEWAY_URL=$API_GATEWAY_URL

# Frontend
S3_BUCKET_NAME=$S3_BUCKET_NAME
CLOUDFRONT_ID=$CLOUDFRONT_ID
CLOUDFRONT_URL=$CLOUDFRONT_URL

# WAF
WAF_ACL_ID=$WAF_ACL_ID
WAF_ACL_ARN=$WAF_ACL_ARN

# Domain
DOMAIN_NAME=$DOMAIN_NAME
EOF
    log_info "Deployment info saved to $output_file"
}
