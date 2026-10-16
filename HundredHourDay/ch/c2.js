// ch/c2.js -- Chapter 2 "The Rule" (25.7 s). HUD hidden. Space stage (globe + speed dial + 24->100 pip bar + day/night pin)
// then a hard cut to the host in bed with a "body clock" thought bubble. Pure function of lt. No text on screen.
// Times are derived from LAYOUT.c2 line times (+ character-fraction estimates inside a line). Global namespace: c2_*.
(function () {
'use strict';
window.CH = window.CH || {};

const W = 1920, HT = 1080, D2R = Math.PI / 180;
const LC = LAYOUT.c2, VO = LC.vo;
const vo = (id) => VO.find((v) => v.id === id);
const R1 = vo('r1'), R2 = vo('r2'), R4 = vo('r4'), R5 = vo('r5');
const tAt = (v, s) => v.start + v.dur * (v.text.indexOf(s) / v.text.length);

// ------------------------------------------------------------------ timeline (local seconds)
const T = {
  dial: tAt(R1, 'At the equator'),
  kS: tAt(R2, 'Slow it'),
  kE: tAt(R2, 'of that speed') + 0.25,
  bar: tAt(R2, 'and a full day'),
  bar100: tAt(R2, 'a hundred hours'),
  tilt0: R4.start + 0.15, tilt1: R4.start + 1.65,
  equin: tAt(R4, 'at an equinox'),
  day: tAt(R4, 'fifty hours of day'),
  night: tAt(R4, 'then fifty hours of night'),
  r4end: R4.end,
  cut: R5.start - 0.12,
  tick0: R5.start + 0.2,       // body-clock bubble pops, ticks begin
  tf: tAt(R5, 'twenty-four'),
};
T.tick0 = T.cut + 0.45;                    // ticks start once the bubble has popped
T.tickEnd = T.tf + 0.35;                   // the 24th tick lands just after "twenty-four" (ring flash + startle)
const TICK = (T.tickEnd - T.tick0) / 24;   // seconds per body-clock tick
T.yawn0 = T.cut + 0.55;                    // yawn start
T.dur = LC.dur;
window.c2_T = T;                           // read by ch/c2.build_cues.mjs / debugging

// ------------------------------------------------------------------ globe spin: closed-form-free LUT, independent of t
const OM = { fast: 100, slow: 25, drift: 9 };
let c2_LUT = null;
function c2_omega(t) {
  const ramp = (x, c, h) => smooth((x - (c - h)) / (2 * h));
  const rd = 180 / (T.night - T.day), rn = 180 / (T.r4end - T.night);
  let w = OM.fast;
  w += (OM.slow - OM.fast) * easeInOut(clamp((t - T.kS) / (T.kE - T.kS)));
  w += (OM.drift - OM.slow) * smooth((t - T.tilt0) / 1.0);
  w += (rd - OM.drift) * ramp(t, T.day, 0.12);
  w += (rn - rd) * ramp(t, T.night, 0.12);
  return w;
}
const LDT = 0.01;
function c2_spinA(t) {
  if (!c2_LUT) {
    const N = Math.ceil((LC.dur + 1) / LDT), A = new Float64Array(N + 2);
    for (let i = 1; i <= N + 1; i++) A[i] = A[i - 1] + 0.5 * (c2_omega((i - 1) * LDT) + c2_omega(i * LDT)) * LDT;
    c2_LUT = A;
  }
  const x = clamp(t, 0, LC.dur) / LDT, i = Math.floor(x), f = x - i;
  return c2_LUT[i] * (1 - f) + c2_LUT[i + 1] * f;
}
const norm180 = (x) => ((((x + 180) % 360) + 360) % 360) - 180;
const LON_PIN = 36;                        // pin = Kenya-ish, on the equator

function c2_globe(t) {
  const kt = easeInOut(clamp((t - T.tilt0) / (T.tilt1 - T.tilt0)));
  const A = c2_spinA(t), d0 = 180 - c2_spinA(T.day);
  const dl = d0 + A;                       // pin longitude relative to the centre meridian (deg), increases with time
  const lon = LON_PIN - dl;
  return {
    kt, dl, lon: norm180(lon), lat: lerp(15, 88, kt), R: lerp(330, 350, kt), cx: lerp(1340, 1360, kt), cy: lerp(430, 490, kt),
    sunOff: lerp(-62, -90, kt),
  };
}
function c2_pinXY(G) {
  const p0 = G.lat * D2R, d = G.dl * D2R;
  return { x: G.cx + G.R * Math.sin(d), y: G.cy + G.R * Math.sin(p0) * Math.cos(d), cosc: Math.cos(p0) * Math.cos(d) };
}

// ------------------------------------------------------------------ backgrounds
let c2_bg = null;
function c2_bgCanvas() {
  if (c2_bg) return c2_bg;
  const c = document.createElement('canvas'); c.width = W; c.height = HT; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, HT); gr.addColorStop(0, '#070b24'); gr.addColorStop(0.55, '#101640'); gr.addColorStop(1, '#1d1646');
  g.fillStyle = gr; g.fillRect(0, 0, W, HT);
  const nb = (x, y, r, col) => { const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, col); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, 2 * r, 2 * r); };
  nb(1500, 180, 520, 'rgba(70,60,170,0.20)'); nb(620, 760, 560, 'rgba(60,40,140,0.16)'); nb(1750, 900, 420, 'rgba(30,90,170,0.12)');
  const r = rng(22);
  for (let i = 0; i < 260; i++) { const a = 0.25 + 0.6 * r() * r(); g.fillStyle = `rgba(255,255,255,${a})`; const s = r() < 0.9 ? 1.4 : 2.4; g.fillRect(r() * W, r() * HT, s, s); }
  c2_bg = c; return c;
}
let c2_tw = null;
function c2_twinkle(g, t) {
  if (!c2_tw) { const r = rng(91); c2_tw = []; for (let i = 0; i < 34; i++) c2_tw.push({ x: r() * W, y: r() * HT * 0.9, p: r() * 6.28, f: 0.7 + r() * 1.3, s: 1.6 + r() * 1.8 }); }
  g.fillStyle = '#fff';
  for (const s of c2_tw) { g.globalAlpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.f + s.p)); g.fillRect(s.x, s.y, s.s, s.s); }
  g.globalAlpha = 1;
}

