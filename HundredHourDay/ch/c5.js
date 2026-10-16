// ch/c5.js - Chapter 5 "Long Night" (55.7 s). Frame = pure function of local time lt. Hard cuts between shots (no fades of its own).
// Shots: A coast sunset (n1) | B desert cold + two thermometers (n2) | C1 city lights fail, C2 solar panel + battery (n3)
//        D globe power transfer, D2 city partly dark (n4) | E1 owl+fox, E2 polar penguins/aurora, E3 rooster gag (n5) | F sleep time-lapse (n6) | G stars (n7)
// HUD (monotonic): A shows H50 -> 51.4, then it is HIDDEN for the explanatory cutaways B..E (no clock claim is made there),
// returns at the same H51.4 in F, races 51.4 -> 58 while he sleeps (n6 "wake up ... forty-two more to go"), then 58 -> 62.5 under the stars.
// Hedges kept: freezing is only "possibly" (a second thermometer under cloud stays above 0); power transfer is ONE option (generator/battery icons shown too);
// only some districts go dark. All times derive from LAYOUT.c5.vo[i] (+ character-fraction estimates inside a line).
(function () {
'use strict';
window.CH = window.CH || {};
const LAY = LAYOUT.c5, VO = {};
LAY.vo.forEach((v) => { VO[v.id] = v; });
const n1 = VO.n1, n2 = VO.n2, n3 = VO.n3, n4 = VO.n4, n5 = VO.n5, n6 = VO.n6, n7 = VO.n7;
const tAt = (v, s) => { const i = v.text.indexOf(s); return v.start + v.dur * (Math.max(0, i) / v.text.length); };
const END = LAY.dur;
const TT = {
  cheer: tAt(n1, 'Finally'), leak: tAt(n1, 'But the heat'),
  swing: tAt(n2, 'Dry places'), more: tAt(n2, 'A fifty-hour'), freeze: tAt(n2, 'possibly below'), cloud: tAt(n2, 'depending on'),
  flick: n3.start + 0.15, panel: tAt(n3, 'Solar panels'), batt: tAt(n3, 'today'),
  pull: tAt(n4, 'pulling'), dark: tAt(n4, 'and some places'),
  polar: tAt(n5, 'Polar animals'), clock24: tAt(n5, 'But most'),
  lapse0: n6.start + 0.05, wake: tAt(n6, 'wake up') + 0.1, still: tAt(n6, 'and it'), fortytwo: tAt(n6, 'Forty-two'),
  look: n7.start + 0.2, shoot: n7.end - 1.9
};
const CUT = {
  B: n2.start - 0.15, C1: n3.start - 0.12, C2: TT.panel - 0.1, D: n4.start - 0.12, D2: TT.dark - 0.15,
  E1: n5.start - 0.12, E2: TT.polar - 0.1, E3: TT.clock24 - 0.1, F: n6.start - 0.12, G: n7.start - 0.12
};
const H_A0 = 50, H_A1 = 51.4, H_L1 = 58, H_G1 = 62.5;
const E = (t, a, b) => clamp((t - a) / (b - a));
const S = (t, a, b) => smooth(E(t, a, b));
const mod = (a, n) => ((a % n) + n) % n;
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const GY = 820;
const FONT = '"Bahnschrift SemiBold","Segoe UI Black",sans-serif';
const camPush = (lt, a, b, z0, z1) => z0 + (z1 - z0) * easeInOut(E(lt, a, b));

// ------------------------------------------------------------------ clock for the HUD (monotonic)
function hOf(lt) {
  if (lt < CUT.B) return H_A0 + (H_A1 - H_A0) * easeInOut(E(lt, 0, CUT.B));
  if (lt < CUT.F) return H_A1;
  if (lt < CUT.G) return H_A1 + (H_L1 - H_A1) * easeInOut(E(lt, TT.lapse0, TT.wake));
  return H_L1 + (H_G1 - H_L1) * E(lt, CUT.G, END);
}
function hudA(lt) {
  if (lt < CUT.B) return S(lt, 0.3, 0.8) * (1 - S(lt, CUT.B - 0.35, CUT.B - 0.05));
  if (lt < CUT.F) return 0;
  return S(lt, CUT.F + 0.08, CUT.F + 0.5);
}

// ------------------------------------------------------------------ host
function castFn(st) { return (c) => { MASCOT.draw(c, { x: 0, y: 0, s: 1, facing: st.facing, pose: st.pose, t: st.t, expr: 'neutral', pal: TOD.PAL_SHADOW, shadow: false }); }; }
function hero(g, cam, H, o, st, opt) {
  opt = opt || {};
  withLayer(g, cam, 1, () => {
    if (!opt.noShadow) TOD.drawCastShadow(g, H, st.x, opt.gy == null ? st.y : opt.gy, st.s, castFn(st), o);
    MASCOT.draw(g, Object.assign({ shadow: false, pal: TOD.heroPal(H, o) }, st));
    if (opt.after) opt.after(g);
  });
}
const layer = (g, cam, fn) => withLayer(g, cam, 1, fn);
const scr = (cam, wx, wy) => project(cam, wx, wy, 1);

// ------------------------------------------------------------------ props / in-world art
function thermo(g, x, y, h, lv, o) {
  o = o || {};
  const col = o.col || '#ff3b2a', bulb = o.bulb == null ? 17 : o.bulb;
  const yb = -bulb - 8, ytop = -h + 18, span = yb - ytop, lvY = yb - lv * span * 0.92;
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,20,0.35)'; g.beginPath(); g.ellipse(6, 6, 46, 10, 0, 0, TAU); g.fill();
  rr(g, -26, -h - 6, 52, h + 10, 12); g.fillStyle = o.body || '#e9edf6'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#2d3550'; g.stroke();
  g.strokeStyle = '#2d3550'; g.lineWidth = 2;
  for (let i = 0; i <= 10; i++) { const ty = yb - (i / 10) * span * 0.92; g.beginPath(); g.moveTo(-22, ty); g.lineTo(i % 5 === 0 ? -8 : -13, ty); g.stroke(); }
  rr(g, -5.5, ytop, 11, yb - ytop + 4, 5.5); g.fillStyle = '#dcebf1'; g.fill(); g.lineWidth = 2; g.stroke();
  g.fillStyle = col; g.beginPath(); g.arc(0, -bulb - 3, bulb, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = '#2d3550'; g.stroke();
  g.fillStyle = col; rr(g, -3.4, lvY, 6.8, yb - lvY + 6, 3); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(-5, -bulb - 8, 4.5, 0, TAU); g.fill();
  if (o.mark != null) {                       // freezing notch with the digit 0 (in-world scale label)
    const my = yb - o.mark * span * 0.92, fl = o.flash || 0;
    g.strokeStyle = '#3aa0ff'; g.lineWidth = 4 + 3 * fl; g.beginPath(); g.moveTo(-24, my); g.lineTo(26, my); g.stroke();
    g.font = 'bold ' + Math.round(26 + 8 * fl) + 'px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.lineWidth = 5; g.strokeStyle = '#0c1330'; g.strokeText('0', 31, my); g.fillStyle = '#8fd0ff'; g.fillText('0', 31, my);
  }
  g.restore();
  return { yTop: y + ytop, yLv: y + lvY, yb: y + yb, span: span * 0.92, yAt: (v) => y + yb - v * span * 0.92 };
}
function sunIcon(g, x, y, r, a) {
  g.save(); g.globalAlpha = a; g.translate(x, y); g.strokeStyle = '#ffd23a'; g.lineWidth = 4; g.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(ang) * r * 1.35, Math.sin(ang) * r * 1.35); g.lineTo(Math.cos(ang) * r * 1.9, Math.sin(ang) * r * 1.9); g.stroke(); }
  g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.restore();
}
function moonIcon(g, x, y, r, a) {
  g.save(); g.globalAlpha = a; g.translate(x, y); g.fillStyle = '#eef0ff'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(r * 0.5, -r * 0.2, r * 0.85, 0, TAU); g.fill(); g.restore();
}
function cloudPuff(g, x, y, s, a) {
  g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#a9b6d8'; g.strokeStyle = '#46527c'; g.lineWidth = 4;
  g.beginPath(); g.arc(-50, 10, 34, 0, TAU); g.arc(0, -8, 46, 0, TAU); g.arc(52, 12, 32, 0, TAU); g.rect(-50, 10, 102, 36); g.fill();
  g.beginPath(); g.moveTo(-84, 46); g.lineTo(84, 46); g.stroke();
  g.restore();
}
function snowflake(g, x, y, r, a, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a; g.strokeStyle = '#d9f0ff'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r); g.moveTo(0, -r * 0.55); g.lineTo(r * 0.22, -r * 0.8); g.moveTo(0, -r * 0.55); g.lineTo(-r * 0.22, -r * 0.8); g.stroke(); }
  g.restore();
}
function leakLines(g, x, y, n, t, a, spread, hgt) {   // warm air streaming up and away
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ph = mod(t * 0.45 + hash1(i * 7 + 3), 1), px = x + (i / Math.max(1, n - 1) - 0.5) * spread, h = hgt * ph;
    g.strokeStyle = 'rgba(255,140,70,' + (a * Math.sin(Math.PI * ph) * 0.85) + ')'; g.lineWidth = 6 - 3 * ph;
    g.beginPath();
    for (let k = 0; k <= 14; k++) { const u = k / 14, yy = y - h * u, xx = px + 9 * Math.sin(u * 8 + t * 3 + i * 2); if (k === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy); }
    g.stroke();
  }
  g.restore();
}
function blanket(g, J, s, a) {   // woven blanket over the lying host (hip -> legs)
  if (a < 0.01) return;
  g.save(); g.globalAlpha = a; g.translate(J.hip.x, J.hip.y);
  g.fillStyle = '#2d3f8a'; g.strokeStyle = '#141b44'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(-26 * s, -22 * s); g.quadraticCurveTo(40 * s, -40 * s, 120 * s, -24 * s); g.lineTo(190 * s, -12 * s); g.lineTo(196 * s, 8 * s); g.lineTo(-24 * s, 8 * s); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(160,190,255,0.55)'; g.lineWidth = 3.5;
  for (let i = 0; i < 6; i++) { const x = 8 * s + i * 30 * s; g.beginPath(); g.moveTo(x, -26 * s + i * 2); g.lineTo(x + 4, 4 * s); g.stroke(); }
  g.restore();
}
function starsBg(g, t, a) {   // plain star field for space-y inserts
  g.save(); g.fillStyle = 'rgba(255,255,255,' + a + ')';
  for (let i = 0; i < 110; i++) { const tw = 0.6 + 0.4 * Math.sin(t * (1 + hash1(i) * 2) + i); g.globalAlpha = a * tw; g.fillRect(hash1(i * 3 + 1) * 1920, hash1(i * 5 + 2) * 1080, 2 + 2 * hash1(i + 9), 2 + 2 * hash1(i + 9)); }
  g.restore();
}
function hudDraw(g, lt, H) {
  const a = hudA(lt); if (a < 0.01) return;
  const lap = lt >= TT.lapse0 && lt < TT.wake ? 1 : 0;
  const pulse = lt >= TT.fortytwo - 0.1 && lt < TT.fortytwo + 1.0 ? Math.sin(Math.PI * E(lt, TT.fortytwo - 0.1, TT.fortytwo + 1.0)) : (lap ? 0.5 + 0.5 * Math.sin(lt * 16) : 0);
  TOD.hud(g, H, { alpha: a, pop: E(lt, 0.3, 0.95), pulse: pulse });
}
function finish(g, H, o, lt, fx) {
  fx = fx || {};
  if (fx.warp) TOD.heatWarp(g, fx.warp[0], fx.warp[1], fx.warp[2], lt);
  TOD.grade(g, H, o);
  if (fx.frostOv) TOD.frostOverlay(g, fx.frostOv, lt);
}

