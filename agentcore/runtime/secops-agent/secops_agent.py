#!/usr/bin/env python3
"""
SecOps Agent - Multi-Agent Security Operations Center
Uses Strands SDK with 3 logical agents: Security Analyst, Triage, and Monitoring
"""

import json
import logging
import os
from typing import Any, Dict, List
from datetime import datetime

from bedrock_agentcore import BedrockAgentCoreApp
from strands import Agent, tool
import requests

# Initialize logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Backend API configuration
BACKEND_API_URL = os.environ.get('BACKEND_API_URL', 'https://aws1.c6web.com/api')
API_TIMEOUT = 30

# Create the AgentCore application
app = BedrockAgentCoreApp()

# ============================================================================
# TOOLS - Backend API Integration
# ============================================================================

@tool
def update_event_analysis(event_id: int, severity: int, analysis: str,
                          recommendations: str, status: str) -> str:
    """
    Update single WAF event with AI analysis results via backend API.

    Args:
        event_id: WAF event ID
        severity: Severity rating (0-5)
        analysis: Security analysis text
        recommendations: Recommended actions
        status: Event status (closed/open/investigating)

    Returns:
        Success or error message
    """
    try:
        url = f"{BACKEND_API_URL}/events/{event_id}"
        payload = {
            "severity": severity,
            "ai_analysis": analysis,
            "follow_up_suggestion": recommendations,
            "status": status,
            "analyzed_at": datetime.utcnow().isoformat(),
            "analyzed_by": "secops-agent"
        }

        logger.info(f"Updating event {event_id} via API: {url}")
        response = requests.put(url, json=payload, timeout=API_TIMEOUT)
        response.raise_for_status()

        return f"Successfully updated event {event_id}"
    except Exception as e:
        error_msg = f"Failed to update event {event_id}: {str(e)}"
        logger.error(error_msg)
        return error_msg


@tool
def bulk_update_events(event_ids: List[int], severity: int, analysis: str,
                      recommendations: str, status: str) -> str:
    """
    Bulk update multiple WAF events with same analysis (for monitoring agent).

    Args:
        event_ids: List of WAF event IDs
        severity: Severity rating (0-5)
        analysis: Security analysis text (same for all)
        recommendations: Recommended actions (same for all)
        status: Event status (closed/open/investigating)

    Returns:
        Success or error message
    """
    try:
        url = f"{BACKEND_API_URL}/events/bulk-update"
        payload = {
            "event_ids": event_ids,
            "severity": severity,
            "ai_analysis": analysis,
            "follow_up_suggestion": recommendations,
            "status": status,
            "analyzed_at": datetime.utcnow().isoformat(),
            "analyzed_by": "secops-agent-monitoring"
        }

        logger.info(f"Bulk updating {len(event_ids)} events via API: {url}")
        response = requests.post(url, json=payload, timeout=API_TIMEOUT)
        response.raise_for_status()

        return f"Successfully updated {len(event_ids)} events"
    except Exception as e:
        error_msg = f"Failed to bulk update events: {str(e)}"
        logger.error(error_msg)
        return error_msg


@tool
def create_escalation(event_id: int, severity: int, title: str,
                     message: str, detail_payload: Dict) -> str:
    """
    Create escalation record for a single high severity event.

    Args:
        event_id: WAF event ID
        severity: Severity rating (4 or 5)
        title: Escalation title
        message: Escalation message
        detail_payload: Additional details

    Returns:
        Success message with escalation ID or error
    """
    try:
        url = f"{BACKEND_API_URL}/escalations"
        payload = {
            "title": title,
            "message": message,
            "detail_payload": detail_payload,
            "severity": severity,
            "source_type": "waf_event",
            "source_waf_event_id": event_id
        }

        logger.info(f"Creating escalation for event {event_id} via API: {url}")
        response = requests.post(url, json=payload, timeout=API_TIMEOUT)
        response.raise_for_status()

        result = response.json()
        escalation_id = result.get('escalation', {}).get('id')

        return f"Successfully created escalation {escalation_id} for event {event_id}"
    except Exception as e:
        error_msg = f"Failed to create escalation for event {event_id}: {str(e)}"
        logger.error(error_msg)
        return error_msg


