import React from 'react';
import { Clock, Bot, User, Activity, Trash2, Sparkles, Database } from 'lucide-react';

// Helper function to format metadata nicely
const formatMetadataValue = (_key: string, value: any): string => {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value === null || value === undefined) {
    return 'N/A';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

// Helper function to get badge color for status
const getStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('pending') || statusLower.includes('queued')) {
    return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700';
  }
  if (statusLower.includes('running') || statusLower.includes('processing')) {
    return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700';
  }
  if (statusLower.includes('completed') || statusLower.includes('success')) {
    return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700';
  }
  if (statusLower.includes('failed') || statusLower.includes('error')) {
    return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700';
  }
  return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700';
};

export interface TimelineEntry {
  id: number;
  event_id: number;
  event_type: string;
  actor_type: 'user' | 'system';
  actor_name?: string;
  actor_email?: string;
  title: string;
  description?: string;
  metadata?: any;
  created_at: string | Date;
}

interface EventTimelineProps {
  timeline: TimelineEntry[];
  loading?: boolean;
  onDeleteEntry?: (entryId: number) => void;
  currentUser?: { username?: string; role?: string };
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  timeline,
  loading = false,
  onDeleteEntry,
  currentUser
}) => {
  const getEventIcon = (eventType: string, actorType: string) => {
    if (eventType === 'ai_analysis') {
      return <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400" />;
    }
    if (eventType === 'status_change') {
      return <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (actorType === 'system') {
      return <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
    return <User className="w-4 h-4 text-green-600 dark:text-green-400" />;
  };

  const getEventColor = (eventType: string, actorType: string) => {
    if (eventType === 'ai_analysis') {
      return 'bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800';
    }
    if (eventType === 'status_change') {
      return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
    }
    if (actorType === 'system') {
      return 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800';
    }
    return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
  };

  const canDelete = (entry: TimelineEntry): boolean => {
    if (currentUser?.role === 'admin') return true;
    if (entry.actor_type === 'user' && entry.actor_name === currentUser?.username) return true;
    return false;
  };

  const formatTimestamp = (timestamp: string | Date): string => {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } catch {
      return 'Recently';
    }
  };

  if (loading) {
    return (
      <div className="bg-card-background border border-theme-border rounded-lg shadow-sm">
        <div className="p-4 border-b border-theme-border">
          <h3 className="text-lg font-semibold text-theme-text">Activity Timeline</h3>
        </div>
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-sm text-theme-text-secondary mt-2">Loading timeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card-background border border-theme-border rounded-lg shadow-sm">
      <div className="p-4 border-b border-theme-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-theme-text">Activity Timeline</h3>
          <span className="text-sm text-theme-text-secondary">
            {timeline.length} {timeline.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </div>

      <div className="p-4">
        {timeline.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-theme-text-muted mx-auto mb-3 opacity-50" />
            <p className="text-sm text-theme-text-secondary">No activity recorded yet</p>
            <p className="text-xs text-theme-text-muted mt-1">
              Timeline will show events like status changes and AI analysis
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {timeline.map((entry, index) => (
              <div key={entry.id} className="relative">
                {/* Timeline line */}
                {index !== timeline.length - 1 && (
                  <div className="absolute left-4 top-10 bottom-0 w-px bg-theme-border"></div>
                )}

                {/* Timeline entry */}
                <div className="flex gap-3">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${getEventColor(entry.event_type, entry.actor_type)}`}>
                    {getEventIcon(entry.event_type, entry.actor_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-theme-text">
                          {entry.title}
                        </p>
                        {entry.description && (
                          <p className="text-xs text-theme-text-secondary mt-1">
                            {entry.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-theme-text-muted">
                            {entry.actor_name || 'System'}
                          </span>
                          <span className="text-xs text-theme-text-muted">•</span>
                          <span className="text-xs text-theme-text-muted">
                            {formatTimestamp(entry.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Delete button */}
                      {onDeleteEntry && canDelete(entry) && (
                        <button
                          onClick={() => onDeleteEntry(entry.id)}
                          className="flex-shrink-0 p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Metadata (if present) - Formatted display */}
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(entry.metadata).map(([key, value]) => {
                          const formattedKey = key
                            .split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                          const formattedValue = formatMetadataValue(key, value);

                          // Special handling for status fields
                          const isStatus = key.toLowerCase().includes('status');

                          return (
                            <div
                              key={key}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${
                                isStatus
                                  ? getStatusColor(String(value))
                                  : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              <Database className="w-3 h-3" />
                              <span className="font-medium">{formattedKey}:</span>
                              <span>{formattedValue}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
