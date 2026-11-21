// Strikeline client: menus + lobbies, rendering, input, local player, weapons, networking, HUD.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildMap, MAPS, MAP_ORDER } from '/shared/maps.js';
import { WEAPONS, PRIMARIES, SECONDARIES, CLASS_NAMES, LETHALS, TACTICALS, THROWABLE_KINDS, falloffMult, recoilStep } from '/shared/weapons.js';
import { moveBody, canStand, raycastBoxes, PLAYER } from '/shared/physics.js';
import { THEMES, getMaterial, MAT_COLORS, WEAPON_SKINS, CHAR_SKINS, RARITY_COLORS, charSkin, radialSprite, flashSprite, decalTexture, nameTagTexture } from './textures.js';
import { buildGun, buildWeapon, buildArms, buildSoldier, buildRocket, setReticle, RETICLE_STYLES, RETICLE_COLORS } from './models.js';
import * as SFX from './audio.js';
import * as Announcer from './announcer.js';
import { MODES, MODE_ORDER, TEAM_NAMES, TEAM_COLORS, GUNGAME_LADDER, targetScore, teamName, teamColor, POWER_TIME } from '/shared/modes.js';
import * as PR from './progress.js';
import { PERKS, STREAKS, STREAK_IDS, DEFAULT_PERKS, DEFAULT_STREAKS, cleanPerks, cleanStreaks, streakCost, perkInfo } from '/shared/loadout.js';

const $ = id => document.getElementById(id);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ================================================================ settings
const DEFAULTS = { name: 'Operator' + Math.floor(Math.random() * 900 + 100), primary: 'falcon', secondary: 'viper', wskin: 'factory', cskin: 'ranger', sens: 1, fov: 85, vol: 0.6, gfx: 'high', invert: false,
  lethal: 'frag', tactical: 'smoke', reticle: 'dot', reticleColor: 'red', xh: 'lines', xhColor: 'white' };
let cfg = { ...DEFAULTS };
try { Object.assign(cfg, JSON.parse(PR.store.get('strikeline') || '{}')); } catch {}
if (!WEAPONS[cfg.primary] || WEAPONS[cfg.primary].slot !== 'primary') cfg.primary = 'falcon';
if (!WEAPONS[cfg.secondary] || WEAPONS[cfg.secondary].slot !== 'secondary') cfg.secondary = 'viper';
if (!LETHALS.includes(cfg.lethal)) cfg.lethal = 'frag';
cfg.perks = cleanPerks(cfg.perks); cfg.streaks = cleanStreaks(cfg.streaks);
if (cfg.announcer === undefined) cfg.announcer = true;
Announcer.setEnabled(cfg.announcer); Announcer.setVolume(Math.min(1, cfg.vol * 1.4));
if (!TACTICALS.includes(cfg.tactical)) cfg.tactical = 'smoke';
setReticle(cfg.reticle, cfg.reticleColor);
const saveCfg = () => PR.store.set('strikeline', JSON.stringify(cfg));
// camo for one gun (falls back to the default finish from the Skins screen) and its attachments' camo
const gunSkin = wid => (cfg.wcamo && cfg.wcamo[wid] && PR.isUnlocked('ws:' + cfg.wcamo[wid]) ? cfg.wcamo[wid] : cfg.wskin);
const attSkinFor = wid => { const a = cfg.acamo && cfg.acamo[wid]; return a && (a === 'black' || a === 'match' || PR.isUnlocked('ws:' + a)) ? a : 'black'; };
let pvCamo = null, pvAttCamo = null, pvGun = null; // temporary preview (hovering a camo, buy pop-up)

// ================================================================ renderer / scenes
if (!['low', 'high', 'ultra'].includes(cfg.gfx)) cfg.gfx = 'high';
// Ultra uses screen-space ambient occlusion, which needs a normal depth buffer (not logarithmic), so the
// renderer is created in that mode at start-up; switching in or out of Ultra applies on the next launch.
const ULTRA = cfg.gfx === 'ultra';
const gfxPixelRatio = () => Math.min(devicePixelRatio, cfg.gfx === 'ultra' ? 1.5 : cfg.gfx === 'high' ? 1.5 : 1);
const renderer = new THREE.WebGLRenderer({ antialias: !ULTRA, powerPreference: 'high-performance', logarithmicDepthBuffer: !ULTRA });
renderer.setPixelRatio(gfxPixelRatio());
renderer.setSize(innerWidth, innerHeight);
// If the graphics driver resets (weak/overloaded GPUs), reload instead of sitting on a frozen screen.
renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); try { reportErr(`WebGL context lost (graphics driver reset / out of GPU memory) · ${renderer.info.memory.geometries} geos ${renderer.info.memory.textures} tex`); } catch {} setTimeout(safeReload, 1200); });
// Reload, but only if this game's address still answers: in a friend's game whose tunnel has gone, a reload
// would land on Cloudflare's "Error 1033" page, so go back to our own game instead.
function safeReload() {
  fetch('/info', { cache: 'no-store', signal: AbortSignal.timeout(5000) }).then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(() => location.reload())
    .catch(() => { let h = location.origin; try { h = sessionStorage.getItem('slHome') || h; } catch {} location.href = h === location.origin ? location.origin + '/' : h + '/'; });
}
// Shadows have their own setting (Off / Low / Medium / High), separate from the graphics preset.
const SHADOW_Q = ['off', 'low', 'medium', 'high'];
if (!SHADOW_Q.includes(cfg.shadows)) cfg.shadows = cfg.gfx === 'low' ? 'off' : cfg.gfx === 'ultra' ? 'high' : 'medium';
const shadowMapSize = big => Math.min(4096, ({ low: 1024, medium: 2048, high: 4096 }[cfg.shadows] || 2048) * (big ? 2 : 1));
let sunLight = null, shadowFrame = 0, sunBig = false;
renderer.shadowMap.enabled = cfg.shadows !== 'off';
renderer.shadowMap.type = cfg.shadows === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
// the shadow map is redrawn every other frame instead of every frame (the whole map is drawn into it each time)
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Ultra has no logarithmic depth buffer, so its near plane sits further out for more depth precision (less flicker)
const camera = new THREE.PerspectiveCamera(cfg.fov, innerWidth / innerHeight, ULTRA ? 0.2 : 0.05, 900);
camera.rotation.order = 'YXZ';
scene.add(camera);
const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.01, 10);
const vmHemi = new THREE.HemisphereLight('#ffffff', '#444444', 1.3); vmScene.add(vmHemi);
const vmSun = new THREE.DirectionalLight('#ffffff', 2.2); vmSun.position.set(0.6, 1, 0.4); vmScene.add(vmSun);
const vmFill = new THREE.DirectionalLight('#88aaff', 0.6); vmFill.position.set(-1, 0.2, 0.5); vmScene.add(vmFill);
const vmHolder = new THREE.Group(); vmScene.add(vmHolder);
const envTex = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
vmScene.environment = envTex;

// ---- Ultra graphics: ambient occlusion (soft contact shadows in corners and under objects), bloom on
// bright lights, and a light colour grade + vignette. Loaded only when Ultra is on.
let post = null;
async function setupPost() {
  const base = 'three/addons/postprocessing/';
  const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { UnrealBloomPass }, { OutputPass }, { ShaderPass }] = await Promise.all(
    ['EffectComposer', 'RenderPass', 'GTAOPass', 'UnrealBloomPass', 'OutputPass', 'ShaderPass'].map(n => import(base + n + '.js')));
  const w = innerWidth, h = innerHeight;
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, w, h);
  ao.output = GTAOPass.OUTPUT.Default;
  ao.blendIntensity = 1.0;
  ao.updateGtaoMaterial({ radius: 2.5, distanceExponent: 1.5, thickness: 6, scale: 2.2, samples: 8, distanceFallOff: 1.0 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
  // sky, particles, sprites and see-through effects don't cast occlusion (map glass/water does, like a solid surface)
  ao.overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse(o => { cache.set(o, o.visible); if (o.isPoints || o.isLine || o.isSprite || o === sky || (o.material && o.material.transparent && !o.material.userData.shared)) o.visible = false; });
  };
  composer.addPass(ao);
  const vm = new RenderPass(vmScene, vmCamera); // the held gun, drawn over the world (no AO on it)
  vm.clear = false; vm.clearDepth = true;
  composer.addPass(vm);
  // Guard against NaN/huge pixel values (from very bright specular highlights in half-float buffers): bloom would
  // blur them into flickering black squares.
  composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); gl_FragColor = vec4(clamp(c, 0.0, 24.0), 1.0); }' }));
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.55, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, vig: { value: 0.22 }, sat: { value: 1.0 }, con: { value: 1.06 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float vig; uniform float sat; uniform float con; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, sat);
        c = (c - 0.5) * con + 0.5;
        vec2 d = vUv - 0.5; c *= 1.0 - vig * smoothstep(0.25, 0.75, dot(d, d) * 2.2);
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
  });
  composer.addPass(grade);
  post = { composer, ao, bloom, vm };
}
if (ULTRA) setupPost().catch(e => { try { reportErr('Ultra graphics failed to start: ' + (e?.message || e)); } catch {} });

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  if (post) { post.composer.setPixelRatio(renderer.getPixelRatio()); post.composer.setSize(innerWidth, innerHeight); }
  camera.aspect = vmCamera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix(); vmCamera.updateProjectionMatrix();
  resizePreview();
});

const flashLights = [];
for (let i = 0; i < 4; i++) { const l = new THREE.PointLight('#ffb060', 0, 14, 2); scene.add(l); flashLights.push({ l, t: 0, dur: 1, peak: 0 }); }
let flashIdx = 0;
function flashLight(pos, color, peak, dur, dist = 14) {
  const f = flashLights[flashIdx++ % flashLights.length];
  f.l.position.copy(pos); f.l.color.set(color); f.l.distance = dist; f.peak = peak; f.t = dur; f.dur = dur;
}

const TEX = { flash: flashSprite(), glow: radialSprite(), smoke: radialSprite('rgba(120,120,120,0.9)', 'rgba(80,80,80,0)'), decal: decalTexture(),
  fire: radialSprite('rgba(255,230,160,1)', 'rgba(255,80,10,0)'), blood: radialSprite('rgba(170,10,10,0.9)', 'rgba(120,0,0,0)') };
const decalGeo = new THREE.PlaneGeometry(0.11, 0.11);
const decalMat = new THREE.MeshBasicMaterial({ map: TEX.decal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const partGeo = new THREE.BoxGeometry(1, 1, 1);
const partMats = {};
const partMat = c => partMats[c] || (partMats[c] = new THREE.MeshBasicMaterial({ color: c }));
const tracerGeo = new THREE.BoxGeometry(0.018, 0.018, 1); tracerGeo.translate(0, 0, -0.5);
for (const g of [decalGeo, partGeo, tracerGeo]) g.userData.shared = true;
decalMat.userData.shared = true;
for (const t of Object.values(TEX)) t.userData.shared = true;

// Free GPU memory for an object we're throwing away (skips shared geometries/materials/textures).
// Without this, every respawned bot gun, rocket, tag and old map stays in memory until the game crashes.
function disposeObject(root) {
  if (!root) return;
  root.traverse(o => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.userData.shared) continue;
      if (m.map && m.map.userData.own) m.map.dispose();
      m.dispose();
    }
    if (o.isLight && o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
  });
}

// ================================================================ world / map
let world = null;
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, stars: { value: 0 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform float stars; varying vec3 vDir;
    float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
    void main(){
      float y = vDir.y;
      vec3 col = y > 0.0 ? mix(horizon, top, pow(y, 0.55)) : mix(horizon, bottom, pow(-y, 0.4));
      float s = max(dot(vDir, normalize(sunDir)), 0.0);
      col += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 14.0) * 0.3);
      if (stars > 0.5 && y > 0.02) { vec3 q = floor(vDir * 260.0); float h = hash(q); if (h > 0.996) col += vec3(0.9, 0.9, 1.0) * (h - 0.996) * 250.0 * y; }
      // soft clouds
      if (stars < 0.5 && y > 0.0) { vec2 uv = vDir.xz / (y + 0.15) * 2.0; float c = sin(uv.x * 1.3) * sin(uv.y * 1.7 + uv.x * 0.6) + sin(uv.x * 3.1 + uv.y * 2.3) * 0.5; col = mix(col, vec3(1.0), smoothstep(0.6, 1.4, c) * 0.35 * smoothstep(0.0, 0.3, y)); }
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
sky.renderOrder = -1;
scene.add(sky);

