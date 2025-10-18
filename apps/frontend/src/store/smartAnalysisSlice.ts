import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type {
  SmartAnalysisTask,
  SmartAnalysisStats,
  SmartTaskFilters,
  SeverityDistribution
} from '../types';
import smartAnalysisService from '../api/smartAnalysis';

interface SmartAnalysisState {
  tasks: SmartAnalysisTask[];
  selectedTask: SmartAnalysisTask | null;
  linkedEvents: any[];
  isLoading: boolean;
  isLoadingEvents: boolean;
  error: string | null;
  filters: SmartTaskFilters;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats: SmartAnalysisStats | null;
  severityDistribution: SeverityDistribution[];
}

const initialState: SmartAnalysisState = {
  tasks: [],
  selectedTask: null,
  linkedEvents: [],
  isLoading: false,
  isLoadingEvents: false,
  error: null,
  filters: {},
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 50,
    hasNext: false,
    hasPrev: false,
  },
  stats: null,
  severityDistribution: [],
};

// Async thunks
export const fetchSmartAnalysisTasks = createAsyncThunk(
  'smartAnalysis/fetchTasks',
  async (filters: SmartTaskFilters = {}) => {
    const response = await smartAnalysisService.fetchSmartAnalysisTasks(filters);
    return response;
  }
);

export const fetchSmartAnalysisTaskById = createAsyncThunk(
  'smartAnalysis/fetchTaskById',
  async (id: number) => {
    const response = await smartAnalysisService.fetchSmartAnalysisTaskById(id);
    return response.data;
  }
);

export const fetchLinkedEvents = createAsyncThunk(
  'smartAnalysis/fetchLinkedEvents',
  async (taskId: number) => {
    const response = await smartAnalysisService.fetchLinkedEvents(taskId);
    return response.data;
  }
);

export const generateReviewTasks = createAsyncThunk(
  'smartAnalysis/generateReviewTasks',
  async () => {
    const response = await smartAnalysisService.generateReviewTasks();
    return response;
  }
);

export const generateAndQueueReviewTasks = createAsyncThunk(
  'smartAnalysis/generateAndQueueReviewTasks',
  async () => {
    const response = await smartAnalysisService.generateAndQueueReviewTasks();
    return response;
  }
);

export const createAnalysisJob = createAsyncThunk(
  'smartAnalysis/createAnalysisJob',
  async ({ taskId, priority = 0 }: { taskId: number; priority?: number }) => {
    const response = await smartAnalysisService.createAnalysisJob(taskId, priority);
    return response;
  }
);

export const updateSmartTask = createAsyncThunk(
  'smartAnalysis/updateTask',
  async ({ taskId, updates }: { taskId: number; updates: Partial<SmartAnalysisTask> }) => {
    const response = await smartAnalysisService.updateSmartTask(taskId, updates);
    return response.data;
  }
);

export const deleteSmartTask = createAsyncThunk(
  'smartAnalysis/deleteTask',
  async (taskId: number) => {
    await smartAnalysisService.deleteSmartTask(taskId);
    return taskId;
  }
);

export const fetchSmartTaskStats = createAsyncThunk(
  'smartAnalysis/fetchStats',
  async () => {
    const response = await smartAnalysisService.getSmartTaskStats();
    return response.data;
  }
);

export const fetchSeverityDistribution = createAsyncThunk(
  'smartAnalysis/fetchSeverityDistribution',
  async () => {
    const response = await smartAnalysisService.getSeverityDistribution();
    return response.data;
  }
);

const smartAnalysisSlice = createSlice({
  name: 'smartAnalysis',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<SmartTaskFilters>) => {
      state.filters = action.payload;
      state.pagination.currentPage = 1;
    },
    clearError: (state) => {
      state.error = null;
    },
    setPagination: (state, action: PayloadAction<{ page: number; limit: number }>) => {
      state.pagination.currentPage = action.payload.page;
      state.pagination.itemsPerPage = action.payload.limit;
    },
    clearSelectedTask: (state) => {
      state.selectedTask = null;
      state.linkedEvents = [];
    },
  },
  extraReducers: (builder) => {
    // Fetch tasks
    builder
      .addCase(fetchSmartAnalysisTasks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSmartAnalysisTasks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasks = action.payload.data;
        if (action.payload.pagination) {
          const { page, limit, total, totalPages } = action.payload.pagination;
          state.pagination = {
            currentPage: page,
            totalPages,
            totalItems: total,
            itemsPerPage: limit,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          };
        }
      })
      .addCase(fetchSmartAnalysisTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch tasks';
      });

    // Fetch single task
    builder
      .addCase(fetchSmartAnalysisTaskById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSmartAnalysisTaskById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedTask = action.payload;

        // Update in tasks list if present
        const index = state.tasks.findIndex(task => task.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
      })
      .addCase(fetchSmartAnalysisTaskById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch task';
      });

    // Fetch linked events
    builder
      .addCase(fetchLinkedEvents.pending, (state) => {
        state.isLoadingEvents = true;
        state.error = null;
      })
      .addCase(fetchLinkedEvents.fulfilled, (state, action) => {
        state.isLoadingEvents = false;
        state.linkedEvents = action.payload;
      })
      .addCase(fetchLinkedEvents.rejected, (state, action) => {
        state.isLoadingEvents = false;
        state.error = action.error.message || 'Failed to fetch linked events';
      });

    // Generate review tasks
    builder
      .addCase(generateReviewTasks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(generateReviewTasks.fulfilled, (state) => {
        state.isLoading = false;
        // Tasks will be refreshed by calling fetchSmartAnalysisTasks
      })
      .addCase(generateReviewTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to generate review tasks';
      });

    // Generate and queue review tasks
    builder
      .addCase(generateAndQueueReviewTasks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(generateAndQueueReviewTasks.fulfilled, (state) => {
        state.isLoading = false;
        // Tasks will be refreshed by calling fetchSmartAnalysisTasks
      })
      .addCase(generateAndQueueReviewTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to generate and queue review tasks';
      });

    // Update task
    builder
      .addCase(updateSmartTask.fulfilled, (state, action) => {
        const index = state.tasks.findIndex(task => task.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
        if (state.selectedTask?.id === action.payload.id) {
          state.selectedTask = action.payload;
        }
      });

    // Delete task
    builder
      .addCase(deleteSmartTask.fulfilled, (state, action) => {
        state.tasks = state.tasks.filter(task => task.id !== action.payload);
        if (state.selectedTask?.id === action.payload) {
          state.selectedTask = null;
          state.linkedEvents = [];
        }
        state.pagination.totalItems -= 1;
      });

    // Fetch stats
    builder
      .addCase(fetchSmartTaskStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      });

    // Fetch severity distribution
    builder
      .addCase(fetchSeverityDistribution.fulfilled, (state, action) => {
        state.severityDistribution = action.payload;
      });
  },
});

export const {
  setFilters,
  clearError,
  setPagination,
  clearSelectedTask,
} = smartAnalysisSlice.actions;

export default smartAnalysisSlice.reducer;
