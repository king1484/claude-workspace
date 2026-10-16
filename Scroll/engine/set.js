// set.js — the bedroom, drawn in world space (a stage: back wall y<860, foreground floor y>=860) plus the lighting pass.
// World: 2600 wide. Bed (x 150..1060) | nightstand+clock (1100..1260) | window (1420..1780) over desk (1470..2020) | shelf + door (2080..2480).
// The world is GREY; blue = the feed, warm amber / red = the real world (colour rule from SCRIPT.md).
const SET = (() => {
  const FLOOR = 860, ROOM_W = 2600;
  const WALL = [58, 61, 70], WALL2 = [43, 46, 54], FLOORC = [38, 40, 47], WOOD = [74, 70, 70];
  const BED_TOP = 806;                       // mattress top (sit surface)

  function wall(g, S) {
    const gr = g.createLinearGradient(0, 0, 0, FLOOR); gr.addColorStop(0, css(mixc(WALL2, WALL, 0.15))); gr.addColorStop(1, css(WALL));
    g.fillStyle = gr; g.fillRect(-200, -400, ROOM_W + 400, FLOOR + 400);
    g.fillStyle = 'rgba(0,0,0,0.12)';                                   // baseboard
    g.fillRect(-200, FLOOR - 26, ROOM_W + 400, 26);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(-200, FLOOR - 28, ROOM_W + 400, 3);
  }
  function floor(g, S) {
    const gr = g.createLinearGradient(0, FLOOR, 0, FLOOR + 520); gr.addColorStop(0, css(mixc(FLOORC, [24, 25, 30], 0.2))); gr.addColorStop(1, css([22, 23, 28]));
    g.fillStyle = gr; g.fillRect(-200, FLOOR, ROOM_W + 400, 900);
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const y = FLOOR + 30 + i * i * 7 + i * 12; g.beginPath(); g.moveTo(-200, y); g.lineTo(ROOM_W + 200, y); g.stroke(); }
    const r = rng(11);
    for (let i = 0; i < 70; i++) { const x = r() * (ROOM_W + 400) - 200, y0 = FLOOR + 30 + Math.floor(r() * 8) * 55; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (r() - 0.5) * 12, y0 + 55 + r() * 20); g.stroke(); }
    // rug under the desk
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.beginPath(); g.ellipse(1750, FLOOR + 96, 420, 64, 0, 0, TAU); g.fill();
  }
  // a dark hole in the floor (the shaft) with a cold glow; open 0..1, planks 0..1 (boards slide in to close it)
  function hole(g, S, t) {
    if (S.hole <= 0.001) return;
    const o = S.hole, cx = 820, cy = FLOOR + 118, rx = 330 * o, ry = 62 * o;
    g.save();
    glow(g, cx, cy, 520, [60, 150, 255], 0.28 * o * (1 - 0.85 * (S.planks || 0)), 'screen');
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.clip();
    const gr = g.createLinearGradient(0, cy - ry, 0, cy + ry); gr.addColorStop(0, '#05070c'); gr.addColorStop(1, '#0a1220'); g.fillStyle = gr; g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    // icons falling away into the dark (pure function of t)
    const r = rng(5);
    for (let i = 0; i < 16; i++) {
      const sp = 0.25 + r() * 0.35, ph = r() * 5, x = cx + (r() - 0.5) * rx * 1.5, k = ((t * sp + ph) % 1);
      const y = cy - ry * 0.9 + k * ry * 1.8, sz = (1 - k) * (6 + r() * 7);
      g.fillStyle = `rgba(110,185,255,${0.75 * (1 - k)})`; rr(g, x - sz / 2, y - sz / 2, sz, sz, sz * 0.3); g.fill();
    }
    if (S.planks > 0) {                                         // boards slide in from both sides
      const k = easeOut(S.planks);
      for (let i = 0; i < 7; i++) { const yy = cy - ry + (i + 0.5) * (ry * 2 / 7), side = i % 2 ? 1 : -1, off = (1 - clamp(k * 1.2 - i * 0.03)) * rx * 2 * side;
        g.fillStyle = css(mixc(WOOD, [30, 30, 34], 0.35)); g.fillRect(cx - rx + off, yy - ry / 7, rx * 2, ry * 2 / 7 - 2); }
    }
    g.restore();
    g.strokeStyle = 'rgba(8,8,12,0.9)'; g.lineWidth = 8; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.stroke();
    if (S.holeLine > 0) {                                        // the bottom, with a line on it: the end of tonight's feed
      g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.clip();
      g.strokeStyle = `rgba(110,180,255,${0.9 * S.holeLine})`; g.lineWidth = 3; g.shadowColor = 'rgba(110,180,255,0.9)'; g.shadowBlur = 14; g.beginPath(); g.ellipse(cx, cy, rx * 0.8, ry * 0.7, 0, 0, TAU); g.stroke();
      g.shadowBlur = 0; g.fillStyle = `rgba(190,220,255,${0.8 * S.holeLine})`; g.font = 'bold 22px "DejaVu Sans Mono"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('11:30', cx, cy); g.restore();
    }
  }
  function windowFrame(g, S, t) {
    const x = 1420, y = 170, w = 360, h = 400, sky = S.sky;
    // glass colours by sky: 0 night, 1 grey dawn, 2 warm sunrise
    const night = [[16, 24, 44], [30, 46, 78]], dawn = [[120, 126, 138], [168, 170, 176]], sun = [[255, 178, 96], [255, 224, 160]];
    let top, bot;
    if (sky <= 1) { top = mixc(night[0], dawn[0], sky); bot = mixc(night[1], dawn[1], sky); } else { top = mixc(dawn[0], sun[0], sky - 1); bot = mixc(dawn[1], sun[1], sky - 1); }
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, css(top)); gr.addColorStop(1, css(bot));
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    // distant skyline
    g.fillStyle = css(mixc(top, [8, 10, 18], sky > 1 ? 0.35 : 0.55)); const r = rng(21);
    for (let i = 0; i < 11; i++) { const bw = 24 + r() * 28, bh = 50 + r() * 130; g.fillRect(x + 4 + i * 33 + (r() - 0.5) * 6, y + h - bh, bw, bh); }
    if (sky < 1.2) { g.fillStyle = `rgba(235,238,248,${0.85 * (1 - clamp(sky))})`; g.beginPath(); g.arc(x + 270, y + 90, 22, 0, TAU); g.fill(); }
    if (sky > 1.2) { glow(g, x + 120, y + h - 60, 260, [255, 190, 110], 0.5 * clamp(sky - 1.2), 'screen'); }
    // rain streaks (low point / silence)
    if (S.rain > 0) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.strokeStyle = `rgba(200,210,230,${0.35 * S.rain})`; g.lineWidth = 1.5;
      const rr2 = rng(33); for (let i = 0; i < 90; i++) { const px = x + rr2() * w, sp = 380 + rr2() * 260, py = y + ((t * sp + rr2() * 700) % (h + 60)) - 30; g.beginPath(); g.moveTo(px, py); g.lineTo(px - 5, py + 22); g.stroke(); } g.restore(); }
    g.strokeStyle = '#1a1c22'; g.lineWidth = 14; g.strokeRect(x, y, w, h);
    g.lineWidth = 8; g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h * 0.5); g.lineTo(x + w, y + h * 0.5); g.stroke();
    g.fillStyle = '#2a2c34'; g.fillRect(x - 14, y + h, w + 28, 14);                             // sill
    // curtains (open: 0 closed .. 1 open)
    const c = 1 - clamp(S.curtain), cw = 40 + c * 160;
    for (const side of [-1, 1]) {
      const cx = side < 0 ? x - 6 : x + w + 6 - cw; const gx = g.createLinearGradient(cx, 0, cx + cw, 0);
      gx.addColorStop(0, css(mixc([34, 36, 44], [14, 15, 20], side < 0 ? 0 : 0.4))); gx.addColorStop(1, css(mixc([34, 36, 44], [14, 15, 20], side < 0 ? 0.4 : 0)));
      g.fillStyle = gx; g.fillRect(cx, y - 30, cw, h + 120);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(cx + cw * k / 5, y - 30); g.lineTo(cx + cw * k / 5 + 4, y + h + 90); g.stroke(); }
    }
    g.fillStyle = '#16171c'; g.fillRect(x - 40, y - 40, w + 80, 12);                           // rod
  }
  function bed(g, S) {
    g.fillStyle = '#23252b'; g.fillRect(150, BED_TOP + 18, 910, 36); g.fillRect(160, BED_TOP + 54, 26, FLOOR - BED_TOP - 54); g.fillRect(1024, BED_TOP + 54, 26, FLOOR - BED_TOP - 54);
    g.fillStyle = '#1f2127'; rr(g, 128, BED_TOP - 300, 46, 380, 14); g.fill();                    // headboard
    g.fillStyle = css(mixc([84, 88, 99], [60, 63, 72], 0.2)); rr(g, 174, BED_TOP - 30, 880, 50, 16); g.fill();   // mattress
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(190, BED_TOP - 28, 850, 4);
    const bl = g.createLinearGradient(0, BED_TOP - 40, 0, BED_TOP + 20); bl.addColorStop(0, '#4a4e5c'); bl.addColorStop(1, '#3a3d49');
    g.fillStyle = bl; rr(g, 420, BED_TOP - 44, 640, 62, 24); g.fill();                              // blanket
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(520 + i * 150, BED_TOP - 40); g.quadraticCurveTo(540 + i * 150, BED_TOP - 14, 520 + i * 150, BED_TOP + 14); g.stroke(); }
    g.fillStyle = '#6b7080'; rr(g, 188, BED_TOP - 70, 190, 56, 26); g.fill();                       // pillow
    g.fillStyle = 'rgba(255,255,255,0.07)'; rr(g, 200, BED_TOP - 66, 160, 12, 6); g.fill();
  }
  function nightstand(g, S, t) {
    g.fillStyle = '#25272e'; rr(g, 1100, 736, 170, 124, 8); g.fill(); g.fillStyle = '#1b1d22'; g.fillRect(1112, 776, 146, 3);
    g.fillStyle = '#383b45'; g.beginPath(); g.arc(1185, 806, 7, 0, TAU); g.fill();
    // clock
    g.fillStyle = '#16181d'; rr(g, 1118, 668, 134, 68, 12); g.fill();
    g.save(); g.shadowColor = 'rgba(210,224,255,0.65)'; g.shadowBlur = 14; g.fillStyle = '#d3dcf0'; g.font = 'bold 44px "DejaVu Sans Mono"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const s = S.clock || '11:42'; g.fillText(s, 1185, 704); g.restore();
    if (S.mug) { g.fillStyle = '#32353e'; rr(g, 1102, 650, 0, 0, 0); }
  }
  function desk(g, S, t) {
    g.fillStyle = '#2b2d34'; rr(g, 1470, 736, 560, 22, 6); g.fill(); g.fillRect(1490, 758, 22, FLOOR - 758); g.fillRect(1988, 758, 22, FLOOR - 758);
    g.fillStyle = '#1f2026'; g.fillRect(1514, 790, 462, 14);
    // chair
    g.fillStyle = '#22242a'; rr(g, 1560, 800, 150, 20, 8); g.fill(); g.fillRect(1626, 820, 18, FLOOR - 820); rr(g, 1530, 650, 30, 170, 12); g.fill();
    // sketchbook + pencil
    g.fillStyle = '#d8d6cf'; rr(g, 1760, 720, 190, 16, 3); g.fill(); g.fillStyle = '#b9b7b0'; g.fillRect(1760, 733, 190, 3);
    g.strokeStyle = '#4a4d58'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(1700, 731); g.lineTo(1745, 725); g.stroke();
    // mug
    if (S.mug) { g.fillStyle = '#3a3d48'; rr(g, 1960, 696, 36, 40, 6); g.fill(); g.strokeStyle = '#3a3d48'; g.lineWidth = 5; g.beginPath(); g.arc(1996, 714, 9, -1.2, 1.2); g.stroke(); }
    // lamp
    g.strokeStyle = '#17181d'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(1560, 734); g.lineTo(1580, 640); g.lineTo(1650, 586); g.stroke();
    g.fillStyle = '#17181d'; rr(g, 1540, 728, 60, 10, 4); g.fill();
    g.beginPath(); g.moveTo(1630, 580); g.lineTo(1690, 596); g.lineTo(1672, 624); g.lineTo(1620, 606); g.closePath(); g.fill();
    if (S.lamp > 0.01) { g.fillStyle = `rgba(255,214,150,${S.lamp})`; g.beginPath(); g.ellipse(1664, 616, 22, 7, 0.4, 0, TAU); g.fill(); }
  }
  function doorShelf(g, S, t) {
    g.fillStyle = '#23252b'; rr(g, 2280, 250, 220, FLOOR - 250, 4); g.fill(); g.fillStyle = '#34363e'; rr(g, 2300, 280, 180, 280, 3); g.fill(); rr(g, 2300, 590, 180, 240, 3); g.fill();
    g.fillStyle = '#6b6e7a'; g.beginPath(); g.arc(2318, 570, 8, 0, TAU); g.fill();
    // shelf + outlet
    g.fillStyle = '#2f3139'; rr(g, 2070, 660, 170, 16, 4); g.fill(); g.fillStyle = '#1d1e24'; g.fillRect(2084, 676, 10, 40); g.fillRect(2216, 676, 10, 40);
    g.fillStyle = '#d0cfd6'; rr(g, 2118, 770, 36, 52, 6); g.fill(); g.fillStyle = '#202228'; g.fillRect(2130, 784, 4, 12); g.fillRect(2140, 784, 4, 12);
    if (S.shelfPhone > 0) { g.save(); g.globalAlpha = S.shelfPhone; g.fillStyle = '#101116'; rr(g, 2120, 612, 52, 50, 6); g.fill(); g.restore(); }   // phone lying face down
    if (S.cord > 0) { g.strokeStyle = '#d7d6dd'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(2136, 790); g.quadraticCurveTo(2150, 700, 2146, 660 * (1 - 0.0)); g.stroke(); }
    if (S.note > 0.01) {
      const k = easeOut(S.note), nx = 2110, ny = 540;
      g.save(); g.translate(nx + 40, ny + 36); g.rotate(-0.06); g.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k); g.globalAlpha = clamp(S.note * 2);
      g.fillStyle = '#e9e1b8'; g.fillRect(-64, -38, 128, 76); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-64, 32, 128, 6);
      g.fillStyle = '#2c2a28'; g.font = 'italic 17px "DejaVu Sans"'; g.textAlign = 'center'; g.fillText('Last swipe:', 0, -6); g.font = 'italic bold 26px "DejaVu Sans"'; g.fillText('11:30', 0, 22); g.restore();
    }
  }
  // ----------------------------------------------------------------- compositing helpers
  // draws the whole room (no lighting). S = scene state
  function room(g, S, t) { wall(g, S); windowFrame(g, S, t); if (S.wallFx) S.wallFx(g); floor(g, S); hole(g, S, t); doorShelf(g, S, t); bed(g, S); nightstand(g, S, t); desk(g, S, t); }

  // Lighting: a quarter-res darkness map with holes where lights are, then coloured glow. Called after everything is drawn (screen space).
  const LM = { c: null, w: 480, h: 270 };
  function lightPass(g, cam, ambient, lights, E) {
    if (!LM.c) { LM.c = document.createElement('canvas'); LM.c.width = LM.w; LM.c.height = LM.h; }
    const x = LM.c.getContext('2d'), k = LM.w / 1920;
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, LM.w, LM.h);
    x.fillStyle = `rgba(${ambient[0]},${ambient[1]},${ambient[2]},${ambient[3]})`; x.fillRect(0, 0, LM.w, LM.h);
    x.globalCompositeOperation = 'destination-out';
    const P = lights.map(L => ({ L, sx: (L.x - cam.x) * cam.z + 960, sy: (L.y - cam.y) * cam.z + 540, R: L.r * cam.z }));
    for (const p of P) {
      const gr = x.createRadialGradient(p.sx * k, p.sy * k, 0, p.sx * k, p.sy * k, p.R * k);
      gr.addColorStop(0, `rgba(0,0,0,${p.L.open})`); gr.addColorStop(0.5, `rgba(0,0,0,${p.L.open * 0.55})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, LM.w, LM.h);
    }
    g.save(); g.setTransform(E.SC, 0, 0, E.SC, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(LM.c, 0, 0, 1920, 1080);
    g.globalCompositeOperation = 'screen';
    for (const p of P) { const gr = g.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, p.R); gr.addColorStop(0, rgba(p.L.rgb, p.L.a)); gr.addColorStop(1, rgba(p.L.rgb, 0)); g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080); }
    g.restore();
  }
  function vignette(g, E, k) {
    g.save(); g.setTransform(E.SC, 0, 0, E.SC, 0, 0);
    const gr = g.createRadialGradient(960, 540, 380, 960, 540, 1180); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${k})`);
    g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080); g.restore();
  }
  return { FLOOR, ROOM_W, BED_TOP, room, lightPass, vignette };
})();
