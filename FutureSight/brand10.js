// brand10.js — "cine" host variants: zoom, laugh, dress colours. mode=<pose>_<colour>[_zoom]  e.g. think_red, laugh_red, think_red_zoom, laugh_red_zoom, think_blue ...
(function () {
'use strict';
const W = 1920, H = 1080, B = window.__B, { glow, LOOP, TAU } = B;
const MODE = (new URLSearchParams(location.search)).get('mode') || 'think_red';
const [POSE, COL, ZOOM] = MODE.split('_');
// dress colours: [hood, hoodBack, hoodDark, hoodLight] + scene theme [bg0,bg1,bg2, cone rgb]
const COLS = {
  red:    { h: ['#d63a3a', '#a82d2d', '#8a2226', '#ec5a50'], bg: ['#16183a', '#0a0b1e', '#020208'], cone: '160,210,255' },
  blue:   { h: ['#2f7be0', '#2358ad', '#1a3f82', '#5aa2ff'], bg: ['#3a1c22', '#1e0d14', '#080307'], cone: '255,200,150' },
  green:  { h: ['#2fb36a', '#228a50', '#176238', '#5fdc95'], bg: ['#2e1840', '#170b24', '#06020c'], cone: '255,170,215' },
  yellow: { h: ['#f2c230', '#c99a14', '#9a720a', '#ffe070'], bg: ['#142a52', '#0a1530', '#020610'], cone: '150,210,255' },
  purple: { h: ['#8a4fe0', '#6a37b3', '#4c2585', '#b084ff'], bg: ['#0f3a40', '#071e22', '#020a0c'], cone: '255,215,150' },
  white:  { h: ['#eef2fb', '#c3cbe0', '#9aa3bf', '#ffffff'], bg: ['#3a1a52', '#1c0c2c', '#07030c'], cone: '255,170,230' },
};
const C = COLS[COL] || COLS.red;
const PAL = Object.assign({}, PAL_REAL, { hood: C.h[0], hoodBack: C.h[1], hoodDark: C.h[2], hoodLight: C.h[3] });
function ik2b(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function man(g, t) {
  const ph = (t / LOOP) * TAU, laugh = POSE === 'laugh', zoom = !!ZOOM;
  const S = zoom ? (laugh ? 9.2 : 9.6) : 5.7;
  const sh = laugh ? Math.sin(ph * 8) : 0;
  const P = walkerPose({ phase: 0, walk: 0, headDown: laugh ? -0.12 + 0.025 * sh : 0.16 + 0.03 * Math.sin(ph), lean: laugh ? -0.04 + 0.01 * sh : 0.03, bob: 0.6, eyeOpen: laugh ? 0 : ((t > 2.9 && t < 3.1) ? 0.12 : 1), eyeGlow: 0, flutter: 0.1, step: 0, time: t });
  const J = P.J, hd = P.head;
  const tgt = laugh ? { x: J.x + 30, y: J.y + 72 + 3 * sh } : { x: hd.x + 26, y: hd.y + 32 + Math.sin(ph) * 2 };
  const r = ik2b(J, tgt, 39, 39, -1); P.armF = { sh: J, elbow: r.mid, hand: r.end };
  if (laugh) { const rb = ik2b(J, { x: J.x + 14, y: J.y + 80 - 2 * sh }, 39, 39, -1); P.armB = { sh: J, elbow: rb.mid, hand: rb.end }; }
  // placement: normal = feet on a fixed spot; zoom = put the head at a fixed spot
  let x, y;
  if (zoom) { x = (laugh ? 930 : 900) - S * hd.x; y = (laugh ? 470 : 450) - S * hd.y + (laugh ? 7 * sh : Math.sin(ph) * 5); }
  else { x = 800; y = 1660 + (laugh ? 9 * Math.abs(sh) : Math.sin(ph) * 5); }
  const st = { x, y, s: S, facing: 1, pose: P, pal: PAL, alpha: 1 };
  drawWalker(g, st);
  if (laugh) {  // happy ^ ^ eyes + open mouth, drawn in head space
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
function scene(g, t) {
  const b = g.createRadialGradient(960, 380, 60, 960, 540, 820); b.addColorStop(0, C.bg[0]); b.addColorStop(0.55, C.bg[1]); b.addColorStop(1, C.bg[2]); g.fillStyle = b; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'lighter'; const cone = g.createLinearGradient(900, 0, 900, 1000); cone.addColorStop(0, `rgba(${C.cone},0.34)`); cone.addColorStop(1, `rgba(${C.cone},0)`);
  g.fillStyle = cone; g.beginPath(); g.moveTo(780, 0); g.lineTo(1080, 0); g.lineTo(1400, 1000); g.lineTo(380, 1000); g.closePath(); g.fill(); g.restore();
  const r = rng(41); g.fillStyle = '#cfefff';
  for (let i = 0; i < 46; i++) { const x = 500 + r() * 760, y0 = r() * H, sp = 1 + (i % 3), y = (y0 - (t / LOOP) * sp * H + H * 4) % H; g.globalAlpha = 0.1 + 0.3 * r(); g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  glow(g, 880, 360, 520, C.cone, 0.16);
}
window.drawFrame = function (g, T) {
  const t = ((T % LOOP) + LOOP) % LOOP;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  scene(g, t); man(g, t);
  const v = g.createRadialGradient(960, 540, 300, 960, 540, 800); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
};
})();
