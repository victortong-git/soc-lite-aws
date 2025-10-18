#!/bin/bash

################################################################################
# Master Deployment Script for SOC Lite
# Deploys complete infrastructure: Lambda + Frontend + WAF + DNS
################################################################################

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "================================================================================"
echo "SOC Lite - Complete Deployment"
echo "================================================================================"
echo ""
echo "This script will deploy the complete SOC Lite infrastructure:"
echo ""
echo "  Step 1: Backend API (Lambda + API Gateway)"
echo "  Step 2: Frontend (S3 + CloudFront)"
echo "  Step 3: WAF Protection"
echo "  Step 4: DNS Configuration"
echo ""
echo "Deployment will take approximately 20-30 minutes"
echo ""
echo "================================================================================"
echo ""

validate_aws_cli

echo "Configuration:"
echo "  Project:        $PROJECT_NAME"
echo "  Region:         $REGION"
echo "  Domain:         $DOMAIN_NAME"
echo "  AWS Account:    $AWS_ACCOUNT_ID"
echo ""

read -p "Continue with deployment? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log_info "Deployment cancelled"
    exit 0
fi

echo ""
echo "================================================================================"
echo "Starting Deployment..."
echo "================================================================================"
echo ""

# Track start time
START_TIME=$(date +%s)

# Step 1: Deploy Lambda Backend
log_step "Step 1/4: Deploying Backend (Lambda + API Gateway)..."
echo ""

if bash "$SCRIPT_DIR/01-deploy-lambda.sh"; then
    log_info "✓ Backend deployment successful"
else
    log_error "✗ Backend deployment failed"
    exit 1
fi

echo ""
echo "Waiting 10 seconds before continuing..."
sleep 10
echo ""

# Step 2: Deploy Frontend
log_step "Step 2/4: Deploying Frontend (S3 + CloudFront)..."
echo ""

if bash "$SCRIPT_DIR/02-deploy-frontend.sh"; then
    log_info "✓ Frontend deployment successful"
else
    log_error "✗ Frontend deployment failed"
    exit 1
fi

echo ""
log_warn "CloudFront distribution is deploying in the background (10-15 minutes)"
log_info "Continuing with WAF setup..."
echo ""

# Step 3: Setup WAF
log_step "Step 3/4: Setting up WAF Protection..."
echo ""

# Wait for CloudFront to be ready for WAF association
log_info "Checking if CloudFront is ready for WAF..."

source "$SCRIPT_DIR/frontend-deployment.env"

MAX_WAIT=900  # 15 minutes
WAIT_TIME=0
SLEEP_INTERVAL=30

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    CF_STATUS=$(aws cloudfront get-distribution \
        --id "$CLOUDFRONT_ID" \
        --query 'Distribution.Status' \
        --output text 2>/dev/null || echo "Unknown")

    if [ "$CF_STATUS" = "Deployed" ]; then
        log_info "CloudFront is deployed and ready ✓"
        break
    fi

    log_info "CloudFront status: $CF_STATUS (waiting...)"
    sleep $SLEEP_INTERVAL
    WAIT_TIME=$((WAIT_TIME + SLEEP_INTERVAL))
done

if [ "$CF_STATUS" != "Deployed" ]; then
    log_warn "CloudFront is still deploying. WAF will be configured, but association may fail."
    log_warn "You can run 03-setup-waf.sh manually later once CloudFront is deployed."
fi

if bash "$SCRIPT_DIR/03-setup-waf.sh"; then
    log_info "✓ WAF setup successful"
else
    log_warn "✗ WAF setup had issues (you can run 03-setup-waf.sh manually later)"
fi

echo ""

# Step 4: Update DNS (optional - requires user confirmation)
log_step "Step 4/4: DNS Configuration (optional)..."
echo ""

log_info "DNS update requires manual confirmation"
log_info "You can run this step separately: ./04-update-dns.sh"
echo ""

read -p "Update DNS now? (yes/no): " DNS_CONFIRM

if [ "$DNS_CONFIRM" = "yes" ]; then
    if bash "$SCRIPT_DIR/04-update-dns.sh"; then
        log_info "✓ DNS update successful"
    else
        log_warn "✗ DNS update had issues"
    fi
else
    log_info "Skipping DNS update. Run ./04-update-dns.sh when ready."
fi

