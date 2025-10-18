import apiClient from './client';
import type {
  SmartAnalysisJob,
  SmartJobStats,
  SmartJobFilters
} from '../types';

const BASE_URL = '/smart-analysis-jobs';

export interface SmartJobsResponse {
  success: boolean;
  data: SmartAnalysisJob[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SingleSmartJobResponse {
  success: boolean;
  data: SmartAnalysisJob;
}

export interface SmartJobStatsResponse {
  success: boolean;
  data: SmartJobStats;
}

export interface BulkJobResponse {
  success: boolean;
  message: string;
  count: number;
}

/**
 * Fetch smart analysis jobs with filters and pagination
 */
export const fetchJobs = async (
  filters: SmartJobFilters = {}
): Promise<SmartJobsResponse> => {
  const params = new URLSearchParams();

  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.status) params.append('status', filters.status);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

  const response = await apiClient.get(`${BASE_URL}?${params.toString()}`);
  return response.data;
};

/**
 * Fetch job by ID
 */
export const fetchJobById = async (
  id: number
): Promise<SingleSmartJobResponse> => {
  const response = await apiClient.get(`${BASE_URL}/${id}`);
  return response.data;
};

/**
 * Fetch job by task ID
 */
export const fetchJobByTaskId = async (
  taskId: number
): Promise<SingleSmartJobResponse> => {
  const response = await apiClient.get(`${BASE_URL}/task/${taskId}`);
  return response.data;
};

/**
 * Get job statistics
 */
export const getJobStats = async (): Promise<SmartJobStatsResponse> => {
  const response = await apiClient.get(`${BASE_URL}/stats`);
  return response.data;
};

/**
 * Bulk pause all pending jobs
 */
export const pauseJobs = async (): Promise<BulkJobResponse> => {
  const response = await apiClient.put(`${BASE_URL}/bulk/pause`);
  return response.data;
};

/**
 * Bulk resume all on_hold jobs
 */
export const resumeJobs = async (): Promise<BulkJobResponse> => {
  const response = await apiClient.put(`${BASE_URL}/bulk/resume`);
  return response.data;
};

/**
 * Clear completed jobs
 */
export const clearCompleted = async (): Promise<BulkJobResponse> => {
  const response = await apiClient.delete(`${BASE_URL}/bulk/clear-completed`);
  return response.data;
};

/**
 * Clear failed jobs
 */
export const clearFailed = async (): Promise<BulkJobResponse> => {
  const response = await apiClient.delete(`${BASE_URL}/bulk/clear-failed`);
  return response.data;
};

/**
 * Clear all non-running jobs
 */
export const clearAll = async (): Promise<BulkJobResponse> => {
  const response = await apiClient.delete(`${BASE_URL}/bulk/clear-all`);
  return response.data;
};

/**
 * Retry a failed job
 */
export const retryJob = async (jobId: number): Promise<SingleSmartJobResponse> => {
  const response = await apiClient.put(`${BASE_URL}/${jobId}/retry`);
  return response.data;
};

/**
 * Cancel a pending/queued/on_hold job
 */
export const cancelJob = async (jobId: number): Promise<any> => {
  const response = await apiClient.delete(`${BASE_URL}/${jobId}/cancel`);
  return response.data;
};

/**
 * Delete/cancel a job
 */
export const deleteJob = async (jobId: number): Promise<any> => {
  const response = await apiClient.delete(`${BASE_URL}/${jobId}`);
  return response.data;
};

export default {
  fetchJobs,
  fetchJobById,
  fetchJobByTaskId,
  getJobStats,
  pauseJobs,
  resumeJobs,
  clearCompleted,
  clearFailed,
  clearAll,
  retryJob,
  cancelJob,
  deleteJob
};
