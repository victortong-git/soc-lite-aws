import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Sparkles,
  Filter,
  Search,
  Clock,
  Loader,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { SeverityBadge, StatusBadge } from '../components/ui/ProfessionalBadge';
import type { RootState, AppDispatch } from '../store';
import {
  setFilters,
  setPagination,
  fetchSmartAnalysisTasks,
  generateReviewTasks,
  generateAndQueueReviewTasks,
  fetchSmartTaskStats
} from '../store/smartAnalysisSlice';
import type { SmartTaskFilters } from '../types';
import { formatDistanceToNow } from 'date-fns';
import Pagination from '../components/common/Pagination';
import RowsPerPageSelector from '../components/common/RowsPerPageSelector';
import { Layout } from '../components/layout/Layout';
import { clearAllTasks } from '../api/smartAnalysis';

const SmartAIAnalysisPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { tasks, isLoading, filters, pagination, stats } = useSelector(
    (state: RootState) => state.smartAnalysis
  );

  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ action: string; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [autoQueue, setAutoQueue] = useState(true);
  const [localFilters, setLocalFilters] = useState<SmartTaskFilters>({
    status: '',
    severity: '',
    source_ip: ''
  });

  // Load tasks on component mount and when filters/pagination change
  useEffect(() => {
    dispatch(fetchSmartAnalysisTasks({
      page: pagination.currentPage,
      limit: pagination.itemsPerPage,
      ...filters
    }));
    dispatch(fetchSmartTaskStats());
  }, [dispatch, filters, pagination.currentPage, pagination.itemsPerPage]);

  // Handle refresh
  const handleRefresh = () => {
    dispatch(fetchSmartAnalysisTasks({
      page: pagination.currentPage,
      limit: pagination.itemsPerPage,
      ...filters
    }));
    dispatch(fetchSmartTaskStats());
  };

  // Handle generate review tasks
  const handleGenerateReviewTasks = async () => {
    setIsGenerating(true);
    try {
      if (autoQueue) {
        const result = await dispatch(generateAndQueueReviewTasks()).unwrap();
        alert(`Generated ${result.data.tasks_created} task(s) and queued ${result.data.jobs_created} job(s) for analysis!`);
      } else {
        const result = await dispatch(generateReviewTasks()).unwrap();
        alert(`Generated ${result.data.tasks_created} task(s). Queue them manually from the task list.`);
      }
      // Refresh tasks after generation
      dispatch(fetchSmartAnalysisTasks({
        page: 1,
        limit: pagination.itemsPerPage,
        ...filters
      }));
      dispatch(fetchSmartTaskStats());
    } catch (error) {
      console.error('Failed to generate review tasks:', error);
      alert('Failed to generate review tasks');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle clear all tasks
  const handleClearAllTasks = () => {
    setShowConfirm({
      action: 'clear-all-tasks',
      message: `Clear all ${stats?.total_tasks || 0} task(s)? This will also delete all associated analysis jobs. This cannot be undone.`
    });
  };

  const executeAction = async () => {
    if (!showConfirm) return;

    try {
      setActionLoading(true);

      if (showConfirm.action === 'clear-all-tasks') {
        const result = await clearAllTasks();
        alert(result.message);

        // Refresh data
        dispatch(fetchSmartAnalysisTasks({
          page: 1,
          limit: pagination.itemsPerPage,
          ...filters
        }));
        dispatch(fetchSmartTaskStats());
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Operation failed');
    } finally {
      setActionLoading(false);
      setShowConfirm(null);
    }
  };

  // Handle apply filters
  const handleApplyFilters = () => {
    dispatch(setFilters(localFilters));
    setShowFilters(false);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    const emptyFilters: SmartTaskFilters = {
      status: '',
      severity: '',
      source_ip: ''
    };
    setLocalFilters(emptyFilters);
    dispatch(setFilters(emptyFilters));
  };

  // Navigate to detail page
  const handleViewDetails = (taskId: number) => {
    navigate(`/smart-analysis/${taskId}`);
  };

  // Format time_group for display
  const formatTimeGroup = (timeGroup?: string) => {
    if (!timeGroup) return null;
    // Format: YYYYMMDD-HHMM -> "Dec 15, 2024 14:35"
    const year = timeGroup.substring(0, 4);
    const month = timeGroup.substring(4, 6);
    const day = timeGroup.substring(6, 8);
    const hour = timeGroup.substring(9, 11);
    const minute = timeGroup.substring(11, 13);
    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render job status badge
  const renderJobStatusBadge = (jobStatus?: string, hasAnalysis?: boolean) => {
    if (hasAnalysis) {
      // Already analyzed - show completed
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800">
          <CheckCircle className="w-3 h-3" />
          Complete
        </span>
      );
    }

    if (!jobStatus) {
      // No job queued
      return (
        <span className="text-xs text-theme-text-muted">Not Queued</span>
      );
    }

    switch (jobStatus) {
      case 'pending':
      case 'queued':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800">
            <Clock className="w-3 h-3" />
            Queued
          </span>
        );
      case 'running':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
            <Loader className="w-3 h-3 animate-spin" />
            Running
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'on_hold':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">
            <AlertCircle className="w-3 h-3" />
            On Hold
          </span>
        );
      default:
        return (
          <span className="text-xs text-theme-text-muted">-</span>
        );
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-theme-text flex items-center gap-2">
              <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600 dark:text-primary-400" />
              Smart AI Analysis
            </h1>
            <p className="text-xs sm:text-sm text-theme-text-secondary mt-1">
              Bulk analysis of WAF events grouped by source IP
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-theme rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2 text-theme-text disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleClearAllTasks}
              disabled={actionLoading || !stats?.total_tasks}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Clear All Tasks
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-theme rounded-lg">
              <input
                type="checkbox"
                id="auto-queue"
                checked={autoQueue}
                onChange={(e) => setAutoQueue(e.target.checked)}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="auto-queue" className="text-xs sm:text-sm text-theme-text cursor-pointer">
                Auto-queue for analysis
              </label>
            </div>
            <button
              onClick={handleGenerateReviewTasks}
              disabled={isGenerating || isLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Generate Smart Review Tasks</span>
              <span className="sm:hidden">Generate Tasks</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="card">
              <div className="text-xs sm:text-sm text-theme-text-secondary">Total Tasks</div>
              <div className="text-xl sm:text-2xl font-bold text-theme-text mt-1">{stats.total_tasks}</div>
            </div>
            <div className="card">
              <div className="text-xs sm:text-sm text-theme-text-secondary">Open Tasks</div>
              <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.open_tasks}</div>
            </div>
            <div className="card">
              <div className="text-xs sm:text-sm text-theme-text-secondary">Critical</div>
              <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.critical_tasks}</div>
            </div>
            <div className="card">
              <div className="text-xs sm:text-sm text-theme-text-secondary">Total Events</div>
              <div className="text-xl sm:text-2xl font-bold text-theme-text mt-1">{stats.total_linked_events}</div>
            </div>
          </div>
        )}

        {/* Filters Bar */}
        <div className="card">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by source IP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-theme-text"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border border-theme rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2 text-theme-text text-sm"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>
            <div className="sm:ml-auto">
              <RowsPerPageSelector
                value={pagination.itemsPerPage}
                onChange={(value) => dispatch(setPagination({ page: 1, limit: value }))}
              />
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-theme grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-theme-text mb-1">Status</label>
                <select
                  value={localFilters.status || ''}
                  onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value })}
                  className="w-full p-2 text-sm border border-theme rounded-lg bg-white dark:bg-gray-800 text-theme-text"
                >
                  <option value="">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-theme-text mb-1">Severity</label>
                <select
                  value={localFilters.severity || ''}
                  onChange={(e) => setLocalFilters({ ...localFilters, severity: e.target.value })}
                  className="w-full p-2 text-sm border border-theme rounded-lg bg-white dark:bg-gray-800 text-theme-text"
                >
                  <option value="">All Severities</option>
                  <option value="5">Critical (5)</option>
                  <option value="4">High (4)</option>
                  <option value="3">Medium (3)</option>
                  <option value="2">Low (2)</option>
                  <option value="1">Info (1)</option>
                </select>
              </div>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Apply
                </button>
                <button
                  onClick={handleClearFilters}
                  className="flex-1 px-4 py-2 text-sm border border-theme rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-theme-text"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tasks Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-theme-text-secondary">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-theme-text-secondary">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-base sm:text-lg font-medium">No smart analysis tasks found</p>
              <p className="text-xs sm:text-sm mt-1">Click "Generate Smart Review Tasks" to create tasks from unlinked events</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block lg:hidden divide-y divide-theme-border">
                {tasks.map((task) => {
                  const hasAIAnalysis = task.severity_rating !== undefined && task.severity_rating !== null;
                  return (
                    <div
                      key={task.id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      onClick={() => handleViewDetails(task.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-sm font-medium text-theme-text">#{task.id} - {task.source_ip}</div>
                          <div className="text-xs text-theme-text-secondary mt-1">
                            {task.time_group ? formatTimeGroup(task.time_group) : '-'}
                          </div>
                        </div>
                        <StatusBadge status={task.status} />
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-theme-text-secondary">Events:</span>
                          <span className="ml-1 font-medium text-theme-text">{task.num_linked_events}</span>
                        </div>
                        <div>
                          <span className="text-theme-text-secondary">Job:</span>
                          <span className="ml-1">{renderJobStatusBadge(task.analysis_job_status, hasAIAnalysis)}</span>
                        </div>
                        {hasAIAnalysis && task.attack_type && (
                          <div className="col-span-2">
                            <span className="text-theme-text-secondary">Attack:</span>
                            <span className="ml-1 px-2 py-0.5 text-xs font-medium rounded bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                              {task.attack_type}
                            </span>
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="text-theme-text-secondary">Severity:</span>
                          <span className="ml-1">
                            {hasAIAnalysis && task.severity_rating !== undefined ? (
                              <SeverityBadge severity={task.severity_rating} />
                            ) : (
                              <span className="text-xs text-theme-text-muted">Not Analyzed</span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-theme-border">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(task.id);
                          }}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-xs font-medium"
                        >
                          View Details →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-theme">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Source IP</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Time Group</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Events</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Job Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Attack Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Severity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme">
                    {tasks.map((task) => {
                      const hasAIAnalysis = task.severity_rating !== undefined && task.severity_rating !== null;

                      return (
                        <tr
                          key={task.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                          onClick={() => handleViewDetails(task.id)}
                        >
                          <td className="px-6 py-4 text-sm text-theme-text">#{task.id}</td>
                          <td className="px-6 py-4 text-sm font-medium text-theme-text">{task.source_ip}</td>
                          <td className="px-6 py-4 text-sm text-theme-text-secondary">
                            {task.time_group ? formatTimeGroup(task.time_group) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-theme-text-secondary">{task.num_linked_events}</td>
                          <td className="px-6 py-4">
                            <StatusBadge status={task.status} />
                          </td>
                          <td className="px-6 py-4">
                            {renderJobStatusBadge(task.analysis_job_status, hasAIAnalysis)}
                          </td>
                          <td className="px-6 py-4">
                            {hasAIAnalysis && task.attack_type ? (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                                {task.attack_type}
                              </span>
                            ) : (
                              <span className="text-xs text-theme-text-muted">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {hasAIAnalysis && task.severity_rating !== undefined ? (
                              <SeverityBadge severity={task.severity_rating} />
                            ) : (
                              <span className="text-xs text-theme-text-muted">Not Analyzed</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-theme-text-secondary">
                            {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                          </td>
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleViewDetails(task.id)}
                              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination */}
          {tasks.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-theme">
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                itemsPerPage={pagination.itemsPerPage}
                onPageChange={(page) => dispatch(setPagination({ page, limit: pagination.itemsPerPage }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-theme-text mb-4">Confirm Action</h3>
            <p className="text-theme-text-secondary mb-6">{showConfirm.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-theme-text rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default SmartAIAnalysisPage;
