#!/usr/bin/env python3
"""
Bulk Analysis Agent - Analyzes grouped WAF events by source IP
Provides comprehensive security assessment for multiple related events
"""
import json
from bedrock_agentcore import BedrockAgentCoreApp
from strands import Agent

# Create the AgentCore application
app = BedrockAgentCoreApp()

# Create a Strands agent with Nova Micro model
agent = Agent(model="amazon.nova-micro-v1:0")


def extract_json_from_response(result_message):
    """
    Extract and parse JSON from Nova Lite's response

    Args:
        result_message: The message dict from Strands agent result

    Returns:
        dict: Parsed JSON analysis or error dict
    """
    try:
        # Extract text content from message structure
        if isinstance(result_message, dict) and 'content' in result_message:
            text = result_message['content'][0]['text']
        else:
            text = str(result_message)

        # Remove markdown code blocks if present
        if '```json' in text:
            text = text.split('```json')[1].split('```')[0].strip()
        elif '```' in text:
            text = text.split('```')[1].split('```')[0].strip()

        # Parse JSON
        analysis = json.loads(text)

        # Validate required fields (rating_reason is optional for backward compatibility)
        required_fields = ['severity_rating', 'security_analysis', 'recommended_actions']
        for field in required_fields:
            if field not in analysis:
                return {"error": f"Missing required field: {field}", "raw_response": text[:200]}

        # Validate severity rating
        severity = analysis['severity_rating']
        if not isinstance(severity, int) or severity < 0 or severity > 5:
            return {"error": f"Invalid severity rating: {severity}", "raw_response": text[:200]}

        return analysis

    except Exception as e:
        return {"error": f"JSON parsing failed: {str(e)}", "raw_response": str(result_message)[:200]}


@app.entrypoint
def invoke(payload):
    """
    Main entrypoint for the Bulk Analysis Agent.

    Args:
        payload: Input payload containing:
            - summary: Aggregated statistics (IP, country, event count, time range, unique URIs/rules, breakdowns)
            - events: Array of key event information (timestamp, action, rule, uri, method, user_agent, host)

    Returns:
        dict: Response with bulk security analysis
    """
    # Extract summary and events
    summary = payload.get('summary', {})
    events = payload.get('events', [])

    # Build bulk analysis prompt
    unique_uri_count = len(summary.get('unique_uris', []))
    prompt = f"""You are a cybersecurity expert analyzing a group of WAF (Web Application Firewall) events from the same source IP.

**AGGREGATED SUMMARY:**
- Source IP: {summary.get('source_ip', 'N/A')}
- Country: {summary.get('country', 'Unknown')}
- Total Events: {summary.get('total_events', 0)}
- Time Range: {summary.get('time_range', {}).get('first', 'N/A')} to {summary.get('time_range', {}).get('last', 'N/A')} ({summary.get('time_range', {}).get('duration_minutes', 0)} minutes)
- **UNIQUE URIs ACCESSED: {unique_uri_count}** (IMPORTANT: This IP accessed {unique_uri_count} DIFFERENT URIs)
  All URIs: {', '.join(summary.get('unique_uris', []))}
- Rules Triggered: {len(summary.get('unique_rules', []))}
  Rules: {', '.join(summary.get('unique_rules', [])[:5])}
- Action Breakdown: {json.dumps(summary.get('action_breakdown', {}))}
- HTTP Method Breakdown: {json.dumps(summary.get('method_breakdown', {}))}

**REPRESENTATIVE EVENTS** (showing first 10 of {len(events)}):
"""

    # Add sample events for context (first 10)
    for i, event in enumerate(events[:10], 1):
        prompt += f"\n{i}. [{event.get('timestamp', 'N/A')}] {event.get('action', 'N/A')} - {event.get('rule_name', 'N/A')} - {event.get('http_method', 'N/A')} {event.get('uri', 'N/A')}"

    if len(events) > 10:
        prompt += f"\n... and {len(events) - 10} more events with similar patterns"

    prompt += """

**INSTRUCTIONS:**
Analyze these grouped events as a whole to identify:
1. Is this a coordinated attack pattern or normal traffic?
2. What type of attack or activity is this (if malicious)?
3. What is the overall threat level for this IP?
4. What actions should be taken?

Please respond in JSON format with:
1. severity_rating: An integer from 0-5 (0=safe, 1=info, 2=low, 3=medium, 4=high, 5=critical)
2. attack_type: Type of attack or activity (e.g., "SQL Injection Attempt", "Directory Scanning", "Benign Access", "Bot Activity", "Brute Force")
3. rating_reason: Brief explanation of why this specific severity rating was chosen (1 sentence)
4. security_analysis: Detailed explanation of what you observed across all events (2-3 sentences)
5. recommended_actions: Specific actions to take (e.g., "Block IP", "Monitor closely", "No action needed")

**ANALYSIS GUIDELINES:**
- Consider frequency: Many events in short time = higher severity
- Look for patterns: Same URIs, rules, methods indicate purposeful activity

**CRITICAL: Directory Scanning Severity Rules:**
- CHECK THE "UNIQUE URIs ACCESSED" NUMBER ABOVE
- If UNIQUE URIs >= 10 with WordPress/admin/system paths → YOU MUST rate severity 4 or 5
- Directory scanning is ALWAYS high severity whether BLOCKED or ALLOWED
- ALLOWED scanning is MORE dangerous (successful reconnaissance)
- Example: 16 different WordPress URIs = severity 4 or 5 (NOT severity 3)

**Other Attack Severities:**
- SQL injection, XSS patterns = severity 4-5
- Brute force attacks (repeated login attempts, credential stuffing) = severity 4-5
- Remote Code Execution (RCE) attempts = severity 5
- API abuse (excessive requests, rate limit violations) = severity 3-4
- Single blocked request = lower severity than repeated attempts

Example format:
{{
  "severity_rating": 4,
  "attack_type": "SQL Injection Attempt",
  "rating_reason": "47 automated SQL injection attempts in 12 minutes indicates active attack campaign. so, the rating is 4.",
  "security_analysis": "This IP made 47 attempts to inject SQL commands into the login form over 12 minutes. All requests were blocked by rule 'SQLi-BODY'. Pattern indicates automated scanning tool.",
  "recommended_actions": "Block this IP at firewall level and monitor for similar activity from other IPs in the same subnet."
}}"""

    # Process through Strands agent (calls Nova Lite)
    result = agent(prompt)

    # Parse the JSON analysis from the response
    analysis = extract_json_from_response(result.message)

    # Return parsed analysis
    return analysis


if __name__ == "__main__":
    # Run the agent locally for testing
    app.run()
