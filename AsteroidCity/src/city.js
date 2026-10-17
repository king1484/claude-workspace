// Procedural coastal city at dusk: instanced towers with procedural lit windows, ground with street-light grid,
// a bay to the south, and a gradient sky dome. Units are metres; the impact point is the origin (downtown).
import * as THREE from 'three';
import { rng, GLSL_NOISE, clamp, sstep } from './util.js';

export const COAST_Z = 2600;                           // water for z > coast (with a wobble)
export const coastAt = (x) => COAST_Z + 500 * Math.sin(x / 2300) + 260 * Math.sin(x / 830 + 1.3);

// shared lighting uniforms (each scene gets its own copy via lightingUniforms())
export function lightingUniforms() {
  return {
    uSunDir: { value: new THREE.Vector3(-0.8, 0.06, -0.3).normalize() }, uSunCol: { value: new THREE.Color(0.9, 0.45, 0.3) },
    uSky: { value: new THREE.Color(0.10, 0.12, 0.22) }, uGround: { value: new THREE.Color(0.03, 0.025, 0.03) },
    uPLPos: { value: new THREE.Vector3(0, 3000, 0) }, uPLCol: { value: new THREE.Color(0, 0, 0) }, uPLRange: { value: 20000 },
    uFogCol: { value: new THREE.Color(0.35, 0.22, 0.25) }, uFogDen: { value: 0.00006 },
    uWin: { value: 1.0 }, uTime: { value: 0 },
  };
}

const LIGHT_GLSL = /* glsl */`
uniform vec3 uSunDir, uSunCol, uSky, uGround, uPLPos, uPLCol, uFogCol; uniform float uPLRange, uFogDen, uWin, uTime;
vec3 light(vec3 n, vec3 w){
  float hemi = 0.5 + 0.5 * n.y;
  vec3 c = mix(uGround, uSky, hemi) + uSunCol * max(dot(n, uSunDir), 0.0);
  vec3 L = uPLPos - w; float d = length(L);
  float att = 1.0 / (1.0 + pow(d / uPLRange, 2.0) * 4.0);
  c += uPLCol * max(dot(n, L / d), 0.0) * att + uPLCol * 0.08 * att;
  return c;
}
vec3 fogit(vec3 c, vec3 w){ float d = length(cameraPosition - w); float f = 1.0 - exp(-d * uFogDen); return mix(c, uFogCol, f); }
`;

function buildingMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U, defines: location.search.includes('dbgcell') ? { DBG: 1 } : {},
    vertexShader: /* glsl */`
      attribute vec4 iInfo; attribute vec4 iState;
      varying vec3 vW; varying vec3 vN; flat varying vec4 vInfo; flat varying vec4 vState; varying vec3 vLoc; varying vec3 vScale; varying vec3 vON;
      void main(){
        vON = normal; vInfo = iInfo; vState = iState;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vLoc = position * vScale;  // local metres, base at y=0
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      ${LIGHT_GLSL}
      ${GLSL_NOISE}
      varying vec3 vW; varying vec3 vN; flat varying vec4 vInfo; flat varying vec4 vState; varying vec3 vLoc; varying vec3 vScale; varying vec3 vON;
      float hsh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main(){
        vec3 n = normalize(vN);
        float seed = vInfo.x, kind = vInfo.y, lit = vInfo.w;
        float dmg = vState.x, heat = vState.y;
        vec3 base = mix(vec3(0.20,0.21,0.24), vec3(0.32,0.30,0.29), hsh(vec2(seed, 3.1)));
        if (kind > 0.5) base = mix(base, vec3(0.14,0.18,0.24), 0.6); // glassy towers
        vec3 col; vec3 emis = vec3(0.0);
        vec3 an = abs(vON);
        if (an.y > 0.5) { col = base * 0.6 * light(n, vW); }
        else {
          vec2 uv = an.x > 0.5 ? vec2(vLoc.z, vLoc.y) : vec2(vLoc.x, vLoc.y);
          float fh = kind > 0.5 ? 3.8 : 3.4, cw = kind > 0.5 ? 2.6 : 3.4;
          vec2 cell = floor(uv / vec2(cw, fh)); vec2 f = fract(uv / vec2(cw, fh));
          float win = step(0.14, f.x) * step(f.x, 0.86) * step(0.22, f.y) * step(f.y, 0.82);
          if (kind > 0.5) win = step(0.06, f.x) * step(0.12, f.y) * step(f.y, 0.92);
          float r = hsh(cell + seed * 17.0 + (an.x > 0.5 ? 31.0 : 0.0));
          float on = step(r, lit) * win * step(1.5, vLoc.y) ;
          vec3 wc = mix(vec3(1.0,0.66,0.32), vec3(0.7,0.82,1.0), step(0.8, hsh(cell * 1.7 + seed)));
          emis = wc * wc * on * (0.35 + 0.5 * hsh(cell + 5.3)) * uWin;
          // far away: replace the window pattern by its average so it doesn't shimmer
          float fw = max(length(fwidth(uv / vec2(cw, fh))), 1e-4);
          float detail = smoothstep(0.9, 0.35, fw);
          emis = mix(vec3(1.0,0.62,0.32) * lit * 0.32 * 0.6 * uWin, emis, detail);
          win = mix(0.5, win, detail);
          vec3 glassCol = mix(base, vec3(0.06,0.08,0.11), win * 0.7);
          col = glassCol * light(n, vW);
          // reflection-ish sheen of the sky / glow on glass
          col += win * 0.25 * mix(uSky, uFogCol, 0.5) * (kind > 0.5 ? 1.0 : 0.3);
          // fade in darker ground floors
          col *= 0.75 + 0.25 * smoothstep(0.0, 30.0, vLoc.y);
        }
        // damage: soot + broken windows, then burning embers
        col = mix(col, col * 0.12, dmg); emis *= (1.0 - dmg);
        float fire = heat > 0.001 ? heat * smoothstep(0.2, 0.7, fbm3(vW * 0.03 + vec3(0.0, -uTime * 0.8, 0.0)) + 0.35) : 0.0;
        emis += vec3(3.0, 0.9, 0.2) * fire;
        vec3 c = fogit(col + emis, vW);
        gl_FragColor = vec4(c, 1.0);
#ifdef DBG
        { vec2 uv2 = an.x > 0.5 ? vec2(vLoc.z, vLoc.y) : vec2(vLoc.x, vLoc.y); vec2 cl = floor(uv2 / vec2(3.0, 3.4)); gl_FragColor = vec4(fract(cl.x/7.0), fract(cl.y/5.0), an.x, 1.0); }
#endif
      }`,
  });
}

