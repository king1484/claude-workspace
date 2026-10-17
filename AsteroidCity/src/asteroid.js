// The asteroid: a lumpy cratered rock (unit radius) whose leading face heats up white-hot during entry.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, rng, GLSL_NOISE } from './util.js';

let GEO = null;
export function asteroidGeometry() {
  if (GEO) return GEO;
  let g = new THREE.IcosahedronGeometry(1, 48);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const R = rng(7), craters = [];
  for (let i = 0; i < 26; i++) {
    const v = new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize();
    craters.push({ v, r: 0.08 + Math.pow(R(), 2) * 0.35, d: 0.04 + R() * 0.07 });
  }
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let r = 1 + 0.28 * fbm(v.x * 1.1 + 3, v.y * 1.1, v.z * 1.1, 3) + 0.06 * fbm(v.x * 5, v.y * 5, v.z * 5 + 9, 4);
    for (const c of craters) {
      const a = v.angleTo(c.v) / c.r;
      if (a < 1.4) r += a < 1 ? -c.d * (1 - a * a) : c.d * 0.6 * Math.sin((a - 1) / 0.4 * Math.PI) * (1.4 - a) / 0.4;
    }
    p.setXYZ(i, v.x * r * 1.22, v.y * r * 0.94, v.z * r * 0.88);
  }
  g.computeVertexNormals();
  GEO = g;
  return g;
}

export function asteroidMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: new THREE.Vector3(1, 0.4, 0.3).normalize() }, uSunCol: { value: new THREE.Color(1.6, 1.45, 1.3) },
      uAmb: { value: new THREE.Color(0.05, 0.05, 0.07) }, uHeat: { value: 0 }, uFront: { value: new THREE.Vector3(0, -1, 0) },
      uRim: { value: new THREE.Color(0, 0, 0) }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vObj; varying vec3 vW;
      void main(){ vObj = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun, uSunCol, uAmb, uFront, uRim; uniform float uHeat, uTime;
      varying vec3 vN; varying vec3 vObj; varying vec3 vW;
      ${GLSL_NOISE}
      void main(){
        vec3 n = normalize(vN);
        float tex = fbm(vObj * 4.0);
        float spec = fbm(vObj * 18.0);
        vec3 albedo = mix(vec3(0.16,0.14,0.12), vec3(0.34,0.30,0.26), 0.5 + 0.5 * tex) * (0.85 + 0.3 * spec);
        float dl = max(dot(n, uSun), 0.0);
        vec3 col = albedo * (uAmb + uSunCol * dl);
        vec3 V = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        col += uRim * fr;
        // entry heating: leading face glows, cracks glow
        float f = max(dot(n, uFront), 0.0);
        float hot = uHeat * (pow(f, 1.3) + 0.25 * smoothstep(0.15, 0.4, fbm(vObj * 6.0 + uTime * 0.3)) * smoothstep(-0.3, 0.6, dot(n, uFront)));
        vec3 heatCol = mix(vec3(0.9,0.18,0.02), mix(vec3(1.8,0.75,0.2), vec3(3.0,2.3,1.6), smoothstep(0.7,1.2,hot)), smoothstep(0.2,0.7,hot));
        col = mix(col, heatCol, smoothstep(0.05, 0.6, hot));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function makeAsteroid() {
  const m = new THREE.Mesh(asteroidGeometry(), asteroidMaterial());
  return m;
}
