// ch/c8.js - Chapter 8 "Wrap" (26.6 s). Frame = pure function of local time lt. Hard cuts between shots (no fades of its own; full.js dips in at 0.2 s and fades the last 1.4 s).
// HUD is gone. Shots: A sunrise hill, '?' (e1) | B1 power that never stops, B2 shaded farm, B3 artificial-light sleep room, B4 shrug (e2) |
//   C the familiar 24-hour day fits life: calm dial, host happy in bed (e3) | D like + subscribe buttons (e4, no long text), then a calm held frame with a small wave. The old "next video" teaser (e5) was removed on request: the film ends after the subscribe line.
// Hedge kept: "some could adapt ... nobody knows how well it would work" -> three adaptation vignettes, then an honest shrug + '?'.
(function () {
'use strict';
window.CH = window.CH || {};
const LAY = LAYOUT.c8, VO = {};
LAY.vo.forEach((v) => { VO[v.id] = v; });
const e1 = VO.e1, e2 = VO.e2, e3 = VO.e3, e4 = VO.e4;
const tAt = (v, s) => { const i = v.text.indexOf(s); return v.start + v.dur * (Math.max(0, i) / v.text.length); };
const END = LAY.dur;
const TT = {
  q: tAt(e1, 'could people'), power: tAt(e2, 'Power that'), farms: tAt(e2, 'Shaded farms'), sleep: tAt(e2, 'Sleep schedules'), nobody: tAt(e2, 'But nobody'),
  surprise: tAt(e3, 'the real surprise'), fit: tAt(e3, 'good fit'),
  like: tAt(e4, 'hit like'), sub: tAt(e4, 'subscribe')
};
const CUT = { B1: e2.start - 0.12, B2: TT.farms - 0.12, B3: TT.sleep - 0.12, B4: TT.nobody - 0.2, C: e3.start - 0.12, D: e4.start - 0.12 };
const E = (t, a, b) => clamp((t - a) / (b - a));
const S = (t, a, b) => smooth(E(t, a, b));
const mod = (a, n) => ((a % n) + n) % n;
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const GY = 820;
const FONT = '"Bahnschrift SemiBold","Segoe UI Black",sans-serif';
const camPush = (lt, a, b, z0, z1) => z0 + (z1 - z0) * easeInOut(E(lt, a, b));
const H_SUN = 101.2;     // just after the new sunrise (HUD is gone; this only drives the sky light)

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
function numText(g, txt, x, y, size, fill, stroke) {
  g.save(); g.font = 'bold ' + size + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = stroke || '#0c1232'; g.strokeText(txt, x, y); g.fillStyle = fill || '#fff'; g.fillText(txt, x, y); g.restore();
}
function indoorBg(g, wall, floor, y0) {
  let gr = g.createLinearGradient(0, 0, 0, y0); gr.addColorStop(0, wall[0]); gr.addColorStop(1, wall[1]); g.fillStyle = gr; g.fillRect(0, 0, 1920, y0);
  gr = g.createLinearGradient(0, y0, 0, 1080); gr.addColorStop(0, floor[0]); gr.addColorStop(1, floor[1]); g.fillStyle = gr; g.fillRect(0, y0, 1920, 1080 - y0);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y0 - 6, 1920, 12);
}
function finish(g, H, o) { TOD.grade(g, H, o); }

// ------------------------------------------------------------------ SHOT A  (e1)  sunrise on the coast; the question
function shotA(g, lt) {
  const o = { scene: 'coast', cloud: 0.15, t: lt };
  const cam = { x: 960, y: 575, z: camPush(lt, 0, CUT.B1, 1.5, 1.62), r: 0 };
  TOD.drawWorld(g, cam, H_SUN, o);
  const st = { x: 760, y: GY, s: 1.55, facing: 1, pose: { a: 'stand', b: 'point', k: S(lt, 0.2, 0.9) * 0.6 }, t: lt, expr: { eyes: 'normal', look: 'upfwd', pop: lt > TT.q ? '?' : null, popT: TT.q, popDur: 1.9 }, props: { scarf: true, beanie: false }, at: { x: 1500, y: 560 } };
  hero(g, cam, H_SUN, o, st);
  TOD.drawForeground(g, cam, H_SUN, o);
  finish(g, H_SUN, o);
}

// ------------------------------------------------------------------ SHOT B1  power that never stops: battery bank + cable, pulses flow to a lit house
function houseLit(g, x, y, s, lit) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#d9c0a0'; g.strokeStyle = '#4a3a2a'; g.lineWidth = 5; g.fillRect(-90, -120, 180, 120); g.strokeRect(-90, -120, 180, 120);
  g.fillStyle = '#a8483a'; g.beginPath(); g.moveTo(-110, -120); g.lineTo(0, -210); g.lineTo(110, -120); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = lit ? '#ffe9a0' : '#3a4468'; g.fillRect(-60, -90, 44, 44); g.fillRect(16, -90, 44, 44); g.strokeRect(-60, -90, 44, 44); g.strokeRect(16, -90, 44, 44);
  if (lit) { g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(0, -68, 10, 0, -68, 160); rg.addColorStop(0, 'rgba(255,220,120,0.5)'); rg.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = rg; g.fillRect(-170, -230, 340, 340); }
  g.restore();
}
function shotB1(g, lt) {
  indoorBg(g, ['#16224f', '#2b3a7a'], ['#1c2a58', '#0e1634'], 760); for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(hash1(i) * 1920, hash1(i + 9) * 460, 2.4, 2.4); }
  const a = S(lt, CUT.B1, CUT.B1 + 0.5);
  // battery bank (left), cable across, houses (right)
  g.save(); g.globalAlpha = a;
  for (let i = 0; i < 3; i++) { g.save(); g.translate(240 + i * 170, 740); rr(g, -60, -190, 120, 190, 14); g.fillStyle = '#3a4468'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#e8ecf8'; g.stroke(); for (let k = 0; k < 4; k++) { g.fillStyle = '#7be07a'; rr(g, -42, -170 + k * 40, 84, 28, 6); g.fill(); } g.fillStyle = '#e8ecf8'; g.fillRect(-18, -208, 36, 18); g.restore(); }
  g.strokeStyle = '#232a4a'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(700, 560); g.quadraticCurveTo(1100, 470, 1380, 640); g.stroke();
  g.strokeStyle = '#8a93b8'; g.lineWidth = 5; g.stroke();
  const n = 10;
  for (let i = 0; i < n; i++) { const u = mod(lt * 0.35 + i / n, 1), x = (1 - u) * (1 - u) * 700 + 2 * (1 - u) * u * 1100 + u * u * 1380, y = (1 - u) * (1 - u) * 560 + 2 * (1 - u) * u * 470 + u * u * 640; g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill(); }
  houseLit(g, 1520, 780, 1.4, true); houseLit(g, 1760, 800, 1.0, true);
  // a generator beside the battery bank (power "that never stops" has more than one source)
  g.save(); g.translate(640, 790); rr(g, -60, -60, 120, 60, 10); g.fillStyle = '#e8b84a'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#6a4a10'; g.stroke(); g.fillStyle = '#ff7a2a'; g.beginPath(); g.moveTo(0, -112); g.quadraticCurveTo(20 + 5 * Math.sin(lt * 9), -90, 0, -64); g.quadraticCurveTo(-20, -90, 0, -112); g.fill(); g.restore();
  g.restore();
  MASCOT.draw(g, { x: 1130, y: 820, s: 1.55, facing: 1, pose: { a: 'stand', b: 'point', k: S(lt, CUT.B1 + 0.3, CUT.B1 + 0.9) }, t: lt, expr: { eyes: 'happy' }, props: { scarf: true, beanie: true }, at: { x: 1500, y: 620 }, shadow: false, pal: TOD.heroPal(70, { scene: 'city' }) });
  TOD.grade(g, 70, { scene: 'city' });
}

