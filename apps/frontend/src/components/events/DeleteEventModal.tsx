import React, { useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { WafLog } from '../../types';

interface DeleteEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: WafLog | null;
}

export const DeleteEventModal: React.FC<DeleteEventModalProps> = ({ isOpen, onClose, event }) => {
  const { deleteEvent, loading } = useEvents();
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (!event) return;

    setError('');
    try {
      await deleteEvent(event.id);
      onClose();
    } catch (err: any) {
      setError(err || 'Failed to delete event');
    }
  };

  if (!event) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Event" size="sm">
      <div className="space-y-4">
        <p className="text-gray-700">
          Are you sure you want to delete event <strong>#{event.id}</strong>?
        </p>
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-sm text-gray-600">
            <strong>Source IP:</strong> {event.source_ip}
          </p>
          <p className="text-sm text-gray-600">
            <strong>URI:</strong> {event.uri}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Action:</strong> {event.action}
          </p>
        </div>
        <p className="text-red-600 text-sm font-medium">
          This action cannot be undone.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <Button onClick={onClose} variant="secondary" type="button">
            Cancel
          </Button>
          <Button onClick={handleDelete} variant="danger" isLoading={loading}>
            Delete Event
          </Button>
        </div>
      </div>
    </Modal>
  );
};
