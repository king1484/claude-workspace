// shots_c.js — shots 20-30: the turn (carry the phone across the room, the coin lands), colour, the replay with a bottom, the street, the cards.
const DAWN_AMB = [26, 28, 34, 0.34], WIN_GREY = { x: 1600, y: 420, r: 1200, rgb: [150, 156, 170], a: 0.24, open: 0.8 };
const winWarm = (t) => { const k = clamp(story(t).sky - 1); return { x: 1600, y: 430, r: 1300, rgb: [255, 196, 120], a: 0.1 + 0.28 * k, open: 0.7 + 0.25 * k }; };
const dawnAmb = (t) => { const k = clamp(story(t).sky - 1); return [lerp(26, 18, k), lerp(28, 14, k), lerp(34, 12, k), lerp(0.34, 0.14, k)]; };
const WALKER = (ph, extra) => Object.assign(CH.walkPose(ph, true), { bags: 1 }, extra || {});
const PLUG = mk({ torso: 0.22, hrot: 0.18, hfx: 50, hfy: -72, hbx: 78, hby: 42, looky: 0.7, bags: 1 });
const cable = (g, a, b, sag) => { g.save(); g.strokeStyle = '#d7d6dd'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo((a.x + b.x) / 2, Math.max(a.y, b.y) + sag, b.x, b.y); g.stroke(); g.restore(); };

// ================================================================== SHOT 20 (2:10-2:20) he gets up, takes the dead phone and the charger, and crosses the room
shot(130, 140, 'S20', (g, lt, t, E) => {
  const x0 = 900, x1 = 2058, wk = clamp((lt - 1.7) / 7.4), x = lerp(x0, x1, smooth(wk)), ph = (x - x0) / 84 * Math.PI;
  const SIT = mk(Object.assign({}, P.sitFloor, { bags: 1, hrot: -0.05, hy: -56, looky: -0.6, lookx: 0.9 }));
  let pose;
  if (lt < 1.7) pose = CH.blend(SIT, WALKER(0), smooth(lt / 1.5));
  else pose = CH.blend(WALKER(ph), PLUG, smooth((lt - 8.9) / 0.8));
  const cam = sway({ x: lerp(1040, x + 180, smooth(clamp(lt / 2.2))), y: 700, z: 1.02 }, t, 0.4), S = story(t);
  stage(g, E, t, {
    cam, ambient: DAWN_AMB, lights: [WIN_GREY], charLights: [{ x: 1500, y: 400, r: 1400, rgb: [150, 156, 170], a: 0.16 }],
    chars: [hero({ x, y: 748 }, pose, t, {})],
    post: (g2, J) => { phoneSide(g2, J.me.handF.x + 6, J.me.handF.y - 12, -0.12, 0); cable(g2, J.me.handB, { x: J.me.handF.x, y: J.me.handF.y + 6 }, 60 + 20 * Math.sin(ph)); }
  });
});

// ================================================================== SHOT 21 (2:20-2:28) the phone goes face-down on the shelf. The coin finally lands. The floor closes. A note.
shot(140, 148, 'S21', (g, lt, t, E) => {
  const RS = mk({ torso: 0.06, hfx: 86, hfy: -98, hbx: 20, hby: -26, looky: -0.3, bags: 1 }), NP = mk({ torso: 0.1, hfx: 60, hfy: -166, hbx: 10, hby: -30, looky: -0.4, bags: 1 }), WIDE = mk({ torso: 0, hfx: 10, hfy: -24, hbx: -6, hby: -28, open: 1, lookx: 0.9, bags: 0.8 });
  const pose = CH.track(lt, [[0, PLUG], [0.5, RS, 0.5], [1.5, RS, 0.2], [2.0, WIDE, 0.3], [3.7, RS, 0.4], [3.9, NP, 0.6], [5.5, WIDE, 0.6]]);
  pose.bags = 1;
  const flip = (lt >= 2.0 && lt < 3.7) ? -1 : 1, u = clamp((lt - 2.0) / 1.0), S = story(t);
  const cam = sway(camAt(lt, [[0, { x: 1480, y: 760, z: 1.0 }], [8, { x: 1580, y: 735, z: 1.14 }]]), t, 0.4);
  stage(g, E, t, {
    cam, ambient: DAWN_AMB, charLights: [{ x: 1500, y: 400, r: 1400, rgb: [150, 156, 170], a: 0.16 }],
    lights: [WIN_GREY, { x: 820, y: 975, r: 520, rgb: lt > 2 ? [255, 214, 140] : BLUE, a: lt > 2 ? 0.5 * (1 - u) : 0.2 * (1 - S.planks), open: 0.8 * (1 - 0.6 * S.planks) }],
    chars: [hero({ x: 2090, y: 748 }, pose, t, { flip })],
    post: (g2, J) => {
      if (lt < 1.05) { phoneSide(g2, J.me.handF.x + 6, J.me.handF.y - 12, -0.12, 0); cable(g2, J.me.handB, { x: J.me.handF.x, y: J.me.handF.y + 6 }, 40); }
      if (u > 0 && u < 1) { const e = easeOut(u); g2.strokeStyle = `rgba(255,226,170,${0.9 * (1 - u)})`; g2.lineWidth = 6 * (1 - u) + 1; g2.beginPath(); g2.ellipse(820, 978, 60 + 330 * e, 12 + 62 * e, 0, 0, TAU); g2.stroke(); glow(g2, 820, 978, 160, [255, 226, 170], 0.7 * (1 - u), 'screen'); }
    }
  });
});

