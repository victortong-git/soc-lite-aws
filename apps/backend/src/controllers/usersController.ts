import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserModel } from '../models/User';

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const isActive = req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined;

    const { users, total } = await UserModel.getAllUsersWithPagination(
      page,
      limit,
      search,
      role,
      isActive
    );

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const user = await UserModel.findById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const sanitizedUser = UserModel.sanitizeUser(user);
    res.json({ success: true, data: sanitizedUser });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, password, full_name, email, role } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Check if username already exists
    const exists = await UserModel.checkUsernameExists(username);
    if (exists) {
      res.status(400).json({ error: 'Username already exists' });
      return;
    }

    // Validate role
    const validRoles = ['admin', 'user', 'analyst'];
    if (role && !validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const newUser = await UserModel.createUser(
      username,
      password,
      full_name,
      email,
      role || 'user'
    );

    const sanitizedUser = UserModel.sanitizeUser(newUser);
    res.status(201).json({
      success: true,
      data: sanitizedUser,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const { full_name, email, role, is_active } = req.body;

    // Validate role if provided
    if (role) {
      const validRoles = ['admin', 'user', 'analyst'];
      if (!validRoles.includes(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }
    }

    // Prevent user from deactivating themselves
    if (is_active === false && req.user?.userId === userId) {
      res.status(400).json({ error: 'You cannot deactivate your own account' });
      return;
    }

    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;

    const updatedUser = await UserModel.updateUser(userId, updates);

    if (!updatedUser) {
      res.status(404).json({ error: 'User not found or no changes made' });
      return;
    }

    const sanitizedUser = UserModel.sanitizeUser(updatedUser);
    res.json({
      success: true,
      data: sanitizedUser,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Prevent user from deleting themselves
    if (req.user?.userId === userId) {
      res.status(400).json({ error: 'You cannot delete your own account' });
      return;
    }

    const deleted = await UserModel.deleteUser(userId);

    if (!deleted) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

export const resetUserPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);
    const { new_password } = req.body;

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    if (!new_password || new_password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long' });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const success = await UserModel.resetPassword(userId, new_password);

    if (!success) {
      res.status(500).json({ error: 'Failed to reset password' });
      return;
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};
