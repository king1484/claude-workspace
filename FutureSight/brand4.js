// brand4.js — What If Labs icon variants: mode=face (head close-up) | mode=portal (host reaching into a what-if portal)
(function () {
'use strict';
const W = 1920, H = 1080, B = window.__B, { glow, neon, LOOP, TAU } = B;
const MODE = (new URLSearchParams(location.search)).get('mode') || 'face';
function ik2b(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function pose(t, raise, o) {
  o = o || {};
  const P = walkerPose({ phase: 0, walk: 0, headDown: o.headDown || 0, lean: o.lean == null ? 0.02 : o.lean, bob: 0.6, eyeOpen: o.eyeOpen == null ? 1 : o.eyeOpen, eyeGlow: 0, flutter: 0.1, step: 0, time: t });
  if (raise > 0) {
    const J = P.J, phi = lerp(0.1, 2.9, raise), reach = 71 + 6.4 * raise;
    const r = ik2b(J, { x: J.x + Math.sin(phi) * reach, y: J.y + Math.cos(phi) * reach }, 39, 39, -1);
    P.armF = { sh: J, elbow: r.mid, hand: r.end };
  }
  return P;
}
function stars(g, ph, n, seed) {
  const r = rng(seed); g.fillStyle = '#d6edff';
  for (let i = 0; i < n; i++) { const x = 420 + r() * 1080, y = r() * H, tw = 0.5 + 0.5 * Math.sin(ph * (1 + (i % 3)) + i); g.globalAlpha = 0.15 + 0.55 * tw * r(); g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
}
function bgFill(g, c0, c1, c2) {
  const bg = g.createRadialGradient(960, 480, 60, 960, 540, 800); bg.addColorStop(0, c0); bg.addColorStop(0.55, c1); bg.addColorStop(1, c2);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
}
// place hero so a chosen body point lands on (tx,ty)
function place(P, s, key, tx, ty) {
  const j0 = walkerJoints({ x: 0, y: 0, s, facing: 1, pose: P });
  const q = key === 'head' ? j0.head : j0.handF;
  return { x: tx - q.x, y: ty - q.y };
}
function FACE(g, t) {
  const ph = (t / LOOP) * TAU, S = 9.6;
  bgFill(g, '#ff9d4a', '#a02a78', '#1a0c40');
  glow(g, 960, 540, 620, '255,220,150', 0.35); stars(g, ph, 60, 5);
  // neon ring behind head
  g.save(); g.translate(960, 540);
  neon(g, 'rgba(255,240,200,0.85)', 9, () => { g.beginPath(); g.arc(0, 0, 470 + Math.sin(ph) * 6, 0, TAU); g.stroke(); }, 24);
  neon(g, 'rgba(120,230,255,0.7)', 5, () => { g.beginPath(); g.arc(0, 0, 505, 0, TAU); g.stroke(); }, 16);
  g.restore();
  const blink = (t > 1.9 && t < 2.1) ? 0.12 : 1;
  const P = pose(t, 0, { eyeOpen: blink, lean: 0.0 });
  const pos = place(P, S, 'head', 960, 560 + Math.sin(ph) * 5);
  drawWalker(g, { x: pos.x, y: pos.y, s: S, facing: 1, pose: P, pal: PAL_REAL, alpha: 1 });
  // sparkle question marks
  B.qmark(g, 1330, 250, 120, t, 'rgba(255,255,255,0.9)'); B.qmark(g, 600, 280, 70, t + 1.3, 'rgba(255,230,160,0.85)');
}
function PORTAL(g, t) {
  const ph = (t / LOOP) * TAU, S = 5.2;
  bgFill(g, '#2a3fd0', '#150f55', '#05051c'); stars(g, ph, 80, 9);
  glow(g, 1100, 360, 560, '170,90,255', 0.35); glow(g, 640, 900, 420, '255,90,170', 0.22);
  const P = pose(t, 0.66 + 0.03 * Math.sin(ph), { lean: -0.04 });
  const pos = place(P, S, 'head', 720, 600 + Math.sin(ph) * 5);
  const st = { x: pos.x, y: pos.y, s: S, facing: 1, pose: P, pal: PAL_REAL, alpha: 1 };
  const J = walkerJoints(st);
  const px = J.handF.x + 215, py = J.handF.y - 40;
  // portal rings
  g.save(); g.translate(px, py);
  for (let k = 0; k < 4; k++) {
    const rr = 112 + k * 40 + Math.sin(ph + k) * 5;
    neon(g, k % 2 ? 'rgba(170,120,255,0.75)' : 'rgba(120,230,255,0.8)', 8 - k, () => { g.beginPath(); g.ellipse(0, 0, rr * 0.8, rr, 0.15, 0, TAU); g.stroke(); }, 18);
  }
  const pg = g.createRadialGradient(0, 0, 0, 0, 0, 130); pg.addColorStop(0, '#fff'); pg.addColorStop(0.35, 'rgba(160,230,255,0.9)'); pg.addColorStop(1, 'rgba(110,60,255,0.2)');
  g.fillStyle = pg; g.beginPath(); g.ellipse(0, 0, 100, 125, 0.15, 0, TAU); g.fill();
  g.restore();
  drawWalker(g, st);
  // objects spiralling out of the portal
  const items = [[B.planet, 62, 0.0], [B.atom, 58, 0.33], [B.bolt, 44, 0.66]];
  items.forEach(([fn, sz, off]) => {
    const u = (((t / LOOP) + off) % 1 + 1) % 1, a = -2.4 + u * 2.0, d = 190 + u * 300;
    const x = px + Math.cos(a) * d * 1.1, y = py + Math.sin(a) * d * 0.9;
    g.save(); g.globalAlpha = Math.min(1, u * 5) * Math.min(1, (1 - u) * 4); fn(g, x, y, sz * (0.5 + u * 0.7), 0); g.restore();
  });
  B.qmark(g, 1360, 880, 110, t + 0.7, 'rgba(255,140,210,0.9)');
}
window.drawFrame = function (g, T) {
  const t = ((T % LOOP) + LOOP) % LOOP;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  (MODE === 'portal' ? PORTAL : FACE)(g, t);
  const v = g.createRadialGradient(960, 540, 420, 960, 540, 900); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,14,0.45)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
};
})();
