// ch5.js — "The Child" (28.3 s). CH.ch5.draw(g, lt, dur). Pure function of lt.
// Shots: S1 street+ball toss | S2 vision push-in | S3 ball escapes/girl chases | S4 ghost truck + ring (wide) | S5 sprint
//        S6 grab + real truck pass | S7 aftermath | S8 she never knows | S9 skyline pulses | S10 holo map, helpless
(function () {
'use strict';
const T0 = LAYOUT.ch5.start;
const W = 1920, H = 1080;

// ---------------------------------------------------------------- tiny math helpers
const up = (a) => ({ x: Math.sin(a), y: -Math.cos(a) });
const nr = (a) => ({ x: Math.cos(a), y: Math.sin(a) });
const add = (p, q, k) => { k = k == null ? 1 : k; return { x: p.x + q.x * k, y: p.y + q.y * k }; };
function ik2(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux, uy;
  if (d < 1e-6) { ux = 0; uy = 1; d = 1e-6; } else { ux = dx / d; uy = dy / d; }
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
// monotone cubic through keys [[t,v],...]
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
const frac = (x) => x - Math.floor(x);
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
const mixCam = (a, b, w) => ({ x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), w)) });

// ---------------------------------------------------------------- palettes
const PAL_GIRL = Object.assign({}, PAL_REAL, { hood: '#f2c230', hoodBack: '#d9a21c', hoodDark: '#a8741a', hoodLight: '#ffe27a', string: '#fff3c4' });

// ---------------------------------------------------------------- custom poses (local space, facing +x, feet y=0)
function mkPose(o) {
  const P = walkerPose({ eyeOpen: o.eo == null ? 1 : o.eo, eyeGlow: o.eg || 0, flutter: o.fl || 0, time: o.time || 0, lean: 0.1 });
  const hip = { x: o.hx || 0, y: o.hy == null ? -110 : o.hy };
  const a1 = o.a1 == null ? 0.1 : o.a1, a2 = o.a2 == null ? a1 : o.a2, ah = o.ah == null ? a2 : o.ah;
  const waist = add(hip, up(a1), 32), shTop = add(waist, up(a2), 36), headC = add(shTop, up(ah), 36);
  const J = add(add(shTop, up(a2), -8), nr(a2), -1);
  P.hip = hip; P.waist = waist; P.shTop = shTop; P.J = J; P.a1 = a1; P.a2 = a2; P.hunch = o.hunch || 0;
  P.head = { x: headC.x, y: headC.y, r: 29, rot: ah * 0.75 + (o.hr || 0) };
  const mkLeg = (L) => { const r = ik2(hip, { x: L[0], y: -7.5 - L[1] }, 56, 56, 1); return { hip: hip, knee: r.mid, ankle: r.end, pitch: L[2] }; };
  P.legF = mkLeg(o.lf || [4, 0, 0.1]); P.legB = mkLeg(o.lb || [-4, 0, 0.1]);
  const mkArm = (rel, abs) => { const t = abs ? { x: abs[0], y: abs[1] } : { x: J.x + rel[0], y: J.y + rel[1] }; const r = ik2(J, t, 39, 39, -1); return { sh: J, elbow: r.mid, hand: r.end }; };
  P.armF = mkArm(o.af || [8, 72], o.afA); P.armB = mkArm(o.ab || [-6, 72], o.abA);
  P.phone = { amt: 0, ang: 0 };
  return P;
}
function runLeg(u, A, L) {
  if (u < 0.4) { const q = u / 0.4; return [A * (1 - 2 * q), 0, lerp(0.3, -0.5, q)]; }
  const q = (u - 0.4) / 0.6, e = smooth(q) * 0.4 + q * 0.6;
  return [lerp(-A, A, e), L * Math.sin(Math.PI * Math.pow(q, 0.8)), lerp(-0.5, 0.3, smooth(q))];
}
function runPose(ph, o) {
  const u = frac(ph), A = o.A || 54, Lf = o.L || 50, lean = o.lean == null ? 0.42 : o.lean;
  const hy = -103 + 6 * Math.cos(4 * Math.PI * u + 0.3);
  const arm = (uu) => { const th = -1.05 * Math.cos(2 * Math.PI * uu) + 0.15, R = 52; return [Math.sin(th) * R, Math.cos(th) * R - 12 * Math.max(0, Math.sin(th))]; };
  return mkPose({ hy, a1: lean, a2: lean + 0.06, ah: lean - 0.12, lf: runLeg(u, A, Lf), lb: runLeg(frac(u + 0.5), A, Lf), af: arm(u), ab: arm(frac(u + 0.5)),
    eg: o.eg || 0, eo: 1, fl: 0.6, time: o.time || 0 });
}

// ---------------------------------------------------------------- timelines (local seconds)
const HX = [[0, 740], [3.0, 1020], [3.7, 1040], [10.3, 1040], [10.55, 1050], [11.0, 1170], [11.5, 1360], [12.0, 1570], [12.5, 1780], [13.0, 1960], [13.5, 2060], [14.0, 2110], [14.3, 2140], [14.7, 2235], [15.2, 2330], [15.5, 2345], [17.8, 2350], [30, 2350]];
const HY = [[0, 820], [12.6, 822], [13.6, 860], [14.3, 905], [14.55, 872], [14.9, 842], [15.2, 830], [15.4, 828], [30, 828]];
const GX = [[0, 1800], [4.667, 1800], [4.95, 1812], [5.3, 1930], [5.6, 2030], [5.95, 2125], [6.35, 2190], [6.6, 2205], [14.3, 2205], [14.9, 2262], [15.4, 2470], [18.0, 2500], [19.4, 2510], [20.0, 2620], [21.0, 2960], [30, 2960]];
const GY = [[0, 820], [5.45, 820], [5.7, 905], [14.3, 905], [14.7, 880], [15.1, 832], [15.4, 828], [30, 828]];
const FT = [[0, -2400], [6.9, 640], [7.55, 660], [7.95, 2250], [8.0, 2250], [8.5, 700], [9.6, 770], [10.5, 880], [11.5, 1110], [12.5, 1380], [13.6, 1700], [14.3, 1900], [14.9, 2150], [15.1, 2330], [15.3, 2650], [15.5, 3350], [15.7, 4150], [16.0, 5100], [30, 9000]];
const RING = [[7.3, 0], [9.6, 0.08], [10.3, 0.12], [12.0, 0.45], [13.6, 0.82], [14.3, 0.93], [15.1, 1.0]];
const CAMA_X = [[0, 1230], [3, 1290], [4.667, 1330]];
const CAMX = [[4.667, 1930], [5.5, 2010], [6.4, 2150], [6.9, 2230], [7.7, 1570], [10.3, 1640], [11.0, 1560], [11.5, 1690], [12.0, 1860], [12.5, 2030], [13.0, 2200], [13.6, 2300], [14.0, 2330], [16.0, 2340], [18.0, 2370], [21.0, 2420], [21.5, 2480], [30, 2480]];
const CAMY = [[4.667, 740], [6.9, 740], [7.7, 650], [10.3, 650], [12, 690], [14, 700], [16, 700], [21, 690], [21.5, 640], [30, 640]];
const CAMZ = [[4.667, 1.5], [6.9, 1.5], [7.7, 0.96], [10.3, 1.0], [11.5, 1.2], [13.5, 1.4], [14.5, 1.5], [16, 1.4], [18, 1.4], [20.5, 1.85], [21.1, 1.4], [21.5, 1.1], [30, 1.1]];

