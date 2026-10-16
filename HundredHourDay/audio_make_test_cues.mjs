// audio_make_test_cues.mjs -- writes a synthetic cue set (one file per chapter) to audio_test_cues/ for exercising sfx_full.mjs.
// Usage: node audio_make_test_cues.mjs   then   node sfx_full.mjs --cues-dir audio_test_cues --wav-only --check
// Covers every SFX type exactly where its theme fits, plus: an unknown cue type, a cue without t, a bad mood name, cues with missing params,
// brief intentional silences, risers, whooshes only for real fast motion.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'audio_test_cues');
fs.mkdirSync(OUT, { recursive: true });
const layout = JSON.parse(fs.readFileSync(path.join(HERE, 'out', 'layout.json'), 'utf8'));
const L = layout.chapters || layout;
const durOf = (id) => (L[id] || L.find?.((c) => c.id === id)).dur;
const T = (type, t, extra = {}) => ({ type, ...(t === null ? {} : { t }), ...extra });

// [type, optionalParams, optionalFixedTime]
const X = (type, p = {}, t) => ({ type, p, t });
const THEMES = {
  c1: { mood: 'bright', ambience: 'city',
    music: { arc: [[0, 3, 0.3], [3, 10, 0.55], [10, 16, 0.85], [16, 19.124, 0.4]], risers: [[13.0, 15.2]], silence: [[15.2, 15.8]] },
    list: [X('sunriseSwell', { len: 4 }, 0.4), X('birdsong', { len: 5 }), X('alarmClock'), X('phoneBuzz'), X('phoneTap'), X('doorOpen'), X('doorClick'), X('step'), X('footstepConcrete'), X('stepRun', { n: 4 }),
      X('footstepsRun', { len: 2 }), X('uiBlip'), X('uiConfirm'), X('tickerBlips'), X('keyboardTyping'), X('clockTick', { n: 3 }), X('tick', { n: 4 }), X('eyeOpen', {}, 4.2), X('bikePass', {}, 6.0), X('vehiclePass', { len: 2.4 }), X('carHorn'),
      X('whooshFast', { len: 0.7 }, 7.4), X('crowdMurmur', { len: 4 }), X('sting', {}, 16.2), X('titleImpact', { len: 3 }, 11.8)] },
  c2: { mood: 'wonder', ambience: 'indoor',
    music: { arc: [[0, 6, 0.3], [6, 16, 0.5], [16, 25.682, 0.65]], risers: [[19, 22]], silence: [[22, 22.6]] },
    list: [X('clockWhirr', { len: 3 }), X('dialTick', { n: 6 }), X('globeSpin', { len: 3 }), X('timerStart'), X('timerBeep', {}, 8), X('clockStop'), X('pop'), X('echoPop', { n: 3 }), X('shimmer'), X('ghostAppear'), X('ghostFade'), X('sonar'),
      X('stingWonder', {}, 22.7), X('paperRustle'), X('paperFlutter'), X('grab'), X('knock'), X('doorCreak'), X('fanWhir', { len: 4 }), X('glassTink'), X('ceramicTap'), X('clink'), X('cork'), X('partyPopper'), X('clap'), X('laughTrack'), X('swish'), X('bubbles', { len: 3 }),
      X('laserBeam', { len: 1 }), { type: 'step', p: {}, noT: true }] },
  c3: { mood: 'warm', ambience: 'night',
    music: { arc: [[0, 10, 0.3], [10, 25, 0.4], [25, 35.12, 0.25]], risers: [], silence: [[12, 13.5]] },
    list: [X('snore', { len: 3 }), X('yawn'), X('crickets', { len: 6 }), X('exhale'), X('inhale'), X('heartbeat', { len: 5, bpm: 60 }), X('clothRustle'), X('clothFlap'), X('airPuff'), X('boing'), X('sweatDrip'), X('munch'), X('shiver'), X('gasp'),
      X('thump'), X('bodyBump'), X('ballThud'), X('objectThud'), X('rewind', { len: 1.5 }), X('reverseSwell', { len: 2 }), X('glitch'), X('vhsTear'), X('staticBurst'), X('dust'), X('powerDown'), X('silenceHit', {}, 20.0)] },
  c4: { mood: 'tense', ambience: 'desert',
    music: { arc: [[0, 7, 0.35], [7, 24, 0.6], [24, 40, 0.9], [40, 49.185, 0.55]], risers: [[16, 20], [35, 39]], silence: [[39.6, 40.3]] },
    list: [X('cicadas', { len: 6 }), X('heatShimmer', { len: 4 }), X('sizzle', { len: 3 }), X('windHowl', { len: 5 }), X('windGust'), X('wind', { len: 4 }), X('sirenDistant', { len: 4 }), X('siren', { len: 3 }), X('generatorHum', { len: 5 }), X('zap'), X('fanWhir'),
      X('rumble', { len: 3 }), X('crack'), X('quakeCrack'), X('debrisFall'), X('buildingCreak'), X('dropOut', { len: 1.2 }, 39.5), X('footstepGravel'), X('footstepsRun', { len: 3 }), X('stingDark', {}, 41.0), X('swell', { len: 3 }, 30), X('riserShort', { len: 2 }, 14),
      X('explosionFar'), X('boom'), X('bigImpact', {}, 40.3)] },
  c5: { mood: 'hollow', ambience: 'wind',
    music: { arc: [[0, 18, 0.2], [18, 38, 0.3], [38, 55.685, 0.55]], risers: [], silence: [[9, 10.5], [30, 31.2]] },
    list: [X('frostCrackle', { len: 4 }), X('windHowl', { len: 6 }), X('shiver'), X('wind', { len: 5 }), X('powerDown'), X('generatorHum', { len: 5 }), X('clockTick', { n: 4 }), X('heartbeat', { len: 6, bpm: 48 }), X('footstepGrass'), X('footstepWood'), X('subWhoosh'),
      X('dust'), X('sonar'), X('tick', { n: 3 }), X('shimmer'), X('bellRing'), X('stingWonder', {}, 44)] },
  c6: { mood: 'stormy', ambience: 'wind',
    music: { arc: [[0, 6, 0.5], [6, 28, 0.85], [28, 40.136, 0.5]], risers: [[9, 12], [22, 25]], silence: [] },
    list: [X('thunderFar', { len: 5 }), X('rainDrops', { len: 6 }), X('rain', { len: 6 }), X('windGust'), X('windHowl', { len: 4 }), X('rumble', { len: 3 }), X('crack'), X('glassBreak'), X('ceramicBreak'), X('ceramicClatter'), X('doorSlam'), X('crowdPanic', { len: 3 }),
      X('crowdGasp'), X('sirenDistant', { len: 4 }), X('glassRain', { len: 3 }), X('truckHorn'), X('truckPass', {}, 14), X('tirePass'), X('skid'), X('slide'), X('skateboardRoll'), X('skateboardSlam'), X('whoosh', { len: 0.9 }, 20.5),
      X('punch'), X('punchMiss'), X('hit'), X('batCrack'), X('ballSmack'), X('pingpongHit'), X('pingpongBounce'), X('paddleHit'), X('ballBounce'), X('catchSoft'), X('zap'), X('ghostWhoosh', { len: 1.2 }, 26)] },
  c7: { mood: 'wonder', ambience: 'ocean',
    music: { arc: [[0, 12, 0.3], [12, 31, 0.5], [31, 34, 0.65], [34, 43, 1.0], [43, 50.35, 0.5]], risers: [[30.5, 33.9]], silence: [[33.4, 33.95]] },
    list: [X('waves', { len: 8 }), X('seagull'), X('waterRush', { len: 5 }, 34.0), X('landRise', { len: 5 }, 34.2), X('bubbles', { len: 3 }), X('stingWonder', {}, 34.1), X('swell', { len: 4 }, 29), X('reverseSwell', { len: 3 }, 26), X('eyeFlash'), X('flashHit'), X('cutHit'),
      X('pullOut'), X('echoPop', { n: 4 }), X('ghostAppear'), X('rumble', { len: 4 }), X('windGust'), X('shimmer'), X('bellRing'), X('crowdOoh'), X('timerBeep', { n: 3 }), X('rewind', { len: 2 })] },
  c8: { mood: 'warm', ambience: 'city',
    music: { arc: [[0, 6, 0.3], [6, 20, 0.55], [20, 29.218, 0.35]], risers: [], silence: [] },
    list: [X('coinDrop'), X('cashRegister'), X('moneyCount'), X('chipStack'), X('rouletteSpin'), X('rouletteBall'), X('crowdCheer'), X('crowdOoh'), X('bellRing'), X('uiConfirm'), X('footstepConcrete'), X('birdsong', { len: 4 }), X('clap'), X('laughTrack'),
      X('sting', {}, 22.0), X('eyeOpen'), X('tick', { n: 2 }), X('uiBlip')] },
};

