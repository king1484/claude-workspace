// ch3.js — "Reflexes" (30.852 s). Street intro -> table tennis -> boxing (+ underwater slow-mo) -> baseball -> empty stadium.
// Also exports window.ch3_kit (custom-pose stickman kit, props, fx, painted arena helpers) that ch3b.js reuses.
// Frames are pure functions of lt. No Math.random / Date.
(function () {
'use strict';
const W = 1920, H = 1080;

// =====================================================================================================
// KIT  (shared with ch3b)
// =====================================================================================================
const K = window.ch3_kit = window.ch3_kit || {};
const up = (a) => ({ x: Math.sin(a), y: -Math.cos(a) });
const nr = (a) => ({ x: Math.cos(a), y: Math.sin(a) });
const addp = (p, q, k) => { k = k == null ? 1 : k; return { x: p.x + q.x * k, y: p.y + q.y * k }; };
function ik2(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux, uy;
  if (d < 1e-6) { ux = 0; uy = 1; d = 1e-6; } else { ux = dx / d; uy = dy / d; }
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
K.ik2 = ik2; K.up = up; K.nr = nr;

// pose spec: hip offset, spine angles, feet (absolute, local), hands (offset from the shoulder joint J)
const NEUTRAL = { hx: 0, hy: 0, a1: 0.1, a2: 0.1, ah: 0, fFx: 6, fFy: 0, fFp: 0, fBx: -6, fBy: 0, fBp: 0, hFx: 9, hFy: 69, hBx: -2, hBy: 69, eo: 0, eg: 0, fl: 0, pa: 0 };
K.NEUTRAL = NEUTRAL;
K.S = (o) => Object.assign({}, NEUTRAL, o || {});
K.mix = (A, B, t) => { const r = {}; for (const k in A) r[k] = A[k] + (B[k] - A[k]) * t; return r; };
const EASE = {
  io: smooth, o: (u) => 1 - Math.pow(1 - u, 3), i: (u) => u * u * u, l: (u) => u,
  s: (u) => 1 - Math.pow(1 - u, 5),                       // snap
  b: (u) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }   // overshoot
};
// keyframe sequence: frames = [[t, overrides, ease?]], returns f(t) -> spec
K.seq = (base, frames) => {
  const F = frames.map((f) => ({ t: f[0], s: Object.assign({}, NEUTRAL, base, f[1]), e: EASE[f[2] || 'io'] }));
  return (t) => {
    if (t <= F[0].t) return F[0].s;
    for (let i = 1; i < F.length; i++) {
      if (t < F[i].t) { const u = (t - F[i - 1].t) / (F[i].t - F[i - 1].t); return K.mix(F[i - 1].s, F[i].s, F[i].e(clamp(u))); }
    }
    return F[F.length - 1].s;
  };
};

// spec -> pose object (same shape as walkerPose output) so drawWalker can render it
K.pose = (S, time) => {
  const hip = { x: S.hx, y: -112 + S.hy };
  const waist = addp(hip, up(S.a1), 32), shTop = addp(waist, up(S.a2), 36);
  const ahT = S.a2 + S.ah, headC = addp(shTop, up(ahT), 36);
  const J = addp(addp(shTop, up(S.a2), -8), nr(S.a2), -1);
  const lF = ik2(hip, { x: S.fFx, y: -7.5 - S.fFy }, 56, 56, 1), lB = ik2(hip, { x: S.fBx, y: -7.5 - S.fBy }, 56, 56, 1);
  const aF = ik2(J, { x: J.x + S.hFx, y: J.y + S.hFy }, 39, 39, -1), aB = ik2(J, { x: J.x + S.hBx, y: J.y + S.hBy }, 39, 39, -1);
  return {
    cyc: 0, w: 0, ff: time || 0, pulse: 0, hunch: clamp(S.a2 - S.a1, 0, 0.6), a1: S.a1, a2: S.a2, hip, waist, shTop, J,
    head: { x: headC.x, y: headC.y, r: 29, rot: ahT * 0.75 },
    legF: { hip, knee: lF.mid, ankle: lF.end, pitch: S.fFp }, legB: { hip, knee: lB.mid, ankle: lB.end, pitch: S.fBp },
    armF: { sh: J, elbow: aF.mid, hand: aF.end }, armB: { sh: J, elbow: aB.mid, hand: aB.end },
    phone: { amt: 0, ang: 0 }, eyeOpen: clamp(S.eo), eyeGlow: clamp(S.eg), flutter: clamp(S.fl)
  };
};
// run cycle spec (phase in cycles). amp 0..1
K.run = (ph, amp, lean) => {
  amp = amp == null ? 1 : amp; lean = lean == null ? 0.42 : lean;
  const c = Math.cos(TAU * ph), s = Math.sin(TAU * ph);
  const bob = Math.abs(c) * 6 * amp;
  const fx = 50 * s * amp, fy = 40 * Math.max(0, -c) * amp + 2, bx = -50 * s * amp, by = 40 * Math.max(0, c) * amp + 2;
  return K.S({
    hy: 10 * amp + bob, a1: lean, a2: lean + 0.08, ah: -0.1, fFx: 8 + fx, fFy: fy, fFp: -0.3 * c * amp, fBx: -8 + bx, fBy: by, fBp: 0.3 * c * amp,
    hFx: 30 * s * amp + 12, hFy: 40 - 10 * c * amp, hBx: -30 * s * amp + 12, hBy: 40 + 10 * c * amp, fl: 0.7 * amp
  });
};

// ---- palettes
K.pal = (hood, o) => {
  o = o || {};
  const P = Object.assign({}, PAL_REAL);
  P.hood = hood; P.hoodBack = mixHex(hood, '#000000', 0.22); P.hoodDark = mixHex(hood, '#000000', 0.42); P.hoodLight = mixHex(hood, '#ffffff', 0.25);
  if (o.string) P.string = o.string;
  if (o.leg) { P.leg = o.leg; P.legFar = mixHex(o.leg, '#000000', 0.4); }
  if (o.shoe) { P.shoe = o.shoe; P.shoeFar = mixHex(o.shoe, '#000000', 0.4); }
  return P;
};
K.PAL = {
  opp: null, red: null
};
// ---- figure drawing
K.fig = (g, o) => drawWalker(g, { x: o.x, y: o.y, s: o.s == null ? 1 : o.s, facing: o.facing || 1, pose: o.pose, pal: o.pal || PAL_REAL, alpha: o.alpha == null ? 1 : o.alpha, shadow: o.shadow });
K.W = (o, p) => { const f = o.facing || 1, s = o.s == null ? 1 : o.s; return { x: o.x + f * s * p.x, y: o.y + s * p.y }; };
K.dir = (o, ang) => ({ x: Math.cos(ang) * (o.facing || 1), y: Math.sin(ang) });   // local-angle -> world direction

// ---- cache
const _cv = {};
K.cv = (key, w, h, paint, scale) => {
  if (_cv[key]) return _cv[key];
  const c = document.createElement('canvas'); c.width = Math.ceil(w * (scale || 1)); c.height = Math.ceil(h * (scale || 1));
  const x = c.getContext('2d'); if (scale) x.scale(scale, scale); paint(x, w, h);
  return (_cv[key] = c);
};
const rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
function radial(g, x, y, r, stops) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (const s of stops) gr.addColorStop(s[0], s[1]);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
K.radial = radial;
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
K.rrect = rrect;

// ---- ball arcs: segs = [{t0,t1,x0,y0,x1,y1,h}], parabola with apex `h` px above the chord
K.ballAt = (segs, t) => {
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (t >= s.t0 && t < s.t1) { const u = (t - s.t0) / (s.t1 - s.t0); return { x: lerp(s.x0, s.x1, u), y: lerp(s.y0, s.y1, u) - 4 * (s.h || 0) * u * (1 - u), seg: i, u }; }
  }
  return null;
};

// ---- fx
// comic impact star. u = 0..1 progress
K.burst = (g, x, y, r, u, seed, col) => {
  if (u <= 0 || u >= 1) return;
  const sc = (0.35 + 0.65 * easeOut(clamp(u * 3))) * (1 - 0.25 * smooth((u - 0.55) / 0.45)), al = 1 - smooth((u - 0.5) / 0.5);
  const n = 11, rr = rng(seed || 3);
  g.save(); g.translate(x, y); g.rotate((seed || 0) * 0.7 + u * 0.15); g.scale(sc, sc); g.globalAlpha = al;
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = i / (n * 2) * TAU, rad = r * (i % 2 ? 0.52 : 0.85 + rr() * 0.3);
    g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  g.closePath();
  g.fillStyle = col || '#fff6d0'; g.fill();
  g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = '#14101c'; g.stroke();
  g.scale(0.62, 0.62); g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU + 0.2, rad = r * (i % 2 ? 0.55 : 0.9); g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
  g.closePath(); g.fillStyle = '#ffb347'; g.fill();
  g.restore();
};
// speed streaks flying along direction (dx,dy unit) centred at x,y, a = alpha
K.streaks = (g, x, y, dx, dy, len, a, seed, n, spread, col) => {
  if (a <= 0.01) return;
  const r = rng(seed || 5), px = -dy, py = dx;
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let i = 0; i < (n || 10); i++) {
    const off = (r() - 0.5) * (spread || 120), l = len * (0.4 + r() * 0.6), sh = (r() - 0.3) * len * 0.4;
    const cx = x + px * off + dx * sh, cy = y + py * off + dy * sh;
    const gr = g.createLinearGradient(cx - dx * l, cy - dy * l, cx, cy);
    gr.addColorStop(0, 'rgba(255,230,200,0)'); gr.addColorStop(1, (col || 'rgba(255,240,215,') + (0.55 * a) + ')');
    g.strokeStyle = gr; g.lineWidth = 2 + r() * 3;
    g.beginPath(); g.moveTo(cx - dx * l, cy - dy * l); g.lineTo(cx, cy); g.stroke();
  }
  g.restore();
};
// cyan dotted ghost path; pts(u)->{x,y}, drawn up to progress `prog` (0..1), n dots, size r
K.dotPath = (g, pts, prog, n, r, a, time) => {
  if (prog <= 0 || a <= 0.01) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  const m = Math.floor(n * clamp(prog));
  for (let i = 0; i <= m; i++) {
    const u = i / n, p = pts(u), pul = 0.6 + 0.4 * Math.sin((time || 0) * 9 - i * 0.7);
    radial(g, p.x, p.y, r * 2.6, [[0, 'rgba(127,233,255,' + (0.5 * a * pul) + ')'], [1, 'rgba(127,233,255,0)']]);
    g.fillStyle = 'rgba(225,252,255,' + (0.95 * a) + ')'; g.beginPath(); g.arc(p.x, p.y, r * (0.7 + 0.3 * pul), 0, TAU); g.fill();
  }
  g.restore();
};
// target ring (ellipse in ground plane when ry<rx)
K.ring = (g, x, y, rx, ry, a, time, k) => {
  if (a <= 0.01) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y);
  for (let i = 0; i < 3; i++) {
    const u = ((time * 0.9 + i / 3) % 1), sc = 0.35 + 0.9 * u, al = a * (1 - u) * 0.9;
    g.strokeStyle = 'rgba(150,240,255,' + al + ')'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, 0, rx * sc, ry * sc, 0, 0, TAU); g.stroke();
  }
  g.strokeStyle = 'rgba(230,252,255,' + (0.95 * a) + ')'; g.lineWidth = 3.5; g.setLineDash([rx * 0.22, rx * 0.14]); g.lineDashOffset = -time * 40;
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke(); g.setLineDash([]);
  radial(g, 0, 0, rx * 0.6, [[0, 'rgba(120,230,255,' + (0.32 * a) + ')'], [1, 'rgba(120,230,255,0)']]);
  g.restore();
};
// puffs of dust / smoke: n puffs rising from (x,y), u 0..1
K.puffs = (g, x, y, u, n, size, seed, col, spreadX) => {
  if (u <= 0 || u >= 1) return;
  const r = rng(seed || 9); g.save();
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, sp = (0.4 + r() * 0.8) * (spreadX || 60), sz = size * (0.5 + r() * 0.8);
    const e = easeOut(u), px = x + Math.cos(a) * sp * e, py = y + Math.sin(a) * sp * 0.45 * e - 24 * e * (0.5 + r());
    radial(g, px, py, sz * (0.6 + 0.9 * e), [[0, (col || 'rgba(255,214,180,') + (0.5 * (1 - u)) + ')'], [1, (col || 'rgba(255,214,180,') + '0)']]);
  }
  g.restore();
};
// orbiting stars (KO) around (x,y)
K.stars = (g, x, y, rx, time, n, size) => {
  g.save();
  for (let i = 0; i < n; i++) {
    const a = time * 4 + i / n * TAU, px = x + Math.cos(a) * rx, py = y + Math.sin(a) * rx * 0.28;
    g.save(); g.translate(px, py); g.rotate(time * 3 + i); g.scale(1, 1);
    g.beginPath(); for (let k = 0; k < 10; k++) { const aa = k / 10 * TAU - Math.PI / 2, rr = k % 2 ? size * 0.42 : size; g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
    g.closePath(); g.fillStyle = '#ffd84a'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#14101c'; g.lineJoin = 'round'; g.stroke(); g.restore();
  }
  g.restore();
};
// white bars across screen for whip transitions
K.whip = (g, a, dir, seed) => {
  if (a <= 0.01) return;
  const r = rng(seed || 4); g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const y = r() * H, hh = 8 + r() * 70, l = 700 + r() * 1100, x = r() * W;
    const gr = g.createLinearGradient(x - dir * l, 0, x, 0);
    gr.addColorStop(0, 'rgba(255,225,190,0)'); gr.addColorStop(1, 'rgba(255,235,205,' + (0.28 * a) + ')');
    g.fillStyle = gr; g.fillRect(Math.min(x - dir * l, x), y, l, hh);
  }
  g.restore();
};

