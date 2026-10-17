// shots_a.js — shared helpers, story state, and shots 1-8 (hook, setup, first swipe). Times are global seconds (see docs/SCRIPT.md).
const GREY = [112, 116, 128], RED = [188, 36, 42], BLUE = [74, 168, 255], WARM = [255, 196, 120];
const SHOTS = [];
const shot = (t0, t1, id, fn) => SHOTS.push({ t0, t1, id, fn });
const view = (g, cam) => { g.translate(960, 540); g.scale(cam.z, cam.z); g.translate(-cam.x, -cam.y); };
function camAt(lt, keys) {
  if (lt <= keys[0][0]) return Object.assign({}, keys[0][1]);
  for (let i = 1; i < keys.length; i++) if (lt <= keys[i][0]) {
    const a = keys[i - 1], b = keys[i], k = smooth((lt - a[0]) / (b[0] - a[0]));
    return { x: lerp(a[1].x, b[1].x, k), y: lerp(a[1].y, b[1].y, k), z: lerp(a[1].z, b[1].z, k) };
  }
  return Object.assign({}, keys[keys.length - 1][1]);
}
const sway = (cam, t, amt) => { amt = amt == null ? 1 : amt; cam.x += (Math.sin(t * 0.7) * 4 + Math.sin(t * 1.9) * 2) * amt / cam.z; cam.y += (Math.cos(t * 0.6) * 3 + Math.sin(t * 2.3) * 1.5) * amt / cam.z; return cam; };
const pulse = (lt, t0, d) => { const k = (lt - t0) / d; return k < 0 || k > 1 ? 0 : Math.sin(k * Math.PI); };
const keyed = (t, keys) => {                       // smooth piecewise interpolation of [[t, v], ...]
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; return lerp(a[1], b[1], smooth((t - a[0]) / (b[0] - a[0]))); }
  return keys[keys.length - 1][1];
};

// ------------------------------------------------------------------ story state (pure function of global time)
const CLK = [[0, 1627], [14, 1627], [19, 1422], [20, 1422], [52, 1424], [55, 1460], [57.5, 1494], [60, 1513], [70, 1522], [75, 1540], [80, 1555], [85, 1570], [87, 1600], [95, 1830], [200, 1850]];
const PAYCLK = [[170, 1405], [176, 1406], [177.6, 1407], [178.9, 1408], [179.5, 1409], [180.0, 1410], [200, 1410]];
function clockStr(M) { M = Math.floor(M); const h24 = Math.floor(M / 60) % 24, h = h24 % 12 || 12, m = M % 60; return h + ':' + (m < 10 ? '0' : '') + m; }
function story(t) {
  const night2 = t >= 170 && t < 205;
  return {
    sky: night2 ? 0 : t < 95 ? 0 : t < 150 ? 1 : t < 156 ? 1 + smooth((t - 150) / 6) : t < 170 ? 2 : 0,
    lamp: t < 14 ? 0 : t < 20 ? smooth((t - 14) / 6) : t < 35.5 ? 1 : t < 38 ? 1 - smooth((t - 35.5) / 2.5) : t < 170 ? 0 : t < 198 ? 1 : t < 200 ? 1 - (t - 198) / 2 : 0,
    curtain: night2 ? 0 : t < 150 ? 0 : t < 156 ? smooth((t - 150) / 6) : t < 170 ? 1 : 0,
    clock: clockStr(night2 ? keyed(t, PAYCLK) : keyed(t, CLK)),
    hole: keyed(t, [[7.9, 0], [9.2, 1], [17, 1], [19.5, 0], [47, 0], [48.6, 1], [400, 1]]), planks: t < 142 ? 0 : t < 145 ? smooth((t - 142) / 3) : 1,
    rain: t < 118 ? 0 : t < 150 ? Math.min(1, (t - 118) / 3) : t < 156 ? 1 - (t - 150) / 6 : 0, mug: 1,
    note: t < 144 ? 0 : Math.min(1, (t - 144) / 2), cord: t >= 141 ? 1 : 0,
    shelfPhone: t < 141 ? 0 : (t >= 170 && t < 186) ? 0 : 1
  };
}
function hoodSpec(t) {
  if (t < 164) return { hood: GREY };
  if (t < 169.4) return { hood: GREY, hood2: { rgb: RED, line: lerp(860, 590, easeInOut((t - 164) / 5.2)), soft: 34 } };
  return { hood: RED };
}

