// Reusable stateless effects built on Particles: entry trail + plasma head, fireball, dust wall, ejecta.
import * as THREE from 'three';
import { Particles } from './particles.js';
import { hash1, clamp, sstep, fbm, lerp, GLSL_NOISE } from './util.js';

const V = new THREE.Vector3(), P = new THREE.Vector3(), Q = new THREE.Vector3();

// basis perpendicular to a direction
export function perp(dir) {
  const a = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(dir, a).normalize();
  const v = new THREE.Vector3().crossVectors(dir, u).normalize();
  return [u, v];
}

export class EntryFX {
  // r: asteroid radius (m). L: trail length (m).
  constructor(scene, { r = 500, L = 40000, nSmoke = 700, nGlow = 500, nSpark = 400 } = {}) {
    this.r = r; this.L = L;
    this.smoke = new Particles({ max: nSmoke, blending: 'normal', sort: true, noise: 0.55, edge: 0.0 });
    this.glow = new Particles({ max: nGlow + 40, blending: 'add', noise: 0.35, edge: 0.0 });
    this.spark = new Particles({ max: nSpark, blending: 'add', streak: true });
    this.nSmoke = nSmoke; this.nGlow = nGlow; this.nSpark = nSpark;
    scene.add(this.smoke.mesh, this.glow.mesh, this.spark.mesh);
  }
  // head: position; dir: unit travel direction; t: seconds; heat 0..1; smokeCol: lit colour of the smoke
  update(camera, head, dir, t, { heat = 1, smokeCol = [0.25, 0.16, 0.13], smokeAlpha = 0.55, trailK = 1, glowK = 1 } = {}) {
    const { r, L } = this, [u, v] = perp(dir);
    const sm = this.smoke, gl = this.glow, sp = this.spark;
    sm.begin(); gl.begin(); sp.begin();
    const Lt = L * trailK;
    // smoke trail
    for (let i = 0; i < this.nSmoke; i++) {
      const s0 = hash1(i * 1.37);
      const k = (s0 + t * 0.35) % 1;                       // flows back along the trail
      const s = Math.pow(k, 1.7) * Lt;
      const spread = r * 0.9 + s * 0.06;
      const a = hash1(i * 3.1) * Math.PI * 2, rr = Math.sqrt(hash1(i * 5.7)) * spread;
      const wob = fbm(s * 0.0004, i * 0.1, t * 0.2, 2) * spread * 0.6;
      P.copy(head).addScaledVector(dir, -s - r * 0.6).addScaledVector(u, Math.cos(a) * rr + wob).addScaledVector(v, Math.sin(a) * rr);
      const size = r * 1.6 + s * 0.1;
      const fadeIn = sstep(0, 0.06, k), fadeOut = 1 - sstep(0.55, 1, k);
      const hot = Math.exp(-s / (r * 6)) * heat;
      const c = [lerp(smokeCol[0], 1.0, hot), lerp(smokeCol[1], 0.45, hot), lerp(smokeCol[2], 0.15, hot)];
      sm.add(P.x, P.y, P.z, size, c[0], c[1], c[2], smokeAlpha * fadeIn * fadeOut * (0.5 + 0.5 * hash1(i * 9.1)), hash1(i) * 6.28, hash1(i * 2.3) * 10);
    }
    // glowing ionised trail + head plasma
    for (let i = 0; i < this.nGlow; i++) {
      const s0 = hash1(i * 2.71 + 4);
      const k = (s0 + t * 0.9) % 1;
      const s = Math.pow(k, 2.2) * Lt * 0.55;
      const spread = r * 0.5 + s * 0.035;
      const a = hash1(i * 7.3) * 6.28, rr = Math.sqrt(hash1(i * 1.9)) * spread;
      P.copy(head).addScaledVector(dir, -s).addScaledVector(u, Math.cos(a) * rr).addScaledVector(v, Math.sin(a) * rr);
      const e = Math.exp(-s / (r * 10));
      const I = heat * glowK * (0.08 + 0.5 * e) * (1 - sstep(0.5, 1, k)) * sstep(0.0, r * 1.5, s);
      gl.add(P.x, P.y, P.z, r * (1.2 + s * 0.0003), 1.0 * I, (0.3 + 0.45 * e) * I, (0.06 + 0.3 * e * e) * I, 0.45, hash1(i) * 6.28, hash1(i * 1.1) * 10);
    }
    // bow shock / plasma cap in front of the rock
    const fl = 0.85 + 0.15 * Math.sin(t * 37) * Math.sin(t * 23 + 1);
    for (let j = 0; j < 30; j++) {
      const a = hash1(j * 4.4) * 6.28, rr = r * (0.7 + hash1(j * 8.8) * 0.7);
      P.copy(head).addScaledVector(dir, r * (0.9 - hash1(j * 3.3) * 1.6)).addScaledVector(u, Math.cos(a) * rr).addScaledVector(v, Math.sin(a) * rr);
      const I = heat * glowK * fl * 0.6;
      gl.add(P.x, P.y, P.z, r * (1.0 + hash1(j) * 1.3), 1.0 * I, 0.62 * I, 0.3 * I, 0.35, hash1(j * 5) * 6.28, j);
    }
    gl.add(head.x + dir.x * r * 0.9, head.y + dir.y * r * 0.9, head.z + dir.z * r * 0.9, r * 2.6, heat * glowK * 0.7, heat * glowK * 0.5, heat * glowK * 0.3, 0.35, 0, 99);
    gl.add(head.x, head.y, head.z, r * 12, heat * glowK * 0.12, heat * glowK * 0.05, heat * glowK * 0.015, 0.5, 0, 98);
    // sparks peeling off
    for (let i = 0; i < this.nSpark; i++) {
      const k = (hash1(i * 6.1) + t * 1.6) % 1;
      const s = k * r * 30;
      const a = hash1(i * 2.2) * 6.28, rr = r * (0.8 + k * 6 * hash1(i * 3.7));
      P.copy(head).addScaledVector(dir, -s).addScaledVector(u, Math.cos(a) * rr).addScaledVector(v, Math.sin(a) * rr);
      const I = heat * (1 - k) * 2.0;
      sp.add(P.x, P.y, P.z, r * 0.06, 1.0 * I, 0.6 * I, 0.25 * I, 1.0, 0, i, -dir.x * r * 3, -dir.y * r * 3, -dir.z * r * 3);
    }
    sm.end(camera); gl.end(camera); sp.end(camera);
  }
  set visible(b) { this.smoke.mesh.visible = this.glow.mesh.visible = this.spark.mesh.visible = b; }
}

