import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import SkynetBackground from './SkynetBackground';

interface LoginProps {
  onSwitchToSignup: () => void;
  onLoginSuccess?: (mode: 'employee' | 'admin') => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchToSignup, onLoginSuccess }) => {
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pwdVisible, setPwdVisible] = useState(false);
  const [clock, setClock] = useState('--:--:-- IST');
  const [loginMode, setLoginMode] = useState<'employee' | 'admin'>('employee');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const pad = (v: number) => String(v).padStart(2, '0');
      setClock(
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} IST`
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('ERROR_001 — Email is required'); return; }
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
      const panel = document.querySelector('.skynet-panel-container');
      if (panel) {
        panel.animate([
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(0)' }
        ], { duration: 300, easing: 'cubic-bezier(.36,.07,.19,.97)' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020408] text-[#e8f4ff] font-['Rajdhani'] relative overflow-hidden">
      <SkynetBackground />
      
      <div className="skynet-bg-overlay"></div>
      <div className="skynet-scanlines"></div>
      <div className="skynet-scan-beam"></div>

      <div className="skynet-corner skynet-corner--tl"></div>
      <div className="skynet-corner skynet-corner--tr"></div>
      <div className="skynet-corner skynet-corner--bl"></div>
      <div className="skynet-corner skynet-corner--br"></div>

      <div className="fixed top-[22px] left-[28px] flex items-center gap-[12px] z-20 animate-fade-down" style={{ animationDelay: '0.4s', animationFillMode: 'forwards', opacity: 0 }}>
        <div className="w-[36px] h-[36px] bg-gradient-to-br from-[#00f0ff] to-[#0060ff] rounded-[8px] flex items-center justify-center font-['Orbitron'] font-black text-[14px] color-[#000] shadow-[0_0_20px_rgba(0,240,255,0.5)] relative after:content-[''] after:absolute after:right-[-3px] after:bottom-[-3px] after:w-[36px] after:h-[36px] after:bg-[#003050] after:rounded-[8px] after:z-[-1]">S</div>
        <div className="flex flex-col">
          <div className="font-['Orbitron'] text-[13px] font-bold tracking-[0.12em]">SKYNET</div>
          <div className="font-['Share_Tech_Mono'] text-[8px] text-[#6a8aaa] tracking-[0.12em] mt-[1px]">PPT GENERATION SYSTEM v2.4</div>
        </div>
      </div>

      <div className="fixed top-[22px] right-[28px] flex items-center gap-[8px] bg-[rgba(0,255,157,0.06)] border border-[rgba(0,255,157,0.2)] rounded-[6px] px-[14px] py-[6px] font-['Share_Tech_Mono'] text-[9px] text-[#00ff9d] tracking-[0.1em] z-20 animate-fade-down" style={{ animationDelay: '0.6s', animationFillMode: 'forwards', opacity: 0 }}>
        <div className="w-[5px] h-[5px] rounded-full bg-[#00ff9d] shadow-[0_0_6px_#00ff9d] animate-[dotPulse_2s_ease-in-out_infinite]"></div>
        ALL_SYSTEMS_NOMINAL
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-[30px] bg-[rgba(2,8,18,0.92)] border-t border-[rgba(0,240,255,0.25)] flex items-center px-[24px] gap-[28px] z-20 backdrop-blur-[10px] animate-fade-up" style={{ animationDelay: '1.8s', animationFillMode: 'forwards', opacity: 0 }}>
        <div className="flex items-center gap-[6px] font-['Share_Tech_Mono'] text-[9px] text-[#6a8aaa] tracking-[0.1em]">
          <div className="w-[5px] h-[5px] rounded-full bg-[#00ff9d] shadow-[0_0_6px_#00ff9d] animate-[dotPulse_2s_ease-in-out_infinite]"></div>
          CORE_ONLINE
        </div>
        <div className="flex items-center gap-[6px] font-['Share_Tech_Mono'] text-[9px] text-[#6a8aaa] tracking-[0.1em]">
          <div className="w-[5px] h-[5px] rounded-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff] animate-[dotPulse_2s_ease-in-out_infinite]"></div>
          LLM_CONNECTED
        </div>
        <div className="ml-auto font-['Share_Tech_Mono'] text-[10px] text-[#00f0ff] tracking-[0.08em]">{clock}</div>
      </div>

      <div className="relative z-10 w-full h-screen overflow-hidden flex items-center justify-center p-[10px]">
        <div className="skynet-panel-container w-[400px] max-w-full bg-[rgba(4,12,28,0.92)] border border-[rgba(0,240,255,0.2)] rounded-[12px] p-[24px_28px] relative backdrop-blur-[30px] shadow-[0_0_50px_rgba(0,240,255,0.06),0_20px_60px_rgba(0,0,0,0.8)] animate-[panelReveal_0.8s_cubic-bezier(0.22,1,0.36,1)_0.5s_forwards]" style={{ opacity: 0, transform: 'translateY(20px)' }}>
          
          <div className="absolute inset-[-1px] rounded-[13px] p-[1px] pointer-events-none animate-[borderRotate_6s_linear_infinite]" style={{ background: 'linear-gradient(0deg, rgba(0,240,255,0.3), transparent 40%, transparent 60%, rgba(0,255,157,0.2))', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' }}></div>

          <div className="absolute w-[14px] h-[14px] top-[-1px] left-[-1px] border-t-2 border-l-2 border-[#00f0ff] rounded-[2px_0_0_0]"></div>
          <div className="absolute w-[14px] h-[14px] top-[-1px] right-[-1px] border-t-2 border-r-2 border-[#00f0ff] rounded-[0_2px_0_0]"></div>
          <div className="absolute w-[14px] h-[14px] bottom-[-1px] left-[-1px] border-b-2 border-l-2 border-[#00f0ff] rounded-[0_0_0_2px]"></div>
          <div className="absolute w-[14px] h-[14px] bottom-[-1px] right-[-1px] border-b-2 border-r-2 border-[#00f0ff] rounded-[0_0_2px_0]"></div>

          <div className="flex items-center gap-[8px] font-['Share_Tech_Mono'] text-[8px] text-[rgba(0,240,255,0.45)] tracking-[0.14em] mb-[12px] animate-fade-up" style={{ animationDelay: '0.7s', animationFillMode: 'forwards', opacity: 0 }}>
            SESSION_INIT
            <div className="flex-1 h-[1px] bg-gradient-to-r from-[rgba(0,240,255,0.15)] to-transparent"></div>
          </div>

          <h2 className="font-['Orbitron'] text-[26px] font-black tracking-[0.06em] leading-none mb-[4px] animate-fade-up" style={{ animationDelay: '0.8s', animationFillMode: 'forwards', opacity: 0 }}>
            SKY<span className="text-[#00f0ff] drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]">NET</span>
          </h2>

          <div className="flex items-center gap-[8px] font-['Share_Tech_Mono'] text-[9px] text-[#6a8aaa] tracking-[0.06em] mb-[14px] animate-fade-up" style={{ animationDelay: '0.9s', animationFillMode: 'forwards', opacity: 0 }}>
            <span className="text-[#00f0ff]">›</span>
            <span>_ {loginMode === 'admin' ? 'ADMIN_AUTHENTICATION' : 'AWAITING_CREDENTIALS'}</span>
            <span className="inline-block w-[6px] h-[11px] bg-[#00f0ff] rounded-[1px] ml-[2px] animate-[cursorBlink_1.1s_step-end_infinite] shadow-[0_0_6px_#00f0ff]"></span>
          </div>

          {/* ═══ EMPLOYEE / ADMIN TAB SELECTOR ═══ */}
          <div className="flex mb-[16px] border border-[rgba(0,240,255,0.15)] rounded-[6px] overflow-hidden animate-fade-up" style={{ animationDelay: '0.95s', animationFillMode: 'forwards', opacity: 0 }}>
            <button
              type="button"
              onClick={() => { setLoginMode('employee'); setError(''); }}
              className={`flex-1 py-[10px] font-['Orbitron'] text-[10px] font-bold tracking-[0.16em] transition-all duration-300 flex items-center justify-center gap-[6px] ${
                loginMode === 'employee'
                  ? 'bg-gradient-to-r from-[rgba(0,240,255,0.12)] to-[rgba(0,96,255,0.08)] text-[#00f0ff] shadow-[inset_0_-2px_0_#00f0ff]'
                  : 'bg-transparent text-[#4a6a8a] hover:text-[#6a8aaa]'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-[12px] h-[12px]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              EMPLOYEE
            </button>
            <div className="w-[1px] bg-[rgba(0,240,255,0.15)]"></div>
            <button
              type="button"
              onClick={() => { setLoginMode('admin'); setError(''); }}
              className={`flex-1 py-[10px] font-['Orbitron'] text-[10px] font-bold tracking-[0.16em] transition-all duration-300 flex items-center justify-center gap-[6px] ${
                loginMode === 'admin'
                  ? 'bg-gradient-to-r from-[rgba(255,184,0,0.1)] to-[rgba(255,107,53,0.06)] text-[#ffb800] shadow-[inset_0_-2px_0_#ffb800]'
                  : 'bg-transparent text-[#4a6a8a] hover:text-[#6a8aaa]'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-[12px] h-[12px]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              ADMIN
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-[6px] bg-[rgba(255,45,85,0.05)] border border-[rgba(255,45,85,0.2)] rounded-[4px] p-[8px_12px] font-['Share_Tech_Mono'] text-[9px] text-[#ff2d55] mb-[12px] animate-fade-up">
              <div className="w-[14px] h-[14px] rounded-full border border-[#ff2d55] flex items-center justify-center text-[8px]">!</div>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-[14px] animate-fade-up" style={{ animationDelay: '1s', animationFillMode: 'forwards', opacity: 0 }}>
            <div className="flex flex-col gap-[4px]">
              <label htmlFor="login_email" className="font-['Share_Tech_Mono'] text-[8px] tracking-[0.14em] text-[#4a6a8a] flex items-center gap-[5px] cursor-pointer">
                <span className="text-[rgba(0,240,255,0.4)]">01 //</span>
                {loginMode === 'admin' ? 'ADMIN_CREDENTIALS' : 'CREDENTIALS'}
              </label>
              <div className="relative flex items-center h-[46px] bg-[rgba(0,240,255,0.02)] border border-[rgba(0,240,255,0.15)] rounded-[4px] px-[12px] gap-[8px] transition-all focus-within:border-[#00f0ff] focus-within:bg-[rgba(0,240,255,0.04)]">
                <svg viewBox="0 0 24 24" className="w-[13px] h-[13px] text-[rgba(0,240,255,0.4)]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input
                  id="login_email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="flex-1 bg-transparent !border-none !outline-none !ring-0 font-['Share_Tech_Mono'] text-[12px] text-[#e8f4ff] tracking-[0.04em] placeholder:text-[#2a4060]"
                  placeholder={loginMode === 'admin' ? 'admin@skynet.ai' : 'user@skynet.ai'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-[4px]">
              <label htmlFor="login_password" className="font-['Share_Tech_Mono'] text-[8px] tracking-[0.14em] text-[#4a6a8a] flex items-center gap-[5px] cursor-pointer">
                <span className="text-[rgba(0,240,255,0.4)]">02 //</span>
                ENCRYPTION_KEY
              </label>
              <div className="relative flex items-center h-[46px] bg-[rgba(0,240,255,0.02)] border border-[rgba(0,240,255,0.15)] rounded-[4px] px-[12px] gap-[8px] transition-all focus-within:border-[#00f0ff] focus-within:bg-[rgba(0,240,255,0.04)]">
                <svg viewBox="0 0 24 24" className="w-[13px] h-[13px] text-[rgba(0,240,255,0.4)]" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                <input
                  id="login_password"
                  name="password"
                  type={pwdVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="flex-1 bg-transparent !border-none !outline-none !ring-0 font-['Share_Tech_Mono'] text-[12px] text-[#e8f4ff] tracking-[0.04em] placeholder:text-[#2a4060]"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setPwdVisible(!pwdVisible)} className="text-[#4a6a8a] hover:text-[#00f0ff] transition-colors flex items-center">
                  <svg viewBox="0 0 24 24" className="w-[14px] h-[14px]" fill="none" stroke="currentColor" strokeWidth="2">
                    {pwdVisible ? (
                      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    ) : (
                      <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex justify-end mt-[-4px]">
              {/* FORGOT_PASSWORD REMOVED PER ADMINISTRATIVE POLICY */}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full h-[46px] rounded-[4px] font-['Orbitron'] text-[11px] font-bold tracking-[0.2em] text-[#fff] hover:translate-y-[-1px] transition-all disabled:opacity-50 mt-[4px] ${
                loginMode === 'admin'
                  ? 'bg-gradient-to-r from-[#c87800] to-[#ffb800] shadow-[0_0_15px_rgba(255,184,0,0.3)] text-[#000]'
                  : 'bg-gradient-to-r from-[#0050c8] to-[#00b8ff] shadow-[0_0_15px_rgba(0,144,255,0.3)]'
              }`}
            >
              {loading ? 'AUTHENTICATING...' : (loginMode === 'admin' ? 'ADMIN_AUTHENTICATE' : 'AUTHENTICATE')}
            </button>

            <div className="flex items-center gap-[10px] my-[2px]">
              <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,240,255,0.1)] to-transparent"></div>
              <div className="font-['Share_Tech_Mono'] text-[8px] text-[#2a4060] tracking-[0.1em]">OR</div>
              <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,240,255,0.1)] to-transparent"></div>
            </div>

            <div className="text-center">
              <span className="font-['Share_Tech_Mono'] text-[9px] text-[#6a8aaa] tracking-[0.08em]">
                NO_ACCOUNT? <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToSignup(); }} className="text-[#00f0ff] font-semibold">REQUEST_ACCESS →</a>
              </span>
            </div>
          </form>

          <div className="mt-[16px] pt-[12px] border-t border-[rgba(0,240,255,0.05)] text-[8px] text-[#2a4060] text-center tracking-[0.08em] leading-[1.6]">
             Powered by <strong className="text-[#4a6a8a] font-normal">Skynet Core</strong> — AI Suite<br/>
             © 2026 Skynet Systems. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
