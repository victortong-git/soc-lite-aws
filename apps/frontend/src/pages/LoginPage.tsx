import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoginForm } from '../components/auth/LoginForm';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { Shield } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen theme-bg flex items-center justify-center px-4 transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full">
        <div className="bg-card-background rounded-lg shadow-card border border-card-border p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-primary-100 dark:bg-primary-900 p-3 rounded-full">
                <Shield className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-theme-text mb-2">SOC Lite</h1>
            <p className="text-theme-text-secondary">Security Operations Center</p>
            <p className="text-sm text-theme-text-muted mt-2">AI-Powered Security Operations</p>
          </div>

          <LoginForm />
        </div>

        <p className="text-center mt-6 text-sm text-theme-text-muted">
          Secured by AWS WAF & Amazon Bedrock AI
        </p>
      </div>
    </div>
  );
};
