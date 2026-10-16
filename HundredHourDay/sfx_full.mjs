// sfx_full.mjs — "What If One Day Lasted 100 Hours?" (video 2) audio: music, ambience and SFX synthesized in code, deterministic, no deps, no samples.
//
// Run from PowerShell in the project folder (Node 20+, ffmpeg on PATH):
//   node sfx_full.mjs                       -> full mix: out/audio_mix.wav (+ copy out/mix_full.wav) + out/audio_report_full.json
//   node sfx_full.mjs --wav-only            -> same wav, no report extras, no mux
//   node sfx_full.mjs --check               -> mix + quality check: out/audio_check.json + out/audio_check.txt (per-chapter RMS/peak, VO-vs-music level,
//                                              clipping, LUFS / true peak / LRA, chapter-join and end-of-video checks, spectral summary + time x band grid)
//   node sfx_full.mjs --wav-only --check    -> the usual QC run
//   node sfx_full.mjs --mux                 -> additionally mux with out/silent_full.mp4 (else out/silent.mp4) -> out/final_full.mp4 (else out/final.mp4)
//   node sfx_full.mjs --mux-only            -> only the mux step (uses the existing out/audio_mix.wav)
//   node sfx_full.mjs --cues-dir <dir>      -> read <dir>/<id>.cues.json instead of ch/<id>.cues.json (e.g. audio_test_cues; debug outputs get a _debug suffix)
//   node sfx_full.mjs --range a,b           -> render only global seconds a..b (debug; output gets a _debug suffix)
//   node sfx_full.mjs --solo-test [--solo-wav] -> render EVERY cue type solo (no VO/music/ambience) -> out/solo_test_report.json (flags NaN/SILENT/LOUD/HARSH/clicks)
//   node sfx_full.mjs --demo-music all|c1..c8 [--demo-len 20] [--demo-mood <mood>] -> out/audio_demo_<id>_<colour>.wav + spectral numbers per music colour
//   other flags: --out <name> (output file stem), --no-music, --no-amb, --no-vo, --lufs <x> (default -16), --legacy-whoosh, --no-guard, --win a,b
//
// Chapters come from out/layout.json (c1..c8; every key with a `vo` array, sorted by start). Each chapter reads <cues-dir>/<id>.cues.json:
//   { mood: wonder|bright|tense|dark|hollow|warm|epic|quiet, ambience: city|desert|night|wind|ocean|indoor|void|crowd|quiet|casino|arena,
//     music: { arc: [[from,to,intensity]], risers: [[a,b]], silence: [[a,b]] }, cues: [{ t, type, gain?, len?, n? }] }   (t in chapter-local seconds)
// Unknown cue types / bad entries are ignored with a warning, never a crash; missing params get defaults.
//
// Architecture (memory-lean: only the mix bus preL/preR + VO + limiter curve live at full length; everything else is chapter-local):
//   VO (per-line level matching -> glue compressor -> limiter) -> sidechain duck curves (1 kHz control rate)
//   per chapter: music (colour per chapter + mood modifiers, crossfaded) + ambience + cues (+reverb sends) are added into preL/preR through weight curves
//   (duck x silence/dip gates x chapter fade). Then dropOut low-pass, sfx guard, bed master fade, VO added, loudness loop (gain + look-ahead limiter).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
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
const LUFS_TARGET = flag('lufs') && flag('lufs') !== true ? parseFloat(flag('lufs')) : -16;
const TP_LIMIT = -1.2;
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
const CH_ORDER = Object.keys(LAYOUT).filter((k) => k !== 'total' && LAYOUT[k] && typeof LAYOUT[k] === 'object' && Array.isArray(LAYOUT[k].vo) && Number.isFinite(LAYOUT[k].start)).sort((a, b) => LAYOUT[a].start - LAYOUT[b].start);
let W0 = 0, W1 = TOTAL;
const rangeArg = flag('range');
if (rangeArg && rangeArg !== true) { const [a, b] = rangeArg.split(',').map(Number); W0 = clamp(a, 0, TOTAL); W1 = clamp(b, W0 + 1, TOTAL); }
const DEBUG = !!(rangeArg || flag('cues-dir') || SOLO);
let SOLO_TYPES = null; // filled once the synth table exists
const soloSpacing = 5.0;
const outStem = flag('out') && flag('out') !== true ? flag('out') : (DEBUG ? 'debug' : '');
const fileMix = path.join(OUT, outStem ? `audio_mix_${outStem}.wav` : 'audio_mix.wav');
const fileReport = path.join(OUT, outStem ? `audio_report_full_${outStem}.json` : 'audio_report_full.json');
const fileCheck = path.join(OUT, outStem ? `audio_check_${outStem}` : 'audio_check'); // + .json / .txt

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
const AMB_NAMES = ['city', 'desert', 'night', 'wind', 'ocean', 'indoor', 'void', 'crowd', 'quiet', 'casino', 'arena'];
const missingCues = [], unknownTypes = {}, warnings = [], whooshGuardDropped = [], WHOOSH_MIN_GAP = 3.0;
function loadChapter(id, k = 0) {
  const Lo = LAYOUT[id], f = path.join(CUES_DIR, id + '.cues.json');
  let j = null;
  if (fs.existsSync(f)) {
    try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`WARN ${id}: bad cues json (${e.message}) -> mood defaults, no cues`); missingCues.push(id + '(bad)'); }
  } else { console.log(`NOTE ${id}: ${f} missing -> mood defaults, no cues`); missingCues.push(id); }
  const [dm, da] = DEFAULTS_BY_COL[colIndexOf(id, k)], dur = Lo.dur;
  if (j && j.mood !== undefined && !MOOD_NAMES.includes(j.mood)) warnings.push(`${id}: unknown mood '${j.mood}' -> default '${dm}'`);
  if (j && j.ambience !== undefined && !AMB_NAMES.includes(j.ambience)) warnings.push(`${id}: unknown ambience '${j.ambience}' -> default '${da}'`);
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
  const voL = (Lo.vo || []).filter((ln) => Number.isFinite(+ln.start)).map((ln) => +ln.start);
  const tF = voL.length ? Math.max(0, Math.max(...voL) - 0.35) : Math.max(0, dur - 4);
  return { id, start: Lo.start, dur, vo: Lo.vo || [], mood, amb, arc, risers, silence, cues, tF, title: Lo.title || id };
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
  if (CUR.softLp) { const same = l === r; for (let pass = 0; pass < 2; pass++) { l.set(filt(l, 'lp', CUR.softLp, 0.707)); if (!same) r.set(filt(r, 'lp', CUR.softLp, 0.707)); } } // whoosh family + bright types: gentler highs (2 passes = 24 dB/oct)
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
const DUCK = { amb: -9.5, music: -9.5, riser: -8, sfx: -6, hit: -7 };
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
  const trim = { sfx: -6, hit: -6, low: -5 };
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

// ------------------------------------------------------------------ MUSIC ENGINE v2: "the sun motif" + eight colours (one per chapter)
// Every chapter is rendered in CHAPTER-LOCAL time u (seconds from the chapter start) with its own tempo / chord table.
// Instruments are instrument-like (modal marimba / vibes / kalimba / felt piano / glass bell / harp / timpani, soft additive pads, warm sub).
const blepSaw = (ph, dt) => {
  let v = 2 * ph - 1;
  if (ph < dt) { const t = ph / dt; v -= t + t - t * t - 1; }
  else if (ph > 1 - dt) { const t = (ph - 1) / dt; v -= t * t + t + t + 1; }
  return v;
};
const modI = (a, n) => ((a % n) + n) % n;
function normRms(L, R, dB) { const r = Math.sqrt((rmsOf(L) ** 2 + rmsOf(R) ** 2) / 2) || 1, s = db2g(dB) / r; for (let i = 0; i < L.length; i++) { L[i] *= s; R[i] *= s; } }
function normPk(L, R, dB) { const s = db2g(dB) / (peakOf(L, R) || 1); for (let i = 0; i < L.length; i++) { L[i] *= s; R[i] *= s; } }
/** deterministic per-index random in 0..1 (so the same musical decision is taken however the render window is cut) */
const hr = (k, salt = 0) => { let h = Math.imul((k | 0) ^ Math.imul(salt + 1, 0x9e3779b1), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const lerp = (a, b, u) => a + (b - a) * clamp(u, 0, 1);
function arcAt(arc, tl) { for (const [a, b, x] of arc) if (tl >= a && tl < b) return x; return tl < arc[0][0] ? arc[0][2] : arc[arc.length - 1][2]; }
function makeIk(arc, dur) {
  const m = Math.ceil((dur + 8) * 1000), raw = new Float32Array(m);
  for (let i = 0; i < m; i++) raw[i] = arcAt(arc, i / 1000 - 2);
  const sm = onepole(raw, 0.15, 0.15, 1000);
  return (u) => { const x = clamp((u + 2) * 1000, 0, m - 1.001), i0 = x | 0, f = x - i0; return sm[i0] * (1 - f) + sm[i0 + 1] * f; };
}

// ---- harmony: D family
const SUN_IV = [0, 2, 4, 7, 9];                // the sun motif: D E F# A B (rising, hopeful)
const SUN_BT = [0.75, 0.75, 0.75, 0.75, 2.5];  // in beats; the last note hangs
const CDEF = (name, rootPc, ivs, bass) => ({ name, rootPc, ivs, bass, pcs: ivs.map((v) => (rootPc + v) % 12) });
const CHD2 = {
  Dadd9: CDEF('Dadd9', 2, [0, 4, 7, 14], 38), Bm7: CDEF('Bm7', 11, [0, 3, 7, 10], 35), Gmaj7: CDEF('Gmaj7', 7, [0, 4, 7, 11], 43), Asus4: CDEF('Asus4', 9, [0, 5, 7, 10], 45),
  Em9: CDEF('Em9', 4, [0, 3, 7, 10, 14], 40), Clyd: CDEF('Clyd', 0, [0, 4, 7, 11, 18], 36), D69: CDEF('D6/9', 2, [0, 4, 7, 9, 14], 38),
  Dmaj9: CDEF('Dmaj9', 2, [0, 4, 7, 11, 14], 38), Fsm7: CDEF('F#m7', 6, [0, 3, 7, 10], 42), Bm9: CDEF('Bm9', 11, [0, 3, 7, 10, 14], 35),
  CaddD: CDEF('Cadd9/D', 0, [0, 4, 7, 14], 38), GaddD: CDEF('Gadd9/D', 7, [0, 4, 7, 14], 38), AsusD: CDEF('Asus2/D', 9, [0, 2, 7], 38),
  Dm9: CDEF('Dm9', 2, [0, 3, 7, 10, 14], 38), Bbmaj7: CDEF('Bbmaj7', 10, [0, 4, 7, 11], 34), Gm9: CDEF('Gm9', 7, [0, 3, 7, 10, 14], 43),
  Aadd9: CDEF('Aadd9', 9, [0, 4, 7, 14], 33), Glyd: CDEF('Glyd', 7, [0, 4, 7, 11, 18], 43),
};
const tonesIn = (ch, lo, hi) => { const o = []; for (let m = Math.ceil(lo); m <= hi; m++) if (ch.pcs.includes(m % 12)) o.push(m); return o; };
function voiceN(ch, lo, hi, maxN) {
  const t = tonesIn(ch, lo, hi); if (t.length <= maxN || maxN < 2) return maxN < 2 ? t.slice(0, 1) : t;
  const o = []; for (let k = 0; k < maxN; k++) o.push(t[Math.round(k * (t.length - 1) / (maxN - 1))]); return o;
}

// ---- instruments (cached, peak-normalised mono note waves)
const NOTE_CACHE = new Map(), PERC_CACHE = new Map();
function nrm1(w) {
  let p = 0; for (let i = 0; i < w.length; i++) { const a = w[i] < 0 ? -w[i] : w[i]; if (a > p) p = a; }
  if (p > 0) for (let i = 0; i < w.length; i++) w[i] /= p;
  const f = Math.min(w.length >> 1, Math.round(0.012 * SR)); for (let i = 0; i < f; i++) w[w.length - 1 - i] *= i / f;
  return w;
}
function thud(w, fc, amp, rnd, tau = 0.01) { // soft mallet / hammer noise at the start of a note
  const m = Math.min(w.length, Math.round(0.08 * SR)), nz = filt(white(rnd, m), 'lp', fc, 0.7); let p = 0; for (let i = 0; i < m; i++) p = Math.max(p, Math.abs(nz[i]));
  for (let i = 0; i < m; i++) w[i] += (nz[i] / (p || 1)) * amp * EXP(-i / (tau * SR)) * Math.min(1, i / (0.0012 * SR));
}
function buildNote(inst, m, vb) {
  const f = mtof(m), br = [0.5, 0.8, 1][vb], ok = (a) => a.filter((p) => p[0] < 11000);
  let w;
  switch (inst) {
    case 'marimba': {
      const tau = clamp(1.15 - (m - 48) * 0.014, 0.16, 1.1);
      w = modal(Math.min(2.4, tau * 5), ok([[f, 1, tau], [f * 3.97, 0.32 * br, tau * 0.3], [f * 9.9, 0.07 * br, tau * 0.12]]), 0.0015);
      thud(w, 700 + f * 0.4, 0.22, mulberry32(Math.round(m * 100) + 1)); break;
    }
    case 'vibes': {
      const tau = clamp(2.4 - (m - 53) * 0.03, 0.7, 2.4);
      w = modal(Math.min(4.5, tau * 4.5), ok([[f, 1, tau], [f * 4, 0.18 * br, tau * 0.35], [f * 10, 0.04 * br, tau * 0.12]]), 0.002);
      for (let i = 0; i < w.length; i++) w[i] *= 0.7 + 0.3 * SIN(TAU * 6.2 * i / SR + m * 0.37);
      break;
    }
    case 'kalimba': {
      const tau = clamp(0.9 - (m - 60) * 0.012, 0.25, 0.9);
      w = modal(tau * 5, ok([[f, 1, tau], [f * 2.76, 0.2 * br, tau * 0.25], [f * 5.4, 0.07 * br, tau * 0.1]]), 0.001);
      thud(w, 1500, 0.1, mulberry32(Math.round(m * 100) + 2), 0.004); break;
    }
    case 'musicbox': {
      const tau = clamp(0.75 - (m - 72) * 0.01, 0.25, 0.75);
      w = modal(tau * 5, ok([[f, 1, tau], [f * 5.4, 0.18 * br, tau * 0.2], [f * 8.9, 0.06 * br, tau * 0.1]]), 0.0008); break;
    }
    case 'felt': { // felt piano: stretched partials, two slightly detuned strings, soft hammer
      const tau0 = clamp(2.6 - (m - 40) * 0.035, 0.5, 2.6), B = 0.00025, amps = [1, 0.45 * br + 0.1, 0.2 * br, 0.09 * br, 0.04 * br, 0.02 * br], modes = [];
      for (let k = 1; k <= 6; k++) {
        const fk = f * k * Math.sqrt(1 + B * k * k), tk = tau0 / (1 + 0.55 * (k - 1));
        modes.push([fk * POW(2, 1.2 / 1200), amps[k - 1] * 0.5, tk], [fk * POW(2, -1.2 / 1200), amps[k - 1] * 0.5, tk * 1.05]);
      }
      w = modal(Math.min(5, tau0 * 4.2), ok(modes), 0.002);
      thud(w, 260, 0.18, mulberry32(Math.round(m * 100) + 3), 0.014); break;
    }
    case 'bell': {
      const tau = clamp(2.8 - (m - 72) * 0.03, 0.9, 3.0);
      w = modal(Math.min(5.5, tau * 4.5), ok([[f, 1, tau], [f * 2.32, 0.4 * br, tau * 0.55], [f * 4.25, 0.18 * br, tau * 0.35], [f * 6.63, 0.08 * br, tau * 0.2]]), 0.002); break;
    }
    case 'harp': {
      const tau = clamp(1.6 - (m - 48) * 0.02, 0.4, 1.6), modes = [];
      for (let h = 1; h <= 5; h++) modes.push([f * h, (h === 1 ? 1 : br / POW(h, 1.1)), tau / (1 + 0.5 * (h - 1))]);
      w = modal(Math.min(3.5, tau * 4.5), ok(modes), 0.001);
      thud(w, 2500, 0.08, mulberry32(Math.round(m * 100) + 4), 0.004); break;
    }
    case 'timp': { // sine sweep 1.35f -> f + skin thump
      const len = 2.2, n = Math.round(len * SR); w = new Float32Array(n); let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f * (1 + 0.35 * EXP(-t / 0.06)) / SR; w[i] = (SIN(ph) + 0.25 * SIN(2.02 * ph)) * EXP(-t / 0.9) * Math.min(1, t / 0.004); }
      thud(w, 400, 0.5, mulberry32(Math.round(m * 100) + 5), 0.02); break;
    }
    case 'sub': case 'subLong': case 'boom': { // warm sub: sine + soft 2nd/3rd so small speakers still hear it
      const tau = inst === 'subLong' ? 3.4 : inst === 'boom' ? 1.3 : 0.55, len = Math.min(8, tau * 3.2), n = Math.round(len * SR); w = new Float32Array(n);
      for (let i = 0; i < n; i++) { const t = i / SR; w[i] = (SIN(TAU * f * t) + 0.35 * SIN(TAU * 2 * f * t) + 0.12 * SIN(TAU * 3 * f * t)) * EXP(-t / tau) * Math.min(1, t / 0.012); }
      break;
    }
    default: w = new Float32Array(1);
  }
  return nrm1(w);
}
function noteWave(inst, m, vb = 1, cents = 0) {
  const key = inst + '|' + m + '|' + vb + '|' + cents; let w = NOTE_CACHE.get(key);
  if (!w) { w = buildNote(inst, m + cents / 100, vb); NOTE_CACHE.set(key, w); }
  return w;
}
function percWave(kind, variant = 0) {
  const key = kind + '|' + variant; let w = PERC_CACHE.get(key); if (w) return w;
  const rnd = mulberry32(900 + variant * 31 + hashStr(kind) % 997);
  const env = (n, att, tau) => { const e = new Float32Array(n); for (let i = 0; i < n; i++) e[i] = Math.min(1, i / (att * SR)) * EXP(-i / (tau * SR)); return e; };
  const shape = (nz, e) => { for (let i = 0; i < nz.length; i++) nz[i] *= e[i]; return nz; };
  switch (kind) {
    case 'shaker': { const n = Math.round(0.11 * SR); w = shape(filt(filt(white(rnd, n), 'bp', 4300 + 300 * variant, 0.9), 'lp', 6200, 0.7), env(n, 0.006, 0.03)); break; }
    case 'shakerSoft': { const n = Math.round(0.14 * SR); w = shape(filt(filt(white(rnd, n), 'bp', 3800, 0.8), 'lp', 5500, 0.7), env(n, 0.012, 0.045)); break; }
    case 'brush': { const n = Math.round(0.45 * SR); w = shape(filt(filt(white(rnd, n), 'bp', 3000 + 200 * variant, 0.5), 'lp', 5800, 0.7), env(n, 0.03, 0.11)); break; }
    case 'tick': { w = modal(0.09, [[1900 + 180 * variant, 1, 0.012], [3100 + 200 * variant, 0.35, 0.007], [700, 0.4, 0.02]], 0.0008); thud(w, 2500, 0.15, rnd, 0.002); break; }
    case 'kick': {
      const n = Math.round(0.5 * SR); w = new Float32Array(n); let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (48 + 42 * EXP(-t / 0.035)) / SR; w[i] = (SIN(ph) + 0.2 * SIN(2 * ph)) * EXP(-t / 0.14) * Math.min(1, t / 0.006); }
      break;
    }
    case 'puff': { const n = Math.round(0.55 * SR), f0 = 650 + 150 * variant; w = shape(filt(white(rnd, n), 'bp', (t) => f0 * (1 + 1.2 * smooth(t / 0.25)), 0.8), env(n, 0.03, 0.12)); w = filt(w, 'lp', 4200, 0.7); break; }
    case 'gust': { const n = Math.round(1.8 * SR); w = new Float32Array(n); const b = filt(white(rnd, n), 'bp', (t) => 400 + 900 * SIN(PI * clamp(t / 1.8, 0, 1)), 0.7); for (let i = 0; i < n; i++) w[i] = b[i] * POW(SIN(PI * i / n), 1.6); w = filt(w, 'lp', 3800, 0.7); break; }
    default: w = new Float32Array(1);
  }
  PERC_CACHE.set(key, nrm1(w)); return w;
}

