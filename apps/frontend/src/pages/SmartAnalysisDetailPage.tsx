import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  RefreshCw,
  ArrowLeft,
  Sparkles,
  Activity,
  AlertTriangle,
  Clock,
  Globe,
  Shield,
  Zap,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  Bug,
  Loader,
  XCircle,
  PlayCircle
} from 'lucide-react';
import { SeverityBadge, StatusBadge } from '../components/ui/ProfessionalBadge';
import type { RootState, AppDispatch } from '../store';
import {
  fetchSmartAnalysisTaskById,
  fetchLinkedEvents,
  updateSmartTask,
  deleteSmartTask,
  clearSelectedTask,
  createAnalysisJob
} from '../store/smartAnalysisSlice';
import { formatDistanceToNow } from 'date-fns';
import { Layout } from '../components/layout/Layout';

const SmartAnalysisDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { selectedTask, linkedEvents, isLoading, isLoadingEvents } = useSelector(
    (state: RootState) => state.smartAnalysis
  );

  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      const taskId = parseInt(id);
      dispatch(fetchSmartAnalysisTaskById(taskId));
      dispatch(fetchLinkedEvents(taskId));
    }

    return () => {
      dispatch(clearSelectedTask());
    };
  }, [id, dispatch]);

  // Auto-refresh when job is processing
  useEffect(() => {
    if (!selectedTask) return;

    const jobStatus = selectedTask.analysis_job_status;
    const isProcessing = jobStatus === 'pending' || jobStatus === 'queued' || jobStatus === 'running';

    if (isProcessing) {
      const interval = setInterval(() => {
        if (id) {
          const taskId = parseInt(id);
          dispatch(fetchSmartAnalysisTaskById(taskId));
        }
      }, 180000); // Refresh every 3 minutes

      return () => clearInterval(interval);
    }
  }, [selectedTask, selectedTask?.analysis_job_status, id, dispatch]);

  const handleRefresh = () => {
    if (id) {
      const taskId = parseInt(id);
      dispatch(fetchSmartAnalysisTaskById(taskId));
      dispatch(fetchLinkedEvents(taskId));
    }
  };

  const handleQueueForAnalysis = async () => {
    if (!selectedTask) return;
    setIsCreatingJob(true);
    setSuccessMessage(null);
    try {
      await dispatch(createAnalysisJob({ taskId: selectedTask.id, priority: 0 })).unwrap();
      setSuccessMessage('Task queued for analysis successfully!');
      // Refresh task to get updated status
      setTimeout(() => {
        handleRefresh();
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to queue task for analysis:', error);
      setSuccessMessage('Failed to queue task for analysis');
    } finally {
      setIsCreatingJob(false);
    }
  };

  const handleReanalyzeTask = async () => {
    if (!selectedTask) return;
    setIsCreatingJob(true);
    setSuccessMessage(null);
    try {
      await dispatch(createAnalysisJob({ taskId: selectedTask.id, priority: 1 })).unwrap();
      setSuccessMessage('Task queued for re-analysis successfully!');
      // Refresh task to get updated status
      setTimeout(() => {
        handleRefresh();
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to queue task for re-analysis:', error);
      setSuccessMessage('Failed to queue task for re-analysis');
    } finally {
      setIsCreatingJob(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTask) return;
    try {
      await dispatch(updateSmartTask({
        taskId: selectedTask.id,
        updates: { status: newStatus as any }
      })).unwrap();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedTask) return;
    try {
      await dispatch(deleteSmartTask(selectedTask.id)).unwrap();
      navigate('/smart-analysis');
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleCopyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
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

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
        </div>
      </Layout>
    );
  }

  if (!selectedTask) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-theme-text-secondary">Task not found</p>
          <button
            onClick={() => navigate('/smart-analysis')}
            className="mt-4 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
          >
            Back to Smart Analysis
          </button>
        </div>
      </Layout>
    );
  }

  // Calculate stats from linked events
  const eventStats = {
    total: linkedEvents.length,
    blocked: linkedEvents.filter((e: any) => e.action === 'BLOCK').length,
    allowed: linkedEvents.filter((e: any) => e.action === 'ALLOW').length,
    uniqueURIs: new Set(linkedEvents.map((e: any) => e.uri)).size,
    uniqueRules: new Set(linkedEvents.map((e: any) => e.rule_name).filter(Boolean)).size,
  };

  // Render job status banner
  const renderJobStatusBanner = () => {
    const jobStatus = selectedTask.analysis_job_status;
    const hasAnalysis = selectedTask.severity_rating !== undefined && selectedTask.severity_rating !== null;

    if (hasAnalysis) {
      return null; // Don't show banner if already analyzed
    }

    if (!jobStatus) {
      return null; // No job queued yet
    }

    switch (jobStatus) {
      case 'pending':
      case 'queued':
        return (
          <div className="card bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-theme-text">Analysis Job Queued</h3>
                <p className="text-theme-text-secondary text-sm mt-1">
                  This task is in the analysis queue. The bulk AI analysis will begin shortly.
                </p>
                <p className="text-theme-text-secondary text-xs mt-1 italic">
                  Page will auto-refresh every 3 minutes...
                </p>
              </div>
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <Loader className="w-5 h-5 animate-spin" />
              </div>
            </div>
          </div>
        );
      case 'running':
        return (
          <div className="card bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <PlayCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-theme-text">Analysis In Progress</h3>
                <p className="text-theme-text-secondary text-sm mt-1">
                  The bulk AI analysis is currently running. This typically takes 30-60 seconds.
                </p>
                <p className="text-theme-text-secondary text-xs mt-1 italic">
                  Page will auto-refresh every 3 minutes...
                </p>
              </div>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Loader className="w-8 h-8 animate-spin" />
              </div>
            </div>
          </div>
        );
      case 'failed':
        return (
          <div className="card bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-theme-text">Analysis Failed</h3>
                <p className="text-theme-text-secondary text-sm mt-1">
                  The bulk AI analysis failed to complete. This may be due to a timeout or system error.
                </p>
                <p className="text-theme-text text-sm mt-2">
                  <strong>Action:</strong> Click "Re-analyze Task" button to try again.
                </p>
              </div>
              <button
                onClick={handleReanalyzeTask}
                disabled={isCreatingJob}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
              >
                {isCreatingJob ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Retry
              </button>
            </div>
          </div>
        );
      case 'on_hold':
        return (
          <div className="card bg-gray-50 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-theme-text">Analysis On Hold</h3>
                <p className="text-theme-text-secondary text-sm mt-1">
                  This analysis job has been put on hold by the system.
                </p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate('/smart-analysis')}
            className="flex items-center gap-2 text-theme-text-secondary hover:text-theme-text mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Smart Analysis
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-theme-text flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                Smart Analysis Task #{selectedTask.id}
              </h1>
              <div className="flex flex-wrap items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-theme-text-secondary" />
                  <span className="text-lg font-medium text-theme-text">{selectedTask.source_ip}</span>
                </div>
                {selectedTask.time_group && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-theme-text-secondary" />
                    <span className="text-sm text-theme-text-secondary">{formatTimeGroup(selectedTask.time_group)}</span>
                  </div>
                )}
                <StatusBadge status={selectedTask.status} />
                {selectedTask.severity_rating !== undefined && selectedTask.severity_rating !== null ? (
                  <SeverityBadge severity={selectedTask.severity_rating} />
                ) : (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    Not Analyzed
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-theme rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-theme-text"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              {selectedTask.severity_rating === undefined || selectedTask.severity_rating === null ? (
                (() => {
                  const jobStatus = selectedTask.analysis_job_status;
                  const isJobProcessing = jobStatus === 'pending' || jobStatus === 'queued' || jobStatus === 'running';

                  if (isJobProcessing) {
                    return (
                      <button
                        disabled={true}
                        className="px-4 py-2 bg-gray-400 dark:bg-gray-600 text-white rounded-lg flex items-center gap-2 opacity-75 cursor-not-allowed"
                      >
                        <Loader className="w-4 h-4 animate-spin" />
                        {jobStatus === 'running' ? 'Analysis Running...' : 'Job Queued...'}
                      </button>
                    );
                  }

                  return (
                    <button
                      onClick={handleQueueForAnalysis}
                      disabled={isCreatingJob}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isCreatingJob ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      Queue for Analysis
                    </button>
                  );
                })()
              ) : (
                <button
                  onClick={handleReanalyzeTask}
                  disabled={isCreatingJob}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {isCreatingJob ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Re-analyze Task
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className={`card ${successMessage.includes('Failed') ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'} border-2`}>
            <p className={`text-sm font-medium ${successMessage.includes('Failed') ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200'}`}>
              {successMessage}
            </p>
          </div>
        )}

        {/* Job Status Banner */}
        {renderJobStatusBanner()}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-theme-text-secondary">Total Events</div>
                <div className="text-2xl font-bold text-theme-text">{eventStats.total}</div>
              </div>
              <Activity className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-theme-text-secondary">Blocked</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{eventStats.blocked}</div>
              </div>
              <Shield className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-theme-text-secondary">Unique URIs</div>
                <div className="text-2xl font-bold text-theme-text">{eventStats.uniqueURIs}</div>
              </div>
              <Globe className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-theme-text-secondary">Rules Triggered</div>
                <div className="text-2xl font-bold text-theme-text">{eventStats.uniqueRules}</div>
              </div>
              <AlertTriangle className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
          </div>
        </div>

        {/* AI Analysis Results */}
        {selectedTask.severity_rating !== undefined && selectedTask.severity_rating !== null ? (
          <div className="card bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800">
            <h2 className="text-xl font-bold text-theme-text mb-4 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              Smart Bulk Analysis Results
            </h2>
            <div className="space-y-6">
              {/* Attack Type Badge */}
              {selectedTask.attack_type && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-theme">
                  <h3 className="font-semibold text-theme-text mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    Attack Type Classification
                  </h3>
                  <span className="inline-block px-4 py-2 text-sm font-medium rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800">
                    {selectedTask.attack_type}
                  </span>
                </div>
              )}

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-theme">
                <h3 className="font-semibold text-theme-text mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  Security Analysis
                </h3>
                <p className="text-theme-text leading-relaxed whitespace-pre-wrap">{selectedTask.security_analysis || 'No analysis available'}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-theme">
                <h3 className="font-semibold text-theme-text mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  Recommended Actions
                </h3>
                <p className="text-theme-text leading-relaxed whitespace-pre-wrap">{selectedTask.recommended_actions || 'No recommendations available'}</p>
              </div>
              {selectedTask.analyzed_at && (
                <div className="text-sm text-theme-text-secondary flex items-center gap-2 pt-2 border-t border-theme">
                  <Clock className="w-4 h-4" />
                  Analyzed {formatDistanceToNow(new Date(selectedTask.analyzed_at), { addSuffix: true })}
                  {selectedTask.analyzed_by && ` by ${selectedTask.analyzed_by}`}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              <div>
                <h3 className="font-semibold text-theme-text">Not Yet Analyzed</h3>
                <p className="text-theme-text-secondary text-sm mt-1">
                  This task has not been analyzed yet. Click "Queue for Analysis" to submit it for bulk AI analysis.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Troubleshooting Section */}
        {(selectedTask.ai_prompt || selectedTask.ai_response) && (
          <div className="card bg-gray-50 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700">
            <button
              onClick={() => setShowTroubleshooting(!showTroubleshooting)}
              className="w-full flex items-center justify-between py-2 hover:opacity-80 transition-opacity"
            >
              <h2 className="text-xl font-bold text-theme-text flex items-center gap-2">
                <Bug className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                Troubleshooting Data (Raw AI Interaction)
              </h2>
              {showTroubleshooting ? (
                <ChevronUp className="w-5 h-5 text-theme-text-secondary" />
              ) : (
                <ChevronDown className="w-5 h-5 text-theme-text-secondary" />
              )}
            </button>

            {showTroubleshooting && (
              <div className="mt-4 space-y-4">
                {/* AI Prompt Section */}
                {selectedTask.ai_prompt && (
                  <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-theme-text flex items-center gap-2">
                        <Zap className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        AI Prompt (Request Sent)
                      </h3>
                      <button
                        onClick={() => handleCopyToClipboard(selectedTask.ai_prompt || '', 'prompt')}
                        className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        {copiedField === 'prompt' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={selectedTask.ai_prompt}
                      className="w-full h-64 p-3 font-mono text-xs bg-gray-50 dark:bg-gray-950 text-theme-text border border-gray-300 dark:border-gray-700 rounded resize-y focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600"
                    />
                  </div>
                )}

                {/* AI Response Section */}
                {selectedTask.ai_response && (
                  <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-theme-text flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        AI Response (Raw Output)
                      </h3>
                      <button
                        onClick={() => handleCopyToClipboard(selectedTask.ai_response || '', 'response')}
                        className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        {copiedField === 'response' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={selectedTask.ai_response}
                      className="w-full h-64 p-3 font-mono text-xs bg-gray-50 dark:bg-gray-950 text-theme-text border border-gray-300 dark:border-gray-700 rounded resize-y focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600"
                    />
                  </div>
                )}

                <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                  <AlertTriangle className="w-4 h-4" />
                  This section shows the raw payload sent to the AI agent and the raw response received. Use this for debugging and troubleshooting AI analysis issues.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Linked Events Table */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-theme">
            <h2 className="text-xl font-bold text-theme-text">Linked Events ({linkedEvents.length})</h2>
          </div>
          {isLoadingEvents ? (
            <div className="p-8 text-center text-theme-text-secondary">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading events...
            </div>
          ) : linkedEvents.length === 0 ? (
            <div className="p-8 text-center text-theme-text-secondary">No linked events found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Rule</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">URI</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {linkedEvents.slice(0, 50).map((event: any) => (
                    <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 text-sm">
                        <Link
                          to={`/events/${event.id}`}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-mono font-medium hover:underline"
                        >
                          #{event.id}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-theme-text-secondary">
                        {new Date(event.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={event.status || 'open'} />
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={event.action} />
                      </td>
                      <td className="px-6 py-4 text-sm text-theme-text-secondary">{event.rule_name || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-theme-text-secondary max-w-xs truncate">{event.uri || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-theme-text-secondary">{event.http_method || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/events/${event.id}`}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium hover:underline"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {linkedEvents.length > 50 && (
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 text-center text-sm text-theme-text-secondary">
                  Showing first 50 of {linkedEvents.length} events
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions Panel */}
        <div className="card">
          <h2 className="text-xl font-bold text-theme-text mb-4">Actions</h2>
          <div className="flex gap-3">
            <select
              onChange={(e) => handleUpdateStatus(e.target.value)}
              value={selectedTask.status}
              className="px-4 py-2 border border-theme rounded-lg bg-white dark:bg-gray-800 text-theme-text"
            >
              <option value="open">Open</option>
              <option value="in_review">In Review</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Task
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-theme-text mb-2">Delete Task</h3>
              <p className="text-theme-text-secondary mb-4">
                Are you sure you want to delete this smart analysis task? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-theme rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-theme-text"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SmartAnalysisDetailPage;
