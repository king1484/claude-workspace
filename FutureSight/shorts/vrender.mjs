// vrender.mjs — renders the vertical Short picture (silent) from the FutureSight engine (read-only use).
//   node shorts/vrender.mjs --stills "t,t,..."       -> shorts/work/v_<t>.png   (1080x1920, short time t)
//   node shorts/vrender.mjs --contact "t,t,..." [--cols 6]  -> shorts/work/vcontact.png
//   node shorts/vrender.mjs --scan "T,T,..."          -> hero hoodie centroid in SOURCE px at global time T
//   node shorts/vrender.mjs --out shorts/work/silent.mp4 [--sub 4] [--from 0] [--to <dur>]
import { launchRenderBrowser, requireFfmpeg, writeVideoFrame } from '../../tools/browser.mjs';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const argv = process.argv.slice(2);
const A = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1'; A[k] = v; }
const plan = JSON.parse(fs.readFileSync(path.join(HERE, 'plan.json'), 'utf8'));
const fps = +(A.fps ?? 30), sub = +(A.sub ?? 4);
const from = +(A.from ?? 0), to = +(A.to ?? plan.dur);
const outFile = path.resolve(ROOT, A.out ?? 'shorts/work/silent.mp4');

const FFMPEG = !A.scan && !A.stills ? requireFfmpeg() : null;
const browser = await launchRenderBrowser();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', (m) => { const tx = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /fail|error/i.test(tx)) console.log('[page]', m.type(), tx); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(pathToFileURL(path.join(ROOT, 'index_full.html')).href);
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
await page.addScriptTag({ path: path.join(HERE, 'vharness.js') });
await page.evaluate((p) => window.setPlan(p), plan);

const b64 = (s) => Buffer.from(s.slice(s.indexOf(',') + 1), 'base64');
try {
  fs.mkdirSync(path.join(HERE, 'work'), { recursive: true });
  if (A.scan) {
    for (const T of A.scan.split(',').map(Number)) console.log(T, JSON.stringify(await page.evaluate((T) => window.heroScan(T), T)));
  } else if (A.stills) {
    for (const t of A.stills.split(',').map(Number)) {
      const url = await page.evaluate(([t, fps]) => window.renderShort(t, fps, 1, 'png'), [t, fps]);
      const f = path.join(HERE, 'work', `v_${t.toFixed(2)}.png`); fs.writeFileSync(f, b64(url)); console.log('wrote', f);
    }
  } else if (A.contact) {
    const ts = A.contact.split(',').map(Number);
    const tmp = path.join(HERE, 'work', '_vc'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    for (let i = 0; i < ts.length; i++) {
      const url = await page.evaluate(([t, fps]) => window.renderShort(t, fps, 1, 'png'), [ts[i], fps]);
      fs.writeFileSync(path.join(tmp, `c${String(i).padStart(3, '0')}.png`), b64(url));
    }
    const cols = +(A.cols ?? 6), rows = Math.ceil(ts.length / cols);
    const outp = path.join(HERE, 'work', A.name ?? 'vcontact.png');
    const r = spawnSync(FFMPEG, ['-y', '-v', 'error', '-framerate', '1', '-i', path.join(tmp, 'c%03d.png'), '-vf', `scale=${A.tw ?? 270}:-1,tile=${cols}x${rows}:padding=4:color=black`, '-frames:v', '1', outp], { encoding: 'utf8' });
    if (r.error || r.status !== 0) throw new Error(`FFmpeg contact sheet failed: ${r.error?.message || r.stderr || r.status}`);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('wrote', outp);
  } else {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const N = Math.round((to - from) * fps);
    const ff = spawn(FFMPEG, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-vf', 'scale=in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(fps), '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ffDone = new Promise((res) => { ff.on('error', error => res({ error })); ff.on('close', code => res({ code })); });
    ff.stdin.on('error', () => {});
    const grab = (i) => page.evaluate(([t, fps, sub]) => window.renderShort(t, fps, sub), [from + i / fps, fps, sub]);
    const t0 = Date.now();
    let pending = grab(0);
    for (let i = 0; i < N; i++) {
      const url = await pending;
      if (i + 1 < N) pending = grab(i + 1);
      const buf = b64(url);
      await writeVideoFrame(ff, buf);
      if ((i + 1) % 30 === 0 || i + 1 === N) { const el = (Date.now() - t0) / 1000; console.log(`frame ${i + 1}/${N}  ${((i + 1) / el).toFixed(2)} fps  elapsed ${el.toFixed(1)}s`); }
    }
    ff.stdin.end(); const ffResult = await ffDone; if (ffResult.error || ffResult.code !== 0) throw new Error(`FFmpeg video encode failed: ${ffResult.error?.message || ffResult.code}`);
    console.log(`done ${outFile} ${N} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
} finally { await browser.close(); }
