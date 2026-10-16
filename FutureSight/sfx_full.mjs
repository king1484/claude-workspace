// sfx_full.mjs — FutureSight FULL video audio: everything synthesized in code, deterministic, no deps, no samples.
//
//   node sfx_full.mjs                       -> out/mix_full.wav + out/audio_report_full.json  (whole video, ~355 s)
//   node sfx_full.mjs --mux                 -> additionally out/silent_full.mp4 + mix -> out/final_full.mp4
//   node sfx_full.mjs --mux-only            -> only the mux step (uses an existing out/mix_full.wav)
//   node sfx_full.mjs --cues-dir <dir>      -> read <dir>/<id>.cues.json instead of ch/<id>.cues.json (debug outputs get a _debug suffix)
//   node sfx_full.mjs --range a,b           -> render only global seconds a..b (debug; output gets a _debug suffix)
//   node sfx_full.mjs --solo-test           -> render EVERY cue type solo (no VO/music/ambience) -> out/solo_test.wav + out/solo_test_report.json
//   other flags: --out <name> (output file stem), --no-music, --no-amb, --no-vo, --lufs <x>
//
// Architecture (memory-lean: only the mix bus preL/preR + VO + limiter curve live at full length; everything else is chapter-local):
//   VO (per-line level matching -> glue compressor -> limiter) -> sidechain duck curves (1 kHz control rate)
//   per chapter: music (mood engine, crossfaded) + ambience + cues (+reverb sends) are added into preL/preR through weight curves
//   (duck x silence/dip gates x chapter fade). Then dropOut low-pass, VO added, master fade, loudness loop (gain + look-ahead limiter).
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
const T_START = Date.now();
const lap = (m) => console.log(`[${((Date.now() - T_START) / 1000).toFixed(1)}s] ${m}`);

// ------------------------------------------------------------------ args
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf('--' + n); if (i < 0) return d; const v = argv[i + 1]; return (v === undefined || v.startsWith('--')) ? true : v; };
const SOLO = !!flag('solo-test');
const CUES_DIR = flag('cues-dir') && flag('cues-dir') !== true ? path.resolve(flag('cues-dir')) : path.join(HERE, 'ch');
const NO_MUSIC = !!flag('no-music') || SOLO, NO_AMB = !!flag('no-amb') || SOLO, NO_VO = !!flag('no-vo') || SOLO;
const LEGACY = !!flag('legacy-whoosh'); // A/B switch: old whoosh loudness + no whoosh spacing guard
const NO_GUARD = !!flag('no-guard');    // A/B switch: no short-term SFX loudness guard
const WIN_ARG = flag('win') && flag('win') !== true ? flag('win').split(',').map(Number) : [240, 280]; // report window for VO-vs-SFX table

const SR = 48000;
const TAU = Math.PI * 2;
const LUFS_TARGET = flag('lufs') && flag('lufs') !== true ? parseFloat(flag('lufs')) : -14;
const TP_LIMIT = -1.5;
const db2g = (d) => Math.pow(10, d / 20);
const g2db = (g) => 20 * Math.log10(Math.max(g, 1e-9));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const EXP = Math.exp, SIN = Math.sin, COS = Math.cos, PI = Math.PI, POW = Math.pow;

// ------------------------------------------------------------------ layout / chapters / window
const LAYOUT = JSON.parse(fs.readFileSync(path.join(OUT, 'layout.json'), 'utf8'));
const TOTAL = LAYOUT.total;
const CH_ORDER = ['ch1', 'ch2', 'ch3', 'ch3b', 'ch4', 'ch4b', 'ch5', 'ch6', 'ch6b', 'ch7'];
let W0 = 0, W1 = TOTAL;
const rangeArg = flag('range');
if (rangeArg && rangeArg !== true) { const [a, b] = rangeArg.split(',').map(Number); W0 = clamp(a, 0, TOTAL); W1 = clamp(b, W0 + 1, TOTAL); }
const DEBUG = !!(rangeArg || flag('cues-dir') || SOLO);
let SOLO_TYPES = null; // filled once the synth table exists
const soloSpacing = 5.0;
const outStem = flag('out') && flag('out') !== true ? flag('out') : (DEBUG ? 'debug' : '');
const fileMix = path.join(OUT, outStem ? `mix_full_${outStem}.wav` : 'mix_full.wav');
const fileReport = path.join(OUT, outStem ? `audio_report_full_${outStem}.json` : 'audio_report_full.json');

// ------------------------------------------------------------------ rng / noise
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
/** smooth random modulation in 0..1 at ~hz points per second (cosine interpolation) */
function smoothRand(rnd, n, hz) {
  const o = new Float32Array(n), step = Math.max(1, Math.round(SR / hz)); let a = rnd(), b = rnd();
  for (let i = 0; i < n; i++) {
    const k = i % step; if (k === 0 && i > 0) { a = b; b = rnd(); }
    const u = k / step; o[i] = a + (b - a) * (0.5 - 0.5 * COS(PI * u));
  }
  return o;
}
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ------------------------------------------------------------------ filters
/** TPT state-variable filter on a whole array. mode lp|bp|hp, fc number or fn(tSeconds) (coefficients refreshed every 8 samples). */
function filt(sig, mode, fc, Q = 0.707, out) {
  const n = sig.length, o = out || new Float32Array(n), isF = typeof fc === 'function', k = 1 / Q;
  const m = mode === 'lp' ? 0 : mode === 'bp' ? 1 : 2;
  let s1 = 0, s2 = 0, a1 = 0, a2 = 0, a3 = 0;
  const upd = (f) => { if (!(f > 5)) f = 5; if (f > SR * 0.45) f = SR * 0.45; const g = Math.tan(PI * f / SR); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; };
  if (!isF) upd(fc);
  for (let i = 0; i < n; i++) {
    if (isF && (i & 7) === 0) upd(fc(i / SR));
    const x = sig[i], v3 = x - s2, v1 = a1 * s1 + a2 * v3, v2 = s2 + a2 * s1 + a3 * v3;
    s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
    o[i] = m === 0 ? v2 : m === 1 ? v1 * k : x - k * v1 - v2;
  }
  return o;
}
function onepole(sig, tcA, tcR, rate = SR) {
  const o = new Float32Array(sig.length), a = 1 - EXP(-1 / (tcA * rate)), r = 1 - EXP(-1 / (tcR * rate));
  let y = 0;
  for (let i = 0; i < sig.length; i++) { const x = sig[i]; y += (x > y ? a : r) * (x - y); o[i] = y; }
  return o;
}
const peakOf = (...arrs) => { let p = 0; for (const a of arrs) for (let i = 0; i < a.length; i++) { const v = a[i] < 0 ? -a[i] : a[i]; if (v > p) p = v; } return p; };
function rmsOf(a, from = 0, to = a.length) { let s = 0; for (let i = from; i < to; i++) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, to - from)); }
function normPeak(l, r, target) { const p = peakOf(l, r) || 1, s = target / p; for (let i = 0; i < l.length; i++) { l[i] *= s; if (r !== l) r[i] *= s; } }
const panG = (p) => { const a = (clamp(p, -1, 1) + 1) * PI / 4; return [COS(a), SIN(a)]; };
/** mono -> stereo with pan (scalar or fn(tau)) */
function pan2(sig, pan) {
  const l = new Float32Array(sig.length), r = new Float32Array(sig.length);
  if (typeof pan === 'function') for (let i = 0; i < sig.length; i++) { const [a, b] = panG(pan(i / SR)); l[i] = sig[i] * a; r[i] = sig[i] * b; }
  else { const [a, b] = panG(pan); for (let i = 0; i < sig.length; i++) { l[i] = sig[i] * a; r[i] = sig[i] * b; } }
  return [l, r];
}

// ------------------------------------------------------------------ FFT + block convolution reverb
function fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inv ? -TAU : TAU) / len, wr = COS(ang), wi = SIN(ang), h = len >> 1;
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
function makeIR(seed, len = 2.4) { // identical construction to sfx.mjs (hook sound), then truncated for block convolution
  const rnd = mulberry32(seed), n = Math.round(len * SR), pre = Math.round(0.014 * SR);
  const out = [];
  for (let ch = 0; ch < 2; ch++) {
    const ir = new Float32Array(n);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / SR, w = rnd() * 2 - 1;
      lp += 0.16 * (w - lp);
      const hf = w - lp;
      ir[i] = (lp * EXP(-t / 0.36) + hf * 0.45 * EXP(-t / 0.15)) * smooth(t / 0.006);
    }
    for (let k = 0; k < 7; k++) ir[pre + Math.round((0.011 + k * 0.0093 + rnd() * 0.006) * SR)] += (rnd() < 0.5 ? -1 : 1) * 0.5 * EXP(-k * 0.35);
    let e = 0; for (let i = 0; i < n; i++) e += ir[i] * ir[i];
    const s = 1 / Math.sqrt(e); for (let i = 0; i < n; i++) ir[i] *= s;
    out.push(ir);
  }
  return out;
}
const CONV_B = 32768, CONV_SIZE = 1 << 17, IR_LEN = CONV_SIZE - CONV_B + 1 - 1; // 98304 samples = 2.048 s
const IRfull = makeIR(777);
const IRspec = (() => {
  const res = [];
  for (const ir of IRfull) {
    const re = new Float64Array(CONV_SIZE), im = new Float64Array(CONV_SIZE);
    for (let i = 0; i < IR_LEN; i++) re[i] = ir[i] * (i > IR_LEN - 4800 ? smooth((IR_LEN - i) / 4800) : 1);
    fft(re, im, false); res.push([re, im]);
  }
  return res;
})();
/** mono send -> stereo wet, length x.length + IR_LEN. Block-partitioned FFT convolution, silent blocks skipped. Two real outputs share one inverse FFT. */
function convWet(x, tailLen = IR_LEN) {
  const n = x.length, outN = n + tailLen, wl = new Float32Array(outN), wr = new Float32Array(outN);
  const re = new Float64Array(CONV_SIZE), im = new Float64Array(CONV_SIZE);
  const [cr, ci] = IRspec[0], [er, ei] = IRspec[1];
  for (let b0 = 0; b0 < n; b0 += CONV_B) {
    const bl = Math.min(CONV_B, n - b0); let mx = 0;
    for (let i = 0; i < bl; i++) { const v = x[b0 + i]; re[i] = v; const a = v < 0 ? -v : v; if (a > mx) mx = a; }
    if (mx < 1e-7) continue;
    for (let i = bl; i < CONV_SIZE; i++) re[i] = 0; im.fill(0);
    fft(re, im, false);
    for (let k = 0; k < CONV_SIZE; k++) {
      const a = re[k], b = im[k];
      const lr = a * cr[k] - b * ci[k], li = a * ci[k] + b * cr[k]; // X*FL
      const rr = a * er[k] - b * ei[k], ri = a * ei[k] + b * er[k]; // X*FR
      re[k] = lr - ri; im[k] = li + rr; // XFL + i*XFR
    }
    fft(re, im, true);
    const lim = Math.min(CONV_SIZE, outN - b0);
    for (let i = 0; i < lim; i++) { wl[b0 + i] += re[i]; wr[b0 + i] += im[i]; }
  }
  return [wl, wr];
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
/** streaming writer: gainFn(i) -> multiplier is not used; callers pass pre-scaled getters via fillFrame */
function writeWavStream(file, N, bits, getL, getR) { // bits: 'f32' | 24; getL/getR: (i) => value
  const bps = bits === 'f32' ? 4 : 3, dataBytes = N * 2 * bps, head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + dataBytes, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16);
  head.writeUInt16LE(bits === 'f32' ? 3 : 1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(SR, 24);
  head.writeUInt32LE(SR * 2 * bps, 28); head.writeUInt16LE(2 * bps, 32); head.writeUInt16LE(bps * 8, 34); head.write('data', 36); head.writeUInt32LE(dataBytes, 40);
  const fd = fs.openSync(file, 'w'); fs.writeSync(fd, head);
  const CH = 1 << 18, buf = Buffer.alloc(CH * 2 * bps), f32 = bits === 'f32' ? new Float32Array(buf.buffer, buf.byteOffset, CH * 2) : null;
  for (let s0 = 0; s0 < N; s0 += CH) {
    const m = Math.min(CH, N - s0);
    if (f32) { for (let i = 0; i < m; i++) { f32[2 * i] = getL(s0 + i); f32[2 * i + 1] = getR(s0 + i); } }
    else {
      let o = 0;
      for (let i = 0; i < m; i++) {
        let v = Math.round(clamp(getL(s0 + i), -1, 1) * 8388607); buf[o++] = v & 255; buf[o++] = (v >> 8) & 255; buf[o++] = (v >> 16) & 255;
        v = Math.round(clamp(getR(s0 + i), -1, 1) * 8388607); buf[o++] = v & 255; buf[o++] = (v >> 8) & 255; buf[o++] = (v >> 16) & 255;
      }
    }
    fs.writeSync(fd, buf, 0, m * 2 * bps);
  }
  fs.closeSync(fd);
}
function ff(args) { return spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }); }
function parseEbur(txt) {
  const last = (re) => { let m, v = null; const g = new RegExp(re.source, 'g'); while ((m = g.exec(txt))) v = parseFloat(m[1]); return v; };
  return { I: last(/\bI:\s+(-?[\d.]+) LUFS/), LRA: last(/LRA:\s+(-?[\d.]+) LU/), TP: last(/Peak:\s+(-?[\d.]+) dBFS/) };
}
function measureFile(file, extra = []) {
  const r = ff([...extra, '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  return parseEbur(r.stderr || '');
}

// ------------------------------------------------------------------ limiter (look-ahead, O(N) sliding-min + box smoothing + release)
function limiter(L, R, ceil, LA = 192, rel = 0.12) {
  const n = L.length, raw = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = L[i] < 0 ? -L[i] : L[i], b = R[i] < 0 ? -R[i] : R[i], p = a > b ? a : b; raw[i] = p > ceil ? ceil / p : 1; }
  // sliding-window minimum over [i-LA, i+LA] via monotone deque
  const gmin = new Float32Array(n), dq = new Int32Array(n); let hd = 0, tl = 0, nxt = 0;
  for (let i = 0; i < n; i++) {
    const hi = Math.min(n - 1, i + LA);
    while (nxt <= hi) { while (tl > hd && raw[dq[tl - 1]] >= raw[nxt]) tl--; dq[tl++] = nxt; nxt++; }
    while (dq[hd] < i - LA) hd++;
    gmin[i] = raw[dq[hd]];
  }
  // box smoothing (width LA+1) using a running sum, written over raw
  const h = LA >> 1; let sum = 0, cnt = 0;
  for (let j = 0; j <= Math.min(n - 1, h); j++) { sum += gmin[j]; cnt++; }
  for (let i = 0; i < n; i++) {
    raw[i] = sum / cnt;
    const add = i + h + 1, rem = i - h;
    if (add < n) { sum += gmin[add]; cnt++; }
    if (rem >= 0) { sum -= gmin[rem]; cnt--; }
  }
  const al = 1 - EXP(-1 / (rel * SR)); let y = 1, minG = 1;
  const oL = new Float32Array(n), oR = L === R ? oL : new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g3 = raw[i]; y = Math.min(g3, y + (1 - y) * al); if (y < minG) minG = y;
    oL[i] = L[i] * y; if (oR !== oL) oR[i] = R[i] * y;
  }
  return { L: oL, R: oR, maxReductionDb: g2db(minG) };
}

// ------------------------------------------------------------------ chapters + cue files
const MOOD_NAMES = ['wonder', 'bright', 'tense', 'dark', 'hollow', 'warm', 'epic', 'quiet'];
const AMB_NAMES = ['city', 'indoor', 'casino', 'arena', 'wind', 'quiet', 'crowd', 'void'];
const DEFAULTS = {
  ch1: ['wonder', 'city'], ch2: ['warm', 'indoor'], ch3: ['bright', 'arena'], ch3b: ['tense', 'city'], ch4: ['dark', 'casino'],
  ch4b: ['tense', 'city'], ch5: ['warm', 'city'], ch6: ['hollow', 'indoor'], ch6b: ['wonder', 'quiet'], ch7: ['hollow', 'void'],
};
const missingCues = [], unknownTypes = {}, whooshGuardDropped = [], WHOOSH_MIN_GAP = 2.0;
function loadChapter(id) {
  const Lo = LAYOUT[id], f = path.join(CUES_DIR, id + '.cues.json');
  let j = null;
  if (fs.existsSync(f)) {
    try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`WARN ${id}: bad cues json (${e.message}) -> mood defaults, no cues`); missingCues.push(id + '(bad)'); }
  } else { console.log(`NOTE ${id}: ${f} missing -> mood defaults, no cues`); missingCues.push(id); }
  const [dm, da] = DEFAULTS[id] || ['hollow', 'quiet'], dur = Lo.dur;
  const mood = j && MOOD_NAMES.includes(j.mood) ? j.mood : dm;
  const amb = j && AMB_NAMES.includes(j.ambience) ? j.ambience : da;
  const mu = (j && j.music) || {};
  let arc = Array.isArray(mu.arc) && mu.arc.length ? mu.arc.map((a) => [+a[0], +a[1], +a[2]]).filter((a) => a.every(Number.isFinite)) : null;
  if (!arc || !arc.length) arc = [[0, 2, 0.25], [2, Math.max(2.1, dur - 3), 0.5], [Math.max(2.1, dur - 3), dur, 0.35]];
  const risers = (Array.isArray(mu.risers) ? mu.risers : []).map((a) => [+a[0], +a[1]]).filter((a) => a.every(Number.isFinite) && a[1] > a[0] + 0.05);
  const silence = (Array.isArray(mu.silence) ? mu.silence : []).map((a) => [+a[0], +a[1]]).filter((a) => a.every(Number.isFinite) && a[1] > a[0]);
  let cues = [];
  for (const c of (j && Array.isArray(j.cues) ? j.cues : [])) {
    if (!c || typeof c.type !== 'string' || !Number.isFinite(+c.t)) continue;
    if (!S[c.type]) { unknownTypes[c.type] = (unknownTypes[c.type] || 0) + 1; continue; }
    if (c.t < -0.05 || c.t > dur + 1.0) continue;
    cues.push({ ...c, t: Math.max(0, +c.t) });
  }
  cues.sort((a, b) => a.t - b.t);
  if (!LEGACY) { // safety net: whoosh-family cues closer than WHOOSH_MIN_GAP to the previous kept one are dropped (stacked whooshes were the loudness complaint)
    let last = -99; const kept = [];
    for (const c of cues) {
      if (WHOOSH_FAM.has(c.type)) { if (c.t - last < WHOOSH_MIN_GAP) { whooshGuardDropped.push({ chapter: id, t: +c.t.toFixed(2), type: c.type }); continue; } last = c.t; }
      kept.push(c);
    }
    cues = kept;
  }
  return { id, start: Lo.start, dur, vo: Lo.vo || [], mood, amb, arc, risers, silence, cues, title: Lo.title || id };
}

// ------------------------------------------------------------------ cue rendering context (chapter-local buses; origin = chapter start)
const BUSES = ['sfx', 'hit', 'low', 'riser'];
let CUR = null; // { buf:{bus:{L,R}}, send:Float32Array, n, c, g, solo:{} }
function makeCtx(nSamples) {
  const buf = {}; for (const b of BUSES) buf[b] = { L: new Float32Array(nSamples), R: new Float32Array(nSamples) };
  return { buf, send: new Float32Array(nSamples + IR_LEN), n: nSamples, c: null, g: 1, cueIdx: -1, solo: [] };
}
/** add a stereo cue sound (already peak-normalised) at the current cue's time. gain = CUR.g (cue gain). send = reverb send amount. */
function put(l, r, send = 0, bus = 'sfx', dt = 0) {
  const n = l.length, fi = Math.min(12, n >> 1);
  if (CUR.softLp) { const same = l === r; l.set(filt(l, 'lp', CUR.softLp, 0.707)); if (!same) r.set(filt(r, 'lp', CUR.softLp, 0.707)); } // whoosh family: gentler highs
  for (let i = 0; i < fi; i++) { const w = i / fi; l[i] *= w; r[i] *= w; } // tiny fade-in (anti-click)
  const fo = Math.min(Math.round(0.004 * SR), n >> 1);
  for (let i = 0; i < fo; i++) { const w = i / fo, k = n - 1 - i; l[k] *= w; r[k] *= w; } // fade-out so truncated tails never click
  const g = CUR.g, s0 = Math.round((CUR.c.t + dt) * SR), B = CUR.buf[bus];
  const p = peakOf(l, r) * g; if (!(CUR.solo[CUR.cueIdx] >= p)) CUR.solo[CUR.cueIdx] = p;
  for (let i = 0; i < n; i++) { const k = s0 + i; if (k >= CUR.n) break; if (k < 0) continue; B.L[k] += l[i] * g; B.R[k] += r[i] * g; }
  if (send > 0) for (let i = 0; i < n; i++) { const k = s0 + i; if (k >= CUR.n) break; if (k < 0) continue; CUR.send[k] += 0.5 * (l[i] + r[i]) * g * send; }
}
/** split at fc: lows -> unducked 'low' bus, highs -> ducked bus; reverb send fed by the highs only */
function splitPut(l, r, send, fc = 190, hiBus = 'hit', dt = 0) {
  const ll = filt(l, 'lp', fc, 0.707), lr = filt(r, 'lp', fc, 0.707), hl = new Float32Array(l.length), hr = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) { hl[i] = l[i] - ll[i]; hr[i] = r[i] - lr[i]; }
  const p = peakOf(l, r) * CUR.g; put(ll, lr, 0, 'low', dt); put(hl, hr, send, hiBus, dt);
  if (!(CUR.solo[CUR.cueIdx] >= p)) CUR.solo[CUR.cueIdx] = p;
}
const GDEF = { pullOut: 0.7, ghostWhoosh: 0.6 }; // default cue gains inherited from sfx.mjs (hook)

// ------------------------------------------------------------------ VO bed (per-line level match -> glue compressor -> limiter)
const NW = Math.round((W1 - W0) * SR);
const gi = (t) => Math.round((t - W0) * SR);
const HOP = 48, NHc = Math.ceil(NW / HOP) + 3;
let voTrack = new Float32Array(NW), voStats = { lines: 0, missing: [] };
const chapters = [];
function activeRms(x) {
  const F = 480, fr = []; let mx = 0;
  for (let s = 0; s + F <= x.length; s += F) { let e = 0; for (let j = 0; j < F; j++) e += x[s + j] * x[s + j]; e /= F; fr.push(e); if (e > mx) mx = e; }
  let sum = 0, c = 0; for (const e of fr) if (e >= mx * 0.03) { sum += e; c++; }
  return c ? Math.sqrt(sum / c) : 0;
}
const VO_TARGET_RMS = 0.15;
function placeVO(file, tAbs, tag) {
  if (tAbs + 0.01 > W1 || !fs.existsSync(file)) { if (!fs.existsSync(file)) voStats.missing.push(tag); return; }
  let x; try { x = readWav(file); } catch (e) { voStats.missing.push(tag + '(bad)'); return; }
  if (tAbs + x.length / SR < W0) return;
  const rms = activeRms(x), g = clamp(VO_TARGET_RMS / (rms || 1), 0.1, 10), fa = Math.round(0.012 * SR);
  const s0 = gi(tAbs);
  for (let i = 0; i < x.length; i++) {
    const k = s0 + i; if (k < 0) continue; if (k >= NW) break;
    const w = Math.min(1, i / fa, (x.length - 1 - i) / fa);
    voTrack[k] += x[i] * g * w;
  }
  voStats.lines++;
}
function buildVO() {
  if (!NO_VO) {
    placeVO(path.join(OUT, 'vo.wav'), 0, 'hook');
    for (const id of CH_ORDER) {
      const Lo = LAYOUT[id]; if (!Lo) continue;
      for (const ln of Lo.vo || []) placeVO(path.join(OUT, 'vo', ln.id + '.wav'), Lo.start + ln.start, ln.id);
    }
    if (voStats.missing.length) console.log('VO files missing:', voStats.missing.join(','));
  }
  voTrack = filt(voTrack, 'hp', 75, 0.707);
  { // gentle feed-forward compressor (thr -24 dB, 3:1, 6/140 ms) + makeup, then limiter
    const a = 1 - EXP(-1 / (0.006 * SR)), r = 1 - EXP(-1 / (0.14 * SR)), thr = -28, ratio = 4; let e = 0;
    for (let i = 0; i < NW; i++) {
      const x = voTrack[i] < 0 ? -voTrack[i] : voTrack[i]; e += (x > e ? a : r) * (x - e);
      const d = e > 1e-6 ? 20 * Math.log10(e) : -120;
      voTrack[i] *= db2g((d > thr ? -(d - thr) * (1 - 1 / ratio) : 0) + 6);
    }
    const lm = limiter(voTrack, voTrack, 0.33, 96, 0.05); voTrack = lm.L;
    voStats.limiter_max_reduction_dB = +lm.maxReductionDb.toFixed(2);
  }
  voStats.peak = +peakOf(voTrack).toFixed(3);
}

