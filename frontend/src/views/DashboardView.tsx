import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { presentationApi } from '../api/presentation';

export default function DashboardView() {
  const { savedPresentations, setSavedPresentations, showToast } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPpts = async () => {
      try {
        const ppts = await presentationApi.getMyPresentations();
        setSavedPresentations(ppts);
      } catch (err) {
        console.error('Failed to fetch presentations', err);
      }
    };
    fetchPpts();
  }, [setSavedPresentations]);

  const handleDownload = async (id: string, filename: string) => {
    showToast('DOWNLOAD — Streaming PPTX...');
    try {
      const blob = await presentationApi.downloadPresentation(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      showToast('DOWNLOAD_FAILED');
    }
  };

  return (
    <div className={`pg act`}>
      <div className="pey">// SYSTEM_OVERVIEW</div>
      <div className="ptl">DASH<span className="ac">BOARD</span></div>
      <div className="psub">// Presentation artifacts context node · Global generations dashboard</div>

      <div className="sgd">
        <div className="scard">
          <div className="sclbl">LOCAL_PRESENTATIONS</div>
          <div className="scval cy">{savedPresentations.length}</div>
          <div className="scsub">Saved in personal node</div>
          <div className="scbar2" style={{ background: 'linear-gradient(90deg, var(--cy), #0060ff)', width: '100%' }}></div>
        </div>
        <div className="scard">
          <div className="sclbl">GENERATION_STORAGE</div>
          <div className="scval gn">OPTIMAL</div>
          <div className="scsub">No constraints detected</div>
          <div className="scbar2" style={{ background: 'var(--gn)', width: '100%' }}></div>
        </div>
        <div className="scard">
          <div className="sclbl">LLM_MODEL</div>
          <div className="scval" style={{ fontSize: 13, color: 'var(--pu)', marginTop: 4 }}>LLaMA 3.3</div>
          <div className="scsub">Groq · 70B-versatile</div>
          <div className="scbar2" style={{ background: 'var(--pu)', width: '100%' }}></div>
        </div>
        <div className="scard">
          <div className="sclbl">SYSTEM_UPTIME</div>
          <div className="scval am">99.9%</div>
          <div className="scsub">Core terminal active</div>
          <div className="scbar2" style={{ background: 'var(--am)', width: '100%' }}></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 22 }}>
          <div className="cc tl"></div><div className="cc tr"></div><div className="cc bl"></div><div className="cc br"></div>
          <div className="fl mb8">// QUICK_START</div>
          <div className="ptl" style={{ fontSize: 15, marginBottom: 8 }}>Generate a <span className="ac">new deck</span></div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--t2)', lineHeight: 1.75, letterSpacing: '.04em', marginBottom: 18 }}>
            Describe your topic, pick a tone, and let SKYNET build a branded PowerPoint in seconds using Groq LLaMA 3.3.
          </div>
          <button className="btn bp shim" onClick={() => navigate('/create')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg> CREATE_PRESENTATION
          </button>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div className="cc tl"></div><div className="cc tr"></div><div className="cc bl"></div><div className="cc br"></div>
          <div className="fl mb8">// LAST_SESSION</div>
          {savedPresentations.length > 0 ? (() => {
            const p = savedPresentations[0];
            return (
              <>
                <div className="ptl" style={{ fontSize: 15, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--t2)', lineHeight: 1.75, letterSpacing: '.04em', marginBottom: 18 }}>
                  Saved node · {p.theme} theme · Generated on {new Date(p.created_at).toLocaleDateString()}
                </div>
                <div className="fx gap8">
                  <button className="btn bs bsm" style={{ borderColor: 'var(--gn)', color: 'var(--gn)' }} onClick={() => handleDownload(p.id, p.title + '.pptx')}>DOWNLOAD_PPTX</button>
                </div>
              </>
            );
          })() : (
            <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--t3)', marginTop: 20 }}>NO PREVIOUS SESSION FOUND. INITIATE NEW DECK.</div>
          )}
        </div>
      </div>
    </div>
  );
}
