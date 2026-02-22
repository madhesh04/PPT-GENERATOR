import { useState } from 'react';
import './index.css';

interface SlideData {
  title: string;
  content: string[];
}

interface GenerateResponse {
  title: string;
  slides: SlideData[];
  filename: string;
  token: string;
}

const ACCENT_PALETTES = [
  { bar: '#F5533D', badge: '#FEF0EE', text: '#F5533D' },
  { bar: '#FF6B35', badge: '#FFF3EE', text: '#FF6B35' },
  { bar: '#F5A623', badge: '#FFFBEE', text: '#B45309' },
  { bar: '#10B981', badge: '#ECFDF5', text: '#059669' },
];

function SlideCard({ slide, index }: { slide: SlideData; index: number }) {
  const p = ACCENT_PALETTES[index % ACCENT_PALETTES.length];
  return (
    <div className="slide-card">
      <div style={{ height: 4, background: p.bar }} />
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px',
            borderRadius: 999, background: p.badge, color: p.text
          }}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: 0 }}>
            {slide.title}
          </h3>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slide.content.map((point, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                marginTop: 6, width: 6, height: 6, borderRadius: '50%',
                background: p.bar, flexShrink: 0, display: 'block'
              }} />
              <span style={{ fontSize: '0.855rem', color: '#475569', lineHeight: 1.55 }}>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TitleSlideCard({ title }: { title: string }) {
  return (
    <div className="slide-card" style={{ border: '1.5px solid rgba(245,83,61,0.25)', background: 'linear-gradient(135deg,#FFF5F3,#FFF8F5)' }}>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #F5533D, #FF6B35, #F5A623)' }} />
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'rgba(245,83,61,0.1)', color: '#F5533D' }}>
            00
          </span>
          <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500 }}>Title Slide</span>
        </div>
        <h3 style={{ fontWeight: 800, fontSize: '1.3rem', color: '#0F172A', margin: '0 0 6px' }}>{title}</h3>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#F5533D', fontStyle: 'italic' }}>AI-Powered Presentation · iamneo</p>
      </div>
    </div>
  );
}

