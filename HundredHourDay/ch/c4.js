// ch/c4.js - Chapter 4 "Long Day" (H 38 -> 50). Frame = pure function of local time lt. Hard cuts between shots (no fades of its own).
// Shots: A city (d1) | B desert thermometer (d2 s1+s2) | C barefoot hop (d2 s3) | D farm (d3) | E coast (d4) | F1 shade walk, F2 shade compare, F3 beach (d5)
// Every time is derived from LAYOUT.c4.vo[i].start/dur. Sentence boundaries inside a line are FRACTIONS of the line (measured once with
// ffmpeg silencedetect on out/vo/dN.wav) so they follow the line if the VO is regenerated.
(function () {
'use strict';
window.CH = window.CH || {};
const LAY = LAYOUT.c4, VO = {};
LAY.vo.forEach((v) => { VO[v.id] = v; });
const d1 = VO.d1, d2 = VO.d2, d3 = VO.d3, d4 = VO.d4, d5 = VO.d5;
const at = (d, f) => d.start + d.dur * f;
const TT = {
  d1s2: at(d1, 0.694),                       // "Normally, it gets a night to cool off."
  d2s2: at(d2, 0.549), d2s3: at(d2, 0.873),  // "With fifty hours ..." / "Hot enough to burn bare feet."
  d3rise: at(d3, 0.30), d3storm: at(d3, 0.708),
  d4water: at(d4, 0.241), d4sea: at(d4, 0.513), d4breeze: at(d4, 0.746),
  d5s2: at(d5, 0.2785), d5sun: at(d5, 0.477), d5shade: at(d5, 0.751)
};
TT.tc = TT.d2s2 - 0.55;   // mercury reaches the 70 notch (end of the first rise in mercuryLv)
TT.touch = TT.d2s3 + 0.62;                                              // bare foot meets the sand
TT.satA = d2.start + 0.2; TT.satB = d2.start + 5.6;                    // satellite pass
const CUT = {
  B: d2.start - 0.22, C: TT.d2s3 - 0.45, D: d3.start - 0.12, E: d4.start - 0.12,
  F1: d5.start - 0.12, F2: TT.d5sun - 0.12, F3: LAY.dur - 1.65
};
const END = LAY.dur;
const H0 = 38, H1 = 49.9;
const hOf = (lt) => H0 + (H1 - H0) * clamp(lt / END);
const E = (t, a, b) => clamp((t - a) / (b - a));
const S = (t, a, b) => smooth(E(t, a, b));
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const mod = (a, n) => ((a % n) + n) % n;
const GY = 820;                                // ground line the host stands on

// ------------------------------------------------------------------ host
function castFn(st) {
  return (c) => { MASCOT.draw(c, { x: 0, y: 0, s: 1, facing: st.facing, pose: st.pose, t: st.t, expr: 'neutral', pal: TOD.PAL_SHADOW, shadow: false }); };
}
// draws the host (+ cast shadow) in world coords; st.y is the body y (may be lifted for hops), gy = ground y for the shadow
function hero(g, cam, H, o, st, opt) {
  opt = opt || {};
  withLayer(g, cam, 1, () => {
    if (!opt.noShadow) {
      g.save();
      if (opt.shadowClip) { g.beginPath(); g.rect(opt.shadowClip[0], -2000, opt.shadowClip[1] - opt.shadowClip[0], 6000); g.clip(); }
      TOD.drawCastShadow(g, H, st.x, opt.gy == null ? st.y : opt.gy, st.s, castFn(st), o);
      g.restore();
    }
    MASCOT.draw(g, Object.assign({ shadow: false, pal: TOD.heroPal(H, o) }, st));
    if (opt.after) opt.after(g);
  });
}
function layer(g, cam, fn) { withLayer(g, cam, 1, fn); }
function scr(cam, wx, wy) { return project(cam, wx, wy, 1); }

// ------------------------------------------------------------------ props / in-world art
function thermo(g, x, y, h, lv, o) {
  o = o || {};
  const col = o.col || '#ff3b2a', bulb = o.bulb == null ? 17 : o.bulb;
  const yb = -bulb - 8, ytop = -h + 18, span = yb - ytop;
  const lvY = yb - lv * span * 0.92;
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(70,40,15,0.28)'; g.beginPath(); g.ellipse(6, 6, 46, 10, 0, 0, TAU); g.fill();
  rr(g, -26, -h - 6, 52, h + 10, 12); g.fillStyle = '#f8f3e6'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#4a3b30'; g.stroke();
  // scale ticks (left of the tube)
  g.strokeStyle = '#4a3b30'; g.lineWidth = 2;
  for (let i = 0; i <= 10; i++) { const ty = yb - (i / 10) * span * 0.92; g.beginPath(); g.moveTo(-22, ty); g.lineTo(i % 5 === 0 ? -8 : -13, ty); g.stroke(); }
  // glass tube + bulb
  rr(g, -5.5, ytop, 11, yb - ytop + 4, 5.5); g.fillStyle = '#dcebf1'; g.fill(); g.lineWidth = 2; g.stroke();
  g.fillStyle = col; g.beginPath(); g.arc(0, -bulb - 3, bulb, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = '#4a3b30'; g.stroke();
  g.fillStyle = col; rr(g, -3.4, lvY, 6.8, yb - lvY + 6, 3); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(-5, -bulb - 8, 4.5, 0, TAU); g.fill();
  if (o.mark != null) {                       // notch with a digit (in-world scale label)
    const my = yb - o.mark * span * 0.92, fl = o.flash || 0;
    g.strokeStyle = '#c4281c'; g.lineWidth = 4 + 3 * fl; g.beginPath(); g.moveTo(-24, my); g.lineTo(26, my); g.stroke();
    g.font = 'bold ' + Math.round(26 + 8 * fl) + 'px "Bahnschrift SemiBold","Segoe UI Black",sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.lineWidth = 5; g.strokeStyle = '#fff'; g.strokeText('70', 31, my); g.fillStyle = '#c4281c'; g.fillText('70', 31, my);
  }
  g.restore();
  return lvY;
}
function sandGlow(g, x, y, rx, a, t) {
  if (a < 0.01) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  const p = 0.9 + 0.1 * Math.sin(t * 3.1);
  g.translate(x, y); g.scale(1, 0.22);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, 'rgba(255,150,40,' + (0.6 * a * p) + ')'); gr.addColorStop(0.55, 'rgba(255,90,20,' + (0.25 * a) + ')'); gr.addColorStop(1, 'rgba(255,60,10,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
  g.restore();
}
function heatLines(g, x, y, n, t, a, spread, hgt) {   // wavy rising squiggles
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ph = mod(t * 0.9 + hash1(i * 7 + 3), 1), px = x + (i / Math.max(1, n - 1) - 0.5) * spread, h = hgt * ph;
    g.strokeStyle = 'rgba(255,120,40,' + (a * Math.sin(Math.PI * ph) * 0.8) + ')'; g.lineWidth = 5;
    g.beginPath();
    for (let k = 0; k <= 12; k++) { const u = k / 12, yy = y - h * u, xx = px + 7 * Math.sin(u * 9 + t * 5 + i * 2); if (k === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy); }
    g.stroke();
  }
  g.restore();
}
function puffs(g, x, y, t, t0, n, rise, r0, col) {   // soft smoke / steam puffs
  const u = t - t0; if (u < 0) return;
  for (let i = 0; i < n; i++) {
    const ph = mod(u * 0.9 + i / n, 1), a = Math.sin(Math.PI * ph) * 0.55;
    const px = x + (hash1(i * 5 + 1) - 0.5) * 50 + 10 * Math.sin(ph * 6 + i), py = y - ph * rise;
    g.fillStyle = col.replace('A', a.toFixed(3)); g.beginPath(); g.arc(px, py, r0 * (0.6 + ph * 1.2), 0, TAU); g.fill();
  }
}
function sneakers(g, x, y) {
  g.save(); g.translate(x, y);
  const one = (dx, rot) => {
    g.save(); g.translate(dx, 0); g.rotate(rot);
    g.fillStyle = 'rgba(70,40,15,0.25)'; g.beginPath(); g.ellipse(4, 3, 44, 6, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-36, 0); g.lineTo(-36, -30); g.quadraticCurveTo(-26, -34, -14, -28); g.quadraticCurveTo(0, -16, 18, -14); g.quadraticCurveTo(40, -12, 44, 0); g.closePath();
    g.fillStyle = '#f4f4f8'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#3a3552'; g.stroke();
    g.fillStyle = '#e8503c'; g.fillRect(-35, -22, 12, 12);
    g.fillStyle = '#c9c9d6'; rr(g, -38, -3, 84, 9, 4); g.fill(); g.stroke();
    g.strokeStyle = '#3a3552'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-8 + i * 9, -22 + i * 3); g.lineTo(-2 + i * 9, -17 + i * 3); g.stroke(); }
    g.restore();
  };
  one(0, 0); one(92, -0.05);
  g.restore();
}
function satellite(g, x, y, ang, t) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = '#2a63c9'; g.strokeStyle = '#1b2f66'; g.lineWidth = 3;
  rr(g, -88, -14, 62, 28, 3); g.fill(); g.stroke(); rr(g, 26, -14, 62, 28, 3); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.5; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-88 + i * 15.5, -14); g.lineTo(-88 + i * 15.5, 14); g.moveTo(26 + i * 15.5, -14); g.lineTo(26 + i * 15.5, 14); g.stroke(); }
  g.fillStyle = '#e9c24a'; g.strokeStyle = '#6a5316'; g.lineWidth = 3; rr(g, -26, -20, 52, 40, 6); g.fill(); g.stroke();
  g.fillStyle = '#3b3f58'; g.beginPath(); g.arc(0, 4, 10, 0, TAU); g.fill();
  g.strokeStyle = '#d8d8e8'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -20); g.lineTo(0, -38); g.stroke();
  g.fillStyle = Math.sin(t * 6) > 0 ? '#ff4a3a' : '#7a1a14'; g.beginPath(); g.arc(0, -40, 4, 0, TAU); g.fill();
  g.restore();
}
function signBoard(g, x, y, t) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(70,40,15,0.25)'; g.beginPath(); g.ellipse(10, 6, 80, 10, 0, 0, TAU); g.fill();
  g.fillStyle = '#7a5434'; g.fillRect(-9, -230, 18, 232); g.strokeStyle = '#3a2614'; g.lineWidth = 3; g.strokeRect(-9, -230, 18, 232);
  rr(g, -118, -290, 236, 92, 12); g.fillStyle = '#b98a54'; g.fill(); g.lineWidth = 5; g.stroke();
  g.fillStyle = '#f5e3b8'; rr(g, -108, -280, 216, 72, 8); g.fill();
  g.fillStyle = '#4a2f18'; g.font = 'bold 33px "Bahnschrift SemiBold","Segoe UI Black",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('LUT DESERT', 0, -244);
  g.restore();
}
function thoughtBubble(g, bx, by, k, t, popK) {
  if (k <= 0.001) return;
  g.save(); g.translate(bx, by);
  const sc = k * (1 + (popK > 0 ? 0.35 * popK : 0)), al = popK > 0 ? 1 - popK : 1;
  g.globalAlpha = al; g.scale(sc, sc);
  g.fillStyle = '#eef6ff'; g.strokeStyle = '#2a3a6a'; g.lineWidth = 4;
  g.beginPath(); g.arc(-70, 70, 9, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(-52, 44, 14, 0, TAU); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(0, -20, 96, 70, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#26356e'; g.beginPath(); g.ellipse(0, -20, 88, 62, 0, 0, TAU); g.fill();
  g.fillStyle = '#fff4b8'; g.beginPath(); g.arc(-14, -22, 30, 0, TAU); g.fill();
  g.fillStyle = '#26356e'; g.beginPath(); g.arc(-2, -30, 26, 0, TAU); g.fill();
  for (let i = 0; i < 3; i++) {
    const sx = [40, 62, 30][i], sy = [-48, -14, 4][i], tw = 0.7 + 0.3 * Math.sin(t * 4 + i * 2);
    g.fillStyle = '#ffffff'; g.save(); g.translate(sx, sy); g.scale(tw, tw); g.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? 4 : 11; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.restore();
  }
  g.restore();
}

// rising warm-air columns (screen space)
function thermals(g, k, t, ytop, ybot) {
  if (k < 0.01) return;
  const hgt = (ybot - ytop) * k, y0 = ybot - hgt;
  g.save();
  for (let i = 0; i < 6; i++) {
    const cx = 150 + i * 330 + (hash1(i + 40) - 0.5) * 90, w = 150 + 40 * hash1(i + 11), grow = clamp(k * 1.4 - hash1(i + 3) * 0.4);
    const top = ybot - (ybot - y0) * grow; if (grow < 0.02) continue;
    const gr = g.createLinearGradient(0, ybot, 0, top); gr.addColorStop(0, 'rgba(255,248,224,0)'); gr.addColorStop(0.25, 'rgba(255,246,214,0.28)'); gr.addColorStop(0.7, 'rgba(255,246,214,0.2)'); gr.addColorStop(1, 'rgba(255,246,214,0)');
    g.fillStyle = gr; g.beginPath();
    for (let y = ybot; y >= top; y -= 24) { const x = cx - w / 2 + 16 * Math.sin(y * 0.011 + t * 1.6 + i); if (y === ybot) g.moveTo(x, y); else g.lineTo(x, y); }
    for (let y = top; y <= ybot; y += 24) { const x = cx + w / 2 + 16 * Math.sin(y * 0.011 + t * 1.6 + i + 1.3); g.lineTo(x, y); }
    g.closePath(); g.fill();
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let m = 0; m < 6; m++) {                 // chevrons riding up
      const ph = mod(t * 0.34 + m / 6 + hash1(i * 9 + 2), 1), yy = ybot - ph * (ybot - top), a = Math.sin(Math.PI * ph) * 0.7 * grow;
      const cxx = cx + 14 * Math.sin(yy * 0.011 + t * 1.6 + i + 0.6);
      g.strokeStyle = 'rgba(255,255,255,' + a + ')'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(cxx - 34, yy + 16); g.lineTo(cxx, yy - 8); g.lineTo(cxx + 34, yy + 16); g.stroke();
    }
  }
  g.restore();
}
// cumulonimbus tower, screen space. grow 0..1. Opaque puffs only (no overlap seams), painted bottom -> top, then lit caps.
function storm(g, cx, baseY, grow, t) {
  if (grow < 0.01) return;
  // The whole tower scales as one connected body (layers of overlapping puffs), so it can never split into blobs.
  const gs = S(grow, 0, 1), HT = 560 * gs, M = 15, K = 0.4 + 0.6 * gs;
  const layers = [];
  for (let l = 0; l < M; l++) {
    const f = l / (M - 1);
    const anv = f > 0.74 ? (f - 0.74) / 0.26 : 0;
    const w = (170 - 60 * Math.sin(Math.min(1, f / 0.74) * Math.PI * 0.9) + 220 * anv) * K;      // base wide, narrower stem, wide anvil
    const n = Math.max(2, Math.round(w / 55) + 1);
    layers.push({ f, w, n });
  }
  g.save();
  const cols = (f, lit) => { const k = clamp(f * 1.2), m = lit ? 0.5 : 0; return 'rgb(' + Math.round(70 + (150 + 40 * m) * k) + ',' + Math.round(76 + (146 + 40 * m) * k) + ',' + Math.round(104 + (124 + 30 * m) * k) + ')'; };
  for (let pass = 0; pass < 2; pass++) {
    for (const L of layers) {
      for (let j = 0; j < L.n; j++) {
        const u = L.n === 1 ? 0 : (j / (L.n - 1)) * 2 - 1, hs = hash1(L.f * 97 + j * 13 + 5);
        const x = cx + u * L.w, y = baseY - L.f * HT + Math.sin(t * 0.7 + L.f * 9 + j * 1.3) * 4 + (Math.abs(u) > 0.7 ? 18 * K : 0);
        const r = (58 + 22 * hs) * K * (L.f > 0.74 ? 0.92 : 1.1 - 0.25 * L.f);
        if (pass === 0) { g.fillStyle = cols(L.f, false); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
        else { g.fillStyle = cols(Math.min(1, L.f + 0.2), true); g.beginPath(); g.arc(x + r * 0.16, y - r * 0.22, r * 0.68, 0, TAU); g.fill(); }
      }
    }
  }
  // flat dark base slab
  const bw = 300 * K;
  g.fillStyle = 'rgb(58,62,90)'; g.beginPath(); g.ellipse(cx, baseY + 12, bw, 30 * K, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgb(48,52,78)'; g.beginPath(); g.ellipse(cx, baseY + 26, bw * 0.78, 18 * K, 0, 0, TAU); g.fill();
  g.restore();
}
function windStreaks(g, t, a, y0, y1) {
  if (a < 0.01) return;
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const sp = 520 + 300 * hash1(i + 70), len = 160 + 160 * hash1(i + 80), y = y0 + (y1 - y0) * hash1(i + 90);
    const x = 1920 + 200 - mod(t * sp + hash1(i + 60) * 2400, 2400 + 400);
    const al = a * (0.35 + 0.4 * hash1(i + 50));
    g.strokeStyle = 'rgba(255,255,255,' + al + ')'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + len * 0.3, y - 12, x + len * 0.65, y + 14, x + len, y - 4); g.stroke();
    g.beginPath(); g.arc(x - 12, y - 4, 10, Math.PI * 0.2, Math.PI * 1.45); g.stroke();
  }
  g.restore();
}
function palmFront(g, x, y, t, gust) {
  g.save(); g.translate(x, y);
  const sw = (Math.sin(t * 1.7) * 0.4 + 0.6) * gust;
  g.strokeStyle = '#7b5632'; g.lineCap = 'round'; g.lineWidth = 30;
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-30 - 22 * sw, -230, -20 - 40 * sw, -430); g.stroke();
  g.strokeStyle = '#5c3f22'; g.lineWidth = 6; for (let i = 1; i < 9; i++) { const yy = -i * 46; g.beginPath(); g.moveTo(-18 - (i * 3), yy); g.lineTo(2 - (i * 3), yy + 6); g.stroke(); }
  g.translate(-20 - 40 * sw, -430);
  for (let i = 0; i < 9; i++) {
    const base = -2.6 + i * 0.52, flap = Math.sin(t * 3.2 + i * 1.3) * 0.12 * (0.4 + gust) + sw * 0.35;
    const a = base + flap, L = 210;
    const ex = Math.cos(a) * L, ey = Math.sin(a) * L * 0.8 + 60;
    g.fillStyle = i % 2 ? '#2f8a4a' : '#3da35a'; g.strokeStyle = '#1d5a30'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ex * 0.5, ey * 0.5 - 70, ex, ey); g.quadraticCurveTo(ex * 0.5 + 14, ey * 0.5 - 40, 0, 12); g.closePath(); g.fill(); g.stroke();
  }
  g.fillStyle = '#6a4424'; g.beginPath(); g.arc(-6, 14, 12, 0, TAU); g.arc(14, 10, 11, 0, TAU); g.fill();
  g.restore();
}
function flag(g, x, y, t, gust) {
  g.save(); g.translate(x, y);
  g.fillStyle = '#d8d4e4'; g.fillRect(-4, -230, 8, 232);
  g.fillStyle = '#e8503c'; g.strokeStyle = '#7a1e12'; g.lineWidth = 3; g.beginPath(); g.moveTo(-4, -226);
  for (let i = 0; i <= 10; i++) { const u = i / 10; g.lineTo(-4 - 112 * u * (0.6 + 0.4 * gust), -226 + 24 * u + Math.sin(t * 9 - u * 6) * 8 * u * gust); }
  for (let i = 10; i >= 0; i--) { const u = i / 10; g.lineTo(-4 - 112 * u * (0.6 + 0.4 * gust), -226 + 74 - 20 * u + Math.sin(t * 9 - u * 6) * 8 * u * gust); }
  g.closePath(); g.fill(); g.stroke();
  g.restore();
}
function bucket(g, x, y, t, wob) {   // seawater bucket
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(70,40,15,0.25)'; g.beginPath(); g.ellipse(6, 6, 80, 11, 0, 0, TAU); g.fill();
  g.fillStyle = '#e8b84a'; g.strokeStyle = '#7a5416'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(-62, -96); g.lineTo(-48, 0); g.lineTo(48, 0); g.lineTo(62, -96); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#3aa0e4'; g.beginPath(); g.moveTo(-60, -80); for (let i = 0; i <= 12; i++) { const u = i / 12; g.lineTo(-60 + 120 * u, -80 + Math.sin(t * 3 + u * 9) * 2.5 * wob); } g.lineTo(58, -92); g.lineTo(-58, -92); g.closePath();
  g.fillStyle = '#4db6f0'; g.beginPath(); g.ellipse(0, -88, 62, 10, 0, 0, TAU); g.fill(); g.stroke();
  g.restore();
}
function clockIcon(g, x, y, r, hand, col) {
  g.save(); g.translate(x, y);
  g.fillStyle = '#fff'; g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.stroke();
  g.strokeStyle = '#1c2038'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(hand) * r * 0.75, -Math.cos(hand) * r * 0.75); g.stroke();
  g.fillStyle = '#1c2038'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
  g.restore();
}

