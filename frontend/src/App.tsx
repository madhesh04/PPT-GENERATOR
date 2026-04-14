import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { useAppStore } from './store/useAppStore';
import { adminApi } from './api/admin';

// Layouts & Guards
import MainLayout from './components/layout/MainLayout';
import { AdminRoute } from './components/auth/AdminRoute';
import ErrorBoundary from './components/layout/ErrorBoundary';

// Views
import DashboardView from './views/DashboardView';
import CreatorView from './views/CreatorView';
import PreviewView from './views/PreviewView';
import HistoryView from './views/HistoryView';
import SettingsView from './views/SettingsView';
import AdminView from './views/AdminView';
import AuthView from './views/AuthView';

export default function App() {
  const { initialize, loading, isAuthenticated } = useAuthStore();
  const { setGlobalSettings } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Fetch global settings ONCE after login — not on every navigation
  useEffect(() => {
    if (isAuthenticated) {
      adminApi.getPublicSettings()
        .then((data) => setGlobalSettings({
          globalImageGen: data.image_generation_enabled,
          globalDefaultModel: data.default_model,
        }))
        .catch(() => {});
    }
  }, [isAuthenticated, setGlobalSettings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0C12] flex items-center justify-center font-['Share_Tech_Mono'] text-[#00f0ff] uppercase tracking-widest">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[rgba(0,240,255,0.1)] border-t-[#00f0ff] rounded-full animate-spin"></div>
          <div className="animate-pulse">Initializing_Skynet_Core...</div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<AuthView />} />

        {/* Protected Main Routes */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardView />} />
          <Route path="/create" element={<CreatorView />} />
          <Route path="/preview" element={<PreviewView />} />
          <Route path="/history" element={<HistoryView />} />
          <Route path="/settings" element={<SettingsView />} />

          {/* Admin Routes — guarded by role. Tab driven by ?tab= query param */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminView />} />
            {/* Redirect legacy sub-paths to query-param equivalents */}
            <Route path="/admin/users" element={<Navigate to="/admin?tab=users" replace />} />
            <Route path="/admin/generations" element={<Navigate to="/admin?tab=generations" replace />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Vercel Analytics */}
      <Analytics />
    </ErrorBoundary>
  );
}
