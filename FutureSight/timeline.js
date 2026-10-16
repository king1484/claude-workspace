// timeline.js — single source of truth for picture AND sound (seconds, absolute).
// Loaded by index.html (global TL) and by Node (require / vm).
const TL = {
  W: 1920, H: 1080, FPS: 30, DUR: 10.8,

  // ---- scene 1: street at dusk, bike near-miss (0 – 3.5)
  s1: [0, 3.5],
  hop1: 1.02,          // character steps back onto the sidewalk (before the bike is on screen)
  bikeT0: 1.05,        // bike leaves x = bikeX0
  bikeX0: -1500,
  bikeSpeed: 2800,     // px/s along +x
  bikePass: 1.586,     // bike crosses the character's x  (= bikeT0 + 1500/2800)

  // ---- scene 2: vision, 10-second countdown (3.5 – 7.2)
  s2: [3.5, 7.2],
  eyeOpen: 3.72, eyeFlash: 3.85, pullStart: 4.05,
  timerStart: 4.55, timerEnd: 6.9,   // ring counts 10.0 -> 0.0 (a time-lapse, ~0.235 s per second)
  ghostPed: [4.78, 5.6],             // ghost pedestrian walks past (sidewalk)
  ghostCar: [5.45, 6.25],            // ghost car passes (far lane)
  ghostBike: [6.25, 6.9],            // ghost bike accelerates into the character, arrives at timerEnd
  hop2: 6.95,                        // reality catches up: character steps back

  // ---- scene 3: pull back + title (7.2 – 10.8)
  s3: [7.2, 10.8],
  echoes: [7.62, 7.78, 7.94, 8.10],  // four cyan future-echoes of the character pop in
  titleHit: 9.2,                     // "10 SECONDS" slam
  end: 10.8,

  // ---- audio cues (consumed by sfx.mjs). type -> what to synthesize
  cues: [
    { t: 0.30, type: 'phoneTap' }, { t: 0.72, type: 'phoneTap' },
    { t: 1.10, type: 'step' }, { t: 1.22, type: 'step' },
    { t: 1.20, type: 'bikePass', peak: 1.586, len: 0.9 },   // doppler whoosh, loudest at peak
    { t: 1.62, type: 'thump', gain: 0.35 },                  // wind-buffet as it passes
    { t: 3.50, type: 'cutHit' },                             // hard cut to macro
    { t: 3.72, type: 'eyeOpen' },
    { t: 3.85, type: 'eyeFlash' },                           // shimmer + sub boom + riser start
    { t: 4.05, type: 'pullOut' },                            // whoosh as camera pulls out
    // 10 timer ticks, pitch rising, evenly from timerStart to timerEnd
    ...Array.from({ length: 10 }, (_, i) => ({ t: 4.55 + (6.9 - 4.55) * (i / 10), type: 'tick', n: i })),
    { t: 5.45, type: 'ghostWhoosh', len: 0.8, gain: 0.5 },   // ghost car
    { t: 6.25, type: 'ghostWhoosh', len: 0.65, gain: 0.8 },  // ghost bike
    { t: 6.90, type: 'flashHit' },                           // white flash: impact + glitch
    { t: 6.98, type: 'step' }, { t: 7.10, type: 'step' },
    { t: 7.20, type: 'pullOut', gain: 1.0 },                 // scene-3 pull back
    { t: 7.62, type: 'echoPop', n: 0 }, { t: 7.78, type: 'echoPop', n: 1 },
    { t: 7.94, type: 'echoPop', n: 2 }, { t: 8.10, type: 'echoPop', n: 3 },
    { t: 9.20, type: 'titleImpact' },                        // big boom
  ],
  // music map: bed in A minor ~96 BPM across the whole piece
  music: {
    bpm: 96, key: 'Am',
    // [from, to, intensity 0..1]
    arc: [[0, 3.5, 0.25], [3.5, 4.55, 0.45], [4.55, 6.9, 0.75], [6.9, 7.2, 0.2], [7.2, 9.2, 0.6], [9.2, 10.8, 0.9]],
    risers: [[3.85, 4.5], [6.0, 6.9], [8.3, 9.2]],
    fadeOutStart: 10.2,
  },
};
if (typeof module !== 'undefined') module.exports = TL;
