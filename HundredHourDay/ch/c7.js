// ch/c7.js - Chapter 7 "Oceans" (50.4 s). Frame = pure function of local time lt. Hard cuts between shots (no fades of its own; full.js dips in at 0.3 s).
// Shots: A sunrise at hour 100 (o1) | B calendar pages flip over a spinning globe = YEARS cue (o2) | C1 oblate globe, C2 21 km radius bracket (o3) |
//        D water sits in the bulge (o4) | E bulge relaxes, water slides poleward, rock outline stays put, hourglass for rock (o5) |
//        F1 globe sea-level shift, F2 "how far depends on how fast" (? slider), F3 rock relaxes, coastline shifts again (o6) | G new beach, seabed uncovered (o7)
// HUD (monotonic): c6 ended at H86. c7 starts with an explicit time-lapse 86 -> 100 under the first words, HOLDS the digits at 100 (TOD.hud h100: the shared
// hud would wrap 100 to 00) at sunrise, then slides away. Everything after is a different timescale (years), never drawn as if it happened within the 100 hours.
// No invented magnitudes: the only number on the planet is the 21 km radius difference from the narration; sea-level shift is illustrative (a '?' marks the unknown).
(function () {
'use strict';
window.CH = window.CH || {};
const LAY = LAYOUT.c7, VO = {};
LAY.vo.forEach((v) => { VO[v.id] = v; });
const o1 = VO.o1, o2 = VO.o2, o3 = VO.o3, o4 = VO.o4, o5 = VO.o5, o6 = VO.o6, o7 = VO.o7;
const tAt = (v, s) => { const i = v.text.indexOf(s); return v.start + v.dur * (Math.max(0, i) / v.text.length); };
const END = LAY.dur;
const TT = {
  hundred: tAt(o1, 'Hour one'), sunrise: tAt(o1, 'Sunrise'), made: tAt(o1, 'You made'),
  years: tAt(o2, 'years, not hours'), flipEnd: o2.end, biggest: tAt(o2, 'The biggest'),
  notBall: o3.start, bulge: tAt(o3, 'Its spin'), radius: tAt(o3, 'The radius'), km: tAt(o3, 'twenty-one'),
  sit: o4.start + 0.2, spin: tAt(o4, 'held there'),
  slow: o5.start, flow: tAt(o5, 'the water wants'), stiff: tAt(o5, 'But solid rock'), thousands: tAt(o5, 'thousands'),
  slide: o6.start + 0.2, seafloor: tAt(o6, 'uncovering'), flood: tAt(o6, 'and flooding'), howFar: tAt(o6, 'How far'), relax: tAt(o6, 'Eventually'),
  newMap: o7.start
};
const CUT = { B: o2.start - 0.05, C1: o3.start - 0.12, C2: TT.radius - 0.1, D: o4.start - 0.12, E: o5.start - 0.12, F1: o6.start - 0.12, F2: TT.howFar - 0.12, F3: TT.relax - 0.12, G: o7.start - 0.12 };
const H_START = 86;
const E = (t, a, b) => clamp((t - a) / (b - a));
const S = (t, a, b) => smooth(E(t, a, b));
const mod = (a, n) => ((a % n) + n) % n;
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const GY = 820;
const FONT = '"Bahnschrift SemiBold","Segoe UI Black",sans-serif';
const camPush = (lt, a, b, z0, z1) => z0 + (z1 - z0) * easeInOut(E(lt, a, b));

// ------------------------------------------------------------------ clock
const T_HUD100 = 1.15, T_HUD_OUT0 = o1.end + 0.05, T_HUD_OUT1 = o2.start + 0.5;
function hRaw(lt) { return H_START + 14 * easeInOut(E(lt, 0.0, T_HUD100)); }          // 86 -> 100
function hudDraw(g, lt) {
  const out = S(lt, T_HUD_OUT0, T_HUD_OUT1);
  if (out > 0.99) return;
  const h = hRaw(lt), at100 = lt >= T_HUD100;
  g.save(); g.translate(0, -150 * out);
  TOD.hud(g, at100 ? 100 : h, { alpha: 1 - out, pop: E(lt, 0, 0.45), h100: at100, pulse: lt < T_HUD100 ? 0.5 + 0.5 * Math.sin(lt * 16) : Math.max(0, Math.sin(Math.PI * E(lt, T_HUD100, T_HUD100 + 0.9))) });
  g.restore();
}
// sky time for the beach: the clock races up to the sunrise, then the morning rolls on
function skyH(lt) { return lt < T_HUD100 ? hRaw(lt) : 100 + 3.2 * S(lt, T_HUD100, 3.6); }

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
function starsBg(g, t, a) {
  g.save(); g.fillStyle = '#fff';
  for (let i = 0; i < 110; i++) { g.globalAlpha = a * (0.4 + 0.5 * hash1(i + 4)) * (0.7 + 0.3 * Math.sin(t * 2 + i)); g.fillRect(hash1(i * 3 + 1) * 1920, hash1(i * 5 + 2) * 1080, 2.5, 2.5); }
  g.restore();
}
function numText(g, txt, x, y, size, fill, stroke) {
  g.save(); g.font = 'bold ' + size + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = stroke || '#0c1232'; g.strokeText(txt, x, y); g.fillStyle = fill || '#fff'; g.fillText(txt, x, y); g.restore();
}
function questionBadge(g, x, y, k) {
  if (k < 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k); g.fillStyle = '#ffd23a'; g.strokeStyle = '#0c1232'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 58, 0, TAU); g.fill(); g.stroke();
  numText(g, '?', 0, 5, 80, '#0c1232', '#ffd23a'); g.restore();
}
function hourglass(g, x, y, s, k, a) {   // k = 0 full top .. 1 all in the bottom (the slow rock)
  g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(0,0,30,0.35)'; g.beginPath(); g.ellipse(0, 130, 90, 14, 0, 0, TAU); g.fill();
  g.fillStyle = '#e8d6b0'; g.strokeStyle = '#5a3a22'; g.lineWidth = 6;
  g.fillRect(-84, -130, 168, 16); g.strokeRect(-84, -130, 168, 16); g.fillRect(-84, 114, 168, 16); g.strokeRect(-84, 114, 168, 16);
  g.fillStyle = 'rgba(220,240,255,0.35)'; g.strokeStyle = '#c9dcf2'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(-70, -114); g.lineTo(70, -114); g.quadraticCurveTo(70, -20, 8, 0); g.quadraticCurveTo(70, 20, 70, 114); g.lineTo(-70, 114); g.quadraticCurveTo(-70, 20, -8, 0); g.quadraticCurveTo(-70, -20, -70, -114); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#d9a25a'; g.save(); g.beginPath(); g.moveTo(-70, -114); g.lineTo(70, -114); g.quadraticCurveTo(70, -20, 8, 0); g.lineTo(-8, 0); g.quadraticCurveTo(-70, -20, -70, -114); g.closePath(); g.clip();
  g.fillRect(-80, -120 + k * 116, 160, 120); g.restore();
  g.save(); g.beginPath(); g.moveTo(-70, 114); g.lineTo(70, 114); g.quadraticCurveTo(70, 20, 8, 0); g.lineTo(-8, 0); g.quadraticCurveTo(-70, 20, -70, 114); g.closePath(); g.clip();
  g.beginPath(); g.moveTo(-70, 114); g.quadraticCurveTo(0, 114 - 120 * k, 70, 114); g.fill(); g.fillRect(-80, 114 - 40 * k, 160, 40 * k + 2); g.restore();
  if (k > 0.02 && k < 0.98) { g.strokeStyle = '#d9a25a'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 114 - 100 * k); g.stroke(); }
  g.restore();
}
function finish(g, H, o) { TOD.grade(g, H, o); }

