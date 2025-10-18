import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WafLogModel, WafLogListParams } from '../models/WafLog';
import { AnalysisJobModel } from '../models/AnalysisJob';
import { EventTimelineModel } from '../models/EventTimeline';
import { randomUUID } from 'crypto';
import * as agentCoreService from '../services/agentCoreService';

export const getEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '50',
      action,
      status,
      severity,
      source_ip,
      country,
      host,
      rule_id,
      rule_name,
      uri,
      http_method,
      date_from,
      date_to,
      has_ai_analysis,
      processed,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const params: WafLogListParams = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      action: action as string,
      status: status as string,
      severity: severity as string | number,
      source_ip: source_ip as string,
      country: country as string,
      host: host as string,
      rule_id: rule_id as string,
      rule_name: rule_name as string,
      uri: uri as string,
      http_method: http_method as string,
      date_from: date_from as string,
      date_to: date_to as string,
      has_ai_analysis: has_ai_analysis === 'true' ? true : has_ai_analysis === 'false' ? false : undefined,
      processed: processed === 'true' ? true : processed === 'false' ? false : undefined,
      sortBy: sortBy as string,
      sortOrder: (sortOrder as 'asc' | 'desc')
    };

    const result = await WafLogModel.findAll(params);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit)
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

export const getEventById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      res.status(400).json({ error: 'Invalid event ID' });
      return;
    }

    const event = await WafLogModel.findById(eventId);

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json({ success: true, data: event });
  } catch (error) {
    console.error('Get event by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
};

export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const eventData = req.body;

    // Validate minimum required fields
    if (!eventData.action || !eventData.source_ip) {
      res.status(400).json({
        error: 'Missing required fields: action, source_ip'
      });
      return;
    }

    // Auto-generate timestamp if not provided
    if (!eventData.timestamp) {
      eventData.timestamp = new Date().toISOString();
    }

    // Auto-generate request_id if not provided
    if (!eventData.request_id) {
      eventData.request_id = randomUUID();
    }

    // Set default status if not provided
    if (!eventData.status) {
      eventData.status = 'open';
    }

    const newEvent = await WafLogModel.create(eventData);

    res.status(201).json({
      success: true,
      data: newEvent,
      message: 'Event created successfully'
    });
  } catch (error: any) {
    console.error('Create event error:', error);

    if (error.code === '23505') {
      res.status(409).json({ error: 'Event with this request_id already exists' });
      return;
    }

    res.status(500).json({ error: 'Failed to create event' });
  }
};

export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      res.status(400).json({ error: 'Invalid event ID' });
      return;
    }

    const updates = req.body;

    const updatedEvent = await WafLogModel.update(eventId, updates);

    if (!updatedEvent) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json({
      success: true,
      data: updatedEvent,
      message: 'Event updated successfully'
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
};

export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      res.status(400).json({ error: 'Invalid event ID' });
      return;
    }

    const deleted = await WafLogModel.delete(eventId);

    if (!deleted) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};

export const getEventStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await WafLogModel.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

export const getSeverityDistribution = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const distribution = await WafLogModel.getSeverityDistribution();

    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    console.error('Get severity distribution error:', error);
    res.status(500).json({ error: 'Failed to fetch severity distribution' });
  }
};

export const analyzeEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      res.status(400).json({ error: 'Invalid event ID' });
      return;
    }

    // Verify event exists
    const event = await WafLogModel.findById(eventId);

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    console.log(`Creating async analysis job for event ${eventId}...`);

    // Create async analysis job instead of immediate processing
    const job = await AnalysisJobModel.create(eventId);

    // Link the job to the event so frontend can show queued status
    await WafLogModel.update(eventId, { analysis_job_id: job.id });

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        eventId: job.event_id,
        status: job.status
      },
      message: 'Analysis job created and queued for processing'
    });

  } catch (error: any) {
    console.error('Analyze event error:', error);
    res.status(500).json({
      error: 'Failed to create analysis job',
      message: error.message
    });
  }
};

export const bulkDeleteEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Invalid or empty ids array' });
      return;
    }

    // Validate all IDs are numbers
    const invalidIds = ids.filter(id => typeof id !== 'number' || isNaN(id));
    if (invalidIds.length > 0) {
      res.status(400).json({ error: 'All IDs must be valid numbers' });
      return;
    }

    console.log(`Bulk deleting ${ids.length} events...`);

    // Delete all events
    const results = await WafLogModel.bulkDelete(ids);

    res.json({
      success: true,
      deleted: results.deleted,
      failed: results.failed,
      message: `Successfully deleted ${results.deleted} event(s)`
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete events' });
  }
};

export const getEventTrends = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { hours = '24' } = req.query;
    const hoursNum = parseInt(hours as string);

    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) {
      res.status(400).json({ error: 'Invalid hours parameter (must be between 1 and 168)' });
      return;
    }

    const trends = await WafLogModel.getTrends(hoursNum);

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Get event trends error:', error);
    res.status(500).json({ error: 'Failed to fetch event trends' });
  }
};

export const getTopSources = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({ error: 'Invalid limit parameter (must be between 1 and 100)' });
      return;
    }

    const topSources = await WafLogModel.getTopSources(limitNum);

    res.json({
      success: true,
      data: topSources
    });
  } catch (error) {
    console.error('Get top sources error:', error);
    res.status(500).json({ error: 'Failed to fetch top sources' });
  }
};

