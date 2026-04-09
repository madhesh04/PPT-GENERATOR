import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { usePresentationStore } from '../../store/usePresentationStore';

export default function Sidebar() {
  const { user } = useAuthStore();
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const { slides } = usePresentationStore();
  const [profileDropdown, setProfileDropdown] = useState(false);

  const isAdminRole = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'MASTER';
  const isMaster = user?.role?.toUpperCase() === 'MASTER';

  // Profile dropdown outside click handler
  useEffect(() => {
    if (!profileDropdown) return;
    const close = () => setProfileDropdown(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [profileDropdown]);


  return (
    <aside className={`sb ${sidebarCollapsed ? 'cl' : ''}`}>
      <div className="ndv"></div>
      <div className="ns">
        <div className="nsl">// NAVIGATION</div>
        <NavLink to="/" className={({ isActive }) => `ni ${isActive ? 'act' : ''}`}>
          <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span className="ni-lbl">DASHBOARD</span>
        </NavLink>
        <NavLink to="/create" className={({ isActive }) => `ni ${isActive ? 'act' : ''}`}>
          <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14"/></svg>
          <span className="ni-lbl">CREATE_PPT</span>
        </NavLink>
        <NavLink to="/preview" className={({ isActive }) => `ni ${isActive ? 'act' : ''}`}>
          <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          <span className="ni-lbl">PREVIEW</span>
          {slides.length > 0 && <span className="ni-b">{slides.length}</span>}
        </NavLink>
      </div>

      <div className="ndv"></div>

      <div className="ns">
        <div className="nsl">// SYSTEM</div>
        <NavLink to="/history" className={({ isActive }) => `ni ${isActive ? 'act' : ''}`}>
          <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span className="ni-lbl">HISTORY</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `ni ${isActive ? 'act' : ''}`}>
          <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          <span className="ni-lbl">SETTINGS</span>
        </NavLink>
      </div>

      {isAdminRole && (
        <>
          <div className="ndv"></div>
          <div className="ns">
            <div className="nsl">// ADMIN</div>
            <NavLink to="/admin" end className={({ isActive }) => `ni ${isActive ? 'act' : ''}`}>
              <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span className="ni-lbl">ADMIN_PANEL</span>
            </NavLink>
            <NavLink to="/admin/users" className={({ isActive }) => `ni ${isActive ? 'act' : ''}`}>
              <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              <span className="ni-lbl">USER_MANAGEMENT</span>
            </NavLink>
            <NavLink to="/admin/generations" className={({ isActive }) => `ni ${isActive ? 'act' : ''}`}>
              <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                 <rect x="3" y="3" width="7" height="7" rx="1"/>
                 <rect x="14" y="3" width="7" height="7" rx="1"/>
                 <rect x="3" y="14" width="7" height="7" rx="1"/>
                 <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              <span className="ni-lbl">GLOBAL_GENERATIONS</span>
            </NavLink>
          </div>
        </>
      )}
      
      <div className="sbf">
        SKYNET_CORE v2.4.0<br/>
        GROQ_LLM // CONNECTED<br/>
        NVIDIA_NIM // STANDBY<br/>
        IMAGE_API // ACTIVE
      </div>
    </aside>
  );
}
