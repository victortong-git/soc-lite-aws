#!/bin/bash

# Setup CloudWatch Logs
# Creates log groups and configures retention policies

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --log-group NAME        Log group name (required)"
    echo "  --retention DAYS        Retention in days: 1|3|5|7|14|30|60|90|120|150|180|365|400|545|731|1827|3653 (default: 30)"
    echo "  --kms-key-id ID         KMS key ID for encryption (optional)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --log-group /aws/lambda/my-function"
    echo "  $0 --log-group /aws/waf/my-webacl --retention 90"
    echo "  $0 --log-group /aws/lambda/my-function --retention 365 --kms-key-id arn:aws:kms:..."
    exit 1
}

# Parse arguments
LOG_GROUP=""
RETENTION=30
KMS_KEY_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --log-group)
            LOG_GROUP="$2"
            shift 2
            ;;
        --retention)
            RETENTION="$2"
            shift 2
            ;;
        --kms-key-id)
            KMS_KEY_ID="$2"
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
if [ -z "$LOG_GROUP" ]; then
    log_error "Log group name is required"
    usage
fi

# Validate retention period
VALID_RETENTIONS="1 3 5 7 14 30 60 90 120 150 180 365 400 545 731 1827 3653"
if ! echo "$VALID_RETENTIONS" | grep -qw "$RETENTION"; then
    log_error "Invalid retention period: $RETENTION"
    log_error "Valid values: $VALID_RETENTIONS"
    exit 1
fi

echo "Setting up CloudWatch Logs"
echo "=========================="
echo ""
validate_aws_cli

# Check if log group exists
log_info "Checking if log group exists..."
if aws logs describe-log-groups \
    --log-group-name-prefix "$LOG_GROUP" \
    --region "$REGION" \
    --query "logGroups[?logGroupName=='$LOG_GROUP']" \
    --output text | grep -q "$LOG_GROUP"; then

    log_warn "Log group $LOG_GROUP already exists"

    # Update retention policy
    log_info "Updating retention policy..."
    aws logs put-retention-policy \
        --log-group-name "$LOG_GROUP" \
        --retention-in-days "$RETENTION" \
        --region "$REGION"

    log_info "Retention policy updated ✓"
    echo ""
else
    # Create log group
    log_step "Creating log group..."

    CREATE_ARGS=(
        --log-group-name "$LOG_GROUP"
        --region "$REGION"
    )

    if [ -n "$KMS_KEY_ID" ]; then
        CREATE_ARGS+=(--kms-key-id "$KMS_KEY_ID")
    fi

    aws logs create-log-group "${CREATE_ARGS[@]}"

    log_info "Log group created ✓"
    echo ""

    # Set retention policy
    log_step "Setting retention policy..."
    aws logs put-retention-policy \
        --log-group-name "$LOG_GROUP" \
        --retention-in-days "$RETENTION" \
        --region "$REGION"

    log_info "Retention policy set to $RETENTION days ✓"
    echo ""
fi

# Add encryption if KMS key provided and not already encrypted
if [ -n "$KMS_KEY_ID" ]; then
    log_step "Configuring encryption..."

    aws logs associate-kms-key \
        --log-group-name "$LOG_GROUP" \
        --kms-key-id "$KMS_KEY_ID" \
        --region "$REGION" 2>/dev/null || log_info "Encryption already configured"

    log_info "Encryption configured ✓"
    echo ""
fi

# Get log group details
LOG_GROUP_INFO=$(aws logs describe-log-groups \
    --log-group-name-prefix "$LOG_GROUP" \
    --region "$REGION" \
    --query "logGroups[?logGroupName=='$LOG_GROUP'] | [0]")

# Display log group details
log_step "Log Group Details"
echo "  Name:              $LOG_GROUP"
echo "  Retention:         $RETENTION days"
echo "  Region:            $REGION"
echo "  ARN:               $(echo "$LOG_GROUP_INFO" | jq -r '.arn')"

STORED_BYTES=$(echo "$LOG_GROUP_INFO" | jq -r '.storedBytes // 0')
echo "  Storage:           $STORED_BYTES bytes"

if [ -n "$KMS_KEY_ID" ]; then
    echo "  Encryption:        Enabled (KMS)"
    echo "  KMS Key:           $KMS_KEY_ID"
else
    echo "  Encryption:        Default"
fi

CREATION_TIME=$(echo "$LOG_GROUP_INFO" | jq -r '.creationTime // 0')
if [ "$CREATION_TIME" != "0" ]; then
    CREATION_DATE=$(date -d @$((CREATION_TIME/1000)) +"%Y-%m-%d %H:%M:%S" 2>/dev/null || date -r $((CREATION_TIME/1000)) +"%Y-%m-%d %H:%M:%S")
    echo "  Created:           $CREATION_DATE"
fi

echo ""

log_info "CloudWatch Logs setup complete! ✓"
echo ""
echo "View logs:"
echo "  aws logs tail $LOG_GROUP --follow --region $REGION"
echo ""
echo "Query logs:"
echo "  aws logs filter-log-events --log-group-name $LOG_GROUP --region $REGION"
echo ""