// ================================================================== SHOT 22 (2:28-2:36) the shadow wakes and stands up beside him; he opens the curtain; amber light comes in
shot(148, 156, 'S22', (g, lt, t, E) => {
  const CURT = mk({ torso: 0.04, hfx: 56, hfy: -98, hbx: 6, hby: -30, looky: -0.1, bags: 0.7 });
  const hx = lerp(2090, 1850, smooth(clamp(lt / 2.6))), ph = (2090 - hx) / 84 * Math.PI;
  const pose = lt < 2.6 ? Object.assign(CH.walkPose(ph, false), { bags: 1 }) : CH.track(lt - 2.6, [[0, Object.assign(CH.walkPose(ph, false), { bags: 1 })], [0.5, CURT, 0.6], [3.2, Object.assign({}, CURT, { open: 0.55, happy: 0 }), 1.2]]);
  const sw = clamp((lt - 3.2) / 3.2), sxp = lerp(700, 1760, smooth(sw)), sph = (sxp - 700) / 84 * Math.PI;
  const shPose = lt < 1.4 ? LAY : lt < 3.2 ? CH.blend(LAY, mk(P.stretch), smooth((lt - 1.4) / 1.8)) : lt < 6.4 ? CH.blend(mk(P.stretch), CH.walkPose(sph, false, 56), smooth((lt - 3.2) / 0.6)) : CH.blend(CH.walkPose(sph, false, 56), STAND, smooth((lt - 6.4) / 0.5));
  const shY = lt < 1.4 ? 690 : lerp(690, 596, smooth((lt - 1.4) / 1.6)), shx = lt < 3.2 ? 700 : (lt < 6.4 ? sxp : 1760);
  const cam = sway(camAt(lt, [[0, { x: 1250, y: 680, z: 0.82 }], [4, { x: 1500, y: 660, z: 0.9 }], [8, { x: 1720, y: 650, z: 1.05 }]]), t, 0.4);
  stage(g, E, t, {
    cam, ambient: dawnAmb(t), lights: [winWarm(t)], charLights: [{ x: 1600, y: 430, r: 1300, rgb: [255, 196, 120], a: 0.3 * clamp(story(t).sky - 1) }, { x: 1500, y: 400, r: 1400, rgb: [150, 156, 170], a: 0.12 }],
    wallFx: shadowSpec(shx, shY, shPose, 1.5, lt >= 3.2 ? 1 : 1, 0.5, 0.5),
    chars: [hero({ x: hx, y: 748 }, pose, t, { flip: -1 })]
  });
});

