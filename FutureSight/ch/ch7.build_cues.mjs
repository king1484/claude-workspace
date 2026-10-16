// Builds ch7.cues.json (local times, chapter dur 34.576). Run: node ch/ch7.build_cues.mjs
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const cues = [];
const c = (t, type, gain, extra) => cues.push(Object.assign({ t: +t.toFixed(3), type, gain }, extra || {}));

// z1: weeks pass, companion ghost walking
for (let k = 0; k < 5; k++) c(0.8 + k * 0.62, 'step', 0.3);
c(1.2, 'uiBlip', 0.35);
c(4.0, 'uiConfirm', 0.4);
c(5.5, 'riserShort', 0.4);

// z2: ghost world goes quiet
c(6.95, 'dropOut', 0.9);
c(7.1, 'glitch', 0.8, { len: 0.6 });
c(7.4, 'staticBurst', 0.5);
c(7.8, 'vhsTear', 0.6);
c(8.2, 'silenceHit', 0.7);
c(8.7, 'ghostWhoosh', 0.4, { len: 1.0 });

// z3: black, empty street, just you
c(9.6, 'stingDark', 0.6);
c(10.0, 'wind', 0.35);
c(11.9, 'wind', 0.25);

// z4: ten seconds of nothing
c(14.9, 'timerStart', 0.7);
c(15.0, 'sonar', 0.5);
c(16.0, 'eyeOpen', 0.6);
c(16.0, 'ghostWhoosh', 0.6, { len: 0.9 });
c(16.9, 'echoPop', 0.6);

// z5: the ghost doesn't blink
c(19.55, 'tick', 0.45, { n: 1 });
c(19.7, 'uiBlip', 0.3);
c(21.0, 'clockTick', 0.3, { n: 1 });

// z6: something ends -> ring counts
c(23.3, 'timerStart', 0.7);
c(23.3, 'heartbeat', 0.55, { len: 3.0, bpm: 60 });
for (let s = 1; s <= 10; s++) c(23.3 + s, 'timerBeep', 0.3 + 0.04 * s, { n: 1 });
for (let k = 0; k < 10; k++) c(23.8 + k, 'clockTick', 0.25, { n: 1 });

// z7: look up
c(26.6, 'swell', 0.6);

// z8: arms open, then zero
c(29.3, 'stingWonder', 0.6);
c(29.3, 'heartbeat', 0.7, { len: 4.0, bpm: 72 });
c(33.3, 'glitch', 0.9, { len: 0.6 });
c(33.3, 'flashHit', 0.8);
c(33.32, 'clockStop', 0.9);
c(33.4, 'silenceHit', 0.9);

cues.sort((a, b) => a.t - b.t);
const out = {
  mood: 'hollow',
  music: {
    arc: [[0, 6.95, 0.4], [6.95, 9.6, 0.2], [9.6, 14.9, 0.05], [14.9, 23.3, 0.2], [23.3, 29.3, 0.5],
      [29.3, 33.3, 0.65], [33.3, 34.576, 0.05]],
    risers: [[5.5, 6.95], [26.6, 29.3], [31.0, 33.3]],
    silence: [[9.9, 13.6], [33.4, 34.576]],
  },
  ambience: 'quiet',
  cues,
};
const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, 'ch7.cues.json'), JSON.stringify(out, null, 1));
console.log('ch7 cues:', cues.length);
