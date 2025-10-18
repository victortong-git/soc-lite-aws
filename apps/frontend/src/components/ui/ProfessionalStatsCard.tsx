import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive?: boolean;
    label?: string;
  };
  loading?: boolean;
  subtitle?: string;
  className?: string;
}

export const ProfessionalStatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = 'text-primary-600 dark:text-primary-400',
  trend,
  loading = false,
  subtitle,
  className = '',
}) => {
  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.value === 0) return 'text-gray-600 dark:text-slate-400';
    // For security metrics, increasing trends are typically bad (red), decreasing is good (green)
    if (trend.isPositive === false) {
      return trend.value > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
    }
    // For positive metrics, increasing is good
    return trend.value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  const getTrendIcon = () => {
    if (!trend || trend.value === 0) return Minus;
    return trend.value > 0 ? TrendingUp : TrendingDown;
  };

  const TrendIcon = getTrendIcon();

  if (loading) {
    return (
      <div className={`stat-card ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
            <div className="w-12 h-12 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
          </div>
          <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-20 mb-2"></div>
          <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`stat-card group ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="stat-label text-xs sm:text-sm">{title}</p>
        </div>
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center bg-opacity-10 dark:bg-opacity-20 ${iconColor.replace('text-', 'bg-')}`}>
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="stat-value text-2xl sm:text-3xl">{value}</p>

        {(trend || subtitle) && (
          <div className="flex items-center gap-3">
            {trend && (
              <div className={`stat-trend ${getTrendColor()} flex items-center gap-1`}>
                <TrendIcon className="w-3 h-3" />
                <span className="font-semibold">
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                </span>
                {trend.label && (
                  <span className="hidden sm:inline text-theme-text-muted ml-1">
                    {trend.label}
                  </span>
                )}
              </div>
            )}
            {subtitle && !trend && (
              <p className="text-xs text-theme-text-muted">{subtitle}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessionalStatsCard;
