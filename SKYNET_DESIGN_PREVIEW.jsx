import { useState, useEffect, useRef } from "react";

// ─── Design Tokens ──────────────────────────────────────────────────────────
const T = {
  bg0: '#06080F', bg1: '#0B0E1A', bg2: '#0F1322', bg3: '#141A2E',
  emp: '#3D5AFE', empD: 'rgba(61,90,254,0.12)', empG: 'rgba(61,90,254,0.35)', empB: 'rgba(61,90,254,0.22)',
  adm: '#D32F2F', admD: 'rgba(211,47,47,0.1)', admG: 'rgba(211,47,47,0.35)', admB: 'rgba(211,47,47,0.22)',
  t1: '#E8EAF2', t2: '#8892A4', t3: '#354060',
  grn: '#00E5A0', amb: '#FFB300', pur: '#7C3AED',
  b0: 'rgba(255,255,255,0.04)', b1: 'rgba(255,255,255,0.08)', b2: 'rgba(255,255,255,0.16)',
  fd: "'Orbitron',monospace", fm: "'Share Tech Mono',monospace", fb: "'Inter',sans-serif",
};

// ─── Neural Network Canvas ──────────────────────────────────────────────────
function NeuralBG() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
    resize(); window.addEventListener('resize', resize);
    const N = Array.from({ length: 90 }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
      r: Math.random() * 1.5 + .5,
    }));
    let aid;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
        const dx = N[i].x - N[j].x, dy = N[i].y - N[j].y, d = Math.sqrt(dx*dx+dy*dy);
        if (d < 130) { ctx.beginPath(); ctx.moveTo(N[i].x, N[i].y); ctx.lineTo(N[j].x, N[j].y); ctx.strokeStyle = `rgba(61,90,254,${.14*(1-d/130)})`; ctx.lineWidth = .5; ctx.stroke(); }
      }
      N.forEach(n => {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI*2); ctx.fillStyle = 'rgba(61,90,254,0.75)'; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r+3, 0, Math.PI*2); ctx.fillStyle = 'rgba(61,90,254,0.08)'; ctx.fill();
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > c.width) n.vx *= -1; if (n.y < 0 || n.y > c.height) n.vy *= -1;
      });
      aid = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(aid); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

// ─── Targeting Reticle Canvas ───────────────────────────────────────────────
function ReticleBG() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
    resize();
    let angle = 0, scanY = 0, aid;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      const cx = c.width * .68, cy = c.height * .5, R = Math.min(c.width, c.height) * .34;
      for (let x = 0; x < c.width; x += 50) for (let y = 0; y < c.height; y += 50) { ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI*2); ctx.fillStyle = 'rgba(211,47,47,0.06)'; ctx.fill(); }
      [1, .7, .45, .22].forEach((r, i) => { ctx.beginPath(); ctx.arc(cx, cy, R*r, 0, Math.PI*2); ctx.strokeStyle = `rgba(211,47,47,${.07+i*.04})`; ctx.lineWidth = i===0?1.5:.5; ctx.stroke(); });
      [[angle, angle+.9], [angle+Math.PI, angle+Math.PI+.9]].forEach(([a1, a2]) => { ctx.beginPath(); ctx.arc(cx, cy, R*1.1, a1, a2); ctx.strokeStyle = 'rgba(211,47,47,0.75)'; ctx.lineWidth = 1.5; ctx.stroke(); });
      ctx.strokeStyle = 'rgba(211,47,47,0.18)'; ctx.lineWidth = .5; ctx.setLineDash([6, 10]);
      ctx.beginPath(); ctx.moveTo(cx-R*1.5, cy); ctx.lineTo(cx+R*1.5, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy-R*1.5); ctx.lineTo(cx, cy+R*1.5); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI*2); ctx.fillStyle = 'rgba(211,47,47,0.9)'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI*2); ctx.strokeStyle = 'rgba(211,47,47,0.35)'; ctx.lineWidth = .8; ctx.stroke();
      scanY = (scanY + .7) % c.height;
      const g = ctx.createLinearGradient(0, scanY-70, 0, scanY+2);
      g.addColorStop(0, 'rgba(211,47,47,0)'); g.addColorStop(1, 'rgba(211,47,47,0.055)');
      ctx.fillStyle = g; ctx.fillRect(0, scanY-70, c.width, 72);
      angle += .005; aid = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(aid);
  }, []);
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

// ─── SVG Icons ──────────────────────────────────────────────────────────────
const ICONS = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
  download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  zap: <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  file: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
  user: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
  eye_off: <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>,
  bell: <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>,
  power: <><path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></>,
};

function Icon({ name, size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, barW = '100%', icon }) {
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.14em' }}>{label}</div>
        {icon && <Icon name={icon} size={14} color={`${color}80`} />}
      </div>
      <div style={{ fontFamily: T.fd, fontSize: 26, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontFamily: T.fm, fontSize: 9, color: T.t2 }}>{sub}</div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: T.b0 }}>
        <div style={{ height: '100%', width: barW, background: color, opacity: .7, transition: 'width .5s' }} />
      </div>
    </div>
  );
}