// ---- props (world coordinates)
K.paddle = (g, hand, ang, sc) => {
  sc = sc || 1; const d = { x: Math.cos(ang), y: Math.sin(ang) };
  g.save(); g.translate(hand.x, hand.y); g.rotate(ang); g.scale(sc, sc);
  g.fillStyle = '#a9743f'; rrect(g, -4, -4.5, 40, 9, 4); g.fill();
  g.strokeStyle = '#14101c'; g.lineWidth = 2; g.stroke();
  g.translate(62, 0);
  g.beginPath(); g.ellipse(0, 0, 33, 30, 0, 0, TAU);
  const gr = g.createRadialGradient(-8, -8, 4, 0, 0, 34); gr.addColorStop(0, '#ff6a5a'); gr.addColorStop(1, '#c82a35');
  g.fillStyle = gr; g.fill(); g.lineWidth = 4; g.strokeStyle = '#14101c'; g.stroke();
  g.strokeStyle = 'rgba(255,200,150,0.7)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 26, -1.2, 0.2); g.stroke();
  g.restore();
};
K.ball = (g, x, y, r, glow, col) => {
  if (glow) radial(g, x, y, r * 4, [[0, 'rgba(255,225,170,' + (0.45 * glow) + ')'], [1, 'rgba(255,200,140,0)']]);
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, col || '#ffd9a0');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.lineWidth = 1.6; g.strokeStyle = 'rgba(20,10,30,0.7)'; g.stroke();
};
// boxing glove at hand (world), pointing along ang
K.glove = (g, hand, ang, col, sc) => {
  sc = sc || 1; g.save(); g.translate(hand.x, hand.y); g.rotate(ang); g.scale(sc, sc);
  g.beginPath(); g.ellipse(14, 0, 26, 21, 0, 0, TAU);
  const gr = g.createRadialGradient(8, -9, 3, 14, 0, 30); gr.addColorStop(0, mixHex(col, '#ffffff', 0.45)); gr.addColorStop(0.5, col); gr.addColorStop(1, mixHex(col, '#000000', 0.45));
  g.fillStyle = gr; g.fill(); g.lineWidth = 3.5; g.strokeStyle = '#14101c'; g.stroke();
  g.fillStyle = '#f2ead8'; rrect(g, -9, -14, 14, 28, 4); g.fill(); g.lineWidth = 3; g.stroke();
  g.strokeStyle = 'rgba(255,190,130,0.8)'; g.lineWidth = 2.5; g.beginPath(); g.arc(14, 0, 22, -1.0, 0.3); g.stroke();
  g.restore();
};

// =====================================================================================================
// TIMELINE (local seconds). cues are generated from this block by ch3.build_cues.mjs
// =====================================================================================================
// @T-BEGIN
const T = {
  dur: 30.852,
  s0End: 2.45, ttEnd: 8.2, boxEnd: 16.9, bbEnd: 24.0,
  // street intro
  stop: 1.35, eyes: 1.5, pop: 1.9, cut0: 2.3,
  // table tennis
  tt: { lob: 3.0, land1: 3.62, wind: 3.75, smash: 4.55, ghost0: 4.0, bounce: 4.95, block: 5.25, bounce2: 5.7, whiff: 5.9, floor1: 6.35, floor2: 6.9 },
  // boxing (fight-time == local time until uw)
  bx: { bell: 8.45, uw: 13.634, clk0: 11.35, clk1: 12.9, punch: [10.15, 11.35, 11.72, 12.08], counter: 12.45, slowPunch: 14.88 },
  // baseball
  bb: { whip: 16.9, ghost0: 18.3, wind: 20.2, rel: 21.0, arr: 21.43, tilt: 21.43, pop: 21.5, ump: 22.0, bored: 22.8 },
  // finale
  fin: { v1: 24.15, v2: 25.45, v3: 26.75, drop: 24.55, kick: 25.65, throw: 26.85, empty: 28.3 }
};
// @T-END
K.T3 = T;

if (!window.CH) window.CH = {};
function hasRigs() { return typeof drawWalker === 'function' && typeof drawWorld === 'function'; }

// @SHOTS-BEGIN
// ---------------------------------------------------------------------------------------------------
// shared painted bits
// ---------------------------------------------------------------------------------------------------
const HERO_PAL = PAL_REAL;
const PAL_YEL = K.pal('#f2c230'), PAL_BLU = K.pal('#3a6fe0'), PAL_GRN = K.pal('#2fb59a'), PAL_PUR = K.pal('#8a4fd8');
const camBase = (x, y, z, r) => ({ x: x == null ? 960 : x, y: y == null ? 540 : y, z: z == null ? 1 : z, r: r || 0 });
function shake(cam, t, t0, amp, decay) { const s = shakeAt(t, t0, amp, decay); cam.x += s.x; cam.y += s.y; cam.r += s.r; }
function camTransform(g, cam) { if (cam.r) { g.translate(W / 2, H / 2); g.rotate(cam.r); g.translate(-W / 2, -H / 2); } }
function dustMotes(g, t, n, seed, a) {
  g.save(); g.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const x = ((hash1(i * 3 + seed) * (W + 200) + t * (8 + hash1(i + seed + 40) * 14)) % (W + 200)) - 100;
    const y = ((hash1(i * 3 + seed + 1) * (H + 200) - t * (5 + hash1(i + seed + 70) * 8)) % (H + 200) + (H + 200)) % (H + 200) - 100;
    const al = a * (0.3 + 0.3 * Math.sin(t * 1.2 + i * 2.3)), s = 1.5 + hash1(i + seed + 9) * 2.5;
    radial(g, x, y, s * 3, [[0, 'rgba(255,214,160,' + al + ')'], [1, 'rgba(255,170,110,0)']]);
  }
  g.restore();
}

// ---------------------------------------------------------------------------------------------------
// S0  street intro  (0 .. 2.45)
// ---------------------------------------------------------------------------------------------------
function s0(g, lt) {
  const t = lt, x0 = 480, v = 150;
  const mv = Math.min(t, T.stop);
  const x = x0 + v * mv + 10 * smooth((t - T.stop) / 0.25);
  const walk = clamp(1 - (t - T.stop + 0.02) / 0.14);
  const gl = clamp(spring(t - T.eyes, 200, 22)), pop = clamp(spring(t - T.pop, 150, 14));
  const c = { x, walk, phone: 0, headDown: 0, lean: lerp(0.1, 0.03, smooth((t - T.stop) / 0.3)), bob: 1, eyeOpen: 1, eyeGlow: 0.25 + 0.7 * gl, flutter: 0.5 * win(t, T.pop - 0.1, T.pop + 0.8, 0.1, 0.5) + 0.2 * walk, step: 0 };
  c.phase = (x / STRIDE) * PHASE_UNIT;
  const cam = camBase(850 + 0.3 * (x - 850) + 30 * smooth((t - T.pop) / 0.4), 612, 1.0 + 0.05 * (t / 2.4) + 0.12 * pop, 0);
  shake(cam, t, T.pop, 8, 9);
  g.save(); camTransform(g, cam);
  drawWorld(g, cam, t);
  const hero = () => withLayer(g, cam, 1, () => drawWalker(g, walkerSt(c)));
  const vg = 0.55 * win(t, T.pop - 0.05, T.pop + 0.6, 0.1, 0.4);
  if (vg > 0.01) { visionGrade(g, vg); }
  hero();
  // pulse ring from the head
  const hd = walkerJoints(walkerSt(c)).head, sp = project(cam, hd.x, hd.y, 1);
  const ru = (t - T.pop) / 0.7;
  if (ru > 0 && ru < 1) {
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(140,235,255,' + (0.8 * (1 - ru)) + ')'; g.lineWidth = 6 * (1 - ru) + 1.5;
    g.beginPath(); g.arc(sp.x, sp.y, 40 + 520 * easeOut(ru), 0, TAU); g.stroke(); g.restore();
  }
  drawForeground(g, cam, t);
  g.restore();
  // whip out
  const wo = smooth((t - 2.12) / 0.3);
  K.whip(g, wo, 1, 11);
  flash(g, smooth((t - 2.28) / 0.17) * 0.95);
}

