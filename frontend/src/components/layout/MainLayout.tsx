import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';

export default function MainLayout() {
  const { isAuthenticated, loading, user } = useAuthStore();
  const { toastData, timeStr, setTimeStr } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', { state: { from: location } });
    }
  }, [isAuthenticated, loading, navigate, location]);

  // Handle Clock
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const p = (v: number) => String(v).padStart(2, '0');
      setTimeStr(`${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())} IST`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [setTimeStr]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-background text-primary font-label tracking-widest">
      INITIATING_CORE...
    </div>
  );

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen w-screen bg-[#020812] text-gray-200 font-sans overflow-hidden">
      
      {/* SIDE NAV BAR */}
      <Sidebar />

      <div className="flex flex-col flex-grow w-[calc(100vw-68px)]">
        {/* TOP NAV BAR */}
        <header className="h-16 w-full bg-[#0B0F19]/90 backdrop-blur-xl border-b border-white/5 flex justify-between items-center px-8 z-30 shrink-0 shadow-lg shadow-black/20">
          <div className="flex items-center gap-8 overflow-hidden">
            <div className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
               <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
               SKYNET
            </div>
            
            <div className="h-4 w-px bg-white/10 hidden sm:block"></div>

            <div className="flex items-center text-gray-500 font-medium text-[11px] tracking-widest whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="text-blue-400 font-bold uppercase">
                {(location.pathname.substring(1) || 'DASHBOARD').toUpperCase().replace('/', ' — ')}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center overflow-hidden rounded-lg shadow-[0_0_15px_rgba(187,195,255,0.2)] border border-white/10 bg-[#0B0F19]">
                <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover scale-[1.3]" />
              </div>
              <span className="text-[14px] font-bold text-white tracking-[0.2em] uppercase font-headline">Skynet</span>
            </div>

            <div 
              className="flex items-center gap-3 bg-white/5 hover:bg-white/10 pl-3 pr-1.5 py-1.5 rounded-xl border border-white/5 cursor-pointer transition-all duration-300 group" 
              onClick={() => navigate('/settings')}
            >
              <span className="text-[11px] font-bold text-gray-300 group-hover:text-white transition-colors hidden sm:inline-block">
                {user?.full_name?.toUpperCase() || 'EMP_0042'}
              </span>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600/20 to-blue-400/20 border border-blue-500/20 flex items-center justify-center text-[12px] font-bold text-blue-400 group-hover:scale-110 transition-transform">
                 {user?.full_name?.[0].toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-grow p-6 md:p-10 overflow-y-auto bg-[#020812] relative scroll-smooth thin-scrollbar">
          <Outlet />
        </main>

        {/* FOOTER / BOTTOM BAR */}
        <footer className="h-10 w-full bg-[#0B0F19]/90 backdrop-blur-xl border-t border-white/5 flex justify-between items-center px-6 z-50 shrink-0">
          <div className="text-[10px] font-bold tracking-widest text-gray-500 flex items-center gap-6 uppercase">
            <span className="hidden sm:inline flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-blue-500/30"></span>
               NVIDIA NIM Connected
            </span>
            <span className="text-blue-400/80">{timeStr}</span>
          </div>
          <div className="text-[10px] font-bold text-gray-600 tracking-widest">
            NODE_V2.4.0_PRO
          </div>
        </footer>
      </div>

      {/* TOAST SYSTEM */}
      <div className={`fixed bottom-12 left-1/2 -translate-x-1/2 bg-[#0B0F19]/95 backdrop-blur-2xl border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-4 text-[11px] font-bold text-emerald-400 tracking-widest z-[999] transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${
        toastData.show ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'
      }`}>
        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_15px_#10b981] animate-pulse"></div>
        <span>{toastData.msg}</span>
      </div>

    </div>
  );
}