// Visual-only inflation so two different surfaces never sit in exactly the same plane (that flickers,
// "z-fighting"). Decorations win over floors/roofs, which win over walls; walls of different materials
// get slightly different offsets. A few millimetres is invisible but always resolves the tie.
const FLAT_MAT = /floor|roof|rug|grate|tile|carpet|mat$|sand$|dirt|asphalt|road|grass/;
// Ultra uses a normal (not logarithmic) depth buffer, so its offsets are larger to stay flicker-free far away.
function inflateFor(name, deco) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const k = ULTRA ? 2.5 : 1;
  if (deco) return (0.011 + (h % 13) * 0.0006) * k;
  if (FLAT_MAT.test(name)) return (0.0065 + (h % 5) * 0.0006) * k;
  return (0.0004 + (h % 11) * 0.0005) * k;
}
// ---- weathering: every map box gets worn, lighter edges, a soft shade line inside them (reads as a bevel),
// grime at the foot of walls and large-scale colour variation, so surfaces stop looking like clean plastic.
// Edges where a box meets another box (one long wall built from pieces) or the ground are left plain.
let joinGrid = null;
function buildJoinGrid(lists) {
  const g = new Map(), C = 4;
  for (const list of lists) for (const b of list) {
    if (b.max[0] - b.min[0] < 0.05 && b.max[2] - b.min[2] < 0.05) continue;
    for (let i = Math.floor(b.min[0] / C); i <= Math.floor(b.max[0] / C); i++)
      for (let j = Math.floor(b.min[2] / C); j <= Math.floor(b.max[2] / C); j++) { const k = i * 100003 + j; if (!g.has(k)) g.set(k, []); g.get(k).push(b); }
  }
  joinGrid = { g, C };
}
function solidAt(p, self) {
  if (!joinGrid) return false;
  const { g, C } = joinGrid, list = g.get(Math.floor(p[0] / C) * 100003 + Math.floor(p[2] / C));
  if (!list) return false;
  for (const b of list) if (b !== self && p[0] > b.min[0] && p[0] < b.max[0] && p[1] > b.min[1] && p[1] < b.max[1] && p[2] > b.min[2] && p[2] < b.max[2]) return true;
  return false;
}
const FACE_AXES = [[2, 1, 0, 1], [2, 1, 0, -1], [0, 2, 1, 1], [0, 2, 1, -1], [0, 1, 2, 1], [0, 1, 2, -1]]; // in-plane a, c; normal axis, sign
function addEdgeAttrs(g, b) {
  const pos = g.attributes.position, n = pos.count, edge = new Float32Array(n * 4), grime = new Float32Array(n * 2);
  const mn = b.min, mx = b.max;
  for (let f = 0; f < 6; f++) {
    const [a, c, na, sg] = FACE_AXES[f];
    // which of this face's 4 edges continue into another box (or the ground)?
    const ctr = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    ctr[na] = (sg > 0 ? mx[na] : mn[na]) - sg * 0.03;
    const joined = [[a, mn[a], -1], [a, mx[a], 1], [c, mn[c], -1], [c, mx[c], 1]].map(([ax, v, dir]) => {
      if (ax === 1 && dir < 0 && mn[1] < 0.03) return true; // sits on the ground
      const p = ctr.slice(); p[ax] = v + dir * 0.03;
      return solidAt(p, b);
    });
    const vertical = na !== 1 ? 1 : 0;
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v, pa = pos.getComponent(i, a), pc = pos.getComponent(i, c);
      const lo = pa < (mn[a] + mx[a]) / 2, bo = pc < (mn[c] + mx[c]) / 2;
      const W = mx[a] - mn[a], H = mx[c] - mn[c];
      edge[i * 4] = (lo ? 0 : W) + (joined[0] ? 50 : 0);
      edge[i * 4 + 1] = (lo ? W : 0) + (joined[1] ? 50 : 0);
      edge[i * 4 + 2] = (bo ? 0 : H) + (joined[2] ? 50 : 0);
      edge[i * 4 + 3] = (bo ? H : 0) + (joined[3] ? 50 : 0);
      grime[i * 2] = pos.getY(i) - mn[1]; grime[i * 2 + 1] = vertical;
    }
  }
  g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 4));
  g.setAttribute('aGrime', new THREE.BufferAttribute(grime, 2));
}
function weatherMaterial(mat) {
  if (mat.userData.weathered) return;
  mat.userData.weathered = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aEdge; attribute vec2 aGrime; varying vec4 vEdge; varying vec2 vGrime; varying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEdge = aEdge; vGrime = aGrime; vWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vEdge; varying vec2 vGrime; varying vec3 vWPos;
        float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float wNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float d = min(min(vEdge.x, vEdge.y), min(vEdge.z, vEdge.w));
          float size = min(vEdge.x + vEdge.y, vEdge.z + vEdge.w);
          float rw = min(0.05, size * 0.12), fw = fwidth(d);
          float rim = 1.0 - smoothstep(rw * 0.35, rw + fw, d);
          float inner = smoothstep(rw, rw * 1.8 + fw, d) * (1.0 - smoothstep(rw * 1.8, rw * 6.0, d));
          float wear = wNoise(vWPos.xz * 3.1 + vWPos.y * 2.3);
          float grime = vGrime.y * (1.0 - smoothstep(0.0, 0.8, vGrime.x)) * (0.7 + 0.3 * wear);
          float macro = wNoise(vWPos.xz * 0.11 + vWPos.y * 0.07) * 0.6 + wNoise(vWPos.zx * 0.53 + vWPos.y * 0.31) * 0.4;
          vec3 col = diffuseColor.rgb;
          col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 0.8);             // tone down saturation
          col = mix(col, col * 1.5 + 0.05, rim * (0.45 + 0.4 * wear));                           // worn, lighter edge
          col *= (1.0 - inner * 0.16) * (1.0 - grime * 0.45) * (0.86 + macro * 0.26);
          diffuseColor.rgb = col;
        }`);
  };
  mat.needsUpdate = true;
}
function boxGeometry(b, mat, deco = false) {
  const e = inflateFor(b.m || '', deco);
  const w = b.max[0] - b.min[0] + 2 * e, h = b.max[1] - b.min[1] + 2 * e, d = b.max[2] - b.min[2] + 2 * e;
  const g = new THREE.BoxGeometry(w, h, d);
  const s = mat.userData.scale || 3, fit = mat.userData.fit;
  g.translate((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
  addEdgeAttrs(g, b);
  if (!fit) {
    // world-aligned UVs (from real vertex positions) so textures line up across neighbouring boxes
    const uv = g.attributes.uv, pos = g.attributes.position;
    const axes = [[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]]; // +x,-x,+y,-y,+z,-z faces
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v, [a, c] = axes[f];
      uv.setXY(i, pos.getComponent(i, a) / s * (f === 1 || f === 4 ? 1 : f === 0 || f === 5 ? -1 : 1), pos.getComponent(i, c) / s * (f === 3 ? -1 : 1));
    }
  }
  return g;
}
function mergedMeshes(list, theme, group, shadows, deco = false) {
  const byMat = new Map();
  for (const b of list) {
    const mat = getMaterial(b.m, theme);
    if (!mat.transparent) weatherMaterial(mat);
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat).push(boxGeometry(b, mat, deco));
  }
  const out = [];
  for (const [mat, geos] of byMat) {
    const g = mergeGeometries(geos, false);
    geos.forEach(x => x.dispose());
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = shadows && !mat.transparent && !(mat.emissiveIntensity > 1.5);
    mesh.receiveShadow = true;
    group.add(mesh); out.push(mesh);
  }
  return out;
}

function loadMap(id) {
  if (world?.map.id === id) return;
  if (world) { scene.remove(world.group); disposeObject(world.group); }
  clearFx();
  const map = buildMap(id);
  const theme = THEMES[map.theme];
  const group = new THREE.Group();
  const floorMat = getMaterial(theme.floor, map.theme);
  const fs = (map.size + 4) * 3;
  const fg = new THREE.PlaneGeometry(fs, fs);
  const fuv = fg.attributes.uv, rep = fs / (floorMat.userData.scale || 6);
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * rep, fuv.getY(i) * rep);
  buildJoinGrid([map.boxes, map.deco]);
  // the ground has no box edges: far-away edge distances, no wall grime (it still gets colour variation)
  fg.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(fg.attributes.position.count * 4).fill(999), 4));
  fg.setAttribute('aGrime', new THREE.BufferAttribute(new Float32Array(fg.attributes.position.count * 2), 2));
  weatherMaterial(floorMat);
  const floor = new THREE.Mesh(fg, floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  group.add(floor);
  const meshes = [floor, ...mergedMeshes(map.boxes, map.theme, group, true)];
  mergedMeshes(map.deco, map.theme, group, true, true);

  // Ultra: less flat fill light and a stronger sun, so shadows and occlusion give shapes some depth
  const hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiI * (ULTRA ? 0.8 : 1)); group.add(hemi);
  const sun = new THREE.DirectionalLight(theme.sun, theme.sunI * (ULTRA ? 1.15 : 1));
  const sd = new THREE.Vector3(...theme.sunDir).normalize();
  const sunD = Math.max(90, map.size * 0.85); // far enough that big maps sit fully inside the shadow camera
  sun.position.copy(sd).multiplyScalar(sunD);
  sun.castShadow = renderer.shadowMap.enabled;
  const sc = sun.shadow.camera, ext = map.size * 0.62;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = sunD + map.size * 1.1;
  sunBig = map.size > 130; sunLight = sun;
  const smap = shadowMapSize(sunBig);
  sun.shadow.mapSize.set(smap, smap);
  if (ULTRA) addSurfaceDetail([...map.boxes, ...map.deco].map(b => b.m).concat(theme.floor), map.theme);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  group.add(sun); group.add(sun.target);
  for (const [col, x, z] of theme.lamps) { const l = new THREE.PointLight(col, 90, 38, 1.4); l.position.set(x, 5, z); group.add(l); }

  let snow = null;
  if (map.theme === 'snow') {
    const N = 2500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = Math.random() * 25; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    snow = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.07, transparent: true, opacity: 0.85, depthWrite: false }));
    snow.frustumCulled = false;
    group.add(snow);
  }
  scene.add(group);
  scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
  renderer.toneMappingExposure = theme.exposure;
  skyMat.uniforms.top.value.set(theme.skyTop);
  skyMat.uniforms.horizon.value.set(theme.skyHorizon);
  skyMat.uniforms.bottom.value.set(theme.skyBottom);
  skyMat.uniforms.sunDir.value.copy(sd);
  skyMat.uniforms.sunColor.value.set(theme.sun);
  skyMat.uniforms.stars.value = theme.stars ? 1 : 0;
  vmHemi.color.set(theme.hemiSky); vmHemi.groundColor.set(theme.hemiGround); vmHemi.intensity = theme.hemiI * 1.3;
  vmSun.color.set(theme.sun); vmSun.intensity = Math.min(2.6, theme.sunI * 0.8 + 0.4);
  const pickupGroup = new THREE.Group();
  const pickupMeshes = (map.pickups || []).map(p => { const pm = makePickupMesh(p.kind); pm.position.set(p.x, 0.68, p.z); pm.userData.kind = p.kind; pickupGroup.add(pm); return pm; });
  group.add(pickupGroup);
  world = { map, group, meshes, snow, minimap: renderMapCanvas(map, 512, true), pickupGroup, pickupMeshes };
  $('mapname').textContent = map.name.toUpperCase();
}
// Ultra: materials without their own bump map use their colour texture as one, so bricks, planks, rock and
// concrete pick up light and shade instead of looking flat-printed.
function addSurfaceDetail(names, themeId) {
  for (const n of new Set(names)) {
    const m = getMaterial(n, themeId);
    if (!m.map || m.bumpMap || m.transparent || m.userData.detail) continue;
    m.userData.detail = true;
    m.envMapIntensity = 0.65;
    m.bumpMap = m.map; m.bumpScale = 1.6; m.needsUpdate = true;
  }
}
const nearBoxes = (x, z, r = 3) => world.map.query(x - r, z - r, x + r, z + r);

// ---- pickups (health / ammo / power-ups)
const PICK_COLORS = { health: '#ff3b4a', ammo: '#ffd36a', damage: '#ff2a5a', speed: '#22e5ff' };
function makePickupMesh(kind) {
  const g = new THREE.Group();
  const glow = c => new THREE.MeshStandardMaterial({ color: c, emissive: new THREE.Color(c), emissiveIntensity: 1.6, roughness: 0.3 });
  if (kind === 'health') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.5 })));
    const red = glow('#ff2a3a');
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.57), red), b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.57), red);
    a.position.z = b.position.z = 0; g.add(a, b);
    const a2 = a.clone(); a2.rotation.y = Math.PI / 2; const b2 = b.clone(); b2.rotation.y = Math.PI / 2; g.add(a2, b2);
  } else if (kind === 'ammo') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.38, 0.45), new THREE.MeshStandardMaterial({ color: '#4c5a3a', roughness: 0.7 })));
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.47), glow('#ffd36a')); g.add(s);
  } else {
    const m = new THREE.Mesh(kind === 'damage' ? new THREE.IcosahedronGeometry(0.32, 0) : new THREE.OctahedronGeometry(0.34, 0), glow(PICK_COLORS[kind]));
    g.add(m);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 24), new THREE.MeshBasicMaterial({ color: PICK_COLORS[kind], transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.62;
  const root = new THREE.Group(); root.add(g, ring); root.userData.spin = g;
  return root;
}

// Top-down picture of a map (used for the minimap and lobby thumbnails)
const FLOOR_COLORS = { city: '#2e2f34', base: '#55703a', town: '#8f8b82', harbor: '#6e6c66', neon: '#26272c', snow: '#e3e9f0', desert: '#d6b27a', construction: '#a88a66', killhouse: '#6a7078', shipyard: '#6e6c66', suburb: '#5f8a45', canyon: '#c99a6a' };
function renderMapCanvas(map, size, minimap) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const H = map.size / 2 + 2, ms = size / (2 * H);
  x.fillStyle = minimap ? 'rgba(30,36,48,0.92)' : FLOOR_COLORS[map.theme]; x.fillRect(0, 0, size, size);
  const ground = map.deco.filter(b => b.max[1] < 0.1);
  for (const b of ground) { x.fillStyle = minimap ? 'rgba(80,90,110,0.5)' : ({ cobble: '#6f6a62', road: '#2f3035', road_line: '#2f3035', rug: '#7a2a22' }[b.m] || 'rgba(0,0,0,0.15)'); x.fillRect((b.min[0] + H) * ms, (b.min[2] + H) * ms, (b.max[0] - b.min[0]) * ms, (b.max[2] - b.min[2]) * ms); }
  const sorted = [...map.boxes].sort((a, b) => a.max[1] - b.max[1]);
  for (const b of sorted) {
    if (minimap) { const l = clamp(40 + b.max[1] * 12, 40, 160); x.fillStyle = b.m === 'wall' ? '#0b0d12' : `rgb(${l},${l + 8},${l + 20})`; }
    else x.fillStyle = MAT_COLORS[b.m] || '#888';
    x.fillRect((b.min[0] + H) * ms, (b.min[2] + H) * ms, (b.max[0] - b.min[0]) * ms, (b.max[2] - b.min[2]) * ms);
    if (!minimap && b.max[1] > 2) { x.fillStyle = `rgba(0,0,0,${clamp(0.25 - b.max[1] * 0.02, 0, 0.25)})`; x.fillRect((b.min[0] + H) * ms, (b.min[2] + H) * ms, (b.max[0] - b.min[0]) * ms, (b.max[2] - b.min[2]) * ms); }
  }
  if (!minimap) for (const b of map.deco.filter(d => d.m === 'leaves' || d.m === 'palm' || d.m.startsWith('awning'))) { x.fillStyle = MAT_COLORS[b.m] || (b.m === 'leaves' ? '#3f6a26' : b.m === 'palm' ? '#7aa04a' : '#b8322a'); x.fillRect((b.min[0] + H) * ms, (b.min[2] + H) * ms, (b.max[0] - b.min[0]) * ms, (b.max[2] - b.min[2]) * ms); }
  return { canvas: c, H, ms };
}
const thumbCache = {};
function mapThumb(id) {
  if (thumbCache[id]) return thumbCache[id];
  if (id === 'random') {
    const c = document.createElement('canvas'); c.width = 240; c.height = 180;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 240, 180); g.addColorStop(0, '#2a1c3a'); g.addColorStop(1, '#3a2010');
    x.fillStyle = g; x.fillRect(0, 0, 240, 180); x.fillStyle = '#ff9a40'; x.font = '900 90px Orbitron, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 120, 95);
    return (thumbCache[id] = c.toDataURL());
  }
  const src = renderMapCanvas(buildMap(id), 360, false).canvas;
  const c = document.createElement('canvas'); c.width = 240; c.height = 180;
  c.getContext('2d').drawImage(src, 0, 45, 360, 270, 0, 0, 240, 180);
  return (thumbCache[id] = c.toDataURL());
}

// ================================================================ local player
const me = { id: null, pos: [0, 0, 0], vel: [0, 0, 0], onGround: false, height: PLAYER.height, eyeH: PLAYER.eye, yaw: 0, pitch: 0, alive: false, hp: 100, crouch: false, slot: 0, weapons: [], streak: 0 };
let inGame = false, ws = null, myName = cfg.name, room = null, lobbies = [], online = 0;
let vmRoll = 0, adsT = 0, drawT = 0, bloom = 0, recoilAcc = 0, shake = 0, kickZ = 0, bobPhase = 0, stepDist = 0, swayX = 0, swayY = 0;
let sprintLock = 0, meleeAnim = 0, lastShotTime = 0, deathTime = 0, respawnAt = 0, timeLeft = 600, scoreLimit = 30, matchEnded = false, endBackAt = 0;
const scores = new Map();
let uavAdvanced = false, jamUntil = 0, myStreaks = [], streakReady = [], myArmor = 0;
let mode = 'ffa', target = 30, teamScore = [0, 0], myTeam = -1, zone = null, uavUntil = 0, ggWeapon = null, nadesLeft = 2, tacsLeft = 2;
let stunUntil = 0, burnUntil = 0;
const smokes = new Map(), fires = new Map(); // active smoke clouds / fire pools from the server
let matchXP = 0, matchStart = null, matchStartedAt = 0; const matchXPReasons = {};
const teamsMode = () => MODES[mode]?.teams;
const teamOf = id => id === me.id ? myTeam : (remotes.get(id)?.info.team ?? -1);
const isMate = id => teamsMode() && teamOf(id) === myTeam;
let lifePerks = [...cfg.perks];
const hasPerk = id => lifePerks.includes(id);
const perkDef = (d) => {
  if (!d || d.melee) return d;
  d = { ...d };
  if (hasPerk('quickhands')) { d.reload *= 0.75; if (d.shellTime) d.shellTime *= 0.75; d.swap = true; }
  if (hasPerk('steadyaim')) { d.spread *= 0.65; d.moveSpread *= 0.8; d.recoil *= 0.85; }
  if (hasPerk('stopping')) d.dmg *= 1.15;
  return d;
};
const makeWeapon = id => { const def = perkDef(mode === 'gungame' ? PR.attachedDef(id, {}) : PR.attachedDef(id)); return { def, ammo: def.mag, reserve: mode === 'gungame' ? 999 : def.reserve, reloadT: 0, nextFire: 0, burstLeft: 0, actT: 0, reloadTotal: 0 }; };
let ddUntil = 0, spdUntil = 0;
const isZombie = () => mode === 'infected' && myTeam === 1;
const makeWeapons = () => (lifePerks = [...cfg.perks], isZombie()) ? ['knife'].map(makeWeapon) : mode === 'gungame' ? [ggWeapon || GUNGAME_LADDER[0], 'knife'].map(makeWeapon)
  : [PR.isUnlocked(cfg.primary) ? cfg.primary : 'falcon', PR.isUnlocked(cfg.secondary) ? cfg.secondary : 'viper', 'knife'].map(makeWeapon);
const curW = () => me.weapons[me.slot];
const isHost = () => room && room.hostId === me.id;

// ================================================================ viewmodel
let vm = null;
function equipViewmodel() {
  for (const c of [...vmHolder.children]) disposeObject(c);
  vmHolder.clear();
  const w = curW(); if (!w) return;
  const gun = buildWeapon(w.def, gunSkin(w.def.id), { ...(w.def.att || {}), attSkin: attSkinFor(w.def.id) });
  gun.add(buildArms(cfg.cskin, gun));
  gun.traverse(o => { if (o.isMesh) o.castShadow = false; });
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flash, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  fl.scale.setScalar(w.def.model === 'rocket' ? 0.5 : w.def.suppressed ? 0.12 : 0.28); fl.visible = false;
  gun.userData.muzzle.add(fl);
  vmHolder.add(gun);
  vm = { gun, flash: fl, flashT: 0 };
  drawT = w.def.swap ? 0.2 : 0.35;
}
function switchSlot(n) {
  if (!me.alive || n === me.slot || !me.weapons[n]) return;
  const w = curW(); if (w) { w.reloadT = 0; w.burstLeft = 0; w.actT = 0; }
  me.slot = n; equipViewmodel(); SFX.swish();
  $('reloadbar').style.display = 'none';
}
// Reload: whole magazine at once, or one shell at a time for tube-fed shotguns (firing interrupts it).
function startReload() {
  const w = curW();
  if (!w || w.def.melee || w.reloadT > 0 || w.ammo >= w.def.mag || w.reserve <= 0) return;
  w.reloadTotal = w.def.shellTime ? w.def.shellTime + 0.25 : w.def.reload;
  w.reloadT = w.reloadTotal; w.burstLeft = 0; w.actT = 0;
  w.reloadTac = w.ammo > 0; w.rsfx = 0;                                              // tactical reload: no need to work the action
  if (w.def.shellTime || w.def.anim === 'break' || w.def.anim === 'revolver' || w.def.anim === 'clip') SFX.reload(w.def.shellTime ? 0.5 : w.def.reload);
}

// ================================================================ remote players
const remotes = new Map();
const hbMat = new THREE.MeshBasicMaterial({ visible: false });
// Hitboxes fitted to the soldier model: head (helmet included, no longer reaching down to the shoulders), torso
// with the vest, legs, and the arms held out in front with the gun. Arms and legs take 85% damage.
const hbHeadGeo = new THREE.BoxGeometry(0.33, 0.37, 0.35), hbBodyGeo = new THREE.BoxGeometry(0.5, 0.62, 0.36);
const hbLegsGeo = new THREE.BoxGeometry(0.44, 0.88, 0.32), hbArmsGeo = new THREE.BoxGeometry(0.42, 0.2, 0.46);
for (const o of [hbMat, hbHeadGeo, hbBodyGeo, hbLegsGeo, hbArmsGeo]) o.userData.shared = true;
function addRemote(info) {
  if (info.id === me.id) { myName = info.name; return; }
  let r = remotes.get(info.id);
  if (r && (r.info.skin !== info.skin || r.info.wskin !== info.wskin || r.info.name !== info.name || r.info.dv !== info.dv || r.info.team !== info.team)) { removeRemote(info.id); r = null; }
  if (r) { r.info = info; return; }
  const model = buildSoldier(info.skin);
  if (info.team >= 0) { // team armband + helmet stripe
    const tm = new THREE.MeshStandardMaterial({ color: teamColor(mode, info.team), emissive: new THREE.Color(teamColor(mode, info.team)), emissiveIntensity: 1.2 });
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.14), tm); band.position.set(0.3, 0.42, 0); model.userData.upper.add(band);
    const band2 = band.clone(); band2.position.x = -0.3; model.userData.upper.add(band2);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.32), tm); stripe.position.set(0, 0.31, 0.01); model.userData.head.add(stripe);
  }
  const hbHead = new THREE.Mesh(hbHeadGeo, hbMat); hbHead.position.y = 1.72; hbHead.userData = { pid: info.id, head: true };
  const hbBody = new THREE.Mesh(hbBodyGeo, hbMat); hbBody.position.y = 1.17; hbBody.userData = { pid: info.id, head: false };
  const hbLegs = new THREE.Mesh(hbLegsGeo, hbMat); hbLegs.position.y = 0.44; hbLegs.userData = { pid: info.id, head: false, limb: true };
  const hbArms = new THREE.Mesh(hbArmsGeo, hbMat); hbArms.position.set(0, 1.3, -0.3); hbArms.userData = { pid: info.id, head: false, limb: true };
  model.add(hbHead, hbBody, hbLegs, hbArms);
  const mate = teamsMode() && info.team === myTeam;
  const tagCol = mate ? '#8fc0ff' : teamsMode() ? '#ff6a6a' : info.bot ? '#ffb27a' : '#ff5a5a';
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTagTexture(info.name, tagCol, !!info.dv), depthTest: false, transparent: true }));
  tag.scale.set(1.6, 0.4, 1); tag.position.y = 2.25; tag.renderOrder = 10;
  model.add(tag);
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flash, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  fl.scale.setScalar(0.5); fl.visible = false;
  model.visible = false;
  scene.add(model);
  r = { info, model, hbHead, hbBody, hbLegs, hbArms, tag, flash: fl, flashT: 0, buf: [], alive: false, gunId: null, gun: null, walk: 0, deathT: 0, lastFired: 0, prev: null, mate };
  remotes.set(info.id, r);
  if (info.w) setRemoteGun(r, info.w);
}
function removeRemote(id) {
  const r = remotes.get(id); if (!r) return;
  scene.remove(r.model); r.tag.material.map.dispose(); disposeObject(r.model);
  remotes.delete(id);
}
function clearRemotes() { for (const id of [...remotes.keys()]) removeRemote(id); }
function setRemoteGun(r, wid) {
  if (r.gunId === wid || !WEAPONS[wid]) return;
  const mount = r.model.userData.gunMount;
  const old = r.gun;
  r.gun = buildWeapon(WEAPONS[wid], r.info.wskin);
  r.gun.userData.muzzle.add(r.flash); // moves the shared flash sprite off the old gun
  mount.add(r.gun);
  if (old) { mount.remove(old); disposeObject(old); }
  r.gunId = wid;
}
const nameOf = id => id === me.id ? myName : (remotes.get(id)?.info.name || '???');
// developer badge: a gold crown next to the names of players who entered the dev code (checked by the server)
const DEV_MARK = '<span class="devmark" title="Strikeline developer">\u265B</span>';
const isDevId = id => id === me.id ? PR.isDev() : !!remotes.get(id)?.info.dv;
const devTxt = (name, dev) => (dev ? '\u265B ' : '') + name; // plain-text places
const devHTML = (name, dev) => (dev ? DEV_MARK : '') + esc(name); // HTML places
const dnameOf = id => devTxt(nameOf(id), isDevId(id));

// ================================================================ fx
const fx = { parts: [], tracers: [], decals: [], sprites: [], rockets: new Map(), nades: new Map(), tags: new Map() };
function makeTagMesh(team) {
  const g = new THREE.Group();
  const col = teamColor(mode, team) || '#ffffff';
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.03), new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.9, roughness: 0.25, emissive: new THREE.Color(col), emissiveIntensity: 0.6 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 24), new THREE.MeshBasicMaterial({ color: col }));
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.5;
  g.add(plate, ring);
  g.userData.plate = plate;
  return g;
}
const nadeMat = new THREE.MeshStandardMaterial({ color: '#3d4a2c', roughness: 0.6, metalness: 0.3 });
const nadeLed = new THREE.MeshBasicMaterial({ color: '#ff2a2a' });
nadeMat.userData.shared = nadeLed.userData.shared = true;
// Thrown objects, one look per kind (frag, semtex, molotov, throwing knife, smoke, flash, stun)
const THROW_LOOK = {
  frag: ['#3d4a2c', [0.11, 0.13, 0.11], '#ff2a2a'], semtex: ['#c8c2a8', [0.12, 0.08, 0.12], '#2aff5a'], molotov: ['#5a3a1a', [0.07, 0.2, 0.07], '#ff8a1a'],
  tknife: ['#b8bec6', [0.02, 0.03, 0.22], null], smoke: ['#6a7078', [0.08, 0.16, 0.08], '#cfd6e4'], flash: ['#2a2e34', [0.08, 0.15, 0.08], '#ffffff'], stun: ['#2a3a5a', [0.09, 0.13, 0.09], '#4ab0ff'],
};
const throwMats = {};
function makeNadeMesh(kind = 'frag') {
  const [col, size, led] = THROW_LOOK[kind] || THROW_LOOK.frag;
  const mat = throwMats[col] || (throwMats[col] = Object.assign(new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.3 }), { userData: { shared: true } }));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(...size), kind === 'frag' ? nadeMat : mat));
  if (led) { const lm = throwMats[led + 'L'] || (throwMats[led + 'L'] = Object.assign(new THREE.MeshBasicMaterial({ color: led }), { userData: { shared: true } }));
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), lm); l.position.y = size[1] / 2 + 0.01; g.add(l); }
  g.userData.kind = kind;
  return g;
}
// Hardpoint zone visual
const zoneMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
const zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3, 48, 1, true), zoneMat);
const zoneFloor = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
zoneFloor.rotation.x = -Math.PI / 2;
zoneMesh.visible = zoneFloor.visible = false;
scene.add(zoneMesh, zoneFloor);
function updateZoneVisual(now) {
  const show = inGame && mode === 'hardpoint' && zone;
  zoneMesh.visible = zoneFloor.visible = !!show;
  if (!show) return;
  const col = zone.state === 0 ? teamColor(mode, 0) : zone.state === 1 ? teamColor(mode, 1) : zone.state === 2 ? '#ffd36a' : '#ffffff';
  zoneMat.color.set(col); zoneFloor.material.color.set(col);
  zoneMat.opacity = 0.16 + Math.sin(now * 0.004) * 0.05;
  zoneMesh.position.set(zone.x, 1.5, zone.z); zoneMesh.scale.set(zone.r, 1, zone.r);
  zoneFloor.position.set(zone.x, 0.06, zone.z); zoneFloor.scale.set(zone.r, zone.r, 1);
}
function clearFx() {
  for (const g of fx.nades.values()) { scene.remove(g); disposeObject(g); }
  fx.nades.clear();
  for (const g of fx.tags.values()) { scene.remove(g); disposeObject(g); }
  fx.tags.clear();
  for (const p of fx.parts) scene.remove(p.m);
  for (const t of fx.tracers) { scene.remove(t.m); t.m.material.dispose(); }
  for (const d of fx.decals) scene.remove(d);
  for (const s of fx.sprites) { scene.remove(s.m); s.m.material.dispose(); }
  for (const r of fx.rockets.values()) { scene.remove(r); disposeObject(r); }
  fx.parts = []; fx.tracers = []; fx.decals = []; fx.sprites = []; fx.rockets.clear();
  syncSmokes([]); fires.clear();
}
function particle(pos, vel, color, size, life, grav = 9) {
  if (fx.parts.length > 400) { const o = fx.parts.shift(); scene.remove(o.m); }
  const m = new THREE.Mesh(partGeo, partMat(color));
  m.position.copy(pos); m.scale.setScalar(size);
  scene.add(m);
  fx.parts.push({ m, vel: vel.clone(), life, max: life, grav, size });
}
function spriteFx(pos, tex, size, grow, life, opacity = 1, vel = null, additive = false) {
  if (fx.sprites.length > 280) { const o = fx.sprites.shift(); scene.remove(o.m); o.m.material.dispose(); }
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  m.position.copy(pos); m.scale.setScalar(size); m.material.rotation = Math.random() * 6.28;
  scene.add(m);
  fx.sprites.push({ m, size, grow, life, max: life, opacity, vel });
}
function tracer(from, to, dart = false) {
  const dir = to.clone().sub(from), dist = dir.length(); if (dist < 1) return;
  dir.divideScalar(dist);
  const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial(dart ? { color: '#ff7a1a' } : { color: '#ffd9a0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  if (dart) m.scale.set(1.6, 1.6, 1);
  m.position.copy(from); m.lookAt(from.clone().add(dir));
  scene.add(m);
  fx.tracers.push({ m, from: from.clone(), dir, dist, t: 0, speed: dart ? 70 : 420, len: dart ? 0.12 : 7 });
}
// flamethrower jet: short-lived additive fire sprites flying forward
let myFlame = null;
function flameStream(from, dir, len, count = 8) {
  const speed = 9, life = Math.min(1.2, len / speed);
  for (let i = 0; i < count; i++) {
    // seed sprites along the first metre or so of the jet so the stream stays continuous between ticks
    const d0 = i < 5 ? Math.random() * Math.min(len, 1.0) : Math.random() * Math.min(len, 3);
    const start = from.clone().addScaledVector(dir, 0.02 + d0);
    const v = dir.clone().multiplyScalar(speed * (0.85 + Math.random() * 0.3)).add(new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.1) * 0.8, (Math.random() - 0.5) * 0.9));
    spriteFx(start, TEX.fire, 0.1 + d0 * 0.12 + Math.random() * 0.06, 6, Math.max(0.12, life - d0 / speed) * (0.7 + Math.random() * 0.3), 0.95, v, true);
  }
  spriteFx(from.clone().addScaledVector(dir, 0.05), TEX.glow, 0.25, 1.5, 0.08, 1, null, true);     // nozzle glow
  if (Math.random() < 0.3) spriteFx(from.clone().addScaledVector(dir, len * 0.85), TEX.smoke, 0.8, 2, 1.0, 0.3, new THREE.Vector3(0, 1.2, 0));
  flashLight(from.clone().addScaledVector(dir, 1.5), '#ff8a30', 35, 0.08, 10);
}
// persistent smoke clouds + burning fire pools sent by the server
function syncSmokes(list) {
  const seen = new Set();
  for (const [id, x, y, z, r] of list || []) {
    seen.add(id);
    if (smokes.has(id)) continue;
    const g = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.smoke, transparent: true, depthWrite: false, opacity: 0, color: '#d8dce2' }));
      const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r * 0.75;
      s.position.set(x + Math.cos(a) * d, y + 0.6 + Math.random() * 2.2, z + Math.sin(a) * d);
      s.userData = { size: r * (0.9 + Math.random() * 0.5), spin: (Math.random() - 0.5) * 0.3 };
      s.scale.setScalar(s.userData.size); s.material.rotation = Math.random() * 6.28;
      g.add(s);
    }
    g.userData = { born: performance.now() };
    scene.add(g); smokes.set(id, g);
  }
  for (const [id, g] of smokes) if (!seen.has(id)) { scene.remove(g); disposeObject(g); smokes.delete(id); }
}
function syncFires(list) {
  fires.clear();
  for (const [id, x, y, z, r] of list || []) fires.set(id, { x, y, z, r });
}
function updateZonesFx(dt, now) {
  if (myFlame && now - myFlame.t < 140 && me.alive) { // continuous flamethrower jet between damage ticks
    for (let i = 0; i < 2; i++) {
      const d0 = Math.random() * 0.4, start = camera.position.clone().add(myFlame.from).addScaledVector(myFlame.dir, d0);
      const v = myFlame.dir.clone().multiplyScalar(9 * (0.85 + Math.random() * 0.3)).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.6, (Math.random() - 0.5) * 0.8));
      spriteFx(start, TEX.fire, 0.1 + Math.random() * 0.06, 6, Math.min(1.2, myFlame.len / 9) * (0.7 + Math.random() * 0.3), 0.95, v, true);
    }
  }
  for (const g of smokes.values()) {
    const k = Math.min(1, (now - g.userData.born) / 1200);
    for (const s of g.children) { s.material.opacity = 0.92 * k; s.material.rotation += s.userData.spin * dt; s.scale.setScalar(s.userData.size * (0.5 + 0.5 * k)); }
  }
  for (const f of fires.values()) {
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * f.r;
      spriteFx(new THREE.Vector3(f.x + Math.cos(a) * d, f.y + 0.15, f.z + Math.sin(a) * d), TEX.fire, 0.4 + Math.random() * 0.4, 2.5, 0.5 + Math.random() * 0.3, 0.9, new THREE.Vector3(0, 1.6, 0), true);
    }
    if (Math.random() < 0.15) flashLight(new THREE.Vector3(f.x, f.y + 0.6, f.z), '#ff7a20', 60, 0.25, 9);
  }
  // screen effects: flashbang, stun, burning
  const fl = Math.max(0, (flashUntil - now) / 3500);
  $('flashfx').style.opacity = fl > 0 ? Math.min(1, fl * 1.4) * flashPower : 0;
  $('stunfx').style.opacity = now < stunUntil ? 0.55 : 0;
  $('burnfx').style.opacity = now < burnUntil ? 0.7 + Math.sin(now * 0.02) * 0.2 : 0;
}
let flashUntil = 0, flashPower = 0;
function impact(point, normal, color = '#ffcf6a') {
  const n = normal.clone();
  for (let i = 0; i < 5; i++) particle(point, n.clone().multiplyScalar(2 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4)), i < 3 ? color : '#777', 0.025 + Math.random() * 0.02, 0.3 + Math.random() * 0.3);
  spriteFx(point.clone().addScaledVector(n, 0.1), TEX.smoke, 0.25, 1.2, 0.6, 0.45);
  const d = new THREE.Mesh(decalGeo, decalMat);
  d.position.copy(point).addScaledVector(n, 0.012);
  d.lookAt(d.position.clone().add(n)); d.rotateZ(Math.random() * 6.28);
  scene.add(d); fx.decals.push(d);
  if (fx.decals.length > 150) scene.remove(fx.decals.shift());
}
function blood(point) {
  for (let i = 0; i < 8; i++) particle(point, new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), i % 2 ? '#8a0b0b' : '#c41414', 0.04 + Math.random() * 0.03, 0.5, 12);
  spriteFx(point, TEX.blood, 0.3, 2.5, 0.35, 0.8);
}
function explosionFx(p) {
  const pos = new THREE.Vector3(...p);
  spriteFx(pos, TEX.fire, 1, 9, 0.45, 1, null, true);
  spriteFx(pos, TEX.glow, 2, 6, 0.25, 1, null, true);
  for (let i = 0; i < 8; i++) spriteFx(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2)), TEX.smoke, 1.5, 3, 1.6 + Math.random(), 0.7, new THREE.Vector3(Math.random() - 0.5, 1 + Math.random(), Math.random() - 0.5));
  for (let i = 0; i < 30; i++) particle(pos, new THREE.Vector3((Math.random() - 0.5) * 18, Math.random() * 12, (Math.random() - 0.5) * 18), i % 3 ? '#ffb347' : '#333', 0.06 + Math.random() * 0.06, 0.6 + Math.random() * 0.6, 14);
  flashLight(pos, '#ff9a40', 400, 0.4, 25);
  shake = Math.max(shake, clamp(1 - pos.distanceTo(camera.position) / 20, 0, 1) * 0.6);
  const [vol, pan] = spatial(pos);
  SFX.boom(vol, pan);
}
function spatial(pos) {
  const d = pos.distanceTo(camera.position);
  const vol = clamp(1 - d / 140, 0.04, 1) ** 1.6;
  const rel = pos.clone().sub(camera.position);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  return [vol, rel.lengthSq() > 0.01 ? rel.normalize().dot(right) * 0.8 : 0, d];
}
function updateFx(dt) {
  for (let i = fx.parts.length - 1; i >= 0; i--) {
    const p = fx.parts[i];
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.m); fx.parts.splice(i, 1); continue; }
    p.vel.y -= p.grav * dt;
    p.m.position.addScaledVector(p.vel, dt);
    if (p.m.position.y < 0.02) { p.m.position.y = 0.02; p.vel.multiplyScalar(0.4); p.vel.y = Math.abs(p.vel.y) * 0.3; }
    p.m.scale.setScalar(p.size * (p.life / p.max));
  }
  for (let i = fx.tracers.length - 1; i >= 0; i--) {
    const t = fx.tracers[i];
    t.t += dt * (t.speed || 420);
    const head = Math.min(t.t, t.dist), tail = Math.max(0, t.t - (t.len || 7));
    if (tail >= t.dist) { scene.remove(t.m); t.m.material.dispose(); fx.tracers.splice(i, 1); continue; }
    t.m.position.copy(t.from).addScaledVector(t.dir, head);
    t.m.scale.z = Math.max(0.01, head - tail);
  }
  for (let i = fx.sprites.length - 1; i >= 0; i--) {
    const s = fx.sprites[i];
    s.life -= dt;
    if (s.life <= 0) { scene.remove(s.m); s.m.material.dispose(); fx.sprites.splice(i, 1); continue; }
    const k = 1 - s.life / s.max;
    s.m.scale.setScalar(s.size * (1 + s.grow * k));
    s.m.material.opacity = s.opacity * (1 - k);
    if (s.vel) s.m.position.addScaledVector(s.vel, dt);
  }
  for (const f of flashLights) { if (f.t > 0) { f.t -= dt; f.l.intensity = f.peak * Math.max(0, f.t / f.dur); } else f.l.intensity = 0; }
  for (const r of fx.rockets.values()) { r.position.addScaledVector(r.userData.vel, dt); if (Math.random() < 0.8) spriteFx(r.position.clone(), TEX.smoke, 0.35, 3, 0.9, 0.5); }
  const tnow = performance.now() * 0.001;
  if (world?.pickupGroup) {
    world.pickupGroup.visible = inGame;
    for (const pm of world.pickupMeshes) { pm.userData.spin.rotation.y = tnow * 1.6; pm.userData.spin.position.y = Math.sin(tnow * 2.5 + pm.position.x) * 0.1; }
  }
  for (const tg of fx.tags.values()) { const [x, y, z] = tg.userData.base; tg.position.set(x, y + Math.sin(tnow * 3 + x) * 0.08, z); tg.userData.plate.rotation.y = tnow * 2.5; }
  if (world?.snow) {
    world.snow.position.set(camera.position.x, 0, camera.position.z);
    const a = world.snow.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 1.6; if (y < 0) y += 25; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(y + i) * dt * 0.3); }
    a.needsUpdate = true;
  }
}

// ================================================================ input
const keys = {};
let mouseL = false, mouseR = false, mouseM = false, triggerFresh = true, locked = false, chatOpen = false, showBoard = false, wantLock = false;
document.addEventListener('keydown', e => {
  if (chatOpen) {
    if (e.key === 'Enter') { const v = $('chatinput').value.trim(); if (v) send({ t: 'chat', m: v }); closeChat(); }
    else if (e.key === 'Escape') closeChat();
    return;
  }
  if (!inGame) return;
  if (e.code === 'Tab') { e.preventDefault(); showBoard = true; renderScoreboard(); }
  if (!locked) return;
  keys[e.code] = true;
  if (e.code === 'KeyR') startReload();
  if (e.code === 'Digit1') switchSlot(0);
  if (e.code === 'Digit2') switchSlot(1);
  if (e.code === 'Digit3') switchSlot(2);
  if (e.code === 'KeyV') { switchSlot(me.weapons.length - 1); drawT = 0.05; mouseL = true; setTimeout(() => { mouseL = false; }, 60); }
  if (e.code === 'Digit5' || e.code === 'Digit6' || e.code === 'Digit7') useStreak(myStreaks[+e.code.slice(5) - 5]);
  if (e.code === 'KeyG') throwNade('lethal');
  if (e.code === 'KeyQ') throwNade('tactical');
  if (e.code === 'KeyT' || e.code === 'Enter') { e.preventDefault(); openChat(); }
  if (e.code === 'Space' || e.code === 'ControlLeft') e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') { showBoard = false; $('scoreboard').classList.add('hidden'); } });
document.addEventListener('mousemove', e => {
  // keep the trigger in sync with the real button state, so a lost mousedown/mouseup
  // (e.g. the window briefly dropping mouse capture) can't stop automatic fire mid-spray
  if (locked && inGame && !chatOpen) {
    const held = (e.buttons & 1) === 1;
    if (held && !mouseL) mouseL = true;
    else if (!held && mouseL && e.buttons !== undefined) { mouseL = false; triggerFresh = true; }
    mouseR = (e.buttons & 2) === 2;
    mouseM = (e.buttons & 4) === 4;
  }
  if (!locked || !me.alive) return;
  const s = 0.0022 * cfg.sens * (camera.fov / cfg.fov) * (performance.now() < stunUntil ? 0.35 : 1);
  me.yaw -= e.movementX * s;
  me.pitch = clamp(me.pitch - e.movementY * s * (cfg.invert ? -1 : 1), -1.55, 1.55);
  swayX = clamp(swayX + e.movementX * 0.00015, -0.03, 0.03);
  swayY = clamp(swayY + e.movementY * 0.00015, -0.03, 0.03);
});
document.addEventListener('mousedown', e => {
  if (!inGame || !locked) return;
  if (e.button === 0) mouseL = true;
  if (e.button === 2) mouseR = true;
  if (e.button === 1) { mouseM = true; e.preventDefault(); } // middle click: slight zoom while held
});
document.addEventListener('mouseup', e => { if (e.button === 0) { mouseL = false; triggerFresh = true; } if (e.button === 2) mouseR = false; if (e.button === 1) mouseM = false; });
document.addEventListener('wheel', e => { const n = me.weapons.length; if (locked && me.alive && n) switchSlot((me.slot + (e.deltaY > 0 ? 1 : n - 1)) % n); });
document.addEventListener('contextmenu', e => { if (inGame) e.preventDefault(); });
function lockPointer() { try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {} }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (locked) { if (inGame || wantLock) hideUI(); }
  else {
    for (const k in keys) keys[k] = false;
    mouseL = mouseR = mouseM = false;
    if (chatOpen) closeChat();
    if (inGame && !matchEnded) showPause(); // the end screen stays in view once the match is over
    else if (!currentScreen) go(room ? 'scr-lobby' : 'scr-home');
  }
});
function openChat() { chatOpen = true; const i = $('chatinput'); i.style.display = 'block'; i.value = ''; setTimeout(() => i.focus(), 0); for (const k in keys) keys[k] = false; mouseL = false; }
function closeChat() { chatOpen = false; const i = $('chatinput'); i.style.display = 'none'; i.blur(); }

// ================================================================ shooting
const raycaster = new THREE.Raycaster();
function camVectors() {
  const q = camera.quaternion;
  return { f: new THREE.Vector3(0, 0, -1).applyQuaternion(q), r: new THREE.Vector3(1, 0, 0).applyQuaternion(q), u: new THREE.Vector3(0, 1, 0).applyQuaternion(q) };
}
function hitTargets() {
  const t = world.meshes.slice();
  for (const r of remotes.values()) if (r.alive && !r.mate) t.push(r.hbHead, r.hbBody, r.hbLegs, r.hbArms);
  return t;
}
function currentSpread(def) {
  const moving = Math.min(1, Math.hypot(me.vel[0], me.vel[2]) / 5.6);
  let s = lerp(def.spread, def.adsSpread, adsT) + def.moveSpread * moving + (me.onGround ? 0 : 0.05) + bloom;
  if (me.crouch) s *= 0.75;
  return s;
}
function fireShot(w, now) {
  const def = w.def;
  w.ammo--;
  w.nextFire = now + 60000 / def.rpm;
  // shot number in the current spray (drives the gun's own recoil pattern); resets after a short pause
  w.sprayN = now - lastShotTime > Math.max(220, 60000 / def.rpm * 1.8) || curW() !== w ? 0 : (w.sprayN || 0) + 1;
  lastShotTime = now; sprintLock = 0.35;
  const { f, r, u } = camVectors();
  const origin = camera.position.clone();
  const muzzleWorld = origin.clone().addScaledVector(f, 0.7).addScaledVector(r, 0.14 * (1 - adsT)).addScaledVector(u, -0.09);
  const spread = currentSpread(def);
  if (vm && (def.flame || def.dart)) {
    // The gun is drawn with its own camera/FOV, so take the nozzle's on-screen position and put the effect
    // start just in front of the eye along that screen ray (matches what the player sees).
    const v = new THREE.Vector3(); vm.gun.userData.muzzle.getWorldPosition(v);
    const ndc = v.project(vmCamera);
    const p = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera).sub(origin).normalize();
    muzzleWorld.copy(origin).addScaledVector(p, 0.75);
  }
  if (def.projectile) {
    send({ t: 'rocket', o: origin.clone().addScaledVector(f, 0.6).toArray().map(n => +n.toFixed(2)), d: f.toArray().map(n => +n.toFixed(3)) });
  } else if (def.flame) {
    // flamethrower: a cone of short rays; each player in the cone takes one tick of damage (and burns, server-side)
    const targets = hitTargets(), hitMap = new Map();
    let reach = def.range;
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2, rr = p === 0 ? 0 : 0.11;
      const dir = f.clone().addScaledVector(r, Math.cos(a) * rr).addScaledVector(u, Math.sin(a) * rr).normalize();
      raycaster.set(origin, dir); raycaster.far = def.range;
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (!hit) continue;
      const pid = hit.object.userData.pid;
      if (pid) { if (!hitMap.has(pid)) hitMap.set(pid, { id: pid, dmg: Math.round(def.dmg * falloffMult(def, hit.distance)), h: 0 }); }
      else if (p === 0) reach = hit.distance;
    }
    const end = origin.clone().addScaledVector(f, reach);
    const fdir = end.clone().sub(muzzleWorld); const flen = fdir.length(); fdir.divideScalar(flen || 1);
    flameStream(muzzleWorld, fdir, flen);
    myFlame = { from: muzzleWorld.clone().sub(origin), dir: fdir, len: flen, t: now }; // keep the jet flowing every frame between ticks
    send({ t: 'fire', w: def.id, e: [end.toArray().map(n => +n.toFixed(2))], hits: [...hitMap.values()] });
  } else {
    const targets = hitTargets(), hitMap = new Map(), ends = [];
    for (let p = 0; p < def.pellets; p++) {
      const rr = spread * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      const dir = f.clone().addScaledVector(r, Math.cos(a) * rr).addScaledVector(u, Math.sin(a) * rr).normalize();
      raycaster.set(origin, dir); raycaster.far = def.range;
      const hit = raycaster.intersectObjects(targets, false)[0];
      let end;
      if (hit) {
        end = hit.point;
        const pid = hit.object.userData.pid;
        if (pid) {
          const head = hit.object.userData.head;
          const h = hitMap.get(pid) || { id: pid, dmg: 0, h: 0 };
          const close = def.dmgClose && hit.distance < def.falloff[0] ? 1 + def.dmgClose : 1;
          h.dmg += def.dmg * close * falloffMult(def, hit.distance) * (head ? def.head : hit.object.userData.limb ? 0.85 : 1); if (head) h.h = 1;
          hitMap.set(pid, h);
          blood(hit.point);
        } else impact(hit.point, hit.face.normal.clone().transformDirection(hit.object.matrixWorld), def.dart ? '#ff9a3a' : undefined);
      } else end = origin.clone().addScaledVector(dir, def.range);
      ends.push(end.toArray().map(n => +n.toFixed(2)));
      if (def.dart) tracer(muzzleWorld, end, true);
      else if (!def.suppressed && (p < 3 || Math.random() < 0.4)) tracer(muzzleWorld, end);
    }
    send({ t: 'fire', w: def.id, e: ends, s: def.suppressed ? 1 : 0, inc: def.incendiary ? 1 : 0, hits: [...hitMap.values()].map(h => ({ id: h.id, dmg: Math.round(h.dmg), h: h.h })) });
  }
  const kick = def.recoil * (1 - adsT * 0.4) * (me.crouch ? 0.8 * (def.crouchRecoil || 1) : 1);
  const [rv, rh] = recoilStep(def, w.sprayN || 0);
  me.pitch = clamp(me.pitch + kick * rv, -1.55, 1.55);
  me.yaw -= rh * kick * 0.55;
  recoilAcc += kick * rv * 0.75;
  vmRoll += (rh >= 0 ? 1 : -1) * Math.min(0.05, kick * 0.9);
  bloom = Math.min(0.06, bloom + def.recoil * 0.25 * (def.bloomMul || 1));
  kickZ = Math.min(0.12, kickZ + (def.flame ? 0.004 : 0.03 + def.recoil * 0.6));
  if (vm && !def.flame && !def.dart) { vm.flash.visible = true; vm.flash.material.rotation = Math.random() * 6.28; vm.flashT = 0.05; }
  if (!def.flame && !def.dart) flashLight(muzzleWorld, '#ffb060', def.projectile ? 80 : def.suppressed ? 6 : 25, 0.06);
  if (def.flame) SFX.flame?.(); else SFX.shot(def.snd, def.suppressed ? 0.45 : 1, 0);
  if (def.bolt || def.pump) { w.actT = def.bolt || Math.min(0.55, 60 / def.rpm * 0.85); w.actTotal = w.actT; setTimeout(() => SFX.click(), 140); }
  if (def.projectile && vm?.gun.userData.warhead) vm.gun.userData.warhead.visible = false;
  if (w.ammo <= 0 && def.ping) setTimeout(() => SFX.reloadSfx?.('ping'), 60);           // Garand clip ejects with a ping
  if (w.ammo <= 0 && w.reserve > 0) setTimeout(() => { if (curW() === w && w.ammo <= 0) startReload(); }, 250);
}
function melee(w, now) {
  w.nextFire = now + 60000 / w.def.rpm;
  meleeAnim = 0.3; SFX.swish();
  const { f } = camVectors();
  raycaster.set(camera.position, f); raycaster.far = w.def.range;
  const hit = raycaster.intersectObjects(hitTargets(), false)[0];
  if (hit && hit.object.userData.pid) {
    const head = hit.object.userData.head;
    blood(hit.point);
    send({ t: 'fire', w: 'knife', e: [], hits: [{ id: hit.object.userData.pid, dmg: Math.round(w.def.dmg * (head ? w.def.head : 1)), h: head ? 1 : 0 }] });
  } else if (hit) impact(hit.point, hit.face.normal.clone().transformDirection(hit.object.matrixWorld), '#ddd');
}
function updateWeapon(dt, now) {
  const w = curW(); if (!w) return;
  const def = w.def;
  if (drawT > 0) drawT -= dt;
  if (w.actT > 0) w.actT = Math.max(0, w.actT - dt);
  // shotguns loading shell-by-shell can fire mid-reload
  if (w.reloadT > 0 && def.shellTime && mouseL && triggerFresh && w.ammo > 0) { w.reloadT = 0; $('reloadbar').style.display = 'none'; }
  if (w.reloadT > 0) {
    w.reloadT -= dt;
    $('reloadbar').style.display = 'block';
    $('reloadbar').firstElementChild.style.width = (100 * (def.shellTime ? (w.ammo + 1 - w.reloadT / w.reloadTotal) / def.mag : 1 - w.reloadT / w.reloadTotal)) + '%';
    if (w.reloadT <= 0) {
      if (def.shellTime) {
        if (w.reserve > 0) { w.ammo++; w.reserve--; SFX.click(); }
        if (w.ammo < def.mag && w.reserve > 0) { w.reloadTotal = def.shellTime; w.reloadT = def.shellTime; }
        else { w.reloadT = 0; $('reloadbar').style.display = 'none'; w.actT = 0.45; w.actTotal = 0.45; }
      } else {
        const take = Math.min(def.mag - w.ammo, w.reserve);
        w.ammo += take; w.reserve -= take; w.reloadT = 0;
        $('reloadbar').style.display = 'none';
        if (def.projectile && vm?.gun.userData.warhead) vm.gun.userData.warhead.visible = true;
      }
    }
  }
  if (w.burstLeft > 0 && now >= w.nextFire) {
    if (w.ammo > 0) { fireShot(w, now); w.burstLeft--; } else w.burstLeft = 0;
    if (w.burstLeft === 0) w.nextFire = now + def.burstDelay * 1000;
  }
  if (mouseL && me.alive && !matchEnded && !throwAnim) {
    if (isSprinting()) sprintLock = 0.25;
    else if (drawT <= 0 && w.reloadT <= 0) {
      if (def.melee) { if (now >= w.nextFire) melee(w, now); }
      else if (w.burstLeft === 0 && now >= w.nextFire && (def.auto || triggerFresh)) {
        if (w.ammo <= 0) { if (triggerFresh) { SFX.click(); if (w.reserve > 0) startReload(); } }
        else if (def.burst) w.burstLeft = def.burst;
        else fireShot(w, now);
      }
    }
    triggerFresh = false;
  }
  bloom = Math.max(0, bloom - dt * 0.08);
  const rec = Math.min(recoilAcc, dt * (recoilAcc * 6 + 0.02));
  if (now - lastShotTime > 90) { me.pitch -= rec; recoilAcc -= rec; }
}
const isSprinting = () => keys.ShiftLeft && keys.KeyW && !keys.KeyS && !me.crouch && adsT < 0.3 && me.onGround && sprintLock <= 0;

// ================================================================ movement (with slide)
let wasGround = true, fallVel = 0, padFlight = false, stepOff = 0;
const FALL_SAFE = Math.sqrt(2 * PLAYER.gravity * 4.5); // landing speed of a 4.5 m drop (~14 m/s)
const slide = { t: 0, cd: 0, dir: [0, 0], wasCrouchKey: false, roll: 0 };
const SLIDE_TIME = 0.8, SLIDE_SPEED = 12.5;

// ---- mantle / window vault
let mantle = null, spaceWas = false, probeT = 0;
function blockedAt(x, y, z, r, h, boxes) {
  for (const b of boxes) if (x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2] && y + h > b.min[1] && y < b.max[1]) return true;
  return false;
}
function probeMantle(near) {
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw), feet = me.pos[1];
  for (const hp of [0.45, 0.9, 1.45]) {
    const hit = raycastBoxes([me.pos[0], feet + hp, me.pos[2]], [fx, 0, fz], 0.85, near);
    if (!hit || hit.normal[1] !== 0) continue;
    const px = hit.point[0] + fx * 0.04, pz = hit.point[2] + fz * 0.04, py = hit.point[1];
    const box = near.find(b => px >= b.min[0] - 1e-3 && px <= b.max[0] + 1e-3 && pz >= b.min[2] - 1e-3 && pz <= b.max[2] + 1e-3 && py >= b.min[1] && py <= b.max[1]);
    if (!box || box.m === 'wall') continue;
    const top = box.max[1], rise = top - feet;
    if (rise < 0.5 || rise > 2.3) continue;
    const tx = fx > 1e-6 ? (box.max[0] - px) / fx : fx < -1e-6 ? (box.min[0] - px) / fx : Infinity;
    const tz = fz > 1e-6 ? (box.max[2] - pz) / fz : fz < -1e-6 ? (box.min[2] - pz) / fz : Infinity;
    const thick = Math.min(tx, tz), ch = PLAYER.crouchHeight;
    const onX = px + fx * Math.min(0.3, thick / 2), onZ = pz + fz * Math.min(0.3, thick / 2);
    if (blockedAt(onX, top + 0.02, onZ, 0.22, ch, near)) continue;
    if (thick < 0.9) { // thin: vault over / through (e.g. window sills, low walls)
      const qx = px + fx * (thick + 0.45), qz = pz + fz * (thick + 0.45);
      if (!blockedAt(qx, top + 0.02, qz, 0.3, ch, near)) return { top, rise, end: [qx, top + 0.02, qz] };
    }
    const ex = px + fx * 0.4, ez = pz + fz * 0.4; // wide: climb on top
    if (thick >= 0.6 && !blockedAt(ex, top + 0.02, ez, 0.3, ch, near)) return { top, rise, end: [ex, top + 0.02, ez] };
  }
  return null;
}
function startMantle(m) {
  mantle = { t: 0, dur: 0.26 + m.rise * 0.1, from: [...me.pos], to: m.end, top: m.top };
  me.vel = [0, 0, 0]; me.crouch = true; me.height = PLAYER.crouchHeight; slide.t = 0;
  SFX.land(); kickZ += 0.05;
}
function updateMantle(dt) {
  mantle.t += dt;
  const k = Math.min(1, mantle.t / mantle.dur), ease = x => x * x * (3 - 2 * x);
  const ky = Math.min(1, k / 0.55), kx = Math.max(0, (k - 0.25) / 0.75);
  me.pos[1] = lerp(mantle.from[1], mantle.top + 0.05, ease(ky));
  me.pos[0] = lerp(mantle.from[0], mantle.to[0], ease(kx));
  me.pos[2] = lerp(mantle.from[2], mantle.to[2], ease(kx));
  me.eyeH = lerp(me.eyeH, PLAYER.crouchEye, Math.min(1, dt * 12));
  if (k >= 1) { me.pos = [...mantle.to]; me.vel = [-Math.sin(me.yaw) * 2.5, 0, -Math.cos(me.yaw) * 2.5]; me.onGround = false; mantle = null; }
}
function throwNade(which) {
  if (!me.alive || matchEnded || isZombie()) return;
  const kind = which === 'tactical' ? cfg.tactical : cfg.lethal;
  if (!PR.isUnlocked(kind)) return;
  if (which === 'tactical') { if (tacsLeft <= 0) return; tacsLeft--; } else { if (nadesLeft <= 0) return; nadesLeft--; }
  if (throwAnim) { if (which === 'tactical') tacsLeft++; else nadesLeft++; return; }
  // wind up, pull the pin, throw: the gun drops out of view and an arm with the grenade swings through
  startThrowAnim(kind, () => {
    if (!me.alive) return;
    const { f } = camVectors();
    const o = camera.position.clone().addScaledVector(f, 0.5);
    const knife = kind === 'tknife';
    const v = knife ? f.clone().multiplyScalar(30) : f.clone().multiplyScalar(15).add(new THREE.Vector3(me.vel[0] * 0.5, 3.2, me.vel[2] * 0.5));
    send({ t: 'nade', k: kind, o: o.toArray().map(n => +n.toFixed(2)), v: v.toArray().map(n => +n.toFixed(2)) });
    SFX.swish(); kickZ += 0.05;
  });
}
let throwAnim = null;
const THROW_TIME = 0.62, THROW_RELEASE = 0.36;
function throwableModel(kind) {
  const g = new THREE.Group(), mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.3, ...o });
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, rz = 0) => { const me_ = new THREE.Mesh(geo, m); me_.position.set(x, y, z); me_.rotation.set(rx, 0, rz); g.add(me_); return me_; };
  if (kind === 'frag') { add(new THREE.SphereGeometry(0.034, 12, 10), mat('#4a5530')); add(new THREE.CylinderGeometry(0.012, 0.014, 0.022, 10), mat('#8a8f96', { metalness: 0.8 }), 0, 0.038); add(new THREE.BoxGeometry(0.008, 0.05, 0.012), mat('#8a8f96', { metalness: 0.8 }), 0.016, 0.022, 0, 0, -0.2); add(new THREE.TorusGeometry(0.01, 0.0025, 6, 12), mat('#c9ced4', { metalness: 1 }), -0.014, 0.05); }
  else if (kind === 'semtex') { add(new THREE.BoxGeometry(0.07, 0.04, 0.05), mat('#d8c9a0')); add(new THREE.BoxGeometry(0.02, 0.012, 0.02), new THREE.MeshBasicMaterial({ color: '#ff2a2a' }), 0, 0.026); add(new THREE.BoxGeometry(0.072, 0.006, 0.052), mat('#222'), 0, -0.008); }
  else if (kind === 'molotov') { add(new THREE.CylinderGeometry(0.03, 0.032, 0.11, 12), mat('#2f6b3a', { transparent: true, opacity: 0.85, roughness: 0.1 })); add(new THREE.CylinderGeometry(0.011, 0.016, 0.05, 10), mat('#2f6b3a', { roughness: 0.1 }), 0, 0.078); add(new THREE.BoxGeometry(0.02, 0.05, 0.02), mat('#f0e2c0', { emissive: new THREE.Color('#ff7a1a'), emissiveIntensity: 0.6 }), 0, 0.12); }
  else if (kind === 'tknife') { add(new THREE.BoxGeometry(0.006, 0.02, 0.13), mat('#c9ced4', { metalness: 1, roughness: 0.2 }), 0, 0, -0.06); add(new THREE.BoxGeometry(0.012, 0.022, 0.06), mat('#1b1d20'), 0, 0, 0.035); }
  else { const col = kind === 'smoke' ? '#7b8188' : kind === 'flash' ? '#2b2f35' : '#2d4f86'; add(new THREE.CylinderGeometry(0.028, 0.028, 0.1, 14), mat(col)); add(new THREE.CylinderGeometry(0.029, 0.029, 0.014, 14), mat(kind === 'flash' ? '#d8d23a' : '#e6e6e6'), 0, 0.02); add(new THREE.CylinderGeometry(0.012, 0.014, 0.02, 10), mat('#8a8f96', { metalness: 0.8 }), 0, 0.06); }
  return g;
}
function startThrowAnim(kind, release) {
  const g = new THREE.Group();
  const cs = charSkin(cfg.cskin);
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.34), new THREE.MeshStandardMaterial({ color: cs.body || '#4b5a32', roughness: 0.85 }));
  sleeve.position.set(0, 0, 0.17);
  const glove = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.07, 0.09), new THREE.MeshStandardMaterial({ color: '#2a2c2f', roughness: 0.8 }));
  glove.position.set(0, 0.0, -0.03);
  const nade = throwableModel(kind); nade.position.set(0, 0.045, -0.06);
  g.add(sleeve, glove, nade); g.scale.setScalar(0.8); vmScene.add(g);
  throwAnim = { t: 0, g, nade, release, released: false, kind };
  if (kind !== 'tknife') setTimeout(() => SFX.reloadSfx?.('pin'), 120);
}
function updateThrowAnim(dt) {
  const a = throwAnim; if (!a) return 0;
  a.t += dt;
  const p = a.t / THROW_TIME;
  if (!a.released && a.t >= THROW_RELEASE) { a.released = true; a.nade.visible = false; a.release(); }
  // arm path: raise into view (0-0.3), pull back over the shoulder (0.3-0.55), whip forward (0.55-0.75), drop away
  const up = ease(seg(p, 0, 0.3)), back = ease(seg(p, 0.3, 0.55)), fwd = ease(seg(p, 0.55, 0.75)), away = ease(seg(p, 0.78, 1));
  a.g.position.set(0.22 - 0.06 * fwd, -0.42 + 0.3 * up + 0.08 * back - 0.05 * fwd - 0.4 * away, -0.42 + 0.14 * back - 0.3 * fwd);
  a.g.rotation.set(-0.3 + 0.9 * back - 1.5 * fwd, 0.25 - 0.2 * fwd, -0.2 + 0.2 * back);
  if (p >= 1) { vmScene.remove(a.g); disposeObject(a.g); throwAnim = null; drawT = 0.3; return 0; }
  return Math.sin(Math.PI * Math.min(1, p * 1.2));                                    // how far the gun is lowered
}

function updateMovement(dt) {
  const w = curW();
  const near = nearBoxes(me.pos[0], me.pos[2]);
  if (mantle) { updateMantle(dt); return; }
  const spaceEdge = keys.Space && !spaceWas; spaceWas = !!keys.Space;
  if (keys.KeyW && (spaceEdge || (keys.Space && !me.onGround && me.vel[1] < 2))) { const m = probeMantle(near); if (m) { startMantle(m); return; } }
  if ((probeT -= dt) <= 0) { probeT = 0.15; $('vaulthint').classList.toggle('hidden', !(keys.KeyW && probeMantle(near))); }
  const wantCrouch = !!(keys.KeyC || keys.ControlLeft);
  const hsNow = Math.hypot(me.vel[0], me.vel[2]);
  if (wantCrouch && !slide.wasCrouchKey && slide.t <= 0 && slide.cd <= 0 && me.onGround && keys.ShiftLeft && hsNow > 6) {
    slide.t = SLIDE_TIME; slide.cd = 0.5;
    slide.dir = [me.vel[0] / hsNow, me.vel[2] / hsNow];
    SFX.slide();
  }
  slide.wasCrouchKey = wantCrouch;
  if (slide.cd > 0 && slide.t <= 0) slide.cd -= dt;
  if (wantCrouch || slide.t > 0) me.crouch = true;
  else if (me.crouch && canStand(me, near)) me.crouch = false;
  me.height = me.crouch ? PLAYER.crouchHeight : PLAYER.height;

  const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), str = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
  let wx = -sy * fwd + cy * str, wz = -cy * fwd - sy * str;
  const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
  const sprint = isSprinting();
  let speed = (sprint ? 8.4 : me.crouch ? 3.0 : 5.6) * (w ? w.def.speed : 1) * (adsT > 0.5 ? 0.62 : 1) * (hasPerk('lightweight') ? 1.07 : 1);
  if (matchEnded) speed *= 0.6;
  if (isZombie()) speed *= 1.25;
  if (performance.now() < spdUntil) speed *= 1.3;
  if (performance.now() < stunUntil) speed *= 0.5;
  speed *= 0.72 + 0.28 * Math.max(0, Math.min(1, me.hp / 100)); // wounded = slower (down to -28% near death)
  if (slide.t > 0) {
    slide.t -= dt;
    const k = 1 - slide.t / SLIDE_TIME;
    const sp = lerp(SLIDE_SPEED, 3.5, k * k) * (w ? Math.min(1, w.def.speed + 0.05) : 1);
    if (wl > 0) {
      const steer = Math.min(1, dt * 2.5);
      slide.dir[0] += (wx - slide.dir[0]) * steer; slide.dir[1] += (wz - slide.dir[1]) * steer;
      const l = Math.hypot(slide.dir[0], slide.dir[1]) || 1; slide.dir[0] /= l; slide.dir[1] /= l;
    }
    me.vel[0] = slide.dir[0] * sp; me.vel[2] = slide.dir[1] * sp;
    if (keys.Space && me.onGround) { slide.t = 0; me.vel[1] = PLAYER.jump; me.onGround = false; }
    if (me.blocked) slide.t = 0;
    if (Math.random() < 0.6) particle(new THREE.Vector3(me.pos[0], me.pos[1] + 0.05, me.pos[2]), new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2), world.map.theme === 'snow' ? '#ffffff' : '#9a9080', 0.04, 0.4, 4);
  } else {
    const accel = me.onGround ? 14 : 2.5;
    me.vel[0] += (wx * speed - me.vel[0]) * Math.min(1, accel * dt);
    me.vel[2] += (wz * speed - me.vel[2]) * Math.min(1, accel * dt);
    if (spaceEdge && me.onGround) { me.vel[1] = PLAYER.jump; me.onGround = false; }
  }
  slide.roll = lerp(slide.roll, slide.t > 0 ? 1 : 0, Math.min(1, dt * 10));
  fallVel = me.vel[1];
  const yBefore = me.pos[1], groundBefore = me.onGround;
  moveBody(me, dt, near);
  // Stairs: going down, stay on the steps instead of dropping off each one; going up or down, the camera eases
  // over the step instead of snapping (stepOff is added to the eye height and fades out).
  if (groundBefore && !me.onGround && me.vel[1] <= 0 && !me.padded && !mantle) {
    let top = -Infinity;
    const r = PLAYER.radius * 0.8;
    for (const b of near) if (me.pos[0] + r > b.min[0] && me.pos[0] - r < b.max[0] && me.pos[2] + r > b.min[2] && me.pos[2] - r < b.max[2] && b.max[1] <= yBefore + 0.01 && b.max[1] >= yBefore - 0.42) top = Math.max(top, b.max[1]);
    if (yBefore - 0.42 <= 0 && yBefore > 0.001) top = Math.max(top, 0);
    if (top > -Infinity) { me.pos[1] = top; me.vel[1] = 0; me.onGround = true; }
  }
  if (groundBefore && me.onGround) { const dy = me.pos[1] - yBefore; if (Math.abs(dy) > 0.02 && Math.abs(dy) <= PLAYER.stepUp + 0.02) stepOff = clamp(stepOff - dy, -0.6, 0.6); }
  if (me.padded) { SFX.jet(); kickZ += 0.06; shake = Math.max(shake, 0.15); padFlight = true; }
  if (me.onGround && !wasGround && fallVel < -7) { SFX.land(); kickZ += 0.03; }
  // fall damage: starts at a ~4.5 m drop, lethal around 17 m (jump-pad flights don't count)
  if (me.onGround && !wasGround) {
    if (fallVel < -FALL_SAFE && !padFlight && !matchEnded && !hasPerk('lightweight')) { send({ t: 'fall', v: +(-fallVel).toFixed(2) }); kickZ += 0.08; shake = Math.max(shake, 0.25); }
    padFlight = false;
  }
  wasGround = me.onGround;
  const hs = Math.hypot(me.vel[0], me.vel[2]);
  if (me.onGround && hs > 1) {
    bobPhase += dt * hs * 1.6; stepDist += hs * dt;
    if (stepDist > (sprint ? 2.6 : 2.1)) { stepDist = 0; if (!me.crouch && slide.t <= 0) SFX.step(0.12, world.map.theme === 'snow'); }
  }
  me.eyeH = lerp(me.eyeH, me.crouch ? PLAYER.crouchEye : PLAYER.eye, Math.min(1, dt * 12));
  if (sprintLock > 0) sprintLock -= dt;
}

// ================================================================ reload + action animations
// Moves the gun's animated parts (mag, bolt, pump, break barrels, feed cover, fuel tank, left hand)
// and returns an extra offset/rotation for the whole gun.
const ease = x => x * x * (3 - 2 * x);
const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
function animateParts(g, w, def) {
  const P = g.userData.parts || {}, out = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
  for (const p of Object.values(P)) { const b = p.userData.base; if (b) { p.position.copy(b.pos); p.rotation.copy(b.rot); p.visible = true; } }
  const hand = g.userData.leftHand, hb = g.userData.leftBase;
  if (hand && hb) hand.position.copy(hb);
  const rp = w.reloadT > 0 ? 1 - w.reloadT / w.reloadTotal : -1;
  if (rp >= 0) {
    const env = Math.sin(Math.PI * Math.min(1, rp * 1.15)) ** 0.7;   // lift into reload pose and back
    const anim = def.anim;
    if (anim === 'shells') {                                          // shell by shell: roll the gun, thumb shells into the port
      out.rz = 0.45; out.rx = -0.12; out.y = -0.03;
      if (hand && hb) { const k = Math.sin(Math.PI * rp); hand.position.set(hb.x + 0.02, hb.y - 0.02 * k, hb.z + 0.18 + 0.06 * k); }
    } else if (anim === 'break') {                                    // tip the barrels open, drop shells, close
      const open = rp < 0.15 ? ease(rp / 0.15) : rp > 0.82 ? ease((1 - rp) / 0.18) : 1;
      if (P.brk) P.brk.rotation.x = -0.75 * open;
      out.rx = 0.35 * open; out.y = -0.04 * open; out.z = 0.04 * open;
      if (hand && hb && rp > 0.25 && rp < 0.8) hand.position.set(hb.x, hb.y - 0.12 * Math.sin(Math.PI * seg(rp, 0.25, 0.8)), hb.z + 0.1);
    } else if (anim === 'revolver') {
      out.rz = 0.9 * env; out.rx = -0.2 * env; out.y = -0.04 * env;
    } else if (anim === 'clip') {                                     // bolt back, push a stripper clip in, bolt forward
      out.rz = 0.35 * env; out.rx = -0.12 * env;
      if (P.bolt) { const back = rp < 0.15 ? ease(rp / 0.15) : rp > 0.85 ? ease((1 - rp) / 0.15) : 1; P.bolt.rotation.z = P.bolt.userData.base.rot.z + 1.2 * back; P.bolt.position.z += 0.07 * back; }
      if (hand && hb && rp > 0.2 && rp < 0.8) hand.position.set(hb.x + 0.04, hb.y + 0.1 * Math.sin(Math.PI * seg(rp, 0.2, 0.8)), 0.0);
    } else {                                                          // magazine / box / tank / rocket swap, styled per gun
      const R = def.rl || { insert: 'push', charge: 'bolt', roll: 0.32, tilt: 0.22 }, charge = w.reloadTac ? 'none' : R.charge;
      // empty reloads leave the last 25% for working the action; tactical reloads spread the mag swap over it all
      const mp = charge === 'none' ? rp / 0.92 : rp / 0.75;
      out.rz = R.roll * env; out.rx = -(R.tilt ?? 0.22) * env; out.y = -0.05 * env;
      if (R.insert === 'behind') { out.ry = -0.25 * env; out.z = -0.04 * env; }                // bullpup: swing the butt round to you
      if (anim === 'belt' && P.cover) P.cover.rotation.x = 1.25 * Math.sin(Math.PI * seg(rp, 0.05, 0.9));
      const m = P.mag || P.tank;
      if (m) {
        const out1 = ease(seg(mp, 0.08, 0.34)), in1 = ease(seg(mp, 0.52, 0.86));
        const drop = mp < 0.43 ? out1 : 1 - in1;
        if (R.insert === 'rock') { m.rotation.x -= 0.55 * Math.min(1, drop * 2.2); m.position.y -= 0.24 * Math.max(0, drop * 1.4 - 0.4); m.position.z -= 0.02 * drop; }
        else if (R.insert === 'drum') { m.position.z -= 0.12 * drop; m.position.y -= 0.18 * drop; m.rotation.z += 1.4 * drop; }
        else if (R.insert === 'helical') { m.position.z -= 0.3 * drop; m.position.y -= 0.06 * drop; }
        else { m.position.y -= 0.28 * drop; m.rotation.x += (R.insert === 'behind' ? -0.25 : 0.35) * drop; m.position.z += 0.02 * drop; }
        m.visible = !(mp > 0.36 && mp < 0.52);
        if (R.bump && mp > 0.84 && mp < 0.94) out.y += 0.018 * Math.sin(Math.PI * seg(mp, 0.84, 0.94));   // palm slap home
        if (hand && hb) { const k = Math.sin(Math.PI * seg(mp, 0.1, 0.9)); hand.position.lerpVectors(hb, new THREE.Vector3(m.userData.base.pos.x, m.position.y - 0.05, m.userData.base.pos.z + 0.04), k); }
      }
      // work the action after an empty mag
      const cp = seg(rp, 0.76, 0.98), ck = Math.sin(Math.PI * cp);
      if (charge === 'bolt') {
        if (P.bolt) P.bolt.position.z += 0.06 * ck;
        if (hand && hb && cp > 0) hand.position.lerp(new THREE.Vector3(0.05, 0.06, -0.05), ck);
        out.rz += 0.12 * ck * Math.sign(R.roll || 1);
      } else if (charge === 'slap') {                                    // HK slap: hand up to the cocking tube, slam it forward
        if (P.bolt) P.bolt.position.z += 0.05 * Math.sin(Math.PI * Math.min(1, cp * 1.6));
        if (hand && hb && cp > 0) hand.position.lerp(new THREE.Vector3(-0.04, 0.07, -0.25), ck);
        out.ry += 0.12 * ck; out.y += cp > 0.62 && cp < 0.75 ? -0.012 : 0;
      } else if (charge === 'release') { out.rz += 0.06 * ck; out.y -= 0.01 * Math.sin(Math.PI * seg(cp, 0.4, 0.6)); }
      else if (charge === 'slide') { out.rx += 0.18 * ck; out.z += 0.03 * ck; if (P.slide) P.slide.position.z += 0.03 * ck; }
      // reload sounds, once each per reload
      const fire = (bit, at, kind) => { if (rp >= at && !(w.rsfx & bit)) { w.rsfx |= bit; SFX.reloadSfx?.(kind); } };
      fire(1, (charge === 'none' ? 0.92 : 0.75) * 0.24, 'out');
      fire(2, (charge === 'none' ? 0.92 : 0.75) * 0.8, 'in');
      if (charge !== 'none') fire(4, 0.86, 'bolt');
    }
  }
  // bolt-action / pump cycling after a shot
  if (w.actT > 0 && rp < 0) {
    const ap = 1 - w.actT / (w.actTotal || 1), e = Math.sin(Math.PI * ap);
    if (def.bolt) {
      out.rz += 0.18 * e; out.y -= 0.015 * e;
      if (P.bolt) { P.bolt.rotation.z = P.bolt.userData.base.rot.z + 1.1 * Math.sin(Math.PI * Math.min(1, ap * 1.4)); P.bolt.position.z += 0.06 * e; }
    }
    if (def.pump || def.shellTime) {
      if (P.pump) P.pump.position.z += 0.07 * e;
      if (hand && hb) hand.position.z += 0.07 * e;
      out.rx -= 0.05 * e;
    }
  }
  return out;
}

// ================================================================ camera + viewmodel
function updateCamera(dt, now) {
  const w = curW(), def = w?.def;
  if (inGame && me.alive) {
    stepOff *= Math.exp(-dt * 13); if (Math.abs(stepOff) < 0.002) stepOff = 0;
    camera.position.set(me.pos[0], me.pos[1] + me.eyeH + stepOff, me.pos[2]);
    camera.rotation.set(me.pitch, me.yaw, slide.roll * 0.07);
  } else if (inGame && deathTime) {
    const k = Math.min(1, (now - deathTime) / 600);
    camera.position.set(me.pos[0], me.pos[1] + lerp(me.eyeH, 0.35, k), me.pos[2]);
    camera.rotation.set(me.pitch * (1 - k) - 0.2 * k, me.yaw, 0.5 * k);
  } else if (world) {
    const t = now * 0.00006, R = world.map.size * 0.6;
    camera.position.set(Math.sin(t) * R, world.map.size * 0.3, Math.cos(t) * R);
    camera.lookAt(0, 2, 0);
  }
  if (shake > 0) { camera.rotation.x += (Math.random() - 0.5) * shake * 0.1; camera.rotation.y += (Math.random() - 0.5) * shake * 0.1; shake = Math.max(0, shake - dt * 1.5); }
  sky.position.copy(camera.position);
  const wantAds = mouseR && me.alive && def && !def.melee && w.reloadT <= 0 && drawT <= 0.1 && !(def.bolt && def.scope && w.actT > 0.08);
  adsT = clamp(adsT + (wantAds ? dt : -dt) / (def?.ads || 0.17), 0, 1);
  const zoom = (def ? lerp(1, def.zoom, adsT) : 1) * (mouseM && me.alive ? 1.2 : 1);
  const targetFov = (inGame ? cfg.fov / zoom + (isSprinting() ? 6 : 0) + slide.roll * 10 : 60);
  if (Math.abs(camera.fov - targetFov) > 0.01) { camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt * 20)); camera.updateProjectionMatrix(); }
  const scoped = def?.scope && adsT > 0.85;
  $('scope').style.display = scoped && inGame ? 'block' : 'none';
  if (!vm || !def) return;
  vmHolder.visible = inGame && me.alive && !scoped;
  const g = vm.gun, sightY = g.userData.sightY;
  const hip = def.model === 'rocket' ? [0.24, -0.16, -0.32] : def.melee ? [0.22, -0.2, -0.32] : [0.2, -0.2, -0.42];
  const ads = def.model === 'rocket' ? [0.085, -0.12, -0.3] : [0, -sightY, g.userData.adsZ ?? -0.3];
  const hs = Math.hypot(me.vel[0], me.vel[2]);
  const bobAmt = me.onGround ? Math.min(1, hs / 6) * (1 - adsT * 0.85) * (slide.t > 0 ? 0.2 : 1) : 0;
  const bx = Math.sin(bobPhase) * 0.012 * bobAmt, by = -Math.abs(Math.cos(bobPhase)) * 0.012 * bobAmt;
  kickZ = Math.max(0, kickZ - dt * 0.6); kickZ *= Math.pow(0.0001, dt); vmRoll *= Math.pow(0.0005, dt);
  swayX *= Math.pow(0.002, dt); swayY *= Math.pow(0.002, dt);
  g.userData.sprintK = lerp(g.userData.sprintK || 0, isSprinting() ? 1 : 0, Math.min(1, dt * 10));
  const sk = g.userData.sprintK, draw = Math.max(0, drawT) / 0.35;
  const A = animateParts(g, w, def);
  const thr = updateThrowAnim(dt); if (thr) { A.y -= 0.32 * thr; A.rx -= 0.6 * thr; A.x -= 0.05 * thr; }
  g.position.set(
    lerp(hip[0], ads[0], adsT) + bx - swayX * (1 - adsT * 0.7) - sk * 0.05 - slide.roll * 0.04 * (1 - adsT) + A.x,
    lerp(hip[1], ads[1], adsT) + by + swayY * (1 - adsT * 0.7) - draw * 0.25 - sk * 0.03 + A.y,
    lerp(hip[2], ads[2], adsT) + kickZ + A.z);
  g.rotation.set(kickZ * 0.8 - draw * 0.8 + sk * -0.25 + A.rx, sk * 0.7 + swayX * 2 + A.ry, sk * 0.2 + slide.roll * 0.35 * (1 - adsT) + vmRoll * (1 - adsT * 0.6) + A.rz);
  if (def.melee && meleeAnim > 0) {
    meleeAnim -= dt;
    const k = Math.sin((1 - meleeAnim / 0.3) * Math.PI);
    g.position.x -= k * 0.18; g.position.z -= k * 0.15; g.rotation.y += k * 1.2; g.rotation.z -= k * 0.6;
  }
  if (vm.flashT > 0) { vm.flashT -= dt; if (vm.flashT <= 0) vm.flash.visible = false; }
  if (g.userData.skin.userData.pulse) g.userData.skin.emissiveIntensity = 1.2 + Math.sin(now * 0.004) * 0.6;
}

// ================================================================ remote update
// ---- network clock: place snapshots on the server's own clock (ms), not on arrival time,
// so bursty internet connections don't make other players skip back and forth.
// Remote players' updates are kept in their buffers on the SERVER's clock and converted with the current
// offset only when drawn, so a re-estimate of the offset after a connection hiccup can never make fresh
// updates look "older than what we have" and get thrown away (that froze everyone for seconds).
const net = { off: null, jitter: 0, lastK: -1, srv: false };
function netClock(k, now) {
  if (typeof k !== 'number' || window.__netOld) return now; // older server (or A/B test of the old behaviour)
  net.srv = true;
  const st = k;
  const target = now - st;
  // re-base only for a server restart or a very long stall; ordinary late packets are what the min-tracking absorbs
  if (net.off === null || k < net.lastK || target - net.off > 5000) { net.off = target; net.jitter = 0; }
  else if (target < net.off) net.off = target;            // a packet arrived quicker: tighten
  else net.off += (target - net.off) * 0.01;              // otherwise drift slowly
  net.jitter = net.jitter * 0.95 + Math.abs(target - net.off) * 0.05;
  net.lastK = k;
  return st + net.off;
}
function updateRemotes(dt, now) {
  const baseJit = net.jitter;
  const off = net.srv && !window.__netOld && net.off !== null ? net.off : 0; // buffers are on the server clock
  for (const r of remotes.values()) {
    // bigger buffer on bumpier connections: ours from the server, plus that player's upload to the server
    const delay = window.__netOld ? 110 : clamp(80 + (baseJit + (r.jit || 0)) * 2.5, 80, 400);
    const renderT = now - off - delay;
    const b = r.buf;
    if (!b.length) { r.model.visible = false; continue; }
    let a = b[0], c = b[0], ext = 0;
    const last = b[b.length - 1];
    if (renderT >= last.t && b.length > 1 && !window.__netOld) {
      // ran out of updates: keep moving along the last direction briefly instead of freezing then snapping
      a = b[b.length - 2]; c = last; ext = Math.min(renderT - last.t, 150);
    } else for (let i = b.length - 1; i >= 0; i--) if (b[i].t <= renderT) { a = b[i]; c = b[i + 1] || b[i]; break; }
    const span = c.t - a.t;
    const k = span > 0 ? (ext ? 1 + ext / span : clamp((renderT - a.t) / span, 0, 1)) : 0;
    const x = lerp(a.x, c.x, k), y = lerp(a.y, c.y, k), z = lerp(a.z, c.z, k);
    let dy = c.ry - a.ry; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    const ry = a.ry + dy * k, rx = lerp(a.rx, c.rx, k);
    const m = r.model, P = m.userData;
    const prev = r.prev || [x, y, z];
    const spd = Math.hypot(x - prev[0], z - prev[2]) / Math.max(dt, 0.001);
    r.prev = [x, y, z];
    m.position.set(x, y, z);
    if (r.alive) {
      r.deathT = 0; m.visible = true;
      m.rotation.set(0, ry, 0);
      P.aim.rotation.x = rx; P.head.rotation.x = rx * 0.5;
      const sp = Math.min(1, spd / 5);
      r.walk += dt * spd * 1.9;
      P.legs[0].rotation.x = Math.sin(r.walk) * 0.7 * sp;
      P.legs[1].rotation.x = -Math.sin(r.walk) * 0.7 * sp;
      r.cr = lerp(r.cr || 0, a.c ? 1 : 0, Math.min(1, dt * 10));
      P.lower.scale.y = 1 - r.cr * 0.4;
      P.upper.position.y = 0.88 - r.cr * 0.45;
      r.hbHead.position.y = 1.72 - r.cr * 0.45; r.hbBody.position.y = 1.17 - r.cr * 0.45; r.hbArms.position.y = 1.3 - r.cr * 0.45;
      r.hbLegs.position.y = 0.44 - r.cr * 0.22; r.hbLegs.scale.y = 1 - r.cr * 0.5;
      if ((r.losT = (r.losT || 0) - dt) <= 0) {
        r.losT = 0.15;
        const head = [x, y + 1.7, z], o = camera.position.toArray();
        const d = [head[0] - o[0], head[1] - o[1], head[2] - o[2]], L = Math.hypot(...d);
        r.tag.visible = r.mate ? L < 120 : !r.info.pk?.includes('coldblood') && L < 45 && !raycastBoxes(o, d.map(v => v / L), L, world.map.query(o[0], o[2], head[0], head[2]));
      }
    } else {
      r.deathT += dt;
      const k2 = Math.min(1, r.deathT * 3);
      m.rotation.set(-k2 * Math.PI / 2, ry, 0);
      m.position.y = y + k2 * 0.15;
      r.tag.visible = false;
      m.visible = r.deathT < 3.2;
    }
    if (r.flashT > 0) { r.flashT -= dt; if (r.flashT <= 0) r.flash.visible = false; }
  }
}

// ================================================================ networking
// Playing in a friend's game: a lobby code from another game sends us to that game's address with
// ?join=CODE&home=<our own game>, and leaving the lobby brings us back home.
const urlQ = new URLSearchParams(location.search);
let pendingJoin = /^[A-Z]{4}$/.test(urlQ.get('join') || '') ? urlQ.get('join') : null;
try { if (/^https?:\/\//.test(urlQ.get('home') || '')) sessionStorage.setItem('slHome', urlQ.get('home')); } catch {}
if (urlQ.has('lost')) setTimeout(() => toast("Your friend's game closed or went offline, so you're back in your own game."), 1500);
if (urlQ.has('join') || urlQ.has('home') || urlQ.has('lost')) history.replaceState(null, '', location.pathname);
const homeOrigin = (() => { try { return sessionStorage.getItem('slHome') || location.origin; } catch { return location.origin; } })();
const onFriendsGame = homeOrigin !== location.origin;
const goHome = () => { location.href = homeOrigin + '/'; };
let friendLostAt = 0;
function setNet(ok, text) { const n = $('netstatus'); n.className = ok ? 'ok' : 'bad'; n.querySelector('span').textContent = text; }
function connect() {
  if (location.protocol === 'file:') { setNet(false, 'Open via http://localhost:3080'); return; }
  setNet(false, 'Connecting…');
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => send({ t: 'hello', dev: PR.devCode(), name: cfg.name, skin: cfg.cskin, wskin: cfg.wskin, level: PR.levelInfo().level });
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } handle(m); };
  ws.onclose = () => {
    ws = null;
    if (inGame) endGameView();
    room = null;
    setNet(false, 'Disconnected — retrying…');
    if (currentScreen === 'scr-lobby' || currentScreen === 'scr-pause') go('scr-home');
    if (onFriendsGame) { // friend closed their game: back to our own after a few tries
      friendLostAt ||= Date.now();
      if (Date.now() - friendLostAt > 8000) { toast("Your friend's game closed. Going back to yours…"); setTimeout(goHome, 1200); return; }
    }
    toast('Lost connection to the server. Retrying…');
    setTimeout(connect, 2000);
  };
}
const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
// Report script errors / WebGL context loss to the server we're playing on (saved in errors.log there).
const reportErr = (msg) => { try { send({ t: 'clienterr', m: String(msg).slice(0, 1200), v: `${MAPS[world?.map.id]?.name || ''}` }); } catch {} };
window.addEventListener('error', e => reportErr(`${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}:${e.colno}\n${e.error?.stack || ''}`));
window.addEventListener('unhandledrejection', e => reportErr(`promise: ${e.reason?.stack || e.reason}`));

function handle(m) {
  const now = performance.now();
  switch (m.t) {
    case 'hi':
      sendLoadout();
      me.id = m.id; setNet(true, onFriendsGame ? "Online · in a friend's game" : 'Online'); friendLostAt = 0;
      if (pendingJoin) { send({ t: 'join', code: pendingJoin }); pendingJoin = null; }
      // Only the developer's own app (its local server) marks itself as the feedback owner.
      if (m.fbOwner && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) PR.store.set(FB_OWNER_KEY, '1');
      if (!m.fbOwner && PR.store.get(FB_OWNER_KEY) === '1') send({ t: 'fbowner' });
      // on the developer's server: hand over this PC's desktop crash log (app/game-page crashes) so they can be diagnosed
      if (m.fbOwner && window.desktop?.crashReport) window.desktop.crashReport().then(r => {
        if (r && r.text.trim()) setTimeout(() => { reportErr(`crash.log from this player's app:\n${r.text}`); window.desktop.crashReportSent(r.end); }, 3000);
      }).catch(() => {});
      fbFlush();
      break;
    case 'fback': { const ids = new Set(m.ids || []); fbSave(fbLoad().filter(f => !ids.has(f.id))); break; }
    case 'fbrelay': // feedback this server held for the developer: keep it and confirm, it's delivered at home
      if (Array.isArray(m.items)) { fbAdd(m.items); send({ t: 'fbrelayack', ids: m.items.map(f => f.id) }); }
      break;
    case 'lobbies': lobbies = [...m.list, ...(m.remote || []).map(l => ({ ...l, remote: true }))]; online = m.online; setNet(true, `Online · ${online} player${online === 1 ? '' : 's'}`); renderLobbyList(); break;
    case 'err': toast(m.m); $('loading').classList.add('hidden'); break;
    case 'toast': toast(m.m); break;
    case 'pong': { const rtt = performance.now() - m.c; perfStats.ping = perfStats.ping ? perfStats.ping * 0.7 + rtt * 0.3 : rtt; break; }
    case 'room': {
      const wasNull = !room;
      room = m.room;
      if (!inGame && room.state === 'lobby' && (wasNull || !['scr-lobby', 'pnl-loadout', 'pnl-skins', 'pnl-settings'].includes(currentScreen))) { closeCreate(); go('scr-lobby'); }
      renderLobby();
      if (wasNull) { $('lobbyChat').innerHTML = ''; }
      break;
    }
    case 'left': room = null; if (inGame) endGameView(); if (onFriendsGame) { goHome(); break; } go('scr-browser'); send({ t: 'list' }); break;
    case 'goto': { // the lobby is in a friend's game: go there and join it
      if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(m.url || '') || !/^[A-Z]{4}$/.test(m.code || '')) break;
      toast(`Joining lobby ${m.code} in your friend's game…`);
      $('loading')?.classList.remove('hidden');
      location.href = `${m.url}/?join=${m.code}&home=${encodeURIComponent(homeOrigin)}`;
      break;
    }
    case 'start': {
      me.id = m.id; scoreLimit = m.scoreLimit; timeLeft = m.time; matchEnded = m.phase === 'ended';
      matchStartedAt = Date.now();
      mode = m.mode || 'ffa'; target = m.target ?? scoreLimit; teamScore = m.teamScore || [0, 0];
      zone = m.zone ? { x: m.zone[0], z: m.zone[1], r: m.zone[2], state: -1, ttm: 60 } : null;
      uavUntil = 0; matchXP = 0; for (const k in matchXPReasons) delete matchXPReasons[k];
      streakReady = []; jamUntil = 0; myArmor = 0; sendLoadout(); renderArmor(); leadState = 0;
      if (m.phase !== 'ended') setTimeout(() => Announcer.say('start'), 1200);
      matchStart = { level: PR.levelInfo().level, credits: PR.profile.credits, wl: Object.fromEntries([...PRIMARIES, ...SECONDARIES].map(w => [w, PR.weaponLevel(w)])) };
      const mine = m.players.find(p => p.id === m.id);
      myTeam = mine ? mine.team : -1;
      ggWeapon = mode === 'gungame' ? (mine?.w || GUNGAME_LADDER[0]) : null;
      clearRemotes(); scores.clear();
      setupModeHud();
      world = world?.map.id === m.map ? world : (loadMap(m.map), world);
      for (const p of m.players) { addRemote(p); scores.set(p.id, [p.kills, p.deaths, p.score || 0, p.team, p.gg || 0, 0]); }
      inGame = true; me.alive = false; deathTime = 0;
      $('hud').classList.remove('hidden'); $('endscreen').classList.add('hidden'); $('deathscreen').classList.add('hidden');
      $('killfeed').innerHTML = ''; $('chatlog').innerHTML = '';
      wantLock = false;
      if (locked) hideUI(); else showPause(true);
      announce(MODES[mode].name.toUpperCase(), teamsMode() ? `YOU ARE ON TEAM ${teamName(mode, myTeam)} · ${MAPS[m.map].name}` : `${MAPS[m.map].name} · ${MODES[mode].desc}`);
      break;
    }
    case 'xp': {
      if (m.r === 'FIRST BLOOD') Announcer.say('firstblood');
      if (m.r === 'PAYBACK') Announcer.say('revenge');
      const gain = Math.max(1, Math.round(m.a * PR.XP_RATE));
      matchXP += gain;
      matchXPReasons[m.r] = (matchXPReasons[m.r] || 0) + gain;
      xpPopup(m.r, gain);
      const lvl = PR.addXP(m.a);
      if (lvl) levelUp(lvl);
      PR.challengeEvent('xp', {}, m.a);
      if (m.r === 'ZONE') challengeToasts(PR.challengeEvent('zone', {}, 1));
      if (m.r === 'ASSIST') challengeToasts(PR.challengeEvent('assist', {}, 1));
      updateProfileUI();
      break;
    }
    case 'gg': {
      const sc = scores.get(m.id); if (sc) sc[4] = m.lvl;
      if (m.id === me.id) {
        ggWeapon = m.w;
        challengeToasts(PR.challengeEvent('gg', {}, m.lvl + 1));
        if (me.alive) {
          me.weapons = makeWeapons(); me.slot = 0; equipViewmodel();
          subAnnounce(m.demoted ? 'DEMOTED! — ' + WEAPONS[m.w].name.toUpperCase() : `GUN ${m.lvl + 1}/${GUNGAME_LADDER.length} — ${WEAPONS[m.w].name.toUpperCase()}`);
        }
      }
      break;
    }
    case 'infected':
      if (m.id === me.id) { announce(m.first ? 'PATIENT ZERO' : 'YOU ARE INFECTED', 'Knife the survivors — one hit kills, and you are faster'); SFX.hurt(); }
      else subAnnounce(`${dnameOf(m.id).toUpperCase()} ${m.first ? 'IS PATIENT ZERO' : 'WAS INFECTED'}`);
      break;
    case 'pick': {
      const pm = world?.pickupMeshes?.[m.id]; if (pm) pm.visible = false;
      if (m.by !== me.id) break;
      const now2 = performance.now();
      if (m.kind === 'ammo') { for (const w of me.weapons) { w.reserve = Math.max(w.reserve, w.def.reserve); w.ammo = w.def.mag; } nadesLeft = 2; tacsLeft = 2; xpPopup('AMMO REFILLED', 0); }
      if (m.kind === 'health') xpPopup('+50 HEALTH', 0);
      if (m.kind === 'damage') { ddUntil = now2 + m.dur * 1000; announce('DOUBLE DAMAGE', `${m.dur} seconds`); SFX.announce(); }
      if (m.kind === 'speed') { spdUntil = now2 + m.dur * 1000; announce('SPEED BOOST', `${m.dur} seconds`); SFX.announce(); }
      SFX.uiBlip();
      break;
    }
    case 'tag': {
      const tg = fx.tags.get(m.id);
      if (tg) { scene.remove(tg); disposeObject(tg); fx.tags.delete(m.id); }
      if (m.by === me.id) {
        SFX.hit(true);
        subAnnounce(m.confirm ? 'KILL CONFIRMED' : 'KILL DENIED');
        if (m.confirm) challengeToasts(PR.challengeEvent('confirm'));
      }
      break;
    }
    case 'jam':
      if ((m.team >= 0 && m.team === myTeam) || m.by === me.id) { announce('JAMMER ONLINE', 'Enemy minimaps are scrambled'); Announcer.say('jammer'); }
      else { jamUntil = performance.now() + m.dur * 1000; subAnnounce('YOUR MINIMAP IS BEING JAMMED'); Announcer.say('jammed'); }
      break;
    case 'armor': myArmor = m.v; renderArmor(); break;
    case 'streakready':
      streakReady = m.ready || [];
      if (m.id) { announce(`${STREAKS[m.id].name.toUpperCase()} READY`, `Press ${5 + myStreaks.indexOf(m.id)} to use it`); SFX.announce(); Announcer.say('ready'); }
      renderStreakHud(); break;
    case 'streak':
      if (m.id === 'armor' && m.by === me.id) { announce('ARMOR UP', 'Your armour soaks up the next 60 damage'); Announcer.say('armor'); }
      break;
    case 'mortar':
      if (m.by === me.id) { announce('MORTAR BARRAGE', 'Shells incoming on your target'); Announcer.say('mortar'); }
      else if (!teamsMode() || nameTeam(m.by) !== myTeam) { subAnnounce('ENEMY MORTAR BARRAGE INBOUND'); Announcer.say('enemymortar'); }
      break;
    case 'airstrike':
      if (m.by === me.id) { announce('AIRSTRIKE INBOUND', 'Bombs away!'); Announcer.say('airstrike'); }
      else if (teamsMode() && m.team === myTeam) { subAnnounce(`FRIENDLY AIRSTRIKE — ${dnameOf(m.by).toUpperCase()}`); Announcer.say('airstrike'); }
      else { announce('ENEMY AIRSTRIKE', 'Take cover!'); Announcer.say('enemyair'); }
      SFX.jet();
      break;
    case 'uav':
      if ((m.team >= 0 && m.team === myTeam) || m.by === me.id) { uavUntil = performance.now() + m.dur * 1000; uavAdvanced = !!m.adv; announce(m.adv ? 'ADVANCED RADAR ONLINE' : 'RADAR ONLINE', 'Enemies are revealed on your minimap'); SFX.announce(); Announcer.say(m.adv ? 'advradar' : 'radar'); }
      else if (!teamsMode() || m.team !== myTeam) { subAnnounce('ENEMY RADAR IS UP'); Announcer.say('enemyradar'); }
      break;
    case 'lobby': endGameView(); go('scr-lobby'); renderLobby(); break;
    case 'pj': if (!inGame) break;
      if (m.p.id === me.id && m.p.team !== myTeam) {
        myTeam = m.p.team;
        for (const r of [...remotes.values()]) { const info = r.info; removeRemote(info.id); addRemote(info); } // refresh friend/foe colours
        if (me.alive) { me.weapons = makeWeapons(); me.slot = 0; equipViewmodel(); }
      }
      addRemote(m.p); if (!scores.has(m.p.id)) scores.set(m.p.id, [m.p.kills, m.p.deaths, m.p.score || 0, m.p.team, m.p.gg || 0, 0]); break;
    case 'pl': removeRemote(m.id); scores.delete(m.id); break;
    case 'snap': {
      if (!inGame) break;
      const st = netClock(m.k, now);
      for (const [id, x, y, z, ry, rx, w, c, hp, alive, pt, jit, hist] of m.ps) {
        if (id === me.id) { if (me.alive) me.hp = hp; continue; }
        const r = remotes.get(id); if (!r) continue;
        if (r.alive || alive) {
          // the in-between updates of a burst, so their movement is replayed in full rather than cut corners
          const srv = typeof m.k === 'number' && !window.__netOld; // times below are on the server's clock
          // add one update; same time = nothing new; clearly older = that player's clock was re-based, so start over
          const add = (t, e) => {
            const lastT = r.buf.length ? r.buf[r.buf.length - 1].t : -Infinity;
            if (t === lastT) return;
            if (t < lastT) { if (lastT - t > 300) r.buf.length = 0; else return; }
            e.t = t; r.buf.push(e); if (r.buf.length > 40) r.buf.shift();
          };
          if (Array.isArray(hist) && srv) for (const [ht, hx, hy, hz, hry, hrx, hc] of hist) add(ht, { x: hx, y: hy, z: hz, ry: hry, rx: hrx, c: hc });
          // newer servers say when the player was really at this spot (their send time), so a burst of late
          // updates from a laggy player plays back at the right pace instead of freeze → jump
          r.jit = typeof jit === 'number' ? jit : 0;
          add(srv ? (typeof pt === 'number' ? pt : m.k) : st, { x, y, z, ry, rx, c });
        }
        r.alive = !!alive; setRemoteGun(r, w);
      }
      const seen = new Set();
      for (const [id, x, y, z, dx, dy, dz] of m.r) {
        seen.add(id);
        let rk = fx.rockets.get(id);
        if (!rk) { rk = buildRocket(); scene.add(rk); fx.rockets.set(id, rk); }
        rk.position.set(x, y, z);
        rk.userData.vel = new THREE.Vector3(dx, dy, dz).multiplyScalar(34);
        rk.lookAt(x - dx, y - dy, z - dz);
      }
      for (const [id, rk] of fx.rockets) if (!seen.has(id)) { scene.remove(rk); disposeObject(rk); fx.rockets.delete(id); }
      const seenN = new Set();
      for (const [id, x, y, z, ki] of m.g || []) {
        seenN.add(id);
        let gm = fx.nades.get(id);
        if (!gm) { gm = makeNadeMesh(THROWABLE_KINDS[ki] || 'frag'); scene.add(gm); fx.nades.set(id, gm); }
        const prev = gm.position.clone();
        gm.position.set(x, y, z);
        if (gm.userData.kind === 'tknife') { const d = gm.position.clone().sub(prev); if (d.lengthSq() > 1e-4) gm.lookAt(gm.position.clone().add(d)); gm.rotateX(performance.now() * 0.03); }
        else gm.rotation.x += 0.5;
        if (gm.userData.kind === 'smoke' && Math.random() < 0.5) spriteFx(gm.position.clone(), TEX.smoke, 0.3, 3, 0.8, 0.5, new THREE.Vector3(0, 0.8, 0));
      }
      syncSmokes(m.sm); syncFires(m.fz);
      for (const [id, gm] of fx.nades) if (!seenN.has(id)) { scene.remove(gm); disposeObject(gm); fx.nades.delete(id); }
      const seenT = new Set();
      for (const [id, x, y, z, tm] of m.tg || []) {
        seenT.add(id);
        let tg = fx.tags.get(id);
        if (!tg) { tg = makeTagMesh(tm); tg.userData.base = [x, y, z]; scene.add(tg); fx.tags.set(id, tg); }
      }
      for (const [id, tg] of fx.tags) if (!seenT.has(id)) { scene.remove(tg); disposeObject(tg); fx.tags.delete(id); }
      if (m.ts) teamScore = m.ts;
      if (m.pk && world?.pickupMeshes) for (let i = 0; i < m.pk.length; i++) if (world.pickupMeshes[i]) world.pickupMeshes[i].visible = m.pk[i] === '1';
      if (m.z) zone = { x: m.z[0], z: m.z[1], r: m.z[2], state: m.z[3], ttm: m.z[4] };
      if (timeLeft > 60 && m.time <= 60 && !matchEnded) Announcer.say('minute');
      timeLeft = m.time;
      checkLead();
      break;
    }
    case 'spawn':
      if (!inGame) break;
      if (m.id === me.id) {
        me.pos = [...m.p]; me.vel = [0, 0, 0]; me.yaw = m.ry; me.pitch = 0; me.alive = true; me.hp = 100; me.crouch = false;
        if (m.w) ggWeapon = m.w;
        if (throwAnim) { vmScene.remove(throwAnim.g); disposeObject(throwAnim.g); throwAnim = null; }
        me.weapons = makeWeapons(); me.slot = 0; me.streak = 0; myArmor = 0; renderArmor(); renderStreakHud(); recoilAcc = 0; deathTime = 0; slide.t = 0; mantle = null; nadesLeft = 2; tacsLeft = 2; stunUntil = burnUntil = flashUntil = 0;
        equipViewmodel();
        $('deathscreen').classList.add('hidden');
      } else {
        const r = remotes.get(m.id);
        const off = net.srv && !window.__netOld && net.off !== null ? net.off : 0; // buffers are on the server clock
        if (r) { r.buf = [{ t: now - off - 200, x: m.p[0], y: m.p[1], z: m.p[2], ry: m.ry, rx: 0, c: 0 }]; r.alive = true; r.deathT = 0; r.prev = null; }
      }
      break;
    case 'fx': {
      if (!inGame || m.id === me.id) break;
      const r = remotes.get(m.id); if (!r) break;
      setRemoteGun(r, m.w);
      r.lastFired = now;
      const def = WEAPONS[m.w];
      const mz = new THREE.Vector3();
      if (r.gun && r.model.visible) r.gun.userData.muzzle.getWorldPosition(mz); else mz.set(r.model.position.x, r.model.position.y + 1.4, r.model.position.z);
      if (def?.flame) {
        const end = m.e?.[0] ? new THREE.Vector3(...m.e[0]) : mz.clone();
        const dir = end.clone().sub(mz); const len = Math.max(1, dir.length()); dir.divideScalar(len);
        flameStream(mz, dir, len);
        const [vol, pan] = spatial(mz); SFX.flame?.(vol * 0.8, pan);
        break;
      }
      const quiet = m.s || def?.suppressed;
      if (!def?.dart) { r.flash.visible = true; r.flash.material.rotation = Math.random() * 6.28; r.flashT = 0.05; flashLight(mz, '#ffb060', quiet ? 5 : 20, 0.06); }
      for (const e of m.e || []) {
        const end = new THREE.Vector3(...e);
        if (def?.dart) tracer(mz, end, true); else if (!quiet) tracer(mz, end);
        if (end.distanceTo(camera.position) > 1.5) for (let i = 0; i < 2; i++) particle(end, new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3), def?.dart ? '#ff9a3a' : '#ffcf6a', 0.025, 0.25);
      }
      if (def) { const [vol, pan, d] = spatial(mz); SFX.shot(def.snd, vol * (quiet ? 0.4 : 1), pan, d > 45); }
      break;
    }
    case 'flash': {                                  // flashbang went off: blind me if I can see it
      if (!inGame || !me.alive) break;
      const p = new THREE.Vector3(...m.p), eye = camera.position, d = p.distanceTo(eye);
      if (d > 20) break;
      const dir = p.clone().sub(eye).normalize();
      if (raycastBoxes(eye.toArray(), dir.toArray(), d - 0.2, world.map.query(Math.min(eye.x, p.x), Math.min(eye.z, p.z), Math.max(eye.x, p.x), Math.max(eye.z, p.z)))) break;
      const facing = dir.dot(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
      flashPower = clamp((facing > 0.2 ? 1 : 0.45) * (1.2 - d / 20), 0.25, 1);
      flashUntil = performance.now() + 3500 * flashPower; SFX.flashbang?.();
      break;
    }
    case 'stun': {
      if (!inGame || !me.alive) break;
      const p = new THREE.Vector3(...m.p), eye = camera.position, d = p.distanceTo(eye);
      if (d > 10) break;
      const dir = p.clone().sub(eye).normalize();
      if (raycastBoxes(eye.toArray(), dir.toArray(), d - 0.2, world.map.query(Math.min(eye.x, p.x), Math.min(eye.z, p.z), Math.max(eye.x, p.x), Math.max(eye.z, p.z)))) break;
      stunUntil = performance.now() + 4000; shake = Math.max(shake, 0.4);
      break;
    }
    case 'burn': if (m.id === me.id) burnUntil = performance.now() + (m.dur || 2500); break;
    case 'dmg':
      if (!inGame) break;
      if (m.id === me.id) {
        me.hp = m.hp; SFX.hurt();
        hurtFlash = Math.min(1, hurtFlash + 0.35 + (m.amt || 10) / 45);
        if (m.from && m.by !== me.id) damageIndicator(m.from, m.by, m.amt || 10);
        shake = Math.max(shake, 0.1 + Math.min(0.15, (m.amt || 10) / 300));
      }
      if (m.by === me.id && m.id !== me.id) { hitmarker(m.h ? 'head' : ''); SFX.hit(m.h); }
      break;
    case 'kill': if (inGame) onKill(m); break;
    case 'sc': for (const [id, k, d, s, tm, gg, a] of m.s) scores.set(id, [k, d, s, tm, gg, a]); if (m.ts) teamScore = m.ts; if (showBoard) renderScoreboard(); break;
    case 'boom': if (inGame) explosionFx(m.p); break;
    case 'end': showEnd(m); break;
    case 'chat': chat(m.n, m.m, m.dv); break;
  }
}