// ---------------------------------------------------------------------------------------------------
// HALL (table tennis) — cached painted layers
// ---------------------------------------------------------------------------------------------------
const FLOOR_Y = 836, HALL_HORIZON = 772;
function hallWall() {
  return K.cv('hallWall', 2800, 900, (c) => {
    c.translate(400, 0);
    let gr = c.createLinearGradient(0, 0, 0, 800);
    gr.addColorStop(0, '#120a28'); gr.addColorStop(0.4, '#2a1750'); gr.addColorStop(0.72, '#5a2b62'); gr.addColorStop(1, '#a04a62');
    c.fillStyle = gr; c.fillRect(-400, 0, 2800, 800);
    // roof trusses
    c.strokeStyle = 'rgba(8,4,20,0.8)'; c.lineWidth = 10;
    for (let i = -2; i < 12; i++) { c.beginPath(); c.moveTo(i * 220 - 40, 0); c.lineTo(i * 220 + 90, 70); c.lineTo(i * 220 + 220, 0); c.stroke(); }
    c.fillStyle = 'rgba(8,4,20,0.85)'; c.fillRect(-400, 0, 2800, 26);
    // tall dusk windows
    for (let i = 0; i < 7; i++) {
      const x = 60 + i * 290, y = 110, w = 170, h = 270;
      gr = c.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, '#5a2a78'); gr.addColorStop(0.5, '#e0587a'); gr.addColorStop(1, '#ffc27a');
      radial(c, x + w / 2, y + h * 0.55, 230, [[0, 'rgba(255,170,110,0.22)'], [1, 'rgba(255,150,100,0)']]);
      c.fillStyle = gr; c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(255,230,190,0.5)'; c.beginPath(); c.arc(x + 118, y + h * 0.78, 20, 0, TAU); c.fill();
      c.strokeStyle = '#150b26'; c.lineWidth = 9; c.strokeRect(x, y, w, h);
      c.lineWidth = 6; c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h * 0.4); c.lineTo(x + w, y + h * 0.4); c.moveTo(x, y + h * 0.72); c.lineTo(x + w, y + h * 0.72); c.stroke();
      c.fillStyle = 'rgba(255,170,110,0.55)'; c.fillRect(x + w - 6, y, 6, h);
    }
    // pennant strings
    for (let row = 0; row < 2; row++) {
      const yb = 430 + row * 40, cols = ['#ff7a4a', '#3fd0c0', '#ffd23f', '#a46bff', '#ff5a8a'];
      c.strokeStyle = 'rgba(10,5,22,0.8)'; c.lineWidth = 2; c.beginPath();
      for (let x = -400; x <= 2400; x += 40) { const y = yb + 26 * Math.sin((x + row * 90) / 300 * Math.PI); x === -400 ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.stroke();
      for (let x = -400; x <= 2400; x += 40) {
        const y = yb + 26 * Math.sin((x + row * 90) / 300 * Math.PI);
        c.fillStyle = cols[((x / 40) + row * 2 + 100) % 5 | 0]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 28, y + 2); c.lineTo(x + 14, y + 36); c.closePath(); c.fill();
      }
    }
    // lower wall panels
    c.fillStyle = 'rgba(12,6,28,0.35)'; c.fillRect(-400, 560, 2800, 240);
    for (let x = -400; x < 2400; x += 130) { c.fillStyle = 'rgba(255,150,100,0.06)'; c.fillRect(x, 560, 4, 240); }
    // spectators behind barriers
    const r = rng(41);
    for (let i = 0; i < 40; i++) {
      const x = -300 + i * 70 + r() * 30, y = 690 + r() * 20, s = 0.9 + r() * 0.4, tone = r() < 0.5 ? '#1b0f30' : '#241338';
      c.fillStyle = tone; c.beginPath(); c.arc(x, y - 36 * s, 14 * s, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(x - 24 * s, y + 40); c.quadraticCurveTo(x - 22 * s, y - 14 * s, x, y - 18 * s); c.quadraticCurveTo(x + 22 * s, y - 14 * s, x + 24 * s, y + 40); c.fill();
      c.fillStyle = 'rgba(255,160,110,0.5)'; c.fillRect(x + 12 * s, y - 40 * s, 3, 20 * s);
      if (r() < 0.25) { c.fillStyle = ['#ff7a4a', '#3fd0c0', '#ffd23f'][(r() * 3) | 0]; c.fillRect(x + 20 * s, y - 20 * s, 8, 11); }
    }
    // barrier boards
    for (let x = -400; x < 2400; x += 260) {
      gr = c.createLinearGradient(0, 718, 0, 790); gr.addColorStop(0, '#2c4cb0'); gr.addColorStop(1, '#16255e');
      c.fillStyle = gr; c.fillRect(x + 4, 718, 252, 72);
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(x + 4, 724, 252, 5);
      c.fillStyle = 'rgba(255,170,110,0.6)'; c.fillRect(x + 250, 718, 6, 72);
      c.fillStyle = '#0c1438'; c.fillRect(x + 4, 790, 252, 12);
    }
  });
}
function hallFloor() {
  return K.cv('hallFloor', 3000, 800, (c) => {
    c.translate(500, -HALL_HORIZON + 40);
    let gr = c.createLinearGradient(0, HALL_HORIZON, 0, 1500);
    gr.addColorStop(0, '#8a3f50'); gr.addColorStop(0.18, '#c0603f'); gr.addColorStop(0.5, '#7a3030'); gr.addColorStop(1, '#2a1028');
    c.fillStyle = gr; c.fillRect(-500, HALL_HORIZON, 3000, 800);
    c.strokeStyle = 'rgba(30,8,28,0.28)'; c.lineWidth = 2;
    for (let xi = -1800; xi < 3800; xi += 150) { c.beginPath(); c.moveTo(960 + (xi - 960) * 0.45, HALL_HORIZON); c.lineTo(960 + (xi - 960) * 2.1, 1500); c.stroke(); }
    for (let i = 0; i < 14; i++) { const y = HALL_HORIZON + Math.pow(i / 13, 1.7) * 700; c.beginPath(); c.moveTo(-500, y); c.lineTo(2500, y); c.stroke(); }
    // court lines
    c.strokeStyle = 'rgba(255,240,220,0.32)'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(-200, 1010); c.lineTo(2100, 1010); c.stroke();
    // lamp pools + glossy reflections
    for (let i = 0; i < 4; i++) {
      const x = 240 + i * 480;
      radial(c, x, 880, 380, [[0, 'rgba(255,190,120,0.34)'], [0.6, 'rgba(255,150,100,0.1)'], [1, 'rgba(255,130,90,0)']]);
      gr = c.createLinearGradient(0, 800, 0, 1120); gr.addColorStop(0, 'rgba(255,225,170,0.22)'); gr.addColorStop(1, 'rgba(255,200,150,0)');
      c.fillStyle = gr; c.fillRect(x - 10, 800, 20, 320);
    }
    // wall base shadow
    gr = c.createLinearGradient(0, HALL_HORIZON, 0, HALL_HORIZON + 60); gr.addColorStop(0, 'rgba(12,5,24,0.55)'); gr.addColorStop(1, 'rgba(12,5,24,0)');
    c.fillStyle = gr; c.fillRect(-500, HALL_HORIZON, 3000, 60);
  });
}
function drawHall(g, cam, t) {
  const wall = hallWall(), floor = hallFloor();
  withLayer(g, cam, 0.7, () => { g.drawImage(wall, -400, 0); });
  // hanging lamps (additive light cones)
  withLayer(g, cam, 0.85, () => {
    g.save();
    for (let i = 0; i < 4; i++) {
      const x = 240 + i * 480, sw = Math.sin(t * 0.8 + i) * 3;
      g.fillStyle = '#0d0618'; g.fillRect(x - 1.5, 0, 3, 120);
      g.save(); g.translate(x + sw, 120); g.fillStyle = '#17102a'; g.beginPath(); g.moveTo(-46, 0); g.lineTo(46, 0); g.lineTo(26, -34); g.lineTo(-26, -34); g.closePath(); g.fill();
      g.fillStyle = '#ffe2a8'; g.beginPath(); g.ellipse(0, 1, 40, 6, 0, 0, TAU); g.fill();
      g.globalCompositeOperation = 'screen';
      const gr = g.createLinearGradient(0, 0, 0, 700); gr.addColorStop(0, 'rgba(255,200,130,0.26)'); gr.addColorStop(1, 'rgba(255,170,110,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(-40, 2); g.lineTo(40, 2); g.lineTo(230, 700); g.lineTo(-230, 700); g.closePath(); g.fill();
      radial(g, 0, 8, 120, [[0, 'rgba(255,214,150,0.5)'], [1, 'rgba(255,190,130,0)']]);
      g.restore();
    }
    g.restore();
  });
  withLayer(g, cam, 1, () => { g.drawImage(floor, -500, HALL_HORIZON - 40); });
}

// ---------------------------------------------------------------------------------------------------
// S1  table tennis  (2.45 .. 8.2)
// ---------------------------------------------------------------------------------------------------
const TT = { x0: 520, x1: 1400, top: 704, back: 688, net: 960, netH: 38 };
const TT_S = 1.1;
const ttHeroX = (t) => 450 + 40 * smooth((t - 3.85) / 0.9);
const ttOppX = (t) => 1470 - 50 * smooth((t - 5.55) / 0.2) + 40 * smooth((t - 5.9) / 0.5);
const ttHero = K.seq({ hy: 14, a1: 0.2, a2: 0.3, ah: -0.1, fFx: 24, fBx: -24, hFx: 40, hFy: 44, hBx: 6, hBy: 60, eo: 1, eg: 0.25, pa: -0.55, fl: 0.2 }, [
  [0, {}],
  [2.75, { hFx: 22, hFy: 36, a2: 0.4, pa: -1.1 }, 'io'],
  [3.0, { hFx: 58, hFy: -14, a2: 0.28, a1: 0.3, pa: -0.5, hy: 24 }, 's'],
  [3.35, { hFx: 40, hFy: 44, pa: -0.55 }, 'io'],
  [3.9, { hFx: 34, hFy: 52, hBx: 4, hBy: 56, a2: 0.22, ah: -0.22, hy: 8, pa: -0.8 }, 'io'],
  [4.8, { hFx: 40, hFy: 50, a1: 0.28, a2: 0.34, ah: -0.2, hy: 22, fFx: 30, fBx: -30, pa: -0.4 }, 'io'],
  [5.2, { hFx: 60, hFy: 22, a1: 0.32, a2: 0.4, hy: 26, pa: -0.1 }, 'io'],
  [5.25, { hFx: 66, hFy: 18, pa: 0.0 }, 's'],
  [5.75, { hFx: 36, hFy: 56, a1: 0.14, a2: 0.2, ah: -0.05, hy: 8, hBx: 8, hBy: 58, pa: -0.9 }, 'io'],
  [6.5, { hFx: 36, hFy: 56, hBx: 28, hBy: 40, a2: 0.12, a1: 0.1, ah: 0.05, hy: 0, pa: -1.2, fFx: 14, fBx: -14 }, 'io'],
  [7.1, { hFx: 56, hFy: 40, hBx: 52, hBy: 40, a2: 0.12, a1: 0.1, ah: 0.05, hy: 0, pa: -1.0, fFx: 14, fBx: -14 }, 'io'],
  [8.3, { hFx: 56, hFy: 40, hBx: 52, hBy: 40 }, 'io']
]);
const ttOpp = K.seq({ hy: 12, a1: 0.22, a2: 0.28, ah: -0.08, fFx: 22, fBx: -24, hFx: 40, hFy: 46, hBx: 4, hBy: 58, pa: -0.55, fl: 0.2 }, [
  [0, {}],
  [3.45, { hFx: 32, hFy: 20, a2: 0.2, hy: 6, pa: -0.9 }, 'io'],
  [3.8, { hFx: -30, hFy: -40, hBx: 38, hBy: -10, a1: -0.04, a2: -0.18, ah: 0.1, hy: 16, fFx: 30, fBx: -34, pa: -2.6 }, 'io'],
  [4.32, { hFx: -42, hFy: -46, hBx: 46, hBy: -16, a1: -0.12, a2: -0.3, hy: 30, fFy: 6, fBy: 6, pa: -2.9 }, 'io'],
  [4.5, { hFx: 20, hFy: -62, hBx: 34, hBy: 6, a1: 0.05, a2: 0.0, hy: -2, fFy: 22, fBy: 18, fFx: 14, fBx: -14, pa: -1.2 }, 'i'],
  [4.55, { hFx: 52, hFy: -60, hBx: 12, hBy: 20, a1: 0.25, a2: 0.4, ah: 0.05, hy: 2, fFy: 26, fBy: 20, pa: 0.2 }, 's'],
  [4.95, { hFx: 70, hFy: 38, hBx: -8, hBy: 40, a1: 0.45, a2: 0.62, hy: 22, fFy: 0, fBy: 0, fFx: 28, fBx: -22, pa: 0.5 }, 'o'],
  [5.5, { hFx: 40, hFy: 40, a1: 0.3, a2: 0.4, hy: 18, pa: -0.2 }, 'io'],
  [5.75, { hFx: 62, hFy: 30, a1: 0.5, a2: 0.7, ah: 0.1, hy: 30, fFx: 40, fBx: -16, pa: 0.0 }, 'o'],
  [5.95, { hFx: 70, hFy: 36, a1: 0.55, a2: 0.78, hy: 28, pa: 0.4 }, 's'],
  [6.5, { hFx: 30, hFy: 66, hBx: 20, hBy: 66, a1: 0.35, a2: 0.75, ah: 0.35, hy: 16, fFx: 18, fBx: -18, pa: 1.0 }, 'io'],
  [7.2, { hFx: 14, hFy: 70, hBx: 10, hBy: 70, a1: 0.3, a2: 0.95, ah: 0.5, hy: 10, fFx: 12, fBx: -12, pa: 1.3 }, 'io'],
  [8.3, { a1: 0.3, a2: 0.95, ah: 0.5 }, 'io']
]);
const ttHeroO = (t) => ({ x: ttHeroX(t), y: FLOOR_Y, s: TT_S, facing: 1 });
const ttOppO = (t) => ({ x: ttOppX(t), y: FLOOR_Y, s: TT_S, facing: -1 });
function ttBlade(seq, t, O) {
  const sp = seq(t), P = K.pose(sp, t), h = K.W(O, P.armF.hand), a = O.facing === 1 ? sp.pa : Math.PI - sp.pa;
  return { x: h.x + Math.cos(a) * 62 * TT_S, y: h.y + Math.sin(a) * 62 * TT_S };
}
const TTBALL = (() => {
  const t = T.tt, bt = 693;
  const cL = ttBlade(ttHero, t.lob, ttHeroO(t.lob)), cS = ttBlade(ttOpp, t.smash, ttOppO(t.smash)), cB = ttBlade(ttHero, t.block, ttHeroO(t.block));
  K.ttContacts = { lob: cL, smash: cS, block: cB };
  return [
    { t0: 2.0, t1: 2.65, x0: 1330, y0: 628, x1: 880, y1: bt, h: 70 },
    { t0: 2.65, t1: t.lob, x0: 880, y0: bt, x1: cL.x, y1: cL.y, h: 55 },
    { t0: t.lob, t1: t.land1, x0: cL.x, y0: cL.y, x1: 1160, y1: bt, h: 300 },
    { t0: t.land1, t1: t.smash, x0: 1160, y0: bt, x1: cS.x, y1: cS.y, h: 210 },
    { t0: t.smash, t1: t.bounce, x0: cS.x, y0: cS.y, x1: 800, y1: bt, h: 16 },
    { t0: t.bounce, t1: t.block, x0: 800, y0: bt, x1: cB.x, y1: cB.y, h: 34 },
    { t0: t.block, t1: t.bounce2, x0: cB.x, y0: cB.y, x1: 1250, y1: bt, h: 70 },
    { t0: t.bounce2, t1: t.floor1, x0: 1250, y0: bt, x1: 1700, y1: 828, h: 90 },
    { t0: t.floor1, t1: t.floor2, x0: 1700, y0: 828, x1: 1800, y1: 828, h: 52 },
    { t0: t.floor2, t1: 7.35, x0: 1800, y0: 828, x1: 1860, y1: 828, h: 26 },
    { t0: 7.35, t1: 7.6, x0: 1860, y0: 828, x1: 1900, y1: 828, h: 10 }
  ];
})();

function drawTable(g, t) {
  g.save();
  g.translate(960, 846); g.scale(1, 0.12); radial(g, 0, 0, 560, [[0, 'rgba(10,4,20,0.6)'], [0.7, 'rgba(10,4,20,0.25)'], [1, 'rgba(10,4,20,0)']]);
  g.restore();
  [560, 1360].forEach((lx) => {
    g.fillStyle = '#9d96b4'; g.fillRect(lx - 6, TT.top + 12, 12, 118);
    g.fillStyle = 'rgba(255,170,110,0.9)'; g.fillRect(lx + 3, TT.top + 12, 3, 118);
    g.fillStyle = '#6a6486'; g.fillRect(lx - 22, 826, 44, 8);
  });
  g.fillStyle = '#5b5578'; g.fillRect(560, 790, 800, 7);
  let gr = g.createLinearGradient(0, TT.back, 0, TT.top);
  gr.addColorStop(0, '#2a66d0'); gr.addColorStop(1, '#1a3f96');
  g.fillStyle = gr; g.beginPath(); g.moveTo(TT.x0 + 40, TT.back); g.lineTo(TT.x1 - 40, TT.back); g.lineTo(TT.x1, TT.top); g.lineTo(TT.x0, TT.top); g.closePath(); g.fill();
  g.save(); g.clip(); g.globalCompositeOperation = 'screen';
  gr = g.createLinearGradient(700, 0, 1180, 0); gr.addColorStop(0, 'rgba(255,170,120,0)'); gr.addColorStop(0.5, 'rgba(255,190,140,0.22)'); gr.addColorStop(1, 'rgba(255,170,120,0)');
  g.fillStyle = gr; g.fillRect(TT.x0, TT.back, 880, 20); g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(TT.x0 + 40, TT.back); g.lineTo(TT.x1 - 40, TT.back); g.moveTo(TT.x0, TT.top); g.lineTo(TT.x1, TT.top); g.stroke();
  g.beginPath(); g.moveTo(TT.net, TT.back); g.lineTo(TT.net, TT.top); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.45)'; g.stroke();
  g.fillStyle = '#10102e'; g.fillRect(TT.x0, TT.top, 880, 14);
  g.fillStyle = 'rgba(255,170,110,0.85)'; g.fillRect(TT.x0, TT.top, 880, 2.5);
  g.fillStyle = '#0a0a20'; g.fillRect(TT.x0, TT.top + 11, 880, 3);
  const nt = TT.top - TT.netH;
  g.fillStyle = 'rgba(235,235,250,0.18)'; g.fillRect(TT.net - 3, nt, 6, TT.netH + 10);
  g.strokeStyle = 'rgba(235,235,250,0.6)'; g.lineWidth = 1; g.beginPath();
  for (let i = 0; i < 5; i++) { const yy = nt + 3 + i * 7.5; g.moveTo(TT.net - 2, yy); g.lineTo(TT.net + 2, yy); }
  g.stroke();
  g.fillStyle = '#f5f5ff'; g.fillRect(TT.net - 4, nt - 3, 8, 5);
  g.fillStyle = '#6a6486'; g.fillRect(TT.net - 5, nt - 5, 3, TT.netH + 17);
}

