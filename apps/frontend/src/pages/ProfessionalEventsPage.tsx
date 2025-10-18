import React, { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import ProfessionalEventsStatsBar from '../components/events/ProfessionalEventsStatsBar';
import type { EventsStats } from '../components/events/ProfessionalEventsStatsBar';
import EventTrendsChart from '../components/dashboard/EventTrendsChart';
import ProfessionalEventsTable from '../components/events/ProfessionalEventsTable';
import AdvancedFilterPanel from '../components/events/AdvancedFilterPanel';
import type { FilterOptions } from '../components/events/AdvancedFilterPanel';
import { Pagination } from '../components/events/Pagination';
import { EditEventModal } from '../components/events/EditEventModal';
import { DeleteEventModal } from '../components/events/DeleteEventModal';
import { BulkDeleteModal } from '../components/events/BulkDeleteModal';
import { AIAnalysisModal } from '../components/events/AIAnalysisModal';
import { CleanupModal } from '../components/events/CleanupModal';
import { Button } from '../components/ui/Button';
import { RefreshCw, Trash2, Filter, ChevronDown, Search, Database } from 'lucide-react';
import type { WafLog, EventTrendData } from '../types';
import { useEvents } from '../hooks/useEvents';
import { buildFilterParams } from '../utils/filterBuilder';
import apiClient from '../api/client';

export const ProfessionalEventsPage: React.FC = () => {
  const { events, loading, fetchEvents, updateEventAnalysisStatus } = useEvents();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<WafLog | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [analyzingIds, setAnalyzingIds] = useState<Set<number>>(new Set());

  // Stats and trends
  const [stats, setStats] = useState<EventsStats | null>(null);
  const [trendData, setTrendData] = useState<EventTrendData[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);

  // Local filter state - no Redux involvement
  // Default: exclude 'closed' status (show open, investigating, false_positive)
  const [filters, setFilters] = useState<FilterOptions>({
    status: ['open', 'investigating', 'false_positive']
  });
  const [currentFilterParams, setCurrentFilterParams] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchDashboardData();

    // Apply default filter on initial page load (exclude closed)
    const defaultParams = buildFilterParams(filters);
    console.log('🔍 Initial filter state:', filters);
    console.log('🔍 Built filter params:', defaultParams);
    setCurrentFilterParams(defaultParams);
    fetchEvents(defaultParams);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoadingStats(true);
      setLoadingTrends(true);

      // Fetch stats using apiClient (includes auth token automatically)
      const statsResponse = await apiClient.get('/events/stats');

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }

      // Fetch trends data (last 24 hours)
      const trendsResponse = await apiClient.get('/events/trends?hours=24');

      if (trendsResponse.data.success) {
        setTrendData(trendsResponse.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoadingStats(false);
      setLoadingTrends(false);
    }
  };

  const handleEdit = (event: WafLog) => {
    setSelectedEvent(event);
    setIsEditModalOpen(true);
  };

  const handleDelete = (event: WafLog) => {
    setSelectedEvent(event);
    setIsDeleteModalOpen(true);
  };

  const handleAnalyze = async (event: WafLog) => {
    // Add to analyzing set
    setAnalyzingIds(prev => new Set(prev).add(event.id));

    try {
      const response = await apiClient.post(`/events/${event.id}/analyze`, {});

      if (response.data.success) {
        const jobId = response.data.data.jobId;
        const jobStatus = response.data.data.status || 'pending';

        // Optimistically update Redux state to show pending status immediately
        // Worker will pick it up and change to 'queued' → 'running' → 'completed'
        updateEventAnalysisStatus(event.id, jobId, jobStatus);

        // Show success notification
        alert(`Analysis job #${jobId} created successfully! Check the Analysis Jobs page to monitor progress.`);

        // Refresh stats only (don't refresh events to preserve optimistic update)
        await fetchDashboardData();
      }
    } catch (error: any) {
      console.error('Failed to analyze event:', error);
      alert(`Failed to create analysis job: ${error.response?.data?.error || error.message}`);
    } finally {
      // Remove from analyzing set
      setAnalyzingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(event.id);
        return newSet;
      });
    }
  };

  const handleCloseModals = () => {
    setIsEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setIsBulkDeleteModalOpen(false);
    setIsAnalysisModalOpen(false);
    setIsCleanupModalOpen(false);
    setSelectedEvent(null);
  };

  const handleBulkDeleteComplete = () => {
    setSelectedIds([]);
    fetchEvents();
    fetchDashboardData();
  };

  const handleCleanupComplete = () => {
    fetchEvents();
    fetchDashboardData();
  };

  const handleAnalysisComplete = () => {
    fetchEvents();
    fetchDashboardData();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Maintain current filter state when refreshing
    await Promise.all([fetchEvents(currentFilterParams), fetchDashboardData()]);
    setRefreshing(false);
  };

  const handleFiltersChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);

    // Build API-ready filter parameters using utility
    const filterParams = buildFilterParams(newFilters);
    setCurrentFilterParams(filterParams);

    // Fetch events directly with filters
    fetchEvents(filterParams);
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setCurrentFilterParams({});

    // Fetch all events without filters
    fetchEvents({});
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-theme-text">WAF Events</h2>
            <p className="mt-1 text-xs sm:text-sm text-theme-text-secondary">
              Web Application Firewall event monitoring and analysis
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.length > 0 && (
              <Button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                variant="danger"
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete ({selectedIds.length})</span>
              </Button>
            )}
            <Button
              onClick={() => setIsCleanupModalOpen(true)}
              variant="secondary"
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <Database className="w-4 h-4" />
              <span>Cleanup</span>
            </Button>
            <Button onClick={handleRefresh} variant="secondary" size="sm" loading={refreshing} className="flex-1 sm:flex-none">
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <ProfessionalEventsStatsBar stats={stats} loading={loadingStats} />

        {/* Trends Chart - Now visible on mobile */}
        <EventTrendsChart
          data={trendData}
          loading={loadingTrends}
          title="Event Trends by Severity (Last 24 Hours)"
          height={280}
        />

        {/* Search and Filter Controls */}
        <div className="card">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-slate-400" />
                <input
                  type="text"
                  placeholder="Search events..."
                  className="input-field pl-10 pr-4 py-2 w-full text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex items-center justify-center gap-2 text-sm ${showFilters ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : ''}`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="animate-slide-up">
            <AdvancedFilterPanel
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onClearFilters={handleClearFilters}
            />
          </div>
        )}

        {/* Events Table */}
        <ProfessionalEventsTable
          events={events}
          loading={loading}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAnalyze={handleAnalyze}
          analyzingIds={analyzingIds}
        />

        {/* Pagination */}
        <Pagination filterParams={currentFilterParams} />

        {/* Modals */}
        <EditEventModal
          isOpen={isEditModalOpen}
          onClose={handleCloseModals}
          event={selectedEvent}
        />

        <DeleteEventModal
          isOpen={isDeleteModalOpen}
          onClose={handleCloseModals}
          event={selectedEvent}
        />

        <BulkDeleteModal
          isOpen={isBulkDeleteModalOpen}
          onClose={handleCloseModals}
          eventIds={selectedIds}
          onDeleteComplete={handleBulkDeleteComplete}
        />

        <AIAnalysisModal
          isOpen={isAnalysisModalOpen}
          onClose={handleCloseModals}
          event={selectedEvent}
          onAnalysisComplete={handleAnalysisComplete}
        />

        <CleanupModal
          isOpen={isCleanupModalOpen}
          onClose={handleCloseModals}
          onCleanupComplete={handleCleanupComplete}
        />
      </div>
    </Layout>
  );
};

export default ProfessionalEventsPage;
