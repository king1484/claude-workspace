// ch/c6.js - Chapter 6 "Weather" (40.1 s). Frame = pure function of local time lt. Hard cuts between shots (no fades of its own).
// Shots: A coast at night, the breeze picks up (w1) | B1 land/sea breeze by day, B2 flips at night, B3 swings last longer (w2) |
//        B4 leaning into the wind, scarf flapping, hat lost (w2 end, mild gag) | C globe: Coriolis shrinks to 1/4, hurricane fails / forms elsewhere (w3) | D storm, ONE possible outcome (w4)
// HUD (monotonic): c5 ended at H62.5 -> a visible time-lapse (clock races) to H70 as the wind picks up, 70 -> 71, HIDDEN for the explanatory
// diagrams/globe (B1..C), then returns at 71 and races to 86 under the building storm (c7 opens with its own time-lapse to 100).
// Hedges kept: the diagrams show the mechanism (loops reversing, swings lasting longer); the "stronger" part is a gentle lean, not a wrecked world;
// the storm shot is framed with a dashed "illustration" border and a '?' - one possible outcome, not a prediction.
(function () {
'use strict';
window.CH = window.CH || {};
const LAY = LAYOUT.c6, VO = {};
LAY.vo.forEach((v) => { VO[v.id] = v; });
const w1 = VO.w1, w2 = VO.w2, w3 = VO.w3, w4 = VO.w4;
const tAt = (v, s) => { const i = v.text.indexOf(s); return v.start + v.dur * (Math.max(0, i) / v.text.length); };
const END = LAY.dur;
const TT = {
  lapse1: 1.9, wind: tAt(w1, 'the wind picks'), notAcc: tAt(w1, 'And that'),
  warm: w2.start + 0.2, day: tAt(w2, 'By day'), night: tAt(w2, 'At night'), longer: tAt(w2, 'With days'), harder: tAt(w2, 'and could blow'),
  slower: w3.start + 0.1, hurr: tAt(w3, 'Hurricanes need'), four: tAt(w3, 'and it would be'), differ: tAt(w3, 'Storms would'), struggle: tAt(w3, 'or struggle'),
  nobody: w4.start + 0.1, expect: tAt(w4, 'But the weather'), flash: w4.end - 1.4
};
const CUT = { B1: w2.start - 0.1, B2: TT.night - 0.1, B3: TT.longer - 0.1, B4: TT.harder - 0.55, C: w3.start - 0.15, D: w4.start - 0.1 };
const H_START = 62.5, H_70 = 70, H_71 = 71, H_END = 86;
const E = (t, a, b) => clamp((t - a) / (b - a));
const S = (t, a, b) => smooth(E(t, a, b));
const mod = (a, n) => ((a % n) + n) % n;
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const GY = 820;
const camPush = (lt, a, b, z0, z1) => z0 + (z1 - z0) * easeInOut(E(lt, a, b));

function hOf(lt) {
  if (lt < CUT.B1) return lt < TT.lapse1 ? H_START + (H_70 - H_START) * easeInOut(E(lt, 0.1, TT.lapse1)) : H_70 + (H_71 - H_70) * E(lt, TT.lapse1, CUT.B1);
  if (lt < CUT.D) return H_71;
  return H_71 + (H_END - H_71) * easeInOut(E(lt, CUT.D, END - 0.2));
}
function hudA(lt) {
  if (lt < CUT.B1) return S(lt, 1.2, 1.6) * (1 - S(lt, CUT.B1 - 0.3, CUT.B1));
  if (lt < CUT.D) return 0;
  return S(lt, CUT.D + 0.1, CUT.D + 0.5);
}
function hudDraw(g, lt, H) {
  const a = hudA(lt); if (a < 0.01) return;
  const race = (lt < TT.lapse1 + 0.1) || lt >= CUT.D;
  TOD.hud(g, H, { alpha: a, pop: lt < CUT.B1 ? E(lt, 1.2, 1.9) : E(lt, CUT.D + 0.1, CUT.D + 0.7), pulse: race ? 0.5 + 0.5 * Math.sin(lt * 14) : (lt < TT.lapse1 + 0.8 ? 0.8 : 0) });
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

// ------------------------------------------------------------------ in-world art
function windStreaks(g, t, a, y0, y1, dir) {
  if (a < 0.01) return;
  dir = dir || 1;
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const sp = 460 + 300 * hash1(i + 70), len = 160 + 160 * hash1(i + 80), y = y0 + (y1 - y0) * hash1(i + 90);
    const p = mod(t * sp + hash1(i + 60) * 2400, 2400 + 400), x = dir > 0 ? -200 + p : 1920 + 200 - p;
    g.strokeStyle = 'rgba(255,255,255,' + (a * (0.3 + 0.4 * hash1(i + 50))) + ')'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + dir * len * 0.3, y - 12, x + dir * len * 0.65, y + 14, x + dir * len, y - 4); g.stroke();
    g.beginPath(); g.arc(x - dir * 12, y - 4, 10, dir > 0 ? Math.PI * 1.55 : Math.PI * 0.2, dir > 0 ? Math.PI * 0.8 + TAU : Math.PI * 1.45); g.stroke();
  }
  g.restore();
}
function leaves(g, t, a) {
  if (a < 0.01) return;
  for (let i = 0; i < 9; i++) {
    const sp = 380 + 220 * hash1(i + 3), p = mod(t * sp + hash1(i + 5) * 2300, 2300), x = -120 + p, y = 380 + 480 * hash1(i + 7) + 60 * Math.sin(t * 3 + i * 2);
    g.save(); g.translate(x, y); g.rotate(t * 5 + i); g.globalAlpha = a; g.fillStyle = i % 2 ? '#5aa84a' : '#c8a02a';
    g.beginPath(); g.ellipse(0, 0, 16, 7, 0, 0, TAU); g.fill(); g.restore();
  }
}
function palmFront(g, x, y, t, gust) {
  g.save(); g.translate(x, y);
  const sw = (Math.sin(t * 1.9) * 0.4 + 0.6) * gust;
  g.strokeStyle = '#7b5632'; g.lineCap = 'round'; g.lineWidth = 30;
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-30 - 22 * sw, -230, -20 - 40 * sw, -430); g.stroke();
  g.translate(-20 - 40 * sw, -430);
  for (let i = 0; i < 9; i++) {
    const base = -2.6 + i * 0.52, flap = Math.sin(t * 3.4 + i * 1.3) * 0.14 * (0.4 + gust) + sw * 0.4, a = base + flap, L = 210;
    const ex = Math.cos(a) * L, ey = Math.sin(a) * L * 0.8 + 60;
    g.fillStyle = i % 2 ? '#1f5a35' : '#2a7040'; g.strokeStyle = '#0f3220'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ex * 0.5, ey * 0.5 - 70, ex, ey); g.quadraticCurveTo(ex * 0.5 + 14, ey * 0.5 - 40, 0, 12); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}
