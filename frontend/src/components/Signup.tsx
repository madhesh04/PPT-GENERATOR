import React from 'react';

interface SignupProps {
  onSwitchToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin }) => {
  return (
    <div className="w-full max-w-[420px] relative animate-fade-up">
      <div className="bg-[#0F1118]/95 backdrop-blur-xl border border-white/5 p-8 rounded-xl relative shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4">

        {/* HEADER */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-[2px] bg-[#00ff9d]"></div>
            <span className="text-[10px] text-[#00ff9d] tracking-widest font-bold uppercase">JOIN_SYSTEM</span>
          </div>
          <h2 className="text-[22px] font-bold text-white mb-1.5 tracking-tight">Access Initialization</h2>
          <div className="text-[11px] text-outline-variant tracking-widest font-mono flex items-center">
            <span className="text-[#00ff9d] mr-2 font-bold">{'>_'}</span> RESTRICTED_AREA
          </div>
        </div>

        {/* ═══ EXTERNALLY MANAGED NOTICE ═══ */}
        <div className="py-4 flex flex-col items-center gap-3 animate-fade-up">
          {/* Shield icon */}
          <div className="w-14 h-14 bg-blue-500/10 border border-[#2563EB]/20 rounded-full flex items-center justify-center mb-1">
            <span className="material-symbols-outlined text-[#2563EB] text-[28px]">verified_user</span>
          </div>

          <h3 className="font-bold text-sm text-[#60A5FA] tracking-wide text-center uppercase">
            External Registration
          </h3>

          <div className="text-[11px] text-gray-400 tracking-wide text-center leading-relaxed">
            User accounts are managed by the <br/><strong className="text-gray-200">Timesheet Administration System</strong>.
            <br/><br/>
            Contact your team administrator or HR department for access credentials.
          </div>

          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent my-3"></div>

          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold tracking-widest uppercase">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_red] animate-pulse"></div>
            Self Signup Disabled
          </div>
        </div>

        <div className="text-center pt-2">
          <span className="text-[11px] text-outline-variant font-medium">
            Already listed? <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToLogin(); }} className="text-[#00ff9d] hover:text-[#00ff9d]/80 transition-colors ml-1 font-bold">Return to Base &rarr;</a>
          </span>
        </div>

        <div className="text-center border-t border-white/5 pt-5 mt-2">
          <div className="text-[10px] text-outline-variant font-medium">
            Powered by <span className="text-white">Neo Q Labs &mdash; Swift Ops Training Team</span>
          </div>
          <div className="text-[9px] text-outline-variant/60 mt-1.5">
            &copy; 2026 Iamneo Edutech Private Limited. All rights reserved.
          </div>
        </div>

      </div>
    </div>
  );
};

export default Signup;