export function makeCity(U, { seed = 11, radius = 16000, density = 1 } = {}) {
  const R = rng(seed), items = [];
  const block = 110, street = 26;
  for (let gx = -radius; gx < radius; gx += block) {
    for (let gz = -radius; gz < radius; gz += block) {
      const cx = gx + block / 2, cz = gz + block / 2, d = Math.hypot(cx, cz);
      if (d > radius || cz > coastAt(cx) - 120) continue;
      if (Math.abs(cx - 440) < 60 && cz > -4000 && cz < 3000) continue;   // the boulevard of the opening shot
      const pDown = Math.exp(-Math.pow(d / 1300, 2)), pMid = Math.exp(-Math.pow(d / 4200, 2));
      const occ = d < 6000 ? 1 : clamp(1 - (d - 6000) / 11000) * 0.75 + 0.1;
      if (R() > occ * density) continue;
      // split block into 1-4 lots
      const n = d < 2500 ? (R() < 0.5 ? 1 : 2) : 1 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) {
        const w = (block - street) / (n > 1 ? 2 : 1) * (0.7 + R() * 0.28);
        const dd = (block - street) * (0.6 + R() * 0.4);
        const ox = n > 1 ? ((k % 2) - 0.5) * (block - street) / 2 : 0, oz = n > 2 ? (Math.floor(k / 2) - 0.5) * (block - street) / 2 : 0;
        let h;
        const r = R();
        if (r < pDown * 0.9) h = 120 + Math.pow(R(), 1.5) * 330;
        else if (r < pMid) h = 25 + R() * 90;
        else h = 6 + R() * 18;
        const kind = h > 110 ? 1 : 0;
        items.push({ x: cx + ox, z: cz + oz, w: n > 1 ? w : w * 1.0, dz: n > 2 ? dd / 2 : dd, h, kind, seed: R() * 100, lit: kind ? 0.18 + R() * 0.3 : 0.15 + R() * 0.3, d });
      }
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const N = items.length;
  const mesh = new THREE.InstancedMesh(geo, buildingMaterial(U), N);
  const info = new Float32Array(N * 4), state = new Float32Array(N * 4);
  items.forEach((b, i) => { info.set([b.seed, b.kind, b.h, b.lit], i * 4); });
  geo.setAttribute('iInfo', new THREE.InstancedBufferAttribute(info, 4));
  const st = new THREE.InstancedBufferAttribute(state, 4); st.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('iState', st);
  mesh.frustumCulled = false;
  const city = { mesh, items, state: st };
  setCityDamage(city, null);
  return city;
}

// Destruction as a pure function of the blast state: shock radius rs (m), vapor radius rv, time since shock passed.
const _o = new THREE.Object3D(), _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
export function setCityDamage(city, blast) {
  const { mesh, items, state } = city, S = state.array;
  for (let i = 0; i < items.length; i++) {
    const b = items[i];
    let tilt = 0, sink = 0, push = 0, dmg = 0, heat = 0, gone = false;
    if (blast) {
      const { rs, rv, heatR, strength = 1 } = blast;
      if (b.d < rv) gone = true;
      if (heatR && b.d < heatR) { dmg = Math.max(dmg, clamp(1 - b.d / heatR) * 0.8 + 0.2); heat = clamp((heatR - b.d) / 2500) * 0.9; }
      if (b.d < rs) {
        const since = (rs - b.d) / 900;                  // "time" after the front passed, in metres of front travel
        const sev = clamp(1.25 - b.d / 22000) * strength;
        const k = clamp(since / 0.9);
        const hs = clamp((b.h - 10) / 200);
        tilt = sev * (0.25 + 1.2 * hs) * sstep(0, 1, k) * (0.6 + 0.4 * Math.sin(b.seed * 3.1));
        sink = sev * sstep(0, 1, k) * (0.45 + 0.4 * (b.seed % 1));
        push = sev * k * 25 * (1 + hs);
        dmg = Math.max(dmg, sev * sstep(0, 0.4, k));
        heat = Math.max(heat, 0.25 * sev * (1 - k * 0.5) * ((b.seed * 7) % 1 > 0.6 ? 1 : 0));
      }
    }
    const ux = b.x / (b.d || 1), uz = b.z / (b.d || 1);
    _o.position.set(b.x + ux * push, 0, b.z + uz * push);
    _ax.set(uz, 0, -ux);                                     // tilt away from the impact
    _o.quaternion.setFromAxisAngle(_ax, Math.min(tilt, 1.45));
    const hy = gone ? 0.001 : b.h * (1 - Math.min(sink, 0.92));
    _o.scale.set(gone ? 0.001 : b.w, hy, gone ? 0.001 : b.dz);
    _o.updateMatrix(); mesh.setMatrixAt(i, _o.matrix);
    S[i * 4] = dmg; S[i * 4 + 1] = heat;
  }
  mesh.instanceMatrix.needsUpdate = true; state.needsUpdate = true;
}

export function makeGround(U, { size = 120000, crater = false } = {}) {
  const g = new THREE.PlaneGeometry(size, size, crater ? 400 : 1, crater ? 400 : 1); g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uCrater: { value: crater ? 1 : 0 }, uCraterR: { value: 7500 }, uScorch: { value: 0 }, uScorchR: { value: 0 }, uLights: { value: 1 } },
    vertexShader: /* glsl */`
      uniform float uCrater, uCraterR; varying vec3 vW; varying float vBowl;
      ${GLSL_NOISE}
      void main(){
        vec3 p = position; vBowl = 0.0;
        if (uCrater > 0.5) {
          float r = length(p.xz) / uCraterR;
          float n = fbm3(vec3(p.xz * 0.0006, 1.0));
          float rr = r + n * 0.06;
          float bowl = rr < 1.0 ? -2200.0 * (1.0 - rr * rr) * (1.0 - 0.3 * smoothstep(0.0, 0.35, 0.35 - rr)) : 0.0;
          float rim = 700.0 * exp(-pow((rr - 1.0) / 0.10, 2.0)) + 260.0 * exp(-pow((rr - 1.25) / 0.35, 2.0)) * (0.6 + n);
          float peak = 500.0 * exp(-pow(rr / 0.12, 2.0));
          p.y = bowl + rim + peak + n * 60.0 * smoothstep(0.8, 1.6, rr);
          vBowl = clamp(1.0 - rr, 0.0, 1.0);
        }
        vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      ${LIGHT_GLSL}
      ${GLSL_NOISE}
      uniform float uCrater, uScorch, uScorchR, uLights; varying vec3 vW; varying float vBowl;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.0) n = -n;
        float d = length(vW.xz);
        float nz = fbm3(vec3(vW.xz * 0.0015, 2.0));
        vec3 base = mix(vec3(0.05,0.05,0.055), vec3(0.09,0.085,0.07), 0.5 + 0.5 * nz);
        base = mix(base, vec3(0.05,0.07,0.04), smoothstep(5000.0, 12000.0, d) * 0.7);
        vec3 col = base * light(n, vW);
        vec3 emis = vec3(0.0);
        // street grid + lights
        float cityMask = (1.0 - smoothstep(9000.0, 17000.0, d)) * uLights;
        vec2 g = abs(fract(vW.xz / 110.0 + 0.5) - 0.5) * 110.0;
        float road = 1.0 - smoothstep(9.0, 13.0, min(g.x, g.y));
        col = mix(col, vec3(0.03,0.03,0.035) * light(n, vW), road * cityMask);
        vec2 lp = abs(fract(vW.xz / 36.0) - 0.5) * 36.0;
        float lamp = road * smoothstep(3.0, 0.5, max(lp.x, lp.y) < 18.0 ? min(lp.x, lp.y) : 99.0);
        float gd = smoothstep(0.35, 0.1, length(fwidth(vW.xz / 110.0)));
        lamp = mix(0.035, lamp, gd); road = mix(0.2, road, gd);
        emis += vec3(1.0, 0.62, 0.3) * lamp * cityMask * 1.2 * (0.6 + 0.4 * hsh(floor(vW.xz / 36.0)));
        emis += vec3(1.0, 0.55, 0.25) * road * cityMask * 0.08;
        // scorch + glowing crater floor
        if (uScorchR > 0.0) {
          float s = (1.0 - smoothstep(uScorchR * 0.6, uScorchR, d + nz * 1500.0)) * uScorch;
          col = mix(col, col * 0.15, s); emis *= (1.0 - s);
          float burn = s > 0.001 ? s * smoothstep(0.25, 0.65, fbm3(vec3(vW.xz * 0.004, uTime * 0.2))) : 0.0;
          emis += vec3(2.2, 0.5, 0.08) * burn * 0.6;
        }
        if (uCrater > 0.5) {
          float melt = smoothstep(0.05, 0.6, vBowl);
          float cr = fbm(vec3(vW.xz * 0.002, uTime * 0.05));
          vec3 lava = mix(vec3(1.6,0.25,0.03), vec3(4.0,1.7,0.4), smoothstep(0.1, 0.6, cr));
          float cracks = smoothstep(0.02, 0.0, abs(cr - 0.05)) + smoothstep(0.35, 0.8, cr);
          col = mix(col, vec3(0.02,0.015,0.012), smoothstep(0.0, 0.2, vBowl));
          emis += lava * melt * clamp(cracks, 0.0, 1.0) * 1.3 + vec3(1.1,0.22,0.03) * melt * (0.55 + 0.45 * vBowl);
          float rimGlow = exp(-pow((1.0 - vBowl) * 9.0, 2.0)) * step(0.001, vBowl);
          emis += vec3(1.8, 0.5, 0.08) * rimGlow * 0.6;
          emis *= 1.0;
        }
        gl_FragColor = vec4(fogit(col + emis, vW), 1.0);
      }`,
    extensions: { derivatives: true },
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
  return m;
}