// coverage: any type not placed anywhere gets appended to c7 (spread out, flagged in the file)
const ALL = 'step stepRun footstepsRun whoosh whooshFast swish jump land slide skid bikePass vehiclePass truckPass carHorn truckHorn skateboardRoll skateboardSlam thump hit punch punchMiss bigImpact boom cutHit flashHit titleImpact crack glassBreak ceramicBreak catchSoft clink ceramicClatter pingpongHit pingpongBounce paddleHit bellRing batCrack ballSmack rouletteSpin rouletteBall chipStack coinDrop cashRegister moneyCount keyboardTyping tickerBlips uiBlip uiConfirm uiError phoneTap phoneBuzz alarmClock doorOpen doorSlam knock paperRustle partyPopper clap laughTrack cork eyeOpen eyeFlash pullOut tick ghostWhoosh echoPop timerStart timerBeep glitch rewind reverseSwell heartbeat riserShort staticBurst vhsTear sonar clockTick clockStop rumble quakeCrack debrisFall buildingCreak siren sirenDistant crowdPanic glassRain dust explosionFar gasp sting stingWonder stingDark swell dropOut silenceHit birdsong wind rain crowdGasp crowdCheer clothRustle clothFlap airPuff exhale inhale paperFlutter crowdMurmur crowdOoh tirePass doorCreak doorClick footstepGravel footstepWood footstepGrass footstepConcrete ballThud ballBounce objectThud glassTink ceramicTap shimmer ghostAppear ghostFade subWhoosh grab bodyBump sunriseSwell heatShimmer cicadas crickets windHowl windGust frostCrackle shiver powerDown generatorHum thunderFar rainDrops waves seagull waterRush landRise bubbles globeSpin dialTick clockWhirr pop boing sweatDrip snore yawn munch fanWhir sizzle zap'.split(' ');
const used = new Set(Object.values(THEMES).flatMap((th) => th.list.map((x) => x.type)));
const left = ALL.filter((t) => !used.has(t));
THEMES.c7.list.push(...left.map((t) => X(t)));