const sceneS = (y) => 0.92 + (y - 820) / 165 * 0.16;
const GIRL_S = (y) => 0.62 * (0.92 + (y - 820) / 165 * 0.16) / 0.92;
const T_IMPACT = 15.1;      // real truck nose reaches the pair
const T_GRAB = 14.3;
const T_CUT = 4.667, T_MAP = 24.133;

// ---------------------------------------------------------------- hero
function heroPose(lt, hx) {
  const eg = clamp((lt - 2.7) / 0.5) * (1 - smooth((lt - 14.3) / 1.2)) + clamp((lt - 21.3) / 0.4) * 0.9;
  const eo = clamp(spring(lt - 2.7, 200, 20)) * 0.85 + 0.15;
  const fn = {
    walk() {
      const v = vel(HX, lt), w = clamp(v / 120);
      return walkerPose({ phase: hx / STRIDE, walk: w, lean: 0.06 + 0.05 * w, bob: 1, eyeOpen: 1, eyeGlow: eg, flutter: 0.2 + 0.3 * w, time: lt, headDown: 0 });
    },
    run() { return runPose(hx / 285, { eg, time: lt, lean: 0.38 + 0.1 * smooth((lt - 10.4) / 0.8) }); },
    lunge() {
      return mkPose({ hy: -88, a1: 0.62, a2: 0.7, ah: 0.5, lf: [50, 0, 0.2], lb: [-62, 0, -0.5], af: [62, 40], ab: [40, 54], eg, fl: 0.7, time: lt });
    },
    leap() {
      const k = clamp((lt - 14.4) / 1.0);
      return mkPose({ hy: -100, a1: 0.35, a2: 0.4, ah: 0.25, lf: [34, 38 * Math.sin(Math.PI * k) + 6, 0.3], lb: [-30, 54 * Math.sin(Math.PI * k) + 8, -0.2], af: [40, 46], ab: [30, 56], eg: eg, fl: 0.9, time: lt });
    },
    land() { return mkPose({ hy: -82, a1: 0.5, a2: 0.58, ah: 0.4, lf: [30, 0, 0.1], lb: [-28, 0, -0.1], af: [44, 36], ab: [30, 50], fl: 0.5, time: lt }); },
    pant() {
      const b = Math.sin(lt * 5.6);
      return mkPose({ hy: -92 + 1.5 * b, a1: 0.85 + 0.05 * b, a2: 1.0 + 0.05 * b, ah: 0.7, lf: [26, 0, 0.1], lb: [-24, 0, -0.1], afA: [38, -50], abA: [18, -52], fl: 0.4, time: lt });
    },
    stand() { return walkerPose({ phase: 0, walk: 0, lean: 0.06, bob: 1, eyeOpen: 1, eyeGlow: eg, flutter: 0.25, time: lt, headDown: 0.12 + 0.05 * Math.sin(lt * 1.4) }); }
  };
  const segs = [[0, 10.3, 'walk'], [10.3, 13.95, 'run'], [13.95, 14.35, 'lunge'], [14.35, 15.35, 'leap'], [15.35, 15.8, 'land'], [15.8, 17.8, 'pant'], [17.8, 99, 'stand']];
  let i = 0; while (i < segs.length - 1 && lt >= segs[i + 1][0]) i++;
  let P = fn[segs[i][2]]();
  const bw = i === 3 || i === 2 ? 0.1 : 0.22;
  if (i > 0 && lt < segs[i][0] + bw) P = lerpObj(fn[segs[i - 1][2]](), P, smooth((lt - segs[i][0]) / bw));
  // hero eyes glow + open handled per pose
  P.eyeOpen = Math.max(P.eyeOpen, 1) * 1; P.eyeGlow = eg;
  if (lt < 2.7) { P.eyeOpen = 1; }
  void eo;
  return P;
}