// ================================================================== SHOT 23 (2:36-2:50) he sits and continues the line; the page; his hoodie turns red from the hem up
const SITDESK = mk(Object.assign({}, P.sitDesk));
const deskHero = (lt, t) => {
  const hx = lerp(1850, 1640, smooth(clamp(lt / 1.3))), ph = (1850 - hx) / 84 * Math.PI;
  const walk = Object.assign(CH.walkPose(ph, false), { bags: 0.7 });
  const draw = Object.assign({}, SITDESK, { hfx: SITDESK.hfx + Math.sin(lt * 9) * 7, hfy: SITDESK.hfy + Math.cos(lt * 7) * 3, bags: 0.4, open: 0.9 });
  if (lt < 1.3) return { x: hx, y: 748, flip: -1, pose: walk };
  const k = smooth((lt - 1.3) / 0.7);
  return { x: 1640, y: lerp(748, 778, k), flip: lt < 1.4 ? -1 : 1, pose: CH.blend(walk, draw, k) };
};
shot(156, 159, 'S23a', (g, lt, t, E) => {
  const d = deskHero(lt, t), S = story(t);
  stage(g, E, t, { cam: sway({ x: 1700, y: 690, z: 1.35 }, t, 0.4), ambient: dawnAmb(t), lights: [winWarm(t), { x: 1664, y: 620, r: 500, rgb: WARM, a: 0.1, open: 0.4 }], charLights: [{ x: 1600, y: 430, r: 1300, rgb: [255, 196, 120], a: 0.34 }], chars: [hero({ x: d.x, y: d.y }, d.pose, t, { flip: d.flip })] });
});
shot(159, 164, 'S23b', (g, lt, t, E) => {
  const P_ = lerp(0.1, 0.62, smooth(lt / 5));
  PAGE.draw(g, E, t, P_, { lamp: 0.75, zoom: 1.1 + 0.02 * lt, dx: -40, ring: true, hand: true, jitter: true, sleeve: GREY });
});
shot(164, 170, 'S23c', (g, lt, t, E) => {
  const pose = Object.assign({}, SITDESK, { hfx: SITDESK.hfx + Math.sin(lt * 8) * 6, hfy: SITDESK.hfy + Math.cos(lt * 6) * 3, bags: 0.2, happy: lt > 3.2 && lt < 5 ? 0.0 : 0 });
  stage(g, E, t, { cam: sway({ x: 1680, y: 700, z: 1.6 }, t, 0.4), ambient: dawnAmb(t), lights: [winWarm(t)], charLights: [{ x: 1600, y: 430, r: 1300, rgb: [255, 196, 120], a: 0.36 }], chars: [hero({ x: 1640, y: 778 }, pose, t, { flip: 1 })] });
});

// ================================================================== SHOT 24 (2:50-2:56) "Tomorrow night": the same bed, warm lamp, a red hoodie, and the shaft now has a floor with a line on it
shot(170, 176, 'S24', (g, lt, t, E) => {
  if (lt < 2.6) { g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080); TXT.title(g, 'Tomorrow night', lt, 0.3, 1.75, { size: 84, glow: true, y: 520 }); TXT.label(g, '11:25 PM', lt, 1.0, 2.0, { y: 630, size: 28 }); drawGrain(g, 1920, 1080, t, 0.08); return; }
  const l2 = lt - 2.6, pose = CH.track(l2, [[0, SITIDLE], [1.5, SITPHONE, 0.7]]), S = story(t), PH = { x: 836, y: 694 }, pa = smooth((l2 - 1.8) / 0.5);
  stage(g, E, t, {
    cam: sway(camAt(l2, [[0, { x: 1000, y: 720, z: 1.0 }], [3.4, { x: 940, y: 740, z: 1.22 }]]), t, 0.4), ambient: [8, 9, 15, 0.52], S: { holeLine: 1 },
    chars: [hero(SIT_HIP, pose, t)], charLights: [{ x: 1650, y: 640, r: 1100, rgb: WARM, a: 0.3 }, { x: PH.x, y: PH.y, r: 260, rgb: BLUE, a: 0.4 * pa }],
    lights: [{ x: 1664, y: 620, r: 700, rgb: WARM, a: 0.22, open: 0.95 }, { x: PH.x, y: PH.y, r: 360, rgb: BLUE, a: 0.14 * pa, open: 0.5 * pa }, { x: 820, y: 975, r: 380, rgb: [255, 226, 170], a: 0.12, open: 0.5 }],
    post: (g2, J) => { if (pa > 0) phoneSide(g2, J.me.handF.x + 6, J.me.handF.y - 12, -0.12, pa * 0.8); }
  });
});

