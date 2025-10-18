import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ThemeToggle } from '../ui/ThemeToggle';
import { LogOut, User } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-nav-background border-b border-nav-border shadow-nav transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-end items-center h-16 w-full">
          <div className="flex items-center space-x-4">
            <ThemeToggle />

            {user && (
              <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-theme-surface border border-theme-border">
                <User className="w-4 h-4 text-theme-text-secondary" />
                <div className="text-sm">
                  <span className="font-medium text-theme-text">{user.username}</span>
                  {user.role && (
                    <span className="ml-2 text-theme-text-muted">({user.role})</span>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg
                bg-button-secondary hover:bg-button-secondary-hover
                text-button-secondary-text border border-theme-border
                transition-all duration-200 font-medium text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
