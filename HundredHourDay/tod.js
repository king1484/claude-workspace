// tod.js — time-of-day world for "What If One Day Lasted 100 Hours?"  (global TOD, plain script)
// H = hours since sunrise (0..100, wraps). Sun: H=0 east/left horizon, 25 overhead, 50 west/right horizon, 75 midnight.
// Deterministic Canvas 2D: every function is a pure function of (cam, H, o). Static art lives in lazily built offscreen caches.
// Needs lib.js (clamp, lerp, smooth, rng, hash1, hex2rgb, TAU). Uses rigs.js PAL_REAL (optional) for PAL_SHADOW / heroPal.
(function (G) {
'use strict';
const W = 1920, HT = 1080, TWO_PI = Math.PI * 2;

// ------------------------------------------------------------------ small helpers
const rgb = (c, a) => (a == null || a >= 1) ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
  : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (+Math.max(0, a).toFixed(3)) + ')';
const mixc = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
const mulc = (A, M) => [A[0] * M[0], A[1] * M[1], A[2] * M[2]];
const hx = (h) => hex2rgb(h);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
const CACHE = {};
const cached = (k, fn) => (CACHE[k] || (CACHE[k] = fn()));
const zsOf = (cam, p) => 1 + (cam.z - 1) * (0.25 + 0.75 * Math.min(p, 1.2));
const sat01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
function radial(c, x, y, r, stops) {
  const gr = c.createRadialGradient(x, y, 0, x, y, r);
  for (const s of stops) gr.addColorStop(s[0], s[1]);
  c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TWO_PI); c.fill();
}
// piecewise colour/number ramp over H, cyclic (period 100)
function mkRamp(keys) {
  const ks = keys.map(k => [k[0], typeof k[1] === 'string' ? hx(k[1]) : k[1]]);
  const n = ks.length;
  return function (H) {
    H = ((H % 100) + 100) % 100;
    let i = n - 1;
    for (let j = 0; j < n; j++) if (ks[j][0] > H) { i = j - 1; break; }
    let a, b, h0, h1;
    if (i < 0) { a = ks[n - 1]; b = ks[0]; h0 = a[0] - 100; h1 = b[0]; }
    else if (i === n - 1) { a = ks[i]; b = ks[0]; h0 = a[0]; h1 = b[0] + 100; }
    else { a = ks[i]; b = ks[i + 1]; h0 = a[0]; h1 = b[0]; }
    let t = (H - h0) / (h1 - h0); t = t * 0.4 + smooth(t) * 0.6;
    if (typeof a[1] === 'number') return a[1] + (b[1] - a[1]) * t;
    const A = a[1], B = b[1], out = new Array(A.length);
    for (let q = 0; q < A.length; q++) out[q] = A[q] + (B[q] - A[q]) * t;
    return out;
  };
}

// ------------------------------------------------------------------ time-of-day colour tables
//          H     skyTop     skyMid     skyHor     sun        light      lit (surface multiplier)
const KEYS = [
  [0,    '#3f6cc4', '#f2a2b4', '#ffd47a', '#ffd070', '#ffb468', [1.00, 0.76, 0.62]],
  [2,    '#4f8ad8', '#f6c8c0', '#ffe09a', '#ffe088', '#ffc888', [1.00, 0.84, 0.68]],
  [5,    '#3d93e6', '#97cbf2', '#ffe9b8', '#fff0b0', '#ffe3b8', [1.00, 0.92, 0.80]],
  [10,   '#2a8cf0', '#74c3f7', '#c4e8ff', '#fff6cc', '#fff3d8', [1.00, 0.97, 0.91]],
  [25,   '#3c9af4', '#8fd0f8', '#eaf7ff', '#ffffff', '#ffffff', [1.00, 1.00, 1.00]],
  [40,   '#3a8fe6', '#94c8f0', '#ffe9b0', '#fff0b8', '#fff0d0', [1.00, 0.96, 0.87]],
  [45,   '#4a82d0', '#f2c888', '#ffc860', '#ffd060', '#ffcf80', [1.00, 0.85, 0.62]],
  [48.5, '#5a6cc0', '#f5987a', '#ff8a3c', '#ff8a30', '#ff9a50', [1.00, 0.67, 0.50]],
  [50,   '#4a3a9a', '#ea5470', '#ff7436', '#ff5a28', '#ff7a48', [0.96, 0.54, 0.46]],
  [52,   '#2e2672', '#b04480', '#f06a50', '#ff4a30', '#e0709a', [0.80, 0.44, 0.54]],
  [55,   '#1d1d5a', '#4c3a8e', '#b2508e', '#d04040', '#a08ae0', [0.52, 0.42, 0.66]],
  [59,   '#0f1544', '#222c70', '#3f3c88', '#b03050', '#8090f0', [0.32, 0.35, 0.58]],
  [64,   '#080d2a', '#0c163a', '#162556', '#a02848', '#7f9cff', [0.23, 0.29, 0.52]],
  [75,   '#04081c', '#08102c', '#0d1a40', '#ffe0a0', '#a0b8ff', [0.25, 0.32, 0.56]],
  [90,   '#050920', '#08102e', '#101b48', '#ffe0a0', '#7f9cff', [0.21, 0.27, 0.50]],
  [96,   '#0f1a4a', '#26387c', '#8a6aa0', '#ffb060', '#8aa0ff', [0.36, 0.42, 0.65]],
  [98.5, '#2a3f8f', '#8d6fae', '#ff9a7a', '#ffa050', '#ffa8a0', [0.72, 0.56, 0.66]]
];
const R_TOP = mkRamp(KEYS.map(k => [k[0], k[1]])), R_MID = mkRamp(KEYS.map(k => [k[0], k[2]])), R_HOR = mkRamp(KEYS.map(k => [k[0], k[3]]));
const R_SUN = mkRamp(KEYS.map(k => [k[0], k[4]])), R_LIGHT = mkRamp(KEYS.map(k => [k[0], k[5]])), R_LIT = mkRamp(KEYS.map(k => [k[0], k[6]]));

const _pc = new Map();
function pal(H, o) {
  o = o || {};
  H = ((H % 100) + 100) % 100;
  const heat = sat01(o.heat || 0), frost = sat01(o.frost || 0);
  const key = H.toFixed(3) + '|' + heat.toFixed(3) + '|' + frost.toFixed(3);
  { const hit = _pc.get(key); if (hit) return hit; }
  const a = TWO_PI * H / 100, elev = Math.sin(a), cs = Math.cos(a);
  let top = R_TOP(H), mid = R_MID(H), hor = R_HOR(H), sun = R_SUN(H), light = R_LIGHT(H), lit = R_LIT(H);
  const night = smooth(sat01((0.05 - elev) / 0.30));
  const sunUp = smooth(sat01((elev + 0.04) / 0.12));
  const gold = sunUp * sat01(1 - Math.max(0, elev) / 0.55);
  const day = 1 - night;
  if (heat > 0) {                       // white-hot bleached sky
    const k = heat * day;
    top = mixc(top, [150, 200, 250], k * 0.55); mid = mixc(mid, [246, 242, 220], k * 0.7); hor = mixc(hor, [255, 250, 232], k * 0.85);
    sun = mixc(sun, [255, 252, 235], k * 0.8); lit = mixc(lit, [1, 0.97, 0.88], k * 0.5);
  }
  if (frost > 0) {                      // icy pale sky, blue light
    const k = frost;
    top = mixc(top, [96, 132, 205], k * 0.5); mid = mixc(mid, [190, 214, 244], k * 0.55); hor = mixc(hor, [226, 240, 255], k * 0.6);
    lit = mixc(lit, [lit[0] * 0.82, lit[1] * 0.92, Math.min(1, lit[2] * 1.08)], k * 0.8); light = mixc(light, [200, 225, 255], k * 0.4);
  }
  const sh = mulc(lit, [0.55, 0.62, 0.86]);
  const haze = mixc(hor, mid, 0.25);
  const wallLit = mulc([232, 226, 214], lit), roadLit = mulc([96, 100, 112], lit), walkLit = mulc([228, 220, 206], lit);
  const P = {
    skyTop: rgb(top), skyMid: rgb(mid), skyHor: rgb(hor), sunCol: rgb(sun), light: rgb(light), shade: rgb(sh.map(v => v * 255)),
    ground: rgb(mulc([214, 204, 186], lit)), road: rgb(roadLit), walk: rgb(walkLit),
    bld: [rgb(mixc(haze, mulc([150, 162, 196], lit), 0.45)), rgb(mixc(haze, mulc([196, 190, 200], lit), 0.7)), rgb(mulc([214, 204, 196], lit))],
    rim: rgb(mixc(light, [255, 255, 255], 0.1)), haze: rgb(haze),
    win: sat01((night - 0.12) * 1.35), star: smooth(sat01((night - 0.4) / 0.5)), night: night, heat: heat,
    // extras (numbers / rgb arrays 0..255 unless noted)
    H: H, elev: elev, cosA: cs, sunUp: sunUp, gold: gold, day: day, frost: frost,
    shx: (sunUp > 0.001 ? Math.max(-4, Math.min(4, cs / Math.max(elev, 0.12))) * sunUp : 0),  // shadow length per unit height (x dir, signed)
    _: { top: top, mid: mid, hor: hor, sun: sun, light: light, lit: lit, sh: sh, haze: haze }
  };
  if (_pc.size > 24) _pc.delete(_pc.keys().next().value);
  _pc.set(key, P);
  return P;
}

// ------------------------------------------------------------------ sun / moon geometry (reference screen coords at cam {900,612,1})
const HORY = { city: 610, desert: 640, farm: 600, coast: 566 };
function arcPos(H, o, moon) {
  const a = TWO_PI * H / 100, e = Math.sin(a) * (moon ? -1 : 1), c = Math.cos(a) * (moon ? -1 : 1);
  const hy = HORY[(o && o.scene) || 'city'] || 610;
  let x = 960 - c * 860;
  if (!moon && o && o.sunX != null) x = o.sunX;
  const top = moon ? 120 : 92;
  return { x: x, y: hy - e * (hy - top), e: e };
}
function skyMap(cam, rx, ry) {
  const zs = zsOf(cam, 0.05);
  return { x: 960 + zs * ((rx - 960) + (900 - cam.x) * 0.05), y: 540 + zs * ((ry - 540) + (612 - cam.y) * 0.05), zs: zs };
}
function skyTransform(g, cam) {
  const zs = zsOf(cam, 0.05);
  g.translate(960, 540); g.scale(zs, zs); g.translate(-960 + (900 - cam.x) * 0.05, -540 + (612 - cam.y) * 0.05);
}
function sunRadius(e) { return 66 - 14 * sat01(e * 1.6); }      // bigger near the horizon
function sunScreen(H, cam, o) {
  cam = cam || { x: 900, y: 612, z: 1, r: 0 };
  const s = arcPos(H, o, false), m = skyMap(cam, s.x, s.y);
  return { x: m.x, y: m.y, r: sunRadius(s.e) * m.zs, visible: s.e > -0.06, elev: s.e };
}
function moonScreen(H, cam, o) {
  cam = cam || { x: 900, y: 612, z: 1, r: 0 };
  const s = arcPos(H, o, true), m = skyMap(cam, s.x, s.y);
  return { x: m.x, y: m.y, r: 48 * m.zs, visible: s.e > -0.06, elev: s.e };
}

// ------------------------------------------------------------------ scratch canvases (layer compositing)
const MARG = 160, SGW = W + 2 * MARG, SGH = HT + 2 * MARG;
let SG = null, SGc = null, S2 = null, S2c = null;
function scratchInit() {
  if (SG) return;
  SG = mk(SGW, SGH); SGc = SG.getContext('2d'); S2 = mk(SGW, SGH); S2c = S2.getContext('2d');
}
// A tile = one horizontally repeating strip of painted art in a layer's own world coordinates.
// spec: {tw, y0, y1, sc, edges:bool, win:0|1|2, paint(X, rand)}; X = {b, l, r, w1, w2} contexts (already scaled/translated to layer world coords)
function makeTile(spec, seed) {
  const T = { tw: spec.tw, y0: spec.y0, y1: spec.y1, sc: spec.sc };
  const mkc = () => { const c = mk(spec.tw * spec.sc, (spec.y1 - spec.y0) * spec.sc), x = c.getContext('2d'); x.scale(spec.sc, spec.sc); x.translate(0, -spec.y0); return [c, x]; };
  const X = {};
  [T.base, X.b] = mkc();
  if (spec.edges) { [T.eL, X.l] = mkc(); [T.eR, X.r] = mkc(); }
  if (spec.win) { [T.w1, X.w1] = mkc(); if (spec.win > 1) [T.w2, X.w2] = mkc(); }
  spec.paint(X, rng(seed || 1), T);
  return T;
}

// o: {lit:rgb(0..1), hazeC, hazeA, warm:[rgb,a], bleach:a, frost:a, rimL, rimR, rimC, rimA, win1, win2}
// ---- baked tint cache: the tinted version of a tile (lit multiply, haze, warm, rim, windows) depends only on (H, heat, frost),
// never on the camera, so it is baked per whole-hour key and cross-faded between the two neighbouring keys (the tint is linear in H).
let BT = null, BTc = null;
function bakeTile(T, op, pool) {
  const w = T.base.width, h = T.base.height;
  let c = pool.pop(); if (!c) c = mk(w, h);
  const x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, w, h);
  x.drawImage(T.base, 0, 0);
  if (op.lit) {
    x.globalCompositeOperation = 'multiply'; x.fillStyle = rgb(op.lit.map(v => v * 255)); x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(T.base, 0, 0);
  }
  x.globalCompositeOperation = 'source-atop';
  if (op.hazeA > 0.004) { x.fillStyle = rgb(op.hazeC, op.hazeA); x.fillRect(0, 0, w, h); }
  if (op.warm && op.warm[1] > 0.004) { x.fillStyle = rgb(op.warm[0], op.warm[1]); x.fillRect(0, 0, w, h); }
  if (op.bleach > 0.004) { x.fillStyle = 'rgba(255,252,240,' + op.bleach + ')'; x.fillRect(0, 0, w, h); }
  if (op.frost > 0.004) { x.fillStyle = 'rgba(214,232,255,' + (op.frost * 0.3) + ')'; x.fillRect(0, 0, w, h); }
  if (T.eL && op.rimA > 0.01 && (op.rimL > 0.01 || op.rimR > 0.01)) {
    if (!BT) { BT = mk(w, h); BTc = BT.getContext('2d'); }
    if (BT.width < w || BT.height < h) { BT.width = Math.max(BT.width, w); BT.height = Math.max(BT.height, h); BTc = BT.getContext('2d'); }
    const q = BTc; q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1; q.clearRect(0, 0, w, h);
    if (op.rimL > 0.01) { q.globalAlpha = op.rimL; q.drawImage(T.eL, 0, 0); }
    if (op.rimR > 0.01) { q.globalAlpha = op.rimR; q.drawImage(T.eR, 0, 0); }
    q.globalAlpha = 1; q.globalCompositeOperation = 'source-in'; q.fillStyle = rgb(op.rimC); q.fillRect(0, 0, w, h);
    x.globalAlpha = op.rimA; x.drawImage(BT, 0, 0, w, h, 0, 0, w, h); x.globalAlpha = 1;
  }
  x.globalCompositeOperation = 'source-over';
  if (T.w1 && op.win1 > 0.01) { x.globalAlpha = op.win1; x.drawImage(T.w1, 0, 0); }
  if (T.w2 && op.win2 > 0.01) { x.globalAlpha = op.win2; x.drawImage(T.w2, 0, 0); }
  x.globalAlpha = 1;
  return c;
}
function getBaked(T, o, Hk, hs, fs) {
  const bk = T._bk || (T._bk = new Map()), pool = T._pool || (T._pool = []);
  const key = o.mkid + '|' + Hk + '|' + hs + '|' + fs;
  let c = bk.get(key);
  if (c) { bk.delete(key); bk.set(key, c); return c; }
  while (bk.size >= 5) { const k0 = bk.keys().next().value; pool.push(bk.get(k0)); bk.delete(k0); }
  c = bakeTile(T, o.mk(Hk, hs, fs), pool); bk.set(key, c); return c;
}
function drawBaked(g, cam, p, T, o) {
  const zs = zsOf(cam, p), ax = W / 2 - zs * cam.x * p, ay = HT / 2 - zs * (540 + (cam.y - 540) * p);
  const half = (W / 2 + MARG) / zs + 20, vx0 = cam.x * p - half, vx1 = cam.x * p + half;
  const k0 = Math.floor(vx0 / T.tw), k1 = Math.floor(vx1 / T.tw);
  const Hq = ((o.H % 100) + 100) % 100, i0 = Math.floor(Hq), f = Hq - i0;
  const hs = Math.round(o.heat * 20) / 20, fs = Math.round(o.frost * 20) / 20;
  const A = getBaked(T, o, i0, hs, fs), B = f > 0.015 ? getBaked(T, o, (i0 + 1) % 100, hs, fs) : null;
  const a0 = g.globalAlpha;
  g.save(); g.translate(ax, ay); g.scale(zs, zs);
  const hh = T.y1 - T.y0;
  for (let k = k0; k <= k1; k++) g.drawImage(A, k * T.tw, T.y0, T.tw + 0.8, hh);
  if (B) { g.globalAlpha = a0 * f; for (let k = k0; k <= k1; k++) g.drawImage(B, k * T.tw, T.y0, T.tw + 0.8, hh); }
  g.restore();
}
function drawTileLayer(g, cam, p, T, o) {
  if (o.mk) { drawBaked(g, cam, p, T, o); return; }
  scratchInit();
  const zs = zsOf(cam, p), ax = W / 2 - zs * cam.x * p, ay = HT / 2 - zs * (540 + (cam.y - 540) * p);
  let ry0 = Math.floor(ay + zs * T.y0), ry1 = Math.ceil(ay + zs * T.y1);
  ry0 = Math.max(ry0, -MARG); ry1 = Math.min(ry1, HT + MARG);
  if (ry1 <= ry0) return;
  const half = (W / 2 + MARG) / zs + 20, vx0 = cam.x * p - half, vx1 = cam.x * p + half;
  const k0 = Math.floor(vx0 / T.tw), k1 = Math.floor(vx1 / T.tw);
  const s = SGc, rh = ry1 - ry0, rY = ry0 + MARG;
  s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = 'source-over'; s.globalAlpha = 1;
  s.clearRect(0, rY, SGW, rh);
  const tiles = (c, cv) => {
    c.setTransform(zs, 0, 0, zs, ax + MARG, ay + MARG);
    for (let k = k0; k <= k1; k++) c.drawImage(cv, k * T.tw, T.y0, T.tw + 0.8, T.y1 - T.y0);
    c.setTransform(1, 0, 0, 1, 0, 0);
  };
  tiles(s, T.base);
  if (o.lit) {
    s.globalCompositeOperation = 'multiply'; s.fillStyle = rgb(o.lit.map(v => v * 255)); s.fillRect(0, rY, SGW, rh);
    const q0 = S2c; q0.setTransform(1, 0, 0, 1, 0, 0); q0.globalCompositeOperation = 'source-over'; q0.globalAlpha = 1; q0.clearRect(0, rY, SGW, rh); tiles(q0, T.base);
    s.globalCompositeOperation = 'destination-in'; s.drawImage(S2, 0, rY, SGW, rh, 0, rY, SGW, rh);
  }
  s.globalCompositeOperation = 'source-atop';
  if (o.hazeA > 0.004) { s.fillStyle = rgb(o.hazeC, o.hazeA); s.fillRect(0, rY, SGW, rh); }
  if (o.warm && o.warm[1] > 0.004) { s.fillStyle = rgb(o.warm[0], o.warm[1]); s.fillRect(0, rY, SGW, rh); }
  if (o.bleach > 0.004) { s.fillStyle = 'rgba(255,252,240,' + o.bleach + ')'; s.fillRect(0, rY, SGW, rh); }
  if (o.frost > 0.004) { s.fillStyle = 'rgba(214,232,255,' + (o.frost * 0.3) + ')'; s.fillRect(0, rY, SGW, rh); }
  if (T.eL && o.rimA > 0.01 && (o.rimL > 0.01 || o.rimR > 0.01)) {
    const q = S2c;
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1; q.clearRect(0, rY, SGW, rh);
    if (o.rimL > 0.01) { q.globalAlpha = o.rimL; tiles(q, T.eL); }
    if (o.rimR > 0.01) { q.globalAlpha = o.rimR; tiles(q, T.eR); }
    q.globalAlpha = 1; q.globalCompositeOperation = 'source-in'; q.fillStyle = rgb(o.rimC); q.fillRect(0, rY, SGW, rh);
    s.globalCompositeOperation = 'source-atop'; s.globalAlpha = o.rimA;
    s.drawImage(S2, 0, rY, SGW, rh, 0, rY, SGW, rh);
    s.globalAlpha = 1;
  }
  s.globalCompositeOperation = 'source-over';
  if (T.w1 && o.win1 > 0.01) { s.globalAlpha = o.win1; tiles(s, T.w1); }
  if (T.w2 && o.win2 > 0.01) { s.globalAlpha = o.win2; tiles(s, T.w2); }
  s.globalAlpha = 1;
  g.drawImage(SG, 0, rY, SGW, rh, -MARG, ry0, SGW, rh);
}