function endGameView() {
  inGame = false; me.alive = false; deathTime = 0; matchEnded = false;
  clearRemotes(); clearFx(); for (const c of [...vmHolder.children]) disposeObject(c); vmHolder.clear(); vm = null;
  $('hud').classList.add('hidden'); $('scope').style.display = 'none';
  if (document.pointerLockElement) document.exitPointerLock();
}

function onKill(m) {
  const fell = m.w === 'fall';
  if (fell && !m.k) m.k = m.v; // plain fall = "self" in the kill feed
  const kName = m.k ? dnameOf(m.k) : 'World', vName = dnameOf(m.v), wName = fell ? 'Fall' : WEAPONS[m.w]?.name || m.w;
  const div = document.createElement('div');
  div.className = 'kf' + (m.k === me.id ? ' me' : m.v === me.id ? ' died' : '');
  const who = (id) => id === me.id ? 'me' : teamsMode() && scores.get(id)?.[3] === myTeam ? 'mate' : 'foe';
  div.innerHTML = m.k === m.v ? `<span class="${who(m.v)}">${devHTML(nameOf(m.v), isDevId(m.v))}</span><span class="w">${esc(wName)}</span><span class="self">SELF</span>`
    : `<span class="${who(m.k)}">${m.k ? devHTML(nameOf(m.k), isDevId(m.k)) : 'World'}</span><span class="w">${esc(wName)}</span>${m.h ? '<span class="hs">HS</span>' : ''}<span class="${who(m.v)}">${devHTML(nameOf(m.v), isDevId(m.v))}</span>`;
  const kf = $('killfeed'); kf.prepend(div);
  while (kf.children.length > 6) kf.lastChild.remove();
  setTimeout(() => div.classList.add('out'), 5500);
  setTimeout(() => div.remove(), 6100);
  if (m.v === me.id) {
    me.alive = false; me.hp = 0; deathTime = performance.now(); respawnAt = deathTime + 3500; ddUntil = spdUntil = 0;
    mouseL = mouseR = false;
    $('deathscreen').classList.remove('hidden');
    $('killer').textContent = m.k === me.id ? (fell ? 'GRAVITY' : 'YOURSELF') : kName;
    $('killerweapon').textContent = m.k === me.id ? (fell ? 'That was a long way down.' : 'Watch the splash damage!') : fell ? 'shot you, then you fell to your death' : `with ${wName}${m.h ? ' — HEADSHOT' : ''}`;
    $('reloadbar').style.display = 'none';
  } else { const r = remotes.get(m.v); if (r) r.alive = false; }
  if (m.v === me.id && m.k !== me.id) { PR.profile.stats.deaths++; PR.saveProfile(); }
  if (m.k === me.id && m.v !== me.id) {
    hitmarker('kill'); SFX.killConfirm();
    me.streak = m.st; renderStreakHud();
    if (hasPerk('scavenger')) {
      for (const w of me.weapons) if (!w.def.melee && w.reserve < 999) w.reserve = Math.min(w.def.reserve * 2, w.reserve + w.def.mag);
      nadesLeft = Math.min(2, nadesLeft + 1);
      subAnnounce('SCAVENGER — AMMO REFILLED');
    }
    const st = PR.profile.stats;
    st.kills++; if (m.h) st.headshots++; st.bestStreak = Math.max(st.bestStreak, m.st);
    const wlBefore = WEAPONS[m.w] && WEAPONS[m.w].slot !== 'grenade' ? PR.weaponLevel(m.w) : 0;
    PR.profile.wkills[m.w] = (PR.profile.wkills[m.w] || 0) + 1;
    if (wlBefore && PR.weaponLevel(m.w) > wlBefore) { // gun levelled up: say so, and name anything it unlocked
      const wl = PR.weaponLevel(m.w);
      const att = PR.slotsFor(m.w).flatMap(s => PR.optionsFor(m.w, s).filter(o => o.lvl === wl).map(o => o.name));
      setTimeout(() => { announce(`${WEAPONS[m.w].name.toUpperCase()} — LEVEL ${wl}`, att.length ? `Unlocked: ${att.join(', ')}` : 'Weapon level up!'); SFX.announce(); Announcer.say('gunlevel', 600); }, 1400);
      toast(`${WEAPONS[m.w].name} reached weapon level ${wl}${att.length ? ' · Unlocked ' + att.join(', ') : ''}`);
    }
    challengeToasts(PR.challengeEvent('kill', { w: m.w, head: !!m.h, mode, map: world?.map.id, sliding: slide.t > 0 || slide.roll > 0.3 }));
    challengeToasts(PR.challengeEvent('streak', {}, m.st));
    const names = { 2: 'DOUBLE KILL', 3: 'TRIPLE KILL', 5: 'KILLING SPREE', 7: 'RAMPAGE', 10: 'UNSTOPPABLE', 15: 'GODLIKE' };
    if (names[m.st]) { announce(names[m.st], `${m.st} kill streak`); SFX.announce(); Announcer.say({ 2: 'double', 3: 'triple', 5: 'spree', 7: 'rampage', 10: 'unstoppable', 15: 'godlike' }[m.st], 800); }
    else subAnnounce(`${m.h ? 'HEADSHOT — ' : ''}ELIMINATED ${vName.toUpperCase()}`);
  }
}

