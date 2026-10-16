// brand9.js — What If Labs banner with the host (thinking) in place of the flask logo. 1920x1080 canvas -> 2560x1440.
(function () {
'use strict';
const W = 1920, H = 1080, B = window.__B, { space, forkTree, text, glow, LOOP, TAU, planet, atom, bolt, hourglass, rocket, vortex, qmark } = B;
function ik2b(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function man(g, t, o) {
  const ph = (t / LOOP) * TAU;
  const P = walkerPose({ phase: 0, walk: 0, headDown: 0.14 + 0.03 * Math.sin(ph), lean: 0.03, bob: 0.6, eyeOpen: (t > 2.9 && t < 3.1) ? 0.12 : 1, eyeGlow: 0, flutter: 0.1, step: 0, time: t });
  const J = P.J, hd = P.head, tgt = { x: hd.x + 26, y: hd.y + 32 + Math.sin(ph) * 2 };
  const r = ik2b(J, tgt, 39, 39, -1); P.armF = { sh: J, elbow: r.mid, hand: r.end };
  drawWalker(g, { x: o.hx, y: o.hy + Math.sin(ph) * 4, s: o.S, facing: 1, pose: P, pal: PAL_REAL, alpha: 1 });
}
function qm(g, x, y, size, a, col, rot) {
  g.save(); g.translate(x, y); g.rotate(rot || 0); g.globalAlpha = a; g.font = `900 ${size}px "Segoe UI Black","Arial Black",Impact,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = col; g.shadowBlur = size * 0.35; g.lineJoin = 'round'; g.lineWidth = size * 0.1; g.strokeStyle = 'rgba(20,10,60,0.9)'; g.strokeText('?', 0, 0);
  g.shadowBlur = 0; g.fillStyle = col; g.fillText('?', 0, 0); g.restore();
}
function BANNER(g, t) {
  const ph = (t / LOOP) * TAU;
  space(g, t); forkTree(g, t);
  planet(g, 215, 245, 118, t); vortex(g, 190, 860, 120, t); bolt(g, 470, 135, 78, t); hourglass(g, 1445, 345, 78, t);
  atom(g, 1710, 235, 118, t); rocket(g, 1590, 640, 92, t); qmark(g, 1790, 820, 190, t, 'rgba(255,140,210,0.9)'); qmark(g, 1230, 130, 80, t + 1, 'rgba(120,230,255,0.8)');
  // soft spotlight behind host + wordmark
  const sc = g.createRadialGradient(960, 540, 100, 960, 540, 600); sc.addColorStop(0, 'rgba(6,8,34,0.75)'); sc.addColorStop(0.65, 'rgba(6,8,34,0.4)'); sc.addColorStop(1, 'rgba(6,8,34,0)');
  g.fillStyle = sc; g.fillRect(0, 0, W, H);
  glow(g, 560, 520, 330, '255,90,170', 0.2); glow(g, 640, 430, 260, '127,233,255', 0.18);
  man(g, t, { S: 4.1, hx: 535, hy: 1425 });
  qm(g, 795, 370, 70, 0.9, '#ffe14a', Math.sin(ph) * 0.1);
  const cy = 540, X = 1085;
  text(g, 'WHAT IF', X, cy - 62, 104, '#fff27a', '#ff9a1f', '#0a0a1a', 'rgba(255,170,40,0.7)');
  text(g, 'LABS', X, cy + 36, 104, '#ffffff', '#7fe9ff', '#0a0a1a', 'rgba(80,220,255,0.8)');
  g.save(); g.font = '600 30px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(225,245,255,0.92)'; g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 8;
  g.fillText('Wild questions. Animated answers.', X + 8, cy + 112); g.restore();
  const v = g.createRadialGradient(960, 540, 600, 960, 540, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,12,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
}
window.drawFrame = function (g, T) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  BANNER(g, ((T % LOOP) + LOOP) % LOOP);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
};
})();
