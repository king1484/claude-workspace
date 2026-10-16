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
  const g = document.getElementById('c').getContext('2d');
  const sync = () => g.getImageData(0, 0, 1, 1);
  const M = (name, fn, n = 8) => { fn(); sync(); const t0 = performance.now(); for (let i = 0; i < n; i++) { fn(i); sync(); } return name + ' ' + ((performance.now() - t0) / n).toFixed(1); };
  const out = [];
  const T = CH.c1.T;
  window.seek(1);
  for (const lt of [1.0, 7.0, 12.5, 13.5, 16.8]) {
    out.push('--- lt ' + lt);
    out.push(M('c1.draw', (i) => { g.save(); CH.c1.draw(g, lt + (i || 0) * 0.03, 19.124); g.restore(); }));
    out.push(M('full seek', (i) => window.seek(LAYOUT.c1.start + lt + (i || 0) * 0.03)));
  }
  out.push(M('TOD.drawWorld', (i) => TOD.drawWorld(g, TOD.DEFCAM, 16.5, { scene: 'city', heat: .2, cloud: .3, t: 1 })));
  out.push(M('TOD.grade', () => TOD.grade(g, 16.5, { scene: 'city' })));
  out.push(M('TOD.hud', () => TOD.hud(g, 16.5, { alpha: 1, pop: 1, pulse: 0 })));
  out.push(M('MASCOT.draw', () => MASCOT.draw(g, { x: 900, y: 900, s: 2, facing: 1, pose: 'stand', t: 1, expr: 'neutral', pal: PAL_REAL })));
  return out.join('\n');
});
console.log(res);
await browser.close();