// ------------------------------------------------------------------ SHOT A  (n1)  coast sunset: relief, then the heat leaks away
function shotA(g, lt, H) {
  const o = { scene: 'coast', heat: 0.25 * (1 - S(lt, TT.leak, TT.leak + 3)), cloud: 0.2, t: lt };
  const cam = { x: 980, y: 573, z: camPush(lt, 0, CUT.B, 1.5, 1.7), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const hx = 820 + 100 * easeOut(E(lt, 0, 2.0)), walk = 1 - E(lt, 1.4, 2.1);
  const cheer = S(lt, TT.cheer - 0.15, TT.cheer + 0.2) * (1 - S(lt, TT.leak - 0.15, TT.leak + 0.3));
  let pose = { a: { name: 'walk', speed: 0.5 * walk, amp: walk }, b: 'throwArms', k: cheer };
  if (lt >= TT.leak - 0.15) pose = { a: 'stand', b: 'hugSelf', k: S(lt, TT.leak + 0.4, TT.leak + 1.6) };
  const expr = lt < TT.cheer - 0.2 ? { eyes: 'droop', sweat: 0.6 } : lt < TT.leak ? { eyes: 'happy', sparkle: 0.6 } : { eyes: 'worry', look: 'up', shiver: 0.5 * S(lt, TT.leak + 1.2, TT.leak + 3), breath: 0.5 * S(lt, TT.leak + 1.5, TT.leak + 3.5) };
  const st = { x: hx, y: GY, s: 1.3, facing: 1, pose: pose, t: lt, expr: expr, props: { towel: true } };
  // heat leaving the sand, up into the sky, + a thermometer sliding down
  const leak = S(lt, TT.leak - 0.1, TT.leak + 0.5) * (1 - S(lt, n1.end - 0.5, n1.end + 0.1));
  layer(g, cam, () => {
    const lv = 0.7 - 0.45 * easeInOut(E(lt, TT.leak, n1.end));
    thermo(g, 1450, GY + 6, 280, lv, { col: '#ff6a3a' });
    leakLines(g, 1130, GY + 8, 7, lt, leak, 420, 520);
  });
  hero(g, cam, H, o, st);
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, {});
}

