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
function text(g, str, x, y, size, c1, c2, stroke, glowC, rot, sw) {
  g.save(); g.translate(x, y); g.rotate(rot || 0);
  g.font = `900 ${size}px "Segoe UI Black", "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.shadowColor = glowC || 'rgba(0,0,0,0.7)'; g.shadowBlur = 22; g.shadowOffsetY = 0;
  g.lineWidth = size * (sw || 0.13); g.strokeStyle = stroke || '#000'; g.strokeText(str, 0, 0);
  g.shadowBlur = 0; g.shadowOffsetY = 6; g.shadowColor = 'rgba(0,0,0,0.55)';
  g.lineWidth = size * (sw || 0.13); g.strokeText(str, 0, 0);
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

// A — big ring "10" + hero shocked + ghost fan ahead
function A(g) {
  const cam = { x: 900, y: 600, z: 1.55, r: 0 };
  drawWorld(g, cam, 3);
  visionGrade(g, 0.55);
  for (let i = 4; i >= 1; i--) ghost(g, cam, 900 + i * 170, 1.0, mkPose({ time: 1 + i, phase: 0.2 + i * 0.12, walk: 1, eyeGlow: 1, lean: 0.06 }), 0.9 - i * 0.16, -1);
  hero(g, cam, 900, 1.0, mkPose({ time: 2, rF: 0.9, rB: 0.8, lean: -0.05, eyeGlow: 0 }), 1);
  glow(g, 1480, 350, 720, CYc, 0.28);
  drawTimerRing(g, 1480, 350, 640, { value: 10, progress: 0, appear: 1, time: 3.3 });
  text(g, 'SEE THE', 440, 120, 100, '#ffffff', '#cfe6ff', '#0a0a1a', 'rgba(80,160,255,0.9)', -0.03);
  text(g, 'FUTURE', 440, 235, 135, '#fff27a', '#ff9a1f', '#0a0a1a', 'rgba(255,170,40,0.9)', -0.03);
}
// B — split world: real (dusk) | ghost-vision, hero meets his ghost face-to-face (close up)
function B(g) {
  const cam = { x: 910, y: 640, z: 2.05, r: 0 };
  drawWorld(g, cam, 3);
  g.save(); g.beginPath(); g.rect(W / 2, 0, W / 2, H); g.clip();
  visionGrade(g, 0.95);
  g.restore();
  glow(g, 1190, 600, 650, CYc, 0.34);
  glow(g, 700, 600, 600, '255,150,70', 0.22);
  hero(g, cam, 800, 1.1, mkPose({ time: 2, rF: 0.6, lean: 0.04 }), 1);
  ghost(g, cam, 1010, 1.1, mkPose({ time: 4, rF: 0.6, eyeGlow: 1, lean: 0.04 }), 0.98, -1);
  // energy crackle where the hands almost touch
  bolt(g, 905, 610, 960, 600, 11, 5); bolt(g, 960, 600, 1010, 612, 29, 4);
  glow(g, 960, 604, 220, '255,255,255', 0.55);
  // glowing seam
  g.save(); g.globalCompositeOperation = 'lighter'; const sg = g.createLinearGradient(W / 2 - 40, 0, W / 2 + 40, 0);
  sg.addColorStop(0, 'rgba(120,220,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.95)'); sg.addColorStop(1, 'rgba(120,220,255,0)'); g.fillStyle = sg; g.fillRect(W / 2 - 40, 0, 80, H); g.restore();
  text(g, 'WHAT IF?', 960, 120, 125, '#fff27a', '#ff9a1f', '#0a0a1a', 'rgba(255,170,40,0.55)', 0, 0.07);
  drawTimerRing(g, 960, 905, 300, { value: 10, progress: 0, appear: 1, time: 3.3 });
}
// C — danger: ghost car about to hit, hero hasn't seen it yet
function C(g) {
  const cam = { x: 900, y: 560, z: 1.3, r: 0 };
  drawWorld(g, cam, 3);
  visionGrade(g, 0.7);
  g.save(); g.globalCompositeOperation = 'screen'; const gr = g.createRadialGradient(W, 600, 0, W, 600, 1400); gr.addColorStop(0, 'rgba(255,40,50,0.6)'); gr.addColorStop(1, 'rgba(255,40,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
  hero(g, cam, 700, 1.05, mkPose({ time: 2, lean: 0.12, walk: 0.7, phase: 0.3 }), 1);
  // ghost car racing in from the right with headlights
  withLayer(g, cam, 1, () => drawCar(g, { x: 1380, y: GROUND.roadNear, s: 1.25, facing: -1, pal: palGhost(0.85), alpha: 1, wheel: 2.2 }));
  glow(g, 1090, 905, 260, '255,240,200', 0.22);
  // ghost hero reaching back to warn
  ghost(g, cam, 960, 1.0, mkPose({ time: 4, rF: 1.0, eyeGlow: 1, lean: -0.05 }), 0.95, -1);
  glow(g, 960, 560, 330, CYc, 0.2);
  drawTimerRing(g, 1560, 250, 440, { value: 3.2, progress: 0.68, appear: 1, time: 3.3 });
  g.save(); g.translate(150, 170); g.scale(0.62, 0.62); g.fillStyle = '#ff2d3a'; g.strokeStyle = '#fff'; g.lineWidth = 16; g.shadowColor = 'rgba(255,40,50,0.9)'; g.shadowBlur = 50;
  g.beginPath(); g.moveTo(0, -150); g.lineTo(150, 110); g.lineTo(-150, 110); g.closePath(); g.lineJoin = 'round'; g.fill(); g.stroke(); g.restore();
  text(g, '!', 150, 165, 120, '#ffffff', '#ffe0e0', '#7a0010', 'rgba(255,40,50,0.8)', 0);
  text(g, 'WAIT!', 560, 130, 120, '#ff5a5f', '#ffd23f', '#14000a', 'rgba(255,60,60,0.9)', -0.04);
}
const VARS = [A, B, C];
window.drawFrame = function (g, T) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  const i = clamp(Math.round(T), 0, VARS.length - 1);
  VARS[i](g); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  finish(g, i);
};
})();