// ------------------------------------------------------------------ common frame pieces
function finish(g, H, o, lt, fx) {
  fx = fx || {};
  if (fx.warp) TOD.heatWarp(g, fx.warp[0], fx.warp[1], fx.warp[2], lt);
  if (fx.glare) TOD.heatGlare(g, fx.glare, lt);
  TOD.grade(g, H, o);
}
function hudDraw(g, lt, H) {
  const pop = E(lt, 0.4, 0.95), fr = H - Math.floor(H), u = fr / ((H1 - H0) / END);
  const pulse = u < 0.5 && lt > 1.2 ? Math.sin(Math.PI * u / 0.5) : 0;
  TOD.hud(g, H, { alpha: 1, pop: pop, pulse: pulse });
}
const camPush = (lt, a, b, z0, z1) => z0 + (z1 - z0) * easeInOut(E(lt, a, b));

// ------------------------------------------------------------------ SHOT A  (d1)  city, white-hot, sunglasses + towel
function shotA(g, lt, H) {
  const o = { scene: 'city', heat: 0.85, cloud: 0.2, t: lt };
  const cam = { x: 1010 + 24 * easeInOut(E(lt, 0, CUT.B)), y: 573, z: camPush(lt, 0, CUT.B, 1.55, 1.78), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const sg = S(lt, 1.55, 1.95);
  const shieldK = 1 - S(lt, 1.35, 2.0);
  const wipe = S(lt, d1.start + d1.dur * 0.613 - 0.4, d1.start + d1.dur * 0.613 + 0.1) * (1 - S(lt, TT.d1s2 + 0.6, TT.d1s2 + 1.0));
  const dream = S(lt, TT.d1s2 + 0.25, TT.d1s2 + 0.8), burst = E(lt, d1.end - 0.55, d1.end - 0.2);
  let pose;
  if (lt < 2.1) pose = { a: 'stand', b: 'shield', k: shieldK };
  else pose = { a: 'stand', b: 'wipeBrow', k: wipe };
  let expr = lt < 2.0 ? { eyes: 'squint', sweat: 0.5 } : { eyes: 'droop', sweat: 1, look: lt > 3 && lt < 5 ? 'down' : 'fwd' };
  if (dream > 0.5 && burst < 0.2) expr = { eyes: 'closed', sweat: 0.2 };
  const st = { x: 900, y: GY, s: 1.3, facing: 1, pose: pose, t: lt, expr: expr, props: { towel: true, sunglasses: sg } };
  hero(g, cam, H, o, st, {
    shadowClip: null,
    after: (c) => {
      const J = MASCOT.joints(st);
      const k = spring(lt - (TT.d1s2 + 0.25), 150, 14), pk = burst;
      if (k > 0.001 && pk < 1) thoughtBubble(c, J.bubble.x + 78, J.bubble.y - 18, Math.min(1.12, k), lt, pk);
    }
  });
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, { warp: [560, 900, 0.55], glare: 0.7 });
}