// ------------------------------------------------------------------ control curves (1 kHz): VO sidechain duck, music/amb gates, drop-outs
const voAct = new Float32Array(NHc), duckSm = new Float32Array(NHc);
const DUCK = { amb: -9, music: -9, riser: -5.5, sfx: -6, hit: -7 };
const duckCtl = {}, gateMA = new Float32Array(NHc).fill(1), gateAll = new Float32Array(NHc).fill(1);
const dropRanges = [];
function buildDuck() {
  for (let h = 0; h < NHc; h++) {
    const a = h * HOP, b = Math.min(NW, a + HOP);
    if (a >= NW) { voAct[h] = 0; continue; }
    voAct[h] = clamp((g2db(rmsOf(voTrack, a, b)) + 52) / 12, 0, 1);
  }
  const HOLD = 120, LOOK = 25, held = new Float32Array(NHc);
  { // sliding max over the previous HOLD ms
    const dq = new Int32Array(NHc); let hd = 0, tl = 0;
    for (let h = 0; h < NHc; h++) {
      while (tl > hd && voAct[dq[tl - 1]] <= voAct[h]) tl--; dq[tl++] = h;
      while (dq[hd] < h - HOLD) hd++;
      held[h] = voAct[dq[hd]];
    }
  }
  const look = new Float32Array(NHc); for (let h = 0; h < NHc; h++) look[h] = held[Math.min(NHc - 1, h + LOOK)];
  { let y = 0; const a = 1 - EXP(-1 / (0.03 * 1000)), r = 1 - EXP(-1 / (0.32 * 1000)); for (let h = 0; h < NHc; h++) { y += (look[h] > y ? a : r) * (look[h] - y); duckSm[h] = y; } }
  for (const k in DUCK) { const kk = 1 - db2g(DUCK[k]), o = new Float32Array(NHc); for (let h = 0; h < NHc; h++) o[h] = 1 - duckSm[h] * kk; duckCtl[k] = o; }
}
/** multiply a gate array by a range envelope: fade down over `fall`, hold [a,b], return over `rise` (times absolute seconds) */
function gateRange(arr, a, b, depth = 1, fall = 0.04, rise = 0.3) {
  const h0 = Math.floor((a - fall - W0) * 1000), h1 = Math.ceil((b + rise - W0) * 1000);
  for (let h = Math.max(0, h0); h <= Math.min(NHc - 1, h1); h++) {
    const t = W0 + h / 1000; let v;
    if (t < a) v = 1 - depth * smooth((t - (a - fall)) / fall);
    else if (t <= b) v = 1 - depth;
    else v = 1 - depth * (1 - smooth((t - b) / rise));
    if (v < arr[h]) arr[h] = v;
  }
}
function buildGates(chs) {
  for (const ch of chs) {
    for (const [a, b] of ch.silence) gateRange(gateMA, ch.start + a, ch.start + b, 1, 0.05, 0.28);
    for (const c of ch.cues) {
      const t = ch.start + c.t;
      if (c.type === 'titleImpact') { // brief hush right before the boom, then swell back (as in the hook)
        for (let h = Math.max(0, Math.floor((t - 0.1 - W0) * 1000)); h <= Math.min(NHc - 1, Math.ceil((t + 0.5 - W0) * 1000)); h++) {
          const d = W0 + h / 1000 - t; let v = 1;
          if (d > -0.09 && d < 0) v = mix(1, 0.12, smooth((d + 0.09) / 0.03)); else if (d >= 0 && d < 0.5) v = mix(0.12, 1, smooth(d / 0.5));
          if (v < gateMA[h]) gateMA[h] = v;
        }
      } else if (c.type === 'silenceHit') gateRange(gateMA, t, t + (c.len ?? 0.9), 1, 0.02, 0.9);
      else if (c.type === 'dropOut') { const len = c.len ?? 1.0; gateRange(gateAll, t, t + len, 0.7, 0.06, 0.6); dropRanges.push([t, t + len]); }
    }
  }
}
/** busCtl[bus] = combined 1 kHz gain array */
const busCtl = {};
function buildBusCtl() {
  const cm = (a, b) => { const o = new Float32Array(NHc); for (let h = 0; h < NHc; h++) o[h] = a[h] * b[h]; return o; };
  busCtl.music = cm(cm(duckCtl.music, gateMA), gateAll);
  busCtl.amb = cm(cm(duckCtl.amb, gateMA), gateAll);
  busCtl.riser = cm(cm(duckCtl.riser, gateMA), gateAll);
  busCtl.sfx = cm(duckCtl.sfx, gateAll);
  busCtl.hit = cm(duckCtl.hit, gateAll);
  busCtl.low = gateAll;
  // master trims: transient-heavy buses sit lower so the limiter is not the mix engineer
  const trim = { sfx: -4, hit: -5, low: -4 };
  for (const k in trim) { const g = db2g(trim[k]), o = new Float32Array(NHc); for (let h = 0; h < NHc; h++) o[h] = busCtl[k][h] * g; busCtl[k] = o; }
}

// ------------------------------------------------------------------ mix bed + helpers to add chapter-local arrays through control curves
const preL = new Float32Array(NW), preR = new Float32Array(NW), PRE_L = preL, PRE_R = preR;
// SFX stem (sfx/hit/low buses + their reverb) is kept apart so the short-term loudness guard can govern it before it joins the bed
const STEM = { L: new Float32Array(NW), R: new Float32Array(NW) };
/** add src (stereo, origin at absolute tAbs0) into the bed, multiplied by a 1 kHz control array (null = unity) and `scale` */
function addCtl(sL, sR, tAbs0, ctl, scale = 1, nUse = sL.length, dst = null) {
  const o0 = gi(tAbs0), iS = Math.max(0, -o0), iE = Math.min(nUse, NW - o0);
  if (iE <= iS) return;
  const preL = dst ? dst.L : PRE_L, preR = dst ? dst.R : PRE_R;
  if (!ctl) { for (let i = iS; i < iE; i++) { preL[o0 + i] += sL[i] * scale; preR[o0 + i] += sR[i] * scale; } return; }
  let i = iS;
  while (i < iE) {
    const pi = o0 + i, h = (pi / HOP) | 0, end = Math.min(iE, i + (HOP * (h + 1) - pi)), g0 = ctl[h], g1 = ctl[h + 1] !== undefined ? ctl[h + 1] : g0, base = HOP * h;
    for (; i < end; i++) {
      const p2 = o0 + i, g = (g0 + (g1 - g0) * ((p2 - base) / HOP)) * scale;
      preL[p2] += sL[i] * g; preR[p2] += sR[i] * g;
    }
  }
}

// ------------------------------------------------------------------ MUSIC ENGINE (chapters): continuous A-minor-family bed on a global 96 BPM grid
const BEAT = 60 / 96, BO = 0.45, BAR = BEAT * 4;
const mkChord = (r, third, ext = null) => ({
  pad: [r, r + 7, r + 12, r + 12 + third, r + 19, ...(ext !== null ? [r + 12 + ext] : [])],
  arp: [r + 12, r + 12 + third, r + 19, r + 24], bass: r - 12,
});
const CHD = {
  Am: mkChord(45, 3), Am9: mkChord(45, 3, 14), Amb9: mkChord(45, 3, 13), F: mkChord(41, 4), Fmaj7: mkChord(41, 4, 11), C: mkChord(48, 4),
  Cadd9: mkChord(48, 4, 14), G: mkChord(43, 4), Dm: mkChord(50, 3), Dm7: mkChord(50, 3, 10), E: mkChord(40, 4), Bb: mkChord(46, 4),
};
// pad kinds: saw | str | cluster | air | warm | open.  dB values are rms (pad/drone) or peak (arp/drums) targets at intensity 1.
const MOODS = {
  wonder: { prog: ['Am9', 'Fmaj7', 'Cadd9', 'G'], seg: 2, lvl: -1.0, pad: { k: 'air', ov: 0.9, fc: [500, 3400], dB: -27 }, drone: -35, kick: null, pulse8: null, arp: { k: 'bell', rate: 0.5, dens: [0.2, 0.6], dB: -21, oct: 12, pat: 'rand' }, drums: null, rv: 0.55 },
  bright: { prog: ['C', 'G', 'Am', 'F'], seg: 1, lvl: 0.0, pad: { k: 'saw', ov: 0.12, fc: [700, 3900], dB: -30 }, drone: null, kick: -33, pulse8: null, arp: { k: 'pluck', rate: 0.5, dens: [0.65, 1.0], dB: -19, oct: 0, pat: 'up', force: true }, drums: 'light', rv: 0.4 },
  tense: { prog: ['Amb9', 'Bb', 'Amb9', 'E'], seg: 1, lvl: 0.0, pad: { k: 'cluster', ov: 0.5, fc: [300, 2400], dB: -30 }, drone: -33, kick: null, pulse8: -29, arp: { k: 'pluck', rate: 0.25, dens: [0.1, 0.5], dB: -24, oct: 0, pat: 'minor2' }, drums: 'tense', rv: 0.4 },
  dark: { prog: ['Am', 'Bb', 'Am', 'F'], seg: 2, lvl: -2.0, pad: { k: 'cluster', ov: 1.0, fc: [180, 900], dB: -33 }, drone: -27, kick: null, pulse8: null, arp: { k: 'bell', rate: 1, dens: [0.05, 0.3], dB: -27, oct: -12, pat: 'rand' }, drums: null, rv: 0.6 },
  hollow: { prog: ['Am', 'F', 'Am', 'G'], seg: 2, lvl: -5.0, pad: { k: 'open', ov: 1.0, fc: [300, 1500], dB: -33 }, drone: -39, kick: null, pulse8: null, arp: { k: 'pluck', rate: 1, dens: [0.06, 0.22], dB: -26, oct: 0, pat: 'rand' }, drums: null, rv: 0.7 },
  warm: { prog: ['Fmaj7', 'Cadd9', 'Dm7', 'Am9'], seg: 2, lvl: -2.0, pad: { k: 'warm', ov: 0.8, fc: [400, 2000], dB: -28 }, drone: -35, kick: -37, pulse8: null, arp: { k: 'soft', rate: 0.5, dens: [0.3, 0.65], dB: -22, oct: 0, pat: 'up' }, drums: null, rv: 0.45 },
  epic: { prog: ['Am', 'F', 'C', 'G'], seg: 1, lvl: 2.0, pad: { k: 'str', ov: 0.9, fc: [500, 4300], dB: -26 }, drone: -31, kick: -29, pulse8: null, arp: { k: 'pluck', rate: 0.5, dens: [0.2, 0.9], dB: -21, oct: 12, pat: 'up' }, drums: 'epic', rv: 0.5 },
  quiet: { prog: ['Am', 'F', 'Am', 'G'], seg: 2, lvl: -14.0, pad: { k: 'open', ov: 1.2, fc: [260, 900], dB: -32 }, drone: -40, kick: null, pulse8: null, arp: { k: 'bell', rate: 1, dens: [0.04, 0.15], dB: -28, oct: 0, pat: 'rand' }, drums: null, rv: 0.7 },
};
const blepSaw = (ph, dt) => {
  let v = 2 * ph - 1;
  if (ph < dt) { const t = ph / dt; v -= t + t - t * t - 1; }
  else if (ph > 1 - dt) { const t = (ph - 1) / dt; v -= t * t + t + t + 1; }
  return v;
};
const modI = (a, n) => ((a % n) + n) % n;
function chordAt(cfg, t) { const seg = cfg.seg * BAR, c = Math.floor((t - BO) / seg); return CHD[cfg.prog[modI(c, cfg.prog.length)]]; }
function segLoop(cfg, T0, n, fn) { // calls fn(a, b, chord, idx) for each chord segment overlapping the buffer window
  const seg = cfg.seg * BAR, c0 = Math.floor((T0 - BO) / seg) - 1, c1 = Math.floor((T0 + n / SR - BO) / seg) + 1;
  for (let c = c0; c <= c1; c++) fn(BO + c * seg, BO + (c + 1) * seg, CHD[cfg.prog[modI(c, cfg.prog.length)]], c);
}
function normRms(L, R, dB) { const r = Math.sqrt((rmsOf(L) ** 2 + rmsOf(R) ** 2) / 2) || 1, s = db2g(dB) / r; for (let i = 0; i < L.length; i++) { L[i] *= s; R[i] *= s; } }
function normPk(L, R, dB) { const s = db2g(dB) / (peakOf(L, R) || 1); for (let i = 0; i < L.length; i++) { L[i] *= s; R[i] *= s; } }

function layerPad(cfg, T0, n, Ik) {
  const L = new Float32Array(n), R = new Float32Array(n), p = cfg.pad, ov = p.ov, k = p.k;
  const detL = k === 'str' ? [-11, 0, 7] : k === 'saw' || k === 'cluster' ? [-8, 3] : [-6, 4], detR = k === 'str' ? [-6, 2, 11] : k === 'saw' || k === 'cluster' ? [-3, 8] : [-4, 6];
  segLoop(cfg, T0, n, (a, b, chord, ci) => {
    const i0 = Math.max(0, Math.round((a - ov - T0) * SR)), i1 = Math.min(n, Math.round((b + ov - T0) * SR));
    if (i1 <= i0) return;
    let notes = k === 'open' ? [chord.pad[0], chord.pad[1], chord.pad[2]] : chord.pad;
    for (const m of notes) {
      const f0 = mtof(m), lo = m < 50;
      for (let side = 0; side < 2; side++) {
        const dets = side ? detR : detL, tgt = side ? R : L;
        for (let v = 0; v < dets.length; v++) {
          const f = f0 * POW(2, dets[v] / 1200), dt = f / SR;
          let ph = ((m * 0.137 + v * 0.31 + side * 0.17 + ci * 0.0) % 1 + 1) % 1;
          const amp = (lo ? 0.9 : 0.55) / dets.length * (k === 'air' || k === 'warm' || k === 'open' ? 1.4 : 1);
          for (let i = i0; i < i1; i++) {
            const t = T0 + i / SR, env = smooth((t - (a - ov)) / (2 * ov)) * (1 - smooth((t - (b - ov)) / (2 * ov)));
            if (env <= 0) { ph += dt; if (ph >= 1) ph -= 1; continue; }
            let s;
            if (k === 'saw' || k === 'str' || k === 'cluster') s = blepSaw(ph, dt);
            else if (k === 'air') s = SIN(TAU * ph) + 0.3 * SIN(TAU * 2 * ph) + 0.12 * SIN(TAU * 3 * ph);
            else if (k === 'warm') s = SIN(TAU * ph) - 0.11 * SIN(TAU * 3 * ph) + 0.04 * SIN(TAU * 5 * ph) + 0.25 * SIN(TAU * 2 * ph);
            else s = SIN(TAU * ph) + 0.2 * SIN(TAU * 2 * ph);
            let g = env * amp;
            if (k === 'cluster') g *= 0.8 + 0.2 * SIN(TAU * (0.2 + 0.03 * v) * t + m);
            else if (k === 'air' || k === 'open') g *= 0.85 + 0.15 * SIN(TAU * 0.27 * t + m * 1.7 + side);
            tgt[i] += s * g;
            ph += k === 'str' ? dt * (1 + 0.0035 * SIN(TAU * 5.3 * t + m)) : dt; if (ph >= 1) ph -= 1;
          }
        }
      }
    }
  });
  const fc = (t) => p.fc[0] + (p.fc[1] - p.fc[0]) * POW(Ik(T0 + t), 1.25);
  const fL = filt(L, 'lp', fc, 0.8), fR = filt(R, 'lp', fc, 0.8);
  normRms(fL, fR, p.dB);
  for (let i = 0; i < n; i++) { const g = 0.35 + 0.65 * Ik(T0 + i / SR); fL[i] *= g; fR[i] *= g; }
  return [fL, fR];
}
function layerDrone(cfg, T0, n, Ik) {
  const L = new Float32Array(n), R = new Float32Array(n), ov = 1.0;
  segLoop(cfg, T0, n, (a, b, chord) => {
    const i0 = Math.max(0, Math.round((a - ov - T0) * SR)), i1 = Math.min(n, Math.round((b + ov - T0) * SR)); if (i1 <= i0) return;
    const f = mtof(chord.bass), f2 = f * 1.5;
    let p1 = 0, p2 = 0, p3 = 0;
    for (let i = i0; i < i1; i++) {
      const t = T0 + i / SR, env = smooth((t - (a - ov)) / (2 * ov)) * (1 - smooth((t - (b - ov)) / (2 * ov)));
      p1 += TAU * f / SR; p2 += TAU * f2 * 1.0015 / SR; p3 += TAU * f * 1.004 / SR;
      const lfo = 0.85 + 0.15 * SIN(TAU * 0.23 * t);
      const v = (SIN(p1) + 0.3 * SIN(2 * p1) + 0.32 * SIN(p2) + 0.5 * SIN(p3 + 0.8 * SIN(TAU * 0.11 * t))) * env * lfo;
      L[i] += v; R[i] += v * 0.98;
    }
  });
  normRms(L, R, cfg.drone);
  for (let i = 0; i < n; i++) { const g = 0.45 + 0.55 * Ik(T0 + i / SR); L[i] *= g; R[i] *= g; }
  return [L, R];
}
function layerKick(cfg, T0, n, Ik, epic) {
  const L = new Float32Array(n);
  const k0 = Math.floor((T0 - BO) / BEAT) - 1;
  for (let k = k0; BO + k * BEAT < T0 + n / SR; k++) {
    const tb = BO + k * BEAT, pos = modI(k, 4), I = Ik(tb);
    if (epic && !(pos === 0 || pos === 2 || (I > 0.7 && pos !== 1) )) continue;
    const accent = pos === 0 ? 1 : pos === 2 ? 0.7 : 0.45, g = (0.2 + 0.8 * I) * accent;
    const f0 = mtof(chordAt(cfg, tb).bass), s0 = Math.round((tb - T0) * SR); if (s0 < 0 && s0 + 0.6 * SR < 0) continue;
    let ph = 0;
    for (let i = Math.max(0, s0); i < Math.min(n, s0 + Math.round(0.6 * SR)); i++) {
      const tau = (i - s0) / SR, f = f0 * (1 + (epic ? 1.8 : 1.3) * EXP(-tau / 0.025));
      ph += TAU * f / SR;
      L[i] += (SIN(ph) + 0.32 * SIN(2 * ph)) * smooth(tau / 0.006) * EXP(-tau / (epic ? 0.22 : 0.17)) * g;
    }
  }
  normPk(L, L, cfg.kick);
  return [L, L.slice()];
}
function layerPulse8(cfg, T0, n, Ik) { // tense: low pulsing saw/sine on every 8th
  const L = new Float32Array(n), rnd = mulberry32(hashStr('pulse') + Math.round(T0));
  const k0 = Math.floor((T0 - BO) / (BEAT / 2)) - 1; let lpz = 0;
  for (let k = k0; BO + k * BEAT / 2 < T0 + n / SR; k++) {
    const tb = BO + k * BEAT / 2, I = Ik(tb), acc = modI(k, 8) === 0 ? 1 : modI(k, 2) === 0 ? 0.75 : 0.5, f = mtof(chordAt(cfg, tb).bass + (modI(k, 16) === 11 ? 1 : 0));
    const s0 = Math.round((tb - T0) * SR), len = Math.round(0.26 * SR), g = (0.3 + 0.7 * I) * acc; rnd();
    let ph = 0;
    for (let i = Math.max(0, s0); i < Math.min(n, s0 + len); i++) {
      const tau = (i - s0) / SR; ph += f / SR; if (ph >= 1) ph -= 1;
      const saw = blepSaw(ph, f / SR), sine = SIN(TAU * ph);
      const x = (0.55 * saw + sine) * EXP(-tau / 0.11) * smooth(tau / 0.004) * g;
      lpz += (0.04 + 0.28 * EXP(-tau / 0.06)) * (x - lpz); L[i] += lpz;
    }
  }
  normRms(L, L, cfg.pulse8);
  return [L, L.slice()];
}
function layerArp(cfg, T0, n, Ik, rnd) {
  const a = cfg.arp, L = new Float32Array(n), R = new Float32Array(n), step = a.rate * BEAT * 1; // rate = fraction of a beat
  const stepSec = step, k0 = Math.floor((T0 - BO) / stepSec) - 1, patUp = [0, 1, 2, 3, 2, 1, 2, 1];
  for (let k = k0; BO + k * stepSec < T0 + n / SR; k++) {
    const ts = BO + k * stepSec, ch = chordAt(cfg, ts), I = Ik(ts), r1 = rnd(), r2 = rnd(), r3 = rnd();
    const perBeat = Math.max(1, Math.round(1 / a.rate)), stepInBeat = modI(k, perBeat), stepInBar = modI(k, perBeat * 4);
    const dens = mix(a.dens[0], a.dens[1], I), play = r1 < dens || (a.force && stepInBeat === 0);
    if (!play) continue;
    let idx;
    if (a.pat === 'up') idx = patUp[modI(k, 8)]; else if (a.pat === 'minor2') idx = 0; else idx = Math.floor(r2 * 4);
    let m = ch.arp[idx] + (a.oct || 0) + ((I > 0.7 && modI(k, 8) === 4) ? 12 : 0);
    if (a.pat === 'minor2' && modI(k, 4) === 2) m += 1; // dissonant half-step
    if (a.pat === 'minor2' && r3 < 0.25) m += 12;
    const f = mtof(m), vel = (stepInBeat === 0 ? 1 : 0.62) * (0.35 + 0.65 * I) * (stepInBar === 0 ? 1.15 : 1);
    const [gl, gr] = panG(SIN(k * 1.3) * 0.45);
    const s0 = Math.round((ts - T0) * SR), len = Math.round((a.k === 'bell' ? 1.6 : a.k === 'soft' ? 1.0 : 0.9) * SR);
    for (let i = Math.max(0, s0); i < Math.min(n, s0 + len); i++) {
      const tau = (i - s0) / SR; let v = 0;
      if (a.k === 'pluck') { for (let h = 1; h <= 7; h++) v += SIN(TAU * f * h * tau + h * 0.4) / POW(h, 1.1) * EXP(-tau * (4.2 + 5.5 * (h - 1))); v *= smooth(tau / 0.003); }
      else if (a.k === 'bell') { const idxm = 2.2 * EXP(-tau / 0.12); v = (SIN(TAU * f * tau + idxm * SIN(TAU * f * 3.5 * tau)) * EXP(-tau / 0.55) + 0.25 * SIN(TAU * f * 2 * tau) * EXP(-tau / 0.3)) * smooth(tau / 0.002); }
      else { v = (SIN(TAU * f * tau) + 0.3 * SIN(TAU * f * 2 * tau) * EXP(-tau / 0.2)) * EXP(-tau / 0.45) * smooth(tau / 0.008); }
      v *= vel; L[i] += v * gl; R[i] += v * gr;
    }
  }
  // ping-pong delay (dotted 8th)
  const dly = Math.round(BEAT * 0.75 * SR), dL = new Float32Array(n), dR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    dL[i] = L[i] + (i >= dly ? dR[i - dly] * 0.4 : 0); dR[i] = R[i] + (i >= dly ? dL[i - dly] * 0.4 : 0);
  }
  const oL = filt(dL, 'lp', 3800, 0.7), oR = filt(dR, 'lp', 3800, 0.7);
  normPk(oL, oR, a.dB);
  return [oL, oR];
}
function layerDrums(cfg, T0, n, Ik, rnd) {
  const L = new Float32Array(n), R = new Float32Array(n), kind = cfg.drums, nz = (() => { const r = mulberry32(4242); return white(r, SR); })();
  const hit = (ts, dur, fn, g, pan = 0) => { // fn(tau) -> sample
    const s0 = Math.round((ts - T0) * SR), len = Math.round(dur * SR), [gl, gr] = panG(pan);
    for (let i = Math.max(0, s0); i < Math.min(n, s0 + len); i++) { const v = fn((i - s0) / SR, i - s0) * g; L[i] += v * gl; R[i] += v * gr; }
  };
  const k0 = Math.floor((T0 - BO) / (BEAT / 4)) - 1;
  let hz1 = 0, hz2 = 0;
  for (let k = k0; BO + k * BEAT / 4 < T0 + n / SR; k++) {
    const ts = BO + k * BEAT / 4, I = Ik(ts), s16 = modI(k, 4), beat = modI(Math.floor(k / 4), 4), r = rnd();
    const bi = Math.floor(k / 4);
    if (kind === 'light') {
      if (s16 === 2) hit(ts, 0.05, (tau, i) => { const x = nz[i % SR]; hz1 += 0.7 * (x - hz1); return (x - hz1) * EXP(-tau / 0.018) * smooth(tau / 0.001); }, 0.5 * (0.3 + 0.7 * I) * (beat % 2 ? 1 : 0.8), 0.25);
      if (I > 0.5 && (s16 === 1 || s16 === 3) && r < 0.6) hit(ts, 0.03, (tau, i) => { const x = nz[(i * 3) % SR]; hz2 += 0.8 * (x - hz2); return (x - hz2) * EXP(-tau / 0.008); }, 0.22 * I, -0.3);
    } else if (kind === 'tense') {
      if (s16 % 2 === 0 && r < 0.35 + 0.6 * I) hit(ts, 0.03, (tau, i) => { const x = nz[(i * 5) % SR]; hz1 += 0.85 * (x - hz1); return (x - hz1) * EXP(-tau / 0.009); }, (0.1 + 0.5 * I) * (s16 === 0 ? 1 : 0.6), s16 === 0 ? 0.3 : -0.3);
    } else if (kind === 'epic') {
      if (s16 === 0 && (beat === 1 || beat === 3) && I > 0.45) hit(ts, 0.3, (tau, i) => { const x = nz[(i * 2) % SR]; return (SIN(TAU * 190 * tau) * EXP(-tau / 0.05) * 0.7 + x * EXP(-tau / 0.07) * 0.8) * smooth(tau / 0.001); }, 0.55 * (0.4 + 0.6 * I), 0.05);
      if (s16 === 0 && beat === 0 && I > 0.55) hit(ts, 1.0, (tau, i) => { const x = nz[(i * 7) % SR]; let ph = TAU * (62 + 40 * EXP(-tau / 0.05)) * tau; return (SIN(ph) * EXP(-tau / 0.5) + 0.3 * SIN(2 * ph) * EXP(-tau / 0.2) + x * EXP(-tau / 0.012) * 0.6) * smooth(tau / 0.002); }, 0.9 * (0.5 + 0.5 * I), 0);
      if (I > 0.85 && beat === 3 && s16 >= 1) hit(ts, 0.35, (tau) => (SIN(TAU * (82 - 12 * s16) * tau) * EXP(-tau / 0.12)) * smooth(tau / 0.002), 0.5, s16 % 2 ? -0.4 : 0.4); // tom roll
      if (s16 === 0 && beat === 0 && modI(bi, 4) === 0 && I > 0.7) { // cymbal swell into the chord change
        hit(ts - 1.2, 3.2, (tau, i) => { const x = nz[(i * 11) % SR]; hz2 += 0.6 * (x - hz2); const e = tau < 1.2 ? POW(tau / 1.2, 2.5) : EXP(-(tau - 1.2) / 0.8); return (x - hz2) * e; }, 0.22 * I, 0);
      }
    }
  }
  normPk(L, R, kind === 'epic' ? -14 : kind === 'tense' ? -21 : -24);
  return [L, R];
}