// ---------------------------------------------------------------- girl + ball
function ballState(lt) {
  const gx = 1800, hand = gx + 34;
  if (lt < 4.667) {
    let q, x = hand;
    if (lt < 3.65) q = frac((lt - 0.65) / 1.0);
    else { q = (lt - 3.65) / 1.017; x = hand + 150 * smooth(q * q); }
    const y = 770 - 190 * 4 * q * (1 - q) + (lt >= 3.65 ? 36 * q * q * q * q : 0);
    return { x, y, rot: lt * 2 };
  }
  const bx = K([[4.667, 1984], [5.1, 2030], [5.5, 2100], [6.0, 2170], [6.4, 2205], [6.6, 2208], [30, 2208]], lt);
  const gnd = bx < 2030 ? 804 : bx > 2062 ? 889 : lerp(804, 889, smooth((bx - 2030) / 32));
  const tc = 5.12;
  let hop = 0;
  if (lt < tc) hop = 26 * Math.abs(Math.sin(Math.PI * (lt - 4.667) / 0.32));
  else if (lt < 6.6) hop = 36 * Math.exp(-(lt - tc) * 2.4) * Math.abs(Math.sin(Math.PI * (lt - tc) / 0.42));
  const rolling = lt < 6.6 ? 1 : 0;
  return { x: bx, y: gnd - hop, rot: bx / 18 * rolling + (lt >= 6.6 ? 2208 / 18 : 0) };
}
function girlPose(lt, gx, gy) {
  const bs = ballState(lt);
  const s = GIRL_S(gy);
  const fn = {
    toss() {
      const bl = { x: (bs.x - gx) / s, y: (bs.y - gy) / s };
      const near = bl.y > -140;
      const ah = clamp((-bl.y - 130) / 160) * -0.45;   // look up after the ball
      return mkPose({ hy: -110, a1: 0.05, a2: 0.05, ah: ah, lf: [4, 0, 0.1], lb: [-4, 0, 0.1], afA: [bl.x, bl.y + 12], abA: [bl.x - 6, bl.y + 14], fl: 0.5, time: lt, eg: 0, eo: near ? 1 : 1 });
    },
    miss() { return mkPose({ hy: -108, a1: 0.18, a2: 0.2, ah: -0.2, lf: [10, 0, 0.1], lb: [-8, 0, 0.1], af: [52, 40], ab: [46, 48], fl: 0.6, time: lt }); },
    run() { return runPose(gx / 205, { A: 46, L: 44, lean: 0.34, time: lt }); },
    pick() {
      const k = smooth((lt - 6.6) / 0.35) * (1 - smooth((lt - 7.0) / 0.35));
      const hold = smooth((lt - 7.2) / 0.3);
      return mkPose({ hy: lerp(-110, -70, k), a1: lerp(0.08, 0.65, k), a2: lerp(0.08, 0.75, k), ah: lerp(0.0, 0.5, k) - 0.2 * hold, lf: [lerp(4, 24, k), 0, 0.1], lb: [lerp(-4, -22, k), 0, 0.1],
        af: [lerp(lerp(8, 22, hold), 70, k), lerp(lerp(72, 40, hold), 60, k)], ab: [lerp(lerp(-6, 16, hold), 62, k), lerp(lerp(72, 44, hold), 66, k)], fl: 0.5, time: lt });
    },
    hold() {
      const sw = Math.sin(lt * 2.4);
      return mkPose({ hy: -110 + 1.5 * Math.abs(sw), a1: 0.04 + 0.03 * sw, a2: 0.06 + 0.04 * sw, ah: -0.12 + 0.12 * Math.sin(lt * 1.3), lf: [4, 0, 0.1], lb: [-4, 0, 0.1], af: [24, 38], ab: [14, 42], fl: 0.5, time: lt });
    },
    carried() { return mkPose({ hy: -104, a1: -0.05, a2: -0.05, ah: -0.25, lf: [12, 8, 0.4], lb: [-8, 14, -0.2], af: [-8, 70], ab: [-16, 68], fl: 0.8, time: lt }); },
    look() { // looks up at the hero, then waves and skips off
      const wv = smooth((lt - 19.0) / 0.2) * (1 - smooth((lt - 20.0) / 0.2));
      const up_ = 1 - smooth((lt - 19.6) / 0.4);
      return mkPose({ hy: -110, a1: 0.0, a2: 0.0, ah: -0.4 * up_, lf: [4, 0, 0.1], lb: [-4, 0, 0.1], af: [lerp(24, 40, wv), lerp(38, -40 + 14 * Math.sin(lt * 14), wv)], ab: [14, 42], fl: 0.5, time: lt });
    },
    skip() { return runPose(gx / 190, { A: 40, L: 38, lean: 0.16, time: lt }); }
  };
  const segs = [[0, 3.65, 'toss'], [3.65, 4.8, 'miss'], [4.8, 6.4, 'run'], [6.4, 7.5, 'pick'], [7.5, 14.1, 'hold'], [14.1, 15.8, 'carried'], [15.8, 19.4, 'look'], [19.4, 99, 'skip']];
  let i = 0; while (i < segs.length - 1 && lt >= segs[i + 1][0]) i++;
  // toss runs through the miss window; use toss until 4.667 so the arms keep tracking the ball
  const toss = lt < 4.8 ? fn.toss() : null;
  let P = lt < 4.667 ? toss : fn[segs[i][2]]();
  if (lt >= 4.667 && lt < 4.8) P = lerpObj(toss, fn.miss(), smooth((lt - 4.667) / 0.13));
  if (i > 2 && lt < segs[i][0] + 0.2) P = lerpObj(fn[segs[i - 1][2]](), P, smooth((lt - segs[i][0]) / 0.2));
  if (i === 2 && lt < segs[i][0] + 0.2) { /* miss -> run already blended */ }
  return P;
}
function drawBall(g, b, r) {
  r = r || 17;
  g.save(); g.translate(b.x, b.y);
  g.fillStyle = 'rgba(16,7,30,0.35)'; g.save(); g.translate(0, 0); g.restore();
  g.rotate(b.rot);
  const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
  gr.addColorStop(0, '#ff8a6b'); gr.addColorStop(0.6, '#e0402f'); gr.addColorStop(1, '#8a1d2a');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = '#fff5df'; g.lineWidth = r * 0.28; g.beginPath(); g.arc(0, 0, r * 0.98, 0.5, 2.2); g.stroke();
  g.beginPath(); g.moveTo(-r * 0.9, r * 0.1); g.quadraticCurveTo(0, -r * 0.7, r * 0.9, r * 0.1); g.stroke();
  g.strokeStyle = 'rgba(14,6,22,0.55)'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
  g.rotate(-b.rot);
  g.strokeStyle = '#ffb36b'; g.globalAlpha = 0.95; g.lineWidth = 2.4; g.lineCap = 'round';
  g.beginPath(); g.arc(0, 0, r + 0.5, -1.2, 0.5); g.stroke();
  g.restore();
}
function drawGirl(g, x, y, s, facing, pose, alpha, shadow) {
  const st = { x: x, y: y, s: s, facing: facing, pose: pose, pal: PAL_GIRL, alpha: alpha == null ? 1 : alpha, shadow: shadow !== false };
  drawWalker(g, st);
  const hj = walkerJoints(st), hr = pose.head.rot, f = facing;
  // pigtails + bow
  g.save(); g.translate(hj.head.x, hj.head.y); g.scale(f * s, s); g.rotate(hr * f * 0 + hr);
  g.fillStyle = '#4a2a1c'; g.strokeStyle = 'rgba(12,6,20,0.5)'; g.lineWidth = 1.3;
  const sw = 4 * Math.sin(pose.ff * 5.3);
  for (let k = 0; k < 2; k++) {
    const bx = -28 - k * 3, by = -6 + k * 16;
    g.beginPath(); g.moveTo(-18, by - 4); g.quadraticCurveTo(bx - 12, by - 16 + sw, bx - 16, by + 16 + sw * 2); g.quadraticCurveTo(bx + 4, by + 6, -18, by + 6); g.closePath(); g.fill(); g.stroke();
  }
  g.fillStyle = '#4a2a1c'; g.beginPath(); g.arc(-4, -34, 11, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#ff5a6e'; g.beginPath(); g.moveTo(-16, -10); g.lineTo(-30, -18); g.lineTo(-30, 2); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-16, -10); g.lineTo(-2, -22); g.lineTo(-2, 2); g.closePath(); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- truck
const TR = { box: '#d8d0c2', boxS: '#8f86a0', stripe: '#c8402f', cab: '#c0392e', cabS: '#6e1f26', glass: '#27386a', glassHi: 'rgba(190,220,255,0.35)', tire: '#15101d', hub: '#bdb8cc', hubD: '#6c6680', under: '#120d1a', edge: 'rgba(12,6,20,0.6)', rim: '#ffb36b', real: true };
const TG = { box: '#2aa7ff', boxS: '#1550e0', stripe: '#9ff0ff', cab: '#5fd9ff', cabS: '#1f78ff', glass: '#1550e0', glassHi: 'rgba(220,252,255,0.5)', tire: '#1f78ff', hub: '#d5fbff', hubD: '#36adff', under: '#1550e0', edge: 'rgba(196,246,255,0.95)', rim: null, real: false };
function truckBody(g, P, wa) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  const stroke = (w) => { g.strokeStyle = P.edge; g.lineWidth = w || 3; g.stroke(); };
  g.fillStyle = P.under; g.fillRect(-405, -88, 700, 44);
  // cargo box
  let gr = g.createLinearGradient(0, -392, 0, -66); gr.addColorStop(0, P.box); gr.addColorStop(1, P.boxS);
  rr(g, -432, -392, 524, 326, 14); g.fillStyle = gr; g.fill();
  g.save(); rr(g, -432, -392, 524, 326, 14); g.clip();
  if (P.real) {
    gr = g.createLinearGradient(-432, 0, 92, 0); gr.addColorStop(0, 'rgba(30,8,48,0.34)'); gr.addColorStop(0.6, 'rgba(30,8,48,0.02)'); gr.addColorStop(1, 'rgba(255,150,90,0.30)');
    g.fillStyle = gr; g.fillRect(-440, -400, 540, 340);
  }
  g.fillStyle = P.stripe; g.globalAlpha = P.real ? 1 : 0.7; g.fillRect(-440, -176, 540, 24); g.globalAlpha = 0.6; g.fillRect(-440, -138, 540, 8); g.globalAlpha = 1;
  g.strokeStyle = P.edge; g.globalAlpha = 0.35; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-345 + i * 86, -392); g.lineTo(-345 + i * 86, -66); g.stroke(); }
  g.globalAlpha = 1;
  // emblem (no text)
  g.fillStyle = P.cab; g.beginPath(); g.arc(-190, -285, 46, 0, TAU); g.fill(); stroke(3);
  g.strokeStyle = P.real ? '#fff3df' : '#eaffff'; g.lineWidth = 7; g.beginPath(); g.moveTo(-212, -270); g.lineTo(-190, -302); g.lineTo(-168, -270); g.stroke();
  g.restore();
  rr(g, -432, -392, 524, 326, 14); stroke(3.5);
  if (P.rim) { g.strokeStyle = P.rim; g.globalAlpha = 0.9; g.lineWidth = 3; g.beginPath(); g.moveTo(-420, -390); g.lineTo(80, -390); g.lineTo(90, -378); g.lineTo(90, -80); g.stroke(); g.globalAlpha = 1; }
  // exhaust stack
  g.fillStyle = P.real ? '#9a93ab' : P.hub; rr(g, 94, -420, 13, 300, 5); g.fill(); stroke(2);
  // cab
  g.beginPath(); g.moveTo(104, -66); g.lineTo(104, -318); g.lineTo(206, -318); g.quadraticCurveTo(232, -318, 252, -270); g.lineTo(268, -234); g.lineTo(322, -214); g.quadraticCurveTo(336, -206, 336, -190); g.lineTo(336, -66); g.closePath();
  gr = g.createLinearGradient(0, -318, 0, -66); gr.addColorStop(0, P.cab); gr.addColorStop(1, P.cabS);
  g.fillStyle = gr; g.fill();
  if (P.real) { g.save(); g.clip(); gr = g.createLinearGradient(104, 0, 336, 0); gr.addColorStop(0, 'rgba(30,8,48,0.3)'); gr.addColorStop(1, 'rgba(255,150,90,0.38)'); g.fillStyle = gr; g.fillRect(100, -320, 240, 260); g.restore(); }
  stroke(3.5);
  if (P.rim) { g.strokeStyle = P.rim; g.globalAlpha = 0.95; g.lineWidth = 3.4; g.beginPath(); g.moveTo(206, -316); g.quadraticCurveTo(230, -316, 250, -268); g.lineTo(266, -232); g.lineTo(320, -212); g.quadraticCurveTo(334, -204, 334, -190); g.lineTo(334, -70); g.stroke(); g.globalAlpha = 1; }
  // window
  g.beginPath(); g.moveTo(122, -296); g.lineTo(200, -296); g.quadraticCurveTo(220, -296, 234, -262); g.lineTo(248, -232); g.lineTo(122, -232); g.closePath();
  g.fillStyle = P.glass; g.fill(); g.save(); g.clip(); g.fillStyle = P.glassHi; g.beginPath(); g.moveTo(150, -300); g.lineTo(178, -300); g.lineTo(140, -228); g.lineTo(112, -228); g.closePath(); g.fill(); g.restore(); stroke(2.6);
  g.strokeStyle = P.edge; g.lineWidth = 2.4; g.beginPath(); g.moveTo(190, -226); g.lineTo(190, -84); g.moveTo(166, -196); g.lineTo(182, -196); g.stroke();
  // grille / bumper / lights
  g.fillStyle = P.real ? '#1c1424' : P.under; g.fillRect(318, -190, 20, 72); g.fillRect(304, -108, 44, 34);
  if (P.real) { g.strokeStyle = 'rgba(255,179,107,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(348, -108); g.lineTo(348, -76); g.stroke(); }
  g.fillStyle = P.real ? '#fff4cc' : '#ffffff'; g.beginPath(); g.ellipse(330, -148, 9, 14, 0, 0, TAU); g.fill();
  g.fillStyle = P.real ? '#ff3b4f' : '#c8f6ff'; g.fillRect(-440, -160, 10, 44);
  // wheels
  const WH = [-345, -262, 214];
  for (let i = 0; i < 3; i++) {
    const cx = WH[i], cy = -56;
    g.fillStyle = P.real ? '#0b0712' : P.under; g.beginPath(); g.arc(cx, cy, 68, Math.PI, 0); g.lineTo(cx + 68, cy + 10); g.lineTo(cx - 68, cy + 10); g.closePath(); g.fill();
    g.fillStyle = P.tire; g.beginPath(); g.arc(cx, cy, 56, 0, TAU); g.fill(); stroke(2.5);
    if (P.rim) { g.strokeStyle = P.rim; g.globalAlpha = 0.95; g.lineWidth = 2.6; g.beginPath(); g.arc(cx, cy, 55, -1.4, 0.45); g.stroke(); g.globalAlpha = 1; }
    g.fillStyle = P.hub; g.beginPath(); g.arc(cx, cy, 33, 0, TAU); g.fill();
    g.strokeStyle = P.hubD; g.lineWidth = 5;
    for (let k = 0; k < 6; k++) { const a = wa + k * TAU / 6; g.beginPath(); g.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8); g.lineTo(cx + Math.cos(a) * 29, cy + Math.sin(a) * 29); g.stroke(); }
    g.fillStyle = P.hubD; g.beginPath(); g.arc(cx, cy, 9, 0, TAU); g.fill();
  }
}
let GCV = null;
function drawTruck(g, nose, y, alpha, ghost, tt) {
  const s = 1.0, x = nose - 336 * s, wa = nose / 56;
  if (!ghost) {
    // contact shadow + headlight beam
    drawShadow(g, x + 60 * s, y, 820, 0.55);
    g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = alpha;
    truckBody(g, TR, wa);
    g.globalCompositeOperation = 'lighter';
    const bg = g.createLinearGradient(338, 0, 900, 0); bg.addColorStop(0, 'rgba(255,225,160,0.34)'); bg.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = bg; g.beginPath(); g.moveTo(338, -150); g.lineTo(900, -40); g.lineTo(900, -250); g.closePath(); g.fill();
    glow(g, 332, -148, 70, '255,230,170', 0.55);
    g.restore();
    return;
  }
  if (!GCV) { GCV = document.createElement('canvas'); GCV.width = 1100; GCV.height = 520; }
  const c = GCV.getContext('2d'), ox = 560, oy = 440;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.filter = 'none'; c.clearRect(0, 0, 1100, 520);
  c.save(); c.translate(ox, oy); truckBody(c, TG, wa); c.restore();
  c.globalCompositeOperation = 'destination-out';
  for (let yy = 0; yy < 520; yy += 11) { const hh = hash1(yy + 3); if (hh > 0.7) continue; c.fillStyle = `rgba(0,0,0,${0.45 + 0.3 * hh})`; c.fillRect(0, yy + frac(tt * 0.6) * 11, 1100, 1.4 + 1.8 * hh); }
  c.globalCompositeOperation = 'source-over';
  g.save(); g.translate(x, y); g.scale(s, s); g.globalCompositeOperation = 'lighter';
  g.filter = 'blur(8px)'; g.globalAlpha = Math.min(1, alpha * 0.55); g.drawImage(GCV, -ox, -oy);
  g.filter = 'none'; g.globalAlpha = Math.min(1, alpha * 0.75); g.drawImage(GCV, -ox, -oy);
  const bg = g.createLinearGradient(338, 0, 900, 0); bg.addColorStop(0, `rgba(140,230,255,${0.3 * alpha})`); bg.addColorStop(1, 'rgba(140,230,255,0)');
  g.globalAlpha = 1; g.fillStyle = bg; g.beginPath(); g.moveTo(338, -150); g.lineTo(900, -40); g.lineTo(900, -250); g.closePath(); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- camera
function camAt(lt) {
  let cam;
  if (lt < T_CUT) {
    const push = smooth((lt - 2.5) / 1.3);
    const hx = K(HX, lt);
    const wide = { x: K(CAMA_X, lt), y: 640, z: 1.0 };
    const tight = { x: hx + 110, y: 652, z: 2.15 };
    cam = mixCam(wide, tight, push);
  } else cam = { x: K(CAMX, lt), y: K(CAMY, lt), z: Math.exp(K(CAMZ.map((k) => [k[0], Math.log(k[1])]), lt)) };
  const sk = shakeAt(lt, T_IMPACT, 30, 5.5), sk2 = shakeAt(lt, T_GRAB, 8, 9), sk3 = shakeAt(lt, 15.5, 8, 8), sk4 = shakeAt(lt, T_CUT, 7, 12);
  cam.x += sk.x + sk2.x + sk3.x + sk4.x; cam.y += sk.y + sk2.y + sk3.y + sk4.y; cam.r = sk.r + sk2.r;
  return cam;
}

// ---------------------------------------------------------------- fx
function dustAndWind(g, lt, cam) {
  if (lt < T_IMPACT - 0.2 || lt > 18.5) return;
  // road dust puffs behind the truck
  withLayer(g, cam, 1, () => {
    for (let i = 0; i < 30; i++) {
      const ts = 14.95 + i * 0.026, age = lt - ts; if (age < 0 || age > 1.8) continue;
      const hs = hash1(i * 7 + 1), hy = hash1(i * 7 + 2);
      const x = K(FT, ts) - 330 - age * (60 + hs * 120) + (hs - 0.5) * 120, yy = 905 - 6 - age * (36 + hy * 60) - hy * 40;
      const r = 36 + age * (130 + hs * 80), a = 0.34 * (1 - age / 1.8) * smooth(age / 0.1);
      const gr = g.createRadialGradient(x, yy, 0, x, yy, r); gr.addColorStop(0, `rgba(176,128,118,${a})`); gr.addColorStop(0.6, `rgba(130,86,98,${a * 0.6})`); gr.addColorStop(1, 'rgba(120,80,100,0)');
      g.fillStyle = gr; g.fillRect(x - r, yy - r, r * 2, r * 2);
    }
    // flying litter
    for (let i = 0; i < 16; i++) {
      const age = lt - (15.12 + hash1(i * 5 + 9) * 0.12); if (age < 0 || age > 2.4) continue;
      const hs = hash1(i * 5 + 3), hy = hash1(i * 5 + 4);
      const x = 2250 + hs * 500 + age * (900 - age * 300) * (0.6 + hs * 0.6), y = 880 - hy * 150 - age * (120 + hy * 160) + age * age * 90;
      g.save(); g.translate(x, y); g.rotate(age * (6 + hs * 8) + i); g.fillStyle = i % 3 === 0 ? 'rgba(255,214,150,0.85)' : i % 3 === 1 ? 'rgba(236,230,255,0.8)' : 'rgba(196,110,70,0.85)';
      g.globalAlpha = 1 - smooth((age - 1.6) / 0.8);
      g.fillRect(-6, -4, 12, 8); g.restore();
    }
  });
  // wind streaks (screen space)
  const a = win(lt, T_IMPACT - 0.1, 16.3, 0.1, 0.7);
  if (a > 0.01) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const hs = hash1(i * 3 + 100), hy = hash1(i * 3 + 101), hl = hash1(i * 3 + 102);
      const y = 380 + hy * 640, len = 400 + hl * 900, x = ((lt * (6000 + hs * 2500) + hs * 3000) % 4200) - 900;
      const gr = g.createLinearGradient(x - len, 0, x, 0); gr.addColorStop(0, 'rgba(255,225,190,0)'); gr.addColorStop(1, `rgba(255,236,210,${0.3 * a})`);
      g.fillStyle = gr; g.fillRect(x - len, y, len, 2 + hs * 3);
    }
    g.restore();
  }
}
function drift(g, lt, cam, t0, t1) { // slow falling leaves after the pass
  if (lt < t0 || lt > t1) return;
  withLayer(g, cam, 1, () => {
    for (let i = 0; i < 10; i++) {
      const hs = hash1(i * 9 + 5), hy = hash1(i * 9 + 6), age = lt - t0;
      const x = 2000 + hs * 800 + Math.sin(age * 1.6 + i) * 60 + age * 30, y = 500 + hy * 200 + age * (40 + hs * 30);
      g.save(); g.translate(x, y); g.rotate(age * 2 + i); g.fillStyle = i % 2 ? 'rgba(255,170,100,0.85)' : 'rgba(210,120,70,0.85)'; g.globalAlpha = 0.9 * win(lt, t0, t1, 0.4, 0.6);
      g.beginPath(); g.ellipse(0, 0, 8, 4, 0, 0, TAU); g.fill(); g.restore();
    }
  });
}
function ringAt(g, lt, cam) {
  if (lt < 7.3 || lt > 15.35) return;
  const ap = smooth((lt - 7.3) / 0.3) * (1 - smooth((lt - 14.85) / 0.2));
  if (ap < 0.01) return;
  const p = clamp(K(RING, lt)), sp = project(cam, K(GX, lt), lt > 13.6 ? 520 : 640, 1);
  drawTimerRing(g, sp.x, sp.y, (lt > 13.6 ? 190 : 230) * cam.z, { value: 10 * (1 - p), progress: p, appear: ap, time: lt });
}
function speedLines(g, lt, a) { drawSpeedLines(g, T0 + lt, a); }
function guide(g, lt, cam) { // ghost path ribbon from hero to girl
  if (lt < 10.3 || lt > 14.2) return;
  const a = win(lt, 10.3, 14.2, 0.3, 0.3);
  withLayer(g, cam, 1, () => {
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    const hx = K(HX, lt) + 40, gx = 2190;
    g.strokeStyle = `rgba(127,233,255,${0.45 * a})`; g.lineWidth = 3; g.setLineDash([22, 18]); g.lineDashOffset = -lt * 160;
    g.beginPath(); g.moveTo(hx, 826); g.quadraticCurveTo((hx + gx) / 2, 840, gx, 895); g.stroke();
    g.restore();
  });
}

