import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';

interface LoginProps {
  onLoginSuccess?: (mode: 'employee' | 'admin') => void;
}

const IconBadge = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} width="16" height="16">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
  </svg>
);

const IconAdmin = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} width="16" height="16">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const IconLock = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} width="18" height="18">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const IconEyeOff = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} width="18" height="18">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

const IconUser = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} width="18" height="18">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);


const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginMode, setLoginMode] = useState<'employee' | 'admin'>('employee');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('ERROR_001 — Identifier is required'); return; }
    if (!password) { setError('ERROR_002 — Password is required'); return; }
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, login_as: loginMode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'AUTHENTICATION_FAILED — Invalid credentials');
      }

      const data = await response.json();
      login(data.access_token, data.user);
      onLoginSuccess?.(loginMode);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-header">
        <div className={`login-hdr-small ${loginMode === 'admin' ? 'adm' : 'emp'}`}>
          {loginMode === 'admin' ? 'ADMIN_OVERRIDE' : 'SESSION_INIT'}
        </div>
        <div className="login-title">Skynet Application</div>
        <div className={`login-subtitle ${loginMode === 'admin' ? 'adm' : ''}`}>
          {loginMode === 'admin' ? (
            <><span>&gt;</span> ADMIN_OVERRIDE_CL</>
          ) : (
            <><span>&gt;_</span> AWAITING_CREDENTIALS</>
          )}
        </div>
      </div>

      <div className="login-tabs">
        <button 
          className={`login-tab ${loginMode === 'employee' ? 'active emp' : ''}`}
          onClick={() => { setLoginMode('employee'); setError(''); }}
        >
          <IconBadge /> Employee
        </button>
        <button 
          className={`login-tab ${loginMode === 'admin' ? 'active adm' : ''}`}
          onClick={() => { setLoginMode('admin'); setError(''); }}
        >
          <IconAdmin /> Admin
        </button>
      </div>

      {error && (
        <div style={{ color: '#f87171', fontSize: '12px', background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="login-field">
          <label className="login-label">
            {loginMode === 'admin' ? 'MANAGER_ID' : 'EMPLOYEE_ID'}
          </label>
          <div className="login-input-wrapper">
            <span className="login-input-icon"><IconUser /></span>
            <input 
              name="email"
              type="text" 
              value={email}
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              className="login-input" 
              placeholder="User Identifier"
            />
          </div>
        </div>
        
        <div className="login-field">
          <label className="login-label">PASSWORD</label>
          <div className="login-input-wrapper">
            <span className="login-input-icon"><IconLock /></span>
            <input 
              name="password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              className="login-input" 
              placeholder="••••••••"
            />
            <span className="login-pwd-icon"><IconEyeOff /></span>
          </div>
        </div>
        
        <button 
          type="submit"
          disabled={loading}
          className={`login-btn ${loginMode === 'admin' ? 'adm' : 'emp'}`}
        >
          {loading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
        </button>

        <div className="login-footer-link">
          Are you an {loginMode === 'admin' ? 'employee' : 'admin'}? 
          <a href="#" onClick={(e) => { e.preventDefault(); setLoginMode(loginMode === 'admin' ? 'employee' : 'admin'); }} 
             className={loginMode === 'admin' ? 'adm' : ''}>
            {loginMode === 'admin' ? 'Employee Login' : 'Admin Login'} &rarr;
          </a>
        </div>
      </form>
    </div>
  );
};

export default Login;