// ------------------------------------------------------------------ SHOT B  (d2 s1+s2)  Lut desert: ground thermometer
function mercuryLv(lt) {
  const a = S(lt, d2.start + 0.15, TT.d2s2 - 0.55);
  return 0.06 + a * (0.625 - 0.06) + 0.25 * easeInOut(E(lt, TT.d2s2, TT.d2s3 - 0.4));
}
function shotB(g, lt, H) {
  const o = { scene: 'desert', heat: 0.9, cloud: 0.1, t: lt };
  const cam = { x: 1090, y: 575, z: camPush(lt, CUT.B, CUT.C, 1.5, 1.66), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const lv = mercuryLv(lt), over = S(lt, TT.d2s2, TT.d2s2 + 1.2), tc = TT.tc;
  // satellite pass + scan beam onto the sand next to the thermometer ("satellites have measured")
  const sp = E(lt, TT.satA, TT.satB), sx = -90 + sp * 2100, sy = 150 + 22 * Math.sin(sp * 5);
  const tgt = scr(cam, 1170, GY + 8);
  if (sp > 0 && sp < 1) {
    const beamA = 0.16 * Math.sin(Math.PI * sp) * (0.7 + 0.3 * Math.sin(lt * 12));
    g.save(); g.fillStyle = 'rgba(160,255,200,' + beamA + ')'; g.beginPath(); g.moveTo(sx - 6, sy + 22); g.lineTo(tgt.x - 120 * (1 - sp * 0.0), tgt.y); g.lineTo(tgt.x + 120, tgt.y); g.lineTo(sx + 6, sy + 22); g.closePath(); g.fill(); g.restore();
    satellite(g, sx, sy, -0.12, lt);
  }
  layer(g, cam, () => {
    // glowing ground-surface band along the sand
    sandGlow(g, 1170, GY + 6, 420, 0.25 + 0.95 * lv, lt);
    sandGlow(g, 1420, GY + 10, 300, 0.2 + 0.5 * lv, lt + 1);
    signBoard(g, 1560, GY + 4, lt);
    g.save(); g.fillStyle = 'rgba(240,214,166,0.95)'; g.beginPath(); g.ellipse(1170, GY + 6, 50, 11, 0, 0, TAU); g.fill(); g.restore();
    const flash = Math.max(0, 1 - Math.abs(lt - tc) / 0.35);
    const topY = thermo(g, 1170, GY + 4, 360, lv, { mark: 0.625, flash: flash });
    heatLines(g, 1170, GY - 12, 4, lt, 0.25 + 0.6 * lv, 110, 90);
    if (over > 0.01) {                         // "likely even hotter": slow pulse above the notch, hedged (no new number)
      g.save(); g.translate(1170, topY - 30); g.globalAlpha = over * (0.55 + 0.45 * Math.sin(lt * 5));
      g.fillStyle = '#ff3b2a'; g.beginPath(); g.moveTo(0, -22); g.lineTo(18, 4); g.lineTo(6, 4); g.lineTo(6, 20); g.lineTo(-6, 20); g.lineTo(-6, 4); g.lineTo(-18, 4); g.closePath(); g.fill(); g.restore();
    }
  });
  // the host
  const react = S(lt, tc - 0.1, tc + 0.35);
  let pose, expr;
  if (lt < TT.d2s2) {
    pose = { a: 'point', b: 'wipeBrow', k: S(lt, tc - 0.3, tc + 0.2) };
    expr = react > 0.5 ? { eyes: 'wide', sweat: 1, lines: 'shock' } : { eyes: 'droop', sweat: 1, look: 'fwd' };
    if (lt < d2.start + 1.3) pose = 'point';
  } else {
    pose = { a: 'wipeBrow', b: 'fanSelf', k: S(lt, TT.d2s2 + 0.3, TT.d2s2 + 0.9) };
    expr = { eyes: 'worry', sweat: 1, look: 'upfwd', steam: S(lt, TT.d2s2 + 1.5, TT.d2s2 + 3) * 0.7 };
  }
  const st = { x: 800, y: GY, s: 1.25, facing: 1, pose: pose, t: lt, expr: expr, props: { sunglasses: 1, towel: true }, at: { x: 1170, y: GY - 230 } };
  if (typeof pose === 'string' && pose === 'point') st.pose = { name: 'point', dir: 0.35 };
  else if (pose && pose.a === 'point') pose.a = { name: 'point', dir: 0.35 };
  hero(g, cam, H, o, st);
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, { warp: [560, 900, 0.6], glare: 0.5 });
}

