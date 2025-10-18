import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  showInfo?: boolean;
  maxPageButtons?: number;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  isLoading = false,
  showInfo = true,
  maxPageButtons = 7
}) => {
  // Calculate the range of items currently being shown
  const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate array of page numbers to display
  const getPageNumbers = (): number[] => {
    if (totalPages <= maxPageButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const halfRange = Math.floor(maxPageButtons / 2);
    let start = Math.max(1, currentPage - halfRange);
    let end = Math.min(totalPages, start + maxPageButtons - 1);

    // Adjust start if we're near the end
    if (end === totalPages) {
      start = Math.max(1, end - maxPageButtons + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const pageNumbers = getPageNumbers();

  // Handle page change with bounds checking
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage && !isLoading) {
      onPageChange(page);
    }
  };

  // Don't render pagination if there's only one page or no data
  if (totalPages <= 1) {
    return showInfo && totalItems > 0 ? (
      <div className="flex justify-center py-4">
        <span className="text-sm text-gray-600 dark:text-slate-400">
          Showing {totalItems} {totalItems === 1 ? 'item' : 'items'}
        </span>
      </div>
    ) : null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 bg-white dark:bg-soc-dark-800 border-t border-theme dark:border-theme">
      {/* Items info */}
      {showInfo && (
        <div className="text-sm text-gray-600 dark:text-slate-400">
          Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of{' '}
          {totalItems.toLocaleString()} items
        </div>
      )}

      {/* Pagination controls */}
      <div className="flex items-center space-x-2">
        {/* First page button */}
        <button
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1 || isLoading}
          className="p-2 rounded-lg border border-theme text-gray-700 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Go to first page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        {/* Previous page button */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          className="p-2 rounded-lg border border-theme text-gray-700 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Go to previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center space-x-1">
          {pageNumbers.map((pageNum, index) => {
            const isCurrentPage = pageNum === currentPage;
            const showEllipsis = index > 0 && pageNum - pageNumbers[index - 1] > 1;

            return (
              <React.Fragment key={pageNum}>
                {/* Show ellipsis if there's a gap */}
                {showEllipsis && (
                  <span className="px-2 py-1 text-slate-500">...</span>
                )}

                {/* Page number button */}
                <button
                  onClick={() => handlePageChange(pageNum)}
                  disabled={isLoading}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    isCurrentPage
                      ? 'border-agentic-500 bg-agentic-500/20 text-agentic-400'
                      : 'border-theme text-gray-700 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  aria-label={`Go to page ${pageNum}`}
                  aria-current={isCurrentPage ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Next page button */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          className="p-2 rounded-lg border border-theme text-gray-700 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Go to next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Last page button */}
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages || isLoading}
          className="p-2 rounded-lg border border-theme text-gray-700 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Go to last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-white dark:bg-soc-dark-800/50 flex items-center justify-center">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default Pagination;