function finish(g, H, o, lt, fx) { fx = fx || {}; TOD.grade(g, H, o); }

// ------------------------------------------------------------------ SHOT A  (w1)  coast at night: time-lapse to hour 70, the wind picks up
function shotA(g, lt, H) {
  const gust = S(lt, TT.wind - 0.2, TT.wind + 1.4);
  const o = { scene: 'coast', cloud: 0.2 + 0.3 * gust, t: lt };
  const cam = { x: 980, y: 575, z: camPush(lt, 0, CUT.B1, 1.5, 1.66), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const hx = 850;
  const pose = { a: 'stand', b: 'hugSelf', k: 0.5 + 0.3 * gust };
  const st = { x: hx, y: GY, s: 1.4, facing: 1, pose: pose, t: lt, expr: { eyes: gust > 0.5 ? 'squint' : 'worry', shiver: 0.25, look: 'fwd', breath: 0.6 }, props: { scarf: { flutter: 1 }, beanie: true } };
  hero(g, cam, H, o, st);
  layer(g, cam, () => { palmFront(g, 1600, GY + 20, lt, 0.15 + 0.85 * gust); });
  TOD.drawForeground(g, cam, H, o);
  windStreaks(g, lt, gust * 0.85, 300, 880, 1);
  leaves(g, lt, gust * 0.9);
  finish(g, H, o, lt, {});
}

// ------------------------------------------------------------------ SHOT B  breeze diagram (cross-section): land, sea, air loop. mode 0 = day (sea -> land), 1 = night (land -> sea)
function loopPt(u, cx, cy, rx, ry) { const a = u * TAU; return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }; }
function breezeDiagram(g, lt, o) {
  // o: {flip 0..1 (0 day,1 night), land (0 cool..1 hot), sea, flow 0..1, swing (draw timeline), t}
  const t = o.t, flip = o.flip;
  const skyT = mixHex('#7cc4ff', '#0a1038', flip), skyB = mixHex('#d6efff', '#2a3a7a', flip);
  let gr = g.createLinearGradient(0, 0, 0, 760); gr.addColorStop(0, skyT); gr.addColorStop(1, skyB); g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080);
  if (flip > 0.5) { g.fillStyle = 'rgba(255,255,255,' + (flip - 0.5) * 1.6 + ')'; for (let i = 0; i < 70; i++) g.fillRect(hash1(i) * 1920, hash1(i + 20) * 520, 2.4, 2.4); }
  // sun / moon over the land
  const sx = 1380, sy = 150;
  if (flip < 0.9) { g.save(); g.globalAlpha = 1 - flip; g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(sx, sy, 62, 0, TAU); g.fill(); g.strokeStyle = '#ffd23a'; g.lineWidth = 8; g.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + t * 0.2; g.beginPath(); g.moveTo(sx + Math.cos(a) * 82, sy + Math.sin(a) * 82); g.lineTo(sx + Math.cos(a) * 112, sy + Math.sin(a) * 112); g.stroke(); } g.restore(); }
  if (flip > 0.1) { g.save(); g.globalAlpha = flip; g.fillStyle = '#eef0ff'; g.beginPath(); g.arc(sx, sy, 56, 0, TAU); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(sx + 28, sy - 12, 48, 0, TAU); g.fill(); g.restore(); }
  // ground: sea (left) and land (right); land colour tracks its temperature, sea stays mild
  const landC = mixHex('#3a4a8a', '#e0793a', o.land), seaC = mixHex('#2a6fd8', '#3a8ad8', 1 - o.sea);
  g.fillStyle = seaC; g.beginPath(); g.moveTo(0, 700); for (let x = 0; x <= 900; x += 30) g.lineTo(x, 700 + 6 * Math.sin(x * 0.03 + t * 2)); g.lineTo(900, 1080); g.lineTo(0, 1080); g.closePath(); g.fill();
  g.fillStyle = landC; g.beginPath(); g.moveTo(900, 700); g.lineTo(1250, 680); g.lineTo(1920, 650); g.lineTo(1920, 1080); g.lineTo(900, 1080); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 9; i++) g.fillRect(40 + i * 96, 760 + 40 * (i % 3), 62, 8);
  // thermometers sunk into each side: land swings, sea barely moves
  const thermo = (x, y, lv, col) => { g.save(); g.translate(x, y); rr(g, -18, -200, 36, 210, 12); g.fillStyle = '#eef3ff'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#1a2250'; g.stroke(); g.fillStyle = col; rr(g, -6, -190 + (1 - lv) * 170, 12, lv * 170 + 14, 6); g.fill(); g.beginPath(); g.arc(0, 10, 18, 0, TAU); g.fill(); g.stroke(); g.restore(); };
  thermo(300, 960, 0.45 + 0.12 * (o.sea - 0.5), '#3a9af0'); thermo(1500, 940, 0.2 + 0.7 * o.land, o.land > 0.5 ? '#ff4a3a' : '#5a8aff');
  // heat shimmer lines above the hot ground / cold glow
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const x = 1250 + i * 120, ph = mod(t * 0.5 + i / 6, 1); g.strokeStyle = 'rgba(255,150,70,' + (o.land > 0.5 ? Math.sin(Math.PI * ph) * 0.7 * (o.land - 0.5) * 2 : 0) + ')'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, 660 - ph * 120); g.lineTo(x + 8 * Math.sin(ph * 9), 620 - ph * 120); g.stroke(); }
  g.restore();
  // the air loop: surface flow runs from the cool side to the hot side (day: sea->land; night: land->sea); it rises over the hot side and returns aloft
  const dir = flip < 0.5 ? 1 : -1, cx = 960, cy = 470, rx = 600, ry = 190, flow = o.flow;
  g.save(); g.globalAlpha = 0.2 * flow; g.strokeStyle = '#ffffff'; g.lineWidth = 56; g.beginPath(); for (let i = 0; i <= 72; i++) { const p = loopPt(i / 72, cx, cy, rx, ry); if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); } g.stroke(); g.restore();
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  const N = 14;
  for (let i = 0; i < N; i++) {
    const ph = (i / N - dir * t * 0.09) * TAU;                      // bottom half = surface flow (cool side -> hot side), top half = return flow aloft
    const x = cx + Math.cos(ph) * rx, y = cy + Math.sin(ph) * ry;
    const ang = Math.atan2(-Math.cos(ph) * ry * dir, Math.sin(ph) * rx * dir);
    g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = flow * (0.6 + 0.4 * Math.sin(ph * 2 + t)); g.strokeStyle = y > cy ? '#7ee8ff' : '#ffd0a0'; g.lineWidth = 11;
    g.beginPath(); g.moveTo(-20, -16); g.lineTo(6, 0); g.lineTo(-20, 16); g.stroke(); g.restore();
  }
  g.restore();
}
function swingTimeline(g, lt, a, t0) {
  if (a < 0.01) return;
  g.save(); g.globalAlpha = a;
  rr(g, 220, 800, 1480, 220, 24); g.fillStyle = 'rgba(8,12,44,0.82)'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#e8ecf8'; g.stroke();
  const wave = (y, cycles, col, lw, prog) => {
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath();
    for (let i = 0; i <= 160; i++) { const u = i / 160; if (u > prog) break; const x = 280 + u * 1360, yy = y - Math.sin(u * cycles * TAU) * 34; if (i) g.lineTo(x, yy); else g.moveTo(x, yy); }
    g.stroke();
  };
  wave(870, 6, 'rgba(160,180,255,0.45)', 6, 1);               // today's short swings
  wave(950, 1.5, '#ffd23a', 9, E(lt, t0, t0 + 1.8));         // long swings
  g.restore();
}
function shotB(g, lt, mode) {
  const o = { t: lt };
  if (mode === 1) {   // day
    const warm = S(lt, TT.warm, TT.warm + 3.0), flow = S(lt, TT.day - 0.2, TT.day + 0.6);
    breezeDiagram(g, lt, { t: lt, flip: 0, land: 0.2 + 0.8 * warm, sea: 0.35, flow: flow });
  } else if (mode === 2) {   // night: everything flips
    const fl = S(lt, TT.night - 0.1, TT.night + 1.0), flow = 1;
    breezeDiagram(g, lt, { t: lt, flip: fl, land: 1 - fl * 0.85, sea: 0.35 + 0.1 * fl, flow: flow });
  } else {
    breezeDiagram(g, lt, { t: lt, flip: 1 - 0.0, land: 0.15, sea: 0.45, flow: 1 });
    swingTimeline(g, lt, S(lt, TT.longer, TT.longer + 0.5), TT.longer + 0.2);
  }
  // the host at the shoreline faces INTO the breeze; his scarf streams the way the air is moving (flips at night)
  const day = mode === 1 ? 1 : mode === 2 ? 1 - S(lt, TT.night - 0.1, TT.night + 1.0) : 0;
  MASCOT.draw(g, { x: 940, y: 698, s: 1.6, facing: day > 0.5 ? -1 : 1, pose: 'stand', t: lt, expr: { eyes: 'squint', look: 'fwd' }, props: { scarf: { flutter: 1.8 }, beanie: day < 0.5 }, pal: TOD.heroPal(day > 0.5 ? 25 : 75, { scene: 'coast' }), shadow: false });
  TOD.grade(g, mode === 1 ? 25 : 75, { scene: 'coast', heat: mode === 1 ? 0.2 : 0 });
  void o;
}

