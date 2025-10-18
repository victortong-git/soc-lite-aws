#!/bin/bash

# Configure WAF Rules
# Adds or updates Web ACL rules for CloudFront or API Gateway

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --web-acl-name NAME     Web ACL name (required)"
    echo "  --rule-type TYPE        Rule type: rate-limit|ip-set|managed (required)"
    echo "  --rule-name NAME        Custom rule name (required)"
    echo "  --rate-limit NUM        Rate limit per 5 minutes (for rate-limit type)"
    echo "  --ip-addresses IPS      Comma-separated IP addresses (for ip-set type)"
    echo "  --action ACTION         Action: block|allow|count (default: block)"
    echo "  --priority NUM          Rule priority (default: 100)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Rule Types:"
    echo "  rate-limit  - Rate-based rule to limit requests per IP"
    echo "  ip-set      - IP set rule to block/allow specific IPs"
    echo "  managed     - AWS managed rule groups"
    echo ""
    echo "Examples:"
    echo "  $0 --web-acl-name soc-lite-waf --rule-type rate-limit --rule-name rate-limit-100 --rate-limit 100"
    echo "  $0 --web-acl-name soc-lite-waf --rule-type ip-set --rule-name block-bad-ips --ip-addresses '203.0.113.0/32,198.51.100.0/32' --action block"
    exit 1
}

# Parse arguments
WEB_ACL_NAME=""
RULE_TYPE=""
RULE_NAME=""
RATE_LIMIT=""
IP_ADDRESSES=""
ACTION="block"
PRIORITY=100

while [[ $# -gt 0 ]]; do
    case $1 in
        --web-acl-name)
            WEB_ACL_NAME="$2"
            shift 2
            ;;
        --rule-type)
            RULE_TYPE="$2"
            shift 2
            ;;
        --rule-name)
            RULE_NAME="$2"
            shift 2
            ;;
        --rate-limit)
            RATE_LIMIT="$2"
            shift 2
            ;;
        --ip-addresses)
            IP_ADDRESSES="$2"
            shift 2
            ;;
        --action)
            ACTION="$2"
            shift 2
            ;;
        --priority)
            PRIORITY="$2"
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
if [ -z "$WEB_ACL_NAME" ] || [ -z "$RULE_TYPE" ] || [ -z "$RULE_NAME" ]; then
    log_error "Web ACL name, rule type, and rule name are required"
    usage
fi

# Validate action
case "$ACTION" in
    block|allow|count)
        ACTION_UPPER=$(echo "$ACTION" | tr '[:lower:]' '[:upper:]')
        ;;
    *)
        log_error "Invalid action: $ACTION (must be block, allow, or count)"
        usage
        ;;
esac

echo "Configuring WAF Rule"
echo "===================="
echo ""
validate_aws_cli

# Get Web ACL details
log_info "Finding Web ACL: $WEB_ACL_NAME..."

WEB_ACL_ID=$(aws wafv2 list-web-acls \
    --scope CLOUDFRONT \
    --region us-east-1 \
    --query "WebACLs[?Name=='$WEB_ACL_NAME'].Id" \
    --output text)

if [ -z "$WEB_ACL_ID" ]; then
    log_error "Web ACL '$WEB_ACL_NAME' not found"
    exit 1
fi

log_info "Web ACL found: $WEB_ACL_ID"

# Get Web ACL details including lock token
WEB_ACL_DETAILS=$(aws wafv2 get-web-acl \
    --scope CLOUDFRONT \
    --id "$WEB_ACL_ID" \
    --name "$WEB_ACL_NAME" \
    --region us-east-1)

LOCK_TOKEN=$(echo "$WEB_ACL_DETAILS" | jq -r '.LockToken')
log_info "Lock token: $LOCK_TOKEN"
echo ""

# Create rule based on type
log_step "Creating $RULE_TYPE rule: $RULE_NAME..."

