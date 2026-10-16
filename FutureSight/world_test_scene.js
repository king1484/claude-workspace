// Temporary stub scene for testing world.js. ?cam=x,y,z fixes the camera; otherwise a slow pan/zoom is animated.
function drawFrame(g, t) {
  const q = new URLSearchParams(location.search).get('cam');
  let cam;
  if (q) { const v = q.split(',').map(Number); cam = { x: v[0], y: v[1], z: v[2] }; }
  else cam = { x: 700 + 500 * Math.sin(t * 0.8), y: 540 + 120 * (0.5 - 0.5 * Math.cos(t * 0.5)), z: 1 + 1.2 * smooth(t / 1.0) };
  drawWorld(g, cam, t);
  // placeholder "character": 245px tall dummy at (900,820), plus second at 1200 for scale
  for (const [x, y, s] of [[900, 820, 1], [1250, 868, 0.98]]) {
    withLayer(g, cam, 1, () => {
      drawShadow(g, x, y, 90 * s, 0.5);
      g.fillStyle = '#d63a3a'; g.fillRect(x - 24 * s, y - 170 * s, 48 * s, 100 * s);
      g.fillStyle = '#14101c'; g.beginPath(); g.arc(x, y - 200 * s, 29 * s, 0, TAU); g.fill(); g.fillRect(x - 18 * s, y - 80 * s, 36 * s, 80 * s);
      g.fillStyle = '#ffb36b'; g.fillRect(x + 22 * s, y - 170 * s, 3 * s, 100 * s);
    });
  }
  drawForeground(g, cam, t);
  postFX(g, t, {});
}
