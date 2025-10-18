# Compute Services

Infrastructure scripts for AWS compute services (Lambda, API Gateway).

## Directory Structure

```
compute/
├── lambda/              # Lambda function management
│   ├── deploy-lambda.sh
│   ├── update-lambda.sh
│   └── README.md
├── api-gateway/         # API Gateway management
│   ├── setup-api-gateway.sh
│   └── README.md
└── README.md
```

## Quick Start

### Deploy Lambda Function

```bash
cd lambda
./deploy-lambda.sh
```

### Setup API Gateway

```bash
cd api-gateway
./setup-api-gateway.sh --api-name my-api --function-name my-lambda
```

### Update Lambda Function

```bash
cd lambda
./update-lambda.sh --function-name my-function --code-path /path/to/package.zip
```

## Available Scripts

### Lambda
- **deploy-lambda.sh** - Deploy backend Lambda + API Gateway (uses centralized config)
- **update-lambda.sh** - Update individual Lambda function code or configuration

### API Gateway
- **setup-api-gateway.sh** - Create HTTP API Gateway and connect to Lambda

## Configuration

All scripts use the centralized configuration from `../config/config.sh`.

## Documentation

- [Lambda Documentation](lambda/README.md)
- [API Gateway Documentation](api-gateway/README.md)
