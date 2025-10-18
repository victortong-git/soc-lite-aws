#!/bin/bash
#
# Deploy Monitoring Trigger Lambda Function
#

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
if [ -z "$DB_PASSWORD" ] || [ -z "$DB_HOST" ] || [ -z "$MONITORING_AGENT_ARN" ] || [ -z "$SNS_TOPIC_ARN_MONITORING" ]; then
    echo "Error: Required environment variables not set in .env"
    echo "Required: DB_PASSWORD, DB_HOST, MONITORING_AGENT_ARN, SNS_TOPIC_ARN_MONITORING, ALERT_EMAIL"
    exit 1
fi

FUNCTION_NAME="soc-lite-monitoring-trigger"
ROLE_NAME="soc-lite-monitoring-trigger-role"
REGION="${AWS_REGION}"

echo "=========================================="
echo "Deploying Monitoring Trigger Lambda"
echo "=========================================="
echo ""

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account: $ACCOUNT_ID"
echo "Region: $REGION"
echo ""

# Create IAM role if it doesn't exist
echo "Setting up IAM role..."
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text 2>/dev/null || echo "")

if [ -z "$ROLE_ARN" ]; then
    echo "Creating IAM role: $ROLE_NAME"

    # Create trust policy
    cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    aws iam create-role \
        --role-name $ROLE_NAME \
        --assume-role-policy-document file:///tmp/trust-policy.json

    # Attach policies
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/AmazonSNSFullAccess

    # Create inline policy for RDS access
    cat > /tmp/rds-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds:*",
        "rds-data:*"
      ],
      "Resource": "*"
    }
  ]
}
EOF

    aws iam put-role-policy \
        --role-name $ROLE_NAME \
        --policy-name RDSAccess \
        --policy-document file:///tmp/rds-policy.json

    ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
    echo "✓ Role created: $ROLE_ARN"
    echo "Waiting for role to propagate..."
    sleep 10
else
    echo "✓ Role exists: $ROLE_ARN"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install --production

# Package Lambda
echo ""
echo "Packaging Lambda function..."
rm -f function.zip
zip -r function.zip index.mjs node_modules package.json -q
echo "✓ Package created: function.zip ($(du -h function.zip | cut -f1))"

# Check if Lambda function exists
echo ""
FUNCTION_EXISTS=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null || echo "")

if [ -z "$FUNCTION_EXISTS" ]; then
    echo "Creating Lambda function: $FUNCTION_NAME"

    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs22.x \
        --role $ROLE_ARN \
        --handler index.handler \
        --zip-file fileb://function.zip \
        --timeout 60 \
        --memory-size 512 \
        --environment "Variables={
            DB_HOST=${DB_HOST},
            DB_PORT=${DB_PORT},
            DB_NAME=${DB_NAME},
            DB_USER=${DB_USER},
            DB_PASSWORD=${DB_PASSWORD},
            DB_SSL=true,
            MONITORING_AGENT_ARN=${MONITORING_AGENT_ARN},
            SNS_TOPIC_ARN_MONITORING=${SNS_TOPIC_ARN_MONITORING},
            ALERT_EMAIL=${ALERT_EMAIL}
        }" \
        --region $REGION

    echo "✓ Lambda function created"
else
    echo "Updating Lambda function code: $FUNCTION_NAME"

    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://function.zip \
        --region $REGION

    echo "✓ Lambda function code updated"

    # Wait for update to complete
    sleep 3

    # Update environment variables
    echo "Updating environment variables..."
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --environment "Variables={
            DB_HOST=${DB_HOST},
            DB_PORT=${DB_PORT},
            DB_NAME=${DB_NAME},
            DB_USER=${DB_USER},
            DB_PASSWORD=${DB_PASSWORD},
            DB_SSL=true,
            MONITORING_AGENT_ARN=${MONITORING_AGENT_ARN},
            SNS_TOPIC_ARN_MONITORING=${SNS_TOPIC_ARN_MONITORING},
            ALERT_EMAIL=${ALERT_EMAIL}
        }" \
        --region $REGION > /dev/null

    echo "✓ Environment variables updated"
fi

# Add EventBridge permission
echo ""
echo "Adding EventBridge trigger permission..."
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id EventBridgeInvoke \
    --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --source-arn "arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/soc-lite-monitoring-daily" \
    --region $REGION 2>/dev/null || echo "✓ Permission already exists"

# Update EventBridge target
echo ""
echo "Updating EventBridge target..."

# Create targets JSON file
cat > /tmp/targets.json <<EOF
[
  {
    "Id": "1",
    "Arn": "arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function/${FUNCTION_NAME}"
  }
]
EOF

aws events put-targets \
    --rule soc-lite-monitoring-daily \
    --targets file:///tmp/targets.json \
    --region $REGION

echo "✓ EventBridge target updated"
rm -f /tmp/targets.json

# Cleanup
rm -f function.zip /tmp/trust-policy.json /tmp/rds-policy.json

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Function: $FUNCTION_NAME"
echo "Region: $REGION"
echo "Schedule: Daily at 9 AM UTC (cron: 0 9 * * ? *)"
echo ""
echo "Test manually:"
echo "  aws lambda invoke --function-name $FUNCTION_NAME --region $REGION response.json"
echo ""
echo "View logs:"
echo "  aws logs tail /aws/lambda/$FUNCTION_NAME --follow --region $REGION"
echo ""
