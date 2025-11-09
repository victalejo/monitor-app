import express from 'express';
import {
  getAllServers,
  getServerById,
  createServer,
  updateServer,
  deleteServer,
  regenerateApiKey,
  getServerMetrics,
} from '../controllers/serverController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', getAllServers);
router.get('/:id', getServerById);
router.get('/:id/metrics', getServerMetrics);
router.post('/', createServer);
router.put('/:id', updateServer);
router.delete('/:id', deleteServer);
router.post('/:id/regenerate-api-key', regenerateApiKey);

export default router;
