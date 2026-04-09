import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { presentationApi } from '../api/presentation';

export default function HistoryView() {
  const { savedPresentations, setSavedPresentations, showToast } = useAppStore();

  useEffect(() => {
    const fetchPpts = async () => {
      try {
        const ppts = await presentationApi.getMyPresentations();
        setSavedPresentations(ppts);
      } catch (err) {
        console.error('Failed to fetch history', err);
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
    <div className="pg act">
      <div className="pey">// GENERATION_LOG</div>
      <div className="ptl">DECK <span className="ac">HISTORY</span></div>
      <div className="psub">// All previously generated presentations</div>

      <div className="card" style={{ overflow: 'x-auto' }}>
        <div className="cc tl"></div><div className="cc tr"></div>
        <table className="htbl">
          <thead>
            <tr>
              <th>DECK_TITLE</th>
              <th>THEME</th>
              <th>GENERATED</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {savedPresentations.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>NO RECORDS.</td></tr>
            ) : savedPresentations.map((p) => (
              <tr key={p.id}>
                <td className="cy">{p.title}</td>
                <td>{p.theme}</td>
                <td>{new Date(p.created_at).toLocaleString()}</td>
                <td><span className="hbdg dn">SAVED_DISK</span></td>
                <td>
                  <button className="btn bs bsm" onClick={() => handleDownload(p.id, p.title + '.pptx')}>
                    DOWNLOAD
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
