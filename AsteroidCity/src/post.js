// Post chain: render -> bloom -> tone map (ACES) -> grade (flash, vignette, chromatic fringe, grain, letter fade).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const Grade = {
  uniforms: { tDiffuse: { value: null }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 0.97, 0.9) }, uVig: { value: 0.35 },
    uCA: { value: 0.0015 }, uGrain: { value: 0.05 }, uSeed: { value: 0 }, uFade: { value: 0 }, uSat: { value: 1.0 }, uContrast: { value: 1.05 },
    uTint: { value: new THREE.Color(1, 1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uFlash, uVig, uCA, uGrain, uSeed, uFade, uSat, uContrast; uniform vec3 uFlashCol, uTint; varying vec2 vUv;
    float hsh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uSeed) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c, c);
      vec2 off = c * uCA * (1.0 + 4.0 * r2);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5;
      col *= uTint;
      col *= 1.0 - uVig * smoothstep(0.08, 0.55, r2 * 1.6);
      col += (hsh(vUv * 1000.0) - 0.5) * uGrain;
      col = mix(col, uFlashCol, clamp(uFlash, 0.0, 1.0));
      col *= 1.0 - uFade;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export function makePost(renderer, W, H) {
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
  const rp = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.8, 0.6, 0.85);
  const out = new OutputPass();
  const grade = new ShaderPass(Grade);
  composer.addPass(rp); composer.addPass(bloom); composer.addPass(out); composer.addPass(grade);
  return { composer, rp, bloom, grade: grade.uniforms };
}