// ================================================================== SHOT 25 (2:56-3:08) three swipes, each smaller; at 11:30 a soft bell and the coin lands on the floor; he smiles, sets the phone down
shot(176, 181.8, 'S25a', (g, lt, t, E) => {
  if (lt < 5.0) {                                     // INSERT: two swipes, then the third lands on a floor; one more try only bounces
    phoneInsert(g, E, t, lt, { warm: true, zoom: 1 + 0.02 * lt, ang: -0.04, y: 548 + Math.sin(lt * 1.1) * 4,
      phone: { swipes: [{ t: 176.8 }, { t: 178.2 }, { t: 179.6, d: 0.3 }, { t: 180.6, bounce: true, d: 0.22 }], floorAt: 3, likes: [176.9, 178.3], seed: 3 } });
    return;
  }
  const l2 = lt - 5.0, pose = Object.assign({}, SITPHONE, { happy: smooth(l2 / 0.3), looky: 0.5, bags: 0 }), PH = { x: 836, y: 694 };
  stage(g, E, t, {
    cam: sway({ x: 812, y: 690, z: 2.9 }, t, 0.6), ambient: [8, 9, 15, 0.74], vig: 0.6,
    chars: [hero(SIT_HIP, pose, t)], charLights: [{ x: 1650, y: 640, r: 1100, rgb: WARM, a: 0.12 }, { x: PH.x, y: PH.y, r: 300, rgb: [255, 214, 150], a: 0.18 }],
    lights: [{ x: PH.x, y: PH.y, r: 520, rgb: [255, 214, 150], a: 0.16, open: 0.9 }, { x: 1664, y: 620, r: 900, rgb: WARM, a: 0.15, open: 0.6 }],
    post: (g2, J) => phoneSide(g2, J.me.handF.x, J.me.handF.y, -0.12, 0.6, { start: 2, swipes: [{ t: 0 }], floorAt: 3 })
  });
});
shot(181.8, 183, 'S25b', (g, lt, t, E) => {                   // 11:30: the bell, the coin lands on the floor
  const u = clamp(lt / 1.0);
  stage(g, E, t, { cam: { x: 840, y: 840, z: 1.05 }, ambient: [8, 9, 15, 0.58], S: { holeLine: 1 }, lights: [{ x: 820, y: 978, r: 520, rgb: [255, 214, 150], a: 0.3 * (1 - u * 0.5), open: 0.8 }, { x: 1664, y: 620, r: 900, rgb: WARM, a: 0.12, open: 0.5 }],
    post: (g2) => { const e = easeOut(u); g2.strokeStyle = `rgba(255,226,170,${0.8 * (1 - u)})`; g2.lineWidth = 5; g2.beginPath(); g2.ellipse(820, 978, 40 + 260 * e, 8 + 50 * e, 0, 0, TAU); g2.stroke();
      const cy = lerp(700, 976, easeIn(clamp(lt / 0.5))); if (lt < 0.5) { g2.fillStyle = '#d8b46a'; g2.beginPath(); g2.ellipse(820, cy, 12, 12 * Math.abs(Math.cos(lt * 24)) + 2, 0, 0, TAU); g2.fill(); } },
    chars: [hero(SIT_HIP, Object.assign({}, SITPHONE, { happy: 1, bags: 0 }), t)], charLights: [{ x: 1650, y: 640, r: 1100, rgb: WARM, a: 0.3 }] });
});
shot(183, 185, 'S25c', (g, lt, t, E) => {
  const up = smooth(clamp(lt / 0.8)), x = lerp(SIT_HIP.x, SIT_HIP.x + 160, smooth(clamp((lt - 0.7) / 1.3))), ph = (x - SIT_HIP.x) / 84 * Math.PI;
  const pose = lt < 0.8 ? CH.blend(SITPHONE, mk(P.standPhone), up) : Object.assign(CH.walkPose(ph, true), { bags: 0 });
  const hip = lerp(SIT_HIP.y, 748, up);
  stage(g, E, t, { cam: sway({ x: 900 + 100 * lt, y: 700, z: 1.2 }, t, 0.4), ambient: [8, 9, 15, 0.52], S: { holeLine: 1 }, chars: [hero({ x, y: hip }, pose, t)], charLights: [{ x: 1650, y: 640, r: 1100, rgb: WARM, a: 0.3 }], lights: [{ x: 1664, y: 620, r: 900, rgb: WARM, a: 0.18, open: 0.9 }],
    post: (g2, J) => phoneSide(g2, J.me.handF.x + 6, J.me.handF.y - 12, -0.12, 0.35) });
});
shot(185, 188, 'S25d', (g, lt, t, E) => {
  const RS = mk({ torso: 0.06, hfx: 86, hfy: -98, hbx: 20, hby: -26, looky: -0.3 }), pose = CH.track(lt, [[0, mk(P.standPhone)], [0.6, RS, 0.6], [2.0, mk(Object.assign({}, P.stand, { open: 1, happy: 0.0 })), 0.7]]);
  stage(g, E, t, { cam: sway({ x: 1900, y: 700, z: 1.3 }, t, 0.4), ambient: [8, 9, 15, 0.52], chars: [hero({ x: 2090, y: 748 }, pose, t)], charLights: [{ x: 1650, y: 640, r: 1100, rgb: WARM, a: 0.3 }], lights: [{ x: 1664, y: 620, r: 900, rgb: WARM, a: 0.18, open: 0.9 }],
    post: (g2, J) => { if (lt < 1.2) phoneSide(g2, J.me.handF.x + 6, J.me.handF.y - 12, -0.12, 0.35); } });
});

