#!/bin/bash

################################################################################
# Create WAF Manual Blocklist IPSet
# Creates an IPSet for blocking malicious IPs identified by escalations
################################################################################

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IP_SET_NAME="soc-lite-blocklist-ips"
WAF_ACL_NAME="soc-lite-waf-acl"
SCOPE="CLOUDFRONT"
REGION="us-east-1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "================================================================================"
echo "Create WAF Manual Blocklist IPSet"
echo "================================================================================"
echo ""

# Step 1: Check if IPSet already exists
log_info "Checking if IPSet already exists..."

IP_SET_ID=$(aws wafv2 list-ip-sets \
    --scope "$SCOPE" \
    --region "$REGION" \
    --query "IPSets[?Name=='$IP_SET_NAME'].Id" \
    --output text 2>/dev/null || echo "")

if [ -n "$IP_SET_ID" ] && [ "$IP_SET_ID" != "None" ]; then
    log_warn "IPSet '$IP_SET_NAME' already exists (ID: $IP_SET_ID)"

    IP_SET_ARN=$(aws wafv2 list-ip-sets \
        --scope "$SCOPE" \
        --region "$REGION" \
        --query "IPSets[?Name=='$IP_SET_NAME'].ARN" \
        --output text)

    log_info "Existing IPSet ARN: $IP_SET_ARN"
else
    # Step 2: Create IPSet
    log_info "Creating IPSet '$IP_SET_NAME'..."

    IP_SET_RESPONSE=$(aws wafv2 create-ip-set \
        --name "$IP_SET_NAME" \
        --scope "$SCOPE" \
        --region "$REGION" \
        --ip-address-version IPV4 \
        --addresses "[]" \
        --description "Manual blocklist for malicious IPs identified by SOC-Lite escalations" \
        --output json)

    IP_SET_ID=$(echo "$IP_SET_RESPONSE" | jq -r '.Summary.Id')
    IP_SET_ARN=$(echo "$IP_SET_RESPONSE" | jq -r '.Summary.ARN')

    log_success "IPSet created successfully!"
    log_info "IPSet ID: $IP_SET_ID"
    log_info "IPSet ARN: $IP_SET_ARN"
fi

echo ""

# Step 3: Get WAF ACL details
log_info "Retrieving WAF ACL '$WAF_ACL_NAME'..."

WAF_ACL_ID=$(aws wafv2 list-web-acls \
    --scope "$SCOPE" \
    --region "$REGION" \
    --query "WebACLs[?Name=='$WAF_ACL_NAME'].Id" \
    --output text)

if [ -z "$WAF_ACL_ID" ] || [ "$WAF_ACL_ID" == "None" ]; then
    log_error "WAF ACL '$WAF_ACL_NAME' not found!"
    log_error "Please run setup-waf.sh first to create the WAF ACL"
    exit 1
fi

log_info "WAF ACL ID: $WAF_ACL_ID"

# Get current WAF configuration
WAF_CONFIG=$(aws wafv2 get-web-acl \
    --name "$WAF_ACL_NAME" \
    --scope "$SCOPE" \
    --id "$WAF_ACL_ID" \
    --region "$REGION" \
    --output json)

LOCK_TOKEN=$(echo "$WAF_CONFIG" | jq -r '.LockToken')
CURRENT_RULES=$(echo "$WAF_CONFIG" | jq '.WebACL.Rules')

# Check if blocklist rule already exists
RULE_EXISTS=$(echo "$CURRENT_RULES" | jq -r '.[] | select(.Name=="BlocklistIPRule") | .Name' || echo "")

if [ -n "$RULE_EXISTS" ]; then
    log_warn "BlocklistIPRule already exists in WAF ACL"
    log_info "Skipping rule creation"
else
    log_info "Adding BlocklistIPRule to WAF ACL..."

    # Create new rule for IPSet blocking
    BLOCKLIST_RULE=$(cat <<EOF
{
  "Name": "BlocklistIPRule",
  "Priority": 0,
  "Statement": {
    "IPSetReferenceStatement": {
      "ARN": "$IP_SET_ARN"
    }
  },
  "Action": {
    "Block": {}
  },
  "VisibilityConfig": {
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "BlocklistIPRule"
  }
}
EOF
)

    # Increment priority of existing rules
    UPDATED_RULES=$(echo "$CURRENT_RULES" | jq --argjson newrule "$BLOCKLIST_RULE" '
        map(.Priority += 1) |
        [$newrule] + .
    ')

    # Update WAF ACL with new rule
    aws wafv2 update-web-acl \
        --name "$WAF_ACL_NAME" \
        --scope "$SCOPE" \
        --id "$WAF_ACL_ID" \
        --region "$REGION" \
        --lock-token "$LOCK_TOKEN" \
        --default-action Allow={} \
        --rules "$UPDATED_RULES" \
        --visibility-config "SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=$WAF_ACL_NAME" \
        > /dev/null

    log_success "BlocklistIPRule added to WAF ACL (Priority 0)"
fi

echo ""
echo "================================================================================"
echo "WAF Blocklist IPSet Setup Complete!"
echo "================================================================================"
echo ""
echo "IPSet Configuration:"
echo "  Name:           $IP_SET_NAME"
echo "  ID:             $IP_SET_ID"
echo "  ARN:            $IP_SET_ARN"
echo "  Scope:          $SCOPE"
echo "  Region:         $REGION"
echo ""
echo "WAF ACL Configuration:"
echo "  Name:           $WAF_ACL_NAME"
echo "  ID:             $WAF_ACL_ID"
echo "  Blocklist Rule: BlocklistIPRule (Priority 0)"
echo ""
echo "Management:"
echo "  Add IP:         ./manage-blocklist.sh add <IP>"
echo "  Remove IP:      ./manage-blocklist.sh remove <IP>"
echo "  List IPs:       ./manage-blocklist.sh list"
echo ""
echo "Next Steps:"
echo "  1. Deploy escalation-plugin-waf-blocklist Lambda function"
echo "  2. Configure EventBridge trigger (rate: 5 minutes)"
echo "  3. Test with high-severity escalation (severity 4-5)"
echo ""
echo "================================================================================"

# Save configuration
cat > "$SCRIPT_DIR/waf-blocklist-config.env" <<EOF
export WAF_BLOCKLIST_IP_SET_NAME="$IP_SET_NAME"
export WAF_BLOCKLIST_IP_SET_ID="$IP_SET_ID"
export WAF_BLOCKLIST_IP_SET_ARN="$IP_SET_ARN"
export WAF_ACL_NAME="$WAF_ACL_NAME"
export WAF_ACL_ID="$WAF_ACL_ID"
export WAF_SCOPE="$SCOPE"
export WAF_REGION="$REGION"
EOF

log_info "Configuration saved to waf-blocklist-config.env"
