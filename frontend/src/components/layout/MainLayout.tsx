import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import ThreeBackground from '../ThreeBackground';

export default function MainLayout() {
  const { isAuthenticated, loading, user, logout } = useAuthStore();
  const { sidebarCollapsed, setSidebarCollapsed, toastData, timeStr, setTimeStr } = useAppStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', { state: { from: location } });
    }
  }, [isAuthenticated, loading, navigate, location]);

  // Click outside listener for profile dropdown
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Handle Clock
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const p = (v: number) => String(v).padStart(2, '0');
      setTimeStr(`${n.getFullYear()}.${p(n.getMonth()+1)}.${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())} IST`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [setTimeStr]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-black text-cyan-500 font-mono">
      INITIATING_CORE...
    </div>
  );

  if (!isAuthenticated) return null;

  return (
    <div className="skynet-app" data-collapsed={String(sidebarCollapsed)}>
      <header className="hdr">
        <div className="lw">
          <div className="lc">S</div>
          <div className="ln">SKYNET<br/><span>PPT_GEN v2.4.0</span></div>
        </div>

        <div className="tgl-c" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          <div className="tgl-dot"></div>
        </div>

        <div className="hc">
          <div className="hbc">
            SKYNET <span className="bcs">/</span> <span className="bca">{location.pathname.substring(1).toUpperCase() || 'DASHBOARD'}</span>
          </div>
        </div>

        <div className="hr2" ref={dropdownRef}>
          <div className="hbdg">
            <div className="sd g"></div> ALL_SYSTEMS_NOMINAL
          </div>
          <div className="hp-w">
            <div className="husr" onClick={() => setShowDropdown(!showDropdown)}>
              <div className="hav">{user?.full_name?.[0].toUpperCase() || 'U'}</div>
              <div className="hun">{user?.full_name || 'skynet_admin'}</div>
              <div className="hchv">{showDropdown ? '▲' : '▼'}</div>
            </div>

            {showDropdown && (
              <div className="udrop">
                <div className="ud-hdr">
                  <div className="ud-n">{user?.full_name}</div>
                  <div className="ud-e">{user?.email}</div>
                  <div className="ud-r">{user?.role?.toUpperCase()}</div>
                </div>
                <div className="ud-sep"></div>
                <button className="ud-i" onClick={() => navigate('/settings')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                  SETTINGS
                </button>
                <button className="ud-i lo" onClick={handleLogout}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                  LOGOUT
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <Sidebar />
      <ThreeBackground />
      <div className="bgo"></div>
      <div className="scl"></div>
      <div className="sbm"></div>

      <main className="main">
        <Outlet />
      </main>

      <div className={`toast ${toastData.show ? 'sh' : ''}`}>
        <div className="sd g"></div>
        <span>{toastData.msg}</span>
      </div>

      {/* Status Bar */}
      <footer className="sbar">
        <div className="si"><div className="sd g"></div>CORE_ONLINE</div>
        <div className="si"><div className="sd c"></div>LLM_CONNECTED</div>
        <div className="si"><div className="sd a"></div>IMAGE_API_ACTIVE</div>
        <div className="sclk">{timeStr}</div>
      </footer>
    </div>
  );
}
