import React from 'react';
import { Bot, Shield, Star, Clock, Zap, CheckCircle, AlertTriangle, ShieldAlert, RefreshCw } from 'lucide-react';
import type { WafLog } from '../../types';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

interface EventAIAnalysisDisplayProps {
  event: WafLog;
  analysisJobStatus?: string | null;
}

export const EventAIAnalysisDisplay: React.FC<EventAIAnalysisDisplayProps> = ({ event, analysisJobStatus }) => {
  // Check if event has any AI analysis
  const hasAnalysis = !!(event.security_analysis || event.ai_analysis);

  // Show loading banner if job is queued or running
  const isJobPending = analysisJobStatus && ['pending', 'queued', 'running'].includes(analysisJobStatus);

  if (!hasAnalysis && !isJobPending) {
    return null;
  }

  // If job is pending but no analysis yet, show loading state
  if (isJobPending && !hasAnalysis) {
    return (
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg shadow-sm">
        <div className="p-6 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              AI Security Analysis
            </h3>
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-col items-center justify-center py-8">
            <RefreshCw className="w-12 h-12 animate-spin text-primary-600 dark:text-primary-400 mb-4" />
            <h4 className="text-lg font-semibold text-theme-text mb-2">
              {analysisJobStatus === 'running' ? 'Analysis in Progress' : 'Analysis Queued'}
            </h4>
            <p className="text-sm text-theme-text-secondary text-center max-w-md">
              {analysisJobStatus === 'running'
                ? 'AI is currently analyzing this security event. This may take 10-30 seconds...'
                : 'Your analysis request is queued. It will begin processing shortly...'}
            </p>
            <p className="text-xs text-theme-text-muted mt-4">
              Status: <span className="font-medium">{analysisJobStatus}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check if content was blocked by Bedrock content filters
  const isBedrockBlocked =
    event.security_analysis?.includes('blocked by our content filters') ||
    event.security_analysis?.includes('blocked by content filter') ||
    event.follow_up_suggestion?.includes('blocked by our content filters') ||
    event.follow_up_suggestion?.includes('blocked by content filter');

  const bedrockBlockMessage = "AWS Bedrock's content safety filters blocked the AI analysis for this event. This typically occurs when the AI detects that generating detailed analysis could expose sensitive security information or attack techniques.";

  // Helper function to clean up markdown text
  const cleanMarkdown = (text: string): string => {
    if (!text) return text;
    // Remove standalone ** at the beginning of lines or text
    return text
      .replace(/^\*\*\s*\n/gm, '') // Remove ** followed by newline at start of line
      .replace(/^\*\*\s*$/gm, '')  // Remove ** on a line by itself
      .trim();
  };

  // Get severity color
  const getSeverityColor = (severity?: number) => {
    switch (severity) {
      case 5:
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
      case 4:
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800';
      case 3:
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
      case 2:
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
      case 1:
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800';
    }
  };

  const getSeverityLabel = (severity?: number) => {
    switch (severity) {
      case 5:
        return 'Critical';
      case 4:
        return 'High';
      case 3:
        return 'Medium';
      case 2:
        return 'Low';
      case 1:
        return 'Info';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-lg shadow-sm">
      <div className="p-6 border-b border-primary-200 dark:border-primary-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            AI Security Analysis
          </h3>
          {event.analyzed_by && (
            <span className="text-xs text-theme-text-secondary">
              by {event.analyzed_by}
            </span>
          )}
        </div>
      </div>

      {/* Bedrock Content Filter Block Banner */}
      {isBedrockBlocked && (
        <div className="mx-6 mt-6 bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-500 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-1">
                Content Blocked by AWS Bedrock Safety Filters
              </h4>
              <p className="text-xs text-orange-700 dark:text-orange-400 leading-relaxed">
                {bedrockBlockMessage}
              </p>
              <div className="mt-3 text-xs text-orange-600 dark:text-orange-500">
                <strong>Why this happened:</strong> The AI detected that this security event involves sensitive attack patterns (e.g., credential harvesting, exploit attempts) where generating detailed analysis could expose security vulnerabilities or attack techniques.
              </div>
              <div className="mt-2 text-xs text-orange-600 dark:text-orange-500">
                <strong>What this means:</strong> Your WAF successfully blocked this malicious request. The AI cannot provide detailed analysis due to safety constraints, but the event severity and basic information are still available above.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Analysis Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Severity Rating */}
          {event.severity_rating !== undefined && event.severity_rating !== null && (
            <div className="bg-card-background border border-theme-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-theme-text-secondary" />
                <span className="text-xs text-theme-text-secondary font-medium">
                  Severity Rating
                </span>
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-semibold ${getSeverityColor(event.severity_rating)}`}>
                <span className="text-lg">{event.severity_rating}</span>
                <span className="text-sm">{getSeverityLabel(event.severity_rating)}</span>
              </div>
            </div>
          )}

          {/* AI Confidence */}
          {event.ai_confidence !== undefined && event.ai_confidence !== null && (
            <div className="bg-card-background border border-theme-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-theme-text-secondary" />
                <span className="text-xs text-theme-text-secondary font-medium">
                  AI Confidence
                </span>
              </div>
              <div className="space-y-2">
                <span className="text-lg font-semibold text-theme-text">
                  {event.ai_confidence}%
                </span>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${event.ai_confidence}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* Analysis Timestamp */}
          {event.analyzed_at && (
            <div className="bg-card-background border border-theme-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-theme-text-secondary" />
                <span className="text-xs text-theme-text-secondary font-medium">
                  Analyzed At
                </span>
              </div>
              <span className="text-sm font-medium text-theme-text">
                {new Date(event.analyzed_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Security Analysis - Always show, even if blocked */}
        {event.security_analysis && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h4 className="text-sm font-semibold text-theme-text">
                Security Analysis {isBedrockBlocked && <span className="text-xs text-orange-600 dark:text-orange-400">(Raw Bedrock Response)</span>}
              </h4>
            </div>
            <div className="bg-card-background border border-theme-border rounded-lg p-4">
              <div className="text-sm">
                <MarkdownRenderer content={cleanMarkdown(event.security_analysis)} />
              </div>
            </div>
          </div>
        )}

        {/* Follow-up Suggestions - Always show, even if blocked */}
        {event.follow_up_suggestion && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <h4 className="text-sm font-semibold text-theme-text">
                Recommended Actions {isBedrockBlocked && <span className="text-xs text-orange-600 dark:text-orange-400">(Raw Bedrock Response)</span>}
              </h4>
            </div>
            <div className="bg-card-background border border-theme-border rounded-lg p-4">
              <div className="text-sm">
                <MarkdownRenderer content={cleanMarkdown(event.follow_up_suggestion)} />
              </div>
            </div>
          </div>
        )}

        {/* AI Analysis JSON (if available) */}
        {event.ai_analysis && typeof event.ai_analysis === 'object' && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h4 className="text-sm font-semibold text-theme-text">Detailed AI Analysis</h4>
            </div>
            <div className="bg-card-background border border-theme-border rounded-lg p-4">
              <pre className="text-xs text-theme-text font-mono overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(event.ai_analysis, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Status Indicator */}
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="w-4 h-4" />
          <span>Analysis completed successfully</span>
        </div>
      </div>
    </div>
  );
};
