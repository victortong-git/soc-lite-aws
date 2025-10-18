import React from 'react';

export interface SeverityBadgeProps {
  severity: number | null | undefined;
  showNumber?: boolean;
  className?: string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, showNumber = false, className = '' }) => {
  const getSeverityConfig = (sev: number | null | undefined) => {
    if (sev === null || sev === undefined) {
      return {
        label: 'Unprocessed',
        classes: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600',
      };
    }
    
    switch (sev) {
      case 5:
        return {
          label: 'Critical',
          classes: 'badge-critical',
        };
      case 4:
        return {
          label: 'High',
          classes: 'badge-high',
        };
      case 3:
        return {
          label: 'Medium',
          classes: 'badge-medium',
        };
      case 2:
        return {
          label: 'Low',
          classes: 'badge-low',
        };
      case 1:
        return {
          label: 'Info',
          classes: 'badge-info',
        };
      case 0:
        return {
          label: 'Safe',
          classes: 'badge-safe',
        };
      default:
        return {
          label: 'Unknown',
          classes: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600',
        };
    }
  };

  const config = getSeverityConfig(severity);
  const displayLabel = showNumber && severity !== null && severity !== undefined 
    ? `${config.label} (${severity})` 
    : config.label;

  return (
    <span className={`badge ${config.classes} ${className}`}>
      {displayLabel}
    </span>
  );
};

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getStatusConfig = (st: string) => {
    const statusLower = st.toLowerCase();

    switch (statusLower) {
      case 'block':
      case 'blocked':
        return {
          label: 'BLOCKED',
          classes: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700',
        };
      case 'allow':
      case 'allowed':
        return {
          label: 'ALLOWED',
          classes: 'badge-success',
        };
      case 'count':
        return {
          label: 'COUNT',
          classes: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700',
        };
      case 'pending':
      case 'unprocessed':
        return {
          label: 'PENDING',
          classes: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700',
        };
      default:
        return {
          label: status.toUpperCase(),
          classes: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`badge ${config.classes} ${className}`}>
      {config.label}
    </span>
  );
};

export interface ConfidenceBadgeProps {
  confidence: number;
  className?: string;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence, className = '' }) => {
  const getConfidenceConfig = (conf: number) => {
    if (conf >= 90) {
      return {
        label: `${conf}%`,
        classes: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700',
      };
    } else if (conf >= 75) {
      return {
        label: `${conf}%`,
        classes: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700',
      };
    } else if (conf >= 60) {
      return {
        label: `${conf}%`,
        classes: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700',
      };
    } else {
      return {
        label: `${conf}%`,
        classes: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700',
      };
    }
  };

  const config = getConfidenceConfig(confidence);

  return (
    <span className={`badge text-xs font-semibold ${config.classes} ${className}`}>
      {config.label}
    </span>
  );
};

export interface AnalysisStatusBadgeProps {
  isAnalyzed: boolean;
  confidence?: number;
  className?: string;
}

export const AnalysisStatusBadge: React.FC<AnalysisStatusBadgeProps> = ({
  isAnalyzed,
  confidence,
  className = ''
}) => {
  if (isAnalyzed) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className="badge badge-success text-xs">
          ✓ Analyzed
        </span>
        {confidence !== undefined && confidence !== null && (
          <ConfidenceBadge confidence={confidence} />
        )}
      </div>
    );
  }

  return (
    <span className={`badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 text-xs ${className}`}>
      Not Analyzed
    </span>
  );
};

export default {
  SeverityBadge,
  StatusBadge,
  ConfidenceBadge,
  AnalysisStatusBadge,
};
