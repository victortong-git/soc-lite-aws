import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { randomUUID } from 'crypto';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const SECOPS_AGENT_ARN = process.env.SECOPS_AGENT_ARN || 'arn:aws:bedrock-agentcore:us-east-1:581425340084:runtime/secops_agent-5htKASCV4N';
// Legacy environment variables (deprecated - now using unified SecOps Agent)
const SECURITY_AGENT_ARN = process.env.SECURITY_AGENT_ARN || '';
const TRIAGE_AGENT_ARN = process.env.TRIAGE_AGENT_ARN || '';
// Bulk Analysis Agent for Smart AI Analysis
const BULK_ANALYSIS_AGENT_ARN = process.env.BULK_ANALYSIS_AGENT_ARN || '';

// Initialize Bedrock AgentCore client with extended timeout for cold starts
const agentCoreClient = new BedrockAgentCoreClient({
  region: AWS_REGION,
  requestHandler: new NodeHttpHandler({
    requestTimeout: 180000, // 3 minutes total request timeout (agents can take time with AI processing)
    socketTimeout: 180000, // 3 minutes socket timeout for reading data
    connectionTimeout: 15000, // 15 seconds for connection establishment
  }),
});

export interface SecurityAnalysisResult {
  severity_rating: number;
  security_analysis: string;
  follow_up_suggestion: string;
  analyzed_at: string;
  analyzed_by: string;
  model_used?: string;
}

export interface TriageResult {
  action_taken: string;
  status_update: string;
  email_sent: boolean;
  email_details?: any;
}

export interface AgentInvocationResult {
  status: 'success' | 'error';
  analysis?: SecurityAnalysisResult;
  triage?: TriageResult;
  message?: string;
}

/**
 * Retry configuration for AgentCore invocations
 * Multiple retries with longer delays to handle runtime cold starts
 * Note: AgentCore may return 424 even when agent is processing successfully
 */
const RETRY_CONFIG = {
  maxRetries: 4,
  delays: [0, 60000, 90000, 120000], // 0s, 1min, 1.5min, 2min - allows runtime to fully initialize
};

/**
 * Sleep helper for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Invoke Security Analysis Agent with retry logic
 */
export async function invokeSecurityAgent(eventData: any): Promise<SecurityAnalysisResult> {
  if (!SECURITY_AGENT_ARN) {
    throw new Error('SECURITY_AGENT_ARN not configured');
  }

  // Format payload to match agent expectations
  const payload = JSON.stringify({ event: eventData });
  const payloadBuffer = Buffer.from(payload);

  console.log(`Invoking Security Agent with payload: ${payload.substring(0, 200)}...`);

  // Retry loop for handling cold starts
  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Add delay before retry (except first attempt)
      if (attempt > 0) {
        const delay = RETRY_CONFIG.delays[attempt] || RETRY_CONFIG.delays[RETRY_CONFIG.delays.length - 1];
        console.log(`Retrying security agent invocation (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}) after ${delay}ms delay...`);
        await sleep(delay);
      }

      const command = new InvokeAgentRuntimeCommand({
        agentRuntimeArn: SECURITY_AGENT_ARN,
        runtimeSessionId: `session-${randomUUID()}`,
        payload: payloadBuffer,
      });

      const response = await agentCoreClient.send(command);

      // Parse the response
      let responseData = '';
      if (response.response) {
        // The response is a blob - read it
        const blob = response.response as any;

        if (blob.transformToString) {
          responseData = await blob.transformToString();
        } else if (blob.transformToByteArray) {
          const bytes = await blob.transformToByteArray();
          const decoder = new TextDecoder('utf-8');
          responseData = decoder.decode(bytes);
        } else if (Buffer.isBuffer(blob)) {
          responseData = blob.toString('utf-8');
        } else {
          responseData = JSON.stringify(blob);
        }
      }

      if (!responseData) {
        throw new Error('Empty response from security agent');
      }

      // Parse JSON response
      const result = JSON.parse(responseData);

      // Check for error in response
      if (result.status === 'error') {
        throw new Error(result.message || 'Security agent returned error');
      }

      // Check if analysis has an error field (from JSON parsing failure)
      if (result.analysis && result.analysis.error) {
        throw new Error(`Security agent parsing error: ${result.analysis.error}`);
      }

      // Validate that we have an analysis with required fields
      if (!result.analysis || !result.analysis.severity_rating) {
        throw new Error('Invalid response from security agent: missing analysis data');
      }

      // Success! Return the analysis
      console.log(`Security agent invocation successful on attempt ${attempt + 1}`);
      return result.analysis;

    } catch (error: any) {
      const errorName = error.name || '';
      const errorMessage = error.message || '';

      // Check if this is a retryable error (cold start/runtime startup)
      const isRetryable = errorName === 'RuntimeClientError' ||
                          errorMessage.includes('starting the runtime') ||
                          errorMessage.includes('RuntimeClientError');

      console.error(`Error invoking Security Agent (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}):`, error);

      // If it's the last attempt or not a retryable error, throw
      if (attempt === RETRY_CONFIG.maxRetries - 1 || !isRetryable) {
        console.error('All retry attempts exhausted or non-retryable error');
        throw new Error(`Failed to invoke security agent: ${errorMessage}`);
      }

      // Otherwise, continue to next retry iteration
      console.log(`Retryable error detected, will retry...`);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new Error('Failed to invoke security agent after all retries');
}