/** render one chapter's music into stereo buffers covering [T0, T0 + n/SR]. Returns [L,R]. */
function renderMusic(ch, T0, n, env, ik, seedBase) {
  const cfg = MOODS[ch.mood], rnd = mulberry32(seedBase), dry = { L: new Float32Array(n), R: new Float32Array(n) }, low = { L: new Float32Array(n), R: new Float32Array(n) };
  const addL = (dst, [a, b], g = 1) => { for (let i = 0; i < n; i++) { dst.L[i] += a[i] * g; dst.R[i] += b[i] * g; } };
  addL(dry, layerPad(cfg, T0, n, ik));
  if (cfg.arp) addL(dry, layerArp(cfg, T0, n, ik, rnd));
  if (cfg.drone !== null) addL(low, layerDrone(cfg, T0, n, ik));
  if (cfg.kick !== null) addL(low, layerKick(cfg, T0, n, ik, cfg.drums === 'epic'));
  if (cfg.pulse8 !== null) addL(low, layerPulse8(cfg, T0, n, ik));
  let drums = null; if (cfg.drums) drums = layerDrums(cfg, T0, n, ik, rnd);
  if (drums) addL(low, drums, 0.9);
  const send = new Float32Array(n);
  for (let i = 0; i < n; i++) send[i] = 0.5 * (dry.L[i] + dry.R[i]) + (drums ? 0.3 * 0.5 * (drums[0][i] + drums[1][i]) : 0);
  const [wl, wr] = convWet(send, 0);
  const lv = db2g(cfg.lvl), L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const e = env[i] * lv;
    L[i] = (dry.L[i] + wl[i] * cfg.rv * 0.42 / 0.42 * 0.42 + low.L[i]) * e; R[i] = (dry.R[i] + wr[i] * cfg.rv * 0.42 / 0.42 * 0.42 + low.R[i]) * e;
  }
  return [L, R];
}

/** mood riser (hook riser code generalised): returns [L,R] normalised */
function riserSig(rnd, len, scale) {
  const n = Math.round(len * SR), nL = white(rnd, n), nR = white(rnd, n);
  const fc = (t) => 450 * POW(9500 / 450, POW(clamp(t / len, 0, 1), 1.4));
  const bL = filt(nL, 'bp', fc, 1.3), bR = filt(nR, 'bp', fc, 1.3), tl = new Float32Array(n), tr = new Float32Array(n);
  const f0 = 220, f1 = 880; let pa = 0, pb = 0, pc = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n, f = f0 * POW(f1 / f0, u * u * 0.4 + u * 0.6), dt = f / SR;
    pa += dt; pb += f * 1.006 / SR; pc += f * 0.994 / SR; pa %= 1; pb %= 1; pc %= 1;
    tl[i] = blepSaw(pa, dt) * 0.6 + blepSaw(pb, dt) * 0.4; tr[i] = blepSaw(pa, dt) * 0.6 + blepSaw(pc, dt) * 0.4;
  }
  const fT = (t) => 700 + 3600 * POW(clamp(t / len, 0, 1), 1.5), tfL = filt(tl, 'lp', fT, 1.0), tfR = filt(tr, 'lp', fT, 1.0);
  const l = new Float32Array(n), r = new Float32Array(n), nn = db2g(-1) / (peakOf(bL, bR) || 1), nt = 0.45 / (peakOf(tfL, tfR) || 1);
  for (let i = 0; i < n; i++) {
    const u = i / n, tail = Math.min(1, (n - i) / (0.03 * SR)), amp = POW(u, 2.3) * tail * smooth(i / (0.02 * SR));
    l[i] = (bL[i] * nn + tfL[i] * nt * 0.55) * amp; r[i] = (bR[i] * nn + tfR[i] * nt * 0.55) * amp;
  }
  normPeak(l, r, 0.34 * scale);
  return [l, r];
}

// ------------------------------------------------------------------ AMBIENCE ENGINE (per chapter bed)
function babble(rnd, n, lanes) { // formant-ish crowd murmur: pink noise through bands with slow random AM
  const o = new Float32Array(n);
  for (const [fc, q, rate, depth] of lanes) {
    const b = filt(pink(rnd, n), 'bp', fc, q), m = smoothRand(rnd, n, rate);
    for (let i = 0; i < n; i++) o[i] += b[i] * (1 - depth + depth * m[i] * m[i] * 2);
  }
  return o;
}
function renderAmbience(ch, T0, n, env, seed) {
  const rnd = mulberry32(seed), L = new Float32Array(n), R = new Float32Array(n), type = ch.amb;
  const comp = (sigL, sigR, dB, modFn) => { const nl = db2g(dB) / (rmsOf(sigL) || 1), nr = db2g(dB) / (rmsOf(sigR) || 1); for (let i = 0; i < n; i++) { const m = modFn ? modFn(i / SR) : 1; L[i] += sigL[i] * nl * m; R[i] += sigR[i] * nr * m; } };
  const gust = (t) => 0.55 + 0.45 * SIN(t * 1.3) * SIN(t * 0.47 + 1);
  const events = (rate, fn) => { let t = rnd() * rate; while (t < n / SR) { fn(t); t += rate * (0.5 + rnd()); } };
  const stamp = (arr, t0, sig, g) => { const s0 = Math.round(t0 * SR); for (let i = 0; i < sig.length; i++) { const k = s0 + i; if (k >= 0 && k < n) arr[k] += sig[i] * g; } };
  if (type === 'city') {
    comp(filt(pink(rnd, n), 'lp', 1100, 0.7), filt(pink(rnd, n), 'lp', 1100, 0.7), -37, (t) => 1 + 0.18 * SIN(t * 0.8) + 0.1 * SIN(t * 2.1 + 0.7));
    comp(filt(white(rnd, n), 'bp', (t) => 330 + 140 * SIN(t * 0.9) + 90 * SIN(t * 2.3 + 1), 0.9), filt(white(rnd, n), 'bp', (t) => 360 + 130 * SIN(t * 1.1 + 2) + 80 * SIN(t * 1.9), 0.9), -45, gust);
    const hum = filt(pink(rnd, n), 'lp', 170, 0.8); comp(hum, hum, -42);
    const tr = filt(pink(rnd, n), 'lp', 260, 0.7), mo = smoothRand(rnd, n, 0.15); comp(tr, filt(pink(rnd, n), 'lp', 260, 0.7), -41, (t) => 0.4 + 1.2 * mo[Math.min(n - 1, Math.round(t * SR))]);
    const ev = new Float32Array(n), evR = new Float32Array(n); // far car pass-bys
    events(7, (t) => { const len = 2.2 + rnd() * 1.5, m = Math.round(len * SR), nz = filt(white(rnd, m), 'bp', (u) => 380 + 340 * smooth(u / len), 1.0), s = new Float32Array(m); for (let i = 0; i < m; i++) { const u = i / m; s[i] = nz[i] * Math.sin(Math.PI * u) ** 2; } const p = rnd() * 2 - 1, [a, b] = panG(p); stamp(ev, t, s.map((v) => v * a), 1); stamp(evR, t, s.map((v) => v * b), 1); });
    const g = db2g(-42) / (Math.max(rmsOf(ev), 1e-9)); for (let i = 0; i < n; i++) { L[i] += ev[i] * Math.min(g, 3e3) * 0.0 + ev[i] * 0.05; R[i] += evR[i] * 0.05; }
  } else if (type === 'indoor') {
    const rt = filt(pink(rnd, n), 'lp', 600, 0.7); comp(rt, filt(pink(rnd, n), 'lp', 600, 0.7), -46);
    const hv = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; hv[i] = SIN(TAU * 60 * t) + 0.5 * SIN(TAU * 120 * t + 1) + 0.2 * SIN(TAU * 180 * t); } comp(hv, hv, -55);
    const ac = filt(white(rnd, n), 'bp', 220, 0.6); comp(ac, filt(white(rnd, n), 'bp', 240, 0.6), -52, (t) => 0.7 + 0.3 * SIN(t * 0.3));
  } else if (type === 'casino') {
    const bb = babble(rnd, n, [[550, 1.0, 4, 0.7], [1500, 1.3, 5, 0.7], [2800, 1.5, 6, 0.6]]), bb2 = babble(rnd, n, [[500, 1.0, 3.5, 0.7], [1700, 1.3, 5.5, 0.7], [3100, 1.5, 6, 0.6]]);
    comp(bb, bb2, -36);
    const hum = filt(pink(rnd, n), 'lp', 140, 0.8); comp(hum, hum, -46);
    const sl = new Float32Array(n), slR = new Float32Array(n); // slot machine blips
    events(0.35, (t) => { const f = 1300 + rnd() * 2400, m = Math.round(0.09 * SR), s = new Float32Array(m); for (let i = 0; i < m; i++) { const tt = i / SR; s[i] = (SIN(TAU * f * tt) + SIN(TAU * f * 1.5 * (tt < 0.045 ? 1 : 1.25) * tt) * 0.5) * EXP(-tt / 0.03); } const [a, b] = panG(rnd() * 2 - 1), g = (0.2 + rnd() * 0.5) * 0.0035; stamp(sl, t, s.map((v) => v * a), g); stamp(slR, t, s.map((v) => v * b), g); });
    for (let i = 0; i < n; i++) { L[i] += sl[i]; R[i] += slR[i]; }
  } else if (type === 'arena') {
    const r1 = filt(pink(rnd, n), 'bp', 500, 0.5), r2 = filt(pink(rnd, n), 'bp', 560, 0.5), sw = smoothRand(rnd, n, 0.3);
    comp(r1, r2, -34, (t) => 0.6 + 0.8 * sw[Math.min(n - 1, Math.round(t * SR))]);
    comp(filt(white(rnd, n), 'bp', 3000, 0.6), filt(white(rnd, n), 'bp', 3200, 0.6), -48);
    const lo = filt(pink(rnd, n), 'lp', 120, 0.8); comp(lo, lo, -42);
  } else if (type === 'wind') {
    comp(filt(white(rnd, n), 'bp', (t) => 420 + 200 * SIN(t * 0.7) + 120 * SIN(t * 1.9), 0.8), filt(white(rnd, n), 'bp', (t) => 460 + 180 * SIN(t * 0.6 + 1) + 100 * SIN(t * 2.3), 0.8), -34, (t) => 0.3 + 0.7 * gust(t) ** 1.3);
    const wsm = smoothRand(rnd, n, 0.2); comp(filt(white(rnd, n), 'bp', (t) => 900 + 300 * wsm[Math.min(n - 1, Math.round(t * SR))], 14), filt(white(rnd, n), 'bp', (t) => 1050 + 300 * wsm[Math.min(n - 1, Math.round(t * SR))], 14), -54, (t) => gust(t) ** 2);
    const hw = filt(pink(rnd, n), 'lp', 200, 0.7); comp(hw, hw, -40);
  } else if (type === 'crowd') {
    comp(babble(rnd, n, [[450, 0.9, 4, 0.6], [1300, 1.1, 5, 0.6], [2500, 1.4, 6, 0.5]]), babble(rnd, n, [[480, 0.9, 4, 0.6], [1400, 1.1, 5, 0.6], [2700, 1.4, 6, 0.5]]), -35);
    const lo = filt(pink(rnd, n), 'lp', 150, 0.7); comp(lo, lo, -44);
    comp(filt(white(rnd, n), 'hp', 4500, 0.7), filt(white(rnd, n), 'hp', 4500, 0.7), -58, (t) => 0.5 + 0.5 * gust(t));
  } else if (type === 'void') {
    const sub = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; sub[i] = SIN(TAU * 38 * t + 0.5 * SIN(TAU * 0.09 * t)) + 0.6 * SIN(TAU * 57 * t) * (0.7 + 0.3 * SIN(TAU * 0.13 * t)); }
    comp(sub, sub.slice(), -43);
    comp(filt(white(rnd, n), 'hp', 6000, 0.7), filt(white(rnd, n), 'hp', 6000, 0.7), -60, (t) => 0.5 + 0.5 * SIN(t * 0.4));
    comp(filt(pink(rnd, n), 'bp', 1200, 4), filt(pink(rnd, n), 'bp', 1250, 4), -54, (t) => 0.4 + 0.6 * (0.5 + 0.5 * SIN(t * 0.35)));
  } else { // quiet
    const rt = filt(pink(rnd, n), 'lp', 300, 0.7); comp(rt, filt(pink(rnd, n), 'lp', 300, 0.7), -53);
    comp(filt(white(rnd, n), 'hp', 5000, 0.7), filt(white(rnd, n), 'hp', 5000, 0.7), -66);
  }
  for (let i = 0; i < n; i++) { L[i] *= env[i]; R[i] *= env[i]; }
  return [L, R];
}

// ------------------------------------------------------------------ SFX SYNTH TABLE  S[type](cue, rnd)  (every type of the CONTRACT_FULL vocabulary; hook types are ports of sfx.mjs)
const S = {};
const mk = (len, fn) => { const n = Math.max(1, Math.round(len * SR)), o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = fn(i / SR, i, n); return o; };
const ex = (t, tau) => EXP(-t / tau);
const at = (t, a) => smooth(t / a);
const LEN = (c, d, lo = 0.05, hi = 30) => clamp(Number.isFinite(+c.len) && +c.len > 0 ? +c.len : d, lo, hi);
const stamp = (dst, t0, src, g = 1) => { const s0 = Math.round(t0 * SR); for (let i = 0; i < src.length; i++) { const k = s0 + i; if (k >= dst.length) break; if (k >= 0) dst[k] += src[i] * g; } };
const fio = (s, a = 0.02, b = 0.06) => { const n = s.length, A = Math.round(a * SR), B = Math.round(b * SR); for (let i = 0; i < n; i++) { let g = 1; if (i < A) g = i / A; const r = n - 1 - i; if (r < B) g *= r / B; s[i] *= g; } return s; };
/** sum of decaying sines: modes [[f, amp, tau]] */
function modal(len, modes, att = 0.0008) {
  const n = Math.max(1, Math.round(len * SR)), o = new Float32Array(n);
  for (const [f, a, tau] of modes) { const m = Math.min(n, Math.round(tau * 7 * SR)); for (let i = 0; i < m; i++) { const t = i / SR; o[i] += SIN(TAU * f * t) * a * EXP(-t / tau); } }
  const A = Math.min(n, Math.round(att * SR)); for (let i = 0; i < A; i++) o[i] *= i / A;
  return o;
}
const emit = (s, pk, o = {}) => { const [l, r] = pan2(s, o.pan ?? 0); normPeak(l, r, pk); if (o.split) splitPut(l, r, o.send ?? 0, o.split, o.hiBus || 'hit', o.dt || 0); else put(l, r, o.send ?? 0, o.bus || 'sfx', o.dt || 0); };
const emitS = (L, R, pk, o = {}) => { normPeak(L, R, pk); if (o.split) splitPut(L, R, o.send ?? 0, o.split, o.hiBus || 'hit', o.dt || 0); else put(L, R, o.send ?? 0, o.bus || 'sfx', o.dt || 0); };
const sgn = (r) => (r() < 0.5 ? -1 : 1);

// ---------- crowd voices: K glottal saws -> shared parallel formant filters (vowel morph), per-voice envelopes
const FORM = { a: [730, 1090, 2440], e: [530, 1840, 2480], o: [570, 840, 2410], i: [270, 2290, 3010], u: [300, 870, 2240] };
function choir(rnd, len, o) { // returns [L,R] (not normalised). o: k,f0[lo,hi],v[from,to],voiceEnv(rnd)->fn(t),pitch(t),vib,breath,env(t),spread
  const n = Math.round(len * SR), outs = [];
  const v0 = FORM[o.v[0]], v1 = FORM[o.v[1] || o.v[0]], Q = [5, 7, 9], G = [1, 0.55, 0.28];
  for (let g = 0; g < 2; g++) {
    const src = new Float32Array(n);
    for (let k = 0; k < (o.k || 6); k++) {
      const f0 = mix(o.f0[0], o.f0[1], rnd()), vr = 4.5 + rnd() * 2.2, vd = o.vib ?? 0.012, on = rnd() * (o.spread ?? 0.2), amp = 0.6 + rnd() * 0.4;
      const ve = o.voiceEnv ? o.voiceEnv(rnd, on) : (t) => smooth((t - on) / 0.08);
      let ph = rnd();
      for (let i = 0; i < n; i++) {
        const t = i / SR, e = ve(t); if (e <= 0.0005) { ph += f0 / SR; ph -= Math.floor(ph); continue; }
        const f = f0 * (o.pitch ? o.pitch(t) : 1) * (1 + vd * SIN(TAU * vr * t + k)), dt = f / SR;
        ph += dt; ph -= Math.floor(ph);
        src[i] += blepSaw(ph, Math.min(0.4, dt)) * amp * e;
      }
    }
    const br = o.breath ?? 0.3, nz = white(rnd, n), acc = new Float32Array(n);
    for (let i = 0; i < n; i++) src[i] += nz[i] * br * 0.35 * (o.env ? o.env(i / SR) : 1);
    for (let j = 0; j < 3; j++) {
      const f = filt(src, 'bp', (t) => mix(v0[j], v1[j], smooth(t / len)) * (0.96 + 0.08 * g), Q[j]);
      for (let i = 0; i < n; i++) acc[i] += f[i] * G[j];
    }
    if (o.env) for (let i = 0; i < n; i++) acc[i] *= o.env(i / SR);
    outs.push(acc);
  }
  return outs;
}
const applause = (rnd, len, dens, fc = 2200) => { // many random hand-claps, noise bursts through a band
  const n = Math.round(len * SR), s = new Float32Array(n), clap = mk(0.03, (t) => (rnd() * 2 - 1) * ex(t, 0.007));
  const cnt = Math.round(len * dens);
  for (let k = 0; k < cnt; k++) stamp(s, rnd() * len, clap, 0.3 + rnd() * 0.7);
  return filt(s, 'bp', fc, 0.6);
};

// ---------- movement
const stepSig = (rnd, v = 1) => {
  const n = Math.round(0.22 * SR), nz = white(rnd, n), b = filt(nz, 'bp', 650 * v, 0.9), s = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (90 * v + 45 * ex(t, 0.02)) / SR; s[i] = b[i] * at(t, 0.003) * ex(t, 0.04) * 1.3 + SIN(ph) * ex(t, 0.045) * 0.8; }
  return s;
};
S.step = (c, rnd) => { // port of sfx.mjs
  const v = 0.9 + 0.25 * 0; const n = Math.round(0.22 * SR), nz = white(rnd, n), vv = 0.9 + rnd() * 0.25; void v;
  const b = filt(nz, 'bp', 650 * vv, 0.9), s = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (90 * vv + 45 * ex(t, 0.02)) / SR; s[i] = b[i] * at(t, 0.003) * ex(t, 0.04) * 1.3 + SIN(ph) * ex(t, 0.045) * 0.8; }
  const side = (Math.round(c.t * 100) % 24 < 12) ? -0.22 : 0.22, [l, r] = pan2(s, side);
  normPeak(l, r, 0.2); put(l, r, 0.08);
};
const footfalls = (rnd, count, gap, jitter, pk, runLike) => {
  const len = count * gap + 0.4, s = new Float32Array(Math.round(len * SR)), sl = new Float32Array(s.length), sr = new Float32Array(s.length);
  for (let k = 0; k < count; k++) {
    const st = stepSig(rnd, (0.85 + rnd() * 0.35) * (runLike ? 1.1 : 1)), t0 = k * gap + (rnd() - 0.5) * jitter, side = k % 2 ? 0.25 : -0.25, [a, b] = panG(side), g = 0.8 + rnd() * 0.4;
    stamp(sl, Math.max(0, t0), st, g * a); stamp(sr, Math.max(0, t0), st, g * b);
  }
  void s; emitS(sl, sr, pk, { send: 0.08 });
};
S.stepRun = (c, rnd) => footfalls(rnd, clamp(Math.round(c.n ?? 4), 1, 40), 0.26, 0.03, 0.22, true);
S.footstepsRun = (c, rnd) => { const len = LEN(c, 2.0), gap = 0.27; footfalls(rnd, Math.max(1, Math.round(len / gap)), gap, 0.03, 0.22, true); };
S.whoosh = (c, rnd) => {
  const vz = CUR.varied, k1 = vz ? 0.75 + 0.5 * rnd() : 1, k2 = vz ? 0.75 + 0.5 * rnd() : 1, ex1 = vz ? 0.7 + 0.4 * rnd() : 0.8; // per-instance band centres / sweep shape (not for the hook)
  const len = LEN(c, vz ? 0.5 + 0.2 * rnd() : 0.6), n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', (t) => 350 * k1 * POW(7, SIN(PI * clamp(t / len, 0, 1)) ** ex1) , 0.9), b = filt(pink(rnd, n), 'bp', (t) => 700 * k2 * POW(4, SIN(PI * clamp(t / len, 0, 1))), 1.1);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = i / n, e = POW(SIN(PI * u), 1.5); L[i] = (a[i] * 0.8 + b[i]) * e; R[i] = (b[i] * 0.8 + a[i]) * e; }
  emitS(L, R, 0.26, { send: 0.12 });
};
S.whooshFast = (c, rnd) => {
  const len = LEN(c, 0.4), n = Math.round(len * SR), pk = len * 0.5;
  const a = filt(white(rnd, n), 'bp', (t) => 2200 - 1500 * smooth((t - pk * 0.6) / (len * 0.6)), 1.2), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, d = t - pk; s[i] = a[i] / POW(1 + (d / (len * 0.2)) ** 2, 1.0) * at(t, 0.02); }
  emit(s, 0.3, { pan: (t) => Math.tanh((t - pk) / (len * 0.2)) * 0.9, send: 0.1 });
};
S.swish = (c, rnd) => { const n = Math.round(0.2 * SR), a = filt(white(rnd, n), 'bp', (t) => 1800 + 4500 * smooth(t / 0.15), 1.3), s = mk(0.2, (t, i) => a[i] * POW(SIN(PI * clamp(t / 0.2, 0, 1)), 1.4)); emit(s, 0.12, { pan: rnd() * 0.6 - 0.3, send: 0.05 }); };
S.jump = (c, rnd) => { const n = Math.round(0.28 * SR), a = filt(white(rnd, n), 'bp', (t) => 500 + 1500 * smooth(t / 0.15), 1.0); let ph = 0; const s = mk(0.28, (t, i) => { ph += TAU * (110 + 140 * smooth(t / 0.1)) / SR; return a[i] * ex(t, 0.07) * at(t, 0.01) * 0.6 + SIN(ph) * ex(t, 0.08) * at(t, 0.006) * 0.6; }); emit(s, 0.16, { send: 0.05 }); };
S.land = (c, rnd) => { const n = Math.round(0.35 * SR), a = filt(white(rnd, n), 'lp', 420, 0.8); let ph = 0; const s = mk(0.35, (t, i) => { ph += TAU * (62 + 55 * ex(t, 0.03)) / SR; return a[i] * ex(t, 0.05) * 1.2 + SIN(ph) * ex(t, 0.1) * at(t, 0.003); }); emit(s, 0.26, { split: 160, send: 0.08 }); };
S.slide = (c, rnd) => {
  const len = LEN(c, 0.7), n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', (t) => 1100 - 500 * (t / len), 0.9), b = filt(white(rnd, n), 'hp', 3000, 0.7);
  const s = mk(len, (t, i) => (a[i] * (0.7 + 0.5 * SIN(TAU * 38 * t) * SIN(TAU * 7 * t + 1)) + b[i] * 0.2) * at(t, 0.04) * (1 - smooth((t - len * 0.5) / (len * 0.5)) ** 0.7 * 0.9));
  emit(s, 0.2, { pan: 0.1, send: 0.06 });
};
S.skid = (c, rnd) => {
  const len = LEN(c, 0.8), n = Math.round(len * SR), nz = filt(white(rnd, n), 'bp', 2800, 2.5), wob = smoothRand(rnd, n, 14); let ph = 0, p2 = 0;
  const s = mk(len, (t, i) => { const f = 1450 - 380 * t / len + 90 * wob[i]; ph += TAU * f / SR; p2 += TAU * f * 2.01 / SR; return (SIN(ph) * 0.4 + SIN(p2) * 0.25 + Math.tanh(2 * SIN(ph * 1.5)) * 0.15 + nz[i] * 0.9) * at(t, 0.05) * (1 - smooth((t - len * 0.55) / (len * 0.45))) * (0.8 + 0.4 * wob[(i + 4000) % n]); });
  emit(s, 0.2, { pan: -0.15, send: 0.12 });
};
function passBy(rnd, len, pk, o) {
  const n = Math.round(len * SR), ratio = (tau) => 1 - o.dop * Math.tanh((tau - pk) / o.dw);
  const hi = filt(white(rnd, n), 'bp', (t) => o.hiF * ratio(t), o.hiQ), lo = filt(white(rnd, n), 'bp', (t) => o.loF * ratio(t), 0.8);
  const s = new Float32Array(n); let ph = 0, cp = 0, ce = 0;
  for (let i = 0; i < n; i++) {
    const tau = i / SR, d = tau - pk, rt = ratio(tau), A = 1 / POW(1 + (d / o.w) * (d / o.w), o.pw);
    ph += TAU * o.f0 * rt / SR;
    let tone = 0; for (let h = 1; h <= o.nh; h++) tone += SIN(h * ph) / POW(h, o.roll);
    if (o.am) tone *= 0.75 + 0.25 * SIN(TAU * o.am * tau);
    cp += (o.clickHz || 0) * rt / SR; if (cp >= 1) { cp -= 1; ce = 1; }
    const click = (rnd() * 2 - 1) * ce * 0.5; ce *= EXP(-1 / (0.0016 * SR));
    s[i] = (hi[i] * o.hiG + lo[i] * o.loG + tone * o.toneG + click) * A * at(tau, 0.05) * Math.min(1, (len - tau) / 0.22);
  }
  return s;
}
const pkOf = (c, len) => { let p = c.peak === undefined ? len * 0.5 : (c.peak >= c.t - 1e-6 ? c.peak - c.t : c.peak); return clamp(p, 0.05, len - 0.05); };
S.bikePass = (c, rnd) => { // port of sfx.mjs (same sound), generalised via passBy
  const len = c.len || 0.9, pk = pkOf(c, len);
  const s = passBy(rnd, len, pk, { dop: 0.19, dw: 0.075, hiF: 1500, hiQ: 1.1, loF: 520, w: 0.095, pw: 0.8, f0: 250, nh: 2, roll: 1.5, am: 0, hiG: 0.9, loG: 0.7, toneG: 0.16, clickHz: 30 });
  const [l, r] = pan2(s, (tau) => Math.tanh((tau - pk) / 0.13) * 0.85); normPeak(l, r, 0.22); put(l, r, 0.1);
};
S.vehiclePass = (c, rnd) => {
  const len = LEN(c, 2.6), pk = pkOf(c, len), pit = clamp(+c.pitch || 1, 0.4, 2.5);
  const s = passBy(rnd, len, pk, { dop: 0.15, dw: 0.28, hiF: 2600, hiQ: 0.8, loF: 380, w: 0.38, pw: 0.9, f0: 92 * pit, nh: 9, roll: 1.05, am: 0, hiG: 0.5, loG: 1.0, toneG: 0.28 });
  emit(s, 0.3, { pan: (tau) => Math.tanh((tau - pk) / (len * 0.12)) * 0.85, send: 0.1 });
};
S.truckPass = (c, rnd) => {
  const len = LEN(c, 3.4), pk = pkOf(c, len);
  const s = passBy(rnd, len, pk, { dop: 0.1, dw: 0.4, hiF: 2000, hiQ: 0.7, loF: 220, w: 0.55, pw: 0.85, f0: 47, nh: 14, roll: 0.9, am: 11, hiG: 0.55, loG: 1.3, toneG: 0.35 });
  emit(s, 0.38, { pan: (tau) => Math.tanh((tau - pk) / (len * 0.14)) * 0.8, split: 140, send: 0.1 });
};
S.carHorn = (c, rnd) => {
  const len = LEN(c, 0.55), nz = white(rnd, Math.round(len * SR)); let p1 = 0, p2 = 0;
  const s0 = mk(len, (t, i) => { p1 += TAU * 410 / SR; p2 += TAU * 512 / SR; return (Math.tanh(2.2 * SIN(p1)) + Math.tanh(2.2 * SIN(p2)) * 0.9 + nz[i] * 0.04) * at(t, 0.012) * (len - t < 0.04 ? (len - t) / 0.04 : 1); });
  const s = filt(s0, 'lp', 3600, 0.7); emit(s, 0.2, { pan: 0.2, send: 0.12 });
};
S.truckHorn = (c, rnd) => {
  const len = LEN(c, 1.3), nz = white(rnd, Math.round(len * SR)); let p1 = 0, p2 = 0, p3 = 0;
  const s0 = mk(len, (t, i) => { p1 += TAU * 178 / SR; p2 += TAU * 224 / SR; p3 += TAU * 356 / SR; return (Math.tanh(2.8 * SIN(p1)) + Math.tanh(2.8 * SIN(p2)) * 0.9 + 0.35 * SIN(p3) + nz[i] * 0.05) * at(t, 0.05) * (len - t < 0.12 ? (len - t) / 0.12 : 1); });
  const s = filt(s0, 'lp', 2400, 0.7); emit(s, 0.28, { pan: -0.1, split: 120, send: 0.18 });
};
S.skateboardRoll = (c, rnd) => {
  const len = LEN(c, 1.5), n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', 900, 0.7), b = filt(white(rnd, n), 'lp', 260, 0.7), wob = smoothRand(rnd, n, 9);
  const s = mk(len, (t, i) => (a[i] * (0.6 + 0.4 * SIN(TAU * 21 * t)) * (0.6 + 0.6 * wob[i]) + b[i] * 0.8) * at(t, 0.1));
  const tk = new Float32Array(n), click = mk(0.01, (t) => (rnd() * 2 - 1) * ex(t, 0.002));
  for (let t0 = 0.1; t0 < len; t0 += 0.17 + rnd() * 0.12) stamp(tk, t0, click, 1.0 + rnd());
  for (let i = 0; i < n; i++) s[i] += tk[i] * 0.45;
  fio(s, 0.05, 0.12); emit(s, 0.14, { pan: 0.1, send: 0.05 });
};
S.skateboardSlam = (c, rnd) => {
  const n = Math.round(0.6 * SR), cr = filt(white(rnd, n), 'bp', 1900, 0.7), lo = filt(white(rnd, n), 'lp', 300, 0.8), s = mk(0.6, (t, i) => cr[i] * ex(t, 0.02) * 0.9 + lo[i] * ex(t, 0.06) * 0.9 + SIN(TAU * 150 * t) * ex(t, 0.07) * at(t, 0.003));
  const rat = new Float32Array(n), rt = modal(0.2, [[3400, 1, 0.012], [5200, 0.6, 0.008]]);
  for (let k = 0; k < 6; k++) stamp(rat, 0.07 + k * 0.045 + rnd() * 0.02, rt, 0.8 * ex(k, 4));
  for (let i = 0; i < n; i++) s[i] += rat[i] * 0.4;
  emit(s, 0.36, { split: 150, send: 0.12 });
};

