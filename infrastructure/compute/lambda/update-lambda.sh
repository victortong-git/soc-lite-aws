#!/bin/bash

# Update Individual Lambda Function
# Updates code for a specific Lambda function without redeploying API Gateway

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --function-name NAME    Lambda function name (required)"
    echo "  --code-path PATH        Path to deployment package (optional)"
    echo "  --handler HANDLER       Handler function (optional)"
    echo "  --runtime RUNTIME       Runtime version (optional)"
    echo "  --memory SIZE           Memory size in MB (optional)"
    echo "  --timeout SECONDS       Timeout in seconds (optional)"
    echo "  --env KEY=VALUE         Environment variable (can be repeated)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --function-name soc-lite-backend --code-path /path/to/package.zip"
    echo "  $0 --function-name analysis-worker --memory 1024 --timeout 300"
    echo "  $0 --function-name get-waf-alert --env LOG_LEVEL=debug"
    exit 1
}

# Parse arguments
FUNCTION_NAME=""
CODE_PATH=""
HANDLER=""
RUNTIME=""
MEMORY=""
TIMEOUT=""
ENV_VARS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --function-name)
            FUNCTION_NAME="$2"
            shift 2
            ;;
        --code-path)
            CODE_PATH="$2"
            shift 2
            ;;
        --handler)
            HANDLER="$2"
            shift 2
            ;;
        --runtime)
            RUNTIME="$2"
            shift 2
            ;;
        --memory)
            MEMORY="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --env)
            ENV_VARS+=("$2")
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
if [ -z "$FUNCTION_NAME" ]; then
    log_error "Function name is required"
    usage
fi

echo "Updating Lambda Function"
echo "======================="
echo ""
validate_aws_cli

# Check if function exists
log_info "Checking if function $FUNCTION_NAME exists..."
if ! aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
    log_error "Lambda function $FUNCTION_NAME does not exist"
    exit 1
fi

log_info "Function found: $FUNCTION_NAME"
echo ""

# Update function code
if [ -n "$CODE_PATH" ]; then
    log_step "Updating function code..."

    if [ ! -f "$CODE_PATH" ]; then
        log_error "Code package not found: $CODE_PATH"
        exit 1
    fi

    PACKAGE_SIZE=$(du -h "$CODE_PATH" | cut -f1)
    log_info "Package size: $PACKAGE_SIZE"

    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file "fileb://$CODE_PATH" \
        --region "$REGION" > /dev/null

    log_info "Function code updated ✓"

    # Wait for update to complete
    log_info "Waiting for update to complete..."
    aws lambda wait function-updated \
        --function-name "$FUNCTION_NAME" \
        --region "$REGION"

    log_info "Update complete ✓"
    echo ""
fi

# Update function configuration
UPDATE_CONFIG=false
UPDATE_ARGS=(
    --function-name "$FUNCTION_NAME"
    --region "$REGION"
)

if [ -n "$HANDLER" ]; then
    UPDATE_ARGS+=(--handler "$HANDLER")
    UPDATE_CONFIG=true
fi

if [ -n "$RUNTIME" ]; then
    UPDATE_ARGS+=(--runtime "$RUNTIME")
    UPDATE_CONFIG=true
fi

if [ -n "$MEMORY" ]; then
    UPDATE_ARGS+=(--memory-size "$MEMORY")
    UPDATE_CONFIG=true
fi

if [ -n "$TIMEOUT" ]; then
    UPDATE_ARGS+=(--timeout "$TIMEOUT")
    UPDATE_CONFIG=true
fi

if [ ${#ENV_VARS[@]} -gt 0 ]; then
    # Get current environment variables
    CURRENT_ENV=$(aws lambda get-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --region "$REGION" \
        --query 'Environment.Variables' \
        --output json)

    # Merge with new environment variables
    ENV_JSON="$CURRENT_ENV"
    for env_var in "${ENV_VARS[@]}"; do
        KEY="${env_var%%=*}"
        VALUE="${env_var#*=}"
        ENV_JSON=$(echo "$ENV_JSON" | jq --arg k "$KEY" --arg v "$VALUE" '.[$k] = $v')
    done

    UPDATE_ARGS+=(--environment "Variables=$ENV_JSON")
    UPDATE_CONFIG=true
fi

if [ "$UPDATE_CONFIG" = true ]; then
    log_step "Updating function configuration..."

    aws lambda update-function-configuration \
        "${UPDATE_ARGS[@]}" > /dev/null

    log_info "Configuration updated ✓"

    # Wait for update to complete
    log_info "Waiting for configuration update..."
    aws lambda wait function-updated \
        --function-name "$FUNCTION_NAME" \
        --region "$REGION"

    log_info "Update complete ✓"
    echo ""
fi

# Display updated function details
log_step "Function Details"
FUNCTION_INFO=$(aws lambda get-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION")

echo "  Function Name:  $FUNCTION_NAME"
echo "  Runtime:        $(echo "$FUNCTION_INFO" | jq -r '.Runtime')"
echo "  Handler:        $(echo "$FUNCTION_INFO" | jq -r '.Handler')"
echo "  Memory:         $(echo "$FUNCTION_INFO" | jq -r '.MemorySize') MB"
echo "  Timeout:        $(echo "$FUNCTION_INFO" | jq -r '.Timeout') seconds"
echo "  Last Modified:  $(echo "$FUNCTION_INFO" | jq -r '.LastModified')"
echo ""

log_info "Lambda function $FUNCTION_NAME updated successfully! ✓"
echo ""
