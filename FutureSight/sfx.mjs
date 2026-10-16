// sfx.mjs — FutureSight hook audio: everything synthesized in code, deterministic, no deps.
//   node sfx.mjs          -> out/mix.wav (+ out/audio_report.json)
//   node sfx.mjs --mux    -> additionally out/silent.mp4 + out/mix.wav -> out/final.mp4
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const TL = require('./timeline.js');

const SR = 48000;
const N = Math.round(TL.DUR * SR);
const TAU = Math.PI * 2;
const LUFS_TARGET = -14;
const TP_LIMIT = -1.5;
const db2g = (d) => Math.pow(10, d / 20);
const g2db = (g) => 20 * Math.log10(Math.max(g, 1e-9));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ------------------------------------------------------------------ rng
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const white = (rnd, n) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = rnd() * 2 - 1; return o; };
function pink(rnd, n) { // Paul Kellet
  const o = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    o[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return o;
}

// ------------------------------------------------------------------ filters
class SVF { // TPT state-variable filter
  constructor() { this.s1 = 0; this.s2 = 0; this.lp = 0; this.bp = 0; this.hp = 0; }
  process(x, fc, Q) {
    const g = Math.tan(Math.PI * Math.min(fc, SR * 0.45) / SR), k = 1 / Q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - this.s2, v1 = a1 * this.s1 + a2 * v3, v2 = this.s2 + a2 * this.s1 + a3 * v3;
    this.s1 = 2 * v1 - this.s1; this.s2 = 2 * v2 - this.s2;
    this.lp = v2; this.bp = v1 * k; this.hp = x - k * v1 - v2;
  }
}
/** fc: number or fn(tSeconds). mode: lp|bp|hp */
function filt(sig, mode, fc, Q = 0.707) {
  const f = new SVF(), o = new Float32Array(sig.length), isF = typeof fc === 'function';
  for (let i = 0; i < sig.length; i++) { f.process(sig[i], isF ? fc(i / SR) : fc, Q); o[i] = f[mode]; }
  return o;
}
function onepole(sig, tcA, tcR) { // asymmetric smoothing (seconds)
  const o = new Float32Array(sig.length), a = 1 - Math.exp(-1 / (tcA * SR)), r = 1 - Math.exp(-1 / (tcR * SR));
  let y = 0;
  for (let i = 0; i < sig.length; i++) { const x = sig[i]; y += (x > y ? a : r) * (x - y); o[i] = y; }
  return o;
}

// ------------------------------------------------------------------ FFT convolution reverb
function fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inv ? -TAU : TAU) / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < h; j++) {
        const a = i + j, b = a + h;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
function makeIR(seed, len = 2.4) {
  const rnd = mulberry32(seed), n = Math.round(len * SR), pre = Math.round(0.014 * SR);
  const out = [];
  for (let ch = 0; ch < 2; ch++) {
    const ir = new Float32Array(n);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / SR, w = rnd() * 2 - 1;
      lp += 0.16 * (w - lp);
      const hf = w - lp;
      ir[i] = (lp * Math.exp(-t / 0.36) + hf * 0.45 * Math.exp(-t / 0.15)) * smooth(t / 0.006);
    }
    // sparse early reflections
    for (let k = 0; k < 7; k++) ir[pre + Math.round((0.011 + k * 0.0093 + rnd() * 0.006) * SR)] += (rnd() < 0.5 ? -1 : 1) * 0.5 * Math.exp(-k * 0.35);
    let e = 0; for (let i = 0; i < n; i++) e += ir[i] * ir[i];
    const s = 1 / Math.sqrt(e); for (let i = 0; i < n; i++) ir[i] *= s;
    out.push(ir);
  }
  return out;
}
const IR = makeIR(777);
function convStereo(x) { // mono in -> stereo wet (same length as x)
  let size = 1; while (size < x.length + IR[0].length) size <<= 1;
  const xr = new Float64Array(size), xi = new Float64Array(size);
  xr.set(x); fft(xr, xi, false);
  return IR.map((ir) => {
    const hr = new Float64Array(size), hi = new Float64Array(size);
    hr.set(ir); fft(hr, hi, false);
    for (let i = 0; i < size; i++) { const a = xr[i] * hr[i] - xi[i] * hi[i], b = xr[i] * hi[i] + xi[i] * hr[i]; hr[i] = a; hi[i] = b; }
    fft(hr, hi, true);
    const o = new Float32Array(x.length); for (let i = 0; i < x.length; i++) o[i] = hr[i]; return o;
  });
}

// ------------------------------------------------------------------ buses
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const panG = (p) => { const a = (clamp(p, -1, 1) + 1) * Math.PI / 4; return [Math.cos(a), Math.sin(a)]; };
function addTo(b, l, r, t0, gain = 1) {
  const s = Math.round(t0 * SR);
  for (let i = 0; i < l.length; i++) { const k = s + i; if (k >= N) break; if (k < 0) continue; b.L[k] += l[i] * gain; b.R[k] += r[i] * gain; }
}
function peakOf(...arrs) { let p = 0; for (const a of arrs) for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > p) p = v; } return p; }
function rmsOf(a, from = 0, to = a.length) { let s = 0; for (let i = from; i < to; i++) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, to - from)); }
function normPeak(l, r, target) { const p = peakOf(l, r) || 1, s = target / p; for (let i = 0; i < l.length; i++) { l[i] *= s; r[i] *= s; } }
/** mono -> stereo with pan (scalar or fn(tau)) */
function pan2(sig, pan) {
  const l = new Float32Array(sig.length), r = new Float32Array(sig.length);
  for (let i = 0; i < sig.length; i++) { const [a, b] = panG(typeof pan === 'function' ? pan(i / SR) : pan); l[i] = sig[i] * a; r[i] = sig[i] * b; }
  return [l, r];
}
const fadeEnds = (l, r, inS, outS) => {
  const n = l.length, a = Math.round(inS * SR), b = Math.round(outS * SR);
  for (let i = 0; i < n; i++) { let g = 1; if (i < a) g *= i / a; if (i > n - b) g *= Math.max(0, (n - i) / b); l[i] *= g; r[i] *= g; }
};

