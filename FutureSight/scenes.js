// scenes.js — the 10.8 s hook. drawFrame(g, t) is a pure function of t.
// Depends on: lib.js, timeline.js (TL), world.js, rigs.js.

const CHAR_X = 900;            // sidewalk spot where the story happens
const SIDEWALK_Y = 820;
const STRIDE = 140;            // px per full walk cycle
const PHASE_UNIT = 1;          // walkerPose.phase unit: gait cycles

// ---------- helpers ----------
function shakeAt(t, t0, amp, decay, f = 38) {
  if (t < t0) return { x: 0, y: 0, r: 0 };
  const u = t - t0, e = Math.exp(-u * decay) * amp;
  return {
    x: Math.sin(u * f + 1.3) * e + Math.sin(u * f * 1.9 + 4.1) * e * 0.5,
    y: Math.cos(u * f * 1.2 + 0.4) * e * 0.8,
    r: Math.sin(u * f * 0.7 + 2.0) * e * 0.0006,
  };
}
const win = (t, a, b, fi = 0.12, fo = 0.12) => smooth((t - a) / fi) * smooth((b - t) / fo);

// Integral of smoothstep ramp (0 -> 1 over d seconds), for walking position.
function rampInt(u, d) {
  if (u <= 0) return 0;
  if (u >= d) return d * 0.5 + (u - d);
  const a = u / d;
  return d * (a * a * a - a * a * a * a * 0.5);
}

// ---------- the protagonist, as a function of time ----------
function charAt(t) {
  const c = { x: CHAR_X, walk: 0, phone: 0, headDown: 0, lean: 0.08, eyeOpen: 0, eyeGlow: 0, flutter: 0, step: 0, bob: 1 };
  if (t < TL.s1[1]) {
    // scene 1 — walks along the curb, nose in the phone
    const hop = TL.hop1, rs = 2.0;
    c.phone = 1; c.headDown = 0.38; c.lean = 0.12;
    if (t < hop) {
      c.x = 700 + 150 * t; c.walk = 1;
    } else {
      const x0 = 700 + 150 * hop;
      const sp = spring(t - hop, 220, 20);
      c.step = clamp(sp);
      c.x = x0 - 46 * sp;
      c.walk = clamp(1 - (t - (hop - 0.04)) / 0.12);            // legs plant
      if (t > rs) { c.walk = smooth((t - rs) / 0.35); c.step = clamp(1 - (t - rs) / 0.3); c.x = x0 - 46 + 120 * rampInt(t - rs, 0.35); }
      // flinch as the bike flies by, then right back to the phone
      const fl = win(t, TL.bikePass - 0.05, TL.bikePass + 0.38, 0.05, 0.25);
      c.headDown = lerp(0.38, 0.12, fl);
      c.flutter = win(t, TL.bikePass - 0.05, TL.bikePass + 0.6, 0.06, 0.4);
    }
  } else if (t < TL.hop2) {
    // scene 2 — frozen mid-street-corner, phone gone, eyes opening
    c.x = CHAR_X; c.lean = 0.02; c.bob = 0.4;
    c.eyeOpen = clamp(spring(t - TL.eyeOpen, 260, 24));
    c.eyeGlow = clamp(spring(t - TL.eyeFlash, 200, 22));
    c.flutter = 0.35 * win(t, TL.pullStart, TL.pullStart + 1.2, 0.1, 0.6);
  } else {
    // scene 3 — reality catches up: a hop back, then a confident stride
    const sp = spring(t - TL.hop2, 220, 20);
    c.step = clamp(sp) * (1 - smooth((t - 7.25) / 0.2));
    c.x = CHAR_X - 40 * sp;
    c.eyeOpen = 1; c.eyeGlow = 1 - 0.55 * smooth((t - 7.2) / 1.0);
    c.lean = 0.1;
    const rs = 7.35;
    if (t > rs) { c.walk = smooth((t - rs) / 0.4); c.x = CHAR_X - 40 + 110 * rampInt(t - rs, 0.4); }
    c.flutter = 0.4 * win(t, 6.95, 7.6, 0.05, 0.5);
  }
  c.phase = (c.x / STRIDE) * PHASE_UNIT;
  return c;
}

