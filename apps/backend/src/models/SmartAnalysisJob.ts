import { query } from '../db/connection';

export interface SmartAnalysisJob {
  id: number;
  task_id: number;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'on_hold';
  priority: number;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  attempts: number;
  max_attempts: number;
  error_message?: string;
  processing_duration_ms?: number;
}

export interface SmartJobStats {
  pending: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  on_hold: number;
  total: number;
}

export interface SmartJobListParams {
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class SmartAnalysisJobModel {
  /**
   * Create a new job for a task
   */
  static async create(task_id: number, priority: number = 0): Promise<SmartAnalysisJob> {
    // Check if job already exists for this task
    const existing = await query(
      'SELECT * FROM smart_analysis_jobs WHERE task_id = $1',
      [task_id]
    );

    if (existing.rows.length > 0) {
      const existingJob = existing.rows[0];
      // If job exists and is not completed/failed, return it
      if (!['completed', 'failed'].includes(existingJob.status)) {
        return existingJob;
      }
      // If completed/failed, delete and create new one
      await query('DELETE FROM smart_analysis_jobs WHERE id = $1', [existingJob.id]);
    }

    const result = await query(
      `INSERT INTO smart_analysis_jobs (task_id, status, priority)
       VALUES ($1, 'pending', $2)
       RETURNING *`,
      [task_id, priority]
    );

    return result.rows[0];
  }

  /**
   * Find job by ID
   */
  static async findById(id: number): Promise<SmartAnalysisJob | null> {
    const result = await query(
      'SELECT * FROM smart_analysis_jobs WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find job by task ID
   */
  static async findByTaskId(task_id: number): Promise<SmartAnalysisJob | null> {
    const result = await query(
      'SELECT * FROM smart_analysis_jobs WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1',
      [task_id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get next pending job (FIFO with priority)
   * Implements max 2 concurrent job limit check
   */
  static async getNextPending(): Promise<SmartAnalysisJob | null> {
    // First check if we're at max concurrent jobs (2)
    const runningCount = await this.getRunningCount();
    if (runningCount >= 2) {
      console.log('Max concurrent jobs (2) reached, not fetching next pending job');
      return null;
    }

    const result = await query(
      `UPDATE smart_analysis_jobs
       SET status = 'queued'
       WHERE id = (
         SELECT id FROM smart_analysis_jobs
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
    data: Partial<SmartAnalysisJob> = {}
  ): Promise<SmartAnalysisJob | null> {
    const updates: string[] = ['status = $2'];
    const values: any[] = [id, status];
    let paramCount = 2;

    // Add optional fields
    const optionalFields: (keyof SmartAnalysisJob)[] = [
      'started_at',
      'completed_at',
      'attempts',
      'error_message',
      'processing_duration_ms'
    ];

    optionalFields.forEach(field => {
      if (data[field] !== undefined) {
        paramCount++;
        updates.push(`${field} = $${paramCount}`);
        values.push(data[field]);
      }
    });

    const result = await query(
      `UPDATE smart_analysis_jobs
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Increment attempt counter
   */
  static async incrementAttempts(id: number): Promise<void> {
    await query(
      'UPDATE smart_analysis_jobs SET attempts = attempts + 1 WHERE id = $1',
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
   * Count jobs by status
   */
  static async countByStatus(status: string): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) as count FROM smart_analysis_jobs WHERE status = $1',
      [status]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Get job statistics
   */
  static async getStats(): Promise<SmartJobStats> {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'queued') as queued,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold,
        COUNT(*) as total
      FROM smart_analysis_jobs
    `);

    const row = result.rows[0];
    return {
      pending: parseInt(row.pending),
      queued: parseInt(row.queued),
      running: parseInt(row.running),
      completed: parseInt(row.completed),
      failed: parseInt(row.failed),
      on_hold: parseInt(row.on_hold),
      total: parseInt(row.total)
    };
  }

  /**
   * List jobs with pagination
   */
  static async findAll(params: SmartJobListParams = {}): Promise<{
    data: SmartAnalysisJob[];
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
      `SELECT COUNT(*) as total FROM smart_analysis_jobs ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data
    const dataParams = [...queryParams, limit, offset];
    const limitParam = paramCount + 1;
    const offsetParam = paramCount + 2;

    const dataResult = await query(
      `SELECT * FROM smart_analysis_jobs ${whereClause}
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
      `DELETE FROM smart_analysis_jobs
       WHERE id = $1 AND status != 'running'
       RETURNING id`,
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Bulk set all pending jobs to on_hold (pause queue)
   */
  static async bulkSetOnHold(): Promise<number> {
    const result = await query(
      `UPDATE smart_analysis_jobs
       SET status = 'on_hold'
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
      `UPDATE smart_analysis_jobs
       SET status = 'pending'
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
      `DELETE FROM smart_analysis_jobs
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
      `DELETE FROM smart_analysis_jobs
       WHERE status != 'running'
       RETURNING id`
    );
    return result.rowCount || 0;
  }

  /**
   * Retry a failed job (reset attempts and set to pending)
   */
  static async retryJob(id: number): Promise<SmartAnalysisJob | null> {
    const result = await query(
      `UPDATE smart_analysis_jobs
       SET status = 'pending',
           attempts = 0,
           error_message = NULL,
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
      `DELETE FROM smart_analysis_jobs
       WHERE id = $1 AND status IN ('pending', 'queued', 'on_hold')
       RETURNING id`,
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Clean up old completed/failed jobs (older than specified days)
   */
  static async cleanup(daysOld: number = 7): Promise<number> {
    const result = await query(
      `DELETE FROM smart_analysis_jobs
       WHERE status IN ('completed', 'failed')
         AND completed_at < NOW() - INTERVAL '${daysOld} days'
       RETURNING id`
    );
    return result.rowCount || 0;
  }
}

export const SmartAnalysisJob = SmartAnalysisJobModel;
