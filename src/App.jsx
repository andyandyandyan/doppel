import { useState, useRef } from 'react';

const PUZZLE = {
  p1: 'MULHOLLAND DRIVE',
  p2: 'SUNSET BOULEVARD',
};
const MAX_PICKS = 5;

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
  let lineText = '';
  let lineStart = 0;
  let charPos = 0;
  for (const word of words) {
    const candidate = lineText ? lineText + ' ' + word : word;
    if (candidate.length <= 14) {
      lineText = candidate;
    } else {
      lines.push({ text: lineText, start: lineStart });
      lineStart = charPos;
      lineText = word;
    }
    charPos += word.length + 1;
  }
  if (lineText) lines.push({ text: lineText, start: lineStart });
  return lines;
}

export default function App() {
  const { p1, p2 } = PUZZLE;
  const COMMON = getCommon(p1, p2);

  const [pool, setPool] = useState(() => getPool(p1, p2));
  const [rev1, setRev1] = useState(() => {
    const s = new Set(COMMON);
    for (let i = 0; i < p1.length; i++) if (p1[i] === ' ') s.add(i);
    return s;
  });
  const [rev2, setRev2] = useState(() => {
    const s = new Set(COMMON);
    for (let i = 0; i < p2.length; i++) if (p2[i] === ' ') s.add(i);
    return s;
  });
  const [tentative, setTent] = useState(new Map());
  const [picksLeft, setPicks] = useState(MAX_PICKS);
  const [dragging, setDrag] = useState(null);
  const [typed1, setTyped1] = useState({});
  const [typed2, setTyped2] = useState({});
  const [focus1, setFocus1] = useState(null);
  const [focus2, setFocus2] = useState(null);
  const [won1, setWon1] = useState(false);
  const [won2, setWon2] = useState(false);
  const [err1, setErr1] = useState(false);
  const [err2, setErr2] = useState(false);

  const dragSrc = useRef(null);
  const poolDragIdx = useRef(null);
  const slotRefs = useRef({});

  const LINES1 = wrapPhrase(p1);
  const LINES2 = wrapPhrase(p2);

  function startDragFromPool(ch, idx) {
    poolDragIdx.current = idx;
    dragSrc.current = null;
    setDrag(ch);
  }

  function startDragFromSlot(pi, idx, ch) {
    dragSrc.current = { pi, idx, ch };
    setTent(m => { const n = new Map(m); n.delete(`${pi}-${idx}`); return n; });
    setDrag(ch);
  }

  function handleDragEnd() {
    poolDragIdx.current = null;
    dragSrc.current = null;
    setDrag(null);
  }

  function handleDropOnSlot(pi, idx) {
    if (!dragging) return;
    const rev = pi === 0 ? rev1 : rev2;
    if (rev.has(idx)) return;
    setTent(m => new Map(m).set(`${pi}-${idx}`, dragging));
    dragSrc.current = null;
    setDrag(null);
  }

  function handleReveal(ch) {
    if (picksLeft <= 0 || allInstancesRevealed(ch, p1, p2, rev1, rev2)) return;
    const nr1 = new Set(rev1), nr2 = new Set(rev2);
    for (let i = 0; i < p1.length; i++) if (p1[i] === ch) nr1.add(i);
    for (let i = 0; i < p2.length; i++) if (p2[i] === ch) nr2.add(i);
    setRev1(nr1); setRev2(nr2);
    const t = new Map(tentative);
    for (let i = 0; i < p1.length; i++) if (p1[i] === ch) t.delete(`0-${i}`);
    for (let i = 0; i < p2.length; i++) if (p2[i] === ch) t.delete(`1-${i}`);
    setTent(t);
    setTyped1(td => { const n = { ...td }; for (let i = 0; i < p1.length; i++) if (p1[i] === ch) delete n[i]; return n; });
    setTyped2(td => { const n = { ...td }; for (let i = 0; i < p2.length; i++) if (p2[i] === ch) delete n[i]; return n; });
    setPicks(p => p - 1);
  }

  function getNextTypeable(pi, from) {
    const phrase = pi === 0 ? p1 : p2;
    const rev = pi === 0 ? rev1 : rev2;
    for (let i = from + 1; i < phrase.length; i++) {
      if (!rev.has(i) && phrase[i] !== ' ' && !tentative.has(`${pi}-${i}`)) return i;
    }
    return null;
  }

  function getPrevTypeable(pi, from) {
    const phrase = pi === 0 ? p1 : p2;
    const rev = pi === 0 ? rev1 : rev2;
    for (let i = from - 1; i >= 0; i--) {
      if (!rev.has(i) && phrase[i] !== ' ' && !tentative.has(`${pi}-${i}`)) return i;
    }
    return null;
  }

  function focusSlot(pi, idx) {
    slotRefs.current[`${pi}-${idx}`]?.focus();
  }

  function handleSlotKeyDown(pi, idx, e) {
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      e.preventDefault();
      const ch = e.key.toUpperCase();
      if (pi === 0) setTyped1(t => ({ ...t, [idx]: ch }));
      else setTyped2(t => ({ ...t, [idx]: ch }));
      const next = getNextTypeable(pi, idx);
      if (next !== null) focusSlot(pi, next);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      const typed = pi === 0 ? typed1 : typed2;
      if (typed[idx]) {
        if (pi === 0) setTyped1(t => { const n = { ...t }; delete n[idx]; return n; });
        else setTyped2(t => { const n = { ...t }; delete n[idx]; return n; });
      } else {
        const prev = getPrevTypeable(pi, idx);
        if (prev !== null) {
          if (pi === 0) setTyped1(t => { const n = { ...t }; delete n[prev]; return n; });
          else setTyped2(t => { const n = { ...t }; delete n[prev]; return n; });
          focusSlot(pi, prev);
        }
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = getPrevTypeable(pi, idx);
      if (prev !== null) focusSlot(pi, prev);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = getNextTypeable(pi, idx);
      if (next !== null) focusSlot(pi, next);
    } else if (e.key === 'Enter') {
      submitGuess(pi);
    }
  }

  function buildGuess(pi) {
    const phrase = pi === 0 ? p1 : p2;
    const rev = pi === 0 ? rev1 : rev2;
    const typed = pi === 0 ? typed1 : typed2;
    return phrase.split('').map((ch, i) => {
      if (rev.has(i)) return ch;
      const tent = tentative.get(`${pi}-${i}`);
      if (tent) return tent;
      return typed[i] || '';
    }).join('');
  }

  function submitGuess(pi) {
    const phrase = pi === 0 ? p1 : p2;
    if (buildGuess(pi) === phrase) {
      const setRev = pi === 0 ? setRev1 : setRev2;
      setRev(new Set(Array.from({ length: phrase.length }, (_, i) => i)));
      if (pi === 0) setWon1(true); else setWon2(true);
    } else {
      const setErr = pi === 0 ? setErr1 : setErr2;
      setErr(true);
      setTimeout(() => setErr(false), 1000);
    }
  }

  const SLOT_W = 22;
  const SPACE_W = 22;
  const GAP = 2;
  const NUM_W = 26;

  const dimLabel = {
    fontSize: '0.58rem', letterSpacing: '0.14em', color: 'var(--dim)',
    textTransform: 'uppercase', textAlign: 'center',
  };

  const PhraseNum = ({ n }) => (
    <div style={{
      width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.6rem', fontWeight: 700, flexShrink: 0,
      fontFamily: "'DM Mono',monospace", marginRight: 6, alignSelf: 'flex-end', marginBottom: 4,
    }}>
      {n}
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem 1.5rem', gap: '1.8rem' }}>

      <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '2.4rem', fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.01em', lineHeight: 1 }}>
        doppel
      </div>

      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--dim)' }}>June 15</div>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1.1rem', color: 'var(--text)', marginTop: '0.2rem' }}>"hollywood on hollywood"</div>
      </div>

      {/* Tile pool */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <div style={dimLabel}>double-click to reveal · drag to place</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 520 }}>
          {pool.map((ch, i) => {
            const done = allInstancesRevealed(ch, p1, p2, rev1, rev2);
            return (
              <div key={ch}
                draggable
                onDragStart={() => startDragFromPool(ch, i)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (poolDragIdx.current !== null && poolDragIdx.current !== i) {
                    const src = poolDragIdx.current;
                    setPool(prev => {
                      const next = [...prev];
                      const [moved] = next.splice(src, 1);
                      next.splice(i, 0, moved);
                      return next;
                    });
                  }
                  poolDragIdx.current = null;
                  setDrag(null);
                }}
                onDoubleClick={() => handleReveal(ch)}
                style={{
                  width: 36, height: 42,
                  border: `1.5px solid ${done ? 'var(--border-dim)' : 'var(--border)'}`,
                  borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'DM Mono',monospace", fontSize: '0.9rem', fontWeight: 500,
                  background: done ? 'transparent' : 'var(--tile-bg)',
                  color: done ? 'var(--border-dim)' : 'var(--text)',
                  cursor: done ? 'default' : 'grab',
                  userSelect: 'none',
                  opacity: done ? 0.35 : 1,
                  transition: 'opacity 0.3s',
                  boxShadow: !done ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
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
          const rev = pi === 0 ? rev1 : rev2;
          const typed = pi === 0 ? typed1 : typed2;
          const won = pi === 0 ? won1 : won2;
          const err = pi === 0 ? err1 : err2;
          const focused = pi === 0 ? focus1 : focus2;
          const lines = pi === 0 ? LINES1 : LINES2;

          return (
            <div key={pi} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lines.map((line, lineIdx) => {
                const isFirst = lineIdx === 0;
                const isLast = lineIdx === lines.length - 1;
                return (
                  <div key={lineIdx} style={{ display: 'flex', alignItems: 'flex-end' }}>
                    {isFirst
                      ? <PhraseNum n={pi + 1} />
                      : <div style={{ width: NUM_W, flexShrink: 0 }} />
                    }
                    <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-end' }}>
                      {line.text.split('').map((ch, j) => {
                        const i = line.start + j;
                        const revealed = rev.has(i);
                        const isSpace = ch === ' ';
                        const tentChar = tentative.get(`${pi}-${i}`);
                        const isFocused = focused === i;
                        const canDrop = !revealed && !!dragging;

                        if (isSpace) return <div key={i} style={{ width: SPACE_W, flexShrink: 0 }} />;

                        const borderColor = (err && !revealed)
                          ? 'var(--error)'
                          : (revealed || isFocused || (canDrop && !tentChar))
                            ? 'var(--accent)'
                            : 'var(--border)';

                        return (
                          <div key={i}
                            style={{
                              width: SLOT_W, height: 38, flexShrink: 0, position: 'relative',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderBottom: `2px solid ${borderColor}`,
                              background: canDrop && !tentChar && !revealed ? 'var(--accent-dim)' : 'transparent',
                              borderRadius: canDrop && !tentChar && !revealed ? '3px 3px 0 0' : 0,
                              transition: 'background 0.12s, border-color 0.2s',
                            }}
                            onDragOver={e => { if (!revealed) e.preventDefault(); }}
                            onDrop={e => { e.preventDefault(); handleDropOnSlot(pi, i); }}
                          >
                            {revealed && (
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', fontWeight: 500, color: 'var(--accent)', userSelect: 'none' }}>
                                {ch}
                              </span>
                            )}
                            {!revealed && tentChar && (
                              <div
                                draggable
                                onDragStart={e => { e.stopPropagation(); startDragFromSlot(pi, i, tentChar); }}
                                onDragEnd={handleDragEnd}
                                style={{
                                  position: 'absolute', inset: '0 0 2px 0',
                                  border: '1.5px solid var(--border)', borderRadius: 3,
                                  background: 'var(--tile-bg)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', fontWeight: 500,
                                  color: 'var(--text)', cursor: 'grab', userSelect: 'none',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                                }}>
                                {tentChar}
                              </div>
                            )}
                            {!revealed && !tentChar && (
                              <>
                                {typed[i] && (
                                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', fontWeight: 500, color: 'var(--text)', userSelect: 'none', pointerEvents: 'none' }}>
                                    {typed[i]}
                                  </span>
                                )}
                                <input
                                  ref={el => { slotRefs.current[`${pi}-${i}`] = el; }}
                                  readOnly value=""
                                  onKeyDown={e => handleSlotKeyDown(pi, i, e)}
                                  onFocus={() => { if (pi === 0) setFocus1(i); else setFocus2(i); }}
                                  onBlur={() => { if (pi === 0) setFocus1(null); else setFocus2(null); }}
                                  style={{
                                    position: 'absolute', inset: 0, opacity: 0,
                                    cursor: 'text', border: 'none', background: 'transparent',
                                    width: '100%', height: '100%',
                                  }}
                                />
                              </>
                            )}
                          </div>
                        );
                      })}
                      {isLast && (
                        won
                          ? <div style={{ marginLeft: 8, fontSize: '1rem', color: 'var(--accent)', fontWeight: 700, alignSelf: 'center' }}>✓</div>
                          : <button
                              onClick={() => submitGuess(pi)}
                              style={{
                                background: 'var(--accent)', border: 'none', color: '#fff',
                                fontFamily: "'DM Mono',monospace", fontSize: '0.62rem',
                                letterSpacing: '0.16em', textTransform: 'uppercase',
                                padding: '0.5rem 0.7rem', borderRadius: 3, cursor: 'pointer',
                                fontWeight: 500, marginLeft: 8, alignSelf: 'center', flexShrink: 0,
                              }}>
                              Submit
                            </button>
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
        <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--accent)', textAlign: 'center' }}>
          Nailed it
        </div>
      )}

    </div>
  );
}
