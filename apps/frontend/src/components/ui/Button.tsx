import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-button-primary hover:bg-button-primary-hover text-button-primary-text shadow-button hover:shadow-button-hover focus:ring-primary-500',
    secondary: 'bg-button-secondary hover:bg-button-secondary-hover text-button-secondary-text border border-theme-border shadow-sm focus:ring-primary-500',
    danger: 'bg-button-danger hover:bg-button-danger-hover text-button-danger-text shadow-button hover:shadow-button-hover focus:ring-red-500',
    success: 'bg-button-success hover:bg-button-success-hover text-button-success-text shadow-button hover:shadow-button-hover focus:ring-green-500',
    ghost: 'text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-hover',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};
