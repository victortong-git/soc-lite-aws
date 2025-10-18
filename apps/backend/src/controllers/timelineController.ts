import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { EventTimelineModel } from '../models/EventTimeline';
import { WafLogModel } from '../models/WafLog';

/**
 * Get timeline for a specific event
 */
export const getEventTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const timeline = await EventTimelineModel.findByEventId(eventId);

    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    console.error('Get event timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
};

/**
 * Create a new timeline entry (user-generated)
 */
export const createTimelineEntry = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const { event_type, title, description, metadata } = req.body;

    if (!event_type || !title) {
      res.status(400).json({ error: 'Missing required fields: event_type, title' });
      return;
    }

    // Get user information from authenticated request
    const userName = req.user?.username || 'Unknown User';
    const userEmail = ''; // Email not available in JWT payload

    const timelineEntry = await EventTimelineModel.createUserEntry(
      eventId,
      event_type,
      userName,
      userEmail,
      title,
      description,
      metadata
    );

    res.status(201).json({
      success: true,
      data: timelineEntry,
      message: 'Timeline entry created successfully'
    });
  } catch (error) {
    console.error('Create timeline entry error:', error);
    res.status(500).json({ error: 'Failed to create timeline entry' });
  }
};

/**
 * Delete a timeline entry
 */
export const deleteTimelineEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, timelineId } = req.params;
    const eventId = parseInt(id);
    const entryId = parseInt(timelineId);

    if (isNaN(eventId) || isNaN(entryId)) {
      res.status(400).json({ error: 'Invalid event ID or timeline entry ID' });
      return;
    }

    // Verify timeline entry exists and belongs to this event
    const timelineEntry = await EventTimelineModel.findById(entryId);
    if (!timelineEntry) {
      res.status(404).json({ error: 'Timeline entry not found' });
      return;
    }

    if (timelineEntry.event_id !== eventId) {
      res.status(400).json({ error: 'Timeline entry does not belong to this event' });
      return;
    }

    // Only allow users to delete user-generated entries (or admins can delete any)
    const isAdmin = req.user?.role === 'admin';
    const isOwner = timelineEntry.actor_type === 'user' &&
                    timelineEntry.actor_name === req.user?.username;

    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: 'You do not have permission to delete this timeline entry' });
      return;
    }

    const deleted = await EventTimelineModel.delete(entryId);

    if (!deleted) {
      res.status(404).json({ error: 'Timeline entry not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Timeline entry deleted successfully'
    });
  } catch (error) {
    console.error('Delete timeline entry error:', error);
    res.status(500).json({ error: 'Failed to delete timeline entry' });
  }
};

/**
 * Get count of timeline entries for an event
 */
export const getTimelineCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      res.status(400).json({ error: 'Invalid event ID' });
      return;
    }

    const count = await EventTimelineModel.countByEventId(eventId);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get timeline count error:', error);
    res.status(500).json({ error: 'Failed to get timeline count' });
  }
};
