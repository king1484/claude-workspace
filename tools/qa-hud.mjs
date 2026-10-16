// Monotonic-HUD check: wraps TOD.hud, seeks the film in 0.1 s steps and verifies the VISIBLE hour never decreases (digits shown = min(100, floor(H)), 100 held via h100).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchRenderBrowser } from './browser.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const browser = await launchRenderBrowser();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(path.join(root, 'HundredHourDay', 'index_full.html')).href);
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
const r = await page.evaluate(() => {
  const rec = []; let cur = null; const orig = TOD.hud;
  TOD.hud = function (g, H, o) { o = o || {}; cur = { H: o.h100 ? 100 : ((H % 100) + 100) % 100, a: o.alpha == null ? 1 : o.alpha }; return orig.apply(this, arguments); };
  for (let t = 0; t <= 304.5; t += 0.1) { cur = null; window.seek(t); rec.push([+t.toFixed(2), cur ? Math.floor(cur.H) : null, cur ? cur.a : 0]); }
  TOD.hud = orig; return rec;
});
let last = -1, lastT = 0, bad = [], shownSpans = [], span = null;
for (const [t, h, a] of r) {
  const vis = h != null && a > 0.05;
  if (vis) { if (h < last) bad.push({ t, from: last, to: h }); last = Math.max(last, h); lastT = t; if (!span) span = [t, h]; } else if (span) { shownSpans.push([span[0], lastT, span[1], last]); span = null; }
}
if (span) shownSpans.push([span[0], lastT, span[1], last]);
console.log('visible spans [tStart, tEnd, hourStart, hourEnd]:');
for (const s of shownSpans) console.log('  ', JSON.stringify(s));
console.log(bad.length ? 'REWINDS: ' + JSON.stringify(bad) : 'HUD never decreases while visible: OK');
await browser.close(); process.exit(bad.length ? 1 : 0);
