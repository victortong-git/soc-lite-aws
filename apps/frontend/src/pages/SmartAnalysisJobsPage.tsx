import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, PlayCircle, Pause, Play, Trash2, RotateCcw, X, PauseCircle, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../api/client';

interface SmartAnalysisJob {
  id: number;
  task_id: number;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'on_hold';
  priority: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  attempts: number;
  max_attempts: number;
  error_message?: string;
  processing_duration_ms?: number;
  // Additional fields from task for display
  source_ip?: string;
}

interface SmartJobStats {
  pending: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  on_hold: number;
  total: number;
}

const STATUS_ICONS = {
  pending: Clock,
  queued: PlayCircle,
  running: RefreshCw,
  completed: CheckCircle,
  failed: XCircle,
  on_hold: PauseCircle
};

const STATUS_COLORS = {
  pending: 'text-gray-500',
  queued: 'text-blue-500',
  running: 'text-yellow-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
  on_hold: 'text-purple-500'
};

const STATUS_BG = {
  pending: 'bg-gray-100 dark:bg-gray-800',
  queued: 'bg-blue-100 dark:bg-blue-900/30',
  running: 'bg-yellow-100 dark:bg-yellow-900/30',
  completed: 'bg-green-100 dark:bg-green-900/30',
  failed: 'bg-red-100 dark:bg-red-900/30',
  on_hold: 'bg-purple-100 dark:bg-purple-900/30'
};