// ─── Auth Screen ────────────────────────────────────────────────────────────
function AuthScreen({ loginMode, setLoginMode }) {
  const [clock, setClock] = useState('');
  const isAdmin = loginMode === 'admin';
  const accent = isAdmin ? T.adm : T.emp;
  const accentD = isAdmin ? T.admD : T.empD;
  const accentB = isAdmin ? T.admB : T.empB;
  const accentG = isAdmin ? T.admG : T.empG;

  useEffect(() => {
    const upd = () => {
      const n = new Date(), p = v => String(v).padStart(2, '0');
      setClock(`UTC ${p(n.getUTCHours())}:${p(n.getUTCMinutes())}:${p(n.getUTCSeconds())} | IST ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`);
    };
    upd(); const t = setInterval(upd, 1000); return () => clearInterval(t);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: T.bg0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {isAdmin ? <ReticleBG /> : <NeuralBG />}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: isAdmin
          ? 'linear-gradient(110deg, rgba(6,8,15,0.97) 36%, rgba(50,5,5,0.55) 62%, rgba(20,0,0,0.2) 100%)'
          : 'linear-gradient(110deg, rgba(6,8,15,0.97) 36%, rgba(5,8,50,0.5) 62%, transparent 100%)',
      }} />

      {/* Top-left logo */}
      <div style={{ position: 'absolute', top: 22, left: 28, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, background: isAdmin ? 'linear-gradient(135deg,#8B0000,#D32F2F)' : 'linear-gradient(135deg,#0D47A1,#3D5AFE)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.fd, fontWeight: 900, fontSize: 16, color: '#fff', boxShadow: `0 0 22px ${accentG}` }}>S</div>
        <div>
          <div style={{ fontFamily: T.fd, fontSize: 13, fontWeight: 700, letterSpacing: '.1em', color: T.t1 }}>SKYNET</div>
          <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.12em', marginTop: 1 }}>PPT GENERATION SYSTEM v2.5</div>
        </div>
      </div>

      {/* Status badge */}
      <div style={{ position: 'absolute', top: 22, right: 28, zIndex: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 6, padding: '5px 14px', fontFamily: T.fm, fontSize: 9, color: T.grn, letterSpacing: '.1em' }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.grn, boxShadow: `0 0 6px ${T.grn}` }} />
        ALL_SYSTEMS_NOMINAL
      </div>

      {/* Login card */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', alignItems: 'center', padding: '0 0 32px 100px' }}>
        <div style={{ width: 440, maxWidth: '88vw', background: 'rgba(7,10,22,0.94)', border: `1px solid ${accentB}`, borderRadius: 16, padding: '28px 32px', backdropFilter: 'blur(32px)', boxShadow: `0 0 70px ${accent}18, 0 24px 80px rgba(0,0,0,0.75)`, position: 'relative' }}>

          {/* Corner accents */}
          {[['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].map(([v, h], i) => (
            <div key={i} style={{ position: 'absolute', width: 14, height: 14, [v]: -1, [h]: -1, [`border${v.charAt(0).toUpperCase()+v.slice(1)}`]: `2px solid ${accent}`, [`border${h.charAt(0).toUpperCase()+h.slice(1)}`]: `2px solid ${accent}` }} />
          ))}

          {/* Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.fm, fontSize: 8, color: `${accent}70`, letterSpacing: '.15em', marginBottom: 12 }}>
            {isAdmin ? '— ADMIN_OVERRIDE' : '— SESSION_INIT'}
            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${accent}25,transparent)` }} />
          </div>

          {/* Title */}
          <div style={{ fontFamily: T.fd, fontSize: 28, fontWeight: 900, letterSpacing: '.04em', lineHeight: 1, marginBottom: 5, color: T.t1 }}>
            {isAdmin ? <><span style={{ color: accent, fontSize: 22 }}>⚠</span> &nbsp;</> : null}SKYNET
          </div>

          {/* Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.fm, fontSize: 9, color: T.t2, letterSpacing: '.06em', marginBottom: 20 }}>
            <span style={{ color: accent }}>›</span>
            <span>_ {isAdmin ? 'ADMIN_OVERRIDE · CLEARANCE_REQUIRED' : 'AWAITING_CREDENTIALS'}</span>
            <span style={{ display: 'inline-block', width: 6, height: 11, background: accent, borderRadius: 1, marginLeft: 2, animation: 'blink 1.1s step-end infinite', boxShadow: `0 0 6px ${accent}` }} />
          </div>

          {/* Mode tabs */}
          <div style={{ display: 'flex', marginBottom: 22, border: `1px solid ${T.b1}`, borderRadius: 8, overflow: 'hidden' }}>
            {['employee', 'admin'].map(m => {
              const act = loginMode === m;
              const mc = m === 'admin' ? T.adm : T.emp;
              const md = m === 'admin' ? T.admD : T.empD;
              return (
                <button key={m} onClick={() => setLoginMode(m)} style={{ flex: 1, padding: '11px 0', background: act ? md : 'transparent', border: 'none', borderBottom: act ? `2px solid ${mc}` : '2px solid transparent', color: act ? mc : T.t3, fontFamily: T.fd, fontSize: 10, fontWeight: 700, letterSpacing: '.15em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .2s' }}>
                  <Icon name={m === 'employee' ? 'user' : 'shield'} size={12} color={act ? mc : T.t3} />
                  {m === 'employee' ? 'Employee' : 'Admin'}
                </button>
              );
            })}
          </div>

          {/* Fields */}
          {[
            { label: isAdmin ? 'MANAGER_ID' : 'EMPLOYEE_ID', placeholder: isAdmin ? 'admin@skynet.ai' : 'neo10394', icon: 'user' },
            { label: 'PASSWORD', placeholder: '••••••••••', icon: 'lock' },
          ].map((f, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.14em', marginBottom: 5 }}>{f.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', height: 46, background: `${accent}05`, border: `1px solid ${accentB}`, borderRadius: 6, padding: '0 14px', gap: 10 }}>
                <Icon name={f.icon} size={13} color={`${accent}60`} />
                <span style={{ flex: 1, fontFamily: T.fm, fontSize: 12, color: T.t3, letterSpacing: '.04em' }}>{f.placeholder}</span>
                {f.icon === 'lock' && <Icon name="eye_off" size={14} color={T.t3} />}
              </div>
            </div>
          ))}

          {/* CTA button */}
          <button style={{ width: '100%', height: 48, marginTop: 8, background: isAdmin ? 'linear-gradient(135deg,#8B0000,#D32F2F)' : 'linear-gradient(135deg,#1A237E,#3D5AFE)', border: 'none', borderRadius: 6, fontFamily: T.fd, fontSize: 11, fontWeight: 700, letterSpacing: '.22em', color: '#fff', cursor: 'pointer', boxShadow: `0 0 28px ${accentG}` }}>
            AUTHENTICATE
          </button>

          {/* Switch link */}
          <div style={{ textAlign: 'center', marginTop: 16, fontFamily: T.fm, fontSize: 9, color: T.t3 }}>
            {isAdmin ? 'Are you an employee? ' : 'Are you an admin? '}
            <span onClick={() => setLoginMode(isAdmin ? 'employee' : 'admin')} style={{ color: accent, cursor: 'pointer' }}>
              {isAdmin ? 'Employee Login →' : 'Admin Login →'}
            </span>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${T.b0}`, textAlign: 'center', fontFamily: T.fm, fontSize: 8, color: T.t3, lineHeight: 1.7 }}>
            Powered by <span style={{ color: T.t2 }}>Skynet Core</span> — AI Suite<br />
            © 2026 Skynet Systems. All rights reserved.
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, background: 'rgba(4,6,14,0.96)', borderTop: `1px solid ${accentB}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 28, zIndex: 20, backdropFilter: 'blur(12px)' }}>
        {[{ dot: T.grn, label: 'SERVER: ONLINE' }, { dot: accent, label: 'TLS 1.3 · ENCRYPTED' }].map((x, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.fm, fontSize: 9, color: T.t2, letterSpacing: '.1em' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: x.dot, boxShadow: `0 0 5px ${x.dot}` }} />
            {x.label}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 22 }}>
          <span style={{ fontFamily: T.fm, fontSize: 9, color: T.t2 }}>{clock}</span>
          <span style={{ fontFamily: T.fm, fontSize: 9, color: T.t3, cursor: 'pointer' }}>☀ LIGHT</span>
          <span style={{ fontFamily: T.fm, fontSize: 9, color: accent, letterSpacing: '.08em' }}>v2.5.0 · SWIFT_OPS</span>
        </div>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

