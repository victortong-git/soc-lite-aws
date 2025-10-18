import React from 'react';
import { useEvents } from '../../hooks/useEvents';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  filterParams?: Record<string, any>;
}

export const Pagination: React.FC<PaginationProps> = ({ filterParams = {} }) => {
  const { pagination, setPage } = useEvents();

  const { page, totalPages, total, limit } = pagination;

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const handlePrevious = () => {
    if (page > 1) setPage(page - 1, filterParams);
  };

  const handleNext = () => {
    if (page < totalPages) setPage(page + 1, filterParams);
  };

  const handlePageClick = (pageNum: number) => {
    if (pageNum !== page && pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum, filterParams);
    }
  };

  // Generate page numbers with ellipsis
  const generatePageNumbers = (): (number | 'ellipsis')[] => {
    const maxVisiblePages = 7;
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (page <= 4) {
        // Near the start: 1 2 3 4 5 ... last
        for (let i = 2; i <= Math.min(5, totalPages - 1); i++) {
          pages.push(i);
        }
        if (totalPages > 6) {
          pages.push('ellipsis');
        }
      } else if (page >= totalPages - 3) {
        // Near the end: 1 ... last-4 last-3 last-2 last-1 last
        if (totalPages > 6) {
          pages.push('ellipsis');
        }
        for (let i = Math.max(totalPages - 4, 2); i <= totalPages - 1; i++) {
          pages.push(i);
        }
      } else {
        // In the middle: 1 ... current-1 current current+1 ... last
        pages.push('ellipsis');
        pages.push(page - 1);
        pages.push(page);
        pages.push(page + 1);
        pages.push('ellipsis');
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  const pageNumbers = generatePageNumbers();

  return (
    <div className="bg-card-background px-4 py-3 flex items-center justify-between border-t border-theme-border sm:px-6 rounded-b-lg transition-colors duration-200">
      {/* Mobile view */}
      <div className="flex-1 flex justify-between items-center sm:hidden">
        <button
          onClick={handlePrevious}
          disabled={page === 1}
          className="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg
            border border-theme-border bg-card-background text-theme-text
            hover:bg-theme-surface disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </button>
        <span className="text-sm text-theme-text-secondary">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={handleNext}
          disabled={page === totalPages}
          className="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg
            border border-theme-border bg-card-background text-theme-text
            hover:bg-theme-surface disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      {/* Desktop view */}
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-theme-text-secondary">
            Showing <span className="font-medium text-theme-text">{startItem}</span> to{' '}
            <span className="font-medium text-theme-text">{endItem}</span> of{' '}
            <span className="font-medium text-theme-text">{total}</span> results
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex items-center gap-1" aria-label="Pagination">
            {/* Previous Button */}
            <button
              onClick={handlePrevious}
              disabled={page === 1}
              className="relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg
                border border-theme-border bg-card-background text-theme-text
                hover:bg-theme-surface disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="ml-1">Previous</span>
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {pageNumbers.map((pageNum, index) => {
                if (pageNum === 'ellipsis') {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-theme-text-muted"
                    >
                      ...
                    </span>
                  );
                }

                const isActive = pageNum === page;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageClick(pageNum)}
                    className={`relative inline-flex items-center px-3.5 py-2 text-sm font-medium rounded-lg
                      transition-all duration-200 border
                      ${
                        isActive
                          ? 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'
                          : 'bg-card-background text-theme-text border-theme-border hover:bg-theme-surface'
                      }`}
                    aria-label={`Go to page ${pageNum}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Button */}
            <button
              onClick={handleNext}
              disabled={page === totalPages}
              className="relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg
                border border-theme-border bg-card-background text-theme-text
                hover:bg-theme-surface disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200"
              aria-label="Next page"
            >
              <span className="mr-1">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};