const stems = { amb: bus(), music: bus(), riser: bus(), sfx: bus(), hit: bus(), low: bus(), vo: bus() };
let curCue = -1; const cueSolo = {};
const sfxSend = new Float32Array(N);
function put(l, r, t0, gain = 1, send = 0, which = 'sfx') {
  { const p = peakOf(l, r) * gain; if (!(cueSolo[curCue] >= p)) cueSolo[curCue] = p; }
  addTo(stems[which], l, r, t0, gain);
  if (send > 0) { const s = Math.round(t0 * SR); for (let i = 0; i < l.length; i++) { const k = s + i; if (k >= N) break; sfxSend[k] += 0.5 * (l[i] + r[i]) * gain * send; } }
}
/** split at fc: lows -> unducked 'low' bus, highs -> ducked 'sfx' bus; reverb send fed by highs only */
function splitPut(l, r, t0, gain, send, fc = 190, hiBus = 'hit') {
  const ll = filt(l, 'lp', fc, 0.707), lr = filt(r, 'lp', fc, 0.707);
  const hl = new Float32Array(l.length), hr = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) { hl[i] = l[i] - ll[i]; hr[i] = r[i] - lr[i]; }
  put(ll, lr, t0, gain, 0, 'low'); put(hl, hr, t0, gain, send, hiBus);
}

// ------------------------------------------------------------------ WAV io
function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not RIFF');
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4); let sz = b.readUInt32LE(p + 4);
    if (id === 'fmt ') {
      fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
      if (fmt.tag === 0xfffe) fmt.tag = b.readUInt16LE(p + 32);
    } else if (id === 'data') { if (p + 8 + sz > b.length) sz = b.length - p - 8; data = b.subarray(p + 8, p + 8 + sz); break; }
    p += 8 + sz + (sz & 1);
  }
  if (!fmt || !data) throw new Error('bad wav');
  const bps = fmt.bits / 8, frames = Math.floor(data.length / (bps * fmt.ch)), mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < fmt.ch; c++) {
      const o = (i * fmt.ch + c) * bps; let v;
      if (fmt.tag === 3) v = fmt.bits === 64 ? data.readDoubleLE(o) : data.readFloatLE(o);
      else if (fmt.bits === 16) v = data.readInt16LE(o) / 32768;
      else if (fmt.bits === 24) v = data.readIntLE(o, 3) / 8388608;
      else if (fmt.bits === 32) v = data.readInt32LE(o) / 2147483648;
      else v = (data[o] - 128) / 128;
      acc += v;
    }
    mono[i] = acc / fmt.ch;
  }
  if (fmt.sr === SR) return mono;
  const n2 = Math.round(frames * SR / fmt.sr), o2 = new Float32Array(n2), k = fmt.sr / SR;
  for (let i = 0; i < n2; i++) { const x = i * k, i0 = Math.floor(x), f = x - i0; o2[i] = mono[i0] * (1 - f) + (mono[Math.min(i0 + 1, frames - 1)] * f); }
  return o2;
}
function writeWav(file, L, R, bits) { // 'f32' | 24
  const n = L.length, bps = bits === 'f32' ? 4 : 3, data = n * 2 * bps, b = Buffer.alloc(44 + data);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(bits === 'f32' ? 3 : 1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2 * bps, 28); b.writeUInt16LE(2 * bps, 32); b.writeUInt16LE(bps * 8, 34); b.write('data', 36); b.writeUInt32LE(data, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (const ch of [L, R]) {
    if (bits === 'f32') { b.writeFloatLE(ch[i], o); o += 4; }
    else { const v = Math.round(clamp(ch[i], -1, 1) * 8388607); b.writeIntLE(v, o, 3); o += 3; }
  }
  fs.writeFileSync(file, b);
}
function ff(args) { return spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }); }
function measure(L, R) {
  const f = path.join(os.tmpdir(), `fs_meas_${process.pid}.wav`);
  writeWav(f, L, R, 'f32');
  const r = ff(['-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  try { fs.unlinkSync(f); } catch { }
  const txt = r.stderr || '';
  const last = (re) => { let m, v = null; const g = new RegExp(re.source, 'g'); while ((m = g.exec(txt))) v = parseFloat(m[1]); return v; };
  return { I: last(/\bI:\s+(-?[\d.]+) LUFS/), LRA: last(/LRA:\s+(-?[\d.]+) LU/), TP: last(/Peak:\s+(-?[\d.]+) dBFS/) };
}

// ------------------------------------------------------------------ timeline helpers
const arc = TL.music.arc;
const rawI = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const t = i / SR; let v = arc[arc.length - 1][2];
  for (const [a, b, x] of arc) if (t >= a && t < b) { v = x; break; }
  rawI[i] = v;
}
const intensity = onepole(rawI, 0.12, 0.12); // smooth arc
const Iat = (t) => intensity[clamp(Math.round(t * SR), 0, N - 1)];
const BEAT = 60 / TL.music.bpm, E8 = BEAT / 2, BO = 0.45; // beat grid origin: a beat lands on 9.2 (title)
const CHORDS = [
  [-1, 2.95, 'Am'], [2.95, 5.45, 'F'], [5.45, 7.95, 'Am'], [7.95, 9.2, 'F'], [9.2, 99, 'Am'],
];
const VOICING = { Am: [45, 52, 57, 60, 64], F: [41, 48, 53, 57, 60] };
const ARP = { Am: [57, 60, 64, 69], F: [53, 57, 60, 65] };
const ROOT = { Am: 55.0, F: 43.654 };
// music/ambience impact dips (sudden hush before the boom)
const dipEnv = new Float32Array(N).fill(1);
for (const c of TL.cues) if (c.type === 'titleImpact') {
  for (let i = 0; i < N; i++) {
    const t = i / SR, d = t - c.t;
    if (d > -0.09 && d < 0) dipEnv[i] = Math.min(dipEnv[i], mix(1, 0.12, smooth((d + 0.09) / 0.03)));
    else if (d >= 0 && d < 0.5) dipEnv[i] = Math.min(dipEnv[i], mix(0.12, 1, smooth(d / 0.5)));
  }
}

// ------------------------------------------------------------------ VO + duck envelope
let vo = new Float32Array(N), voOK = false;
const voPath = path.join(OUT, 'vo.wav');
if (fs.existsSync(voPath)) {
  try {
    const raw = readWav(voPath); vo.set(raw.subarray(0, Math.min(raw.length, N)));
    const p = peakOf(vo) || 1; for (let i = 0; i < N; i++) vo[i] *= 0.7 / p;
    vo = filt(vo, 'hp', 75, 0.707); voOK = true;
    { // gentle feed-forward compressor (broadcast-style VO glue): thr -24 dB, 3:1, 6 ms / 140 ms
      const a = 1 - Math.exp(-1 / (0.006 * SR)), r = 1 - Math.exp(-1 / (0.14 * SR)), thr = -27, ratio = 4; let e = 0;
      const gr = new Float32Array(N);
      for (let i = 0; i < N; i++) { const x = Math.abs(vo[i]); e += (x > e ? a : r) * (x - e); const d = g2db(e); gr[i] = d > thr ? -(d - thr) * (1 - 1 / ratio) : 0; }
      for (let i = 0; i < N; i++) vo[i] *= db2g(gr[i] + 4.5);
      const p2 = peakOf(vo) || 1; for (let i = 0; i < N; i++) vo[i] *= 0.7 / p2;
      const lm = limiter(vo, vo, 0.42, 96, 0.06); vo = lm.L; // tame TTS plosive/peaks before the master
      const p3 = peakOf(vo) || 1; for (let i = 0; i < N; i++) vo[i] *= 0.7 / p3;
    }
    console.log(`vo.wav: ${(raw.length / SR).toFixed(2)} s loaded`);
  } catch (e) { console.log('vo.wav unreadable -> treated as silence:', e.message); }
} else console.log('vo.wav missing -> treated as silence');
stems.vo.L.set(vo); stems.vo.R.set(vo);

const HOP = 48, NH = Math.ceil(N / HOP);
const voAct = new Float32Array(NH);
for (let h = 0; h < NH; h++) {
  const r = rmsOf(vo, h * HOP, Math.min(N, (h + 1) * HOP));
  voAct[h] = clamp((g2db(r) + 52) / 12, 0, 1);
}
const HOLD = 120, held = new Float32Array(NH), LOOK = 25;
for (let h = 0; h < NH; h++) { let m = 0; for (let j = Math.max(0, h - HOLD); j <= h; j++) if (voAct[j] > m) m = voAct[j]; held[h] = m; }
const lookH = new Float32Array(NH); for (let h = 0; h < NH; h++) lookH[h] = held[Math.min(NH - 1, h + LOOK)] ;
const dsm = new Float32Array(NH); { let y = 0; const a = 1 - Math.exp(-1 / (0.03 * 1000)), r = 1 - Math.exp(-1 / (0.32 * 1000)); for (let h = 0; h < NH; h++) { y += (lookH[h] > y ? a : r) * (lookH[h] - y); dsm[h] = y; } }
function duckCurve(depthDb) {
  const k = 1 - db2g(depthDb), o = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = i / HOP, h = Math.floor(x), f = x - h; const e = dsm[Math.min(h, NH - 1)] * (1 - f) + dsm[Math.min(h + 1, NH - 1)] * f; o[i] = 1 - e * k; }
  return o;
}
const DUCK = { amb: -9, music: -9, riser: -5.5, sfx: -6, hit: -7 };
const duck = {}; for (const k in DUCK) duck[k] = duckCurve(DUCK[k]);

