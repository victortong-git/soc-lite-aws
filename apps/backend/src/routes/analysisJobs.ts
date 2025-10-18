import { Router } from 'express';
import {
  getJobs,
  getJobById,
  getJobStats,
  deleteJob,
  getJobByEventId,
  bulkPauseJobs,
  bulkResumeJobs,
  bulkClearCompleted,
  bulkClearFailed,
  bulkClearAll,
  retryJob,
  cancelJob,
  resetStuckJob
} from '../controllers/analysisJobsController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Job management routes
router.get('/', asyncHandler(getJobs));
router.get('/stats', asyncHandler(getJobStats));
router.get('/:id', asyncHandler(getJobById));
router.get('/event/:eventId', asyncHandler(getJobByEventId));

// Bulk operations (must be before /:id routes)
router.put('/bulk/pause', asyncHandler(bulkPauseJobs));
router.put('/bulk/resume', asyncHandler(bulkResumeJobs));
router.delete('/bulk/clear-completed', asyncHandler(bulkClearCompleted));
router.delete('/bulk/clear-failed', asyncHandler(bulkClearFailed));
router.delete('/bulk/clear-all', asyncHandler(bulkClearAll));

// Individual job operations
router.put('/:id/retry', asyncHandler(retryJob));
router.put('/:id/reset', asyncHandler(resetStuckJob));
router.delete('/:id/cancel', asyncHandler(cancelJob));
router.delete('/:id', asyncHandler(deleteJob));

export default router;