// ------------------------------------------------------------------ SHOT B  (n2)  desert night: how far the thermometer falls
const B_DRY = 1090, B_HUM = 1450;
function dryLevel(lt) {
  const a = S(lt, TT.swing, TT.more - 0.2), b = S(lt, TT.more, TT.freeze - 0.1), c = S(lt, TT.freeze - 0.4, TT.freeze + 0.9);
  return 0.82 - 0.36 * a - 0.1 * b - 0.13 * c;   // 0.82 day -> 0.46 -> 0.36 -> 0.23 (below the 0.30 freezing notch)
}
function shotB(g, lt, H) {
  const fr = S(lt, TT.freeze, TT.freeze + 1.5);
  const o = { scene: 'desert', heat: 0, frost: 0.45 * fr, cloud: 0.15, t: lt };
  const cam = { x: 1050, y: 575, z: camPush(lt, CUT.B, CUT.C1, 1.5, 1.62), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  TOD.frostGround(g, cam, 0.7 * fr, 790);
  const lv = dryLevel(lt), freezeNotch = 0.30, cross = Math.max(0, 1 - Math.abs(lt - (TT.freeze + 0.15)) / 0.4);
  const cl = S(lt, TT.cloud, TT.cloud + 0.8), humLv = 0.5 + 0.02 * Math.sin(lt * 0.8);
  layer(g, cam, () => {
    const T1 = thermo(g, B_DRY, GY + 6, 380, lv, { col: lv < freezeNotch ? '#7fc8ff' : '#ff5a3a', mark: freezeNotch, flash: cross });
    // day mark (sun) and swing bracket
    const swing = S(lt, TT.swing + 0.3, TT.swing + 1.4);
    sunIcon(g, B_DRY - 78, T1.yAt(0.82), 14, 1 - 0.7 * E(lt, TT.swing, TT.more));
    moonIcon(g, B_DRY - 78, T1.yAt(Math.max(0.12, lv)), 16, S(lt, TT.swing, TT.swing + 1.0));
    g.save(); g.globalAlpha = swing; g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
    const yT = T1.yAt(0.82), yB = T1.yAt(lv), bx = B_DRY + 78;
    g.beginPath(); g.moveTo(bx - 10, yT); g.lineTo(bx, yT); g.lineTo(bx, yB); g.lineTo(bx - 10, yB); g.stroke();
    g.beginPath(); g.moveTo(bx - 9, yB - 14); g.lineTo(bx, yB); g.lineTo(bx + 9, yB - 14); g.stroke();
    g.restore();
    if (fr > 0.05) for (let i = 0; i < 5; i++) { const ph = mod(lt * 0.6 + i / 5, 1); snowflake(g, B_DRY - 50 + i * 28, T1.yAt(0.3) - 36 - ph * 120, 12 + 3 * i % 4, Math.sin(Math.PI * ph) * fr, lt + i); }
    // second thermometer under a cloud: stays warmer ("depending on clouds and humidity")
    const T2 = thermo(g, B_HUM, GY + 6, 380, mix2(0.82, humLv, S(lt, TT.swing, TT.more)), { col: '#ff7a3a', mark: freezeNotch });
    if (cl > 0.01) {
      cloudPuff(g, B_HUM + 6, T2.yTop - 70 - 10 * (1 - cl), 1.0, cl);
      g.save(); g.globalAlpha = cl * 0.5; g.strokeStyle = '#ff9a5a'; g.lineWidth = 4; g.lineCap = 'round';   // warmth kept in
      for (let i = 0; i < 3; i++) { const x = B_HUM - 40 + i * 40, ph = mod(lt * 0.5 + i / 3, 1); g.beginPath(); g.moveTo(x, T2.yAt(0.15) - 20); g.lineTo(x, T2.yAt(0.15) - 20 - 80 * ph); g.stroke(); }
      g.restore();
    }
  });
  const sh = S(lt, TT.swing + 1.0, TT.freeze + 0.6);
  const st = { x: 800, y: GY, s: 1.45, facing: 1, pose: { a: 'stand', b: 'hugSelf', k: S(lt, CUT.B + 0.3, CUT.B + 1.2) }, t: lt, expr: { eyes: fr > 0.6 ? 'squint' : 'worry', shiver: 0.3 + 0.7 * sh, breath: 0.4 + 0.6 * sh }, props: { scarf: true, beanie: true } };
  hero(g, cam, H, o, st);
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, { frostOv: 0.5 * fr });
}
function mix2(a, b, k) { return a + (b - a) * k; }

