// Procedural 3D models: guns, soldiers, first-person arms.
// Style: chunky blocks, but with lots of small parts (rails, vents, ports, sights) so they read clearly.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { weaponSkinMaterial, charSkin } from './textures.js';

// ---------------------------------------------------------------- small procedural textures for gun parts
function texCanvas(size, paint) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function speckle(x, s, amt) {
  const img = x.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
}
const gunmetalTex = texCanvas(64, (x, s) => {
  x.fillStyle = '#2a2e34'; x.fillRect(0, 0, s, s); speckle(x, s, 16);
  x.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 6; i++) { x.beginPath(); const y = Math.random() * s; x.moveTo(Math.random() * s, y); x.lineTo(Math.random() * s, y + Math.random() * 6 - 3); x.stroke(); }
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.strokeRect(0.5, 0.5, s - 1, s - 1);
});
const gripTex = texCanvas(32, (x, s) => {
  x.fillStyle = '#16171a'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < s; i += 4) for (let j = 0; j < s; j += 4) { x.fillStyle = (i + j) % 8 ? '#202226' : '#0e0f11'; x.fillRect(i, j, 2, 2); }
});
const woodTex = texCanvas(64, (x, s) => {
  x.fillStyle = '#6b4226'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 18; i++) { x.strokeStyle = `rgba(40,20,8,${0.2 + Math.random() * 0.3})`; x.beginPath(); const y = Math.random() * s; x.moveTo(0, y); x.bezierCurveTo(20, y + 4, 40, y - 4, s, y + 2); x.stroke(); }
  speckle(x, s, 12);
});

const M = {
  dark: new THREE.MeshStandardMaterial({ map: gunmetalTex, color: '#ffffff', roughness: 0.42, metalness: 0.75 }),
  black: new THREE.MeshStandardMaterial({ color: '#0b0c0e', roughness: 0.6, metalness: 0.4 }),
  grip: new THREE.MeshStandardMaterial({ map: gripTex, roughness: 0.9, metalness: 0.05 }),
  steel: new THREE.MeshStandardMaterial({ color: '#9aa1aa', roughness: 0.22, metalness: 1.0 }),
  brass: new THREE.MeshStandardMaterial({ color: '#d4a640', roughness: 0.3, metalness: 1.0 }),
  shell: new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.5 }),
  wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.6 }),
  olive: new THREE.MeshStandardMaterial({ color: '#4c5a3a', roughness: 0.6, metalness: 0.3 }),
  lens: new THREE.MeshStandardMaterial({ color: '#16324a', roughness: 0.05, metalness: 0.9, emissive: new THREE.Color('#0a3a60'), emissiveIntensity: 0.8 }),
  glass: new THREE.MeshBasicMaterial({ color: '#9fe0ff', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  dot: new THREE.MeshBasicMaterial({ color: '#ff2020' }),
  dotGreen: new THREE.MeshBasicMaterial({ color: '#39ff6a' }),
  orange: new THREE.MeshBasicMaterial({ color: '#ff7a1a' }),
  skinTone: new THREE.MeshStandardMaterial({ color: '#c99a78', roughness: 0.8 }),
  // toy foam-dart blasters
  toyBlue: new THREE.MeshStandardMaterial({ color: '#2a5bd7', roughness: 0.45 }),
  toyOrange: new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.45 }),
  toyYellow: new THREE.MeshStandardMaterial({ color: '#ffd21f', roughness: 0.45 }),
  toyGray: new THREE.MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.5 }),
  toyWhite: new THREE.MeshStandardMaterial({ color: '#f2f4f7', roughness: 0.5 }),
  redTank: new THREE.MeshStandardMaterial({ color: '#b8261e', roughness: 0.35, metalness: 0.5 }),
  laser: new THREE.MeshBasicMaterial({ color: '#ff2020' }),
  // real-world furniture / factory finishes so guns don't all look the same grey
  fde: new THREE.MeshStandardMaterial({ color: '#b39a6e', roughness: 0.62, metalness: 0.15 }),
  coyote: new THREE.MeshStandardMaterial({ color: '#7c6646', roughness: 0.66, metalness: 0.1 }),
  odGreen: new THREE.MeshStandardMaterial({ color: '#56623f', roughness: 0.6, metalness: 0.12 }),
  ranger: new THREE.MeshStandardMaterial({ color: '#3d4733', roughness: 0.66, metalness: 0.1 }),
  polyGG: new THREE.MeshStandardMaterial({ color: '#4a5048', roughness: 0.7, metalness: 0.08 }),
  wolf: new THREE.MeshStandardMaterial({ color: '#6c7074', roughness: 0.6, metalness: 0.2 }),
  polyBlack: new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.72, metalness: 0.08 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#d3d8de', roughness: 0.28, metalness: 0.55 }),
  blued: new THREE.MeshStandardMaterial({ color: '#232a36', roughness: 0.3, metalness: 0.85 }),
  smokeMag: new THREE.MeshStandardMaterial({ color: '#9aa29c', roughness: 0.25, metalness: 0.0, transparent: true, opacity: 0.72 }),
};
// factory ("Factory New" skin) finish per model; anything not listed keeps the default gunmetal skin
const FACTORY = {
  pistol: M.polyBlack, hawk: M.chrome, revolver: M.blued, mpistol: M.polyBlack,
  r4c: M.polyBlack, burst: M.polyBlack, ak12: M.polyBlack, galil: M.polyBlack,
  scarh: M.fde, aug: M.odGreen, g36: M.polyGG, famas: M.polyBlack, pdw: M.polyBlack,
  dmr: M.polyBlack, autoshotgun: M.polyBlack, tcsg: M.polyBlack, ksg: M.polyBlack, smg: M.wolf,
};
// reticle drawn into a small canvas so players can pick the style/colour (see setReticle)
const reticleCanvas = document.createElement('canvas'); reticleCanvas.width = reticleCanvas.height = 64;
const reticleTex = new THREE.CanvasTexture(reticleCanvas); reticleTex.colorSpace = THREE.SRGBColorSpace;
M.reticle = new THREE.MeshBasicMaterial({ map: reticleTex, transparent: true, depthWrite: false });

for (const m of Object.values(M)) m.userData.shared = true; // reused by every model: never disposed

function box(g, w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  g.add(m);
  return m;
}
function cyl(g, r, len, mat, x, y, z, seg = 12, r2 = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, len, seg), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

// ---------------------------------------------------------------- reusable gun parts
// Picatinny rail running along Z
function rail(g, y, z0, z1, w = 0.026) {
  box(g, w, 0.008, z1 - z0, M.dark, 0, y, (z0 + z1) / 2);
  for (let z = z0 + 0.007; z < z1 - 0.004; z += 0.014) box(g, w + 0.006, 0.006, 0.007, M.black, 0, y + 0.006, z);
}
// Open red-dot / holo sight: frame around the edges, clear glass, glowing reticle at (x, cy)
function redDot(g, cy, z, { w = 0.046, h = 0.036, depth = 0.05, x = 0, holo = false } = {}) {
  const t = 0.0055, fz = z - depth * 0.2;
  box(g, w + 0.012, 0.012, depth, M.dark, x, cy - h / 2 - 0.008, z);              // mount base
  box(g, w * 0.6, 0.006, depth * 0.6, M.black, x, cy - h / 2 - 0.016, z);          // clamp
  box(g, t, h + t, depth * 0.55, M.dark, x - w / 2, cy, fz);                       // left post
  box(g, t, h + t, depth * 0.55, M.dark, x + w / 2, cy, fz);                       // right post
  box(g, w + t, t, depth * 0.55, M.dark, x, cy + h / 2, fz);                       // top bar
  box(g, 0.012, 0.008, 0.012, M.black, x + w / 2 + 0.006, cy + 0.004, fz);         // brightness knob
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
  glass.position.set(x, cy, fz - depth * 0.2); g.add(glass);
  const rs = holo ? 0.02 : 0.013;                                                  // the reticle (player-customisable)
  const ret = new THREE.Mesh(new THREE.PlaneGeometry(rs, rs), M.reticle);
  ret.position.set(x, cy, fz - depth * 0.2 - 0.001); g.add(ret);
}
// Rear notch + front post iron sights. Top of front post sits at `cy`.
function ironSights(g, cy, zRear, zFront, dot = M.dotGreen) {
  box(g, 0.006, 0.012, 0.008, M.dark, -0.009, cy - 0.002, zRear);
  box(g, 0.006, 0.012, 0.008, M.dark, 0.009, cy - 0.002, zRear);
  box(g, 0.026, 0.006, 0.01, M.dark, 0, cy - 0.011, zRear);
  box(g, 0.005, 0.012, 0.006, M.dark, 0, cy - 0.006, zFront);
  box(g, 0.003, 0.003, 0.001, dot, 0, cy - 0.003, zFront - 0.0035);
}
// Grip + trigger guard hanging from the underside of the frame at height `topY` (so it always connects)
function triggerGroup(g, z, gripMat = M.grip, gripAngle = 0.3, topY = -0.02) {
  const gh = 0.11, gy = topY - gh / 2 + 0.022, gz = z + 0.05;
  box(g, 0.034, gh, 0.045, gripMat, 0, gy, gz, gripAngle);                                   // grip
  box(g, 0.037, 0.012, 0.049, M.black, 0, gy - (gh / 2) * Math.cos(gripAngle), gz - (gh / 2) * Math.sin(gripAngle), gripAngle); // grip base
  box(g, 0.008, 0.006, 0.062, M.dark, 0, topY - 0.033, z - 0.012);                           // trigger guard bottom
  box(g, 0.008, 0.038, 0.006, M.dark, 0, topY - 0.016, z - 0.041);                           // guard front
  box(g, 0.004, 0.022, 0.006, M.steel, 0, topY - 0.012, z - 0.014, 0.2);                     // trigger
}
function mag(g, z, len, angle = -0.2, w = 0.032, d = 0.058, mat = M.dark, topY = -0.015) {
  const grp = new THREE.Group(); grp.position.set(0, topY + 0.01, z); grp.rotation.x = angle; g.add(grp);
  box(grp, w, len, d, mat, 0, -len / 2, 0);
  box(grp, w + 0.004, 0.014, d + 0.008, M.black, 0, -len - 0.005, 0);
  for (let y = -0.03; y > -len + 0.02; y -= 0.03) box(grp, w + 0.002, 0.004, d * 0.7, M.black, 0, y, 0);
  return grp;
}
// ---- small detail helpers (keep the chunky style, but give surfaces something to read)
// rivets on both sides of a receiver
function rivets(g, halfW, y, zs) { for (const s of [-1, 1]) for (const z of zs) box(g, 0.003, 0.006, 0.006, M.steel, s * (halfW + 0.0015), y, z); }
// thin inset seam lines running along both sides
function seams(g, halfW, ys, z0, z1) { for (const s of [-1, 1]) for (const y of ys) box(g, 0.0025, 0.0025, z1 - z0, M.black, s * (halfW + 0.001), y, (z0 + z1) / 2); }
// grooves / ribs across a part (handguards, grips, pump slides)
function ribs(g, w, h, y, z0, z1, step, x = 0) { for (let z = z0 + step / 2; z < z1; z += step) box(g, w + 0.003, h, 0.005, M.black, x, y, z); }
// ejection port with a visible bolt face
function ejectPort(g, halfW, y, z, len = 0.06, h = 0.018) { box(g, 0.003, h, len, M.black, halfW + 0.001, y, z); box(g, 0.003, h * 0.6, len * 0.45, M.steel, halfW + 0.002, y, z + len * 0.15); }
// sling swivel / loop
function sling(g, y, z, x = 0) { box(g, 0.012, 0.012, 0.022, M.steel, x, y, z); box(g, 0.004, 0.02, 0.004, M.steel, x, y - 0.012, z - 0.008); box(g, 0.004, 0.02, 0.004, M.steel, x, y - 0.012, z + 0.008); }
// butt pad with grip lines + a cheek line on a stock
function buttPad(g, w, h, y, z, tilt = 0) { box(g, w + 0.004, h, 0.018, M.grip, 0, y, z, tilt); for (let i = 0; i < 4; i++) box(g, w + 0.006, 0.003, 0.02, M.black, 0, y - h * 0.35 + i * h * 0.23, z, tilt); }
// open skeleton stock: top bar, sloped bottom bar, rear post + butt pad (instead of a solid block)
function skeletonStock(g, yTop, yBot, z0, z1, mat = M.dark, w = 0.02) {
  const len = z1 - z0, mid = (z0 + z1) / 2;
  box(g, w, 0.014, len, mat, 0, yTop, mid);                                          // top bar
  const dy = yBot - (yTop - 0.03), ang = Math.atan2(dy, len);
  box(g, w, 0.014, Math.hypot(len, dy), mat, 0, (yTop - 0.03 + yBot) / 2, mid, -ang); // sloped bottom bar
  box(g, w, yTop - yBot + 0.014, 0.016, mat, 0, (yTop + yBot) / 2, z1 - 0.008);     // rear post
  box(g, w, 0.03, 0.02, mat, 0, yTop - 0.012, z0 + 0.01);                            // front block
  buttPad(g, w + 0.024, yTop - yBot + 0.03, (yTop + yBot) / 2, z1 + 0.012);
}
// selector / safety lever on the side
function selector(g, halfW, y, z) { box(g, 0.004, 0.012, 0.012, M.dark, halfW + 0.002, y, z); box(g, 0.004, 0.004, 0.022, M.steel, halfW + 0.003, y + 0.006, z - 0.01, 0.4); }
function vents(g, y, z0, z1, x, count) {
  const step = (z1 - z0) / count;
  for (let i = 0; i < count; i++) {
    box(g, 0.004, 0.014, step * 0.55, M.black, x, y, z0 + step * (i + 0.5));
    box(g, 0.004, 0.014, step * 0.55, M.black, -x, y, z0 + step * (i + 0.5));
  }
}
function scope(g, cy, z, len = 0.3, r = 0.026) {
  cyl(g, r, len, M.dark, 0, cy, z);
  cyl(g, r + 0.009, 0.06, M.dark, 0, cy, z - len / 2 - 0.02, 14, r + 0.004);
  cyl(g, r + 0.006, 0.05, M.dark, 0, cy, z + len / 2 + 0.01, 14, r + 0.002);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(r + 0.006, 16), M.lens);
  lens.position.set(0, cy, z - len / 2 - 0.051); lens.rotation.y = Math.PI; g.add(lens);
  box(g, 0.014, 0.018, 0.014, M.dark, 0, cy + r + 0.006, z);                     // elevation turret
  box(g, 0.018, 0.014, 0.014, M.dark, r + 0.006, cy, z);                         // windage turret
  for (const dz of [-len * 0.3, len * 0.3]) {                                      // rings
    box(g, 0.012, 0.03, 0.016, M.black, 0, cy - r - 0.01, z + dz);
    cyl(g, r + 0.004, 0.014, M.black, 0, cy, z + dz);
  }
}
function muzzleBrake(g, y, z, r = 0.016, len = 0.06) {
  box(g, r * 2, r * 2, len, M.dark, 0, y, z);
  for (let i = 0; i < 3; i++) {
    box(g, r * 2 + 0.002, r * 0.7, 0.008, M.black, 0, y, z - len / 2 + 0.012 + i * 0.016);
  }
}

