import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SmartAnalysisTaskModel, SmartAnalysisTaskListParams } from '../models/SmartAnalysisTask';
import { SmartAnalysisEventLinkModel } from '../models/SmartAnalysisEventLink';
import * as smartAnalysisService from '../services/smartAnalysisService';

/**
 * Get all smart analysis tasks with pagination and filters
 */
export const getSmartAnalysisTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '50',
      status,
      severity,
      source_ip,
      date_from,
      date_to,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const params: SmartAnalysisTaskListParams = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as string,
      severity: severity as string | number,
      source_ip: source_ip as string,
      date_from: date_from as string,
      date_to: date_to as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc'
    };

    const result = await SmartAnalysisTaskModel.findAll(params);

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
    console.error('Get smart analysis tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch smart analysis tasks' });
  }
};

/**
 * Get smart analysis task by ID
 */
export const getSmartAnalysisTaskById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const taskId = parseInt(id);

    if (isNaN(taskId)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const task = await SmartAnalysisTaskModel.findById(taskId);

    if (!task) {
      res.status(404).json({ error: 'Smart analysis task not found' });
      return;
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Get smart analysis task by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch smart analysis task' });
  }
};

/**
 * Get linked events for a smart analysis task
 */
export const getLinkedEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const taskId = parseInt(id);

    if (isNaN(taskId)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    // Verify task exists
    const task = await SmartAnalysisTaskModel.findById(taskId);
    if (!task) {
      res.status(404).json({ error: 'Smart analysis task not found' });
      return;
    }

    // Get all linked events
    const events = await SmartAnalysisEventLinkModel.getEventsByTaskId(taskId);

    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('Get linked events error:', error);
    res.status(500).json({ error: 'Failed to fetch linked events' });
  }
};

/**
 * Generate smart review tasks from unlinked open events
 * Groups events by source IP + time (minute precision), no record limit
 */
export const generateSmartReviewTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('Generating smart review tasks...');

    const result = await smartAnalysisService.generateReviewTasks();

    res.json({
      success: true,
      data: result,
      message: `Generated ${result.tasks_created} task(s), linked ${result.events_linked} event(s)`
    });
  } catch (error) {
    console.error('Generate smart review tasks error:', error);
    res.status(500).json({ error: 'Failed to generate smart review tasks' });
  }
};

/**
 * Generate smart review tasks AND automatically queue them for analysis
 * Groups events by source IP + time (minute precision), then auto-creates jobs
 */
export const generateAndQueueSmartReviewTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('Generating smart review tasks and auto-queuing for analysis...');

    const result = await smartAnalysisService.generateAndQueueReviewTasks();

    res.json({
      success: true,
      data: result,
      message: `Generated ${result.tasks_created} task(s), created ${result.jobs_created} job(s), linked ${result.events_linked} event(s)`
    });
  } catch (error) {
    console.error('Generate and queue smart review tasks error:', error);
    res.status(500).json({ error: 'Failed to generate and queue smart review tasks' });
  }
};

/**
 * Create analysis job for a smart task (queue for bulk AI analysis)
 */
export const createSmartAnalysisJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const taskId = parseInt(id);

    if (isNaN(taskId)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    // Verify task exists
    const task = await SmartAnalysisTaskModel.findById(taskId);
    if (!task) {
      res.status(404).json({ error: 'Smart analysis task not found' });
      return;
    }

    // Get priority from request body (optional)
    const { priority = 0 } = req.body;

    // Create job
    const job = await smartAnalysisService.createAnalysisJob(taskId, priority);

    res.status(201).json({
      success: true,
      data: job,
      message: 'Analysis job created and queued for processing'
    });
  } catch (error) {
    console.error('Create smart analysis job error:', error);
    res.status(500).json({ error: 'Failed to create analysis job' });
  }
};

/**
 * Update smart analysis task
 */
export const updateSmartTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const taskId = parseInt(id);

    if (isNaN(taskId)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const updates = req.body;

    const updatedTask = await SmartAnalysisTaskModel.update(taskId, updates);

    if (!updatedTask) {
      res.status(404).json({ error: 'Smart analysis task not found' });
      return;
    }

    res.json({
      success: true,
      data: updatedTask,
      message: 'Smart analysis task updated successfully'
    });
  } catch (error) {
    console.error('Update smart task error:', error);
    res.status(500).json({ error: 'Failed to update smart analysis task' });
  }
};

/**
 * Delete smart analysis task
 */
export const deleteSmartTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const taskId = parseInt(id);

    if (isNaN(taskId)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const deleted = await SmartAnalysisTaskModel.delete(taskId);

    if (!deleted) {
      res.status(404).json({ error: 'Smart analysis task not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Smart analysis task deleted successfully'
    });
  } catch (error) {
    console.error('Delete smart task error:', error);
    res.status(500).json({ error: 'Failed to delete smart analysis task' });
  }
};

/**
 * Get smart analysis task statistics
 */
export const getSmartTaskStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await SmartAnalysisTaskModel.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get smart task stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

/**
 * Get severity distribution for smart analysis tasks
 */
export const getSmartTaskSeverityDistribution = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const distribution = await SmartAnalysisTaskModel.getSeverityDistribution();

    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    console.error('Get severity distribution error:', error);
    res.status(500).json({ error: 'Failed to fetch severity distribution' });
  }
};

/**
 * Bulk clear all tasks
 */
export const bulkClearAllTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await SmartAnalysisTaskModel.bulkDeleteAll();

    res.json({
      success: true,
      message: `${count} task(s) cleared`,
      count
    });
  } catch (error) {
    console.error('Bulk clear all tasks error:', error);
    res.status(500).json({ error: 'Failed to clear all tasks' });
  }
};

/**
 * Bulk clear tasks by status
 */
export const bulkClearTasksByStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.params;

    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    const count = await SmartAnalysisTaskModel.bulkDeleteByStatus(status);

    res.json({
      success: true,
      message: `${count} ${status} task(s) cleared`,
      count
    });
  } catch (error) {
    console.error('Bulk clear tasks by status error:', error);
    res.status(500).json({ error: 'Failed to clear tasks' });
  }
};