// ------------------------------------------------------------------ SHOT B4  (w2 end)  leaning into a stronger breeze: scarf flaps, the beanie takes off (mild gag)
function shotB4(g, lt, H) {
  const gust = 0.5 + 0.5 * S(lt, CUT.B4, CUT.B4 + 1.2);
  const o = { scene: 'coast', cloud: 0.4, t: lt };
  const cam = { x: 980, y: 575, z: camPush(lt, CUT.B4, CUT.C, 1.55, 1.7), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  const u = lt - (TT.harder + 0.1), lean = 0.25 * gust;
  const st = { x: 760, y: GY, s: 1.5, facing: 1, pose: { name: 'walk', speed: 0.45, amp: 0.8, lean: 0.35 }, t: lt, expr: { eyes: 'squint', look: 'fwd' }, props: { scarf: { flutter: 1.4 }, beanie: u < 0.0 } };
  // facing +1 into the wind coming from the right is the "stronger breeze" side: the host leans into it
  hero(g, cam, H, o, Object.assign(st, { facing: -1, x: 1100 }));
  // beanie blows away to the right after the key line
  if (u >= 0) {
    const bx = 1100 - 20 + 520 * u * u * 0.9 + 60 * u, by = GY - 330 - 160 * u + 120 * u * u;
    layer(g, cam, () => { g.save(); g.translate(bx, by); g.rotate(-u * 9); g.fillStyle = '#2f6fe0'; g.strokeStyle = '#142a66'; g.lineWidth = 4; g.beginPath(); g.ellipse(0, 0, 40, 30, 0, Math.PI, 0); g.fill(); g.stroke(); g.fillStyle = '#9ec0ff'; g.beginPath(); g.arc(0, -30, 11, 0, TAU); g.fill(); g.restore(); });
  }
  layer(g, cam, () => { palmFront(g, 400, GY + 20, lt, 0.9); });
  TOD.drawForeground(g, cam, H, o);
  windStreaks(g, lt, 0.85 * gust, 300, 880, -1);
  leaves(g, lt, 0.8);
  finish(g, H, o, lt, {});
}

// ------------------------------------------------------------------ SHOT C  (w3)  the Coriolis effect shrinks to a quarter; hurricane fails to wind up / forms elsewhere
function coriolisArrow(g, x, y, s, a) {
  g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(s, s);
  g.strokeStyle = '#7ee8ff'; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, 80, -2.2, 0.9); g.stroke();
  g.fillStyle = '#7ee8ff'; const ex = Math.cos(0.9) * 80, ey = Math.sin(0.9) * 80; g.beginPath(); g.moveTo(ex + 28, ey - 14); g.lineTo(ex - 20, ey + 30); g.lineTo(ex - 22, ey - 24); g.closePath(); g.fill();
  g.restore();
}
function shotC(g, lt) {
  g.fillStyle = '#04071c'; g.fillRect(0, 0, 1920, 1080);
  for (let i = 0; i < 110; i++) { g.globalAlpha = 0.4 + 0.5 * hash1(i + 4) * (0.7 + 0.3 * Math.sin(lt * 2 + i)); g.fillStyle = '#fff'; g.fillRect(hash1(i * 3 + 1) * 1920, hash1(i * 5 + 2) * 1080, 2.5, 2.5); } g.globalAlpha = 1;
  const R = 340, cx = 1220, cy = 540;
  const wind = S(lt, TT.slower, TT.slower + 1.2);
  const hur = S(lt, TT.hurr, TT.hurr + 1.0) * 0.55 + 0.45 * S(lt, TT.four, TT.four + 0.6);
  const tear = S(lt, TT.differ - 0.1, TT.struggle + 0.8);
  GLOBE.dayNightSplit(g, cx, cy, R, { lon: 25, lat: 12, sunLon: -55, sunLat: 6, wind: wind, hurricane: hur, tear: tear, tNow: lt });
  // Coriolis arrow: full size at "need", shrinks to a quarter at "four times weaker" (digit 4 as the in-world marker)
  const aPop = S(lt, TT.hurr - 0.1, TT.hurr + 0.5), shrink = easeInOut(E(lt, TT.four, TT.four + 1.0));
  const s = 1.7 * (1 - 0.75 * shrink);
  coriolisArrow(g, 420, 540, s, aPop);
  const k4 = S(lt, TT.four + 0.5, TT.four + 1.2);
  if (k4 > 0.01) { g.save(); g.globalAlpha = k4; g.font = 'bold 110px "Bahnschrift SemiBold","Segoe UI Black",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 14; g.strokeStyle = '#0c1232'; g.strokeText('1/4', 420, 760); g.fillStyle = '#7ee8ff'; g.fillText('1/4', 420, 760); g.restore(); }
  // "forms elsewhere": a faint dashed ghost storm poleward + '?'
  const gh = S(lt, TT.differ, TT.differ + 0.9);
  if (gh > 0.01) {
    g.save(); g.globalAlpha = gh * 0.9; g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.setLineDash([16, 12]); g.beginPath(); g.arc(cx + 130, cy - 210, 70, 0, TAU); g.stroke(); g.setLineDash([]);
    g.font = 'bold 84px "Bahnschrift SemiBold","Segoe UI Black",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = '#0c1232'; g.strokeText('?', cx + 130, cy - 210); g.fillStyle = '#fff'; g.fillText('?', cx + 130, cy - 210);
    g.restore();
  }
  TOD.grade(g, 70, { scene: 'city' });
}

// ------------------------------------------------------------------ SHOT D  (w4)  one possible storm, framed as an illustration (dashed border, '?')
function rain(g, t, a, wind) {
  if (a < 0.01) return;
  g.save(); g.strokeStyle = 'rgba(200,225,255,' + 0.6 * a + ')'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 120; i++) {
    const sp = 1500 + 500 * hash1(i + 1), x = mod(hash1(i + 2) * 2400 - t * 520 * wind, 2400) - 200, y = mod(hash1(i + 3) * 1300 + t * sp, 1300) - 120;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 22 * wind, y + 52); g.stroke();
  }
  g.restore();
}
function shotD(g, lt, H) {
  const storm = S(lt, CUT.D, END - 0.5);
  const o = { scene: 'coast', cloud: 0.3 + 0.7 * storm, t: lt };
  const cam = { x: 980, y: 575, z: camPush(lt, CUT.D, END, 1.55, 1.75), r: 0 };
  TOD.drawWorld(g, cam, H, o);
  // dark rolling cloud bank above the sea
  g.save(); g.globalAlpha = 0.65 * storm; g.fillStyle = '#10162c';
  for (let i = 0; i < 16; i++) { const x = i * 130 - 40 + 30 * Math.sin(lt * 0.4 + i), y = 120 + 80 * Math.sin(i * 1.7 + lt * 0.3); g.beginPath(); g.arc(x, y, 150 + 50 * hash1(i), 0, TAU); g.fill(); }
  g.restore();
  const gust = 0.35 + 0.5 * storm;
  const st = { x: 900, y: GY, s: 1.45, facing: 1, pose: { name: 'walk', speed: 0.3, amp: 0.6, lean: 0.3 }, t: lt, expr: { eyes: 'squint', look: 'fwd', shiver: 0.2 }, props: { scarf: { flutter: 1.2 }, beanie: false } };
  hero(g, cam, H, o, st);
  layer(g, cam, () => { palmFront(g, 1600, GY + 20, lt, gust + 0.3); palmFront(g, 250, GY + 40, lt + 1, gust); });
  TOD.drawForeground(g, cam, H, o);
  rain(g, lt, storm * 0.9, 0.5 + storm);
  windStreaks(g, lt, 0.6 * storm, 300, 880, 1);
  // distant lightning lights the sea near the end
  const lf = Math.max(0, 1 - Math.abs(lt - TT.flash) / 0.12) + 0.5 * Math.max(0, 1 - Math.abs(lt - (TT.flash + 0.28)) / 0.1);
  if (lf > 0.01) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(190,210,255,' + 0.45 * lf + ')'; g.fillRect(0, 0, 1920, 1080); g.restore(); }
  finish(g, H, o, lt, {});
  // illustration frame: dashed border + '?' => a possibility, not a forecast (only after "Nobody knows exactly")
  const fa = S(lt, TT.nobody, TT.nobody + 0.6);
  if (fa > 0.01) {
    g.save(); g.globalAlpha = fa * 0.8; g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.setLineDash([26, 18]); rr(g, 44, 44, 1832, 992, 30); g.stroke(); g.setLineDash([]);
    const pop = spring(lt - (TT.nobody + 0.3), 150, 14);
    g.globalAlpha = fa; g.translate(1790, 150); g.scale(pop, pop); g.fillStyle = '#ffd23a'; g.strokeStyle = '#0c1232'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 64, 0, TAU); g.fill(); g.stroke();
    g.font = 'bold 86px "Bahnschrift SemiBold","Segoe UI Black",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#0c1232'; g.fillText('?', 0, 6);
    g.restore();
  }
}

// ------------------------------------------------------------------ chapter entry
window.CH.c6 = {
  draw: function (g, lt, dur) {
    lt = clamp(lt, 0, END);
    if (!window.__c6warm) { window.__c6warm = true; try { if (TOD.warm) TOD.warm(); } catch (e) {} }
    const H = hOf(lt);
    g.save();
    try {
      if (lt < CUT.B1) shotA(g, lt, H);
      else if (lt < CUT.B2) shotB(g, lt, 1);
      else if (lt < CUT.B3) shotB(g, lt, 2);
      else if (lt < CUT.B4) shotB(g, lt, 3);
      else if (lt < CUT.C) shotB4(g, lt, 75);
      else if (lt < CUT.D) shotC(g, lt);
      else shotD(g, lt, H);
    } catch (e) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#0a1030'; g.fillRect(0, 0, 1920, 1080);
      if (!window.__c6err) { window.__c6err = 1; console.error('c6 draw error', e && e.stack || e); }
    }
    g.restore();
    g.save(); hudDraw(g, lt, H); g.restore();
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },
  T: { TT: TT, CUT: CUT, END: END, d: VO, H: { start: H_START, h70: H_70, h71: H_71, end: H_END } }, _h: hOf, _hudA: hudA
};
})();
