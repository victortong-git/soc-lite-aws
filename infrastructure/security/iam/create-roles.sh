#!/bin/bash

# Create IAM Roles for AWS Services
# Creates execution roles for Lambda, EC2, or other AWS services

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../config/config.sh"

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --role-name NAME        IAM role name (required)"
    echo "  --service-type TYPE     Service type: lambda|ec2|ecs|rds (required)"
    echo "  --policies POLICIES     Comma-separated AWS managed policy ARNs (optional)"
    echo "  --description DESC      Role description (optional)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Common Managed Policies:"
    echo "  Lambda:"
    echo "    - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    echo "    - arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
    echo "    - arn:aws:iam::aws:policy/AmazonBedrockFullAccess"
    echo "  EC2:"
    echo "    - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
    echo "    - arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
    echo ""
    echo "Examples:"
    echo "  $0 --role-name my-lambda-role --service-type lambda --policies 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'"
    echo "  $0 --role-name my-ec2-role --service-type ec2 --description 'EC2 instance role'"
    exit 1
}

# Parse arguments
ROLE_NAME=""
SERVICE_TYPE=""
POLICIES=""
DESCRIPTION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --role-name)
            ROLE_NAME="$2"
            shift 2
            ;;
        --service-type)
            SERVICE_TYPE="$2"
            shift 2
            ;;
        --policies)
            POLICIES="$2"
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
if [ -z "$ROLE_NAME" ] || [ -z "$SERVICE_TYPE" ]; then
    log_error "Role name and service type are required"
    usage
fi

# Validate service type
case "$SERVICE_TYPE" in
    lambda)
        SERVICE_PRINCIPAL="lambda.amazonaws.com"
        DEFAULT_DESCRIPTION="Lambda execution role"
        ;;
    ec2)
        SERVICE_PRINCIPAL="ec2.amazonaws.com"
        DEFAULT_DESCRIPTION="EC2 instance role"
        ;;
    ecs)
        SERVICE_PRINCIPAL="ecs-tasks.amazonaws.com"
        DEFAULT_DESCRIPTION="ECS task execution role"
        ;;
    rds)
        SERVICE_PRINCIPAL="rds.amazonaws.com"
        DEFAULT_DESCRIPTION="RDS service role"
        ;;
    *)
        log_error "Invalid service type: $SERVICE_TYPE (must be lambda, ec2, ecs, or rds)"
        usage
        ;;
esac

# Use default description if not provided
if [ -z "$DESCRIPTION" ]; then
    DESCRIPTION="$DEFAULT_DESCRIPTION"
fi

echo "Creating IAM Role"
echo "================="
echo ""
validate_aws_cli

# Check if role already exists
log_info "Checking if role $ROLE_NAME exists..."
if aws iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
    log_warn "Role $ROLE_NAME already exists"
    ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
    echo "  Role ARN: $ROLE_ARN"
    echo ""
    exit 0
fi

# Create trust policy document
TRUST_POLICY=$(cat <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "$SERVICE_PRINCIPAL"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF
)

# Create IAM role
log_step "Creating IAM role..."

ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "$DESCRIPTION" \
    --query 'Role.Arn' \
    --output text)

log_info "Role created: $ROLE_ARN ✓"
echo ""

# Attach managed policies
if [ -n "$POLICIES" ]; then
    log_step "Attaching managed policies..."

    IFS=',' read -ra POLICY_ARRAY <<< "$POLICIES"
    for policy_arn in "${POLICY_ARRAY[@]}"; do
        # Trim whitespace
        policy_arn=$(echo "$policy_arn" | xargs)

        log_info "Attaching policy: $policy_arn"
        aws iam attach-role-policy \
            --role-name "$ROLE_NAME" \
            --policy-arn "$policy_arn"

        if [ $? -eq 0 ]; then
            log_info "Policy attached ✓"
        else
            log_error "Failed to attach policy: $policy_arn"
        fi
    done
    echo ""
fi

# Add basic permissions based on service type
log_step "Adding service-specific permissions..."

case "$SERVICE_TYPE" in
    lambda)
        # Attach basic Lambda execution policy if not already attached
        if [ -z "$POLICIES" ] || [[ ! "$POLICIES" =~ "AWSLambdaBasicExecutionRole" ]]; then
            aws iam attach-role-policy \
                --role-name "$ROLE_NAME" \
                --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
            log_info "Added AWSLambdaBasicExecutionRole ✓"
        fi
        ;;

    ec2)
        # Create instance profile for EC2
        log_info "Creating instance profile..."
        aws iam create-instance-profile \
            --instance-profile-name "$ROLE_NAME-profile" 2>/dev/null

        aws iam add-role-to-instance-profile \
            --instance-profile-name "$ROLE_NAME-profile" \
            --role-name "$ROLE_NAME" 2>/dev/null

        log_info "Instance profile created ✓"
        ;;
esac

echo ""

# Wait for role to be available
log_info "Waiting for role to be available..."
sleep 5
log_info "Role is ready ✓"
echo ""

# Display role details
log_step "Role Details"
ROLE_INFO=$(aws iam get-role --role-name "$ROLE_NAME")

echo "  Role Name:     $ROLE_NAME"
echo "  Role ARN:      $ROLE_ARN"
echo "  Service:       $SERVICE_TYPE ($SERVICE_PRINCIPAL)"
echo "  Description:   $DESCRIPTION"
echo "  Created:       $(echo "$ROLE_INFO" | jq -r '.Role.CreateDate')"
echo ""

# List attached policies
log_info "Attached Policies:"
ATTACHED_POLICIES=$(aws iam list-attached-role-policies \
    --role-name "$ROLE_NAME" \
    --query 'AttachedPolicies[*].[PolicyName,PolicyArn]' \
    --output text)

if [ -n "$ATTACHED_POLICIES" ]; then
    echo "$ATTACHED_POLICIES" | while read -r policy_name policy_arn; do
        echo "  - $policy_name"
        echo "    $policy_arn"
    done
else
    echo "  (none)"
fi

echo ""

log_info "IAM role created successfully! ✓"
echo ""

if [ "$SERVICE_TYPE" = "ec2" ]; then
    echo "Instance Profile: $ROLE_NAME-profile"
    echo "Use this when launching EC2 instances."
    echo ""
fi
