// mascot.js — the expressive host. Global MASCOT. Wraps rigs.js (drawWalker) with its own skeleton/IK so every pose is
// a parameter vector (blendable), then paints eyes / props / FX on top.  Pure function of its inputs (frame-pure).
// Needs lib.js (clamp, lerp, smooth, spring, hash1, mixHex) and rigs.js (PAL_REAL, walkerPose, drawWalker).
//
// MASCOT.draw(g, st)   st = {x, y, s=1, facing=1, pose, t=0, expr, props, pal, alpha=1, shadow=true,
//                            speed, phase, amp, dir, at, seat, look...}
//   x,y   = feet position on the ground (like drawWalker); s = scale; facing = +1 / -1
//   pose  = 'stand' | name | {name, ...params} | {a, b, k}  (blend between two poses, a/b are names or pose objects)
//   expr  = name string | {eyes, eyes2, k, look, face, blink, sweat, shiver, steam, breath, sleepZ, sparkle, lines, pop, popT, ...}
//   props = {umbrella, sunglasses, scarf, blanket, fan, waterBottle, plate, flashlight, towel, mug, beanie}  (true | 0..1 | {opts})
// MASCOT.joints(st) -> world-space anchors (head, eyes, top, bubble, handF, handB, feet ...)
(function (G) {
'use strict';

const TAU = Math.PI * 2;
const AH = 7.5, THIGH = 56, SHIN = 56, UARM = 39, FARM = 39;
const up = (a) => ({ x: Math.sin(a), y: -Math.cos(a) });
const nr = (a) => ({ x: Math.cos(a), y: Math.sin(a) });
const add = (p, q, k) => { k = k == null ? 1 : k; return { x: p.x + q.x * k, y: p.y + q.y * k }; };
const mix2 = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const fract = (x) => x - Math.floor(x);
const rot2 = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }; };

// ------------------------------------------------------------------ IK + path helpers (own copies: rigs.js does not export them)
function ik2(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux, uy;
  if (d < 1e-6) { ux = 0; uy = 1; d = 1e-6; } else { ux = dx / d; uy = dy / d; }
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h },
           end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function capsule(p0, p1, r0, r1) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy) || 1e-6;
  const a = Math.atan2(dy, dx), b = Math.acos(clamp((r0 - r1) / d, -1, 1));
  const p = new Path2D();
  p.arc(p0.x, p0.y, r0, a + b, a - b + TAU); p.arc(p1.x, p1.y, r1, a - b, a + b); p.closePath();
  return p;
}
function limb(pts, rs) { const p = new Path2D(); for (let i = 0; i < pts.length - 1; i++) p.addPath(capsule(pts[i], pts[i + 1], rs[i], rs[i + 1])); return p; }
function circleP(c, r) { const p = new Path2D(); p.arc(c.x, c.y, r, 0, TAU); p.closePath(); return p; }
function ellipseP(cx, cy, rx, ry, rotn) { const p = new Path2D(); p.ellipse(cx, cy, rx, ry, rotn || 0, 0, TAU); p.closePath(); return p; }
function rrect(x, y, w, h, r) {
  const p = new Path2D(); r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.arcTo(x + w, y, x + w, y + r, r); p.lineTo(x + w, y + h - r); p.arcTo(x + w, y + h, x + w - r, y + h, r);
  p.lineTo(x + r, y + h); p.arcTo(x, y + h, x, y + h - r, r); p.lineTo(x, y + r); p.arcTo(x, y, x + r, y, r); p.closePath();
  return p;
}

// ------------------------------------------------------------------ render env for our own lit parts (mirrors rigs.js `part`)
const E = { g: null, pal: null, rx: -3, ry: 1, lw: 1.3, shade: null, ghost: false };
function setEnv(g, pal, s, facing) {
  E.g = g; E.pal = pal; E.ghost = !!pal.ghost;
  E.rx = -3.3 * facing / s; E.ry = 1.3 / s; E.lw = pal.edgeW / s;
  const x0 = -60, x1 = 90, y0 = -250, y1 = 20, cx = (x0 + x1) / 2, w = x1 - x0;
  const gr = g.createLinearGradient(cx + facing * w * 0.55, y0, cx - facing * w * 0.55, y1);
  gr.addColorStop(0, 'rgba(' + pal.shadeCol + ',0)'); gr.addColorStop(0.42, 'rgba(' + pal.shadeCol + ',0)');
  gr.addColorStop(1, 'rgba(' + pal.shadeCol + ',' + pal.shade + ')');
  E.shade = gr;
}
function partM(path, fill, o) {
  const g = E.g, pal = E.pal; o = o || {};
  g.lineJoin = 'round';
  if (E.ghost) { g.fillStyle = fill; g.fill(path); return; }
  if (o.edge !== false) { g.lineWidth = E.lw * 2 * (o.edgeK || 1); g.strokeStyle = pal.edge; g.stroke(path); }
  if (o.rim !== false && pal.rim) {
    g.fillStyle = pal.rim; g.fill(path);
    g.save(); g.clip(path); g.translate(E.rx, E.ry); g.fillStyle = fill; g.fill(path); g.restore();
  } else { g.fillStyle = fill; g.fill(path); }
  if (o.shade !== false) { g.save(); g.clip(path); g.fillStyle = E.shade; g.fillRect(-900, -900, 1800, 1800); g.restore(); }
}

// ------------------------------------------------------------------ palettes
const _palCache = {};
function palette(hood, o) {
  o = o || {};
  const key = hood + '|' + (o.pants || '') + '|' + (o.head || '');
  if (_palCache[key]) return _palCache[key];
  const p = Object.assign({}, G.PAL_REAL, {
    hood: hood, hoodBack: mixHex(hood, '#000000', 0.28), hoodDark: mixHex(hood, '#000000', 0.42), hoodLight: mixHex(hood, '#ffffff', 0.2)
  });
  if (o.pants) { p.leg = o.pants; p.legFar = mixHex(o.pants, '#000000', 0.35); p.shoe = mixHex(o.pants, '#000000', 0.2); p.shoeFar = mixHex(o.pants, '#000000', 0.45); }
  if (o.head) { p.head = o.head; p.hand = o.head; p.handFar = mixHex(o.head, '#000000', 0.35); }
  _palCache[key] = p;
  return p;
}
const PALS = { red: null, blue: '#2f6fe0', green: '#2fa36b', yellow: '#e9b92a', purple: '#8a4fd0', orange: '#e8782a', teal: '#1fa8a0', pink: '#e55a9a', white: '#e8e6ef', grey: '#7d7a8c' };
function palByName(n) { return PALS[n] ? palette(PALS[n]) : G.PAL_REAL; }

// ------------------------------------------------------------------ pose vector
const DEF = {
  hx: 0, hy: -112, a1: 0.04, a2: 0.04, ah: 0.04, nk: 36, hrx: 0, hdx: 0, hdy: 0, shr: 0,
  lfx: 7, lfy: -AH, lfp: 0.05, lfs: 1, lbx: -7, lby: -AH, lbp: -0.02, lbs: 1,
  afx: 8, afy: -100, afs: -1, abx: 0, aby: -100, abs: -1,
  free: 0, flut: 0.15, thumb: 0, finger: 0, palm: 0, hold: 0, shw: 74, tail: 0
};
const KEYS = Object.keys(DEF);
function fk(V) {
  const hip = { x: V.hx, y: V.hy }, u1 = up(V.a1), u2 = up(V.a2), uh = up(V.ah), n2 = nr(V.a2);
  const waist = { x: hip.x + u1.x * 32, y: hip.y + u1.y * 32 };
  const sh = { x: waist.x + u2.x * 36, y: waist.y + u2.y * 36 };
  const head = { x: sh.x + uh.x * V.nk + V.hdx, y: sh.y + uh.y * V.nk + V.hdy };
  const J = { x: sh.x - u2.x * 8 - n2.x, y: sh.y - u2.y * 8 - n2.y - V.shr };
  return { hip, waist, sh, head, J };
}
// build a vector from partial spec; `hands(F)` returns [afx,afy,abx,aby] offsets from J (or absolute fn)
function mk(spec, hands) {
  const V = Object.assign({}, DEF, spec);
  const F = fk(V);
  if (hands) {
    const h = hands(F, V);
    if (h[0] != null) { V.afx = h[0]; V.afy = h[1]; }
    if (h[2] != null) { V.abx = h[2]; V.aby = h[3]; }
  } else {
    V.afx = F.J.x + 8; V.afy = F.J.y + 68; V.abx = F.J.x - 1; V.aby = F.J.y + 70;
  }
  return V;
}
const J = (F, dx, dy) => [F.J.x + dx, F.J.y + dy];
const HD = (F, dx, dy) => [F.head.x + dx, F.head.y + dy];
function dirv(F, ang, len) { return [F.J.x + Math.cos(ang) * len, F.J.y - Math.sin(ang) * len]; }
const par = (o, st, k, d) => (o && o[k] != null) ? o[k] : (st && st[k] != null ? st[k] : d);

function blendV(A, B, k) {
  const V = {};
  for (let i = 0; i < KEYS.length; i++) { const n = KEYS[i]; V[n] = A[n] + (B[n] - A[n]) * k; }
  return V;
}

function fromRig(P) {
  const V = Object.assign({}, DEF);
  V.hx = P.hip.x; V.hy = P.hip.y; V.a1 = P.a1; V.a2 = P.a2;
  const dx = P.head.x - P.shTop.x, dy = P.head.y - P.shTop.y;
  V.ah = Math.atan2(dx, -dy); V.nk = Math.hypot(dx, dy); V.hrx = P.head.rot - V.ah * 0.75;
  V.lfx = P.legF.ankle.x; V.lfy = P.legF.ankle.y; V.lfp = P.legF.pitch;
  V.lbx = P.legB.ankle.x; V.lby = P.legB.ankle.y; V.lbp = P.legB.pitch;
  V.afx = P.armF.hand.x; V.afy = P.armF.hand.y; V.abx = P.armB.hand.x; V.aby = P.armB.hand.y;
  V.free = 1;
  return V;
}