// ------------------------------------------------------------------ SHOT C  (d2 s3)  barefoot gag (the ONE gag)
function shotC(g, lt, H) {
  const o = { scene: 'desert', heat: 0.9, cloud: 0.1, t: lt };
  const tTouch = TT.touch, u = lt - tTouch;
  const cam = { x: 900, y: 578, z: camPush(lt, CUT.C, tTouch, 1.55, 1.65), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const hop = u > 0 ? Math.abs(Math.sin(u * Math.PI / 0.36)) * 62 * (0.4 + 0.6 * E(u, 0, 0.3)) : 0;
  const hotA = 0.55 + 0.45 * S(lt, tTouch - 0.1, tTouch + 0.2);
  layer(g, cam, () => {
    sandGlow(g, 975, GY + 4, 190, hotA, lt);
    sneakers(g, 690, GY + 4);
    heatLines(g, 975, GY - 8, 5, lt, hotA, 130, 110);
  });
  let pose, expr;
  if (u < 0) {
    const lift = S(lt, tTouch - 0.6, tTouch - 0.1);                       // tentative lifted foot hovering over the hot sand
    pose = { a: 'stand', b: { name: 'walk', speed: 0.5, amp: 0.45, phase: 0.1 }, k: lift };
    expr = { eyes: 'droop', sweat: 0.6, look: 'down' };
  } else {
    pose = { a: { name: 'run', speed: 3.2 }, b: 'throwArms', k: 0.35 };
    expr = { eyes: 'wide', sweat: 1, lines: 'shock', pop: E(u, 0, 0.12) < 1 ? '!' : null, popT: u, popDur: 0.9 };
  }
  const st = { x: 905, y: GY - hop, s: 1.35, facing: 1, pose: pose, t: lt, expr: expr, props: { sunglasses: 1, towel: true } };
  hero(g, cam, H, o, st, { gy: GY, after: (c) => {
    if (u >= 0) {
      puffs(c, 940, GY - 6, lt, tTouch, 7, 130, 13, 'rgba(255,255,255,A)');
      puffs(c, 990, GY - 6, lt, tTouch + 0.15, 5, 100, 10, 'rgba(255,220,180,A)');
      if (u < 0.5) { c.save(); c.strokeStyle = 'rgba(255,230,120,' + (1 - u * 2) + ')'; c.lineWidth = 5; c.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = -Math.PI * (0.1 + 0.8 * i / 7), r0 = 30 + u * 70, r1 = r0 + 28; c.beginPath(); c.moveTo(955 + Math.cos(a) * r0, GY - 6 + Math.sin(a) * r0 * 0.7); c.lineTo(955 + Math.cos(a) * r1, GY - 6 + Math.sin(a) * r1 * 0.7); c.stroke(); } c.restore(); }
    }
  } });
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, { warp: [600, 920, 0.6], glare: 0.5 });
}

