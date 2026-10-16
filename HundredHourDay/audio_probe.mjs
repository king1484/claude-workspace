// audio_probe.mjs -- small inspection helper: node audio_probe.mjs <wav> <t0> <t1> [win_ms]
// prints per-window RMS and max |sample step| (click detector) for L channel in [t0,t1] seconds. Numbers only.
import { execFileSync } from 'node:child_process';
const [, , file, a, b, w = '10'] = process.argv;
const t0 = +a, t1 = +b, win = +w / 1000, SR = 48000;
const buf = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t0), '-t', String(t1 - t0), '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
const x = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4), n = Math.round(win * SR);
for (let s = 0; s + n <= x.length; s += n) {
  let e = 0, st = 0; for (let i = s; i < s + n; i++) { e += x[i] * x[i]; if (i > s) st = Math.max(st, Math.abs(x[i] - x[i - 1])); }
  console.log((t0 + s / SR).toFixed(3), 'rms', (10 * Math.log10(e / n + 1e-12)).toFixed(1), 'maxstep', st.toFixed(4));
}
