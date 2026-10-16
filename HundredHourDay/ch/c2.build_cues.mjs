// Builds ch/c2.cues.json. Cue times follow LAYOUT through the T table exported by ch/c2.js (loaded here in a vm).
// Run: node ch/c2.build_cues.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..');
const ctx = vm.createContext({ console });
ctx.window = ctx;
for (const f of ['lib.js', 'layout.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
vm.runInContext(fs.readFileSync(path.join(dir, 'c2.js'), 'utf8'), ctx, { filename: 'c2.js' });
const T = ctx.CH.c2.T;
const dur = T.dur;
const r = (x) => Math.round(x * 1000) / 1000;
const cues = [];
const add = (t, type, gain, extra) => cues.push(Object.assign({ t: r(t), type, gain }, extra || {}));

// r1 - the globe spins fast, then the dial pops in
add(0.35, 'globeSpin', 0.5, { len: T.dial - 0.5 });
add(T.dial, 'pop', 0.8);
add(T.dial + 0.12, 'gasp', 0.5);
add(T.dial + 1.1, 'sweatDrip', 0.5);
// r2 - slowed to a quarter: globe winds down with the dial, relief
add(T.kS - 0.05, 'globeSpin', 0.4, { len: T.kE - T.kS + 0.8 });
add(T.kS + 0.1, 'dialTick', 0.5, { n: 9 });
add(T.kS + 1.25, 'dialTick', 0.4, { n: 6 });
add(T.kE + 0.1, 'exhale', 0.5);
// r2 end - pip bar fills (24 normal, then up to 100)
add(T.bar, 'pop', 0.6);
add(T.bar + 0.45, 'uiBlip', 0.4);
add(T.bar + 0.9, 'dialTick', 0.35, { n: 8 });
add(T.bar + 1.8, 'dialTick', 0.3, { n: 8 });
add(T.bar100 + 0.2, 'uiConfirm', 0.4);
// r4 - tilt to the polar view, tiny host pinned on the equator
add(T.tilt0, 'swell', 0.5, { len: 1.8 });
add(T.tilt0 + 0.85, 'pop', 0.6);
add(T.equin, 'heatShimmer', 0.25, { len: 1.6 });
add(T.day, 'uiBlip', 0.5);
add(T.day, 'clockWhirr', 0.22, { len: T.r4end - T.day });
add(T.night, 'uiBlip', 0.45);
add(T.night + 0.5, 'exhale', 0.35);
// r5 - cut to the bedroom
const tk = T.tick0, step = (T.tickEnd - T.tick0) / 24;
add(T.cut + 0.2, 'pop', 0.6);
add(T.yawn0, 'yawn', 0.6);
for (let k = 0; k < 6; k++) add(tk + k * 4 * step, 'dialTick', 0.28 + 0.03 * k, { n: 4 });
add(T.tickEnd, 'uiConfirm', 0.55);
add(T.tickEnd, 'eyeOpen', 0.5);
cues.sort((a, b) => a.t - b.t);

const out = {
  mood: 'wonder',
  music: {
    arc: [
      [0, r(T.dial - 0.35), 0.45],
      [r(T.dial - 0.35), r(T.kS), 0.7],
      [r(T.kS), r(T.bar), 0.5],
      [r(T.bar), r(T.tilt0), 0.6],
      [r(T.tilt0), r(T.night), 0.7],
      [r(T.night), r(T.cut), 0.45],
      [r(T.cut), r(dur), 0.3],
    ],
    risers: [[r(T.tilt0 - 1.0), r(T.tilt0)]],
    silence: [[r(T.dial - 0.3), r(T.dial + 0.12)]],
  },
  ambience: 'void',
  cues,
};
fs.writeFileSync(path.join(dir, 'c2.cues.json'), JSON.stringify(out, null, 2));
console.log('cues', cues.length, 'T', JSON.stringify(Object.fromEntries(Object.entries(T).map(([k, v]) => [k, r(v)]))));