// ---------------------------------------------------------------- gun models (face -Z, origin near trigger hand)
// buildGun(model, skin, att): att = { optic, muzzle, barrel, under, mag } attachment choices (all optional).
// Each model records where things mount: `spot` (optic: reticle height y, centre z, rail y), `under` (underbarrel),
// `irons` (default iron sights). Moving parts for animations go in named groups (mag, bolt, pump, break, cover, tank).
// userData: muzzle, sightY, adsZ, left, skin, parts {mag, bolt, pump, brk, cover, tank}, optic, scoped
export function buildGun(model, skinId = 'factory', att = {}) {
  const S = (skinId === 'factory' && FACTORY[model]) || weaponSkinMaterial(skinId);
  const g = new THREE.Group();
  let muzzleZ = -0.5, muzzleY = 0.04, sightY = 0.1, adsZ = -0.3, left = [-0.02, -0.02, -0.3];
  let spot = null, under = null, irons = null, magObj = null;
  const keep = new Set(), parts = {};
  // a moving part: a group whose origin is the pivot; children are placed in gun space via the helpers below
  const part = (name, px = 0, py = 0, pz = 0) => { const p = new THREE.Group(); p.position.set(px, py, pz); g.add(p); parts[name] = p; return p; };
  const pbox = (p, w, h, d, mat, x, y, z, rx, ry, rz) => box(p, w, h, d, mat, x - p.position.x, y - p.position.y, z - p.position.z, rx, ry, rz);
  const pcyl = (p, r, len, mat, x, y, z, seg, r2) => cyl(p, r, len, mat, x - p.position.x, y - p.position.y, z - p.position.z, seg, r2);
  const optic = (y, z, railY, rz0, rz1) => { spot = { y, z, railY: railY ?? y - 0.034, rz0: rz0 ?? z - 0.08, rz1: rz1 ?? z + 0.08 }; };

  switch (model) {
    case 'pistol': {
      box(g, 0.04, 0.042, 0.19, S, 0, 0.036, -0.06);                               // slide
      for (let i = 0; i < 5; i++) box(g, 0.042, 0.03, 0.003, M.black, 0, 0.036, 0.0 + i * 0.006); // serrations
      box(g, 0.003, 0.016, 0.045, M.black, 0.02, 0.04, -0.05);                      // ejection port
      box(g, 0.036, 0.026, 0.16, M.dark, 0, 0.003, -0.05);                          // frame
      box(g, 0.028, 0.008, 0.05, M.black, 0, -0.012, -0.1);                         // under-rail
      cyl(g, 0.008, 0.012, M.black, 0, 0.036, -0.157);
      triggerGroup(g, -0.03, M.grip, 0.22, -0.01);
      ironSights(g, 0.066, 0.02, -0.145);
      muzzleZ = -0.17; muzzleY = 0.036; sightY = 0.064; left = [-0.01, -0.07, 0.0];
      break;
    }
    case 'mpistol': {
      box(g, 0.044, 0.05, 0.22, S, 0, 0.032, -0.06);
      box(g, 0.003, 0.018, 0.05, M.black, 0.022, 0.04, -0.04);
      for (let i = 0; i < 5; i++) box(g, 0.046, 0.034, 0.003, M.black, 0, 0.032, 0.01 + i * 0.007);
      box(g, 0.038, 0.03, 0.18, M.wolf, 0, -0.005, -0.05);                          // grey polymer frame
      triggerGroup(g, -0.03, M.wolf, 0.18, -0.019);
      magObj = mag(g, 0.01, 0.22, 0.18, 0.026, 0.036, M.dark, -0.019);              // long 33-round mag
      box(g, 0.026, 0.05, 0.03, M.grip, 0, -0.04, -0.13);                           // foregrip
      box(g, 0.03, 0.01, 0.03, M.wolf, 0, -0.016, -0.13);                           // foregrip hinge
      for (const s of [-1, 1]) box(g, 0.005, 0.005, 0.2, M.steel, s * 0.014, -0.005, 0.13);   // folding wire stock
      box(g, 0.034, 0.05, 0.008, M.steel, 0, -0.025, 0.23); box(g, 0.036, 0.05, 0.012, M.grip, 0, -0.025, 0.237);
      cyl(g, 0.012, 0.05, M.dark, 0, 0.032, -0.19);
      muzzleBrake(g, 0.032, -0.225, 0.012, 0.03);
      ironSights(g, 0.066, 0.02, -0.16);
      muzzleZ = -0.25; muzzleY = 0.032; sightY = 0.064; left = [-0.01, -0.06, -0.1];
      break;
    }
    case 'revolver': {
      box(g, 0.026, 0.028, 0.2, S, 0, 0.048, -0.16);                                // barrel
      box(g, 0.012, 0.008, 0.2, M.dark, 0, 0.068, -0.16);                           // top rib
      box(g, 0.022, 0.012, 0.18, M.dark, 0, 0.028, -0.15);                          // ejector rod housing
      cyl(g, 0.034, 0.06, M.steel, 0, 0.035, -0.025, 8);                            // cylinder
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; box(g, 0.006, 0.006, 0.062, M.black, Math.cos(a) * 0.035, 0.035 + Math.sin(a) * 0.035, -0.025); }
      box(g, 0.034, 0.06, 0.05, S, 0, 0.035, 0.03);                                 // frame
      box(g, 0.022, 0.008, 0.08, S, 0, 0.072, -0.02);                              // top strap over the cylinder
      box(g, 0.009, 0.014, 0.016, M.dark, 0, 0.066, 0.05, -0.4);                    // hammer (kept below the sight line)
      triggerGroup(g, -0.035, M.wood, 0.3, 0.008);
      // slim notch sight on the top strap + thin front blade
      box(g, 0.004, 0.008, 0.006, M.dark, -0.006, 0.08, -0.04);
      box(g, 0.004, 0.008, 0.006, M.dark, 0.006, 0.08, -0.04);
      box(g, 0.016, 0.003, 0.008, M.dark, 0, 0.0775, -0.04);
      box(g, 0.003, 0.01, 0.005, M.dark, 0, 0.077, -0.25);
      box(g, 0.0025, 0.0025, 0.001, M.dot, 0, 0.0805, -0.2528);
      muzzleZ = -0.27; muzzleY = 0.048; sightY = 0.081; adsZ = -0.42; left = [-0.01, -0.07, 0.04];
      break;
    }
    case 'smg': {
      box(g, 0.05, 0.08, 0.28, S, 0, 0.025, -0.06);                                 // body
      box(g, 0.052, 0.06, 0.1, S, 0, -0.03, -0.15, 0.35);                           // angled lower
      box(g, 0.053, 0.03, 0.1, M.black, 0, 0.03, -0.05);                            // side panel inset
      box(g, 0.003, 0.016, 0.05, M.black, 0.026, 0.045, -0.02);                     // port
      box(g, 0.04, 0.04, 0.12, M.dark, 0, 0.035, -0.26);                            // shroud
      vents(g, 0.035, -0.31, -0.21, 0.021, 4);
      cyl(g, 0.012, 0.04, M.dark, 0, 0.035, -0.335);
      muzzleBrake(g, 0.035, -0.37, 0.014, 0.04);
      triggerGroup(g, 0.0, M.grip, 0.25);
      magObj = mag(g, -0.12, 0.17, -0.1, 0.03, 0.04);
      rail(g, 0.069, -0.22, 0.06, 0.024);
      box(g, 0.018, 0.04, 0.2, M.dark, 0, 0.02, 0.17);                              // folding stock arm
      box(g, 0.04, 0.08, 0.02, M.grip, 0, 0.01, 0.27);                              // butt pad
      optic(0.1, -0.04, 0.073, -0.22, 0.06); under = { y: 0.012, z: -0.26 };
      muzzleZ = -0.39; muzzleY = 0.035; sightY = 0.1; left = [-0.02, -0.04, -0.24];
      break;
    }
    case 'rifle':
    case 'r4c':
    case 'burst': {
      const burst = model === 'burst', r4 = model === 'r4c';
      box(g, 0.05, 0.05, 0.34, S, 0, 0.045, -0.08);                                 // upper receiver
      box(g, 0.046, 0.045, 0.26, S, 0, 0.0, -0.05);                                 // lower receiver
      box(g, 0.003, 0.02, 0.07, M.black, 0.026, 0.045, -0.06);                      // ejection port
      cyl(g, 0.008, 0.012, M.dark, 0.03, 0.05, 0.03, 8);                            // forward assist
      box(g, 0.03, 0.01, 0.03, M.dark, 0, 0.072, 0.08);                             // charging handle
      box(g, 0.05, 0.04, 0.075, S, 0, -0.03, -0.11);                                // mag well
      if (burst) {
        // M4/M16A2 look: round ribbed handguard, delta ring, carry handle with the rear sight, A2 front sight tower, fixed stock
        cyl(g, 0.031, 0.27, M.black, 0, 0.035, -0.375, 12);                         // round handguard
        for (let i = 0; i < 10; i++) cyl(g, 0.0325, 0.009, M.polyBlack, 0, 0.035, -0.255 - i * 0.026, 12);   // ribs
        cyl(g, 0.036, 0.022, M.dark, 0, 0.035, -0.235, 14);                         // delta ring
        cyl(g, 0.033, 0.016, M.dark, 0, 0.035, -0.513, 12);                         // handguard cap
        for (const s of [-1, 1]) for (let i = 0; i < 4; i++) box(g, 0.003, 0.006, 0.012, M.black, s * 0.032, 0.035, -0.29 - i * 0.06);   // heat-shield vents
        for (const z of [-0.17, 0.045]) box(g, 0.026, 0.044, 0.03, S, 0, 0.09, z);  // carry handle legs
        box(g, 0.024, 0.016, 0.25, S, 0, 0.118, -0.06);                             // carry handle bar
        box(g, 0.012, 0.03, 0.2, M.black, 0, 0.096, -0.06);                         // handle opening shadow
        box(g, 0.03, 0.024, 0.036, S, 0, 0.128, 0.045);                             // rear sight housing
        box(g, 0.006, 0.012, 0.012, M.steel, 0.017, 0.128, 0.045);                  // windage knob
        // A2 triangular front sight tower on the gas block
        box(g, 0.026, 0.02, 0.03, M.dark, 0, 0.045, -0.555);
        box(g, 0.008, 0.075, 0.012, M.dark, 0, 0.085, -0.542, 0.28);                // rear leg (sloped)
        box(g, 0.008, 0.075, 0.012, M.dark, 0, 0.085, -0.568, -0.28);               // front leg
        box(g, 0.012, 0.012, 0.034, M.dark, 0, 0.122, -0.555);                      // top of the tower
        magObj = mag(g, -0.11, 0.16, -0.25, 0.032, 0.058);
        box(g, 0.044, 0.07, 0.14, M.polyBlack, 0, 0.03, 0.15);                      // fixed A2 stock (front)
        box(g, 0.046, 0.09, 0.14, M.polyBlack, 0, 0.012, 0.27, 0.05);               // stock (rear, deeper)
        box(g, 0.048, 0.004, 0.24, M.black, 0, 0.05, 0.22);                         // stock seam
        box(g, 0.003, 0.03, 0.04, M.dark, 0.024, 0.01, 0.31);                       // trapdoor
        sling(g, -0.04, 0.3);
      } else if (r4) {
        // modern carbine: long free-float M-LOK handguard, coyote furniture, crane stock, flash hider
        box(g, 0.056, 0.056, 0.42, M.coyote, 0, 0.04, -0.44);                       // handguard (-0.65 .. -0.23)
        for (const s of [-1, 1]) for (let zz = -0.62; zz < -0.27; zz += 0.05) box(g, 0.003, 0.012, 0.032, M.black, s * 0.0285, 0.04, zz);   // M-LOK slots
        for (let zz = -0.62; zz < -0.27; zz += 0.05) box(g, 0.014, 0.003, 0.032, M.black, 0, 0.0115, zz);
        box(g, 0.03, 0.03, 0.02, M.black, 0, -0.002, -0.58);                        // hand stop
        box(g, 0.06, 0.012, 0.03, M.dark, 0, 0.04, -0.24);                          // barrel nut ring
        magObj = mag(g, -0.11, 0.16, -0.12, 0.032, 0.058, M.coyote);
        cyl(g, 0.016, 0.16, M.dark, 0, 0.035, 0.165);                                // buffer tube
        box(g, 0.044, 0.08, 0.15, M.coyote, 0, 0.012, 0.27);                        // crane stock
        box(g, 0.03, 0.022, 0.12, M.coyote, 0, 0.062, 0.27);
        for (const s of [-1, 1]) { box(g, 0.003, 0.04, 0.09, M.black, s * 0.0225, 0.005, 0.27); box(g, 0.003, 0.012, 0.02, M.steel, s * 0.0225, 0.042, 0.21); }   // stock cut-outs + QD sockets
        box(g, 0.012, 0.022, 0.02, M.steel, 0, -0.03, 0.2);                         // adjustment latch
        for (let z = 0.13; z < 0.2; z += 0.014) box(g, 0.035, 0.004, 0.006, M.black, 0, 0.051, z);   // buffer tube positions
      } else {
        box(g, 0.058, 0.058, 0.28, M.dark, 0, 0.04, -0.39);                         // handguard
        vents(g, 0.04, -0.5, -0.28, 0.03, 4);
        box(g, 0.02, 0.012, 0.22, M.black, 0, 0.006, -0.39);                        // bottom rail
        magObj = mag(g, -0.11, 0.16, -0.25, 0.032, 0.058);
        cyl(g, 0.016, 0.16, M.dark, 0, 0.035, 0.165);                                // buffer tube
        box(g, 0.042, 0.075, 0.14, S, 0, 0.015, 0.27);                              // stock
        box(g, 0.03, 0.02, 0.1, S, 0, 0.06, 0.27);                                  // cheek riser
      }
      box(g, 0.046, 0.09, 0.02, M.grip, 0, 0.01, 0.345);                            // butt pad
      cyl(g, 0.011, 0.2, M.dark, 0, 0.04, -0.62);                                   // barrel
      box(g, 0.022, 0.024, 0.02, M.dark, 0, 0.03, -0.55);                           // gas block
      if (r4) {                                                                     // 4-prong flash hider
        cyl(g, 0.013, 0.02, M.dark, 0, 0.04, -0.73);
        for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; box(g, 0.007, 0.007, 0.045, M.black, Math.cos(a) * 0.01, 0.04 + Math.sin(a) * 0.01, -0.76); }
      } else muzzleBrake(g, 0.04, -0.75, 0.016, 0.06);
      triggerGroup(g, 0.0, r4 ? M.coyote : M.grip);
      if (burst) {                                                                  // optics sit on top of the carry handle
        rail(g, 0.13, -0.17, 0.03, 0.022);
        optic(0.164, -0.07, 0.134, -0.17, 0.03); under = null;
        irons = { cy: 0.142, zr: 0.045, zf: -0.555 };
      } else {
        rail(g, 0.074, r4 ? -0.64 : -0.52, 0.09);
        optic(0.108, -0.07, 0.078, r4 ? -0.6 : -0.52, 0.09); under = { y: 0.011, z: -0.42 };
        irons = { cy: 0.1, zr: 0.06, zf: r4 ? -0.6 : -0.5 };
      }
      muzzleZ = -0.79; muzzleY = 0.04; sightY = 0.108; left = [-0.02, -0.03, -0.4];
      break;
    }
    case 'shotgun': {
      box(g, 0.055, 0.075, 0.3, S, 0, 0.025, -0.08);                                // receiver
      box(g, 0.003, 0.025, 0.08, M.black, 0.028, 0.035, -0.06);                     // loading port
      for (let i = 0; i < 4; i++) cyl(g, 0.009, 0.03, M.shell, 0.033, 0.0 + i * 0.0, -0.12 + i * 0.022, 8); // side saddle shells
      for (let i = 0; i < 4; i++) cyl(g, 0.0095, 0.006, M.brass, 0.033, 0.0, -0.1 + i * 0.022, 8);
      cyl(g, 0.018, 0.52, M.dark, 0, 0.045, -0.5);                                  // barrel
      box(g, 0.01, 0.006, 0.5, M.dark, 0, 0.066, -0.5);                             // vent rib
      cyl(g, 0.015, 0.44, M.black, 0, 0.008, -0.45);                                // mag tube
      { const pp = part('pump', 0, 0.005, -0.43);
        pbox(pp, 0.064, 0.05, 0.16, M.grip, 0, 0.005, -0.43);                       // pump
        for (let i = 0; i < 5; i++) pbox(pp, 0.066, 0.052, 0.006, M.black, 0, 0.005, -0.49 + i * 0.03); }
      triggerGroup(g, 0.0, M.grip, 0.35);
      box(g, 0.048, 0.09, 0.26, S, 0, -0.01, 0.2, 0.08);                           // stock
      box(g, 0.05, 0.1, 0.02, M.grip, 0, -0.02, 0.33, 0.08);
      // ghost-ring rear + bead front
      box(g, 0.005, 0.03, 0.01, M.dark, -0.015, 0.075, 0.03); box(g, 0.005, 0.03, 0.01, M.dark, 0.015, 0.075, 0.03);
      box(g, 0.035, 0.005, 0.01, M.dark, 0, 0.091, 0.03); box(g, 0.035, 0.008, 0.012, M.dark, 0, 0.06, 0.03);
      box(g, 0.006, 0.01, 0.006, M.dark, 0, 0.071, -0.75); box(g, 0.004, 0.004, 0.001, M.orange, 0, 0.074, -0.754);
      muzzleZ = -0.77; muzzleY = 0.045; sightY = 0.075; left = [-0.02, -0.04, -0.43];
      break;
    }
    case 'dmr': {
      box(g, 0.052, 0.05, 0.36, S, 0, 0.045, -0.08);
      box(g, 0.048, 0.045, 0.26, S, 0, 0.0, -0.05);
      box(g, 0.003, 0.02, 0.07, M.black, 0.027, 0.045, -0.06);
      // SR-25 marksman: long ranger-green free-float handguard, fluted heavy barrel, folded bipod, adjustable precision stock
      box(g, 0.06, 0.06, 0.34, M.ranger, 0, 0.04, -0.43);
      vents(g, 0.04, -0.58, -0.28, 0.031, 5);
      cyl(g, 0.014, 0.22, M.dark, 0, 0.04, -0.7);                                   // heavy barrel
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; box(g, 0.004, 0.004, 0.18, M.black, Math.cos(a) * 0.0135, 0.04 + Math.sin(a) * 0.0135, -0.7); }   // flutes
      muzzleBrake(g, 0.04, -0.83, 0.017, 0.06);
      box(g, 0.026, 0.02, 0.026, M.dark, 0, 0.0, -0.56);                            // bipod yoke
      for (const s of [-1, 1]) { box(g, 0.01, 0.01, 0.24, M.steel, s * 0.018, -0.006, -0.43, 0.03); box(g, 0.016, 0.012, 0.024, M.black, s * 0.018, -0.012, -0.31); }
      magObj = mag(g, -0.1, 0.12, -0.1, 0.034, 0.07);
      triggerGroup(g, 0.0, M.ranger);
      cyl(g, 0.017, 0.14, M.dark, 0, 0.035, 0.15);                                  // buffer tube
      box(g, 0.05, 0.03, 0.22, M.ranger, 0, 0.065, 0.26);                           // adjustable cheek riser
      for (const zz of [0.18, 0.32]) cyl(g, 0.005, 0.03, M.steel, 0, 0.045, zz, 6).rotation.set(0, 0, 0);   // riser posts
      box(g, 0.05, 0.05, 0.2, M.ranger, 0, 0.012, 0.26);                            // stock body
      box(g, 0.05, 0.02, 0.1, M.ranger, 0, -0.04, 0.31);                            // monopod / bag rider
      box(g, 0.054, 0.12, 0.022, M.grip, 0, 0.01, 0.37);                            // butt pad
      rail(g, 0.074, -0.56, 0.1);
      optic(0.115, -0.08, 0.078, -0.56, 0.1); under = { y: 0.01, z: -0.45 };
      muzzleZ = -0.87; muzzleY = 0.04; sightY = 0.115; left = [-0.02, -0.03, -0.45];
      break;
    }
    case 'sniper': {
      box(g, 0.06, 0.08, 0.46, S, 0, 0.025, -0.04);                                 // chassis
      box(g, 0.062, 0.03, 0.3, M.black, 0, 0.0, -0.1);                              // inset
      cyl(g, 0.017, 0.62, M.dark, 0, 0.04, -0.6);                                   // barrel
      for (let i = 0; i < 6; i++) box(g, 0.006, 0.036, 0.04, M.black, 0, 0.04, -0.42 - i * 0.06); // fluting look
      box(g, 0.05, 0.04, 0.12, M.dark, 0, 0.04, -0.94);                             // big brake
      box(g, 0.052, 0.012, 0.012, M.black, 0, 0.04, -0.93); box(g, 0.052, 0.012, 0.012, M.black, 0, 0.04, -0.96);
      { const bp = part('bolt', 0.03, 0.05, 0.08);                                   // bolt handle (cycles after each shot)
        pcyl(bp, 0.007, 0.05, M.steel, 0.04, 0.05, 0.08); pbox(bp, 0.016, 0.016, 0.016, M.steel, 0.065, 0.05, 0.08); }
      magObj = mag(g, -0.06, 0.09, 0, 0.036, 0.08);
      triggerGroup(g, 0.06);
      box(g, 0.055, 0.12, 0.32, S, 0, -0.01, 0.36); box(g, 0.035, 0.03, 0.14, S, 0, 0.065, 0.33);
      box(g, 0.058, 0.13, 0.02, M.grip, 0, -0.01, 0.53);
      for (const s of [-1, 1]) box(g, 0.012, 0.012, 0.22, M.steel, s * 0.02, 0.014, -0.42, 0.06); // folded bipod
      rail(g, 0.069, -0.3, 0.15);
      optic(0.12, -0.06, 0.073, -0.3, 0.15);
      muzzleZ = -1.0; muzzleY = 0.04; sightY = 0.12; left = [-0.02, -0.04, -0.3];
      break;
    }
    case 'lmg': {
      // --- receiver: main body with recessed side plates, rivets, ejection port and charging handle
      box(g, 0.072, 0.09, 0.44, S, 0, 0.03, -0.07);                                 // receiver body
      box(g, 0.076, 0.012, 0.44, M.dark, 0, -0.016, -0.07);                         // lower rail of receiver
      for (const s of [-1, 1]) {
        box(g, 0.003, 0.05, 0.3, M.dark, s * 0.037, 0.035, -0.06);                  // side plate
        for (let i = 0; i < 5; i++) cyl(g, 0.004, 0.004, M.steel, s * 0.039, 0.05, -0.18 + i * 0.06, 6); // rivets
        for (let i = 0; i < 5; i++) cyl(g, 0.004, 0.004, M.steel, s * 0.039, 0.018, -0.18 + i * 0.06, 6);
      }
      box(g, 0.003, 0.026, 0.09, M.black, 0.038, 0.03, 0.03);                       // ejection port
      box(g, 0.004, 0.02, 0.035, M.steel, 0.04, 0.03, 0.035);                       // bolt face in the port
      box(g, 0.03, 0.014, 0.014, M.steel, 0.05, 0.035, -0.12);                      // charging handle
      box(g, 0.012, 0.022, 0.02, M.black, 0.067, 0.035, -0.12);
      // --- feed cover (hinged top) with latch and rear sight leaf
      { const cv = part('cover', 0, 0.088, -0.14);                                  // hinged feed cover (opens on reload)
        pbox(cv, 0.074, 0.028, 0.22, M.dark, 0, 0.088, -0.03);                      // feed cover
        pbox(cv, 0.06, 0.006, 0.2, S, 0, 0.104, -0.03);                             // cover top plate
        for (let i = 0; i < 4; i++) pbox(cv, 0.062, 0.004, 0.006, M.black, 0, 0.108, -0.1 + i * 0.045); // stiffening ribs
        pbox(cv, 0.02, 0.014, 0.02, M.steel, 0, 0.1, 0.085); }                      // cover latch
      cyl(g, 0.008, 0.08, M.steel, 0, 0.088, -0.145, 8);                            // hinge pin (front)
      // --- feed tray and belt coming from the box on the left side
      box(g, 0.03, 0.02, 0.06, M.dark, -0.05, 0.07, -0.05);                         // feed tray
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        cyl(g, 0.0055, 0.034, M.brass, -0.05 - t * 0.04, 0.066 - t * 0.075, -0.05, 6);       // rounds
        box(g, 0.012, 0.004, 0.036, M.black, -0.05 - t * 0.04, 0.072 - t * 0.075, -0.05);    // links
      }
      // --- ammo box: lid, latch, ribs, carry strap
      { const mb = magObj = part('mag', -0.09, -0.01, -0.05);                      // ammo box (swapped on reload)
        pbox(mb, 0.1, 0.12, 0.14, M.olive, -0.09, -0.07, -0.05);                    // ammo box
        pbox(mb, 0.104, 0.016, 0.144, M.olive, -0.09, -0.004, -0.05);               // lid
        pbox(mb, 0.02, 0.03, 0.01, M.steel, -0.09, -0.012, 0.024);                  // latch
        for (const zz of [-0.1, 0.0]) pbox(mb, 0.102, 0.11, 0.006, M.dark, -0.09, -0.075, zz);   // pressed ribs
        pbox(mb, 0.012, 0.006, 0.12, M.black, -0.142, -0.02, -0.05); }              // strap
      // --- barrel group: perforated heat shroud, barrel, gas cylinder, front sight, muzzle
      cyl(g, 0.032, 0.34, M.dark, 0, 0.035, -0.46, 12);                             // heat shroud
      for (let i = 0; i < 7; i++) for (const s of [-1, 1]) cyl(g, 0.007, 0.004, M.black, s * 0.031, 0.035, -0.33 - i * 0.045, 6); // vent holes
      cyl(g, 0.034, 0.02, M.black, 0, 0.035, -0.295, 12);                           // shroud collar
      cyl(g, 0.016, 0.24, M.dark, 0, 0.035, -0.74, 10);                             // exposed barrel
      cyl(g, 0.013, 0.42, M.steel, 0, -0.006, -0.5, 8);                             // gas cylinder under the barrel
      box(g, 0.026, 0.03, 0.03, M.dark, 0, 0.01, -0.68);                            // gas block
      box(g, 0.005, 0.016, 0.008, M.dark, 0, 0.058, -0.8);                          // front sight post (low, under the dot)
      box(g, 0.022, 0.01, 0.02, M.dark, 0, 0.05, -0.8);
      muzzleBrake(g, 0.035, -0.88, 0.019, 0.06);
      // --- barrel carry handle, folded down on the left side (kept out of the sight picture)
      box(g, 0.04, 0.01, 0.014, M.dark, -0.045, 0.045, -0.39); box(g, 0.04, 0.01, 0.014, M.dark, -0.045, 0.045, -0.27);
      box(g, 0.016, 0.026, 0.15, M.grip, -0.068, 0.045, -0.33);                     // handle grip
      // --- folding bipod (stowed under the shroud)
      box(g, 0.03, 0.016, 0.03, M.dark, 0, 0.0, -0.62);                             // bipod yoke
      for (const s of [-1, 1]) {
        box(g, 0.01, 0.01, 0.28, M.steel, s * 0.02, -0.012, -0.47, 0.04);           // leg
        box(g, 0.016, 0.012, 0.03, M.black, s * 0.02, -0.018, -0.33);               // foot
      }
      // --- handguard under the receiver front
      box(g, 0.068, 0.05, 0.16, M.grip, 0, -0.012, -0.24);
      for (let i = 0; i < 5; i++) box(g, 0.07, 0.004, 0.008, M.black, 0, -0.012, -0.3 + i * 0.03);
      triggerGroup(g, 0.04);
      // --- stock: tapered, with cheek rest, butt plate, sling swivel and shoulder strap loop
      box(g, 0.05, 0.075, 0.12, S, 0, 0.01, 0.2);
      box(g, 0.054, 0.1, 0.16, S, 0, -0.005, 0.33);
      box(g, 0.056, 0.02, 0.18, M.dark, 0, 0.05, 0.31);                             // cheek rest
      box(g, 0.058, 0.115, 0.022, M.grip, 0, -0.005, 0.42);                         // rubber butt plate
      for (let i = 0; i < 4; i++) box(g, 0.06, 0.004, 0.024, M.black, 0, -0.045 + i * 0.026, 0.42);
      box(g, 0.012, 0.016, 0.03, M.steel, 0, -0.062, 0.33);                         // sling swivel
      box(g, 0.012, 0.016, 0.03, M.steel, 0, -0.03, -0.6);
      // --- optic
      rail(g, 0.096, -0.12, 0.12, 0.03);
      optic(0.13, 0.0, 0.1, -0.12, 0.12);
      muzzleZ = -0.92; muzzleY = 0.035; sightY = 0.13; left = [-0.03, -0.04, -0.4];
      break;
    }
    case 'rocket': {
      cyl(g, 0.065, 1.0, S, 0, 0.06, -0.1, 14);
      for (const z of [-0.45, -0.3, 0.25]) cyl(g, 0.068, 0.025, M.black, 0, 0.06, z, 14);
      box(g, 0.004, 0.02, 0.18, M.orange, 0.066, 0.06, 0.1);                        // warning stripe
      cyl(g, 0.078, 0.08, M.dark, 0, 0.06, -0.6, 14);
      cyl(g, 0.085, 0.1, M.dark, 0, 0.06, 0.42, 14);
      box(g, 0.036, 0.11, 0.05, M.grip, 0, -0.04, 0.02, 0.2);
      box(g, 0.036, 0.1, 0.05, M.grip, 0, -0.04, -0.25, 0.2);
      box(g, 0.03, 0.06, 0.03, M.dark, -0.07, 0.07, -0.08);                         // sight arm
      redDot(g, 0.12, -0.08, { x: -0.085, w: 0.044, h: 0.036 });
      const war = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 12), M.olive);
      war.rotation.x = -Math.PI / 2; war.position.set(0, 0.06, -0.72); war.castShadow = true;
      g.add(war); g.userData.warhead = war; keep.add(war);
      muzzleZ = -0.65; muzzleY = 0.06; sightY = 0.12; left = [-0.02, -0.06, -0.25];
      break;
    }
    case 'hawk': {
      // big-bore Desert-Eagle-style hand cannon: tall slab-sided slide, triangular-profile barrel on top, squared guard
      box(g, 0.05, 0.05, 0.13, S, 0, 0.038, 0.0);                                   // rear slide
      for (let i = 0; i < 7; i++) box(g, 0.052, 0.036, 0.003, M.black, 0, 0.038, 0.02 + i * 0.006); // serrations
      box(g, 0.05, 0.044, 0.17, S, 0, 0.034, -0.15);                                // barrel block
      box(g, 0.036, 0.022, 0.27, S, 0, 0.066, -0.105);                               // top of the barrel
      for (const s of [-1, 1]) box(g, 0.03, 0.022, 0.27, S, s * 0.016, 0.056, -0.105, 0, 0, s * 0.55);  // chamfered (triangular) sides
      box(g, 0.012, 0.006, 0.3, M.black, 0, 0.078, -0.09);                          // sight groove / rib
      for (const s of [-1, 1]) box(g, 0.003, 0.012, 0.12, M.black, s * 0.0255, 0.026, -0.16);   // flutes along the barrel block
      box(g, 0.003, 0.022, 0.05, M.black, 0.026, 0.045, -0.02);                     // ejection port
      box(g, 0.004, 0.014, 0.022, M.steel, 0.026, 0.026, 0.02);                     // slide-mounted safety
      box(g, 0.044, 0.024, 0.2, S, 0, 0.002, -0.07);                                // frame
      cyl(g, 0.012, 0.004, M.black, 0, 0.042, -0.2355);                             // bore
      box(g, 0.012, 0.02, 0.016, S, 0, 0.06, 0.07, -0.5);                           // hammer
      triggerGroup(g, -0.03, M.grip, 0.2, -0.012);
      box(g, 0.012, 0.012, 0.03, M.dark, 0, -0.052, -0.08);                         // squared trigger guard hook
      ironSights(g, 0.09, 0.05, -0.225, M.dot);
      muzzleZ = -0.25; muzzleY = 0.042; sightY = 0.088; left = [-0.01, -0.07, 0.0];
      break;
    }
    case 'pdw': {
      // compact PDW (MP7-like): tall slab receiver, magazine inside the pistol grip, folding foregrip, sliding rod stock
      box(g, 0.05, 0.075, 0.3, S, 0, 0.035, -0.07);                                 // receiver (-0.22 .. 0.08)
      box(g, 0.052, 0.026, 0.22, M.polyBlack, 0, -0.008, -0.09);                    // lower shell
      box(g, 0.054, 0.004, 0.3, M.black, 0, 0.004, -0.07);                          // upper/lower seam
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) box(g, 0.003, 0.03, 0.016, M.black, s * 0.0255, 0.035, -0.19 + i * 0.026);   // front grip slots
      box(g, 0.003, 0.018, 0.05, M.black, 0.0255, 0.05, -0.02);                     // ejection port
      selector(g, 0.026, 0.012, 0.03);
      box(g, 0.03, 0.012, 0.018, M.steel, 0, 0.074, 0.075);                         // T charging handle
      cyl(g, 0.011, 0.07, M.dark, 0, 0.04, -0.255);                                 // short barrel
      cyl(g, 0.013, 0.02, M.dark, 0, 0.04, -0.29);
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; box(g, 0.006, 0.006, 0.04, M.black, Math.cos(a) * 0.009, 0.04 + Math.sin(a) * 0.009, -0.315); }   // flash hider
      triggerGroup(g, -0.04, M.polyBlack, 0.12, -0.02);                             // grip (holds the mag)
      magObj = mag(g, 0.01, 0.2, 0.12, 0.028, 0.038, M.dark, -0.02);                // 40-round mag out the bottom of the grip
      box(g, 0.024, 0.016, 0.03, M.dark, 0, -0.026, -0.17);                         // foregrip hinge
      box(g, 0.026, 0.07, 0.028, M.polyBlack, 0, -0.065, -0.17);                    // folding vertical foregrip
      ribs(g, 0.026, 0.07, -0.065, -0.184, -0.156, 0.009);
      for (const s of [-1, 1]) box(g, 0.006, 0.006, 0.2, M.steel, s * 0.018, 0.03, 0.17);   // sliding stock rods
      box(g, 0.048, 0.07, 0.016, M.polyBlack, 0, 0.022, 0.27); box(g, 0.05, 0.075, 0.01, M.grip, 0, 0.022, 0.282);   // butt plate
      rail(g, 0.077, -0.22, 0.08, 0.026);                                           // full-length top rail
      optic(0.116, -0.07, 0.081, -0.22, 0.08);
      irons = { cy: 0.104, zr: 0.06, zf: -0.2 };
      muzzleZ = -0.34; muzzleY = 0.04; sightY = 0.116; left = [0, -0.08, -0.17];
      break;
    }
    case 'autoshotgun': {
      box(g, 0.062, 0.09, 0.34, S, 0, 0.025, -0.07);                                // receiver
      box(g, 0.003, 0.03, 0.08, M.black, 0.032, 0.035, -0.05);
      box(g, 0.066, 0.065, 0.22, M.dark, 0, 0.03, -0.35);                           // handguard
      vents(g, 0.03, -0.44, -0.26, 0.034, 4);
      cyl(g, 0.02, 0.2, M.dark, 0, 0.04, -0.55);                                    // barrel
      muzzleBrake(g, 0.04, -0.67, 0.024, 0.06);
      { const dm = magObj = part('mag', 0, -0.07, -0.1);
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 16), M.dark);
        drum.rotation.z = Math.PI / 2; drum.castShadow = true; dm.add(drum);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.064, 12), M.steel);
        cap.rotation.z = Math.PI / 2; dm.add(cap); }
      triggerGroup(g, 0.05, M.grip, 0.3, -0.02);
      box(g, 0.06, 0.1, 0.24, S, 0, 0.0, 0.2);                                      // boxy fixed stock (in line with the receiver)
      box(g, 0.062, 0.11, 0.02, M.grip, 0, 0.0, 0.33);
      for (const s of [-1, 1]) for (let zz = 0.12; zz < 0.3; zz += 0.04) box(g, 0.003, 0.05, 0.02, M.black, s * 0.031, 0.0, zz);   // stock ribs
      // AA-12-style full-length carry handle; the optic rail sits on top of it
      for (const z of [-0.36, 0.06]) box(g, 0.026, 0.05, 0.03, M.dark, 0, 0.095, z);
      box(g, 0.03, 0.016, 0.46, M.dark, 0, 0.126, -0.15);
      box(g, 0.012, 0.03, 0.38, M.black, 0, 0.1, -0.15);                            // handle opening shadow
      rail(g, 0.138, -0.32, 0.04, 0.026);
      optic(0.172, -0.12, 0.142, -0.32, 0.04); under = { y: -0.003, z: -0.36 };
      muzzleZ = -0.71; muzzleY = 0.04; sightY = 0.108; left = [-0.02, -0.03, -0.35];
      break;
    }
    // =================================================================== new guns
    case 'ak': case 'ak12': case 'galil': {
      const k12 = model === 'ak12', gal = model === 'galil', fur = k12 ? M.polyBlack : gal ? M.odGreen : M.wood;
      box(g, 0.05, 0.06, 0.32, S, 0, 0.035, -0.06);                                 // receiver
      box(g, 0.052, 0.012, 0.3, M.dark, 0, 0.069, -0.06);                           // dust cover
      for (let i = 0; i < 5; i++) box(g, 0.053, 0.003, 0.006, M.black, 0, 0.0755, -0.17 + i * 0.05);
      box(g, 0.003, 0.02, 0.07, M.black, 0.026, 0.045, -0.04);                      // ejection port
      box(g, 0.004, 0.03, 0.09, M.dark, 0.027, 0.02, 0.0);                          // selector lever
      { const bp = part('bolt', 0.035, 0.05, -0.03); pbox(bp, 0.02, 0.012, 0.02, M.steel, 0.035, 0.05, -0.03); }
      box(g, 0.058, 0.05, 0.22, fur, 0, 0.012, -0.33);                              // lower handguard
      box(g, 0.04, 0.03, 0.2, k12 ? M.dark : fur, 0, 0.058, -0.32);                 // upper handguard (gas tube cover)
      if (k12 || gal) for (let zz = -0.42; zz < -0.24; zz += 0.016) box(g, 0.062, 0.006, 0.007, M.black, 0, 0.012, zz);
      cyl(g, 0.009, 0.36, M.dark, 0, 0.03, -0.42);                                  // barrel
      cyl(g, 0.008, 0.16, M.dark, 0, 0.058, -0.5);                                  // gas tube
      box(g, 0.02, 0.03, 0.02, M.dark, 0, 0.045, -0.53);                            // gas block
      box(g, 0.026, 0.024, 0.02, M.dark, 0, 0.05, -0.6); box(g, 0.01, 0.025, 0.012, M.dark, 0, 0.07, -0.6); // front sight base
      box(g, 0.03, 0.012, 0.04, M.dark, 0, 0.077, -0.2);                            // rear sight block
      if (k12) muzzleBrake(g, 0.03, -0.66, 0.016, 0.06); else cyl(g, 0.012, 0.05, M.dark, 0, 0.03, -0.645);
      magObj = mag(g, -0.1, 0.17, -0.35, 0.03, 0.06, gal ? M.black : k12 ? M.dark : S);
      triggerGroup(g, 0.0, k12 || gal ? M.grip : M.wood, 0.3);
      if (k12) { cyl(g, 0.015, 0.12, M.dark, 0, 0.03, 0.15); box(g, 0.044, 0.085, 0.16, M.dark, 0, 0.012, 0.26); box(g, 0.03, 0.02, 0.12, M.dark, 0, 0.062, 0.26); }
      else if (gal) {
        // side-folding tubular stock with an OD cheek piece, folded bipod, hooded front sight, upturned charging handle, top rail
        for (const y of [0.04, -0.02]) box(g, 0.016, 0.014, 0.25, M.dark, 0, y, 0.2);
        box(g, 0.012, 0.072, 0.014, M.dark, 0, 0.01, 0.1);                          // stock front strut
        box(g, 0.03, 0.03, 0.12, M.odGreen, 0, 0.058, 0.24);                        // cheek piece
        box(g, 0.044, 0.09, 0.03, M.odGreen, 0, 0.01, 0.33);
        box(g, 0.03, 0.03, 0.03, M.dark, 0, 0.012, -0.47);                          // bipod yoke
        for (const s of [-1, 1]) { box(g, 0.009, 0.009, 0.2, M.steel, s * 0.016, -0.012, -0.35, 0.05); box(g, 0.014, 0.01, 0.02, M.black, s * 0.016, -0.018, -0.25); }
        for (const s of [-1, 1]) box(g, 0.005, 0.034, 0.016, M.dark, s * 0.012, 0.078, -0.6);   // front sight hood ears
        box(g, 0.006, 0.03, 0.014, M.steel, 0.035, 0.068, -0.03, 0, 0, -0.35);      // upturned charging handle
        rail(g, 0.079, -0.42, -0.24, 0.024);                                        // handguard top rail
      }
      else { box(g, 0.045, 0.07, 0.3, M.wood, 0, 0.0, 0.22, 0.08); box(g, 0.047, 0.09, 0.015, M.dark, 0, -0.012, 0.37, 0.08); }
      box(g, 0.047, 0.1, 0.02, M.grip, 0, k12 ? 0.012 : -0.012, k12 ? 0.345 : 0.385, k12 ? 0 : 0.08);
      // --- detail
      rivets(g, 0.025, 0.02, [-0.19, -0.165, 0.05, 0.075]);                         // trunnion + rear rivets
      seams(g, 0.025, [0.052], -0.21, 0.09);
      box(g, 0.054, 0.03, 0.04, M.dark, 0, 0.012, -0.1);                            // mag well
      box(g, 0.054, 0.006, 0.012, M.steel, 0, 0.0, -0.075);                         // mag release paddle
      box(g, 0.02, 0.012, 0.02, M.steel, 0, 0.077, 0.095);                          // dust cover latch / recoil spring tab
      box(g, 0.006, 0.014, 0.02, M.steel, 0.024, 0.04, -0.22);                      // handguard retaining lever
      cyl(g, 0.0032, 0.2, M.steel, 0, 0.011, -0.53, 6);                             // cleaning rod
      box(g, 0.014, 0.012, 0.016, M.dark, 0, 0.012, -0.62);                         // bayonet lug
      for (let zz = -0.4; zz < -0.25; zz += 0.035) box(g, 0.042, 0.004, 0.006, M.black, 0, 0.074, zz); // upper handguard vents
      if (k12) { for (const s of [-1, 1]) { box(g, 0.003, 0.04, 0.1, M.black, s * 0.0225, 0.012, 0.26); for (let z = 0.2; z < 0.33; z += 0.02) box(g, 0.003, 0.004, 0.012, M.black, s * 0.0225, 0.05, z); } }   // AK-12 stock cut-out + adjustment notches
      if (!k12 && !gal) { sling(g, -0.03, 0.3); box(g, 0.006, 0.06, 0.2, M.black, 0.0235, -0.002, 0.22, 0.08); } // stock sling + inlay line
      else sling(g, -0.01, 0.26);
      sling(g, 0.01, -0.45);
      irons = { cy: 0.096, zr: -0.2, zf: -0.6 };
      if (k12) {                                                                    // AK-12: railed top cover + railed gas tube, optic sits straight on top
        rail(g, 0.082, -0.18, 0.08, 0.026); rail(g, 0.078, -0.42, -0.24, 0.024);
        optic(0.118, -0.06, 0.086, -0.18, 0.08);
      } else { optic(0.122, -0.1, 0.087, -0.2, 0.0); spot.side = true; }
      under = { y: -0.013, z: -0.34 };
      muzzleZ = -0.68; muzzleY = 0.03; left = [-0.02, -0.04, -0.33];
      break;
    }
    case 'ppsh': {
      box(g, 0.05, 0.055, 0.2, S, 0, 0.04, -0.05);                                  // receiver
      cyl(g, 0.024, 0.26, M.dark, 0, 0.04, -0.28, 12);                              // perforated barrel jacket
      for (let i = 0; i < 5; i++) box(g, 0.05, 0.009, 0.018, M.black, 0, 0.04, -0.19 - i * 0.045);
      box(g, 0.052, 0.05, 0.035, M.dark, 0, 0.042, -0.42);                          // slanted compensator
      box(g, 0.05, 0.06, 0.2, M.wood, 0, 0.0, -0.02);                               // wooden forend
      box(g, 0.045, 0.075, 0.26, M.wood, 0, -0.012, 0.19, 0.1);                     // wooden stock
      box(g, 0.047, 0.095, 0.02, M.dark, 0, -0.028, 0.32, 0.1);
      box(g, 0.008, 0.006, 0.07, M.dark, 0, -0.034, 0.04); box(g, 0.008, 0.03, 0.006, M.dark, 0, -0.02, 0.005); // trigger guard
      box(g, 0.004, 0.02, 0.006, M.steel, 0, -0.022, 0.03, 0.2);
      { const dm = magObj = part('mag', 0, -0.075, -0.09);                         // 71-round drum
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.05, 18), M.dark); drum.rotation.z = Math.PI / 2; drum.castShadow = true; dm.add(drum);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.054, 12), M.steel); cap.rotation.z = Math.PI / 2; dm.add(cap);
        pbox(dm, 0.03, 0.04, 0.04, M.dark, 0, -0.025, -0.09); }
      { const bp = part('bolt', 0.03, 0.05, 0.02); pbox(bp, 0.016, 0.012, 0.016, M.steel, 0.03, 0.05, 0.02); }
      box(g, 0.02, 0.012, 0.03, M.dark, 0, 0.072, 0.0); box(g, 0.012, 0.022, 0.012, M.dark, 0, 0.07, -0.42);
      // --- detail
      seams(g, 0.025, [0.06], -0.15, 0.05);
      box(g, 0.003, 0.016, 0.05, M.black, 0.026, 0.05, -0.04);                      // ejection port
      box(g, 0.012, 0.012, 0.006, M.steel, 0, 0.069, 0.04);                         // receiver latch
      box(g, 0.054, 0.012, 0.03, M.dark, 0, 0.018, -0.13);                          // mag catch
      cyl(g, 0.012, 0.03, M.dark, 0, 0.04, -0.15);                                  // jacket collar
      box(g, 0.052, 0.004, 0.2, M.black, 0, 0.03, -0.02);                           // forend/receiver seam
      box(g, 0.006, 0.05, 0.22, M.black, 0.0235, -0.012, 0.19, 0.1);                // stock inlay line
      sling(g, -0.05, 0.25); sling(g, 0.012, -0.12, -0.026);
      irons = { cy: 0.09, zr: 0.0, zf: -0.42 };
      optic(0.115, -0.08, 0.078, -0.16, 0.02); spot.side = true;
      under = { y: 0.014, z: -0.3 };
      muzzleZ = -0.44; muzzleY = 0.04; left = [-0.02, -0.04, -0.18];
      break;
    }
    case 'tommy': {
      box(g, 0.05, 0.06, 0.24, S, 0, 0.035, -0.05);                                 // receiver
      box(g, 0.052, 0.012, 0.1, M.steel, 0, 0.07, -0.02);
      { const bp = part('bolt', 0, 0.08, 0.02); pbox(bp, 0.016, 0.016, 0.016, M.steel, 0, 0.08, 0.02); }
      cyl(g, 0.014, 0.3, M.dark, 0, 0.04, -0.32);                                   // finned barrel
      for (let i = 0; i < 9; i++) cyl(g, 0.022, 0.007, M.dark, 0, 0.04, -0.2 - i * 0.026);
      box(g, 0.036, 0.036, 0.05, M.dark, 0, 0.045, -0.5);                           // compensator
      box(g, 0.035, 0.08, 0.045, M.wood, 0, -0.02, -0.26, -0.1);                    // wooden vertical foregrip
      triggerGroup(g, 0.02, M.wood, 0.3);
      box(g, 0.045, 0.07, 0.26, M.wood, 0, 0.005, 0.22, 0.06); box(g, 0.047, 0.085, 0.015, M.dark, 0, -0.004, 0.355, 0.06);
      { const dm = magObj = part('mag', 0, -0.07, -0.1);                           // 50-round drum
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.05, 18), M.dark); drum.rotation.z = Math.PI / 2; drum.castShadow = true; dm.add(drum);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.054, 10), M.steel); cap.rotation.z = Math.PI / 2; dm.add(cap); }
      box(g, 0.022, 0.016, 0.02, M.dark, 0, 0.074, 0.04); box(g, 0.008, 0.024, 0.01, M.dark, 0, 0.07, -0.47);
      // --- detail
      seams(g, 0.025, [0.012, 0.058], -0.17, 0.07);
      rivets(g, 0.025, 0.035, [-0.15, 0.05]);
      box(g, 0.003, 0.018, 0.05, M.black, 0.026, 0.05, -0.02);                      // ejection slot
      box(g, 0.004, 0.012, 0.016, M.steel, 0.027, 0.02, 0.0);                       // fire selector
      box(g, 0.004, 0.012, 0.016, M.steel, -0.027, 0.02, 0.01);                     // safety
      box(g, 0.054, 0.02, 0.05, M.dark, 0, -0.01, -0.1);                            // drum latch housing
      box(g, 0.02, 0.012, 0.03, M.dark, 0, 0.068, -0.15);                           // barrel nut
      ribs(g, 0.035, 0.07, -0.02, -0.285, -0.235, 0.012);                           // foregrip finger grooves
      sling(g, -0.03, 0.3);
      irons = { cy: 0.094, zr: 0.04, zf: -0.47 };
      optic(0.12, -0.05, 0.081, -0.15, 0.06); spot.side = true;
      muzzleZ = -0.53; muzzleY = 0.045; left = [0, -0.07, -0.26];
      break;
    }
    case 'mp5': {
      box(g, 0.048, 0.06, 0.3, S, 0, 0.035, -0.06);                                 // receiver
      box(g, 0.05, 0.03, 0.12, M.dark, 0, 0.004, 0.02);                             // trigger housing
      cyl(g, 0.012, 0.25, M.dark, 0, 0.071, -0.15);                                 // cocking tube
      { const bp = part('bolt', -0.02, 0.071, -0.25); pbox(bp, 0.022, 0.01, 0.012, M.steel, -0.026, 0.071, -0.25); }
      box(g, 0.054, 0.05, 0.16, M.grip, 0, 0.02, -0.27);                            // handguard
      for (let zz = -0.33; zz < -0.2; zz += 0.025) box(g, 0.056, 0.006, 0.008, M.black, 0, 0.02, zz);
      cyl(g, 0.01, 0.06, M.dark, 0, 0.035, -0.38); cyl(g, 0.014, 0.03, M.dark, 0, 0.035, -0.405);
      magObj = mag(g, -0.1, 0.16, -0.28, 0.028, 0.04);
      triggerGroup(g, 0.04);
      for (const s of [-1, 1]) box(g, 0.006, 0.006, 0.19, M.steel, s * 0.018, 0.03, 0.19);
      box(g, 0.05, 0.08, 0.02, M.grip, 0, 0.02, 0.29);
      box(g, 0.03, 0.022, 0.02, M.dark, 0, 0.071, 0.06); box(g, 0.03, 0.022, 0.012, M.dark, 0, 0.071, -0.36);
      // --- detail
      seams(g, 0.024, [0.012, 0.058], -0.2, 0.08);
      ejectPort(g, 0.024, 0.045, -0.06, 0.05);
      selector(g, 0.025, 0.012, 0.05);
      rivets(g, 0.024, 0.035, [-0.19, 0.07]);
      box(g, 0.05, 0.012, 0.03, M.dark, 0, -0.015, -0.1);                           // mag well lip
      box(g, 0.006, 0.006, 0.012, M.steel, 0.026, -0.008, -0.08);                   // mag release
      cyl(g, 0.016, 0.02, M.dark, 0, 0.071, -0.28);                                 // cocking tube end cap
      box(g, 0.012, 0.02, 0.02, M.dark, 0, 0.004, 0.09);                            // stock hinge block
      box(g, 0.05, 0.016, 0.03, M.dark, 0, 0.055, 0.29);                            // butt cap
      sling(g, 0.0, 0.1, -0.026);
      irons = { cy: 0.094, zr: 0.06, zf: -0.36 };
      optic(0.12, -0.1, 0.086, -0.2, 0.02); spot.side = true;
      under = { y: -0.006, z: -0.27 };
      muzzleZ = -0.42; muzzleY = 0.035; left = [-0.02, -0.04, -0.27];
      break;
    }
    case 'bizon': {
      box(g, 0.048, 0.06, 0.3, S, 0, 0.04, -0.05);
      box(g, 0.05, 0.012, 0.28, M.dark, 0, 0.075, -0.05);
      { const bp = part('bolt', 0.03, 0.05, -0.04); pbox(bp, 0.018, 0.012, 0.016, M.steel, 0.032, 0.05, -0.04); }
      { const mp = magObj = part('mag', 0, -0.005, -0.2);                          // helical magazine under the barrel
        pcyl(mp, 0.032, 0.3, M.dark, 0, -0.005, -0.2, 14);
        for (let i = 0; i < 6; i++) pcyl(mp, 0.034, 0.006, M.black, 0, -0.005, -0.32 + i * 0.05, 14); }
      cyl(g, 0.01, 0.12, M.dark, 0, 0.04, -0.27); cyl(g, 0.014, 0.04, M.dark, 0, 0.04, -0.35);
      triggerGroup(g, 0.04, M.grip, 0.25, 0.008);
      skeletonStock(g, 0.06, -0.01, 0.1, 0.3, M.dark, 0.018);
      box(g, 0.026, 0.012, 0.03, M.dark, 0, 0.087, 0.02); box(g, 0.008, 0.04, 0.012, M.dark, 0, 0.068, -0.32);
      // --- detail
      seams(g, 0.024, [0.015, 0.062], -0.19, 0.09);
      ejectPort(g, 0.024, 0.05, -0.02, 0.05);
      selector(g, 0.024, 0.02, 0.03);
      rivets(g, 0.024, 0.03, [-0.18, -0.15, 0.06]);
      for (let i = 0; i < 5; i++) box(g, 0.052, 0.003, 0.006, M.black, 0, 0.0815, -0.15 + i * 0.05); // dust cover ribs
      box(g, 0.036, 0.04, 0.03, M.dark, 0, 0.012, -0.08);                           // mag latch block
      cyl(g, 0.036, 0.012, M.dark, 0, -0.005, -0.06, 14);                           // helical mag rear cap
      box(g, 0.02, 0.03, 0.012, M.dark, 0, 0.055, -0.3);                            // front sight base
      sling(g, 0.0, 0.12, -0.026);
      irons = { cy: 0.1, zr: 0.02, zf: -0.32 };
      optic(0.125, -0.1, 0.087, -0.2, 0.05); spot.side = true;
      muzzleZ = -0.37; muzzleY = 0.04; left = [-0.02, -0.06, -0.2];
      break;
    }
    case 'skorpion': {
      // Vz.61: small slim pressed-steel receiver, curved mag ahead of the guard, wooden grip, bent-wire stock
      box(g, 0.04, 0.05, 0.26, S, 0, 0.038, -0.08);                                 // receiver (-0.21 .. 0.05)
      box(g, 0.042, 0.012, 0.22, M.dark, 0, 0.068, -0.08);                          // top cover
      box(g, 0.042, 0.016, 0.2, M.dark, 0, 0.006, -0.08);                           // lower frame
      seams(g, 0.02, [0.03, 0.05], -0.2, 0.04);
      rivets(g, 0.02, 0.02, [-0.19, -0.16, 0.03]);
      ejectPort(g, 0.02, 0.05, -0.06, 0.045);                                       // ejects straight up/right
      selector(g, 0.021, 0.014, 0.03);
      for (const s of [-1, 1]) { const bp = s > 0 ? part('bolt', 0.03, 0.05, -0.15) : null;   // twin cocking knobs
        if (bp) pbox(bp, 0.016, 0.012, 0.012, M.steel, 0.028, 0.05, -0.15); else box(g, 0.016, 0.012, 0.012, M.steel, -0.028, 0.05, -0.15); }
      cyl(g, 0.0095, 0.05, M.dark, 0, 0.04, -0.235);                                // barrel stub
      cyl(g, 0.013, 0.02, M.black, 0, 0.04, -0.265);                                // muzzle nut
      for (const s of [-1, 1]) box(g, 0.004, 0.02, 0.012, M.dark, s * 0.01, 0.08, -0.2);   // front sight ears
      magObj = mag(g, -0.085, 0.16, 0.22, 0.024, 0.034, M.dark, 0.0);              // curved 20-round mag
      triggerGroup(g, 0.0, M.wood, 0.4, 0.0);
      for (const s of [-1, 1]) box(g, 0.0045, 0.0045, 0.22, M.steel, s * 0.013, 0.05, 0.16);          // wire stock top rails
      for (const s of [-1, 1]) box(g, 0.0045, 0.0045, 0.21, M.steel, s * 0.013, 0.012, 0.16, 0.16);   // wire stock lower rails
      box(g, 0.03, 0.07, 0.006, M.steel, 0, 0.025, 0.27);                           // butt loop
      box(g, 0.02, 0.016, 0.02, M.dark, 0, 0.04, 0.055);                            // stock hinge
      sling(g, 0.0, 0.0, 0.022);
      rail(g, 0.078, -0.17, -0.02, 0.022);                                          // short optic rail on the top cover
      irons = { cy: 0.092, zr: 0.03, zf: -0.2 };
      optic(0.112, -0.09, 0.082, -0.17, -0.02);
      under = { y: -0.003, z: -0.17 };
      muzzleZ = -0.28; muzzleY = 0.04; left = [-0.01, -0.03, -0.17];
      break;
    }
    case 'famas': {
      box(g, 0.056, 0.09, 0.5, S, 0, 0.02, 0.02);                                   // bullpup body
      box(g, 0.058, 0.03, 0.2, M.black, 0, 0.0, 0.1);
      box(g, 0.02, 0.05, 0.03, M.dark, 0, 0.09, -0.18); box(g, 0.02, 0.05, 0.03, M.dark, 0, 0.09, 0.12); // carry handle legs
      box(g, 0.024, 0.014, 0.33, M.dark, 0, 0.12, -0.03);                           // carry handle
      { const bp = part('bolt', 0, 0.105, 0.0); pbox(bp, 0.03, 0.01, 0.02, M.steel, 0, 0.106, 0.0); }
      box(g, 0.05, 0.05, 0.14, M.dark, 0, 0.02, -0.3);
      cyl(g, 0.01, 0.24, M.dark, 0, 0.03, -0.45); cyl(g, 0.013, 0.04, M.black, 0, 0.03, -0.59);
      for (const s of [-1, 1]) box(g, 0.008, 0.008, 0.18, M.dark, s * 0.02, -0.005, -0.4);   // folded bipod
      magObj = mag(g, 0.15, 0.13, -0.05, 0.03, 0.055, M.dark, -0.02);
      triggerGroup(g, -0.12, M.grip, 0.2, -0.02);
      box(g, 0.05, 0.006, 0.2, M.black, 0, -0.06, -0.08);                           // full-length trigger guard
      box(g, 0.054, 0.09, 0.02, M.grip, 0, 0.02, 0.28);
      // --- detail
      seams(g, 0.028, [0.058, -0.018], -0.22, 0.26);
      for (const s of [-1, 1]) for (let zz = -0.2; zz < 0.2; zz += 0.05) box(g, 0.003, 0.016, 0.022, M.black, s * 0.029, 0.04, zz);   // body vents
      ejectPort(g, 0.028, 0.035, 0.12, 0.06);
      ejectPort(g, -0.031, 0.035, 0.12, 0.06);                                      // ambidextrous ports
      box(g, 0.04, 0.012, 0.024, M.dark, 0, 0.127, 0.115); box(g, 0.04, 0.012, 0.024, M.dark, 0, 0.127, -0.185);   // sight housings on the handle
      box(g, 0.003, 0.03, 0.2, M.black, 0.026, 0.02, -0.3);                         // handguard slot
      ribs(g, 0.05, 0.05, 0.02, -0.37, -0.23, 0.02);
      box(g, 0.02, 0.016, 0.02, M.steel, 0, -0.012, -0.32);                         // bipod hinge
      selector(g, 0.028, -0.02, 0.15);
      sling(g, -0.02, 0.22);
      irons = { cy: 0.142, zr: 0.1, zf: -0.17 };
      optic(0.158, -0.03, 0.127, -0.15, 0.1); spot.side = true;
      under = { y: -0.006, z: -0.3 };
      muzzleZ = -0.61; muzzleY = 0.03; left = [-0.02, -0.04, -0.3];
      break;
    }
    case 'aug': {
      box(g, 0.06, 0.09, 0.36, S, 0, 0.0, 0.1);                                     // polymer stock body
      box(g, 0.062, 0.05, 0.12, M.black, 0, -0.01, 0.15);
      cyl(g, 0.024, 0.32, M.dark, 0, 0.06, -0.08);                                  // receiver tube
      { const bp = part('bolt', 0.03, 0.06, -0.12); pbox(bp, 0.02, 0.012, 0.016, M.steel, 0.032, 0.06, -0.12); }
      box(g, 0.03, 0.08, 0.035, M.grip, 0, -0.04, -0.2, -0.2);                      // folding foregrip
      box(g, 0.05, 0.006, 0.25, M.dark, 0, -0.05, -0.08);                           // big trigger guard
      triggerGroup(g, -0.1, M.grip, 0.2, -0.02);
      cyl(g, 0.011, 0.3, M.dark, 0, 0.04, -0.4); cyl(g, 0.014, 0.05, M.black, 0, 0.04, -0.57);
      magObj = mag(g, 0.1, 0.13, -0.05, 0.03, 0.05, M.dark, -0.04);
      box(g, 0.062, 0.1, 0.02, M.grip, 0, 0.0, 0.285);
      rail(g, 0.087, -0.2, 0.04, 0.024);
      // --- detail
      seams(g, 0.03, [0.04, -0.03], -0.08, 0.27);
      box(g, 0.064, 0.012, 0.36, M.dark, 0, 0.046, 0.1);                            // body top strip
      for (const s of [-1, 1]) box(g, 0.004, 0.03, 0.05, M.black, s * 0.031, 0.01, 0.2);   // ejection port covers
      box(g, 0.02, 0.02, 0.04, M.dark, 0, 0.06, -0.24);                             // barrel lock / gas block
      cyl(g, 0.016, 0.03, M.dark, 0, 0.04, -0.27);                                  // barrel collar
      box(g, 0.006, 0.006, 0.05, M.steel, 0.026, 0.035, -0.2);                      // barrel release
      box(g, 0.064, 0.012, 0.05, M.dark, 0, -0.035, 0.1);                           // mag well lip
      box(g, 0.006, 0.012, 0.016, M.steel, 0.032, -0.03, 0.04);                     // cross-bolt safety
      ribs(g, 0.03, 0.08, -0.04, -0.215, -0.185, 0.01);                              // foregrip grooves
      buttPad(g, 0.06, 0.1, 0.0, 0.29);
      sling(g, -0.045, 0.24);
      muzzleZ = -0.6; muzzleY = 0.04; left = [0, -0.08, -0.2];
      break;
    }
    case 'g36': {
      box(g, 0.052, 0.07, 0.3, S, 0, 0.035, -0.06);
      { const bp = part('bolt', 0, 0.075, -0.1); pbox(bp, 0.024, 0.01, 0.02, M.steel, 0, 0.076, -0.1); }
      box(g, 0.058, 0.055, 0.16, M.dark, 0, 0.025, -0.29); vents(g, 0.025, -0.36, -0.22, 0.03, 4);
      cyl(g, 0.01, 0.12, M.dark, 0, 0.035, -0.42); cyl(g, 0.014, 0.05, M.black, 0, 0.035, -0.5);
      magObj = mag(g, -0.11, 0.15, -0.15, 0.03, 0.055, M.smokeMag);                // translucent polymer mag
      { const rounds = magObj; for (let i = 0; i < 4; i++) box(rounds, 0.012, 0.008, 0.04, M.brass, 0, -0.01 - i * 0.012, -0.004); }   // visible cartridges
      triggerGroup(g, 0.02, M.polyGG);
      skeletonStock(g, 0.055, -0.02, 0.09, 0.3, M.polyGG);
      // tall carry handle with the optic rail on top (G36 signature)
      box(g, 0.03, 0.05, 0.03, S, 0, 0.093, -0.175);                                // front handle post
      box(g, 0.03, 0.05, 0.04, S, 0, 0.093, 0.04);                                  // rear handle post
      box(g, 0.034, 0.016, 0.26, S, 0, 0.124, -0.07);                               // handle bridge
      box(g, 0.012, 0.03, 0.17, M.black, 0, 0.096, -0.07);                          // handle opening shadow
      for (const s of [-1, 1]) for (let zz = -0.15; zz < 0.02; zz += 0.04) box(g, 0.003, 0.008, 0.016, M.black, s * 0.0175, 0.124, zz);   // lightening cuts
      rail(g, 0.136, -0.18, 0.04, 0.026);
      // --- detail
      box(g, 0.054, 0.024, 0.3, M.dark, 0, 0.012, -0.06);                           // lower receiver
      seams(g, 0.026, [0.024, 0.05], -0.2, 0.09);
      ejectPort(g, 0.026, 0.05, -0.05, 0.055);
      selector(g, 0.027, 0.02, 0.04);
      for (const s of [-1, 1]) for (let zz = -0.17; zz < 0.06; zz += 0.045) box(g, 0.003, 0.006, 0.006, M.steel, s * 0.0275, 0.003, zz);   // receiver pins
      box(g, 0.04, 0.016, 0.03, M.dark, 0, 0.063, -0.19);                           // front sight block
      box(g, 0.054, 0.012, 0.035, M.dark, 0, -0.015, -0.11);                        // mag well lip
      box(g, 0.006, 0.014, 0.018, M.steel, 0, -0.03, -0.085);                       // mag paddle
      box(g, 0.024, 0.024, 0.02, M.dark, 0, 0.03, 0.09);                            // stock hinge
      sling(g, 0.0, -0.36);
      irons = { cy: 0.154, zr: 0.04, zf: -0.17 };
      optic(0.17, -0.07, 0.14, -0.18, 0.04);
      under = { y: -0.003, z: -0.29 };
      muzzleZ = -0.53; muzzleY = 0.035; left = [-0.02, -0.04, -0.29];
      break;
    }
    case 'asval': {
      box(g, 0.048, 0.06, 0.26, S, 0, 0.035, -0.04);
      box(g, 0.05, 0.012, 0.24, M.dark, 0, 0.067, -0.04);
      { const bp = part('bolt', 0.03, 0.045, -0.02); pbox(bp, 0.018, 0.012, 0.016, M.steel, 0.032, 0.045, -0.02); }
      cyl(g, 0.026, 0.34, M.black, 0, 0.035, -0.36, 14);                            // integral suppressor
      cyl(g, 0.028, 0.02, M.dark, 0, 0.035, -0.53, 14);
      box(g, 0.06, 0.05, 0.12, M.grip, 0, 0.03, -0.24);
      magObj = mag(g, -0.09, 0.12, -0.1, 0.028, 0.05);
      triggerGroup(g, 0.02);
      skeletonStock(g, 0.05, -0.025, 0.09, 0.3);
      box(g, 0.026, 0.012, 0.03, M.dark, 0, 0.078, -0.05); box(g, 0.01, 0.03, 0.012, M.dark, 0, 0.07, -0.45);
      // --- detail
      seams(g, 0.024, [0.015, 0.055], -0.16, 0.08);
      rivets(g, 0.024, 0.025, [-0.15, -0.13, 0.06]);
      ejectPort(g, 0.024, 0.045, -0.02, 0.05);
      selector(g, 0.024, 0.015, 0.02);
      for (let i = 0; i < 4; i++) box(g, 0.051, 0.003, 0.006, M.black, 0, 0.0735, -0.13 + i * 0.05);   // dust cover ribs
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) box(g, 0.003, 0.008, 0.024, M.black, s * 0.026, 0.035, -0.3 - i * 0.035);   // suppressor vent slots
      cyl(g, 0.0275, 0.012, M.dark, 0, 0.035, -0.2, 14);                            // suppressor clamp
      box(g, 0.006, 0.012, 0.03, M.steel, 0.027, 0.035, -0.2);                      // clamp lever
      box(g, 0.05, 0.03, 0.035, M.dark, 0, 0.0, -0.09);                             // mag well
      ribs(g, 0.06, 0.05, 0.03, -0.29, -0.19, 0.02);
      box(g, 0.022, 0.024, 0.024, M.dark, 0, 0.02, 0.09);                           // stock hinge
      sling(g, 0.0, 0.1, 0.026);
      irons = { cy: 0.096, zr: -0.05, zf: -0.45 };
      optic(0.12, -0.07, 0.085, -0.17, 0.05); spot.side = true;
      under = { y: 0.005, z: -0.24 };
      muzzleZ = -0.54; muzzleY = 0.035; left = [-0.02, -0.04, -0.25];
      break;
    }
    case 'scarh': {
      box(g, 0.054, 0.06, 0.42, S, 0, 0.05, -0.12);                                 // long upper receiver
      box(g, 0.05, 0.05, 0.2, M.dark, 0, 0.0, -0.02);                               // lower
      { const bp = part('bolt', 0.035, 0.05, -0.2); pbox(bp, 0.026, 0.012, 0.012, M.steel, 0.04, 0.05, -0.2); }
      for (const s of [-1, 1]) for (let zz = -0.32; zz < -0.18; zz += 0.016) box(g, 0.006, 0.026, 0.007, M.black, s * 0.029, 0.045, zz);
      cyl(g, 0.012, 0.2, M.dark, 0, 0.04, -0.42); muzzleBrake(g, 0.04, -0.55, 0.016, 0.06);
      magObj = mag(g, -0.1, 0.13, -0.1, 0.034, 0.07);
      triggerGroup(g, 0.02);
      box(g, 0.05, 0.08, 0.24, S, 0, 0.03, 0.22); box(g, 0.03, 0.02, 0.18, S, 0, 0.078, 0.22); box(g, 0.052, 0.095, 0.02, M.grip, 0, 0.025, 0.345);   // folding stock (same finish as the upper)
      box(g, 0.052, 0.05, 0.16, M.polyBlack, 0, 0.0, -0.02);                        // black polymer lower
      rail(g, 0.081, -0.5, 0.06);
      // --- detail
      seams(g, 0.027, [0.03], -0.32, 0.08);
      ejectPort(g, 0.027, 0.055, -0.03, 0.06);
      selector(g, 0.025, 0.01, 0.04);
      rivets(g, 0.025, 0.0, [-0.1, 0.07]);
      box(g, 0.006, 0.012, 0.3, M.dark, 0.03, 0.045, -0.33); box(g, 0.006, 0.012, 0.3, M.dark, -0.03, 0.045, -0.33);   // side rails
      box(g, 0.024, 0.01, 0.2, M.dark, 0, 0.016, -0.36);                            // bottom rail
      for (let z = -0.45; z < -0.27; z += 0.014) box(g, 0.028, 0.006, 0.007, M.black, 0, 0.011, z);
      box(g, 0.054, 0.016, 0.04, M.dark, 0, -0.02, -0.1);                           // mag well flare
      box(g, 0.006, 0.012, 0.012, M.steel, 0.026, -0.02, -0.075);                   // mag release
      box(g, 0.054, 0.03, 0.02, M.dark, 0, 0.04, 0.09);                             // folding hinge
      for (const s of [-1, 1]) box(g, 0.003, 0.05, 0.2, M.black, s * 0.0255, 0.03, 0.22);  // stock side cut-outs
      buttPad(g, 0.05, 0.095, 0.025, 0.345);
      sling(g, 0.0, 0.3);
      irons = { cy: 0.104, zr: 0.04, zf: -0.45 };
      optic(0.115, -0.12, 0.085, -0.5, 0.06);
      under = { y: 0.018, z: -0.3 };
      muzzleZ = -0.58; muzzleY = 0.04; left = [-0.02, -0.03, -0.3];
      break;
    }
    case 'fal': {
      box(g, 0.05, 0.065, 0.32, S, 0, 0.04, -0.06);
      box(g, 0.052, 0.012, 0.3, M.dark, 0, 0.076, -0.06);
      { const bp = part('bolt', -0.03, 0.05, -0.12); pbox(bp, 0.02, 0.012, 0.016, M.steel, -0.032, 0.05, -0.12); }
      box(g, 0.058, 0.055, 0.2, M.wood, 0, 0.03, -0.32);
      for (let zz = -0.4; zz < -0.24; zz += 0.03) box(g, 0.06, 0.03, 0.008, M.black, 0, 0.03, zz);
      cyl(g, 0.011, 0.3, M.dark, 0, 0.04, -0.5); cyl(g, 0.016, 0.07, M.black, 0, 0.04, -0.68);
      box(g, 0.02, 0.04, 0.02, M.dark, 0, 0.063, -0.6);
      magObj = mag(g, -0.1, 0.13, -0.08, 0.034, 0.065);
      triggerGroup(g, 0.02);
      box(g, 0.045, 0.08, 0.28, M.wood, 0, 0.01, 0.22, 0.08); box(g, 0.047, 0.1, 0.012, M.dark, 0, -0.002, 0.36, 0.08);
      box(g, 0.008, 0.02, 0.07, M.dark, -0.03, 0.07, -0.16);
      box(g, 0.026, 0.012, 0.03, M.dark, 0, 0.083, 0.06);
      // --- detail
      box(g, 0.054, 0.03, 0.26, M.dark, 0, 0.005, -0.04);                           // lower receiver
      seams(g, 0.025, [0.02, 0.06], -0.22, 0.1);
      rivets(g, 0.025, 0.04, [-0.2, -0.17, 0.08]);
      ejectPort(g, 0.025, 0.05, -0.04, 0.06);
      selector(g, 0.027, 0.0, 0.05);
      box(g, 0.012, 0.016, 0.016, M.steel, 0, -0.012, 0.09);                        // takedown lever
      box(g, 0.054, 0.012, 0.035, M.dark, 0, -0.018, -0.11);                        // mag well lip
      box(g, 0.024, 0.024, 0.03, M.dark, 0, 0.045, -0.44);                          // gas block / regulator
      cyl(g, 0.006, 0.08, M.steel, 0.018, 0.045, -0.44);                            // gas plug
      box(g, 0.014, 0.012, 0.016, M.dark, 0, 0.025, -0.62);                         // bayonet lug
      box(g, 0.006, 0.05, 0.22, M.black, 0.0235, 0.008, 0.22, 0.08);                // stock line
      sling(g, -0.03, 0.3); sling(g, 0.01, -0.42);
      irons = { cy: 0.096, zr: 0.06, zf: -0.6 };
      optic(0.122, -0.08, 0.089, -0.2, 0.04); spot.side = true;
      under = { y: 0.0, z: -0.32 };
      muzzleZ = -0.72; muzzleY = 0.04; left = [-0.02, -0.03, -0.32];
      break;
    }
    case 'm249': case 'pkm': {
      const pk = model === 'pkm';
      box(g, pk ? 0.06 : 0.064, pk ? 0.085 : 0.09, 0.34, S, 0, 0.035, -0.06);
      { const cv = part('cover', 0, 0.085, -0.16);
        pbox(cv, 0.066, 0.024, 0.18, M.dark, 0, 0.088, -0.07);
        for (let i = 0; i < 3; i++) pbox(cv, 0.068, 0.004, 0.006, M.black, 0, 0.101, -0.13 + i * 0.05); }
      { const bp = part('bolt', 0.04, 0.03, -0.12); pbox(bp, 0.03, 0.014, 0.014, M.steel, 0.045, 0.03, -0.12); }
      if (pk) {
        cyl(g, 0.014, 0.5, M.dark, 0, 0.035, -0.5); for (let i = 0; i < 6; i++) box(g, 0.03, 0.004, 0.03, M.black, 0, 0.035, -0.35 - i * 0.06);
        cyl(g, 0.017, 0.06, M.black, 0, 0.035, -0.78); cyl(g, 0.009, 0.3, M.dark, 0, 0.008, -0.4);
        box(g, 0.03, 0.025, 0.26, M.wood, 0, 0.04, 0.22); box(g, 0.03, 0.025, 0.26, M.wood, 0, -0.03, 0.21, 0.15); box(g, 0.04, 0.11, 0.03, M.wood, 0, 0.0, 0.36);
        box(g, 0.026, 0.008, 0.03, M.dark, 0, 0.081, 0.02); box(g, 0.01, 0.045, 0.012, M.dark, 0, 0.06, -0.7);
        irons = { cy: 0.095, zr: 0.02, zf: -0.7 };
        optic(0.125, -0.02, 0.09, -0.12, 0.06); spot.side = true;
      } else {
        cyl(g, 0.015, 0.4, M.dark, 0, 0.03, -0.48); box(g, 0.07, 0.055, 0.18, M.dark, 0, 0.01, -0.3);
        box(g, 0.05, 0.01, 0.2, M.dark, 0, 0.06, -0.38); cyl(g, 0.017, 0.05, M.black, 0, 0.03, -0.7);
        box(g, 0.05, 0.09, 0.24, S, 0, 0.0, 0.27); box(g, 0.052, 0.1, 0.02, M.grip, 0, 0.0, 0.4);
        rail(g, 0.084, 0.0, 0.12);
        optic(0.118, 0.06, 0.084, 0.0, 0.12);
        under = { y: -0.018, z: -0.3 };
      }
      for (const s of [-1, 1]) box(g, 0.01, 0.01, 0.26, M.steel, s * 0.02, pk ? -0.005 : -0.022, -0.5);   // folded bipod
      { const mb = magObj = part('mag', -0.04, -0.01, -0.05);
        pbox(mb, 0.08, 0.11, 0.13, pk ? M.olive : M.dark, -0.045, -0.065, -0.05);
        pbox(mb, 0.082, 0.014, 0.132, M.black, -0.045, -0.005, -0.05);
        for (let i = 0; i < 4; i++) pcyl(mb, 0.0055, 0.034, M.brass, -0.02 - i * 0.01, 0.02 - i * 0.012, -0.05, 6); }
      triggerGroup(g, 0.06);
      // --- detail
      const hw = pk ? 0.03 : 0.032;
      seams(g, hw, [0.0, 0.06], -0.22, 0.1);
      rivets(g, hw, 0.02, [-0.2, -0.17, -0.02, 0.08]);
      rivets(g, hw, 0.05, [-0.2, 0.08]);
      ejectPort(g, hw, 0.015, 0.02, 0.06, 0.016);
      box(g, 0.03, 0.03, 0.05, M.dark, -hw - 0.012, 0.06, -0.06);                   // feed tray side
      box(g, 0.02, 0.012, 0.016, M.steel, 0, 0.1, 0.03);                            // cover latch
      box(g, 0.006, 0.014, 0.02, M.steel, hw + 0.002, 0.0, 0.07);                   // safety
      cyl(g, 0.012, 0.03, M.dark, 0, pk ? 0.035 : 0.03, -0.23);                     // barrel lock collar
      box(g, 0.05, 0.012, 0.012, M.steel, -0.03, pk ? 0.05 : 0.045, -0.24);         // barrel change handle
      box(g, 0.012, 0.03, 0.012, M.dark, -0.05, pk ? 0.04 : 0.035, -0.24);
      box(g, 0.026, 0.02, 0.03, M.dark, 0, pk ? 0.0 : -0.005, -0.62);               // gas block / bipod yoke
      if (!pk) { for (const s of [-1, 1]) { for (let z = 0.18; z < 0.38; z += 0.03) box(g, 0.003, 0.07, 0.008, M.black, s * 0.0255, 0.0, z); box(g, 0.003, 0.003, 0.22, M.black, s * 0.0255, 0.04, 0.27); }   // stock ribs
        ribs(g, 0.07, 0.055, 0.01, -0.39, -0.21, 0.025); for (let zz = -0.46; zz < -0.3; zz += 0.03) box(g, 0.052, 0.004, 0.012, M.black, 0, 0.066, zz); buttPad(g, 0.05, 0.1, 0.0, 0.4); }
      else { box(g, 0.03, 0.08, 0.02, M.wood, 0, 0.005, 0.1); box(g, 0.042, 0.012, 0.03, M.steel, 0, 0.055, 0.36); }   // pkm stock bridge + butt plate
      sling(g, -0.04, 0.3); sling(g, 0.0, -0.4, -0.02);
      muzzleZ = pk ? -0.82 : -0.73; muzzleY = pk ? 0.035 : 0.03; left = [-0.03, -0.04, -0.32];
      break;
    }
    case 'kar98': {
      box(g, 0.05, 0.06, 0.62, M.wood, 0, 0.0, -0.18);                              // full-length wooden stock
      box(g, 0.04, 0.06, 0.12, M.wood, 0, -0.012, 0.16, 0.15);
      box(g, 0.045, 0.1, 0.18, M.wood, 0, -0.035, 0.3, 0.12); box(g, 0.047, 0.11, 0.01, M.steel, 0, -0.045, 0.39, 0.12);
      cyl(g, 0.018, 0.22, S, 0, 0.04, -0.02);                                       // receiver
      cyl(g, 0.011, 0.4, M.dark, 0, 0.04, -0.45); cyl(g, 0.013, 0.03, M.dark, 0, 0.04, -0.66);
      for (const zz of [-0.36, -0.46]) box(g, 0.054, 0.066, 0.012, M.dark, 0, 0.012, zz);    // barrel bands
      { const bp = part('bolt', 0.02, 0.045, 0.07);                                 // turned-down bolt handle
        pcyl(bp, 0.007, 0.07, M.steel, 0.0, 0.045, 0.06); pbox(bp, 0.05, 0.008, 0.008, M.steel, 0.03, 0.035, 0.08, 0, 0, -0.5);
        pbox(bp, 0.018, 0.018, 0.018, M.steel, 0.055, 0.02, 0.08); }
      box(g, 0.008, 0.006, 0.06, M.dark, 0, -0.035, 0.06); box(g, 0.004, 0.02, 0.006, M.steel, 0, -0.022, 0.06, 0.2);
      box(g, 0.02, 0.025, 0.02, M.dark, 0, 0.062, -0.63); box(g, 0.03, 0.012, 0.04, M.dark, 0, 0.065, -0.18);
      // --- detail
      box(g, 0.042, 0.016, 0.1, S, 0, 0.026, -0.02);                                // receiver flats
      box(g, 0.003, 0.014, 0.05, M.black, 0.019, 0.046, 0.0);                       // loading port
      cyl(g, 0.02, 0.014, M.dark, 0, 0.04, -0.13);                                  // receiver ring
      cyl(g, 0.012, 0.03, M.steel, 0, 0.04, 0.11);                                  // bolt shroud / cocking piece
      box(g, 0.01, 0.012, 0.01, M.steel, 0, 0.056, 0.12);                           // safety flag
      box(g, 0.05, 0.012, 0.09, M.dark, 0, -0.03, -0.02);                           // floor plate
      box(g, 0.054, 0.005, 0.4, M.black, 0, 0.032, -0.3);                           // stock top line
      box(g, 0.003, 0.01, 0.26, M.black, 0.0255, 0.012, -0.27);                     // finger grooves
      box(g, 0.003, 0.01, 0.26, M.black, -0.0255, 0.012, -0.27);
      cyl(g, 0.003, 0.14, M.steel, 0, -0.012, -0.55, 6);                            // cleaning rod (tip under the muzzle)
      box(g, 0.02, 0.012, 0.02, M.steel, 0, -0.035, -0.4);                          // sling bar
      sling(g, -0.08, 0.26, 0.024);
      box(g, 0.054, 0.006, 0.012, M.dark, 0, 0.034, -0.22);                         // rear sight base
      irons = { cy: 0.086, zr: -0.18, zf: -0.63 };
      optic(0.112, -0.03, 0.077, -0.12, 0.06); spot.side = true;
      muzzleZ = -0.68; muzzleY = 0.04; left = [-0.02, -0.05, -0.32];
      break;
    }
    case 'ksg': {
      box(g, 0.06, 0.09, 0.42, S, 0, 0.02, 0.04);                                   // bullpup body
      box(g, 0.062, 0.1, 0.02, M.grip, 0, 0.02, 0.26);
      for (const s of [-1, 1]) cyl(g, 0.014, 0.44, M.dark, s * 0.016, 0.0, -0.3);   // twin magazine tubes
      cyl(g, 0.017, 0.48, M.dark, 0, 0.045, -0.34);
      { const pp = part('pump', 0, 0.0, -0.38);
        pbox(pp, 0.07, 0.05, 0.14, M.grip, 0, 0.0, -0.38); pbox(pp, 0.028, 0.07, 0.03, M.grip, 0, -0.055, -0.4); }
      triggerGroup(g, -0.12, M.grip, 0.2, -0.025);
      rail(g, 0.068, -0.3, 0.1);
      // --- detail
      seams(g, 0.03, [0.045, -0.01], -0.17, 0.25);
      for (const s of [-1, 1]) box(g, 0.004, 0.03, 0.08, M.black, s * 0.031, 0.01, 0.1);   // ejection / loading ports
      for (const s of [-1, 1]) box(g, 0.004, 0.012, 0.03, M.steel, s * 0.031, -0.025, 0.02); // tube selector
      for (const s of [-1, 1]) cyl(g, 0.016, 0.02, M.dark, s * 0.016, 0.0, -0.52);  // tube caps
      box(g, 0.05, 0.02, 0.02, M.dark, 0, 0.022, -0.5);                             // barrel clamp
      cyl(g, 0.019, 0.03, M.dark, 0, 0.045, -0.56);                                 // muzzle collar
      box(g, 0.064, 0.012, 0.012, M.steel, 0, -0.045, -0.13);                       // pump release
      ribs(g, 0.07, 0.052, 0.0, -0.45, -0.31, 0.02);
      box(g, 0.064, 0.03, 0.06, M.black, 0, -0.03, 0.16);                           // shell lift cover
      buttPad(g, 0.062, 0.1, 0.02, 0.26);
      sling(g, -0.03, 0.22);
      irons = { cy: 0.09, zr: 0.06, zf: -0.28 };
      optic(0.1, -0.12, 0.072, -0.3, 0.1);
      muzzleZ = -0.59; muzzleY = 0.045; left = [0, -0.09, -0.4];
      break;
    }
    case 'tcsg': {
      box(g, 0.058, 0.075, 0.32, S, 0, 0.03, -0.06);
      { const bp = part('bolt', 0.035, 0.04, -0.06); pbox(bp, 0.02, 0.014, 0.016, M.steel, 0.036, 0.04, -0.06); }
      box(g, 0.064, 0.06, 0.2, M.wolf, 0, 0.025, -0.32); vents(g, 0.025, -0.4, -0.24, 0.033, 4);   // grey railed handguard
      cyl(g, 0.017, 0.2, M.dark, 0, 0.035, -0.5); muzzleBrake(g, 0.035, -0.62, 0.022, 0.06);
      magObj = mag(g, -0.1, 0.17, -0.2, 0.044, 0.08, M.wolf);                       // long curved shotgun box mag
      triggerGroup(g, 0.02, M.wolf);
      skeletonStock(g, 0.06, -0.035, 0.1, 0.33, M.wolf, 0.022);                     // grey skeleton stock
      rail(g, 0.068, -0.2, 0.08);
      // --- detail
      box(g, 0.062, 0.026, 0.32, M.dark, 0, 0.004, -0.06);                          // lower receiver
      seams(g, 0.029, [0.017, 0.05], -0.2, 0.09);
      ejectPort(g, 0.029, 0.045, -0.05, 0.07, 0.022);
      selector(g, 0.031, 0.01, 0.04);
      rivets(g, 0.031, 0.004, [-0.17, 0.07]);
      box(g, 0.062, 0.016, 0.05, M.dark, 0, -0.018, -0.05);                         // mag well flare
      box(g, 0.006, 0.014, 0.014, M.steel, 0.03, -0.02, -0.02);                     // mag release
      box(g, 0.022, 0.014, 0.18, M.dark, 0, -0.012, -0.32);                         // bottom rail
      for (let z = -0.4; z < -0.24; z += 0.014) box(g, 0.026, 0.006, 0.007, M.black, 0, -0.017, z);
      cyl(g, 0.02, 0.02, M.dark, 0, 0.035, -0.41);                                  // barrel nut
      sling(g, -0.03, 0.3);
      irons = { cy: 0.092, zr: 0.06, zf: -0.18 };
      optic(0.1, -0.06, 0.072, -0.2, 0.08);
      under = { y: -0.005, z: -0.32 };
      muzzleZ = -0.65; muzzleY = 0.035; left = [-0.02, -0.04, -0.32];
      break;
    }
    case 'dbarrel': case 'sawedoff': {
      const sawn = model === 'sawedoff', blen = sawn ? 0.26 : 0.56;
      const br = part('brk', 0, 0.02, -0.08);                                       // barrels + forend tip open on the hinge
      for (const s of [-1, 1]) pcyl(br, 0.018, blen, M.dark, s * 0.018, 0.045, -0.08 - blen / 2);
      pbox(br, 0.012, 0.008, blen, M.dark, 0, 0.066, -0.08 - blen / 2);            // rib
      pbox(br, 0.06, 0.04, sawn ? 0.12 : 0.18, M.wood, 0, 0.01, -0.17);           // forend
      pbox(br, 0.006, 0.006, 0.006, M.brass, 0, 0.073, -0.08 - blen + 0.012);     // bead
      box(g, 0.06, 0.06, 0.1, S, 0, 0.03, -0.03);                                   // receiver
      box(g, 0.012, 0.008, 0.03, M.steel, 0, 0.064, 0.0);                           // top lever
      box(g, 0.008, 0.006, 0.06, M.dark, 0, -0.022, 0.0);
      for (const zz of [-0.01, 0.015]) box(g, 0.004, 0.02, 0.006, M.steel, 0, -0.01, zz, 0.2);
      if (sawn) box(g, 0.04, 0.11, 0.05, M.wood, 0, -0.04, 0.07, 0.5);
      else { box(g, 0.045, 0.08, 0.3, M.wood, 0, 0.0, 0.18, 0.12); box(g, 0.047, 0.1, 0.015, M.dark, 0, -0.018, 0.33, 0.12); }
      // --- detail
      for (const s of [-1, 1]) { box(g, 0.003, 0.03, 0.06, M.steel, s * 0.031, 0.03, -0.03); box(g, 0.004, 0.006, 0.006, M.dark, s * 0.032, 0.03, -0.065); }   // engraved side plates + hinge pin
      box(g, 0.062, 0.006, 0.1, M.black, 0, 0.012, -0.03);                          // receiver seam
      box(g, 0.012, 0.012, 0.02, M.steel, 0, 0.068, 0.02);                          // safety slide
      for (const s of [-1, 1]) pcyl(br, 0.0185, 0.012, M.black, s * 0.018, 0.045, -0.08 - blen + 0.006);   // muzzle rims
      pbox(br, 0.04, 0.012, 0.03, M.steel, 0, 0.02, -0.1);                         // forend latch
      for (let z = -0.22; z < -0.12; z += 0.02) pbox(br, 0.062, 0.005, 0.006, M.black, 0, -0.008, z);   // forend checkering (moves with the barrels)
      if (sawn) box(g, 0.042, 0.02, 0.055, M.dark, 0, -0.1, 0.1, 0.5);              // grip cap
      else { sling(g, -0.04, 0.26); box(g, 0.006, 0.05, 0.22, M.black, 0.0235, -0.002, 0.18, 0.12); }
      muzzleZ = -0.08 - blen; muzzleY = 0.045; sightY = 0.074; adsZ = sawn ? -0.32 : -0.3; left = [-0.02, -0.03, -0.18];
      break;
    }
    case 'flamer': {
      { const tk = magObj = part('tank', 0, -0.08, 0.02);                           // fuel tank (swapped on reload)
        pcyl(tk, 0.045, 0.24, M.redTank, 0, -0.08, 0.02, 14);
        for (const zz of [-0.1, 0.14]) pcyl(tk, 0.047, 0.012, M.steel, 0, -0.08, zz, 14);
        pbox(tk, 0.03, 0.03, 0.01, M.steel, 0.04, -0.06, 0.06); }
      box(g, 0.06, 0.07, 0.36, S, 0, 0.03, -0.1);
      cyl(g, 0.022, 0.3, M.dark, 0, 0.04, -0.42);                                   // fuel line / barrel
      for (let i = 0; i < 6; i++) cyl(g, 0.027, 0.01, M.black, 0, 0.04, -0.3 - i * 0.04);
      cyl(g, 0.03, 0.06, M.steel, 0, 0.04, -0.6, 12, 0.02);                         // nozzle
      box(g, 0.01, 0.01, 0.03, M.orange, 0, 0.012, -0.6);                           // pilot light
      cyl(g, 0.01, 0.2, M.black, 0.03, -0.03, -0.08);                               // hose
      triggerGroup(g, 0.04);
      box(g, 0.03, 0.08, 0.035, M.grip, 0, -0.03, -0.3);
      box(g, 0.05, 0.08, 0.18, S, 0, 0.01, 0.22); box(g, 0.052, 0.09, 0.02, M.grip, 0, 0.01, 0.32);
      box(g, 0.026, 0.012, 0.03, M.dark, 0, 0.071, 0.04); box(g, 0.01, 0.02, 0.012, M.dark, 0, 0.07, -0.5);
      // --- detail
      seams(g, 0.03, [0.0, 0.055], -0.27, 0.07);
      rivets(g, 0.03, 0.03, [-0.26, -0.2, 0.05]);
      box(g, 0.03, 0.022, 0.03, M.steel, 0.034, 0.05, -0.05);                       // pressure valve
      cyl(g, 0.012, 0.012, M.dark, 0.034, 0.075, -0.05);                            // valve knob
      box(g, 0.02, 0.02, 0.004, M.toyWhite, 0.031, 0.02, -0.15);                    // pressure gauge face
      box(g, 0.004, 0.006, 0.002, M.laser, 0.032, 0.022, -0.152);                   // gauge needle
      box(g, 0.012, 0.024, 0.012, M.dark, 0, 0.0, -0.58);                           // igniter housing
      cyl(g, 0.034, 0.012, M.dark, 0, 0.04, -0.57, 12);                             // nozzle guard
      box(g, 0.04, 0.012, 0.012, M.redTank, 0, 0.072, -0.2);                        // warning strip
      buttPad(g, 0.052, 0.09, 0.01, 0.32);
      sling(g, -0.03, 0.18);
      irons = { cy: 0.092, zr: 0.04, zf: -0.5 };
      muzzleZ = -0.64; muzzleY = 0.04; left = [0, -0.07, -0.3];
      break;
    }
    case 'dartsniper': {
      box(g, 0.07, 0.11, 0.5, M.toyBlue, 0, 0.03, -0.05);                           // chunky toy body
      box(g, 0.072, 0.03, 0.22, M.toyOrange, 0, 0.075, -0.15);
      box(g, 0.072, 0.02, 0.12, M.toyYellow, 0, -0.012, 0.06);
      box(g, 0.074, 0.06, 0.06, M.toyGray, 0, 0.02, 0.14);
      cyl(g, 0.03, 0.3, M.toyGray, 0, 0.04, -0.45, 14);                             // barrel extension
      cyl(g, 0.034, 0.04, M.toyOrange, 0, 0.04, -0.6, 14);
      { const bp = part('bolt', 0, 0.098, 0.12); pbox(bp, 0.032, 0.026, 0.08, M.toyOrange, 0, 0.098, 0.12); }   // priming handle
      box(g, 0.06, 0.12, 0.22, M.toyGray, 0, 0.01, 0.31); box(g, 0.064, 0.13, 0.03, M.toyOrange, 0, 0.01, 0.43);
      { const mp = magObj = part('mag', 0, -0.03, -0.1);                            // yellow dart clip
        pbox(mp, 0.06, 0.12, 0.05, M.toyYellow, 0, -0.08, -0.1);
        for (let i = 0; i < 3; i++) pbox(mp, 0.012, 0.012, 0.03, M.toyOrange, -0.015 + i * 0.015, -0.03, -0.1); }
      triggerGroup(g, 0.06, M.toyGray, 0.3, -0.02);
      for (const s of [-1, 1]) box(g, 0.012, 0.012, 0.2, M.toyOrange, s * 0.03, -0.03, -0.35);
      optic(0.135, -0.05, 0.1, -0.15, 0.05);
      muzzleZ = -0.62; muzzleY = 0.04; left = [-0.02, -0.05, -0.3];
      break;
    }
    case 'dartshotgun': {
      box(g, 0.07, 0.1, 0.36, M.toyBlue, 0, 0.02, -0.08);                           // toy body
      box(g, 0.072, 0.02, 0.3, M.toyWhite, 0, 0.055, -0.1);
      box(g, 0.074, 0.12, 0.1, M.toyOrange, 0, 0.03, -0.3);                         // 2 x 4 barrel block
      for (const x of [-0.016, 0.016]) for (const y of [0.075, 0.045, 0.015, -0.015]) cyl(g, 0.011, 0.012, M.black, x, y, -0.355, 10);
      { const pp = part('pump', 0, -0.03, -0.17); pbox(pp, 0.074, 0.045, 0.1, M.toyGray, 0, -0.035, -0.17); }
      box(g, 0.04, 0.11, 0.05, M.grip, 0, -0.05, 0.08, 0.4);
      box(g, 0.008, 0.006, 0.06, M.toyGray, 0, -0.035, 0.03);
      box(g, 0.026, 0.012, 0.03, M.toyGray, 0, 0.081, 0.05); box(g, 0.01, 0.02, 0.01, M.toyOrange, 0, 0.098, -0.3);
      irons = { cy: 0.1, zr: 0.05, zf: -0.3 };
      muzzleZ = -0.37; muzzleY = 0.03; left = [0, -0.05, -0.17];
      break;
    }

    case 'knife': {
      box(g, 0.006, 0.035, 0.2, M.steel, 0, 0.01, -0.13);
      for (let i = 0; i < 6; i++) box(g, 0.007, 0.006, 0.01, M.dark, 0, 0.03, -0.06 - i * 0.016); // serrated spine
      box(g, 0.0065, 0.006, 0.19, S, 0, -0.006, -0.12);                             // skin-coloured edge stripe
      box(g, 0.05, 0.02, 0.015, M.dark, 0, 0.0, -0.025);
      box(g, 0.028, 0.03, 0.11, M.grip, 0, -0.002, 0.04);
      box(g, 0.03, 0.032, 0.012, M.dark, 0, -0.002, 0.1);
      muzzleZ = -0.25; muzzleY = 0.01; sightY = 0.05; left = [0, -0.1, 0.1];
      break;
    }
  }
  // ------------------------------------------------------------- sights / optics
  let opticKind = 'none', scoped = false;
  const want = att.optic || att.defOptic || (spot ? 'reddot' : 'none');
  if (want === 'irons' || (irons && (want === 'none' || !spot))) {
    if (irons) { ironSights(g, irons.cy, irons.zr, irons.zf); sightY = irons.cy - 0.002; opticKind = 'irons'; }
    else if (spot) { // flip-up backup irons on the rail
      const cy = spot.railY + 0.026;
      for (const zz of [spot.rz1 - 0.02, spot.rz0 + 0.02]) box(g, 0.02, 0.016, 0.012, M.dark, 0, spot.railY + 0.012, zz);
      ironSights(g, cy, spot.rz1 - 0.02, spot.rz0 + 0.02); sightY = cy - 0.002; opticKind = 'irons';
    }
  } else if (spot && want !== 'none') {
    if (spot.side) { rail(g, spot.railY, spot.rz0, spot.rz1); box(g, 0.012, spot.railY - 0.05, 0.05, M.dark, 0.028, (spot.railY + 0.05) / 2, (spot.rz0 + spot.rz1) / 2); }
    const y = spot.y, z = spot.z;
    if (want === 'holo') redDot(g, y, z, { w: 0.05, h: 0.04, depth: 0.07, holo: true });
    else if (want === 'acog') prism(g, y, z, false);
    else if (want === 'toyscope') prism(g, y, z, true);
    else if (want === 'scope4') { scope(g, y, z, 0.26, 0.024); scoped = true; }
    else if (want === 'scope8') { scope(g, y, z, 0.36, 0.03); scoped = true; }
    else redDot(g, y, z, { w: 0.044, h: 0.034 });
    sightY = y; opticKind = want;
  }
  // ------------------------------------------------------------- barrel + muzzle devices
  let mz = muzzleZ;
  if (att.barrel === 'long') { cyl(g, 0.012, 0.1, M.dark, 0, muzzleY, mz - 0.05, 10); mz -= 0.1; }
  if (att.muzzle === 'suppressor') {
    cyl(g, 0.021, 0.18, M.black, 0, muzzleY, mz - 0.09, 14);
    for (const k of [0.01, 0.17]) cyl(g, 0.0225, 0.012, M.dark, 0, muzzleY, mz - k, 14);
    mz -= 0.18;
  } else if (att.muzzle === 'comp') {
    box(g, 0.034, 0.032, 0.05, M.dark, 0, muzzleY, mz - 0.025);
    for (let i = 0; i < 3; i++) box(g, 0.012, 0.034, 0.006, M.black, 0, muzzleY + 0.004, mz - 0.01 - i * 0.014);
    mz -= 0.05;
  } else if (att.muzzle === 'brake') { muzzleBrake(g, muzzleY, mz - 0.04, 0.021, 0.08); mz -= 0.08; }
  else if (att.muzzle === 'flash') {
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; box(g, 0.008, 0.008, 0.05, M.black, Math.cos(a) * 0.012, muzzleY + Math.sin(a) * 0.012, mz - 0.025); }
    mz -= 0.05;
  }
  muzzleZ = mz;
  // ------------------------------------------------------------- underbarrel
  if (under && att.under) {
    if (att.under === 'vgrip') { box(g, 0.028, 0.075, 0.032, M.grip, 0, under.y - 0.04, under.z); left = [0, under.y - 0.075, under.z]; }
    else if (att.under === 'agrip') { box(g, 0.03, 0.04, 0.07, M.grip, 0, under.y - 0.022, under.z + 0.02, 0.5); left = [-0.01, under.y - 0.05, under.z]; }
    else if (att.under === 'laser') { box(g, 0.022, 0.024, 0.06, M.dark, 0.032, under.y + 0.024, under.z - 0.03); box(g, 0.006, 0.006, 0.002, M.laser, 0.032, under.y + 0.024, under.z - 0.061); }
    else if (att.under === 'bipod') { box(g, 0.03, 0.014, 0.03, M.dark, 0, under.y - 0.01, under.z - 0.06); for (const s of [-1, 1]) box(g, 0.01, 0.01, 0.2, M.steel, s * 0.018, under.y - 0.018, under.z + 0.04); }
  }
  // ------------------------------------------------------------- magazine
  if (magObj && att.mag === 'ext') { magObj.scale.y *= 1.4; }
  // ------------------------------------------------------------- merge static parts, keep moving parts separate
  if (magObj && !Object.values(parts).includes(magObj)) parts.mag = magObj;
  for (const p of Object.values(parts)) p.traverse(o => { if (o.isMesh) keep.add(o); });
  mergeByMaterial(g, keep);
  for (const p of Object.values(parts)) { mergeByMaterial(p, new Set()); p.userData.base = { pos: p.position.clone(), rot: p.rotation.clone() }; }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, muzzleY, muzzleZ);
  g.add(muzzle);
  g.userData = { ...g.userData, muzzle, sightY, adsZ, left, skin: S, parts, optic: opticKind, scoped };
  return g;
}
// Weapon model for a weapon definition (applies its default sight unless an attachment overrides it).
export function buildWeapon(def, skinId, att = {}) { return buildGun(def.model, skinId, { defOptic: def.optic, ...att }); }