// ------------------------------------------------------------------ small drawing helpers
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function rad(g, x, y, r, stops) { const q = g.createRadialGradient(x, y, 0, x, y, r); for (const s of stops) q.addColorStop(s[0], s[1]); return q; }
function c2_sunIcon(g, x, y, r, a, t) {
  g.save(); g.translate(x, y); g.globalAlpha = a;
  g.fillStyle = rad(g, 0, 0, r * 2.2, [[0, 'rgba(255,210,90,0.55)'], [1, 'rgba(255,210,90,0)']]); g.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4);
  g.strokeStyle = '#ffd25a'; g.lineWidth = r * 0.2; g.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + t * 0.3; g.beginPath(); g.moveTo(Math.cos(an) * r * 1.3, Math.sin(an) * r * 1.3); g.lineTo(Math.cos(an) * r * 1.75, Math.sin(an) * r * 1.75); g.stroke(); }
  g.fillStyle = '#ffd25a'; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill();
  g.fillStyle = '#fff2b8'; g.beginPath(); g.arc(-r * 0.25, -r * 0.25, r * 0.55, 0, 6.2832); g.fill();
  g.restore();
}
function c2_moonIcon(g, x, y, r, a, t) {
  g.save(); g.translate(x, y); g.globalAlpha = a;
  g.fillStyle = rad(g, 0, 0, r * 2.2, [[0, 'rgba(150,140,255,0.45)'], [1, 'rgba(150,140,255,0)']]); g.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4);
  g.fillStyle = '#e9e6ff'; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill();
  g.fillStyle = '#8f87e0'; g.beginPath(); g.arc(r * 0.42, -r * 0.18, r * 0.85, 0, 6.2832); g.fill();   // crescent cut (painted)
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#cfc9ff';
  for (let i = 0; i < 3; i++) { const sx = r * (1.55 + i * 0.5), sy = -r * (0.7 - i * 0.55), sc = 0.55 + 0.45 * Math.sin(t * 3 + i * 2); g.globalAlpha = a * (0.5 + 0.5 * sc); g.fillRect(sx - 2.5, sy - 2.5, 5, 5); }
  g.restore();
}

