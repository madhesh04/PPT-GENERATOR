
import { create } from 'zustand';

/* ── Toast Store ── */
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}
interface ToastStoreState {
  toasts: Toast[];
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: number) => void;
}

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],
  showToast: (message, type) => {
    const id = Date.now();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/* ── useToast hook ── */
export function useToast() {
  const showToast = useToastStore((s) => s.showToast);
  return { showToast };
}

/* ── Toast Container Component ── */
function CheckIcon() {
  return (
    <svg className="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`} onClick={() => removeToast(toast.id)}>
          <div className="toast-bar" />
          {toast.type === 'success' ? <CheckIcon /> : toast.type === 'error' ? <XIcon /> : <CheckIcon />}
          <span className="toast-msg">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}