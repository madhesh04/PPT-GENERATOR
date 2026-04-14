import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePresentationStore } from '../store/usePresentationStore';
import { useAppStore } from '../store/useAppStore';
import { presentationApi } from '../api/presentation';
import apiClient from '../api/apiClient';

export default function PreviewView() {
  const { result, slides, setSlides, theme, resetCreation } = usePresentationStore();
  const { showToast } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);
  const navigate = useNavigate();

  if (!result || slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-in px-6 text-center">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-2">
          <span className="material-symbols-outlined text-gray-500 text-4xl">folder_off</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Active Deck Not Found</h2>
          <p className="text-gray-400 text-sm max-w-xs mx-auto">Please initiate a generation protocol from the creation hub first.</p>
        </div>
        <button 
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8 py-3 rounded-xl font-bold text-[11px] tracking-widest uppercase transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
          onClick={() => navigate('/create')}
        >
          <span className="material-symbols-outlined text-sm">bolt</span>
          Creation Flight Deck
        </button>
      </div>
    );
  }

  const handleDownload = async (dlToken?: string, filename?: string) => {
    setIsExporting(true);
    showToast('SKYNET // Streaming PPTX Binary...');
    const t = dlToken || result?.token;
    const f = filename || result?.filename || 'presentation.pptx';
    if (!t) {
       setIsExporting(false);
       return;
    }
    try {
      const blob = await presentationApi.downloadPresentation(t);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('DOWNLOAD_SUCCESS · Ready for Deployment', 3000);
      
      // Auto-redirect to dashboard after short delay
      setTimeout(() => {
        resetCreation();
        navigate('/');
      }, 1500);
    } catch {
      showToast('CRITICAL_ERROR // Download interrupted');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    showToast('SKYNET // Synthesizing PDF Layer...');
    try {
      const blob = await presentationApi.exportPdf({ title: result.title, slides, theme });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('PDF_EXPORT_SUCCESS');

      // Auto-redirect to dashboard after short delay
      setTimeout(() => {
        resetCreation();
        navigate('/');
      }, 1500);
    } catch {
      showToast('CRITICAL_ERROR // PDF synthesis failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRebuildExport = async () => {
    setIsExporting(true);
    showToast('SKYNET // Re-encoding latest edits...', 4000);
    try {
      const data = await presentationApi.exportPresentation({ title: result.title, slides, theme });
      await handleDownload(data.token, data.filename);
    } catch {
      showToast('CRITICAL_ERROR // Rebuild failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleTitleChange = (idx: number, val: string) => {
    const newSlides = [...slides];
    newSlides[idx].title = val;
    setSlides(newSlides);
  };

  const handleBulletChange = (sIdx: number, bIdx: number, val: string) => {
    const newSlides = [...slides];
    newSlides[sIdx].content[bIdx] = val;
    setSlides(newSlides);
  };

  const handleRegenImage = async (idx: number) => {
    const slide = slides[idx];
    showToast(`REGEN // Querying image database for slide ${idx + 1}...`);
    try {
      const response = await apiClient.post('/regenerate-image', {
        query: slide.image_query || slide.title
      });
      const { image_base64 } = response.data;
      const newSlides = [...slides];
      newSlides[idx].image_base64 = image_base64;
      setSlides(newSlides);
      showToast('SUCCESS // Visual element updated');
    } catch {
      showToast('ERROR // Image synthesis rejected');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in w-full pb-20 px-4 mt-0">
      
      {/* Action Header */}
      <div className="bg-[#0F1118] border border-white/[0.06] p-6 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] sticky top-0 z-50 flex flex-col md:flex-row items-center justify-between gap-6 transition-all">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-12 h-12 bg-[#2563EB]/10 rounded-xl flex items-center justify-center border border-[#2563EB]/20 text-[#2563EB]">
            <span className="material-symbols-outlined text-2xl">visibility</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-extrabold tracking-[-0.5px] text-white truncate pr-4">{result.title}</h1>
            <div className="flex items-center gap-3 mt-1.5 overflow-x-auto no-scrollbar whitespace-nowrap">
              <span className="text-[10px] text-[#475569] font-extrabold tracking-widest uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5 font-sans">
                {slides.length} SLIDES · {theme.toUpperCase()} THEME
              </span>
              {result.provider && (
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-bold tracking-wider ${
                  result.provider === 'nvidia_nim' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-blue-500/10 border-[#2563EB]/20 text-[#60A5FA]'
                }`}>
                  <span className="material-symbols-outlined text-[12px]">
                    {result.provider === 'nvidia_nim' ? 'psychology' : 'bolt'}
                  </span>
                  {result.provider === 'nvidia_nim' ? 'NVIDIA NIM' : 'GROQ INFER'} · {result.model_used?.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-white/5 overflow-x-auto no-scrollbar">
          <button 
            disabled={isExporting}
            onClick={handleExportPdf}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all border border-white/5"
          >
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span> PDF
          </button>
          <button 
            disabled={isExporting}
            onClick={() => handleDownload()}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all border border-white/5"
          >
            <span className="material-symbols-outlined text-sm">download</span> PPTX
          </button>
          <button 
            disabled={isExporting}
            onClick={handleRebuildExport}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#2563EB]/90 hover:bg-[#2563EB] text-white px-5 py-2.5 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all shadow-lg shadow-blue-500/20"
          >
            <span className="material-symbols-outlined text-sm">{isExporting ? 'sync' : 'publish'}</span>
            {isExporting ? 'ENCODING...' : 'FINALIZE_DECK'}
          </button>
        </div>
      </div>

      {/* Slide Navigator strip */}
      <div className="bg-[#0F1118] rounded-xl border border-white/[0.06] p-4 overflow-x-auto scroller-hide shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex gap-4 min-h-[140px] items-center">
        {slides.map((s, idx) => (
          <div 
            key={idx} 
            className="flex-shrink-0 w-44 group cursor-pointer"
            onClick={() => document.getElementById(`slide-card-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            <div className="relative aspect-video rounded-lg border-2 border-transparent transition-all hover:bg-white/5 p-2 flex flex-col justify-between overflow-hidden">
               <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <div className="relative z-10">
                 <div className="h-1.5 w-12 rounded-full mb-1" style={{ background: ['#00f0ff', '#ff6b35', '#00ff9d', '#a855f7'][idx % 4] }}></div>
                 <div className="h-1 w-2/3 bg-white/5 rounded-full mb-1"></div>
                 <div className="h-1 w-1/2 bg-white/5 rounded-full"></div>
               </div>
               {s.image_base64 && (
                 <img src={s.image_base64} className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-40 transition-opacity" />
               )}
               <div className="relative z-10 flex justify-end">
                 <span className="text-[10px] font-mono text-gray-600 font-bold group-hover:text-[#2563EB] transition-colors uppercase tracking-widest">
                   CH-{String(idx + 1).padStart(2, '0')}
                 </span>
               </div>
            </div>
            <div className="mt-2 text-[10px] text-gray-500 font-bold uppercase truncate px-1 text-center group-hover:text-white transition-colors">
              {s.title}
            </div>
          </div>
        ))}
      </div>

      {/* Slide Editing Cards */}
      <div className="grid grid-cols-1 gap-12">
        {slides.map((slide, idx) => {
          const accentColor = ['#00f0ff', '#ff6b35', '#00ff9d', '#a855f7'][idx % 4];
          return (
            <div key={idx} id={`slide-card-${idx}`} className="group relative">
               {/* Decorative bracket */}
               <div className="absolute -left-4 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-blue-500/20 to-transparent"></div>
               <div className="absolute -left-4 top-0 w-4 h-[1px] bg-blue-500/30"></div>
               
               <div className="bg-[#0F1118] border border-white/[0.06] rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all hover:border-white/20">
                  <div className="flex flex-col lg:flex-row">
                    
                    {/* Visual Area */}
                    <div className="lg:w-1/3 bg-black/40 relative min-h-[220px] flex items-center justify-center border-b lg:border-b-0 lg:border-r border-white/5 group/img">
                        {slide.image_base64 ? (
                          <div className="absolute inset-0">
                            <img src={slide.image_base64} className="w-full h-full object-cover opacity-60 group-hover/img:scale-105 transition-transform duration-700" alt="Slide Visual" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20"></div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3 opacity-30 group-hover/img:opacity-50 transition-opacity text-gray-500">
                             <span className="material-symbols-outlined text-4xl">image</span>
                             <span className="text-[10px] font-bold tracking-[0.2em] font-mono uppercase">NO_VISUAL_ASSET</span>
                          </div>
                        )}
                        <button 
                          onClick={() => handleRegenImage(idx)}
                          className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 text-white flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] font-bold tracking-[0.2em] uppercase transition-all hover:bg-[#2563EB] hover:border-[#2563EB] invisible group-hover/img:visible animate-scale-in"
                        >
                          <span className="material-symbols-outlined text-xs">refresh</span>
                          Regenerate Asset
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="lg:w-2/3 p-6 md:p-8 space-y-6">
                       <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                             <div className="flex items-center gap-4 mb-3">
                                <span className="text-[10px] font-mono font-bold text-gray-600 tracking-tighter">SLIDE_ST.{String(idx+1).padStart(2,'0')}</span>
                                <div className="h-[1px] flex-1 bg-white/5"></div>
                             </div>
                             <input 
                                className="w-full bg-transparent border-none text-[18px] tracking-[-0.5px] font-extrabold text-white outline-none focus:ring-0 placeholder-white/20 p-0"
                                value={slide.title}
                                onChange={e => handleTitleChange(idx, e.target.value)}
                                placeholder="Enter Slide Title"
                             />
                          </div>
                       </div>

                       <div className="space-y-4">
                          {slide.content.map((bullet, bIdx) => (
                            <div key={bIdx} className="flex gap-4 group/bullet transition-all">
                              <div className="mt-2.5 w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all group-hover/bullet:shadow-[0_0_8px_white]" style={{ backgroundColor: accentColor }}></div>
                              <textarea 
                                className="w-full bg-transparent border-none text-[14px] font-semibold leading-relaxed text-gray-400 focus:text-white transition-colors outline-none resize-none p-0 overflow-hidden min-h-[1.5em]"
                                value={bullet}
                                rows={2}
                                onChange={e => {
                                  handleBulletChange(idx, bIdx, e.target.value);
                                  e.target.style.height = 'auto';
                                  e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                                onFocus={(e) => {
                                  e.target.style.height = 'auto';
                                  e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                              />
                            </div>
                          ))}
                       </div>

                       {slide.code && (
                         <div className="mt-6 bg-black/40 rounded-xl border border-white/5 overflow-hidden group/code relative">
                            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                               <div className="flex gap-1.5">
                                 <div className="w-2 h-2 rounded-full bg-red-500/40"></div>
                                 <div className="w-2 h-2 rounded-full bg-amber-500/40"></div>
                                 <div className="w-2 h-2 rounded-full bg-emerald-500/40"></div>
                               </div>
                               <span className="text-[9px] font-mono font-bold text-gray-500 tracking-widest uppercase">{slide.language || 'code_snippet'}</span>
                            </div>
                            <pre className="p-4 md:p-6 text-[14px] font-mono font-normal text-blue-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                               {slide.code.replace(/\\n/g, '\n')}
                            </pre>
                            <div className="absolute top-12 right-4 opacity-0 group-hover/code:opacity-100 transition-opacity">
                               <button className="text-[9px] font-bold text-gray-500 hover:text-white uppercase tracking-widest bg-white/5 px-2 py-1 rounded">Copy_Hash</button>
                            </div>
                         </div>
                       )}

                       {slide.notes && (
                         <div className="mt-6 flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5 border-dashed">
                            <span className="material-symbols-outlined text-gray-600 text-[18px]">record_voice_over</span>
                            <p className="text-[11px] text-gray-500 italic leading-relaxed">{slide.notes}</p>
                         </div>
                       )}
                    </div>
                  </div>
               </div>
            </div>
          )
        })}
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
         <button 
           className="bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 text-white px-6 py-4 rounded-xl flex items-center gap-3 transition-all hover:-translate-y-1 hover:shadow-2xl ring-1 ring-white/5"
           onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
         >
           <span className="material-symbols-outlined text-[#2563EB]">arrow_upward</span>
           <span className="text-[11px] font-bold tracking-widest uppercase">Protocol Back To Command</span>
         </button>
      </div>

    </div>
  );
}
