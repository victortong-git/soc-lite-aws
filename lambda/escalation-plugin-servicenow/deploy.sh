#!/bin/bash
# Deployment script for escalation-plugin-servicenow Lambda function

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
if [ -z "$DB_PASSWORD" ] || [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$SERVICENOW_PASSWORD" ]; then
    echo "Error: Required environment variables not set in .env"
    echo "Required: DB_PASSWORD, DB_HOST, DB_USER, SERVICENOW_PASSWORD"
    exit 1
fi

# Configuration
FUNCTION_NAME="escalation-plugin-servicenow"
REGION="${AWS_REGION}"
ROLE_ARN="${LAMBDA_ROLE_ARN}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ServiceNow Escalation Plugin Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Install dependencies
echo -e "\n${GREEN}Installing dependencies...${NC}"
npm install --production

# Create deployment package
echo -e "\n${GREEN}Creating deployment package...${NC}"
zip -r function.zip index.mjs node_modules package.json

# Check if function exists
echo -e "\n${GREEN}Checking if function exists...${NC}"
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    echo -e "${GREEN}Function exists. Updating code...${NC}"
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://function.zip \
        --region $REGION

    echo -e "${GREEN}Updating configuration...${NC}"
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --runtime nodejs20.x \
        --handler index.handler \
        --timeout 300 \
        --memory-size 256 \
        --region $REGION
else
    echo -e "${GREEN}Function does not exist. Creating...${NC}"
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs20.x \
        --role $ROLE_ARN \
        --handler index.handler \
        --zip-file fileb://function.zip \
        --timeout 300 \
        --memory-size 256 \
        --region $REGION \
        --environment "Variables={DB_HOST=$DB_HOST,DB_PORT=$DB_PORT,DB_NAME=$DB_NAME,DB_USER=$DB_USER,DB_PASSWORD=$DB_PASSWORD,DB_SSL=$DB_SSL,SERVICENOW_INSTANCE_URL=$SERVICENOW_INSTANCE_URL,SERVICENOW_USERNAME=$SERVICENOW_USERNAME,SERVICENOW_PASSWORD=$SERVICENOW_PASSWORD,SERVICENOW_ASSIGNMENT_GROUP=$SERVICENOW_ASSIGNMENT_GROUP}"
fi

# Update environment variables
echo -e "\n${GREEN}Updating environment variables...${NC}"
aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --environment "Variables={DB_HOST=$DB_HOST,DB_PORT=$DB_PORT,DB_NAME=$DB_NAME,DB_USER=$DB_USER,DB_PASSWORD=$DB_PASSWORD,DB_SSL=$DB_SSL,SERVICENOW_INSTANCE_URL=$SERVICENOW_INSTANCE_URL,SERVICENOW_USERNAME=$SERVICENOW_USERNAME,SERVICENOW_PASSWORD=$SERVICENOW_PASSWORD,SERVICENOW_ASSIGNMENT_GROUP=$SERVICENOW_ASSIGNMENT_GROUP}" \
    --region $REGION

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Function: ${YELLOW}$FUNCTION_NAME${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Set up EventBridge rule to trigger this Lambda every 5 minutes:"
echo -e "   ${YELLOW}aws events put-rule --name soc-lite-servicenow-incident-processor --schedule-expression \"rate(5 minutes)\" --state ENABLED --region $REGION${NC}"
echo -e "\n2. Add Lambda as target to EventBridge rule:"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "   ${YELLOW}aws events put-targets --rule soc-lite-servicenow-incident-processor --targets \"Id\"=\"1\",\"Arn\"=\"arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME\" --region $REGION${NC}"
echo -e "\n3. Grant EventBridge permission to invoke Lambda:"
echo -e "   ${YELLOW}aws lambda add-permission --function-name $FUNCTION_NAME --statement-id EventBridgeInvoke --action 'lambda:InvokeFunction' --principal events.amazonaws.com --source-arn arn:aws:events:$REGION:$ACCOUNT_ID:rule/soc-lite-servicenow-incident-processor --region $REGION${NC}"

# Cleanup
rm function.zip

echo -e "\n${GREEN}Deployment package cleaned up.${NC}"
