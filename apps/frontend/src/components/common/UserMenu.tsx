import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from './Avatar';

export const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!user) {
    return null;
  }

  const displayName = user.username || 'User';

  return (
    <div className="relative" ref={menuRef}>
      {/* User Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 px-3 py-2 rounded-lg
          hover:bg-gray-100 dark:hover:bg-gray-800
          transition-all duration-200 group"
      >
        <Avatar name={displayName} size="sm" />
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-theme-text">{displayName}</div>
          {user.role && (
            <div className="text-xs text-theme-text-muted capitalize">{user.role}</div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-theme-text-secondary transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-theme-surface border border-theme-border rounded-lg shadow-lg z-50 overflow-hidden">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-theme-border bg-theme-surface-secondary">
            <div className="flex items-center space-x-3">
              <Avatar name={displayName} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-theme-text truncate">
                  {displayName}
                </div>
                {user.role && (
                  <div className="text-xs text-theme-text-muted capitalize">{user.role}</div>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/profile');
              }}
              className="w-full flex items-center space-x-3 px-4 py-2
                hover:bg-gray-100 dark:hover:bg-gray-800
                text-theme-text transition-colors duration-150"
              disabled
            >
              <User className="w-4 h-4" />
              <span className="text-sm">Profile</span>
              <span className="ml-auto text-xs text-theme-text-muted">Soon</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/settings');
              }}
              className="w-full flex items-center space-x-3 px-4 py-2
                hover:bg-gray-100 dark:hover:bg-gray-800
                text-theme-text transition-colors duration-150"
              disabled
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">Settings</span>
              <span className="ml-auto text-xs text-theme-text-muted">Soon</span>
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-theme-border">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-2
                hover:bg-red-50 dark:hover:bg-red-900/20
                text-red-600 dark:text-red-400
                transition-colors duration-150"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