case "$RULE_TYPE" in
    rate-limit)
        if [ -z "$RATE_LIMIT" ]; then
            log_error "Rate limit is required for rate-limit rule type"
            usage
        fi

        RULE_JSON=$(cat <<EOF
{
    "Name": "$RULE_NAME",
    "Priority": $PRIORITY,
    "Action": {
        "$ACTION_UPPER": {}
    },
    "Statement": {
        "RateBasedStatement": {
            "Limit": $RATE_LIMIT,
            "AggregateKeyType": "IP"
        }
    },
    "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "$RULE_NAME"
    }
}
EOF
)
        ;;

    ip-set)
        if [ -z "$IP_ADDRESSES" ]; then
            log_error "IP addresses are required for ip-set rule type"
            usage
        fi

        # Create IP set first
        IP_SET_NAME="$RULE_NAME-ipset"
        log_info "Creating IP set: $IP_SET_NAME..."

        # Convert comma-separated IPs to JSON array
        IFS=',' read -ra IP_ARRAY <<< "$IP_ADDRESSES"
        IP_JSON=$(printf '%s\n' "${IP_ARRAY[@]}" | jq -R . | jq -s .)

        IP_SET_ID=$(aws wafv2 create-ip-set \
            --scope CLOUDFRONT \
            --name "$IP_SET_NAME" \
            --ip-address-version IPV4 \
            --addresses "$IP_JSON" \
            --region us-east-1 \
            --query 'Summary.Id' \
            --output text 2>/dev/null || \
            aws wafv2 list-ip-sets \
                --scope CLOUDFRONT \
                --region us-east-1 \
                --query "IPSets[?Name=='$IP_SET_NAME'].Id" \
                --output text)

        IP_SET_ARN="arn:aws:wafv2:us-east-1:$(aws sts get-caller-identity --query Account --output text):global/ipset/$IP_SET_NAME/$IP_SET_ID"

        log_info "IP set: $IP_SET_ID"

        RULE_JSON=$(cat <<EOF
{
    "Name": "$RULE_NAME",
    "Priority": $PRIORITY,
    "Action": {
        "$ACTION_UPPER": {}
    },
    "Statement": {
        "IPSetReferenceStatement": {
            "ARN": "$IP_SET_ARN"
        }
    },
    "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "$RULE_NAME"
    }
}
EOF
)
        ;;

    *)
        log_error "Unsupported rule type: $RULE_TYPE"
        exit 1
        ;;
esac

echo ""
log_info "Rule configuration:"
echo "$RULE_JSON" | jq '.'
echo ""

# Get current rules
CURRENT_RULES=$(echo "$WEB_ACL_DETAILS" | jq '.WebACL.Rules')

# Add new rule to existing rules
UPDATED_RULES=$(echo "$CURRENT_RULES" | jq ". += [$RULE_JSON]")

# Update Web ACL with new rule
log_step "Updating Web ACL..."

UPDATE_RESULT=$(aws wafv2 update-web-acl \
    --scope CLOUDFRONT \
    --id "$WEB_ACL_ID" \
    --name "$WEB_ACL_NAME" \
    --default-action "$(echo "$WEB_ACL_DETAILS" | jq '.WebACL.DefaultAction')" \
    --rules "$UPDATED_RULES" \
    --visibility-config "$(echo "$WEB_ACL_DETAILS" | jq '.WebACL.VisibilityConfig')" \
    --lock-token "$LOCK_TOKEN" \
    --region us-east-1)

if [ $? -eq 0 ]; then
    NEW_LOCK_TOKEN=$(echo "$UPDATE_RESULT" | jq -r '.NextLockToken')
    log_info "Web ACL updated successfully ✓"
    log_info "New lock token: $NEW_LOCK_TOKEN"
    echo ""
else
    log_error "Failed to update Web ACL"
    exit 1
fi

log_info "WAF rule configured successfully! ✓"
echo ""
echo "Rule Details:"
echo "  Rule Name:     $RULE_NAME"
echo "  Rule Type:     $RULE_TYPE"
echo "  Action:        $ACTION"
echo "  Priority:      $PRIORITY"
[ -n "$RATE_LIMIT" ] && echo "  Rate Limit:    $RATE_LIMIT requests/5min"
[ -n "$IP_ADDRESSES" ] && echo "  IP Addresses:  $IP_ADDRESSES"
echo ""