function fgBottle(key) {
  return K.cv(key, 420, 420, (x) => {
    x.filter = 'blur(7px)';
    // towel on a bench + bottle
    x.fillStyle = '#0a0614'; rrect(x, 30, 250, 360, 70, 24); x.fill();
    x.fillStyle = '#1a0f2c'; rrect(x, 70, 200, 190, 70, 30); x.fill();
    x.fillStyle = 'rgba(255,150,100,0.55)'; x.fillRect(250, 210, 6, 60);
    let gr = x.createLinearGradient(290, 0, 350, 0); gr.addColorStop(0, '#16102e'); gr.addColorStop(1, '#2a1c4a');
    x.fillStyle = gr; rrect(x, 290, 60, 62, 200, 22); x.fill();
    x.fillStyle = '#0a0614'; rrect(x, 304, 30, 34, 40, 8); x.fill();
    x.fillStyle = 'rgba(255,170,110,0.7)'; x.fillRect(346, 80, 5, 170);
  });
}

function s1(g, lt) {
  const t = lt, tt = T.tt;
  const cx = 960 + 40 * smooth((t - 3.0) / 1.5) - 80 * smooth((t - 4.6) / 0.7) + 50 * smooth((t - 6.4) / 1.4), cy = 688 - 24 * smooth((t - 6.2) / 1.6);
  const cz = 1.3 + 0.07 * smooth((t - 2.45) / 2.0) + 0.06 * smooth((t - 4.4) / 0.9) + 0.14 * smooth((t - 6.6) / 1.5);
  const cam = camBase(cx, cy, cz, 0);
  shake(cam, t, tt.smash, 20, 8); shake(cam, t, tt.block, 9, 10);
  cam.z *= 1 + 0.025 * Math.exp(-(t - tt.smash) * 7) * (t >= tt.smash ? 1 : 0);
  g.save(); camTransform(g, cam);
  drawHall(g, cam, t);

  const heroO = ttHeroO(t), oppO = ttOppO(t);
  const oppHop = (t > 4.3 && t < 4.72) ? -30 * Math.sin(Math.PI * clamp((t - 4.3) / 0.42)) : 0;
  let hs = ttHero(t), os = ttOpp(t);
  const sw = Math.sin(t * 5.2);
  hs = Object.assign({}, hs); os = Object.assign({}, os);
  hs.hy += sw * 1.1; os.hy += Math.sin(t * 5.2 + 1) * 1.1;
  const hp = K.pose(hs, t), op = K.pose(os, t);
  withLayer(g, cam, 1, () => {
    K.fig(g, Object.assign({}, oppO, { pose: op, pal: PAL_YEL, y: FLOOR_Y + oppHop, shadow: !oppHop }));
    if (oppHop) { g.save(); g.translate(oppO.x, FLOOR_Y + 2); g.scale(1, 0.12); radial(g, 0, 0, 80 + oppHop * 0.8, [[0, 'rgba(10,4,20,0.5)'], [1, 'rgba(10,4,20,0)']]); g.restore(); }
    drawTable(g, t);
    const hw = K.W(heroO, hp.armF.hand), ow = K.W(Object.assign({}, oppO, { y: FLOOR_Y + oppHop }), op.armF.hand);
    K.fig(g, Object.assign({}, heroO, { pose: hp, pal: HERO_PAL }));
    K.paddle(g, hw, hs.pa, TT_S);
    g.fillStyle = '#14101c'; g.beginPath(); g.arc(hw.x, hw.y, 8, 0, TAU); g.fill();
    K.paddle(g, ow, Math.PI - os.pa, TT_S);
    g.fillStyle = '#14101c'; g.beginPath(); g.arc(ow.x, ow.y, 8, 0, TAU); g.fill();

    const b = K.ballAt(TTBALL, t);
    if (b) {
      if (b.seg === 4) K.streaks(g, b.x, b.y, 0.97, -0.2, 240, 0.9, 7, 6, 14);
      K.ball(g, b.x, b.y, 9, b.seg === 4 ? 1 : 0.55);
    }
    const cS = K.ttContacts.smash;
    K.burst(g, cS.x - 6, cS.y, 62, (t - tt.smash) / 0.4, 5);
    K.burst(g, 800, 688, 34, (t - tt.bounce) / 0.3, 9, '#fff0c0');

    // vision layer: dotted ball path, landing ring, ghost hero where he is about to stand
    const ga = (1 - smooth((t - tt.block - 0.35) / 0.25)) * smooth((t - tt.ghost0) / 0.2), gp = clamp((t - tt.ghost0) / 0.5);
    if (ga > 0.01) {
      const pts = (u) => K.ballAt(TTBALL, lerp(tt.smash, tt.block, u * 0.999)) || { x: 0, y: 0 };
      K.dotPath(g, pts, gp, 34, 3.6, ga, t);
      K.ring(g, 800, 697, 52, 12, ga, t);
      const gs = ttHero(tt.block), gpz = K.pose(gs, t), gO = ttHeroO(tt.block);
      const gAl = 0.55 * ga * (1 - smooth((t - 4.95) / 0.3));
      if (gAl > 0.02) K.fig(g, Object.assign({}, gO, { pose: gpz, pal: palGhost(gAl), alpha: 1 }));
    }
    K.puffs(g, oppO.x, FLOOR_Y, (t - 4.72) / 0.6, 4, 24, 3, 'rgba(255,200,160,', 50);
    K.puffs(g, 1590, FLOOR_Y, (t - 6.0) / 0.6, 3, 18, 4, 'rgba(255,200,160,', 40);
  });
  withLayer(g, cam, 1.45, () => {
    g.save(); g.fillStyle = '#0a0614';
    g.fillRect(-130, -200, 130, 1500);
    g.fillStyle = 'rgba(255,150,100,0.55)'; g.fillRect(-5, -200, 5, 1500);
    g.drawImage(fgBottle('ttFg'), 1750, 760);
    g.restore();
  });
  dustMotes(g, t, 36, 11, 0.8);
  g.restore();
  flash(g, 0.9 * Math.exp(-(t - T.s0End) * 14) * (t >= T.s0End ? 1 : 0));
}

