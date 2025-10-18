import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Ban, CheckCircle, XCircle, RefreshCw, Search, Calendar, X, ExternalLink } from 'lucide-react';
import apiClient from '../api/client';
import { BlocklistIp, BlocklistStats } from '../types';

export default function BlocklistPage() {
  const [blocklist, setBlocklist] = useState<BlocklistIp[]>([]);
  const [stats, setStats] = useState<BlocklistStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<BlocklistIp | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);

  const fetchBlocklist = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (filterActive !== 'all') {
        params.append('is_active', filterActive === 'active' ? 'true' : 'false');
      }
      if (filterSeverity !== 'all') {
        params.append('severity', filterSeverity);
      }

      const response = await apiClient.get(`/blocklist?${params}`);

      if (response.data.success) {
        setBlocklist(response.data.data);
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
      const response = await apiClient.get('/blocklist/stats');

      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchBlocklist();
    fetchStats();
  }, [page, filterActive, filterSeverity]);

  const handleSearch = () => {
    setPage(1);
    fetchBlocklist();
  };

  const getSeverityBadge = (severity: number) => {
    const colors = {
      5: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      4: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      2: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      1: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    };
    const labels = {
      5: 'Critical',
      4: 'High',
      3: 'Medium',
      2: 'Low',
      1: 'Info',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {labels[severity as keyof typeof labels] || `Severity ${severity}`}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleViewDetails = (item: BlocklistIp) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const closeModal = () => {
    setShowDetailModal(false);
    setSelectedItem(null);
  };

  return (
    <Layout>
      <div className="p-3 sm:p-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-theme-text flex items-center">
            <Ban className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-red-500" />
            WAF IP Blocklist
          </h1>
          <p className="text-xs sm:text-sm text-theme-text-muted mt-1">
            Manage blocked IP addresses from high-severity security escalations
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-theme-surface border border-theme-border rounded-lg p-3 sm:p-4">
              <div className="text-theme-text-muted text-xs sm:text-sm">Total Blocked IPs</div>
              <div className="text-xl sm:text-2xl font-bold text-theme-text mt-1">{stats.total_blocked_ips}</div>
            </div>
            <div className="bg-theme-surface border border-theme-border rounded-lg p-3 sm:p-4">
              <div className="text-theme-text-muted text-xs sm:text-sm">Active Blocks</div>
              <div className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{stats.active_blocks}</div>
            </div>
            <div className="bg-theme-surface border border-theme-border rounded-lg p-3 sm:p-4">
              <div className="text-theme-text-muted text-xs sm:text-sm">Critical/High</div>
              <div className="text-xl sm:text-2xl font-bold text-red-600 mt-1">
                {stats.critical_severity_ips + stats.high_severity_ips}
              </div>
            </div>
            <div className="bg-theme-surface border border-theme-border rounded-lg p-3 sm:p-4">
              <div className="text-theme-text-muted text-xs sm:text-sm">Total Block Events</div>
              <div className="text-xl sm:text-2xl font-bold text-theme-text mt-1">{stats.total_block_events}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-theme-surface border border-theme-border rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-theme-text mb-1">Search IP Address</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter IP address..."
                  className="flex-1 px-3 py-2 text-sm border border-theme-border rounded-md bg-theme-surface text-theme-text"
                />
                <button
                  onClick={handleSearch}
                  className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-theme-text mb-1">Status</label>
                <select
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-theme-border rounded-md bg-theme-surface text-theme-text"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
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
                  <option value="3">Medium (3)</option>
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-theme-text mb-1 sm:invisible">Action</label>
                <button
                  onClick={() => { fetchBlocklist(); fetchStats(); }}
                  className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Blocklist Table */}
        <div className="bg-theme-surface border border-theme-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-6 sm:p-8 text-center text-theme-text-muted text-sm">Loading blocklist...</div>
          ) : error ? (
            <div className="p-6 sm:p-8 text-center text-red-600 text-sm">Error: {error}</div>
          ) : blocklist.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-theme-text-muted text-sm">No blocked IPs found</div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block lg:hidden divide-y divide-theme-border">
                {blocklist.map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <button
                          onClick={() => handleViewDetails(item)}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-semibold"
                        >
                          #{item.id}
                        </button>
                        <div className="text-base font-mono font-bold text-theme-text mt-1">
                          {item.ip_address}
                        </div>
                      </div>
                      {getSeverityBadge(item.severity)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                      <div>
                        <span className="text-theme-text-muted">Block Count:</span>
                        <div className="mt-1">
                          <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded font-semibold">
                            {item.block_count}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-theme-text-muted">Status:</span>
                        <div className="mt-1">
                          {item.is_active ? (
                            <span className="flex items-center text-green-600 dark:text-green-400">
                              <CheckCircle className="w-3 h-3 mr-1" /> Active
                            </span>
                          ) : (
                            <span className="flex items-center text-gray-600 dark:text-gray-400">
                              <XCircle className="w-3 h-3 mr-1" /> Inactive
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-theme-text-muted">Created:</span>
                        <div className="text-theme-text mt-1">{formatDate(item.created_at)}</div>
                      </div>
                      {item.reason && (
                        <div className="col-span-2">
                          <span className="text-theme-text-muted">Reason:</span>
                          <div className="text-theme-text mt-1 line-clamp-2">{item.reason}</div>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleViewDetails(item)}
                      className="w-full px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800"
                    >
                      View Full Details
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                <thead className="bg-theme-surface-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">IP Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Block Count</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Last Seen</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {blocklist.map((item) => (
                    <tr key={item.id} className="hover:bg-theme-surface-secondary">
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => handleViewDetails(item)}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                        >
                          #{item.id}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-theme-text font-mono font-semibold">
                        {item.ip_address}
                      </td>
                      <td className="px-4 py-3 text-sm">{getSeverityBadge(item.severity)}</td>
                      <td className="px-4 py-3 text-sm text-theme-text">
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded font-semibold">
                          {item.block_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.is_active ? (
                          <span className="flex items-center text-green-600 dark:text-green-400">
                            <CheckCircle className="w-4 h-4 mr-1" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center text-gray-600 dark:text-gray-400">
                            <XCircle className="w-4 h-4 mr-1" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-theme-text-muted">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-theme-text-muted">
                        {formatDate(item.last_seen_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-theme-text max-w-md truncate">
                        {item.reason || '-'}
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
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} blocked IPs
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

        {/* Top Repeat Offenders */}
        {stats && stats.top_repeat_offenders && stats.top_repeat_offenders.length > 0 && (
          <div className="mt-6 sm:mt-8">
            <h2 className="text-lg sm:text-xl font-bold text-theme-text mb-3 sm:mb-4 flex items-center">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Top Repeat Offenders
            </h2>
            <div className="bg-theme-surface border border-theme-border rounded-lg overflow-hidden">
              {/* Mobile Card View */}
              <div className="block md:hidden divide-y divide-theme-border">
                {stats.top_repeat_offenders.map((offender, index) => (
                  <div key={offender.ip_address} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-theme-text">#{index + 1}</span>
                        <span className="text-sm font-mono font-semibold text-theme-text">{offender.ip_address}</span>
                      </div>
                      {getSeverityBadge(offender.severity)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-theme-text-muted">Block Count:</span>
                        <div className="mt-1">
                          <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded font-bold">
                            {offender.block_count} times
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-theme-text-muted">Last Seen:</span>
                        <div className="text-theme-text mt-1">{formatDate(offender.last_seen_at)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                <thead className="bg-theme-surface-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">IP Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Block Count</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {stats.top_repeat_offenders.map((offender, index) => (
                    <tr key={offender.ip_address} className="hover:bg-theme-surface-secondary">
                      <td className="px-4 py-3 text-sm text-theme-text font-bold">#{index + 1}</td>
                      <td className="px-4 py-3 text-sm text-theme-text font-mono font-semibold">
                        {offender.ip_address}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded font-bold">
                          {offender.block_count} times
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{getSeverityBadge(offender.severity)}</td>
                      <td className="px-4 py-3 text-sm text-theme-text-muted">
                        {formatDate(offender.last_seen_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-theme-surface border border-theme-border rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-theme-surface border-b border-theme-border px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-theme-text flex items-center">
                  <Ban className="w-5 h-5 mr-2 text-red-500" />
                  Blocklist Entry #{selectedItem.id}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-theme-text-muted hover:text-theme-text"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* IP Address & Status */}
                <div className="bg-theme-surface-secondary border border-theme-border rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-theme-text-muted">IP Address</label>
                      <div className="text-lg font-mono font-bold text-theme-text mt-1">
                        {selectedItem.ip_address}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-theme-text-muted">Status</label>
                      <div className="mt-1">
                        {selectedItem.is_active ? (
                          <span className="inline-flex items-center text-green-600 dark:text-green-400 font-semibold">
                            <CheckCircle className="w-5 h-5 mr-1" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-gray-600 dark:text-gray-400 font-semibold">
                            <XCircle className="w-5 h-5 mr-1" /> Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Severity & Block Count */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-theme-surface-secondary border border-theme-border rounded-lg p-4">
                    <label className="text-sm font-medium text-theme-text-muted">Severity</label>
                    <div className="mt-2">{getSeverityBadge(selectedItem.severity)}</div>
                  </div>
                  <div className="bg-theme-surface-secondary border border-theme-border rounded-lg p-4">
                    <label className="text-sm font-medium text-theme-text-muted">Block Count</label>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {selectedItem.block_count}
                    </div>
                  </div>
                </div>

                {/* Reason */}
                {selectedItem.reason && (
                  <div className="bg-theme-surface-secondary border border-theme-border rounded-lg p-4">
                    <label className="text-sm font-medium text-theme-text-muted">Reason</label>
                    <div className="text-theme-text mt-2 whitespace-pre-wrap">
                      {selectedItem.reason}
                    </div>
                  </div>
                )}

                {/* Source Information */}
                <div className="bg-theme-surface-secondary border border-theme-border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-theme-text-muted mb-3">Source Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-theme-text-muted">Escalation ID:</span>
                      <div className="text-theme-text font-mono">
                        {selectedItem.source_escalation_id ? (
                          <a
                            href={`/escalations`}
                            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
                          >
                            #{selectedItem.source_escalation_id}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        ) : (
                          '-'
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-theme-text-muted">WAF Event ID:</span>
                      <div className="text-theme-text font-mono">
                        {selectedItem.source_waf_event_id ? (
                          <a
                            href={`/events/${selectedItem.source_waf_event_id}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
                          >
                            #{selectedItem.source_waf_event_id}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        ) : (
                          '-'
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="bg-theme-surface-secondary border border-theme-border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-theme-text-muted mb-3">Timestamps</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-theme-text-muted flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        Created:
                      </span>
                      <div className="text-theme-text font-mono mt-1">
                        {formatDate(selectedItem.created_at)}
                      </div>
                    </div>
                    <div>
                      <span className="text-theme-text-muted flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        Last Seen:
                      </span>
                      <div className="text-theme-text font-mono mt-1">
                        {formatDate(selectedItem.last_seen_at)}
                      </div>
                    </div>
                    <div>
                      <span className="text-theme-text-muted flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        Updated:
                      </span>
                      <div className="text-theme-text font-mono mt-1">
                        {formatDate(selectedItem.updated_at)}
                      </div>
                    </div>
                    {selectedItem.removed_at && (
                      <div>
                        <span className="text-theme-text-muted flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          Removed:
                        </span>
                        <div className="text-theme-text font-mono mt-1">
                          {formatDate(selectedItem.removed_at)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-theme-surface border-t border-theme-border px-6 py-4 flex justify-end">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
