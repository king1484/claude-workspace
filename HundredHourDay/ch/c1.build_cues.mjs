// Builds ch/c1.cues.json from LAYOUT so cue times follow the VO. Run: node ch/c1.build_cues.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const LAYOUT = vm.runInNewContext(fs.readFileSync(path.join(here, '..', 'layout.js'), 'utf8') + '\n;LAYOUT', {});
const L = LAYOUT.c1, V = L.vo;
// same constants as ch/c1.js
const T = { h1s: V[0].start, h1e: V[0].end, h2s: V[1].start, h2e: V[1].end, h3s: V[2].start, h3e: V[2].end, h4s: V[3].start, h4e: V[3].end, dur: L.dur };
T.jerk = T.h1s + 1.62; T.nod0 = T.h1s + 1.2; T.yw0 = T.h1s + 2.45; T.tr0 = T.h1s + 3.95; T.flare = T.h2s + 0.2;
T.wk0 = T.h2s + 1.0; T.wk1 = T.h2s + 2.9; T.zoom0 = T.h3s - 0.45; T.zoom1 = T.h3s + 0.75;
T.gh0 = T.h3s + 0.8; T.gh1 = T.h3e - 0.1; T.cut = T.h3e + 0.35;
T.idea = T.h4s + 0.75; T.bub = T.h4s + 1.05; T.rise0 = T.h4s + 1.3; T.go = T.h4s + 2.0; T.hudEnd = T.dur - 0.85;
const r = (x) => Math.round(x * 1000) / 1000;
const cues = [];
const add = (t, type, gain, extra) => cues.push(Object.assign({ t: r(t), type, gain }, extra || {}));

add(0.12, 'pop', 0.45);                              // HUD pops in
add(0.55, 'swish', 0.35);                            // hand rubs the eyes
add(T.nod0 + 0.3, 'swish', 0.3);                     // head sags
add(T.jerk - 0.04, 'thump', 0.45);                   // chin drops
add(T.jerk, 'gasp', 0.5);                            // jerks awake
add(T.jerk + 0.02, 'pop', 0.4);                      // the "!" pop
add(T.yw0 + 0.4, 'yawn', 0.75, { len: 1.4 });        // big yawn
add(T.h1e - 1.1, 'clockTick', 0.3, { n: 3 });        // bedtime
for (let i = 0; i < 3; i++) add(T.tr0 + 0.25 + i * 0.62, 'step', 0.3);   // trudge to bed
add(T.flare, 'eyeFlash', 0.45);                      // sunlight hits his eyes
add(T.flare + 0.05, 'heatShimmer', 0.35, { len: 2.4 });
for (let i = 0; i < 4; i++) add(T.wk0 + 0.15 + i * 0.5, 'step', 0.28);   // walk to window
add(T.wk1 + 0.5, 'heatShimmer', 0.3, { len: 3.2 });  // sun crawl, glowing room
add(T.h2e - 1.4, 'swish', 0.25);                     // sag
add(T.h3s + 0.05, 'echoPop', 0.4);                   // HUD pulse on "a hundred hours"... first beat
add(T.zoom0 + 0.1, 'swell', 0.35, { len: T.zoom1 - T.zoom0 + 0.5 });       // gentle breath as we look into the sky
add(T.gh0, 'clockWhirr', 0.55, { len: T.gh1 - T.gh0 });                     // ghost sun runs the loop
add(T.gh0 + 0.05, 'dialTick', 0.35, { n: 12 });
add(T.gh0 + 1.0, 'dialTick', 0.3, { n: 10 });
add(T.gh1 - 0.05, 'echoPop', 0.45);                  // loop closes
add(T.gh1 + 0.08, 'stingWonder', 0.5);               // 100 hours lands
add(T.idea, 'pop', 0.45);                            // the idea "!"
add(T.bub, 'pop', 0.35);                             // bubble grows
add(T.rise0 + 0.3, 'sunriseSwell', 0.6);             // sunrise in the bubble
add(T.go + 0.1, 'step', 0.35);
add(T.go + 0.6, 'step', 0.35);
add(T.go + 1.1, 'step', 0.35);
add(T.hudEnd, 'dialTick', 0.35, { n: 2 });           // HUD ticks over to 17
cues.sort((a, b) => a.t - b.t);

const out = {
  mood: 'wonder',
  music: {
    arc: [[0, T.h2s, 0.25], [T.h2s, T.h3s - 0.6, 0.4], [T.h3s - 0.6, T.cut, 0.7], [T.cut, T.dur, 0.55]].map(a => [r(a[0]), r(a[1]), a[2]]),
    risers: [[r(T.zoom1 + 0.3), r(T.gh1)]],
    silence: [[r(T.h2e + 0.1), r(T.h3s - 0.15)]]
  },
  ambience: 'indoor',
  cues
};
fs.writeFileSync(path.join(here, 'c1.cues.json'), JSON.stringify(out, null, 1));
console.log('cues', cues.length, 'dur', T.dur);