// ------------------------------------------------------------------ props and overlays
// every swipe his thumb makes on a held phone, in global time, so the feed on the small phone scrolls continuously across the film
const HELD_SW = [].concat(SCR.every(3.0, 14, 0.9), [{ t: 43.5 }], SCR.every(80.2, 87, 0.8), SCR.every(91.0, 95, 0.9), SCR.every(95.4, 102, 1.1), [{ t: 176.8 }, { t: 178.2 }, { t: 179.6 }]);
function phoneSide(g, x, y, ang, a, o) {           // the phone in his hand: three-quarter view, the feed visibly moving on it
  SCR.held(g, x + 6, y - 16, ang, window.NOW || 0, Object.assign({ a, w: 34, swipes: HELD_SW, seed: 2 }, o || {}));
  if (a > 0.05) glow(g, x - 10, y - 16, 90, BLUE, 0.18 * a, 'screen');
}
const fadeInOut = (lt, a, b, fi, fo) => clamp((lt - a) / fi) * clamp((b - lt) / fo);

// ------------------------------------------------------------------ the stage: room + characters + lighting + grade
function stage(g, E, t, c) {
  g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080);
  g.save(); view(g, c.cam);
  const S = Object.assign(story(t), c.S || {}); if (c.wallFx) S.wallFx = c.wallFx;
  SET.room(g, S, t);
  const J = {};
  for (const ch of (c.chars || [])) J[ch.id] = CH.draw(g, Object.assign({ t, res: c.cam.z, lights: c.charLights || [] }, ch));
  if (c.post) c.post(g, J, S);
  g.restore();
  SET.lightPass(g, c.cam, c.ambient || [6, 8, 14, 0.84], c.lights || [], E);
  if (c.over) c.over(g, E);
  SET.vignette(g, E, c.vig == null ? 0.42 : c.vig); drawGrain(g, 1920, 1080, t, c.grain == null ? 0.1 : c.grain);
  return J;
}
const NIGHT = [6, 8, 14, 0.84];
const shadowSpec = (x, y, pose, s, flip, eyes, a) => (g) => CH.draw(g, { x, y, s, flip: flip || 1, pose, t: 0, res: 1, alpha: a == null ? 0.55 : a, shadow: { fill: '#0a0a0e', blur: 3, eyes: eyes == null ? 0.0 : eyes } });

// ------------------------------------------------------------------ poses used across shots
const P = CH.poses, mk = CH.mk;
const LIE = mk(Object.assign({}, P.lieBack, { hfx: 92, hfy: -130, hbx: 80, hby: -122 }));
const SITIDLE = mk(Object.assign({}, P.sitBed, { hfx: 58, hfy: -14, hbx: 44, hby: -10, looky: 0.2, lookx: 0.9 }));
const SITNOD = mk(Object.assign({}, SITIDLE, { hrot: 0.14, hy: -50 }));
const SITPHONE = mk(Object.assign({}, P.sitBed));
const LIE_HIP = { x: 431, y: 742 }, SIT_HIP = { x: 760, y: 778 };
const hero = (hip, pose, t, extra) => Object.assign({ id: 'me', x: hip.x, y: hip.y, s: 1, flip: 1, pose }, hoodSpec(t), extra || {});

// the hook bed: he lies on his back under the phone, face lit; his shadow sleeps curled up on the wall above him
function hookBed(t, lt, extra) {
  const fl = pulse((t - 3.0 + 9) % 0.9, 0.0, 0.25) * 6;         // thumb flick every 0.9 s
  const pose = Object.assign({}, LIE, { hfy: LIE.hfy + fl, lookx: 0.9, looky: 0, bags: 0.8 });
  return { hero: hero(LIE_HIP, pose, t, extra), phone: { x: 301, y: 616 } };
}

