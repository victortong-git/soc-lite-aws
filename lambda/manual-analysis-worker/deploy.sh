#!/bin/bash

# Manual Analysis Worker Lambda Deployment Script
# Processes manual analysis jobs triggered by "AI Analysis" button

set -e

FUNCTION_NAME="soc-lite-manual-analysis-worker"
REGION="us-east-1"

echo "============================================"
echo "Deploying Manual Analysis Worker Lambda"
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
echo "  - Processes manual analysis jobs (created via frontend button)"
echo "  - Invokes secops-agent for individual event analysis"
echo "  - Updates events with AI analysis results"
echo "  - Concurrency limit: 2 jobs at a time"
echo "  - Trigger: EventBridge every 5 minutes"
echo ""
echo "Check logs with:"
echo "aws logs tail /aws/lambda/$FUNCTION_NAME --follow --region $REGION"
echo ""
