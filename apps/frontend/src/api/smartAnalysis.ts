import apiClient from './client';
import type {
  SmartAnalysisTask,
  SmartAnalysisStats,
  SmartTaskFilters,
  SeverityDistribution
} from '../types';

const BASE_URL = '/smart-analysis';

export interface SmartAnalysisResponse {
  success: boolean;
  data: SmartAnalysisTask[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SingleSmartAnalysisResponse {
  success: boolean;
  data: SmartAnalysisTask;
}

export interface SmartAnalysisStatsResponse {
  success: boolean;
  data: SmartAnalysisStats;
}

export interface GenerateTasksResponse {
  success: boolean;
  data: {
    tasks_created: number;
    events_linked: number;
    source_ips_processed: string[];
  };
  message: string;
}

export interface LinkedEventsResponse {
  success: boolean;
  data: any[];
  count: number;
}

/**
 * Fetch smart analysis tasks with filters and pagination
 */
export const fetchSmartAnalysisTasks = async (
  filters: SmartTaskFilters = {}
): Promise<SmartAnalysisResponse> => {
  const params = new URLSearchParams();

  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.status) params.append('status', filters.status);
  if (filters.severity !== undefined) params.append('severity', filters.severity.toString());
  if (filters.source_ip) params.append('source_ip', filters.source_ip);
  if (filters.date_from) params.append('date_from', filters.date_from);
  if (filters.date_to) params.append('date_to', filters.date_to);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

  const response = await apiClient.get(`${BASE_URL}?${params.toString()}`);
  return response.data;
};

/**
 * Fetch single smart analysis task by ID
 */
export const fetchSmartAnalysisTaskById = async (
  id: number
): Promise<SingleSmartAnalysisResponse> => {
  const response = await apiClient.get(`${BASE_URL}/${id}`);
  return response.data;
};

/**
 * Fetch linked events for a smart analysis task
 */
export const fetchLinkedEvents = async (
  taskId: number
): Promise<LinkedEventsResponse> => {
  const response = await apiClient.get(`${BASE_URL}/${taskId}/events`);
  return response.data;
};

/**
 * Generate smart review tasks from unlinked open events
 */
export const generateReviewTasks = async (): Promise<GenerateTasksResponse> => {
  const response = await apiClient.post(`${BASE_URL}/generate`);
  return response.data;
};

/**
 * Generate smart review tasks AND automatically queue them for analysis
 */
export const generateAndQueueReviewTasks = async (): Promise<{
  success: boolean;
  data: {
    tasks_created: number;
    jobs_created: number;
    events_linked: number;
    source_ips_processed: string[];
  };
  message: string;
}> => {
  const response = await apiClient.post(`${BASE_URL}/generate-and-queue`);
  return response.data;
};

/**
 * Create analysis job for a task (queue for AI analysis)
 */
export const createAnalysisJob = async (
  taskId: number,
  priority: number = 0
): Promise<any> => {
  const response = await apiClient.post(`${BASE_URL}/${taskId}/analyze`, { priority });
  return response.data;
};

/**
 * Update smart analysis task
 */
export const updateSmartTask = async (
  taskId: number,
  updates: Partial<SmartAnalysisTask>
): Promise<SingleSmartAnalysisResponse> => {
  const response = await apiClient.put(`${BASE_URL}/${taskId}`, updates);
  return response.data;
};

/**
 * Delete smart analysis task
 */
export const deleteSmartTask = async (taskId: number): Promise<any> => {
  const response = await apiClient.delete(`${BASE_URL}/${taskId}`);
  return response.data;
};

/**
 * Get smart analysis task statistics
 */
export const getSmartTaskStats = async (): Promise<SmartAnalysisStatsResponse> => {
  const response = await apiClient.get(`${BASE_URL}/stats`);
  return response.data;
};

/**
 * Get severity distribution
 */
export const getSeverityDistribution = async (): Promise<{
  success: boolean;
  data: SeverityDistribution[];
}> => {
  const response = await apiClient.get(`${BASE_URL}/severity-distribution`);
  return response.data;
};

/**
 * Clear all smart analysis tasks
 */
export const clearAllTasks = async (): Promise<{
  success: boolean;
  message: string;
  count: number;
}> => {
  const response = await apiClient.delete(`${BASE_URL}/bulk/clear-all`);
  return response.data;
};

/**
 * Clear tasks by status
 */
export const clearTasksByStatus = async (status: string): Promise<{
  success: boolean;
  message: string;
  count: number;
}> => {
  const response = await apiClient.delete(`${BASE_URL}/bulk/clear/${status}`);
  return response.data;
};

export default {
  fetchSmartAnalysisTasks,
  fetchSmartAnalysisTaskById,
  fetchLinkedEvents,
  generateReviewTasks,
  generateAndQueueReviewTasks,
  createAnalysisJob,
  updateSmartTask,
  deleteSmartTask,
  getSmartTaskStats,
  getSeverityDistribution,
  clearAllTasks,
  clearTasksByStatus
};