// ---------------------------------------------------------------- skyline pulses (S9)
function skyPulses(g, lt, cam) {
  if (lt < 21.3 || lt > T_MAP + 0.1) return;
  const tt = lt - 21.3;
  [0.14, 0.26, 0.5].forEach((par, li) => {
    withLayer(g, cam, par, () => {
      const n = [14, 16, 18][li];
      for (let i = 0; i < n; i++) {
        const act = 0.1 + (i * 3 + li) * 0.07 * (1 - 0.3 * tt / 3); const age = tt - act; if (age < 0) continue;
        const hs = hash1(i * 17 + li * 5), hy = hash1(i * 17 + li * 5 + 1);
        const wx = 2450 * par + (hs - 0.5) * 1750, wy = [470, 520, 600][li] + hy * [90, 100, 120][li];
        const per = 1.1 + hash1(i + li * 11) * 0.8, q = frac(age / per);
        const sz = [26, 34, 46][li];
        const a = [0.55, 0.7, 0.85][li] * smooth(age / 0.2);
        g.save(); g.globalCompositeOperation = 'lighter';
        glow(g, wx, wy, sz * 1.8, '127,233,255', a * 0.7);
        g.strokeStyle = `rgba(190,245,255,${a * (1 - q)})`; g.lineWidth = 2.4; g.beginPath(); g.ellipse(wx, wy, sz * (0.5 + q * 3.2), sz * (0.5 + q * 3.2) * 0.4, 0, 0, TAU); g.stroke();
        g.fillStyle = `rgba(235,253,255,${a})`; g.beginPath(); g.arc(wx, wy, 3.2 + 1.4 * Math.sin(age * 9), 0, TAU); g.fill();
        g.fillStyle = `rgba(127,233,255,${a * 0.25})`; g.fillRect(wx - 1.2, wy - 140 * (li + 1) * 0.4, 2.4, 140 * (li + 1) * 0.4);
        g.restore();
      }
    });
  });
}