/**
 * Invoke Triage Agent with retry logic
 */
export async function invokeTriageAgent(
  eventData: any,
  analysis: SecurityAnalysisResult
): Promise<TriageResult> {
  if (!TRIAGE_AGENT_ARN) {
    throw new Error('TRIAGE_AGENT_ARN not configured');
  }

  // Format payload to match agent expectations
  const payload = JSON.stringify({
    event: eventData,
    analysis: analysis,
  });
  const payloadBuffer = Buffer.from(payload);

  console.log(`Invoking Triage Agent with payload: ${payload.substring(0, 200)}...`);

  // Retry loop for handling cold starts
  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Add delay before retry (except first attempt)
      if (attempt > 0) {
        const delay = RETRY_CONFIG.delays[attempt] || RETRY_CONFIG.delays[RETRY_CONFIG.delays.length - 1];
        console.log(`Retrying triage agent invocation (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}) after ${delay}ms delay...`);
        await sleep(delay);
      }

      const command = new InvokeAgentRuntimeCommand({
        agentRuntimeArn: TRIAGE_AGENT_ARN,
        runtimeSessionId: `session-${randomUUID()}`,
        payload: payloadBuffer,
      });

      const response = await agentCoreClient.send(command);

      // Parse the response
      let responseData = '';
      if (response.response) {
        // The response is a blob - read it
        const blob = response.response as any;

        if (blob.transformToString) {
          responseData = await blob.transformToString();
        } else if (blob.transformToByteArray) {
          const bytes = await blob.transformToByteArray();
          const decoder = new TextDecoder('utf-8');
          responseData = decoder.decode(bytes);
        } else if (Buffer.isBuffer(blob)) {
          responseData = blob.toString('utf-8');
        } else {
          responseData = JSON.stringify(blob);
        }
      }

      if (!responseData) {
        throw new Error('Empty response from triage agent');
      }

      // Parse JSON response
      const result = JSON.parse(responseData);

      if (result.status === 'error') {
        throw new Error(result.message || 'Triage agent returned error');
      }

      // Success! Return the triage result
      console.log(`Triage agent invocation successful on attempt ${attempt + 1}`);
      return result.triage;

    } catch (error: any) {
      const errorName = error.name || '';
      const errorMessage = error.message || '';

      // Check if this is a retryable error (cold start/runtime startup)
      const isRetryable = errorName === 'RuntimeClientError' ||
                          errorMessage.includes('starting the runtime') ||
                          errorMessage.includes('RuntimeClientError');

      console.error(`Error invoking Triage Agent (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}):`, error);

      // If it's the last attempt or not a retryable error, throw
      if (attempt === RETRY_CONFIG.maxRetries - 1 || !isRetryable) {
        console.error('All retry attempts exhausted or non-retryable error');
        throw new Error(`Failed to invoke triage agent: ${errorMessage}`);
      }

      // Otherwise, continue to next retry iteration
      console.log(`Retryable error detected, will retry...`);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new Error('Failed to invoke triage agent after all retries');
}

/**
 * Invoke Unified SecOps Agent (new architecture)
 * This agent contains 3 logical agents orchestrated by Strands SDK
 */
