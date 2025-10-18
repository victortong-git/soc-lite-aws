import React from 'react';
import { Link } from 'react-router-dom';
import type { WafLog } from '../../types';
import { SeverityBadge, StatusBadge, ConfidenceBadge } from '../ui/ProfessionalBadge';
import { Edit2, Trash2, Eye, Globe, Code, Calendar, AlertTriangle, RefreshCw, Link2, Link2Off } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatDate } from '../../utils/formatters';

interface ProfessionalEventsTableProps {
  events: WafLog[];
  loading?: boolean;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onEdit?: (event: WafLog) => void;
  onDelete?: (event: WafLog) => void;
  onAnalyze?: (event: WafLog) => void;
  analyzingIds?: Set<number>;
}

export const ProfessionalEventsTable: React.FC<ProfessionalEventsTableProps> = ({
  events,
  loading = false,
  selectedIds,
  onSelectionChange,
  onEdit,
  onDelete,
  onAnalyze,
  analyzingIds = new Set(),
}) => {
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(events.map((e) => e.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const allSelected = events.length > 0 && selectedIds.length === events.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < events.length;

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  const getCountryFlag = (countryCode?: string) => {
    if (!countryCode || countryCode.length !== 2) return null;
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  if (loading && events.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-2" />
            <p className="text-theme-text-secondary">Loading events...</p>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="card">
        <div className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-theme-text mb-2">No Events Found</h3>
          <p className="text-theme-text-secondary">No WAF events match your current filters.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="block lg:hidden space-y-3">
        {events.map((event) => {
          const isAnalyzing = analyzingIds.has(event.id);
          const hasAIAnalysis = event.security_analysis || event.ai_analysis || event.ai_insights || event.ai_confidence;
          const isQueued = event.analysis_job_status && ['pending', 'queued', 'running'].includes(event.analysis_job_status);

          return (
            <div key={event.id} className="card p-4">
              {/* Header with checkbox and event ID */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(event.id)}
                    onChange={(e) => handleSelectOne(event.id, e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <Link
                    to={`/events/${event.id}`}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-mono text-sm font-medium hover:underline"
                  >
                    #{event.id}
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  {event.severity_rating !== undefined && event.severity_rating !== null && (
                    <SeverityBadge severity={event.severity_rating} />
                  )}
                </div>
              </div>

              {/* Main content */}
              <div className="space-y-2 mb-3">
                {/* Host */}
                {event.host && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span className="font-medium text-theme-text truncate">{event.host}</span>
                  </div>
                )}

                {/* Source IP */}
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="w-4 h-4 text-theme-text-muted flex-shrink-0" />
                  <span className="font-mono text-theme-text">{event.source_ip}</span>
                  {event.country_code && (
                    <span className="text-lg" title={event.country}>
                      {getCountryFlag(event.country_code)}
                    </span>
                  )}
                  {event.country && (
                    <span className="text-xs text-theme-text-muted">({event.country})</span>
                  )}
                </div>

                {/* URI */}
                {event.uri && (
                  <div className="flex items-start gap-2 text-sm">
                    <Code className="w-4 h-4 text-theme-text-muted flex-shrink-0 mt-0.5" />
                    <span className="text-theme-text-secondary break-all">{event.uri}</span>
                  </div>
                )}

                {/* Rule */}
                {event.rule_name && (
                  <div className="text-xs font-medium text-theme-text truncate">
                    Rule: {event.rule_name}
                  </div>
                )}
              </div>

              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <StatusBadge status={event.status} />
                <StatusBadge status={event.action} />
                {event.http_method && (
                  <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {event.http_method}
                  </span>
                )}
                {/* Smart Task Link Badge */}
                {event.smart_analysis_task_id ? (
                  <Link
                    to={`/smart-analysis/${event.smart_analysis_task_id}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50"
                  >
                    <Link2 className="w-3 h-3" />
                    Task #{event.smart_analysis_task_id}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700">
                    <Link2Off className="w-3 h-3" />
                    Unlinked
                  </span>
                )}
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-2 text-xs text-theme-text-secondary mb-3">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(event.created_at || event.timestamp)}</span>
              </div>

              {/* Analysis Status */}
              <div className="mb-3">
                {isAnalyzing ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                    <span className="text-xs text-theme-text-muted">Analyzing...</span>
                  </div>
                ) : hasAIAnalysis ? (
                  <div className="flex items-center gap-2">
                    <span className="badge badge-success text-xs">✓ Analyzed</span>
                    {event.ai_confidence !== undefined && event.ai_confidence !== null && (
                      <ConfidenceBadge confidence={event.ai_confidence} />
                    )}
                  </div>
                ) : isQueued ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                    <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 text-xs">
                      {event.analysis_job_status === 'pending' && '⏳ Queued'}
                      {event.analysis_job_status === 'queued' && '⏳ Queued'}
                      {event.analysis_job_status === 'running' && '🔄 Analyzing'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 text-xs">
                      Not Analyzed
                    </span>
                    <button
                      onClick={() => onAnalyze?.(event)}
                      className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline"
                      disabled={!onAnalyze}
                    >
                      Analyze Now
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-theme-border">
                <Link to={`/events/${event.id}`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full justify-center">
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                </Link>
                {onEdit && (
                  <Button
                    onClick={() => onEdit(event)}
                    variant="secondary"
                    size="sm"
                    title="Edit Event"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    onClick={() => onDelete(event)}
                    variant="danger"
                    size="sm"
                    title="Delete Event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-theme-border">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={input => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                ID
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider hidden xl:table-cell">
                Time
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                Sev
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider hidden 2xl:table-cell">
                Host
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                Source
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                Details
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-theme-text-secondary uppercase tracking-wider hidden xl:table-cell">
                Status
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                Analysis
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-theme-text-secondary uppercase tracking-wider hidden xl:table-cell">
                Task Link
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {events.map((event) => {
              const isAnalyzing = analyzingIds.has(event.id);
              const hasAIAnalysis = event.security_analysis || event.ai_analysis || event.ai_insights || event.ai_confidence;
              const isQueued = event.analysis_job_status && ['pending', 'queued', 'running'].includes(event.analysis_job_status);

              return (
                <tr
                  key={event.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150"
                >
                  {/* Checkbox */}
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(event.id)}
                      onChange={(e) => handleSelectOne(event.id, e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                    />
                  </td>

                  {/* Event ID */}
                  <td className="px-3 py-3">
                    <Link
                      to={`/events/${event.id}`}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-mono text-sm font-medium hover:underline whitespace-nowrap"
                    >
                      #{event.id}
                    </Link>
                  </td>

                  {/* Timestamp - Hidden on smaller screens */}
                  <td className="px-3 py-3 hidden xl:table-cell">
                    <div className="flex items-center gap-1 text-xs text-theme-text-secondary whitespace-nowrap">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(event.created_at || event.timestamp)}</span>
                    </div>
                  </td>

                  {/* Severity */}
                  <td className="px-3 py-3 text-center">
                    {event.severity_rating !== undefined && event.severity_rating !== null ? (
                      <SeverityBadge severity={event.severity_rating} showNumber={false} />
                    ) : (
                      <span className="text-xs text-theme-text-muted">-</span>
                    )}
                  </td>

                  {/* Host/Website - Hidden on smaller screens */}
                  <td className="px-3 py-3 hidden 2xl:table-cell">
                    {event.host ? (
                      <div className="flex items-center gap-2">
                        <Globe className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-theme-text truncate max-w-[120px]" title={event.host}>
                          {event.host}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-theme-text-muted">-</span>
                    )}
                  </td>

                  {/* Source */}
                  <td className="px-3 py-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-theme-text">{event.source_ip}</span>
                        {event.country_code && (
                          <span className="text-sm" title={event.country}>
                            {getCountryFlag(event.country_code)}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Details (Rule & URI combined) */}
                  <td className="px-3 py-3 max-w-[200px]">
                    <div className="space-y-0.5">
                      {event.rule_name && (
                        <div className="text-xs font-medium text-theme-text truncate" title={event.rule_name}>
                          {truncateText(event.rule_name, 25)}
                        </div>
                      )}
                      {event.uri && (
                        <div className="text-xs text-theme-text-secondary truncate" title={event.uri}>
                          {truncateText(event.uri, 30)}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        {event.http_method && (
                          <span className="inline-block px-1.5 py-0.5 text-xs font-semibold rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            {event.http_method}
                          </span>
                        )}
                        <StatusBadge status={event.action} />
                      </div>
                    </div>
                  </td>

                  {/* Status - Hidden on smaller screens */}
                  <td className="px-3 py-3 text-center hidden xl:table-cell">
                    <StatusBadge status={event.status} />
                  </td>

                  {/* Analysis Status */}
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-center gap-1">
                      {isAnalyzing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
                          <span className="text-xs text-theme-text-muted">Analyzing</span>
                        </>
                      ) : hasAIAnalysis ? (
                        <>
                          <span className="badge badge-success text-xs whitespace-nowrap">
                            ✓ Done
                          </span>
                          {event.ai_confidence !== undefined && event.ai_confidence !== null && (
                            <ConfidenceBadge confidence={event.ai_confidence} />
                          )}
                        </>
                      ) : isQueued ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {event.analysis_job_status === 'running' ? 'Running' : 'Queued'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-theme-text-muted">-</span>
                          <button
                            onClick={() => onAnalyze?.(event)}
                            className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline whitespace-nowrap"
                            disabled={!onAnalyze}
                            title="Analyze with AI"
                          >
                            Analyze
                          </button>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Smart Task Link */}
                  <td className="px-3 py-3 text-center hidden xl:table-cell">
                    {event.smart_analysis_task_id ? (
                      <Link
                        to={`/smart-analysis/${event.smart_analysis_task_id}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50"
                        title={`View Smart Task #${event.smart_analysis_task_id}`}
                      >
                        <Link2 className="w-3 h-3" />
                        #{event.smart_analysis_task_id}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700" title="Not linked to any smart task">
                        <Link2Off className="w-3 h-3" />
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/events/${event.id}`}>
                        <Button variant="secondary" size="sm" title="View Details">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                      {onEdit && (
                        <Button
                          onClick={() => onEdit(event)}
                          variant="secondary"
                          size="sm"
                          title="Edit Event"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          onClick={() => onDelete(event)}
                          variant="danger"
                          size="sm"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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
  );
};

export default ProfessionalEventsTable;
