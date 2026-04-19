import { Navigate, useLocation } from 'react-router-dom';
import Login from '../components/Login';
import { useAuthStore } from '../store/useAuthStore';

const BoltIcon = () => (
  <svg fill="currentColor" viewBox="0 0 24 24" width="22" height="22">
    <path d="M11 21v-7H7l8-12v7h4l-8 12z" />
  </svg>
);

export default function AuthView() {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  return (
    <div className="auth-layout">
      
      {/* BACKGROUND ENGINE */}
      <div className="auth-grid"></div>

      {/* TOP HEADER */}
      <header className="auth-header">
        <div className="auth-header-left">
          <div className="auth-icon-box">
            <BoltIcon />
          </div>
          <div className="auth-title-col">
            <span className="auth-top-title">PPT Generator</span>
            <span className="auth-top-subtitle">Q LABS · SWIFT OPS</span>
          </div>
        </div>
        <div>
          <span className="auth-bridge-pill">
            AUTHENTICATION_BRIDGE_ACTIVE
          </span>
        </div>
      </header>
      
      {/* MAIN CANVAS */}
      <main className="auth-main">
        <Login 
          onLoginSuccess={() => {}} 
        />
      </main>

    </div>
  );
}
