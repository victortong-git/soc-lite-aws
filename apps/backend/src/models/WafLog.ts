import { query } from '../db/connection';

export interface WafLog {
  id: number;
  timestamp: Date;
  action: string;
  rule_id?: string;
  rule_name?: string;
  source_ip: string;
  uri?: string;
  http_method?: string;
  http_request?: string;
  country?: string;
  user_agent?: string;
  headers?: any;
  rate_based_rule_list?: any;
  non_terminating_matching_rules?: any;
  event_detail?: any;
  web_acl_id?: string;
  web_acl_name?: string;
  processed: boolean;
  created_at: Date;
  updated_at: Date;
  request_id: string;
  raw_message?: any;
  severity_rating?: number;
  security_analysis?: string;
  follow_up_suggestion?: string;
  status: string;
  analyzed_at?: Date;
  analyzed_by?: string;
  analysis_job_id?: number;
  analysis_job_status?: string;
  host?: string;
  smart_analysis_task_id?: number;
}

export interface WafLogListParams {
  page?: number;
  limit?: number;
  action?: string;
  status?: string;
  severity?: number | string;  // Can be single number or comma-separated string
  source_ip?: string;
  country?: string;
  host?: string;
  rule_id?: string;
  rule_name?: string;
  uri?: string;
  http_method?: string;
  date_from?: string;
  date_to?: string;
  has_ai_analysis?: boolean;
  processed?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class WafLogModel {
  static async findAll(params: WafLogListParams = {}): Promise<{ data: WafLog[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 50,
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
    } = params;

    const offset = (page - 1) * limit;
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramCount = 0;

    // Action filter (comma-separated support)
    if (action) {
      const actions = typeof action === 'string' ? action.split(',').map(a => a.trim()) : [action];
      if (actions.length === 1) {
        paramCount++;
        whereConditions.push(`action = $${paramCount}`);
        queryParams.push(actions[0]);
      } else {
        paramCount++;
        whereConditions.push(`action = ANY($${paramCount}::text[])`);
        queryParams.push(actions);
      }
    }

    // Status filter (comma-separated support)
    // Use w.status to avoid ambiguity with analysis_jobs.status in the JOIN
    if (status) {
      const statuses = typeof status === 'string' ? status.split(',').map(s => s.trim()) : [status];
      if (statuses.length === 1) {
        paramCount++;
        whereConditions.push(`w.status = $${paramCount}`);
        queryParams.push(statuses[0]);
      } else {
        paramCount++;
        whereConditions.push(`w.status = ANY($${paramCount}::text[])`);
        queryParams.push(statuses);
      }
    }

    // Severity filter (comma-separated support for multiple severities)
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

    // Country filter
    if (country) {
      paramCount++;
      whereConditions.push(`country ILIKE $${paramCount}`);
      queryParams.push(`%${country}%`);
    }

    // Host filter
    if (host) {
      paramCount++;
      whereConditions.push(`host ILIKE $${paramCount}`);
      queryParams.push(`%${host}%`);
    }

    // Rule ID filter
    if (rule_id) {
      paramCount++;
      whereConditions.push(`rule_id ILIKE $${paramCount}`);
      queryParams.push(`%${rule_id}%`);
    }

    // Rule Name filter
    if (rule_name) {
      paramCount++;
      whereConditions.push(`rule_name ILIKE $${paramCount}`);
      queryParams.push(`%${rule_name}%`);
    }

    // URI filter
    if (uri) {
      paramCount++;
      whereConditions.push(`uri ILIKE $${paramCount}`);
      queryParams.push(`%${uri}%`);
    }

    // HTTP Method filter (comma-separated support)
    if (http_method) {
      const methods = typeof http_method === 'string' ? http_method.split(',').map(m => m.trim()) : [http_method];
      if (methods.length === 1) {
        paramCount++;
        whereConditions.push(`http_method = $${paramCount}`);
        queryParams.push(methods[0]);
      } else {
        paramCount++;
        whereConditions.push(`http_method = ANY($${paramCount}::text[])`);
        queryParams.push(methods);
      }
    }

    // Date range filters
    if (date_from) {
      paramCount++;
      whereConditions.push(`timestamp >= $${paramCount}`);
      queryParams.push(date_from);
    }

    if (date_to) {
      paramCount++;
      whereConditions.push(`timestamp <= $${paramCount}`);
      queryParams.push(date_to);
    }

    // AI Analysis filter
    if (has_ai_analysis !== undefined) {
      if (has_ai_analysis) {
        whereConditions.push(`security_analysis IS NOT NULL`);
      } else {
        whereConditions.push(`security_analysis IS NULL`);
      }
    }

    // Processed filter
    if (processed !== undefined) {
      paramCount++;
      whereConditions.push(`processed = $${paramCount}`);
      queryParams.push(processed);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Debug logging
    console.log('🔍 [WafLog.findAll] Filter params:', { status, action, severity });
    console.log('🔍 [WafLog.findAll] WHERE clause:', whereClause);
    console.log('🔍 [WafLog.findAll] Query params:', queryParams);

    const allowedSortColumns = ['id', 'timestamp', 'created_at', 'severity_rating', 'action', 'source_ip'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get total count (use w alias to match WHERE clause)
    const countResult = await query(
      `SELECT COUNT(*) as total FROM waf_log w ${whereClause}`,
      queryParams
    );
    console.log('🔍 [WafLog.findAll] Count result:', countResult.rows[0]);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data with analysis job status - use separate params array to avoid conflicts
    const dataParams = [...queryParams, limit, offset];
    const limitParam = paramCount + 1;
    const offsetParam = paramCount + 2;

    const dataResult = await query(
      `SELECT w.*, aj.status as analysis_job_status
       FROM waf_log w
       LEFT JOIN analysis_jobs aj ON w.analysis_job_id = aj.id
       ${whereClause}
       ORDER BY w.${sortColumn} ${order}
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

  static async findById(id: number): Promise<WafLog | null> {
    const result = await query(
      `SELECT w.*, aj.status as analysis_job_status
       FROM waf_log w
       LEFT JOIN analysis_jobs aj ON w.analysis_job_id = aj.id
       WHERE w.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async create(wafLog: Partial<WafLog> & { severity?: number }): Promise<WafLog> {
    const {
      timestamp,
      action,
      rule_id,
      rule_name,
      source_ip,
      uri,
      http_method,
      http_request,
      country,
      user_agent,
      headers,
      rate_based_rule_list,
      non_terminating_matching_rules,
      event_detail,
      web_acl_id,
      web_acl_name,
      request_id,
      raw_message,
      severity_rating,
      security_analysis,
      follow_up_suggestion,
      status = 'open',
      severity
    } = wafLog as any;

    // Map severity to severity_rating if provided
    const finalSeverityRating = severity !== undefined ? severity : severity_rating;

    // Extract host from raw_message.httpRequest.host
    let host: string | null = null;
    if (raw_message) {
      try {
        const rawMsg = typeof raw_message === 'string' ? JSON.parse(raw_message) : raw_message;
        host = rawMsg?.httpRequest?.host || null;
      } catch (err) {
        console.warn('Failed to extract host from raw_message:', err);
      }
    }

    const result = await query(
      `INSERT INTO waf_log (
        timestamp, action, rule_id, rule_name, source_ip, uri, http_method,
        http_request, country, user_agent, headers, rate_based_rule_list,
        non_terminating_matching_rules, event_detail, web_acl_id, web_acl_name,
        request_id, raw_message, severity_rating, security_analysis,
        follow_up_suggestion, status, host
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23
      ) RETURNING *`,
      [
        timestamp, action, rule_id, rule_name, source_ip, uri, http_method,
        http_request, country, user_agent, headers ? JSON.stringify(headers) : null,
        rate_based_rule_list ? JSON.stringify(rate_based_rule_list) : null,
        non_terminating_matching_rules ? JSON.stringify(non_terminating_matching_rules) : null,
        event_detail ? JSON.stringify(event_detail) : null, web_acl_id, web_acl_name,
        request_id, raw_message ? JSON.stringify(raw_message) : null, finalSeverityRating,
        security_analysis, follow_up_suggestion, status, host
      ]
    );

    return result.rows[0];
  }

  static async update(id: number, updates: Partial<WafLog> & { severity?: number }): Promise<WafLog | null> {
    const allowedFields = [
      'action', 'rule_id', 'rule_name', 'source_ip', 'uri', 'http_method',
      'country', 'user_agent', 'severity_rating', 'security_analysis',
      'follow_up_suggestion', 'status', 'processed', 'analysis_job_id'
    ];

    // Map severity to severity_rating if provided
    const processedUpdates = { ...updates } as any;
    if (processedUpdates.severity !== undefined) {
      processedUpdates.severity_rating = processedUpdates.severity;
      delete processedUpdates.severity;
    }

    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(processedUpdates).forEach(key => {
      if (allowedFields.includes(key) && processedUpdates[key as keyof WafLog] !== undefined) {
        paramCount++;
        setClause.push(`${key} = $${paramCount}`);
        values.push(processedUpdates[key as keyof WafLog]);
      }
    });

    if (setClause.length === 0) {
      const existing = await this.findById(id);
      return existing;
    }

    values.push(id);
    const result = await query(
      `UPDATE waf_log
       SET ${setClause.join(', ')}
       WHERE id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM waf_log WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async getStats(): Promise<any> {
    // Get current stats
    const currentResult = await query(`
      SELECT
        COUNT(*) as total_events,
        COUNT(CASE WHEN action = 'BLOCK' THEN 1 END) as blocked_events,
        COUNT(CASE WHEN action = 'ALLOW' THEN 1 END) as allowed_events,
        COUNT(CASE WHEN action = 'COUNT' THEN 1 END) as count_events,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_events,
        COUNT(CASE WHEN processed = false THEN 1 END) as unprocessed_events,
        COUNT(CASE WHEN severity_rating = 5 THEN 1 END) as critical_events,
        COUNT(CASE WHEN severity_rating = 4 THEN 1 END) as high_events,
        COUNT(CASE WHEN security_analysis IS NOT NULL THEN 1 END) as ai_analyzed_events,
        AVG(severity_rating) as avg_severity,
        COUNT(DISTINCT host) as monitored_hosts_count
      FROM waf_log
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    // Get previous period stats for trends (7 days ago to 14 days ago)
    const previousResult = await query(`
      SELECT
        COUNT(*) as total_events,
        COUNT(CASE WHEN action = 'BLOCK' THEN 1 END) as blocked_events,
        COUNT(CASE WHEN severity_rating = 5 THEN 1 END) as critical_events
      FROM waf_log
      WHERE created_at >= NOW() - INTERVAL '14 days'
        AND created_at < NOW() - INTERVAL '7 days'
    `);

    const current = currentResult.rows[0];
    const previous = previousResult.rows[0];

    // Calculate trends (percentage change)
    const totalTrend = previous.total_events > 0
      ? ((current.total_events - previous.total_events) / previous.total_events * 100).toFixed(1)
      : "0";

    const blockedTrend = previous.blocked_events > 0
      ? ((current.blocked_events - previous.blocked_events) / previous.blocked_events * 100).toFixed(1)
      : "0";

    const criticalTrend = previous.critical_events > 0
      ? ((current.critical_events - previous.critical_events) / previous.critical_events * 100).toFixed(1)
      : "0";

    // Calculate AI analysis rate
    const aiAnalysisRate = current.total_events > 0
      ? (current.ai_analyzed_events / current.total_events * 100).toFixed(1)
      : "0";

    // Calculate blocked rate
    const blockedRate = current.total_events > 0
      ? (current.blocked_events / current.total_events * 100).toFixed(1)
      : "0";

    return {
      ...current,
      total_events: parseInt(current.total_events),
      blocked_events: parseInt(current.blocked_events),
      allowed_events: parseInt(current.allowed_events),
      count_events: parseInt(current.count_events || 0),
      open_events: parseInt(current.open_events),
      unprocessed_events: parseInt(current.unprocessed_events),
      critical_events: parseInt(current.critical_events),
      high_events: parseInt(current.high_events),
      ai_analyzed_events: parseInt(current.ai_analyzed_events),
      avg_severity: parseFloat(current.avg_severity || 0).toFixed(2),
      monitored_hosts_count: parseInt(current.monitored_hosts_count || 0),
      total_trend: parseFloat(totalTrend),
      blocked_trend: parseFloat(blockedTrend),
      critical_trend: parseFloat(criticalTrend),
      ai_analysis_rate: parseFloat(aiAnalysisRate),
      blocked_rate: parseFloat(blockedRate)
    };
  }

  static async getSeverityDistribution(): Promise<Array<{ severity: number | null; severity_label: string; count: number; percentage: number }>> {
    const totalResult = await query('SELECT COUNT(*) as total FROM waf_log');
    const total = parseInt(totalResult.rows[0].total);

    const result = await query(`
      SELECT
        severity_rating as severity,
        COUNT(*) as count
      FROM waf_log
      GROUP BY severity_rating
      ORDER BY severity_rating DESC NULLS LAST
    `);

    const severityLabels: { [key: string]: string } = {
      '5': 'Critical',
      '4': 'High',
      '3': 'Medium',
      '2': 'Low',
      '1': 'Info',
      '0': 'Safe',
      'null': 'Unprocessed'
    };

    return result.rows.map(row => {
      const severity = row.severity === null ? null : parseInt(row.severity);
      const severityKey = row.severity === null ? 'null' : row.severity.toString();
      
      return {
        severity: severity,
        severity_label: severityLabels[severityKey] || 'Unknown',
        count: parseInt(row.count),
        percentage: total > 0 ? (parseInt(row.count) / total * 100) : 0
      };
    });
  }

  static async getTrends(hours: number = 24): Promise<any[]> {
    const result = await query(`
      SELECT
        DATE_TRUNC('hour', created_at) as timestamp,
        COUNT(*) as total,
        COUNT(CASE WHEN action = 'BLOCK' THEN 1 END) as blocked,
        COUNT(CASE WHEN action = 'ALLOW' THEN 1 END) as allowed,
        COUNT(CASE WHEN action = 'COUNT' THEN 1 END) as count,
        COUNT(CASE WHEN severity_rating = 5 THEN 1 END) as critical,
        COUNT(CASE WHEN severity_rating = 4 THEN 1 END) as high,
        COUNT(CASE WHEN severity_rating = 3 THEN 1 END) as medium,
        COUNT(CASE WHEN severity_rating IN (1, 2) THEN 1 END) as low
      FROM waf_log
      WHERE created_at >= NOW() - INTERVAL '${hours} hours'
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY DATE_TRUNC('hour', created_at) ASC
    `);

    return result.rows.map(row => ({
      timestamp: row.timestamp,
      time: row.timestamp, // Will be formatted on frontend in user's timezone
      total: parseInt(row.total),
      blocked: parseInt(row.blocked),
      allowed: parseInt(row.allowed),
      count: parseInt(row.count || 0),
      critical: parseInt(row.critical),
      high: parseInt(row.high),
      medium: parseInt(row.medium),
      low: parseInt(row.low)
    }));
  }

  static async getTopSources(limit: number = 10): Promise<any[]> {
    const result = await query(`
      SELECT
        source_ip,
        country,
        COUNT(*) as count,
        COUNT(CASE WHEN action = 'BLOCK' THEN 1 END) as blocked_count,
        COUNT(CASE WHEN action = 'ALLOW' THEN 1 END) as allowed_count,
        MAX(created_at) as last_seen
      FROM waf_log
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY source_ip, country
      HAVING COUNT(CASE WHEN action = 'BLOCK' THEN 1 END) > 0
      ORDER BY 
        blocked_count DESC,
        MAX(created_at) DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      source_ip: row.source_ip,
      country: row.country,
      country_code: null, // TODO: Add country_code to database
      count: parseInt(row.count),
      blocked_count: parseInt(row.blocked_count),
      allowed_count: parseInt(row.allowed_count)
    }));
  }

  static async getTopURIs(limit: number = 10): Promise<any[]> {
    const result = await query(`
      SELECT
        uri,
        COUNT(*) as count,
        COUNT(CASE WHEN action = 'BLOCK' THEN 1 END) as blocked_count,
        COUNT(CASE WHEN action = 'ALLOW' THEN 1 END) as allowed_count
      FROM waf_log
      WHERE uri IS NOT NULL AND uri != ''
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY uri
      ORDER BY blocked_count DESC, count DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      uri: row.uri,
      count: parseInt(row.count),
      blocked_count: parseInt(row.blocked_count),
      allowed_count: parseInt(row.allowed_count)
    }));
  }

  static async getRecentEvents(limit: number = 5): Promise<WafLog[]> {
    const result = await query(`
      SELECT * FROM waf_log
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  static async bulkDelete(ids: number[]): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        const result = await query(
          'DELETE FROM waf_log WHERE id = $1 RETURNING id',
          [id]
        );
        if (result.rowCount && result.rowCount > 0) {
          deleted++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to delete event ${id}:`, error);
        failed++;
      }
    }

    return { deleted, failed };
  }

  // Cleanup methods
  static async countAll(): Promise<number> {
    const result = await query('SELECT COUNT(*) as total FROM waf_log');
    return parseInt(result.rows[0].total);
  }

  static async countOlderThan(days: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as total FROM waf_log
       WHERE created_at < NOW() - INTERVAL '${days} days'`
    );
    return parseInt(result.rows[0].total);
  }

  static async deleteAll(): Promise<{ deleted: number }> {
    try {
      const result = await query('DELETE FROM waf_log RETURNING id');
      return { deleted: result.rowCount || 0 };
    } catch (error) {
      console.error('Failed to delete all events:', error);
      throw error;
    }
  }

  static async deleteOlderThan(days: number): Promise<{ deleted: number }> {
    try {
      const result = await query(
        `DELETE FROM waf_log
         WHERE created_at < NOW() - INTERVAL '${days} days'
         RETURNING id`
      );
      return { deleted: result.rowCount || 0 };
    } catch (error) {
      console.error(`Failed to delete events older than ${days} days:`, error);
      throw error;
    }
  }

  // Agent-specific methods for AgentCore Gateway integration

  /**
   * Find unprocessed events for security analysis
   */
  static async findUnprocessed(limit: number = 10): Promise<WafLog[]> {
    const result = await query(
      `SELECT * FROM waf_log
       WHERE processed = FALSE
         AND severity_rating IS NULL
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Find severity 3 events for monitoring (last N hours)
   */
  static async findSeverity3Events(hours: number = 24): Promise<WafLog[]> {
    const result = await query(
      `SELECT * FROM waf_log
       WHERE severity_rating = 3
         AND status = 'open'
         AND timestamp >= NOW() - INTERVAL '${hours} hours'
       ORDER BY timestamp DESC`
    );
    return result.rows;
  }

  /**
   * Update event with analysis results
   */
  static async updateAnalysis(
    id: number,
    severityRating: number,
    securityAnalysis: string,
    followUpSuggestion: string,
    status: string,
    analyzedBy: string
  ): Promise<WafLog | null> {
    const result = await query(
      `UPDATE waf_log
       SET severity_rating = $1,
           security_analysis = $2,
           follow_up_suggestion = $3,
           status = $4,
           processed = TRUE,
           analyzed_at = CURRENT_TIMESTAMP,
           analyzed_by = $5
       WHERE id = $6
       RETURNING *`,
      [severityRating, securityAnalysis, followUpSuggestion, status, analyzedBy, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update event status
   */
  static async updateStatus(id: number, status: string): Promise<WafLog | null> {
    const result = await query(
      `UPDATE waf_log
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0] || null;
  }

  // Smart Analysis Methods

  /**
   * Find unlinked open events by source IP (DEPRECATED - use findUnlinkedOpenEventsByIPAndTimeGroup)
   */
  static async findUnlinkedOpenEvents(source_ip: string, limit: number = 50): Promise<WafLog[]> {
    const result = await query(
      `SELECT * FROM waf_log
       WHERE status = 'open'
         AND smart_analysis_task_id IS NULL
         AND source_ip = $1
       ORDER BY timestamp ASC
       LIMIT $2`,
      [source_ip, limit]
    );
    return result.rows;
  }

  /**
   * Find unlinked open events by source IP and time group (minute precision)
   * Returns ALL events for the IP+time group (no limit)
   */
  static async findUnlinkedOpenEventsByIPAndTimeGroup(source_ip: string, time_group: string): Promise<WafLog[]> {
    // Parse time_group format YYYYMMDD-HHMM back to timestamp range
    const year = parseInt(time_group.substring(0, 4));
    const month = parseInt(time_group.substring(4, 6));
    const day = parseInt(time_group.substring(6, 8));
    const hour = parseInt(time_group.substring(9, 11));
    const minute = parseInt(time_group.substring(11, 13));

    const result = await query(
      `SELECT * FROM waf_log
       WHERE status = 'open'
         AND smart_analysis_task_id IS NULL
         AND source_ip = $1
         AND DATE_TRUNC('minute', timestamp) = TO_TIMESTAMP($2, 'YYYY-MM-DD HH24:MI:SS')
       ORDER BY timestamp ASC`,
      [
        source_ip,
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
      ]
    );
    return result.rows;
  }

  /**
   * Get distinct source IPs with open unlinked events (DEPRECATED - use getIPTimeGroupsWithOpenUnlinkedEvents)
   */
  static async getDistinctSourceIPsWithOpenUnlinkedEvents(): Promise<Array<{ source_ip: string; country: string; count: number }>> {
    const result = await query(`
      SELECT
        source_ip,
        country,
        COUNT(*) as count
      FROM waf_log
      WHERE status = 'open'
        AND smart_analysis_task_id IS NULL
      GROUP BY source_ip, country
      HAVING COUNT(*) > 0
      ORDER BY count DESC
    `);
    return result.rows.map(row => ({
      source_ip: row.source_ip,
      country: row.country || 'Unknown',
      count: parseInt(row.count)
    }));
  }

  /**
   * Get IP+time groups with open unlinked events (minute precision)
   * Groups events by source_ip and minute-truncated timestamp
   * Returns time_group in YYYYMMDD-HHMM format
   */
  static async getIPTimeGroupsWithOpenUnlinkedEvents(): Promise<Array<{
    source_ip: string;
    time_group: string;
    country: string;
    count: number;
    min_timestamp: string;
    max_timestamp: string;
  }>> {
    const result = await query(`
      SELECT
        source_ip,
        TO_CHAR(DATE_TRUNC('minute', timestamp), 'YYYYMMDD-HH24MI') as time_group,
        MAX(country) as country,
        COUNT(*) as count,
        MIN(timestamp) as min_timestamp,
        MAX(timestamp) as max_timestamp
      FROM waf_log
      WHERE status = 'open'
        AND smart_analysis_task_id IS NULL
      GROUP BY source_ip, DATE_TRUNC('minute', timestamp)
      HAVING COUNT(*) > 0
      ORDER BY min_timestamp DESC
    `);
    return result.rows.map(row => ({
      source_ip: row.source_ip,
      time_group: row.time_group,
      country: row.country || 'Unknown',
      count: parseInt(row.count),
      min_timestamp: row.min_timestamp,
      max_timestamp: row.max_timestamp
    }));
  }

  /**
   * Update event with smart analysis task ID
   */
  static async linkToSmartAnalysisTask(id: number, smart_analysis_task_id: number): Promise<WafLog | null> {
    const result = await query(
      `UPDATE waf_log
       SET smart_analysis_task_id = $1
       WHERE id = $2
       RETURNING *`,
      [smart_analysis_task_id, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Bulk update events with analysis results from smart analysis
   */
  static async bulkUpdateFromSmartAnalysis(
    event_ids: number[],
    severity_rating: number,
    security_analysis: string,
    follow_up_suggestion: string,
    status: string,
    analyzed_by: string
  ): Promise<number> {
    if (event_ids.length === 0) return 0;

    const result = await query(
      `UPDATE waf_log
       SET severity_rating = $1,
           security_analysis = $2,
           follow_up_suggestion = $3,
           status = $4,
           processed = TRUE,
           analyzed_at = CURRENT_TIMESTAMP,
           analyzed_by = $5
       WHERE id = ANY($6::integer[])
       RETURNING id`,
      [severity_rating, security_analysis, follow_up_suggestion, status, analyzed_by, event_ids]
    );
    return result.rowCount || 0;
  }
}

// Export alias for cleaner imports in controllers
export const WafLog = WafLogModel;