@tool
def create_campaign_escalation(title: str, message: str, severity: int,
                               affected_event_ids: List[int], detail_payload: Dict) -> str:
    """
    Create ONE escalation record for an entire attack campaign (multiple events).
    This prevents massive escalation creation for repeated attacks.

    Args:
        title: Campaign escalation title
        message: Escalation message describing the campaign
        severity: Severity rating (4 or 5)
        affected_event_ids: List of all event IDs in this campaign
        detail_payload: Campaign details (event_count, attack_type, etc.)

    Returns:
        Success message with escalation ID or error
    """
    try:
        url = f"{BACKEND_API_URL}/escalations/campaign"

        # Add affected event IDs to detail payload
        detail_payload['affected_event_ids'] = affected_event_ids
        detail_payload['event_count'] = len(affected_event_ids)

        payload = {
            "title": title,
            "message": message,
            "detail_payload": detail_payload,
            "severity": severity,
            "source_type": "attack_campaign",
            "source_waf_event_id": affected_event_ids[0] if affected_event_ids else None  # Link to first event
        }

        logger.info(f"Creating campaign escalation for {len(affected_event_ids)} events via API: {url}")
        response = requests.post(url, json=payload, timeout=API_TIMEOUT)
        response.raise_for_status()

        result = response.json()
        escalation_id = result.get('escalation', {}).get('id')

        return f"Successfully created campaign escalation {escalation_id} for {len(affected_event_ids)} events"
    except Exception as e:
        error_msg = f"Failed to create campaign escalation: {str(e)}"
        logger.error(error_msg)
        return error_msg


@tool
def get_open_events(hours: int = 24) -> str:
    """
    Fetch all open WAF events for monitoring analysis.

    Args:
        hours: Number of hours to look back

    Returns:
        JSON string of open events or error message
    """
    try:
        url = f"{BACKEND_API_URL}/events"
        params = {
            "status": "open",
            "hours": hours,
            "limit": 500  # Get up to 500 open events
        }

        logger.info(f"Fetching open events from last {hours} hours via API: {url}")
        response = requests.get(url, params=params, timeout=API_TIMEOUT)
        response.raise_for_status()

        result = response.json()
        events = result.get('events', [])

        logger.info(f"Retrieved {len(events)} open events")
        return json.dumps(events)
    except Exception as e:
        error_msg = f"Failed to fetch open events: {str(e)}"
        logger.error(error_msg)
        return json.dumps({"error": error_msg})


# ============================================================================
# LOGICAL AGENTS
# ============================================================================

# Security Analyst Agent - AI-powered threat analysis
security_agent = Agent(model="amazon.nova-micro-v1:0")

# Monitoring Agent - AI-powered pattern detection for repeated attacks
monitoring_agent = Agent(
    model="amazon.nova-micro-v1:0",
    tools=[get_open_events, bulk_update_events, create_campaign_escalation]
)

# ============================================================================
# TRIAGE LOGIC (CODE-BASED, NOT AI)
# ============================================================================

def triage_decision(severity_rating: int) -> Dict[str, Any]:
    """
    Code-based triage logic for routing events based on severity.
    This is NOT AI-generated - it's deterministic business logic.

    Args:
        severity_rating: Severity from 0-5

    Returns:
        Dictionary with action_taken, status_update, and escalate flag
    """
    if severity_rating <= 2:
        return {
            "action_taken": "auto_close",
            "status_update": "closed",
            "escalate": False,
            "notification_required": False
        }
    elif severity_rating == 3:
        return {
            "action_taken": "monitor",
            "status_update": "open",
            "escalate": False,
            "notification_required": False
        }
    else:  # severity_rating in [4, 5]
        return {
            "action_taken": "escalate",
            "status_update": "investigating",
            "escalate": True,
            "notification_required": True,
            "notification_type": "critical"
        }


# ============================================================================
# ENTRYPOINT - Main Orchestration Logic
# ============================================================================

@app.entrypoint
def invoke(payload: Dict, context: Any = None) -> Dict:
    """
    Main entrypoint for AgentCore SecOps Agent.
    Supports two workflows: analyze (individual) and monitor (bulk patterns).
    """
    logger.info("SecOps Agent invoked")
    logger.info(f"Payload: {json.dumps(payload, default=str)[:500]}...")

    try:
        # Handle wrapped payload from Lambda (prompt field contains JSON string)
        if 'prompt' in payload and isinstance(payload['prompt'], str):
            try:
                payload = json.loads(payload['prompt'])
                logger.info(f"Unwrapped payload from prompt field: {payload}")
            except json.JSONDecodeError:
                logger.warning("Failed to parse prompt as JSON, using as-is")

        # Extract action from payload
        action = payload.get('action', 'analyze')

        if action == 'analyze':
            return handle_analyze_workflow(payload)
        elif action == 'monitor':
            return handle_monitor_workflow(payload)
        else:
            return {
                "status": "error",
                "message": f"Unsupported action: {action}"
            }

    except Exception as e:
        logger.error(f"Error in invoke: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": str(e)
        }


