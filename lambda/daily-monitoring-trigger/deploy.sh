#!/bin/bash

# Deploy Daily Monitoring Trigger Lambda Function
# This Lambda is triggered daily by EventBridge to detect repeated attacks

set -e

# Source central configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
else
    echo "Error: .env file not found at $PROJECT_ROOT/.env"
    exit 1
fi

# Validate required variables
if [ -z "$SECOPS_AGENT_ARN" ] || [ -z "$LAMBDA_ROLE_ARN" ]; then
    echo "Error: Required environment variables not set in .env"
    echo "Required: SECOPS_AGENT_ARN, LAMBDA_ROLE_ARN"
    exit 1
fi

FUNCTION_NAME="soc-lite-daily-monitoring-trigger"
REGION="${AWS_REGION}"
ROLE_ARN="${LAMBDA_ROLE_ARN}"

echo "Deploying Daily Monitoring Trigger Lambda..."
echo "Function: $FUNCTION_NAME"
echo "Region: $REGION"

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Create deployment package
echo "Creating deployment package..."
zip -r function.zip . -x "*.sh" "*.md" ".git/*"

# Check if function exists
FUNCTION_EXISTS=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>&1 || true)

if echo "$FUNCTION_EXISTS" | grep -q "ResourceNotFoundException"; then
  echo "Creating new Lambda function..."
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs22.x \
    --role $ROLE_ARN \
    --handler index.handler \
    --zip-file fileb://function.zip \
    --timeout 300 \
    --memory-size 512 \
    --region $REGION \
    --environment "Variables={SECOPS_AGENT_ARN=${SECOPS_AGENT_ARN},MONITORING_HOURS=24}"
else
  echo "Updating existing Lambda function..."
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip \
    --region $REGION

  echo "Updating function configuration..."
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --timeout 300 \
    --memory-size 512 \
    --environment "Variables={SECOPS_AGENT_ARN=${SECOPS_AGENT_ARN},MONITORING_HOURS=24}" \
    --region $REGION
fi

# Create EventBridge rule for daily execution (2 AM UTC)
echo "Creating EventBridge rule for daily execution..."
RULE_NAME="soc-lite-daily-monitoring-schedule"

aws events put-rule \
  --name $RULE_NAME \
  --schedule-expression "cron(0 2 * * ? *)" \
  --state ENABLED \
  --description "Daily trigger for SOC Lite monitoring agent (2 AM UTC)" \
  --region $REGION || true

# Add Lambda permission for EventBridge
echo "Adding EventBridge permission..."
aws lambda add-permission \
  --function-name $FUNCTION_NAME \
  --statement-id EventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:$(aws sts get-caller-identity --query Account --output text):rule/$RULE_NAME" \
  --region $REGION 2>/dev/null || echo "Permission already exists"

# Add Lambda as target for EventBridge rule
echo "Adding Lambda as EventBridge target..."
LAMBDA_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)

aws events put-targets \
  --rule $RULE_NAME \
  --targets "Id=1,Arn=$LAMBDA_ARN" \
  --region $REGION

# Cleanup
rm -f function.zip

echo "✅ Daily Monitoring Trigger Lambda deployed successfully!"
echo "Function ARN: $LAMBDA_ARN"
echo "Schedule: Daily at 2:00 AM UTC (cron: 0 2 * * ? *)"
echo ""
echo "To test manually:"
echo "aws lambda invoke --function-name $FUNCTION_NAME --region $REGION output.json"
