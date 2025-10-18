import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type {
  SmartAnalysisJob,
  SmartJobStats,
  SmartJobFilters
} from '../types';
import smartAnalysisJobsService from '../api/smartAnalysisJobs';

interface SmartAnalysisJobsState {
  jobs: SmartAnalysisJob[];
  selectedJob: SmartAnalysisJob | null;
  isLoading: boolean;
  error: string | null;
  filters: SmartJobFilters;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats: SmartJobStats | null;
}

const initialState: SmartAnalysisJobsState = {
  jobs: [],
  selectedJob: null,
  isLoading: false,
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
};

// Async thunks
export const fetchSmartAnalysisJobs = createAsyncThunk(
  'smartAnalysisJobs/fetchJobs',
  async (filters: SmartJobFilters = {}) => {
    const response = await smartAnalysisJobsService.fetchJobs(filters);
    return response;
  }
);

export const fetchSmartAnalysisJobById = createAsyncThunk(
  'smartAnalysisJobs/fetchJobById',
  async (id: number) => {
    const response = await smartAnalysisJobsService.fetchJobById(id);
    return response.data;
  }
);

export const fetchSmartAnalysisJobByTaskId = createAsyncThunk(
  'smartAnalysisJobs/fetchJobByTaskId',
  async (taskId: number) => {
    const response = await smartAnalysisJobsService.fetchJobByTaskId(taskId);
    return response.data;
  }
);

export const fetchSmartJobStats = createAsyncThunk(
  'smartAnalysisJobs/fetchStats',
  async () => {
    const response = await smartAnalysisJobsService.getJobStats();
    return response.data;
  }
);

export const pauseSmartJobs = createAsyncThunk(
  'smartAnalysisJobs/pauseJobs',
  async () => {
    const response = await smartAnalysisJobsService.pauseJobs();
    return response;
  }
);

export const resumeSmartJobs = createAsyncThunk(
  'smartAnalysisJobs/resumeJobs',
  async () => {
    const response = await smartAnalysisJobsService.resumeJobs();
    return response;
  }
);

export const clearCompletedJobs = createAsyncThunk(
  'smartAnalysisJobs/clearCompleted',
  async () => {
    const response = await smartAnalysisJobsService.clearCompleted();
    return response;
  }
);

export const clearFailedJobs = createAsyncThunk(
  'smartAnalysisJobs/clearFailed',
  async () => {
    const response = await smartAnalysisJobsService.clearFailed();
    return response;
  }
);

export const clearAllJobs = createAsyncThunk(
  'smartAnalysisJobs/clearAll',
  async () => {
    const response = await smartAnalysisJobsService.clearAll();
    return response;
  }
);

export const retrySmartJob = createAsyncThunk(
  'smartAnalysisJobs/retryJob',
  async (jobId: number) => {
    const response = await smartAnalysisJobsService.retryJob(jobId);
    return response.data;
  }
);

export const cancelSmartJob = createAsyncThunk(
  'smartAnalysisJobs/cancelJob',
  async (jobId: number) => {
    await smartAnalysisJobsService.cancelJob(jobId);
    return jobId;
  }
);

const smartAnalysisJobsSlice = createSlice({
  name: 'smartAnalysisJobs',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<SmartJobFilters>) => {
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
    clearSelectedJob: (state) => {
      state.selectedJob = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch jobs
    builder
      .addCase(fetchSmartAnalysisJobs.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSmartAnalysisJobs.fulfilled, (state, action) => {
        state.isLoading = false;
        state.jobs = action.payload.data;
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
      .addCase(fetchSmartAnalysisJobs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch jobs';
      });

    // Fetch single job
    builder
      .addCase(fetchSmartAnalysisJobById.fulfilled, (state, action) => {
        state.selectedJob = action.payload;

        // Update in jobs list if present
        const index = state.jobs.findIndex(job => job.id === action.payload.id);
        if (index !== -1) {
          state.jobs[index] = action.payload;
        }
      });

    // Fetch job by task ID
    builder
      .addCase(fetchSmartAnalysisJobByTaskId.fulfilled, (state, action) => {
        state.selectedJob = action.payload;
      });

    // Fetch stats
    builder
      .addCase(fetchSmartJobStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      });

    // Retry job
    builder
      .addCase(retrySmartJob.fulfilled, (state, action) => {
        const index = state.jobs.findIndex(job => job.id === action.payload.id);
        if (index !== -1) {
          state.jobs[index] = action.payload;
        }
        if (state.selectedJob?.id === action.payload.id) {
          state.selectedJob = action.payload;
        }
      });

    // Cancel job
    builder
      .addCase(cancelSmartJob.fulfilled, (state, action) => {
        state.jobs = state.jobs.filter(job => job.id !== action.payload);
        if (state.selectedJob?.id === action.payload) {
          state.selectedJob = null;
        }
      });

    // Bulk operations - refresh jobs list after completion
    builder
      .addCase(pauseSmartJobs.fulfilled, () => {
        // Jobs will be refreshed by calling fetchSmartAnalysisJobs
      })
      .addCase(resumeSmartJobs.fulfilled, () => {
        // Jobs will be refreshed by calling fetchSmartAnalysisJobs
      })
      .addCase(clearCompletedJobs.fulfilled, () => {
        // Jobs will be refreshed by calling fetchSmartAnalysisJobs
      })
      .addCase(clearFailedJobs.fulfilled, () => {
        // Jobs will be refreshed by calling fetchSmartAnalysisJobs
      })
      .addCase(clearAllJobs.fulfilled, () => {
        // Jobs will be refreshed by calling fetchSmartAnalysisJobs
      });
  },
});

export const {
  setFilters,
  clearError,
  setPagination,
  clearSelectedJob,
} = smartAnalysisJobsSlice.actions;

export default smartAnalysisJobsSlice.reducer;