// ------------------------------------------------------------------ gaits
function runLeg(u, S, L) {
  let x, y, p;
  if (u < 0.36) { const q = u / 0.36; x = S * (1 - 2 * q) * 0.85 + 6; y = -AH; p = lerp(0.15, -0.55, q * q); }
  else {
    const q = (u - 0.36) / 0.64, e = 0.5 * q + 0.5 * smooth(q);
    x = lerp(-S * 0.85 + 6, S + 6, e); y = -AH - L * Math.sin(Math.PI * Math.pow(q, 0.8)); p = lerp(-0.55, 0.3, smooth(q));
  }
  return { x, y, p };
}

// ------------------------------------------------------------------ the poses
// each: (st, t, o) -> pose vector.  `o` = per-pose params ({name, dir:..}); st holds the same params as fallbacks.
const POSES = {
  stand(st, t) {
    const b = Math.sin(t * 2.2), sw = Math.sin(t * 1.3);
    const V = mk({ hy: -112 + b * 0.7, a2: 0.04 + b * 0.012, ah: 0.04 + b * 0.012 - 0.01 * sw, free: 1, shw: 74 },
      (F) => [F.J.x + 8 + sw * 1.5, F.J.y + 68, F.J.x - 1 - sw, F.J.y + 70]);
    return V;
  },
  walk(st, t, o) {
    const sp = par(o, st, 'speed', 1.0), amp = par(o, st, 'amp', 1);
    const ph = st.phase != null ? st.phase : t * sp;
    const P = G.walkerPose({ phase: ph, walk: amp, lean: par(o, st, 'lean', 0.1), headDown: par(o, st, 'headDown', 0), bob: 1, flutter: 0.2 });
    const V = fromRig(P); V.flut = 0.2 * amp; V.free = 1;
    return V;
  },
  run(st, t, o) {
    const sp = par(o, st, 'speed', 1.9), ph = st.phase != null ? st.phase : t * sp, c = fract(ph);
    const S = 52, L = 66;
    const lF = runLeg(c, S, L), lB = runLeg(fract(c + 0.5), S, L);
    const lean = par(o, st, 'lean', 0.34);
    const hy = -105 + 6 * Math.cos(4 * Math.PI * (c + 0.1));
    const V = mk({ hx: -4, hy, a1: lean, a2: lean + 0.1, ah: lean + 0.02, nk: 35, hrx: 0.05, lfx: lF.x, lfy: lF.y, lfp: lF.p, lbx: lB.x, lby: lB.y, lbp: lB.p, flut: 0.9, free: 0.4 },
      (F) => {
        const s = Math.cos(TAU * c);   // +1 => F arm forward (opposite to the F leg: F leg is forward at c=0)
        return [F.J.x + 4 - 36 * s, F.J.y + 22 + 16 * s, F.J.x + 4 + 36 * s, F.J.y + 22 - 16 * s];
      });
    return V;
  },
  sitGround(st, t) {
    const b = Math.sin(t * 2.0);
    return mk({ hx: -4, hy: -13 + b * 0.4, a1: 0.14, a2: 0.2 + b * 0.012, ah: 0.18, nk: 35, lfx: 56, lfy: -AH, lfp: 0.12, lbx: 44, lby: -AH, lbp: 0.05, free: 0.5, shw: 90 },
      (F) => [F.hip.x + 58, F.hip.y - 56, F.hip.x - 26, -9]);
  },
  sitBench(st, t, o) {
    const seat = par(o, st, 'seat', 52), b = Math.sin(t * 2.0);
    return mk({ hx: -2, hy: -(seat + 11) + b * 0.4, a1: 0.02, a2: 0.04 + b * 0.012, ah: 0.04, lfx: 55, lfy: -AH, lfp: 0.05, lbx: 44, lby: -AH, lbp: 0.0, free: 0.6, shw: 80 },
      (F) => [F.hip.x + 42, F.hip.y - 14, F.hip.x + 24, F.hip.y - 12]);
  },
  lie(st, t) {
    const b = Math.sin(t * 1.7);
    const V = mk({ hx: 6, hy: -21 + b * 0.5, a1: -1.5, a2: -1.54, ah: -1.62, nk: 35, hrx: 0.1 - 1.5 * 0.0, lfx: 112, lfy: -12, lfp: 1.3, lbx: 78, lby: -14, lbp: 1.1, lbs: 1, flut: 0.0, free: 0, shw: 140 },
      (F) => [F.hip.x - 34, F.hip.y - 20, F.hip.x - 20, F.hip.y - 14]);
    V.hrx = -0.32; V.hdy = 5;
    return V;
  },
  kneel(st, t) {
    const b = Math.sin(t * 2.0);
    return mk({ hx: 6, hy: -68 + b * 0.5, a1: 0.03, a2: 0.05, ah: 0.05, lfx: 48, lfy: -AH, lfp: 0.05, lbx: -50, lby: -9, lbp: 2.9, free: 0.5, shw: 90 },
      (F) => [F.J.x + 44, F.J.y + 48, F.J.x + 2, F.J.y + 66]);
  },
  slump(st, t) {
    const b = Math.sin(t * 1.4), sw = Math.sin(t * 0.9);
    return mk({ hx: -4, hy: -104 + b * 0.8, a1: 0.26 + sw * 0.02, a2: 0.66 + sw * 0.02, ah: 1.1 + b * 0.02, nk: 33, hrx: 0.1, lfx: 12, lfy: -AH, lfp: 0.02, lbx: -10, lby: -AH, lbp: -0.05, free: 0.8, flut: 0.05 },
      (F) => [F.J.x + 26 + sw * 3, F.J.y + 66, F.J.x + 14, F.J.y + 70]);
  },
  point(st, t, o) {
    let dir = par(o, st, 'dir', 0.12);
    if (st.__pointDir != null) dir = st.__pointDir;
    const ld = Math.cos(dir);   // lean toward what we point at
    const b = Math.sin(t * 2.2);
    return mk({ hy: -112 + b * 0.6, a1: 0.04 + 0.08 * ld, a2: 0.08 + 0.1 * ld - 0.05 * Math.max(0, Math.sin(dir)), ah: 0.06, lfx: 14, lfy: -AH, lbx: -10, lby: -AH, free: 0 },
      (F) => { const h = dirv(F, dir, 76); return [h[0], h[1], F.J.x - 2, F.J.y + 70]; });
  },
  shield(st, t) {
    const b = Math.sin(t * 2.2);
    return mk({ hy: -111 + b * 0.5, a1: -0.02, a2: -0.04, ah: -0.2, hrx: 0.1, lfx: 9, lbx: -9, free: 0 , finger: 0},
      (F) => { const h = HD(F, 12, -17); return [h[0], h[1], F.J.x - 4, F.J.y + 70]; });
  },
  fanSelf(st, t) {
    const b = Math.sin(t * 2.6), w = Math.sin(t * 13);
    return mk({ hy: -112 + b * 0.8, a1: -0.07, a2: -0.1, ah: -0.32, hrx: 0.12, lfx: 11, lbx: -11, free: 0, flut: 0.35 },
      (F) => [F.head.x + 30 + 3 * w, F.head.y + 30 + 5 * w, F.J.x + 14, F.J.y + 42]);
  },
  hugSelf(st, t) {
    const b = Math.sin(t * 3.0);
    return mk({ hy: -107 + b * 0.5, a1: 0.14, a2: 0.26, ah: 0.4, nk: 33, shr: 5, hrx: 0.05, lfx: 5, lbx: -6, lfs: 1, lbs: 1, free: 0, flut: 0.3 },
      (F) => { const h = J(F, -11, 36); return [h[0], h[1], F.J.x + 6, F.J.y + 30]; });
  },
  wipeBrow(st, t) {
    const b = Math.sin(t * 2.2), w = Math.sin(t * 5.5);
    return mk({ hy: -110 + b * 0.8, a1: 0.1, a2: 0.15, ah: 0.2 + 0.05 * w, hrx: 0.06, lfx: 8, lbx: -9, free: 0 },
      (F) => [F.head.x + 8 + 15 * w, F.head.y - 20 + 2 * Math.abs(w), F.J.x - 3, F.J.y + 70]);
  },
  throwArms(st, t) {
    const w = Math.sin(t * 9), b = Math.sin(t * 4);
    return mk({ hy: -112 + 3 * Math.abs(b), a1: -0.1, a2: -0.14, ah: -0.34, hrx: 0.05, lfx: 24, lbx: -22, lfp: 0.0, lbp: 0.0, flut: 0.6, free: 0 },
      (F) => [F.J.x + 54 + 4 * w, F.J.y - 52 - 3 * w, F.J.x - 42 - 4 * w, F.J.y - 56 + 3 * w]);
  },
  facepalm(st, t) {
    const b = Math.sin(t * 1.6);
    return mk({ hy: -109 + b * 0.5, a1: 0.14, a2: 0.3, ah: 0.62, nk: 34, hrx: 0.12, lfx: 8, lbx: -9, free: 0, palm: 1 },
      (F) => { const h = HD(F, 11, 3); return [h[0], h[1], F.J.x + 4, F.J.y + 70]; });
  },
  sprawl(st, t) {
    const b = Math.sin(t * 1.8);
    return mk({ hx: 10, hy: -21 + b * 0.5, a1: -1.46, a2: -1.5, ah: -1.52, nk: 34, hrx: -0.36, hdy: 6, lfx: 106, lfy: -48, lfp: 1.0, lbx: 110, lby: -10, lbp: 1.0, free: 0, flut: 0, shw: 150 },
      (F) => [F.J.x + 6, F.J.y - 72, F.J.x + 38, -9]);
  },
  lookUp(st, t) {
    const b = Math.sin(t * 2.2);
    return mk({ hy: -112 + b * 0.6, a1: -0.07, a2: -0.12, ah: -0.7, nk: 35, hrx: 0.28, lfx: 9, lbx: -9, free: 1 },
      (F) => [F.J.x + 6, F.J.y + 68, F.J.x - 3, F.J.y + 70]);
  },
  thumbsUp(st, t) {
    const b = Math.sin(t * 2.4), w = Math.sin(t * 6);
    return mk({ hy: -112 + b * 0.8, a1: 0.0, a2: -0.02, ah: -0.02, hrx: 0.04, lfx: 12, lbx: -10, free: 0, thumb: 1 },
      (F) => [F.J.x + 50, F.J.y - 22 - 2.5 * Math.max(0, w), F.J.x - 4, F.J.y + 38]);
  },
  wave(st, t) {
    const b = Math.sin(t * 2.2), w = Math.sin(t * 9);
    return mk({ hy: -112 + b * 0.6, a1: 0.03, a2: 0.02, ah: -0.02, lfx: 9, lbx: -9, free: 0 },
      (F) => [F.J.x + 46 + 13 * w, F.J.y - 50, F.J.x - 1, F.J.y + 70]);
  },
  shrug(st, t) {
    const b = Math.sin(t * 2.0);
    return mk({ hy: -112 + b * 0.5, a1: -0.02, a2: -0.04, ah: 0.0, hrx: 0.25, shr: 7, nk: 32, lfx: 9, lbx: -9, free: 0 },
      (F) => [F.J.x + 52, F.J.y + 24, F.J.x + 38, F.J.y + 16]);
  },
  hold(st, t) {
    const b = Math.sin(t * 2.2);
    return mk({ hy: -112 + b * 0.6, a1: 0.05, a2: 0.06, ah: 0.05, lfx: 9, lbx: -9, free: 1 },
      (F) => [F.J.x + 38, F.J.y + 30, F.J.x - 1, F.J.y + 70]);
  },
  drink(st, t) {
    const b = Math.sin(t * 2.2);
    return mk({ hy: -112 + b * 0.6, a1: -0.06, a2: -0.1, ah: -0.45, nk: 35, hrx: 0.22, lfx: 9, lbx: -9, free: 0, hold: -0.75 },
      (F) => { const h = HD(F, 34, 24); return [h[0], h[1], F.J.x - 2, F.J.y + 70]; });
  }
};
POSES.cheer = POSES.throwArms;
POSES.sit = POSES.sitGround;
POSES.sleep = POSES.lie;
POSES.dead = POSES.sprawl;

