import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import axios from 'axios';
import type { WafLog } from '../../types';

const API_URL = import.meta.env.VITE_API_URL || 'https://your-api-url.com/api';

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: WafLog | null;
  onAnalysisComplete: () => void;
}

export const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({
  isOpen,
  onClose,
  event,
  onAnalysisComplete,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!event) return;

    try {
      setAnalyzing(true);
      setError('');

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/events/${event.id}/analyze`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setAnalysisResult(response.data);
        onAnalysisComplete();
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.response?.data?.message || 'Failed to analyze event');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClose = () => {
    setAnalysisResult(null);
    setError('');
    onClose();
  };

  const getSeverityColor = (severity: number) => {
    if (severity === 0) return 'bg-gray-100 text-gray-800';
    if (severity === 1 || severity === 2) return 'bg-blue-100 text-blue-800';
    if (severity === 3) return 'bg-yellow-100 text-yellow-800';
    if (severity === 4) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getSeverityLabel = (severity: number) => {
    const labels = ['Info', 'Low', 'Medium-Low', 'Medium', 'High', 'Critical'];
    return labels[severity] || 'Unknown';
  };

  if (!event) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="AI Security Analysis">
      <div className="space-y-6">
        {/* Event Info */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">Event Details</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">ID:</span> #{event.id}
            </div>
            <div>
              <span className="text-gray-600">Source IP:</span> {event.source_ip}
            </div>
            <div>
              <span className="text-gray-600">Action:</span> {event.action}
            </div>
            <div>
              <span className="text-gray-600">URI:</span>{' '}
              {event.uri?.substring(0, 30)}
              {(event.uri?.length || 0) > 30 ? '...' : ''}
            </div>
          </div>
        </div>

        {/* Analysis Results */}
        {analysisResult ? (
          <div className="space-y-4">
            {/* Severity */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Severity Rating</h4>
              <div className="flex items-center space-x-3">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${getSeverityColor(
                    analysisResult.analysis.severity_rating
                  )}`}
                >
                  {analysisResult.analysis.severity_rating} -{' '}
                  {getSeverityLabel(analysisResult.analysis.severity_rating)}
                </span>
              </div>
            </div>

            {/* Security Analysis */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Security Analysis</h4>
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">
                {analysisResult.analysis.security_analysis}
              </p>
            </div>

            {/* Follow-up Suggestions */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Recommended Actions</h4>
              <p className="text-sm text-gray-700 bg-green-50 p-3 rounded-lg">
                {analysisResult.analysis.follow_up_suggestion}
              </p>
            </div>

            {/* Triage Action */}
            {analysisResult.triage && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Triage Action</h4>
                <div className="text-sm bg-purple-50 p-3 rounded-lg space-y-1">
                  <div>
                    <span className="font-medium">Action Taken:</span>{' '}
                    <span className="capitalize">{analysisResult.triage.action_taken}</span>
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>{' '}
                    <span className="capitalize">{analysisResult.triage.status_update}</span>
                  </div>
                  {analysisResult.triage.email_sent && (
                    <div className="text-green-700">✓ Email notification sent</div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-gray-500 pt-2 border-t">
              <div>Analyzed by: {analysisResult.analysis.analyzed_by}</div>
              <div>Analyzed at: {new Date(analysisResult.analysis.analyzed_at).toLocaleString()}</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            {analyzing ? (
              <div>
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-sm text-gray-600">
                  Analyzing event with AI Security Agent...
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  This may take a few moments
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-4">
                  Click the button below to analyze this event using AI-powered security analysis.
                </p>
                <Button onClick={handleAnalyze} variant="primary">
                  🤖 Start AI Analysis
                </Button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button onClick={handleClose} variant="secondary">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