// ------------------------------------------------------------------ SHOT A  (o1)  sunrise at the beach: he made it
function shotA(g, lt) {
  const Hs = skyH(lt);
  const o = { scene: 'coast', cloud: 0.15, t: lt };
  const cam = { x: 960, y: 575, z: camPush(lt, 0, CUT.B, 1.5, 1.62), r: 0 };
  TOD.drawWorld(g, cam, Hs, o);
  const cheer = S(lt, TT.made - 0.25, TT.made + 0.15), drop = S(lt, TT.made + 0.9, TT.made + 1.5);
  const sag = 1 - S(lt, 0.6, 1.5);
  let pose = { a: 'stand', b: 'slump', k: 0.7 * sag }, expr = { eyes: 'droop', sweat: 0.4, look: 'fwd' };
  if (cheer > 0.02) { pose = { a: 'stand', b: 'throwArms', k: cheer * (1 - drop * 0.6) }; expr = { eyes: 'happy', sparkle: 0.9 * cheer }; }
  if (drop > 0.02) { pose = { a: 'throwArms', b: 'kneel', k: drop }; expr = { eyes: 'closed', sparkle: 0.5 }; }
  const st = { x: 780, y: GY, s: 1.5, facing: 1, pose: pose, t: lt, expr: expr, props: { scarf: true, beanie: true } };
  hero(g, cam, Hs, o, st);
  TOD.drawForeground(g, cam, Hs, o);
  finish(g, Hs, o);
}