// standard tint options for a layer at "depth" d (0 far .. 1 near)
function layerOpts(P, d, o, extra) {
  o = o || {};
  const hazeK = [0.62, 0.34, 0.10][Math.min(2, Math.round(d * 2))] * (extra && extra.hazeK != null ? extra.hazeK : 1);
  const sunSide = sat01((960 - sunX(P, o)) / 600 * 0.5 + 0.5);        // 1: sun on the left
  const moonSide = 1 - sunSide;
  const rimA = (P.sunUp * (0.35 + 0.65 * P.gold) * 0.85 + P.night * 0.22) * (1 - 0.3 * d);
  const L = P.elev > -0.08 ? sunSide : moonSide;
  const lv = P._.lit, avg = (lv[0] + lv[1] + lv[2]) / 3, ds = (extra && extra.desat != null) ? extra.desat : 0.5 * d * d + 0.12 * d;
  const litD = [lv[0] + (avg - lv[0]) * ds, lv[1] + (avg - lv[1]) * ds, lv[2] + (avg - lv[2]) * ds];
  const res = {
    lit: litD, hazeC: P._.haze, hazeA: hazeK * (0.35 + 0.65 * P.day) * (1 - 0.6 * (o.heat || 0)) + (o.heat || 0) * 0.18 * (1 - d),
    warm: [P._.light, P.gold * 0.10 * (0.5 + d * 0.5)],
    bleach: (o.heat || 0) * 0.18 * P.day, frost: o.frost || 0,
    rimL: L, rimR: 1 - L, rimC: P._.light, rimA: rimA,
    win1: sat01(P.win * 1.5) * (1 - 0.3 * (1 - d)), win2: sat01(P.win * 1.5 - 0.55) * (1 - 0.3 * (1 - d))
  };
  const _extra = extra, _d = d, _o = o;
  res.H = P.H; res.heat = sat01(o.heat || 0); res.frost = sat01(o.frost || 0);
  res.mkid = d + '|' + (extra ? (extra.desat + '|' + extra.hazeK) : '');
  res.mk = (Hk, hs, fs) => { const o2 = Object.assign({}, _o, { heat: hs, frost: fs }); const r2 = layerOpts(pal(Hk, o2), _d, o2, _extra); r2.mk = null; return r2; };
  return res;
}
function sunX(P, o) {   // reference-screen x of the dominant light (sun by day, moon by night)
  const H = P.H, a = arcPos(H, o, P.elev < -0.05);
  return a.x;
}

// ------------------------------------------------------------------ dither (kills banding in the big gradients)
const DITH = new WeakMap();
function ditherPattern(g) {
  let p = DITH.get(g);
  if (p) return p;
  const c = cached('dither', () => {
    const cv = mk(128, 128), x = cv.getContext('2d'), im = x.createImageData(128, 128), r = rng(4242);
    for (let i = 0; i < 128 * 128; i++) { const v = r() < 0.5 ? 0 : 255; im.data[i * 4] = v; im.data[i * 4 + 1] = v; im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0); return cv;
  });
  p = g.createPattern(c, 'repeat'); DITH.set(g, p); return p;
}

// ------------------------------------------------------------------ stars + milky way
function starData() {
  return cached('stars', () => {
    const r = rng(777), N = 900, px = 960, py = 1250, tiny = [], mid = [], big = [];
    for (let i = 0; i < N; i++) {
      const x = -380 + r() * 2680, y = -260 + Math.pow(r(), 1.25) * 1060;
      const cls = r(), ang = Math.atan2(y - py, x - px), rad = Math.hypot(x - px, y - py);
      const tone = r(), col = tone < 0.6 ? [255, 255, 255] : tone < 0.82 ? [190, 210, 255] : [255, 226, 190];
      const s = { ang: ang, rad: rad, col: col, ph: r() * TWO_PI, fr: 0.7 + r() * 2.2, sz: 0 };
      if (cls < 0.70) { s.sz = 1.3; tiny.push(s); } else if (cls < 0.93) { s.sz = 1.9 + r() * 0.5; mid.push(s); } else { s.sz = 2.8 + r() * 1.6; big.push(s); }
    }
    return { tiny: tiny, mid: mid, big: big, px: px, py: py };
  });
}
function milkyWay() {
  return cached('milky', () => {
    const cv = mk(1500, 620), c = cv.getContext('2d'), r = rng(31337);
    const curve = (u) => ({ x: 80 + u * 1340, y: 330 + Math.sin(u * 3.1 + 0.5) * 90 - u * 40 });
    for (let i = 0; i < 46; i++) {
      const u = r(), p = curve(u), rr = 90 + r() * 150, k = r();
      const col = k < 0.5 ? '140,160,255' : k < 0.75 ? '210,150,255' : '255,214,170';
      radial(c, p.x + (r() - 0.5) * 120, p.y + (r() - 0.5) * 90, rr, [[0, 'rgba(' + col + ',' + (0.07 + 0.07 * r()) + ')'], [1, 'rgba(' + col + ',0)']]);
    }
    for (let i = 0; i < 20; i++) {          // dust lanes
      const p = curve(r()); radial(c, p.x + (r() - 0.5) * 80, p.y + (r() - 0.5) * 60, 40 + r() * 70, [[0, 'rgba(4,6,24,0.28)'], [1, 'rgba(4,6,24,0)']]);
    }
    for (let i = 0; i < 1500; i++) {         // speckle stars concentrated on the band
      const p = curve(r()), a = r() * TWO_PI, d = Math.pow(r(), 1.6) * 130;
      c.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.6 * r()) + ')'; const s = r() < 0.9 ? 1 : 1.8;
      c.fillRect(p.x + Math.cos(a) * d * 1.5, p.y + Math.sin(a) * d * 0.8, s, s);
    }
    return cv;
  });
}
function milkyBig() {
  return cached('milkyBig', () => { const m = milkyWay(), cv = mk(m.width * 1.55, m.height * 1.55), c = cv.getContext('2d'); c.drawImage(m, 0, 0, cv.width, cv.height); return cv; });
}
function starHalo(ci) {          // pre-rendered halo + flare sprite per star tint
  return cached('halo' + ci, () => {
    const cols = [[255, 255, 255], [190, 210, 255], [255, 226, 190]], col = cols[ci], cv = mk(64, 64), c = cv.getContext('2d');
    radial(c, 32, 32, 30, [[0, rgb(col, 0.5)], [1, rgb(col, 0)]]);
    c.fillStyle = rgb(col, 0.55); c.fillRect(32 - 30, 31.5, 60, 1); c.fillRect(31.5, 32 - 30, 1, 60);
    return cv;
  });
}
const TONE = (c) => c[2] === 255 && c[0] === 255 ? (c[1] === 255 ? 0 : 2) : 1;
function stars(g, H, alpha, o) {
  o = o || {};
  alpha = alpha == null ? pal(H, o).star : alpha;
  if (alpha < 0.01) return;
  const S = starData(), rot = H * 0.0036, t = o.t || 0;
  g.save();
  // milky way
  const mw = milkyBig();
  g.save(); g.translate(S.px, 270); g.rotate(-0.38 + rot);
  g.globalAlpha = alpha * 0.9; g.drawImage(mw, -750 * 1.55, -310 * 1.55); g.restore();
  g.globalAlpha = 1;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const pos = (s) => { const a = s.ang + rot; return [S.px + s.rad * Math.cos(a), S.py + s.rad * Math.sin(a)]; };
  // tiny
  g.fillStyle = 'rgba(255,255,255,' + (alpha * 0.72) + ')'; g.beginPath();
  for (const s of S.tiny) { const q = pos(s); if (q[0] < -5 || q[0] > 1925 || q[1] < -5 || q[1] > 800) continue; g.rect(q[0], q[1], s.sz, s.sz); }
  g.fill();
  // mid (twinkle)
  {
    const B = [[], [], [], []];
    for (const s of S.mid) {
      const q = pos(s); if (q[0] < -5 || q[0] > 1925 || q[1] < -5 || q[1] > 800) continue;
      const tw = 0.7 + 0.3 * Math.sin(t * s.fr + s.ph), b = Math.max(0, Math.min(3, Math.floor((tw - 0.4) / 0.6 * 4)));
      B[b].push(q[0] - s.sz / 2, q[1] - s.sz / 2, s.sz);
    }
    for (let b = 0; b < 4; b++) { if (!B[b].length) continue; g.fillStyle = 'rgba(232,238,255,' + (alpha * (0.4 + 0.6 * (b + 0.5) / 4) * 0.9).toFixed(3) + ')'; g.beginPath(); for (let i = 0; i < B[b].length; i += 3) g.rect(B[b][i], B[b][i + 1], B[b][i + 2], B[b][i + 2]); g.fill(); }
  }
  // big with halo + flare
  for (const s of S.big) {
    const q = pos(s); if (q[0] < -20 || q[0] > 1940 || q[1] < -20 || q[1] > 800) continue;
    const tw = 0.75 + 0.25 * Math.sin(t * s.fr + s.ph), a = alpha * tw;
    const hs = s.sz * 6.4; g.globalAlpha = Math.min(1, a); g.drawImage(starHalo(TONE(s.col)), q[0] - hs / 2, q[1] - hs / 2, hs, hs); g.globalAlpha = 1;
    g.fillStyle = rgb([255, 255, 255], a); g.beginPath(); g.arc(q[0], q[1], s.sz * 0.6, 0, TWO_PI); g.fill();
  }
  // shooting star
  if (alpha > 0.5) {
    const per = 6.5, idx = Math.floor(t / per), ph = (t - idx * per) / 0.75;
    if (ph >= 0 && ph <= 1 && hash1(idx * 7 + 3) > 0.4) {
      const sx = 260 + hash1(idx * 11 + 1) * 1300, sy = 50 + hash1(idx * 13 + 2) * 230, ang = 0.42 + hash1(idx * 5 + 9) * 0.3;
      const dx = Math.cos(ang), dy = Math.sin(ang), hx_ = sx + dx * ph * 520, hy_ = sy + dy * ph * 520, a = Math.sin(ph * Math.PI) * alpha;
      const gr = g.createLinearGradient(hx_ - dx * 200, hy_ - dy * 200, hx_, hy_);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,' + a + ')');
      g.strokeStyle = gr; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx_ - dx * 200, hy_ - dy * 200); g.lineTo(hx_, hy_); g.stroke();
    }
  }
  g.restore();
}

// ------------------------------------------------------------------ clouds
function cloudSprite(i) {
  return cached('cloud' + i, () => {
    const cv = mk(640, 280), c = cv.getContext('2d'), r = rng(900 + i * 37);
    const base = 214, n = 6 + ((r() * 3) | 0);
    c.fillStyle = '#fff';
    const puffs = [];
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n, cx = 90 + u * 460 + (r() - 0.5) * 30;
      const rr = (46 + 70 * Math.sin(u * Math.PI) * (0.65 + 0.5 * r())) * (0.9 + 0.2 * r());
      puffs.push([cx, base - rr * 0.78 + (r() - 0.5) * 8, rr]);
    }
    for (const q of puffs) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, TWO_PI); c.fill(); }
    c.fillRect(100, base - 36, 440, 38);
    // flat-ish soft bottom
    c.globalCompositeOperation = 'destination-out';
    const gb = c.createLinearGradient(0, base - 6, 0, base + 18); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = gb; c.fillRect(0, base - 6, 640, 280);
    // shading (underside blue-grey + lit top)
    c.globalCompositeOperation = 'source-atop';
    const gs = c.createLinearGradient(0, base - 150, 0, base + 4);
    gs.addColorStop(0, 'rgba(255,255,255,0)'); gs.addColorStop(0.5, 'rgba(170,190,225,0.28)'); gs.addColorStop(1, 'rgba(110,130,185,0.62)');
    c.fillStyle = gs; c.fillRect(0, 0, 640, 280);
    for (const q of puffs) {                 // bright rounded tops
      const gr = c.createRadialGradient(q[0] - q[2] * 0.25, q[1] - q[2] * 0.4, 2, q[0] - q[2] * 0.25, q[1] - q[2] * 0.4, q[2] * 0.85);
      gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(q[0], q[1], q[2], 0, TWO_PI); c.fill();
    }
    return cv;
  });
}
function cloudList() {
  return cached('cloudlist', () => {
    const r = rng(2024), out = [];
    for (let i = 0; i < 16; i++) out.push({ x0: r() * 3300, y: 60 + r() * 400, s: 0.5 + r() * 0.95, v: 4 + r() * 11, v2: (r() * 4) | 0 });
    return out;
  });
}
// Tinted cloud sprites are baked per whole-hour key (lit multiply + sun-side glow are camera independent) and cross-faded between neighbouring keys.
const CLB = new Map();
function cloudBaked(i, Hk, hq) {
  const key = i + '|' + Hk + '|' + hq;
  let c = CLB.get(key);
  if (c) { CLB.delete(key); CLB.set(key, c); return c; }
  if (CLB.size >= 40) CLB.delete(CLB.keys().next().value);
  const sp = cloudSprite(i), Pk = pal(Hk, { heat: hq }), w = sp.width, h = sp.height;
  c = mk(w, h); const x = c.getContext('2d');
  x.drawImage(sp, 0, 0);
  const cl = Pk._.lit.map(v => Math.min(1, Math.pow(v, 0.55)) * 255);
  x.globalCompositeOperation = 'multiply'; x.fillStyle = rgb(cl); x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(sp, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  if (Pk.gold > 0.02) {                                           // sun-side glow
    const left = arcPos(Hk, {}, false).x < 960, gr = x.createLinearGradient(left ? 0 : w, 0, left ? w : 0, 0);
    gr.addColorStop(0, rgb(Pk._.sun, 0.8 * Pk.gold)); gr.addColorStop(0.55, rgb(Pk._.light, 0.3 * Pk.gold)); gr.addColorStop(1, rgb(Pk._.light, 0));
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
  }
  if (hq > 0.01) { x.fillStyle = 'rgba(255,250,235,' + hq * 0.25 + ')'; x.fillRect(0, 0, w, h); }
  CLB.set(key, c);
  return c;
}
function drawClouds(g, cam, H, o, P, sunPos) {
  const cloud = o.cloud == null ? 0.4 : sat01(o.cloud);
  const n = Math.round((1 + 14 * cloud) * (1 - 0.85 * (o.heat || 0)));
  if (n < 1) return;
  const t = o.t || 0, zs = zsOf(cam, 0.05), L = cloudList();
  const Hq = ((H % 100) + 100) % 100, i0 = Math.floor(Hq), f = Hq - i0, hq = Math.round(sat01(o.heat || 0) * 10) / 10;
  g.save(); skyTransform(g, cam);
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1 && f <= 0.015) break;
    const Hk = pass ? (i0 + 1) % 100 : i0;
    g.globalAlpha = 0.93 * (pass ? f : 1);
    for (let i = 0; i < n; i++) {
      const c = L[i], x = ((c.x0 + t * c.v) % 3300) - 650, w = 640 * c.s, h = 280 * c.s;
      g.drawImage(cloudBaked(i % 4, Hk, hq), x, c.y - h * 0.5, w, h);
    }
  }
  g.restore();
}

// ------------------------------------------------------------------ light shafts
function rays(g, x, y, k, t) {
  k = sat01(k == null ? 1 : k);
  if (k < 0.01) return;
  t = t || 0;
  g.save(); g.globalCompositeOperation = 'lighter';
  const R = 1900, n = 16;
  for (let grp = 0; grp < 2; grp++) {
    const gr = g.createRadialGradient(x, y, 30, x, y, R);
    const a = 0.16 * k * (0.75 + 0.25 * Math.sin(t * 1.1 + grp * 2.1));
    gr.addColorStop(0, 'rgba(255,238,200,' + a + ')'); gr.addColorStop(0.5, 'rgba(255,224,170,' + a * 0.4 + ')'); gr.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = gr; g.beginPath();
    for (let i = grp; i < n; i += 2) {
      const ang = i * TWO_PI / n + 0.35 * Math.sin(t * 0.12 + i * 1.7) + t * 0.01, w = 0.045 + 0.04 * hash1(i * 5 + 1);
      g.moveTo(x, y); g.lineTo(x + R * Math.cos(ang - w), y + R * Math.sin(ang - w)); g.lineTo(x + R * Math.cos(ang + w), y + R * Math.sin(ang + w)); g.closePath();
    }
    g.fill();
  }
  g.restore();
}

// ------------------------------------------------------------------ sky (gradient + glows + sun + moon + stars + clouds)
function drawSky(g, cam, H, o, P) {
  const hy = HORY[o.scene || 'city'] || 610, s = arcPos(H, o, false), m = arcPos(H, o, true), t = o.t || 0;
  g.save(); skyTransform(g, cam);
  let gr = g.createLinearGradient(0, -300, 0, hy + 70);
  gr.addColorStop(0, P.skyTop); gr.addColorStop(0.5, P.skyMid); gr.addColorStop(0.9, P.skyHor); gr.addColorStop(1, P.skyHor);
  g.fillStyle = gr; g.fillRect(-1700, -1500, 5320, hy + 70 + 1500 + 900);
  g.fillStyle = ditherPattern(g); g.globalAlpha = 0.035; g.fillRect(-1700, -1500, 5320, 3600); g.globalAlpha = 1;
  // stars + milky way (in sky space: their own anchor)
  if (P.star > 0.01) stars(g, H, P.star, o);
  // horizon glow around the sun
  const e = s.e, sunVis = smooth(sat01((e + 0.2) / 0.22)), low = 1 - sat01(e / 0.5);
  if (sunVis > 0.01) {
    const aG = 0.62 * sunVis * (0.3 + 0.7 * low);
    g.save(); g.translate(s.x, s.y); g.scale(2.7, 1);
    radial(g, 0, 0, 560, [[0, rgb(P._.sun, aG)], [0.3, rgb(P._.sun, aG * 0.5)], [0.7, rgb(P._.light, aG * 0.14)], [1, rgb(P._.sun, 0)]]);
    g.restore();
    // horizon band glow (wide, low)
    const bandA = 0.5 * sunVis * low * (0.4 + 0.6 * P.gold);
    const gb = g.createLinearGradient(0, hy - 330, 0, hy + 40);
    gb.addColorStop(0, rgb(P._.hor, 0)); gb.addColorStop(1, rgb(P._.sun, bandA));
    g.fillStyle = gb; g.fillRect(-1700, hy - 330, 5320, 380);
    // bloom
    const bl = (0.28 + 0.4 * (o.heat || 0)) * sunVis * (1 - low * 0.6);
    radial(g, s.x, s.y, 380, [[0, 'rgba(255,255,255,' + bl + ')'], [1, 'rgba(255,255,255,0)']]);
  }
  // opposite-side twilight belt (pink band) at dusk/dawn
  const twi = P.gold * (1 - sat01(P.elev / 0.25));
  if (twi > 0.02) {
    const ox = 960 + (960 - s.x) * 0.85;
    g.save(); g.translate(ox, hy - 60); g.scale(3.2, 1);
    radial(g, 0, 0, 300, [[0, 'rgba(255,150,190,' + 0.22 * twi + ')'], [1, 'rgba(255,150,190,0)']]);
    g.restore();
  }
  g.restore();
  drawClouds(g, cam, H, o, P, skyMap(cam, s.x, s.y));
  g.save(); skyTransform(g, cam);
  // sun disc
  if (e > -0.14) {
    const r = sunRadius(e), a = smooth(sat01((e + 0.14) / 0.14));
    g.globalAlpha = a;
    radial(g, s.x, s.y, r * 3.4, [[0, rgb(P._.sun, 0.55)], [0.4, rgb(P._.sun, 0.18)], [1, rgb(P._.sun, 0)]]);
    g.fillStyle = rgb(P._.sun); g.beginPath(); g.arc(s.x, s.y, r, 0, TWO_PI); g.fill();
    g.fillStyle = rgb(mixc(P._.sun, [255, 255, 255], 0.55), 0.85); g.beginPath(); g.arc(s.x - r * 0.06, s.y - r * 0.06, r * 0.74, 0, TWO_PI); g.fill();
    g.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.5 * (1 - low)) + ')'; g.beginPath(); g.arc(s.x - r * 0.1, s.y - r * 0.1, r * 0.46, 0, TWO_PI); g.fill();
    g.globalAlpha = 1;
  }
  // moon
  if (m.e > -0.12 && P.night > 0.02) {
    const ma = smooth(sat01((m.e + 0.12) / 0.14)) * smooth(sat01(P.night * 1.6));
    const r = 48;
    g.globalAlpha = ma;
    radial(g, m.x, m.y, r * 5.2, [[0, 'rgba(190,210,255,0.34)'], [0.35, 'rgba(160,190,255,0.12)'], [1, 'rgba(160,190,255,0)']]);
    g.fillStyle = '#f3f0e0'; g.beginPath(); g.arc(m.x, m.y, r, 0, TWO_PI); g.fill();
    g.save(); g.beginPath(); g.arc(m.x, m.y, r, 0, TWO_PI); g.clip();
    g.fillStyle = 'rgba(176,176,160,0.45)';
    const cr = [[-14, -12, 12], [12, 6, 16], [-6, 20, 8], [20, -16, 7], [-24, 8, 6], [4, -26, 6]];
    for (const c of cr) { g.beginPath(); g.arc(m.x + c[0], m.y + c[1], c[2], 0, TWO_PI); g.fill(); }
    const gm = g.createLinearGradient(m.x - r, m.y, m.x + r, m.y);   // soft terminator shading on the far side
    gm.addColorStop(0, 'rgba(60,70,120,0)'); gm.addColorStop(0.62, 'rgba(60,70,120,0)'); gm.addColorStop(1, 'rgba(60,70,120,0.4)');
    g.fillStyle = gm; g.fillRect(m.x - r, m.y - r, r * 2, r * 2);
    g.restore();
    g.globalAlpha = 1;
  }
  g.restore();
  return s;
}

// ------------------------------------------------------------------ shared scene helpers
function withP(g, cam, p, fn) {
  const zs = zsOf(cam, p);
  g.save(); g.translate(W / 2, HT / 2); g.scale(zs, zs); g.translate(-cam.x * p, -(540 + (cam.y - 540) * p));
  fn(zs); g.restore();
}
function visRange(cam, p, margin) {
  const zs = zsOf(cam, p), cx = cam.x * p, half = (W / 2 + 200) / zs + (margin || 60);
  return [cx - half, cx + half];
}
const pick = (a, r) => a[(r() * a.length) | 0];
const SCENES = {};

// speckle texture patterns (cached canvas, one pattern per ctx)
const PATS = new WeakMap();
function pattern(g, key, w, h, painter) {
  let m = PATS.get(g); if (!m) { m = {}; PATS.set(g, m); }
  if (m[key]) return m[key];
  const cv = cached('pat_' + key, () => { const c = mk(w, h), x = c.getContext('2d'); painter(x, w, h, rng(w * 31 + h)); return c; });
  return (m[key] = g.createPattern(cv, 'repeat'));
}

