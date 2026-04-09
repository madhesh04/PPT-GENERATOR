import { create } from 'zustand';

interface ToastData {
  show: boolean;
  msg: string;
}

interface AppState {
  sidebarCollapsed: boolean;
  toastData: ToastData;
  timeStr: string;
  savedPresentations: any[];
  globalImageGen: boolean;
  globalSpeakerNotes: boolean;
  globalDefaultModel: string;
  setSidebarCollapsed: (collapsed: boolean) => void;
  showToast: (msg: string, dur?: number) => void;
  setTimeStr: (time: string) => void;
  setSavedPresentations: (ppts: any[]) => void;
  setGlobalSettings: (settings: any) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toastData: { show: false, msg: '' },
  timeStr: '',
  savedPresentations: [],
  globalImageGen: true,
  globalSpeakerNotes: true,
  globalDefaultModel: 'groq',

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  showToast: (msg: string, dur = 3000) => {
    set({ toastData: { show: true, msg } });
    setTimeout(() => {
      set((state) => ({ toastData: { ...state.toastData, show: false } }));
    }, dur);
  },

  setTimeStr: (timeStr) => set({ timeStr }),
  setSavedPresentations: (savedPresentations) => set({ savedPresentations }),
  setGlobalSettings: (settings) => set((state) => ({ ...state, ...settings })),
}));
