import { query } from '../db/connection';

export interface SmartAnalysisEventLink {
  id: number;
  smart_analysis_task_id: number;
  waf_log_id: number;
  created_at: Date;
}

export class SmartAnalysisEventLinkModel {
  /**
   * Link a WAF event to a smart analysis task
   */
  static async linkEvent(task_id: number, waf_log_id: number): Promise<SmartAnalysisEventLink> {
    const result = await query(
      `INSERT INTO smart_analysis_event_links (smart_analysis_task_id, waf_log_id)
       VALUES ($1, $2)
       RETURNING *`,
      [task_id, waf_log_id]
    );
    return result.rows[0];
  }

  /**
   * Bulk link multiple WAF events to a task
   */
  static async bulkLinkEvents(task_id: number, waf_log_ids: number[]): Promise<number> {
    if (waf_log_ids.length === 0) return 0;

    // Build VALUES clause for bulk insert
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramCount = 0;

    waf_log_ids.forEach(waf_log_id => {
      paramCount += 2;
      placeholders.push(`($${paramCount - 1}, $${paramCount})`);
      values.push(task_id, waf_log_id);
    });

    const result = await query(
      `INSERT INTO smart_analysis_event_links (smart_analysis_task_id, waf_log_id)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (waf_log_id) DO NOTHING
       RETURNING id`,
      values
    );

    return result.rowCount || 0;
  }

  /**
   * Unlink a WAF event from a task
   */
  static async unlinkEvent(task_id: number, waf_log_id: number): Promise<boolean> {
    const result = await query(
      `DELETE FROM smart_analysis_event_links
       WHERE smart_analysis_task_id = $1 AND waf_log_id = $2
       RETURNING id`,
      [task_id, waf_log_id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get all event IDs linked to a task
   */
  static async getLinkedEventIds(task_id: number): Promise<number[]> {
    const result = await query(
      `SELECT waf_log_id FROM smart_analysis_event_links
       WHERE smart_analysis_task_id = $1
       ORDER BY created_at ASC`,
      [task_id]
    );
    return result.rows.map(row => row.waf_log_id);
  }

  /**
   * Get all events linked to a task (with full event data)
   */
  static async getEventsByTaskId(task_id: number): Promise<any[]> {
    const result = await query(
      `SELECT w.*
       FROM waf_log w
       INNER JOIN smart_analysis_event_links l ON w.id = l.waf_log_id
       WHERE l.smart_analysis_task_id = $1
       ORDER BY w.timestamp ASC`,
      [task_id]
    );
    return result.rows;
  }

  /**
   * Count linked events for a task
   */
  static async countLinkedEvents(task_id: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM smart_analysis_event_links
       WHERE smart_analysis_task_id = $1`,
      [task_id]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Delete all links for a task (used when deleting task)
   */
  static async deleteByTaskId(task_id: number): Promise<number> {
    const result = await query(
      `DELETE FROM smart_analysis_event_links
       WHERE smart_analysis_task_id = $1
       RETURNING id`,
      [task_id]
    );
    return result.rowCount || 0;
  }
}

export const SmartAnalysisEventLink = SmartAnalysisEventLinkModel;
