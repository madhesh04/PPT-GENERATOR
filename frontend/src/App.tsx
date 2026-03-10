import { useState, useRef, useEffect } from 'react';
import './index.css';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SlideData {
  title: string;
  content: string[];
  notes?: string;
}

interface GenerateResponse {
  title: string;
  slides: SlideData[];
  filename: string;
  token: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000';

const ACCENT_PALETTES = [
  { bar: '#F5533D', badge: '#FEF0EE', text: '#F5533D' },
  { bar: '#FF6B35', badge: '#FFF3EE', text: '#FF6B35' },
  { bar: '#0D9A88', badge: '#ECFDF5', text: '#0D9A88' },
  { bar: '#F5A623', badge: '#FFFBEE', text: '#B45309' },
];

const PROGRESS_STEPS = [
  { label: 'Thinking…',        detail: 'Planning your presentation structure' },
  { label: 'Writing content…', detail: 'Generating slide content with AI' },
  { label: 'Building slides…', detail: 'Assembling your PPTX file'          },
];

// ── Tag Input ─────────────────────────────────────────────────────────────────
function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    const next = [...tags];
    parts.forEach(p => { if (p && !next.includes(p) && next.length < 20) next.push(p); });
    onChange(next);
    setInputVal('');
  };

  const removeTag = (idx: number) => onChange(tags.filter((_, i) => i !== idx));

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && inputVal.trim()) {
      e.preventDefault();
      addTag(inputVal);
    } else if (e.key === 'Backspace' && !inputVal && tags.length) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="tag-input-wrapper" onClick={() => inputRef.current?.focus()}>
      {tags.map((tag, i) => (
        <span key={i} className="tag-chip">
          {tag}
          <button className="tag-chip-remove" onClick={e => { e.stopPropagation(); removeTag(i); }}>×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="tag-input-inner"
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => inputVal.trim() && addTag(inputVal)}
        placeholder={tags.length === 0 ? 'Type a topic and press Enter…' : ''}
      />
    </div>
  );
}