// ---------- impacts
S.thump = (c, rnd) => { // port
  const n = Math.round(0.4 * SR), s = new Float32Array(n), nz = filt(white(rnd, n), 'lp', 350, 0.8); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (46 + 36 * ex(t, 0.05)) / SR; s[i] = SIN(ph) * ex(t, 0.09) * at(t, 0.004) + nz[i] * ex(t, 0.06) * 0.9; }
  const [l, r] = pan2(s, 0.2); normPeak(l, r, 0.5); put(l, r, 0, 'low');
};
const bodyHit = (rnd, f0, sub, slap, len = 0.3) => {
  const n = Math.round(len * SR), lo = filt(white(rnd, n), 'lp', 520, 0.8), sl = filt(white(rnd, n), 'bp', 1500, 0.9); let ph = 0;
  return mk(len, (t, i) => { ph += TAU * (f0 + f0 * 0.6 * ex(t, 0.025)) / SR; return SIN(ph) * ex(t, 0.09) * at(t, 0.003) * sub + lo[i] * ex(t, 0.05) * 0.9 + sl[i] * ex(t, 0.012) * slap; });
};
S.hit = (c, rnd) => emit(bodyHit(rnd, 80, 1.0, 0.6), 0.4, { split: 160, send: 0.08 });
S.punch = (c, rnd) => { const s = bodyHit(rnd, 95, 0.9, 1.2, 0.28), n = s.length, sn = filt(white(rnd, n), 'bp', 2600, 0.8); for (let i = 0; i < n; i++) s[i] += sn[i] * ex(i / SR, 0.008) * 0.5; emit(s, 0.44, { split: 160, send: 0.1 }); };
S.punchMiss = (c, rnd) => { const n = Math.round(0.28 * SR), a = filt(white(rnd, n), 'bp', (t) => 1500 - 800 * smooth(t / 0.2), 1.1), s = mk(0.28, (t, i) => a[i] * POW(SIN(PI * clamp(t / 0.28, 0, 1)), 1.3)); emit(s, 0.15, { pan: (t) => -0.4 + t * 2, send: 0.06 }); };
S.bigImpact = (c, rnd) => {
  const len = 3.2, n = Math.round(len * SR), L = new Float32Array(n), R = new Float32Array(n), nz = filt(white(rnd, n), 'lp', 700, 0.8), cr = filt(white(rnd, n), 'bp', 1700, 0.7); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (30 + 60 * ex(t, 0.08)) / SR; const v = Math.tanh(1.4 * SIN(ph)) * ex(t, 0.9) * at(t, 0.003) + nz[i] * ex(t, 0.25) * 0.5 + cr[i] * ex(t, 0.04) * 0.5; L[i] = v; R[i] = v; }
  [[1, 0.4, 1.3], [1.51, 0.3, 1.0], [2.32, 0.22, 0.8], [3.18, 0.15, 0.55]].forEach(([q, a, d], k) => { const [gl, gr] = panG(k % 2 ? 0.3 : -0.3); for (let i = 0; i < n; i++) { const t = i / SR, v = SIN(TAU * 150 * q * t) * ex(t, d) * a * 0.3; L[i] += v * gl; R[i] += v * gr; } });
  emitS(L, R, 0.55, { split: 180, send: 0.45 });
};
S.boom = (c, rnd) => {
  const len = LEN(c, 2.5), n = Math.round(len * SR), nz = filt(white(rnd, n), 'lp', 450, 0.8); let ph = 0;
  const s = mk(len, (t, i) => { ph += TAU * (34 + 50 * ex(t, 0.07)) / SR; return (Math.tanh(1.5 * SIN(ph)) * ex(t, len * 0.28) * at(t, 0.004) + nz[i] * ex(t, 0.2) * 0.6); });
  fio(s, 0.002, 0.05); emit(s, 0.5, { split: 170, send: 0.3 });
};
S.cutHit = (c, rnd) => { // port
  const n = Math.round(1.0 * SR), s = new Float32Array(n), nz = white(rnd, n), pr = filt(white(rnd, n), 'lp', 800, 0.8), sn = filt(nz, 'bp', 2100, 0.8); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (52 + 75 * ex(t, 0.035)) / SR; s[i] = SIN(ph) * ex(t, 0.28) * at(t, 0.003) + sn[i] * ex(t, 0.012) * 1.1 + pr[i] * ex(t, 0.12) * 0.7; }
  const [l, r] = pan2(s, 0); normPeak(l, r, 0.34); splitPut(l, r, 0.3);
};
S.flashHit = (c, rnd) => { // port
  const n = Math.round(1.3 * SR), s = new Float32Array(n), nz = filt(white(rnd, n), 'hp', 150, 0.7); let ph = 0, ph2 = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (58 + 80 * ex(t, 0.05)) / SR; ph2 += TAU * (90 + 1700 * ex(t, 0.055)) / SR; s[i] = nz[i] * ex(t, 0.07) * 0.9 + SIN(ph) * ex(t, 0.33) * 1.1 * at(t, 0.003) + SIN(ph2) * ex(t, 0.12) * 0.5; }
  for (let k = 0; k < 8; k++) {
    const t0 = 0.012 + k * 0.017 + rnd() * 0.006, f = 300 + rnd() * 2100, dur = 0.011 + rnd() * 0.008, amp = 0.32 * (k % 2 ? 1 : 0.7);
    for (let i = Math.round(t0 * SR); i < Math.min(n, Math.round((t0 + dur) * SR)); i++) { const t = i / SR - t0, sq = SIN(TAU * f * t) > 0 ? 1 : -1; s[i] += Math.round(sq * 4) / 4 * amp * (1 - t / dur); }
  }
  const [l, r] = pan2(s, 0); normPeak(l, r, 0.40); splitPut(l, r, 0.5);
};
S.titleImpact = (c, rnd) => { // port (len from cue; hook: TL.DUR - t)
  const len = LEN(c, 2.4, 0.3), n = Math.round(len * SR), L = new Float32Array(n), R = new Float32Array(n); let ph = 0, ph2 = 0;
  const crack = filt(white(rnd, n), 'bp', 1900, 0.6), body = filt(white(rnd, n), 'lp', 650, 0.8), sizzle = filt(white(rnd, n), 'hp', 6500, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * (55 + 95 * ex(t, 0.06)) / SR; ph2 += TAU * (110 + 150 * ex(t, 0.05)) / SR;
    const boom = Math.tanh(1.35 * SIN(ph)) * ex(t, 0.7) * at(t, 0.003) + 0.4 * SIN(ph2) * ex(t, 0.5) * at(t, 0.003);
    const v = boom + crack[i] * ex(t, 0.05) * 0.55 + body[i] * ex(t, 0.22) * 0.35 + sizzle[i] * ex(t, 0.55) * 0.09; L[i] = v; R[i] = v;
  }
  const ratios = [1, 1.51, 2.32, 3.18, 4.27, 5.43], amps = [0.5, 0.42, 0.34, 0.24, 0.17, 0.11], decs = [1.5, 1.2, 0.95, 0.75, 0.55, 0.4];
  ratios.forEach((q, k) => { for (let d = 0; d < 2; d++) { const f = 196 * q * (d ? 1.004 : 1), [gl, gr] = panG((k % 2 ? 1 : -1) * (0.25 + 0.1 * d)); const m = Math.min(n, Math.round(decs[k] * 7 * SR)); for (let i = 0; i < m; i++) { const t = i / SR, v = SIN(TAU * f * t) * ex(t, decs[k]) * amps[k] * 0.2 * at(t, 0.002); L[i] += v * gl; R[i] += v * gr; } } });
  normPeak(L, R, 0.5); splitPut(L, R, 0.5);
};
S.crack = (c, rnd) => {
  const n = Math.round(0.7 * SR), cr = filt(white(rnd, n), 'bp', 3300, 0.6), bd = filt(white(rnd, n), 'bp', 420, 1.0), s = mk(0.7, (t, i) => cr[i] * ex(t, 0.012) * 1.2 + bd[i] * ex(t, 0.08) * 0.8 + SIN(TAU * 95 * t) * ex(t, 0.06) * at(t, 0.003) * 0.6);
  const sp = new Float32Array(n), tk = modal(0.1, [[2400, 1, 0.01]]);
  for (let k = 0; k < 7; k++) stamp(sp, 0.03 + rnd() * 0.3, tk, 0.4 * rnd());
  for (let i = 0; i < n; i++) s[i] += sp[i] * 0.5;
  emit(s, 0.42, { split: 140, send: 0.12 });
};
const shards = (rnd, len, count, fLo, fHi, tauLo, tauHi, spread) => {
  const s = new Float32Array(Math.round(len * SR));
  for (let k = 0; k < count; k++) { const f = fLo + (fHi - fLo) * rnd(), tau = tauLo + (tauHi - tauLo) * rnd(); stamp(s, 0.004 + POW(rnd(), 1.7) * spread, modal(tau * 7, [[f, 0.5 + rnd() * 0.5, tau], [f * 2.76, 0.25, tau * 0.45]]), 0.3 + rnd() * 0.7); }
  return s;
};
S.glassBreak = (c, rnd) => {
  const len = 1.8, n = Math.round(len * SR), cr = filt(white(rnd, n), 'hp', 2500, 0.7), s = shards(rnd, len, 46, 2300, 9000, 0.06, 0.32, 0.8);
  for (let i = 0; i < n; i++) { const t = i / SR; s[i] = s[i] * 0.55 + cr[i] * ex(t, 0.035) * 1.1 * at(t, 0.0006); }
  emit(s, 0.34, { pan: 0.05, send: 0.25 });
};
S.ceramicBreak = (c, rnd) => {
  const len = 1.2, n = Math.round(len * SR), cr = filt(white(rnd, n), 'bp', 2400, 0.7), s = shards(rnd, len, 26, 900, 3600, 0.025, 0.1, 0.45);
  for (let i = 0; i < n; i++) { const t = i / SR; s[i] = s[i] * 0.6 + cr[i] * ex(t, 0.02) * 1.0 + SIN(TAU * 160 * t) * ex(t, 0.05) * at(t, 0.003) * 0.5; }
  emit(s, 0.34, { send: 0.18, split: 130 });
};
S.catchSoft = (c, rnd) => { const n = Math.round(0.2 * SR), a = filt(white(rnd, n), 'lp', 1100, 0.8), s = mk(0.2, (t, i) => a[i] * ex(t, 0.025) * at(t, 0.002) + SIN(TAU * 170 * t) * ex(t, 0.04) * 0.6 * at(t, 0.003)); emit(s, 0.2, { split: 120, send: 0.05 }); };
S.clink = (c, rnd) => { const f = 2100 + rnd() * 500; emit(modal(0.8, [[f, 1, 0.22], [f * 1.5, 0.35, 0.12], [f * 2.52, 0.4, 0.09], [f * 3.9, 0.15, 0.05]], 0.0006), 0.2, { pan: rnd() * 0.4 - 0.2, send: 0.2 }); };
S.ceramicClatter = (c, rnd) => {
  const len = 1.1, s = new Float32Array(Math.round(len * SR)); let t0 = 0, g = 1;
  for (let k = 0; k < 9; k++) { const f = 1100 + rnd() * 2200; stamp(s, t0, modal(0.15, [[f, 1, 0.03], [f * 1.9, 0.5, 0.015], [f * 3.1, 0.3, 0.01]]), g * (0.5 + 0.5 * rnd())); t0 += 0.16 * POW(0.8, k) + rnd() * 0.02; g *= 0.85; }
  emit(s, 0.26, { send: 0.18 });
};

