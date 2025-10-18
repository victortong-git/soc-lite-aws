import { Router } from 'express';
import {
  getJobs,
  getJobById,
  getJobStats,
  getJobByTaskId,
  createJob,
  deleteJob,
  bulkPauseJobs,
  bulkResumeJobs,
  bulkClearCompleted,
  bulkClearFailed,
  bulkClearAll,
  retryJob,
  cancelJob
} from '../controllers/smartAnalysisJobsController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Job management routes
router.get('/', asyncHandler(getJobs));
router.get('/stats', asyncHandler(getJobStats));
router.get('/:id', asyncHandler(getJobById));
router.get('/task/:taskId', asyncHandler(getJobByTaskId));

// Bulk operations (must be before /:id routes)
router.put('/bulk/pause', asyncHandler(bulkPauseJobs));
router.put('/bulk/resume', asyncHandler(bulkResumeJobs));
router.delete('/bulk/clear-completed', asyncHandler(bulkClearCompleted));
router.delete('/bulk/clear-failed', asyncHandler(bulkClearFailed));
router.delete('/bulk/clear-all', asyncHandler(bulkClearAll));

// Individual job operations
router.post('/', asyncHandler(createJob));
router.put('/:id/retry', asyncHandler(retryJob));
router.delete('/:id/cancel', asyncHandler(cancelJob));
router.delete('/:id', asyncHandler(deleteJob));

export default router;
