// char.js — the SCROLL host. Faceless black head, two white eyes, hoodie, black trousers.
// A pose is a flat numeric vector in character space (origin = hip, +x forward, +y down), so poses blend with lerp.
// CH.draw(g, o) renders the character into a small offscreen (so it can be lit with source-atop), then composites it.
// The same rig draws the wall SHADOW (flat silhouette, optional faint eyes).
// Pure function of its inputs; no timers, no Math.random.
const CH = (() => {
  const TL = 92, UA = 52, FA = 50, TH = 60, SH = 58, HR = 40, HOOD_R = 51;

  // ------------------------------------------------------------------ poses
  const BASE = {
    torso: 0, hx: 6, hy: -54, hrot: 0,
    hfx: 12, hfy: -22, hbx: -4, hby: -26,         // hands (front = near camera side, back = far)
    ffx: 14, ffy: 112, fbx: -12, fby: 112,        // feet
    rot: 0, dx: 0, dy: 0,                          // whole-body rotation about the hip, hip offset
    open: 1, happy: 0, tilt: 0, lookx: 0, looky: 0, bags: 0 // eyes
  };
  const KEYS = Object.keys(BASE);
  const mk = (o) => Object.assign({}, BASE, o);
  const POSES = {
    stand:    mk({}),
    standPhone: mk({ torso: 0.06, hrot: 0.08, hfx: 50, hfy: -74, hbx: 38, hby: -68, hx: 8, hy: -52, looky: 0.5 }),
    sitBed:   mk({ torso: -0.1, hx: 8, hy: -54, hfx: 70, hfy: -70, hbx: 54, hby: -62, ffx: 56, ffy: 80, fbx: 36, fby: 82, looky: 0.35 }),
    sitBedSlump: mk({ torso: 0.28, hx: 16, hy: -48, hrot: 0.24, hfx: 62, hfy: -48, hbx: 46, hby: -44, ffx: 56, ffy: 80, fbx: 36, fby: 82, looky: 0.5, open: 0.7 }),
    sitDesk:  mk({ torso: 0.2, hx: 14, hy: -52, hrot: 0.22, hfx: 100, hfy: -40, hbx: 70, hby: -38, ffx: 50, ffy: 80, fbx: 30, fby: 82, looky: 0.6 }),
    lieBack:  mk({ rot: -Math.PI / 2, torso: 0, hx: 4, hy: -54, hfx: 42, hfy: -150, hbx: 30, hby: -140, ffx: 36, ffy: 74, fbx: 22, fby: 70, lookx: 0.2, looky: -0.1 }),
    lieSleep: mk({ rot: -Math.PI / 2, torso: 0, hx: 6, hy: -54, hfx: 14, hfy: -70, hbx: 2, hby: -66, ffx: 34, ffy: 80, fbx: 20, fby: 76, open: 0, happy: 0 }),
    curl:     mk({ rot: -Math.PI / 2, torso: 0.62, hx: 18, hy: -46, hrot: 0.4, hfx: 40, hfy: -30, hbx: 28, hby: -34, ffx: 52, ffy: 46, fbx: 38, fby: 52, open: 0 }),
    sitFloor: mk({ dy: 84, torso: 0.2, hx: 14, hy: -48, hrot: 0.38, hfx: 76, hfy: 52, hbx: 62, hby: 56, ffx: 86, ffy: 112, fbx: 70, fby: 112, looky: 0.8, open: 0.75, tilt: -0.4 }),
    stretch:  mk({ torso: -0.08, hx: 2, hy: -56, hrot: -0.2, hfx: 36, hfy: -176, hbx: 14, hby: -178, open: 0.5 }),
    tapWrist: mk({ torso: 0.04, hfx: 50, hfy: -60, hbx: 66, hby: -64, lookx: 0.1 }),
    slump:    mk({ torso: 0.42, hx: 18, hy: -46, hrot: 0.3, hfx: 24, hfy: -6, hbx: 8, hby: -10, open: 0.55, tilt: -0.5 }),
    reachUp:  mk({ torso: 0.05, hfx: 70, hfy: -100, hbx: 20, hby: -40 }),
  };
  // Walk with planted feet: while a foot is on the ground it moves backwards exactly as fast as the hip moves forwards,
  // so it does not skate. ph advances PI per step; the caller moves the hip `stride` (character units) per step.
  function footAt(p, S) {
    p = ((p % TAU) + TAU) % TAU;
    if (p < Math.PI) return { x: S / 2 - S * (p / Math.PI), lift: 0 };
    const u = (p - Math.PI) / Math.PI; return { x: -S / 2 + S * (u * u * (3 - 2 * u)), lift: Math.sin(u * Math.PI) * 26 * (1 - 0.3 * u) };
  }
  function walkPose(ph, phone, stride) {
    const S = stride || 84, A = footAt(ph, S), B = footAt(ph + Math.PI, S), c2 = Math.cos(2 * ph);
    const p = mk({ torso: 0.085 + 0.015 * c2, hrot: 0.03 - 0.025 * c2, hy: -54 + 1.5 * c2, dy: 2 + 3 * c2,
      ffx: 8 + A.x, ffy: 112 - A.lift, fbx: 2 + B.x, fby: 112 - B.lift,
      hfx: 12 - A.x * 0.6, hfy: -28 - Math.abs(A.x) * 0.12, hbx: 4 - B.x * 0.6, hby: -30 - Math.abs(B.x) * 0.12 });
    if (phone) { p.hfx = 50; p.hfy = -72 + c2 * 1.5; p.looky = 0.4; }
    return p;
  }
  const blend = (a, b, k) => { const r = {}; for (const key of KEYS) r[key] = a[key] + (b[key] - a[key]) * k; return r; };
  const named = (n) => POSES[n] || POSES.stand;
  // keys: [[time, poseNameOrObject, transitionSeconds?], ...] -> pose at t (ease between consecutive keys)
  function track(t, keys) {
    let cur = typeof keys[0][1] === 'string' ? named(keys[0][1]) : keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [kt, kp, kd] = keys[i], to = typeof kp === 'string' ? named(kp) : kp, d = kd == null ? 0.6 : kd;
      if (t <= kt) return cur;
      const k = clamp((t - kt) / Math.max(d, 1e-3));
      const sm = k * k * (3 - 2 * k), q = sm - 1, e = 1 + 1.55 * q * q * q + 0.55 * q * q;   // smooth start, ~2% settle
      if (k < 1) return blend(cur, to, e);
      cur = to;
    }
    return cur;
  }
  // deterministic blink: a short close roughly every 3-5 s
  function blink(t, seed) {
    const r = rng(seed || 7); let tt = 1 + r() * 2, k = 1;
    for (let i = 0; i < 400 && tt < t + 1; i++) { const dt = t - tt; if (dt >= 0 && dt < 0.16) k = Math.min(k, Math.abs(dt - 0.08) / 0.08); tt += 2.6 + r() * 2.6; }
    return k;
  }

  // ------------------------------------------------------------------ palette
  function palette(hood) {
    const h = hood || [112, 116, 128];
    return { hood: h, hoodDark: mixc(h, [0, 0, 0], 0.4), hoodLight: mixc(h, [255, 255, 255], 0.16), hoodBack: mixc(h, [0, 0, 0], 0.26),
      pants: [22, 22, 28], pantsFar: [14, 14, 19], shoe: [40, 42, 52], shoeFar: [28, 30, 38], head: [12, 12, 16], hand: [14, 14, 18], handFar: [10, 10, 14], eye: [244, 244, 250] };
  }

  // ------------------------------------------------------------------ kinematics in character space
  function solve(V) {
    const hip = { x: V.dx, y: V.dy }, up = (a) => ({ x: Math.sin(a), y: -Math.cos(a) });
    const u = up(V.torso), sh = { x: hip.x + u.x * TL, y: hip.y + u.y * TL };
    const head = { x: sh.x + V.hx, y: sh.y + V.hy };
    const aF = ik2(sh, { x: V.hfx, y: V.hfy }, UA, FA, -1), aB = ik2(sh, { x: V.hbx, y: V.hby }, UA, FA, -1);
    const lF = ik2(hip, { x: V.ffx, y: V.ffy }, TH, SH, 1), lB = ik2(hip, { x: V.fbx, y: V.fby }, TH, SH, 1);
    return { hip, sh, head, aF, aB, lF, lB };
  }

  // ------------------------------------------------------------------ the figure itself (character space, origin hip)
  // phase: 0 = everything (flat silhouettes), 1 = body (lit afterwards), 2 = head + face (drawn after the light pass so it stays black)
  function figure(g, V, pal, t, flat, phase) {
    phase = phase || 0; const body = phase !== 2, headp = phase !== 1;
    const K = solve(V), col = (c) => flat ? flat : css(c);
    if (body) {
      g.fillStyle = col(pal.hoodBack);                               // back arm
      capsule(g, K.sh, K.aB.mid, 17, 14); g.fill(); capsule(g, K.aB.mid, K.aB.end, 14, 12); g.fill();
      g.fillStyle = col(pal.handFar); g.beginPath(); g.arc(K.aB.end.x, K.aB.end.y, 13, 0, TAU); g.fill();
      g.fillStyle = col(pal.pantsFar);                               // back leg
      capsule(g, K.hip, K.lB.mid, 24, 18); g.fill(); capsule(g, K.lB.mid, K.lB.end, 18, 14); g.fill();
      g.fillStyle = col(pal.shoeFar); g.beginPath(); g.ellipse(K.lB.end.x + 12, K.lB.end.y + 6, 24, 11, 0, 0, TAU); g.fill();
      g.fillStyle = col(pal.hood); capsule(g, K.hip, K.sh, 35, 39); g.fill();   // torso
      if (!flat) {
        g.save(); capsule(g, K.hip, K.sh, 35, 39); g.clip();
        const gr = g.createLinearGradient(K.hip.x - 40, K.hip.y, K.hip.x + 40, K.hip.y); gr.addColorStop(0, css(pal.hoodDark, 0.5)); gr.addColorStop(0.55, css(pal.hoodDark, 0)); g.fillStyle = gr; g.fillRect(-120, -260, 240, 400);
        g.strokeStyle = css(pal.hoodDark, 0.8); g.lineWidth = 3; g.beginPath();
        const px = K.hip.x + (K.sh.x - K.hip.x) * 0.2, py = K.hip.y + (K.sh.y - K.hip.y) * 0.2;       // kangaroo pocket
        g.moveTo(px - 8, py - 10); g.quadraticCurveTo(px + 26, py + 4, px + 30, py - 24); g.stroke();
        g.restore();
      }
      g.fillStyle = col(pal.pants);                                  // front leg
      capsule(g, K.hip, K.lF.mid, 25, 19); g.fill(); capsule(g, K.lF.mid, K.lF.end, 19, 15); g.fill();
      g.fillStyle = col(pal.shoe); g.beginPath(); g.ellipse(K.lF.end.x + 13, K.lF.end.y + 6, 26, 12, 0, 0, TAU); g.fill();
      g.fillStyle = col(pal.hoodBack); capsule(g, K.sh, { x: K.head.x - 8, y: K.head.y + 18 }, 30, 30); g.fill();   // neck cowl + hood
      g.fillStyle = col(pal.hood); g.beginPath(); g.ellipse(K.head.x - 10, K.head.y + 3, HOOD_R + 2, HOOD_R, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(K.head.x - 52, K.head.y - 6); g.quadraticCurveTo(K.head.x - 58, K.head.y - 40, K.head.x - 34, K.head.y - 48); g.lineTo(K.head.x - 16, K.head.y - 40); g.closePath(); g.fill();   // the hood's soft peak
      if (!flat) { g.strokeStyle = css(pal.hoodDark, 0.55); g.lineWidth = 3; g.beginPath(); g.arc(K.head.x - 12, K.head.y + 2, HOOD_R - 10, Math.PI * 0.62, Math.PI * 1.32); g.stroke(); }   // seam
      g.fillStyle = col(pal.hoodDark); g.beginPath(); g.ellipse(K.head.x + 7, K.head.y + 2, 43, 45, 0, 0, TAU); g.fill();       // face opening, mostly in front
      g.fillStyle = col(pal.hood);                                   // front arm
      capsule(g, K.sh, K.aF.mid, 18, 15); g.fill(); capsule(g, K.aF.mid, K.aF.end, 15, 12.5); g.fill();
      if (!flat) { g.strokeStyle = css(pal.hoodDark, 0.7); g.lineWidth = 3; g.beginPath(); g.arc(K.aF.end.x - (K.aF.end.x - K.aF.mid.x) * 0.12, K.aF.end.y - (K.aF.end.y - K.aF.mid.y) * 0.12, 11, 0, TAU); g.stroke(); }
      g.fillStyle = col(pal.hand); g.beginPath(); g.arc(K.aF.end.x, K.aF.end.y, 14, 0, TAU); g.fill();
    }
    if (headp) {
      g.save(); g.translate(K.head.x, K.head.y); g.rotate(V.hrot);
      g.fillStyle = col(pal.head); g.beginPath(); g.arc(0, 0, HR, 0, TAU); g.fill();
      if (!flat) {
        if (V._rim) { g.strokeStyle = rgba(V._rim.rgb, Math.min(0.95, V._rim.a)); g.lineWidth = 3.6; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, HR - 1.8, V._rim.ang - V.hrot - 0.95, V._rim.ang - V.hrot + 0.95); g.stroke(); }
        eyes(g, V, pal, t);
      }
      g.restore();
      if (!flat) { g.strokeStyle = css(pal.hoodLight, 0.9); g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(K.head.x + 10, K.head.y + 44); g.lineTo(K.head.x + 14, K.head.y + 64); g.moveTo(K.head.x + 20, K.head.y + 42); g.lineTo(K.head.x + 25, K.head.y + 60); g.stroke(); }
    }
    return K;
  }
  function eyes(g, V, pal, t) {
    const open = clamp(V.open * (V._blink == null ? 1 : V._blink)), lx = V.lookx * 5, ly = V.looky * 4;
    for (let i = 0; i < 2; i++) {
      const cx = (i === 0 ? 10 : 29) + lx, cy = -1 + ly, rx = 8.2, ry = 11.6;
      g.fillStyle = css(pal.eye); g.strokeStyle = css(pal.eye);
      if (V.happy > 0.5) { g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy + 6, 9, Math.PI * 1.12, Math.PI * 1.88); g.stroke(); continue; }
      if (open < 0.12) { g.lineWidth = 4.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 8, cy + 2); g.quadraticCurveTo(cx, cy + 8, cx + 8, cy + 2); g.stroke(); continue; }
      g.beginPath(); g.ellipse(cx, cy, rx, ry * (0.35 + 0.65 * open), 0, 0, TAU); g.fill();
      if (V.bags > 0.02) { g.strokeStyle = `rgba(150,158,182,${0.5 * V.bags})`; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy + ry * 0.5, rx * 1.15, 0.25, Math.PI - 0.25); g.stroke(); }
      if (Math.abs(V.tilt) > 0.02) {        // lid slanting: negative = sad (outer side down)
        g.fillStyle = css(pal.head); const s = V.tilt * (i === 0 ? 1 : -1) * 9;
        g.beginPath(); g.moveTo(cx - 14, cy - ry - 4 + s * -1); g.lineTo(cx + 14, cy - ry - 4 + s); g.lineTo(cx + 14, cy - ry * 0.35 + s); g.lineTo(cx - 14, cy - ry * 0.35 - s); g.closePath(); g.fill();
      }
    }
  }

  // ------------------------------------------------------------------ offscreen compositing
  const _oc = {};
  function layer(w, h, tag) { const k = w + 'x' + h + (tag || ''); if (!_oc[k]) { const c = document.createElement('canvas'); c.width = w; c.height = h; _oc[k] = c; } return _oc[k]; }
  const OC = 760; // world units covered by the offscreen, centred on the hip

  // o = { x, y (world hip), s, flip, pose(vector), t, res (camera zoom, for crisp close-ups), hood(rgb), lights[], alpha,
  //       shadow:{fill,blur,eyes} }  -> returns joints in world space
  function draw(g, o) {
    const res = Math.max(1, Math.min(3, o.res || 1)), S = Math.round(OC * res);
    const c = layer(S, S), x = c.getContext('2d'), s = o.s == null ? 1 : o.s, flip = o.flip < 0 ? -1 : 1, V = Object.assign({}, o.pose);
    V._blink = o.shadow ? 1 : blink(o.t || 0, o.seed);
    if (o.breathe !== false) { const bt = Math.sin((o.t || 0) * 1.6 + (o.seed || 0)); V.torso += 0.008 * bt; V.hy += 1.2 * bt; }
    const pal = palette(o.hood);
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, S, S); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.setTransform(res * s * flip, 0, 0, res * s, S / 2, S / 2);
    x.rotate(V.rot * flip);
    const flat = o.shadow ? o.shadow.fill : null;
    const K = figure(x, V, pal, o.t || 0, flat, flat ? 0 : 1);
    if (o.shadow && o.shadow.eyes) {          // faint eyes on the silhouette
      x.save(); x.translate(K.head.x, K.head.y); x.rotate(V.hrot); x.fillStyle = 'rgba(210,214,226,' + o.shadow.eyes + ')';
      const op = clamp(V.open * 1);
      for (let i = 0; i < 2; i++) { x.beginPath(); x.ellipse((i ? 29 : 10) + V.lookx * 5, -1 + V.looky * 4, 7, 10 * (0.3 + 0.7 * op), 0, 0, TAU); x.fill(); }
      x.restore();
    }
    if (o.hood2) {                              // hem-to-collar colour wipe: a second, recoloured figure revealed below a rising line
      const c2 = layer(S, S, 'b'), x2 = c2.getContext('2d');
      x2.setTransform(1, 0, 0, 1, 0, 0); x2.globalCompositeOperation = 'source-over'; x2.globalAlpha = 1; x2.clearRect(0, 0, S, S);
      x2.setTransform(res * s * flip, 0, 0, res * s, S / 2, S / 2); x2.rotate(V.rot * flip);
      figure(x2, V, palette(o.hood2.rgb), o.t || 0, null, 1);
      x2.setTransform(1, 0, 0, 1, 0, 0); x2.globalCompositeOperation = 'destination-in';
      const ly = (o.hood2.line - o.y) * res + S / 2, soft = (o.hood2.soft || 40) * res, mg = x2.createLinearGradient(0, ly - soft, 0, ly + soft);
      mg.addColorStop(0, 'rgba(0,0,0,0)'); mg.addColorStop(1, 'rgba(0,0,0,1)'); x2.fillStyle = mg; x2.fillRect(0, 0, S, S);
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.drawImage(c2, 0, 0);
    }
    // lights: source-atop gradients (positions are world coords); the head is drawn afterwards so it stays black
    if (!o.shadow && o.lights) {
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-atop';
      for (const L of o.lights) {
        const lx = (L.x - o.x) * res + S / 2, ly = (L.y - o.y) * res + S / 2, R = L.r * res;
        const gr = x.createRadialGradient(lx, ly, 0, lx, ly, R); gr.addColorStop(0, rgba(L.rgb, L.a)); gr.addColorStop(1, rgba(L.rgb, 0));
        x.fillStyle = gr; x.fillRect(0, 0, S, S);
      }
      x.globalCompositeOperation = 'source-over';
    }
    if (!o.shadow) {
      const ca0 = Math.cos(V.rot * flip), sa0 = Math.sin(V.rot * flip);
      const hw = { x: o.x + (K.head.x * ca0 - K.head.y * sa0) * s * flip, y: o.y + (K.head.x * sa0 + K.head.y * ca0) * s };
      let best = null, bd = 1e9; for (const L of (o.lights || [])) { const d = Math.hypot(L.x - hw.x, L.y - hw.y) / Math.max(1, L.r); if (d < bd && d < 1.2) { bd = d; best = L; } }
      if (best) { const dx = (best.x - hw.x) * flip, dy = best.y - hw.y, ac = Math.cos(-V.rot * flip), as = Math.sin(-V.rot * flip); V._rim = { ang: Math.atan2(dx * as + dy * ac, dx * ac - dy * as), rgb: best.rgb, a: best.a * (1 - bd * 0.6) * 1.1 }; }
      x.setTransform(res * s * flip, 0, 0, res * s, S / 2, S / 2); x.rotate(V.rot * flip);
      figure(x, V, pal, o.t || 0, null, 2);
    }
    g.save();
    g.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    if (o.shadow && o.shadow.blur) g.filter = `blur(${o.shadow.blur}px)`;
    g.drawImage(c, o.x - OC / 2, o.y - OC / 2, OC, OC);
    g.restore();
    // joints in world space
    const ca = Math.cos(V.rot * flip), sa = Math.sin(V.rot * flip);
    const W = (p) => { const rx = p.x * ca - p.y * sa, ry = p.x * sa + p.y * ca; return { x: o.x + rx * s * flip, y: o.y + ry * s }; };
    return { handF: W(K.aF.end), handB: W(K.aB.end), head: W(K.head), hip: W(K.hip), shoulder: W(K.sh), footF: W(K.lF.end), footB: W(K.lB.end), toWorld: W };
  }

  return { draw, poses: POSES, named, blend, track, walkPose, mk, palette, blink, BASE };
})();
