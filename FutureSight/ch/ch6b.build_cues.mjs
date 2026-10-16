// Builds ch6b.cues.json (local times, chapter dur 43.265). Run: node ch/ch6b.build_cues.mjs
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const cues = [];
const c = (t, type, gain, extra) => cues.push(Object.assign({ t: +t.toFixed(3), type, gain }, extra || {}));

// A: ghost reveal + arm-mirroring experiment
c(0.9, 'eyeOpen', 0.7);
c(0.95, 'ghostWhoosh', 0.7, { len: 1.3 });
c(3.3, 'sonar', 0.5);
c(5.7, 'tick', 0.7, { n: 1 });
c(6.35, 'tick', 0.7, { n: 1 });
c(7.85, 'tick', 0.7, { n: 1 });
c(9.55, 'tick', 0.7, { n: 1 });
c(10.3, 'riserShort', 0.5);

// B: the ghost "changes", pull-out, infinity, echo chain
c(10.95, 'glitch', 0.9, { len: 0.4 });
c(10.95, 'flashHit', 0.9);
c(11.0, 'stingDark', 0.8);
c(12.96, 'pullOut', 0.9);
c(13.4, 'sonar', 0.6);
c(13.45, 'ghostWhoosh', 0.7, { len: 1.6 });
for (let i = 0; i < 5; i++) c(15.2 + i * 0.42, 'echoPop', 0.8 - i * 0.1);
c(17.3, 'reverseSwell', 0.7);
c(17.3, 'riserShort', 0.6);

// C: void ouroboros
c(19.55, 'cutHit', 1.0);
c(19.55, 'staticBurst', 0.6);
c(19.6, 'bigImpact', 0.8);
c(19.8, 'timerStart', 0.7);
c(20.1, 'clockTick', 0.35, { n: 4 });
c(22.0, 'clockTick', 0.3, { n: 2 });
c(20.6, 'wind', 0.4);
c(21.25, 'crack', 0.9);
c(21.27, 'bigImpact', 0.7);
c(22.2, 'reverseSwell', 0.6);

// D: back to the street, hero ignores, ghost shatters
c(22.95, 'cutHit', 0.9);
c(22.95, 'whooshFast', 0.6);
c(23.4, 'timerStart', 0.6);
c(25.3, 'glitch', 0.6, { len: 0.5 });
c(26.45, 'dropOut', 0.7);
c(26.9, 'glitch', 0.8, { len: 0.5 });
c(27.45, 'glassBreak', 0.9);
c(27.45, 'flashHit', 0.7);
c(27.55, 'dust', 0.6);

// E: eyes close, quiet, heartbeats
c(28.98, 'silenceHit', 0.9);
c(29.9, 'dropOut', 0.8);
c(33.5, 'wind', 0.3);
c(34.85, 'heartbeat', 0.8, { len: 1.1, bpm: 62 });

// F: eyes open, sunrise
c(36.35, 'eyeOpen', 0.9);
c(36.35, 'swell', 0.8);
c(36.4, 'stingWonder', 0.7);
c(36.9, 'birdsong', 0.4);

// G: walk, birds
for (let k = 0; k < 4; k++) c(37.7 + 0.8 * k, 'step', 0.35);
c(40.0, 'birdsong', 0.6);
c(41.12, 'wind', 0.7);
c(41.12, 'gasp', 0.5);
c(41.15, 'sting', 0.6);
c(41.2, 'birdsong', 0.9);

cues.sort((a, b) => a.t - b.t);
const out = {
  mood: 'dark',
  music: {
    arc: [[0, 10.95, 0.4], [10.95, 19.55, 0.7], [19.55, 22.95, 0.85], [22.95, 27.45, 0.5], [27.45, 29.9, 0.25],
      [29.9, 34.85, 0.04], [34.85, 36.35, 0.12], [36.35, 41.0, 0.55], [41.0, 43.265, 0.65]],
    risers: [[10.3, 10.95], [17.3, 19.55], [22.2, 22.95], [35.6, 36.35]],
    silence: [[29.9, 34.8]],
  },
  ambience: 'city',
  cues,
};
const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, 'ch6b.cues.json'), JSON.stringify(out, null, 1));
console.log('ch6b cues:', cues.length);