// ---- render context for one chapter's music
function mkRC(ch, T0, n, seed, ik, M) {
  const z = () => new Float32Array(n), B = () => ({ L: z(), R: z() });
  const RC = { u0: T0 - (ch.start || 0), n, dur: ch.dur, ik, seed, M, dry: B(), echo: B(), low: B(), pcb: B() };
  RC.add = (buf, w, u, g, pan = 0) => {
    const s0 = Math.round((u - RC.u0) * SR); if (s0 >= n || s0 + w.length <= 0 || !(g > 1e-6)) return;
    const [gl, gr] = panG(pan), a = Math.max(0, -s0), b = Math.min(w.length, n - s0);
    for (let i = a; i < b; i++) { const v = w[i] * g; buf.L[s0 + i] += v * gl; buf.R[s0 + i] += v * gr; }
  };
  /** o: {dB peak level, echo: send to the dotted-8th ping-pong, cents, g multiplier} */
  RC.note = (inst, m, u, vel, pan = 0, o = {}) => {
    const vb = vel < 0.55 ? 0 : vel < 0.85 ? 1 : 2, w = noteWave(inst, m, vb, o.cents || 0), g = clamp(vel, 0, 1.3) * db2g(o.dB ?? -18) * (o.g ?? 1);
    RC.add(RC.dry, w, u, g, pan); if (o.echo) RC.add(RC.echo, w, u, g * o.echo, pan);
  };
  RC.perc = (kind, u, g, pan = 0, variant = 0) => RC.add(kind === 'kick' ? RC.low : RC.pcb, percWave(kind, variant), u, g, pan);
  RC.lowNote = (inst, m, u, g) => RC.add(RC.low, noteWave(inst, m, 1), u, g, 0);
  return RC;
}

// ---- chord/tempo context ("C"): segments of `bars` bars with the colour's progression; the last chapter may end on a held final chord
function makeC(col, dur, tF) {
  const beat = 60 / col.bpm, bar = beat * 4, segLen = bar * col.bars, prog = col.prog.map((n) => CHD2[n]), C = { beat, bar, segLen, prog, tonic: col.tonic, dur, tF, bpm: col.bpm };
  const seg = (idx) => ({ a: idx * segLen, b: (idx + 1) * segLen, ch: prog[modI(idx, prog.length)], pi: modI(idx, prog.length), idx, ova: 0.5, ovb: 0.5 });
  C.segsIn = (u1, u2) => {
    const o = [];
    for (let idx = Math.floor(u1 / segLen) - 1; idx <= Math.floor(u2 / segLen) + 1; idx++) {
      const s = seg(idx); s.ova = s.ovb = col.ov ?? 0.5;
      if (tF !== undefined) { if (s.a >= tF) continue; if (s.b > tF) { s.b = tF; s.ovb = 0.12; } }
      o.push(s);
    }
    if (tF !== undefined && u2 >= tF - 1) o.push({ a: tF, b: dur + 12, ch: CHD2.D69, pi: -1, idx: 'F', ova: 0.12, ovb: 1.0 });
    return o;
  };
  C.chordAt = (u) => { if (tF !== undefined && u >= tF) return { ch: CHD2.D69, pi: -1 }; const idx = Math.floor(u / segLen); return { ch: prog[modI(idx, prog.length)], pi: modI(idx, prog.length) }; };
  C.tonicStarts = () => { const o = []; for (let idx = 0; idx * segLen < dur; idx++) if (modI(idx, prog.length) === col.tonic && (tF === undefined || idx * segLen < tF - 2)) o.push(idx * segLen); return o; };
  C.barStarts = () => { const o = []; for (let u = 0; u < dur; u += bar) o.push(u); return o; };
  return C;
}
/** iterate a rhythmic grid: div steps per beat; fn(u, k, stepInBar, I, chordInfo, rnd01) */
function gridNotes(RC, C, div, fn, from = -9) {
  const st = C.beat / div, u1 = RC.u0 + RC.n / SR, k0 = Math.floor(RC.u0 / st) - 1, k1 = Math.ceil(u1 / st) + 1, per = div * 4;
  for (let k = k0; k <= k1; k++) {
    const u = k * st; if (u < from || (C.tF !== undefined && u >= C.tF - 0.04)) continue;
    fn(u, k, modI(k, per), RC.ik(u), C.chordAt(u), hr(k, div + 11 * RC.seed % 7));
  }
}

// ---- pad: soft additive kinds, per chord segment with smooth overlap
const PAD_A = { warm: [1, 0.25, -0.11, 0.04], air: [1, 0.3, 0.12, 0], glass: [1, 0, 0, 0.04], hot: [1, 0.45, 0.25, 0.12], thin: [1, 0.2, 0, 0], wobbly: [1, 0.35, 0.08, 0], open: [1, 0.2, 0, 0] };
function padLayer(RC, C, o) {
  const { u0, n, M } = RC, L = new Float32Array(n), R = new Float32Array(n), kind = o.kind, A = PAD_A[kind] || null;
  const dL = o.detL || [-6, 4], dR = o.detR || [-4, 6];
  for (const sg of C.segsIn(u0 - 4, u0 + n / SR + 4)) {
    const ova = sg.ova, ovb = sg.ovb, i0 = Math.max(0, Math.round((sg.a - ova - u0) * SR)), i1 = Math.min(n, Math.round((sg.b + ovb - u0) * SR)); if (i1 <= i0) continue;
    const envS = new Float32Array(i1 - i0);
    for (let i = i0; i < i1; i++) { const u = u0 + i / SR; envS[i - i0] = smooth((u - (sg.a - ova)) / (2 * ova)) * (1 - smooth((u - (sg.b - ovb)) / (2 * ovb))); }
    let notes = voiceN(sg.ch, o.lo + M.reg, o.hi + M.reg, o.maxN);
    if (M.open > 0.3) notes = [sg.ch.bass + 12 + M.reg, sg.ch.bass + 19 + M.reg, sg.ch.bass + 24 + M.reg];
    for (const m of notes) {
      const f0 = mtof(m), lo = m < 52;
      for (let side = 0; side < 2; side++) {
        const dets = side ? dR : dL, tgt = side ? R : L;
        for (let v = 0; v < dets.length; v++) {
          const f = f0 * POW(2, dets[v] / 1200), dt = f / SR; let ph = (m * 0.137 + v * 0.31 + side * 0.17) % 1;
          const amp = (lo ? 0.9 : 0.55) / dets.length * (kind === 'air' || kind === 'glass' || kind === 'warm' ? 1.4 : 1);
          for (let i = i0; i < i1; i++) {
            const e = envS[i - i0]; if (e <= 0) { ph += dt; if (ph >= 1) ph -= 1; continue; }
            const u = u0 + i / SR; let s, g = e * amp, adv = dt;
            if (kind === 'str') { s = blepSaw(ph, dt); adv = dt * (1 + 0.0035 * SIN(TAU * 5.2 * u + m)); }
            else {
              const x = TAU * ph, s1 = SIN(x), c1 = COS(x), s2 = 2 * s1 * c1, c2 = c1 * c1 - s1 * s1, s3 = s2 * c1 + c2 * s1, s4 = 2 * s2 * c2;
              s = A[0] * s1 + A[1] * s2 + A[2] * s3 + A[3] * s4;
              if (kind === 'wobbly') { adv = dt * (1 + 0.010 * SIN(TAU * (0.5 + 0.07 * (m % 5)) * u + m) + 0.004 * SIN(TAU * 0.13 * u + m * 2)); g *= 0.8 + 0.2 * SIN(TAU * 0.33 * u + m); }
              else if (kind === 'hot') { adv = dt * (1 + 0.003 * SIN(TAU * 5.5 * u + m)); g *= 0.85 + 0.15 * SIN(TAU * (4.2 + 0.4 * (m % 4)) * u + m * 1.3); }
              else if (kind === 'air' || kind === 'glass' || kind === 'open') g *= 0.85 + 0.15 * SIN(TAU * 0.27 * u + m * 1.7 + side);
            }
            tgt[i] += s * g; ph += adv; if (ph >= 1) ph -= 1;
          }
        }
      }
    }
  }
  const fcF = (t) => (o.fc[0] + (o.fc[1] - o.fc[0]) * POW(RC.ik(u0 + t), 1.25)) * M.fc;
  const fL = filt(L, 'lp', fcF, 0.8), fR = filt(R, 'lp', fcF, 0.8);
  normRms(fL, fR, o.dB);
  for (let i = 0; i < n; i++) { const u = u0 + i / SR, g = (0.4 + 0.6 * RC.ik(u)) * (o.gainFn ? o.gainFn(u) : 1); RC.dry.L[i] += fL[i] * g; RC.dry.R[i] += fR[i] * g; }
}

// ---- sub: 'hits' (per-step soft sub notes), 'hold' (continuous), 'swell' (breathing once per chord segment)
function subLayer(RC, C, o) {
  const { u0, n } = RC;
  if (o.kind === 'hits') {
    const st = C.beat / o.div, u1 = u0 + n / SR, k0 = Math.floor(u0 / st) - 1, k1 = Math.ceil(u1 / st) + 1;
    for (let k = k0; k <= k1; k++) {
      const u = k * st; if (u < -0.3 || (C.tF !== undefined && u >= C.tF - 0.04)) continue;
      const I = RC.ik(u), a = o.fn(modI(k, o.div * 4), I, k, u); if (!(a > 0)) continue;
      const m = o.fixed ?? C.chordAt(u).ch.bass; RC.lowNote('sub', m + (o.oct || 0), u, a * db2g(o.dB) * (0.55 + 0.45 * I));
    }
    return;
  }
  const L = new Float32Array(n);
  for (const sg of C.segsIn(u0 - 4, u0 + n / SR + 4)) {
    const ova = Math.max(sg.ova, o.ov ?? 0.8), ovb = Math.max(sg.ovb, o.ov ?? 0.8), i0 = Math.max(0, Math.round((sg.a - ova - u0) * SR)), i1 = Math.min(n, Math.round((sg.b + ovb - u0) * SR)); if (i1 <= i0) continue;
    const f = mtof((o.fixed ?? sg.ch.bass) + (o.oct || 0)); let ph = 0;
    for (let i = i0; i < i1; i++) {
      const u = u0 + i / SR, e = smooth((u - (sg.a - ova)) / (2 * ova)) * (1 - smooth((u - (sg.b - ovb)) / (2 * ovb)));
      ph += TAU * f / SR; if (e <= 0) continue;
      let mul = 1;
      if (o.kind === 'swell') { const x = clamp((u - sg.a) / (sg.b - sg.a), 0, 1); mul = 0.3 + 0.7 * POW(SIN(PI * x), 2); }
      else mul = 0.88 + 0.12 * SIN(TAU * 0.15 * u);
      L[i] += (SIN(ph) + (o.h2 ?? 0.35) * SIN(2 * ph) + 0.1 * SIN(3 * ph)) * e * mul;
    }
  }
  normRms(L, L, o.dB);
  for (let i = 0; i < n; i++) { const g = (o.g0 ?? 0.5) + (o.g1 ?? 0.5) * RC.ik(u0 + i / SR); RC.low.L[i] += L[i] * g; RC.low.R[i] += L[i] * g; }
}

// ---- the motif
function motifStmt(RC, C, st) {
  const iv = st.iv || SUN_IV; let t = st.u;
  for (let k = 0; k < 5; k++) {
    const tu = st.quant ? Math.round(t / (C.beat / 4)) * (C.beat / 4) : t;
    for (const ly of st.layers) {
      const m = st.base + iv[k] + (ly.oct || 0);
      RC.note(ly.inst, m, tu + (ly.lag || 0), (ly.vel ?? 0.9) * (k === 4 ? 1.06 : 1), (ly.pan ?? 0) + 0.12 * (k - 2) / 2, { dB: ly.dB, cents: ly.cents || 0, echo: ly.echo || 0 });
    }
    t += SUN_BT[k] * C.beat / (st.speed || 1);
  }
}
const motifLen = (C, speed = 1) => SUN_BT.reduce((s, b) => s + b, 0) * C.beat / speed;
/** statement times: [first, one at the arc peak (snapped to a tonic bar), one late], >= 2, gap >= `gap` s */
function planStmts(RC, C, o) {
  const dur = RC.dur, len = o.len, gap = o.gap ?? 8, out = [o.first], ok = (u) => out.every((v) => Math.abs(v - u) >= gap) && u + len * 0.7 <= dur + 0.5;
  const ts = C.tonicStarts();
  let bu = 0, best = -1; for (let t = Math.max(0.5, 0.2 * dur); t <= dur - len * 0.7; t += 0.1) { const I = RC.ik(t); if (I > best + 1e-9) { best = I; bu = t; } }
  const byDist = (x) => ts.slice().sort((p, q) => Math.abs(p - x) - Math.abs(q - x));
  for (const a of byDist(bu)) if (ok(a)) { out.push(a); break; }
  if (dur > (o.lateMin ?? 18)) { const late = ts.filter((a) => a >= 0.7 * dur && ok(a)); if (late.length) out.push(late[late.length - 1]); }
  if (out.length < 2) { const bs = C.barStarts().sort((p, q) => Math.abs(p - 0.55 * dur) - Math.abs(q - 0.55 * dur)); for (const a of bs) if (ok(a)) { out.push(a); break; } }
  return out.sort((a, b) => a - b);
}