export default function App() {
  const [title, setTitle]       = useState('');
  const [topics, setTopics]     = useState('');
  const [numSlides, setNumSlides] = useState(5);
  const [context, setContext]   = useState('');
  const [tone, setTone]         = useState('professional');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<GenerateResponse | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const tones = [
    { id: 'professional', label: 'Professional', icon: '💼', desc: 'Formal & corporate' },
    { id: 'executive',    label: 'Executive',    icon: '🏢', desc: 'C-suite & strategic' },
    { id: 'technical',    label: 'Technical',    icon: '⚙️', desc: 'Engineers & devs' },
    { id: 'academic',     label: 'Academic',     icon: '🎓', desc: 'Research & formal' },
    { id: 'sales',        label: 'Sales',        icon: '🚀', desc: 'Persuasive & bold' },
    { id: 'simple',       label: 'Simple',       icon: '💬', desc: 'Clear & accessible' },
  ];

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const topicList = topics.split(',').map(t => t.trim()).filter(Boolean);
      const response = await fetch('https://ppt-generator-tqfl.onrender.com/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, topics: topicList, num_slides: numSlides, context, tone }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to generate presentation');
      }
      const data: GenerateResponse = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    setDownloading(true);
    try {
      const response = await fetch(`https://ppt-generator-tqfl.onrender.com/download/${result.token}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = result.filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  };

  const canGenerate = !loading && title.trim() && topics.trim() && numSlides >= 2;

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter, sans-serif', width: '100%', overflowX: 'hidden' }}>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)'
      }}>
        <div className="header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* iamneo wordmark */}
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #F5533D, #FF6B35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.5px'
            }}>N</div>
            <div>
              <h1 style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: '#0F172A', letterSpacing: '-0.3px' }}>
                NEO <span style={{ color: '#F5533D' }}>PPT</span>
              </h1>
              <p className="header-subtitle" style={{ margin: 0, fontSize: '0.7rem', color: '#94A3B8', fontWeight: 500 }}>
                AI Presentation Generator · iamneo
              </p>
            </div>
          </div>

          {result && (
            <button className="neo-btn" onClick={handleDownload} disabled={downloading}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', fontSize: '0.875rem' }}>
              {downloading ? (
                <>
                  <svg className="animate-spin" style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" strokeOpacity="0.3" />
                    <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Downloading...
                </>
              ) : (
                <>
                  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Download .pptx
                </>
              )}
            </button>
          )}
        </div>
      </header>

      <div className="page-container">

        {/* ── Form Card ── */}
        <div className="neo-card form-card-inner" style={{ marginBottom: 32 }}>

          {/* Section Header */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '1.15rem', color: '#0F172A' }}>
              Create Your Presentation
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B' }}>
              Fill in the details below and let AI generate a professional deck for you.
            </p>
          </div>

          {/* Row 1 — Title & Topics */}
          <div className="grid-2col">
            <div>
              <label className="neo-label">Presentation Title</label>
              <input className="neo-input" type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Q3 Business Review" />
            </div>
            <div>
              <label className="neo-label">
                Key Topics &nbsp;<span style={{ fontWeight: 400, color: '#94A3B8' }}>(comma separated)</span>
              </label>
              <input className="neo-input" type="text" value={topics} onChange={e => setTopics(e.target.value)}
                placeholder="Revenue Growth, Strategy, Team, Outlook" />
            </div>
          </div>

          {/* Context / Description */}
          <div style={{ marginTop: 20 }}>
            <label className="neo-label">
              Context &nbsp;<span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span>
            </label>
            <textarea className="neo-textarea" value={context} onChange={e => setContext(e.target.value)} rows={3}
              placeholder="Describe your audience, goals, or specific focus areas. e.g. 'This is for a board meeting focused on cost reduction in Southeast Asian markets.'" />
          </div>

          {/* Tone Selector */}
          <div style={{ marginTop: 20 }}>
            <label className="neo-label">Tone / Audience</label>
            <div className="grid-6col">
              {tones.map(t => (
                <button key={t.id} onClick={() => setTone(t.id)}
                  className={`tone-pill${tone === t.id ? ' active' : ''}`}>
                  <span style={{ fontSize: '1.3rem' }}>{t.icon}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: tone === t.id ? '#F5533D' : '#334155' }}>{t.label}</span>
                  <span style={{ fontSize: '0.64rem', color: '#94A3B8', lineHeight: 1.2 }}>{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Number of Slides */}
          <div style={{ marginTop: 20 }}>
            <label className="neo-label">
              Number of Slides &nbsp;
              <span style={{ background: 'rgba(245,83,61,0.1)', color: '#F5533D', borderRadius: 999, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                {numSlides}
              </span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', width: 14 }}>2</span>
              <input type="range" min={2} max={15} value={numSlides}
                onChange={e => setNumSlides(Number(e.target.value))}
                style={{ flex: 1, height: 6, cursor: 'pointer' }} />
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', width: 20 }}>15</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '0 28px', flexWrap: 'wrap', gap: 4 }}>
              {[2, 5, 8, 10, 15].map(n => (
                <button key={n} onClick={() => setNumSlides(n)} style={{
                  fontSize: '0.72rem', padding: '2px 10px', borderRadius: 999,
                  border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                  background: numSlides === n ? '#F5533D' : 'transparent',
                  color: numSlides === n ? 'white' : '#94A3B8',
                  transition: 'all 0.15s'
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#DC2626', fontSize: '0.85rem' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Generate Button */}
          <button className="neo-btn" onClick={handleGenerate} disabled={!canGenerate}
            style={{ marginTop: 24, width: '100%', padding: '14px', fontSize: '0.95rem', borderRadius: 12, border: 'none', cursor: canGenerate ? 'pointer' : 'not-allowed' }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg className="animate-spin" style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" strokeOpacity="0.3" />
                  <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating with AI...
              </span>
            ) : '✨ Generate Presentation'}
          </button>
        </div>

        {/* ── Preview Section ── */}
        {result && (
          <div>
            {/* Preview Header */}
            <div className="preview-header">
              <div>
                <h2 style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '1.1rem', color: '#0F172A' }}>Preview</h2>
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#64748B' }}>
                  {result.slides.length + 1} slides generated · Ready to download
                </p>
              </div>
              <button className="neo-btn" onClick={handleDownload} disabled={downloading}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
                ⬇ Download .pptx
              </button>
            </div>

            {/* Slide Grid */}
            <div className="grid-2col-preview">
              <TitleSlideCard title={result.title} />
              {result.slides.map((slide, i) => (
                <SlideCard key={i} slide={slide} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
