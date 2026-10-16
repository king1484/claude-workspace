// shots_b.js — shots 9-19: the pull (lever, tiny worlds, the well, the itch), the shadow, the low point, the silence.

// ================================================================== SHOT 9  (0:45-0:52) the lever: pull-to-refresh becomes a slot machine (visual metaphor)
shot(45, 52, 'S9', (g, lt, t, E) => {
  FEED.slot(g, E, lt, [[0.5, [0, 1, 2]], [2.6, [3, 3, 1]], [4.7, [4, 2, 0]]]);
  SET.vignette(g, E, 0.55); drawGrain(g, 1920, 1080, t, 0.1);
});

// ================================================================== SHOT 10 (0:52-1:00) eight tiny worlds, one per second; the clock jumps between them
const TINTS = [[47, 183, 176], [242, 185, 75], [123, 75, 214], [127, 196, 240], [63, 191, 114], [214, 58, 154], [247, 217, 228], [60, 90, 200]];
shot(52, 60, 'S10', (g, lt, t, E) => {
  const slots = [[2.0, 2.45], [4.0, 4.45], [6.0, 6.45]];
  for (let i = 0; i < slots.length; i++) if (lt >= slots[i][0] && lt < slots[i][1]) {
    stage(g, E, t, { cam: { x: 1185, y: 690, z: 3.2 }, ambient: [6, 8, 14, 0.72], lights: [{ x: 1185, y: 700, r: 300, rgb: [190, 210, 255], a: 0.2, open: 0.9 }], vig: 0.6 });
    return;
  }
  const idx = Math.min(7, Math.floor(lt)), k = lt - idx, sc = 8.1 * (0.93 + 0.07 * spring(k, 300, 20)), tint = TINTS[idx];
  g.fillStyle = '#04060b'; g.fillRect(0, 0, 1920, 1080);
  glow(g, 960, 540, 1000, tint, 0.28, 'screen');
  FEED.phone(g, 960, 540, 0.0, sc, { card: idx, k: 0, t: lt * 1.0 + idx * 3.1, dot: idx === 5 ? 1 : 0 });
  SET.vignette(g, E, 0.5); drawGrain(g, 1920, 1080, t, 0.09);
});