function poseVec(p, st, t) {
  if (p == null) return POSES.stand(st, t, null);
  if (typeof p === 'string') { const f = POSES[p] || POSES.stand; return f(st, t, null); }
  if (p.a != null) return blendV(poseVec(p.a, st, t), poseVec(p.b, st, t), clamp(p.k == null ? 0 : p.k));
  const f = POSES[p.name] || POSES.stand; return f(st, t, p);
}
function poseName(p) { return p == null ? 'stand' : typeof p === 'string' ? p : p.a != null ? (p.k < 0.5 ? poseName(p.a) : poseName(p.b)) : (p.name || 'stand'); }

// ------------------------------------------------------------------ expressions
const EXPR = {
  neutral: {}, normal: {},
  hot: { eyes: 'droop', sweat: 1, steam: 0.0 }, boiling: { eyes: 'droop', sweat: 1, steam: 1 },
  cold: { eyes: 'worry', shiver: 0.7, breath: 1 }, freezing: { eyes: 'squint', shiver: 1, breath: 1 },
  panic: { eyes: 'wide', sweat: 1, lines: 'shock' }, shock: { eyes: 'wide', lines: 'shock' },
  tired: { eyes: 'droop' }, bored: { eyes: 'bored' }, sleepy: { eyes: 'droop', sleepZ: 0.6 }, asleep: { eyes: 'closed', sleepZ: 1 },
  dead: { eyes: 'dead' }, dizzy: { eyes: 'spiral', lines: 'dizzy' }, happy: { eyes: 'happy' }, joy: { eyes: 'happy', sparkle: 1 },
  relieved: { eyes: 'closed', sweat: 0.3 }, angry: { eyes: 'angry', lines: 'anger', steam: 0.6 }, worried: { eyes: 'worry', sweat: 0.5 },
  confused: { eyes: 'normal', pop: '?' }, idea: { eyes: 'wide', pop: '!', sparkle: 0.5 }, squint: { eyes: 'squint' },
  wow: { eyes: 'star', sparkle: 1 }, awkward: { eyes: 'tiny', sweat: 0.4 }
};
const LOOKS = { up: [0, -1], down: [0, 1], fwd: [1, 0], back: [-1, 0], upfwd: [0.8, -0.8], upback: [-0.8, -0.8], downfwd: [0.8, 0.8], center: [0, 0] };
// ellipse-family eye shapes: sx, sy scale; cover = fraction of eye hidden by the top lid; tilt = lid slant (+ sad, - angry); pup = pupil dot
const SHAPES = {
  normal: { sx: 1, sy: 1, cover: 0, tilt: 0, pup: 0 },
  wide: { sx: 1.45, sy: 1.55, cover: 0, tilt: 0, pup: 1 },
  squint: { sx: 1.28, sy: 0.3, cover: 0, tilt: 0, pup: 0 },
  droop: { sx: 1.08, sy: 0.98, cover: 0.46, tilt: 0.45, pup: 0 },
  bored: { sx: 1.18, sy: 0.7, cover: 0.46, tilt: 0, pup: 0 },
  angry: { sx: 1.1, sy: 0.92, cover: 0.34, tilt: -1.1, pup: 0 },
  worry: { sx: 1.18, sy: 1.2, cover: 0.14, tilt: 1.25, pup: 1 },
  tiny: { sx: 0.62, sy: 0.42, cover: 0, tilt: 0, pup: 0 }
};
const STROKES = { closed: 1, happy: 1, spiral: 1, dead: 1, star: 1, sleep: 1 };
const E1 = { x: 10.5, y: -3, rx: 4.7, ry: 8.4 }, E2 = { x: 23.5, y: -3.5, rx: 3.2, ry: 7.7 };

function normExpr(e, st) {
  if (e == null) {
    const n = poseName(st.pose);
    if (n === 'lie' || n === 'sleep') return { eyes: 'closed', sleepZ: 1 };
    if (n === 'hugSelf') return { eyes: 'worry', shiver: 0.6, breath: 0.8 };
    if (n === 'fanSelf') return { eyes: 'droop', sweat: 0.8 };
    if (n === 'shield') return { eyes: 'squint' };
    if (n === 'wipeBrow') return { eyes: 'closed', sweat: 0.5 };
    if (n === 'facepalm') return { eyes: 'closed' };
    if (n === 'thumbsUp') return { eyes: 'happy' };
    if (n === 'throwArms' || n === 'cheer') return { eyes: 'wide' };
    if (n === 'sprawl' || n === 'dead') return { eyes: 'droop', sweat: 0.7 };
    if (n === 'slump') return { eyes: 'droop' };
    return EXPR.neutral;
  }
  if (typeof e === 'string') return EXPR[e] || { eyes: e };
  if (e.preset && EXPR[e.preset]) return Object.assign({}, EXPR[e.preset], e);
  return e;
}

function blinkAmt(t, seed) {
  const P = 3.1, i = Math.floor(t / P);
  let b = 0;
  for (let k = i - 1; k <= i; k++) {
    const st = k * P + hash1(k * 7 + seed) * (P - 0.6);
    const u = (t - st) / 0.17;
    if (u > 0 && u < 1) b = Math.max(b, Math.sin(Math.PI * u));
    if (hash1(k * 13 + seed + 5) > 0.78) { const u2 = (t - st - 0.3) / 0.17; if (u2 > 0 && u2 < 1) b = Math.max(b, Math.sin(Math.PI * u2)); }
  }
  return b;
}

// ------------------------------------------------------------------ resolve (pose + expr + jitter -> rig pose + anchors)
function propOf(props, name) {
  if (!props) return null;
  const v = props[name];
  if (v == null || v === false || v === 0) return null;
  if (v === true) return { amt: 1 };
  if (typeof v === 'number') return { amt: clamp(v) };
  return Object.assign({ amt: 1 }, v);
}
const HOLD_TARGET = { umbrella: [38, 12], mug: [38, 26], plate: [46, 30], waterBottle: [32, 30], flashlight: [44, 22], fan: [34, 24], blanket: [16, 34] };

