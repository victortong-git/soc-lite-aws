import { Request, Response } from 'express';
import { AnalysisJobModel } from '../models/AnalysisJob';
import { WafLogModel } from '../models/WafLog';

/**
 * Get all analysis jobs with pagination
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

    const result = await AnalysisJobModel.findAll(params);

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
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis jobs' });
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

    const job = await AnalysisJobModel.findById(jobId);

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
    const stats = await AnalysisJobModel.getStats();

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
 * Create analysis job for an event (Updated endpoint)
 */
export const createAnalysisJob = async (req: Request, res: Response) => {
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

    // Create job
    const job = await AnalysisJobModel.create(eventId);

    res.status(201).json({
      success: true,
      data: job,
      message: 'Analysis job created and queued for processing'
    });
  } catch (error) {
    console.error('Create analysis job error:', error);
    res.status(500).json({ error: 'Failed to create analysis job' });
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

    const deleted = await AnalysisJobModel.delete(jobId);

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
 * Get job by event ID
 */
export const getJobByEventId = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const id = parseInt(eventId);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid event ID' });
      return;
    }

    const job = await AnalysisJobModel.findByEventId(id);

    if (!job) {
      res.status(404).json({ error: 'No job found for this event' });
      return;
    }

    res.json({ success: true, data: job });
  } catch (error) {
    console.error('Get job by event ID error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

/**
 * Bulk pause all pending jobs (set to on_hold)
 */
export const bulkPauseJobs = async (req: Request, res: Response) => {
  try {
    const count = await AnalysisJobModel.bulkSetOnHold();

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
    const count = await AnalysisJobModel.bulkResume();

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
    const count = await AnalysisJobModel.bulkDeleteByStatus('completed');

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
    const count = await AnalysisJobModel.bulkDeleteByStatus('failed');

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
    const count = await AnalysisJobModel.bulkDeleteAll();

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

    const job = await AnalysisJobModel.retryJob(jobId);

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

    const cancelled = await AnalysisJobModel.cancelJob(jobId);

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

/**
 * Reset a stuck running job (force-fail if stuck > 5 minutes)
 */
export const resetStuckJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const job = await AnalysisJobModel.resetStuckJob(jobId);

    if (!job) {
      res.status(404).json({
        error: 'Job not found, not in running status, or has not been running for at least 5 minutes'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Stuck job reset successfully',
      data: job
    });
  } catch (error) {
    console.error('Reset stuck job error:', error);
    res.status(500).json({ error: 'Failed to reset job' });
  }
};