// ================================================================== SHOT 11 (1:00-1:10) the well: he drops a coin; we fall with it past floors of feed; it never lands
function shaftScene(g, E, lt, t) {
  g.fillStyle = '#04060c'; g.fillRect(0, 0, 1920, 1080);
  const scroll = 520 * lt + 70 * lt * lt;
  const wall = g.createLinearGradient(0, 0, 1920, 0); wall.addColorStop(0, '#0b1020'); wall.addColorStop(0.18, '#04060c'); wall.addColorStop(0.82, '#04060c'); wall.addColorStop(1, '#0b1020'); g.fillStyle = wall; g.fillRect(0, 0, 1920, 1080);
  const layer = (f, D, sc, a, seed) => {
    const base = scroll * f;
    for (let i = -1; i < Math.ceil(1180 / D) + 2; i++) {
      const idx = Math.floor(base / D) + i, y = idx * D - base + 40, r = rng(idx * 13 + seed), side = r() < 0.5 ? -1 : 1, x = 960 + side * (230 + r() * 520 * (sc > 0.7 ? 1 : 1.5));
      const w = 190 * sc, h = 340 * sc; g.save(); g.globalAlpha = a; FEED.worldCard(g, idx + seed, x - w / 2, y - h / 2, w, h, t * 0.8 + idx, 18 * sc); g.restore();
      g.fillStyle = `rgba(74,168,255,${0.1 * a})`; g.fillRect(960 + side * 820 * 0.5, y + h * 0.5 + 8, side * -1 * 0, 0);
      g.fillStyle = `rgba(48,70,120,${0.5 * a})`; g.fillRect(side < 0 ? 0 : 1100, y + h / 2 + 10, 820, 6 * sc);                       // ledges
    }
  };
  layer(0.4, 360, 0.42, 0.6, 5); layer(0.7, 520, 0.7, 0.82, 11); layer(1.0, 760, 1.0, 1.0, 19);
  // streaking motes and the falling pull of the dark below
  const r = rng(77); for (let i = 0; i < 40; i++) { const sp = 0.6 + r() * 1.1, y = ((r() * 1300 - scroll * sp * 0.9) % 1300 + 1300) % 1300 - 110, x = r() * 1920; g.fillStyle = `rgba(120,185,255,${0.18 + 0.2 * r()})`; g.fillRect(x, y, 2, 16 + 26 * r()); }
  const dark = g.createLinearGradient(0, 700, 0, 1080); dark.addColorStop(0, 'rgba(2,3,8,0)'); dark.addColorStop(1, 'rgba(2,3,8,0.88)'); g.fillStyle = dark; g.fillRect(0, 700, 1920, 380);
  // the coin: the only warm thing in the feed
  const cx = 960 + Math.sin(lt * 1.3) * 26, cy = 470 + Math.cos(lt * 0.9) * 10, sp = lt * 7, wdt = Math.abs(Math.cos(sp)) * 34 + 3;
  for (let i = 1; i < 11; i++) { g.fillStyle = `rgba(222,190,120,${0.28 * (1 - i / 11)})`; g.beginPath(); g.ellipse(cx, cy - i * 20, wdt * 0.5, 4, 0, 0, TAU); g.fill(); }
  glow(g, cx, cy, 120, [255, 214, 140], 0.55, 'screen');
  g.fillStyle = '#d8b46a'; g.beginPath(); g.ellipse(cx, cy, wdt, 34, 0, 0, TAU); g.fill(); g.fillStyle = '#f0d9a0'; g.beginPath(); g.ellipse(cx - wdt * 0.2, cy - 6, wdt * 0.5, 22, 0, 0, TAU); g.fill();
  SET.vignette(g, E, 0.58); drawGrain(g, 1920, 1080, t, 0.1);
}
shot(60, 70, 'S11', (g, lt, t, E) => {
  if (lt < 1.2) {                      // a quick shot of the coin leaving his hand, then we fall
    const hb = { x: 836, y: 694 }; const cam = { x: 840, y: 700, z: 2.6 }, pose = Object.assign({}, SITPHONE, { hfy: SITPHONE.hfy + pulse(lt, 0.2, 0.5) * -10, bags: 0.8 });
    stage(g, E, t, { cam, ambient: [6, 8, 14, 0.78], chars: [hero(SIT_HIP, pose, t)], charLights: [{ x: hb.x, y: hb.y, r: 330, rgb: BLUE, a: 0.75 }], lights: [{ x: hb.x, y: hb.y, r: 520, rgb: BLUE, a: 0.28, open: 0.95 }], vig: 0.6,
      post: (g2, J) => { phoneSide(g2, J.me.handF.x + 6, J.me.handF.y - 12, -0.12, 0.8); const u = clamp((lt - 0.4) / 0.8); if (u > 0) { const cx = J.me.handF.x + 20, cy = J.me.handF.y + 30 + u * u * 700; g2.fillStyle = '#d8b46a'; g2.beginPath(); g2.ellipse(cx, cy, 14, 14 * Math.abs(Math.cos(u * 12)) + 2, 0, 0, TAU); g2.fill(); glow(g2, cx, cy, 50, [255, 214, 140], 0.5, 'screen'); } } });
    return;
  }
  shaftScene(g, E, lt - 1.2, t);
});

