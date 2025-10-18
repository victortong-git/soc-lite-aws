# Security Services

Infrastructure scripts for AWS security services (WAF, IAM).

## Directory Structure

```
security/
├── waf/                 # Web Application Firewall
│   ├── setup-waf.sh
│   ├── configure-rules.sh
│   └── README.md
├── iam/                 # Identity and Access Management
│   ├── create-roles.sh
│   └── README.md
└── README.md
```

## Quick Start

### Setup WAF
```bash
cd waf
./setup-waf.sh
```

### Configure WAF Rules
```bash
cd waf
./configure-rules.sh --web-acl-name soc-lite-waf --rule-type rate-limit --rule-name rate-limit-100 --rate-limit 100
```

### Create IAM Roles
```bash
cd iam
./create-roles.sh --role-name my-lambda-role --service-type lambda
```

## Available Scripts

### WAF
- **setup-waf.sh** - Create Web ACL with AWS managed rules
- **configure-rules.sh** - Add custom rules (rate limiting, IP blocking)

### IAM
- **create-roles.sh** - Create execution roles for AWS services

## Documentation
- [WAF Documentation](waf/README.md)
- [IAM Documentation](iam/README.md)