// ================================================================== SHOT 1  (0:00-0:03) black, one ping, a blue slit becomes a glow
shot(0, 3, 'S1', (g, lt, t, E) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080);
  const a = smooth((lt - 0.5) / 0.9), b = smooth((lt - 1.3) / 1.5), w = lerp(2, 760, a), h = lerp(3, 360, b);
  glow(g, 960, 540, 260 + b * 520, BLUE, 0.12 * a + 0.3 * b, 'screen');
  g.fillStyle = `rgba(150,205,255,${0.9 * a * (1 - b * 0.7)})`; rr(g, 960 - w / 2, 540 - h / 2, w, h, h / 2); g.fill();
  SET.vignette(g, E, 0.6); drawGrain(g, 1920, 1080, t, 0.12);
});

// ================================================================== SHOT 2  (0:03-0:08) CU: his eyes, the sleeping shadow, the question
shot(3, 8, 'S2', (g, lt, t, E) => {
  const hb = hookBed(t, lt), cam = sway(camAt(lt, [[0, { x: 318, y: 694, z: 2.3 }], [5, { x: 312, y: 692, z: 2.45 }]]), t, 0.8);
  stage(g, E, t, {
    cam, ambient: [5, 7, 12, 0.8], vig: 0.62,
    wallFx: shadowSpec(410, 548, P.curl, 1.0, 1, 0.5, 0.5),
    chars: [hb.hero], charLights: [{ x: hb.phone.x, y: hb.phone.y, r: 340, rgb: BLUE, a: 0.55 }],
    lights: [{ x: hb.phone.x, y: hb.phone.y, r: 520, rgb: BLUE, a: 0.3, open: 0.97 }],
    post: (g2) => phoneSide(g2, hb.phone.x, hb.phone.y, 0.08, 0.8 + 0.2 * Math.sin(t * 7.0)),
    over: (g2) => TXT.title(g2, 'Where does the feed end?', lt, 1.8, 4.1, { y: 880, size: 66, glow: true, stagger: 0.13 })
  });
});

// ================================================================== SHOT 3  (0:08-0:14) wide: the shaft opens, icons fall in and never land
shot(8, 14, 'S3', (g, lt, t, E) => {
  const hb = hookBed(t, lt), cam = sway(camAt(lt, [[0, { x: 700, y: 770, z: 0.95 }], [6, { x: 780, y: 810, z: 1.18 }]]), t, 0.6);
  stage(g, E, t, {
    cam, ambient: [5, 7, 12, 0.78],
    wallFx: shadowSpec(410, 548, P.curl, 1.0, 1, 0.45, 0.5),
    chars: [hb.hero], charLights: [{ x: hb.phone.x, y: hb.phone.y, r: 340, rgb: BLUE, a: 0.75 }],
    lights: [{ x: hb.phone.x, y: hb.phone.y, r: 560, rgb: BLUE, a: 0.26, open: 0.95 }, { x: 820, y: 960, r: 520, rgb: BLUE, a: 0.26 * smooth(lt / 1.2), open: 0.9 * smooth(lt / 1.2) }],
    post: (g2) => {
      phoneSide(g2, hb.phone.x, hb.phone.y, 0.08, 0.9);
      for (let i = 0; i < 9; i++) {                        // icons leave the phone and drop into the shaft
        const u = (lt - 0.9 - i * 0.62) / 1.25; if (u < 0 || u > 1) continue;
        const x0 = hb.phone.x, y0 = hb.phone.y - 20, x1 = 820 + (i % 3 - 1) * 70, y1 = 975, cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 150;
        const px = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, py = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1, sz = 26 * (1 - u * 0.55);
        glow(g2, px, py, 60, BLUE, 0.5, 'screen'); g2.fillStyle = 'rgba(150,205,255,0.95)'; rr(g2, px - sz / 2, py - sz / 2, sz, sz, sz * 0.3); g2.fill();
      }
    }
  });
});

