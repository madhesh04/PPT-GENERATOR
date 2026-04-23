import { useState, useEffect } from 'react';
import { usePresentationStore } from '../store/usePresentationStore';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastContainer';
import { useDownload } from '../hooks/useDownload';
import TagInput from '../components/ui/TagInput';
import SearchableDropdown from '../components/ui/SearchableDropdown';

/* ─── Icons ─── */
const SparkIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);
const DocIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);
const PaletteIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402a3.75 3.75 0 10-5.304-5.304L4.098 14.6A3.75 3.75 0 004.098 19.902z" />
  </svg>
);
const CpuIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
  </svg>
);
const MicIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
  </svg>
);
const CheckIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);


/* ─── Config options ─── */
const TONES = ['Professional', 'Academic', 'Casual', 'Technical', 'Executive', 'Creative'];
const TRACKS = ['GenAI', 'ML / AI', 'Cloud Computing', 'Full Stack Dev', 'Cybersecurity', 'Data Analytics', 'DSA / CP'];
const CLIENTS = ['Internal', 'NASSCOM', 'TCS', 'Wipro', 'Infosys', 'HCL', 'IBM', 'Other'];
const MODULES = ['Module 1', 'Module 2', 'Module 3', 'Module 4', 'Module 5', 'Module 6', 'Custom'];
const COURSES = ['Bootcamp', 'Workshop', 'Certification', 'Masterclass', 'Sprint', 'Custom'];

const THEMES = [
  {
    value: 'neon',
    label: 'Cyber Noir',
    preview: {
      bg: '#0d0f14', accent: '#0325BD', accent2: '#22d3a5',
      title: '#d1d1f1', line: 'rgba(3,37,189,0.4)', line2: 'rgba(34,211,165,0.3)',
    },
  },
  {
    value: 'ocean',
    label: 'Oceanic',
    preview: {
      bg: '#0a1628', accent: '#0ea5e9', accent2: '#22d3a5',
      title: '#bae6fd', line: 'rgba(14,165,233,0.4)', line2: 'rgba(34,211,165,0.3)',
    },
  },
  {
    value: 'emerald',
    label: 'Emerald',
    preview: {
      bg: '#062e1a', accent: '#22c55e', accent2: '#86efac',
      title: '#86efac', line: 'rgba(34,197,94,0.4)', line2: 'rgba(134,239,172,0.3)',
    },
  },
  {
    value: 'royal',
    label: 'Royal Sys',
    preview: {
      bg: '#1a0a3d', accent: '#7c3aed', accent2: '#a78bfa',
      title: '#c4b5fd', line: 'rgba(124,58,237,0.4)', line2: 'rgba(167,139,250,0.3)',
    },
  },
  {
    value: 'light',
    label: 'Neo Light',
    preview: {
      bg: '#f8fafc', accent: '#2563eb', accent2: '#0ea5e9',
      title: '#1e40af', line: 'rgba(37,99,235,0.3)', line2: 'rgba(14,165,233,0.2)',
    },
  },
  {
    value: 'carbon',
    label: 'Carbon',
    preview: {
      bg: '#111827', accent: '#6b7280', accent2: '#9ca3af',
      title: '#d1d5db', line: 'rgba(107,114,128,0.4)', line2: 'rgba(156,163,175,0.3)',
    },
  },
];

const ENGINES = [
  { value: 'auto', label: 'AUTO_ROUTE', desc: 'Smart provider selection', iconClass: 'blue' },
  { value: 'nvidia', label: 'NVIDIA_NIM', desc: 'High-throughput inference', iconClass: 'green' },
  { value: 'groq', label: 'GROQ_INFER', desc: 'Ultra-fast generation', iconClass: 'yellow' },
];

const TRACK_OPTS = [{ value: '', label: 'Select Track' }, ...TRACKS.map((t) => ({ value: t, label: t }))];
const CLIENT_OPTS = [{ value: '', label: 'Select Client' }, ...CLIENTS.map((c) => ({ value: c, label: c }))];
const MODULE_OPTS = [{ value: '', label: 'Select Module' }, ...MODULES.map((m) => ({ value: m, label: m }))];
const COURSE_OPTS = [{ value: '', label: 'Select Course' }, ...COURSES.map((c) => ({ value: c, label: c }))];

