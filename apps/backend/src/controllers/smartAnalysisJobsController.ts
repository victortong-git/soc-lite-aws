import { Request, Response } from 'express';
import { SmartAnalysisJobModel } from '../models/SmartAnalysisJob';
import { SmartAnalysisTaskModel } from '../models/SmartAnalysisTask';

/**
 * Get all smart analysis jobs with pagination
 */
export const getJobs = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      status,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const params = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc'
    };

    const result = await SmartAnalysisJobModel.findAll(params);

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
    console.error('Get smart analysis jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch smart analysis jobs' });
  }
};

/**
 * Get job by ID
 */
export const getJobById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const job = await SmartAnalysisJobModel.findById(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({ success: true, data: job });
  } catch (error) {
    console.error('Get job by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

/**
 * Get job statistics
 */
export const getJobStats = async (req: Request, res: Response) => {
  try {
    const stats = await SmartAnalysisJobModel.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({ error: 'Failed to fetch job statistics' });
  }
};

/**
 * Get job by task ID
 */
export const getJobByTaskId = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const id = parseInt(taskId);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const job = await SmartAnalysisJobModel.findByTaskId(id);

    if (!job) {
      res.status(404).json({ error: 'No job found for this task' });
      return;
    }

    res.json({ success: true, data: job });
  } catch (error) {
    console.error('Get job by task ID error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

/**
 * Create smart analysis job for a task
 */
export const createJob = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;
    const { priority = 0 } = req.body;

    if (!taskId || isNaN(parseInt(taskId))) {
      res.status(400).json({ error: 'Invalid or missing task ID' });
      return;
    }

    const task_id = parseInt(taskId);

    // Verify task exists
    const task = await SmartAnalysisTaskModel.findById(task_id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Create job
    const job = await SmartAnalysisJobModel.create(task_id, priority);

    res.status(201).json({
      success: true,
      data: job,
      message: 'Smart analysis job created and queued for processing'
    });
  } catch (error) {
    console.error('Create smart analysis job error:', error);
    res.status(500).json({ error: 'Failed to create smart analysis job' });
  }
};

/**
 * Delete/cancel a job
 */
export const deleteJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const deleted = await SmartAnalysisJobModel.delete(jobId);

    if (!deleted) {
      res.status(404).json({ error: 'Job not found or cannot be deleted (may be running)' });
      return;
    }

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
};

/**
 * Bulk pause all pending jobs (set to on_hold)
 */
export const bulkPauseJobs = async (req: Request, res: Response) => {
  try {
    const count = await SmartAnalysisJobModel.bulkSetOnHold();

    res.json({
      success: true,
      message: `${count} job(s) paused`,
      count
    });
  } catch (error) {
    console.error('Bulk pause jobs error:', error);
    res.status(500).json({ error: 'Failed to pause jobs' });
  }
};

/**
 * Bulk resume all on_hold jobs (set back to pending)
 */
export const bulkResumeJobs = async (req: Request, res: Response) => {
  try {
    const count = await SmartAnalysisJobModel.bulkResume();

    res.json({
      success: true,
      message: `${count} job(s) resumed`,
      count
    });
  } catch (error) {
    console.error('Bulk resume jobs error:', error);
    res.status(500).json({ error: 'Failed to resume jobs' });
  }
};

/**
 * Bulk clear completed jobs
 */
export const bulkClearCompleted = async (req: Request, res: Response) => {
  try {
    const count = await SmartAnalysisJobModel.bulkDeleteByStatus('completed');

    res.json({
      success: true,
      message: `${count} completed job(s) cleared`,
      count
    });
  } catch (error) {
    console.error('Bulk clear completed error:', error);
    res.status(500).json({ error: 'Failed to clear completed jobs' });
  }
};

/**
 * Bulk clear failed jobs
 */
export const bulkClearFailed = async (req: Request, res: Response) => {
  try {
    const count = await SmartAnalysisJobModel.bulkDeleteByStatus('failed');

    res.json({
      success: true,
      message: `${count} failed job(s) cleared`,
      count
    });
  } catch (error) {
    console.error('Bulk clear failed error:', error);
    res.status(500).json({ error: 'Failed to clear failed jobs' });
  }
};

/**
 * Bulk clear all non-running jobs
 */
export const bulkClearAll = async (req: Request, res: Response) => {
  try {
    const count = await SmartAnalysisJobModel.bulkDeleteAll();

    res.json({
      success: true,
      message: `${count} job(s) cleared (running jobs preserved)`,
      count
    });
  } catch (error) {
    console.error('Bulk clear all error:', error);
    res.status(500).json({ error: 'Failed to clear jobs' });
  }
};

/**
 * Retry a failed job
 */
export const retryJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const job = await SmartAnalysisJobModel.retryJob(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found or not in failed status' });
      return;
    }

    res.json({
      success: true,
      message: 'Job retry initiated',
      data: job
    });
  } catch (error) {
    console.error('Retry job error:', error);
    res.status(500).json({ error: 'Failed to retry job' });
  }
};

/**
 * Cancel a pending/queued/on_hold job
 */
export const cancelJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const cancelled = await SmartAnalysisJobModel.cancelJob(jobId);

    if (!cancelled) {
      res.status(404).json({ error: 'Job not found or cannot be cancelled (may be running or completed)' });
      return;
    }

    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
};
