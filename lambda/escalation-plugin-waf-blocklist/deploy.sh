#!/bin/bash

################################################################################
# Deploy escalation-plugin-waf-blocklist Lambda Function
# Adds malicious IPs to WAF blocklist IPSet for severity 4-5 escalations
################################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source central configuration
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
else
    echo "Error: .env file not found at $PROJECT_ROOT/.env"
    exit 1
fi

# Validate required variables
if [ -z "$DB_PASSWORD" ] || [ -z "$DB_HOST" ] || [ -z "$DB_USER" ]; then
    echo "Error: Required environment variables not set in .env"
    echo "Required: DB_PASSWORD, DB_HOST, DB_USER"
    exit 1
fi

FUNCTION_NAME="escalation-plugin-waf-blocklist"
RUNTIME="nodejs20.x"
HANDLER="index.handler"
TIMEOUT=300
MEMORY_SIZE=512

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "================================================================================"
echo "Deploy WAF Blocklist Escalation Plugin Lambda"
echo "================================================================================"
echo ""

# Get AWS account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION}

log_info "AWS Account ID: $ACCOUNT_ID"
log_info "AWS Region: $REGION"
echo ""

# Load WAF blocklist configuration
WAF_CONFIG_FILE="$PROJECT_ROOT/infrastructure/security/waf/waf-blocklist-config.env"
if [ -f "$WAF_CONFIG_FILE" ]; then
    log_info "Loading WAF blocklist configuration..."
    source "$WAF_CONFIG_FILE"
    log_info "WAF IPSet: $WAF_BLOCKLIST_IP_SET_NAME (ID: $WAF_BLOCKLIST_IP_SET_ID)"
else
    log_error "WAF blocklist config not found: $WAF_CONFIG_FILE"
    log_error "Please run: infrastructure/security/waf/create-waf-blocklist-ipset.sh"
    exit 1
fi

# Get Lambda execution role
ROLE_NAME=${LAMBDA_ROLE_NAME:-"soc-lite-backend-role"}
ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"

log_info "Lambda execution role: $ROLE_ARN"
echo ""

# Install dependencies
log_info "Installing dependencies..."
cd "$SCRIPT_DIR"
npm install --production
log_success "Dependencies installed"
echo ""

# Create deployment package
log_info "Creating deployment package..."
TEMP_DIR=$(mktemp -d)
cp index.mjs "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"
cp -r node_modules "$TEMP_DIR/"

cd "$TEMP_DIR"
zip -q -r "$SCRIPT_DIR/function.zip" .
cd "$SCRIPT_DIR"
rm -rf "$TEMP_DIR"

log_success "Deployment package created: function.zip"
echo ""

# Check if function exists
FUNCTION_EXISTS=$(aws lambda get-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" 2>/dev/null && echo "true" || echo "false")

if [ "$FUNCTION_EXISTS" = "true" ]; then
    log_info "Updating existing Lambda function..."

    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file fileb://function.zip \
        --region "$REGION" > /dev/null

    log_success "Function code updated"

    # Update environment variables
    aws lambda update-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --timeout "$TIMEOUT" \
        --memory-size "$MEMORY_SIZE" \
        --environment "Variables={
            DB_HOST=$DB_HOST,
            DB_PORT=$DB_PORT,
            DB_NAME=$DB_NAME,
            DB_USER=$DB_USER,
            DB_PASSWORD=$DB_PASSWORD,
            DB_SSL=$DB_SSL,
            WAF_BLOCKLIST_IP_SET_NAME=$WAF_BLOCKLIST_IP_SET_NAME,
            WAF_BLOCKLIST_IP_SET_ID=$WAF_BLOCKLIST_IP_SET_ID
        }" \
        --region "$REGION" > /dev/null

    log_success "Function configuration updated"
else
    log_info "Creating new Lambda function..."

    aws lambda create-function \
        --function-name "$FUNCTION_NAME" \
        --runtime "$RUNTIME" \
        --role "$ROLE_ARN" \
        --handler "$HANDLER" \
        --timeout "$TIMEOUT" \
        --memory-size "$MEMORY_SIZE" \
        --zip-file fileb://function.zip \
        --environment "Variables={
            DB_HOST=$DB_HOST,
            DB_PORT=$DB_PORT,
            DB_NAME=$DB_NAME,
            DB_USER=$DB_USER,
            DB_PASSWORD=$DB_PASSWORD,
            DB_SSL=$DB_SSL,
            WAF_BLOCKLIST_IP_SET_NAME=$WAF_BLOCKLIST_IP_SET_NAME,
            WAF_BLOCKLIST_IP_SET_ID=$WAF_BLOCKLIST_IP_SET_ID
        }" \
        --region "$REGION" > /dev/null

    log_success "Function created"
fi

echo ""

# Create/update EventBridge rule
RULE_NAME="soc-lite-waf-blocklist-processor"
log_info "Setting up EventBridge trigger..."

# Check if rule exists
RULE_EXISTS=$(aws events describe-rule \
    --name "$RULE_NAME" \
    --region "$REGION" 2>/dev/null && echo "true" || echo "false")

if [ "$RULE_EXISTS" = "false" ]; then
    log_info "Creating EventBridge rule..."

    aws events put-rule \
        --name "$RULE_NAME" \
        --schedule-expression "rate(5 minutes)" \
        --state ENABLED \
        --description "Trigger WAF blocklist processor every 5 minutes" \
        --region "$REGION" > /dev/null

    log_success "EventBridge rule created"
fi

# Add Lambda as target
aws events put-targets \
    --rule "$RULE_NAME" \
    --targets "Id=1,Arn=arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME" \
    --region "$REGION" > /dev/null

log_success "Lambda added as EventBridge target"

# Grant EventBridge permission to invoke Lambda
aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id EventBridgeInvoke \
    --action 'lambda:InvokeFunction' \
    --principal events.amazonaws.com \
    --source-arn "arn:aws:events:$REGION:$ACCOUNT_ID:rule/$RULE_NAME" \
    --region "$REGION" 2>/dev/null || log_info "Permission already exists"

log_success "EventBridge permission granted"

# Cleanup
rm -f function.zip

echo ""
echo "================================================================================"
echo "WAF Blocklist Lambda Deployed Successfully!"
echo "================================================================================"
echo ""
echo "Function Details:"
echo "  Name:           $FUNCTION_NAME"
echo "  Runtime:        $RUNTIME"
echo "  Region:         $REGION"
echo "  Handler:        $HANDLER"
echo "  Timeout:        ${TIMEOUT}s"
echo "  Memory:         ${MEMORY_SIZE}MB"
echo ""
echo "EventBridge Trigger:"
echo "  Rule:           $RULE_NAME"
echo "  Schedule:       Every 5 minutes"
echo "  State:          ENABLED"
echo ""
echo "WAF Configuration:"
echo "  IPSet Name:     $WAF_BLOCKLIST_IP_SET_NAME"
echo "  IPSet ID:       $WAF_BLOCKLIST_IP_SET_ID"
echo ""
echo "Test Lambda:"
echo "  aws lambda invoke \\"
echo "    --function-name $FUNCTION_NAME \\"
echo "    --region $REGION \\"
echo "    --log-type Tail \\"
echo "    --query 'LogResult' \\"
echo "    --output text response.json | base64 -d"
echo ""
echo "View Logs:"
echo "  aws logs tail /aws/lambda/$FUNCTION_NAME --follow --region $REGION"
echo ""
echo "================================================================================"