// ---- mood modifiers: applied on top of a colour only when the cue file's mood is not one of the colour's natural moods
const M_NEUTRAL = { fc: 1, dens: 1, reg: 0, open: 0, rv: 0, dB: 0, perc: 1, bells: 0, felt: 0, timp: 0, pulse: 0, ticks: 0 };
const M_TABLE = {
  wonder: { bells: 1, rv: 0.2 }, bright: { dens: 1.25, fc: 1.15 }, tense: { dens: 0.7, fc: 0.8, pulse: 1, ticks: 1 },
  dark: { fc: 0.6, reg: -12, dB: -2, perc: 0 }, hollow: { open: 1, dens: 0.4, rv: 0.25, fc: 0.7 }, warm: { felt: 1 },
  epic: { dB: 1.5, timp: 1 }, quiet: { dB: -10, dens: 0.25, perc: 0, fc: 0.7 },
};
function moodMods(mood, nat) {
  const M = { ...M_NEUTRAL }; if (nat.includes(mood) || !M_TABLE[mood]) return M;
  const T = M_TABLE[mood], S6 = 0.6;
  for (const k in T) { if (k === 'reg') M.reg = T.reg; else M[k] = M_NEUTRAL[k] + (T[k] - M_NEUTRAL[k]) * S6; }
  return M;
}
function moodExtras(RC, C, M) {
  if (M.bells > 0.05) gridNotes(RC, C, 2, (u, k, s, I, cd, r) => { if (r < 0.07 * M.bells * (0.4 + I)) { const t = tonesIn(cd.ch, 76, 93); if (t.length) RC.note('bell', t[Math.floor(hr(k, 5) * t.length)], u, 0.5, hr(k, 6) * 1.2 - 0.6, { dB: -24, echo: 0.5 }); } });
  if (M.pulse > 0.05) subLayer(RC, C, { kind: 'hits', div: 2, fn: (s, I) => (s % 2 === 0 ? (s === 0 ? 1 : 0.7) : 0) * (0.3 + 0.7 * I), dB: -31 });
  if (M.ticks > 0.05) gridNotes(RC, C, 1, (u, k, s, I) => { if (I > 0.15) RC.perc('tick', u, 0.08 * M.ticks, k % 2 ? 0.3 : -0.3, k % 3); });
  if (M.timp > 0.05) gridNotes(RC, C, 1, (u, k, s, I, cd) => { if (s % 8 === 0 && I > 0.45) RC.lowNote('timp', cd.ch.bass + 12, u, 0.2 * M.timp * I); });
  if (M.felt > 0.05) gridNotes(RC, C, 1, (u, k, s, I, cd) => { if (s % 4 === 0) { const t = tonesIn(cd.ch, 52, 67); for (let j = 0; j < Math.min(2, t.length); j++) RC.note('felt', t[j], u + j * 0.03, 0.4, -0.15 + 0.3 * j, { dB: -24, echo: 0.3 }); } });
}
function sizzleLayer(RC, dB) {
  const { u0, n } = RC, rnd = mulberry32(RC.seed + 99), a = filt(filt(white(rnd, n), 'bp', 3500, 1.2), 'lp', 5200, 0.7), b = filt(filt(white(rnd, n), 'bp', 3300, 1.2), 'lp', 5200, 0.7), m = smoothRand(rnd, n, 9);
  for (let i = 0; i < n; i++) { const I = RC.ik(u0 + i / SR), cr = m[i] * m[i] * 2.2, g = (0.1 + 0.9 * POW(I, 1.5)) * cr; a[i] *= g; b[i] *= g; }
  normRms(a, b, dB);
  for (let i = 0; i < n; i++) { const g = 0.15 + 0.85 * POW(RC.ik(u0 + i / SR), 1.2); RC.dry.L[i] += a[i] * g; RC.dry.R[i] += b[i] * g; }
}
function noiseSwell(RC, uEnd, len, g, fcMax = 5800) { // cymbal-like swell (soft), ends at uEnd
  const n = Math.round(len * SR), rnd = mulberry32(RC.seed + 41), a = filt(white(rnd, n), 'bp', (t) => 900 + (fcMax - 900) * POW(t / len, 1.5), 0.8), b = filt(white(rnd, n), 'bp', (t) => 1000 + (fcMax - 1000) * POW(t / len, 1.5), 0.8);
  for (let i = 0; i < n; i++) { const e = POW(i / n, 2.6) * (1 - smooth((i / n - 0.96) / 0.04)); a[i] *= e; b[i] *= e; }
  const [x, y] = [a, b], p = peakOf(x, y) || 1; for (let i = 0; i < n; i++) { x[i] /= p; y[i] /= p; }
  RC.add(RC.dry, x, uEnd - len, g, -0.4); RC.add(RC.dry, y, uEnd - len, g, 0.4);
}

// ---- the eight colours
const LONG_PAT = [0, 1, 2, 3, 2, 1, 3, 2];
const arpPick = (cd, lo, hi, idx) => { const t = tonesIn(cd.ch, lo, hi); return t.length ? t[((idx % t.length) + t.length) % t.length] : 60; };
const COLS = [
  { // c1: curious / bold
    name: 'curious', bpm: 100, bars: 1, prog: ['Dadd9', 'Bm7', 'Gmaj7', 'Asus4'], tonic: 0, nat: ['bright', 'wonder'], lvl: 0, rv: 0.4, ov: 0.35,
    run(RC, C, M, ch) {
      padLayer(RC, C, { kind: 'warm', fc: [650, 2400], dB: -31, lo: 50, hi: 76, maxN: 4 });
      subLayer(RC, C, { kind: 'hits', div: 1, fn: (s, I) => (s % 4 === 0 ? 1 : s % 4 === 2 && I > 0.55 ? 0.7 : 0), dB: -27 });
      gridNotes(RC, C, 2, (u, k, s, I, cd, r) => {
        const on = s % 2 === 0; if (I < 0.08 || (!on && r > lerp(0.35, 0.95, I) * M.dens)) return;
        const idx = LONG_PAT[s % 8], t = tonesIn(cd.ch, 57, 84), m = t[Math.min(t.length - 1, idx + (I > 0.7 && s === 4 ? 1 : 0))];
        RC.note('marimba', m, u, (on ? 0.8 : 0.55) * (0.5 + 0.5 * I), Math.sin(k * 1.3) * 0.35, { dB: -19, echo: 0.5 });
      });
      if (M.perc > 0.3) {
        gridNotes(RC, C, 4, (u, k, s, I, cd, r) => { if (I > 0.45 && r < 0.9) RC.perc('shaker', u, 0.1 * [1, 0.4, 0.7, 0.4][s % 4] * M.perc, s % 2 ? 0.3 : -0.3, k % 3); });
        gridNotes(RC, C, 1, (u, k, s, I) => { if (I > 0.6 && s % 2 === 0) RC.perc('kick', u, 0.14 * M.perc * (s % 4 === 0 ? 1 : 0.7)); });
      }
      for (const sg of C.segsIn(RC.u0, RC.u0 + RC.n / SR)) if (RC.ik(sg.a) > 0.7 && sg.a > 0) { const t = tonesIn(sg.ch, 81, 93); if (t.length) RC.note('bell', t[sg.idx % t.length], sg.a, 0.6, 0.3, { dB: -25, echo: 0.5 }); }
      gridNotes(RC, C, 1, (u, k, s, I, cd) => { if (s % 4 === 0) { const t = tonesIn(cd.ch, 50, 66); for (let j = 0; j < Math.min(2, t.length); j++) RC.note('felt', t[j], u + j * 0.025, 0.4 + 0.2 * I, -0.2 + 0.4 * j, { dB: -25, echo: 0.3 }); } });
      return { motif: { first: 0.45, base: 74, speed: 1, layers: [{ inst: 'marimba', dB: -17, echo: 0.5 }, { inst: 'felt', oct: -12, dB: -22, lag: 0.01 }] } };
    },
  },
  { // c2: mechanical / airy clockwork
    name: 'mechanical', bpm: 96, bars: 1, prog: ['Gmaj7', 'Em9', 'Clyd', 'D69'], tonic: 3, nat: ['wonder', 'bright'], lvl: -2.5, rv: 0.45, ov: 0.3,
    run(RC, C, M) {
      padLayer(RC, C, { kind: 'air', fc: [900, 3200], dB: -32, lo: 62, hi: 88, maxN: 3 });
      const ORDER = [0, 8, 4, 12, 2, 10, 6, 14, 1, 3, 5, 7, 9, 11, 13, 15];
      gridNotes(RC, C, 4, (u, k, s, I, cd) => {
        const act = Math.round(lerp(6, 16, I) * clamp(M.dens, 0.3, 1.3)); if (ORDER.indexOf(s) >= act || I < 0.05) return;
        const bar = Math.floor(k / 16), m = arpPick(cd, 72, 93, s + bar * 3);
        RC.note('musicbox', m, u, 0.6, (s % 2 ? 1 : -1) * 0.3, { dB: -22, echo: 0.35 });
      });
      if (M.perc > 0.3) gridNotes(RC, C, 1, (u, k, s, I) => { if (I > 0.3) RC.perc('tick', u, 0.1 * M.perc, k % 2 ? 0.35 : -0.35, k % 2); });
      subLayer(RC, C, { kind: 'hold', dB: -34, g0: 0.4, g1: 0.5 });
      return { motif: { first: null, base: 74, speed: 1, quant: true, layers: [{ inst: 'musicbox', oct: 12, dB: -20, echo: 0.4 }, { inst: 'marimba', oct: -12, dB: -21 }] } };
    },
  },
  { // c3: woozy / drifting
    name: 'woozy', bpm: 66, bars: 2, prog: ['Dmaj9', 'Fsm7', 'Bm9', 'Em9'], tonic: 0, nat: ['warm', 'hollow'], lvl: -1.5, rv: 0.55, ov: 0.9,
    run(RC, C, M) {
      padLayer(RC, C, { kind: 'wobbly', fc: [500, 1500], dB: -29, lo: 48, hi: 74, maxN: 4, detL: [-18, 12], detR: [-12, 20] });
      gridNotes(RC, C, 2, (u, k, s, I, cd, r) => {
        if (r > lerp(0.18, 0.5, I) * 0.5 * M.dens) return;
        const t = tonesIn(cd.ch, 55, 79), m = t[Math.floor(hr(k, 7) * t.length)], hum = (hr(k, 8) - 0.5) * 0.06, cents = (hr(k, 9) - 0.5) * 55;
        RC.note('felt', m, u + hum + (s % 2 ? C.beat * 0.07 : 0), 0.4 + 0.3 * hr(k, 10), (hr(k, 11) - 0.5) * 0.8, { dB: -21, echo: 0.4, cents });
      });
      if (M.perc > 0.3) gridNotes(RC, C, 1, (u, k, s, I) => { if ((s % 4 === 1 || s % 4 === 3) && I > 0.2) RC.perc('brush', u + (hr(k, 3) - 0.5) * 0.02, 0.09 * (0.5 + I) * M.perc, 0.2 * (s % 8 === 1 ? -1 : 1), k % 3); });
      subLayer(RC, C, { kind: 'swell', dB: -31, g0: 0.5, g1: 0.5, ov: 1.2 });
      return { motif: { first: null, base: 66, speed: 0.72, layers: [{ inst: 'felt', dB: -20, cents: 14, echo: 0.4 }, { inst: 'felt', oct: 12, dB: -24, cents: -16, lag: 0.02 }, { inst: 'vibes', oct: 12, dB: -26 }] } };
    },
  },
  { // c4: hot / shimmering
    name: 'hot', bpm: 84, bars: 1, prog: ['Dadd9', 'CaddD', 'GaddD', 'AsusD'], tonic: 0, nat: ['tense', 'dark'], lvl: -0.5, rv: 0.4, ov: 0.45,
    run(RC, C, M) {
      padLayer(RC, C, { kind: 'hot', fc: [900, 3800], dB: -30, lo: 52, hi: 80, maxN: 4 });
      sizzleLayer(RC, -42);
      gridNotes(RC, C, 2, (u, k, s, I, cd, r) => {
        if (I < 0.1 || r > lerp(0.4, 0.8, I) * M.dens) return;
        const t = tonesIn(cd.ch, 62, 86); RC.note('vibes', t[Math.floor(hr(k, 12) * t.length)], u, 0.55 + 0.3 * I, Math.sin(k * 0.9) * 0.45, { dB: -21, echo: 0.4 });
      });
      if (M.perc > 0.3) gridNotes(RC, C, 4, (u, k, s, I, cd, r) => { if (I > 0.4 && r < 0.85) RC.perc('shakerSoft', u, 0.09 * M.perc * (s % 2 ? 0.5 : 1), s % 2 ? 0.3 : -0.3, k % 2); });
      subLayer(RC, C, { kind: 'hold', fixed: 38, dB: -29, g0: 0.55, g1: 0.45 });
      return { motif: { first: null, base: 86, speed: 1, layers: [{ inst: 'vibes', dB: -19, echo: 0.5 }, { inst: 'marimba', oct: -12, dB: -22 }] } };
    },
  },
  { // c5: cold / glassy / lonely
    name: 'cold', bpm: 60, bars: 2, prog: ['Dm9', 'Bbmaj7', 'Gm9', 'Asus4'], tonic: 0, nat: ['hollow', 'dark', 'quiet'], lvl: -3.5, rv: 0.7, ov: 1.0,
    run(RC, C, M) {
      padLayer(RC, C, { kind: 'glass', fc: [600, 2600], dB: -33, lo: 62, hi: 90, maxN: 3, detL: [-5, 5], detR: [-3, 7] });
      gridNotes(RC, C, 2, (u, k, s, I, cd, r) => {
        if (r > lerp(0.075, 0.2, I) * M.dens) return;
        const t = tonesIn(cd.ch, 72, 91); RC.note('bell', t[Math.floor(hr(k, 13) * t.length)], u, 0.45 + 0.4 * hr(k, 14), (hr(k, 15) - 0.5) * 1.4, { dB: -21, echo: 0.55 });
      });
      subLayer(RC, C, { kind: 'swell', fixed: 26, dB: -29, h2: 0.7, g0: 0.45, g1: 0.55, ov: 1.4 });
      return { motif: { first: null, base: 74, speed: 0.6, iv: [0, 2, 3, 7, 9], layers: [{ inst: 'bell', dB: -19, echo: 0.6 }, { inst: 'felt', oct: -12, dB: -25 }] } };
    },
  },
  { // c6: restless / storm
    name: 'restless', bpm: 116, bars: 1, prog: ['Bm7', 'Gmaj7', 'Dadd9', 'Asus4'], tonic: 2, nat: ['tense', 'bright'], lvl: 0, rv: 0.35, ov: 0.25,
    run(RC, C, M) {
      padLayer(RC, C, { kind: 'thin', fc: [700, 2600], dB: -33, lo: 50, hi: 78, maxN: 3 });
      const MASK = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0];
      gridNotes(RC, C, 4, (u, k, s, I, cd, r) => {
        if (!MASK[s] || I < 0.08 || r > (0.55 + 0.45 * I) * M.dens + 0.2) return;
        const bar = Math.floor(k / 16), m = arpPick(cd, 60, 84, s + bar * 2);
        RC.note(bar % 2 ? 'kalimba' : 'marimba', m, u, 0.55 + 0.3 * I, Math.sin(k * 0.7) * 0.4, { dB: -20, echo: 0.3 });
      });
      if (M.perc > 0.3) {
        gridNotes(RC, C, 2, (u, k, s, I) => { if ([0, 3, 6].includes(s % 8)) RC.perc('puff', u, 0.2 * (0.4 + 0.6 * I) * M.perc, s % 2 ? 0.3 : -0.3, k % 3); });
        gridNotes(RC, C, 1, (u, k, s, I) => { if (s % 4 === 0 && I > 0.5) RC.perc('gust', u, 0.16 * M.perc, k % 8 ? -0.3 : 0.3); });
      }
      subLayer(RC, C, { kind: 'hits', div: 4, fn: (s, I) => ([0, 3, 6, 10, 13].includes(s % 16) ? 1 : 0) * (0.4 + 0.6 * I), dB: -27 });
      return { motif: { first: null, base: 74, speed: 1.5, layers: [{ inst: 'marimba', dB: -18 }, { inst: 'kalimba', oct: 12, dB: -23, echo: 0.3 }] } };
    },
  },
  { // c7: awe, building to a payoff when the oceans move
    name: 'awe', bpm: 88, bars: 2, prog: ['Dadd9', 'Aadd9', 'Bm9', 'Glyd'], tonic: 0, nat: ['wonder', 'epic'], lvl: -2.5, rv: 0.55, ov: 0.7,
    run(RC, C, M, ch) {
      const dur = RC.dur, Bm = (u) => 0.55 + 0.6 * (u / dur);
      let P = null;
      for (const [a, b, x] of ch.arc) if (x >= 0.8 && a >= 0.55 * dur) { P = a; break; }
      if (P === null) P = 0.7 * dur;
      { const segs = C.segsIn(0, dur).filter((s) => s.a > 0), c = segs.sort((p, q) => Math.abs(p.a - P) - Math.abs(q.a - P))[0]; if (c && Math.abs(c.a - P) < 1.5) P = c.a; }
      RC.payoff = P;
      padLayer(RC, C, { kind: 'str', fc: [500, 3600], dB: -30, lo: 48, hi: 79, maxN: 4, gainFn: (u) => Bm(u) });
      gridNotes(RC, C, 2, (u, k, s, I, cd, r) => { // early bells
        if (u > 0.5 * dur || r > lerp(0.04, 0.14, I) * M.dens) return;
        const t = tonesIn(cd.ch, 74, 91); RC.note('bell', t[Math.floor(hr(k, 16) * t.length)], u, 0.5, (hr(k, 17) - 0.5) * 1.2, { dB: -22, echo: 0.5 });
      });
      gridNotes(RC, C, 2, (u, k, s, I, cd, r) => { // harp arpeggio, density rising with the build
        const dn = lerp(0.12, 0.85, u / dur) * (0.4 + 0.6 * I) * M.dens; if (r > dn) return;
        const t = tonesIn(cd.ch, 55, 81), m = t[Math.min(t.length - 1, LONG_PAT[s % 8])];
        RC.note('harp', m, u, 0.5 + 0.35 * (u / dur), Math.sin(k * 1.1) * 0.4, { dB: -21, echo: 0.4 });
      });
      subLayer(RC, C, { kind: 'hold', dB: -32, g0: 0.4, g1: 0.6 });
      // timpani rolls at section starts once the build is under way
      for (const sg of C.segsIn(0, dur)) if (sg.a > 0.3 * dur && sg.a < P - 2 && sg.idx % 2 === 0 && RC.ik(sg.a) > 0.5 && M.perc > 0.3) for (let j = 0; j < 7; j++) RC.lowNote('timp', sg.ch.bass + 12, sg.a + j * 0.09, 0.025 + 0.01 * j);
      // payoff
      noiseSwell(RC, P, 3.0, 0.05);
      RC.lowNote('timp', 38, P, 0.13); for (let j = 0; j < 9; j++) RC.lowNote('timp', 38 + (j % 2) * 7, P + 0.4 + j * 0.1, 0.04 + 0.006 * j);
      RC.lowNote('boom', 26, P, 0.12);
      { // choir swell
        const rnd = mulberry32(RC.seed + 61), len = 5, [cl, cr] = choir(rnd, len, { k: 6, f0: [146, 220], v: ['a', 'o'], vib: 0.01, breath: 0.15, spread: 0.3, env: (t) => smooth(t / 1.5) * (1 - smooth((t - 3.6) / 1.4)) });
        const l = filt(cl, 'lp', 3500, 0.7), r = filt(cr, 'lp', 3500, 0.7), p = peakOf(l, r) || 1;
        for (let i = 0; i < l.length; i++) { l[i] /= p; r[i] /= p; }
        RC.add(RC.dry, l, P - 0.8, 0.07, -0.3); RC.add(RC.dry, r, P - 0.8, 0.07, 0.3);
      }
      return { motif: { first: null, base: 74, speed: 1, layers: [{ inst: 'harp', dB: -19, echo: 0.4 }, { inst: 'bell', oct: 12, dB: -23, echo: 0.5 }], list: (RC2, C2) => { const ts = C2.tonicStarts().filter((a) => a > 2 && a < P - 6); const l = []; if (ts.length) l.push(ts[0]); if (ts.length > 2) l.push(ts[Math.floor(ts.length / 2)]); l.push(P); return l; }, big: P } };
    },
  },
  { // c8: resolved / warm
    name: 'resolved', bpm: 80, bars: 2, prog: ['Dadd9', 'Gmaj7', 'Bm7', 'Asus4'], tonic: 0, nat: ['warm', 'quiet'], lvl: 0, rv: 0.5, ov: 0.8, final: true,
    run(RC, C, M, ch) {
      const tF = C.tF;
      padLayer(RC, C, { kind: 'warm', fc: [600, 2300], dB: -31, lo: 48, hi: 74, maxN: 4 });
      padLayer(RC, C, { kind: 'str', fc: [450, 1800], dB: -37, lo: 55, hi: 76, maxN: 3, detL: [-9, 6], detR: [-6, 9] });
      gridNotes(RC, C, 1, (u, k, s, I, cd, r) => {
        if (r > 0.9 * M.dens) return;
        const t = tonesIn(cd.ch, 55, 79), m = t[Math.min(t.length - 1, [0, 1, 2, 3][(k % 4)])];
        RC.note('felt', m, u + (hr(k, 20) - 0.5) * 0.03, 0.45 + 0.25 * I, Math.sin(k) * 0.3, { dB: -21, echo: 0.4 });
      });
      if (M.perc > 0.3) gridNotes(RC, C, 1, (u, k, s, I) => { if ((s % 4 === 1 || s % 4 === 3) && I > 0.25) RC.perc('brush', u, 0.07 * M.perc, 0.2, k % 3); });
      subLayer(RC, C, { kind: 'hold', dB: -33, g0: 0.45, g1: 0.55 });
      // final chord
      if (tF !== undefined) {
        const vs = [50, 57, 62, 66, 69, 74]; vs.forEach((m, j) => RC.note('felt', m, tF + j * 0.035, 0.8 - j * 0.04, -0.4 + j * 0.16, { dB: -19, echo: 0.3 }));
        RC.note('bell', 78, tF + 0.05, 0.6, 0.2, { dB: -23, echo: 0.5 }); RC.note('bell', 86, tF + 1.0, 0.7, -0.15, { dB: -22, echo: 0.6 });
        RC.lowNote('subLong', 38, tF, 0.15);
      }
      return { motif: { first: 0.8, base: 74, speed: 1, layers: [{ inst: 'felt', dB: -18, echo: 0.4 }, { inst: 'marimba', oct: 12, dB: -23 }], list: (RC2, C2) => { const l = [0.8]; if (tF !== undefined) l.push(tF - 3 * C2.beat); return l; }, finalAt: tF } };
    },
  },
];
const colIndexOf = (id, k) => { const m = /c(\d+)/i.exec(id || ''); return m ? (+m[1] - 1) % 8 : modI(k || 0, 8); };
const DEFAULTS_BY_COL = [['bright', 'city'], ['wonder', 'indoor'], ['warm', 'night'], ['tense', 'desert'], ['hollow', 'wind'], ['tense', 'wind'], ['wonder', 'ocean'], ['warm', 'city']];

