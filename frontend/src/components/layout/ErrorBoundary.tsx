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
        <div className="h-screen w-screen bg-[var(--bg-primary)] flex items-center justify-center p-6 text-center overflow-hidden">
          {/* Ambient Glow */}
          <div style={{ position: 'absolute', top: '10%', left: '25%', width: '400px', height: '400px', background: 'var(--red)', filter: 'blur(160px)', opacity: 0.08, pointerEvents: 'none' }} />
          
          <div className="max-w-xl w-full relative z-10" style={{ animation: 'fadeUp 0.6s ease' }}>
            <div className="w-24 h-24 bg-[var(--red)]/10 rounded-full flex items-center justify-center mx-auto mb-10 border border-[var(--red)]/20 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
              <span className="material-symbols-outlined text-[var(--red)] text-5xl">emergency_home</span>
            </div>
            
            <h1 className="text-4xl font-[900] text-white tracking-[-2px] mb-2 font-[var(--font)]">
              CRITICAL_SYSTEM_FAILURE
            </h1>
            <p className="text-[var(--text-muted)] text-sm mb-10 font-bold uppercase tracking-[2px]">
              Protocol Violation // Unhandled Memory Exception
            </p>
            
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8 mb-10 text-left shadow-2xl backdrop-blur-xl">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 10px var(--red)' }} />
                <p className="text-[10px] font-extrabold uppercase text-[var(--text-muted)] tracking-widest">Diagnostic_Trace_LOG</p>
              </div>
              
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-faint)' }}>
                <p className="text-[var(--red)] font-[var(--mono)] text-[13px] leading-relaxed break-words font-medium">
                  {this.state.error?.message || 'UNKNOWN_RUNTIME_EXCEPTION'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => window.location.href = '/'}
                className="bg-[var(--accent)] hover:bg-[var(--accent-hi)] text-white px-10 py-5 rounded-2xl text-[12px] font-black tracking-widest uppercase transition-all shadow-[0_8px_40px_rgba(3,37,189,0.3)] active:scale-95 flex items-center gap-3"
              >
                <span className="material-symbols-outlined text-sm">terminal</span>
                Reboot Core System
              </button>
            </div>
            
            <p className="mt-12 text-[10px] text-[var(--text-muted)] font-[var(--mono)] uppercase tracking-[4px] opacity-30">
              Skynet Protocol v3.1 // System Integrity Secure
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
