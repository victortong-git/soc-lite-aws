# Bulk Analysis Agent

Analyzes grouped WAF events by source IP and provides comprehensive security assessment for bulk operations.

## Overview

The Bulk Analysis Agent is designed to analyze multiple WAF events from the same source IP as a group, identifying attack patterns, threat levels, and providing recommendations. This is more efficient and accurate than analyzing events individually.

## Features

- **Bulk Pattern Analysis**: Analyzes multiple events together to identify attack patterns
- **Attack Type Detection**: Identifies specific attack types (SQL Injection, Directory Scanning, etc.)
- **Severity Assessment**: Provides overall severity rating (0-5) for all events
- **Detailed Recommendations**: Suggests specific actions based on analysis

## Input Format

The agent expects a payload with:

```json
{
  "summary": {
    "source_ip": "192.168.1.100",
    "country": "US",
    "total_events": 47,
    "time_range": {
      "first": "2024-01-15T10:00:00Z",
      "last": "2024-01-15T10:12:00Z",
      "duration_minutes": 12
    },
    "unique_uris": ["/login", "/admin", "/wp-admin"],
    "unique_rules": ["SQLi-BODY", "XSS-HEADER"],
    "action_breakdown": {"BLOCK": 45, "ALLOW": 2},
    "method_breakdown": {"POST": 40, "GET": 7}
  },
  "events": [
    {
      "event_id": 123,
      "timestamp": "2024-01-15T10:00:00Z",
      "action": "BLOCK",
      "rule_name": "SQLi-BODY",
      "uri": "/login",
      "http_method": "POST",
      "user_agent": "Mozilla/5.0...",
      "host": "example.com"
    }
    // ... more events
  ]
}
```

## Output Format

```json
{
  "severity_rating": 4,
  "attack_type": "SQL Injection Attempt",
  "security_analysis": "This IP made 47 attempts to inject SQL commands into the login form over 12 minutes. All requests were blocked by rule 'SQLi-BODY'. Pattern indicates automated scanning tool.",
  "recommended_actions": "Block this IP at firewall level and monitor for similar activity from other IPs in the same subnet."
}
```

## Analysis Guidelines

The agent considers:

1. **Frequency**: Many events in short time = higher severity
2. **Patterns**: Same URIs, rules, methods indicate purposeful activity
3. **Actions**: BLOCK actions with many events = likely threat
4. **Context**: SQL injection, XSS, directory scanning patterns = high severity

## Severity Ratings

- **0 (Safe)**: Benign traffic, no threat detected
- **1 (Info)**: Informational, minimal concern
- **2 (Low)**: Low-priority issue, monitor
- **3 (Medium)**: Potential threat, review needed
- **4 (High)**: Active threat, immediate action needed
- **5 (Critical)**: Critical threat, urgent response required

## Attack Types Detected

- SQL Injection Attempt
- XSS (Cross-Site Scripting)
- Directory Scanning
- Brute Force Attack
- Bot Activity
- DDoS Attempt
- Benign Access
- Suspicious Activity

## Deployment

Deploy with the deploy-agents.sh script:

```bash
cd /aws/soc-lite/agents
./deploy-agents.sh
```

This will:
1. Configure the agent with AgentCore
2. Deploy to Bedrock AgentCore Runtime
3. Extract and save the agent ARN to .env

## Testing

Test the agent locally:

```bash
cd /aws/soc-lite/agents/bulk-analysis-agent

# Activate virtual environment
source ../.venv/bin/activate

# Run in test mode
python bulk_analysis_agent.py
```

Test via AgentCore:

```bash
agentcore invoke '{
  "summary": {
    "source_ip": "10.0.0.1",
    "country": "US",
    "total_events": 5,
    "time_range": {"first": "2024-01-15T10:00:00Z", "last": "2024-01-15T10:05:00Z", "duration_minutes": 5},
    "unique_uris": ["/login"],
    "unique_rules": ["SQLi-BODY"],
    "action_breakdown": {"BLOCK": 5},
    "method_breakdown": {"POST": 5}
  },
  "events": [
    {
      "event_id": 1,
      "timestamp": "2024-01-15T10:00:00Z",
      "action": "BLOCK",
      "rule_name": "SQLi-BODY",
      "uri": "/login",
      "http_method": "POST",
      "user_agent": "curl/7.68.0",
      "host": "example.com"
    }
  ]
}'
```

## Integration

This agent is invoked by:
- **Smart Analysis Worker Lambda**: `/aws/soc-lite/lambda/smart-analysis-worker/`
- **Backend Service**: `smartAnalysisService.ts` via `agentCoreService.ts`

The Lambda:
1. Fetches task and linked events from database
2. Extracts key information (NO raw data)
3. Generates aggregated summary
4. Invokes this agent via Bedrock AgentCore
5. Applies results to all linked events

## Key Information Extraction

Only these fields are sent to the agent (reduces token usage by ~80%):
- event_id
- timestamp
- action
- rule_id, rule_name
- uri
- http_method
- user_agent
- host

**NOT included**: raw_message, headers, event_detail, http_request

## Dependencies

- `bedrock-agentcore>=0.1.7`: AgentCore SDK
- `strands-agents>=1.11.0`: Strands SDK for building agents

## Model

Uses Amazon Nova Lite (`amazon.nova-lite-v1:0`) for cost-effective bulk analysis.

## Related Components

- **Lambda Worker**: `/aws/soc-lite/lambda/smart-analysis-worker/`
- **Backend Service**: `/aws/soc-lite/backend/src/services/smartAnalysisService.ts`
- **Agent Core Service**: `/aws/soc-lite/backend/src/services/agentCoreService.ts`
- **Models**: `/aws/soc-lite/backend/src/models/SmartAnalysis*.ts`

## Monitoring

View agent logs:

```bash
aws logs tail /aws/bedrock-agentcore/soc-lite-bulk-analysis-agent --follow
```

Check agent status:

```bash
agentcore status
```

## Notes

- Designed for bulk analysis (5-50 events per invocation)
- More accurate than individual event analysis for pattern detection
- Optimized prompt for Nova Lite model
- Returns structured JSON for easy parsing
- Focuses on actionable insights and recommendations
