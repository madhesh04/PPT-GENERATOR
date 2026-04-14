import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';

interface LoginProps {
  onLoginSuccess?: (mode: 'employee' | 'admin') => void;
}

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
    <div className="w-full max-w-[420px] relative animate-fade-in">
      <div className="bg-[#0F1118] border border-white/[0.06] p-8 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col gap-6">

        {/* HEADER */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-[2px] ${loginMode === 'admin' ? 'bg-red-500' : 'bg-primary'}`}></div>
            <span className={`text-[10px] tracking-widest font-bold uppercase ${loginMode === 'admin' ? 'text-red-500' : 'text-primary'}`}>
              {loginMode === 'admin' ? 'ADMIN_OVERRIDE' : 'SESSION_INIT'}
            </span>
          </div>
          <h2 className="text-[22px] font-bold text-white mb-1.5 tracking-tight">Skynet Application</h2>
          <div className="text-[11px] tracking-widest font-mono flex items-center">
            {loginMode === 'admin' ? (
              <span className="text-red-500 font-bold uppercase flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                ADMIN_OVERRIDE · CLEARANCE_REQUIRED
              </span>
            ) : (
              <>
                <span className="text-primary mr-2 font-bold">{'>_'}</span> 
                <span className="text-outline-variant">AWAITING_CREDENTIALS</span>
              </>
            )}
          </div>
        </div>

        {/* TABS (Segmented Control) */}
        <div className="flex bg-[#05060A] p-1.5 rounded-xl border border-white/5 relative z-10 w-full mb-2">
          <button 
            type="button"
            onClick={() => { setLoginMode('employee'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              loginMode === 'employee' 
                ? 'bg-[#1E293B]/80 text-white shadow-sm' 
                : 'text-outline-variant hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>
            Employee
          </button>
          <button 
            type="button"
            onClick={() => { setLoginMode('admin'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              loginMode === 'admin' 
                ? 'bg-red-900/80 text-white shadow-[0_0_15px_rgba(220,38,38,0.2)]' 
                : 'text-outline-variant hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            Admin
          </button>
        </div>

        {error && (
            <div className="flex items-center gap-2 bg-error/10 border border-error/20 rounded-lg p-3 text-[11px] text-error">
              <span className="material-symbols-outlined text-[14px]">error</span>
              {error}
            </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative group">
            <label className="text-[10px] text-outline-variant uppercase tracking-widest block mb-2 font-semibold">
              {loginMode === 'admin' ? 'MANAGER_ID' : 'EMPLOYEE_ID'}
            </label>
            <div className="relative text-black">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">badge</span>
              <input 
                name="email"
                type="text" 
                value={email}
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#13161F] text-white border border-white/[0.06] rounded-xl pl-10 pr-4 py-3 text-sm font-medium outline-none placeholder:text-gray-600 focus:border-blue-500/50 transition-all shadow-inner" 
                placeholder="User Identifier"
              />
            </div>
          </div>
          
          <div className="relative group">
            <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-2 font-bold">
              PASSWORD
            </label>
            <div className="relative text-white">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">lock</span>
              <input 
                name="password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#13161F] text-white border border-white/[0.06] rounded-xl pl-10 pr-10 py-3 text-sm font-bold tracking-widest outline-none placeholder:text-gray-600 focus:border-blue-500/50 transition-all shadow-inner" 
                placeholder="••••••••"
              />
              <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer text-[18px]">visibility_off</span>
            </div>
          </div>
          
          <div className="pt-2">
            <button 
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 text-white font-bold rounded-xl transition-all tracking-widest text-sm uppercase ${
                loginMode === 'admin' 
                  ? 'bg-[#990000] hover:bg-red-700 shadow-[0_0_20px_rgba(153,0,0,0.3)] border border-red-500/20' 
                  : 'bg-[#173BE8] hover:bg-[#1A3EE0]/90 shadow-[0_0_15px_rgba(26,62,224,0.3)]'
              }`}
            >
              {loading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
            </button>
          </div>

          <div className="text-center pt-2">
            <span className="text-[11px] text-outline-variant font-medium">
              Are you an {loginMode === 'admin' ? 'employee' : 'admin'}? 
              <a href="#" onClick={(e) => { e.preventDefault(); setLoginMode(loginMode === 'admin' ? 'employee' : 'admin'); }} 
                 className={`transition-colors ml-1 font-bold ${loginMode === 'admin' ? 'text-red-400 hover:text-red-300' : 'text-white hover:text-primary'}`}>
                {loginMode === 'admin' ? 'Employee Login' : 'Admin Login'} &rarr;
              </a>
            </span>
          </div>

          <div className="text-center border-t border-white/5 pt-5 mt-2">
            <div className="text-[10px] text-outline-variant font-medium">
              Powered by <span className="text-white">Neo Q Labs &mdash; Swift Ops Training Team</span>
            </div>
            <div className="text-[9px] text-outline-variant/60 mt-1.5">
              &copy; 2026 Iamneo Edutech Private Limited. All rights reserved.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
