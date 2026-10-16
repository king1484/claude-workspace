# FutureSight hook — build contract (read fully before coding)

Goal: 10.8 s cartoon **2.5D stickman** hook for the YouTube video "What If You Could See 10 Seconds Into the Future?".
Look reference: the Ifverse video "What If Your Reaction Time Was 10x Faster?" — faceless black-headed stickman in a **red hoodie**,
painted dusk sky (violet -> magenta -> orange), big sun flare, layered parallax backdrops, orange **rim-light** on the sun side,
soft vignette, film grain. Cinematic, not flat-UI. No corner labels, no frame borders, minimal text.

Project dir: `C:\Users\Vinay Singirikonda\Projects\FutureSight`. Windows. Use PowerShell/Node/py -3.12 (Bash tool is network-sandboxed).
Already present: `lib.js` (math/spring/rng globals), `timeline.js` (global `TL`, also `module.exports`), `vo_script.json`, `make_vo.py`.
Output goes in `out/`, test stills in `shots/`.

## Engine rules (determinism)
- Frame = pure function of time `t` (seconds). No `Math.random`, `Date`, timers, rAF, CSS transitions, carried state. Use `rng(seed)`/`hash1` from lib.js.
- Plain browser globals, plain `<script src>` files (file:// safe), no bundler, no npm deps in the page.
- Canvas 2D, size **1920x1080**, ctx called `g`. World coords: x right, **y down**, 1 unit = 1 px at zoom 1.
- Depth sorting is by feet-y (painter's order): sidewalk baseline **820**, far road lane **868**, mid road **905**, near bike lane **985**.
- Character scale by depth: `s = 0.92 + (y-820)/165*0.16` (about 0.92 on sidewalk, 1.08 on the near lane); callers pass `s`.
- Sun at world (620, 430), on the RIGHT, so rim light is on the RIGHT edge of objects (orange `#ffb36b`, offset (+3,-1)).
- Palette: skyTop `#241648`, skyMid `#6b2f6e`, skyLow `#d4577a`, horizon `#ff9d57`; hoodie `#d63a3a` (back sleeve `#a82d2d`); black `#14101c`;
  vision/ghost cyan `#7fe9ff` / deep blue `#1a6bff`; helmet `#ffd23f`; rider jacket `#2fb59a`; delivery box `#ff7a1a`.
- Fonts: `"Bahnschrift SemiBold"`, fallback `"Segoe UI Black", sans-serif` (system fonts, nothing to load).

## Module APIs (globals)

### rigs.js  (owner: RIGS agent)
```
PAL_REAL                      // palette object used by all draw fns for solid, rim-lit rendering
palGhost(alpha)               // cyan hologram palette; draw fns then use g.globalCompositeOperation='lighter', no rim, soft glow
walkerPose(o)                 // o = {phase=0, walk=0..1, headDown=0..1 (0.35 = looking at phone), phone=0|1, lean=0.1,
                              //      bob=1, eyeOpen=0..1, eyeGlow=0..1, flutter=0..1, step=0..1 (backward step-away progress)}
                              // returns an opaque pose object (local space, facing +x, feet on y=0)
drawWalker(g, st)             // st = {x,y,s=1,facing=1,pose,pal=PAL_REAL,alpha=1,shadow=true}; feet at (x,y)
walkerJoints(st)              // -> {head:{x,y,r}, shoulder:{x,y}, hip:{x,y}, handF:{x,y}, footF:{x,y}, footB:{x,y}} in WORLD coords
drawBike(g, st)               // st = {x,y,s=1,pal,wheel(rad),pedal(rad),speed(px/s),alpha=1,shadow=true}; bike+rider facing +x, wheel bottoms at (.., y)
drawCar(g, st)                // st = {x,y,s=1,pal,alpha}; simple side-view car silhouette facing +x (used as ghost)
drawTimerRing(g, cx, cy, size, o)  // screen-space hologram: o={value:10..0, progress:0..1, appear:0..1, time}. thin cyan ring + 60 ticks + arc + number "10.0"
```
Walker: ~245 px tall at s=1. Black head r=29 with red hood crescent behind it, red hoodie torso, red sleeves + black hands, black legs,
legs/arms via 2-bone IK. Faceless by default; `eyeOpen` shows two white oval eyes on the face side, `eyeGlow` turns them cyan with a glow.
Phone: small dark rounded rect with a cool white-blue screen glow in the front hand when `phone=1`.
Bike: ~120 px wheels, yellow frame, rider (teal jacket, yellow helmet) leaning forward, orange delivery box on his back, pedalling legs.

### world.js  (owner: WORLD agent)
```
const GROUND = {sidewalk:820, roadFar:868, roadMid:905, roadNear:985, sun:{x:620,y:430}};
withLayer(g, cam, p, fn)      // cam={x,y,z}; applies parallax layer transform then calls fn(); p=0 sky ... 1 action plane ... 1.5 foreground
                              // screen = (W/2,H/2) + zs*(wx - cam.x*p, wy - (540 + (cam.y-540)*p)),  zs = 1+(cam.z-1)*(0.25+0.75*min(p,1.2))
project(cam, wx, wy, p=1)     // -> {x,y} screen coords, same math as withLayer
drawWorld(g, cam, t)          // sky, sun+flare+god-rays, clouds, 2 far skyline layers, mid buildings (warm lit windows, orange right-edge rim),
                              // trees, sidewalk+curb, road (lane dashes), lamps with glow. Everything BEHIND entities.
drawForeground(g, cam, t)     // blurred dark foreground silhouettes (pole/hedge at edges, p~1.45) + drifting dust motes. In FRONT of entities.
drawShadow(g, x, y, w, alpha) // soft ground shadow ellipse, skewed LEFT (sun on right)
postFX(g, t, o)               // o={vignette=0.55, grain=0.06}: vignette + animated seeded film-grain tile (offset by frame index = round(t*30))
visionGrade(g, amt)           // 0..1: blue 'color' tint + multiply + cyan edge glow (ghosts are drawn AFTER this so they stay bright)
flash(g, a, color='#ffffff') ; rgbSplit(g, px)   // full-frame flash; chromatic aberration by px (offscreen copies, 'lighter')
```
`drawWorld` must not know about characters. Mid-layer buildings leave the sun partly visible between skyline gaps.

### scenes.js  (owner: lead; do not write)  exposes `drawFrame(g, t)` and `window.seek(t)` is defined in index.html.

### index.html + render.mjs  (owner: WORLD agent)
index.html: `<canvas id=c width=1920 height=1080>`, loads lib.js, timeline.js, world.js, rigs.js, scenes.js (in that order), defines
`window.seek(t)` (calls `drawFrame(g,t)` once) and `window.renderFrame(t, fps, sub)` which averages `sub` sub-frames spread across a
180-degree shutter (t - 0.5/fps*0.5 ... t) into an accumulation canvas (running average: draw with globalAlpha = 1/(i+1)) and returns
`acc.toDataURL('image/jpeg', 0.97)`. If `drawFrame` is not yet defined (scenes.js missing) the page must still load and draw a flat test pattern.
render.mjs (Node 24 ESM): uses global Playwright at `C:\Users\Vinay Singirikonda\AppData\Roaming\npm\node_modules\playwright` via `createRequire`
(`chromium.launch({channel:'chrome', args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--force_high_performance_gpu','--allow-file-access-from-files']})`);
args: `--fps 30 --sub 4 --dur 10.8 --out out/silent.mp4 --from 0 --to <dur>` and `--stills "name:t,name:t"` (writes shots/<name>.png at full res, sub=1, via page.evaluate seek + canvas screenshot)
and `--contact "t0,t1,..."` writes shots/contact.png (ffmpeg tile). Frames are piped as JPEG (image2pipe, mjpeg) into ffmpeg: libx264 crf 16 yuv420p, +faststart.

### sfx.mjs  (owner: AUDIO agent)
Node ESM, no deps. Reads `timeline.js` (`createRequire`), `out/vo.wav` (48 kHz mono 16/32-bit float WAV from make_vo.py; may not exist yet -> treat as silence and log),
synthesizes in code at 48 kHz stereo: ambience (soft city air + faint wind), music bed per `TL.music` (A-minor pad + sub pulse + soft plucked arpeggio, ~96 BPM, builds with `arc`, risers per `risers`,
fade out from `fadeOutStart`), every `TL.cues` entry (phoneTap, step, bikePass doppler whoosh, thump, cutHit, eyeOpen, eyeFlash shimmer+sub boom,
pullOut whoosh, tick (n=0..9 rising pitch, clock-like), ghostWhoosh (airy, cyan, reversed-feel), flashHit, echoPop (n -> pentatonic blip, bell-like), titleImpact (deep boom + metallic tail + noise burst)).
Small convolution/comb reverb on music + impacts. Sidechain-duck music/ambience ~-9 dB under the VO envelope (computed from vo.wav). Deterministic (seeded). Writes `out/mix.wav`
(then loudnorm to about -14 LUFS, true peak -1.5) and `--mux` option runs ffmpeg: `out/silent.mp4` + `out/mix.wav` -> `out/final.mp4` (`-c:v copy -c:a aac -b:a 256k -shortest`).
Also writes `out/audio_report.json` (per-stem peak/RMS, duck depth, LUFS).
