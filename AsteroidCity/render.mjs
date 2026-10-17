// render.mjs — deterministic frame renderer for the 3D Short (Three.js page in headless Chromium, frames piped into ffmpeg).
// The page is served over a local HTTP server so ES modules load. Every frame is a pure function of time t.
// Usage:
//   node render.mjs [--from 0] [--to <dur>] [--fps 30] [--out out/silent.mp4]
//   node render.mjs --stills "name:t,name:t"      -> shots/<name>.jpg
//   node render.mjs --contact "t0,t1,..." [--contactout name]  -> shots/<name>.jpg (tiled, small)
import { launchRenderBrowser, requireFfmpeg, writeVideoFrame } from '../tools/browser.mjs';
import { spawn, spawnSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

if (!process.env.BROWSER_EXECUTABLE_PATH && fs.existsSync('/opt/pw-browsers/chromium')) process.env.BROWSER_EXECUTABLE_PATH = '/opt/pw-browsers/chromium';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const A = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1'; A[k] = v; }
const fps = +(A.fps ?? 30);
const W = /half/.test(A.query || '') ? 540 : 1080, H = /half/.test(A.query || '') ? 960 : 1920;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await launchRenderBrowser();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => { const tx = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/ReadPixels|status of 404/.test(tx) || /fail|error|INFO/i.test(tx) && !/ReadPixels|status of 404/.test(tx)) console.log('[page]', m.type(), tx); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html${A.query ? '?' + A.query : ''}`);
await page.waitForFunction('window.__ready === true', null, { timeout: 300000 });
const dur = +(A.dur ?? await page.evaluate('window.DURATION'));
const from = +(A.from ?? 0), to = +(A.to ?? dur);

const b64 = (s) => Buffer.from(s.slice(s.indexOf(',') + 1), 'base64');
const frameAt = (t) => page.evaluate((t) => window.renderFrame(t), t);

try {
  if (A.stills || A.contact) fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
  if (A.stills) {
    for (const item of A.stills.split(',')) {
      const [name, ts] = item.split(':');
      const t0 = Date.now();
      fs.writeFileSync(path.join(ROOT, 'shots', name + '.jpg'), b64(await frameAt(+ts)));
      console.log('wrote shots/' + name + '.jpg', 't=' + ts, (Date.now() - t0) + 'ms');
    }
  } else if (A.contact) {
    const ts = A.contact.split(',').map(Number);
    const cname = A.contactout ?? 'contact';
    const tmp = path.join(ROOT, 'shots', '_' + cname);
    fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    for (let i = 0; i < ts.length; i++) fs.writeFileSync(path.join(tmp, `c${String(i).padStart(3, '0')}.jpg`), b64(await frameAt(ts[i])));
    const cols = +(A.cols ?? 6), rows = Math.ceil(ts.length / cols);
    const outp = path.join(ROOT, 'shots', cname + '.jpg');
    const r = spawnSync(requireFfmpeg(), ['-y', '-v', 'error', '-framerate', '1', '-i', path.join(tmp, 'c%03d.jpg'), '-vf', `scale=270:480,tile=${cols}x${rows}`, '-frames:v', '1', outp], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('contact sheet failed: ' + r.stderr);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('wrote', outp);
  } else {
    const outFile = path.resolve(ROOT, A.out ?? 'out/silent.mp4');
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    // integer frame indices so parallel chunks join exactly
    const f0 = Math.round(from * fps), f1 = Math.round(to * fps), N = f1 - f0;
    const ff = spawn(requireFfmpeg(), ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-vf', 'scale=in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-crf', '15', '-preset', 'medium',
      '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(fps), '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ffDone = new Promise((res) => { ff.on('error', (error) => res({ error })); ff.on('close', (code) => res({ code })); });
    ff.stdin.on('error', () => {});
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      await writeVideoFrame(ff, b64(await frameAt((f0 + i) / fps)));
      if ((i + 1) % 30 === 0 || i + 1 === N) { const el = (Date.now() - t0) / 1000; console.log(`frame ${i + 1}/${N}  ${((i + 1) / el).toFixed(2)} fps  elapsed ${el.toFixed(0)}s`); }
    }
    ff.stdin.end();
    const r = await ffDone;
    if (r.error || r.code !== 0) throw new Error('ffmpeg failed ' + (r.error?.message || r.code));
    console.log('wrote', outFile);
  }
} finally {
  await browser.close();
  server.close();
}