// ------------------------------------------------------------------ SHOT C1  (n3 a)  city: the lights flicker out, a block at a time
const C1_COLS = [[-40, 330], [330, 700], [700, 1080], [1080, 1450], [1450, 1960]];
function litAt(lt, i) {            // 1 = lit, 0 = dark; each block flickers then dies; order scrambled
  const t0 = TT.flick + [0.15, 0.75, 0.4, 1.15, 0.6][i], u = lt - t0;
  if (u < 0) return 1;
  const f = Math.sin(u * 38) * Math.sin(u * 23 + i);
  if (u < 0.35) return f > 0.15 ? 1 : 0.25;
  return 0;
}
function shotC1(g, lt, H) {
  const o = { scene: 'city', cloud: 0.1, t: lt };
  const cam = { x: 920, y: 560, z: camPush(lt, CUT.C1, CUT.C2, 1.35, 1.5), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  // dim each block by multiplying a cool dark tint over its columns (kills the warm windows, keeps the dark sky dark)
  g.save(); g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < C1_COLS.length; i++) {
    const k = 1 - litAt(lt, i); if (k < 0.01) continue;
    const c = C1_COLS[i], w = c[1] - c[0];
    const gr = g.createLinearGradient(c[0], 0, c[0] + w, 0); const m = (a) => 'rgb(' + Math.round(255 - 215 * a) + ',' + Math.round(255 - 200 * a) + ',' + Math.round(255 - 130 * a) + ')';
    gr.addColorStop(0, m(0)); gr.addColorStop(0.08, m(k)); gr.addColorStop(0.92, m(k)); gr.addColorStop(1, m(0));
    g.fillStyle = gr; g.fillRect(c[0], 0, w, 792);
  }
  g.restore();
  const st = { x: 560, y: GY, s: 1.5, facing: 1, pose: { a: 'stand', b: 'lookUp', k: S(lt, CUT.C1 + 0.5, CUT.C1 + 1.0) }, t: lt, expr: { eyes: 'wide', look: 'up', lines: lt > TT.flick + 1.2 ? 'shock' : null, sweat: 0.3 }, props: { scarf: true, beanie: true } };
  hero(g, cam, H, o, st);
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, {});
}

// ------------------------------------------------------------------ SHOT C2  (n3 b)  solar panel + the battery that lasts hours, not fifty
function solarPanel(g, x, y, s, t, moon) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(0,0,20,0.4)'; g.beginPath(); g.ellipse(10, 4, 150, 16, 0, 0, TAU); g.fill();
  g.strokeStyle = '#8a93ad'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -150); g.stroke();
  g.translate(0, -170); g.rotate(-0.28);
  g.fillStyle = '#10204e'; g.strokeStyle = '#c9d0e6'; g.lineWidth = 6; rr(g, -150, -70, 300, 140, 8); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(160,190,255,0.5)'; g.lineWidth = 2;
  for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(-150 + i * 60, -70); g.lineTo(-150 + i * 60, 70); g.stroke(); }
  for (let j = 1; j < 3; j++) { g.beginPath(); g.moveTo(-150, -70 + j * 46.7); g.lineTo(150, -70 + j * 46.7); g.stroke(); }
  if (moon > 0) { moonIcon(g, 78, -22, 30, moon); }
  g.restore();
}
function batteryBar(g, x, y, w, h, fillK) {
  g.save(); g.translate(x, y);
  rr(g, 0, 0, w, h, 14); g.fillStyle = '#12183a'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#e8ecf8'; g.stroke();
  g.fillStyle = '#e8ecf8'; rr(g, w + 2, h * 0.3, 16, h * 0.4, 5); g.fill();
  const cw = (w - 28) / 4;
  for (let i = 0; i < 4; i++) {
    const on = clamp(fillK * 4 - i);        // each chunk drains in turn, left chunk last
    const j = 3 - i;                         // chunk j drains first when j is rightmost
    const kk = clamp(fillK * 4 - i);
    void on; void j;
    if (kk <= 0.01) continue;
    g.fillStyle = fillK < 0.3 ? '#ff5a4a' : '#7be07a'; rr(g, 14 + i * cw + 3, 14, (cw - 6) * Math.min(1, kk), h - 28, 8); g.fill();
  }
  g.restore();
}
function shotC2(g, lt, H) {
  const o = { scene: 'city', cloud: 0.1, t: lt };
  const cam = { x: 960, y: 575, z: camPush(lt, CUT.C2, CUT.D, 1.9, 2.05), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const mA = S(lt, CUT.C2 + 0.1, CUT.C2 + 0.7), dr = E(lt, TT.batt, n3.end);
  layer(g, cam, () => {
    solarPanel(g, 700, GY + 40, 1.25, lt, mA);
    // output meter reads 0
    g.save(); g.translate(930, GY - 320);
    rr(g, 0, 0, 120, 74, 14); g.fillStyle = '#0c1232'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#e8ecf8'; g.stroke();
    g.font = 'bold 52px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff6a5a'; g.fillText('0', 60, 40); g.restore();
    // battery: 4 chunks drain; below it a 50-chunk strip (the long night) of which only 4 are covered
    const k = 1 - easeInOut(dr);
    batteryBar(g, 1050, GY - 240, 340, 130, S(lt, TT.batt - 0.2, TT.batt + 0.2) * k + (1 - S(lt, TT.batt - 0.2, TT.batt + 0.2)));
    const stripA = S(lt, TT.batt + 0.4, TT.batt + 1.2), sx = 800, sw = 20, gap = 4;
    g.save(); g.globalAlpha = stripA;
    for (let i = 0; i < 50; i++) { g.fillStyle = i < 4 ? '#7be07a' : 'rgba(150,170,230,0.35)'; g.fillRect(sx + (i % 25) * (sw + gap), GY - 70 + Math.floor(i / 25) * 36, sw, 28); }
    g.font = 'bold 40px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.lineWidth = 6; g.strokeStyle = '#0c1232'; g.strokeText('50', sx + 25 * (sw + gap) + 16, GY - 44); g.fillText('50', sx + 25 * (sw + gap) + 16, GY - 44);
    g.restore();
  });
  const st = { x: 380, y: GY, s: 1.5, facing: 1, pose: { a: 'stand', b: 'slump', k: S(lt, TT.batt, TT.batt + 1.4) }, t: lt, expr: { eyes: 'worry', look: 'fwd', sweat: 0.4 }, props: { scarf: true, beanie: true } };
  hero(g, cam, H, o, st);
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, {});
}