// ------------------------------------------------------------------ SHOT B2  shaded farm: a canopy over the rows, sun beating on the bare field beside
function shotB2(g, lt) {
  const o = { scene: 'farm', cloud: 0.1, t: lt };
  const cam = { x: 960, y: 575, z: 1.5, r: 0 };
  const Hf = 118;
  TOD.drawWorld(g, cam, Hf, o);
  layer(g, cam, () => {
    // canopy on posts over the crops
    const a = S(lt, CUT.B2, CUT.B2 + 0.6);
    g.save(); g.globalAlpha = a;
    for (const px of [560, 1200, 1840]) { g.fillStyle = '#5a4a3a'; g.fillRect(px - 8, 520, 16, 300); }
    g.fillStyle = 'rgba(30,40,90,0.45)'; g.strokeStyle = '#2a3260'; g.lineWidth = 6; g.beginPath(); g.moveTo(420, 520); g.lineTo(1980, 480); g.lineTo(1980, 560); g.lineTo(420, 590); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(20,30,70,0.28)'; g.fillRect(420, 590, 1560, 240);
    g.restore();
  });
  const st = { x: 780, y: GY, s: 1.5, facing: 1, pose: { a: 'stand', b: 'thumbsUp', k: S(lt, CUT.B2 + 0.5, CUT.B2 + 1.1) }, t: lt, expr: { eyes: 'happy' }, props: { scarf: true, beanie: false } };
  hero(g, cam, Hf, o, st, { shadowClip: [-3000, 460] });
  TOD.drawForeground(g, cam, Hf, o);
  finish(g, Hf, o);
}

