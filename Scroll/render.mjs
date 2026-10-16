// render.mjs (SCROLL) — deterministic frame renderer (Playwright + Chrome GPU) piping JPEG frames into ffmpeg.
// Usage:
//   node render.mjs [--fps 30] [--sub 4] [--dur 10.8] [--from 0] [--to <dur>] [--out out/silent.mp4]
//   node render.mjs --stills "name:t,name:t"     -> shots/<name>.png (full res, sub=1)
//   node render.mjs --contact "t0,t1,..."         -> shots/contact.png (ffmpeg tile)
// Extras: --page index.html   --query "cam=900,700,3"   --cols 4
import { launchRenderBrowser, requireFfmpeg, writeVideoFrame } from '../tools/browser.mjs';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const A = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1'; A[k] = v; }
const fps = +(A.fps ?? 30), sub = +(A.sub ?? 4), dur = +(A.dur ?? 10.8);
const from = +(A.from ?? 0), to = +(A.to ?? dur);
const outFile = path.resolve(ROOT, A.out ?? 'out/silent.mp4');
const pageFile = A.page ?? 'index.html';
const query = A.query ? '?' + A.query : '';

const FFMPEG = !A.stills ? requireFfmpeg() : null;
const browser = await launchRenderBrowser();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', (m) => { const tx = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /fail|error/i.test(tx)) console.log('[page]', m.type(), tx); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(pathToFileURL(path.join(ROOT, pageFile)).href + query);
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });

const b64 = (s) => Buffer.from(s.slice(s.indexOf(',') + 1), 'base64');
const fmt = (t) => String(t);

try {
  if (A.stills || A.contact) {
    fs.mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
  }
  if (A.stills) {
    for (const item of A.stills.split(',')) {
      const [name, ts] = item.split(':');
      const t = +ts;
      const url = await page.evaluate((t) => { window.seek(t); return window.canvasPNG(); }, t);
      const f = path.join(ROOT, 'shots', name + '.png');
      fs.writeFileSync(f, b64(url));
      console.log('wrote', f, 't=' + fmt(t));
    }
  } else if (A.contact) {
    const ts = A.contact.split(',').map(Number);
    const cname = A.contactout ?? 'contact';   // --contactout <name> -> shots/<name>.png (parallel agents: use a unique name)
    const tmp = path.join(ROOT, 'shots', '_' + cname);
    fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    for (let i = 0; i < ts.length; i++) {
      const url = await page.evaluate((t) => { window.seek(t); return window.canvasPNG(); }, ts[i]);
      fs.writeFileSync(path.join(tmp, `c${String(i).padStart(3, '0')}.png`), b64(url));
    }
    const cols = +(A.cols ?? 4), rows = Math.ceil(ts.length / cols);
    const outp = path.join(ROOT, 'shots', cname + '.png');
    const r = spawnSync(FFMPEG, ['-y', '-v', 'error', '-framerate', '1', '-i', path.join(tmp, 'c%03d.png'), '-vf', `scale=480:270,tile=${cols}x${rows}`, '-frames:v', '1', outp], { encoding: 'utf8' });
    if (r.error || r.status !== 0) throw new Error(`FFmpeg contact sheet failed: ${r.error?.message || r.stderr || r.status}`);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('wrote', outp);
  } else {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const N = Math.round((to - from) * fps);
    const ff = spawn(FFMPEG, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-vf', 'scale=in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(fps), '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ffDone = new Promise((res) => { ff.on('error', error => res({ error })); ff.on('close', code => res({ code })); });
    ff.stdin.on('error', () => {});
    const grab = (i) => page.evaluate(([t, fps, sub]) => window.renderFrame(t, fps, sub), [from + i / fps, fps, sub]);
    const t0 = Date.now();
    let pending = grab(0);
    for (let i = 0; i < N; i++) {
      const url = await pending;
      if (i + 1 < N) pending = grab(i + 1); // overlap next frame render with the write
      const buf = b64(url);
      await writeVideoFrame(ff, buf);
      if ((i + 1) % 30 === 0 || i + 1 === N) {
        const el = (Date.now() - t0) / 1000;
        console.log(`frame ${i + 1}/${N}  ${((i + 1) / el).toFixed(2)} fps  elapsed ${el.toFixed(1)}s`);
      }
    }
    ff.stdin.end();
    const ffResult = await ffDone; if (ffResult.error || ffResult.code !== 0) throw new Error(`FFmpeg video encode failed: ${ffResult.error?.message || ffResult.code}`);
    const el = (Date.now() - t0) / 1000;
    console.log(`done ${outFile}  ${N} frames in ${el.toFixed(1)}s = ${(N / el).toFixed(2)} fps (sub=${sub})`);
  }
} finally {
  await browser.close();
}