// ------------------------------------------------------------------ SHOT B  (o2)  YEARS: calendar pages flip over a fast-spinning globe (a different timescale from the hour HUD)
function calendarPage(g, x, y, w, h, flip, n) {
  // flip 0..1: page hinged at the top rotates away (scaleY 1 -> 0) revealing the page below
  const pageDraw = (yy, hh, num) => {
    rr(g, x - w / 2, yy, w, hh, 18); g.fillStyle = '#fbf7ec'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#2d3550'; g.stroke();
    g.fillStyle = '#d83a3a'; g.save(); rr(g, x - w / 2, yy, w, hh * 0.2, 18); g.clip(); g.fillRect(x - w / 2, yy, w, hh * 0.2); g.restore();
    g.save(); g.beginPath(); g.rect(x - w / 2, yy + hh * 0.2, w, hh * 0.8); g.clip();
    numText(g, String(num), x, yy + hh * 0.6, hh * 0.46, '#1c2038', '#fbf7ec'); g.restore();
  };
  pageDraw(y, h, n + 1);
  if (flip < 0.99) { g.save(); g.translate(0, y); g.scale(1, 1 - flip * 1.0); g.translate(0, -y); pageDraw(y, h, n); g.restore(); }
}
// callback to the hook's teaser bubble ("Now, remember the oceans?"): the same little tilting sea
function seaCallback(g, cx, cy, r, grow, lt) {
  if (grow <= 0.01) return;
  g.save(); g.translate(cx, cy); g.scale(grow, grow);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(4, 7, r + 10, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r + 8, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
  g.fillStyle = '#d6eeff'; g.fillRect(-r, -r, 2 * r, 2 * r);
  g.rotate(0.32 * Math.sin((lt - CUT.B) * 2.1));
  for (let k = 0; k < 2; k++) {
    const y0 = r * 0.02 + k * 20, amp = 8 - k * 3;
    g.fillStyle = k ? '#1f64b8' : '#3f8fe0'; g.beginPath(); g.moveTo(-r * 1.5, r * 1.5);
    for (let x = -r * 1.5; x <= r * 1.5; x += 8) g.lineTo(x, y0 + amp * Math.sin(x * 0.05 + lt * 3.2 + k * 1.7));
    g.lineTo(r * 1.5, r * 1.5); g.closePath(); g.fill();
  }
  g.restore(); g.restore();
}
function shotB(g, lt) {
  g.fillStyle = '#060a26'; g.fillRect(0, 0, 1920, 1080); starsBg(g, lt, 0.8);
  const u = lt - CUT.B, spin = u * 520 * (0.6 + 0.8 * E(u, 0, 3));
  GLOBE.draw(g, 520, 560, 300, { lon: spin, lat: 14, sunLon: spin - 60, sunLat: 8, tNow: lt, spinArrow: 1, nightLights: true });
  const rate = 3 + 9 * E(u, 0, 3.4), cnt = u * rate, idx = Math.floor(cnt), fr = cnt - idx;
  calendarPage(g, 1330, 330, 560, 560, easeIn(E(fr, 0, 0.7)), idx + 1);
  // a small "YEARS" ribbon (the one text card allowed in this chapter)
  const ra = S(lt, TT.years - 0.4, TT.years + 0.2);
  g.save(); g.globalAlpha = ra; g.translate(1330, 790); rr(g, -190, -50, 380, 100, 20); g.fillStyle = '#ffd23a'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#0c1232'; g.stroke(); numText(g, 'YEARS', 0, 4, 66, '#0c1232', '#ffd23a'); g.restore();
  TOD.grade(g, 30, { scene: 'city' });
  const cb = spring(lt - CUT.B - 0.1, 200, 15) * (1 - S(lt, TT.biggest + 0.2, TT.biggest + 0.6));
  seaCallback(g, 960, 190, 105, cb, lt);
}

// ------------------------------------------------------------------ SHOT C1  (o3 a)  the planet is not a perfect ball: oblate globe with the equator highlighted
function shotC1(g, lt) {
  g.fillStyle = '#060a26'; g.fillRect(0, 0, 1920, 1080); starsBg(g, lt, 0.8);
  const k = S(lt, CUT.C1 + 0.2, TT.bulge + 0.6);
  GLOBE.draw(g, 1000, 560, 320, { lon: 20 + (lt - CUT.C1) * 14, lat: 8, sunLon: -50, sunLat: 6, oblate: k, spinArrow: 1, tNow: lt, nightLights: true });
  // dashed equator ring that bulges
  const ea = S(lt, TT.bulge, TT.bulge + 0.5);
  if (ea > 0.01) { g.save(); g.globalAlpha = ea; g.strokeStyle = '#ffd23a'; g.lineWidth = 7; g.setLineDash([22, 16]); g.lineDashOffset = -lt * 40; g.beginPath(); g.ellipse(1000, 560 + 0.14 * 320 * 0.55, 322 * 1.0, 322 * 0.12, 0, 0, TAU); g.stroke(); g.setLineDash([]); g.restore(); }
  MASCOT.draw(g, { x: 340, y: GY + 20, s: 1.7, facing: 1, pose: { a: 'stand', b: 'point', k: S(lt, TT.bulge, TT.bulge + 0.5) }, t: lt, expr: { eyes: 'wide', look: 'fwd' }, props: { scarf: true, beanie: true }, at: { x: 880, y: 560 }, shadow: false, pal: TOD.heroPal(30, { scene: 'city' }) });
  TOD.grade(g, 30, { scene: 'city' });
}
// SHOT C2 (o3 b) the equatorial radius is ~21 km longer: bracket with the digits 21 (the only number in the planet scenes)
function shotC2(g, lt) {
  g.fillStyle = '#060a26'; g.fillRect(0, 0, 1920, 1080); starsBg(g, lt, 0.8);
  const cx = 1060, cy = 560, R = 320;
  GLOBE.bulgeDiagram(g, cx, cy, R, { k: 0, water: 0, tNow: lt });
  const a = S(lt, CUT.C2 + 0.2, CUT.C2 + 0.8), km = S(lt, TT.km - 0.2, TT.km + 0.5);
  g.save(); g.globalAlpha = a; g.lineCap = 'round'; g.lineWidth = 8;
  g.strokeStyle = '#ffd23a'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 0.86 * R, cy); g.stroke();       // equatorial radius
  g.strokeStyle = '#7ee8ff'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - 0.64 * R); g.stroke();       // polar radius
  g.restore();
  if (km > 0.01) { g.save(); g.globalAlpha = km; numText(g, '21', cx + 0.86 * R + 72, cy - 70, 96, '#ffd23a'); numText(g, 'km', cx + 0.86 * R + 72, cy + 6, 44, '#ffd23a'); g.restore(); }
  MASCOT.draw(g, { x: 360, y: GY + 20, s: 1.7, facing: 1, pose: 'stand', t: lt, expr: { eyes: 'wide', look: 'fwd' }, props: { scarf: true, beanie: true }, shadow: false, pal: TOD.heroPal(30, { scene: 'city' }) });
  TOD.grade(g, 30, { scene: 'city' });
}

