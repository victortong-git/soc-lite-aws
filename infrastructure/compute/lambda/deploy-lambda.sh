#!/bin/bash

################################################################################
# Step 1: Deploy Backend Lambda Function + API Gateway
################################################################################

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "================================================================================"
echo "Step 1: Deploy Backend Lambda + API Gateway"
echo "================================================================================"
echo ""

validate_aws_cli

# Step 1: Build TypeScript
log_step "Building TypeScript application..."
cd "$SCRIPT_DIR/../backend"

if [ ! -f "package.json" ]; then
    log_error "Backend package.json not found"
    exit 1
fi

log_info "Installing dependencies..."
npm install --production=false

log_info "Building TypeScript..."
npm run build

if [ ! -d "dist" ]; then
    log_error "Build failed - dist directory not found"
    exit 1
fi

log_info "Build successful ✓"
echo ""

# Step 2: Create deployment package
log_step "Creating Lambda deployment package..."
rm -rf lambda-package lambda-package.zip

mkdir -p lambda-package
cp -r dist lambda-package/
cp -r node_modules lambda-package/
cp package.json lambda-package/

cd lambda-package
zip -r ../lambda-package.zip . -q > /dev/null

cd ..
PACKAGE_SIZE=$(du -h lambda-package.zip | cut -f1)
log_info "Package created: $PACKAGE_SIZE"
echo ""

# Step 3: Create IAM role for Lambda
log_step "Setting up IAM role..."
ROLE_NAME="${LAMBDA_FUNCTION_NAME}-role"
ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"

if aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null; then
    log_info "IAM role already exists: $ROLE_NAME"
else
    log_info "Creating IAM role..."

    cat > /tmp/lambda-trust-policy.json <<EOF
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
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
        --description "Execution role for ${PROJECT_NAME} Lambda backend" \
        --region "$REGION" > /dev/null

    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"

    log_info "Waiting for IAM role to propagate..."
    sleep 10
fi

log_info "IAM Role: $ROLE_ARN ✓"
echo ""

# Step 4: Create or update Lambda function
log_step "Deploying Lambda function..."

if aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" --region "$REGION" 2>/dev/null; then
    log_info "Updating existing Lambda function..."

    aws lambda update-function-code \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --zip-file fileb://lambda-package.zip \
        --region "$REGION" > /dev/null

    sleep 2

    aws lambda update-function-configuration \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --runtime "$LAMBDA_RUNTIME" \
        --handler "$LAMBDA_HANDLER" \
        --memory-size "$LAMBDA_MEMORY" \
        --timeout "$LAMBDA_TIMEOUT" \
        --environment "Variables={
            NODE_ENV=production,
            DB_HOST=$DB_HOST,
            DB_PORT=$DB_PORT,
            DB_NAME=$DB_NAME,
            DB_USER=$DB_USER,
            DB_PASSWORD=$DB_PASSWORD,
            DB_SSL=true,
            JWT_SECRET=$JWT_SECRET,
            JWT_EXPIRY=$JWT_EXPIRY,
            CORS_ORIGIN=$CORS_ORIGIN
        }" \
        --region "$REGION" > /dev/null

    log_info "Lambda function updated ✓"
else
    log_info "Creating new Lambda function..."

    aws lambda create-function \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --runtime "$LAMBDA_RUNTIME" \
        --role "$ROLE_ARN" \
        --handler "$LAMBDA_HANDLER" \
        --zip-file fileb://lambda-package.zip \
        --memory-size "$LAMBDA_MEMORY" \
        --timeout "$LAMBDA_TIMEOUT" \
        --environment "Variables={
            NODE_ENV=production,
            DB_HOST=$DB_HOST,
            DB_PORT=$DB_PORT,
            DB_NAME=$DB_NAME,
            DB_USER=$DB_USER,
            DB_PASSWORD=$DB_PASSWORD,
            DB_SSL=true,
            JWT_SECRET=$JWT_SECRET,
            JWT_EXPIRY=$JWT_EXPIRY,
            CORS_ORIGIN=$CORS_ORIGIN
        }" \
        --region "$REGION" > /dev/null

    log_info "Lambda function created ✓"
fi

