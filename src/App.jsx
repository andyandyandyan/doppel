import { useState, useRef, useEffect } from 'react';

const PUZZLE = {
  p1: 'MULHOLLAND DRIVE',
  p2: 'SUNSET BOULEVARD',
};
const MAX_PICKS = 3;
const HELP_KEY = 'doppel-help-seen';

// ─── Demo data for help screens ───────────────────────────────────────────────
const DP1 = 'KEVIN BACON';
const DP2 = 'BRIE LARSON';
// Common: O(9), N(10). Spaces: DP1[5], DP2[4]
const DR1 = new Set([5, 9, 10]);
const DR2 = new Set([4, 9, 10]);

// ─── Mini display components ──────────────────────────────────────────────────
function MiniSlot({ ch, state }) {
  const rev = state === 'revealed';
  return (
    <div style={{
      width: 17, height: 24, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderBottom: `1.5px solid ${rev ? 'var(--accent)' : 'var(--border)'}`,
      fontFamily: "'DM Mono',monospace", fontSize: '0.58rem', fontWeight: 500,
      color: rev ? 'var(--accent)' : 'var(--text)',
      opacity: state === 'hidden' ? 0 : 1,
      transition: 'opacity 0.4s, color 0.4s, border-color 0.4s',
      userSelect: 'none',
    }}>{ch}</div>
  );
}

function MiniPhrase({ phrase, getState }) {
  return (
    <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
      {phrase.split('').map((ch, i) =>
        ch === ' '
          ? <div key={i} style={{ width: 17, flexShrink: 0 }} />
          : <MiniSlot key={i} ch={ch} state={getState(i)} />
      )}
    </div>
  );
}