// ------------------------------------------------------------------ SHOT D  (o4)  the ocean sits in the bulge, held by the spin
function shotD(g, lt) {
  g.fillStyle = '#060a26'; g.fillRect(0, 0, 1920, 1080); starsBg(g, lt, 0.8);
  const cx = 1060, cy = 560, R = 330;
  const w = S(lt, CUT.D, CUT.D + 0.9);
  GLOBE.bulgeDiagram(g, cx, cy, R, { k: 0, water: w, tNow: lt });
  // spin arrow (curved) around the pole axis
  const sa = S(lt, TT.spin - 0.2, TT.spin + 0.5);
  g.save(); g.globalAlpha = sa; g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.ellipse(cx, cy - 0.64 * R - 60, 120, 34, 0, Math.PI * 1.1, Math.PI * 2.05); g.stroke();
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx + 120, cy - 0.64 * R - 60); g.lineTo(cx + 98, cy - 0.64 * R - 88); g.lineTo(cx + 150, cy - 0.64 * R - 86); g.closePath(); g.fill(); g.restore();
  MASCOT.draw(g, { x: 360, y: GY + 20, s: 1.7, facing: 1, pose: { a: 'stand', b: 'point', k: S(lt, CUT.D + 0.3, CUT.D + 0.8) }, t: lt, expr: { eyes: 'normal', look: 'fwd' }, props: { scarf: true, beanie: true }, at: { x: cx + 0.9 * R, y: cy }, shadow: false, pal: TOD.heroPal(30, { scene: 'city' }) });
  TOD.grade(g, 30, { scene: 'city' });
}

