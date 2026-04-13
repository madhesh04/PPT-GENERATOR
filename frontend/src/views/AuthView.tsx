import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Login from '../components/Login';
import Signup from '../components/Signup';
import { useAuthStore } from '../store/useAuthStore';

export default function AuthView() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (isAuthenticated) {
    const from = (location.state as any)?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  return (
    <div className="bg-[#06080F] text-on-surface h-screen w-screen flex flex-col relative overflow-hidden scrollbar-hide font-body fixed inset-0">
      
      {/* BACKGROUND ENGINE */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#06080F]"></div>
        
        {/* Tactical Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#3d5afe15_1px,transparent_1px),linear-gradient(to_bottom,#3d5afe15_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_20%,transparent_100%)]"></div>
        
        <div className="absolute inset-0 particle-overlay opacity-30"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#06080F] via-transparent to-[#06080F]/50"></div>
        
        {/* Abstract glowing orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 blur-[120px] rounded-full mix-blend-screen"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-tertiary/5 blur-[100px] rounded-full mix-blend-screen"></div>
      </div>

      {/* TOP HEADER */}
      <header className="relative z-10 flex justify-between items-center px-8 py-6 w-full shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded-xl shadow-[0_0_20px_rgba(61,90,254,0.4)] border border-white/10 bg-[#0B0F19] group">
            <img src="/logo.jpg" alt="Skynet Logo" className="w-full h-full object-cover scale-[1.3] transition-transform duration-500 group-hover:scale-150" />
          </div>
          <h1 className="font-headline text-primary-fixed-dim font-extrabold tracking-[0.25em] text-xl">SKYNET</h1>
        </div>
        <div>
          <span className="font-label text-[#00FF41] text-xs font-bold tracking-widest bg-[#00FF41]/10 px-3 py-1 rounded-sm border border-[#00FF41]/20 hidden sm:inline-block">
            [ ● ALL_SYSTEMS_NOMINAL ]
          </span>
        </div>
      </header>
      
      {/* MAIN CANVAS */}
      <main className="relative z-10 flex-grow flex items-center justify-center px-4 w-full">
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
      </main>

      {/* BOTTOM STATUS BAR */}
      <footer className="relative z-10 w-full bg-[#06080F] border-t border-outline-variant/10 py-2 px-6 flex justify-between items-center overflow-hidden shrink-0">
        <div className="flex gap-8 items-center">
          <div className="flex items-center gap-2">
            <span className="font-label text-[9px] text-outline tracking-tighter">LATENCY:</span>
            <span className="font-label text-[9px] text-[#00FF41]">12ms</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-label text-[9px] text-outline tracking-tighter">CORE_TEMP:</span>
            <span className="font-label text-[9px] text-primary">34.2°C</span>
          </div>
        </div>
        
        <div className="flex gap-6 items-center">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse"></div>
            <span className="font-label text-[9px] text-outline tracking-widest">[ ── LLM_CONNECTED ── ]</span>
          </div>
          <div className="font-label text-[9px] text-outline-variant font-bold border-l border-outline-variant/20 pl-4">
            v2.4.0
          </div>
        </div>
      </footer>

      {/* ASYMMETRIC DECORATIVE ELEMENT */}
      <div className="absolute top-1/4 right-0 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-primary/10 pointer-events-none"></div>
      <div className="absolute bottom-1/3 left-0 w-1/4 h-[1px] bg-gradient-to-l from-transparent via-tertiary-container/40 to-tertiary-container/10 pointer-events-none"></div>
      
      <div className="absolute top-1/3 right-12 opacity-15 pointer-events-none hidden xl:block">
        <pre className="font-label text-[10px] text-primary leading-tight tracking-[0.2em] font-bold">
{`01011001 01010011 01010100
01000101 01001101 00100000
01001111 01001110 01001100
01001001 01001110 01000101
--------------------------
SCANNING CORE ASSETS...
[SECURE CONNECTION OK]
PORT: 8080 REDIRECT
UID: EMP_422_ACTIVE`}
        </pre>
      </div>
      
    </div>
  );
}
