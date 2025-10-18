import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : true;
  });

  const handleMobileSidebarToggle = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const handleMobileSidebarClose = () => {
    setIsMobileSidebarOpen(false);
  };

  const handleSidebarCollapse = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  };

  return (
    <div className="min-h-screen theme-bg flex transition-colors duration-200">
      {/* Desktop Sidebar - Hidden on mobile, with dynamic width */}
      <div className={`hidden md:block h-screen sticky top-0 transition-all duration-300 ${
        isSidebarCollapsed ? 'w-16' : 'w-64'
      }`}>
        <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={handleSidebarCollapse} />
      </div>

      {/* Mobile Sidebar Overlay - Always expanded on mobile */}
      {isMobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleMobileSidebarClose}
          />
          {/* Sidebar - Always expanded on mobile */}
          <div className="relative w-64 h-full transform transition-transform">
            <Sidebar onMobileClose={handleMobileSidebarClose} isCollapsed={false} />
          </div>
        </div>
      )}

      {/* Main content container */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Navbar */}
        <div className="sticky top-0 z-40">
          <Navbar onMobileSidebarToggle={handleMobileSidebarToggle} />
        </div>

        {/* Main content area - Responsive padding */}
        <main className="flex-1 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 overflow-auto">
          {children}
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};
