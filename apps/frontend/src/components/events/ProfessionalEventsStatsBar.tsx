import React from 'react';
import { ProfessionalStatsCard } from '../ui/ProfessionalStatsCard';
import { Shield, AlertTriangle, CheckCircle, XCircle, Activity, TrendingUp } from 'lucide-react';

export interface EventsStats {
  total_events: number;
  blocked_events: number;
  allowed_events: number;
  count_events?: number;
  critical_events: number;
  high_events: number;
  unprocessed_events: number;
  // Trends
  total_trend?: number;
  blocked_trend?: number;
  critical_trend?: number;
}

interface ProfessionalEventsStatsBarProps {
  stats: EventsStats | null;
  loading?: boolean;
}

export const ProfessionalEventsStatsBar: React.FC<ProfessionalEventsStatsBarProps> = ({
  stats,
  loading = false,
}) => {
  const blockedPercentage = stats && stats.total_events > 0
    ? ((stats.blocked_events / stats.total_events) * 100).toFixed(1)
    : '0';

  const criticalPercentage = stats && stats.total_events > 0
    ? ((stats.critical_events / stats.total_events) * 100).toFixed(1)
    : '0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      <ProfessionalStatsCard
        title="Total Events"
        value={stats?.total_events.toLocaleString() || '0'}
        icon={Activity}
        iconColor="text-blue-600 dark:text-blue-400"
        loading={loading}
        trend={stats?.total_trend ? {
          value: stats.total_trend,
          isPositive: false,
          label: 'vs last period'
        } : undefined}
      />

      <ProfessionalStatsCard
        title="Blocked Threats"
        value={stats?.blocked_events.toLocaleString() || '0'}
        icon={Shield}
        iconColor="text-red-600 dark:text-red-400"
        loading={loading}
        trend={stats?.blocked_trend ? {
          value: stats.blocked_trend,
          isPositive: false,
          label: 'vs last period'
        } : undefined}
        subtitle={`${blockedPercentage}% of total`}
      />

      <ProfessionalStatsCard
        title="Allowed Requests"
        value={stats?.allowed_events.toLocaleString() || '0'}
        icon={CheckCircle}
        iconColor="text-green-600 dark:text-green-400"
        loading={loading}
        subtitle={`${(100 - parseFloat(blockedPercentage)).toFixed(1)}% of total`}
      />

      <ProfessionalStatsCard
        title="Critical Events"
        value={stats?.critical_events.toLocaleString() || '0'}
        icon={AlertTriangle}
        iconColor="text-red-700 dark:text-red-500"
        loading={loading}
        trend={stats?.critical_trend ? {
          value: stats.critical_trend,
          isPositive: false,
          label: 'vs last period'
        } : undefined}
        subtitle={`${criticalPercentage}% of total`}
      />

      <ProfessionalStatsCard
        title="High Severity"
        value={stats?.high_events.toLocaleString() || '0'}
        icon={TrendingUp}
        iconColor="text-orange-600 dark:text-orange-400"
        loading={loading}
      />

      <ProfessionalStatsCard
        title="Pending Analysis"
        value={stats?.unprocessed_events.toLocaleString() || '0'}
        icon={XCircle}
        iconColor="text-yellow-600 dark:text-yellow-400"
        loading={loading}
        subtitle="Awaiting AI review"
      />
    </div>
  );
};

export default ProfessionalEventsStatsBar;