const MUSIC_TARGET_DB = -28; // median 1 s block RMS of a chapter's music before ducking / loudness gain
const musicInfo = {};
/** render one chapter's music into stereo buffers covering [T0, T0 + n/SR] (absolute); env = crossfade envelope. Returns [L,R]. */
function renderMusic(ch, T0, n, env, seedBase, colIdx) {
  const col = COLS[colIdx], M = moodMods(ch.mood, col.nat), ik = makeIk(ch.arc, ch.dur);
  let tF; if (col.final && ch.tF !== undefined) tF = ch.tF;
  const C = makeC(col, ch.dur, tF), RC = mkRC(ch, T0, n, seedBase | 0, ik, M);
  const res = col.run(RC, C, M, ch) || {};
  moodExtras(RC, C, M);
  // motif statements
  const mo = res.motif, info = { colour: col.name, mood: ch.mood, moodMods: ch.mood && !col.nat.includes(ch.mood) ? ch.mood : 'natural', motif: [] };
  if (mo) {
    const len = motifLen(C, mo.speed);
    let list;
    if (mo.list) list = mo.list(RC, C);
    else { const first = mo.first ?? (C.tonicStarts().find((a) => a > 1.2) ?? 1.2); list = planStmts(RC, C, { first, len, gap: 8 }); }
    list.forEach((u, j) => { const big = mo.big !== undefined && u === mo.big; const layers = big ? [...mo.layers, { inst: 'felt', oct: -12, dB: -19 }, { inst: 'marimba', oct: 12, dB: -21 }] : mo.layers; motifStmt(RC, C, { u, base: mo.base, speed: mo.speed, iv: mo.iv, quant: mo.quant, layers }); info.motif.push(+u.toFixed(2)); });
    if (mo.finalAt !== undefined) { /* final high D handled in the colour */ }
  }
  musicInfo[ch.id] = info;
  // ping-pong dotted-8th echo from the echo send
  const dly = Math.round(C.beat * 0.75 * SR), oL = new Float32Array(n), oR = new Float32Array(n);
  for (let i = dly; i < n; i++) { oL[i] = RC.echo.R[i - dly] + 0.42 * oR[i - dly]; oR[i] = RC.echo.L[i - dly] + 0.42 * oL[i - dly]; }
  const eL = filt(oL, 'lp', 3600, 0.7), eR = filt(oR, 'lp', 3600, 0.7);
  const send = new Float32Array(n);
  for (let i = 0; i < n; i++) send[i] = 0.5 * (RC.dry.L[i] + RC.dry.R[i]) + 0.3 * 0.5 * (RC.pcb.L[i] + RC.pcb.R[i]) + 0.5 * (eL[i] + eR[i]);
  const [wl, wr] = convWet(send, 0), rv = col.rv + M.rv;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = RC.dry.L[i] + eL[i] * 0.6 + RC.pcb.L[i] + RC.low.L[i] + wl[i] * rv * 0.42;
    R[i] = RC.dry.R[i] + eR[i] * 0.6 + RC.pcb.R[i] + RC.low.R[i] + wr[i] * rv * 0.42;
  }
  filt(L, 'lp', 6500, 0.707, L); filt(R, 'lp', 6500, 0.707, R); filt(L, 'hp', 30, 0.707, L); filt(R, 'hp', 30, 0.707, R);
  // level: median 1 s block RMS over the chapter proper -> target
  const blocks = [], a0 = Math.max(0, Math.round((0 - RC.u0) * SR)), a1 = Math.min(n, Math.round((ch.dur - RC.u0) * SR));
  for (let s = a0; s + SR <= a1; s += SR) { let e = 0; for (let i = s; i < s + SR; i++) e += 0.5 * (L[i] * L[i] + R[i] * R[i]); blocks.push(Math.sqrt(e / SR)); }
  blocks.sort((x, y) => x - y);
  const med = blocks.length ? blocks[Math.floor(blocks.length / 2)] : rmsOf(L) || 1e-6, gain = db2g(MUSIC_TARGET_DB + col.lvl + M.dB) / (med || 1e-6);
  for (let i = 0; i < n; i++) { const e = env ? env[i] * gain : gain; L[i] *= e; R[i] *= e; }
  info.median_dBFS_before = +g2db(med).toFixed(1);
  return [L, R];
}