// ------------------------------------------------------------------ SHOT D  (d3)  farm: wilt, thermals, storm clouds
function shotD(g, lt, H) {
  const wilt = S(lt, d3.start + 0.15, d3.start + 1.8);
  const rise = S(lt, TT.d3rise, TT.d3rise + 1.4), grow = S(lt, TT.d3storm - 0.2, d3.end + 0.3);
  const o = { scene: 'farm', heat: 0.75, wilt: wilt, cloud: 0.3 + 0.6 * grow, t: lt };
  const camY = 573 - 55 * S(lt, TT.d3rise, TT.d3storm + 1.0);
  const cam = { x: 900, y: camY, z: camPush(lt, CUT.D, CUT.E, 1.5, 1.6), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const hz = scr(cam, 900, 600).y;                                   // horizon-ish
  storm(g, 1330, hz - 130, grow, lt);
  thermals(g, rise, lt, 120, hz + 150);
  let pose, expr;
  if (lt < TT.d3rise) { pose = { a: 'stand', b: 'slump', k: S(lt, d3.start + 1.0, d3.start + 1.9) }; expr = { eyes: 'worry', sweat: 0.9, look: 'downfwd' }; }
  else if (lt < TT.d3storm) { pose = { a: 'slump', b: 'lookUp', k: S(lt, TT.d3rise, TT.d3rise + 0.5) }; expr = { eyes: 'droop', sweat: 1, look: 'up' }; }
  else { pose = { a: 'lookUp', b: 'shield', k: S(lt, TT.d3storm + 0.4, TT.d3storm + 1.0) }; expr = { eyes: 'wide', sweat: 1, lines: 'shock', look: 'up' }; }
  const st = { x: 800, y: GY, s: 1.3, facing: 1, pose: pose, t: lt, expr: expr, props: { sunglasses: 1, towel: true } };
  hero(g, cam, H, o, st);
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, { warp: [200, 880, 0.9 * rise], glare: 0.4 });
}

