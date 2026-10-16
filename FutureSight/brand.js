// thumbs.js — A/B/C YouTube thumbnails. drawFrame(g, T): variant = round(T) (0=A, 1=B, 2=C). Static.
(function () {
'use strict';
const W = 1920, H = 1080, GY = 834, CYc = '127,233,255';
function ik2(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux, uy;
  if (d < 1e-6) { ux = 0; uy = 1; d = 1e-6; } else { ux = dx / d; uy = dy / d; }
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function mkPose(o) {
  const lean = o.lean == null ? 0.03 : o.lean;
  const P = walkerPose({ phase: o.phase || 0, walk: o.walk || 0, headDown: o.headDown || 0, lean, bob: 0.6, eyeOpen: 1, eyeGlow: o.eyeGlow || 0, flutter: 0.1, step: 0, time: o.time || 0 });
  const J = P.J, rest = 0.07 + lean * 0.35;
  function arm(raise, cur) {
    if (raise < 0.003) return cur;
    const phi = lerp(rest, 2.45, raise), reach = 71 + 6.4 * raise;
    const r = ik2(J, { x: J.x + Math.sin(phi) * reach, y: J.y + Math.cos(phi) * reach }, 39, 39, -1);
    return { sh: J, elbow: r.mid, hand: r.end };
  }
  P.armF = arm(o.rF || 0, P.armF); P.armB = arm(o.rB || 0, P.armB);
  return P;
}
const hero = (g, cam, x, s, pose, facing) => withLayer(g, cam, 1, () => drawWalker(g, { x, y: GY, s, facing: facing || 1, pose, pal: PAL_REAL, alpha: 1 }));
const ghost = (g, cam, x, s, pose, al, facing) => withLayer(g, cam, 1, () => drawWalker(g, { x, y: GY, s, facing: facing || -1, pose, pal: palGhost(al), alpha: 1 }));
const glow = (g, x, y, r, c, a) => { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore(); };
function text(g, str, x, y, size, c1, c2, stroke, glowC, rot) {
  g.save(); g.translate(x, y); g.rotate(rot || 0);
  g.font = `900 ${size}px "Segoe UI Black", "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.shadowColor = glowC || 'rgba(0,0,0,0.7)'; g.shadowBlur = 22; g.shadowOffsetY = 0;
  g.lineWidth = size * 0.13; g.strokeStyle = stroke || '#000'; g.strokeText(str, 0, 0);
  g.shadowBlur = 0; g.shadowOffsetY = 6; g.shadowColor = 'rgba(0,0,0,0.55)';
  g.lineWidth = size * 0.13; g.strokeText(str, 0, 0);
  g.shadowColor = 'transparent';
  const gr = g.createLinearGradient(0, -size * 0.5, 0, size * 0.5); gr.addColorStop(0, c1); gr.addColorStop(1, c2 || c1);
  g.fillStyle = gr; g.fillText(str, 0, 0);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.15; g.fillStyle = '#fff'; g.fillText(str, 0, -size * 0.02); // sheen
  g.restore();
}
function bolt(g, x0, y0, x1, y1, seed, w) {
  const r = rng(seed); g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
  const pts = [[x0, y0]]; const n = 9;
  for (let i = 1; i < n; i++) { const u = i / n; pts.push([lerp(x0, x1, u) + (r() - 0.5) * 70, lerp(y0, y1, u) + (r() - 0.5) * 70]); }
  pts.push([x1, y1]);
  for (const [lw, col] of [[w * 4, 'rgba(60,170,255,0.25)'], [w * 2, 'rgba(120,220,255,0.6)'], [w * 0.7, 'rgba(255,255,255,0.95)']]) {
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
  }
  g.restore();
}
function finish(g, v) {
  // punchier colour: saturation + contrast, then vignette
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const t = tmp.getContext('2d'); t.drawImage(g.canvas, 0, 0);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.filter = 'saturate(1.3) contrast(1.1) brightness(1.04)'; g.drawImage(tmp, 0, 0); g.filter = 'none'; g.restore();
  postFX(g, 5.0, { vignette: 0.55, grain: 0.02 });
}

// ---------------- What If Labs brand: icon + banner ----------------
const LOOP = 4;                       // seconds per seamless loop
const TAU = Math.PI * 2;
const MODE = (new URLSearchParams(location.search)).get('mode') || 'icon';

function flaskPath(g, cx, cy, s) {
  g.beginPath();
  g.moveTo(cx - 0.17 * s, cy - 0.95 * s); g.lineTo(cx - 0.17 * s, cy - 0.4 * s); g.lineTo(cx - 0.62 * s, cy + 0.5 * s);
  g.quadraticCurveTo(cx - 0.74 * s, cy + 0.8 * s, cx - 0.48 * s, cy + 0.84 * s); g.lineTo(cx + 0.48 * s, cy + 0.84 * s);
  g.quadraticCurveTo(cx + 0.74 * s, cy + 0.8 * s, cx + 0.62 * s, cy + 0.5 * s); g.lineTo(cx + 0.17 * s, cy - 0.4 * s); g.lineTo(cx + 0.17 * s, cy - 0.95 * s);
  g.closePath();
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// the flask logo mark: glowing cyan liquid, bubbles, "?" inside. t = seconds (loops every LOOP)
function flask(g, cx, cy, s, t, o) {
  o = o || {};
  const ph = (t / LOOP) * TAU;
  glow(g, cx, cy + 0.1 * s, s * 1.5, CYc, 0.35);
  g.save();
  // liquid
  flaskPath(g, cx, cy, s); g.save(); g.clip();
  g.fillStyle = 'rgba(8,14,40,0.75)'; g.fillRect(cx - s, cy - s, 2 * s, 2 * s);
  const ly = cy + 0.05 * s;
  const lg = g.createLinearGradient(0, ly, 0, cy + 0.85 * s); lg.addColorStop(0, '#9ff4ff'); lg.addColorStop(0.5, '#27b6ff'); lg.addColorStop(1, '#2a5bff');
  g.fillStyle = lg; g.beginPath(); g.moveTo(cx - s, cy + s);
  for (let i = 0; i <= 40; i++) { const u = i / 40, x = cx - s + u * 2 * s; g.lineTo(x, ly + Math.sin(u * TAU * 2 + ph) * 0.028 * s + Math.sin(u * TAU * 3 - ph * 2) * 0.014 * s); }
  g.lineTo(cx + s, cy + s); g.closePath(); g.fill();
  // bubbles (seamless loop)
  g.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 9; i++) {
    const u = (((t / LOOP) * (1 + (i % 3)) + i * 0.173) % 1 + 1) % 1;
    const bx = cx + Math.sin(i * 2.4 + ph * (1 + (i % 2))) * 0.2 * s + (i - 4) * 0.045 * s, by = cy + 0.8 * s - u * 0.85 * s;
    g.globalAlpha = Math.sin(u * Math.PI) * 0.9; g.beginPath(); g.arc(bx, by, (0.025 + (i % 4) * 0.012) * s, 0, TAU); g.fill();
  }
  g.globalAlpha = 1; g.restore();
  // "?" inside
  g.font = `900 ${0.78 * s}px "Segoe UI Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = 0.12 * s; g.fillStyle = '#fff'; g.globalAlpha = 0.92 + 0.08 * Math.sin(ph * 2);
  g.save(); flaskPath(g, cx, cy, s); g.clip(); g.fillText('?', cx, cy + 0.4 * s); g.restore(); g.globalAlpha = 1; g.shadowBlur = 0;
  // glass outline + rim
  flaskPath(g, cx, cy, s); g.lineJoin = 'round'; g.lineWidth = 0.075 * s; g.strokeStyle = '#eaffff'; g.shadowColor = 'rgba(80,220,255,0.95)'; g.shadowBlur = 0.2 * s; g.stroke(); g.shadowBlur = 0;
  rr(g, cx - 0.27 * s, cy - 1.03 * s, 0.54 * s, 0.1 * s, 0.05 * s); g.fillStyle = '#eaffff'; g.fill();
  // glass highlight
  g.globalAlpha = 0.5; g.lineWidth = 0.04 * s; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(cx - 0.4 * s, cy + 0.4 * s); g.lineTo(cx - 0.12 * s, cy - 0.28 * s); g.stroke(); g.globalAlpha = 1;
  g.restore();
}
function ringTicks(g, cx, cy, r, t) {
  const ph = (t / LOOP) * TAU;
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - Math.PI / 2, major = i % 5 === 0, rr0 = r - (major ? 26 : 14);
    g.strokeStyle = major ? 'rgba(220,250,255,0.9)' : 'rgba(150,220,255,0.45)'; g.lineWidth = major ? 7 : 4;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * rr0, cy + Math.sin(a) * rr0); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
  }
  // sweeping arc (one turn per loop)
  const a0 = ph - Math.PI / 2; g.shadowColor = 'rgba(80,220,255,1)'; g.shadowBlur = 24; g.lineWidth = 12; g.strokeStyle = '#7fe9ff';
  g.beginPath(); g.arc(cx, cy, r - 40, a0 - 1.1, a0); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + Math.cos(a0) * (r - 40), cy + Math.sin(a0) * (r - 40), 12, 0, TAU); g.fill();
  g.restore();
}

