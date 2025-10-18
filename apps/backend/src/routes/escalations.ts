import express from 'express';
import {
  getAllEscalations,
  getEscalationById,
  getEscalationsByWafEvent,
  getEscalationsBySmartTask,
  createEscalation,
  createCampaignEscalation,
  updateEscalation,
  deleteEscalation,
  getEscalationStats,
  markSNSComplete,
  retrySNS
} from '../controllers/escalationController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get statistics (place before :id routes to avoid conflict)
router.get('/stats', getEscalationStats);

// Get escalations by source
router.get('/by-waf-event/:wafEventId', getEscalationsByWafEvent);
router.get('/by-smart-task/:smartTaskId', getEscalationsBySmartTask);

// CRUD operations
router.get('/', getAllEscalations);
router.get('/:id', getEscalationById);
router.post('/', createEscalation);
router.post('/campaign', createCampaignEscalation);
router.put('/:id', updateEscalation);
router.delete('/:id', deleteEscalation);

// Actions
router.post('/:id/mark-sns-complete', markSNSComplete);
router.post('/:id/retry-sns', retrySNS);

export default router;