// ------------------------------------------------------------------ SHOT E  (d4)  coast: sand vs water thermometer, breeze
function shotE(g, lt, H) {
  const o = { scene: 'coast', heat: 0.3, cloud: 0.3, t: lt };
  const cam = { x: 960, y: 573, z: camPush(lt, CUT.E, CUT.F1, 1.55, 1.68), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const gust = S(lt, TT.d4breeze - 0.1, TT.d4breeze + 0.7);
  const race = E(lt, TT.d4water, TT.d4sea + 0.6);
  const sandLv = 0.1 + 0.62 * easeOut(race), waterLv = 0.1 + 0.14 * easeInOut(race);
  const walkIn = E(lt, CUT.E, CUT.E + 1.6);
  layer(g, cam, () => {
    flag(g, 1470, GY - 2, lt, gust);
    sandGlow(g, 1010, GY + 6, 170, 0.15 + 0.7 * race, lt);
    g.save(); g.fillStyle = 'rgba(240,214,166,0.95)'; g.beginPath(); g.ellipse(1010, GY + 6, 48, 10, 0, 0, TAU); g.fill(); g.restore();
    thermo(g, 1010, GY + 4, 300, sandLv, { col: '#ff3b2a' });
    heatLines(g, 1010, GY - 10, 3, lt, 0.2 + 0.5 * race, 90, 80);
    bucket(g, 1230, GY + 6, lt, 1 + 2 * gust);
    thermo(g, 1230, GY - 62, 220, waterLv, { col: '#2a8fe8', bulb: 14 });
  });
  const x = 520 + 250 * easeOut(walkIn);
  let pose, expr;
  if (lt < CUT.E + 1.7) { pose = { name: 'walk', speed: 0.55 * (1 - 0.8 * E(lt, CUT.E + 1.0, CUT.E + 1.7)), amp: 1 - E(lt, CUT.E + 1.2, CUT.E + 1.7) }; expr = { eyes: 'happy', sweat: 0.3 }; }
  else if (lt < TT.d4sea) { pose = { name: 'point', dir: 0.12 }; expr = { eyes: 'normal', look: 'fwd', sweat: 0.4 }; }
  else if (lt < TT.d4breeze) { pose = { name: 'point', dir: 0.0 }; expr = { eyes: 'happy', sweat: 0.1 }; }
  else { pose = { a: { name: 'point', dir: 0 }, b: 'lookUp', k: S(lt, TT.d4breeze, TT.d4breeze + 0.8) }; expr = { eyes: 'closed', sweat: 0 }; }
  const st = { x: x, y: GY, s: 1.25, facing: 1, pose: pose, t: lt, expr: expr, props: { sunglasses: lt < TT.d4breeze ? 1 : 1, towel: true } };
  hero(g, cam, H, o, st);
  layer(g, cam, () => { palmFront(g, 1710, GY + 20, lt, 0.2 + 0.8 * gust); });
  TOD.drawForeground(g, cam, H, o);
  windStreaks(g, lt, gust * 0.9, 330, 860);
  finish(g, H, o, lt, { warp: [600, 880, 0.25] });
}

// ------------------------------------------------------------------ SHOT F1  (d5 a)  walking along the shade of a tall building
const WALL_X = 1450, EDGE0 = 640;
const F1 = { sp: 0.62, s: 1.22, x0: 390 }; F1.v = 144 * F1.s * F1.sp * 0.82;
TT.enter = CUT.F1 + (EDGE0 + 40 - F1.x0) / F1.v;        // he steps into the shade
function shadeOverlay(g, edge, alpha) {
  const gr = g.createLinearGradient(edge, 0, WALL_X, 0);
  gr.addColorStop(0, 'rgba(34,46,120,' + alpha * 0.7 + ')'); gr.addColorStop(0.15, 'rgba(34,46,120,' + alpha + ')'); gr.addColorStop(1, 'rgba(24,30,92,' + (alpha * 1.1) + ')');
  g.fillStyle = gr; g.beginPath(); g.moveTo(edge + 50, 735); g.lineTo(WALL_X + 40, 735); g.lineTo(WALL_X + 40, 1500); g.lineTo(edge - 360, 1500); g.closePath(); g.fill();
}
function wallBlock(g) {
  g.save();
  const gr = g.createLinearGradient(WALL_X, 0, WALL_X + 500, 0); gr.addColorStop(0, '#4d5798'); gr.addColorStop(1, '#2b3166');
  g.fillStyle = gr; g.fillRect(WALL_X, -1400, 600, 2150);
  g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(WALL_X, -1400, 14, 2150);
  for (let r = 0; r < 10; r++) for (let c = 0; c < 4; c++) { g.fillStyle = (r * 5 + c * 3) % 7 === 0 ? 'rgba(255,214,130,0.75)' : 'rgba(150,176,230,0.38)'; g.fillRect(WALL_X + 50 + c * 120, -60 + r * 76, 70, 48); }
  g.fillStyle = '#2b2f5e'; g.fillRect(WALL_X, 700, 600, 40);
  g.restore();
}
function shotF1(g, lt, H) {
  const o = { scene: 'city', heat: 0.35, cloud: 0.3, t: lt };
  const sp = F1.sp, s = F1.s, v = F1.v, w0 = CUT.F1;
  const hx = F1.x0 + v * (lt - w0);
  const cam = { x: hx + 320, y: 573, z: 1.5, r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const enter = S(hx, EDGE0 - 60, EDGE0 + 90);
  layer(g, cam, () => { wallBlock(g); shadeOverlay(g, EDGE0, 0.46); });
  const sipT = TT.d5s2 + 0.1, sip = S(lt, sipT, sipT + 0.35);
  let pose = { name: 'walk', speed: sp, amp: 1, lean: 0.06 };
  const bottle = S(lt, TT.d5s2 - 0.2, TT.d5s2 + 0.1);
  const sipping = E(lt, sipT + 0.2, sipT + 1.3);
  if (sipping > 0 && sipping < 1) pose = { a: pose, b: 'drink', k: Math.sin(Math.PI * sipping) };
  const expr = enter < 0.4 ? { eyes: 'droop', sweat: 1 } : { eyes: sipping > 0 && sipping < 1 ? 'closed' : 'happy', sweat: 0.2 };
  const st = { x: hx, y: GY, s: s, facing: 1, pose: pose, t: lt, expr: expr, props: { sunglasses: 1, towel: true, waterBottle: bottle > 0.02 ? { level: 0.8, amt: bottle } : false } };
  hero(g, cam, H, o, { x: st.x, y: st.y, s: st.s, facing: 1, pose: pose, t: lt, expr: expr, props: st.props }, { shadowClip: [-3000, EDGE0 + 50] });
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, { warp: enter < 0.95 ? [600, 880, 0.2 * (1 - enter)] : null });
}

// ------------------------------------------------------------------ SHOT F2  (d5 b)  the shade edge barely creeps; the "normal day" ghost edge races
function shotF2(g, lt, H) {
  const o = { scene: 'city', heat: 0.3, cloud: 0.3, t: lt };
  const cam = { x: 980, y: 573, z: 1.5, r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const u = lt - CUT.F2, E0 = 780, edge = E0 - 14 * u, ghost = edge - 42 * Math.max(0, lt - (TT.d5shade - 0.15));
  layer(g, cam, () => {
    wallBlock(g); shadeOverlay(g, edge, 0.46);
    // peg at the original edge + slow clock; dashed ghost edge + fast clock
    g.save();
    const pegX = E0;
    g.fillStyle = '#e8503c'; g.fillRect(pegX - 3, 740, 6, 60); g.beginPath(); g.arc(pegX, 740, 9, 0, TAU); g.fill();
    if (lt > TT.d5shade - 0.15) {
      const ga = S(lt, TT.d5shade - 0.15, TT.d5shade + 0.2);
      g.globalAlpha = ga * 0.85; g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.setLineDash([16, 12]); g.beginPath(); g.moveTo(ghost + 46, 742); g.lineTo(ghost - 40, 960); g.stroke(); g.setLineDash([]);
      clockIcon(g, ghost + 50, 672, 38, (lt - TT.d5shade) * 9, '#8fd0ff');
      g.globalAlpha = 1;
    }
    clockIcon(g, edge + 50, 672, 38, (lt - CUT.F2) * 0.9, '#ffb04a');
    g.restore();
  });
  const st = { x: 1040, y: GY, s: 1.3, facing: -1, pose: lt < TT.d5shade + 0.9 ? { name: 'point', dir: 0.0 } : 'thumbsUp', t: lt, expr: lt < TT.d5shade + 0.9 ? { eyes: 'normal', look: 'fwd', sweat: 0.2 } : { eyes: 'happy' }, props: { sunglasses: 1, towel: true, waterBottle: false } };
  hero(g, cam, H, o, st, { noShadow: true });
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, {});
}

// ------------------------------------------------------------------ SHOT F3  (d5 c)  beach, sun low and orange, strolling with a cold drink (ends on motion)
function shotF3(g, lt, H) {
  const o = { scene: 'coast', heat: 0.0, cloud: 0.25, t: lt };
  const s = 1.25, sp = 0.6, v = 144 * s * sp * 0.82, hx = 560 + v * (lt - CUT.F3);
  const cam = { x: hx + 140, y: 573, z: 1.58, r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const sip = E(lt, CUT.F3 + 1.1, CUT.F3 + 2.2);
  let pose = { name: 'walk', speed: sp, amp: 1, lean: 0.05 };
  if (sip > 0 && sip < 1) pose = { a: pose, b: 'drink', k: Math.sin(Math.PI * sip) * 0.9 };
  const st = { x: hx, y: GY, s: s, facing: 1, pose: pose, t: lt, expr: sip > 0.1 && sip < 0.9 ? { eyes: 'closed' } : { eyes: 'happy' }, props: { sunglasses: 1, towel: true, waterBottle: { level: 0.7 } } };
  hero(g, cam, H, o, st);
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, {});
}

// ------------------------------------------------------------------ chapter entry
window.CH.c4 = {
  draw: function (g, lt, dur) {
    lt = clamp(lt, 0, END);
    if (!window.__c4warm) { window.__c4warm = true; try { if (TOD.warm) TOD.warm(); } catch (e) {} }
    const H = hOf(lt);
    g.save();
    if (lt < CUT.B) shotA(g, lt, H);
    else if (lt < CUT.C) shotB(g, lt, H);
    else if (lt < CUT.D) shotC(g, lt, H);
    else if (lt < CUT.E) shotD(g, lt, H);
    else if (lt < CUT.F1) shotE(g, lt, H);
    else if (lt < CUT.F2) shotF1(g, lt, H);
    else if (lt < CUT.F3) shotF2(g, lt, H);
    else shotF3(g, lt, H);
    g.restore();
    g.save(); hudDraw(g, lt, H); g.restore();
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },
  T: { TT: TT, CUT: CUT, END: END, d: VO }, _cuts: CUT, _tt: TT, _h: hOf
};
})();