let total = 0;
for (const id of Object.keys(THEMES)) {
  const th = THEMES[id], dur = durOf(id), fixed = th.list.filter((x) => x.t !== undefined), free = th.list.filter((x) => x.t === undefined && !x.noT);
  const cues = [];
  const lo = 0.8, hi = dur - 1.8, step = (hi - lo) / Math.max(1, free.length);
  let seed = id.charCodeAt(1) * 7919;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  free.forEach((x, i) => {
    let t = lo + step * (i + 0.15 + 0.7 * rnd());
    // keep free cues out of the intentional silences and risers, and away from fixed cues
    for (let tries = 0; tries < 6; tries++) {
      const bad = (th.music.silence || []).some(([a, b]) => t > a - 0.3 && t < b + 0.2) || fixed.some((f) => Math.abs(f.t - t) < 0.5);
      if (!bad) break; t += 0.7;
    }
    cues.push({ t: +Math.min(t, dur - 0.5).toFixed(2), type: x.type, ...x.p });
  });
  for (const x of fixed) cues.push({ t: x.t, type: x.type, ...x.p });
  if (th.list.some((x) => x.noT)) cues.push({ type: 'step' }); // cue without t: must be skipped
  cues.sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9));
  const o = { mood: th.mood, ambience: th.ambience, music: th.music, cues };
  fs.writeFileSync(path.join(OUT, id + '.cues.json'), JSON.stringify(o, null, 1));
  total += cues.length;
  console.log(id, 'dur', dur, 'cues', cues.length, 'mood', th.mood, 'amb', th.ambience);
}
console.log('types appended to c7 for coverage:', left.join(' ') || 'none', '| total cues', total);