// ─── App Layout Wrapper ─────────────────────────────────────────────────────
function AppLayout({ children, activeNav = '/', pageTitle = 'DASHBOARD', userRole = 'EMPLOYEE' }) {
  const [clock, setClock] = useState('');
  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    const upd = () => { const n = new Date(), p = v => String(v).padStart(2, '0'); setClock(`${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`); };
    upd(); const t = setInterval(upd, 1000); return () => clearInterval(t);
  }, []);

  const navItems = [
    { icon: 'grid', label: 'DASHBOARD', path: '/' },
    { icon: 'plus', label: 'CREATE_PPT', path: '/create' },
    { icon: 'monitor', label: 'PREVIEW', path: '/preview' },
    { icon: 'clock', label: 'HISTORY', path: '/history' },
    { icon: 'settings', label: 'SETTINGS', path: '/settings' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.bg0, color: T.t1, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ height: 54, background: 'rgba(7,10,22,0.98)', borderBottom: `1px solid ${T.b1}`, display: 'flex', alignItems: 'center', paddingRight: 20, zIndex: 90, flexShrink: 0 }}>
        <div style={{ width: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#0D47A1,#3D5AFE)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.fd, fontWeight: 900, fontSize: 15, color: '#fff', boxShadow: '0 0 16px rgba(61,90,254,0.4)' }}>S</div>
        </div>
        <div style={{ width: 1, height: 32, background: T.b1, marginRight: 18 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.fm, fontSize: 10, color: T.t2, letterSpacing: '.08em' }}>
            <span style={{ color: T.emp }}>SKYNET</span>
            <span style={{ color: T.t3, margin: '0 6px' }}>/</span>
            <span>{pageTitle}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.18)', borderRadius: 6, padding: '4px 12px', fontFamily: T.fm, fontSize: 8, color: T.grn, letterSpacing: '.1em' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.grn, boxShadow: `0 0 5px ${T.grn}` }} />
            CORE_ONLINE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${T.b1}`, borderRadius: 20, padding: '4px 4px 4px 12px', cursor: 'pointer' }}>
            <div>
              <div style={{ fontFamily: T.fm, fontSize: 9, color: T.t1, letterSpacing: '.04em' }}>MADHESH P</div>
              <div style={{ fontFamily: T.fm, fontSize: 7, color: T.t3 }}>NEO10486 · {userRole}</div>
            </div>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: isAdmin ? 'linear-gradient(135deg,#8B0000,#D32F2F)' : 'linear-gradient(135deg,#1A237E,#3D5AFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.fm, fontSize: 10, fontWeight: 700, color: '#fff' }}>MP</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 64, flexShrink: 0, background: 'rgba(7,10,22,0.97)', borderRight: `1px solid ${T.b1}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: 4 }}>
          {navItems.map(item => {
            const act = activeNav === item.path;
            return (
              <div key={item.path} title={item.label} style={{ width: 44, height: 44, borderRadius: 8, background: act ? T.empD : 'transparent', border: `1px solid ${act ? T.empB : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .15s' }}>
                <Icon name={item.icon} size={18} color={act ? T.emp : T.t3} />
              </div>
            );
          })}
          <div style={{ flex: 1 }} />
          {isAdmin && (
            <div title="ADMIN_PANEL" style={{ width: 44, height: 44, borderRadius: 8, background: activeNav === '/admin' ? T.admD : 'transparent', border: `1px solid ${activeNav === '/admin' ? T.admB : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="shield" size={18} color={activeNav === '/admin' ? T.adm : T.t3} />
            </div>
          )}
          <div style={{ width: 36, height: 1, background: T.b0, margin: '4px 0' }} />
          <div title="LOGOUT" style={{ width: 44, height: 44, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="logout" size={16} color={T.t3} />
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
          {children}
        </div>
      </div>

      {/* Status bar */}
      <div style={{ height: 30, background: 'rgba(4,6,14,0.96)', borderTop: `1px solid ${T.b1}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 24, flexShrink: 0 }}>
        {[{ dot: T.grn, label: 'CORE_ONLINE' }, { dot: T.emp, label: 'LLM_CONNECTED' }, { dot: T.amb, label: 'NVIDIA_STANDBY' }].map((x, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: T.fm, fontSize: 8, color: T.t2, letterSpacing: '.1em' }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: x.dot, boxShadow: `0 0 4px ${x.dot}` }} />
            {x.label}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontFamily: T.fm, fontSize: 9, color: T.emp }}>{clock} IST</div>
      </div>
    </div>
  );
}

// ─── Dashboard Screen ───────────────────────────────────────────────────────
const MOCK_PPTS = [
  { title: 'Machine Learning Fundamentals', date: '2026-04-10', slides: 12, theme: 'ocean' },
  { title: 'Q2 Financial Overview', date: '2026-04-09', slides: 8, theme: 'royal' },
  { title: 'Cloud Architecture Patterns', date: '2026-04-08', slides: 15, theme: 'neon' },
  { title: 'Product Roadmap 2026', date: '2026-04-07', slides: 10, theme: 'emerald' },
  { title: 'DevOps Best Practices', date: '2026-04-06', slides: 7, theme: 'ocean' },
];
const WEEK_DATA = [12, 5, 8, 18, 3, 22, 9];
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DashboardScreen() {
  const maxW = Math.max(...WEEK_DATA);
  return (
    <AppLayout activeNav="/" pageTitle="DASHBOARD">
      <div style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 800, letterSpacing: '.06em', marginBottom: 3 }}>
        DASH<span style={{ color: T.emp }}>BOARD</span>
      </div>
      <div style={{ fontFamily: T.fm, fontSize: 9, color: T.t2, letterSpacing: '.06em', marginBottom: 24 }}>// Real-time presentation node status and system health</div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="TOTAL_GENERATIONS" value="247" sub="Lifetime decks created" color={T.emp} barW="100%" icon="file" />
        <StatCard label="THIS_WEEK" value="22" sub="+18% vs last week" color={T.grn} barW="72%" icon="zap" />
        <StatCard label="AVG_SLIDES / DECK" value="9.4" sub="Across all generations" color={T.amb} barW="63%" icon="monitor" />
        <StatCard label="ACTIVE_MODEL" value="GROQ" sub="LLaMA 3.3-70b · Online" color={T.pur} barW="100%" icon="bell" />
      </div>

      {/* Middle row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, marginBottom: 18 }}>
        {/* Recent generations */}
        <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: 20, overflow: 'hidden' }}>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.t2, letterSpacing: '.12em', marginBottom: 14 }}>// RECENT_GENERATIONS</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['DECK_TITLE', 'DATE', 'SLIDES', 'ACTION'].map(h => (
                  <th key={h} style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.1em', padding: '0 0 10px', textAlign: 'left', borderBottom: `1px solid ${T.b0}`, fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_PPTS.map((p, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: T.fm, fontSize: 10, color: T.emp, padding: '10px 0', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</td>
                  <td style={{ fontFamily: T.fm, fontSize: 9, color: T.t2, padding: '10px 8px', whiteSpace: 'nowrap' }}>{p.date}</td>
                  <td style={{ fontFamily: T.fm, fontSize: 9, color: T.t2, padding: '10px 8px' }}>{p.slides}</td>
                  <td style={{ padding: '10px 0' }}>
                    <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: T.empD, border: `1px solid ${T.empB}`, borderRadius: 4, fontFamily: T.fm, fontSize: 8, color: T.emp, cursor: 'pointer', letterSpacing: '.1em' }}>
                      <Icon name="download" size={10} color={T.emp} /> GET
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quick create */}
        <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.t2, letterSpacing: '.12em', marginBottom: 12 }}>// CORE_COMMAND</div>
          <div style={{ fontFamily: T.fd, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Initialize <span style={{ color: T.emp }}>New Node</span></div>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.t2, lineHeight: 1.75, letterSpacing: '.03em' }}>Deploy new presentation architecture via Groq Runtime — LLaMA 3.3-70b.</div>
          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.1em', marginBottom: 8 }}>QUICK_CONFIG</div>
            {['AUTO_TONE', 'SMART_IMAGES', 'THEME_NEON'].map((tag, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 6, marginBottom: 6, padding: '3px 8px', background: T.empD, border: `1px solid ${T.empB}`, borderRadius: 4, fontFamily: T.fm, fontSize: 8, color: T.emp }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: T.emp }} />{tag}
              </div>
            ))}
          </div>
          <button style={{ width: '100%', padding: '11px 0', marginTop: 14, background: `linear-gradient(135deg,${T.emp}CC,${T.emp})`, border: 'none', borderRadius: 6, fontFamily: T.fd, fontSize: 10, fontWeight: 700, letterSpacing: '.16em', color: '#fff', cursor: 'pointer', boxShadow: `0 0 20px ${T.empG}` }}>
            NEW_ARCHITECTURE
          </button>
        </div>
      </div>

      {/* 7-day chart */}
      <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.t2, letterSpacing: '.12em' }}>// GENERATION_ACTIVITY — Last 7 Days</div>
          <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.08em' }}>Total: {WEEK_DATA.reduce((a, b) => a + b, 0)} generations</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 80 }}>
          {WEEK_DATA.map((v, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontFamily: T.fm, fontSize: 8, color: v === maxW ? T.emp : T.t3 }}>{v}</div>
              <div style={{ width: '100%', background: v === maxW ? `linear-gradient(to top,${T.emp},${T.emp}AA)` : `linear-gradient(to top,${T.empB},${T.empB}60)`, borderRadius: '3px 3px 0 0', height: `${(v / maxW) * 56}px`, minHeight: 4, boxShadow: v === maxW ? `0 0 12px ${T.empG}` : 'none' }} />
              <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.05em' }}>{WEEK_DAYS[i]}</div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Creator Screen ─────────────────────────────────────────────────────────
function CreatorScreen() {
  const [tone, setTone] = useState('technical');
  const [theme, setTheme] = useState('ocean');
  const [slides, setSlides] = useState(7);
  const [provider, setProvider] = useState(null);

  const TONES = [
    { id: 'professional', label: 'PROFESSIONAL', em: '💼', sub: 'Corporate' },
    { id: 'executive', label: 'EXECUTIVE', em: '🏢', sub: 'C-suite' },
    { id: 'technical', label: 'TECHNICAL', em: '⚙️', sub: 'Devs' },
    { id: 'academic', label: 'ACADEMIC', em: '🎓', sub: 'Research' },
    { id: 'sales', label: 'SALES', em: '🚀', sub: 'Persuasive' },
    { id: 'simple', label: 'SIMPLE', em: '💬', sub: 'Beginner' },
  ];
  const THEMES = [
    { id: 'neon', color: '#00f0ff' }, { id: 'ocean', color: T.emp },
    { id: 'emerald', color: T.grn }, { id: 'royal', color: T.pur }, { id: 'light', color: '#e8f4ff' },
  ];
  const PROVIDERS = [
    { id: null, label: 'AUTO', color: T.emp },
    { id: 'nvidia', label: 'NVIDIA_NIM', color: '#76b900' },
    { id: 'groq', label: 'GROQ', color: '#f55a3c' },
  ];

  return (
    <AppLayout activeNav="/create" pageTitle="CREATE_PPT">
      <div style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 800, letterSpacing: '.06em', marginBottom: 3 }}>
        CREATE <span style={{ color: T.emp }}>PRESENTATION</span>
      </div>
      <div style={{ fontFamily: T.fm, fontSize: 9, color: T.t2, letterSpacing: '.06em', marginBottom: 24 }}>// Configure deck parameters — AI handles content, structure, and visuals</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title */}
          <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: 18 }}>
            <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.14em', marginBottom: 10 }}>
              <span style={{ color: `${T.emp}60` }}>01 // </span>PRESENTATION_TITLE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: 46, background: `${T.emp}05`, border: `1px solid ${T.empB}`, borderRadius: 6, padding: '0 14px', gap: 10 }}>
              <Icon name="file" size={13} color={`${T.emp}60`} />
              <span style={{ fontFamily: T.fm, fontSize: 12, color: T.t3 }}>e.g. Programming in C#</span>
            </div>
          </div>

          {/* Topics */}
          <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: 18 }}>
            <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.14em', marginBottom: 10 }}>
              <span style={{ color: `${T.emp}60` }}>02 // </span>KEY_TOPICS
              <span style={{ color: T.t3, fontSize: 7, marginLeft: 8 }}>Enter or comma to add</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px', background: `${T.emp}04`, border: `1px solid ${T.empB}`, borderRadius: 6, minHeight: 46 }}>
              {['Python Basics', 'OOP', 'Data Structures'].map(t => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: T.empD, border: `1px solid ${T.empB}`, borderRadius: 4, fontFamily: T.fm, fontSize: 10, color: T.emp }}>
                  {t} <span style={{ cursor: 'pointer', opacity: .5, fontSize: 12 }}>×</span>
                </span>
              ))}
              <span style={{ fontFamily: T.fm, fontSize: 10, color: T.t3, padding: '3px 4px' }}>Type a topic…</span>
            </div>
          </div>

          {/* Context */}
          <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: 18 }}>
            <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.14em', marginBottom: 10 }}>
              <span style={{ color: `${T.emp}60` }}>03 // </span>CONTEXT_GROUNDING
            </div>
            <div style={{ height: 86, background: `${T.emp}04`, border: `1px solid ${T.empB}`, borderRadius: 6, padding: 12 }}>
              <div style={{ fontFamily: T.fm, fontSize: 10, color: T.t3 }}>Describe your audience, goals, domain…</div>
            </div>
            <div style={{ marginTop: 8, padding: '10px 14px', border: `1px solid ${T.b0}`, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: T.b0 }}>
              <span style={{ fontSize: 14 }}>📁</span>
              <div style={{ fontFamily: T.fm, fontSize: 9, color: T.t3 }}>Upload <strong style={{ color: T.t2 }}>PDF</strong> or <strong style={{ color: T.t2 }}>DOCX</strong> for AI context injection</div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Tone */}
          <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: 18 }}>
            <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.14em', marginBottom: 12 }}>
              <span style={{ color: `${T.emp}60` }}>04 // </span>TONE_AUDIENCE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {TONES.map(t => (
                <div key={t.id} onClick={() => setTone(t.id)} style={{ padding: '10px 6px', textAlign: 'center', background: tone === t.id ? T.empD : 'transparent', border: `1px solid ${tone === t.id ? T.empB : T.b0}`, borderRadius: 8, cursor: 'pointer', transition: 'all .15s' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{t.em}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 8, color: tone === t.id ? T.emp : T.t3, letterSpacing: '.06em' }}>{t.label}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 7, color: T.t3, marginTop: 1 }}>{t.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: 18 }}>
            <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.14em', marginBottom: 10 }}>
              <span style={{ color: `${T.emp}60` }}>05 // </span>VISUAL_THEME
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {THEMES.map(th => (
                <div key={th.id} onClick={() => setTheme(th.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: theme === th.id ? `${th.color}14` : 'transparent', border: `1px solid ${theme === th.id ? th.color : T.b0}`, borderRadius: 20, cursor: 'pointer', transition: 'all .15s' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: th.color }} />
                  <span style={{ fontFamily: T.fm, fontSize: 9, color: theme === th.id ? th.color : T.t3, letterSpacing: '.1em' }}>{th.id.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Slides */}
          <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.14em' }}><span style={{ color: `${T.emp}60` }}>06 // </span>SLIDE_COUNT</div>
              <div style={{ fontFamily: T.fd, fontSize: 12, fontWeight: 700, color: T.emp, background: T.empD, border: `1px solid ${T.empB}`, padding: '2px 10px', borderRadius: 3 }}>{slides}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: T.fm, fontSize: 9, color: T.t3 }}>2</span>
              <div style={{ flex: 1, height: 4, background: T.b0, borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${((slides - 2) / 13) * 100}%`, background: `linear-gradient(90deg,${T.emp}80,${T.emp})`, borderRadius: 2, transition: 'width .2s' }} />
              </div>
              <span style={{ fontFamily: T.fm, fontSize: 9, color: T.t3 }}>15</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[3, 5, 7, 10, 12, 15].map(v => (
                <div key={v} onClick={() => setSlides(v)} style={{ padding: '4px 12px', background: slides === v ? T.empD : 'transparent', border: `1px solid ${slides === v ? T.empB : T.b0}`, borderRadius: 4, fontFamily: T.fm, fontSize: 9, color: slides === v ? T.emp : T.t3, cursor: 'pointer' }}>{v}</div>
              ))}
            </div>
          </div>

          {/* LLM */}
          <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: 18 }}>
            <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.14em', marginBottom: 10 }}><span style={{ color: `${T.emp}60` }}>07 // </span>LLM_MODEL</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {PROVIDERS.map(m => (
                <div key={String(m.id)} onClick={() => setProvider(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: provider === m.id ? `${m.color}12` : 'transparent', border: `1px solid ${provider === m.id ? m.color : T.b0}`, borderRadius: 20, cursor: 'pointer', transition: 'all .15s' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }} />
                  <span style={{ fontFamily: T.fm, fontSize: 9, color: provider === m.id ? m.color : T.t3, letterSpacing: '.08em' }}>{m.label}</span>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, marginTop: 8, letterSpacing: '.04em' }}>
              {provider === null ? '⚡ Auto-routes technical topics to NVIDIA NIM, general to Groq' : provider === 'nvidia' ? '⚡ Forces NVIDIA NIM (Kimi K2.5) for all generations' : '🟢 Forces Groq (LLaMA 3.3-70b) for all generations'}
            </div>
          </div>

          {/* Generate */}
          <button style={{ width: '100%', height: 52, background: `linear-gradient(135deg,${T.emp}CC,${T.emp})`, border: 'none', borderRadius: 8, fontFamily: T.fd, fontSize: 12, fontWeight: 700, letterSpacing: '.2em', color: '#fff', cursor: 'pointer', boxShadow: `0 0 30px ${T.empG}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Icon name="zap" size={16} color="#fff" />
            GENERATE_PRESENTATION
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Admin Screen ────────────────────────────────────────────────────────────
const MOCK_USERS = [
  { name: 'Madhesh P', email: 'madhesh@skynet.ai', role: 'EMPLOYEE', status: 'active', ppts: 47, joined: '2026-01-15' },
  { name: 'Priya S', email: 'priya@skynet.ai', role: 'ADMIN', status: 'active', ppts: 23, joined: '2026-02-01' },
  { name: 'Ravi K', email: 'ravi@skynet.ai', role: 'EMPLOYEE', status: 'suspended', ppts: 12, joined: '2026-03-10' },
  { name: 'Ananya M', email: 'ananya@skynet.ai', role: 'EMPLOYEE', status: 'pending', ppts: 0, joined: '2026-04-09' },
  { name: 'Karthik V', email: 'karthik@skynet.ai', role: 'EMPLOYEE', status: 'active', ppts: 31, joined: '2026-02-20' },
];

function AdminScreen() {
  const [tab, setTab] = useState('users');
  const SC = s => s === 'active' ? T.grn : s === 'suspended' ? T.adm : T.amb;
  const RC = r => r === 'ADMIN' ? T.pur : r === 'MASTER' ? T.adm : T.t2;

  return (
    <AppLayout activeNav="/admin" pageTitle="ADMIN_PANEL" userRole="ADMIN">
      <div style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 800, letterSpacing: '.06em', marginBottom: 3 }}>
        ADMIN <span style={{ color: T.adm }}>PANEL</span>
      </div>
      <div style={{ fontFamily: T.fm, fontSize: 9, color: T.t2, letterSpacing: '.06em', marginBottom: 20 }}>// CLEARANCE_REQUIRED — Elevated access controls active</div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="TOTAL_USERS" value="24" sub="Registered accounts" color={T.adm} barW="100%" />
        <StatCard label="PENDING_APPROVAL" value="4" sub="Awaiting review" color={T.amb} barW="16%" />
        <StatCard label="GLOBAL_GENERATIONS" value="1,847" sub="All-time PPTs generated" color={T.emp} barW="100%" />
        <StatCard label="SUSPENDED_USERS" value="2" sub="Access revoked" color={T.t2} barW="8%" />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${T.b1}`, marginBottom: 20 }}>
        {['overview', 'users', 'generations', 'pending'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 18px', background: 'transparent', border: 'none', borderBottom: tab === t ? `2px solid ${T.adm}` : '2px solid transparent', fontFamily: T.fm, fontSize: 9, letterSpacing: '.12em', color: tab === t ? T.adm : T.t3, cursor: 'pointer', marginBottom: -1 }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ background: T.bg2, border: `1px solid ${T.admB}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontFamily: T.fm, fontSize: 9, color: T.adm, letterSpacing: '.12em', marginBottom: 14 }}>// ADMIN_ACTIVITY_LOG</div>
          {[
            { time: '12:47:03', action: 'USER_APPROVED', target: 'ananya@skynet.ai', actor: 'ADMIN' },
            { time: '11:23:44', action: 'ROLE_CHANGED → ADMIN', target: 'priya@skynet.ai', actor: 'MASTER' },
            { time: '09:15:12', action: 'USER_SUSPENDED', target: 'ravi@skynet.ai', actor: 'ADMIN' },
            { time: '08:02:55', action: 'GENERATION_DELETED', target: 'PPT#8472', actor: 'ADMIN' },
          ].map((log, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '9px 0', borderBottom: `1px solid ${T.b0}`, fontFamily: T.fm, fontSize: 9 }}>
              <span style={{ color: T.t3, minWidth: 65 }}>{log.time}</span>
              <span style={{ color: T.adm, minWidth: 210 }}>{log.action}</span>
              <span style={{ color: T.t2 }}>{log.target}</span>
              <span style={{ marginLeft: 'auto', color: T.t3 }}>by {log.actor}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.b0}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: T.fm, fontSize: 9, color: T.t2, letterSpacing: '.1em' }}>// USER_MANAGEMENT — {MOCK_USERS.length} accounts</div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: T.admD, border: `1px solid ${T.admB}`, borderRadius: 6, fontFamily: T.fm, fontSize: 8, color: T.adm, cursor: 'pointer', letterSpacing: '.1em' }}>
              <Icon name="plus" size={10} color={T.adm} /> CREATE_USER
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.b0}` }}>
                {['USER', 'ROLE', 'STATUS', 'PPTs', 'JOINED', 'ACTIONS'].map(h => (
                  <th key={h} style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, letterSpacing: '.1em', padding: '10px 16px', textAlign: 'left', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_USERS.map((u, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.b0}` }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg,${T.emp}80,${T.emp})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.fm, fontSize: 10, color: '#fff', flexShrink: 0 }}>
                        {u.name.split(' ').map(w => w[0]).join('')}
                      </div>
                      <div>
                        <div style={{ fontFamily: T.fm, fontSize: 10, color: T.t1 }}>{u.name}</div>
                        <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3 }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontFamily: T.fm, fontSize: 8, color: RC(u.role), background: `${RC(u.role)}15`, border: `1px solid ${RC(u.role)}40`, padding: '2px 8px', borderRadius: 4, letterSpacing: '.08em' }}>{u.role}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: SC(u.status) }} />
                      <span style={{ fontFamily: T.fm, fontSize: 9, color: SC(u.status) }}>{u.status.toUpperCase()}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: T.fm, fontSize: 10, color: T.t2, padding: '12px 16px' }}>{u.ppts}</td>
                  <td style={{ fontFamily: T.fm, fontSize: 9, color: T.t3, padding: '12px 16px' }}>{u.joined}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ padding: '4px 10px', background: T.empD, border: `1px solid ${T.empB}`, borderRadius: 4, fontFamily: T.fm, fontSize: 8, color: T.emp, cursor: 'pointer', letterSpacing: '.08em' }}>EDIT</button>
                      <button style={{ padding: '4px 10px', background: T.admD, border: `1px solid ${T.admB}`, borderRadius: 4, fontFamily: T.fm, fontSize: 8, color: T.adm, cursor: 'pointer', letterSpacing: '.08em' }}>DEL</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(tab === 'generations' || tab === 'pending') && (
        <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: 60, textAlign: 'center' }}>
          <div style={{ fontFamily: T.fm, fontSize: 10, color: T.t3, letterSpacing: '.12em' }}>
            {tab === 'generations' ? '// GLOBAL_GENERATIONS — Loading generation logs…' : '// PENDING_APPROVALS — 4 users awaiting clearance review'}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ─── History Screen ─────────────────────────────────────────────────────────
