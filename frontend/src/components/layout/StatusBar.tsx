import { useAppStore } from '../../store/useAppStore';

export default function StatusBar() {
  const { timeStr } = useAppStore();
  
  return (
    <footer className="fixed bottom-0 left-0 right-0 h-[28px] bg-[#0D0F17] border-t border-white/[0.06] flex items-center justify-between px-5 z-50">
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-1.5 font-mono font-medium text-[9px] text-[#475569] tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse"></span>
          SERVER: ONLINE
        </span>
        <span className="font-mono font-medium text-[9px] text-[#475569] tracking-wider hidden sm:block">
          TLS 1.3 · ENCRYPTED
        </span>
      </div>
      <div className="flex items-center gap-5">
        <span className="font-mono font-medium text-[9px] text-[#475569] tracking-wider">{timeStr}</span>
        <span className="font-mono font-medium text-[9px] text-[#475569] tracking-wider border-l border-white/[0.06] pl-4">
          v2.4.1 · SWIFT OPS
        </span>
      </div>
    </footer>
  );
}
