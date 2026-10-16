// Builds ch4b.cues.json (local times, chapter dur 53.893). Run: node ch/ch4b.build_cues.mjs
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const cues = [];
const c = (t, type, gain, extra) => cues.push(Object.assign({ t: +t.toFixed(3), type, gain }, extra || {}));

// S1: bills blow away
c(0.5, 'wind', 0.5, { len: 3 });
c(0.7, 'paperRustle', 0.6);
c(1.4, 'whoosh', 0.5, { len: 1.0 });
// Rush: morning crowd, phone, "10M"
c(3.4, 'cutHit', 0.6);
c(3.9, 'vehiclePass', 0.5, { len: 1.8, peak: 0.5 });
c(5.35, 'uiBlip', 0.5);
// hero freezes, vision
c(8.3, 'silenceHit', 0.6);
c(8.6, 'eyeOpen', 0.8);
c(8.8, 'eyeFlash', 0.9);
c(8.85, 'ghostWhoosh', 0.8, { len: 1.5 });
c(9.0, 'quakeCrack', 0.7);
c(9.2, 'rumble', 0.45, { len: 2.4 });
c(10.9, 'quakeCrack', 0.6);
c(11.2, 'riserShort', 0.5, { len: 0.7 });
// towers + "10"
c(11.9, 'cutHit', 0.8);
c(12.2, 'timerStart', 0.7);
c(14.5, 'quakeCrack', 0.9);
c(14.55, 'rumble', 0.6, { len: 3.4 });
c(15.45, 'glassBreak', 0.9);
c(15.6, 'glassRain', 0.7, { len: 1.6 });
c(16.3, 'buildingCreak', 0.7, { len: 2.0 });
// seismograph
c(18.2, 'cutHit', 0.7);
c(20.0, 'uiBlip', 0.8);
c(20.0, 'sonar', 0.6);
c(21.3, 'riserShort', 0.5, { len: 1.5 });
c(22.85, 'boom', 0.8, { len: 0.9 });
c(22.88, 'rumble', 0.5, { len: 1.2 });
// people icons
c(23.4, 'whoosh', 0.6, { len: 0.5 });
c(23.75, 'echoPop', 0.5, { n: 6 });
c(26.1, 'uiConfirm', 0.7);
// cards: train / surgeon / elevator
c(27.2, 'swish', 0.6);
c(27.45, 'uiBlip', 0.6);
c(27.6, 'skid', 0.6, { len: 1.2 });
c(29.3, 'uiBlip', 0.6);
c(29.45, 'clink', 0.5);
c(31.1, 'uiBlip', 0.6);
c(31.3, 'tick', 0.5, { n: 2 });
// street
c(33.6, 'cutHit', 0.7);
c(34.0, 'siren', 0.5, { len: 1.4 });
c(34.0, 'uiError', 0.6);
c(36.1, 'timerStart', 0.7);
c(38.3, 'gasp', 0.3);
c(39.55, 'uiError', 0.4);
c(40.6, 'riserShort', 0.5, { len: 0.4 });
// scream (no scream type: swell + gasp + punch accent)
c(41.0, 'gasp', 0.8);
c(41.0, 'swell', 0.8, { len: 1.0 });
c(41.05, 'punch', 0.5);
c(42.05, 'swish', 0.6);
c(42.9, 'footstepsRun', 0.7, { len: 3.2 });
c(43.8, 'crowdPanic', 0.6, { len: 2.4 });
c(45.5, 'riserShort', 0.6, { len: 0.6 });
c(45.9, 'dropOut', 0.8, { len: 0.2 });
// the quake hits
c(46.1, 'quakeCrack', 1.0);
c(46.1, 'bigImpact', 1.0);
c(46.12, 'boom', 0.9, { len: 1.5 });
c(46.2, 'rumble', 0.9, { len: 3.5 });
c(46.3, 'debrisFall', 0.8, { len: 2.2 });
c(46.4, 'glassRain', 0.8, { len: 2.0 });
c(46.6, 'buildingCreak', 0.7, { len: 1.8 });
c(47.2, 'dust', 0.7);
c(48.6, 'sirenDistant', 0.4, { len: 5 });
// aftermath
c(49.3, 'wind', 0.4, { len: 3 });
c(51.4, 'stingWonder', 0.6);
c(53.0, 'dropOut', 0.6, { len: 0.8 });

cues.sort((a, b) => a.t - b.t);
const out = {
  mood: 'epic',
  music: {
    arc: [[0, 3.4, 0.3], [3.4, 8.6, 0.4], [8.6, 11.9, 0.6], [11.9, 18.2, 0.7], [18.2, 23.4, 0.6], [23.4, 33.6, 0.4], [33.6, 40.9, 0.55], [40.9, 46.1, 0.85], [46.1, 48.6, 1.0], [48.6, 51.3, 0.3], [51.3, 53.893, 0.45]],
    risers: [[11.2, 11.9], [21.3, 22.85], [40.6, 41.0], [44.9, 46.1]],
    silence: [[45.9, 46.1]],
  },
  ambience: 'city',
  cues,
};
const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, 'ch4b.cues.json'), JSON.stringify(out, null, 1));
console.log('ch4b cues:', cues.length);