function poseOf(c, extra) {
  return walkerPose(Object.assign({ phase: c.phase, walk: c.walk, headDown: c.headDown, phone: c.phone, lean: c.lean,
    bob: c.bob, eyeOpen: c.eyeOpen, eyeGlow: c.eyeGlow, flutter: c.flutter, step: c.step }, extra || {}));
}
const walkerSt = (c, extra) => Object.assign({ x: c.x, y: SIDEWALK_Y, s: 0.92, facing: 1, pose: poseOf(c), pal: PAL_REAL, alpha: 1 }, extra || {});

// ---------- camera ----------
function cameraAt(t, c) {
  let cam;
  if (t < TL.s1[1]) {
    cam = { x: 850 + 0.3 * (c.x - 850), y: 612, z: 1.0 + 0.045 * (t / 3.5) };
    const bp = TL.bikePass;
    // whip with the bike
    cam.x += 38 * smooth((t - (bp - 0.25)) / 0.25) * (1 - smooth((t - (bp + 0.05)) / 0.5));
    const sk = shakeAt(t, bp - 0.02, 16, 7.5);
    cam.x += sk.x; cam.y += sk.y; cam.r = sk.r;
    cam.z *= 1 + 0.03 * win(t, bp - 0.1, bp + 0.35, 0.1, 0.3);
  } else if (t < TL.s2[1]) {
    // macro on the head, then a spring pull-out to a wide
    const head = walkerJoints(walkerSt(c)).head;
    const mac = { x: head.x + 20, y: head.y, z: 4.4 + 0.6 * clamp((t - TL.s2[0]) / 0.55) };
    const wide = { x: CHAR_X + 10 * Math.sin((t - 4) * 0.7), y: 618, z: 1.22 + 0.04 * (t - 4.05) / 2.85 };
    const w = spring(t - TL.pullStart, 46, 12.5);
    cam = { x: lerp(mac.x, wide.x, w), y: lerp(mac.y, wide.y, w), z: Math.exp(lerp(Math.log(mac.z), Math.log(wide.z), w)) };
    const sk = shakeAt(t, TL.eyeFlash, 10, 9);
    cam.x += sk.x; cam.y += sk.y; cam.r = sk.r;
    const sk2 = shakeAt(t, TL.timerEnd, 14, 8);
    cam.x += sk2.x; cam.y += sk2.y;
  } else {
    // pull back and track right as he walks; punch on the title
    const w = spring(t - TL.s3[0], 60, 13);
    const tx = CHAR_X + 250 + 40 * smooth((t - 7.5) / 2.5);
    cam = { x: lerp(CHAR_X + 10, tx, w), y: lerp(618, 600, w), z: lerp(1.28, 0.82, w) };
    cam.x += 60 * smooth((t - 7.4) / 3.0);
    const tp = Math.exp(-(t - TL.titleHit) * 7) * (t >= TL.titleHit ? 1 : 0);
    cam.z *= 1 + 0.07 * tp;
    const sk = shakeAt(t, TL.titleHit, 20, 7);
    cam.x += sk.x; cam.y += sk.y; cam.r = sk.r;
  }
  cam.r = cam.r || 0;
  return cam;
}

// ---------- entities ----------
function bikeAt(t) {
  if (t < TL.bikeT0) return null;
  const x = CHAR_X + (TL.bikeX0 + TL.bikeSpeed * (t - TL.bikeT0));
  return { x, y: GROUND.roadNear, s: 1.08, wheel: x / 58, pedal: t * 11, speed: TL.bikeSpeed, pal: PAL_REAL };
}

function drawSpeedLines(g, t, a) {
  if (a <= 0.01) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const r = rng(i * 131 + 7);
    const y = 560 + r() * 520, len = 500 + r() * 900;
    const x = ((t * (4200 + r() * 2500) + r() * 3000) % 3600) - 800;
    const gr = g.createLinearGradient(x - len, 0, x, 0);
    gr.addColorStop(0, 'rgba(255,220,180,0)'); gr.addColorStop(1, `rgba(255,236,210,${0.22 * a})`);
    g.fillStyle = gr; g.fillRect(x - len, y, len, 2 + r() * 3);
  }
  g.restore();
}

