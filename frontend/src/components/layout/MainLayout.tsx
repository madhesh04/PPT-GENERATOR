import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import AppTopbar from './AppTopbar';
import StatusBar from './StatusBar';
import ToastContainer from '../ui/ToastContainer';
import ProgressOverlay from '../ui/ProgressOverlay';
import { useAuthStore } from '../../store/useAuthStore';

export default function MainLayout() {
  const { isAuthenticated, loading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', { state: { from: location } });
    }
  }, [isAuthenticated, loading, navigate, location]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--accent-text)', fontFamily: 'var(--mono)', fontSize: '12px', letterSpacing: '0.1em' }}>
      INITIALISING CORE...
    </div>
  );

  if (!isAuthenticated) return null;

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <AppTopbar />
        <div className="page-content">
          <Outlet />
        </div>
        <StatusBar />
      </div>
      <ToastContainer />
      <ProgressOverlay />
    </div>
  );
}
