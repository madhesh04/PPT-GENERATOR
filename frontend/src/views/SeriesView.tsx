import { useEffect, useState, useMemo } from 'react';
import { presentationApi, type Presentation } from '../api/presentation';
import { useDownload } from '../hooks/useDownload';
import { Layers, Download, Calendar, Search, Filter, RefreshCw, ChevronDown } from 'lucide-react';
import Badge from '../components/ui/Badge';

const TRACKS = ['GenAI', 'ML / AI', 'Cloud Computing', 'Full Stack Dev', 'Cybersecurity', 'Data Analytics', 'DSA / CP'];

export default function SeriesView() {
  const { handleDownload: downloadPpt } = useDownload();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('All');
  const [dateFilter, setDateFilter] = useState('All Time');

  const fetchGlobalContent = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await presentationApi.getAllPresentations({ limit: 200 });
      const data = res.data.presentations || [];
      setPresentations(data.filter((p: Presentation) => p.type !== 'notes'));
    } catch (err) {
      console.error('Failed to fetch global content:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGlobalContent();
    const interval = setInterval(() => fetchGlobalContent(true), 45000);
    return () => clearInterval(interval);
  }, []);

  const filteredList = useMemo(() => {
    return presentations.filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
      const matchesTrack = selectedTrack === 'All' || p.track === selectedTrack;
      
      let matchesDate = true;
      if (dateFilter !== 'All Time') {
        const now = new Date();
        const created = new Date(p.created_at);
        const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 3600 * 24));
        
        if (dateFilter === 'Today') matchesDate = diffDays === 0;
        else if (dateFilter === 'Last 7 Days') matchesDate = diffDays <= 7;
        else if (dateFilter === 'Last 30 Days') matchesDate = diffDays <= 30;
      }

      return matchesSearch && matchesTrack && matchesDate;
    });
  }, [presentations, search, selectedTrack, dateFilter]);

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '28px' }}>
        <div className="page-header-left">
          <div className="page-header-icon"><Layers size={20} /></div>
          <div className="page-title">Content Bank</div>
          <div style={{ marginLeft: '12px', fontSize: '11px', background: 'rgba(3,37,189,0.12)', padding: '4px 10px', borderRadius: '20px', color: 'var(--accent-text)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Live Feed
          </div>
        </div>
        <div className="page-header-right">
          <button 
            className="ghost-btn" 
            style={{ fontSize: '12px', gap: '8px', padding: '8px 16px', borderRadius: '99px' }} 
            onClick={() => fetchGlobalContent(true)}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'spin-anim' : ''} />
            {refreshing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        marginBottom: '32px', 
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '10px 0'
      }}>
        {/* Search */}
        <div style={{ 
          position: 'relative', 
          flex: 1, 
          minWidth: '280px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: '99px',
          height: '46px',
          display: 'flex',
          alignItems: 'center',
          transition: 'border-color 0.2s'
        }} className="filter-input-wrap">
          <Search size={16} style={{ position: 'absolute', left: '18px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search presentations by title..." 
            style={{ 
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: '0 20px 0 46px',
              width: '100%',
              height: '100%',
              fontSize: '13px',
              fontFamily: 'var(--font)',
              color: 'var(--text-primary)',
              fontWeight: 500
            }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Track Select */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div style={{ 
            position: 'absolute', 
            left: '18px', 
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none'
          }}>
            <Filter size={15} style={{ color: 'var(--text-muted)' }} />
          </div>
          <select 
            style={{ 
              appearance: 'none',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '99px',
              height: '46px',
              padding: '0 40px 0 44px',
              fontSize: '13px',
              fontFamily: 'var(--font)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: '160px',
              outline: 'none'
            }}
            value={selectedTrack}
            onChange={(e) => setSelectedTrack(e.target.value)}
          >
            <option value="All">All Tracks</option>
            {TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '18px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>

        {/* Date Select */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div style={{ 
            position: 'absolute', 
            left: '18px', 
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none'
          }}>
            <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
          </div>
          <select 
            style={{ 
              appearance: 'none',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '99px',
              height: '46px',
              padding: '0 40px 0 44px',
              fontSize: '13px',
              fontFamily: 'var(--font)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: '160px',
              outline: 'none'
            }}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="All Time">All Time</option>
            <option value="Today">Today</option>
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="Last 30 Days">Last 30 Days</option>
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '18px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
      </div>

      <div style={{ paddingBottom: '60px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '120px 0' }}>
            <div className="spin-anim" style={{ width: '36px', height: '36px', border: '3.5px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 20px' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em' }}>Fetching the bank...</div>
          </div>
        ) : filteredList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 20px', background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)', border: '1px dashed var(--border)' }}>
            <Layers size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
            <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Empty Vault</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Adjust your filters to reveal hidden generations.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {filteredList.map(p => (
              <div 
                key={p.id} 
                className="bank-card"
                style={{ 
                  background: 'var(--bg-surface)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--r-lg)', 
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '17px', lineHeight: 1.35, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{p.title}</div>
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {p.track && <Badge variant="blue">{p.track}</Badge>}
                  {p.theme && <Badge variant="purple">{p.theme}</Badge>}
                </div>

                <div style={{ borderTop: '1px solid var(--border-faint)', paddingTop: '16px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent) 0%, #1530c4 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>
                      {(p.generated_by || p.username || 'S')[0].toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', opacity: 0.6 }}>Generated By</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.generated_by || p.username || 'System Agent'}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--mono)', paddingLeft: '4px' }}>
                    <Calendar size={14} style={{ opacity: 0.7 }} />
                    {new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    <span style={{ opacity: 0.3 }}>•</span>
                    {new Date(p.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <button 
                  className="primary-btn" 
                  style={{ width: '100%', justifyContent: 'center', marginTop: '10px', height: '42px', fontSize: '13px', borderRadius: '99px', gap: '8px' }}
                  onClick={() => downloadPpt(p.id, `${p.title}.pptx`)}
                >
                  <Download size={16} /> Download Stage
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .filter-input-wrap:focus-within {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 4px var(--accent-glow);
        }
        .bank-card:hover {
          transform: translateY(-6px);
          border-color: rgba(3,37,189,0.3);
          box-shadow: 0 12px 32px rgba(0,0,0,0.2), 0 0 20px rgba(3,37,189,0.1);
        }
        .spin-anim {
          animation: spinning 1s linear infinite;
        }
        select option {
          background: var(--bg-surface-hi);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