// ================================================================== SHOT 26 (3:08-3:18) the desk: the shadow sits beside him; the drawing becomes a sunrise with a small red figure
const deskLights = (t) => ({ ambient: [8, 9, 15, 0.5], lights: [{ x: 1664, y: 620, r: 760, rgb: WARM, a: 0.24, open: 0.95 }], charLights: [{ x: 1650, y: 640, r: 1100, rgb: WARM, a: 0.3 }] });
shot(188, 191.5, 'S26a', (g, lt, t, E) => {
  const pose = Object.assign({}, SITDESK, { hfx: SITDESK.hfx + Math.sin(lt * 8) * 6, hfy: SITDESK.hfy + Math.cos(lt * 6) * 3, bags: 0 });
  stage(g, E, t, Object.assign({ cam: sway({ x: 1700, y: 680, z: 1.3 }, t, 0.4), wallFx: shadowSpec(1830, 560, pose, 1.35, 1, 0.55, 0.5), chars: [hero({ x: 1640, y: 778 }, pose, t)] }, deskLights(t)));
});
shot(191.5, 195.5, 'S26b', (g, lt, t, E) => {
  const P_ = lerp(0.6, 1.0, smooth(lt / 3.3)), off = easeIn(clamp((lt - 3.3) / 0.7));
  PAGE.draw(g, E, t, P_, { lamp: 1, zoom: 1.08 - 0.03 * smooth(lt / 4), ring: true, hand: true, jitter: true, sleeve: RED, handRest: { x: 190 + 700 * off, y: 120 + 420 * off } });
});
shot(195.5, 198, 'S26c', (g, lt, t, E) => {
  const pose = CH.track(lt, [[0, SITDESK], [0.6, mk(Object.assign({}, SITDESK, { torso: -0.04, hrot: 0, hy: -54, hfx: 70, hfy: -34, happy: 1 })), 0.8]]);
  stage(g, E, t, Object.assign({ cam: sway({ x: 1700, y: 680, z: 1.4 }, t, 0.4), wallFx: shadowSpec(1830, 560, pose, 1.35, 1, 0.55, 0.5), chars: [hero({ x: 1640, y: 778 }, pose, t)] }, deskLights(t)));
});