// ---------------------------------------------------------------------------------------------------
// BOXING  (8.2 .. 16.9)
// ---------------------------------------------------------------------------------------------------
const env4 = (t, a, b, c, d) => (t <= a || t >= d) ? 0 : t < b ? smooth((t - a) / (b - a)) : t <= c ? 1 : 1 - smooth((t - c) / (d - c));
function pe(t, tp) {   // punch envelope: small wind-up (<0), snap to 1, return
  if (t < tp - 0.3 || t > tp + 0.4) return 0;
  if (t < tp - 0.12) return -0.3 * smooth((t - (tp - 0.3)) / 0.18);
  if (t < tp) { const u = (t - (tp - 0.12)) / 0.12; return lerp(-0.3, 1, 1 - Math.pow(1 - u, 3)); }
  if (t < tp + 0.06) return 1;
  return 1 - smooth((t - tp - 0.06) / 0.34);
}
const BXG = { hy: 16, a1: 0.22, a2: 0.3, ah: -0.15, fFx: 34, fBx: -28, hFx: 42, hFy: -24, hBx: 30, hBy: -10, eo: 1, eg: 0.3, fl: 0.15 };
const bxk = (o) => K.S(Object.assign({}, BXG, o));
const BX_JAB = bxk({ hx: 16, hy: 12, a1: 0.34, a2: 0.46, ah: -0.2, fFx: 56, fBx: -30, hFx: 86, hFy: -36 });
const BX_CRS = bxk({ hx: 20, hy: 10, a1: 0.42, a2: 0.56, ah: -0.22, fFx: 40, fBx: -40, hFx: 34, hFy: -26, hBx: 88, hBy: -38 });
const BX_LEAN = bxk({ hx: -26, hy: 4, a1: -0.18, a2: -0.36, ah: 0.22, fFx: 20, fBx: -34, hFx: 34, hFy: -34, hBx: 22, hBy: -22 });
const BX_DUCK = bxk({ hx: -4, hy: 58, a1: 0.5, a2: 0.66, ah: -0.4, fFx: 40, fBx: -40, hFx: 30, hFy: -36, hBx: 20, hBy: -22 });
const BX_HIT = bxk({ hx: -30, hy: 6, a1: -0.3, a2: -0.55, ah: 0.42, fFx: 22, fBx: -36, hFx: 20, hFy: -10, hBx: 10, hBy: 0 });
const BX_G = bxk({});
const BXE = {   // fight events (fight time)
  opp: [{ t: 10.15, k: 'jab' }, { t: 11.35, k: 'jab' }, { t: 11.72, k: 'crs' }, { t: 12.08, k: 'jab' }],
  hero: [{ t: 10.15, k: 'duck' }, { t: 11.35, k: 'lean' }, { t: 11.72, k: 'duck' }, { t: 12.08, k: 'lean' }],
  counter: 12.45
};
const BXE2 = { opp: [{ t: 20.4, k: 'jab' }], hero: [{ t: 20.4, k: 'lean' }], counter: 99 };
function bxSpec(tf, ev, isHero, amp) {
  let s = BX_G;
  if (isHero) {
    for (const e of ev.hero) s = K.mix(s, e.k === 'duck' ? BX_DUCK : BX_LEAN, env4(tf, e.t - 0.5, e.t - 0.12, e.t + 0.12, e.t + 0.5));
    s = K.mix(s, BX_JAB, pe(tf, ev.counter));
  } else {
    for (const e of ev.opp) s = K.mix(s, e.k === 'crs' ? BX_CRS : BX_JAB, pe(tf, e.t));
    const hr = tf < ev.counter ? 0 : tf < ev.counter + 0.08 ? (tf - ev.counter) / 0.08 : 1 - smooth((tf - ev.counter - 0.08) / 0.55);
    s = K.mix(s, BX_HIT, hr);
  }
  s = Object.assign({}, s);
  const ph = tf * 7 + (isHero ? 0 : 1.7);
  s.hy += 3 * Math.sin(ph) * (amp == null ? 1 : amp); s.hFy += 3 * Math.sin(ph + 1); s.fFy = (s.fFy || 0) + 2 * Math.max(0, Math.sin(ph));
  return s;
}
const BX_S = 1.2, BX_HX = 860, BX_OX = 1080;
function bxO(tf, ev, isHero, cx) {
  const dx = cx - 970;
  if (isHero) return { x: BX_HX + dx + 40 * pe(tf, ev.counter) + 36 * Math.max(0, ev.hero.length ? pe(tf, ev.counter) : 0) * 0, y: FLOOR_Y + 10, s: BX_S, facing: 1 };
  let l = 0; for (const e of ev.opp) l = Math.max(l, pe(tf, e.t));
  return { x: BX_OX + dx - 40 * l, y: FLOOR_Y + 10, s: BX_S, facing: -1 };
}
function gloveOf(g, O, P, hand, col, t) {
  const h = hand === 'F' ? P.armF : P.armB, w = K.W(O, h.hand);
  const a = Math.atan2(h.hand.y - h.elbow.y, h.hand.x - h.elbow.x), wa = O.facing === 1 ? a : Math.PI - a;
  K.glove(g, w, wa, col, O.s * 0.95);
  return w;
}
function ringBG() {
  return K.cv('ringBG', 4200, 1080, (c) => {
    c.translate(1200, 0);
    let gr = c.createLinearGradient(0, 0, 0, 1080);
    gr.addColorStop(0, '#06030e'); gr.addColorStop(0.5, '#190c30'); gr.addColorStop(1, '#3a1a44');
    c.fillStyle = gr; c.fillRect(-1200, 0, 4200, 1080);
    const r = rng(77);
    for (let row = 0; row < 6; row++) {
      const y = 360 + row * 56, tone = mixHex('#0c0618', '#2a1646', row / 6);
      for (let x = -1200 + (row % 2) * 24; x < 3000; x += 52) {
        const px = x + r() * 14, s = 0.85 + r() * 0.35;
        c.fillStyle = tone; c.beginPath(); c.arc(px, y - 30 * s, 13 * s, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(px - 24 * s, y + 40); c.quadraticCurveTo(px - 20 * s, y - 12 * s, px, y - 14 * s); c.quadraticCurveTo(px + 20 * s, y - 12 * s, px + 24 * s, y + 40); c.fill();
        if (r() < 0.07) { c.fillStyle = 'rgba(255,240,200,0.9)'; c.beginPath(); c.arc(px + 20, y - 10, 2.6, 0, TAU); c.fill(); }
        if (r() < 0.05) { c.fillStyle = 'rgba(160,230,255,0.8)'; c.fillRect(px - 5, y - 44 * s, 8, 12); }
      }
    }
    gr = c.createLinearGradient(0, 640, 0, 780); gr.addColorStop(0, 'rgba(6,3,14,0)'); gr.addColorStop(1, 'rgba(6,3,14,0.9)');
    c.fillStyle = gr; c.fillRect(-1200, 640, 4200, 140);
    c.fillStyle = '#0a0514'; c.fillRect(-1200, 760, 4200, 320);
    // overhead truss
    c.fillStyle = '#0a0514'; c.fillRect(-1200, 0, 4200, 40);
    c.strokeStyle = 'rgba(30,20,60,0.9)'; c.lineWidth = 6;
    for (let x = -1200; x < 3000; x += 160) { c.beginPath(); c.moveTo(x, 40); c.lineTo(x + 80, 100); c.lineTo(x + 160, 40); c.stroke(); }
  });
}
function ringMat(cx, hw) {
  return K.cv('ringMat' + hw, hw * 2 + 140, 340, (c) => {
    c.translate(hw + 70, 0);
    let gr = c.createLinearGradient(0, 0, 0, 62); gr.addColorStop(0, '#5b86e8'); gr.addColorStop(1, '#2a4aa6');
    c.fillStyle = gr; c.beginPath(); c.moveTo(-hw + 16, 0); c.lineTo(hw - 16, 0); c.lineTo(hw + 40, 62); c.lineTo(-hw - 40, 62); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-hw * 0.5, 10); c.lineTo(hw * 0.5, 10); c.stroke();
    gr = c.createLinearGradient(0, 62, 0, 150); gr.addColorStop(0, '#c0303e'); gr.addColorStop(1, '#6a1428');
    c.fillStyle = gr; c.fillRect(-hw - 40, 62, hw * 2 + 80, 88);
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(-hw - 40, 100, hw * 2 + 80, 6);
    c.fillStyle = 'rgba(255,170,110,0.7)'; c.fillRect(-hw - 40, 62, hw * 2 + 80, 3);
    c.fillStyle = '#05030a'; c.fillRect(-hw - 40, 150, hw * 2 + 80, 190);
  });
}
// ring: mat + posts + ropes (behind fighters)
function ringBack(g, cx, hw, ss) {
  g.drawImage(ringMat(cx, hw), cx - hw - 70, FLOOR_Y - 18);
  g.save();
  [-hw, hw].forEach((dx) => {
    const x = cx + dx; let gr = g.createLinearGradient(x - 10, 0, x + 10, 0); gr.addColorStop(0, '#6a6a86'); gr.addColorStop(1, '#2e2e48');
    g.fillStyle = gr; g.fillRect(x - 9, FLOOR_Y - 380, 18, 372);
    g.fillStyle = '#d02a3a'; rrect(g, x - 14, FLOOR_Y - 396, 28, 30, 8); g.fill();
    g.fillStyle = 'rgba(255,170,110,0.8)'; g.fillRect(x + 6, FLOOR_Y - 380, 3, 372);
  });
  ['#f4f0ff', '#e03a4c', '#f4f0ff'].forEach((col, i) => {
    const y = FLOOR_Y - 150 - i * 100; g.strokeStyle = col; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - hw, y); g.quadraticCurveTo(cx, y + 10, cx + hw, y); g.stroke();
    g.strokeStyle = 'rgba(255,170,110,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - hw, y - 3); g.quadraticCurveTo(cx, y + 7, cx + hw, y - 3); g.stroke();
  });
  g.restore();
}
function bxClock(g, t, cx, cy, r, a, mode) {   // arena clock; mode 'rewind' spins hand backwards
  g.save(); g.translate(cx, cy);
  radial(g, 0, 0, r * 2.4, [[0, 'rgba(255,200,140,' + (0.2 * a) + ')'], [1, 'rgba(255,200,140,0)']]);
  g.globalAlpha = a;
  g.fillStyle = '#0d0820'; g.beginPath(); g.arc(0, 0, r + 12, 0, TAU); g.fill();
  g.fillStyle = '#f4ecd8'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = '#1a1030'; g.lineWidth = 3;
  for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; g.beginPath(); g.moveTo(Math.sin(an) * r * 0.82, -Math.cos(an) * r * 0.82); g.lineTo(Math.sin(an) * r * 0.95, -Math.cos(an) * r * 0.95); g.stroke(); }
  const ang = mode.ang; g.rotate(ang);
  g.lineCap = 'round'; g.lineWidth = 6; g.strokeStyle = '#d02a3a'; g.beginPath(); g.moveTo(0, 8); g.lineTo(0, -r * 0.8); g.stroke();
  g.rotate(-ang);
  g.fillStyle = '#1a1030'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
  if (mode.glow > 0.01) {
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(140,240,255,' + (0.9 * mode.glow) + ')'; g.lineWidth = 7;
    g.beginPath(); g.arc(0, 0, r + 22, -Math.PI / 2, -Math.PI / 2 - TAU * mode.arc, true); g.stroke();
  }
  g.restore();
}
function bubbles(g, t, n, seed, a, ox) {
  g.save();
  for (let i = 0; i < n; i++) {
    const sp = 40 + hash1(i + seed) * 70, x = ((hash1(i * 5 + seed) * 2200 - 150 + (ox || 0) * 0) + Math.sin(t * 0.8 + i * 1.7) * 26), y = H + 40 - ((t * sp + hash1(i + seed + 9) * 1300) % (H + 120)), r = 3 + hash1(i + seed + 21) * 11;
    g.strokeStyle = 'rgba(200,245,255,' + (0.7 * a) + ')'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(220,250,255,' + (0.14 * a) + ')'; g.fill();
    g.fillStyle = 'rgba(255,255,255,' + (0.8 * a) + ')'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.2, 0, TAU); g.fill();
  }
  g.restore();
}
function underwater(g, t, a) {
  if (a <= 0.01) return;
  g.save();
  g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(' + (255 - 130 * a | 0) + ',' + (255 - 55 * a | 0) + ',' + (255 - 10 * a | 0) + ',1)'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const x = 200 + i * 340 + Math.sin(t * 0.5 + i) * 60, w = 70 + 40 * Math.sin(t * 0.7 + i * 2);
    const gr = g.createLinearGradient(x, 0, x - 260, H); gr.addColorStop(0, 'rgba(120,230,255,' + (0.2 * a) + ')'); gr.addColorStop(1, 'rgba(120,230,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w - 260, H); g.lineTo(x - 260, H); g.closePath(); g.fill();
  }
  g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(160,240,255,' + (0.1 * a) + ')'; g.lineWidth = 2;
  for (let k = 0; k < 7; k++) { g.beginPath(); for (let x = 0; x <= W; x += 40) { const y = 120 + k * 150 + 24 * Math.sin(x * 0.011 + t * 0.9 + k * 2) + 12 * Math.sin(x * 0.027 - t * 0.6); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  g.restore();
  bubbles(g, t, 26, 5, a);
}
function ropeFg() {
  return K.cv('ropeFg', 2400, 220, (x) => {
    x.filter = 'blur(6px)';
    x.strokeStyle = '#18102c'; x.lineWidth = 26; x.lineCap = 'round'; x.beginPath(); x.moveTo(-40, 60); x.quadraticCurveTo(1200, 100, 2440, 50); x.stroke();
    x.strokeStyle = 'rgba(255,150,100,0.5)'; x.lineWidth = 5; x.beginPath(); x.moveTo(-40, 48); x.quadraticCurveTo(1200, 88, 2440, 38); x.stroke();
  });
}
function ringPair(g, cx, hw, tf, ev, palA, palB, gA, gB, t, tint) {
  ringBack(g, cx, hw);
  const dx = cx - 970, oh = bxO(tf, ev, true, cx + 0), oo = bxO(tf, ev, false, cx + 0);
  const sh = bxSpec(tf, ev, true, 0.5), so = bxSpec(tf, ev, false, 0.5);
  const ph = K.pose(sh, t), po = K.pose(so, t);
  K.fig(g, Object.assign({}, oo, { pose: po, pal: palB })); gloveOf(g, oo, po, 'B', gB, t); gloveOf(g, oo, po, 'F', gB, t);
  K.fig(g, Object.assign({}, oh, { pose: ph, pal: palA })); gloveOf(g, oh, ph, 'B', gA, t); gloveOf(g, oh, ph, 'F', gA, t);
}

function s2(g, lt) {
  const t = lt, B = T.bx;
  const uw = smooth((t - B.uw + 0.22) / 0.22) * (1 - smooth((t - 16.55) / 0.3));
  const slow = t >= B.uw;
  const tf = slow ? 20 + (t - B.uw) * 0.28 : t;
  const ev = slow ? BXE2 : BXE;
  // camera
  let cz = 1.12 + 0.2 * smooth((t - 8.5) / 1.4) + 0.06 * smooth((t - 11.0) / 1.2), cx = 970, cy = 690;
  if (slow) { const u = smooth((t - 15.3) / 1.4); cz = lerp(1.26, 0.55, u); cx = lerp(980, 1000, u); cy = lerp(690, 640, u); cz += 0.03 * Math.sin((t - B.uw) * 0.9); }
  const cam = camBase(cx, cy, cz, slow ? 0.012 * Math.sin((t - B.uw) * 0.7) : 0);
  const hitT = BXE.counter;
  if (!slow) shake(cam, t, hitT, 14, 9);
  g.save(); camTransform(g, cam);
  g.fillStyle = '#0a0514'; g.fillRect(-100, -100, W + 200, H + 200);
  withLayer(g, cam, 0.6, () => { g.drawImage(ringBG(), -1200 * 1 - 300 + 300, 0); });
  // spotlight cones over the ring
  withLayer(g, cam, 0.85, () => {
    g.save(); g.globalCompositeOperation = 'screen';
    [[600, 0.8], [970, 1], [1340, 0.8]].forEach((s, i) => {
      const sw = Math.sin(t * 0.6 + i * 2) * 14, gr = g.createLinearGradient(0, 0, 0, 900);
      gr.addColorStop(0, 'rgba(255,230,190,' + (0.3 * s[1]) + ')'); gr.addColorStop(1, 'rgba(255,200,150,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(s[0] - 22 + sw, 0); g.lineTo(s[0] + 22 + sw, 0); g.lineTo(s[0] + 260, 900); g.lineTo(s[0] - 260, 900); g.closePath(); g.fill();
    });
    g.restore();
  });
  // arena clock (rewind during "you watched it ten seconds ago")
  withLayer(g, cam, 0.75, () => {
    const ca = smooth((t - B.clk0) / 0.25) * (1 - smooth((t - B.clk1) / 0.3));
    const rw = clamp((t - B.clk0) / (B.clk1 - B.clk0));
    bxClock(g, t, 1500, 250, 78, 0.35 + 0.65 * ca, { ang: -TAU * 1.6 * easeOut(rw) + 0.6, glow: ca * Math.sin(Math.PI * rw) * 0.9 + 0.0, arc: rw });
  });
  withLayer(g, cam, 1, () => {
    // other fighters (every fighter in the world) revealed on the pull-out
    if (slow) {
      const ex = smooth((t - 15.0) / 0.6);
      if (ex > 0.01) {
        g.save(); g.globalAlpha = ex;
        const mkEv = (o) => ({ opp: [{ t: 20.4 + o, k: 'jab' }], hero: [{ t: 20.4 + o, k: 'lean' }], counter: 99 });
        ringPair(g, -330, 430, 20.0 + (t - B.uw) * 0.28 + 0.1, mkEv(0.1), K.pal('#2fb59a'), K.pal('#8a4fd8'), '#e8a02a', '#d0d0e0', t);
        ringPair(g, 2300, 430, 20.0 + (t - B.uw) * 0.28 - 0.1, mkEv(-0.1), K.pal('#f2c230'), K.pal('#d0507a'), '#3a6fe0', '#2fb59a', t);
        g.restore();
      }
    }
    ringBack(g, 970, 520);
    const oh = bxO(tf, ev, true, 970), oo = bxO(tf, ev, false, 970);
    const sh = bxSpec(tf, ev, true), so = bxSpec(tf, ev, false);
    const ph = K.pose(sh, t), po = K.pose(so, t);
    if (slow) { ph.flutter = 0.7; po.flutter = 0.7; }
    // ghost layer (before real so the real hero draws on top)
    const gv = !slow ? 1 : 0;
    // real fighters
    K.fig(g, Object.assign({}, oo, { pose: po, pal: PAL_BLU })); gloveOf(g, oo, po, 'B', '#2b5fd0', t);
    K.fig(g, Object.assign({}, oh, { pose: ph, pal: HERO_PAL })); gloveOf(g, oh, ph, 'B', '#e23b3b', t);
    const hf = gloveOf(g, oh, ph, 'F', '#e23b3b', t), of = gloveOf(g, oo, po, 'F', '#2b5fd0', t);
    // vision: ghost fist paths
    if (!slow) {
      BXE.opp.forEach((e, i) => {
        const ga = smooth((t - (e.t - 0.65)) / 0.15) * (1 - smooth((t - (e.t + 0.12)) / 0.2));
        if (ga > 0.01) {
          const pts = (u) => { const tt = lerp(e.t - 0.2, e.t + 0.03, u); const O = bxO(tt, BXE, false, 970), P = K.pose(bxSpec(tt, BXE, false), tt); return K.W(O, e.k === 'crs' ? P.armB.hand : P.armF.hand); };
          K.dotPath(g, pts, clamp((t - (e.t - 0.65)) / 0.35), 18, 4, ga, t);
          if (i === 0) {
            const gs = bxSpec(e.t, BXE, true), gO = bxO(e.t, BXE, true, 970), gp = K.pose(gs, e.t);
            const al = 0.5 * ga; if (al > 0.02) K.fig(g, Object.assign({}, gO, { pose: gp, pal: palGhost(al), alpha: 1 }));
          }
        }
      });
    } else {
      const ga = smooth((t - 13.9) / 0.4) * (1 - smooth((t - 16.0) / 0.4));
      if (ga > 0.01) {
        const pts = (u) => { const tt = lerp(20.2, 20.45, u); const O = bxO(tt, BXE2, false, 970), P = K.pose(bxSpec(tt, BXE2, false), tt); return K.W(O, P.armF.hand); };
        K.dotPath(g, pts, clamp((t - 13.9) / 0.8), 18, 4, ga, t);
      }
    }
    // counter hit burst
    if (!slow) {
      const hu = (t - hitT) / 0.4;
      if (hu > 0 && hu < 1) K.burst(g, (hf.x + of.x) / 2 + 10, hf.y - 8, 70, hu, 4);
      const pu = (t - 10.15) / 0.4;
      for (const e of BXE.opp) { const u = (t - e.t) / 0.28; if (u > 0 && u < 1) K.streaks(g, of.x + 40, of.y, -1, 0, 160, 1 - u, e.t * 7, 5, 24); }
    }
    K.puffs(g, 970, FLOOR_Y + 30, (t - 10.15) / 0.5, 3, 20, 3, 'rgba(255,200,160,', 60);
  });
  withLayer(g, cam, 1.55, () => { g.drawImage(ropeFg(), -200, 930); });
  g.restore();
  underwater(g, t, uw);
  // transitions: whip from table-tennis, flash into underwater
  const wi = 1 - smooth((t - T.ttEnd) / 0.28);
  if (wi > 0.01) { K.whip(g, wi, -1, 21); flash(g, 0.7 * wi); }
  flash(g, 0.5 * Math.exp(-Math.abs(t - B.uw) * 12));
  const wo = smooth((t - 16.62) / 0.28);
  if (wo > 0.01) { K.whip(g, wo, 1, 31); flash(g, 0.85 * smooth((t - 16.74) / 0.16)); }
}


// ---------------------------------------------------------------------------------------------------
// BASEBALL  (16.9 .. 24.0)   +   STADIUM helpers (also used by the empty-stadium finale)
// ---------------------------------------------------------------------------------------------------
function stadBG(empty) {
  return K.cv('stad' + (empty ? 1 : 0), 4200, 1080, (c) => {
    c.translate(1200, 0);
    let gr = c.createLinearGradient(0, 0, 0, 660);
    if (empty) { gr.addColorStop(0, '#04030c'); gr.addColorStop(0.6, '#1a1040'); gr.addColorStop(1, '#6a3a72'); }
    else { gr.addColorStop(0, '#171050'); gr.addColorStop(0.55, '#6a2f78'); gr.addColorStop(1, '#ff9a6a'); }
    c.fillStyle = gr; c.fillRect(-1200, 0, 4200, 700);
    // stands (5 tiers)
    const r = rng(19);
    for (let i = 0; i < 5; i++) {
      const y = 300 + i * 62;
      c.fillStyle = mixHex('#0e0820', '#2a1646', i / 5); c.fillRect(-1200, y, 4200, 66);
      c.fillStyle = 'rgba(255,170,110,0.12)'; c.fillRect(-1200, y, 4200, 3);
      for (let x = -1200 + (i % 2) * 17; x < 3000; x += 34) {
        const px = x + r() * 8;
        if (empty) { c.fillStyle = 'rgba(70,50,110,0.55)'; c.fillRect(px - 9, y + 26, 18, 14); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(px - 9, y + 38, 18, 4); }
        else {
          c.fillStyle = ['#ff7a4a', '#3fd0c0', '#ffd23f', '#a46bff', '#ff5a8a', '#6a8ae8', '#2a1c4a', '#2a1c4a'][(r() * 8) | 0];
          c.beginPath(); c.arc(px, y + 24, 7 + r() * 2, 0, TAU); c.fill(); c.fillRect(px - 8, y + 31, 16, 16);
          if (r() < 0.04) { c.fillStyle = 'rgba(255,250,220,0.95)'; c.beginPath(); c.arc(px + 9, y + 24, 2.4, 0, TAU); c.fill(); }
        }
      }
    }
    // light towers
    [-260, 640, 1560, 2460].forEach((x) => {
      c.fillStyle = '#0b0618'; c.fillRect(x - 6, 130, 12, 520);
      radial(c, x, 110, empty ? 160 : 260, [[0, empty ? 'rgba(255,240,210,0.35)' : 'rgba(255,240,210,0.55)'], [0.4, 'rgba(255,200,150,0.14)'], [1, 'rgba(255,170,120,0)']]);
      c.fillStyle = '#150d28'; c.fillRect(x - 70, 70, 140, 80);
      for (let a = 0; a < 4; a++) for (let b = 0; b < 7; b++) { c.fillStyle = empty ? 'rgba(255,245,215,0.5)' : 'rgba(255,250,225,0.95)'; c.beginPath(); c.arc(x - 54 + b * 18, 84 + a * 18, 5.5, 0, TAU); c.fill(); }
    });
    // scoreboard (LED dots only)
    c.fillStyle = '#0a0618'; c.fillRect(1000, 120, 440, 150); c.strokeStyle = '#2a1c4a'; c.lineWidth = 6; c.strokeRect(1000, 120, 440, 150);
    const rr = rng(5);
    for (let a = 0; a < 6; a++) for (let b = 0; b < 30; b++) if (rr() < (empty ? 0.12 : 0.45)) { c.fillStyle = rr() < 0.6 ? '#ffb84a' : '#7be0ff'; c.fillRect(1014 + b * 14, 136 + a * 21, 8, 10); }
    // outfield wall + far grass
    c.fillStyle = '#123a2e'; c.fillRect(-1200, 610, 4200, 34); c.fillStyle = '#ffd23f'; c.fillRect(-1200, 610, 4200, 5);
    gr = c.createLinearGradient(0, 644, 0, 780); gr.addColorStop(0, empty ? '#0d2a22' : '#235f3c'); gr.addColorStop(1, empty ? '#0a1e1a' : '#1a4a30');
    c.fillStyle = gr; c.fillRect(-1200, 644, 4200, 200);
  });
}
function stadGround(empty) {
  return K.cv('stadGnd' + (empty ? 1 : 0), 4200, 330, (c) => {
    c.translate(1200, -(FLOOR_Y - 60));
    let gr = c.createLinearGradient(0, FLOOR_Y - 60, 0, FLOOR_Y + 270);
    gr.addColorStop(0, empty ? '#10322a' : '#2d7040'); gr.addColorStop(1, empty ? '#081812' : '#174a2e');
    c.fillStyle = gr; c.fillRect(-1200, FLOOR_Y - 60, 4200, 330);
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = -1200; x < 3000; x += 160) { c.beginPath(); c.moveTo(x, FLOOR_Y - 60); c.lineTo(x + 80, FLOOR_Y - 60); c.lineTo(x + 80 + (x - 970) * 0.35, FLOOR_Y + 270); c.lineTo(x + (x - 970) * 0.35, FLOOR_Y + 270); c.closePath(); c.fill(); }
    // dirt
    c.fillStyle = empty ? '#3a2a30' : '#a8693f';
    c.beginPath(); c.ellipse(1470, FLOOR_Y + 36, 330, 42, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(380, FLOOR_Y + 8, 190, 30, 0, 0, TAU); c.fill();
    c.fillStyle = empty ? '#4a3640' : '#c27f4c';
    c.beginPath(); c.ellipse(380, FLOOR_Y - 8, 120, 17, 0, 0, TAU); c.fill();   // mound top
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(1370, FLOOR_Y + 22, 200, 4);   // batter's box chalk
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(-1200, FLOOR_Y + 70, 4200, 3);
  });
}
function netFg() {
  return K.cv('netFg', 700, 1200, (x) => {
    x.filter = 'blur(3px)'; x.strokeStyle = 'rgba(30,20,50,0.55)'; x.lineWidth = 2;
    for (let i = 0; i < 40; i++) { x.beginPath(); x.moveTo(i * 20, 0); x.lineTo(i * 20, 1200); x.stroke(); }
    for (let j = 0; j < 60; j++) { x.beginPath(); x.moveTo(0, j * 20); x.lineTo(700, j * 20); x.stroke(); }
    x.strokeStyle = 'rgba(255,160,110,0.35)'; x.lineWidth = 3; x.beginPath(); x.moveTo(8, 0); x.lineTo(8, 1200); x.stroke();
  });
}
function drawStadium(g, cam, t, empty) {
  g.fillStyle = empty ? '#04030c' : '#171050'; g.fillRect(-100, -100, W + 200, H + 200);
  withLayer(g, cam, 0.6, () => { g.drawImage(stadBG(empty), -1200, 0); });
  withLayer(g, cam, 1, () => { g.drawImage(stadGround(empty), -1200, FLOOR_Y - 60); });
}
K.bat = (g, hand, ang, sc) => {
  g.save(); g.translate(hand.x, hand.y); g.rotate(ang); g.scale(sc, sc);
  g.beginPath(); g.moveTo(-14, -5); g.lineTo(60, -5); g.lineTo(150, -13); g.quadraticCurveTo(160, 0, 150, 13); g.lineTo(60, 5); g.lineTo(-14, 5); g.closePath();
  const gr = g.createLinearGradient(0, -12, 0, 12); gr.addColorStop(0, '#e8b872'); gr.addColorStop(1, '#8a5a30'); g.fillStyle = gr; g.fill();
  g.lineWidth = 3; g.strokeStyle = '#14101c'; g.stroke(); g.fillStyle = '#14101c'; g.fillRect(-18, -6, 10, 12);
  g.restore();
};
// ---- characters
const PIT_O = { x: 380, y: FLOOR_Y - 22, s: 1.15, facing: 1 };
const HERO_BB = { x: 1470, y: FLOOR_Y, s: 1.15, facing: -1 };
const CAT_O = { x: 1655, y: FLOOR_Y + 4, s: 1.1, facing: -1 };
const UMP_O = { x: 1790, y: FLOOR_Y + 8, s: 1.1, facing: -1 };
const pitSeq = K.seq({ hy: 14, a1: 0.08, a2: 0.1, fFx: 20, fBx: -20, hFx: 30, hFy: 14, hBx: 26, hBy: 20, eo: 1 }, [
  [0, {}], [20.2, {}],
  [20.5, { fFy: 70, fFx: 34, hy: 8, a1: -0.1, a2: -0.14, hFx: 34, hFy: -6, hBx: 30, hBy: 0 }, 'io'],
  [20.82, { fFy: 0, fFx: 96, fBx: -30, hx: 24, hy: 40, a1: 0.1, a2: -0.22, hFx: 80, hFy: -6, hBx: -50, hBy: -40 }, 'io'],
  [21.0, { fFy: 0, fFx: 100, fBx: -26, hx: 44, hy: 40, a1: 0.5, a2: 0.72, ah: -0.2, hFx: 44, hFy: 22, hBx: 70, hBy: -70 }, 's'],
  [21.35, { fFx: 100, fBx: -26, hx: 50, hy: 44, a1: 0.72, a2: 0.95, hFx: 30, hFy: 30, hBx: 34, hBy: 56 }, 'o'],
  [22.4, { hx: 10, hy: 16, a1: 0.1, a2: 0.12, fFx: 36, fBx: -18, hFx: 30, hFy: 30, hBx: 20, hBy: 50 }, 'io']
]);
const batSeq = K.seq({ hy: 22, a1: 0.06, a2: 0.08, ah: 0, fFx: 38, fBx: -34, hFx: 24, hFy: -32, hBx: 18, hBy: -26, eo: 1, eg: 0.4, fl: 0.25 }, [
  [0, {}], [21.1, {}],
  [21.43, { hx: -16, hy: 32, a1: -0.14, a2: -0.34, ah: -0.22, fl: 1, eg: 0.9 }, 'io'],
  [21.95, { hx: 0, hy: 22, a1: 0.04, a2: 0.06, ah: 0.1, eo: 0.8, fl: 0.4 }, 'io'],
  [22.8, { eo: 0.38, ah: 0.14, hFy: -16, hBy: -12, a2: 0, hy: 18, fl: 0.15, eg: 0.1 }, 'io'],
  [24, { eo: 0.38, ah: 0.14, hFy: -16, hBy: -12, a2: 0, hy: 18 }]
]);
const catSeq = K.seq({ hy: 78, a1: 0.45, a2: 0.15, fFx: 44, fBx: -12, hFx: 70, hFy: -8, hBx: 50, hBy: 8, eo: 1 }, [
  [0, {}], [21.3, {}],
  [21.5, { hFx: 46, hFy: 8, a1: 0.35, a2: 0.0, hy: 72 }, 's'],
  [21.9, { hFx: 56, hFy: 2 }, 'io'], [22.8, { hFx: 56, hFy: 2, hy: 70, a2: 0.1 }, 'io']
]);
const umpSeq = K.seq({ hy: 30, a1: 0.14, a2: 0.1, fFx: 22, fBx: -18, hFx: 22, hFy: 40, hBx: 18, hBy: 44, eo: 1 }, [
  [0, {}], [21.45, {}],
  [21.62, { a1: -0.1, a2: -0.3, hx: -10, hy: 22 }, 's'],
  [22.0, { a1: 0.08, a2: 0.0, hx: 0, hy: 28, hBx: 8, hBy: -78, hFx: 16, hFy: 40 }, 'b'],
  [22.9, { a1: 0.08, hBx: 8, hBy: -78 }, 'io'], [23.5, { hBx: 18, hBy: 44, hy: 30 }, 'io']
]);
const BB = (() => {
  const b = T.bb, pp = K.pose(pitSeq(b.rel), b.rel), rh = K.W(PIT_O, pp.armB.hand);
  const cp = K.pose(catSeq(b.pop - 0.04), b.pop - 0.04), mitt = K.W(CAT_O, cp.armF.hand);
  const hp = K.pose(batSeq(b.rel), b.rel), headY = K.W(HERO_BB, hp.head).y;
  return { rh, mitt: { x: mitt.x - 8, y: mitt.y }, headY };
})();
const BBALL = [{ t0: T.bb.rel, t1: T.bb.pop, x0: BB.rh.x, y0: BB.rh.y, x1: BB.mitt.x, y1: BB.mitt.y, h: 0 }];
K.BB = BB;
const bbPath = (u) => ({ x: lerp(BB.rh.x, BB.mitt.x, u), y: lerp(BB.rh.y, BB.mitt.y, u) });

function s3(g, lt) {
  const t = lt, b = T.bb;
  const zi = smooth((t - 20.45) / 0.55), zo = smooth((t - 21.9) / 1.1);
  let cz, cx, cy;
  cz = 0.98 + 0.07 * smooth((t - 16.9) / 2.0) + 0.3 * smooth((t - 19.0) / 1.5);
  cx = 920 + 330 * smooth((t - 19.0) / 1.5); cy = 690;
  cz = lerp(cz, 2.2, zi); cx = lerp(cx, 1455, zi); cy = lerp(cy, 606, zi);
  cz = lerp(cz, 1.45, zo); cx = lerp(cx, 1530, zo); cy = lerp(cy, 650, zo);
  cx += 8 * Math.sin(t * 0.7) * zi; cz += 0.02 * Math.sin(t * 0.6) * zi;
  const cam = camBase(cx, cy, cz, 0);
  shake(cam, t, b.pop, 10, 9);
  g.save(); camTransform(g, cam);
  drawStadium(g, cam, t, false);
  // camera flashes in the crowd after the pop
  withLayer(g, cam, 0.6, () => {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      const ft = b.pop + 0.1 + hash1(i + 3) * 1.3, u = (t - ft) / 0.14;
      if (u > 0 && u < 1) { const x = 100 + hash1(i * 7 + 1) * 1800, y = 340 + hash1(i * 7 + 2) * 270; radial(g, x, y, 34 * (1 - u * 0.5), [[0, 'rgba(255,255,240,' + (1 - u) + ')'], [1, 'rgba(255,255,240,0)']]); }
    }
    g.restore();
  });
  const pp = K.pose(pitSeq(t), t), hs = batSeq(t), hp = K.pose(hs, t), cp = K.pose(catSeq(t), t), up2 = K.pose(umpSeq(t), t);
  withLayer(g, cam, 1, () => {
    g.save(); g.translate(PIT_O.x, FLOOR_Y - 8); g.scale(1, 0.12); radial(g, 0, 0, 90, [[0, 'rgba(10,4,20,0.5)'], [1, 'rgba(10,4,20,0)']]); g.restore();
    K.fig(g, Object.assign({}, PIT_O, { pose: pp, pal: K.pal('#e8e6f2', { leg: '#d8d4ea' }) }));
    // pitcher's ball in hand until release
    if (t < b.rel && t > 20.2) { const w = K.W(PIT_O, pp.armB.hand); K.ball(g, w.x, w.y, 7, 0, '#fff'); }
    K.fig(g, Object.assign({}, UMP_O, { pose: up2, pal: K.pal('#2a2a40', { leg: '#3a3a52' }) }));
    K.fig(g, Object.assign({}, CAT_O, { pose: cp, pal: K.pal('#4a4a8a', { leg: '#34345e' }) }));
    const mw = K.W(CAT_O, cp.armF.hand); K.glove(g, mw, CAT_O.facing === 1 ? 0 : Math.PI, '#9a6a34', 1.35);
    // hero (batter): ghosts first, hero, then ball over his face
    const hw = K.W(HERO_BB, hp.armF.hand);
    K.fig(g, Object.assign({}, HERO_BB, { pose: hp, pal: HERO_PAL }));
    K.bat(g, hw, Math.PI - (-2.2), 1.15);
    g.fillStyle = '#14101c'; g.beginPath(); g.arc(hw.x, hw.y, 8, 0, TAU); g.fill();
    // ghost path + ghost ball loops
    const ga = smooth((t - b.ghost0) / 0.25) * (1 - smooth((t - b.pop - 0.1) / 0.3));
    if (ga > 0.01) {
      K.dotPath(g, bbPath, clamp((t - b.ghost0) / 0.5), 40, 3.4, ga * 0.9, t);
      [18.7, 19.7, 20.4].forEach((s0) => {
        const u = (t - s0) / 0.42;
        if (u > 0 && u < 1) {
          const p = bbPath(u); g.save(); g.globalCompositeOperation = 'lighter';
          K.streaks(g, p.x, p.y, 1, 0.02, 220, 0.9, 6, 7, 10, 'rgba(150,240,255,');
          radial(g, p.x, p.y, 36, [[0, 'rgba(150,245,255,0.8)'], [1, 'rgba(150,245,255,0)']]);
          g.fillStyle = 'rgba(235,254,255,0.95)'; g.beginPath(); g.arc(p.x, p.y, 10, 0, TAU); g.fill(); g.restore();
        }
      });
      K.ring(g, BB.mitt.x - 20, BB.mitt.y, 38, 38, ga * 0.8, t);
    }
    const bl = K.ballAt(BBALL, t);
    if (bl) { K.streaks(g, bl.x, bl.y, 1, 0.02, 360, 1, 12, 8, 14); K.ball(g, bl.x, bl.y, 10.5, 1); }
    K.burst(g, mw.x - 16, mw.y - 6, 52, (t - b.pop) / 0.4, 12);
    K.puffs(g, mw.x - 10, mw.y + 10, (t - b.pop) / 0.7, 6, 22, 7, 'rgba(230,190,150,', 60);
    // ear flutter streaks on the hood when the ball whips by
    if (t > b.arr && t < b.arr + 0.3) K.streaks(g, hw.x - 30, BB.headY, 1, 0, 140, 1 - (t - b.arr) / 0.3, 3, 4, 40);
  });
  if (t > 20.4) withLayer(g, cam, 1.4, () => { g.save(); g.globalAlpha = 0.5; g.drawImage(netFg(), 1700, -100); g.restore(); });
  dustMotes(g, t, 26, 4, 0.5);
  g.restore();
  const wi = 1 - smooth((t - b.whip) / 0.3);
  if (wi > 0.01) { K.whip(g, wi, 1, 41); flash(g, 0.6 * wi); }
  const wo = smooth((t - 23.68) / 0.3);
  if (wo > 0.01) { K.whip(g, wo, 1, 51); flash(g, 0.85 * smooth((t - 23.8) / 0.16)); }
}


// ---------------------------------------------------------------------------------------------------
// FINALE (24.0 .. 30.85): three quick "nobody can beat you" vignettes, then the empty stadium
// ---------------------------------------------------------------------------------------------------
function vgBG(k) {
  return K.cv('vgBG' + k, 1920, 1080, (c) => {
    let gr = c.createLinearGradient(0, 0, 0, 1080);
    if (k === 0) { gr.addColorStop(0, '#3a1a5a'); gr.addColorStop(0.6, '#e0587a'); gr.addColorStop(1, '#ffb070'); }
    else if (k === 1) { gr.addColorStop(0, '#050a20'); gr.addColorStop(0.6, '#12306a'); gr.addColorStop(1, '#2a5a9a'); }
    else { gr.addColorStop(0, '#2a1450'); gr.addColorStop(0.7, '#6a2c70'); gr.addColorStop(1, '#a04a62'); }
    c.fillStyle = gr; c.fillRect(0, 0, 1920, 1080);
    const r = rng(60 + k);
    if (k === 0) {         // cosy room: window + shelves
      c.fillStyle = '#1a0c30'; c.fillRect(1200, 150, 440, 330); c.fillStyle = '#ffc27a'; c.fillRect(1214, 164, 412, 302);
      c.fillStyle = '#1a0c30'; c.fillRect(1416, 164, 10, 302); c.fillRect(1214, 310, 412, 10);
      c.fillStyle = '#2a1648'; c.fillRect(240, 250, 360, 14); c.fillRect(240, 420, 360, 14);
      for (let i = 0; i < 9; i++) { c.fillStyle = ['#ff7a4a', '#3fd0c0', '#ffd23f', '#a46bff'][i % 4]; c.fillRect(256 + i * 38, 190 + (i % 3) * 8, 28, 60 - (i % 3) * 8); c.fillRect(256 + i * 38, 360, 28, 60); }
      c.fillStyle = '#7a4a3a'; c.fillRect(0, 836, 1920, 244);
      c.fillStyle = 'rgba(255,200,150,0.18)'; for (let i = 0; i < 12; i++) c.fillRect(i * 170, 836, 4, 244);
    } else if (k === 1) {  // floodlit pitch
      [[300, 80], [1600, 80]].forEach((p) => { radial(c, p[0], p[1], 300, [[0, 'rgba(255,245,210,0.7)'], [1, 'rgba(255,245,210,0)']]); c.fillStyle = '#e8e8f4'; c.fillRect(p[0] - 50, p[1] - 20, 100, 40); });
      for (let i = 0; i < 70; i++) { c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(r() * 1920, r() * 200, 2, 2); }
      c.fillStyle = '#0a1230'; c.fillRect(0, 560, 1920, 120);
      for (let x = 0; x < 1920; x += 30) { c.fillStyle = ['#3a5ad0', '#d03a5a', '#e8c030'][(r() * 3) | 0]; c.fillRect(x, 600 + r() * 40, 20, 40); }
      gr = c.createLinearGradient(0, 700, 0, 1080); gr.addColorStop(0, '#1f7a3e'); gr.addColorStop(1, '#0f4a26'); c.fillStyle = gr; c.fillRect(0, 700, 1920, 380);
      c.fillStyle = 'rgba(255,255,255,0.06)'; for (let x = 0; x < 1920; x += 200) c.fillRect(x, 700, 100, 380);
    } else {               // gym
      c.fillStyle = 'rgba(255,170,110,0.08)'; for (let x = 0; x < 1920; x += 160) c.fillRect(x, 0, 6, 836);
      c.fillStyle = '#1a0c30'; c.fillRect(0, 480, 1920, 20); c.fillRect(0, 560, 1920, 8);
      [[400, 160], [900, 160], [1400, 160]].forEach((p) => { radial(c, p[0], p[1], 260, [[0, 'rgba(255,230,170,0.45)'], [1, 'rgba(255,230,170,0)']]); });
      gr = c.createLinearGradient(0, 836, 0, 1080); gr.addColorStop(0, '#c88a50'); gr.addColorStop(1, '#6a3a30'); c.fillStyle = gr; c.fillRect(0, 836, 1920, 244);
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 940); c.lineTo(1920, 940); c.stroke();
    }
  });
}
const FIN_S = 1.3;
function vgHeroSpec(base, o) { return K.S(Object.assign({}, { hy: 14, a1: 0.1, a2: 0.12, fFx: 30, fBx: -30, hFx: 30, hFy: 20, hBx: 20, hBy: 40, eo: 1, eg: 0.4, fl: 0.2 }, base, o || {})); }
// V1 reaction ruler --------------------------------------------------------------------------------
function v1(g, t) {
  const F = T.fin, d = F.drop;
  const bg = vgBG(0); g.drawImage(bg, 0, 0);
  const RX = 960;
  const fSpec0 = vgHeroSpec({ hFx: 52, hFy: -82, hBx: 14, hBy: 50, a2: 0.1 });
  const fHandOff = K.W({ x: 0, y: 0, s: FIN_S, facing: 1 }, K.pose(fSpec0, 0).armF.hand);
  const fO = { x: RX - fHandOff.x - 6, y: FLOOR_Y + 12, s: FIN_S, facing: 1 };
  const react = env4(t, d + 0.12, d + 0.32, d + 0.9, d + 1.2);
  const fSpec = vgHeroSpec({ hFx: 52, hFy: -82, hBx: 14, hBy: 50, a2: 0.1 }, { a1: lerp(0.1, -0.18, react), a2: lerp(0.1, -0.42, react), ah: -0.3 * react, hy: 14 + 8 * react });
  const fp = K.pose(fSpec, t), fh = K.W(fO, fp.armF.hand);
  // hero: hand placed just under the ruler's bottom
  const rulerH = 210, rx = RX, rTop = fh.y - 8;
  const hSpecBase = { hFx: 70, hFy: 60, hBx: 14, hBy: 54 };
  const probe = K.pose(vgHeroSpec(hSpecBase), 0), hOffX = K.W({ x: 0, y: 0, s: FIN_S, facing: -1 }, probe.armF.hand).x;
  const hO = { x: rx - hOffX, y: FLOOR_Y + 12, s: FIN_S, facing: -1 };
  const close = smooth((t - (d - 0.1)) / 0.08);
  const hSpec = vgHeroSpec(hSpecBase, { hy: 14 + 6 * smooth((t - (d - 0.3)) / 0.25) });
  const hp = K.pose(hSpec, t), hh = K.W(hO, hp.armF.hand);
  const fall = t < d ? 0 : Math.min(0.5 * 3200 * (t - d) * (t - d), 6);
  K.fig(g, Object.assign({}, fO, { pose: fp, pal: PAL_BLU }));
  K.fig(g, Object.assign({}, hO, { pose: hp, pal: HERO_PAL }));
  // ruler
  g.save(); g.translate(rx, rTop + fall);
  g.fillStyle = '#f2d27a'; g.fillRect(-9, 0, 18, rulerH); g.strokeStyle = '#14101c'; g.lineWidth = 3; g.strokeRect(-9, 0, 18, rulerH);
  g.lineWidth = 2; for (let i = 1; i < 14; i++) { g.beginPath(); g.moveTo(-9, i * 15); g.lineTo(i % 5 ? -1 : 3, i * 15); g.stroke(); }
  g.restore();
  // hand: open -> closed (fist ring around ruler)
  g.fillStyle = '#14101c'; g.beginPath(); g.arc(rx, rTop + rulerH - 24 + fall, lerp(11, 16, close), 0, TAU); g.fill();
  g.fillStyle = '#f0c6a0'; g.beginPath(); g.arc(rx, rTop + rulerH - 24 + fall, lerp(7, 11, close), 0, TAU); g.fill();
  // ghost: dotted fall line + ghost closing ring
  const ga = smooth((t - (F.v1 + 0.05)) / 0.2) * (1 - smooth((t - d - 0.35) / 0.25));
  if (ga > 0.01) {
    const pts = (u) => ({ x: rx, y: rTop + 20 + u * (rulerH + 120) });
    K.dotPath(g, pts, clamp((t - F.v1) / 0.3), 12, 3.6, ga, t);
    K.ring(g, rx, rTop + rulerH - 24, 34, 34, ga, t);
  }
  K.burst(g, rx + 6, rTop + rulerH - 30, 46, (t - (d + 0.03)) / 0.35, 2);
}
// V2 penalty keeper -----------------------------------------------------------------------------------
function v2(g, t) {
  const F = T.fin, kk = F.kick;
  g.drawImage(vgBG(1), 0, 0);
  // goal
  g.save(); g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 2;
  for (let x = 1480; x <= 1880; x += 26) { g.beginPath(); g.moveTo(x, 540); g.lineTo(x + 44, 840); g.stroke(); }
  for (let y = 540; y <= 840; y += 26) { g.beginPath(); g.moveTo(1480, y); g.lineTo(1880, y + 8); g.stroke(); }
  g.strokeStyle = '#f4f4fc'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(1480, 840); g.lineTo(1480, 540); g.lineTo(1880, 540); g.lineTo(1880, 840); g.stroke(); g.restore();
  // kicker
  const kO = { x: 600, y: FLOOR_Y + 12, s: FIN_S, facing: 1 };
  const kick = pe(t, kk - 0.02);
  const kSpec = vgHeroSpec({ fFx: 20, fBx: -20 }, { a1: lerp(0.1, 0.3, Math.max(0, kick)), a2: lerp(0.1, 0.26, Math.max(0, kick)), fFx: lerp(30, 100, Math.max(0, kick)), fFy: 28 * Math.max(0, kick), fBx: -26 - 24 * Math.max(-0.3, kick), hy: 18 + 4 * Math.max(0, kick), hFx: lerp(30, -10, Math.max(0, kick)), hFy: 30, hBx: lerp(20, 70, Math.max(0, kick)), hBy: 10 });
  const kp = K.pose(kSpec, t);
  K.fig(g, Object.assign({}, kO, { pose: kp, pal: PAL_GRN }));
  // ball path
  const tgt = { x: 1534, y: 596 }, bt0 = { x: 735, y: 826 };
  const flight = [{ t0: kk, t1: kk + 0.38, x0: bt0.x, y0: bt0.y, x1: tgt.x, y1: tgt.y, h: 40 }, { t0: kk + 0.38, t1: kk + 0.95, x0: tgt.x, y0: tgt.y, x1: 1440, y1: 826, h: 90 }];
  // keeper dives early
  const dv = smooth((t - (kk - 0.22)) / 0.6), kpO = { x: 1690, s: FIN_S, facing: -1 };
  const kSp = vgHeroSpec({}, { hFx: lerp(30, 14, dv), hFy: lerp(20, -80, dv), hBx: lerp(20, 8, dv), hBy: lerp(40, -80, dv), fFx: lerp(30, 40, dv), fBx: lerp(-30, -34, dv), a1: lerp(0.1, 0.0, dv), a2: lerp(0.1, 0.0, dv), hy: lerp(14, 20, dv) });
  const pv = K.pose(kSp, t), hipY = FLOOR_Y + 12 - 112 * FIN_S;
  const px = kpO.x - 120 * dv - 8 * Math.sin(t * 6) * (1 - dv), py = hipY - 70 * dv + (t > kk + 0.4 ? 40 * smooth((t - kk - 0.4) / 0.5) : 0);
  g.save(); g.translate(px, py); g.rotate(-1.28 * dv);
  K.fig(g, { x: 0, y: 112 * FIN_S, s: FIN_S, facing: -1, pose: pv, pal: HERO_PAL, shadow: false });
  g.restore();
  g.save(); g.translate(1700, FLOOR_Y + 14); g.scale(1, 0.12); radial(g, 0, 0, 110 + 40 * dv, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]); g.restore();
  const b = K.ballAt(flight, t);
  const ga = smooth((t - F.v2 - 0.05) / 0.2) * (1 - smooth((t - kk - 0.5) / 0.3));
  if (ga > 0.01) { K.dotPath(g, (u) => K.ballAt([flight[0]], lerp(kk, kk + 0.379, u)) || bt0, clamp((t - F.v2) / 0.35), 26, 3.6, ga, t); K.ring(g, tgt.x, tgt.y, 40, 40, ga, t); }
  if (!b) { if (t < kk) K.ball(g, bt0.x, bt0.y, 13, 0); } else { if (b.seg === 0) K.streaks(g, b.x, b.y, 0.96, -0.26, 200, 0.9, 5, 5, 12); K.ball(g, b.x, b.y, 13, b.seg === 0 ? 1 : 0); }
  K.burst(g, tgt.x, tgt.y, 54, (t - (kk + 0.38)) / 0.4, 8);
  K.puffs(g, 1590, FLOOR_Y + 12, (t - kk - 0.9) / 0.6, 4, 20, 3, 'rgba(255,255,255,', 60);
}
// V3 dodgeball ---------------------------------------------------------------------------------------
function v3(g, t) {
  const F = T.fin, th = F.throw;
  g.drawImage(vgBG(2), 0, 0);
  const rel = [th, th + 0.25, th + 0.5], ys = [596, 676, 800], arrive = [th + 0.4, th + 0.65, th + 0.9];
  const ths = [{ x: 190, c: '#2fb59a' }, { x: 380, c: '#f2c230' }, { x: 570, c: '#8a4fd8' }];
  ths.forEach((o, i) => {
    const e = pe(t, rel[i]), O = { x: o.x, y: FLOOR_Y + 12, s: FIN_S * 0.95, facing: 1 };
    const sp = vgHeroSpec({}, { a1: lerp(0.1, 0.34, Math.max(0, e)), a2: lerp(0.1, 0.46, Math.max(0, e)), hBx: lerp(20, 80, Math.max(0, e)), hBy: lerp(30, -20, Math.max(0, e)), hFx: 34, hFy: 10, hx: 18 * Math.max(0, e) });
    K.fig(g, Object.assign({}, O, { pose: K.pose(sp, t), pal: K.pal(o.c) }));
  });
  const dodgeSeq = [BX_DUCK, BX_LEAN, null];
  let hs = BX_G, lift = 0;
  [0, 1, 2].forEach((i) => {
    const e = env4(t, arrive[i] - 0.5, arrive[i] - 0.14, arrive[i] + 0.1, arrive[i] + 0.4);
    if (i < 2) hs = K.mix(hs, dodgeSeq[i], e); else { hs = K.mix(hs, bxk({ fFy: 70, fBy: 70, fFx: 24, fBx: -24, hy: 4, hFx: 30, hFy: -10, hBx: 20, hBy: -4, a1: 0.05, a2: 0.05 }), e); lift = e; }
  });
  const hO = { x: 1180, y: FLOOR_Y + 12 - 54 * lift, s: FIN_S, facing: -1 };
  g.save(); g.translate(1180, FLOOR_Y + 14); g.scale(1, 0.12); radial(g, 0, 0, 90 - 20 * lift, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]); g.restore();
  K.fig(g, Object.assign({}, hO, { pose: K.pose(hs, t), pal: HERO_PAL, shadow: false }));
  // ghost lines + balls
  rel.forEach((r0, i) => {
    const seg = [{ t0: r0, t1: r0 + 0.8, x0: ths[i].x + 80, y0: ys[i], x1: 1780, y1: ys[i] + 10, h: 0 }];
    const ga = smooth((t - (r0 - 0.5)) / 0.2) * (1 - smooth((t - arrive[i] - 0.2) / 0.25));
    if (ga > 0.01) K.dotPath(g, (u) => ({ x: lerp(ths[i].x + 80, 1780, u), y: lerp(ys[i], ys[i] + 10, u) }), clamp((t - (r0 - 0.5)) / 0.3), 34, 3.4, ga * 0.9, t);
    const b = K.ballAt(seg, t);
    if (b) { K.streaks(g, b.x, b.y, 1, 0.01, 220, 0.8, i + 3, 5, 10); K.ball(g, b.x, b.y, 16, 0.5, '#ff7a5a'); }
    K.burst(g, 1770, ys[i] + 10, 40, (t - (r0 + 0.8)) / 0.35, 3 + i);
  });
}
// finale: empty stadium -------------------------------------------------------------------------------
function sEmpty(g, lt) {
  const t = lt, F = T.fin, u = clamp((t - F.empty) / (T.dur - F.empty));
  const cz = lerp(1.7, 0.52, smooth(u * 1.05)), cy = lerp(700, 560, smooth(u)), cx = 1010;
  const cam = camBase(cx, cy, cz, 0);
  g.save(); camTransform(g, cam);
  drawStadium(g, cam, t, true);
  withLayer(g, cam, 1, () => {
    g.save(); g.translate(1000, FLOOR_Y + 12); g.scale(1, 0.13); radial(g, 0, 0, 100, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); g.restore();
    const sp = K.S({ hy: 14 + 1.5 * Math.sin(t * 1.6), a1: 0.05, a2: 0.06, ah: 0.04 * Math.sin(t * 0.7), hFx: 10, hFy: 66, hBx: -2, hBy: 66, eo: 1, eg: 0.5 + 0.3 * Math.sin(t * 2), fl: 0.3 });
    K.fig(g, { x: 1000, y: FLOOR_Y + 12, s: 1.15, facing: 1, pose: K.pose(sp, t), pal: HERO_PAL });
    // his sight pulsing out into the dark, then fading calm
    const ca = smooth((t - 29.0) / 0.4) * (1 - smooth((t - 30.3) / 0.5));
    K.ring(g, 1000, FLOOR_Y - 120, 260, 260, ca * 0.9, t - 29.0);
  });
  g.restore();
  const wi = 1 - smooth((t - F.empty) / 0.3);
  if (wi > 0.01) { K.whip(g, wi, 1, 61); flash(g, 0.7 * wi); }
}
function s4(g, lt) {
  const t = lt, F = T.fin;
  if (lt >= F.empty) { sEmpty(g, lt); return; }
  const k = t < F.v2 ? 0 : t < F.v3 ? 1 : 2, t0 = [F.v1, F.v2, F.v3][k], len = [F.v2 - F.v1, F.v3 - F.v2, F.empty - F.v3][k];
  const lu = (t - t0) / len;
  const cz = k === 0 ? 1.4 + 0.12 * lu : 1.0 + 0.08 * lu;
  const ccx = k === 0 ? 960 : 960, ccy = k === 0 ? 650 : 540;
  g.save();
  g.translate(W / 2, H / 2); g.scale(cz, cz); g.translate(-ccx, -ccy);
  [v1, v2, v3][k](g, t);
  g.restore();
  // whip cuts between vignettes
  const cuts = [F.v1, F.v2, F.v3];
  cuts.forEach((c0, i) => {
    const d = t - c0, a = i === 0 ? 1 - smooth((t - 24.0) / 0.25) : 1 - smooth(d / 0.22);
    if (a > 0.01 && d > -0.02 && (i > 0 || t < 24.4)) { K.whip(g, a, i % 2 ? -1 : 1, 71 + i); flash(g, 0.55 * a); }
  });
  const wo = smooth((t - 28.0) / 0.3);
  if (wo > 0.01) { K.whip(g, wo, 1, 81); flash(g, 0.8 * smooth((t - 28.12) / 0.18)); }
}

// @SHOTS-END

window.CH.ch3 = {
  draw(g, lt, dur) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (lt < T.s0End) s0(g, lt);
    else if (lt < T.ttEnd) s1(g, lt);
    else if (lt < T.boxEnd) s2(g, lt);
    else if (lt < T.bbEnd) s3(g, lt);
    else s4(g, lt);
    g.restore();
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
};
})();
