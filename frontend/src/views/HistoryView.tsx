import { useEffect, useState, useMemo } from 'react';
import apiClient from '../api/apiClient';
import Badge from '../components/ui/Badge';
import SearchableDropdown from '../components/ui/SearchableDropdown';
import { useToast } from '../components/ui/ToastContainer';
import { useDownload } from '../hooks/useDownload';
import { RefreshCw, Download, Trash2, Archive, Search, FileDown } from 'lucide-react';

/* Types */
interface Presentation {
  id: string;
  title: string;
  type: string;
  theme?: string;
  num_slides?: number;
  created_at: string;
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
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [confirmConfig, setConfirmConfig] = useState<{
    show: boolean;
    id: string | null;
  }>({ show: false, id: null });

  const fetchHistory = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const r = await apiClient.get('/presentations/me?limit=500');
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
  };

  useEffect(() => {
    fetchHistory();

    const onFocus = () => fetchHistory(false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

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

  /* Download */


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
      ['#', 'Title', 'Type', 'Track', 'Theme', 'Status', 'Generated At'],
      ...filtered.map((p, i) => [String(i + 1), p.title, p.type, p.track || '', p.theme || '', 'Completed', p.created_at]),
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
              <th>Track</th>
              <th>Theme</th>
              <th>Status</th>
              <th>Generated At</th>
              <th style={{ width: '90px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading records…</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '12px' }}>
                {search || typeFilter !== 'all' || fromDate || toDate ? 'No records match the current filters.' : 'No records yet.'}
              </td></tr>
            ) : paginated.map((p, idx) => (
              <tr key={p.id}>
                <td className="tbl-entry-id">{String((page - 1) * PAGE_SIZE + idx + 1).padStart(3, '0')}</td>
                <td style={{ fontWeight: 600, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</td>
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
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {p.type !== 'notes' && (
                      <button className="action-btn action-btn-dl" onClick={() => downloadPpt(p.id, `${p.title}.pptx`)} title="Download">
                        <Download size={14} /> DL
                      </button>
                    )}
                    <button className="action-btn action-btn-del" onClick={() => handleDelete(p.id)} title="Delete">
                      <Trash2 size={14} /> DEL
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer">
          <span className="records-label">
            SHOWING {paginated.length} OF {filtered.length} RECORDS
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