// ================================================================ perks + killstreaks
const nameTeam = id => scores.get(id)?.[3];
// "you have the lead" / "lost the lead" (free-for-all: by points; teams: by team score)
let leadState = 0, leadCheckT = 0;
function checkLead() {
  const now = performance.now(); if (now - leadCheckT < 1500 || matchEnded) return; leadCheckT = now;
  let lead = 0;
  if (teamsMode()) { if (myTeam >= 0 && teamScore[myTeam] !== teamScore[1 - myTeam]) lead = teamScore[myTeam] > teamScore[1 - myTeam] ? 1 : -1; }
  else { const mine = scores.get(me.id)?.[2] || 0; const best = Math.max(0, ...[...scores].filter(([id]) => id !== me.id).map(([, s]) => s[2] || 0)); if (mine > 0 || best > 0) lead = mine > best ? 1 : -1; }
  if (lead === 1 && leadState === -1) Announcer.say('lead', 15000);
  if (lead === -1 && leadState === 1) Announcer.say('lostlead', 15000);
  if (lead) leadState = lead;
}
function sendLoadout() { myStreaks = [...cfg.streaks]; send({ t: 'loadout', perks: cfg.perks, streaks: cfg.streaks }); renderStreakHud(); }
function useStreak(id) {
  if (!id || !inGame || !me.alive) return;
  const s = STREAKS[id];
  if (!streakReady.includes(id)) { subAnnounce(`${s.name.toUpperCase()} — ${me.streak || 0}/${streakCost(id, lifePerks)} KILLS`); return; }
  let aim = null;
  if (id === 'mortar') {
    const { f } = camVectors(), o = camera.position.toArray(), d = f.toArray();
    const hit = raycastBoxes(o, d, 150, world.map.query(Math.min(o[0], o[0] + d[0] * 150), Math.min(o[2], o[2] + d[2] * 150), Math.max(o[0], o[0] + d[0] * 150), Math.max(o[2], o[2] + d[2] * 150)));
    aim = (hit ? hit.point : o.map((v, i) => v + d[i] * 60)).map(v => +v.toFixed(2)); aim[1] = Math.max(0, aim[1]);
  }
  send({ t: 'usestreak', id, aim });
}
function renderStreakHud() {
  const el = $('streakhud'); if (!el) return;
  el.innerHTML = myStreaks.map((id, i) => {
    const s = STREAKS[id], cost = streakCost(id, lifePerks), ready = streakReady.includes(id), n = Math.min(cost, me.streak || 0);
    return `<div class="sk ${ready ? 'ready' : ''}"><kbd>${5 + i}</kbd><b>${s.name}</b><span>${ready ? 'READY' : `${n}/${cost}`}</span></div>`;
  }).join('');
}
function renderArmor() { const el = $('armornum'); if (el) { el.textContent = myArmor > 0 ? `ARMOR ${myArmor}` : ''; el.classList.toggle('hidden', myArmor <= 0); } }