// ------------------------------------------------------------------ CITY: building painter
const WALLS_NEAR = ['#dfe8f0', '#cfdcc8', '#ece4d0', '#d2dde8', '#e6dccb', '#c4d6dc', '#dcd4e8', '#efe9da'];
const WALLS_MID = ['#f0d4a8', '#e0b898', '#b8d0e4', '#f2e2b8', '#c0d8b8', '#e8c8cc', '#a8c8cc', '#d4c4e8', '#f0c080', '#cfd8e0'];
const WALLS_FAR = ['#aeb9d4', '#b9b3cf', '#a9c0d8', '#c0b8c8', '#b2c4d4'];
const AWN = ['#3aa0a0', '#e8b030', '#3b5aa0', '#f4f0e6', '#6aa05a', '#8a5aa8'];
const LITC = ['#ffd68a', '#ffc266', '#ffab55', '#ffe3b0', '#ffcf70', '#fff0c8', '#bfe0ff'].map(hx);
const GLASS_TOP = '#a9cfee', GLASS_BOT = '#5f8fc0';

function rimBox(X, x, top, w, base) {
  const ew = Math.min(52, w * 0.45);
  let gr = X.l.createLinearGradient(x, 0, x + ew, 0); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  X.l.fillStyle = gr; X.l.fillRect(x, top, ew, base - top);
  X.l.fillStyle = 'rgba(255,255,255,0.95)'; X.l.fillRect(x, top - 7, 3.4, base - top + 7);
  X.l.fillStyle = 'rgba(255,255,255,0.8)'; X.l.fillRect(x - 3, top - 8, w + 6, 3.2);
  gr = X.r.createLinearGradient(x + w, 0, x + w - ew, 0); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  X.r.fillStyle = gr; X.r.fillRect(x + w - ew, top, ew, base - top);
  X.r.fillStyle = 'rgba(255,255,255,0.95)'; X.r.fillRect(x + w - 3.4, top - 7, 3.4, base - top + 7);
  X.r.fillStyle = 'rgba(255,255,255,0.8)'; X.r.fillRect(x - 3, top - 8, w + 6, 3.2);
}

function bldgWindows(X, r, x, yTop, w, yBot, S, wall) {
  const c = X.b, cw = S.cw, fh = S.fh;
  const cols = Math.max(1, Math.floor((w - 18) / cw)), rows = Math.max(1, Math.floor((yBot - yTop - 6) / fh));
  const ox = x + (w - cols * cw) / 2, oy = yTop + ((yBot - yTop) - rows * fh) / 2 + 2;
  const sty = r(), tone = rgb(mixc(wall, [30, 40, 70], 0.18)), sill = rgb(mixc(wall, [255, 255, 255], 0.5));
  const rowDark = [];
  for (let j = 0; j < rows; j++) rowDark.push(r() < 0.15 ? 0.2 : 1);
  if (sty > 0.62 && S.ribbon) {                        // continuous ribbon windows
    for (let j = 0; j < rows; j++) {
      const wy = oy + j * fh + fh * 0.2, wh = fh * 0.56, wx = x + 7, ww = w - 14;
      c.fillStyle = GLASS_BOT; c.fillRect(wx, wy, ww, wh);
      c.fillStyle = 'rgba(255,255,255,0.32)'; c.fillRect(wx, wy, ww, wh * 0.45);
      c.fillStyle = 'rgba(255,255,255,0.28)'; for (let k = 1; k < cols * 2; k++) c.fillRect(wx + k * ww / (cols * 2) - 0.7, wy, 1.4, wh);
      c.fillStyle = sill; c.fillRect(wx - 2, wy + wh, ww + 4, 3);
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(wx, wy, ww, 2.5);
      if (X.w1) {
        const n = cols * 2;
        for (let k = 0; k < n; k++) {
          if (r() > S.litP * rowDark[j]) continue;
          const col = pick(LITC, r), cx = wx + k * ww / n, cwid = ww / n - 1.2, ctx = r() < 0.55 ? X.w1 : (X.w2 || X.w1);
          ctx.fillStyle = rgb(col, 0.14); ctx.fillRect(cx - 3, wy - 3, cwid + 6, wh + 6);
          ctx.fillStyle = rgb(col, 0.92); ctx.fillRect(cx, wy, cwid, wh);
        }
      }
    }
    return;
  }
  const ww = cw * S.ww, wh = fh * S.wh, arch = sty < 0.22;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (r() < 0.04) continue;
      const wx = ox + i * cw + (cw - ww) / 2, wy = oy + j * fh + (fh - wh) / 2;
      const gr = c.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, GLASS_TOP); gr.addColorStop(1, GLASS_BOT);
      c.fillStyle = tone; c.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      c.fillStyle = gr;
      if (arch) { c.beginPath(); c.moveTo(wx, wy + wh); c.lineTo(wx, wy + ww / 2); c.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); c.lineTo(wx + ww, wy + wh); c.closePath(); c.fill(); }
      else c.fillRect(wx, wy, ww, wh);
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.moveTo(wx + ww * 0.15, wy + wh); c.lineTo(wx + ww * 0.55, wy + wh); c.lineTo(wx + ww * 0.85, wy + (arch ? ww * 0.5 : 0)); c.lineTo(wx + ww * 0.55, wy + (arch ? ww * 0.5 : 0)); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(wx + ww / 2 - 0.7, wy + (arch ? ww / 2 : 0), 1.4, wh - (arch ? ww / 2 : 0));
      c.fillStyle = sill; c.fillRect(wx - 3, wy + wh + 1, ww + 6, 3.2);
      c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(wx - 2, wy + wh + 4, ww + 4, 2);
      if (r() < 0.2) {                                   // curtain / blind
        c.fillStyle = 'rgba(255,240,215,0.75)'; c.fillRect(wx, wy, ww * (0.25 + 0.2 * r()), wh * (0.5 + 0.3 * r()));
      }
      if (X.w1 && r() < S.litP * rowDark[j] * (0.75 + 0.5 * (1 - j / Math.max(1, rows - 1)) * 0)) {
        const col = pick(LITC, r), ctx = r() < 0.55 ? X.w1 : (X.w2 || X.w1);
        ctx.fillStyle = rgb(col, 0.14); ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
        ctx.fillStyle = rgb(col, 0.95);
        if (arch) { ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx, wy + ww / 2); ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(wx + ww, wy + wh); ctx.closePath(); ctx.fill(); }
        else ctx.fillRect(wx, wy, ww, wh);
        if (r() < 0.45) { ctx.fillStyle = 'rgba(120,60,30,0.55)'; ctx.fillRect(wx + ww * 0.45, wy, 1.6, wh); ctx.fillRect(wx, wy + wh * 0.5, ww, 1.4); }
        if (r() < 0.25) { ctx.fillStyle = 'rgba(70,30,20,0.5)'; ctx.beginPath(); ctx.arc(wx + ww * 0.4, wy + wh * 0.62, ww * 0.16, 0, TWO_PI); ctx.fill(); ctx.fillRect(wx + ww * 0.3, wy + wh * 0.7, ww * 0.2, wh * 0.3); }
      }
    }
  }
}

function roofProps(X, r, x, top, w, wall) {
  const c = X.b, k = r();
  const dark = rgb(mixc(wall, [30, 36, 60], 0.45)), mid = rgb(mixc(wall, [40, 50, 90], 0.22));
  if (k < 0.26) {                                          // water tank
    const px = x + 10 + r() * (w - 56), tw = 26 + r() * 8, th = 28;
    c.fillStyle = dark; c.fillRect(px + 3, top - 10, 2.4, 10); c.fillRect(px + tw - 5, top - 10, 2.4, 10);
    c.fillStyle = rgb(mixc(wall, [120, 90, 70], 0.55)); c.fillRect(px, top - 10 - th, tw, th);
    c.beginPath(); c.moveTo(px - 2, top - 10 - th); c.lineTo(px + tw / 2, top - 10 - th - 14); c.lineTo(px + tw + 2, top - 10 - th); c.closePath(); c.fillStyle = dark; c.fill();
    c.fillStyle = 'rgba(0,0,0,0.2)'; for (let q = 1; q < 3; q++) c.fillRect(px, top - 10 - th + q * th / 3, tw, 1.5);
    X.l.fillStyle = 'rgba(255,255,255,0.9)'; X.l.fillRect(px, top - 10 - th, 3, th); X.r.fillStyle = 'rgba(255,255,255,0.9)'; X.r.fillRect(px + tw - 3, top - 10 - th, 3, th);
  } else if (k < 0.5) {                                    // antenna
    const px = x + 12 + r() * (w - 24), hh = 36 + r() * 60;
    c.fillStyle = dark; c.fillRect(px, top - hh, 2.4, hh);
    c.fillRect(px - 8, top - hh * 0.82, 18, 2.2); c.fillRect(px - 5, top - hh * 0.58, 12, 2.2);
    c.fillStyle = '#ff4a5a'; c.fillRect(px - 1, top - hh - 3, 4.6, 4.6);
    if (X.w1) { radial(X.w1, px + 1.3, top - hh - 0.7, 11, [[0, 'rgba(255,60,80,0.9)'], [1, 'rgba(255,60,80,0)']]); }
    X.l.fillStyle = 'rgba(255,255,255,0.9)'; X.l.fillRect(px, top - hh, 1.3, hh);
  } else if (k < 0.7) {                                    // AC units
    const px = x + 8 + r() * (w - 56);
    for (let q = 0; q < 2; q++) {
      c.fillStyle = rgb(mixc(wall, [200, 205, 215], 0.6)); c.fillRect(px + q * 27, top - 14, 24, 14);
      c.fillStyle = dark; c.beginPath(); c.arc(px + q * 27 + 12, top - 7, 4.6, 0, TWO_PI); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(px + q * 27, top - 14, 24, 2);
    }
  } else if (k < 0.84 && w > 90) {                         // gable roof
    const hgt = Math.min(64, w * 0.3), col = pick(['#b86a54', '#8a8fa8', '#7a9a8a', '#a8785a'], r);
    c.fillStyle = col; c.beginPath(); c.moveTo(x - 6, top); c.lineTo(x + w / 2, top - hgt); c.lineTo(x + w + 6, top); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.moveTo(x + w / 2, top - hgt); c.lineTo(x + w + 6, top); c.lineTo(x + w / 2, top); c.closePath(); c.fill();
    c.fillStyle = rgb(mixc(hx(col), [90, 70, 70], 0.4)); c.fillRect(x + w * 0.72, top - hgt * 0.7, 10, hgt * 0.5);
    X.l.fillStyle = 'rgba(255,255,255,0.7)'; X.l.beginPath(); X.l.moveTo(x - 6, top); X.l.lineTo(x + w / 2, top - hgt); X.l.lineTo(x + w / 2, top - hgt + 5); X.l.lineTo(x - 2, top); X.l.closePath(); X.l.fill();
    X.r.fillStyle = 'rgba(255,255,255,0.7)'; X.r.beginPath(); X.r.moveTo(x + w + 6, top); X.r.lineTo(x + w / 2, top - hgt); X.r.lineTo(x + w / 2, top - hgt + 5); X.r.lineTo(x + w + 2, top); X.r.closePath(); X.r.fill();
  } else {                                                 // penthouse block
    const pw = Math.min(w * 0.5, 70), px = x + (w - pw) / 2 + (r() - 0.5) * 10, ph = 30;
    c.fillStyle = rgb(mixc(wall, [255, 255, 255], 0.18)); c.fillRect(px, top - ph, pw, ph);
    c.fillStyle = rgb(mixc(wall, [255, 255, 255], 0.45)); c.fillRect(px - 2, top - ph - 4, pw + 4, 4);
    c.fillStyle = GLASS_BOT; c.fillRect(px + 7, top - ph + 8, pw - 14, 12);
    X.l.fillStyle = 'rgba(255,255,255,0.9)'; X.l.fillRect(px, top - ph - 4, 3, ph + 4); X.r.fillStyle = 'rgba(255,255,255,0.9)'; X.r.fillRect(px + pw - 3, top - ph - 4, 3, ph + 4);
  }
}

function shopFront(X, r, x, base, w, gf, S, wall) {
  const c = X.b, top = base - gf;
  c.fillStyle = rgb(mixc(wall, [20, 30, 50], 0.5)); c.fillRect(x, top, w, gf);               // storefront recess
  const n = Math.max(1, Math.floor(w / 86)), seg = w / n;
  for (let i = 0; i < n; i++) {
    const sx = x + i * seg + 6, sw = seg - 12, door = r() < 0.3;
    const awn = hx(pick(AWN, r));
    c.fillStyle = '#34566e'; c.fillRect(sx, top + 18, sw, gf - 18);
    const gr = c.createLinearGradient(0, top + 18, 0, base); gr.addColorStop(0, '#7fb0d6'); gr.addColorStop(1, '#3d6a8c'); c.fillStyle = gr; c.fillRect(sx + 3, top + 21, sw - 6, gf - 24);
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.moveTo(sx + 8, base); c.lineTo(sx + 30, base); c.lineTo(sx + sw * 0.6, top + 21); c.lineTo(sx + sw * 0.4, top + 21); c.closePath(); c.fill();
    if (door) { c.fillStyle = rgb(mixc(awn, [40, 40, 50], 0.45)); c.fillRect(sx + sw * 0.62, top + 24, sw * 0.28, gf - 24); c.fillStyle = '#e8d8a0'; c.fillRect(sx + sw * 0.66, top + gf * 0.58, 2.5, 8); }
    // awning: striped trapezoid
    const ay = top + 4, ah = 16;
    for (let s = 0; s < 6; s++) {
      c.fillStyle = s % 2 ? rgb(awn) : rgb(mixc(awn, [255, 255, 255], 0.75));
      c.beginPath(); c.moveTo(sx - 3 + s * (sw + 6) / 6, ay); c.lineTo(sx - 3 + (s + 1) * (sw + 6) / 6, ay); c.lineTo(sx - 6 + (s + 1) * (sw + 12) / 6, ay + ah); c.lineTo(sx - 6 + s * (sw + 12) / 6, ay + ah); c.closePath(); c.fill();
    }
    c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(sx - 6, ay + ah, sw + 12, 3);
    X.l.fillStyle = 'rgba(255,255,255,0.6)'; X.l.fillRect(sx - 6, ay + ah - 2, sw + 12, 2.2); X.r.fillStyle = 'rgba(255,255,255,0.6)'; X.r.fillRect(sx - 6, ay + ah - 2, sw + 12, 2.2);
    if (X.w1 && r() < Math.min(0.9, S.litP * 2.2)) {                    // shop interior glow
      const col = pick(LITC, r), ctx = X.w1;
      ctx.fillStyle = rgb(col, 0.16); ctx.fillRect(sx - 3, top + 16, sw + 6, gf - 12);
      ctx.fillStyle = rgb(col, 0.88); ctx.fillRect(sx + 3, top + 21, sw - 6, gf - 24);
      ctx.fillStyle = 'rgba(120,70,30,0.5)'; ctx.fillRect(sx + 6, base - 22, sw - 12, 4);
    }
  }
  c.fillStyle = rgb(mixc(wall, [255, 255, 255], 0.35)); c.fillRect(x, top - 4, w, 5);                  // cornice above shops
}

function bldg(X, r, x, top, w, base, S) {
  const c = X.b, wall = hx(pick(S.walls, r));
  let gr = c.createLinearGradient(0, top, 0, base);
  gr.addColorStop(0, rgb(mixc(wall, [255, 255, 255], 0.14))); gr.addColorStop(1, rgb(mixc(wall, [60, 70, 110], 0.14)));
  c.fillStyle = gr; c.fillRect(x, top, w, base - top);
  c.fillStyle = 'rgba(30,40,80,0.07)'; c.fillRect(x + w - 7, top, 7, base - top);              // soft side-wall tone
  c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, top, 7, base - top);
  const gf = S.shop ? S.gf : 0;
  // cornice + parapet
  c.fillStyle = rgb(mixc(wall, [255, 255, 255], 0.4)); c.fillRect(x - 4, top - 8, w + 8, 8);
  c.fillStyle = 'rgba(30,40,80,0.28)'; c.fillRect(x - 4, top, w + 8, 3);
  // floor ledges
  const fy0 = top + 6;
  for (let y = fy0 + S.fh; y < base - gf - 6; y += S.fh) {
    c.fillStyle = 'rgba(30,40,80,0.10)'; c.fillRect(x, y - 2, w, 3);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x, y + 1, w, 2);
  }
  if (r() < 0.5) { c.fillStyle = rgb(mixc(wall, [255, 255, 255], 0.3)); c.fillRect(x, top, 6, base - top); c.fillRect(x + w - 6, top, 6, base - top); }
  bldgWindows(X, r, x, top + 8, w, base - gf - 4, S, wall);
  if (S.shop) shopFront(X, r, x, base, w, gf, S, wall);
  if (S.rim) rimBox(X, x, top, w, base);
  roofProps(X, r, x, top - 8, w, wall);
  // separating shadow between neighbours
  c.fillStyle = 'rgba(20,24,50,0.22)'; c.fillRect(x - 1.5, top, 2, base - top);
}

// skyline layout helper: returns [{x,w,h}] filling [0,tw] exactly; heights are damped near the sun-rise / sun-set valleys
function skylineRow(r, tw, wMin, wMax, hMin, hMax, gaps, gapW, gapMin) {
  const out = []; let x = 0;
  while (x < tw - 1) {
    let w = wMin + r() * (wMax - wMin);
    if (tw - (x + w) < wMin * 0.75) w = tw - x;
    const cx = x + w / 2;
    let h = hMin + Math.pow(r(), 1.5) * (hMax - hMin), m = 1;
    for (const gp of gaps) {
      let d = Math.abs(cx - gp); d = Math.min(d, tw - d);
      m = Math.min(m, gapMin + (1 - gapMin) * smooth(d / gapW));
    }
    out.push({ x: x, w: w, h: Math.max(60, h * m) });
    x += w;
  }
  return out;
}

const CITY = {
  far: { p: 0.18, base: 713, tw: 2000, y0: -120, y1: 800, sc: 1 },
  mid: { p: 0.42, base: 730, tw: 2300, y0: 10, y1: 880, sc: 1 },
  near: { p: 0.72, base: 752, tw: 2100, y0: 150, y1: 880, sc: 1.2 }
};
function cityTiles() {
  return cached('city', () => {
    const gapC = (p, sx) => 900 * p - 960 + sx;               // layer-world x of a screen x at the reference camera
    const mkGaps = (cfg) => [gapC(cfg.p, 150), gapC(cfg.p, 1780)].map(v => ((v % cfg.tw) + cfg.tw) % cfg.tw);
    const far = makeTile({
      tw: CITY.far.tw, y0: CITY.far.y0, y1: CITY.far.y1, sc: CITY.far.sc, edges: true, win: 1,
      paint(X, r) {
        const base = CITY.far.base, c = X.b;
        const S = { walls: WALLS_FAR, cw: 16, fh: 22, ww: 0.5, wh: 0.5, litP: 0.5, ribbon: false, shop: false, rim: true };
        for (const b of skylineRow(r, CITY.far.tw, 46, 96, 190, 640, mkGaps(CITY.far), 300, 0.16)) {
          const top = base - b.h, wall = hx(pick(WALLS_FAR, r));
          let gr = c.createLinearGradient(0, top, 0, base + 100); gr.addColorStop(0, rgb(mixc(wall, [255, 255, 255], 0.2))); gr.addColorStop(1, rgb(wall));
          c.fillStyle = gr; c.fillRect(b.x, top, b.w, base + 110 - top);
          c.fillStyle = rgb(mixc(wall, [255, 255, 255], 0.35)); c.fillRect(b.x - 2, top - 5, b.w + 4, 5);
          // sparse window dots
          const cols = Math.floor((b.w - 10) / S.cw), rows = Math.floor((b.h - 14) / S.fh), ox = b.x + (b.w - cols * S.cw) / 2;
          for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
            const wx = ox + i * S.cw + 3, wy = top + 10 + j * S.fh + 4;
            c.fillStyle = 'rgba(70,100,150,0.34)'; c.fillRect(wx, wy, 8, 10);
            if (r() < 0.32) { X.w1.fillStyle = rgb(pick(LITC, r), 0.9); X.w1.fillRect(wx, wy, 8, 10); }
          }
          if (r() < 0.3) { c.fillStyle = rgb(mixc(wall, [40, 50, 90], 0.3)); const px = b.x + b.w * (0.3 + r() * 0.4); c.fillRect(px, top - 50 - r() * 30, 2.4, 60); X.w1.fillStyle = 'rgba(255,70,90,0.95)'; X.w1.fillRect(px - 1, top - 54, 4, 4); }
          rimBox(X, b.x, top, b.w, base + 110);
        }
      }
    }, 11);
    const mid = makeTile({
      tw: CITY.mid.tw, y0: CITY.mid.y0, y1: CITY.mid.y1, sc: CITY.mid.sc, edges: true, win: 2,
      paint(X, r) {
        const S = { walls: WALLS_MID, cw: 30, fh: 36, ww: 0.55, wh: 0.58, litP: 0.5, ribbon: true, shop: true, gf: 54, rim: true };
        for (const b of skylineRow(r, CITY.mid.tw, 90, 170, 190, 600, mkGaps(CITY.mid), 320, 0.14)) bldg(X, r, b.x, CITY.mid.base - b.h, b.w, CITY.mid.base + 120, S);
      }
    }, 23);
    const near = makeTile({
      tw: CITY.near.tw, y0: CITY.near.y0, y1: CITY.near.y1, sc: CITY.near.sc, edges: true, win: 2,
      paint(X, r) {
        const S = { walls: WALLS_NEAR, cw: 40, fh: 46, ww: 0.56, wh: 0.6, litP: 0.55, ribbon: false, shop: true, gf: 82, rim: true };
        for (const b of skylineRow(r, CITY.near.tw, 150, 270, 250, 480, mkGaps(CITY.near), 340, 0.2)) bldg(X, r, b.x, CITY.near.base - b.h, b.w, CITY.near.base + 120, S);
      }
    }, 37);
    return { far: far, mid: mid, near: near };
  });
}

