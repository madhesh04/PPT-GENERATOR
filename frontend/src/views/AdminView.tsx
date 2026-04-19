import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../components/ui/ToastContainer';
import { adminApi } from '../api/admin';
import { presentationApi } from '../api/presentation';
import apiClient from '../api/apiClient';
import SearchableDropdown from '../components/ui/SearchableDropdown';

interface AdminStats {
  total_users: number;
  total_generations: number;
  pending_approvals: number;
  active_today: number;
}

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  ppt_count: number;
  created_at?: string;
}

interface AdminGeneration {
  id: string;
  title: string;
  model_used: string;
  generated_by: string;
  created_at: string;
}

export default function AdminView() {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  const location = useLocation();
  const navigate = useNavigate();
  
  // States
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pending, setPending] = useState<AdminUser[]>([]);
  const [generations, setGenerations] = useState<AdminGeneration[]>([]);
  const [globalSettings, setGlobalSettings] = useState({ image_gen: true, speaker_notes: true, model: 'groq' });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Resolve active tab from ?tab= query param
  const queryParams = new URLSearchParams(location.search);
  const activeTab = queryParams.get('tab') || 'users';
  const queryUserId = queryParams.get('userId');

  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: '', email: '', password: '', role: 'user' });
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  
  // Confirmation state
  const [confirmConfig, setConfirmConfig] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning';
  }>({ show: false, title: '', message: '', onConfirm: () => {}, type: 'danger' });

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
    const payload: Record<string, string | boolean> = {};
    if (field === 'image_gen') payload.image_generation_enabled = !currentVal;
    if (field === 'speaker_notes') payload.speaker_notes_enabled = !currentVal;
    
    showToast(`UPDATING SYSTEM_SETTING: ${field.toUpperCase()}...`, 'info');
    try {
      await apiClient.patch('/admin/settings', payload);
      setGlobalSettings(prev => ({ ...prev, [field]: !currentVal }));
      showToast('SUCCESS — Setting updated.', 'success');
    } catch {
      showToast('Update failed', 'error');
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, queryUserId]);

  const handleCreateUser = async () => {
    try {
      await adminApi.createUser(newUser);
      showToast('Account created', 'success');
      setShowCreateForm(false);
      setNewUser({ full_name: '', email: '', password: '', role: 'user' });
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      showToast(error.response?.data?.detail || 'Creation failed', 'error');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await adminApi.approveUser(id);
      showToast('User approved', 'success');
      fetchData();
    } catch { showToast('Approval failed', 'error'); }
  };

  const handleReject = async (id: string) => {
    setConfirmConfig({
      show: true,
      title: 'Authorize Rejection',
      message: 'Are you sure you want to reject this admin request? This action will permanently remove the application.',
      type: 'warning',
      onConfirm: async () => {
        try {
          await adminApi.rejectUser(id);
          showToast('User rejected', 'success');
          fetchData();
        } catch { showToast('Rejection failed', 'error'); }
        setConfirmConfig(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleDeleteUser = async (id: string) => {
    setConfirmConfig({
      show: true,
      title: 'Purge Identity',
      message: 'WARNING: This will permanently delete the user account and all associated metadata. Continue?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await adminApi.deleteUser(id);
          showToast('User deleted', 'success');
          fetchData();
        } catch { showToast('Delete failed', 'error'); }
        setConfirmConfig(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleConfirmReset = async () => {
    if (!resetTarget || !resetPassword) return;
    try {
      await adminApi.updateUserPassword(resetTarget.id, resetPassword);
      showToast('Password updated', 'success');
      setShowResetModal(false);
      setResetTarget(null);
      setResetPassword('');
    } catch { showToast('Update failed', 'error'); }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      await adminApi.updateUserStatus(id, newStatus);
      showToast(`USER_STATUS_UPDATED: ${newStatus.toUpperCase()}`, 'info');
      fetchData();
    } catch { showToast('Update failed', 'error'); }
  };

  const handleToggleRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await adminApi.updateUserRole(id, newRole);
      showToast(`USER_ROLE_UPDATED: ${newRole.toUpperCase()}`, 'info');
      fetchData();
    } catch { showToast('Update failed', 'error'); }
  };

  const handleDeletePpt = async (id: string) => {
    setConfirmConfig({
      show: true,
      title: 'Purge Artifact',
      message: 'This will permanently delete the presentation from the system archive. Confirm?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await adminApi.deleteGeneration(id);
          showToast('Presentation deleted', 'success');
          fetchData();
        } catch { showToast('Delete failed', 'error'); }
        setConfirmConfig(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleDownload = async (id: string, filename: string) => {
    showToast('DOWNLOAD — Streaming PPTX...', 'info');
    try {
      const blob = await presentationApi.downloadPresentation(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Download complete', 'success');
    } catch { showToast('DOWNLOAD_FAILED', 'error'); }
  };

  const navigateTab = (tab: string) => {
    navigate(`/admin?tab=${tab}`);
  };

  const filterData = <T extends Record<string, any>>(data: T[], searchFields: (keyof T)[]) => {
    let result = data;
    
    // 1. Text Search
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => 
        searchFields.some(field => String(item[field] || '').toLowerCase().includes(lowerSearch))
      );
    }
    
    // 2. Role Filter (for users/pending tabs)
    if (roleFilter !== 'all' && (activeTab === 'users' || activeTab === 'pending')) {
      result = result.filter(item => (item.role || '').toLowerCase() === roleFilter.toLowerCase());
    }
    
    // 3. Status Filter (for users tab)
    if (statusFilter !== 'all' && activeTab === 'users') {
      result = result.filter(item => (item.status || 'active').toLowerCase() === statusFilter.toLowerCase());
    }
    
    return result;
  };

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div className="page-header-left">
          <div className="page-header-icon" style={{ borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.1)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--red)' }}>admin_panel_settings</span>
          </div>
          <div>
            <div className="page-title">System Management</div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.1em', marginTop: '2px' }}>
              {isMaster ? 'MASTER' : 'ADMIN'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: 'var(--text-muted)' }}>search</span>
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-input"
              style={{ width: '220px', paddingLeft: '32px', borderRadius: 'var(--r-pill)' }}
              placeholder="Search records..." 
              type="text"
            />
          </div>
          {activeTab === 'users' && (
            <button 
              onClick={() => setShowCreateForm(true)}
              className="primary-btn"
              style={{ background: 'linear-gradient(135deg, var(--red), #b91c1c)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person_add</span>
              Add User
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="create-tabs">
        <button 
          onClick={() => navigateTab('users')}
          className={`create-tab ${activeTab === 'users' ? 'active' : ''}`}
          style={activeTab === 'users' ? { background: 'rgba(239,68,68,0.15)', color: 'var(--red)', boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.2)' } : undefined}
        >
          User Management
        </button>
        <button 
          onClick={() => navigateTab('generations')}
          className={`create-tab ${activeTab === 'generations' ? 'active' : ''}`}
        >
          Generation Logs
        </button>
        <button 
          onClick={() => navigateTab('overview')}
          className={`create-tab ${activeTab === 'overview' ? 'active' : ''}`}
          style={activeTab === 'overview' ? { background: 'rgba(34,211,165,0.15)', color: 'var(--green)', boxShadow: 'inset 0 0 0 1px rgba(34,211,165,0.2)' } : undefined}
        >
          System Config
        </button>
        {isMaster && (
          <button 
            onClick={() => navigateTab('pending')}
            className={`create-tab ${activeTab === 'pending' ? 'active' : ''}`}
            style={activeTab === 'pending' ? { background: 'rgba(245,197,66,0.15)', color: 'var(--yellow)', boxShadow: 'inset 0 0 0 1px rgba(245,197,66,0.2)' } : undefined}
          >
            Pending Approvals
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{ paddingBottom: '40px' }}>
        
        {/* Create User Form Popup */}
        {showCreateForm && (
          <div className="card" style={{ marginBottom: '20px', borderColor: 'rgba(168, 85, 247, 0.3)', borderWidth: '1px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-faint)', paddingBottom: '16px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--purple)', fontSize: '18px' }}>person_add</span>
              <h2 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Provision New Account</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <input className="text-input" placeholder="Full Name" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
              <input className="text-input" type="email" placeholder="Email Address" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
              <input className="text-input" type="password" placeholder="Passcode" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
              <div style={{ position: 'relative' }}>
                <select className="select-input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="user">Role: User</option>
                  <option value="admin">Role: Admin</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="primary-btn" style={{ background: 'linear-gradient(135deg, var(--purple), #9333ea)' }} onClick={handleCreateUser}>Register User</button>
              <button className="ghost-btn" onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* SYSTEM CONFIG TAB */}
        {activeTab === 'overview' && (
          <div style={{ animation: 'fadeUp 0.2s ease both' }}>
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-top">
                  <div className="kpi-icon purple"><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>group</span></div>
                </div>
                <div className="kpi-label">Total Users</div>
                <div className="kpi-value num">{stats?.total_users || 0}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <div className="kpi-icon blue"><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>bolt</span></div>
                </div>
                <div className="kpi-label">Generations</div>
                <div className="kpi-value num">{stats?.total_generations || 0}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <div className="kpi-icon yellow"><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>pending_actions</span></div>
                </div>
                <div className="kpi-label">Pending Approvals</div>
                <div className="kpi-value num">{stats?.pending_approvals || 0}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <div className="kpi-icon green"><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>trending_up</span></div>
                </div>
                <div className="kpi-label">Active Today</div>
                <div className="kpi-value num">{stats?.active_today || 0}</div>
              </div>
            </div>

            <div className="card" style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-faint)', paddingBottom: '16px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--green)', fontSize: '18px' }}>tune</span>
                <h2 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Global Configuration</h2>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Image Gen Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '16px 20px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Image Generation</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>Module Status: <span style={{ color: globalSettings.image_gen ? 'var(--green)' : 'inherit' }}>{globalSettings.image_gen ? 'ACTIVE' : 'DISABLED'}</span></div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={globalSettings.image_gen} onChange={() => handleToggleSetting('image_gen', globalSettings.image_gen)} />
                    <span className="toggle-track" style={globalSettings.image_gen ? { background: 'rgba(34,211,165,0.2)', borderColor: 'rgba(34,211,165,0.4)' } : {}}></span>
                  </label>
                </div>
                {/* Speaker Notes Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '16px 20px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Speaker Notes</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>Module Status: <span style={{ color: globalSettings.speaker_notes ? 'var(--green)' : 'inherit' }}>{globalSettings.speaker_notes ? 'ACTIVE' : 'DISABLED'}</span></div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={globalSettings.speaker_notes} onChange={() => handleToggleSetting('speaker_notes', globalSettings.speaker_notes)} />
                    <span className="toggle-track" style={globalSettings.speaker_notes ? { background: 'rgba(34,211,165,0.2)', borderColor: 'rgba(34,211,165,0.4)' } : {}}></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="table-wrap" style={{ overflow: 'visible' }}>
            <div className="table-header-bar" style={{ paddingBottom: '14px', alignItems: 'center' }}>
               <span className="table-title">User Roster</span>
               <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                 <div style={{ minWidth: '170px' }}>
                   <SearchableDropdown
                     id="admin-role-filter"
                     label="ROLE"
                     value={roleFilter}
                     options={[
                       { label: 'All Roles', value: 'all' },
                       { label: 'Admin', value: 'admin' },
                       { label: 'User / Employee', value: 'user' },
                       { label: 'Master', value: 'master' }
                     ]}
                     onChange={setRoleFilter}
                     searchable={false}
                   />
                 </div>
                 <div style={{ minWidth: '170px' }}>
                   <SearchableDropdown
                     id="admin-status-filter"
                     label="STATUS"
                     value={statusFilter}
                     options={[
                       { label: 'All Statuses', value: 'all' },
                       { label: 'Active', value: 'active' },
                       { label: 'Disabled', value: 'disabled' }
                     ]}
                     onChange={setStatusFilter}
                     searchable={false}
                   />
                 </div>
               </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Index</th>
                  <th>Username</th>
                  <th>Email Addr</th>
                  <th>Privilege</th>
                  <th>Status</th>
                  <th>Generations</th>
                  <th style={{ textAlign: 'right' }}>Operations</th>
                </tr>
              </thead>
              <tbody>
                {filterData(users, ['full_name', 'email']).length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No Matching Records</td></tr>
                ) : filterData(users, ['full_name', 'email']).map((u: AdminUser, idx: number) => (
                  <tr key={u.id}>
                    <td className="mono-cell" style={{ fontWeight: 800 }}>{String(idx + 1).padStart(3, '0')}</td>
                    <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                    <td className="mono-cell">{u.email}</td>
                    <td>
                      <span 
                        onClick={() => handleToggleRole(u.id, u.role)}
                        className={`badge ${u.role?.toLowerCase() === 'admin' || u.role?.toLowerCase() === 'master' ? 'badge-purple' : 'badge-blue'}`}
                        style={{ cursor: 'pointer' }}
                      >
                        {u.role?.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span 
                        onClick={() => handleToggleStatus(u.id, u.status)}
                        className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="badge-dot" style={u.status === 'active' ? { animation: 'blink 2s infinite' } : {}}></span>
                        {u.status?.toUpperCase() || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="mono-cell" style={{ color: 'var(--text-primary)', fontWeight: 800 }}>
                      {u.ppt_count}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => navigate(`/admin?tab=generations&userId=${u.id}`)} className="ghost-btn" style={{ padding: '5px 8px' }} title="View Logs">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>history</span>
                        </button>
                        <button onClick={() => { setResetTarget(u); setShowResetModal(true); }} className="ghost-btn" style={{ padding: '5px 8px', color: 'var(--yellow)', borderColor: 'rgba(245,197,66,0.3)' }} title="Reset Password">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>key</span>
                        </button>
                        <button onClick={() => handleDeleteUser(u.id)} className="ghost-btn" style={{ padding: '5px 8px', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }} title="Delete">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-footer">
              <span className="records-label">TOTAL REGISTERED IDENTITIES: {totalUsers}</span>
            </div>
          </div>
        )}

        {/* PENDING APPROVALS TAB */}
        {activeTab === 'pending' && (
          <div className="table-wrap">
            <div className="table-header-bar">
               <span className="table-title">Pending Approvals</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Index</th>
                  <th>Username</th>
                  <th>Email Addr</th>
                  <th>Requested Role</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filterData(pending, ['full_name', 'email']).length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No Pending Approvals</td></tr>
                ) : filterData(pending, ['full_name', 'email']).map((u: AdminUser, idx: number) => (
                  <tr key={u.id}>
                    <td className="mono-cell" style={{ fontWeight: 800 }}>{String(idx + 1).padStart(3, '0')}</td>
                    <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                    <td className="mono-cell">{u.email}</td>
                    <td>
                      <span className="badge badge-yellow">{u.role?.toUpperCase()}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => handleApprove(u.id)} className="ghost-btn" style={{ padding: '5px 8px', color: 'var(--green)', borderColor: 'rgba(34,211,165,0.3)' }} title="Authorize">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                        </button>
                        <button onClick={() => handleReject(u.id)} className="ghost-btn" style={{ padding: '5px 8px', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }} title="Reject">
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cancel</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* GENERATIONS LOGS TAB */}
        {activeTab === 'generations' && (
          <div className="table-wrap">
            <div className="table-header-bar" style={{ paddingBottom: queryUserId ? '14px' : '0' }}>
               <span className="table-title">Generation Archive</span>
            </div>
            
            {queryUserId && (
              <div style={{ background: 'rgba(3,37,189,0.1)', borderTop: '1px solid rgba(3,37,189,0.2)', borderBottom: '1px solid rgba(3,37,189,0.2)', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>filter_alt</span> Filtering by User ID = <span className="mono-cell">{queryUserId}</span>
                </span>
                <button onClick={() => navigate('/admin?tab=generations')} className="ghost-btn" style={{ padding: '4px 8px', fontSize: '9px' }}>Clear Filter</button>
              </div>
            )}

            <table>
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Deck Title</th>
                  <th>Model</th>
                  <th>Operator</th>
                  <th>Timestamp</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filterData(generations, ['title', 'generated_by']).length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No Logs Found</td></tr>
                ) : filterData(generations, ['title', 'generated_by']).map((p: AdminGeneration) => (
                  <tr key={p.id}>
                    <td className="mono-cell" style={{ fontWeight: 800 }}>#{p.id.substring(0, 6).toUpperCase()}</td>
                    <td style={{ fontWeight: 600 }}>{p.title}</td>
                    <td>
                      <span className="badge badge-muted mono-cell" style={{ fontSize: '9px', padding: '2px 6px' }}>{p.model_used || 'GROQ'}</span>
                    </td>
                    <td className="mono-cell" style={{ color: 'var(--yellow)' }}>{p.generated_by || 'UNKNOWN'}</td>
                    <td className="mono-cell">{p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => handleDownload(p.id, p.title + '.pptx')} className="action-btn action-btn-dl" title="Export Artifact">
                           <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                           DL
                        </button>
                        <button onClick={() => handleDeletePpt(p.id)} className="action-btn action-btn-del" title="Purge Log">
                           <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           DEL
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-footer">
              <span className="records-label">TOTAL GENERATIONS IN VIEW: {filterData(generations, ['title', 'generated_by']).length}</span>
            </div>
          </div>
        )}

      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="progress-overlay show">
          <div className="progress-modal" style={{ maxWidth: '400px', borderColor: 'var(--border)', boxShadow: '0 0 60px rgba(0,0,0,0.5)', padding: '30px' }}>
            <button 
              className="ghost-btn" style={{ position: 'absolute', top: '16px', right: '16px', padding: '6px' }}
              onClick={() => { setShowResetModal(false); setResetPassword(''); }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(245,197,66,0.1)', color: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245,197,66,0.3)' }}>
                <span className="material-symbols-outlined">key</span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h2 className="progress-title">Override Protocol</h2>
                <div className="mono-cell" style={{ color: 'var(--yellow)' }}>Target: {resetTarget?.email}</div>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <input 
                className="text-input" 
                type="password" 
                placeholder="Enter new credentials..." 
                value={resetPassword} 
                onChange={e => setResetPassword(e.target.value)} 
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleConfirmReset(); }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="primary-btn" style={{ flex: 1, justifyContent: 'center', background: 'linear-gradient(135deg, var(--yellow), #d97706)', color: '#000' }} onClick={handleConfirmReset}>
                Execute Reset
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      {confirmConfig.show && (
        <div className="progress-overlay show">
          <div className="progress-modal" style={{ maxWidth: '400px', padding: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ 
                width: '40px', height: '40px', borderRadius: '50%', 
                background: confirmConfig.type === 'danger' ? 'rgba(239,68,68,0.1)' : 'rgba(245,197,66,0.1)', 
                color: confirmConfig.type === 'danger' ? 'var(--red)' : 'var(--yellow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${confirmConfig.type === 'danger' ? 'rgba(239,68,68,0.2)' : 'rgba(245,197,66,0.2)'}`
              }}>
                <span className="material-symbols-outlined">{confirmConfig.type === 'danger' ? 'report' : 'warning'}</span>
              </div>
              <div>
                <h2 className="progress-title" style={{ fontSize: '14px' }}>{confirmConfig.title}</h2>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{confirmConfig.message}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="primary-btn" 
                style={{ 
                  flex: 1, justifyContent: 'center', 
                  background: confirmConfig.type === 'danger' ? 'var(--red)' : 'var(--yellow)',
                  color: confirmConfig.type === 'danger' ? '#fff' : '#000'
                }} 
                onClick={confirmConfig.onConfirm}
              >
                Confirm Action
              </button>
              <button 
                className="ghost-btn" 
                style={{ flex: 1, justifyContent: 'center' }} 
                onClick={() => setConfirmConfig(prev => ({ ...prev, show: false }))}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