// See-through prism sight (2.5x) or a chunky toy scope: open tube with a reticle, so you aim through the model.
function prism(g, cy, z, toy) {
  const body = toy ? M.toyOrange : M.dark, w = toy ? 0.05 : 0.044, h = toy ? 0.044 : 0.04, len = toy ? 0.16 : 0.12, t = 0.006;
  box(g, w + 0.012, 0.012, len * 0.7, body, 0, cy - h / 2 - 0.01, z);                 // base
  box(g, t, h, len, body, -w / 2, cy, z); box(g, t, h, len, body, w / 2, cy, z);      // sides
  box(g, w + t, t, len, body, 0, cy + h / 2, z);                                     // top
  box(g, w + t, t * 1.5, len * 0.9, toy ? M.toyBlue : M.black, 0, cy - h / 2 + 0.002, z);
  if (!toy) { box(g, 0.012, 0.014, 0.016, M.dark, 0, cy + h / 2 + 0.008, z); box(g, 0.014, 0.012, 0.016, M.dark, w / 2 + 0.008, cy, z); }
  else for (const k of [-1, 1]) box(g, w + 0.016, h * 0.25, 0.012, M.toyYellow, 0, cy + h * 0.45, z + k * len * 0.45);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass); glass.position.set(0, cy, z - len / 2); g.add(glass);
  const ret = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.014), M.reticle); ret.position.set(0, cy, z - len / 2 - 0.001); g.add(ret);
}

