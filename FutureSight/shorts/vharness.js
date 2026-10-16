// vharness.js — vertical (1080x1920) re-framing harness for the FutureSight Short.
// Injected into index_full.html by vrender.mjs (never edits the published project files).
// The unmodified engine draws each 1920x1080 frame (drawFrame(g,T)); this file re-frames it with a keyframed
// "vertical camera" (cx, cy, zoom) over a blurred copy of the same frame, adds karaoke captions, and averages
// sub-frames (180-degree shutter) at the OUTPUT level so motion blur matches the published look.
(function () {
  const OW = 1080, OH = 1920;
  const src = document.getElementById('c');
  const g = src.getContext('2d');
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const out = mk(OW, OH), o = out.getContext('2d');
  const acc = mk(OW, OH), a = acc.getContext('2d');
  const band = mk(OW, OH), b = band.getContext('2d');
  const small = mk(144, 256), sm = small.getContext('2d');
  const scan = mk(240, 135), sc = scan.getContext('2d', { willReadFrequently: true });
  let PLAN = null;
  window.setPlan = (p) => { PLAN = p; return true; };

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const sstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  function srcFrame(T) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    drawFrame(g, T);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  function segAt(ts) {
    const S = PLAN.segs;
    for (let i = S.length - 1; i >= 0; i--) if (ts >= S[i].s0 - 1e-6) return S[i];
    return S[0];
  }

  // keyframed camera: keys = [[t, cx, cy, z, yc?], ...] local seconds; cubic Hermite (Catmull-Rom tangents) per channel
  function camAt(seg, u) { const c = camAt0(seg, u); c.cx = trackCx(seg, u, c.cx); return c; }
  function camAt0(seg, u) {
    const K = seg.cam;
    if (K.length === 1) return { cx: K[0][1], cy: K[0][2], z: K[0][3], yc: K[0][4] ?? 900 };
    if (u <= K[0][0]) return { cx: K[0][1], cy: K[0][2], z: K[0][3], yc: K[0][4] ?? 900 };
    const n = K.length;
    if (u >= K[n - 1][0]) { const k = K[n - 1]; return { cx: k[1], cy: k[2], z: k[3], yc: k[4] ?? 900 }; }
    let i = 0; while (i < n - 2 && u > K[i + 1][0]) i++;
    const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(n - 1, i + 2)];
    const h = k2[0] - k1[0], s = (u - k1[0]) / h;
    const res = {};
    const ch = [[1, 'cx'], [2, 'cy'], [3, 'z'], [4, 'yc']];
    for (const [idx, name] of ch) {
      const p0 = k0[idx] ?? 900, p1 = k1[idx] ?? 900, p2 = k2[idx] ?? 900, p3 = k3[idx] ?? 900;
      const m1 = (k2[0] - k0[0]) > 0 ? (p2 - p0) / (k2[0] - k0[0]) : 0;
      const m2 = (k3[0] - k1[0]) > 0 ? (p3 - p1) / (k3[0] - k1[0]) : 0;
      const s2 = s * s, s3 = s2 * s;
      res[name] = (2 * s3 - 3 * s2 + 1) * p1 + (s3 - 2 * s2 + s) * h * m1 + (-2 * s3 + 3 * s2) * p2 + (s3 - s2) * h * m2;
    }
    return res;
  }

  // optional hero-centred x track for a segment: seg.cxTrack = [[u, cx], ...] (linear), written by center_cams.mjs
  function trackCx(seg, u, fallback) {
    const K = seg.cxTrack;
    if (!K || !K.length) return fallback;
    if (u <= K[0][0]) return K[0][1];
    if (u >= K[K.length - 1][0]) return K[K.length - 1][1];
    let i = 0; while (i < K.length - 2 && u > K[i + 1][0]) i++;
    const f = (u - K[i][0]) / (K[i + 1][0] - K[i][0]);
    return K[i][1] + (K[i + 1][1] - K[i][1]) * f;
  }
  // composite the already-drawn source canvas into `out`
  function comp(cam) {
    const z = cam.z;
    const hw = 540 / z;
    const cx = clamp(cam.cx, hw, 1920 - hw);
    const cy = cam.cy, yc = cam.yc;
    // 1) blurred, darkened backdrop (cover-fit of the same frame)
    const zb = 1920 / 1080, wb = OW / zb;
    const cxb = clamp(cx, wb / 2, 1920 - wb / 2);
    sm.imageSmoothingEnabled = true; sm.imageSmoothingQuality = 'high';
    sm.drawImage(src, cxb - wb / 2, 0, wb, 1080, 0, 0, 144, 256);
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
    o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
    o.drawImage(small, 0, 0, OW, OH);
    o.fillStyle = 'rgba(6,4,14,0.52)'; o.fillRect(0, 0, OW, OH);
    // 2) sharp camera band
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
    b.clearRect(0, 0, OW, OH);
    b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high';
    b.setTransform(z, 0, 0, z, 540 - z * cx, yc - z * cy);
    b.drawImage(src, 0, 0);
    b.setTransform(1, 0, 0, 1, 0, 0);
    const y0 = yc - z * cy, y1 = y0 + 1080 * z, F = 110;
    if (y0 > 0 || y1 < OH) {
      const gr = b.createLinearGradient(0, 0, 0, OH);
      const add = (y, al) => gr.addColorStop(clamp(y / OH, 0, 1), `rgba(0,0,0,${al})`);
      if (y0 > 0) { add(y0, 0); add(y0 + F, 1); } else add(0, 1);
      if (y1 < OH) { add(y1 - F, 1); add(y1, 0); } else add(OH, 1);
      b.globalCompositeOperation = 'destination-in';
      b.fillStyle = gr; b.fillRect(0, 0, OW, OH);
      b.globalCompositeOperation = 'source-over';
    }
    o.drawImage(band, 0, 0);
  }

  // ---------- captions ----------
  const FONT = '"Bahnschrift SemiBold", "Segoe UI Black", Arial Black, sans-serif';
  function drawCaption(ctx, ts) {
    const caps = PLAN.caps;
    let cap = null;
    for (const c of caps) if (ts >= c.t0 && ts < c.t1) { cap = c; break; }
    if (!cap) return;
    const FS = cap.fs || 92, LH = FS * 1.12, MAXW = 880, CX = OW / 2, CY = cap.cy || 1385;
    ctx.save();
    ctx.font = `${FS}px ${FONT}`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    const sp = ctx.measureText(' ').width * 0.9;
    const ws = cap.words.map((w) => ({ w, width: ctx.measureText(w.t).width }));
    // wrap
    const lines = [[]]; let lw = 0;
    for (const x of ws) {
      const add = (lines[lines.length - 1].length ? sp : 0) + x.width;
      if (lw + add > MAXW && lines[lines.length - 1].length) { lines.push([x]); lw = x.width; } else { lines[lines.length - 1].push(x); lw += add; }
    }
    const age = ts - cap.t0;
    const pop = 0.9 + 0.1 * sstep(age / 0.12);
    ctx.translate(CX, CY); ctx.scale(pop, pop);
    const y0 = -((lines.length - 1) * LH) / 2;
    // active word = last word whose start <= ts
    let act = -1; cap.words.forEach((w, i) => { if (ts >= w.s - 0.02) act = i; });
    lines.forEach((ln, li) => {
      const tw = ln.reduce((s, x, i) => s + x.width + (i ? sp : 0), 0);
      let x = -tw / 2; const y = y0 + li * LH;
      for (const it of ln) {
        const isAct = cap.words.indexOf(it.w) === act;
        ctx.lineWidth = FS * 0.24; ctx.strokeStyle = '#000'; ctx.strokeText(it.w.t, x, y);
        ctx.fillStyle = isAct ? '#ffd23f' : (it.w.hl ? '#7fe9ff' : '#ffffff');
        ctx.fillText(it.w.t, x, y);
        x += it.width + sp;
      }
    });
    ctx.restore();
  }

  // ---------- public API ----------
  function drawShort(ts, accumulate, i) {
    const seg = segAt(ts);
    const u = Math.max(0, ts - seg.s0);
    const T = seg.T0 + u;
    srcFrame(T);
    comp(camAt(seg, u));
    if (seg.dim) { /* reserved */ }
    return { seg, u, T };
  }
  window.renderShort = (ts, fps, sub, type) => {
    sub = Math.max(1, sub | 0);
    const seg = segAt(ts), shutter = 0.5 / fps;
    a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-over';
    for (let i = 0; i < sub; i++) {
      const tsi = Math.max(seg.s0, sub === 1 ? ts : ts - shutter + shutter * (i / (sub - 1)));
      const u = tsi - seg.s0;
      srcFrame(seg.T0 + (seg.hold ? Math.min(u, seg.hold) : u));
      comp(camAt(seg, u));
      a.globalAlpha = 1 / (i + 1);
      a.drawImage(out, 0, 0);
    }
    a.globalAlpha = 1;
    // global end fade (last frames) handled by plan.endFade = [start, dur]
    drawCaption(a, ts);
    if (PLAN.endFade) {
      const f = clamp((ts - PLAN.endFade[0]) / PLAN.endFade[1], 0, 1);
      if (f > 0) { a.fillStyle = `rgba(6,4,14,${f})`; a.fillRect(0, 0, OW, OH); }
    }
    return type === 'png' ? acc.toDataURL('image/png') : acc.toDataURL('image/jpeg', 0.97);
  };
  // hero hoodie (#d63a3a) centroid in SOURCE pixel coords for camera planning
  window.heroScan = (T) => {
    srcFrame(T);
    sc.drawImage(src, 0, 0, 240, 135);
    const d = sc.getImageData(0, 0, 240, 135).data;
    let n = 0, sx = 0, sy = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
    for (let y = 0; y < 135; y++) for (let x = 0; x < 240; x++) {
      const k = (y * 240 + x) * 4, r = d[k], gg = d[k + 1], bb = d[k + 2];
      if (r > 150 && gg < 95 && bb < 95 && r - gg > 80) { n++; sx += x; sy += y; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    }
    return n ? { n, x: Math.round(sx / n * 8), y: Math.round(sy / n * 8), bb: [minx * 8, miny * 8, maxx * 8, maxy * 8] } : { n: 0 };
  };
  window.subjectScan = (T) => {
    srcFrame(T);
    sc.drawImage(src, 0, 0, 240, 135);
    const d = sc.getImageData(0, 0, 240, 135).data;
    const W = 240, H = 135, I = new Int32Array((W + 1) * (H + 1)); let gn = 0, gx = 0;
    for (let y = 0; y < H; y++) {
      let row = 0;
      for (let x = 0; x < W; x++) {
        const k = (y * W + x) * 4, r = d[k], gg = d[k + 1], bb = d[k + 2];
        // hoodie red: g ~ b (shop awnings are orange: g > b, or pink: b > g)
        let hit = (r > 140 && gg < 75 && bb < 80 && r - gg > 95 && Math.abs(gg - bb) < 12) ? 1 : 0;
        if (!hit && y > 60 && r < 140 && gg > 170 && bb > 225) { gn++; gx += x; }   // cyan ghost body (below the timer ring)
        row += hit; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row;
      }
    }
    // densest hoodie-sized window (16 x 24 scan px): the hero is a compact blob, shop awnings are thin strips
    const ww = 16, wh = 24; let best = 0, bx = -1;
    for (let y = 0; y + wh <= H; y += 2) for (let x = 0; x + ww <= W; x++) {
      const sum = I[(y + wh) * (W + 1) + x + ww] - I[y * (W + 1) + x + ww] - I[(y + wh) * (W + 1) + x] + I[y * (W + 1) + x];
      if (sum > best) { best = sum; bx = x; }
    }
    return { hn: best, hx: best >= 30 ? (bx + ww / 2) * 8 : null, spread: 0, gn: gn, gx: gn ? gx / gn * 8 : null };
  };
  window.srcPNG = (T) => { srcFrame(T); return src.toDataURL('image/png'); };
  window._dbg = { camAt, segAt, trackCx };
  window.__vready = true;
})();