export async function invokeSecOpsAgent(action: string, eventData: any): Promise<any> {
  if (!SECOPS_AGENT_ARN) {
    throw new Error('SECOPS_AGENT_ARN not configured');
  }

  // Format payload for unified agent
  // Strands conversational interface expects a "prompt" field
  // We embed our structured data as a JSON string in the prompt
  const structuredPayload = {
    action: action, // "analyze", "monitor", or "triage_only"
    event: eventData
  };

  const payload = JSON.stringify({
    prompt: JSON.stringify(structuredPayload)
  });
  const payloadBuffer = Buffer.from(payload);

  console.log(`Invoking SecOps Agent (action: ${action}) with event ${eventData.id}...`);

  // Retry loop for handling cold starts
  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Add delay before retry (except first attempt)
      if (attempt > 0) {
        const delay = RETRY_CONFIG.delays[attempt] || RETRY_CONFIG.delays[RETRY_CONFIG.delays.length - 1];
        console.log(`Retrying SecOps agent invocation (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}) after ${delay}ms delay...`);
        await sleep(delay);
      }

      const command = new InvokeAgentRuntimeCommand({
        agentRuntimeArn: SECOPS_AGENT_ARN,
        runtimeSessionId: `session-${randomUUID()}`,
        payload: payloadBuffer,
      });

      const response = await agentCoreClient.send(command);

      // Parse the response
      let responseData = '';
      if (response.response) {
        const blob = response.response as any;

        if (blob.transformToString) {
          responseData = await blob.transformToString();
        } else if (blob.transformToByteArray) {
          const bytes = await blob.transformToByteArray();
          const decoder = new TextDecoder('utf-8');
          responseData = decoder.decode(bytes);
        } else if (Buffer.isBuffer(blob)) {
          responseData = blob.toString('utf-8');
        } else {
          responseData = JSON.stringify(blob);
        }
      }

      if (!responseData) {
        throw new Error('Empty response from SecOps agent');
      }

      // Parse JSON response
      let result = JSON.parse(responseData);

      // BedrockAgentCoreApp wraps responses in a "result" key
      // The result may contain conversational response with embedded JSON
      if (result.result && typeof result.result === 'object') {
        // Check if it's a conversational response (has role and content)
        if (result.result.role === 'assistant' && result.result.content) {
          // Extract text from conversational response
          const textContent = result.result.content[0]?.text || '';
          console.log('Parsing JSON from conversational response...');

          // Try to extract JSON from the text
          try {
            // Remove markdown code blocks if present
            let jsonText = textContent;
            if (jsonText.includes('```json')) {
              jsonText = jsonText.split('```json')[1].split('```')[0].trim();
            } else if (jsonText.includes('```')) {
              jsonText = jsonText.split('```')[1].split('```')[0].trim();
            }

            // Find JSON object in the text
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              result = JSON.parse(jsonMatch[0]);
              console.log('Successfully extracted JSON from conversational response');
            } else {
              throw new Error('No JSON found in conversational response');
            }
          } catch (parseError: any) {
            console.error('Failed to parse JSON from conversational response:', parseError);
            throw new Error(`Agent returned conversational response but JSON parsing failed: ${parseError.message}`);
          }
        } else if (result.result.response) {
          // V2 format: {"result": {"response": "{...json...}"}}
          try {
            const responseText = result.result.response;
            // Remove markdown if present
            let jsonText = responseText;
            if (jsonText.includes('```json')) {
              jsonText = jsonText.split('```json')[1].split('```')[0].trim();
            } else if (jsonText.includes('```')) {
              jsonText = jsonText.split('```')[1].split('```')[0].trim();
            }

            // Parse the JSON
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              result = JSON.parse(jsonMatch[0]);
              console.log('Successfully parsed JSON from response field');
            } else {
              result = JSON.parse(responseText);
            }
          } catch (parseError: any) {
            console.error('Failed to parse JSON from response field:', parseError);
            throw new Error(`Agent response parsing failed: ${parseError.message}`);
          }
        } else {
          // Direct result object (non-conversational)
          result = result.result;
        }
      }

      // Check for error in response
      if (result.status === 'error') {
        throw new Error(result.message || 'SecOps agent returned error');
      }

      // Success! Return the result
      console.log(`SecOps agent invocation successful on attempt ${attempt + 1}`);
      return result;

    } catch (error: any) {
      const errorName = error.name || '';
      const errorMessage = error.message || '';

      // Check if this is a retryable error (cold start/runtime startup)
      const isRetryable = errorName === 'RuntimeClientError' ||
                          errorMessage.includes('starting the runtime') ||
                          errorMessage.includes('RuntimeClientError');

      console.error(`Error invoking SecOps Agent (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}):`, error);

      // If it's the last attempt or not a retryable error, throw
      if (attempt === RETRY_CONFIG.maxRetries - 1 || !isRetryable) {
        console.error('All retry attempts exhausted or non-retryable error');
        throw new Error(`Failed to invoke SecOps agent: ${errorMessage}`);
      }

      // Otherwise, continue to next retry iteration
      console.log(`Retryable error detected, will retry...`);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new Error('Failed to invoke SecOps agent after all retries');
}

