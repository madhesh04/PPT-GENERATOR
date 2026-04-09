import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Login from '../components/Login';
import Signup from '../components/Signup';
import { useAuthStore } from '../store/useAuthStore';
import ThreeBackground from '../components/ThreeBackground';
import Cursor from '../components/Cursor';

export default function AuthView() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (isAuthenticated) {
    const from = (location.state as any)?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  return (
    <div className="auth-view relative min-h-screen">
      <ThreeBackground />
      <Cursor />
      <div className="relative z-10">
        {mode === 'login' ? (
          <Login 
            onSwitchToSignup={() => setMode('signup')} 
            onLoginSuccess={() => {}} 
          />
        ) : (
          <Signup 
            onSwitchToLogin={() => setMode('login')} 
          />
        )}
      </div>
    </div>
  );
}
