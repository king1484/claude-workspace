// Builds ch/c5.cues.json .. ch/c8.cues.json from the timing tables exported by ch/c5..c8.js (each loaded in a vm).
// Quiet, sparse, scene-specific; no whoosh on cuts. Run: node ch/build_cues_c5_c8.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..');
const ctx = vm.createContext({ console, document: { createElement: () => ({ getContext: () => ({}) }) } });
ctx.window = ctx;
for (const f of ['lib.js', 'layout.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
for (const id of ['c5', 'c6', 'c7', 'c8']) vm.runInContext(fs.readFileSync(path.join(dir, id + '.js'), 'utf8'), ctx, { filename: id + '.js' });
const r = (x) => Math.round(x * 1000) / 1000;

function build(id, mood, ambience, fn) {
  const { TT, CUT, END, d } = ctx.CH[id].T;
  const cues = [];
  const add = (t, type, gain, extra) => cues.push(Object.assign({ t: r(Math.max(0.05, Math.min(END - 0.1, t))), type, gain }, extra || {}));
  const music = fn({ TT, CUT, END, d, add });
  cues.sort((a, b) => a.t - b.t);
  const out = { mood, music: { arc: music.arc.map(([a, b, v]) => [r(a), r(b), v]), risers: (music.risers || []).map(([a, b]) => [r(a), r(b)]), silence: (music.silence || []).map(([a, b]) => [r(a), r(b)]) }, ambience, cues };
  out.music.arc[out.music.arc.length - 1][1] = r(END);
  fs.writeFileSync(path.join(dir, id + '.cues.json'), JSON.stringify(out, null, 1));
  console.log('wrote ' + id + '.cues.json cues=' + cues.length + ' dur=' + r(END));
}

// ---------------------------------------------------------------- c5 Long Night: sunset relief -> cold, lonely -> awe at the stars
build('c5', 'hollow', 'night', ({ TT, CUT, END, d, add }) => {
  const flick = [0.15, 0.75, 0.4, 1.15, 0.6].map((o) => TT.flick + o + 0.35);
  // A - sunset, relief, then the heat leaks away
  add(0.2, 'waves', 0.25, { len: CUT.B - 0.6 });
  add(0.9, 'step', 0.2); add(1.5, 'step', 0.2);
  add(TT.cheer, 'sting', 0.35);
  add(TT.leak, 'dropOut', 0.3, { len: 1.0 });
  add(TT.leak + 0.2, 'windHowl', 0.18, { len: 3.5 });
  add(TT.leak + 1.4, 'shiver', 0.3);
  // B - desert cold: how far the thermometer falls (hedged by the cloud thermometer)
  add(CUT.B + 0.3, 'crickets', 0.2, { len: CUT.C1 - CUT.B - 0.6 });
  add(TT.swing + 0.3, 'dialTick', 0.3, { n: 8 });
  add(TT.more, 'dialTick', 0.28, { n: 5 });
  add(TT.freeze - 0.2, 'riserShort', 0.2, { len: 0.6 });
  add(TT.freeze + 0.15, 'pop', 0.45);                       // the mercury crosses the freezing notch
  add(TT.freeze + 0.3, 'frostCrackle', 0.35, { len: 2.2 });
  add(TT.freeze + 0.6, 'shiver', 0.35);
  add(TT.cloud + 0.2, 'pop', 0.3);                          // a cloud keeps the other one warmer
  // C - the lights fail one block at a time; the panel has nothing to give; the battery drains
  flick.forEach((t, i) => add(t - 0.35, 'zap', 0.14 + 0.02 * i));
  add(TT.flick + 0.1, 'powerDown', 0.5);
  add(CUT.C2 + 0.15, 'pop', 0.3);
  add(TT.panel + 0.7, 'uiError', 0.25);
  add(TT.batt + 0.1, 'dialTick', 0.3, { n: 4 });
  add(TT.batt + 1.8, 'clockStop', 0.3);
  // D - one option: power from the sunlit side; only some districts go dark
  add(CUT.D + 0.4, 'globeSpin', 0.22, { len: CUT.D2 - CUT.D - 0.6 });
  add(TT.pull, 'sonar', 0.3);
  add(TT.pull + 0.2, 'swell', 0.3, { len: 2.0 });
  add(CUT.D2 + 0.1, 'generatorHum', 0.18, { len: CUT.E1 - CUT.D2 - 0.3 });
  add(TT.dark, 'powerDown', 0.35);
  // E - animals feel it too
  add(CUT.E1 + 0.2, 'crickets', 0.18, { len: CUT.E2 - CUT.E1 });
  add(CUT.E1 + 0.9, 'echoPop', 0.22, { n: 0 }); add(CUT.E1 + 1.55, 'echoPop', 0.22, { n: 1 });   // an owl, hoot-hoot
  add(CUT.E1 + 0.5, 'footstepGrass', 0.18); add(CUT.E1 + 0.95, 'footstepGrass', 0.18); add(CUT.E1 + 1.4, 'footstepGrass', 0.18);
  add(CUT.E2 + 0.1, 'windHowl', 0.2, { len: CUT.E3 - CUT.E2 });
  add(CUT.E2 + 0.5, 'shimmer', 0.25);
  add(TT.clock24 + 0.15, 'boing', 0.3);                     // the one gag: a rooster crows in the dark
  add(TT.clock24 + 0.5, 'clockTick', 0.3, { n: 6 });
  add(TT.clock24 + 2.0, 'boing', 0.25);
  // F - eight hours of sleep, time-lapse, wake up: still dark, forty-two to go
  add(CUT.F + 0.1, 'snore', 0.25);
  add(TT.lapse0, 'clockWhirr', 0.45, { len: TT.wake - TT.lapse0 + 0.1 });
  add(TT.wake, 'gasp', 0.4);
  add(TT.still - 0.05, 'stingDark', 0.3);
  add(TT.fortytwo, 'dialTick', 0.3, { n: 10 });
  // G - the slowest night sky anyone has seen
  add(CUT.G + 0.3, 'swell', 0.3, { len: 3.0 });
  add(TT.look + 0.35, 'stingWonder', 0.35);
  add(TT.look + 0.9, 'shimmer', 0.2);
  add(TT.shoot, 'ghostWhoosh', 0.2, { len: 0.9 });
  return {
    arc: [[0, CUT.B, 0.3], [CUT.B, CUT.C1, 0.22], [CUT.C1, CUT.D, 0.35], [CUT.D, CUT.E1, 0.35], [CUT.E1, CUT.F, 0.25], [CUT.F, CUT.G, 0.2], [CUT.G, END, 0.6]],
    risers: [[TT.freeze - 1.2, TT.freeze - 0.1]],
    silence: [[TT.still - 0.15, TT.still + 0.55]]
  };
});

// ---------------------------------------------------------------- c6 Weather: wind picks up, mechanism diagrams, failing hurricane, one possible storm
build('c6', 'tense', 'wind', ({ TT, CUT, END, d, add }) => {
  add(0.1, 'clockWhirr', 0.45, { len: TT.lapse1 });
  add(TT.lapse1, 'pop', 0.4);
  add(TT.wind - 0.1, 'windGust', 0.4);
  add(TT.wind + 0.3, 'windHowl', 0.22, { len: CUT.B1 - TT.wind - 0.4 });
  add(TT.wind + 0.8, 'paperFlutter', 0.2);
  // B - land/sea breeze mechanism
  add(CUT.B1 + 0.2, 'waves', 0.22, { len: CUT.B2 - CUT.B1 });
  add(TT.warm, 'heatShimmer', 0.2, { len: 3.5 });
  add(TT.day, 'seagull', 0.2);
  add(TT.day + 0.2, 'windGust', 0.25);
  add(CUT.B2 + 0.1, 'dropOut', 0.25, { len: 0.7 });
  add(CUT.B2 + 0.6, 'crickets', 0.18, { len: CUT.B3 - CUT.B2 });
  add(TT.night + 0.2, 'windGust', 0.25);
  add(TT.longer + 0.3, 'dialTick', 0.3, { n: 6 });
  add(TT.longer + 1.4, 'swell', 0.25, { len: 2.0 });
  add(TT.harder, 'windGust', 0.5);
  add(TT.harder + 0.15, 'swish', 0.25);
  add(TT.harder + 0.6, 'boing', 0.25);                      // the beanie takes off: the one mild gag
  // C - Coriolis a quarter as strong: the hurricane struggles
  add(CUT.C + 0.3, 'globeSpin', 0.2, { len: 6 });
  add(TT.hurr, 'rumble', 0.22, { len: 2.0 });
  add(TT.four, 'dialTick', 0.3, { n: 4 });
  add(TT.four + 0.6, 'pop', 0.3);
  add(TT.differ, 'reverseSwell', 0.3, { len: 1.6 });
  add(TT.differ + 0.3, 'pop', 0.3);
  add(TT.struggle + 0.5, 'dropOut', 0.25, { len: 0.8 });
  // D - one possible storm, hedged
  add(CUT.D + 0.2, 'rainDrops', 0.28, { len: END - CUT.D - 0.4 });
  add(CUT.D + 0.2, 'windHowl', 0.3, { len: END - CUT.D - 0.4 });
  add(TT.nobody + 0.3, 'pop', 0.3);
  add(TT.flash, 'thunderFar', 0.5);
  add(TT.flash + 0.28, 'thunderFar', 0.3);
  return {
    arc: [[0, CUT.B1, 0.3], [CUT.B1, CUT.B2, 0.25], [CUT.B2, CUT.B3, 0.22], [CUT.B3, CUT.B4, 0.3], [CUT.B4, CUT.C, 0.45], [CUT.C, CUT.D, 0.4], [CUT.D, END, 0.65]],
    risers: [[TT.flash - 3.0, TT.flash - 0.05]],
    silence: []
  };
});

// ---------------------------------------------------------------- c7 Oceans: sunrise at hour 100, then years, bulge, slow rock, new map
build('c7', 'wonder', 'ocean', ({ TT, CUT, END, d, add }) => {
  const h = ctx.CH.c7.T.hud;
  add(0.05, 'clockWhirr', 0.45, { len: h.t100 });
  add(h.t100, 'pop', 0.45);
  add(h.t100 + 0.05, 'sunriseSwell', 0.55);
  add(1.6, 'seagull', 0.2);
  add(0.3, 'waves', 0.25, { len: CUT.B - 0.4 });
  add(TT.made, 'sting', 0.4);
  add(TT.made + 1.0, 'thump', 0.25);                        // collapses with joy
  // B - years, not hours: the calendar flips over a fast globe
  add(CUT.B + 0.1, 'clockWhirr', 0.4, { len: 3.6 });
  add(CUT.B + 0.1, 'globeSpin', 0.28, { len: 3.6 });
  add(TT.years - 0.3, 'stingWonder', 0.35);
  // C - Earth is not a perfect ball: the 21 km bulge
  add(CUT.C1 + 0.2, 'swell', 0.3, { len: 3.5 });
  add(TT.bulge, 'pop', 0.3);
  add(CUT.C2 + 0.25, 'pop', 0.3);
  add(TT.km, 'echoPop', 0.3, { n: 2 });
  // D/E - water in the bulge; the spin slows; water slides, rock stays
  add(CUT.D + 0.4, 'bubbles', 0.2, { len: 2.2 });
  add(TT.spin, 'globeSpin', 0.18, { len: 1.8 });
  add(TT.flow, 'waterRush', 0.35, { len: 3.5 });
  add(TT.stiff, 'dropOut', 0.2, { len: 0.8 });
  add(TT.stiff + 0.3, 'pop', 0.25);                         // ghost outline of the rock
  add(TT.thousands, 'clockTick', 0.3, { n: 6 });
  // F - sea level shifts poleward (illustrative, no figures), the unknown, the rock relaxes
  add(CUT.F1 + 0.3, 'waterRush', 0.35, { len: 5.5 });
  add(TT.seafloor, 'landRise', 0.28, { len: 4.0 });
  add(TT.flood, 'bubbles', 0.22, { len: 2.5 });
  add(CUT.F2 + 0.2, 'dialTick', 0.28, { n: 6 });
  add(TT.howFar + 1.0, 'pop', 0.35);
  add(TT.relax, 'landRise', 0.25, { len: 4.5 });
  add(TT.relax + 0.4, 'clockTick', 0.25, { n: 6 });
  // G - a different map
  add(CUT.G + 0.1, 'waves', 0.2, { len: END - CUT.G });
  add(CUT.G + 0.9, 'seagull', 0.2);
  add(TT.newMap + 0.2, 'stingWonder', 0.4);
  return {
    arc: [[0, CUT.B, 0.5], [CUT.B, CUT.C1, 0.4], [CUT.C1, CUT.D, 0.35], [CUT.D, CUT.E, 0.3], [CUT.E, CUT.F1, 0.3], [CUT.F1, CUT.F2, 0.5], [CUT.F2, CUT.F3, 0.25], [CUT.F3, CUT.G, 0.4], [CUT.G, END, 0.55]],
    risers: [],
    silence: [[TT.howFar + 0.7, TT.howFar + 1.0]]
  };
});

// ---------------------------------------------------------------- c8 Wrap: warm resolve, honest shrug, subscribe, next-video teaser
build('c8', 'warm', 'quiet', ({ TT, CUT, END, d, add }) => {
  add(0.2, 'birdsong', 0.2, { len: 5 });
  add(0.35, 'waves', 0.2, { len: CUT.B1 - 0.5 });
  add(TT.q, 'pop', 0.35);
  add(CUT.B1 + 0.1, 'generatorHum', 0.15, { len: CUT.B2 - CUT.B1 });
  add(CUT.B1 + 0.6, 'dialTick', 0.25, { n: 6 });
  add(CUT.B2 + 0.1, 'birdsong', 0.2, { len: 2.8 });
  add(CUT.B2 + 0.8, 'pop', 0.25);
  add(CUT.B3 + 0.5, 'snore', 0.2);
  add(TT.sleep + 3.6, 'yawn', 0.3);
  add(CUT.B4 + 0.5, 'pop', 0.3);
  add(CUT.C + 0.2, 'clockTick', 0.25, { n: 12 });
  add(TT.surprise, 'stingWonder', 0.3);
  add(TT.surprise + 0.2, 'pop', 0.25);
  add(TT.like + 0.45, 'uiConfirm', 0.45);
  add(TT.sub + 0.4, 'bellRing', 0.3);
  const bt = [-0.4, -0.18, 0.04, 0.26, 0.48, 0.7, 0.92, 1.14];
  bt.forEach((o, i) => add(TT.thoughts + o, 'pop', 0.16 + 0.01 * i));
  add(CUT.E + 0.2, 'swell', 0.28, { len: 2.6 });
  return {
    arc: [[0, CUT.B1, 0.4], [CUT.B1, CUT.C, 0.4], [CUT.C, CUT.D, 0.35], [CUT.D, CUT.E, 0.45], [CUT.E, END, 0.4]],
    risers: [],
    silence: []
  };
});