function resolve(st) {
  const t = st.t || 0, s = st.s == null ? 1 : st.s, f = (st.facing != null && st.facing < 0) ? -1 : 1;
  const ex = normExpr(st.expr, st), props = st.props || null;
  const pname = poseName(st.pose);
  // aim: world target for point
  const stx = st;
  let pst = st;
  if (st.at && (pname === 'point' || (st.pose && st.pose.name === 'point'))) {
    const jx = 6, jy = -172;     // approx shoulder in stand pose
    const lx = f * (st.at.x - (st.x || 0)) / s - jx, ly = (st.at.y - (st.y || 0)) / s - jy;
    pst = Object.assign({}, st, { __pointDir: Math.atan2(-ly, lx) });
  }
  const V = poseVec(st.pose, pst, t);
  // shiver
  const sh = ex.shiver || 0;
  let jx = 0, jy = 0;
  if (sh > 0) {
    jx = sh * 1.5 * (Math.sin(t * 83) + 0.5 * Math.sin(t * 131 + 2)); jy = sh * 0.7 * Math.sin(t * 97 + 1);
    V.hdx += sh * 1.3 * Math.sin(t * 113 + 0.7); V.hdy += sh * 0.8 * Math.sin(t * 71);
    V.afx += sh * 1.4 * Math.sin(t * 101); V.afy += sh * 1.0 * Math.sin(t * 89 + 1); V.abx += sh * 1.4 * Math.sin(t * 97 + 2); V.aby += sh * 1.0 * Math.sin(t * 107);
  }
  const F = fk(V);
  // held props pull the free front hand
  if (props) {
    for (const nm in HOLD_TARGET) {
      const pr = propOf(props, nm);
      if (!pr) continue;
      let w = V.free * pr.amt;
      if (nm === 'fan' && (pname === 'fanSelf')) w = 0;
      if (w <= 0.001) continue;
      let tg = HOLD_TARGET[nm];
      if (pr.hand === 'B') { V.abx = lerp(V.abx, F.J.x + tg[0], w); V.aby = lerp(V.aby, F.J.y + tg[1], w); }
      else { V.afx = lerp(V.afx, F.J.x + tg[0], w); V.afy = lerp(V.afy, F.J.y + tg[1], w); }
    }
  }
  const hr = V.ah * 0.75 + V.hrx;
  const hip = F.hip;
  const mkLeg = (ax, ay, p, side) => { const r = ik2(hip, { x: ax, y: ay }, THIGH, SHIN, side); return { hip, knee: r.mid, ankle: r.end, pitch: p }; };
  const aF = ik2(F.J, { x: V.afx, y: V.afy }, UARM, FARM, V.afs), aB = ik2(F.J, { x: V.abx, y: V.aby }, UARM, FARM, V.abs);
  const P = {
    cyc: 0, w: 0, ff: t, pulse: 0, hunch: clamp(V.a2 - V.a1, 0, 0.7), a1: V.a1, a2: V.a2, hip, waist: F.waist, shTop: F.sh, J: F.J,
    head: { x: F.head.x, y: F.head.y, r: 29, rot: hr },
    legF: mkLeg(V.lfx, V.lfy, V.lfp, V.lfs), legB: mkLeg(V.lbx, V.lby, V.lbp, V.lbs),
    armF: { sh: F.J, elbow: aF.mid, hand: aF.end }, armB: { sh: F.J, elbow: aB.mid, hand: aB.end },
    phone: { amt: 0, ang: 0 }, eyeOpen: 0, eyeGlow: 0, flutter: V.flut
  };
  return {
    st, t, s, f, ex, props, pname, V, F, P, jx, jy,
    x: (st.x || 0) + jx * s * f, y: (st.y || 0) + jy * s,
    pal: st.pal || G.PAL_REAL, alpha: st.alpha == null ? 1 : st.alpha
  };
}
const W = (C, p) => ({ x: C.x + C.f * C.s * p.x, y: C.y + C.s * p.y });

// ------------------------------------------------------------------ eyes
function ellEye(g, cx, cy, rx, ry, cover, tilt, idx, col) {
  g.fillStyle = col;
  if (cover < 0.01 && Math.abs(tilt) < 0.01) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill(); return; }
  const yl = cy - ry + 2 * ry * cover, k = tilt * ry * 0.42 * (idx === 0 ? 1 : -1);
  g.save(); g.beginPath();
  g.moveTo(cx - rx * 1.6, yl + k * 1.6); g.lineTo(cx + rx * 1.6, yl - k * 1.6); g.lineTo(cx + rx * 1.6, cy + ry * 2); g.lineTo(cx - rx * 1.6, cy + ry * 2); g.closePath();
  g.clip();
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
  g.restore();
}
function strokeEye(g, type, cx, cy, sc, idx, t, col, a) {
  g.save(); g.globalAlpha *= a; g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  if (type === 'closed' || type === 'sleep') {
    g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 6.6 * sc, cy - 2); g.quadraticCurveTo(cx, cy + 12 * sc, cx + 6.6 * sc, cy - 2); g.stroke();
  } else if (type === 'happy') {
    g.lineWidth = 4.6; g.beginPath(); g.moveTo(cx - 6.8 * sc, cy + 5); g.quadraticCurveTo(cx, cy - 14 * sc, cx + 6.8 * sc, cy + 5); g.stroke();
  } else if (type === 'dead') {
    g.lineWidth = 4; const a1 = 6.2 * sc, b1 = 7.4 * sc;
    g.beginPath(); g.moveTo(cx - a1, cy - b1); g.lineTo(cx + a1, cy + b1); g.moveTo(cx + a1, cy - b1); g.lineTo(cx - a1, cy + b1); g.stroke();
  } else if (type === 'spiral') {
    g.lineWidth = 2.6; g.beginPath();
    const ph = t * 6 * (idx ? -1 : 1);
    for (let i = 0; i <= 34; i++) { const q = i / 34, r = 1 + 9.5 * sc * q, an = ph + q * 14.5; const x = cx + Math.cos(an) * r, y = cy + Math.sin(an) * r * 1.05; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  } else if (type === 'star') {
    const R = 12 * sc, r = 4.2 * sc, rt = Math.sin(t * 4 + idx) * 0.1;
    g.beginPath();
    for (let i = 0; i < 8; i++) { const an = -Math.PI / 2 + i * Math.PI / 4 + rt, rr = i % 2 ? r : R; const x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.fill();
  }
  g.restore();
}
function lerpShape(a, b, k) { return { sx: lerp(a.sx, b.sx, k), sy: lerp(a.sy, b.sy, k), cover: lerp(a.cover, b.cover, k), tilt: lerp(a.tilt, b.tilt, k), pup: lerp(a.pup, b.pup, k) }; }

function drawEyes(g, C) {
  const ex = C.ex, hd = C.P.head, pal = C.pal, t = C.t;
  const tA = ex.eyes || 'normal', tB = ex.eyes2 || null, kk = tB ? clamp(ex.k == null ? 0 : ex.k) : 0;
  let lk = ex.look;
  if (typeof lk === 'string') lk = LOOKS[lk] ? { x: LOOKS[lk][0], y: LOOKS[lk][1] } : { x: 0, y: 0 };
  const lx = lk ? (lk.x || 0) : 0, ly = lk ? (lk.y || 0) : 0, face = clamp(ex.face || 0);
  g.save(); g.translate(hd.x, hd.y); g.rotate(hd.rot);
  const col = pal.eye;
  const blinkOn = ex.blink !== false;
  const bl = blinkOn ? blinkAmt(t, ex.seed || 0) : 0;
  const A = SHAPES[tA], B = tB ? SHAPES[tB] : null;
  const pass = (type, shape, alpha) => {
    for (let i = 0; i < 2; i++) {
      const base = i ? E2 : E1;
      let ex0 = lerp(base.x, i ? 9.5 : -9.5, face), ey0 = base.y;
      const per = i ? 0.7 : 1;      // far eye moves less (perspective)
      ex0 += lx * 3.8 * per; ey0 += ly * 5.5;
      const rxs = i ? lerp(1, 1 / 0.68, face) : 1;   // face-on => both eyes equal
      if (shape) {
        const rx = base.rx * rxs * shape.sx, ry = Math.max(1.1, base.ry * shape.sy * (1 - 0.93 * bl));
        g.save(); g.globalAlpha *= alpha;
        ellEye(g, ex0, ey0, rx, ry, shape.cover * (1 - bl), shape.tilt * (1 - bl), i, col);
        if (shape.pup > 0.05 && bl < 0.4) {
          g.fillStyle = pal.head; g.globalAlpha *= clamp(shape.pup);
          g.beginPath(); g.arc(ex0 + lx * rx * 0.45, ey0 + ly * ry * 0.4, Math.min(rx, ry) * 0.42, 0, TAU); g.fill();
        }
        g.restore();
      } else strokeEye(g, type, ex0, ey0, (i ? 0.62 : 0.9) * rxs, i, t, col, alpha);
    }
  };
  const aEll = !!A, bEll = tB ? !!B : true;
  if (aEll && (!tB || bEll)) {
    const sh = tB ? lerpShape(A, B, kk) : A;
    pass(tA, sh, 1);
  } else {
    if (kk < 0.999) pass(tA, A, 1 - kk);
    if (tB && kk > 0.001) pass(tB, B, kk);
  }
  if (ex.pupils && aEll) { /* reserved */ }
  g.restore();
}

// ------------------------------------------------------------------ props
function darker(c, k) { return mixHex(c, '#000000', k); }
function lighter(c, k) { return mixHex(c, '#ffffff', k); }

function headClip(g, C) {
  const hd = C.P.head, p = new Path2D();
  p.rect(-900, -900, 1800, 1800); p.arc(hd.x, hd.y, hd.r + 0.4, 0, TAU);
  g.clip(p, 'evenodd');
}

function drawBlanket(g, C, o) {
  const V = C.V, P = C.P, pal = C.pal;
  const T0 = add(P.shTop, up(P.a2), 3);
  const kneeAvg = mix2(P.legF.knee, P.legB.knee, 0.5);
  const lying = C.pname === 'lie' || C.pname === 'sleep' || C.pname === 'sprawl';
  const cover = o.cover != null ? o.cover : (lying ? 1.95 : (C.pname.indexOf('sit') === 0 || C.pname === 'kneel' ? 1.0 : 1.0));
  const Bt = { x: P.hip.x + (kneeAvg.x - P.hip.x) * cover, y: P.hip.y + (kneeAvg.y - P.hip.y) * cover };
  const dx = Bt.x - T0.x, dy = Bt.y - T0.y, len = Math.hypot(dx, dy) || 1;
  const ax = dx / len, ay = dy / len, nx = ay, ny = -ax;
  const col = o.color || '#e9b84a', col2 = o.color2 || darker(col, 0.22);
  const amt = o.amt;
  const sc = (0.4 + 0.6 * amt) * (lying ? 0.72 : 1);
  const at = (u, w) => ({ x: T0.x + ax * len * u + nx * w * sc, y: T0.y + ay * len * u + ny * w * sc });
  const wt = (u) => 24 + 14 * Math.sin(Math.PI * Math.min(1, u * 1.15)) + 4 * u;
  const path = new Path2D();
  let p0 = at(0, wt(0)); path.moveTo(p0.x, p0.y);
  for (let i = 1; i <= 8; i++) { const u = i / 8, p = at(u, wt(u)); path.lineTo(p.x, p.y); }
  // scalloped hem
  const eFront = at(1, wt(1)), eBack = at(1, -wt(1) * 0.9);
  const sca = 4;
  for (let i = 1; i <= sca; i++) {
    const a = mix2(eFront, eBack, (i - 1) / sca), b = mix2(eFront, eBack, i / sca), m = mix2(a, b, 0.5);
    path.quadraticCurveTo(m.x + ax * 8, m.y + ay * 8, b.x, b.y);
  }
  for (let i = 7; i >= 0; i--) { const u = i / 8, p = at(u, -wt(u) * 0.9); path.lineTo(p.x, p.y); }
  path.closePath();
  g.save(); headClip(g, C);
  partM(path, col);
  g.save(); g.clip(path); g.globalAlpha = 0.55; g.strokeStyle = col2; g.lineWidth = 4;
  g.globalAlpha = 0.5;
  for (let i = -1; i < 8; i++) {   // woven bands across the blanket
    const a = at(0.12 + i * 0.16, -60), b = at(0.12 + i * 0.16, 60);
    g.lineWidth = (i % 3 === 0) ? 6 : 2.4;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  }
  g.restore();
  g.restore();
}

function drawScarf(g, C, o) {
  const P = C.P, col = o.color || '#f2c744', col2 = o.color2 || '#e0572f', t = C.t;
  const N = add(P.shTop, up(P.a2), 11);
  g.save(); headClip(g, C);
  const rp = ellipseP(N.x, N.y, 27, 10.5, P.a2);
  // tail behind
  const fl = 6 * C.V.flut * Math.sin(t * 5), tailBase = add(N, nr(P.a2), -17);
  const tl = 40 + 6 * C.V.flut;
  const tp = new Path2D();
  const t0 = add(tailBase, up(P.a2), -2), t1 = add(tailBase, nr(P.a2), -9);
  tp.moveTo(t0.x, t0.y); tp.quadraticCurveTo(t0.x - 14 - fl, t0.y + tl * 0.5, t0.x - 8 + fl, t0.y + tl); tp.lineTo(t0.x + 3 + fl, t0.y + tl + 2);
  tp.quadraticCurveTo(t0.x - 3 - fl, t0.y + tl * 0.5, t1.x + 4, t1.y + 5); tp.closePath();
  partM(tp, col2, { rim: true });
  partM(rp, col);
  g.save(); g.clip(rp); g.strokeStyle = col2; g.lineWidth = 3.6; g.globalAlpha = 0.9;
  for (let i = -3; i <= 3; i++) { const c = add(N, nr(P.a2), i * 8), a = add(c, up(P.a2), 14), b = add(c, up(P.a2), -14); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
  g.restore();
  g.restore();
}

function drawSunglasses(g, C, o) {
  const hd = C.P.head, amt = o.amt;
  g.save(); g.translate(hd.x, hd.y); g.rotate(hd.rot); g.globalAlpha *= clamp(amt * 1.3);
  const fr = o.frame || '#f6f3ea', lensA = o.lens || '#2b4a95', lensB = '#0a0e26';
  // temple arm
  g.strokeStyle = fr; g.lineWidth = 2.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(1, -9); g.lineTo(-18, -7); g.stroke();
  const l1 = rrect(0.5, -15.5, 18.5, 24, 8), l2 = rrect(21.5, -14, 10.5, 21, 5);
  const gr = g.createLinearGradient(0, -15, 0, 9); gr.addColorStop(0, lensA); gr.addColorStop(1, lensB);
  g.fillStyle = gr; g.fill(l1); g.fill(l2);
  g.save(); g.clip(l1); g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath(); g.moveTo(3, -15); g.lineTo(9, -15); g.lineTo(2, 3); g.lineTo(-2, 3); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.moveTo(11, -15); g.lineTo(13.5, -15); g.lineTo(7, -1); g.lineTo(5, -1); g.closePath(); g.fill();
  g.restore();
  g.save(); g.clip(l2); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(23.5, -14); g.lineTo(26.5, -14); g.lineTo(22, -3); g.lineTo(20, -3); g.closePath(); g.fill(); g.restore();
  g.lineWidth = 2.6; g.strokeStyle = fr; g.stroke(l1); g.stroke(l2);
  g.beginPath(); g.moveTo(19, -8); g.lineTo(21.5, -8); g.stroke();
  g.restore();
}

function drawBeanie(g, C, o) {
  const hd = C.P.head, col = o.color || '#2f7fd6', band = o.band || lighter(col, 0.18);
  g.save(); g.translate(hd.x, hd.y); g.rotate(hd.rot + (o.tilt || 0));
  const cap = new Path2D();
  cap.moveTo(-28, -16); cap.bezierCurveTo(-33, -34, -18, -49, 0, -49); cap.bezierCurveTo(18, -49, 33, -34, 28, -16); cap.closePath();
  partM(cap, col);
  g.save(); g.clip(cap); g.strokeStyle = darker(col, 0.25); g.lineWidth = 2; g.globalAlpha = 0.6;
  for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * 6.5, -17); g.quadraticCurveTo(i * 7.6, -34, i * 3.2, -50); g.stroke(); }
  g.restore();
  const br = rrect(-30, -26, 60, 11.5, 5.5);
  partM(br, band);
  g.save(); g.clip(br); g.strokeStyle = darker(band, 0.25); g.lineWidth = 2; g.globalAlpha = 0.7;
  for (let i = -9; i <= 9; i++) { g.beginPath(); g.moveTo(i * 3.4, -27); g.lineTo(i * 3.4, -14); g.stroke(); }
  g.restore();
  const pom = circleP({ x: -1, y: -51 }, 7);
  partM(pom, lighter(band, 0.35));
  g.restore();
}

