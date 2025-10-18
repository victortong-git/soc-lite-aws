import React, { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { StatsCard } from '../components/ui/StatsCard';
import { SeverityChart } from '../components/dashboard/SeverityChart';
import { AttackSourceMap } from '../components/dashboard/AttackSourceMap';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { BarChart3, Shield, AlertTriangle, TrendingUp, Activity, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://your-api-url.com/api';

interface Stats {
  total_events: number;
  blocked_events: number;
  allowed_events: number;
  open_events: number;
  unprocessed_events: number;
  avg_severity: number;
}

interface AttackSource {
  source_ip: string;
  country: string;
  count: number;
  blocked_count: number;
  allowed_count: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [severityData, setSeverityData] = useState<Array<{ name: string; value: number }>>([]);
  const [topSources, setTopSources] = useState<AttackSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch stats, severity distribution, and top sources in parallel
      const [statsResponse, severityResponse, topSourcesResponse] = await Promise.all([
        axios.get(`${API_URL}/events/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/events/severity-distribution`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/events/top-sources?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }

      if (severityResponse.data.success) {
        // Transform severity distribution data for chart
        const chartData = severityResponse.data.data.map((item: any) => ({
          name: item.severity === null ? 'null' : item.severity.toString(),
          value: item.count,
          severity: item.severity,
          severity_label: item.severity_label
        }));
        setSeverityData(chartData);
      }

      if (topSourcesResponse.data.success) {
        setTopSources(topSourcesResponse.data.data);
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

  if (error) {
    return (
      <Layout>
        <Card className="border-red-300 dark:border-red-700">
          <CardBody>
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardBody>
        </Card>
      </Layout>
    );
  }

  const blockedPercentage = stats
    ? ((stats.blocked_events / stats.total_events) * 100).toFixed(1)
    : '0';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-theme-text">Dashboard</h2>
            <p className="mt-1 text-sm text-theme-text-secondary">
              Overview of WAF security events and AI analysis
            </p>
          </div>
          <Button onClick={handleRefresh} loading={refreshing} variant="secondary">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total Events"
            value={stats?.total_events.toLocaleString() || '0'}
            icon={BarChart3}
            iconColor="text-primary-600 dark:text-primary-400"
          />
          <StatsCard
            title="Blocked Threats"
            value={stats?.blocked_events.toLocaleString() || '0'}
            icon={Shield}
            iconColor="text-red-600 dark:text-red-400"
            trend={{ value: Number(blockedPercentage), isPositive: false }}
          />
          <StatsCard
            title="Open Alerts"
            value={stats?.open_events.toLocaleString() || '0'}
            icon={AlertTriangle}
            iconColor="text-yellow-600 dark:text-yellow-400"
          />
          <StatsCard
            title="Avg Severity"
            value={stats?.avg_severity ? stats.avg_severity.toFixed(1) : 'N/A'}
            icon={TrendingUp}
            iconColor="text-purple-600 dark:text-purple-400"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SeverityChart data={severityData} />
          <AttackSourceMap sources={topSources} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Activity
              </h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-red-500"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-theme-text">Critical Alert Detected</p>
                    <p className="text-xs text-theme-text-secondary">SQL injection attempt blocked</p>
                    <p className="text-xs text-theme-text-muted mt-1">2 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-yellow-500"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-theme-text">Medium Severity Event</p>
                    <p className="text-xs text-theme-text-secondary">Rate limit exceeded from 203.0.113.45</p>
                    <p className="text-xs text-theme-text-muted mt-1">15 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-theme-text">AI Analysis Completed</p>
                    <p className="text-xs text-theme-text-secondary">Analyzed 25 events automatically</p>
                    <p className="text-xs text-theme-text-muted mt-1">1 hour ago</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-theme-text">Quick Stats</h3>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-theme-bg-secondary rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
                  <p className="text-xs text-theme-text-secondary">Allowed</p>
                  <p className="text-xl font-semibold text-theme-text">
                    {stats?.allowed_events.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="text-center p-3 bg-theme-bg-secondary rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto mb-2" />
                  <p className="text-xs text-theme-text-secondary">Blocked</p>
                  <p className="text-xl font-semibold text-theme-text">
                    {stats?.blocked_events.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="text-center p-3 bg-theme-bg-secondary rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
                  <p className="text-xs text-theme-text-secondary">Pending Analysis</p>
                  <p className="text-xl font-semibold text-theme-text">
                    {stats?.unprocessed_events.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="text-center p-3 bg-theme-bg-secondary rounded-lg">
                  <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                  <p className="text-xs text-theme-text-secondary">Block Rate</p>
                  <p className="text-xl font-semibold text-theme-text">{blockedPercentage}%</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>


      </div>
    </Layout>
  );
};
