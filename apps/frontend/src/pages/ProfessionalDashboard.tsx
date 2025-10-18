import React, { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { ProfessionalStatsCard } from '../components/ui/ProfessionalStatsCard';
import EventTrendsChart from '../components/dashboard/EventTrendsChart';
import { SeverityChart } from '../components/dashboard/SeverityChart';
import { AttackSourceMap } from '../components/dashboard/AttackSourceMap';
import { Card } from '../components/ui/Card';
import {
  BarChart3,
  Shield,
  AlertTriangle,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Bot,
  Globe,
  Code,
  Server,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import type { DashboardStats, EventTrendData, WafLog, SeverityDistribution, TopSource, TopURI } from '../types';
import { SeverityBadge, StatusBadge } from '../components/ui/ProfessionalBadge';
import { formatDate } from '../utils/formatters';

export const ProfessionalDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trendData, setTrendData] = useState<EventTrendData[]>([]);
  const [severityDist, setSeverityDist] = useState<SeverityDistribution[]>([]);
  const [topSources, setTopSources] = useState<TopSource[]>([]);
  const [topURIs, setTopURIs] = useState<TopURI[]>([]);
  const [recentEvents, setRecentEvents] = useState<WafLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch comprehensive dashboard data using apiClient (includes auth token automatically)
      const [statsRes, trendsRes, severityRes, sourcesRes, urisRes, recentRes] = await Promise.all([
        apiClient.get('/events/stats'),
        apiClient.get('/events/trends?hours=24'),
        apiClient.get('/events/severity-distribution'),
        apiClient.get('/events/top-sources?limit=10').catch(() => ({ data: { success: false, data: [] } })),
        apiClient.get('/events/top-uris?limit=10').catch(() => ({ data: { success: false, data: [] } })),
        apiClient.get('/events/recent?limit=5').catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (statsRes.data.success) {
        setStats(statsRes.data.data);
      }

      if (trendsRes.data.success) {
        setTrendData(trendsRes.data.data || []);
      }

      if (severityRes.data.success) {
        setSeverityDist(severityRes.data.data || []);
      }

      if (sourcesRes.data.success) {
        setTopSources(sourcesRes.data.data || []);
      }

      if (urisRes.data.success) {
        setTopURIs(urisRes.data.data || []);
      }

      if (recentRes.data.success) {
        setRecentEvents(recentRes.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const blockedPercentage = stats
    ? ((stats.blocked_events / stats.total_events) * 100).toFixed(1)
    : '0';

  const aiAnalysisPercentage = stats && stats.ai_analysis_rate
    ? Number(stats.ai_analysis_rate).toFixed(1)
    : '0';

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-2" />
            <p className="text-theme-text-secondary">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error && !stats) {
    return (
      <Layout>
        <div className="card border-red-300 dark:border-red-700">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-theme-text">Dashboard</h2>
            <p className="mt-1 text-xs sm:text-sm text-theme-text-secondary">
              Real-time security monitoring and analysis
            </p>
          </div>
          <Button onClick={handleRefresh} loading={refreshing} variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Primary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3 sm:gap-4">
          <ProfessionalStatsCard
            title="Total Events"
            value={stats?.total_events.toLocaleString() || '0'}
            icon={BarChart3}
            iconColor="text-blue-600 dark:text-blue-400"
            trend={stats?.total_trend ? {
              value: stats.total_trend,
              isPositive: false,
              label: 'vs last period'
            } : undefined}
          />

          <ProfessionalStatsCard
            title="Monitored Hosts"
            value={stats?.monitored_hosts_count?.toString() || '0'}
            icon={Server}
            iconColor="text-indigo-600 dark:text-indigo-400"
            subtitle="Websites protected"
          />

          <ProfessionalStatsCard
            title="Blocked Threats"
            value={stats?.blocked_events.toLocaleString() || '0'}
            icon={Shield}
            iconColor="text-red-600 dark:text-red-400"
            trend={stats?.blocked_trend ? {
              value: stats.blocked_trend,
              isPositive: false
            } : undefined}
            subtitle={`${blockedPercentage}% of total`}
          />

          <ProfessionalStatsCard
            title="Allowed Requests"
            value={stats?.allowed_events.toLocaleString() || '0'}
            icon={CheckCircle}
            iconColor="text-green-600 dark:text-green-400"
            subtitle="Clean traffic"
          />

          <ProfessionalStatsCard
            title="Critical Events"
            value={stats?.critical_events?.toLocaleString() || '0'}
            icon={AlertTriangle}
            iconColor="text-red-700 dark:text-red-500"
            trend={stats?.critical_trend ? {
              value: stats.critical_trend,
              isPositive: false
            } : undefined}
          />

          <ProfessionalStatsCard
            title="AI Analysis Rate"
            value={`${aiAnalysisPercentage}%`}
            icon={Bot}
            iconColor="text-purple-600 dark:text-purple-400"
            subtitle={`${stats?.ai_analyzed_events || 0} analyzed`}
          />

          <ProfessionalStatsCard
            title="Avg Severity"
            value={stats?.avg_severity ? Number(stats.avg_severity).toFixed(1) : 'N/A'}
            icon={TrendingUp}
            iconColor="text-orange-600 dark:text-orange-400"
            subtitle="Overall risk level"
          />
        </div>

        {/* Event Trends Chart - Now visible on mobile */}
        <EventTrendsChart
          data={trendData}
          loading={false}
          title="Security Event Trends (Last 24 Hours)"
          height={280}
        />

        {/* Charts Row 1 - Severity Distribution and Attack Sources Map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <SeverityChart 
            data={severityDist.map(item => ({
              name: item.severity === null ? 'null' : item.severity.toString(),
              value: item.count,
              severity: item.severity,
              severity_label: item.severity_label
            }))}
          />
          <AttackSourceMap sources={topSources} />
        </div>

        {/* Secondary Stats and Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Recent Events */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Events
              </h3>
              <Link
                to="/events"
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {recentEvents.length > 0 ? (
                recentEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
                    className="block p-3 rounded-lg border border-theme-border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {event.severity_rating !== undefined && (
                            <SeverityBadge severity={event.severity_rating} />
                          )}
                          <StatusBadge status={event.action} />
                        </div>
                        <p className="text-sm font-medium text-theme-text truncate">
                          {event.source_ip} → {event.uri || 'N/A'}
                        </p>
                        <p className="text-xs text-theme-text-muted mt-1">
                          {formatDate(event.created_at || event.timestamp)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-theme-text-secondary">
                  No recent events
                </div>
              )}
            </div>
          </Card>

          {/* Top Targeted URIs */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
                <Code className="w-5 h-5" />
                Top Targeted URIs
              </h3>
            </div>
            <div className="space-y-2">
              {topURIs.length > 0 ? (
                topURIs.map((uri, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs font-semibold text-theme-text-muted w-6">#{idx + 1}</span>
                      <p className="text-sm font-mono font-medium text-theme-text truncate" title={uri.uri}>
                        {uri.uri}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-sm font-semibold text-theme-text">{uri.count}</p>
                      <p className="text-xs text-red-600 dark:text-red-400">{uri.blocked_count} blocked</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-theme-text-secondary">
                  No URI data available
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Quick Stats Grid */}
        <Card>
          <h3 className="text-base sm:text-lg font-semibold text-theme-text mb-4">Quick Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
              <p className="text-sm text-theme-text-secondary">Allowed</p>
              <p className="text-2xl font-semibold text-theme-text">
                {stats?.allowed_events.toLocaleString() || '0'}
              </p>
            </div>
            <div className="text-center">
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto mb-2" />
              <p className="text-sm text-theme-text-secondary">Blocked</p>
              <p className="text-2xl font-semibold text-theme-text">
                {stats?.blocked_events.toLocaleString() || '0'}
              </p>
            </div>
            <div className="text-center">
              <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
              <p className="text-sm text-theme-text-secondary">Pending Analysis</p>
              <p className="text-2xl font-semibold text-theme-text">
                {stats?.unprocessed_events.toLocaleString() || '0'}
              </p>
            </div>
            <div className="text-center">
              <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
              <p className="text-sm text-theme-text-secondary">Block Rate</p>
              <p className="text-2xl font-semibold text-theme-text">{blockedPercentage}%</p>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default ProfessionalDashboard;