// ------------------------------------------------------------------ CITY: ground + street furniture
const CITY_OBJ = [{ k: 'tree', x: 250, s: 1.0 }, { k: 'lamp', x: 610 }, { k: 'bench', x: 1090 }, { k: 'tree', x: 1480, s: 1.1 }, { k: 'lamp', x: 1960 }, { k: 'hydrant', x: 2230 }];
const CITY_PERIOD = 2400;
function eachObj(list, period, x0, x1, fn) {
  const k0 = Math.floor(x0 / period) - 0, k1 = Math.floor(x1 / period);
  for (let k = k0; k <= k1; k++) for (let i = 0; i < list.length; i++) fn(list[i], list[i].x + k * period, k * 7 + i);
}
function lampGlow(g, x, y, on, P) {
  if (on < 0.02) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  radial(g, x, y, 190, [[0, 'rgba(255,200,120,' + 0.5 * on + ')'], [0.35, 'rgba(255,170,80,' + 0.18 * on + ')'], [1, 'rgba(255,150,60,0)']]);
  g.restore();
}
function drawLamp(g, x, base, P, on, scale) {
  const h = 300 * (scale || 1), lit = P._.lit, pc = mulc([52, 58, 76], [Math.min(1.6, lit[0] * 1.5 + 0.15), Math.min(1.6, lit[1] * 1.5 + 0.15), Math.min(1.6, lit[2] * 1.5 + 0.2)]);
  const lightSide = P.elev > -0.05 ? (960 - arcPos(P.H, {}, false).x) : (960 - arcPos(P.H, {}, true).x);
  const sd = lightSide >= 0 ? -1 : 1;                       // x side facing the light
  g.fillStyle = rgb(pc); g.fillRect(x - 3.6, base - h, 7.2, h);
  g.fillRect(x - 11, base - 14, 22, 14); g.fillRect(x - 8, base - 24, 16, 10);
  g.beginPath(); g.moveTo(x - 3.6, base - h); g.quadraticCurveTo(x - 3.6, base - h - 30, x + 34, base - h - 30); g.lineTo(x + 34, base - h - 24); g.quadraticCurveTo(x + 4, base - h - 24, x + 3.6, base - h + 6); g.closePath(); g.fill();
  g.fillStyle = rgb(mixc(pc, [255, 255, 255], 0.25)); g.fillRect(x + (sd > 0 ? 1.2 : -3.6), base - h + 6, 2.4, h - 12);
  g.fillStyle = rgb(mixc(pc, [30, 30, 40], 0.3)); g.beginPath(); g.moveTo(x + 22, base - h - 33); g.lineTo(x + 46, base - h - 33); g.lineTo(x + 50, base - h - 24); g.lineTo(x + 18, base - h - 24); g.closePath(); g.fill();
  g.fillStyle = on > 0.05 ? rgb(mixc([200, 205, 215], [255, 236, 170], on)) : '#cfd6e2'; g.fillRect(x + 22, base - h - 25, 24, 4);
  if (on > 0.02) {
    lampGlow(g, x + 34, base - h - 24, on, P);
    // light cone to the ground
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(0, base - h - 22, 0, base + 10); gr.addColorStop(0, 'rgba(255,214,140,' + 0.2 * on + ')'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x + 26, base - h - 22); g.lineTo(x + 42, base - h - 22); g.lineTo(x + 112, base + 10); g.lineTo(x - 40, base + 10); g.closePath(); g.fill();
    g.restore();
  }
}
function drawTree(g, x, base, s, P, seed) {
  const lit = P._.lit, sh = P._.sh, side = (P.elev > -0.05 ? -1 : 1) * Math.sign(960 - arcPos(P.H, {}, P.elev <= -0.05).x || 1);   // side toward the light (-1 left)
  const leafLit = mulc([112, 176, 78], lit.map(v => v * 1.05)), leafSh = mulc([54, 112, 74], sh.map(v => v * 1.35));
  const trunk = mulc([112, 78, 58], lit);
  const r = rng(seed * 13 + 5), h = 150 * s;
  g.fillStyle = rgb(trunk); g.beginPath(); g.moveTo(x - 8 * s, base); g.lineTo(x - 5 * s, base - h); g.lineTo(x + 5 * s, base - h); g.lineTo(x + 9 * s, base); g.closePath(); g.fill();
  g.fillStyle = rgb(mulc(trunk, [0.7, 0.7, 0.75])); g.beginPath(); g.moveTo(x + 2 * s, base); g.lineTo(x + 2 * s, base - h); g.lineTo(x + 5 * s, base - h); g.lineTo(x + 9 * s, base); g.closePath(); g.fill();
  g.fillStyle = rgb(trunk); g.beginPath(); g.moveTo(x, base - h * 0.55); g.lineTo(x + 40 * s, base - h * 0.95); g.lineTo(x + 36 * s, base - h); g.lineTo(x - 2, base - h * 0.62); g.closePath(); g.fill();
  const cx = x, cy = base - h - 62 * s, blobs = [];
  for (let i = 0; i < 9; i++) { const a = r() * TWO_PI, d = r() * 52 * s; blobs.push([cx + Math.cos(a) * d * 1.15, cy + Math.sin(a) * d * 0.8, (34 + r() * 22) * s]); }
  g.fillStyle = rgb(leafSh); for (const b of blobs) { g.beginPath(); g.arc(b[0], b[1], b[2], 0, TWO_PI); g.fill(); }
  g.fillStyle = rgb(mixc(leafSh, leafLit, 0.55)); for (const b of blobs) { g.beginPath(); g.arc(b[0] + side * 6 * s, b[1] - 6 * s, b[2] * 0.82, 0, TWO_PI); g.fill(); }
  g.fillStyle = rgb(leafLit); for (const b of blobs) { g.beginPath(); g.arc(b[0] + side * 12 * s, b[1] - 12 * s, b[2] * 0.52, 0, TWO_PI); g.fill(); }
  g.fillStyle = rgb(mixc(leafLit, [255, 255, 220], 0.35), 0.8 * P.sunUp); for (let i = 0; i < 6; i++) { const b = blobs[i]; g.beginPath(); g.arc(b[0] + side * 18 * s, b[1] - 18 * s, b[2] * 0.2, 0, TWO_PI); g.fill(); }
  if (P.night > 0.4) {   // dim fairy-lights? no: moonlit leaf rim
    g.fillStyle = rgb(P._.light, 0.12 * P.night); for (const b of blobs) { g.beginPath(); g.arc(b[0] + side * 10 * s, b[1] - 10 * s, b[2] * 0.4, 0, TWO_PI); g.fill(); }
  }
}
function drawBench(g, x, base, P) {
  const lit = P._.lit, wood = mulc([150, 100, 62], lit), metal = mulc([70, 74, 90], [lit[0] * 1.4 + 0.1, lit[1] * 1.4 + 0.1, lit[2] * 1.4 + 0.15]);
  g.fillStyle = rgb(metal); g.fillRect(x - 70, base - 30, 5, 30); g.fillRect(x + 65, base - 30, 5, 30); g.fillRect(x - 74, base - 50, 5, 22); g.fillRect(x + 69, base - 50, 5, 22);
  g.fillStyle = rgb(wood); g.fillRect(x - 82, base - 36, 164, 8); g.fillRect(x - 82, base - 26, 164, 7);
  g.fillStyle = rgb(mulc(wood, [1.1, 1.1, 1.1])); g.fillRect(x - 80, base - 64, 160, 7); g.fillRect(x - 80, base - 54, 160, 7);
  g.fillStyle = 'rgba(255,255,255,' + 0.25 * P.sunUp + ')'; g.fillRect(x - 82, base - 36, 164, 2);
}
function drawHydrant(g, x, base, P) {
  const c = mulc([214, 54, 54], P._.lit);
  g.fillStyle = rgb(c); g.fillRect(x - 9, base - 38, 18, 38); g.beginPath(); g.arc(x, base - 38, 10, Math.PI, 0); g.fill(); g.fillRect(x - 15, base - 28, 30, 8); g.fillRect(x - 12, base - 8, 24, 8);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 7, base - 36, 3, 34);
}
function castShadow(g, x, base, h, w, P, a) {       // simple stretched ground shadow for a pole / trunk-and-canopy object
  const L = P.shx * h; if (P.sunUp < 0.02) return;
  g.save(); g.fillStyle = rgb(mulc([20, 24, 56], [1, 1, 1]), a); g.beginPath();
  g.moveTo(x - w / 2, base); g.lineTo(x + w / 2, base); g.lineTo(x + w / 2 + L, base + h * 0.1); g.lineTo(x - w / 2 + L, base + h * 0.1); g.closePath(); g.fill(); g.restore();
}

function cityGround(g, cam, H, o, P) {
  const lit = P._.lit, walkC = mulc([226, 218, 204], lit), walkF = mulc([206, 198, 186], lit), roadC = mulc([96, 100, 112], lit), roadF = mulc([80, 84, 96], lit);
  const curbT = mulc([240, 234, 222], lit), curbF = mulc([190, 184, 176], lit), sh = P._.sh;
  withP(g, cam, 1, (zs) => {
    const vr = visRange(cam, 1, 300), x0 = vr[0], x1 = vr[1], ww = x1 - x0;
    // sidewalk
    let gr = g.createLinearGradient(0, 756, 0, 848);
    gr.addColorStop(0, rgb(mulc(walkC, [1.04, 1.04, 1.04]))); gr.addColorStop(1, rgb(walkF));
    g.fillStyle = gr; g.fillRect(x0, 756, ww, 92);
    // paving seams + staggered slabs
    g.lineWidth = 1.6;
    g.fillStyle = 'rgba(40,40,60,0.12)'; g.fillRect(x0, 808, ww, 1.6);
    g.fillStyle = 'rgba(255,255,255,' + (0.25 * P.day) + ')'; g.fillRect(x0, 809.6, ww, 1.4);
    const s0 = Math.floor(x0 / 150) * 150;
    for (let x = s0; x < x1; x += 150) {
      g.fillStyle = 'rgba(40,40,60,0.12)'; g.fillRect(x, 770, 1.6, 38); g.fillRect(x + 75, 809, 1.6, 38);
      g.fillStyle = 'rgba(255,255,255,' + (0.22 * P.day) + ')'; g.fillRect(x + 1.6, 770, 1.2, 38); g.fillRect(x + 76.6, 809, 1.2, 38);
    }
    g.save(); g.translate(0, 0); g.globalAlpha = 0.5; g.fillStyle = pattern(g, 'walk', 256, 128, (x, w, h, r) => { for (let i = 0; i < 360; i++) { x.fillStyle = r() < 0.5 ? 'rgba(60,50,70,0.14)' : 'rgba(255,255,255,0.18)'; x.fillRect(r() * w, r() * h, 1 + r() * 2.6, 1 + r() * 1.6); } });
    g.fillRect(x0, 756, ww, 92); g.restore();
    // building shadow falling on the sidewalk (long when the sun is low)
    const reach = 92 * (0.14 + 1.05 * P.gold) * P.sunUp + 92 * 0.55 * P.night;
    if (reach > 4) {
      const gs = g.createLinearGradient(0, 756, 0, 756 + reach);
      const sc = mulc([40, 44, 100], [1, 1, 1]);
      gs.addColorStop(0, rgb(sc, 0.34)); gs.addColorStop(0.82, rgb(sc, 0.22)); gs.addColorStop(1, rgb(sc, 0));
      g.fillStyle = gs; g.fillRect(x0, 756, ww, reach);
    }
    // ambient occlusion where the wall meets the walk
    gr = g.createLinearGradient(0, 756, 0, 782); gr.addColorStop(0, 'rgba(20,20,50,0.28)'); gr.addColorStop(1, 'rgba(20,20,50,0)'); g.fillStyle = gr; g.fillRect(x0, 756, ww, 26);
    // curb
    g.fillStyle = rgb(curbT); g.fillRect(x0, 847, ww, 8); g.fillStyle = rgb(curbF); g.fillRect(x0, 855, ww, 13);
    g.fillStyle = 'rgba(255,255,255,' + (0.35 * P.day) + ')'; g.fillRect(x0, 847, ww, 1.6);
    g.fillStyle = 'rgba(20,20,50,0.2)'; g.fillRect(x0, 868, ww, 4);
    // road
    gr = g.createLinearGradient(0, 868, 0, 1250); gr.addColorStop(0, rgb(roadC)); gr.addColorStop(1, rgb(roadF));
    g.fillStyle = gr; g.fillRect(x0, 868, ww, 400);
    g.save(); g.globalAlpha = 0.55; g.fillStyle = pattern(g, 'asphalt', 512, 256, (x, w, h, r) => { for (let i = 0; i < 900; i++) { x.fillStyle = r() < 0.5 ? 'rgba(20,20,40,0.18)' : 'rgba(255,255,255,0.12)'; x.fillRect(r() * w, r() * h, 1 + r() * 2.4, 1 + r() * 2); } x.strokeStyle = 'rgba(10,10,30,0.2)'; x.lineWidth = 1.4; for (let i = 0; i < 3; i++) { x.beginPath(); let px = r() * w, py = r() * h; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (r() - 0.3) * 40; py += (r() - 0.5) * 20; x.lineTo(px, py); } x.stroke(); } });
    g.fillRect(x0, 868, ww, 400); g.restore();
    // kerb gutter line + lane markings
    g.fillStyle = 'rgba(20,20,40,0.28)'; g.fillRect(x0, 872, ww, 2);
    const dc = mulc([240, 232, 200], lit), lc = mulc([250, 250, 244], lit);
    const sd = Math.floor(x0 / 170) * 170;
    for (let x = sd; x < x1; x += 170) { g.fillStyle = rgb(dc); g.fillRect(x, 941, 96, 5); g.fillStyle = rgb(lc, 0.9); g.fillRect(x + 20, 1034, 100, 6); g.fillRect(x + 20, 884, 70, 3); }
    // manholes
    const mh = Math.floor(x0 / 700) * 700;
    for (let x = mh; x < x1; x += 700) { const mx = x + 300; g.fillStyle = 'rgba(20,20,40,0.34)'; g.beginPath(); g.ellipse(mx, 1000, 38, 9, 0, 0, TWO_PI); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1.5; g.stroke(); }
    // low-sun glare track on the road
    if (P.sunUp > 0.05) {
      const sp = arcPos(P.H, o, false), gx = (sp.x - 960) * 0.95 + cam.x, low = 1 - sat01(sp.e / 0.4);
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(gx, 930); g.scale(3.2, 0.34);
      radial(g, 0, 0, 260, [[0, rgb(P._.sun, 0.28 * low * P.sunUp)], [1, rgb(P._.sun, 0)]]); g.restore();
    }
    // objects on the pavement
    // (cast shadows first)
    const ob = visRange(cam, 1, 140);
    eachObj(CITY_OBJ, CITY_PERIOD, ob[0], ob[1], (it, x) => {
      if (it.k === 'lamp') castShadow(g, x, 800, 300, 6, P, 0.2);
      else if (it.k === 'tree') { castShadow(g, x, 800, 150 * (it.s || 1), 12, P, 0.2); if (P.sunUp > 0.02) { g.save(); g.fillStyle = 'rgba(20,24,56,0.15)'; g.beginPath(); g.ellipse(x + P.shx * 150 * (it.s || 1), 806 + 20, 70, 14, 0, 0, TWO_PI); g.fill(); g.restore(); } }
      else if (it.k === 'bench') { g.save(); g.fillStyle = 'rgba(20,24,56,' + 0.18 * P.sunUp + ')'; g.beginPath(); g.ellipse(x + P.shx * 30, 802, 86 + Math.abs(P.shx) * 30, 7, 0, 0, TWO_PI); g.fill(); g.restore(); }
    });
    const lampOn = smooth(sat01((P.night - 0.04) * 3));
    eachObj(CITY_OBJ, CITY_PERIOD, ob[0], ob[1], (it, x, seed) => {
      if (it.k === 'tree') drawTree(g, x, 800, it.s || 1, P, seed);
      else if (it.k === 'lamp') drawLamp(g, x, 800, P, lampOn, 1);
      else if (it.k === 'bench') drawBench(g, x, 806, P);
      else if (it.k === 'hydrant') drawHydrant(g, x, 808, P);
    });
    // light pools on the walk below the lamps
    if (lampOn > 0.02) eachObj(CITY_OBJ, CITY_PERIOD, ob[0], ob[1], (it, x) => {
      if (it.k !== 'lamp') return;
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x + 40, 812); g.scale(2.6, 0.32);
      radial(g, 0, 0, 150, [[0, 'rgba(255,205,130,' + 0.42 * lampOn + ')'], [1, 'rgba(255,190,110,0)']]); g.restore();
    });
  });
}

function cityForeground(g, cam, H, o, P) {
  const lit = P._.lit, hedgeL = mulc([62, 128, 86], lit.map(v => v * 1.0)), hedgeS = mulc([34, 84, 70], P._.sh.map(v => v * 1.3)), side = (960 - arcPos(P.H, o, P.elev <= -0.05).x) >= 0 ? -1 : 1;
  withP(g, cam, 1.45, (zs) => {
    const vr = visRange(cam, 1.45, 400);
    eachObj([{ k: 'pole', x: 420 }, { k: 'hedge', x: 2100, w: 460 }, { k: 'hedge', x: -300, w: 380 }], 2900, vr[0], vr[1], (it, x) => {
      if (it.k === 'pole') {
        const pc = mulc([40, 46, 62], [lit[0] * 1.2 + 0.1, lit[1] * 1.2 + 0.1, lit[2] * 1.2 + 0.15]);
        g.fillStyle = rgb(pc); g.fillRect(x - 13, 360, 26, 640); g.fillRect(x - 22, 940, 44, 60);
        g.fillStyle = rgb(mixc(pc, [255, 255, 255], 0.3)); g.fillRect(side < 0 ? x - 13 : x + 8, 360, 5, 640);
        g.fillStyle = rgb(mixc(pc, [10, 10, 20], 0.4)); g.fillRect(x - 4, 480, 8, 40);
      } else {
        const w = it.w, base = 930, n = Math.floor(w / 46);
        for (let i = 0; i < n; i++) {
          const bx = x + i * 46 + 23, r = 38 + hash1(i * 5 + Math.floor(x)) * 14;
          g.fillStyle = rgb(hedgeS); g.beginPath(); g.arc(bx, base - r, r, 0, TWO_PI); g.fill();
        }
        g.fillRect(x, base - 40, w, 80);
        for (let i = 0; i < n; i++) {
          const bx = x + i * 46 + 23, r = 38 + hash1(i * 5 + Math.floor(x)) * 14;
          g.fillStyle = rgb(hedgeL); g.beginPath(); g.arc(bx + side * 5, base - r - 6, r * 0.78, 0, TWO_PI); g.fill();
          g.fillStyle = rgb(mixc(hedgeL, [255, 255, 200], 0.28)); g.beginPath(); g.arc(bx + side * 12, base - r - 14, r * 0.34, 0, TWO_PI); g.fill();
        }
      }
    });
  });
}

SCENES.city = {
  draw(g, cam, H, o, P, sunPos) {
    const T = cityTiles();
    drawTileLayer(g, cam, CITY.far.p, T.far, layerOpts(P, 0, o));
    drawTileLayer(g, cam, CITY.mid.p, T.mid, layerOpts(P, 0.5, o));
    drawTileLayer(g, cam, CITY.near.p, T.near, layerOpts(P, 1, o));
    cityGround(g, cam, H, o, P);
  },
  foreground: cityForeground
};