// ------------------------------------------------------------------ AMBIENCE
{
  const rnd = mulberry32(11), L = new Float32Array(N), R = new Float32Array(N);
  const cutoff = (t) => 1100 - 650 * smooth((t - 3.5) / 0.4) + 650 * smooth((t - 7.1) / 0.5) - 120 * smooth((t - 9.2) / 0.5);
  const airL = filt(pink(rnd, N), 'lp', cutoff, 0.7), airR = filt(pink(rnd, N), 'lp', cutoff, 0.7);
  const wL = filt(white(rnd, N), 'bp', (t) => 330 + 140 * Math.sin(t * 0.9) + 90 * Math.sin(t * 2.3 + 1), 0.9);
  const wR = filt(white(rnd, N), 'bp', (t) => 360 + 130 * Math.sin(t * 1.1 + 2) + 80 * Math.sin(t * 1.9), 0.9);
  const hum = filt(pink(rnd, N), 'lp', 170, 0.8);
  const sA = -34 - 3, sW = -45, sH = -42;
  const nA = db2g(sA) / (rmsOf(airL) || 1), nW = db2g(sW) / (rmsOf(wL) || 1), nH = db2g(sH) / (rmsOf(hum) || 1);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const swell = 1 + 0.18 * Math.sin(t * 0.8) + 0.1 * Math.sin(t * 2.1 + 0.7);
    const gust = 0.55 + 0.45 * Math.sin(t * 1.3) * Math.sin(t * 0.47 + 1);
    const vis = 1 - 0.35 * smooth((t - 3.5) / 0.3) * (1 - smooth((t - 7.1) / 0.5)); // hushed in vision
    L[i] = (airL[i] * nA * swell + wL[i] * nW * gust + hum[i] * nH) * vis;
    R[i] = (airR[i] * nA * swell + wR[i] * nW * gust + hum[i] * nH) * vis;
  }
  stems.amb.L.set(L); stems.amb.R.set(R);
}

