import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import type { WafLog } from '../types';
import apiClient from '../api/client';
import { EventHeaderAndInfo } from '../components/events/EventHeaderAndInfo';
import { EventSidebarActions } from '../components/events/EventSidebarActions';
import { EventTimeline, type TimelineEntry } from '../components/events/EventTimeline';
import { EventAIAnalysisDisplay } from '../components/events/EventAIAnalysisDisplay';
import { EventMetadataGrid } from '../components/events/EventMetadataGrid';
import { EventSmartTaskLink } from '../components/events/EventSmartTaskLink';

export const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<WafLog | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [analysisJobStatus, setAnalysisJobStatus] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isFetchingJobStatus, setIsFetchingJobStatus] = useState(false);

  useEffect(() => {
    fetchEventDetail();
    fetchTimeline();
  }, [id]);

  const fetchEventDetail = async (skipJobStatusCheck = false) => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/events/${id}`);

      if (response.data.success) {
        const eventData = response.data.data;
        setEvent(eventData);

        // Check if event has no analysis, then fetch job status
        // Skip if we're already in the process of checking job status to prevent infinite loop
        if (!skipJobStatusCheck && !eventData.security_analysis && !eventData.ai_analysis && !isFetchingJobStatus) {
          fetchAnalysisJobStatus();
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch event:', err);
      setError(err.response?.data?.error || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysisJobStatus = async () => {
    // Prevent concurrent calls and infinite loops
    if (isFetchingJobStatus) return;

    try {
      setIsFetchingJobStatus(true);
      const response = await apiClient.get(`/events/${id}/analysis-job`);

      if (response.data.success && response.data.data) {
        const job = response.data.data;
        setAnalysisJobStatus(job.status);

        // If job is completed, refresh event data to get analysis
        // Pass skipJobStatusCheck=true to prevent infinite loop
        if (job.status === 'completed') {
          await fetchEventDetail(true);
          setAnalysisJobStatus(null);
        }
      }
    } catch (err: any) {
      // 404 means no job exists - that's okay
      if (err.response?.status !== 404) {
        console.error('Failed to fetch analysis job status:', err);
      }
      setAnalysisJobStatus(null);
    } finally {
      setIsFetchingJobStatus(false);
    }
  };

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        fetchEventDetail(),
        fetchTimeline(),
        fetchAnalysisJobStatus()
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      setTimelineLoading(true);
      const response = await apiClient.get(`/events/${id}/timeline`);

      if (response.data.success) {
        setTimeline(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch timeline:', err);
      // Don't set error state for timeline - just log it
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!event) return;

    try {
      setAnalyzing(true);
      setError('');
      const response = await apiClient.post(`/events/${event.id}/analyze`, {});

      if (response.data.success) {
        const jobData = response.data.data;
        setAnalysisJobStatus(jobData.status || 'pending');

        // Refresh timeline to show new analysis entry
        await fetchTimeline();
      }
    } catch (err: any) {
      console.error('Failed to analyze event:', err);
      setError(err.response?.data?.error || 'Failed to analyze event');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!event) return;

    try {
      const response = await apiClient.put(`/events/${event.id}`, {
        status: newStatus
      });

      if (response.data.success) {
        setEvent(response.data.data);
        // Refresh timeline to show status change
        await fetchTimeline();
      }
    } catch (err: any) {
      console.error('Failed to update status:', err);
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDeleteTimelineEntry = async (entryId: number) => {
    try {
      const response = await apiClient.delete(`/events/${id}/timeline/${entryId}`);

      if (response.data.success) {
        // Refresh timeline after deletion
        await fetchTimeline();
      }
    } catch (err: any) {
      console.error('Failed to delete timeline entry:', err);
      setError(err.response?.data?.error || 'Failed to delete timeline entry');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-2" />
            <p className="text-theme-text-secondary">Loading event details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !event) {
    return (
      <Layout>
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-700 rounded-lg p-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error || 'Event not found'}</span>
            </div>
          </div>
          <Button onClick={() => navigate('/events')} variant="secondary">
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-theme-text">Event Details</h1>
          <div className="flex items-center gap-2">
            <Button onClick={handleManualRefresh} variant="secondary" size="sm" loading={refreshing}>
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button onClick={() => navigate('/events')} variant="secondary">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Events</span>
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-700 rounded-lg p-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Event Header */}
        <EventHeaderAndInfo
          event={event}
          onStatusChange={handleStatusChange}
        />

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Analysis Display */}
            <EventAIAnalysisDisplay event={event} analysisJobStatus={analysisJobStatus} />

            {/* Event Metadata Grid */}
            <EventMetadataGrid event={event} />
          </div>

          {/* Sidebar (1/3 width) */}
          <div className="space-y-6">
            {/* Smart Task Link */}
            <EventSmartTaskLink event={event} />

            {/* Actions */}
            <EventSidebarActions
              event={event}
              onAnalyze={handleAnalyze}
              analyzing={analyzing}
              analysisJobStatus={analysisJobStatus}
            />

            {/* Timeline */}
            <EventTimeline
              timeline={timeline}
              loading={timelineLoading}
              onDeleteEntry={handleDeleteTimelineEntry}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};
