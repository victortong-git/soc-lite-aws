import { query } from '../db/connection';

export interface SmartAnalysisTask {
  id: number;
  source_ip: string;
  time_group?: string;  // Format: YYYYMMDD-HHMM
  status: 'open' | 'in_review' | 'completed' | 'closed';
  severity_rating?: number;
  security_analysis?: string;
  recommended_actions?: string;
  attack_type?: string;  // Type of attack identified by AI
  num_linked_events: number;
  analysis_job_status?: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'on_hold';
  ai_prompt?: string;  // Raw prompt sent to AI agent
  ai_response?: string;  // Raw response from AI agent
  created_at: Date;
  updated_at: Date;
  analyzed_at?: Date;
  analyzed_by?: string;
}

export interface SmartAnalysisTaskListParams {
  page?: number;
  limit?: number;
  status?: string;
  severity?: number | string;
  source_ip?: string;
  date_from?: string;
  date_to?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class SmartAnalysisTaskModel {
  /**
   * Find all tasks with pagination and filters
   */
  static async findAll(params: SmartAnalysisTaskListParams = {}): Promise<{
    data: SmartAnalysisTask[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 50,
      status,
      severity,
      source_ip,
      date_from,
      date_to,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = params;

    const offset = (page - 1) * limit;
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramCount = 0;

    // Status filter
    if (status) {
      const statuses = typeof status === 'string' ? status.split(',').map(s => s.trim()) : [status];
      if (statuses.length === 1) {
        paramCount++;
        whereConditions.push(`status = $${paramCount}`);
        queryParams.push(statuses[0]);
      } else {
        paramCount++;
        whereConditions.push(`status = ANY($${paramCount}::text[])`);
        queryParams.push(statuses);
      }
    }

    // Severity filter
    if (severity !== undefined) {
      const severities = typeof severity === 'string' ? severity.split(',').map(s => parseInt(s.trim())) : [severity];
      if (severities.length === 1) {
        paramCount++;
        whereConditions.push(`severity_rating = $${paramCount}`);
        queryParams.push(severities[0]);
      } else {
        paramCount++;
        whereConditions.push(`severity_rating = ANY($${paramCount}::integer[])`);
        queryParams.push(severities);
      }
    }

    // Source IP filter
    if (source_ip) {
      paramCount++;
      whereConditions.push(`source_ip LIKE $${paramCount}`);
      queryParams.push(`%${source_ip}%`);
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

    const allowedSortColumns = ['id', 'created_at', 'updated_at', 'severity_rating', 'source_ip', 'num_linked_events'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM smart_analysis_tasks ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data with latest job status
    const dataParams = [...queryParams, limit, offset];
    const limitParam = paramCount + 1;
    const offsetParam = paramCount + 2;

    const dataResult = await query(
      `SELECT
         sat.*,
         latest_job.status as analysis_job_status
       FROM smart_analysis_tasks sat
       LEFT JOIN LATERAL (
         SELECT status
         FROM smart_analysis_jobs
         WHERE task_id = sat.id
         ORDER BY created_at DESC
         LIMIT 1
       ) latest_job ON true
       ${whereClause}
       ORDER BY sat.${sortColumn} ${order}
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
   * Find task by ID
   */
  static async findById(id: number): Promise<SmartAnalysisTask | null> {
    const result = await query(
      `SELECT
         sat.*,
         latest_job.status as analysis_job_status
       FROM smart_analysis_tasks sat
       LEFT JOIN LATERAL (
         SELECT status
         FROM smart_analysis_jobs
         WHERE task_id = sat.id
         ORDER BY created_at DESC
         LIMIT 1
       ) latest_job ON true
       WHERE sat.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find task by source IP
   */
  static async findBySourceIp(source_ip: string): Promise<SmartAnalysisTask[]> {
    const result = await query(
      'SELECT * FROM smart_analysis_tasks WHERE source_ip = $1 ORDER BY created_at DESC',
      [source_ip]
    );
    return result.rows;
  }

  /**
   * Create new task
   */
  static async create(source_ip: string, num_linked_events: number = 0, time_group?: string): Promise<SmartAnalysisTask> {
    const result = await query(
      `INSERT INTO smart_analysis_tasks (source_ip, num_linked_events, time_group, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING *`,
      [source_ip, num_linked_events, time_group || null]
    );
    return result.rows[0];
  }

  /**
   * Find task by source IP and time group
   */
  static async findBySourceIpAndTimeGroup(source_ip: string, time_group: string): Promise<SmartAnalysisTask | null> {
    const result = await query(
      'SELECT * FROM smart_analysis_tasks WHERE source_ip = $1 AND time_group = $2',
      [source_ip, time_group]
    );
    return result.rows[0] || null;
  }

  /**
   * Update task
   */
  static async update(id: number, updates: Partial<SmartAnalysisTask>): Promise<SmartAnalysisTask | null> {
    const allowedFields = [
      'status', 'severity_rating', 'security_analysis', 'recommended_actions', 'attack_type',
      'num_linked_events', 'analyzed_at', 'analyzed_by', 'ai_prompt', 'ai_response'
    ];

    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key as keyof SmartAnalysisTask] !== undefined) {
        paramCount++;
        setClause.push(`${key} = $${paramCount}`);
        values.push(updates[key as keyof SmartAnalysisTask]);
      }
    });

    if (setClause.length === 0) {
      return await this.findById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE smart_analysis_tasks
       SET ${setClause.join(', ')}
       WHERE id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Update with analysis results
   */
  static async updateAnalysis(
    id: number,
    severity_rating: number,
    security_analysis: string,
    recommended_actions: string,
    analyzed_by: string,
    ai_prompt?: string,
    ai_response?: string
  ): Promise<SmartAnalysisTask | null> {
    const result = await query(
      `UPDATE smart_analysis_tasks
       SET severity_rating = $1,
           security_analysis = $2,
           recommended_actions = $3,
           analyzed_by = $4,
           analyzed_at = CURRENT_TIMESTAMP,
           status = 'completed',
           ai_prompt = $6,
           ai_response = $7
       WHERE id = $5
       RETURNING *`,
      [severity_rating, security_analysis, recommended_actions, analyzed_by, id, ai_prompt || null, ai_response || null]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete task
   */
  static async delete(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM smart_analysis_tasks WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get statistics
   */
  static async getStats(): Promise<any> {
    const result = await query(`
      SELECT
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tasks,
        COUNT(CASE WHEN status = 'in_review' THEN 1 END) as in_review_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tasks,
        COUNT(CASE WHEN severity_rating = 5 THEN 1 END) as critical_tasks,
        COUNT(CASE WHEN severity_rating = 4 THEN 1 END) as high_tasks,
        SUM(num_linked_events) as total_linked_events,
        AVG(severity_rating) as avg_severity
      FROM smart_analysis_tasks
    `);

    const row = result.rows[0];
    return {
      total_tasks: parseInt(row.total_tasks),
      open_tasks: parseInt(row.open_tasks),
      in_review_tasks: parseInt(row.in_review_tasks),
      completed_tasks: parseInt(row.completed_tasks),
      closed_tasks: parseInt(row.closed_tasks),
      critical_tasks: parseInt(row.critical_tasks),
      high_tasks: parseInt(row.high_tasks),
      total_linked_events: parseInt(row.total_linked_events || 0),
      avg_severity: parseFloat(row.avg_severity || 0).toFixed(2)
    };
  }

  /**
   * Get severity distribution
   */
  static async getSeverityDistribution(): Promise<Array<{
    severity: number;
    severity_label: string;
    count: number;
    percentage: number;
  }>> {
    const totalResult = await query('SELECT COUNT(*) as total FROM smart_analysis_tasks WHERE severity_rating IS NOT NULL');
    const total = parseInt(totalResult.rows[0].total);

    const result = await query(`
      SELECT
        severity_rating as severity,
        COUNT(*) as count
      FROM smart_analysis_tasks
      WHERE severity_rating IS NOT NULL
      GROUP BY severity_rating
      ORDER BY severity_rating DESC
    `);

    const severityLabels: { [key: number]: string } = {
      5: 'Critical',
      4: 'High',
      3: 'Medium',
      2: 'Low',
      1: 'Info',
      0: 'Safe'
    };

    return result.rows.map(row => ({
      severity: parseInt(row.severity),
      severity_label: severityLabels[parseInt(row.severity)] || 'Unknown',
      count: parseInt(row.count),
      percentage: total > 0 ? (parseInt(row.count) / total * 100) : 0
    }));
  }

  /**
   * Get distinct source IPs with open unlinked events
   */
  static async getSourceIPsWithOpenUnlinkedEvents(): Promise<string[]> {
    const result = await query(`
      SELECT DISTINCT source_ip
      FROM waf_log
      WHERE status = 'open'
        AND smart_analysis_task_id IS NULL
      ORDER BY source_ip
    `);
    return result.rows.map(row => row.source_ip);
  }

  /**
   * Bulk delete tasks by status
   */
  static async bulkDeleteByStatus(status: string): Promise<number> {
    const result = await query(
      `DELETE FROM smart_analysis_tasks
       WHERE status = $1
       RETURNING id`,
      [status]
    );
    return result.rowCount || 0;
  }

  /**
   * Bulk delete all tasks
   */
  static async bulkDeleteAll(): Promise<number> {
    const result = await query(
      `DELETE FROM smart_analysis_tasks
       RETURNING id`
    );
    return result.rowCount || 0;
  }
}

export const SmartAnalysisTask = SmartAnalysisTaskModel;
