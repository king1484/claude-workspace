// Builds ch4.cues.json (local times, chapter dur 27.2). Run: node ch/ch4.build_cues.mjs
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const cues = [];
const c = (t, type, gain, extra) => cues.push(Object.assign({ t: +t.toFixed(3), type, gain }, extra || {}));

// A: casino, first coin / sting
c(0.45, 'coinDrop', 0.6);
c(0.55, 'chipStack', 0.5);
c(1.0, 'sting', 0.5);
// B: roulette, ghost ball
c(2.45, 'whoosh', 0.6, { len: 0.4 });
c(2.5, 'rouletteSpin', 0.8, { len: 3.6 });
c(2.75, 'rouletteBall', 0.8, { len: 3.5 });
c(4.3, 'eyeFlash', 0.7);
c(4.32, 'ghostWhoosh', 0.7, { len: 1.5 });
c(6.3, 'catchSoft', 0.5);
c(6.3, 'crowdGasp', 0.7);
c(6.5, 'chipStack', 0.8);
c(6.7, 'coinDrop', 0.7);
c(6.9, 'chipStack', 0.6);
// C: guards, wall clock, ban
c(7.2, 'cutHit', 0.7);
c(7.3, 'clockTick', 0.4, { n: 3 });
c(7.95, 'step', 0.6);
c(8.1, 'step', 0.6);
c(8.2, 'uiError', 0.6);
c(8.25, 'hit', 0.5);
// X: thrown out
c(8.7, 'doorOpen', 0.7);
c(8.8, 'whooshFast', 0.8, { len: 0.4 });
c(9.1, 'land', 0.8);
c(9.12, 'dust', 0.5);
c(9.38, 'doorSlam', 1.0);
// D: apartment monitors, stock market
c(9.65, 'cutHit', 0.6);
c(9.75, 'tickerBlips', 0.6, { len: 1.8 });
c(10.2, 'keyboardTyping', 0.6, { len: 1.3 });
// E: chart w/ ghost candles
c(11.6, 'whoosh', 0.6, { len: 0.4 });
c(11.65, 'ghostWhoosh', 0.6, { len: 1.4 });
c(12.2, 'uiBlip', 0.6);
c(12.8, 'tickerBlips', 0.6, { len: 2.4 });
c(13.5, 'uiConfirm', 0.5);
// F: robot trader, 10 s = eternity
c(15.5, 'cutHit', 0.7);
c(15.6, 'keyboardTyping', 0.5, { len: 1.5 });
c(16.2, 'uiConfirm', 0.6);
c(16.7, 'uiConfirm', 0.6);
c(17.15, 'timerStart', 0.6);
c(17.4, 'clockTick', 0.3, { n: 4 });
c(18.2, 'riserShort', 0.5, { len: 0.4 });
// G: printing press
c(18.6, 'whooshFast', 0.7, { len: 0.4 });
c(18.65, 'cashRegister', 0.7);
c(18.9, 'moneyCount', 0.7, { len: 2.4 });
c(19.5, 'paperRustle', 0.5);
c(20.4, 'coinDrop', 0.5);
c(20.9, 'riserShort', 0.6, { len: 0.5 });
// H: thousand -> million -> billion
c(21.3, 'paperRustle', 0.6);
c(21.45, 'uiConfirm', 0.8);
c(21.45, 'sting', 0.5);
c(22.55, 'uiConfirm', 0.9);
c(22.55, 'swell', 0.6, { len: 0.8 });
c(23.35, 'boom', 0.8, { len: 0.8 });
c(23.35, 'uiConfirm', 1.0);
c(23.4, 'cashRegister', 0.8);
// I: penthouse, curtains close
c(24.4, 'whoosh', 0.5, { len: 0.5 });
c(25.05, 'swish', 0.7);
c(26.6, 'dropOut', 0.5, { len: 0.6 });

cues.sort((a, b) => a.t - b.t);
const out = {
  mood: 'bright',
  music: {
    arc: [[0, 2.5, 0.45], [2.5, 7.2, 0.6], [7.2, 9.65, 0.5], [9.65, 15.5, 0.5], [15.5, 18.6, 0.6], [18.6, 21.3, 0.7], [21.3, 24.4, 0.9], [24.4, 27.2, 0.4]],
    risers: [[18.2, 18.6], [20.9, 21.45], [22.0, 22.55]],
    silence: [],
  },
  ambience: 'casino',
  cues,
};
const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, 'ch4.cues.json'), JSON.stringify(out, null, 1));
console.log('ch4 cues:', cues.length);
