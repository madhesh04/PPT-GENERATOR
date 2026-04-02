import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import './index.css';
import { useAuth } from './AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SlideData {
  title: string;
  content: string[];
  notes?: string;
  image_query?: string;
  image_base64?: string | null;
}

interface GenerateResponse {
  title: string;
  slides: SlideData[];
  theme: string;
  token: string;
  filename: string;
}

interface SavedPresentation {
  id: string;
  title: string;
  theme: string;
  created_at: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000';

function ThreeBackground() {
  const mountRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!mountRef.current) return;
    const cv = mountRef.current;
    const rr = new THREE.WebGLRenderer({canvas: cv, antialias: true, alpha: true});
    rr.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    rr.setClearColor(0x000000, 0);
    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, .1, 800);
    cam.position.set(0, 0, 5);
    const C = { cy: 0x00f0ff, gn: 0x00ff9d, bl: 0x0050c8 };
    const iA = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 1), new THREE.MeshBasicMaterial({color: C.cy, wireframe: true, transparent: true, opacity: .1}));
    iA.position.set(3.4, .2, -4); sc.add(iA);
    const iB = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), new THREE.MeshBasicMaterial({color: C.bl, wireframe: true, transparent: true, opacity: .055}));
    iB.position.set(3.4, .2, -4); sc.add(iB);
    const tA = new THREE.Mesh(new THREE.TorusGeometry(3.2, .007, 8, 110), new THREE.MeshBasicMaterial({color: C.cy, transparent: true, opacity: .15}));
    tA.position.set(3.4, 0, -5); tA.rotation.x = Math.PI * .28; sc.add(tA);
    const tB = new THREE.Mesh(new THREE.TorusGeometry(2.6, .005, 8, 90), new THREE.MeshBasicMaterial({color: C.gn, transparent: true, opacity: .09}));
    tB.position.set(3.4, 0, -5); tB.rotation.x = Math.PI * .55; tB.rotation.z = Math.PI * .18; sc.add(tB);
    const PC = 650, pos = new Float32Array(PC * 3);
    for(let i=0; i<PC; i++){
      pos[i*3] = (Math.random()-.5)*22;
      pos[i*3+1] = (Math.random()-.5)*12;
      pos[i*3+2] = (Math.random()-.5)*8-5;
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({color: C.cy, size: .022, transparent: true, opacity: .42, sizeAttenuation: true})); sc.add(pts);
    const gr = new THREE.GridHelper(28, 26, 0x001530, 0x001530); 
    if(!Array.isArray(gr.material)){ gr.material.transparent=true; gr.material.opacity=.45; }
    gr.position.set(0, -3.8, -5); gr.rotation.x = Math.PI * .035; sc.add(gr);
    let tx = 0, ty = 0, cx = 0, cy = 0, fr = 0;
    const onMM = (e: MouseEvent) => { tx=((e.clientX/window.innerWidth)-.5)*.55; ty=((e.clientY/window.innerHeight)-.5)*.28; };
    document.addEventListener('mousemove', onMM);
    const rsz = () => { const w=window.innerWidth, h=window.innerHeight; rr.setSize(w,h); cam.aspect=w/h; cam.updateProjectionMatrix(); };
    window.addEventListener('resize', rsz); rsz();
    let req: number;
    const anim = () => {
      req = requestAnimationFrame(anim);
      fr++; cx+=(tx-cx)*.04; cy+=(ty-cy)*.04;
      iA.rotation.x=fr*.0024+cy*.5; iA.rotation.y=fr*.0038+cx*.5;
      iB.rotation.x=fr*.003-cy*.3; iB.rotation.y=fr*.005-cx*.3;
      tA.rotation.z=fr*.003+cx*.2; tB.rotation.z=-fr*.004+cx*.15;
      pts.rotation.y=fr*.0004+cx*.08;
      cam.position.x=cx*.35; cam.position.y=-cy*.2; cam.lookAt(sc.position);
      rr.render(sc,cam);
    };
    anim();
    return () => { window.removeEventListener('resize', rsz); document.removeEventListener('mousemove', onMM); cancelAnimationFrame(req); rr.dispose(); pg.dispose(); };
  }, []);
  return <canvas id="bg-c" ref={mountRef}></canvas>;
}

function Cursor() {
  const co = useRef<HTMLDivElement>(null);
  const ci = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const outerPos = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const mm = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (ci.current) { ci.current.style.left = e.clientX + 'px'; ci.current.style.top = e.clientY + 'px'; }
    };
    document.addEventListener('mousemove', mm);
    let req: number;
    const loop = () => {
      outerPos.current.x += (mousePos.current.x - outerPos.current.x) * .13;
      outerPos.current.y += (mousePos.current.y - outerPos.current.y) * .13;
      if (co.current) { co.current.style.left = outerPos.current.x + 'px'; co.current.style.top = outerPos.current.y + 'px'; }
      req = requestAnimationFrame(loop);
    };
    loop();
    return () => { document.removeEventListener('mousemove', mm); cancelAnimationFrame(req); };
  }, []);
  return <><div className="cur-o" ref={co}></div><div className="cur-i" ref={ci}></div></>;
}

