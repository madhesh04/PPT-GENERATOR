import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import apiClient from '../api/apiClient';

interface LoginProps {
  onLoginSuccess?: () => void;
}

/* ── Icons ── */
const UserIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);
const EyeIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);
const EmployeeIcon = () => (
  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

export default function Login({ onLoginSuccess }: LoginProps) {
  const { login } = useAuthStore();
  const [mode, setMode] = useState<'employee' | 'admin'>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId.trim() || !password.trim()) {
      setError('Employee ID and password are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', {
        email: employeeId.trim(),
        password,
        login_as: mode,
      });
      const { access_token, user } = res.data;
      login(access_token, user);
      onLoginSuccess?.();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail) && detail.length > 0) {
        setError(detail[0].msg || 'Validation error');
      } else {
        setError('Authentication failed. Check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`lc-card mode-${mode}`}>
      {/* Header */}
      <div className="lc-header">
        <div className="lc-session-tag">
          <span className="lc-dash" />
          {mode === 'employee' ? 'SESSION_INIT' : 'ADMIN_OVERRIDE'}
        </div>
        <h1 className="lc-title">Skynet Application</h1>
        <div className="lc-awaiting">
          &gt;_ {mode === 'employee' ? 'AWAITING_CREDENTIALS' : 'ADMIN_OVERRIDE_CL'}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="lc-tabs">
        <button
          type="button"
          className={`lc-tab${mode === 'employee' ? ' active' : ''}`}
          onClick={() => { setMode('employee'); setError(''); }}
        >
          <EmployeeIcon /> Employee
        </button>
        <button
          type="button"
          className={`lc-tab${mode === 'admin' ? ' active' : ''}`}
          onClick={() => { setMode('admin'); setError(''); }}
        >
          <ShieldIcon /> Admin
        </button>
      </div>

      {/* Form */}
      <form className="lc-form" onSubmit={handleSubmit} autoComplete="off">
        {error && (
          <div className="lc-error">
            <span>⚠ </span>{error}
          </div>
        )}

        {/* User ID */}
        <div className="lc-field">
          <label className="lc-label" htmlFor="lc-emp-id">
            {mode === 'employee' ? 'EMPLOYEE_ID' : 'MANAGER_ID'}
          </label>
          <div className="lc-input-wrap">
            <span className="lc-icon"><UserIcon /></span>
            <input
              id="lc-emp-id"
              className="lc-input"
              type="text"
              placeholder="User Identifier"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
        </div>

        {/* Password */}
        <div className="lc-field">
          <label className="lc-label" htmlFor="lc-password">PASSWORD</label>
          <div className="lc-input-wrap">
            <span className="lc-icon"><LockIcon /></span>
            <input
              id="lc-password"
              className="lc-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="lc-eye"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          id="login-submit"
          type="submit"
          className={`lc-btn${loading ? ' loading' : ''}`}
          disabled={loading}
        >
          {loading ? <><span className="spin">⟳</span> AUTHENTICATING…</> : 'AUTHENTICATE'}
        </button>
      </form>

      {/* Footer hint */}
      <div className="lc-hint">
        {mode === 'employee' ? (
          <>Are you an admin?&nbsp;<button type="button" className="lc-hint-link" onClick={() => setMode('admin')}>Admin Login →</button></>
        ) : (
          <>Are you an employee?&nbsp;<button type="button" className="lc-hint-link" onClick={() => setMode('employee')}>Employee Login →</button></>
        )}
      </div>
    </div>
  );
}
