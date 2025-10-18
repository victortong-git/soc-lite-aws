import React from 'react';
import { Calendar, Globe, Shield, Tag } from 'lucide-react';
import { SeverityBadge, StatusBadge } from '../ui/Badge';
import type { WafLog } from '../../types';
import { formatDate } from '../../utils/formatters';

interface EventHeaderAndInfoProps {
  event: WafLog;
  onStatusChange?: (status: string) => void;
  updating?: boolean;
}

export const EventHeaderAndInfo: React.FC<EventHeaderAndInfoProps> = ({
  event,
  onStatusChange,
  updating = false
}) => {
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onStatusChange) {
      onStatusChange(e.target.value);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-card-background border border-theme-border rounded-lg shadow-sm">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-theme-text">
                  WAF Event #{event.id}
                </h1>
                {event.severity_rating !== undefined && event.severity_rating !== null ? (
                  <SeverityBadge severity={event.severity_rating} showNumber={true} />
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">
                    N/A
                  </span>
                )}
              </div>
              <p className="text-sm text-theme-text-secondary">
                Request ID: <span className="font-mono">{event.request_id}</span>
              </p>
            </div>

            {/* Status Selector */}
            <div className="ml-4">
              <label className="block text-xs text-theme-text-secondary mb-1">Status</label>
              <select
                value={event.status}
                onChange={handleStatusChange}
                disabled={updating}
                className="bg-theme-surface border border-theme-border rounded-md px-3 py-2 text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="false_positive">False Positive</option>
              </select>
            </div>
          </div>

          {/* Key Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-theme-border">
            {/* Timestamp */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-50 dark:bg-primary-950 rounded-lg">
                <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-xs text-theme-text-secondary mb-0.5">Event Time</p>
                <p className="text-sm font-medium text-theme-text">
                  {formatDate(event.created_at)}
                </p>
              </div>
            </div>

            {/* Source IP */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-theme-text-secondary mb-0.5">Source IP</p>
                <p className="text-sm font-medium text-theme-text font-mono">
                  {event.source_ip}
                </p>
                {event.country && (
                  <p className="text-xs text-theme-text-muted">{event.country}</p>
                )}
              </div>
            </div>

            {/* Action */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <Shield className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-theme-text-secondary mb-0.5">Action</p>
                <StatusBadge status={event.action} />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                <Tag className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-theme-text-secondary mb-0.5">Current Status</p>
                <StatusBadge status={event.status} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
