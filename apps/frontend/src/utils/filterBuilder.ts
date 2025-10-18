import type { FilterOptions } from '../components/events/AdvancedFilterPanel';

/**
 * Build API-ready filter parameters from FilterOptions
 * Converts arrays to comma-separated strings and maps frontend field names to backend field names
 */
export const buildFilterParams = (filters: FilterOptions): Record<string, any> => {
  const params: Record<string, any> = {};

  // Array filters - convert to comma-separated strings
  if (filters.severity && filters.severity.length > 0) {
    params.severity = filters.severity.join(',');
  }

  if (filters.action && filters.action.length > 0) {
    params.action = filters.action.join(',');
  }

  if (filters.status && filters.status.length > 0) {
    params.status = filters.status.join(',');
  }

  if (filters.httpMethod && filters.httpMethod.length > 0) {
    params.http_method = filters.httpMethod.join(',');
  }

  // String filters - direct mapping with field name conversion
  if (filters.sourceIp) {
    params.source_ip = filters.sourceIp;
  }

  if (filters.country) {
    params.country = filters.country;
  }

  if (filters.host) {
    params.host = filters.host;
  }

  if (filters.ruleId) {
    params.rule_id = filters.ruleId;
  }

  if (filters.ruleName) {
    params.rule_name = filters.ruleName;
  }

  if (filters.uri) {
    params.uri = filters.uri;
  }

  // Date filters
  if (filters.dateFrom) {
    params.date_from = filters.dateFrom;
  }

  if (filters.dateTo) {
    params.date_to = filters.dateTo;
  }

  // Boolean filters
  if (filters.hasAIAnalysis !== undefined) {
    params.has_ai_analysis = filters.hasAIAnalysis;
  }

  if (filters.processed !== undefined) {
    params.processed = filters.processed;
  }

  return params;
};