// ------------------------------------------------------------------ space scene pieces
const BAR = { x0: 566, pitch: 12, y: 992, h: 34 };
function c2_pipAppear(i) {
  if (i < 24) return T.bar + i * 0.016;
  const a = T.bar + 0.75, b = T.bar100 + 0.35;
  return a + (i - 24) * (b - a) / 76;
}
function c2_barProg(lt) {            // marker progress across the 100 pips in r4: 0 at the day start, 0.5 at the night start, 1 at the end
  if (lt < T.day) return 0;
  if (lt < T.night) return 0.5 * (lt - T.day) / (T.night - T.day);
  return Math.min(1, 0.5 + 0.5 * (lt - T.night) / (T.r4end - T.night));
}
function c2_drawBar(g, lt) {
  if (lt < T.bar) return;
  const prog = c2_barProg(lt), inR4 = lt > R4.start;
  const cool = smooth((lt - R4.start) / 0.6);
  g.save();
  for (let i = 0; i < 100; i++) {
    const u = lt - c2_pipAppear(i);
    if (u <= 0) continue;
    const sc = spring(u, 420, 21), x = BAR.x0 + i * BAR.pitch;
    let col = i < 24 ? '#cfe0ff' : '#ffb15e';
    if (inR4) {
      const base = mixHex(col, '#6f84bf', cool);
      const passed = lt >= T.day && (i + 0.5) / 100 <= prog;
      col = passed ? (i < 50 ? '#ffcf4a' : '#8a78ff') : base;
    }
    const h = BAR.h * sc * (0.85 + 0.15 * (i % 4 === 0 ? 1.3 : 1));
    g.fillStyle = col; rr(g, x - 3.5, BAR.y - h / 2, 7, Math.max(2, h), 3); g.fill();
    if (inR4 && lt >= T.day && (i + 0.5) / 100 <= prog && Math.abs((i + 0.5) / 100 - prog) < 0.04) { g.globalAlpha = 0.5; g.fillStyle = '#fff'; rr(g, x - 3.5, BAR.y - h / 2, 7, h, 3); g.fill(); g.globalAlpha = 1; }
  }
  // 24-pip bracket right after the first 24 appear (the "normal day")
  const bu = lt - (T.bar + 0.4);
  if (bu > 0 && lt < R4.start - 0.2) {
    const a = smooth(bu / 0.25) * (1 - smooth((lt - (T.bar + 1.4)) / 0.5) * 0.7), x0 = BAR.x0 - 6, x1 = BAR.x0 + 23 * BAR.pitch + 6, y = BAR.y + 30;
    g.globalAlpha = a; g.strokeStyle = '#cfe0ff'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y - 8); g.lineTo(x0, y); g.lineTo(x1, y); g.lineTo(x1, y - 8); g.stroke(); g.globalAlpha = 1;
  }
  // marker (playhead) in r4
  if (lt >= T.day - 0.2) {
    const a = smooth((lt - (T.day - 0.2)) / 0.2), x = BAR.x0 + prog * 100 * BAR.pitch;
    g.globalAlpha = a; g.fillStyle = '#fff'; rr(g, x - 2, BAR.y - 30, 4, 60, 2); g.fill();
    g.beginPath(); g.moveTo(x - 8, BAR.y - 40); g.lineTo(x + 8, BAR.y - 40); g.lineTo(x, BAR.y - 28); g.closePath(); g.fill(); g.globalAlpha = 1;
  }
  // icons
  const sx = BAR.x0 + 25 * BAR.pitch, mx = BAR.x0 + 75 * BAR.pitch, iy = BAR.y - 62;
  const su = lt - T.day, mu = lt - T.night;
  if (su > 0) c2_sunIcon(g, sx, iy, 17 * spring(su, 300, 16), clamp(su * 4), lt);
  if (mu > 0) c2_moonIcon(g, mx, iy, 17 * spring(mu, 300, 16), clamp(mu * 4), lt);
  g.restore();
}