// ================================================================== SHOT 27 (3:18-3:25) the lamp clicks off; he lies down; the shadow lies down with him, aligned
shot(198, 201.5, 'S27a', (g, lt, t, E) => {
  const pose = CH.track(lt, [[0, mk(Object.assign({}, SITDESK, { happy: 1 }))], [0.7, mk(P.stretch), 0.8], [2.4, mk(Object.assign({}, P.stretch, { hfy: -150, hfx: 10 })), 0.5]]);
  const S = story(t);
  stage(g, E, t, { cam: sway({ x: 1700, y: 680, z: 1.3 }, t, 0.4), ambient: [8, 9, 15, 0.52 + 0.3 * (1 - S.lamp)], wallFx: shadowSpec(1830, 560, pose, 1.35, 1, 0.55, 0.5), chars: [hero({ x: 1640, y: lt > 0.7 ? 748 : 778 }, pose, t)],
    charLights: [{ x: 1650, y: 640, r: 1100, rgb: WARM, a: 0.3 * S.lamp }], lights: [{ x: 1664, y: 620, r: 760, rgb: WARM, a: 0.24 * S.lamp, open: 0.95 * S.lamp }] });
});
shot(201.5, 205, 'S27b', (g, lt, t, E) => {
  const fade = 1 - clamp((lt - 2.6) / 0.9), pose = Object.assign({}, P.lieSleep), sh = Object.assign({}, P.lieSleep);
  stage(g, E, t, { cam: sway(camAt(lt, [[0, { x: 560, y: 700, z: 1.5 }], [3.5, { x: 600, y: 690, z: 1.4 }]]), t, 0.3), ambient: [6, 8, 14, 0.78], vig: 0.6,
    wallFx: shadowSpec(431, 548, sh, 1.0, 1, 0.0, 0.6), chars: [hero(LIE_HIP, pose, t)], charLights: [{ x: 1600, y: 380, r: 1500, rgb: [120, 150, 220], a: 0.2 }],
    lights: [{ x: 1000, y: 560, r: 1500, rgb: [120, 150, 220], a: 0.08, open: 0.5 }] });
  if (fade < 1) { g.fillStyle = `rgba(0,0,0,${1 - fade})`; g.fillRect(0, 0, 1920, 1080); }
});

// ================================================================== SHOT 28 (3:25-3:35) morning street: grey figures lit blue by their phones; a woman at a bus stop whose shadow is trying to reach her
function streetScene(g, E, lt, t) {
  const sky = g.createLinearGradient(0, 0, 0, 700); sky.addColorStop(0, '#8d94a4'); sky.addColorStop(0.7, '#d6c4a8'); sky.addColorStop(1, '#e6c99c'); g.fillStyle = sky; g.fillRect(0, 0, 1920, 1080);
  glow(g, 1500, 560, 900, [255, 200, 130], 0.5, 'screen');
  const r = rng(61); g.fillStyle = 'rgba(120,126,142,0.55)';
  for (let i = 0; i < 12; i++) { const bw = 120 + r() * 120, bh = 260 + r() * 260; g.fillRect(i * 170 - 20, 700 - bh, bw, bh); }
  g.fillStyle = '#6a6f7e'; for (let i = 0; i < 9; i++) { const bw = 190 + r() * 90, bh = 330 + r() * 150, bx = i * 230 - 40; g.fillRect(bx, 760 - bh, bw, bh); g.fillStyle = 'rgba(255,224,170,0.18)'; for (let wy = 0; wy < bh - 50; wy += 54) for (let wx = 14; wx < bw - 30; wx += 46) g.fillRect(bx + wx, 760 - bh + 22 + wy, 22, 28); g.fillStyle = '#6a6f7e'; }
  g.fillStyle = '#51556a'; g.fillRect(0, 760, 1920, 320); g.fillStyle = '#42465a'; g.fillRect(0, 900, 1920, 6); g.fillStyle = '#5c6075'; g.fillRect(0, 906, 1920, 174);
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; for (let x = 0; x < 1920; x += 160) { g.beginPath(); g.moveTo(x, 760); g.lineTo(x - 60, 900); g.stroke(); }
  // bus stop
  g.fillStyle = '#2b2e3a'; g.fillRect(1180, 500, 14, 400); g.fillRect(1500, 500, 14, 400); g.fillRect(1160, 486, 370, 20); g.fillStyle = 'rgba(160,190,220,0.18)'; g.fillRect(1194, 506, 306, 300); g.fillStyle = '#34384a'; g.fillRect(1220, 810, 250, 16); g.fillRect(1236, 826, 10, 74); g.fillRect(1444, 826, 10, 74);
  const walkers = [[220, 1, 0.8, 0], [700, 0, 0, 1], [1040, 0, 0, 2], [1760, -1, 0.7, 3]];
  const hoods = [[104, 108, 122], [112, 116, 128], [96, 104, 120], [108, 112, 124]];
  const phoneRig = (id, x, y, s, flip, pose) => {
    const J = CH.draw(g, { id, x, y: y - 112 * s, s, flip, pose, t, res: 1, hood: hoods[id % 4], lights: [{ x: x + flip * 60 * s, y: y - 190 * s, r: 110, rgb: BLUE, a: 0.2 }] });
    phoneSide(g, J.handF.x + flip * 6, J.handF.y - 10, -0.12 * flip, 0.7); glow(g, J.handF.x + flip * 16, J.handF.y - 24, 90, BLUE, 0.22, 'screen'); return J;
  };
  walkers.forEach(([x0, dir, spd, id]) => { const x = x0 + dir * spd * 60 * lt, ph = dir ? Math.abs(x - x0) / 84 * Math.PI : 0, pose = dir ? Object.assign(CH.walkPose(ph, true), { looky: 0.7 }) : mk(P.standPhone); phoneRig(id, x, 930, 1.0, dir < 0 ? -1 : 1, pose); });
  // the woman at the stop and her shadow, tapping its wrist and looking up at him
  const hx = lerp(-160, 2080, lt / 10), hph = (hx + 160) / 84 * Math.PI;
  const near = clamp(1 - Math.abs(hx - 1330) / 420), shPose = Object.assign({}, CH.blend(mk(P.tapWrist), mk(Object.assign({}, P.tapWrist, { looky: -1.0, lookx: 0.5, hrot: -0.2 })), smooth(near * 1.4)));
  CH.draw(g, { x: 1400, y: 700, s: 1.25, flip: -1, pose: shPose, t, res: 1, alpha: 0.5, shadow: { fill: '#14151c', blur: 2.5, eyes: 0.7 } });
  phoneRig(4, 1330, 930, 1.05, 1, mk(P.standPhone));
  // him: the red hoodie, warm light following him
  glow(g, hx + 40, 780, 380, [255, 190, 110], 0.5, 'screen');
  CH.draw(g, { id: 'me', x: hx, y: 930 - 112 * 1.15, s: 1.15, flip: 1, pose: Object.assign(CH.walkPose(hph, false, 84 / 1.15), { open: 1, looky: 0 }), t, res: 1, hood: RED, lights: [{ x: hx + 80, y: 700, r: 520, rgb: [255, 190, 110], a: 0.4 }] });
  SET.vignette(g, E, 0.42); drawGrain(g, 1920, 1080, t, 0.08);
}
shot(205, 215, 'S28', (g, lt, t, E) => streetScene(g, E, lt, t));