// ================================================================ HUD
let hmTimer = 0, annTimer = 0, subTimer = 0, toastTimer = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200); }
function hitmarker(cls) { const h = $('hitmarker'); h.className = cls; h.style.opacity = 1; clearTimeout(hmTimer); hmTimer = setTimeout(() => { h.style.opacity = 0; }, cls === 'kill' ? 350 : 150); }
function announce(text, sub) { const a = $('announce'); a.textContent = text; a.classList.add('show'); clearTimeout(annTimer); annTimer = setTimeout(() => a.classList.remove('show'), 2200); if (sub) subAnnounce(sub); }
function subAnnounce(text) { const s = $('subannounce'); s.textContent = text; s.classList.add('show'); clearTimeout(subTimer); subTimer = setTimeout(() => s.classList.remove('show'), 1800); }
function chat(name, msg, dev) {
  for (const id of ['chatlog', 'lobbyChat']) {
    const log = $(id), d = document.createElement('div');
    if (name) d.innerHTML = `<b>${devHTML(name, dev)}:</b> ${esc(msg)}`; else { d.className = 'sys'; d.textContent = msg; }
    log.appendChild(d);
    if (id === 'chatlog') { while (log.children.length > 7) log.firstChild.remove(); setTimeout(() => { d.style.opacity = 0; }, 9000); setTimeout(() => d.remove(), 10000); }
    else { while (log.children.length > 80) log.firstChild.remove(); log.scrollTop = log.scrollHeight; }
  }
}
// Hit direction: a red arc on a ring around the crosshair, one per attacker, that keeps pointing at them as you turn.
const dmgInds = new Map();
let hurtFlash = 0;
function dmgAngle(from) {
  const tx = from[0] - me.pos[0], tz = from[2] - me.pos[2];
  return Math.atan2(tx * Math.cos(me.yaw) - tz * Math.sin(me.yaw), -tx * Math.sin(me.yaw) - tz * Math.cos(me.yaw));
}
function damageIndicator(from, by, amt) {
  let d = dmgInds.get(by);
  if (!d) {
    const el = document.createElement('div'); el.className = 'dd'; el.innerHTML = '<i></i>';
    $('dmgdirs').appendChild(el);
    d = { el, from: [...from], t0: 0, str: 0 }; dmgInds.set(by, d);
  }
  d.from = [...from]; d.t0 = performance.now(); d.str = Math.min(1, Math.max(d.str * 0.5, 0) + 0.55 + amt / 60);
}
function updateDamageHud(dt) {
  const now = performance.now();
  for (const [by, d] of dmgInds) {
    const r = remotes.get(by);
    if (r && r.alive && r.model.visible) { const p = r.model.position; d.from = [p.x, p.y, p.z]; }
    const age = (now - d.t0) / 1000, a = age < 0.6 ? 1 : Math.max(0, 1 - (age - 0.6) / 1.4);
    if (a <= 0 || !me.alive) { d.el.remove(); dmgInds.delete(by); continue; }
    d.el.style.transform = `rotate(${dmgAngle(d.from)}rad)`;
    d.el.style.opacity = (a * (0.45 + 0.55 * d.str)).toFixed(3);
  }
  hurtFlash = Math.max(0, hurtFlash - dt * 1.6);
  $('vignette').style.opacity = me.alive ? hurtFlash.toFixed(3) : 0;
}
function renderScoreboard() {
  const rows = [...scores.entries()].map(([id, [k, d, s, tm, gg, a]]) => ({ id, k, d, s: s || 0, tm: tm ?? -1, gg: gg || 0, a: a || 0, name: nameOf(id), dev: isDevId(id), bot: remotes.get(id)?.info.bot }))
    .sort((a, b) => (teamsMode() ? a.tm - b.tm : 0) || (mode === 'gungame' ? b.gg - a.gg : 0) || b.s - a.s || b.k - a.k);
  $('sbTitle').textContent = `${MODES[mode].name.toUpperCase()}${teamsMode() ? ` — ${teamName(mode, 0)} ${teamScore[0]} : ${teamScore[1]} ${teamName(mode, 1)}` : ''}`;
  $('scoreboard').querySelector('tbody').innerHTML = rows.map((r, i) => `<tr class="${r.id === me.id ? 'me' : ''} ${r.bot ? 'bot' : ''}"><td>${i + 1}</td><td class="${r.tm >= 0 ? 't' + r.tm : ''}">${devHTML(r.name, r.dev)}</td><td>${r.s}</td><td>${mode === 'gungame' ? 'gun ' + (r.gg + 1) : r.k}</td><td>${r.d}</td><td>${r.a}</td></tr>`).join('');
  $('scoreboard').classList.remove('hidden');
}
function showEnd(m) {
  matchEnded = true;
  endBackAt = performance.now() + (m.back || 10) * 1000;
  const won = teamsMode() ? m.winTeam === myTeam : m.winId === me.id;
  Announcer.say(won ? 'win' : 'lose');
  const winner = m.standings.find(s => s[0] === m.winId);
  $('winner').textContent = teamsMode()
    ? (m.winTeam < 0 ? `DRAW — ${m.teamScore[0]} : ${m.teamScore[1]}` : `${won ? 'VICTORY' : 'DEFEAT'} — TEAM ${teamName(mode, m.winTeam)} WINS ${m.teamScore[m.winTeam]} : ${m.teamScore[1 - m.winTeam]}`)
    : won ? 'VICTORY — YOU WON THE MATCH!' : `${winner ? devTxt(winner[1], winner[9]) : '—'} wins`;
  $('winner').style.color = teamsMode() && m.winTeam >= 0 ? teamColor(mode, m.winTeam) : '';
  $('podium').innerHTML = [1, 0, 2].map(i => m.standings[i] ? `<div class="p${i + 1}"><small>#${i + 1}</small><b>${devHTML(m.standings[i][1], m.standings[i][9])}</b><span>${m.standings[i][5]}</span><small>points</small></div>` : '').join('');
  $('endscreen').querySelector('tbody').innerHTML = m.standings.slice(0, 10).map(([id, n, k, d, , s, tm, gg, a, dv], i) =>
    `<tr class="${id === me.id ? 'me' : ''}"><td>${i + 1}</td><td class="${tm >= 0 ? 't' + tm : ''}">${devHTML(n, dv)}</td><td>${s} pts</td><td>${mode === 'gungame' ? `gun ${gg + 1}` : `${k} K`}</td><td>${d} D</td><td>${a} A</td></tr>`).join('');
  // progression
  const st = PR.profile.stats;
  st.matches++; if (won) st.wins++;
  const done = [...PR.challengeEvent('match'), ...(won ? PR.challengeEvent('win') : [])];
  PR.saveProfile();
  const li = PR.levelInfo();
  const top = Object.entries(matchXPReasons).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const ms = matchStart || { level: li.level, credits: PR.profile.credits, wl: {} };
  const unl = []; for (let l = ms.level + 1; l <= li.level; l++) unl.push(...PR.newUnlocksAt(l).map(unlockName).filter(Boolean));
  const wUps = Object.entries(ms.wl).map(([w, a]) => [w, a, PR.weaponLevel(w)]).filter(([, a, b]) => b > a);
  const rewards = `<div class="xprow xplvl"><span>${li.level > ms.level ? `LEVEL ${ms.level} → ${li.level}` : `LEVEL ${li.level}`}</span><b>${li.level > ms.level ? `+${li.level - ms.level} LEVEL${li.level - ms.level > 1 ? 'S' : ''}` : ''}</b></div>` +
    `<div class="xprow"><span>CREDITS EARNED</span><b>+◆${Math.max(0, PR.profile.credits - ms.credits)}</b></div>` +
    (unl.length ? `<div class="xprew"><span>NEW UNLOCKS</span>${unl.map(n => `<i>${esc(n)}</i>`).join('')}</div>` : '') +
    wUps.map(([w, a, b]) => {
      const att = PR.slotsFor(w).flatMap(s => PR.optionsFor(w, s).filter(o => o.lvl > a && o.lvl <= b).map(o => o.name));
      return `<div class="xprew"><span>${esc(WEAPONS[w].name)} LV ${a} → ${b}</span>${att.map(n => `<i>${esc(n)}</i>`).join('')}</div>`;
    }).join('');
  $('xpsum').innerHTML = rewards + `<div class="xprow"><span>XP EARNED THIS MATCH</span><b>+${matchXP}</b></div>` +
    top.map(([r, v]) => `<div class="xprow" style="font-size:14px;color:var(--muted)"><span>${esc(r)}</span><span>+${v}</span></div>`).join('') +
    `<div class="xpbar"><div style="width:${(li.pct * 100).toFixed(1)}%"></div></div><div class="lvlline"><span>LEVEL ${li.level}</span><span>${li.into} / ${li.need} XP · ◆ ${PR.profile.credits}</span></div>`;
  challengeToasts(done);
  updateProfileUI();
  $('endscreen').classList.remove('hidden');
  $('deathscreen').classList.add('hidden');
  if (currentScreen === 'scr-pause') hideUI(); // a pause menu left open would cover the results
  if (won) SFX.announce();
}