// ------------------------------------------------------------------ shared outdoor helpers (desert / farm / coast)
function lsd(P) { return arcPos(P.H, {}, P.elev <= -0.05).x < 960 ? -1 : 1; }          // side the dominant light comes from (-1 left, +1 right)
function hf(tw, base, comps) {                                                           // tileable height field: comps [[k, amp, phase]]
  return (x) => { let y = base; for (const c of comps) y -= c[1] * Math.sin(TWO_PI * c[0] * x / tw + c[2]); return y; };
}
function fillHF(c, f, tw, yBot, fill, step) {
  step = step || 6; c.beginPath(); c.moveTo(-10, yBot);
  for (let x = -10; x <= tw + 10; x += step) c.lineTo(x, f(x));
  c.lineTo(tw + 10, yBot); c.closePath(); c.fillStyle = fill; c.fill();
}
// light-facing slopes -> eL (surfaces facing left) / eR masks, as soft strokes along the crest line
function slopeEdges(X, f, tw, width, k) {
  k = k || 3.2;
  for (let x = 0; x < tw; x += 5) {
    const s = (f(x + 5) - f(x)) / 5, a = Math.min(1, Math.abs(s) * k);
    if (a < 0.05) continue;
    const c = s < 0 ? X.l : X.r;
    c.strokeStyle = 'rgba(255,255,255,' + a + ')'; c.lineWidth = width; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, f(x) + width * 0.4); c.lineTo(x + 5.4, f(x + 5) + width * 0.4); c.stroke();
  }
}
function rrPath(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function screenY(cam, p, wy) { return 540 + zsOf(cam, p) * (wy - (540 + (cam.y - 540) * p)); }
function wrapX(x, tw) { return ((x % tw) + tw) % tw; }
const refGap = (p, tw, sx) => wrapX(900 * p - 960 + sx, tw);        // layer-world x that sits at reference-screen x `sx`

// ---- cactus / rock / palm painters usable both in cached tiles (fixed colours) and per frame (lit colours)
function cactus(c, x, base, h, cols, X) {
  const tw = 15 + h * 0.06, r = tw / 2;
  const limb = (px, y0, y1, w) => { rrPath(c, px - w / 2, y1, w, y0 - y1, w / 2); c.fill(); };
  c.fillStyle = cols.dark;
  limb(x, base, base - h, tw * 2);
  limb(x - tw * 2.6, base - h * 0.42, base - h * 0.74, tw * 1.25); c.fillRect(x - tw * 2.6, base - h * 0.46, tw * 2.2, tw * 1.25);
  limb(x + tw * 2.5, base - h * 0.52, base - h * 0.84, tw * 1.25); c.fillRect(x + tw * 0.4, base - h * 0.57, tw * 2.2, tw * 1.25);
  c.fillStyle = cols.lite;
  const sd = cols.side || -1, ox = sd < 0 ? -tw * 0.7 : tw * 0.1;
  rrPath(c, x + ox, base - h + 4, tw * 0.6, h - 6, tw * 0.3); c.fill();
  rrPath(c, x - tw * 2.6 + (sd < 0 ? -tw * 0.5 : tw * 0.0), base - h * 0.74 + 3, tw * 0.5, h * 0.3, tw * 0.25); c.fill();
  rrPath(c, x + tw * 2.5 + (sd < 0 ? -tw * 0.5 : tw * 0.0), base - h * 0.84 + 3, tw * 0.5, h * 0.3, tw * 0.25); c.fill();
  c.strokeStyle = cols.rib; c.lineWidth = 1.4;
  for (const dx of [-0.4, 0.45]) { c.beginPath(); c.moveTo(x + dx * tw, base - h + 8); c.lineTo(x + dx * tw, base - 4); c.stroke(); }
  if (X) {
    X.l.fillStyle = 'rgba(255,255,255,0.9)'; X.l.fillRect(x - tw, base - h + 5, 3, h - 8); X.l.fillRect(x - tw * 2.6 - tw * 0.62, base - h * 0.74 + 4, 3, h * 0.3);
    X.r.fillStyle = 'rgba(255,255,255,0.9)'; X.r.fillRect(x + tw - 3, base - h + 5, 3, h - 8); X.r.fillRect(x + tw * 2.5 + tw * 0.6 - 3, base - h * 0.84 + 4, 3, h * 0.3);
  }
}
function rock(c, x, base, w, h, cols, seed, X) {
  const r = rng(seed), n = 7, pts = [];
  for (let i = 0; i <= n; i++) { const a = Math.PI * i / n, rr = 0.82 + r() * 0.3; pts.push([x + Math.cos(Math.PI - a) * w * 0.5 * rr, base - Math.sin(a) * h * rr * (i === 0 || i === n ? 0.3 : 1)]); }
  c.beginPath(); c.moveTo(x - w * 0.55, base + 4); for (const p of pts) c.lineTo(p[0], p[1]); c.lineTo(x + w * 0.55, base + 4); c.closePath(); c.fillStyle = cols.dark; c.fill();
  const sd = cols.side || -1;
  c.beginPath(); c.moveTo(x + sd * w * 0.55, base + 4);
  for (const p of (sd < 0 ? pts : pts.slice().reverse())) { c.lineTo(p[0], p[1]); if (Math.abs(p[0] - x) < w * 0.08) break; }
  c.lineTo(x + sd * w * 0.04, base - h * 0.3); c.closePath(); c.fillStyle = cols.lite; c.fill();
  c.strokeStyle = cols.rib; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - sd * w * 0.05, base - h * 0.9); c.lineTo(x + sd * w * 0.04, base - h * 0.3); c.lineTo(x - sd * w * 0.12, base); c.stroke();
  if (X) {
    X.l.fillStyle = 'rgba(255,255,255,0.85)'; X.l.beginPath(); X.l.moveTo(x - w * 0.55, base + 4); for (let i = 0; i < 4; i++) X.l.lineTo(pts[i][0], pts[i][1]); X.l.lineTo(pts[3][0] + 6, pts[3][1] + 8); X.l.lineTo(x - w * 0.48, base); X.l.closePath(); X.l.fill();
    X.r.fillStyle = 'rgba(255,255,255,0.85)'; X.r.beginPath(); X.r.moveTo(x + w * 0.55, base + 4); for (let i = n; i > n - 4; i--) X.r.lineTo(pts[i][0], pts[i][1]); X.r.lineTo(pts[n - 3][0] - 6, pts[n - 3][1] + 8); X.r.lineTo(x + w * 0.48, base); X.r.closePath(); X.r.fill();
  }
}
function palm(c, x, base, h, lean, seed, cols, X) {
  const r = rng(seed), tx = x + lean, ty = base - h;
  const trunk = (off, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x - 9 + off, base); c.quadraticCurveTo(x + lean * 0.15 - 6 + off, base - h * 0.55, tx - 4 + off, ty); c.lineTo(tx + 4 + off, ty); c.quadraticCurveTo(x + lean * 0.15 + 8 + off, base - h * 0.55, x + 9 + off, base); c.closePath(); c.fill(); };
  trunk(0, cols.trunkD); trunk(cols.side < 0 ? -2.4 : 2.4, cols.trunk);
  c.strokeStyle = cols.trunkD; c.lineWidth = 1.6;
  for (let i = 1; i < 14; i++) { const u = i / 14, px = x + lean * u * u * 0.95, py = base - h * u; c.beginPath(); c.moveTo(px - 8 + 3 * u, py); c.quadraticCurveTo(px, py + 3, px + 8 - 3 * u, py); c.stroke(); }
  const fr = 9;
  for (let i = 0; i < fr; i++) {
    const a = -Math.PI * 0.95 + (Math.PI * 0.9) * i / (fr - 1) + (r() - 0.5) * 0.2, L = (88 + r() * 44) * (0.9 + h / 700);
    const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.55 + L * 0.42 * Math.abs(Math.cos(a)), mx = tx + Math.cos(a) * L * 0.55, my = ty + Math.sin(a) * L * 0.95 - 8;
    const wdt = 11;
    c.fillStyle = cols.leafD; c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(mx, my - wdt, ex, ey); c.quadraticCurveTo(mx, my + wdt * 1.2, tx, ty); c.fill();
    c.fillStyle = (cols.side < 0) === (Math.cos(a) < 0) ? cols.leafL : cols.leaf;
    c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(mx, my - wdt, ex, ey); c.quadraticCurveTo(mx, my - wdt * 0.1, tx, ty); c.fill();
    if (X) { const ctx = Math.cos(a) < 0 ? X.l : X.r; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(mx, my - wdt, ex, ey); ctx.stroke(); }
  }
  c.fillStyle = cols.trunkD; c.beginPath(); c.arc(tx - 3, ty + 6, 6, 0, TWO_PI); c.arc(tx + 5, ty + 7, 5.5, 0, TWO_PI); c.fill();
}
function litCols(P, kind) {
  const lit = P._.lit, sh = P._.sh, side = lsd(P);
  const L = (c) => rgb(mulc(c, lit)), S = (c) => rgb(mulc(c, sh.map(v => v * 1.25)));
  if (kind === 'cactus') return { dark: S([52, 112, 78]), lite: L([98, 176, 104]), rib: S([34, 82, 62]), side: side };
  if (kind === 'rock') return { dark: S([156, 118, 96]), lite: L([226, 184, 142]), rib: S([102, 72, 70]), side: side };
  if (kind === 'palm') return { trunk: L([172, 126, 86]), trunkD: S([122, 84, 66]), leaf: S([54, 150, 86]), leafD: S([30, 96, 66]), leafL: L([104, 190, 98]), side: side };
  return {};
}
const FIX = { cactus: { dark: '#3e8a62', lite: '#6fc27a', rib: '#2a6a52', side: -1 }, rock: { dark: '#b98a72', lite: '#e8c59a', rib: '#8a604e', side: -1 }, palm: { trunk: '#b08658', trunkD: '#80583e', leaf: '#3a9a5a', leafD: '#216a48', leafL: '#74c866', side: -1 } };

// ------------------------------------------------------------------ DESERT
const DESERT = { far: { p: 0.15, base: 716, tw: 2600, y0: 300, y1: 900, sc: 1 }, mid: { p: 0.4, base: 734, tw: 2600, y0: 380, y1: 900, sc: 1 }, near: { p: 0.7, base: 752, tw: 2400, y0: 480, y1: 900, sc: 1.2 } };
function mesa(c, x, w, h, base, cols, r) {
  const top = base - h, sl = 14 + r() * 20;
  c.beginPath(); c.moveTo(x, base + 60); c.lineTo(x + sl * 0.4, base - h * 0.3); c.lineTo(x + sl, top + 6); c.lineTo(x + sl + 6, top); c.lineTo(x + w - sl - 6, top); c.lineTo(x + w - sl, top + 6); c.lineTo(x + w - sl * 0.4, base - h * 0.3); c.lineTo(x + w, base + 60); c.closePath();
  c.save(); c.clip();
  const bands = 6 + ((r() * 4) | 0);
  for (let i = 0; i < bands; i++) { c.fillStyle = cols[i % cols.length]; const y = top + (h + 60) * i / bands; c.fillRect(x, y, w, (h + 60) / bands + 1); }
  c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x, top, w, 8);
  c.restore();
}
function desertTiles() {
  return cached('desert', () => {
    const far = makeTile({
      tw: DESERT.far.tw, y0: DESERT.far.y0, y1: DESERT.far.y1, sc: 1, edges: true, win: 0,
      paint(X, r) {
        const base = DESERT.far.base, c = X.b, cols = ['#c98a78', '#d4a08a', '#bf7e72', '#d9aa8c', '#c48a7c'];
        const f = hf(DESERT.far.tw, base - 30, [[3, 22, 0.4], [7, 10, 1.7], [11, 5, 2.2]]);
        fillHF(c, f, DESERT.far.tw, base + 120, '#d7a98a');
        let x = 60;
        while (x < DESERT.far.tw - 220) { const w = 140 + r() * 260, h = 70 + r() * 130; mesa(c, x, w, h, base - 10, cols, r); X.l.fillStyle = 'rgba(255,255,255,0.8)'; X.l.fillRect(x + 4, base - 10 - h, 8, h + 10); X.r.fillStyle = 'rgba(255,255,255,0.8)'; X.r.fillRect(x + w - 12, base - 10 - h, 8, h + 10); x += w + 120 + r() * 380; }
        fillHF(c, hf(DESERT.far.tw, base - 8, [[4, 12, 1.1], [9, 6, 0.3]]), DESERT.far.tw, base + 120, '#d9a984');
      }
    }, 71);
    const mid = makeTile({
      tw: DESERT.mid.tw, y0: DESERT.mid.y0, y1: DESERT.mid.y1, sc: 1, edges: true, win: 0,
      paint(X, r) {
        const c = X.b, tw = DESERT.mid.tw, f = hf(tw, DESERT.mid.base - 40, [[2, 34, 0.2], [5, 18, 2.1], [9, 8, 0.9]]);
        let gr = c.createLinearGradient(0, DESERT.mid.base - 110, 0, DESERT.mid.base + 120); gr.addColorStop(0, '#f2d6a0'); gr.addColorStop(0.5, '#e6bb7c'); gr.addColorStop(1, '#cf9a60');
        fillHF(c, f, tw, DESERT.mid.base + 150, gr);
        // shaded far faces of the dunes (soft)
        for (let x = 0; x < tw; x += 5) { const s = (f(x + 5) - f(x)) / 5; if (s > 0.02) { c.fillStyle = 'rgba(150,80,60,' + Math.min(0.28, s * 0.7) + ')'; c.fillRect(x, f(x), 5.4, 150); } }
        slopeEdges(X, f, tw, 16, 4);
        for (let i = 0; i < 4; i++) { const x = 100 + r() * (tw - 200); if (r() < 0.4) cactus(c, x, f(x) + 10, 70 + r() * 50, FIX.cactus, X); else rock(c, x, f(x) + 8, 40 + r() * 40, 24 + r() * 20, FIX.rock, 400 + i, X); }
      }
    }, 83);
    const near = makeTile({
      tw: DESERT.near.tw, y0: DESERT.near.y0, y1: DESERT.near.y1, sc: DESERT.near.sc, edges: true, win: 0,
      paint(X, r) {
        const c = X.b, tw = DESERT.near.tw, f = hf(tw, DESERT.near.base - 22, [[3, 20, 1.3], [6, 11, 0.5], [13, 4, 2.6]]);
        let gr = c.createLinearGradient(0, DESERT.near.base - 80, 0, DESERT.near.base + 100); gr.addColorStop(0, '#eecb8a'); gr.addColorStop(1, '#d6a468');
        fillHF(c, f, tw, DESERT.near.base + 150, gr);
        for (let x = 0; x < tw; x += 5) { const s = (f(x + 5) - f(x)) / 5; if (s > 0.02) { c.fillStyle = 'rgba(150,80,60,' + Math.min(0.3, s * 0.8) + ')'; c.fillRect(x, f(x), 5.4, 120); } }
        slopeEdges(X, f, tw, 12, 4);
        for (let i = 0; i < 5; i++) { const x = 160 + r() * (tw - 320); if (r() < 0.5) cactus(c, x, f(x) + 6, 110 + r() * 70, FIX.cactus, X); else rock(c, x, f(x) + 6, 60 + r() * 60, 34 + r() * 26, FIX.rock, 600 + i, X); }
        // dry bushes
        c.strokeStyle = '#8a6a44'; c.lineWidth = 2;
        for (let i = 0; i < 8; i++) { const x = r() * tw, y = f(x) + 8; for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * 0.34 + (r() - 0.5) * 0.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * (16 + r() * 12), y + Math.sin(a) * (16 + r() * 12)); c.stroke(); } }
      }
    }, 97);
    return { far: far, mid: mid, near: near };
  });
}
const DESERT_OBJ = [{ k: 'cactus', x: 360, s: 1.0 }, { k: 'rock', x: 640, s: 0.8 }, { k: 'rock', x: 1520, s: 1.1 }, { k: 'cactus', x: 1880, s: 1.35 }, { k: 'rock', x: 2300, s: 0.6 }];
function crackPattern(g) {
  return pattern(g, 'cracks', 320, 160, (x, w, h, r) => {
    const gx = 6, gy = 3, pts = [];
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) pts.push([(i + 0.2 + r() * 0.6) * w / gx, (j + 0.2 + r() * 0.6) * h / gy]);
    const P = (i, j) => pts[((j + gy) % gy) * gx + ((i + gx) % gx)];
    x.strokeStyle = 'rgba(96,58,40,0.55)'; x.lineWidth = 1.5; x.lineCap = 'round';
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) { const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1); for (const q of [b, c]) { const ox = (q[0] < a[0] - w / 2) ? w : (q[0] > a[0] + w / 2 ? -w : 0), oy = (q[1] < a[1] - h / 2) ? h : (q[1] > a[1] + h / 2 ? -h : 0); for (const sx of [0, -w, w]) for (const sy of [0, -h, h]) { x.beginPath(); x.moveTo(a[0] + sx, a[1] + sy); x.lineTo(q[0] + ox + sx, q[1] + oy + sy); x.stroke(); } } }
    x.strokeStyle = 'rgba(255,240,210,0.25)'; x.lineWidth = 1;
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) { const a = P(i, j), b = P(i + 1, j); if (Math.abs(b[0] - a[0]) < w / 2) { x.beginPath(); x.moveTo(a[0], a[1] + 2); x.lineTo(b[0], b[1] + 2); x.stroke(); } }
  });
}
function desertGround(g, cam, H, o, P) {
  const lit = P._.lit, t = o.t || 0, heat = Math.max(o.heat || 0, 0.22 * P.day);
  withP(g, cam, 1, () => {
    const vr = visRange(cam, 1, 300), x0 = vr[0], ww = vr[1] - vr[0];
    let gr = g.createLinearGradient(0, 756, 0, 1250); gr.addColorStop(0, rgb(mulc([238, 206, 152], lit))); gr.addColorStop(0.35, rgb(mulc([226, 186, 128], lit))); gr.addColorStop(1, rgb(mulc([196, 150, 98], lit)));
    g.fillStyle = gr; g.fillRect(x0, 756, ww, 520);
    // sand ripples
    g.save(); g.globalAlpha = 0.55; g.fillStyle = pattern(g, 'ripples', 256, 128, (x, w, h, r) => { x.strokeStyle = 'rgba(150,96,60,0.22)'; x.lineWidth = 1.6; for (let i = 0; i < 9; i++) { const y = (i + 0.5) * h / 9 + (r() - 0.5) * 6; x.beginPath(); x.moveTo(0, y); for (let k = 0; k <= 8; k++) x.lineTo(k * w / 8, y + Math.sin(k * 1.3 + i) * 3.6); x.stroke(); } x.fillStyle = 'rgba(255,248,224,0.2)'; for (let i = 0; i < 200; i++) x.fillRect(r() * w, r() * h, 1.6, 1.4); });
    g.fillRect(x0, 756, ww, 520); g.restore();
    // packed track where the host walks + cracked dry ground
    gr = g.createLinearGradient(0, 778, 0, 880); gr.addColorStop(0, 'rgba(120,76,48,0)'); gr.addColorStop(0.35, rgb(mulc([196, 150, 104], lit), 0.55)); gr.addColorStop(0.75, rgb(mulc([196, 150, 104], lit), 0.55)); gr.addColorStop(1, 'rgba(120,76,48,0)');
    g.fillStyle = gr; g.fillRect(x0, 778, ww, 102);
    g.save(); g.globalAlpha = 0.38 * (0.5 + 0.5 * heat); g.fillStyle = crackPattern(g); g.fillRect(x0, 778, ww, 520); g.restore();
    // distance haze over the back of the sand
    gr = g.createLinearGradient(0, 756, 0, 800); gr.addColorStop(0, rgb(P._.haze, 0.5 * P.day)); gr.addColorStop(1, rgb(P._.haze, 0)); g.fillStyle = gr; g.fillRect(x0, 756, ww, 44);
    // long heat shimmer streaks
    if (heat > 0.02 && P.day > 0.05) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const y = 640 + i * 15 + (i * i) % 5, a = 0.07 * heat * (0.6 + 0.4 * Math.sin(t * 1.6 + i * 2.2));
        g.strokeStyle = 'rgba(255,248,226,' + a + ')'; g.lineWidth = 3 + (i % 3) * 2; g.beginPath();
        for (let x = x0; x <= x0 + ww; x += 36) { const yy = y + 3.4 * Math.sin(x * 0.011 + t * (2.4 + i * 0.2) + i) + 2 * Math.sin(x * 0.034 - t * 3.1); if (x === x0) g.moveTo(x, yy); else g.lineTo(x, yy); }
        g.stroke();
      }
      g.restore();
    }
    // objects with sun-driven cast shadows
    const ob = visRange(cam, 1, 160);
    eachObj(DESERT_OBJ, 2600, ob[0], ob[1], (it, x) => {
      const s = it.s || 1;
      if (P.sunUp > 0.02) { g.save(); g.fillStyle = 'rgba(70,32,60,' + (0.22 * P.sunUp) + ')'; g.beginPath(); const L = P.shx * (it.k === 'cactus' ? 130 : 40) * s; g.moveTo(x - 14 * s, 806); g.lineTo(x + 14 * s, 806); g.lineTo(x + 14 * s + L, 812); g.lineTo(x - 14 * s + L, 812); g.closePath(); g.fill(); g.beginPath(); g.ellipse(x + L * 0.5, 808, Math.abs(L) * 0.5 + 40 * s, 7 * s, 0, 0, TWO_PI); g.fill(); g.restore(); }
    });
    eachObj(DESERT_OBJ, 2600, ob[0], ob[1], (it, x, seed) => {
      const s = it.s || 1;
      if (it.k === 'cactus') cactus(g, x, 806, 150 * s, litCols(P, 'cactus')); else rock(g, x, 808, 90 * s, 52 * s, litCols(P, 'rock'), 900 + (seed & 7));
    });
  });
}
function desertForeground(g, cam, H, o, P) {
  withP(g, cam, 1.45, () => {
    const vr = visRange(cam, 1.45, 400);
    eachObj([{ k: 'cactus', x: 560, s: 1.0 }, { k: 'rock', x: 2020, s: 1.0 }, { k: 'rock', x: 1000, s: 0.5 }], 3000, vr[0], vr[1], (it, x, seed) => {
      if (it.k === 'cactus') cactus(g, x, 1050, 300, litCols(P, 'cactus')); else rock(g, x, 1050, 170 * it.s, 90 * it.s, litCols(P, 'rock'), 1200 + (seed & 3));
    });
  });
}
SCENES.desert = {
  warm() { desertTiles(); },
  draw(g, cam, H, o, P) {
    const T = desertTiles(), ob = (d) => layerOpts(P, d, o);
    drawTileLayer(g, cam, DESERT.far.p, T.far, ob(0));
    drawTileLayer(g, cam, DESERT.mid.p, T.mid, ob(0.5));
    drawTileLayer(g, cam, DESERT.near.p, T.near, ob(1));
    desertGround(g, cam, H, o, P);
  },
  foreground: desertForeground
};

