import { Router } from 'express';
import * as blocklistController from '../controllers/blocklistController';

const router = Router();

// Get blocklist statistics
router.get('/stats', blocklistController.getBlocklistStats);

// Sync database with WAF
router.post('/sync', blocklistController.syncWithWAF);

// Get all blocklist IPs (with filters and pagination)
router.get('/', blocklistController.getAllBlocklistIps);

// Get single blocklist IP by ID
router.get('/:id', blocklistController.getBlocklistIpById);

// Create new blocklist IP
router.post('/', blocklistController.createBlocklistIp);

// Update blocklist IP
router.put('/:id', blocklistController.updateBlocklistIp);

// Delete blocklist IP
router.delete('/:id', blocklistController.deleteBlocklistIp);

export default router;