// ---------- sport / objects
const tok = (rnd, f, tau = 0.012, brightness = 1) => { const n = Math.round(0.12 * SR); return mk(0.12, (t) => (SIN(TAU * f * t) * 0.8 + SIN(TAU * f * 2.1 * t) * 0.4 * brightness) * ex(t, tau) + (rnd() * 2 - 1) * ex(t, 0.0015) * 0.5); void n; };
S.pingpongHit = (c, rnd) => {
  const cnt = clamp(Math.round(c.n ?? 1), 1, 30), gap = 0.24, s = new Float32Array(Math.round((cnt * gap + 0.3) * SR)), sl = s.slice();
  for (let k = 0; k < cnt; k++) { const w = tok(rnd, 1500 + rnd() * 300, 0.01); stamp(k % 2 ? sl : s, k * gap + (rnd() - 0.5) * 0.02, w, 0.7 + rnd() * 0.3); if (k % 2 === 1) { const b = tok(rnd, 1050, 0.007); stamp(s, k * gap + 0.11, b, 0.4); } }
  emitS(s, sl, 0.2, { send: 0.08 });
};
S.pingpongBounce = (c, rnd) => emit(tok(rnd, 1100 + rnd() * 200, 0.008, 0.6), 0.16, { send: 0.06 });
S.paddleHit = (c, rnd) => emit(tok(rnd, 1850, 0.014, 1), 0.22, { pan: 0.1, send: 0.08 });
S.bellRing = (c, rnd) => {
  const len = 2.6, s = new Float32Array(Math.round(len * SR)), modes = [[880, 1, 1.3], [1760 * 1.003, 0.6, 0.9], [2430, 0.55, 0.6], [3590, 0.4, 0.35], [4750, 0.25, 0.22]];
  const hit = modal(len, modes, 0.0006);
  for (let k = 0; k < 3; k++) stamp(s, k * 0.17, hit, k === 2 ? 1 : 0.8);
  const clk = mk(0.01, (t) => (rnd() * 2 - 1) * ex(t, 0.002)); for (let k = 0; k < 3; k++) stamp(s, k * 0.17, clk, 0.5);
  emit(s, 0.3, { send: 0.3 });
};
S.batCrack = (c, rnd) => { const n = Math.round(0.4 * SR), a = filt(white(rnd, n), 'bp', 2400, 0.6), s = mk(0.4, (t, i) => a[i] * ex(t, 0.006) * 1.1 + SIN(TAU * 1800 * t) * ex(t, 0.02) * 0.5 + SIN(TAU * 190 * t) * ex(t, 0.035) * 0.7 * at(t, 0.001) + SIN(TAU * 760 * t) * ex(t, 0.03) * 0.3); emit(s, 0.44, { split: 130, send: 0.2 }); };
S.ballSmack = (c, rnd) => { const n = Math.round(0.2 * SR), a = filt(white(rnd, n), 'bp', 950, 0.8), h = filt(white(rnd, n), 'hp', 3500, 0.7), s = mk(0.2, (t, i) => a[i] * ex(t, 0.02) * 1.0 + h[i] * ex(t, 0.006) * 0.4 + SIN(TAU * 210 * t) * ex(t, 0.03) * 0.8 * at(t, 0.002)); emit(s, 0.3, { split: 120, send: 0.08 }); };
S.rouletteSpin = (c, rnd) => {
  const len = LEN(c, 3.0), n = Math.round(len * SR), nz = filt(white(rnd, n), 'bp', 700, 0.8), whir = filt(pink(rnd, n), 'lp', 300, 0.8), tk = new Float32Array(n), t1 = modal(0.03, [[2600, 1, 0.005], [4100, 0.5, 0.003]]);
  for (let t = 0.05; t < len;) { stamp(tk, t, t1, 0.5 + rnd() * 0.5); t += (1 / (30 - 24 * (t / len))) * (0.8 + rnd() * 0.4); }
  const s = mk(len, (t, i) => (nz[i] * (0.5 + 0.5 * SIN(TAU * (26 - 16 * t / len) * t)) * 0.5 + whir[i] * 0.9 + tk[i] * 0.4) * (1 - 0.7 * smooth((t - len * 0.6) / (len * 0.4))));
  fio(s, 0.1, 0.4); emit(s, 0.15, { send: 0.12 });
};
S.rouletteBall = (c, rnd) => {
  const len = LEN(c, 3.0), s = new Float32Array(Math.round(len * SR)), t1 = modal(0.05, [[3000 + rnd() * 400, 1, 0.006], [5200, 0.4, 0.003]]);
  let t = 0.05, rate = 36; while (t < len * 0.8) { stamp(s, t, t1, 0.35 + 0.35 * (1 - t / len)); rate = 36 - 26 * (t / (len * 0.8)); t += (1 / rate) * (0.85 + rnd() * 0.3); }
  const ring = filt(white(rnd, s.length), 'bp', 3600, 2.0); for (let i = 0; i < s.length; i++) { const tt = i / SR; s[i] += ring[i] * 0.5 * (1 - smooth((tt - len * 0.1) / (len * 0.7))) * at(tt, 0.05); }
  const pk = len * 0.8; let tb = pk; for (let k = 0; k < 6; k++) { stamp(s, tb, modal(0.1, [[1700 + rnd() * 600, 1, 0.012], [3100, 0.5, 0.006]]), 0.9 * POW(0.65, k)); tb += 0.07 * (k + 1) * 0.9 + rnd() * 0.02; }
  emit(s, 0.22, { pan: -0.1, send: 0.15 });
};
S.chipStack = (c, rnd) => { const s = new Float32Array(Math.round(0.8 * SR)); let t0 = 0; for (let k = 0; k < 6; k++) { stamp(s, t0, modal(0.1, [[2200 + rnd() * 400, 1, 0.012], [3900, 0.6, 0.007], [900, 0.4, 0.02]]), 0.6 + 0.4 * rnd()); t0 += 0.04 + rnd() * 0.05; } emit(s, 0.22, { send: 0.1 }); };
S.coinDrop = (c, rnd) => {
  const s = new Float32Array(Math.round(1.6 * SR)); let t0 = 0, g = 1; const f = 2500 + rnd() * 400;
  for (let k = 0; k < 4; k++) { stamp(s, t0, modal(1.0, [[f, 1, 0.34], [f * 1.51, 0.5, 0.2], [f * 2.4, 0.35, 0.12], [f * 3.3, 0.2, 0.06]]), g); t0 += 0.18 * POW(0.55, k); g *= 0.55; }
  emit(s, 0.22, { pan: 0.15, send: 0.2 });
};
S.cashRegister = (c, rnd) => {
  const len = 1.9, s = new Float32Array(Math.round(len * SR)), n = Math.round(0.25 * SR), cl = filt(white(rnd, n), 'bp', 1400, 0.8);
  stamp(s, 0, mk(0.25, (t, i) => cl[i] * ex(t, 0.025) + SIN(TAU * 140 * t) * ex(t, 0.05) * 0.7), 0.8);
  stamp(s, 0.12, modal(1.5, [[2093, 1, 0.5], [3136, 0.7, 0.4], [4186 * 1.002, 0.45, 0.28], [5274, 0.25, 0.15]]), 0.9);
  stamp(s, 0.16, modal(1.5, [[2637, 0.5, 0.35]]), 0.5);
  const rat = filt(white(rnd, Math.round(0.35 * SR)), 'bp', 3000, 0.9); stamp(s, 0.3, mk(0.35, (t, i) => rat[i] * (0.5 + 0.5 * SIN(TAU * 45 * t)) * ex(t, 0.12)), 0.3);
  emit(s, 0.3, { send: 0.2 });
};
S.moneyCount = (c, rnd) => {
  const len = LEN(c, 2.0), s = new Float32Array(Math.round(len * SR)), tk = mk(0.012, (t) => (rnd() * 2 - 1) * ex(t, 0.003));
  for (let t = 0.02; t < len - 0.05; t += 1 / (52 + rnd() * 10)) stamp(s, t, tk, 0.4 + 0.6 * rnd());
  const f = filt(s, 'bp', 4200, 0.6); fio(f, 0.03, 0.08); emit(f, 0.15, { pan: 0.05, send: 0.06 });
};
S.keyboardTyping = (c, rnd) => {
  const len = LEN(c, 2.0), s = new Float32Array(Math.round(len * SR)), sl = s.slice();
  const key = () => { const f = 1500 + rnd() * 700; return modal(0.1, [[f, 0.5, 0.005], [f * 2.3, 0.3, 0.003], [300 + rnd() * 80, 0.9, 0.02]]); };
  let t = 0.03; while (t < len - 0.1) { const k = key(), side = rnd() < 0.5; stamp(side ? s : sl, t, k, 0.5 + 0.5 * rnd()); t += (rnd() < 0.2 ? 0.2 + rnd() * 0.2 : 0.055 + rnd() * 0.1); }
  emitS(s, sl, 0.16, { send: 0.04 });
};
S.tickerBlips = (c, rnd) => {
  const len = LEN(c, 2.0), s = new Float32Array(Math.round(len * SR));
  for (let t = 0.02; t < len - 0.08; t += 0.06 + rnd() * 0.11) { const f = 900 + rnd() * 2300, d = 0.025 + rnd() * 0.03; stamp(s, t, mk(d + 0.01, (tt) => (SIN(TAU * f * tt) + 0.25 * SIN(TAU * f * 2 * tt)) * at(tt, 0.002) * (1 - smooth((tt - d) / 0.01))), 0.4 + 0.6 * rnd()); }
  emit(s, 0.1, { pan: -0.1, send: 0.1 });
};
const beep = (f, d, tri = 0.3) => mk(d, (t) => (SIN(TAU * f * t) + tri * SIN(TAU * f * 3 * t) / 3) * at(t, 0.004) * (1 - smooth((t - (d - 0.02)) / 0.02)));
S.uiBlip = (c, rnd) => emit(beep(1250 + rnd() * 100, 0.07), 0.12, { send: 0.1 });
S.uiConfirm = (c, rnd) => { const s = new Float32Array(Math.round(0.4 * SR)); stamp(s, 0, beep(880, 0.1), 1); stamp(s, 0.09, mk(0.28, (t) => (SIN(TAU * 1320 * t) + 0.3 * SIN(TAU * 2640 * t)) * at(t, 0.004) * ex(t, 0.1)), 1); emit(s, 0.13, { send: 0.18 }); };
S.uiError = (c, rnd) => { const s = new Float32Array(Math.round(0.4 * SR)); const b = mk(0.12, (t) => (Math.sign(SIN(TAU * 196 * t)) * 0.5 + SIN(TAU * 98 * t)) * at(t, 0.004) * (1 - smooth((t - 0.1) / 0.02))); stamp(s, 0, b, 1); stamp(s, 0.16, b, 1); emit(filt(s, 'lp', 1500, 0.7), 0.13, { send: 0.04 }); };
S.phoneTap = (c, rnd) => { // port
  const n = Math.round(0.14 * SR), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; s[i] = SIN(TAU * 430 * t) * ex(t, 0.011) * 0.55 + SIN(TAU * 2350 * t) * ex(t, 0.0028) * 0.75 + (rnd() * 2 - 1) * ex(t, 0.0012) * 0.45; }
  const f = filt(s, 'hp', 220, 0.7), [l, r] = pan2(f, c.t < 0.5 ? 0.12 : -0.12); normPeak(l, r, 0.16); put(l, r, 0.06);
};
S.phoneBuzz = (c, rnd) => {
  const len = 0.9, n = Math.round(len * SR), rat = filt(white(rnd, n), 'bp', 2200, 1.0), s = mk(len, (t, i) => { const on = (t % 0.42) < 0.26 && t < 0.84; if (!on) return 0; const tt = t % 0.42; return (Math.tanh(2 * SIN(TAU * 168 * t)) * 0.8 + rat[i] * 0.25 * (0.5 + 0.5 * SIN(TAU * 90 * t))) * at(tt, 0.012) * (1 - smooth((tt - 0.24) / 0.02)); });
  emit(s, 0.2, { pan: 0.15, send: 0.1 });
};
S.alarmClock = (c, rnd) => {
  const len = LEN(c, 2.5), s = new Float32Array(Math.round(len * SR)), b = mk(0.075, (t) => (Math.sign(SIN(TAU * 2350 * t)) * 0.35 + SIN(TAU * 2350 * t) * 0.65 + 0.2 * SIN(TAU * 4700 * t)) * at(t, 0.003) * (1 - smooth((t - 0.06) / 0.015)));
  for (let t0 = 0; t0 < len - 0.08; t0 += 1.0) for (let k = 0; k < 4; k++) { const tt = t0 + k * 0.1; if (tt < len - 0.08) stamp(s, tt, b, 1); }
  fio(s, 0.002, 0.05); emit(s, 0.24, { send: 0.12 });
};
S.doorOpen = (c, rnd) => {
  const len = 0.9, s = new Float32Array(Math.round(len * SR)); stamp(s, 0, modal(0.15, [[1100, 1, 0.01], [2400, 0.5, 0.006], [260, 0.7, 0.03]]), 0.8);
  const n = Math.round(0.55 * SR), nz = white(rnd, n); let ph = 0; const cr = mk(0.55, (t, i) => { ph += TAU * (320 + 160 * SIN(PI * t / 0.55) + 30 * (rnd() - 0.5)) / SR; return (blepSaw(((ph / TAU) % 1 + 1) % 1, 0.01) * 0.6 + nz[i] * 0.2) * POW(SIN(PI * t / 0.55), 1.2); });
  stamp(s, 0.1, filt(cr, 'bp', 700, 1.5), 0.5); stamp(s, 0.7, modal(0.15, [[900, 0.5, 0.01]]), 0.4);
  emit(s, 0.2, { send: 0.1 });
};
S.doorSlam = (c, rnd) => { const n = Math.round(1.0 * SR), a = filt(white(rnd, n), 'lp', 700, 0.8), h = filt(white(rnd, n), 'bp', 1800, 0.8), s = mk(1.0, (t, i) => a[i] * ex(t, 0.07) * 1.1 + h[i] * ex(t, 0.012) * 0.6 + SIN(TAU * 78 * t) * ex(t, 0.2) * at(t, 0.003) + (SIN(TAU * 210 * t) * 0.4 + SIN(TAU * 390 * t) * 0.25) * ex(t, 0.09)); emit(s, 0.5, { split: 160, send: 0.35 }); };
S.knock = (c, rnd) => { const s = new Float32Array(Math.round(0.8 * SR)), nz = filt(white(rnd, Math.round(0.08 * SR)), 'lp', 1500, 0.8); for (let k = 0; k < 3; k++) stamp(s, k * 0.17 + rnd() * 0.01, mk(0.12, (t, i) => (SIN(TAU * 175 * t) * ex(t, 0.035) + SIN(TAU * 420 * t) * ex(t, 0.02) * 0.5 + (i < nz.length ? nz[i] * ex(t, 0.01) * 1.2 : 0)) * at(t, 0.001)), 0.8 + 0.2 * rnd()); emit(s, 0.3, { split: 100, send: 0.12 }); };
S.paperRustle = (c, rnd) => { const len = 0.6, n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', 4200, 0.6), fl = smoothRand(rnd, n, 38), s = mk(len, (t, i) => a[i] * POW(fl[i], 2.5) * 2.5 * POW(SIN(PI * t / len), 0.6)); emit(s, 0.12, { pan: rnd() * 0.3 - 0.15, send: 0.05 }); };
S.partyPopper = (c, rnd) => {
  const len = 1.6, n = Math.round(len * SR), a = filt(white(rnd, n), 'lp', 2500, 0.7); let ph = 0;
  const s = mk(len, (t, i) => { ph += TAU * (500 * ex(t, 0.03) + 90) / SR; return a[i] * ex(t, 0.02) * 1.0 + SIN(ph) * ex(t, 0.04) * at(t, 0.001) * 0.8; });
  const cf = filt(white(rnd, n), 'hp', 3500, 0.7), fl = smoothRand(rnd, n, 55);
  for (let i = 0; i < n; i++) { const t = i / SR; s[i] += cf[i] * POW(fl[i], 3) * 3 * ex(t, 0.45) * at(t - 0.03, 0.05) * 0.4; }
  const sp = new Float32Array(n), tk = mk(0.01, (t) => (rnd() * 2 - 1) * ex(t, 0.002)); for (let k = 0; k < 40; k++) stamp(sp, 0.05 + POW(rnd(), 1.5) * 1.3, tk, 0.3 * rnd());
  for (let i = 0; i < n; i++) s[i] += sp[i] * 0.5;
  emit(s, 0.34, { send: 0.25 });
};
S.clap = (c, rnd) => {
  const len = LEN(c, 0.4, 0.05, 30);
  if (len > 0.8) { const s = applause(rnd, len, 85, 2000), s2 = applause(rnd, len, 85, 2500); for (let i = 0; i < s.length; i++) { const t = i / SR, e = smooth(t / 0.6) * (1 - smooth((t - (len - 0.8)) / 0.8)); s[i] *= e; s2[i] *= e; } emitS(s, s2, 0.3, { send: 0.2 }); return; }
  const s = new Float32Array(Math.round(0.4 * SR)), mkc = () => filt(mk(0.2, (t) => (rnd() * 2 - 1) * ex(t, 0.03)), 'bp', 1400 + rnd() * 400, 0.7);
  stamp(s, 0, mkc(), 0.8); stamp(s, 0.011, mkc(), 0.5); stamp(s, 0.024, mkc(), 0.4);
  emit(s, 0.3, { send: 0.2 });
};
S.laughTrack = (c, rnd) => {
  const len = LEN(c, 2.5), [l, r] = choir(rnd, len, { k: 7, f0: [140, 300], v: ['a', 'e'], vib: 0.02, breath: 0.5, spread: 0.3,
    voiceEnv: (rn, on) => { const rate = 4.3 + rn() * 2.2, ph = rn(), dec = 0.5 + rn() * 0.6; return (t) => { if (t < on) return 0; const u = ((t - on) * rate + ph) % 1; return POW(SIN(PI * u), 1.6) * ex(t - on, len * dec * 1.4) * at(t - on, 0.1) * (1 - smooth((t - (len - 0.4)) / 0.4)); }; },
    pitch: (t) => 1 + 0.12 * ex(t * 4.3 % 1, 0.4) } );
  emitS(l, r, 0.22, { send: 0.3 });
};
S.cork = (c, rnd) => { const n = Math.round(0.35 * SR), a = filt(white(rnd, n), 'lp', 2400, 0.7); let ph = 0; const s = mk(0.35, (t, i) => { ph += TAU * (300 + 650 * ex(t, 0.025)) / SR; return SIN(ph) * ex(t, 0.05) * at(t, 0.002) + a[i] * ex(t, 0.012) * 0.7; }); const tail = filt(white(rnd, n), 'bp', 700, 1.5); for (let i = 0; i < n; i++) s[i] += tail[i] * ex(i / SR - 0.04 < 0 ? 0 : i / SR - 0.04, 0.05) * 0.3 * (i / SR > 0.04 ? 1 : 0); emit(s, 0.26, { send: 0.2 }); };

// ---------- vision / sci-fi
S.eyeOpen = (c, rnd) => { // port
  const n = Math.round(0.55 * SR), s = new Float32Array(n), air = filt(white(rnd, n), 'bp', 4200, 1.0); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, u = t / 0.32, env = u < 1 ? SIN(PI * u * 0.5) ** 2 : ex(t - 0.32, 0.09); ph += TAU * (480 * POW(3.1, clamp(u, 0, 1))) / SR; s[i] = (SIN(ph) + 0.3 * SIN(2.003 * ph)) * env * 0.7 + air[i] * POW(clamp(u, 0, 1), 2) * ex(Math.max(0, t - 0.32), 0.08) * 0.5 + SIN(TAU * 88 * t) * ex(t, 0.09) * 0.5 * at(t, 0.01); }
  const [l, r] = pan2(s, 0); normPeak(l, r, 0.12); put(l, r, 0.3);
};
S.eyeFlash = (c, rnd) => { // port
  const n = Math.round(2.0 * SR), L = new Float32Array(n), R = new Float32Array(n), freqs = [880, 1318.5, 1568, 1760, 2093, 2637, 3136, 3520, 4186, 5274];
  for (let k = 0; k < 14; k++) {
    const f = freqs[Math.floor(rnd() * freqs.length)] * (1 + (rnd() - 0.5) * 0.012), dec = 0.45 + rnd() * 0.7, off = rnd() * 0.06, trem = 4 + rnd() * 5, ph0 = rnd() * TAU, amp = 0.5 / Math.sqrt(14) * (1 + rnd()), [gl, gr] = panG(rnd() * 1.6 - 0.8);
    for (let i = Math.round(off * SR); i < n; i++) { const t = i / SR - off, v = SIN(TAU * f * t + ph0) * ex(t, dec) * (0.75 + 0.25 * SIN(TAU * trem * t)) * at(t, 0.004) * amp; L[i] += v * gl; R[i] += v * gr; }
  }
  const nz = filt(white(rnd, n), 'lp', 3200, 0.7); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (44 + 95 * ex(t, 0.07)) / SR; const boom = Math.tanh(1.6 * SIN(ph)) * ex(t, 0.55) * at(t, 0.004) * 1.2 + nz[i] * ex(t, 0.09) * 0.5; L[i] += boom * 0.9; R[i] += boom * 0.9; }
  normPeak(L, R, 0.34); splitPut(L, R, 0.45);
};
S.pullOut = (c, rnd) => { // port (default gain via GDEF)
  const len = c.len || 0.8, n = Math.round(len * SR), fc = (t) => 280 * POW(10, 1.05 * SIN(PI * POW(clamp(t / len, 0, 1), 0.85)));
  const a = filt(pink(rnd, n), 'bp', fc, 1.0), b = filt(pink(rnd, n), 'bp', fc, 1.0), lo = filt(pink(rnd, n), 'lp', 140, 0.8), L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = i / n, e = POW(SIN(PI * POW(u, 0.9)), 1.6); L[i] = (a[i] + lo[i] * 0.9) * e; R[i] = (b[i] + lo[i] * 0.9) * e; }
  normPeak(L, R, 0.2); put(L, R, 0.25);
};
S.tick = (c, rnd) => { // port
  const nn = c.n ?? 0, n = Math.round(0.2 * SR), s = new Float32Array(n), f = 1100 * POW(2, nn / 12);
  const click = (t0, a) => { for (let i = Math.round(t0 * SR); i < n; i++) { const t = i / SR - t0; s[i] += (SIN(TAU * f * t) * ex(t, 0.012) + 0.5 * SIN(TAU * f * 2.76 * t) * ex(t, 0.0055) + 0.6 * SIN(TAU * f * 0.42 * t) * ex(t, 0.02) + (rnd() * 2 - 1) * ex(t, 0.0015) * 0.8) * a * at(t, 0.0008); } };
  click(0, 1); click(0.016, 0.33);
  const hp = filt(s, 'hp', 280, 0.7), [l, r] = pan2(hp, (nn % 2 ? 0.14 : -0.14)); normPeak(l, r, 0.3 * (0.72 + 0.28 * nn / 9)); put(l, r, 0.13);
};
S.ghostWhoosh = (c, rnd) => { // port
  const len = c.len || 0.7, n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', (t) => 1800 * POW(5, t / len), 1.8), b = filt(white(rnd, n), 'bp', (t) => 900 * POW(3, t / len), 2.0), s = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, u = t / len; ph += TAU * (500 * POW(4, u) * (1 + 0.012 * SIN(TAU * 6 * t))) / SR; const env = POW(u, 2.1) * at(t, 0.03) * Math.min(1, (len - t) / 0.03); s[i] = (a[i] * 0.9 + b[i] * 0.5 + (SIN(ph) + 0.4 * SIN(2 * ph) + 0.18 * SIN(3 * ph)) * 0.22) * env; }
  const [l, r] = pan2(s, (t) => -0.75 + 1.1 * (t / len)); normPeak(l, r, 0.4); put(l, r, 0.35);
};
const POP = [440, 523.25, 659.25, 880];
S.echoPop = (c, rnd) => { // port
  const nn = c.n ?? 0, n = Math.round(1.4 * SR), s = new Float32Array(n), f = POP[((nn % 4) + 4) % 4];
  for (let i = 0; i < n; i++) { const t = i / SR, idx = 2.6 * ex(t, 0.09), car = SIN(TAU * f * t + idx * SIN(TAU * f * 3.5 * t)); s[i] = (car * ex(t, 0.4) + 0.3 * SIN(TAU * f * 2 * t) * ex(t, 0.2)) * at(t, 0.001) + (rnd() * 2 - 1) * ex(t, 0.0018) * 0.35; }
  const [l, r] = pan2(filt(s, 'hp', 200, 0.7), -0.5 + nn * 0.33); normPeak(l, r, 0.1); put(l, r, 0.4);
};
S.timerStart = (c, rnd) => { const s = new Float32Array(Math.round(0.9 * SR)); stamp(s, 0, beep(1000, 0.09), 0.8); stamp(s, 0.15, beep(1000, 0.09), 0.8); stamp(s, 0.3, mk(0.55, (t) => (SIN(TAU * 1500 * t) + 0.3 * SIN(TAU * 3000 * t)) * at(t, 0.004) * ex(t, 0.2)), 1); emit(s, 0.2, { send: 0.2 }); };
S.timerBeep = (c, rnd) => { const nn = c.n ?? 0; emit(mk(0.2, (t) => (SIN(TAU * 1000 * POW(2, nn / 12) * t) + 0.3 * SIN(TAU * 3000 * POW(2, nn / 12) * t)) * at(t, 0.003) * (1 - smooth((t - 0.16) / 0.04))), 0.2, { send: 0.08 }); };
S.glitch = (c, rnd) => {
  const len = LEN(c, 0.4), n = Math.round(len * SR), s = new Float32Array(n); let t = 0, prev = null;
  while (t < len) { const d = 0.008 + rnd() * 0.03, m = Math.round(d * SR), seg = new Float32Array(m), ty = rnd();
    if (prev && ty < 0.25) seg.set(prev.subarray(0, m)); else if (ty < 0.6) { const f = 200 + rnd() * 2800; for (let i = 0; i < m; i++) seg[i] = SIN(TAU * f * i / SR) > 0 ? 1 : -1; } else if (ty < 0.85) { let h = 0; const st = 3 + Math.floor(rnd() * 25); for (let i = 0; i < m; i++) { if (i % st === 0) h = rnd() * 2 - 1; seg[i] = h; } }
    for (let i = 0; i < m; i++) seg[i] = Math.round(seg[i] * 3) / 3 * (1 - i / m * 0.3); prev = seg; stamp(s, t, seg, 0.7); t += d * (rnd() < 0.3 ? 1.6 : 1); }
  emit(filt(s, 'hp', 150, 0.7), 0.25, { pan: 0, send: 0.05 });
};
S.rewind = (c, rnd) => {
  const len = LEN(c, 1.0), n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', (t) => 500 + 5500 * POW(t / len, 1.3), 1.2); let ph = 0;
  const s = mk(len, (t, i) => { ph += TAU * (250 * POW(9, t / len)) / SR; const stp = Math.floor(t * 18) % 2; return (a[i] * 0.7 + SIN(ph + 2 * SIN(TAU * 22 * t)) * 0.3 * (stp ? 1 : 0.6)) * (0.6 + 0.4 * SIN(TAU * 33 * t)) * at(t, 0.02) * (1 - smooth((t - (len - 0.05)) / 0.05)); });
  const tk = new Float32Array(n), cl = mk(0.01, (t) => (rnd() * 2 - 1) * ex(t, 0.002)); for (let t0 = 0; t0 < len; t0 += 0.02) stamp(tk, t0, cl, 0.4);
  for (let i = 0; i < n; i++) s[i] += tk[i] * 0.3;
  emit(s, 0.24, { pan: (t) => -0.3 + 0.6 * t / len, send: 0.12 });
};
S.reverseSwell = (c, rnd) => {
  const len = LEN(c, 1.5), n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', (t) => 400 * POW(14, POW(t / len, 1.2)), 0.9), b = filt(white(rnd, n), 'bp', (t) => 400 * POW(14, POW(t / len, 1.2)), 0.9);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = i / n, e = POW(u, 2.8) * (1 - smooth((u - 0.97) / 0.03)); L[i] = a[i] * e; R[i] = b[i] * e; }
  emitS(L, R, 0.3, { bus: 'riser', send: 0.12 });
};
S.heartbeat = (c, rnd) => {
  const len = LEN(c, 3.0), bpm = clamp(+c.bpm || 72, 30, 200), per = 60 / bpm, s = new Float32Array(Math.round(len * SR));
  const lub = (g) => { const nz = filt(white(rnd, Math.round(0.25 * SR)), 'lp', 140, 0.8); return mk(0.25, (t, i) => (SIN(TAU * (58 + 24 * ex(t, 0.03)) * t) * ex(t, 0.07) + nz[i] * ex(t, 0.05) * 0.5) * at(t, 0.006) * g); };
  for (let t0 = 0.02; t0 < len - 0.3; t0 += per) { stamp(s, t0, lub(1), 1); stamp(s, t0 + 0.27 * Math.min(1, 72 / bpm * 0.9 + 0.1), lub(0.65), 1); }
  fio(s, 0.005, 0.05); emit(filt(s, 'lp', 220, 0.707), 0.36, { bus: 'low' });
};
S.riserShort = (c, rnd) => { const len = LEN(c, 1.2, 0.2); const [l, r] = riserSig(rnd, len, 0.85); put(l, r, 0.15, 'riser'); };
S.staticBurst = (c, rnd) => { const len = LEN(c, 0.5), n = Math.round(len * SR), nz = white(rnd, n); let h = 0; const s = mk(len, (t, i) => { if (i % 4 === 0) h = nz[i]; return (h * 0.7 + nz[i] * 0.3) * (0.6 + 0.4 * (rnd() < 0.1 ? 0 : 1)) * at(t, 0.003) * (1 - smooth((t - (len - 0.06)) / 0.06)); }); emit(filt(s, 'hp', 400, 0.7), 0.22, { send: 0.05 }); };
S.vhsTear = (c, rnd) => {
  const len = 0.65, n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', (t) => 3200 + 1800 * SIN(TAU * 7 * t), 0.8), fl = smoothRand(rnd, n, 60);
  const s = mk(len, (t, i) => (a[i] * (fl[i] > 0.55 ? 1 : 0.15) + SIN(TAU * 60 * t) * 0.3 * (0.5 + 0.5 * SIN(TAU * 15 * t))) * at(t, 0.01) * (1 - smooth((t - 0.5) / 0.15) ));
  const dr = mk(0.1, (t) => (rnd() * 2 - 1) * ex(t, 0.03)); stamp(s, 0.02, dr, 0.4);
  emit(s, 0.22, { pan: 0, send: 0.06 });
};
S.sonar = (c, rnd) => { const s = mk(2.0, (t) => (SIN(TAU * 1400 * t + 0.25 * SIN(TAU * 5 * t) * ex(t, 0.3)) + 0.2 * SIN(TAU * 2800 * t)) * at(t, 0.004) * ex(t, 0.35)); emit(s, 0.22, { send: 0.55 }); };
S.clockTick = (c, rnd) => {
  const gap = 0.5; let cnt = Number.isFinite(+c.n) && +c.n > 0 ? Math.round(+c.n) : Number.isFinite(+c.len) ? Math.max(1, Math.round(+c.len / gap)) : 1; cnt = clamp(cnt, 1, 60);
  const s = new Float32Array(Math.round(((cnt - 1) * gap + 0.3) * SR));
  for (let k = 0; k < cnt; k++) { const f = k % 2 ? 1500 : 1900; stamp(s, k * gap, modal(0.12, [[f, 1, 0.006], [f * 2.4, 0.4, 0.003], [f * 0.5, 0.5, 0.012], [320, 0.5, 0.015]]), 0.8 + 0.2 * (k % 2 ? 0.8 : 1)); }
  emit(s, 0.15, { pan: 0.1, send: 0.08 });
};
S.clockStop = (c, rnd) => {
  const s = new Float32Array(Math.round(1.3 * SR)); stamp(s, 0, modal(0.12, [[1900, 1, 0.006], [4500, 0.4, 0.003], [950, 0.5, 0.012]]), 1);
  const n = Math.round(0.9 * SR), nz = filt(white(rnd, n), 'lp', 600, 0.8); let ph = 0;
  stamp(s, 0.12, mk(0.9, (t, i) => { ph += TAU * (320 * ex(t, 0.3) + 55) / SR; return (SIN(ph) * 0.8 + nz[i] * 0.25) * ex(t, 0.22) * at(t, 0.02) * 0.5; }), 1);
  emit(s, 0.2, { send: 0.2 });
};

