import React from 'react';
import { Code, Shield, List, FileText } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import type { WafLog } from '../../types';

interface EventMetadataGridProps {
  event: WafLog;
}

export const EventMetadataGrid: React.FC<EventMetadataGridProps> = ({ event }) => {
  // Helper function to safely format JSON
  const formatJSON = (data: any): string => {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
  };

  return (
    <div className="space-y-6">
      {/* Request Details */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
            <Code className="w-5 h-5" />
            Request Details
          </h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                HTTP Method
              </label>
              <p className="text-sm text-theme-text font-mono">
                {event.http_method || 'N/A'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                URI
              </label>
              <p className="text-sm text-theme-text font-mono break-all">
                {event.uri || 'N/A'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                User Agent
              </label>
              <p className="text-sm text-theme-text break-all">
                {event.user_agent || 'N/A'}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* WAF Rules */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
            <Shield className="w-5 h-5" />
            WAF Rules
          </h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                Rule ID
              </label>
              <p className="text-sm text-theme-text font-mono break-all">
                {event.rule_id || 'N/A'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                Rule Name
              </label>
              <p className="text-sm text-theme-text">
                {event.rule_name || 'N/A'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                Web ACL ID
              </label>
              <p className="text-sm text-theme-text font-mono break-all">
                {event.web_acl_id || 'N/A'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-1">
                Web ACL Name
              </label>
              <p className="text-sm text-theme-text">
                {event.web_acl_name || 'N/A'}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* HTTP Headers */}
      {event.headers && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
              <List className="w-5 h-5" />
              HTTP Headers
            </h3>
          </CardHeader>
          <CardBody>
            <div className="w-full overflow-x-auto">
              <pre className="bg-theme-surface p-4 rounded-lg border border-theme-border text-xs text-theme-text font-mono whitespace-pre-wrap break-words">
                {formatJSON(event.headers)}
              </pre>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Event Detail */}
      {event.event_detail && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Event Detail
            </h3>
          </CardHeader>
          <CardBody>
            <div className="w-full overflow-x-auto">
              <pre className="bg-theme-surface p-4 rounded-lg border border-theme-border text-xs text-theme-text font-mono whitespace-pre-wrap break-words">
                {formatJSON(event.event_detail)}
              </pre>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Additional Rules */}
      {(event.rate_based_rule_list || event.non_terminating_matching_rules) && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Additional Rules
            </h3>
          </CardHeader>
          <CardBody>
            {event.rate_based_rule_list && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Rate-Based Rules
                </label>
                <div className="w-full overflow-x-auto">
                  <pre className="bg-theme-surface p-4 rounded-lg border border-theme-border text-xs text-theme-text font-mono whitespace-pre-wrap break-words">
                    {formatJSON(event.rate_based_rule_list)}
                  </pre>
                </div>
              </div>
            )}
            {event.non_terminating_matching_rules && (
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Non-Terminating Matching Rules
                </label>
                <div className="w-full overflow-x-auto">
                  <pre className="bg-theme-surface p-4 rounded-lg border border-theme-border text-xs text-theme-text font-mono whitespace-pre-wrap break-words">
                    {formatJSON(event.non_terminating_matching_rules)}
                  </pre>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Raw CloudWatch Message */}
      {event.raw_message && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
              <Code className="w-5 h-5" />
              Raw CloudWatch Message
            </h3>
          </CardHeader>
          <CardBody>
            <div className="w-full overflow-hidden">
              <pre className="bg-neutral-900 dark:bg-neutral-950 text-green-400 p-4 rounded-lg text-xs font-mono whitespace-pre overflow-x-scroll">
                {formatJSON(event.raw_message)}
              </pre>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