// ---------------------------------------------------------------- holo map (S10)
let MAPC = null;
const MAP_Y0 = 360;
function mproj(mx, my) { // my 0..1 far->near, mx -1..1
  const z = 1 + (1 - my) * 3.2;
  return { x: 1180 + mx * 1350 / z, y: MAP_Y0 + (1 / z - 0.238) / 0.762 * 760, sc: 1 / z };
}
function mapBase() {
  if (MAPC) return MAPC;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  let gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#04081c'); gr.addColorStop(0.35, '#08143a'); gr.addColorStop(1, '#0a2a5c');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  gr = x.createRadialGradient(1180, 560, 20, 1180, 560, 900); gr.addColorStop(0, 'rgba(40,140,230,0.28)'); gr.addColorStop(1, 'rgba(40,140,230,0)');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  // horizon haze
  gr = x.createLinearGradient(0, MAP_Y0 - 50, 0, MAP_Y0 + 120); gr.addColorStop(0, 'rgba(90,200,255,0)'); gr.addColorStop(0.4, 'rgba(90,200,255,0.18)'); gr.addColorStop(1, 'rgba(90,200,255,0)');
  x.fillStyle = gr; x.fillRect(0, MAP_Y0 - 50, W, 170);
  // street grid (irregular)
  x.lineCap = 'round';
  const rx = rng(5150);
  const vx = [], hy = [];
  for (let i = 0; i <= 22; i++) vx.push(-1.25 + i * 0.114 + (rx() - 0.5) * 0.04);
  for (let j = 0; j <= 20; j++) hy.push(Math.pow(j / 20, 1.0) + (rx() - 0.5) * 0.01);
  x.strokeStyle = 'rgba(90,200,255,0.30)'; x.lineWidth = 1.4;
  vx.forEach((mx) => { const a = mproj(mx, 0), b = mproj(mx, 1); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); });
  hy.forEach((my) => { const a = mproj(-1.3, my), b = mproj(1.3, my); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); });
  // main avenues, brighter
  x.strokeStyle = 'rgba(140,225,255,0.5)'; x.lineWidth = 2.4;
  [3, 8, 14, 19].forEach((i) => { const a = mproj(vx[i], 0), b = mproj(vx[i], 1); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); });
  [4, 10, 16].forEach((j) => { const a = mproj(-1.3, hy[j]), b = mproj(1.3, hy[j]); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); });
  // blocks: extruded boxes, far to near
  const blocks = [];
  for (let i = 0; i < vx.length - 1; i++) for (let j = 0; j < hy.length - 1; j++) {
    if (rx() < 0.38) continue;
    const m0 = vx[i] + 0.02, m1 = vx[i + 1] - 0.02, y0 = hy[j] + 0.008, y1 = hy[j + 1] - 0.008, h = 0.012 + rx() * rx() * 0.075;
    blocks.push([m0, m1, y0, y1, h]);
  }
  blocks.sort((a, b) => a[2] - b[2]);
  blocks.forEach((b) => {
    const p00 = mproj(b[0], b[3]), p10 = mproj(b[1], b[3]), p01 = mproj(b[0], b[2]), p11 = mproj(b[1], b[2]);
    const hh = b[4] * 1000 * p00.sc;
    x.fillStyle = 'rgba(12,40,92,0.92)'; x.beginPath(); x.moveTo(p00.x, p00.y); x.lineTo(p10.x, p10.y); x.lineTo(p10.x, p10.y - hh); x.lineTo(p00.x, p00.y - hh); x.closePath(); x.fill();
    x.fillStyle = 'rgba(30,96,180,0.85)'; x.beginPath(); x.moveTo(p00.x, p00.y - hh); x.lineTo(p10.x, p10.y - hh); x.lineTo(p11.x, p11.y - hh * (p11.sc / p00.sc)); x.lineTo(p01.x, p01.y - hh * (p01.sc / p00.sc)); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(140,225,255,0.55)'; x.lineWidth = 1.2; x.stroke();
    x.beginPath(); x.moveTo(p00.x, p00.y - hh); x.lineTo(p10.x, p10.y - hh); x.stroke();
  });
  MAPC = c; return c;
}
const MAP_PTS = (() => {
  const r = rng(7721), pts = [];
  for (let i = 0; i < 72; i++) pts.push({ mx: -1.05 + r() * 2.1, my: 0.06 + Math.pow(r(), 0.8) * 0.9, per: 1.2 + r() * 1.3, ph: r(), big: r() < 0.18 });
  return pts;
})();
function holoMap(g, lt) {
  const tt = lt - T_MAP;
  const sway = Math.sin(lt * 0.5) * 8;
  g.save();
  const zoom = 1.0 + 0.035 * (tt / 4.2);
  g.translate(W / 2 + sway, H / 2); g.scale(zoom, zoom); g.translate(-W / 2, -H / 2);
  g.drawImage(mapBase(), 0, 0);
  // sweep scan
  const sw = frac(lt * 0.32);
  g.save(); g.globalCompositeOperation = 'lighter';
  const sy = MAP_Y0 + sw * 700; const gr = g.createLinearGradient(0, sy - 60, 0, sy + 4); gr.addColorStop(0, 'rgba(90,200,255,0)'); gr.addColorStop(1, 'rgba(150,235,255,0.20)');
  g.fillStyle = gr; g.fillRect(0, sy - 60, W, 64);
  g.restore();
  // hero's reach: a tiny solid circle, everything else is outside it
  const hm = mproj(-0.62, 0.84), rh = 70 * hm.sc * 2.2;
  g.save(); g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,90,90,0.18)'; g.beginPath(); g.ellipse(hm.x, hm.y, rh, rh * 0.38, 0, 0, TAU); g.fill();
  g.strokeStyle = `rgba(255,120,110,${0.75})`; g.lineWidth = 2.4; g.beginPath(); g.ellipse(hm.x, hm.y, rh, rh * 0.38, 0, 0, TAU); g.stroke();
  glow(g, hm.x, hm.y, 26, '255,120,110', 0.8);
  g.restore();
  // pulses: more and more of them
  const nAct = Math.floor(clamp(tt / 3.1) ** 1.5 * MAP_PTS.length * 1.0 + 3);
  const sync = win(lt, 26.95, 27.9, 0.05, 0.5);
  const order = MAP_PTS.map((p, i) => ({ p, i, d: hash1(i * 13 + 4) })).sort((a, b) => a.d - b.d);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < Math.min(nAct, order.length); k++) {
    const p = order[k].p, pr = mproj(p.mx, p.my), born = (tt / 3.1 > 0 ? 0 : 0) + (k / order.length) * 3.0;
    const age = tt - Math.pow(k / order.length, 0.65) * 3.0; if (age < 0) continue;
    const q = frac(age / p.per + p.ph), appear = smooth(age / 0.25);
    const sc = pr.sc * (p.big ? 1.6 : 1.0);
    const R = (14 + 70 * q) * sc * 1.6;
    const a = (0.35 + 0.65 * (1 - q)) * appear;
    g.strokeStyle = `rgba(150,240,255,${a * 0.9})`; g.lineWidth = Math.max(1.2, 2.6 * sc * 1.6);
    g.beginPath(); g.ellipse(pr.x, pr.y, R, R * 0.4, 0, 0, TAU); g.stroke();
    g.strokeStyle = `rgba(150,240,255,${a * 0.4})`; g.beginPath(); g.ellipse(pr.x, pr.y, R * 0.55, R * 0.22, 0, 0, TAU); g.stroke();
    glow(g, pr.x, pr.y, 22 * sc * 1.8 + 6, '127,233,255', 0.65 * appear);
    g.fillStyle = `rgba(240,254,255,${appear})`; g.beginPath(); g.arc(pr.x, pr.y, Math.max(2, 3.6 * sc * 1.6), 0, TAU); g.fill();
    // a thin beam of light straight up
    g.fillStyle = `rgba(127,233,255,${0.22 * appear})`; g.fillRect(pr.x - 1, pr.y - 90 * sc * 1.6, 2, 90 * sc * 1.6);
    if (sync > 0.01) { glow(g, pr.x, pr.y, 60 * sc * 1.8, '190,250,255', 0.5 * sync); }
  }
  g.restore();
  // dashed lines from the hero circle to the farthest pulses: too far
  g.save(); g.globalCompositeOperation = 'lighter'; g.setLineDash([6, 12]); g.lineDashOffset = -lt * 40; g.lineWidth = 1.4;
  for (let k = 0; k < 6; k++) {
    const p = MAP_PTS[(k * 11) % MAP_PTS.length], pr = mproj(p.mx, p.my);
    const a = 0.22 * smooth((tt - 1.2 - k * 0.3) / 0.5); if (a <= 0) continue;
    g.strokeStyle = `rgba(150,240,255,${a})`; g.beginPath(); g.moveTo(hm.x, hm.y); g.quadraticCurveTo((hm.x + pr.x) / 2, Math.min(hm.y, pr.y) - 120, pr.x, pr.y); g.stroke();
  }
  g.restore();
  g.restore();
}