let _titleCv = null;
function drawTitle(g, t) {
  const u = t - TL.titleHit;
  if (u < 0) return;
  const sc = lerp(2.1, 1, easeOut(u / 0.16)) + 0.035 * Math.sin(u * 3);
  const fadeOut = 1 - smooth((t - 10.45) / 0.3);
  const sk = shakeAt(t, TL.titleHit, 12, 9);
  // title is composed on its own canvas so the light sweep only touches the letters
  if (!_titleCv) { _titleCv = document.createElement('canvas'); _titleCv.width = 1800; _titleCv.height = 440; }
  const o = _titleCv.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
  o.clearRect(0, 0, 1800, 440);
  o.translate(900, 220);
  o.textAlign = 'center'; o.textBaseline = 'middle'; o.lineJoin = 'round';
  o.font = '900 250px "Bahnschrift SemiBold","Segoe UI Black",sans-serif';
  o.shadowColor = 'rgba(80,210,255,0.9)'; o.shadowBlur = 60;
  o.fillStyle = '#7fe9ff'; o.fillText('10 SECONDS', 0, 0);
  o.shadowBlur = 0;
  o.fillStyle = 'rgba(255,60,120,0.55)'; o.fillText('10 SECONDS', -5, 2);
  o.lineWidth = 16; o.strokeStyle = '#14101c'; o.strokeText('10 SECONDS', 0, 0);
  const gr = o.createLinearGradient(0, -110, 0, 110);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#c9f6ff'); gr.addColorStop(1, '#6fd8ff');
  o.fillStyle = gr; o.fillText('10 SECONDS', 0, 0);
  const sx = -700 + 1500 * smooth((u - 0.2) / 0.7);
  o.globalCompositeOperation = 'source-atop';
  const sw = o.createLinearGradient(sx - 90, 0, sx + 90, 0);
  sw.addColorStop(0, 'rgba(255,255,255,0)'); sw.addColorStop(0.5, 'rgba(255,255,255,0.85)'); sw.addColorStop(1, 'rgba(255,255,255,0)');
  o.fillStyle = sw; o.fillRect(sx - 90, -140, 180, 280);
  g.save();
  g.translate(960 + sk.x, 285 + sk.y);
  g.scale(sc, sc);
  g.globalAlpha = smooth(u / 0.05) * fadeOut;
  g.drawImage(_titleCv, -900, -220);
  g.restore();
}

