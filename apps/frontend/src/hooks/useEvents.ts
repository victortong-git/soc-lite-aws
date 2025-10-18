import { useCallback } from 'react';
import { useAppDispatch } from './useAppDispatch';
import { useAppSelector } from './useAppSelector';
import {
  fetchEvents,
  fetchEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  setPage,
  clearError,
  clearCurrentEvent,
  updateEventAnalysisStatus,
} from '../store/slices/eventsSlice';
import type { WafLog } from '../types';

export const useEvents = () => {
  const dispatch = useAppDispatch();
  const { events, currentEvent, pagination, loading, error } = useAppSelector(
    (state) => state.events
  );

  const loadEvents = useCallback(
    async (params?: Record<string, any>) => {
      return dispatch(fetchEvents(params)).unwrap();
    },
    [dispatch]
  );

  const loadEventById = useCallback(
    async (id: number) => {
      return dispatch(fetchEventById(id)).unwrap();
    },
    [dispatch]
  );

  const addEvent = useCallback(
    async (eventData: Partial<WafLog>) => {
      return dispatch(createEvent(eventData)).unwrap();
    },
    [dispatch]
  );

  const editEvent = useCallback(
    async (id: number, updates: Partial<WafLog>) => {
      return dispatch(updateEvent({ id, updates })).unwrap();
    },
    [dispatch]
  );

  const removeEvent = useCallback(
    async (id: number) => {
      return dispatch(deleteEvent(id)).unwrap();
    },
    [dispatch]
  );

  const updatePage = useCallback(
    (page: number, filterParams?: Record<string, any>) => {
      dispatch(setPage(page));
      // Fetch events for the new page with current filters
      dispatch(fetchEvents({ ...filterParams, page }));
    },
    [dispatch]
  );

  const clearEventsError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  const clearCurrent = useCallback(() => {
    dispatch(clearCurrentEvent());
  }, [dispatch]);

  const updateAnalysisStatus = useCallback(
    (eventId: number, jobId: number, status: string) => {
      dispatch(updateEventAnalysisStatus({ eventId, jobId, status }));
    },
    [dispatch]
  );

  return {
    events,
    currentEvent,
    pagination,
    loading,
    error,
    fetchEvents: loadEvents,
    fetchEventById: loadEventById,
    createEvent: addEvent,
    updateEvent: editEvent,
    deleteEvent: removeEvent,
    setPage: updatePage,
    clearError: clearEventsError,
    clearCurrentEvent: clearCurrent,
    updateEventAnalysisStatus: updateAnalysisStatus,
  };
};