// ================================================================== SHOT 29-30 the lesson, the title
// the title: letters arrive one by one with wide tracking that slowly closes; a thin line draws under them and the subtitle wipes in
function titleCard(g, lt) {
  const L = 'SCROLL'.split(''), out = clamp((lt - 4.8) / 0.9), track = lerp(56, 34, easeOut(clamp(lt / 5))), size = 118;
  g.save(); g.font = `500 ${size}px ${TXT.SERIF}`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const ws = L.map(c => g.measureText(c).width), total = ws.reduce((a, b) => a + b, 0) + track * (L.length - 1); let x = 960 - total / 2;
  L.forEach((c, i) => { const k = clamp((lt - 0.4 - i * 0.12) / 0.8), e = 1 - Math.pow(1 - k, 3);
    g.globalAlpha = e * (1 - out); g.filter = k < 1 ? `blur(${((1 - e) * 8).toFixed(1)}px)` : 'none'; g.fillStyle = '#eceef5'; g.shadowColor = 'rgba(150,190,255,0.35)'; g.shadowBlur = 30;
    g.fillText(c, x, 560 - (1 - e) * 18); x += ws[i] + track; });
  g.filter = 'none'; g.shadowBlur = 0; g.globalAlpha = 1 - out;
  const lw = 420 * easeInOut(clamp((lt - 1.3) / 1.1)); g.fillStyle = 'rgba(214,58,58,0.9)'; g.fillRect(960 - lw / 2, 598, lw, 2);
  g.restore();
}
shot(215, 224, 'S29', (g, lt, t, E) => { g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080); TXT.title(g, 'The feed has no bottom.', lt, 0.4, 3.4, { size: 90, glow: true, stagger: 0.18 }); TXT.title(g, 'Build one.', lt, 4.6, 7.9, { size: 108, glow: true, stagger: 0.32, color: [240, 214, 200] }); drawGrain(g, 1920, 1080, t, 0.08); });
shot(224, 230, 'S30', (g, lt, t, E) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080);
  titleCard(g, lt);
  drawGrain(g, 1920, 1080, t, 0.08);
});
