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
        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
        : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
    }`;

  return (
    <aside className="w-[68px] h-screen bg-[#0B0F19]/90 backdrop-blur-2xl border-r border-white/5 flex flex-col items-center py-6 z-40 shrink-0">
      <div className="mb-10 w-12 h-12 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(59,130,246,0.2)] border border-white/10 bg-[#06080F]">
        <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover scale-[1.3]" />
      </div>
      
      <nav className="flex flex-col gap-5 flex-grow">
        <NavLink to="/" className={navItemClass} title="Dashboard">
          <span className="material-symbols-outlined text-[20px]">dashboard</span>
        </NavLink>
        <NavLink to="/create" className={navItemClass} title="Create PPT">
          <span className="material-symbols-outlined text-[20px]">add_box</span>
        </NavLink>
        <NavLink to="/history" className={navItemClass} title="History">
          <span className="material-symbols-outlined text-[20px]">history</span>
        </NavLink>
        <NavLink to="/settings" className={navItemClass} title="Settings">
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </NavLink>
      </nav>
      
      <div className="mt-auto flex flex-col gap-5">
        {isAdminRole && (
          <NavLink to="/admin" className={navItemClass} title="Admin Panel">
            <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
          </NavLink>
        )}
        <button 
          onClick={handleLogout}
          className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all duration-300"
          title="Logout"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </aside>
  );
}

