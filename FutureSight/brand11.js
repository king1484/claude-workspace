// brand11.js — What If Labs banner v3: host sized to fit YouTube's desktop strip (canvas y 381-698). mode=<pose>_<colour>, pose = think|laugh|wave|point
(function () {
'use strict';
const W = 1920, H = 1080, B = window.__B, { space, forkTree, text, glow, LOOP, TAU, planet, atom, bolt, hourglass, rocket, vortex, qmark } = B;
const [POSE, COL] = ((new URLSearchParams(location.search)).get('mode') || 'think_red').split('_');
const COLS = {
  red: ['#d63a3a', '#a82d2d', '#8a2226', '#ec5a50'], blue: ['#2f7be0', '#2358ad', '#1a3f82', '#5aa2ff'], green: ['#2fb36a', '#228a50', '#176238', '#5fdc95'],
  yellow: ['#f2c230', '#c99a14', '#9a720a', '#ffe070'], purple: ['#8a4fe0', '#6a37b3', '#4c2585', '#b084ff'], white: ['#eef2fb', '#c3cbe0', '#9aa3bf', '#ffffff'],
};
const CC = COLS[COL] || COLS.red;
const PAL = Object.assign({}, PAL_REAL, { hood: CC[0], hoodBack: CC[1], hoodDark: CC[2], hoodLight: CC[3] });
function ik2b(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
const S = 2.95, HEAD_TOP = 404, HX = 520;   // head top sits just inside the safe strip
function man(g, t) {
  const ph = (t / LOOP) * TAU, laugh = POSE === 'laugh', sh = laugh ? Math.sin(ph * 8) : 0;
  const hdn = laugh ? -0.12 + 0.025 * sh : POSE === 'think' ? 0.14 + 0.03 * Math.sin(ph) : 0.04 + 0.02 * Math.sin(ph);
  const P = walkerPose({ phase: 0, walk: 0, headDown: hdn, lean: laugh ? -0.04 + 0.01 * sh : 0.03, bob: 0.6, eyeOpen: laugh ? 0 : ((t > 2.9 && t < 3.1) ? 0.12 : 1), eyeGlow: 0, flutter: 0.1, step: 0, time: t });
  const J = P.J, hd = P.head;
  let tgt;
  if (POSE === 'think') tgt = { x: hd.x + 26, y: hd.y + 32 + Math.sin(ph) * 2 };
  else if (POSE === 'laugh') tgt = { x: J.x + 30, y: J.y + 72 + 3 * sh };
  else if (POSE === 'wave') tgt = { x: J.x + 52 + 9 * Math.sin(ph * 4), y: J.y - 52 };
  else tgt = { x: J.x + 76, y: J.y - 8 + 3 * Math.sin(ph) };   // point toward the title
  const r = ik2b(J, tgt, 39, 39, -1); P.armF = { sh: J, elbow: r.mid, hand: r.end };
  if (laugh) { const rb = ik2b(J, { x: J.x + 14, y: J.y + 80 - 2 * sh }, 39, 39, -1); P.armB = { sh: J, elbow: rb.mid, hand: rb.end }; }
  const x = HX - S * hd.x, y = HEAD_TOP + S * (29 - hd.y) + 0 + (laugh ? 4 * sh : Math.sin(ph) * 3);
  drawWalker(g, { x, y, s: S, facing: 1, pose: P, pal: PAL, alpha: 1 });
  if (laugh) {
    g.save(); g.translate(x + S * hd.x, y + S * hd.y); g.rotate(hd.rot); g.scale(S, S);
    g.strokeStyle = '#f6f7ff'; g.lineCap = 'round'; g.lineWidth = 3.6;
    g.beginPath(); g.arc(10.5, -1, 5.2, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.beginPath(); g.arc(24, -1.5, 4.2, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    const open = 0.8 + 0.2 * Math.sin(ph * 8);
    g.fillStyle = '#f6f7ff'; g.beginPath(); g.ellipse(17.5, 9, 11.5, 11 * open, 0, 0, Math.PI); g.closePath(); g.fill();
    g.fillStyle = '#ff7a8a'; g.beginPath(); g.ellipse(17.5, 9 + 11 * open, 7, 4.2 * open, 0, Math.PI, TAU); g.fill();
    g.restore();
  }
}
function qm(g, x, y, size, a, col, rot) {
  g.save(); g.translate(x, y); g.rotate(rot || 0); g.globalAlpha = a; g.font = `900 ${size}px "Segoe UI Black","Arial Black",Impact,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = col; g.shadowBlur = size * 0.35; g.lineJoin = 'round'; g.lineWidth = size * 0.1; g.strokeStyle = 'rgba(20,10,60,0.9)'; g.strokeText('?', 0, 0);
  g.shadowBlur = 0; g.fillStyle = col; g.fillText('?', 0, 0); g.restore();
}
function BANNER(g, t) {
  const ph = (t / LOOP) * TAU;
  space(g, t); forkTree(g, t);
  planet(g, 205, 525, 100, t); vortex(g, 190, 860, 120, t); bolt(g, 470, 135, 78, t); hourglass(g, 1440, 520, 66, t);
  atom(g, 1790, 520, 96, t); rocket(g, 1625, 575, 72, t); qmark(g, 1800, 850, 190, t, 'rgba(255,140,210,0.9)'); qmark(g, 330, 880, 110, t + 2, 'rgba(190,130,255,0.8)'); qmark(g, 1230, 130, 80, t + 1, 'rgba(120,230,255,0.8)');
  const sc = g.createRadialGradient(960, 540, 100, 960, 540, 600); sc.addColorStop(0, 'rgba(6,8,34,0.75)'); sc.addColorStop(0.65, 'rgba(6,8,34,0.4)'); sc.addColorStop(1, 'rgba(6,8,34,0)');
  g.fillStyle = sc; g.fillRect(0, 0, W, H);
  glow(g, 540, 520, 300, '255,90,170', 0.2); glow(g, 600, 470, 240, '127,233,255', 0.18);
  man(g, t);
  if (POSE === 'think') qm(g, 700, 440, 52, 0.9, '#ffe14a', Math.sin(ph) * 0.1);
  const cy = 540, X = 1075;
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
