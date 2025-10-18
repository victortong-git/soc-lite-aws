import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://your-api-url.com/api';

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventIds: number[];
  onDeleteComplete: () => void;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({
  isOpen,
  onClose,
  eventIds,
  onDeleteComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ deleted: number; failed: number } | null>(null);

  const handleBulkDelete = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API_URL}/events/bulk-delete`,
        { ids: eventIds },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        setResult({
          deleted: response.data.deleted,
          failed: response.data.failed,
        });
        onDeleteComplete();
      }
    } catch (err: any) {
      console.error('Bulk delete error:', err);
      setError(err.response?.data?.error || 'Failed to delete events');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Delete Events">
      <div className="space-y-4">
        {result ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded">
              <p className="font-semibold">Deletion Complete</p>
              <p className="text-sm">Successfully deleted {result.deleted} event(s)</p>
              {result.failed > 0 && (
                <p className="text-sm text-red-600">Failed to delete {result.failed} event(s)</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={handleClose} variant="secondary">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
              <p className="font-semibold">⚠️ Warning</p>
              <p className="text-sm">
                You are about to delete {eventIds.length} event(s). This action cannot be undone.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button onClick={handleClose} variant="secondary" disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleBulkDelete} variant="danger" disabled={loading}>
                {loading ? 'Deleting...' : `Delete ${eventIds.length} Event(s)`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