// ================================================================== SHOT 4  (0:14-0:20) the clock spins back; he sits up; the lamp warms the room
shot(14, 20, 'S4', (g, lt, t, E) => {
  const k = smooth((lt - 2.4) / 2.8), pose = CH.blend(LIE, SITIDLE, k), hip = { x: lerp(LIE_HIP.x, SIT_HIP.x, k), y: lerp(LIE_HIP.y, SIT_HIP.y, k) };
  const cam = sway(camAt(lt, [[0, { x: 1185, y: 690, z: 3.2 }], [2.6, { x: 1185, y: 690, z: 3.2 }], [6, { x: 1020, y: 700, z: 1.15 }]]), t, 0.4), S = story(t);
  stage(g, E, t, {
    cam, ambient: [6, 8, 14, 0.86 - 0.3 * S.lamp],
    chars: [hero(hip, pose, t)], charLights: [{ x: 1650, y: 620, r: 1000, rgb: WARM, a: 0.3 * S.lamp }],
    lights: [{ x: 1650, y: 620, r: 760, rgb: WARM, a: 0.2 * S.lamp, open: 0.9 * S.lamp }, { x: 1185, y: 700, r: 260, rgb: [190, 210, 255], a: 0.18, open: 0.8 }],
    over: (g2) => TXT.label(g2, '11:42 PM', lt, 4.2, 5.6, { y: 950, size: 30 })
  });
});

// ================================================================== SHOT 5  (0:20-0:27) the bed, the lamp, the blank page; "after one thing"
shot(20, 27, 'S5', (g, lt, t, E) => {
  const pose = CH.track(lt, [[0, SITIDLE], [3.9, SITNOD, 0.22], [4.5, SITIDLE, 0.4]]), cam = sway(camAt(lt, [[0, { x: 1040, y: 650, z: 0.95 }], [7, { x: 1190, y: 650, z: 1.05 }]]), t, 0.5);
  stage(g, E, t, {
    cam, ambient: [8, 9, 15, 0.5], wallFx: shadowSpec(930, 548, pose, 1.35, 1, 0.5, 0.5),
    chars: [hero(SIT_HIP, pose, t)], charLights: [{ x: 1650, y: 640, r: 1100, rgb: WARM, a: 0.28 }],
    lights: [{ x: 1664, y: 620, r: 640, rgb: WARM, a: 0.22, open: 0.95 }, { x: 1000, y: 640, r: 500, rgb: [255, 220, 170], a: 0.08, open: 0.4 }], vig: 0.5
  });
});

// ================================================================== SHOT 6  (0:27-0:33) the page: one faint line; a pencil rolls to a stop
shot(27, 33, 'S6', (g, lt, t, E) => {
  const k = 1 - Math.pow(1 - clamp(lt / 2.6), 2.4), x = lerp(980, 420, k) + Math.sin(clamp(lt / 2.6) * Math.PI) * 0;   // rolls in, slows on the paper, stops
  PAGE.draw(g, E, t, 0, { zoom: lerp(1, 1.07, lt / 6), lamp: 1, ring: true, pencilRest: { x, y: 40, ang: -Math.PI / 2 + 0.06, roll: -x / 57 } });
});

// ================================================================== SHOT 7  (0:33-0:39) "just one thing": the phone comes up, the room greys, the lamp dims
shot(33, 39, 'S7', (g, lt, t, E) => {
  const pose = CH.track(lt, [[0, SITIDLE], [1.0, SITPHONE, 0.8]]), cam = sway(camAt(lt, [[0, { x: 900, y: 700, z: 1.45 }], [6, { x: 880, y: 690, z: 1.62 }]]), t, 0.5);
  const pa = smooth((lt - 1.3) / 0.7), S = story(t), PH = { x: 836, y: 694 };
  stage(g, E, t, {
    cam, ambient: [7, 9, 15, 0.8 - 0.2 * S.lamp], wallFx: shadowSpec(930, 548, pose, 1.35, 1, 0.55, 0.5),
    chars: [hero(SIT_HIP, pose, t)], charLights: [{ x: PH.x, y: PH.y, r: 330, rgb: BLUE, a: 0.7 * pa }, { x: 1650, y: 640, r: 1100, rgb: WARM, a: 0.28 * S.lamp }],
    lights: [{ x: PH.x, y: PH.y, r: 560, rgb: BLUE, a: 0.24 * pa, open: 0.95 * pa }, { x: 1664, y: 620, r: 640, rgb: WARM, a: 0.22 * S.lamp, open: 0.95 * S.lamp }],
    post: (g2, J) => { if (pa > 0) phoneSide(g2, J.me.handF.x + 6, J.me.handF.y - 12, -0.12, pa); }
  });
});

