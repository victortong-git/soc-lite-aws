import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import ProfessionalDashboard from './pages/ProfessionalDashboard';
import { EventsPage } from './pages/EventsPage';
import ProfessionalEventsPage from './pages/ProfessionalEventsPage';
import { EventDetailPage } from './pages/EventDetailPage';
import JobsPage from './pages/JobsPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ThemeProvider } from './contexts/ThemeContext';

// Lazy load Smart Analysis pages
const SmartAIAnalysisPage = React.lazy(() => import('./pages/SmartAIAnalysisPage'));
const SmartAnalysisDetailPage = React.lazy(() => import('./pages/SmartAnalysisDetailPage'));
const SmartAnalysisJobsPage = React.lazy(() => import('./pages/SmartAnalysisJobsPage'));
const UserManagementPage = React.lazy(() => import('./pages/UserManagementPage'));
const EscalationsPage = React.lazy(() => import('./pages/EscalationsPage'));
const BlocklistPage = React.lazy(() => import('./pages/BlocklistPage'));

function App() {
  // Use professional pages by default
  const useProfessionalUI = true;

  return (
    <ThemeProvider defaultTheme="system" storageKey="soc-lite-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                {useProfessionalUI ? <ProfessionalDashboard /> : <Dashboard />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                {useProfessionalUI ? <ProfessionalEventsPage /> : <EventsPage />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/:id"
            element={
              <ProtectedRoute>
                <EventDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute>
                <JobsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/smart-analysis"
            element={
              <ProtectedRoute>
                <React.Suspense fallback={<div>Loading...</div>}>
                  <SmartAIAnalysisPage />
                </React.Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/smart-analysis/:id"
            element={
              <ProtectedRoute>
                <React.Suspense fallback={<div>Loading...</div>}>
                  <SmartAnalysisDetailPage />
                </React.Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/smart-analysis-jobs"
            element={
              <ProtectedRoute>
                <React.Suspense fallback={<div>Loading...</div>}>
                  <SmartAnalysisJobsPage />
                </React.Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <React.Suspense fallback={<div>Loading...</div>}>
                  <UserManagementPage />
                </React.Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/escalations"
            element={
              <ProtectedRoute>
                <React.Suspense fallback={<div>Loading...</div>}>
                  <EscalationsPage />
                </React.Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/blocklist"
            element={
              <ProtectedRoute>
                <React.Suspense fallback={<div>Loading...</div>}>
                  <BlocklistPage />
                </React.Suspense>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
