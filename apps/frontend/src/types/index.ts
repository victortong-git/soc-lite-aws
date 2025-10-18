export interface User {
  id: number;
  username: string;
  full_name?: string;
  email?: string;
  role: string;
  is_active: boolean;
  last_login?: string;
  created_at?: string;
}

export interface CreateUserData {
  username: string;
  password: string;
  full_name?: string;
  email?: string;
  role?: 'admin' | 'user' | 'analyst';
}

export interface UpdateUserData {
  full_name?: string;
  email?: string;
  role?: 'admin' | 'user' | 'analyst';
  is_active?: boolean;
}

export interface AIAnalysisInsight {
  confidence: number;
  decision: string;
  recommendation?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  riskScore?: number;
  summary?: string;
  reasoning?: string;
  recommendedActions?: string[];
  humanOverride?: boolean;
}

export interface WafLog {
  id: number;
  timestamp: string;
  action: string;
  rule_id?: string;
  rule_name?: string;
  source_ip: string;
  uri?: string;
  http_method?: string;
  http_request?: string;
  country?: string;
  country_code?: string;
  user_agent?: string;
  headers?: any;
  rate_based_rule_list?: any;
  non_terminating_matching_rules?: any;
  event_detail?: any;
  web_acl_id?: string;
  web_acl_name?: string;
  processed: boolean;
  created_at: string;
  updated_at: string;
  request_id: string;
  raw_message?: any;

  // Severity and Status
  severity?: number;
  severity_rating?: number;
  status: string;

  // AI Analysis Fields
  security_analysis?: string;
  follow_up_suggestion?: string;
  analyzed_at?: string;
  analyzed_by?: string;
  ai_analysis?: AIAnalysisInsight;
  ai_insights?: AIAnalysisInsight;
  ai_analysis_timestamp?: string;
  ai_confidence?: number;
  analysis_job_id?: number;
  analysis_job_status?: 'pending' | 'queued' | 'running' | 'completed' | 'failed';

  // Enrichment Data
  threat_score?: number;
  reputation_score?: number;
  is_known_threat?: boolean;
  geo_location?: {
    country: string;
    country_code: string;
    city?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
  };

  // Additional metadata
  incident_id?: number;
  is_test_data?: boolean;
  host?: string;