function drawTowel(g, C, o) {
  const hd = C.P.head, col = o.color || '#f4f1ea', st1 = o.stripe || '#3d8fe0', amt = o.amt;
  g.save(); g.translate(hd.x, hd.y); g.rotate(hd.rot);
  g.scale(1, 0.55 + 0.45 * amt);
  const tail = new Path2D();
  tail.moveTo(-18, -20); tail.bezierCurveTo(-40, -22, -42, 0, -41, 18); tail.lineTo(-30, 30); tail.lineTo(-26, 22); tail.lineTo(-20, 32); tail.bezierCurveTo(-16, 12, -14, -6, -10, -16); tail.closePath();
  partM(tail, darker(col, 0.08));
  const cap = new Path2D();
  cap.moveTo(-33, -13); cap.bezierCurveTo(-43, -38, -16, -56, 6, -53); cap.bezierCurveTo(28, -51, 36, -32, 31, -13);
  cap.bezierCurveTo(16, -8, -14, -8, -33, -13); cap.closePath();
  partM(cap, col);
  g.save(); g.clip(cap); g.strokeStyle = st1; g.lineWidth = 5; g.globalAlpha = 0.95;
  g.beginPath(); g.moveTo(-40, -24); g.quadraticCurveTo(0, -32, 38, -22); g.stroke();
  g.beginPath(); g.moveTo(-40, -35); g.quadraticCurveTo(0, -44, 38, -34); g.stroke();
  g.strokeStyle = darker(col, 0.2); g.lineWidth = 1.6; g.globalAlpha = 0.5;
  g.beginPath(); g.moveTo(-6, -53); g.quadraticCurveTo(-14, -30, -6, -9); g.stroke();
  g.beginPath(); g.moveTo(12, -52); g.quadraticCurveTo(18, -30, 12, -9); g.stroke();
  g.restore();
  g.restore();
}

// held-prop helpers: anchor = front or back hand
function handOf(C, o) { return (o && o.hand === 'B') ? { h: C.P.armB.hand, e: C.P.armB.elbow, col: C.pal.handFar } : { h: C.P.armF.hand, e: C.P.armF.elbow, col: C.pal.hand }; }
function redrawHand(g, C, hnd, r) {
  const f = { x: hnd.h.x - hnd.e.x, y: hnd.h.y - hnd.e.y }, fl = Math.hypot(f.x, f.y) || 1;
  partM(circleP({ x: hnd.h.x + f.x / fl * 2, y: hnd.h.y + f.y / fl * 2 }, r || 8.4), hnd.col);
}

function drawUmbrella(g, C, o) {
  const P = C.P, hnd = handOf(C, o), H = hnd.h, hd = P.head, amt = o.amt;
  const col = o.color || '#ffc928', col2 = o.color2 || darker(col, 0.0) , alt = o.alt || '#ff6a2a';
  const tilt = o.tilt || 0, R = 94 * (0.3 + 0.7 * amt) * (o.size || 1);
  const T = { x: hd.x + 14 + tilt * 46, y: Math.min(hd.y - 74, H.y - 112) };
  const ax = (H.x - T.x), ay = (H.y - T.y), len = Math.hypot(ax, ay), ux = ax / len, uy = ay / len;   // pole direction (down)
  const ang = Math.atan2(ux, uy);   // rotation so canvas +y follows the pole
  g.save(); g.translate(T.x, T.y); g.rotate(-ang);
  // pole (extends below the hand a bit) + crook
  g.lineCap = 'round';
  g.strokeStyle = E.pal.edge; g.lineWidth = 6.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len + 22); g.stroke();
  g.strokeStyle = '#a49dc8'; g.lineWidth = 3.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len + 22); g.stroke();
  g.strokeStyle = '#a49dc8'; g.lineWidth = 3.6; g.beginPath(); g.moveTo(0, len + 22); g.arc(-6, len + 22, 6, 0, Math.PI, false); g.stroke();
  // canopy
  const hb = 44 * (o.size || 1) * (0.5 + 0.5 * amt);
  const dome = new Path2D();
  dome.moveTo(-R, hb); dome.bezierCurveTo(-R * 1.0, hb * 0.35, -R * 0.45, -2, 0, -4); dome.bezierCurveTo(R * 0.45, -2, R * 1.0, hb * 0.35, R, hb);
  const nsc = 4;
  for (let i = 0; i < nsc; i++) { const x1 = R - (i + 1) * 2 * R / nsc, xm = R - (i + 0.5) * 2 * R / nsc; dome.quadraticCurveTo(xm, hb - 12, x1, hb); }
  dome.closePath();
  partM(dome, col);
  g.save(); g.clip(dome);
  g.fillStyle = alt;
  for (let i = 0; i < nsc; i += 2) {
    const xa = -R + i * 2 * R / nsc, xb = xa + 2 * R / nsc;
    g.beginPath(); g.moveTo(0, -6); g.lineTo(xa, hb + 4); g.lineTo(xb, hb + 4); g.closePath(); g.fill();
  }
  g.strokeStyle = 'rgba(40,24,10,0.55)'; g.lineWidth = 1.6;
  for (let i = 0; i <= nsc; i++) { const xr = -R + i * 2 * R / nsc; g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(xr * 0.55, hb * 0.1, xr, hb + 2); g.stroke(); }
  const sh = g.createLinearGradient(0, -4, 0, hb); sh.addColorStop(0, 'rgba(255,255,255,0.25)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(30,10,30,0.28)');
  g.fillStyle = sh; g.fillRect(-R - 4, -6, 2 * R + 8, hb + 12);
  g.restore();
  g.fillStyle = '#3b3250'; g.beginPath(); g.arc(0, -4, 3.2, 0, TAU); g.fill();
  g.restore();
  redrawHand(g, C, hnd, 8.6);
}

