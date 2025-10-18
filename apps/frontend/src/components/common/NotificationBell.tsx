import React from 'react';
import { Bell } from 'lucide-react';

export const NotificationBell: React.FC = () => {
  const unreadCount = 0; // Placeholder - will be implemented later

  return (
    <button
      className="relative p-2 rounded-lg
        hover:bg-gray-100 dark:hover:bg-gray-800
        text-theme-text-secondary hover:text-theme-text
        transition-all duration-200"
      title="Notifications (Coming Soon)"
      disabled
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      )}
    </button>
  );
};
