import { query } from '../db/connection';

export interface EventTimelineEntry {
  id: number;
  event_id: number;
  event_type: string;
  actor_type: 'user' | 'system';
  actor_name?: string;
  actor_email?: string;
  title: string;
  description?: string;
  metadata?: any;
  created_at: Date;
}

export interface CreateTimelineEntryParams {
  event_id: number;
  event_type: string;
  actor_type: 'user' | 'system';
  actor_name?: string;
  actor_email?: string;
  title: string;
  description?: string;
  metadata?: any;
}

export class EventTimelineModel {
  /**
   * Get all timeline entries for a specific event
   */
  static async findByEventId(eventId: number): Promise<EventTimelineEntry[]> {
    const result = await query(
      `SELECT * FROM event_timeline
       WHERE event_id = $1
       ORDER BY created_at DESC`,
      [eventId]
    );
    return result.rows;
  }

  /**
   * Get a single timeline entry by ID
   */
  static async findById(id: number): Promise<EventTimelineEntry | null> {
    const result = await query(
      `SELECT * FROM event_timeline WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new timeline entry
   */
  static async create(params: CreateTimelineEntryParams): Promise<EventTimelineEntry> {
    const {
      event_id,
      event_type,
      actor_type,
      actor_name,
      actor_email,
      title,
      description,
      metadata
    } = params;

    const result = await query(
      `INSERT INTO event_timeline (
        event_id, event_type, actor_type, actor_name, actor_email,
        title, description, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        event_id,
        event_type,
        actor_type,
        actor_name || null,
        actor_email || null,
        title,
        description || null,
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    return result.rows[0];
  }

  /**
   * Delete a timeline entry
   */
  static async delete(id: number): Promise<boolean> {
    const result = await query(
      `DELETE FROM event_timeline WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Create a system-generated timeline entry
   */
  static async createSystemEntry(
    eventId: number,
    eventType: string,
    title: string,
    description?: string,
    metadata?: any
  ): Promise<EventTimelineEntry> {
    return this.create({
      event_id: eventId,
      event_type: eventType,
      actor_type: 'system',
      actor_name: 'System',
      title,
      description,
      metadata
    });
  }

  /**
   * Create a user-generated timeline entry
   */
  static async createUserEntry(
    eventId: number,
    eventType: string,
    userName: string,
    userEmail: string,
    title: string,
    description?: string,
    metadata?: any
  ): Promise<EventTimelineEntry> {
    return this.create({
      event_id: eventId,
      event_type: eventType,
      actor_type: 'user',
      actor_name: userName,
      actor_email: userEmail,
      title,
      description,
      metadata
    });
  }

  /**
   * Bulk delete timeline entries for an event
   */
  static async deleteByEventId(eventId: number): Promise<number> {
    const result = await query(
      `DELETE FROM event_timeline WHERE event_id = $1 RETURNING id`,
      [eventId]
    );
    return result.rowCount || 0;
  }

  /**
   * Get recent timeline entries across all events
   */
  static async getRecent(limit: number = 10): Promise<EventTimelineEntry[]> {
    const result = await query(
      `SELECT et.*, w.source_ip, w.action, w.severity_rating
       FROM event_timeline et
       JOIN waf_log w ON et.event_id = w.id
       ORDER BY et.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Count timeline entries for an event
   */
  static async countByEventId(eventId: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as total FROM event_timeline WHERE event_id = $1`,
      [eventId]
    );
    return parseInt(result.rows[0].total);
  }
}

// Export alias for cleaner imports
export const EventTimeline = EventTimelineModel;
