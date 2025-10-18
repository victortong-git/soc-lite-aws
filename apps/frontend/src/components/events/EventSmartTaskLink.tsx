import React from 'react';
import { Link } from 'react-router-dom';
import { Link2Off, ExternalLink, Brain } from 'lucide-react';
import type { WafLog } from '../../types';

interface EventSmartTaskLinkProps {
  event: WafLog;
}

export const EventSmartTaskLink: React.FC<EventSmartTaskLinkProps> = ({ event }) => {
  if (!event.smart_analysis_task_id) {
    return (
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <Link2Off className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-theme-text">Smart Analysis Task</h3>
            <p className="text-xs text-theme-text-secondary mt-0.5">
              Not linked to any smart analysis task
            </p>
          </div>
          <span className="px-2 py-1 text-xs font-semibold rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700">
            Unlinked
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
          <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-theme-text">Smart Analysis Task</h3>
          <p className="text-xs text-theme-text-secondary mt-0.5">
            Linked to Task #{event.smart_analysis_task_id}
          </p>
        </div>
        <Link
          to={`/smart-analysis/${event.smart_analysis_task_id}`}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
        >
          <span>View Task</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default EventSmartTaskLink;