// ------------------------------------------------------------------ MUSIC
const musicDry = bus(); // pad + plucks (get reverb); sub kept dry
const subBus = bus();
{
  // ---- pad: detuned polyBLEP saws per chord note, crossfaded chords, cutoff follows intensity
  const padL = new Float32Array(N), padR = new Float32Array(N);
  const blepSaw = (ph, dt) => {
    let v = 2 * ph - 1;
    if (ph < dt) { const t = ph / dt; v -= t + t - t * t - 1; }
    else if (ph > 1 - dt) { const t = (ph - 1) / dt; v -= t * t + t + t + 1; }
    return v;
  };
  const detL = [-8, 0, 5], detR = [-5, 0, 8];
  CHORDS.forEach(([a, b, name], ci) => {
    const s0 = Math.max(0, Math.round((a - 0.7) * SR)), s1 = Math.min(N, Math.round((b + 0.9) * SR));
    if (s1 <= s0) return;
    for (const m of VOICING[name]) {
      const f0 = mtof(m);
      for (let v = 0; v < 3; v++) for (let side = 0; side < 2; side++) {
        const f = f0 * Math.pow(2, (side ? detR[v] : detL[v]) / 1200), dt = f / SR;
        let ph = (m * 0.137 + v * 0.31 + side * 0.17) % 1;
        const tgt = side ? padR : padL;
        for (let i = s0; i < s1; i++) {
          const t = i / SR;
          const env = smooth((t - (a - 0.6)) / (ci === 0 ? 1.2 : 0.7)) * (1 - smooth((t - b) / 0.8));
          if (env > 0) tgt[i] += blepSaw(ph, dt) * env * (m < 50 ? 0.9 : 0.55);
          ph += dt; if (ph >= 1) ph -= 1;
        }
      }
    }
  });
  const fcPad = (t) => 260 + 3100 * Math.pow(Iat(t), 1.25);
  const fL = filt(padL, 'lp', fcPad, 0.8), fR = filt(padR, 'lp', fcPad, 0.8);
  const nP = db2g(-27.5) / (rmsOf(fL) || 1);
  for (let i = 0; i < N; i++) { const I = intensity[i], g = (0.35 + 0.65 * I) * nP; musicDry.L[i] += fL[i] * g; musicDry.R[i] += fR[i] * g; }

  // ---- sub pulse on beats (pitch-dropping sine, quarter notes)
  const subL = new Float32Array(N);
  for (let k = -1; BO + k * BEAT < TL.DUR; k++) {
    const tb = BO + k * BEAT; if (tb < -0.2) continue;
    const chord = CHORDS.find(([a, b]) => tb >= a && tb < b)?.[2] || 'Am', f0 = ROOT[chord];
    const accent = (((k % 4) + 4) % 4 === 0) ? 1 : ((((k % 4) + 4) % 4 === 2) ? 0.7 : 0.45);
    const g = (0.2 + 0.8 * Iat(tb + 0.05)) * accent;
    const s0 = Math.max(0, Math.round(tb * SR));
    let ph = 0;
    for (let i = s0; i < Math.min(N, s0 + Math.round(0.6 * SR)); i++) {
      const tau = (i - s0) / SR, f = f0 * (1 + 1.3 * Math.exp(-tau / 0.025));
      ph += TAU * f / SR;
      const e = smooth(tau / 0.006) * Math.exp(-tau / 0.17);
      subL[i] += (Math.sin(ph) + 0.32 * Math.sin(2 * ph)) * e * g;
    }
  }
  const nS = db2g(-30) / (rmsOf(subL) || 1);
  for (let i = 0; i < N; i++) { subBus.L[i] = subL[i] * nS; subBus.R[i] = subL[i] * nS; }

  // ---- pluck arpeggio (8ths) with ping-pong delay
  const rnd = mulberry32(31), pL = new Float32Array(N), pR = new Float32Array(N), pat = [0, 1, 2, 3, 2, 1, 2, 1];
  let stepIdx = 0;
  for (let k = 0; BO + k * E8 < TL.DUR; k++) {
    const ts = BO + k * E8, chord = CHORDS.find(([a, b]) => ts >= a && ts < b)?.[2] || 'Am';
    const I = Iat(ts), play = rnd() < 0.55 + I * 0.5; const step = ((k % 8) + 8) % 8;
    if (!play && step % 4 !== 0) { stepIdx++; continue; }
    const m = ARP[chord][pat[step]] + ((I > 0.7 && step === 4) ? 12 : 0), f = mtof(m);
    const vel = (step % 4 === 0 ? 1 : 0.62) * (0.35 + 0.65 * I);
    const p = Math.sin(k * 1.3) * 0.45, [gl, gr] = panG(p);
    const s0 = Math.max(0, Math.round(ts * SR)), len = Math.round(0.9 * SR);
    for (let i = s0; i < Math.min(N, s0 + len); i++) {
      const tau = (i - s0) / SR; let v = 0;
      for (let h = 1; h <= 7; h++) v += Math.sin(TAU * f * h * tau + h * 0.4) / Math.pow(h, 1.1) * Math.exp(-tau * (4.2 + 5.5 * (h - 1)));
      v *= smooth(tau / 0.003) * vel;
      pL[i] += v * gl; pR[i] += v * gr;
    }
    stepIdx++;
  }
  // ping-pong delay (dotted 8th), darkened feedback
  const dly = Math.round(E8 * 1.5 * SR), dL = new Float32Array(N), dR = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const inL = pL[i] + (i >= dly ? dR[i - dly] * 0.42 : 0), inR = pR[i] + (i >= dly ? dL[i - dly] * 0.42 : 0);
    dL[i] = inL; dR[i] = inR;
  }
  const dlL = filt(dL, 'lp', 3800, 0.7), dlR = filt(dR, 'lp', 3800, 0.7);
  const nK = db2g(-31) / (rmsOf(dlL) || 1);
  for (let i = 0; i < N; i++) { musicDry.L[i] += dlL[i] * nK; musicDry.R[i] += dlR[i] * nK; }
}
// music reverb + sum
{
  const send = new Float32Array(N); for (let i = 0; i < N; i++) send[i] = 0.5 * (musicDry.L[i] + musicDry.R[i]);
  const [wl, wr] = convStereo(send);
  for (let i = 0; i < N; i++) {
    const d = dipEnv[i];
    stems.music.L[i] = (musicDry.L[i] + wl[i] * 0.42 + subBus.L[i]) * d;
    stems.music.R[i] = (musicDry.R[i] + wr[i] * 0.42 + subBus.R[i]) * d;
  }
}

// ------------------------------------------------------------------ RISERS
TL.music.risers.forEach(([a, b], ri) => {
  const len = b - a, n = Math.round(len * SR), rnd = mulberry32(500 + ri), scale = [0.8, 0.9, 1.0][ri] ?? 1;
  const nL = white(rnd, n), nR = white(rnd, n);
  const fc = (t) => 450 * Math.pow(9500 / 450, Math.pow(clamp(t / len, 0, 1), 1.4));
  const bL = filt(nL, 'bp', fc, 1.3), bR = filt(nR, 'bp', fc, 1.3);
  const tl = new Float32Array(n), tr = new Float32Array(n);
  const f0 = 220, f1 = 880; let pa = 0, pb = 0, pc = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n, f = f0 * Math.pow(f1 / f0, u * u * 0.4 + u * 0.6);
    pa += f / SR; pb += f * 1.006 / SR; pc += f * 0.994 / SR; pa %= 1; pb %= 1; pc %= 1;
    const dt = f / SR;
    const sw = (ph, d) => { let v = 2 * ph - 1; if (ph < d) { const t = ph / d; v -= t + t - t * t - 1; } else if (ph > 1 - d) { const t = (ph - 1) / d; v -= t * t + t + t + 1; } return v; };
    tl[i] = sw(pa, dt) * 0.6 + sw(pb, dt) * 0.4; tr[i] = sw(pa, dt) * 0.6 + sw(pc, dt) * 0.4;
  }
  const tfL = filt(tl, 'lp', (t) => 700 + 3600 * Math.pow(clamp(t / len, 0, 1), 1.5), 1.0), tfR = filt(tr, 'lp', (t) => 700 + 3600 * Math.pow(clamp(t / len, 0, 1), 1.5), 1.0);
  const l = new Float32Array(n), r = new Float32Array(n), nn = db2g(-1) / (peakOf(bL, bR) || 1), nt = 0.45 / (peakOf(tfL, tfR) || 1);
  for (let i = 0; i < n; i++) {
    const u = i / n, tail = Math.min(1, (n - i) / (0.03 * SR)), amp = Math.pow(u, 2.3) * tail * smooth(i / (0.02 * SR));
    l[i] = (bL[i] * nn + tfL[i] * nt * 0.55) * amp; r[i] = (bR[i] * nn + tfR[i] * nt * 0.55) * amp;
  }
  normPeak(l, r, 0.34 * scale);
  addTo(stems.riser, l, r, a, 1);
});

