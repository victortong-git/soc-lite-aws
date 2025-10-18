import { Request, Response } from 'express';
import { EscalationEvent } from '../models/EscalationEvent';
import { EventTimelineModel } from '../models/EventTimeline';

/**
 * Get all escalation events with filtering and pagination
 * GET /api/escalations
 */
export async function getAllEscalations(req: Request, res: Response): Promise<void> {
  try {
    const {
      page,
      limit,
      source_type,
      severity,
      completed_sns,
      completed_incident,
      date_from,
      date_to,
      sortBy,
      sortOrder
    } = req.query;

    const params = {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      source_type: source_type as 'waf_event' | 'smart_task' | undefined,
      severity: severity ? parseInt(severity as string) : undefined,
      completed_sns: completed_sns === 'true' ? true : completed_sns === 'false' ? false : undefined,
      completed_incident: completed_incident === 'true' ? true : completed_incident === 'false' ? false : undefined,
      date_from: date_from as string | undefined,
      date_to: date_to as string | undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined
    };

    const result = await EscalationEvent.findAll(params);

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error fetching escalations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get single escalation event by ID
 * GET /api/escalations/:id
 */
export async function getEscalationById(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid escalation ID'
      });
      return;
    }

    const escalation = await EscalationEvent.findById(id);

    if (!escalation) {
      res.status(404).json({
        success: false,
        error: 'Escalation not found'
      });
      return;
    }

    res.json({
      success: true,
      escalation
    });
  } catch (error: any) {
    console.error('Error fetching escalation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get escalations by WAF event ID
 * GET /api/escalations/by-waf-event/:wafEventId
 */
export async function getEscalationsByWafEvent(req: Request, res: Response): Promise<void> {
  try {
    const wafEventId = parseInt(req.params.wafEventId);

    if (isNaN(wafEventId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid WAF event ID'
      });
      return;
    }

    const escalations = await EscalationEvent.findByWafEventId(wafEventId);

    res.json({
      success: true,
      escalations,
      count: escalations.length
    });
  } catch (error: any) {
    console.error('Error fetching escalations by WAF event:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get escalations by smart task ID
 * GET /api/escalations/by-smart-task/:smartTaskId
 */
export async function getEscalationsBySmartTask(req: Request, res: Response): Promise<void> {
  try {
    const smartTaskId = parseInt(req.params.smartTaskId);

    if (isNaN(smartTaskId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid smart task ID'
      });
      return;
    }

    const escalations = await EscalationEvent.findBySmartTaskId(smartTaskId);

    res.json({
      success: true,
      escalations,
      count: escalations.length
    });
  } catch (error: any) {
    console.error('Error fetching escalations by smart task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Create new escalation event
 * POST /api/escalations
 */
export async function createEscalation(req: Request, res: Response): Promise<void> {
  try {
    const {
      title,
      message,
      detail_payload,
      severity,
      source_type,
      source_waf_event_id,
      source_smart_task_id
    } = req.body;

    // Validate required fields
    if (!title || !message || !severity || !source_type) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: title, message, severity, source_type'
      });
      return;
    }

    // Validate source_type
    if (source_type !== 'waf_event' && source_type !== 'smart_task') {
      res.status(400).json({
        success: false,
        error: 'Invalid source_type. Must be "waf_event" or "smart_task"'
      });
      return;
    }

    // Validate severity
    if (severity < 0 || severity > 5) {
      res.status(400).json({
        success: false,
        error: 'Severity must be between 0 and 5'
      });
      return;
    }

    // Validate source ID is provided
    if (source_type === 'waf_event' && !source_waf_event_id) {
      res.status(400).json({
        success: false,
        error: 'source_waf_event_id is required when source_type is "waf_event"'
      });
      return;
    }

    if (source_type === 'smart_task' && !source_smart_task_id) {
      res.status(400).json({
        success: false,
        error: 'source_smart_task_id is required when source_type is "smart_task"'
      });
      return;
    }

    const escalation = await EscalationEvent.create({
      title,
      message,
      detail_payload,
      severity,
      source_type,
      source_waf_event_id,
      source_smart_task_id
    });

    // Create timeline entry for the source WAF event if applicable
    if (source_type === 'waf_event' && source_waf_event_id) {
      try {
        const severityLabel = severity === 5 ? 'Critical' : severity === 4 ? 'High' : 'Medium';
        await EventTimelineModel.createSystemEntry(
          source_waf_event_id,
          'escalation_created',
          'Escalation Created',
          `${severityLabel} severity escalation #${escalation.id} created: ${title}`,
          {
            escalation_id: escalation.id,
            severity: severity,
            source: 'api'
          }
        );
      } catch (timelineError) {
        console.error('Failed to create timeline entry for escalation:', timelineError);
        // Don't fail the request if timeline creation fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Escalation created successfully',
      escalation
    });
  } catch (error: any) {
    console.error('Error creating escalation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update escalation event
 * PUT /api/escalations/:id
 */
export async function updateEscalation(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid escalation ID'
      });
      return;
    }

    const updates = req.body;

    const escalation = await EscalationEvent.update(id, updates);

    if (!escalation) {
      res.status(404).json({
        success: false,
        error: 'Escalation not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Escalation updated successfully',
      escalation
    });
  } catch (error: any) {
    console.error('Error updating escalation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Delete escalation event
 * DELETE /api/escalations/:id
 */
export async function deleteEscalation(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid escalation ID'
      });
      return;
    }

    const deleted = await EscalationEvent.delete(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Escalation not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Escalation deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting escalation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get escalation statistics
 * GET /api/escalations/stats
 */
export async function getEscalationStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await EscalationEvent.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Error fetching escalation stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Mark SNS as complete (manual completion)
 * POST /api/escalations/:id/mark-sns-complete
 */
export async function markSNSComplete(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const { message_id } = req.body;

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid escalation ID'
      });
      return;
    }

    if (!message_id) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: message_id'
      });
      return;
    }

    const escalation = await EscalationEvent.markSNSComplete(id, message_id);

    if (!escalation) {
      res.status(404).json({
        success: false,
        error: 'Escalation not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'SNS marked as complete',
      escalation
    });
  } catch (error: any) {
    console.error('Error marking SNS as complete:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Retry failed SNS (resend notification)
 * POST /api/escalations/:id/retry-sns
 */
export async function retrySNS(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid escalation ID'
      });
      return;
    }

    const escalation = await EscalationEvent.findById(id);

    if (!escalation) {
      res.status(404).json({
        success: false,
        error: 'Escalation not found'
      });
      return;
    }

    // Reset SNS status to allow retry
    const updated = await EscalationEvent.update(id, {
      completed_sns: false,
      sns_error: undefined
    });

    res.json({
      success: true,
      message: 'Escalation queued for retry. SNS will be sent within 5 minutes.',
      escalation: updated
    });
  } catch (error: any) {
    console.error('Error retrying SNS:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Create campaign escalation (one escalation for multiple events)
 * Used by monitoring agent to prevent massive escalation creation
 * POST /api/escalations/campaign
 */
export async function createCampaignEscalation(req: Request, res: Response): Promise<void> {
  try {
    const {
      title,
      message,
      detail_payload,
      severity,
      source_waf_event_id
    } = req.body;

    // Validate required fields
    if (!title || !message || !severity) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: title, message, severity'
      });
      return;
    }

    // Validate severity
    if (severity < 0 || severity > 5) {
      res.status(400).json({
        success: false,
        error: 'Severity must be between 0 and 5'
      });
      return;
    }

    // Validate detail_payload contains affected_event_ids
    if (!detail_payload || !Array.isArray(detail_payload.affected_event_ids)) {
      res.status(400).json({
        success: false,
        error: 'detail_payload must contain affected_event_ids array'
      });
      return;
    }

    console.log(`Creating campaign escalation for ${detail_payload.affected_event_ids.length} events...`);

    const escalation = await EscalationEvent.create({
      title,
      message,
      detail_payload,
      severity,
      source_type: 'attack_campaign',
      source_waf_event_id: source_waf_event_id || null,
      source_smart_task_id: null
    });

    // Create timeline entries for all affected events
    const affectedEventIds = detail_payload.affected_event_ids;
    if (Array.isArray(affectedEventIds) && affectedEventIds.length > 0) {
      try {
        const severityLabel = severity === 5 ? 'Critical' : severity === 4 ? 'High' : 'Medium';
        const timelineDescription = `${severityLabel} severity campaign escalation #${escalation.id} created: ${title}`;
        
        // Create timeline entries for each affected event
        const timelinePromises = affectedEventIds.map(eventId =>
          EventTimelineModel.createSystemEntry(
            eventId,
            'escalation_created',
            'Campaign Escalation Created',
            timelineDescription,
            {
              escalation_id: escalation.id,
              severity: severity,
              campaign_event_count: affectedEventIds.length,
              source: 'campaign'
            }
          )
        );

        await Promise.all(timelinePromises);
        console.log(`Created timeline entries for ${affectedEventIds.length} events`);
      } catch (timelineError) {
        console.error('Failed to create timeline entries for campaign escalation:', timelineError);
        // Don't fail the request if timeline creation fails
      }
    }

    res.status(201).json({
      success: true,
      message: `Campaign escalation created for ${detail_payload.affected_event_ids.length} events`,
      escalation
    });
  } catch (error: any) {
    console.error('Error creating campaign escalation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
