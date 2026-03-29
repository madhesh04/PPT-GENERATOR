import { useState, useRef, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { DottedSurface } from './components/ui/dotted-surface';
import './index.css';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SlideData {
  title: string;
  content: string[];
  notes?: string;
  image_query?: string;
  image_base64?: string | null;
}

interface GenerateResponse {
  title: string;
  slides: SlideData[];
  theme: string;
  token: string;
  filename: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000';

const PROGRESS_STEPS = [
  { label: 'System Check', detail: 'Allocating resources' },
  { label: 'LLM Agent', detail: 'Synthesizing knowledge vectors' },
  { label: 'Image Engine', detail: 'Generating visual assets' },
];

const TONES = [
  { id: 'executive', label: 'Executive', icon: 'workspace_premium', desc: 'Formal, data-heavy, decision-oriented.' },
  { id: 'sales', label: 'Startup Pitch', icon: 'rocket_launch', desc: 'Visionary, fast-paced, high energy.' },
  { id: 'academic', label: 'Educational', icon: 'school', desc: 'Step-by-step, explanatory, clear.' },
  { id: 'simple', label: 'Creative', icon: 'brush', desc: 'Vibrant, bold imagery, minimal text.' },
  { id: 'technical', label: 'Technical', icon: 'biotech', desc: 'Precise, schematic, specification-led.' },
  { id: 'professional', label: 'Inspirational', icon: 'campaign', desc: 'Storytelling, emotional, punchy.' },
];

const THEMES = [
  { id: 'neon', label: 'Neon Noir', activeBg: 'bg-primary-container', activeText: 'text-on-primary-container', border: 'border-transparent' },
  { id: 'ocean', label: 'Oceanic Deep', activeBg: 'bg-[#0066FF]', activeText: 'text-white', border: 'border-transparent' },
  { id: 'emerald', label: 'Emerald Swiss', activeBg: 'bg-[#10B981]', activeText: 'text-white', border: 'border-transparent' },
  { id: 'dark', label: 'Monolith White', activeBg: 'bg-on-background', activeText: 'text-surface-dim', border: 'border-transparent' },
];

const getSlideAccentClass = (index: number) => {
  const colors = ['bg-primary-container', 'bg-tertiary', 'bg-[#8B5CF6]', 'bg-secondary'];
  return colors[index % colors.length];
};
const getSlideTextAccentClass = (index: number) => {
  const colors = ['text-primary-container', 'text-tertiary', 'text-[#8B5CF6]', 'text-secondary'];
  return colors[index % colors.length];
};
const getSlideContainerAccentClass = (index: number) => {
  const colors = ['bg-primary-container', 'bg-tertiary-container', 'bg-[#8B5CF6]/20', 'bg-secondary-container'];
  return colors[index % colors.length];
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SlideCard({ 
  slide, index, 
  onUpdate, onRegenSlide, onRegenImage 
}: { 
  slide: SlideData; index: number; 
  onUpdate: (s: SlideData) => void;
  onRegenSlide: () => void; onRegenImage: () => void;
}) {
  const accent = getSlideAccentClass(index);
  const textAccent = getSlideTextAccentClass(index);
  const containerAccent = getSlideContainerAccentClass(index);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(slide.title);

  const updateBullet = (bi: number, newText: string) => {
    const newContent = [...slide.content]; 
    newContent[bi] = newText;
    onUpdate({ ...slide, content: newContent });
  };

  const handleTitleCommit = () => {
    setEditingTitle(false);
    onUpdate({ ...slide, title: titleVal.trim() || slide.title });
  };

  return (
    <div className="bg-surface-container rounded-xl overflow-hidden relative group transition-expo border border-outline-variant/10 shadow-xl">
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${accent}`}></div>
      <div className="p-8">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 perspective-1000 flex-shrink-0">
            <div className={`cube-3d w-full h-full relative flex items-center justify-center text-white font-label font-bold text-xl shadow-[4px_4px_0_rgba(0,0,0,0.3)] ${containerAccent}`}>
              {String(index + 1).padStart(2, '0')}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input autoFocus className="title-input bg-surface-container-highest px-3 py-1 rounded w-full border border-primary/20" value={titleVal} onChange={e=>setTitleVal(e.target.value)} onBlur={handleTitleCommit} onKeyDown={e => e.key === 'Enter' && handleTitleCommit()} />
            ) : (
              <h3 className="text-3xl font-headline leading-none text-on-surface cursor-pointer hover:opacity-80 transition-opacity truncate" onClick={() => {setTitleVal(slide.title); setEditingTitle(true);}}>
                {slide.title}
              </h3>
            )}
            <p className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest mt-2">{slide.content.length} Data Points</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-4">
            {slide.content.map((point, i) => (
              <EditableBullet key={i} point={point} accentClass={accent} onSave={val => updateBullet(i, val)} />
            ))}
          </div>

          <div className="space-y-4 flex flex-col justify-end">
            <div className="aspect-video bg-surface-container-lowest rounded-lg border border-outline-variant/10 flex items-center justify-center group/img overflow-hidden relative shadow-inner">
              {slide.image_base64 ? (
                <>
                  <img src={slide.image_base64} alt="visual" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover/img:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-surface/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                    <button onClick={onRegenImage} className="bg-surface-container px-4 py-2 rounded-lg font-label text-[10px] uppercase tracking-widest text-on-surface hover:text-primary transition-colors flex items-center gap-2 shadow-lg">
                      <span className="material-symbols-outlined text-sm">refresh</span> New Logic
                    </button>
                  </div>
                </>
              ) : (
                <div className="relative z-10 flex flex-col items-center opacity-60">
                  <span className={`material-symbols-outlined text-4xl mb-2 ${textAccent}`}>broken_image</span>
                  <span className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Awaiting Render</span>
                </div>
              )}
            </div>
            
            <button onClick={onRegenSlide} className="w-full py-2.5 bg-surface-container-high text-on-surface font-label text-[10px] tracking-widest uppercase hover:bg-surface-container-highest transition-expo rounded-lg flex items-center justify-center gap-2 border border-outline-variant/20 hover:border-primary/40">
              <span className="material-symbols-outlined text-sm text-primary">auto_fix_high</span> Re-Synthesize Content
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableBullet({ point, onSave, accentClass }: { point: string; onSave:(v:string)=>void; accentClass: string }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(point);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (edit) ref.current?.focus(); }, [edit]);
  const commit = () => { setEdit(false); onSave(val); };

  if (edit) {
    return (
      <div className="flex items-start gap-3 p-3 bg-surface-container-highest rounded-lg border border-primary/40 shadow-inner">
        <span className={`w-1.5 h-1.5 rounded-full mt-2.5 flex-shrink-0 ${accentClass}`}></span>
        <textarea ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter' && !e.shiftKey){e.preventDefault(); commit();}}}
          className="bg-transparent border-none text-sm text-on-surface leading-relaxed flex-1 outline-none resize-none overflow-hidden h-[80px] font-body" />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 group/edit cursor-text p-2 rounded-lg hover:bg-surface-container-high transition-colors" onClick={() => {setVal(point); setEdit(true);}}>
      <span className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${accentClass}`}></span>
      <p className="text-sm text-on-surface-variant leading-relaxed flex-1">{point}</p>
      <span className="material-symbols-outlined text-[14px] text-on-surface-variant opacity-0 group-hover/edit:opacity-100">edit_square</span>
    </div>
  );
}

// ── Application Root ──────────────────────────────────────────────────────────

export default function App() {
  const [title, setTitle]       = useState('');
  const [topics, setTopics]     = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [numSlides, setNumSlides] = useState(12);
  const [context, setContext]   = useState('');
  const [tone, setTone]         = useState('sales');
  const [theme]       = useState('neon');
  
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<GenerateResponse | null>(null);
  const [slides, setSlides]     = useState<SlideData[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);

  // Loading Step Animation Logic
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setActiveStep(prev => (prev + 1) % PROGRESS_STEPS.length);
      }, 2500); // Shift step every 2.5s
    } else {
      setActiveStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Form Handlers
  const addTopic = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && !topics.includes(trimmed)) setTopics([...topics, trimmed]);
    setTopicInput('');
  };
  const removeTopic = (idx: number) => setTopics(topics.filter((_, i) => i !== idx));

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null); setSlides([]);
    try {
      const resp = await fetch(`${API_BASE}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || 'Untitled', topics, num_slides: numSlides, context, tone, theme }),
      });
      if (!resp.ok) throw new Error((await resp.json()).detail || 'Generation failed');
      const data: GenerateResponse = await resp.json();
      setResult(data);
      setSlides(data.slides);
    } catch (err: any) { setError(err.message); } 
    finally { setLoading(false); }
  };

  const handleExport = async () => {
    if (!result) return;
    setExporting(true);
    try {
      const resp = await fetch(`${API_BASE}/export`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: result.title, slides, theme }),
      });
      if (!resp.ok) throw new Error('Export failed');
      const data = await resp.json();
      handleDownload(data.token, data.filename);
    } catch { alert('Export failed'); } 
    finally { setExporting(false); }
  };

  const handleDownload = async (token = result?.token, filename = result?.filename) => {
    if (!token) return;
    try {
      const dl = await fetch(`${API_BASE}/download/${token}`);
      const blob = await dl.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename || 'presentation.pptx';
      document.body.appendChild(a); a.click(); a.remove();
    } catch { alert('Download failed'); }
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <header className="fixed top-0 w-full z-50 glass-heavy flex justify-between items-center px-8 py-4 border-b border-white/5 shadow-2xl">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
          <span className="material-symbols-outlined text-[#F5533D] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>deployed_code</span>
          <h1 className="text-2xl font-[800] tracking-tighter text-[#F5533D] uppercase font-headline">NEO PPT</h1>
        </div>
        <div className="hidden md:flex gap-8 items-center">
          <nav className="flex gap-6">
            <button onClick={() => setResult(null)} className={`font-bold font-label text-sm tracking-widest uppercase ${!result ? 'text-primary-container border-b-2 border-primary-container' : 'text-on-surface-variant hover:text-white transition-colors'}`}>Create</button>
            <button className={`font-bold font-label text-sm tracking-widest uppercase ${result ? 'text-primary-container border-b-2 border-primary-container' : 'text-on-surface-variant hover:text-white transition-colors'}`}>Results</button>
          </nav>
          {result && (
            <button onClick={handleExport} disabled={exporting} className="bg-primary-container text-white px-6 py-2.5 rounded-xl font-label font-extrabold text-[10px] uppercase tracking-widest hover:bg-[#FC5842] transition-expo flex items-center gap-2 shadow-xl border border-white/10">
              <span className={`material-symbols-outlined text-sm ${exporting ? 'animate-spin' : ''}`} style={{fontVariationSettings: "'FILL' 1"}}>sync</span> Download .pptx
            </button>
          )}
        </div>
      </header>

      <DottedSurface className="opacity-80" />

      <main className={`relative pt-32 pb-24 mx-auto min-h-screen ${result ? 'px-8 max-w-[1400px]' : 'px-6 max-w-5xl'}`}>
        
        {/* FORM STATE */}
        {!result && !loading && (
          <div className="animate-fade-in">
            <section className="mb-16 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="max-w-2xl">
                <h2 className="font-headline text-5xl md:text-7xl font-extrabold tracking-tighter leading-[0.9] text-white mb-6 text-glow">
                  Turn ideas into <span className="text-primary-container drop-shadow-md">[polished decks_]</span>
                </h2>
                <p className="text-on-surface-variant text-lg font-medium max-w-lg drop-shadow-md">
                  The Kinetic Curator uses high-performance AI to transform raw concepts into executive-ready presentations in seconds.
                </p>
              </div>
              <div className="hidden lg:block">
                <div className="glass-pill px-5 py-2.5 rounded-xl flex items-center gap-4 border border-emerald-500/20 bg-emerald-500/5 shadow-2xl">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_12px_#10B981]"></span>
                  </span>
                  <span className="font-label text-[10px] tracking-widest uppercase text-emerald-400 font-extrabold">AI ENGINE LIVE_</span>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <form className="lg:col-span-8 space-y-12" onSubmit={handleGenerate}>
                <div className="relative glass-card p-10 rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                  <div className="signature-bar bg-primary-container"></div>
                  <label className="font-label text-xs font-black text-primary-container tracking-[0.2em] uppercase mb-4 block opacity-70">01 / PRESENTATION TITLE</label>
                  <input type="text" value={title} onChange={e=>setTitle(e.target.value)} required placeholder="e.g. Q4 Strategic Growth Roadmap"
                    className="w-full bg-transparent border-0 border-b-2 border-white/20 focus:border-primary-container text-3xl font-body py-4 text-white outline-none transition-all placeholder:text-white/10" />
                </div>

                <div className="relative glass-card p-10 rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                  <div className="signature-bar bg-secondary"></div>
                  <label className="font-label text-xs font-black text-secondary tracking-[0.2em] uppercase mb-6 block opacity-70">02 / CORE CONCEPTS</label>
                  <div className="flex flex-wrap gap-3 mb-4">
                    {topics.map((t, idx) => (
                      <div key={idx} className="glass-pill text-secondary px-4 py-2 rounded-xl flex items-center gap-3 text-sm border border-white/10">
                        {t} <span className="material-symbols-outlined text-xs cursor-pointer opacity-50 hover:opacity-100" onClick={()=>removeTopic(idx)}>close</span>
                      </div>
                    ))}
                    <input type="text" value={topicInput} onChange={e=>setTopicInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault(); addTopic(topicInput);}}}
                      className="bg-white/5 border border-white/5 focus:border-secondary px-4 py-2 rounded-xl text-sm outline-none" placeholder="+ Add Node" />
                  </div>
                </div>

                <div className="relative glass-card p-10 rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                  <div className="signature-bar bg-tertiary"></div>
                  <label className="font-label text-xs font-black text-tertiary tracking-[0.2em] uppercase mb-8 block opacity-70">03 / TONE & AUDIENCE</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                    {TONES.map(t => (
                      <button key={t.id} type="button" onClick={()=>setTone(t.id)} className={`p-5 rounded-2xl text-left border transition-all ${tone === t.id ? 'bg-tertiary/10 border-tertiary shadow-xl scale-[1.02]' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                        <span className="material-symbols-outlined mb-2 block text-tertiary" style={{fontVariationSettings: tone === t.id ? "'FILL' 1" : "'FILL' 0"}}>{t.icon}</span>
                        <div className="font-bold text-sm text-white">{t.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative glass-card p-10 rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                  <div className="signature-bar bg-primary-container"></div>
                  <div className="flex justify-between items-center mb-10">
                    <label className="font-label text-xs font-black text-primary-container tracking-[0.2em] uppercase opacity-70">04 / SEQUENCE DEPTH</label>
                    <span className="bg-primary-container text-white font-headline px-4 py-1 rounded shadow-lg">{numSlides} SLIDES</span>
                  </div>
                  <input type="range" min="5" max="15" value={numSlides} onChange={e=>setNumSlides(Number(e.target.value))} className="w-full h-1 bg-white/10 cursor-pointer accent-primary-container" />
                </div>

                <button type="submit" disabled={!title || topics.length === 0} className="w-full bg-gradient-to-r from-primary-container to-[#B52515] text-white py-8 rounded-2xl font-headline text-2xl tracking-[0.3em] uppercase shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-30 disabled:grayscale">
                  ✦ Generate presentation 
                </button>
              </form>

              <aside className="lg:col-span-4 space-y-8">
                <div className="glass-card p-10 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
                   <div className="signature-bar bg-primary/40"></div>
                   <h3 className="font-label text-xs font-black text-primary-container tracking-widest uppercase mb-6 drop-shadow-lg">NEO_INTELLIGENCE</h3>
                   <div onClick={()=>setIsContextModalOpen(true)} className="flex items-center gap-5 p-6 glass-pill border-[#f5533d]/30 bg-[#f5533d]/5 hover:bg-[#f5533d]/10 cursor-pointer transition-all rounded-2xl group">
                      <span className="material-symbols-outlined text-[#f5533d] group-hover:scale-110 transition-transform" style={{fontVariationSettings: "'FILL' 1"}}>auto_awesome</span>
                      <div>
                        <div className="text-xs font-black text-white uppercase tracking-wider mb-1">Context Injection Available</div>
                        <div className="text-[11px] text-white/60 font-medium group-hover:text-white transition-colors leading-tight">Click to provide reference data &rarr;</div>
                      </div>
                   </div>
                </div>
              </aside>
            </div>
            {error && <div className="mt-8 p-6 glass-card border border-primary-container/20 rounded-2xl text-primary-container font-label text-xs tracking-widest uppercase">ERROR_LOG // {error}</div>}
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in text-center">
            <div className="w-32 h-32 border-4 border-primary-container border-r-transparent rounded-full animate-spin mb-10 shadow-[0_0_80px_rgba(245,83,61,0.2)]"></div>
            <h2 className="text-4xl md:text-5xl font-headline tracking-widest text-white uppercase mb-4 animate-pulse">Compiling Intelligence...</h2>
            <div className="mt-12 flex flex-col gap-6 w-full max-w-sm">
               {PROGRESS_STEPS.map((s, i) => (
                 <div key={i} className={`flex items-center gap-6 transition-expo ${i === activeStep ? 'text-primary-container' : 'opacity-40 text-on-surface-variant'}`}>
                   <span className={`material-symbols-outlined text-3xl ${i === activeStep ? 'animate-spin' : ''}`}>
                     {i === activeStep ? 'sync' : 'apps'}
                   </span>
                   <div className="text-left">
                     <div className="font-label text-xs uppercase tracking-[0.2em] font-black">{s.label}</div>
                     <div className="font-body text-[10px] opacity-70 mt-1 uppercase tracking-widest">{s.detail}</div>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* RESULTS STATE */}
        {result && !loading && (
          <div className="animate-fade-in px-4">
            {/* Metric Strip */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-20">
              <div className="bg-surface-container p-6 rounded-xl relative overflow-hidden group hover:bg-surface-container-high transition-expo border border-outline-variant/10">
                <div className="flex flex-col">
                  <span className="text-on-surface-variant text-xs font-label uppercase tracking-widest mb-1">Session Data Transferred</span>
                  <h3 className="text-3xl font-headline text-on-surface text-primary-container">1,402 kb</h3>
                </div>
                <div className="absolute bottom-0 left-0 h-1 bg-primary-container w-2/3"></div>
              </div>
              <div className="bg-surface-container p-6 rounded-xl relative overflow-hidden group hover:bg-surface-container-high transition-expo border border-outline-variant/10">
                <div className="flex flex-col">
                  <span className="text-on-surface-variant text-xs font-label uppercase tracking-widest mb-1">Bullet Points Extracted</span>
                  <h3 className="text-3xl font-headline text-on-surface text-tertiary">{slides.reduce((acc, curr) => acc + curr.content.length, 0)}</h3>
                </div>
                <div className="absolute bottom-0 left-0 h-1 bg-tertiary w-full"></div>
              </div>
              <div className="bg-surface-container p-6 rounded-xl relative overflow-hidden group hover:bg-surface-container-high transition-expo border border-outline-variant/10">
                <div className="flex flex-col">
                  <span className="text-on-surface-variant text-xs font-label uppercase tracking-widest mb-1">Slides Generated</span>
                  <h3 className="text-3xl font-headline text-on-surface text-[#8B5CF6]">{slides.length}</h3>
                </div>
                <div className="absolute bottom-0 left-0 h-1 bg-[#8B5CF6] w-[100%]"></div>
              </div>
              <div className="bg-surface-container p-6 rounded-xl relative overflow-hidden group hover:bg-surface-container-high transition-expo border border-outline-variant/10">
                <div className="flex flex-col">
                  <span className="text-on-surface-variant text-xs font-label uppercase tracking-widest mb-1">Visual Theme Paradigm</span>
                  <h3 className="text-3xl font-headline text-on-surface text-secondary truncate">{THEMES.find(t=>t.id===result.theme)?.label || 'Neon Noir'}</h3>
                </div>
                <div className="absolute bottom-0 left-0 h-1 bg-secondary w-1/2"></div>
              </div>
            </section>

            {/* DOWNLOAD UI */}
            <section className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-20 px-4">
               <div>
                  <h2 className="text-6xl font-headline tracking-tighter text-white mb-3">Ready</h2>
                  <p className="text-on-surface-variant font-label text-sm uppercase tracking-widest">Presentation architecture complete. Direct download available now.</p>
               </div>
               <div className="flex gap-4">
                  <button onClick={() => handleDownload()} className="px-10 py-5 bg-surface-container-high text-on-surface font-label text-[10px] tracking-[0.3em] uppercase hover:bg-surface-container-highest transition-expo rounded-2xl shadow-2xl border border-white/5 flex items-center gap-3">
                    <span className="material-symbols-outlined text-xl">download</span> File
                  </button>
                  <button onClick={handleExport} disabled={exporting} className="px-10 py-5 bg-primary-container text-white font-headline text-xs tracking-[0.3em] uppercase hover:bg-[#FC5842] transition-expo rounded-2xl shadow-[0_20px_40px_rgba(245,83,61,0.2)] disabled:opacity-50 flex items-center gap-3">
                    <span className={`material-symbols-outlined text-xl ${exporting ? 'animate-spin' : ''}`} style={{fontVariationSettings: "'FILL' 1"}}>sync</span> Sync & Save
                  </button>
               </div>
            </section>

            {/* EDIT SECTION */}
            <section className="mb-40">
               <div className="flex items-center gap-6 mb-16 px-4">
                  <h2 className="text-3xl font-headline tracking-tighter text-white uppercase px-4 border-l-4 border-primary-container">Data Manipulation Layer</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {slides.map((slide, i) => (
                    <SlideCard key={i} slide={slide} index={i}
                      onUpdate={newS => setSlides(prev => prev.map((s, idx)=>idx===i?newS:s))}
                      onRegenSlide={async () => {
                        const r = await fetch(`${API_BASE}/regenerate-slide`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title: result.title, context, tone, existing_titles: slides.map(s=>s.title) })});
                        if (r.ok){ const n = await r.json(); setSlides(p=>p.map((s, idx)=>idx===i?n:s)); }
                      }}
                      onRegenImage={async () => {
                        const r = await fetch(`${API_BASE}/regenerate-image`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ query: slide.image_query || slide.title })});
                        if(r.ok){ const {image_base64} = await r.json(); setSlides(p=>p.map((s, idx)=>idx===i?{...s, image_base64}:s)); }
                      }}
                    />
                  ))}
               </div>
            </section>
          </div>
        )}
      </main>

      {/* FIXED FOOTER */}
      <footer className="fixed bottom-0 w-full h-[40px] glass-heavy flex items-center justify-between px-8 z-50 border-t border-white/5 animate-footer-scan">
         <div className="flex items-center gap-6 text-[#c24535] font-label text-[11px] tracking-[0.3em] uppercase font-black">
            <div className="flex items-center gap-2"><span className="animate-pulse">●</span> GROQ_LLAMA3_OK</div>
            <div className="flex items-center gap-2 opacity-60 outline-none">● MODEL: LLAMA 3.3 70B</div>
            <div className="flex items-center gap-2 opacity-40">● KINETIC_CURATOR_V4.3</div>
         </div>
         <div className="text-white/40 font-label text-[11px] tracking-[0.3em] uppercase">SYSTEM_TIME // <span className="text-white">LIVE</span></div>
      </footer>

      {/* MODAL */}
      {isContextModalOpen && (
        <ContextModal 
          isOpen={isContextModalOpen} 
          currentValue={context} 
          onClose={()=>setIsContextModalOpen(false)} 
          onSave={v=>{setContext(v); setIsContextModalOpen(false);}} 
        />
      )}
    </ThemeProvider>
  );
}

