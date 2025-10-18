#!/bin/bash

################################################################################
# Cleanup Script for SOC Lite
# Removes all deployed AWS resources
################################################################################

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "================================================================================"
echo "SOC Lite - Cleanup & Resource Deletion"
echo "================================================================================"
echo ""

log_warn "⚠️  WARNING: This will DELETE all SOC Lite resources!"
echo ""
echo "Resources to be deleted:"
echo "  - Lambda function"
echo "  - API Gateway"
echo "  - IAM roles"
echo "  - S3 bucket (and all contents)"
echo "  - CloudFront distribution"
echo "  - WAF Web ACL"
echo "  - CloudWatch log groups"
echo ""

validate_aws_cli

# Load deployment info if exists
source "$SCRIPT_DIR/lambda-deployment.env" 2>/dev/null || true
source "$SCRIPT_DIR/frontend-deployment.env" 2>/dev/null || true
source "$SCRIPT_DIR/waf-deployment.env" 2>/dev/null || true

read -p "Type 'DELETE' to confirm: " CONFIRM

if [ "$CONFIRM" != "DELETE" ]; then
    log_info "Cleanup cancelled"
    exit 0
fi

echo ""
log_warn "Starting cleanup process..."
echo ""

# Step 1: Disassociate and delete WAF
if [ -n "$WAF_ACL_ARN" ]; then
    log_step "Removing WAF protection..."

    if [ -n "$CLOUDFRONT_ID" ]; then
        log_info "Disassociating WAF from CloudFront..."
        CF_ARN="arn:aws:cloudfront::${AWS_ACCOUNT_ID}:distribution/${CLOUDFRONT_ID}"

        aws wafv2 disassociate-web-acl \
            --resource-arn "$CF_ARN" \
            --region us-east-1 2>/dev/null || log_warn "WAF already disassociated"
    fi

    log_info "Deleting WAF Web ACL..."

    # Get lock token
    LOCK_TOKEN=$(aws wafv2 get-web-acl \
        --scope CLOUDFRONT \
        --region us-east-1 \
        --id "$WAF_ACL_ID" \
        --name "$WAF_ACL_NAME" \
        --query 'LockToken' \
        --output text 2>/dev/null)

    if [ -n "$LOCK_TOKEN" ]; then
        aws wafv2 delete-web-acl \
            --scope CLOUDFRONT \
            --region us-east-1 \
            --id "$WAF_ACL_ID" \
            --name "$WAF_ACL_NAME" \
            --lock-token "$LOCK_TOKEN" 2>/dev/null || log_warn "Failed to delete WAF ACL"

        log_info "WAF Web ACL deleted ✓"
    fi
fi

# Step 2: Delete CloudFront distribution
if [ -n "$CLOUDFRONT_ID" ]; then
    log_step "Deleting CloudFront distribution..."

    # Disable distribution first
    log_info "Disabling CloudFront distribution..."

    CF_ETAG=$(aws cloudfront get-distribution \
        --id "$CLOUDFRONT_ID" \
        --query 'ETag' \
        --output text 2>/dev/null)

    if [ -n "$CF_ETAG" ]; then
        aws cloudfront get-distribution-config \
            --id "$CLOUDFRONT_ID" \
            --query 'DistributionConfig' \
            --output json > /tmp/cf-config.json 2>/dev/null

        jq '.Enabled = false' /tmp/cf-config.json > /tmp/cf-config-disabled.json

        aws cloudfront update-distribution \
            --id "$CLOUDFRONT_ID" \
            --distribution-config file:///tmp/cf-config-disabled.json \
            --if-match "$CF_ETAG" 2>/dev/null || log_warn "Failed to disable CloudFront"

        log_warn "Waiting for CloudFront to disable (this may take 10-15 minutes)..."
        log_info "You may need to run this cleanup script again later to delete CloudFront"
    fi
fi

# Step 3: Delete S3 bucket
if [ -n "$S3_BUCKET_NAME" ]; then
    log_step "Deleting S3 bucket..."

    log_info "Emptying S3 bucket..."
    aws s3 rm "s3://$S3_BUCKET_NAME/" --recursive 2>/dev/null || log_warn "Bucket may be empty"

    log_info "Deleting S3 bucket..."
    aws s3 rb "s3://$S3_BUCKET_NAME/" --force 2>/dev/null || log_warn "Failed to delete bucket"

    log_info "S3 bucket deleted ✓"
fi

# Step 4: Delete API Gateway
if [ -n "$API_GATEWAY_ID" ]; then
    log_step "Deleting API Gateway..."

    aws apigatewayv2 delete-api \
        --api-id "$API_GATEWAY_ID" \
        --region "$REGION" 2>/dev/null || log_warn "Failed to delete API Gateway"

    log_info "API Gateway deleted ✓"
fi

# Step 5: Delete Lambda function
if [ -n "$LAMBDA_FUNCTION_NAME" ]; then
    log_step "Deleting Lambda function..."

    aws lambda delete-function \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --region "$REGION" 2>/dev/null || log_warn "Failed to delete Lambda function"

    log_info "Lambda function deleted ✓"
fi

# Step 6: Delete IAM role
log_step "Deleting IAM role..."

ROLE_NAME="${LAMBDA_FUNCTION_NAME}-role"

if aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null; then
    log_info "Detaching policies from IAM role..."

    aws iam detach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" 2>/dev/null || true

    aws iam detach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole" 2>/dev/null || true

    log_info "Deleting IAM role..."
    aws iam delete-role --role-name "$ROLE_NAME" 2>/dev/null || log_warn "Failed to delete IAM role"

    log_info "IAM role deleted ✓"
fi

# Step 7: Delete CloudWatch log groups
log_step "Deleting CloudWatch log groups..."

aws logs delete-log-group \
    --log-group-name "/aws/lambda/$LAMBDA_FUNCTION_NAME" \
    --region "$REGION" 2>/dev/null || log_warn "Lambda log group not found"

if [ -n "$WAF_LOG_GROUP" ]; then
    aws logs delete-log-group \
        --log-group-name "$WAF_LOG_GROUP" \
        --region us-east-1 2>/dev/null || log_warn "WAF log group not found"
fi

log_info "CloudWatch log groups deleted ✓"

# Step 8: Clean up local files
log_step "Cleaning up local deployment files..."

rm -f "$SCRIPT_DIR/lambda-deployment.env"
rm -f "$SCRIPT_DIR/frontend-deployment.env"
rm -f "$SCRIPT_DIR/waf-deployment.env"
rm -f "$SCRIPT_DIR/dns-deployment.env"
rm -f "$SCRIPT_DIR/deployment-summary.txt"
rm -f /tmp/cf-*.json
rm -f /tmp/s3-bucket-policy.json
rm -f /tmp/lambda-trust-policy.json

log_info "Local deployment files cleaned ✓"

echo ""
echo "================================================================================"
echo "Cleanup Complete! ✓"
echo "================================================================================"
echo ""
echo "Deleted Resources:"
echo "  ✓ Lambda function"
echo "  ✓ API Gateway"
echo "  ✓ S3 bucket"
echo "  ✓ CloudFront distribution (may still be disabling)"
echo "  ✓ WAF Web ACL"
echo "  ✓ IAM roles"
echo "  ✓ CloudWatch log groups"
echo ""

if [ -n "$CLOUDFRONT_ID" ]; then
    log_warn "Note: CloudFront distribution may take 10-15 minutes to fully delete"
    log_warn "Check status: aws cloudfront get-distribution --id $CLOUDFRONT_ID"
fi

echo ""
echo "================================================================================"