function drawFan(g, C, o) {
  const hnd = handOf(C, o), H = hnd.h, E_ = hnd.e, t = C.t;
  const fx = H.x - E_.x, fy = H.y - E_.y, fl = Math.hypot(fx, fy) || 1;
  const swing = (C.pname === 'fanSelf') ? 0.45 * Math.sin(t * 13 + 0.6) : 0;
  const ang = (C.pname === 'fanSelf' ? -0.15 : Math.atan2(fy, fx)) + swing;
  g.save(); g.translate(H.x, H.y); g.rotate(ang);
  g.strokeStyle = E.pal.edge; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-4, 0); g.lineTo(22, 0); g.stroke();
  g.strokeStyle = '#c98a3a'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(-4, 0); g.lineTo(22, 0); g.stroke();
  const disc = circleP({ x: 41, y: 0 }, 21);
  const col = o.color || '#ffd35c';
  partM(disc, col);
  g.save(); g.clip(disc); g.strokeStyle = 'rgba(180,60,30,0.75)'; g.lineWidth = 1.7;
  for (let i = -3; i <= 3; i++) { const an = i * 0.3; g.beginPath(); g.moveTo(22, 0); g.lineTo(22 + Math.cos(an) * 42, Math.sin(an) * 42); g.stroke(); }
  g.restore();
  g.strokeStyle = '#e0572f'; g.lineWidth = 3; g.beginPath(); g.arc(41, 0, 19.5, 0, TAU); g.stroke();
  g.restore();
  redrawHand(g, C, hnd);
}

function drawBottle(g, C, o) {
  const hnd = handOf(C, o), H = hnd.h, amt = o.amt;
  const th = C.V.hold + (o.tilt || 0);
  g.save(); g.translate(H.x, H.y); g.rotate(th);
  const body = new Path2D();
  body.moveTo(-8.5, 26); body.lineTo(-8.5, -8); body.quadraticCurveTo(-8.5, -17, -4, -21); body.lineTo(-4, -26); body.lineTo(4, -26); body.lineTo(4, -21); body.quadraticCurveTo(8.5, -17, 8.5, -8); body.lineTo(8.5, 26); body.quadraticCurveTo(8.5, 31, 3.5, 31); body.lineTo(-3.5, 31); body.quadraticCurveTo(-8.5, 31, -8.5, 26); body.closePath();
  partM(body, 'rgba(170,224,255,0.92)');
  g.save(); g.clip(body);
  const lvl = o.level != null ? o.level : 0.65;
  g.fillStyle = '#4fb3f2'; g.fillRect(-10, 31 - 56 * lvl, 20, 60);
  g.fillStyle = 'rgba(255,255,255,0.65)'; g.fillRect(-5.5, -14, 2.6, 40);
  g.fillStyle = '#ffffff'; g.fillRect(-10, 2, 20, 9); g.fillStyle = '#e0572f'; g.fillRect(-10, 5.5, 20, 2.6);
  g.restore();
  partM(rrect(-4.6, -32, 9.2, 8, 2), o.cap || '#2f6fe0');
  g.restore();
  redrawHand(g, C, hnd);
}

