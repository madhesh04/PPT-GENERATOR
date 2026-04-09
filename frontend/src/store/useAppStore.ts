import { create } from 'zustand';

interface ToastData {
  show: boolean;
  msg: string;
}

interface AppState {
  sidebarCollapsed: boolean;
  toastData: ToastData;
  timeStr: string;
  setSidebarCollapsed: (collapsed: boolean) => void;
  showToast: (msg: string, dur?: number) => void;
  setTimeStr: (time: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toastData: { show: false, msg: '' },
  timeStr: '',

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  showToast: (msg: string, dur = 3000) => {
    set({ toastData: { show: true, msg } });
    setTimeout(() => {
      set((state) => ({ toastData: { ...state.toastData, show: false } }));
    }, dur);
  },

  setTimeStr: (timeStr) => set({ timeStr }),
}));