// ================================================================== SHOT 12 (1:10-1:20) the itch: a blue dot, and a thumb with a mind of its own
shot(70, 80, 'S12', (g, lt, t, E) => {
  g.fillStyle = '#04060c'; g.fillRect(0, 0, 1920, 1080); glow(g, 900, 560, 1100, BLUE, 0.22, 'screen');
  const px = 800, py = 540, pw = 440, ph = 880, dot = { x: px - pw / 2 + 0.89 * pw, y: py - ph / 2 + 0.88 * ph };
  // phone
  g.fillStyle = '#07080c'; rr(g, px - pw / 2 - 20, py - ph / 2 - 20, pw + 40, ph + 40, 58); g.fill();
  g.save(); g.translate(px - pw / 2, py - ph / 2); g.scale(pw / 52, ph / 104);
  const slide = lt > 8.2 ? clamp((lt - 8.2) / 0.4) : 0;
  FEED.screen(g, 52, 104, lt, { card: lt > 8.2 ? 3 : 1, k: slide, dot: smooth((lt - 1.4) / 0.4) * (lt > 7.0 ? 0 : 1) }); g.restore();
  // his left hand holds the phone
  g.fillStyle = '#0b0b0f'; g.strokeStyle = 'rgba(110,180,255,0.30)'; g.lineWidth = 4; capsule(g, { x: px - 310, y: py + 470 }, { x: px - 210, y: py + 140 }, 90, 66); g.fill(); g.stroke();
  for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(px - 214 + i * 8, py - 30 + i * 118, 40, 54, 0.18, 0, TAU); g.fill(); g.stroke(); }
  // the thumb
  const B = { x: 1330, y: 1230 }, rest = { x: 1130, y: 1020 };
  const tw = pulse(lt, 2.0, 0.55) * 0.5 + pulse(lt, 3.2, 0.55) * 0.62 + pulse(lt, 4.3, 0.6) * 0.78;
  let k = tw;                                                           // 0 = rest, 1 = on the dot
  const grab = smooth((lt - 4.7) / 0.7), pull = lt >= 5.4 && lt < 6.6 ? 1 : 0, snap = lt >= 6.6 ? spring((lt - 6.6) * 1.0, 420, 16) : 0, tap = pulse(lt, 6.95, 0.25);
  if (lt >= 5.4 && lt < 6.6) k = 0.55 + 0.04 * Math.sin(lt * 40);        // straining toward the dot
  if (lt >= 6.6) k = lerp(0.55, 1.0, clamp(snap)) + 0.0;
  let tip = { x: lerp(rest.x, dot.x + 10, k), y: lerp(rest.y, dot.y + 30, k) };
  if (lt >= 8.0) { const u = easeInOut(clamp((lt - 8.0) / 1.4)); tip = { x: lerp(dot.x + 10, rest.x + 40, u), y: lerp(dot.y + 30, rest.y + 20 + Math.sin(lt * 3) * 12, u) }; }
  g.fillStyle = '#0b0b0f'; g.strokeStyle = 'rgba(110,180,255,0.38)'; g.lineWidth = 4; capsule(g, B, tip, 78, 46); g.fill(); g.stroke();
  // his other hand comes in, grabs the thumb and holds it back
  const hx = lerp(2200, 1290, easeOut(grab)), hy = lerp(760, 1060, easeOut(grab)), out = lt > 6.6 ? easeIn(clamp((lt - 6.9) / 1.0)) : 0, hx2 = hx + out * 900, hy2 = hy - out * 120;
  if (lt > 4.7 && out < 1) { g.fillStyle = '#101015'; g.strokeStyle = 'rgba(110,180,255,0.30)'; g.lineWidth = 4; g.beginPath(); g.ellipse(hx2, hy2, 120, 100, 0.3, 0, TAU); g.fill(); g.stroke(); for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(hx2 - 90 - i * 6, hy2 - 60 + i * 38, 58, 28, 0.2, 0, TAU); g.fill(); g.stroke(); } }
  if (tap > 0) { glow(g, dot.x, dot.y, 260 * tap, BLUE, 0.7 * tap, 'screen'); }
  SET.vignette(g, E, 0.55); drawGrain(g, 1920, 1080, t, 0.1);
});