// ---------------- progression UI helpers
let xpLines = [];
function xpPopup(reason, amt) {
  const feed = $('xpfeed');
  const same = reason === 'ZONE' ? xpLines.find(l => l.r === reason && l.el.isConnected) : null;
  if (same) { same.a += amt; same.el.innerHTML = `+${same.a}<b>${reason}</b>`; clearTimeout(same.to); same.to = setTimeout(() => fade(same), 1500); return; }
  const el = document.createElement('div'); el.innerHTML = amt ? `+${amt}<b>${esc(reason)}</b>` : `<b>${esc(reason)}</b>`;
  feed.appendChild(el);
  const line = { r: reason, a: amt, el };
  line.to = setTimeout(() => fade(line), 1800);
  xpLines.push(line);
  while (feed.children.length > 5) feed.firstChild.remove();
  function fade(l) { l.el.style.opacity = 0; l.el.style.transform = 'translateY(-10px)'; setTimeout(() => l.el.remove(), 600); xpLines = xpLines.filter(x => x !== l); }
}
const unlockName = k => k.startsWith('ws:') ? WEAPON_SKINS.find(s => s.id === k.slice(3))?.name : k.startsWith('op:') ? charSkin(k.slice(3)).name : WEAPONS[k]?.name;
function levelUp(lvl) {
  SFX.announce();
  const unlocks = PR.newUnlocksAt(lvl).map(k => k.startsWith('ws:') ? WEAPON_SKINS.find(s => s.id === k.slice(3))?.name : k.startsWith('op:') ? charSkin(k.slice(3)).name : WEAPONS[k]?.name).filter(Boolean);
  if (inGame) { announce(`LEVEL UP — LEVEL ${lvl}`, unlocks.length ? `Unlocked: ${unlocks.join(', ')}` : 'Profile level up!'); Announcer.say('levelup', 900); }
  toast(`LEVEL UP — you reached level ${lvl}${unlocks.length ? ' · Unlocked ' + unlocks.join(', ') : ''}`);
  send({ t: 'look', dev: PR.devCode(), name: cfg.name, skin: cfg.cskin, wskin: cfg.wskin, level: lvl });
}
function challengeToasts(list) {
  for (const c of list) {
    toast(`CHALLENGE COMPLETE — ${c.text} · +◆${c.reward}`);
    if (inGame) xpPopup('CHALLENGE', Math.round(c.reward / 2));
    SFX.killConfirm();
  }
  if (list.length) updateProfileUI();
}
function updateProfileUI() {
  const li = PR.levelInfo();
  $('lvlBadge').textContent = li.level; $('lvlNum').textContent = li.level;
  $('lvlXp').textContent = li.level >= PR.MAX_LEVEL ? 'MAX LEVEL' : `${li.into} / ${li.need} XP`;
  $('xpFill').style.width = (li.pct * 100).toFixed(1) + '%';
  $('creditNum').textContent = PR.profile.credits;
  document.querySelectorAll('.creditNum').forEach(e => { e.textContent = PR.profile.credits; });
  const nearest = PR.profile.challenges.reduce((a, c) => (c.progress / c.goal > a.progress / a.goal ? c : a), PR.profile.challenges[0]);
  if (nearest) $('chHint').textContent = `${PR.challengeText(nearest)} (${Math.min(nearest.progress, nearest.goal)}/${nearest.goal})`;
}
function setupModeHud() {
  $('zonebar').classList.toggle('hidden', mode !== 'hardpoint');
  $('ggbar').classList.toggle('hidden', mode !== 'gungame');
  if (mode === 'gungame') $('ggbar').innerHTML = GUNGAME_LADDER.map(() => '<i></i>').join('');
}