// ------------------------------------------------------------------ FARM
const FARM = { far: { p: 0.15, base: 716, tw: 2600, y0: 380, y1: 900, sc: 1 }, mid: { p: 0.42, base: 732, tw: 2600, y0: 330, y1: 900, sc: 1 }, near: { p: 0.72, base: 752, tw: 2300, y0: 520, y1: 900, sc: 1.15 }, mill: { x: 0, y: 0 } };
FARM.millX = refGap(0.42, 2600, 300);
FARM.barnX = refGap(0.42, 2600, 1330);
function tuft(c, x, y, h, col, n, r) { c.fillStyle = col; for (let i = 0; i < n; i++) { const a = (i / (n - 1) - 0.5) * 1.5 + (r() - 0.5) * 0.25, L = h * (0.7 + r() * 0.5); c.beginPath(); c.moveTo(x - 3, y); c.quadraticCurveTo(x + a * L * 0.3, y - L * 0.6, x + a * L, y - L); c.quadraticCurveTo(x + a * L * 0.3 + 3, y - L * 0.5, x + 3, y); c.fill(); } }
function farmTiles() {
  return cached('farm', () => {
    const far = makeTile({
      tw: FARM.far.tw, y0: FARM.far.y0, y1: FARM.far.y1, sc: 1, edges: true, win: 0,
      paint(X, r) {
        const tw = FARM.far.tw, base = FARM.far.base;
        const f1 = hf(tw, base - 78, [[2, 40, 0.5], [5, 18, 1.8], [9, 6, 0.4]]), f2 = hf(tw, base - 30, [[3, 28, 2.2], [7, 12, 0.7]]);
        let gr = X.b.createLinearGradient(0, base - 160, 0, base); gr.addColorStop(0, '#9ccf9a'); gr.addColorStop(1, '#7fbb88');
        fillHF(X.b, f1, tw, base + 100, gr); slopeEdges(X, f1, tw, 14, 3.5);
        gr = X.b.createLinearGradient(0, base - 110, 0, base); gr.addColorStop(0, '#8ccb82'); gr.addColorStop(1, '#6db070');
        fillHF(X.b, f2, tw, base + 100, gr); slopeEdges(X, f2, tw, 12, 3.5);
        // field patchwork + tree lines
        for (let i = 0; i < 30; i++) { const x = r() * tw, y = f2(x) + 12 + r() * 20, w = 70 + r() * 110; X.b.fillStyle = r() < 0.5 ? 'rgba(230,206,110,0.5)' : 'rgba(70,140,80,0.35)'; X.b.beginPath(); X.b.ellipse(x, y, w, 7 + r() * 6, 0, 0, TWO_PI); X.b.fill(); }
        for (let i = 0; i < 46; i++) { const x = r() * tw, y = (r() < 0.5 ? f1(x) : f2(x)) + 4, rr = 9 + r() * 8; X.b.fillStyle = '#4c9460'; X.b.beginPath(); X.b.arc(x, y - rr * 0.8, rr, 0, TWO_PI); X.b.fill(); X.b.fillStyle = '#6cb374'; X.b.beginPath(); X.b.arc(x - 3, y - rr, rr * 0.6, 0, TWO_PI); X.b.fill(); X.l.fillStyle = 'rgba(255,255,255,0.7)'; X.l.beginPath(); X.l.arc(x - rr * 0.5, y - rr, rr * 0.35, 0, TWO_PI); X.l.fill(); X.r.fillStyle = 'rgba(255,255,255,0.7)'; X.r.beginPath(); X.r.arc(x + rr * 0.5, y - rr, rr * 0.35, 0, TWO_PI); X.r.fill(); }
      }
    }, 5);
    const mid = makeTile({
      tw: FARM.mid.tw, y0: FARM.mid.y0, y1: FARM.mid.y1, sc: 1, edges: true, win: 1,
      paint(X, r) {
        const c = X.b, tw = FARM.mid.tw, base = FARM.mid.base;
        const f = hf(tw, base - 34, [[2, 14, 1.0], [6, 6, 0.2]]);
        let gr = c.createLinearGradient(0, base - 70, 0, base + 60); gr.addColorStop(0, '#9edb86'); gr.addColorStop(1, '#6fb868');
        fillHF(c, f, tw, base + 140, gr); slopeEdges(X, f, tw, 10, 3);
        // crop stripes receding on the hillside
        for (let i = 0; i < 6; i++) { c.strokeStyle = i % 2 ? 'rgba(60,120,60,0.30)' : 'rgba(250,240,160,0.20)'; c.lineWidth = 3; c.beginPath(); for (let x = 0; x <= tw; x += 10) { const y = f(x) + 8 + i * 6; if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); }
        // windmill tower (blades are drawn per frame) at FARM.millX
        const mx = FARM.millX, my = f(mx) + 12, th = 250;
        c.fillStyle = '#d8cdb8'; c.beginPath(); c.moveTo(mx - 38, my); c.lineTo(mx - 15, my - th); c.lineTo(mx + 15, my - th); c.lineTo(mx + 38, my); c.closePath(); c.fill();
        c.fillStyle = 'rgba(70,60,100,0.18)'; c.beginPath(); c.moveTo(mx + 6, my); c.lineTo(mx + 5, my - th); c.lineTo(mx + 15, my - th); c.lineTo(mx + 38, my); c.closePath(); c.fill();
        c.fillStyle = '#7e8ba4'; c.beginPath(); c.moveTo(mx - 22, my - th); c.lineTo(mx, my - th - 34); c.lineTo(mx + 22, my - th); c.closePath(); c.fill();
        c.fillStyle = '#6a5a52'; c.fillRect(mx - 9, my - 52, 18, 52); c.fillStyle = '#e9d7a6'; c.fillRect(mx - 5, my - 160, 10, 16);
        X.l.fillStyle = 'rgba(255,255,255,0.9)'; X.l.beginPath(); X.l.moveTo(mx - 38, my); X.l.lineTo(mx - 15, my - th); X.l.lineTo(mx - 9, my - th); X.l.lineTo(mx - 30, my); X.l.closePath(); X.l.fill();
        X.r.fillStyle = 'rgba(255,255,255,0.9)'; X.r.beginPath(); X.r.moveTo(mx + 38, my); X.r.lineTo(mx + 15, my - th); X.r.lineTo(mx + 9, my - th); X.r.lineTo(mx + 30, my); X.r.closePath(); X.r.fill();
        // barn (muted terracotta so the hoodie stays the reddest thing) + silo
        const bx = FARM.barnX, by = f(bx) + 14, bw = 230, bh = 128;
        c.fillStyle = '#b27a5e'; c.fillRect(bx - bw / 2, by - bh, bw, bh);
        c.fillStyle = '#c9906e'; c.fillRect(bx - bw / 2, by - bh, 8, bh);
        c.fillStyle = '#9c6650'; c.beginPath(); c.moveTo(bx - bw / 2 - 12, by - bh + 6); c.lineTo(bx - bw * 0.3, by - bh - 44); c.lineTo(bx, by - bh - 62); c.lineTo(bx + bw * 0.3, by - bh - 44); c.lineTo(bx + bw / 2 + 12, by - bh + 6); c.closePath(); c.fill();
        c.fillStyle = 'rgba(40,30,70,0.14)'; c.beginPath(); c.moveTo(bx, by - bh - 62); c.lineTo(bx + bw / 2 + 12, by - bh + 6); c.lineTo(bx, by - bh + 6); c.closePath(); c.fill();
        c.fillStyle = '#f2ead8'; c.fillRect(bx - 44, by - 94, 88, 94); c.strokeStyle = '#b27a5e'; c.lineWidth = 6; c.strokeRect(bx - 44, by - 94, 88, 94);
        c.beginPath(); c.moveTo(bx - 44, by - 94); c.lineTo(bx + 44, by); c.moveTo(bx + 44, by - 94); c.lineTo(bx - 44, by); c.stroke();
        c.fillStyle = '#f2ead8'; c.fillRect(bx - 12, by - bh - 20, 24, 20); X.w1.fillStyle = 'rgba(255,214,130,0.9)'; X.w1.fillRect(bx - 8, by - bh - 16, 16, 14);
        const sx = bx + bw / 2 + 56;
        c.fillStyle = '#c9d2dc'; c.fillRect(sx - 26, by - 190, 52, 190); c.fillStyle = '#8f9cb4'; c.beginPath(); c.arc(sx, by - 190, 26, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(60,70,110,0.18)'; c.fillRect(sx + 4, by - 190, 22, 190);
        c.fillStyle = 'rgba(255,255,255,0.3)'; for (let q = 1; q < 6; q++) c.fillRect(sx - 26, by - 190 + q * 32, 52, 2);
        X.l.fillStyle = 'rgba(255,255,255,0.9)'; X.l.fillRect(bx - bw / 2 - 10, by - bh - 4, 6, bh + 4); X.l.fillRect(sx - 26, by - 190, 6, 190);
        X.r.fillStyle = 'rgba(255,255,255,0.9)'; X.r.fillRect(bx + bw / 2 + 4, by - bh - 4, 6, bh + 4); X.r.fillRect(sx + 20, by - 190, 6, 190);
        // trees
        for (let i = 0; i < 9; i++) { const x = r() * tw; if (Math.abs(x - bx) < 200 || Math.abs(x - mx) < 120) continue; const y = f(x) + 12, rr = 24 + r() * 16; c.fillStyle = '#4a8f58'; c.beginPath(); c.arc(x, y - rr - 16, rr, 0, TWO_PI); c.arc(x + rr * 0.6, y - rr - 8, rr * 0.8, 0, TWO_PI); c.fill(); c.fillStyle = '#6d4f40'; c.fillRect(x - 3, y - 18, 6, 18); c.fillStyle = '#78b36a'; c.beginPath(); c.arc(x - 4, y - rr - 22, rr * 0.6, 0, TWO_PI); c.fill(); X.l.fillStyle = 'rgba(255,255,255,0.75)'; X.l.beginPath(); X.l.arc(x - rr * 0.6, y - rr - 20, rr * 0.4, 0, TWO_PI); X.l.fill(); X.r.fillStyle = 'rgba(255,255,255,0.75)'; X.r.beginPath(); X.r.arc(x + rr * 1.1, y - rr - 12, rr * 0.4, 0, TWO_PI); X.r.fill(); }
      }
    }, 17);
    const near = makeTile({
      tw: FARM.near.tw, y0: FARM.near.y0, y1: FARM.near.y1, sc: FARM.near.sc, edges: true, win: 0,
      paint(X, r) {
        const c = X.b, tw = FARM.near.tw, base = FARM.near.base;
        const f = hf(tw, base - 16, [[4, 7, 0.4], [9, 3, 1.1]]);
        let gr = c.createLinearGradient(0, base - 40, 0, base + 60); gr.addColorStop(0, '#8ccf70'); gr.addColorStop(1, '#5fa85a');
        fillHF(c, f, tw, base + 140, gr);
        for (let i = 0; i < 80; i++) { const x = r() * tw; tuft(c, x, f(x) + 8, 14 + r() * 14, i % 2 ? '#79bd62' : '#4f9a52', 5, r); }
        // wooden fence
        const fy = base - 6;
        c.fillStyle = '#c59a6c'; c.fillRect(0, fy - 52, tw, 7); c.fillRect(0, fy - 28, tw, 7);
        c.fillStyle = 'rgba(60,40,70,0.16)'; c.fillRect(0, fy - 45, tw, 3); c.fillRect(0, fy - 21, tw, 3);
        X.l.fillStyle = 'rgba(255,255,255,0.7)'; X.l.fillRect(0, fy - 52, tw, 2.6); X.r.fillStyle = 'rgba(255,255,255,0.7)'; X.r.fillRect(0, fy - 52, tw, 2.6);
        for (let x = 20; x < tw; x += 120) {
          c.fillStyle = '#b3855a'; c.fillRect(x - 7, fy - 66, 14, 70); c.fillStyle = '#cfa578'; c.fillRect(x - 7, fy - 66, 4, 70); c.beginPath(); c.moveTo(x - 7, fy - 66); c.lineTo(x, fy - 74); c.lineTo(x + 7, fy - 66); c.closePath(); c.fillStyle = '#c59a6c'; c.fill();
          X.l.fillStyle = 'rgba(255,255,255,0.9)'; X.l.fillRect(x - 7, fy - 70, 3, 74); X.r.fillStyle = 'rgba(255,255,255,0.9)'; X.r.fillRect(x + 4, fy - 70, 3, 74);
        }
        // hay bales
        for (let i = 0; i < 3; i++) { const x = 260 + i * 740 + r() * 160, y = base + 4; c.fillStyle = '#e6c66e'; rrPath(c, x - 30, y - 38, 60, 38, 8); c.fill(); c.strokeStyle = 'rgba(160,110,40,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 10, y - 38); c.lineTo(x - 10, y); c.moveTo(x + 10, y - 38); c.lineTo(x + 10, y); c.stroke(); X.l.fillStyle = 'rgba(255,255,255,0.6)'; X.l.fillRect(x - 30, y - 38, 4, 38); X.r.fillStyle = 'rgba(255,255,255,0.6)'; X.r.fillRect(x + 26, y - 38, 4, 38); }
      }
    }, 29);
    return { far: far, mid: mid, near: near };
  });
}
// crop rows: variants lush / wilted / frost (tiles of a repeating strip of plants)
function cropTile(variant, w, rows, rowStep, plantH, seed) {
  return makeTile({
    tw: w, y0: 0, y1: rows * rowStep + plantH + 30, sc: 1, edges: false, win: 0,
    paint(X, r) {
      const c = X.b;
      for (let j = rows - 1; j >= 0; j--) {                    // back rows first
        const y = plantH + 20 + j * rowStep, sc = 0.8 + 0.2 * (j / Math.max(1, rows - 1));
        c.fillStyle = 'rgba(70,44,30,0.6)'; c.fillRect(0, y - 4, w, 10 * sc);                                 // furrow
        for (let x = 12 + (j % 2) * 18; x < w; x += 54) {
          const h = plantH * sc * (variant === 'wilt' ? 0.52 + r() * 0.18 : 0.9 + r() * 0.2), px = x + (r() - 0.5) * 8;
          const leaves = variant === 'wilt' ? 5 : 7;
          for (let k = 0; k < leaves; k++) {
            const a = (k / (leaves - 1) - 0.5) * (variant === 'wilt' ? 2.5 : 1.7) + (r() - 0.5) * 0.2, L = h * (0.7 + r() * 0.3);
            const droop = variant === 'wilt' ? 0.55 : 0, ex = px + Math.sin(a) * L * 0.8, ey = y - Math.cos(a) * L * (1 - droop * Math.abs(a) / 1.25) + (variant === 'wilt' ? L * 0.15 * Math.abs(a) : 0);
            let col = ['#58b05a', '#46a050', '#6cc468'][k % 3];
            if (variant === 'wilt') col = ['#b8a054', '#9c8446', '#c4ac62'][k % 3];
            if (variant === 'frost') col = ['#bcdcea', '#a4cbe0', '#d6ecf6'][k % 3];
            c.fillStyle = col; c.beginPath(); c.moveTo(px - 4, y); c.quadraticCurveTo(px + Math.sin(a) * L * 0.2 - 8, y - L * 0.5 * (1 - droop * 0.5), ex, ey); c.quadraticCurveTo(px + Math.sin(a) * L * 0.5 + 6, y - L * 0.35, px + 4, y); c.fill();
          }
          if (variant === 'wilt') { c.fillStyle = '#7a5c36'; c.beginPath(); c.arc(px, y - 3, 5 * sc, 0, TWO_PI); c.fill(); }
          if (variant === 'frost') { c.fillStyle = 'rgba(255,255,255,0.85)'; for (let k = 0; k < 4; k++) c.fillRect(px + (r() - 0.5) * 26, y - r() * h, 2.2, 2.2); }
        }
      }
    }
  }, seed);
}
function cropSet(key, w, rows, step, ph, seed) { return cached(key, () => ({ lush: cropTile('lush', w, rows, step, ph, seed), wilt: cropTile('wilt', w, rows, step, ph, seed), frost: cropTile('frost', w, rows, step, ph, seed) })); }
function drawCrops(g, cam, p, set, yTop, o, P, extra) {
  const wl = sat01(o.wilt || 0), fr = sat01(o.frost || 0);
  const opt = layerOpts(P, extra && extra.d != null ? extra.d : 1, o, { desat: 0.1, hazeK: 0.3 });
  const aL = 1 - Math.max(wl, fr), aW = wl * (1 - fr), aF = fr;
  // tiles are authored with y0 = 0; the caller passes a layer-world offset via set.* .y0
  for (const [v, a] of [['lush', aL], ['wilt', aW], ['frost', aF]]) {
    if (a < 0.01) continue;
    const T = set[v]; T.y0 = yTop; T.y1 = yTop + set.h;
    g.save(); g.globalAlpha = a; drawTileLayer(g, cam, p, T, opt); g.restore();
  }
}
function farmGround(g, cam, H, o, P) {
  const lit = P._.lit, sh = P._.sh, fr = sat01(o.frost || 0), wl = sat01(o.wilt || 0);
  withP(g, cam, 1, () => {
    const vr = visRange(cam, 1, 300), x0 = vr[0], ww = vr[1] - vr[0];
    // soil / grass base: grass band at the back, dirt lane, then soil with furrows in front
    const grass = mixc(mixc([108, 178, 84], [182, 168, 92], wl * 0.8), [196, 220, 232], fr * 0.8);
    let gr = g.createLinearGradient(0, 756, 0, 800); gr.addColorStop(0, rgb(mulc(mixc(grass, [140, 196, 104], 0.2), lit))); gr.addColorStop(1, rgb(mulc(grass, lit)));
    g.fillStyle = gr; g.fillRect(x0, 756, ww, 50);
    // dirt lane with ruts
    gr = g.createLinearGradient(0, 790, 0, 886); gr.addColorStop(0, rgb(mulc([176, 130, 92], lit))); gr.addColorStop(1, rgb(mulc([150, 106, 74], lit)));
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0, 792); for (let x = x0; x <= x0 + ww; x += 60) g.lineTo(x, 792 + 3 * Math.sin(x * 0.013)); g.lineTo(x0 + ww, 886); g.lineTo(x0, 886); g.closePath(); g.fill();
    g.fillStyle = rgb(mulc([128, 88, 60], sh.map(v => v * 1.3)), 0.7); g.fillRect(x0, 828, ww, 6); g.fillRect(x0, 858, ww, 6);
    g.save(); g.globalAlpha = 0.6; g.fillStyle = pattern(g, 'dirt', 256, 128, (x, w, h, r) => { for (let i = 0; i < 300; i++) { x.fillStyle = r() < 0.5 ? 'rgba(60,34,20,0.25)' : 'rgba(255,226,180,0.22)'; x.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2); } });
    g.fillRect(x0, 792, ww, 94); g.restore();
    // front soil
    gr = g.createLinearGradient(0, 886, 0, 1250); gr.addColorStop(0, rgb(mulc([128, 88, 62], lit))); gr.addColorStop(1, rgb(mulc([96, 64, 46], lit)));
    g.fillStyle = gr; g.fillRect(x0, 886, ww, 400);
    g.fillStyle = 'rgba(40,24,20,0.28)'; for (let y = 900; y < 1250; y += 34) g.fillRect(x0, y, ww, 7);
    // grass edge
    g.fillStyle = rgb(mulc(grass, lit)); g.fillRect(x0, 880, ww, 6);
    if (fr > 0.02) { g.fillStyle = 'rgba(232,244,255,' + 0.55 * fr + ')'; g.fillRect(x0, 756, ww, 50); g.fillStyle = 'rgba(232,244,255,' + 0.3 * fr + ')'; g.fillRect(x0, 886, ww, 400); }
    // fence-post style cast shadow band along the lane edge
    if (P.sunUp > 0.05) { g.fillStyle = 'rgba(30,20,60,' + 0.12 * P.sunUp + ')'; g.fillRect(x0, 796, ww, 14 + 24 * P.gold); }
  });
}
function drawMillBlades(g, cam, H, o, P) {
  const lit = P._.lit, t = o.t || 0, zs = zsOf(cam, FARM.mid.p), tw = FARM.mid.tw;
  const f = hf(tw, FARM.mid.base - 34, [[2, 14, 1.0], [6, 6, 0.2]]);
  const hubY = f(FARM.millX) + 12 - 250 - 6;
  const vr = visRange(cam, FARM.mid.p, 300), k0 = Math.floor((vr[0] - FARM.millX) / tw), k1 = Math.floor((vr[1] - FARM.millX) / tw);
  withP(g, cam, FARM.mid.p, () => {
    const dm = (1 - 0.34 * 1), col = mulc([236, 226, 204], mixc(lit, [1, 1, 1], 0.1)), colD = mulc([160, 140, 120], P._.sh);
    for (let k = k0; k <= k1; k++) {
      const hx0 = FARM.millX + k * tw;
      const ang = t * (0.9 + 0.5 * P.day) + k;
      g.save(); g.translate(hx0, hubY); g.rotate(ang);
      for (let b = 0; b < 4; b++) {
        g.save(); g.rotate(b * Math.PI / 2);
        g.fillStyle = rgb(colD); g.fillRect(-2.5, -128, 5, 128);
        g.fillStyle = rgb(col); g.fillRect(2, -122, 20, 84);
        g.strokeStyle = rgb(colD); g.lineWidth = 1.5; for (let q = 0; q < 5; q++) { g.beginPath(); g.moveTo(2, -122 + q * 17); g.lineTo(22, -122 + q * 17); g.stroke(); }
        g.restore();
      }
      g.fillStyle = rgb(colD); g.beginPath(); g.arc(0, 0, 9, 0, TWO_PI); g.fill(); g.fillStyle = rgb(col); g.beginPath(); g.arc(-2, -2, 5, 0, TWO_PI); g.fill();
      g.restore();
    }
  });
}
function farmForeground(g, cam, H, o, P) {
  const set = cropSet('cropFront', 700, 3, 70, 74, 41);
  set.h = 3 * 70 + 74 + 30;
  // front rows at p = 1.45: tile spans y 900..(900+h) in layer coordinates
  drawCropsFront(g, cam, set, o, P);
}
function drawCropsFront(g, cam, set, o, P) {
  const wl = sat01(o.wilt || 0), fr = sat01(o.frost || 0);
  const lit = P._.lit, opt = layerOpts(P, 1, o, { desat: 0.1, hazeK: 0 });
  const aL = 1 - Math.max(wl, fr), aW = wl * (1 - fr), aF = fr;
  for (const [v, a] of [['lush', aL], ['wilt', aW], ['frost', aF]]) {
    if (a < 0.01) continue;
    const T = set[v]; T.y0 = 1000; T.y1 = 1000 + set.h; T.tw = 700;
    g.save(); g.globalAlpha = a; drawTileLayer(g, cam, 1.45, T, opt); g.restore();
  }
  void lit;
}
SCENES.farm = {
  warm() { farmTiles(); cropSet('cropBack', 600, 3, 22, 30, 51); cropSet('cropFront', 700, 3, 70, 74, 41); },
  draw(g, cam, H, o, P) {
    const T = farmTiles(), ob = (d) => layerOpts(P, d, o);
    drawTileLayer(g, cam, FARM.far.p, T.far, ob(0));
    drawTileLayer(g, cam, FARM.mid.p, T.mid, ob(0.5));
    drawMillBlades(g, cam, H, o, P);
    drawTileLayer(g, cam, FARM.near.p, T.near, ob(1));
    farmGround(g, cam, H, o, P);
    const set = cropSet('cropBack', 600, 3, 22, 30, 51); set.h = 3 * 22 + 30 + 30;
    const wl = sat01(o.wilt || 0), fr = sat01(o.frost || 0), opt = layerOpts(P, 1, o, { desat: 0.1, hazeK: 0 });
    for (const [v, a] of [['lush', 1 - Math.max(wl, fr)], ['wilt', wl * (1 - fr)], ['frost', fr]]) {
      if (a < 0.01) continue;
      const T2 = set[v]; T2.y0 = 718; T2.y1 = 718 + set.h; T2.tw = 600;
      g.save(); g.globalAlpha = a; drawTileLayer(g, cam, 1, T2, opt); g.restore();
    }
  },
  foreground: farmForeground
};

