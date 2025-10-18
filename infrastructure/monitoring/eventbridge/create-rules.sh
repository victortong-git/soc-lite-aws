#!/bin/bash

# Create EventBridge Rules
# Sets up scheduled or event-pattern rules with Lambda targets

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --rule-name NAME        Rule name (required)"
    echo "  --rule-type TYPE        Rule type: schedule|event (required)"
    echo "  --schedule EXPR         Schedule expression for scheduled rules (required for schedule type)"
    echo "  --event-pattern JSON    Event pattern JSON for event rules (required for event type)"
    echo "  --target-arn ARN        Target Lambda function ARN (required)"
    echo "  --description DESC      Rule description (optional)"
    echo "  --enabled               Enable rule immediately (default: enabled)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Schedule Expression Examples:"
    echo "  rate(5 minutes)         - Every 5 minutes"
    echo "  rate(1 hour)            - Every hour"
    echo "  rate(1 day)             - Every day"
    echo "  cron(0 12 * * ? *)      - Every day at 12:00 UTC"
    echo "  cron(0 9 ? * MON-FRI *) - Weekdays at 9:00 UTC"
    echo ""
    echo "Examples:"
    echo "  $0 --rule-name daily-monitoring --rule-type schedule --schedule 'rate(1 day)' --target-arn arn:aws:lambda:..."
    echo "  $0 --rule-name waf-alert --rule-type event --event-pattern '{...}' --target-arn arn:aws:lambda:..."
    exit 1
}

# Parse arguments
RULE_NAME=""
RULE_TYPE=""
SCHEDULE=""
EVENT_PATTERN=""
TARGET_ARN=""
DESCRIPTION=""
ENABLED=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --rule-name)
            RULE_NAME="$2"
            shift 2
            ;;
        --rule-type)
            RULE_TYPE="$2"
            shift 2
            ;;
        --schedule)
            SCHEDULE="$2"
            shift 2
            ;;
        --event-pattern)
            EVENT_PATTERN="$2"
            shift 2
            ;;
        --target-arn)
            TARGET_ARN="$2"
            shift 2
            ;;
        --description)
            DESCRIPTION="$2"
            shift 2
            ;;
        --enabled)
            ENABLED=true
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
if [ -z "$RULE_NAME" ] || [ -z "$RULE_TYPE" ] || [ -z "$TARGET_ARN" ]; then
    log_error "Rule name, rule type, and target ARN are required"
    usage
fi

# Validate rule type and required parameters
case "$RULE_TYPE" in
    schedule)
        if [ -z "$SCHEDULE" ]; then
            log_error "Schedule expression is required for schedule rule type"
            usage
        fi
        ;;
    event)
        if [ -z "$EVENT_PATTERN" ]; then
            log_error "Event pattern is required for event rule type"
            usage
        fi
        ;;
    *)
        log_error "Invalid rule type: $RULE_TYPE (must be schedule or event)"
        usage
        ;;
esac

echo "Creating EventBridge Rule"
echo "========================="
echo ""
validate_aws_cli

# Extract Lambda function name from ARN
FUNCTION_NAME=$(echo "$TARGET_ARN" | awk -F':' '{print $NF}')

# Check if Lambda function exists
log_info "Checking if Lambda function exists..."
if ! aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
    log_error "Lambda function $FUNCTION_NAME does not exist"
    exit 1
fi

log_info "Lambda function found: $FUNCTION_NAME ✓"
echo ""

# Create or update EventBridge rule
log_step "Creating EventBridge rule..."

CREATE_ARGS=(
    --name "$RULE_NAME"
    --region "$REGION"
)

if [ "$RULE_TYPE" = "schedule" ]; then
    CREATE_ARGS+=(--schedule-expression "$SCHEDULE")
else
    CREATE_ARGS+=(--event-pattern "$EVENT_PATTERN")
fi

if [ -n "$DESCRIPTION" ]; then
    CREATE_ARGS+=(--description "$DESCRIPTION")
fi

if [ "$ENABLED" = true ]; then
    CREATE_ARGS+=(--state ENABLED)
else
    CREATE_ARGS+=(--state DISABLED)
fi

RULE_ARN=$(aws events put-rule "${CREATE_ARGS[@]}" --query 'RuleArn' --output text)

log_info "Rule created: $RULE_NAME ✓"
log_info "Rule ARN: $RULE_ARN"
echo ""

# Add Lambda permission for EventBridge
log_step "Adding Lambda invoke permission..."

STATEMENT_ID="eventbridge-$RULE_NAME-$(date +%s)"

aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id "$STATEMENT_ID" \
    --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --source-arn "$RULE_ARN" \
    --region "$REGION" 2>/dev/null || log_info "Permission may already exist"

log_info "Lambda permission added ✓"
echo ""

# Add target to rule
log_step "Adding Lambda target to rule..."

TARGET_JSON=$(cat <<EOF
[
    {
        "Id": "1",
        "Arn": "$TARGET_ARN"
    }
]
EOF
)

aws events put-targets \
    --rule "$RULE_NAME" \
    --targets "$TARGET_JSON" \
    --region "$REGION" > /dev/null

log_info "Target added ✓"
echo ""

# Display rule details
log_step "Rule Details"
RULE_INFO=$(aws events describe-rule --name "$RULE_NAME" --region "$REGION")

echo "  Rule Name:     $RULE_NAME"
echo "  Rule ARN:      $RULE_ARN"
echo "  Type:          $RULE_TYPE"

if [ "$RULE_TYPE" = "schedule" ]; then
    echo "  Schedule:      $SCHEDULE"
else
    echo "  Event Pattern:"
    echo "$EVENT_PATTERN" | jq '.'
fi

echo "  Target:        $FUNCTION_NAME"
echo "  State:         $(echo "$RULE_INFO" | jq -r '.State')"

if [ -n "$DESCRIPTION" ]; then
    echo "  Description:   $DESCRIPTION"
fi

echo ""

log_info "EventBridge rule created successfully! ✓"
echo ""

if [ "$RULE_TYPE" = "schedule" ]; then
    echo "The Lambda function will be triggered according to the schedule:"
    echo "  $SCHEDULE"
    echo ""
fi

echo "Manage rule:"
echo "  Enable:  aws events enable-rule --name $RULE_NAME --region $REGION"
echo "  Disable: aws events disable-rule --name $RULE_NAME --region $REGION"
echo "  Delete:  aws events delete-rule --name $RULE_NAME --region $REGION"
echo ""
