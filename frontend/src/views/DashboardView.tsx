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

  const activeTodayCount = savedPresentations.filter(p => {
    const today = new Date().toDateString();
    return new Date(p.created_at).toDateString() === today;
  }).length;

  return (
    <div className="animate-fade-in max-w-7xl mx-auto pb-10">
      {/* Page Header */}
      <div className="mb-8 flex items-center gap-3">
        <span className="material-symbols-outlined text-[#2563EB] text-3xl">dashboard</span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Operations Dashboard</h1>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-mono">System Metrics & History</p>
        </div>
      </div>

      {/* ROW 1: STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        {/* Stat Card 1 */}
        <div className="bg-[#0F1118] border border-white/[0.06] p-5 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-[#2563EB]/20">
              <span className="material-symbols-outlined text-[#2563EB] text-sm">auto_awesome</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-bold tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              +12%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Generated</div>
            <div className="text-2xl font-bold text-white">{savedPresentations.length}</div>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="bg-[#0F1118] border border-white/[0.06] p-5 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <span className="material-symbols-outlined text-emerald-500 text-sm">speed</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[#60A5FA] font-bold tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-full border border-[#2563EB]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              RUNNING
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Active Today</div>
            <div className="text-2xl font-bold text-white">{activeTodayCount}</div>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="bg-[#0F1118] border border-white/[0.06] p-5 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <span className="material-symbols-outlined text-purple-500 text-sm">memory</span>
            </div>
            <div className="text-[10px] text-gray-400 font-bold tracking-widest bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
              NOMINAL
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Model Node</div>
            <div className="text-xl font-bold text-white tracking-tight">
              {globalDefaultModel === 'nvidia' ? 'NVIDIA K2.5' : 'GROQ LLaMA'}
            </div>
          </div>
        </div>

        {/* Stat Card 4 */}
        <div className="bg-[#0F1118] border border-white/[0.06] p-5 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-[#00ff9d]/10 flex items-center justify-center border border-[#00ff9d]/20">
              <span className="material-symbols-outlined text-[#00ff9d] text-sm">dns</span>
            </div>
            <div className="text-[10px] text-[#00ff9d] font-bold tracking-widest bg-[#00ff9d]/10 px-2 py-0.5 rounded-full border border-[#00ff9d]/20">
              OPTIMIZED
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Storage Layer</div>
            <div className="text-xl font-bold text-white tracking-tight">GridFS</div>
          </div>
        </div>
      </div>

      {/* ROW 2: MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Recent Generations Table (Full Width Mode) */}
        <section className="lg:col-span-12 bg-[#0F1118] border border-white/[0.06] p-6 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">Recent Generations</h3>
            <button 
              onClick={() => navigate('/history')}
              className="text-[11px] text-gray-400 hover:text-white font-bold tracking-widest uppercase transition-colors flex items-center gap-1"
            >
              View History <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="border-b border-white/[0.06] text-[10px] font-bold text-[#475569] uppercase tracking-widest whitespace-nowrap">
                <tr>
                  <th className="pb-3 px-4 font-bold">Deck Title</th>
                  <th className="pb-3 px-4 font-bold">Status</th>
                  <th className="pb-3 px-4 text-right font-bold">Timestamp</th>
                  <th className="pb-3 px-4 text-right font-bold w-32">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {savedPresentations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-16 h-16 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6 shadow-inner">
                          <span className="material-symbols-outlined text-3xl text-gray-600">history_edu</span>
                        </div>
                        <h3 className="text-white font-bold tracking-tight mb-2 uppercase text-[12px] tracking-widest">Global Archive Empty</h3>
                        <p className="text-gray-500 text-[10px] leading-relaxed mb-8 uppercase tracking-widest font-mono text-center px-4">
                          No tactical assets detected in the primary storage layer. Initiate a protocol to populate history.
                        </p>
                        <button 
                          onClick={() => navigate('/create')}
                          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-bold tracking-widest px-8 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2 active:scale-95 shadow-blue-500/20"
                        >
                          <span className="material-symbols-outlined text-sm">bolt</span>
                          INITIATE_PROMPT
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : savedPresentations.slice(0, 5).map(p => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors border-b border-white/[0.06] group">
                    <td className="py-4 px-4 font-medium text-gray-200">
                      {p.title}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Complete
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-gray-400 text-xs font-mono">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button 
                        onClick={() => handleDownload(p.id, p.title + '.pptx')}
                        className="opacity-0 group-hover:opacity-100 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-bold tracking-wider px-4 py-1.5 rounded-full transition-all duration-300 shadow-md flex items-center justify-center gap-1.5 float-right"
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        GET
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
