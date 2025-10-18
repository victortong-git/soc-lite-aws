#!/bin/bash

# Invalidate CloudFront Cache
# Creates cache invalidation for specific paths or all files

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --distribution-id ID    CloudFront distribution ID (required)"
    echo "  --paths PATHS           Paths to invalidate (default: /*)"
    echo "  --wait                  Wait for invalidation to complete"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --distribution-id E1234567890ABC"
    echo "  $0 --distribution-id E1234567890ABC --paths '/index.html /assets/*'"
    echo "  $0 --distribution-id E1234567890ABC --paths '/*' --wait"
    exit 1
}

# Parse arguments
DISTRIBUTION_ID=""
PATHS="/*"
WAIT_FOR_COMPLETION=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --distribution-id)
            DISTRIBUTION_ID="$2"
            shift 2
            ;;
        --paths)
            PATHS="$2"
            shift 2
            ;;
        --wait)
            WAIT_FOR_COMPLETION=true
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
if [ -z "$DISTRIBUTION_ID" ]; then
    log_error "Distribution ID is required"
    usage
fi

echo "Invalidating CloudFront Cache"
echo "============================="
echo ""
validate_aws_cli

# Check if distribution exists
log_info "Checking distribution $DISTRIBUTION_ID..."
if ! aws cloudfront get-distribution --id "$DISTRIBUTION_ID" &>/dev/null; then
    log_error "Distribution $DISTRIBUTION_ID not found"
    exit 1
fi

DOMAIN_NAME=$(aws cloudfront get-distribution \
    --id "$DISTRIBUTION_ID" \
    --query 'Distribution.DomainName' \
    --output text)

log_info "Distribution found: $DOMAIN_NAME"
echo ""

# Convert paths string to JSON array
PATHS_ARRAY=$(echo "$PATHS" | tr ' ' '\n' | jq -R . | jq -s .)
PATH_COUNT=$(echo "$PATHS_ARRAY" | jq 'length')

# Create invalidation
log_step "Creating invalidation..."
echo "  Paths to invalidate: $PATH_COUNT"
echo ""

CALLER_REF="invalidation-$(date +%s)"

INVALIDATION_JSON=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --invalidation-batch "{
        \"CallerReference\": \"$CALLER_REF\",
        \"Paths\": {
            \"Quantity\": $PATH_COUNT,
            \"Items\": $PATHS_ARRAY
        }
    }" \
    --output json)

INVALIDATION_ID=$(echo "$INVALIDATION_JSON" | jq -r '.Invalidation.Id')
STATUS=$(echo "$INVALIDATION_JSON" | jq -r '.Invalidation.Status')
CREATE_TIME=$(echo "$INVALIDATION_JSON" | jq -r '.Invalidation.CreateTime')

log_info "Invalidation created ✓"
echo ""

# Display invalidation details
log_step "Invalidation Details"
echo "  Invalidation ID:  $INVALIDATION_ID"
echo "  Distribution ID:  $DISTRIBUTION_ID"
echo "  Status:           $STATUS"
echo "  Created:          $CREATE_TIME"
echo "  Paths:            $(echo "$PATHS_ARRAY" | jq -r '.[]' | tr '\n' ' ')"
echo ""

# Wait for completion if requested
if [ "$WAIT_FOR_COMPLETION" = true ]; then
    log_step "Waiting for invalidation to complete..."
    log_info "This typically takes 30-60 seconds..."
    echo ""

    while true; do
        STATUS=$(aws cloudfront get-invalidation \
            --distribution-id "$DISTRIBUTION_ID" \
            --id "$INVALIDATION_ID" \
            --query 'Invalidation.Status' \
            --output text)

        if [ "$STATUS" = "Completed" ]; then
            log_info "Invalidation completed ✓"
            break
        else
            echo -ne "  Status: $STATUS (checking again in 5 seconds...)\r"
            sleep 5
        fi
    done
    echo ""
fi

log_info "Cache invalidation successful! ✓"
echo ""

if [ "$WAIT_FOR_COMPLETION" = false ]; then
    log_info "Note: Invalidation is being processed in the background."
    log_info "You can check the status with:"
    echo "  aws cloudfront get-invalidation --distribution-id $DISTRIBUTION_ID --id $INVALIDATION_ID"
    echo ""
fi

echo "Distribution URL: https://$DOMAIN_NAME"
echo ""
