import { useState, useRef, useEffect } from 'react';
import puzzleSchedule from '../puzzle.json';

// ─── Puzzle schedule ────────────────────────────────────────────────────────
// puzzle.json is a list of { date: "YYYY-MM-DD", title, phrase1, phrase2 },
// sorted or not — whichever entry has the latest date that is today or
// earlier (in the visitor's local time) is the one that plays. Add as many
// future entries as you like; nothing else needs to change day to day.
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function formatDisplayDate(iso) {
  return parseLocalDate(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

const SCHEDULE_EMPTY = !Array.isArray(puzzleSchedule) || puzzleSchedule.length === 0;
// A doppel's whole premise is that both phrases are the same length — catch a
// puzzle.json typo here (for any scheduled date) instead of shipping a broken board.
const BAD_ENTRIES = SCHEDULE_EMPTY ? [] : puzzleSchedule.filter(e => e.phrase1.trim().length !== e.phrase2.trim().length);
const PUZZLE_ERROR = SCHEDULE_EMPTY || BAD_ENTRIES.length > 0;

let PUZZLE = { p1: '', p2: '' }, PUZZLE_DATE = '', PUZZLE_DATE_ISO = '', PUZZLE_CLUE = '';
let ARCHIVE_ENTRIES = [], IS_ARCHIVE_MODE = false;
if (!PUZZLE_ERROR) {
  const sorted = [...puzzleSchedule].sort((a, b) => a.date.localeCompare(b.date));
  const today = todayISO();
  const archiveParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('date') : null;
  const todaySelected = sorted.filter(e => e.date <= today).pop() || sorted[0];
  const selected = archiveParam ? (sorted.find(e => e.date === archiveParam) || todaySelected) : todaySelected;
  IS_ARCHIVE_MODE = !!archiveParam && selected.date !== todaySelected.date;
  PUZZLE = { p1: selected.phrase1.trim().toUpperCase(), p2: selected.phrase2.trim().toUpperCase() };
  PUZZLE_DATE = formatDisplayDate(selected.date);
  PUZZLE_DATE_ISO = selected.date;
  PUZZLE_CLUE = selected.title;
  ARCHIVE_ENTRIES = sorted.filter(e => e.date < today).reverse(); // most recent first
}
const MAX_PICKS = 3;
const HELP_KEY = 'doppel-help-seen';
const GHOST_LIFT = 56; // lift the dragged tile above a finger on touch devices
// Some mobile browsers (notably Android Chrome) will start a *native* HTML5 drag
// from a `draggable` element on touch-and-hold, racing our own touch handlers and
// drawing the OS's own drag image (which ignores GHOST_LIFT and drops at the raw
// finger position). Disable the `draggable` attribute on touch devices so only our
// custom touch logic ever drives a drag there; mouse/desktop keeps native DnD.
const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const RESULTS_KEY = 'doppel-results';
function loadResults() { try { return JSON.parse(localStorage.getItem(RESULTS_KEY) || '{}'); } catch { return {}; } }
function saveResult(dateISO, outcome, reveals) { const r = loadResults(); r[dateISO] = { outcome, reveals }; localStorage.setItem(RESULTS_KEY, JSON.stringify(r)); }
// Both phrases have spaces at identical indices → either answer is valid in either slot with no reveals used.
const SPACES_MIRROR = !PUZZLE_ERROR && (() => { const { p1, p2 } = PUZZLE; for (let i = 0; i < p1.length; i++) if ((p1[i] === ' ') !== (p2[i] === ' ')) return false; return true; })();
const PREV_RESULT = !PUZZLE_ERROR && !IS_ARCHIVE_MODE ? (loadResults()[PUZZLE_DATE_ISO] || null) : null;

// ─── Demo data for help screens ───────────────────────────────────────────────
const DP1 = 'KEVIN BACON';
const DP2 = 'BRIE LARSON';
const DR1 = new Set([5, 9, 10]); // space(5), O(9), N(10)
const DR2 = new Set([4, 9, 10]); // space(4), O(9), N(10)

// ─── Mini display components ──────────────────────────────────────────────────
function MiniSlot({ ch, state }) {
  const rev = state === 'revealed';
  const slot = state === 'slot';
  return (
    <div style={{
      width: 22, height: 30, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderBottom: `2px solid ${rev ? 'var(--accent)' : 'var(--border)'}`,
      fontFamily: "'DM Mono',monospace", fontSize: '0.72rem', fontWeight: 500,
      color: rev ? 'var(--accent)' : 'var(--text)',
      opacity: state === 'hidden' ? 0 : 1,
      transition: 'opacity 0.3s, color 0.3s, border-color 0.3s',
      userSelect: 'none',
    }}>{slot ? '' : ch}</div>
  );
}

function MiniPhrase({ phrase, getState }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
      {phrase.split('').map((ch, i) =>
        ch === ' '
          ? <div key={i} style={{ width: 22, flexShrink: 0 }} />
          : <MiniSlot key={i} ch={ch} state={getState(i)} />
      )}
    </div>
  );
}

function MiniTile({ ch, state }) {
  return (
    <div style={{
      width: 36, height: 42, borderRadius: 4,
      border: `1.5px solid ${state === 'done' ? 'var(--border-dim)' : state === 'pending' ? 'var(--pending-bg)' : 'var(--border)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Mono',monospace", fontSize: '0.9rem', fontWeight: 500,
      background: state === 'pending' ? 'var(--pending-bg)' : state === 'done' ? 'transparent' : 'var(--tile-bg)',
      color: state === 'pending' ? 'var(--pending-text)' : state === 'done' ? 'var(--dim)' : 'var(--text)',
      opacity: state === 'done' ? 0.4 : 1,
      transition: 'background 0.15s, color 0.15s, opacity 0.3s',
      boxShadow: state === 'normal' ? '0 1px 2px rgba(0,0,0,0.07)' : 'none',
      userSelect: 'none',
    }}>{ch}</div>
  );
}

// ─── Help animations ──────────────────────────────────────────────────────────
function HandLabel({ children, style }) {
  return (
    <span style={{
      fontFamily: "'Caveat',cursive", fontWeight: 600, fontSize: '1.2rem',
      color: 'var(--accent)', whiteSpace: 'nowrap', lineHeight: 1, ...style,
    }}>{children}</span>
  );
}

function HelpScreen1() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1rem', color: 'var(--dim)', marginBottom: 10 }}>
        "they are what we eat"
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <MiniPhrase phrase={DP1} getState={() => 'plain'} />
        <MiniPhrase phrase={DP2} getState={() => 'plain'} />
      </div>
    </div>
  );
}

function HelpScreen2() {
  const ROW_W = DP1.length * 22 + (DP1.length - 1) * 2; // 262
  const pairCenter = (DP1.length - 2) * 24 + 23; // center of the final O/N columns, within row coords
  const SIDE = 50; // room for the corner labels on each side
  const OUTER_W = ROW_W + SIDE * 2;
  const ovalCx = SIDE + pairCenter;

  return (
    <div style={{ position: 'relative', width: OUTER_W }}>

      {/* theme, top-left, diagonal arrow down into the clue */}
      <div style={{ position: 'absolute', top: 0, left: 0 }}>
        <HandLabel>theme</HandLabel>
      </div>
      <svg width={OUTER_W} height="42" style={{ position: 'absolute', top: 16, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
        <path d={`M${SIDE - 16},2 C${SIDE + 4},10 ${SIDE + 18},20 ${SIDE + 34},34`} fill="none" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" />
        <path d={`M${SIDE + 34},34 L${SIDE + 25},30 M${SIDE + 34},34 L${SIDE + 30},25`} stroke="var(--accent)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </svg>

      {/* common letters / same location, top-right, arrow curving down to the oval */}
      <div style={{ position: 'absolute', top: 0, right: 0, textAlign: 'right' }}>
        <HandLabel style={{ display: 'block' }}>common letters,</HandLabel>
        <HandLabel style={{ display: 'block' }}>same location</HandLabel>
      </div>
      <svg width={OUTER_W} height="118" style={{ position: 'absolute', top: 30, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
        <path d={`M${OUTER_W - SIDE + 8},2 C${OUTER_W - SIDE - 14},36 ${ovalCx + 14},66 ${ovalCx},98`} fill="none" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" />
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40 }}>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1rem', color: 'var(--dim)', marginBottom: 10 }}>
          "they are what we eat"
        </div>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MiniPhrase phrase={DP1} getState={() => 'plain'} />
          <MiniPhrase phrase={DP2} getState={() => 'plain'} />
          {/* single oval circling the O/N pair in both phrases */}
          <svg width={ROW_W + 20} height="86" style={{ position: 'absolute', left: -10, top: -8, overflow: 'visible', pointerEvents: 'none' }}>
            <ellipse cx={pairCenter + 10} cy="43" rx="32" ry="43" fill="none" stroke="var(--accent)" strokeWidth="1.3" />
          </svg>
        </div>

        {/* same length bracket */}
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg width={ROW_W} height="12" style={{ overflow: 'visible' }}>
            <path d={`M2,2 L2,8 L${ROW_W - 2},8 L${ROW_W - 2},2`} fill="none" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <HandLabel style={{ marginTop: 2 }}>same length</HandLabel>
        </div>
      </div>
    </div>
  );
}

// Fadeable indices for each demo phrase: every letter except the final two.
function fadeableIndices(phrase) {
  const out = [];
  for (let i = 0; i < phrase.length - 2; i++) if (phrase[i] !== ' ') out.push(i);
  return out;
}
const FADE1 = fadeableIndices(DP1);
const FADE2 = fadeableIndices(DP2);
// Reveal order: all of row1's letters, left to right, then all of row2's.
const FADE_SEQUENCE = [
  ...FADE1.map(idx => ({ pi: 0, idx })),
  ...FADE2.map(idx => ({ pi: 1, idx })),
];

function HelpScreen3({ active }) {
  const [hidden1, setHidden1] = useState(new Set());
  const [hidden2, setHidden2] = useState(new Set());

  useEffect(() => {
    if (!active) return;
    setHidden1(new Set());
    setHidden2(new Set());
    const START = 500, STEP = 220;
    const ts = [];
    FADE_SEQUENCE.forEach(({ pi, idx }, k) => {
      ts.push(setTimeout(() => {
        if (pi === 0) setHidden1(s => new Set([...s, idx]));
        else setHidden2(s => new Set([...s, idx]));
      }, START + k * STEP));
    });
    return () => ts.forEach(clearTimeout);
  }, [active]);

  // The underscore (border-bottom) always stays put — only the letter glyph fades.
  const slotStyle = {
    width: 22, height: 30, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderBottom: '2px solid var(--border)',
    fontFamily: "'DM Mono',monospace", fontSize: '0.72rem', fontWeight: 500,
    color: 'var(--text)', userSelect: 'none',
  };

  const renderPhrase = (phrase, hiddenSet) => (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
      {phrase.split('').map((ch, i) =>
        ch === ' '
          ? <div key={i} style={{ width: 22, flexShrink: 0 }} />
          : (
            <div key={i} style={slotStyle}>
              <span style={{ opacity: hiddenSet.has(i) ? 0 : 1, transition: 'opacity 0.4s ease' }}>{ch}</span>
            </div>
          )
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1rem', color: 'var(--dim)', marginBottom: 10 }}>
        "they are what we eat"
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {renderPhrase(DP1, hidden1)}
        {renderPhrase(DP2, hidden2)}
      </div>
    </div>
  );
}

function HelpScreen4({ active }) {
  const TILES = ['A', 'B', 'R', 'E', 'L'];
  const [rev1, setRev1] = useState(new Set(DR1));
  const [rev2, setRev2] = useState(new Set(DR2));
  const [tiles, setTiles] = useState({ A: 'normal', B: 'normal', R: 'normal', E: 'normal', L: 'normal' });
  const [cycle, setCycle] = useState(0);
  const [cursorX, setCursorX] = useState(null);
  const [clicking, setClicking] = useState(false);

  // Tile centers within the flex row (width 36, gap 8 → step 44)
  const tileCenter = idx => 18 + idx * 44;

  useEffect(() => {
    if (!active) return;
    setRev1(new Set(DR1)); setRev2(new Set(DR2));
    setTiles({ A: 'normal', B: 'normal', R: 'normal', E: 'normal', L: 'normal' });
    setCursorX(null); setClicking(false);
    const ts = []; const t = (ms, fn) => ts.push(setTimeout(fn, ms));
    // B (index 1)
    t(350,  () => setCursorX(tileCenter(1)));
    t(500,  () => { setClicking(true); setTiles(s => ({ ...s, B: 'pending' })); });
    t(680,  () => setClicking(false));
    t(1000, () => { setTiles(s => ({ ...s, B: 'done' })); setRev1(s => new Set([...s, 6])); setRev2(s => new Set([...s, 0])); });
    // R (index 2)
    t(1350, () => setCursorX(tileCenter(2)));
    t(1500, () => { setClicking(true); setTiles(s => ({ ...s, R: 'pending' })); });
    t(1680, () => setClicking(false));
    t(2000, () => { setTiles(s => ({ ...s, R: 'done' })); setRev2(s => new Set([...s, 1, 7])); });
    // E (index 3)
    t(2350, () => setCursorX(tileCenter(3)));
    t(2500, () => { setClicking(true); setTiles(s => ({ ...s, E: 'pending' })); });
    t(2680, () => setClicking(false));
    t(3000, () => { setTiles(s => ({ ...s, E: 'done' })); setRev1(s => new Set([...s, 1])); setRev2(s => new Set([...s, 3])); });
    t(4600, () => setCycle(c => c + 1));
    return () => ts.forEach(clearTimeout);
  }, [cycle, active]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <MiniPhrase phrase={DP1} getState={i => rev1.has(i) ? 'revealed' : 'slot'} />
        <MiniPhrase phrase={DP2} getState={i => rev2.has(i) ? 'revealed' : 'slot'} />
      </div>
      {/* Wrapper with explicit height so the below-tile cursor isn't clipped */}
      <div style={{ position: 'relative', width: TILES.length * 44 - 8, height: 70 }}>
        <div style={{ display: 'flex', gap: 8, position: 'absolute', top: 0, left: 0 }}>
          {TILES.map(ch => <MiniTile key={ch} ch={ch} state={tiles[ch]} />)}
        </div>
        {cursorX !== null && (
          <div style={{
            position: 'absolute', left: cursorX - 6, top: 44,
            transition: 'left 0.28s ease', pointerEvents: 'none', zIndex: 10,
            transform: clicking ? 'scale(0.8)' : 'scale(1)',
          }}>
            <svg width="16" height="20" viewBox="0 0 16 20" style={{ transition: 'transform 0.1s', display: 'block' }}>
              <path d="M2 1 L2 15 L5.5 11.5 L8 18 L10 17 L7.5 10.5 L13 10.5 Z"
                fill={clicking ? 'var(--accent)' : 'var(--text)'}
                stroke="white" strokeWidth="1" strokeLinejoin="round"
                style={{ transition: 'fill 0.12s' }} />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function HelpScreen5({ active }) {
  const REV1 = new Set([1, 5, 6, 9, 10]);
  const REV2 = new Set([0, 1, 3, 4, 7, 9, 10]);
  const [t1, setT1] = useState({});
  const [t2, setT2] = useState({});
  const [win, setWin] = useState(false);

  useEffect(() => {
    if (!active) return;
    setT1({}); setT2({}); setWin(false);
    const ts = []; const t = (ms, fn) => ts.push(setTimeout(fn, ms));
    t(300,  () => setT1(s => ({ ...s, 0: 'K' })));
    t(500,  () => setT1(s => ({ ...s, 2: 'V' })));
    t(700,  () => setT1(s => ({ ...s, 3: 'I' })));
    t(900,  () => setT1(s => ({ ...s, 4: 'N' })));
    t(1100, () => setT1(s => ({ ...s, 7: 'A' })));
    t(1300, () => setT1(s => ({ ...s, 8: 'C' })));
    t(1600, () => setT2(s => ({ ...s, 2: 'I' })));
    t(1800, () => setT2(s => ({ ...s, 5: 'L' })));
    t(2000, () => setT2(s => ({ ...s, 6: 'A' })));
    t(2200, () => setT2(s => ({ ...s, 8: 'S' })));
    t(2600, () => setWin(true));
    return () => ts.forEach(clearTimeout);
  }, [active]);

  const g1 = i => (win || REV1.has(i)) ? 'revealed' : t1[i] ? 'plain' : 'slot';
  const g2 = i => (win || REV2.has(i)) ? 'revealed' : t2[i] ? 'plain' : 'slot';
  const ck = { fontFamily: "'DM Mono',monospace", fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent)', marginLeft: 8, transition: 'opacity 0.3s' };
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

// ─── Help content ─────────────────────────────────────────────────────────────
const HELP_TEXT = [
  'This is a doppel.',
  'A doppel is a pair of phrases that have three things in common: character length, at least one letter in the same position, and a theme.',
  "In this game, only the doppel's key characteristics — its length, common letters in identical spots, and clue — are visible. You must guess the rest.",
  'To do that, you have access to all the letters that appear in either word. Double click to reveal their places, but choose wisely: you only get three. The fewer you use, the more impressive your achievement.',
  'Correctly guess the doppel to win.',
];
const HELP_COMPS = [HelpScreen1, HelpScreen2, HelpScreen3, HelpScreen4, HelpScreen5];
const LAST_HELP_PAGE = HELP_COMPS.length - 1;

function renderHighlighted(text) {
  return text.split(/(doppel)/gi).map((part, i) =>
    part.toLowerCase() === 'doppel'
      ? <span key={i} style={{ color: 'var(--accent)' }}>{part}</span>
      : part
  );
}

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
    if (candidate.length <= 12) { lineText = candidate; }
    else { lines.push({ text: lineText, start: lineStart }); lineStart = charPos; lineText = word; }
    charPos += word.length + 1;
  }
  if (lineText) lines.push({ text: lineText, start: lineStart });
  return lines;
}

// ─── Stats modal ──────────────────────────────────────────────────────────────
function StatsModal({ onClose }) {
  const results = loadResults();
  const entries = Object.values(results);
  const wins = entries.filter(e => e.outcome === 'win');
  const losses = entries.filter(e => e.outcome === 'lose');
  const played = entries.length;
  const winPct = played ? Math.round(wins.length / played * 100) : 0;
  const byReveals = [0, 1, 2, 3].map(n => wins.filter(e => e.reveals === n).length);
  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid var(--border-dim)' };
  const lbl = { fontFamily: "'DM Mono',monospace", fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--dim)' };
  const val = { fontFamily: "'DM Mono',monospace", fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }} onClick={onClose}>
      <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 10, maxWidth: 320, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', padding: '1.8rem 1.6rem' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', fontSize: '1.2rem', lineHeight: 1, padding: 0 }}>×</button>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1.3rem', color: 'var(--accent)', marginBottom: '1.2rem' }}>My Stats</div>
        <div style={row}><span style={lbl}>Played</span><span style={val}>{played}</span></div>
        <div style={{ ...row, marginBottom: '0.6rem' }}><span style={lbl}>Win %</span><span style={val}>{winPct}</span></div>
        <div style={row}><span style={lbl}>Perfect (no reveals)</span><span style={val}>{byReveals[0]}</span></div>
        <div style={row}><span style={lbl}>1 reveal</span><span style={val}>{byReveals[1]}</span></div>
        <div style={row}><span style={lbl}>2 reveals</span><span style={val}>{byReveals[2]}</span></div>
        <div style={row}><span style={lbl}>3 reveals</span><span style={val}>{byReveals[3]}</span></div>
        <div style={{ ...row, borderBottom: 'none' }}><span style={lbl}>Gave up</span><span style={val}>{losses.length}</span></div>
      </div>
    </div>
  );
}

// ─── Archive modal ─────────────────────────────────────────────────────────────
function ArchiveModal({ onClose }) {
  const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0', borderBottom: '1px solid var(--border-dim)', cursor: 'pointer', textDecoration: 'none', color: 'inherit' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={onClose}>
      <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 10, maxWidth: 340, width: '100%', maxHeight: '80dvh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', padding: '1.6rem' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', fontSize: '1.2rem', lineHeight: 1, padding: 0 }}>×</button>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1.3rem', color: 'var(--accent)', marginBottom: '1rem' }}>Past puzzles</div>
        {ARCHIVE_ENTRIES.length === 0
          ? <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', color: 'var(--dim)', textAlign: 'center', padding: '1rem 0' }}>No past puzzles yet.</div>
          : ARCHIVE_ENTRIES.map(e => {
            const res = loadResults()[e.date];
            return (
              <a key={e.date} href={`?date=${e.date}`} style={rowStyle}>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>{formatDisplayDate(e.date)}</div>
                  <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1rem', color: 'var(--text)', marginTop: 2 }}>"{e.title}"</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  {res && (res.outcome === 'win'
                    ? <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.72rem', color: 'var(--accent)', letterSpacing: '0.04em' }}>{res.reveals === 0 ? '★' : '●'.repeat(res.reveals)}</span>
                    : <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.72rem', color: 'var(--dim)' }}>✗</span>
                  )}
                  <div style={{ color: 'var(--dim)', fontSize: '0.9rem' }}>›</div>
                </div>
              </a>
            );
          })
        }
      </div>
    </div>
  );
}

// ─── Result modal ──────────────────────────────────────────────────────────────
function ResultModal({ outcome, reveals, onClose, onArchive }) {
  const [copied, setCopied] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const win = outcome === 'win';
  const heading = win ? (reveals === 0 ? 'Perfect!' : 'Nice!') : 'Better luck next time!';
  const dots = '🔵'.repeat(reveals);

  const shareText = [
    `doppel — ${PUZZLE_DATE}`,
    `"${PUZZLE_CLUE}"`,
    win ? `${heading}${dots ? ' ' + dots : ''}` : `Gave up${dots ? ' ' + dots : ''}`,
    typeof window !== 'undefined' ? window.location.href : '',
  ].filter(Boolean).join('\n');

  async function doShare() {
    if (navigator.share) {
      try { await navigator.share({ text: shareText }); } catch { /* cancelled */ }
    } else {
      copyToClipboard();
    }
  }
  async function copyToClipboard() {
    try { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* unsupported */ }
  }

  const shareBtn = { flex: 1, background: 'var(--accent)', border: 'none', color: '#fff', fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.6rem 0.4rem', borderRadius: 5, cursor: 'pointer', fontWeight: 500 };
  const ghostBtn = { ...shareBtn, background: 'none', border: '1px solid var(--border)', color: 'var(--text)' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={onClose}>
      <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 10, maxWidth: 340, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', padding: '1.8rem 1.6rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', fontSize: '1.2rem', lineHeight: 1, padding: 0 }}>×</button>

        <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1.6rem', color: 'var(--accent)', marginBottom: '0.6rem' }}>{heading}</div>

        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.7rem', color: 'var(--dim)', marginBottom: '0.3rem' }}>
          {reveals === 0 ? 'You used no reveals' : `You used ${reveals} reveal${reveals === 1 ? '' : 's'}`}
        </div>
        {dots && <div style={{ fontSize: '1rem', marginBottom: '0.6rem', letterSpacing: '0.1em' }}>{dots}</div>}

        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '1.2rem' }}>
          {PUZZLE_DATE} · "{PUZZLE_CLUE}"
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={doShare} style={shareBtn}>Share</button>
          <button onClick={onArchive} style={ghostBtn}>Archive</button>
          <button onClick={() => setShowStats(true)} style={ghostBtn}>Stats</button>
        </div>
      </div>
      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { p1, p2 } = PUZZLE;
  const COMMON = getCommon(p1, p2);
  const isAlreadyPlayed = !!PREV_RESULT;

  const [pool, setPool] = useState(() => getPool(p1, p2));
  const [rev1, setRev1] = useState(() => {
    if (isAlreadyPlayed) return new Set(Array.from({ length: p1.length }, (_, i) => i));
    const s = new Set(COMMON); for (let i = 0; i < p1.length; i++) if (p1[i] === ' ') s.add(i); return s;
  });
  const [rev2, setRev2] = useState(() => {
    if (isAlreadyPlayed) return new Set(Array.from({ length: p2.length }, (_, i) => i));
    const s = new Set(COMMON); for (let i = 0; i < p2.length; i++) if (p2[i] === ' ') s.add(i); return s;
  });
  const [tentative, setTent]  = useState(new Map());
  const [picksLeft, setPicks] = useState(isAlreadyPlayed ? MAX_PICKS - PREV_RESULT.reveals : MAX_PICKS);
  const [dragging,  setDrag]  = useState(null);
  const [typed1,    setTyped1] = useState({});
  const [typed2,    setTyped2] = useState({});
  const [focus1,    setFocus1] = useState(null);
  const [focus2,    setFocus2] = useState(null);
  const [won1,      setWon1]  = useState(isAlreadyPlayed && PREV_RESULT.outcome === 'win');
  const [won2,      setWon2]  = useState(isAlreadyPlayed && PREV_RESULT.outcome === 'win');
  const [err1,      setErr1]  = useState(false);
  const [err2,      setErr2]  = useState(false);
  const [pendingTile, setPendingTile] = useState(null);
  const [touchDragSlot, setTouchDragSlot] = useState(null);
  const [ghostPos,  setGhostPos]  = useState(null);
  const [ghostChar, setGhostChar] = useState(null);
  const [gaveUp,    setGaveUp]   = useState(isAlreadyPlayed && PREV_RESULT.outcome === 'lose');
  const [giveUpRev1, setGiveUpRev1] = useState(new Set());
  const [giveUpRev2, setGiveUpRev2] = useState(new Set());
  const [showResult, setShowResult] = useState(isAlreadyPlayed);
  const [showArchive, setShowArchive] = useState(false);

  // Help — skip for archive visits and for players returning to a puzzle they already finished
  const [showHelp, setShowHelp] = useState(() => !localStorage.getItem(HELP_KEY) && !IS_ARCHIVE_MODE && !isAlreadyPlayed);
  const [helpPage, setHelpPage] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  // Carousel drag
  const [dragDelta, setDragDelta] = useState(0);
  const [swiping,   setSwiping]   = useState(false);
  const [cardWidth, setCardWidth]  = useState(340);
  const cardRef    = useRef(null);
  const helpDragX  = useRef(null);
  const helpDragDX = useRef(0);

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

  // Measure card width whenever help opens
  useEffect(() => {
    if (showHelp && cardRef.current) setCardWidth(cardRef.current.offsetWidth);
  }, [showHelp]);

  // Pop up the result modal as soon as both phrases are solved.
  useEffect(() => {
    if (won1 && won2) setShowResult(true);
  }, [won1, won2]);


  function handleGiveUp() {
    setGaveUp(true);
    setPendingTile(null);
    const pending1 = []; for (let i = 0; i < p1.length; i++) if (p1[i] !== ' ' && !rev1.has(i)) pending1.push(i);
    const pending2 = []; for (let i = 0; i < p2.length; i++) if (p2[i] !== ' ' && !rev2.has(i)) pending2.push(i);
    const STEP = 90, START = 350, GAP = 350;
    pending1.forEach((idx, k) => setTimeout(() => setGiveUpRev1(s => new Set([...s, idx])), START + k * STEP));
    const p2Start = START + pending1.length * STEP + GAP;
    pending2.forEach((idx, k) => setTimeout(() => setGiveUpRev2(s => new Set([...s, idx])), p2Start + k * STEP));
    const total = p2Start + pending2.length * STEP + 700;
    saveResult(PUZZLE_DATE_ISO, 'lose', MAX_PICKS - picksLeft);
    setTimeout(() => setShowResult(true), total);
  }

  function closeHelp() {
    if (dontShow) localStorage.setItem(HELP_KEY, '1');
    setShowHelp(false);
    setHelpPage(0);
  }
  function openHelp() { setHelpPage(0); setDragDelta(0); setSwiping(false); setShowHelp(true); }

  // ── Help carousel touch ──────────────────────────────────────────────────
  function onHelpTouchStart(e) {
    helpDragX.current = e.touches[0].clientX;
    helpDragDX.current = 0;
    setSwiping(false);
    setDragDelta(0);
  }
  function onHelpTouchMove(e) {
    if (helpDragX.current === null) return;
    const dx = e.touches[0].clientX - helpDragX.current;
    helpDragDX.current = dx;
    setSwiping(true);
    let d = dx;
    if (helpPage === 0 && dx > 0) d = dx * 0.25;
    if (helpPage === LAST_HELP_PAGE && dx < 0) d = dx * 0.25;
    setDragDelta(d);
  }
  function onHelpTouchEnd() {
    const dx = helpDragDX.current;
    helpDragX.current = null;
    setSwiping(false);
    setDragDelta(0);
    if (dx < -60 && helpPage < LAST_HELP_PAGE) setHelpPage(p => p + 1);
    else if (dx > 60 && helpPage > 0) setHelpPage(p => p - 1);
  }

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
    // Hit-test where the tile is actually drawn (lifted above the finger), not the raw touch point.
    const el = document.elementFromPoint(x, y - GHOST_LIFT);
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
    if (gaveUp || allInstancesRevealed(ch, p1, p2, rev1, rev2)) return;
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
    const altPhrase = pi === 0 ? p2 : p1;
    const guess = buildGuess(pi);
    const correct = guess === phrase || (SPACES_MIRROR && picksLeft === MAX_PICKS && guess === altPhrase);
    if (correct) {
      const setRev = pi === 0 ? setRev1 : setRev2;
      setRev(new Set(Array.from({ length: phrase.length }, (_, i) => i)));
      const otherWon = pi === 0 ? won2 : won1;
      if (otherWon && !isAlreadyPlayed) saveResult(PUZZLE_DATE_ISO, 'win', MAX_PICKS - picksLeft);
      if (pi === 0) setWon1(true); else setWon2(true);
    } else {
      const setErr = pi === 0 ? setErr1 : setErr2;
      setErr(true); setTimeout(() => setErr(false), 1000);
    }
  }

  function hasPlaced(pi) {
    const typed = pi === 0 ? typed1 : typed2;
    for (const key of tentative.keys()) if (key.startsWith(`${pi}-`)) return true;
    return Object.keys(typed).length > 0;
  }

  function recallPhrase(pi) {
    setTent(m => { const n = new Map(); for (const [k, v] of m) if (!k.startsWith(`${pi}-`)) n.set(k, v); return n; });
    if (pi === 0) setTyped1({}); else setTyped2({});
  }

  // ── Layout constants ─────────────────────────────────────────────────────
  const SLOT_W = 22, SPACE_W = 22, GAP = 2, NUM_W = 26;
  const dimLabel = { fontSize: '0.58rem', letterSpacing: '0.14em', color: 'var(--dim)', textTransform: 'uppercase', textAlign: 'center' };
  const PhraseNum = ({ n }) => (
    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0, fontFamily: "'DM Mono',monospace", marginRight: 6, alignSelf: 'flex-end', marginBottom: 4 }}>{n}</div>
  );

  const navBtn = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace", fontSize: '1.2rem', color: 'var(--accent)', padding: '0.25rem 0.5rem' };
  const CW = cardWidth || 340;
  const PAD = 24; // 1.5rem card padding

  if (PUZZLE_ERROR) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1.4rem', color: 'var(--error)', marginBottom: '0.8rem' }}>puzzle.json error</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.6 }}>
            {SCHEDULE_EMPTY
              ? 'puzzle.json has no puzzles in it.'
              : <>phrase1 and phrase2 must be the same length.<br />Check: {BAD_ENTRIES.map(e => e.date).join(', ')}</>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem 1.5rem', gap: '1.8rem' }}>

      {/* Title + help button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '2.4rem', fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.01em', lineHeight: 1 }}>
          doppel
        </div>
        <button onClick={openHelp} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: '0.55rem', color: 'var(--dim)', fontFamily: "'DM Mono',monospace", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, marginTop: 6 }}>?</button>
      </div>

      {IS_ARCHIVE_MODE && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <a href="/" style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--dim)', textDecoration: 'underline', cursor: 'pointer' }}>← Today's puzzle</a>
        </div>
      )}

      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--dim)' }}>{PUZZLE_DATE}</div>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontStyle: 'italic', fontSize: '1.1rem', color: 'var(--text)', marginTop: '0.2rem' }}>"{PUZZLE_CLUE}"</div>
      </div>

      {/* Phrase rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {[p1, p2].map((phrase, pi) => {
          const rev = pi === 0 ? rev1 : rev2, typed = pi === 0 ? typed1 : typed2;
          const giveUpRev = pi === 0 ? giveUpRev1 : giveUpRev2;
          const won = pi === 0 ? won1 : won2, err = pi === 0 ? err1 : err2;
          const focused = pi === 0 ? focus1 : focus2, lines = pi === 0 ? LINES1 : LINES2;
          return (
            <div key={pi} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lines.map((line, lineIdx) => {
                const isFirst = lineIdx === 0;
                return (
                  <div key={lineIdx} style={{ display: 'flex', alignItems: 'flex-end' }}>
                    {isFirst ? <PhraseNum n={pi + 1} /> : <div style={{ width: NUM_W, flexShrink: 0 }} />}
                    <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-end' }}>
                      {line.text.split('').map((ch, j) => {
                        const i = line.start + j, isGiveUpReveal = giveUpRev.has(i), revealed = rev.has(i) || isGiveUpReveal, isSpace = ch === ' ';
                        const tentChar = tentative.get(`${pi}-${i}`), isFocused = focused === i, canDrop = !revealed && !!dragging;
                        if (isSpace) return <div key={i} style={{ width: SPACE_W, flexShrink: 0 }} />;
                        const borderColor = isGiveUpReveal ? 'var(--text)' : (err && !revealed) ? 'var(--error)' : (revealed || isFocused || (canDrop && !tentChar)) ? 'var(--accent)' : 'var(--border)';
                        return (
                          <div key={i} data-slot="true" data-pi={pi} data-idx={i}
                            style={{ width: SLOT_W, height: 38, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `2px solid ${borderColor}`, background: canDrop && !tentChar && !revealed ? 'var(--accent-dim)' : 'transparent', borderRadius: canDrop && !tentChar && !revealed ? '3px 3px 0 0' : 0, transition: 'background 0.12s, border-color 0.2s' }}
                            onDragOver={e => { if (!revealed) e.preventDefault(); }}
                            onDrop={e => { e.preventDefault(); handleDropOnSlot(pi, i); }}>
                            {revealed && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', fontWeight: 500, color: isGiveUpReveal ? 'var(--text)' : 'var(--accent)', userSelect: 'none' }}>{ch}</span>}
                            {!revealed && !gaveUp && tentChar && (
                              <div draggable={!IS_TOUCH} {...slotTileTouch(pi, i, tentChar)}
                                onDragStart={e => { e.stopPropagation(); startDragFromSlot(pi, i, tentChar); }} onDragEnd={handleDragEnd}
                                onClick={e => { e.stopPropagation(); handleTileClick(tentChar); }}
                                style={{ position: 'absolute', inset: '0 0 2px 0', border: `1.5px solid ${pendingTile === tentChar ? 'var(--pending-bg)' : 'var(--border)'}`, borderRadius: 3, background: pendingTile === tentChar ? 'var(--pending-bg)' : 'var(--tile-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', fontWeight: 500, color: pendingTile === tentChar ? 'var(--pending-text)' : 'var(--text)', cursor: 'pointer', userSelect: 'none', boxShadow: pendingTile === tentChar ? 'none' : '0 1px 3px rgba(0,0,0,0.12)', touchAction: 'none', opacity: touchDragSlot?.pi === pi && touchDragSlot?.idx === i ? 0 : 1, transition: 'background 0.15s, color 0.15s' }}>
                                {tentChar}
                              </div>
                            )}
                            {!revealed && !gaveUp && !tentChar && (
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
                    </div>
                  </div>
                );
              })}
              {!gaveUp && (won
                ? <div style={{ paddingLeft: NUM_W, fontSize: '1rem', color: 'var(--accent)', fontWeight: 700 }}>✓</div>
                : <div style={{ display: 'flex', gap: 8, paddingLeft: NUM_W }}>
                    <button onClick={() => recallPhrase(pi)} disabled={!hasPlaced(pi)} title="Recall tiles" style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--dim)', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', padding: 0, flexShrink: 0, cursor: hasPlaced(pi) ? 'pointer' : 'default', opacity: hasPlaced(pi) ? 1 : 0.35, transition: 'opacity 0.2s' }}>↺</button>
                    <button onClick={() => submitGuess(pi)} style={{ background: 'var(--accent)', border: 'none', color: '#fff', fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '0.5rem 0.7rem', borderRadius: 3, cursor: 'pointer', fontWeight: 500 }}>Submit</button>
                  </div>
              )}
            </div>
          );
        })}
      </div>

      {!gaveUp && !(won1 && won2) && (
        <button onClick={handleGiveUp} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'underline', cursor: 'pointer', padding: '0.2rem 0.4rem' }}>I give up</button>
      )}

      {/* Tiles-left indicator, floated above the rack */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={dimLabel}>tiles left</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: MAX_PICKS }).map((_, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < picksLeft ? 'var(--accent)' : 'var(--border-dim)', transition: 'background 0.3s' }} />
          ))}
        </div>
      </div>

      {/* Tile rack */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
        background: 'var(--rack-bg)', border: '1px solid var(--rack-border)',
        borderRadius: 14, padding: '0.9rem 1.4rem 1.1rem',
        boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.08), inset 0 -1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 520 }}>
          {pool.map((ch, i) => {
            const done = gaveUp || allInstancesRevealed(ch, p1, p2, rev1, rev2);
            return (
              <div key={ch} data-pool-tile={i} draggable={!IS_TOUCH} {...poolTileTouch(ch, i)}
                onDragStart={() => startDragFromPool(ch, i)} onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); if (poolDragIdx.current !== null && poolDragIdx.current !== i) { const src = poolDragIdx.current; setPool(prev => { const next = [...prev]; const [moved] = next.splice(src, 1); next.splice(i, 0, moved); return next; }); } poolDragIdx.current = null; setDrag(null); }}
                onClick={() => handleTileClick(ch)}
                style={{ width: 36, height: 42, border: `1.5px solid ${done ? 'var(--border-dim)' : pendingTile === ch ? 'var(--pending-bg)' : 'var(--border)'}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono',monospace", fontSize: '0.9rem', fontWeight: 500, background: done ? 'transparent' : pendingTile === ch ? 'var(--pending-bg)' : 'var(--tile-bg)', color: done ? 'var(--border-dim)' : pendingTile === ch ? 'var(--pending-text)' : 'var(--text)', cursor: done ? 'default' : 'pointer', userSelect: 'none', opacity: done ? 0.35 : 1, transition: 'background 0.15s, color 0.15s, opacity 0.3s', boxShadow: !done && pendingTile !== ch ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', touchAction: 'none' }}>
                {ch}
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.68rem', letterSpacing: '0.1em', color: 'var(--text)', textTransform: 'uppercase', textAlign: 'center', opacity: 0.65 }}>Double click to reveal</div>
      </div>

      {showResult && (
        <ResultModal
          outcome={gaveUp ? 'lose' : 'win'}
          reveals={MAX_PICKS - picksLeft}
          onClose={() => setShowResult(false)}
          onArchive={() => { setShowResult(false); setShowArchive(true); }}
        />
      )}

      {showArchive && <ArchiveModal onClose={() => setShowArchive(false)} />}

      {ghostPos && ghostChar && (
        <div style={{ position: 'fixed', left: ghostPos.x - 18, top: ghostPos.y - 21 - GHOST_LIFT, width: 36, height: 42, border: '1.5px solid var(--border)', borderRadius: 4, background: 'var(--tile-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono',monospace", fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)', pointerEvents: 'none', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', opacity: 0.9, userSelect: 'none' }}>
          {ghostChar}
        </div>
      )}

      {/* Help modal */}
      {showHelp && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
          onClick={closeHelp}
        >
          <div
            ref={cardRef}
            style={{ background: 'var(--bg)', borderRadius: 10, maxWidth: 380, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
            onTouchStart={onHelpTouchStart}
            onTouchMove={onHelpTouchMove}
            onTouchEnd={onHelpTouchEnd}
          >
            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${PAD}px ${PAD}px ${PAD * 0.6}px`, minHeight: 52 }}>
              {helpPage === 0
                ? <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                    <input type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--dim)' }}>Don't show this again</span>
                  </label>
                : <div />
              }
              <button onClick={closeHelp} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', fontSize: '1.2rem', lineHeight: 1, padding: 0, marginLeft: 8 }}>×</button>
            </div>

            {/* Slides viewport */}
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                display: 'flex',
                width: `${HELP_COMPS.length * CW}px`,
                transform: `translateX(${-helpPage * CW + dragDelta}px)`,
                transition: swiping ? 'none' : 'transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)',
                willChange: 'transform',
              }}>
                {HELP_COMPS.map((Comp, p) => (
                  <div key={p} style={{ width: CW, flexShrink: 0, padding: `0 ${PAD}px`, boxSizing: 'border-box' }}>
                    <div style={{ margin: `0 0 ${PAD}px` }}>
                      {HELP_TEXT[p].split('\n\n').map((para, pi, arr) => (
                        <p key={pi} style={{ fontFamily: "'DM Serif Display',serif", fontSize: '1.15rem', color: 'var(--text)', lineHeight: 1.55, margin: pi < arr.length - 1 ? '0 0 0.7em' : 0 }}>
                          {renderHighlighted(para)}
                        </p>
                      ))}
                    </div>
                    {Comp && (
                      <div style={{ display: 'flex', justifyContent: 'center', minHeight: 118, alignItems: 'center' }}>
                        <Comp active={helpPage === p} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${PAD * 0.8}px ${PAD}px ${PAD}px` }}>
              <button onClick={() => setHelpPage(p => p - 1)} disabled={helpPage === 0} style={{ ...navBtn, opacity: helpPage === 0 ? 0.25 : 1 }}>←</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {Array.from({ length: HELP_COMPS.length }, (_, i) => (
                  <div key={i} onClick={() => setHelpPage(i)} style={{ width: 8, height: 8, borderRadius: '50%', background: i === helpPage ? 'var(--accent)' : 'var(--border-dim)', cursor: 'pointer', transition: 'background 0.2s' }} />
                ))}
              </div>
              {helpPage < LAST_HELP_PAGE
                ? <button onClick={() => setHelpPage(p => p + 1)} style={navBtn}>→</button>
                : <button onClick={closeHelp} style={{ background: 'var(--accent)', border: 'none', color: '#fff', fontFamily: "'DM Mono',monospace", fontSize: '0.68rem', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '0.55rem 1rem', borderRadius: 3, cursor: 'pointer', fontWeight: 500 }}>Play</button>
              }
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
