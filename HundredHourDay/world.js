// world.js — painted 2.5D dusk street. Pure functions of (cam, t). Static art is pre-rendered once to cached canvases.
// Globals exported: GROUND, withLayer, project, drawWorld, drawForeground, drawShadow, postFX, visionGrade, flash, rgbSplit, warmWorld
const GROUND = { sidewalk: 820, roadFar: 868, roadMid: 905, roadNear: 985, sun: { x: 620, y: 430 } };

const { withLayer, project, drawWorld, drawForeground, drawShadow, postFX, visionGrade, flash, rgbSplit, warmWorld } = (function () {
  const W = 1920, H = 1080;
  const SUN = GROUND.sun;

  // ---------- small helpers ----------
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mixc = (A, B, t) => [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];
  const H2 = (h) => hex2rgb(h);
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
  const CACHE = {};
  const cached = (key, fn) => (CACHE[key] || (CACHE[key] = fn()));
  const zsOf = (cam, p) => 1 + (cam.z - 1) * (0.25 + 0.75 * Math.min(p, 1.2));

  function withLayer(g, cam, p, fn) {
    const zs = zsOf(cam, p);
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(zs, zs);
    g.translate(-cam.x * p, -(540 + (cam.y - 540) * p));
    fn();
    g.restore();
  }
  function project(cam, wx, wy, p = 1) {
    const zs = zsOf(cam, p);
    return { x: W / 2 + zs * (wx - cam.x * p), y: H / 2 + zs * (wy - (540 + (cam.y - 540) * p)) };
  }
  function visX(cam, p, margin = 60) {
    const zs = zsOf(cam, p), cx = cam.x * p, half = (W / 2) / zs + margin;
    return [cx - half, cx + half];
  }
  function radial(g, x, y, r, stops) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    for (const s of stops) gr.addColorStop(s[0], s[1]);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }

  // ---------- sky colour ramp (world y) ----------
  const SKY = [[-700, '#120a2c'], [-250, '#241648'], [20, '#47236a'], [200, '#8a3478'], [370, '#d44f7a'], [530, '#ff8a58'], [800, '#ffb070']].map(s => [s[0], H2(s[1])]);
  function skyAt(y) {
    if (y <= SKY[0][0]) return SKY[0][1];
    for (let i = 1; i < SKY.length; i++) if (y <= SKY[i][0]) return mixc(SKY[i - 1][1], SKY[i][1], smooth((y - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0])));
    return SKY[SKY.length - 1][1];
  }
  const ORANGE = H2('#ffb36b');

  // ---------- big layer canvases ----------
  function layerCanvas(key, x0, x1, y0, y1, sc, paint) {
    return cached(key, () => {
      const c = mk((x1 - x0) * sc, (y1 - y0) * sc);
      const ctx = c.getContext('2d');
      ctx.scale(sc, sc); ctx.translate(-x0, -y0);
      paint(ctx);
      return { c, x0, x1, y0, y1, sc };
    });
  }
  function drawLayer(g, L, vx0, vx1) {
    const sx = Math.max(0, Math.floor((vx0 - L.x0) * L.sc)), ex = Math.min(L.c.width, Math.ceil((vx1 - L.x0) * L.sc));
    if (ex <= sx) return;
    g.drawImage(L.c, sx, 0, ex - sx, L.c.height, L.x0 + sx / L.sc, L.y0, (ex - sx) / L.sc, L.y1 - L.y0);
  }

  // ---------- building painter ----------
  function rimStrip(c, x, y, h, w, a) {
    const gr = c.createLinearGradient(x - w * 5, 0, x, 0);
    gr.addColorStop(0, 'rgba(255,150,90,0)'); gr.addColorStop(1, rgba(ORANGE, a * 0.30));
    c.fillStyle = gr; c.fillRect(x - w * 5, y, w * 5, h);
    const g2 = c.createLinearGradient(0, y, 0, y + h);
    g2.addColorStop(0, rgba(ORANGE, a)); g2.addColorStop(0.55, rgba(ORANGE, a * 0.7)); g2.addColorStop(1, rgba([255, 120, 80], a * 0.4));
    c.fillStyle = g2; c.fillRect(x - w, y, w, h);
  }
  const LIT = ['#ffd68a', '#ffc266', '#ffab55', '#ffe3b0', '#ff9a5a', '#ffcf70'].map(H2);
  function windows(c, r, x, y, w, h, P) {
    const cw = P.cw * (0.9 + r() * 0.2), ch = P.ch * (0.9 + r() * 0.2);
    const cols = Math.max(1, Math.floor((w - 14) / cw)), rows = Math.max(1, Math.floor((h - 18) / ch));
    const ox = x + (w - cols * cw) / 2, oy = y + 10;
    for (let j = 0; j < rows; j++) {
      const rowDim = r() < 0.16 ? 0.25 : 1;
      const fy = j / Math.max(1, rows - 1);
      for (let i = 0; i < cols; i++) {
        if (r() < 0.05) continue;
        const wx = ox + i * cw + cw * 0.22 + (r() - 0.5) * 2, wy = oy + j * ch + ch * 0.2 + (r() - 0.5) * 1.5;
        const ww = cw * (0.5 + r() * 0.08), wh = ch * (0.55 + r() * 0.1);
        const lit = r() < P.litP * rowDim * (0.7 + 0.6 * fy);
        if (lit) {
          const col = LIT[(r() * LIT.length) | 0], br = 0.6 + r() * 0.4;
          c.fillStyle = rgba(col, 0.13 * br); c.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
          c.fillStyle = rgba(col, 0.55 + 0.45 * br); c.fillRect(wx, wy, ww, wh);
          if (r() < 0.3) { c.fillStyle = rgba([60, 25, 40], 0.5); c.fillRect(wx + ww * 0.45, wy, 1, wh); }
        } else {
          const refl = (1 - fy) * 0.18 * ((i + 1) / cols);
          c.fillStyle = rgba([150, 100, 190], 0.16 + r() * 0.10); c.fillRect(wx, wy, ww, wh);
          c.fillStyle = rgba([255, 140, 110], refl); c.fillRect(wx, wy, ww, wh);
        }
      }
    }
  }
  function roofProps(c, r, x, top, w, P) {
    const dark = rgba(P.cL, 1);
    const n = (r() * 3) | 0;
    for (let k = 0; k < n; k++) {
      const t = r();
      const px = x + 10 + r() * (w - 40);
      if (t < 0.35) { // water tank
        const tw = 22 + r() * 10, th = 26;
        c.fillStyle = rgba(mixc(P.cL, P.cR, 0.35), 1); c.fillRect(px, top - th, tw, th);
        c.beginPath(); c.moveTo(px - 2, top - th); c.lineTo(px + tw / 2, top - th - 14); c.lineTo(px + tw + 2, top - th); c.fill();
        c.fillStyle = dark; c.fillRect(px + 3, top - 4, 2, 4); c.fillRect(px + tw - 5, top - 4, 2, 4);
        c.fillStyle = rgba(ORANGE, 0.8); c.fillRect(px + tw - 2, top - th, 2, th);
      } else if (t < 0.7) { // antenna mast
        c.fillStyle = dark; const hh = 30 + r() * 50; c.fillRect(px, top - hh, 2, hh);
        c.fillRect(px - 6, top - hh * 0.8, 14, 2); c.fillRect(px - 4, top - hh * 0.55, 10, 2);
        c.fillStyle = rgba([255, 70, 90], 0.9); c.fillRect(px - 1, top - hh - 2, 4, 4);
        c.fillStyle = rgba([255, 70, 90], 0.18); c.beginPath(); c.arc(px + 1, top - hh, 8, 0, TAU); c.fill();
      } else { // AC box
        c.fillStyle = rgba(mixc(P.cL, P.cR, 0.45), 1); c.fillRect(px, top - 12, 26, 12);
        c.fillStyle = rgba(ORANGE, 0.7); c.fillRect(px + 24, top - 12, 2, 12);
      }
    }
  }
  function building(c, r, x, top, w, bot, P, depth) {
    // body
    let gr = c.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, rgba(P.cL)); gr.addColorStop(0.65, rgba(mixc(P.cL, P.cR, 0.55))); gr.addColorStop(1, rgba(P.cR));
    c.fillStyle = gr; c.fillRect(x, top, w, bot - top);
    // top sky-wash and bottom bounce
    gr = c.createLinearGradient(0, top, 0, bot);
    gr.addColorStop(0, rgba([255, 120, 140], P.topWash)); gr.addColorStop(0.35, 'rgba(255,120,140,0)');
    gr.addColorStop(0.72, 'rgba(255,140,80,0)'); gr.addColorStop(1, rgba([255, 140, 70], P.botWash));
    c.fillStyle = gr; c.fillRect(x, top, w, bot - top);
    // painterly soft blotches
    for (let k = 0; k < 4; k++) {
      const bx = x + r() * w, by = top + r() * Math.min(bot - top, 600), br = 40 + r() * 90, warm = r() < 0.5;
      radial(c, bx, by, br, [[0, warm ? 'rgba(255,150,100,0.07)' : 'rgba(20,8,40,0.12)'], [1, 'rgba(0,0,0,0)']]);
    }
    // floor ledges
    c.fillStyle = 'rgba(15,6,30,0.22)';
    const step = P.ch * (4 + ((r() * 3) | 0));
    for (let yy = top + step; yy < Math.min(bot, top + 700); yy += step) c.fillRect(x, yy, w, 2);
    windows(c, r, x, top, w, Math.min(bot - top, 720), P);
    // setback block
    if (!depth && r() < 0.45 && w > 120) {
      const sw = w * (0.45 + r() * 0.25), sh = 40 + r() * 80, sx = r() < 0.5 ? x + 4 : x + w - sw - 4;
      building(c, r, sx, top - sh, sw, top + 4, P, 1);
    } else roofProps(c, r, x, top, w, P);
    // rim
    rimStrip(c, x + w, top, bot - top, 3.5, 0.9);
    c.fillStyle = rgba(ORANGE, 0.5); c.fillRect(x + w * 0.55, top, w * 0.45, 2);
  }

  // ---------- far skylines ----------
  function paintFar(c, seed, haze, hMin, hMax, sunX, p) {
    const r = rng(seed); const base = 1000;
    let x = -1700;
    const hazeCol = H2('#7c3f7e');
    while (x < 2000) {
      const w = 54 + r() * 100;
      const d = Math.abs(x + w / 2 - sunX);
      const e = smooth((d - 40) / 380);
      const h = lerp(hMin * 0.55, lerp(hMin, hMax, r()), e) + (r() < 0.12 ? 80 * e : 0);
      const top = 790 - h;
      const g0 = mixc(skyAt(top), hazeCol, 1 - haze * 0.6);
      const topC = mixc(g0, [150, 80, 140], 0.25);
      const botC = mixc(skyAt(800), hazeCol, 0.28);
      const gr = c.createLinearGradient(0, top, 0, 860);
      gr.addColorStop(0, rgba(mixc(topC, [60, 30, 90], 1 - haze))); gr.addColorStop(1, rgba(mixc(botC, [90, 45, 100], (1 - haze) * 0.7)));
      c.fillStyle = gr; c.fillRect(x, top, w, base - top);
      // roofline accents
      if (r() < 0.3) { c.fillRect(x + w * 0.3, top - 10 - r() * 20, w * 0.35, 30); }
      if (r() < 0.18) { c.fillRect(x + w * 0.5 - 1, top - 40 - r() * 50, 2, 70); }
      // faint lit windows
      c.fillStyle = rgba([255, 200, 140], 0.22 * (1 - haze * 0.4));
      for (let k = 0; k < w * h / 900; k++) c.fillRect(x + 4 + r() * (w - 8), top + 8 + r() * (h * 0.8), 2, 3);
      // right-edge light
      const rg = c.createLinearGradient(x + w - 6, 0, x + w, 0);
      rg.addColorStop(0, 'rgba(255,180,110,0)'); rg.addColorStop(1, rgba(ORANGE, 0.38));
      c.fillStyle = rg; c.fillRect(x + w - 6, top, 6, base - top);
      x += w + (r() < 0.25 ? 6 + r() * 24 : -2);
    }
    // aerial haze band near the base
    const hg = c.createLinearGradient(0, 560, 0, 860);
    hg.addColorStop(0, 'rgba(255,150,100,0)'); hg.addColorStop(1, rgba(skyAt(800), 0.5));
    c.fillStyle = hg; c.fillRect(-1700, 560, 3700, 440);
  }

  // ---------- mid buildings (tall, p=0.5) ----------
  function paintMid(c) {
    const r = rng(2024);
    const sunX = 572 + 960 * 0.5; // world x where the sun sits behind this layer at cam.x = 960
    const P = { cL: H2('#1c1033'), cR: H2('#47254f'), topWash: 0.10, botWash: 0.22, cw: 21, ch: 29, litP: 0.34 };
    let x = -1900;
    while (x < 2500) {
      const w = 130 + r() * 120;
      const d = Math.abs(x + w / 2 - sunX);
      const e = smooth((d - 90) / 420);
      const hTall = 300 + r() * 230 + (r() < 0.14 ? 130 : 0);
      const h = lerp(215 + r() * 40, hTall, e);
      building(c, r, x, 800 - h, w, 1100, P, 0);
      x += w + (r() < 0.5 ? 0 : 14 + r() * 50);
    }
  }

  // ---------- near row (shorter, shopfronts, p=0.78) ----------
  const AWN = ['#b83e55', '#2a9d8f', '#d9942e', '#5b53b5', '#c4543c'].map(H2);
  function paintNear(c) {
    const r = rng(777);
    const P = { cL: H2('#2c1745'), cR: H2('#6c3a64'), topWash: 0.12, botWash: 0.15, cw: 24, ch: 31, litP: 0.28 };
    let x = -2000;
    while (x < 3200) {
      let gap = 0;
      if (r() < 0.14) gap = 120 + r() * 160; // side street
      x += gap;
      const w = 170 + r() * 150, h = 250 + r() * 150, top = 800 - h;
      building(c, r, x, top - 90, w, 830, P, 1);
      // ground-floor shopfront
      const sy = 690, sh = 110;
      c.fillStyle = rgba([26, 12, 40], 1); c.fillRect(x, sy - 36, w, 36 + sh + 40);
      const nShop = Math.max(1, Math.round(w / 110));
      const sw = (w - 14) / nShop;
      for (let i = 0; i < nShop; i++) {
        const gx = x + 7 + i * sw + 4, gw = sw - 8;
        const lit = r() < 0.75, wl = r() * 0.5;
        const gr = c.createLinearGradient(0, sy + 8, 0, sy + sh);
        if (lit) { gr.addColorStop(0, rgba(mixc([255, 190, 120], [255, 150, 95], wl), 0.82)); gr.addColorStop(1, rgba([214, 96, 84], 0.75)); }
        else { gr.addColorStop(0, rgba([80, 50, 110], 0.8)); gr.addColorStop(1, rgba([46, 26, 70], 0.9)); }
        c.fillStyle = gr; c.fillRect(gx, sy + 8, gw, sh - 8);
        if (lit) { // interior silhouettes
          c.fillStyle = rgba([90, 36, 60], 0.45);
          for (let k = 0; k < 3; k++) c.fillRect(gx + 6 + r() * (gw - 30), sy + 30 + r() * 50, 10 + r() * 22, 14 + r() * 40);
          radial(c, gx + gw / 2, sy + sh - 10, gw * 0.9, [[0, 'rgba(255,170,100,0.20)'], [1, 'rgba(255,170,100,0)']]);
        }
        c.fillStyle = rgba([24, 11, 38], 1); c.fillRect(gx, sy + 8, 3, sh - 8); c.fillRect(gx + gw - 3, sy + 8, 3, sh - 8); c.fillRect(gx + gw / 2 - 1, sy + 8, 2, sh - 8);
        // awning
        const ac = AWN[(r() * AWN.length) | 0], ay = sy - 6, ah = 22;
        for (let s = 0; s < 8; s++) {
          const ax = gx - 2 + s * (gw + 4) / 8, aw = (gw + 4) / 8;
          c.fillStyle = rgba(s % 2 ? mixc(ac, [255, 255, 255], 0.25) : ac, 0.95);
          c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + aw, ay); c.lineTo(ax + aw, ay + ah); c.arc(ax + aw / 2, ay + ah, aw / 2, 0, Math.PI); c.closePath(); c.fill();
        }
        c.fillStyle = 'rgba(20,8,35,0.28)'; c.fillRect(gx - 2, ay, gw + 4, 5);
        c.fillStyle = rgba(ORANGE, 0.55); c.fillRect(gx + gw - 1, ay, 3, ah + 6);
        // sign glow strip
        if (r() < 0.6) {
          const sc2 = LIT[(r() * LIT.length) | 0];
          radial(c, gx + gw / 2, sy - 22, gw * 0.55, [[0, rgba(sc2, 0.28)], [1, rgba(sc2, 0)]]);
          c.fillStyle = rgba(sc2, 0.9); c.fillRect(gx + gw * 0.2, sy - 26, gw * 0.6, 8);
        }
      }
      c.fillStyle = 'rgba(15,6,30,0.5)'; c.fillRect(x, sy + sh, w, 40);
      rimStrip(c, x + w, top - 90, 830 - (top - 90), 3.5, 0.9);
      x += w + (r() < 0.4 ? 0 : 8 + r() * 24);
    }
  }

  // ---------- sky art ----------
  function cloudsCanvas() {
    return layerCanvas('clouds', -1500, 1900, 80, 700, 1, (c) => {
      const r = rng(31);
      for (let i = 0; i < 26; i++) {
        const cx = -1400 + r() * 3200, cy = 150 + r() * 460, w = 260 + r() * 640, h = 14 + r() * 34;
        const dist = Math.hypot(cx - SUN.x, cy - SUN.y);
        const warm = clamp(1.05 - dist / 1150) * 0.8 + clamp((cy - 300) / 500) * 0.45;
        c.save(); c.translate(cx, cy); c.scale(1, h / w);
        const gr = c.createRadialGradient(0, 0, 0, 0, 0, w);
        gr.addColorStop(0, 'rgba(70,28,100,0.42)'); gr.addColorStop(0.55, 'rgba(70,28,100,0.2)'); gr.addColorStop(1, 'rgba(70,28,100,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(0, 0, w, 0, TAU); c.fill();
        c.restore();
        c.save(); c.globalCompositeOperation = 'screen'; c.translate(cx + w * 0.1, cy + h * 0.55); c.scale(1, h * 0.55 / w);
        const g2 = c.createRadialGradient(0, 0, 0, 0, 0, w * 0.85);
        const wc = mixc([255, 110, 140], [255, 175, 100], clamp(warm));
        g2.addColorStop(0, rgba(wc, 0.45 * clamp(warm + 0.25))); g2.addColorStop(1, rgba(wc, 0));
        c.fillStyle = g2; c.beginPath(); c.arc(0, 0, w * 0.85, 0, TAU); c.fill();
        c.restore();
      }
    });
  }
  function starsCanvas() {
    return layerCanvas('stars', -1500, 1900, -700, 120, 1, (c) => {
      const r = rng(9);
      for (let i = 0; i < 90; i++) {
        const x = -1500 + r() * 3400, y = -700 + r() * 820, a = (0.15 + r() * 0.5) * clamp(1 - (y + 700) / 800 + 0.15);
        c.fillStyle = `rgba(255,235,255,${a})`; c.fillRect(x, y, 1.6, 1.6);
      }
    });
  }
  const RAYS = (() => { const r = rng(55); const a = []; for (let i = 0; i < 14; i++) a.push({ ang: 0.15 + r() * 2.7, w: 0.015 + r() * 0.05, len: 1800 + r() * 900, ph: r() * TAU, a: 0.05 + r() * 0.08 }); return a; })();
  function drawRays(g, t, k) {
    g.save(); g.translate(SUN.x, SUN.y); g.globalCompositeOperation = 'screen';
    for (const ry of RAYS) {
      const al = ry.a * k * (0.65 + 0.35 * Math.sin(t * 0.55 + ry.ph));
      const dx = Math.cos(ry.ang), dy = Math.sin(ry.ang);
      const gr = g.createLinearGradient(0, 0, dx * ry.len, dy * ry.len);
      gr.addColorStop(0, `rgba(255,190,120,${al})`); gr.addColorStop(0.6, `rgba(255,150,110,${al * 0.35})`); gr.addColorStop(1, 'rgba(255,140,120,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0);
      g.lineTo(Math.cos(ry.ang - ry.w) * ry.len, Math.sin(ry.ang - ry.w) * ry.len);
      g.lineTo(Math.cos(ry.ang + ry.w) * ry.len, Math.sin(ry.ang + ry.w) * ry.len);
      g.closePath(); g.fill();
    }
    g.restore();
  }
  function drawSky(g, t) {
    // gradient (cached as a tall strip)
    const sk = cached('skyGrad', () => {
      const c = mk(8, 2200), x = c.getContext('2d');
      const gr = x.createLinearGradient(0, 0, 0, 2200);
      for (let i = 0; i <= 22; i++) { const y = -800 + i * (2200 / 22 * 1); gr.addColorStop(i / 22, rgba(skyAt(y + 0))); }
      x.fillStyle = gr; x.fillRect(0, 0, 8, 2200); return c;
    });
    g.drawImage(sk, -3000, -800, 8000, 2200);
    const st = starsCanvas(); g.drawImage(st.c, st.x0, st.y0);
    const cl = cloudsCanvas(); g.drawImage(cl.c, cl.x0 + t * 4, cl.y0);
    // sun
    g.save(); g.translate(SUN.x, SUN.y); g.globalCompositeOperation = 'screen';
    radial(g, 0, 0, 1600, [[0, 'rgba(255,165,100,0.40)'], [0.3, 'rgba(255,120,115,0.20)'], [0.65, 'rgba(230,90,130,0.07)'], [1, 'rgba(200,80,140,0)']]);
    radial(g, 0, 0, 640, [[0, 'rgba(255,190,115,0.50)'], [0.5, 'rgba(255,150,100,0.18)'], [1, 'rgba(255,130,100,0)']]);
    radial(g, 0, 0, 250, [[0, 'rgba(255,230,170,0.75)'], [0.5, 'rgba(255,190,110,0.30)'], [1, 'rgba(255,160,100,0)']]);
    // anamorphic streak
    g.save(); g.scale(1, 0.032); radial(g, 0, 0, 1500, [[0, 'rgba(255,215,160,0.70)'], [0.4, 'rgba(255,170,120,0.22)'], [1, 'rgba(255,140,120,0)']]); g.restore();
    g.save(); g.scale(1, 0.12); radial(g, 0, 0, 800, [[0, 'rgba(255,190,130,0.22)'], [1, 'rgba(255,140,120,0)']]); g.restore();
    const pulse = 1 + 0.012 * Math.sin(t * 1.3);
    g.globalCompositeOperation = 'source-over';
    radial(g, 0, 0, 118 * pulse, [[0, '#fffdf2'], [0.42, '#fff0c0'], [0.66, '#ffd088'], [0.82, 'rgba(255,178,100,0.75)'], [0.93, 'rgba(255,150,90,0.25)'], [1, 'rgba(255,140,80,0)']]);
    g.globalCompositeOperation = 'screen';
    // lens ghosts
    const ghosts = [[0.55, 26, 'rgba(255,150,90,0.10)'], [1.0, 54, 'rgba(255,110,150,0.08)'], [1.55, 18, 'rgba(255,220,150,0.13)'], [2.2, 70, 'rgba(180,120,255,0.06)'], [2.9, 34, 'rgba(255,180,110,0.09)']];
    for (const gh of ghosts) {
      const gx = -gh[0] * 300, gy = gh[0] * 170;
      radial(g, gx, gy, gh[1], [[0, gh[2]], [0.85, gh[2]], [1, 'rgba(255,200,150,0)']]);
      g.strokeStyle = gh[2]; g.lineWidth = 2; g.beginPath(); g.arc(gx, gy, gh[1] * 0.92, 0, TAU); g.stroke();
    }
    g.restore();
    drawRays(g, t, 1.0);
  }

  // ---------- ground texture ----------
  function groundTex() {
    return cached('groundTex', () => {
      const c = mk(512, 256), x = c.getContext('2d'), r = rng(404);
      for (let i = 0; i < 1400; i++) {
        const light = r() < 0.45, s = 0.8 + r() * 2.2;
        x.fillStyle = light ? `rgba(255,205,175,${0.04 + r() * 0.09})` : `rgba(10,4,24,${0.07 + r() * 0.12})`;
        x.fillRect(r() * 512, r() * 256, s * (1 + r() * 2), s);
      }
      for (let i = 0; i < 46; i++) { x.fillStyle = `rgba(255,190,170,${0.015 + r() * 0.02})`; x.fillRect(r() * 512, r() * 256, 60 + r() * 140, 1 + r() * 2); }
      return c;
    });
  }

  // ---------- trees ----------
  function treeSprite(variant) {
    return cached('tree' + variant, () => {
      const sc = 2.5, w = 340, h = 460, cx = w / 2, by = h - 20;
      const c = mk(w * sc, h * sc), x = c.getContext('2d'), r = rng(300 + variant * 17);
      x.scale(sc, sc);
      // trunk
      const tl = 8 + r() * 3;
      let gr = x.createLinearGradient(cx - tl, 0, cx + tl, 0);
      gr.addColorStop(0, '#1b0f2c'); gr.addColorStop(0.7, '#2c1a40'); gr.addColorStop(1, '#4a2c4c');
      x.fillStyle = gr;
      x.beginPath(); x.moveTo(cx - tl - 3, by); x.quadraticCurveTo(cx - tl + 1, by - 60, cx - 5, by - 150); x.lineTo(cx + 5, by - 150); x.quadraticCurveTo(cx + tl, by - 60, cx + tl + 3, by); x.closePath(); x.fill();
      x.fillStyle = rgba(ORANGE, 0.7); x.fillRect(cx + tl - 2, by - 140, 2, 140);
      // branches
      x.strokeStyle = '#25163a'; x.lineWidth = 5; x.lineCap = 'round';
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx, by - 120); x.quadraticCurveTo(cx + s * 25, by - 160, cx + s * 52, by - 200); x.stroke(); }
      // canopy: dark silhouette first, then lit highlights clipped to it (source-atop), then rim
      const ccx = cx, ccy = by - 235, blobs = [];
      for (let i = 0; i < 22; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * 74;
        blobs.push({ x: ccx + Math.cos(a) * d * 1.1, y: ccy + Math.sin(a) * d * 0.9, r: 38 + r() * 26 });
      }
      blobs.sort((a, b) => a.y - b.y);
      x.fillStyle = '#322a66';
      for (const b of blobs) { x.beginPath(); x.arc(b.x, b.y, b.r, 0, TAU); x.fill(); }
      x.globalCompositeOperation = 'source-atop';
      // underside shadow / lit top-right
      let g2 = x.createRadialGradient(ccx - 50, ccy + 70, 10, ccx - 20, ccy + 30, 150);
      g2.addColorStop(0, 'rgba(14,6,36,0.75)'); g2.addColorStop(1, 'rgba(14,6,36,0)');
      x.fillStyle = g2; x.fillRect(0, 0, w, h);
      for (const b of blobs) {
        const lf = clamp(((b.x - ccx) * 0.8 - (b.y - ccy) * 0.5) / 90 * 0.5 + 0.5);
        const hx = b.x + b.r * 0.38, hy = b.y - b.r * 0.38;
        g2 = x.createRadialGradient(hx, hy, 0, hx, hy, b.r * 0.95);
        g2.addColorStop(0, rgba(mixc([170, 90, 150], [255, 160, 105], lf), 0.10 + 0.50 * lf * lf)); g2.addColorStop(1, 'rgba(255,150,100,0)');
        x.fillStyle = g2; x.beginPath(); x.arc(b.x, b.y, b.r, 0, TAU); x.fill();
      }
      // leaf clumps (painterly specks)
      for (let i = 0; i < 220; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * 100, px = ccx + Math.cos(a) * d * 1.1, py = ccy + Math.sin(a) * d * 0.9;
        const lit = (px - ccx) * 0.8 - (py - ccy) * 0.4 > 10 && r() < 0.65;
        x.fillStyle = lit ? `rgba(255,170,130,${0.10 + r() * 0.2})` : `rgba(14,6,36,${0.18 + r() * 0.3})`;
        x.beginPath(); x.ellipse(px, py, 2 + r() * 4, 1.4 + r() * 2.4, r() * 3, 0, TAU); x.fill();
      }
      x.globalCompositeOperation = 'source-over';
      // thin orange rim: silhouette minus itself shifted left
      const rc = mk(w * sc, h * sc), rx = rc.getContext('2d');
      rx.drawImage(c, 0, 0); rx.globalCompositeOperation = 'destination-out'; rx.drawImage(c, -4.5 * sc, 1.5 * sc);
      rx.globalCompositeOperation = 'source-in'; rx.fillStyle = rgba(ORANGE, 0.9); rx.fillRect(0, 0, w * sc, h * sc);
      x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(rc, 0, 0);
      return { c, w, h, cx, by };
    });
  }
  const TREES = [-2900, -2250, -1580, -970, -330, 330, 1420, 2060, 2780, 3400].map((x, i) => ({ x, v: i % 3 }));
  const LAMPS = [-2500, -1330, -560, 640, 1760, 2500, 3250];

  function drawTree(g, tr) {
    const s = treeSprite(tr.v), sc = 1.0;
    // shadow on the sidewalk, falling left
    radial(g, tr.x - 120, 806, 150, [[0, 'rgba(18,8,36,0.38)'], [1, 'rgba(18,8,36,0)']]);
    g.drawImage(s.c, tr.x - s.cx * sc, 790 - s.by * sc, s.w * sc, s.h * sc);
  }
  function drawLamp(g, x, base, t) {
    const topY = base - 305;
    g.save();
    g.fillStyle = '#1d1030';
    g.fillRect(x - 3.5, topY, 7, base - topY);
    g.fillRect(x - 9, base - 18, 18, 18);
    g.fillRect(x - 6, base - 34, 12, 16);
    g.fillStyle = rgba(ORANGE, 0.7); g.fillRect(x + 3, topY + 6, 1.6, base - topY - 8);
    g.strokeStyle = '#1d1030'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, topY + 4); g.quadraticCurveTo(x + 4, topY - 18, x + 40, topY - 14); g.stroke();
    g.fillStyle = '#241439';
    g.beginPath(); g.moveTo(x + 28, topY - 14); g.lineTo(x + 58, topY - 14); g.lineTo(x + 52, topY - 22); g.lineTo(x + 34, topY - 22); g.closePath(); g.fill();
    // lantern glass
    const lx = x + 43, ly = topY - 8;
    g.fillStyle = '#fff1c4'; g.beginPath(); g.moveTo(x + 31, topY - 13); g.lineTo(x + 55, topY - 13); g.lineTo(x + 50, topY + 1); g.lineTo(x + 36, topY + 1); g.closePath(); g.fill();
    g.restore();
    const br = 1 + 0.035 * Math.sin(t * 2.1 + x * 0.013);
    g.save(); g.globalCompositeOperation = 'screen';
    radial(g, lx, ly, 230 * br, [[0, 'rgba(255,200,120,0.60)'], [0.18, 'rgba(255,170,95,0.30)'], [0.5, 'rgba(255,130,90,0.09)'], [1, 'rgba(255,120,90,0)']]);
    radial(g, lx, ly, 34 * br, [[0, 'rgba(255,250,225,0.95)'], [1, 'rgba(255,220,150,0)']]);
    g.save(); g.translate(lx, 808); g.scale(1, 0.13);
    radial(g, 0, 0, 260, [[0, 'rgba(255,175,100,0.50)'], [1, 'rgba(255,150,90,0)']]);
    g.restore();
    g.restore();
  }

  // ---------- ground ----------
  function drawGround(g, cam, t, vx0, vx1) {
    const X0 = vx0 - 40, X1 = vx1 + 40, GW = X1 - X0;
    const tex = g.createPattern(groundTex(), 'repeat');
    // sidewalk
    let gr = g.createLinearGradient(0, 770, 0, 852);
    gr.addColorStop(0, '#46305f'); gr.addColorStop(0.35, '#7a5688'); gr.addColorStop(1, '#c08598');
    g.fillStyle = gr; g.fillRect(X0, 770, GW, 84);
    // sun-side warm wash (screen-right)
    gr = g.createLinearGradient(cam.x - 900 / cam.z, 0, cam.x + 1000 / cam.z, 0);
    gr.addColorStop(0, 'rgba(255,150,90,0)'); gr.addColorStop(1, 'rgba(255,150,90,0.20)');
    g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.fillRect(X0, 770, GW, 84); g.restore();
    // paving seams (slanted, soft)
    g.lineWidth = 2;
    const s0 = Math.floor(X0 / 150) * 150;
    for (let x = s0; x < X1; x += 150) {
      g.strokeStyle = 'rgba(26,12,46,0.17)'; g.beginPath(); g.moveTo(x, 772); g.lineTo(x - 22, 850); g.stroke();
      g.strokeStyle = 'rgba(255,200,170,0.10)'; g.beginPath(); g.moveTo(x + 2.5, 772); g.lineTo(x - 19.5, 850); g.stroke();
    }
    g.strokeStyle = 'rgba(26,12,46,0.12)'; g.beginPath(); g.moveTo(X0, 810); g.lineTo(X1, 810); g.stroke();
    g.fillStyle = tex; g.globalAlpha = 0.9; g.fillRect(X0, 770, GW, 84); g.globalAlpha = 1;
    // building ambient occlusion on the pavement
    gr = g.createLinearGradient(0, 770, 0, 812);
    gr.addColorStop(0, 'rgba(14,5,30,0.62)'); gr.addColorStop(1, 'rgba(14,5,30,0)');
    g.fillStyle = gr; g.fillRect(X0, 770, GW, 42);

    // road
    gr = g.createLinearGradient(0, 862, 0, 1500);
    gr.addColorStop(0, '#54406c'); gr.addColorStop(0.06, '#41305a'); gr.addColorStop(0.2, '#33244a'); gr.addColorStop(0.35, '#251a3a'); gr.addColorStop(0.55, '#150d26'); gr.addColorStop(1, '#07040e');
    g.fillStyle = gr; g.fillRect(X0, 862, GW, 2400);
    g.save(); g.globalAlpha = 0.8; g.fillStyle = tex; g.fillRect(X0, 862, GW, 360); g.restore();
    // sun sheen on asphalt, under the sun's screen position
    const sp = project(cam, SUN.x, SUN.y, 0.05);
    const sheenX = cam.x + (sp.x - W / 2) / cam.z;
    g.save(); g.globalCompositeOperation = 'screen';
    g.save(); g.translate(sheenX, 900); g.scale(1, 0.3);
    radial(g, 0, 0, 700, [[0, 'rgba(255,150,95,0.62)'], [0.45, 'rgba(255,100,120,0.25)'], [1, 'rgba(255,100,120,0)']]);
    g.restore();
    for (let i = 0; i < 18; i++) { // glitter streaks
      const rr = hash1(i + 400), y = 872 + rr * 120, wv = 40 + hash1(i + 500) * 160;
      const a = 0.05 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.4 + i * 1.7));
      const sx = sheenX + (hash1(i + 600) - 0.5) * 520;
      const lg = g.createLinearGradient(sx - wv, 0, sx + wv, 0);
      lg.addColorStop(0, 'rgba(255,200,150,0)'); lg.addColorStop(0.5, `rgba(255,205,150,${a})`); lg.addColorStop(1, 'rgba(255,200,150,0)');
      g.fillStyle = lg; g.fillRect(sx - wv, y, wv * 2, 2);
    }
    g.restore();
    // gutter shadow + curb
    gr = g.createLinearGradient(0, 862, 0, 884);
    gr.addColorStop(0, 'rgba(8,3,20,0.55)'); gr.addColorStop(1, 'rgba(8,3,20,0)');
    g.fillStyle = gr; g.fillRect(X0, 862, GW, 22);
    // bike-lane tint
    g.fillStyle = 'rgba(70,160,140,0.07)'; g.fillRect(X0, 952, GW, 80);
    // lane markings
    const d0 = Math.floor(X0 / 210) * 210;
    for (let x = d0; x < X1; x += 210) {
      g.fillStyle = 'rgba(255,224,190,0.50)'; g.fillRect(x, 943, 96, 5);
      g.fillStyle = 'rgba(255,170,110,0.4)'; g.fillRect(x + 90, 943, 6, 5);
      g.fillStyle = 'rgba(255,224,190,0.22)'; g.fillRect(x + 60, 887, 64, 3);
    }
    g.fillStyle = 'rgba(255,224,190,0.22)'; g.fillRect(X0, 1036, GW, 3);
    // manholes
    for (let k = Math.floor(X0 / 700) - 1; k < X1 / 700 + 1; k++) {
      const mx = k * 700 + 180 + hash1(k * 7) * 320;
      g.fillStyle = 'rgba(8,3,20,0.30)'; g.beginPath(); g.ellipse(mx, 925 + hash1(k) * 8, 36, 7, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,170,150,0.10)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(mx, 925 + hash1(k) * 8, 36, 7, 0, 0.1, Math.PI - 0.1); g.stroke();
    }
    // curb
    gr = g.createLinearGradient(0, 847, 0, 868);
    gr.addColorStop(0, '#ffd2a2'); gr.addColorStop(0.28, '#e6a58c'); gr.addColorStop(0.3, '#7b5a8c'); gr.addColorStop(0.85, '#2f1f48'); gr.addColorStop(1, '#1a1030');
    g.fillStyle = gr; g.fillRect(X0, 847, GW, 21);
    g.fillStyle = 'rgba(255,230,200,0.5)'; g.fillRect(X0, 847, GW, 1.6);
    // bottom darkness
    gr = g.createLinearGradient(0, 975, 0, 1380);
    gr.addColorStop(0, 'rgba(6,3,14,0)'); gr.addColorStop(1, 'rgba(6,3,14,0.9)');
    g.fillStyle = gr; g.fillRect(X0, 975, GW, 500);
    g.fillStyle = 'rgba(6,3,14,0.9)'; g.fillRect(X0, 1475, GW, 1800);

    // trees + lamps (standing on the back of the sidewalk)
    for (const tr of TREES) if (tr.x > X0 - 200 && tr.x < X1 + 200) drawTree(g, tr);
    for (const lx of LAMPS) if (lx > X0 - 120 && lx < X1 + 120) drawLamp(g, lx, 786, t);
  }

  // ---------- public: drawWorld ----------
  function drawWorld(g, cam, t) {
    g.save();
    withLayer(g, cam, 0.05, () => drawSky(g, t));
    // far skylines
    const f1 = layerCanvas('far1', -1700, 2000, 200, 1000, 1.5, (c) => paintFar(c, 11, 0.55, 360, 540, 572 + 960 * 0.14, 0.14));
    const f2 = layerCanvas('far2', -1700, 2000, 200, 1000, 1.5, (c) => paintFar(c, 12, 0.85, 320, 580, 572 + 960 * 0.26, 0.26));
    withLayer(g, cam, 0.14, () => { const v = visX(cam, 0.14); drawLayer(g, f1, v[0], v[1]); });
    withLayer(g, cam, 0.26, () => { const v = visX(cam, 0.26); drawLayer(g, f2, v[0], v[1]); });
    // mid buildings
    const mid = layerCanvas('mid', -1900, 2700, 100, 1100, 2, paintMid);
    withLayer(g, cam, 0.5, () => { const v = visX(cam, 0.5); drawLayer(g, mid, v[0], v[1]); });
    // atmospheric shafts through the gaps (additive, sun in sky-layer space)
    withLayer(g, cam, 0.05, () => drawRays(g, t * 1.0 + 3.0, 0.7));
    withLayer(g, cam, 0.05, () => { g.save(); g.globalCompositeOperation = 'screen'; radial(g, SUN.x, SUN.y, 1100, [[0, 'rgba(255,150,90,0.30)'], [0.5, 'rgba(255,110,100,0.10)'], [1, 'rgba(255,100,110,0)']]); g.restore(); });
    // near row with shopfronts
    const near = layerCanvas('near', -2000, 3400, 480, 860, 2, paintNear);
    withLayer(g, cam, 0.78, () => { const v = visX(cam, 0.78); drawLayer(g, near, v[0], v[1]); });
    // ground plane
    withLayer(g, cam, 1, () => { const v = visX(cam, 1, 80); drawGround(g, cam, t, v[0], v[1]); });
    g.restore();
  }

  // ---------- foreground ----------
  function fgPole() {
    return cached('fgPole', () => {
      const w = 160, h = 1700, c = mk(w, h), x = c.getContext('2d');
      x.filter = 'blur(6px)';
      let gr = x.createLinearGradient(60, 0, 100, 0);
      gr.addColorStop(0, '#0d0817'); gr.addColorStop(0.7, '#150c24'); gr.addColorStop(1, '#2a1630');
      x.fillStyle = gr; x.fillRect(60, 0, 40, h);
      x.fillStyle = 'rgba(255,160,100,0.45)'; x.fillRect(97, 0, 4, h);
      x.fillStyle = '#0d0817'; x.fillRect(48, 380, 64, 16); x.fillRect(52, 1020, 56, 10);
      return c;
    });
  }
  function fgHedge() {
    return cached('fgHedge', () => {
      const w = 760, h = 340, c = mk(w, h), x = c.getContext('2d'), r = rng(88);
      x.filter = 'blur(7px)';
      for (let i = 0; i < 46; i++) {
        const bx = 110 + r() * (w - 220), by = 90 + r() * 200, br = 36 + r() * 46;
        const lf = bx / w;
        const g2 = x.createRadialGradient(bx + br * 0.3, by - br * 0.3, 2, bx, by, br);
        g2.addColorStop(0, rgba(mixc([20, 12, 38], [64, 30, 56], lf * 0.8))); g2.addColorStop(1, 'rgba(8,4,18,1)');
        x.fillStyle = g2; x.beginPath(); x.arc(bx, by, br, 0, TAU); x.fill();
      }
      x.fillStyle = '#080412'; x.fillRect(w * 0.1, 250, w * 0.8, 100);
      x.strokeStyle = 'rgba(255,150,95,0.30)'; x.lineWidth = 4;
      for (let i = 0; i < 12; i++) { const bx = 300 + r() * 420, by = 100 + r() * 100, br = 38 + r() * 24; x.beginPath(); x.arc(bx, by, br, -0.9, 0.3); x.stroke(); }
      return c;
    });
  }
  function drawForeground(g, cam, t) {
    const P = 1.45;
    const zs = zsOf(cam, P);
    const ox = cam.x * P, oy = 540 + (cam.y - 540) * P;
    g.save();
    // soft bokeh lamps far out of focus
    g.save(); g.globalCompositeOperation = 'screen';
    for (let i = 0; i < 7; i++) {
      const wx = -3000 + i * 1000 + hash1(i * 11) * 600, wy = 640 + hash1(i * 13) * 260;
      const sx = W / 2 + zs * (wx - cam.x * 1.25), sy = H / 2 + zs * (wy - (540 + (cam.y - 540) * 1.25));
      const sz = (46 + hash1(i + 21) * 60) * zs, a = 0.07 + 0.04 * Math.sin(t * 0.9 + i);
      if (sx < -200 || sx > W + 200) continue;
      radial(g, sx, sy, sz, [[0, `rgba(255,200,130,${a * 1.4})`], [0.8, `rgba(255,160,100,${a})`], [1, 'rgba(255,150,90,0)']]);
    }
    g.restore();
    // poles and hedges
    withLayer(g, cam, P, () => {
      const pole = fgPole(), hed = fgHedge();
      const topY = oy - (H / 2 + 100) / zs, botY = oy + (H / 2 + 80) / zs;
      for (let i = -3; i <= 3; i++) {
        const wx = 492 + i * 1800 + (i & 1 ? 260 : 0);
        if (Math.abs(wx - ox) < (W / zs) + 200) g.drawImage(pole, wx - 80, topY, 160, botY - topY);
      }
      for (let i = -3; i <= 3; i++) {
        const wx = 160 + i * 1700 + (i & 1 ? 330 : 0);
        if (Math.abs(wx - ox) < (W / zs) + 600) {
          const hw = 760 * (i & 1 ? 1.15 : 1), hy = botY - 250;
          g.drawImage(hed, wx - hw / 2, hy, hw, 340);
          g.fillStyle = '#080412'; g.fillRect(wx - hw / 2 + hw * 0.1, hy + 330, hw * 0.8, 500);
        }
      }
    });
    // dust motes (screen space)
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'screen';
    const mw = W + 240, mh = H + 240;
    for (let i = 0; i < 46; i++) {
      const dpt = 0.6 + hash1(i * 5 + 1) * 1.1;
      let sx = hash1(i * 3 + 7) * mw + t * (6 + hash1(i + 90) * 16) - cam.x * dpt * zs * 0.9 + Math.sin(t * 0.7 + i) * 14;
      let sy = hash1(i * 3 + 8) * mh - t * (4 + hash1(i + 70) * 9) - (cam.y - 540) * dpt * zs * 0.9 + Math.cos(t * 0.5 + i * 1.3) * 10;
      sx = ((sx % mw) + mw) % mw - 120; sy = ((sy % mh) + mh) % mh - 120;
      const sz = (1.2 + hash1(i + 33) * 2.6) * (0.7 + dpt * 0.4);
      const a = (0.25 + 0.3 * Math.sin(t * 1.3 + i * 2.1)) * clamp(0.3 + sx / W * 0.9, 0, 1);
      if (a <= 0.02) continue;
      radial(g, sx, sy, sz * 3, [[0, `rgba(255,214,160,${a * 0.9})`], [0.35, `rgba(255,180,120,${a * 0.35})`], [1, 'rgba(255,170,110,0)']]);
    }
    g.restore();
  }

  // ---------- shadow ----------
  function drawShadow(g, x, y, w, alpha = 0.5) {
    g.save();
    g.translate(x - w * 0.12, y);
    g.scale(1, 0.15);
    radial(g, 0, 0, w * 0.5, [[0, `rgba(16,7,30,${alpha})`], [0.6, `rgba(16,7,30,${alpha * 0.55})`], [1, 'rgba(16,7,30,0)']]);
    g.restore();
    g.save();
    g.translate(x - w * 0.52, y + 1);
    g.scale(1, 0.1);
    radial(g, 0, 0, w * 0.62, [[0, `rgba(16,7,30,${alpha * 0.55})`], [1, 'rgba(16,7,30,0)']]);
    g.restore();
  }

  // ---------- post ----------
  function grainTile() {
    return cached('grain', () => {
      const c = mk(512, 512), x = c.getContext('2d'), id = x.createImageData(512, 512), r = rng(1234);
      for (let i = 0; i < id.data.length; i += 4) {
        const v = 128 + ((r() + r() + r()) / 3 - 0.5) * 360;
        id.data[i] = v; id.data[i + 1] = v * 0.98; id.data[i + 2] = v * 0.96; id.data[i + 3] = 255;
      }
      x.putImageData(id, 0, 0);
      return c;
    });
  }
  function postFX(g, t, o = {}) {
    const vg = o.vignette === undefined ? 0.55 : o.vignette, gn = o.grain === undefined ? 0.06 : o.grain;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (vg > 0) {
      const gr = g.createRadialGradient(W / 2, H * 0.48, H * 0.32, W / 2, H * 0.48, W * 0.66);
      gr.addColorStop(0, 'rgba(10,4,24,0)'); gr.addColorStop(0.55, `rgba(10,4,24,${vg * 0.2})`); gr.addColorStop(1, `rgba(8,3,20,${Math.min(0.95, vg * 1.05)})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    if (gn > 0) {
      const fr = Math.round(t * 30), ox = Math.floor(hash1(fr * 3 + 1) * 512), oy = Math.floor(hash1(fr * 3 + 2) * 512);
      const pat = g.createPattern(grainTile(), 'repeat');
      g.globalCompositeOperation = 'overlay'; g.globalAlpha = clamp(gn * 2.0, 0, 1);
      g.translate(-ox, -oy); g.fillStyle = pat; g.fillRect(ox, oy, W, H);
    }
    g.restore();
  }

  // ---------- grading / fx ----------
  function visionGrade(g, amt) {
    if (amt <= 0) return;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'saturation'; g.fillStyle = `rgba(128,128,128,${0.55 * amt})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'color'; g.fillStyle = `rgba(30,95,255,${0.62 * amt})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'multiply';
    const mg = g.createLinearGradient(0, 0, 0, H);
    mg.addColorStop(0, `rgba(${255 - 130 * amt | 0},${255 - 90 * amt | 0},255,1)`); mg.addColorStop(1, `rgba(${255 - 170 * amt | 0},${255 - 120 * amt | 0},255,1)`);
    g.fillStyle = mg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'screen';
    const eg = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.62);
    eg.addColorStop(0, 'rgba(60,200,255,0)'); eg.addColorStop(1, `rgba(60,210,255,${0.42 * amt})`);
    g.fillStyle = eg; g.fillRect(0, 0, W, H);
    g.restore();
  }
  function flash(g, a, color = '#ffffff') {
    if (a <= 0) return;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = clamp(a); g.fillStyle = color; g.fillRect(0, 0, W, H); g.restore();
  }
  function rgbSplit(g, px) {
    if (!px) return;
    const src = cached('rgbSrc', () => mk(W, H));
    const sctx = src.getContext('2d');
    sctx.globalCompositeOperation = 'copy'; sctx.drawImage(g.canvas, 0, 0, W, H); sctx.globalCompositeOperation = 'source-over';
    const chans = ['rgbR', 'rgbG', 'rgbB'], cols = ['#ff0000', '#00ff00', '#0000ff'], dx = [px, 0, -px];
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const cc = cached(chans[i], () => mk(W, H)), cx = cc.getContext('2d');
      cx.globalCompositeOperation = 'copy'; cx.drawImage(src, 0, 0);
      cx.globalCompositeOperation = 'multiply'; cx.fillStyle = cols[i]; cx.fillRect(0, 0, W, H);
      cx.globalCompositeOperation = 'source-over';
      g.drawImage(cc, dx[i], 0);
    }
    g.restore();
  }

  function warmWorld() {
    const cam = { x: 960, y: 540, z: 1 };
    const c = mk(8, 8); // build every cache once
    drawWorld(c.getContext('2d'), cam, 0);
    treeSprite(0); treeSprite(1); treeSprite(2); fgPole(); fgHedge(); grainTile();
  }

  return { withLayer, project, drawWorld, drawForeground, drawShadow, postFX, visionGrade, flash, rgbSplit, warmWorld };
})();
