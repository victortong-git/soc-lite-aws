# Monitoring Services

Infrastructure scripts for AWS monitoring services (CloudWatch, EventBridge, SNS).

## Directory Structure

```
monitoring/
├── cloudwatch/          # CloudWatch Logs
│   ├── setup-logs.sh
│   └── README.md
├── eventbridge/         # EventBridge Rules
│   ├── create-rules.sh
│   └── README.md
├── sns/                 # SNS Topics
│   ├── setup-topics.sh
│   └── README.md
└── README.md
```

## Quick Start

### Setup CloudWatch Logs
```bash
cd cloudwatch
./setup-logs.sh --log-group /aws/lambda/my-function --retention 30
```

### Create EventBridge Rule
```bash
cd eventbridge
./create-rules.sh \
  --rule-name daily-monitoring \
  --rule-type schedule \
  --schedule 'rate(1 day)' \
  --target-arn arn:aws:lambda:...
```

### Setup SNS Topic
```bash
cd sns
./setup-topics.sh \
  --topic-name alerts \
  --display-name 'Critical Alerts' \
  --email admin@example.com
```

## Available Scripts

### CloudWatch
- **setup-logs.sh** - Create log groups with retention policies

### EventBridge
- **create-rules.sh** - Create scheduled or event-pattern rules

### SNS
- **setup-topics.sh** - Create SNS topics with email subscriptions

## Documentation
- [CloudWatch Documentation](cloudwatch/README.md)
- [EventBridge Documentation](eventbridge/README.md)
- [SNS Documentation](sns/README.md)
