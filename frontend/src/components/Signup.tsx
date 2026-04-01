import React, { useState, useEffect } from 'react';
import SkynetBackground from './SkynetBackground';

interface SignupProps {
  onSwitchToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [clock, setClock] = useState('--:--:-- IST');

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
    if (!fullName) { setError('ERROR_101 — Full name is required'); return; }
    if (!email) { setError('ERROR_102 — Email is required'); return; }
    if (!password) { setError('ERROR_103 — Password is required'); return; }
    if (password.length < 6) { setError('ERROR_104 — Password too short (min 6 chars)'); return; }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'REGISTRATION_FAILED — System rejection');
      }

      setSuccess(true);
      setTimeout(onSwitchToLogin, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020408] text-[#e8f4ff] font-['Rajdhani'] relative overflow-hidden">
      <SkynetBackground />
      
      {/* Overlays */}
      <div className="skynet-bg-overlay"></div>
      <div className="skynet-scanlines"></div>
      <div className="skynet-scan-beam"></div>

      {/* Fullscreen Corners */}
      <div className="skynet-corner skynet-corner--tl"></div>
      <div className="skynet-corner skynet-corner--tr"></div>
      <div className="skynet-corner skynet-corner--bl"></div>
      <div className="skynet-corner skynet-corner--br"></div>

      {/* Top Badge */}
      <div className="fixed top-[22px] left-[28px] flex items-center gap-[12px] z-20 animate-fade-down" style={{ animationDelay: '0.4s', animationFillMode: 'forwards', opacity: 0 }}>
        <div className="w-[36px] h-[36px] bg-gradient-to-br from-[#00f0ff] to-[#0060ff] rounded-[8px] flex items-center justify-center font-['Orbitron'] font-black text-[14px] color-[#000] shadow-[0_0_20px_rgba(0,240,255,0.5)] relative after:content-[''] after:absolute after:right-[-3px] after:bottom-[-3px] after:w-[36px] after:h-[36px] after:bg-[#003050] after:rounded-[8px] after:z-[-1]">S</div>
        <div className="flex flex-col">
          <div className="font-['Orbitron'] text-[13px] font-bold tracking-[0.12em]">SKYNET</div>
          <div className="font-['Share_Tech_Mono'] text-[8px] text-[#6a8aaa] tracking-[0.12em] mt-[1px]">ACCESS_REQUEST_MODULE v2.4</div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-[30px] bg-[rgba(2,8,18,0.92)] border-t border-[rgba(0,240,255,0.25)] flex items-center px-[24px] gap-[28px] z-20 backdrop-blur-[10px] animate-fade-up" style={{ animationDelay: '1.8s', animationFillMode: 'forwards', opacity: 0 }}>
        <div className="flex items-center gap-[6px] font-['Share_Tech_Mono'] text-[9px] text-[#6a8aaa] tracking-[0.1em]">
          <div className="w-[5px] h-[5px] rounded-full bg-[#ffb800] shadow-[0_0_6px_#ffb800] animate-[dotPulse_2s_ease-in-out_infinite]"></div>
          RESTRICTED_ACCESS
        </div>
        <div className="ml-auto font-['Share_Tech_Mono'] text-[10px] text-[#00f0ff] tracking-[0.08em]">{clock}</div>
      </div>

      {/* Main Layout */}
      <div className="relative z-10 w-full h-screen overflow-hidden flex items-center justify-center p-[10px]">
        <div className="w-[400px] max-w-full bg-[rgba(4,12,28,0.92)] border border-[rgba(0,240,255,0.2)] rounded-[12px] p-[24px_28px] relative backdrop-blur-[30px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-[panelReveal_0.8s_cubic-bezier(0.22,1,0.36,1)_0.5s_forwards]" style={{ opacity: 0, transform: 'translateY(20px)' }}>
          
          <div className="absolute inset-[-1px] rounded-[13px] p-[1px] pointer-events-none animate-[borderRotate_6s_linear_infinite]" style={{ background: 'linear-gradient(0deg, rgba(0,240,255,0.3), transparent 40%, transparent 60%, rgba(0,255,157,0.2))', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' }}></div>

          <div className="flex items-center gap-[8px] font-['Share_Tech_Mono'] text-[8px] text-[rgba(0,240,255,0.45)] tracking-[0.14em] mb-[12px] animate-fade-up" style={{ animationDelay: '0.7s', animationFillMode: 'forwards', opacity: 0 }}>
            ACCESS_INITIALIZATION
            <div className="flex-1 h-[1px] bg-gradient-to-r from-[rgba(0,240,255,0.15)] to-transparent"></div>
          </div>

          <h2 className="font-['Orbitron'] text-[24px] font-black tracking-[0.06em] mb-[4px] animate-fade-up" style={{ animationDelay: '0.8s', animationFillMode: 'forwards', opacity: 0 }}>
            SYS<span className="text-[#00ff9d] drop-shadow-[0_0_15px_rgba(0,255,157,0.3)]">JOIN</span>
          </h2>

          {success ? (
            <div className="p-[30px_0] text-center animate-fade-up">
               <div className="w-[60px] h-[60px] mx-auto bg-[rgba(0,255,157,0.05)] border border-[rgba(0,255,157,0.2)] rounded-full flex items-center justify-center mb-[16px]">
                 <svg viewBox="0 0 24 24" className="w-[30px] h-[30px] text-[#00ff9d]" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
               </div>
               <h3 className="font-['Orbitron'] text-[20px] text-[#00ff9d] mb-[8px]">ACCEPTED</h3>
               <p className="font-['Share_Tech_Mono'] text-[10px] text-[#6a8aaa]">REDIRECTING...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-[14px] animate-fade-up" style={{ animationDelay: '1s', animationFillMode: 'forwards', opacity: 0 }}>
              {error && (
                <div className="flex items-center gap-[6px] bg-[rgba(255,45,85,0.05)] border border-[rgba(255,45,85,0.2)] rounded-[4px] p-[8px_12px] font-['Share_Tech_Mono'] text-[9px] text-[#ff2d55] mb-[4px]">
                  <div className="w-[14px] h-[14px] rounded-full border border-[#ff2d55] flex items-center justify-center text-[8px]">!</div>
                  {error}
                </div>
              )}
              
              <div className="flex flex-col gap-[3px]">
                <label className="font-['Share_Tech_Mono'] text-[8px] tracking-[0.14em] text-[#4a6a8a] flex items-center gap-[5px]">
                  <span className="text-[rgba(0,240,255,0.4)]">01 //</span>
                  LEGAL_NAME
                </label>
                <div className="relative flex items-center h-[40px] border-b border-[rgba(0,240,255,0.2)] transition-all focus-within:border-[#00ff9d]">
                  <input type="text" className="flex-1 bg-transparent !border-none !outline-none !ring-0 font-['Share_Tech_Mono'] text-[12px] text-[#e8f4ff] tracking-[0.04em] placeholder:text-[#2a4060]" placeholder="JOHN_DOE" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-col gap-[3px]">
                <label className="font-['Share_Tech_Mono'] text-[8px] tracking-[0.14em] text-[#4a6a8a] flex items-center gap-[5px]">
                  <span className="text-[rgba(0,240,255,0.4)]">02 //</span>
                  COMM_CHANNEL (EMAIL)
                </label>
                <div className="relative flex items-center h-[40px] border-b border-[rgba(0,240,255,0.2)] transition-all focus-within:border-[#00ff9d]">
                  <input type="email" className="flex-1 bg-transparent !border-none !outline-none !ring-0 font-['Share_Tech_Mono'] text-[12px] text-[#e8f4ff] tracking-[0.04em] placeholder:text-[#2a4060]" placeholder="USER@SKYNET.AI" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-col gap-[3px]">
                <label className="font-['Share_Tech_Mono'] text-[8px] tracking-[0.14em] text-[#4a6a8a] flex items-center gap-[5px]">
                  <span className="text-[rgba(0,240,255,0.4)]">03 //</span>
                  ENCRYPTION_KEY
                </label>
                <div className="relative flex items-center h-[40px] border-b border-[rgba(0,240,255,0.2)] transition-all focus-within:border-[#00ff9d]">
                  <input type="password" className="flex-1 bg-transparent !border-none !outline-none !ring-0 font-['Share_Tech_Mono'] text-[12px] text-[#e8f4ff] tracking-[0.04em] placeholder:text-[#2a4060]" placeholder="••••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full h-[44px] bg-gradient-to-r from-[#00c060] to-[#00ff9d] rounded-[4px] font-['Orbitron'] text-[11px] font-bold tracking-[0.2em] text-[#000] shadow-[0_0_20px_rgba(0,255,157,0.25)] hover:translate-y-[-1px] transition-all disabled:opacity-50 mt-[8px]">
                {loading ? 'REQUESTING...' : 'INITIATE_REQUEST'}
              </button>

              <div className="text-center pt-[6px]">
                <span className="font-['Share_Tech_Mono'] text-[9px] text-[#6a8aaa] tracking-[0.08em]">
                  ALREADY_LISTED? <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToLogin(); }} className="text-[#00ff9d] font-semibold">RETURN_TO_BASE →</a>
                </span>
              </div>
            </form>
          )}

          <div className="mt-[16px] pt-[12px] border-t border-[rgba(0,240,255,0.05)] text-[8px] text-[#2a4060] text-center tracking-[0.08em] leading-[1.6]">
             Skynet Access Protocol Beta-v9<br/>
             Authorized personnel only_
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
