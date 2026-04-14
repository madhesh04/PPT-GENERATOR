import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
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
    <div className="flex h-screen w-screen bg-[#0A0C12] text-gray-200 font-sans overflow-hidden">
      
      {/* SIDE NAV BAR */}
      <Sidebar />

      <div className="flex flex-col flex-grow w-[calc(100vw-52px)]">
        {/* TOP NAV BAR */}
        <header className="h-[52px] w-full bg-[#0D0F17] border-b border-white/[0.06] flex justify-between items-center px-6 z-30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[14px] font-bold text-white tracking-tight leading-tight">PPT Generator</span>
                <span className="text-[9px] font-mono text-[#475569] tracking-widest uppercase leading-tight">Q LABS · SWIFT OPS</span>
              </div>
            </div>

            <div 
              className="flex items-center gap-3 bg-white/5 hover:bg-white/10 pl-3 pr-4 py-1.5 rounded-xl border border-white/5 cursor-pointer transition-all duration-300 group" 
              onClick={() => navigate('/settings')}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600/20 to-blue-400/20 border border-[#2563EB]/20 flex items-center justify-center text-[12px] font-bold text-[#60A5FA] group-hover:scale-110 transition-transform">
                 {user?.full_name?.[0].toUpperCase() || 'U'}
              </div>
              <span className="text-[12px] font-bold text-gray-300 group-hover:text-white transition-colors tracking-wide pr-1">
                {user?.full_name?.toUpperCase() || 'EMP_0042'}
              </span>
            </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-grow p-6 md:p-[24px_28px] overflow-y-auto bg-[#0A0C12] relative scroll-smooth thin-scrollbar pb-[40px]">
          <Outlet />
        </main>

        {/* FOOTER / BOTTOM BAR */}
        <StatusBar mode={user?.role === 'ADMIN' ? 'admin' : 'employee'} />
      </div>

      {/* TOAST SYSTEM */}
      <div className={`fixed bottom-12 left-1/2 -translate-x-1/2 bg-[#0F1118]/95 backdrop-blur-2xl border border-emerald-500/30 rounded-xl p-4 flex items-center gap-4 text-[11px] font-bold text-emerald-400 tracking-widest z-[999] transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${
        toastData.show ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'
      }`}>
        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_15px_#10b981] animate-pulse"></div>
        <span>{toastData.msg}</span>
      </div>

    </div>
  );
}