/** mood riser (hook riser code generalised): returns [L,R] normalised */
function riserSig(rnd, len, scale) {
  const n = Math.round(len * SR), nL = white(rnd, n), nR = white(rnd, n);
  const fc = (t) => 450 * POW(6500 / 450, POW(clamp(t / len, 0, 1), 1.4));
  const bL = filt(nL, 'bp', fc, 1.3), bR = filt(nR, 'bp', fc, 1.3), tl = new Float32Array(n), tr = new Float32Array(n);
  const f0 = 220, f1 = 880; let pa = 0, pb = 0, pc = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n, f = f0 * POW(f1 / f0, u * u * 0.4 + u * 0.6), dt = f / SR;
    pa += dt; pb += f * 1.006 / SR; pc += f * 0.994 / SR; pa %= 1; pb %= 1; pc %= 1;
    tl[i] = blepSaw(pa, dt) * 0.6 + blepSaw(pb, dt) * 0.4; tr[i] = blepSaw(pa, dt) * 0.6 + blepSaw(pc, dt) * 0.4;
  }
  const fT = (t) => 700 + 2400 * POW(clamp(t / len, 0, 1), 1.5), tfL = filt(tl, 'lp', fT, 1.0), tfR = filt(tr, 'lp', fT, 1.0);
  const l = new Float32Array(n), r = new Float32Array(n), nn = db2g(-1) / (peakOf(bL, bR) || 1), nt = 0.45 / (peakOf(tfL, tfR) || 1);
  for (let i = 0; i < n; i++) {
    const u = i / n, tail = Math.min(1, (n - i) / (0.03 * SR)), amp = POW(u, 2.3) * tail * smooth(i / (0.02 * SR));
    l[i] = (bL[i] * nn + tfL[i] * nt * 0.55) * amp; r[i] = (bR[i] * nn + tfR[i] * nt * 0.55) * amp;
  }
  normPeak(l, r, 0.2 * scale);
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
  } else if (type === 'desert') { // dry low wind + faint hot-air hiss + sparse insect ticks + low hum
    const wsm = smoothRand(rnd, n, 0.12), wsm2 = smoothRand(rnd, n, 0.15);
    comp(filt(white(rnd, n), 'bp', (t) => 380 + 110 * SIN(t * 0.5) + 70 * wsm[Math.min(n - 1, Math.round(t * SR))], 0.8), filt(white(rnd, n), 'bp', (t) => 420 + 100 * SIN(t * 0.43 + 1) + 60 * wsm2[Math.min(n - 1, Math.round(t * SR))], 0.8), -40, (t) => 0.35 + 0.65 * gust(t) ** 1.2);
    comp(filt(white(rnd, n), 'bp', 3500, 0.9), filt(white(rnd, n), 'bp', 3700, 0.9), -58, (t) => 0.5 + 0.5 * SIN(t * 0.6) * SIN(t * 0.21 + 0.4));
    const hum = filt(pink(rnd, n), 'lp', 150, 0.8); comp(hum, hum, -46);
    const ti = new Float32Array(n), tiR = new Float32Array(n); // sparse insect ticks (dry clicks, soft)
    events(1.6, (t) => { const f = 3000 + rnd() * 900, m = Math.round(0.03 * SR), s = new Float32Array(m); for (let i = 0; i < m; i++) { const tt = i / SR; s[i] = SIN(TAU * f * tt) * EXP(-tt / 0.006) * smooth(tt / 0.001); } const [a, b] = panG(rnd() * 1.6 - 0.8), g = 0.0035 * (0.5 + rnd()); const k = 2 + Math.floor(rnd() * 3); for (let j = 0; j < k; j++) { stamp(ti, t + j * 0.07, s.map((v) => v * a), g); stamp(tiR, t + j * 0.07, s.map((v) => v * b), g); } });
    for (let i = 0; i < n; i++) { L[i] += ti[i]; R[i] += tiR[i]; }
  } else if (type === 'night') { // crickets (3 voices, 3-pulse chirps) + low hum + faint breeze
    for (let v = 0; v < 3; v++) {
      const f = 4300 + 200 * v + 80 * rnd(), rate = 1.9 + 0.35 * v + 0.15 * rnd(), ph0 = rnd(), s = new Float32Array(n), pan = (v - 1) * 0.6, [ga, gb] = panG(pan), act = smoothRand(rnd, n, 0.08);
      for (let i = 0; i < n; i++) {
        const t = i / SR, p = (t * rate + ph0) % 1; if (p > 0.34) continue;
        const q = p / 0.34, e = Math.max(0, SIN(TAU * 1.5 * q - PI / 2) * 0.5 + 0.5) * smooth(q / 0.05) * (1 - smooth((q - 0.92) / 0.08));
        s[i] = SIN(TAU * f * t) * e * smooth((act[i] - 0.2) / 0.4);
      }
      const g = db2g(-52) / (rmsOf(s) || 1) * 0.55; for (let i = 0; i < n; i++) { L[i] += s[i] * g * ga; R[i] += s[i] * g * gb; }
    }
    const hum = filt(pink(rnd, n), 'lp', 200, 0.8); comp(hum, hum, -45);
    comp(filt(white(rnd, n), 'bp', 500, 0.8), filt(white(rnd, n), 'bp', 540, 0.8), -50, (t) => 0.4 + 0.6 * gust(t));
  } else if (type === 'ocean') { // slow surf swells (cycle ~8-10 s), foam hiss lagging the swell, deep rumble
    const per = 9 + rnd() * 1.2, cyc = (t, ph) => { const p = ((((t + ph) % per) + per) % per) / per; return p < 0.4 ? POW(p / 0.4, 2) : EXP(-(p - 0.4) / 0.2); };
    const sL = filt(white(rnd, n), 'lp', (t) => 500 + 1100 * cyc(t, 0), 0.7), sR = filt(white(rnd, n), 'lp', (t) => 500 + 1100 * cyc(t, 0.7), 0.7);
    comp(sL, sR, -36, (t) => 0.25 + 0.75 * cyc(t, 0));
    comp(filt(white(rnd, n), 'bp', 2500, 0.6), filt(white(rnd, n), 'bp', 2700, 0.6), -52, (t) => Math.max(0, cyc(t, -1.2)) ** 1.4);
    const lo = filt(pink(rnd, n), 'lp', 120, 0.8); comp(lo, lo, -44, (t) => 0.6 + 0.4 * cyc(t, 0));
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

// ------------------------------------------------------------------ v2 additions (video 2: "100-hour day"): scene sounds, all quiet and with soft highs
// Every synth reads its optional params from the cue (len, n) with sane defaults, so a bare {t, type} always works.
const stereoOf = (n, fn) => { const L = new Float32Array(n), R = new Float32Array(n); fn(L, R); return [L, R]; };
const sineMix = (f, harm) => (ph) => { let v = 0; for (let h = 0; h < harm.length; h++) v += harm[h] * SIN(ph * (h + 1)); return v; };

S.sunriseSwell = (c, rnd) => { // warm D add9 swell (a sunrise "breath"), one bell at the crest
  const len = LEN(c, 4.5, 1.5, 12), n = Math.round(len * SR), notes = [50, 57, 62, 64, 66, 69, 74], pk = 0.78 * len;
  const [L, R] = stereoOf(n, (L, R) => {
    notes.forEach((m, j) => {
      const f = mtof(m); for (let side = 0; side < 2; side++) {
        const det = POW(2, (side ? 4 : -4) * (1 + 0.3 * j) / 1200), tgt = side ? R : L; let ph = rnd() * TAU;
        for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f * det / SR; tgt[i] += (SIN(ph) + 0.28 * SIN(2 * ph) + 0.08 * SIN(3 * ph)) * (m < 55 ? 1 : 0.6) * 0.3; }
      }
    });
    for (let i = 0; i < n; i++) { const t = i / SR, e = POW(smooth(t / pk), 1.6) * (1 - smooth((t - pk) / (len - pk))); L[i] *= e; R[i] *= e; }
    const b = bellNote(86, 3.0, 0.6), s0 = Math.round(pk * SR), gb = 0.16;
    for (let i = 0; i < b.length && s0 + i < n; i++) { L[s0 + i] += b[i] * gb * 0.9; R[s0 + i] += b[i] * gb * 1.1; }
  });
  const fL = filt(L, 'lp', 3500, 0.7), fR = filt(R, 'lp', 3500, 0.7);
  emitS(fL, fR, 0.15, { bus: 'riser', send: 0.35 });
};
S.heatShimmer = (c, rnd) => {
  const len = LEN(c, 3.0, 0.5, 20), n = Math.round(len * SR);
  const [L, R] = stereoOf(n, (L, R) => {
    for (let ch = 0; ch < 2; ch++) {
      const a = filt(white(rnd, n), 'bp', 4800 + 300 * ch, 1.1), m = smoothRand(rnd, n, 11), s = ch ? R : L;
      for (let i = 0; i < n; i++) { const t = i / SR; s[i] = a[i] * POW(m[i], 2) * (0.6 + 0.4 * SIN(TAU * (0.8 + 0.1 * ch) * t)) * 2; }
    }
  });
  for (let i = 0; i < n; i++) { const t = i / SR, e = smooth(t / Math.min(0.8, len * 0.3)) * (1 - smooth((t - (len - Math.min(0.9, len * 0.3))) / Math.min(0.9, len * 0.3))); L[i] *= e; R[i] *= e; }
  emitS(filt(L, 'lp', 5500, 0.7), filt(R, 'lp', 5500, 0.7), 0.06, { send: 0.1 });
};
S.cicadas = (c, rnd) => {
  const len = LEN(c, 4.0, 0.5, 30), n = Math.round(len * SR), [L, R] = stereoOf(n, (L, R) => {
    for (let v = 0; v < 3; v++) {
      const f = 3900 + 330 * v + 40 * rnd(), s = new Float32Array(n), rate = 78 + 9 * v; let t = rnd() * 0.5;
      while (t < len) { const d = 0.7 + rnd() * 1.1, m0 = Math.round(t * SR), m1 = Math.min(n, Math.round((t + d) * SR)); for (let i = m0; i < m1; i++) { const tt = i / SR, e = smooth((tt - t) / 0.15) * (1 - smooth((tt - (t + d - 0.2)) / 0.2)); const am = 0.55 + 0.45 * SIN(TAU * rate * tt); s[i] += SIN(TAU * f * tt + 0.8 * SIN(TAU * 33 * tt)) * am * e; } t += d + 0.25 + rnd() * 0.7; }
      const [gl, gr] = panG((v - 1) * 0.5); for (let i = 0; i < n; i++) { L[i] += s[i] * gl; R[i] += s[i] * gr; }
    }
  });
  fio(L, 0.15, 0.3); fio(R, 0.15, 0.3); emitS(filt(L, 'lp', 5200, 0.7), filt(R, 'lp', 5200, 0.7), 0.05, { send: 0.12 });
};
S.crickets = (c, rnd) => {
  const len = LEN(c, 4.0, 0.5, 30), n = Math.round(len * SR), [L, R] = stereoOf(n, (L, R) => {
    for (let v = 0; v < 3; v++) {
      const f = 4300 + 260 * v + 60 * rnd(), rate = 1.8 + 0.45 * v + 0.2 * rnd(), s = new Float32Array(n), ph0 = rnd();
      for (let i = 0; i < n; i++) {
        const t = i / SR, p = (t * rate + ph0) % 1; if (p > 0.34) continue;
        const q = p / 0.34, e = Math.max(0, SIN(TAU * 1.5 * q - PI / 2) * 0.5 + 0.5) * smooth(q / 0.05) * (1 - smooth((q - 0.92) / 0.08));
        s[i] = SIN(TAU * f * t) * e * 0.8;
      }
      const [gl, gr] = panG((v - 1) * 0.6); for (let i = 0; i < n; i++) { L[i] += s[i] * gl; R[i] += s[i] * gr; }
    }
  });
  fio(L, 0.1, 0.25); fio(R, 0.1, 0.25); emitS(filt(L, 'lp', 5000, 0.7), filt(R, 'lp', 5000, 0.7), 0.045, { send: 0.12 });
};
S.windHowl = (c, rnd) => {
  const len = LEN(c, 4.0, 0.8, 30), n = Math.round(len * SR), m = smoothRand(rnd, n, 0.5), [L, R] = stereoOf(n, (L, R) => {
    for (let ch = 0; ch < 2; ch++) {
      const sw = (t) => 380 + 320 * SIN(PI * clamp(t / len, 0, 1)) * (0.7 + 0.3 * m[Math.min(n - 1, Math.round(t * SR))]) + 30 * ch;
      const a = filt(white(rnd, n), 'bp', sw, 12), b = filt(pink(rnd, n), 'bp', (t) => sw(t) * 0.5, 4), s = ch ? R : L;
      for (let i = 0; i < n; i++) s[i] = (a[i] * 0.5 + b[i] * 0.5) * (0.35 + 0.65 * m[i]);
    }
  });
  for (let i = 0; i < n; i++) { const e = POW(SIN(PI * i / n), 1.2); L[i] *= e; R[i] *= e; }
  emitS(L, R, 0.11, { send: 0.18 });
};
S.windGust = (c, rnd) => {
  const len = 1.6, n = Math.round(len * SR), [L, R] = stereoOf(n, (L, R) => {
    for (let ch = 0; ch < 2; ch++) {
      const a = filt(white(rnd, n), 'bp', (t) => 280 + 650 * SIN(PI * clamp(t / len, 0, 1)), 0.8), lo = filt(pink(rnd, n), 'lp', 400, 0.7), s = ch ? R : L;
      for (let i = 0; i < n; i++) s[i] = (a[i] + lo[i] * 0.8) * POW(SIN(PI * i / n), 2);
    }
  });
  emitS(L, R, 0.13, { send: 0.12 });
};
S.frostCrackle = (c, rnd) => {
  const len = LEN(c, 2.5, 0.5, 20), n = Math.round(len * SR), [L, R] = stereoOf(n, (L, R) => {
    let t = 0.02 + rnd() * 0.1;
    while (t < len - 0.05) {
      const [gl, gr] = panG(rnd() * 1.6 - 0.8), g = 0.3 + rnd() * 0.7, f = 1800 + rnd() * 2600;
      const w = modal(0.04, [[f, 1, 0.003], [f * 1.9, 0.4, 0.0025]], 0.0002); const nz = filt(white(rnd, w.length), 'bp', f, 1.0); for (let i = 0; i < w.length; i++) w[i] = w[i] * 0.6 + nz[i] * EXP(-i / SR / 0.004) * 0.7;
      stamp(L, t, w, g * gl); stamp(R, t, w, g * gr);
      t += (0.04 + rnd() * 0.22) * (rnd() < 0.2 ? 3 : 1);
    }
    const pings = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < pings; k++) { const f = 2400 + rnd() * 1800, w = modal(0.7, [[f, 1, 0.1], [f * 1.62, 0.35, 0.06]], 0.0004), [gl, gr] = panG(rnd() * 1.4 - 0.7), t0 = rnd() * (len - 0.5); stamp(L, t0, w, 0.5 * gl); stamp(R, t0, w, 0.5 * gr); }
  });
  fio(L, 0.005, 0.1); fio(R, 0.005, 0.1); emitS(filt(L, 'lp', 6000, 0.7), filt(R, 'lp', 6000, 0.7), 0.09, { send: 0.35 });
};
S.shiver = (c, rnd) => {
  const len = LEN(c, 1.4, 0.4, 6), n = Math.round(len * SR), s = new Float32Array(n);
  let t = 0.03; while (t < len - 0.08) {
    const burst = 3 + Math.floor(rnd() * 5), per = 1 / (14 + rnd() * 6);
    for (let k = 0; k < burst && t < len - 0.08; k++) { const f = 1000 + rnd() * 600; stamp(s, t, modal(0.06, [[f, 1, 0.008], [f * 2.4, 0.3, 0.004], [350, 0.5, 0.012]], 0.0004), 0.5 + rnd() * 0.5); t += per * (0.85 + 0.3 * rnd()); }
    t += 0.06 + rnd() * 0.12;
  }
  const lo = filt(pink(rnd, n), 'bp', 300, 1.2);
  for (let i = 0; i < n; i++) s[i] += lo[i] * 0.25 * (0.5 + 0.5 * SIN(TAU * 11 * i / SR)) * POW(SIN(PI * i / n), 1);
  fio(s, 0.01, 0.1); emit(filt(s, 'lp', 4500, 0.7), 0.11, { pan: vr(rnd, -0.2, 0.2), send: 0.08 });
};
S.powerDown = (c, rnd) => {
  const len = 2.4, n = Math.round(len * SR); let ph = 0, ph2 = 0;
  const nz = filt(white(rnd, n), 'lp', 600, 0.7);
  const s = mk(len, (t, i) => {
    const f = 30 + 90 * ex(t, 0.55); ph += TAU * f / SR; ph2 += TAU * f * 2 / SR;
    const e = ex(t, 0.9) * (t < 1.9 ? 1 : 1 - smooth((t - 1.9) / 0.05));
    return (SIN(ph) + 0.4 * SIN(ph2) + 0.2 * nz[i] * ex(t, 0.4)) * e * at(t, 0.01);
  });
  const th = modal(0.4, [[55, 1, 0.09], [110, 0.4, 0.05]], 0.001), nt = filt(white(rnd, Math.round(0.1 * SR)), 'lp', 700, 0.7);
  for (let i = 0; i < nt.length; i++) th[i] += nt[i] * EXP(-i / SR / 0.02) * 0.6;
  stamp(s, 1.95, th, 0.9);
  const f = filt(s, 'lp', (t) => 3000 * POW(150 / 3000, clamp(t / 2.0, 0, 1)), 0.8);
  emit(f, 0.28, { split: 200, send: 0.15 });
};
S.generatorHum = (c, rnd) => {
  const len = LEN(c, 4.0, 0.8, 40), n = Math.round(len * SR), jit = smoothRand(rnd, n, 3);
  const s = mk(len, (t, i) => {
    let v = 0; for (let h = 1; h <= 6; h++) v += SIN(TAU * 55 * h * t + h) * (h === 1 ? 1 : 0.55 / h);
    const chug = 0.78 + 0.22 * POW(0.5 + 0.5 * SIN(TAU * 14 * t), 1.5); return v * chug * (0.92 + 0.08 * jit[i]);
  });
  const nz = filt(white(rnd, n), 'bp', 400, 0.8); for (let i = 0; i < n; i++) s[i] += nz[i] * 0.04;
  fio(s, 0.4, 0.6); emit(filt(s, 'lp', 700, 0.7), 0.17, { split: 160, send: 0.05 });
};
S.thunderFar = (c, rnd) => {
  const len = LEN(c, 4.0, 1.5, 12), n = Math.round(len * SR), a = filt(pink(rnd, n), 'lp', (t) => 170 - 70 * clamp(t / len, 0, 1), 0.8), b = filt(white(rnd, n), 'bp', 70, 1.2), am = smoothRand(rnd, n, 2.2), am2 = smoothRand(rnd, n, 6);
  const [L, R] = stereoOf(n, (L, R) => {
    for (let i = 0; i < n; i++) { const t = i / SR, e = smooth(t / 0.5) * ex(Math.max(0, t - 0.3), len * 0.38), v = (a[i] * 2.2 + b[i] * 1.2) * e * (0.5 + 0.9 * am[i]) * (0.7 + 0.3 * am2[i]); L[i] = v; R[i] = v; }
  });
  L.set(filt(L, 'hp', 32, 0.707)); R.set(L); // keep sub-bass rumble from drifting (DC-free)
  fio(L, 0.05, 0.4); fio(R, 0.05, 0.4); emitS(L, R, 0.32, { split: 210, send: 0.25 });
};
S.rainDrops = (c, rnd) => {
  const len = LEN(c, 3.0, 0.4, 30), n = Math.round(len * SR), [L, R] = stereoOf(n, (L, R) => {
    const cnt = Math.round(len * 14);
    for (let k = 0; k < cnt; k++) {
      const t0 = rnd() * (len - 0.05), f = 1500 + POW(rnd(), 1.4) * 2800, w = modal(0.12, [[f, 1, 0.006 + rnd() * 0.012], [f * 1.7, 0.3, 0.005]], 0.0003), [gl, gr] = panG(rnd() * 1.8 - 0.9), g = 0.25 + 0.75 * rnd() * rnd() * 2;
      stamp(L, t0, w, Math.min(1, g) * gl); stamp(R, t0, w, Math.min(1, g) * gr);
    }
  });
  fio(L, 0.1, 0.2); fio(R, 0.1, 0.2); emitS(filt(L, 'lp', 5500, 0.7), filt(R, 'lp', 5500, 0.7), 0.07, { send: 0.2 });
};
S.waves = (c, rnd) => {
  const len = LEN(c, 8.0, 2, 40), n = Math.round(len * SR), per = 7 + rnd() * 1.5, ph0 = rnd() * per;
  const cyc = (t) => { const p = (((t + ph0) % per) + per) % per / per; return p < 0.38 ? POW(p / 0.38, 2) : EXP(-(p - 0.38) / 0.22); }; // build, crest, wash out
  const [L, R] = stereoOf(n, (L, R) => {
    for (let ch = 0; ch < 2; ch++) {
      const a = filt(white(rnd, n), 'lp', (t) => 350 + 1700 * cyc(t), 0.7), fo = filt(white(rnd, n), 'bp', 2800, 0.5), s = ch ? R : L;
      for (let i = 0; i < n; i++) { const t = i / SR, e = cyc(t), fe = cyc(t - 0.9 + 0.3 * ch); s[i] = (a[i] * 1.2 * e + fo[i] * 0.5 * Math.max(0, fe) ** 1.5) * (0.12 + 0.88 * e); }
    }
  });
  fio(L, 1, 1.2); fio(R, 1, 1.2); emitS(L, R, 0.12, { send: 0.15 });
};
S.seagull = (c, rnd) => {
  const cnt = 2 + Math.floor(rnd() * 2), len = cnt * 0.7 + 0.8, n = Math.round(len * SR), s = new Float32Array(n); let t0 = 0.05;
  for (let k = 0; k < cnt; k++) {
    const d = 0.38 + rnd() * 0.3, f0 = 1500 + rnd() * 300, w = new Float32Array(Math.round(d * SR)); let ph = 0;
    for (let i = 0; i < w.length; i++) {
      const t = i / SR, u = t / d, f = f0 * (0.78 + 0.5 * SIN(PI * Math.min(1, u * 1.1)) ** 0.8) * (1 + 0.025 * SIN(TAU * 28 * t));
      ph += TAU * f / SR; w[i] = (SIN(ph) + 0.45 * SIN(2 * ph) + 0.18 * SIN(3 * ph)) * smooth(t / 0.03) * POW(SIN(PI * u), 0.7) * (0.8 + 0.2 * SIN(TAU * 55 * t));
    }
    stamp(s, t0, w, 1 - 0.12 * k); t0 += d + 0.12 + rnd() * 0.2;
  }
  emit(filt(s, 'lp', 4500, 0.7), 0.08, { pan: vr(rnd, -0.5, 0.5), send: 0.4 });
};
S.waterRush = (c, rnd) => {
  const len = LEN(c, 3.0, 0.8, 20), n = Math.round(len * SR), [L, R] = stereoOf(n, (L, R) => {
    for (let ch = 0; ch < 2; ch++) {
      const a = filt(white(rnd, n), 'bp', (t) => 200 * POW(9, clamp(t / (len * 0.7), 0, 1)), 0.8), lo = filt(pink(rnd, n), 'lp', 180, 0.8), m = smoothRand(rnd, n, 9), s = ch ? R : L;
      for (let i = 0; i < n; i++) { const u = i / n, e = POW(smooth(u / 0.5), 1.4) * (1 - smooth((u - 0.82) / 0.18)); s[i] = (a[i] * (0.6 + 0.8 * m[i]) + lo[i] * 1.5) * e; }
    }
  });
  emitS(L, R, 0.2, { split: 200, send: 0.15 });
};
S.landRise = (c, rnd) => {
  const len = LEN(c, 4.0, 1, 20), n = Math.round(len * SR), a = filt(pink(rnd, n), 'lp', (t) => 60 + 90 * clamp(t / len, 0, 1), 0.8), m = smoothRand(rnd, n, 4);
  let ph = 0; const cr = new Float32Array(n);
  let t = 0.05; while (t < len - 0.1) { const f = 700 + rnd() * 1800, w = modal(0.1, [[f, 1, 0.01], [f * 0.5, 0.5, 0.02]], 0.0004); stamp(cr, t, w, 0.3 + 0.7 * rnd()); t += (0.05 + rnd() * 0.25) * (1.8 - clamp(t / len, 0, 1)); }
  const [L, R] = stereoOf(n, (L, R) => {
    for (let i = 0; i < n; i++) {
      const tt = i / SR, u = tt / len, e = POW(smooth(u / 0.8), 1.4) * (1 - smooth((u - 0.9) / 0.1)); ph += TAU * (26 + 14 * u) / SR;
      const v = (a[i] * 3.2 * (0.6 + 0.6 * m[i]) + SIN(ph) * 0.7) * e, k = cr[i] * 0.3 * e; L[i] = v + k; R[i] = v + k * 0.8;
    }
  });
  emitS(L, R, 0.3, { split: 190, send: 0.2 });
};
S.bubbles = (c, rnd) => {
  const len = LEN(c, 2.0, 0.3, 20), n = Math.round(len * SR), [L, R] = stereoOf(n, (L, R) => {
    const cnt = Math.max(1, Math.round(len * 5));
    for (let k = 0; k < cnt; k++) {
      const t0 = rnd() * Math.max(0.01, len - 0.25), f0 = 380 + POW(rnd(), 1.2) * 800, d = 0.12 + rnd() * 0.08, w = new Float32Array(Math.round(d * SR)); let ph = 0;
      for (let i = 0; i < w.length; i++) { const t = i / SR; ph += TAU * f0 * (1 + 0.45 * (1 - EXP(-t / 0.035))) / SR; w[i] = SIN(ph) * smooth(t / 0.004) * ex(t, d * 0.35); }
      const [gl, gr] = panG(rnd() * 1.4 - 0.7), g = 0.4 + 0.6 * rnd(); stamp(L, t0, w, g * gl); stamp(R, t0, w, g * gr);
    }
  });
  emitS(L, R, 0.08, { send: 0.3 });
};
S.globeSpin = (c, rnd) => {
  const len = LEN(c, 3.0, 0.6, 20), n = Math.round(len * SR), rate = 3.2;
  const [L, R] = stereoOf(n, (L, R) => {
    for (let ch = 0; ch < 2; ch++) {
      const a = filt(white(rnd, n), 'bp', 650 + 100 * ch, 2.0), s = ch ? R : L; let ph = rnd() * TAU;
      for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (172 + 6 * ch) / SR; s[i] = (a[i] * 1.1 * (0.5 + 0.5 * SIN(TAU * rate * t + ch * 1.2)) + SIN(ph) * 0.18) * at(t, 0.3) * (1 - smooth((t - (len - 0.4)) / 0.4)); }
    }
    for (let t = 0.4; t < len - 0.2; t += 0.95) { const w = modal(0.08, [[1500, 1, 0.006], [2900, 0.3, 0.003]], 0.0003); stamp(L, t, w, 0.3); stamp(R, t, w, 0.3); }
  });
  emitS(L, R, 0.08, { send: 0.1 });
};
S.dialTick = (c, rnd) => {
  const cnt = clamp(Math.round(Number.isFinite(+c.n) && +c.n > 0 ? +c.n : 3), 1, 40), sp = 0.11, s = new Float32Array(Math.round(((cnt - 1) * sp + 0.2) * SR));
  for (let k = 0; k < cnt; k++) stamp(s, k * sp, modal(0.1, [[2200 - 70 * (k % 3), 1, 0.004], [900, 0.6, 0.008], [4100, 0.2, 0.002]], 0.0003), 0.75 + 0.25 * (k % 2));
  emit(filt(s, 'lp', 5500, 0.7), 0.12, { pan: vr(rnd, -0.15, 0.15), send: 0.08 });
};
S.clockWhirr = (c, rnd) => {
  const len = LEN(c, 1.6, 0.4, 10), n = Math.round(len * SR), s = new Float32Array(n); let t = 0.0, iv = 0.14;
  while (t < len - 0.05) { const f = 1700 + 300 * (Math.round(t * 40) % 2); stamp(s, t, modal(0.05, [[f, 1, 0.004], [f * 2.4, 0.3, 0.002], [500, 0.4, 0.01]], 0.0003), 0.8); t += iv; iv = Math.max(0.012, iv * 0.9); }
  const buzz = filt(white(rnd, n), 'bp', 2200, 1.0); for (let i = 0; i < n; i++) { const t2 = i / SR, u = t2 / len; s[i] += buzz[i] * 0.2 * smooth((u - 0.5) / 0.5) * (0.6 + 0.4 * SIN(TAU * 90 * t2)); }
  fio(s, 0.005, 0.12); emit(filt(s, 'lp', 5200, 0.7), 0.11, { pan: vr(rnd, -0.15, 0.15), send: 0.1 });
};
S.pop = (c, rnd) => {
  const n = Math.round(0.25 * SR); let ph = 0; const nz = filt(white(rnd, n), 'bp', 1800, 0.8);
  emit(mk(0.25, (t, i) => { ph += TAU * (320 + 700 * ex(t, 0.018)) / SR; return (SIN(ph) * ex(t, 0.04) + nz[i] * ex(t, 0.006) * 0.5) * at(t, 0.0008); }), 0.14, { pan: vr(rnd, -0.2, 0.2), send: 0.12 });
};
S.boing = (c, rnd) => {
  const len = 0.7; let ph = 0;
  emit(mk(len, (t) => { const f = 150 + 380 * ex(t, 0.22) * (1 + 0.55 * SIN(TAU * 8.5 * t + 0.4)); ph += TAU * f / SR; return (SIN(ph) + 0.35 * SIN(2 * ph)) * ex(t, 0.24) * at(t, 0.004) * (1 - smooth((t - 0.6) / 0.1)); }), 0.13, { pan: vr(rnd, -0.25, 0.25), send: 0.1 });
};
S.sweatDrip = (c, rnd) => {
  const f = vr(rnd, 1000, 1400); let ph = 0;
  emit(mk(0.4, (t) => { ph += TAU * f * (0.55 + 0.45 * ex(t, 0.03)) / SR; return (SIN(ph) * ex(t, 0.05) + 0.2 * SIN(2.7 * ph) * ex(t, 0.02)) * at(t, 0.0015); }), 0.08, { pan: vr(rnd, -0.3, 0.3), send: 0.35 });
};
S.snore = (c, rnd) => {
  const len = 2.4, n = Math.round(len * SR), nz = filt(white(rnd, n), 'bp', 350, 1.0), fl = smoothRand(rnd, n, 25); let ph = 0;
  const s = mk(len, (t, i) => {
    const p = t / len; let e, f;
    if (p < 0.38) { e = POW(Math.sin(PI * p / 0.38), 1.2); f = 62 + 8 * p; } else if (p < 0.72) { const q = (p - 0.38) / 0.34; e = POW(Math.sin(PI * q), 0.9) * 0.9; f = 48 + 14 * q; } else { e = 0; f = 50; }
    ph += f / SR; ph -= Math.floor(ph);
    const v = blepSaw(ph, f / SR) * (0.6 + 0.4 * POW(fl[i], 2)) + nz[i] * 0.5;
    return v * e;
  });
  emit(filt(s, 'bp', 280, 0.45), 0.13, { pan: vr(rnd, -0.15, 0.15), send: 0.1 });
};
S.yawn = (c, rnd) => {
  const len = 2.2, n = Math.round(len * SR), nz = white(rnd, n); let ph = 0; const src = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, u = t / len, f = 150 + 45 * SIN(PI * u) - 40 * smooth((u - 0.6) / 0.4); ph += f / SR; ph -= Math.floor(ph); src[i] = blepSaw(ph, f / SR) * 0.8 + nz[i] * 0.2; }
  const f1 = filt(src, 'bp', (t) => 520 + 280 * SIN(PI * clamp(t / len, 0, 1)), 4), f2 = filt(src, 'bp', (t) => 1050 - 150 * clamp(t / len, 0, 1), 5), br = filt(nz, 'bp', 1700, 1.0);
  const s = mk(len, (t, i) => (f1[i] + 0.45 * f2[i] + br[i] * 0.12) * POW(SIN(PI * POW(t / len, 0.85)), 1.3));
  emit(s, 0.1, { pan: vr(rnd, -0.15, 0.15), send: 0.08 });
};
S.munch = (c, rnd) => {
  const cnt = 3 + Math.floor(rnd() * 2), s = new Float32Array(Math.round((cnt * 0.3 + 0.5) * SR));
  for (let k = 0; k < cnt; k++) {
    const t0 = k * (0.26 + rnd() * 0.08), micro = 3 + Math.floor(rnd() * 3);
    for (let j = 0; j < micro; j++) { const m = Math.round(0.05 * SR), nz = filt(filt(white(rnd, m), 'bp', 1500 + rnd() * 900, 0.7), 'lp', 4200, 0.7); for (let i = 0; i < m; i++) nz[i] *= EXP(-i / SR / (0.012 + 0.01 * rnd())) * smooth(i / (0.0008 * SR)); stamp(s, t0 + j * (0.012 + 0.012 * rnd()), nz, 0.5 + 0.5 * rnd()); }
    stamp(s, t0, modal(0.12, [[190, 1, 0.025]], 0.001), 0.35);
  }
  fio(s, 0.002, 0.05); emit(s, 0.13, { pan: vr(rnd, -0.2, 0.2), send: 0.05 });
};
S.fanWhir = (c, rnd) => {
  const len = LEN(c, 4.0, 0.8, 40), n = Math.round(len * SR), a = filt(white(rnd, n), 'bp', 900, 0.6), b = filt(pink(rnd, n), 'lp', 450, 0.7); let ph = 0, ph2 = 0;
  const s = mk(len, (t, i) => { const sp = smooth(t / 0.6); ph += TAU * 22 * sp / SR; ph2 += TAU * 118 * (0.7 + 0.3 * sp) / SR; const am = 0.62 + 0.38 * SIN(ph); return (a[i] * 0.7 * am + b[i] * 0.8 + SIN(ph2) * 0.1) * (0.2 + 0.8 * sp); });
  fio(s, 0.1, 0.5); emit(filt(s, 'lp', 3500, 0.7), 0.12, { pan: vr(rnd, -0.2, 0.2), send: 0.05 });
};
S.sizzle = (c, rnd) => {
  const len = 1.8, n = Math.round(len * SR), s = new Float32Array(n), hiss = filt(filt(white(rnd, n), 'hp', 2500, 0.7), 'lp', 6000, 0.7);
  const cnt = Math.round(len * 520);
  for (let k = 0; k < cnt; k++) { const t0 = rnd() * len, m = Math.round(0.004 * SR), w = filt(white(rnd, m), 'bp', 3000 + rnd() * 2500, 1.0); for (let i = 0; i < m; i++) w[i] *= EXP(-i / SR / 0.0012); stamp(s, t0, w, (0.3 + 0.7 * rnd()) * ex(t0, 1.0)); }
  for (let i = 0; i < n; i++) { const t = i / SR; s[i] = s[i] * 1.5 + hiss[i] * 0.12 * ex(t, 0.9) * at(t, 0.02) * (0.6 + 0.4 * SIN(TAU * 7 * t)); }
  fio(s, 0.004, 0.15); emit(filt(s, 'lp', 6200, 0.7), 0.09, { pan: vr(rnd, -0.2, 0.2), send: 0.08 });
};
S.zap = (c, rnd) => {
  const len = 0.35, n = Math.round(len * SR), nz = filt(white(rnd, n), 'bp', 2500, 0.7); let ph = 0;
  const s = mk(len, (t, i) => { const f = 180 + 2620 * ex(t, 0.06); ph += f / SR; ph -= Math.floor(ph); return (blepSaw(ph, f / SR) * 0.6 + SIN(TAU * ph) * 0.4 + nz[i] * 0.4 * ex(t, 0.03)) * ex(t, 0.11) * at(t, 0.0015); });
  emit(filt(s, 'lp', 5000, 0.7), 0.14, { pan: vr(rnd, -0.25, 0.25), send: 0.15 });
};
const NEW_TYPES = 'sunriseSwell heatShimmer cicadas crickets windHowl windGust frostCrackle shiver powerDown generatorHum thunderFar rainDrops waves seagull waterRush landRise bubbles globeSpin dialTick clockWhirr pop boing sweatDrip snore yawn munch fanWhir sizzle zap'.split(' ');

