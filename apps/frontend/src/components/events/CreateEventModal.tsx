import React, { useState, type FormEvent } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose }) => {
  const { createEvent, loading } = useEvents();
  const [formData, setFormData] = useState({
    source_ip: '',
    uri: '',
    action: 'ALLOW',
    severity: '1',
    http_method: 'GET',
    user_agent: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.source_ip || !formData.uri) {
      setError('Source IP and URI are required');
      return;
    }

    try {
      await createEvent({
        source_ip: formData.source_ip,
        uri: formData.uri,
        action: formData.action,
        severity: parseInt(formData.severity),
        http_method: formData.http_method,
        user_agent: formData.user_agent || undefined,
      });
      onClose();
      setFormData({
        source_ip: '',
        uri: '',
        action: 'ALLOW',
        severity: '1',
        http_method: 'GET',
        user_agent: '',
      });
    } catch (err: any) {
      setError(err || 'Failed to create event');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Event">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Source IP *"
          type="text"
          value={formData.source_ip}
          onChange={(e) => setFormData({ ...formData, source_ip: e.target.value })}
          placeholder="192.168.1.1"
          required
        />

        <Input
          label="URI *"
          type="text"
          value={formData.uri}
          onChange={(e) => setFormData({ ...formData, uri: e.target.value })}
          placeholder="/api/endpoint"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Action *
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.action}
            onChange={(e) => setFormData({ ...formData, action: e.target.value })}
          >
            <option value="ALLOW">ALLOW</option>
            <option value="BLOCK">BLOCK</option>
            <option value="COUNT">COUNT</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Severity (1-5)
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.severity}
            onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
          >
            <option value="1">1 - Low</option>
            <option value="2">2 - Medium-Low</option>
            <option value="3">3 - Medium</option>
            <option value="4">4 - High</option>
            <option value="5">5 - Critical</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            HTTP Method
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.http_method}
            onChange={(e) => setFormData({ ...formData, http_method: e.target.value })}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>
        </div>

        <Input
          label="User Agent"
          type="text"
          value={formData.user_agent}
          onChange={(e) => setFormData({ ...formData, user_agent: e.target.value })}
          placeholder="Mozilla/5.0..."
        />

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <Button onClick={onClose} variant="secondary" type="button">
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Create Event
          </Button>
        </div>
      </form>
    </Modal>
  );
};