/* ─── Theme Preview Mini Card ─── */
function ThemePreviewCard({ theme, active, onClick }: { theme: typeof THEMES[0]; active: boolean; onClick: () => void }) {
  const p = theme.preview;
  return (
    <div className={`theme-card${active ? ' active' : ''}`} onClick={onClick}>
      <div className="theme-preview" style={{ background: p.bg }}>
        <div className="tp-titlebar">
          <div className="tp-dot" style={{ background: p.accent }} />
          <div className="tp-dot" style={{ background: p.accent2, opacity: 0.7 }} />
          <div className="tp-dot" style={{ background: p.title, opacity: 0.4 }} />
        </div>
        <div className="tp-title" style={{ background: p.title, opacity: 0.5, marginTop: '4px', width: '55%', height: '3px', borderRadius: '2px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
          <div className="tp-line" style={{ background: p.line, height: '2px', width: '90%', borderRadius: '1px' }} />
          <div className="tp-line" style={{ background: p.line2, height: '2px', width: '70%', borderRadius: '1px' }} />
          <div className="tp-line" style={{ background: p.line, height: '2px', width: '55%', borderRadius: '1px' }} />
        </div>
      </div>
      <div className="theme-footer" style={{ background: p.bg, borderTop: `1px solid ${p.line}` }}>
        <span className="theme-name-label" style={{ color: p.title }}>{theme.label}</span>
        {active && (
          <span className="theme-check-icon" style={{ display: 'block' }}>
            <CheckIcon />
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Engine Icon ─── */
function EngineGlyph({ cls }: { cls: string }) {
  return (
    <div className={`engine-icon ${cls}`}>
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    </div>
  );
}

/* ─── Main View ─── */
export default function CreatorView() {
  const { showToast } = useToast();
  const {
    title, topics, context, tone, theme, numSlides, forceProvider, includeImages,
    track, client, module, course, targetAudience,
    setTitle, setTopics, setContext, setTone, setTheme, setNumSlides, setForceProvider, setIncludeImages,
    setTrack, setClient, setModule, setCourse, setTargetAudience,
    notesContent,
    generatePresentation, generateLectureNotes, loading, errorMsg, setErrorMsg,
    updateSlide,
    regenerateSlide,
    result, slides,
  } = usePresentationStore();
  const { globalImageGen, settingsLoaded, preferredTheme, setPreferredTheme } = useAppStore();
  const [contextTab, setContextTab] = useState<'text' | 'url'>('text');
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [qcWarning, setQcWarning] = useState<string[] | null>(null);
  const [qcDismissed, setQcDismissed] = useState(false);
  const [genMeta, setGenMeta] = useState<{ tone: string; slides: number; provider: string; model: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'ppt' | 'notes'>('ppt');

  // Notes state
  const [lnSubject, setLnSubject] = useState('');
  const [lnUnit, setLnUnit] = useState('');
  const [lnTopics, setLnTopics] = useState<string[]>([]);
  const [lnContext, setLnContext] = useState('');
  const [lnPages, setLnPages] = useState(3);
  const [lnDepth, setLnDepth] = useState<'brief' | 'standard' | 'deep'>('standard');
  const [lnFormat, setLnFormat] = useState<'prose' | 'bullets'>('prose');
  const [showNotesPreview, setShowNotesPreview] = useState(false);
  
  // -- Slides Preview State --
  const [showSlidesPreview, setShowSlidesPreview] = useState(false);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);


  // Ensure includeImages is sync'd with global policy if policy changes
  useEffect(() => {
    if (settingsLoaded && globalImageGen === false) {
      setIncludeImages(false);
    }
  }, [settingsLoaded, globalImageGen, setIncludeImages]);

  // Restore preferred theme from localStorage on mount
  useEffect(() => {
    if (preferredTheme && preferredTheme !== theme) {
      setTheme(preferredTheme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL context extraction
  const handleExtractUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    try {
      const { presentationApi } = await import('../api/presentation');
      const data = await presentationApi.extractFromUrl(urlInput);
      setContext((data.text || '').slice(0, 2000));
      setContextTab('text');
      showToast('URL content extracted!', 'success');
    } catch {
      showToast('Failed to extract URL content', 'error');
    } finally {
      setUrlLoading(false);
    }
  };

  /* Slider background */
  const sliderPct = ((numSlides - 3) / (15 - 3)) * 100;

  const { handleDownload: downloadPpt } = useDownload();

  async function handleGenerate() {
    if (!title.trim()) { showToast('Presentation title is required', 'error'); return; }
    if (!topics.length) { showToast('At least one topic is required', 'error'); return; }
    setErrorMsg('');
    setQcWarning(null);
    setQcDismissed(false);
    setGenMeta(null);
    generatePresentation((res?: any) => {
      showToast('Presentation generated successfully!', 'success');
      setCurrentSlideIdx(0);
      setShowSlidesPreview(true);
      if (res?.qc?.issues?.length > 0) {
        setQcWarning(res.qc.issues);
      }
      if (res) {
        setGenMeta({
          tone: tone,
          slides: res.slides?.length || numSlides,
          provider: res.provider || 'groq',
          model: res.model_used || 'llama',
        });
      }
    });
  }

  async function handleLnGenerate() {
    if (!lnSubject.trim()) { showToast('Subject is required', 'error'); return; }
    if (!lnTopics.length) { showToast('At least one topic is required', 'error'); return; }
    
    setErrorMsg('');
    const payload = {
      subject: lnSubject,
      unit: lnUnit,
      topics: lnTopics,
      context: lnContext,
      pages: lnPages,
      depth: lnDepth,
      format: lnFormat,
      track: track || null,
      client: client || null,
      force_provider: forceProvider
    };

    generateLectureNotes(payload, () => {
      setShowNotesPreview(true);
      showToast('Lecture notes generated successfully!', 'success');
    });
  }

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-header-icon">
            <SparkIcon />
          </div>
          <div className="page-title">Generate Content</div>
        </div>
      </div>

      {/* QC Warning Banner */}
      {qcWarning && !qcDismissed && (
        <div style={{ background: 'rgba(245,197,66,0.08)', border: '1px solid rgba(245,197,66,0.25)', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 800, color: 'var(--yellow)', marginBottom: '6px', letterSpacing: '0.08em' }}>⚠ QC ISSUES DETECTED</div>
            <ul style={{ margin: 0, padding: '0 0 0 16px', color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.7 }}>
              {qcWarning.map((issue, i) => <li key={i}>{issue}</li>)}
            </ul>
          </div>
          <button onClick={() => setQcDismissed(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 0 0 12px', flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Gen Metadata Summary */}
      {genMeta && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.06em' }}>
          Generated with: <span style={{ color: 'var(--green)' }}>{genMeta.tone.charAt(0).toUpperCase() + genMeta.tone.slice(1)}</span> · <span style={{ color: 'var(--accent-text)' }}>{genMeta.slides} slides</span> · <span style={{ color: 'var(--yellow)' }}>{genMeta.provider} {genMeta.model}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="create-tabs">
        <button
          className={`create-tab${activeTab === 'ppt' ? ' active' : ''}`}
          onClick={() => setActiveTab('ppt')}
        >
          <SparkIcon /> Presentation
        </button>
        <button
          className={`create-tab${activeTab === 'notes' ? ' active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          <DocIcon /> Lecture Notes
        </button>
      </div>

      {/* PPT Tab */}
      {activeTab === 'ppt' && (
        <div className="create-panel active">
          <div className="create-layout">
            {/* Left: form fields */}
            <div className="create-left">
              {/* Error */}
              {errorMsg && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '12px 16px', color: 'var(--red)', fontSize: '12px', fontWeight: 600 }}>
                  {errorMsg}
                </div>
              )}

              {/* Field 00: Taxonomy */}
              <div className="field-block">
                <div className="field-num-label">
                  <span className="field-num">00</span>
                  <span className="field-sep">/</span>
                  <span className="field-name">Classify As</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <SearchableDropdown id="f00-track" label="TRACK" value={track} options={TRACK_OPTS} onChange={setTrack} />
                  <SearchableDropdown id="f00-client" label="CLIENT" value={client} options={CLIENT_OPTS} onChange={setClient} />
                  <SearchableDropdown id="f00-module" label="MODULE" value={module} options={MODULE_OPTS} onChange={setModule} />
                  <SearchableDropdown id="f00-course" label="COURSE" value={course} options={COURSE_OPTS} onChange={setCourse} />
                </div>
              </div>

              {/* Field 01: Title */}
              <div className="field-block">
                <div className="field-num-label">
                  <span className="field-num">01</span>
                  <span className="field-sep">/</span>
                  <span className="field-name">Presentation Title</span>
                  <span className="field-hint">{title.length}/80</span>
                </div>
                <input
                  className="text-input"
                  type="text"
                  id="ppt-title"
                  placeholder="e.g. Introduction to Generative AI"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                  maxLength={80}
                />
              </div>

              {/* Field 02: Brief */}
              <div className="field-block">
                <div className="field-num-label">
                  <span className="field-num">02</span>
                  <span className="field-sep">/</span>
                  <span className="field-name">Content Brief</span>
                  {/* Context source tabs */}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                    <button
                      style={{ fontSize: '9px', fontFamily: 'var(--mono)', fontWeight: 700, padding: '2px 8px', border: '1px solid', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s', background: contextTab === 'text' ? 'rgba(3,37,189,0.12)' : 'transparent', color: contextTab === 'text' ? 'var(--accent-text)' : 'var(--text-muted)', borderColor: contextTab === 'text' ? 'rgba(3,37,189,0.3)' : 'var(--border)' }}
                      onClick={() => setContextTab('text')}
                    >TEXT</button>
                    <button
                      style={{ fontSize: '9px', fontFamily: 'var(--mono)', fontWeight: 700, padding: '2px 8px', border: '1px solid', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s', background: contextTab === 'url' ? 'rgba(3,37,189,0.12)' : 'transparent', color: contextTab === 'url' ? 'var(--accent-text)' : 'var(--text-muted)', borderColor: contextTab === 'url' ? 'rgba(3,37,189,0.3)' : 'var(--border)' }}
                      onClick={() => setContextTab('url')}
                    >URL</button>
                  </span>
                </div>
                {contextTab === 'text' ? (
                  <>
                    <textarea
                      className="textarea-input"
                      id="ppt-context"
                      placeholder="Describe the focus, learning objectives, or any context for the presentation…"
                      rows={3}
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                    />
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px', fontFamily: 'var(--mono)' }}>{context.length} chars</div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                    <input
                      className="text-input"
                      id="ppt-url"
                      placeholder="https://example.com/article…"
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleExtractUrl(); }}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="ghost-btn"
                      onClick={handleExtractUrl}
                      disabled={urlLoading || !urlInput.trim()}
                      style={{ flexShrink: 0, fontSize: '10px', padding: '0 12px' }}
                    >
                      {urlLoading ? '…' : 'Extract'}
                    </button>
                  </div>
                )}
              </div>

              {/* Field 03: Topics */}
              <div className="field-block">
                <div className="field-num-label">
                  <span className="field-num">03</span>
                  <span className="field-sep">/</span>
                  <span className="field-name">Key Topics</span>
                  <span className="field-hint">{topics.length}/10 added</span>
                </div>
                <TagInput tags={topics} onChange={setTopics} placeholder="Type a topic and press Enter…" max={10} />
              </div>

              {/* Field 04: Slide count */}
              <div className="field-block">
                <div className="field-num-label">
                  <span className="field-num">04</span>
                  <span className="field-sep">/</span>
                  <span className="field-name">Slide Count</span>
                </div>
                <div className="slider-row">
                  <span className="slider-number">{numSlides}</span>
                  <input
                    className="slider"
                    type="range"
                    id="ppt-slides"
                    min={3} max={15} step={1}
                    value={numSlides}
                    onChange={(e) => setNumSlides(Number(e.target.value))}
                    style={{
                      background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${sliderPct}%, rgba(37,40,54,0.9) ${sliderPct}%)`,
                    }}
                  />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>3–15</span>
                </div>
              </div>

              {/* Field 05: Audience */}
              <div className="field-block">
                <div className="field-num-label">
                  <span className="field-num">05</span>
                  <span className="field-sep">/</span>
                  <span className="field-name">Target Audience</span>
                </div>
                <input
                  className="text-input"
                  type="text"
                  id="ppt-audience"
                  placeholder="e.g. Engineering graduates, Freshers, Industry professionals…"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>
            </div>

            {/* Right: config panel */}
            <div className="config-panel">
              {/* Tone */}
              <div className="config-card">
                <div className="config-hdr">
                  <MicIcon />
                  <span className="config-lbl">Tone Matrix</span>
                </div>
                <div className="tone-grid">
                  {TONES.map((t) => (
                    <button
                      key={t}
                      className={`tone-chip${tone.toLowerCase() === t.toLowerCase() ? ' active' : ''}`}
                      onClick={() => setTone(t.toLowerCase())}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme */}
              <div className="config-card">
                <div className="config-hdr">
                  <PaletteIcon />
                  <span className="config-lbl">Visual Theme</span>
                </div>
                <div className="theme-grid">
                  {THEMES.map((th) => (
                    <ThemePreviewCard
                      key={th.value}
                      theme={th}
                      active={theme === th.value}
                      onClick={() => { setTheme(th.value); setPreferredTheme(th.value); }}
                    />
                  ))}
                </div>
              </div>

              {/* Engine */}
              <div className="config-card">
                <div className="config-hdr">
                  <CpuIcon />
                  <span className="config-lbl">Neural Engine</span>
                </div>
                {ENGINES.map((eng) => (
                  <div
                    key={eng.value}
                    className={`engine-row${forceProvider === eng.value || (eng.value === 'auto' && !forceProvider) ? ' active' : ''}`}
                    onClick={() => setForceProvider(eng.value === 'auto' ? null : eng.value)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setForceProvider(eng.value === 'auto' ? null : eng.value)}
                  >
                    <EngineGlyph cls={eng.iconClass} />
                    <div className="engine-text">
                      <div className="engine-name">{eng.label}</div>
                      <div className="engine-desc">{eng.desc}</div>
                    </div>
                    <div className="engine-radio" />
                  </div>
                ))}
              </div>

              {/* Image toggle */}
              <div className="config-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: globalImageGen ? 1 : 0.6 }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>Include Visuals</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {globalImageGen ? 'AI-generated slide images' : 'Disabled by Admin'}
                  </div>
                </div>
                <label className="toggle">
                  <input 
                    type="checkbox" 
                    checked={includeImages} 
                    onChange={(e) => setIncludeImages(globalImageGen ? e.target.checked : false)} 
                    disabled={!globalImageGen}
                    id="ppt-images" 
                  />
                  <div className="toggle-track" />
                </label>
              </div>

              {/* Generate button */}
              <button
                id="ppt-generate-btn"
                className={`generate-btn${loading ? ' loading' : ''}`}
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spin">⟳</span>
                    Generating…
                  </>
                ) : (
                  <>
                    <SparkIcon />
                    Generate Presentation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="create-panel active">
          <div className="ln-layout">
            {/* Left */}
            <div className="ln-left">
              {/* Field 00: Taxonomy */}
              <div className="field-block">
                <div className="field-num-label">
                  <span className="field-num">00</span>
                  <span className="field-sep">/</span>
                  <span className="field-name">Classify As</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <SearchableDropdown id="ln-track" label="TRACK" value={track} options={TRACK_OPTS} onChange={setTrack} />
                  <SearchableDropdown id="ln-client" label="CLIENT" value={client} options={CLIENT_OPTS} onChange={setClient} />
                </div>
              </div>

              {/* Field 01: Subject */}
              <div className="field-block">
                <div className="field-num-label">
                  <span className="field-num">01</span>
                  <span className="field-sep">/</span>
                  <span className="field-name">Subject</span>
                </div>
                <input
                  className="text-input"
                  type="text"
                  id="ln-subject"
                  placeholder="e.g. Machine Learning Fundamentals"
                  value={lnSubject}
                  onChange={(e) => setLnSubject(e.target.value)}
                />
              </div>

              {/* Field 02: Unit */}
              <div className="field-block">
                <div className="field-num-label">
                  <span className="field-num">02</span>
                  <span className="field-sep">/</span>
                  <span className="field-name">Unit / Chapter</span>
                </div>
                <input
                  className="text-input"
                  type="text"
                  id="ln-unit"
                  placeholder="e.g. Unit 3 — Neural Networks"
                  value={lnUnit}
                  onChange={(e) => setLnUnit(e.target.value)}
                />
              </div>

              {/* Field 03: Topics */}
              <div className="field-block">
                <div className="field-num-label">
                  <span className="field-num">03</span>
                  <span className="field-sep">/</span>
                  <span className="field-name">Topics</span>
                  <span className="field-hint">{lnTopics.length}/10</span>
                </div>
                <TagInput tags={lnTopics} onChange={setLnTopics} placeholder="Topics to cover (Enter to add)…" max={10} />
              </div>

              {/* Field 04: Context */}
              <div className="field-block">
                <div className="field-num-label">
                  <span className="field-num">04</span>
                  <span className="field-sep">/</span>
                  <span className="field-name">Context</span>
                </div>
                <textarea
                  className="textarea-input"
                  id="ln-context"
                  placeholder="Any specific focus areas, student background, or industry context…"
                  rows={3}
                  value={lnContext}
                  onChange={(e) => setLnContext(e.target.value)}
                />
              </div>

              {/* Field 05: Pages */}
              <div className="field-block">
                <div className="field-num-label">
                  <span className="field-num">05</span>
                  <span className="field-sep">/</span>
                  <span className="field-name">Target Pages</span>
                </div>
                <div className="slider-row">
                  <span className="slider-number">{lnPages}</span>
                  <input
                    className="slider"
                    type="range"
                    id="ln-pages"
                    min={1} max={20} step={1}
                    value={lnPages}
                    onChange={(e) => setLnPages(Number(e.target.value))}
                    style={{
                      background: `linear-gradient(to right, var(--green) 0%, var(--green) ${((lnPages - 1) / 19) * 100}%, rgba(37,40,54,0.9) ${((lnPages - 1) / 19) * 100}%)`,
                    }}
                  />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>1–20</span>
                </div>
              </div>
            </div>

            {/* Right: notes config */}
            <div className="ln-config">
              {/* Depth */}
              <div className="ln-config-card">
                <div className="config-hdr" style={{ marginBottom: '10px' }}>
                  <span className="config-lbl">Detail Level</span>
                </div>
                <div className="depth-pills">
                  {(['brief', 'standard', 'deep'] as const).map((d) => (
                    <button
                      key={d}
                      className={`depth-pill${lnDepth === d ? ' active' : ''}`}
                      onClick={() => setLnDepth(d)}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div className="ln-config-card">
                <div className="config-hdr" style={{ marginBottom: '10px' }}>
                  <span className="config-lbl">Output Format</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['prose', 'bullets'] as const).map((f) => (
                    <button
                      key={f}
                      className={`depth-pill${lnFormat === f ? ' active' : ''}`}
                      onClick={() => setLnFormat(f)}
                      style={{ flex: 1 }}
                    >
                      {f === 'prose' ? 'Prose' : 'Bullets'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Engine */}
              <div className="ln-config-card">
                <div className="config-hdr" style={{ marginBottom: '10px' }}>
                  <CpuIcon />
                  <span className="config-lbl">Neural Engine</span>
                </div>
                <select
                  className="select-input"
                  value={forceProvider ?? 'auto'}
                  onChange={(e) => setForceProvider(e.target.value === 'auto' ? null : e.target.value)}
                >
                  <option value="auto">AUTO_ROUTE</option>
                  <option value="nvidia">NVIDIA_NIM</option>
                  <option value="groq">GROQ_INFER</option>
                </select>
              </div>

              {/* Generate notes button */}
              <button
                id="ln-generate-btn"
                className={`ln-gen-btn${loading ? ' loading' : ''}`}
                onClick={handleLnGenerate}
                disabled={loading}
              >
                {loading ? (
                  <><span className="spin">⟳</span> Generating…</>
                ) : (
                  <><DocIcon /> Generate Notes</>
                )}
              </button>

              {/* Preview button (shown after generation) */}
              {notesContent && (
                <button
                  className="ghost-btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setShowNotesPreview(true)}
                >
                  <DocIcon /> View Preview
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes Preview Modal */}
      {showNotesPreview && (
        <div className="notes-modal-overlay show" onClick={() => setShowNotesPreview(false)}>
          <div className="notes-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notes-modal-header">
              <span className="ln-preview-title">Lecture Notes Preview</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="ghost-btn" style={{ padding: '5px 12px', fontSize: '10px' }} onClick={() => {
                  const blob = new Blob([notesContent], { type: 'text/plain' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${lnSubject.replace(/\s+/g, '_')}_notes.md`; a.click();
                  showToast('Notes exported as Markdown', 'success');
                }}>
                  Export
                </button>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                  onClick={() => setShowNotesPreview(false)}
                  aria-label="Close"
                >
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={18} height={18}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="ln-preview-body has-content" style={{ padding: '20px 24px', whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '13px' }}>
              {notesContent || <div className="ln-empty"><DocIcon /><span className="ln-empty-text">Notes will appear here after generation</span></div>}
            </div>
          </div>
        </div>
      )}

      {/* Slides Preview Modal (Presenter View) */}
      {showSlidesPreview && slides.length > 0 && (
        <div className="slides-modal-overlay show" onClick={() => setShowSlidesPreview(false)}>
          <div className="slides-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="slides-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="preview-badge" style={{ background: 'var(--accent)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: '800', fontFamily: 'var(--mono)' }}>LIVE_PREVIEW</div>
                <span style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>{result?.title || title}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="modal-primary-btn" 
                  onClick={() => result && downloadPpt(result.token, result.filename)}
                >
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={16} height={16}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Export PPTX
                </button>
                <button
                  style={{ 
                    background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    cursor: 'pointer', 
                    color: 'var(--text-muted)', 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '10px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    transition: '0.2s all'
                  }}
                  onClick={() => setShowSlidesPreview(false)}
                >
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} width={20} height={20}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Presenter View Content */}
            <div className="slides-presenter-view">
              {/* Main Slide Area */}
              <div className="slide-main-canvas">
                <div className="slide-stage">
                  {/* Slide Content */}
                  <div className={`slide-p-content ${theme}`}>
                    <h2 
                      className="slide-p-title"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => updateSlide(currentSlideIdx, { title: e.currentTarget.textContent || '' })}
                    >
                      {slides[currentSlideIdx].title}
                    </h2>
                    <ul className="slide-p-bullets">
                      {slides[currentSlideIdx].content.map((bullet, i) => (
                        <li key={i} className="slide-p-bullet">
                          <div className="bullet-icon" />
                          <span 
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const newContent = [...slides[currentSlideIdx].content];
                              newContent[i] = e.currentTarget.textContent || '';
                              updateSlide(currentSlideIdx, { content: newContent });
                            }}
                          >
                            {bullet}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {slides[currentSlideIdx].code && (
                      <div className="code-block-preview" style={{ marginTop: 'auto' }}>
                        <pre><code>{slides[currentSlideIdx].code}</code></pre>
                        <span className="code-lang-tag">{slides[currentSlideIdx].language}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="slide-p-footer">
                    <div className="slide-p-brand">SKYNET_CORE // {theme.toUpperCase()}</div>
                    <div className="slide-p-num">PG.{currentSlideIdx + 1}</div>
                  </div>
                </div>

                {/* Navigation Overlay - Moved Below Slide */}
                <div className="slide-nav-overlay">
                  <button 
                    className="slide-nav-btn" 
                    style={{ width: '32px', height: '32px' }}
                    onClick={() => setCurrentSlideIdx(i => Math.max(0, i - 1))}
                    disabled={currentSlideIdx === 0}
                  >
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} width={14} height={14}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'white', minWidth: '60px', textAlign: 'center' }}>
                    {currentSlideIdx + 1} / {slides.length}
                  </span>
                  <button 
                    className="slide-nav-btn" 
                    style={{ width: '32px', height: '32px' }}
                    onClick={() => setCurrentSlideIdx(i => Math.min(slides.length - 1, i + 1))}
                    disabled={currentSlideIdx === slides.length - 1}
                  >
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} width={14} height={14}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Speaker Notes Sidebar */}
              <div className="slide-notes-panel">
                <div className="notes-panel-hdr">
                  <div className="notes-panel-lbl">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    SPEAKER_NOTES
                  </div>
                  <button 
                    className="regenerate-btn" 
                    onClick={() => regenerateSlide(currentSlideIdx)}
                    disabled={loading}
                  >
                    {loading ? 'REFINING...' : 'REGENERATE_SLIDE'}
                  </button>
                </div>
                <div className="notes-panel-content">
                  <textarea 
                    className="notes-editor"
                    value={slides[currentSlideIdx].notes || ''}
                    onChange={(e) => updateSlide(currentSlideIdx, { notes: e.target.value })}
                    placeholder="Type speaker notes here..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