function MiniTile({ ch, state }) {
  return (
    <div style={{
      width: 28, height: 34, borderRadius: 3,
      border: `1.5px solid ${state === 'done' ? 'var(--border-dim)' : 'var(--border)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', fontWeight: 500,
      background: state === 'pending' ? 'var(--border-dim)' : state === 'done' ? 'transparent' : 'var(--tile-bg)',
      color: state === 'pending' || state === 'done' ? 'var(--dim)' : 'var(--text)',
      opacity: state === 'done' ? 0.4 : 1,
      transition: 'background 0.15s, color 0.15s, opacity 0.3s',
      boxShadow: state === 'normal' ? '0 1px 2px rgba(0,0,0,0.07)' : 'none',
      userSelect: 'none',
    }}>{ch}</div>
  );
}

const DemoTitle = () => (
  <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--dim)', marginBottom: 6 }}>
    "they are what we eat"
  </div>
);

// ─── Help animations ──────────────────────────────────────────────────────────
function HelpAnim1() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <DemoTitle />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MiniPhrase phrase={DP1} getState={() => 'plain'} />
        <MiniPhrase phrase={DP2} getState={() => 'plain'} />
      </div>
    </div>
  );
}

function HelpAnim2() {
  const [faded, setFaded] = useState(false);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    setFaded(false);
    const t1 = setTimeout(() => setFaded(true), 700);
    const t2 = setTimeout(() => setCycle(c => c + 1), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [cycle]);
  const s1 = i => !faded ? 'plain' : (i === 9 || i === 10) ? 'revealed' : 'hidden';
  const s2 = i => !faded ? 'plain' : (i === 9 || i === 10) ? 'revealed' : 'hidden';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <DemoTitle />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MiniPhrase phrase={DP1} getState={s1} />
        <MiniPhrase phrase={DP2} getState={s2} />
      </div>
    </div>
  );
}

function HelpAnim3() {
  const [rev1, setRev1] = useState(new Set(DR1));
  const [rev2, setRev2] = useState(new Set(DR2));
  const [tiles, setTiles] = useState({ B: 'normal', R: 'normal', E: 'normal' });
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    setRev1(new Set(DR1)); setRev2(new Set(DR2));
    setTiles({ B: 'normal', R: 'normal', E: 'normal' });
    const ts = []; const t = (ms, fn) => ts.push(setTimeout(fn, ms));
    t(500,  () => setTiles(s => ({ ...s, B: 'pending' })));
    t(1000, () => { setTiles(s => ({ ...s, B: 'done' })); setRev1(s => new Set([...s, 6])); setRev2(s => new Set([...s, 0])); });
    t(1500, () => setTiles(s => ({ ...s, R: 'pending' })));
    t(2000, () => { setTiles(s => ({ ...s, R: 'done' })); setRev2(s => new Set([...s, 1, 7])); });
    t(2500, () => setTiles(s => ({ ...s, E: 'pending' })));
    t(3000, () => { setTiles(s => ({ ...s, E: 'done' })); setRev1(s => new Set([...s, 1])); setRev2(s => new Set([...s, 3])); });
    t(4600, () => setCycle(c => c + 1));
    return () => ts.forEach(clearTimeout);
  }, [cycle]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {['B', 'R', 'E'].map(ch => <MiniTile key={ch} ch={ch} state={tiles[ch]} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MiniPhrase phrase={DP1} getState={i => rev1.has(i) ? 'revealed' : 'hidden'} />
        <MiniPhrase phrase={DP2} getState={i => rev2.has(i) ? 'revealed' : 'hidden'} />
      </div>
    </div>
  );
}

function HelpAnim4() {
  // Post-reveal state: after B, R, E picked
  const REV1 = new Set([1, 5, 6, 9, 10]);
  const REV2 = new Set([0, 1, 3, 4, 7, 9, 10]);
  const [t1, setT1] = useState({});
  const [t2, setT2] = useState({});
  const [win, setWin] = useState(false);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    setT1({}); setT2({}); setWin(false);
    const ts = []; const t = (ms, fn) => ts.push(setTimeout(fn, ms));
    // Type KEVIN BACON hidden: K(0) V(2) I(3) N(4) A(7) C(8)
    t(300,  () => setT1(s => ({ ...s, 0: 'K' })));
    t(500,  () => setT1(s => ({ ...s, 2: 'V' })));
    t(700,  () => setT1(s => ({ ...s, 3: 'I' })));
    t(900,  () => setT1(s => ({ ...s, 4: 'N' })));
    t(1100, () => setT1(s => ({ ...s, 7: 'A' })));
    t(1300, () => setT1(s => ({ ...s, 8: 'C' })));
    // Type BRIE LARSON hidden: I(2) L(5) A(6) S(8)
    t(1600, () => setT2(s => ({ ...s, 2: 'I' })));
    t(1800, () => setT2(s => ({ ...s, 5: 'L' })));
    t(2000, () => setT2(s => ({ ...s, 6: 'A' })));
    t(2200, () => setT2(s => ({ ...s, 8: 'S' })));
    t(2600, () => setWin(true));
    t(4200, () => setCycle(c => c + 1));
    return () => ts.forEach(clearTimeout);
  }, [cycle]);
  const g1 = i => (win || REV1.has(i)) ? 'revealed' : t1[i] ? 'plain' : 'hidden';
  const g2 = i => (win || REV2.has(i)) ? 'revealed' : t2[i] ? 'plain' : 'hidden';
  const ck = { fontFamily: "'DM Mono',monospace", fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', marginLeft: 6, transition: 'opacity 0.3s' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <MiniPhrase phrase={DP1} getState={g1} />
        <span style={{ ...ck, opacity: win ? 1 : 0 }}>✓</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <MiniPhrase phrase={DP2} getState={g2} />
        <span style={{ ...ck, opacity: win ? 1 : 0 }}>✓</span>
      </div>
    </div>
  );
}

// ─── Help page content ────────────────────────────────────────────────────────
const HELP_TEXT = [
  'Meet the doppels: two phrases of identical length, tied together by a single clue.',
  'In this game, doppels are mostly covered. Letters that sit in the same spot in each phrase will be revealed for you, as will blank spaces.',
  'The rest of the letters in both phrases will be displayed in a pile. Click twice to reveal them wherever they appear. Choose wisely — you only get three.',
  'Correctly guess the doppels to win.',
];
const HELP_ANIMS = [HelpAnim1, HelpAnim2, HelpAnim3, HelpAnim4];

// ─── Game helpers ─────────────────────────────────────────────────────────────
function getCommon(p1, p2) {
  const s = new Set();
  for (let i = 0; i < p1.length; i++) if (p1[i] === p2[i]) s.add(i);
  return s;
}

function getPool(p1, p2) {
  return [...new Set([...p1, ...p2])]
    .filter(ch => ch !== ' ')
    .sort((a, b) => a.localeCompare(b));
}

function allInstancesRevealed(ch, p1, p2, rev1, rev2) {
  for (let i = 0; i < p1.length; i++) if (p1[i] === ch && !rev1.has(i)) return false;
  for (let i = 0; i < p2.length; i++) if (p2[i] === ch && !rev2.has(i)) return false;
  return true;
}

function wrapPhrase(phrase) {
  const words = phrase.split(' ');
  const lines = [];
  let lineText = '', lineStart = 0, charPos = 0;
  for (const word of words) {
    const candidate = lineText ? lineText + ' ' + word : word;
    if (candidate.length <= 14) { lineText = candidate; }
    else { lines.push({ text: lineText, start: lineStart }); lineStart = charPos; lineText = word; }
    charPos += word.length + 1;
  }
  if (lineText) lines.push({ text: lineText, start: lineStart });
  return lines;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { p1, p2 } = PUZZLE;
  const COMMON = getCommon(p1, p2);

  const [pool, setPool] = useState(() => getPool(p1, p2));
  const [rev1, setRev1] = useState(() => { const s = new Set(COMMON); for (let i = 0; i < p1.length; i++) if (p1[i] === ' ') s.add(i); return s; });
  const [rev2, setRev2] = useState(() => { const s = new Set(COMMON); for (let i = 0; i < p2.length; i++) if (p2[i] === ' ') s.add(i); return s; });
  const [tentative, setTent]  = useState(new Map());
  const [picksLeft, setPicks] = useState(MAX_PICKS);
  const [dragging,  setDrag]  = useState(null);
  const [typed1,    setTyped1] = useState({});
  const [typed2,    setTyped2] = useState({});
  const [focus1,    setFocus1] = useState(null);
  const [focus2,    setFocus2] = useState(null);
  const [won1,      setWon1]  = useState(false);
  const [won2,      setWon2]  = useState(false);
  const [err1,      setErr1]  = useState(false);
  const [err2,      setErr2]  = useState(false);
  const [pendingTile, setPendingTile] = useState(null);
  const [touchDragSlot, setTouchDragSlot] = useState(null);
  const [ghostPos,  setGhostPos]  = useState(null);
  const [ghostChar, setGhostChar] = useState(null);

  // Help state
  const [showHelp, setShowHelp] = useState(() => !localStorage.getItem(HELP_KEY));
  const [helpPage, setHelpPage] = useState(0);
  const [dontShow, setDontShow] = useState(false);

  const dragSrc     = useRef(null);
  const poolDragIdx = useRef(null);
  const slotRefs    = useRef({});
  const touchStateRef = useRef({ startPos: null, isDragging: false, source: null });

  const LINES1 = wrapPhrase(p1);
  const LINES2 = wrapPhrase(p2);

  useEffect(() => {
    const prevent = e => { if (touchStateRef.current.isDragging) e.preventDefault(); };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, []);

  function closeHelp() {
    if (dontShow) localStorage.setItem(HELP_KEY, '1');
    setShowHelp(false);
  }

  function openHelp() { setHelpPage(0); setShowHelp(true); }

  // ── Drag handlers ────────────────────────────────────────────────────────
  function startDragFromPool(ch, idx) { poolDragIdx.current = idx; dragSrc.current = null; setDrag(ch); }
  function startDragFromSlot(pi, idx, ch) { dragSrc.current = { pi, idx, ch }; setTent(m => { const n = new Map(m); n.delete(`${pi}-${idx}`); return n; }); setDrag(ch); }
  function handleDragEnd() { poolDragIdx.current = null; dragSrc.current = null; setDrag(null); }

  function startTouchDrag(source, ch, x, y) {
    touchStateRef.current.isDragging = true;
    touchStateRef.current.source = source;
    setGhostPos({ x, y }); setGhostChar(ch); setDrag(ch);
    if (source.type === 'pool') { poolDragIdx.current = source.poolIdx; }
    else { setTouchDragSlot({ pi: source.pi, idx: source.idx }); }
  }

  function handleTouchDrop(x, y) {
    const { source } = touchStateRef.current;
    if (!source) return;
    const el = document.elementFromPoint(x, y);
    const slotEl = el?.closest('[data-slot]');
    if (slotEl) {
      const pi = parseInt(slotEl.dataset.pi), idx = parseInt(slotEl.dataset.idx);
      const rev = pi === 0 ? rev1 : rev2;
      if (!rev.has(idx)) {
        setTent(m => { const n = new Map(m); if (source.type === 'slot') n.delete(`${source.pi}-${source.idx}`); n.set(`${pi}-${idx}`, source.ch); return n; });
      } else if (source.type === 'slot') {
        setTent(m => { const n = new Map(m); n.delete(`${source.pi}-${source.idx}`); return n; });
      }
    } else if (source.type === 'slot') {
      setTent(m => { const n = new Map(m); n.delete(`${source.pi}-${source.idx}`); return n; });
    } else if (source.type === 'pool') {
      const poolEl = el?.closest('[data-pool-tile]');
      if (poolEl) {
        const targetIdx = parseInt(poolEl.dataset.poolTile);
        if (targetIdx !== source.poolIdx) {
          const src = source.poolIdx;
          setPool(prev => { const next = [...prev]; const [moved] = next.splice(src, 1); next.splice(targetIdx, 0, moved); return next; });
        }
      }
    }
    touchStateRef.current = { startPos: null, isDragging: false, source: null };
    setTouchDragSlot(null); setGhostPos(null); setGhostChar(null); setDrag(null);
    poolDragIdx.current = null; dragSrc.current = null;
  }

  function poolTileTouch(ch, i) {
    const TH = 8;
    return {
      onTouchStart: e => { const t = e.touches[0]; touchStateRef.current = { startPos: { x: t.clientX, y: t.clientY }, isDragging: false, source: { type: 'pool', ch, poolIdx: i } }; },
      onTouchMove: e => {
        const { startPos, isDragging } = touchStateRef.current; if (!startPos) return;
        const t = e.touches[0];
        if (!isDragging && Math.hypot(t.clientX - startPos.x, t.clientY - startPos.y) > TH) {
          if (allInstancesRevealed(ch, p1, p2, rev1, rev2)) return;
          startTouchDrag({ type: 'pool', ch, poolIdx: i }, ch, t.clientX, t.clientY);
        } else if (isDragging) { setGhostPos({ x: t.clientX, y: t.clientY }); }
      },
      onTouchEnd: e => {
        if (touchStateRef.current.isDragging) { handleTouchDrop(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }
        else { touchStateRef.current = { startPos: null, isDragging: false, source: null }; }
      },
    };
  }

  function slotTileTouch(pi, idx, ch) {
    const TH = 8;
    return {
      onTouchStart: e => { const t = e.touches[0]; touchStateRef.current = { startPos: { x: t.clientX, y: t.clientY }, isDragging: false, source: { type: 'slot', ch, pi, idx } }; },
      onTouchMove: e => {
        const { startPos, isDragging } = touchStateRef.current; if (!startPos) return;
        const t = e.touches[0];
        if (!isDragging && Math.hypot(t.clientX - startPos.x, t.clientY - startPos.y) > TH) { startTouchDrag({ type: 'slot', ch, pi, idx }, ch, t.clientX, t.clientY); }
        else if (isDragging) { setGhostPos({ x: t.clientX, y: t.clientY }); }
      },
      onTouchEnd: e => {
        if (touchStateRef.current.isDragging) { handleTouchDrop(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }
        else { touchStateRef.current = { startPos: null, isDragging: false, source: null }; }
      },
    };
  }

  function handleDropOnSlot(pi, idx) {
    if (!dragging) return;
    const rev = pi === 0 ? rev1 : rev2;
    if (rev.has(idx)) return;
    setTent(m => new Map(m).set(`${pi}-${idx}`, dragging));
    dragSrc.current = null; setDrag(null);
  }

  // ── Reveal / guess handlers ──────────────────────────────────────────────
  function handleTileClick(ch) {
    if (allInstancesRevealed(ch, p1, p2, rev1, rev2)) return;
    if (pendingTile === ch) { handleReveal(ch); setPendingTile(null); }
    else { setPendingTile(ch); }
  }

  function handleReveal(ch) {
    if (picksLeft <= 0 || allInstancesRevealed(ch, p1, p2, rev1, rev2)) return;
    const nr1 = new Set(rev1), nr2 = new Set(rev2);
    for (let i = 0; i < p1.length; i++) if (p1[i] === ch) nr1.add(i);
    for (let i = 0; i < p2.length; i++) if (p2[i] === ch) nr2.add(i);
    setRev1(nr1); setRev2(nr2);
    const t = new Map(tentative);
    for (const [key, val] of tentative) if (val === ch) t.delete(key);
    setTent(t);
    setTyped1(td => { const n = { ...td }; for (let i = 0; i < p1.length; i++) if (p1[i] === ch) delete n[i]; return n; });
    setTyped2(td => { const n = { ...td }; for (let i = 0; i < p2.length; i++) if (p2[i] === ch) delete n[i]; return n; });
    setPicks(p => p - 1);
  }

  function getNextTypeable(pi, from) {
    const phrase = pi === 0 ? p1 : p2, rev = pi === 0 ? rev1 : rev2;
    for (let i = from + 1; i < phrase.length; i++) if (!rev.has(i) && phrase[i] !== ' ' && !tentative.has(`${pi}-${i}`)) return i;
    return null;
  }

  function getPrevTypeable(pi, from) {
    const phrase = pi === 0 ? p1 : p2, rev = pi === 0 ? rev1 : rev2;
    for (let i = from - 1; i >= 0; i--) if (!rev.has(i) && phrase[i] !== ' ' && !tentative.has(`${pi}-${i}`)) return i;
    return null;
  }

  function focusSlot(pi, idx) { slotRefs.current[`${pi}-${idx}`]?.focus(); }

  function handleSlotKeyDown(pi, idx, e) {
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      e.preventDefault();
      const ch = e.key.toUpperCase();
      if (pi === 0) setTyped1(t => ({ ...t, [idx]: ch })); else setTyped2(t => ({ ...t, [idx]: ch }));
      const next = getNextTypeable(pi, idx); if (next !== null) focusSlot(pi, next);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      const typed = pi === 0 ? typed1 : typed2;
      if (typed[idx]) { if (pi === 0) setTyped1(t => { const n = { ...t }; delete n[idx]; return n; }); else setTyped2(t => { const n = { ...t }; delete n[idx]; return n; }); }
      else { const prev = getPrevTypeable(pi, idx); if (prev !== null) { if (pi === 0) setTyped1(t => { const n = { ...t }; delete n[prev]; return n; }); else setTyped2(t => { const n = { ...t }; delete n[prev]; return n; }); focusSlot(pi, prev); } }
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); const prev = getPrevTypeable(pi, idx); if (prev !== null) focusSlot(pi, prev); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); const next = getNextTypeable(pi, idx); if (next !== null) focusSlot(pi, next); }
    else if (e.key === 'Enter') { submitGuess(pi); }
  }

  function buildGuess(pi) {
    const phrase = pi === 0 ? p1 : p2, rev = pi === 0 ? rev1 : rev2, typed = pi === 0 ? typed1 : typed2;
    return phrase.split('').map((ch, i) => { if (rev.has(i)) return ch; const tent = tentative.get(`${pi}-${i}`); if (tent) return tent; return typed[i] || ''; }).join('');
  }

  function submitGuess(pi) {
    const phrase = pi === 0 ? p1 : p2;
    if (buildGuess(pi) === phrase) {
      const setRev = pi === 0 ? setRev1 : setRev2;
      setRev(new Set(Array.from({ length: phrase.length }, (_, i) => i)));
      if (pi === 0) setWon1(true); else setWon2(true);
    } else {
      const setErr = pi === 0 ? setErr1 : setErr2;
      setErr(true); setTimeout(() => setErr(false), 1000);
    }
  }

  // ── Layout constants ─────────────────────────────────────────────────────
  const SLOT_W = 22, SPACE_W = 22, GAP = 2, NUM_W = 26;
  const dimLabel = { fontSize: '0.58rem', letterSpacing: '0.14em', color: 'var(--dim)', textTransform: 'uppercase', textAlign: 'center' };
  const PhraseNum = ({ n }) => (
    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0, fontFamily: "'DM Mono',monospace", marginRight: 6, alignSelf: 'flex-end', marginBottom: 4 }}>{n}</div>
  );

  // ── Help modal styles ────────────────────────────────────────────────────
  const navBtn = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace", fontSize: '1rem', color: 'var(--accent)', padding: '0.25rem 0.5rem' };
  const HelpAnim = HELP_ANIMS[helpPage];

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem 1.5rem', gap: '1.8rem' }}>

      {/* Title + help button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '2.4rem', fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.01em', lineHeight: 1 }}>
          doppel
        </div>
        <button onClick={openHelp} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: '0.55rem', color: 'var(--dim)', fontFamily: "'DM Mono',monospace", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, marginTop: 6 }}>?</button>
      </div>

      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--dim)' }}>June 15</div>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1.1rem', color: 'var(--text)', marginTop: '0.2rem' }}>"hollywood on hollywood"</div>
      </div>

      {/* Tile pool */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <div style={dimLabel}>click twice to reveal · drag to place</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 520 }}>
          {pool.map((ch, i) => {
            const done = allInstancesRevealed(ch, p1, p2, rev1, rev2);
            return (
              <div key={ch} data-pool-tile={i} draggable {...poolTileTouch(ch, i)}
                onDragStart={() => startDragFromPool(ch, i)} onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); if (poolDragIdx.current !== null && poolDragIdx.current !== i) { const src = poolDragIdx.current; setPool(prev => { const next = [...prev]; const [moved] = next.splice(src, 1); next.splice(i, 0, moved); return next; }); } poolDragIdx.current = null; setDrag(null); }}
                onClick={() => handleTileClick(ch)}
                style={{ width: 36, height: 42, border: `1.5px solid ${done ? 'var(--border-dim)' : 'var(--border)'}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono',monospace", fontSize: '0.9rem', fontWeight: 500, background: done ? 'transparent' : pendingTile === ch ? 'var(--border-dim)' : 'var(--tile-bg)', color: done ? 'var(--border-dim)' : pendingTile === ch ? 'var(--dim)' : 'var(--text)', cursor: done ? 'default' : 'pointer', userSelect: 'none', opacity: done ? 0.35 : 1, transition: 'background 0.15s, color 0.15s, opacity 0.3s', boxShadow: !done && pendingTile !== ch ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', touchAction: 'none' }}>
                {ch}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pick counter */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
        <div style={dimLabel}>tiles left</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: MAX_PICKS }).map((_, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < picksLeft ? 'var(--accent)' : 'var(--border-dim)', transition: 'background 0.3s' }} />
          ))}
        </div>
      </div>

      {/* Phrase rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {[p1, p2].map((phrase, pi) => {
          const rev = pi === 0 ? rev1 : rev2, typed = pi === 0 ? typed1 : typed2;
          const won = pi === 0 ? won1 : won2, err = pi === 0 ? err1 : err2;
          const focused = pi === 0 ? focus1 : focus2, lines = pi === 0 ? LINES1 : LINES2;
          return (
            <div key={pi} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lines.map((line, lineIdx) => {
                const isFirst = lineIdx === 0, isLast = lineIdx === lines.length - 1;
                return (
                  <div key={lineIdx} style={{ display: 'flex', alignItems: 'flex-end' }}>
                    {isFirst ? <PhraseNum n={pi + 1} /> : <div style={{ width: NUM_W, flexShrink: 0 }} />}
                    <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-end' }}>
                      {line.text.split('').map((ch, j) => {
                        const i = line.start + j, revealed = rev.has(i), isSpace = ch === ' ';
                        const tentChar = tentative.get(`${pi}-${i}`), isFocused = focused === i, canDrop = !revealed && !!dragging;
                        if (isSpace) return <div key={i} style={{ width: SPACE_W, flexShrink: 0 }} />;
                        const borderColor = (err && !revealed) ? 'var(--error)' : (revealed || isFocused || (canDrop && !tentChar)) ? 'var(--accent)' : 'var(--border)';
                        return (
                          <div key={i} data-slot="true" data-pi={pi} data-idx={i}
                            style={{ width: SLOT_W, height: 38, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `2px solid ${borderColor}`, background: canDrop && !tentChar && !revealed ? 'var(--accent-dim)' : 'transparent', borderRadius: canDrop && !tentChar && !revealed ? '3px 3px 0 0' : 0, transition: 'background 0.12s, border-color 0.2s' }}
                            onDragOver={e => { if (!revealed) e.preventDefault(); }}
                            onDrop={e => { e.preventDefault(); handleDropOnSlot(pi, i); }}>
                            {revealed && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', fontWeight: 500, color: 'var(--accent)', userSelect: 'none' }}>{ch}</span>}
                            {!revealed && tentChar && (
                              <div draggable {...slotTileTouch(pi, i, tentChar)}
                                onDragStart={e => { e.stopPropagation(); startDragFromSlot(pi, i, tentChar); }} onDragEnd={handleDragEnd}
                                onClick={e => { e.stopPropagation(); handleTileClick(tentChar); }}
                                style={{ position: 'absolute', inset: '0 0 2px 0', border: '1.5px solid var(--border)', borderRadius: 3, background: pendingTile === tentChar ? 'var(--border-dim)' : 'var(--tile-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', fontWeight: 500, color: pendingTile === tentChar ? 'var(--dim)' : 'var(--text)', cursor: 'pointer', userSelect: 'none', boxShadow: pendingTile === tentChar ? 'none' : '0 1px 3px rgba(0,0,0,0.12)', touchAction: 'none', opacity: touchDragSlot?.pi === pi && touchDragSlot?.idx === i ? 0 : 1, transition: 'background 0.15s, color 0.15s' }}>
                                {tentChar}
                              </div>
                            )}
                            {!revealed && !tentChar && (
                              <>
                                {typed[i] ? <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', fontWeight: 500, color: 'var(--text)', userSelect: 'none', pointerEvents: 'none' }}>{typed[i]}</span>
                                  : isFocused ? <span className="slot-cursor" style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.9rem', fontWeight: 300, color: 'var(--accent)', userSelect: 'none', pointerEvents: 'none', lineHeight: 1 }}>|</span>
                                  : null}
                                <input ref={el => { slotRefs.current[`${pi}-${i}`] = el; }} type="text" autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
                                  onKeyDown={e => handleSlotKeyDown(pi, i, e)}
                                  onChange={e => { const val = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase(); e.target.value = ''; if (!val) return; const ch = val.slice(-1); if (pi === 0) setTyped1(t => ({ ...t, [i]: ch })); else setTyped2(t => ({ ...t, [i]: ch })); const next = getNextTypeable(pi, i); if (next !== null) focusSlot(pi, next); }}
                                  onFocus={() => { if (pi === 0) setFocus1(i); else setFocus2(i); }}
                                  onBlur={() => { if (pi === 0) setFocus1(null); else setFocus2(null); }}
                                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'text', border: 'none', background: 'transparent', width: '100%', height: '100%' }} />
                              </>
                            )}
                          </div>
                        );
                      })}
                      {isLast && (won
                        ? <div style={{ marginLeft: 8, fontSize: '1rem', color: 'var(--accent)', fontWeight: 700, alignSelf: 'center' }}>✓</div>
                        : <button onClick={() => submitGuess(pi)} style={{ background: 'var(--accent)', border: 'none', color: '#fff', fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '0.5rem 0.7rem', borderRadius: 3, cursor: 'pointer', fontWeight: 500, marginLeft: 8, alignSelf: 'center', flexShrink: 0 }}>Submit</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {won1 && won2 && (
        <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--accent)', textAlign: 'center' }}>Nailed it</div>
      )}

      {ghostPos && ghostChar && (
        <div style={{ position: 'fixed', left: ghostPos.x - 18, top: ghostPos.y - 21, width: 36, height: 42, border: '1.5px solid var(--border)', borderRadius: 4, background: 'var(--tile-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono',monospace", fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)', pointerEvents: 'none', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', opacity: 0.9, userSelect: 'none' }}>
          {ghostChar}
        </div>
      )}

      {/* Help modal */}
      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '1.25rem 1.5rem', maxWidth: 360, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.1rem', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>

            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 13, height: 13 }} />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Don't show this again</span>
              </label>
              <button onClick={closeHelp} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', fontSize: '1rem', lineHeight: 1, padding: '0 0 0 8px' }}>×</button>
            </div>

            {/* Page text */}
            <p style={{ fontFamily: "'DM Serif Display',serif", fontSize: '1rem', color: 'var(--text)', lineHeight: 1.55, margin: 0 }}>
              {HELP_TEXT[helpPage]}
            </p>

            {/* Animation */}
            <div style={{ display: 'flex', justifyContent: 'center', minHeight: 100, alignItems: 'center' }}>
              <HelpAnim key={helpPage} />
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={() => setHelpPage(p => p - 1)} disabled={helpPage === 0} style={{ ...navBtn, opacity: helpPage === 0 ? 0.25 : 1 }}>←</button>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} onClick={() => setHelpPage(i)} style={{ width: 7, height: 7, borderRadius: '50%', background: i === helpPage ? 'var(--accent)' : 'var(--border-dim)', cursor: 'pointer', transition: 'background 0.2s' }} />
                ))}
              </div>
              {helpPage < 3
                ? <button onClick={() => setHelpPage(p => p + 1)} style={navBtn}>→</button>
                : <button onClick={closeHelp} style={{ background: 'var(--accent)', border: 'none', color: '#fff', fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '0.5rem 0.9rem', borderRadius: 3, cursor: 'pointer', fontWeight: 500 }}>Play</button>
              }
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