const EXTRA_TYPES = ('clothRustle clothFlap airPuff exhale inhale paperFlutter crowdMurmur crowdOoh tirePass doorCreak doorClick footstepGravel footstepWood footstepGrass footstepConcrete ballThud ballBounce objectThud glassTink ceramicTap shimmer ghostAppear ghostFade subWhoosh grab bodyBump ' + NEW_TYPES.join(' ')).split(' ');

// whoosh family policy: soft + dark + rare (feedback: too loud / repetitive). Nothing is added automatically at cuts or chapter joins; the
// cue file decides, and cues closer than WHOOSH_MIN_GAP to the previous kept whoosh are dropped.
const WHOOSH_FAM = new Set(['whoosh', 'whooshFast', 'swish', 'ghostWhoosh']);
const WHOOSH_TRIM = 0.4, WHOOSH_LP = 4200;
// naturally bright sounds get a 4th-order low-pass so nothing in the SFX layer is fizzy / harsh (no ear-piercing highs)
const BRIGHT_LP = { slide: 4500, glassBreak: 4600, moneyCount: 5000, paperRustle: 4200, partyPopper: 4800, staticBurst: 4200, glassRain: 5000, rain: 4200, clothRustle: 4200, paperFlutter: 4200, heatShimmer: 4800, sizzle: 4200, skateboardRoll: 5000, tirePass: 5000 };
const softLpFor = (type) => WHOOSH_FAM.has(type) ? WHOOSH_LP : (BRIGHT_LP[type] || 0);
const SFX_MASTER = 0.8; // global trim on cue gains; stings / swells keep their own level
const SFX_MASTER_EXEMPT = new Set(['sting', 'stingDark', 'stingWonder', 'swell', 'titleImpact']);

// ------------------------------------------------------------------ vocabulary coverage
const VOCAB = {
  movement: 'step stepRun whoosh whooshFast swish jump land slide skid bikePass vehiclePass truckPass carHorn truckHorn skateboardRoll skateboardSlam',
  impacts: 'thump hit punch punchMiss bigImpact boom cutHit flashHit titleImpact crack glassBreak ceramicBreak catchSoft clink ceramicClatter',
  sport_objects: 'pingpongHit pingpongBounce bellRing crowdGasp crowdCheer batCrack ballSmack paddleHit rouletteSpin rouletteBall chipStack coinDrop cashRegister moneyCount keyboardTyping tickerBlips uiBlip uiConfirm uiError phoneTap phoneBuzz alarmClock doorOpen doorSlam knock paperRustle partyPopper clap laughTrack cork',
  vision_scifi: 'eyeOpen eyeFlash pullOut tick ghostWhoosh echoPop timerStart timerBeep glitch rewind reverseSwell heartbeat riserShort staticBurst vhsTear sonar clockTick clockStop',
  disaster: 'rumble quakeCrack debrisFall buildingCreak siren sirenDistant crowdPanic glassRain dust explosionFar',
  emotion_mix: 'gasp sting stingDark stingWonder swell dropOut silenceHit birdsong wind rain footstepsRun',
  v2_scene: 'sunriseSwell heatShimmer cicadas crickets windHowl windGust frostCrackle shiver powerDown generatorHum thunderFar rainDrops waves seagull waterRush landRise bubbles globeSpin dialTick clockWhirr rewind pop boing sweatDrip snore yawn munch fanWhir sizzle zap doorCreak',
};
const VOCAB_ALL = Object.values(VOCAB).flatMap((s) => s.split(' '));
const vocabMissing = VOCAB_ALL.filter((t) => typeof S[t] !== 'function');
SOLO_TYPES = Object.keys(S);