// ================================================================== SHOT 13 (1:20-1:27) the shadow stands, taps its wrist, points at the bed, tries to take the phone
const STAND = mk(P.stand), TAP = mk(P.tapWrist);
const POINT = mk({ torso: 0.06, hfx: 98, hfy: -76, hbx: 0, hby: -30, lookx: 0.9 });
const REACH = mk({ torso: 0.12, hfx: 104, hfy: -34, hbx: 0, hby: -30, lookx: 0.9 });
const SHAD_STAND = { x: 640, y: 596, s: 1.7 };
shot(80, 87, 'S13', (g, lt, t, E) => {
  const sp = CH.track(lt, [[0, SITPHONE], [0.8, STAND, 0.9], [2.0, TAP, 0.5], [3.4, POINT, 0.5], [5.0, REACH, 0.7], [6.3, STAND, 0.5]]);
  const sk = lt < 1.7 ? 0 : 1, sx = SHAD_STAND.x, sy = lt < 0.8 ? lerp(SIT_HIP.y - 230, SHAD_STAND.y, smooth(lt / 0.8)) : SHAD_STAND.y;
  const flick = pulse(lt % 0.8, 0, 0.25) * 6, pose = Object.assign({}, SITPHONE, { hfy: SITPHONE.hfy + flick, bags: 0.9, looky: 0.5 }), PH = { x: 836, y: 694 };
  const cam = sway(camAt(lt, [[0, { x: 790, y: 650, z: 1.15 }], [7, { x: 800, y: 650, z: 1.25 }]]), t, 0.5);
  stage(g, E, t, {
    cam, ambient: [6, 8, 14, 0.74], wallFx: shadowSpec(sx, sy, sp, SHAD_STAND.s, 1, 0.6, 0.55),
    chars: [hero(SIT_HIP, pose, t)], charLights: [{ x: PH.x, y: PH.y, r: 330, rgb: BLUE, a: 0.55 }],
    lights: [{ x: PH.x, y: PH.y, r: 600, rgb: BLUE, a: 0.24, open: 0.97 }],
    post: (g2, J) => phoneSide(g2, J.me.handF.x + 6, J.me.handF.y - 12, -0.12, 0.9)
  });
});

// ================================================================== SHOT 14 (1:27-1:35) the false stop: he puts it down, two seconds of quiet, a ping; the shadow lies down
const LAY = mk(Object.assign({}, P.curl));
shot(87, 95, 'S14', (g, lt, t, E) => {
  const LOWER = mk(Object.assign({}, SITPHONE, { hfx: 98, hfy: -16, hbx: 70, hby: -12, looky: 0.1 }));
  const pose = CH.track(lt, [[0, SITPHONE], [0.7, LOWER, 0.7], [1.2, Object.assign({}, LOWER, { lookx: -0.7, looky: -0.3, open: 0.8 }), 0.4], [3.1, Object.assign({}, LOWER, { lookx: 0.9, looky: 0.6 }), 0.2], [3.5, Object.assign({}, SITPHONE, { hfx: 98, hfy: -16 }), 0.2], [4.0, SITPHONE, 0.5]]);
  pose.bags = 0.9;
  const pingA = lt >= 3.1 ? clamp(1 - (lt - 3.1) * 1.4) : 0, onBed = lt > 0.9 && lt < 3.6, PHB = { x: 852, y: 758 }, PH = { x: 836, y: 694 }, back = lt >= 3.6;
  const sp = CH.track(lt, [[0, STAND], [1.4, mk(P.slump), 0.8], [4.4, LAY, 1.4]]);
  const k = smooth((lt - 4.4) / 1.4), sh = { x: lerp(640, 700, k), y: lerp(596, 690, k) };
  const cam = sway(camAt(lt, [[0, { x: 790, y: 650, z: 1.25 }], [8, { x: 800, y: 660, z: 1.2 }]]), t, 0.4);
  const pa = onBed ? 0.15 + 0.85 * pingA : 1;
  stage(g, E, t, {
    cam, ambient: [6, 8, 14, 0.75], wallFx: shadowSpec(sh.x, sh.y, sp, 1.7 - 0.2 * k, 1, 0.5, 0.55),
    chars: [hero(SIT_HIP, pose, t)], charLights: [{ x: back ? PH.x : PHB.x, y: back ? PH.y : PHB.y, r: 330, rgb: BLUE, a: 0.55 * pa }],
    lights: [{ x: back ? PH.x : PHB.x, y: back ? PH.y : PHB.y, r: 600, rgb: BLUE, a: 0.24 * pa, open: 0.97 * (onBed ? 0.35 + 0.65 * pingA : 1) }],
    post: (g2, J) => {
      if (onBed) { g2.fillStyle = '#07080c'; rr(g2, PHB.x - 48, PHB.y - 8, 96, 14, 6); g2.fill(); g2.fillStyle = `rgba(150,205,255,${0.25 + 0.7 * pingA})`; rr(g2, PHB.x - 44, PHB.y - 8, 88, 4, 2); g2.fill();
        if (pingA > 0) { g2.strokeStyle = `rgba(150,205,255,${pingA})`; g2.lineWidth = 3; g2.beginPath(); g2.arc(PHB.x, PHB.y - 10, 20 + (1 - pingA) * 90, Math.PI * 1.1, Math.PI * 1.9); g2.stroke(); } }
      else phoneSide(g2, J.me.handF.x + 6, J.me.handF.y - 12, -0.12, 0.9);
    }
  });
});

