import React from 'react';
import { Shield, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-nav-background border-t border-nav-border px-6 py-4 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left section - Logo and version */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-primary-500 rounded-md flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div className="text-sm">
              <span className="font-semibold text-theme-text">SOC Lite</span>
              <span className="text-theme-text-muted ml-2">(AWS Edition)</span>
            </div>
          </div>
          <span className="text-theme-text-muted">•</span>
          <div className="text-xs text-theme-text-muted">
            AI-Powered Security Operations Center
          </div>
        </div>

        {/* Right section - Copyright and tagline */}
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6">
          <div className="hidden sm:flex items-center space-x-1 text-xs text-theme-text-muted">
            <span>Made with</span>
            <Heart className="h-3 w-3 text-red-500" />
            <span>for SecOps</span>
          </div>

          <div className="text-xs text-theme-text-muted">
            © {currentYear} C6 Agentic SOC
          </div>
        </div>
      </div>
    </footer>
  );
};