// ---------- disaster
S.rumble = (c, rnd) => {
  const len = LEN(c, 3.0), n = Math.round(len * SR), a = filt(white(rnd, n), 'lp', 85, 0.9), b = filt(white(rnd, n), 'bp', 240, 1.0), am = smoothRand(rnd, n, 11), am2 = smoothRand(rnd, n, 3.5);
  const s = mk(len, (t, i) => (a[i] * 4 * (0.5 + 0.8 * am[i]) + b[i] * 0.8 * POW(am[i], 2) + SIN(TAU * (31 + 4 * am2[i]) * t) * 0.6) * (0.55 + 0.45 * am2[i]));
  fio(s, Math.min(0.5, len * 0.2), Math.min(0.8, len * 0.3)); emit(s, 0.45, { split: 220, send: 0.15 });
};
S.quakeCrack = (c, rnd) => {
  const len = 1.6, n = Math.round(len * SR), cr = filt(white(rnd, n), 'bp', 650, 0.7), hi = filt(white(rnd, n), 'bp', 2800, 0.6); let ph = 0;
  const s = mk(len, (t, i) => { ph += TAU * (34 + 55 * ex(t, 0.1)) / SR; return cr[i] * (ex(t, 0.12) + 0.5 * ex(t - 0.18 < 0 ? 0 : t - 0.18, 0.1) * (t > 0.18 ? 1 : 0)) * 0.9 + hi[i] * ex(t, 0.02) * 0.5 + SIN(ph) * ex(t, 0.45) * at(t, 0.004); });
  emit(s, 0.46, { split: 170, send: 0.3 });
};
S.debrisFall = (c, rnd) => {
  const len = LEN(c, 2.0), n = Math.round(len * SR), s = new Float32Array(n), dust = filt(pink(rnd, n), 'bp', 1800, 0.6);
  let t = 0.03; while (t < len - 0.1) { const f = 300 + POW(rnd(), 1.5) * 2600, g = 0.3 + rnd() * 0.7; stamp(s, t, modal(0.2, [[f, 1, 0.012 + rnd() * 0.02], [f * 2.3, 0.4, 0.008], [f * 0.5, 0.5, 0.03]]), g * (1 - 0.6 * t / len)); t += (0.025 + rnd() * 0.1) * (1 + 2 * t / len); }
  for (let i = 0; i < n; i++) s[i] += dust[i] * 0.2 * (1 - smooth((i / SR - len * 0.2) / (len * 0.8))) * at(i / SR, 0.1);
  fio(s, 0.01, 0.1); emit(s, 0.3, { split: 130, send: 0.2 });
};
S.buildingCreak = (c, rnd) => {
  const len = LEN(c, 2.5), n = Math.round(len * SR), wob = smoothRand(rnd, n, 6), nz = white(rnd, n); let ph = 0;
  const raw = mk(len, (t, i) => { ph += (88 + 55 * wob[i] + 18 * SIN(TAU * 3.1 * t)) / SR; ph -= Math.floor(ph); const jit = 0.6 + 0.4 * ((i >> 6) % 5 === 0 ? 0.2 : 1); return (blepSaw(ph, 0.01) * 0.6 + nz[i] * 0.05) * jit * POW(SIN(PI * t / len), 0.8) * (0.55 + 0.45 * wob[(i + 9000) % n]); });
  emit(filt(raw, 'bp', (t) => 330 + 260 * SIN(t * 1.3), 1.6), 0.26, { split: 110, send: 0.3 });
};
const sirenSig = (len, f0, f1, rate, lpfc) => { let ph = 0; const raw = mk(len, (t) => { const f = f0 + (f1 - f0) * (0.5 - 0.5 * COS(TAU * rate * t)); ph += f / SR; ph -= Math.floor(ph); return blepSaw(ph, f / SR) * 0.7 + SIN(TAU * ph) * 0.5; }); return filt(raw, 'lp', lpfc, 0.7); };
S.siren = (c, rnd) => { const len = LEN(c, 3.0), s = sirenSig(len, 650, 1250, 0.42, 3200); fio(s, 0.1, 0.3); emit(s, 0.24, { pan: 0.1, send: 0.3 }); };
S.sirenDistant = (c, rnd) => {
  const len = LEN(c, 4.0), s = filt(sirenSig(len, 600, 1000, 0.33, 1500), 'lp', 1600, 0.7);
  for (let i = 0; i < s.length; i++) { const t = i / SR; s[i] *= smooth(t / (len * 0.5)) * (1 - smooth((t - len * 0.5) / (len * 0.5))) * 0.9 + 0.1; }
  fio(s, 0.2, 0.5); emit(s, 0.12, { pan: -0.35, send: 0.7 });
};
S.crowdPanic = (c, rnd) => {
  const len = LEN(c, 3.0), [l, r] = choir(rnd, len, { k: 9, f0: [230, 620], v: ['a', 'i'], vib: 0.035, breath: 0.35, spread: 0.6,
    voiceEnv: (rn, on) => { const bursts = []; let t = on; while (t < len) { const d = 0.3 + rn() * 0.9; bursts.push([t, t + d]); t += d + 0.1 + rn() * 0.5; } return (tt) => { let e = 0; for (const [a, b] of bursts) { if (tt >= a && tt < b) { e = smooth((tt - a) / 0.05) * (1 - smooth((tt - (b - 0.15)) / 0.15)); break; } } return e; }; },
    pitch: (t) => 1 + 0.2 * POW(SIN(t * 2.3), 2) + 0.1 * smooth(t / 1.5), env: (t) => at(t, 0.1) * (1 - smooth((t - (len - 0.5)) / 0.5)) });
  const rm = filt(pink(rnd, l.length), 'bp', 500, 0.6); for (let i = 0; i < l.length; i++) { const e = 0.15 * rm[i] * 3; l[i] += e; r[i] += e; }
  emitS(l, r, 0.3, { send: 0.3 });
};
S.glassRain = (c, rnd) => {
  const len = LEN(c, 2.0), s = new Float32Array(Math.round(len * SR)); let t = 0.02;
  while (t < len - 0.2) { const f = 2400 + rnd() * 6500, tau = 0.04 + rnd() * 0.2; stamp(s, t, modal(tau * 6, [[f, 1, tau], [f * 2.76, 0.3, tau * 0.4]]), (0.2 + 0.8 * rnd()) * (1 - 0.5 * t / len)); t += 0.012 + POW(rnd(), 2) * 0.09 * (1 + 2 * t / len); }
  fio(s, 0.05, 0.2); emit(s, 0.26, { send: 0.3 });
};
S.dust = (c, rnd) => { const len = 0.7, n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', 1100, 0.7), s = mk(len, (t, i) => a[i] * POW(SIN(PI * POW(t / len, 0.6)), 1.5)); emit(s, 0.1, { send: 0.1 }); };
S.explosionFar = (c, rnd) => {
  const len = 3.2, n = Math.round(len * SR), nz = filt(white(rnd, n), 'lp', 260, 0.8), cr = filt(white(rnd, n), 'bp', 600, 0.7); let ph = 0;
  const s = mk(len, (t, i) => { ph += TAU * (26 + 40 * ex(t, 0.15)) / SR; const d = t - 0.05; return (d < 0 ? 0 : (Math.tanh(1.3 * SIN(ph)) * ex(t, 0.8) * at(d, 0.03) + nz[i] * ex(t, 0.5) * 1.0 + cr[i] * ex(t, 0.2) * 0.4)); });
  const rb = new Float32Array(n), cl = mk(0.1, (t) => (rnd() * 2 - 1) * ex(t, 0.03)); for (let k = 0; k < 14; k++) stamp(rb, 0.4 + rnd() * 1.6, cl, 0.2 * rnd());
  const rf = filt(rb, 'lp', 900, 0.7); for (let i = 0; i < n; i++) s[i] += rf[i];
  emit(filt(s, 'lp', 1400, 0.7), 0.46, { split: 150, send: 0.5 });
};

// ---------- emotion / mix
S.gasp = (c, rnd) => {
  const len = 0.55, n = Math.round(len * SR), nz = white(rnd, n); let ph = 0;
  const f1 = filt(nz, 'bp', (t) => 900 + 700 * smooth(t / 0.25), 3), f2 = filt(nz, 'bp', (t) => 2400 + 600 * smooth(t / 0.25), 3);
  const s = mk(len, (t, i) => { ph += (170 + 40 * smooth(t / 0.25)) / SR; ph -= Math.floor(ph); const e = POW(SIN(PI * POW(clamp(t / 0.3, 0, 1), 0.7)), 1.3) * (t < 0.3 ? 1 : ex(t - 0.3, 0.08)); return ((f1[i] + f2[i] * 0.6) * 1.6 + blepSaw(ph, 0.004) * 0.12) * e; });
  emit(s, 0.2, { pan: rnd() * 0.3 - 0.15, send: 0.15 });
};
const bellNote = (m, len, idxAmt = 1.8) => { const f = mtof(m); return mk(len, (t) => (SIN(TAU * f * t + idxAmt * ex(t, 0.1) * SIN(TAU * f * 3.5 * t)) * ex(t, len * 0.35) + 0.3 * SIN(TAU * f * 2 * t) * ex(t, len * 0.18)) * at(t, 0.002)); };
S.sting = (c, rnd) => { const s = new Float32Array(Math.round(1.6 * SR)); [[69, 0], [73, 0.02], [76, 0.04], [81, 0.06], [88, 0.12]].forEach(([m, d], k) => stamp(s, d, bellNote(m, 1.5, 1.4), 0.9 - k * 0.1)); emit(s, 0.3, { send: 0.5 }); };
S.stingWonder = (c, rnd) => { const s = new Float32Array(Math.round(3.0 * SR)), sl = s.slice(); [72, 76, 79, 83, 88, 91].forEach((m, k) => stamp(k % 2 ? sl : s, k * 0.11, bellNote(m, 2.4, 1.0), 0.9 - k * 0.07)); emitS(s, sl, 0.3, { send: 0.7 }); };
S.stingDark = (c, rnd) => {
  const len = 2.2, n = Math.round(len * SR), L = new Float32Array(n), R = new Float32Array(n);
  [[45, 0], [51, 0.3], [57, -0.3], [58, 0.5], [33, 0]].forEach(([m, p]) => { const f = mtof(m), [gl, gr] = panG(p); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += f * (1 + 0.003 * SIN(TAU * 5 * t)) / SR; ph -= Math.floor(ph); const v = blepSaw(ph, f / SR) * ex(t, 0.9) * at(t, 0.01); L[i] += v * gl; R[i] += v * gr; } });
  const fl = filt(L, 'lp', (t) => 2400 * ex(t, 0.4) + 160, 1.2), fr = filt(R, 'lp', (t) => 2400 * ex(t, 0.4) + 160, 1.2); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (60 - 22 * smooth(t / 0.6)) / SR; const sub = SIN(ph) * ex(t, 0.6) * at(t, 0.004) * 1.2; fl[i] += sub; fr[i] += sub; }
  emitS(fl, fr, 0.4, { split: 120, send: 0.4 });
};
S.swell = (c, rnd) => {
  const len = LEN(c, 2.5, 0.3), n = Math.round(len * SR), L = new Float32Array(n), R = new Float32Array(n);
  [45, 52, 57, 60, 64, 69].forEach((m, k) => { for (let side = 0; side < 2; side++) { const f = mtof(m) * POW(2, (side ? 6 : -6) / 1200), tgt = side ? R : L; let ph = rnd(); for (let i = 0; i < n; i++) { ph += f / SR; ph -= Math.floor(ph); tgt[i] += blepSaw(ph, f / SR) * (k < 2 ? 0.9 : 0.55); } } });
  const fl = filt(L, 'lp', (t) => 250 + 4200 * POW(t / len, 1.6), 0.9), fr = filt(R, 'lp', (t) => 250 + 4200 * POW(t / len, 1.6), 0.9);
  for (let i = 0; i < n; i++) { const u = i / n, e = POW(u, 1.8) * (1 - smooth((u - 0.94) / 0.06)); fl[i] *= e; fr[i] *= e; }
  emitS(fl, fr, 0.3, { bus: 'riser', send: 0.3 });
};
S.dropOut = (c, rnd) => {
  const len = 0.9, n = Math.round(len * SR), nz = filt(white(rnd, n), 'lp', (t) => 4000 * ex(t, 0.2) + 150, 0.8); let ph = 0;
  const s = mk(len, (t, i) => { ph += TAU * (360 * ex(t, 0.15) + 34) / SR; return SIN(ph) * ex(t, 0.35) * at(t, 0.004) + nz[i] * ex(t, 0.18) * 0.7; });
  emit(s, 0.3, { split: 160, send: 0.1 });
};
S.silenceHit = (c, rnd) => {
  const s = mk(0.5, (t) => SIN(TAU * (52 - 10 * smooth(t / 0.3)) * t) * ex(t, 0.12) * at(t, 0.01)); emit(s, 0.22, { bus: 'low', dt: 0.32 });
};
S.birdsong = (c, rnd) => {
  const len = LEN(c, 4.0), s = new Float32Array(Math.round(len * SR)), sl = s.slice(); let t = 0.1;
  while (t < len - 0.3) {
    const cnt = 2 + Math.floor(rnd() * 5), f0 = 2200 + rnd() * 3000, type = Math.floor(rnd() * 3), side = rnd() < 0.5;
    for (let k = 0; k < cnt; k++) { const d = 0.05 + rnd() * 0.1, f = f0 * (1 + 0.08 * k * (type === 1 ? -1 : 1)); let ph = 0; const ch = mk(d + 0.02, (tt) => { const u = clamp(tt / d, 0, 1); ph += TAU * (f * (type === 2 ? 1 + 0.4 * u : 1.3 - 0.5 * u) + 180 * SIN(TAU * 35 * tt)) / SR; return SIN(ph) * POW(SIN(PI * u), 0.8) * (tt < d ? 1 : 0); }); stamp(side ? s : sl, t, ch, 0.6 + 0.4 * rnd()); t += d + 0.04 + rnd() * 0.05; }
    t += 0.4 + rnd() * 1.0;
  }
  for (let i = 0; i < s.length; i++) { const a = rnd() * 0.0; s[i] += a; }
  emitS(s, sl, 0.12, { send: 0.35 });
};
S.wind = (c, rnd) => {
  const len = LEN(c, 4.0), n = Math.round(len * SR), g = smoothRand(rnd, n, 0.5), a = filt(white(rnd, n), 'bp', (t) => 420 + 260 * SIN(t * 0.8) , 0.8), b = filt(white(rnd, n), 'bp', (t) => 650 + 300 * SIN(t * 0.6 + 1), 0.8), wh = filt(white(rnd, n), 'bp', (t) => 1150 + 280 * SIN(t * 0.9), 9);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const e = POW(0.25 + 0.75 * g[i], 1.5); L[i] = (a[i] + wh[i] * 0.12 * e) * e; R[i] = (b[i] + wh[i] * 0.1 * e) * e; }
  fio(L, 0.3, 0.6); fio(R, 0.3, 0.6); emitS(L, R, 0.15, { send: 0.1 });
};
S.rain = (c, rnd) => {
  const len = LEN(c, 4.0), n = Math.round(len * SR), a = filt(white(rnd, n), 'hp', 2200, 0.7), b = filt(white(rnd, n), 'bp', 7000, 0.5), lo = filt(pink(rnd, n), 'lp', 500, 0.7);
  const sl = new Float32Array(n), sr = new Float32Array(n), drop = modal(0.04, [[3500, 1, 0.003]]), p = 0.002;
  for (let i = 0; i < n; i++) { if (rnd() < p) stamp(rnd() < 0.5 ? sl : sr, i / SR, drop, 0.2 + 0.5 * rnd()); }
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = a[i] * 0.55 + b[i] * 0.25 + lo[i] * 0.5 + sl[i]; R[i] = a[i] * 0.5 + b[i] * 0.3 + lo[i] * 0.5 + sr[i]; }
  fio(L, 0.3, 0.6); fio(R, 0.3, 0.6); emitS(L, R, 0.15, { send: 0.08 });
};
// crowd (choir based)
S.crowdGasp = (c, rnd) => {
  const len = 1.3, [l, r] = choir(rnd, len, { k: 9, f0: [160, 420], v: ['a', 'o'], vib: 0.008, breath: 1.2, spread: 0.15,
    voiceEnv: (rn, on) => (t) => at(t - on, 0.06) * ex(Math.max(0, t - on - 0.1), 0.35) * (t > on ? 1 : 0), pitch: (t) => 1 + 0.18 * smooth(t / 0.3), env: (t) => (1 - smooth((t - 0.9) / 0.4)) });
  emitS(l, r, 0.26, { send: 0.35 });
};
S.crowdCheer = (c, rnd) => {
  const len = LEN(c, 2.5, 0.5), [l, r] = choir(rnd, len, { k: 12, f0: [120, 340], v: ['a', 'o'], vib: 0.02, breath: 0.6, spread: 0.35,
    voiceEnv: (rn, on) => { const ph = rn() * 6, sp = 1.5 + rn() * 2.5; return (t) => at(t - on, 0.25) * (0.7 + 0.3 * SIN(t * sp + ph)) * (t > on ? 1 : 0) * (1 - smooth((t - (len - 0.7)) / 0.7)); },
    pitch: (t) => 1 + 0.07 * smooth(t / 0.4) });
  const ap1 = applause(rnd, len, 45, 2300), ap2 = applause(rnd, len, 45, 2700);
  for (let i = 0; i < l.length; i++) { const t = i / SR, e = at(t, 0.3) * (1 - smooth((t - (len - 0.8)) / 0.8)) * 1.2; l[i] += ap1[i] * e * 0.9; r[i] += ap2[i] * e * 0.9; }
  emitS(l, r, 0.3, { send: 0.3 });
};


// ------------------------------------------------------------------ EXTRA scene sounds (added for variety: every instance draws its own seeded pitch / filter / length)
const vr = (rnd, lo, hi) => lo + (hi - lo) * rnd();
S.clothRustle = (c, rnd) => {
  const len = LEN(c, vr(rnd, 0.35, 0.7)), n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', vr(rnd, 1400, 2600), 0.7), fl = smoothRand(rnd, n, vr(rnd, 16, 30)), lo = filt(pink(rnd, n), 'lp', 520, 0.8);
  emit(mk(len, (t, i) => (a[i] * POW(fl[i], 2) * 2.2 + lo[i] * 0.3 * fl[i]) * POW(SIN(PI * t / len), 0.8)), 0.1, { pan: vr(rnd, -0.25, 0.25), send: 0.04 });
};
S.clothFlap = (c, rnd) => {
  const len = LEN(c, vr(rnd, 0.5, 0.9)), n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', vr(rnd, 700, 1300), 0.8), rate = vr(rnd, 7, 11), jit = smoothRand(rnd, n, 6);
  emit(mk(len, (t, i) => { const ph = (t * rate * (0.85 + 0.3 * jit[i])) % 1; return a[i] * EXP(-ph * 6) * at(ph, 0.02) * POW(1 - t / len, 1.3) * 2; }), 0.12, { pan: vr(rnd, -0.3, 0.3), send: 0.05 });
};
S.airPuff = (c, rnd) => {
  const len = LEN(c, vr(rnd, 0.22, 0.45)), n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', vr(rnd, 800, 1700), 0.7), up = rnd() < 0.5;
  emit(mk(len, (t, i) => a[i] * at(t, up ? 0.12 * len : 0.02) * ex(t, len * 0.35)), 0.1, { pan: vr(rnd, -0.4, 0.4), send: 0.08 });
};
S.exhale = (c, rnd) => {
  const len = LEN(c, vr(rnd, 0.8, 1.3)), n = Math.round(len * SR), f0 = vr(rnd, 500, 800), a = filt(white(rnd, n), 'bp', (t) => f0 + 250 * smooth(t / len), 2.2), b = filt(white(rnd, n), 'bp', 2300, 1.2);
  emit(mk(len, (t, i) => (a[i] + b[i] * 0.25) * POW(SIN(PI * POW(t / len, 0.75)), 1.5)), 0.09, { pan: vr(rnd, -0.15, 0.15), send: 0.06 });
};
S.inhale = (c, rnd) => {
  const len = LEN(c, vr(rnd, 0.55, 0.9)), n = Math.round(len * SR), f0 = vr(rnd, 600, 900), a = filt(white(rnd, n), 'bp', (t) => f0 + 600 * smooth(t / len), 2.0), b = filt(white(rnd, n), 'bp', 2800, 1.2);
  emit(mk(len, (t, i) => (a[i] + b[i] * 0.3) * POW(SIN(PI * POW(t / len, 1.3)), 1.4)), 0.09, { pan: vr(rnd, -0.15, 0.15), send: 0.06 });
};
S.paperFlutter = (c, rnd) => {
  const len = LEN(c, vr(rnd, 0.45, 0.8)), n = Math.round(len * SR), a = filt(filt(white(rnd, n), 'bp', vr(rnd, 3200, 4600), 0.6), 'lp', 7000, 0.707), rate = vr(rnd, 16, 28), jit = smoothRand(rnd, n, 9);
  emit(mk(len, (t, i) => a[i] * POW(0.5 + 0.5 * SIN(TAU * rate * t + 4 * jit[i]), 2) * ex(t, len * 0.5) * at(t, 0.01) * 2), 0.09, { pan: vr(rnd, -0.3, 0.3), send: 0.05 });
};
S.crowdMurmur = (c, rnd) => {
  const len = LEN(c, vr(rnd, 2.2, 3.2)), n = Math.round(len * SR), b = filt(babble(rnd, n, [[vr(rnd, 420, 560), 2, 0.7, 0.8], [vr(rnd, 800, 1000), 2.5, 1.2, 0.8], [vr(rnd, 1500, 1900), 2, 2, 0.7]]), 'lp', 3200, 0.7);
  const b2 = filt(babble(rnd, n, [[500, 2, 0.8, 0.8], [950, 2.5, 1.3, 0.8], [1700, 2, 2, 0.7]]), 'lp', 3200, 0.7);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const e = POW(SIN(PI * i / n), 1.4); L[i] = (b[i] * 0.8 + b2[i] * 0.3) * e; R[i] = (b2[i] * 0.8 + b[i] * 0.3) * e; }
  emitS(L, R, 0.09, { send: 0.3 });
};
S.crowdOoh = (c, rnd) => {
  const len = LEN(c, vr(rnd, 1.0, 1.6)), n = Math.round(len * SR), L = new Float32Array(n), R = new Float32Array(n), vib = smoothRand(rnd, n, 5);
  for (let v = 0; v < 5; v++) {
    const f0 = vr(rnd, 130, 270), sig = new Float32Array(n); let ph = rnd();
    for (let i = 0; i < n; i++) { const t = i / SR; ph += (f0 * (1 + 0.012 * (vib[i] - 0.5)) * (1 + 0.1 * smooth(t / (len * 0.5)))) / SR; ph -= Math.floor(ph); sig[i] = blepSaw(ph, f0 / SR); }
    const fo = filt(sig, 'bp', vr(rnd, 480, 600), 3), f2 = filt(sig, 'bp', vr(rnd, 800, 900), 3), [gl, gr] = panG(vr(rnd, -0.7, 0.7));
    for (let i = 0; i < n; i++) { const x = fo[i] + f2[i] * 0.6; L[i] += x * gl; R[i] += x * gr; }
  }
  for (let i = 0; i < n; i++) { const t = i / SR, e = POW(SIN(PI * POW(t / len, 0.8)), 1.6); L[i] *= e; R[i] *= e; }
  emitS(L, R, 0.1, { send: 0.35 });
};
S.tirePass = (c, rnd) => {
  const len = LEN(c, vr(rnd, 1.8, 2.6)), pk = pkOf(c, len), s = passBy(rnd, len, pk, { dop: 0.12, dw: 0.25, hiF: vr(rnd, 1500, 2200), hiQ: 0.9, loF: vr(rnd, 380, 600), w: 0.35, pw: 1.0, f0: 80, nh: 1, roll: 1, am: 0, hiG: 0.8, loG: 0.7, toneG: 0 });
  emit(s, 0.2, { pan: (tau) => Math.tanh((tau - pk) / (len * 0.12)) * 0.8, send: 0.08 });
};
S.doorCreak = (c, rnd) => {
  const len = LEN(c, vr(rnd, 0.7, 1.2)), n = Math.round(len * SR), f0 = vr(rnd, 180, 300), wob = smoothRand(rnd, n, 9), nz = white(rnd, n); let ph = 0;
  const raw = mk(len, (t, i) => { ph += (f0 * (1 + 0.5 * smooth(t / len) * (0.6 + 0.4 * wob[i]))) / SR; ph -= Math.floor(ph); return blepSaw(ph, f0 / SR) * 0.7 + nz[i] * 0.15; });
  const fil = filt(raw, 'bp', (t) => 800 + 700 * smooth(t / len) + 120 * SIN(t * 31), 6);
  emit(mk(len, (t, i) => fil[i] * POW(SIN(PI * t / len), 1.1) * (0.7 + 0.5 * wob[(i + 777) % n])), 0.1, { pan: vr(rnd, -0.2, 0.2), send: 0.1 });
};
S.doorClick = (c, rnd) => {
  const f = vr(rnd, 0.9, 1.15), s = new Float32Array(Math.round(0.3 * SR));
  stamp(s, 0, modal(0.1, [[2500 * f, 1, 0.004], [5200 * f, 0.5, 0.002], [900 * f, 0.6, 0.012]], 0.0003), 1); stamp(s, vr(rnd, 0.055, 0.09), modal(0.1, [[1900 * f, 0.8, 0.005], [3900 * f, 0.4, 0.003], [700 * f, 0.5, 0.012]], 0.0003), 0.7);
  emit(s, 0.14, { pan: vr(rnd, -0.2, 0.2), send: 0.08 });
};
const surfaceSteps = (c, rnd, kind) => {
  const count = clamp(Math.round(c.n ?? 3), 1, 24), gap = clamp(+c.gap || vr(rnd, 0.46, 0.56), 0.2, 1.2), len = count * gap + 0.5, nn = Math.round(len * SR), sl = new Float32Array(nn), sr = new Float32Array(nn);
  for (let k = 0; k < count; k++) {
    const v = vr(rnd, 0.85, 1.2), d = Math.round(0.28 * SR), nz = white(rnd, d); let st;
    if (kind === 'gravel') { const h = filt(filt(nz, 'hp', 1500 * v, 0.7), 'lp', 6000, 0.707), g = smoothRand(rnd, d, 140); st = mk(0.28, (t, i) => (h[i] * POW(g[i], 2.2) * 2.2 * ex(t, 0.07) + SIN(TAU * 95 * v * t) * ex(t, 0.04) * 0.5) * at(t, 0.002)); }
    else if (kind === 'wood') { const w = filt(nz, 'lp', 3200, 0.707); st = mk(0.28, (t, i) => (SIN(TAU * 210 * v * t) * ex(t, 0.045) + 0.5 * SIN(TAU * 520 * v * t) * ex(t, 0.025) + w[i] * ex(t, 0.02) * 0.9) * at(t, 0.0015)); }
    else if (kind === 'grass') { const l = filt(nz, 'lp', 800 * v, 0.7); st = mk(0.28, (t, i) => l[i] * at(t, 0.03) * ex(t, 0.07) * 1.5 + SIN(TAU * 70 * t) * ex(t, 0.05) * 0.4); }
    else { const b = filt(nz, 'bp', 2600 * v, 1.0); st = mk(0.28, (t, i) => (b[i] * ex(t, 0.012) * 1.4 + SIN(TAU * 130 * v * t) * ex(t, 0.035)) * at(t, 0.0008)); }
    const t0 = Math.max(0, k * gap + (rnd() - 0.5) * 0.06), [a, b2] = panG((k % 2 ? 0.2 : -0.2) + (rnd() - 0.5) * 0.1), g = vr(rnd, 0.75, 1.15);
    stamp(sl, t0, st, g * a); stamp(sr, t0, st, g * b2);
  }
  emitS(sl, sr, kind === 'grass' ? 0.1 : 0.16, { send: 0.07 });
};
S.footstepGravel = (c, rnd) => surfaceSteps(c, rnd, 'gravel');
S.footstepWood = (c, rnd) => surfaceSteps(c, rnd, 'wood');
S.footstepGrass = (c, rnd) => surfaceSteps(c, rnd, 'grass');
S.footstepConcrete = (c, rnd) => surfaceSteps(c, rnd, 'concrete');
S.ballThud = (c, rnd) => {
  const f = vr(rnd, 85, 135), d = Math.round(0.4 * SR), a = filt(white(rnd, d), 'lp', vr(rnd, 400, 800), 0.8); let ph = 0;
  emit(mk(0.4, (t, i) => { ph += TAU * (f + 45 * ex(t, 0.025)) / SR; return (SIN(ph) * ex(t, 0.07) + a[i] * ex(t, 0.02) * 0.9) * at(t, 0.002); }), 0.22, { split: 160, send: 0.05 });
};
S.ballBounce = (c, rnd) => {
  const count = clamp(Math.round(c.n ?? 4), 1, 10), s = new Float32Array(Math.round((count * 0.45 + 0.6) * SR)); let t0 = 0, gap = vr(rnd, 0.32, 0.4), amp = 1;
  const f = vr(rnd, 150, 230);
  for (let k = 0; k < count; k++) { stamp(s, t0, mk(0.3, (t) => (SIN(TAU * (f + 30 * ex(t, 0.02)) * t) * ex(t, 0.05) + SIN(TAU * f * 2.7 * t) * ex(t, 0.012) * 0.4) * at(t, 0.0015)), amp); t0 += gap; gap *= 0.72; amp *= 0.65; }
  emit(s, 0.2, { pan: vr(rnd, -0.2, 0.2), split: 140, send: 0.08 });
};
S.objectThud = (c, rnd) => {
  const f = vr(rnd, 100, 200), d = Math.round(0.35 * SR), a = filt(white(rnd, d), 'lp', vr(rnd, 500, 1200), 0.8);
  emit(mk(0.35, (t, i) => (SIN(TAU * f * t) * ex(t, 0.05) * 0.8 + a[i] * ex(t, 0.025)) * at(t, 0.0015)), 0.2, { pan: vr(rnd, -0.2, 0.2), split: 150, send: 0.06 });
};
S.glassTink = (c, rnd) => { const f = vr(rnd, 2900, 4300); emit(modal(0.9, [[f, 1, 0.12], [f * 1.62, 0.4, 0.08], [f * 2.3, 0.2, 0.05]], 0.0004), 0.1, { pan: vr(rnd, -0.3, 0.3), send: 0.3 }); };
S.ceramicTap = (c, rnd) => { const f = vr(rnd, 1300, 1900); emit(modal(0.5, [[f, 1, 0.05], [f * 2.3, 0.5, 0.03], [f * 3.7, 0.2, 0.02]], 0.0004), 0.14, { pan: vr(rnd, -0.3, 0.3), send: 0.15 }); };
S.shimmer = (c, rnd) => {
  const len = LEN(c, vr(rnd, 1.0, 1.6)), s = new Float32Array(Math.round((len + 1.4) * SR)), pent = [76, 79, 81, 84, 88, 91, 93, 96];
  const cnt = Math.round(len * 9); for (let k = 0; k < cnt; k++) { const t0 = (k / cnt) * len * (0.7 + 0.3 * rnd()), m = pent[Math.floor(rnd() * pent.length)]; stamp(s, t0, bellNote(m, 1.0, 1.0), 0.25 * (1 - 0.6 * t0 / len) * vr(rnd, 0.6, 1)); }
  emit(s, 0.1, { pan: vr(rnd, -0.2, 0.2), send: 0.55 });
};
S.ghostAppear = (c, rnd) => {
  const len = 0.9, s = new Float32Array(Math.round(2.0 * SR)), n = Math.round(len * SR), up = filt(white(rnd, n), 'bp', (t) => 400 + 3200 * smooth(t / len), 1.8), seq = [76, 79, 83, 88];
  stamp(s, 0, mk(len, (t, i) => up[i] * POW(t / len, 1.6) * at(t, 0.03) * Math.min(1, (len - t) / 0.05) * 1.6), 0.6);
  seq.forEach((m, k) => stamp(s, 0.28 + k * 0.1 + rnd() * 0.01, bellNote(m + (rnd() < 0.3 ? 12 : 0), 1.2, 1.1), 0.7 - k * 0.08));
  emit(s, 0.13, { pan: vr(rnd, -0.2, 0.2), send: 0.55 });
};
S.ghostFade = (c, rnd) => {
  const len = 1.0, s = new Float32Array(Math.round(2.0 * SR)), n = Math.round(len * SR), dn = filt(white(rnd, n), 'bp', (t) => 3200 - 2800 * smooth(t / len), 1.8), seq = [88, 83, 79, 76];
  stamp(s, 0, mk(len, (t, i) => dn[i] * POW(1 - t / len, 1.2) * at(t, 0.02) * 1.4), 0.5);
  seq.forEach((m, k) => stamp(s, k * 0.12 + rnd() * 0.01, bellNote(m, 1.1, 0.9), 0.65 - k * 0.1));
  emit(s, 0.12, { pan: vr(rnd, -0.2, 0.2), send: 0.6 });
};
S.subWhoosh = (c, rnd) => {
  const len = LEN(c, vr(rnd, 0.8, 1.4)), n = Math.round(len * SR), a = filt(pink(rnd, n), 'lp', (t) => 110 + 160 * SIN(PI * clamp(t / len, 0, 1)), 0.8); let ph = 0;
  const f0 = vr(rnd, 110, 140);
  emit(mk(len, (t, i) => { ph += TAU * (f0 - 70 * smooth(t / len)) / SR; const e = POW(SIN(PI * clamp(t / len, 0, 1)), 2); return (SIN(ph) * 0.8 + a[i] * 1.6) * e; }), 0.16, { pan: vr(rnd, -0.2, 0.2), send: 0.05, bus: 'low' });
};
S.grab = (c, rnd) => {
  const s = new Float32Array(Math.round(0.45 * SR)), cl = filt(white(rnd, Math.round(0.2 * SR)), 'bp', vr(rnd, 1500, 2400), 0.8);
  stamp(s, 0, mk(0.2, (t, i) => cl[i] * POW(SIN(PI * t / 0.2), 0.8) * 2), 0.8); stamp(s, 0.14, mk(0.25, (t) => SIN(TAU * vr(rnd, 100, 140) * t) * ex(t, 0.05) * at(t, 0.002)), 0.6);
  emit(filt(s, 'lp', 5500, 0.707), 0.16, { pan: vr(rnd, -0.3, 0.3), send: 0.05 });
};
S.bodyBump = (c, rnd) => {
  const d = Math.round(0.4 * SR), a = filt(white(rnd, d), 'lp', vr(rnd, 280, 500), 0.8), f = vr(rnd, 70, 100), cl = filt(white(rnd, d), 'bp', 1800, 0.8);
  emit(mk(0.4, (t, i) => (a[i] * ex(t, 0.05) * 1.1 + SIN(TAU * f * t) * ex(t, 0.09) + cl[i] * ex(t, 0.05) * 0.35) * at(t, 0.002)), 0.26, { pan: vr(rnd, -0.25, 0.25), split: 160, send: 0.08 });
};
const EXTRA_TYPES = 'clothRustle clothFlap airPuff exhale inhale paperFlutter crowdMurmur crowdOoh tirePass doorCreak doorClick footstepGravel footstepWood footstepGrass footstepConcrete ballThud ballBounce objectThud glassTink ceramicTap shimmer ghostAppear ghostFade subWhoosh grab bodyBump'.split(' ');

