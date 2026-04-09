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
    <div className="pg act">
      <div className="pey">// SYSTEM_CONFIGURATION</div>
      <div className="ptl">SYSTEM <span className="ac">SETTINGS</span></div>
      <div className="psub">// API configuration & rendering parameters</div>

      <div className="setgrid">
        <div className="card" style={{ padding: 22 }}>
          <div className="cc tl"></div><div className="cc tr"></div>
          <div className="fl mb12">// USER_PROFILE</div>
          <div className="fg mb16">
            <div className="fl"><span className="fn">01 //</span> FULL_NAME</div>
            <div className="fb2"><input className="finp" type="text" readOnly value={user?.full_name || ''} /></div>
          </div>
          <div className="fg mb16">
            <div className="fl"><span className="fn">02 //</span> EMAIL_ADDRESS</div>
            <div className="fb2"><input className="finp" type="text" readOnly value={user?.email || ''} /></div>
          </div>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div className="cc tl"></div><div className="cc tr"></div>
          <div className="fl mb12">// GENERATION_PREFS</div>
          <div className="setr">
            <div><div className="setlbl">IMAGE_GENERATION</div><div className="setdsc">Fetch images per slide</div></div>
            <div 
              className={`tsw ${globalImageGen ? 'on' : ''}`} 
              onClick={() => handleUpdate('image_generation_enabled', !globalImageGen)}
              style={{ cursor: isAdminRole ? 'pointer' : 'not-allowed' }}
            >
              <div className="tknob"></div>
            </div>
          </div>
          <div className="setr">
            <div><div className="setlbl">SPEAKER_NOTES</div><div className="setdsc">Auto-generate presenter notes</div></div>
            <div 
              className={`tsw ${globalSpeakerNotes ? 'on' : ''}`} 
              onClick={() => handleUpdate('speaker_notes_enabled', !globalSpeakerNotes)}
              style={{ cursor: isAdminRole ? 'pointer' : 'not-allowed' }}
            >
              <div className="tknob"></div>
            </div>
          </div>
          <div className="setr" style={{ borderBottom: 'none' }}>
            <div><div className="setlbl">DEFAULT_MODEL</div><div className="setdsc">LLM model selection</div></div>
            {isAdminRole ? (
              <select 
                className="seld" 
                value={globalDefaultModel} 
                onChange={(e) => handleUpdate('default_model', e.target.value)}
              >
                <option value="groq">llama-3.3-70b-versatile (Groq)</option>
                <option value="nvidia">moonshotai/kimi-k2-instruct (NVIDIA)</option>
              </select>
            ) : (
              <div className="hbdg" style={{ background: 'rgba(0,240,255,0.05)', borderColor: 'rgba(0,240,255,0.1)' }}>
                {globalDefaultModel?.toUpperCase() || 'GROQ'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