function drawPlate(g, C, o) {
  const hnd = handOf(C, o), H = hnd.h, amt = o.amt;
  const cx = H.x + 6, cy = H.y - 8;
  g.save(); g.translate(cx, cy); const sc = 0.4 + 0.6 * amt; g.scale(sc, sc);
  partM(ellipseP(0, 0, 29, 6.5, 0), '#f6f1e8');
  g.fillStyle = '#d9d2c4'; g.beginPath(); g.ellipse(0, 0.5, 20, 3.4, 0, 0, TAU); g.fill();
  const food = o.food || 'burger';
  if (food === 'pizza') {
    const sl = new Path2D(); sl.moveTo(-18, -3); sl.quadraticCurveTo(0, -9, 21, -1); sl.quadraticCurveTo(0, 5, -18, 3); sl.closePath();
    partM(sl, '#f4bf3a', { rim: false });
    g.fillStyle = '#d9822b'; g.beginPath(); g.ellipse(-16, 0, 4, 5.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#d6402f'; [[-4, -2], [6, -1], [-1, 1.4], [13, 0]].forEach((p) => { g.beginPath(); g.ellipse(p[0], p[1], 3.2, 2, 0, 0, TAU); g.fill(); });
  } else if (food === 'cake') {
    const cb = rrect(-15, -17, 30, 17, 3); partM(cb, '#f0d7a3', { rim: false });
    g.fillStyle = '#7a4a2a'; g.fillRect(-15, -9, 30, 4);
    g.fillStyle = '#ff8fb5'; g.beginPath(); g.ellipse(0, -17, 15, 4, 0, 0, TAU); g.fill();
    g.fillStyle = '#d6202f'; g.beginPath(); g.arc(0, -22, 3.6, 0, TAU); g.fill();
  } else {
    g.fillStyle = '#d9954a'; g.beginPath(); g.ellipse(0, -2, 16, 4.6, 0, 0, TAU); g.fill();
    g.fillStyle = '#5a3320'; g.fillRect(-16, -9, 32, 6);
    g.fillStyle = '#6dbb3a'; g.beginPath(); g.moveTo(-17, -9); for (let i = 0; i <= 6; i++) g.lineTo(-17 + i * 5.7, i % 2 ? -12.5 : -9.2); g.lineTo(17, -9); g.closePath(); g.fill();
    g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(-15, -10); g.lineTo(15, -10); g.lineTo(11, -14); g.lineTo(-11, -14); g.closePath(); g.fill();
    const bun = new Path2D(); bun.moveTo(-16, -13); bun.bezierCurveTo(-18, -29, 18, -29, 16, -13); bun.closePath();
    partM(bun, '#e0a050', { rim: false });
    g.fillStyle = '#fff3d0'; [[-7, -22], [0, -25], [7, -21], [-1, -19]].forEach((p) => { g.beginPath(); g.ellipse(p[0], p[1], 1.6, 1, 0.4, 0, TAU); g.fill(); });
  }
  g.restore();
  redrawHand(g, C, hnd);
}

function drawFlashlight(g, C, o) {
  const hnd = handOf(C, o), H = hnd.h, E_ = hnd.e;
  let ang = Math.atan2(H.y - E_.y, H.x - E_.x);
  if (o.ang != null) ang = -o.ang;      // local angle: 0 forward, + up
  g.save(); g.translate(H.x, H.y); g.rotate(ang);
  if (o.beam !== false) {
    const L = o.len || 340, spread = 0.2 + 0.0, a = (o.beamAlpha != null ? o.beamAlpha : 0.5) * o.amt;
    const gr = g.createLinearGradient(30, 0, 30 + L, 0); gr.addColorStop(0, 'rgba(255,246,196,' + a + ')'); gr.addColorStop(1, 'rgba(255,246,196,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(30, -5); g.lineTo(30 + L, -L * Math.tan(spread)); g.lineTo(30 + L, L * Math.tan(spread)); g.lineTo(30, 5); g.closePath(); g.fill();
  }
  partM(limb([{ x: -14, y: 0 }, { x: 18, y: 0 }], [4.6, 4.6]), '#6c6a78');
  g.fillStyle = '#ffd23f'; g.fillRect(-2, -4.6, 7, 9.2);
  partM(limb([{ x: 18, y: 0 }, { x: 28, y: 0 }], [6.8, 8]), '#4a4858');
  g.fillStyle = '#fff6c4'; g.beginPath(); g.ellipse(29.5, 0, 2.6, 7, 0, 0, TAU); g.fill();
  g.restore();
  redrawHand(g, C, hnd);
}

function drawMug(g, C, o) {
  const hnd = handOf(C, o), H = hnd.h, t = C.t, amt = o.amt;
  const th = (C.V.hold || 0) * 0.5;
  g.save(); g.translate(H.x + 2, H.y - 4); g.rotate(th); const sc = 0.4 + 0.6 * amt; g.scale(sc, sc);
  const col = o.color || '#f4efe6';
  // handle (back side)
  g.strokeStyle = E.pal.edge; g.lineWidth = 8; g.beginPath(); g.arc(-12, -2, 7.5, Math.PI * 0.5, Math.PI * 1.5, false); g.stroke();
  g.strokeStyle = col; g.lineWidth = 4.4; g.beginPath(); g.arc(-12, -2, 7.5, Math.PI * 0.5, Math.PI * 1.5, false); g.stroke();
  partM(rrect(-12, -15, 24, 25, 5), col);
  g.fillStyle = o.band || '#e0572f'; g.fillRect(-12, -6, 24, 5);
  g.fillStyle = '#4a2a1a'; g.beginPath(); g.ellipse(0, -15, 11, 2.6, 0, 0, TAU); g.fill();
  if (o.steam !== false) {
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2.6; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const u = fract(t * 0.7 + i / 3), x0 = (i - 1) * 6.5, a = Math.sin(Math.PI * u);
      g.globalAlpha = 0.75 * a * amt; g.beginPath(); g.moveTo(x0, -17);
      g.bezierCurveTo(x0 + 6 * Math.sin(t * 3 + i), -24 - 6 * u, x0 - 6 * Math.sin(t * 3 + i), -30 - 10 * u, x0 + 2, -36 - 16 * u); g.stroke();
    }
    g.globalAlpha = 1;
  }
  g.restore();
  redrawHand(g, C, hnd);
}

// ------------------------------------------------------------------ extras on the arm: finger / thumb / palm
function drawHandExtras(g, C) {
  const V = C.V, A = C.P.armF, pal = C.pal;
  const f = { x: A.hand.x - A.elbow.x, y: A.hand.y - A.elbow.y }, fl = Math.hypot(f.x, f.y) || 1, dx = f.x / fl, dy = f.y / fl;
  if (V.finger > 0.5) {
    partM(limb([{ x: A.hand.x + dx * 4, y: A.hand.y + dy * 4 }, { x: A.hand.x + dx * 17, y: A.hand.y + dy * 17 }], [4.4, 3.6]), pal.hand);
  }
  if (V.thumb > 0.5) {
    partM(circleP({ x: A.hand.x + 1, y: A.hand.y - 1 }, 9.8), pal.hand);
    partM(limb([{ x: A.hand.x + 1, y: A.hand.y - 6 }, { x: A.hand.x + 2, y: A.hand.y - 19 }], [4.6, 4.0]), pal.hand);
  }
}

// ------------------------------------------------------------------ FX (screen aligned: never mirrored, so symbols stay readable)
function teardrop(g, r) {
  g.beginPath(); g.moveTo(0, -2.2 * r); g.quadraticCurveTo(0.35 * r, -1.0 * r, 0.98 * r, 0.2 * r);
  g.arc(0, 0.2 * r, 0.98 * r, 0, Math.PI, false); g.quadraticCurveTo(-0.35 * r, -1.0 * r, 0, -2.2 * r); g.closePath();
}
function fxSweat(g, C, amt) {
  const n = Math.min(4, 1 + Math.floor(amt * 3.5)), f = C.f, R = 29, t = C.t;
  for (let i = 0; i < n; i++) {
    const per = 1.25 + 0.15 * i, u = fract(t / per + i / n + 0.13 * i);
    let x, y, al = 1, sz = 1;
    if (u < 0.58) {
      const q = u / 0.58, th = lerp(-1.15, 0.55, q * (0.6 + 0.4 * q));
      x = Math.cos(th) * (R + 2.5) * f; y = Math.sin(th) * (R + 2.5); sz = 0.55 + 0.45 * smooth(q * 2);
    } else {
      const q = (u - 0.58) / 0.42, th = 0.55;
      x = Math.cos(th) * (R + 2.5) * f + f * 8 * q; y = Math.sin(th) * (R + 2.5) + 70 * q * q; al = 1 - q * q; sz = 1;
    }
    g.save(); g.globalAlpha *= al; g.translate(x, y); const r = 4.6 * sz; g.scale(1, 1);
    teardrop(g, r);
    g.fillStyle = '#8fdcff'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = '#2a6fb0'; g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-r * 0.3, r * 0.1, r * 0.28, 0, TAU); g.fill();
    g.restore();
  }
  if (amt > 0.8) {   // flung droplets
    for (let i = 0; i < 3; i++) {
      const u = fract(t * 1.1 + i * 0.33), a = -1.9 + i * 0.5 + (i === 1 ? 0.2 : 0), d = 34 + 30 * u;
      g.save(); g.globalAlpha *= (1 - u) * Math.min(1, u * 6); g.translate(Math.cos(a) * d * f, Math.sin(a) * d + 22 * u * u); teardrop(g, 3.4);
      g.fillStyle = '#8fdcff'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = '#2a6fb0'; g.stroke(); g.restore();
    }
  }
}
function fxSteam(g, C, amt) {
  const t = C.t, f = C.f;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const u = fract(t * 0.95 + i / 4 + (side > 0 ? 0.37 : 0)), a = Math.sin(Math.PI * Math.min(1, u * 1.15));
      const x = side * (17 + 5 * Math.sin(t * 4 + i + side)) + side * 6 * u, y = -36 - 52 * u, r = (5 + 11 * u) * (0.6 + 0.4 * amt);
      g.save(); g.globalAlpha *= 0.9 * a * amt;
      g.fillStyle = '#f4f6ff'; g.strokeStyle = 'rgba(70,70,110,0.55)'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); g.restore();
    }
  }
}
function fxBreath(g, C, amt) {
  const t = C.t, f = C.f;
  for (let i = 0; i < 3; i++) {
    const u = fract(t * 0.8 + i / 3), a = Math.sin(Math.PI * u);
    const x = f * (31 + 34 * u), y = 12 - 10 * u + 3 * Math.sin(t * 3 + i), r = 4 + 9 * u;
    g.save(); g.globalAlpha *= 0.85 * a * amt; g.fillStyle = '#eef6ff'; g.strokeStyle = 'rgba(80,110,160,0.55)'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); g.restore();
  }
}
function zPath(g, sz) { g.beginPath(); g.moveTo(-sz, -sz); g.lineTo(sz, -sz); g.lineTo(-sz, sz); g.lineTo(sz, sz); }
function fxZ(g, C, amt) {
  const t = C.t, f = C.f;
  for (let i = 0; i < 3; i++) {
    const u = fract(t * 0.38 + i / 3), a = Math.sin(Math.PI * u) * Math.min(1, amt * 1.4);
    const x = f * (22 + 34 * u + 5 * Math.sin(t * 2 + i * 2)), y = -38 - 68 * u, sz = (4.5 + 8 * u);
    g.save(); g.globalAlpha *= a; g.translate(x, y); g.rotate(f * (0.18 + 0.1 * Math.sin(t * 2 + i)));
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(20,16,40,0.9)'; g.lineWidth = sz * 0.9 + 4; zPath(g, sz); g.stroke();
    g.strokeStyle = '#f4f8ff'; g.lineWidth = sz * 0.9; zPath(g, sz); g.stroke();
    g.restore();
  }
}
function star4(g, R, r) {
  g.beginPath();
  for (let i = 0; i < 8; i++) { const an = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r : R; i ? g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : g.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
  g.closePath();
}
function fxSparkle(g, C, amt) {
  const t = C.t, n = Math.min(6, 2 + Math.round(amt * 4));
  for (let i = 0; i < n; i++) {
    const u = fract(t * 0.9 + hash1(i * 3 + 1) * 1.7), a = Math.sin(Math.PI * u), r0 = rng(i * 77 + 5);
    const ang = r0() * TAU, d = 36 + r0() * 34, sc = (0.6 + r0() * 0.8) * a;
    g.save(); g.globalAlpha *= clamp(a * 1.6); g.translate(Math.cos(ang) * d * 1.1, Math.sin(ang) * d * 0.9 - 8); g.rotate(0.3 * Math.sin(t * 3 + i));
    star4(g, 11 * sc + 2, 3.2 * sc + 0.6);
    g.fillStyle = '#fff6b0'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = '#e8a010'; g.lineJoin = 'round'; g.stroke();
    g.restore();
  }
}
function fxShiver(g, C, amt) {
  const t = C.t, R = 29;
  g.save(); g.lineCap = 'round'; g.lineWidth = 3; g.strokeStyle = '#d9f1ff';
  const flick = Math.sin(t * 47) > -0.3;
  for (let side = -1; side <= 1; side += 2) {
    if (!flick && side > 0) continue;
    for (let k = 0; k < 2; k++) {
      const rr = R + 7 + k * 7, off = 0.18 * Math.sin(t * 61 + k + side);
      g.globalAlpha = 0.9 * amt * (1 - k * 0.3);
      g.beginPath(); g.arc(0, 0, rr, (side > 0 ? 0 : Math.PI) - 0.45 + off, (side > 0 ? 0 : Math.PI) + 0.45 + off); g.stroke();
    }
  }
  g.restore();
}
function fxLines(g, C, kind) {
  const t = C.t, f = C.f, R = 29;
  if (kind === 'shock') {
    g.save(); g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const an = -Math.PI / 2 + (i - 2) * 0.42, pul = 0.5 + 0.5 * Math.sin(t * 22 + i * 1.7), r0 = R + 8 + 4 * pul, r1 = r0 + 12 + 8 * pul;
      g.strokeStyle = 'rgba(20,16,40,0.9)'; g.lineWidth = 7; g.beginPath(); g.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); g.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.stroke();
    }
    g.restore();
  } else if (kind === 'anger') {
    const pul = 1 + 0.12 * Math.sin(t * 14); g.save(); g.translate(f * 22, -R - 6); g.scale(pul, pul); g.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass ? '#ff3b3b' : 'rgba(30,6,6,0.9)'; g.lineWidth = pass ? 4.2 : 8;
      for (let q = 0; q < 4; q++) {
        g.save(); g.rotate(q * Math.PI / 2 + Math.PI / 4); g.beginPath(); g.moveTo(5, -6); g.quadraticCurveTo(13, -6, 13, -14); g.stroke(); g.restore();
      }
    }
    g.restore();
  } else if (kind === 'dizzy') {
    for (let i = 0; i < 3; i++) {
      const an = t * 3.2 + i * TAU / 3, x = Math.cos(an) * 30, y = -R - 12 + Math.sin(an) * 7, front = Math.sin(an) > 0;
      g.save(); g.translate(x, y); g.rotate(t * 2 + i); g.globalAlpha *= front ? 1 : 0.6; star4(g, 9, 3.6);
      g.fillStyle = '#fff6b0'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = '#e8a010'; g.lineJoin = 'round'; g.stroke(); g.restore();
    }
  }
}
function fxPop(g, C, ex) {
  const kind = ex.pop, t = C.t, f = C.f, R = 29;
  const t0 = ex.popT != null ? ex.popT : -10;
  let k = spring(t - t0, 420, 15);
  if (ex.popDur != null) { const u = t - t0 - ex.popDur; if (u > 0) k = k * clamp(1 - u / 0.15); }
  if (k <= 0.01) return;
  const bob = 2.5 * Math.sin(t * 5);
  g.save(); g.translate(f * 24, -R - 34 + bob); g.scale(k, k); g.rotate(f * 0.15 * Math.sin(t * 3));
  g.lineCap = 'round'; g.lineJoin = 'round';
  const bang = () => { g.beginPath(); g.moveTo(0, -17); g.lineTo(0, 3); g.moveTo(0, 14); g.lineTo(0, 14.1); };
  const ques = () => { g.beginPath(); g.moveTo(-8.5, -9); g.bezierCurveTo(-8.5, -22, 9, -22, 9, -10); g.bezierCurveTo(9, -3, 0, -3, 0, 5); g.moveTo(0, 14); g.lineTo(0, 14.1); };
  const fn = kind === '?' ? ques : bang;
  g.strokeStyle = 'rgba(20,16,40,0.95)'; g.lineWidth = 15; fn(); g.stroke();
  g.strokeStyle = kind === '?' ? '#ffffff' : '#ffd23f'; g.lineWidth = 8.5; fn(); g.stroke();
  g.restore();
}
function drawFX(g, C) {
  const ex = C.ex, hd = W(C, C.P.head), s = C.s;
  const need = ex.sweat > 0 || ex.steam > 0 || ex.breath > 0 || ex.sleepZ > 0 || ex.sparkle > 0 || ex.shiver > 0 || ex.lines || ex.pop;
  if (!need) return;
  g.save(); g.translate(hd.x, hd.y); g.scale(s, s); g.globalAlpha = C.alpha;
  if (ex.steam > 0) fxSteam(g, C, ex.steam);
  if (ex.lines) fxLines(g, C, ex.lines);
  if (ex.shiver > 0.05) fxShiver(g, C, clamp(ex.shiver));
  if (ex.breath > 0) fxBreath(g, C, clamp(ex.breath));
  if (ex.sweat > 0) fxSweat(g, C, clamp(ex.sweat));
  if (ex.sleepZ > 0) fxZ(g, C, clamp(ex.sleepZ));
  if (ex.sparkle > 0) fxSparkle(g, C, clamp(ex.sparkle));
  if (ex.pop) fxPop(g, C, ex);
  g.restore();
}

