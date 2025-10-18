import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { BarChart3, Shield, CheckCircle, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://your-api-url.com/api';

interface Stats {
  total_events: number;
  blocked_events: number;
  allowed_events: number;
  open_events: number;
  unprocessed_events: number;
  avg_severity: number;
}

export const EventsStatsBar: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/events/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <Card>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 animate-pulse">
            <div className="h-16 bg-theme-surface rounded"></div>
            <div className="h-16 bg-theme-surface rounded"></div>
            <div className="h-16 bg-theme-surface rounded"></div>
            <div className="h-16 bg-theme-surface rounded"></div>
            <div className="h-16 bg-theme-surface rounded"></div>
            <div className="h-16 bg-theme-surface rounded"></div>
          </div>
        </CardBody>
      </Card>
    );
  }

  const blockedPercentage = stats.total_events > 0
    ? ((stats.blocked_events / stats.total_events) * 100).toFixed(1)
    : '0';

  const statItems = [
    {
      icon: BarChart3,
      value: stats.total_events.toLocaleString(),
      label: 'Total Events',
      color: 'text-primary-600 dark:text-primary-400',
      bgColor: 'bg-primary-50 dark:bg-primary-950',
    },
    {
      icon: Shield,
      value: stats.blocked_events.toLocaleString(),
      label: 'Blocked',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950',
    },
    {
      icon: CheckCircle,
      value: stats.allowed_events.toLocaleString(),
      label: 'Allowed',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      icon: AlertTriangle,
      value: stats.open_events.toLocaleString(),
      label: 'Open',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    },
    {
      icon: Clock,
      value: stats.unprocessed_events.toLocaleString(),
      label: 'Unprocessed',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
    },
    {
      icon: TrendingUp,
      value: stats.avg_severity ? stats.avg_severity.toFixed(1) : 'N/A',
      label: 'Avg Severity',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold text-theme-text">Event Statistics</h3>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {statItems.map((item, index) => (
            <div key={index} className="text-center">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${item.bgColor} mb-2`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-theme-text-secondary mt-1">{item.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-theme-border">
          <div className="flex justify-between items-center text-sm">
            <span className="text-theme-text-secondary">Block Rate:</span>
            <span className="font-semibold text-theme-text">{blockedPercentage}%</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
