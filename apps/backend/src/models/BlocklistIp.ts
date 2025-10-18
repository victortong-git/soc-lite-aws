import { query } from '../db/connection';

export interface BlocklistIp {
  id: number;
  ip_address: string;
  reason?: string;
  severity: number;
  source_escalation_id?: number | null;
  source_waf_event_id?: number | null;
  created_at: Date;
  last_seen_at: Date;
  block_count: number;
  is_active: boolean;
  removed_at?: Date;
  updated_at: Date;
}

export interface BlocklistIpListParams {
  page?: number;
  limit?: number;
  is_active?: boolean;
  severity?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class BlocklistIpModel {
  /**
   * Find all blocklist IPs with filtering and pagination
   */
  static async findAll(params: BlocklistIpListParams = {}): Promise<{
    data: BlocklistIp[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 50,
      is_active,
      severity,
      date_from,
      date_to,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = params;

    const offset = (page - 1) * limit;
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramCount = 0;

    // Active status filter
    if (is_active !== undefined) {
      paramCount++;
      whereConditions.push(`is_active = $${paramCount}`);
      queryParams.push(is_active);
    }

    // Severity filter
    if (severity !== undefined) {
      paramCount++;
      whereConditions.push(`severity = $${paramCount}`);
      queryParams.push(severity);
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

    // Search filter (IP address or reason)
    if (search) {
      paramCount++;
      whereConditions.push(`(ip_address ILIKE $${paramCount} OR reason ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const allowedSortColumns = ['id', 'ip_address', 'created_at', 'last_seen_at', 'block_count', 'severity'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM blocklist_ip ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data
    const dataParams = [...queryParams, limit, offset];
    const limitParam = paramCount + 1;
    const offsetParam = paramCount + 2;

    const dataResult = await query(
      `SELECT * FROM blocklist_ip
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
   * Find blocklist IP by ID
   */
  static async findById(id: number): Promise<BlocklistIp | null> {
    const result = await query(
      'SELECT * FROM blocklist_ip WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find blocklist IP by IP address
   */
  static async findByIpAddress(ipAddress: string): Promise<BlocklistIp | null> {
    const result = await query(
      'SELECT * FROM blocklist_ip WHERE ip_address = $1',
      [ipAddress]
    );
    return result.rows[0] || null;
  }

  /**
   * Create new blocklist IP record
   */
  static async create(blocklistIp: Partial<BlocklistIp>): Promise<BlocklistIp> {
    const {
      ip_address,
      reason,
      severity,
      source_escalation_id,
      source_waf_event_id
    } = blocklistIp;

    const result = await query(
      `INSERT INTO blocklist_ip (
        ip_address, reason, severity, source_escalation_id, source_waf_event_id
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        ip_address,
        reason || null,
        severity,
        source_escalation_id || null,
        source_waf_event_id || null
      ]
    );

    return result.rows[0];
  }

  /**
   * Update blocklist IP record
   */
  static async update(id: number, updates: Partial<BlocklistIp>): Promise<BlocklistIp | null> {
    const allowedFields = [
      'reason', 'severity', 'is_active', 'removed_at'
    ];

    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key as keyof BlocklistIp] !== undefined) {
        paramCount++;
        setClause.push(`${key} = $${paramCount}`);
        values.push(updates[key as keyof BlocklistIp]);
      }
    });

    if (setClause.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE blocklist_ip
       SET ${setClause.join(', ')}
       WHERE id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Update last seen timestamp and increment block count
   */
  static async updateLastSeen(ipAddress: string): Promise<BlocklistIp | null> {
    const result = await query(
      `UPDATE blocklist_ip
       SET last_seen_at = CURRENT_TIMESTAMP,
           block_count = block_count + 1
       WHERE ip_address = $1
       RETURNING *`,
      [ipAddress]
    );
    return result.rows[0] || null;
  }

  /**
   * Mark IP as inactive (removed from WAF)
   */
  static async markInactive(id: number): Promise<BlocklistIp | null> {
    const result = await query(
      `UPDATE blocklist_ip
       SET is_active = FALSE,
           removed_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Mark IP as active (added back to WAF)
   */
  static async markActive(id: number): Promise<BlocklistIp | null> {
    const result = await query(
      `UPDATE blocklist_ip
       SET is_active = TRUE,
           removed_at = NULL
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete blocklist IP record
   */
  static async delete(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM blocklist_ip WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get statistics for blocklist IPs
   */
  static async getStats(): Promise<any> {
    const result = await query(`
      SELECT
        COUNT(*) as total_blocked_ips,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_blocks,
        COUNT(CASE WHEN is_active = FALSE THEN 1 END) as removed_blocks,
        SUM(block_count) as total_block_events,
        COUNT(CASE WHEN severity = 5 THEN 1 END) as critical_severity_ips,
        COUNT(CASE WHEN severity = 4 THEN 1 END) as high_severity_ips,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as blocked_last_24h,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as blocked_last_7d,
        MAX(block_count) as max_repeat_offender,
        AVG(block_count) as avg_block_count
      FROM blocklist_ip
    `);

    const stats = result.rows[0];

    // Get top repeat offenders
    const topOffenders = await query(`
      SELECT ip_address, block_count, severity, last_seen_at
      FROM blocklist_ip
      WHERE is_active = TRUE
      ORDER BY block_count DESC
      LIMIT 10
    `);

    return {
      total_blocked_ips: parseInt(stats.total_blocked_ips),
      active_blocks: parseInt(stats.active_blocks),
      removed_blocks: parseInt(stats.removed_blocks),
      total_block_events: parseInt(stats.total_block_events || 0),
      critical_severity_ips: parseInt(stats.critical_severity_ips),
      high_severity_ips: parseInt(stats.high_severity_ips),
      blocked_last_24h: parseInt(stats.blocked_last_24h),
      blocked_last_7d: parseInt(stats.blocked_last_7d),
      max_repeat_offender: parseInt(stats.max_repeat_offender || 0),
      avg_block_count: parseFloat(stats.avg_block_count || 0).toFixed(2),
      top_repeat_offenders: topOffenders.rows
    };
  }

  /**
   * Get all active IPs (for WAF sync)
   */
  static async getActiveIps(): Promise<string[]> {
    const result = await query(
      'SELECT ip_address FROM blocklist_ip WHERE is_active = TRUE ORDER BY ip_address'
    );
    return result.rows.map(row => row.ip_address);
  }

  /**
   * Find blocklist IPs by escalation ID
   */
  static async findByEscalationId(escalationId: number): Promise<BlocklistIp[]> {
    const result = await query(
      `SELECT * FROM blocklist_ip
       WHERE source_escalation_id = $1
       ORDER BY created_at DESC`,
      [escalationId]
    );
    return result.rows;
  }

  /**
   * Find blocklist IPs by WAF event ID
   */
  static async findByWafEventId(wafEventId: number): Promise<BlocklistIp[]> {
    const result = await query(
      `SELECT * FROM blocklist_ip
       WHERE source_waf_event_id = $1
       ORDER BY created_at DESC`,
      [wafEventId]
    );
    return result.rows;
  }
}

// Export alias for cleaner imports
export const BlocklistIp = BlocklistIpModel;