// ---------------------------------------------------------------- custom reticles (style + colour, from Settings)
export const RETICLE_STYLES = ['dot', 'cross', 'circle', 'chevron', 'tdot'];
export const RETICLE_COLORS = { red: '#ff2a2a', green: '#39ff6a', cyan: '#2ee6ff', yellow: '#ffe14a', pink: '#ff4fd8', white: '#ffffff' };
export function setReticle(style = 'dot', color = 'red') {
  const c = reticleCanvas, x = c.getContext('2d'), s = c.width, m = s / 2, col = RETICLE_COLORS[color] || color;
  x.clearRect(0, 0, s, s);
  x.strokeStyle = x.fillStyle = col; x.lineWidth = s * 0.06; x.lineCap = 'round';
  x.shadowColor = col; x.shadowBlur = s * 0.08;
  const dot = (r) => { x.beginPath(); x.arc(m, m, r, 0, Math.PI * 2); x.fill(); };
  if (style === 'dot') dot(s * 0.09);
  else if (style === 'cross') { for (const [a, b, c2, d] of [[m, s * 0.15, m, s * 0.4], [m, s * 0.6, m, s * 0.85], [s * 0.15, m, s * 0.4, m], [s * 0.6, m, s * 0.85, m]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); } dot(s * 0.035); }
  else if (style === 'circle') { x.beginPath(); x.arc(m, m, s * 0.36, 0, Math.PI * 2); x.stroke(); dot(s * 0.05); }
  else if (style === 'chevron') { x.beginPath(); x.moveTo(s * 0.25, s * 0.7); x.lineTo(m, s * 0.42); x.lineTo(s * 0.75, s * 0.7); x.stroke(); }
  else if (style === 'tdot') { x.beginPath(); x.moveTo(s * 0.2, m); x.lineTo(s * 0.8, m); x.moveTo(m, m); x.lineTo(m, s * 0.85); x.stroke(); dot(s * 0.04); }
  reticleTex.needsUpdate = true;
}

