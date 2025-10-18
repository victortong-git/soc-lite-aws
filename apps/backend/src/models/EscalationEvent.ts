import { query } from '../db/connection';

export interface EscalationEvent {
  id: number;
  title: string;
  message: string;
  detail_payload?: any;
  severity: number;
  source_type: 'waf_event' | 'smart_task' | 'attack_campaign';
  source_waf_event_id?: number | null;
  source_smart_task_id?: number | null;
  created_at: Date;
  completed_sns: boolean;
  completed_incident: boolean;
  sns_sent_at?: Date;
  sns_message_id?: string;
  sns_error?: string;
  servicenow_incident_number?: string;
  servicenow_incident_created_at?: Date;
  servicenow_incident_sys_id?: string;
  servicenow_incident_error?: string;
  updated_at: Date;
}

export interface EscalationEventListParams {
  page?: number;
  limit?: number;
  source_type?: 'waf_event' | 'smart_task' | 'attack_campaign';
  severity?: number;
  completed_sns?: boolean;
  completed_incident?: boolean;
  date_from?: string;
  date_to?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class EscalationEventModel {
  /**
   * Find all escalation events with filtering and pagination
   */
  static async findAll(params: EscalationEventListParams = {}): Promise<{
    data: EscalationEvent[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 50,
      source_type,
      severity,
      completed_sns,
      completed_incident,
      date_from,
      date_to,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = params;

    const offset = (page - 1) * limit;
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramCount = 0;

    // Source type filter
    if (source_type) {
      paramCount++;
      whereConditions.push(`source_type = $${paramCount}`);
      queryParams.push(source_type);
    }

    // Severity filter
    if (severity !== undefined) {
      paramCount++;
      whereConditions.push(`severity = $${paramCount}`);
      queryParams.push(severity);
    }

    // Completed SNS filter
    if (completed_sns !== undefined) {
      paramCount++;
      whereConditions.push(`completed_sns = $${paramCount}`);
      queryParams.push(completed_sns);
    }

    // Completed incident filter
    if (completed_incident !== undefined) {
      paramCount++;
      whereConditions.push(`completed_incident = $${paramCount}`);
      queryParams.push(completed_incident);
    }

    // Date range filters
    if (date_from) {
      paramCount++;
      whereConditions.push(`created_at >= $${paramCount}`);
      queryParams.push(date_from);
    }

    if (date_to) {
      paramCount++;
      whereConditions.push(`created_at <= $${paramCount}`);
      queryParams.push(date_to);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const allowedSortColumns = ['id', 'created_at', 'severity', 'source_type', 'completed_sns'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM escalation_events ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data
    const dataParams = [...queryParams, limit, offset];
    const limitParam = paramCount + 1;
    const offsetParam = paramCount + 2;

    const dataResult = await query(
      `SELECT * FROM escalation_events
       ${whereClause}
       ORDER BY ${sortColumn} ${order}
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      dataParams
    );

    return {
      data: dataResult.rows,
      total,
      page,
      limit
    };
  }

  /**
   * Find escalation event by ID
   */
  static async findById(id: number): Promise<EscalationEvent | null> {
    const result = await query(
      'SELECT * FROM escalation_events WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find escalations by source WAF event ID
   */
  static async findByWafEventId(wafEventId: number): Promise<EscalationEvent[]> {
    const result = await query(
      `SELECT * FROM escalation_events
       WHERE source_waf_event_id = $1
       ORDER BY created_at DESC`,
      [wafEventId]
    );
    return result.rows;
  }

  /**
   * Find escalations by source smart task ID
   */
  static async findBySmartTaskId(smartTaskId: number): Promise<EscalationEvent[]> {
    const result = await query(
      `SELECT * FROM escalation_events
       WHERE source_smart_task_id = $1
       ORDER BY created_at DESC`,
      [smartTaskId]
    );
    return result.rows;
  }

  /**
   * Create new escalation event
   */
  static async create(escalation: Partial<EscalationEvent>): Promise<EscalationEvent> {
    const {
      title,
      message,
      detail_payload,
      severity,
      source_type,
      source_waf_event_id,
      source_smart_task_id
    } = escalation;

    const result = await query(
      `INSERT INTO escalation_events (
        title, message, detail_payload, severity, source_type,
        source_waf_event_id, source_smart_task_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        title,
        message,
        detail_payload ? JSON.stringify(detail_payload) : null,
        severity,
        source_type,
        source_waf_event_id || null,
        source_smart_task_id || null
      ]
    );

    return result.rows[0];
  }

  /**
   * Update escalation event
   */
  static async update(id: number, updates: Partial<EscalationEvent>): Promise<EscalationEvent | null> {
    const allowedFields = [
      'title', 'message', 'detail_payload', 'severity',
      'completed_sns', 'completed_incident', 'sns_sent_at',
      'sns_message_id', 'sns_error', 'servicenow_incident_number',
      'servicenow_incident_created_at', 'servicenow_incident_sys_id',
      'servicenow_incident_error'
    ];

    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key as keyof EscalationEvent] !== undefined) {
        paramCount++;
        if (key === 'detail_payload') {
          setClause.push(`${key} = $${paramCount}::jsonb`);
          values.push(JSON.stringify(updates[key as keyof EscalationEvent]));
        } else {
          setClause.push(`${key} = $${paramCount}`);
          values.push(updates[key as keyof EscalationEvent]);
        }
      }
    });

    if (setClause.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE escalation_events
       SET ${setClause.join(', ')}
       WHERE id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete escalation event
   */
  static async delete(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM escalation_events WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get statistics for escalation events
   */
  static async getStats(): Promise<any> {
    const result = await query(`
      SELECT
        COUNT(*) as total_escalations,
        COUNT(CASE WHEN completed_sns = FALSE THEN 1 END) as pending_sns,
        COUNT(CASE WHEN completed_sns = TRUE THEN 1 END) as completed_sns,
        COUNT(CASE WHEN sns_error IS NOT NULL AND completed_sns = FALSE THEN 1 END) as failed_sns,
        COUNT(CASE WHEN completed_incident = TRUE THEN 1 END) as completed_incident,
        COUNT(CASE WHEN severity = 5 THEN 1 END) as critical_escalations,
        COUNT(CASE WHEN severity = 4 THEN 1 END) as high_escalations,
        COUNT(CASE WHEN source_type = 'waf_event' THEN 1 END) as waf_event_escalations,
        COUNT(CASE WHEN source_type = 'smart_task' THEN 1 END) as smart_task_escalations
      FROM escalation_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    const stats = result.rows[0];

    return {
      total_escalations: parseInt(stats.total_escalations),
      pending_sns: parseInt(stats.pending_sns),
      completed_sns: parseInt(stats.completed_sns),
      failed_sns: parseInt(stats.failed_sns),
      completed_incident: parseInt(stats.completed_incident),
      critical_escalations: parseInt(stats.critical_escalations),
      high_escalations: parseInt(stats.high_escalations),
      waf_event_escalations: parseInt(stats.waf_event_escalations),
      smart_task_escalations: parseInt(stats.smart_task_escalations)
    };
  }

  /**
   * Find escalations pending SNS notification (for escalation-processor Lambda)
   */
  static async findPendingSNS(limit: number = 50): Promise<EscalationEvent[]> {
    const result = await query(
      `SELECT * FROM escalation_events
       WHERE completed_sns = FALSE
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Mark SNS as complete with success
   */
  static async markSNSComplete(id: number, messageId: string): Promise<EscalationEvent | null> {
    const result = await query(
      `UPDATE escalation_events
       SET completed_sns = TRUE,
           sns_sent_at = CURRENT_TIMESTAMP,
           sns_message_id = $2,
           sns_error = NULL
       WHERE id = $1
       RETURNING *`,
      [id, messageId]
    );
    return result.rows[0] || null;
  }

  /**
   * Mark SNS as failed with error
   */
  static async markSNSFailed(id: number, error: string): Promise<EscalationEvent | null> {
    const result = await query(
      `UPDATE escalation_events
       SET sns_error = $2
       WHERE id = $1
       RETURNING *`,
      [id, error]
    );
    return result.rows[0] || null;
  }

  /**
   * Find escalations pending incident creation (for ServiceNow Lambda)
   */
  static async findPendingIncident(limit: number = 50): Promise<EscalationEvent[]> {
    const result = await query(
      `SELECT * FROM escalation_events
       WHERE completed_incident = FALSE
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Mark ServiceNow incident as complete with success
   */
  static async markIncidentComplete(
    id: number,
    incidentNumber: string,
    sysId: string
  ): Promise<EscalationEvent | null> {
    const result = await query(
      `UPDATE escalation_events
       SET completed_incident = TRUE,
           servicenow_incident_created_at = CURRENT_TIMESTAMP,
           servicenow_incident_number = $2,
           servicenow_incident_sys_id = $3,
           servicenow_incident_error = NULL
       WHERE id = $1
       RETURNING *`,
      [id, incidentNumber, sysId]
    );
    return result.rows[0] || null;
  }

  /**
   * Mark ServiceNow incident creation as failed with error
   */
  static async markIncidentFailed(id: number, error: string): Promise<EscalationEvent | null> {
    const result = await query(
      `UPDATE escalation_events
       SET servicenow_incident_error = $2
       WHERE id = $1
       RETURNING *`,
      [id, error]
    );
    return result.rows[0] || null;
  }
}

// Export alias for cleaner imports
export const EscalationEvent = EscalationEventModel;
