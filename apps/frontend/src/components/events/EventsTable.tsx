import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { Button } from '../ui/Button';
import { SeverityBadge, StatusBadge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { RefreshCw, Edit2, Trash2, Bot, AlertTriangle } from 'lucide-react';
import { formatDate, truncateString } from '../../utils/formatters';
import type { WafLog } from '../../types';

interface EventsTableProps {
  onEdit: (event: WafLog) => void;
  onDelete: (event: WafLog) => void;
  onAnalyze: (event: WafLog) => void;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
}

export const EventsTable: React.FC<EventsTableProps> = ({
  onEdit,
  onDelete,
  onAnalyze,
  selectedIds,
  onSelectionChange,
}) => {
  const { events, loading, error, fetchEvents, pagination } = useEvents();

  useEffect(() => {
    fetchEvents({});
  }, [pagination.page]);

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

  if (loading && events.length === 0) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-2" />
            <p className="text-theme-text-secondary">Loading events...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-300 dark:border-red-700">
        <div className="p-4 flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>Error: {error}</span>
        </div>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <div className="p-8 text-center">
          <p className="text-theme-text-secondary">No events found</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-theme-border">
          <thead className="bg-theme-surface">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-input-border rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                Source IP
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                Severity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                URI
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-card-background divide-y divide-theme-border">
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-theme-surface transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(event.id)}
                    onChange={(e) => handleSelectOne(event.id, e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-input-border rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Link
                    to={`/events/${event.id}`}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline font-medium transition-colors duration-150"
                  >
                    #{event.id}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-secondary">
                  {formatDate(event.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text font-mono">
                  {event.source_ip}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={event.action} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {event.severity_rating !== undefined && event.severity_rating !== null ? (
                    <SeverityBadge severity={event.severity_rating} />
                  ) : (
                    <span className="text-sm text-theme-text-muted">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-theme-text-secondary max-w-xs truncate">
                  {truncateString(event.uri || '', 50)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      onClick={() => onAnalyze(event)}
                      variant="primary"
                      size="sm"
                    >
                      <Bot className="w-4 h-4" />
                      AI Analyze
                    </Button>
                    <Button
                      onClick={() => onEdit(event)}
                      variant="secondary"
                      size="sm"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => onDelete(event)}
                      variant="danger"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
