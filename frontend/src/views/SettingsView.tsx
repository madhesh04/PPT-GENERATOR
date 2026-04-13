import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import apiClient from '../api/apiClient';

export default function SettingsView() {
  const { user } = useAuthStore();
  const { 
    globalImageGen, globalSpeakerNotes, globalDefaultModel, 
    setGlobalSettings, showToast 
  } = useAppStore();

  const isAdminRole = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'MASTER';

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const url = isAdminRole ? '/admin/settings' : '/admin/public/settings';
        const res = await apiClient.get(url);
        setGlobalSettings({
          globalImageGen: res.data.image_generation_enabled,
          globalSpeakerNotes: res.data.speaker_notes_enabled || false,
          globalDefaultModel: res.data.default_model
        });
      } catch (err) {
        console.error('Failed to fetch settings');
      }
    };
    fetchSettings();
  }, [isAdminRole, setGlobalSettings]);

  const handleUpdate = async (field: string, value: any) => {
    if (!isAdminRole) {
      showToast('UNAUTHORIZED — ADMIN PRIVILEGES REQUIRED');
      return;
    }
    
    showToast(`UPDATING SYSTEM_SETTING: ${field.toUpperCase()}...`);
    try {
      const payload: any = {};
      if (field === 'image_generation_enabled') payload.image_generation_enabled = value;
      if (field === 'speaker_notes_enabled') payload.speaker_notes_enabled = value;
      if (field === 'default_model') payload.default_model = value;

      await apiClient.patch('/admin/settings', payload);
      
      setGlobalSettings({
        [field === 'image_generation_enabled' ? 'globalImageGen' : 
         field === 'speaker_notes_enabled' ? 'globalSpeakerNotes' : 'globalDefaultModel']: value
      });
      showToast(`SUCCESS — System settings updated.`);
    } catch (err) {
      showToast('Setting update failed');
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-10">
      
      {/* Page Header */}
      <div className="mb-8 flex items-center gap-3">
        <span className="material-symbols-outlined text-blue-500 text-3xl">settings</span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">System Configuration</h1>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-mono">API & Rendering Parameters</p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* User Profile Card */}
        <div className="bg-[#0B0F19]/95 backdrop-blur-xl border border-white/5 p-6 md:p-8 rounded-2xl relative shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400 text-[18px]">account_circle</span>
              User Profile
            </h2>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest bg-gray-800 px-2 py-1 rounded-md">
              {isAdminRole ? 'ADMINISTRATOR' : 'STANDARD_USER'}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="text-blue-500">01 //</span> Full Name
              </label>
              <input 
                className="w-full bg-[#111624] border border-white/5 text-gray-300 text-sm p-3 rounded-xl outline-none" 
                type="text" 
                readOnly 
                value={user?.full_name || ''} 
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="text-blue-500">02 //</span> Email Address
              </label>
              <input 
                className="w-full bg-[#111624] border border-white/5 text-gray-300 text-sm p-3 rounded-xl outline-none" 
                type="text" 
                readOnly 
                value={user?.email || ''} 
              />
            </div>
          </div>
        </div>

        {/* Generation Prefs Card */}
        <div className="bg-[#0B0F19]/95 backdrop-blur-xl border border-white/5 p-6 md:p-8 rounded-2xl relative shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-400 text-[18px]">precision_manufacturing</span>
              Generation Preferences
            </h2>
          </div>
          
          <div className="space-y-6">
            
            {/* Image Gen Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <div>
                <div className="text-sm font-bold text-gray-200 mb-1">Image Generation</div>
                <div className="text-[11px] text-gray-500">Automatically fetch context images per slide</div>
              </div>
              <button 
                onClick={() => handleUpdate('image_generation_enabled', !globalImageGen)}
                disabled={!isAdminRole}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${globalImageGen ? 'bg-blue-500' : 'bg-gray-700'} ${!isAdminRole ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer focus:ring-2 focus:ring-blue-500/50 outline-none'}`}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${globalImageGen ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

            {/* Speaker Notes Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <div>
                <div className="text-sm font-bold text-gray-200 mb-1">Speaker Notes</div>
                <div className="text-[11px] text-gray-500">Auto-generate presenter notes for each slide</div>
              </div>
              <button 
                onClick={() => handleUpdate('speaker_notes_enabled', !globalSpeakerNotes)}
                disabled={!isAdminRole}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${globalSpeakerNotes ? 'bg-emerald-500' : 'bg-gray-700'} ${!isAdminRole ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer focus:ring-2 focus:ring-emerald-500/50 outline-none'}`}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${globalSpeakerNotes ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

            {/* Default Model Selector */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <div>
                <div className="text-sm font-bold text-gray-200 mb-1">Default Model</div>
                <div className="text-[11px] text-gray-500">Select the primary LLM engine for processing</div>
              </div>
              <div>
                {isAdminRole ? (
                  <select 
                    className="bg-[#111624] border border-white/10 text-sm text-gray-200 p-2 rounded-lg outline-none focus:border-blue-500 transition-colors cursor-pointer" 
                    value={globalDefaultModel} 
                    onChange={(e) => handleUpdate('default_model', e.target.value)}
                  >
                    <option value="groq">llama-3.3-70b-versatile (Groq)</option>
                    <option value="nvidia">moonshotai/kimi-k2-instruct (NVIDIA)</option>
                  </select>
                ) : (
                  <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold tracking-widest px-3 py-1.5 rounded-full">
                    {globalDefaultModel?.toUpperCase() || 'GROQ'}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
