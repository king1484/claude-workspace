// Builds ch/c4.cues.json. Cue times follow LAYOUT through the T table exported by ch/c4.js (loaded here in a vm).
// Run: node ch/c4.build_cues.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..');
const ctx = vm.createContext({ console });
ctx.window = ctx;
for (const f of ['lib.js', 'layout.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
vm.runInContext(fs.readFileSync(path.join(dir, 'c4.js'), 'utf8'), ctx, { filename: 'c4.js' });
const { TT, CUT, END, d } = ctx.CH.c4.T;
const r = (x) => Math.round(x * 1000) / 1000;
const cues = [];
const add = (t, type, gain, extra) => cues.push(Object.assign({ t: r(t), type, gain }, extra || {}));

// A - white-hot city: sunglasses, towel, sweat, the night-time daydream
add(0.6, 'heatShimmer', 0.3, { len: CUT.B - 0.8 });
add(0.8, 'cicadas', 0.3, { len: CUT.C - 1.0 });
add(1.75, 'pop', 0.35);                                  // sunglasses go on
add(3.6, 'sweatDrip', 0.4);
add(d.d1.start + d.d1.dur * 0.613, 'swish', 0.35);       // wipes his brow
add(TT.d1s2 + 0.3, 'pop', 0.5);                          // thought bubble: cool night
add(TT.d1s2 + 0.5, 'stingWonder', 0.3);
add(d.d1.end - 0.5, 'pop', 0.5);                         // bubble pops
add(d.d1.end - 0.3, 'sweatDrip', 0.45);
// B - Lut desert: satellite pass, ground thermometer to the 70 notch, then "likely even hotter"
add(TT.satA + 1.0, 'sonar', 0.25);
add(TT.satA + 3.2, 'sonar', 0.2);
add(d.d2.start + 1.3, 'dialTick', 0.3, { n: 10 });
add(TT.tc, 'pop', 0.55);                                 // notch flashes
add(TT.tc + 0.12, 'gasp', 0.5);
add(TT.d2s2 + 0.3, 'fanWhir', 0.35, { len: 3.2 });
add(TT.d2s2 + 1.7, 'sweatDrip', 0.4);
// C - barefoot gag: music rests, then the sole meets the sand
add(TT.d2s3 - 0.1, 'swish', 0.25);                       // lifts a foot
add(TT.touch, 'sizzle', 0.8);
add(TT.touch + 0.05, 'gasp', 0.55);
add(TT.touch + 0.2, 'boing', 0.5);
add(TT.touch + 0.36, 'step', 0.35);
add(TT.touch + 0.72, 'step', 0.35);
add(TT.touch + 1.08, 'step', 0.3);
// D - farm: plants wilt, warm columns rise, storm tower grows
add(d.d3.start + 0.5, 'paperRustle', 0.3);
add(TT.d3rise, 'heatShimmer', 0.35, { len: 3.0 });
add(TT.d3rise + 0.1, 'swell', 0.4, { len: 1.8 });
add(TT.d3storm - 0.1, 'rumble', 0.4, { len: 2.4 });
add(TT.d3storm + 0.6, 'thunderFar', 0.5);
// E - coast: sea air, two thermometers, breeze
add(CUT.E + 0.1, 'waves', 0.4, { len: CUT.F1 - CUT.E - 0.3 });
add(CUT.E + 0.4, 'step', 0.3);
add(CUT.E + 1.0, 'step', 0.3);
add(CUT.E + 1.9, 'seagull', 0.3);
add(TT.d4water + 0.1, 'dialTick', 0.3, { n: 10 });
add(TT.d4sea + 0.3, 'bubbles', 0.2, { len: 1.2 });
add(TT.d4breeze - 0.1, 'windGust', 0.5);
add(TT.d4breeze + 0.3, 'swell', 0.35, { len: 2.4 });
// F - shade walk, shade comparison, strolling to the beach (ends on motion)
add(CUT.F1 + 0.5, 'step', 0.25);
add(CUT.F1 + 1.3, 'step', 0.25);
add(TT.enter, 'dropOut', 0.3, { len: 0.7 });             // steps into the shade: heat eases
add(TT.d5s2 + 0.1, 'pop', 0.3);                          // cold bottle appears
add(TT.d5s2 + 0.45, 'waterRush', 0.2, { len: 0.7 });     // sip
add(TT.d5shade - 0.05, 'clockTick', 0.3, { n: 8 });
add(CUT.F3 + 0.4, 'step', 0.3);
add(CUT.F3 + 1.0, 'step', 0.3);

cues.sort((a, b) => a.t - b.t);
const out = {
  mood: 'tense',
  music: {
    arc: [[0, CUT.B, 0.35], [CUT.B, CUT.C, 0.5], [CUT.C, CUT.D, 0.2], [CUT.D, CUT.E, 0.6], [CUT.E, CUT.F1, 0.3], [CUT.F1, END, 0.4]].map(([a, b, v]) => [r(a), r(b), v]),
    risers: [[r(TT.d2s3 - 1.2), r(TT.touch - 0.8)], [r(TT.d3storm - 1.6), r(TT.d3storm)]],
    silence: [[r(TT.touch - 0.8), r(TT.touch + 0.05)]]
  },
  ambience: 'desert',
  cues
};
out.music.arc[out.music.arc.length - 1][1] = r(END);
fs.writeFileSync(path.join(dir, 'c4.cues.json'), JSON.stringify(out, null, 1));
console.log('wrote c4.cues.json cues=' + cues.length + ' dur=' + r(END));
for (const c of cues) console.log(c.t, c.type, c.gain, c.len || '', c.n || '');
