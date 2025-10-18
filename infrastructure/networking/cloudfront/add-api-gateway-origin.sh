#!/bin/bash

# Add API Gateway as CloudFront Origin
# This script adds API Gateway as a second origin to CloudFront and creates
# a cache behavior to route /api/* requests to the API Gateway backend

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --distribution-id ID    CloudFront distribution ID (required)"
    echo "  --api-gateway-domain DOMAIN  API Gateway domain (required)"
    echo "  --api-stage STAGE       API Gateway stage (default: prod)"
    echo "  --origin-id ID          Origin ID for API Gateway (default: APIGateway-Backend)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --distribution-id E1234567890ABC --api-gateway-domain abc123.execute-api.us-east-1.amazonaws.com"
    echo "  $0 --distribution-id E1234567890ABC --api-gateway-domain abc123.execute-api.us-east-1.amazonaws.com --api-stage dev"
    exit 1
}

# Parse arguments
DISTRIBUTION_ID=""
API_GATEWAY_DOMAIN=""
API_STAGE="prod"
API_ORIGIN_ID="APIGateway-Backend"

while [[ $# -gt 0 ]]; do
    case $1 in
        --distribution-id)
            DISTRIBUTION_ID="$2"
            shift 2
            ;;
        --api-gateway-domain)
            API_GATEWAY_DOMAIN="$2"
            shift 2
            ;;
        --api-stage)
            API_STAGE="$2"
            shift 2
            ;;
        --origin-id)
            API_ORIGIN_ID="$2"
            shift 2
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
if [ -z "$DISTRIBUTION_ID" ] || [ -z "$API_GATEWAY_DOMAIN" ]; then
    log_error "Distribution ID and API Gateway domain are required"
    usage
fi

echo "Adding API Gateway Origin to CloudFront"
echo "========================================"
echo ""
validate_aws_cli

# Get current config
log_step "Getting current CloudFront configuration..."
aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" --output json > /tmp/current-cloudfront-config.json

if [ $? -ne 0 ]; then
    log_error "Failed to get CloudFront distribution config"
    exit 1
fi

ETAG=$(cat /tmp/current-cloudfront-config.json | jq -r '.ETag')
CURRENT_ORIGINS=$(cat /tmp/current-cloudfront-config.json | jq -r '.DistributionConfig.Origins.Quantity')

log_info "Distribution ID: $DISTRIBUTION_ID"
log_info "Current ETag: $ETAG"
log_info "Current origins: $CURRENT_ORIGINS"
echo ""

# Check if API Gateway origin already exists
EXISTING_ORIGIN=$(cat /tmp/current-cloudfront-config.json | jq -r --arg domain "$API_GATEWAY_DOMAIN" '.DistributionConfig.Origins.Items[] | select(.DomainName == $domain) | .Id')

if [ -n "$EXISTING_ORIGIN" ]; then
    log_warn "API Gateway origin already exists: $EXISTING_ORIGIN"
    log_info "Skipping origin creation"
    exit 0
fi

# Create updated config with API Gateway origin and cache behavior
log_step "Creating updated configuration..."

cat /tmp/current-cloudfront-config.json | jq --arg api_domain "$API_GATEWAY_DOMAIN" \
    --arg api_stage "/$API_STAGE" \
    --arg api_origin_id "$API_ORIGIN_ID" '
.DistributionConfig |
# Add API Gateway origin
.Origins.Quantity = (.Origins.Quantity + 1) |
.Origins.Items += [{
  "Id": $api_origin_id,
  "DomainName": $api_domain,
  "OriginPath": $api_stage,
  "CustomHeaders": {
    "Quantity": 0
  },
  "CustomOriginConfig": {
    "HTTPPort": 80,
    "HTTPSPort": 443,
    "OriginProtocolPolicy": "https-only",
    "OriginSslProtocols": {
      "Quantity": 3,
      "Items": ["TLSv1", "TLSv1.1", "TLSv1.2"]
    },
    "OriginReadTimeout": 30,
    "OriginKeepaliveTimeout": 5
  },
  "ConnectionAttempts": 3,
  "ConnectionTimeout": 10,
  "OriginShield": {
    "Enabled": false
  },
  "OriginAccessControlId": ""
}] |
# Add cache behavior for /api/*
.CacheBehaviors.Quantity = (.CacheBehaviors.Quantity + 1) |
.CacheBehaviors.Items += [{
  "PathPattern": "/api/*",
  "TargetOriginId": $api_origin_id,
  "TrustedSigners": {
    "Enabled": false,
    "Quantity": 0
  },
  "TrustedKeyGroups": {
    "Enabled": false,
    "Quantity": 0
  },
  "ViewerProtocolPolicy": "https-only",
  "AllowedMethods": {
    "Quantity": 7,
    "Items": ["HEAD", "DELETE", "POST", "GET", "OPTIONS", "PUT", "PATCH"],
    "CachedMethods": {
      "Quantity": 2,
      "Items": ["HEAD", "GET"]
    }
  },
  "SmoothStreaming": false,
  "Compress": false,
  "LambdaFunctionAssociations": {
    "Quantity": 0
  },
  "FunctionAssociations": {
    "Quantity": 0
  },
  "FieldLevelEncryptionId": "",
  "GrpcConfig": {
    "Enabled": false
  },
  "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
  "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac"
}]
' > /tmp/updated-cloudfront-config.json

NEW_ORIGINS=$(cat /tmp/updated-cloudfront-config.json | jq -r '.Origins.Quantity')
NEW_BEHAVIORS=$(cat /tmp/updated-cloudfront-config.json | jq -r '.CacheBehaviors.Quantity')

log_info "New configuration:"
log_info "  Origins: $NEW_ORIGINS"
log_info "  Cache Behaviors: $NEW_BEHAVIORS"
echo ""

# Update distribution
log_step "Updating CloudFront distribution..."
aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --distribution-config file:///tmp/updated-cloudfront-config.json \
  --if-match "$ETAG" \
  --output json > /tmp/cloudfront-update-result.json

if [ $? -eq 0 ]; then
    log_info "CloudFront distribution updated successfully! ✓"
    echo ""

    log_warn "The distribution is now being deployed to edge locations."
    log_warn "This typically takes 5-15 minutes."
    echo ""

    log_step "Updated Configuration"
    echo "  Distribution ID:    $DISTRIBUTION_ID"
    echo "  API Gateway Origin: $API_GATEWAY_DOMAIN"
    echo "  API Stage:          $API_STAGE"
    echo "  Origin ID:          $API_ORIGIN_ID"
    echo ""
    echo "Routing:"
    echo "  /api/* → API Gateway (https://$API_GATEWAY_DOMAIN$API_STAGE)"
    echo "  /*     → S3 Frontend"
    echo ""

    log_info "Check deployment status with:"
    echo "  ./check-status.sh --distribution-id $DISTRIBUTION_ID"
    echo ""
else
    log_error "Failed to update CloudFront distribution"
    cat /tmp/cloudfront-update-result.json
    exit 1
fi

# Clean up
rm -f /tmp/current-cloudfront-config.json /tmp/updated-cloudfront-config.json