def handle_analyze_workflow(payload: Dict) -> Dict:
    """
    Workflow A: Individual Event Analysis
    Security Agent → Triage Agent → Backend Actions
    """
    logger.info("Starting analyze workflow (individual event)")

    event = payload.get('event', {})
    if not event:
        return {"status": "error", "message": "No event data provided"}

    event_id = event.get('id')

    try:
        # Step 1: Security Agent analyzes event
        logger.info(f"Security Agent analyzing event {event_id}...")

        analysis_prompt = f"""You are a cybersecurity analyst. Analyze this WAF event and provide:
1. severity_rating (0-5 integer)
2. security_analysis (detailed threat analysis)
3. recommended_actions (actionable recommendations)
4. attack_type (classification)

Severity scale:
- 0: Not an issue
- 1: Informational
- 2: Low severity
- 3: Medium severity (requires monitoring)
- 4: High severity (requires escalation)
- 5: Critical incident (requires immediate escalation)

Event Data:
{json.dumps(event, indent=2)}

Return ONLY valid JSON with this structure:
{{
  "severity_rating": <0-5>,
  "security_analysis": "<analysis>",
  "recommended_actions": "<actions>",
  "attack_type": "<type>"
}}"""

        security_result = security_agent(analysis_prompt)
        response_text = security_result.message['content'][0]['text']

        # Parse JSON from response
        analysis = parse_json_response(response_text)

        if not analysis or 'severity_rating' not in analysis:
            raise ValueError("Security agent returned invalid analysis")

        logger.info(f"Security analysis complete: severity={analysis['severity_rating']}")

        # Step 2: Triage Agent (code-based decision)
        severity = analysis['severity_rating']
        triage = triage_decision(severity)

        logger.info(f"Triage decision: {triage['action_taken']}")

        # Step 3: Execute backend actions via tools
        backend_actions = {}

        # Update event analysis
        update_result = update_event_analysis(
            event_id=event_id,
            severity=severity,
            analysis=analysis.get('security_analysis', ''),
            recommendations=analysis.get('recommended_actions', ''),
            status=triage['status_update']
        )
        backend_actions['analysis_updated'] = 'Successfully' in update_result

        # Create escalation if needed
        if triage['escalate']:
            escalation_result = create_escalation(
                event_id=event_id,
                severity=severity,
                title=f"{analysis.get('attack_type', 'Security Incident')} - Event {event_id}",
                message=f"Event {event_id}: {analysis.get('security_analysis', '')}",
                detail_payload=event
            )
            backend_actions['escalation_created'] = 'Successfully' in escalation_result

        # Step 4: Return structured response
        return {
            "status": "success",
            "workflow": "analyze",
            "event_id": event_id,
            "analysis": analysis,
            "triage": triage,
            "backend_actions_completed": backend_actions
        }

    except Exception as e:
        logger.error(f"Error in analyze workflow: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "workflow": "analyze",
            "message": str(e)
        }