# Calculate deployment time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo "================================================================================"
echo "Deployment Complete! ✓"
echo "================================================================================"
echo ""
echo "Deployment Time: ${MINUTES}m ${SECONDS}s"
echo ""

# Load all deployment info
source "$SCRIPT_DIR/lambda-deployment.env" 2>/dev/null || true
source "$SCRIPT_DIR/frontend-deployment.env" 2>/dev/null || true
source "$SCRIPT_DIR/waf-deployment.env" 2>/dev/null || true

echo "Deployed Resources:"
echo ""
echo "Backend API:"
echo "  Lambda Function:  $LAMBDA_FUNCTION_NAME"
echo "  API Endpoint:     $API_ENDPOINT"
echo "  Test:             curl $API_ENDPOINT/health"
echo ""
echo "Frontend:"
echo "  S3 Bucket:        $S3_BUCKET_NAME"
echo "  CloudFront ID:    $CLOUDFRONT_ID"
echo "  CloudFront URL:   https://$CLOUDFRONT_URL"
echo ""
echo "Security:"
echo "  WAF ACL:          $WAF_ACL_NAME"
echo "  Rate Limit:       $WAF_RATE_LIMIT req/5min"
echo "  Protected Rules:  4 rule sets enabled"
echo ""
echo "Domain:"
echo "  Custom Domain:    https://$DOMAIN_NAME (if DNS updated)"
echo ""
echo "Default Credentials:"
echo "  Username:         admin"
echo "  Password:         socDemo2025!"
echo ""
echo "================================================================================"
echo ""
echo "Testing Your Deployment:"
echo ""
echo "1. Test Backend API:"
echo "   curl $API_ENDPOINT/health"
echo ""
echo "2. Test Login:"
echo "   curl -X POST $API_ENDPOINT/api/auth/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"admin\",\"password\":\"socDemo2025!\"}'"
echo ""
echo "3. Access Frontend:"
echo "   https://$CLOUDFRONT_URL"
if [ "$DNS_CONFIRM" = "yes" ]; then
echo "   https://$DOMAIN_NAME (after DNS propagates)"
fi
echo ""
echo "================================================================================"
echo ""
echo "Next Steps:"
echo ""
echo "1. Wait for CloudFront to fully deploy (if not already)"
echo "2. Test frontend application at CloudFront URL"
echo "3. Test WAF protection (rate limiting)"
echo "4. Complete frontend React components (if needed)"
echo "5. Monitor CloudWatch logs for Lambda and WAF"
echo ""
echo "Deployment Files:"
echo "  Lambda info:      lambda-deployment.env"
echo "  Frontend info:    frontend-deployment.env"
echo "  WAF info:         waf-deployment.env"
echo "  DNS info:         dns-deployment.env"
echo ""
echo "================================================================================"

# Create comprehensive deployment summary
cat > "$SCRIPT_DIR/deployment-summary.txt" <<EOF
SOC Lite Deployment Summary
Generated: $(date)
===============================================================================

AWS Account: $AWS_ACCOUNT_ID
Region: $REGION
Deployment Time: ${MINUTES}m ${SECONDS}s

Backend (Lambda + API Gateway)
- Lambda Function: $LAMBDA_FUNCTION_NAME
- Lambda ARN: $LAMBDA_ARN
- API Gateway ID: $API_GATEWAY_ID
- API Endpoint: $API_ENDPOINT

Frontend (S3 + CloudFront)
- S3 Bucket: $S3_BUCKET_NAME
- CloudFront ID: $CLOUDFRONT_ID
- CloudFront URL: https://$CLOUDFRONT_URL

Security (WAF)
- WAF ACL Name: $WAF_ACL_NAME
- WAF ACL ID: $WAF_ACL_ID
- Rate Limit: $WAF_RATE_LIMIT requests per 5 minutes
- Log Group: $WAF_LOG_GROUP

Domain
- Custom Domain: https://$DOMAIN_NAME
- DNS Status: $([ "$DNS_CONFIRM" = "yes" ] && echo "Updated" || echo "Not updated")

Application Access
- Frontend: https://$CLOUDFRONT_URL
- Backend API: $API_ENDPOINT
- Username: admin
- Password: socDemo2025!

===============================================================================
EOF

log_info "Deployment summary saved to deployment-summary.txt"

echo ""
log_info "🎉 SOC Lite deployment complete!"
echo ""
