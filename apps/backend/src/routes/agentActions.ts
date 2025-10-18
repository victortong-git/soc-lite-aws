import { Router } from 'express';
import {
  updateAnalysis,
  sendNotification,
  fetchUnprocessedEvents,
  fetchSeverity3Events,
  updateEventStatus
} from '../controllers/agentActionsController';
import { asyncHandler } from '../middleware/error';

const router = Router();

// These endpoints are designed to be called by AgentCore agents via Gateway
// Authentication is handled by API Gateway + AgentCore Gateway OAuth

// Update event with analysis results
router.post('/update-analysis', asyncHandler(updateAnalysis));

// Send notifications (SNS/Email)
router.post('/send-notification', asyncHandler(sendNotification));

// Fetch unprocessed events for analysis
router.get('/fetch-unprocessed', asyncHandler(fetchUnprocessedEvents));

// Fetch severity 3 events for monitoring
router.get('/fetch-severity3', asyncHandler(fetchSeverity3Events));

// Update event status
router.post('/update-status', asyncHandler(updateEventStatus));

export default router;
