#!/bin/bash

# Create CloudFront Distribution
# Sets up CloudFront CDN for S3 website or custom origin

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --origin-domain DOMAIN  Origin domain (S3 bucket website endpoint or custom domain) (required)"
    echo "  --origin-type TYPE      Origin type: s3|custom (default: s3)"
    echo "  --comment COMMENT       Distribution comment (default: SOC-Lite Distribution)"
    echo "  --price-class CLASS     Price class: all|100|200 (default: 100)"
    echo "  --default-root ROOT     Default root object (default: index.html)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Price Classes:"
    echo "  all - Use all edge locations (highest cost)"
    echo "  100 - Use only North America and Europe"
    echo "  200 - Use North America, Europe, Asia, Middle East, and Africa"
    echo ""
    echo "Examples:"
    echo "  $0 --origin-domain my-bucket.s3-website-us-east-1.amazonaws.com"
    echo "  $0 --origin-domain example.com --origin-type custom --price-class all"
    exit 1
}

# Parse arguments
ORIGIN_DOMAIN=""
ORIGIN_TYPE="s3"
COMMENT="SOC-Lite Distribution"
PRICE_CLASS="PriceClass_100"
DEFAULT_ROOT="index.html"

while [[ $# -gt 0 ]]; do
    case $1 in
        --origin-domain)
            ORIGIN_DOMAIN="$2"
            shift 2
            ;;
        --origin-type)
            ORIGIN_TYPE="$2"
            shift 2
            ;;
        --comment)
            COMMENT="$2"
            shift 2
            ;;
        --price-class)
            case $2 in
                all)
                    PRICE_CLASS="PriceClass_All"
                    ;;
                100)
                    PRICE_CLASS="PriceClass_100"
                    ;;
                200)
                    PRICE_CLASS="PriceClass_200"
                    ;;
                *)
                    log_error "Invalid price class: $2"
                    usage
                    ;;
            esac
            shift 2
            ;;
        --default-root)
            DEFAULT_ROOT="$2"
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
if [ -z "$ORIGIN_DOMAIN" ]; then
    log_error "Origin domain is required"
    usage
fi

echo "Creating CloudFront Distribution"
echo "================================"
echo ""
validate_aws_cli

# Generate unique caller reference
CALLER_REF="cloudfront-$(date +%s)"

# Set origin protocol policy based on origin type
if [ "$ORIGIN_TYPE" = "s3" ]; then
    ORIGIN_PROTOCOL="http-only"
else
    ORIGIN_PROTOCOL="https-only"
fi

# Create distribution configuration JSON
DISTRIBUTION_CONFIG=$(cat <<EOF
{
    "CallerReference": "$CALLER_REF",
    "Comment": "$COMMENT",
    "Enabled": true,
    "DefaultRootObject": "$DEFAULT_ROOT",
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "primary-origin",
                "DomainName": "$ORIGIN_DOMAIN",
                "CustomOriginConfig": {
                    "HTTPPort": 80,
                    "HTTPSPort": 443,
                    "OriginProtocolPolicy": "$ORIGIN_PROTOCOL",
                    "OriginSslProtocols": {
                        "Quantity": 3,
                        "Items": ["TLSv1", "TLSv1.1", "TLSv1.2"]
                    }
                }
            }
        ]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "primary-origin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
            "Quantity": 7,
            "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
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
    "PriceClass": "$PRICE_CLASS"
}
EOF
)

# Create distribution
log_step "Creating CloudFront distribution..."
log_info "This may take several minutes..."
echo ""

DISTRIBUTION_JSON=$(aws cloudfront create-distribution \
    --distribution-config "$DISTRIBUTION_CONFIG" \
    --output json)

DISTRIBUTION_ID=$(echo "$DISTRIBUTION_JSON" | jq -r '.Distribution.Id')
DISTRIBUTION_DOMAIN=$(echo "$DISTRIBUTION_JSON" | jq -r '.Distribution.DomainName')
STATUS=$(echo "$DISTRIBUTION_JSON" | jq -r '.Distribution.Status')

log_info "Distribution created ✓"
echo ""

# Display distribution details
log_step "Distribution Details"
echo "  Distribution ID:  $DISTRIBUTION_ID"
echo "  Domain Name:      $DISTRIBUTION_DOMAIN"
echo "  Origin:           $ORIGIN_DOMAIN"
echo "  Status:           $STATUS"
echo "  Price Class:      $PRICE_CLASS"
echo "  Default Root:     $DEFAULT_ROOT"
echo ""

log_info "Distribution URL: https://$DISTRIBUTION_DOMAIN"
echo ""

log_warn "Note: The distribution is being deployed to edge locations."
log_warn "This process typically takes 15-30 minutes to complete."
log_warn "You can check the status with:"
echo "  ./check-status.sh --distribution-id $DISTRIBUTION_ID"
echo ""

log_info "CloudFront distribution created successfully! ✓"
echo ""
echo "Next steps:"
echo "  1. Wait for distribution to be deployed (Status: Deployed)"
echo "  2. Test the distribution: https://$DISTRIBUTION_DOMAIN"
echo "  3. Configure custom domain (optional)"
echo "  4. Update DNS records to point to $DISTRIBUTION_DOMAIN"
echo "  5. Configure SSL certificate for custom domain (optional)"
echo ""

# Save distribution info
mkdir -p "$SCRIPT_DIR/.distribution-info"
cat > "$SCRIPT_DIR/.distribution-info/latest.json" <<EOF
{
    "distribution_id": "$DISTRIBUTION_ID",
    "domain_name": "$DISTRIBUTION_DOMAIN",
    "origin": "$ORIGIN_DOMAIN",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

log_info "Distribution info saved to $SCRIPT_DIR/.distribution-info/latest.json"
echo ""