// ---------------------------------------------------------------- draw
function draw(g, lt, dur) {
  const cam = camAt(lt);
  const tw = T0 + lt;
  g.save();
  if (cam.r) { g.translate(W / 2, H / 2); g.rotate(cam.r); g.translate(-W / 2, -H / 2); }

  const mapOn = lt >= T_MAP;
  const hx = K(HX, lt), hy = K(HY, lt), gx = K(GX, lt), gy = K(GY, lt);
  const hs = sceneS(hy) - (lt > 14.4 && lt < 15.4 ? 0 : 0), gs = GIRL_S(gy);

  if (!mapOn) {
    drawWorld(g, cam, tw);

    // ---- real girl (under the grade)
    const carried = lt >= 14.1 && lt < 15.8;
    const gFace = (lt >= 15.8 && lt < 19.4) ? -1 : 1;
    const gp = girlPose(lt, gx, gy);
    // ball on the ground before the girl scoops it up
    const bs = ballState(lt);
    const ballHeld = lt >= 7.35;
    if (!carried) {
      withLayer(g, cam, 1, () => {
        if (!ballHeld) {
          if (lt >= 4.667) drawShadow(g, bs.x, bs.x < 2040 ? 818 : 903, 40, 0.4);
          drawBall(g, bs, 17);
        }
        drawGirl(g, gx, gy, gs, gFace, gp, 1, true);
        if (ballHeld && lt < 14.1) { // held against her chest
          const hj = walkerJoints({ x: gx, y: gy, s: gs, facing: 1, pose: gp });
          drawBall(g, { x: hj.handF.x + 4, y: hj.handF.y - 4, rot: 0.6 }, 15);
        }
      });
    }

    // ---- vision grade
    let vg = 0;
    if (lt < T_CUT) vg = 0.38 * smooth((lt - 2.7) / 0.8);
    else if (lt < 7.0) vg = 0;
    else if (lt < 14.3) vg = 0.4 * smooth((lt - 7.0) / 0.6);
    else vg = 0.4 * (1 - smooth((lt - 14.3) / 0.6));
    if (lt >= 21.3) vg = Math.max(vg, 0.5 * smooth((lt - 21.3) / 0.7));
    visionGrade(g, vg);

    // ---- ghost truck (cyan) / real truck cross-fade
    const nose = K(FT, lt);
    const gT = lt >= 6.9 && lt < 14.6 ? (1 - smooth((lt - 14.1) / 0.45)) * smooth((lt - 6.9) / 0.2) : 0;
    const rT = lt >= 14.0 && lt < 17.3 ? smooth((lt - 14.0) / 0.4) : 0;
    const farTruck = nose - 336 - 440; // rear end
    void farTruck;

    // preview sweep: ghost girl flash at the end of it
    if (lt >= 7.9 && lt < 8.5) {
      const k = (lt - 7.9) / 0.6;
      withLayer(g, cam, 1, () => {
        g.save(); g.globalCompositeOperation = 'lighter';
        const a = (1 - k) * smooth(k * 8);
        glow(g, 2210, 800, 260, '180,245,255', 0.65 * a);
        g.strokeStyle = `rgba(220,252,255,${0.9 * a})`; g.lineWidth = 6; g.beginPath(); g.ellipse(2210, 900, 40 + k * 340, (40 + k * 340) * 0.3, 0, 0, TAU); g.stroke();
        g.restore();
      });
    }
    if (gT > 0.01) withLayer(g, cam, 1, () => drawTruck(g, nose, 915, gT, true, tw));

    // ---- hero (after the grade keeps the red hoodie)
    const hp = heroPose(lt, hx);
    const hst = { x: hx, y: hy - (lt > 14.4 && lt < 15.5 ? 38 * Math.sin(Math.PI * clamp((lt - 14.4) / 1.1)) : 0), s: hs, facing: 1, pose: hp, pal: PAL_REAL, alpha: 1, shadow: true };
    withLayer(g, cam, 1, () => {
      drawWalker(g, hst);
      if (carried) {
        const hj = walkerJoints(hst);
        const gHip = 110 * gs;
        g.save(); g.translate(hj.handF.x - 6, hj.handF.y - 2); g.rotate(Math.PI / 2 - 0.35 + 0.05 * Math.sin(lt * 9));
        drawGirl(g, 0, gHip, gs, 1, gp, 1, false);
        g.restore();
      }
    });

    // ---- ghost guide ribbon + real truck
    guide(g, lt, cam);
    if (rT > 0.01) {
      withLayer(g, cam, 1, () => drawTruck(g, nose, 915, rT, false, tw));
    }
    // ---- sprint speed lines
    speedLines(g, lt, win(lt, 10.7, 14.0, 0.4, 0.4) * 0.75);

    // ---- ring
    ringAt(g, lt, cam);

    // ---- skyline pulses
    skyPulses(g, lt, cam);

    // ---- fx after the truck
    dustAndWind(g, lt, cam);
    drift(g, lt, cam, 16.0, 21.5);

    drawForeground(g, cam, tw);
  } else {
    holoMap(g, lt);
    // hero in the foreground, looking at the pulses
    const k = smooth((lt - T_MAP) / 0.6);
    const sag = smooth((lt - 26.0) / 1.2);
    const hp = walkerPose({ phase: 0, walk: 0, lean: 0.02 + 0.1 * sag, bob: 1, eyeOpen: 1, eyeGlow: 0.9, flutter: 0.2, time: lt, headDown: 0.1 + 0.6 * sag + 0.04 * Math.sin(lt * 1.2) });
    const hst = { x: 360, y: 1130, s: 1.75, facing: 1, pose: hp, pal: PAL_REAL, alpha: 1, shadow: false };
    g.save();
    glow(g, 520, 700, 520, '60,160,255', 0.22 * k);
    drawWalker(g, hst);
    // cyan light spilling on him from the map
    g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(260, 0, 700, 0); gr.addColorStop(0, 'rgba(60,160,255,0)'); gr.addColorStop(1, 'rgba(60,160,255,0.12)');
    g.fillStyle = gr; g.fillRect(260, 600, 440, 480);
    g.restore();
    // drifting motes
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const hs2 = hash1(i * 3 + 1), hy2 = hash1(i * 3 + 2), dd = hash1(i * 3 + 3);
      const x = hs2 * W + Math.sin(lt * 0.5 + i) * 20, y = ((hy2 - lt * (0.02 + 0.03 * dd)) % 1 + 1) % 1 * H;
      glow(g, x, y, 3 + dd * 5, '150,235,255', 0.25 + 0.2 * Math.sin(lt * 2 + i));
    }
    g.restore();
    // cut-in flash and glitch
    if (lt < T_MAP + 0.4) flash(g, 0.7 * (1 - (lt - T_MAP) / 0.4) ** 2, '#cfefff');
  }

  // ---- flashes / glitches
  if (lt >= T_CUT && lt < T_CUT + 0.3) flash(g, 0.55 * (1 - (lt - T_CUT) / 0.3) ** 2, '#fff2e0');
  if (lt >= T_IMPACT && lt < T_IMPACT + 0.25) flash(g, 0.55 * (1 - (lt - T_IMPACT) / 0.25) ** 2, '#ffe9cf');
  if (lt >= 7.95 && lt < 8.1) flash(g, 0.5 * (1 - (lt - 7.95) / 0.15), '#bfefff');
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  let sp = 0;
  if (lt >= T_IMPACT && lt < T_IMPACT + 0.22) sp = 9 * (1 - (lt - T_IMPACT) / 0.22);
  if (lt >= 23.55 && lt < 23.75) sp = 7;
  if (lt >= 7.95 && lt < 8.1) sp = 6;
  if (lt >= 2.7 && lt < 2.85) sp = 4;
  if (sp > 0.5) rgbSplit(g, sp);
  void dur;
}

window.CH = window.CH || {};
window.CH.ch5 = { draw: draw };
})();
