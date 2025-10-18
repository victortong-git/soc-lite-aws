import React from 'react';
import { Sparkles, FileText, Download, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import type { WafLog } from '../../types';

interface EventSidebarActionsProps {
  event: WafLog;
  onAnalyze: () => void;
  analyzing: boolean;
  analysisJobStatus?: string | null;
}

export const EventSidebarActions: React.FC<EventSidebarActionsProps> = ({
  event,
  onAnalyze,
  analyzing,
  analysisJobStatus
}) => {
  const hasAnalysis = !!(event.security_analysis || event.ai_analysis);
  const isJobPending = analysisJobStatus && ['pending', 'queued', 'running'].includes(analysisJobStatus);

  const getJobStatusBadge = () => {
    if (!analysisJobStatus) return null;

    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: '⏳ Queued', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700' },
      queued: { label: '⏳ Queued', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700' },
      running: { label: '🔄 Analyzing', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700' },
      failed: { label: '✗ Failed', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700' },
    };

    const config = statusConfig[analysisJobStatus] || { label: analysisJobStatus, className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700' };

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${config.className}`}>
        {config.label}
      </div>
    );
  };

  return (
    <div className="bg-card-background border border-theme-border rounded-lg shadow-sm">
      <div className="p-4 border-b border-theme-border">
        <h3 className="text-lg font-semibold text-theme-text">Quick Actions</h3>
      </div>

      <div className="p-4 space-y-3">
        {/* AI Analysis Button */}
        <Button
          onClick={onAnalyze}
          variant="primary"
          loading={analyzing}
          disabled={analyzing || !!isJobPending}
          className="w-full"
        >
          <Sparkles className="w-4 h-4" />
          {analyzing
            ? 'Analyzing...'
            : isJobPending
            ? 'Analysis in Progress...'
            : hasAnalysis
            ? 'Re-analyze Event'
            : 'AI Analysis'}
        </Button>

        {/* Job Status Badge */}
        {getJobStatusBadge() && (
          <div className="flex justify-center">
            {getJobStatusBadge()}
          </div>
        )}

        {/* Last analyzed timestamp */}
        {event.analyzed_at && hasAnalysis && (
          <p className="text-xs text-theme-text-muted text-center">
            Last analyzed: {new Date(event.analyzed_at).toLocaleString()}
          </p>
        )}

        {/* Create Incident Button (Placeholder) */}
        <div className="relative group">
          <Button
            variant="secondary"
            className="w-full opacity-50 cursor-not-allowed"
            disabled
          >
            <FileText className="w-4 h-4" />
            Create Incident
          </Button>
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-10">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3 h-3" />
              <span>Coming in next phase</span>
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>

        {/* Export Event Button (Optional) */}
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            // Export event data as JSON
            const dataStr = JSON.stringify(event, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `event-${event.id}-${Date.now()}.json`;
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="w-4 h-4" />
          Export Event
        </Button>
      </div>

      {/* Analysis Status Info */}
      {analyzing && (
        <div className="px-4 pb-4">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> AI analysis may take 10-20 seconds for the first request as the model initializes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
