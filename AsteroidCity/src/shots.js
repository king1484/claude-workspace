// Shot list. Each shot: { name, t0, t1, scene, camera, update(lt, t, look) } — everything is a pure function of time.
import * as THREE from 'three';
import { lightingUniforms, makeCity, makeGround, makeWater, makeSky, setCityDamage } from './city.js';
import { makeAsteroid } from './asteroid.js';
import { EntryFX, FireballFX, makeFireDome, makeShockShell, RingWallFX, EjectaFX, SmokeFX } from './fx.js';
import { Particles } from './particles.js';
import { makeStars, makeEarth, SITE, orbitLine, orbitPos, makeSpacecraft } from './space.js';
import { clamp, lerp, sstep, easeOut, easeIn, easeInOut, shake, hash1, rng } from './util.js';

export function buildShots({ W, H, LAYOUT }) {
  const L = Object.fromEntries(LAYOUT.lines.map((l) => [l.id, l]));
  // approximate time a phrase is spoken (character position within the line)
  const tAt = (id, phrase) => { const l = L[id], i = l.text.indexOf(phrase); if (i < 0) throw new Error('phrase ' + phrase); return l.start + l.dur * (i / l.text.length); };
  const cam = new THREE.PerspectiveCamera(60, W / H, 10, 900000);
  const aimAt = (c, p, up = 0, side = 0) => { c.lookAt(p); c.rotateX(up); c.rotateY(side); };
  const _h = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3(), _v = new THREE.Vector3();

  // ---------- city world ----------
  const U = lightingUniforms();
  const city = new THREE.Scene();
  const sky = makeSky(U), ground = makeGround(U), water = makeWater(U), town = makeCity(U);
  const crater = makeGround(U, { size: 70000, crater: true });
  city.add(sky, ground, crater, water, town.mesh);
  const rock = makeAsteroid(); city.add(rock);
  const entry = new EntryFX(city, { r: 500, L: 60000 });
  const fireball = new FireballFX(city, { R: 11000 });
  const dome = makeFireDome(); city.add(dome);
  const shell = makeShockShell(); city.add(shell);
  const ring = new RingWallFX(city);
  const ejecta = new EjectaFX(city);
  const smoke = new SmokeFX(city);
  const SU = sky.material.uniforms;
  const all = { rock, entry, fireball, dome, shell, ring, ejecta, smoke, crater };
  const setV = (o) => { for (const k in all) all[k].visible = !!o[k]; ground.visible = !o.crater; water.visible = !o.crater; };

  function dusk() {
    U.uSunDir.value.set(-0.8, 0.03, -0.35).normalize();
    U.uSunCol.value.setRGB(0.55, 0.25, 0.16);
    U.uSky.value.setRGB(0.06, 0.07, 0.13); U.uGround.value.setRGB(0.02, 0.018, 0.02);
    U.uFogCol.value.setRGB(0.22, 0.14, 0.17); U.uFogDen.value = 0.00005;
    SU.uZen.value.setRGB(0.008, 0.014, 0.045); SU.uHor.value.setRGB(0.45, 0.2, 0.15); SU.uMid.value.setRGB(0.09, 0.06, 0.13);
    SU.uStars.value = 0.7; SU.uRed.value = 0; SU.uGlowCol.value.setRGB(0, 0, 0);
    U.uWin.value = 1; U.uPLCol.value.setRGB(0, 0, 0);
    ground.material.uniforms.uScorch.value = 0; ground.material.uniforms.uScorchR.value = 0; ground.material.uniforms.uLights.value = 1;
    water.material.uniforms.uGlowCol.value.setRGB(0, 0, 0);
    cam.near = 10; cam.far = 900000; cam.up.set(0, 1, 0);
    ground.scale.set(1, 1, 1);
  }
  const glowAt = (p, col, pow = 10) => {               // sky + water glow toward a world point
    _v.copy(p).sub(cam.position).normalize();
    SU.uGlowDir.value.copy(_v); SU.uGlowCol.value.setRGB(...col); SU.uGlowPow.value = pow;
    water.material.uniforms.uGlowDir.value.copy(_v); water.material.uniforms.uGlowCol.value.setRGB(col[0] * 0.8, col[1] * 0.8, col[2] * 0.8);
  };
  const camDone = () => { cam.updateProjectionMatrix(); cam.updateMatrixWorld(); };
  const heatRock = (dir, heat, t) => {
    rock.material.uniforms.uFront.value.copy(dir); rock.material.uniforms.uHeat.value = heat; rock.material.uniforms.uTime.value = t;
    rock.material.uniforms.uSun.value.copy(U.uSunDir.value);
  };

  const shots = [];
  const shot = (name, t0, t1, scene, update) => shots.push({ name, t0, t1, scene, camera: cam, update });

  // ---------- key times ----------
  const T1 = L.v1.end + 0.2;                       // hook -> space
  const T2 = L.v3.start - 0.05;                    // space -> entry
  const T3 = L.v3.start + 2.25;                    // entry -> plunge
  const TI = L.v3.end + 0.25;                      // IMPACT (white flash)
  const T5 = L.v4.start + 1.1;                     // dome -> mushroom
  const T6 = L.v5.start - 0.05;                    // -> engulf
  const T7 = L.v6.start - 0.05;                    // -> shock (aerial)
  const T8 = L.v6.start + 1.55;                    // -> hit (ground)
  const T9 = L.v7.start - 0.05;                    // -> crater
  const T10 = L.v8.start - 0.05;                   // -> ejecta
  const T11 = L.v9.start - 0.05;                   // -> globe
  const T12 = L.v10.start - 0.3;                   // -> orbits
  const T13 = L.v11.start - 0.1;                   // -> dart
  const T14 = L.v12.start - 0.15;                  // -> loop
  const TEND = LAYOUT.total;
  const age = (t) => Math.max(0, t - TI);          // seconds since impact
  // blast scale (metres) as a function of time since impact (cinematic, monotonic)
  const shockR = (a) => 1500 + 14500 * (1 - Math.exp(-a / 7)) + a * 250;
  const vaporR = (a) => (a < 1.4 ? 0 : Math.min(7500, 7500 * (1 - Math.exp(-(a - 1.4) * 1.1))));

  // ===== S1 HOOK + S13 LOOP: boulevard, the burning rock fills the sky =====
  const HOOK_DIR = new THREE.Vector3(0.66, -0.6, 0.3).normalize();
  const H0 = new THREE.Vector3(-2300, 5200, -3600);
  function boulevard(lt, t, look, back, heat, shakeK) {
    dusk(); setV({ rock: true, entry: true }); setCityDamage(town, null);
    _h.copy(H0).addScaledVector(HOOK_DIR, lt * 380 - back);
    const sh = shake(t, (0.5 + Math.max(lt, 0) * 1.1) * shakeK, 7);
    cam.fov = 66; cam.position.set(440 + sh[0], 20 + lt * 4 + sh[1], 2380 - lt * 14);
    aimAt(cam, H0.clone().addScaledVector(HOOK_DIR, lt * 380), -0.2 + lt * 0.02, -0.06);
    cam.rotateZ(-0.07 + 0.02 * Math.sin(lt * 0.7) + sh[2] * 0.003);
    cam.rotateX(sh[1] * 0.0015); cam.rotateY(sh[0] * 0.0015);
    camDone();
    U.uTime.value = t;
    rock.position.copy(_h); rock.scale.setScalar(500); rock.rotation.set(lt * 0.25, lt * 0.4, 0.3);
    heatRock(HOOK_DIR, 0.7 * heat, t);
    entry.update(cam, _h, HOOK_DIR, t, { heat, smokeCol: [0.16, 0.1, 0.09], smokeAlpha: 0.7, glowK: 0.8 });
    const I = (0.55 + Math.max(lt, 0) * 0.1 + 0.06 * Math.sin(t * 31)) * heat;
    U.uPLPos.value.copy(_h); U.uPLCol.value.setRGB(2.2 * I, 1.1 * I, 0.45 * I); U.uPLRange.value = 26000;
    glowAt(_h, [0.9 * heat, 0.35 * heat, 0.1 * heat], 14);
    look.bloom = 0.7; look.bloomT = 0.9; look.bloomR = 0.5; look.exposure = 1.0;
  }
  shot('hook', 0, T1, city, (lt, t, look) => boulevard(lt, t, look, 0, 1, 1));

  // ===== S2 SPACE: tumbling rock, Earth below (units: km) =====
  const space = new THREE.Scene();
  const stars = makeStars(); space.add(stars);
  const earth = makeEarth(6371); space.add(earth);
  const srock = makeAsteroid(); space.add(srock);
  // the sun sits so the impact site is just on the evening side of the terminator
  const sunS = new THREE.Vector3().crossVectors(SITE, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(0.96).addScaledVector(SITE, -0.02).normalize();
  const dustS = new Particles({ max: 300, blending: 'add', streak: true }); space.add(dustS.mesh);
  const sunSprite = new Particles({ max: 4, blending: 'add', noise: 0, edge: 0 }); space.add(sunSprite.mesh);
  const EU = earth.userData.mat.uniforms;
  const SPACE_DIR = new THREE.Vector3().copy(SITE).negate().multiplyScalar(0.75).add(new THREE.Vector3().crossVectors(SITE, new THREE.Vector3(1, 0, 0)).normalize().multiplyScalar(0.66)).normalize();
  const SP_SUN = new THREE.Vector3(-0.85, 0.25, -0.45).normalize();
  const SP_DIR = new THREE.Vector3(0.12, -0.36, -0.92).normalize();
  shot('space', T1, T2, space, (lt, t, look) => {
    earth.visible = true; srock.visible = true; stars.visible = true; dustS.mesh.visible = true; sunSprite.mesh.visible = true;
    earth.position.set(0, 0, 0); earth.rotation.set(0.95, 2.1 + t * 0.01, 0);
    if (location.search.includes('noatm')) earth.userData.atm.visible = false;
    EU.uSunK.value = 0.75; EU.uCloud.value = 0.35; EU.uSun.value.copy(SP_SUN); EU.uDust.value = 0; EU.uLights.value = 1; EU.uScorch.value = 0; EU.uTime.value = t;
    const A = _h.set(0, 7450, 4900).addScaledVector(SP_DIR, lt * 20);
    srock.position.copy(A); srock.scale.setScalar(0.5); srock.rotation.set(t * 0.5, t * 0.8, 0.2);
    const RU = srock.material.uniforms;
    RU.uSun.value.copy(SP_SUN); RU.uSunCol.value.setRGB(2.6, 2.45, 2.3); RU.uHeat.value = 0; RU.uAmb.value.setRGB(0.015, 0.02, 0.035); RU.uRim.value.setRGB(0.08, 0.14, 0.3);
    const pull = 2.0 + lt * 1.7;                                   // the rock pulls away: speed
    cam.near = 0.05; cam.far = 4e6; cam.fov = 55; cam.up.set(0, 1, 0);
    cam.position.copy(A).addScaledVector(SP_DIR, -pull).add(new THREE.Vector3(0.7, 0.45, 0));
    aimAt(cam, A, 0.3, 0.05); cam.rotateZ(-0.12);
    camDone();
    const side = _t.set(1, 0, 0);
    dustS.begin();
    for (let i = 0; i < 300; i++) {
      const b = (hash1(i * 3.1) * 2 - 1) * 3, c = (hash1(i * 5.9) * 2 - 1) * 3, k = ((hash1(i * 7.3) + t * 2.5) % 1);
      const p = _v.copy(cam.position).addScaledVector(SP_DIR, 8 - k * 10).addScaledVector(side, b).add(new THREE.Vector3(0, c, 0));
      const I = 0.5 * Math.sin(k * Math.PI);
      dustS.add(p.x, p.y, p.z, 0.004, I, I, I * 1.1, 1, 0, i, -SP_DIR.x * 0.6, -SP_DIR.y * 0.6, -SP_DIR.z * 0.6);
    }
    dustS.end(cam);
    sunSprite.begin(); const sp = _v.copy(SP_SUN).multiplyScalar(150000).add(cam.position); sunSprite.add(sp.x, sp.y, sp.z, 9000, 2.5, 2.3, 2.0, 1, 0, 1); sunSprite.add(sp.x, sp.y, sp.z, 40000, 0.4, 0.35, 0.3, 0.6, 0, 2); sunSprite.end(cam);
    look.bloom = 0.6; look.bloomT = 0.85; look.exposure = 1.0; look.vig = 0.45;
  });

  // ===== S3 ENTRY: alongside the rock as the air ignites =====
  const ENTRY_DIR = new THREE.Vector3(0.62, -0.7, 0.35).normalize();
  shot('entry', T2, T3, city, (lt, t, look) => {
    dusk(); setV({ rock: true, entry: true }); setCityDamage(town, null);
    ground.scale.set(8, 1, 8); U.uFogDen.value = 0.000014; U.uFogCol.value.setRGB(0.12, 0.08, 0.13);
    U.uTime.value = t;
    const k = lt / (T3 - T2);
    _h.set(-26000, 16000, -14000).addScaledVector(ENTRY_DIR, lt * 2600);
    const side = _t.crossVectors(ENTRY_DIR, new THREE.Vector3(0, 1, 0)).normalize();
    const sh = shake(t, 3 + k * 10, 11);
    cam.fov = 58;
    cam.position.copy(_h).addScaledVector(ENTRY_DIR, -1500 - k * 900).addScaledVector(side, -2600).add(new THREE.Vector3(sh[0], 700 + sh[1], sh[2]));
    aimAt(cam, _h, -0.16, 0.1);
    cam.rotateZ(0.12 + sh[0] * 0.0004);
    camDone();
    rock.position.copy(_h); rock.scale.setScalar(500); rock.rotation.set(t * 0.3, t * 0.45, 0.3);
    const heat = 0.35 + 0.65 * easeIn(k * 1.1);
    heatRock(ENTRY_DIR, heat, t);
    entry.update(cam, _h, ENTRY_DIR, t * 2, { heat, smokeCol: [0.18, 0.12, 0.12], smokeAlpha: 0.55, glowK: 0.6 + k * 0.9, trailK: 0.6 });
    SU.uStars.value = 1.0;
    glowAt(_h, [1.2 * heat, 0.5 * heat, 0.15 * heat], 8);
    U.uPLPos.value.copy(_h); U.uPLCol.value.setRGB(3 * heat, 1.4 * heat, 0.5 * heat); U.uPLRange.value = 60000;
    look.bloom = 0.6 + k * 0.9; look.bloomT = 0.9 - k * 0.3; look.exposure = 1.0 + k * 0.6; look.ca = 0.002 + k * 0.004;
  });

  // ===== S4 PLUNGE: across the bay, the fireball dives behind the skyline =====
  const BAY = new THREE.Vector3(2600, 30, 16500);
  const PLUNGE_FROM = new THREE.Vector3(-3300, 9500, -4000);
  shot('plunge', T3, TI, city, (lt, t, look) => {
    dusk(); setV({ rock: true, entry: true }); setCityDamage(town, null);
    SU.uHor.value.setRGB(0.28, 0.12, 0.1); U.uFogCol.value.setRGB(0.14, 0.09, 0.12);
    U.uTime.value = t;
    const k = lt / (TI - T3);
    _h.copy(PLUNGE_FROM).multiplyScalar(1 - easeIn(k) * 0.98 - k * 0.02);   // accelerating to ground zero
    const dir = _d.copy(PLUNGE_FROM).negate().normalize();
    const sh = shake(t, 2 + k * 8, 9);
    cam.fov = 40;
    cam.position.copy(BAY).add(new THREE.Vector3(sh[0], sh[1], 0));
    _t.set(-1200, 3600 - k * 900, 0); aimAt(cam, _t, 0, 0); cam.rotateZ(sh[2] * 0.001);
    camDone();
    rock.position.copy(_h); rock.scale.setScalar(500);
    heatRock(dir, 1, t);
    entry.update(cam, _h, dir, t * 2, { heat: 1, smokeCol: [0.2, 0.12, 0.1], smokeAlpha: 0.6, glowK: 1.2, trailK: 0.7 });
    const I = 0.5 + 1.8 * k * k;
    U.uPLPos.value.copy(_h); U.uPLCol.value.setRGB(2.4 * I, 1.2 * I, 0.5 * I); U.uPLRange.value = 30000;
    glowAt(_h, [0.5 + k * 0.9, 0.2 + k * 0.35, 0.06 + k * 0.1], 12);
    look.bloom = 0.65 + k * 0.4; look.bloomT = 0.9; look.exposure = 0.95;
    look.flash = sstep(0.93, 1.0, k);
  });

  // ===== S5 DOME: the flash, then a fireball rises over the skyline =====
  const fbLight = (a, K = 1) => {                  // fireball lighting
    const hot = Math.exp(-a / 3.5);
    U.uPLPos.value.set(0, 4000 + a * 600, 0);
    const I = (0.7 + 4 * Math.exp(-a * 1.5)) * (0.4 + 0.6 * hot) * K;
    U.uPLCol.value.setRGB(2.0 * I, 0.9 * I, 0.35 * I); U.uPLRange.value = 40000;
    U.uWin.value = clamp(1 - a * 0.8);
  };
  const blast = (a, extra = {}) => setCityDamage(town, { rs: shockR(a), rv: vaporR(a), heatR: 6000 + a * 600, ...extra });
  shot('dome', TI, T5, city, (lt, t, look) => {
    dusk(); setV({ fireball: true, dome: true, shell: true });
    SU.uHor.value.setRGB(0.28, 0.12, 0.1); U.uFogCol.value.setRGB(0.14, 0.09, 0.12);
    const a = age(t);
    U.uTime.value = t;
    const sh = shake(t, 6 * Math.exp(-lt * 0.6) + (lt > 1.2 ? 14 * Math.exp(-(lt - 1.2) * 1.5) : 0), 13);
    cam.fov = 42;
    cam.position.set(2600 + sh[0], 40 + sh[1], 32000 - lt * 300);
    _t.set(-600, 6000 + lt * 500, 0); aimAt(cam, _t); cam.rotateZ(sh[2] * 0.002);
    camDone();
    blast(a);
    const R = 9500 * (1 - Math.exp(-a * 1.8));
    dome.scale.set(R, R * 0.85, R); dome.position.set(0, 0, 0);
    dome.material.uniforms.uT.value = t; dome.material.uniforms.uHot.value = 1.15 * Math.exp(-a / 2.8) + 0.2; dome.material.uniforms.uAlpha.value = clamp(1.4 - a / 2.6);
    const S = shockR(a) * 1.05; shell.scale.set(S, S * 0.6, S); shell.material.uniforms.uK.value = 0.9 * Math.exp(-a / 2.5);
    fireball.update(cam, a * 0.8, { lightCol: [1, 0.45, 0.15] });
    fbLight(a);
    const e = Math.exp(-a / 2.5);
    glowAt(new THREE.Vector3(0, 5000, 0), [1.2 * e + 0.35, 0.45 * e + 0.12, 0.12 * e + 0.03], 4);
    ground.material.uniforms.uScorchR.value = 6000 + a * 800; ground.material.uniforms.uScorch.value = clamp(a / 2);
    look.flash = lt < 0.25 ? 1 : Math.exp(-(lt - 0.25) * 5);
    look.flashCol = [1, 0.96, 0.88];
    look.bloom = 0.75; look.bloomT = 0.95; look.exposure = 0.8; look.ca = 0.003;
  });

  // ===== S5b MUSHROOM: aerial, the cloud towers over the city =====
  shot('mushroom', T5, T6, city, (lt, t, look) => {
    dusk(); setV({ fireball: true, shell: true, dome: true });
    U.uFogCol.value.setRGB(0.13, 0.08, 0.08);
    const a = age(t);
    U.uTime.value = t;
    const ang = -0.9 + lt * 0.05;
    const sh = shake(t, 4, 3);
    cam.fov = 50;
    cam.position.set(Math.sin(ang) * 46000 + sh[0], 9000 + lt * 300, Math.cos(ang) * 46000);
    _t.set(0, 9000, 0); aimAt(cam, _t); camDone();
    blast(a);
    const R = 9500;
    dome.scale.set(R, R * 0.85, R); dome.material.uniforms.uT.value = t; dome.material.uniforms.uHot.value = 1.15 * Math.exp(-a / 2.8) + 0.15; dome.material.uniforms.uAlpha.value = clamp(1.4 - a / 2.6);
    const S = shockR(a); shell.scale.set(S, S * 0.5, S); shell.material.uniforms.uK.value = 0.6 * Math.exp(-a / 4);
    fireball.update(cam, a * 0.8, { lightCol: [1, 0.45, 0.15] });
    fbLight(a);
    glowAt(new THREE.Vector3(0, 8000, 0), [0.8, 0.3, 0.08], 3);
    ground.material.uniforms.uScorchR.value = 6000 + a * 800; ground.material.uniforms.uScorch.value = 1;
    look.bloom = 0.8; look.bloomT = 0.85; look.exposure = 1.0;
  });

  // ===== S6 ENGULF: street level, the fire wall pours down the avenue =====
  const ENG = new THREE.Vector3(-5600, 30, -2420);
  shot('engulf', T6, T7, city, (lt, t, look) => {
    dusk(); setV({ fireball: true, ring: true });
    const a = age(t), k = lt / (T7 - T6);
    U.uTime.value = t;
    const sh = shake(t, 1.5 + k * 6, 10);
    cam.fov = 70;
    cam.position.copy(ENG).add(new THREE.Vector3(sh[0], sh[1] + k * 6, sh[2]));
    _t.set(0, 900, -2420); aimAt(cam, _t, 0.08, 0); cam.rotateZ(sh[0] * 0.002);
    camDone();
    const dCam = ENG.length();
    const rw = lerp(2400, dCam + 600, easeIn(k));                  // fire-wall front
    setCityDamage(town, { rs: rw, rv: Math.min(rw - 1500, 3000), heatR: rw + 200, strength: 1 });
    const az = Math.atan2(ENG.z, ENG.x);
    ring.update(cam, t, rw, { az0: az - 0.6, az1: az + 0.6, H: 2000, depth: 2400, col: [0.36, 0.14, 0.06], hot: 0.8, alpha: 0.95, deb: 0.5 });
    fireball.update(cam, a * 0.8, { lightCol: [1, 0.45, 0.15] });
    fbLight(a, 1.3);
    U.uPLPos.value.set(Math.cos(az) * (rw - 400), 400, Math.sin(az) * (rw - 400)); U.uPLRange.value = 6000 + k * 3000;
    glowAt(new THREE.Vector3(0, 2000, 0), [0.7, 0.25, 0.06], 3);
    ground.material.uniforms.uScorchR.value = rw; ground.material.uniforms.uScorch.value = 1;
    look.bloom = 0.7; look.bloomT = 0.92; look.exposure = 0.9 + k * 0.2;
    look.flash = sstep(0.88, 1, k) * 0.85; look.flashCol = [1, 0.55, 0.2];
  });

  // ===== S7 SHOCK: aerial, the blast ring flattens the suburbs =====
  const SHK = new THREE.Vector3(-1500, 1300, -18500);
  shot('shock', T7, T8, city, (lt, t, look) => {
    dusk(); setV({ fireball: true, ring: true, shell: true });
    const a = age(t), k = lt / (T8 - T7);
    U.uTime.value = t;
    const sh = shake(t, 3 + 25 * sstep(0.7, 1, k), 9);
    cam.fov = 62;
    cam.position.copy(SHK).add(new THREE.Vector3(sh[0], sh[1], sh[2] - lt * 300));
    _t.set(0, 0, -6500); aimAt(cam, _t, 0.32, 0); camDone();
    const rs = lerp(9000, 18000, k);
    setCityDamage(town, { rs, rv: 7000, heatR: 7500 });
    shell.scale.set(rs, rs * 0.35, rs); shell.material.uniforms.uK.value = 0.7;
    const az = Math.atan2(SHK.z, SHK.x);
    ring.update(cam, t, rs, { az0: az - 0.9, az1: az + 0.9, H: 1000, depth: 2600, col: [0.3, 0.24, 0.2], hot: 0.2, alpha: 1 });
    fireball.update(cam, a * 0.8, { lightCol: [1, 0.45, 0.15] });
    fbLight(a, 0.8);
    glowAt(new THREE.Vector3(0, 6000, 0), [0.9, 0.35, 0.08], 3);
    ground.material.uniforms.uScorchR.value = 9000; ground.material.uniforms.uScorch.value = 1;
    look.bloom = 0.7; look.exposure = 1.0;
  });

  // ===== S7b HIT: ground level, the dust wall slams into the camera =====
  const HIT = new THREE.Vector3(-1800, 14, -13200);
  shot('hit', T8, T9, city, (lt, t, look) => {
    dusk(); setV({ fireball: true, ring: true });
    const a = age(t), k = lt / (T9 - T8);
    U.uTime.value = t;
    const dCam = HIT.length();
    const rs = lerp(dCam - 2500, dCam + 500, easeIn(Math.min(1, k * 1.1)));
    const hitK = sstep(dCam - 300, dCam + 200, rs);
    const sh = shake(t, 1 + 40 * hitK, 16);
    cam.fov = 72;
    cam.position.copy(HIT).add(new THREE.Vector3(sh[0], sh[1] + hitK * 8, sh[2]));
    _t.set(0, 700, 0); aimAt(cam, _t, 0.08, 0); cam.rotateZ(sh[0] * 0.004 + hitK * 0.15);
    camDone();
    setCityDamage(town, { rs, rv: 7000, heatR: 7500 });
    const az = Math.atan2(HIT.z, HIT.x);
    ring.update(cam, t, rs, { az0: az - 0.35, az1: az + 0.35, H: 800, depth: 2200, col: [0.36, 0.28, 0.22], hot: 0.15, alpha: 0.95, deb: 1 });
    fireball.update(cam, a * 0.8, { lightCol: [1, 0.45, 0.15] });
    fbLight(a, 0.7);
    glowAt(new THREE.Vector3(0, 6000, 0), [0.8, 0.3, 0.07], 3);
    look.bloom = 0.6; look.exposure = 1.0 - hitK * 0.3;
    look.fade = sstep(0.75, 1, k) * 0.85;
  });

  // ===== S8 CRATER: drone over the glowing crater =====
  const craterSmoke = [{ x: 1500, z: -1500, r: 1800, h: 16000, w: 7000, drift: 3000 }, { x: 4200, z: -5200, r: 900, h: 6000, w: 2500, drift: 1200 },
    { x: -6000, z: 3500, r: 800, h: 5000, w: 2200, drift: 1200 }, { x: 7800, z: 2600, r: 700, h: 5000, w: 2000, drift: 1000 }, { x: -2500, z: -8500, r: 800, h: 5500, w: 2400, drift: 1000 }];
  function ruined() {
    U.uWin.value = 0; U.uPLPos.value.set(0, 1500, 0); U.uPLCol.value.setRGB(2.5, 0.7, 0.15); U.uPLRange.value = 16000;
    U.uFogCol.value.setRGB(0.16, 0.07, 0.05); U.uFogDen.value = 0.000045;
    U.uSky.value.setRGB(0.08, 0.04, 0.035); U.uSunCol.value.setRGB(0.06, 0.03, 0.02);
    SU.uRed.value = 0.75; SU.uStars.value = 0;
    setCityDamage(town, { rs: 40000, rv: 7600, heatR: 13000, strength: 1 });
    crater.material.uniforms.uScorch.value = 1; crater.material.uniforms.uScorchR.value = 16000; crater.material.uniforms.uLights.value = 0;
  }
  shot('crater', T9, T10, city, (lt, t, look) => {
    dusk(); setV({ crater: true, smoke: true });
    U.uTime.value = t; ruined();
    U.uFogDen.value = 0.000014;
    const ang = 0.4 + lt * 0.06;
    cam.fov = 60;
    cam.position.set(Math.sin(ang) * (9000 - lt * 300), 27000 - lt * 900, Math.cos(ang) * (9000 - lt * 300));
    _t.set(0, -400, 0); aimAt(cam, _t, 0, 0); camDone();
    smoke.update(cam, t, craterSmoke, { col: [0.1, 0.07, 0.06], under: [0.9, 0.25, 0.05], alpha: 0.35, fire: 0.15 });
    glowAt(new THREE.Vector3(0, 0, 0), [0.6, 0.15, 0.03], 3);
    look.bloom = 0.8; look.bloomT = 0.8; look.exposure = 1.1; look.sat = 1.1;
  });

  // ===== S9 EJECTA: burning rock rains from a red sky =====
  shot('ejecta', T10, T11, city, (lt, t, look) => {
    dusk(); setV({ crater: true, smoke: true, ejecta: true });
    U.uTime.value = t; ruined();
    SU.uRed.value = 0.85;
    const sh = shake(t, 3, 5);
    cam.fov = 70;
    cam.position.set(-21000 + sh[0], 250 + sh[1] + lt * 40, 9000 + sh[2]);
    _t.set(0, 9000 + lt * 400, 0); aimAt(cam, _t, 0, 0); camDone();
    ejecta.update(cam, t, new THREE.Vector3(-9000, 0, 4000), { spread: 16000, top: 26000, k: 1 });
    smoke.update(cam, t, craterSmoke, { col: [0.09, 0.05, 0.04], under: [1.6, 0.45, 0.1], alpha: 0.6 });
    glowAt(new THREE.Vector3(0, 3000, 0), [0.7, 0.18, 0.04], 2.5);
    look.bloom = 0.9; look.bloomT = 0.75; look.exposure = 1.15;
  });

  // ===== S10 GLOBE: the dust spreads around the planet =====
  shot('globe', T11, T12, space, (lt, t, look) => {
    earth.visible = true; srock.visible = false; stars.visible = true; dustS.mesh.visible = false; sunSprite.mesh.visible = false;
    const k = lt / (T12 - T11); EU.uSunK.value = 1; EU.uCloud.value = 1;
    EU.uSun.value.copy(sunS).add(_v.copy(SITE).multiplyScalar(0.55)).normalize();
    EU.uDust.value = 0.02 + 0.4 * easeInOut(k); EU.uLights.value = 1 - 0.8 * k; EU.uScorch.value = 0.8; EU.uTime.value = t;
    cam.near = 50; cam.far = 4e6; cam.fov = 40;
    const side = _t.crossVectors(SITE, new THREE.Vector3(0, 1, 0)).normalize();
    cam.up.set(0, 1, 0);
    earth.position.set(0, 0, 0); earth.rotation.set(0, 0, 0);
    cam.position.copy(SITE).multiplyScalar(30000 + lt * 1500).addScaledVector(side, 7000 + lt * 1500);
    aimAt(cam, _v.set(0, 0, 0), 0, 0); camDone();
    look.bloom = 0.5; look.bloomT = 0.9; look.exposure = 1.15; look.vig = 0.5;
  });

  // ===== S11 ORBITS: NASA's catalogue of big near-Earth asteroids =====
  const sol = new THREE.Scene();
  const solStars = makeStars(4000, 1e5, 9); sol.add(solStars);
  const sunGlow = new Particles({ max: 8, blending: 'add', noise: 0, edge: 0 }); sol.add(sunGlow.mesh);
  const dots = new Particles({ max: 700, blending: 'add', noise: 0, edge: 0 }); sol.add(dots.mesh);
  const planets = [[38.7, 0.2, 0x9a9a9a], [72.3, 0.007, 0xd8b070], [100, 0.017, 0x3a8cff], [152.4, 0.09, 0xd05030]].map(([a, e, c], i) => {
    const l = orbitLine(a, e, 0, i * 1.3, 0, c, 400, i === 2 ? 0.9 : 0.35); sol.add(l); return { a, e, c, l, node: i * 1.3 };
  });
  const R0 = rng(42);
  const neas = [];
  for (let i = 0; i < 260; i++) {
    let a = 0, e = 0, q = 0;
    do { a = 80 + Math.pow(R0(), 1.3) * 200; e = 0.1 + R0() * 0.55; q = a * (1 - e); } while (q > 130);
    const inc = (R0() - 0.5) * 0.5, node = R0() * 6.28, peri = R0() * 6.28;
    const col = new THREE.Color().setHSL(0.5 + R0() * 0.08, 0.8, 0.55);
    const l = orbitLine(a, e, inc, node, peri, col, 160, 0); sol.add(l);
    neas.push({ a, e, l, t0: R0(), ph: R0() * 6.28, sp: 0.6 / Math.pow(a / 100, 1.5) });
  }
  const _m = new THREE.Matrix4();
  const tSafe = tAt('v10', 'and none');
  shot('orbits', T12, T13, sol, (lt, t, look) => {
    const k = lt / (T13 - T12);
    const safe = sstep(tSafe - T12, tSafe - T12 + 0.8, lt);
    cam.near = 1; cam.far = 3e5; cam.fov = 50; cam.up.set(0, 1, 0);
    const ang = 0.6 + lt * 0.06, dist = 420 - lt * 25;
    cam.position.set(Math.sin(ang) * dist, 260 - lt * 14, Math.cos(ang) * dist); aimAt(cam, _v.set(0, 0, 0), 0.05, 0); camDone();
    dots.begin();
    for (const n of neas) {
      const vis = sstep(n.t0 * 0.75, n.t0 * 0.75 + 0.12, k * 1.05);
      n.l.material.opacity = vis * lerp(0.28, 0.12, safe);
      if (vis > 0) {
        orbitPos(n.a, n.e, n.ph + t * n.sp, _v).applyMatrix4(_m.makeRotationFromQuaternion(n.l.quaternion));
        dots.add(_v.x, _v.y, _v.z, 2.6, 0.5 * vis, 1.0 * vis, 1.1 * vis, 1, 0, 1);
      }
    }
    for (const p of planets) {
      orbitPos(p.a, p.e, p.node + t * 0.25 / Math.pow(p.a / 100, 1.5), _v).applyMatrix4(_m.makeRotationFromQuaternion(p.l.quaternion));
      const c = new THREE.Color(p.c), big = p.a === 100;
      dots.add(_v.x, _v.y, _v.z, big ? 9 : 5, c.r * 2, c.g * 2, c.b * 2, 1, 0, 2);
      if (big) dots.add(_v.x, _v.y, _v.z, 30 + 25 * safe, 0.2 + 0.3 * safe, 0.5 + 0.6 * safe, 1.0 + 0.6 * safe, 0.6, 0, 3);
    }
    dots.end(cam);
    sunGlow.begin(); sunGlow.add(0, 0, 0, 22, 4, 3.4, 2.4, 1, 0, 1); sunGlow.add(0, 0, 0, 90, 1.0, 0.6, 0.25, 0.6, 0, 2); sunGlow.add(0, 0, 0, 260, 0.25, 0.12, 0.04, 0.5, 0, 3); sunGlow.end(cam);
    look.bloom = 0.9; look.bloomT = 0.6; look.bloomR = 0.6; look.exposure = 1.0; look.vig = 0.5;
  });

  // ===== S12 DART: a spacecraft knocks a moonlet off course =====
  const dart = new THREE.Scene();
  const dStars = makeStars(5000, 1e6, 5); dart.add(dStars);
  const didy = makeAsteroid(); dart.add(didy);
  const dimo = makeAsteroid(); dart.add(dimo);
  const craft = makeSpacecraft(); dart.add(craft);
  const dSun = new THREE.DirectionalLight(0xffffff, 3.2); dSun.position.set(1, 0.4, 0.6); dart.add(dSun);
  dart.add(new THREE.AmbientLight(0x223344, 0.4));
  const plume = new Particles({ max: 900, blending: 'normal', sort: true, noise: 0.5, edge: 0.0 }); dart.add(plume.mesh);
  const flashP = new Particles({ max: 10, blending: 'add', noise: 0.2, edge: 0.0 }); dart.add(flashP.mesh);
  const oldOrbit = orbitLine(1190, 0, 0, 0, 0, 0xffffff, 256, 0.0); dart.add(oldOrbit);
  const newOrbit = orbitLine(1150, 0.02, 0, 0, 0, 0x55ddff, 256, 0.0); dart.add(newOrbit);
  const SUND = new THREE.Vector3(1, 0.4, 0.6).normalize();
  const APPR = new THREE.Vector3(-0.75, -0.18, 0.64).normalize();
  const TDI = tAt('v11', 'into an asteroid') + 0.15;          // impact on "into an asteroid"
  const P0 = new THREE.Vector3();
  shot('dart', T13, T14, dart, (lt, t, look) => {
    const sinceImp = t - TDI;
    for (const r of [didy, dimo]) { const u = r.material.uniforms; u.uSun.value.copy(SUND); u.uSunCol.value.setRGB(2.4, 2.3, 2.15); u.uHeat.value = 0; u.uAmb.value.setRGB(0.012, 0.014, 0.02); u.uRim.value.setRGB(0.02, 0.03, 0.05); }
    didy.scale.setScalar(390); didy.position.set(0, 0, 0); didy.rotation.set(0.3, t * 0.08, 0.1);
    // Dimorphos on its orbit (angle frozen around the impact, slow drift after)
    const th = 0.6 + Math.max(0, sinceImp) * 0.03;
    const orbR = sinceImp > 0 ? lerp(1190, 1150, sstep(0, 1.6, sinceImp)) : 1190;
    const D = _d.set(Math.cos(th) * orbR, 0, Math.sin(th) * orbR);
    dimo.scale.setScalar(80); dimo.position.copy(D); dimo.rotation.set(1.2, 0.4 + t * 0.05, 0.7);
    const left = TDI - t;
    craft.visible = left > 0;
    if (left > 0) { craft.position.copy(D).addScaledVector(APPR, -(left * 900 + 60)); craft.lookAt(D); craft.scale.setScalar(1.6); }
    cam.near = 0.5; cam.far = 4e6; cam.up.set(0, 1, 0);
    const sideV = new THREE.Vector3(-APPR.z, 0, APPR.x).normalize();
    if (sinceImp < 0.6) {                                  // chase camera behind the spacecraft
      const k = clamp(lt / (TDI - T13));
      cam.fov = 55;
      const behind = sinceImp < 0 ? craft.position.clone() : D.clone().addScaledVector(APPR, -60);
      if (sinceImp < 0) { cam.position.copy(behind).addScaledVector(APPR, -(22 + 8 * (1 - k))).add(new THREE.Vector3(0, 5, 0)).addScaledVector(sideV, 6); aimAt(cam, D, -0.08, 0); }
      else { cam.position.copy(D).addScaledVector(sideV, -520).add(new THREE.Vector3(0, 90, 0)); aimAt(cam, P0.copy(D).addScaledVector(APPR, -140), 0, 0); }
    } else {                                               // pull back: show the orbit change
      const k = easeInOut(clamp((sinceImp - 0.6) / 2.4));
      cam.fov = 50;
      const s0 = _t.copy(D).addScaledVector(sideV, -520).add(new THREE.Vector3(0, 90, 0));
      cam.position.set(lerp(s0.x, 900, k), lerp(s0.y, 2600, k), lerp(s0.z, 2700, k));
      aimAt(cam, _v.copy(D).multiplyScalar(1 - k), 0, 0);
    }
    const sh = shake(t, sinceImp > 0 ? 2.5 * Math.exp(-sinceImp * 2) : 0.15, 12); cam.position.x += sh[0]; cam.position.y += sh[1];
    camDone();
    // impact flash + ejecta plume (sunlit dust cone)
    P0.copy(D).addScaledVector(APPR, -75);
    flashP.begin();
    if (sinceImp > 0) {
      const f = Math.exp(-sinceImp * 3.5);
      flashP.add(P0.x, P0.y, P0.z, 90 * (1 + sinceImp), 3 * f, 2.4 * f, 1.8 * f, 1, 0, 1);
      flashP.add(P0.x, P0.y, P0.z, 300, 0.8 * f, 0.5 * f, 0.3 * f, 0.6, 0, 2);
    }
    flashP.end(cam);
    plume.begin();
    if (sinceImp > 0) {
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < 900; i++) {
        const sp = 40 + 160 * Math.pow(hash1(i * 3.3), 2);
        const a = hash1(i * 1.7) * 6.28, cone = 0.7 * Math.sqrt(hash1(i * 5.1));
        const dE = _v.copy(APPR).negate().multiplyScalar(Math.cos(cone)).addScaledVector(sideV, Math.sin(cone) * Math.cos(a)).addScaledVector(up, Math.sin(cone) * Math.sin(a));
        const s = sp * sinceImp * (1 - 0.15 * sinceImp / 3);
        const b = 0.35 + 0.35 * hash1(i * 9.1);
        plume.add(P0.x + dE.x * s, P0.y + dE.y * s, P0.z + dE.z * s, 8 + s * 0.16, b * 1.5, b * 1.38, b * 1.2, 0.75 * Math.exp(-sinceImp * 0.3), hash1(i) * 6, i % 50);
      }
    }
    plume.end(cam);
    oldOrbit.material.opacity = sstep(0.9, 1.8, sinceImp) * 0.5; newOrbit.material.opacity = sstep(1.6, 2.4, sinceImp);
    look.bloom = 0.7; look.bloomT = 0.8; look.exposure = 1.1; look.vig = 0.45;
    look.flash = sinceImp > 0 && sinceImp < 0.1 ? 0.35 : 0;
  });

  // ===== S13 LOOP: back on the boulevard; a new light in the sky grows (loops into the hook) =====
  shot('loop', T14, TEND + 1, city, (lt, t, look) => {
    const k = clamp(lt / (TEND - T14));
    boulevard(0, t, look, 45000 * Math.pow(1 - k, 2), 0.25 + 0.75 * k * k, 0.2 + 0.8 * k);
    look.fade = 1 - sstep(0, 0.35, lt);
  });

  return shots;
}
