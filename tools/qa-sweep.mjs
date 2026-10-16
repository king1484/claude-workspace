// QA sweep for HundredHourDay/index_full.html: draws every STEP seconds across the film, records page errors, per-frame time, and a determinism hash check.
// Usage: node tools/qa-sweep.mjs [--step 0.25] [--from 0] [--to 304.5]
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchRenderBrowser } from './browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const A = {};
for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].slice(2)] = process.argv[i + 1];
const step = +(A.step ?? 0.25), from = +(A.from ?? 0), to = +(A.to ?? 304.5);
const browser = await launchRenderBrowser();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
await page.goto(pathToFileURL(path.join(root, 'HundredHourDay', 'index_full.html')).href);
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });

const res = await page.evaluate(async ({ step, from, to }) => {
  const cv = document.getElementById('c'), out = { times: [], slow: [], nonDet: [], blank: [] };
  const hashOf = () => { const g = cv.getContext('2d'); const d = g.getImageData(0, 0, 1920, 1080, { }).data; let h = 2166136261 >>> 0; for (let i = 0; i < d.length; i += 97) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
  for (let t = from; t <= to; t += step) {
    const t0 = performance.now(); window.seek(t); const ms = performance.now() - t0;
    out.times.push(ms);
    if (ms > 120) out.slow.push([+t.toFixed(2), +ms.toFixed(0)]);
    if (Math.round(t / step) % 8 === 0) {      // determinism: draw a different time in between, come back, compare
      const h1 = hashOf(); window.seek(Math.min(to, t + 37.3)); window.seek(t); const h2 = hashOf();
      if (h1 !== h2) out.nonDet.push(+t.toFixed(2));
    }
    if (Math.round(t / step) % 4 === 0) {      // a frame that is nearly one flat colour would mean a chapter fell back to its error screen
      const g = cv.getContext('2d'); const d = g.getImageData(0, 0, 1920, 1080).data; let mn = 255, mx = 0; for (let i = 0; i < d.length; i += 4 * 211) { const v = d[i] + d[i + 1] + d[i + 2]; if (v < mn) mn = v; if (v > mx) mx = v; }
      if (mx - mn < 30 && t > 0.5 && t < to - 1.6) out.blank.push(+t.toFixed(2));
    }
  }
  return out;
}, { step, from, to });

const ts = res.times.slice().sort((a, b) => a - b);
const pct = (p) => ts[Math.min(ts.length - 1, Math.floor(p * ts.length))].toFixed(1);
console.log(`frames ${res.times.length}  ms: median ${pct(0.5)}  p95 ${pct(0.95)}  max ${ts[ts.length - 1].toFixed(1)}`);
console.log('slow (>120 ms):', JSON.stringify(res.slow.slice(0, 20)), res.slow.length > 20 ? `... +${res.slow.length - 20}` : '');
console.log('non-deterministic times:', JSON.stringify(res.nonDet));
console.log('flat/blank frames:', JSON.stringify(res.blank));
console.log('errors:', errors.length ? [...new Set(errors)].join('\n  ') : 'none');
await browser.close();
process.exit(errors.length || res.nonDet.length ? 1 : 0);