// whoosh family policy: soft + dark (feedback: too loud / repetitive); the hook keeps its original sound
const WHOOSH_FAM = new Set(['whoosh', 'whooshFast', 'swish', 'ghostWhoosh']);
const WHOOSH_TRIM = 0.5, WHOOSH_LP = 4200;

// ------------------------------------------------------------------ vocabulary coverage
const VOCAB = {
  movement: 'step stepRun whoosh whooshFast swish jump land slide skid bikePass vehiclePass truckPass carHorn truckHorn skateboardRoll skateboardSlam',
  impacts: 'thump hit punch punchMiss bigImpact boom cutHit flashHit titleImpact crack glassBreak ceramicBreak catchSoft clink ceramicClatter',
  sport_objects: 'pingpongHit pingpongBounce bellRing crowdGasp crowdCheer batCrack ballSmack paddleHit rouletteSpin rouletteBall chipStack coinDrop cashRegister moneyCount keyboardTyping tickerBlips uiBlip uiConfirm uiError phoneTap phoneBuzz alarmClock doorOpen doorSlam knock paperRustle partyPopper clap laughTrack cork',
  vision_scifi: 'eyeOpen eyeFlash pullOut tick ghostWhoosh echoPop timerStart timerBeep glitch rewind reverseSwell heartbeat riserShort staticBurst vhsTear sonar clockTick clockStop',
  disaster: 'rumble quakeCrack debrisFall buildingCreak siren sirenDistant crowdPanic glassRain dust explosionFar',
  emotion_mix: 'gasp sting stingDark stingWonder swell dropOut silenceHit birdsong wind rain footstepsRun',
};
const VOCAB_ALL = Object.values(VOCAB).flatMap((s) => s.split(' '));
const vocabMissing = VOCAB_ALL.filter((t) => typeof S[t] !== 'function');
SOLO_TYPES = Object.keys(S);

// ------------------------------------------------------------------ cue rendering into a chapter-local context
const cueErrors = [];
function renderCues(cues, ctx, seedOf, tag) {
  CUR = ctx;
  cues.forEach((c, idx) => {
    ctx.c = c; ctx.cueIdx = idx;
    ctx.g = clamp(Number.isFinite(+c.gain) ? +c.gain : (GDEF[c.type] ?? 1), 0, 1.5);
    ctx.softLp = 0; ctx.varied = tag !== 'hook' && !LEGACY;
    if (ctx.varied && WHOOSH_FAM.has(c.type)) { ctx.g *= WHOOSH_TRIM; ctx.softLp = WHOOSH_LP; } // hook keeps its original whooshes
    try { S[c.type](c, mulberry32(seedOf(idx))); } catch (e) {
      cueErrors.push({ chapter: tag, t: c.t, type: c.type, error: String(e && e.message || e) });
      console.log(`CUE ERROR ${tag} t=${c.t} ${c.type}: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
    }
  });
}

// ------------------------------------------------------------------ HOOK (0..10.8 s): replicas of the sfx.mjs hook music / ambience / risers, cues through S
const hookCh = { id: 'hook', start: 0, dur: TL.DUR, silence: [], cues: TL.cues.map((c) => (c.type === 'titleImpact' ? { ...c, len: TL.DUR - c.t } : { ...c })) };
function hookMusicAmb(Nh) {
  const arc = TL.music.arc, raw = new Float32Array(Nh);
  for (let i = 0; i < Nh; i++) { const t = i / SR; let v = arc[arc.length - 1][2]; for (const [a, b, x] of arc) if (t >= a && t < b) { v = x; break; } raw[i] = v; }
  const intensity = onepole(raw, 0.12, 0.12), Iat = (t) => intensity[clamp(Math.round(t * SR), 0, Nh - 1)];
  const BEATh = 60 / TL.music.bpm, E8 = BEATh / 2, BOh = 0.45;
  const CHORDS = [[-1, 2.95, 'Am'], [2.95, 5.45, 'F'], [5.45, 7.95, 'Am'], [7.95, 9.2, 'F'], [9.2, 99, 'Am']];
  const VOICING = { Am: [45, 52, 57, 60, 64], F: [41, 48, 53, 57, 60] }, ARP = { Am: [57, 60, 64, 69], F: [53, 57, 60, 65] }, ROOT = { Am: 55.0, F: 43.654 };
  const dry = { L: new Float32Array(Nh), R: new Float32Array(Nh) }, sub = new Float32Array(Nh);
  { // pad
    const padL = new Float32Array(Nh), padR = new Float32Array(Nh), detL = [-8, 0, 5], detR = [-5, 0, 8];
    CHORDS.forEach(([a, b, name], ci) => {
      const s0 = Math.max(0, Math.round((a - 0.7) * SR)), s1 = Math.min(Nh, Math.round((b + 0.9) * SR)); if (s1 <= s0) return;
      for (const m of VOICING[name]) {
        const f0 = mtof(m);
        for (let v = 0; v < 3; v++) for (let side = 0; side < 2; side++) {
          const f = f0 * POW(2, (side ? detR[v] : detL[v]) / 1200), dt = f / SR; let ph = (m * 0.137 + v * 0.31 + side * 0.17) % 1;
          const tgt = side ? padR : padL;
          for (let i = s0; i < s1; i++) {
            const t = i / SR, env = smooth((t - (a - 0.6)) / (ci === 0 ? 1.2 : 0.7)) * (1 - smooth((t - b) / 0.8));
            if (env > 0) tgt[i] += blepSaw(ph, dt) * env * (m < 50 ? 0.9 : 0.55);
            ph += dt; if (ph >= 1) ph -= 1;
          }
        }
      }
    });
    const fcPad = (t) => 260 + 3100 * POW(Iat(t), 1.25), fL = filt(padL, 'lp', fcPad, 0.8), fR = filt(padR, 'lp', fcPad, 0.8), nP = db2g(-27.5) / (rmsOf(fL) || 1);
    for (let i = 0; i < Nh; i++) { const I = intensity[i], g = (0.35 + 0.65 * I) * nP; dry.L[i] += fL[i] * g; dry.R[i] += fR[i] * g; }
  }
  { // sub pulse
    for (let k = -1; BOh + k * BEATh < TL.DUR; k++) {
      const tb = BOh + k * BEATh; if (tb < -0.2) continue;
      const chord = CHORDS.find(([a, b]) => tb >= a && tb < b)?.[2] || 'Am', f0 = ROOT[chord], km = ((k % 4) + 4) % 4, accent = km === 0 ? 1 : (km === 2 ? 0.7 : 0.45), g = (0.2 + 0.8 * Iat(tb + 0.05)) * accent, s0 = Math.max(0, Math.round(tb * SR));
      let ph = 0;
      for (let i = s0; i < Math.min(Nh, s0 + Math.round(0.6 * SR)); i++) { const tau = (i - s0) / SR, f = f0 * (1 + 1.3 * EXP(-tau / 0.025)); ph += TAU * f / SR; sub[i] += (SIN(ph) + 0.32 * SIN(2 * ph)) * smooth(tau / 0.006) * EXP(-tau / 0.17) * g; }
    }
    const nS = db2g(-30) / (rmsOf(sub) || 1); for (let i = 0; i < Nh; i++) sub[i] *= nS;
  }
  { // pluck arpeggio + ping-pong delay
    const rnd = mulberry32(31), pL = new Float32Array(Nh), pR = new Float32Array(Nh), pat = [0, 1, 2, 3, 2, 1, 2, 1];
    for (let k = 0; BOh + k * E8 < TL.DUR; k++) {
      const ts = BOh + k * E8, chord = CHORDS.find(([a, b]) => ts >= a && ts < b)?.[2] || 'Am', I = Iat(ts), play = rnd() < 0.55 + I * 0.5, step = ((k % 8) + 8) % 8;
      if (!play && step % 4 !== 0) continue;
      const m = ARP[chord][pat[step]] + ((I > 0.7 && step === 4) ? 12 : 0), f = mtof(m), vel = (step % 4 === 0 ? 1 : 0.62) * (0.35 + 0.65 * I), [gl, gr] = panG(SIN(k * 1.3) * 0.45), s0 = Math.max(0, Math.round(ts * SR)), len = Math.round(0.9 * SR);
      for (let i = s0; i < Math.min(Nh, s0 + len); i++) {
        const tau = (i - s0) / SR; let v = 0;
        for (let h = 1; h <= 7; h++) v += SIN(TAU * f * h * tau + h * 0.4) / POW(h, 1.1) * EXP(-tau * (4.2 + 5.5 * (h - 1)));
        v *= smooth(tau / 0.003) * vel; pL[i] += v * gl; pR[i] += v * gr;
      }
    }
    const dly = Math.round(E8 * 1.5 * SR), dL = new Float32Array(Nh), dR = new Float32Array(Nh);
    for (let i = 0; i < Nh; i++) { dL[i] = pL[i] + (i >= dly ? dR[i - dly] * 0.42 : 0); dR[i] = pR[i] + (i >= dly ? dL[i - dly] * 0.42 : 0); }
    const dlL = filt(dL, 'lp', 3800, 0.7), dlR = filt(dR, 'lp', 3800, 0.7), nK = db2g(-31) / (rmsOf(dlL) || 1);
    for (let i = 0; i < Nh; i++) { dry.L[i] += dlL[i] * nK; dry.R[i] += dlR[i] * nK; }
  }
  const send = new Float32Array(Nh); for (let i = 0; i < Nh; i++) send[i] = 0.5 * (dry.L[i] + dry.R[i]);
  const [wl, wr] = convWet(send, 0), mL = new Float32Array(Nh), mR = new Float32Array(Nh);
  for (let i = 0; i < Nh; i++) { mL[i] = dry.L[i] + wl[i] * 0.42 + sub[i]; mR[i] = dry.R[i] + wr[i] * 0.42 + sub[i]; }
  // ambience
  const rnd = mulberry32(11), L = new Float32Array(Nh), R = new Float32Array(Nh);
  const cutoff = (t) => 1100 - 650 * smooth((t - 3.5) / 0.4) + 650 * smooth((t - 7.1) / 0.5) - 120 * smooth((t - 9.2) / 0.5);
  const airL = filt(pink(rnd, Nh), 'lp', cutoff, 0.7), airR = filt(pink(rnd, Nh), 'lp', cutoff, 0.7);
  const wL = filt(white(rnd, Nh), 'bp', (t) => 330 + 140 * SIN(t * 0.9) + 90 * SIN(t * 2.3 + 1), 0.9), wR = filt(white(rnd, Nh), 'bp', (t) => 360 + 130 * SIN(t * 1.1 + 2) + 80 * SIN(t * 1.9), 0.9), hum = filt(pink(rnd, Nh), 'lp', 170, 0.8);
  const nA = db2g(-37) / (rmsOf(airL) || 1), nW = db2g(-45) / (rmsOf(wL) || 1), nH = db2g(-42) / (rmsOf(hum) || 1);
  for (let i = 0; i < Nh; i++) {
    const t = i / SR, swell = 1 + 0.18 * SIN(t * 0.8) + 0.1 * SIN(t * 2.1 + 0.7), gust = 0.55 + 0.45 * SIN(t * 1.3) * SIN(t * 0.47 + 1), vis = 1 - 0.35 * smooth((t - 3.5) / 0.3) * (1 - smooth((t - 7.1) / 0.5));
    L[i] = (airL[i] * nA * swell + wL[i] * nW * gust + hum[i] * nH) * vis; R[i] = (airR[i] * nA * swell + wR[i] * nW * gust + hum[i] * nH) * vis;
  }
  return { music: [mL, mR], amb: [L, R] };
}
function renderHook() {
  const Nh = Math.round(TL.DUR * SR), fo = TL.music.fadeOutStart;
  const master = new Float32Array(Nh);
  for (let i = 0; i < Nh; i++) { const t = i / SR; master[i] = Math.min(1, t / 0.008) * (t < fo ? 1 : POW(COS(Math.min(1, (t - fo) / (TL.DUR - fo)) * PI / 2), 1.6)) * (i > Nh - 8 ? 0 : 1); }
  const fade = (a) => { for (let i = 0; i < Nh; i++) a[i] *= master[i]; return a; };
  const { music, amb } = hookMusicAmb(Nh);
  addCtl(fade(music[0]), fade(music[1]), 0, busCtl.music); addCtl(fade(amb[0]), fade(amb[1]), 0, busCtl.amb);
  TL.music.risers.forEach(([a, b], ri) => { const [l, r] = riserSig(mulberry32(500 + ri), b - a, [0.8, 0.9, 1.0][ri] ?? 1); const L = new Float32Array(Nh), R = new Float32Array(Nh); const s0 = Math.round(a * SR); for (let i = 0; i < l.length && s0 + i < Nh; i++) { L[s0 + i] = l[i]; R[s0 + i] = r[i]; } addCtl(fade(L), fade(R), 0, busCtl.riser); });
  const ctx = makeCtx(Nh); renderCues(hookCh.cues, ctx, (i) => 1000 + i * 17, 'hook');
  const [wl, wr] = convWet(ctx.send.subarray(0, Nh), 0);
  addCtl(fade(wl), fade(wr), 0, busCtl.sfx);
  for (const b of BUSES) addCtl(fade(ctx.buf[b].L), fade(ctx.buf[b].R), 0, busCtl[b === 'riser' ? 'riser' : b]);
  return hookCh.cues.length;
}

// ------------------------------------------------------------------ CHAPTERS
function arcAt(arc, tl) { for (const [a, b, x] of arc) if (tl >= a && tl < b) return x; return tl < arc[0][0] ? arc[0][2] : arc[arc.length - 1][2]; }
function renderChapter(ch, isFirst, isLast) {
  const T0 = isFirst ? ch.start - 0.4 : ch.start - 0.9, T1 = isLast ? ch.start + ch.dur : ch.start + ch.dur + 0.9, fi = isFirst ? 1.9 : 1.8, fo = isLast ? 3.0 : 1.8;
  const n = Math.round((T1 - T0) * SR), env = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = T0 + i / SR; env[i] = SIN(PI / 2 * clamp((t - T0) / fi, 0, 1)) * SIN(PI / 2 * clamp((T1 - t) / fo, 0, 1)); }
  const m1k = Math.ceil((ch.dur + 6) * 1000), raw = new Float32Array(m1k);
  for (let i = 0; i < m1k; i++) raw[i] = arcAt(ch.arc, i / 1000 - 2);
  const sm = onepole(raw, 0.15, 0.15, 1000), ik = (tAbs) => { const x = clamp((tAbs - ch.start + 2) * 1000, 0, m1k - 1.001), i0 = x | 0, f = x - i0; return sm[i0] * (1 - f) + sm[i0 + 1] * f; };
  const hs = hashStr(ch.id);
  if (!NO_MUSIC) { const [mL, mR] = renderMusic(ch, T0, n, env, ik, hs + 7); addCtl(mL, mR, T0, busCtl.music); }
  if (!NO_AMB) { const [aL, aR] = renderAmbience(ch, T0, n, env, hs + 13); addCtl(aL, aR, T0, busCtl.amb); }
  const nC = Math.round((ch.dur + 5) * SR), ctx = makeCtx(nC);
  ch.risers.forEach(([a, b], ri) => {
    const [l, r] = riserSig(mulberry32(hs + 500 + ri), b - a, 0.9), s0 = Math.round(a * SR), B = ctx.buf.riser;
    for (let i = 0; i < l.length && s0 + i < nC; i++) { B.L[s0 + i] += l[i]; B.R[s0 + i] += r[i]; }
    const sb = Math.round(b * SR), Lw = ctx.buf.low;
    for (let i = 0; i < Math.round(0.45 * SR) && sb + i < nC; i++) { const t = i / SR, v = SIN(TAU * (44 + 30 * EXP(-t / 0.06)) * t) * EXP(-t / 0.13) * smooth(t / 0.004) * 0.22; Lw.L[sb + i] += v; Lw.R[sb + i] += v; }
  });
  renderCues(ch.cues, ctx, (i) => hs + i * 17, ch.id);
  const [wl, wr] = convWet(ctx.send, 0);
  addCtl(wl, wr, ch.start, busCtl.sfx, 1, wl.length, STEM);
  for (const b of BUSES) addCtl(ctx.buf[b].L, ctx.buf[b].R, ch.start, busCtl[b], 1, ctx.buf[b].L.length, b === 'riser' ? null : STEM);
  return { solo: ctx.solo, ctx };
}

function applyDropOuts() {
  for (const [a, b] of dropRanges) {
    const s0 = Math.max(0, gi(a - 0.3)), s1 = Math.min(NW, gi(b + 1.0)); if (s1 - s0 < 100) continue;
    const dropAmt = (t) => smooth((t - (a - 0.06)) / 0.06) * (1 - smooth((t - b) / 0.6));
    const w = (t) => smooth((t - (a - 0.3)) / 0.15) * (1 - smooth((t - (b + 0.75)) / 0.15));
    for (const arr of (STEM ? [preL, preR, STEM.L, STEM.R] : [preL, preR])) {
      const seg = arr.slice(s0, s1), f = filt(seg, 'lp', (t) => 9000 * POW(350 / 9000, dropAmt(W0 + (s0 + t * SR) / SR)), 0.707);
      for (let i = 0; i < seg.length; i++) { const ww = w(W0 + (s0 + i) / SR); arr[s0 + i] = seg[i] * (1 - ww) + f[i] * ww; }
    }
  }
}

// ------------------------------------------------------------------ SFX short-term loudness guard
// The SFX stem (sfx + hit + low buses and their reverb) must never stand proud of the voice: its ~300 ms RMS is held below
// (VO reference level + GUARD_SPEECH_DB) while the voice is active and (VO reference + GUARD_GAP_DB) in the gaps (blended by the duck envelope).
// Gain reduction: instant (look-ahead min +-50 ms, 50 ms box smoothing so there are no zipper steps), 200 ms release, floor -12 dB.
const GUARD_SPEECH_DB = -7.0, GUARD_GAP_DB = -1.0, GUARD_FLOOR = db2g(-12);
const guardInfo = {};
function slidingMin(a, half) {
  const n = a.length, o = new Float32Array(n), dq = new Int32Array(n); let hd = 0, tl = 0;
  for (let h = 0; h < n + half; h++) {
    if (h < n) { while (tl > hd && a[dq[tl - 1]] >= a[h]) tl--; dq[tl++] = h; }
    const c = h - half; if (c < 0) continue;
    while (dq[hd] < c - half) hd++;
    o[c] = a[dq[hd]];
  }
  return o;
}
function boxAvg(a, half) {
  const n = a.length, P = new Float64Array(n + 1), o = new Float32Array(n);
  for (let i = 0; i < n; i++) P[i + 1] = P[i] + a[i];
  for (let i = 0; i < n; i++) { const lo = Math.max(0, i - half), hi = Math.min(n, i + half + 1); o[i] = (P[hi] - P[lo]) / (hi - lo); }
  return o;
}
function sfxGuard() {
  const nH = NHc, L = STEM.L, R = STEM.R, ms = new Float64Array(nH);
  for (let h = 0; h < nH; h++) { const a = h * HOP, b = Math.min(NW, a + HOP); if (b <= a) continue; let e = 0; for (let i = a; i < b; i++) e += 0.5 * (L[i] * L[i] + R[i] * R[i]); ms[h] = e / (b - a); }
  let ve = 0, vc = 0;
  for (let h = 0; h < nH; h++) if (voAct[h] > 0.5) { const a = h * HOP, b = Math.min(NW, a + HOP); if (b <= a) continue; let e = 0; for (let i = a; i < b; i++) e += voTrack[i] * voTrack[i]; ve += e / (b - a); vc++; }
  const voRefDb = vc > 50 ? 10 * Math.log10(ve / vc) : -27.8, thrSp = voRefDb + GUARD_SPEECH_DB, thrGap = voRefDb + GUARD_GAP_DB;
  const P = new Float64Array(nH + 1); for (let h = 0; h < nH; h++) P[h + 1] = P[h] + ms[h];
  const raw = new Float32Array(nH).fill(1), lv = new Float32Array(nH); let overSp = 0, overGap = 0, nSp = 0, nGap = 0;
  for (let h = 0; h < nH; h++) {
    const lo = Math.max(0, h - 150), hi = Math.min(nH, h + 151), lvl = 10 * Math.log10((P[hi] - P[lo]) / (hi - lo) + 1e-12); lv[h] = lvl;
    const dk = duckSm[h], thr = thrGap + (thrSp - thrGap) * dk;
    if (dk > 0.5) nSp++; else nGap++;
    if (lvl > thr) { raw[h] = Math.max(GUARD_FLOOR, db2g(thr - lvl)); if (dk > 0.5) overSp++; else overGap++; }
  }
  const mn = slidingMin(raw, 50), bx = boxAvg(mn, 25), gr = new Float32Array(nH), rel = 1 - EXP(-1 / 200); let y = 1, grMin = 1, redN = 0, red3 = 0;
  for (let h = 0; h < nH; h++) { y = Math.min(bx[h], y + (1 - y) * rel); gr[h] = y; if (y < grMin) grMin = y; if (y < 0.99) redN++; if (y < 0.708) red3++; }
  // report windows (raw, pre loudness gain): peaks before / after the guard
  const wins = [], W_A = Math.max(W0, WIN_ARG[0]), W_B = Math.min(W1, WIN_ARG[1]);
  const pk = (arrL, arrR, a, b) => { let p = 0; for (let i = a; i < b; i++) { const x = Math.abs(arrL[i]), z = arrR ? Math.abs(arrR[i]) : 0; if (x > p) p = x; if (z > p) p = z; } return p; };
  for (let t = W_A; t + 1e-6 < W_B; t += 2) {
    const a = Math.max(0, gi(t)), b = Math.min(NW, gi(Math.min(W_B, t + 2)));
    if (b <= a) continue;
    let e = 0, ev = 0; for (let i = a; i < b; i++) { e += 0.5 * (L[i] * L[i] + R[i] * R[i]); ev += voTrack[i] * voTrack[i]; }
    let grW = 1; for (let h = Math.floor(a / HOP); h <= Math.min(nH - 1, Math.floor(b / HOP)); h++) if (gr[h] < grW) grW = gr[h];
    wins.push({ t0: +t.toFixed(1), t1: +Math.min(W_B, t + 2).toFixed(1), sfx_pk_pre: pk(L, R, a, b), sfx_rms_pre: Math.sqrt(e / (b - a)), vo_pk: pk(voTrack, null, a, b), vo_rms: Math.sqrt(ev / (b - a)), gr_min: grW, a, b });
  }
  // apply
  if (NO_GUARD) gr.fill(1); // A/B: measure only
  for (let h = 0; h < nH; h++) {
    const a = h * HOP, b = Math.min(NW, a + HOP); if (b <= a) continue;
    const g0 = gr[h], g1 = h + 1 < nH ? gr[h + 1] : g0;
    for (let i = a; i < b; i++) { const g = g0 + (g1 - g0) * ((i - a) / HOP); L[i] *= g; R[i] *= g; }
  }
  for (const w of wins) { w.sfx_pk_post = pk(L, R, w.a, w.b); let e = 0; for (let i = w.a; i < w.b; i++) e += 0.5 * (L[i] * L[i] + R[i] * R[i]); w.sfx_rms_post = Math.sqrt(e / (w.b - w.a)); }
  for (let i = 0; i < NW; i++) { preL[i] += L[i]; preR[i] += R[i]; }
  Object.assign(guardInfo, {
    enabled: true, vo_ref_rms_dBFS_preGain: +voRefDb.toFixed(1), thr_speech_dBFS_preGain: +thrSp.toFixed(1), thr_gap_dBFS_preGain: +thrGap.toFixed(1),
    max_reduction_dB: +(-g2db(grMin)).toFixed(2), pct_time_reduced_any: +(100 * redN / nH).toFixed(2), pct_time_reduced_3dB: +(100 * red3 / nH).toFixed(2),
    pct_over_threshold_speech: +(100 * overSp / Math.max(1, nSp)).toFixed(2), pct_over_threshold_gap: +(100 * overGap / Math.max(1, nGap)).toFixed(2), wins,
  });
}

// ------------------------------------------------------------------ loudness loop
function measureArrays(L, R) {
  const f = path.join(os.tmpdir(), `fsf_meas_${process.pid}.wav`);
  writeWavStream(f, L.length, 'f32', (i) => L[i], (i) => R[i]);
  const m = measureFile(f); try { fs.unlinkSync(f); } catch { }
  if (m.I === null || m.TP === null) throw new Error('ffmpeg ebur128 measurement failed');
  return m;
}
function scaled(G) { const sL = new Float32Array(NW), sR = new Float32Array(NW); for (let i = 0; i < NW; i++) { sL[i] = preL[i] * G; sR[i] = preR[i] * G; } return [sL, sR]; }
function loudnessLoop() {
  let ceilDb = -2.4, out = null, m = null;
  const m0 = measureArrays(preL, preR); let G = db2g(LUFS_TARGET - m0.I - 2.5);
  lap(`pre-limiter loudness ${m0.I} LUFS, TP ${m0.TP}`);
  const run = () => { const [sL, sR] = scaled(G); out = null; out = limiter(sL, sR, db2g(ceilDb)); m = measureArrays(out.L, out.R); };
  for (let it = 0; it < 7; it++) {
    run(); lap(`  iter ${it}: G=${g2db(G).toFixed(2)} dB ceil=${ceilDb.toFixed(2)} -> ${m.I} LUFS, TP ${m.TP} dBTP, limiter max GR ${out.maxReductionDb.toFixed(2)} dB`);
    const eI = LUFS_TARGET - m.I, eT = TP_LIMIT - 0.12 - m.TP;
    if (Math.abs(eI) < 0.15 && m.TP <= TP_LIMIT - 0.05) break;
    if (m.TP > TP_LIMIT - 0.05) ceilDb += Math.min(-0.1, eT - 0.05);
    G *= db2g(eI * 0.9);
  }
  let guard = 0;
  while (m.TP > TP_LIMIT - 0.05 && guard++ < 8) { ceilDb -= (m.TP - TP_LIMIT) + 0.15; run(); lap(`  guard ${guard}: ceil=${ceilDb.toFixed(2)} -> ${m.I} LUFS, TP ${m.TP}`); }
  return { out, m, G, ceilDb };
}

// ------------------------------------------------------------------ mux
function mux() {
  const silent = path.join(OUT, 'silent_full.mp4'), mixf = path.join(OUT, 'mix_full.wav'), fin_ = path.join(OUT, 'final_full.mp4');
  if (!fs.existsSync(silent)) { console.error(`--mux: ${silent} not found (render the picture first); mix is at ${mixf}`); process.exitCode = 2; return; }
  if (!fs.existsSync(mixf)) { console.error(`--mux: ${mixf} not found (run without --mux-only first)`); process.exitCode = 2; return; }
  const r = ff(['-y', '-i', silent, '-i', mixf, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', fin_]);
  if (r.status !== 0) { console.error('ffmpeg mux failed:\n' + (r.stderr || '').split('\n').slice(-12).join('\n')); process.exitCode = 3; } else console.log('muxed ->', fin_);
}

// ------------------------------------------------------------------ solo test (every type alone)
function analyzeSlice(L, R, i0, i1) {
  const m = i1 - i0, mono = new Float32Array(m); let nan = 0, pk = 0, sum = 0;
  for (let i = 0; i < m; i++) { const a = L[i0 + i], b = R[i0 + i]; if (!Number.isFinite(a) || !Number.isFinite(b)) { nan++; continue; } const v = 0.5 * (a + b); mono[i] = v; sum += v; const x = Math.max(Math.abs(a), Math.abs(b)); if (x > pk) pk = x; }
  const F = 480, fr = []; let mx = 0;
  for (let s = 0; s + F <= m; s += F) { let e = 0; for (let j = 0; j < F; j++) e += mono[s + j] * mono[s + j]; e = Math.sqrt(e / F); fr.push(e); if (e > mx) mx = e; }
  let ae = 0, ac = 0, lastIdx = 0; fr.forEach((e, k) => { if (e > mx * 0.1) { ae += e * e; ac++; } if (e > mx * 0.00316) lastIdx = k; });
  const NF = 32768, re = new Float64Array(NF), im = new Float64Array(NF), nu = Math.min(24000, m);
  for (let i = 0; i < nu; i++) re[i] = mono[i] * (0.5 - 0.5 * COS(TAU * i / (nu - 1)));
  fft(re, im, false);
  let sw = 0, sf = 0, tot = 0; const mags = new Float64Array(NF / 2);
  for (let k = 1; k < NF / 2; k++) { const a = Math.hypot(re[k], im[k]); mags[k] = a; tot += a; sw += a * k * SR / NF; }
  let acc = 0, roll = 0; for (let k = 1; k < NF / 2; k++) { acc += mags[k]; if (acc >= 0.85 * tot) { roll = k * SR / NF; break; } } void sf;
  let tailE = 0; const tn = Math.round(0.1 * SR); for (let i = m - tn; i < m; i++) tailE += mono[i] * mono[i];
  return {
    peak_dBFS: +g2db(pk).toFixed(1), active_rms_dBFS: +g2db(ac ? Math.sqrt(ae / ac) : 0).toFixed(1), tail_s: +((lastIdx + 1) * F / SR).toFixed(2),
    centroid_Hz: Math.round(tot ? sw / tot : 0), rolloff85_Hz: Math.round(roll), nan_count: nan, dc_mean: +(sum / m).toExponential(2),
    start_click: pk > 0 && Math.abs(mono[0]) > 0.02 * pk, end_residual_dBFS: +g2db(Math.sqrt(tailE / tn)).toFixed(1),
  };
}
function soloTest() {
  const types = SOLO_TYPES, BATCH = 20, SP = 6, rep = {}, wavs = [];
  for (let b0 = 0; b0 < types.length; b0 += BATCH) {
    const batch = types.slice(b0, b0 + BATCH), n = Math.round((batch.length * SP + 6) * SR), ctx = makeCtx(n); CUR = ctx;
    batch.forEach((type, k) => {
      const c = { t: 1 + k * SP, type }; ctx.c = c; ctx.cueIdx = k; ctx.g = GDEF[type] ?? 1; ctx.varied = true;
      try { S[type](c, mulberry32(hashStr(type))); } catch (e) { cueErrors.push({ type, error: String(e && e.message || e) }); console.log(`SOLO ERROR ${type}: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); }
    });
    const [wl, wr] = convWet(ctx.send, 0), L = new Float32Array(n), R = new Float32Array(n);
    for (let i = 0; i < n; i++) { let l = wl[i] || 0, r = wr[i] || 0; for (const b of BUSES) { l += ctx.buf[b].L[i]; r += ctx.buf[b].R[i]; } L[i] = l; R[i] = r; }
    batch.forEach((type, k) => {
      const i0 = Math.round((1 + k * SP) * SR), i1 = Math.min(n, i0 + SP * SR), a = analyzeSlice(L, R, i0, i1);
      a.solo_cue_peak_dBFS = +g2db(ctx.solo[k] || 0).toFixed(1);
      a.flags = [];
      if (a.nan_count) a.flags.push('NaN'); if (a.peak_dBFS < -50) a.flags.push('SILENT'); if (a.peak_dBFS > -1) a.flags.push('LOUD');
      if (a.start_click) a.flags.push('start_click'); if (a.end_residual_dBFS > -60) a.flags.push('end_residual'); if (Math.abs(+a.dc_mean) > 0.002) a.flags.push('dc');
      rep[type] = a;
    });
    lap(`solo batch ${b0 / BATCH + 1}: ${batch.length} types`);
    if (flag('solo-wav')) wavs.push([L, R]);
  }
  if (flag('solo-wav')) {
    const N = wavs.reduce((s, w) => s + w[0].length, 0), Ls = new Float32Array(N), Rs = new Float32Array(N); let o = 0;
    for (const [l, r] of wavs) { Ls.set(l, o); Rs.set(r, o); o += l.length; }
    writeWavStream(path.join(OUT, 'solo_test.wav'), N, 24, (i) => Ls[i] * 0.8, (i) => Rs[i] * 0.8);
  }
  const rows = Object.entries(rep), bad = rows.filter(([, a]) => a.flags.length);
  fs.writeFileSync(path.join(OUT, 'solo_test_report.json'), JSON.stringify({ types: types.length, vocabMissing, cueErrors, flagged: bad.map(([t, a]) => ({ type: t, flags: a.flags })), results: rep }, null, 1));
  for (const [t, a] of rows) console.log(`${t.padEnd(16)} pk ${String(a.peak_dBFS).padStart(6)} rms ${String(a.active_rms_dBFS).padStart(6)} tail ${String(a.tail_s).padStart(5)}s cent ${String(a.centroid_Hz).padStart(5)} roll ${String(a.rolloff85_Hz).padStart(5)} ${a.flags.join(',')}`);
  console.log(`solo test: ${types.length} types, ${bad.length} flagged, ${cueErrors.length} errors, missing from vocab: ${vocabMissing.join(',') || 'none'}`);
}