// ================================================================== SHOT 15 (1:35-1:42) grey dawn, the alarm, he is still scrolling
shot(95, 102, 'S15', (g, lt, t, E) => {
  const pose = Object.assign({}, P.sitBedSlump, { bags: 1.0, hfy: P.sitBedSlump.hfy + pulse(lt % 1.1, 0, 0.3) * 4 }), PH = { x: 838, y: 716 };
  const cam = sway(camAt(lt, [[0, { x: 1030, y: 660, z: 0.88 }], [7, { x: 960, y: 670, z: 1.0 }]]), t, 0.4);
  const ring = clamp((lt - 1.2) / 0.2) * (1 - clamp((lt - 6.2) / 0.6));
  stage(g, E, t, {
    cam, ambient: [26, 28, 34, 0.34], vig: 0.5,
    chars: [hero(SIT_HIP, pose, t)], charLights: [{ x: PH.x, y: PH.y, r: 300, rgb: BLUE, a: 0.45 }, { x: 1600, y: 420, r: 1100, rgb: [150, 156, 170], a: 0.16 }],
    lights: [{ x: 1600, y: 420, r: 1200, rgb: [150, 156, 170], a: 0.16, open: 0.7 }, { x: PH.x, y: PH.y, r: 520, rgb: BLUE, a: 0.18, open: 0.6 }],
    post: (g2, J) => {
      phoneSide(g2, J.me.handF.x + 6, J.me.handF.y - 12, -0.12, 0.75);
      if (ring > 0) for (let i = 0; i < 3; i++) { const u = ((lt * 1.6 + i / 3) % 1); g2.strokeStyle = `rgba(215,220,235,${0.5 * (1 - u) * ring})`; g2.lineWidth = 4; g2.beginPath(); g2.arc(1185, 704, 80 + u * 130, 0, TAU); g2.stroke(); }
    }
  });
});

// ================================================================== SHOT 16 (1:42-1:49) the page: still one line, a cold mug. Then the screen-time card.
shot(102, 109, 'S16', (g, lt, t, E) => {
  if (lt < 3.4) { pageScene(g, E, t, 0, { mug: true, lamp: 0.1, zoom: 1.0 + 0.03 * lt }); return; }
  g.fillStyle = '#07090e'; g.fillRect(0, 0, 1920, 1080); glow(g, 960, 560, 1000, BLUE, 0.16, 'screen');
  FEED.phone(g, 960, 540, 0, 8.0, { card: 2, overlay: 'screentime', t: lt });
  g.fillStyle = '#0b0b0f'; capsule(g, { x: 300, y: 1200 }, { x: 560, y: 780 }, 110, 80); g.fill();
  SET.vignette(g, E, 0.55); drawGrain(g, 1920, 1080, t, 0.1);
});