// Fireball + mushroom cloud, ground zero at origin. age: seconds since impact (cinematic time). R: max fireball radius (m)
export class FireballFX {
  constructor(scene, { n = 1400, R = 12000 } = {}) {
    this.R = R; this.n = n;
    this.smoke = new Particles({ max: n, blending: 'normal', sort: true, noise: 0.6, edge: 0.0 });
    this.glow = new Particles({ max: 500, blending: 'add', noise: 0.45, edge: 0.0 });
    scene.add(this.smoke.mesh, this.glow.mesh);
  }
  update(camera, age, { grow = 1, lightCol = [1, 0.5, 0.2], ambient = [0.08, 0.06, 0.06] } = {}) {
    const R = this.R, sm = this.smoke, gl = this.glow;
    sm.begin(); gl.begin();
    const rise = Math.max(0, age - 0.6);
    const capH = R * 0.55 + rise * R * 0.11;                 // cap height
    const capR = R * (0.6 + 0.4 * (1 - Math.exp(-age / 2.2))) * grow;
    const hotK = Math.exp(-age / 2.6);                        // cooling
    for (let i = 0; i < this.n; i++) {
      const h = hash1(i * 1.91), a = hash1(i * 4.13) * 6.28, q = hash1(i * 7.77);
      let x, y, z, size, part;
      if (i < this.n * 0.62) {                               // cap: toroidal roll
        part = 0;
        const th = a, ph = q * 6.28 + age * 0.35 * (1 + h);
        const ring = capR * 0.62, tube = capR * (0.45 + 0.15 * h);
        const rr = ring + Math.cos(ph) * tube * Math.sqrt(hash1(i * 3.3));
        x = Math.cos(th) * rr; z = Math.sin(th) * rr; y = capH + Math.sin(ph) * tube * 0.7 * Math.sqrt(hash1(i * 3.3));
        y = Math.min(y, capH + tube); if (age < 1.5) { const k = age / 1.5; x *= k; z *= k; y = lerp(R * 0.25, y, k); }
        size = capR * (0.28 + 0.25 * h);
      } else if (i < this.n * 0.85) {                         // stem
        part = 1;
        const yy = q * capH; const sr = R * (0.18 + 0.1 * Math.sin(yy / capH * 3 + h * 4)) * (0.6 + 0.4 * yy / capH) * grow;
        x = Math.cos(a) * sr * Math.sqrt(h); z = Math.sin(a) * sr * Math.sqrt(h); y = yy;
        size = R * (0.22 + 0.15 * h) * grow;
        if (age < 1.2) { y *= age / 1.2; }
      } else {                                               // base surge skirt
        part = 2;
        const rr = (R * 0.4 + age * R * 0.18 * (0.6 + 0.4 * h)) * grow;
        x = Math.cos(a) * rr; z = Math.sin(a) * rr; y = R * 0.04 + q * R * 0.15;
        size = R * (0.25 + 0.2 * h);
      }
      // colour: hot core to dark smoke; lit from below/inside
      const heightK = clamp(y / (capH + 1));
      const inner = part === 0 ? 1 - Math.sqrt(hash1(i * 3.3)) : part === 1 ? 0.7 : 0.2;
      const hot = clamp(hotK * (0.4 + 0.9 * inner) - 0.15 * (part === 2 ? 1 : 0));
      const lit = 0.35 + 0.65 * (1 - heightK);
      let r = lerp(ambient[0] + lightCol[0] * 0.25 * lit, 2.0, hot), g = lerp(ambient[1] + lightCol[1] * 0.22 * lit, 0.8, hot * hot), b = lerp(ambient[2] + lightCol[2] * 0.2 * lit, 0.2, hot * hot * hot);
      const alpha = (part === 2 ? 0.45 : 0.75) * sstep(0, 0.3, age);
      sm.add(x, y, z, size, r, g, b, alpha, h * 6.28 + age * 0.05 * (h - 0.5), i % 97);
    }
    // inner glow through the cloud
    const gk = hotK;
    for (let j = 0; j < 160; j++) {
      const a = hash1(j * 2.9) * 6.28, q = hash1(j * 5.3), h = hash1(j * 8.1);
      const up = j < 110;
      const rr = up ? capR * 0.6 * Math.sqrt(q) : R * 0.15 * q;
      const y = up ? capH - capR * 0.1 + (h - 0.5) * capR * 0.6 : h * capH;
      gl.add(Math.cos(a) * rr, y, Math.sin(a) * rr, capR * 0.5, 0.9 * gk, 0.35 * gk, 0.08 * gk, 0.3, h * 6, j);
    }
    sm.end(camera); gl.end(camera);
    return { capH, capR, hotK };
  }
  set visible(b) { this.smoke.mesh.visible = this.glow.mesh.visible = b; }
}

