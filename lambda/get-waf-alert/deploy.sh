#!/bin/bash

# get-waf-alert Lambda Deployment Script
# Deploys the WAF log ingestion Lambda with auto-close logic

set -e

FUNCTION_NAME="get-waf-alert"
REGION="us-east-1"

echo "============================================"
echo "Deploying get-waf-alert Lambda"
echo "============================================"
echo ""

# Step 1: Create deployment package
echo "Step 1: Creating deployment package..."
rm -f function.zip
zip -r function.zip index.mjs node_modules package.json package-lock.json
echo ""

# Step 2: Update Lambda function code
echo "Step 2: Updating Lambda function code..."
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://function.zip \
  --region $REGION

echo ""
echo "============================================"
echo "Deployment Complete!"
echo "============================================"
echo ""
echo "Function Name: $FUNCTION_NAME"
echo "Features:"
echo "  - Auto-closes ALLOW events for safe patterns (favicon, static assets)"
echo "  - Creates timeline entries for auto-closed events"
echo "  - Tracks auto-close statistics in Lambda response"
echo ""
echo "Check logs with:"
echo "aws logs tail /aws/lambda/$FUNCTION_NAME --follow --region $REGION"
echo ""
