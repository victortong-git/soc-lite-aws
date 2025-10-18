import apiClient from './client';
import type { User, PaginatedResponse } from '../types';

const BASE_URL = '/users';

export interface CreateUserRequest {
  username: string;
  password: string;
  full_name?: string;
  email?: string;
  role?: string;
}

export interface UpdateUserRequest {
  full_name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
}

export interface ResetPasswordRequest {
  new_password: string;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  is_active?: boolean;
}

export const getUsers = async (filters?: UserFilters): Promise<PaginatedResponse<User>> => {
  const params = new URLSearchParams();

  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.search) params.append('search', filters.search);
  if (filters?.role) params.append('role', filters.role);
  if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());

  const response = await apiClient.get(`${BASE_URL}?${params.toString()}`);
  return response.data;
};

export const getUserById = async (id: number): Promise<User> => {
  const response = await apiClient.get(`${BASE_URL}/${id}`);
  return response.data.data;
};

export const createUser = async (data: CreateUserRequest): Promise<User> => {
  const response = await apiClient.post(BASE_URL, data);
  return response.data.data;
};

export const updateUser = async (id: number, data: UpdateUserRequest): Promise<User> => {
  const response = await apiClient.put(`${BASE_URL}/${id}`, data);
  return response.data.data;
};

export const deleteUser = async (id: number): Promise<void> => {
  await apiClient.delete(`${BASE_URL}/${id}`);
};

export const resetUserPassword = async (id: number, newPassword: string): Promise<void> => {
  await apiClient.post(`${BASE_URL}/${id}/reset-password`, { new_password: newPassword });
};