// Combine all the little parts into one mesh per material (keeps draw calls low with many players)
function mergeByMaterial(g, keep) {
  const groups = new Map();
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const meshes = [];
  g.traverse(o => { if (o.isMesh && !keep.has(o)) meshes.push(o); });
  for (const m of meshes) {
    let geo = m.geometry.index ? m.geometry : m.geometry; // all primitives used here are indexed
    geo = geo.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    if (!groups.has(m.material)) groups.set(m.material, []);
    groups.get(m.material).push(geo);
    m.parent.remove(m);
  }
  for (const [mat, geos] of groups) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = !mat.transparent;
    g.add(mesh);
  }
  // drop empty helper groups left behind
  for (const c of [...g.children]) if (c.isGroup && c.children.length === 0) g.remove(c);
}

// First-person arms (sleeve + glove), positioned relative to the gun group.
// Woven fabric with folds and a seam, tinted per skin by the material colour (so one texture serves every skin).
const fabricTex = texCanvas(128, (x, s) => {
  x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < s; i += 2) { x.fillStyle = `rgba(0,0,0,${i % 4 ? 0.05 : 0.1})`; x.fillRect(i, 0, 1, s); x.fillRect(0, i, s, 1); } // weave
  for (let k = 0; k < 7; k++) { // soft creases running round the sleeve
    const y = Math.random() * s, g = x.createLinearGradient(0, y - 7, 0, y + 7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${0.12 + Math.random() * 0.12})`); g.addColorStop(0.62, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.translate(s / 2, y); x.rotate((Math.random() - 0.5) * 0.5); x.translate(-s / 2, -y); x.fillStyle = g; x.fillRect(-20, y - 7, s + 40, 14); x.restore();
  }
  x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(s * 0.72, 0, 2, s);                            // seam
  x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(s * 0.72 + 2, 0, 1, s);
  for (let y = 3; y < s; y += 6) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(s * 0.72 - 3, y, 2, 3); } // stitches
  speckle(x, s, 14);
});
// Synthetic glove: fine grain, palm padding.
const gloveTex = texCanvas(64, (x, s) => {
  x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`; x.fillRect(Math.random() * s, Math.random() * s, 2, 1); }
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1;
  for (let i = 8; i < s; i += 16) { x.beginPath(); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); }
  speckle(x, s, 10);
});