// Blinding hemisphere of the first seconds (opaque-ish emissive dome with boiling noise), centred at origin.

export function makeFireDome() {
  const g = new THREE.SphereGeometry(1, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uHot: { value: 1 }, uAlpha: { value: 1 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vP = position; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `${GLSL_NOISE}
      uniform float uT, uHot, uAlpha; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float mu = max(dot(normalize(vN), V), 0.0);
        float n = fbm(vP * 5.0 + vec3(0.0, -uT * 0.7, uT * 0.3));
        float k = clamp(0.55 + 0.6 * n + 0.35 * mu, 0.0, 1.5) * uHot;
        vec3 c = mix(vec3(0.9,0.12,0.02), mix(vec3(2.2,0.8,0.15), vec3(3.6,2.9,2.0), smoothstep(0.85,1.25,k)), smoothstep(0.3,0.85,k));
        c *= 0.6 + 0.4 * mu;
        gl_FragColor = vec4(c, uAlpha * smoothstep(0.0, 0.25, mu + 0.1));
      }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
  return mesh;
}

// Thin condensation shell of the shock wave (fresnel, additive)
export function makeShockShell() {
  const g = new THREE.SphereGeometry(1, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uK: { value: 1 }, uCol: { value: new THREE.Color(0.8, 0.85, 1.0) } },
    vertexShader: `varying vec3 vN; varying vec3 vW; varying float vY; void main(){ vY = position.y; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uK; uniform vec3 uCol; varying vec3 vN; varying vec3 vW; varying float vY;
      void main(){ vec3 V = normalize(cameraPosition - vW); float r = pow(1.0 - abs(dot(normalize(vN), V)), 4.0);
        gl_FragColor = vec4(uCol * r * uK * (0.4 + 0.6 * smoothstep(0.6, 0.0, vY)), 1.0); }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
  return mesh;
}

// Ground-hugging dust/debris wall on a ring of radius rs (only the arc facing the camera is filled).
export class RingWallFX {
  constructor(scene, { n = 1600 } = {}) {
    this.n = n;
    this.smoke = new Particles({ max: n, blending: 'normal', sort: true, noise: 0.6, edge: 0.0 });
    this.glow = new Particles({ max: 400, blending: 'add', noise: 0.4, edge: 0.0 });
    this.deb = new Particles({ max: 500, blending: 'normal', streak: true });
    scene.add(this.smoke.mesh, this.glow.mesh, this.deb.mesh);
  }
  // rs: front radius, az0/az1: azimuth range to fill, H: wall height, col: dust colour, hot: 0..1 fire glow
  update(camera, t, rs, { az0 = 0, az1 = 6.28, H = 900, depth = 1800, col = [0.42, 0.36, 0.3], hot = 0, alpha = 0.8, deb = 1 } = {}) {
    const sm = this.smoke, gl = this.glow, db = this.deb;
    sm.begin(); gl.begin(); db.begin();
    for (let i = 0; i < this.n; i++) {
      const a = az0 + hash1(i * 1.7) * (az1 - az0);
      const back = Math.pow(hash1(i * 3.9), 1.6) * depth;          // behind the front
      const r = rs - back + (hash1(i * 5.3) - 0.5) * 120;
      if (r < 0) continue;
      const hk = hash1(i * 7.1);
      const y = Math.pow(hk, 1.4) * H * (0.4 + 0.6 * (1 - back / depth)) + 20;
      const roll = fbm(a * 8, back * 0.002, t * 0.4, 2);
      const x = Math.cos(a) * (r + roll * 150), z = Math.sin(a) * (r + roll * 150);
      const size = 220 + hk * 380 + back * 0.25;
      const shade = 0.55 + 0.45 * hk;
      sm.add(x, y, z, size, col[0] * shade, col[1] * shade, col[2] * shade, alpha * (1 - back / depth * 0.6), hash1(i) * 6.28 + t * 0.2, i % 97);
      if (hot > 0 && i < 400) gl.add(x, y * 0.5, z, size * 1.1, 1.6 * hot, 0.5 * hot, 0.12 * hot, 0.25, hash1(i * 2), i);
    }
    for (let i = 0; i < 500 * deb; i++) {
      const a = az0 + hash1(i * 9.7) * (az1 - az0), k = hash1(i * 4.1);
      const r = rs + 60 - k * 900, y = 30 + hash1(i * 6.6) * 500 * (1 - k);
      db.add(Math.cos(a) * r, y, Math.sin(a) * r, 2 + hash1(i) * 4, 0.1, 0.085, 0.07, 0.8, 0, i, Math.cos(a) * 60, 25 * (hash1(i * 3) - 0.3), Math.sin(a) * 60);
    }
    sm.end(camera); gl.end(camera); db.end(camera);
  }
  set visible(b) { this.smoke.mesh.visible = this.glow.mesh.visible = this.deb.mesh.visible = b; }
}

// Burning debris falling from the sky (streaks with glowing heads) + ground flashes.
export class EjectaFX {
  constructor(scene, { n = 420 } = {}) {
    this.n = n;
    this.str = new Particles({ max: n, blending: 'add', streak: true });
    this.head = new Particles({ max: n + 60, blending: 'add', noise: 0.2, edge: 0.0 });
    scene.add(this.str.mesh, this.head.mesh);
  }
  update(camera, t, center, { spread = 30000, top = 30000, k = 1 } = {}) {
    const S = this.str, Hh = this.head; S.begin(); Hh.begin();
    for (let i = 0; i < this.n; i++) {
      const life = 2.2 + hash1(i * 2.2) * 2.5, ph = ((t + hash1(i * 7.7) * life) % life) / life;
      const ax = (hash1(i * 3.3) - 0.5) * 2, az = (hash1(i * 5.5) - 0.5) * 2;
      const vx = (hash1(i * 8.1) - 0.5) * 0.6, vz = (hash1(i * 1.9) - 0.2) * 0.5;
      const sx = center.x + ax * spread, sz = center.z + az * spread;
      const y = top * (1 - ph) * (0.6 + 0.4 * hash1(i * 4.4));
      const x = sx + vx * (1 - ph) * top * 0.5, z = sz + vz * (1 - ph) * top * 0.5;
      const I = k * (0.6 + 0.8 * hash1(i * 6.2)) * Math.min(1, ph * 6) * (1 - sstep(0.9, 1, ph));
      const len = 1400 + 2000 * hash1(i * 9.9);
      S.add(x, y, z, 40 + 60 * hash1(i), 1.6 * I, 0.55 * I, 0.15 * I, 1, 0, i, vx * len, len, vz * len);
      Hh.add(x, y, z, 350 + 400 * hash1(i * 1.3), 1.3 * I, 0.6 * I, 0.25 * I, 0.6, 0, i);
      if (ph > 0.93) Hh.add(x, 50, z, 1500, 2.2 * I, 0.8 * I, 0.2 * I, (1 - ph) * 12, 0, i + 7);
    }
    S.end(camera); Hh.end(camera);
  }
  set visible(b) { this.str.mesh.visible = this.head.mesh.visible = b; }
}

// Generic rising smoke columns / ground fires
export class SmokeFX {
  constructor(scene, { n = 900 } = {}) {
    this.n = n;
    this.sm = new Particles({ max: n, blending: 'normal', sort: true, noise: 0.6, edge: 0.0 });
    this.fire = new Particles({ max: 500, blending: 'add', noise: 0.45, edge: 0.0 });
    scene.add(this.sm.mesh, this.fire.mesh);
  }
  // sources: array of {x, z, r (spread), h (column height), w (width at top)}
  update(camera, t, sources, { col = [0.12, 0.09, 0.08], under = [1.2, 0.4, 0.1], alpha = 0.7, fire = 1 } = {}) {
    const sm = this.sm, fi = this.fire; sm.begin(); fi.begin();
    const per = Math.floor(this.n / sources.length), perF = Math.floor(500 / sources.length);
    sources.forEach((s, si) => {
      for (let j = 0; j < per; j++) {
        const i = si * 1000 + j;
        const ph = (hash1(i * 1.3) + t * (0.05 + 0.04 * hash1(i * 2.9))) % 1;
        const a = hash1(i * 4.7) * 6.28, rr = Math.sqrt(hash1(i * 6.1)) * (s.r + ph * s.w);
        const wob = fbm(ph * 3 + si, i * 0.01, t * 0.2, 2) * s.w * 0.3;
        const x = s.x + Math.cos(a) * rr + wob + ph * (s.drift || 0), z = s.z + Math.sin(a) * rr, y = ph * s.h;
        const size = (s.r * 0.6 + ph * s.w * 0.9) * (0.7 + 0.6 * hash1(i * 8.3));
        const lowGlow = Math.exp(-ph * 6) * fire;
        sm.add(x, y, z, size, col[0] + under[0] * 0.25 * lowGlow, col[1] + under[1] * 0.25 * lowGlow, col[2] + under[2] * 0.25 * lowGlow,
          alpha * sstep(0, 0.08, ph) * (1 - sstep(0.75, 1, ph)), hash1(i) * 6.28 + t * 0.1, i % 89);
      }
      for (let j = 0; j < perF * fire; j++) {
        const i = si * 777 + j;
        const a = hash1(i * 2.1) * 6.28, rr = Math.sqrt(hash1(i * 3.7)) * s.r;
        const fl = 0.7 + 0.3 * Math.sin(t * (8 + 6 * hash1(i)) + i);
        fi.add(s.x + Math.cos(a) * rr, s.r * 0.15 * hash1(i * 5.1), s.z + Math.sin(a) * rr, s.r * (0.25 + 0.3 * hash1(i * 9.2)), under[0] * fl, under[1] * fl, under[2] * fl, 0.45, hash1(i) * 6, i);
      }
    });
    sm.end(camera); fi.end(camera);
  }
  set visible(b) { this.sm.mesh.visible = this.fire.mesh.visible = b; }
}