// ------------------------------------------------------------------ SHOT B3  sleep room built around artificial light: warm lamp, curtains, a timer
function shotB3(g, lt) {
  indoorBg(g, ['#3a2a4a', '#5a4260'], ['#6b4a3a', '#3a2a22'], 800);
  const night = S(lt, CUT.B3 + 0.4, CUT.B3 + 1.6);
  // blackout curtains across the window; the window shows blazing daylight
  g.fillStyle = '#ffe9b0'; rr(g, 1100, 200, 520, 380, 16); g.fill(); g.lineWidth = 8; g.strokeStyle = '#2a1c14'; g.stroke();
  g.fillStyle = '#26356e'; g.fillRect(1100, 200, 150 + 220 * night, 380); g.fillRect(1470 - 220 * night + 0, 200, 150 + 220 * night, 380);
  // lamp: warm, dimming into "night", then back on ("morning" schedule)
  const warm = 0.9 - 0.6 * night + 0.5 * S(lt, TT.sleep + 3.0, TT.sleep + 4.0);
  g.save(); g.translate(560, 800); g.fillStyle = '#5a4a3a'; g.fillRect(-8, -230, 16, 230); g.fillStyle = '#c8a06a'; g.beginPath(); g.moveTo(-70, -230); g.lineTo(70, -230); g.lineTo(46, -330); g.lineTo(-46, -330); g.closePath(); g.fill();
  g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(0, -240, 10, 0, -240, 420); rg.addColorStop(0, 'rgba(255,200,110,' + 0.55 * warm + ')'); rg.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = rg; g.fillRect(-460, -700, 920, 900); g.restore();
  // a timer / clock on the wall
  g.save(); g.translate(860, 330); g.fillStyle = '#f4f6ff'; g.strokeStyle = '#2d3550'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 70, 0, TAU); g.fill(); g.stroke(); g.lineWidth = 5; g.lineCap = 'round';
  const ha = (lt - CUT.B3) * 1.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(ha) * 46, -Math.cos(ha) * 46); g.stroke(); g.restore();
  // bed + host sleeping then waking on a schedule
  g.fillStyle = '#e8e0f0'; rr(g, 60, 700, 860, 70, 14); g.fill(); g.fillStyle = '#6a5a8a'; g.fillRect(60, 760, 860, 190); g.fillStyle = '#4a3a6a'; g.fillRect(60, 940, 860, 14);
  g.fillStyle = '#f4f0fa'; rr(g, 90, 650, 190, 70, 30); g.fill();
  const lie = S(lt, CUT.B3 + 0.5, CUT.B3 + 1.2) * (1 - S(lt, TT.sleep + 3.4, TT.sleep + 4.0));
  MASCOT.draw(g, { x: 440, y: 760, s: 2.3, facing: 1, pose: { a: 'stand', b: 'lie', k: lie }, t: lt, expr: lie > 0.8 ? { eyes: 'closed', sleepZ: 1 } : { eyes: 'happy' }, props: { scarf: false }, shadow: false });
  if (lie > 0.5) { g.save(); g.globalAlpha = lie; g.fillStyle = '#4a5aa8'; g.strokeStyle = '#1a1f4a'; g.lineWidth = 5; g.beginPath(); g.moveTo(380, 740); g.quadraticCurveTo(560, 690, 760, 730); g.lineTo(900, 745); g.lineTo(900, 790); g.lineTo(380, 790); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  TOD.grade(g, 118, { scene: 'city' });
}