// ------------------------------------------------------------------ cue rendering into a chapter-local context
const cueErrors = [];
function renderCues(cues, ctx, seedOf, tag) {
  CUR = ctx;
  cues.forEach((c, idx) => {
    if (typeof S[c.type] !== 'function') { // defensive: loadChapter already drops these with a warning
      cueErrors.push({ chapter: tag, t: c.t, type: c.type, error: 'unknown cue type (ignored)' }); return;
    }
    ctx.c = c; ctx.cueIdx = idx;
    ctx.g = clamp(Number.isFinite(+c.gain) ? +c.gain : (GDEF[c.type] ?? 1), 0, 1.5);
    if (!SFX_MASTER_EXEMPT.has(c.type)) ctx.g *= SFX_MASTER;
    ctx.softLp = softLpFor(c.type); ctx.varied = !LEGACY;
    if (ctx.varied && WHOOSH_FAM.has(c.type)) ctx.g *= WHOOSH_TRIM;
    try { S[c.type](c, mulberry32(seedOf(idx))); } catch (e) {
      cueErrors.push({ chapter: tag, t: c.t, type: c.type, error: String(e && e.message || e) });
      console.log(`CUE ERROR ${tag} t=${c.t} ${c.type}: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
    }
  });
}

// ------------------------------------------------------------------ CHAPTERS
// Music stem (post duck / gates, pre loudness gain) is kept apart for the VO-vs-music check.
const MSTEM = { L: new Float32Array(NW), R: new Float32Array(NW) };
const FADE_END_MUSIC = 0.5; // last chapter: music tail fades to exactly zero over the last 0.5 s (the bed master fade is longer)
function renderChapter(ch, isFirst, isLast, k) {
  const T0 = isFirst ? ch.start - 0.4 : ch.start - 0.9, T1 = isLast ? ch.start + ch.dur : ch.start + ch.dur + 0.9, fi = isFirst ? 0.35 : 1.8, fo = isLast ? FADE_END_MUSIC : 1.8;
  const n = Math.round((T1 - T0) * SR), env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = T0 + i / SR;
    const up = isFirst ? SIN(PI / 2 * clamp((t - ch.start) / fi, 0, 1)) : SIN(PI / 2 * clamp((t - T0) / fi, 0, 1));
    env[i] = up * SIN(PI / 2 * clamp((T1 - t) / fo, 0, 1));
  }
  const hs = hashStr(ch.id);
  if (!NO_MUSIC) { const [mL, mR] = renderMusic(ch, T0, n, env, hs + 7, colIndexOf(ch.id, k)); addCtl(mL, mR, T0, busCtl.music); addCtl(mL, mR, T0, busCtl.music, 1, mL.length, MSTEM); }
  if (!NO_AMB) { const [aL, aR] = renderAmbience(ch, T0, n, env, hs + 13); addCtl(aL, aR, T0, busCtl.amb); }
  const nC = Math.round((ch.dur + 5) * SR), ctx = makeCtx(nC);
  ch.risers.forEach(([a, b], ri) => {
    const [l, r] = riserSig(mulberry32(hs + 500 + ri), b - a, 0.9), s0 = Math.round(a * SR), B = ctx.buf.riser;
    for (let i = 0; i < l.length && s0 + i < nC; i++) { B.L[s0 + i] += l[i]; B.R[s0 + i] += r[i]; }
    const sb = Math.round(b * SR), Lw = ctx.buf.low;
    for (let i = 0; i < Math.round(0.45 * SR) && sb + i < nC; i++) { const t = i / SR, v = SIN(TAU * (44 + 30 * EXP(-t / 0.06)) * t) * EXP(-t / 0.13) * smooth(t / 0.004) * 0.12; Lw.L[sb + i] += v; Lw.R[sb + i] += v; }
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
    for (const arr of [preL, preR, STEM.L, STEM.R]) {
      const seg = arr.slice(s0, s1), f = filt(seg, 'lp', (t) => 9000 * POW(350 / 9000, dropAmt(W0 + (s0 + t * SR) / SR)), 0.707);
      for (let i = 0; i < seg.length; i++) { const ww = w(W0 + (s0 + i) / SR); arr[s0 + i] = seg[i] * (1 - ww) + f[i] * ww; }
    }
  }
}

// ------------------------------------------------------------------ SFX short-term loudness guard
// The SFX stem (sfx + hit + low buses and their reverb) must never stand proud of the voice: its ~300 ms RMS is held below
// (VO reference level + GUARD_SPEECH_DB) while the voice is active and (VO reference + GUARD_GAP_DB) in the gaps (blended by the duck envelope).
// Gain reduction: instant (look-ahead min +-50 ms, 50 ms box smoothing so there are no zipper steps), 200 ms release, floor -12 dB.
const GUARD_SPEECH_DB = -9.0, GUARD_GAP_DB = -3.0, GUARD_FLOOR = db2g(-12);
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
  const raw = new Float32Array(nH).fill(1); let overSp = 0, overGap = 0, nSp = 0, nGap = 0;
  for (let h = 0; h < nH; h++) {
    const lo = Math.max(0, h - 150), hi = Math.min(nH, h + 151), lvl = 10 * Math.log10((P[hi] - P[lo]) / (hi - lo) + 1e-12);
    const dk = duckSm[h], thr = thrGap + (thrSp - thrGap) * dk;
    if (dk > 0.5) nSp++; else nGap++;
    if (lvl > thr) { raw[h] = Math.max(GUARD_FLOOR, db2g(thr - lvl)); if (dk > 0.5) overSp++; else overGap++; }
  }
  const mn = slidingMin(raw, 50), bx = boxAvg(mn, 25), gr = new Float32Array(nH), rel = 1 - EXP(-1 / 200); let y = 1, grMin = 1, redN = 0, red3 = 0;
  for (let h = 0; h < nH; h++) { y = Math.min(bx[h], y + (1 - y) * rel); gr[h] = y; if (y < grMin) grMin = y; if (y < 0.99) redN++; if (y < 0.708) red3++; }
  const wins = [], W_A = Math.max(W0, WIN_ARG[0]), W_B = Math.min(W1, WIN_ARG[1]);
  const pk = (arrL, arrR, a, b) => { let p = 0; for (let i = a; i < b; i++) { const x = Math.abs(arrL[i]), z = arrR ? Math.abs(arrR[i]) : 0; if (x > p) p = x; if (z > p) p = z; } return p; };
  for (let t = W_A; t + 1e-6 < W_B; t += 2) {
    const a = Math.max(0, gi(t)), b = Math.min(NW, gi(Math.min(W_B, t + 2)));
    if (b <= a) continue;
    let e = 0, ev = 0; for (let i = a; i < b; i++) { e += 0.5 * (L[i] * L[i] + R[i] * R[i]); ev += voTrack[i] * voTrack[i]; }
    let grW = 1; for (let h = Math.floor(a / HOP); h <= Math.min(nH - 1, Math.floor(b / HOP)); h++) if (gr[h] < grW) grW = gr[h];
    wins.push({ t0: +t.toFixed(1), t1: +Math.min(W_B, t + 2).toFixed(1), sfx_pk_pre: pk(L, R, a, b), sfx_rms_pre: Math.sqrt(e / (b - a)), vo_pk: pk(voTrack, null, a, b), vo_rms: Math.sqrt(ev / (b - a)), gr_min: grW, a, b });
  }
  if (NO_GUARD) gr.fill(1); // A/B: measure only
  for (let h = 0; h < nH; h++) {
    const a = h * HOP, b = Math.min(NW, a + HOP); if (b <= a) continue;
    const g0 = gr[h], g1 = h + 1 < nH ? gr[h + 1] : g0;
    for (let i = a; i < b; i++) { const g = g0 + (g1 - g0) * ((i - a) / HOP); L[i] *= g; R[i] *= g; }
  }
  for (const w of wins) { w.sfx_pk_post = pk(L, R, w.a, w.b); let e = 0; for (let i = w.a; i < w.b; i++) e += 0.5 * (L[i] * L[i] + R[i] * R[i]); w.sfx_rms_post = Math.sqrt(e / (w.b - w.a)); }
  for (let i = 0; i < NW; i++) { preL[i] += L[i]; preR[i] += R[i]; }
  Object.assign(guardInfo, {
    enabled: !NO_GUARD, vo_ref_rms_dBFS_preGain: +voRefDb.toFixed(1), thr_speech_dBFS_preGain: +thrSp.toFixed(1), thr_gap_dBFS_preGain: +thrGap.toFixed(1),
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
  const cand = [['silent_full.mp4', 'final_full.mp4'], ['silent.mp4', 'final.mp4']].map(([s, f]) => [path.join(OUT, s), path.join(OUT, f)]);
  const hit = cand.find(([s]) => fs.existsSync(s));
  const mixf = [path.join(OUT, 'audio_mix.wav'), path.join(OUT, 'mix_full.wav')].find((f) => fs.existsSync(f));
  if (!hit) { console.error(`--mux: no silent video found (looked for ${cand.map(([s]) => path.relative(HERE, s)).join(' and ')}); render the picture first. Mix is ${mixf ? path.relative(HERE, mixf) : 'not rendered yet'}.`); process.exitCode = 2; return; }
  if (!mixf) { console.error('--mux: no mix found (out/audio_mix.wav); run `node sfx_full.mjs --wav-only` first'); process.exitCode = 2; return; }
  const [silent, fin_] = hit;
  const r = ff(['-y', '-i', silent, '-i', mixf, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', fin_]);
  if (r.status !== 0) { console.error('ffmpeg mux failed:\n' + (r.stderr || '').split('\n').slice(-12).join('\n')); process.exitCode = 3; } else console.log('muxed ->', fin_, '(video', path.basename(silent) + ', audio', path.basename(mixf) + ')');
}

// ------------------------------------------------------------------ spectral helpers (4096-pt Hann, averaged power spectrum)
const SPEC_N = 4096, SPEC_WIN = (() => { const w = new Float64Array(SPEC_N); for (let i = 0; i < SPEC_N; i++) w[i] = 0.5 - 0.5 * COS(TAU * i / (SPEC_N - 1)); return w; })();
const BAND_EDGES = [20, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000, 24000], BAND_NAMES = ['20-63', '63-125', '125-250', '250-500', '500-1k', '1k-2k', '2k-4k', '4k-8k', '8k-16k', '16k+'];
/** averaged power spectrum of mono (0.5(L+R)) over [i0,i1); hop = N/2. Returns Float64Array(N/2) of power per bin (or null if too short). */
function avgSpec(L, R, i0, i1) {
  const out = new Float64Array(SPEC_N / 2), re = new Float64Array(SPEC_N), im = new Float64Array(SPEC_N); let cnt = 0;
  for (let s = i0; s + SPEC_N <= i1; s += SPEC_N / 2) {
    for (let i = 0; i < SPEC_N; i++) re[i] = (R ? 0.5 * (L[s + i] + R[s + i]) : L[s + i]) * SPEC_WIN[i];
    im.fill(0); fft(re, im, false);
    for (let k = 1; k < SPEC_N / 2; k++) out[k] += re[k] * re[k] + im[k] * im[k];
    cnt++;
  }
  if (!cnt) return null;
  for (let k = 0; k < out.length; k++) out[k] /= cnt;
  return out;
}
function bandPower(spec) {
  const bp = new Float64Array(BAND_NAMES.length);
  for (let k = 1; k < spec.length; k++) { const f = k * SR / SPEC_N; for (let b = 0; b < BAND_NAMES.length; b++) if (f >= BAND_EDGES[b] && f < BAND_EDGES[b + 1]) { bp[b] += spec[k]; break; } }
  return bp;
}
function specSummary(spec) {
  let tot = 0, cs = 0; for (let k = 1; k < spec.length; k++) { tot += spec[k]; cs += spec[k] * k * SR / SPEC_N; }
  let acc = 0, roll = 0; for (let k = 1; k < spec.length; k++) { acc += spec[k]; if (acc >= 0.85 * tot) { roll = k * SR / SPEC_N; break; } }
  let h5 = 0, h8 = 0; for (let k = 1; k < spec.length; k++) { const f = k * SR / SPEC_N; if (f >= 5000) h5 += spec[k]; if (f >= 8000) h8 += spec[k]; }
  return { centroid_Hz: Math.round(tot ? cs / tot : 0), rolloff85_Hz: Math.round(roll), hf_gt5k_pct: +(100 * h5 / (tot || 1)).toFixed(2), hf_gt8k_pct: +(100 * h8 / (tot || 1)).toFixed(3) };
}

// ------------------------------------------------------------------ solo test (every type alone)
function analyzeSlice(L, R, i0, i1) {
  const m = i1 - i0, mono = new Float32Array(m); let nan = 0, pk = 0, sum = 0;
  for (let i = 0; i < m; i++) { const a = L[i0 + i], b = R[i0 + i]; if (!Number.isFinite(a) || !Number.isFinite(b)) { nan++; continue; } const v = 0.5 * (a + b); mono[i] = v; sum += v; const x = Math.max(Math.abs(a), Math.abs(b)); if (x > pk) pk = x; }
  const F = 480, fr = []; let mx = 0;
  for (let s = 0; s + F <= m; s += F) { let e = 0; for (let j = 0; j < F; j++) e += mono[s + j] * mono[s + j]; e = Math.sqrt(e / F); fr.push(e); if (e > mx) mx = e; }
  let ae = 0, ac = 0, lastIdx = 0; fr.forEach((e, k) => { if (e > mx * 0.1) { ae += e * e; ac++; } if (e > mx * 0.00316) lastIdx = k; });
  const NF = 32768, re = new Float64Array(NF), im = new Float64Array(NF), nu = Math.min(48000, m);
  for (let i = 0; i < nu; i++) re[i] = mono[i] * (0.5 - 0.5 * COS(TAU * i / (nu - 1)));
  fft(re, im, false);
  let sw = 0, tot = 0, hf = 0; const mags = new Float64Array(NF / 2);
  for (let k = 1; k < NF / 2; k++) { const a = Math.hypot(re[k], im[k]); mags[k] = a; tot += a * a; sw += a * a * k * SR / NF; if (k * SR / NF >= 5000) hf += a * a; }
  let acc = 0, roll = 0; for (let k = 1; k < NF / 2; k++) { acc += mags[k] * mags[k]; if (acc >= 0.85 * tot) { roll = k * SR / NF; break; } }
  let tailE = 0; const tn = Math.round(0.1 * SR); for (let i = m - tn; i < m; i++) tailE += mono[i] * mono[i];
  return {
    peak_dBFS: +g2db(pk).toFixed(1), active_rms_dBFS: +g2db(ac ? Math.sqrt(ae / ac) : 0).toFixed(1), tail_s: +((lastIdx + 1) * F / SR).toFixed(2),
    centroid_Hz: Math.round(tot ? sw / tot : 0), rolloff85_Hz: Math.round(roll), hf_gt5k_pct: +(100 * hf / (tot || 1)).toFixed(1), nan_count: nan, dc_mean: +(sum / m).toExponential(2),
    start_click: pk > 0 && Math.abs(mono[0]) > 0.02 * pk, end_residual_dBFS: +g2db(Math.sqrt(tailE / tn)).toFixed(1),
  };
}
function soloTest() {
  const types = SOLO_TYPES, BATCH = 20, SP = 6, rep = {}, wavs = [];
  for (let b0 = 0; b0 < types.length; b0 += BATCH) {
    const batch = types.slice(b0, b0 + BATCH), n = Math.round((batch.length * SP + 6) * SR), ctx = makeCtx(n); CUR = ctx;
    batch.forEach((type, k) => {
      const c = { t: 1 + k * SP, type }; ctx.c = c; ctx.cueIdx = k; ctx.g = GDEF[type] ?? 1; ctx.varied = true; ctx.softLp = softLpFor(type);
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
      if (a.rolloff85_Hz > 9000 || a.hf_gt5k_pct > 25) a.flags.push('HARSH');
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
  for (const [t, a] of rows) console.log(`${t.padEnd(16)} pk ${String(a.peak_dBFS).padStart(6)} rms ${String(a.active_rms_dBFS).padStart(6)} tail ${String(a.tail_s).padStart(5)}s cent ${String(a.centroid_Hz).padStart(5)} roll ${String(a.rolloff85_Hz).padStart(5)} hf5k ${String(a.hf_gt5k_pct).padStart(5)}% ${a.flags.join(',')}`);
  console.log(`solo test: ${types.length} types, ${bad.length} flagged, ${cueErrors.length} errors, missing from vocab: ${vocabMissing.join(',') || 'none'}`);
}

// ------------------------------------------------------------------ music colour demo (--demo-music <c1..c8|all> [--demo-len 20] [--demo-mood <mood>])
function demoMusic() {
  fs.mkdirSync(OUT, { recursive: true });
  const which = String(flag('demo-music')), len = flag('demo-len') && flag('demo-len') !== true ? +flag('demo-len') : 20, moodOv = flag('demo-mood') && flag('demo-mood') !== true ? String(flag('demo-mood')) : null;
  const ids = which === 'all' || which === 'true' ? [0, 1, 2, 3, 4, 5, 6, 7] : which.split(',').map((s) => colIndexOf(s, 0));
  const rows = [];
  for (const k of ids) {
    const id = 'c' + (k + 1), mood = moodOv || DEFAULTS_BY_COL[k][0];
    const ch = { id, start: 0, dur: len, mood, arc: [[0, len * 0.35, 0.35], [len * 0.35, len * 0.8, 0.7], [len * 0.8, len, 0.45]], tF: len - 3.2 };
    const n = Math.round(len * SR), env = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR; env[i] = SIN(PI / 2 * clamp(t / 0.35, 0, 1)) * SIN(PI / 2 * clamp((len - t) / 0.5, 0, 1)); }
    const T = Date.now(), [L, R] = renderMusic(ch, 0, n, env, hashStr(id) + 7, k);
    const file = path.join(OUT, `audio_demo_${id}_${COLS[k].name}.wav`);
    writeWavStream(file, n, 24, (i) => L[i], (i) => R[i]);
    let nan = 0, pk = 0; for (let i = 0; i < n; i++) { if (!Number.isFinite(L[i]) || !Number.isFinite(R[i])) nan++; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
    const blocks = []; for (let s = 0; s + SR <= n; s += SR) { let e = 0; for (let i = s; i < s + SR; i++) e += 0.5 * (L[i] * L[i] + R[i] * R[i]); blocks.push(+g2db(Math.sqrt(e / SR)).toFixed(1)); }
    const sp = specSummary(avgSpec(L, R, 0, n)), bp = bandPower(avgSpec(L, R, 0, n)), bt = bp.reduce((a, b) => a + b, 0) || 1;
    const rms = Math.sqrt(blocks.reduce((a, b) => a + db2g(b) ** 2, 0) / Math.max(1, blocks.length));
    const row = { colour: COLS[k].name, id, mood, rms_dBFS: +g2db(rms).toFixed(1), peak_dBFS: +g2db(pk).toFixed(1), nan, ...sp, rms_per_second_dB: blocks, band_pct: Object.fromEntries(BAND_NAMES.map((b, j) => [b, +(100 * bp[j] / bt).toFixed(1)])), motif_at_s: musicInfo[id] && musicInfo[id].motif, render_s: +((Date.now() - T) / 1000).toFixed(1), file: path.basename(file) };
    rows.push(row);
    console.log(`${id} ${COLS[k].name.padEnd(11)} mood ${mood.padEnd(7)} rms ${String(row.rms_dBFS).padStart(6)} pk ${String(row.peak_dBFS).padStart(6)} cent ${String(sp.centroid_Hz).padStart(5)} roll85 ${String(sp.rolloff85_Hz).padStart(5)} hf>5k ${sp.hf_gt5k_pct}% >8k ${sp.hf_gt8k_pct}% nan ${nan}  motif@${JSON.stringify(row.motif_at_s)}  per-sec ${blocks.join(' ')}`);
    console.log('   band % ' + BAND_NAMES.map((b, j) => `${b}:${row.band_pct[b]}`).join(' '));
  }
  fs.writeFileSync(path.join(OUT, 'audio_demo_report.json'), JSON.stringify(rows, null, 1));
}

// ------------------------------------------------------------------ QUALITY CHECK (--check): numbers about the finished mix
function qualityCheck(a) {
  const { out, G, mf, chs, bedL, bedR } = a, lines = [], P = (s = '') => { lines.push(s); console.log(s); };
  const j = { generated: new Date().toISOString(), cuesDir: CUES_DIR, file: path.basename(a.file), notes: [] };
  const band = (x) => filt(filt(x, 'hp', 300, 0.707), 'lp', 4000, 0.707);
  // ---- global integrity
  let nan = 0, clip = 0, clipNear = 0, pkAll = 0, dcL = 0, dcR = 0;
  for (let i = 0; i < NW; i++) {
    const x = out.L[i], y = out.R[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) { nan++; continue; }
    const m = Math.max(Math.abs(x), Math.abs(y)); if (m >= 0.9999) clip++; else if (m >= 0.9) clipNear++; if (m > pkAll) pkAll = m;
    dcL += x; dcR += y;
  }
  j.integrity = { nan, clipped_samples: clip, samples_above_0p9: clipNear, sample_peak_dBFS: +g2db(pkAll).toFixed(2), dc_L: +(dcL / NW).toExponential(2), dc_R: +(dcR / NW).toExponential(2) };
  j.loudness = { integrated_LUFS: mf.I, true_peak_dBTP: mf.TP, LRA_LU: mf.LRA, target_LUFS: LUFS_TARGET, tp_limit_dBTP: TP_LIMIT };
  const lufsOk = Math.abs(mf.I - LUFS_TARGET) <= 1.0, tpOk = mf.TP <= -1.0;
  P('=== AUDIO CHECK ===');
  P(`mix ${path.basename(a.file)}  duration ${(NW / SR).toFixed(2)} s  cues-dir ${path.relative(HERE, CUES_DIR) || '.'}`);
  P(`loudness: integrated ${mf.I} LUFS (target ${LUFS_TARGET}, ${lufsOk ? 'OK' : 'OFF TARGET'})  true peak ${mf.TP} dBTP (${tpOk ? 'OK < -1' : 'TOO HOT'})  LRA ${mf.LRA} LU`);
  P(`integrity: NaN ${nan}  clipped(>=0.9999) ${clip}  samples>0.9 ${clipNear}  sample peak ${j.integrity.sample_peak_dBFS} dBFS  DC L/R ${j.integrity.dc_L}/${j.integrity.dc_R}`);
  // ---- per chapter
  P(); P('per chapter (RMS/peak of final mix; VO and music compared in the 300-4000 Hz speech band while the voice is active):');
  P('  id   start    dur   rms   peak | vo_band  music_band  VO-music | VO-bed(all) | music(gaps) | hf>5k% hf>8k% | mood/amb       cues risers');
  j.chapters = {};
  for (const ch of chs) {
    const a0 = Math.max(0, gi(ch.start)), b0 = Math.min(NW, gi(ch.start + ch.dur)); if (b0 - a0 < SR) continue;
    let e = 0, pk = 0; for (let i = a0; i < b0; i++) { e += 0.5 * (out.L[i] * out.L[i] + out.R[i] * out.R[i]); pk = Math.max(pk, Math.abs(out.L[i]), Math.abs(out.R[i])); }
    const vo = voTrack.slice(a0, b0), mus = new Float32Array(b0 - a0), bed = new Float32Array(b0 - a0);
    for (let i = a0; i < b0; i++) { vo[i - a0] *= G; mus[i - a0] = 0.5 * (MSTEM.L[i] + MSTEM.R[i]) * G; bed[i - a0] = 0.5 * (bedL[i] + bedR[i]) * G; }
    const vb = band(vo), mb = band(mus), bb = band(bed); let ve = 0, me = 0, be = 0, c = 0, mg = 0, gc = 0;
    for (let i = 0; i < b0 - a0; i++) { const va = voAct[((a0 + i) / HOP) | 0]; if (va > 0.5) { ve += vb[i] * vb[i]; me += mb[i] * mb[i]; be += bb[i] * bb[i]; c++; } else if (va < 0.02) { mg += mb[i] * mb[i]; gc++; } }
    const d = (x, n) => (n ? g2db(Math.sqrt(x / n)) : null);
    const sp = specSummary(avgSpec(out.L, out.R, a0, b0) || new Float64Array(SPEC_N / 2).fill(1e-12));
    const r = {
      rms_dBFS: +g2db(Math.sqrt(e / (b0 - a0))).toFixed(1), peak_dBFS: +g2db(pk).toFixed(1), vo_band_dB: c ? +d(ve, c).toFixed(1) : null, music_band_dB: c ? +d(me, c).toFixed(1) : null,
      vo_minus_music_dB: c ? +(d(ve, c) - d(me, c)).toFixed(1) : null, vo_minus_bed_dB: c ? +(d(ve, c) - d(be, c)).toFixed(1) : null, music_band_in_gaps_dB: gc > SR * 0.3 ? +d(mg, gc).toFixed(1) : null,
      hf_gt5k_pct: sp.hf_gt5k_pct, hf_gt8k_pct: sp.hf_gt8k_pct, mood: ch.mood, ambience: ch.amb, cues: ch.cues.length, risers: ch.risers.length, silence_ranges: ch.silence.length,
    };
    j.chapters[ch.id] = r;
    const f = (x, w = 6) => String(x ?? '-').padStart(w);
    P(`  ${ch.id.padEnd(4)} ${f(ch.start.toFixed(1), 6)} ${f(ch.dur.toFixed(1), 5)} ${f(r.rms_dBFS)} ${f(r.peak_dBFS)} | ${f(r.vo_band_dB, 7)} ${f(r.music_band_dB, 10)} ${f(r.vo_minus_music_dB, 9)} | ${f(r.vo_minus_bed_dB, 11)} | ${f(r.music_band_in_gaps_dB, 11)} | ${f(r.hf_gt5k_pct, 6)} ${f(r.hf_gt8k_pct, 6)} | ${(ch.mood + '/' + ch.amb).padEnd(14)} ${f(ch.cues.length, 4)} ${f(ch.risers.length, 5)}`);
  }
  const vm = Object.values(j.chapters).map((r) => r.vo_minus_music_dB).filter((x) => x !== null);
  j.vo_minus_music_range_dB = vm.length ? [Math.min(...vm), Math.max(...vm)] : null;
  P(`  VO minus music (300-4000 Hz, during speech): min ${j.vo_minus_music_range_dB ? j.vo_minus_music_range_dB[0] : '-'} / max ${j.vo_minus_music_range_dB ? j.vo_minus_music_range_dB[1] : '-'} dB  (target 12-20, narration clearly on top)`);
  // ---- chapter joins: music stem continuity
  P(); P('chapter joins (music stem, max sample step within +-40 ms of the join vs. the larger of the max steps 3-6 s before / after the join; ratio < ~2 = no click/pop):');
  j.joins = [];
  const maxStep = (x, i0, i1) => { let m = 0; for (let i = Math.max(1, i0); i < Math.min(NW, i1); i++) { const s = Math.max(Math.abs(MSTEM.L[i] - MSTEM.L[i - 1]), Math.abs(MSTEM.R[i] - MSTEM.R[i - 1])); if (s > m) m = s; } return m; };
  for (let k = 1; k < chs.length; k++) {
    const t = chs[k].start, jw = maxStep(null, gi(t - 0.04), gi(t + 0.04)), ref = Math.max(maxStep(null, gi(t + 3), gi(t + 6)), maxStep(null, gi(t - 6), gi(t - 3))), ratio = ref > 0 ? jw / ref : 0, mj = { join: `${chs[k - 1].id}->${chs[k].id}`, at_s: +t.toFixed(2), step_ratio: +ratio.toFixed(2), ok: ratio < 2.0 };
    j.joins.push(mj); P(`  ${mj.join.padEnd(8)} at ${String(mj.at_s).padStart(7)} s  step ratio ${String(mj.step_ratio).padStart(5)}  ${mj.ok ? 'OK' : 'CHECK'}`);
  }
  // ---- end tail
  P(); P('end of video (no dead air; smooth fade to exact zero):');
  const lastCh = chs[chs.length - 1], lv = lastCh.vo.length ? lastCh.vo[lastCh.vo.length - 1] : null, voEnd = lv ? lastCh.start + lv.end : NW / SR - 1;
  const endT = W1, tail = [];
  for (let t = Math.max(W0, endT - 2.5); t + 0.2499 < endT; t += 0.25) { const a0 = gi(t), b0 = Math.min(NW, gi(t + 0.25)); let e = 0; for (let i = a0; i < b0; i++) e += 0.5 * (out.L[i] * out.L[i] + out.R[i] * out.R[i]); tail.push([+t.toFixed(2), +g2db(Math.sqrt(e / (b0 - a0))).toFixed(1)]); }
  const lastS = Math.max(Math.abs(out.L[NW - 1]), Math.abs(out.R[NW - 1])), after = tail.filter(([t]) => t >= voEnd + 0.05), minAfter = after.length ? Math.min(...after.map((x) => x[1])) : null;
  j.end = { last_vo_ends_s: +voEnd.toFixed(2), video_ends_s: +endT.toFixed(2), tail_after_vo_s: +(endT - voEnd).toFixed(2), last_sample_abs: +lastS.toExponential(2), rms_per_250ms_dB: tail, min_rms_after_vo_dB: minAfter };
  P(`  last VO line ends ${voEnd.toFixed(2)} s, video ends ${endT.toFixed(2)} s (tail ${(endT - voEnd).toFixed(2)} s), last sample ${lastS.toExponential(1)} (${lastS < 1e-3 ? 'OK, ends at zero' : 'NOT ZERO'})`);
  P('  RMS per 250 ms (dBFS) over the last 2.5 s: ' + tail.map(([t, v]) => `${t.toFixed(2)}:${v}`).join('  '));
  P(`  quietest 250 ms after the VO ends: ${minAfter} dBFS (${minAfter !== null && minAfter > -48 ? 'OK, ring-out audible, no dead air' : 'DEAD AIR?'}); the ring-out fades to exactly zero in the last ~0.5 s`);
  // ---- spectral summary
  P(); P('spectral summary (whole final mix, share of energy per band):');
  const whole = avgSpec(out.L, out.R, 0, NW), bpw = bandPower(whole), btw = bpw.reduce((x, y) => x + y, 0) || 1, spw = specSummary(whole);
  P('  ' + BAND_NAMES.map((b, k) => `${b}Hz ${(100 * bpw[k] / btw).toFixed(1)}%`).join('  '));
  P(`  centroid ${spw.centroid_Hz} Hz, rolloff85 ${spw.rolloff85_Hz} Hz, energy above 5 kHz ${spw.hf_gt5k_pct}%, above 8 kHz ${spw.hf_gt8k_pct}%  (${spw.hf_gt5k_pct < 8 && spw.rolloff85_Hz < 5000 ? 'no harsh highs' : 'CHECK highs'})`);
  const mspec = avgSpec(MSTEM.L, MSTEM.R, 0, NW), msp = mspec ? specSummary(mspec) : null;
  if (msp) P(`  music stem alone: centroid ${msp.centroid_Hz} Hz, rolloff85 ${msp.rolloff85_Hz} Hz, >5 kHz ${msp.hf_gt5k_pct}%, >8 kHz ${msp.hf_gt8k_pct}%`);
  j.spectral = { bands_pct: Object.fromEntries(BAND_NAMES.map((b, k) => [b, +(100 * bpw[k] / btw).toFixed(1)])), ...spw, music_stem: msp };
  // time x band shade grid (4 s frames)
  P(); P('time x band grid (rows = octave bands, columns = 4 s frames, darker = louder; relative to the loudest cell, 6 dB per step; | marks chapter starts):');
  const FR = 4, nF = Math.ceil((NW / SR) / FR), grid = [];
  for (let f = 0; f < nF; f++) { const a0 = f * FR * SR, b0 = Math.min(NW, a0 + FR * SR), sp2 = avgSpec(out.L, out.R, a0, b0); grid.push(sp2 ? bandPower(sp2) : new Float64Array(BAND_NAMES.length)); }
  let gmax = 1e-20; for (const r of grid) for (const v of r) if (v > gmax) gmax = v;
  const shades = ' .:-=+*#%@'; const starts = new Set(chs.map((c) => Math.floor((c.start - W0) / FR)));
  for (let b = BAND_NAMES.length - 1; b >= 0; b--) {
    let row = ''; for (let f = 0; f < nF; f++) { const dBr = 10 * Math.log10((grid[f][b] + 1e-20) / gmax), idx = clamp(Math.round(9 + dBr / 6), 0, 9); row += shades[idx]; }
    P(BAND_NAMES[b].padStart(8) + ' ' + row);
  }
  P(' '.repeat(9) + Array.from({ length: nF }, (_, f) => (starts.has(f) ? '|' : ' ')).join(''));
  P('         ' + chs.map((c) => `${c.id}@${Math.floor((c.start - W0) / FR)}`).join(' ') + `   (column = ${FR} s)`);
  // ---- verdict
  const bad = [];
  if (nan) bad.push('NaN samples'); if (clip) bad.push('clipping'); if (!lufsOk) bad.push('loudness off target'); if (!tpOk) bad.push('true peak above -1 dBTP');
  if (vm.some((x) => x < 11)) bad.push('VO-minus-music below 11 dB in a chapter'); if (j.joins.some((x) => !x.ok)) bad.push('chapter join step');
  if (lastS >= 1e-3) bad.push('end not at zero'); if (minAfter !== null && minAfter <= -48) bad.push('dead air at end');
  j.verdict = bad.length ? 'ATTENTION: ' + bad.join('; ') : 'PASS';
  P(); P('verdict: ' + j.verdict);
  P('(all of this is numbers only; the audio has not been listened to)');
  fs.writeFileSync(a.fileCheckJson, JSON.stringify(j, null, 1)); fs.writeFileSync(a.fileCheckTxt, lines.join('\n') + '\n');
  console.log(`check -> ${a.fileCheckJson}  and  ${a.fileCheckTxt}`);
  return j;
}

// ------------------------------------------------------------------ MAIN
function main() {
  if (flag('mux-only')) { mux(); return; }
  if (flag('demo-music')) { demoMusic(); return; }
  if (vocabMissing.length) console.log('WARN vocabulary types NOT implemented:', vocabMissing.join(','));
  if (SOLO) { soloTest(); return; }
  fs.mkdirSync(OUT, { recursive: true });
  buildVO(); lap(`VO built (${voStats.lines} lines, peak ${voStats.peak})`);
  const chs = CH_ORDER.map((id, k) => loadChapter(id, k));
  chapters.push(...chs);
  const unk = Object.entries(unknownTypes);
  if (unk.length) console.log('WARN unknown cue types ignored: ' + unk.map(([t, n]) => `${t} x${n}`).join(', ') + '  (supported: see --list-types)');
  buildDuck();
  buildGates(chs);
  buildBusCtl();
  const cueCounts = {}, soloAll = {};
  chs.forEach((ch, k) => {
    if (ch.start + ch.dur + 7 < W0 || ch.start - 1.5 > W1) return;
    const { solo } = renderChapter(ch, k === 0, k === chs.length - 1, k);
    soloAll[ch.id] = solo; cueCounts[ch.id] = ch.cues.length;
    lap(`${ch.id} rendered: mood ${ch.mood}, amb ${ch.amb}, ${ch.cues.length} cues, ${ch.risers.length} risers, ${ch.silence.length} silences${musicInfo[ch.id] ? ', colour ' + musicInfo[ch.id].colour : ''}`);
  });
  applyDropOuts();
  if (STEM) { sfxGuard(); lap(`sfx guard: max GR ${guardInfo.max_reduction_dB} dB, ${guardInfo.pct_time_reduced_3dB}% of time >3 dB`); } else guardInfo.enabled = false;
  filt(preL, 'hp', 22, 0.707, preL); filt(preR, 'hp', 22, 0.707, preR);
  { // bed master fades (the voice is NOT faded): attack 8 ms; at the very end the bed (music ring-out + ambience) falls to exact zero
    const fe = W1 >= TOTAL - 1e-6 ? 1.1 : 0.05, a = Math.round(0.008 * SR);
    for (let i = 0; i < NW; i++) {
      const tr = (NW - 1 - i) / SR; let g = i < a ? i / a : 1;
      if (tr < fe) g *= POW(COS((1 - tr / fe) * PI / 2), 1.6);
      if (g !== 1) { preL[i] *= g; preR[i] *= g; }
    }
  }
  const bedL = Float32Array.from(preL), bedR = Float32Array.from(preR); // kept for the VO-vs-bed report (pre VO)
  for (let i = 0; i < NW; i++) { preL[i] += voTrack[i]; preR[i] += voTrack[i]; }
  { const a = Math.round(0.05 * SR); for (let i = 0; i < a && W1 >= TOTAL - 1e-6; i++) { const k = NW - 1 - i, g = i / a; preL[k] *= g; preR[k] *= g; } } // last 50 ms: guarantees the final sample is zero
  lap('assembled; loudness loop');
  const { out, m, G, ceilDb } = loudnessLoop();
  writeWavStream(fileMix, NW, 24, (i) => out.L[i], (i) => out.R[i]);
  if (!DEBUG && !outStem) { try { fs.copyFileSync(fileMix, path.join(OUT, 'mix_full.wav')); } catch { } }
  const mf = measureFile(fileMix);
  lap(`${path.basename(fileMix)} written: ${mf.I} LUFS, TP ${mf.TP} dBTP, LRA ${mf.LRA} LU`);
  if (flag('wav-only') && !flag('check')) { console.log(`wav-only -> ${fileMix}  (${mf.I} LUFS, ${mf.TP} dBTP)`); return; }

  // ---- integrity scan
  let nan = 0, clip = 0, maxStep = 0, maxStepAt = 0, dcL = 0, dcR = 0;
  for (let i = 0; i < NW; i++) {
    const a = out.L[i], b = out.R[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) { nan++; continue; }
    if (Math.abs(a) >= 0.9999 || Math.abs(b) >= 0.9999) clip++;
    dcL += a; dcR += b;
    if (i) { const s = Math.max(Math.abs(a - out.L[i - 1]), Math.abs(b - out.R[i - 1])); if (s > maxStep) { maxStep = s; maxStepAt = i; } }
  }
  const band = (x) => filt(filt(x, 'hp', 300, 0.707), 'lp', 4000, 0.707);
  const chapRep = {};
  for (const ch of chs) {
    const a = Math.max(0, gi(ch.start)), b = Math.min(NW, gi(ch.start + ch.dur)); if (b - a < SR) continue;
    let e = 0, pk = 0; for (let i = a; i < b; i++) { e += 0.5 * (out.L[i] * out.L[i] + out.R[i] * out.R[i]); pk = Math.max(pk, Math.abs(out.L[i]), Math.abs(out.R[i])); }
    const vo = voTrack.slice(a, b).map((x) => x * G), bed = new Float32Array(b - a); for (let i = a; i < b; i++) bed[i - a] = 0.5 * (bedL[i] + bedR[i]) * G;
    const vb = band(vo), bb = band(bed); let ve = 0, be = 0, c = 0, ge = 0, gc = 0;
    for (let i = 0; i < b - a; i++) { const va = voAct[((a + i) / HOP) | 0]; if (va > 0.5) { ve += vb[i] * vb[i]; be += bb[i] * bb[i]; c++; } else if (va < 0.02) { ge += bb[i] * bb[i]; gc++; } }
    chapRep[ch.id] = { rms_dBFS: +g2db(Math.sqrt(e / (b - a))).toFixed(1), peak_dBFS: +g2db(pk).toFixed(1), vo_band_dB: c ? +g2db(Math.sqrt(ve / c)).toFixed(1) : null, bed_band_during_vo_dB: c ? +g2db(Math.sqrt(be / c)).toFixed(1) : null, bed_band_in_gaps_dB: gc ? +g2db(Math.sqrt(ge / gc)).toFixed(1) : null, vo_minus_bed_dB: c ? +(g2db(Math.sqrt(ve / c)) - g2db(Math.sqrt(be / c))).toFixed(1) : null, mood: ch.mood, ambience: ch.amb, cues: ch.cues.length, risers: ch.risers.length, silence: ch.silence.length };
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
    modes: { legacyWhoosh: LEGACY, sfxGuard: !NO_GUARD, whooshTrim_dB: LEGACY ? 0 : +g2db(WHOOSH_TRIM).toFixed(1), whooshLowpass_Hz: LEGACY ? null : WHOOSH_LP, whooshMinGap_s: LEGACY ? null : WHOOSH_MIN_GAP, sfxMaster_dB: +g2db(SFX_MASTER).toFixed(1), duck_dB: DUCK },
    music: musicInfo, extraTypes: EXTRA_TYPES, whooshFamilyPerChapter: whooshFamilyCounts, cueTypeCounts: typeCounts, whooshGuardDropped, sfxGuard: guardOut,
    chapters: chapRep, cues: cueRep, timing_s: +((Date.now() - T_START) / 1000).toFixed(1),
  };
  fs.writeFileSync(fileReport, JSON.stringify(report, null, 1));
  console.log(`report -> ${fileReport}`);
  console.log('integrity:', JSON.stringify(report.integrity));
  console.log('whoosh-family per chapter:', JSON.stringify(whooshFamilyCounts), whooshGuardDropped.length ? `(spacing guard dropped ${whooshGuardDropped.length})` : '');
  if (flag('check')) qualityCheck({ out, G, mf, chs, bedL, bedR, file: fileMix, fileCheckJson: fileCheck + '.json', fileCheckTxt: fileCheck + '.txt' });
  else for (const [id, r] of Object.entries(chapRep)) console.log(`  ${id.padEnd(5)} rms ${String(r.rms_dBFS).padStart(6)} pk ${String(r.peak_dBFS).padStart(6)}  vo ${r.vo_band_dB}  bed ${r.bed_band_during_vo_dB}  vo-bed ${r.vo_minus_bed_dB}  ${r.mood || ''} ${r.ambience || ''} cues ${r.cues ?? ''}`);
  if (flag('mux')) mux();
}
main();
