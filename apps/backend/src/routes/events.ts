import { Router } from 'express';
import {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventStats,
  getSeverityDistribution,
  analyzeEvent,
  bulkDeleteEvents,
  bulkUpdateEvents,
  getEventTrends,
  getTopSources,
  getTopURIs,
  getRecentEvents,
  getCleanupPreview,
  cleanupAllEvents,
  cleanupOldEvents,
  getAnalysisJobByEventId
} from '../controllers/eventsController';
import {
  getEventTimeline,
  createTimelineEntry,
  deleteTimelineEntry,
  getTimelineCount
} from '../controllers/timelineController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const router = Router();

router.use(authenticate);

// List and search routes
router.get('/', asyncHandler(getEvents));

// Statistics routes
router.get('/stats', asyncHandler(getEventStats));
router.get('/severity-distribution', asyncHandler(getSeverityDistribution));
router.get('/trends', asyncHandler(getEventTrends));
router.get('/top-sources', asyncHandler(getTopSources));
router.get('/top-uris', asyncHandler(getTopURIs));
router.get('/recent', asyncHandler(getRecentEvents));

// Cleanup operations (must be before /:id to avoid route conflict)
router.get('/cleanup/preview', asyncHandler(getCleanupPreview));
router.post('/cleanup/all', asyncHandler(cleanupAllEvents));
router.post('/cleanup/old', asyncHandler(cleanupOldEvents));

// Individual event routes
router.get('/:id', asyncHandler(getEventById));
router.get('/:id/analysis-job', asyncHandler(getAnalysisJobByEventId));
router.post('/:id/analyze', asyncHandler(analyzeEvent));
router.put('/:id', asyncHandler(updateEvent));
router.delete('/:id', asyncHandler(deleteEvent));

// Timeline routes for individual events
router.get('/:id/timeline', asyncHandler(getEventTimeline));
router.post('/:id/timeline', asyncHandler(createTimelineEntry));
router.delete('/:id/timeline/:timelineId', asyncHandler(deleteTimelineEntry));
router.get('/:id/timeline/count', asyncHandler(getTimelineCount));

// Creation and bulk operations
router.post('/', asyncHandler(createEvent));
router.post('/bulk-delete', asyncHandler(bulkDeleteEvents));
router.post('/bulk-update', asyncHandler(bulkUpdateEvents));

export default router;