// ------------------------------------------------------------------ SHOT B4  honest shrug: nobody knows how well it would work
function shotB4(g, lt) {
  const o = { scene: 'coast', cloud: 0.15, t: lt };
  const cam = { x: 960, y: 575, z: camPush(lt, CUT.B4, CUT.C, 1.55, 1.68), r: 0 };
  TOD.drawWorld(g, cam, H_SUN + 4, o);
  const sh = S(lt, CUT.B4 + 0.3, CUT.B4 + 0.9);
  const st = { x: 900, y: GY, s: 1.6, facing: 1, pose: { a: 'stand', b: 'shrug', k: sh }, t: lt, expr: { eyes: 'normal', look: 'fwd', pop: '?', popT: CUT.B4 + 0.5, popDur: 2.3 }, props: { scarf: true, beanie: false } };
  hero(g, cam, H_SUN + 4, o, st);
  TOD.drawForeground(g, cam, H_SUN + 4, o);
  finish(g, H_SUN + 4, o);
}

// ------------------------------------------------------------------ SHOT C  (e3)  our ordinary 24-hour day is a surprisingly good fit: calm dial, host snug in bed
function dial24(g, x, y, r, lt, calm) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,30,0.25)'; g.beginPath(); g.arc(8, 12, r, 0, TAU); g.fill();
  const gr = g.createLinearGradient(0, -r, 0, r); gr.addColorStop(0, '#8fd0ff'); gr.addColorStop(0.5, '#e8f4ff'); gr.addColorStop(0.5, '#27306a'); gr.addColorStop(1, '#0c1236');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.lineWidth = 9; g.strokeStyle = '#f4f6ff'; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 4; g.lineCap = 'round';
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.beginPath(); g.moveTo(Math.sin(a) * (r - 10), -Math.cos(a) * (r - 10)); g.lineTo(Math.sin(a) * (r - 22), -Math.cos(a) * (r - 22)); g.stroke(); }
  const a = lt * 0.5 * calm; g.strokeStyle = '#ffd23a'; g.lineWidth = 8; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(a) * (r * 0.7), -Math.cos(a) * (r * 0.7)); g.stroke();
  g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(Math.sin(a) * (r * 0.74), -Math.cos(a) * (r * 0.74), 12, 0, TAU); g.fill();
  g.restore();
}
function shotC(g, lt) {
  indoorBg(g, ['#f3dcc0', '#e6c8a0'], ['#b98a5a', '#8a6038'], 800);
  g.fillStyle = '#9ad0ff'; rr(g, 1240, 170, 480, 380, 16); g.fill(); g.lineWidth = 8; g.strokeStyle = '#5a3a22'; g.stroke();
  const skyK = 0.5 + 0.5 * Math.sin(lt * 0.5); g.fillStyle = 'rgba(255,210,90,' + (0.35 + 0.5 * skyK) + ')'; g.beginPath(); g.arc(1480, 300, 58, 0, TAU); g.fill();
  g.strokeStyle = '#5a3a22'; g.lineWidth = 6; g.beginPath(); g.moveTo(1480, 170); g.lineTo(1480, 550); g.moveTo(1240, 360); g.lineTo(1720, 360); g.stroke();
  const a = S(lt, CUT.C, CUT.C + 0.6);
  g.save(); g.globalAlpha = a; dial24(g, 1000, 330, 160, lt, 1); g.restore();
  // bed
  g.fillStyle = '#e8e0f0'; rr(g, 60, 700, 860, 70, 14); g.fill(); g.fillStyle = '#6a8ad0'; g.fillRect(60, 760, 860, 190); g.fillStyle = '#4a6ab0'; g.fillRect(60, 940, 860, 14);
  g.fillStyle = '#f4f0fa'; rr(g, 90, 650, 190, 70, 30); g.fill();
  const up = S(lt, TT.surprise, TT.surprise + 0.8);
  const x = 440;
  MASCOT.draw(g, { x: x, y: 760, s: 2.3, facing: 1, pose: { a: 'lie', b: 'sitGround', k: up }, t: lt, expr: up > 0.3 ? { eyes: 'happy', sparkle: 0.7 * up } : { eyes: 'closed', sleepZ: 0.6 }, shadow: false });
  g.save(); g.globalAlpha = 1 - up; g.fillStyle = '#4a5aa8'; g.strokeStyle = '#1a1f4a'; g.lineWidth = 5; g.beginPath(); g.moveTo(380, 740); g.quadraticCurveTo(560, 690, 760, 730); g.lineTo(900, 745); g.lineTo(900, 790); g.lineTo(380, 790); g.closePath(); g.fill(); g.stroke(); g.restore();
  if (up > 0.02) { g.save(); g.globalAlpha = up; g.translate(1000, 560 - 14 * up); numText(g, '24', 0, 0, 84, '#ffd23a', '#0c1232'); g.restore(); }
  TOD.grade(g, 118, { scene: 'city' });
}