// ---------- frame ----------
function drawHookFrame(g, t) {
  const W = TL.W, H = TL.H;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);

  const c = charAt(t);
  const cam = cameraAt(t, c);

  g.save();
  if (cam.r) { g.translate(W / 2, H / 2); g.rotate(cam.r); g.translate(-W / 2, -H / 2); }

  // world
  drawWorld(g, cam, t);

  // real entities (action plane p = 1)
  // the protagonist is drawn after the vision grade once the vision starts, so he keeps his red hoodie
  const drawHero = () => withLayer(g, cam, 1, () => drawWalker(g, walkerSt(c)));
  const afterGrade = t >= TL.eyeFlash;
  const entities = [];
  if (!afterGrade) entities.push({ y: SIDEWALK_Y, draw: drawHero });
  const b = bikeAt(t);
  if (b && t < TL.s1[1]) entities.push({ y: b.y, draw: () => withLayer(g, cam, 1, () => drawBike(g, b)) });
  entities.sort((a, z) => a.y - z.y).forEach((e) => e.draw());

  // vision grade (ghosts are drawn after it so they stay bright)
  let vg = 0;
  if (t >= TL.eyeFlash && t < TL.hop2) vg = 0.85 * easeOut((t - TL.eyeFlash) / 0.3);
  else if (t >= TL.hop2) vg = 0.45 * smooth((t - 7.5) / 0.6) * (1 - smooth((t - 9.4) / 0.9)) ;
  if (vg > 0.003) visionGrade(g, vg);
  if (afterGrade) drawHero();

  // ghosts + hologram
  if (t >= TL.eyeFlash && t < TL.hop2) {
    // timer ring, anchored to the character's chest in world space
    const p = clamp((t - TL.timerStart) / (TL.timerEnd - TL.timerStart));
    const appear = smooth((t - TL.timerStart + 0.1) / 0.3) * (1 - smooth((t - TL.timerEnd - 0.02) / 0.04));
    if (appear > 0.01) {
      // floats beside him, where he is looking
      const sp = project(cam, CHAR_X + 330, 650, 1);
      drawTimerRing(g, sp.x, sp.y, 400 * cam.z, { value: 10 * (1 - p), progress: p, appear, time: t });
    }
    // ghost pedestrian (sidewalk, walking left, time-lapse)
    const [pa, pb] = TL.ghostPed;
    if (t > pa && t < pb) {
      const u = (t - pa) / (pb - pa), x = lerp(1480, 420, u);
      const gc = { x, walk: 1, phase: (-x / 100) * PHASE_UNIT, headDown: 0.3, phone: 1, lean: 0.1, bob: 1, eyeOpen: 0, eyeGlow: 0, flutter: 0, step: 0 };
      withLayer(g, cam, 1, () => drawWalker(g, walkerSt(gc, { y: 834, facing: -1, pal: palGhost(0.85 * win(t, pa, pb, 0.1, 0.1)), alpha: 1 })));
    }
    // ghost car (far lane, left to right)
    const [ca, cb] = TL.ghostCar;
    if (t > ca && t < cb) {
      const u = (t - ca) / (cb - ca), x = lerp(-420, 2350, u);
      withLayer(g, cam, 1, () => drawCar(g, { x, y: GROUND.roadFar, s: 1.0, pal: palGhost(0.8 * win(t, ca, cb, 0.08, 0.08)), alpha: 1 }));
    }
    // ghost bike accelerates into him, arrives exactly at timerEnd
    const [ba, bb] = TL.ghostBike;
    if (t > ba && t <= bb + 0.02) {
      const u = clamp((t - ba) / (bb - ba)), x = CHAR_X - 1500 * Math.pow(1 - u, 1.7);
      const al = 0.9 * win(t, ba, bb + 0.02, 0.08, 0.02);
      withLayer(g, cam, 1, () => drawBike(g, { x, y: GROUND.roadNear, s: 1.08, wheel: x / 58, pedal: t * 14, speed: 2200, pal: palGhost(al), alpha: 1 }));
    }
  } else if (t >= TL.echoes[0] && t < 10.5) {
    // four future-echoes of himself marching ahead (2.5, 5, 7.5, 10 seconds)
    TL.echoes.forEach((et, k) => {
      if (t < et) return;
      const pop = clamp(spring(t - et, 230, 15));
      const fa = [0.8, 0.62, 0.46, 0.34][k] * (1 - smooth((t - 10.3) / 0.4));
      const ex = c.x + 275 * (k + 1);
      const ec = Object.assign({}, c, { x: ex, walk: 1, phase: ((ex + k * 37) / STRIDE) * PHASE_UNIT, phone: 0, headDown: 0.04, eyeOpen: 1, eyeGlow: 1, step: 0 });
      withLayer(g, cam, 1, () => {
        g.save();
        g.translate(ex, SIDEWALK_Y); g.scale(lerp(0.6, 1, pop), lerp(0.6, 1, pop)); g.translate(-ex, -SIDEWALK_Y);
        drawWalker(g, walkerSt(ec, { pal: palGhost(fa * Math.min(1, pop * 1.4)), alpha: 1 }));
        g.restore();
      });
    });
  }

  // speed lines on the bike pass
  drawSpeedLines(g, t, win(t, 1.4, 1.95, 0.05, 0.15));

  drawForeground(g, cam, t);
  g.restore();

  // title + post
  drawTitle(g, t);
  postFX(g, t, { vignette: 0.55, grain: 0.06 });

  // flashes / chromatic aberration
  let fl = 0, sp = 0;
  const burst = (t0, a, k, split) => { if (t >= t0) { const e = Math.exp(-(t - t0) * k); fl += a * e; sp += split * e; } };
  burst(TL.cuts ? TL.cuts : 3.5, 0.5, 30, 6);          // hard cut punch
  burst(TL.eyeFlash, 0.9, 11, 14);
  burst(TL.timerEnd, 1.0, 9, 22);
  burst(TL.titleHit, 0.45, 12, 16);
  if (t >= 0 && t < TL.hop2 - 0.02 && t > TL.timerEnd + 0.2) { /* keep clean after flash */ }
  if (sp > 0.8) rgbSplit(g, sp);
  if (fl > 0.01) flash(g, clamp(fl));

  // fade in / out
  const fin = 1 - smooth(t / 0.25), fout = smooth((t - 10.45) / 0.35);
  const black = Math.max(fin, fout);
  if (black > 0.001) { g.fillStyle = `rgba(8,5,14,${black})`; g.fillRect(0, 0, W, H); }
}

if (typeof window !== "undefined") { window.drawHookFrame = drawHookFrame; window.drawFrame = drawHookFrame; }
