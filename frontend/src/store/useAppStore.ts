import { create } from 'zustand';


interface AppState {
  sidebarCollapsed: boolean;
  timeStr: string;
  globalImageGen: boolean;
  globalSpeakerNotes: boolean;
  globalDefaultModel: string;
  isDarkMode: boolean;
  settingsLoaded: boolean;

  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleTheme: () => void;
  setTimeStr: (time: string) => void;
  setGlobalSettings: (settings: any) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  timeStr: '',
  globalImageGen: true,
  globalSpeakerNotes: true,
  globalDefaultModel: 'groq',
  isDarkMode: localStorage.getItem('theme') !== 'light',
  settingsLoaded: false,

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleTheme: () => set((state) => {
    const nextMode = !state.isDarkMode;
    if (nextMode) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
    return { isDarkMode: nextMode };
  }),

  setTimeStr: (timeStr) => set({ timeStr }),
  setGlobalSettings: (settings) => set((state) => ({ ...state, ...settings, settingsLoaded: true })),
}));