// ------------------------------------------------------------------ SHOT D  (n4)  globe: one option is to import power from the sunlit side
function projLL(cx, cy, R, lon, lat, vLon, vLat) {
  const dl = (lon - vLon) * Math.PI / 180, la = lat * Math.PI / 180, tl = vLat * Math.PI / 180;
  const x = Math.cos(la) * Math.sin(dl), y0 = Math.sin(la), z0 = Math.cos(la) * Math.cos(dl);
  const y = y0 * Math.cos(tl) - z0 * Math.sin(tl), z = y0 * Math.sin(tl) + z0 * Math.cos(tl);
  return { x: cx + R * x, y: cy - R * y, z: z };
}
function gcPoint(lon0, lat0, lon1, lat1, u) {   // great-circle slerp -> unit vector -> lon/lat
  const d2r = Math.PI / 180, v = (lo, la) => [Math.cos(la * d2r) * Math.sin(lo * d2r), Math.sin(la * d2r), Math.cos(la * d2r) * Math.cos(lo * d2r)];
  const a = v(lon0, lat0), b = v(lon1, lat1), dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1), om = Math.acos(dot), so = Math.sin(om) || 1;
  const k0 = Math.sin((1 - u) * om) / so, k1 = Math.sin(u * om) / so, p = [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
  return { lon: Math.atan2(p[0], p[2]) / d2r, lat: Math.asin(clamp(p[1], -1, 1)) / d2r };
}
function shotD(g, lt, H) {
  g.fillStyle = '#04071c'; g.fillRect(0, 0, 1920, 1080); starsBg(g, lt, 0.7);
  const pop = S(lt, CUT.D, CUT.D + 0.6), R = 330 + 20 * pop, cx = 1180, cy = 560, vLon = -5, vLat = 12;
  GLOBE.draw(g, cx, cy, R, { lon: vLon, lat: vLat, sunLon: 105, sunLat: 0, nightLights: true, atmo: true, tNow: lt });
  const host = { lon: -50, lat: 4 }, src = { lon: 62, lat: 14 };
  const ph = projLL(cx, cy, R, host.lon, host.lat, vLon, vLat), ps = projLL(cx, cy, R, src.lon, src.lat, vLon, vLat);
  const flow = S(lt, TT.pull - 0.1, TT.pull + 0.5);
  if (flow > 0.01) {
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const N = 40; let first = true; g.beginPath();
    for (let i = 0; i <= N; i++) { const u = i / N, p = gcPoint(src.lon, src.lat, host.lon, host.lat, u), q = projLL(cx, cy, R * (1 + 0.16 * Math.sin(Math.PI * u)), p.lon, p.lat, vLon, vLat); if (first) { g.moveTo(q.x, q.y); first = false; } else g.lineTo(q.x, q.y); }
    g.globalAlpha = 0.9 * flow; g.strokeStyle = '#ffd23a'; g.lineWidth = 6; g.setLineDash([22, 14]); g.lineDashOffset = -lt * 90; g.stroke(); g.setLineDash([]);
    g.restore();
  }
  // pins: sunlit source (sun icon) and the host's dark spot (pulsing)
  sunIcon(g, ps.x, ps.y, 13, 0.95 * S(lt, CUT.D + 0.4, CUT.D + 1.0));
  const pa = S(lt, CUT.D + 0.4, CUT.D + 1.0), pr = 10 + 4 * Math.sin(lt * 5);
  g.save(); g.globalAlpha = pa; g.fillStyle = '#ff4a3a'; g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(ph.x, ph.y, pr, 0, TAU); g.fill(); g.stroke();
  g.globalAlpha = pa * 0.5; g.strokeStyle = '#ff4a3a'; g.lineWidth = 3; g.beginPath(); g.arc(ph.x, ph.y, pr + 14 + 8 * Math.sin(lt * 5), 0, TAU); g.stroke(); g.restore();
  // the host, medium, left side, looking at it
  const st = { x: 380, y: GY + 30, s: 1.7, facing: 1, pose: { a: 'stand', b: 'point', k: S(lt, TT.pull, TT.pull + 0.5) }, t: lt, expr: { eyes: 'normal', look: 'fwd' }, props: { scarf: true, beanie: true }, at: { x: ph.x, y: ph.y } };
  MASCOT.draw(g, Object.assign({ shadow: false, pal: TOD.heroPal(62, { scene: 'city' }) }, st));
  TOD.grade(g, 62, { scene: 'city' });
}

// ------------------------------------------------------------------ SHOT D2  (n4 b)  only some districts go dark; other supplies exist too
const D2_COLS = [[-40, 380], [380, 760], [760, 1150], [1150, 1520], [1520, 1960]], D2_DARK = [1, 0, 1, 0, 0];
function genIcons(g, x, y, t, a) {
  g.save(); g.globalAlpha = a; g.translate(x, y);
  rr(g, 0, -90, 480, 100, 16); g.fillStyle = 'rgba(8,12,40,0.78)'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#e8ecf8'; g.stroke();
  // generator (box + flame)
  rr(g, 24, -66, 82, 52, 8); g.fillStyle = '#e8b84a'; g.fill(); g.strokeStyle = '#6a4a10'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#ff7a2a'; g.beginPath(); g.moveTo(65, -92); g.quadraticCurveTo(80 + 4 * Math.sin(t * 9), -78, 65, -66); g.quadraticCurveTo(50, -78, 65, -92); g.fill();
  // battery
  rr(g, 196, -66, 90, 52, 8); g.fillStyle = '#7be07a'; g.fill(); g.strokeStyle = '#1d5a30'; g.stroke(); g.fillStyle = '#e8ecf8'; g.fillRect(286, -52, 9, 24);
  // plug (demand adapts: a clock-ed switch)
  g.strokeStyle = '#e8ecf8'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(386, -80); g.lineTo(386, -56); g.moveTo(420, -80); g.lineTo(420, -56); g.stroke();
  g.fillStyle = '#e8ecf8'; rr(g, 372, -56, 62, 34, 10); g.fill();
  g.restore();
}
function shotD2(g, lt, H) {
  const o = { scene: 'city', cloud: 0.1, t: lt };
  const cam = { x: 940, y: 560, z: 1.35, r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const kk = S(lt, TT.dark, TT.dark + 1.2);
  g.save(); g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < D2_COLS.length; i++) {
    const k = D2_DARK[i] * kk * (1 - 0.15 * Math.sin(lt * 7 + i)); if (k < 0.01) continue;
    const c = D2_COLS[i], w = c[1] - c[0];
    const gr = g.createLinearGradient(c[0], 0, c[0] + w, 0); const m = (a) => 'rgb(' + Math.round(255 - 215 * a) + ',' + Math.round(255 - 200 * a) + ',' + Math.round(255 - 130 * a) + ')';
    gr.addColorStop(0, m(0)); gr.addColorStop(0.08, m(k)); gr.addColorStop(0.92, m(k)); gr.addColorStop(1, m(0));
    g.fillStyle = gr; g.fillRect(c[0], 0, w, 792);
  }
  g.restore();
  // imported power arrives from off-screen right into the lit districts
  const aA = S(lt, CUT.D2 + 0.1, CUT.D2 + 0.7);
  g.save(); g.globalAlpha = aA * 0.9; g.strokeStyle = '#ffd23a'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash([22, 14]); g.lineDashOffset = lt * 70;
  g.beginPath(); g.moveTo(1960, 160); g.quadraticCurveTo(1500, 140, 1120, 230); g.stroke();
  g.beginPath(); g.moveTo(1960, 215); g.quadraticCurveTo(1400, 190, 560, 255); g.stroke(); g.setLineDash([]); g.restore();
  genIcons(g, 1300, 930, lt, S(lt, TT.dark + 0.3, TT.dark + 1.0) * 0.95);
  const st = { x: 520, y: GY, s: 1.5, facing: 1, pose: { a: 'stand', b: 'shrug', k: S(lt, TT.dark + 0.4, TT.dark + 1.2) }, t: lt, expr: { eyes: 'worry', look: 'fwd' }, props: { scarf: true, beanie: true } };
  hero(g, cam, H, o, st);
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, {});
}

