// Builds ch3.cues.json (local times, chapter dur 30.852). Run: node ch/ch3.build_cues.mjs
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const cues = [];
const c = (t, type, gain, extra) => cues.push(Object.assign({ t: +t.toFixed(3), type, gain }, extra || {}));

// street intro: the clock stops, the eyes light, a ghost pops
c(0.8, 'step', 0.3);
c(1.35, 'clockStop', 0.7);
c(1.5, 'eyeOpen', 0.8);
c(1.9, 'eyeFlash', 0.8);
c(1.9, 'echoPop', 0.7, { n: 1 });
c(2.3, 'whoosh', 0.8, { len: 0.4 });

// table tennis
c(3.0, 'pingpongHit', 0.7, { n: 1 });
c(3.62, 'pingpongBounce', 0.6);
c(4.0, 'ghostWhoosh', 0.6, { len: 0.9 });
c(4.55, 'pingpongHit', 0.9, { n: 1 });
c(4.95, 'pingpongBounce', 0.6);
c(5.25, 'paddleHit', 0.7);
c(5.7, 'pingpongBounce', 0.5);
c(5.9, 'punchMiss', 0.5);
c(6.35, 'pingpongBounce', 0.5);
c(6.9, 'pingpongBounce', 0.45);
c(8.2, 'whoosh', 0.8, { len: 0.4 });

// boxing
c(8.45, 'bellRing', 0.8);
c(10.15, 'punchMiss', 0.7);
c(11.35, 'punchMiss', 0.7);
c(11.35, 'rewind', 0.6, { len: 1.5 });
c(11.72, 'punchMiss', 0.7);
c(12.08, 'punchMiss', 0.7);
c(12.45, 'punch', 0.9);
c(12.45, 'crowdGasp', 0.5);
c(13.634, 'dropOut', 0.8, { len: 1.2 });
c(13.634, 'reverseSwell', 0.6, { len: 1.2 });
c(14.88, 'punchMiss', 0.4);
c(15.6, 'pullOut', 0.8);
c(16.9, 'whoosh', 0.9, { len: 0.4 });

// baseball
c(18.3, 'ghostWhoosh', 0.6, { len: 1.0 });
c(20.2, 'riserShort', 0.5, { len: 0.8 });
c(21.0, 'swish', 0.6);
c(21.43, 'batCrack', 0.95);
c(21.5, 'ballSmack', 0.8);
c(21.6, 'crowdGasp', 0.5);
c(22.0, 'crowdCheer', 0.4, { len: 1.2 });
c(24.0, 'whooshFast', 0.8, { len: 0.4 });

// finale vignettes
c(24.15, 'tick', 0.6, { n: 1 });
c(24.55, 'catchSoft', 0.8);
c(25.45, 'ghostWhoosh', 0.5, { len: 0.6 });
c(25.65, 'ballSmack', 0.8);
c(26.03, 'catchSoft', 0.9);
c(26.75, 'ghostWhoosh', 0.5, { len: 0.6 });
c(26.85, 'whoosh', 0.5, { len: 0.3 });
c(27.25, 'thump', 0.6);
c(27.5, 'thump', 0.6);
c(27.75, 'thump', 0.6);

// empty stadium
c(28.0, 'dropOut', 0.7, { len: 0.8 });
c(28.3, 'sonar', 0.6);
c(28.3, 'swell', 0.5, { len: 1.5 });
c(29.0, 'heartbeat', 0.5);
c(30.0, 'silenceHit', 0.5);

cues.sort((a, b) => a.t - b.t);
const out = {
  mood: 'tense',
  music: {
    arc: [[0, 2.3, 0.3], [2.3, 8.2, 0.55], [8.2, 13.634, 0.7], [13.634, 16.9, 0.3], [16.9, 21.43, 0.7], [21.43, 24.0, 0.8], [24.0, 28.0, 0.7], [28.0, 30.852, 0.2]],
    risers: [[19.8, 21.0], [27.0, 28.0]],
    silence: [[28.3, 30.3]],
  },
  ambience: 'arena',
  cues,
};
const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, 'ch3.cues.json'), JSON.stringify(out, null, 1));
console.log('ch3 cues:', cues.length);
