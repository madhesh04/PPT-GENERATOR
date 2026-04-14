import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { presentationApi } from '../api/presentation';

export default function HistoryView() {
  const { savedPresentations, setSavedPresentations, showToast } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [rangeFilter, setRangeFilter] = useState('ALL TIME');

  useEffect(() => {
    const fetchPpts = async () => {
      try {
        const ppts = await presentationApi.getMyPresentations();
        setSavedPresentations(ppts || []);
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

  const filteredPresentations = savedPresentations.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.theme.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || true; // Currently all are COMPLETED
    
    let matchesRange = true;
    if (rangeFilter !== 'ALL TIME') {
      const now = new Date();
      const created = new Date(p.created_at);
      const diffDays = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
      if (rangeFilter === 'LAST 7 DAYS') matchesRange = diffDays <= 7;
      else if (rangeFilter === 'LAST 30 DAYS') matchesRange = diffDays <= 30;
    }

    return matchesSearch && matchesStatus && matchesRange;
  });

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in pb-12">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#2563EB] text-3xl">inventory_2</span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Generation Archive</h1>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-mono">Historical Data Logs</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button className="bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl border border-white/10 flex items-center gap-2 transition-all shadow-sm">
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span className="text-[11px] font-bold tracking-widest uppercase">Export Logs</span>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Search Bar & Filters */}
        <div className="bg-[#0F1118] border border-white/[0.06] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="flex flex-col md:flex-row gap-4 p-4 items-center">
            <div className="relative flex-1 w-full">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined text-[18px]">search</span>
              <input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#13161F] border border-white/5 focus:border-[#2563EB]/50 rounded-xl outline-none pl-12 pr-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 transition-all shadow-inner" 
                placeholder="Search by filename or theme..." 
                type="text"
              />
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#13161F] border border-white/[0.06] text-gray-300 text-[11px] font-mono tracking-widest py-3 px-4 rounded-xl focus:border-[#2563EB]/50 appearance-none cursor-pointer outline-none shadow-inner transition-all uppercase"
              >
                <option value="ALL">STATUS: ALL</option>
                <option value="COMPLETED">STATUS: COMPLETED</option>
              </select>
              <select 
                value={rangeFilter}
                onChange={(e) => setRangeFilter(e.target.value)}
                className="bg-[#13161F] border border-white/[0.06] text-gray-300 text-[11px] font-mono tracking-widest py-3 px-4 rounded-xl focus:border-[#2563EB]/50 appearance-none cursor-pointer outline-none shadow-inner transition-all uppercase"
              >
                <option value="ALL TIME">RANGE: ALL TIME</option>
                <option value="LAST 30 DAYS">RANGE: LAST 30 DAYS</option>
                <option value="LAST 7 DAYS">RANGE: LAST 7 DAYS</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Table View */}
        <div className="bg-[#0F1118] border border-white/[0.06] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                  <th className="px-6 py-4 text-[10px] text-[#475569] font-bold uppercase tracking-widest">#</th>
                  <th className="px-6 py-4 text-[10px] text-[#475569] font-bold uppercase tracking-widest">FILENAME</th>
                  <th className="px-6 py-4 text-[10px] text-[#475569] font-bold uppercase tracking-widest">THEME</th>
                  <th className="px-6 py-4 text-[10px] text-[#475569] font-bold uppercase tracking-widest">STATUS</th>
                  <th className="px-6 py-4 text-[10px] text-[#475569] font-bold uppercase tracking-widest">GENERATED AT</th>
                  <th className="px-6 py-4 text-[10px] text-[#475569] font-bold uppercase tracking-widest text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPresentations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-xs font-bold tracking-widest uppercase">
                      NO RECORDS FOUND
                    </td>
                  </tr>
                ) : filteredPresentations.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group border-b border-white/[0.06]">
                    <td className="px-6 py-4 text-[11px] text-gray-600 font-bold">{String(idx + 1).padStart(3, '0')}</td>
                    <td className="px-6 py-4 text-[13px] font-medium text-[#60A5FA]">{p.title}.pptx</td>
                    <td className="px-6 py-4 text-[11px] text-gray-300 uppercase tracking-wider">{p.theme}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 text-[9px] font-bold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-wider">
                        COMPLETED
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[11px] text-gray-400">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDownload(p.id, p.title + '.pptx')}
                          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#1D4ED8]/20 hover:text-[#60A5FA] transition-colors bg-white/5 text-gray-400" 
                          title="Download"
                        >
                          <span className="material-symbols-outlined text-[18px]">download</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-between items-center p-5 bg-white/[0.01] border-t border-white/5">
            <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">DISPLAYING: {String(filteredPresentations.length).padStart(2, '0')} RECORDS</span>
            <div className="flex items-center gap-3">
              <button className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors tracking-widest uppercase disabled:opacity-50">PREV</button>
              <div className="flex gap-2">
                <span className="px-2.5 py-1 rounded-md bg-blue-500/20 text-[#60A5FA] text-[11px] font-bold">1</span>
              </div>
              <button className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors tracking-widest uppercase disabled:opacity-50">NEXT</button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
        <div className="bg-[#0F1118] border border-white/[0.06] p-6 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Storage Used</span>
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-[#60A5FA]">cloud</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <div className="text-3xl font-bold text-white tracking-tight">4,288</div>
            <div className="text-sm font-bold text-[#60A5FA]">MB</div>
          </div>
        </div>

        <div className="bg-[#0F1118] border border-white/[0.06] p-6 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Success Rate</span>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-emerald-400">verified</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <div className="text-3xl font-bold text-white tracking-tight">98.2</div>
            <div className="text-sm font-bold text-emerald-400">%</div>
          </div>
        </div>

        <div className="bg-[#0F1118] border border-white/[0.06] p-6 rounded-xl relative shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="flex items-center justify-between mb-4 relative z-10">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Records</span>
            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-purple-400">inventory_2</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <div className="text-3xl font-bold text-white tracking-tight">{savedPresentations.length}</div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none">
            <span className="material-symbols-outlined text-[100px]">inventory_2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
