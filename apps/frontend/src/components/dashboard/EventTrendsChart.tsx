import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { EventTrendData } from '../../types';

interface EventTrendsChartProps {
  data: EventTrendData[];
  loading?: boolean;
  title?: string;
  height?: number;
}

export const EventTrendsChart: React.FC<EventTrendsChartProps> = ({
  data,
  loading = false,
  title = 'Event Trends',
  height = 300,
}) => {
  const [selectedLines, setSelectedLines] = useState({
    total: true,
    blocked: true,
    allowed: true,
    critical: true,
    high: true,
    medium: false,
    low: false,
  });

  // Format timestamp to local browser time with date and time
  const formatTimestamp = (timestamp: string | Date): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      // If today, show only time
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else {
      // If not today, show date and time
      return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
  };

  // Transform data with formatted timestamps in user's local timezone
  const formattedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      time: formatTimestamp(item.timestamp),
      originalTimestamp: item.timestamp
    }));
  }, [data]);

  const toggleLine = (lineKey: keyof typeof selectedLines) => {
    setSelectedLines(prev => ({
      ...prev,
      [lineKey]: !prev[lineKey]
    }));
  };

  const chartColors = {
    total: '#0ea5e9',     // Primary blue
    blocked: '#ef4444',   // Red
    allowed: '#22c55e',   // Green
    critical: '#dc2626',  // Dark red
    high: '#f97316',      // Orange
    medium: '#eab308',    // Yellow
    low: '#3b82f6',       // Blue
  };

  const getLineConfig = () => [
    {
      key: 'critical',
      name: 'Critical (5)',
      stroke: chartColors.critical,
      strokeWidth: 3,
      dot: { fill: chartColors.critical, strokeWidth: 2, r: 4 }
    },
    {
      key: 'high',
      name: 'High (4)',
      stroke: chartColors.high,
      strokeWidth: 2,
      dot: { fill: chartColors.high, strokeWidth: 2, r: 3 }
    },
    {
      key: 'medium',
      name: 'Medium (3)',
      stroke: chartColors.medium,
      strokeWidth: 2,
      dot: { fill: chartColors.medium, strokeWidth: 2, r: 3 }
    },
    {
      key: 'low',
      name: 'Low (1-2)',
      stroke: chartColors.low,
      strokeWidth: 2,
      dot: { fill: chartColors.low, strokeWidth: 2, r: 3 }
    },
    {
      key: 'blocked',
      name: 'Blocked',
      stroke: chartColors.blocked,
      strokeWidth: 2,
      dot: { fill: chartColors.blocked, strokeWidth: 2, r: 4 },
      strokeDasharray: '5 5'
    },
    {
      key: 'allowed',
      name: 'Allowed',
      stroke: chartColors.allowed,
      strokeWidth: 2,
      dot: { fill: chartColors.allowed, strokeWidth: 2, r: 4 },
      strokeDasharray: '5 5'
    },
    {
      key: 'total',
      name: 'Total',
      stroke: chartColors.total,
      strokeWidth: 2,
      dot: { fill: chartColors.total, strokeWidth: 2, r: 4 },
      strokeDasharray: '3 3'
    }
  ];

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-gray-900 dark:text-white font-medium mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between space-x-3">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  ></div>
                  <span className="text-gray-700 dark:text-gray-300 text-sm">{entry.name}</span>
                </div>
                <span className="text-gray-900 dark:text-white font-medium">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="card">
        <div className="h-64 flex items-center justify-center">
          <div className="loading-spinner"></div>
          <span className="text-theme-text-secondary ml-3">Loading event trends...</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-theme-text mb-4">{title}</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="text-theme-text-secondary mb-2">No event trend data available</div>
            <div className="text-sm text-theme-text-muted">Data will appear once events are logged</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-theme-text mb-3">{title}</h3>

        {/* Compact Legend */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {getLineConfig().map((line) => (
            <button
              key={line.key}
              onClick={() => toggleLine(line.key as keyof typeof selectedLines)}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-xs transition-opacity ${
                selectedLines[line.key as keyof typeof selectedLines]
                  ? 'opacity-100'
                  : 'opacity-50'
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: line.stroke }}
              ></div>
              <span className="text-theme-text-secondary">{line.name}</span>
              <span className="text-theme-text-muted font-mono text-xs">
                {formattedData.reduce((sum, item) => sum + (item[line.key as keyof EventTrendData] as number || 0), 0)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" />
            <XAxis
              dataKey="time"
              stroke="rgb(var(--color-text-secondary))"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              stroke="rgb(var(--color-text-secondary))"
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={customTooltip} />

            {getLineConfig().map((line) => (
              selectedLines[line.key as keyof typeof selectedLines] && (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  stroke={line.stroke}
                  strokeWidth={line.strokeWidth}
                  dot={line.dot}
                  strokeDasharray={line.strokeDasharray}
                  connectNulls={false}
                />
              )
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-2 pt-3 mt-3 border-t border-theme-border">
        {getLineConfig().map((line) => {
          const total = formattedData.reduce((sum, item) => sum + (item[line.key as keyof EventTrendData] as number || 0), 0);
          const latest = formattedData[formattedData.length - 1]?.[line.key as keyof EventTrendData] as number || 0;

          return (
            <div key={line.key} className="text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: line.stroke }}
                ></div>
                <span className="text-xs text-theme-text-secondary truncate">{line.name.split(' ')[0]}</span>
              </div>
              <div className="text-sm font-bold text-theme-text">{total}</div>
              <div className="text-xs text-theme-text-muted">Latest: {latest}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EventTrendsChart;