export function buildArms(skinId, gun) {
  const sk = charSkin(skinId);
  const shade = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
  // sleeves are toned down a little: viewmodel lights are strong and flat bright fabric looks plastic
  const sleeve = new THREE.MeshStandardMaterial({ map: fabricTex, color: shade(sk.body, 0.82), roughness: 0.95 });
  const sleeveDark = new THREE.MeshStandardMaterial({ map: fabricTex, color: shade(sk.body, 0.58), roughness: 0.95 });
  const cuff = new THREE.MeshStandardMaterial({ map: fabricTex, color: shade(sk.accent, 0.9), roughness: 0.85 });
  const glove = new THREE.MeshStandardMaterial({ map: gloveTex, color: '#3b3e43', roughness: 0.75 });
  const pad = new THREE.MeshStandardMaterial({ map: gripTex, color: '#8a8f96', roughness: 0.6, metalness: 0.1 }); // knuckle guard
  const strap = new THREE.MeshStandardMaterial({ color: '#17181b', roughness: 0.7 });
  const arms = new THREE.Group();

  // forearm: a tapered sleeve (two blocks), rolled cuff and glove wrist strap
  const forearm = (g, x, y, z, rx, ry, len) => {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.set(rx, ry, 0); g.add(f);
    box(f, 0.074, 0.072, len * 0.55, sleeve, 0, 0, len * 0.5 + len * 0.27);
    box(f, 0.068, 0.066, len * 0.5, sleeve, 0, 0, len * 0.25);
    box(f, 0.08, 0.078, 0.05, sleeveDark, 0, 0.001, 0.035);                                // rolled cuff
    box(f, 0.081, 0.012, 0.052, cuff, 0, 0.034, 0.035);
    box(f, 0.03, 0.006, 0.05, strap, 0.018, 0.038, len * 0.62);                             // velcro tab
    box(f, 0.062, 0.058, 0.03, glove, 0, 0, -0.004);                                        // glove wrist
    box(f, 0.066, 0.012, 0.026, strap, 0, 0.026, -0.004);
    return f;
  };
  // right hand on the grip
  const r = new THREE.Group();
  box(r, 0.056, 0.072, 0.085, glove, 0, -0.06, 0.042);                                      // palm
  box(r, 0.05, 0.016, 0.05, pad, 0.03, -0.045, 0.03, 0, 0, 0.3);                            // knuckle guard (back of hand)
  box(r, 0.018, 0.022, 0.056, glove, -0.026, -0.034, -0.002);                               // trigger finger
  box(r, 0.016, 0.018, 0.022, glove, -0.026, -0.034, -0.036, -0.5, 0, 0);                   // fingertip curl
  for (let k = 0; k < 3; k++) box(r, 0.05, 0.017, 0.022, glove, -0.008, -0.062 - k * 0.019, -0.006 + k * 0.002); // fingers round the grip
  box(r, 0.02, 0.02, 0.05, glove, -0.03, -0.05, 0.04, 0.4, 0, 0);                           // thumb
  forearm(r, 0.012, -0.11, 0.09, 0.95, 0.15, 0.4);
  arms.add(r);
  // left hand on the handguard
  const [lx, ly, lz] = gun.userData.left;
  const l = new THREE.Group();
  box(l, 0.06, 0.05, 0.085, glove, 0, -0.03, 0);                                            // palm
  box(l, 0.052, 0.014, 0.05, pad, -0.012, -0.004, 0.006);                                   // knuckle guard
  for (let k = 0; k < 4; k++) box(l, 0.02, 0.016, 0.017, glove, 0.036, -0.012, -0.034 + k * 0.021, 0, 0, -0.5); // fingers over the guard
  box(l, 0.02, 0.02, 0.066, glove, -0.032, -0.008, -0.012);                                 // thumb
  forearm(l, -0.02, -0.06, 0.04, 0.85, -0.45, 0.42);
  l.position.set(lx, ly, lz);
  arms.add(l);
  gun.userData.leftHand = l; gun.userData.leftBase = l.position.clone();
  return arms;
}

