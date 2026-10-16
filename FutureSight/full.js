// full.js — assembles hook + chapters. drawFullFrame(g, T): pure function of global time T (seconds).
// Chapters register themselves as CH[id] = { draw(g, lt, dur) } (lt = local seconds, 0..dur).
const CH = (typeof window !== 'undefined' && window.CH) || {};
if (typeof window !== 'undefined') window.CH = CH;

const CH_ORDER = ['ch1', 'ch2', 'ch3', 'ch3b', 'ch4', 'ch4b', 'ch5', 'ch6', 'ch6b', 'ch7'];

function chapterAt(T) {
  for (let i = CH_ORDER.length - 1; i >= 0; i--) {
    const id = CH_ORDER[i], L = LAYOUT[id];
    if (T >= L.start) return { id, L, lt: T - L.start, dur: L.dur };
  }
  return null;
}

// fallback for chapters that are not written yet: dusk street + chapter title
function placeholderChapter(g, id, lt, L) {
  const cam = { x: 900, y: 612, z: 1.0, r: 0 };
  drawWorld(g, cam, lt);
  drawForeground(g, cam, lt);
  g.fillStyle = '#fff'; g.font = '72px "Segoe UI Black", sans-serif'; g.textAlign = 'center';
  g.fillText(`[${id}] ${L.title}`, 960, 200);
}

function drawFullFrame(g, T) {
  const W = TL.W, H = TL.H;
  if (T < LAYOUT.hook.dur) { drawHookFrame(g, T); return; }
  const c = chapterAt(T);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  g.save();
  if (CH[c.id] && CH[c.id].draw) CH[c.id].draw(g, c.lt, c.dur); else placeholderChapter(g, c.id, c.lt, c.L);
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  postFX(g, T, { vignette: 0.55, grain: 0.06 });
  // dip to black at chapter boundaries (hook already ends on black)
  const fin = 1 - smooth(c.lt / 0.3), fout = smooth((c.lt - (c.dur - 0.35)) / 0.35);
  const black = Math.max(fin, c.id === CH_ORDER[CH_ORDER.length - 1] ? smooth((c.lt - (c.dur - 1.2)) / 1.2) : fout);
  if (black > 0.001) { g.fillStyle = `rgba(8,5,14,${black})`; g.fillRect(0, 0, W, H); }
}

if (typeof window !== 'undefined') window.drawFrame = drawFullFrame;
