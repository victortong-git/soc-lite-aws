# IAM Roles

Scripts for creating IAM execution roles for AWS services.

## Scripts

### create-roles.sh
Creates IAM roles with trust policies and managed policy attachments.

**Usage:**
```bash
# Lambda role
./create-roles.sh \
  --role-name my-lambda-role \
  --service-type lambda \
  --policies 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole,arn:aws:iam::aws:policy/AmazonBedrockFullAccess'

# EC2 role (creates instance profile)
./create-roles.sh \
  --role-name my-ec2-role \
  --service-type ec2 \
  --description 'EC2 instance role'
```

## Service Types

- **lambda** - Lambda execution role (auto-adds basic execution policy)
- **ec2** - EC2 instance role (auto-creates instance profile)
- **ecs** - ECS task execution role
- **rds** - RDS service role

## Common Managed Policies

### Lambda
- `arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`
- `arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole`
- `arn:aws:iam::aws:policy/AmazonBedrockFullAccess`

### EC2
- `arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore`
- `arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy`

## Security Best Practices

- Follow principle of least privilege
- Use managed policies when possible
- Create custom policies for specific needs
- Enable CloudTrail for IAM API logging
- Regularly review and rotate credentials

## Related Documentation
- [Compute Services](../../compute/README.md)
- [Security Overview](../README.md)
