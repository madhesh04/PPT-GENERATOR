import { useState } from 'react';
import { usePresentationStore } from '../store/usePresentationStore';
import { useAppStore } from '../store/useAppStore';
import { presentationApi } from '../api/presentation';
import apiClient from '../api/apiClient';

export default function PreviewView() {
  const { result, slides, setSlides, theme } = usePresentationStore();
  const { showToast } = useAppStore();
  const [previewSecOpen, setPreviewSecOpen] = useState(true);

  if (!result || slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="font-mono text-2xl text-gray-500">NO DECK LOADED</div>
        <button className="btn bs" onClick={() => window.location.hash = '/create'}>
          GO TO CREATION FLIGHT DECK
        </button>
      </div>
    );
  }

  const handleDownload = async (dlToken?: string, filename?: string) => {
    showToast('DOWNLOAD — Streaming PPTX...');
    const t = dlToken || result?.token;
    const f = filename || result?.filename || 'presentation.pptx';
    if (!t) return;
    try {
      const blob = await presentationApi.downloadPresentation(t);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      showToast('DOWNLOAD_FAILED');
    }
  };

  const handleExportPdf = async () => {
    showToast('GENERATING_PDF_DECK...');
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
    } catch (err) {
      showToast('PDF_EXPORT_FAILED');
    }
  };

  const handleRebuildExport = async () => {
    showToast('REBUILD — Regenerating PPTX with latest edits...', 4000);
    try {
      const data = await presentationApi.exportPresentation({ title: result.title, slides, theme });
      handleDownload(data.token, data.filename);
    } catch (err) {
      showToast('REBUILD_FAILED');
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
    showToast(`REGEN — Fetching image for slide ${idx + 1}...`);
    try {
      const response = await apiClient.post('/regenerate-image', {
        query: slide.image_query || slide.title
      });
      const { image_base64 } = response.data;
      const newSlides = [...slides];
      newSlides[idx].image_base64 = image_base64;
      setSlides(newSlides);
    } catch (err) {
      showToast('IMAGE_REGEN_FAILED');
    }
  };

  return (
    <div className="pg act">
      <div className="pey">// SLIDE_PREVIEW_ENGINE</div>
      <div className="ptl">SLIDE <span className="ac">PREVIEW</span></div>
      <div className="psub">// {slides.length} slides · {result.title} · {theme} theme</div>

      <div className="pvhdr">
        <div>
          <div className="pvtl">{result.title}</div>
          <div className="pvmt">
            {slides.length} slides · {theme}
            {result.provider && (
              <span className="prov-badge" style={{
                marginLeft: 8, display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: '.06em',
                background: result.provider === 'nvidia_nim' ? 'rgba(118,185,0,.12)' : 'rgba(0,240,255,.1)',
                border: result.provider === 'nvidia_nim' ? '1px solid rgba(118,185,0,.35)' : '1px solid rgba(0,240,255,.25)',
                color: result.provider === 'nvidia_nim' ? '#76b900' : 'var(--cy)',
                fontFamily: 'var(--fm)'
              }}>
                {result.provider === 'nvidia_nim' ? '⚡ NVIDIA NIM' : '🟢 GROQ'} · {result.model_used}
              </span>
            )}
          </div>
        </div>
        <div className="pvac">
          <button className="btn bs bsm" onClick={handleExportPdf}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> PDF
          </button>
          <button className="btn bs bsm" onClick={() => handleDownload()}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> DOWNLOAD
          </button>
          <button className="btn bp shim bsm" onClick={handleRebuildExport}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg> REBUILD_EXPORT
          </button>
        </div>
      </div>

      <div className="tstrip">
        {slides.map((s, idx) => (
          <div key={idx} className="th" onClick={() => document.getElementById(`slide-card-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            <div className="thi">
              <div className="th2c">
                <div className="thls" style={{ flex: 1 }}>
                  <div className="thl" style={{ background: ['var(--cy)', 'var(--or)', '#0d9488', '#d97706'][idx % 4] }}></div>
                  <div className="thline" style={{ width: '100%' }}></div><div className="thline" style={{ width: '80%' }}></div>
                </div>
                {s.image_query && <div className="thimg" style={s.image_base64 ? { backgroundImage: `url(${s.image_base64})`, backgroundSize: 'cover' } : {}}></div>}
              </div>
            </div>
            <div className="thnum">{idx + 1}</div>
          </div>
        ))}
      </div>

      <div className="stog" onClick={() => setPreviewSecOpen(!previewSecOpen)}>
        <span className={`stch ${previewSecOpen ? 'op' : 'cl'}`}>▼</span>
        <span style={{ fontSize: 13 }}>📝</span>
        <span className="sttl">EDIT_SLIDE_CONTENT</span>
        <span className="stct">{slides.length} CONTENT_SLIDES</span>
      </div>

      <div className="sbody" style={{ display: previewSecOpen ? 'block' : 'none' }}>
        <div className="sgrid">
          {slides.map((slide, idx) => {
            const color = ['#00f0ff', '#ff6b35', '#0d9488', '#d97706'][idx % 4];
            const bg = [`rgba(0,240,255,.1)`, `rgba(255,107,53,.1)`, `rgba(13,148,136,.1)`, `rgba(217,119,6,.1)`][idx % 4];

            return (
              <div key={idx} id={`slide-card-${idx}`} className="sc">
                <div className="sch">
                  <div className="scbar" style={{ background: color }}></div>
                  <div className="scn" style={{ background: bg, color: color, border: `1px solid ${color}40` }}>{String(idx + 1).padStart(2, '0')}</div>
                  <input className="sct" value={slide.title} onChange={e => handleTitleChange(idx, e.target.value)} />
                </div>
                <div className="scb">
                  <div className="scbuls">
                    {slide.content.map((pt, bIdx) => (
                      <div key={bIdx} className="scbul">
                        <div className="scdot" style={{ background: color }}></div>
                        <textarea className="sctxt" value={pt} onChange={e => handleBulletChange(idx, bIdx, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  {slide.code && (
                    <div style={{ background: '#1e1e2e', borderRadius: 6, padding: '10px 14px', marginBottom: 10, border: '1px solid rgba(255,255,255,.06)', position: 'relative' }}>
                      {slide.language && <div style={{ position: 'absolute', top: 6, right: 10, fontSize: 9, fontFamily: 'var(--fm)', color: '#6c7186', letterSpacing: '.06em', fontWeight: 700 }}>{slide.language.toUpperCase()}</div>}
                      <pre style={{ margin: 0, fontFamily: 'Consolas, monospace', fontSize: 12, color: '#cbd6f6', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{slide.code.replace(/\\n/g, '\n')}</pre>
                    </div>
                  )}
                  <div>
                    {slide.image_base64 ? (
                      <div className="sciph">
                        <img src={slide.image_base64} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                      </div>
                    ) : (
                      <div className="sciph"><div className="scii">🖼</div><div className="scil">NO_IMAGE</div></div>
                    )}
                    <button className="rgn" onClick={() => handleRegenImage(idx)}>✦ REGEN_IMAGE</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
