// Entry: renderer + post chain + shot timeline. window.renderFrame(t) renders the frame at global time t (s).
import * as THREE from 'three';
import { makePost } from './post.js';
import { buildShots } from './shots.js';
import { LAYOUT } from './layout.js';

const params0 = new URLSearchParams(location.search);
const W = params0.has('half') ? 540 : 1080, H = params0.has('half') ? 960 : 1920;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);
const post = makePost(renderer, W, H);

const shots = buildShots({ W, H, renderer, LAYOUT });
const params = new URLSearchParams(location.search);
const only = params.get('shot');

window.DURATION = LAYOUT.total;
window.SHOTS = shots.map((s) => ({ name: s.name, t0: s.t0, t1: s.t1 }));
window.renderFrame = (t) => {
  let s = shots.find((x) => t >= x.t0 && t < x.t1) || shots[shots.length - 1];
  if (only) s = shots.find((x) => x.name === only);
  const lt = t - s.t0;
  const g = post.grade;
  // defaults; shots override
  const look = { exposure: 1, bloom: 0.8, bloomR: 0.6, bloomT: 0.85, flash: 0, vig: 0.35, ca: 0.0015, grain: 0.045, fade: 0, sat: 1, contrast: 1.05, tint: [1, 1, 1], flashCol: [1, 0.97, 0.9] };
  s.update(lt, t, look);
  if (params.has('nobloom')) look.bloom = 0;
  if (params.has('nocity')) s.scene.traverse((o) => { if (o.isInstancedMesh) o.visible = false; });
  if (params.has('nofx')) s.scene.traverse((o) => { if (o.geometry && o.geometry.isInstancedBufferGeometry) o.visible = false; });
  renderer.toneMappingExposure = look.exposure;
  post.bloom.strength = look.bloom; post.bloom.radius = look.bloomR; post.bloom.threshold = look.bloomT;
  g.uFlash.value = look.flash; g.uVig.value = look.vig; g.uCA.value = look.ca; g.uGrain.value = look.grain; g.uFade.value = look.fade;
  g.uSat.value = look.sat; g.uContrast.value = look.contrast; g.uTint.value.setRGB(...look.tint); g.uFlashCol.value.setRGB(...look.flashCol);
  g.uSeed.value = (Math.round(t * 30) % 977) * 0.731;
  post.rp.scene = s.scene; post.rp.camera = s.camera;
  post.composer.render();
  return renderer.domElement.toDataURL('image/jpeg', 0.93);
};
window.__ready = true;
