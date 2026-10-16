// ch6.js — "The Cost" (35 s). CH.ch6.draw(g, lt, dur). Pure function of lt.
// Shots: S1 room hang | S2 close-up never surprised | S3 joke (laughs early) | S4 surprise party (hidden friends, fake shock)
//        S5a/b/c conversation / song / goodbye played twice | S6 drained rerun on the sofa | S8 hall of mirrors | S9 street, what you see depends on what you do
(function () {
'use strict';
const T0 = LAYOUT.ch6.start;
const W = 1920, H = 1080;

// ---------------------------------------------------------------- helpers
const up = (a) => ({ x: Math.sin(a), y: -Math.cos(a) });
const nr = (a) => ({ x: Math.cos(a), y: Math.sin(a) });
const add = (p, q, k) => { k = k == null ? 1 : k; return { x: p.x + q.x * k, y: p.y + q.y * k }; };
const frac = (x) => x - Math.floor(x);
const sin = Math.sin, cos = Math.cos, PI = Math.PI;
function ik2(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux, uy;
  if (d < 1e-6) { ux = 0; uy = 1; d = 1e-6; } else { ux = dx / d; uy = dy / d; }
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function K(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0; while (i < n - 2 && t > keys[i + 1][0]) i++;
  const t0 = keys[i][0], v0 = keys[i][1], t1 = keys[i + 1][0], v1 = keys[i + 1][1];
  const d = (j) => (keys[j + 1][1] - keys[j][1]) / (keys[j + 1][0] - keys[j][0]);
  const m = (j) => { if (j <= 0) return d(0); if (j >= n - 1) return d(n - 2); const a = d(j - 1), b = d(j); return a * b <= 0 ? 0 : 2 * a * b / (a + b); };
  const h = t1 - t0, u = (t - t0) / h, u2 = u * u, u3 = u2 * u;
  const r = (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * m(i) + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * h * m(i + 1);
  return clamp(r, Math.min(v0, v1), Math.max(v0, v1));
}
const vel = (keys, t) => (K(keys, t + 0.025) - K(keys, t - 0.025)) / 0.05;
function lerpObj(a, b, k) {
  if (k <= 0) return a; if (k >= 1) return b;
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * k;
  if (a && b && typeof a === 'object' && typeof b === 'object') { const o = {}; for (const key in a) o[key] = (key in b) ? lerpObj(a[key], b[key], k) : a[key]; return o; }
  return a;
}
function glow(g, x, y, r, col, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
function hexOf(r, g, b) { const h = (v) => ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2); return '#' + h(r) + h(g) + h(b); }
function mixH(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return hexOf(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
function friendPal(c) { return Object.assign({}, PAL_REAL, { hood: c, hoodBack: mixH(c, '#000000', 0.22), hoodDark: mixH(c, '#000000', 0.42), hoodLight: mixH(c, '#ffffff', 0.3) }); }
const PAL_A = friendPal('#1fb5a8'), PAL_B = friendPal('#8d63d6'), PAL_C = friendPal('#f2a23a'), PAL_D = friendPal('#3d8ff0');
const tintCache = {};
function palTint(k, col) { // push the hero palette toward a cyan-blue (mirror reflections)
  const key = Math.round(k * 12) + col; if (tintCache[key]) return tintCache[key];
  const o = {}; for (const p in PAL_REAL) { const v = PAL_REAL[p]; o[p] = (typeof v === 'string' && v[0] === '#' && v.length === 7) ? mixH(v, col, k) : v; }
  return (tintCache[key] = o);
}

// ---------------------------------------------------------------- poses (local, facing +x, feet y=0)
function mkPose(o) {
  const P = walkerPose({ eyeOpen: o.eo == null ? 1 : o.eo, eyeGlow: o.eg || 0, flutter: o.fl == null ? 0.3 : o.fl, time: o.time || 0, lean: 0.1 });
  const hip = { x: o.hx || 0, y: o.hy == null ? -110 : o.hy };
  const a1 = o.a1 == null ? 0.05 : o.a1, a2 = o.a2 == null ? a1 : o.a2, ah = o.ah == null ? a2 : o.ah;
  const waist = add(hip, up(a1), 32), shTop = add(waist, up(a2), 36), headC = add(shTop, up(ah), 36);
  const J = add(add(shTop, up(a2), -8), nr(a2), -1);
  P.hip = hip; P.waist = waist; P.shTop = shTop; P.J = J; P.a1 = a1; P.a2 = a2; P.hunch = o.hunch || 0;
  P.head = { x: headC.x, y: headC.y, r: 29, rot: ah * 0.75 + (o.hr || 0) };
  const mkLeg = (L) => { const r = ik2(hip, { x: L[0], y: -7.5 - L[1] }, 56, 56, 1); return { hip: hip, knee: r.mid, ankle: r.end, pitch: L[2] }; };
  P.legF = mkLeg(o.lf || [5, 0, 0.1]); P.legB = mkLeg(o.lb || [-5, 0, 0.1]);
  const mkArm = (rel, abs) => { const t = abs ? { x: abs[0], y: abs[1] } : { x: J.x + rel[0], y: J.y + rel[1] }; const r = ik2(J, t, 39, 39, -1); return { sh: J, elbow: r.mid, hand: r.end }; };
  P.armF = mkArm(o.af || [8, 72], o.afA); P.armB = mkArm(o.ab || [-6, 72], o.abA);
  P.phone = { amt: 0, ang: 0 };
  return P;
}
const POSE = {
  idle(t, s, eg) { const b = sin(t * 1.7 + s); return mkPose({ hy: -110 + 0.8 * b, a1: 0.04 + 0.02 * b, ah: 0.06 + 0.05 * sin(t * 0.9 + s * 2), af: [10, 70], ab: [-6, 70], eg: eg || 0, time: t }); },
  talk(t, s, amp, eg) { // gesturing
    const a = amp == null ? 1 : amp, p = t * 5.2 + s, q = t * 4.1 + s * 2;
    return mkPose({ hy: -110 + 1.2 * sin(t * 3 + s) * a, a1: 0.06 + 0.04 * sin(p * 0.5), ah: 0.08 + 0.1 * sin(p * 0.4) * a,
      af: [16 + 22 * a * (0.5 + 0.5 * sin(p)), 62 - 34 * a * (0.5 + 0.5 * sin(p + 1))], ab: [-2 + 8 * a * sin(q), 66 - 14 * a * (0.5 + 0.5 * sin(q))], eg: eg || 0, time: t });
  },
  big(t, s) { // punchline: arms wide, head back
    const k = sin(t * 18 + s) * 4;
    return mkPose({ hy: -108 + k * 0.5, a1: -0.18, a2: -0.2, ah: -0.55, af: [46, 4], ab: [34, 16], lf: [8, 0, 0.1], lb: [-8, 0, 0.1], time: t });
  },
  laugh(t, eg) {
    const k = sin(t * 25), kk = 0.5 + 0.5 * sin(t * 12.5);
    return mkPose({ hy: -106 + 4.5 * Math.abs(k), a1: -0.14 + 0.03 * k, a2: -0.2 + 0.04 * k, ah: -0.55 + 0.08 * k, af: [14, 34], ab: [8, 38 - 4 * kk], eg: eg || 0, time: t });
  },
  shock(t, eg) {
    const b = Math.abs(sin(t * 14));
    return mkPose({ hy: -112 + 6 * b, a1: -0.1, a2: -0.12, ah: -0.22, af: [28, -44], ab: [10, -50], lf: [12, 0, 0.1], lb: [-10, 0, 0.1], eg: eg || 0, time: t });
  },
  boo(t, k) { // lunge forward, arms out
    return mkPose({ hy: -102 + 4 * k, a1: 0.14 + 0.45 * k, a2: 0.16 + 0.5 * k, ah: 0.1 + 0.2 * k, af: [lerp(10, 68, k), lerp(70, 22, k)], ab: [lerp(-6, 52, k), lerp(70, 30, k)], lf: [lerp(5, 40, k), 0, 0.1], lb: [lerp(-5, -38, k), 0, 0.1], time: t });
  },
  wave(t, s, hi) { // right arm waving
    const w = sin(t * 13 + s);
    return mkPose({ hy: -110, a1: 0.03, ah: 0.02, af: [24 + 12 * w, -42 + 6 * Math.abs(w)], ab: [-6, 70], time: t });
  },
  sit(t, o) { o = o || {};
    const b = sin(t * 1.3);
    return mkPose({ hy: -66, a1: o.a1 == null ? -0.05 : o.a1, a2: o.a2 == null ? 0.18 : o.a2, ah: o.ah == null ? 0.4 : o.ah, lf: [58, 0, 0.12], lb: [48, 0, 0.12],
      af: o.af || [30, 36 + 2 * b], ab: o.ab || [22, 40], eg: o.eg || 0, eo: o.eo == null ? 1 : o.eo, fl: 0.2, time: t, hx: -2 });
  },
  walk(ph, w, t, eg) { return walkerPose({ phase: ph, walk: w, lean: 0.06 + 0.05 * w, bob: 1, eyeOpen: 1, eyeGlow: eg || 0, flutter: 0.2 + 0.3 * w, time: t, headDown: 0 }); }
};

const sy = (y) => 0.92 + (y - 820) / 165 * 0.16;
function person(g, x, y, facing, pose, pal, alpha, shadow, sc) {
  const st = { x: x, y: y, s: (sc || 1) * sy(y), facing: facing, pose: pose, pal: pal || PAL_REAL, alpha: alpha == null ? 1 : alpha, shadow: shadow !== false };
  drawWalker(g, st); return st;
}
function ghostPerson(g, x, y, facing, pose, a, sc) { return person(g, x, y, facing, pose, palGhost(a), 1, false, sc); }

// ---------------------------------------------------------------- the room (cached)
let ROOM = null, SOFA = null;
function dusk(x, x0, y0, w, h) {
  const gr = x.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#6a3a8a'); gr.addColorStop(0.55, '#e0678a'); gr.addColorStop(1, '#ffb36b');
  x.fillStyle = gr; x.fillRect(x0, y0, w, h);
  let g2 = x.createRadialGradient(x0 + w * 0.7, y0 + h * 0.78, 6, x0 + w * 0.7, y0 + h * 0.78, 170); g2.addColorStop(0, 'rgba(255,240,200,1)'); g2.addColorStop(0.2, 'rgba(255,200,130,0.7)'); g2.addColorStop(1, 'rgba(255,170,110,0)');
  x.fillStyle = g2; x.fillRect(x0, y0, w, h);
  const r = rng(61); x.fillStyle = '#3a2058';
  for (let i = 0; i < 9; i++) { const bw = 30 + r() * 40, bh = 40 + r() * 90, bx = x0 + i * (w / 8.2) - 8; x.fillRect(bx, y0 + h - bh, bw, bh); }
  x.fillStyle = '#ffd98a'; for (let i = 0; i < 24; i++) x.fillRect(x0 + r() * w, y0 + h * 0.5 + r() * h * 0.5, 4, 5);
}
function roomBase() {
  if (ROOM) return ROOM;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  // wall
  let gr = x.createLinearGradient(0, 0, 0, 720); gr.addColorStop(0, '#3a2252'); gr.addColorStop(0.6, '#5a3068'); gr.addColorStop(1, '#6f3c6a');
  x.fillStyle = gr; x.fillRect(0, 0, W, 720);
  x.fillStyle = 'rgba(255,255,255,0.035)'; for (let i = 0; i < 40; i++) x.fillRect(i * 50 + 10, 0, 18, 640);
  // wainscot
  gr = x.createLinearGradient(0, 560, 0, 720); gr.addColorStop(0, '#3b2050'); gr.addColorStop(1, '#2c1840');
  x.fillStyle = gr; x.fillRect(0, 560, W, 160);
  x.fillStyle = '#ffb36b'; x.globalAlpha = 0.55; x.fillRect(0, 558, W, 3); x.globalAlpha = 1;
  x.strokeStyle = 'rgba(20,8,36,0.5)'; x.lineWidth = 3; for (let i = 0; i < 9; i++) { x.strokeRect(60 + i * 220, 590, 170, 100); }
  // window
  x.fillStyle = '#1a0c28'; x.fillRect(176, 116, 408, 456);
  x.save(); x.beginPath(); x.rect(194, 134, 372, 420); x.clip(); dusk(x, 194, 134, 372, 420); x.restore();
  x.fillStyle = '#26143a'; x.fillRect(374, 134, 12, 420); x.fillRect(194, 330, 372, 12);
  x.fillStyle = '#4a2a5e'; x.fillRect(160, 566, 440, 16); x.fillStyle = '#ffb36b'; x.globalAlpha = 0.6; x.fillRect(160, 566, 440, 2); x.globalAlpha = 1;
  // curtains
  [[150, 1], [600, -1]].forEach((cc) => { gr = x.createLinearGradient(cc[0], 0, cc[0] + cc[1] * 70, 0); gr.addColorStop(0, '#7a2f58'); gr.addColorStop(1, '#4a1c48'); x.fillStyle = gr;
    x.beginPath(); x.moveTo(cc[0], 100); x.lineTo(cc[0] + cc[1] * 90, 100); x.quadraticCurveTo(cc[0] + cc[1] * 110, 340, cc[0] + cc[1] * 76, 580); x.lineTo(cc[0], 580); x.closePath(); x.fill(); });
  x.fillStyle = '#2a1238'; x.fillRect(120, 90, 520, 12);
  // frames
  [[700, 200, 150, 190, '#e0678a', '#5fd9ff'], [880, 240, 110, 140, '#ffb36b', '#8d63d6'], [740, 410, 130, 100, '#3d8ff0', '#ffd23f']].forEach((f) => {
    x.fillStyle = '#1e0f2c'; x.fillRect(f[0] - 8, f[1] - 8, f[2] + 16, f[3] + 16); const g3 = x.createLinearGradient(f[0], f[1], f[0] + f[2], f[1] + f[3]); g3.addColorStop(0, f[4]); g3.addColorStop(1, f[5]);
    x.fillStyle = g3; x.fillRect(f[0], f[1], f[2], f[3]); x.fillStyle = 'rgba(20,8,36,0.5)'; x.beginPath(); x.arc(f[0] + f[2] * 0.4, f[1] + f[3] * 0.6, f[2] * 0.3, 0, TAU); x.fill();
  });
  // shelves + books
  const r = rng(404);
  [[1040, 250], [1040, 400]].forEach((s0) => {
    let bx = s0[0] + 8;
    while (bx < 1560) { const bw = 16 + r() * 22, bh = 50 + r() * 60; if (r() < 0.12) { bx += 40; continue; }
      x.fillStyle = ['#d63a3a', '#2bb3a6', '#f2c230', '#8d63d6', '#3d8ff0', '#e0678a'][Math.floor(r() * 6)]; x.globalAlpha = 0.85; x.fillRect(bx, s0[1] - bh, bw, bh); x.globalAlpha = 1; bx += bw + 2; }
    x.fillStyle = '#2a1238'; x.fillRect(s0[0], s0[1], 540, 12); x.fillStyle = '#ffb36b'; x.globalAlpha = 0.55; x.fillRect(s0[0], s0[1], 540, 2); x.globalAlpha = 1;
  });
  // string lights (cord only)
  x.strokeStyle = 'rgba(20,8,36,0.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 40); x.quadraticCurveTo(480, 150, 960, 50); x.quadraticCurveTo(1440, 150, 1920, 40); x.stroke();
  // floor
  gr = x.createLinearGradient(0, 720, 0, H); gr.addColorStop(0, '#7a4a56'); gr.addColorStop(0.5, '#4a2a44'); gr.addColorStop(1, '#241430');
  x.fillStyle = gr; x.fillRect(0, 720, W, H - 720);
  x.fillStyle = '#2c1840'; x.fillRect(0, 714, W, 12); x.fillStyle = '#ffb36b'; x.globalAlpha = 0.5; x.fillRect(0, 714, W, 2); x.globalAlpha = 1;
  x.strokeStyle = 'rgba(20,8,36,0.35)'; x.lineWidth = 2;
  for (let yy = 760; yy < H; yy += 44 + (yy - 760) * 0.12) { x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
  for (let i = -8; i < 30; i++) { x.beginPath(); x.moveTo(960 + (i - 11) * 90, 720); x.lineTo(960 + (i - 11) * 230, H); x.stroke(); }
  // rug
  x.fillStyle = '#2f4f7a'; x.beginPath(); x.ellipse(960, 930, 620, 96, 0, 0, TAU); x.fill();
  x.strokeStyle = '#e09a4a'; x.lineWidth = 6; x.beginPath(); x.ellipse(960, 930, 590, 84, 0, 0, TAU); x.stroke();
  x.strokeStyle = 'rgba(255,210,150,0.3)'; x.lineWidth = 2; x.beginPath(); x.ellipse(960, 930, 480, 66, 0, 0, TAU); x.stroke();
  // lamp (floor, left)
  x.fillStyle = '#1a0c28'; x.fillRect(56, 420, 7, 300); x.beginPath(); x.ellipse(60, 724, 40, 9, 0, 0, TAU); x.fill();
  x.fillStyle = '#ffcf8a'; x.beginPath(); x.moveTo(20, 420); x.lineTo(102, 420); x.lineTo(84, 350); x.lineTo(38, 350); x.closePath(); x.fill();
  // speaker on a low cabinet (right)
  x.fillStyle = '#26143a'; rr(x, 1420, 640, 150, 78, 6); x.fill(); x.fillStyle = '#1a0c28'; rr(x, 1440, 560, 110, 80, 8); x.fill();
  x.fillStyle = '#5a3a7a'; x.beginPath(); x.arc(1495, 600, 26, 0, TAU); x.fill(); x.fillStyle = '#1a0c28'; x.beginPath(); x.arc(1495, 600, 9, 0, TAU); x.fill();
  ROOM = c; return c;
}
function sofaLayer() {
  if (SOFA) return SOFA;
  const c = document.createElement('canvas'); c.width = 700; c.height = 340; const x = c.getContext('2d');
  // local: sofa spans x 20..680, y 20..330 (screen position 940,520)
  let gr = x.createLinearGradient(0, 20, 0, 330);
  gr.addColorStop(0, '#6b3f86'); gr.addColorStop(1, '#3f2058');
  x.fillStyle = gr; rr(x, 20, 40, 660, 230, 34); x.fill();                       // back
  x.fillStyle = '#4b2a68'; rr(x, 0, 150, 70, 170, 26); x.fill(); rr(x, 630, 150, 70, 170, 26); x.fill();   // arms
  gr = x.createLinearGradient(0, 220, 0, 320); gr.addColorStop(0, '#8a58a8'); gr.addColorStop(1, '#4a2a68');
  x.fillStyle = gr; rr(x, 60, 230, 580, 84, 22); x.fill();                        // seat front
  x.strokeStyle = 'rgba(20,8,36,0.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(350, 236); x.lineTo(350, 312); x.stroke();
  x.fillStyle = '#e0678a'; rr(x, 90, 150, 90, 80, 22); x.fill();                  // cushions
  x.fillStyle = '#ffb36b'; x.globalAlpha = 0.7; rr(x, 560, 150, 70, 80, 20); x.fill(); x.globalAlpha = 1;
  x.strokeStyle = '#ffb36b'; x.globalAlpha = 0.7; x.lineWidth = 3; x.beginPath(); x.moveTo(40, 60); x.quadraticCurveTo(350, 24, 660, 60); x.stroke(); x.globalAlpha = 1;
  x.fillStyle = '#1a0c28'; x.fillRect(46, 316, 14, 14); x.fillRect(640, 316, 14, 14);
  SOFA = c; return c;
}
const SOFA_X = 940, SOFA_Y = 520; // sofa seat top ~ y 750; floor 860

// ---------------------------------------------------------------- scene machinery
const sat = (lt) => clamp((lt - 20.7) / 3.8) * 0.94;
function camXform(g, cam) {
  g.translate(W / 2, H / 2); g.rotate(cam.r || 0); g.scale(cam.z, cam.z); g.translate(-cam.x, -cam.y);
}
function drawRoom(g, lt, lights) {
  g.drawImage(roomBase(), 0, 0);
  // window light on the wall/floor + sun shaft
  g.save(); g.globalCompositeOperation = 'lighter';
  const a = 0.14 * lights;
  g.fillStyle = `rgba(255,170,100,${a})`; g.beginPath(); g.moveTo(194, 134); g.lineTo(566, 134); g.lineTo(1250, 880); g.lineTo(640, 1000); g.closePath(); g.fill();
  glow(g, 60, 360, 300, '255,200,130', 0.35 * lights);
  // string-light bulbs, twinkling
  for (let i = 0; i < 17; i++) { const u = i / 16, x = u * 1920, y = u < 0.5 ? lerp(40, 50, u * 2) + 100 * sin(u * 2 * PI) : 50 + 100 * sin(u * PI * 1) * 0.0 + 90 * sin((u - 0.5) * 2 * PI);
    const yy = 40 + (u < 0.5 ? 100 * sin(u * 2 * PI) : 90 * sin((u - 0.5) * 2 * PI)) + (u < 0.5 ? 10 * u * 2 : 10); void y;
    const tw = 0.7 + 0.3 * sin(lt * 3 + i * 1.7);
    glow(g, x, yy + 8, 34, i % 2 ? '255,200,120' : '255,140,170', 0.55 * tw * lights); }
  g.restore();
}
function drawSofa(g) { g.drawImage(sofaLayer(), SOFA_X, SOFA_Y - 20); }
function fgLeaves(g, cam, lt, a) { // out-of-focus plant leaves, bottom corners, parallax
  const ox = (960 - cam.x) * 0.5, sc = 1.25;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = `rgba(14,6,26,${0.92 * a})`;
  [[0, 1080, 1], [1920, 1080, -1]].forEach((c, ci) => {
    for (let i = 0; i < 6; i++) {
      const ang = (-1.1 + i * 0.3) * c[2] - (c[2] > 0 ? 0 : 0) + 0.05 * sin(lt * 0.9 + i + ci), len = 300 + i * 40 + 60 * (i % 2);
      g.save(); g.translate(c[0] + ox * c[2] * 0.4, c[1] + 40); g.rotate(-PI / 2 + ang * 0.9 * c[2]); g.scale(c[2], 1);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -60 * sc, len, 0); g.quadraticCurveTo(len * 0.5, 50 * sc, 0, 0); g.fill();
      g.restore();
    }
  });
  g.restore();
}
function confetti(g, t0, lt, n, ox, oy, spread, seed) {
  const age0 = lt - t0; if (age0 < 0 || age0 > 4.5) return;
  const cols = ['#ff5a6e', '#ffd23f', '#5fd9ff', '#8d63d6', '#7fe0a0', '#ff9a4a', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const h1 = hash1(i * 3 + seed), h2 = hash1(i * 3 + seed + 1), h3 = hash1(i * 3 + seed + 2);
    const a = age0 - h3 * 0.08; if (a < 0) continue;
    const ang = -PI / 2 + (h1 - 0.5) * spread, sp = 600 + h2 * 900, k = 2.6;
    const dd = (1 - Math.exp(-k * a)) / k;
    const x = ox + cos(ang) * sp * dd + 22 * sin(a * 4 + i), y = oy + sin(ang) * sp * dd + 210 * a * (1 - 0.4 * Math.exp(-k * a)) * (0.5 + h2 * 0.5) + 160 * a * a * 0.1;
    const al = 1 - smooth((a - 3.2) / 1.3);
    g.save(); g.translate(x, y); g.rotate(a * (4 + h1 * 6) + i); g.scale(1, Math.abs(cos(a * (5 + h2 * 5) + i)) * 0.9 + 0.1);
    g.globalAlpha = al; g.fillStyle = cols[i % cols.length]; g.fillRect(-6, -3.5, 12, 7); g.restore();
  }
  g.globalAlpha = 1;
}
function balloons(g, t0, lt) {
  const a = lt - t0; if (a < 0) return;
  const cols = ['#ff5a6e', '#ffd23f', '#5fd9ff', '#8d63d6', '#7fe0a0', '#ff9a4a'];
  for (let i = 0; i < 7; i++) {
    const bx = 760 + i * 120 + 40 * sin(i * 2.3), rise = 1 - Math.exp(-a * (0.9 + 0.15 * (i % 3))), by = 700 - 560 * rise - (i % 3) * 30 + 8 * sin(lt * 1.6 + i);
    const sway = 14 * sin(lt * 1.3 + i * 1.7);
    g.save(); g.translate(bx + sway, by);
    g.strokeStyle = 'rgba(255,240,230,0.7)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 40); g.quadraticCurveTo(-8 * sin(lt + i), 110, sway * -1, 200 + 60 * (1 - rise)); g.stroke();
    const gr = g.createRadialGradient(-12, -14, 4, 0, 0, 48); gr.addColorStop(0, mixH(cols[i % 6], '#ffffff', 0.55)); gr.addColorStop(0.5, cols[i % 6]); gr.addColorStop(1, mixH(cols[i % 6], '#000000', 0.45));
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 38, 46, 0, 0, TAU); g.fill();
    g.fillStyle = mixH(cols[i % 6], '#000000', 0.35); g.beginPath(); g.moveTo(0, 44); g.lineTo(-6, 54); g.lineTo(6, 54); g.closePath(); g.fill();
    g.strokeStyle = '#ffb36b'; g.globalAlpha = 0.7; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, 38, -0.9, 0.6); g.stroke(); g.globalAlpha = 1;
    g.restore();
  }
}
function bunting(g, lt, a) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a;
  const cols = ['#ff5a6e', '#ffd23f', '#5fd9ff', '#8d63d6', '#7fe0a0'];
  for (let i = 0; i < 17; i++) {
    const u = (i + 0.5) / 17, x = u * 1920, y = 120 + 120 * sin(u * PI) + 4 * sin(lt * 2 + i);
    g.fillStyle = cols[i % 5]; g.beginPath(); g.moveTo(x - 26, y - 8); g.lineTo(x + 26, y - 8); g.lineTo(x, y + 62); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(20,8,36,0.5)'; g.lineWidth = 2; g.stroke();
  }
  g.strokeStyle = 'rgba(20,8,36,0.7)'; g.lineWidth = 2.4; g.beginPath(); for (let i = 0; i <= 34; i++) { const u = i / 34; const yy = 112 + 120 * sin(u * PI); i ? g.lineTo(u * 1920, yy) : g.moveTo(0, yy); } g.stroke();
  g.restore();
}
function note(g, x, y, r, rot, col) {
  g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 3.4;
  g.beginPath(); g.ellipse(0, 0, r, r * 0.72, -0.4, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(r * 0.85, -r * 0.2); g.lineTo(r * 0.85, -r * 3); g.stroke();
  g.beginPath(); g.moveTo(r * 0.85, -r * 3); g.quadraticCurveTo(r * 2.4, -r * 2.4, r * 1.8, -r * 1.2); g.stroke();
  g.restore();
}
function vhs(g, lt, a, seed) { // tracking glitch + scanlines, screen space
  if (a <= 0.01) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = `rgba(0,0,0,${0.16 * a})`; for (let y = 0; y < H; y += 5) g.fillRect(0, y, W, 1.6);
  const by = ((lt * 220 + seed * 300) % (H + 200)) - 100;
  g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(190,215,255,${0.1 * a})`; g.fillRect(0, by, W, 46);
  g.fillStyle = `rgba(255,255,255,${0.14 * a})`; g.fillRect(0, by + 18, W, 3);
  g.restore();
}

// ---------------------------------------------------------------- cameras per scene (global room coordinates)
const SC = [
  [0, 3.7, 'room'], [3.7, 5.9, 'never'], [5.9, 10.2, 'joke'], [10.2, 15.756, 'party'], [15.756, 17.15, 'talk2'], [17.15, 18.45, 'song'], [18.45, 20.668, 'bye'],
  [20.668, 25.278, 'rerun'], [25.278, 30.262, 'mirror'], [30.262, 99, 'street']
];

// ---------------------------------------------------------------- S1 room hang
function sRoom(g, lt, dur) {
  const k = lt / 3.7, cam = { x: lerp(1020, 960, k), y: 590, z: lerp(1.0, 1.1, k) };
  g.save(); camXform(g, cam);
  drawRoom(g, lt, 1);
  drawSofa(g);
  const eg = 0.25 + 0.2 * sin(lt * 2);
  const flick = clamp((lt - 3.0) / 0.6);
  person(g, 640, 880, 1, POSE.talk(lt, 1, 0.9), PAL_B);
  person(g, 1010, 870, 1, POSE.talk(lt + 0.7, 5, 0.25, eg), PAL_REAL);
  person(g, 1330, 868, -1, POSE.talk(lt + 0.2, 3, 1.0), PAL_A);
  // tiny cyan echo of the hero's own next gesture (he sees ahead)
  if (flick > 0) { const gp = POSE.talk(lt + 1.6, 5, 0.9, 1); ghostPerson(g, 1034, 870, 1, gp, 0.34 * flick); }
  g.restore();
  fgLeaves(g, cam, lt, 1);
}

// ---------------------------------------------------------------- S2 never surprised
function sNever(g, lt) {
  const u = lt - 3.7, k = u / 2.2, cam = { x: lerp(900, 930, k), y: lerp(690, 660, k), z: lerp(2.1, 2.45, k) };
  g.save(); camXform(g, cam);
  drawRoom(g, lt, 1); drawSofa(g);
  // friend A is about to boo from behind-right; ghost shows it 0.9 s ahead
  const boo = (tt) => { const b = clamp((tt - 4.9) / 0.35) * (1 - clamp((tt - 5.35) / 0.5)); return POSE.boo(tt, b); };
  person(g, 1150, 872, -1, boo(lt), PAL_A);
  const ga = smooth((lt - 4.0) / 0.3) * (1 - smooth((lt - 5.0) / 0.25));
  if (ga > 0.01) ghostPerson(g, 1150, 872, -1, boo(lt + 1.0), 0.55 * ga);
  // hero: calm, a ghost of his own would-be flinch comes and goes, he stays still
  const heroP = POSE.idle(lt, 2, 0.8);
  const hh = person(g, 860, 880, 1, heroP, PAL_REAL, 1, true, 1);
  const fl = smooth((lt - 4.9) / 0.1) * (1 - smooth((lt - 5.4) / 0.3));
  if (fl > 0.01) ghostPerson(g, 860 - 18 * fl, 880, 1, POSE.shock(lt, 1), 0.5 * fl);
  void hh;
  g.restore();
  g.save(); g.globalCompositeOperation = 'lighter';
  glow(g, W * 0.5 + 40, 420, 380, '127,233,255', 0.06 + 0.04 * sin(lt * 5)); g.restore();
  fgLeaves(g, cam, lt, 1);
}

// ---------------------------------------------------------------- S3 the joke
function sJoke(g, lt) {
  const u = lt - 5.9;
  const cam = { x: K([[5.9, 1100], [7.4, 1090], [7.9, 980], [10.2, 990]], lt), y: K([[5.9, 650], [7.5, 640], [8.0, 620], [10.2, 640]], lt), z: Math.exp(K([[5.9, Math.log(1.55)], [7.4, Math.log(1.6)], [8.0, Math.log(2.0)], [10.2, Math.log(2.05)]], lt)) };
  g.save(); camXform(g, cam);
  drawRoom(g, lt, 1); drawSofa(g);
  // friend A: tells the joke, punchline at 9.0
  const PUNCH = 9.0;
  const A = (tt) => {
    if (tt < 7.4) return POSE.talk(tt, 3, 0.9);
    if (tt < PUNCH) { const k = smooth((tt - 7.4) / 1.6); return lerpObj(POSE.talk(tt, 3, 1.0), mkPose({ hy: -106, a1: 0.18, a2: 0.2, ah: 0.2, af: [52, 22], ab: [40, 30], time: tt, lf: [10, 0, 0.1], lb: [-8, 0, 0.1] }), k * 0.6); }
    if (tt < PUNCH + 1.0) return POSE.big(tt, 3);
    return POSE.big(tt, 3);
  };
  const aP = lt < 9.35 ? A(lt) : lerpObj(POSE.big(lt, 3), POSE.talk(lt, 3, 0.2), smooth((lt - 9.35) / 0.4));
  person(g, 1250, 872, -1, aP, PAL_A);
  // ghost of the punchline, one second ahead
  const gg = smooth((lt - 7.2) / 0.3) * (1 - smooth((lt - 8.9) / 0.3));
  if (gg > 0.01) ghostPerson(g, 1250 + 16, 872, -1, POSE.big(lt + 1.4, 3), 0.55 * gg);
  // hero laughs early 7.7 - 9.0, then deadpan
  let hP;
  if (lt < 7.7) hP = POSE.talk(lt, 9, 0.12, 0.4);
  else if (lt < 9.0) hP = lerpObj(POSE.talk(lt, 9, 0.12, 0.4), POSE.laugh(lt, 0.6), smooth((lt - 7.7) / 0.15));
  else hP = lerpObj(POSE.laugh(lt, 0.6), POSE.idle(lt, 4, 0.8), smooth((lt - 9.0) / 0.25));
  person(g, 880, 878, 1, hP, PAL_REAL);
  // laughter sparks over his head
  if (lt > 7.7 && lt < 9.2) {
    for (let i = 0; i < 9; i++) { const a = lt - 7.7 - i * 0.11; if (a < 0) continue; const q = frac(a / 0.9); const x = 905 + 30 * sin(i * 2.1 + a * 3) + (i - 4) * 12, y = 590 - q * 120;
      g.save(); g.globalAlpha = (1 - q) * 0.9; g.translate(x, y); g.rotate(a * 3); g.fillStyle = ['#ffd23f', '#ffb36b', '#ff7a8a'][i % 3]; g.beginPath();
      for (let p = 0; p < 8; p++) { const rr_ = p % 2 ? 4 : 11, an = p * PI / 4; g.lineTo(cos(an) * rr_, sin(an) * rr_); } g.closePath(); g.fill(); g.restore(); }
  }
  // friend's puzzled beat: little question-mark-free tilt marks (two arcs)
  if (lt > 9.2 && lt < 10.0) { g.save(); g.globalAlpha = smooth((lt - 9.2) / 0.2) * (1 - smooth((lt - 9.8) / 0.3)); g.strokeStyle = '#ffd23f'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.arc(1240, 560, 22, 3.6, 5.6); g.stroke(); g.beginPath(); g.arc(1240, 560, 36, 3.6, 5.6); g.stroke(); g.restore(); }
  g.restore();
  fgLeaves(g, cam, lt, 1);
}

// ---------------------------------------------------------------- S4 surprise party
function sParty(g, lt) {
  const LIGHTS = 13.25;
  const cam = { x: K([[10.2, 600], [11.0, 760], [12.4, 1040], [13.2, 1120], [13.6, 1010], [15.76, 1010]], lt), y: K([[10.2, 590], [12.4, 650], [13.2, 600], [15.76, 600]], lt),
    z: Math.exp(K([[10.2, Math.log(1.1)], [12.4, Math.log(1.7)], [13.2, Math.log(1.75)], [13.6, Math.log(1.25)], [15.76, Math.log(1.35)]], lt)) };
  const on = lt >= LIGHTS;
  g.save(); camXform(g, cam);
  drawRoom(g, lt, on ? 1 : 0.35);
  // hidden friends crouch behind the sofa (feet at 790, fully covered), then leap out in front of it
  const fr = [[1080, PAL_A, 0], [1260, PAL_B, 1], [1440, PAL_C, 2], [1570, PAL_D, 3]];
  const crouch = mkPose({ hy: -78, a1: 0.35, a2: 0.4, ah: 0.2, af: [30, 40], ab: [20, 44], lf: [10, 0, 0.1], lb: [-8, 0, 0.1], time: lt });
  if (!on) fr.forEach((f) => person(g, f[0], 790, -1, crouch, f[1], 1, false));
  drawSofa(g);
  if (on) fr.forEach((f) => {
    const u = clamp((lt - LIGHTS - f[2] * 0.04) / 0.55), e = easeOut(u);
    const fy = lerp(790, 874 + 6 * (f[2] % 2), e) - 190 * sin(PI * u) - (u >= 1 ? 26 * Math.abs(sin((lt - LIGHTS) * 4.6 + f[2] * 1.7)) : 0);
    const fx = f[0] + (f[2] - 1.5) * 70 * e;
    const cheer = POSE.big(lt + f[2] * 0.3, f[2]);
    person(g, fx, fy, f[2] < 2 ? 1 : -1, lerpObj(crouch, cheer, smooth(u * 2)), f[1], 1, true);
  });
  // cyan outlines of the hiders (he sees them) 11.6..13.15
  const gh = smooth((lt - 11.6) / 0.4) * (1 - smooth((lt - 13.15) / 0.1));
  if (gh > 0.01) fr.forEach((f) => ghostPerson(g, f[0] - 6, 790, -1, crouch, 0.6 * gh));
  // hero walks in from the left, stops, then fakes shock
  const hx = K([[10.2, 200], [12.5, 720], [13.0, 760], [30, 760]], lt);
  const w = clamp(vel([[10.2, 200], [12.5, 720], [13.0, 760], [30, 760]], lt) / 120);
  let hP = POSE.walk(hx / 140, w, lt, 0.75);
  if (lt > 13.35) hP = lerpObj(hP, POSE.shock(lt, 0), smooth((lt - 13.35) / 0.18));
  if (lt > 14.35) hP = lerpObj(POSE.shock(lt, 0), POSE.idle(lt, 6, 0.5), smooth((lt - 14.35) / 0.4));
  if (lt > 13.35 && lt < 14.35) hP = POSE.shock(lt, 0);
  person(g, hx, 880, 1, hP, PAL_REAL);
  // dark overlay before lights
  if (on) { bunting(g, lt, smooth((lt - LIGHTS) / 0.15)); balloons(g, LIGHTS + 0.05, lt); confetti(g, LIGHTS + 0.05, lt, 150, 1040, 620, 2.6, 11); confetti(g, LIGHTS + 0.2, lt, 90, 1500, 640, 2.2, 211); }
  g.restore();
  if (!on) { g.save(); g.fillStyle = 'rgba(6,6,32,0.55)'; g.fillRect(0, 0, W, H); g.restore(); }
  if (lt > LIGHTS - 0.02 && lt < LIGHTS + 0.25) flash(g, 0.8 * (1 - (lt - LIGHTS) / 0.25), '#fff6e6');
  fgLeaves(g, cam, lt, 1);
}

// ---------------------------------------------------------------- S5 doubled: conversation / song / goodbye
function sTalk2(g, lt) {
  const cam = { x: 980, y: 640, z: lerp(1.5, 1.6, (lt - 15.756) / 1.4) };
  g.save(); camXform(g, cam);
  drawRoom(g, lt, 1); drawSofa(g);
  const turn = (t) => t < 16.45 ? 0 : 1;          // 0: friend speaks, 1: hero speaks
  const sp = (id, t) => (turn(t) === id ? POSE.talk(t, id * 3 + 1, 1.0, id ? 0.6 : 0) : POSE.idle(t, id));
  person(g, 820, 878, 1, sp(1, lt), PAL_REAL);
  person(g, 1130, 872, -1, sp(0, lt), PAL_B);
  // every line plays twice: ghost of the speaker, early
  const who = turn(lt), gx = who ? 820 : 1130, gf = who ? 1 : -1;
  const ga = 0.5 * win(lt, who ? 16.45 : 15.8, who ? 17.15 : 16.45, 0.15, 0.2);
  if (ga > 0.01) ghostPerson(g, gx + gf * 22, 878, gf, POSE.talk(lt + 0.8, who ? 4 : 1, 1.0), ga);
  // sound arcs
  g.save(); g.lineCap = 'round';
  for (let k = 0; k < 3; k++) { const q = frac(lt * 1.6 - k * 0.3), x = who ? 880 : 1070, d = who ? 1 : -1; g.strokeStyle = `rgba(255,236,200,${0.5 * (1 - q) * (ga > 0 ? 1 : 0)})`; g.lineWidth = 3;
    g.beginPath(); g.arc(x, 600, 22 + q * 70, -0.7 * d + (d < 0 ? PI : 0) - 0.55, -0.7 * d + (d < 0 ? PI : 0) + 0.55); g.stroke(); }
  g.restore();
  g.restore();
  fgLeaves(g, cam, lt, 1);
}
function sSong(g, lt) {
  const u = lt - 17.15, cam = { x: lerp(1330, 1390, u / 1.3), y: 640, z: lerp(1.7, 1.9, u / 1.3) };
  g.save(); camXform(g, cam);
  drawRoom(g, lt, 1); drawSofa(g);
  // hero bobbing, ghost bobs a beat early
  const bob = (t) => { const b = Math.abs(sin(t * 6.3)); return mkPose({ hy: -108 + 7 * b, a1: 0.04 + 0.05 * sin(t * 6.3), ah: 0.1 + 0.18 * sin(t * 6.3), af: [14, 56], ab: [-6, 60 - 20 * b], time: t }); };
  person(g, 1250, 876, 1, bob(lt), PAL_REAL);
  ghostPerson(g, 1268, 876, 1, bob(lt + 0.45), 0.4);
  // notes: real warm + cyan copy that already played
  for (let i = 0; i < 8; i++) {
    const a = lt - 17.0 - i * 0.18, q = a / 1.6; if (q < 0 || q > 1) continue;
    const x = 1495 + 26 * sin(a * 3 + i) - q * 90, y = 560 - q * 330, r = 11 + 3 * (i % 2);
    g.save(); g.globalAlpha = Math.sin(PI * q) * 0.95; note(g, x, y, r, 0.2 * sin(a * 4), '#ffb36b'); g.restore();
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.sin(PI * clamp(q + 0.15)) * 0.8; note(g, x + 44, y - 50, r, 0.2 * sin(a * 4 + 1), '#7fe9ff'); g.restore();
  }
  glow(g, 1495, 600, 140 + 20 * sin(lt * 12), '255,180,110', 0.2);
  g.restore();
  fgLeaves(g, cam, lt, 1);
}
function sBye(g, lt) {
  const u = lt - 18.45, cam = { x: K([[18.45, 1300], [20.67, 1380]], lt), y: 650, z: Math.exp(K([[18.45, Math.log(1.45)], [20.67, Math.log(1.7)]], lt)) };
  g.save(); camXform(g, cam);
  drawRoom(g, lt, 1); drawSofa(g);
  // door (right), opens at 18.4, closes at 20.2
  const dopen = smooth((lt - 18.4) / 0.3) * (1 - smooth((lt - 19.9) / 0.35));
  g.fillStyle = '#12081e'; g.fillRect(1650, 300, 230, 560);
  g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(1650, 0, 1880, 0); gr.addColorStop(0, `rgba(255,214,150,${0.7 * dopen})`); gr.addColorStop(1, `rgba(255,170,110,${0.2 * dopen})`);
  g.fillStyle = gr; g.fillRect(1650, 300, 230, 560); g.beginPath(); g.moveTo(1650, 860); g.lineTo(1880, 860); g.lineTo(1500, 1040); g.lineTo(1080, 960); g.closePath(); g.globalAlpha = 0.18 * dopen; g.fill(); g.restore();
  g.fillStyle = '#5a2f5e'; g.beginPath(); g.moveTo(1650, 300); g.lineTo(1650 + 230 * (1 - dopen * 0.95), 300 + 12 * dopen); g.lineTo(1650 + 230 * (1 - dopen * 0.95), 860 - 12 * dopen); g.lineTo(1650, 860); g.closePath(); g.fill();
  g.strokeStyle = '#ffb36b'; g.globalAlpha = 0.6; g.lineWidth = 3; g.strokeRect(1650, 300, 230, 560); g.globalAlpha = 1;
  // friend leaves through the door, waving
  const fx = K([[18.45, 1590], [19.6, 1600], [20.1, 1760], [20.4, 1800]], lt);
  const fwave = (t) => POSE.wave(t, 2);
  const fP = lt < 19.6 ? fwave(lt) : POSE.walk(fx / 140, 0.7, lt);
  const fa = 1 - smooth((lt - 20.0) / 0.35);
  person(g, fx, 872, lt < 19.6 ? -1 : 1, fP, PAL_A, fa);
  // hero waves back; ghost of the wave already happened
  person(g, 1250, 878, 1, POSE.wave(lt + 0.4, 7), PAL_REAL);
  const gw = smooth((lt - 18.5) / 0.2) * (1 - smooth((lt - 19.8) / 0.3));
  if (gw > 0.01) ghostPerson(g, 1268, 878, 1, POSE.wave(lt + 1.2, 7), 0.45 * gw);
  g.restore();
  fgLeaves(g, cam, lt, 1);
}

// ---------------------------------------------------------------- S6 the rerun
function sRerun(g, lt) {
  const u = (lt - 20.668) / 4.6, cam = { x: lerp(1000, 1210, u), y: lerp(620, 690, u), z: lerp(1.15, 1.6, u) };
  g.save(); camXform(g, cam);
  drawRoom(g, lt, 1 - 0.55 * u); drawSofa(g);
  // hero slumped on the sofa, no glow
  const hp = POSE.sit(lt, { a2: 0.22 + 0.04 * sin(lt * 0.8), ah: 0.5, af: [34, 24], eg: 0.3 * (1 - u) });
  person(g, 1290, 822, 1, hp, PAL_REAL);
  // a rerun of the party: friend loops the same wave every 1.3 s, jittering like tape
  const lp = (lt % 1.3), jit = lp < 0.12 ? 22 * sin(lt * 90) : 0;
  const fa = 0.9 * (1 - 0.3 * u);
  person(g, 640 + jit, 878, 1, POSE.wave(lp + 5.0, 2), PAL_A, fa);
  person(g, 480 - jit, 884, 1, POSE.talk(lp + 3.0, 5, 1.0), PAL_B, fa);
  // ghost loop copies stacking behind them (rewind trails)
  ghostPerson(g, 664, 878, 1, POSE.wave(lp + 4.6, 2), 0.3);
  g.restore();
  fgLeaves(g, cam, lt, 1);
}

// ---------------------------------------------------------------- S8 hall of mirrors
let HALL = null;
const VP = { x: 980, y: 470 };
function hallBase() {
  if (HALL) return HALL;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  let gr = x.createRadialGradient(VP.x, VP.y, 20, VP.x, VP.y, 1000); gr.addColorStop(0, '#2a5aa8'); gr.addColorStop(0.35, '#10265a'); gr.addColorStop(1, '#050a1e');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  // nested mirror frames receding to the vanishing point
  const rt = 0.8;
  for (let i = 0; i < 16; i++) {
    const sc = Math.pow(rt, i), hw = 960 * sc + 6, hh = 620 * sc + 4, cx = VP.x + (960 - VP.x) * sc * 0 , cy = VP.y + (540 - VP.y) * sc;
    x.strokeStyle = `rgba(127,233,255,${0.8 * Math.pow(0.9, i)})`; x.lineWidth = Math.max(1.2, 9 * sc);
    x.strokeRect(cx - hw + (VP.x - 960) * (1 - sc), cy - hh, hw * 2, hh * 2);
    x.fillStyle = `rgba(20,50,110,${0.06})`; x.fillRect(cx - hw + (VP.x - 960) * (1 - sc), cy - hh, hw * 2, hh * 2);
  }
  // floor + ceiling perspective lines
  x.strokeStyle = 'rgba(100,200,255,0.18)'; x.lineWidth = 1.5;
  for (let i = -10; i <= 10; i++) { x.beginPath(); x.moveTo(VP.x, VP.y); x.lineTo(VP.x + i * 260, H + 80); x.stroke(); x.beginPath(); x.moveTo(VP.x, VP.y); x.lineTo(VP.x + i * 260, -80); x.stroke(); }
  x.fillStyle = 'rgba(80,170,255,0.06)'; x.beginPath(); x.moveTo(0, H); x.lineTo(VP.x, VP.y); x.lineTo(W, H); x.closePath(); x.fill();
  HALL = c; return c;
}
function sMirror(g, lt) {
  const u = (lt - 25.278) / 4.98;
  const cam = { x: 960, y: 540, z: lerp(1.0, 1.1, u) };
  g.save(); g.translate(W / 2, H / 2); g.scale(cam.z, cam.z); g.translate(-W / 2, -H / 2);
  g.drawImage(hallBase(), 0, 0);
  // moving light sweep down the corridor
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { const q = frac(lt * 0.35 + i / 3), sc = Math.pow(0.8, q * 14); g.strokeStyle = `rgba(150,235,255,${0.22 * (1 - q)})`; g.lineWidth = 3; g.strokeRect(VP.x - 960 * sc, VP.y + (540 - VP.y) * sc - 620 * sc, 1920 * sc, 1240 * sc); }
  glow(g, VP.x, VP.y, 160, '170,230,255', 0.5);
  g.restore();
  // the hero and his echoes: each reflection lags a little more, goes smaller, bluer
  const base = { x: 520, y: 960, s: 1.15 };
  const posef = (t) => {
    const w1 = smooth((t - 26.6) / 0.25) * (1 - smooth((t - 28.2) / 0.3));
    const wv = sin(t * 12);
    const look = 0.05 + 0.04 * sin(t * 1.1);
    if (w1 > 0.01) return mkPose({ hy: -110, a1: 0.03, ah: -0.05, af: [lerp(10, 26 + 12 * wv, w1), lerp(70, -38 + 6 * Math.abs(wv), w1)], ab: [-6, 70], time: t, eg: 0.8 });
    return mkPose({ hy: -110 + sin(t * 1.5), a1: 0.04, ah: look, af: [10, 70], ab: [-6, 70], time: t, eg: 0.7 });
  };
  const N = 9;
  for (let i = N; i >= 1; i--) {
    const sc = Math.pow(0.78, i), x = lerp(base.x, VP.x, 1 - sc) + 0, y = lerp(base.y, VP.y + 120, 1 - sc) ;
    const lag = 0.28 * i, tint = clamp(0.2 + i * 0.09, 0, 0.85);
    const alpha = clamp(1 - i * 0.075, 0.25, 1);
    g.save(); g.globalAlpha = alpha;
    drawWalker(g, { x: x, y: y, s: base.s * sc * (i % 2 ? 1 : 1), facing: i % 2 ? -1 : 1, pose: posef(lt - lag), pal: palTint(tint, '#4fc8ff'), alpha: 1, shadow: false });
    g.restore();
  }
  // the real one, in front, red
  const real = drawWalker(g, { x: base.x, y: base.y, s: base.s, facing: 1, pose: posef(lt), pal: PAL_REAL, alpha: 1, shadow: false }); void real;
  g.restore();
  // dark vignette gets heavier as he realises he is the only one inside
  const dk = smooth((lt - 28.2) / 1.0) * 0.45;
  if (dk > 0) { g.save(); const gr = g.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1100); gr.addColorStop(0, 'rgba(2,6,20,0)'); gr.addColorStop(1, `rgba(2,6,20,${dk * 1.6})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); }
}

// ---------------------------------------------------------------- S9 what you see depends on what you do
function sStreet(g, lt) {
  const hxK = [[30.262, 840], [31.15, 1010], [31.4, 1020], [32.5, 1020], [33.0, 960], [34.2, 960]];
  const hx = K(hxK, lt), v = vel(hxK, lt), wk = clamp(Math.abs(v) / 110);
  const cam = { x: K([[30.262, 1040], [32.0, 1120], [34.2, 1060]], lt), y: K([[30.262, 640], [34.2, 620]], lt), z: Math.exp(K([[30.262, Math.log(1.0)], [31.6, Math.log(1.15)], [33.4, Math.log(1.55)], [34.2, Math.log(1.6)]], lt)), r: 0 };
  const tw = T0 + lt;
  drawWorld(g, cam, tw);
  const col = smooth((lt - 33.0) / 0.7);
  // hero
  let hP = POSE.walk(hx / STRIDE, wk, lt, 0.75 + 0.25 * col);
  if (lt > 32.9) hP = lerpObj(hP, mkPose({ hy: -110, a1: 0.0, a2: -0.04, ah: -0.15, af: [34, 0 + 4 * sin(lt * 8)], ab: [-6, 70], eg: 1, time: lt }), smooth((lt - 32.9) / 0.4));
  const face = lt > 32.5 && lt < 33.0 ? -1 : 1;
  withLayer(g, cam, 1, () => {
    // ghost future: runs ahead of him by 1.1 s along the same path
    const gx = K(hxK, lt + 1.1) + 150 + (lt < 31.2 ? 120 : 0);
    const gp = POSE.walk((K(hxK, lt + 1.1) + 150) / STRIDE, 0.85, lt + 1.1, 1);
    const gal = smooth((lt - 30.5) / 0.3) * (1 - smooth((lt - 31.35) / 0.12));
    if (gal > 0.01) { ghostPerson(g, gx, 826, 1, gp, 0.6 * gal); }
    // after the decision: ghost reforms facing back toward him
    const g2 = smooth((lt - 31.6) / 0.35) * (1 - smooth((lt - 33.05) / 0.25));
    if (g2 > 0.01) {
      const turnP = mkPose({ hy: -110, a1: 0.0, ah: -0.08, af: [10, 70], ab: [-6, 70], eg: 1, time: lt });
      ghostPerson(g, 1380, 826, -1, turnP, 0.55 * g2);
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(127,233,255,${0.4 * g2})`; g.lineWidth = 3; g.setLineDash([16, 16]); g.lineDashOffset = -lt * 80;
      g.beginPath(); g.moveTo(hx + 50, 840); g.quadraticCurveTo((hx + 1380) / 2, 880, 1340, 846); g.stroke(); g.restore();
    }
    person(g, hx, 826, face, hP, PAL_REAL, 1, true, 1);
    // light from his raised hand
    if (lt > 33.0) { const hj = walkerJoints({ x: hx, y: 826, s: sy(826), facing: face, pose: hP });
      g.save(); g.globalCompositeOperation = 'lighter'; glow(g, hj.handF.x, hj.handF.y, 120 + 60 * col, '127,233,255', 0.6 * col);
      for (let k = 0; k < 3; k++) { const q = frac((lt - 33.0) * 1.2 + k / 3); g.strokeStyle = `rgba(190,245,255,${0.7 * (1 - q) * col})`; g.lineWidth = 3; g.beginPath(); g.arc(hj.handF.x, hj.handF.y, 20 + q * 220, 0, TAU); g.stroke(); }
      g.restore(); }
  });
  // cold grade early, warmth returns with the colour
  visionGrade(g, 0.3 * (1 - col));
  // late: re-draw nothing; glitch on decision
  if (lt > 31.15 && lt < 31.3) rgbSplit(g, 8 * (1 - (lt - 31.15) / 0.15));
  drawForeground(g, cam, tw);
  if (lt > 33.5 && lt < 33.9) flash(g, 0.5 * Math.sin(PI * (lt - 33.5) / 0.4), '#d8f6ff');
}

// ---------------------------------------------------------------- draw
function draw(g, lt, dur) {
  let id = 'street'; for (const s of SC) if (lt >= s[0] && lt < s[1]) { id = s[2]; break; }
  const S = { room: sRoom, never: sNever, joke: sJoke, party: sParty, talk2: sTalk2, song: sSong, bye: sBye, rerun: sRerun, mirror: sMirror, street: sStreet };
  g.save();
  S[id](g, lt, dur);
  // world slowly loses its colour (S6), kept through the mirrors, returns on the street
  if (id !== 'street' && id !== 'mirror') {
    const sa = sat(lt);
    if (sa > 0.01) { g.save(); g.globalCompositeOperation = 'saturation'; g.globalAlpha = sa; g.fillStyle = '#808080'; g.fillRect(0, 0, W, H); g.restore(); }
    if (lt > 20.668 && lt < 25.278) { g.save(); g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(20,24,40,${0.28 * clamp((lt - 20.7) / 3.5)})`; g.fillRect(0, 0, W, H); g.restore(); }
  }
  g.restore();
  if (lt >= 20.668 && lt < 25.278) {
    const u = clamp((lt - 20.668) / 4.6);
    vhs(g, lt, 0.4 + 0.6 * u, 1);
    // scrub glitches: horizontal displacement bands
    const gl = (lt % 1.3) < 0.14;
    if (gl) rgbSplit(g, 5);
    // small rewind/replay marks, no text
    g.save(); g.fillStyle = `rgba(230,235,255,${0.55 * smooth((lt - 21.0) / 0.4)})`;
    const ph = Math.floor(lt * 2) % 2; const x0 = 1760, y0 = 90;
    for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(x0 + k * 34, y0); g.lineTo(x0 + k * 34 + 28, y0 - 20); g.lineTo(x0 + k * 34 + 28, y0 + 20); g.closePath(); g.globalAlpha = (k === ph ? 1 : 0.5); g.fill(); }
    g.restore();
  }
  if (id === 'mirror' || (lt > 25.2 && lt < 25.5)) { /* glitch handled by cut */ }
  // hard-cut punctuation
  [[3.7, '#cfefff'], [5.9, '#fff0d8'], [15.756, '#ffffff'], [25.278, '#bfefff'], [30.262, '#ffe8c8']].forEach((c) => { const a = lt - c[0]; if (a >= 0 && a < 0.2) flash(g, 0.3 * (1 - a / 0.2), c[1]); });
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  void dur;
}

window.CH = window.CH || {};
window.CH.ch6 = { draw: draw };
})();
