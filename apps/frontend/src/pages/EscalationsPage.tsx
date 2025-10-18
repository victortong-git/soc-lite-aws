import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw, Trash2, ExternalLink, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { EscalationEvent, EscalationStats } from '../types';

// ServiceNow instance URL from environment variable
const SERVICENOW_INSTANCE_URL = import.meta.env.VITE_SERVICENOW_INSTANCE_URL || 'https://dev211549.service-now.com';

// Helper function to generate ServiceNow deep link (Next Experience UI)
const getServiceNowLink = (sysId: string): string => {
  return `${SERVICENOW_INSTANCE_URL}/now/sow/record/incident/${sysId}`;
};

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<EscalationEvent[]>([]);
  const [stats, setStats] = useState<EscalationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEscalation, setSelectedEscalation] = useState<EscalationEvent | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSourceType, setFilterSourceType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);

  const fetchEscalations = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (filterStatus !== 'all') {
        params.append('completed_sns', filterStatus === 'completed' ? 'true' : 'false');
      }
      if (filterSourceType !== 'all') {
        params.append('source_type', filterSourceType);
      }
      if (filterSeverity !== 'all') {
        params.append('severity', filterSeverity);
      }

      const response = await apiClient.get(`/escalations?${params}`);

      if (response.data.success) {
        setEscalations(response.data.data);
        setTotal(response.data.total);
        setError(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/escalations/stats');

      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchEscalations();
    fetchStats();
  }, [page, filterStatus, filterSourceType, filterSeverity]);

  const handleRetrySNS = async (id: number) => {
    try {
      const response = await apiClient.post(`/escalations/${id}/retry-sns`, {});

      if (response.data.success) {
        alert('Escalation queued for retry. SNS will be sent within 5 minutes.');
        fetchEscalations();
        fetchStats();
      }
    } catch (err: any) {
      alert(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this escalation?')) return;

    try {
      const response = await apiClient.delete(`/escalations/${id}`);

      if (response.data.success) {
        alert('Escalation deleted successfully');
        fetchEscalations();
        fetchStats();
      }
    } catch (err: any) {
      alert(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const getSeverityBadge = (severity: number) => {
    const colors = {
      5: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      4: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    const labels = {
      5: 'Critical',
      4: 'High',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[severity as 5 | 4] || 'bg-gray-100 text-gray-800'}`}>
        {labels[severity as 5 | 4] || `Severity ${severity}`}
      </span>
    );
  };

  const getStatusBadge = (escalation: EscalationEvent) => {
    if (escalation.completed_sns) {
      return <span className="flex items-center text-green-600 dark:text-green-400"><CheckCircle className="w-4 h-4 mr-1" /> Sent</span>;
    } else if (escalation.sns_error) {
      return <span className="flex items-center text-red-600 dark:text-red-400"><XCircle className="w-4 h-4 mr-1" /> Failed</span>;
    } else {
      return <span className="flex items-center text-yellow-600 dark:text-yellow-400"><Clock className="w-4 h-4 mr-1" /> Pending</span>;
    }
  };

  const getIncidentStatusBadge = (escalation: EscalationEvent) => {
    if (escalation.completed_incident && escalation.servicenow_incident_number) {
      return (
        <span className="flex items-center text-green-600 dark:text-green-400">
          <CheckCircle className="w-4 h-4 mr-1" />
          {escalation.servicenow_incident_number}
        </span>
      );
    } else if (escalation.servicenow_incident_error) {
      return (
        <span className="flex items-center text-red-600 dark:text-red-400" title={escalation.servicenow_incident_error}>
          <XCircle className="w-4 h-4 mr-1" /> Failed
        </span>
      );
    } else {
      return (
        <span className="flex items-center text-yellow-600 dark:text-yellow-400">
          <Clock className="w-4 h-4 mr-1" /> Pending
        </span>
      );
    }
  };

  const getWafBlocklistBadge = (escalation: EscalationEvent) => {
    if (escalation.completed_waf_blocklist && escalation.waf_blocklist_ip) {
      return (
        <span className="flex items-center text-green-600 dark:text-green-400">
          <CheckCircle className="w-4 h-4 mr-1" />
          {escalation.waf_blocklist_ip}
        </span>
      );
    } else if (escalation.waf_blocklist_error) {
      return (
        <span className="flex items-center text-red-600 dark:text-red-400" title={escalation.waf_blocklist_error}>
          <XCircle className="w-4 h-4 mr-1" /> Failed
        </span>
      );
    } else {
      return (
        <span className="flex items-center text-yellow-600 dark:text-yellow-400">
          <Clock className="w-4 h-4 mr-1" /> Pending
        </span>
      );
    }
  };

  const getSourceLink = (escalation: EscalationEvent) => {
    if (escalation.source_type === 'waf_event' && escalation.source_waf_event_id) {
      return (
        <Link
          to={`/events/${escalation.source_waf_event_id}`}
          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center"
        >
          Event #{escalation.source_waf_event_id} <ExternalLink className="w-3 h-3 ml-1" />
        </Link>
      );
    } else if (escalation.source_type === 'smart_task' && escalation.source_smart_task_id) {
      return (
        <Link
          to={`/smart-analysis/${escalation.source_smart_task_id}`}
          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center"
        >
          Task #{escalation.source_smart_task_id} <ExternalLink className="w-3 h-3 ml-1" />
        </Link>
      );
    }
    return <span className="text-gray-500">N/A</span>;
  };

  return (
    <Layout>
      <div className="p-3 sm:p-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-theme-text flex items-center">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-orange-500" />
            Escalations
          </h1>
          <p className="text-xs sm:text-sm text-theme-text-muted mt-1">
            Track and manage security escalations for high-severity events
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-theme-surface border border-theme-border rounded-lg p-3 sm:p-4">
              <div className="text-theme-text-muted text-xs sm:text-sm">Total Escalations</div>
              <div className="text-xl sm:text-2xl font-bold text-theme-text mt-1">{stats.total_escalations}</div>
            </div>
            <div className="bg-theme-surface border border-theme-border rounded-lg p-3 sm:p-4">
              <div className="text-theme-text-muted text-xs sm:text-sm">SNS Pending</div>
              <div className="text-xl sm:text-2xl font-bold text-yellow-600 mt-1">{stats.pending_sns}</div>
            </div>
            <div className="bg-theme-surface border border-theme-border rounded-lg p-3 sm:p-4">
              <div className="text-theme-text-muted text-xs sm:text-sm">SNS Completed</div>
              <div className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{stats.completed_sns}</div>
            </div>
            <div className="bg-theme-surface border border-theme-border rounded-lg p-3 sm:p-4">
              <div className="text-theme-text-muted text-xs sm:text-sm">ServiceNow Created</div>
              <div className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{stats.completed_incident}</div>
            </div>
            <div className="bg-theme-surface border border-theme-border rounded-lg p-3 sm:p-4 col-span-2 sm:col-span-1">
              <div className="text-theme-text-muted text-xs sm:text-sm">Critical/High</div>
              <div className="text-xl sm:text-2xl font-bold text-red-600 mt-1">{stats.critical_escalations + stats.high_escalations}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-theme-surface border border-theme-border rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-theme-text mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-theme-border rounded-md bg-theme-surface text-theme-text"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-theme-text mb-1">Source Type</label>
              <select
                value={filterSourceType}
                onChange={(e) => setFilterSourceType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-theme-border rounded-md bg-theme-surface text-theme-text"
              >
                <option value="all">All</option>
                <option value="waf_event">WAF Event</option>
                <option value="smart_task">Smart Task</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-theme-text mb-1">Severity</label>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-theme-border rounded-md bg-theme-surface text-theme-text"
              >
                <option value="all">All</option>
                <option value="5">Critical (5)</option>
                <option value="4">High (4)</option>
              </select>
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <button
                onClick={() => { fetchEscalations(); fetchStats(); }}
                className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Escalations Table */}
        <div className="bg-theme-surface border border-theme-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-6 sm:p-8 text-center text-theme-text-muted text-sm">Loading escalations...</div>
          ) : error ? (
            <div className="p-6 sm:p-8 text-center text-red-600 text-sm">Error: {error}</div>
          ) : escalations.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-theme-text-muted text-sm">No escalations found</div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block lg:hidden divide-y divide-theme-border">
                {escalations.map((escalation) => (
                  <div key={escalation.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <button
                          onClick={() => setSelectedEscalation(escalation)}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-left text-sm font-medium"
                        >
                          #{escalation.id} - {escalation.title}
                        </button>
                        <div className="text-xs text-theme-text-muted mt-1">
                          {new Date(escalation.created_at).toLocaleString()}
                        </div>
                      </div>
                      {getSeverityBadge(escalation.severity)}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-theme-text-muted">Source:</span>
                        {getSourceLink(escalation)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-theme-text-muted">SNS:</span>
                        {getStatusBadge(escalation)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-theme-text-muted">ServiceNow:</span>
                        {escalation.completed_incident && escalation.servicenow_incident_number && escalation.servicenow_incident_sys_id ? (
                          <a
                            href={getServiceNowLink(escalation.servicenow_incident_sys_id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                          >
                            {escalation.servicenow_incident_number}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        ) : (
                          getIncidentStatusBadge(escalation)
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-theme-text-muted">WAF Blocklist:</span>
                        {getWafBlocklistBadge(escalation)}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3 pt-3 border-t border-theme-border">
                      <button
                        onClick={() => setSelectedEscalation(escalation)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800"
                      >
                        View Details
                      </button>
                      {!escalation.completed_sns && (
                        <button
                          onClick={() => handleRetrySNS(escalation.id)}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800"
                        >
                          Retry SNS
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(escalation.id)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded border border-red-200 dark:border-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-theme-surface-secondary">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">SNS Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">ServiceNow</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">WAF Blocklist</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border">
                    {escalations.map((escalation) => (
                      <tr key={escalation.id} className="hover:bg-theme-surface-secondary">
                        <td className="px-4 py-3 text-sm text-theme-text">#{escalation.id}</td>
                        <td className="px-4 py-3 text-sm text-theme-text max-w-md truncate">
                          <button
                            onClick={() => setSelectedEscalation(escalation)}
                            className="text-blue-600 dark:text-blue-400 hover:underline text-left"
                          >
                            {escalation.title}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">{getSeverityBadge(escalation.severity)}</td>
                        <td className="px-4 py-3 text-sm">{getSourceLink(escalation)}</td>
                        <td className="px-4 py-3 text-sm text-theme-text-muted">
                          {new Date(escalation.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">{getStatusBadge(escalation)}</td>
                        <td className="px-4 py-3 text-sm">
                          {escalation.completed_incident && escalation.servicenow_incident_number && escalation.servicenow_incident_sys_id ? (
                            <a
                              href={getServiceNowLink(escalation.servicenow_incident_sys_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                            >
                              {escalation.servicenow_incident_number}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          ) : (
                            getIncidentStatusBadge(escalation)
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{getWafBlocklistBadge(escalation)}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setSelectedEscalation(escalation)}
                              className="text-purple-600 hover:text-purple-800 dark:text-purple-400"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {!escalation.completed_sns && (
                              <button
                                onClick={() => handleRetrySNS(escalation.id)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                title="Retry SNS"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(escalation.id)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-xs sm:text-sm text-theme-text-muted">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} escalations
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 sm:px-4 py-2 text-sm border border-theme-border rounded-md disabled:opacity-50 text-theme-text"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= total}
                className="px-3 sm:px-4 py-2 text-sm border border-theme-border rounded-md disabled:opacity-50 text-theme-text"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {selectedEscalation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-theme-surface rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-theme-text">Escalation Details</h2>
                  <button
                    onClick={() => setSelectedEscalation(null)}
                    className="text-theme-text-muted hover:text-theme-text"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-theme-text-muted">ID</label>
                    <div className="text-theme-text">#{selectedEscalation.id}</div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-theme-text-muted">Title</label>
                    <div className="text-theme-text">{selectedEscalation.title}</div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-theme-text-muted">Severity</label>
                    <div>{getSeverityBadge(selectedEscalation.severity)}</div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-theme-text-muted">Source</label>
                    <div>{getSourceLink(selectedEscalation)}</div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-theme-text-muted">SNS Status</label>
                    <div>{getStatusBadge(selectedEscalation)}</div>
                  </div>

                  {selectedEscalation.sns_message_id && (
                    <div>
                      <label className="text-sm font-medium text-theme-text-muted">SNS Message ID</label>
                      <div className="text-theme-text font-mono text-xs">{selectedEscalation.sns_message_id}</div>
                    </div>
                  )}

                  {selectedEscalation.sns_error && (
                    <div>
                      <label className="text-sm font-medium text-theme-text-muted">SNS Error</label>
                      <div className="text-red-600 text-sm">{selectedEscalation.sns_error}</div>
                    </div>
                  )}

                  <div className="border-t border-theme-border pt-4 mt-4">
                    <h3 className="text-lg font-semibold text-theme-text mb-3">ServiceNow Incident</h3>

                    {selectedEscalation.completed_incident && selectedEscalation.servicenow_incident_number ? (
                      <>
                        <div className="mb-3">
                          <label className="text-sm font-medium text-theme-text-muted">Incident Number</label>
                          <div className="flex items-center space-x-2">
                            <span className="text-theme-text font-semibold">{selectedEscalation.servicenow_incident_number}</span>
                            {selectedEscalation.servicenow_incident_sys_id && (
                              <a
                                href={getServiceNowLink(selectedEscalation.servicenow_incident_sys_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center text-sm"
                              >
                                View in ServiceNow <ExternalLink className="w-3 h-3 ml-1" />
                              </a>
                            )}
                          </div>
                        </div>

                        {selectedEscalation.servicenow_incident_sys_id && (
                          <div className="mb-3">
                            <label className="text-sm font-medium text-theme-text-muted">Incident SysID</label>
                            <div className="text-theme-text font-mono text-xs">{selectedEscalation.servicenow_incident_sys_id}</div>
                          </div>
                        )}

                        {selectedEscalation.servicenow_incident_created_at && (
                          <div className="mb-3">
                            <label className="text-sm font-medium text-theme-text-muted">Created At</label>
                            <div className="text-theme-text">{new Date(selectedEscalation.servicenow_incident_created_at).toLocaleString()}</div>
                          </div>
                        )}

                        <div className="flex items-center text-green-600 dark:text-green-400 mt-2">
                          <CheckCircle className="w-5 h-5 mr-2" />
                          <span className="font-medium">Incident Created Successfully</span>
                        </div>
                      </>
                    ) : selectedEscalation.servicenow_incident_error ? (
                      <div>
                        <div className="flex items-center text-red-600 dark:text-red-400 mb-2">
                          <XCircle className="w-5 h-5 mr-2" />
                          <span className="font-medium">Incident Creation Failed</span>
                        </div>
                        <div className="text-sm text-theme-text-muted bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                          {selectedEscalation.servicenow_incident_error}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                        <Clock className="w-5 h-5 mr-2" />
                        <span className="font-medium">Incident Creation Pending</span>
                        <span className="text-sm text-theme-text-muted ml-2">(will be created within 5 minutes)</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-theme-border pt-4 mt-4">
                    <h3 className="text-lg font-semibold text-theme-text mb-3">WAF IP Blocklist</h3>

                    {selectedEscalation.completed_waf_blocklist && selectedEscalation.waf_blocklist_ip ? (
                      <>
                        <div className="mb-3">
                          <label className="text-sm font-medium text-theme-text-muted">Blocked IP Address</label>
                          <div className="text-theme-text font-semibold font-mono">{selectedEscalation.waf_blocklist_ip}</div>
                        </div>

                        {selectedEscalation.waf_blocklist_added_at && (
                          <div className="mb-3">
                            <label className="text-sm font-medium text-theme-text-muted">Added At</label>
                            <div className="text-theme-text">{new Date(selectedEscalation.waf_blocklist_added_at).toLocaleString()}</div>
                          </div>
                        )}

                        <div className="flex items-center text-green-600 dark:text-green-400 mt-2">
                          <CheckCircle className="w-5 h-5 mr-2" />
                          <span className="font-medium">IP Successfully Added to WAF Blocklist</span>
                        </div>
                      </>
                    ) : selectedEscalation.waf_blocklist_error ? (
                      <div>
                        <div className="flex items-center text-red-600 dark:text-red-400 mb-2">
                          <XCircle className="w-5 h-5 mr-2" />
                          <span className="font-medium">Blocklist Addition Failed</span>
                        </div>
                        <div className="text-sm text-theme-text-muted bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                          {selectedEscalation.waf_blocklist_error}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                        <Clock className="w-5 h-5 mr-2" />
                        <span className="font-medium">Blocklist Addition Pending</span>
                        <span className="text-sm text-theme-text-muted ml-2">(will be processed within 5 minutes)</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-theme-border pt-4 mt-4">
                    <label className="text-sm font-medium text-theme-text-muted">Message</label>
                    <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto whitespace-pre-wrap text-theme-text">
                      {selectedEscalation.message}
                    </pre>
                  </div>

                  {selectedEscalation.detail_payload && (
                    <div>
                      <label className="text-sm font-medium text-theme-text-muted">Detail Payload</label>
                      <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto text-theme-text">
                        {JSON.stringify(selectedEscalation.detail_payload, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-4">
                    {!selectedEscalation.completed_sns && (
                      <button
                        onClick={() => {
                          handleRetrySNS(selectedEscalation.id);
                          setSelectedEscalation(null);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Retry SNS
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedEscalation(null)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
