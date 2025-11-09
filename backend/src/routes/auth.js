import express from 'express';
import { login, refresh, me, changePassword } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', authenticateToken, me);
router.post('/change-password', authenticateToken, changePassword);

export default router;