function ContextModal({ isOpen, currentValue, onClose, onSave }: { isOpen: boolean; currentValue: string; onClose:()=>void; onSave:(v:string)=>void; }) {
  const [text, setText] = useState(currentValue);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await fetch(`${API_BASE}/upload-context`, { method:'POST', body:fd });
      const d = await r.json();
      setText(p => (p ? p + "\n" + d.text : d.text));
    } catch { alert("Extraction failed"); } 
    finally { setUploading(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fade-in">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl glass-card rounded-[40px] overflow-hidden animate-zoom-in border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)]">
        <div className="signature-bar bg-primary-container h-full w-[6px]"></div>
        <div className="p-12">
           <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-3xl font-headline tracking-tighter text-white uppercase mb-1">Knowledge Injection</h2>
                <p className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest opacity-60">Architect Ground Truth vectors</p>
              </div>
              <button onClick={onClose} className="w-12 h-12 rounded-full hover:bg-white/10 flex items-center justify-center transition-all"><span className="material-symbols-outlined text-white/30">close</span></button>
           </div>
           
           <div className="space-y-8">
              <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Paste raw intel here..." className="w-full h-64 bg-white/5 rounded-2xl p-8 text-white font-body text-sm outline-none border border-white/5 focus:border-primary-container transition-all resize-none shadow-inner" />
              
              <div onClick={()=>inputRef.current?.click()} className="group border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all">
                 <input type="file" ref={inputRef} className="hidden" accept=".txt,.pdf,.docx" onChange={e=>e.target.files?.[0] && handleUpload(e.target.files[0])} />
                 <span className={`material-symbols-outlined text-5xl ${uploading ? 'animate-spin text-emerald-400' : 'text-white/20 group-hover:text-emerald-400'}`}>{uploading ? 'sync' : 'cloud_upload'}</span>
                 <div className="text-center"><p className="text-xs font-black text-white uppercase tracking-widest group-hover:text-emerald-400">Upload Knowledge Source</p></div>
              </div>

              <div className="flex gap-4 pt-4">
                 <button onClick={onClose} className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white font-label text-[10px] uppercase tracking-widest rounded-2xl transition-all border border-white/5">Abort</button>
                 <button onClick={()=>onSave(text)} className="flex-1 py-5 bg-primary-container text-white font-headline text-lg uppercase tracking-widest rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">Inject Intel_</button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
