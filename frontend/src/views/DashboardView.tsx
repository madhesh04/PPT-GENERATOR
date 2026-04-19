import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Plus, Download, ChevronRight, FileText, Calendar, Users, Layout } from 'lucide-react';
import apiClient from '../api/apiClient';
import Badge from '../components/ui/Badge';
import { useDownload } from '../hooks/useDownload';
import SearchableDropdown from '../components/ui/SearchableDropdown';

/* ─── Types ─── */
interface Presentation {
  id: string;
  title: string;
  type: 'ppt' | 'notes';
  theme?: string;
  num_slides?: number;
  created_at: string;
  model_used?: string;
  track?: string;
  member?: string;
  status?: string;
  download_token?: string;
}



/* ─── Helpers ─── */
function formatTs(ts: string): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── Constants ─── */
const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'ppt', label: 'Presentation' },
  { value: 'notes', label: 'Lecture Notes' },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TRACKS = ['GenAI', 'ML / AI', 'Cloud Computing', 'Full Stack Dev', 'Cybersecurity', 'Data Analytics', 'DSA / CP'];

/* ─── Weekly Bar Chart ─── */
function WeeklyBarChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const todayIdx = (new Date().getDay() + 6) % 7; // 0=Mon
  return (
    <div className="bar-chart">
      {DAYS.map((d, i) => (
        <div className="bar-col" key={d}>
          <div
            className={`bar-fill${i === todayIdx ? ' active' : ''}`}
            style={{ height: `${Math.max(3, (data[i] / max) * 72)}px` }}
          />
          <span className="bar-label">{d}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Donut Chart ─── */
function DonutChart({ ppts, notes }: { ppts: number; notes: number }) {
  const total = ppts + notes;
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const pptFrac = total > 0 ? (ppts / total) * circumference : 0;
  const notesFrac = total > 0 ? (notes / total) * circumference : 0;
  const notesOffset = circumference - pptFrac + 10;

  return (
    <div className="donut-wrap">
      <svg className="donut-svg" width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(37,40,54,0.8)" strokeWidth="8" />
        <circle
          cx="45" cy="45" r={r} fill="none"
          stroke="var(--accent-text)" strokeWidth="8"
          strokeDasharray={`${pptFrac.toFixed(1)} ${circumference.toFixed(1)}`}
          strokeDashoffset="0" strokeLinecap="round"
          transform="rotate(-90 45 45)"
        />
        <circle
          cx="45" cy="45" r={r} fill="none"
          stroke="var(--purple)" strokeWidth="8"
          strokeDasharray={`${notesFrac.toFixed(1)} ${circumference.toFixed(1)}`}
          strokeDashoffset={`${-notesOffset.toFixed(1)}`}
          strokeLinecap="round" transform="rotate(-90 45 45)"
        />
        <text x="45" y="49" textAnchor="middle" fill="var(--text-primary)" fontSize="16" fontWeight="800" fontFamily="var(--mono)">{total}</text>
      </svg>
      <div className="donut-legend">
        <div className="donut-item">
          <div className="donut-dot" style={{ background: 'var(--accent-text)' }} />
          <span className="donut-item-label">PPT</span>
          <span className="donut-item-val">{ppts}</span>
        </div>
        <div className="donut-item">
          <div className="donut-dot" style={{ background: 'var(--purple)' }} />
          <span className="donut-item-label">Notes</span>
          <span className="donut-item-val">{notes}</span>
        </div>
        <div className="donut-item">
          <div className="donut-dot" style={{ background: 'rgba(74,80,104,.5)' }} />
          <span className="donut-item-label">Total</span>
          <span className="donut-item-val">{total}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Track Chart ─── */
function TrackChart({ presentations }: { presentations: Presentation[] }) {
  const counts = TRACKS.map((t) => presentations.filter((p) => p.track === t).length);
  const max = Math.max(...counts, 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      {TRACKS.map((t, i) => (
        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', width: '110px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{t}</span>
          <div style={{ flex: 1, height: '6px', background: 'rgba(37,40,54,0.6)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(4, (counts[i] / max) * 100)}%`, background: 'linear-gradient(90deg,#0325BD,#22d3a5)', borderRadius: '3px', transition: 'width .5s ease' }} />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--accent-text)', width: '18px', textAlign: 'right', flexShrink: 0 }}>{counts[i]}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main ─── */
export default function DashboardView() {
  const navigate = useNavigate();
  const { handleDownload: downloadPpt } = useDownload();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeChip, setActiveChip] = useState<string | null>(null);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const r = await apiClient.get('/presentations/me?limit=100');
      const list = r.data?.presentations ?? [];
      const standardized = list.map((p: any) => ({
        ...p,
        type: p.type || 'ppt',
      }));
      setPresentations(standardized);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* Quick date chips */
  function setChip(days: number | null, label: string) {
    if (days === null) { setFromDate(''); setToDate(''); setActiveChip(null); return; }
    const to = new Date(); to.setHours(23, 59, 59, 999);
    const from = new Date(to.getTime() - days * 86400000);
    setFromDate(from.toISOString().split('T')[0]);
    setToDate(to.toISOString().split('T')[0]);
    setActiveChip(label);
  }

  /* Filtered data */
  const filtered = useMemo(() => {
    let data = [...presentations];
    if (fromDate) data = data.filter((p) => new Date(p.created_at) >= new Date(fromDate));
    if (toDate) data = data.filter((p) => new Date(p.created_at) <= new Date(toDate + 'T23:59:59'));
    if (typeFilter !== 'all') data = data.filter((p) => p.type === typeFilter);
    return data;
  }, [presentations, fromDate, toDate, typeFilter]);

  /* KPIs */
  const total = filtered.length;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekCount = filtered.filter((p) => new Date(p.created_at) >= weekAgo).length;
  const notesCount = filtered.filter((p) => p.type === 'notes').length;
  const pptsCount = filtered.filter((p) => p.type === 'ppt').length;

  /* Weekly bar data */
  const chartData = useMemo(() => {
    const todayIdx = (new Date().getDay() + 6) % 7;
    return DAYS.map((_, i) => {
      const d = new Date(now.getTime() - (todayIdx - i) * 86400000);
      return filtered.filter((p) => new Date(p.created_at).toDateString() === d.toDateString()).length;
    });
  }, [filtered]);



  const recent = filtered.slice(0, 6);

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-header-icon">
            <Layout size={20} />
          </div>
          <div>
            <div className="page-title">Operations Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="ghost-btn" 
            onClick={() => fetchData(true)} 
            disabled={loading}
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button className="ghost-btn" onClick={() => navigate('/create')}>
            <Plus size={16} />
            New Presentation
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="dash-filters">
        <div className="dr-block">
          <div className="dr-row">
            {/* Date from/to */}
            <div className="dr-pill">
              <span className="dr-pill-label">FROM</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setActiveChip(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 700, outline: 'none', cursor: 'pointer', colorScheme: 'dark' }}
              />
            </div>
            <span className="dr-sep">→</span>
            <div className="dr-pill">
              <span className="dr-pill-label">TO</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setActiveChip(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 700, outline: 'none', cursor: 'pointer', colorScheme: 'dark' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              {[['TW', 7], ['14d', 14], ['30d', 30], ['90d', 90]].map(([label, days]) => (
                <button
                  key={label as string}
                  className={`dr-chip${activeChip === label ? ' active' : ''}`}
                  onClick={() => activeChip === label ? setChip(null, '') : setChip(days as number, label as string)}
                >
                  {label}
                </button>
              ))}
              <button className="dr-reset" onClick={() => setChip(null, '')} title="Reset filters">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
              </button>
            </div>
          </div>
        </div>
        {/* Type filter */}
        <SearchableDropdown
          id="dash-type-filter"
          label="TYPE"
          value={typeFilter}
          options={TYPE_OPTIONS}
          onChange={setTypeFilter}
          searchable={false}
        />
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {([
          { icon: <Layout size={18} />, iconClass: 'blue', label: 'Total Generated', value: total, delta: null },
          { icon: <Calendar size={18} />, iconClass: 'green', label: 'This Week', value: weekCount, delta: null },
          { icon: <FileText size={18} />, iconClass: 'purple', label: 'Lecture Notes', value: notesCount, delta: null },
          { icon: <Users size={18} />, iconClass: 'yellow', label: 'Presentations', value: pptsCount, delta: null },
        ] as const).map(({ icon, iconClass, label, value }) => (
          <div className="kpi-card" key={label}>
            <div className="kpi-top">
              <div className={`kpi-icon ${iconClass}`}>{icon}</div>
            </div>
            <div className="kpi-label">{label}</div>
            <div className="kpi-value num">{value}</div>
          </div>
        ))}
      </div>

      {/* Charts + Table row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 240px', gap: '14px', marginBottom: '14px' }}>
        {/* Weekly bar chart */}
        <div className="chart-card">
          <div className="chart-header">
            <span className="chart-title">Weekly Output</span>
          </div>
          <div className="chart-body">
            <WeeklyBarChart data={chartData} />
          </div>
        </div>
        {/* Donut */}
        <div className="chart-card">
          <div className="chart-header">
            <span className="chart-title">Output by Type</span>
          </div>
          <div className="chart-body" style={{ paddingTop: '6px' }}>
            <DonutChart ppts={pptsCount} notes={notesCount} />
          </div>
        </div>
        {/* Top tracks */}
        <div className="chart-card">
          <div className="chart-header">
            <span className="chart-title">Top Tracks</span>
          </div>
          <div className="chart-body">
            <TrackChart presentations={filtered} />
          </div>
        </div>
      </div>

      {/* Recent table */}
      <div className="table-wrap">
        <div className="table-header-bar">
          <span className="table-title">Recent Generations</span>
          <button className="view-all" onClick={() => navigate('/history')}>
            View All <ChevronRight size={14} />
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Track</th>
              <th>Theme</th>
              <th>Status</th>
              <th>Generated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  {loading ? 'Loading generations…' : 'No records yet. Generate your first presentation!'}
                </td>
              </tr>
            ) : recent.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</td>
                <td>
                  <Badge variant={p.type === 'ppt' ? 'blue' : 'purple'} dot>
                    {p.type === 'ppt' ? 'PPT' : 'Notes'}
                  </Badge>
                </td>
                <td className="mono-cell">{p.track || '—'}</td>
                <td className="mono-cell">{p.theme || '—'}</td>
                <td><Badge variant="green" dot>Completed</Badge></td>
                <td className="mono-cell">{formatTs(p.created_at)}</td>
                <td>
                  {p.type !== 'notes' ? (
                    <button
                      className="action-btn action-btn-dl"
                      onClick={() => downloadPpt(p.id, `${p.title}.pptx`)}
                    >
                      <Download size={14} /> DL
                    </button>
                  ) : (
                    <button
                      className="action-btn action-btn-dl"
                      onClick={() => navigate('/history')}
                      title="View Notes in History"
                    >
                      <FileText size={14} /> View
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer">
          <span className="records-label">SHOWING {recent.length} OF {filtered.length} RECORDS</span>
          <button className="ghost-btn" style={{ padding: '5px 12px', fontSize: '10px' }} onClick={() => navigate('/history')}>
            View all in History
          </button>
        </div>
      </div>
    </div>
  );
}