// ── Progress Indicator ────────────────────────────────────────────────────────
function ProgressIndicator({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) { setStep(0); return; }
    const id = setInterval(() => setStep(s => Math.min(s + 1, PROGRESS_STEPS.length - 1)), 3500);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="progress-indicator">
      <div className="progress-steps">
        {PROGRESS_STEPS.map((s, i) => (
          <div key={i} className={`progress-step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
            <div className="progress-step-dot">
              {i < step ? <span className="progress-check">✓</span> : i === step ? <span className="progress-spinner" /> : null}
            </div>
            <div className="progress-step-text">
              <span className="progress-step-label">{s.label}</span>
              {i === step && <span className="progress-step-detail">{s.detail}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Slide Cards ───────────────────────────────────────────────────────────────
function EditableBullet({
  text, onSave, accent,
}: { text: string; onSave: (t: string) => void; accent: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);

  const commit = () => { setEditing(false); onSave(val.trim() || text); };

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <textarea
        ref={ref}
        className="bullet-edit-textarea"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } }}
        rows={3}
      />
    );
  }

  return (
    <span
      className="bullet-text editable"
      title="Click to edit"
      onClick={() => { setVal(text); setEditing(true); }}
    >
      {text}
      <span className="edit-icon" style={{ color: accent }}>✎</span>
    </span>
  );
}

function SlideCard({
  slide, index, onUpdate,
}: { slide: SlideData; index: number; onUpdate: (s: SlideData) => void }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const p = ACCENT_PALETTES[index % ACCENT_PALETTES.length];

  const updateBullet = (bi: number, newText: string) => {
    const newContent = [...slide.content];
    newContent[bi] = newText;
    onUpdate({ ...slide, content: newContent });
  };

  return (
    <div className="slide-card">
      {/* 16:9 ratio header bar */}
      <div className="slide-card-header" style={{ background: p.bar }}>
        <span className="slide-number-badge" style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3 className="slide-card-title">{slide.title}</h3>
      </div>

      <div className="slide-card-body">
        <ul className="bullet-list">
          {slide.content.map((point, i) => (
            <li key={i} className="bullet-item">
              <span className="bullet-dot" style={{ background: p.bar }} />
              <EditableBullet text={point} accent={p.bar} onSave={t => updateBullet(i, t)} />
            </li>
          ))}
        </ul>

        {slide.notes && (
          <div className="notes-section">
            <button
              className="notes-toggle"
              style={{ color: p.text }}
              onClick={() => setNotesOpen(o => !o)}
            >
              <span className="notes-icon">{notesOpen ? '▾' : '▸'}</span>
              Speaker Notes
            </button>
            {notesOpen && <p className="notes-text">{slide.notes}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function TitleSlideCard({ title }: { title: string }) {
  return (
    <div className="slide-card">
      <div className="slide-card-header" style={{ background: 'linear-gradient(135deg, #F5533D, #FF6B35, #F5A623)' }}>
        <span className="slide-number-badge" style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}>00</span>
        <h3 className="slide-card-title">Title Slide</h3>
      </div>
      <div className="slide-card-body">
        <p style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0F172A', margin: '0 0 6px' }}>{title}</p>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#F5533D', fontStyle: 'italic' }}>
          AI-Powered Presentation · iamneo
        </p>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [title, setTitle]       = useState('');
  const [topics, setTopics]     = useState<string[]>([]);
  const [numSlides, setNumSlides] = useState(5);
  const [context, setContext]   = useState('');
  const [tone, setTone]         = useState('professional');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<GenerateResponse | null>(null);
  const [slides, setSlides]     = useState<SlideData[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const tones = [
    {
      id: 'professional', label: 'Professional', icon: '💼', desc: 'Formal & corporate',
      defaultContext: 'Audience: corporate stakeholders and business teams. Focus on concrete outcomes, metrics, and industry best practices. Use real company examples where relevant.',
    },
    {
      id: 'executive', label: 'Executive', icon: '🏢', desc: 'C-suite & strategic',
      defaultContext: 'Audience: C-suite executives and board members. Lead with business impact and ROI. Keep content high-level, strategic, and decision-focused. Reference market data or named companies to support key points.',
    },
    {
      id: 'technical', label: 'Technical', icon: '⚙️', desc: 'Engineers & devs',
      defaultContext: 'Audience: software engineers, developers, or data analysts. Explain HOW things work internally — include architecture decisions, implementation patterns, tool comparisons, and code-level examples where helpful.',
    },
    {
      id: 'academic', label: 'Academic', icon: '🎓', desc: 'Research & formal',
      defaultContext: 'Audience: university students or academics encountering this topic for the first time. Explain every concept from first principles — define it, explain how it works, and provide a real-world or textbook example. Use instructive, educational language.',
    },
    {
      id: 'sales', label: 'Sales', icon: '🚀', desc: 'Persuasive & bold',
      defaultContext: 'Audience: prospective clients or customers. Address pain points directly and show how each topic solves a real problem. Use customer success stories, statistics, and clear calls to action to build urgency and credibility.',
    },
    {
      id: 'simple', label: 'Simple', icon: '💬', desc: 'Clear & accessible',
      defaultContext: 'Audience: general public or beginners with no prior knowledge of this topic. Explain every concept using plain language, everyday analogies, and relatable examples. Avoid jargon entirely.',
    },
  ];

  const SLIDE_PRESETS = [3, 5, 7, 10, 12, 15];

  // Auto-fill context when tone changes; don't overwrite custom user text
  const handleToneChange = (newToneId: string) => {
    const prevTone = tones.find(t => t.id === tone);
    const newTone  = tones.find(t => t.id === newToneId);
    if (!newTone) return;
    const isAutoFilled = !context || context === prevTone?.defaultContext;
    if (isAutoFilled) setContext(newTone.defaultContext);
    setTone(newToneId);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSlides([]);
    setDownloadError(null);
    try {
      const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, topics, num_slides: numSlides, context, tone }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to generate presentation');
      }
      const data: GenerateResponse = await response.json();
      setResult(data);
      setSlides(data.slides);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch(`${API_BASE}/download/${result.token}`);
      if (!response.ok) {
        setDownloadError('Download link expired or already used. Please regenerate.');
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = result.filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setDownloadError('Download failed. Please regenerate.');
    } finally {
      setDownloading(false);
    }
  };

  const canGenerate = !loading && title.trim() && topics.length >= 1 && numSlides >= 2;

  return (
    <div className="app-root">

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="header-logo">N</div>
            <div>
              <h1 className="header-title">NEO <span className="brand-accent">PPT</span></h1>
              <p className="header-subtitle">AI Presentation Generator · iamneo</p>
            </div>
          </div>

          {result && (
            <button className="neo-btn" onClick={handleDownload} disabled={downloading}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 20px', fontSize:'0.875rem' }}>
              {downloading
                ? <><svg className="animate-spin" style={{width:16,height:16}} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" strokeOpacity="0.3" /><path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Downloading…</>
                : <><svg style={{width:16,height:16}} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>Download .pptx</>
              }
            </button>
          )}
        </div>
      </header>

      <div className="page-container">

        {/* ── Form Card ── */}
        <div className="neo-card form-card-inner" style={{ marginBottom: 32 }}>

          <div style={{ marginBottom: 28 }}>
            <h2 className="section-heading">Create Your Presentation</h2>
            <p className="section-sub">Fill in the details below and let AI generate a professional deck for you.</p>
          </div>

          {/* Row 1 — Title */}
          <div style={{ marginBottom: 20 }}>
            <label className="neo-label">Presentation Title</label>
            <input className="neo-input" type="text" value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Q3 Business Review" />
          </div>

          {/* Tag Input — Topics */}
          <div style={{ marginBottom: 20 }}>
            <label className="neo-label">
              Key Topics &nbsp;<span style={{ fontWeight:400, color:'#94A3B8' }}>
                (press Enter or comma to add — {topics.length}/20)
              </span>
            </label>
            <TagInput tags={topics} onChange={setTopics} />
          </div>

          {/* Context */}
          <div style={{ marginBottom: 20 }}>
            <label className="neo-label">
              Context &nbsp;<span style={{ fontWeight:400, color:'#94A3B8' }}>(optional)</span>
            </label>
            <textarea className="neo-textarea" value={context}
              onChange={e => setContext(e.target.value.slice(0, 500))} rows={3}
              placeholder="Describe your audience, goals, or specific focus areas. e.g. 'This is for a board meeting focused on cost reduction.'" />
            <div className="char-counter">{context.length}/500</div>
          </div>

          {/* Tone Selector */}
          <div style={{ marginBottom: 20 }}>
            <label className="neo-label">Tone / Audience</label>
            <div className="grid-6col">
              {tones.map(t => (
                <button key={t.id} onClick={() => handleToneChange(t.id)}
                  className={`tone-pill${tone === t.id ? ' active' : ''}`}>
                  <span style={{ fontSize:'1.3rem' }}>{t.icon}</span>
                  <span style={{ fontSize:'0.72rem', fontWeight:600, color: tone===t.id?'#F5533D':'#334155' }}>{t.label}</span>
                  <span style={{ fontSize:'0.64rem', color:'#94A3B8', lineHeight:1.2 }}>{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Slide Count */}
          <div style={{ marginBottom: 24 }}>
            <label className="neo-label">
              Number of Slides &nbsp;
              <span style={{ background:'rgba(245,83,61,0.1)', color:'#F5533D', borderRadius:999, padding:'2px 10px', fontSize:'0.78rem', fontWeight:700 }}>
                {numSlides}
              </span>
            </label>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginTop:6 }}>
              <span style={{ fontSize:'0.75rem', color:'#94A3B8', width:14 }}>2</span>
              <input type="range" min={2} max={15} value={numSlides}
                onChange={e => setNumSlides(Number(e.target.value))}
                style={{ flex:1, height:6, cursor:'pointer' }} />
              <span style={{ fontSize:'0.75rem', color:'#94A3B8', width:20 }}>15</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, padding:'0 28px', flexWrap:'wrap', gap:4 }}>
              {SLIDE_PRESETS.map(n => (
                <button key={n} onClick={() => setNumSlides(n)} className={`preset-btn${numSlides===n?' active':''}`}>{n}</button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="alert-error">⚠️ {error}</div>
          )}

          {/* Generate Button */}
          <button className="neo-btn generate-btn" onClick={handleGenerate} disabled={!canGenerate}>
            {loading
              ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <svg className="animate-spin" style={{width:20,height:20}} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" strokeOpacity="0.3"/>
                    <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Generating…
                </span>
              : '✨ Generate Presentation'
            }
          </button>

          {/* Progress Steps */}
          <ProgressIndicator active={loading} />
        </div>

        {/* ── Preview Section ── */}
        {result && (
          <div>
            <div className="preview-header">
              <div>
                <h2 style={{ margin:'0 0 2px', fontWeight:700, fontSize:'1.1rem', color:'#0F172A' }}>Preview</h2>
                <p style={{ margin:0, fontSize:'0.83rem', color:'#64748B' }}>
                  {slides.length + 3} slides total (title + agenda + {slides.length} content + closing) · Click bullets to edit
                </p>
              </div>
              <button className="neo-btn" onClick={handleDownload} disabled={downloading}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 20px', fontSize:'0.875rem', border:'none', cursor:'pointer' }}>
                ⬇ Download .pptx
              </button>
            </div>

            {/* Download error */}
            {downloadError && (
              <div className="alert-error" style={{ marginBottom:16 }}>
                ⚠️ {downloadError}
                <button className="regen-btn" onClick={handleGenerate}>Re-generate</button>
              </div>
            )}

            <div className="grid-2col-preview">
              <TitleSlideCard title={result.title} />
              {/* Agenda card */}
              <div className="slide-card">
                <div className="slide-card-header" style={{ background: '#0F172A' }}>
                  <span className="slide-number-badge" style={{ background:'rgba(255,255,255,0.15)', color:'#fff' }}>📋</span>
                  <h3 className="slide-card-title">Agenda</h3>
                </div>
                <div className="slide-card-body">
                  <ul className="bullet-list">
                    {slides.map((s, i) => (
                      <li key={i} className="bullet-item">
                        <span className="bullet-dot" style={{ background: ACCENT_PALETTES[i % ACCENT_PALETTES.length].bar }} />
                        <span className="bullet-text">{String(i+1).padStart(2,'0')} &nbsp; {s.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {slides.map((slide, i) => (
                <SlideCard key={i} slide={slide} index={i}
                  onUpdate={updated => setSlides(prev => prev.map((s, idx) => idx===i?updated:s))} />
              ))}

              {/* Closing card */}
              <div className="slide-card">
                <div className="slide-card-header" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
                  <span className="slide-number-badge" style={{ background:'rgba(245,83,61,0.4)', color:'#fff' }}>🎉</span>
                  <h3 className="slide-card-title">Thank You</h3>
                </div>
                <div className="slide-card-body">
                  <p style={{ fontWeight:700, fontSize:'1.1rem', color:'#0F172A', margin:'0 0 6px' }}>Thank You</p>
                  <p style={{ margin:0, fontSize:'0.82rem', color:'#F5533D', fontStyle:'italic' }}>
                    {result.title} · AI-Powered Presentation · iamneo
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
