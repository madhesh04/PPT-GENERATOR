import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePresentationStore } from '../store/usePresentationStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';

export default function CreatorView() {
  const {
    title, setTitle,
    topics, setTopics,
    context, setContext,
    tone, setTone,
    theme, setTheme,
    numSlides, setNumSlides,
    forceProvider, setForceProvider,
    loading, errorMsg, genSteps,
    generatePresentation
  } = usePresentationStore();

  const { token } = useAuthStore();
  const { showToast } = useAppStore();
  const [topicIn, setTopicIn] = useState('');
  const navigate = useNavigate();

  const handleStartGeneration = async () => {
    if (!token) return;
    await generatePresentation(token, () => {
      showToast('SUCCESS — Deck ready · Navigating to preview…', 2500);
      setTimeout(() => {
        navigate('/preview');
      }, 1400);
    });
  };

  const pPct = genSteps.filter(s => s.status === 'done').length * 25 + (genSteps.find(s => s.status === 'active') ? 12 : 0);

  return (
    <div className="pg act">
      <div className="pey">// GENERATION_ENGINE</div>
      <div className="ptl">CREATE <span className="ac">PRESENTATION</span></div>
      <div className="psub">// Configure deck parameters — AI will handle content, structure and visuals</div>

      <div className={`errbx mb16 ${errorMsg ? 'sh' : ''}`}><div className="erri">!</div><span>{errorMsg}</span></div>

      <div className="fgrid">
        <div className="fcol">
          <div className="fg">
            <div className="fl"><span className="fn">01 //</span> PRESENTATION_TITLE</div>
            <div className="fb2">
              <svg className="fi" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              <input className="finp" value={title} onChange={e => setTitle(e.target.value)} disabled={loading} placeholder="e.g. Programming in C#" />
            </div>
          </div>
          <div className="fg">
            <div className="fl"><span className="fn">02 //</span> KEY_TOPICS <span style={{ color: 'var(--t3)', fontSize: 8, marginLeft: 4 }}>Enter or comma to add</span></div>
            <div className="ta" onClick={() => document.getElementById('ti_id')?.focus()}>
              {topics.map((t, idx) => (
                <span key={idx} className="tc">{t} <button className="tx" onClick={() => setTopics(topics.filter((_, i) => i !== idx))}>×</button></span>
              ))}
              <input id="ti_id" className="tii" value={topicIn} disabled={loading} placeholder="Type a topic…"
                onChange={e => setTopicIn(e.target.value)}
                onBlur={() => { if (topicIn.trim() && !topics.includes(topicIn.trim())) { setTopics([...topics, topicIn.trim()]); setTopicIn(''); } }}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && topicIn.trim()) { e.preventDefault(); if (!topics.includes(topicIn.trim())) setTopics([...topics, topicIn.trim()]); setTopicIn(''); }
                  else if (e.key === 'Backspace' && !topicIn && topics.length) { setTopics(topics.slice(0, -1)); }
                }}
              />
            </div>
          </div>
          <div className="fg">
            <div className="fl"><span className="fn">03 //</span> CONTEXT_GROUNDING</div>
            <div className="tcsm">
              <div className="fb2 fta" style={{ height: 100 }}><textarea className="finp" value={context} onChange={e => setContext(e.target.value)} disabled={loading} placeholder="Describe your audience, goals, domain…" style={{ height: 78, resize: 'none' }}></textarea></div>
              <div className="upbx" onClick={() => showToast('FILE_UPLOAD — Context injection module coming soon')}><div className="upi">📁</div><div className="upl">Upload <strong>PDF</strong> or <strong>DOCX</strong> for AI context</div></div>
            </div>
          </div>
        </div>

        <div className="fcol">
          <div className="fg">
            <div className="fl"><span className="fn">04 //</span> TONE_AUDIENCE</div>
            <div className="tg">
              {['professional', 'executive', 'technical', 'academic', 'sales', 'simple'].map(t => (
                <div key={t} className={`tcard ${tone === t ? 'act' : ''}`} onClick={() => { if (!loading) setTone(t) }}>
                  <div className="tem">{t === 'professional' ? '💼' : t === 'executive' ? '🏢' : t === 'technical' ? '⚙️' : t === 'academic' ? '🎓' : t === 'sales' ? '🚀' : '💬'}</div>
                  <div className="tnm">{t.toUpperCase()}</div>
                  <div className="tds">{t === 'professional' ? 'Corporate' : t === 'executive' ? 'C-suite' : t === 'technical' ? 'Devs' : t === 'academic' ? 'Research' : t === 'sales' ? 'Persuasive' : 'Beginner'}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="fg">
            <div className="fl"><span className="fn">05 //</span> VISUAL_THEME</div>
            <div className="thr">
              {['neon', 'ocean', 'emerald', 'royal', 'light'].map(thm => (
                <div key={thm} className={`tpill ${theme === thm ? 'act' : ''}`} onClick={() => { if (!loading) setTheme(thm) }}>
                  <div className="tdot" style={{ background: thm === 'neon' ? '#00f0ff' : thm === 'ocean' ? '#3b82f6' : thm === 'emerald' ? '#00ff9d' : thm === 'royal' ? '#a855f7' : '#e8f4ff' }}></div>{thm.toUpperCase()}
                </div>
              ))}
            </div>
          </div>
          <div className="fg">
            <div className="fl jcb">
              <span><span className="fn">06 //</span> SLIDE_COUNT</span>
              <span style={{ fontFamily: 'var(--fd)', fontSize: 12, fontWeight: 700, color: 'var(--cy)', background: 'rgba(0,240,255,.08)', border: '1px solid rgba(0,240,255,.2)', padding: '2px 10px', borderRadius: 3 }}>{numSlides}</span>
            </div>
            <div className="slw">
              <span className="slb">2</span>
              <div className="sltr">
                <div className="slf" style={{ width: `${((numSlides - 2) / 13) * 100}%` }}></div>
                <div className="slth" style={{ left: `${((numSlides - 2) / 13) * 100}%` }}></div>
                <input type="range" className="slrng" disabled={loading} min="2" max="15" value={numSlides} step="1" onChange={e => setNumSlides(parseInt(e.target.value))} />
              </div>
              <span className="slb">15</span>
            </div>
            <div className="prow">
              {[3, 5, 7, 10, 12, 15].map(v => (
                <div key={v} className={`pc ${numSlides === v ? 'act' : ''}`} onClick={() => { if (!loading) setNumSlides(v) }}>{v}</div>
              ))}
            </div>
          </div>
          <div className="fg">
            <div className="fl"><span className="fn">07 //</span> LLM_MODEL</div>
            <div className="thr">
              <div className={`tpill ${forceProvider === null ? 'act' : ''}`} onClick={() => { if (!loading) setForceProvider(null) }}><div className="tdot" style={{ background: 'var(--cy)' }}></div>AUTO</div>
              <div className={`tpill ${forceProvider === 'nvidia' ? 'act' : ''}`} onClick={() => { if (!loading) setForceProvider('nvidia') }}><div className="tdot" style={{ background: '#76b900' }}></div>NVIDIA NIM</div>
              <div className={`tpill ${forceProvider === 'groq' ? 'act' : ''}`} onClick={() => { if (!loading) setForceProvider('groq') }}><div className="tdot" style={{ background: '#f55a3c' }}></div>GROQ</div>
            </div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 9, color: 'var(--t3)', marginTop: 6, letterSpacing: '.04em' }}>{forceProvider === null ? '⚡ Auto-routes technical topics to NVIDIA NIM, general topics to Groq' : forceProvider === 'nvidia' ? '⚡ Forces NVIDIA NIM (Kimi K2.5) for all generations' : '🟢 Forces Groq (LLaMA 3.3-70b) for all generations'}</div>
          </div>

          <button disabled={loading} className="btn bp shim bfw" onClick={handleStartGeneration} style={{ height: 50, marginTop: 4 }}>
            {loading && <div className="spn" style={{ borderColor: 'rgba(255,255,255,.2)', borderTopColor: '#fff' }}></div>}
            <span>✦ {loading ? 'GENERATING...' : 'GENERATE_PRESENTATION'}</span>
          </button>

          {loading && (
            <div className="pgw">
              <div className="pgt"><div className="pgf" style={{ width: `${pPct}%` }}></div></div>
              <div className="pgs">
                {genSteps.map(s => (
                  <div key={s.id} className={`pgstp ${s.status === 'done' ? 'dn' : s.status === 'active' ? 'ac' : ''}`}>
                    <div className="pgdw">
                      {s.status === 'done' ? '✓' : s.status === 'active' ? <div className="spn" style={{ borderColor: 'rgba(0,240,255,.2)', borderTopColor: 'var(--cy)' }}></div> : '◎'}
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
  );
}