/**
 * Orchestrate full analysis: Security Agent + Triage Agent
 * NEW: Uses unified SecOps Agent with internal Strands orchestration
 */
export async function analyzeEvent(eventData: any): Promise<AgentInvocationResult> {
  try {
    // Use unified SecOps Agent with "analyze" action
    // This internally runs: Security Agent -> Triage Agent -> Backend Actions
    console.log(`Analyzing event ${eventData.id} with unified SecOps Agent...`);
    const result = await invokeSecOpsAgent('analyze', eventData);

    // Extract analysis and triage from unified response
    const analysis = result.analysis || {};
    const triage = result.triage || {};

    // Handle backend actions if provided
    if (result.backend_actions) {
      console.log('Backend actions returned:', JSON.stringify(result.backend_actions));
      // TODO: Execute backend actions (update_analysis, send_notification)
      // For now, we'll let the existing workflow handle database updates
    }

    return {
      status: 'success',
      analysis: {
        severity_rating: analysis.severity_rating,
        security_analysis: analysis.security_analysis,
        follow_up_suggestion: analysis.follow_up_suggestion,
        analyzed_at: new Date().toISOString(),
        analyzed_by: 'secops-agent',
      },
      triage: {
        action_taken: triage.action_taken,
        status_update: triage.status_update,
        email_sent: triage.notification_required || false,
        email_details: result.backend_actions?.send_notification || null,
      },
    };
  } catch (error: any) {
    console.error('Error in analyzeEvent with SecOps agent:', error);

    // Fallback to legacy agents if unified agent fails
    if (SECURITY_AGENT_ARN && TRIAGE_AGENT_ARN) {
      console.log('Falling back to legacy separate agents...');
      try {
        const analysis = await invokeSecurityAgent(eventData);
        const triage = await invokeTriageAgent(eventData, analysis);
        return {
          status: 'success',
          analysis,
          triage,
        };
      } catch (fallbackError: any) {
        console.error('Legacy agent fallback also failed:', fallbackError);
      }
    }

    return {
      status: 'error',
      message: error.message,
    };
  }
}

/**
 * Bulk Analysis Result from agent
 */
export interface BulkAnalysisResult {
  severity_rating: number;
  security_analysis: string;
  recommended_actions: string;
  attack_type?: string;
}

/**
 * Invoke Bulk Analysis Agent for Smart AI Analysis
 * Accepts formatted payload with summary + key event fields (no raw data)
 */