const xhBars = { t: document.querySelector('#xh .t'), b: document.querySelector('#xh .b'), l: document.querySelector('#xh .l'), r: document.querySelector('#xh .r') };
let lastHud = 0, hudPrev = 0, lastDmgHud = 0;
function updateHud(now) {
  if (!inGame) return;
  const w = curW(), xh = $('xh');
  if (me.alive && w && adsT < 0.5) {
    xh.style.display = 'block';
    const gap = w.def.melee ? 4 : 5 + currentSpread(w.def) * 650;
    xhBars.t.style.top = (-gap - 9) + 'px'; xhBars.b.style.top = gap + 'px';
    xhBars.l.style.left = (-gap - 9) + 'px'; xhBars.r.style.left = gap + 'px';
  } else xh.style.display = 'none';
  updateDamageHud(Math.min(0.1, (now - (lastDmgHud || now)) / 1000)); lastDmgHud = now;
  if (now - lastHud < 66) return;
  timeLeft = Math.max(0, timeLeft - (now - (hudPrev || now)) / 1000);
  lastHud = hudPrev = now;
  const hp = Math.max(0, Math.ceil(me.hp));
  $('hpnum').textContent = hp; $('hpfill').style.width = hp + '%';
  $('hpfill').classList.toggle('low', hp < 35);
  $('lowhp').style.opacity = me.alive && hp < 50 ? (0.25 + 0.75 * (1 - hp / 50)).toFixed(2) : 0;
  $('lowhp').classList.toggle('pulse', me.alive && hp < 30);
  if (w) {
    $('wname').textContent = w.def.name.toUpperCase();
    $('mag').textContent = w.def.melee ? '∞' : w.ammo;
    $('mag').classList.toggle('low', !w.def.melee && w.ammo <= Math.ceil(w.def.mag * 0.25));
    $('reserve').textContent = w.def.melee ? '' : '/ ' + w.reserve;
    $('slots').innerHTML = me.weapons.map((x, i) => `<span class="${i === me.slot ? 'on' : ''}">${i + 1} ${x.def.type}</span>`).join('');
  }
  $('timer').textContent = `${Math.floor(timeLeft / 60)}:${String(Math.floor(timeLeft % 60)).padStart(2, '0')}`;
  const L1 = $('lead'), L2 = $('lead2');
  if (teamsMode()) {
    const mt = Math.max(0, myTeam), ot = 1 - mt;
    L1.className = 'team' + mt; L2.className = 'team' + ot;
    $('myscore').textContent = teamScore[mt]; L1.querySelector('small').textContent = `${teamName(mode, mt)} (YOU) /${target}`;
    $('topscore').textContent = teamScore[ot]; $('topname').textContent = teamName(mode, ot);
  } else {
    L1.className = ''; L2.className = '';
    const idx = mode === 'gungame' ? 4 : 0;
    $('myscore').textContent = mode === 'gungame' ? ((scores.get(me.id) || [])[4] || 0) + 1 : (scores.get(me.id) || [0])[0];
    L1.querySelector('small').textContent = mode === 'gungame' ? `YOU · GUN /${GUNGAME_LADDER.length}` : target ? `YOU /${target}` : 'YOUR KILLS';
    let top = null;
    for (const [id, s] of scores) if (id !== me.id && (!top || s[idx] > top.v)) top = { id, v: s[idx] || 0 };
    $('topscore').textContent = top ? top.v + (mode === 'gungame' ? 1 : 0) : 0; $('topname').textContent = top ? dnameOf(top.id) : '—';
  }
  if (mode === 'hardpoint' && zone) {
    const zb = $('zonebar');
    zb.className = zone.state >= 0 ? 'z' + zone.state : '';
    $('zlabel').textContent = zone.state === 2 ? 'CONTESTED' : zone.state === myTeam ? 'HOLDING THE ZONE' : zone.state >= 0 ? 'ENEMY HOLDS THE ZONE' : 'HARDPOINT — CAPTURE IT';
    const d = Math.hypot(zone.x - me.pos[0], zone.z - me.pos[2]);
    $('ztime').textContent = `${d < zone.r ? 'YOU ARE IN THE ZONE' : Math.round(d) + 'm away'} · moves in ${zone.ttm}s`;
  }
  if (mode === 'gungame') {
    const lvl = (scores.get(me.id) || [])[4] || 0;
    $('ggbar').querySelectorAll('i').forEach((el, i) => { el.className = i < lvl ? 'done' : i === lvl ? 'cur' : ''; });
  }
  const pips = n => '●'.repeat(Math.max(0, n)) + '○'.repeat(Math.max(0, 2 - n));
  $('nades').innerHTML = `G — ${esc(WEAPONS[cfg.lethal].name.toUpperCase())} <b>${pips(nadesLeft)}</b> &nbsp; Q — ${esc(WEAPONS[cfg.tactical].name.toUpperCase())} <b>${pips(tacsLeft)}</b>`;
  $('uavtag').classList.toggle('hidden', now > uavUntil);
  $('powerups').innerHTML = (isZombie() ? '<div class="zmb">☣ INFECTED — KNIFE THEM</div>' : '') +
    (now < ddUntil ? `<div class="dd">✦ DOUBLE DAMAGE ${Math.ceil((ddUntil - now) / 1000)}s</div>` : '') +
    (now < spdUntil ? `<div class="spd">» SPEED BOOST ${Math.ceil((spdUntil - now) / 1000)}s</div>` : '');
  if (!me.alive && deathTime) $('respawn').textContent = `Respawning in ${Math.max(0, Math.ceil((respawnAt - now) / 1000))}`;
  if (matchEnded) $('backin').textContent = `Returning to lobby in ${Math.max(0, Math.ceil((endBackAt - now) / 1000))}…`;
  drawMinimap(now);
}
function drawMinimap(now) {
  if (!world) return;
  // Radar killstreak: the minimap zooms out and sweeps, and enemies beyond its edge show as markers on the rim
  // (before, the minimap only covered ~30 m around you, so radar showed almost nobody on the big maps).
  const uavOn = now < uavUntil, uavAdv = uavOn && uavAdvanced;
  const c = $('minimap'), x = c.getContext('2d'), { canvas, H, ms } = world.minimap, k = uavOn ? 1.9 : 3.2;
  x.clearRect(0, 0, 200, 200);
  x.save();
  x.beginPath(); x.arc(100, 100, 100, 0, Math.PI * 2); x.clip();
  if (now < jamUntil) {                                                              // jammed: static instead of a map
    x.fillStyle = '#1b2230'; x.fillRect(0, 0, 200, 200);
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(200,220,255,${Math.random() * 0.35})`; x.fillRect(Math.random() * 200, Math.random() * 200, 2 + Math.random() * 10, 2); }
    x.restore(); x.fillStyle = '#ff6b6b'; x.font = '800 13px Orbitron, sans-serif'; x.textAlign = 'center'; x.fillText('JAMMED', 100, 104); x.textAlign = 'start';
    return;
  }
  x.translate(100, 100); x.rotate(me.yaw); x.scale(k / ms, k / ms);
  x.translate(-(me.pos[0] + H) * ms, -(me.pos[2] + H) * ms);
  x.drawImage(canvas, 0, 0);
  if (mode === 'hardpoint' && zone) {
    x.strokeStyle = zone.state === 0 ? teamColor(mode, 0) : zone.state === 1 ? teamColor(mode, 1) : zone.state === 2 ? '#ffd36a' : '#ffffff';
    x.lineWidth = 3 * ms / k; x.beginPath(); x.arc((zone.x + H) * ms, (zone.z + H) * ms, zone.r * ms, 0, Math.PI * 2); x.stroke();
  }
  for (const pm of world.pickupMeshes || []) {
    if (!pm.visible) continue;
    x.fillStyle = PICK_COLORS[pm.userData.kind];
    x.beginPath(); x.arc((pm.position.x + H) * ms, (pm.position.z + H) * ms, (pm.userData.kind === 'damage' || pm.userData.kind === 'speed' ? 4 : 2.5) * ms / k, 0, Math.PI * 2); x.fill();
  }
  for (const tg of fx.tags.values()) {
    const [tx, , tz] = tg.userData.base;
    x.fillStyle = '#ffd36a'; x.fillRect((tx + H) * ms - 2.5 * ms / k, (tz + H) * ms - 2.5 * ms / k, 5 * ms / k, 5 * ms / k);
  }
  const uav = uavOn, rim = [];
  for (const r of remotes.values()) {
    if (!r.alive) continue;
    const ghost = !r.mate && r.info.pk?.includes('ghost') && !uavAdv;
    if (!r.mate && (ghost || !uav) && (ghost || now - r.lastFired > 2500)) continue;
    const p = r.model.position;
    if (uav && !r.mate && Math.hypot(p.x - me.pos[0], p.z - me.pos[2]) * k > 92) { rim.push(p); continue; }
    x.fillStyle = r.mate ? '#5aa2ff' : '#ff3b3b'; x.beginPath(); x.arc((p.x + H) * ms, (p.z + H) * ms, 4.5 * ms / k, 0, Math.PI * 2); x.fill();
  }
  x.restore();
  if (uav) {
    const a = (now / 1000 * 2.4) % (Math.PI * 2);                                   // radar sweep
    const g = x.createConicGradient ? x.createConicGradient(a, 100, 100) : null;
    if (g) { g.addColorStop(0, 'rgba(125,255,154,0.35)'); g.addColorStop(0.12, 'rgba(125,255,154,0)'); g.addColorStop(1, 'rgba(125,255,154,0)'); x.fillStyle = g; x.beginPath(); x.arc(100, 100, 100, 0, Math.PI * 2); x.fill(); }
    x.strokeStyle = 'rgba(125,255,154,0.8)'; x.lineWidth = 2; x.beginPath(); x.arc(100, 100, 98, 0, Math.PI * 2); x.stroke();
    for (const p of rim) {                                                            // far enemies: arrow on the rim pointing at them
      const dx = p.x - me.pos[0], dz = p.z - me.pos[2], cs = Math.cos(me.yaw), sn = Math.sin(me.yaw);
      const sx = dx * cs - dz * sn, sy = dx * sn + dz * cs, ang = Math.atan2(sy, sx);
      x.save(); x.translate(100 + Math.cos(ang) * 90, 100 + Math.sin(ang) * 90); x.rotate(ang);
      x.fillStyle = '#ff3b3b'; x.beginPath(); x.moveTo(7, 0); x.lineTo(-5, -5); x.lineTo(-5, 5); x.closePath(); x.fill(); x.restore();
    }
  }
  x.fillStyle = '#2ee6ff';
  x.beginPath(); x.moveTo(100, 92); x.lineTo(106, 106); x.lineTo(100, 103); x.lineTo(94, 106); x.closePath(); x.fill();
}

// ================================================================ main loop
let lastFrame = performance.now(), sendAcc = 0;
// FPS / ping / connection-jitter readout (top-right in game) so lag can be told apart: low FPS vs. high ping vs. bumpy connection
const perfStats = { frames: 0, fps: 0, worst: 0, ping: 0, t0: performance.now(), lastPing: 0 };
function updatePerf(now, frameMs) {
  perfStats.frames++; perfStats.worst = Math.max(perfStats.worst, frameMs);
  if (now - perfStats.lastPing > 1000 && ws && ws.readyState === 1) { perfStats.lastPing = now; send({ t: 'ping', c: Math.round(now) }); }
  if (now - perfStats.t0 >= 1000) {
    perfStats.fps = Math.round(perfStats.frames * 1000 / (now - perfStats.t0));
    const cls = (v, good, warn) => (v <= good ? 'good' : v <= warn ? 'warn' : 'bad');
    const ping = Math.round(perfStats.ping), jit = Math.round(net.jitter);
    $('netgraph').innerHTML = `<span class="${cls(-perfStats.fps, -55, -30)}">${perfStats.fps} FPS</span> · <span class="${cls(ping, 80, 160)}">${ping} ms</span> · <span class="${cls(jit, 25, 60)}">jitter ${jit}</span>`;
    perfStats.frames = 0; perfStats.worst = 0; perfStats.t0 = now;
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  updatePerf(now, now - lastFrame);
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (world) {
    if (inGame && me.alive && !chatOpen) updateMovement(dt);
    if (inGame) updateWeapon(dt, now);
    updateCamera(dt, now);
    if (inGame) updateRemotes(dt, now);
    updateFx(dt);
    updateZonesFx(dt, now);
    updateZoneVisual(now);
    updateHud(now);
    sendAcc += dt;
    if (inGame && me.alive && sendAcc > 1 / 30) {
      sendAcc = Math.min(sendAcc - 1 / 30, 1 / 30); // steady 30 a second (resetting to 0 gave an uneven ~20)
      send({ t: 's', k: Math.round(performance.now()), p: me.pos.map(n => +n.toFixed(2)), ry: +me.yaw.toFixed(3), rx: +me.pitch.toFixed(3), w: curW()?.def.id, c: me.crouch ? 1 : 0 });
    }
    if (renderer.shadowMap.enabled && (++shadowFrame & 1)) renderer.shadowMap.needsUpdate = true;
    renderer.clear();
    const showVm = inGame && me.alive && vmHolder.visible;
    if (post) { post.vm.enabled = showVm; post.composer.render(dt); }
    else {
      renderer.render(scene, camera);
      if (showVm) { renderer.clearDepth(); renderer.render(vmScene, vmCamera); }
    }
  }
  if (!$('ui').classList.contains('hidden')) renderPreview(now);
}

// ================================================================ screens
let currentScreen = 'scr-home', panelReturn = 'scr-home';
function go(id) {
  currentScreen = id;
  $('ui').classList.remove('hidden');
  document.querySelectorAll('#ui .screen').forEach(s => s.classList.toggle('active', s.id === id));
  const slot = { 'scr-home': 'pv-home', 'pnl-loadout': 'pv-loadout', 'pnl-skins': 'pv-skins' }[id];
  if (slot) { $(slot).appendChild(pv.renderer.domElement); pv.mode = id; rebuildPreview(); resizePreview(); }
  if (id === 'scr-browser') { send({ t: 'list' }); loadInfo(); }
  if (id === 'scr-home') { renderLoadoutSummary(); updateProfileUI(); }
  if (id === 'pnl-challenges') renderChallenges();
  if (id === 'pnl-loadout') buildArmory();
  if (id === 'pnl-skins') buildSkins();
  // show the lobby's map in the background while browsing the lobby
  if (id === 'scr-lobby' && room && !inGame && MAPS[room.settings.map]) loadMap(room.settings.map);
}
function hideUI() { $('ui').classList.add('hidden'); currentScreen = null; }
function showPause(starting) {
  go('scr-pause');
  $('pauseTitle').textContent = starting ? 'MATCH LIVE' : 'PAUSED';
  $('pauseSub').textContent = room ? `${room.name} · ${MAPS[world?.map.id]?.name || ''}` : '';
  $('btnResume').textContent = starting ? 'DEPLOY' : 'RESUME';
  $('btnEndMatch').classList.toggle('hidden', !isHost());
}
function openPanel(name) { if (!currentScreen?.startsWith('pnl-')) panelReturn = currentScreen || 'scr-home'; go('pnl-' + name); }
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { SFX.initAudio(cfg.vol); SFX.uiBlip(); go(b.dataset.go); }));
document.querySelectorAll('[data-panel]').forEach(b => b.addEventListener('click', () => { SFX.initAudio(cfg.vol); SFX.uiBlip(); openPanel(b.dataset.panel); }));
document.querySelectorAll('.panel-back').forEach(b => b.addEventListener('click', () => { SFX.uiBlip(); go(panelReturn); }));
// ---------- feedback: kept in an outbox (in the app's save, so it survives joining other hosts) until the
// developer's server confirms it; servers that aren't the developer's hold a copy and relay it later.
const FB_KEY = 'strikeline_fb_outbox', FB_OWNER_KEY = 'strikeline_fb_owner';
const fbLoad = () => { try { const a = JSON.parse(PR.store.get(FB_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const fbSave = (a) => PR.store.set(FB_KEY, JSON.stringify(a.slice(-100)));
const fbFlush = () => { const a = fbLoad(); if (a.length) send({ t: 'fbsync', items: a.slice(0, 50) }); };
const fbAdd = (items) => { const a = fbLoad(), have = new Set(a.map(f => f.id)); for (const f of items) if (f && f.id && !have.has(f.id)) a.push(f); fbSave(a); };
const openFeedback = () => { $('modal-feedback').classList.remove('hidden'); $('fbMsg').textContent = ''; setTimeout(() => $('fbText').focus(), 0); };
const closeFeedback = () => $('modal-feedback').classList.add('hidden');
$('btnFeedback').addEventListener('click', () => { SFX.initAudio(cfg.vol); SFX.uiBlip(); openFeedback(); });
$('btnFbCancel').addEventListener('click', closeFeedback);
$('btnFbSend').addEventListener('click', () => {
  const text = $('fbText').value.trim();
  if (text.length < 3) { $('fbMsg').textContent = 'Type a bit more first.'; return; }
  fbAdd([{ id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, name: cfg.name || 'Player', text: text.slice(0, 1500), map: world?.map.id || '', mode: room?.settings?.mode || '', at: Date.now() }]);
  fbFlush();
  $('fbText').value = ''; $('fbMsg').textContent = 'Thanks! Feedback sent.';
  SFX.uiBlip();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || chatOpen || locked) return;
  if (!$('modal-feedback').classList.contains('hidden')) { closeFeedback(); return; }
  if (!$('modal-create').classList.contains('hidden')) { closeCreate(); return; }
  if (currentScreen?.startsWith('pnl-')) go(panelReturn);
  else if (currentScreen === 'scr-browser') go('scr-home');
});

// ---------- home
$('btnCampaign').addEventListener('click', () => { SFX.initAudio(cfg.vol); SFX.click(); toast('Campaign is coming soon — stay tuned!'); });
$('name').value = cfg.name;
const setChip = () => { $('chipname').innerHTML = devHTML(cfg.name, PR.isDev()); };
setChip();
$('name').addEventListener('input', () => { cfg.name = $('name').value.replace(/[^\w \-\[\]\.!?']/g, '').slice(0, 16) || 'Operator'; setChip(); saveCfg(); });
$('name').addEventListener('change', () => send({ t: 'look', dev: PR.devCode(), name: cfg.name, skin: cfg.cskin, wskin: cfg.wskin }));
function updateChip() { const s = charSkin(cfg.cskin); document.querySelector('#playerchip .av').style.background = `linear-gradient(135deg, ${s.body} 60%, ${s.visor} 60%)`; }
function renderLoadoutSummary() {
  $('loadoutSummary').innerHTML = `<div><small>PRIMARY</small><b>${WEAPONS[cfg.primary].name}</b></div><div><small>SECONDARY</small><b>${WEAPONS[cfg.secondary].name}</b></div>`;
}

// ---------- browser
function renderLobbyList() {
  const el = $('lobbyList');
  if (!lobbies.length) { el.innerHTML = `<div class="empty"><b>NO LOBBIES YET</b>Create one and invite your friend.</div>`; return; }
  el.innerHTML = lobbies.map(l => {
    const mapName = l.map === 'random' ? 'Random' : MAPS[l.map]?.name || l.map;
    const full = l.players >= l.max;
    return `<div class="lobby-row"><div class="lname"><b>${esc(l.name)}<span class="mode-pill">${MODES[l.mode]?.name.toUpperCase() || ''}</span></b><small>Host: ${devHTML(l.host, l.hdev)} · ${l.bots} bots${l.remote ? " · friend's game" : ''}</small></div>
      <div class="lmap"><img src="${mapThumb(l.map)}" alt=""><span>${esc(mapName)}</span></div>
      <div class="lplayers">${l.players}/${l.max}</div>
      <div><span class="badge ${l.state === 'lobby' ? 'lobby' : 'playing'}">${l.state === 'lobby' ? 'IN LOBBY' : 'IN MATCH'}</span></div>
      <div><button class="btn ${full ? '' : 'primary'}" ${l.remote ? `data-code="${esc(l.code)}"` : `data-join="${l.id}"`} ${full ? 'disabled' : ''}>${full ? 'FULL' : 'JOIN'}</button></div></div>`;
  }).join('');
  el.querySelectorAll('[data-join]').forEach(b => b.onclick = () => { SFX.uiBlip(); send({ t: 'join', id: +b.dataset.join }); });
  el.querySelectorAll('[data-code]').forEach(b => b.onclick = () => { SFX.uiBlip(); send({ t: 'join', code: b.dataset.code }); });
}
$('btnJoinCode').addEventListener('click', () => { const code = $('codeInput').value.trim().toUpperCase(); if (/^[A-Z]{4}$/.test(code)) { toast(`Looking for lobby ${code}…`); send({ t: 'join', code }); } else toast('Lobby codes are 4 letters.'); });
$('codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoinCode').click(); });
if (onFriendsGame) { // way back to our own game from a friend's
  const b = document.createElement('button'); b.className = 'btn'; b.textContent = '‹ MY GAME'; b.title = "Leave your friend's game and go back to yours";
  b.onclick = () => { SFX.uiBlip(); goHome(); };
  $('btnJoinCode').after(b);
}
async function loadInfo() {} // (local network addresses are no longer shown in the menus)

// ---------- settings form (create modal + lobby)
const CHOICES = { bots: [0, 2, 4, 6, 8, 10, 12, 14], difficulty: ['easy', 'normal', 'hard'], scoreLimit: [10, 20, 30, 50], timeLimit: [5, 10, 15, 20], maxPlayers: [2, 4, 6, 8, 12, 16] };
const LABELS = { bots: 'BOTS', difficulty: 'BOT DIFFICULTY', scoreLimit: 'KILLS TO WIN', timeLimit: 'TIME LIMIT (MIN)', maxPlayers: 'MAX PLAYERS' };
function settingsForm(el, s, editable, onChange, showMaps = true) {
  const chipRow = k => `<div><label>${LABELS[k]}</label><div class="chips">${CHOICES[k].map(v => `<button data-k="${k}" data-v="${v}" class="${s[k] == v ? 'on' : ''}" ${editable ? '' : 'disabled'}>${typeof v === 'string' ? v[0].toUpperCase() + v.slice(1) : v}</button>`).join('')}</div></div>`;
  el.innerHTML = `<label>GAME MODE</label><div class="modegrid">${MODE_ORDER.map(id => `<button class="modecard ${s.mode === id ? 'on' : ''}" data-k="mode" data-v="${id}" ${editable ? '' : 'disabled'}><b>${MODES[id].name.toUpperCase()}</b><small>${MODES[id].desc}</small></button>`).join('')}</div>` +
    (showMaps ? `<label>MAP</label><div class="mapgrid">${['random', ...MAP_ORDER].map(id => `<button class="mapcard ${s.map === id ? 'on' : ''}" data-k="map" data-v="${id}" ${editable ? '' : 'disabled'}><img src="${mapThumb(id)}" alt=""><span>${id === 'random' ? 'Random' : MAPS[id].name}</span></button>`).join('')}</div>` : '') +
    `<div class="formgrid">${['bots', 'difficulty', 'scoreLimit', 'timeLimit', 'maxPlayers'].map(chipRow).join('')}</div>`;
  el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    if (!editable) return;
    const k = b.dataset.k; let v = b.dataset.v;
    if (k !== 'map' && k !== 'difficulty' && k !== 'mode') v = +v;
    SFX.uiBlip();
    onChange({ [k]: v });
  });
}
let createSettings = { mode: 'ffa', map: 'town', bots: 4, difficulty: 'normal', scoreLimit: 30, timeLimit: 10, maxPlayers: 8 };
function openCreate() {
  $('createName').value = `${cfg.name}'s lobby`;
  const draw = () => settingsForm($('createSettings'), createSettings, true, ch => { Object.assign(createSettings, ch); draw(); });
  draw();
  $('modal-create').classList.remove('hidden');
}
function closeCreate() { $('modal-create').classList.add('hidden'); }
$('btnCreate').addEventListener('click', () => { SFX.initAudio(cfg.vol); SFX.uiBlip(); openCreate(); });
$('btnCancelCreate').addEventListener('click', closeCreate);
$('btnConfirmCreate').addEventListener('click', () => { send({ t: 'create', name: $('createName').value, settings: createSettings, private: $('createPrivate').checked }); SFX.uiBlip(); });

// ---------- lobby room
function renderLobby() {
  if (!room) return;
  $('lobbyName').textContent = room.name;
  $('lobbyCode').textContent = room.code;
  const host = isHost();
  $('playerCount').textContent = `${room.members.length}/${room.settings.maxPlayers}`;
  $('memberList').innerHTML = room.members.map(mb => {
    const s = charSkin(mb.skin), isH = mb.id === room.hostId;
    return `<div class="member ${mb.id === me.id ? 'me' : ''}"><div class="av" style="background:linear-gradient(135deg, ${s.body} 55%, ${s.visor} 55%)"></div>
      <div class="mname"><b><span class="lvl">${mb.level || 1}</span>${devHTML(mb.name, mb.dev)}</b><small>${mb.dev ? '<span class="tag-dev">\u265B DEV</span> · ' : ''}${isH ? '<span class="tag-host">★ HOST</span>' : s.name.toUpperCase()}${mb.id === me.id ? ' · YOU' : ''}</small></div>
      ${isH ? '' : `<span class="rdy ${mb.ready ? 'yes' : ''}">${mb.ready ? 'READY' : 'NOT READY'}</span>`}</div>`;
  }).join('') + (room.settings.bots ? `<div class="member slot">+ ${room.settings.bots} bot${room.settings.bots > 1 ? 's' : ''} will join the match</div>` : '');
  const mapId = room.settings.map;
  $('mapHero').src = mapThumb(mapId);
  $('mapHeroName').textContent = mapId === 'random' ? 'RANDOM MAP' : MAPS[mapId].name.toUpperCase();
  $('mapHeroDesc').textContent = `${MODES[room.settings.mode].name} · ${mapId === 'random' ? 'A surprise every match' : MAPS[mapId].desc}`;
  settingsForm($('lobbySettings'), room.settings, host && room.state === 'lobby', ch => send({ t: 'set', settings: ch }));
  const others = room.members.filter(mb => mb.id !== room.hostId);
  const readyN = others.filter(mb => mb.ready).length;
  const mine = room.members.find(mb => mb.id === me.id);
  $('btnStart').classList.toggle('hidden', !host);
  $('btnReady').classList.toggle('hidden', host);
  $('btnReady').classList.toggle('on', !!mine?.ready);
  $('btnReady').textContent = mine?.ready ? '✓ READY' : 'READY UP';
  $('btnStart').disabled = room.state !== 'lobby';
  $('lobbyStatus').textContent = room.state !== 'lobby' ? 'Match in progress…'
    : host ? (others.length ? `${readyN}/${others.length} players ready` : 'Start whenever you like — bots will fill in')
      : 'Waiting for the host to start';
  if (currentScreen === 'scr-lobby' && !inGame && MAPS[mapId]) loadMap(mapId);
}
$('btnLeave').addEventListener('click', () => { SFX.uiBlip(); send({ t: 'leave' }); });
$('btnReady').addEventListener('click', () => { SFX.uiBlip(); send({ t: 'ready' }); });
$('btnStart').addEventListener('click', () => { SFX.initAudio(cfg.vol); wantLock = true; lockPointer(); send({ t: 'start' }); setTimeout(() => { wantLock = false; }, 3000); });
$('codePill').addEventListener('click', () => { try { navigator.clipboard.writeText(room?.code || ''); toast('Lobby code copied'); } catch {} });
$('lobbyChatInput').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) send({ t: 'chat', m: v }); e.target.value = ''; } });

// ---------- pause
$('btnResume').addEventListener('click', () => { SFX.initAudio(cfg.vol); lockPointer(); });
$('btnQuit').addEventListener('click', () => send({ t: 'leave' }));
// End the match and close the pause menu (re-grabbing the mouse right after Esc is refused by the browser, which
// used to leave the pause menu covering the end screen)
$('btnEndMatch').addEventListener('click', () => { send({ t: 'stop' }); hideUI(); });

