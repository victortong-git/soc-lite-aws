import React from 'react';
import { ChevronDown } from 'lucide-react';

interface RowsPerPageSelectorProps {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
  disabled?: boolean;
  className?: string;
}

const DEFAULT_OPTIONS = [10, 25, 50, 100];

const RowsPerPageSelector: React.FC<RowsPerPageSelectorProps> = ({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  disabled = false,
  className = ''
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = parseInt(event.target.value, 10);
    if (!isNaN(newValue) && newValue !== value) {
      onChange(newValue);
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-sm text-gray-600 dark:text-slate-400 whitespace-nowrap">
        Rows per page:
      </span>
      
      <div className="relative">
        <select
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="appearance-none bg-white dark:bg-soc-dark-800 border border-theme-strong dark:border-theme-strong rounded-lg px-3 py-2 pr-8 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-agentic-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400 dark:hover:border-soc-dark-500 transition-colors"
          aria-label="Select number of rows per page"
        >
          {options.map((option) => (
            <option key={option} value={option} className="bg-white dark:bg-soc-dark-800">
              {option}
            </option>
          ))}
        </select>
        
        {/* Custom dropdown arrow */}
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-600 dark:text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
};

export default RowsPerPageSelector;