function c2_drawPin(g, lt, G) {
  const P = c2_pinXY(G), polar = smooth((G.lat - 45) / 30);
  const vis = lerp(clamp((P.cosc + 0.02) / 0.12), 1, polar);
  if (vis <= 0.01) return;
  const lit = P.x < G.cx;
  const hostK = smooth((lt - (T.tilt0 + 0.85)) / 0.1);
  const nx = (P.x - G.cx), ny = (P.y - G.cy), nl = Math.hypot(nx, ny) || 1;
  // marker dot on the surface
  const pulse = 0.5 + 0.5 * Math.sin(lt * 6);
  g.save(); g.globalAlpha = vis;
  g.fillStyle = rad(g, P.x, P.y, 26, [[0, lit ? 'rgba(255,230,120,0.9)' : 'rgba(255,255,255,0.7)'], [1, 'rgba(255,230,120,0)']]); g.fillRect(P.x - 26, P.y - 26, 52, 52);
  if (hostK < 1) {
    // map-pin drop above the surface point (before the tiny host arrives)
    const k = (1 - hostK) * spring(lt - (T.dial - 3.4), 260, 17), a = polar > 0.5 ? Math.atan2(nx, -ny) : 0;
    g.translate(P.x, P.y); g.rotate(a); g.scale(k, k);
    g.fillStyle = '#e8372f'; g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-18, -22, -14, -46, 0, -46); g.bezierCurveTo(14, -46, 18, -22, 0, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -31, 6, 0, 6.2832); g.fill();
  }
  g.restore();
  // tiny host standing on the rim (polar view)
  if (hostK > 0.01 && polar > 0.6) {
    const sP = spring(lt - (T.tilt0 + 0.85), 230, 15) * 0.42, ang = Math.atan2(nx, -ny);
    const asleep = lt > T.night + 0.5, drowsy = lt > T.night;
    const ex = lit ? { eyes: 'happy' } : drowsy ? { eyes: 'droop', sleepZ: asleep ? 0.6 : 0 } : { eyes: 'normal' };
    g.save(); g.translate(P.x, P.y); g.rotate(ang);
    MASCOT.draw(g, { x: 0, y: 0, s: sP, facing: 1, pose: 'stand', t: lt, expr: ex, shadow: false });
    g.restore();
  }
}

function c2_drawSun(g, lt, G) {
  const eq = smooth((lt - T.equin) / 0.5) * (1 - smooth((lt - (T.night + 0.2)) / 0.7));
  const glow = 0.5 + 0.5 * eq;
  g.save(); g.globalCompositeOperation = 'lighter';
  g.fillStyle = rad(g, -90, G.cy, 640, [[0, `rgba(255,196,110,${0.42 * glow})`], [0.4, `rgba(255,150,80,${0.16 * glow})`], [1, 'rgba(255,120,60,0)']]);
  g.fillRect(-730, G.cy - 640, 1280, 1280);
  g.restore();
  if (eq > 0.01) {                                  // parallel rays (equinox: the sun sits in the equator plane)
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = -3; i <= 3; i++) {
      const y = G.cy + i * G.R * 0.23, x1 = G.cx - G.R * Math.sqrt(Math.max(0.02, 1 - (i * 0.23) * (i * 0.23))) + 6;
      const wob = 0.65 + 0.35 * Math.sin(lt * 2.3 + i * 1.7);
      const q = g.createLinearGradient(0, 0, x1, 0); q.addColorStop(0, 'rgba(255,214,120,0)'); q.addColorStop(0.35, `rgba(255,214,120,${0.20 * eq * wob})`); q.addColorStop(1, `rgba(255,236,170,${0.34 * eq * wob})`);
      g.fillStyle = q; g.fillRect(0, y - 7, x1, 14);
    }
    g.restore();
  }
}

function c2_drawStage(g) {
  g.save();
  const q = g.createLinearGradient(0, 960, 0, 1040); q.addColorStop(0, 'rgba(120,150,255,0.0)'); q.addColorStop(1, 'rgba(120,150,255,0.0)');
  g.fillStyle = rad(g, 300, 990, 300, [[0, 'rgba(150,175,255,0.30)'], [1, 'rgba(150,175,255,0)']]);
  g.save(); g.translate(300, 990); g.scale(1, 0.12); g.beginPath(); g.arc(0, 0, 300, 0, 6.2832); g.translate(-300, -990); g.fill(); g.restore();
  g.strokeStyle = 'rgba(190,205,255,0.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(300, 992, 250, 26, 0, 0, 6.2832); g.stroke();
  g.restore();
}