export function makeWater(U) {
  const g = new THREE.PlaneGeometry(200000, 200000); g.rotateX(-Math.PI / 2); g.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uGlowDir: { value: new THREE.Vector3(0, 0.2, -1).normalize() }, uGlowCol: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      ${LIGHT_GLSL}
      ${GLSL_NOISE}
      uniform vec3 uGlowDir, uGlowCol; varying vec3 vW;
      float coast(float x){ return ${COAST_Z.toFixed(1)} + 500.0*sin(x/2300.0) + 260.0*sin(x/830.0+1.3); }
      void main(){
        if (vW.z < coast(vW.x)) discard;
        vec3 V = normalize(cameraPosition - vW);
        float w1 = fbm3(vec3(vW.xz * vec2(0.004, 0.012), uTime * 0.25));
        float w2 = fbm3(vec3(vW.xz * vec2(0.02, 0.06), uTime * 0.6));
        vec3 n = normalize(vec3(w1 * 0.08 + w2 * 0.05, 1.0, w2 * 0.12 + w1 * 0.06));
        vec3 Rf = reflect(-V, n);
        float fr = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 skyc = mix(uFogCol, uSky * 1.4, clamp(Rf.y * 3.0, 0.0, 1.0));
        vec3 c = vec3(0.01, 0.02, 0.03) + skyc * fr;
        float gl = pow(max(dot(Rf, normalize(uGlowDir)), 0.0), 60.0) * 3.0 + pow(max(dot(Rf, normalize(uGlowDir)), 0.0), 8.0) * 0.3;
        c += uGlowCol * gl;
        float sg = pow(max(dot(Rf, uSunDir), 0.0), 40.0);
        c += uSunCol * sg * 0.6;
        // city light reflections streaks toward camera
        gl_FragColor = vec4(fogit(c, vW), 1.0);
      }`,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
  return m;
}

export function makeSky(U) {
  const g = new THREE.SphereGeometry(400000, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { ...U, uZen: { value: new THREE.Color(0.02, 0.035, 0.09) }, uHor: { value: new THREE.Color(0.55, 0.28, 0.25) }, uMid: { value: new THREE.Color(0.1, 0.07, 0.14) },
      uGlowDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() }, uGlowCol: { value: new THREE.Color(0, 0, 0) }, uGlowPow: { value: 6 },
      uStars: { value: 0.6 }, uRed: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      ${GLSL_NOISE}
      uniform vec3 uZen, uHor, uMid, uSunDir, uSunCol, uGlowDir, uGlowCol; uniform float uGlowPow, uStars, uRed, uTime; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.22, h));
        c = mix(c, uZen, smoothstep(0.12, 0.75, h));
        c = mix(c, uHor * 0.4, smoothstep(0.0, -0.15, d.y));
        float sd = max(dot(d, uSunDir), 0.0);
        c += uSunCol * (pow(sd, 6.0) * 0.5 + pow(sd, 60.0) * 0.6) * smoothstep(-0.1, 0.1, d.y + 0.08);
        float gd = max(dot(d, normalize(uGlowDir)), 0.0);
        c += uGlowCol * (pow(gd, uGlowPow) + 0.04 * pow(gd, 3.0));
        // thin clouds
        vec2 cp = d.xz / max(d.y + 0.08, 0.02);
        float cl = smoothstep(0.1, 0.6, fbm3(vec3(cp * 0.6, 3.0))) * smoothstep(0.0, 0.25, d.y);
        c = mix(c, c * 0.55 + uHor * 0.08 * smoothstep(0.5, 0.0, d.y) + uGlowCol * 0.12 * pow(gd, 3.0), cl * 0.6);
        // stars
        vec3 sp = floor(d * 900.0); float st = fract(sin(dot(sp, vec3(12.9898,78.233,45.164))) * 43758.5453);
        c += vec3(1.0) * step(0.9975, st) * uStars * smoothstep(0.15, 0.6, d.y) * (0.5 + 0.5 * fract(st * 91.0));
        c = mix(c, vec3(0.5, 0.12, 0.04) * (0.6 + 0.4 * fbm3(vec3(cp * 0.3, uTime * 0.1))), uRed);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = -1;
  return m;
}