export async function invokeBulkAnalysisAgent(payload: any): Promise<BulkAnalysisResult> {
  if (!BULK_ANALYSIS_AGENT_ARN) {
    throw new Error('BULK_ANALYSIS_AGENT_ARN not configured');
  }

  // Format payload for bulk analysis agent
  const agentPayload = JSON.stringify({ payload });
  const payloadBuffer = Buffer.from(agentPayload);

  console.log(`Invoking Bulk Analysis Agent for IP ${payload.summary?.source_ip} with ${payload.events?.length} events...`);

  // Retry loop for handling cold starts
  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Add delay before retry (except first attempt)
      if (attempt > 0) {
        const delay = RETRY_CONFIG.delays[attempt] || RETRY_CONFIG.delays[RETRY_CONFIG.delays.length - 1];
        console.log(`Retrying bulk analysis agent invocation (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}) after ${delay}ms delay...`);
        await sleep(delay);
      }

      const command = new InvokeAgentRuntimeCommand({
        agentRuntimeArn: BULK_ANALYSIS_AGENT_ARN,
        runtimeSessionId: `session-${randomUUID()}`,
        payload: payloadBuffer,
      });

      const response = await agentCoreClient.send(command);

      // Parse the response
      let responseData = '';
      if (response.response) {
        const blob = response.response as any;

        if (blob.transformToString) {
          responseData = await blob.transformToString();
        } else if (blob.transformToByteArray) {
          const bytes = await blob.transformToByteArray();
          const decoder = new TextDecoder('utf-8');
          responseData = decoder.decode(bytes);
        } else if (Buffer.isBuffer(blob)) {
          responseData = blob.toString('utf-8');
        } else {
          responseData = JSON.stringify(blob);
        }
      }

      if (!responseData) {
        throw new Error('Empty response from bulk analysis agent');
      }

      // Parse JSON response
      let result = JSON.parse(responseData);

      // Handle nested result structure (similar to SecOps agent)
      if (result.result && typeof result.result === 'object') {
        if (result.result.role === 'assistant' && result.result.content) {
          // Extract JSON from conversational response
          const textContent = result.result.content[0]?.text || '';
          let jsonText = textContent;
          if (jsonText.includes('```json')) {
            jsonText = jsonText.split('```json')[1].split('```')[0].trim();
          } else if (jsonText.includes('```')) {
            jsonText = jsonText.split('```')[1].split('```')[0].trim();
          }
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
          }
        } else if (result.result.analysis) {
          result = result.result.analysis;
        } else {
          result = result.result;
        }
      }

      // Check for error in response
      if (result.status === 'error' || result.error) {
        throw new Error(result.message || result.error || 'Bulk analysis agent returned error');
      }

      // Validate required fields
      if (!result.severity_rating || !result.security_analysis || !result.recommended_actions) {
        throw new Error('Invalid response from bulk analysis agent: missing required fields');
      }

      // Success! Return the analysis
      console.log(`Bulk analysis agent invocation successful on attempt ${attempt + 1}, severity: ${result.severity_rating}`);
      return {
        severity_rating: result.severity_rating,
        security_analysis: result.security_analysis,
        recommended_actions: result.recommended_actions,
        attack_type: result.attack_type
      };

    } catch (error: any) {
      const errorName = error.name || '';
      const errorMessage = error.message || '';

      // Check if this is a retryable error
      const isRetryable = errorName === 'RuntimeClientError' ||
                          errorMessage.includes('starting the runtime') ||
                          errorMessage.includes('RuntimeClientError');

      console.error(`Error invoking Bulk Analysis Agent (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}):`, error);

      // If it's the last attempt or not a retryable error, throw
      if (attempt === RETRY_CONFIG.maxRetries - 1 || !isRetryable) {
        console.error('All retry attempts exhausted or non-retryable error');
        throw new Error(`Failed to invoke bulk analysis agent: ${errorMessage}`);
      }

      // Otherwise, continue to next retry iteration
      console.log(`Retryable error detected, will retry...`);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new Error('Failed to invoke bulk analysis agent after all retries');
}

/**
 * Monitoring Result Interface
 */
export interface MonitoringResult {
  status: 'success' | 'error';
  workflow: 'monitor';
  campaigns_detected?: any[];
  backend_actions_completed?: {
    total_events_updated: number;
    escalations_created: number;
    escalation_ids: number[];
  };
  message?: string;
}

/**
 * Invoke SecOps Agent for Daily Monitoring
 * Detects repeated attack patterns and creates campaign escalations
 */
