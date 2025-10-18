#!/bin/bash

################################################################################
# Step 3: Setup WAF for CloudFront Protection
################################################################################

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Load frontend deployment info
if [ -f "$SCRIPT_DIR/frontend-deployment.env" ]; then
    source "$SCRIPT_DIR/frontend-deployment.env"
else
    log_error "Frontend deployment info not found. Run 02-deploy-frontend.sh first"
    exit 1
fi

echo "================================================================================"
echo "Step 3: Setup WAF for CloudFront"
echo "================================================================================"
echo ""

validate_aws_cli

# Note: WAF for CloudFront must be in us-east-1
WAF_REGION="us-east-1"

log_info "WAF for CloudFront must be created in us-east-1 region"
log_info "Current region: $REGION, WAF region: $WAF_REGION"
echo ""

# Step 1: Check if Web ACL already exists
log_step "Checking existing WAF configuration..."

WAF_ACL_ID=$(aws wafv2 list-web-acls \
    --scope CLOUDFRONT \
    --region "$WAF_REGION" \
    --query "WebACLs[?Name=='$WAF_ACL_NAME'].Id" \
    --output text 2>/dev/null)

if [ -n "$WAF_ACL_ID" ] && [ "$WAF_ACL_ID" != "None" ]; then
    log_info "WAF Web ACL already exists: $WAF_ACL_NAME"

    export WAF_ACL_ARN=$(aws wafv2 list-web-acls \
        --scope CLOUDFRONT \
        --region "$WAF_REGION" \
        --query "WebACLs[?Name=='$WAF_ACL_NAME'].ARN" \
        --output text)

    log_info "WAF ACL ARN: $WAF_ACL_ARN"
else
    # Step 2: Create WAF Web ACL
    log_step "Creating WAF Web ACL..."

    log_info "Creating WAF rules:"
    log_info "  - Rate limiting: $WAF_RATE_LIMIT requests/5min per IP"
    log_info "  - AWS Managed Rules: Common Rule Set"
    log_info "  - AWS Managed Rules: Known Bad Inputs"
    log_info "  - AWS Managed Rules: SQL Injection Protection"
    echo ""

    WAF_RESPONSE=$(aws wafv2 create-web-acl \
        --name "$WAF_ACL_NAME" \
        --scope CLOUDFRONT \
        --region "$WAF_REGION" \
        --default-action Allow={} \
        --rules "[
          {
            \"Name\": \"RateLimitRule\",
            \"Priority\": 1,
            \"Statement\": {
              \"RateBasedStatement\": {
                \"Limit\": $WAF_RATE_LIMIT,
                \"AggregateKeyType\": \"IP\"
              }
            },
            \"Action\": {
              \"Block\": {}
            },
            \"VisibilityConfig\": {
              \"SampledRequestsEnabled\": true,
              \"CloudWatchMetricsEnabled\": true,
              \"MetricName\": \"RateLimitRule\"
            }
          },
          {
            \"Name\": \"AWSManagedRulesCommonRuleSet\",
            \"Priority\": 2,
            \"Statement\": {
              \"ManagedRuleGroupStatement\": {
                \"VendorName\": \"AWS\",
                \"Name\": \"AWSManagedRulesCommonRuleSet\"
              }
            },
            \"OverrideAction\": {
              \"None\": {}
            },
            \"VisibilityConfig\": {
              \"SampledRequestsEnabled\": true,
              \"CloudWatchMetricsEnabled\": true,
              \"MetricName\": \"AWSManagedRulesCommonRuleSet\"
            }
          },
          {
            \"Name\": \"AWSManagedRulesKnownBadInputsRuleSet\",
            \"Priority\": 3,
            \"Statement\": {
              \"ManagedRuleGroupStatement\": {
                \"VendorName\": \"AWS\",
                \"Name\": \"AWSManagedRulesKnownBadInputsRuleSet\"
              }
            },
            \"OverrideAction\": {
              \"None\": {}
            },
            \"VisibilityConfig\": {
              \"SampledRequestsEnabled\": true,
              \"CloudWatchMetricsEnabled\": true,
              \"MetricName\": \"AWSManagedRulesKnownBadInputsRuleSet\"
            }
          },
          {
            \"Name\": \"AWSManagedRulesSQLiRuleSet\",
            \"Priority\": 4,
            \"Statement\": {
              \"ManagedRuleGroupStatement\": {
                \"VendorName\": \"AWS\",
                \"Name\": \"AWSManagedRulesSQLiRuleSet\"
              }
            },
            \"OverrideAction\": {
              \"None\": {}
            },
            \"VisibilityConfig\": {
              \"SampledRequestsEnabled\": true,
              \"CloudWatchMetricsEnabled\": true,
              \"MetricName\": \"AWSManagedRulesSQLiRuleSet\"
            }
          }
        ]" \
        --visibility-config "SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=$WAF_ACL_NAME")

    export WAF_ACL_ID=$(echo "$WAF_RESPONSE" | jq -r '.Summary.Id')
    export WAF_ACL_ARN=$(echo "$WAF_RESPONSE" | jq -r '.Summary.ARN')

    log_info "WAF Web ACL created ✓"
    log_info "WAF ACL ID: $WAF_ACL_ID"
    log_info "WAF ACL ARN: $WAF_ACL_ARN"
