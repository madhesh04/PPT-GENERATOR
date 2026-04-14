import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const isAdminRole = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'MASTER';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) => 
    `w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 ${
      isActive 
        ? "text-[#2563EB]" 
        : "text-[#475569] hover:bg-white/5 hover:text-[#94A3B8]"
    }`;

  // Admin-specific nav item (red accent)
  const adminNavItemClass = ({ isActive }: { isActive: boolean }) => 
    `w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 ${
      isActive 
        ? "text-[#DC2626]" 
        : "text-[#475569] hover:bg-white/5 hover:text-[#94A3B8]"
    }`;

  return (
    <aside className="w-[52px] h-screen bg-[#0B0D14] border-r border-white/5 flex flex-col items-center py-4 z-40 shrink-0">
      <div className="mb-8 w-9 h-9 flex items-center justify-center rounded-lg bg-[#1E293B] border border-white/10">
        <span className="material-symbols-outlined text-[#FBBF24] text-[20px]">bolt</span>
      </div>
      
      <nav className="flex flex-col gap-4 flex-grow">
        <NavLink to="/" className={navItemClass} title="Dashboard">
          <span className="material-symbols-outlined text-[20px]">dashboard</span>
        </NavLink>
        <NavLink to="/create" className={navItemClass} title="Create PPT">
          <span className="material-symbols-outlined text-[20px]">add_box</span>
        </NavLink>
        <NavLink to="/history" className={navItemClass} title="History">
          <span className="material-symbols-outlined text-[20px]">history</span>
        </NavLink>
      </nav>
      
      <div className="mt-auto flex flex-col gap-4 pb-4">
        {isAdminRole && (
          <NavLink to="/admin" className={adminNavItemClass} title="Admin Panel">
            <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
          </NavLink>
        )}
        <NavLink to="/settings" className={navItemClass} title="Settings">
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </NavLink>
        <button 
          onClick={handleLogout}
          className="w-10 h-10 flex items-center justify-center text-[#475569] hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all duration-300"
          title="Logout"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </aside>
  );
}

