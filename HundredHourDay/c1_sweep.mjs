// c1 dense sweep: exceptions, NaN/Infinity canvas args, per-frame ms. node c1_sweep.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('C:\\Users\\Vinay Singirikonda\\AppData\\Roaming\\npm\\node_modules\\playwright');
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(pathToFileURL(path.join(ROOT, 'index_full.html')).href);
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
const res = await page.evaluate(() => {
  const start = LAYOUT.c1.start, dur = LAYOUT.c1.dur;
  const bad = {}; let cur = 0;
  const names = ['translate', 'scale', 'rotate', 'arc', 'ellipse', 'fillRect', 'strokeRect', 'rect', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arcTo', 'drawImage', 'createRadialGradient', 'createLinearGradient', 'setTransform', 'transform'];
  for (const n of names) {
    const o = CanvasRenderingContext2D.prototype[n];
    CanvasRenderingContext2D.prototype[n] = function () {
      for (let i = 0; i < arguments.length; i++) { const v = arguments[i]; if (typeof v === 'number' && !isFinite(v)) { const k = n + '@' + cur.toFixed(1); bad[k] = (bad[k] || 0) + 1; break; } }
      return o.apply(this, arguments);
    };
  }
  const errs = [], times = []; let worst = 0, worstT = 0;
  const g = document.getElementById('c').getContext('2d');
  for (let lt = 0; lt < dur - 0.001; lt += 0.1) {
    cur = lt;
    const t0 = performance.now();
    try { window.seek(start + lt); g.getImageData(0, 0, 1, 1); } catch (e) { errs.push(lt.toFixed(1) + ':' + e.message); }
    const ms = performance.now() - t0; times.push(ms); if (ms > worst) { worst = ms; worstT = lt; }
  }
  const sorted = times.slice().sort((a, b) => a - b);
  return { errs, bad, worst, worstT, median: sorted[sorted.length >> 1], mean: times.reduce((a, b) => a + b, 0) / times.length, n: times.length };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
