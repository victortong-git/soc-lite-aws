import { Router } from 'express';
import {
  getSmartAnalysisTasks,
  getSmartAnalysisTaskById,
  getLinkedEvents,
  generateSmartReviewTasks,
  generateAndQueueSmartReviewTasks,
  createSmartAnalysisJob,
  updateSmartTask,
  deleteSmartTask,
  getSmartTaskStats,
  getSmartTaskSeverityDistribution,
  bulkClearAllTasks,
  bulkClearTasksByStatus
} from '../controllers/smartAnalysisController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List and search routes
router.get('/', asyncHandler(getSmartAnalysisTasks));

// Statistics routes
router.get('/stats', asyncHandler(getSmartTaskStats));
router.get('/severity-distribution', asyncHandler(getSmartTaskSeverityDistribution));

// Task generation routes (must be before /:id to avoid route conflict)
router.post('/generate', asyncHandler(generateSmartReviewTasks));
router.post('/generate-and-queue', asyncHandler(generateAndQueueSmartReviewTasks));

// Bulk operations (must be before /:id routes)
router.delete('/bulk/clear-all', asyncHandler(bulkClearAllTasks));
router.delete('/bulk/clear/:status', asyncHandler(bulkClearTasksByStatus));

// Individual task routes
router.get('/:id', asyncHandler(getSmartAnalysisTaskById));
router.get('/:id/events', asyncHandler(getLinkedEvents));
router.post('/:id/analyze', asyncHandler(createSmartAnalysisJob));
router.put('/:id', asyncHandler(updateSmartTask));
router.delete('/:id', asyncHandler(deleteSmartTask));

export default router;
