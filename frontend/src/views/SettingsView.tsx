import { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastContainer';

/* Icons */
const SettingsIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const UserIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);
const SparkIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);
const TagIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L12.114 3.66A2.25 2.25 0 0010.53 3H9.568zM6 6h.008v.008H6V6z" />
  </svg>
);
const ApiIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 15" />
  </svg>
);
const BellIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
);
const EyeIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const EyeOffIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);
const SaveIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);
const PlusIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const TABS = [
  { id: 'profile', label: 'Profile', icon: <UserIcon /> },
  { id: 'generation', label: 'Generation', icon: <SparkIcon /> },
  { id: 'taxonomy', label: 'Taxonomy', icon: <TagIcon /> },
  { id: 'api', label: 'API & Integrations', icon: <ApiIcon /> },
  { id: 'notifications', label: 'Notifications', icon: <BellIcon /> },
] as const;
type TabId = typeof TABS[number]['id'];

/* Taxonomy manager */
function TaxonomySection({ label, items, onAdd, onRemove }: { label: string; items: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void }) {
  const [draft, setDraft] = useState('');
  function add() { const v = draft.trim(); if (v && !items.includes(v)) { onAdd(v); setDraft(''); } }
  return (
    <div className="taxonomy-section">
      <div className="tax-section-hdr">{label}</div>
      <div className="tax-list">
        {items.map((item) => (
          <span key={item} className="tax-item">
            {item}
            <button className="tax-item-x" onClick={() => onRemove(item)} aria-label={`Remove ${item}`}>×</button>
          </span>
        ))}
      </div>
      <div className="tax-add-row">
        <input
          className="tax-add-input"
          type="text"
          placeholder={`Add ${label.toLowerCase()}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="tax-add-btn" onClick={add}><PlusIcon /></button>
      </div>
    </div>
  );
}

/* Toggle row */
function PrefToggle({ name, desc, checked, onChange, disabled }: { name: string; desc: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="pref-row" style={{ opacity: disabled ? 0.6 : 1 }}>
      <div className="pref-info">
        <div className="pref-name">{name}</div>
        <div className="pref-desc">{disabled ? 'Disabled by Admin' : desc}</div>
      </div>
      <div className="pref-control">
        <label className="toggle">
          <input type="checkbox" checked={disabled ? false : checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
          <div className="toggle-track" />
        </label>
      </div>
    </div>
  );
}

/* API Key field */
function ApiKeyField({ id, label, value }: { id: string; label: string; value: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
      <label className="settings-field-label" htmlFor={id}>{label}</label>
      <div className="api-key-wrap">
        <input
          id={id}
          className="settings-input"
          type={visible ? 'text' : 'password'}
          defaultValue={value}
          style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}
        />
        <button className="api-eye" onClick={() => setVisible(!visible)} type="button" aria-label="Toggle visibility">
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

export default function SettingsView() {
  const { user } = useAuthStore();
  const { globalImageGen, globalDefaultModel, setGlobalSettings } = useAppStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('profile');

  // Profile
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email] = useState(user?.email || '');

  // Generation toggles
  const [imgGen, setImgGen] = useState(globalImageGen);
  const [speakerNotes, setSpeakerNotes] = useState(true);
  const [animations, setAnimations] = useState(true);
  const [autoTimesheet, setAutoTimesheet] = useState(true);
  const [defaultEngine, setDefaultEngine] = useState(globalDefaultModel || 'auto');
  const [defaultSlides, setDefaultSlides] = useState(10);

  // Taxonomy
  const [tracks, setTracks] = useState(['GenAI', 'ML / AI', 'Cloud Computing', 'Full Stack Dev', 'Cybersecurity', 'Data Analytics', 'DSA / CP']);
  const [clients, setClients] = useState(['Internal', 'NASSCOM', 'TCS', 'Wipro', 'Infosys', 'HCL', 'IBM']);
  const [modules, setModules] = useState(['Module 1', 'Module 2', 'Module 3', 'Module 4', 'Module 5']);
  const [courses, setCourses] = useState(['Bootcamp', 'Workshop', 'Certification', 'Masterclass', 'Sprint']);

  // Notifications
  const [notifGenComplete, setNotifGenComplete] = useState(true);
  const [notifErrors, setNotifErrors] = useState(true);
  const [notifUpdates, setNotifUpdates] = useState(false);
  const [notifWeeklyReport, setNotifWeeklyReport] = useState(true);

  // Global Admin Overrides
  const [globalImageGenAllowed, setGlobalImageGenAllowed] = useState(true);

  useEffect(() => {
    apiClient.get('/admin/public/settings').then(res => {
      setGlobalImageGenAllowed(res.data.image_generation_enabled);
      if (res.data.image_generation_enabled === false) {
        setImgGen(false);
      }
    }).catch(console.error);
  }, []);

  function saveGeneration() {
    setGlobalSettings({ globalImageGen: imgGen, globalDefaultModel: defaultEngine });
    showToast('Generation settings saved', 'success');
  }

  function saveProfile() {
    showToast('Profile updated', 'success');
  }

  function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  }

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-header-icon"><SettingsIcon /></div>
          <div className="page-title">System Configuration</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="settings-tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            id={`settings-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile panel */}
      {activeTab === 'profile' && (
        <div className="settings-panel active">
          <div className="settings-grid">
            {/* Identity card */}
            <div className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-title-row"><UserIcon /><span className="settings-card-title">Identity</span></div>
                <button className="ghost-btn" style={{ padding: '5px 12px', fontSize: '10px' }} onClick={saveProfile}>
                  <SaveIcon /> Save
                </button>
              </div>
              <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '1px solid var(--border-faint)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg,#0325BD,#1530c4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: '#fff', boxShadow: '0 0 20px rgba(3,37,189,0.3)', flexShrink: 0, fontFamily: 'var(--mono)' }}>
                  {getInitials(user?.full_name || 'U')}
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{user?.full_name || 'Unknown'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{user?.email}</div>
                  <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
                    <span className={`badge badge-${user?.role === 'admin' || user?.role === 'master' ? 'red' : 'blue'}`} style={{ textTransform: 'capitalize' }}>
                      <span className="badge-dot" />
                      {user?.role || 'employee'}
                    </span>
                    <span className="badge badge-green"><span className="badge-dot" />Active</span>
                  </div>
                </div>
              </div>
              <div className="settings-fields">
                <div className="settings-field">
                  <label className="settings-field-label" htmlFor="full-name">Full Name</label>
                  <input id="full-name" className="settings-input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="settings-field">
                  <label className="settings-field-label" htmlFor="email">Email Address</label>
                  <input id="email" className="settings-input" type="email" value={email} readOnly style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                </div>
                <div className="settings-field">
                  <label className="settings-field-label" htmlFor="dept">Department</label>
                  <input id="dept" className="settings-input" type="text" defaultValue="Swift Ops — Q Labs" />
                </div>
                <div className="settings-field">
                  <label className="settings-field-label" htmlFor="team-size">Team Size</label>
                  <input id="team-size" className="settings-input" type="number" defaultValue={9} min={1} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generation panel */}
      {activeTab === 'generation' && (
        <div className="settings-panel active">
          <div className="settings-grid">
            <div className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-title-row"><SparkIcon /><span className="settings-card-title">Generation Preferences</span></div>
                <button className="ghost-btn" style={{ padding: '5px 12px', fontSize: '10px' }} onClick={saveGeneration}>
                  <SaveIcon /> Save
                </button>
              </div>
              <div className="pref-list">
                <PrefToggle name="Image Generation" desc="Include AI-generated images in presentations" checked={imgGen} onChange={setImgGen} disabled={!globalImageGenAllowed} />
                <PrefToggle name="Speaker Notes" desc="Auto-generate speaker notes for each slide" checked={speakerNotes} onChange={setSpeakerNotes} />
                <PrefToggle name="Slide Animations" desc="Enable transition animations in exported PPTX" checked={animations} onChange={setAnimations} />
                <PrefToggle name="Auto-link Timesheet" desc="Automatically log generation activity to Timesheet" checked={autoTimesheet} onChange={setAutoTimesheet} />
                <div className="pref-row">
                  <div className="pref-info">
                    <div className="pref-name">Default Neural Engine</div>
                    <div className="pref-desc">Provider used when engine is set to AUTO_ROUTE</div>
                  </div>
                  <div className="pref-control">
                    <select className="pref-select" value={defaultEngine} onChange={(e) => setDefaultEngine(e.target.value)}>
                      <option value="auto">AUTO_ROUTE</option>
                      <option value="nvidia">NVIDIA_NIM</option>
                      <option value="groq">GROQ_INFER</option>
                    </select>
                  </div>
                </div>
                <div className="pref-row">
                  <div className="pref-info">
                    <div className="pref-name">Default Slide Count</div>
                    <div className="pref-desc">Default number of slides for new presentations</div>
                  </div>
                  <div className="pref-control">
                    <input
                      type="number"
                      min={3} max={30}
                      value={defaultSlides}
                      onChange={(e) => setDefaultSlides(Number(e.target.value))}
                      style={{ width: '80px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 700, padding: '7px 10px', outline: 'none', textAlign: 'center' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Taxonomy panel */}
      {activeTab === 'taxonomy' && (
        <div className="settings-panel active">
          <div className="settings-grid">
            <div className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-title-row"><TagIcon /><span className="settings-card-title">Taxonomy Manager</span></div>
              </div>
              <div className="taxonomy-manager">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <TaxonomySection label="Tracks" items={tracks} onAdd={(v) => setTracks([...tracks, v])} onRemove={(v) => setTracks(tracks.filter((t) => t !== v))} />
                  <TaxonomySection label="Clients" items={clients} onAdd={(v) => setClients([...clients, v])} onRemove={(v) => setClients(clients.filter((c) => c !== v))} />
                  <TaxonomySection label="Modules" items={modules} onAdd={(v) => setModules([...modules, v])} onRemove={(v) => setModules(modules.filter((m) => m !== v))} />
                  <TaxonomySection label="Courses" items={courses} onAdd={(v) => setCourses([...courses, v])} onRemove={(v) => setCourses(courses.filter((c) => c !== v))} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API panel */}
      {activeTab === 'api' && (
        <div className="settings-panel active">
          <div className="settings-grid">
            <div className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-title-row"><ApiIcon /><span className="settings-card-title">API Keys</span></div>
                <button className="ghost-btn" style={{ padding: '5px 12px', fontSize: '10px' }}>
                  <SaveIcon /> Save
                </button>
              </div>
              <div className="settings-fields">
                <ApiKeyField id="groq-key" label="GROQ API Key" value="gsk_••••••••••••••••••" />
                <ApiKeyField id="nvidia-key" label="NVIDIA NIM API Key" value="nvapi-••••••••••••••••••" />
                <ApiKeyField id="openai-key" label="OpenAI API Key" value="sk-••••••••••••••••••" />
              </div>
            </div>

            <div className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-title-row"><ApiIcon /><span className="settings-card-title">Connected Services</span></div>
              </div>
              <div className="pref-list">
                {[
                  { name: 'Timesheet Application', desc: 'Auto-sync generation logs', status: 'Connected', color: 'badge-green' },
                  { name: 'Pollinations AI', desc: 'Image generation provider', status: 'Connected', color: 'badge-green' },
                  { name: 'MongoDB Atlas', desc: 'Primary data store', status: 'Connected', color: 'badge-green' },
                  { name: 'Vercel Analytics', desc: 'Usage analytics', status: 'Active', color: 'badge-blue' },
                ].map((s) => (
                  <div className="pref-row" key={s.name}>
                    <div className="pref-info">
                      <div className="pref-name">{s.name}</div>
                      <div className="pref-desc">{s.desc}</div>
                    </div>
                    <div className="pref-control">
                      <span className={`badge ${s.color}`}><span className="badge-dot" />{s.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications panel */}
      {activeTab === 'notifications' && (
        <div className="settings-panel active">
          <div className="settings-grid">
            <div className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-title-row"><BellIcon /><span className="settings-card-title">Notification Preferences</span></div>
                <button className="ghost-btn" style={{ padding: '5px 12px', fontSize: '10px' }} onClick={() => showToast('Notification preferences saved', 'success')}>
                  <SaveIcon /> Save
                </button>
              </div>
              <div className="pref-list">
                <PrefToggle name="Generation Complete" desc="Notify when a presentation has been generated" checked={notifGenComplete} onChange={setNotifGenComplete} />
                <PrefToggle name="Error Alerts" desc="Receive alerts for generation failures or system errors" checked={notifErrors} onChange={setNotifErrors} />
                <PrefToggle name="System Updates" desc="Get notified about platform updates and new features" checked={notifUpdates} onChange={setNotifUpdates} />
                <PrefToggle name="Weekly Report" desc="Receive a weekly summary of your generation activity" checked={notifWeeklyReport} onChange={setNotifWeeklyReport} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
