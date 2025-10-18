import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import apiClient from '../../api/client';
import type { WafLog, PaginatedResponse } from '../../types';

interface EventsState {
  events: WafLog[];
  currentEvent: WafLog | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  loading: boolean;
  error: string | null;
}

const initialState: EventsState = {
  events: [],
  currentEvent: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  },
  loading: false,
  error: null,
};

// Async thunks
export const fetchEvents = createAsyncThunk<PaginatedResponse<WafLog>, Record<string, any> | undefined>(
  'events/fetchEvents',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { events: EventsState };
      const queryParams = {
        page: params?.page || state.events.pagination.page,
        limit: params?.limit || state.events.pagination.limit,
        sortBy: params?.sortBy || 'created_at',
        sortOrder: params?.sortOrder || 'desc',
        ...params,
      };

      const response = await apiClient.get<PaginatedResponse<WafLog>>('/events', { params: queryParams });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch events');
    }
  }
);

export const fetchEventById = createAsyncThunk<{ success: boolean; data: WafLog }, number>(
  'events/fetchEventById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<{ success: boolean; data: WafLog }>(`/events/${id}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch event');
    }
  }
);

export const createEvent = createAsyncThunk<{ success: boolean; data: WafLog }, Partial<WafLog>>(
  'events/createEvent',
  async (eventData, { rejectWithValue }) => {
    try {
      const response = await apiClient.post<{ success: boolean; data: WafLog }>('/events', eventData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create event');
    }
  }
);

export const updateEvent = createAsyncThunk<
  { success: boolean; data: WafLog },
  { id: number; updates: Partial<WafLog> }
>('events/updateEvent', async ({ id, updates }, { rejectWithValue }) => {
  try {
    const response = await apiClient.put<{ success: boolean; data: WafLog }>(`/events/${id}`, updates);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.error || 'Failed to update event');
  }
});

export const deleteEvent = createAsyncThunk<{ success: boolean; id: number }, number>(
  'events/deleteEvent',
  async (id, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/events/${id}`);
      return { success: true, id };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to delete event');
    }
  }
);

const eventsSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.page = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentEvent: (state) => {
      state.currentEvent = null;
    },
    updateEventAnalysisStatus: (state, action: PayloadAction<{ eventId: number; jobId: number; status: string }>) => {
      const { eventId, jobId, status } = action.payload;
      const eventIndex = state.events.findIndex((e) => e.id === eventId);
      if (eventIndex !== -1) {
        state.events[eventIndex].analysis_job_id = jobId;
        state.events[eventIndex].analysis_job_status = status as 'pending' | 'queued' | 'running' | 'completed' | 'failed';
      }
      if (state.currentEvent && state.currentEvent.id === eventId) {
        state.currentEvent.analysis_job_id = jobId;
        state.currentEvent.analysis_job_status = status as 'pending' | 'queued' | 'running' | 'completed' | 'failed';
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch events
      .addCase(fetchEvents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.loading = false;
        state.events = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch event by ID
      .addCase(fetchEventById.fulfilled, (state, action) => {
        state.currentEvent = action.payload.data;
      })
      // Create event
      .addCase(createEvent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createEvent.fulfilled, (state, action) => {
        state.loading = false;
        state.events.unshift(action.payload.data);
      })
      .addCase(createEvent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update event
      .addCase(updateEvent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateEvent.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.events.findIndex((e) => e.id === action.payload.data.id);
        if (index !== -1) {
          state.events[index] = action.payload.data;
        }
      })
      .addCase(updateEvent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete event
      .addCase(deleteEvent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteEvent.fulfilled, (state, action) => {
        state.loading = false;
        state.events = state.events.filter((e) => e.id !== action.payload.id);
      })
      .addCase(deleteEvent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setPage, clearError, clearCurrentEvent, updateEventAnalysisStatus } = eventsSlice.actions;
export default eventsSlice.reducer;