export const getTopURIs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({ error: 'Invalid limit parameter (must be between 1 and 100)' });
      return;
    }

    const topURIs = await WafLogModel.getTopURIs(limitNum);

    res.json({
      success: true,
      data: topURIs
    });
  } catch (error) {
    console.error('Get top URIs error:', error);
    res.status(500).json({ error: 'Failed to fetch top URIs' });
  }
};

export const getRecentEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = '5' } = req.query;
    const limitNum = parseInt(limit as string);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      res.status(400).json({ error: 'Invalid limit parameter (must be between 1 and 50)' });
      return;
    }

    const recentEvents = await WafLogModel.getRecentEvents(limitNum);

    res.json({
      success: true,
      data: recentEvents
    });
  } catch (error) {
    console.error('Get recent events error:', error);
    res.status(500).json({ error: 'Failed to fetch recent events' });
  }
};

export const getCleanupPreview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { days } = req.query;

    // Get total count
    const totalCount = await WafLogModel.countAll();

    // If days is provided, get count for old records
    let oldCount = 0;
    if (days) {
      const daysNum = parseInt(days as string);

      if (isNaN(daysNum) || daysNum < 0) {
        res.status(400).json({ error: 'Invalid days parameter' });
        return;
      }

      oldCount = await WafLogModel.countOlderThan(daysNum);
    }

    res.json({
      success: true,
      data: {
        total: totalCount,
        oldRecords: oldCount,
        days: days ? parseInt(days as string) : null
      }
    });
  } catch (error) {
    console.error('Get cleanup preview error:', error);
    res.status(500).json({ error: 'Failed to fetch cleanup preview' });
  }
};

export const cleanupAllEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('Deleting all events...');

    const result = await WafLogModel.deleteAll();

    res.json({
      success: true,
      deleted: result.deleted,
      message: `Successfully deleted all ${result.deleted} event(s)`
    });
  } catch (error) {
    console.error('Cleanup all events error:', error);
    res.status(500).json({ error: 'Failed to delete all events' });
  }
};

export const cleanupOldEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { days } = req.body;

    if (!days || isNaN(parseInt(days))) {
      res.status(400).json({ error: 'Invalid or missing days parameter' });
      return;
    }

    const daysNum = parseInt(days);

    if (daysNum < 1) {
      res.status(400).json({ error: 'Days must be greater than 0' });
      return;
    }

    console.log(`Deleting events older than ${daysNum} days...`);

    const result = await WafLogModel.deleteOlderThan(daysNum);

    res.json({
      success: true,
      deleted: result.deleted,
      message: `Successfully deleted ${result.deleted} event(s) older than ${daysNum} day(s)`
    });
  } catch (error) {
    console.error('Cleanup old events error:', error);
    res.status(500).json({ error: 'Failed to delete old events' });
  }
};

export const getAnalysisJobByEventId = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      res.status(400).json({ error: 'Invalid event ID' });
      return;
    }

    // Verify event exists
    const event = await WafLogModel.findById(eventId);

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Find analysis job for this event
    const job = await AnalysisJobModel.findByEventId(eventId);

    if (!job) {
      res.status(404).json({ error: 'No analysis job found for this event' });
      return;
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Get analysis job by event ID error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis job' });
  }
};

/**
 * Bulk update multiple WAF events with same analysis
 * Used by monitoring agent for repeated attack campaigns
 * POST /api/events/bulk-update
 */
export const bulkUpdateEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      event_ids,
      severity,
      ai_analysis,
      follow_up_suggestion,
      status,
      analyzed_at,
      analyzed_by
    } = req.body;

    // Validate required fields
    if (!Array.isArray(event_ids) || event_ids.length === 0) {
      res.status(400).json({ error: 'Invalid or empty event_ids array' });
      return;
    }

    if (severity === undefined || !ai_analysis || !follow_up_suggestion || !status) {
      res.status(400).json({
        error: 'Missing required fields: event_ids, severity, ai_analysis, follow_up_suggestion, status'
      });
      return;
    }

    // Validate all event IDs are numbers
    const invalidIds = event_ids.filter((id: any) => typeof id !== 'number' || isNaN(id));
    if (invalidIds.length > 0) {
      res.status(400).json({ error: 'All event IDs must be valid numbers' });
      return;
    }

    console.log(`Bulk updating ${event_ids.length} events with same analysis...`);

    // Update all events with same data
    const updates = {
      severity,
      ai_analysis,
      follow_up_suggestion,
      status,
      analyzed_at: analyzed_at || new Date().toISOString(),
      analyzed_by: analyzed_by || 'secops-agent-monitoring'
    };

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const eventId of event_ids) {
      try {
        const updated = await WafLogModel.update(eventId, updates);
        if (updated) {
          successCount++;
          // Add timeline entry
          await EventTimelineModel.createSystemEntry(
            eventId,
            'bulk_analysis_updated',
            'Bulk Analysis Updated',
            `Event updated via monitoring agent`,
            { severity, status, source: 'monitoring_agent' }
          );
        } else {
          failedCount++;
          errors.push(`Event ${eventId} not found`);
        }
      } catch (error: any) {
        failedCount++;
        errors.push(`Event ${eventId}: ${error.message}`);
        console.error(`Failed to update event ${eventId}:`, error);
      }
    }

    res.json({
      success: successCount > 0,
      updated: successCount,
      failed: failedCount,
      total: event_ids.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully updated ${successCount} of ${event_ids.length} event(s)`
    });

  } catch (error) {
    console.error('Bulk update events error:', error);
    res.status(500).json({ error: 'Failed to bulk update events' });
  }
};
