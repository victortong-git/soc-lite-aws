import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import apiClient from '../../api/client';

interface CleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCleanupComplete: () => void;
}

type CleanupOption = 'all' | '30' | '15' | '5' | '1';

interface CleanupPreview {
  total: number;
  oldRecords: number;
  days: number | null;
}

export const CleanupModal: React.FC<CleanupModalProps> = ({
  isOpen,
  onClose,
  onCleanupComplete,
}) => {
  const [selectedOption, setSelectedOption] = useState<CleanupOption>('30');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [result, setResult] = useState<{ deleted: number } | null>(null);

  const cleanupOptions: Array<{ value: CleanupOption; label: string; description: string }> = [
    { value: '30', label: 'Older than 30 days', description: 'Delete records older than 30 days' },
    { value: '15', label: 'Older than 15 days', description: 'Delete records older than 15 days' },
    { value: '5', label: 'Older than 5 days', description: 'Delete records older than 5 days' },
    { value: '1', label: 'Older than 1 day', description: 'Delete records older than 1 day' },
    { value: 'all', label: 'All records', description: 'Delete ALL records (cannot be undone!)' },
  ];

  // Fetch preview whenever option changes
  useEffect(() => {
    if (isOpen) {
      fetchPreview();
    }
  }, [selectedOption, isOpen]);

  const fetchPreview = async () => {
    try {
      setPreviewLoading(true);

      const url = selectedOption === 'all'
        ? '/events/cleanup/preview'
        : `/events/cleanup/preview?days=${selectedOption}`;

      const response = await apiClient.get(url);

      if (response.data.success) {
        setPreview(response.data.data);
      }
    } catch (err: any) {
      console.error('Preview error:', err);
      setError(err.response?.data?.error || 'Failed to fetch preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCleanup = async () => {
    try {
      setLoading(true);
      setError('');

      let response;
      if (selectedOption === 'all') {
        response = await apiClient.post('/events/cleanup/all', {});
      } else {
        response = await apiClient.post('/events/cleanup/old', {
          days: parseInt(selectedOption)
        });
      }

      if (response.data.success) {
        setResult({ deleted: response.data.deleted });
        onCleanupComplete();
      }
    } catch (err: any) {
      console.error('Cleanup error:', err);
      setError(err.response?.data?.error || 'Failed to cleanup events');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    setPreview(null);
    setSelectedOption('30');
    onClose();
  };

  const getDeleteCount = () => {
    if (!preview) return 0;
    return selectedOption === 'all' ? preview.total : preview.oldRecords;
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Cleanup Old Events">
      <div className="space-y-4">
        {result ? (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded">
              <p className="font-semibold">Cleanup Complete</p>
              <p className="text-sm">Successfully deleted {result.deleted} event(s)</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleClose} variant="secondary">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-theme-text">
                Select cleanup option:
              </label>
              <div className="space-y-2">
                {cleanupOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedOption === option.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-700'
                    }`}
                    onClick={() => setSelectedOption(option.value)}
                  >
                    <div className="flex items-start">
                      <input
                        type="radio"
                        name="cleanup-option"
                        value={option.value}
                        checked={selectedOption === option.value}
                        onChange={(e) => setSelectedOption(e.target.value as CleanupOption)}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-theme-text">{option.label}</div>
                        <div className="text-sm text-theme-text-muted">{option.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {previewLoading ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-300 px-4 py-3 rounded">
                <p className="text-sm">Loading preview...</p>
              </div>
            ) : preview ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-300 px-4 py-3 rounded">
                <p className="font-semibold">Preview</p>
                <p className="text-sm">Total events in database: {preview.total}</p>
                <p className="text-sm font-semibold mt-1">
                  Events to be deleted: {getDeleteCount()}
                </p>
                {selectedOption !== 'all' && preview.oldRecords === 0 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                    No events found matching this criteria
                  </p>
                )}
              </div>
            ) : null}

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded">
              <p className="font-semibold">⚠️ Warning</p>
              <p className="text-sm">
                {selectedOption === 'all'
                  ? 'You are about to delete ALL events. This action cannot be undone!'
                  : `You are about to delete events older than ${selectedOption} day(s). This action cannot be undone.`}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button onClick={handleClose} variant="secondary" disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={handleCleanup}
                variant="danger"
                disabled={loading || previewLoading || getDeleteCount() === 0}
              >
                {loading ? 'Deleting...' : `Delete ${getDeleteCount()} Event(s)`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