def handle_monitor_workflow(payload: Dict) -> Dict:
    """
    Workflow B: Daily Monitoring for Repeated Attacks
    Monitoring Agent → Pattern Detection → Bulk Actions
    """
    logger.info("Starting monitor workflow (pattern detection)")

    hours = payload.get('hours', 24)

    try:
        # Step 1: Get open events
        logger.info(f"Fetching open events from last {hours} hours...")
        events_json = get_open_events(hours)
        events_data = json.loads(events_json)

        if 'error' in events_data:
            return {"status": "error", "message": events_data['error']}

        events = events_data if isinstance(events_data, list) else events_data.get('events', [])

        if not events:
            logger.info("No open events found")
            return {
                "status": "success",
                "workflow": "monitor",
                "message": "No open events to analyze",
                "campaigns_detected": 0
            }

        logger.info(f"Found {len(events)} open events to analyze")

        # Step 2: Monitoring Agent analyzes patterns
        logger.info("Monitoring Agent analyzing patterns...")

        monitoring_prompt = f"""You are a security monitoring specialist. Analyze these open WAF events to detect attack campaigns.

Your task:
1. Group events by attack patterns (same IP, same attack type, similar timeframe)
2. Identify coordinated attacks
3. For each campaign, provide:
   - campaign_id (unique identifier like "sqli_192.168.1.100")
   - attack_type (e.g., "SQL Injection", "XSS", "DDoS")
   - affected_event_ids (list of event IDs in this campaign)
   - severity_rating (4 or 5 for repeated attacks)
   - security_analysis (describe the campaign)
   - recommended_actions (actionable steps)

IMPORTANT: Only create campaigns for genuine repeated attacks. If events are unrelated, return empty campaigns list.

Events ({len(events)} total):
{json.dumps(events, indent=2)}

Return ONLY valid JSON:
{{
  "campaigns": [
    {{
      "campaign_id": "<unique_id>",
      "attack_type": "<type>",
      "affected_event_ids": [101, 102, 103],
      "severity_rating": <4 or 5>,
      "security_analysis": "<analysis>",
      "recommended_actions": "<actions>"
    }}
  ]
}}"""

        monitoring_result = monitoring_agent(monitoring_prompt)
        response_text = monitoring_result.message['content'][0]['text']

        # Parse JSON from response
        monitoring_data = parse_json_response(response_text)

        if not monitoring_data or 'campaigns' not in monitoring_data:
            raise ValueError("Monitoring agent returned invalid response")

        campaigns = monitoring_data['campaigns']
        logger.info(f"Detected {len(campaigns)} attack campaign(s)")

        # Step 3: Process each campaign (bulk actions)
        backend_actions = {
            "total_events_updated": 0,
            "escalations_created": 0,
            "escalation_ids": []
        }

        for campaign in campaigns:
            campaign_id = campaign.get('campaign_id')
            affected_event_ids = campaign.get('affected_event_ids', [])
            severity = campaign.get('severity_rating', 4)

            logger.info(f"Processing campaign {campaign_id} with {len(affected_event_ids)} events")

            # Bulk update all events in campaign
            bulk_result = bulk_update_events(
                event_ids=affected_event_ids,
                severity=severity,
                analysis=campaign.get('security_analysis', ''),
                recommendations=campaign.get('recommended_actions', ''),
                status="investigating"
            )

            if 'Successfully' in bulk_result:
                backend_actions['total_events_updated'] += len(affected_event_ids)

            # Create ONE escalation for entire campaign
            escalation_result = create_campaign_escalation(
                title=f"{campaign.get('attack_type', 'Attack')} Campaign - {len(affected_event_ids)} Events",
                message=f"Campaign {campaign_id}: {campaign.get('security_analysis', '')}",
                severity=severity,
                affected_event_ids=affected_event_ids,
                detail_payload={
                    "campaign_id": campaign_id,
                    "attack_type": campaign.get('attack_type'),
                    "event_count": len(affected_event_ids)
                }
            )

            if 'Successfully' in escalation_result:
                backend_actions['escalations_created'] += 1
                # Extract escalation ID from result message
                try:
                    esc_id = int(escalation_result.split('escalation ')[1].split(' ')[0])
                    backend_actions['escalation_ids'].append(esc_id)
                except:
                    pass

        # Step 4: Return monitoring report
        return {
            "status": "success",
            "workflow": "monitor",
            "campaigns_detected": campaigns,
            "backend_actions_completed": backend_actions
        }

    except Exception as e:
        logger.error(f"Error in monitor workflow: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "workflow": "monitor",
            "message": str(e)
        }


def parse_json_response(response_text: str) -> Dict:
    """
    Parse JSON from AI response, handling markdown code blocks and formatting.
    """
    try:
        # Remove markdown code blocks if present
        text = response_text.strip()
        if '```json' in text:
            text = text.split('```json')[1].split('```')[0].strip()
        elif '```' in text:
            text = text.split('```')[1].split('```')[0].strip()

        # Find JSON object in text
        import re
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            return json.loads(json_match.group())
        else:
            return json.loads(text)
    except Exception as e:
        logger.error(f"Failed to parse JSON response: {str(e)}")
        logger.error(f"Response text: {response_text[:500]}")
        return {}


# ============================================================================
# LOCAL TESTING
# ============================================================================

if __name__ == "__main__":
    """Run the agent locally for testing"""
    print("SecOps Agent - Multi-Agent Architecture with Strands SDK")
    print("=" * 70)

    # Test payload for analyze workflow
    test_event = {
        "id": 123,
        "timestamp": "2025-10-13T12:00:00Z",
        "action": "BLOCK",
        "source_ip": "192.168.1.100",
        "country": "US",
        "uri": "/api/users",
        "http_method": "POST",
        "rule_name": "SQLi_BODY",
        "user_agent": "BadBot/1.0"
    }

    test_payload = {
        "action": "analyze",
        "event": test_event
    }

    print("\n[TEST] Analyze Workflow")
    print("-" * 70)
    result = invoke(test_payload)
    print(json.dumps(result, indent=2, default=str))

    # Run the agent
    print("\n[INFO] Starting AgentCore app...")
    app.run()