export async function invokeSecOpsMonitoring(hours: number = 24): Promise<MonitoringResult> {
  if (!SECOPS_AGENT_ARN) {
    throw new Error('SECOPS_AGENT_ARN not configured');
  }

  // Format payload for monitoring workflow
  const structuredPayload = {
    action: 'monitor',
    hours: hours
  };

  const payload = JSON.stringify({
    prompt: JSON.stringify(structuredPayload)
  });
  const payloadBuffer = Buffer.from(payload);

  console.log(`Invoking SecOps Agent for monitoring (last ${hours} hours)...`);

  // Retry loop for handling cold starts
  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Add delay before retry (except first attempt)
      if (attempt > 0) {
        const delay = RETRY_CONFIG.delays[attempt] || RETRY_CONFIG.delays[RETRY_CONFIG.delays.length - 1];
        console.log(`Retrying SecOps monitoring invocation (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}) after ${delay}ms delay...`);
        await sleep(delay);
      }

      const command = new InvokeAgentRuntimeCommand({
        agentRuntimeArn: SECOPS_AGENT_ARN,
        runtimeSessionId: `session-${randomUUID()}`,
        payload: payloadBuffer,
      });

      const response = await agentCoreClient.send(command);

      // Parse the response
      let responseData = '';
      if (response.response) {
        const blob = response.response as any;

        if (blob.transformToString) {
          responseData = await blob.transformToString();
        } else if (blob.transformToByteArray) {
          const bytes = await blob.transformToByteArray();
          const decoder = new TextDecoder('utf-8');
          responseData = decoder.decode(bytes);
        } else if (Buffer.isBuffer(blob)) {
          responseData = blob.toString('utf-8');
        } else {
          responseData = JSON.stringify(blob);
        }
      }

      if (!responseData) {
        throw new Error('Empty response from SecOps monitoring agent');
      }

      // Parse JSON response
      let result = JSON.parse(responseData);

      // Handle BedrockAgentCoreApp response wrapper
      if (result.result && typeof result.result === 'object') {
        if (result.result.role === 'assistant' && result.result.content) {
          // Extract JSON from conversational response
          const textContent = result.result.content[0]?.text || '';
          console.log('Parsing JSON from conversational monitoring response...');

          try {
            let jsonText = textContent;
            if (jsonText.includes('```json')) {
              jsonText = jsonText.split('```json')[1].split('```')[0].trim();
            } else if (jsonText.includes('```')) {
              jsonText = jsonText.split('```')[1].split('```')[0].trim();
            }

            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              result = JSON.parse(jsonMatch[0]);
              console.log('Successfully extracted JSON from monitoring response');
            } else {
              throw new Error('No JSON found in monitoring response');
            }
          } catch (parseError: any) {
            console.error('Failed to parse JSON from monitoring response:', parseError);
            throw new Error(`Monitoring agent returned conversational response but JSON parsing failed: ${parseError.message}`);
          }
        } else if (result.result.response) {
          // V2 format: {"result": {"response": "{...json...}"}}
          try {
            const responseText = result.result.response;
            let jsonText = responseText;
            if (jsonText.includes('```json')) {
              jsonText = jsonText.split('```json')[1].split('```')[0].trim();
            } else if (jsonText.includes('```')) {
              jsonText = jsonText.split('```')[1].split('```')[0].trim();
            }

            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              result = JSON.parse(jsonMatch[0]);
              console.log('Successfully parsed JSON from monitoring response field');
            } else {
              result = JSON.parse(responseText);
            }
          } catch (parseError: any) {
            console.error('Failed to parse JSON from monitoring response field:', parseError);
            throw new Error(`Monitoring agent response parsing failed: ${parseError.message}`);
          }
        } else {
          // Direct result object
          result = result.result;
        }
      }

      // Check for error in response
      if (result.status === 'error') {
        throw new Error(result.message || 'SecOps monitoring agent returned error');
      }

      // Success! Return the monitoring result
      console.log(`SecOps monitoring invocation successful on attempt ${attempt + 1}`);
      console.log(`Campaigns detected: ${result.campaigns_detected?.length || 0}`);
      if (result.backend_actions_completed) {
        console.log(`Events updated: ${result.backend_actions_completed.total_events_updated}`);
        console.log(`Escalations created: ${result.backend_actions_completed.escalations_created}`);
      }

      return result as MonitoringResult;

    } catch (error: any) {
      const errorName = error.name || '';
      const errorMessage = error.message || '';

      // Check if this is a retryable error
      const isRetryable = errorName === 'RuntimeClientError' ||
                          errorMessage.includes('starting the runtime') ||
                          errorMessage.includes('RuntimeClientError');

      console.error(`Error invoking SecOps monitoring (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}):`, error);

      // If it's the last attempt or not a retryable error, throw
      if (attempt === RETRY_CONFIG.maxRetries - 1 || !isRetryable) {
        console.error('All retry attempts exhausted or non-retryable error');
        throw new Error(`Failed to invoke SecOps monitoring: ${errorMessage}`);
      }

      // Otherwise, continue to next retry iteration
      console.log(`Retryable error detected, will retry...`);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new Error('Failed to invoke SecOps monitoring after all retries');
}