// ------------------------------------------------------------------ MAIN
function main() {
  if (flag('mux-only')) { mux(); return; }
  if (vocabMissing.length) console.log('WARN vocabulary types NOT implemented:', vocabMissing.join(','));
  if (SOLO) { soloTest(); return; }
  fs.mkdirSync(OUT, { recursive: true });
  buildVO(); lap(`VO built (${voStats.lines} lines, peak ${voStats.peak})`);
  const chs = CH_ORDER.filter((id) => LAYOUT[id]).map((id) => loadChapter(id));
  chapters.push(...chs);
  buildDuck();
  buildGates([hookCh, ...chs]);
  buildBusCtl();
  const cueCounts = {}, soloAll = {};
  if (W0 < TL.DUR + 0.5) { const nh = renderHook(); cueCounts.hook = nh; lap(`hook rendered (${nh} cues)`); }
  chs.forEach((ch, k) => {
    if (ch.start + ch.dur + 7 < W0 || ch.start - 1.5 > W1) return;
    const { solo } = renderChapter(ch, k === 0, k === chs.length - 1);
    soloAll[ch.id] = solo; cueCounts[ch.id] = ch.cues.length;
    lap(`${ch.id} rendered: mood ${ch.mood}, amb ${ch.amb}, ${ch.cues.length} cues, ${ch.risers.length} risers`);
  });
  applyDropOuts();
  if (STEM) { sfxGuard(); lap(`sfx guard: max GR ${guardInfo.max_reduction_dB} dB, ${guardInfo.pct_time_reduced_3dB}% of time >3 dB`); } else guardInfo.enabled = false;
  filt(preL, 'hp', 22, 0.707, preL); filt(preR, 'hp', 22, 0.707, preR);
  const bedL = Float32Array.from(preL), bedR = Float32Array.from(preR); // kept for the VO-vs-bed report (pre VO)
  for (let i = 0; i < NW; i++) { preL[i] += voTrack[i]; preR[i] += voTrack[i]; }
  { // master fades
    const fe = W1 >= TOTAL - 1e-6 ? 2.0 : 0.05, a = Math.round(0.008 * SR);
    for (let i = 0; i < NW; i++) {
      const tr = (NW - 1 - i) / SR; let g = i < a ? i / a : 1;
      if (tr < fe) g *= POW(COS((1 - tr / fe) * PI / 2), 1.6);
      if (g !== 1) { preL[i] *= g; preR[i] *= g; }
    }
  }
  lap('assembled; loudness loop');
  const { out, m, G, ceilDb } = loudnessLoop();
  writeWavStream(fileMix, NW, 24, (i) => out.L[i], (i) => out.R[i]);
  const mf = measureFile(fileMix);
  lap(`${path.basename(fileMix)} written: ${mf.I} LUFS, TP ${mf.TP} dBTP, LRA ${mf.LRA} LU`);

  // ---- integrity scan
  let nan = 0, clip = 0, maxStep = 0, maxStepAt = 0, dcL = 0, dcR = 0;
  for (let i = 0; i < NW; i++) {
    const a = out.L[i], b = out.R[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) { nan++; continue; }
    if (Math.abs(a) >= 0.9999 || Math.abs(b) >= 0.9999) clip++;
    dcL += a; dcR += b;
    if (i) { const s = Math.max(Math.abs(a - out.L[i - 1]), Math.abs(b - out.R[i - 1])); if (s > maxStep) { maxStep = s; maxStepAt = i; } }
  }
  // ---- per chapter stats + VO vs bed during speech
  const band = (x) => filt(filt(x, 'hp', 300, 0.707), 'lp', 4000, 0.707);
  const chapRep = {};
  for (const ch of [hookCh, ...chs]) {
    const a = Math.max(0, gi(ch.start)), b = Math.min(NW, gi(ch.start + ch.dur)); if (b - a < SR) continue;
    let e = 0, pk = 0; for (let i = a; i < b; i++) { e += 0.5 * (out.L[i] * out.L[i] + out.R[i] * out.R[i]); pk = Math.max(pk, Math.abs(out.L[i]), Math.abs(out.R[i])); }
    const vo = voTrack.slice(a, b).map((x) => x * G), bed = new Float32Array(b - a); for (let i = a; i < b; i++) bed[i - a] = 0.5 * (bedL[i] + bedR[i]) * G;
    const vb = band(vo), bb = band(bed); let ve = 0, be = 0, c = 0, ge = 0, gc = 0;
    for (let i = 0; i < b - a; i++) { const va = voAct[((a + i) / HOP) | 0]; if (va > 0.5) { ve += vb[i] * vb[i]; be += bb[i] * bb[i]; c++; } else if (va < 0.02) { ge += bb[i] * bb[i]; gc++; } }
    chapRep[ch.id] = { rms_dBFS: +g2db(Math.sqrt(e / (b - a))).toFixed(1), peak_dBFS: +g2db(pk).toFixed(1), vo_band_dB: c ? +g2db(Math.sqrt(ve / c)).toFixed(1) : null, bed_band_during_vo_dB: c ? +g2db(Math.sqrt(be / c)).toFixed(1) : null, bed_band_in_gaps_dB: gc ? +g2db(Math.sqrt(ge / gc)).toFixed(1) : null, vo_minus_bed_dB: c ? +(g2db(Math.sqrt(ve / c)) - g2db(Math.sqrt(be / c))).toFixed(1) : null, ...(ch.id === 'hook' ? {} : { mood: ch.mood, ambience: ch.amb, cues: ch.cues.length, risers: ch.risers.length, silence: ch.silence.length }) };
  }
  const cueRep = {};
  for (const ch of chs) {
    if (!soloAll[ch.id]) continue;
    cueRep[ch.id] = ch.cues.map((c, k) => {
      const a = Math.max(0, gi(ch.start + c.t)), b = Math.min(NW, a + Math.round(0.25 * SR)); let pk = 0;
      for (let i = a; i < b; i++) pk = Math.max(pk, Math.abs(out.L[i]), Math.abs(out.R[i]));
      return { t: +c.t.toFixed(2), type: c.type, solo_dBFS: +g2db((soloAll[ch.id][k] || 0) * G).toFixed(1), mix_0_250ms_dBFS: +g2db(pk).toFixed(1) };
    });
  }
  // cue-type census (what actually plays) + SFX-vs-VO table (post loudness gain, so dBFS in the final mix)
  const typeCounts = {}; for (const ch of chs) for (const c of ch.cues) typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
  const whooshFamilyCounts = {}; for (const ch of chs) { whooshFamilyCounts[ch.id] = ch.cues.filter((c) => WHOOSH_FAM.has(c.type)).length; }
  const D = (x) => +g2db(x * G).toFixed(1);
  const guardOut = { ...guardInfo, wins: (guardInfo.wins || []).map((w) => ({ window_s: [w.t0, w.t1], vo_peak_dBFS: D(w.vo_pk), vo_rms_dBFS: D(w.vo_rms), sfx_peak_dBFS_before_guard: D(w.sfx_pk_pre), sfx_peak_dBFS_after_guard: D(w.sfx_pk_post), sfx_rms_dBFS_before_guard: D(w.sfx_rms_pre), sfx_rms_dBFS_after_guard: D(w.sfx_rms_post), sfx_rms_minus_vo_rms_dB_after: +(g2db(w.sfx_rms_post) - g2db(w.vo_rms)).toFixed(1), sfx_peak_minus_vo_peak_dB_after: +(g2db(w.sfx_pk_post) - g2db(w.vo_pk)).toFixed(1), max_gain_reduction_dB: +(-g2db(w.gr_min)).toFixed(1) })) };
  const report = {
    sampleRate: SR, duration_s: +(NW / SR).toFixed(3), range: [W0, W1], cuesDir: CUES_DIR, output: path.basename(fileMix),
    loudness: { integrated_LUFS: mf.I, truePeak_dBTP: mf.TP, LRA: mf.LRA, target_LUFS: LUFS_TARGET, tp_limit: TP_LIMIT, loop_measure: m },
    gain_dB: +g2db(G).toFixed(2), limiter: { ceiling_dBFS: +ceilDb.toFixed(2), max_reduction_dB: +out.maxReductionDb.toFixed(2) },
    integrity: { nan, clipped_samples: clip, dc_L: +(dcL / NW).toExponential(2), dc_R: +(dcR / NW).toExponential(2), max_sample_step: +maxStep.toFixed(3), max_step_at_s: +(W0 + maxStepAt / SR).toFixed(2) },
    vo: voStats, cueCounts, missingCueFiles: missingCues, unknownCueTypes: unknownTypes, cueErrors, vocabularyMissing: vocabMissing, implementedTypes: Object.keys(S).length,
    modes: { legacyWhoosh: LEGACY, sfxGuard: !NO_GUARD, whooshTrim_dB: LEGACY ? 0 : +g2db(WHOOSH_TRIM).toFixed(1), whooshLowpass_Hz: LEGACY ? null : WHOOSH_LP, whooshMinGap_s: LEGACY ? null : WHOOSH_MIN_GAP },
    extraTypes: EXTRA_TYPES, whooshFamilyPerChapter: whooshFamilyCounts, cueTypeCounts: typeCounts, whooshGuardDropped, sfxGuard: guardOut,
    chapters: chapRep, cues: cueRep, timing_s: +((Date.now() - T_START) / 1000).toFixed(1),
  };
  fs.writeFileSync(fileReport, JSON.stringify(report, null, 1));
  console.log(`report -> ${fileReport}`);
  console.log('integrity:', JSON.stringify(report.integrity));
  console.log('whoosh-family per chapter:', JSON.stringify(whooshFamilyCounts), whooshGuardDropped.length ? `(spacing guard dropped ${whooshGuardDropped.length})` : '');
  for (const w of guardOut.wins || []) console.log(`  ${w.window_s.join('-')}s  vo pk ${w.vo_peak_dBFS} rms ${w.vo_rms_dBFS} | sfx pk ${w.sfx_peak_dBFS_before_guard} -> ${w.sfx_peak_dBFS_after_guard}  rms ${w.sfx_rms_dBFS_before_guard} -> ${w.sfx_rms_dBFS_after_guard}  GRmax ${w.max_gain_reduction_dB} dB`);
  for (const [id, r] of Object.entries(chapRep)) console.log(`  ${id.padEnd(5)} rms ${String(r.rms_dBFS).padStart(6)} pk ${String(r.peak_dBFS).padStart(6)}  vo ${r.vo_band_dB}  bed ${r.bed_band_during_vo_dB}  vo-bed ${r.vo_minus_bed_dB}  ${r.mood || ''} ${r.ambience || ''} cues ${r.cues ?? ''}`);
  if (flag('mux')) mux();
}
main();
