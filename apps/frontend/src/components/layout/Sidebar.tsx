import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Shield, Settings, X, Clock, ChevronLeft, ChevronRight, Sparkles, Users, AlertTriangle, Ban } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

interface SidebarProps {
  onMobileClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

interface MenuItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  badge?: number;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  onMobileClose,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse
}) => {
  const location = useLocation();
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : true; // Default collapsed
  });

  // Get smart analysis stats for badge
  const smartAnalysisStats = useSelector((state: RootState) => state.smartAnalysis.stats);
  const smartAnalysisJobsStats = useSelector((state: RootState) => state.smartAnalysisJobs.stats);

  // Use external state if provided, otherwise use internal state
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;

  const handleToggle = () => {
    const newState = !isCollapsed;
    setInternalIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
    onToggleCollapse?.(newState);
  };

  const menuSections: MenuSection[] = [
    {
      title: 'Core',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/events', label: 'WAF Events', icon: Shield },
        { path: '/jobs', label: 'Analysis Jobs', icon: Clock },
        { path: '/smart-analysis', label: 'Smart AI Analysis', icon: Sparkles, badge: smartAnalysisStats?.open_tasks || 0 },
        { path: '/smart-analysis-jobs', label: 'Smart Analysis Jobs', icon: Clock, badge: (smartAnalysisJobsStats?.pending || 0) + (smartAnalysisJobsStats?.running || 0) },
      ],
    },
    {
      title: 'Escalations',
      items: [
        { path: '/escalations', label: 'Escalations', icon: AlertTriangle },
        { path: '/blocklist', label: 'IP Blocklist', icon: Ban },
      ],
    },
    {
      title: 'System',
      items: [
        { path: '/users', label: 'User Management', icon: Users },
        { path: '/settings', label: 'Settings', icon: Settings, disabled: true },
      ],
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = () => {
    // Close mobile sidebar when navigating
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <aside
      className={`bg-nav-background border-r border-nav-border min-h-screen flex flex-col transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo/Header */}
      <div className={`border-b border-nav-border transition-all duration-300 ${
        isCollapsed ? 'p-3' : 'p-6'
      }`}>
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'space-x-3'}`}>
            <div className={`rounded-lg bg-primary-500 flex items-center justify-center transition-all duration-300 ${
              isCollapsed ? 'w-8 h-8' : 'w-10 h-10'
            }`}>
              <Shield className={`text-white transition-all duration-300 ${
                isCollapsed ? 'w-5 h-5' : 'w-6 h-6'
              }`} />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <h1 className="text-xl font-bold text-theme-text whitespace-nowrap">C6 SOC Lite</h1>
                <p className="text-xs text-theme-text-muted whitespace-nowrap">AWS Edition</p>
              </div>
            )}
          </div>
          {/* Mobile close button */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="md:hidden p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-theme-text-secondary"
              aria-label="Close mobile menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Toggle button - Desktop only */}
      <div className="hidden md:flex justify-end px-2 py-2">
        <button
          onClick={handleToggle}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-theme-text-secondary hover:text-theme-text transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto overflow-x-hidden">
        <div className="space-y-4">
          {menuSections.map((section) => (
            <div key={section.title}>
              {!isCollapsed && (
                <h3 className="text-xs font-semibold text-theme-text-muted uppercase tracking-wide px-2 mb-2 truncate">
                  {section.title}
                </h3>
              )}
              {isCollapsed && (
                <div className="border-t border-nav-border my-2"></div>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  return (
                    <li key={item.path}>
                      {item.disabled ? (
                        <div
                          className={`flex items-center px-3 py-2 rounded-lg text-theme-text-disabled cursor-not-allowed ${
                            isCollapsed ? 'justify-center' : 'space-x-3'
                          }`}
                          title={isCollapsed ? item.label : undefined}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 text-sm truncate">{item.label}</span>
                              <span className="text-xs bg-theme-surface-secondary px-2 py-0.5 rounded border border-theme-border whitespace-nowrap">
                                Soon
                              </span>
                            </>
                          )}
                        </div>
                      ) : (
                        <Link
                          to={item.path}
                          onClick={handleNavigation}
                          className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                            isCollapsed ? 'justify-center' : 'space-x-3'
                          } ${
                            active
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                              : 'text-theme-text hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                          title={isCollapsed ? item.label : undefined}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 text-sm truncate">{item.label}</span>
                              {item.badge !== undefined && item.badge > 0 && (
                                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center whitespace-nowrap">
                                  {item.badge > 99 ? '99+' : item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-3 border-t border-nav-border">
          <div className="text-xs text-theme-text-muted text-center">
            <div className="font-medium">Version 0.1</div>
            <div className="mt-1">AI-Powered Security</div>
          </div>
        </div>
      )}
    </aside>
  );
};