fi

echo ""

# Step 3: Associate WAF with CloudFront
log_step "Associating WAF with CloudFront distribution..."

log_info "Checking CloudFront distribution status..."
CF_STATUS=$(aws cloudfront get-distribution \
    --id "$CLOUDFRONT_ID" \
    --query 'Distribution.Status' \
    --output text 2>/dev/null)

if [ "$CF_STATUS" != "Deployed" ]; then
    log_warn "CloudFront distribution status: $CF_STATUS"
    log_warn "WAF can only be associated with deployed CloudFront distributions"
    log_info "Please wait for CloudFront to finish deploying, then run this script again"
    echo ""
    echo "Check status with:"
    echo "  aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.Status'"
    echo ""
    exit 0
fi

log_info "CloudFront distribution is deployed ✓"

# Get CloudFront ARN
CF_ARN="arn:aws:cloudfront::${AWS_ACCOUNT_ID}:distribution/${CLOUDFRONT_ID}"

log_info "Associating WAF ACL with CloudFront..."

aws wafv2 associate-web-acl \
    --web-acl-arn "$WAF_ACL_ARN" \
    --resource-arn "$CF_ARN" \
    --region "$WAF_REGION"

log_info "WAF associated with CloudFront ✓"
echo ""

# Step 4: Enable WAF logging (optional)
log_step "Configuring WAF logging..."

# Create CloudWatch log group for WAF
log_info "Creating CloudWatch log group..."

aws logs create-log-group \
    --log-group-name "$WAF_LOG_GROUP" \
    --region "$WAF_REGION" 2>/dev/null || log_info "Log group already exists ✓"

aws logs put-retention-policy \
    --log-group-name "$WAF_LOG_GROUP" \
    --retention-in-days 7 \
    --region "$WAF_REGION" 2>/dev/null || true

# Enable WAF logging
log_info "Enabling WAF logging to CloudWatch..."

LOG_DESTINATION="arn:aws:logs:${WAF_REGION}:${AWS_ACCOUNT_ID}:log-group:${WAF_LOG_GROUP}"

aws wafv2 put-logging-configuration \
    --region "$WAF_REGION" \
    --logging-configuration "{
      \"ResourceArn\": \"$WAF_ACL_ARN\",
      \"LogDestinationConfigs\": [
        \"$LOG_DESTINATION\"
      ]
    }" 2>/dev/null || log_info "Logging already configured ✓"

log_info "WAF logging enabled ✓"
echo ""

echo "================================================================================"
echo "WAF Setup Complete! ✓"
echo "================================================================================"
echo ""
echo "WAF Configuration:"
echo "  Name:           $WAF_ACL_NAME"
echo "  ID:             $WAF_ACL_ID"
echo "  ARN:            $WAF_ACL_ARN"
echo "  Region:         $WAF_REGION (required for CloudFront)"
echo ""
echo "Security Rules Enabled:"
echo "  ✓ Rate limiting ($WAF_RATE_LIMIT requests/5min per IP)"
echo "  ✓ AWS Managed Rules - Common Rule Set (OWASP Top 10)"
echo "  ✓ AWS Managed Rules - Known Bad Inputs"
echo "  ✓ AWS Managed Rules - SQL Injection Protection"
echo "  ✓ CloudWatch Logs enabled"
echo ""
echo "Protected Resource:"
echo "  CloudFront:     $CLOUDFRONT_ID"
echo "  URL:            https://$CLOUDFRONT_URL"
echo ""
echo "View WAF Logs:"
echo "  aws logs tail $WAF_LOG_GROUP --follow --region $WAF_REGION"
echo ""
echo "Next Steps:"
echo "  1. Test WAF protection: https://$CLOUDFRONT_URL"
echo "  2. Run 04-update-dns.sh to configure custom domain"
echo ""
echo "================================================================================"

# Save WAF info
cat > "$SCRIPT_DIR/waf-deployment.env" <<EOF
export WAF_ACL_ID="$WAF_ACL_ID"
export WAF_ACL_ARN="$WAF_ACL_ARN"
export WAF_LOG_GROUP="$WAF_LOG_GROUP"
export WAF_REGION="$WAF_REGION"
EOF

log_info "WAF deployment info saved to waf-deployment.env"