// ------------------------------------------------------------------ animals (flat silhouettes with a little light)
function owl(g, x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#4a3326'; g.fillRect(-120, 0, 240, 22);           // perch
  g.fillStyle = '#6b4a36'; g.strokeStyle = '#2b1c13'; g.lineWidth = 5;
  g.beginPath(); g.ellipse(0, -70, 52, 74, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#c9a07a'; g.beginPath(); g.ellipse(0, -52, 32, 48, 0, 0, TAU); g.fill();
  g.save(); g.translate(0, -140); g.rotate(0.12 * Math.sin(t * 0.8));
  g.fillStyle = '#6b4a36'; g.beginPath(); g.ellipse(0, 0, 56, 46, 0, 0, TAU); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-46, -26); g.lineTo(-58, -64); g.lineTo(-20, -40); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(46, -26); g.lineTo(58, -64); g.lineTo(20, -40); g.closePath(); g.fill(); g.stroke();
  const bl = Math.max(0, 1 - Math.abs(mod(t, 3.4) - 1.7) / 0.07);
  for (const ex of [-22, 22]) {
    g.fillStyle = '#ffe9a0'; g.strokeStyle = '#2b1c13'; g.lineWidth = 4; g.beginPath(); g.ellipse(ex, -4, 18, 18 * (1 - bl * 0.9), 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#1b1208'; g.beginPath(); g.arc(ex + 2, -4, 7, 0, TAU); g.fill();
  }
  g.fillStyle = '#e89a2a'; g.beginPath(); g.moveTo(-8, 8); g.lineTo(8, 8); g.lineTo(0, 26); g.closePath(); g.fill(); g.stroke();
  g.restore(); g.restore();
}
function fox(g, x, y, s, ph, f) {
  g.save(); g.translate(x, y); g.scale(s * f, s);
  g.fillStyle = '#e0702a'; g.strokeStyle = '#4a1c08'; g.lineWidth = 5; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-70, -60); g.quadraticCurveTo(-170, -80 + 12 * Math.sin(ph), -210, -20 + 20 * Math.sin(ph * 0.7)); g.quadraticCurveTo(-150, -20, -64, -34); g.closePath(); g.fill(); g.stroke();   // tail
  g.fillStyle = '#fff2e0'; g.beginPath(); g.ellipse(-200, -22 + 18 * Math.sin(ph * 0.7), 18, 13, 0, 0, TAU); g.fill();
  g.fillStyle = '#e0702a'; g.beginPath(); g.ellipse(0, -62, 80, 40, 0, 0, TAU); g.fill(); g.stroke();
  for (let i = 0; i < 4; i++) { const lx = -48 + i * 32, sw = Math.sin(ph * 2 + i * 1.6) * 16; g.strokeStyle = '#4a1c08'; g.lineWidth = 11; g.lineCap = 'round'; g.beginPath(); g.moveTo(lx, -34); g.lineTo(lx + sw, -2); g.stroke(); }
  g.fillStyle = '#e0702a'; g.strokeStyle = '#4a1c08'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(52, -86); g.lineTo(126, -64); g.lineTo(58, -34); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(58, -88); g.lineTo(62, -122); g.lineTo(84, -92); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#fff2e0'; g.beginPath(); g.moveTo(98, -62); g.lineTo(126, -64); g.lineTo(88, -46); g.closePath(); g.fill();
  g.fillStyle = '#10101a'; g.beginPath(); g.arc(122, -64, 5, 0, TAU); g.fill(); g.beginPath(); g.arc(88, -72, 5, 0, TAU); g.fill();
  g.restore();
}
function penguin(g, x, y, s, ph, f) {
  g.save(); g.translate(x, y); g.scale(s * f, s); g.rotate(0.06 * Math.sin(ph));
  g.fillStyle = '#10142e'; g.strokeStyle = '#05061a'; g.lineWidth = 4;
  g.beginPath(); g.ellipse(0, -70, 44, 70, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#f2f4ff'; g.beginPath(); g.ellipse(6, -58, 28, 52, 0, 0, TAU); g.fill();
  g.fillStyle = '#10142e'; g.beginPath(); g.ellipse(-34, -64, 11, 36, 0.3, 0, TAU); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(14, -112, 7, 0, TAU); g.fill(); g.fillStyle = '#10142e'; g.beginPath(); g.arc(16, -112, 3, 0, TAU); g.fill();
  g.fillStyle = '#ff9a2a'; g.beginPath(); g.moveTo(24, -104); g.lineTo(46, -98); g.lineTo(24, -92); g.closePath(); g.fill();
  g.fillStyle = '#ff9a2a'; g.beginPath(); g.ellipse(-8, 2, 16, 6, 0, 0, TAU); g.ellipse(20, 2, 16, 6, 0, 0, TAU); g.fill();
  g.restore();
}
function aurora(g, t, a) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let b = 0; b < 3; b++) {
    const gr = g.createLinearGradient(0, 120, 0, 520);
    gr.addColorStop(0, 'rgba(80,255,170,0)'); gr.addColorStop(0.5, 'rgba(80,255,170,' + 0.34 * a + ')'); gr.addColorStop(1, 'rgba(150,90,255,0)');
    g.fillStyle = gr; g.beginPath();
    for (let i = 0; i <= 48; i++) { const x = i / 48 * 1920, y = 250 + b * 60 + 60 * Math.sin(i * 0.32 + t * 0.5 + b * 2) + 22 * Math.sin(i * 0.9 - t * 0.9); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    for (let i = 48; i >= 0; i--) { const x = i / 48 * 1920, y = 250 + b * 60 + 60 * Math.sin(i * 0.32 + t * 0.5 + b * 2) + 22 * Math.sin(i * 0.9 - t * 0.9) + 260 + 40 * Math.sin(i * 0.5 + t * 0.7); g.lineTo(x, y); }
    g.closePath(); g.fill();
  }
  g.restore();
}
function rooster(g, x, y, s, t, crow) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = '#2a1608'; g.lineWidth = 5; g.lineJoin = 'round'; g.lineCap = 'round';
  for (let i = 0; i < 4; i++) { g.fillStyle = ['#c43a2a', '#e08a2a', '#2f8a5a', '#2a63c9'][i]; g.beginPath(); g.moveTo(-40, -110); g.quadraticCurveTo(-120 - i * 10, -170 - i * 26, -90 + i * 12, -250 + i * 8); g.quadraticCurveTo(-70, -170, -30, -96); g.closePath(); g.fill(); g.stroke(); }
  g.fillStyle = '#d9792a'; g.beginPath(); g.ellipse(0, -90, 64, 54, 0, 0, TAU); g.fill(); g.stroke();
  g.strokeStyle = '#a8541a'; g.lineWidth = 8; g.beginPath(); g.moveTo(-14, -40); g.lineTo(-16, 0); g.moveTo(18, -40); g.lineTo(20, 0); g.stroke();
  g.save(); g.translate(30, -150 - 8 * crow); g.rotate(-0.35 * crow);
  g.fillStyle = '#d9792a'; g.strokeStyle = '#2a1608'; g.lineWidth = 5; g.beginPath(); g.ellipse(0, 0, 38, 36, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#d02a2a'; g.beginPath(); g.arc(-8, -38, 14, 0, TAU); g.arc(8, -42, 16, 0, TAU); g.arc(24, -34, 12, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#f0b020'; g.beginPath(); g.moveTo(30, -10 - 6 * crow); g.lineTo(70, -4 - 12 * crow); g.lineTo(32, 2); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(32, 4); g.lineTo(66, 10 + 10 * crow); g.lineTo(30, 14); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(14, -8, 8, 0, TAU); g.fill(); g.fillStyle = '#10101a'; g.beginPath(); g.arc(16, -8, 3.4, 0, TAU); g.fill();
  g.restore(); g.restore();
}
function cowSil(g, x, y, s, f) {
  g.save(); g.translate(x, y); g.scale(s * f, s);
  g.fillStyle = '#f3f1f6'; g.strokeStyle = '#1c1c2e'; g.lineWidth = 5; g.lineJoin = 'round';
  g.beginPath(); g.ellipse(0, -110, 110, 62, 0, 0, TAU); g.fill(); g.stroke();
  for (const lx of [-70, -34, 40, 76]) { g.fillRect(lx - 9, -66, 18, 66); g.strokeRect(lx - 9, -66, 18, 66); }
  g.fillStyle = '#2a2a3a'; g.beginPath(); g.ellipse(-30, -124, 30, 20, 0.3, 0, TAU); g.ellipse(46, -96, 26, 18, -0.2, 0, TAU); g.fill();
  g.fillStyle = '#f3f1f6'; g.beginPath(); g.ellipse(120, -132, 40, 34, -0.2, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#f2b6c0'; g.beginPath(); g.ellipse(144, -120, 20, 14, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#10101a'; g.beginPath(); g.arc(118, -142, 5, 0, TAU); g.fill();
  g.restore();
}

// ------------------------------------------------------------------ SHOT E1  (n5 a)  night farm: the owl is awake, a fox is out
function shotE1(g, lt, H) {
  const o = { scene: 'farm', cloud: 0.1, t: lt };
  const cam = { x: 920, y: 573, z: camPush(lt, CUT.E1, CUT.E2, 1.5, 1.62), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  layer(g, cam, () => {
    owl(g, 1330, GY - 120, 1.6, lt);
    const fx = 380 + 520 * easeInOut(E(lt, CUT.E1 + 0.2, CUT.E2 - 0.3));
    fox(g, fx, GY + 6, 0.9, lt * 7, 1);
  });
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, {});
}
// SHOT E2 (n5 b) polar night: aurora, penguins on ice
function shotE2(g, lt, H) {
  const gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, '#040a24'); gr.addColorStop(0.7, '#0f1c4a'); gr.addColorStop(1, '#2a3f7a');
  g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080); starsBg(g, lt, 0.85);
  aurora(g, lt, 1);
  moonIcon(g, 1500, 190, 44, 0.95);
  g.fillStyle = '#c8dcf5'; g.beginPath(); g.moveTo(0, 790); g.quadraticCurveTo(480, 740, 960, 790); g.quadraticCurveTo(1440, 840, 1920, 770); g.lineTo(1920, 1080); g.lineTo(0, 1080); g.closePath(); g.fill();
  g.fillStyle = '#e8f2ff'; g.beginPath(); g.moveTo(0, 860); g.quadraticCurveTo(600, 820, 1000, 870); g.quadraticCurveTo(1500, 920, 1920, 850); g.lineTo(1920, 1080); g.lineTo(0, 1080); g.closePath(); g.fill();
  const p = (x, y, s, ph, f) => penguin(g, x, y, s, lt * 6 + ph, f);
  p(520, 960, 1.5, 0, 1); p(780, 990, 1.8, 2, 1); p(1080, 970, 1.6, 4, -1); p(1340, 1000, 1.9, 1, -1);
  const a = 0.18 * S(lt, CUT.E2 + 0.4, CUT.E2 + 1.2);
  g.fillStyle = 'rgba(8,10,40,' + a + ')'; g.fillRect(0, 0, 1920, 1080);
  TOD.grade(g, 70, { scene: 'city', frost: 0.3 });
}
// SHOT E3 (n5 c) gag: the rooster crows in the dark; the 24 h clock over its head disagrees
function shotE3(g, lt, H) {
  const o = { scene: 'farm', cloud: 0.1, t: lt };
  const cam = { x: 960, y: 580, z: 1.6, r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const u = lt - (TT.clock24 + 0.15), crow = clamp(Math.sin(Math.PI * clamp(E(mod(Math.max(0, u), 1.9), 0.2, 1.5))) * 1.0);
  layer(g, cam, () => {
    cowSil(g, 1380, GY + 4, 1.25, -1);
    rooster(g, 820, GY + 4, 1.35, lt, crow);
    // sound arcs + a 24-h clock face above the rooster's head
    g.save(); g.globalAlpha = crow; g.strokeStyle = '#ffd23a'; g.lineWidth = 7; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(940, GY - 320, 56 + i * 34, -0.9, 0.5); g.stroke(); }
    g.restore();
    const ca = S(lt, TT.clock24 + 0.5, TT.clock24 + 1.2);
    g.save(); g.globalAlpha = ca; g.translate(640, GY - 480); g.fillStyle = '#f4f6ff'; g.strokeStyle = '#2d3550'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 62, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = '#2d3550'; g.lineWidth = 4; g.lineCap = 'round'; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.beginPath(); g.moveTo(Math.sin(a) * 52, -Math.cos(a) * 52); g.lineTo(Math.sin(a) * 58, -Math.cos(a) * 58); g.stroke(); }
    const ha = (lt - TT.clock24) * 1.6; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(ha) * 38, -Math.cos(ha) * 38); g.stroke(); g.restore();
  });
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, {});
}

