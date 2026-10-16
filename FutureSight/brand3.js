// brand3.js — What If Labs icon with the stickman host holding the "?" flask. Loops every 4 s.
(function () {
'use strict';
const W = 1920, H = 1080, { flask, glow, neon, LOOP, TAU } = window.__B;
function ik2b(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function pose(t, raise) {
  const P = walkerPose({ phase: 0, walk: 0, headDown: 0, lean: 0.02, bob: 0.6, eyeOpen: 1, eyeGlow: 0, flutter: 0.1, step: 0, time: t });
  const J = P.J, phi = lerp(0.1, 2.45, raise), reach = 71 + 6.4 * raise;
  const r = ik2b(J, { x: J.x + Math.sin(phi) * reach, y: J.y + Math.cos(phi) * reach }, 39, 39, -1);
  P.armF = { sh: J, elbow: r.mid, hand: r.end };
  return P;
}
window.drawFrame = function (g, T) {
  const t = ((T % LOOP) + LOOP) % LOOP, ph = (t / LOOP) * TAU;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  // backdrop
  const bg = g.createRadialGradient(960, 480, 60, 960, 540, 800); bg.addColorStop(0, '#4a2fb0'); bg.addColorStop(0.55, '#16124f'); bg.addColorStop(1, '#060720');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  glow(g, 700, 900, 520, '255,90,170', 0.25); glow(g, 1260, 330, 480, '60,150,255', 0.30);
  const r = rng(7); g.fillStyle = '#d6edff';
  for (let i = 0; i < 70; i++) { const x = 420 + r() * 1080, y = r() * H, tw = 0.5 + 0.5 * Math.sin(ph * (1 + (i % 3)) + i); g.globalAlpha = 0.15 + 0.55 * tw * r(); g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  // orbit rings behind
  g.save(); g.translate(1230, 470);
  [[0.25, '120,230,255'], [-0.6, '190,130,255']].forEach(([rot, col], k) => {
    g.save(); g.rotate(rot); neon(g, `rgba(${col},0.7)`, 6, () => { g.beginPath(); g.ellipse(0, 0, 330, 112, 0, 0, TAU); g.stroke(); }, 14);
    const a = ph * (k ? -1 : 1) + k * 2.4; g.fillStyle = '#fff'; g.shadowColor = `rgba(${col},1)`; g.shadowBlur = 22; g.beginPath(); g.arc(Math.cos(a) * 330, Math.sin(a) * 112, 13, 0, TAU); g.fill(); g.restore();
  });
  g.restore();
  // hero (upper body, big)
  const S = 5.6, hx = 740, hy = 1650 + Math.sin(ph) * 6;
  const P = pose(t, 0.78 + 0.04 * Math.sin(ph));
  const st = { x: hx, y: hy, s: S, facing: 1, pose: P, pal: PAL_REAL, alpha: 1 };
  glow(g, hx + 80, 430, 520, '255,200,160', 0.14);
  drawWalker(g, st);
  const J = walkerJoints(st);
  // flask held in the raised hand
  const fx = J.handF.x + 60, fy = J.handF.y - 120 + Math.sin(ph + 1) * 7;
  flask(g, fx, fy, 190, t);
  window.__dbg = { head: J.head, hand: J.handF };
  // vignette
  const v = g.createRadialGradient(960, 540, 420, 960, 540, 900); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,14,0.5)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
};
})();