// ------------------------------------------------------------------ shadow (own copy, wider for lying poses)
function shadowM(g, x, y, rx, alpha) {
  g.save(); g.translate(x - rx * 0.28, y + 2); g.scale(1, 0.13);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, 'rgba(8,3,18,' + (0.5 * alpha) + ')'); gr.addColorStop(0.6, 'rgba(8,3,18,' + (0.22 * alpha) + ')'); gr.addColorStop(1, 'rgba(8,3,18,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
}

// ------------------------------------------------------------------ main draw
function draw(g, st) {
  const C = resolve(st), P = C.P, pal = C.pal, f = C.f, s = C.s, V = C.V;
  const ghost = !!pal.ghost;
  if (!ghost && st.shadow !== false) shadowM(g, C.x, C.y, V.shw * s, C.alpha);
  G.drawWalker(g, { x: C.x, y: C.y, s, facing: f, pose: P, pal, alpha: C.alpha, shadow: false });

  g.save();
  g.translate(C.x, C.y); g.scale(f * s, s);
  g.globalAlpha = C.alpha;
  setEnv(g, pal, s, f);
  const props = C.props;
  const pr = (n) => propOf(props, n);
  let o;
  if ((o = pr('blanket'))) drawBlanket(g, C, o);
  if ((o = pr('scarf'))) drawScarf(g, C, o);
  drawEyes(g, C);
  if ((o = pr('towel'))) drawTowel(g, C, o);
  if ((o = pr('beanie'))) drawBeanie(g, C, o);
  if ((o = pr('sunglasses'))) drawSunglasses(g, C, o);
  // front arm in front of the face?
  const hd = P.head, hh = P.armF.hand;
  const nearFace = Math.hypot(hh.x - hd.x, hh.y - hd.y) < 56 || Math.hypot(P.armF.elbow.x - hd.x, P.armF.elbow.y - hd.y) < 44;
  if (nearFace) {
    redrawArm(g, C);
  }
  if (V.finger > 0.5 || V.thumb > 0.5) drawHandExtras(g, C);
  if (props) {
    if ((o = pr('umbrella'))) drawUmbrella(g, C, o);
    if ((o = pr('flashlight'))) drawFlashlight(g, C, o);
    if ((o = pr('waterBottle'))) drawBottle(g, C, o);
    if ((o = pr('mug'))) drawMug(g, C, o);
    if ((o = pr('plate'))) drawPlate(g, C, o);
    if ((o = pr('fan')) || (C.pname === 'fanSelf' && !(props.fan === false))) drawFan(g, C, o || { amt: 1 });
  } else if (C.pname === 'fanSelf') drawFan(g, C, { amt: 1 });
  if (props && (o = pr('blanket')) && o.hold !== false) {
    // hands clutching the blanket closed
    redrawHand(g, C, { h: P.armF.hand, e: P.armF.elbow, col: pal.hand }, 8.4);
  }
  g.restore();
  E.g = null;
  g.save(); drawFX(g, C); g.restore();
  g.globalAlpha = 1;
}

function redrawArm(g, C) {
  const A = C.P.armF, pal = C.pal, g_ = g;
  const fx = A.hand.x - A.elbow.x, fy = A.hand.y - A.elbow.y, fl = Math.hypot(fx, fy) || 1;
  const wr = { x: A.hand.x - fx / fl * 5, y: A.hand.y - fy / fl * 5 };
  const sleeve = limb([A.sh, A.elbow, wr], [10.8, 9.2, 8]);
  partM(sleeve, pal.hood);
  g.save(); g.clip(sleeve);
  const cp = mix2(A.elbow, A.hand, 0.74), nx = -fy / fl, ny = fx / fl;
  g.strokeStyle = pal.hoodDark; g.globalAlpha *= 0.9; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(cp.x - nx * 12, cp.y - ny * 12); g.lineTo(cp.x + nx * 12, cp.y + ny * 12); g.stroke();
  g.restore();
  const hc = { x: A.hand.x + fx / fl * 2, y: A.hand.y + fy / fl * 2 };
  if (C.V.palm > 0.5) {
    const pp = new Path2D(); pp.ellipse(hc.x + fx / fl * 3, hc.y + fy / fl * 3, 11.5, 14.5, Math.atan2(fy, fx) + Math.PI / 2, 0, TAU);
    partM(pp, pal.hand, {}); g.lineWidth = 1.8; g.strokeStyle = 'rgba(150,140,190,0.8)'; g.stroke(pp);
    g.strokeStyle = 'rgba(150,140,190,0.55)'; g.lineWidth = 1.4;
    for (let i = -1; i <= 1; i++) { const a = Math.atan2(fy, fx), px = hc.x + Math.cos(a) * 12 + Math.cos(a + Math.PI / 2) * i * 5, py = hc.y + Math.sin(a) * 12 + Math.sin(a + Math.PI / 2) * i * 5; g.beginPath(); g.moveTo(px - Math.cos(a) * 7, py - Math.sin(a) * 7); g.lineTo(px, py); g.stroke(); }
  } else {
    const hp = circleP(hc, 8.4);
    partM(hp, pal.hand);
    g.lineWidth = 1.6; g.strokeStyle = 'rgba(150,140,190,0.7)'; g.stroke(hp);
  }
}

// ------------------------------------------------------------------ joints (world coords)
function joints(st) {
  const C = resolve(st), P = C.P, s = C.s, f = C.f;
  const head = Object.assign(W(C, P.head), { r: 29 * s, rot: f > 0 ? P.head.rot : Math.PI - P.head.rot });
  const eyeL = { x: 17 + 0, y: -3 };    // eye pair centre (head local, rotated)
  const c = Math.cos(P.head.rot), sn = Math.sin(P.head.rot);
  const eyes = W(C, { x: P.head.x + eyeL.x * c - eyeL.y * sn, y: P.head.y + eyeL.x * sn + eyeL.y * c });
  const topL = W(C, { x: P.head.x + 0, y: P.head.y - 29 });
  const topRot = W(C, { x: P.head.x + Math.sin(P.head.rot) * 29 * 0 - Math.sin(P.head.rot) * 29, y: P.head.y - Math.cos(P.head.rot) * 29 });
  const sole = (L) => W(C, { x: L.ankle.x + 4 * Math.cos(L.pitch), y: L.ankle.y + AH });
  const bub = W(C, { x: P.head.x + 30, y: P.head.y - 62 });
  return {
    head, eyes, top: topRot, topUp: topL, bubble: bub,
    chin: W(C, { x: P.head.x + Math.sin(P.head.rot + 1.57) * 0 + Math.cos(P.head.rot) * 22, y: P.head.y + Math.sin(P.head.rot) * 22 + 12 }),
    shoulder: W(C, P.J), chest: W(C, mix2(P.waist, P.shTop, 0.7)), hip: W(C, P.hip),
    handF: W(C, P.armF.hand), handB: W(C, P.armB.hand), elbowF: W(C, P.armF.elbow), elbowB: W(C, P.armB.elbow),
    footF: sole(P.legF), footB: sole(P.legB), kneeF: W(C, P.legF.knee), kneeB: W(C, P.legB.knee),
    ground: { x: st.x || 0, y: st.y || 0 }, facing: f, scale: s
  };
}

// ------------------------------------------------------------------ public API
G.MASCOT = {
  draw: draw, joints: joints,
  palette: palette, pal: palByName,
  poses: Object.keys(POSES), exprs: Object.keys(EXPR), eyeTypes: Object.keys(SHAPES).concat(Object.keys(STROKES)),
  props: ['umbrella', 'sunglasses', 'scarf', 'blanket', 'fan', 'waterBottle', 'plate', 'flashlight', 'towel', 'mug', 'beanie'],
  EXPR: EXPR, blink: blinkAmt
};
})(typeof window !== 'undefined' ? window : globalThis);