// ------------------------------------------------------------------ SHOT D  (e4)  like + subscribe: simple in-world buttons, the host points (tasteful, no long text)
function likeButton(g, x, y, s, press) {
  g.save(); g.translate(x, y); g.scale(s * (1 - 0.08 * press), s * (1 - 0.08 * press));
  g.fillStyle = 'rgba(0,0,30,0.35)'; g.beginPath(); g.ellipse(6, 20, 130, 112, 0, 0, TAU); g.fill();
  g.fillStyle = '#ff4a4a'; g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 120, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-38, 10); g.lineTo(-38, 64); g.lineTo(-76, 64); g.lineTo(-76, 10); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-30, 10); g.lineTo(0, -70); g.quadraticCurveTo(24, -78, 22, -42); g.lineTo(12, -8); g.lineTo(68, -8); g.quadraticCurveTo(84, -4, 78, 14); g.lineTo(62, 56); g.quadraticCurveTo(58, 66, 44, 66); g.lineTo(-30, 66); g.closePath(); g.fill();
  g.restore();
}
function bellButton(g, x, y, s, ring) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(0.28 * Math.sin(ring * 20) * Math.max(0, 1 - ring));
  g.fillStyle = 'rgba(0,0,30,0.35)'; g.beginPath(); g.ellipse(6, 20, 130, 112, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffd23a'; g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 120, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#0c1232'; g.beginPath(); g.moveTo(-58, 40); g.quadraticCurveTo(-52, -10, -34, -34); g.quadraticCurveTo(0, -78, 34, -34); g.quadraticCurveTo(52, -10, 58, 40); g.closePath(); g.fill(); g.fillRect(-66, 40, 132, 14); g.beginPath(); g.arc(0, 66, 14, 0, TAU); g.fill();
  g.restore();
}
function shotD(g, lt) {
  const o = { scene: 'coast', cloud: 0.15, t: lt };
  const cam = { x: 960, y: 575, z: 1.6, r: 0 };
  TOD.drawWorld(g, cam, H_SUN + 6, o);
  const a1 = spring(lt - (TT.like - 0.1), 150, 14), a2 = spring(lt - (TT.sub - 0.1), 150, 14);
  const pr1 = Math.max(0, 1 - Math.abs(lt - (TT.like + 0.45)) / 0.15), ring = E(lt, TT.sub + 0.4, TT.sub + 1.6);
  if (a1 > 0.01) likeButton(g, 1330, 420, a1, pr1);
  if (a2 > 0.01) bellButton(g, 1640, 420, a2, ring);
  const st = { x: 760, y: GY, s: 1.55, facing: 1, pose: { a: { a: 'stand', b: 'point', k: S(lt, TT.like - 0.2, TT.like + 0.3) * (1 - S(lt, TT.sub + 0.9, TT.sub + 1.4)) }, b: 'wave', k: S(lt, TT.sub + 0.9, TT.sub + 1.4) }, t: lt, expr: { eyes: 'happy' }, props: { scarf: true, beanie: false }, at: { x: lt < TT.sub ? 1330 : 1640, y: 440 } };
  hero(g, cam, H_SUN + 6, o, st);
  TOD.drawForeground(g, cam, H_SUN + 6, o);
  finish(g, H_SUN + 6, o);
}

// ------------------------------------------------------------------ chapter entry
window.CH.c8 = {
  draw: function (g, lt, dur) {
    lt = clamp(lt, 0, END);
    if (!window.__c8warm) { window.__c8warm = true; try { if (TOD.warm) TOD.warm(); } catch (e) {} }
    g.save();
    try {
      if (lt < CUT.B1) shotA(g, lt);
      else if (lt < CUT.B2) shotB1(g, lt);
      else if (lt < CUT.B3) shotB2(g, lt);
      else if (lt < CUT.B4) shotB3(g, lt);
      else if (lt < CUT.C) shotB4(g, lt);
      else if (lt < CUT.D) shotC(g, lt);
      else shotD(g, lt);
    } catch (e) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#0a1030'; g.fillRect(0, 0, 1920, 1080);
      if (!window.__c8err) { window.__c8err = 1; console.error('c8 draw error', e && e.stack || e); }
    }
    g.restore();
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },
  T: { TT: TT, CUT: CUT, END: END, d: VO }
};
})();