// ------------------------------------------------------------------ CUE SYNTHS
const cueRnd = (idx) => mulberry32(1000 + idx * 17);
const S = {};

S.phoneTap = (c, rnd) => {
  const n = Math.round(0.14 * SR), s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    s[i] = Math.sin(TAU * 430 * t) * Math.exp(-t / 0.011) * 0.55 + Math.sin(TAU * 2350 * t) * Math.exp(-t / 0.0028) * 0.75 + (rnd() * 2 - 1) * Math.exp(-t / 0.0012) * 0.45;
  }
  const f = filt(s, 'hp', 220, 0.7), [l, r] = pan2(f, c.t < 0.5 ? 0.12 : -0.12);
  normPeak(l, r, 0.16); put(l, r, c.t, 1, 0.06);
};
S.step = (c, rnd) => {
  const n = Math.round(0.22 * SR), nz = white(rnd, n), v = 0.9 + rnd() * 0.25;
  const b = filt(nz, 'bp', 650 * v, 0.9), s = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * (90 * v + 45 * Math.exp(-t / 0.02)) / SR;
    s[i] = b[i] * smooth(t / 0.003) * Math.exp(-t / 0.04) * 1.3 + Math.sin(ph) * Math.exp(-t / 0.045) * 0.8;
  }
  const side = (Math.round(c.t * 100) % 24 < 12) ? -0.22 : 0.22, [l, r] = pan2(s, side);
  normPeak(l, r, 0.2); put(l, r, c.t, 1, 0.08);
};
S.bikePass = (c, rnd) => {
  const len = c.len || 0.9, n = Math.round(len * SR), pk = c.peak - c.t, nz = white(rnd, n);
  const ratio = (tau) => 1 - 0.19 * Math.tanh((tau - pk) / 0.075);
  const hi = filt(nz, 'bp', (t) => 1500 * ratio(t), 1.1), lo = filt(white(rnd, n), 'bp', (t) => 520 * ratio(t), 0.8);
  const s = new Float32Array(n); let ph = 0, cp = 0, ce = 0;
  for (let i = 0; i < n; i++) {
    const tau = i / SR, d = tau - pk, rt = ratio(tau);
    const A = 1 / Math.pow(1 + (d / 0.095) * (d / 0.095), 0.8);
    ph += TAU * 250 * rt / SR; cp += 30 * rt / SR; if (cp >= 1) { cp -= 1; ce = 1; }
    const click = (rnd() * 2 - 1) * ce * 0.5; ce *= Math.exp(-1 / (0.0016 * SR));
    const tone = (Math.sin(ph) + 0.35 * Math.sin(2 * ph)) * 0.16;
    s[i] = (hi[i] * 0.9 + lo[i] * 0.7 + tone + click) * A * smooth(tau / 0.05) * Math.min(1, (len - tau) / 0.22);
  }
  const [l, r] = pan2(s, (tau) => Math.tanh((tau - pk) / 0.13) * 0.85);
  normPeak(l, r, 0.22); put(l, r, c.t, 1, 0.1);
};
S.thump = (c, rnd) => {
  const n = Math.round(0.4 * SR), s = new Float32Array(n), nz = filt(white(rnd, n), 'lp', 350, 0.8); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (46 + 36 * Math.exp(-t / 0.05)) / SR; s[i] = Math.sin(ph) * Math.exp(-t / 0.09) * smooth(t / 0.004) + nz[i] * Math.exp(-t / 0.06) * 0.9; }
  const [l, r] = pan2(s, 0.2); normPeak(l, r, 0.5); put(l, r, c.t, c.gain ?? 1, 0, 'low');
};
S.cutHit = (c, rnd) => {
  const n = Math.round(1.0 * SR), s = new Float32Array(n), nz = white(rnd, n), pr = filt(white(rnd, n), 'lp', 800, 0.8), sn = filt(nz, 'bp', 2100, 0.8); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * (52 + 75 * Math.exp(-t / 0.035)) / SR;
    s[i] = Math.sin(ph) * Math.exp(-t / 0.28) * smooth(t / 0.003) + sn[i] * Math.exp(-t / 0.012) * 1.1 + pr[i] * Math.exp(-t / 0.12) * 0.7;
  }
  const [l, r] = pan2(s, 0); normPeak(l, r, 0.34); splitPut(l, r, c.t, 1, 0.3);
};
S.eyeOpen = (c, rnd) => {
  const n = Math.round(0.55 * SR), s = new Float32Array(n), air = filt(white(rnd, n), 'bp', 4200, 1.0); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = t / 0.32, env = u < 1 ? Math.sin(Math.PI * u * 0.5) ** 2 : Math.exp(-(t - 0.32) / 0.09);
    ph += TAU * (480 * Math.pow(3.1, clamp(u, 0, 1))) / SR;
    s[i] = (Math.sin(ph) + 0.3 * Math.sin(2.003 * ph)) * env * 0.7 + air[i] * Math.pow(clamp(u, 0, 1), 2) * Math.exp(-Math.max(0, t - 0.32) / 0.08) * 0.5 + Math.sin(TAU * 88 * t) * Math.exp(-t / 0.09) * 0.5 * smooth(t / 0.01);
  }
  const [l, r] = pan2(s, 0); normPeak(l, r, 0.12); put(l, r, c.t, 1, 0.3);
};
S.eyeFlash = (c, rnd) => {
  const n = Math.round(2.0 * SR), L = new Float32Array(n), R = new Float32Array(n);
  const freqs = [880, 1318.5, 1568, 1760, 2093, 2637, 3136, 3520, 4186, 5274];
  for (let k = 0; k < 14; k++) {
    const f = freqs[Math.floor(rnd() * freqs.length)] * (1 + (rnd() - 0.5) * 0.012), dec = 0.45 + rnd() * 0.7, off = rnd() * 0.06, trem = 4 + rnd() * 5, ph0 = rnd() * TAU, amp = 0.5 / Math.sqrt(14) * (1 + rnd());
    const [gl, gr] = panG(rnd() * 1.6 - 0.8);
    for (let i = Math.round(off * SR); i < n; i++) {
      const t = i / SR - off, v = Math.sin(TAU * f * t + ph0) * Math.exp(-t / dec) * (0.75 + 0.25 * Math.sin(TAU * trem * t)) * smooth(t / 0.004) * amp;
      L[i] += v * gl; R[i] += v * gr;
    }
  }
  const nz = filt(white(rnd, n), 'lp', 3200, 0.7); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * (44 + 95 * Math.exp(-t / 0.07)) / SR;
    const boom = Math.tanh(1.6 * Math.sin(ph)) * Math.exp(-t / 0.55) * smooth(t / 0.004) * 1.2 + nz[i] * Math.exp(-t / 0.09) * 0.5;
    L[i] += boom * 0.9; R[i] += boom * 0.9;
  }
  normPeak(L, R, 0.34); splitPut(L, R, c.t, 1, 0.45);
};
S.pullOut = (c, rnd) => {
  const len = c.len || 0.8, n = Math.round(len * SR), g = c.gain ?? 0.7;
  const fc = (t) => 280 * Math.pow(10, 1.05 * Math.sin(Math.PI * clamp(t / len, 0, 1) ** 0.85));
  const a = filt(pink(rnd, n), 'bp', fc, 1.0), b = filt(pink(rnd, n), 'bp', fc, 1.0), lo = filt(pink(rnd, n), 'lp', 140, 0.8);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = i / n, e = Math.pow(Math.sin(Math.PI * u ** 0.9), 1.6);
    L[i] = (a[i] + lo[i] * 0.9) * e; R[i] = (b[i] + lo[i] * 0.9) * e;
  }
  normPeak(L, R, 0.2 * g); put(L, R, c.t, 1, 0.25);
};
S.tick = (c, rnd) => {
  const n = Math.round(0.2 * SR), s = new Float32Array(n), f = 1100 * Math.pow(2, c.n / 12);
  const click = (t0, a) => {
    for (let i = Math.round(t0 * SR); i < n; i++) {
      const t = i / SR - t0;
      s[i] += (Math.sin(TAU * f * t) * Math.exp(-t / 0.012) + 0.5 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t / 0.0055) + 0.6 * Math.sin(TAU * f * 0.42 * t) * Math.exp(-t / 0.02) + (rnd() * 2 - 1) * Math.exp(-t / 0.0015) * 0.8) * a * smooth(t / 0.0008);
    }
  };
  click(0, 1); click(0.016, 0.33); // escapement double-click
  const hp = filt(s, 'hp', 280, 0.7), [l, r] = pan2(hp, (c.n % 2 ? 0.14 : -0.14));
  normPeak(l, r, 0.3 * (0.72 + 0.28 * c.n / 9)); put(l, r, c.t, 1, 0.13);
};
S.ghostWhoosh = (c, rnd) => {
  const len = c.len || 0.7, n = Math.round(len * SR), g = c.gain ?? 0.6;
  const a = filt(white(rnd, n), 'bp', (t) => 1800 * Math.pow(5, t / len), 1.8), b = filt(white(rnd, n), 'bp', (t) => 900 * Math.pow(3, t / len), 2.0);
  const s = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = t / len; ph += TAU * (500 * Math.pow(4, u) * (1 + 0.012 * Math.sin(TAU * 6 * t))) / SR;
    const env = Math.pow(u, 2.1) * smooth(t / 0.03) * Math.min(1, (len - t) / 0.03);
    s[i] = (a[i] * 0.9 + b[i] * 0.5 + (Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.18 * Math.sin(3 * ph)) * 0.22) * env;
  }
  const [l, r] = pan2(s, (t) => -0.75 + 1.1 * (t / len));
  normPeak(l, r, 0.4 * g); put(l, r, c.t, 1, 0.35);
};
S.flashHit = (c, rnd) => {
  const n = Math.round(1.3 * SR), s = new Float32Array(n), nz = filt(white(rnd, n), 'hp', 150, 0.7); let ph = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * (58 + 80 * Math.exp(-t / 0.05)) / SR;
    ph2 += TAU * (90 + 1700 * Math.exp(-t / 0.055)) / SR;
    s[i] = nz[i] * Math.exp(-t / 0.07) * 0.9 + Math.sin(ph) * Math.exp(-t / 0.33) * 1.1 * smooth(t / 0.003) + Math.sin(ph2) * Math.exp(-t / 0.12) * 0.5;
  }
  for (let k = 0; k < 8; k++) { // glitch stutter: bit-crushed square blips
    const t0 = 0.012 + k * 0.017 + rnd() * 0.006, f = 300 + rnd() * 2100, dur = 0.011 + rnd() * 0.008, amp = 0.32 * (k % 2 ? 1 : 0.7);
    for (let i = Math.round(t0 * SR); i < Math.min(n, Math.round((t0 + dur) * SR)); i++) {
      const t = i / SR - t0, sq = Math.sin(TAU * f * t) > 0 ? 1 : -1;
      s[i] += Math.round(sq * 4) / 4 * amp * (1 - t / dur);
    }
  }
  const [l, r] = pan2(s, 0); normPeak(l, r, 0.40); splitPut(l, r, c.t, 1, 0.5);
};
const POP = [440, 523.25, 659.25, 880];
S.echoPop = (c, rnd) => {
  const n = Math.round(1.4 * SR), s = new Float32Array(n), f = POP[c.n % POP.length];
  for (let i = 0; i < n; i++) {
    const t = i / SR, idx = 2.6 * Math.exp(-t / 0.09), car = Math.sin(TAU * f * t + idx * Math.sin(TAU * f * 3.5 * t));
    s[i] = (car * Math.exp(-t / 0.4) + 0.3 * Math.sin(TAU * f * 2 * t) * Math.exp(-t / 0.2)) * smooth(t / 0.001) + (rnd() * 2 - 1) * Math.exp(-t / 0.0018) * 0.35;
  }
  const [l, r] = pan2(filt(s, 'hp', 200, 0.7), -0.5 + c.n * 0.33); normPeak(l, r, 0.1); put(l, r, c.t, 1, 0.4);
};
S.titleImpact = (c, rnd) => {
  const len = TL.DUR - c.t, n = Math.round(len * SR), L = new Float32Array(n), R = new Float32Array(n); let ph = 0, ph2 = 0;
  const crack = filt(white(rnd, n), 'bp', 1900, 0.6), body = filt(white(rnd, n), 'lp', 650, 0.8), sizzle = filt(white(rnd, n), 'hp', 6500, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * (55 + 95 * Math.exp(-t / 0.06)) / SR; ph2 += TAU * (110 + 150 * Math.exp(-t / 0.05)) / SR;
    const boom = Math.tanh(1.35 * Math.sin(ph)) * Math.exp(-t / 0.7) * smooth(t / 0.003) + 0.4 * Math.sin(ph2) * Math.exp(-t / 0.5) * smooth(t / 0.003);
    const v = boom * 1.0 + crack[i] * Math.exp(-t / 0.05) * 0.55 + body[i] * Math.exp(-t / 0.22) * 0.35 + sizzle[i] * Math.exp(-t / 0.55) * 0.09;
    L[i] = v; R[i] = v;
  }
  // metallic inharmonic tail
  const ratios = [1, 1.51, 2.32, 3.18, 4.27, 5.43], amps = [0.5, 0.42, 0.34, 0.24, 0.17, 0.11], decs = [1.5, 1.2, 0.95, 0.75, 0.55, 0.4];
  ratios.forEach((q, k) => {
    for (let d = 0; d < 2; d++) {
      const f = 196 * q * (d ? 1.004 : 1), [gl, gr] = panG((k % 2 ? 1 : -1) * (0.25 + 0.1 * d));
      for (let i = 0; i < n; i++) { const t = i / SR, v = Math.sin(TAU * f * t) * Math.exp(-t / decs[k]) * amps[k] * 0.2 * smooth(t / 0.002); L[i] += v * gl; R[i] += v * gr; }
    }
  });
  normPeak(L, R, 0.5); splitPut(L, R, c.t, 1, 0.5);
};

