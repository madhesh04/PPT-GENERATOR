import { Navigate, useLocation } from 'react-router-dom';
import Login from '../components/Login';
import { useAuthStore } from '../store/useAuthStore';

export default function AuthView() {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  return (
    <div className="bg-[#0A0C12] text-on-surface h-screen w-screen flex flex-col relative overflow-hidden scrollbar-hide font-body fixed inset-0">
      
      {/* BACKGROUND ENGINE */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#0B0D14]"></div>
        
        {/* Tactical Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        
        {/* Subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full"></div>
      </div>

      {/* TOP HEADER */}
      <header className="relative z-10 flex justify-between items-center px-8 py-6 w-full shrink-0 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center overflow-hidden rounded-lg shadow-sm border border-white/[0.06] bg-[#0F1118]">
            <img src="/logo.jpg" alt="Skynet Logo" className="w-full h-full object-cover scale-[1.3]" />
          </div>
          <h1 className="text-[16px] font-extrabold text-white tracking-[0.1em] font-sans">SKYNET</h1>
        </div>
        <div>
          <span className="text-emerald-400 text-[10px] font-bold tracking-widest bg-emerald-400/5 px-3 py-1 rounded-md border border-emerald-400/10 hidden sm:inline-block">
            AUTHENTICATION_BRIDGE_ACTIVE
          </span>
        </div>
      </header>
      
      {/* MAIN CANVAS */}
      <main className="relative z-10 flex-grow flex items-center justify-center px-4 w-full">
        <Login 
          onLoginSuccess={() => {}} 
        />
      </main>

      {/* BOTTOM STATUS BAR */}
      <footer className="relative z-10 w-full bg-[#0B0D14] border-t border-white/[0.06] py-3.5 px-8 flex justify-between items-center shrink-0">
        <div className="flex gap-8 items-center text-[10px] font-extrabold tracking-widest text-[#475569] uppercase">
          <div className="flex items-center gap-2">
            <span>SECURE_LINK:</span>
            <span className="text-emerald-500">ESTABLISHED</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span>NODE_ADDR:</span>
            <span className="text-blue-500">127.0.0.1</span>
          </div>
        </div>
        
        <div className="flex gap-6 items-center">
          <div className="text-[10px] text-[#475569] font-extrabold uppercase tracking-widest border-l border-white/5 pl-4">
            v2.5.0-STITCH
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
