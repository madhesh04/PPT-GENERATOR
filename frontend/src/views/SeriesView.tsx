import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import apiClient from '../api/apiClient';
import { useToast } from '../components/ui/ToastContainer';
import { useAuthStore } from '../store/useAuthStore';
import { Layers, Plus, Trash2, ListOrdered, X, ChevronRight } from 'lucide-react';
import { presentationApi, type Presentation } from '../api/presentation';

interface SeriesModule {
  ppt_id: string;
  ppt_title: string;
  order: number;
}

interface Series {
  id: string;
  title: string;
  description: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  module_count: number;
  track?: string;
  client?: string;
}

interface SeriesDetail extends Series {
  modules: SeriesModule[];
}

export default function SeriesView() {
  const { showToast } = useToast();
  const { user } = useAuthStore();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'MASTER';

  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<SeriesDetail | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTrack, setNewTrack] = useState('');
  const [newClient, setNewClient] = useState('');
  const [creating, setCreating] = useState(false);

  // Add module
  const [addPptId, setAddPptId] = useState('');
  const [addingModule, setAddingModule] = useState(false);
  const [myPresentations, setMyPresentations] = useState<Presentation[]>([]);

  useEffect(() => {
    presentationApi.getMyPresentations({ limit: 100 })
      .then(setMyPresentations)
      .catch(console.error);
  }, []);

  const fetchSeries = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.get('/series?limit=50');
      setSeries(r.data.series || []);
    } catch {
      showToast('Failed to load banks', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSeries(); }, [fetchSeries]);

  const fetchDetail = async (id: string) => {
    try {
      const r = await apiClient.get(`/series/${id}`);
      setSelectedSeries(r.data);
    } catch {
      showToast('Failed to load bank detail', 'error');
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) { showToast('Title required', 'error'); return; }
    setCreating(true);
    try {
      await apiClient.post('/series', { title: newTitle, description: newDesc, track: newTrack || undefined, client: newClient || undefined });
      showToast('Bank created', 'success');
      setNewTitle(''); setNewDesc(''); setNewTrack(''); setNewClient('');
      setShowCreate(false);
      fetchSeries();
    } catch {
      showToast('Failed to create bank', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSeries = async (id: string) => {
    if (!window.confirm('Delete this bank?')) return;
    try {
      await apiClient.delete(`/series/${id}`);
      setSeries(prev => prev.filter(s => s.id !== id));
      if (selectedSeries?.id === id) setSelectedSeries(null);
      showToast('Bank deleted', 'success');
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const handleAddModule = async () => {
    if (!selectedSeries || !addPptId.trim()) return;
    setAddingModule(true);
    try {
      const r = await apiClient.post(`/series/${selectedSeries.id}/modules`, { ppt_id: addPptId.trim() });
      setSelectedSeries(prev => prev ? {
        ...prev,
        modules: [...(prev.modules || []), r.data.module],
        module_count: (prev.module_count || 0) + 1
      } : null);
      setAddPptId('');
      showToast('Module added', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.detail || 'Failed to add module', 'error');
    } finally {
      setAddingModule(false);
    }
  };

  const handleRemoveModule = async (pptId: string) => {
    if (!selectedSeries) return;
    try {
      await apiClient.delete(`/series/${selectedSeries.id}/modules/${pptId}`);
      setSelectedSeries(prev => prev ? {
        ...prev,
        modules: prev.modules.filter(m => m.ppt_id !== pptId),
        module_count: Math.max(0, (prev.module_count || 0) - 1)
      } : null);
      showToast('Module removed', 'success');
    } catch {
      showToast('Remove failed', 'error');
    }
  };

  const canModify = (s: Series) => isAdmin || s.created_by === user?.email;

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-header-icon"><Layers size={20} /></div>
          <div className="page-title">Content Bank</div>
        </div>
        <button className="primary-btn" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Bank
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && createPortal(
        <div className="progress-overlay show">
          <div className="progress-modal" style={{ maxWidth: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="progress-title" style={{ fontSize: '14px' }}>New Content Bank</h2>
              <button className="ghost-btn" style={{ padding: '4px' }} onClick={() => setShowCreate(false)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="field-group">
                <label className="field-label">BANK TITLE *</label>
                <input id="series-title" className="text-input" placeholder="e.g. Python Fundamentals" value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus />
              </div>
              <div className="field-group">
                <label className="field-label">DESCRIPTION</label>
                <textarea className="text-input" style={{ height: '70px', resize: 'vertical' }} placeholder="Short description…" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="field-group">
                  <label className="field-label">TRACK</label>
                  <input className="text-input" placeholder="e.g. Data Science" value={newTrack} onChange={e => setNewTrack(e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="field-label">CLIENT</label>
                  <input className="text-input" placeholder="e.g. Acme Corp" value={newClient} onChange={e => setNewClient(e.target.value)} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="primary-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create Bank'}
              </button>
              <button className="ghost-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '16px' }}>
        {/* Series list */}
        <div className="table-wrap" style={{ height: 'fit-content' }}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Loading banks…</div>
          ) : series.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              <Layers size={28} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <div>No banks yet. Create your first one!</div>
            </div>
          ) : series.map(s => (
            <div
              key={s.id}
              onClick={() => fetchDetail(s.id)}
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: selectedSeries?.id === s.id ? 'rgba(3,37,189,0.06)' : 'transparent',
                borderLeft: selectedSeries?.id === s.id ? '3px solid var(--accent-text)' : '3px solid transparent',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', fontFamily: 'var(--mono)' }}>
                  {s.module_count} module{s.module_count !== 1 ? 's' : ''} · {s.created_by_name}
                  {s.track && <span style={{ color: 'var(--accent-text)', marginLeft: '6px' }}>· {s.track}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {canModify(s) && (
                  <button
                    className="action-btn action-btn-del"
                    onClick={e => { e.stopPropagation(); handleDeleteSeries(s.id); }}
                    title="Delete bank"
                    style={{ fontSize: '10px' }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <ChevronRight size={14} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Series detail panel */}
        <div className="table-wrap">
          {!selectedSeries ? (
            <>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.03em' }}>Global Content</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>All available generated presentations</div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Title</th>
                    <th>Track</th>
                    <th>Theme</th>
                    <th>Generated At</th>
                  </tr>
                </thead>
                <tbody>
                  {myPresentations.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '12px' }}>No global content found.</td></tr>
                  ) : (
                    myPresentations.map((p, idx) => (
                      <tr key={p.id}>
                        <td className="tbl-entry-id">{String(idx + 1).padStart(3, '0')}</td>
                        <td style={{ fontWeight: 600 }}>{p.title}</td>
                        <td className="mono-cell">{p.track || '—'}</td>
                        <td className="mono-cell">{p.theme || '—'}</td>
                        <td className="mono-cell">{new Date(p.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </>
          ) : (
            <>
              {/* Detail header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.03em' }}>{selectedSeries.title}</div>
                {selectedSeries.description && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>{selectedSeries.description}</div>
                )}
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  {selectedSeries.track && <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--accent-text)' }}>TRACK: {selectedSeries.track}</span>}
                  {selectedSeries.client && <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-muted)' }}>CLIENT: {selectedSeries.client}</span>}
                </div>
              </div>

              {/* Add module */}
              {canModify(selectedSeries) && (
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <select
                    className="select-input"
                    style={{ flex: 1, fontSize: '11px', padding: '6px 10px' }}
                    value={addPptId}
                    onChange={e => setAddPptId(e.target.value)}
                  >
                    <option value="">Select a presentation to add...</option>
                    {myPresentations.map(p => {
                      if (selectedSeries.modules?.some(m => m.ppt_id === p.id)) return null;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.title} {p.track ? `[${p.track}]` : ''} — {new Date(p.created_at).toLocaleDateString()}
                        </option>
                      );
                    })}
                  </select>
                  <button className="primary-btn" style={{ fontSize: '11px', padding: '6px 14px' }} onClick={handleAddModule} disabled={addingModule || !addPptId.trim()}>
                    <Plus size={14} /> Add
                  </button>
                </div>
              )}

              {/* Modules list */}
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Order</th>
                    <th>Presentation</th>
                    <th>PPT ID</th>
                    {canModify(selectedSeries) && <th style={{ width: '80px' }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {(!selectedSeries.modules || selectedSeries.modules.length === 0) ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '12px' }}>No modules added yet.</td></tr>
                  ) : (selectedSeries.modules.sort((a, b) => a.order - b.order).map((mod) => (
                    <tr key={mod.ppt_id}>
                      <td className="mono-cell" style={{ textAlign: 'center', fontWeight: 800 }}>{String(mod.order).padStart(2, '0')}</td>
                      <td style={{ fontWeight: 600 }}>{mod.ppt_title}</td>
                      <td className="mono-cell" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{mod.ppt_id}</td>
                      {canModify(selectedSeries) && (
                        <td>
                          <button
                            className="action-btn action-btn-del"
                            onClick={() => handleRemoveModule(mod.ppt_id)}
                            title="Remove module"
                          >
                            <X size={12} /> Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  )))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
