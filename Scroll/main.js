// main.js — picks the shot for time t. Shots live in shots_*.js and register themselves in SHOTS.
function drawFrame(g, t, E) {
  let s = null; for (const sh of SHOTS) if (t >= sh.t0 && t < sh.t1) { s = sh; break; }
  if (!s) { g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080); return; }
  s.fn(g, t - s.t0, t, E);
}
