import React from 'react';
import { AlertCircle, Shield, Info } from 'lucide-react';

export interface SeverityInfoTooltipProps {
  inline?: boolean;
  className?: string;
}

export const SeverityInfoTooltip: React.FC<SeverityInfoTooltipProps> = ({
  inline = false,
  className = ''
}) => {
  const severityLevels = [
    {
      level: 5,
      label: 'Critical',
      description: 'Severe security threat requiring immediate action',
      icon: <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />,
      color: 'text-red-700 dark:text-red-300'
    },
    {
      level: 4,
      label: 'High',
      description: 'Serious threat requiring attention',
      icon: <Shield className="w-4 h-4 text-orange-600 dark:text-orange-400" />,
      color: 'text-orange-700 dark:text-orange-300'
    },
    {
      level: 3,
      label: 'Medium',
      description: 'Moderate threat that should be reviewed',
      icon: <Shield className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />,
      color: 'text-yellow-700 dark:text-yellow-300'
    },
    {
      level: 2,
      label: 'Low',
      description: 'Minor concern, low priority',
      icon: <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
      color: 'text-blue-700 dark:text-blue-300'
    },
    {
      level: 1,
      label: 'Info',
      description: 'Informational event, minimal concern',
      icon: <Info className="w-4 h-4 text-gray-600 dark:text-gray-400" />,
      color: 'text-gray-700 dark:text-gray-300'
    },
    {
      level: 0,
      label: 'Safe',
      description: 'Benign traffic, no threat detected',
      icon: <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />,
      color: 'text-green-700 dark:text-green-300'
    }
  ];

  if (inline) {
    return (
      <div className={`bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className}`}>
        <h4 className="text-sm font-semibold text-theme-text mb-3 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Severity Rating Scale (0-5)
        </h4>
        <div className="space-y-2">
          {severityLevels.map((level) => (
            <div key={level.level} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {level.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={`font-semibold text-sm ${level.color}`}>
                    {level.level} - {level.label}
                  </span>
                </div>
                <p className="text-xs text-theme-text-secondary mt-0.5">
                  {level.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Tooltip version (for hover)
  return (
    <div className={`absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 w-72 ${className}`}>
      <h4 className="text-xs font-semibold text-theme-text mb-2">Severity Scale</h4>
      <div className="space-y-1.5">
        {severityLevels.map((level) => (
          <div key={level.level} className="flex items-start gap-2 text-xs">
            <span className={`font-medium ${level.color} w-20 flex-shrink-0`}>
              {level.level} - {level.label}
            </span>
            <span className="text-theme-text-secondary">
              {level.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SeverityInfoTooltip;