// ------------------------------------------------------------------ host in space
const HS = { x: 300, y: 985, s: 1.75 };
function c2_hostSpace(g, lt, G, P) {
  // intention -> attempt -> reaction, driven by the narration
  const globeAt = { x: G.cx - G.R * 0.8, y: G.cy + 10 };
  const dialAt = { x: 800, y: 420 };
  let pose, expr, at = globeAt, dx = 0, dy = 0, ps = 'point';
  const ud = lt - T.dial;
  if (lt < T.dial - 0.2) {                                   // r1a: "spins once every 24 h" -- eager, points at the globe
    expr = { eyes: 'normal', look: 'fwd' };
    const hop = Math.max(0, Math.sin((lt - 0.3) * 5.2)) * 0 ;
    dy = -hop;
  } else if (lt < T.kS) {                                    // r1b: 1670 km/h -- recoil, then points at the dial
    const rec = Math.exp(-ud * 5) * Math.sin(Math.min(1, ud * 2.2) * Math.PI * 0.5);
    dx = -26 * rec + 0; dy = 0;
    at = ud < 0.5 ? globeAt : dialAt;
    expr = ud < 1.3 ? { eyes: 'wide', lines: 'shock', look: 'fwd' } : ud < 2.6 ? { eyes: 'wide', sweat: 1, look: 'fwd' } : { eyes: 'worry', sweat: 0.9, look: 'fwd' };
  } else if (lt < T.bar) {                                   // r2: dial winds down -- worry melts into relief
    const k = clamp((lt - T.kS) / (T.kE - T.kS));
    at = dialAt;
    const relief = smooth((lt - (T.kE - 0.5)) / 0.4);
    expr = relief > 0.5 ? { eyes: 'closed', sweat: 0.25 * (1 - relief), breath: 1 } : { eyes: 'worry', sweat: 0.9 * (1 - k * 0.8), look: 'fwd' };
    pose = { a: { name: 'point' }, b: 'wipeBrow', k: relief };
  } else if (lt < R4.start) {                                // r2 end: points along the pip bar as it fills
    const sweep = smooth((lt - T.bar) / (T.bar100 + 0.4 - T.bar));
    at = { x: lerp(640, 1500, sweep), y: 960 };
    expr = { eyes: 'happy', look: 'fwd' };
  } else {                                                   // r4: tracks the pin around the rim; day = happy, night = drowsy
    const pin = c2_pinXY(G);
    at = { x: pin.x, y: pin.y - 20 };
    const aim = smooth((lt - R4.start) / 0.5), t0 = T.tilt0 + 0.8;
    if (lt < t0) at = { x: lerp(1500, G.cx - G.R * 0.8, 0), y: 700 };
    const night = smooth((lt - T.night) / 0.5), sleepy = smooth((lt - (T.night + 0.4)) / (T.r4end + 0.4 - (T.night + 0.4)));
    if (lt < T.day) expr = { eyes: 'normal', look: 'fwd' };
    else if (lt < T.night) expr = { eyes: 'happy' };
    else expr = { eyes: 'droop', eyes2: 'closed', k: sleepy * 0.7, look: 'down', sleepZ: sleepy > 0.6 ? 0.5 : 0, sweat: 0 };
    pose = { a: { name: 'point' }, b: 'slump', k: sleepy * 0.55 };
    void aim;
  }
  if (!pose) pose = { name: 'point' };
  MASCOT.draw(g, { x: HS.x + dx, y: HS.y + dy, s: HS.s, facing: 1, pose, at, t: lt, expr });
}

function c2_space(g, lt) {
  const SK = window.c2_skip || {};
  if (!SK.bg) g.drawImage(c2_bgCanvas(), 0, 0);
  if (!SK.tw) c2_twinkle(g, lt);
  const G = c2_globe(lt);
  if (!SK.sun) c2_drawSun(g, lt, G);
  if (!SK.stage) c2_drawStage(g);
  if (SK.globe) { c2_drawBar(g, lt); c2_hostSpace(g, lt, G); return; }
  // globe
  const arrow = smooth((lt - 0.5) / 0.9) * (1 - smooth((lt - (T.kE + 0.3)) / 0.8));
  GLOBE.draw(g, G.cx, G.cy, G.R, { lon: G.lon, lat: G.lat, sunLon: norm180(G.lon + G.sunOff), sunLat: lerp(8, 0, G.kt), spinArrow: arrow, clouds: 0, tNow: lt });
  c2_drawPin(g, lt, G);
  // speed dial
  if (lt >= T.dial) {
    const u = lt - T.dial, k = clamp((lt - T.kS) / (T.kE - T.kS)), sh = smooth((lt - (T.bar + 0.7)) / 0.8);
    const cx = lerp(800, 770, sh), cy = lerp(420, 200, sh), r = lerp(190, 100, sh);
    GLOBE.dial(g, cx, cy, r, { from: 1670, to: 417, pop: clamp(u / 0.5), k, tNow: lt });
  }
  c2_drawBar(g, lt);
  c2_hostSpace(g, lt, G);
}