function ICON(g, t) {
  const cx = 960, cy = 540;
  const bg = g.createRadialGradient(cx, cy - 120, 40, cx, cy, 760); bg.addColorStop(0, '#3a2a8a'); bg.addColorStop(0.55, '#14194f'); bg.addColorStop(1, '#070a22');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // soft drifting stars
  const r = rng(7); g.fillStyle = '#cfe9ff';
  for (let i = 0; i < 70; i++) { const x = 420 + r() * 1080, y = r() * H, tw = 0.5 + 0.5 * Math.sin((t / LOOP) * TAU * (1 + (i % 3)) + i); g.globalAlpha = 0.15 + 0.5 * tw * r(); g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  glow(g, cx, cy, 520, '255,140,60', 0.12);
  ringTicks(g, cx, cy, 395, t);
  flask(g, cx, cy + 10, 315, t);
}

function BANNER(g, t) {
  const cam = { x: 900, y: 600, z: 1.55, r: 0 };
  drawWorld(g, cam, 3 + (t / LOOP) * 0.0);
  visionGrade(g, 0.62);
  const ph = t / LOOP;
  // ghosts walking in from the right edge (2 stride cycles per loop)
  for (let i = 3; i >= 1; i--) ghost(g, cam, 1190 + i * 125, 0.95, mkPose({ time: 1 + i, phase: ph * 2 + i * 0.15, walk: 1, eyeGlow: 1, lean: 0.06 }), 0.95 - i * 0.2, -1);
  hero(g, cam, 470, 0.95, mkPose({ time: t, rF: 0.55 + 0.08 * Math.sin(ph * TAU), lean: -0.03, eyeGlow: 0 }), 1);
  // readability scrim behind the safe area
  const sc = g.createRadialGradient(960, 540, 120, 960, 540, 760); sc.addColorStop(0, 'rgba(6,10,36,0.86)'); sc.addColorStop(0.6, 'rgba(6,10,36,0.55)'); sc.addColorStop(1, 'rgba(6,10,36,0)');
  g.fillStyle = sc; g.fillRect(0, 0, W, H);
  // everything important stays inside the 2560x1440 banner safe area (1235x338 centred => 926x253 at this scale)
  const cy = 526;
  flask(g, 606, cy + 6, 118, t);
  text(g, 'WHAT IF', 1000, cy - 52, 104, '#fff27a', '#ff9a1f', '#0a0a1a', 'rgba(255,170,40,0.7)', 0);
  text(g, 'LABS', 1000, cy + 48, 104, '#ffffff', '#7fe9ff', '#0a0a1a', 'rgba(80,220,255,0.8)', 0);
  g.save(); g.font = '600 30px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(225,245,255,0.92)';
  g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 8; g.fillText('Wild questions. Animated answers.', 1010, cy + 118); g.restore();
}

window.drawFrame = function (g, T) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  (MODE === 'banner' ? BANNER : ICON)(g, ((T % LOOP) + LOOP) % LOOP);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (MODE === 'banner') finish(g, 0);
};
})();
