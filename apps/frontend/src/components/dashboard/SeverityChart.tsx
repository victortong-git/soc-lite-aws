import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { PieChartIcon, BarChart3 } from 'lucide-react';

interface SeverityChartProps {
  data: Array<{ name: string; value: number; severity?: number; severity_label?: string }>;
}

const COLORS: { [key: string]: string } = {
  '5': '#ef4444', // Critical - red
  '4': '#f97316', // High - orange
  '3': '#eab308', // Medium - yellow
  '2': '#10b981', // Low - green
  '1': '#3b82f6', // Info - blue
  '0': '#22c55e', // Safe - green
  'null': '#94a3b8', // Unprocessed - gray
};

const SEVERITY_LABELS: { [key: string]: string } = {
  '5': 'Critical',
  '4': 'High',
  '3': 'Medium',
  '2': 'Low',
  '1': 'Info',
  '0': 'Safe',
  'null': 'Unprocessed'
};

export const SeverityChart: React.FC<SeverityChartProps> = ({ data }) => {
  const [chartType, setChartType] = useState<'pie' | 'bar'>('bar');

  // Transform data to include proper labels based on severity value
  const chartData = data.map((item) => {
    // Handle severity - can be number or null
    const severity = item.severity !== undefined ? item.severity : (item.name === 'null' ? null : parseInt(item.name));
    const severityKey = severity === null ? 'null' : severity.toString();
    const label = item.severity_label || SEVERITY_LABELS[severityKey] || `Severity ${item.name}`;
    
    return {
      name: label,
      value: item.value,
      severity: severity,
      severityKey: severityKey,
      fill: COLORS[severityKey] || '#94a3b8'
    };
  }).filter(item => item.value > 0)
    .sort((a, b) => {
      // Sort: null (unprocessed) last, then by severity descending
      if (a.severity === null) return 1;
      if (b.severity === null) return -1;
      return b.severity - a.severity;
    });

  // Calculate total and percentages
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-theme-text">Severity Distribution</h3>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-center h-64 text-theme-text-secondary">
            No data available
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-theme-text">Severity Distribution</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setChartType('bar')}
              className={`p-2 rounded ${
                chartType === 'bar'
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                  : 'text-theme-text-secondary hover:bg-theme-bg-secondary'
              }`}
              title="Bar Chart"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`p-2 rounded ${
                chartType === 'pie'
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                  : 'text-theme-text-secondary hover:bg-theme-bg-secondary'
              }`}
              title="Pie Chart"
            >
              <PieChartIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis 
                dataKey="name" 
                className="text-xs fill-current text-theme-text-secondary"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis 
                className="text-xs fill-current text-theme-text-secondary"
                tick={{ fill: 'currentColor' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.5rem'
                }}
                formatter={(value: number) => [
                  `${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`,
                  'Count'
                ]}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.5rem'
                }}
                formatter={(value: number) => [
                  `${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`,
                  'Count'
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
        
        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-theme-border">
          <div className="text-center">
            <p className="text-xs text-theme-text-secondary">Total Events</p>
            <p className="text-lg font-semibold text-theme-text">{total.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-theme-text-secondary">Categories</p>
            <p className="text-lg font-semibold text-theme-text">{chartData.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-theme-text-secondary">Highest</p>
            <p className="text-lg font-semibold text-theme-text">{chartData[0]?.name || 'N/A'}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