TL.cues.forEach((c, idx) => {
  const fn = S[c.type];
  if (!fn) { console.warn('unknown cue type', c.type); return; }
  curCue = idx; fn(c, cueRnd(idx));
});
// sfx reverb return
{
  const [wl, wr] = convStereo(sfxSend);
  for (let i = 0; i < N; i++) { stems.sfx.L[i] += wl[i]; stems.sfx.R[i] += wr[i]; }
}

// ------------------------------------------------------------------ assemble
const fo = TL.music.fadeOutStart;
const master = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  master[i] = Math.min(1, t / 0.008) * (t < fo ? 1 : Math.pow(Math.cos(Math.min(1, (t - fo) / (TL.DUR - fo)) * Math.PI / 2), 1.6)) * (i > N - 8 ? 0 : 1);
}
const fin = {}; // post-duck, post-fade stems
for (const k of Object.keys(stems)) {
  const b = stems[k], d = duck[k];
  fin[k] = { L: new Float32Array(N), R: new Float32Array(N) };
  for (let i = 0; i < N; i++) {
    const g = master[i] * (d ? d[i] : 1) * (k === 'amb' ? dipEnv[i] : 1);
    fin[k].L[i] = b.L[i] * g; fin[k].R[i] = b.R[i] * g;
  }
}
// VO is not faded/ducked, just master-faded (VO ends before the fade anyway)
const pre = { L: new Float32Array(N), R: new Float32Array(N) };
for (const k of Object.keys(fin)) for (let i = 0; i < N; i++) { pre.L[i] += fin[k].L[i]; pre.R[i] += fin[k].R[i]; }
{ // DC-block / sub-rumble HP on master
  const hl = filt(pre.L, 'hp', 22, 0.707), hr = filt(pre.R, 'hp', 22, 0.707); pre.L.set(hl); pre.R.set(hr);
}

