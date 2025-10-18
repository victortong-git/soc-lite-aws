import { Request, Response } from 'express';
import { WafLog } from '../models/WafLog';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const SNS_TOPIC_ARN_CRITICAL = process.env.SNS_TOPIC_ARN_CRITICAL || '';
const SNS_TOPIC_ARN_MONITORING = process.env.SNS_TOPIC_ARN_MONITORING || '';

/**
 * Update event with security analysis results
 * POST /api/agent-actions/update-analysis
 */
export async function updateAnalysis(req: Request, res: Response): Promise<void> {
  const {
    event_id,
    severity_rating,
    security_analysis,
    follow_up_suggestion,
    status,
    analyzed_by
  } = req.body;

  // Validate required fields
  if (!event_id || severity_rating === undefined) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: event_id, severity_rating'
    });
    return;
  }

  try {
    // Update the event in database
    const updatedEvent = await WafLog.updateAnalysis(
      event_id,
      severity_rating,
      security_analysis || '',
      follow_up_suggestion || '',
      status || (severity_rating >= 0 && severity_rating <= 2 ? 'closed' : 'open'),
      analyzed_by || 'secops-agent'
    );

    if (!updatedEvent) {
      res.status(404).json({
        success: false,
        error: 'Event not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Analysis updated successfully',
      event: updatedEvent
    });
  } catch (error: any) {
    console.error('Error updating analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Send notification via SNS
 * POST /api/agent-actions/send-notification
 */
export async function sendNotification(req: Request, res: Response): Promise<void> {
  const {
    notification_type, // 'critical' or 'monitoring'
    subject,
    message,
    event_id
  } = req.body;

  // Validate required fields
  if (!notification_type || !subject || !message) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: notification_type, subject, message'
    });
    return;
  }

  // Determine which SNS topic to use
  const topicArn = notification_type === 'monitoring'
    ? SNS_TOPIC_ARN_MONITORING
    : SNS_TOPIC_ARN_CRITICAL;

  if (!topicArn) {
    res.status(400).json({
      success: false,
      error: `SNS topic not configured for type: ${notification_type}`
    });
    return;
  }

  try {
    // Send SNS notification
    const command = new PublishCommand({
      TopicArn: topicArn,
      Subject: subject,
      Message: message
    });
    const snsResponse = await snsClient.send(command);

    res.json({
      success: true,
      message: 'Notification sent successfully',
      message_id: snsResponse.MessageId,
      event_id
    });
  } catch (error: any) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Fetch unprocessed events for analysis
 * GET /api/agent-actions/fetch-unprocessed?limit=10
 */
export async function fetchUnprocessedEvents(req: Request, res: Response): Promise<void> {
  const limit = parseInt(req.query.limit as string) || 10;

  try {
    const events = await WafLog.findUnprocessed(limit);

    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error: any) {
    console.error('Error fetching unprocessed events:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Fetch severity 3 events for monitoring
 * GET /api/agent-actions/fetch-severity3?hours=24
 */
export async function fetchSeverity3Events(req: Request, res: Response): Promise<void> {
  const hours = parseInt(req.query.hours as string) || 24;

  try {
    const events = await WafLog.findSeverity3Events(hours);

    res.json({
      success: true,
      count: events.length,
      hours,
      events
    });
  } catch (error: any) {
    console.error('Error fetching severity 3 events:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update event status
 * POST /api/agent-actions/update-status
 */
export async function updateEventStatus(req: Request, res: Response): Promise<void> {
  const { event_id, status } = req.body;

  // Validate required fields
  if (!event_id || !status) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: event_id, status'
    });
    return;
  }

  // Validate status value
  const validStatuses = ['open', 'investigating', 'closed'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
    return;
  }

  try {
    const updatedEvent = await WafLog.updateStatus(event_id, status);

    if (!updatedEvent) {
      res.status(404).json({
        success: false,
        error: 'Event not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      event: updatedEvent
    });
  } catch (error: any) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
