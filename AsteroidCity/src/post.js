// Post chain: render -> bloom -> tone map (ACES) -> grade (flash, vignette, chromatic fringe, grain, letter fade).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { PARTICLE_LAYER } from './particles.js';

// Scene pass with low-res particles: opaque scene at full res; smoke/fire particles drawn into a half-res buffer
// (depth-tested against a half-res copy of the scene) and composited on top as premultiplied colour + coverage.
// Particles are soft, so this looks the same but cuts their fill cost (the bottleneck in software WebGL) by 4x.
class SplitScenePass extends Pass {
  constructor(W, H) {
    super();
    this.scene = null; this.camera = null; this.needsSwap = false;
    this.half = new THREE.WebGLRenderTarget(Math.round(W / 2), Math.round(H / 2), { type: THREE.HalfFloatType, depthBuffer: true });
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tP: { value: this.half.texture } }, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tP; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tP, vUv); }',
    }));
    this.full = !!(new URLSearchParams(location.search).has('fullparticles'));
  }
  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera, sc = this.scene, oldC = renderer.getClearColor(new THREE.Color()), oldA = renderer.getClearAlpha();
    const ac = renderer.autoClear; renderer.autoClear = false;    // keep the half-res depth between the two renders
    renderer.setRenderTarget(readBuffer); renderer.clear();
    if (this.full) { cam.layers.enableAll(); renderer.render(sc, cam); cam.layers.set(0); renderer.autoClear = ac; return; }
    cam.layers.set(0); renderer.render(sc, cam);
    // half-res: scene for depth, then wipe colour to transparent and draw only the particles
    renderer.setRenderTarget(this.half); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(sc, cam);
    renderer.clear(true, false, false);
    cam.layers.set(PARTICLE_LAYER); renderer.render(sc, cam); cam.layers.set(0);
    renderer.setClearColor(oldC, oldA);
    renderer.setRenderTarget(readBuffer); this.quad.render(renderer);
    renderer.autoClear = ac;
  }
}

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
  const rp = new SplitScenePass(W, H);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.8, 0.6, 0.85);
  const out = new OutputPass();
  const grade = new ShaderPass(Grade);
  composer.addPass(rp); composer.addPass(bloom); composer.addPass(out); composer.addPass(grade);
  return { composer, rp, bloom, grade: grade.uniforms };
}