// ================================================================== SHOT 8  (0:39-0:45) INSERT: his thumb, the first real swipe, a heart; then his face, smiling
// the big phone, seen over his knees: a dark room behind it, the lamp's last warmth as soft bokeh
function phoneInsert(g, E, t, lt, o) {
  g.fillStyle = '#05070c'; g.fillRect(0, 0, 1920, 1080);
  const bk = rng(12); for (let i = 0; i < 7; i++) { const x = bk() * 1920, y = bk() * 700, r = 40 + bk() * 90; glow(g, x, y, r * 2, o.warm ? WARM : [90, 110, 160], 0.05 + 0.05 * bk(), 'screen'); }
  const fl = g.createLinearGradient(0, 640, 0, 1080); fl.addColorStop(0, 'rgba(30,32,40,0)'); fl.addColorStop(1, 'rgba(30,32,40,0.6)'); g.fillStyle = fl; g.fillRect(0, 640, 1920, 440);   // his knees / the duvet, out of focus
  g.fillStyle = 'rgba(16,17,22,0.9)'; g.beginPath(); g.ellipse(560, 1150, 520, 260, 0.1, 0, TAU); g.fill(); g.beginPath(); g.ellipse(1420, 1170, 520, 250, -0.1, 0, TAU); g.fill();
  const z = o.zoom || 1; g.save(); g.translate(960, 560); g.scale(z, z); g.translate(-960, -560);
  const res = SCR.phone(g, o.x || 960, o.y || 548, o.w || 430, o.ang == null ? -0.05 : o.ang, t, Object.assign({ hand: true, clock: story(t).clock }, o.phone));
  g.restore();
  SET.vignette(g, E, 0.55); drawGrain(g, 1920, 1080, t, 0.09);
  return res;
}
shot(39, 45, 'S8', (g, lt, t, E) => {
  if (lt < 3.4) {
    phoneInsert(g, E, t, lt, { zoom: 1 + 0.02 * lt, ang: -0.05 + 0.01 * Math.sin(lt * 0.8), y: 548 + Math.sin(lt * 1.1) * 4, phone: { swipes: [{ t: 39.6 }, { t: 40.9 }, { t: 42.2 }], likes: [40.2], seed: 0 } });
    return;
  }
  const l2 = lt - 3.4, flick = pulse(t, 43.5 - 0.05, 0.3) * 8;
  const happy = smooth(l2 / 0.4) * (1 - smooth((l2 - 1.9) / 0.4));
  const pose = Object.assign({}, SITPHONE, { hfy: SITPHONE.hfy + flick * 0.5, happy, looky: 0.55 });
  const cam = sway(camAt(l2, [[0, { x: 812, y: 690, z: 3.0 }], [2.6, { x: 816, y: 688, z: 3.25 }]]), t, 0.6), PH = { x: 836, y: 694 };
  stage(g, E, t, {
    cam, ambient: [6, 8, 14, 0.8], vig: 0.6,
    chars: [hero(SIT_HIP, pose, t)], charLights: [{ x: PH.x, y: PH.y, r: 330, rgb: BLUE, a: 0.6 }],
    lights: [{ x: PH.x, y: PH.y, r: 540, rgb: BLUE, a: 0.3, open: 0.97 }],
    post: (g2, J) => phoneSide(g2, J.me.handF.x, J.me.handF.y, -0.12, 0.9)
  });
});
