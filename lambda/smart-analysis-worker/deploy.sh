#!/bin/bash

# Smart Analysis Worker Lambda Deployment Script

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
if [ -z "$DB_PASSWORD" ] || [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$BULK_ANALYSIS_AGENT_ARN" ]; then
    echo "Error: Required environment variables not set in .env"
    echo "Required: DB_PASSWORD, DB_HOST, DB_USER, BULK_ANALYSIS_AGENT_ARN"
    exit 1
fi

FUNCTION_NAME="soc-lite-smart-analysis-worker"
ROLE_ARN="${LAMBDA_ROLE_ARN}"
REGION="${AWS_REGION}"

echo "============================================"
echo "Deploying Smart Analysis Worker Lambda"
echo "============================================"
echo ""

# Step 1: Install dependencies
echo "Step 1: Installing dependencies..."
npm install --production
echo ""

# Step 2: Create deployment package
echo "Step 2: Creating deployment package..."
rm -f function.zip
zip -r function.zip index.mjs node_modules package.json
echo ""

# Step 3: Check if function exists
echo "Step 3: Checking if Lambda function exists..."
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION >/dev/null 2>&1; then
  echo "Function exists, updating code..."
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip \
    --region $REGION

  echo "Updating environment variables..."
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --timeout 300 \
    --memory-size 512 \
    --environment "Variables={
      DB_HOST=$DB_HOST,
      DB_PORT=$DB_PORT,
      DB_NAME=$DB_NAME,
      DB_USER=$DB_USER,
      DB_PASSWORD=$DB_PASSWORD,
      DB_SSL=$DB_SSL,
      BULK_ANALYSIS_AGENT_ARN=$BULK_ANALYSIS_AGENT_ARN
    }" \
    --region $REGION
else
  echo "Function does not exist, creating..."
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs22.x \
    --role $ROLE_ARN \
    --handler index.handler \
    --zip-file fileb://function.zip \
    --timeout 300 \
    --memory-size 512 \
    --environment "Variables={
      DB_HOST=$DB_HOST,
      DB_PORT=$DB_PORT,
      DB_NAME=$DB_NAME,
      DB_USER=$DB_USER,
      DB_PASSWORD=$DB_PASSWORD,
      DB_SSL=$DB_SSL,
      BULK_ANALYSIS_AGENT_ARN=$BULK_ANALYSIS_AGENT_ARN
    }" \
    --region $REGION

  echo ""
  echo "Waiting for function to be active..."
  aws lambda wait function-active --function-name $FUNCTION_NAME --region $REGION
fi

echo ""
echo "Step 4: Setting up EventBridge trigger (every 5 minutes)..."

# Create EventBridge rule if it doesn't exist
RULE_NAME="smart-analysis-worker-trigger"

# Check if rule exists
if aws events describe-rule --name $RULE_NAME --region $REGION >/dev/null 2>&1; then
  echo "EventBridge rule already exists, updating schedule..."
  aws events put-rule \
    --name $RULE_NAME \
    --description "Trigger smart analysis worker every 5 minutes" \
    --schedule-expression "rate(5 minutes)" \
    --state ENABLED \
    --region $REGION
else
  echo "Creating EventBridge rule..."
  aws events put-rule \
    --name $RULE_NAME \
    --description "Trigger smart analysis worker every 5 minutes" \
    --schedule-expression "rate(5 minutes)" \
    --state ENABLED \
    --region $REGION

  echo "Adding Lambda permission for EventBridge..."
  aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id AllowEventBridgeInvoke \
    --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --source-arn "arn:aws:events:$REGION:581425340084:rule/$RULE_NAME" \
    --region $REGION || true

  echo "Adding Lambda as target..."
  aws events put-targets \
    --rule $RULE_NAME \
    --targets "Id=1,Arn=arn:aws:lambda:$REGION:581425340084:function:$FUNCTION_NAME" \
    --region $REGION
fi

echo ""
echo "============================================"
echo "Deployment Complete!"
echo "============================================"
echo ""
echo "Function Name: $FUNCTION_NAME"
echo "Trigger: Every 5 minutes"
echo "Max Concurrent Jobs: 2"
echo ""
echo "Check logs with:"
echo "aws logs tail /aws/lambda/$FUNCTION_NAME --follow"
echo ""
echo "IMPORTANT: After deploying bulk-analysis-agent, update BULK_ANALYSIS_AGENT_ARN"
echo "and redeploy this Lambda with: ./deploy.sh"
echo ""
