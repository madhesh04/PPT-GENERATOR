import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#0A0C12] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20">
              <span className="material-symbols-outlined text-red-500 text-4xl">warning</span>
            </div>
            
            <h1 className="text-2xl font-extrabold text-white tracking-[-1px] mb-4">CRITICAL_SYSTEM_FAILURE</h1>
            
            <div className="bg-black/40 border border-white/5 rounded-xl p-4 mb-8 text-left">
              <p className="text-[10px] font-extrabold uppercase text-[#475569] tracking-widest mb-1">ERROR_LOG:</p>
              <p className="text-red-400 font-mono text-xs leading-relaxed break-words">
                {this.state.error?.message || 'UNKNOWN_RUNTIME_EXCEPTION'}
              </p>
            </div>

            <button 
              onClick={() => window.location.href = '/'}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8 py-3.5 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all shadow-lg active:scale-95"
            >
              Reboot System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
