// draw.js — small canvas helpers shared by the SCROLL engine. Plain globals; all pure functions of their inputs.
const rr = (g, x, y, w, h, r) => {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
};
const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
function glow(g, x, y, r, rgb, a, mode) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(rgb, a)); gr.addColorStop(0.45, rgba(rgb, a * 0.38)); gr.addColorStop(1, rgba(rgb, 0));
  g.save(); if (mode) g.globalCompositeOperation = mode; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
const mixc = (a, b, t) => [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
const css = (c, a) => a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
// two-bone IK. Returns the mid joint (elbow/knee) and the clamped end point.
function ik2(p0, p1, l1, l2, side) {
  let dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy), ux, uy;
  if (d < 1e-6) { ux = 0; uy = 1; d = 1e-6; } else { ux = dx / d; uy = dy / d; }
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { mid: { x: p0.x + ux * a + side * uy * h, y: p0.y + uy * a - side * ux * h }, end: { x: p0.x + ux * dd, y: p0.y + uy * dd } };
}
function capsule(g, p0, p1, r0, r1) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy) || 1e-6;
  const a = Math.atan2(dy, dx), b = Math.acos(clamp((r0 - r1) / d, -1, 1));
  g.beginPath(); g.arc(p0.x, p0.y, r0, a + b, a - b + TAU); g.arc(p1.x, p1.y, r1, a - b, a + b); g.closePath();
}
// deterministic film grain: one small noise tile, offset by frame so it shimmers but stays a pure function of t
let _grain = null;
function grainTile() {
  if (_grain) return _grain;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), im = x.createImageData(256, 256), r = rng(4242);
  for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0); return (_grain = c);
}
function drawGrain(g, W, H, t, alpha) {
  const tile = grainTile(), f = Math.floor(t * 24), ox = (f * 53) % 256, oy = (f * 97) % 256;
  g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = 'overlay';
  for (let y = -256 + oy; y < H; y += 256) for (let x = -256 + ox; x < W; x += 256) g.drawImage(tile, x, y);
  g.restore();
}
