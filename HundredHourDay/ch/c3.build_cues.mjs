// Builds ch/c3.cues.json from the beat table exported by ch/c3.js (loaded in a vm). Run: node ch/c3.build_cues.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..');
const ctx = vm.createContext({ console, document: { createElement: () => ({ getContext: () => ({}) }) } });
ctx.window = ctx;
for (const f of ['lib.js', 'layout.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
vm.runInContext(fs.readFileSync(path.join(dir, 'c3.js'), 'utf8'), ctx, { filename: 'c3.js' });
const { T, DUR } = ctx.CH.c3.T;
const r = (x) => Math.round(x * 1000) / 1000;
const cues = [];
const add = (t, type, gain, extra) => cues.push(Object.assign({ t: r(t), type, gain }, extra || {}));

// b1 - blackout curtains, eye mask, lie down in full daylight
add(0.5, 'birdsong', 0.2, { len: 3.5 });
add(T.cordGrab, 'paperRustle', 0.3);
add(T.pull0, 'swish', 0.4);
add(T.pull1, 'thump', 0.3);                            // curtains meet
add(T.maskOn, 'pop', 0.3);                             // elastic mask snaps on
add(T.cutBed + 0.15, 'thump', 0.35);                   // drops onto the bed
add(T.cutBed + 0.9, 'snore', 0.25);
// b2 - the body-clock dial refuses to slow down
add(T.dialPush0, 'dialTick', 0.35, { n: 8 });
add(T.over24, 'clockTick', 0.3, { n: 6 });
add(T.lightDark, 'swell', 0.25, { len: 1.6 });
// b3 - Mammoth Cave 1938: warmer, hollow, a 28 h clock vs the body's 24 h dial
add(T.caveIn, 'dropOut', 0.4, { len: 1.2 });
add(T.caveIn + 0.5, 'doorCreak', 0.2);
add(T.clk28 - 0.3, 'clockTick', 0.3, { n: 8 });
add(T.clk28, 'clockWhirr', 0.25, { len: 0.6 });
add(T.clk24, 'clockStop', 0.3);
add(T.clkRun, 'dialTick', 0.3, { n: 6 });
add(T.noFollow, 'stingDark', 0.35);
// b4 - wakes in a dark room, the sun is still there (slow, but in the same place)
add(T.wake - 0.2, 'yawn', 0.4);
add(T.wake + 0.15, 'gasp', 0.35);
add(T.cutPeek, 'swish', 0.3);
add(T.glare, 'heatShimmer', 0.25, { len: 2.0 });
add(T.glare + 0.2, 'zap', 0.2);                        // glare in the eyes
// b5 - jet lag without the airplane: suitcase shuffle, one gag
for (let k = 0; k < 6; k++) add(T.walk0 + 0.3 + k * ((T.drop - T.walk0 - 0.5) / 5), 'step', 0.22);
add(T.drop, 'thump', 0.4);
add(T.drop + 0.12, 'boing', 0.25);
// b6 - while he naps the room cooks: time-lapse 22 -> 38, heat creeps in
add(T.cutLapse, 'clockWhirr', 0.5, { len: T.pull2 - T.cutLapse + 0.1 });
add(T.cutLapse + 0.3, 'heatShimmer', 0.3, { len: 5.5 });
add(T.cutLapse + 1.0, 'snore', 0.2);
add(T.wake2, 'gasp', 0.4);
add(T.cutWin, 'swish', 0.3);
add(T.pull2, 'sizzle', 0.3);
add(T.pull2 + 0.4, 'sweatDrip', 0.35);

cues.sort((a, b) => a.t - b.t);
const out = {
  mood: 'hollow',
  music: {
    arc: [[0, r(T.cutBed), 0.3], [r(T.cutBed), r(T.caveIn), 0.35], [r(T.caveIn), r(T.caveOut), 0.2], [r(T.caveOut), r(T.cutLapse), 0.35], [r(T.cutLapse), r(DUR), 0.55]],
    risers: [[r(T.pull2 - 1.4), r(T.pull2 + 0.1)]],
    silence: [[r(T.caveIn - 0.1), r(T.caveIn + 0.9)]]
  },
  ambience: 'indoor',
  cues
};
fs.writeFileSync(path.join(dir, 'c3.cues.json'), JSON.stringify(out, null, 1));
console.log('wrote c3.cues.json cues=' + cues.length + ' dur=' + r(DUR));
for (const c of cues) console.log(c.t, c.type, c.gain, c.len || '', c.n || '');