// ------------------------------------------------------------------ SHOT E  (o5)  the spin slows: the bulge of WATER relaxes quickly, the ROCK outline stays; an hourglass for the slow rock
function shotE(g, lt) {
  g.fillStyle = '#060a26'; g.fillRect(0, 0, 1920, 1080); starsBg(g, lt, 0.8);
  const cx = 960, cy = 560, R = 330;
  const k = easeInOut(E(lt, TT.flow - 0.2, TT.stiff + 0.2));
  GLOBE.bulgeDiagram(g, cx, cy, R, { k: k, water: 1, tNow: lt });
  // the rock shell is fixed: ghost outline in grey
  const ga = S(lt, TT.stiff - 0.2, TT.stiff + 0.5);
  if (ga > 0.01) { g.save(); g.globalAlpha = 0.9 * ga; g.strokeStyle = '#d9d2c4'; g.lineWidth = 6; g.setLineDash([18, 12]); g.beginPath(); g.ellipse(cx, cy, 0.86 * R, 0.64 * R, 0, 0, TAU); g.stroke(); g.setLineDash([]); g.restore(); }
  hourglass(g, 1560, 560, 1.3, E(lt, TT.thousands - 0.2, END - 0.1) * 0.0 + E(lt, TT.thousands, TT.thousands + 7), S(lt, TT.stiff - 0.2, TT.stiff + 0.5));
  MASCOT.draw(g, { x: 330, y: GY + 20, s: 1.7, facing: 1, pose: { a: 'stand', b: 'shrug', k: S(lt, TT.stiff + 0.6, TT.stiff + 1.4) }, t: lt, expr: { eyes: 'normal', look: 'fwd' }, props: { scarf: true, beanie: true }, shadow: false, pal: TOD.heroPal(30, { scene: 'city' }) });
  TOD.grade(g, 30, { scene: 'city' });
}

