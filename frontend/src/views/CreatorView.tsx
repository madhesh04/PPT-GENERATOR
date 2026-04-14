import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePresentationStore } from '../store/usePresentationStore';
import { useAppStore } from '../store/useAppStore';

export default function CreatorView() {
  const {
    title, setTitle,
    topics, setTopics,
    context, setContext,
    tone, setTone,
    theme, setTheme,
    numSlides, setNumSlides,
    forceProvider, setForceProvider,
    loading, errorMsg, genSteps,
    generatePresentation
  } = usePresentationStore();

  const { showToast } = useAppStore();
  const [topicIn, setTopicIn] = useState('');
  const navigate = useNavigate();

  const handleStartGeneration = async () => {
    if (!title) {
       showToast('Validation Error: Title is required');
       return;
    }
    await generatePresentation(() => {
      showToast('SUCCESS — Deck ready · Navigating to preview…', 2500);
      setTimeout(() => {
        navigate('/preview');
      }, 1400);
    });
  };

  const pPct = genSteps.filter(s => s.status === 'done').length * 25 + (genSteps.find(s => s.status === 'active') ? 12 : 0);

  const tones = [
    { id: 'professional', label: 'PROFESSIONAL' },
    { id: 'executive', label: 'EXECUTIVE' },
    { id: 'technical', label: 'TECHNICAL' },
    { id: 'academic', label: 'ACADEMIC' },
    { id: 'sales', label: 'SALES' },
    { id: 'simple', label: 'MINIMALIST' }
  ];

  const themes = [
    { id: 'neon', label: 'SKYNET_CORE', color: '#2563EB' },
    { id: 'ocean', label: 'OCEANIC', color: '#3b82f6' },
    { id: 'emerald', label: 'EMERALD', color: '#00ff9d' },
    { id: 'royal', label: 'ROYAL_SYS', color: '#a855f7' },
    { id: 'light', label: 'NEO_LIGHT', color: '#e8f4ff' }
  ];

  const providers = [
    { id: null, label: 'AUTO_ROUTE', icon: 'smart_toy', desc: 'Auto-select model' },
    { id: 'nvidia', label: 'NVIDIA_NIM', icon: 'temp_preferences_custom', desc: 'Force Kimi K2.5' },
    { id: 'groq', label: 'GROQ_INFER', icon: 'cloud_done', desc: 'Force LLaMA 3.3' }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in w-full pb-12">
      <header className="mb-8 flex items-center gap-3">
        <span className="material-symbols-outlined text-[#2563EB] text-3xl">add_box</span>
        <div>
          <h1 className="text-[18px] font-extrabold text-white tracking-[-0.5px]">Generation Engine</h1>
          <p className="text-[11px] font-extrabold text-[#475569] mt-1 uppercase tracking-widest">Configure Presentation Parameters</p>
        </div>
      </header>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex gap-3 items-center shadow-sm">
          <span className="material-symbols-outlined">error</span>
          <span className="text-[13px] font-medium tracking-wide">{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Inputs */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-[#0F1118] border border-white/[0.06] p-6 md:p-8 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-[10px] text-[#475569] font-extrabold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span className="text-[#2563EB]">01 //</span> Presentation Title
                </label>
                <div className="relative">
                  <div className="absolute top-3.5 left-4 text-gray-500 font-bold opacity-50 text-sm">T </div>
                  <input 
                    className="w-full bg-[#13161F] border border-white/5 focus:border-[#2563EB]/50 text-gray-200 text-[16px] p-3.5 pl-12 rounded-xl transition-all outline-none shadow-inner" 
                    placeholder="e.g. System Integration Report Q3"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Context */}
              <div>
                <label className="block text-[10px] text-[#475569] font-extrabold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span className="text-[#2563EB]">02 //</span> Primary Context Data
                </label>
                <div className="relative">
                  <div className="absolute top-3.5 left-4 text-gray-500 font-bold opacity-50 text-[18px] material-symbols-outlined">description</div>
                  <textarea 
                    className="w-full bg-[#13161F] border border-white/5 focus:border-[#2563EB]/50 text-gray-200 text-[16px] p-3.5 pl-12 rounded-xl resize-none transition-all outline-none shadow-inner leading-relaxed" 
                    placeholder="Enter the presentation core objective or data set..." 
                    rows={5}
                    value={context}
                    onChange={e => setContext(e.target.value)}
                    disabled={loading}
                  ></textarea>
                </div>
              </div>

              {/* Topics */}
              <div>
                <label className="flex justify-between items-end block text-[10px] text-[#475569] font-extrabold uppercase tracking-widest mb-2">
                  <span className="flex items-center gap-1.5"><span className="text-[#2563EB]">03 //</span> Key Topics</span>
                  <span className="text-[9px] text-gray-600 font-normal">Press Enter to add</span>
                </label>
                <div 
                  className={`w-full min-h-[52px] bg-[#13161F] border border-white/5 rounded-xl flex items-center flex-wrap gap-2 p-2 transition-all cursor-text shadow-inner ${loading ? 'opacity-50' : 'focus-within:border-[#2563EB]/50'}`}
                  onClick={() => document.getElementById('ti_id')?.focus()}
                >
                  {topics.map((t, idx) => (
                    <span key={idx} className="bg-blue-500/10 text-[#60A5FA] border border-[#2563EB]/20 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase flex items-center gap-1.5 shadow-sm">
                      {t} 
                      <button className="hover:text-red-400 hover:bg-white/5 rounded-full p-0.5" onClick={(e) => { e.stopPropagation(); setTopics(topics.filter((_, i) => i !== idx)); }}>
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </span>
                  ))}
                  <input 
                    id="ti_id" 
                    className="flex-1 bg-transparent border-none text-gray-200 text-[16px] outline-none px-2 min-w-[120px] placeholder-gray-600" 
                    placeholder={topics.length === 0 ? "Type a topic..." : ""}
                    value={topicIn}
                    disabled={loading}
                    onChange={e => setTopicIn(e.target.value)}
                    onBlur={() => { if (topicIn.trim() && !topics.includes(topicIn.trim())) { setTopics([...topics, topicIn.trim()]); setTopicIn(''); } }}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',') && topicIn.trim()) { e.preventDefault(); if (!topics.includes(topicIn.trim())) setTopics([...topics, topicIn.trim()]); setTopicIn(''); }
                      else if (e.key === 'Backspace' && !topicIn && topics.length) { setTopics(topics.slice(0, -1)); }
                    }}
                  />
                </div>
              </div>

              {/* Slides */}
              <div>
                <label className="block text-[10px] text-[#475569] font-extrabold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span className="text-[#2563EB]">04 //</span> Slide Count Override
                </label>
                <div className="flex items-center gap-4 bg-[#13161F] p-2 rounded-xl border border-white/5 shadow-inner">
                  <input 
                    className="w-16 bg-white/5 border border-white/5 focus:border-[#2563EB]/50 text-[#60A5FA] font-extrabold text-center p-2 rounded-lg outline-none text-[16px] font-mono" 
                    type="number" 
                    value={numSlides}
                    onChange={e => setNumSlides(parseInt(e.target.value) || 10)}
                    disabled={loading}
                    min={2}
                    max={20}
                  />
                  <input 
                    type="range" 
                    className="flex-1 accent-blue-500 h-1.5 bg-gray-800 rounded-full cursor-pointer appearance-none mr-4" 
                    disabled={loading} 
                    min="2" max="20" value={numSlides} step="1" 
                    onChange={e => setNumSlides(parseInt(e.target.value))} 
                  />
                </div>
              </div>
            </div>
          </div>
          
          <button 
            disabled={loading}
            onClick={handleStartGeneration}
            className="w-full relative overflow-hidden bg-[#2563EB] text-white rounded-xl py-4 px-8 font-bold tracking-widest text-sm transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_15px_-3px_rgba(37,99,235,0.4)] group"
          >
            <div className="flex items-center justify-center gap-3 relative z-10">
              <span className={`material-symbols-outlined ${loading ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`}>
                {loading ? 'sync' : 'bolt'}
              </span>
              <span>{loading ? 'GENERATING PROTOCOL...' : 'INITIATE GENERATION'}</span>
            </div>
            {loading && <div className="absolute top-0 left-0 h-full bg-blue-400/20" style={{ width: `${pPct}%`, transition: 'width 0.3s ease' }}></div>}
          </button>

          {loading && (
            <div className="space-y-3 bg-[#0F1118] border border-white/[0.06] p-5 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
              <div className="flex justify-between items-center px-1 border-b border-white/5 pb-2 mb-3">
                <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                  System Log
                </span>
                <span className="text-[11px] text-[#60A5FA] font-bold">{Math.round(pPct)}%</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {genSteps.map(s => (
                  <div key={s.id} className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${s.status === 'done' ? 'bg-emerald-500/5' : s.status === 'active' ? 'bg-blue-500/10' : 'opacity-40'}`}>
                    {s.status === 'done' ? (
                      <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>
                    ) : s.status === 'active' ? (
                      <span className="material-symbols-outlined text-[#60A5FA] text-[18px] animate-spin">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-gray-500 text-[18px]">radio_button_unchecked</span>
                    )}
                    <div className="flex flex-col">
                      <span className={`text-[11px] font-bold tracking-widest uppercase ${s.status === 'done' ? 'text-emerald-400' : s.status === 'active' ? 'text-[#60A5FA]' : 'text-gray-500'}`}>{s.label}</span>
                      <span className={`text-[10px] mt-0.5 ${s.status === 'active' ? 'text-blue-300/70' : 'text-gray-500'}`}>{s.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Settings */}
        <section className="lg:col-span-5 space-y-6">
          <div className="bg-[#0F1118] border border-white/[0.06] p-6 md:p-8 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)] space-y-8">
            
            {/* Tone Matrix */}
            <div>
              <h3 className="text-[10px] font-extrabold text-[#475569] tracking-widest uppercase mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-purple-400">record_voice_over</span> Tone Matrix
              </h3>
              <div className="flex flex-wrap gap-2">
                {tones.map(t => (
                  <button 
                    key={t.id}
                    disabled={loading}
                    onClick={() => setTone(t.id)}
                    className={`px-4 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all ${
                      tone === t.id 
                      ? 'bg-[#2563EB] text-white shadow-[0_2px_10px_rgba(37,99,235,0.3)]' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full h-[1px] bg-white/5"></div>

            {/* Visual Theme */}
            <div>
              <h3 className="text-[10px] font-extrabold text-[#475569] tracking-widest uppercase mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">palette</span> Visual Theme
              </h3>
              <div className="flex flex-col gap-2">
                {themes.map(thm => (
                  <button 
                    key={thm.id}
                    disabled={loading}
                    onClick={() => setTheme(thm.id)}
                    className={`px-4 py-3 rounded-xl text-[11px] font-bold tracking-widest transition-all flex items-center justify-between ${
                      theme === thm.id 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: thm.color, boxShadow: theme === thm.id ? `0 0 10px ${thm.color}` : 'none' }}></div>
                      {thm.label}
                    </div>
                    {theme === thm.id && <span className="material-symbols-outlined text-[16px]">check</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full h-[1px] bg-white/5"></div>

            {/* AI Provider */}
            <div>
              <h3 className="text-[10px] font-extrabold text-[#475569] tracking-widest uppercase mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#60A5FA]">psychology</span> Neural Engine
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {providers.map(p => (
                  <div 
                    key={p.id === null ? 'auto' : p.id}
                    onClick={() => { if (!loading) setForceProvider(p.id) }}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      forceProvider === p.id 
                      ? 'bg-[#2563EB]/10 border-[#2563EB]/30 text-[#60A5FA]' 
                      : 'bg-white/5 border-transparent hover:bg-white/10 text-gray-400 hover:text-white'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${forceProvider === p.id ? 'bg-blue-500/20 text-[#60A5FA]' : 'bg-black/20 text-gray-500'}`}>
                        <span className="material-symbols-outlined text-[18px]">{p.icon}</span>
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-[11px] font-bold tracking-widest uppercase">{p.label}</span>
                        <span className={`text-[10px] ${forceProvider === p.id ? 'text-blue-300/70' : 'text-gray-500'}`}>{p.desc}</span>
                      </div>
                    </div>
                    {forceProvider === p.id && <span className="material-symbols-outlined text-[18px] text-[#2563EB]">radio_button_checked</span>}
                    {forceProvider !== p.id && <span className="material-symbols-outlined text-[18px] text-gray-600">radio_button_unchecked</span>}
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        </section>
      </div>
    </div>
  );
}
