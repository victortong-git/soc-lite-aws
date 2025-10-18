import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';
import { randomUUID } from 'crypto';

// Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const SECOPS_AGENT_ARN = process.env.SECOPS_AGENT_ARN || '';
const MONITORING_HOURS = parseInt(process.env.MONITORING_HOURS || '24');

// Initialize Bedrock AgentCore client
const agentCoreClient = new BedrockAgentCoreClient({
  region: AWS_REGION,
});

/**
 * Daily Monitoring Trigger Lambda
 * Scheduled to run daily (EventBridge cron)
 * Invokes SecOps Agent monitoring workflow to detect repeated attacks
 */
export const handler = async (event) => {
  console.log('Daily Monitoring Trigger Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();

  try {
    // Validate configuration
    if (!SECOPS_AGENT_ARN) {
      throw new Error('SECOPS_AGENT_ARN environment variable not configured');
    }

    console.log(`Invoking SecOps Agent for monitoring (last ${MONITORING_HOURS} hours)...`);
    console.log(`Agent ARN: ${SECOPS_AGENT_ARN}`);

    // Prepare payload for monitoring workflow
    const structuredPayload = {
      action: 'monitor',
      hours: MONITORING_HOURS
    };

    const payload = JSON.stringify({
      prompt: JSON.stringify(structuredPayload)
    });
    const payloadBuffer = Buffer.from(payload);

    // Invoke SecOps Agent
    const command = new InvokeAgentRuntimeCommand({
      agentRuntimeArn: SECOPS_AGENT_ARN,
      runtimeSessionId: `monitoring-${randomUUID()}`,
      payload: payloadBuffer,
    });

    const response = await agentCoreClient.send(command);

    // Parse the response
    let responseData = '';
    if (response.response) {
      const blob = response.response;

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
        } catch (parseError) {
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
        } catch (parseError) {
          console.error('Failed to parse JSON from monitoring response field:', parseError);
          throw new Error(`Monitoring agent response parsing failed: ${parseError.message}`);
        }
      } else {
        // Direct result object
        result = result.result;
      }
    }

    // Log monitoring results
    const executionTime = Date.now() - startTime;
    console.log('Monitoring completed successfully');
    console.log(`Execution time: ${executionTime}ms`);
    console.log(`Campaigns detected: ${result.campaigns_detected?.length || 0}`);

    if (result.backend_actions_completed) {
      console.log(`Events updated: ${result.backend_actions_completed.total_events_updated || 0}`);
      console.log(`Escalations created: ${result.backend_actions_completed.escalations_created || 0}`);
      console.log(`Escalation IDs: ${JSON.stringify(result.backend_actions_completed.escalation_ids || [])}`);
    }

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Daily monitoring completed successfully',
        campaigns_detected: result.campaigns_detected?.length || 0,
        events_updated: result.backend_actions_completed?.total_events_updated || 0,
        escalations_created: result.backend_actions_completed?.escalations_created || 0,
        execution_time_ms: executionTime
      })
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('Fatal error in daily monitoring trigger:', error);
    console.error('Error stack:', error.stack);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        execution_time_ms: executionTime
      })
    };
  }
};