// ================================================================== SHOT 17 (1:49-1:55) the floor: a grey spotlight, he looks at his hands, the phone dies
shot(109, 115, 'S17', (g, lt, t, E) => {
  g.fillStyle = '#0b0c10'; g.fillRect(0, 0, 1920, 1080);
  const fl = g.createLinearGradient(0, 700, 0, 1080); fl.addColorStop(0, '#14161c'); fl.addColorStop(1, '#0a0b0f'); g.fillStyle = fl; g.fillRect(0, 700, 1920, 380);
  const spot = g.createRadialGradient(960, 330, 40, 960, 880, 640); spot.addColorStop(0, 'rgba(210,215,228,0.0)'); spot.addColorStop(0.5, 'rgba(185,190,205,0.16)'); spot.addColorStop(1, 'rgba(160,165,180,0)');
  g.fillStyle = spot; g.beginPath(); g.moveTo(780, 0); g.lineTo(1140, 0); g.lineTo(1520, 900); g.lineTo(400, 900); g.closePath(); g.fill();
  g.fillStyle = 'rgba(200,205,220,0.10)'; g.beginPath(); g.ellipse(960, 880, 420, 70, 0, 0, TAU); g.fill();
  const sc = 1.55, pose = Object.assign({}, P.sitFloor, { bags: 1, looky: 0.85, hrot: 0.4 + 0.02 * Math.sin(lt * 1.3) }), hipY = 880 - 28 * sc;
  const J = CH.draw(g, { x: 880, y: hipY - 84 * sc, s: sc, flip: 1, pose, t, res: 1, hood: GREY, lights: [{ x: 880, y: 420, r: 700, rgb: [210, 215, 228], a: 0.28 }] });
  // the phone on the floor, battery low, then dead
  const on = lt < 5.2 ? 1 : 1 - smooth((lt - 5.2) / 0.5), px = 1230, py = 872;
  g.fillStyle = '#07080c'; rr(g, px - 70, py - 10, 140, 18, 8); g.fill();
  if (on > 0) { glow(g, px, py - 6, 200, BLUE, 0.35 * on, 'screen'); g.fillStyle = `rgba(150,205,255,${0.8 * on})`; rr(g, px - 62, py - 10, 124, 5, 2); g.fill(); }
  const bu = fadeInOut(lt, 3.3, 5.6, 0.3, 0.3); if (bu > 0) { g.save(); g.globalAlpha = bu; g.translate(px, py - 150); g.fillStyle = 'rgba(10,12,18,0.92)'; rr(g, -90, -42, 180, 84, 16); g.fill();
    g.strokeStyle = '#cfd6e8'; g.lineWidth = 4; rr(g, -66, -14, 100, 28, 6); g.stroke(); g.fillStyle = '#cfd6e8'; g.fillRect(36, -6, 6, 12); g.fillStyle = '#cfd6e8'; g.fillRect(-62, -10, 6, 20);
    g.font = 'bold 20px "DejaVu Sans"'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('1%', 50, 0); g.restore(); }
  SET.vignette(g, E, 0.6); drawGrain(g, 1920, 1080, t, 0.1);
});

