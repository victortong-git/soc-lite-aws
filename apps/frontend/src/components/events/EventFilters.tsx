import React from 'react';
import { Card, CardBody } from '../ui/Card';
import { Filter } from 'lucide-react';

// Legacy component - not used in ProfessionalEventsPage
export const EventFilters: React.FC = () => {
  return (
    <Card>
      <CardBody>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters (Legacy - Not Functional)
          </h3>
        </div>
        <p className="mt-4 text-sm text-theme-text-secondary">
          This component is deprecated. Please use the Advanced Filter Panel in the Professional Events Page.
        </p>
      </CardBody>
    </Card>
  );
};
