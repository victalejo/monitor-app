import express from 'express';
import {
  reportMetrics,
  reportServiceStatus,
  reportLogs,
  heartbeat,
} from '../controllers/agentController.js';
import { authenticateAgent } from '../middleware/auth.js';

const router = express.Router();

// All routes require agent API key authentication
router.use(authenticateAgent);

router.post('/metrics', reportMetrics);
router.post('/services', reportServiceStatus);
router.post('/logs', reportLogs);
router.post('/heartbeat', heartbeat);

export default router;
