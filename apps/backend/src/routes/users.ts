import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword
} from '../controllers/usersController';
import { authenticate, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

// GET /api/users - List all users with pagination/filtering
router.get('/', asyncHandler(getAllUsers));

// GET /api/users/:id - Get specific user
router.get('/:id', asyncHandler(getUserById));

// POST /api/users - Create new user
router.post('/', asyncHandler(createUser));

// PUT /api/users/:id - Update user
router.put('/:id', asyncHandler(updateUser));

// DELETE /api/users/:id - Delete user
router.delete('/:id', asyncHandler(deleteUser));

// POST /api/users/:id/reset-password - Reset user password (admin only)
router.post('/:id/reset-password', asyncHandler(resetUserPassword));

export default router;