// ------------------------------------------------------------------ SHOT F  (n6)  he sleeps eight hours; the moon rises, the HUD races, he wakes: still dark
function shotF(g, lt, H) {
  const o = { scene: 'coast', cloud: 0.1, t: lt };
  const cam = { x: 960, y: 590, z: camPush(lt, CUT.F, CUT.G, 1.5, 1.62), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const down = 1, wake = S(lt, TT.wake, TT.wake + 0.4), still = S(lt, TT.still, TT.still + 0.5);
  const lie = down * (1 - wake);
  let pose = { a: 'stand', b: 'lie', k: lie }, expr = lie > 0.9 ? { eyes: 'closed', sleepZ: 1 } : { eyes: 'droop' };
  if (wake > 0.02) { pose = { a: 'lie', b: 'sitGround', k: wake }; expr = wake < 0.15 ? { eyes: 'closed', sleepZ: 1 } : { eyes: 'wide', look: 'up', sweat: 0.5, lines: still > 0.5 ? 'shock' : null }; }
  const st = { x: 780, y: GY + 60, s: 1.7, facing: 1, pose: pose, t: lt, expr: expr, props: { scarf: true, beanie: true } };
  layer(g, cam, () => {
    // sand mound pillow + 8 hour pips filling as he sleeps
    g.fillStyle = 'rgba(0,0,30,0.35)'; g.beginPath(); g.ellipse(940, GY + 64, 260, 22, 0, 0, TAU); g.fill();
  });
  hero(g, cam, H, o, st, { noShadow: true });
  const J = (lie > 0.5 || wake > 0.02) ? MASCOT.joints(Object.assign({}, st)) : null;
  layer(g, cam, () => { if (J && J.hip) blanket(g, J, 1.7 * 0.62, lie * (1 - wake) + 0.0); });
  // eight pips (hours slept) fill during the time-lapse, over his head
  const fillK = E(lt, TT.lapse0, TT.wake);
  if (lt > TT.lapse0 - 0.2 && lt < TT.wake + 1.2) {
    const pa = S(lt, TT.lapse0 - 0.2, TT.lapse0) * (1 - S(lt, TT.wake + 0.5, TT.wake + 1.2));
    g.save(); g.globalAlpha = pa;
    for (let i = 0; i < 8; i++) { const x = 680 + i * 38, y = 300; rr(g, x, y, 28, 28, 8); g.fillStyle = fillK * 8 > i ? '#ffd23a' : 'rgba(255,255,255,0.22)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(14,16,44,0.9)'; g.stroke(); }
    g.restore();
  }
  TOD.drawForeground(g, cam, H, o);
  finish(g, H, o, lt, {});
  // 42 more: a strip of 42 pips (the hours still to go) appears when he says it
  const fa = S(lt, TT.fortytwo - 0.1, TT.fortytwo + 0.4);
  if (fa > 0.01) {
    g.save(); g.globalAlpha = fa;
    for (let i = 0; i < 42; i++) { const x = 360 + i * 29, y = 980; g.fillStyle = '#9ad0ff'; rr(g, x, y, 19, 34, 6); g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(14,16,44,0.9)'; g.stroke(); }
    g.restore();
  }
}

// ------------------------------------------------------------------ SHOT G  (n7)  on his back, the stars barely move
function shotG(g, lt, H) {
  const o = { scene: 'coast', cloud: 0, t: lt };
  const cam = { x: 960, y: 520, z: 1.45, r: 0 };       // camera raised: more sky
  TOD.drawWorld(g, cam, H, o);
  const wow = S(lt, TT.look + 0.3, TT.look + 1.2);
  const st = { x: 760, y: GY + 20, s: 1.7, facing: 1, pose: 'lie', t: lt, expr: wow > 0.5 ? { eyes: 'star', sparkle: 0.7 } : { eyes: 'normal', look: 'up' }, props: { scarf: true, beanie: true } };
  hero(g, cam, H, o, st, { noShadow: true });
  const J = MASCOT.joints(Object.assign({}, st));
  layer(g, cam, () => { if (J && J.hip) blanket(g, J, 1.7 * 0.62, 1); });
  TOD.drawForeground(g, cam, H, o);
  TOD.stars(g, H, 1, { t: lt });
  finish(g, H, o, lt, {});
}

// ------------------------------------------------------------------ chapter entry
window.CH.c5 = {
  draw: function (g, lt, dur) {
    lt = clamp(lt, 0, END);
    if (!window.__c5warm) { window.__c5warm = true; try { if (TOD.warm) TOD.warm(); } catch (e) {} }
    const H = hOf(lt);
    const Hw = lt < CUT.B ? H_A0 + (H_A1 - H_A0) * easeInOut(E(lt, 0, CUT.B)) : lt < CUT.F ? 66 : H;   // sky time for the cutaways (night)
    g.save();
    try {
      if (lt < CUT.B) shotA(g, lt, H);
      else if (lt < CUT.C1) shotB(g, lt, 70);
      else if (lt < CUT.C2) shotC1(g, lt, 64);
      else if (lt < CUT.D) shotC2(g, lt, 64);
      else if (lt < CUT.D2) shotD(g, lt, 64);
      else if (lt < CUT.E1) shotD2(g, lt, 64);
      else if (lt < CUT.E2) shotE1(g, lt, 66);
      else if (lt < CUT.E3) shotE2(g, lt, 66);
      else if (lt < CUT.F) shotE3(g, lt, 66);
      else if (lt < CUT.G) shotF(g, lt, H);
      else shotG(g, lt, H);
    } catch (e) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#0a1030'; g.fillRect(0, 0, 1920, 1080);
      if (!window.__c5err) { window.__c5err = 1; console.error('c5 draw error', e && e.stack || e); }
    }
    void Hw;
    g.restore();
    g.save(); hudDraw(g, lt, H); g.restore();
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },
  T: { TT: TT, CUT: CUT, END: END, d: VO, H: { A0: H_A0, A1: H_A1, L1: H_L1, G1: H_G1 } }, _h: hOf, _hudA: hudA
};
})();
