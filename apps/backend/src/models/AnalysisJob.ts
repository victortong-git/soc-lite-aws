import { query } from '../db/connection';

export interface AnalysisJob {
  id: number;
  event_id: number;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'on_hold';
  priority: number;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  attempts: number;
  max_attempts: number;
  severity_rating?: number;
  security_analysis?: string;
  follow_up_suggestion?: string;
  triage_result?: any;
  error_message?: string;
  last_error?: string;
  security_agent_session_id?: string;
  triage_agent_session_id?: string;
  processing_duration_ms?: number;
  paused_at?: Date;
}

export interface JobStats {
  pending: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

export interface JobListParams {
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class AnalysisJobModel {
  /**
   * Create a new analysis job for an event
   */
  static async create(eventId: number, priority: number = 0): Promise<AnalysisJob> {
    // Check if job already exists for this event
    const existing = await query(
      'SELECT * FROM analysis_jobs WHERE event_id = $1',
      [eventId]
    );

    if (existing.rows.length > 0) {
      // If job exists and is not completed/failed, return it
      const existingJob = existing.rows[0];
      if (!['completed', 'failed'].includes(existingJob.status)) {
        return existingJob;
      }
      // If completed/failed, delete and create new one
      await query('DELETE FROM analysis_jobs WHERE id = $1', [existingJob.id]);
    }

    const result = await query(
      `INSERT INTO analysis_jobs (event_id, status, priority)
       VALUES ($1, 'pending', $2)
       RETURNING *`,
      [eventId, priority]
    );

    return result.rows[0];
  }

  /**
   * Find job by ID
   */
  static async findById(id: number): Promise<AnalysisJob | null> {
    const result = await query(
      'SELECT * FROM analysis_jobs WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find job by event ID
   */
  static async findByEventId(eventId: number): Promise<AnalysisJob | null> {
    const result = await query(
      'SELECT * FROM analysis_jobs WHERE event_id = $1',
      [eventId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get next pending job (FIFO with priority)
   */
  static async getNextPending(): Promise<AnalysisJob | null> {
    const result = await query(
      `UPDATE analysis_jobs
       SET status = 'queued'
       WHERE id = (
         SELECT id FROM analysis_jobs
         WHERE status = 'pending' AND attempts < max_attempts
         ORDER BY priority DESC, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`
    );

    return result.rows[0] || null;
  }

  /**
   * Update job status
   */
  static async updateStatus(
    id: number,
    status: string,
    data: Partial<AnalysisJob> = {}
  ): Promise<AnalysisJob | null> {
    const updates: string[] = ['status = $2'];
    const values: any[] = [id, status];
    let paramCount = 2;

    // Add optional fields
    const optionalFields: (keyof AnalysisJob)[] = [
      'started_at',
      'completed_at',
      'attempts',
      'severity_rating',
      'security_analysis',
      'follow_up_suggestion',
      'triage_result',
      'error_message',
      'last_error',
      'security_agent_session_id',
      'triage_agent_session_id',
      'processing_duration_ms'
    ];

    optionalFields.forEach(field => {
      if (data[field] !== undefined) {
        paramCount++;
        if (field === 'triage_result') {
          updates.push(`${field} = $${paramCount}::jsonb`);
          values.push(JSON.stringify(data[field]));
        } else {
          updates.push(`${field} = $${paramCount}`);
          values.push(data[field]);
        }
      }
    });

    const result = await query(
      `UPDATE analysis_jobs
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Count jobs by status
   */
  static async countByStatus(status: string): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) as count FROM analysis_jobs WHERE status = $1',
      [status]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Get job statistics
   */
  static async getStats(): Promise<JobStats> {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'queued') as queued,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) as total
      FROM analysis_jobs
    `);

    const row = result.rows[0];
    return {
      pending: parseInt(row.pending),
      queued: parseInt(row.queued),
      running: parseInt(row.running),
      completed: parseInt(row.completed),
      failed: parseInt(row.failed),
      total: parseInt(row.total)
    };
  }

  /**
   * List jobs with pagination
   */
  static async findAll(params: JobListParams = {}): Promise<{
    data: AnalysisJob[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 50,
      status,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = params;

    const offset = (page - 1) * limit;
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereConditions.push(`status = $${paramCount}`);
      queryParams.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const allowedSortColumns = ['id', 'created_at', 'started_at', 'completed_at', 'status', 'priority'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM analysis_jobs ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data - use separate params array to avoid conflicts
    const dataParams = [...queryParams, limit, offset];
    const limitParam = paramCount + 1;
    const offsetParam = paramCount + 2;

    const dataResult = await query(
      `SELECT * FROM analysis_jobs ${whereClause}
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
   * Delete a job (only if not running)
   */
  static async delete(id: number): Promise<boolean> {
    const result = await query(
      `DELETE FROM analysis_jobs
       WHERE id = $1 AND status != 'running'
       RETURNING id`,
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Increment attempt counter
   */
  static async incrementAttempts(id: number): Promise<void> {
    await query(
      'UPDATE analysis_jobs SET attempts = attempts + 1 WHERE id = $1',
      [id]
    );
  }

  /**
   * Get running jobs count
   */
  static async getRunningCount(): Promise<number> {
    return await this.countByStatus('running');
  }

  /**
   * Clean up old completed/failed jobs (older than 7 days)
   */
  static async cleanup(daysOld: number = 7): Promise<number> {
    const result = await query(
      `DELETE FROM analysis_jobs
       WHERE status IN ('completed', 'failed')
         AND completed_at < NOW() - INTERVAL '${daysOld} days'
       RETURNING id`
    );
    return result.rowCount || 0;
  }

  /**
   * Bulk set all pending jobs to on_hold (pause queue)
   */
  static async bulkSetOnHold(): Promise<number> {
    const result = await query(
      `UPDATE analysis_jobs
       SET status = 'on_hold', paused_at = NOW()
       WHERE status = 'pending'
       RETURNING id`
    );
    return result.rowCount || 0;
  }

  /**
   * Bulk resume all on_hold jobs back to pending
   */
  static async bulkResume(): Promise<number> {
    const result = await query(
      `UPDATE analysis_jobs
       SET status = 'pending', paused_at = NULL
       WHERE status = 'on_hold'
       RETURNING id`
    );
    return result.rowCount || 0;
  }

  /**
   * Bulk delete jobs by status
   */
  static async bulkDeleteByStatus(status: string): Promise<number> {
    // Don't allow deleting running jobs
    if (status === 'running') {
      return 0;
    }

    const result = await query(
      `DELETE FROM analysis_jobs
       WHERE status = $1
       RETURNING id`,
      [status]
    );
    return result.rowCount || 0;
  }

  /**
   * Bulk delete all non-running jobs
   */
  static async bulkDeleteAll(): Promise<number> {
    const result = await query(
      `DELETE FROM analysis_jobs
       WHERE status != 'running'
       RETURNING id`
    );
    return result.rowCount || 0;
  }

  /**
   * Retry a failed job (reset attempts and set to pending)
   */
  static async retryJob(id: number): Promise<AnalysisJob | null> {
    const result = await query(
      `UPDATE analysis_jobs
       SET status = 'pending',
           attempts = 0,
           error_message = NULL,
           last_error = NULL,
           started_at = NULL,
           completed_at = NULL
       WHERE id = $1 AND status = 'failed'
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Cancel a pending/queued/on_hold job
   */
  static async cancelJob(id: number): Promise<boolean> {
    const result = await query(
      `DELETE FROM analysis_jobs
       WHERE id = $1 AND status IN ('pending', 'queued', 'on_hold')
       RETURNING id`,
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Reset a stuck running job (force-fail if stuck > 5 minutes)
   */
  static async resetStuckJob(id: number): Promise<AnalysisJob | null> {
    const result = await query(
      `UPDATE analysis_jobs
       SET status = 'failed',
           completed_at = NOW(),
           error_message = 'Job manually reset - was stuck in running status',
           last_error = 'Manual reset by user'
       WHERE id = $1
         AND status = 'running'
         AND started_at < NOW() - INTERVAL '5 minutes'
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }
}
