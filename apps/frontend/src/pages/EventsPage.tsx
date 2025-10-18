import React, { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { EventsStatsBar } from '../components/events/EventsStatsBar';
import { EventFilters } from '../components/events/EventFilters';
import { EventsTable } from '../components/events/EventsTable';
import { Pagination } from '../components/events/Pagination';
import { CreateEventModal } from '../components/events/CreateEventModal';
import { EditEventModal } from '../components/events/EditEventModal';
import { DeleteEventModal } from '../components/events/DeleteEventModal';
import { BulkDeleteModal } from '../components/events/BulkDeleteModal';
import { AIAnalysisModal } from '../components/events/AIAnalysisModal';
import { Button } from '../components/ui/Button';
import { RefreshCw, Trash2 } from 'lucide-react';
import type { WafLog } from '../types';
import { useEvents } from '../hooks/useEvents';

export const EventsPage: React.FC = () => {
  const { fetchEvents } = useEvents();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<WafLog | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const handleEdit = (event: WafLog) => {
    setSelectedEvent(event);
    setIsEditModalOpen(true);
  };

  const handleDelete = (event: WafLog) => {
    setSelectedEvent(event);
    setIsDeleteModalOpen(true);
  };

  const handleAnalyze = (event: WafLog) => {
    setSelectedEvent(event);
    setIsAnalysisModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setIsBulkDeleteModalOpen(false);
    setIsAnalysisModalOpen(false);
    setSelectedEvent(null);
  };

  const handleBulkDeleteComplete = () => {
    setSelectedIds([]);
    fetchEvents();
  };

  const handleAnalysisComplete = () => {
    // Refresh events after analysis
    fetchEvents();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-theme-text">WAF Events</h2>
            <p className="mt-1 text-sm text-theme-text-secondary">
              Manage and monitor Web Application Firewall events
            </p>
          </div>
          <div className="flex space-x-3">
            {selectedIds.length > 0 && (
              <Button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                variant="danger"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedIds.length})
              </Button>
            )}
            <Button onClick={handleRefresh} variant="secondary" loading={refreshing}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        <EventsStatsBar />

        <EventFilters />

        <EventsTable
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAnalyze={handleAnalyze}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />

        <Pagination />

        <CreateEventModal
          isOpen={isCreateModalOpen}
          onClose={handleCloseModals}
        />

        <EditEventModal
          isOpen={isEditModalOpen}
          onClose={handleCloseModals}
          event={selectedEvent}
        />

        <DeleteEventModal
          isOpen={isDeleteModalOpen}
          onClose={handleCloseModals}
          event={selectedEvent}
        />

        <BulkDeleteModal
          isOpen={isBulkDeleteModalOpen}
          onClose={handleCloseModals}
          eventIds={selectedIds}
          onDeleteComplete={handleBulkDeleteComplete}
        />

        <AIAnalysisModal
          isOpen={isAnalysisModalOpen}
          onClose={handleCloseModals}
          event={selectedEvent}
          onAnalysisComplete={handleAnalysisComplete}
        />
      </div>
    </Layout>
  );
};