function limiter(L, R, ceil, LA = 192, rel = 0.12) {
  const raw = new Float32Array(N).fill(1);
  for (let i = 0; i < N; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (p > ceil) raw[i] = ceil / p; }
  const gmin = new Float32Array(N).fill(1);
  for (let i = 0; i < N; i++) if (raw[i] < 1) for (let j = Math.max(0, i - LA); j <= Math.min(N - 1, i + LA); j++) if (raw[i] < gmin[j]) gmin[j] = raw[i];
  const cs = new Float64Array(N + 1); for (let i = 0; i < N; i++) cs[i + 1] = cs[i] + (1 - gmin[i]);
  const h = LA >> 1, g3 = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = Math.max(0, i - h), b = Math.min(N, i + h + 1); g3[i] = 1 - (cs[b] - cs[a]) / (b - a); }
  const al = 1 - Math.exp(-1 / (rel * SR)); let y = 1;
  const oL = new Float32Array(N), oR = new Float32Array(N); let minG = 1; const grT = new Float32Array(N);
  for (let i = 0; i < N; i++) { y = Math.min(g3[i], y + (1 - y) * al); if (y < minG) minG = y; grT[i] = y; oL[i] = L[i] * y; oR[i] = R[i] * y; }
  return { L: oL, R: oR, maxReductionDb: g2db(minG), grCurve: grT };
}

// gain / limiter loop to hit -14 LUFS and TP <= -1.5
let G = 1, ceilDb = -2.4, out = null, m = null;
{
  const m0 = measure(pre.L, pre.R); G = db2g(LUFS_TARGET - m0.I - 2.5); // start near, limiter will lift loudness
  for (let it = 0; it < 7; it++) {
    const sL = pre.L.map((v) => v * G), sR = pre.R.map((v) => v * G);
    out = limiter(sL, sR, db2g(ceilDb)); m = measure(out.L, out.R);
    console.log(`  iter ${it}: G=${g2db(G).toFixed(2)} dB ceil=${ceilDb.toFixed(2)} -> ${m.I} LUFS, TP ${m.TP} dBTP, limiter max GR ${out.maxReductionDb.toFixed(2)} dB`);
    const eI = LUFS_TARGET - m.I, eT = TP_LIMIT - 0.12 - m.TP;
    if (Math.abs(eI) < 0.15 && m.TP <= TP_LIMIT - 0.05) break;
    if (m.TP > TP_LIMIT - 0.05) ceilDb += Math.min(-0.1, eT - 0.05);
    G *= db2g(eI * 0.9);
  }
  // hard guarantee
  let guard = 0;
  while (m.TP > TP_LIMIT && guard++ < 6) { ceilDb -= (m.TP - TP_LIMIT) + 0.1; const sL = pre.L.map((v) => v * G), sR = pre.R.map((v) => v * G); out = limiter(sL, sR, db2g(ceilDb)); m = measure(out.L, out.R); }
}
fs.mkdirSync(OUT, { recursive: true });
writeWav(path.join(OUT, 'mix.wav'), out.L, out.R, 24);
console.log(`mix.wav written: ${m.I} LUFS, TP ${m.TP} dBTP, LRA ${m.LRA} LU`);

