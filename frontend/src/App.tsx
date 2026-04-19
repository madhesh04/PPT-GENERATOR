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
import HistoryView from './views/HistoryView';
import SettingsView from './views/SettingsView';
import AdminView from './views/AdminView';
import AuthView from './views/AuthView';

export default function App() {
  const { initialize, loading, isAuthenticated } = useAuthStore();
  const { setGlobalSettings, isDarkMode } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Apply theme class on mount
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  }, [isDarkMode]);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--accent-text)', fontFamily: 'var(--mono)', fontSize: '12px', letterSpacing: '0.12em', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '2px solid rgba(3,37,189,0.15)', borderTop: '2px solid var(--accent-text)', borderRadius: '50%', animation: 'spinning 0.8s linear infinite' }} />
        INITIALISING_CORE...
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
          <Route path="/history" element={<HistoryView />} />
          <Route path="/settings" element={<SettingsView />} />

          {/* Admin Routes — guarded by role */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminView />} />
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