// ------------------------------------------------------------------ SHOT F  (o6)  sea level shifts toward the poles (illustrative), magnitude unknown, then the rock relaxes
function shotF(g, lt, which) {
  g.fillStyle = '#060a26'; g.fillRect(0, 0, 1920, 1080); starsBg(g, lt, 0.8);
  const cx = 1100, cy = 560, R = 340;
  let sea = 0, ghost = 0;
  if (which === 1) sea = 0.7 * easeInOut(E(lt, CUT.F1 + 0.3, TT.flood + 1.6));
  else if (which === 2) sea = 0.7 + 0.1 * Math.sin((lt - CUT.F2) * 1.6);
  else { sea = 0.7 - 0.38 * easeInOut(E(lt, TT.relax, END - 4)); ghost = S(lt, TT.relax - 0.1, TT.relax + 0.6); }
  GLOBE.draw(g, cx, cy, R, { lon: -10, lat: 6, sunLon: 60, sunLat: 4, sea: sea, tNow: lt, nightLights: false, atmo: true });
  if (which === 3 && ghost > 0.01) {   // old coastline is a faint white dashed ring around the equator band
    g.save(); g.globalAlpha = 0.5 * ghost; g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.setLineDash([12, 12]); g.beginPath(); g.ellipse(cx, cy + 0.1 * R, R * 0.995, R * 0.2, 0, 0, TAU); g.stroke(); g.setLineDash([]); g.restore();
  }
  // markers: (1) the exposed equatorial seafloor, (2) flooded polar lowlands
  if (which === 1) {
    const a1 = S(lt, TT.seafloor, TT.seafloor + 0.6), a2 = S(lt, TT.flood, TT.flood + 0.6);
    g.save(); g.lineWidth = 8; g.lineCap = 'round';
    g.globalAlpha = a1; g.strokeStyle = '#ffd23a'; g.beginPath(); g.moveTo(cx - 110, cy + 62); g.lineTo(cx - 110, cy + 130); g.moveTo(cx - 80, cy + 62); g.lineTo(cx - 140, cy + 62); g.stroke();
    g.globalAlpha = a2; g.strokeStyle = '#7ee8ff'; g.beginPath(); g.arc(cx, cy - R * 0.82, 46, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.restore();
  }
  if (which === 2) {
    // the unknown: a slider track whose knob wanders, with a question mark (no numbers)
    const tx0 = 260, tx1 = 760, ty = 880, kn = 0.5 + 0.35 * Math.sin((lt - CUT.F2) * 1.9);
    g.save(); g.lineCap = 'round'; g.strokeStyle = 'rgba(232,236,248,0.7)'; g.lineWidth = 14; g.beginPath(); g.moveTo(tx0, ty); g.lineTo(tx1, ty); g.stroke();
    g.fillStyle = '#ffd23a'; g.strokeStyle = '#0c1232'; g.lineWidth = 6; g.beginPath(); g.arc(tx0 + (tx1 - tx0) * kn, ty, 30, 0, TAU); g.fill(); g.stroke(); g.restore();
    // a small clock icon: how fast the slowdown happens
    g.save(); g.translate(180, ty); g.fillStyle = '#fff'; g.strokeStyle = '#0c1232'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = '#1c2038'; g.lineWidth = 5; g.lineCap = 'round'; const ha = (lt - CUT.F2) * 3.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(ha) * 26, -Math.cos(ha) * 26); g.stroke(); g.restore();
    questionBadge(g, 960, 840, spring(lt - (TT.howFar + 1.0), 150, 14));
  }
  if (which === 3) {   // hourglass: rock slowly relaxing
    hourglass(g, 330, 560, 1.2, E(lt, TT.relax, TT.relax + 6), S(lt, TT.relax - 0.2, TT.relax + 0.4));
  }
  TOD.grade(g, 30, { scene: 'city' });
}