  // Smart Analysis linkage
  smart_analysis_task_id?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresIn: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  action?: string;
  status?: string;
  severity?: number;
  source_ip?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardStats {
  total_events: number;
  blocked_events: number;
  allowed_events: number;
  count_events?: number;
  open_events: number;
  unprocessed_events: number;
  avg_severity: number;
  critical_events?: number;
  high_severity_events?: number;
  ai_analyzed_events?: number;
  ai_analysis_rate?: number;
  blocked_rate?: number;
  monitored_hosts_count?: number;
  // Trends (percentage change from previous period)
  total_trend?: number;
  blocked_trend?: number;
  critical_trend?: number;
}

export interface EventTrendData {
  time: string;
  timestamp: string;
  total: number;
  blocked: number;
  allowed: number;
  count?: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface SeverityDistribution {
  severity: number;
  severity_label: string;
  count: number;
  percentage: number;
}

export interface ActionDistribution {
  action: string;
  count: number;
  percentage: number;
}

export interface TopSource {
  source_ip: string;
  country?: string;
  country_code?: string;
  count: number;
  blocked_count: number;
  allowed_count: number;
}

export interface TopRule {
  rule_id: string;
  rule_name?: string;
  count: number;
  severity_avg?: number;
}

export interface TopURI {
  uri: string;
  count: number;
  blocked_count: number;
  allowed_count: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  trends?: EventTrendData[];
  severity_distribution?: SeverityDistribution[];
  action_distribution?: ActionDistribution[];
  top_sources?: TopSource[];
  top_rules?: TopRule[];
  top_uris?: TopURI[];
  recent_events?: WafLog[];
}

// ============================================
// Smart AI Analysis Types
// ============================================

export interface SmartAnalysisTask {
  id: number;
  source_ip: string;
  time_group?: string;  // Format: YYYYMMDD-HHMM
  status: 'open' | 'in_review' | 'completed' | 'closed';
  severity_rating?: number;
  security_analysis?: string;
  recommended_actions?: string;
  attack_type?: string;  // Type of attack identified by AI
  num_linked_events: number;
  analysis_job_status?: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'on_hold';
  ai_prompt?: string;  // Raw prompt sent to AI agent
  ai_response?: string;  // Raw response from AI agent
  created_at: Date;
  updated_at: Date;
  analyzed_at?: Date;
  analyzed_by?: string;
}

export interface SmartAnalysisJob {
  id: number;
  task_id: number;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'on_hold';
  priority: number;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  attempts: number;
  max_attempts: number;
  error_message?: string;
  processing_duration_ms?: number;
}

export interface SmartAnalysisEventLink {
  id: number;
  smart_analysis_task_id: number;
  waf_log_id: number;
  created_at: Date;
}

export interface SmartAnalysisStats {
  total_tasks: number;
  open_tasks: number;
  in_review_tasks: number;
  completed_tasks: number;
  closed_tasks: number;
  critical_tasks: number;
  high_tasks: number;
  total_linked_events: number;
  avg_severity: number;
}

export interface SmartJobStats {
  pending: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  on_hold: number;
  total: number;
}

export interface SmartTaskFilters {
  page?: number;
  limit?: number;
  status?: string;
  severity?: number | string;
  source_ip?: string;
  date_from?: string;
  date_to?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SmartJobFilters {
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SmartAnalysisSummary {
  source_ip: string;
  country: string;
  total_events: number;
  time_range: {
    first: string;
    last: string;
    duration_minutes: number;
  };
  unique_uris: string[];
  unique_rules: string[];
  action_breakdown: { [key: string]: number };
  method_breakdown: { [key: string]: number };
}

export interface SeverityDistribution {
  severity: number;
  severity_label: string;
  count: number;
  percentage: number;
}

// ============================================
// Escalation Event Types
// ============================================

export interface EscalationEvent {
  id: number;
  title: string;
  message: string;
  detail_payload?: any;
  severity: number;
  source_type: 'waf_event' | 'smart_task' | 'attack_campaign';
  source_waf_event_id?: number;
  source_smart_task_id?: number;
  created_at: string;
  completed_sns: boolean;
  completed_incident: boolean;
  completed_waf_blocklist: boolean;
  sns_sent_at?: string;
  sns_message_id?: string;
  sns_error?: string;
  servicenow_incident_number?: string;
  servicenow_incident_created_at?: string;
  servicenow_incident_sys_id?: string;
  servicenow_incident_error?: string;
  waf_blocklist_added_at?: string;
  waf_blocklist_ip?: string;
  waf_blocklist_error?: string;
  updated_at: string;
}

export interface EscalationStats {
  total_escalations: number;
  pending_sns: number;
  completed_sns: number;
  failed_sns: number;
  completed_incident: number;
  pending_incident?: number;
  failed_incident?: number;
  critical_escalations: number;
  high_escalations: number;
  waf_event_escalations: number;
  smart_task_escalations: number;
}

// ============================================
// WAF Blocklist Types
// ============================================

export interface BlocklistIp {
  id: number;
  ip_address: string;
  reason?: string;
  severity: number;
  source_escalation_id?: number;
  source_waf_event_id?: number;
  created_at: string;
  last_seen_at: string;
  block_count: number;
  is_active: boolean;
  removed_at?: string;
  updated_at: string;
}

export interface BlocklistStats {
  total_blocked_ips: number;
  active_blocks: number;
  removed_blocks: number;
  total_block_events: number;
  critical_severity_ips: number;
  high_severity_ips: number;
  blocked_last_24h: number;
  blocked_last_7d: number;
  max_repeat_offender: number;
  avg_block_count: string;
  top_repeat_offenders: Array<{
    ip_address: string;
    block_count: number;
    severity: number;
    last_seen_at: string;
  }>;
}

export interface BlocklistFilters {
  page?: number;
  limit?: number;
  is_active?: boolean;
  severity?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
