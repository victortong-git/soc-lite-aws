import { query } from '../db/connection';
import bcrypt from 'bcrypt';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  full_name?: string;
  email?: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
}

export interface UserResponse {
  id: number;
  username: string;
  full_name?: string;
  email?: string;
  role: string;
  is_active: boolean;
  last_login?: Date;
}

export class UserModel {
  static async findByUsername(username: string): Promise<User | null> {
    const result = await query(
      'SELECT * FROM user_accts WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<User | null> {
    const result = await query(
      'SELECT * FROM user_accts WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updateLastLogin(userId: number): Promise<void> {
    await query(
      'UPDATE user_accts SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  }

  static async createUser(
    username: string,
    password: string,
    full_name?: string,
    email?: string,
    role: string = 'user'
  ): Promise<User> {
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await query(
      `INSERT INTO user_accts (username, password_hash, full_name, email, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [username, password_hash, full_name, email, role]
    );

    return result.rows[0];
  }

  static async getAllUsers(): Promise<UserResponse[]> {
    const result = await query(
      `SELECT id, username, full_name, email, role, is_active, last_login
       FROM user_accts
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  static async getAllUsersWithPagination(
    page: number = 1,
    limit: number = 10,
    search?: string,
    role?: string,
    isActive?: boolean
  ): Promise<{ users: UserResponse[]; total: number }> {
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(
        `(username ILIKE $${paramIndex} OR full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      whereConditions.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (isActive !== undefined) {
      whereConditions.push(`is_active = $${paramIndex}`);
      params.push(isActive);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM user_accts ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const result = await query(
      `SELECT id, username, full_name, email, role, is_active, last_login, created_at
       FROM user_accts
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return { users: result.rows, total };
  }

  static async updateUser(
    userId: number,
    updates: {
      full_name?: string;
      email?: string;
      role?: string;
      is_active?: boolean;
    }
  ): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.full_name !== undefined) {
      fields.push(`full_name = $${paramIndex}`);
      values.push(updates.full_name);
      paramIndex++;
    }

    if (updates.email !== undefined) {
      fields.push(`email = $${paramIndex}`);
      values.push(updates.email);
      paramIndex++;
    }

    if (updates.role !== undefined) {
      fields.push(`role = $${paramIndex}`);
      values.push(updates.role);
      paramIndex++;
    }

    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex}`);
      values.push(updates.is_active);
      paramIndex++;
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(userId);

    const result = await query(
      `UPDATE user_accts
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  static async deleteUser(userId: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM user_accts WHERE id = $1',
      [userId]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async resetPassword(userId: number, newPassword: string): Promise<boolean> {
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(newPassword, saltRounds);

    const result = await query(
      'UPDATE user_accts SET password_hash = $1 WHERE id = $2',
      [password_hash, userId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  static async checkUsernameExists(username: string, excludeUserId?: number): Promise<boolean> {
    let queryText = 'SELECT COUNT(*) FROM user_accts WHERE username = $1';
    const params: any[] = [username];

    if (excludeUserId) {
      queryText += ' AND id != $2';
      params.push(excludeUserId);
    }

    const result = await query(queryText, params);
    return parseInt(result.rows[0].count) > 0;
  }

  static sanitizeUser(user: User): UserResponse {
    const { password_hash, created_at, updated_at, ...sanitized } = user;
    return sanitized;
  }
}
