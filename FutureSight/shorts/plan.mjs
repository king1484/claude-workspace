// plan.mjs — builds shorts/plan.json (segments, camera keys, captions) and shorts/work/audio_plan.json
//   node shorts/plan.mjs
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const LAYOUT = require(path.join(ROOT, 'layout.js'));
const WORDS = JSON.parse(fs.readFileSync(path.join(HERE, 'work', 'words.json'), 'utf8'));

// global source time of a VO line start
const lineT = (ch, id) => { const c = LAYOUT[ch]; const l = c.vo.find((x) => x.id === id); return c.start + l.start; };

// ---- cut list (source = the published 1920x1080 video's global timeline, seconds) ----
// A0/A1: audio+picture source range; vOff: picture is shifted by this many seconds relative to audio (cold open only)
const CUTS = [
  { name: 'cold',    A0: 221.30, A1: 223.80, vOff: 0.76, lines: [['ch5', 'h2', 2.3]] },
  { name: 'what_if', A0: 7.40,   A1: 9.82,   vOff: -0.38, hold: 2.15, lines: [['hook', 'l4']] },
  { name: 'rules',   A0: 11.22,  A1: 14.22,  lines: [['ch1', 'r1']] },
  { name: 'ghost',   A0: 16.81,  A1: 20.08,  lines: [['ch1', 'r3']] },
  { name: 'mug',     A0: 35.13,  A1: 40.85,  lines: [['ch2', 'm2'], ['ch2', 'm3']] },
  { name: 'thief',   A0: 93.96,  A1: 100.52, lines: [['ch3b', 'p2']] },
  { name: 'early',   A0: 127.55, A1: 129.45, lines: [['ch3b', 'p7']] },
  { name: 'run',     A0: 224.53, A1: 231.82, lines: [['ch5', 'h3'], ['ch5', 'h4']] },
  { name: 'safe',    A0: 232.31, A1: 234.60, lines: [['ch5', 'h5']] },
  { name: 'quiet',   A0: 327.74, A1: 330.35, lines: [['ch7', 'z2']] },
  { name: 'nothing', A0: 335.72, A1: 338.95, vOff: 0.4, lines: [['ch7', 'z4']] },
  { name: 'ends',    A0: 343.56, A1: 350.95, lines: [['ch7', 'z6'], ['ch7', 'z7'], ['ch7', 'z8']] },
  { name: 'zero',    A0: 352.90, A1: 355.10, lines: [] },
];

// ---- camera keys per segment: [localT, cx, cy, zoom, yc]  (source px; yc = output y of source cy) ----
const CAMS = JSON.parse(fs.readFileSync(path.join(HERE, 'cams.json'), 'utf8'));
// optional hero-centred x tracks per segment (shorts/center_cams.mjs -> cx_track.json): keeps the main subject on the vertical centre line
const CX = fs.existsSync(path.join(HERE, 'cx_track.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'cx_track.json'), 'utf8')) : {};

const HL = new Set(['TEN', 'SECONDS', 'GHOST', 'FUTURE', 'EARLY', 'TRUCK', 'NOTHING', 'ENDS', 'AHEAD']);
let s0 = 0;
const segs = [];
const phrases = [];
for (const c of CUTS) {
  const dur = c.A1 - c.A0;
  const seg = { name: c.name, s0: +s0.toFixed(4), dur: +dur.toFixed(4), T0: +(c.A0 + (c.vOff || 0)).toFixed(4), A0: c.A0, A1: c.A1, hold: c.hold, cam: CAMS[c.name] || [[0, 960, 600, 1.2, 900]], cxTrack: CX[c.name] };
  segs.push(seg);
  for (const [ch, id, minS] of c.lines) {
    const W = WORDS[id].words;
    const base = ch === 'hook' ? 7.35 : lineT(ch, id);
    let ws = W.filter((w) => w.s >= (minS ?? 0) - 0.01).map((w) => {
      let t = w.w.toUpperCase().replace(/^10\b/, 'TEN');
      const k = t.replace(/[^A-Z]/g, '');
      const wT = base + w.s;
      return { t, s: +(s0 + (Math.max(wT, c.A0 + 0.04) - c.A0)).toFixed(3), e: +(s0 + (base + w.e - c.A0)).toFixed(3), hl: HL.has(k) };
    });
    // chunk into phrases
    let cur = [];
    const flush = () => { if (cur.length) phrases.push({ words: cur, seg: c.name, segEnd: s0 + dur }); cur = []; };
    for (const w of ws) {
      cur.push(w);
      const last = /[.?!]$/.test(w.t), comma = /,$/.test(w.t);
      const chars = cur.reduce((s, x) => s + x.t.length + 1, 0);
      if (last || (comma && cur.length >= 2) || cur.length >= 4 || chars >= 24) flush();
    }
    flush();
  }
  s0 += dur;
}
const total = s0;
// phrase windows
const caps = [];
phrases.forEach((p, i) => {
  const first = p.words[0], last = p.words[p.words.length - 1];
  const t0 = first.s < 0.15 ? 0 : Math.max(0, first.s - 0.05);
  const nxt = phrases[i + 1];
  let t1 = last.e + 0.28;
  if (nxt && nxt.seg === p.seg && nxt.words[0].s - last.e < 0.5) t1 = nxt.words[0].s - 0.05;
  t1 = Math.min(t1, p.segEnd);
  caps.push({ t0: +t0.toFixed(3), t1: +t1.toFixed(3), words: p.words });
});
const plan = { dur: +total.toFixed(3), fps: 30, segs, caps, endFade: [+(total - 0.45).toFixed(3), 0.45] };
fs.writeFileSync(path.join(HERE, 'plan.json'), JSON.stringify(plan, null, 1));
fs.writeFileSync(path.join(HERE, 'work', 'audio_plan.json'), JSON.stringify({ dur: plan.dur, segs: segs.map((s) => ({ name: s.name, s0: s.s0, dur: s.dur, A0: s.A0, A1: s.A1 })) }, null, 1));
console.log('total', total.toFixed(2), 's;', segs.length, 'segments;', caps.length, 'caption phrases');
segs.forEach((s) => console.log(s.name.padEnd(8), 'short', s.s0.toFixed(2), '-', (s.s0 + s.dur).toFixed(2), ' src', s.A0, '-', s.A1));
