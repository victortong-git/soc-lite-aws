#!/bin/bash

# Setup API Gateway for Lambda Function
# Creates HTTP API Gateway and connects it to a Lambda function

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --api-name NAME         API Gateway name (required)"
    echo "  --function-name NAME    Lambda function name (required)"
    echo "  --stage STAGE           API stage (default: prod)"
    echo "  --cors-origin ORIGIN    CORS allowed origin (default: *)"
    echo "  --description DESC      API description (optional)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --api-name soc-lite-api --function-name soc-lite-backend"
    echo "  $0 --api-name my-api --function-name my-lambda --stage dev --cors-origin https://example.com"
    exit 1
}

# Parse arguments
API_NAME=""
FUNCTION_NAME=""
STAGE="prod"
CORS_ORIGIN="*"
DESCRIPTION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --api-name)
            API_NAME="$2"
            shift 2
            ;;
        --function-name)
            FUNCTION_NAME="$2"
            shift 2
            ;;
        --stage)
            STAGE="$2"
            shift 2
            ;;
        --cors-origin)
            CORS_ORIGIN="$2"
            shift 2
            ;;
        --description)
            DESCRIPTION="$2"
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
if [ -z "$API_NAME" ] || [ -z "$FUNCTION_NAME" ]; then
    log_error "API name and function name are required"
    usage
fi

echo "Setting up API Gateway"
echo "====================="
echo ""
validate_aws_cli

# Check if Lambda function exists
log_info "Checking if Lambda function $FUNCTION_NAME exists..."
if ! aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
    log_error "Lambda function $FUNCTION_NAME does not exist"
    exit 1
fi

LAMBDA_ARN=$(aws lambda get-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --query 'Configuration.FunctionArn' \
    --output text)

log_info "Lambda ARN: $LAMBDA_ARN"
echo ""

# Create or get API Gateway
log_step "Creating API Gateway..."

API_ID=$(aws apigatewayv2 get-apis \
    --query "Items[?Name=='$API_NAME'].ApiId" \
    --output text \
    --region "$REGION")

if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
    log_info "Creating new API Gateway: $API_NAME"

    CREATE_ARGS=(
        --name "$API_NAME"
        --protocol-type HTTP
        --region "$REGION"
    )

    if [ -n "$DESCRIPTION" ]; then
        CREATE_ARGS+=(--description "$DESCRIPTION")
    fi

    # Add CORS configuration
    CREATE_ARGS+=(--cors-configuration "AllowOrigins=$CORS_ORIGIN,AllowMethods=GET,POST,PUT,DELETE,OPTIONS,AllowHeaders=Content-Type,Authorization,AllowCredentials=true")

    API_ID=$(aws apigatewayv2 create-api \
        "${CREATE_ARGS[@]}" \
        --query 'ApiId' \
        --output text)

    log_info "API Gateway created: $API_ID ✓"
else
    log_info "API Gateway already exists: $API_ID"
fi

echo ""

# Create integration
log_step "Creating Lambda integration..."

INTEGRATION_ID=$(aws apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$LAMBDA_ARN" \
    --payload-format-version 2.0 \
    --region "$REGION" \
    --query 'IntegrationId' \
    --output text 2>/dev/null || \
    aws apigatewayv2 get-integrations \
    --api-id "$API_ID" \
    --region "$REGION" \
    --query 'Items[0].IntegrationId' \
    --output text)

log_info "Integration ID: $INTEGRATION_ID ✓"
echo ""

# Create routes
log_step "Creating API routes..."

# Create catch-all route
aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key 'ANY /{proxy+}' \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" 2>/dev/null || log_info "Proxy route already exists"

# Create root route
aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key 'ANY /' \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" 2>/dev/null || log_info "Root route already exists"

log_info "Routes created ✓"
echo ""

# Create stage
log_step "Creating API stage..."

aws apigatewayv2 create-stage \
    --api-id "$API_ID" \
    --stage-name "$STAGE" \
    --auto-deploy \
    --region "$REGION" 2>/dev/null || log_info "Stage $STAGE already exists"

log_info "Stage created: $STAGE ✓"
echo ""

# Add Lambda permission for API Gateway
log_step "Adding Lambda invoke permission..."

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id "apigateway-invoke-$(date +%s)" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" \
    --region "$REGION" 2>/dev/null || log_info "Permission already exists"

log_info "Permission added ✓"
echo ""

# Get API endpoint
API_ENDPOINT=$(aws apigatewayv2 get-api \
    --api-id "$API_ID" \
    --region "$REGION" \
    --query 'ApiEndpoint' \
    --output text)

echo "API Gateway Setup Complete! ✓"
echo "============================"
echo ""
echo "API Details:"
echo "  Name:        $API_NAME"
echo "  API ID:      $API_ID"
echo "  Endpoint:    $API_ENDPOINT/$STAGE"
echo "  Stage:       $STAGE"
echo "  CORS Origin: $CORS_ORIGIN"
echo ""
echo "Lambda Integration:"
echo "  Function:    $FUNCTION_NAME"
echo "  ARN:         $LAMBDA_ARN"
echo ""
echo "Test your API:"
echo "  curl $API_ENDPOINT/$STAGE/health"
echo "  curl -X GET $API_ENDPOINT/$STAGE/api/events"
echo ""
echo "Next steps:"
echo "  1. Update frontend .env with: VITE_API_URL=$API_ENDPOINT/$STAGE/api"
echo "  2. Configure custom domain (optional)"
echo "  3. Add WAF protection to API Gateway"
echo ""
