import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { presentationApi } from '../api/presentation';

export default function DashboardView() {
  const { savedPresentations, setSavedPresentations, showToast, globalDefaultModel } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPpts = async () => {
      try {
        const ppts = await presentationApi.getMyPresentations();
        setSavedPresentations(ppts || []);
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

  const getModelLabel = () => {
    if (globalDefaultModel === 'nvidia') return 'NVIDIA_NIM // MOONSHOT';
    return 'GROQ // LLAMA_3.3_70B';
  };

  return (
    <div className={`pg act`}>
      <div className="pey">// SYSTEM_OVERVIEW</div>
      <div className="ptl">DASH<span className="ac">BOARD</span></div>
      <div className="psub">// Real-time presentation node status and system health</div>

      <div className="sgd">
        <div className="scard">
          <div className="sclbl">LOCAL_PRESENTATIONS</div>
          <div className="scval cy">{savedPresentations.length}</div>
          <div className="scsub">Verified generations in disk</div>
          <div className="scbar2" style={{ background: 'linear-gradient(90deg, var(--cy), #0060ff)', width: '100%' }}></div>
        </div>
        <div className="scard">
          <div className="sclbl">GENERATION_STORAGE</div>
          <div className="scval gn">OPTIMAL</div>
          <div className="scsub">Storage node: MongoDB/GridFS</div>
          <div className="scbar2" style={{ background: 'var(--gn)', width: '100%' }}></div>
        </div>
        <div className="scard">
          <div className="sclbl">DEFAULT_LLM_MODEL</div>
          <div className="scval" style={{ fontSize: 13, color: 'var(--pu)', marginTop: 4 }}>{getModelLabel().split(' // ')[0]}</div>
          <div className="scsub">{getModelLabel().split(' // ')[1]}</div>
          <div className="scbar2" style={{ background: 'var(--pu)', width: '100%' }}></div>
        </div>
        <div className="scard">
          <div className="sclbl">SYSTEM_UPTIME</div>
          <div className="scval am">99.9%</div>
          <div className="scsub">Node: 127.0.0.1:8001</div>
          <div className="scbar2" style={{ background: 'var(--am)', width: '100%' }}></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 16, marginBottom: 20 }}>
        {/* Activity Table */}
        <div className="card" style={{ padding: 22 }}>
          <div className="cc tl"></div><div className="cc tr"></div>
          <div className="fl mb12">// RECENT_GENERATIONS</div>
          <div style={{ overflow: 'auto', maxHeight: 300 }}>
            <table className="htbl">
              <thead>
                <tr><th>DECK_TITLE</th><th>DATE</th><th>ACTIONS</th></tr>
              </thead>
              <tbody>
                {savedPresentations.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--t3)' }}>NO_HISTORY_FOUND</td></tr>
                ) : savedPresentations.slice(0, 5).map(p => (
                  <tr key={p.id}>
                    <td className="cy" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</td>
                    <td style={{ fontSize: 10 }}>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn bs bsm" onClick={() => handleDownload(p.id, p.title + '.pptx')}>GET</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div className="cc tl"></div><div className="cc tr"></div><div className="cc bl"></div><div className="cc br"></div>
          <div className="fl mb8">// CORE_COMMAND</div>
          <div className="ptl" style={{ fontSize: 15, marginBottom: 8 }}>Initialize <span className="ac">New Node</span></div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--t2)', lineHeight: 1.75, letterSpacing: '.04em', marginBottom: 18 }}>
            Deploy new presentation architecture via {globalDefaultModel === 'nvidia' ? 'NVIDIA NIM' : 'Groq Runtime'}.
          </div>
          <button className="btn bp shim" onClick={() => navigate('/create')}>
            NEW_ARCHITECTURE
          </button>
        </div>
      </div>
    </div>
  );
}
