// Instanced camera-facing particles (smoke puffs, glow, sparks, streaks). Filled from scratch every frame (stateless),
// so any frame can be rendered on its own.
import * as THREE from 'three';
import { fbm } from './util.js';

// tileable fbm noise texture (built once) — much cheaper than per-pixel noise in software WebGL
let NOISE_TEX = null;
function noiseTexture() {
  if (NOISE_TEX) return NOISE_TEX;
  const S = 256, d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = (x / S) * Math.PI * 2, b = (y / S) * Math.PI * 2;   // map to a torus so it tiles
    const v = fbm(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + Math.cos(b) * 1.6, Math.sin(b) * 1.6 + 3, 4);
    const c = Math.max(0, Math.min(255, Math.round((v * 0.5 + 0.5) * 255)));
    d.set([c, c, c, 255], (y * S + x) * 4);
  }
  NOISE_TEX = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  NOISE_TEX.wrapS = NOISE_TEX.wrapT = THREE.RepeatWrapping; NOISE_TEX.magFilter = NOISE_TEX.minFilter = THREE.LinearFilter;
  NOISE_TEX.needsUpdate = true;
  return NOISE_TEX;
}

const VS = /* glsl */`
attribute vec3 iPos; attribute float iSize; attribute vec4 iCol; attribute float iRot; attribute float iSeed; attribute vec3 iVel;
varying vec2 vUv; varying vec4 vCol; flat varying float vSeed;
void main(){
  vUv = position.xy + 0.5; vCol = iCol; vSeed = iSeed;
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
#ifdef STREAK
  vec3 v = (viewMatrix * vec4(iVel, 0.0)).xyz;
  vec2 d = v.xy; float L = length(d); vec2 ax = L > 1e-5 ? d / L : vec2(1.0, 0.0); vec2 ay = vec2(-ax.y, ax.x);
  vec2 c = position.xy;
  mv.xy += ax * c.x * (iSize + L) + ay * c.y * iSize;
  mv.xy += ax * L * 0.5;
#else
  float cr = cos(iRot), sr = sin(iRot);
  vec2 c = vec2(position.x * cr - position.y * sr, position.x * sr + position.y * cr);
  mv.xy += c * iSize;
#endif
  gl_Position = projectionMatrix * mv;
}`;

const FS = /* glsl */`
uniform float uNoise; uniform float uEdge; uniform sampler2D uTex;
varying vec2 vUv; varying vec4 vCol; flat varying float vSeed;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
#ifdef STREAK
  float d = length(vec2(p.x, p.y * 1.0));
  float a = smoothstep(1.0, 0.0, abs(p.y)) * smoothstep(1.0, 0.6, abs(p.x));
  a = pow(a, 1.5);
#else
  float d = length(p);
  vec2 o = vec2(fract(vSeed * 0.6180339), fract(vSeed * 0.4142135));
  float n = texture2D(uTex, p * 0.42 + o).r * 2.0 - 1.0;
  float a = smoothstep(1.0, uEdge, d + n * uNoise);
#endif
  float al = a * vCol.a;
  if (al < 0.002) discard;
  gl_FragColor = vec4(vCol.rgb, al);
}`;

export class Particles {
  constructor({ max = 2000, blending = 'add', streak = false, sort = false, noise = 0.45, edge = 0.15, depthTest = true } = {}) {
    this.max = max; this.sort = sort; this.n = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const mk = (name, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * size), size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.aPos = mk('iPos', 3); this.aSize = mk('iSize', 1); this.aCol = mk('iCol', 4); this.aRot = mk('iRot', 1); this.aSeed = mk('iSeed', 1); this.aVel = mk('iVel', 3);
    this.tmp = { pos: new Float32Array(max * 3), size: new Float32Array(max), col: new Float32Array(max * 4), rot: new Float32Array(max), seed: new Float32Array(max), vel: new Float32Array(max * 3) };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, depthTest,
      blending: blending === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uNoise: { value: noise }, uEdge: { value: edge }, uTex: { value: noiseTexture() } }, defines: streak ? { STREAK: 1 } : {},
    });
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.geo = g;
  }
  begin() { this.n = 0; }
  add(x, y, z, size, r, g, b, a, rot = 0, seed = 0, vx = 0, vy = 0, vz = 0) {
    if (this.n >= this.max || a <= 0.001 || size <= 0) return;
    const i = this.n++, T = this.tmp;
    T.pos[i * 3] = x; T.pos[i * 3 + 1] = y; T.pos[i * 3 + 2] = z; T.size[i] = size;
    T.col[i * 4] = r; T.col[i * 4 + 1] = g; T.col[i * 4 + 2] = b; T.col[i * 4 + 3] = a; T.rot[i] = rot; T.seed[i] = seed;
    T.vel[i * 3] = vx; T.vel[i * 3 + 1] = vy; T.vel[i * 3 + 2] = vz;
  }
  end(camera) {
    const T = this.tmp, n = this.n;
    let order = null;
    if (this.sort && camera) {
      const e = camera.matrixWorldInverse.elements, d = new Float32Array(n);
      for (let i = 0; i < n; i++) d[i] = e[2] * T.pos[i * 3] + e[6] * T.pos[i * 3 + 1] + e[10] * T.pos[i * 3 + 2];
      order = Array.from({ length: n }, (_, i) => i).sort((a, b) => d[a] - d[b] || a - b); // far (more negative) first
    }
    const P = this.aPos.array, S = this.aSize.array, C = this.aCol.array, R = this.aRot.array, Sd = this.aSeed.array, V = this.aVel.array;
    for (let k = 0; k < n; k++) {
      const i = order ? order[k] : k;
      P[k * 3] = T.pos[i * 3]; P[k * 3 + 1] = T.pos[i * 3 + 1]; P[k * 3 + 2] = T.pos[i * 3 + 2]; S[k] = T.size[i];
      C[k * 4] = T.col[i * 4]; C[k * 4 + 1] = T.col[i * 4 + 1]; C[k * 4 + 2] = T.col[i * 4 + 2]; C[k * 4 + 3] = T.col[i * 4 + 3];
      R[k] = T.rot[i]; Sd[k] = T.seed[i]; V[k * 3] = T.vel[i * 3]; V[k * 3 + 1] = T.vel[i * 3 + 1]; V[k * 3 + 2] = T.vel[i * 3 + 2];
    }
    for (const a of [this.aPos, this.aSize, this.aCol, this.aRot, this.aSeed, this.aVel]) a.needsUpdate = true;
    this.geo.instanceCount = n;
  }
}