function HistoryScreen() {
  return (
    <AppLayout activeNav="/history" pageTitle="HISTORY">
      <div style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 800, letterSpacing: '.06em', marginBottom: 3 }}>
        GENERATION <span style={{ color: T.emp }}>HISTORY</span>
      </div>
      <div style={{ fontFamily: T.fm, fontSize: 9, color: T.t2, letterSpacing: '.06em', marginBottom: 24 }}>// All your generated presentations — download, preview, or delete</div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, height: 40, background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 6, padding: '0 14px' }}>
          <span style={{ fontFamily: T.fm, fontSize: 9, color: T.t3 }}>🔍</span>
          <span style={{ fontFamily: T.fm, fontSize: 10, color: T.t3 }}>Search presentations…</span>
        </div>
        {['All Themes', 'All Tones', 'Sort: Date ↓'].map((f, i) => (
          <div key={i} style={{ height: 40, padding: '0 14px', background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 6, display: 'flex', alignItems: 'center', fontFamily: T.fm, fontSize: 9, color: T.t2, cursor: 'pointer', gap: 6 }}>
            {f} <span style={{ color: T.t3 }}>▾</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {MOCK_PPTS.concat([
          { title: 'Introduction to React', date: '2026-04-05', slides: 9, theme: 'emerald' },
          { title: 'Database Design Principles', date: '2026-04-04', slides: 11, theme: 'royal' },
        ]).map((p, i) => {
          const themeColor = { neon: '#00f0ff', ocean: T.emp, emerald: T.grn, royal: T.pur, light: '#e8f4ff' }[p.theme] || T.emp;
          return (
            <div key={i} style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer' }}>
              <div style={{ height: 80, background: `linear-gradient(135deg,${themeColor}18,${themeColor}08)`, borderBottom: `1px solid ${T.b0}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{ width: 48, height: 34, background: `${themeColor}20`, border: `1px solid ${themeColor}40`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.fd, fontSize: 8, color: themeColor }}>{p.slides}S</div>
                <div style={{ position: 'absolute', top: 8, right: 10, fontFamily: T.fm, fontSize: 7, color: themeColor, background: `${themeColor}15`, border: `1px solid ${themeColor}30`, padding: '2px 6px', borderRadius: 3 }}>{p.theme.toUpperCase()}</div>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontFamily: T.fm, fontSize: 10, color: T.t1, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                <div style={{ fontFamily: T.fm, fontSize: 8, color: T.t3, marginBottom: 12 }}>{p.date} · {p.slides} slides</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ flex: 1, padding: '6px 0', background: T.empD, border: `1px solid ${T.empB}`, borderRadius: 4, fontFamily: T.fm, fontSize: 8, color: T.emp, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Icon name="download" size={10} color={T.emp} /> GET
                  </button>
                  <button style={{ flex: 1, padding: '6px 0', background: T.b0, border: `1px solid ${T.b1}`, borderRadius: 4, fontFamily: T.fm, fontSize: 8, color: T.t2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Icon name="monitor" size={10} color={T.t2} /> VIEW
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────
const SCREENS = [
  { id: 'AUTH_EMP', label: 'Login — Employee' },
  { id: 'AUTH_ADM', label: 'Login — Admin' },
  { id: 'DASHBOARD', label: 'Dashboard' },
  { id: 'CREATOR', label: 'Create PPT' },
  { id: 'HISTORY', label: 'History' },
  { id: 'ADMIN', label: 'Admin Panel' },
];

export default function App() {
  const [screen, setScreen] = useState('AUTH_EMP');
  const [loginMode, setLoginMode] = useState('employee');

  const handleLoginMode = (m) => { setLoginMode(m); setScreen(m === 'admin' ? 'AUTH_ADM' : 'AUTH_EMP'); };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Share+Tech+Mono&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Screen switcher */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: 'rgba(2,4,10,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', padding: '7px 14px', gap: 6 }}>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: '#354060', letterSpacing: '.12em', marginRight: 8 }}>DESIGN_PREVIEW //</span>
        {SCREENS.map(s => (
          <button key={s.id} onClick={() => { setScreen(s.id); if (s.id === 'AUTH_ADM') setLoginMode('admin'); else if (s.id === 'AUTH_EMP') setLoginMode('employee'); }} style={{ padding: '5px 14px', background: screen === s.id ? 'rgba(61,90,254,0.14)' : 'transparent', border: `1px solid ${screen === s.id ? 'rgba(61,90,254,0.4)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 4, color: screen === s.id ? '#3D5AFE' : '#354060', fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: '.08em', cursor: 'pointer' }}>
            {s.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: '#354060' }}>← Click to switch screens</div>
      </div>

      <div style={{ paddingTop: 40, height: '100vh', boxSizing: 'border-box' }}>
        {(screen === 'AUTH_EMP' || screen === 'AUTH_ADM') && <AuthScreen loginMode={loginMode} setLoginMode={handleLoginMode} />}
        {screen === 'DASHBOARD' && <DashboardScreen />}
        {screen === 'CREATOR' && <CreatorScreen />}
        {screen === 'HISTORY' && <HistoryScreen />}
        {screen === 'ADMIN' && <AdminScreen />}
      </div>
    </>
  );
}
