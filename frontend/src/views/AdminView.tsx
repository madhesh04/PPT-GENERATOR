import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { adminApi } from '../api/admin';
import { presentationApi } from '../api/presentation';
import apiClient from '../api/apiClient';

export default function AdminView() {
  const { user } = useAuthStore();
  const { showToast } = useAppStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'pending' | 'generations'>('overview');
  
  // States
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [generations, setGenerations] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState({ image_gen: true, speaker_notes: true, model: 'groq' });
  
  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: '', email: '', password: '', role: 'user' });
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);

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
      } else if (activeTab === 'pending' && isMaster) {
        const data = await adminApi.getPendingUsers();
        setPending(data.pending || []);
      } else if (activeTab === 'generations') {
        const data = await adminApi.getGenerations(selectedUser?.id);
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
  }, [activeTab, selectedUser]);

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

  return (
    <div className="pg act">
      <div className="pey">// SYSTEM_ADMINISTRATION</div>
      <div className="ptl">SKYNET <span className="ac">CONTROL_PANEL</span></div>
      
      {/* Tab Navigation */}
      <div className="fx gap8 mb20 mt16">
        <button className={`btn bs bsm ${activeTab==='overview'?'act':''}`} onClick={()=>setActiveTab('overview')}>OVERVIEW</button>
        <button className={`btn bs bsm ${activeTab==='users'?'act':''}`} onClick={()=>setActiveTab('users')}>USERS</button>
        {isMaster && <button className={`btn bs bsm ${activeTab==='pending'?'act':''}`} onClick={()=>setActiveTab('pending')}>PENDING</button>}
        <button className={`btn bs bsm ${activeTab==='generations'?'act':''}`} onClick={()=>setActiveTab('generations')}>GENERATIONS</button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="sgd mb20" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div className="scard" style={{ padding: 20 }}>
              <div className="sclbl">TOTAL_USERS</div>
              <div className="scval cy" style={{ fontSize: 28 }}>{stats?.total_users || 0}</div>
              <div className="scsub">registered</div>
            </div>
            <div className="scard" style={{ padding: 20 }}>
              <div className="sclbl">TOTAL_GENERATIONS</div>
              <div className="scval am" style={{ fontSize: 28, color: '#00f0ff' }}>{stats?.total_generations || 0}</div>
              <div className="scsub">all time</div>
            </div>
            <div className="scard" style={{ padding: 20 }}>
              <div className="sclbl">PENDING_APPROVALS</div>
              <div className="scval" style={{ fontSize: 28, color: '#ffb800' }}>{stats?.pending_approvals || 0}</div>
              <div className="scsub">awaiting master</div>
            </div>
            <div className="scard" style={{ padding: 20 }}>
              <div className="sclbl">ACTIVE_TODAY</div>
              <div className="scval gn" style={{ fontSize: 28 }}>{stats?.active_today || 0}</div>
              <div className="scsub">last 24h</div>
            </div>
          </div>

          <div className="fl mb12">// SYSTEM_CONFIGURATION</div>
          <div className="sgd" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div className="scard" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="sclbl">IMAGE_GENERATION</div>
                <div className="scsub">Global status: {globalSettings.image_gen ? 'ACTIVE' : 'DISABLED'}</div>
              </div>
              <div 
                className={`tsw ${globalSettings.image_gen ? 'on' : ''}`} 
                onClick={() => handleToggleSetting('image_gen', globalSettings.image_gen)}
              >
                <div className="tknob"></div>
              </div>
            </div>
            <div className="scard" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="sclbl">SPEAKER_NOTES</div>
                <div className="scsub">Global status: {globalSettings.speaker_notes ? 'ACTIVE' : 'DISABLED'}</div>
              </div>
              <div 
                className={`tsw ${globalSettings.speaker_notes ? 'on' : ''}`} 
                onClick={() => handleToggleSetting('speaker_notes', globalSettings.speaker_notes)}
              >
                <div className="tknob"></div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'users' && (
        <>
          <div className="fx jce mb16">
            <button className="btn bp shim" onClick={() => setShowCreateForm(true)}>CREATE_ACCOUNT</button>
          </div>
          {showCreateForm && (
            <div className="card mb20" style={{ padding: 22 }}>
              <div className="cc tl"></div><div className="cc tr"></div>
              <div className="fl mb12">// NEW_ACCOUNT</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <input className="finp" placeholder="Full Name" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
                <input className="finp" type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                <input className="finp" type="password" placeholder="Password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                <select className="seld" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="user">USER</option>
                  <option value="admin">ADMIN</option>
                </select>
              </div>
              <div className="fx gap8">
                <button className="btn bp shim" onClick={handleCreateUser}>REGISTER</button>
                <button className="btn bs" onClick={() => setShowCreateForm(false)}>CANCEL</button>
              </div>
            </div>
          )}
          <div className="card">
            <table className="htbl">
              <thead><tr><th>USERNAME</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="cy">{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>{u.role?.toUpperCase()}</td>
                    <td><span className="hbdg">{u.status?.toUpperCase()}</span></td>
                    <td className="fx gap6">
                      <button className="btn bs bsm" onClick={() => { setSelectedUser(u); setActiveTab('generations'); }}>VIEW_PPTS</button>
                      <button className="btn bs bsm" style={{ color: '#ffb800' }} onClick={() => { setResetTarget(u); setShowResetModal(true); }}>RESET_PWD</button>
                      <button className="btn bs bsm" style={{ color: 'var(--rd)' }} onClick={() => handleDeleteUser(u.id)}>DELETE</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'pending' && (
        <div className="card">
          <table className="htbl">
            <thead><tr><th>USERNAME</th><th>EMAIL</th><th>ROLE</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {pending.map(u => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td className="cy">{u.email}</td>
                  <td>{u.role?.toUpperCase()}</td>
                  <td className="fx gap6">
                    <button className="btn bs bsm" style={{ color: 'var(--gn)' }} onClick={() => handleApprove(u.id)}>APPROVE</button>
                    <button className="btn bs bsm" style={{ color: 'var(--rd)' }} onClick={() => handleReject(u.id)}>REJECT</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'generations' && (
        <div className="card">
          <div className="fl mb12">// {selectedUser ? `${selectedUser.full_name}'S GENERATIONS` : 'GLOBAL_GENERATIONS'}</div>
          <table className="htbl">
            <thead><tr><th>TITLE</th><th>BY</th><th>DATE</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {generations.map(p => (
                <tr key={p.id}>
                  <td className="cy">{p.title}</td>
                  <td>[{p.generated_by}]</td>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="fx gap6">
                    <button className="btn bs bsm" onClick={() => handleDownload(p.id, p.title + '.pptx')}>DOWNLOAD</button>
                    <button className="btn bs bsm" style={{ color: 'var(--rd)' }} onClick={() => handleDeletePpt(p.id)}>DELETE</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="mover op">
          <div className="modal">
            <div className="mtl">RESET_PASSWORD</div>
            <div className="msb">// For: {resetTarget?.email}</div>
            <input className="finp mb16" type="password" placeholder="New Password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
            <div className="fx gap8">
              <button className="btn bp shim" onClick={handleConfirmReset}>COMMIT</button>
              <button className="btn bs" onClick={() => setShowResetModal(false)}>ABORT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
