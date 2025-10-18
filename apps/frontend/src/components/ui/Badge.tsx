import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = ''
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full border transition-colors duration-200';

  const variants = {
    default: 'bg-theme-surface-secondary text-theme-text border-theme-border',
    primary: 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200 border-primary-200 dark:border-primary-700',
    success: 'bg-status-resolved text-status-resolved-text border-status-resolved-border',
    warning: 'bg-status-investigating text-status-investigating-text border-status-investigating-border',
    danger: 'bg-status-new text-status-new-text border-status-new-border',
    info: 'bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 border-primary-200 dark:border-primary-800',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
};

export interface SeverityBadgeProps {
  severity: number;
  showNumber?: boolean;
  className?: string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, showNumber = false, className = '' }) => {
  const getSeverityConfig = (sev: number) => {
    if (sev >= 5) {
      return {
        label: 'Critical',
        color: 'bg-severity-critical text-white',
      };
    } else if (sev >= 4) {
      return {
        label: 'High',
        color: 'bg-severity-high text-white',
      };
    } else if (sev >= 3) {
      return {
        label: 'Medium',
        color: 'bg-severity-medium text-gray-900',
      };
    } else if (sev >= 2) {
      return {
        label: 'Low',
        color: 'bg-severity-low text-white',
      };
    } else if (sev === 1) {
      return {
        label: 'Info',
        color: 'bg-severity-info text-white',
      };
    } else {
      return {
        label: 'Safe',
        color: 'bg-green-500 text-white',
      };
    }
  };

  const config = getSeverityConfig(severity);
  const displayLabel = showNumber ? `${config.label} (${severity})` : config.label;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${config.color} ${className}`}
    >
      {displayLabel}
    </span>
  );
};

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getStatusColor = (status: string) => {
    const upperStatus = status.toUpperCase();
    if (upperStatus === 'BLOCK') {
      return 'bg-status-new text-status-new-text border-status-new-border';
    } else if (upperStatus === 'ALLOW') {
      return 'bg-status-resolved text-status-resolved-text border-status-resolved-border';
    }
    return 'bg-status-investigating text-status-investigating-text border-status-investigating-border';
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium border ${getStatusColor(
        status
      )} ${className}`}
    >
      {status}
    </span>
  );
};
