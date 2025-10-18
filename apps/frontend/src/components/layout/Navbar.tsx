import React from 'react';
import { Menu } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { UserMenu } from '../common/UserMenu';

interface NavbarProps {
  onMobileSidebarToggle?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onMobileSidebarToggle,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-nav-background border-b border-nav-border shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        {/* Left side - Mobile menu button and title */}
        <div className="flex items-center space-x-4">
          {/* Mobile hamburger menu */}
          <button
            onClick={onMobileSidebarToggle}
            className="md:hidden p-2 rounded-lg
              hover:bg-gray-100 dark:hover:bg-gray-800
              text-theme-text-secondary hover:text-theme-text
              transition-all duration-200"
            aria-label="Toggle mobile menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Title - visible on desktop */}
          <div className="hidden md:block">
            <h1 className="text-lg font-semibold text-theme-text">
              C6 SecOps AI Agent (Tech Preview) AWS Edition. Powered by AWS Bedrock, Nova and Strands SDK.
            </h1>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
};