export const SmartAnalysisJobsPage: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<SmartAnalysisJob[]>([]);
  const [stats, setStats] = useState<SmartJobStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showConfirm, setShowConfirm] = useState<{ action: string; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 50; // Fixed items per page

  useEffect(() => {
    fetchJobs();
    fetchStats();

    // Auto-refresh every 1 minute
    const interval = setInterval(() => {
      fetchJobs();
      fetchStats();
    }, 60000);

    return () => clearInterval(interval);
  }, [statusFilter, currentPage]);

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortBy: 'created_at',
        sortOrder: 'desc'
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await apiClient.get(`/smart-analysis-jobs?${params.toString()}`);

      if (response.data.success) {
        setJobs(response.data.data);
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.totalPages);
          setTotalItems(response.data.pagination.total);
        }
      }
    } catch (error) {
      console.error('Failed to fetch smart analysis jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/smart-analysis-jobs/stats');

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch smart job stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchJobs(), fetchStats()]);
    setRefreshing(false);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Generate page numbers with ellipsis (consistent with EventsPage pagination)
  const generatePageNumbers = (): (number | 'ellipsis')[] => {
    const maxVisiblePages = 7;
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage <= 4) {
        for (let i = 2; i <= Math.min(5, totalPages - 1); i++) {
          pages.push(i);
        }
        if (totalPages > 6) {
          pages.push('ellipsis');
        }
      } else if (currentPage >= totalPages - 3) {
        if (totalPages > 6) {
          pages.push('ellipsis');
        }
        for (let i = Math.max(totalPages - 4, 2); i <= totalPages - 1; i++) {
          pages.push(i);
        }
      } else {
        pages.push('ellipsis');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('ellipsis');
      }

      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handlePauseQueue = async () => {
    setShowConfirm({
      action: 'pause',
      message: 'Pause all pending jobs? They will be set to on-hold status.'
    });
  };

  const handleResumeQueue = async () => {
    setShowConfirm({
      action: 'resume',
      message: 'Resume all on-hold jobs? They will be set back to pending status.'
    });
  };

  const handleClearCompleted = async () => {
    setShowConfirm({
      action: 'clear-completed',
      message: `Clear ${stats?.completed || 0} completed job(s)? This cannot be undone.`
    });
  };

  const handleClearFailed = async () => {
    setShowConfirm({
      action: 'clear-failed',
      message: `Clear ${stats?.failed || 0} failed job(s)? This cannot be undone.`
    });
  };

  const handleClearAll = async () => {
    const nonRunningCount = (stats?.total || 0) - (stats?.running || 0);
    setShowConfirm({
      action: 'clear-all',
      message: `Clear all ${nonRunningCount} non-running job(s)? This cannot be undone. Running jobs will be preserved.`
    });
  };

  const handleRetryJob = async (jobId: number) => {
    try {
      setActionLoading(true);
      const response = await apiClient.put(`/smart-analysis-jobs/${jobId}/retry`);

      if (response.data.success) {
        await Promise.all([fetchJobs(), fetchStats()]);
        alert('Job retry initiated successfully');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to retry job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelJob = async (jobId: number) => {
    if (!window.confirm('Cancel this job? This cannot be undone.')) return;

    try {
      setActionLoading(true);
      const response = await apiClient.delete(`/smart-analysis-jobs/${jobId}/cancel`);

      if (response.data.success) {
        await Promise.all([fetchJobs(), fetchStats()]);
        alert('Job cancelled successfully');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to cancel job');
    } finally {
      setActionLoading(false);
    }
  };

  const executeAction = async () => {
    if (!showConfirm) return;

    try {
      setActionLoading(true);
      let response;

      switch (showConfirm.action) {
        case 'pause':
          response = await apiClient.put('/smart-analysis-jobs/bulk/pause');
          break;
        case 'resume':
          response = await apiClient.put('/smart-analysis-jobs/bulk/resume');
          break;
        case 'clear-completed':
          response = await apiClient.delete('/smart-analysis-jobs/bulk/clear-completed');
          break;
        case 'clear-failed':
          response = await apiClient.delete('/smart-analysis-jobs/bulk/clear-failed');
          break;
        case 'clear-all':
          response = await apiClient.delete('/smart-analysis-jobs/bulk/clear-all');
          break;
      }

      if (response?.data.success) {
        await Promise.all([fetchJobs(), fetchStats()]);
        alert(response.data.message);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Operation failed');
    } finally {
      setActionLoading(false);
      setShowConfirm(null);
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getTimeElapsed = (startTime: string) => {
    const start = new Date(startTime).getTime();
    const now = new Date().getTime();
    const elapsed = now - start;

    if (elapsed < 60000) return `${Math.floor(elapsed / 1000)}s ago`;
    if (elapsed < 3600000) return `${Math.floor(elapsed / 60000)}m ago`;
    return `${Math.floor(elapsed / 3600000)}h ago`;
  };

  const hasPendingJobs = (stats?.pending || 0) > 0;
  const hasOnHoldJobs = (stats?.on_hold || 0) > 0;
  const hasCompletedJobs = (stats?.completed || 0) > 0;
  const hasFailedJobs = (stats?.failed || 0) > 0;

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-theme-text flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              Smart Analysis Jobs
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-theme-text-secondary">
              Bulk AI analysis job queue (Max 2 concurrent)
            </p>
          </div>
          <Button onClick={handleRefresh} variant="secondary" size="sm" loading={refreshing}>
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Bulk Actions Toolbar */}
        <div className="card">
          <div className="flex flex-col gap-3">
            <div className="text-xs sm:text-sm font-medium text-theme-text">Queue Management</div>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <Button
                onClick={handlePauseQueue}
                variant="secondary"
                size="sm"
                disabled={!hasPendingJobs || actionLoading}
              >
                <Pause className="w-4 h-4" />
                Pause Queue
              </Button>
              <Button
                onClick={handleResumeQueue}
                variant="secondary"
                size="sm"
                disabled={!hasOnHoldJobs || actionLoading}
              >
                <Play className="w-4 h-4" />
                Resume Queue
              </Button>
              <div className="hidden sm:block border-l border-gray-300 dark:border-gray-600 mx-2" />
              <Button
                onClick={handleClearCompleted}
                variant="secondary"
                size="sm"
                disabled={!hasCompletedJobs || actionLoading}
              >
                <Trash2 className="w-4 h-4" />
                Clear Completed ({stats?.completed || 0})
              </Button>
              <Button
                onClick={handleClearFailed}
                variant="secondary"
                size="sm"
                disabled={!hasFailedJobs || actionLoading}
              >
                <Trash2 className="w-4 h-4" />
                Clear Failed ({stats?.failed || 0})
              </Button>
              <Button
                onClick={handleClearAll}
                variant="danger"
                size="sm"
                disabled={actionLoading}
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="card">
              <div className="text-sm text-theme-text-secondary">Pending</div>
              <div className="text-2xl font-bold text-gray-500 mt-1">{stats.pending}</div>
            </div>
            <div className="card">
              <div className="text-sm text-theme-text-secondary">Queued</div>
              <div className="text-2xl font-bold text-blue-500 mt-1">{stats.queued}</div>
            </div>
            <div className="card bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <div className="text-sm text-theme-text-secondary">Running</div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                {stats.running} / 2
              </div>
            </div>
            <div className="card">
              <div className="text-sm text-theme-text-secondary">Completed</div>
              <div className="text-2xl font-bold text-green-500 mt-1">{stats.completed}</div>
            </div>
            <div className="card">
              <div className="text-sm text-theme-text-secondary">Failed</div>
              <div className="text-2xl font-bold text-red-500 mt-1">{stats.failed}</div>
            </div>
            <div className="card">
              <div className="text-sm text-theme-text-secondary">Total</div>
              <div className="text-2xl font-bold text-theme-text mt-1">{stats.total}</div>
            </div>
          </div>
        )}

        {/* Queue Warning */}
        {stats && stats.running >= 2 && (
          <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-yellow-800 dark:text-yellow-200">
                Maximum Concurrency Reached
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                2 jobs are currently running. New jobs will be processed when slots become available.
              </div>
            </div>
          </div>
        )}

        {/* Status Filter */}
        <div className="card">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-theme-text hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setStatusFilter('pending');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'pending'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-theme-text hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => {
                setStatusFilter('on_hold');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'on_hold'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-theme-text hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              On Hold
            </button>
            <button
              onClick={() => {
                setStatusFilter('running');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'running'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-theme-text hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Running
            </button>
            <button
              onClick={() => {
                setStatusFilter('completed');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'completed'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-theme-text hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => {
                setStatusFilter('failed');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'failed'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-theme-text hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Failed
            </button>
          </div>
        </div>

        {/* Jobs Table */}
        {loading ? (
          <div className="card p-8 text-center text-theme-text-secondary">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            Loading jobs...
          </div>
        ) : jobs.length === 0 ? (
          <div className="card p-8 text-center text-theme-text-secondary">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium">No smart analysis jobs found</p>
            <p className="text-sm mt-1">Queue tasks from the Smart AI Analysis page</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-3">
              {jobs.map((job) => {
                const StatusIcon = STATUS_ICONS[job.status];
                return (
                  <div key={job.id} className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-theme-text">Job #{job.id}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BG[job.status]}`}>
                          <StatusIcon className={`w-3 h-3 ${STATUS_COLORS[job.status]} ${job.status === 'running' ? 'animate-spin' : ''}`} />
                          {job.status === 'on_hold' ? 'On Hold' : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <button
                          onClick={() => navigate(`/smart-analysis/${job.task_id}`)}
                          className="text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          Task #{job.task_id}
                        </button>
                        {job.source_ip && (
                          <span className="text-theme-text-secondary ml-2">({job.source_ip})</span>
                        )}
                      </div>

                      <div className="flex justify-between">
                        <span className="text-theme-text-secondary">Priority:</span>
                        <span className="text-theme-text">{job.priority}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-theme-text-secondary">Created:</span>
                        <span className="text-theme-text">{getTimeElapsed(job.created_at)}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-theme-text-secondary">Duration:</span>
                        <span className="text-theme-text">{formatDuration(job.processing_duration_ms)}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-theme-text-secondary">Attempts:</span>
                        <span className={`font-medium ${job.attempts >= job.max_attempts ? 'text-red-500' : 'text-theme-text'}`}>
                          {job.attempts} / {job.max_attempts}
                        </span>
                      </div>

                      {job.status === 'failed' && job.error_message && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                          {job.error_message}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-3 pt-3 border-t border-theme-border">
                      {job.status === 'failed' && (
                        <button
                          onClick={() => handleRetryJob(job.id)}
                          disabled={actionLoading}
                          className="flex-1 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                      {['pending', 'queued', 'on_hold'].includes(job.status) && (
                        <button
                          onClick={() => handleCancelJob(job.id)}
                          disabled={actionLoading}
                          className="flex-1 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                        Job ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                        Task ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                        Attempts
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {jobs.map((job) => {
                      const StatusIcon = STATUS_ICONS[job.status];
                      return (
                        <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-theme-text">#{job.id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => navigate(`/smart-analysis/${job.task_id}`)}
                              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                            >
                              Task #{job.task_id}
                            </button>
                            {job.source_ip && (
                              <div className="text-xs text-theme-text-secondary">{job.source_ip}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${STATUS_BG[job.status]}`}>
                              <StatusIcon className={`w-4 h-4 ${STATUS_COLORS[job.status]} ${job.status === 'running' ? 'animate-spin' : ''}`} />
                              {job.status === 'on_hold' ? 'On Hold' : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text">
                            {job.priority}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-secondary">
                            <div>{getTimeElapsed(job.created_at)}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {formatTimestamp(job.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text">
                            {formatDuration(job.processing_duration_ms)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${job.attempts >= job.max_attempts ? 'text-red-500' : 'text-theme-text'}`}>
                              {job.attempts} / {job.max_attempts}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {job.status === 'failed' && (
                                <button
                                  onClick={() => handleRetryJob(job.id)}
                                  disabled={actionLoading}
                                  className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                                  title="Retry"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              {['pending', 'queued', 'on_hold'].includes(job.status) && (
                                <button
                                  onClick={() => handleCancelJob(job.id)}
                                  disabled={actionLoading}
                                  className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Pagination */}
        {!loading && jobs.length > 0 && totalPages > 1 && (
          <div className="bg-card-background px-4 py-3 flex items-center justify-between border-t border-theme-border sm:px-6 rounded-b-lg transition-colors duration-200">
            {/* Mobile view */}
            <div className="flex-1 flex justify-between items-center sm:hidden">
              <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg
                  border border-theme-border bg-card-background text-theme-text
                  hover:bg-theme-surface disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </button>
              <span className="text-sm text-theme-text-secondary">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg
                  border border-theme-border bg-card-background text-theme-text
                  hover:bg-theme-surface disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>

            {/* Desktop view */}
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-theme-text-secondary">
                  Showing <span className="font-medium text-theme-text">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-medium text-theme-text">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{' '}
                  <span className="font-medium text-theme-text">{totalItems}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex items-center gap-1" aria-label="Pagination">
                  {/* Previous Button */}
                  <button
                    onClick={handlePrevious}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg
                      border border-theme-border bg-card-background text-theme-text
                      hover:bg-theme-surface disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-200"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="ml-1">Previous</span>
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {generatePageNumbers().map((pageNum, index) => {
                      if (pageNum === 'ellipsis') {
                        return (
                          <span
                            key={`ellipsis-${index}`}
                            className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-theme-text-muted"
                          >
                            ...
                          </span>
                        );
                      }

                      const isActive = pageNum === currentPage;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`relative inline-flex items-center px-3.5 py-2 text-sm font-medium rounded-lg
                            transition-all duration-200 border
                            ${
                              isActive
                                ? 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'
                                : 'bg-card-background text-theme-text border-theme-border hover:bg-theme-surface'
                            }`}
                          aria-label={`Go to page ${pageNum}`}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={handleNext}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg
                      border border-theme-border bg-card-background text-theme-text
                      hover:bg-theme-surface disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-200"
                    aria-label="Next page"
                  >
                    <span className="mr-1">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Auto-refresh indicator */}
        <div className="text-center text-sm text-theme-text-secondary">
          Auto-refreshing every 1 minute
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-theme-text mb-4">Confirm Action</h3>
            <p className="text-theme-text-secondary mb-6">{showConfirm.message}</p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => setShowConfirm(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={executeAction}
                loading={actionLoading}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default SmartAnalysisJobsPage;