// ---------- loadout
function statBars(def) {
  const dmg = def.flame ? 0.6 : Math.min(1, (def.dmg * def.pellets) / 140);
  const rows = [['Damage', dmg], ['Fire rate', Math.min(1, def.rpm / 1000)], ['Range', Math.min(1, def.falloff[1] / 150)], ['Accuracy', Math.max(0.05, 1 - def.spread * 10)],
    ['Mobility', Math.min(1, Math.max(0.05, (def.speed - 0.7) / 0.45))], ['Aim speed', Math.min(1, Math.max(0.05, (0.3 - (def.ads || 0.17)) / 0.2))], ['Control', Math.max(0.05, 1 - def.recoil * 14)]];
  const extra = [def.bolt && 'Bolt-action', def.pump && 'Pump-action', def.flame && 'Sets targets on fire', def.dart && 'Foam darts', def.suppressed && 'Suppressed', def.slug && 'Slug rounds', def.burst && `${def.burst}-round burst`, def.scope && 'Scoped'].filter(Boolean);
  return `<div style="font-size:22px;font-weight:700">${def.name}</div><div class="hint">${def.type}${def.mag ? ` · ${def.mag} ${def.flame ? 'fuel' : 'rounds'}` : ''}${extra.length ? ' · ' + extra.join(' · ') : ''}</div>` +
    rows.map(([n, v]) => `<div class="stat"><span>${n}</span><div class="sb"><div style="width:${(v * 100).toFixed(0)}%"></div></div></div>`).join('');
}
let previewWeapon = cfg.primary, armTab = 'all', gsOpen = null, gsBuyPending = null, pvTab = 'stats';
const lockText = key => { const u = PR.UNLOCKS[key]; if (!u) return ''; if (u.dev) return '🔒 DEV ONLY'; return u.price ? `◆${u.price}${u.level > 1 ? ` · needs level ${u.level}` : ''}` : `🔒 Level ${u.level}`; };
function tryBuy(key, label) {
  const u = PR.UNLOCKS[key];
  if (PR.buy(key)) { toast(`Unlocked ${label}!`); SFX.killConfirm(); updateProfileUI(); return true; }
  if (u?.level && PR.levelInfo().level < u.level) toast(`Reach level ${u.level} to buy ${label}`);
  else toast(u && PR.profile.credits < u.price ? `Not enough credits — need ◆${u.price}, you have ◆${PR.profile.credits}` : 'Cannot unlock that yet');
  return false;
}
function buildArmory() {
  const tabs = ['all', 'ar', 'smg', 'lmg', 'shotgun', 'dmr', 'sniper', 'special', 'era'];
  $('armTabs').innerHTML = tabs.map(t => `<button data-t="${t}" class="${armTab === t ? 'on' : ''}">${t === 'all' ? 'ALL' : t === 'era' ? 'WW1 & WW2' : CLASS_NAMES[t].toUpperCase()}</button>`).join('');
  $('armTabs').querySelectorAll('button').forEach(b => b.onclick = () => { armTab = b.dataset.t; buildArmory(); SFX.uiBlip(); });
  const card = (id, selected, small) => {
    const d = WEAPONS[id], open = PR.isUnlocked(id);
    const lvl = d.slot !== 'grenade' && open ? `<span class="mastery">LV ${PR.weaponLevel(id)}</span>` : '';
    return `<button data-w="${id}" class="${selected ? 'on' : ''} ${open ? '' : 'locked'}">${lvl}<b>${d.name}</b><small>${(small ? d.desc : d.type).toUpperCase()}${d.era ? ` · ${d.era.toUpperCase()}` : ''}</small>${open ? '' : `<span class="lk">${lockText(id)}</span>`}</button>`;
  };
  const mk = (ids, key, el, small = false) => {
    el.innerHTML = ids.map(id => card(id, cfg[key] === id, small)).join('');
    el.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.w;
        if (!PR.isUnlocked(id)) { if (!small) { previewWeapon = id; gsOpen = null; buildArmory(); rebuildPreview(); } toast(`${WEAPONS[id].name} unlocks at level ${PR.UNLOCKS[id].level}`); return; }
        cfg[key] = id; saveCfg(); if (!small) { previewWeapon = id; gsOpen = null; } buildArmory(); rebuildPreview(); SFX.uiBlip();
      };
      if (!small) b.onmouseenter = () => { if (previewWeapon === b.dataset.w) return; previewWeapon = b.dataset.w; gsOpen = null; $('wstats').innerHTML = statBars(PR.attachedDef(b.dataset.w)); rebuildPreview(); renderGunsmith(); };
    });
  };
  mk(PRIMARIES.filter(id => armTab === 'all' || WEAPONS[id].cls === armTab || (armTab === 'era' && WEAPONS[id].era)).sort((a, b) => (PR.UNLOCKS[a]?.level || 0) - (PR.UNLOCKS[b]?.level || 0)), 'primary', $('primaries'));
  mk(SECONDARIES, 'secondary', $('secondaries'));
  mk(LETHALS, 'lethal', $('lethals'), true);
  mk(TACTICALS, 'tactical', $('tacticals'), true);
  buildPerkPickers();
  $('wstats').innerHTML = statBars(PR.attachedDef(previewWeapon));
  renderGunsmith();
  updateProfileUI();
}
// Gunsmith camo rows: this gun's camo and its attachments' camo. Hover to preview; locked camos open the buy pop-up.
function renderGsCamo(id) {
  const cur = gunSkin(id), acur = attSkinFor(id);
  const chip = (s, on, data) => `<button data-${data}="${s.id}" class="${on ? 'on' : ''} ${s.locked ? 'locked' : ''}" title="${esc(s.name)}"><i style="background:${s.swatch}"></i></button>`;
  const list = WEAPON_SKINS.filter(s => s.rarity !== 'dev' || PR.isUnlocked('ws:' + s.id)).map(s => ({ ...s, locked: !PR.isUnlocked('ws:' + s.id) }));
  $('gsCamo').innerHTML = `<div class="gs-camolabel">CAMO <small>${esc(WEAPON_SKINS.find(s => s.id === cur)?.name || '')}</small></div><div class="camochips">${list.map(s => chip(s, s.id === cur, 'gc')).join('')}</div>` +
    `<div class="gs-camolabel">ATTACHMENT CAMO <small>${acur === 'black' ? 'Black' : acur === 'match' ? 'Match gun' : esc(WEAPON_SKINS.find(s => s.id === acur)?.name || '')}</small></div><div class="camochips">` +
    chip({ id: 'black', name: 'Black', swatch: '#15171a' }, acur === 'black', 'ac') + chip({ id: 'match', name: 'Match gun', swatch: 'linear-gradient(135deg, #666 50%, #ff7a1a 50%)' }, acur === 'match', 'ac') +
    list.map(s => chip(s, s.id === acur, 'ac')).join('') + '</div>';
  const hover = (b, gun) => { b.onmouseenter = () => { if (gun) pvCamo = b.dataset.gc; else pvAttCamo = b.dataset.ac; rebuildPreview(); }; b.onmouseleave = () => { pvCamo = pvAttCamo = null; rebuildPreview(); }; };
  $('gsCamo').querySelectorAll('[data-gc]').forEach(b => { hover(b, true); b.onclick = () => {
    if (inGame) { toast('The Gunsmith is locked during a match'); return; }
    const s = WEAPON_SKINS.find(x => x.id === b.dataset.gc), set = () => { (cfg.wcamo ||= {})[id] = s.id; saveCfg(); pvCamo = null; renderGunsmith(); rebuildPreview(); };
    if (!PR.isUnlocked('ws:' + s.id)) { if (PR.UNLOCKS['ws:' + s.id]?.dev) toast('Dev camo: enter the dev code on the Skins screen'); else buyPopup('ws:' + s.id, s.name, set, id); return; }
    set(); SFX.uiBlip();
  }; });
  $('gsCamo').querySelectorAll('[data-ac]').forEach(b => { hover(b, false); b.onclick = () => {
    if (inGame) { toast('The Gunsmith is locked during a match'); return; }
    const v = b.dataset.ac, s = WEAPON_SKINS.find(x => x.id === v), set = () => { (cfg.acamo ||= {})[id] = v; saveCfg(); pvAttCamo = null; renderGunsmith(); rebuildPreview(); };
    if (s && !PR.isUnlocked('ws:' + v)) { if (!PR.UNLOCKS['ws:' + v]?.dev) buyPopup('ws:' + v, s.name, set, id); return; }
    set(); SFX.uiBlip();
  }; });
}
// Perks (one per slot) and killstreaks (pick three). Perks apply from your next life; streaks straight away.
function buildPerkPickers() {
  const lvl = PR.levelInfo().level;
  $('perkRows').innerHTML = [1, 2, 3].map(s => `<div class="perkrow"><span class="pslot">PERK ${s}</span>` + PERKS[s].map(p => {
    const open = lvl >= p.lvl, on = cfg.perks[s - 1] === p.id;
    return `<button data-ps="${s}" data-p="${p.id}" class="${on ? 'on' : ''} ${open ? '' : 'locked'}"><b>${p.name}</b><small>${esc(p.desc)}</small>${open ? '' : `<span class="lk">Level ${p.lvl}</span>`}</button>`;
  }).join('') + '</div>').join('');
  $('perkRows').querySelectorAll('button').forEach(b => b.onclick = () => {
    const p = perkInfo(b.dataset.p);
    if (lvl < p.lvl) { toast(`${p.name} unlocks at level ${p.lvl}`); return; }
    cfg.perks[+b.dataset.ps - 1] = p.id; saveCfg(); sendLoadout(); buildPerkPickers(); SFX.uiBlip();
  });
  $('streakList').innerHTML = STREAK_IDS.map(id => {
    const s = STREAKS[id], open = lvl >= s.lvl, on = cfg.streaks.includes(id);
    return `<button data-s="${id}" class="${on ? 'on' : ''} ${open ? '' : 'locked'}"><span class="mastery">${s.kills} KILLS</span><b>${s.name}</b><small>${esc(s.desc).toUpperCase()}</small>${open ? '' : `<span class="lk">Level ${s.lvl}</span>`}</button>`;
  }).join('');
  $('streakList').querySelectorAll('button').forEach(b => b.onclick = () => {
    const id = b.dataset.s, s = STREAKS[id];
    if (lvl < s.lvl) { toast(`${s.name} unlocks at level ${s.lvl}`); return; }
    if (cfg.streaks.includes(id)) { if (cfg.streaks.length <= 1) return; cfg.streaks = cfg.streaks.filter(x => x !== id); }
    else if (cfg.streaks.length >= 3) { toast('You can take three killstreaks: click one of yours to drop it first'); return; }
    else cfg.streaks = [...cfg.streaks, id].sort((a, b) => STREAKS[a].kills - STREAKS[b].kills);
    saveCfg(); sendLoadout(); buildPerkPickers(); SFX.uiBlip();
  });
}
// Gunsmith: one row per attachment slot; open a row to pick (attachments unlock with weapon level)
function renderGunsmith() {
  const id = previewWeapon, d = WEAPONS[id], open = PR.isUnlocked(id), wl = PR.weaponLevelInfo(id), att = PR.getAtt(id);
  const slots = PR.slotsFor(id);
  const pct = wl.next ? (wl.kills - wl.cur) / (wl.next - wl.cur) : 1;
  $('gsLock').classList.toggle('hidden', !inGame); $('pvGs').classList.toggle('locked-match', inGame);
  $('gsHead').innerHTML = `<span>${esc(d.name.toUpperCase())} · WEAPON LEVEL ${wl.level}</span><small>${wl.next ? `${wl.kills}/${wl.next} kills to level ${wl.level + 1}` : 'MAX LEVEL'}</small>`;
  if (!slots.length) { $('gunsmith').innerHTML = `<div class="hint">No attachments for the ${esc(d.name)}.</div>`; return; }
  $('gunsmith').innerHTML = `<div class="gs-wl"><div style="width:${(pct * 100).toFixed(0)}%"></div></div>` + slots.map(slot => {
    const cur = att[slot], opts = PR.optionsFor(id, slot);
    const curName = cur ? opts.find(o => o.id === cur)?.name : slot === 'optic' ? `Default (${({ irons: 'Iron Sights', reddot: 'Reflex', holo: 'Holographic', acog: '2.5x Prism', scope4: '4x Scope', scope8: '8x Scope', toyscope: 'Toy Scope' })[d.optic] || 'Iron Sights'})` : 'None';
    const isOpen = gsOpen === slot;
    return `<div class="gs-slot ${isOpen ? 'open' : ''}"><button data-slot="${slot}"><span>${PR.SLOT_NAMES[slot].toUpperCase()}</span><b>${esc(curName || 'None')}</b></button>` +
      (isOpen ? `<div class="gs-opts"><button data-a="" class="${!cur ? 'on' : ''}"><b>${slot === 'optic' ? 'Default sight' : 'None'}</b></button>` + opts.map(o => {
        const locked = !PR.attOwned(id, slot, o);
        return `<button data-a="${o.id}" class="${cur === o.id ? 'on' : ''} ${locked ? 'locked' : ''}"><span class="lv">${locked ? `🔒 LV ${o.lvl} · ◆${PR.attPrice(o)}` : `LV ${o.lvl}`}</span><b>${esc(o.name)}</b><br>${(o.pros || []).map(p => `<span class="pro">+ ${esc(p)}</span>`).join(' ')} ${(o.cons || []).map(c => `<span class="con">− ${esc(c)}</span>`).join(' ')}</button>`;
      }).join('') + '</div>' : '') + '</div>';
  }).join('');
  renderGsCamo(id);
  $('gunsmith').querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { gsOpen = gsOpen === b.dataset.slot ? null : b.dataset.slot; renderGunsmith(); SFX.uiBlip(); });
  $('gunsmith').querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a, o = PR.optionsFor(id, gsOpen).find(x => x.id === a);
    if (inGame) { toast('The Gunsmith is locked during a match'); return; }
    if (a && !PR.attOwned(id, gsOpen, o)) {
      const price = PR.attPrice(o), key = id + gsOpen + a;
      if (gsBuyPending !== key) { gsBuyPending = key; toast(`${o.name} unlocks at ${d.name} level ${o.lvl} — or click again to buy it now for ◆${price}`); return; }
      gsBuyPending = null;
      if (!PR.buyAtt(id, gsOpen, a)) { toast(`Not enough credits — need ◆${price}, you have ◆${PR.profile.credits}`); return; }
      toast(`Bought ${o.name} for the ${d.name}${open ? '' : ' — ready when the gun unlocks'}`); SFX.killConfirm(); updateProfileUI();
    }
    PR.setAtt(id, gsOpen, a || null); SFX.uiBlip();
    $('wstats').innerHTML = statBars(PR.attachedDef(id)); renderGunsmith(); rebuildPreview();
  });
}
// throwables + reticle/crosshair are part of the loadout / settings
function applyCrosshair() {
  const xh = $('xh'), col = RETICLE_COLORS[cfg.xhColor] || '#fff';
  xh.dataset.style = cfg.xh; xh.style.setProperty('--xh', col);
}
function renderChallenges() {
  $('challengeList').innerHTML = PR.profile.challenges.map((c, i) => `<div class="ch"><div class="ch-main"><b>${esc(PR.challengeText(c))}</b>
    <div class="chbar"><div style="width:${Math.min(100, c.progress / c.goal * 100).toFixed(0)}%"></div></div><div class="chprog">${Math.min(c.progress, c.goal)} / ${c.goal}</div></div>
    <div class="chrew">◆ ${c.reward}<small>+${Math.round(c.reward / 2)} XP</small><button class="buybtn" data-reroll="${i}">SWAP ◆100</button></div></div>`).join('');
  $('challengeList').querySelectorAll('[data-reroll]').forEach(b => b.onclick = () => { if (PR.rerollChallenge(+b.dataset.reroll)) { renderChallenges(); updateProfileUI(); } else toast('You need ◆100 to swap a challenge'); });
  const s = PR.profile.stats, li = PR.levelInfo();
  $('careerStats').innerHTML = [['Level', li.level], ['Total XP', PR.profile.xp], ['Kills', s.kills], ['Deaths', s.deaths], ['K/D', (s.kills / Math.max(1, s.deaths)).toFixed(2)], ['Headshots', s.headshots],
    ['Best streak', s.bestStreak], ['Matches', s.matches], ['Wins', s.wins], ['Challenges done', PR.profile.done]].map(([a, b]) => `<div class="row2"><span>${a}</span><b>${b}</b></div>`).join('');
  updateProfileUI();
}
const submitDevCode = () => {
  const el = $('devcode');
  if (PR.tryDevCode(el.value)) { toast('Dev skins and dev badge unlocked!'); SFX.killConfirm(); buildSkins(); setChip(); send({ t: 'look', dev: PR.devCode(), name: cfg.name, skin: cfg.cskin, wskin: cfg.wskin }); }
  else toast('Wrong dev code');
  el.value = '';
};
$('devgo').onclick = submitDevCode;
$('devcode').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') submitDevCode(); });
function buildSkins() {
  const card = (s, key, dataAttr, sw, selected) => {
    const open = PR.isUnlocked(key), u = PR.UNLOCKS[key];
    return `<button data-${dataAttr}="${s.id}" class="${selected ? 'on' : ''} ${open ? '' : 'locked'}" style="border-bottom-color:${RARITY_COLORS[s.rarity]}"><div class="sw" style="background:${sw}"></div><b>${s.name}</b><small style="color:${RARITY_COLORS[s.rarity]}">${s.rarity}</small>${open ? '' : `<span class="lk">${lockText(key)}</span>`}</button>`;
  };
  $('wskins').innerHTML = WEAPON_SKINS.map(s => card(s, 'ws:' + s.id, 's', s.swatch, cfg.wskin === s.id)).join('');
  $('cskins').innerHTML = CHAR_SKINS.map(s => card(s, 'op:' + s.id, 'c', `linear-gradient(90deg, ${s.body} 60%, ${s.visor} 60%)`, cfg.cskin === s.id)).join('');
  const pickSkin = (key, label, apply) => {
    if (!PR.isUnlocked(key)) {
      const u = PR.UNLOCKS[key];
      if (u?.dev) { toast(`${label} is a dev skin — enter the dev code below`); $('devcode').focus(); return; }
      if (u?.level && PR.levelInfo().level < u.level) { toast(`${label} needs level ${u.level} (then ◆${u.price})`); return; }
      if (u?.price) buyPopup(key, label, () => { apply(); applyLook(); });
      return;
    }
    apply(); applyLook();
  };
  $('wskins').querySelectorAll('button').forEach(b => b.onclick = () => pickSkin('ws:' + b.dataset.s, WEAPON_SKINS.find(s => s.id === b.dataset.s).name, () => { cfg.wskin = b.dataset.s; }));
  $('wskins').querySelectorAll('button').forEach(b => { b.onmouseenter = () => { pvCamo = b.dataset.s; rebuildPreview(); }; b.onmouseleave = () => { pvCamo = null; rebuildPreview(); }; });
  $('cskins').querySelectorAll('button').forEach(b => b.onclick = () => pickSkin('op:' + b.dataset.c, charSkin(b.dataset.c).name, () => { cfg.cskin = b.dataset.c; }));
  $('devbox').classList.toggle('hidden', PR.isDev());
  const ws_ = WEAPON_SKINS.find(s => s.id === cfg.wskin) || WEAPON_SKINS[0], cs = charSkin(cfg.cskin);
  $('skininfo').innerHTML = `<span style="color:${RARITY_COLORS[ws_.rarity]}">${ws_.name}</span> · <span style="color:${RARITY_COLORS[cs.rarity]}">${cs.name}</span>`;
  updateChip();
}
// Buy pop-up: shows the item on a 3D preview with price and your credits; works in menus and mid-match.
let buyCtx = null;
function buyPopup(key, label, onBought, wid) {
  const u = PR.UNLOCKS[key]; if (!u) return;
  const sk = key.startsWith('ws:') ? WEAPON_SKINS.find(s => s.id === key.slice(3)) : null;
  const lvlOk = !u.level || PR.levelInfo().level >= u.level, cash = PR.profile.credits >= u.price;
  $('buyTitle').textContent = label.toUpperCase();
  $('buyRarity').textContent = sk ? sk.rarity.toUpperCase() + ' CAMO' : 'OPERATOR';
  $('buyRarity').style.color = sk ? RARITY_COLORS[sk.rarity] : '';
  $('buyPrice').innerHTML = `◆ ${u.price} <small>you have ◆ ${PR.profile.credits}</small>`;
  $('buyNote').textContent = !lvlOk ? `Reach level ${u.level} to buy this.` : !cash ? `You need ◆ ${u.price - PR.profile.credits} more credits.` : 'Camos you buy can go on any gun and its attachments.';
  $('buyGo').disabled = !lvlOk || !cash;
  buyCtx = { key, label, onBought, prevParent: pv.renderer.domElement.parentElement, prevMode: pv.mode };
  if (sk) { pvCamo = sk.id; pvGun = wid || (pv.mode === 'pnl-loadout' ? previewWeapon : cfg.primary); }
  $('buyPv').appendChild(pv.renderer.domElement); pv.mode = 'buy'; resizePreview(); rebuildPreview();
  $('modal-buy').classList.remove('hidden'); SFX.uiBlip();
}
function closeBuy() {
  $('modal-buy').classList.add('hidden');
  if (!buyCtx) return;
  pvCamo = null; pvGun = null;
  if (buyCtx.prevParent) buyCtx.prevParent.appendChild(pv.renderer.domElement);
  pv.mode = buyCtx.prevMode; resizePreview(); rebuildPreview(); buyCtx = null;
}
$('buyCancel').addEventListener('click', closeBuy);
$('buyGo').addEventListener('click', () => { const c = buyCtx; if (!c) return; const ok = tryBuy(c.key, c.label); closeBuy(); if (ok) c.onBought?.(); });
function applyLook() {
  saveCfg(); buildSkins(); rebuildPreview(); SFX.uiBlip();
  if (me.alive && inGame) equipViewmodel();
  send({ t: 'look', dev: PR.devCode(), name: cfg.name, skin: cfg.cskin, wskin: cfg.wskin });
}

// ---------- settings
function bindRange(id, key, fmt, onChange) {
  const el = $(id); el.value = cfg[key];
  const upd = () => { cfg[key] = +el.value; $(id + 'val').textContent = fmt(cfg[key]); saveCfg(); onChange?.(); };
  el.addEventListener('input', upd); $(id + 'val').textContent = fmt(cfg[key]);
}
bindRange('sens', 'sens', v => v.toFixed(2));
bindRange('fov', 'fov', v => v + '°');
bindRange('vol', 'vol', v => Math.round(v * 100) + '%', () => { SFX.setVolume(cfg.vol); Announcer.setVolume(Math.min(1, cfg.vol * 1.4)); });
$('invert').checked = cfg.invert;
$('invert').addEventListener('change', () => { cfg.invert = $('invert').checked; saveCfg(); });
$('shutup').checked = !cfg.announcer;
$('shutup').addEventListener('change', () => {
  cfg.announcer = !$('shutup').checked; Announcer.setEnabled(cfg.announcer); saveCfg();
  toast(cfg.announcer ? 'Fine. The announcer is back.' : 'Announcer gagged. Blessed silence.');
});
$('announcerOn').checked = cfg.announcer;
$('announcerOn').addEventListener('change', () => { cfg.announcer = $('announcerOn').checked; saveCfg(); Announcer.setEnabled(cfg.announcer); if (cfg.announcer) Announcer.say('ready', 0); });
const updateGfxChips = () => {
  document.querySelectorAll('#gfx button').forEach(b => b.classList.toggle('on', b.dataset.g === cfg.gfx));
  $('gfxnote').textContent = (cfg.gfx === 'ultra') !== ULTRA ? 'Restart Strikeline to ' + (ULTRA ? 'turn Ultra off.' : 'turn Ultra on.')
    : cfg.gfx === 'ultra' ? 'Ambient occlusion, bloom and surface detail. Needs a decent graphics card. Shadows have their own setting below.' : '';
};
document.querySelectorAll('#gfx button').forEach(b => b.addEventListener('click', () => {
  cfg.gfx = b.dataset.g; saveCfg(); updateGfxChips();
  renderer.setPixelRatio(gfxPixelRatio());
  if (post) { post.composer.setPixelRatio(renderer.getPixelRatio()); post.composer.setSize(innerWidth, innerHeight); }
  cfg.shadows = cfg.gfx === 'low' ? 'off' : cfg.gfx === 'ultra' ? 'high' : 'medium'; applyShadows();
}));
updateGfxChips();
function applyShadows() {
  saveCfg();
  document.querySelectorAll('#shadowq button').forEach(b => b.classList.toggle('on', b.dataset.s === cfg.shadows));
  const on = cfg.shadows !== 'off', type = cfg.shadows === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  const changed = renderer.shadowMap.enabled !== on || renderer.shadowMap.type !== type;
  renderer.shadowMap.enabled = on; renderer.shadowMap.type = type; renderer.shadowMap.needsUpdate = true;
  if (sunLight) {
    sunLight.castShadow = on;
    const n = shadowMapSize(sunBig);
    if (sunLight.shadow.mapSize.x !== n) { sunLight.shadow.mapSize.set(n, n); if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; } }
  }
  if (changed) scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
}
document.querySelectorAll('#shadowq button').forEach(b => b.addEventListener('click', () => { cfg.shadows = b.dataset.s; applyShadows(); SFX.uiBlip?.(); }));
document.querySelectorAll('#shadowq button').forEach(b => b.classList.toggle('on', b.dataset.s === cfg.shadows));
// reticle + crosshair customisation
function chipRow(el, values, key, label, onPick, swatch, canPick) {
  el.innerHTML = values.map(v => `<button data-v="${v}" class="${cfg[key] === v ? 'on' : ''}">${swatch ? `<i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${RETICLE_COLORS[v]};margin-right:6px"></i>` : ''}${label(v)}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => { if (canPick && !canPick()) return; cfg[key] = b.dataset.v; saveCfg(); onPick(); chipRow(el, values, key, label, onPick, swatch, canPick); SFX.uiBlip(); });
}
const RET_NAMES = { dot: 'Dot', cross: 'Cross', circle: 'Circle Dot', chevron: 'Chevron', tdot: 'T-Dot' };
const capWord = s => s[0].toUpperCase() + s.slice(1);
// reticles are picked in the Gunsmith tab, outside matches only
const retPickable = () => { if (inGame) { toast('Reticles can only be changed outside a match'); return false; } return true; };
const retPicked = () => { setReticle(cfg.reticle, cfg.reticleColor); rebuildPreview(); };
chipRow($('retStyle'), RETICLE_STYLES, 'reticle', v => RET_NAMES[v], retPicked, false, retPickable);
chipRow($('retColor'), Object.keys(RETICLE_COLORS), 'reticleColor', capWord, retPicked, true, retPickable);
function setPvTab(t) {
  pvTab = t;
  document.querySelectorAll('#pvTabs button').forEach(b => b.classList.toggle('on', b.dataset.pt === t));
  $('pvStats').classList.toggle('hidden', t !== 'stats'); $('pvGs').classList.toggle('hidden', t !== 'gs');
  if (t === 'gs') renderGunsmith();
}
document.querySelectorAll('#pvTabs button').forEach(b => b.onclick = () => { setPvTab(b.dataset.pt); SFX.uiBlip(); });
chipRow($('xhStyle'), ['lines', 'dot', 'circle', 'none'], 'xh', capWord, applyCrosshair);
chipRow($('xhColor'), Object.keys(RETICLE_COLORS), 'xhColor', capWord, applyCrosshair, true);
applyCrosshair();

// ---------------------------------------------------------------- 3D preview
const pv = { renderer: new THREE.WebGLRenderer({ antialias: true, alpha: true }), scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(32, 4 / 3, 0.01, 20), obj: null, mode: 'scr-home' };
pv.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
pv.renderer.outputColorSpace = THREE.SRGBColorSpace;
pv.renderer.toneMapping = THREE.ACESFilmicToneMapping;
pv.scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a3028', 1.4));
pv.scene.environment = new THREE.PMREMGenerator(pv.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const pvKey = new THREE.DirectionalLight('#ffffff', 2.5); pvKey.position.set(2, 3, 2); pv.scene.add(pvKey);
const pvRim = new THREE.DirectionalLight('#ff9a50', 1.8); pvRim.position.set(-3, 1, -2); pv.scene.add(pvRim);
function resizePreview() {
  const el = pv.renderer.domElement.parentElement; if (!el) return;
  const w = el.clientWidth || 380, h = el.clientHeight || 285;
  pv.renderer.setSize(w, h, false); pv.camera.aspect = w / h; pv.camera.updateProjectionMatrix();
}
function rebuildPreview() {
  if (pv.obj) { pv.scene.remove(pv.obj); disposeObject(pv.obj); }
  const g = new THREE.Group();
  if (pv.mode === 'pnl-loadout' || pvCamo || pvGun) {
    const wid = pvGun || (pv.mode === 'pnl-loadout' ? previewWeapon : cfg.primary);
    const gun = buildWeapon(WEAPONS[wid], pvCamo || gunSkin(wid), { ...PR.getAtt(wid), attSkin: pvAttCamo || attSkinFor(wid) });
    const box3 = new THREE.Box3().setFromObject(gun), c = box3.getCenter(new THREE.Vector3()), size = box3.getSize(new THREE.Vector3()).length();
    gun.position.sub(c);
    const holder = new THREE.Group(); holder.add(gun); holder.scale.setScalar(1.15 / size);
    g.add(holder);
    pv.camera.position.set(0, 0.15, pv.mode === 'buy' ? 1.15 : 1.6);
  } else {
    const s = buildSoldier(cfg.cskin);
    s.userData.gunMount.add(buildWeapon(WEAPONS[cfg.primary], gunSkin(cfg.primary), { ...PR.getAtt(cfg.primary), attSkin: attSkinFor(cfg.primary) }));
    s.position.set(0, -0.95, 0);
    g.add(s);
    pv.camera.position.set(0, 0.2, 3.6);
  }
  pv.camera.lookAt(0, 0, 0);
  pv.obj = g; pv.scene.add(g);
}
function renderPreview(now) {
  if (!pv.obj || !pv.renderer.domElement.isConnected || !pv.renderer.domElement.offsetParent) return;
  const par = pv.renderer.domElement.parentElement;
  if (par && Math.abs(par.clientWidth * Math.min(devicePixelRatio, 2) - pv.renderer.domElement.width) > 4) resizePreview();
  pv.obj.rotation.y = now * 0.0005 + (pv.mode === 'pnl-loadout' ? Math.PI / 2 : -0.5);
  pv.renderer.render(pv.scene, pv.camera);
}

// ================================================================ boot
// dev helper: render a contact sheet of weapon models (used by automated checks)
function renderGunSheet(ids, cols = 5, attFor = () => ({}), W = 300, H = 150) {
  const rows = Math.ceil(ids.length / cols);
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(W, H); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.8;
  const sc = new THREE.Scene(); sc.background = new THREE.Color('#2a2f3a');
  sc.add(new THREE.HemisphereLight('#dfe8ff', '#3a3028', 2.2)); const k = new THREE.DirectionalLight('#fff', 3.2); k.position.set(2, 3, 2); sc.add(k);
  const k2 = new THREE.DirectionalLight('#ffd8b0', 1.6); k2.position.set(-2, 1, 1.5); sc.add(k2);
  sc.environment = pv.scene.environment;
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 20);
  const out = document.createElement('canvas'); out.width = W * cols; out.height = H * rows;
  const x = out.getContext('2d'); x.font = 'bold 14px sans-serif'; x.fillStyle = '#fff';
  ids.forEach((id, i) => {
    const gun = buildWeapon(WEAPONS[id], 'factory', attFor(id));
    const b = new THREE.Box3().setFromObject(gun), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
    gun.position.sub(c); const h = new THREE.Group(); h.add(gun); h.scale.setScalar(1.2 / s); h.rotation.y = Math.PI / 2 + 0.35; sc.add(h);
    cam.position.set(0, 0.12, 1.55); cam.lookAt(0, 0, 0);
    r.render(sc, cam); x.drawImage(r.domElement, (i % cols) * W, Math.floor(i / cols) * H);
    x.fillText(WEAPONS[id].name, (i % cols) * W + 8, Math.floor(i / cols) * H + 18);
    sc.remove(h); disposeObject(h);
  });
  r.dispose();
  return out.toDataURL('image/png');
}
window.__strike = { handle, renderGunSheet, fx, renderer, loadMap, me, remotes, camera, keys, slide, vmHolder, go, send, getRoom: () => room, getTeamScore: () => teamScore, tagCount: () => fx.tags.size, fire: () => fireShot(curW(), performance.now()), setAds: v => { mouseR = v; }, setLocked: v => { locked = v; }, getAds: () => adsT, getPost: () => post };
if (!PR.isUnlocked(cfg.primary)) cfg.primary = 'falcon';
if (!PR.isUnlocked(cfg.secondary)) cfg.secondary = 'viper';
if (!PR.isUnlocked(cfg.lethal)) cfg.lethal = 'frag';
if (!PR.isUnlocked(cfg.tactical)) cfg.tactical = 'smoke';
if (PR.saveTampered) setTimeout(() => toast('Your save file was edited outside the game, so your progress was reset.'), 1500);
if (PR.migrationRefund > 0) setTimeout(() => toast(`Progression update: weapons now unlock by level and attachments by weapon level. Refunded ◆${PR.migrationRefund} from old upgrades.`), 1500);
if (!PR.isUnlocked('ws:' + cfg.wskin)) cfg.wskin = 'factory';
if (!PR.isUnlocked('op:' + cfg.cskin)) cfg.cskin = 'ranger';
buildArmory(); buildSkins(); renderLoadoutSummary(); updateProfileUI();
loadMap('town');
go('scr-home');
connect();
requestAnimationFrame(frame);

// ================================================================ Discord Rich Presence
// (the version tag in the bottom-right corner is filled in by index.html; window.slVersion holds it)
// What you're doing, shown on your Discord profile (desktop app only; it does nothing in a browser).
let menuSince = Date.now(), lobbySince = 0, lastPresence = '';
function presenceState() {
  const where = onFriendsGame ? " (friend's game)" : '';
  if (inGame && world) {
    const mapName = MAPS[world.map.id]?.name || 'Strikeline';
    const p = { details: `${MODES[mode]?.name || 'Match'} · ${mapName}`, start: matchStartedAt, partySize: remotes.size + 1, partyMax: room?.settings?.maxPlayers, partyId: room?.code };
    if (matchEnded) p.state = 'Match over';
    else if (teamsMode() && myTeam >= 0) p.state = `${teamName(mode, myTeam)} ${teamScore[myTeam] || 0} – ${teamScore[1 - myTeam] || 0}`;
    else { const sc = scores.get(me.id); p.state = sc ? `${sc[0]} kills · ${sc[1]} deaths` : 'In a match'; }
    return p;
  }
  if (room) {
    if (!lobbySince) lobbySince = Date.now();
    return { details: `In a lobby${where}`, state: MODES[room.settings?.mode] ? `${MODES[room.settings.mode].name} · ${MAPS[room.settings.map]?.name || 'Random map'}` : room.name, start: lobbySince, partySize: room.members?.length, partyMax: room.settings?.maxPlayers, partyId: room.code };
  }
  lobbySince = 0;
  return { details: `In the menus${where}`, state: `Level ${PR.levelInfo().level}`, start: menuSince };
}
if (window.desktop?.presence) setInterval(() => {
  let p; try { p = presenceState(); } catch { return; }
  p.version = window.slVersion || '';
  const j = JSON.stringify(p);
  if (j !== lastPresence) { lastPresence = j; window.desktop.presence(p); }
}, 2000);
