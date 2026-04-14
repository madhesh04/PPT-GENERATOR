import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { adminApi } from '../api/admin';
import { presentationApi } from '../api/presentation';
import apiClient from '../api/apiClient';

export default function AdminView() {
  const { user } = useAuthStore();
  const { showToast } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  
  // States
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pending, setPending] = useState<any[]>([]);
  const [generations, setGenerations] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState({ image_gen: true, speaker_notes: true, model: 'groq' });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Resolve active tab from ?tab= query param
  const queryParams = new URLSearchParams(location.search);
  const activeTab = queryParams.get('tab') || 'users';
  const queryUserId = queryParams.get('userId');

  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: '', email: '', password: '', role: 'user' });
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [resetPassword, setResetPassword] = useState('');

  const isMaster = user?.role?.toUpperCase() === 'MASTER';

  const fetchData = async () => {
    try {
      if (activeTab === 'overview') {
        const [statsData, settingsData] = await Promise.all([
          adminApi.getStats(),
          apiClient.get('/admin/settings')
        ]);
        setStats(statsData);
        setGlobalSettings({
          image_gen: settingsData.data.image_generation_enabled,
          speaker_notes: settingsData.data.speaker_notes_enabled,
          model: settingsData.data.default_model
        });
      } else if (activeTab === 'users') {
        const data = await adminApi.getUsers();
        setUsers(data.users || []);
        setTotalUsers(data.total || data.users?.length || 0);
      } else if (activeTab === 'pending' && isMaster) {
        const data = await adminApi.getPendingUsers();
        setPending(data.pending || []);
      } else if (activeTab === 'generations') {
        const data = await adminApi.getGenerations(queryUserId || undefined);
        setGenerations(data.presentations || []);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleToggleSetting = async (field: string, currentVal: boolean) => {
    const payload: any = {};
    if (field === 'image_gen') payload.image_generation_enabled = !currentVal;
    if (field === 'speaker_notes') payload.speaker_notes_enabled = !currentVal;
    
    showToast(`UPDATING SYSTEM_SETTING: ${field.toUpperCase()}...`);
    try {
      await apiClient.patch('/admin/settings', payload);
      setGlobalSettings(prev => ({ ...prev, [field]: !currentVal }));
      showToast('SUCCESS — Setting updated.');
    } catch (err) {
      showToast('Update failed');
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, queryUserId]);

  const handleCreateUser = async () => {
    try {
      await adminApi.createUser(newUser);
      showToast('Account created');
      setShowCreateForm(false);
      setNewUser({ full_name: '', email: '', password: '', role: 'user' });
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Creation failed');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await adminApi.approveUser(id);
      showToast('User approved');
      fetchData();
    } catch (err) { showToast('Approval failed'); }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Reject this admin request?')) return;
    try {
      await adminApi.rejectUser(id);
      showToast('User rejected');
      fetchData();
    } catch (err) { showToast('Rejection failed'); }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await adminApi.deleteUser(id);
      showToast('User deleted');
      fetchData();
    } catch (err) { showToast('Delete failed'); }
  };

  const handleConfirmReset = async () => {
    if (!resetTarget || !resetPassword) return;
    try {
      await adminApi.updateUserPassword(resetTarget.id, resetPassword);
      showToast('Password updated');
      setShowResetModal(false);
      setResetTarget(null);
      setResetPassword('');
    } catch (err) { showToast('Update failed'); }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      await adminApi.updateUserStatus(id, newStatus);
      showToast(`USER_STATUS_UPDATED: ${newStatus.toUpperCase()}`);
      fetchData();
    } catch (err) { showToast('Update failed'); }
  };

  const handleToggleRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await adminApi.updateUserRole(id, newRole);
      showToast(`USER_ROLE_UPDATED: ${newRole.toUpperCase()}`);
      fetchData();
    } catch (err) { showToast('Update failed'); }
  };

  const handleDeletePpt = async (id: string) => {
    if (!window.confirm('Delete this presentation?')) return;
    try {
      await adminApi.deleteGeneration(id);
      showToast('Presentation deleted');
      fetchData();
    } catch (err) { showToast('Delete failed'); }
  };

  const handleDownload = async (id: string, filename: string) => {
    showToast('DOWNLOAD — Streaming PPTX...');
    try {
      const blob = await presentationApi.downloadPresentation(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) { showToast('DOWNLOAD_FAILED'); }
  };

  const navigateTab = (tab: string) => {
    navigate(`/admin?tab=${tab}`);
  };

  const filterData = (data: any[], searchFields: string[]) => {
    if (!searchTerm) return data;
    const lowerSearch = searchTerm.toLowerCase();
    return data.filter(item => 
      searchFields.some(field => String(item[field] || '').toLowerCase().includes(lowerSearch))
    );
  };

  return (
    <div className="max-w-7xl mx-auto w-full flex flex-col animate-fade-in relative h-full">

      {/* Header Section */}
      <section className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#DC2626] text-3xl">admin_panel_settings</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white mb-1">System Management</h1>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-white/[0.04] px-2.5 py-1 rounded-md inline-block">
                {isMaster ? 'LEVEL_5_MASTER' : 'LEVEL_4_ADMIN'}
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 material-symbols-outlined text-[18px]">search</span>
              <input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#13161F] border border-white/[0.06] focus:border-[#DC2626]/50 text-gray-200 text-sm pl-12 pr-4 py-2.5 rounded-xl w-64 outline-none transition-all shadow-inner placeholder:text-gray-600" 
                placeholder="Search records..." 
                type="text"
              />
            </div>
            {activeTab === 'users' && (
              <button 
                onClick={() => setShowCreateForm(true)}
                className="bg-[#DC2626] hover:bg-[#B91C1C] text-white px-5 py-2.5 rounded-xl font-bold text-[11px] tracking-widest uppercase flex items-center gap-2 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Add User
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto bg-[#0F1118] border border-white/[0.06] p-1.5 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <button 
            onClick={() => navigateTab('users')}
            className={`px-5 py-2.5 font-bold text-[11px] tracking-widest uppercase rounded-xl transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-[#DC2626]/20 text-[#EF4444]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
          >
            User Management
          </button>
          <button 
            onClick={() => navigateTab('generations')}
            className={`px-5 py-2.5 font-bold text-[11px] tracking-widest uppercase rounded-xl transition-all whitespace-nowrap ${activeTab === 'generations' ? 'bg-blue-500/20 text-[#60A5FA]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
          >
            Generation Logs
          </button>
          <button 
            onClick={() => navigateTab('overview')}
            className={`px-5 py-2.5 font-bold text-[11px] tracking-widest uppercase rounded-xl transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
          >
            System Config
          </button>
          {isMaster && (
            <button 
              onClick={() => navigateTab('pending')}
              className={`px-5 py-2.5 font-bold text-[11px] tracking-widest uppercase rounded-xl transition-all whitespace-nowrap ${activeTab === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              Pending Approvals
            </button>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      <section className="flex-1 pb-12 overflow-y-auto">
        
        {/* Create User Form Popup */}
        {showCreateForm && (
          <div className="bg-[#0F1118] border border-white/[0.06] p-6 md:p-8 rounded-xl mb-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)] relative">
            <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
              <span className="material-symbols-outlined text-purple-400 text-[18px]">person_add</span>
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">Provision New Account</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <input className="w-full bg-[#13161F] border border-white/5 text-gray-200 text-sm p-3.5 rounded-xl outline-none focus:border-purple-500/50 shadow-inner" placeholder="Full Name" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
              <input className="w-full bg-[#13161F] border border-white/5 text-gray-200 text-sm p-3.5 rounded-xl outline-none focus:border-purple-500/50 shadow-inner" type="email" placeholder="Email Address" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
              <input className="w-full bg-[#13161F] border border-white/5 text-gray-200 text-sm p-3.5 rounded-xl outline-none focus:border-purple-500/50 shadow-inner" type="password" placeholder="Passcode" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
              <div className="relative">
                <select className="w-full bg-[#13161F] border border-white/5 text-gray-300 text-sm p-3.5 pl-4 rounded-xl focus:border-purple-500/50 outline-none appearance-none cursor-pointer shadow-inner" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="user">Role: User</option>
                  <option value="admin">Role: Admin</option>
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">expand_more</span>
              </div>
            </div>
            <div className="flex gap-4">
              <button className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl font-bold text-[11px] tracking-widest uppercase transition-all shadow-sm" onClick={handleCreateUser}>Register User</button>
              <button className="bg-white/5 hover:bg-white/10 text-white px-6 py-2.5 rounded-xl font-bold text-[11px] tracking-widest uppercase transition-all" onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* SYSTEM CONFIG TAB */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-[#0F1118] border border-white/[0.06] p-6 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Users</span>
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] text-purple-400">group</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white tracking-tight">{stats?.total_users || 0}</div>
              </div>
              
              <div className="bg-[#0F1118] border border-white/[0.06] p-6 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Generations</span>
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] text-[#60A5FA]">bolt</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white tracking-tight">{stats?.total_generations || 0}</div>
              </div>
              
              <div className="bg-[#0F1118] border border-white/[0.06] p-6 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pending Approvals</span>
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] text-amber-400">pending_actions</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white tracking-tight">{stats?.pending_approvals || 0}</div>
              </div>
              
              <div className="bg-[#0F1118] border border-white/[0.06] p-6 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Today</span>
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] text-emerald-400">trending_up</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white tracking-tight">{stats?.active_today || 0}</div>
              </div>
            </div>

            <div className="bg-[#0F1118] border border-white/[0.06] p-6 md:p-8 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                <span className="material-symbols-outlined text-emerald-400 text-[18px]">tune</span>
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">Global Configuration</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-5 rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div>
                    <div className="font-bold text-sm text-gray-200 mb-1">Image Generation</div>
                    <div className="text-[11px] text-gray-500 tracking-wider">Module Status: {globalSettings.image_gen ? 'ACTIVE' : 'DISABLED'}</div>
                  </div>
                  <button 
                    onClick={() => handleToggleSetting('image_gen', globalSettings.image_gen)}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${globalSettings.image_gen ? 'bg-emerald-500' : 'bg-gray-700'} outline-none`}
                  >
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${globalSettings.image_gen ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>
                <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-5 rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div>
                    <div className="font-bold text-sm text-gray-200 mb-1">Speaker Notes</div>
                    <div className="text-[11px] text-gray-500 tracking-wider">Module Status: {globalSettings.speaker_notes ? 'ACTIVE' : 'DISABLED'}</div>
                  </div>
                  <button 
                    onClick={() => handleToggleSetting('speaker_notes', globalSettings.speaker_notes)}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${globalSettings.speaker_notes ? 'bg-emerald-500' : 'bg-gray-700'} outline-none`}
                  >
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${globalSettings.speaker_notes ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="bg-[#0F1118] border border-white/[0.06] rounded-xl shadow-[0_4px_24_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-white/[0.02] border-b border-white/5">
                  <tr>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Index</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Username</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Email Addr</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Privilege</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Status</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filterData(users, ['full_name', 'email']).length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-gray-500 text-xs font-bold tracking-widest uppercase">No Matching Records</td></tr>
                  ) : filterData(users, ['full_name', 'email']).map((u: any, idx: number) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group/row">
                      <td className="py-4 px-6 text-[11px] text-gray-600 font-bold">{String(idx + 1).padStart(3, '0')}</td>
                      <td className="py-4 px-6 text-[13px] font-medium text-white">{u.full_name}</td>
                      <td className="py-4 px-6 text-[12px] text-gray-400">{u.email}</td>
                      <td className="py-4 px-6">
                        <span 
                          onClick={() => handleToggleRole(u.id, u.role)}
                          className={`cursor-pointer px-2.5 py-1 rounded-md text-[9px] font-bold tracking-wider transition-colors border ${u.role === 'admin' || u.role === 'MASTER' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20' : 'bg-blue-500/10 text-[#60A5FA] border-[#2563EB]/20 hover:bg-[#1D4ED8]/20'}`}
                        >
                          {u.role?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span 
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className={`flex items-center gap-1.5 cursor-pointer max-w-max hover:opacity-80 transition-opacity font-bold text-[10px] tracking-wider ${u.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                          {u.status?.toUpperCase() || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2 opacity-40 group-hover/row:opacity-100 transition-opacity">
                          <button onClick={() => navigate(`/admin?tab=generations&userId=${u.id}`)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#1D4ED8]/20 hover:text-[#60A5FA] transition-colors bg-white/5 text-gray-400" title="View Generation Logs">
                            <span className="material-symbols-outlined text-[16px]">history</span>
                          </button>
                          <button onClick={() => { setResetTarget(u); setShowResetModal(true); }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-amber-500/20 hover:text-amber-400 transition-colors bg-white/5 text-gray-400" title="Force Password Reset">
                            <span className="material-symbols-outlined text-[16px]">key</span>
                          </button>
                          <button onClick={() => handleDeleteUser(u.id)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors bg-white/5 text-gray-400" title="Terminate Account">
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="bg-white/[0.01] border-t border-white/5 px-6 py-4 flex justify-between items-center">
              <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Total Registered Identities: {totalUsers}</span>
            </div>
          </div>
        )}

        {/* PENDING APPROVALS TAB */}
        {activeTab === 'pending' && (
          <div className="bg-[#0F1118] border border-white/[0.06] rounded-xl shadow-[0_4px_24_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-white/[0.02] border-b border-white/5">
                  <tr>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Index</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Username</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Email Addr</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Requested Role</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filterData(pending, ['full_name', 'email']).length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-gray-500 text-xs font-bold tracking-widest uppercase">No Pending Approvals</td></tr>
                  ) : filterData(pending, ['full_name', 'email']).map((u: any, idx: number) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group/row">
                      <td className="py-4 px-6 text-[11px] text-gray-600 font-bold">{String(idx + 1).padStart(3, '0')}</td>
                      <td className="py-4 px-6 text-[13px] font-medium text-white">{u.full_name}</td>
                      <td className="py-4 px-6 text-[12px] text-gray-400">{u.email}</td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-md text-[9px] font-bold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">{u.role?.toUpperCase()}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2 opacity-40 group-hover/row:opacity-100 transition-opacity">
                          <button onClick={() => handleApprove(u.id)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors bg-white/5 text-gray-400" title="Authorize">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          </button>
                          <button onClick={() => handleReject(u.id)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors bg-white/5 text-gray-400" title="Reject">
                            <span className="material-symbols-outlined text-[16px]">cancel</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GENERATIONS LOGS TAB */}
        {activeTab === 'generations' && (
          <div className="bg-[#0F1118] border border-white/[0.06] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
            {queryUserId && (
              <div className="px-6 py-4 bg-blue-500/10 border-b border-[#2563EB]/20 flex justify-between items-center text-[#60A5FA] text-[11px] font-bold tracking-wider uppercase">
                <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">filter_alt</span> Filtering by User ID = {queryUserId}</span>
                <button onClick={() => navigate('/admin?tab=generations')} className="hover:text-white transition-colors underline decoration-blue-500/50">Clear Filter</button>
              </div>
            )}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-white/[0.02] border-b border-white/5">
                  <tr>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Log ID</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Deck Title</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Model</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Operator</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Timestamp</th>
                    <th className="py-4 px-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filterData(generations, ['title', 'generated_by']).length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-gray-500 text-xs font-bold tracking-widest uppercase">No Logs Found</td></tr>
                  ) : filterData(generations, ['title', 'generated_by']).map((p: any) => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group/row">
                      <td className="py-4 px-6 text-[11px] text-gray-600 font-bold">#{p.id.substring(0, 6).toUpperCase()}</td>
                      <td className="py-4 px-6 text-[13px] font-medium text-white">{p.title}</td>
                      <td className="py-4 px-6">
                        <span className="text-[11px] text-gray-400 font-mono tracking-tighter bg-[#13161F] px-2 py-1 rounded max-w-max border border-white/5">
                          {p.model_used || 'GROQ'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-[11px] font-medium text-amber-400">{p.generated_by || 'UNKNOWN'}</td>
                      <td className="py-4 px-6 text-[11px] text-gray-500">{p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2 opacity-40 group-hover/row:opacity-100 transition-opacity">
                          <button onClick={() => handleDownload(p.id, p.title + '.pptx')} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors bg-white/5 text-gray-400" title="Export Artifact">
                            <span className="material-symbols-outlined text-[16px]">download</span>
                          </button>
                          <button onClick={() => handleDeletePpt(p.id)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors bg-white/5 text-gray-400" title="Purge Log">
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="bg-white/[0.01] border-t border-white/5 px-6 py-4 flex justify-between items-center">
              <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Total Generations In View: {filterData(generations, ['title', 'generated_by']).length}</span>
            </div>
          </div>
        )}

      </section>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-[#020812]/90 backdrop-blur-md z-[100] flex items-center justify-center animate-fade-in p-4">
          <div className="bg-[#0F1118] border border-amber-500/30 max-w-md w-full p-8 rounded-xl shadow-[0_0_50px_rgba(251,191,36,0.15)] relative">
            <button 
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-gray-400 hover:text-white transition-colors"
              onClick={() => { setShowResetModal(false); setResetPassword(''); }}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="flex items-center gap-4 mb-6 text-amber-500">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">key</span>
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-widest uppercase text-white">Override Protocol</h2>
                <p className="text-[10px] font-bold uppercase text-amber-400/70 tracking-widest">Target: {resetTarget?.email}</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <input 
                className="w-full bg-[#13161F] border border-amber-500/20 text-white text-sm p-4 rounded-xl focus:border-amber-500/50 outline-none shadow-inner" 
                type="password" 
                placeholder="Enter new credentials..." 
                value={resetPassword} 
                onChange={e => setResetPassword(e.target.value)} 
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleConfirmReset(); }}
              />
            </div>

            <div className="flex gap-4">
              <button 
                className="flex-1 bg-amber-500 text-[#020812] py-3.5 rounded-xl font-bold text-[11px] tracking-widest uppercase hover:bg-amber-400 transition-colors shadow-[0_4px_15px_-3px_rgba(251,191,36,0.3)]" 
                onClick={handleConfirmReset}
              >
                Execute Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
