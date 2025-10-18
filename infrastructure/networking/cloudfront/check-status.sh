#!/bin/bash

################################################################################
# Check CloudFront Distribution Deployment Status
# Monitors CloudFront distribution until it's deployed
################################################################################

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Load frontend deployment info
if [ -f "$SCRIPT_DIR/frontend-deployment.env" ]; then
    source "$SCRIPT_DIR/frontend-deployment.env"
else
    log_error "Frontend deployment info not found."
    log_error "Run 02-deploy-frontend.sh first"
    exit 1
fi

echo "================================================================================"
echo "CloudFront Distribution Status Monitor"
echo "================================================================================"
echo ""

log_info "CloudFront Distribution ID: $CLOUDFRONT_ID"
log_info "CloudFront URL: https://$CLOUDFRONT_URL"
echo ""

# Check if we should watch continuously
WATCH_MODE=false
if [ "$1" = "--watch" ] || [ "$1" = "-w" ]; then
    WATCH_MODE=true
    log_info "Watch mode enabled - will check every 30 seconds"
    echo ""
fi

check_status() {
    STATUS=$(aws cloudfront get-distribution \
        --id "$CLOUDFRONT_ID" \
        --query 'Distribution.Status' \
        --output text 2>/dev/null)

    if [ $? -ne 0 ]; then
        log_error "Failed to get CloudFront distribution status"
        return 1
    fi

    echo "$STATUS"
}

# Get current status
log_step "Checking CloudFront status..."

STATUS=$(check_status)

if [ "$STATUS" = "Deployed" ]; then
    echo ""
    log_info "✅ CloudFront distribution is DEPLOYED and ready!"
    echo ""
    echo "Your application is now accessible at:"
    echo "  https://$CLOUDFRONT_URL"
    echo ""
    echo "Next steps:"
    echo "  1. Test frontend: curl https://$CLOUDFRONT_URL"
    echo "  2. Setup WAF: ./03-setup-waf.sh"
    echo "  3. Update DNS: ./04-update-dns.sh"
    echo ""
    exit 0
else
    echo ""
    log_warn "⏳ CloudFront distribution status: $STATUS"
    echo ""

    # Get distribution details
    DIST_INFO=$(aws cloudfront get-distribution \
        --id "$CLOUDFRONT_ID" \
        --output json 2>/dev/null)

    DOMAIN=$(echo "$DIST_INFO" | jq -r '.Distribution.DomainName')
    ETAG=$(echo "$DIST_INFO" | jq -r '.ETag')

    echo "Distribution Details:"
    echo "  ID:         $CLOUDFRONT_ID"
    echo "  Domain:     $DOMAIN"
    echo "  Status:     $STATUS"
    echo "  ETag:       $ETAG"
    echo ""

    if [ "$WATCH_MODE" = false ]; then
        log_info "CloudFront is still deploying. This typically takes 10-15 minutes."
        echo ""
        echo "Options:"
        echo "  1. Wait and check manually:"
        echo "     aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.Status'"
        echo ""
        echo "  2. Run this script in watch mode:"
        echo "     ./check-cloudfront-status.sh --watch"
        echo ""
        echo "  3. Try to run WAF setup anyway (it will wait for deployment):"
        echo "     ./03-setup-waf.sh"
        echo ""
        exit 1
    fi
fi

# Watch mode - continuously check
if [ "$WATCH_MODE" = true ]; then
    log_info "Monitoring deployment progress..."
    echo ""

    START_TIME=$(date +%s)
    CHECK_COUNT=0
    MAX_CHECKS=60  # 30 minutes maximum

    while [ $CHECK_COUNT -lt $MAX_CHECKS ]; do
        CHECK_COUNT=$((CHECK_COUNT + 1))
        ELAPSED=$(($(date +%s) - START_TIME))
        MINUTES=$((ELAPSED / 60))
        SECONDS=$((ELAPSED % 60))

        STATUS=$(check_status)

        if [ "$STATUS" = "Deployed" ]; then
            echo ""
            log_info "✅ CloudFront is now DEPLOYED! (after ${MINUTES}m ${SECONDS}s)"
            echo ""
            echo "Your application is accessible at:"
            echo "  https://$CLOUDFRONT_URL"
            echo ""
            echo "Next steps:"
            echo "  1. Test: curl https://$CLOUDFRONT_URL"
            echo "  2. Setup WAF: ./03-setup-waf.sh"
            echo "  3. Update DNS: ./04-update-dns.sh"
            echo ""
            exit 0
        fi

        echo "[$(date +'%H:%M:%S')] Check $CHECK_COUNT: Status = $STATUS (${MINUTES}m ${SECONDS}s elapsed)"

        if [ $CHECK_COUNT -lt $MAX_CHECKS ]; then
            sleep 30
        fi
    done

    echo ""
    log_warn "CloudFront is still deploying after 30 minutes."
    log_warn "This is unusual but can happen. Please check AWS Console or contact support."
    echo ""
    exit 1
fi