// ------------------------------------------------------------------ COAST
const COAST = { far: { p: 0.12, base: 580, tw: 2800, y0: 380, y1: 700, sc: 1 }, mid: { p: 0.42, base: 700, tw: 2800, y0: 440, y1: 800, sc: 1 }, near: { p: 0.72, base: 752, tw: 2400, y0: 420, y1: 900, sc: 1.15 } };
function coastTiles() {
  return cached('coast', () => {
    const far = makeTile({
      tw: COAST.far.tw, y0: COAST.far.y0, y1: COAST.far.y1, sc: 1, edges: true, win: 1,
      paint(X, r) {
        const c = X.b, base = COAST.far.base, tw = COAST.far.tw;
        // distant headland + lighthouse
        const f = hf(tw, base - 8, [[1, 30, 1.6], [4, 7, 0.4]]);
        const ix = refGap(COAST.far.p, tw, 1480);
        const g2 = (x) => { const d = Math.abs(x - ix); return d < 380 ? base - 56 * Math.pow(1 - d / 380, 1.4) * (0.9 + 0.1 * Math.sin(d * 0.04)) : base + 8; };
        c.beginPath(); c.moveTo(0, base + 40); for (let x = 0; x <= tw; x += 8) c.lineTo(x, g2(x)); c.lineTo(tw, base + 40); c.closePath(); c.fillStyle = '#7fa6a8'; c.fill();
        X.l.strokeStyle = 'rgba(255,255,255,0.8)'; X.l.lineWidth = 5; X.l.beginPath(); for (let x = ix - 380; x < ix; x += 8) { x === ix - 380 ? X.l.moveTo(x, g2(x)) : X.l.lineTo(x, g2(x)); } X.l.stroke();
        X.r.strokeStyle = 'rgba(255,255,255,0.8)'; X.r.lineWidth = 5; X.r.beginPath(); for (let x = ix; x < ix + 380; x += 8) { x === ix ? X.r.moveTo(x, g2(x)) : X.r.lineTo(x, g2(x)); } X.r.stroke();
        const ly = base - 52;
        c.fillStyle = '#f2ece0'; c.beginPath(); c.moveTo(ix - 16, ly); c.lineTo(ix - 9, ly - 92); c.lineTo(ix + 9, ly - 92); c.lineTo(ix + 16, ly); c.closePath(); c.fill();
        c.fillStyle = '#7e6c96'; for (let q = 0; q < 2; q++) c.fillRect(ix - 15 + q * 3 + 0, ly - 30 - q * 36, 30 - q * 6, 12);
        c.fillStyle = '#6a5a82'; c.fillRect(ix - 13, ly - 100, 26, 8); c.fillStyle = '#ffe9a0'; c.fillRect(ix - 7, ly - 118, 14, 18); c.fillStyle = '#6a5a82'; c.beginPath(); c.moveTo(ix - 12, ly - 118); c.lineTo(ix, ly - 132); c.lineTo(ix + 12, ly - 118); c.closePath(); c.fill();
        X.w1.fillStyle = 'rgba(255,240,150,0.95)'; X.w1.fillRect(ix - 7, ly - 118, 14, 18); radial(X.w1, ix, ly - 109, 40, [[0, 'rgba(255,240,170,0.7)'], [1, 'rgba(255,240,170,0)']]);
        X.l.fillStyle = 'rgba(255,255,255,0.9)'; X.l.fillRect(ix - 10, ly - 92, 3, 92); X.r.fillStyle = 'rgba(255,255,255,0.9)'; X.r.fillRect(ix + 7, ly - 92, 3, 92);
        // tiny far boats
        for (let i = 0; i < 4; i++) { const x = r() * tw, y = base + 14 + r() * 8; c.fillStyle = '#f4f0e8'; c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x + 11, y); c.lineTo(x, y); c.closePath(); c.fill(); c.fillStyle = '#6b6f98'; c.fillRect(x - 10, y, 22, 3); }
      }
    }, 3);
    const mid = makeTile({
      tw: COAST.mid.tw, y0: COAST.mid.y0, y1: COAST.mid.y1, sc: 1, edges: true, win: 1,
      paint(X, r) {
        const c = X.b, tw = COAST.mid.tw, base = COAST.mid.base;
        // wooden pier on piles
        const px0 = refGap(COAST.mid.p, tw, 1180), len = 760, deck = base - 44;
        for (let x = px0; x < px0 + len; x += 52) { c.fillStyle = '#6a4c3c'; c.fillRect(x - 4, deck, 8, 54); c.fillStyle = '#8a6850'; c.fillRect(x - 4, deck, 3, 54); X.l.fillStyle = 'rgba(255,255,255,0.55)'; X.l.fillRect(x - 4, deck, 2.4, 40); X.r.fillStyle = 'rgba(255,255,255,0.55)'; X.r.fillRect(x + 2, deck, 2.4, 40); }
        c.fillStyle = '#b48a62'; c.fillRect(px0 - 8, deck - 8, len + 16, 10); c.fillStyle = '#8e6a4c'; c.fillRect(px0 - 8, deck + 2, len + 16, 5);
        X.l.fillStyle = 'rgba(255,255,255,0.85)'; X.l.fillRect(px0 - 8, deck - 8, len + 16, 2.6); X.r.fillStyle = 'rgba(255,255,255,0.85)'; X.r.fillRect(px0 - 8, deck - 8, len + 16, 2.6);
        c.fillStyle = '#d8c4a4'; c.fillRect(px0 - 8, deck - 36, len + 16, 4); for (let x = px0; x <= px0 + len; x += 38) c.fillRect(x - 2, deck - 36, 4, 30);
        // lamp posts + kiosk
        for (let i = 0; i < 4; i++) { const x = px0 + 60 + i * 200; c.fillStyle = '#3e4660'; c.fillRect(x - 2.5, deck - 80, 5, 74); c.fillStyle = '#f6e8b0'; c.beginPath(); c.arc(x, deck - 84, 7, 0, TWO_PI); c.fill(); X.w1.fillStyle = 'rgba(255,230,150,0.95)'; X.w1.beginPath(); X.w1.arc(x, deck - 84, 6, 0, TWO_PI); X.w1.fill(); radial(X.w1, x, deck - 84, 46, [[0, 'rgba(255,220,140,0.5)'], [1, 'rgba(255,220,140,0)']]); }
        const kx = px0 + len - 150;
        c.fillStyle = '#e9e1d0'; c.fillRect(kx, deck - 78, 96, 70); c.fillStyle = '#3fa6a8'; c.beginPath(); c.moveTo(kx - 10, deck - 78); c.lineTo(kx + 48, deck - 112); c.lineTo(kx + 106, deck - 78); c.closePath(); c.fill(); c.fillStyle = '#7fc4c8'; c.fillRect(kx + 14, deck - 62, 42, 28); X.w1.fillStyle = 'rgba(255,214,130,0.9)'; X.w1.fillRect(kx + 14, deck - 62, 42, 28);
        X.l.fillStyle = 'rgba(255,255,255,0.9)'; X.l.fillRect(kx, deck - 78, 4, 70); X.r.fillStyle = 'rgba(255,255,255,0.9)'; X.r.fillRect(kx + 92, deck - 78, 4, 70);
        // boats on the water left of the pier
        for (let i = 0; i < 3; i++) {
          const bx = refGap(COAST.mid.p, tw, 200 + i * 340 + r() * 60), by = base + 6;
          c.fillStyle = i === 1 ? '#3f7fb8' : '#f4f0e6'; c.beginPath(); c.moveTo(bx - 52, by - 14); c.lineTo(bx + 56, by - 14); c.lineTo(bx + 40, by + 6); c.lineTo(bx - 38, by + 6); c.closePath(); c.fill();
          c.fillStyle = '#c4c9d8'; c.fillRect(bx - 50, by - 8, 100, 3);
          c.fillStyle = '#6b5a52'; c.fillRect(bx - 2, by - 96, 4, 84); c.fillStyle = '#fffaf0'; c.beginPath(); c.moveTo(bx + 4, by - 92); c.lineTo(bx + 48, by - 20); c.lineTo(bx + 4, by - 20); c.closePath(); c.fill(); c.fillStyle = i === 2 ? '#3fa6a8' : '#e6edf8'; c.beginPath(); c.moveTo(bx - 4, by - 84); c.lineTo(bx - 36, by - 20); c.lineTo(bx - 4, by - 20); c.closePath(); c.fill();
          X.l.fillStyle = 'rgba(255,255,255,0.9)'; X.l.fillRect(bx - 38, by - 20, 4, 24); X.r.fillStyle = 'rgba(255,255,255,0.9)'; X.r.fillRect(bx + 44, by - 20, 4, 24);
        }
      }
    }, 9);
    const near = makeTile({
      tw: COAST.near.tw, y0: COAST.near.y0, y1: COAST.near.y1, sc: COAST.near.sc, edges: true, win: 0,
      paint(X, r) {
        const c = X.b, tw = COAST.near.tw, base = COAST.near.base;
        const f = hf(tw, base - 10, [[3, 8, 0.3], [8, 3, 1.2]]);
        let gr = c.createLinearGradient(0, base - 30, 0, base + 60); gr.addColorStop(0, '#f2dcae'); gr.addColorStop(1, '#e4c288'); fillHF(c, f, tw, base + 140, gr); slopeEdges(X, f, tw, 8, 3);
        for (let i = 0; i < 60; i++) { const x = r() * tw; tuft(c, x, f(x) + 6, 18 + r() * 24, i % 3 ? '#6eaa5a' : '#8cc070', 6, r); }
        for (let i = 0; i < 3; i++) palm(c, 220 + i * 800 + r() * 200, f(300 + i * 800) + 8, 210 + r() * 70, (r() < 0.5 ? -1 : 1) * (30 + r() * 40), 70 + i, FIX.palm, X);
        // beach umbrellas (cool colours)
        for (let i = 0; i < 2; i++) { const x = 700 + i * 1100 + r() * 100, y = f(x) + 6; c.fillStyle = '#d8c8a6'; c.fillRect(x - 2, y - 90, 4, 90); c.fillStyle = i ? '#3fa6a8' : '#4a78c0'; c.beginPath(); c.moveTo(x - 62, y - 80); c.quadraticCurveTo(x, y - 140, x + 62, y - 80); c.closePath(); c.fill(); c.fillStyle = '#f4f0e8'; c.beginPath(); c.moveTo(x - 20, y - 80); c.quadraticCurveTo(x - 10, y - 124, x + 4, y - 128); c.lineTo(x + 24, y - 80); c.closePath(); c.fill(); X.l.fillStyle = 'rgba(255,255,255,0.8)'; X.l.beginPath(); X.l.moveTo(x - 62, y - 80); X.l.quadraticCurveTo(x - 30, y - 126, x, y - 124); X.l.lineTo(x - 10, y - 108); X.l.closePath(); X.l.fill(); X.r.fillStyle = 'rgba(255,255,255,0.8)'; X.r.beginPath(); X.r.moveTo(x + 62, y - 80); X.r.quadraticCurveTo(x + 30, y - 126, x, y - 124); X.r.lineTo(x + 10, y - 108); X.r.closePath(); X.r.fill(); }
      }
    }, 13);
    return { far: far, mid: mid, near: near };
  });
}
function coastSea(g, cam, H, o, P) {
  const t = o.t || 0, lit = P._.lit, hy = skyMap(cam, 0, HORY.coast).y, ys = screenY(cam, 1, 772) + 6;
  if (ys <= hy) return;
  g.save();
  const day = P.day, mc = (c) => rgb(mulc(c, mixc([1, 1, 1], lit, 0.85)));
  const hz = mixc(P._.hor, P._.mid, 0.2);
  let gr = g.createLinearGradient(0, hy, 0, ys);
  gr.addColorStop(0, rgb(mixc(mulc([120, 190, 220], lit), hz, 0.55))); gr.addColorStop(0.35, mc([60, 156, 204])); gr.addColorStop(0.75, mc([36, 142, 180])); gr.addColorStop(1, mc([64, 190, 184]));
  g.fillStyle = gr; g.fillRect(-700, hy, W + 1400, ys - hy + 60);
  // sky reflection (tint toward the sky colour at the horizon, stronger at grazing angles)
  gr = g.createLinearGradient(0, hy, 0, hy + (ys - hy) * 0.6); gr.addColorStop(0, rgb(P._.hor, 0.55)); gr.addColorStop(1, rgb(P._.mid, 0));
  g.fillStyle = gr; g.fillRect(-700, hy, W + 1400, (ys - hy) * 0.6);
  // sun glitter / moon path
  const sS = sunScreen(H, cam, o), mS = moonScreen(H, cam, o);
  const src = (sS.elev > 0.02) ? { x: sS.x, c: P._.sun, k: sat01(sS.elev * 3 + 0.2) * P.sunUp } : (mS.elev > 0.02 && P.night > 0.2 ? { x: mS.x, c: [210, 224, 255], k: 0.8 * P.night * sat01(mS.elev * 3) } : null);
  if (src && src.k > 0.02) {
    g.save(); g.globalCompositeOperation = 'lighter';
    g.translate(src.x, hy); g.scale(1, 1);
    radial(g, 0, 0, 150, [[0, rgb(src.c, 0.38 * src.k)], [1, rgb(src.c, 0)]]);
    const n = 150, hh = ys - hy, GB = [[], [], [], [], [], []], gcol = mixc(src.c, [255, 255, 255], 0.4);
    for (let i = 0; i < n; i++) {
      const u = Math.pow(hash1(i * 3.7 + 1), 1.4), y = 3 + u * (hh - 6), spread = 20 + u * 150, x = (hash1(i * 5.9 + 2) - 0.5) * 2 * spread * (0.5 + 0.5 * hash1(i * 1.3));
      const tw2 = 0.5 + 0.5 * Math.sin(t * (2.2 + 3 * hash1(i)) + i * 1.7), a = (0.8 - 0.5 * u) * src.k * (0.25 + 0.75 * tw2) * (1 - Math.abs(x) / (spread + 20) * 0.5);
      if (a < 0.03) continue;
      const w = 6 + 22 * u * (0.4 + hash1(i * 2.2)), h2 = 1.6 + 2.4 * u;
      GB[Math.min(5, (a * 6) | 0)].push(x - w / 2, y, w, h2);
    }
    for (let b = 0; b < 6; b++) { const L = GB[b]; if (!L.length) continue; g.fillStyle = rgb(gcol, (b + 0.5) / 6); g.beginPath(); for (let i = 0; i < L.length; i += 4) g.rect(L[i], L[i + 1], L[i + 2], L[i + 3]); g.fill(); }
    g.restore();
  }
  // wave rows
  g.save(); g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 16; i++) {
    const u = (i + 0.5) / 16, y = hy + 8 + (ys - hy - 14) * Math.pow(u, 1.2), amp = 1 + 3.5 * u, a = (0.1 + 0.18 * u) * (0.4 + 0.6 * day);
    g.strokeStyle = rgb(mixc([255, 255, 255], P._.light, 0.3), a); g.lineWidth = 1.2 + 1.4 * u; g.beginPath();
    for (let x = -100; x <= W + 100; x += 28) { const yy = y + amp * Math.sin(x * (0.012 + 0.004 * u) + t * (0.9 + u) + i * 2.3) + 0.6 * amp * Math.sin(x * 0.031 - t * 1.4 + i); if (x === -100) g.moveTo(x, yy); else g.lineTo(x, yy); }
    g.stroke();
  }
  g.restore();
  // horizon haze line
  gr = g.createLinearGradient(0, hy - 8, 0, hy + 14); gr.addColorStop(0, rgb(P._.hor, 0)); gr.addColorStop(0.5, rgb(P._.hor, 0.45)); gr.addColorStop(1, rgb(P._.hor, 0));
  g.fillStyle = gr; g.fillRect(-700, hy - 8, W + 1400, 22);
  g.restore();
}
function coastGround(g, cam, H, o, P) {
  const lit = P._.lit, sh = P._.sh, t = o.t || 0;
  withP(g, cam, 1, () => {
    const vr = visRange(cam, 1, 300), x0 = vr[0], ww = vr[1] - vr[0];
    // wet sand -> dry sand
    let gr = g.createLinearGradient(0, 760, 0, 1250); gr.addColorStop(0, rgb(mulc([200, 170, 132], lit))); gr.addColorStop(0.1, rgb(mulc([236, 210, 160], lit))); gr.addColorStop(1, rgb(mulc([214, 180, 126], lit)));
    g.fillStyle = gr; g.fillRect(x0, 760, ww, 520);
    g.save(); g.globalAlpha = 0.5; g.fillStyle = pattern(g, 'sandspeck', 256, 128, (x, w, h, r) => { for (let i = 0; i < 380; i++) { x.fillStyle = r() < 0.5 ? 'rgba(120,80,40,0.2)' : 'rgba(255,250,230,0.3)'; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 1.4); } });
    g.fillRect(x0, 760, ww, 520); g.restore();
    // animated foam line at the water's edge + wet sheen
    const surge = 5 + 4 * Math.sin(t * 0.9);
    g.fillStyle = rgb(mulc([88, 140, 150], lit), 0.55); g.beginPath(); g.moveTo(x0, 760);
    for (let x = x0; x <= x0 + ww; x += 40) g.lineTo(x, 770 + surge + 4 * Math.sin(x * 0.02 + t * 1.3)); g.lineTo(x0 + ww, 760); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,' + (0.55 + 0.25 * P.day) + ')'; g.lineWidth = 4; g.beginPath();
    for (let x = x0; x <= x0 + ww; x += 24) { const y = 770 + surge + 4 * Math.sin(x * 0.02 + t * 1.3) + 1.6 * Math.sin(x * 0.09 - t * 2); if (x === x0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 2; g.beginPath();
    for (let x = x0; x <= x0 + ww; x += 24) { const y = 783 + surge * 1.4 + 5 * Math.sin(x * 0.017 - t * 1.1 + 2); if (x === x0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
    if (P.sunUp > 0.02) { g.fillStyle = 'rgba(40,24,70,' + 0.1 * P.sunUp + ')'; g.fillRect(x0, 800, ww, 14); }
    // sun glare on wet sand
    if (P.sunUp > 0.05 && P.gold > 0.1) { const sp = sunScreen(H, cam, o); g.save(); g.globalCompositeOperation = 'lighter'; g.translate(cam.x + (sp.x - 960), 786); g.scale(3, 0.2); radial(g, 0, 0, 220, [[0, rgb(P._.sun, 0.25 * P.gold)], [1, rgb(P._.sun, 0)]]); g.restore(); }
    // beach items: shells / driftwood
    const ob = visRange(cam, 1, 100);
    eachObj([{ k: 'driftwood', x: 500 }, { k: 'rock', x: 1500 }, { k: 'shell', x: 2100 }], 2600, ob[0], ob[1], (it, x, seed) => {
      if (it.k === 'rock') { if (P.sunUp > 0.02) { g.fillStyle = 'rgba(60,30,70,' + 0.2 * P.sunUp + ')'; g.beginPath(); g.ellipse(x + P.shx * 14, 836, 50 + Math.abs(P.shx) * 18, 6, 0, 0, TWO_PI); g.fill(); } rock(g, x, 836, 70, 40, litCols(P, 'rock'), 1500 + (seed & 3)); }
      else if (it.k === 'driftwood') { g.fillStyle = rgb(mulc([150, 112, 84], lit)); g.save(); g.translate(x, 840); g.rotate(-0.06); rrPath(g, -52, -8, 104, 13, 6); g.fill(); g.fillStyle = rgb(mulc([196, 156, 120], lit)); g.fillRect(-48, -7, 92, 3); g.restore(); }
      else { g.fillStyle = rgb(mulc([248, 226, 206], lit)); g.beginPath(); g.ellipse(x, 846, 11, 6, 0, 0, TWO_PI); g.fill(); g.strokeStyle = 'rgba(160,110,90,0.6)'; g.lineWidth = 1.2; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x, 841); g.lineTo(x + k * 4, 851); g.stroke(); } }
    });
  });
}
function coastForeground(g, cam, H, o, P) {
  withP(g, cam, 1.45, () => {
    const vr = visRange(cam, 1.45, 500);
    eachObj([{ k: 'palm', x: 560 }, { k: 'rock', x: 2100 }], 3000, vr[0], vr[1], (it, x, seed) => {
      if (it.k === 'palm') palm(g, x, 1060, 520, 90, 300 + (seed & 3), litCols(P, 'palm')); else rock(g, x, 1060, 210, 110, litCols(P, 'rock'), 1700 + (seed & 3));
    });
  });
}
SCENES.coast = {
  warm() { coastTiles(); },
  draw(g, cam, H, o, P) {
    const T = coastTiles(), ob = (d) => layerOpts(P, d, o);
    coastSea(g, cam, H, o, P);
    drawTileLayer(g, cam, COAST.far.p, T.far, ob(0));
    drawTileLayer(g, cam, COAST.mid.p, T.mid, ob(0.5));
    drawTileLayer(g, cam, COAST.near.p, T.near, ob(1));
    coastGround(g, cam, H, o, P);
  },
  foreground: coastForeground
};