export default function App() {
  const { token, user, logout, isAuthenticated } = useAuth();
  const [authMode, setAuthMode] = useState<'login'|'signup'>('login');
  
  const [view, setView] = useState<'dashboard'|'create'|'preview'|'history'|'settings'|'admin'>('dashboard');
  const BC: Record<string,string> = {dashboard:'DASHBOARD',create:'CREATE_PPT',preview:'SLIDE_PREVIEW',history:'DECK_HISTORY',settings:'SETTINGS',admin:'ADMIN_PANEL'};

  const [toastData, setToastData] = useState({ show: false, msg: '' });
  const showToast = (msg: string, dur=3000) => {
    setToastData({ show: true, msg });
    setTimeout(() => setToastData(prev => ({ ...prev, show: false })), dur);
  };

  const [timeStr, setTimeStr] = useState('');
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const p = (v: number) => String(v).padStart(2, '0');
      setTimeStr(`${n.getFullYear()}.${p(n.getMonth()+1)}.${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())} IST`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // Creation State
  const [title, setTitle] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicIn, setTopicIn] = useState('');
  const [context, setContext] = useState('');
  const [tone, setTone] = useState('professional');
  const [theme, setTheme] = useState('neon');
  const [numSlides, setNumSlides] = useState(5);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [genSteps, setGenSteps] = useState([
    { id: 1, label: 'ANALYSING_TOPICS', status: 'pending', desc: '' },
    { id: 2, label: 'WRITING_CONTENT', status: 'pending', desc: '' },
    { id: 3, label: 'FETCHING_VISUALS', status: 'pending', desc: '' },
    { id: 4, label: 'BUILDING_PPTX', status: 'pending', desc: '' }
  ]);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);

  // Preview State
  const [previewSecOpen, setPreviewSecOpen] = useState(true);

  // Dashboard API State
  const [savedPresentations, setSavedPresentations] = useState<SavedPresentation[]>([]);

  // Admin API State
  const [adminPpts, setAdminPpts] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  const fetchAdminData = async () => {
    setLoadingAdmin(true);
    try {
      const [pptsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/admin/presentations`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (pptsRes.ok) {
        const pData = await pptsRes.json();
        setAdminPpts(pData.presentations || []);
      }
      if (usersRes.ok) {
        const uData = await usersRes.json();
        setAdminUsers(uData.users || []);
      }
    } catch (err) {
      showToast("Error fetching admin data");
    } finally {
      setLoadingAdmin(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && view === 'admin' && token && user?.role === 'admin') {
      fetchAdminData();
    }
  }, [view, isAuthenticated, token, user]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        showToast(`User role updated to ${newRole}`);
        fetchAdminData();
      } else {
        showToast("Failed to update role");
      }
    } catch (e) {
      showToast("Failed to update role");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user? This will also delete all their presentations.")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast("User deleted successfully");
        fetchAdminData();
      } else {
        showToast("Failed to delete user");
      }
    } catch (e) {
      showToast("Failed to delete user");
    }
  };

  const handleDeleteGlobalPpt = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this presentation?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/presentations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast("Presentation deleted");
        fetchAdminData();
      } else {
        showToast("Deletion failed");
      }
    } catch (e) {
      showToast("Deletion error");
    }
  };

  useEffect(() => {
    if(isAuthenticated && view === 'dashboard' && token){
      fetch(`${API_BASE}/presentations/me`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => setSavedPresentations(d.presentations))
        .catch(console.error);
    }
  }, [view, isAuthenticated, token]);

  const handleGenerate = async () => {
    if (!title.trim()) { setErrorMsg('ERROR_001 — Presentation title is required'); return; }
    if (!topics.length) { setErrorMsg('ERROR_002 — At least one topic is required'); return; }
    setErrorMsg('');
    setLoading(true);
    setGenSteps(prev => prev.map(s => ({ ...s, status: 'pending', desc: '' })));
    
    // Simulate initial steps for visual effect before true API waits
    const sDetails = [
      'Understanding structure and topic distribution…',
      'Generating slide content with LLM…',
      'Sourcing images via Pollinations / Unsplash…',
      'Assembling branded PPTX file…'
    ];
    
    for(let i=0; i<4; i++){
      setGenSteps(p => p.map((st, idx) => idx === i ? { ...st, status: 'active', desc: sDetails[i] } : st));
      await new Promise(r => setTimeout(r, 600)); // wait a bit per step UX
      if (i === 1) {
         try {
           const resp = await fetch(`${API_BASE}/generate`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
             body: JSON.stringify({ title, topics, num_slides: numSlides, context, tone, theme }),
           });
           if (!resp.ok) throw new Error((await resp.json()).detail || 'Failed');
           const data = await resp.json();
           setResult(data);
           setSlides(data.slides);
         } catch(err: any) {
           setErrorMsg(err.message || 'Generation failed');
           setLoading(false);
           return;
         }
      }
      setGenSteps(p => p.map((st, idx) => idx === i ? { ...st, status: 'done', desc: sDetails[i] } : st));
    }
    
    showToast('SUCCESS — Deck ready · Navigating to preview…', 2500);
    setTimeout(() => {
      setLoading(false);
      setView('preview');
    }, 1400);
  };

  const handleDownload = async (dlToken?: string, filename?: string) => {
    showToast('DOWNLOAD — Streaming PPTX...', 3000);
    const t = dlToken || result?.token;
    const f = filename || result?.filename || 'presentation.pptx';
    if (!t) return;
    try {
      const resp = await fetch(`${API_BASE}/download/${t}`, { headers:{ 'Authorization': `Bearer ${token}` }});
      if(resp.ok){
        const blob = await resp.blob();
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = f;
        document.body.appendChild(a); a.click(); a.remove();
      }
    } catch(e) { console.error(e); }
  };

  const handleRebuildExport = async () => {
    if (!result) return;
    showToast('REBUILD — Regenerating PPTX with latest edits...', 4000);
    try {
      const resp = await fetch(`${API_BASE}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: result.title, slides, theme }),
      });
      if (resp.ok) {
        const data = await resp.json();
        handleDownload(data.token, data.filename);
      }
    } catch(e) {}
  };

  if (!isAuthenticated) {
    return authMode === 'login' 
      ? <Login onSwitchToSignup={() => setAuthMode('signup')} /> 
      : <Signup onSwitchToLogin={() => setAuthMode('login')} />;
  }

  const pPct = genSteps.filter(s=>s.status==='done').length * 25 + (genSteps.find(s=>s.status==='active') ? 12 : 0);

  return (
    <div className="skynet-app">
      <Cursor />
      <ThreeBackground />
      <div className="bgo"></div>
      <div className="scl"></div>
      <div className="sbm"></div>
      <div className="cr ctl"></div><div className="cr ctr"></div>
      <div className="cr cbl"></div><div className="cr cbr"></div>

      <div className={`toast ${toastData.show ? 'sh' : ''}`}>
        <div className="sd g"></div><span>{toastData.msg}</span>
      </div>

      <header className="hdr">
        <div className="lw">
          <div className="lc">S</div>
          <div><div className="ln">SKY<span>NET</span></div><div className="lv">PPT_GEN v2.4.0</div></div>
        </div>
        <div className="hc">
          <div className="hbc">SKYNET <span className="bcs">/</span> <span className="bca">{BC[view]}</span></div>
        </div>
        <div className="hr2">
          <div className="hbdg"><div className="sd g"></div>ALL_SYSTEMS_NOMINAL</div>
          <div className="husr" onClick={logout} title="Click to logout">
            <div className="hav">{user?.full_name?.[0].toUpperCase() || 'U'}</div>
            <div className="hun">{user?.full_name?.split(' ')[0] || 'User'}</div>
          </div>
        </div>
      </header>

      <aside className="sb">
        <div className="ns">
          <div className="nsl">// NAVIGATION</div>
          <div className={`ni ${view==='dashboard'?'act':''}`} onClick={()=>setView('dashboard')}>
            <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span className="ni-lbl">DASHBOARD</span>
          </div>
          <div className={`ni ${view==='create'?'act':''}`} onClick={()=>setView('create')}>
            <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14"/></svg>
            <span className="ni-lbl">CREATE_PPT</span>
          </div>
          <div className={`ni ${view==='preview'?'act':''}`} onClick={()=>setView('preview')}>
            <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            <span className="ni-lbl">PREVIEW</span>
            {slides.length > 0 && <span className="ni-b">{slides.length}</span>}
          </div>
        </div>
        <div className="ndv"></div>
        <div className="ns">
          <div className="nsl">// SYSTEM</div>
          <div className={`ni ${view==='history'?'act':''}`} onClick={()=>setView('history')}>
            <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span className="ni-lbl">HISTORY</span>
          </div>
          <div className={`ni ${view==='settings'?'act':''}`} onClick={()=>setView('settings')}>
            <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            <span className="ni-lbl">SETTINGS</span>
          </div>
          <div className="ni" onClick={()=>{ showToast('LOGOUT — Session terminated...'); setTimeout(logout, 500)}}>
            <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            <span className="ni-lbl">LOGOUT</span>
          </div>
        </div>
        {user?.role === 'admin' && (
          <div className="ns">
            <div className="nsl">// ADMINISTRATION</div>
            <div className={`ni ${view==='admin'?'act':''}`} onClick={()=>setView('admin')}>
              <svg className="ni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span className="ni-lbl">ADMIN PANEL</span>
            </div>
          </div>
        )}
        <div className="sbf">SKYNET_CORE v2.4.0<br/>GROQ_LLM // CONNECTED<br/>IMAGE_API // ACTIVE</div>
      </aside>

      <main className="main">
        {/* DASHBOARD */}
        <div className={`pg ${view==='dashboard'?'act':''}`}>
          <div className="pey">// SYSTEM_OVERVIEW</div>
          <div className="ptl">DASH<span className="ac">BOARD</span></div>
          <div className="psub">// Real-time metrics · Presentation artifacts context node</div>

          <div className="sgd">
            <div className="scard">
              <div className="sclbl">TOTAL_HOURS_TRACKED</div>
              <div className="scval cy">10,634</div>
              <div className="scsub">This month · all trainers</div>
              <div className="scbar2" style={{background:'linear-gradient(90deg,var(--cy),#0060ff)', width:'94%'}}></div>
            </div>
            <div className="scard">
              <div className="sclbl">TASKS_COMPLETED</div>
              <div className="scval gn">4,058</div>
              <div className="scsub">95.1% completion rate</div>
              <div className="scbar2" style={{background:'var(--gn)', width:'95%'}}></div>
            </div>
            <div className="scard">
              <div className="sclbl">PPT_DECKS_GENERATED</div>
              <div className="scval am">{savedPresentations.length} Local</div>
              <div className="scsub">Saved in personal node</div>
              <div className="scbar2" style={{background:'var(--am)', width:'42%'}}></div>
            </div>
            <div className="scard">
              <div className="sclbl">LLM_MODEL</div>
              <div className="scval" style={{fontSize:13, color:'var(--pu)', marginTop:4}}>LLaMA 3.3</div>
              <div className="scsub">Groq · 70B-versatile</div>
              <div className="scbar2" style={{background:'var(--pu)', width:'100%'}}></div>
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20}}>
            <div className="card" style={{padding:22}}>
              <div className="cc tl"></div><div className="cc tr"></div><div className="cc bl"></div><div className="cc br"></div>
              <div className="fl mb8">// QUICK_START</div>
              <div className="ptl" style={{fontSize:15, marginBottom:8}}>Generate a <span className="ac">new deck</span></div>
              <div style={{fontFamily:'var(--fm)', fontSize:10, color:'var(--t2)', lineHeight:1.75, letterSpacing:'.04em', marginBottom:18}}>Describe your topic, pick a tone, and let SKYNET build a branded PowerPoint in seconds using Groq LLaMA 3.3.</div>
              <button className="btn bp shim" onClick={()=>setView('create')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg> CREATE_PRESENTATION
              </button>
            </div>
            
            <div className="card" style={{padding:22}}>
              <div className="cc tl"></div><div className="cc tr"></div><div className="cc bl"></div><div className="cc br"></div>
              <div className="fl mb8">// LAST_SESSION</div>
              {savedPresentations.length > 0 ? (() => {
                 const p = savedPresentations[0];
                 return (
                   <>
                    <div className="ptl" style={{fontSize:15, marginBottom:8, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.title}</div>
                    <div style={{fontFamily:'var(--fm)', fontSize:10, color:'var(--t2)', lineHeight:1.75, letterSpacing:'.04em', marginBottom:18}}>Saved node · {p.theme} theme · Generated on {new Date(p.created_at).toLocaleDateString()}</div>
                    <div className="fx gap8">
                      <button className="btn bs bsm" style={{borderColor:'var(--gn)', color:'var(--gn)'}} onClick={()=>handleDownload(p.id, p.title+'.pptx')}>DOWNLOAD_PPTX</button>
                    </div>
                   </>
                 );
              })() : (
                 <div style={{fontFamily:'var(--fm)', fontSize:10, color:'var(--t3)', marginTop: 20}}>NO PREVIOUS SESSION FOUND. INITIATE NEW DECK.</div>
              )}
            </div>
          </div>
        </div>

        {/* CREATE */}
        <div className={`pg ${view==='create'?'act':''}`}>
          <div className="pey">// GENERATION_ENGINE</div>
          <div className="ptl">CREATE <span className="ac">PRESENTATION</span></div>
          <div className="psub">// Configure deck parameters — AI will handle content, structure and visuals</div>

          <div className={`errbx mb16 ${errorMsg ? 'sh' : ''}`}><div className="erri">!</div><span>{errorMsg}</span></div>

          <div className="fgrid">
            <div className="fcol">
              <div className="fg">
                <div className="fl"><span className="fn">01 //</span> PRESENTATION_TITLE</div>
                <div className="fb2">
                  <svg className="fi" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <input className="finp" value={title} onChange={e=>setTitle(e.target.value)} disabled={loading} placeholder="e.g. Programming in C#"/>
                </div>
              </div>
              <div className="fg">
                <div className="fl"><span className="fn">02 //</span> KEY_TOPICS <span style={{color:'var(--t3)',fontSize:8,marginLeft:4}}>Enter or comma to add</span></div>
                <div className="ta" onClick={()=>document.getElementById('ti_id')?.focus()}>
                  {topics.map((t, idx) => (
                    <span key={idx} className="tc">{t} <button className="tx" onClick={()=>setTopics(prev=>prev.filter((_,i)=>i!==idx))}>×</button></span>
                  ))}
                  <input id="ti_id" className="tii" value={topicIn} disabled={loading} placeholder="Type a topic…" 
                    onChange={e=>setTopicIn(e.target.value)} 
                    onBlur={()=>{if(topicIn.trim() && !topics.includes(topicIn.trim())) { setTopics([...topics, topicIn.trim()]); setTopicIn(''); }}}
                    onKeyDown={e=>{
                      if((e.key==='Enter' || e.key===',') && topicIn.trim()){ e.preventDefault(); if(!topics.includes(topicIn.trim())) setTopics([...topics, topicIn.trim()]); setTopicIn(''); }
                      else if(e.key==='Backspace' && !topicIn && topics.length){ setTopics(prev=>prev.slice(0,-1)); }
                    }} 
                  />
                </div>
              </div>
              <div className="fg">
                <div className="fl"><span className="fn">03 //</span> CONTEXT_GROUNDING</div>
                <div className="tcsm">
                  <div className="fb2 fta" style={{height:100}}><textarea className="finp" value={context} onChange={e=>setContext(e.target.value)} disabled={loading} placeholder="Describe your audience, goals, domain…" style={{height:78,resize:'none'}}></textarea></div>
                  <div className="upbx" onClick={()=>showToast('FILE_UPLOAD — Context injection module coming soon')}><div className="upi">📁</div><div className="upl">Upload <strong>PDF</strong> or <strong>DOCX</strong> for AI context</div></div>
                </div>
              </div>
            </div>

            <div className="fcol">
              <div className="fg">
                <div className="fl"><span className="fn">04 //</span> TONE_AUDIENCE</div>
                <div className="tg">
                  <div className={`tcard ${tone==='professional'?'act':''}`} onClick={()=>{if(!loading)setTone('professional')}}><div className="tem">💼</div><div className="tnm">PROFESSIONAL</div><div className="tds">Corporate</div></div>
                  <div className={`tcard ${tone==='executive'?'act':''}`} onClick={()=>{if(!loading)setTone('executive')}}><div className="tem">🏢</div><div className="tnm">EXECUTIVE</div><div className="tds">C-suite</div></div>
                  <div className={`tcard ${tone==='technical'?'act':''}`} onClick={()=>{if(!loading)setTone('technical')}}><div className="tem">⚙️</div><div className="tnm">TECHNICAL</div><div className="tds">Devs</div></div>
                  <div className={`tcard ${tone==='academic'?'act':''}`} onClick={()=>{if(!loading)setTone('academic')}}><div className="tem">🎓</div><div className="tnm">ACADEMIC</div><div className="tds">Research</div></div>
                  <div className={`tcard ${tone==='sales'?'act':''}`} onClick={()=>{if(!loading)setTone('sales')}}><div className="tem">🚀</div><div className="tnm">SALES</div><div className="tds">Persuasive</div></div>
                  <div className={`tcard ${tone==='simple'?'act':''}`} onClick={()=>{if(!loading)setTone('simple')}}><div className="tem">💬</div><div className="tnm">SIMPLE</div><div className="tds">Beginner</div></div>
                </div>
              </div>
              <div className="fg">
                <div className="fl"><span className="fn">05 //</span> VISUAL_THEME</div>
                <div className="thr">
                  <div className={`tpill ${theme==='neon'?'act':''}`} onClick={()=>{if(!loading)setTheme('neon')}}><div className="tdot" style={{background:'#00f0ff'}}></div>NEON</div>
                  <div className={`tpill ${theme==='ocean'?'act':''}`} onClick={()=>{if(!loading)setTheme('ocean')}}><div className="tdot" style={{background:'#3b82f6'}}></div>OCEAN</div>
                  <div className={`tpill ${theme==='emerald'?'act':''}`} onClick={()=>{if(!loading)setTheme('emerald')}}><div className="tdot" style={{background:'#00ff9d'}}></div>EMERALD</div>
                  <div className={`tpill ${theme==='royal'?'act':''}`} onClick={()=>{if(!loading)setTheme('royal')}}><div className="tdot" style={{background:'#a855f7'}}></div>ROYAL</div>
                  <div className={`tpill ${theme==='light'?'act':''}`} onClick={()=>{if(!loading)setTheme('light')}}><div className="tdot" style={{background:'#e8f4ff',border:'1px solid rgba(255,255,255,.2)'}}></div>LIGHT</div>
                </div>
              </div>
              <div className="fg">
                <div className="fl jcb">
                  <span><span className="fn">06 //</span> SLIDE_COUNT</span>
                  <span style={{fontFamily:'var(--fd)',fontSize:12,fontWeight:700,color:'var(--cy)',background:'rgba(0,240,255,.08)',border:'1px solid rgba(0,240,255,.2)',padding:'2px 10px',borderRadius:3}}>{numSlides}</span>
                </div>
                <div className="slw">
                  <span className="slb">2</span>
                  <div className="sltr">
                    <div className="slf" style={{width: `${((numSlides-2)/13)*100}%`}}></div>
                    <div className="slth" style={{left: `${((numSlides-2)/13)*100}%`}}></div>
                    <input type="range" className="slrng" disabled={loading} min="2" max="15" value={numSlides} step="1" onChange={e=>setNumSlides(parseInt(e.target.value))}/>
                  </div>
                  <span className="slb">15</span>
                </div>
                <div className="prow">
                  {[3,5,7,10,12,15].map(v => (
                    <div key={v} className={`pc ${numSlides===v?'act':''}`} onClick={()=>{if(!loading)setNumSlides(v)}}>{v}</div>
                  ))}
                </div>
              </div>
              
              <button disabled={loading} className="btn bp shim bfw" onClick={handleGenerate} style={{height:50, marginTop:4}}>
                {loading && <div className="spn" style={{borderColor:'rgba(255,255,255,.2)', borderTopColor:'#fff'}}></div>}
                <span>✦ {loading ? 'GENERATING...' : 'GENERATE_PRESENTATION'}</span>
              </button>
              
              {loading && (
                <div className="pgw">
                  <div className="pgt"><div className="pgf" style={{width:`${pPct}%`}}></div></div>
                  <div className="pgs">
                    {genSteps.map(s => (
                      <div key={s.id} className={`pgstp ${s.status==='done'?'dn':s.status==='active'?'ac':''}`}>
                        <div className="pgdw">
                           {s.status === 'done' ? '✓' : s.status === 'active' ? <div className="spn" style={{borderColor:'rgba(0,240,255,.2)', borderTopColor:'var(--cy)'}}></div> : '◎'}
                        </div>
                        <div>
                          <div className="pgl">{s.label}</div>
                          <div className="pgd">{s.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PREVIEW */}
        <div className={`pg ${view==='preview'?'act':''}`}>
          <div className="pey">// SLIDE_PREVIEW_ENGINE</div>
          <div className="ptl">SLIDE <span className="ac">PREVIEW</span></div>
          <div className="psub">// {slides.length} slides · {result?.title || 'Untitled'} · {tone} tone</div>

          {result ? (
            <>
              <div className="pvhdr">
                <div><div className="pvtl">{result.title}</div><div className="pvmt">{slides.length} slides · {tone} · Generated just now</div></div>
                <div className="pvac">
                  <button className="btn bs bsm" onClick={()=>showToast('PDF_EXPORT — Coming soon')}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PDF
                  </button>
                  <button className="btn bs bsm" onClick={()=>handleDownload()}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> DOWNLOAD
                  </button>
                  <button className="btn bp shim bsm" onClick={handleRebuildExport}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg> REBUILD_EXPORT
                  </button>
                </div>
              </div>

              <div className="tstrip">
                {slides.map((s, idx) => {
                  const isActive = false; // Could wire this to scroll state
                  return (
                    <div key={idx} className={`th ${isActive?'act':''}`} onClick={()=>document.getElementById(`slide-card-${idx}`)?.scrollIntoView({behavior:'smooth', block:'center'})}>
                      <div className="thi">
                        <div className="th2c">
                          <div className="thls" style={{flex:1}}>
                            <div className="thl" style={{background:['var(--cy)','var(--or)','#0d9488','#d97706'][idx%4]}}></div>
                            <div className="thline" style={{width:'100%'}}></div><div className="thline" style={{width:'80%'}}></div>
                          </div>
                          {s.image_query && <div className="thimg" style={s.image_base64 ? {backgroundImage:`url(${s.image_base64})`,backgroundSize:'cover'} : {}}></div>}
                        </div>
                      </div>
                      <div className="thnum">{idx+1}</div>
                    </div>
                  );
                })}
              </div>

              <div className="stog" onClick={()=>setPreviewSecOpen(!previewSecOpen)}>
                <span className={`stch ${previewSecOpen ? 'op' : 'cl'}`}>▼</span>
                <span style={{fontSize:13}}>📝</span>
                <span className="sttl">EDIT_SLIDE_CONTENT</span>
                <span className="stct">{slides.length} CONTENT_SLIDES</span>
              </div>

              <div className="sbody" style={{display: previewSecOpen ? 'block' : 'none'}}>
                <div className="sgrid">
                  {slides.map((slide, idx) => {
                    const color = ['#00f0ff','#ff6b35','#0d9488','#d97706'][idx%4];
                    const bg = [`rgba(0,240,255,.1)`,`rgba(255,107,53,.1)`,`rgba(13,148,136,.1)`,`rgba(217,119,6,.1)`][idx%4];

                    const handleTitleChange = (val: string) => {
                      const newSlides = [...slides];
                      newSlides[idx].title = val;
                      setSlides(newSlides);
                    };

                    const handleBulletChange = (bIdx: number, val: string) => {
                      const newSlides = [...slides];
                      newSlides[idx].content[bIdx] = val;
                      setSlides(newSlides);
                    };

                    return (
                      <div key={idx} id={`slide-card-${idx}`} className="sc">
                        <div className="sch">
                          <div className="scbar" style={{background:color}}></div>
                          <div className="scn" style={{background:bg,color:color,border:`1px solid ${color}40`}}>{String(idx+1).padStart(2,'0')}</div>
                          <input className="sct" value={slide.title} onChange={e=>handleTitleChange(e.target.value)} />
                        </div>
                        <div className="scb">
                          <div className="scbuls">
                            {slide.content.map((pt, bIdx) => (
                              <div key={bIdx} className="scbul">
                                <div className="scdot" style={{background:color}}></div>
                                <textarea className="sctxt" value={pt} onChange={e=>handleBulletChange(bIdx, e.target.value)} />
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="sciph">
                              {slide.image_base64 ? (
                                <img src={slide.image_base64} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.6}} />
                              ) : (
                                <><div className="scii">🖼</div><div className="scil">NO_IMAGE</div></>
                              )}
                            </div>
                            <button className="rgn" onClick={async ()=>{
                              showToast(`REGEN — Fetching image for slide ${idx+1}...`);
                              try {
                                const r = await fetch(`${API_BASE}/regenerate-image`, {
                                  method:'POST',
                                  headers:{'Content-Type':'application/json','Authorization': `Bearer ${token}`},
                                  body:JSON.stringify({ query: slide.image_query || slide.title })
                                });
                                if(r.ok){ const {image_base64} = await r.json(); const ns=[...slides]; ns[idx].image_base64=image_base64; setSlides(ns); }
                              } catch(e){}
                            }}>✦ REGEN_IMAGE</button>
                            <button className="rgn" style={{marginTop:4}} onClick={async ()=>{
                              showToast(`REGEN — Rewriting slide content...`);
                              try {
                                const r = await fetch(`${API_BASE}/regenerate-slide`, {
                                  method:'POST',
                                  headers:{'Content-Type':'application/json','Authorization': `Bearer ${token}`},
                                  body:JSON.stringify({ title: result.title, context, tone, existing_titles: slides.map(s=>s.title) })
                                });
                                if (r.ok){ const n = await r.json(); const ns=[...slides]; ns[idx]=n; setSlides(ns); }
                              } catch(e){}
                            }}>✦ REGEN_TEXT</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
             <div style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:'50vh', flexDirection:'column', gap:10}}>
                <div style={{fontFamily:'var(--fd)', fontSize:24, color:'var(--t3)'}}>NO DECK LOADED</div>
                <button className="btn bs" onClick={()=>setView('create')}>GO TO CREATION FLIGHT DECK</button>
             </div>
          )}
        </div>

        {/* HISTORY */}
        <div className={`pg ${view==='history'?'act':''}`}>
          <div className="pey">// GENERATION_LOG</div>
          <div className="ptl">DECK <span className="ac">HISTORY</span></div>
          <div className="psub">// All previously generated presentations</div>
          
          <div className="card" style={{overflow:'x-auto'}}>
            <div className="cc tl"></div><div className="cc tr"></div>
            <table className="htbl">
              <thead><tr><th>DECK_TITLE</th><th>THEME</th><th>GENERATED</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {savedPresentations.length === 0 ? (
                  <tr><td colSpan={5} style={{textAlign:'center', padding:40, color:'var(--t3)'}}>NO RECORDS.</td></tr>
                ) : savedPresentations.map((p) => (
                  <tr key={p.id}>
                    <td className="cy">{p.title}</td>
                    <td>{p.theme}</td>
                    <td>{new Date(p.created_at).toLocaleString()}</td>
                    <td><span className="hbdg dn">SAVED_DISK</span></td>
                    <td><button className="btn bs bsm" onClick={()=>handleDownload(p.id, p.title+'.pptx')}>DOWNLOAD</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SETTINGS */}
        <div className={`pg ${view==='settings'?'act':''}`}>
          <div className="pey">// SYSTEM_CONFIGURATION</div>
          <div className="ptl">SYSTEM <span className="ac">SETTINGS</span></div>
          <div className="psub">// API configuration & rendering parameters</div>
          <div className="setgrid">
            <div className="card" style={{padding:22}}>
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
            <div className="card" style={{padding:22}}>
              <div className="cc tl"></div><div className="cc tr"></div>
              <div className="fl mb12">// GENERATION_PREFS</div>
              <div className="setr"><div><div className="setlbl">IMAGE_GENERATION</div><div className="setdsc">Fetch images per slide</div></div><div className="tsw on"><div className="tknob"></div></div></div>
              <div className="setr"><div><div className="setlbl">SPEAKER_NOTES</div><div className="setdsc">Auto-generate presenter notes</div></div><div className="tsw on"><div className="tknob"></div></div></div>
              <div className="setr" style={{borderBottom:'none'}}><div><div className="setlbl">DEFAULT_MODEL</div><div className="setdsc">LLM model selection</div></div>
                <select className="seld"><option>llama-3.3-70b-versatile</option></select>
              </div>
            </div>
          </div>
        </div>

        {/* ADMIN */}
        {user?.role === 'admin' && (
          <div className={`pg ${view==='admin'?'act':''}`}>
            <div className="pey">// SYSTEM_ADMINISTRATION</div>
            <div className="ptl">GLOBAL <span className="ac">CONTROL_PANEL</span></div>
            <div className="psub">// Oversee platform metrics, users, and all generated artifacts</div>

            <div className="card mb20">
              <div className="stog">
                <svg viewBox="0 0 24 24" className="w-[14px] h-[14px] text-[rgba(0,240,255,0.7)]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                <div className="sttl" style={{marginLeft: 8}}>REGISTERED USERS</div>
              </div>
              <div className="sbody" style={{ padding: 0 }}>
                <div className="overflow-x-auto">
                  <table className="htbl">
                    <thead>
                      <tr><th>EMAIL</th><th>NAME</th><th>ROLE</th><th>ACTIONS</th></tr>
                    </thead>
                    <tbody>
                      {adminUsers.map(u => (
                        <tr key={u.id}>
                          <td style={{fontFamily:'var(--fd)', color:'var(--cy)'}}>{u.email}</td>
                          <td>{u.full_name}</td>
                          <td>
                            <select 
                              className="seld" style={{background:'rgba(0,240,255,.05)', border:'1px solid rgba(0,240,255,.2)'}}
                              value={u.role || 'user'}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td>
                            <button className="btn bs bsm" style={{color:'var(--rd)', borderColor:'rgba(255,45,85,.3)'}} onClick={() => handleDeleteUser(u.id)}>DELETE</button>
                          </td>
                        </tr>
                      ))}
                      {adminUsers.length === 0 && (
                        <tr><td colSpan={4} style={{textAlign:'center', padding:40, color:'var(--t3)'}}>NO USERS FOUND.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="stog">
                <svg viewBox="0 0 24 24" className="w-[14px] h-[14px] text-[rgba(0,240,255,0.7)]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h14a2 2 0 002-2V7.5L14.5 2H6a2 2 0 00-2 2v4"/><polyline points="14 2 14 8 20 8"/><path d="M2 15h10"/><path d="M9 18l3-3-3-3"/></svg>
                <div className="sttl" style={{marginLeft: 8}}>GLOBAL PRESENTATIONS</div>
              </div>
              <div className="sbody" style={{ padding: 0 }}>
                <div className="overflow-x-auto">
                  <table className="htbl">
                    <thead>
                      <tr><th>ID</th><th>TITLE</th><th>OWNER</th><th>THEME</th><th>ACTIONS</th></tr>
                    </thead>
                    <tbody>
                      {adminPpts.map(p => (
                        <tr key={p.id}>
                          <td style={{fontFamily:'var(--fm)', fontSize:8}}>{p.id}</td>
                          <td className="cy font-bold">{p.title}</td>
                          <td>{p.owner_email || 'Unknown'}</td>
                          <td><span className="hbdg pr">{p.theme?.toUpperCase() || 'NEON'}</span></td>
                          <td>
                            <button className="btn bs bsm" style={{color:'var(--rd)', borderColor:'rgba(255,45,85,.3)'}} onClick={() => handleDeleteGlobalPpt(p.id)}>PURGE</button>
                          </td>
                        </tr>
                      ))}
                      {adminPpts.length === 0 && (
                        <tr><td colSpan={5} style={{textAlign:'center', padding:40, color:'var(--t3)'}}>NO PRESENTATIONS EXIST.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* STATUS BAR */}
      <div className="sbar">
        <div className="si"><div className="sd g"></div>CORE_ONLINE</div>
        <div className="si"><div className="sd c"></div>LLM_CONNECTED</div>
        <div className="si"><div className="sd a"></div>IMAGE_API_ACTIVE</div>
        <div className="sclk">{timeStr}</div>
      </div>
    </div>
  );
}