// Third-person soldier. Returns group with userData parts for animation.
export function buildSoldier(skinId) {
  const sk = charSkin(skinId);
  const body = new THREE.MeshStandardMaterial({ color: sk.body, roughness: 0.85 });
  const accent = new THREE.MeshStandardMaterial({ color: sk.accent, roughness: 0.7, metalness: 0.2 });
  const helmet = new THREE.MeshStandardMaterial({ color: sk.helmet, roughness: 0.5, metalness: 0.3 });
  const visor = sk.glow
    ? new THREE.MeshStandardMaterial({ color: sk.visor, emissive: new THREE.Color(sk.visor), emissiveIntensity: 2.2 })
    : new THREE.MeshStandardMaterial({ color: sk.visor, roughness: 0.1, metalness: 0.8 });
  const boot = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });

  const root = new THREE.Group();
  const lower = new THREE.Group(); root.add(lower);
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.11, 0.88, 0);
    box(leg, 0.17, 0.46, 0.2, body, 0, -0.23, 0);
    box(leg, 0.15, 0.42, 0.17, body, 0, -0.64, 0.01);
    box(leg, 0.17, 0.12, 0.27, boot, 0, -0.82, -0.04);
    box(leg, 0.18, 0.1, 0.06, accent, 0, -0.42, -0.1);                             // knee pad
    box(leg, 0.06, 0.12, 0.1, accent, sx * 0.09, -0.2, 0);                         // thigh pouch
    lower.add(leg); legs.push(leg);
  }
  const upper = new THREE.Group(); upper.position.y = 0.88; root.add(upper);
  box(upper, 0.44, 0.58, 0.25, body, 0, 0.32, 0);
  box(upper, 0.48, 0.4, 0.31, accent, 0, 0.36, 0);                                 // vest
  box(upper, 0.46, 0.08, 0.27, boot, 0, 0.04, 0);                                  // belt
  for (const x of [-0.13, 0, 0.13]) box(upper, 0.1, 0.11, 0.05, body, x, 0.3, -0.17); // mag pouches
  box(upper, 0.3, 0.3, 0.1, accent, 0, 0.36, 0.2);                                 // backpack
  const head = new THREE.Group(); head.position.y = 0.72; upper.add(head);
  box(head, 0.1, 0.08, 0.1, M.skinTone, 0, -0.02, 0);
  box(head, 0.23, 0.25, 0.25, accent, 0, 0.1, 0);
  box(head, 0.29, 0.14, 0.31, helmet, 0, 0.23, 0.01);
  box(head, 0.3, 0.03, 0.33, helmet, 0, 0.16, 0.0);
  box(head, 0.21, 0.07, 0.03, visor, 0, 0.12, -0.13);
  box(head, 0.04, 0.06, 0.04, boot, 0.15, 0.2, 0);                                 // headset
  const aim = new THREE.Group(); aim.position.set(0, 0.52, 0); upper.add(aim);
  const ra = new THREE.Group(); ra.position.set(0.27, 0, 0); aim.add(ra);
  box(ra, 0.12, 0.12, 0.36, body, -0.04, -0.12, -0.12, 0.5, 0.25);
  box(ra, 0.1, 0.1, 0.3, body, -0.12, -0.17, -0.38, 0, 0.35);
  const la = new THREE.Group(); la.position.set(-0.27, 0, 0); aim.add(la);
  box(la, 0.12, 0.12, 0.36, body, 0.04, -0.12, -0.12, 0.5, -0.35);
  box(la, 0.1, 0.1, 0.32, body, 0.18, -0.12, -0.4, 0, -0.6);
  const gunMount = new THREE.Group(); gunMount.position.set(0.1, -0.12, -0.42); aim.add(gunMount);

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  root.userData = { legs, upper, head, aim, gunMount, lower };
  return root;
}

export function buildRocket() {
  const g = new THREE.Group();
  cyl(g, 0.05, 0.4, M.olive, 0, 0, 0, 10);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 10), M.olive);
  tip.rotation.x = -Math.PI / 2; tip.position.z = -0.27; g.add(tip);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
  flame.position.z = 0.25; flame.scale.z = 2; g.add(flame);
  return g;
}

setReticle('dot', 'red');
