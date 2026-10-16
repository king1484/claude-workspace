// center_cams.mjs - builds shorts/cx_track.json: per-segment camera x that keeps the hero (red hoodie) on the vertical centre line.
// In the ghost-void segments (nothing / ends / zero) the hero and the cyan ghost are framed as a pair (midpoint on the centre line).
// Usage (from FutureSight/): node shorts/plan.mjs && node shorts/center_cams.mjs && node shorts/plan.mjs   (plan.mjs merges the tracks)
import { launchRenderBrowser } from '../../tools/browser.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const plan = JSON.parse(fs.readFileSync(path.join(HERE, 'plan.json'), 'utf8'));
const PAIR = new Set(['nothing', 'ends', 'zero']);
const STEP = 0.1, WIN = 0.45;
const browser = await launchRenderBrowser();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(ROOT, 'index_full.html')).href);
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
await page.addScriptTag({ path: path.join(HERE, 'vharness.js') });
const out = {};
for (const seg of plan.segs) {
  const n = Math.round(seg.dur / STEP);
  const raw = [];
  for (let i = 0; i <= n; i++) {
    const u = Math.min(seg.dur, i * STEP), T = seg.T0 + (seg.hold ? Math.min(u, seg.hold) : u);
    const r = await page.evaluate((T) => window.subjectScan(T), T);
    let x = r.hx;
    if (x != null && PAIR.has(seg.name) && r.gn > 12 && r.gx != null) x = (r.hx + r.gx) / 2;
    if (x != null && raw.length) { const prev = [...raw].reverse().find((v) => v != null); if (prev != null && Math.abs(x - prev) > 320) x = null; }   // reject jumps (stray red pixels)
    raw.push(x);
  }
  const known = raw.map((v, i) => [i, v]).filter((p) => p[1] != null);
  if (!known.length) { console.log(seg.name.padEnd(8), 'no hero found: keeping the keyed camera'); continue; }
  const fill = raw.map((v, i) => {                      // linear fill of gaps, hold at the ends
    if (v != null) return v;
    let a = null, b = null; for (const k of known) { if (k[0] < i) a = k; else if (k[0] > i && !b) b = k; }
    if (!a) return b[1]; if (!b) return a[1]; return a[1] + (b[1] - a[1]) * (i - a[0]) / (b[0] - a[0]);
  });
  const w = Math.max(1, Math.round(WIN / STEP));
  const sm = fill.map((_, i) => { let s = 0, c = 0; for (let k = -w; k <= w; k++) { const j = i + k; if (j >= 0 && j < fill.length) { const wt = w + 1 - Math.abs(k); s += fill[j] * wt; c += wt; } } return s / c; });
  out[seg.name] = sm.map((v, i) => [+Math.min(seg.dur, i * STEP).toFixed(2), Math.round(v)]);
  const xs = sm.map((v) => Math.round(v));
  console.log(seg.name.padEnd(8), 'subject x (source px) min', Math.min(...xs), 'max', Math.max(...xs), PAIR.has(seg.name) ? '(pair midpoint)' : '');
}
fs.writeFileSync(path.join(HERE, 'cx_track.json'), JSON.stringify(out));
await browser.close();