// ------------------------------------------------------------------ SHOT G  (o7)  a different map: the host on a new beach, the old seabed uncovered behind him
function seabed(g, cam, rec, t) {
  if (rec < 0.01) return;
  layer(g, cam, () => {
    const yb = 818, yt = yb - 250 * rec;
    const gr = g.createLinearGradient(0, yt, 0, yb); gr.addColorStop(0, '#7a5a3a'); gr.addColorStop(1, '#a98856');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-600, yb);
    for (let x = -600; x <= 2800; x += 60) g.lineTo(x, yt + 14 * Math.sin(x * 0.012 + 1) + 8 * Math.sin(x * 0.05));
    g.lineTo(2800, yb); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const yy = yt + 30 + i * (yb - yt - 40) / 9; g.beginPath(); for (let x = -600; x <= 2800; x += 40) g.lineTo(x, yy + 6 * Math.sin(x * 0.03 + i)); g.stroke(); }
    // stranded things: a boat on its side, shells, a fish skeleton, rocks
    const k = S(rec, 0.35, 0.8);
    g.save(); g.globalAlpha = k;
    g.save(); g.translate(1320, yt + (yb - yt) * 0.55); g.rotate(-0.35); g.fillStyle = '#c4a46a'; g.strokeStyle = '#5a3a22'; g.lineWidth = 5; g.beginPath(); g.moveTo(-90, -10); g.lineTo(90, -22); g.lineTo(60, 28); g.lineTo(-70, 28); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#e8d6b0'; g.fillRect(-4, -110, 8, 100); g.restore();
    g.fillStyle = '#e8dcc8'; g.strokeStyle = '#8a7656'; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const x = 500 + i * 260, y = yt + (yb - yt) * (0.45 + 0.4 * hash1(i + 2)); g.beginPath(); g.ellipse(x, y, 26, 18, 0.3, 0, TAU); g.fill(); g.stroke(); }
    g.strokeStyle = '#efe6d2'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(900, yt + 120); g.lineTo(1040, yt + 120); for (let i = 0; i < 5; i++) { g.moveTo(930 + i * 26, yt + 120); g.lineTo(930 + i * 26, yt + 96); g.moveTo(930 + i * 26, yt + 120); g.lineTo(930 + i * 26, yt + 144); } g.stroke();
    g.restore();
  });
}
function shotG(g, lt) {
  const Hs = 108;
  const rec = S(lt, CUT.G, END - 2.2);
  const o = { scene: 'coast', cloud: 0.2, t: lt };
  const cam = { x: 980, y: 575, z: camPush(lt, CUT.G, END, 1.5, 1.62), r: 0 };
  TOD.drawWorld(g, cam, Hs, o);
  seabed(g, cam, rec, lt);
  const look = S(lt, CUT.G + 0.4, CUT.G + 1.2);
  const st = { x: 640, y: GY, s: 1.5, facing: 1, pose: { a: 'stand', b: 'point', k: look }, t: lt, expr: { eyes: look > 0.5 ? 'wide' : 'normal', look: 'fwd', sparkle: 0.3 }, props: { scarf: true, beanie: true }, at: { x: 1250, y: 700 } };
  hero(g, cam, Hs, o, st);
  TOD.drawForeground(g, cam, Hs, o);
  finish(g, Hs, o);
}

// ------------------------------------------------------------------ chapter entry
window.CH.c7 = {
  draw: function (g, lt, dur) {
    lt = clamp(lt, 0, END);
    if (!window.__c7warm) { window.__c7warm = true; try { if (TOD.warm) TOD.warm(); if (GLOBE.warm) GLOBE.warm(); } catch (e) {} }
    g.save();
    try {
      if (lt < CUT.B) shotA(g, lt);
      else if (lt < CUT.C1) shotB(g, lt);
      else if (lt < CUT.C2) shotC1(g, lt);
      else if (lt < CUT.D) shotC2(g, lt);
      else if (lt < CUT.E) shotD(g, lt);
      else if (lt < CUT.F1) shotE(g, lt);
      else if (lt < CUT.F2) shotF(g, lt, 1);
      else if (lt < CUT.F3) shotF(g, lt, 2);
      else if (lt < CUT.G) shotF(g, lt, 3);
      else shotG(g, lt);
    } catch (e) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#0a1030'; g.fillRect(0, 0, 1920, 1080);
      if (!window.__c7err) { window.__c7err = 1; console.error('c7 draw error', e && e.stack || e); }
    }
    g.restore();
    g.save(); hudDraw(g, lt); g.restore();
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },
  T: { TT: TT, CUT: CUT, END: END, d: VO, hud: { t100: T_HUD100, out0: T_HUD_OUT0, out1: T_HUD_OUT1 } }, _hRaw: hRaw
};
})();
