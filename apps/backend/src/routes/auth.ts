import { Router } from 'express';
import { login, logout, me, refreshToken } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const router = Router();

router.post('/login', asyncHandler(login));

router.post('/logout', authenticate, asyncHandler(logout));

router.get('/me', authenticate, asyncHandler(me));

router.post('/refresh', authenticate, asyncHandler(refreshToken));

export default router;