// ------------------------------------------------------------------ assembly
const DEFCAM = { x: 900, y: 612, z: 1, r: 0 };
function normO(o) { o = o || {}; if (!o.scene || !SCENES[o.scene]) { if (o.scene !== 'city') { o = Object.assign({}, o); o.scene = 'city'; } } return o; }
function drawWorld(g, cam, H, o) {
  cam = cam || DEFCAM; o = normO(o); H = ((H % 100) + 100) % 100;
  const P = pal(H, o), sc = SCENES[o.scene];
  g.save();
  const sp = drawSky(g, cam, H, o, P);
  sc.draw(g, cam, H, o, P, sp);
  // low-sun light shafts across the street
  const ss = sunScreen(H, cam, o);
  if (P.gold > 0.35 && ss.elev > -0.02 && !(o.rays === false)) rays(g, ss.x, ss.y, P.gold * (1 - (o.heat || 0)) * 0.55 * (1 - 0.7 * (o.cloud || 0)), o.t || 0);
  g.restore();
}
function drawForeground(g, cam, H, o) {
  cam = cam || DEFCAM; o = normO(o); H = ((H % 100) + 100) % 100;
  const P = pal(H, o), sc = SCENES[o.scene];
  if (sc.foreground) { g.save(); sc.foreground(g, cam, H, o, P); g.restore(); }
}
function warm() {
  scratchInit();
  for (const k in SCENES) if (SCENES[k].warm) SCENES[k].warm();
  cityTiles(); starData(); milkyWay(); for (let i = 0; i < 4; i++) cloudSprite(i);
}

// ------------------------------------------------------------------ cast shadow + hero helpers
const PAL_SHADOW = (function () {
  const base = (typeof G.PAL_REAL === 'object' && G.PAL_REAL) ? G.PAL_REAL : {};
  const out = {};
  for (const k in base) out[k] = typeof base[k] === 'string' ? '#10102a' : base[k];
  out.ghost = false; out.alpha = 1; out.rim = null; out.edge = 'rgba(0,0,0,0)'; out.edgeW = 0; out.shade = 0; out.shadeCol = '0,0,0';
  return out;
})();
let CS = null, CSc = null;
const CS_W = 1000, CS_H = 520, CS_OX = 500, CS_OY = 440;
// drawFn(ctx): draw the figure at scale 1 with its FEET AT THE CTX ORIGIN (0,0); it may use any palette (silhouette is recoloured).
function drawCastShadow(g, H, x, y, s, drawFn, o) {
  o = o || {}; H = ((H % 100) + 100) % 100;
  const P = pal(H, o);
  const moonE = -P.elev;
  let sx, k;
  if (P.sunUp > 0.02) { sx = P.shx; k = 0.36 * P.sunUp * (0.82 + 0.18 * P.day); }
  else sx = 0;
  if (k == null || k < 0.02) {                 // moonlight shadow
    const mc = -P.cosA, me = Math.max(moonE, 0.12);
    sx = Math.max(-4, Math.min(4, mc / me)) * smooth(sat01((moonE + 0.05) / 0.2));
    k = 0.16 * P.night * smooth(sat01((moonE + 0.05) / 0.25));
  }
  if (k < 0.01) return;
  if (!CS) { CS = mk(CS_W, CS_H); CSc = CS.getContext('2d'); }
  CSc.setTransform(1, 0, 0, 1, 0, 0); CSc.globalCompositeOperation = 'source-over'; CSc.globalAlpha = 1; CSc.clearRect(0, 0, CS_W, CS_H);
  CSc.translate(CS_OX, CS_OY); drawFn(CSc);
  CSc.setTransform(1, 0, 0, 1, 0, 0); CSc.globalCompositeOperation = 'source-in';
  CSc.fillStyle = rgb(mulc([24, 26, 70], [1, 1, 1])); CSc.fillRect(0, 0, CS_W, CS_H);
  CSc.globalCompositeOperation = 'source-over';
  const d = 0.1 + 0.16 * (1 - sat01(P.elev * 1.4)), len = Math.max(-3.4, Math.min(3.4, sx));
  g.save();
  g.translate(x, y);
  // soft contact blob
  g.fillStyle = 'rgba(20,22,60,' + (0.22 * k / 0.36) + ')'; g.beginPath(); g.ellipse(len * 4 * s, 4 * s, 60 * s, 9 * s, 0, 0, TWO_PI); g.fill();
  // sheared silhouette
  const L = 0.5;
  g.globalAlpha = k;
  g.transform(s, 0, -len * s, -d * s, 0, 0);
  g.drawImage(CS, -CS_OX, -CS_OY);
  g.globalAlpha = k * 0.35;
  g.transform(1, 0, 0.012, 1.0, 0, 0);
  g.drawImage(CS, -CS_OX, -CS_OY);
  g.restore();
  void L;
}
// extra: walker palette tuned for the time of day (rim = the bounce/sun colour, hood lifted at night so it always pops)
function heroPal(H, o) {
  const P = pal(H, o), base = G.PAL_REAL; if (!base) return null;
  const pl = Object.assign({}, base);
  const sunRight = arcPos(P.H, o, P.elev < -0.05).x > 960;      // facing=+1 -> rim sits on the right (+x) side
  const night = P.night, lit = P._.lit;
  const k = [0, 1, 2].map(i => Math.max(0.74, 1 + (lit[i] - 1) * 0.55));
  const tint = (hex) => rgb(mulc(hx(hex), k));
  const lift = (hex) => rgb(mixc(mulc(hx(hex), k), [255, 120, 100], night * 0.28));
  pl.hood = lift(base.hood); pl.hoodBack = lift(base.hoodBack); pl.hoodDark = tint(base.hoodDark); pl.hoodLight = lift(base.hoodLight);
  pl.string = tint(base.string);
  if (P.sunUp > 0.1) pl.rim = sunRight ? rgb(mixc(P._.light, [255, 255, 255], 0.2)) : rgb(mixc([150, 200, 255], P._.light, 0.2));
  else pl.rim = rgb(mixc([150, 180, 255], [255, 255, 255], 0.2));
  pl.shadeCol = night > 0.5 ? '14,10,60' : '40,24,96';
  pl.shade = 0.30;
  // slightly lift the near-black limbs/shoes at night so they read against dark buildings
  if (night > 0.2) { const lim = rgb(mixc([20, 16, 28], [58, 62, 104], night * 0.7)); pl.leg = lim; pl.hand = lim; pl.head = lim; pl.shoe = lim; pl.legFar = rgb(mixc([10, 7, 16], [40, 44, 80], night * 0.7)); pl.handFar = pl.legFar; pl.shoeFar = pl.legFar; }
  return pl;
}
function heroShadow(g, H, st, o) {
  drawCastShadow(g, H, st.x, st.y, st.s == null ? 1 : st.s, (c) => {
    G.drawWalker(c, Object.assign({}, st, { x: 0, y: 0, s: 1, pal: PAL_SHADOW, alpha: 1, shadow: false }));
  }, o);
}

// ------------------------------------------------------------------ heat / frost / grade
let HW = null, HWc = null;
function heatWarp(g, y0, y1, amt, t) {
  amt = sat01(amt || 0); if (amt < 0.01) return;
  const h = Math.max(2, Math.round(y1 - y0)); y0 = Math.round(y0);
  if (!HW) { HW = mk(W, 700); HWc = HW.getContext('2d'); }
  const hh = Math.min(h, 700);
  HWc.setTransform(1, 0, 0, 1, 0, 0); HWc.clearRect(0, 0, W, 700);
  HWc.drawImage(g.canvas, 0, y0, W, hh, 0, 0, W, hh);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const step = 3;
  for (let y = 0; y < hh; y += step) {
    const u = y / hh, win = Math.sin(Math.PI * u), wy = y0 + y;
    const dx = amt * 7 * win * (Math.sin(wy * 0.052 + t * 4.2) * 0.65 + Math.sin(wy * 0.021 - t * 2.3 + 1.7) * 0.45) * (0.6 + 0.4 * Math.sin(wy * 0.007 + t * 0.9));
    g.drawImage(HW, 0, y, W, step, dx, y0 + y, W, step);
  }
  g.restore();
}
function heatGlare(g, amt, t) {
  amt = sat01(amt || 0); if (amt < 0.01) return; t = t || 0;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const pul = 0.9 + 0.1 * Math.sin(t * 2.1);
  g.globalCompositeOperation = 'lighter';
  radial(g, 960, -140, 1500, [[0, 'rgba(255,248,225,' + 0.5 * amt * pul + ')'], [0.5, 'rgba(255,240,200,' + 0.16 * amt + ')'], [1, 'rgba(255,240,200,0)']]);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(255,250,236,' + 0.1 * amt + ')'; g.fillRect(0, 0, W, HT);
  let gr = g.createRadialGradient(960, 540, 420, 960, 540, 1150);
  gr.addColorStop(0, 'rgba(255,250,235,0)'); gr.addColorStop(1, 'rgba(255,248,226,' + 0.36 * amt + ')');
  g.fillStyle = gr; g.fillRect(0, 0, W, HT);
  // shimmering bright streaks
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const y = 300 + i * 70 + 26 * Math.sin(t * 0.8 + i * 1.9), a = 0.05 * amt * (0.6 + 0.4 * Math.sin(t * 1.7 + i * 2.3));
    gr = g.createLinearGradient(0, y - 24, 0, y + 24); gr.addColorStop(0, 'rgba(255,250,235,0)'); gr.addColorStop(0.5, 'rgba(255,250,235,' + a + ')'); gr.addColorStop(1, 'rgba(255,250,235,0)');
    g.fillStyle = gr; g.fillRect(0, y - 24, W, 48);
  }
  g.restore();
}
function crystalSprite() {
  return cached('frostSpr', () => {
    const c = mk(W, HT), x = c.getContext('2d'), r = rng(404);
    x.lineCap = 'round';
    const branch = (px, py, ang, len, depth, wd) => {
      if (len < 6 || depth > 5) return;
      const nx = px + Math.cos(ang) * len, ny = py + Math.sin(ang) * len;
      x.lineWidth = wd; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
      const n = depth < 2 ? 3 : 2;
      for (let i = 0; i < n; i++) branch(px + (nx - px) * (0.35 + 0.28 * i), py + (ny - py) * (0.35 + 0.28 * i), ang + (i % 2 ? 1 : -1) * (0.55 + r() * 0.35), len * (0.5 + r() * 0.16), depth + 1, wd * 0.72);
      branch(nx, ny, ang + (r() - 0.5) * 0.4, len * 0.62, depth + 1, wd * 0.72);
    };
    // edge frost bloom
    let gr = x.createRadialGradient(960, 540, 380, 960, 540, 1180);
    gr.addColorStop(0, 'rgba(225,240,255,0)'); gr.addColorStop(0.6, 'rgba(225,240,255,0.18)'); gr.addColorStop(1, 'rgba(236,246,255,0.7)');
    x.fillStyle = gr; x.fillRect(0, 0, W, HT);
    x.strokeStyle = 'rgba(240,248,255,0.85)';
    const corners = [[0, 0, 0.78], [W, 0, 2.36], [0, HT, -0.78], [W, HT, -2.36]];
    for (const cn of corners) for (let i = 0; i < 9; i++) branch(cn[0], cn[1], cn[2] + (i - 4) * 0.2 + (r() - 0.5) * 0.12, 120 + r() * 170, 0, 4.4);
    for (let i = 0; i < 26; i++) { const e = r(); const side = i % 4; const px = side === 0 ? e * W : side === 1 ? e * W : side === 2 ? 0 : W, py = side === 0 ? 0 : side === 1 ? HT : e * HT; branch(px, py, (side === 0 ? 1.57 : side === 1 ? -1.57 : side === 2 ? 0 : 3.14) + (r() - 0.5) * 0.7, 40 + r() * 80, 1, 2.6); }
    return c;
  });
}
function frostOverlay(g, amt, t) {
  amt = sat01(amt || 0); if (amt < 0.01) return; t = t || 0;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = Math.pow(amt, 0.8); g.drawImage(crystalSprite(), 0, 0);
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(200,225,255,' + 0.07 * amt + ')'; g.fillRect(0, 0, W, HT);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const h = hash1(i * 7.3 + 1), h2 = hash1(i * 3.1 + 9), edge = i % 2 ? 0.5 : 0.1;
    const px = (h < 0.5 ? h * 0.7 : 1 - (1 - h) * 0.7) * W, py = h2 * HT;
    const a = amt * 0.8 * Math.max(0, Math.sin(t * (1.4 + h2) + i * 2.1)) ** 2;
    if (a < 0.04) continue;
    const r = 5 + 8 * h2;
    radial(g, px, py, r * 1.6, [[0, 'rgba(235,248,255,' + a + ')'], [1, 'rgba(235,248,255,0)']]);
    g.fillStyle = 'rgba(255,255,255,' + a + ')'; g.fillRect(px - r, py - 0.8, r * 2, 1.6); g.fillRect(px - 0.8, py - r, 1.6, r * 2);
    void edge;
  }
  g.restore();
}
function frostGround(g, cam, amt, y0) {
  amt = sat01(amt || 0); if (amt < 0.01) return; cam = cam || DEFCAM; y0 = y0 == null ? 756 : y0;
  withP(g, cam, 1, () => {
    const vr = visRange(cam, 1, 300), x0 = vr[0], ww = vr[1] - vr[0];
    let gr = g.createLinearGradient(0, y0, 0, y0 + 500);
    gr.addColorStop(0, 'rgba(226,240,255,' + 0.5 * amt + ')'); gr.addColorStop(1, 'rgba(210,230,255,' + 0.34 * amt + ')');
    g.fillStyle = gr; g.fillRect(x0, y0, ww, 520);
    g.save(); g.globalAlpha = Math.min(1, amt * 1.1);
    g.fillStyle = pattern(g, 'frostspark', 256, 160, (x, w, h, r) => { for (let i = 0; i < 160; i++) { const a = 0.4 + 0.6 * r(); x.fillStyle = 'rgba(255,255,255,' + a + ')'; const s = 1 + r() * 1.8; x.fillRect(r() * w, r() * h, s, s); } });
    g.fillRect(x0, y0, ww, 520); g.restore();
    gr = g.createLinearGradient(0, y0, 0, y0 + 18); gr.addColorStop(0, 'rgba(255,255,255,' + 0.55 * amt + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x0, y0, ww, 18);
  });
}
function grade(g, H, o) {
  o = o || {}; const P = pal(H, o);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const night = P.night, gold = P.gold, heat = o.heat || 0, frost = o.frost || 0;
  if (gold > 0.05) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = rgb(P._.light, 0.38 * gold); g.fillRect(0, 0, W, HT); }
  if (night > 0.05) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(40,70,190,' + 0.32 * night + ')'; g.fillRect(0, 0, W, HT); }
  if (frost > 0.02) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(120,180,255,' + 0.3 * frost + ')'; g.fillRect(0, 0, W, HT); }
  if (heat > 0.02) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(255,225,150,' + 0.34 * heat * P.day + ')'; g.fillRect(0, 0, W, HT); }
  g.globalCompositeOperation = 'source-over';
  const va = 0.16 + 0.22 * night + 0.06 * gold;
  const gr = g.createRadialGradient(960, 520, 520, 960, 540, 1180);
  gr.addColorStop(0, 'rgba(8,8,30,0)'); gr.addColorStop(1, 'rgba(8,8,30,' + va + ')');
  g.fillStyle = gr; g.fillRect(0, 0, W, HT);
  g.restore();
}

// ------------------------------------------------------------------ HUD
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const HUD_FONT = '"Bahnschrift SemiBold","Segoe UI Black",sans-serif';
function hud(g, H, o) {
  o = o || {}; const alpha = o.alpha == null ? 1 : o.alpha, pop = o.pop == null ? 1 : o.pop, pulse = o.pulse || 0;
  if (alpha < 0.01) return;
  H = ((H % 100) + 100) % 100; const P = pal(H, {});
  const ease = pop >= 1 ? 1 : (function (t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); })(sat01(pop));
  const sc = (0.6 + 0.4 * ease) * (1 + 0.05 * pulse);
  const X = 26, Y = 22, R = 46, cx = X + R, cy = Y + R + 2;
  g.save(); g.globalAlpha = alpha * sat01(pop * 2); g.translate(cx, cy); g.scale(sc, sc); g.translate(-cx, -cy);
  const a = TWO_PI * H / 100;
  // dial: sky disc, day half bright / night half dark, ring
  g.fillStyle = 'rgba(8,10,30,0.34)'; g.beginPath(); g.arc(cx + 2, cy + 4, R + 4, 0, TWO_PI); g.fill();
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TWO_PI); g.clip();
  let gr = g.createLinearGradient(0, cy - R, 0, cy + R);
  gr.addColorStop(0, '#5cb2ff'); gr.addColorStop(0.48, '#bfe6ff'); gr.addColorStop(0.5, '#ffd89a'); gr.addColorStop(0.52, '#2b2f6e'); gr.addColorStop(1, '#0b0f2e');
  g.fillStyle = gr; g.fillRect(cx - R, cy - R, R * 2, R * 2);
  for (let i = 0; i < 14; i++) { const sx = cx - R + hash1(i * 3.7 + 2) * R * 2, sy = cy + 4 + hash1(i * 5.1 + 7) * (R - 4); g.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.4 * hash1(i)) + ')'; g.fillRect(sx, sy, 1.8, 1.8); }
  g.fillStyle = '#3a8a52'; g.fillRect(cx - R, cy - 2, R * 2, 4);   // horizon line
  // 24 tick marks on the ring (every 25 h = quarter)
  g.restore();
  g.lineWidth = 5; g.strokeStyle = '#fff'; g.beginPath(); g.arc(cx, cy, R, 0, TWO_PI); g.stroke();
  g.lineWidth = 2.2; g.strokeStyle = 'rgba(20,24,60,0.85)'; g.beginPath(); g.arc(cx, cy, R + 2.6, 0, TWO_PI); g.stroke();
  g.beginPath(); g.arc(cx, cy, R - 2.6, 0, TWO_PI); g.stroke();
  // orbiting marker (sun above the horizon, moon below)
  const Rm = R - 15, mx = cx - Math.cos(a) * Rm, my = cy - Math.sin(a) * Rm, up = Math.sin(a) >= -0.02;
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (mx - cx) * 0.62, cy + (my - cy) * 0.62); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 3.4, 0, TWO_PI); g.fill();
  if (up) {
    radial(g, mx, my, 17, [[0, 'rgba(255,230,140,0.85)'], [1, 'rgba(255,230,140,0)']]);
    g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(mx, my, 8.5, 0, TWO_PI); g.fill(); g.fillStyle = '#fff4b0'; g.beginPath(); g.arc(mx - 1.6, my - 1.6, 4.6, 0, TWO_PI); g.fill();
  } else {
    g.fillStyle = '#f0ecd8'; g.beginPath(); g.arc(mx, my, 8, 0, TWO_PI); g.fill(); g.fillStyle = '#0d1236'; g.beginPath(); g.arc(mx + 4, my - 2.5, 7, 0, TWO_PI); g.fill();
    // re-clip a crescent: redraw the dial colour to carve (cheap approximation)
    g.fillStyle = '#f0ecd8'; g.beginPath(); g.arc(mx - 3.2, my + 1, 3.2, 0, TWO_PI); g.fill();
  }
  // text
  const tx = X + R * 2 + 16, hour = Math.min(100, Math.floor(H));
  g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.lineCap = 'round';
  const label = (txt, x, y, size, a2) => {
    g.font = size + 'px ' + HUD_FONT; g.lineWidth = size * 0.22; g.strokeStyle = 'rgba(14,16,44,0.95)'; g.strokeText(txt, x, y);
    g.fillStyle = '#fff'; g.globalAlpha = alpha * a2; g.fillText(txt, x, y); g.globalAlpha = alpha * sat01(pop * 2);
  };
  label('HOUR', tx, cy - 8, 22, 0.95);
  const hs = (hour < 10 ? '0' : '') + hour;
  g.font = '50px ' + HUD_FONT; const hw = g.measureText(hs).width;
  label(hs, tx + 64, cy + 14, 50, 1);
  label('/ 100', tx + 64 + hw + 8, cy + 14, 22, 0.9);
  // progress bar with sun marker
  const bx = tx, by = cy + 30, bw = 190;
  rrect(g, bx - 2, by - 2, bw + 4, 12, 6); g.fillStyle = 'rgba(14,16,44,0.85)'; g.fill();
  rrect(g, bx, by, bw, 8, 4); g.fillStyle = 'rgba(255,255,255,0.28)'; g.fill();
  const fw = Math.max(8, bw * H / 100);
  rrect(g, bx, by, fw, 8, 4); gr = g.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#ffd34a'); gr.addColorStop(0.5, '#ff9a40'); gr.addColorStop(1, '#8a6cff'); g.fillStyle = gr; g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(bx + bw * H / 100, by + 4, 7, 0, TWO_PI); g.fill();
  g.strokeStyle = 'rgba(14,16,44,0.9)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = up ? '#ffc933' : '#aab8ff'; g.beginPath(); g.arc(bx + bw * H / 100, by + 4, 3.8, 0, TWO_PI); g.fill();
  g.restore();
}

// ------------------------------------------------------------------ export
G.TOD = {
  pal: pal, drawWorld: drawWorld, drawForeground: drawForeground, drawCastShadow: drawCastShadow, PAL_SHADOW: PAL_SHADOW,
  sunScreen: sunScreen, moonScreen: moonScreen, heatWarp: heatWarp, heatGlare: heatGlare, frostOverlay: frostOverlay, frostGround: frostGround,
  stars: stars, grade: grade, rays: rays, hud: hud,
  // extras
  heroPal: heroPal, heroShadow: heroShadow, warm: warm, _dbg: { drawSky: drawSky, cityTiles: cityTiles, SCENES: SCENES, drawTileLayer: drawTileLayer, layerOpts: layerOpts, CITY: CITY }, scenes: Object.keys(SCENES), DEFCAM: DEFCAM
};
})(typeof window !== 'undefined' ? window : globalThis);
