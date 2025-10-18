import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = 'text-primary-600 dark:text-primary-400',
  trend,
  className = ''
}) => {
  return (
    <Card hover className={className}>
      <div className="px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-theme-text-secondary">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-theme-text">
              {value}
            </p>
            {trend && (
              <p className={`mt-2 text-sm font-medium ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg bg-primary-50 dark:bg-primary-950`}>
            <Icon className={`w-8 h-8 ${iconColor}`} />
          </div>
        </div>
      </div>
    </Card>
  );
};