// ------------------------------------------------------------------ bedroom
const BED = { x0: 640, x1: 1700, top: 820 };           // mattress top y = host feet line
const HB = { x: 1010, y: 818, s: 1.7 };
function c2_window(g, lt) {
  const WX = 150, WY = 150, WW = 470, WH = 470;
  // light behind the glass (sky + sun from TOD) -- scaled so the high sun sits in the panes
  g.save(); g.beginPath(); g.rect(WX, WY, WW, WH); g.clip();
  g.translate(WX + WW / 2, WY + WH / 2); g.scale(0.62, 0.62); g.translate(-1080, -400);
  TOD.drawWorld(g, { x: 900, y: 612, z: 1, r: 0 }, 17.2, { scene: 'city', cloud: 0.25, t: lt });
  g.restore();
  // glass glare
  g.save(); g.beginPath(); g.rect(WX, WY, WW, WH); g.clip(); g.globalAlpha = 0.10; g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(WX, WY + 330); g.lineTo(WX + 250, WY); g.lineTo(WX + 330, WY); g.lineTo(WX, WY + 420); g.closePath(); g.fill(); g.restore();
  // frame
  g.strokeStyle = '#fffaf0'; g.lineWidth = 18; g.strokeRect(WX - 9, WY - 9, WW + 18, WH + 18);
  g.lineWidth = 9; g.beginPath(); g.moveTo(WX + WW / 2, WY); g.lineTo(WX + WW / 2, WY + WH); g.moveTo(WX, WY + WH * 0.5); g.lineTo(WX + WW, WY + WH * 0.5); g.stroke();
  g.fillStyle = '#e6d6bd'; rr(g, WX - 30, WY + WH + 8, WW + 60, 20, 6); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(WX - 30, WY + WH + 26, WW + 60, 4);
  // bare curtain rod (the curtains arrive in the next chapter)
  g.strokeStyle = '#5b4636'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(WX - 70, WY - 54); g.lineTo(WX + WW + 70, WY - 54); g.stroke();
  g.fillStyle = '#5b4636'; g.beginPath(); g.arc(WX - 76, WY - 54, 11, 0, 6.2832); g.arc(WX + WW + 76, WY - 54, 11, 0, 6.2832); g.fill();
  g.lineWidth = 4; g.beginPath(); g.moveTo(WX - 30, WY - 54); g.lineTo(WX - 30, WY - 20); g.moveTo(WX + WW + 30, WY - 54); g.lineTo(WX + WW + 30, WY - 20); g.stroke();
}
function c2_room(g, lt) {
  const q = g.createLinearGradient(0, 0, 0, 905); q.addColorStop(0, '#f2e3cb'); q.addColorStop(1, '#e0c8a8'); g.fillStyle = q; g.fillRect(0, 0, W, 905);
  g.fillStyle = 'rgba(160,110,70,0.07)'; for (let x = 40; x < W; x += 120) g.fillRect(x, 0, 36, 905);      // soft wallpaper stripes
  // floor + skirting
  const f = g.createLinearGradient(0, 905, 0, HT); f.addColorStop(0, '#a77450'); f.addColorStop(1, '#7a4f33'); g.fillStyle = f; g.fillRect(0, 905, W, HT - 905);
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 6; i++) g.fillRect(0, 930 + i * 28, W, 2);
  g.fillStyle = '#fff7e6'; g.fillRect(0, 880, W, 25); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 903, W, 3);
  c2_window(g, lt);
  // picture + bedside table with an off lamp
  g.fillStyle = '#f9f3e6'; rr(g, 1380, 220, 200, 150, 6); g.fill(); g.fillStyle = '#9ec7e8'; g.fillRect(1394, 234, 172, 122); g.fillStyle = '#8bbf7a'; g.beginPath(); g.moveTo(1394, 356); g.lineTo(1450, 290); g.lineTo(1500, 340); g.lineTo(1530, 310); g.lineTo(1566, 356); g.closePath(); g.fill();
  g.fillStyle = '#7b5237'; rr(g, 1740, 760, 150, 145, 8); g.fill(); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(1740, 762, 150, 8); g.fillStyle = '#5e3c28'; g.fillRect(1760, 830, 110, 6);
  g.fillStyle = '#e9d9ff'; g.beginPath(); g.moveTo(1780, 700); g.lineTo(1850, 700); g.lineTo(1870, 755); g.lineTo(1760, 755); g.closePath(); g.fill();
  g.fillStyle = '#7a6a8c'; g.fillRect(1811, 755, 8, 12);
  // sunbeam from the window across the wall/floor (warm, soft)
  g.save(); g.globalAlpha = 0.20; g.fillStyle = '#fff4c8';
  g.beginPath(); g.moveTo(150, 620); g.lineTo(620, 620); g.lineTo(1020, 905); g.lineTo(620, 905); g.closePath(); g.fill();
  g.globalAlpha = 0.30; g.beginPath(); g.moveTo(560, 905); g.lineTo(1010, 905); g.lineTo(1190, 1070); g.lineTo(700, 1070); g.closePath(); g.fill();
  g.restore();
}
function c2_bed(g, lt) {
  const { x0, x1, top } = BED;
  g.fillStyle = 'rgba(0,0,0,0.20)'; g.beginPath(); g.ellipse((x0 + x1) / 2, 930, (x1 - x0) / 2 + 20, 24, 0, 0, 6.2832); g.fill();
  g.fillStyle = '#6b4630'; rr(g, x0 - 6, top + 26, x1 - x0 + 12, 52, 8); g.fill();           // frame
  g.fillStyle = '#583623'; g.fillRect(x0 + 6, top + 70, 26, 66); g.fillRect(x1 - 32, top + 70, 26, 66);
  g.fillStyle = '#6b4630'; rr(g, x0 - 26, top - 190, 40, 270, 14); g.fill(); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x0 - 20, top - 184, 6, 250);   // headboard
  const m = g.createLinearGradient(0, top - 6, 0, top + 34); m.addColorStop(0, '#fbf8ff'); m.addColorStop(1, '#d9d3ee'); g.fillStyle = m; rr(g, x0, top - 2, x1 - x0, 42, 12); g.fill();
}
function c2_quilt(g) {                                  // folded blanket at the foot of the bed, in front of the host's legs? (kept behind: drawn before host)
  const x = 1340, w = x1 => x1;
  g.fillStyle = '#4f6fc9'; rr(g, x, BED.top - 26, BED.x1 - x - 10, 62, 18); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 5; i++) g.fillRect(x + 18 + i * 60, BED.top - 24, 14, 58);
  void w;
}
function c2_yawnMouth(g, J, s, m) {
  if (m <= 0.01) return;
  g.save(); g.translate(J.head.x, J.head.y); g.rotate(J.head.rot); g.scale(s, s);
  const rx = 4.5 + 4.5 * m, ry = 2 + 11 * m, cx = 17, cy = 14.5 + 1.5 * m;
  g.fillStyle = '#7a1a30'; g.strokeStyle = '#f4f0ff'; g.lineWidth = 2.4;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 6.2832); g.fill(); g.stroke();
  g.fillStyle = '#ff9fb2'; g.beginPath(); g.ellipse(cx, cy + ry * 0.45, rx * 0.65, ry * 0.4, 0, 0, 6.2832); g.fill();
  g.restore();
}
function c2_clockFace(g, cx, cy, r, lt) {
  const tk = (lt - T.tick0) / TICK, n = Math.max(0, Math.floor(tk)), fr = tk - n, on = lt >= T.tick0;
  const lap = n % 24, flash = lt >= T.tickEnd ? Math.exp(-(lt - T.tickEnd) * 3.2) : 0;
  g.save(); g.translate(cx, cy);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(4, 8, r + 8, 0, 6.2832); g.fill();
  g.fillStyle = '#fffdf7'; g.beginPath(); g.arc(0, 0, r + 8, 0, 6.2832); g.fill();
  g.fillStyle = rad(g, -r * 0.2, -r * 0.3, r * 1.1, [[0, '#2b3578'], [1, '#141a46']]); g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill();
  for (let i = 0; i < 24; i++) {
    const a = -Math.PI / 2 + (i + 1) * Math.PI / 12, q = i % 6 === 5, lit = on && (i < lap);       // pip i lights when the hand has passed it
    const r0 = r * (q ? 0.66 : 0.74), r1 = r * 0.9;
    g.strokeStyle = lit || flash > 0.2 ? '#ffd25a' : 'rgba(190,205,255,0.45)'; g.lineWidth = q ? 8 : 5.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
  }
  c2_sunIcon(g, 0, -r * 0.38, r * 0.085, 0.9, 0); c2_moonIcon(g, 0, r * 0.4, r * 0.085, 0.85, lt);
  const pop = (on ? 1 : 0), ang = -Math.PI / 2 + (n + (on ? Math.min(1, 1.15 * (1 - Math.pow(1 - Math.min(1, fr * 2.2), 3))) : 0)) * Math.PI / 12 * pop;
  g.save(); g.rotate(ang);
  g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(-r * 0.12, 0); g.lineTo(r * 0.7, 0); g.stroke();
  g.restore();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 9, 0, 6.2832); g.fill();
  if (flash > 0.01) { g.globalAlpha = flash * 0.55; g.strokeStyle = '#fff2b8'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, r + 16 + (1 - flash) * 26, 0, 6.2832); g.stroke(); g.globalAlpha = 1; }
  g.restore();
}
function c2_bubble(g, J, lt) {
  const u = lt - (T.cut + 0.2);
  if (u <= 0) return;
  const k = spring(u, 240, 15), bx = J.head.x + 110, by = J.head.y - 285, r = 118 * k;
  g.save();
  g.fillStyle = '#fffdf7'; g.strokeStyle = '#b9aef0'; g.lineWidth = 4;
  const trail = [[J.head.x + 42, J.head.y - 78, 12], [J.head.x + 62, J.head.y - 128, 19], [J.head.x + 84, J.head.y - 182, 28]];
  for (const t of trail) { g.beginPath(); g.arc(t[0], t[1], t[2] * k, 0, 6.2832); g.fill(); g.stroke(); }
  g.beginPath(); g.arc(bx, by, r + 26 * k, 0, 6.2832); g.fill(); g.stroke();
  g.restore();
  if (k > 0.05) c2_clockFace(g, bx, by, 118 * k, lt);
}
function c2_bed_scene(g, lt) {
  g.save();
  g.translate(800, 560); g.scale(1.38, 1.38); g.translate(-800, -560 + 20);      // medium shot: host and body-clock bubble big
  c2_bed_inner(g, lt);
  g.restore();
}
let c2_roomC = null;
function c2_roomCanvas() {                       // static room + window + bed frame, built once at 1.4x for the zoomed shot
  if (c2_roomC) return c2_roomC;
  const c = document.createElement('canvas'); c.width = Math.round(W * 1.4); c.height = Math.round(HT * 1.4);
  const q = c.getContext('2d'); q.scale(1.4, 1.4);
  c2_room(q, 0); c2_bed(q, 0);
  c2_roomC = c; return c;
}
function c2_bed_inner(g, lt) {
  g.drawImage(c2_roomCanvas(), 0, 0, W, HT);
  const t0 = T.cut;
  // pillow under the head
  g.fillStyle = '#fff'; rr(g, 700, 756, 190, 70, 30); g.fill(); g.fillStyle = 'rgba(120,110,170,0.18)'; rr(g, 710, 800, 170, 22, 10); g.fill();
  c2_quilt(g);
  // host: tired, yawns, then startled awake by the 24th tick
  const yawnU = (lt - T.yawn0), yawnM = yawnU < 0 ? 0 : yawnU < 0.55 ? smooth(yawnU / 0.55) : yawnU < 1.05 ? 1 : yawnU < 1.55 ? 1 - smooth((yawnU - 1.05) / 0.5) : 0;
  const startle = lt >= T.tickEnd ? spring(lt - T.tickEnd, 400, 14) : 0, shake = lt >= T.tickEnd ? Math.exp(-(lt - T.tickEnd) * 6) * Math.sin((lt - T.tickEnd) * 45) : 0;
  const heavy = smooth((lt - (T.yawn0 + 1.5)) / 0.8) * (1 - smooth((lt - T.tickEnd) / 0.08));
  const expr = lt >= T.tickEnd ? { eyes: 'wide', pop: '!', popT: T.tickEnd, look: 'upfwd', sweat: 0.0 } : { eyes: 'droop', eyes2: 'closed', k: Math.max(yawnM, heavy * 0.85), blink: false };
  const st = { x: HB.x, y: HB.y + shake * 3, s: HB.s, facing: 1, pose: 'lie', t: lt, expr: Object.assign(expr, lt >= T.tickEnd ? {} : { sleepZ: 0 }), shadow: false };
  MASCOT.draw(g, st);
  const J = MASCOT.joints(st);
  c2_yawnMouth(g, J, HB.s, yawnM);
  c2_bubble(g, J, lt);
  void t0; void startle;
}

let c2_warmed = false;
// ------------------------------------------------------------------ chapter entry
window.CH.c2 = {
  draw(g, lt, dur) {
    if (!c2_warmed) { c2_warmed = true; try { TOD.warm(); GLOBE.warm(); c2_roomCanvas(); c2_bgCanvas(); } catch (e) { /* ignore */ } }
    g.save(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (lt < T.cut) c2_space(g, lt); else c2_bed_scene(g, lt);
    g.restore(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },
  warm() { try { GLOBE.warm(); TOD.warm(); } catch (e) { /* ignore */ } },
  T: T,
};
})();