// ================================================================== SHOT 18 (1:55-2:03) the black glass: his reflection. Music out. Real silence. Then rain.
shot(115, 123, 'S18', (g, lt, t, E) => {
  g.fillStyle = '#06070a'; g.fillRect(0, 0, 1920, 1080);
  const z = 1 + 0.012 * lt, cx = 960, cy = 540; g.save(); g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy);
  const gl = g.createLinearGradient(680, 40, 1240, 1040); gl.addColorStop(0, '#15171d'); gl.addColorStop(0.5, '#0b0c10'); gl.addColorStop(1, '#14161b');
  g.fillStyle = gl; rr(g, 680, 40, 560, 1000, 70); g.fill(); g.strokeStyle = '#1f222a'; g.lineWidth = 6; g.stroke();
  // reflection of his face: hood ring + black head + two eyes; blinks once
  const blink = 1 - 0.92 * pulse(lt, 4.6, 0.22), a = 0.5 + 0.1 * Math.sin(lt * 1.1);
  g.save(); g.beginPath(); rr(g, 686, 46, 548, 988, 66); g.clip();
  const hg = g.createRadialGradient(960, 560, 10, 960, 560, 260); hg.addColorStop(0, `rgba(34,36,46,${0.5 * a})`); hg.addColorStop(1, 'rgba(34,36,46,0)'); g.fillStyle = hg; g.fillRect(686, 46, 548, 988);
  g.fillStyle = `rgba(235,238,248,${0.34 * a})`; for (const ex of [912, 1022]) { g.beginPath(); g.ellipse(ex, 556, 15, 24 * blink, 0, 0, TAU); g.fill(); }
  const rain = clamp((lt - 5.2) / 1.5); if (rain > 0) { g.strokeStyle = `rgba(190,205,230,${0.22 * rain})`; g.lineWidth = 2; const r = rng(9); for (let i = 0; i < 60; i++) { const x = 700 + r() * 520, y = ((t * (300 + r() * 220) + r() * 1000) % 1100) - 30; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6, y + 34); g.stroke(); } }
  const sheen = g.createLinearGradient(680, 40, 960, 600); sheen.addColorStop(0, 'rgba(255,255,255,0.07)'); sheen.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sheen; g.fillRect(680, 40, 560, 1000);
  g.restore(); g.restore();
  const r2 = rng(5); for (let i = 0; i < 14; i++) { const x = (r2() * 1920 + t * 6 * (r2() - 0.5)), y = (r2() * 1080 + t * 4) % 1080; g.fillStyle = 'rgba(200,205,220,0.10)'; g.beginPath(); g.arc(x, y, 2 + r2() * 2, 0, TAU); g.fill(); }
  SET.vignette(g, E, 0.6); drawGrain(g, 1920, 1080, t, 0.1);
});

// ================================================================== SHOT 19 (2:03-2:10) he looks up: the sleeping shadow, then the page and the window; one breath
const FLOORSIT = (lt) => Object.assign({}, P.sitFloor, { bags: 1, hrot: 0.38 - 0.4 * smooth(lt), open: 0.9, looky: 0.8 - 1.2 * smooth(lt) });
shot(123, 126.5, 'S19a', (g, lt, t, E) => {
  const pose = CH.track(lt, [[0, mk(Object.assign({}, P.sitFloor, { bags: 1 }))], [0.8, mk(Object.assign({}, P.sitFloor, { bags: 1, hrot: 0.0, hy: -54, looky: -0.5, lookx: 0.9, open: 1, tilt: 0 })), 1.2]]);
  const breath = Math.sin(lt * 2.4) * 1.5;
  stage(g, E, t, {
    cam: sway(camAt(lt, [[0, { x: 760, y: 740, z: 1.25 }], [3.5, { x: 740, y: 700, z: 1.35 }]]), t, 0.4), ambient: [26, 28, 34, 0.34],
    wallFx: shadowSpec(700, 690, LAY, 1.5, 1, 0.0, 0.55),
    chars: [hero({ x: 900, y: 748 + breath }, pose, t, { flip: -1 })], lights: [{ x: 1600, y: 420, r: 1200, rgb: [150, 156, 170], a: 0.16, open: 0.6 }], charLights: [{ x: 1500, y: 400, r: 1400, rgb: [150, 156, 170], a: 0.16 }]
  });
});
shot(126.5, 130, 'S19b', (g, lt, t, E) => {
  const pose = CH.track(lt, [[0, mk(Object.assign({}, P.sitFloor, { bags: 1, hrot: 0.0, hy: -54, looky: -0.1, lookx: 0.9 }))], [1.2, mk(Object.assign({}, P.sitFloor, { bags: 1, hrot: -0.05, hy: -56, looky: -0.6, lookx: 0.9 })), 1.0]]);
  const breath = Math.sin(lt * 2.4) * 1.5;
  stage(g, E, t, {
    cam: sway(camAt(lt, [[0, { x: 1250, y: 690, z: 1.1 }], [3.5, { x: 1360, y: 680, z: 1.2 }]]), t, 0.4), ambient: [26, 28, 34, 0.34],
    chars: [hero({ x: 900, y: 748 + breath }, pose, t, {})], lights: [{ x: 1600, y: 420, r: 1200, rgb: [150, 156, 170], a: 0.2, open: 0.7 }], charLights: [{ x: 1500, y: 400, r: 1400, rgb: [150, 156, 170], a: 0.16 }]
  });
});
