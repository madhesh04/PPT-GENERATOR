import React, { useState, useEffect } from 'react';
import SkynetBackground from './SkynetBackground';

interface SignupProps {
  onSwitchToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin }) => {
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

          {/* ═══ EXTERNALLY MANAGED NOTICE ═══ */}
          <div className="py-[30px] flex flex-col items-center gap-[16px] animate-fade-up" style={{ animationDelay: '1s', animationFillMode: 'forwards', opacity: 0 }}>
            {/* Shield icon */}
            <div className="w-[64px] h-[64px] bg-[rgba(255,184,0,0.06)] border border-[rgba(255,184,0,0.2)] rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-[30px] h-[30px] text-[#ffb800]" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M12 8v4"/>
                <circle cx="12" cy="15" r="0.5" fill="currentColor"/>
              </svg>
            </div>

            <h3 className="font-['Orbitron'] text-[16px] text-[#ffb800] tracking-[0.08em] text-center">
              EXTERNAL_REGISTRATION
            </h3>

            <div className="font-['Share_Tech_Mono'] text-[10px] text-[#6a8aaa] tracking-[0.04em] text-center leading-[1.8] max-w-[300px]">
              User accounts are managed by the<br/>
              <span className="text-[#00f0ff] font-bold">TIMESHEET ADMINISTRATION SYSTEM</span><br/><br/>
              To request access, contact your<br/>
              team administrator or HR department.
            </div>

            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[rgba(255,184,0,0.15)] to-transparent my-[4px]"></div>

            <div className="flex items-center gap-[8px] font-['Share_Tech_Mono'] text-[8px] text-[rgba(255,184,0,0.5)] tracking-[0.1em]">
              <div className="w-[5px] h-[5px] rounded-full bg-[#ffb800] shadow-[0_0_6px_#ffb800] animate-[dotPulse_2s_ease-in-out_infinite]"></div>
              SELF_REGISTRATION_DISABLED
            </div>
          </div>

          {/* Return to Login */}
          <div className="text-center pt-[6px] animate-fade-up" style={{ animationDelay: '1.2s', animationFillMode: 'forwards', opacity: 0 }}>
            <span className="font-['Share_Tech_Mono'] text-[9px] text-[#6a8aaa] tracking-[0.08em]">
              ALREADY_LISTED? <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToLogin(); }} className="text-[#00ff9d] font-semibold">RETURN_TO_BASE →</a>
            </span>
          </div>

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
