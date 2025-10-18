#!/bin/bash

# Setup SNS Topics
# Creates SNS topics and email subscriptions for notifications

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --topic-name NAME       SNS topic name (required)"
    echo "  --display-name NAME     Display name for topic (optional)"
    echo "  --email EMAIL           Email address to subscribe (optional, can be repeated)"
    echo "  --kms-key-id ID         KMS key ID for encryption (optional)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --topic-name soc-lite-critical-alerts --display-name 'SOC Critical Alerts' --email admin@example.com"
    echo "  $0 --topic-name monitoring-alerts --email admin@example.com --email ops@example.com"
    exit 1
}

# Parse arguments
TOPIC_NAME=""
DISPLAY_NAME=""
EMAILS=()
KMS_KEY_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --topic-name)
            TOPIC_NAME="$2"
            shift 2
            ;;
        --display-name)
            DISPLAY_NAME="$2"
            shift 2
            ;;
        --email)
            EMAILS+=("$2")
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
if [ -z "$TOPIC_NAME" ]; then
    log_error "Topic name is required"
    usage
fi

echo "Setting up SNS Topic"
echo "===================="
echo ""
validate_aws_cli

# Check if topic already exists
log_info "Checking if topic exists..."
EXISTING_TOPIC_ARN=$(aws sns list-topics \
    --region "$REGION" \
    --query "Topics[?contains(TopicArn, ':$TOPIC_NAME')].TopicArn" \
    --output text)

if [ -n "$EXISTING_TOPIC_ARN" ]; then
    log_warn "Topic $TOPIC_NAME already exists"
    TOPIC_ARN="$EXISTING_TOPIC_ARN"
    echo "  Topic ARN: $TOPIC_ARN"
    echo ""
else
    # Create SNS topic
    log_step "Creating SNS topic..."

    CREATE_ARGS=(
        --name "$TOPIC_NAME"
        --region "$REGION"
    )

    TOPIC_ARN=$(aws sns create-topic "${CREATE_ARGS[@]}" --query 'TopicArn' --output text)

    log_info "Topic created: $TOPIC_NAME ✓"
    log_info "Topic ARN: $TOPIC_ARN"
    echo ""
fi

# Set display name
if [ -n "$DISPLAY_NAME" ]; then
    log_step "Setting display name..."

    aws sns set-topic-attributes \
        --topic-arn "$TOPIC_ARN" \
        --attribute-name DisplayName \
        --attribute-value "$DISPLAY_NAME" \
        --region "$REGION"

    log_info "Display name set: $DISPLAY_NAME ✓"
    echo ""
fi

# Configure encryption
if [ -n "$KMS_KEY_ID" ]; then
    log_step "Configuring encryption..."

    aws sns set-topic-attributes \
        --topic-arn "$TOPIC_ARN" \
        --attribute-name KmsMasterKeyId \
        --attribute-value "$KMS_KEY_ID" \
        --region "$REGION"

    log_info "Encryption configured ✓"
    echo ""
fi

# Subscribe emails
if [ ${#EMAILS[@]} -gt 0 ]; then
    log_step "Creating email subscriptions..."

    for email in "${EMAILS[@]}"; do
        log_info "Subscribing: $email"

        SUBSCRIPTION_ARN=$(aws sns subscribe \
            --topic-arn "$TOPIC_ARN" \
            --protocol email \
            --notification-endpoint "$email" \
            --region "$REGION" \
            --query 'SubscriptionArn' \
            --output text)

        if [ "$SUBSCRIPTION_ARN" = "pending confirmation" ]; then
            log_info "Subscription pending confirmation (check email) ✓"
        else
            log_info "Subscription confirmed ✓"
        fi
    done

    echo ""
    log_warn "Note: Email subscribers must confirm their subscription by clicking"
    log_warn "the confirmation link sent to their email address."
    echo ""
fi

# Get topic attributes
TOPIC_ATTRS=$(aws sns get-topic-attributes \
    --topic-arn "$TOPIC_ARN" \
    --region "$REGION" \
    --query 'Attributes')

# Display topic details
log_step "Topic Details"
echo "  Topic Name:        $TOPIC_NAME"
echo "  Topic ARN:         $TOPIC_ARN"
echo "  Region:            $REGION"

if [ -n "$DISPLAY_NAME" ]; then
    echo "  Display Name:      $DISPLAY_NAME"
fi

SUBSCRIPTIONS_CONFIRMED=$(echo "$TOPIC_ATTRS" | jq -r '.SubscriptionsConfirmed // "0"')
SUBSCRIPTIONS_PENDING=$(echo "$TOPIC_ATTRS" | jq -r '.SubscriptionsPending // "0"')
echo "  Subscriptions:     $SUBSCRIPTIONS_CONFIRMED confirmed, $SUBSCRIPTIONS_PENDING pending"

if [ -n "$KMS_KEY_ID" ]; then
    echo "  Encryption:        Enabled (KMS)"
    echo "  KMS Key:           $KMS_KEY_ID"
else
    echo "  Encryption:        Disabled"
fi

echo ""

# List subscriptions
if [ "$SUBSCRIPTIONS_CONFIRMED" != "0" ] || [ "$SUBSCRIPTIONS_PENDING" != "0" ]; then
    log_info "Subscriptions:"
    aws sns list-subscriptions-by-topic \
        --topic-arn "$TOPIC_ARN" \
        --region "$REGION" \
        --query 'Subscriptions[*].[Protocol,Endpoint,SubscriptionArn]' \
        --output text | while read -r protocol endpoint sub_arn; do
            STATUS="confirmed"
            if [[ "$sub_arn" == "PendingConfirmation" ]]; then
                STATUS="pending"
            fi
            echo "  - $protocol: $endpoint ($STATUS)"
        done
    echo ""
fi

log_info "SNS topic setup complete! ✓"
echo ""

echo "Test notification:"
echo "  aws sns publish --topic-arn $TOPIC_ARN --message 'Test message' --subject 'Test' --region $REGION"
echo ""

echo "Subscribe more emails:"
echo "  aws sns subscribe --topic-arn $TOPIC_ARN --protocol email --notification-endpoint user@example.com --region $REGION"
echo ""