export LAMBDA_ARN=$(aws lambda get-function \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$REGION" \
    --query 'Configuration.FunctionArn' \
    --output text)

log_info "Lambda ARN: $LAMBDA_ARN"
echo ""

# Step 5: Create API Gateway
log_step "Setting up API Gateway..."

API_ID=$(aws apigatewayv2 get-apis \
    --region "$REGION" \
    --query "Items[?Name=='$API_NAME'].ApiId" \
    --output text)

if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
    log_info "Creating API Gateway..."

    API_ID=$(aws apigatewayv2 create-api \
        --name "$API_NAME" \
        --protocol-type HTTP \
        --cors-configuration "AllowOrigins=$CORS_ORIGIN,AllowMethods=GET,POST,PUT,DELETE,OPTIONS,AllowHeaders=Content-Type,Authorization,AllowCredentials=true" \
        --region "$REGION" \
        --query 'ApiId' \
        --output text)

    log_info "API Gateway created ✓"
else
    log_info "API Gateway already exists: $API_ID ✓"
fi

export API_GATEWAY_ID="$API_ID"

# Create integration
log_info "Creating Lambda integration..."

INTEGRATION_ID=$(aws apigatewayv2 get-integrations \
    --api-id "$API_ID" \
    --region "$REGION" \
    --query 'Items[0].IntegrationId' \
    --output text 2>/dev/null)

if [ -z "$INTEGRATION_ID" ] || [ "$INTEGRATION_ID" = "None" ]; then
    INTEGRATION_ID=$(aws apigatewayv2 create-integration \
        --api-id "$API_ID" \
        --integration-type AWS_PROXY \
        --integration-uri "$LAMBDA_ARN" \
        --payload-format-version 2.0 \
        --region "$REGION" \
        --query 'IntegrationId' \
        --output text)
    log_info "Integration created ✓"
else
    log_info "Integration already exists ✓"
fi

# Create route
aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key 'ANY /{proxy+}' \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" 2>/dev/null || log_info "Route already exists ✓"

# Create default route for root
aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key 'ANY /' \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" 2>/dev/null || log_info "Root route already exists ✓"

# Create stage
aws apigatewayv2 create-stage \
    --api-id "$API_ID" \
    --stage-name "$API_STAGE" \
    --auto-deploy \
    --region "$REGION" 2>/dev/null || log_info "Stage already exists ✓"

# Add Lambda permission for API Gateway
aws lambda add-permission \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --statement-id apigateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${AWS_ACCOUNT_ID}:${API_ID}/*/*" \
    --region "$REGION" 2>/dev/null || log_info "Permission already exists ✓"

# Get API endpoint
export API_GATEWAY_URL=$(aws apigatewayv2 get-api \
    --api-id "$API_ID" \
    --region "$REGION" \
    --query 'ApiEndpoint' \
    --output text)

echo ""
log_info "API Gateway URL: $API_GATEWAY_URL/$API_STAGE"
echo ""

# Step 6: Test deployment
log_step "Testing Lambda deployment..."

log_info "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "${API_GATEWAY_URL}/${API_STAGE}/health" || echo "FAILED")

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    log_info "Health check passed ✓"
else
    log_warn "Health check failed. Response: $HEALTH_RESPONSE"
    log_warn "Lambda may need a few seconds to warm up. Try again manually:"
    log_warn "  curl ${API_GATEWAY_URL}/${API_STAGE}/health"
fi

echo ""
echo "================================================================================"
echo "Lambda Deployment Complete! ✓"
echo "================================================================================"
echo ""
echo "Lambda Function:"
echo "  Name:           $LAMBDA_FUNCTION_NAME"
echo "  ARN:            $LAMBDA_ARN"
echo "  Runtime:        $LAMBDA_RUNTIME"
echo "  Memory:         ${LAMBDA_MEMORY}MB"
echo "  Timeout:        ${LAMBDA_TIMEOUT}s"
echo ""
echo "API Gateway:"
echo "  API ID:         $API_GATEWAY_ID"
echo "  Endpoint:       $API_GATEWAY_URL/$API_STAGE"
echo ""
echo "Test Commands:"
echo "  curl ${API_GATEWAY_URL}/${API_STAGE}/health"
echo "  curl -X POST ${API_GATEWAY_URL}/${API_STAGE}/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\":\"admin\",\"password\":\"socDemo2025!\"}'"
echo ""
echo "================================================================================"

# Save deployment info
cat > "$SCRIPT_DIR/lambda-deployment.env" <<EOF
export LAMBDA_ARN="$LAMBDA_ARN"
export API_GATEWAY_ID="$API_GATEWAY_ID"
export API_GATEWAY_URL="$API_GATEWAY_URL"
export API_ENDPOINT="${API_GATEWAY_URL}/${API_STAGE}"
EOF

log_info "Deployment info saved to lambda-deployment.env"
