// Space pieces: Earth (procedural continents, clouds, night lights, atmosphere, spreading dust veil), starfield,
// sun, orbit lines and a DART-like spacecraft.
import * as THREE from 'three';
import { GLSL_NOISE, rng } from './util.js';

export function makeStars(n = 6000, R = 1e6, seed = 3) {
  const r = rng(seed), p = new Float32Array(n * 3), c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * 6.283, s = Math.sqrt(1 - u * u);
    p.set([Math.cos(a) * s * R, u * R, Math.sin(a) * s * R], i * 3);
    const b = Math.pow(r(), 6) * 2.2 + 0.08, w = r();
    c.set([b * (0.8 + 0.2 * w), b * 0.9, b * (1.0 - 0.2 * w + 0.15)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const m = new THREE.ShaderMaterial({
    vertexColors: true, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    uniforms: { uK: { value: 1 } },
    vertexShader: `varying vec3 vC; uniform float uK; void main(){ vC = color * uK; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p; gl_PointSize = 2.2 + 2.0 * min(1.0, length(color)); }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vC * a, 1.0); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -2;
  return pts;
}

// Earth with radius R (scene units). The impact site is at local direction SITE (unit vector).
export const SITE = new THREE.Vector3(0.38, 0.52, 0.76).normalize();
export function makeEarth(R = 6371) {
  const grp = new THREE.Group();
  const geo = new THREE.SphereGeometry(R, 160, 100);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCloud: { value: 1 }, uSunK: { value: 1 }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uSite: { value: SITE.clone() }, uDust: { value: 0 }, uDustCol: { value: new THREE.Color(0.32, 0.22, 0.16) },
      uTime: { value: 0 }, uLights: { value: 1 }, uScorch: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vW; void main(){ vP = normalize(position); vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      ${GLSL_NOISE}
      uniform vec3 uSun, uSite, uDustCol; uniform float uCloud, uSunK, uDust, uTime, uLights, uScorch; varying vec3 vN; varying vec3 vP; varying vec3 vW;
      void main(){
        vec3 n = normalize(vN); vec3 p = vP;
        float c = fbm(p * 2.2 + 1.3) + 0.45 * fbm(p * 6.0 + 7.0) * 0.5;
        float land = smoothstep(0.02, 0.06, c);
        float lat = abs(p.y);
        vec3 ocean = mix(vec3(0.01,0.04,0.11), vec3(0.02,0.09,0.18), smoothstep(-0.3, 0.02, c));
        vec3 grn = mix(vec3(0.06,0.11,0.04), vec3(0.22,0.18,0.10), smoothstep(0.1, 0.5, fbm(p * 5.0 + 3.0) + 0.3 - lat * 0.3));
        vec3 col = mix(ocean, grn, land);
        col = mix(col, vec3(0.8,0.85,0.9), smoothstep(0.78, 0.88, lat + 0.05 * fbm(p * 8.0)));
        float cl = smoothstep(0.12, 0.5, fbm(p * 3.2 + vec3(uTime * 0.01, 0.0, 0.0)) + 0.15 * fbm(p * 12.0)) * uCloud;
        float dl = dot(n, uSun);
        float day = smoothstep(-0.12, 0.25, dl);
        vec3 lit = col * max(dl, 0.0) * 1.6 * uSunK;
        lit = mix(lit, vec3(0.95) * max(dl, 0.0) * 1.5 * uSunK, cl * 0.85);
        // sunset band
        lit += vec3(0.5, 0.18, 0.05) * smoothstep(0.25, 0.0, abs(dl)) * 0.25 * (0.4 + cl);
        // night lights
        float cityN = smoothstep(0.35, 0.75, fbm(p * 22.0 + 5.0)) * land * (1.0 - cl * 0.7);
        vec3 night = vec3(1.0, 0.6, 0.25) * cityN * 0.9 * uLights * (1.0 - day);
        // impact dust veil spreading from the site
        float ang = acos(clamp(dot(p, uSite), -1.0, 1.0));
        float edge = uDust * 3.2 + 0.18 * fbm(p * 5.0 + uTime * 0.05);
        float veil = smoothstep(edge, edge - 0.35, ang) * smoothstep(0.0, 0.05, uDust);
        float swirl = 0.6 + 0.4 * fbm(p * 9.0 + vec3(0.0, uTime * 0.03, 0.0));
        vec3 dustLit = uDustCol * (max(dl, 0.0) * 1.2 + 0.03) * swirl;
        vec3 outc = lit + night;
        outc = mix(outc, dustLit, veil * 0.92);
        // glowing scar at the site
        float scar = smoothstep(0.05, 0.0, ang) * uScorch;
        outc += vec3(2.5, 0.6, 0.1) * scar;
        gl_FragColor = vec4(outc, 1.0);
      }`,
  });
  const earth = new THREE.Mesh(geo, mat); grp.add(earth);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.025, 96, 64), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    uniforms: { uSun: mat.uniforms.uSun, uDust: mat.uniforms.uDust },
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uSun; uniform float uDust; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - abs(dot(normalize(vN), V)), 2.5);
        float s = smoothstep(-0.3, 0.4, dot(-normalize(vN), uSun));
        vec3 c = mix(vec3(0.25,0.5,1.2), vec3(0.6,0.4,0.25), uDust) * rim * s * 1.6;
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  grp.add(atm);
  grp.userData = { mat, earth, atm };
  return grp;
}

// glowing ellipse orbit line (a, e, inclination, node, periapsis) in the XZ plane
export function orbitLine(a, e = 0, inc = 0, node = 0, peri = 0, color = 0x66ccff, n = 256, opacity = 1) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const E = (i / n) * Math.PI * 2;
    const x = a * (Math.cos(E) - e), z = a * Math.sqrt(1 - e * e) * Math.sin(E);
    pts.push(new THREE.Vector3(x, 0, z));
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const l = new THREE.Line(g, m);
  l.rotation.order = 'YXZ'; l.rotation.set(inc, node, 0); l.rotateY(peri);
  return l;
}
export function orbitPos(a, e, E, out) { return out.set(a * (Math.cos(E) - e), 0, a * Math.sqrt(1 - e * e) * Math.sin(E)); }

export function makeSpacecraft() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.9), new THREE.MeshStandardMaterial({ color: 0xc9b26a, metalness: 0.6, roughness: 0.35 }));
  g.add(body);
  const foil = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.5, 1.6), new THREE.MeshStandardMaterial({ color: 0xe0c060, metalness: 0.9, roughness: 0.25 }));
  foil.position.y = -0.4; g.add(foil);
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1a2a6a, metalness: 0.4, roughness: 0.3, emissive: 0x050a20 });
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2), new THREE.MeshStandardMaterial({ color: 0x999999 }));
    arm.rotation.z = Math.PI / 2; arm.position.x = s * 1.1; g.add(arm);
    const p = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.05, 1.6), panelMat); p.position.x = s * 5.0; g.add(p);
    const grid = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.06, 0.04), new THREE.MeshStandardMaterial({ color: 0x8899bb })); grid.position.x = s * 5.0; g.add(grid);
  }
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 24), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.3, roughness: 0.5 }));
  dish.rotation.x = Math.PI / 2; dish.position.z = -1.0; g.add(dish);
  const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  cam.rotation.x = Math.PI / 2; cam.position.z = 1.1; g.add(cam);
  return g;
}
