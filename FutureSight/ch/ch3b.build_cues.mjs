// Builds ch3b.cues.json (local times, chapter dur 44.236). Run: node ch/ch3b.build_cues.mjs
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const cues = [];
const c = (t, type, gain, extra) => cues.push(Object.assign({ t: +t.toFixed(3), type, gain }, extra || {}));

// plaza: snatch, ghost path, interception
for (let k = 0; k < 2; k++) c(0.9 + 1.6 * k, 'step', 0.25);
c(5.9, 'whoosh', 0.6, { len: 0.3 });
c(8.05, 'eyeFlash', 0.7);
c(8.05, 'ghostWhoosh', 0.7, { len: 1.0 });
c(9.2, 'step', 0.4);
c(10.6, 'sonar', 0.4);
c(11.0, 'thump', 0.9);
c(11.45, 'catchSoft', 0.7);
c(12.2, 'whoosh', 0.8, { len: 0.4 });

// road: six lanes, ghost cars
c(12.7, 'ghostWhoosh', 0.7, { len: 1.2 });
c(16.57, 'vehiclePass', 0.5, { peak: 0.5, len: 1.0, pitch: 1.1 });
for (const [t, ty] of [[17.65, 'carHorn'], [18.47, 'carHorn'], [19.35, 'carHorn'], [20.49, 'carHorn'], [20.62, 'carHorn'], [21.9, 'carHorn']]) c(t, ty, 0.6, { len: 0.5 });
c(22.95, 'whoosh', 0.8, { len: 0.4 });

// obstacle montage
c(23.55, 'ghostWhoosh', 0.6, { len: 0.6 });
c(24.0, 'truckPass', 0.8, { peak: 0.5, len: 1.4 });
c(24.75, 'bikePass', 0.7, { peak: 0.5, len: 1.0 });
c(25.45, 'birdsong', 0.5);
c(26.0, 'swish', 0.6);
c(27.0, 'whoosh', 0.8, { len: 0.4 });

// ghost row: ball, pot, skateboard, cart
c(27.6, 'ghostWhoosh', 0.6, { len: 0.7 });
c(28.4, 'echoPop', 0.5, { n: 1 });
c(29.2, 'ceramicBreak', 0.9);
c(30.0, 'skateboardRoll', 0.6);
c(30.9, 'clink', 0.5);
c(31.857, 'whoosh', 0.8, { len: 0.4 });

// smooth shot
c(32.5, 'swell', 0.5, { len: 2.0 });
c(35.17, 'thump', 0.4);
c(38.2, 'riserShort', 0.5, { len: 0.3 });
c(38.5, 'whoosh', 0.7, { len: 0.4 });

// clock + arrow
c(38.5, 'timerStart', 0.5);
for (let k = 1; k <= 4; k++) c(38.5 + 0.5 * k, 'clockTick', 0.5, { n: 1 });
c(39.85, 'ghostWhoosh', 0.7, { len: 0.8 });
c(39.85, 'echoPop', 0.6, { n: 1 });
c(40.5, 'swell', 0.7, { len: 1.5 });
c(41.13, 'stingWonder', 0.5);
for (let k = 0; k < 3; k++) c(41.2 + 1.0 * k, 'uiBlip', 0.3);
c(43.8, 'clockStop', 0.4);

cues.sort((a, b) => a.t - b.t);
const out = {
  mood: 'bright',
  music: {
    arc: [[0, 5.9, 0.35], [5.9, 12.2, 0.7], [12.2, 22.95, 0.7], [22.95, 31.857, 0.8], [31.857, 38.5, 0.5], [38.5, 40.5, 0.3], [40.5, 44.236, 0.7]],
    risers: [[7.3, 8.05], [38.0, 38.5], [39.9, 40.5]],
    silence: [],
  },
  ambience: 'city',
  cues,
};
const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, 'ch3b.cues.json'), JSON.stringify(out, null, 1));
console.log('ch3b cues:', cues.length);