// ------------------------------------------------------------------ report + sanity
const stemRep = {};
for (const k of Object.keys(fin)) {
  const p = peakOf(fin[k].L, fin[k].R) * G, r = Math.sqrt((rmsOf(fin[k].L) ** 2 + rmsOf(fin[k].R) ** 2) / 2) * G;
  stemRep[k] = { peak_dBFS: +g2db(p).toFixed(1), rms_dBFS: +g2db(r).toFixed(1) };
}
const duckRep = {};
for (const k of Object.keys(DUCK)) {
  let minG = 1, act = 0; for (let i = 0; i < N; i++) { if (duck[k][i] < minG) minG = duck[k][i]; if (duck[k][i] < 0.97) act++; }
  duckRep[k] = { target_dB: DUCK[k], achieved_dB: +g2db(minG).toFixed(2), active_frac: +(act / N).toFixed(2) };
}
// per-second VO vs bed in the speech band (300-4k)
const band = (a) => filt(filt(a, 'hp', 300, 0.707), 'lp', 4000, 0.707);
const bedL = new Float32Array(N); for (const k of Object.keys(fin)) if (k !== 'vo') for (let i = 0; i < N; i++) bedL[i] += 0.5 * (fin[k].L[i] + fin[k].R[i]);
const voB = band(fin.vo.L), bedB = band(bedL);
const mask = new Uint8Array(N); for (let i = 0; i < N; i++) mask[i] = voAct[Math.min(NH - 1, Math.floor(i / HOP))] > 0.5 ? 1 : 0;
const mrms = (a, s0, s1) => { let e = 0, c = 0; for (let i = s0; i < s1; i++) if (mask[i]) { e += a[i] * a[i]; c++; } return c ? Math.sqrt(e / c) : 0; };
const stemBand = {};
for (const k of Object.keys(fin)) { const bm = new Float32Array(N); for (let i = 0; i < N; i++) bm[i] = 0.5 * (fin[k].L[i] + fin[k].R[i]); stemBand[k] = band(bm); }
const perSecond = [];
for (let s = 0; s < Math.ceil(TL.DUR); s++) {
  const a = s * SR, b = Math.min(N, (s + 1) * SR);
  const v = g2db(mrms(voB, a, b) * G), d = g2db(mrms(bedB, a, b) * G), full = g2db(Math.sqrt((rmsOf(out.L, a, b) ** 2 + rmsOf(out.R, a, b) ** 2) / 2));
  perSecond.push({ sec: s, by_stem_dB: Object.fromEntries(Object.keys(stemBand).filter((k) => k !== 'vo').map((k) => [k, +g2db(mrms(stemBand[k], a, b) * G).toFixed(0)])), vo_band_dB: +v.toFixed(1), bed_band_dB: +d.toFixed(1), vo_minus_bed_dB: +(v - d).toFixed(1), mix_rms_dB: +full.toFixed(1), vo_active: v > -90 });
}
const cueRep = TL.cues.map((c) => {
  const a = Math.round(c.t * SR), b = Math.min(N, a + Math.round(0.25 * SR)); let pk = 0;
  for (let i = a; i < b; i++) pk = Math.max(pk, Math.abs(out.L[i]), Math.abs(out.R[i]));
  return { t: +c.t.toFixed(3), type: c.type, ...(c.n !== undefined ? { n: c.n } : {}), mix_peak_0_250ms_dBFS: +g2db(pk).toFixed(1), solo_peak_dBFS: +g2db((cueSolo[TL.cues.indexOf(c)] || 0) * G).toFixed(1) };
});
const report = {
  sampleRate: SR, duration_s: +(N / SR).toFixed(3), vo_loaded: voOK,
  loudness: { integrated_LUFS: m.I, truePeak_dBTP: m.TP, LRA: m.LRA, target_LUFS: LUFS_TARGET, tp_limit: TP_LIMIT },
  gain_dB: +g2db(G).toFixed(2), limiter: { ceiling_dBFS: +ceilDb.toFixed(2), max_reduction_dB: +out.maxReductionDb.toFixed(2) },
  stems: stemRep, duck: duckRep, perSecond, cues: cueRep,
};
fs.writeFileSync(path.join(OUT, 'audio_report.json'), JSON.stringify(report, null, 1));
{ const gr = []; for (let s = 0; s < 22; s++) { let mn = 1; for (let i = s * SR / 2; i < Math.min(N, (s + 1) * SR / 2); i++) mn = Math.min(mn, out.grCurve[i]); gr.push(g2db(mn).toFixed(1)); } console.log('limiter GR per 0.5s (dB):', gr.join(' ')); }
console.log('stems:', JSON.stringify(stemRep));
console.log('duck :', JSON.stringify(duckRep));
console.log('per-second (speech band 300-4k):');
for (const p of perSecond) console.log(`  ${String(p.sec).padStart(2)}s  vo ${String(p.vo_band_dB).padStart(6)}  bed ${String(p.bed_band_dB).padStart(6)}  vo-bed ${String(p.vo_minus_bed_dB).padStart(6)}  mix ${String(p.mix_rms_dB).padStart(6)}${p.vo_active ? '' : '  (no VO)'}  ${JSON.stringify(p.by_stem_dB)}`);
console.log('cues:');
for (const c of cueRep) console.log(`  ${c.t.toFixed(2).padStart(6)} ${c.type.padEnd(12)}${c.n !== undefined ? ' n=' + c.n : '    '}  solo ${String(c.solo_peak_dBFS).padStart(6)}  mix(0-250ms) ${c.mix_peak_0_250ms_dBFS} dBFS`);

// ------------------------------------------------------------------ mux
if (process.argv.includes('--mux')) {
  const silent = path.join(OUT, 'silent.mp4'), mixf = path.join(OUT, 'mix.wav'), fin_ = path.join(OUT, 'final.mp4');
  if (!fs.existsSync(silent)) {
    console.error(`--mux: ${silent} not found (render the picture first); mix.wav is ready at ${mixf}`);
    process.exitCode = 2;
  } else {
    const r = ff(['-y', '-i', silent, '-i', mixf, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', fin_]);
    if (r.status !== 0) { console.error('ffmpeg mux failed:\n' + (r.stderr || '').split('\n').slice(-12).join('\n')); process.exitCode = 3; }
    else console.log('muxed ->', fin_);
  }
}
