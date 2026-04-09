import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';

// Layouts
import MainLayout from './components/layout/MainLayout';

// Views
import DashboardView from './views/DashboardView';
import CreatorView from './views/CreatorView';
import PreviewView from './views/PreviewView';
import HistoryView from './views/HistoryView';
import SettingsView from './views/SettingsView';
import AdminView from './views/AdminView';
import AuthView from './views/AuthView';

export default function App() {
  const { initialize, loading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020408] flex items-center justify-center font-['Share_Tech_Mono'] text-[#00f0ff] uppercase tracking-widest">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[rgba(0,240,255,0.1)] border-t-[#00f0ff] rounded-full animate-spin"></div>
          <div className="animate-pulse">Initializing_Skynet_Core...</div>
        </div>
      </div>
    );
  }

  return (
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
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminView />} />
        <Route path="/admin/users" element={<AdminView />} />
        <Route path="/admin/generations" element={<AdminView />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
