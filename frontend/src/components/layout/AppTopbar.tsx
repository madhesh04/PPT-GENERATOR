import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

function getPageLabel(pathname: string): string {
  if (pathname.startsWith('/admin')) return 'Admin';
  if (pathname.startsWith('/create')) return 'Generate';
  if (pathname.startsWith('/history')) return 'History';
  if (pathname.startsWith('/settings')) return 'Settings';
  return 'Dashboard';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default function AppTopbar() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const pageLabel = getPageLabel(location.pathname);

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="brand-dot" />
        <span className="brand-name">iamneo</span>
      </div>
      <span className="topbar-page">{pageLabel}</span>
      <div className="topbar-right">
        <div
          className="user-pill"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/settings')}
          title="Settings"
        >
          <span className="user-name">{user?.full_name || 'User'}</span>
          <div className="user-avatar">
            {getInitials(user?.full_name || 'U')}
          </div>
        </div>
      </div>
    </header>
  );
}
