import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { WafLog } from '../../types';
import apiClient from '../../api/client';

interface Escalation {
  id: number;
  title: string;
  severity: number;
  created_at: string;
  completed_sns: boolean;
  sns_error?: string;
}

interface EventEscalationsLinkProps {
  event: WafLog;
}

export const EventEscalationsLink: React.FC<EventEscalationsLinkProps> = ({ event }) => {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEscalations();
  }, [event.id]);

  const fetchEscalations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/escalations/by-waf-event/${event.id}`);

      if (response.data.success) {
        setEscalations(response.data.escalations);
      }
    } catch (err: any) {
      console.error('Failed to fetch escalations:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-theme-surface border border-theme-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-theme-text mb-2 flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          Escalations
        </h3>
        <p className="text-xs text-theme-text-muted">Loading...</p>
      </div>
    );
  }

  if (escalations.length === 0) {
    return null; // Don't show the card if there are no escalations
  }

  const getStatusIcon = (escalation: Escalation) => {
    if (escalation.completed_sns) {
      return <CheckCircle className="w-3 h-3 text-green-600" />;
    } else if (escalation.sns_error) {
      return <XCircle className="w-3 h-3 text-red-600" />;
    } else {
      return <Clock className="w-3 h-3 text-yellow-600" />;
    }
  };

  const getStatusText = (escalation: Escalation) => {
    if (escalation.completed_sns) {
      return 'Sent';
    } else if (escalation.sns_error) {
      return 'Failed';
    } else {
      return 'Pending';
    }
  };

  return (
    <div className="bg-theme-surface border border-theme-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-theme-text mb-3 flex items-center">
        <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
        Escalations ({escalations.length})
      </h3>

      <div className="space-y-2">
        {escalations.map((escalation) => (
          <div
            key={escalation.id}
            className="bg-theme-surface-secondary border border-theme-border rounded p-3 text-xs"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-semibold text-theme-text">#{escalation.id}</span>
              <div className="flex items-center gap-1 text-theme-text-muted">
                {getStatusIcon(escalation)}
                <span>{getStatusText(escalation)}</span>
              </div>
            </div>

            <div className="text-theme-text-muted mb-2 line-clamp-2">{escalation.title}</div>

            <div className="flex items-center justify-between">
              <span className="text-theme-text-muted">
                {new Date(escalation.created_at).toLocaleString()}
              </span>
              <Link
                to="/escalations"
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View All
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/escalations"
        className="mt-3 block text-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        View All Escalations
      </Link>
    </div>
  );
};
