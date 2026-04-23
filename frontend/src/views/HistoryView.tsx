import { useEffect, useState, useMemo, useCallback } from 'react';
import apiClient from '../api/apiClient';
import { presentationApi } from '../api/presentation';
import Badge from '../components/ui/Badge';
import SearchableDropdown from '../components/ui/SearchableDropdown';
import { useToast } from '../components/ui/ToastContainer';
import { useDownload } from '../hooks/useDownload';
import { useAuthStore } from '../store/useAuthStore';
import { RefreshCw, Download, Trash2, Archive, Search, FileDown, Edit2, Check, X } from 'lucide-react';

/* Types */
interface Presentation {
  id: string;
  title: string;
  type: string;
  theme?: string;
  num_slides?: number;
  created_at: string;
  updated_at?: string;
  last_edited_by?: string | null;
  generated_by?: string;
  user_id?: string;
  model_used?: string;
  track?: string;
  status?: string;
  download_token?: string;
}

/* Helpers */
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

/* Constants */
const PAGE_SIZE = 10;
const TYPE_OPTS = [
  { value: 'all', label: 'All Types' },
  { value: 'ppt', label: 'Presentation' },
  { value: 'notes', label: 'Lecture Notes' },
];

export default function HistoryView() {
  const { handleDownload: downloadPpt } = useDownload();
  const { showToast } = useToast();
  const { user } = useAuthStore();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTrack, setEditTrack] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [confirmConfig, setConfirmConfig] = useState<{
    show: boolean;
    id: string | null;
  }>({ show: false, id: null });

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'MASTER';

  const fetchHistory = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const endpoint = scope === 'mine' ? '/presentations/me?limit=500' : '/presentations/all?limit=500';
      const r = await apiClient.get(endpoint);
      const list = r.data?.presentations ?? [];
      const standardized = list.map((p: any) => ({
        ...p,
        type: p.type || 'ppt',
      }));
      setPresentations(standardized);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    fetchHistory();
    setPage(1);
  }, [fetchHistory]);

  useEffect(() => {
    const onFocus = () => fetchHistory(false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchHistory]);

  /* Filtered + paginated */
  const filtered = useMemo(() => {
    let data = [...presentations];
    if (search) data = data.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));
    if (typeFilter !== 'all') data = data.filter((p) => p.type === typeFilter);
    if (fromDate) data = data.filter((p) => new Date(p.created_at) >= new Date(fromDate));
    if (toDate) data = data.filter((p) => new Date(p.created_at) <= new Date(toDate + 'T23:59:59'));
    return data;
  }, [presentations, search, typeFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* KPIs */
  const totalRec = presentations.length;
  const pptsCount = presentations.filter((p) => p.type === 'ppt').length;
  const notesCount = presentations.filter((p) => p.type === 'notes').length;

  /* Ownership check */
  const canEdit = (p: Presentation) => {
    if (isAdmin) return true;
    return p.user_id === user?.email || scope === 'mine';
  };

  /* Inline edit */
  const startEdit = (p: Presentation) => {
    setEditId(p.id);
    setEditTitle(p.title);
    setEditTrack(p.track || '');
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditTitle('');
    setEditTrack('');
  };

  const saveEdit = async (id: string) => {
    setEditSaving(true);
    try {
      await presentationApi.updatePresentation(id, {
        title: editTitle || undefined,
        track: editTrack || undefined,
      });
      setPresentations(prev => prev.map(p =>
        p.id === id
          ? { ...p, title: editTitle || p.title, track: editTrack, updated_at: new Date().toISOString(), last_edited_by: user?.username || '' }
          : p
      ));
      showToast('Record updated', 'success');
      cancelEdit();
    } catch {
      showToast('Update failed', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  /* Delete */
  async function handleDelete(id: string) {
    setConfirmConfig({ show: true, id });
  }

  async function executeDelete() {
    if (!confirmConfig.id) return;
    try {
      await apiClient.delete(`/presentations/${confirmConfig.id}`);
      setPresentations((prev) => prev.filter((p) => p.id !== confirmConfig.id));
      showToast('Record deleted', 'success');
    } catch {
      showToast('Delete failed', 'error');
    } finally {
      setConfirmConfig({ show: false, id: null });
    }
  }

  /* Export CSV */
  function exportCsv() {
    const rows = [
      ['#', 'Title', 'Type', 'Track', 'Theme', 'Creator', 'Status', 'Generated At', 'Updated At'],
      ...filtered.map((p, i) => [
        String(i + 1), p.title, p.type, p.track || '', p.theme || '',
        p.generated_by || '', 'Completed', p.created_at,
        p.updated_at && p.updated_at !== p.created_at ? p.updated_at : ''
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'skynet_history.csv'; a.click();
    showToast('CSV exported', 'success');
  }

  function resetFilters() {
    setSearch(''); setTypeFilter('all'); setFromDate(''); setToDate(''); setPage(1);
  }

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-header-icon"><Archive size={20} /></div>
          <div className="page-title">Generation Archive</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="ghost-btn"
            onClick={() => fetchHistory(true)}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button className="ghost-btn" onClick={exportCsv}>
            <FileDown size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="hist-kpi-row">
        {[
          { label: 'Total Records', value: totalRec, sub: 'all time', num: true },
          { label: 'Presentations', value: pptsCount, sub: 'PPTX files', num: true },
          { label: 'Lecture Notes', value: notesCount, sub: 'text docs', num: true },
          { label: 'Storage Used', value: `${(totalRec * 2.3).toFixed(1)} MB`, sub: 'estimated', num: false },
        ].map(({ label, value, sub, num }) => (
          <div className="hist-kpi" key={label}>
            <div className="hist-kpi-label">{label}</div>
            <div className={`hist-kpi-val${num ? ' num' : ''}`}>{value}</div>
            <div className="hist-kpi-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="history-filters">
        {/* Scope Toggle */}
        <div style={{ display: 'flex', gap: '4px', marginRight: '4px' }}>
          <button
            className={`ghost-btn${scope === 'mine' ? ' active' : ''}`}
            style={scope === 'mine' ? { background: 'rgba(3,37,189,0.1)', borderColor: 'rgba(3,37,189,0.3)', color: 'var(--accent-text)' } : {}}
            onClick={() => { setScope('mine'); setPage(1); }}
          >
            My Content
          </button>
          <button
            className={`ghost-btn${scope === 'all' ? ' active' : ''}`}
            style={scope === 'all' ? { background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.3)', color: 'var(--purple)' } : {}}
            onClick={() => { setScope('all'); setPage(1); }}
          >
            All Content
          </button>
        </div>

        {/* Search */}
        <div className="search-wrap">
          <Search size={16} />
          <input
            className="search-input"
            type="text"
            id="history-search"
            placeholder="Search by title…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Type filter */}
        <SearchableDropdown
          id="hist-type"
          label="TYPE"
          value={typeFilter}
          options={TYPE_OPTS}
          onChange={(v) => { setTypeFilter(v); setPage(1); }}
          searchable={false}
          style={{ minWidth: '160px' }}
        />

        {/* Date from */}
        <div className="dr-pill" style={{ minWidth: '130px' }}>
          <span className="dr-pill-label">FROM</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, outline: 'none', cursor: 'pointer', colorScheme: 'dark' }}
          />
        </div>
        <span className="dr-sep">→</span>
        <div className="dr-pill" style={{ minWidth: '130px' }}>
          <span className="dr-pill-label">TO</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, outline: 'none', cursor: 'pointer', colorScheme: 'dark' }}
          />
        </div>

        {/* Reset */}
        <button className="dr-reset" onClick={resetFilters} title="Clear filters">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
        </button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Title</th>
              <th>Type</th>
              {scope === 'all' && <th>Creator</th>}
              <th>Track</th>
              <th>Theme</th>
              <th>Status</th>
              <th>Generated At</th>
              <th style={{ width: '110px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={scope === 'all' ? 9 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading records…</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={scope === 'all' ? 9 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '12px' }}>
                {search || typeFilter !== 'all' || fromDate || toDate ? 'No records match the current filters.' : 'No records yet.'}
              </td></tr>
            ) : paginated.map((p, idx) => (
              <tr key={p.id}>
                <td className="tbl-entry-id">{String((page - 1) * PAGE_SIZE + idx + 1).padStart(3, '0')}</td>
                <td style={{ maxWidth: '220px' }}>
                  {editId === p.id ? (
                    <input
                      className="text-input"
                      style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }}
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </div>
                  )}
                </td>
                <td>
                  <Badge variant={p.type === 'ppt' ? 'blue' : 'purple'} dot>
                    {p.type === 'ppt' ? 'PPT' : 'Notes'}
                  </Badge>
                </td>
                {scope === 'all' && (
                  <td className="mono-cell" style={{ fontSize: '11px', color: 'var(--yellow)' }}>
                    {p.generated_by || '—'}
                  </td>
                )}
                <td className="mono-cell">
                  {editId === p.id ? (
                    <input
                      className="text-input"
                      style={{ fontSize: '11px', padding: '4px 8px', width: '90px' }}
                      value={editTrack}
                      onChange={e => setEditTrack(e.target.value)}
                      placeholder="Track…"
                    />
                  ) : (
                    p.track || '—'
                  )}
                </td>
                <td className="mono-cell">{p.theme || '—'}</td>
                <td><Badge variant="green" dot>Completed</Badge></td>
                <td className="mono-cell">
                  {formatTs(p.updated_at && p.updated_at !== p.created_at ? p.updated_at : p.created_at)}
                  {p.last_edited_by && (
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '4px' }}>(edited)</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {editId === p.id ? (
                      <>
                        <button
                          className="action-btn"
                          style={{ color: 'var(--green)', borderColor: 'rgba(34,211,165,0.3)' }}
                          onClick={() => saveEdit(p.id)}
                          disabled={editSaving}
                          title="Save"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          className="action-btn"
                          onClick={cancelEdit}
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        {p.type !== 'notes' && (
                          <button className="action-btn action-btn-dl" onClick={() => downloadPpt(p.id, `${p.title}.pptx`)} title="Download">
                            <Download size={14} /> DL
                          </button>
                        )}
                        {canEdit(p) && (
                          <>
                            <button className="action-btn" onClick={() => startEdit(p)} title="Edit" style={{ color: 'var(--text-secondary)' }}>
                              <Edit2 size={14} />
                            </button>
                            <button className="action-btn action-btn-del" onClick={() => handleDelete(p.id)} title="Delete">
                              <Trash2 size={14} /> DEL
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer">
          <span className="records-label">
            SHOWING {paginated.length} OF {filtered.length} RECORDS
            {scope === 'all' && <span style={{ color: 'var(--purple)', marginLeft: '8px' }}>· ALL USERS</span>}
          </span>
          <div className="pagination">
            <button className="page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                className={`page-btn${pg === page ? ' current' : ''}`}
                onClick={() => setPage(pg)}
              >
                {pg}
              </button>
            ))}
            {totalPages > 5 && page < totalPages && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>…</span>}
            <button className="page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmConfig.show && (
        <div className="progress-overlay show">
          <div className="progress-modal" style={{ maxWidth: '400px', padding: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'rgba(239,68,68,0.1)', color: 'var(--red)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(239,68,68,0.2)'
              }}>
                <span className="material-symbols-outlined">report</span>
              </div>
              <div>
                <h2 className="progress-title" style={{ fontSize: '14px' }}>Purge Record</h2>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>This will permanently delete the presentation. Confirm?</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="primary-btn"
                style={{ flex: 1, justifyContent: 'center', background: 'var(--red)' }}
                onClick={executeDelete}
              >
                Confirm Delete
              </button>
              <button
                className="ghost-btn"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setConfirmConfig({ show: false, id: null })}
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