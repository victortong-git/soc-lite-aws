import React from 'react';
import { X, Filter } from 'lucide-react';

export interface FilterOptions {
  severity?: number[];
  action?: string[];
  status?: string[];
  sourceIp?: string;
  country?: string;
  host?: string;
  ruleId?: string;
  ruleName?: string;
  uri?: string;
  httpMethod?: string[];
  processed?: boolean;
  dateFrom?: string;
  dateTo?: string;
  hasAIAnalysis?: boolean;
}

interface AdvancedFilterPanelProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onClearFilters: () => void;
}

export const AdvancedFilterPanel: React.FC<AdvancedFilterPanelProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
}) => {
  console.log('🎨 AdvancedFilterPanel rendering with filters:', filters);

  const severityOptions = [
    { value: 5, label: 'Critical (5)' },
    { value: 4, label: 'High (4)' },
    { value: 3, label: 'Medium (3)' },
    { value: 2, label: 'Low (2)' },
    { value: 1, label: 'Info (1)' },
  ];

  const actionOptions = [
    { value: 'BLOCK', label: 'Blocked' },
    { value: 'ALLOW', label: 'Allowed' },
    { value: 'COUNT', label: 'Count' },
  ];

  const httpMethodOptions = [
    'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'
  ];

  const statusOptions = [
    { value: 'open', label: 'Open' },
    { value: 'investigating', label: 'Investigating' },
    { value: 'false_positive', label: 'False Positive' },
    { value: 'closed', label: 'Closed' },
  ];

  const handleSeverityToggle = (severity: number) => {
    const currentSeverities = filters.severity || [];
    const newSeverities = currentSeverities.includes(severity)
      ? currentSeverities.filter(s => s !== severity)
      : [...currentSeverities, severity];

    onFiltersChange({
      ...filters,
      severity: newSeverities.length > 0 ? newSeverities : undefined
    });
  };

  const handleActionToggle = (action: string) => {
    const currentActions = filters.action || [];
    const newActions = currentActions.includes(action)
      ? currentActions.filter(a => a !== action)
      : [...currentActions, action];

    onFiltersChange({
      ...filters,
      action: newActions.length > 0 ? newActions : undefined
    });
  };

  const handleHttpMethodToggle = (method: string) => {
    const currentMethods = filters.httpMethod || [];
    const newMethods = currentMethods.includes(method)
      ? currentMethods.filter(m => m !== method)
      : [...currentMethods, method];

    onFiltersChange({
      ...filters,
      httpMethod: newMethods.length > 0 ? newMethods : undefined
    });
  };

  const handleStatusToggle = (status: string) => {
    const currentStatuses = filters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];

    onFiltersChange({
      ...filters,
      status: newStatuses.length > 0 ? newStatuses : undefined
    });
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim() !== '';
      if (typeof value === 'boolean') return true;
      return false;
    });
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h3 className="text-lg font-semibold text-theme-text">Advanced Filters</h3>
        </div>
        {hasActiveFilters() && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Severity Filter */}
        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            Severity
          </label>
          <div className="space-y-2">
            {severityOptions.map(option => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.severity?.includes(option.value) || false}
                  onChange={() => handleSeverityToggle(option.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="text-sm text-theme-text-secondary">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Action Filter */}
        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            Action
          </label>
          <div className="space-y-2">
            {actionOptions.map(option => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.action?.includes(option.value) || false}
                  onChange={() => handleActionToggle(option.value)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="text-sm text-theme-text-secondary">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            Status
          </label>
          <div className="space-y-2">
            {statusOptions.map(option => {
              const isChecked = filters.status?.includes(option.value) || false;
              console.log(`✅ Status checkbox "${option.value}": ${isChecked}`, filters.status);
              return (
                <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleStatusToggle(option.value)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <span className="text-sm text-theme-text-secondary">{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* HTTP Method Filter */}
        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            HTTP Method
          </label>
          <div className="space-y-2">
            {httpMethodOptions.map(method => (
              <label key={method} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.httpMethod?.includes(method) || false}
                  onChange={() => handleHttpMethodToggle(method)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="text-sm text-theme-text-secondary">{method}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Source IP Filter */}
        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            Source IP
          </label>
          <input
            type="text"
            value={filters.sourceIp || ''}
            onChange={(e) => onFiltersChange({ ...filters, sourceIp: e.target.value || undefined })}
            placeholder="e.g., 192.168.1.1"
            className="input-field w-full"
          />
        </div>

        {/* Country Filter */}
        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            Country
          </label>
          <input
            type="text"
            value={filters.country || ''}
            onChange={(e) => onFiltersChange({ ...filters, country: e.target.value || undefined })}
            placeholder="e.g., United States"
            className="input-field w-full"
          />
        </div>

        {/* Host Filter */}
        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            Host
          </label>
          <input
            type="text"
            value={filters.host || ''}
            onChange={(e) => onFiltersChange({ ...filters, host: e.target.value || undefined })}
            placeholder="e.g., example.com"
            className="input-field w-full"
          />
        </div>

        {/* Rule ID Filter */}
        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            Rule ID
          </label>
          <input
            type="text"
            value={filters.ruleId || ''}
            onChange={(e) => onFiltersChange({ ...filters, ruleId: e.target.value || undefined })}
            placeholder="e.g., AWS-AWSManagedRulesCommonRuleSet"
            className="input-field w-full"
          />
        </div>

        {/* Rule Name Filter */}
        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            Rule Name
          </label>
          <input
            type="text"
            value={filters.ruleName || ''}
            onChange={(e) => onFiltersChange({ ...filters, ruleName: e.target.value || undefined })}
            placeholder="Search rule name..."
            className="input-field w-full"
          />
        </div>

        {/* URI Filter */}
        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            URI Pattern
          </label>
          <input
            type="text"
            value={filters.uri || ''}
            onChange={(e) => onFiltersChange({ ...filters, uri: e.target.value || undefined })}
            placeholder="e.g., /api/v1/"
            className="input-field w-full"
          />
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            Date From
          </label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || undefined })}
            className="input-field w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            Date To
          </label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || undefined })}
            className="input-field w-full"
          />
        </div>

        {/* AI Analysis Filter */}
        <div>
          <label className="block text-sm font-medium text-theme-text mb-2">
            AI Analysis Status
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasAIAnalysis === true}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  hasAIAnalysis: e.target.checked ? true : undefined
                })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <span className="text-sm text-theme-text-secondary">Has AI Analysis</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.processed === true}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  processed: e.target.checked ? true : undefined
                })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <span className="text-sm text-theme-text-secondary">Processed Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters() && (
        <div className="mt-6 pt-4 border-t border-theme-border">
          <p className="text-sm font-medium text-theme-text mb-2">Active Filters:</p>
          <div className="flex flex-wrap gap-2">
            {filters.severity && filters.severity.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                Severity: {filters.severity.join(', ')}
                <button
                  onClick={() => onFiltersChange({ ...filters, severity: undefined })}
                  className="hover:text-primary-900 dark:hover:text-primary-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.action && filters.action.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                Action: {filters.action.join(', ')}
                <button
                  onClick={() => onFiltersChange({ ...filters, action: undefined })}
                  className="hover:text-primary-900 dark:hover:text-primary-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.status && filters.status.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                Status: {filters.status.join(', ')}
                <button
                  onClick={() => onFiltersChange({ ...filters, status: undefined })}
                  className="hover:text-primary-900 dark:hover:text-primary-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.sourceIp && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                IP: {filters.sourceIp}
                <button
                  onClick={() => onFiltersChange({ ...filters, sourceIp: undefined })}
                  className="hover:text-primary-900 dark:hover:text-primary-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.host && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                Host: {filters.host}
                <button
                  onClick={() => onFiltersChange({ ...filters, host: undefined })}
                  className="hover:text-primary-900 dark:hover:text-primary-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilterPanel;
