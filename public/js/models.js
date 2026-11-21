// Procedural 3D models: guns, soldiers, first-person arms.
// Style: chunky blocks, but with lots of small parts (rails, vents, ports, sights) so they read clearly.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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
  dotWhite: new THREE.MeshBasicMaterial({ color: '#f4f4f4' }),
  orange: new THREE.MeshBasicMaterial({ color: '#ff7a1a' }),
  red: new THREE.MeshBasicMaterial({ color: '#ff2a2a' }),           // red fibre-optic front sight (shotguns)
  skinTone: new THREE.MeshStandardMaterial({ color: '#c99a78', roughness: 0.8 }),
  // toy foam-dart blasters
  toyBlue: new THREE.MeshStandardMaterial({ color: '#2a5bd7', roughness: 0.45 }),
  toyOrange: new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.45 }),
  toyYellow: new THREE.MeshStandardMaterial({ color: '#ffd21f', roughness: 0.45 }),
  toyGray: new THREE.MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.5 }),
  toyWhite: new THREE.MeshStandardMaterial({ color: '#f2f4f7', roughness: 0.5 }),
  redTank: new THREE.MeshStandardMaterial({ color: '#b8261e', roughness: 0.35, metalness: 0.5 }),
  laser: new THREE.MeshBasicMaterial({ color: '#ff2020' }),
  plasma: new THREE.MeshBasicMaterial({ color: '#c04bff' }),        // Annihilator coils / energy cell
  plasmaCore: new THREE.MeshBasicMaterial({ color: '#f3d8ff' }),
  // real-world furniture / factory finishes so guns don't all look the same grey
  fde: new THREE.MeshStandardMaterial({ color: '#b39a6e', roughness: 0.62, metalness: 0.15 }),
  coyote: new THREE.MeshStandardMaterial({ color: '#7c6646', roughness: 0.66, metalness: 0.1 }),
  odGreen: new THREE.MeshStandardMaterial({ color: '#56623f', roughness: 0.6, metalness: 0.12 }),
  ranger: new THREE.MeshStandardMaterial({ color: '#3d4733', roughness: 0.66, metalness: 0.1 }),
  polyGG: new THREE.MeshStandardMaterial({ color: '#4a5048', roughness: 0.7, metalness: 0.08 }),
  wolf: new THREE.MeshStandardMaterial({ color: '#6c7074', roughness: 0.6, metalness: 0.2 }),
  polyBlack: new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.72, metalness: 0.08 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#d3d8de', roughness: 0.28, metalness: 0.55 }),
  blued: new THREE.MeshStandardMaterial({ color: '#34383e', roughness: 0.3, metalness: 0.75 }),
  smokeMag: new THREE.MeshStandardMaterial({ color: '#9aa29c', roughness: 0.25, metalness: 0.0, transparent: true, opacity: 0.72 }),
};
// factory ("Factory New" skin) finish per model; anything not listed keeps the default gunmetal skin
const FACTORY = {
  pistol: M.polyBlack, hawk: M.chrome, revolver: M.blued, mpistol: M.polyBlack,
  r4c: M.polyBlack, burst: M.polyBlack, ak12: M.polyBlack, galil: M.polyBlack,
  scarh: M.fde, aug: M.odGreen, g36: M.polyGG, famas: M.polyBlack, pdw: M.polyBlack,
  dmr: M.polyBlack, autoshotgun: M.polyBlack, tcsg: M.polyBlack, ksg: M.polyBlack, smg: M.wolf, spas12: M.polyBlack, benelli: M.polyBlack,
};
// reticle drawn into a small canvas so players can pick the style/colour (see setReticle)
const reticleCanvas = document.createElement('canvas'); reticleCanvas.width = reticleCanvas.height = 64;
const reticleTex = new THREE.CanvasTexture(reticleCanvas); reticleTex.colorSpace = THREE.SRGBColorSpace;
M.reticle = new THREE.MeshBasicMaterial({ map: reticleTex, transparent: true, depthWrite: false });

for (const m of Object.values(M)) m.userData.shared = true; // reused by every model: never disposed
const M_DARK = M.dark, M_GRIP = M.grip;

// While building a gun, boxes get softly rounded edges (no razor-sharp slabs). Soldiers/arms keep plain boxes.
let ROUND = false;
function boxGeo(w, h, d) {
  const m = Math.min(w, h, d);
  if (!ROUND || m < 0.009) return new THREE.BoxGeometry(w, h, d);
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(0.0055, m * 0.24));
}
function box(g, w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  g.add(m);
  return m;
}
// Side-profile solid: `pts` are [z, y] points in gun space (['q', cz, cy, z, y] = curve), extruded `t` wide around x,
// with bevelled edges. Lets stocks, grips, mags and receivers have real silhouettes instead of stacked boxes.
function shapeOf(pts) {
  const s = new THREE.Shape(); let first = true;
  for (const p of pts) {
    if (p[0] === 'q') s.quadraticCurveTo(p[1], p[2], p[3], p[4]);
    else if (first) { s.moveTo(p[0], p[1]); first = false; } else s.lineTo(p[0], p[1]);
  }
  return s;
}
function prof(g, pts, t, mat, x = 0, bevel = 0.0035, holes = []) {
  const s = shapeOf(pts);
  for (const h of holes) s.holes.push(new THREE.Path(shapeOf(h).getPoints(6)));
  const b = Math.min(bevel, t * 0.3), depth = Math.max(0.0005, t - 2 * b);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2, curveSegments: 8 });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(-Math.PI / 2);                                                         // shape x -> gun z, extrusion -> gun x
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 6);
  const m = new THREE.Mesh(geo, mat); m.position.x = x; m.castShadow = true; g.add(m);
  return m;
}
function cyl(g, r, len, mat, x, y, z, seg = 16, r2 = r) {
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
// Iron sights. The top of the front post sits at `cy`, so aiming lines the eye, the rear sight and the post tip up.
// style: aperture (round rear peep, hooded post) · ring (hooded front ring, drum rear peep) · notch (open tangent
// notch, eared post) · ghost (thick ghost ring, winged post) · bead (front bead on a rib) · pistol (three-dot) · toy
function torus(g, r, tube, mat, x, y, z, seg = 20) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
}
function ironSights(g, cy, zRear, zFront, dot = M.dotGreen, style = 'notch') {
  if (style !== 'bead') { box(g, 0.016, 0.026, 0.012, style === 'toy' ? M.toyYellow : M.dark, 0, cy - 0.03, zRear); box(g, 0.008, 0.022, 0.009, style === 'toy' ? M.toyOrange : M.dark, 0, cy - 0.026, zFront); }
  const post = (h = 0.012, w = 0.004) => { box(g, w, h, 0.005, M.dark, 0, cy - h / 2, zFront); box(g, 0.012, 0.007, 0.012, M.dark, 0, cy - h - 0.002, zFront); };
  // Sights are kept thin and open so they frame the target instead of blocking it; each style has its own bright
  // front marker so they're easy to pick up and don't all look alike.
  const fiber = (mat, s = 0.0032) => box(g, s, s, 0.002, mat, 0, cy - s * 0.6, zFront - 0.004); // glowing front insert
  if (style === 'aperture') {                       // thin rear peep + plain post with a green tritium dot
    post(0.011, 0.0032);
    torus(g, 0.0125, 0.0013, M.dark, 0, cy, zRear);                                           // wide thin rear ring
    box(g, 0.022, 0.006, 0.012, M.dark, 0, cy - 0.0165, zRear);                               // rear sight base (below the ring)
    box(g, 0.003, 0.004, 0.006, M.dark, 0, cy - 0.0125, zRear);                               // ring stem
    fiber(dot);
  } else if (style === 'ring') {                    // PPSh/MP5: round front hood around an orange post, thin rear peep
    post(0.0105, 0.003);
    torus(g, 0.0118, 0.0011, M.dark, 0, cy - 0.001, zFront - 0.002);                          // thin round front hood
    box(g, 0.004, 0.008, 0.005, M.dark, 0, cy - 0.0155, zFront - 0.002);                      // hood stem
    torus(g, 0.0105, 0.0014, M.dark, 0, cy, zRear);                                           // thin rear peep
    box(g, 0.02, 0.006, 0.012, M.dark, 0, cy - 0.0145, zRear); box(g, 0.003, 0.004, 0.006, M.dark, 0, cy - 0.011, zRear);
    fiber(M.orange, 0.0034);
  } else if (style === 'ghost') {                   // shotguns: big thin ghost ring + post with a red fibre
    post(0.012, 0.0038);
    torus(g, 0.0145, 0.0018, M.dark, 0, cy, zRear);
    box(g, 0.026, 0.006, 0.012, M.dark, 0, cy - 0.019, zRear); box(g, 0.003, 0.004, 0.006, M.dark, 0, cy - 0.015, zRear);
    fiber(M.red || M.orange, 0.0038);
  } else if (style === 'bead') {                    // brass bead on the rib, shallow rear groove
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 10, 8), M.brass || M.steel); b.position.set(0, cy - 0.003, zFront); g.add(b);
    box(g, 0.012, 0.003, 0.01, M.dark, 0, cy - 0.0085, zRear);
  } else if (style === 'toy') {
    torus(g, 0.012, 0.004, M.toyOrange, 0, cy, zRear);
    box(g, 0.03, 0.012, 0.014, M.toyYellow, 0, cy - 0.017, zRear);
    box(g, 0.006, 0.016, 0.008, M.toyOrange, 0, cy - 0.008, zFront);
    box(g, 0.0035, 0.0035, 0.001, M.toyYellow, 0, cy - 0.003, zFront - 0.0045);
  } else if (style === 'pistol') {                  // three-dot: two white rear dots either side of a wide notch, green front
    for (const s of [-1, 1]) { box(g, 0.006, 0.009, 0.008, M.dark, s * 0.0095, cy - 0.003, zRear); box(g, 0.0028, 0.0028, 0.001, M.dotWhite || dot, s * 0.0095, cy - 0.003, zRear - 0.0045); }
    box(g, 0.026, 0.005, 0.01, M.dark, 0, cy - 0.0095, zRear);
    post(0.011, 0.0042);
    fiber(dot, 0.0034);
  } else { // notch (AK family): low open V-notch leaf, slim front post with a white dot (no ears in the way)
    for (const s of [-1, 1]) { box(g, 0.009, 0.007, 0.006, M.dark, s * 0.0085, cy - 0.005, zRear); box(g, 0.005, 0.003, 0.006, M.dark, s * 0.0038, cy - 0.0085, zRear, 0, 0, s * 0.8); }
    box(g, 0.028, 0.004, 0.026, M.dark, 0, cy - 0.0105, zRear + 0.012);                       // tangent leaf base
    post(0.012, 0.0032);
    fiber(M.dotWhite || dot, 0.003);
  }
}
// Pistol grip: one moulded piece with finger grooves, palm swell and a flared base, rising into the frame at `topY`.
// `z` = front edge where it meets the frame, `rake` = how far the bottom sits behind the top.
function grip(g, z, topY, mat = M.grip, rake = 0.035, h = 0.1, t = 0.033, back = 0.068) {
  const b = topY - h, f = y => z + rake * (topY - y) / h;
  prof(g, [
    [z - 0.004, topY + 0.012], [f(topY - 0.014), topY - 0.014],
    [f(topY - 0.03) - 0.004, topY - 0.03], [f(topY - 0.046), topY - 0.046],          // finger grooves
    [f(topY - 0.062) - 0.004, topY - 0.062], [f(topY - 0.078), topY - 0.078],
    [f(b + 0.01) - 0.004, b + 0.01], [f(b) - 0.006, b - 0.003],                       // flared base
    [f(b) + 0.05, b - 0.003], [f(b) + 0.047, b + 0.01],
    ['q', z + 0.046 + rake * 0.35, topY - 0.035, Math.min(z + 0.054, z + back - 0.006), topY - 0.004],   // palm swell
    [z + back, topY + 0.004], [z + back, topY + 0.012],                               // beavertail
  ], t, mat, 0, 0.005);
  prof(g, [[f(b) - 0.007, b + 0.004], [f(b) + 0.051, b + 0.004], [f(b) + 0.051, b - 0.006], [f(b) - 0.007, b - 0.006]], t + 0.003, M.black, 0, 0.002);   // base cap
}
// Trigger guard loop (one piece with a hole) + curved trigger blade, trigger at `zt`.
function guard(g, zt, topY, mat = M.dark) {
  const z0 = zt - 0.034, z1 = zt + 0.044, y0 = topY - 0.038, y1 = topY + 0.006;
  prof(g, [[z0, y1], [z0, y0 + 0.012], ['q', z0, y0, z0 + 0.014, y0], [z1, y0], [z1, y1]], 0.009, mat, 0, 0.0025,
    [[[z0 + 0.007, topY - 0.001], [z1 - 0.005, topY - 0.001], [z1 - 0.005, y0 + 0.006], [z0 + 0.016, y0 + 0.006], ['q', z0 + 0.007, y0 + 0.006, z0 + 0.007, y0 + 0.016]]]);
  prof(g, [[zt - 0.003, topY + 0.002], ['q', zt - 0.012, topY - 0.012, zt - 0.003, topY - 0.026], [zt + 0.002, topY - 0.024], ['q', zt - 0.005, topY - 0.012, zt + 0.004, topY + 0.002]], 0.005, M.steel, 0, 0.001);
}
// Grip + trigger guard hanging from the underside of the frame at height `topY` (so it always connects)
function triggerGroup(g, z, gripMat = M.grip, gripAngle = 0.3, topY = -0.02) {
  guard(g, z - 0.014, topY);
  grip(g, z + 0.026, topY, gripMat, Math.tan(gripAngle) * 0.1);
}
// Magazine as a moving group (origin at the top, where it seats). `curve` bends the bottom forward (AK-style).
function mag(g, z, len, angle = -0.2, w = 0.032, d = 0.058, mat = M.dark, topY = -0.015, curve = 0) {
  const grp = new THREE.Group(); grp.position.set(0, topY + 0.01, z); grp.rotation.x = angle; g.add(grp);
  const c = curve, h = d / 2;
  prof(grp, [[-h, 0.014], [h, 0.014], [h, -0.01], ['q', h - c * 0.15, -len * 0.6, h - c, -len], [-h - c, -len], ['q', -h - c * 0.15, -len * 0.6, -h, -0.01]], w, mat, 0, 0.003);
  prof(grp, [[-h - c - 0.005, -len + 0.005], [h - c + 0.005, -len + 0.005], [h - c + 0.004, -len - 0.011], [-h - c - 0.004, -len - 0.011]], w + 0.006, M.black, 0, 0.0025);   // floor plate
  for (let k = 0.22; k < 0.9; k += 0.2) box(grp, w + 0.002, 0.004, d * 0.62, M.black, 0, -len * k, -c * k * k);                         // ribs
  return grp;
}
// Fixed stock as one shaped piece: front (z0) to butt (z1), top/bottom heights at each end, with a rubber pad.
function solidStock(g, z0, z1, top0, top1, bot0, bot1, mat, w = 0.044, pad = true) {
  prof(g, [[z0, top0], [z1 - 0.012, top1], ['q', z1, top1, z1, top1 - 0.012], [z1, bot1 + 0.012], ['q', z1, bot1, z1 - 0.014, bot1], [z0, bot0]], w, mat, 0, 0.006);
  if (pad) buttPad(g, w - 0.006, top1 - bot1 - 0.006, (top1 + bot1) / 2, z1 + 0.007);
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
  // one moulded frame with a cut-out (top bar, sloped lower bar, rear post), not separate floating bars
  const zl = z1 - 0.022, yl = z => yTop - 0.034 + (yBot - 0.007 - yTop + 0.034) * (z - z0) / (zl - z0);
  const za = z0 + 0.03, zb = z1 - 0.02;
  prof(g, [[z0, yTop + 0.008], [z1, yTop + 0.008], [z1, yBot - 0.007], [zl, yBot - 0.007], [z0, yTop - 0.034]], w, mat, 0, 0.004,
    [[[za, yTop - 0.008], [zb, yTop - 0.008], [zb, yl(zb) + 0.016], [za, yl(za) + 0.014]]]);
  buttPad(g, w + 0.02, yTop - yBot + 0.026, (yTop + yBot) / 2, z1 + 0.009);
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
  ROUND = true;
  try { return buildGunInner(model, S, att, g); } finally { ROUND = false; M.dark = M_DARK; M.grip = M_GRIP; }
}
function buildGunInner(model, S, att, g) {
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
      // striker pistol: square slide with a bevelled nose, polymer frame with an accessory rail, textured grip
      prof(g, [[0.034, 0.016], [0.034, 0.057], [-0.148, 0.057], ['q', -0.158, 0.057, -0.158, 0.047], [-0.158, 0.016]], 0.038, S, 0, 0.005);   // slide
      for (let i = 0; i < 6; i++) box(g, 0.0395, 0.028, 0.0025, M.black, 0, 0.038, 0.004 + i * 0.0055);   // rear serrations
      box(g, 0.003, 0.016, 0.042, M.black, 0.0195, 0.044, -0.045);                  // ejection port
      box(g, 0.022, 0.004, 0.036, M.steel, 0, 0.0575, -0.045);                      // barrel hood
      prof(g, [[0.04, 0.02], [0.04, 0.004], [0.022, -0.002], [-0.1, -0.004], [-0.146, -0.002], ['q', -0.154, -0.002, -0.154, 0.008], [-0.154, 0.02]], 0.034, M.polyBlack, 0, 0.004);   // frame
      for (let z = -0.14; z < -0.1; z += 0.01) box(g, 0.036, 0.003, 0.004, M.black, 0, -0.004, z);   // rail slots
      cyl(g, 0.0065, 0.004, M.black, 0, 0.036, -0.1585);                            // bore
      box(g, 0.004, 0.008, 0.012, M.dark, 0.018, 0.009, -0.03);                     // slide stop
      guard(g, -0.044, 0.002); grip(g, -0.004, 0.002, M.grip, 0.026, 0.1, 0.033, 0.046);
      ironSights(g, 0.068, 0.02, -0.145);
      muzzleZ = -0.17; muzzleY = 0.036; sightY = 0.066; left = [-0.01, -0.07, 0.0];
      break;
    }
    case 'mpistol': {
      // select-fire machine pistol: long slide, grey frame with fold-down foregrip, compensator, 33-round mag, wire stock
      prof(g, [[0.05, 0.012], [0.05, 0.057], [-0.16, 0.057], ['q', -0.17, 0.057, -0.17, 0.047], [-0.17, 0.012]], 0.044, S, 0, 0.005);   // slide
      box(g, 0.003, 0.018, 0.05, M.black, 0.0225, 0.04, -0.04);
      for (let i = 0; i < 5; i++) box(g, 0.0455, 0.032, 0.003, M.black, 0, 0.034, 0.012 + i * 0.007);
      prof(g, [[0.055, 0.016], [0.055, -0.004], [0.03, -0.012], [-0.15, -0.014], ['q', -0.165, -0.014, -0.165, 0.0], [-0.165, 0.016]], 0.038, M.wolf, 0, 0.004);   // frame
      triggerGroup(g, -0.03, M.wolf, 0.18, -0.008);
      magObj = mag(g, 0.012, 0.22, 0.18, 0.026, 0.036, M.dark, -0.012);             // long 33-round mag
      box(g, 0.03, 0.012, 0.03, M.wolf, 0, -0.018, -0.13);                          // foregrip hinge
      prof(g, [[-0.118, -0.02], [-0.142, -0.02], [-0.146, -0.07], ['q', -0.146, -0.08, -0.136, -0.08], [-0.12, -0.078]], 0.026, M.grip, 0, 0.004);   // fold-down foregrip
      box(g, 0.03, 0.02, 0.02, M.wolf, 0, 0.0, 0.06);                               // stock hinge block
      for (const s of [-1, 1]) box(g, 0.005, 0.005, 0.18, M.steel, s * 0.014, 0.0, 0.15);   // folding wire stock
      box(g, 0.034, 0.05, 0.008, M.steel, 0, -0.018, 0.24); box(g, 0.036, 0.052, 0.012, M.grip, 0, -0.018, 0.247);
      for (const s of [-1, 1]) box(g, 0.005, 0.03, 0.005, M.steel, s * 0.014, -0.012, 0.237);
      cyl(g, 0.011, 0.04, M.dark, 0, 0.032, -0.19);
      muzzleBrake(g, 0.032, -0.222, 0.013, 0.034);
      ironSights(g, 0.068, 0.025, -0.155);
      muzzleZ = -0.25; muzzleY = 0.032; sightY = 0.066; left = [-0.01, -0.07, -0.13];
      break;
    }
    case 'revolver': {
      // heavy .44 revolver: full-lug barrel with vent rib, fluted cylinder, frame with top strap, curved wood grip
      prof(g, [[-0.055, 0.034], [-0.055, 0.068], [-0.262, 0.068], [-0.262, 0.034], [-0.25, 0.026], [-0.07, 0.026]], 0.024, S, 0, 0.004);   // barrel + full underlug
      box(g, 0.012, 0.008, 0.21, M.dark, 0, 0.072, -0.158);                         // vent rib
      for (let z = -0.24; z < -0.07; z += 0.02) box(g, 0.0125, 0.004, 0.006, M.black, 0, 0.075, z);
      cyl(g, 0.0095, 0.004, M.black, 0, 0.05, -0.2625);                             // bore
      { const cy = cyl(g, 0.034, 0.06, M.steel, 0, 0.04, -0.025, 16);              // cylinder
        cy.updateMatrix(); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; box(g, 0.007, 0.007, 0.048, M.dark, Math.cos(a) * 0.033, 0.04 + Math.sin(a) * 0.033, -0.025); }   // flutes
      prof(g, [[0.004, 0.083], [-0.06, 0.083], [-0.06, 0.074], [0.0, 0.074], [0.0, 0.008], [-0.06, 0.008], [-0.06, 0.0], [0.03, -0.004], [0.06, 0.012], [0.068, 0.05], ['q', 0.064, 0.083, 0.04, 0.083]], 0.034, S, 0, 0.004);   // frame with top strap
      box(g, 0.012, 0.018, 0.02, M.dark, 0, 0.078, 0.058, -0.5);                    // hammer spur
      guard(g, -0.034, 0.004);
      prof(g, [[0.03, 0.006], [0.018, -0.03], ['q', 0.012, -0.075, 0.026, -0.098], [0.062, -0.1], ['q', 0.078, -0.06, 0.066, 0.012]], 0.036, M.wood, 0, 0.006);   // wood grip
      box(g, 0.038, 0.004, 0.004, M.steel, 0, -0.04, 0.042);                        // grip screw
      // slim notch sight on the top strap + thin front blade
      box(g, 0.004, 0.008, 0.006, M.dark, -0.006, 0.087, -0.03);
      box(g, 0.004, 0.008, 0.006, M.dark, 0.006, 0.087, -0.03);
      box(g, 0.016, 0.004, 0.008, M.dark, 0, 0.085, -0.03);
      box(g, 0.004, 0.014, 0.01, M.dark, 0, 0.083, -0.25);
      box(g, 0.0025, 0.0025, 0.001, M.dot, 0, 0.0895, -0.2552);
      muzzleZ = -0.27; muzzleY = 0.05; sightY = 0.09; adsZ = -0.42; left = [-0.01, -0.07, 0.04];
      break;
    }
    case 'smg': {
      // Vector-style: tall upper, lower that drops forward-down into the mag well, square shroud, side-folding stock
      prof(g, [[0.09, 0.066], [0.09, -0.008], [0.03, -0.012], [-0.08, -0.012], [-0.17, -0.05], [-0.205, -0.05], ['q', -0.215, -0.05, -0.214, -0.035], [-0.205, 0.0], [-0.205, 0.066]], 0.05, S, 0, 0.005);   // body
      prof(g, [[-0.06, 0.034], [-0.15, 0.034], [-0.15, 0.022], [-0.06, 0.022]], 0.0515, M.black, 0, 0.002);   // side panel line
      box(g, 0.003, 0.016, 0.05, M.black, 0.026, 0.045, -0.02);                     // port
      selector(g, 0.026, 0.012, 0.03);
      box(g, 0.04, 0.04, 0.1, M.dark, 0, 0.035, -0.25);                             // shroud
      vents(g, 0.035, -0.29, -0.21, 0.021, 4);
      cyl(g, 0.012, 0.04, M.dark, 0, 0.035, -0.32);
      muzzleBrake(g, 0.035, -0.355, 0.014, 0.04);
      triggerGroup(g, 0.0, M.grip, 0.25, -0.01);
      magObj = mag(g, -0.155, 0.17, 0.05, 0.03, 0.038, M.dark, -0.04);              // mag seats in the dropped front
      rail(g, 0.07, -0.205, 0.08, 0.024);
      box(g, 0.03, 0.04, 0.03, M.dark, 0, 0.03, 0.1);                               // stock hinge
      prof(g, [[0.1, 0.05], [0.25, 0.05], [0.25, -0.02], [0.23, -0.02], [0.13, 0.02], [0.1, 0.02]], 0.02, M.dark, 0, 0.003);   // folding stock arm
      buttPad(g, 0.04, 0.074, 0.015, 0.26);
      optic(0.104, -0.04, 0.074, -0.205, 0.08); under = { y: 0.012, z: -0.25 };
      muzzleZ = -0.375; muzzleY = 0.035; sightY = 0.104; left = [-0.02, -0.07, -0.16];
      break;
    }
    case 'rifle':
    case 'r4c':
    case 'burst': {
      const burst = model === 'burst', r4 = model === 'r4c';
      // upper receiver (flat top) + lower receiver with integral mag well, guard and buffer housing
      prof(g, [[0.09, 0.02], [0.09, 0.064], ['q', 0.09, 0.07, 0.084, 0.07], [-0.25, 0.07], [-0.25, 0.02]], 0.05, S, 0, 0.004);
      prof(g, [[0.1, 0.022], [0.1, 0.0], [0.07, -0.016], [-0.06, -0.016], [-0.072, -0.04], [-0.158, -0.04], [-0.166, -0.02], [-0.18, 0.0], [-0.19, 0.022]], 0.046, S, 0, 0.004);
      box(g, 0.003, 0.02, 0.07, M.black, 0.0255, 0.045, -0.06);                     // ejection port
      box(g, 0.003, 0.012, 0.03, M.steel, 0.0265, 0.045, -0.05);                    // bolt carrier in the port
      cyl(g, 0.008, 0.016, M.dark, 0.03, 0.05, 0.03, 10).rotation.set(0, 0, Math.PI / 2);   // forward assist
      box(g, 0.03, 0.01, 0.03, M.dark, 0, 0.072, 0.08);                             // charging handle
      box(g, 0.008, 0.012, 0.018, M.steel, 0.024, -0.03, -0.075);                   // mag release
      selector(g, 0.024, 0.005, 0.04);
      seams(g, 0.024, [0.021], -0.18, 0.09);
      if (burst) {
        // M4/M16A2 look: round ribbed handguard, delta ring, carry handle with the rear sight, A2 front sight tower, fixed stock
        cyl(g, 0.031, 0.27, M.black, 0, 0.035, -0.385, 16);                         // round handguard
        for (let i = 0; i < 10; i++) cyl(g, 0.0325, 0.009, M.polyBlack, 0, 0.035, -0.265 - i * 0.026, 16);   // ribs
        cyl(g, 0.036, 0.024, M.dark, 0, 0.035, -0.25, 16);                          // delta ring
        cyl(g, 0.033, 0.016, M.dark, 0, 0.035, -0.522, 16);                         // handguard cap
        prof(g, [[-0.188, 0.068], [-0.172, 0.126], [0.03, 0.126], [0.03, 0.137], [0.066, 0.137], [0.072, 0.126], [0.072, 0.068], [0.044, 0.068], [0.04, 0.106], [-0.148, 0.106], [-0.158, 0.068]], 0.024, S, 0, 0.003);   // carry handle (one piece, open underneath)
        box(g, 0.006, 0.012, 0.012, M.steel, 0.016, 0.132, 0.045);                  // windage knob
        // A2 triangular front sight tower on the gas block
        prof(g, [[-0.53, 0.03], [-0.58, 0.03], [-0.562, 0.128], [-0.548, 0.128]], 0.012, M.dark, 0, 0.002, [[[-0.541, 0.05], [-0.569, 0.05], [-0.559, 0.104], [-0.551, 0.104]]]);
        box(g, 0.026, 0.024, 0.034, M.dark, 0, 0.042, -0.555);                      // sight base / gas block
        magObj = mag(g, -0.115, 0.16, 0.04, 0.032, 0.058, M.dark, -0.03, 0.02);
        prof(g, [[0.09, 0.07], [0.342, 0.06], [0.342, -0.04], [0.31, -0.04], [0.16, 0.0], [0.09, 0.0]], 0.044, M.polyBlack, 0, 0.006);   // fixed A2 stock
        box(g, 0.0455, 0.004, 0.2, M.black, 0, 0.034, 0.22);                        // stock seam
        box(g, 0.003, 0.03, 0.04, M.dark, 0.0225, 0.01, 0.3);                       // trapdoor
        sling(g, -0.04, 0.3);
      } else if (r4) {
        // modern carbine: long free-float M-LOK handguard, coyote furniture, crane stock, flash hider
        prof(g, [[-0.25, 0.068], [-0.65, 0.068], ['q', -0.66, 0.068, -0.66, 0.058], [-0.66, 0.02], ['q', -0.66, 0.012, -0.65, 0.012], [-0.25, 0.012]], 0.056, M.coyote, 0, 0.007);   // handguard
        for (const s of [-1, 1]) for (let zz = -0.62; zz < -0.27; zz += 0.05) box(g, 0.003, 0.012, 0.032, M.black, s * 0.0285, 0.04, zz);   // M-LOK slots
        for (let zz = -0.62; zz < -0.27; zz += 0.05) box(g, 0.014, 0.003, 0.032, M.black, 0, 0.0105, zz);
        prof(g, [[-0.57, 0.014], [-0.6, 0.014], [-0.594, -0.012], [-0.578, -0.012]], 0.028, M.black, 0, 0.003);   // hand stop
        box(g, 0.06, 0.012, 0.03, M.dark, 0, 0.04, -0.25);                          // barrel nut ring
        magObj = mag(g, -0.115, 0.16, 0.04, 0.032, 0.058, M.coyote, -0.03, 0.02);
        cyl(g, 0.016, 0.16, M.dark, 0, 0.035, 0.17);                                // buffer tube
        prof(g, [[0.2, 0.072], [0.345, 0.074], [0.345, -0.036], [0.312, -0.036], ['q', 0.27, -0.02, 0.245, 0.006], [0.2, 0.012]], 0.044, M.coyote, 0, 0.006,
          [[[0.255, 0.03], [0.31, 0.03], [0.31, -0.016], [0.29, -0.016]]]);          // crane stock with cut-out
        for (const s of [-1, 1]) box(g, 0.003, 0.012, 0.02, M.steel, s * 0.0225, 0.05, 0.215);   // QD sockets
        box(g, 0.012, 0.022, 0.02, M.steel, 0, -0.0, 0.205);                        // adjustment latch
        for (let z = 0.105; z < 0.2; z += 0.014) box(g, 0.035, 0.004, 0.006, M.black, 0, 0.05, z);   // buffer tube positions
      } else {
        // AR-7 Falcon: classic carbine, ventilated quad-rail handguard, collapsible M4 stock
        prof(g, [[-0.25, 0.069], [-0.53, 0.069], [-0.53, 0.011], [-0.25, 0.011]], 0.058, M.dark, 0, 0.006);   // handguard
        vents(g, 0.04, -0.5, -0.28, 0.03, 5);
        box(g, 0.02, 0.012, 0.25, M.dark, 0, 0.006, -0.39);                         // bottom rail
        for (let z = -0.51; z < -0.27; z += 0.014) box(g, 0.026, 0.005, 0.007, M.black, 0, 0.0, z);
        magObj = mag(g, -0.115, 0.16, 0.04, 0.032, 0.058, M.dark, -0.03, 0.02);
        cyl(g, 0.016, 0.16, M.dark, 0, 0.035, 0.17);                                // buffer tube
        prof(g, [[0.2, 0.064], [0.345, 0.07], [0.345, -0.034], [0.31, -0.034], [0.24, 0.0], [0.2, 0.008]], 0.042, S, 0, 0.006);   // M4 stock
        box(g, 0.0435, 0.003, 0.1, M.black, 0, 0.04, 0.29);                         // stock seam
        box(g, 0.012, 0.022, 0.02, M.steel, 0, -0.002, 0.205);                      // adjustment latch
        sling(g, -0.03, 0.33);
      }
      buttPad(g, 0.042, 0.096, 0.016, 0.352);
      cyl(g, 0.011, 0.24, M.dark, 0, 0.04, -0.62);                                  // barrel
      if (!burst) box(g, 0.022, 0.024, 0.02, M.dark, 0, 0.03, -0.55);              // gas block
      if (r4) {                                                                     // 4-prong flash hider
        cyl(g, 0.013, 0.02, M.dark, 0, 0.04, -0.73);
        for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; box(g, 0.007, 0.007, 0.045, M.black, Math.cos(a) * 0.01, 0.04 + Math.sin(a) * 0.01, -0.76); }
      } else muzzleBrake(g, 0.04, -0.75, 0.016, 0.06);
      triggerGroup(g, 0.0, r4 ? M.coyote : M.grip, 0.3, -0.014);
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
      prof(g, [[0.075, 0.068], [0.075, -0.004], [0.05, -0.012], [-0.23, -0.012], [-0.23, 0.05], ['q', -0.23, 0.068, -0.21, 0.068]], 0.055, S, 0, 0.006);   // receiver
      box(g, 0.003, 0.025, 0.08, M.black, 0.028, 0.035, -0.06);                     // loading port
      for (let i = 0; i < 4; i++) cyl(g, 0.009, 0.03, M.shell, 0.033, 0.0 + i * 0.0, -0.12 + i * 0.022, 8); // side saddle shells
      for (let i = 0; i < 4; i++) cyl(g, 0.0095, 0.006, M.brass, 0.033, 0.0, -0.1 + i * 0.022, 8);
      cyl(g, 0.018, 0.52, M.dark, 0, 0.045, -0.5);                                  // barrel
      box(g, 0.01, 0.006, 0.5, M.dark, 0, 0.066, -0.5);                             // vent rib
      cyl(g, 0.015, 0.44, M.black, 0, 0.008, -0.45);                                // mag tube
      { const pp = part('pump', 0, 0.005, -0.43);
        pbox(pp, 0.064, 0.05, 0.16, M.grip, 0, 0.005, -0.43);                       // pump
        for (let i = 0; i < 5; i++) pbox(pp, 0.066, 0.052, 0.006, M.black, 0, 0.005, -0.49 + i * 0.03); }
      triggerGroup(g, 0.0, M.grip, 0.35, -0.01);
      solidStock(g, 0.07, 0.33, 0.062, 0.05, -0.006, -0.07, S, 0.048);             // stock with a dropped comb
      sling(g, -0.05, 0.27);
      // ghost-ring rear + bead front
      box(g, 0.005, 0.03, 0.01, M.dark, -0.015, 0.075, 0.03); box(g, 0.005, 0.03, 0.01, M.dark, 0.015, 0.075, 0.03);
      box(g, 0.035, 0.005, 0.01, M.dark, 0, 0.091, 0.03); box(g, 0.035, 0.008, 0.012, M.dark, 0, 0.06, 0.03);
      box(g, 0.006, 0.01, 0.006, M.dark, 0, 0.071, -0.75); box(g, 0.004, 0.004, 0.001, M.orange, 0, 0.074, -0.754);
      muzzleZ = -0.77; muzzleY = 0.045; sightY = 0.075; left = [-0.02, -0.04, -0.43];
      break;
    }
    case 'dmr': {
      prof(g, [[0.1, 0.02], [0.1, 0.07], [-0.26, 0.07], [-0.26, 0.02]], 0.052, S, 0, 0.004);   // upper
      prof(g, [[0.1, 0.022], [0.1, 0.0], [0.07, -0.016], [-0.05, -0.016], [-0.062, -0.034], [-0.15, -0.034], [-0.165, -0.014], [-0.18, 0.0], [-0.19, 0.022]], 0.048, S, 0, 0.004);   // lower + mag well
      box(g, 0.003, 0.02, 0.07, M.black, 0.0265, 0.045, -0.06);
      selector(g, 0.025, 0.005, 0.04);
      // SR-25 marksman: long ranger-green free-float handguard, fluted heavy barrel, folded bipod, adjustable precision stock
      prof(g, [[-0.26, 0.07], [-0.6, 0.07], ['q', -0.61, 0.07, -0.61, 0.06], [-0.61, 0.02], ['q', -0.61, 0.01, -0.6, 0.01], [-0.26, 0.01]], 0.06, M.ranger, 0, 0.007);   // free-float handguard
      vents(g, 0.04, -0.58, -0.28, 0.031, 5);
      cyl(g, 0.014, 0.22, M.dark, 0, 0.04, -0.7);                                   // heavy barrel
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; box(g, 0.004, 0.004, 0.18, M.black, Math.cos(a) * 0.0135, 0.04 + Math.sin(a) * 0.0135, -0.7); }   // flutes
      muzzleBrake(g, 0.04, -0.83, 0.017, 0.06);
      box(g, 0.026, 0.02, 0.026, M.dark, 0, 0.0, -0.56);                            // bipod yoke
      for (const s of [-1, 1]) { box(g, 0.01, 0.01, 0.24, M.steel, s * 0.018, -0.006, -0.43, 0.03); box(g, 0.016, 0.012, 0.024, M.black, s * 0.018, -0.012, -0.31); }
      magObj = mag(g, -0.105, 0.12, 0.04, 0.034, 0.07, M.dark, -0.024, 0.012);
      triggerGroup(g, 0.0, M.ranger, 0.3, -0.014);
      cyl(g, 0.017, 0.14, M.dark, 0, 0.035, 0.15);                                  // buffer tube
      prof(g, [[0.14, 0.064], [0.36, 0.064], [0.36, -0.06], [0.33, -0.06], [0.3, -0.03], [0.25, -0.03], [0.22, 0.0], [0.14, 0.004]], 0.05, M.ranger, 0, 0.006,
        [[[0.18, 0.046], [0.32, 0.046], [0.32, 0.012], [0.2, 0.012]]]);             // precision stock with a cut-out
      prof(g, [[0.2, 0.068], [0.35, 0.068], [0.35, 0.09], ['q', 0.34, 0.096, 0.32, 0.096], [0.22, 0.092], [0.2, 0.08]], 0.042, M.ranger, 0, 0.006);   // adjustable cheek riser
      for (const zz of [0.23, 0.33]) box(g, 0.006, 0.01, 0.006, M.steel, 0.022, 0.07, zz);   // riser locks
      buttPad(g, 0.048, 0.118, 0.002, 0.367);
      rail(g, 0.074, -0.56, 0.1);
      optic(0.115, -0.08, 0.078, -0.56, 0.1); under = { y: 0.01, z: -0.45 };
      muzzleZ = -0.87; muzzleY = 0.04; sightY = 0.115; left = [-0.02, -0.03, -0.45];
      break;
    }
    case 'sniper': {
      prof(g, [[0.19, 0.065], [-0.27, 0.065], ['q', -0.29, 0.065, -0.29, 0.045], [-0.29, 0.0], [-0.24, -0.015], [0.02, -0.015], [0.06, -0.022], [0.19, -0.015]], 0.06, S, 0, 0.007);   // chassis
      cyl(g, 0.024, 0.2, M.dark, 0, 0.045, 0.02);                                  // round action
      for (const s2 of [-1, 1]) for (let zz = -0.24; zz < -0.06; zz += 0.045) box(g, 0.003, 0.022, 0.03, M.black, s2 * 0.0305, 0.02, zz);   // lightening cuts
      cyl(g, 0.017, 0.62, M.dark, 0, 0.04, -0.6);                                   // barrel
      for (let i = 0; i < 6; i++) box(g, 0.006, 0.036, 0.04, M.black, 0, 0.04, -0.42 - i * 0.06); // fluting look
      box(g, 0.05, 0.04, 0.12, M.dark, 0, 0.04, -0.94);                             // big brake
      box(g, 0.052, 0.012, 0.012, M.black, 0, 0.04, -0.93); box(g, 0.052, 0.012, 0.012, M.black, 0, 0.04, -0.96);
      { const bp = part('bolt', 0.03, 0.05, 0.08);                                   // bolt handle (cycles after each shot)
        pcyl(bp, 0.007, 0.05, M.steel, 0.04, 0.05, 0.08); pbox(bp, 0.016, 0.016, 0.016, M.steel, 0.065, 0.05, 0.08); }
      magObj = mag(g, -0.07, 0.09, 0, 0.036, 0.08, M.dark, -0.02);
      triggerGroup(g, 0.06, M.grip, 0.3, -0.018);
      prof(g, [[0.18, 0.065], [0.53, 0.07], [0.53, -0.08], [0.48, -0.08], [0.4, -0.035], [0.25, -0.03], [0.18, -0.015]], 0.056, S, 0, 0.007,
        [[[0.28, 0.045], [0.42, 0.048], [0.42, -0.008], [0.3, -0.006]]]);         // thumbhole stock
      prof(g, [[0.3, 0.07], [0.5, 0.072], [0.5, 0.094], ['q', 0.49, 0.1, 0.47, 0.1], [0.33, 0.096], [0.3, 0.084]], 0.044, M.dark, 0, 0.006);   // cheek riser
      buttPad(g, 0.05, 0.146, -0.005, 0.537);
      box(g, 0.02, 0.03, 0.03, M.dark, 0, -0.094, 0.48);                            // monopod
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
      triggerGroup(g, 0.04, M.grip, 0.3, -0.018);
      // --- stock: tapered, with cheek rest, butt plate, sling swivel and shoulder strap loop
      solidStock(g, 0.14, 0.41, 0.065, 0.055, -0.012, -0.065, S, 0.054);           // long tapered stock
      box(g, 0.056, 0.012, 0.16, M.dark, 0, 0.058, 0.31);                           // cheek rest
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
      // big-bore Desert-Eagle-style hand cannon: tall slab slide, long barrel block with a raised sight rib, squared guard
      prof(g, [[0.072, 0.012], [0.072, 0.058], ['q', 0.072, 0.068, 0.062, 0.068], [-0.232, 0.068], ['q', -0.242, 0.068, -0.242, 0.058], [-0.242, 0.02], [-0.225, 0.012]], 0.05, S, 0, 0.006);   // slide + barrel block
      box(g, 0.026, 0.008, 0.27, S, 0, 0.072, -0.095);                              // raised sight rib
      box(g, 0.01, 0.0025, 0.27, M.black, 0, 0.0765, -0.095);                       // rib groove
      for (const s of [-1, 1]) prof(g, [[-0.07, 0.054], [-0.238, 0.054], [-0.238, 0.046], [-0.07, 0.046]], 0.002, M.black, s * 0.0255, 0);   // long side flute
      for (let i = 0; i < 7; i++) box(g, 0.0505, 0.032, 0.0025, M.black, 0, 0.038, 0.022 + i * 0.006);   // serrations
      box(g, 0.003, 0.022, 0.05, M.black, 0.0255, 0.045, -0.02);                    // ejection port
      box(g, 0.006, 0.014, 0.022, M.steel, 0.026, 0.03, 0.03);                      // slide-mounted safety
      prof(g, [[0.075, 0.016], [0.075, -0.004], [0.04, -0.012], [-0.12, -0.012], [-0.15, -0.006], [-0.15, 0.016]], 0.046, S, 0, 0.005);   // frame
      cyl(g, 0.012, 0.004, M.black, 0, 0.042, -0.2425);                             // bore
      box(g, 0.012, 0.022, 0.016, S, 0, 0.066, 0.078, -0.5);                        // hammer
      guard(g, -0.044, -0.006);
      prof(g, [[-0.078, -0.01], [-0.078, -0.044], [-0.07, -0.05], [-0.064, -0.044], [-0.064, -0.01]], 0.01, S, 0, 0.002);   // squared guard front
      grip(g, -0.004, -0.006, M.grip, 0.024, 0.105, 0.036);
      ironSights(g, 0.086, 0.032, -0.225, M.dot);
      muzzleZ = -0.25; muzzleY = 0.042; sightY = 0.084; left = [-0.01, -0.07, 0.0];
      break;
    }
    case 'pdw': {
      // compact PDW (MP7-like): tall receiver, magazine inside the pistol grip, folding foregrip, sliding rod stock
      prof(g, [[0.085, 0.072], [0.085, 0.0], [-0.12, -0.004], [-0.2, -0.004], ['q', -0.222, -0.004, -0.222, 0.018], [-0.222, 0.072]], 0.05, S, 0, 0.006);   // receiver
      prof(g, [[0.04, 0.008], [0.04, -0.014], [-0.15, -0.016], ['q', -0.19, -0.016, -0.19, 0.004], [-0.19, 0.008]], 0.052, M.polyBlack, 0, 0.004);   // lower shell
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) box(g, 0.003, 0.03, 0.016, M.black, s * 0.0255, 0.035, -0.19 + i * 0.026);   // front grip slots
      box(g, 0.003, 0.018, 0.05, M.black, 0.0255, 0.05, -0.02);                     // ejection port
      selector(g, 0.026, 0.012, 0.03);
      box(g, 0.03, 0.012, 0.018, M.steel, 0, 0.076, 0.075);                         // T charging handle
      cyl(g, 0.011, 0.07, M.dark, 0, 0.04, -0.255);                                 // short barrel
      cyl(g, 0.013, 0.02, M.dark, 0, 0.04, -0.29);
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; box(g, 0.006, 0.006, 0.04, M.black, Math.cos(a) * 0.009, 0.04 + Math.sin(a) * 0.009, -0.315); }   // flash hider
      triggerGroup(g, -0.04, M.polyBlack, 0.12, -0.012);                            // grip (holds the mag)
      magObj = mag(g, 0.012, 0.2, 0.12, 0.028, 0.038, M.dark, -0.016);              // 40-round mag out the bottom of the grip
      box(g, 0.024, 0.016, 0.03, M.dark, 0, -0.022, -0.17);                         // foregrip hinge
      prof(g, [[-0.156, -0.026], [-0.184, -0.026], [-0.188, -0.09], ['q', -0.188, -0.1, -0.176, -0.1], [-0.16, -0.098]], 0.026, M.polyBlack, 0, 0.004);   // folding vertical foregrip
      ribs(g, 0.026, 0.06, -0.06, -0.186, -0.158, 0.009);
      box(g, 0.05, 0.03, 0.02, M.polyBlack, 0, 0.03, 0.09);                         // stock rod housing
      for (const s of [-1, 1]) box(g, 0.006, 0.006, 0.19, M.steel, s * 0.018, 0.03, 0.18);   // sliding stock rods
      prof(g, [[0.265, 0.062], [0.285, 0.062], [0.285, -0.016], [0.265, -0.016]], 0.048, M.polyBlack, 0, 0.005); buttPad(g, 0.044, 0.074, 0.023, 0.29);   // butt plate
      rail(g, 0.077, -0.22, 0.08, 0.026);                                           // full-length top rail
      optic(0.116, -0.07, 0.081, -0.22, 0.08);
      irons = { cy: 0.104, zr: 0.06, zf: -0.2 };
      muzzleZ = -0.34; muzzleY = 0.04; sightY = 0.116; left = [0, -0.09, -0.17];
      break;
    }
    case 'autoshotgun': {
      // AA-12-style: long boxy receiver, full-length carry handle carrying the optic rail, drum mag, in-line stock
      prof(g, [[0.09, 0.07], [0.09, -0.02], [0.06, -0.022], [-0.24, -0.022], [-0.24, 0.07]], 0.062, S, 0, 0.007);   // receiver
      for (const s of [-1, 1]) for (let zz = -0.2; zz < 0.06; zz += 0.05) box(g, 0.003, 0.05, 0.03, M.black, s * 0.0315, 0.025, zz);   // pressed side panels
      box(g, 0.003, 0.03, 0.08, M.black, 0.0315, 0.04, -0.05);
      prof(g, [[-0.24, 0.062], [-0.46, 0.062], ['q', -0.47, 0.062, -0.47, 0.052], [-0.47, 0.004], ['q', -0.47, -0.006, -0.46, -0.006], [-0.24, -0.006]], 0.066, M.dark, 0, 0.007);   // handguard
      vents(g, 0.03, -0.45, -0.26, 0.034, 4);
      cyl(g, 0.02, 0.2, M.dark, 0, 0.04, -0.57);                                    // barrel
      muzzleBrake(g, 0.04, -0.67, 0.024, 0.06);
      { const dm = magObj = part('mag', 0, -0.07, -0.1);
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 24), M.dark);
        drum.rotation.z = Math.PI / 2; drum.castShadow = true; dm.add(drum);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.064, 16), M.steel);
        cap.rotation.z = Math.PI / 2; dm.add(cap);
        pbox(dm, 0.04, 0.04, 0.05, M.dark, 0, -0.03, -0.1); }                       // drum neck into the receiver
      triggerGroup(g, 0.05, M.grip, 0.3, -0.02);
      solidStock(g, 0.085, 0.33, 0.07, 0.06, -0.02, -0.05, S, 0.06);               // boxy in-line stock
      for (const s of [-1, 1]) for (let zz = 0.13; zz < 0.3; zz += 0.04) box(g, 0.003, 0.05, 0.02, M.black, s * 0.031, 0.01, zz);   // stock ribs
      prof(g, [[-0.39, 0.068], [-0.37, 0.134], [0.07, 0.134], [0.09, 0.068], [0.06, 0.068], [0.05, 0.112], [-0.34, 0.112], [-0.355, 0.068]], 0.03, M.dark, 0, 0.004);   // carry handle
      rail(g, 0.138, -0.32, 0.04, 0.026);
      optic(0.172, -0.12, 0.142, -0.32, 0.04); under = { y: -0.006, z: -0.36 };
      muzzleZ = -0.71; muzzleY = 0.04; sightY = 0.108; left = [-0.02, -0.03, -0.35];
      break;
    }
    // =================================================================== new guns
    case 'ak': case 'ak12': case 'galil': {
      const k12 = model === 'ak12', gal = model === 'galil', fur = k12 ? M.polyBlack : gal ? M.odGreen : M.wood;
      prof(g, [[0.1, 0.066], [0.1, 0.005], [-0.062, 0.005], [-0.068, -0.006], [-0.137, -0.006], [-0.143, 0.005], [-0.22, 0.005], [-0.22, 0.066]], 0.05, S, 0, 0.004);   // receiver with mag well
      prof(g, [[0.106, 0.062], [0.106, 0.067], ['q', 0.102, 0.078, 0.086, 0.078], [-0.212, 0.078], [-0.212, 0.062]], 0.052, M.dark, 0, 0.004);   // dust cover (rounded rear)
      for (let i = 0; i < 5; i++) box(g, 0.053, 0.003, 0.006, M.black, 0, 0.0755, -0.17 + i * 0.05);
      box(g, 0.003, 0.02, 0.07, M.black, 0.026, 0.045, -0.04);                      // ejection port
      box(g, 0.004, 0.03, 0.09, M.dark, 0.027, 0.02, 0.0);                          // selector lever
      { const bp = part('bolt', 0.035, 0.05, -0.03); pbox(bp, 0.02, 0.012, 0.02, M.steel, 0.035, 0.05, -0.03); }
      prof(g, [[-0.214, 0.036], [-0.446, 0.036], ['q', -0.454, 0.036, -0.452, 0.024], [-0.446, -0.006], ['q', -0.44, -0.016, -0.42, -0.016], [-0.36, -0.02], [-0.29, -0.02], [-0.232, -0.014], [-0.214, -0.004]], 0.058, fur, 0, 0.007);   // lower handguard
      box(g, 0.04, 0.03, 0.2, k12 ? M.dark : fur, 0, 0.058, -0.32);                 // upper handguard (gas tube cover)
      if (k12 || gal) for (let zz = -0.42; zz < -0.24; zz += 0.016) box(g, 0.062, 0.006, 0.007, M.black, 0, 0.012, zz);
      cyl(g, 0.009, 0.36, M.dark, 0, 0.03, -0.42);                                  // barrel
      cyl(g, 0.008, 0.16, M.dark, 0, 0.058, -0.5);                                  // gas tube
      box(g, 0.02, 0.03, 0.02, M.dark, 0, 0.045, -0.53);                            // gas block
      box(g, 0.026, 0.024, 0.02, M.dark, 0, 0.05, -0.6); box(g, 0.01, 0.025, 0.012, M.dark, 0, 0.07, -0.6); // front sight base
      box(g, 0.03, 0.012, 0.04, M.dark, 0, 0.077, -0.2);                            // rear sight block
      if (k12) muzzleBrake(g, 0.03, -0.66, 0.016, 0.06); else cyl(g, 0.012, 0.05, M.dark, 0, 0.03, -0.645);
      magObj = mag(g, -0.102, 0.17, 0.12, 0.03, 0.06, gal ? M.black : k12 ? M.dark : S, -0.016, 0.065);   // curved 30-round mag
      triggerGroup(g, 0.0, k12 || gal ? M.grip : M.wood, 0.3, 0.002);
      if (k12) {                                                                    // AK-12 telescoping/folding polymer stock
        cyl(g, 0.015, 0.12, M.dark, 0, 0.035, 0.15);
        prof(g, [[0.17, 0.074], [0.34, 0.074], [0.34, -0.044], [0.31, -0.044], ['q', 0.26, -0.03, 0.22, 0.008], [0.17, 0.012]], 0.044, M.polyBlack, 0, 0.006, [[[0.235, 0.05], [0.3, 0.05], [0.3, -0.022], [0.282, -0.022]]]);
      }
      else if (gal) {
        // side-folding tubular stock with an OD cheek piece, folded bipod, hooded front sight, upturned charging handle, top rail
        prof(g, [[0.1, 0.054], [0.33, 0.054], [0.33, -0.034], [0.3, -0.034], [0.12, -0.03], [0.1, -0.006]], 0.02, M.dark, 0, 0.004, [[[0.13, 0.036], [0.3, 0.036], [0.3, -0.016], [0.13, -0.014]]]);   // tubular skeleton stock
        prof(g, [[0.19, 0.05], [0.32, 0.05], [0.32, 0.074], ['q', 0.31, 0.08, 0.295, 0.08], [0.21, 0.076], [0.19, 0.066]], 0.032, M.odGreen, 0, 0.005);   // cheek piece
        prof(g, [[0.32, 0.06], [0.345, 0.06], [0.345, -0.044], [0.32, -0.044]], 0.044, M.odGreen, 0, 0.006);   // butt
        box(g, 0.03, 0.03, 0.03, M.dark, 0, 0.012, -0.47);                          // bipod yoke
        for (const s of [-1, 1]) { box(g, 0.009, 0.009, 0.2, M.steel, s * 0.016, -0.012, -0.35, 0.05); box(g, 0.014, 0.01, 0.02, M.black, s * 0.016, -0.018, -0.25); }
        for (const s of [-1, 1]) box(g, 0.005, 0.034, 0.016, M.dark, s * 0.012, 0.078, -0.6);   // front sight hood ears
        box(g, 0.006, 0.03, 0.014, M.steel, 0.035, 0.068, -0.03, 0, 0, -0.35);      // upturned charging handle
        rail(g, 0.079, -0.42, -0.24, 0.024);                                        // handguard top rail
      }
      else {                                                                        // classic AK wooden stock (dropped, tapering)
        prof(g, [[0.098, 0.062], [0.13, 0.058], [0.37, 0.036], [0.372, -0.07], ['q', 0.36, -0.078, 0.345, -0.076], [0.14, -0.008], [0.098, 0.004]], 0.044, M.wood, 0, 0.007);
        prof(g, [[0.37, 0.038], [0.382, 0.038], [0.382, -0.074], [0.37, -0.074]], 0.046, M.dark, 0, 0.003);   // steel butt plate
      }
      if (k12) buttPad(g, 0.04, 0.112, 0.015, 0.348);
      // --- detail
      rivets(g, 0.025, 0.02, [-0.19, -0.165, 0.05, 0.075]);                         // trunnion + rear rivets
      seams(g, 0.025, [0.052], -0.21, 0.09);
      box(g, 0.054, 0.006, 0.012, M.steel, 0, 0.0, -0.075);                         // mag release paddle
      box(g, 0.02, 0.012, 0.02, M.steel, 0, 0.077, 0.095);                          // dust cover latch / recoil spring tab
      box(g, 0.006, 0.014, 0.02, M.steel, 0.024, 0.04, -0.22);                      // handguard retaining lever
      cyl(g, 0.0032, 0.2, M.steel, 0, 0.011, -0.53, 6);                             // cleaning rod
      box(g, 0.014, 0.012, 0.016, M.dark, 0, 0.012, -0.62);                         // bayonet lug
      for (let zz = -0.4; zz < -0.25; zz += 0.035) box(g, 0.042, 0.004, 0.006, M.black, 0, 0.074, zz); // upper handguard vents

      if (!k12 && !gal) sling(g, -0.05, 0.3);
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
      // PPSh-41: rounded stamped receiver, round perforated barrel jacket ending in a slanted brake, wood stock, drum
      prof(g, [[0.06, 0.012], [0.06, 0.056], ['q', 0.06, 0.068, 0.045, 0.068], [-0.14, 0.068], ['q', -0.152, 0.068, -0.152, 0.056], [-0.152, 0.012]], 0.05, S, 0, 0.008);   // receiver with a rounded top
      cyl(g, 0.025, 0.27, M.dark, 0, 0.042, -0.285, 20);                            // round barrel jacket
      cyl(g, 0.0285, 0.016, M.dark, 0, 0.042, -0.156, 20);                          // jacket collar
      cyl(g, 0.0275, 0.008, M.dark, 0, 0.042, -0.417, 20);                          // front band
      for (let i = 0; i < 5; i++) for (const a of [0.45, 1.15, 1.95, 2.7, -0.45, -1.15, -1.95, -2.7]) {   // oval cooling holes all round the jacket
        const z = -0.19 - i * 0.045 - (Math.abs(a) > 1 && Math.abs(a) < 2.2 ? 0.022 : 0);
        if (z < -0.405) continue;
        box(g, 0.009, 0.004, 0.02, M.black, Math.cos(a) * 0.0245, 0.042 + Math.sin(a) * 0.0245, z, 0, 0, a - Math.PI / 2);
      }
      prof(g, [[-0.42, 0.068], [-0.466, 0.068], [-0.44, 0.015], [-0.42, 0.015]], 0.054, M.dark, 0, 0.005);   // slanted muzzle brake
      box(g, 0.02, 0.008, 0.012, M.black, 0, 0.069, -0.448);                        // brake top port
      cyl(g, 0.0085, 0.004, M.black, 0, 0.042, -0.4535);                            // bore
      // one-piece wooden stock: forend under the receiver, wrist, dropped butt
      prof(g, [[-0.13, 0.03], [0.06, 0.03], [0.1, 0.026], [0.33, 0.004], [0.332, -0.09], ['q', 0.32, -0.098, 0.305, -0.096], [0.12, -0.03], [0.08, -0.034], [0.02, -0.03], [-0.13, -0.026]], 0.05, M.wood, 0, 0.007);
      prof(g, [[0.33, 0.006], [0.342, 0.006], [0.342, -0.094], [0.33, -0.094]], 0.052, M.dark, 0, 0.003);   // steel butt plate
      guard(g, 0.03, -0.028);
      { const dm = magObj = part('mag', 0, -0.075, -0.09);                         // 71-round drum
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.05, 24), M.dark); drum.rotation.z = Math.PI / 2; drum.castShadow = true; dm.add(drum);
        for (const s of [-1, 1]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.004, 6, 24), M.dark); rim.rotation.y = Math.PI / 2; rim.position.x = s * 0.026; dm.add(rim); }
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.056, 16), M.steel); cap.rotation.z = Math.PI / 2; dm.add(cap);
        pbox(dm, 0.03, 0.04, 0.04, M.dark, 0, -0.025, -0.09); }
      { const bp = part('bolt', 0.03, 0.05, 0.02); pbox(bp, 0.016, 0.012, 0.016, M.steel, 0.03, 0.05, 0.02); }
      box(g, 0.022, 0.012, 0.03, M.dark, 0, 0.072, 0.0);                            // rear sight block
      box(g, 0.016, 0.016, 0.016, M.dark, 0, 0.074, -0.43);                         // front sight base on the brake
      // --- detail
      seams(g, 0.025, [0.06], -0.15, 0.05);
      box(g, 0.003, 0.016, 0.05, M.black, 0.026, 0.05, -0.04);                      // ejection port
      box(g, 0.012, 0.012, 0.006, M.steel, 0, 0.069, 0.04);                         // receiver latch
      box(g, 0.054, 0.012, 0.03, M.dark, 0, 0.018, -0.13);                          // mag catch
      box(g, 0.0505, 0.004, 0.19, M.black, 0, 0.03, -0.03);                         // forend/receiver seam
      sling(g, -0.05, 0.25); sling(g, 0.012, -0.12, -0.026);
      irons = { cy: 0.092, zr: 0.0, zf: -0.43 };
      optic(0.115, -0.08, 0.078, -0.16, 0.02); spot.side = true;
      under = { y: 0.014, z: -0.3 };
      muzzleZ = -0.46; muzzleY = 0.042; left = [-0.02, -0.04, -0.18];
      break;
    }
    case 'tommy': {
      box(g, 0.05, 0.06, 0.24, S, 0, 0.035, -0.05);                                 // receiver
      box(g, 0.052, 0.012, 0.1, M.steel, 0, 0.07, -0.02);
      { const bp = part('bolt', 0, 0.08, 0.02); pbox(bp, 0.016, 0.016, 0.016, M.steel, 0, 0.08, 0.02); }
      cyl(g, 0.014, 0.3, M.dark, 0, 0.04, -0.32);                                   // finned barrel
      for (let i = 0; i < 9; i++) cyl(g, 0.022, 0.007, M.dark, 0, 0.04, -0.2 - i * 0.026);
      box(g, 0.036, 0.036, 0.05, M.dark, 0, 0.045, -0.5);                           // compensator
      cyl(g, 0.016, 0.03, M.dark, 0, 0.026, -0.26);                                 // foregrip mount
      prof(g, [[-0.242, 0.016], [-0.282, 0.016], [-0.29, -0.024], [-0.282, -0.03], [-0.292, -0.05], ['q', -0.296, -0.074, -0.272, -0.078], [-0.248, -0.072], [-0.24, -0.04], [-0.246, -0.03], [-0.238, -0.01]], 0.036, M.wood, 0, 0.006);   // wooden vertical foregrip with finger grooves
      triggerGroup(g, 0.02, M.wood, 0.3, 0.004);
      prof(g, [[0.07, 0.064], [0.11, 0.06], [0.35, 0.036], [0.352, -0.064], ['q', 0.34, -0.072, 0.325, -0.07], [0.13, -0.002], [0.07, 0.006]], 0.045, M.wood, 0, 0.007);   // wooden butt stock
      prof(g, [[0.35, 0.038], [0.36, 0.038], [0.36, -0.068], [0.35, -0.068]], 0.047, M.dark, 0, 0.003);
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
      sling(g, -0.03, 0.3);
      irons = { cy: 0.094, zr: 0.04, zf: -0.47 };
      optic(0.12, -0.05, 0.081, -0.15, 0.06); spot.side = true;
      muzzleZ = -0.53; muzzleY = 0.045; left = [0, -0.07, -0.26];
      break;
    }
    case 'mp5': {
      // MP5: stamped receiver that runs forward over the barrel to the front sight hood, cocking tube housing on top,
      // polymer trigger pack, slim handguard, curved mag, fixed polymer stock
      prof(g, [[0.09, 0.066], [0.09, 0.005], [-0.19, 0.005], [-0.2, 0.026], [-0.37, 0.026], ['q', -0.382, 0.026, -0.382, 0.04], [-0.382, 0.056], ['q', -0.382, 0.068, -0.37, 0.068], [0.07, 0.068]], 0.046, S, 0, 0.006);
      prof(g, [[0.09, 0.014], [0.09, -0.012], [0.07, -0.018], [-0.04, -0.018], [-0.05, 0.014]], 0.05, M.polyBlack, 0, 0.004);   // polymer trigger housing
      prof(g, [[-0.195, 0.03], [-0.345, 0.03], ['q', -0.356, 0.03, -0.356, 0.02], [-0.352, -0.004], ['q', -0.348, -0.014, -0.336, -0.014], [-0.21, -0.012], [-0.195, -0.002]], 0.056, M.polyBlack, 0, 0.008);   // slim handguard
      for (let zz = -0.33; zz < -0.21; zz += 0.024) box(g, 0.058, 0.005, 0.008, M.black, 0, 0.008, zz);
      cyl(g, 0.011, 0.05, M.dark, 0, 0.04, -0.405); cyl(g, 0.0145, 0.026, M.dark, 0, 0.04, -0.42);   // barrel + three-lug nut
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; box(g, 0.006, 0.006, 0.02, M.dark, Math.cos(a) * 0.015, 0.04 + Math.sin(a) * 0.015, -0.42); }
      cyl(g, 0.0075, 0.004, M.black, 0, 0.04, -0.4345);
      { const bp = part('bolt', -0.03, 0.054, -0.25); pbox(bp, 0.022, 0.012, 0.012, M.steel, -0.034, 0.054, -0.25); pbox(bp, 0.012, 0.012, 0.014, M.polyBlack, -0.046, 0.054, -0.25); }   // cocking handle
      box(g, 0.003, 0.008, 0.15, M.black, -0.024, 0.054, -0.23);                    // cocking slot
      magObj = mag(g, -0.1, 0.15, 0.06, 0.028, 0.04, M.dark, -0.004, 0.035);        // curved 30-round mag
      triggerGroup(g, 0.04, M.polyBlack, 0.3, -0.008);
      solidStock(g, 0.09, 0.32, 0.062, 0.052, -0.004, -0.052, M.polyBlack, 0.044);   // fixed stock
      box(g, 0.046, 0.003, 0.18, M.black, 0, 0.03, 0.2);                            // stock seam
      box(g, 0.022, 0.02, 0.018, M.dark, 0, 0.074, -0.36);                          // front sight base
      // --- detail
      seams(g, 0.023, [0.012, 0.058], -0.2, 0.08);
      ejectPort(g, 0.023, 0.045, -0.06, 0.05);
      selector(g, 0.025, 0.004, 0.06);
      rivets(g, 0.023, 0.035, [-0.19, -0.3, 0.07]);
      box(g, 0.05, 0.016, 0.05, M.dark, 0, 0.0, -0.1);                              // mag well
      box(g, 0.006, 0.006, 0.012, M.steel, 0.026, 0.0, -0.07);                      // mag release
      box(g, 0.012, 0.02, 0.02, M.dark, 0, 0.004, 0.09);                            // stock pin block
      sling(g, 0.0, 0.1, -0.026);
      irons = { cy: 0.098, zr: 0.065, zf: -0.36 };
      optic(0.122, -0.1, 0.088, -0.2, 0.02); spot.side = true;
      under = { y: -0.012, z: -0.27 };
      muzzleZ = -0.436; muzzleY = 0.04; left = [-0.02, -0.03, -0.27];
      break;
    }
    case 'bizon': {
      // PP-19 Bizon: AK-style receiver + dust cover, front trunnion carrying the barrel, long helical mag under it
      // that doubles as the forend, side-folding skeleton stock
      box(g, 0.048, 0.06, 0.33, S, 0, 0.04, -0.065);                                // receiver (-0.23 .. 0.1)
      prof(g, [[0.1, 0.066], [0.1, 0.078], ['q', 0.094, 0.086, 0.07, 0.086], [-0.2, 0.086], [-0.215, 0.066]], 0.05, M.dark, 0, 0.004);   // dust cover
      box(g, 0.05, 0.052, 0.07, M.dark, 0, 0.043, -0.262);                          // front trunnion (-0.297 .. -0.227)
      cyl(g, 0.011, 0.08, M.dark, 0, 0.046, -0.335);                                // barrel out of the trunnion
      cyl(g, 0.015, 0.03, M.dark, 0, 0.046, -0.37); cyl(g, 0.0085, 0.004, M.black, 0, 0.046, -0.3855);   // muzzle nut + bore
      box(g, 0.022, 0.03, 0.018, M.dark, 0, 0.08, -0.275);                          // front sight base
      { const mp = magObj = part('mag', 0, -0.012, -0.2);                          // helical 64-round mag
        pcyl(mp, 0.034, 0.3, M.dark, 0, -0.012, -0.2, 18);
        for (let i = 0; i < 7; i++) pcyl(mp, 0.0355, 0.006, M.black, 0, -0.012, -0.335 + i * 0.045, 18);
        pcyl(mp, 0.0365, 0.018, M.polyBlack, 0, -0.012, -0.352, 18);
        pbox(mp, 0.02, 0.012, 0.26, M.polyBlack, 0, -0.048, -0.2); }               // grip ridge along the bottom
      { const bp = part('bolt', 0.03, 0.05, -0.04); pbox(bp, 0.018, 0.012, 0.016, M.steel, 0.032, 0.05, -0.04); }
      triggerGroup(g, 0.045, M.grip, 0.25, 0.01);
      skeletonStock(g, 0.06, -0.01, 0.1, 0.3, M.dark, 0.018);
      box(g, 0.026, 0.012, 0.03, M.dark, 0, 0.09, 0.0);                             // rear sight block
      // --- detail
      seams(g, 0.024, [0.015, 0.062], -0.22, 0.09);
      ejectPort(g, 0.024, 0.05, -0.02, 0.05);
      selector(g, 0.024, 0.024, 0.04);
      rivets(g, 0.024, 0.03, [-0.21, -0.18, 0.06]);
      for (let i = 0; i < 5; i++) box(g, 0.052, 0.003, 0.006, M.black, 0, 0.083, -0.16 + i * 0.05);   // dust cover ribs
      cyl(g, 0.036, 0.012, M.dark, 0, -0.012, -0.05, 18);                           // mag rear cap
      box(g, 0.03, 0.02, 0.03, M.dark, 0, 0.02, -0.06);                             // mag latch
      box(g, 0.026, 0.026, 0.02, M.dark, 0, 0.04, 0.1);                             // stock hinge
      sling(g, 0.0, 0.12, -0.026);
      irons = { cy: 0.106, zr: 0.0, zf: -0.275 };
      optic(0.13, -0.1, 0.094, -0.2, 0.05); spot.side = true;
      muzzleZ = -0.388; muzzleY = 0.046; left = [-0.02, -0.06, -0.22];
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
      triggerGroup(g, 0.0, M.wood, 0.22, 0.0);
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
      prof(g, [[-0.23, 0.065], [0.27, 0.065], ['q', 0.28, 0.065, 0.28, 0.05], [0.28, -0.025], [0.06, -0.025], [0.04, -0.012], [-0.17, -0.012], ['q', -0.23, -0.012, -0.23, 0.02]], 0.056, S, 0, 0.007);   // bullpup body
      box(g, 0.058, 0.03, 0.2, M.black, 0, 0.0, 0.1);
      box(g, 0.02, 0.05, 0.03, M.dark, 0, 0.09, -0.18); box(g, 0.02, 0.05, 0.03, M.dark, 0, 0.09, 0.12); // carry handle legs
      box(g, 0.024, 0.014, 0.33, M.dark, 0, 0.12, -0.03);                           // carry handle
      { const bp = part('bolt', 0, 0.105, 0.0); pbox(bp, 0.03, 0.01, 0.02, M.steel, 0, 0.106, 0.0); }
      box(g, 0.05, 0.05, 0.14, M.dark, 0, 0.02, -0.3);
      cyl(g, 0.01, 0.24, M.dark, 0, 0.03, -0.45); cyl(g, 0.013, 0.04, M.black, 0, 0.03, -0.59);
      for (const s of [-1, 1]) box(g, 0.008, 0.008, 0.18, M.dark, s * 0.02, -0.005, -0.4);   // folded bipod
      magObj = mag(g, 0.15, 0.13, -0.05, 0.03, 0.055, M.dark, -0.02);
      triggerGroup(g, -0.12, M.grip, 0.2, -0.012);
      prof(g, [[-0.15, -0.01], [-0.17, -0.01], [-0.17, -0.06], ['q', -0.17, -0.07, -0.16, -0.07], [-0.0, -0.07], [0.04, -0.06], [0.04, -0.02], [0.03, -0.02], [0.03, -0.054], [-0.004, -0.062], [-0.155, -0.062], [-0.155, -0.012]], 0.012, M.polyBlack, 0, 0.003);   // full-length hand guard loop
      buttPad(g, 0.05, 0.086, 0.02, 0.286);
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
      // AUG A3: one-piece rounded polymer stock, receiver with a full-length top rail, big trigger guard that wraps
      // the grip hand, folding vertical foregrip on the barrel, translucent mag behind the grip
      prof(g, [[-0.17, -0.022], [-0.17, 0.0], ['q', -0.168, 0.04, -0.12, 0.045], [0.27, 0.045], ['q', 0.296, 0.045, 0.296, 0.02], [0.296, -0.05], ['q', 0.296, -0.062, 0.28, -0.062], [0.065, -0.062], ['q', 0.045, -0.062, 0.035, -0.04], [-0.02, -0.022]], 0.062, S, 0, 0.01);   // stock body
      prof(g, [[0.13, 0.04], [0.13, 0.078], [-0.2, 0.078], ['q', -0.236, 0.078, -0.242, 0.06], [-0.242, 0.032], [-0.16, 0.032]], 0.05, M.dark, 0, 0.006);   // receiver
      rail(g, 0.082, -0.232, 0.125, 0.024);
      cyl(g, 0.0125, 0.32, M.dark, 0, 0.05, -0.4); cyl(g, 0.021, 0.03, M.dark, 0, 0.05, -0.255);   // barrel + collar
      for (let i = 0; i < 3; i++) cyl(g, 0.0145, 0.006, M.dark, 0, 0.05, -0.47 - i * 0.022);       // barrel rings
      cyl(g, 0.016, 0.05, M.black, 0, 0.05, -0.585);                                // flash hider
      for (let i = 0; i < 4; i++) box(g, 0.0035, 0.034, 0.03, M.dark, 0, 0.05, -0.595, 0, 0, i * Math.PI / 4);
      box(g, 0.026, 0.024, 0.04, M.dark, 0, 0.03, -0.3);                            // gas block
      box(g, 0.03, 0.04, 0.034, M.polyBlack, 0, 0.012, -0.28);                      // foregrip hinge (touches the barrel)
      prof(g, [[-0.264, -0.004], [-0.298, -0.004], [-0.304, -0.072], ['q', -0.304, -0.083, -0.292, -0.083], [-0.272, -0.081], ['q', -0.26, -0.078, -0.26, -0.066]], 0.03, M.polyBlack, 0, 0.006);   // folding foregrip
      ribs(g, 0.03, 0.06, -0.045, -0.3, -0.262, 0.012);
      grip(g, -0.08, -0.022, M.polyBlack, 0.02, 0.1, 0.034, 0.066);
      prof(g, [[-0.172, -0.01], [-0.172, -0.1], ['q', -0.172, -0.13, -0.142, -0.13], [-0.06, -0.13], [-0.06, -0.113], [-0.142, -0.113], ['q', -0.153, -0.113, -0.153, -0.1], [-0.153, -0.01]], 0.03, S, 0, 0.006);   // wrap-around guard
      prof(g, [[-0.118, -0.02], ['q', -0.127, -0.034, -0.118, -0.048], [-0.113, -0.046], ['q', -0.12, -0.034, -0.111, -0.02]], 0.005, M.steel, 0, 0.001);   // trigger
      magObj = mag(g, 0.1, 0.13, -0.06, 0.03, 0.052, M.smokeMag, -0.056);
      { const rounds = magObj; for (let i = 0; i < 4; i++) box(rounds, 0.012, 0.008, 0.042, M.brass, 0, -0.012 - i * 0.012, -0.004); }
      buttPad(g, 0.058, 0.098, -0.008, 0.303);
      { const bp = part('bolt', -0.03, 0.058, -0.15); pbox(bp, 0.02, 0.012, 0.016, M.steel, -0.032, 0.058, -0.15); }
      // --- detail
      seams(g, 0.031, [0.03, -0.035], -0.1, 0.27);
      for (const s of [-1, 1]) { box(g, 0.004, 0.032, 0.06, M.black, s * 0.032, 0.008, 0.19); box(g, 0.004, 0.02, 0.04, S, s * 0.0335, 0.008, 0.19); }   // ejection port covers
      box(g, 0.006, 0.006, 0.05, M.steel, 0.026, 0.044, -0.2);                      // barrel release
      box(g, 0.066, 0.012, 0.05, M.dark, 0, -0.06, 0.1);                            // mag well lip
      box(g, 0.068, 0.01, 0.014, M.steel, 0, -0.006, -0.02);                        // cross-bolt safety
      box(g, 0.064, 0.008, 0.02, M.black, 0, 0.03, 0.13);                           // receiver/stock joint
      sling(g, -0.05, 0.25);
      optic(0.118, -0.06, 0.086, -0.222, 0.115);
      muzzleZ = -0.61; muzzleY = 0.05; left = [0, -0.07, -0.282];
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
      cyl(g, 0.026, 0.37, M.black, 0, 0.035, -0.355, 18);                           // integral suppressor (reaches the receiver)
      cyl(g, 0.028, 0.02, M.dark, 0, 0.035, -0.53, 14);
      prof(g, [[-0.17, 0.064], [-0.3, 0.062], ['q', -0.312, 0.062, -0.312, 0.05], [-0.312, 0.012], ['q', -0.312, 0.0, -0.3, 0.0], [-0.17, 0.004]], 0.064, M.grip, 0, 0.01);   // forend around the suppressor
      magObj = mag(g, -0.09, 0.12, -0.1, 0.028, 0.05, M.dark, -0.005);
      triggerGroup(g, 0.02, M.grip, 0.3, 0.006);                                    // grip meets the receiver underside
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
      ribs(g, 0.064, 0.05, 0.032, -0.29, -0.19, 0.02);
      box(g, 0.022, 0.024, 0.024, M.dark, 0, 0.02, 0.09);                           // stock hinge
      sling(g, 0.0, 0.1, 0.026);
      irons = { cy: 0.096, zr: -0.05, zf: -0.45 };
      optic(0.12, -0.07, 0.085, -0.17, 0.05); spot.side = true;
      under = { y: 0.005, z: -0.24 };
      muzzleZ = -0.54; muzzleY = 0.035; left = [-0.02, -0.04, -0.25];
      break;
    }
    case 'scarh': {
      prof(g, [[0.09, 0.02], [0.09, 0.08], [-0.455, 0.08], ['q', -0.465, 0.08, -0.465, 0.07], [-0.465, 0.02]], 0.054, S, 0, 0.006);   // long upper receiver (runs to the gas block)
      { const bp = part('bolt', 0.035, 0.05, -0.2); pbox(bp, 0.026, 0.012, 0.012, M.steel, 0.04, 0.05, -0.2); }
      for (const s of [-1, 1]) for (let zz = -0.32; zz < -0.18; zz += 0.016) box(g, 0.006, 0.026, 0.007, M.black, s * 0.029, 0.045, zz);
      box(g, 0.03, 0.034, 0.03, M.dark, 0, 0.048, -0.478);                          // gas block
      cyl(g, 0.0135, 0.15, M.dark, 0, 0.042, -0.54, 16); cyl(g, 0.0165, 0.02, M.dark, 0, 0.042, -0.6, 16);   // barrel + shoulder
      cyl(g, 0.017, 0.06, M.black, 0, 0.042, -0.64, 16);                            // flash hider
      for (let i = 0; i < 3; i++) box(g, 0.036, 0.004, 0.04, M.dark, 0, 0.042, -0.645, 0, 0, i * Math.PI / 3);
      magObj = mag(g, -0.1, 0.13, 0.04, 0.034, 0.07, M.dark, -0.028, 0.014);        // 20-round 7.62 mag
      triggerGroup(g, 0.02, M.grip, 0.3, -0.012);
      prof(g, [[0.09, 0.024], [0.09, 0.0], [0.07, -0.014], [-0.055, -0.014], [-0.062, -0.032], [-0.145, -0.032], [-0.15, -0.012], [-0.17, 0.0], [-0.17, 0.024]], 0.052, M.polyBlack, 0, 0.004);   // polymer lower + mag well
      prof(g, [[0.1, 0.08], [0.33, 0.08], [0.345, 0.07], [0.345, -0.024], [0.32, -0.024], [0.22, 0.006], [0.12, 0.01], [0.1, 0.03]], 0.05, S, 0, 0.007, [[[0.15, 0.06], [0.3, 0.06], [0.3, 0.02], [0.17, 0.028]]]);   // folding stock with cheek rest
      rail(g, 0.081, -0.46, 0.06);
      // --- detail
      seams(g, 0.027, [0.03], -0.32, 0.08);
      ejectPort(g, 0.027, 0.055, -0.03, 0.06);
      selector(g, 0.025, 0.01, 0.04);
      rivets(g, 0.025, 0.0, [-0.1, 0.07]);
      box(g, 0.006, 0.012, 0.27, M.dark, 0.03, 0.045, -0.32); box(g, 0.006, 0.012, 0.27, M.dark, -0.03, 0.045, -0.32);   // side rails
      box(g, 0.024, 0.01, 0.2, M.dark, 0, 0.016, -0.355);                           // bottom rail
      for (let z = -0.45; z < -0.27; z += 0.014) box(g, 0.028, 0.006, 0.007, M.black, 0, 0.011, z);
      box(g, 0.006, 0.012, 0.012, M.steel, 0.026, -0.02, -0.075);                   // mag release
      box(g, 0.054, 0.03, 0.02, M.dark, 0, 0.04, 0.09);                             // folding hinge
      buttPad(g, 0.046, 0.098, 0.028, 0.352);
      sling(g, 0.0, 0.3);
      irons = { cy: 0.104, zr: 0.04, zf: -0.45 };
      optic(0.115, -0.12, 0.085, -0.44, 0.06);
      under = { y: 0.011, z: -0.36 };
      muzzleZ = -0.67; muzzleY = 0.042; left = [-0.02, -0.03, -0.3];
      break;
    }
    case 'fal': {
      box(g, 0.05, 0.065, 0.32, S, 0, 0.04, -0.06);
      box(g, 0.052, 0.012, 0.3, M.dark, 0, 0.076, -0.06);
      { const bp = part('bolt', -0.03, 0.05, -0.12); pbox(bp, 0.02, 0.012, 0.016, M.steel, -0.032, 0.05, -0.12); }
      prof(g, [[-0.22, 0.058], [-0.42, 0.058], ['q', -0.43, 0.058, -0.43, 0.048], [-0.426, 0.008], ['q', -0.422, 0.0, -0.41, 0.0], [-0.24, 0.002], [-0.22, 0.012]], 0.058, M.wood, 0, 0.007);   // wooden handguard
      for (let zz = -0.4; zz < -0.24; zz += 0.03) box(g, 0.06, 0.03, 0.008, M.black, 0, 0.03, zz);
      cyl(g, 0.011, 0.3, M.dark, 0, 0.04, -0.5); cyl(g, 0.016, 0.07, M.black, 0, 0.04, -0.68);
      box(g, 0.02, 0.04, 0.02, M.dark, 0, 0.063, -0.6);
      magObj = mag(g, -0.1, 0.13, 0.05, 0.034, 0.065, M.dark, -0.015, 0.016);
      triggerGroup(g, 0.02, M.wood, 0.3, -0.008);
      prof(g, [[0.09, 0.07], [0.13, 0.066], [0.362, 0.046], [0.364, -0.06], ['q', 0.352, -0.068, 0.338, -0.066], [0.15, -0.004], [0.09, 0.006]], 0.045, M.wood, 0, 0.007);   // wooden stock
      prof(g, [[0.362, 0.048], [0.374, 0.048], [0.374, -0.064], [0.362, -0.064]], 0.047, M.dark, 0, 0.003);   // butt plate
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
        prof(g, [[0.1, 0.058], [0.375, 0.05], [0.375, -0.062], [0.34, -0.062], [0.12, -0.03], [0.1, -0.012]], 0.034, M.wood, 0, 0.006, [[[0.15, 0.038], [0.335, 0.034], [0.335, -0.042], [0.16, -0.018]]]);   // skeleton wooden stock
        box(g, 0.026, 0.008, 0.03, M.dark, 0, 0.081, 0.02); box(g, 0.01, 0.045, 0.012, M.dark, 0, 0.06, -0.7);
        irons = { cy: 0.095, zr: 0.02, zf: -0.7 };
        optic(0.125, -0.02, 0.09, -0.12, 0.06); spot.side = true;
      } else {
        cyl(g, 0.015, 0.4, M.dark, 0, 0.03, -0.48); box(g, 0.07, 0.055, 0.18, M.dark, 0, 0.01, -0.3);
        box(g, 0.05, 0.01, 0.2, M.dark, 0, 0.06, -0.38); cyl(g, 0.017, 0.05, M.black, 0, 0.03, -0.7);
        prof(g, [[0.1, 0.056], [0.4, 0.05], [0.4, -0.05], [0.37, -0.054], [0.17, -0.02], [0.1, -0.016]], 0.05, S, 0, 0.007);   // ribbed polymer stock
        rail(g, 0.084, 0.0, 0.12);
        optic(0.118, 0.06, 0.084, 0.0, 0.12);
        under = { y: -0.018, z: -0.3 };
      }
      for (const s of [-1, 1]) box(g, 0.01, 0.01, 0.26, M.steel, s * 0.02, pk ? -0.005 : -0.022, -0.5);   // folded bipod
      { const mb = magObj = part('mag', -0.04, -0.01, -0.05);
        pbox(mb, 0.08, 0.11, 0.13, pk ? M.olive : M.dark, -0.045, -0.065, -0.05);
        pbox(mb, 0.082, 0.014, 0.132, M.black, -0.045, -0.005, -0.05);
        for (let i = 0; i < 4; i++) pcyl(mb, 0.0055, 0.034, M.brass, -0.02 - i * 0.01, 0.02 - i * 0.012, -0.05, 6); }
      triggerGroup(g, 0.06, M.grip, 0.3, -0.004);
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
      else box(g, 0.036, 0.11, 0.012, M.steel, 0, -0.006, 0.381);                  // pkm butt plate
      sling(g, -0.04, 0.3); sling(g, 0.0, -0.4, -0.02);
      muzzleZ = pk ? -0.82 : -0.73; muzzleY = pk ? 0.035 : 0.03; left = [-0.03, -0.04, -0.32];
      break;
    }
    case 'kar98': {
      // one-piece wooden stock: long forend, semi-pistol-grip wrist, dropped butt
      prof(g, [[-0.5, 0.03], [-0.04, 0.03], [0.06, 0.026], [0.12, 0.02], [0.39, 0.002], [0.392, -0.1], ['q', 0.38, -0.108, 0.364, -0.106], [0.17, -0.05], [0.13, -0.064], ['q', 0.11, -0.068, 0.1, -0.05], [0.09, -0.032], [-0.06, -0.026], [-0.5, -0.004]], 0.05, M.wood, 0, 0.007);
      prof(g, [[0.389, 0.004], [0.4, 0.004], [0.4, -0.104], [0.389, -0.104]], 0.052, M.steel, 0, 0.003);   // steel butt plate
      box(g, 0.034, 0.016, 0.2, M.wood, 0, 0.052, -0.3);                            // upper handguard over the barrel
      cyl(g, 0.018, 0.22, S, 0, 0.04, -0.02);                                       // receiver
      cyl(g, 0.011, 0.4, M.dark, 0, 0.04, -0.45); cyl(g, 0.013, 0.03, M.dark, 0, 0.04, -0.66);
      for (const zz of [-0.4, -0.49]) box(g, 0.054, 0.066, 0.012, M.dark, 0, 0.024, zz);     // barrel bands
      { const bp = part('bolt', 0.02, 0.045, 0.07);                                 // turned-down bolt handle
        pcyl(bp, 0.007, 0.07, M.steel, 0.0, 0.045, 0.06); pbox(bp, 0.05, 0.008, 0.008, M.steel, 0.03, 0.035, 0.08, 0, 0, -0.5);
        pbox(bp, 0.018, 0.018, 0.018, M.steel, 0.055, 0.02, 0.08); }
      guard(g, 0.05, -0.026);
      box(g, 0.02, 0.025, 0.02, M.dark, 0, 0.062, -0.63); box(g, 0.03, 0.012, 0.04, M.dark, 0, 0.065, -0.18);
      // --- detail
      box(g, 0.042, 0.016, 0.1, S, 0, 0.026, -0.02);                                // receiver flats
      box(g, 0.003, 0.014, 0.05, M.black, 0.019, 0.046, 0.0);                       // loading port
      cyl(g, 0.02, 0.014, M.dark, 0, 0.04, -0.13);                                  // receiver ring
      cyl(g, 0.012, 0.03, M.steel, 0, 0.04, 0.11);                                  // bolt shroud / cocking piece
      box(g, 0.01, 0.012, 0.01, M.steel, 0, 0.056, 0.12);                           // safety flag
      box(g, 0.05, 0.012, 0.09, M.dark, 0, -0.03, -0.02);                           // floor plate
      for (const s2 of [-1, 1]) prof(g, [[-0.15, 0.018], [-0.38, 0.018], [-0.38, 0.01], [-0.15, 0.01]], 0.002, M.black, s2 * 0.0255, 0);   // finger grooves
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
      prof(g, [[-0.17, 0.065], [0.24, 0.065], ['q', 0.255, 0.065, 0.255, 0.05], [0.255, -0.03], [0.06, -0.03], [0.04, -0.02], [-0.12, -0.02], ['q', -0.17, -0.02, -0.17, 0.02]], 0.06, S, 0, 0.008);   // bullpup body
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
    case 'spas12': {
      // SPAS-12: tall boxy receiver, perforated heat shield over the barrel, ribbed pump on the mag tube,
      // pistol grip and a skeleton folding stock with the forearm hook under the butt
      prof(g, [[0.08, 0.07], [0.08, -0.016], [0.055, -0.024], [-0.22, -0.024], [-0.22, 0.07]], 0.062, S, 0, 0.007);   // receiver
      seams(g, 0.031, [0.05, -0.004], -0.22, 0.08);
      box(g, 0.003, 0.028, 0.09, M.black, 0.0315, 0.032, -0.06);                    // ejection port
      box(g, 0.003, 0.02, 0.07, M.black, -0.0315, 0.0, -0.08);                      // loading gate
      for (const s of [-1, 1]) box(g, 0.004, 0.012, 0.03, M.steel, s * 0.032, -0.012, 0.03);   // action-mode button
      cyl(g, 0.017, 0.5, M.dark, 0, 0.052, -0.47);                                  // barrel
      prof(g, [[-0.22, 0.082], [-0.6, 0.082], ['q', -0.61, 0.082, -0.61, 0.072], [-0.61, 0.03], [-0.22, 0.03]], 0.05, M.dark, 0, 0.005);   // heat shield
      for (const s of [-1, 1]) for (let zz = -0.58; zz < -0.25; zz += 0.028) for (const yy of [0.045, 0.066]) box(g, 0.003, 0.009, 0.012, M.black, s * 0.0255, yy, zz);   // shield holes
      for (let zz = -0.58; zz < -0.25; zz += 0.028) box(g, 0.012, 0.003, 0.012, M.black, 0, 0.0835, zz);
      cyl(g, 0.016, 0.47, M.dark, 0, 0.0, -0.45);                                   // magazine tube
      cyl(g, 0.019, 0.03, M.steel, 0, 0.0, -0.69);                                  // mag tube cap
      box(g, 0.04, 0.05, 0.02, M.dark, 0, 0.028, -0.64);                            // barrel band
      { const pp = part('pump', 0, -0.004, -0.38);
        pbox(pp, 0.066, 0.056, 0.17, M.grip, 0, -0.004, -0.38);                     // pump
        for (let i = 0; i < 7; i++) pbox(pp, 0.068, 0.058, 0.006, M.black, 0, -0.004, -0.455 + i * 0.025); }
      triggerGroup(g, 0.0, M.grip, 0.35, -0.012);
      // skeleton folding stock: top and bottom struts into a butt plate with the hook underneath
      box(g, 0.012, 0.012, 0.3, M.dark, 0, 0.052, 0.23);
      box(g, 0.012, 0.012, 0.29, M.dark, 0, -0.012, 0.225, 0.17);
      box(g, 0.05, 0.02, 0.024, M.dark, 0, 0.055, 0.085);                           // folding hinge
      cyl(g, 0.012, 0.06, M.steel, 0, 0.055, 0.085, 10);
      buttPad(g, 0.044, 0.12, 0.02, 0.385);
      prof(g, [[0.36, -0.04], [0.36, -0.07], ['q', 0.34, -0.1, 0.3, -0.098], [0.29, -0.088], [0.31, -0.086], ['q', 0.335, -0.084, 0.34, -0.06], [0.34, -0.04]], 0.016, M.dark, 0, 0.003);   // forearm hook
      sling(g, 0.066, 0.3);                                                         // sling loop on the top strut
      irons = { cy: 0.104, zr: 0.04, zf: -0.6 };
      box(g, 0.02, 0.03, 0.02, M.dark, 0, 0.088, -0.6);                             // front sight base on the shield
      muzzleZ = -0.73; muzzleY = 0.052; sightY = 0.104; left = [-0.02, -0.045, -0.38];
      break;
    }
    case 'benelli': {
      // M4 Super 90-style semi-auto: slim receiver with a full top rail, ghost-ring sights, twin gas pistons under the
      // barrel, ribbed fore-end round the mag tube, pistol grip and a collapsible stock with a cheek riser
      prof(g, [[0.08, 0.066], [0.08, -0.012], [0.055, -0.02], [-0.2, -0.02], [-0.2, 0.066]], 0.056, S, 0, 0.007);   // receiver
      seams(g, 0.028, [0.046], -0.2, 0.08);
      box(g, 0.003, 0.026, 0.085, M.black, 0.0285, 0.03, -0.05);                    // ejection port
      box(g, 0.004, 0.012, 0.024, M.steel, 0.03, 0.03, -0.02);                      // bolt handle
      box(g, 0.003, 0.016, 0.06, M.black, -0.0285, -0.004, -0.08);                  // loading port
      cyl(g, 0.016, 0.5, M.dark, 0, 0.045, -0.45);                                  // barrel
      cyl(g, 0.015, 0.4, M.black, 0, 0.0, -0.4);                                    // magazine tube
      cyl(g, 0.018, 0.026, M.dark, 0, 0.0, -0.61);                                  // mag cap
      for (const s of [-1, 1]) cyl(g, 0.006, 0.12, M.steel, s * 0.012, 0.022, -0.27, 8);   // twin gas pistons
      prof(g, [[-0.2, 0.05], [-0.48, 0.05], ['q', -0.49, 0.05, -0.49, 0.04], [-0.49, -0.024], ['q', -0.49, -0.034, -0.48, -0.034], [-0.2, -0.034]], 0.06, M.grip, 0, 0.007);   // fore-end
      ribs(g, 0.06, 0.07, 0.008, -0.47, -0.3, 0.022);
      box(g, 0.04, 0.03, 0.02, M.dark, 0, 0.026, -0.56);                            // barrel clamp
      triggerGroup(g, 0.0, M.grip, 0.32, -0.012);
      cyl(g, 0.016, 0.16, M.dark, 0, 0.035, 0.16);                                  // stock tube
      prof(g, [[0.17, 0.066], [0.35, 0.07], [0.35, -0.05], [0.32, -0.05], ['q', 0.25, -0.03, 0.21, 0.005], [0.17, 0.01]], 0.044, M.grip, 0, 0.006,
        [[[0.24, 0.044], [0.32, 0.046], [0.32, -0.026], [0.3, -0.026]]]);           // collapsible stock with a cut-out
      prof(g, [[0.2, 0.068], [0.34, 0.072], [0.34, 0.09], ['q', 0.33, 0.096, 0.31, 0.096], [0.22, 0.09], [0.2, 0.08]], 0.04, M.grip, 0, 0.005);   // cheek riser
      buttPad(g, 0.046, 0.12, 0.01, 0.36);
      sling(g, -0.03, 0.3);
      rail(g, 0.07, -0.2, 0.07);
      irons = { cy: 0.1, zr: 0.05, zf: -0.6 };
      box(g, 0.018, 0.03, 0.02, M.dark, 0, 0.07, -0.6);                             // front sight base
      optic(0.104, -0.07, 0.07, -0.2, 0.07); under = null;
      muzzleZ = -0.7; muzzleY = 0.045; sightY = 0.1; left = [-0.02, -0.045, -0.38];
      break;
    }
    case 'tcsg': {
      // TCSG12: AR-pattern semi-auto slug shotgun. Thick upper and lower receivers, long octagonal M-LOK handguard
      // nearly to the muzzle, slightly curved 10-round box mag, big ported brake, adjustable stock with cheek riser
      prof(g, [[0.1, 0.022], [0.1, 0.068], ['q', 0.1, 0.076, 0.092, 0.076], [-0.24, 0.076], [-0.24, 0.022]], 0.058, S, 0, 0.005);   // upper
      prof(g, [[0.11, 0.024], [0.11, 0.0], [0.08, -0.02], [-0.05, -0.02], [-0.062, -0.05], [-0.16, -0.05], [-0.17, -0.024], [-0.19, 0.0], [-0.2, 0.024]], 0.054, S, 0, 0.004);   // lower + flared mag well
      prof(g, [[-0.24, 0.074], [-0.58, 0.074], ['q', -0.592, 0.074, -0.592, 0.062], [-0.592, 0.016], ['q', -0.592, 0.004, -0.58, 0.004], [-0.24, 0.004]], 0.064, M.wolf, 0, 0.012);   // octagonal handguard
      for (const s of [-1, 1]) for (let zz = -0.56; zz < -0.27; zz += 0.045) box(g, 0.003, 0.014, 0.03, M.black, s * 0.0325, 0.04, zz);   // M-LOK slots
      for (const s of [-1, 1]) for (let zz = -0.56; zz < -0.27; zz += 0.045) box(g, 0.012, 0.003, 0.03, M.black, s * 0.02, 0.07, zz, 0, 0, s * 0.6);
      box(g, 0.066, 0.014, 0.03, M.dark, 0, 0.04, -0.245);                          // barrel nut ring
      cyl(g, 0.016, 0.08, M.dark, 0, 0.038, -0.63);                                 // barrel
      prof(g, [[-0.66, 0.064], [-0.74, 0.064], [-0.74, 0.012], [-0.66, 0.012]], 0.046, M.dark, 0, 0.005);   // ported brake
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) box(g, 0.003, 0.03, 0.012, M.black, s * 0.0235, 0.04, -0.678 - i * 0.022);
      for (let i = 0; i < 3; i++) box(g, 0.02, 0.003, 0.012, M.black, 0, 0.0645, -0.678 - i * 0.022);
      magObj = mag(g, -0.11, 0.17, 0.08, 0.044, 0.07, M.polyBlack, -0.045, 0.03);   // 10-round box mag
      triggerGroup(g, 0.0, M.polyBlack, 0.3, -0.02);
      cyl(g, 0.017, 0.16, M.dark, 0, 0.04, 0.18);                                   // buffer tube
      prof(g, [[0.2, 0.068], [0.35, 0.07], [0.35, -0.04], [0.318, -0.04], ['q', 0.27, -0.022, 0.245, 0.008], [0.2, 0.014]], 0.046, M.wolf, 0, 0.006, [[[0.255, 0.034], [0.316, 0.034], [0.316, -0.018], [0.292, -0.018]]]);   // stock
      box(g, 0.036, 0.022, 0.09, M.polyBlack, 0, 0.077, 0.28);                      // cheek riser
      buttPad(g, 0.046, 0.104, 0.015, 0.358);
      rail(g, 0.08, -0.58, 0.09);
      { const bp = part('bolt', 0.0, 0.078, 0.085); pbox(bp, 0.036, 0.012, 0.03, M.dark, 0, 0.078, 0.085); }   // charging handle
      // --- detail
      ejectPort(g, 0.029, 0.05, -0.06, 0.08, 0.024);
      cyl(g, 0.009, 0.018, M.dark, 0.034, 0.055, 0.03, 10).rotation.set(0, 0, Math.PI / 2);   // forward assist
      selector(g, 0.027, 0.006, 0.05);
      seams(g, 0.029, [0.024], -0.2, 0.1);
      box(g, 0.008, 0.014, 0.018, M.steel, 0.028, -0.034, -0.08);                   // mag release
      box(g, 0.012, 0.022, 0.02, M.steel, 0, 0.0, 0.215);                           // stock latch
      for (let z = 0.105; z < 0.2; z += 0.014) box(g, 0.037, 0.004, 0.006, M.black, 0, 0.056, z);
      sling(g, -0.03, 0.33);
      irons = { cy: 0.108, zr: 0.06, zf: -0.56 };
      optic(0.114, -0.07, 0.084, -0.56, 0.09);
      under = { y: 0.0, z: -0.42 };
      muzzleZ = -0.74; muzzleY = 0.038; left = [-0.02, -0.03, -0.42];
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
      guard(g, -0.01, 0.002);
      if (sawn) prof(g, [[0.012, 0.058], [0.04, 0.05], ['q', 0.075, 0.02, 0.09, -0.07], [0.082, -0.084], [0.05, -0.084], ['q', 0.044, -0.02, 0.012, 0.0]], 0.04, M.wood, 0, 0.007);   // bird's-head pistol grip
      else {
        prof(g, [[0.012, 0.06], [0.06, 0.054], [0.33, 0.036], [0.332, -0.066], ['q', 0.32, -0.074, 0.305, -0.072], [0.12, -0.026], [0.07, -0.03], [0.04, -0.008], [0.012, 0.0]], 0.046, M.wood, 0, 0.007);   // English-style stock
        prof(g, [[0.33, 0.038], [0.342, 0.038], [0.342, -0.07], [0.33, -0.07]], 0.048, M.dark, 0, 0.003);
      }
      // --- detail
      for (const s of [-1, 1]) { box(g, 0.003, 0.03, 0.06, M.steel, s * 0.031, 0.03, -0.03); box(g, 0.004, 0.006, 0.006, M.dark, s * 0.032, 0.03, -0.065); }   // engraved side plates + hinge pin
      box(g, 0.062, 0.006, 0.1, M.black, 0, 0.012, -0.03);                          // receiver seam
      box(g, 0.012, 0.012, 0.02, M.steel, 0, 0.068, 0.02);                          // safety slide
      for (const s of [-1, 1]) pcyl(br, 0.0185, 0.012, M.black, s * 0.018, 0.045, -0.08 - blen + 0.006);   // muzzle rims
      pbox(br, 0.04, 0.012, 0.03, M.steel, 0, 0.02, -0.1);                         // forend latch
      for (let z = -0.22; z < -0.12; z += 0.02) pbox(br, 0.062, 0.005, 0.006, M.black, 0, -0.008, z);   // forend checkering (moves with the barrels)
      if (sawn) prof(g, [[0.05, -0.082], [0.083, -0.082], [0.085, -0.092], [0.048, -0.092]], 0.042, M.dark, 0, 0.002);   // grip cap
      else sling(g, -0.05, 0.26);
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
      triggerGroup(g, 0.04, M.grip, 0.3, -0.006);
      prof(g, [[-0.285, -0.004], [-0.315, -0.004], [-0.322, -0.07], ['q', -0.322, -0.08, -0.31, -0.08], [-0.292, -0.078]], 0.03, M.grip, 0, 0.005);   // front grip
      solidStock(g, 0.08, 0.31, 0.062, 0.05, -0.004, -0.04, S, 0.05, false);
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
      // Dart Ranger: long toy bolt-action blaster. Moulded receiver shell, vented barrel shroud with an orange tip,
      // pull-back priming bolt, clip of darts ahead of the trigger, thumbhole stock, folded bipod
      prof(g, [[0.13, 0.0], [0.13, 0.07], ['q', 0.12, 0.09, 0.09, 0.092], [-0.27, 0.092], ['q', -0.29, 0.092, -0.29, 0.07], [-0.29, 0.0], ['q', -0.29, -0.024, -0.27, -0.024], [0.11, -0.024]], 0.07, M.toyBlue, 0, 0.012);   // receiver shell
      prof(g, [[0.1, 0.02], [0.1, 0.07], [-0.24, 0.07], [-0.24, 0.02]], 0.074, M.toyWhite, 0, 0.004);   // side panels
      for (let i = 0; i < 5; i++) box(g, 0.076, 0.03, 0.01, M.toyBlue, 0, 0.045, -0.2 + i * 0.05);    // panel slots
      box(g, 0.006, 0.012, 0.16, M.black, 0.036, 0.075, 0.03);                       // bolt track
      cyl(g, 0.03, 0.32, M.toyWhite, 0, 0.045, -0.45, 18);                          // barrel shroud
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) box(g, 0.004, 0.014, 0.03, M.black, s * 0.029, 0.045, -0.33 - i * 0.042);   // shroud vents
      for (let i = 0; i < 3; i++) cyl(g, 0.032, 0.01, M.toyBlue, 0, 0.045, -0.32 - i * 0.12, 18);   // shroud bands
      cyl(g, 0.034, 0.05, M.toyOrange, 0, 0.045, -0.635, 18); cyl(g, 0.016, 0.004, M.black, 0, 0.045, -0.661, 12);   // safety-orange tip
      for (const s of [-1, 1]) box(g, 0.008, 0.008, 0.2, M.toyOrange, s * 0.022, 0.0, -0.4, 0.06);   // folded bipod legs
      box(g, 0.05, 0.016, 0.03, M.toyGray, 0, 0.008, -0.3);                         // bipod hinge
      { const bp = part('bolt', 0.05, 0.075, 0.09);                                // priming bolt with a big orange knob
        pbox(bp, 0.026, 0.012, 0.012, M.toyGray, 0.044, 0.075, 0.09);
        const k = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), M.toyOrange); k.position.set(0.012, 0, 0); bp.add(k); }
      { const mp = magObj = part('mag', 0, -0.024, -0.1);                          // dart clip
        pbox(mp, 0.05, 0.1, 0.06, M.toyYellow, 0, -0.07, -0.1);
        pbox(mp, 0.054, 0.012, 0.064, M.toyOrange, 0, -0.118, -0.1);
        for (let i = 0; i < 3; i++) pbox(mp, 0.052, 0.006, 0.04, M.toyOrange, 0, -0.04 - i * 0.022, -0.1); }
      guard(g, 0.04, -0.024, M.toyGray);
      grip(g, 0.066, -0.024, M.toyGray, 0.05, 0.11, 0.042, 0.066);
      // thumbhole stock
      prof(g, [[0.13, 0.08], [0.4, 0.07], ['q', 0.43, 0.07, 0.43, 0.04], [0.43, -0.1], ['q', 0.43, -0.12, 0.41, -0.12], [0.33, -0.12], [0.2, -0.04], [0.13, -0.02]], 0.05, M.toyGray, 0, 0.01,
        [[[0.2, 0.04], [0.33, 0.035], [0.33, -0.06], [0.24, -0.02], [0.2, -0.0]]]);
      box(g, 0.054, 0.024, 0.15, M.toyOrange, 0, 0.083, 0.3);                       // cheek rest
      box(g, 0.056, 0.2, 0.024, M.toyOrange, 0, -0.025, 0.438);                     // butt pad
      for (let i = 0; i < 5; i++) box(g, 0.058, 0.004, 0.026, M.toyYellow, 0, -0.1 + i * 0.04, 0.44);
      rail(g, 0.098, -0.22, 0.1, 0.03);
      optic(0.145, -0.06, 0.106, -0.2, 0.08);
      irons = { cy: 0.12, zr: 0.08, zf: -0.26 };
      muzzleZ = -0.664; muzzleY = 0.045; left = [-0.02, -0.03, -0.36];
      break;
    }
    case 'dartshotgun': {
      // Popper 2x4: chunky moulded toy pump blaster. Rounded two-tone shell, 2x2 barrel block (fires two darts a pump),
      // ribbed pump grip under the barrels, side dart holder, priming cap at the back
      prof(g, [[0.13, 0.0], [0.13, 0.06], ['q', 0.12, 0.098, 0.07, 0.102], [-0.2, 0.102], ['q', -0.214, 0.102, -0.214, 0.09], [-0.214, -0.022], [0.02, -0.022], ['q', 0.07, -0.022, 0.09, -0.012]], 0.072, M.toyBlue, 0, 0.014);   // main shell
      prof(g, [[0.1, 0.012], [0.1, 0.058], ['q', 0.09, 0.084, 0.055, 0.086], [-0.17, 0.086], [-0.17, 0.012]], 0.076, M.toyWhite, 0, 0.004);   // white side panels
      prof(g, [[0.075, 0.03], [0.075, 0.064], [-0.12, 0.064], [-0.12, 0.03]], 0.078, M.toyBlue, 0, 0.003);   // blue window in the panel
      for (let i = 0; i < 3; i++) box(g, 0.08, 0.05, 0.008, M.toyOrange, 0, 0.047, -0.15 + i * 0.016, 0.5);   // orange slash accents
      box(g, 0.03, 0.012, 0.3, M.toyOrange, 0, 0.106, -0.06);                       // top ridge
      for (let z = -0.19; z < 0.1; z += 0.03) box(g, 0.034, 0.004, 0.01, M.toyYellow, 0, 0.113, z);   // ridge grips
      prof(g, [[-0.205, 0.108], [-0.335, 0.108], ['q', -0.348, 0.108, -0.348, 0.094], [-0.348, -0.012], ['q', -0.348, -0.026, -0.335, -0.026], [-0.205, -0.026]], 0.084, M.toyOrange, 0, 0.012);   // 2x2 barrel block
      for (const x of [-0.019, 0.019]) for (const y of [0.064, 0.018]) {
        cyl(g, 0.0165, 0.024, M.toyYellow, x, y, -0.358, 14);                       // barrel tips
        cyl(g, 0.0105, 0.004, M.black, x, y, -0.3705, 12);                          // bores
      }
      box(g, 0.086, 0.01, 0.02, M.toyYellow, 0, 0.041, -0.33);                      // band round the block
      { const pp = part('pump', 0, -0.045, -0.2);                                   // ribbed pump grip
        pbox(pp, 0.06, 0.048, 0.13, M.toyGray, 0, -0.05, -0.215);
        for (let i = 0; i < 6; i++) pbox(pp, 0.064, 0.05, 0.007, M.toyOrange, 0, -0.05, -0.27 + i * 0.022);
        pbox(pp, 0.02, 0.026, 0.12, M.toyGray, 0, -0.022, -0.215); }               // slide rail into the body
      guard(g, 0.035, -0.022, M.toyGray);
      grip(g, 0.06, -0.022, M.toyGray, 0.045, 0.11, 0.044, 0.07);
      for (let i = 0; i < 4; i++) box(g, 0.047, 0.004, 0.03, M.toyOrange, 0, -0.05 - i * 0.02, 0.1 + i * 0.008);   // grip texture
      prof(g, [[0.13, 0.002], [0.152, 0.008], [0.152, 0.07], [0.13, 0.072]], 0.06, M.toyOrange, 0, 0.008);   // priming cap
      box(g, 0.036, 0.024, 0.016, M.toyYellow, 0, 0.04, 0.158);
      // dart holder on the left side with four spare darts
      box(g, 0.012, 0.03, 0.12, M.toyGray, -0.042, 0.04, -0.06);
      for (let i = 0; i < 4; i++) { const z = -0.105 + i * 0.03; cyl(g, 0.009, 0.07, M.toyOrange, -0.054, 0.04, z, 10).rotation.set(0, 0, 0); }
      for (let i = 0; i < 4; i++) box(g, 0.02, 0.012, 0.012, M.toyBlue, -0.054, 0.077, -0.105 + i * 0.03);
      box(g, 0.026, 0.014, 0.03, M.toyGray, 0, 0.115, 0.07);                        // rear sight block
      irons = { cy: 0.135, zr: 0.07, zf: -0.32 };
      muzzleZ = -0.372; muzzleY = 0.041; left = [0, -0.06, -0.215];
      break;
    }

    // ============================================================ WW1 / WW2
    case 'm1911': {
      // M1911: blued slide with rear cocking grooves, exposed hammer, grip safety, chequered wood panels
      prof(g, [[0.036, 0.018], [0.036, 0.054], ['q', 0.036, 0.058, 0.032, 0.058], [-0.15, 0.058], ['q', -0.16, 0.058, -0.16, 0.048], [-0.16, 0.018]], 0.034, M.blued, 0, 0.005);   // slide
      for (let i = 0; i < 7; i++) box(g, 0.0355, 0.026, 0.0025, M.black, 0, 0.038, 0.006 + i * 0.0045);
      box(g, 0.003, 0.014, 0.034, M.black, 0.0175, 0.045, -0.04);                   // ejection port
      cyl(g, 0.007, 0.004, M.black, 0, 0.038, -0.1605);
      cyl(g, 0.0095, 0.012, M.blued, 0, 0.026, -0.152);                              // barrel bushing
      prof(g, [[0.04, 0.02], [0.04, 0.004], [0.02, -0.002], [-0.11, -0.002], [-0.154, 0.004], [-0.154, 0.02]], 0.032, M.blued, 0, 0.004);   // frame
      guard(g, -0.04, 0.0, M.blued);
      grip(g, -0.002, 0.0, M.blued, 0.03, 0.098, 0.031, 0.046);
      for (const s of [-1, 1]) prof(g, [[0.006, -0.01], [0.03, -0.088], [0.064, -0.088], [0.044, -0.01]], 0.004, M.wood, s * 0.0165, 0.001);   // wood panels
      box(g, 0.012, 0.016, 0.012, M.blued, 0, 0.052, 0.04, -0.6);                    // hammer
      box(g, 0.014, 0.04, 0.012, M.blued, 0, -0.02, 0.05, 0.3);                      // grip safety
      box(g, 0.004, 0.008, 0.016, M.blued, 0.018, 0.012, -0.03);                     // slide stop
      ironSights(g, 0.068, 0.02, -0.148, M.dotGreen, 'pistol');
      muzzleZ = -0.17; muzzleY = 0.038; sightY = 0.066; left = [-0.01, -0.07, 0.0];
      break;
    }
    case 'luger': {
      // Luger P08: long slim barrel, toggle-lock with round knurled knobs on top, steeply raked grip
      cyl(g, 0.0085, 0.15, M.blued, 0, 0.042, -0.12, 14);                            // barrel
      cyl(g, 0.0115, 0.03, M.blued, 0, 0.042, -0.04, 14);                            // barrel shank
      prof(g, [[0.06, 0.018], [0.06, 0.052], [-0.03, 0.052], [-0.03, 0.03], [-0.05, 0.03], [-0.05, 0.018]], 0.03, M.blued, 0, 0.004);   // receiver
      { const tg = part('slide', 0, 0.058, 0.03);                                    // toggle (lifts on reload)
        pcyl(tg, 0.008, 0.06, M.blued, 0, 0.058, 0.03, 12);
        for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 12), M.blued); k.rotation.z = Math.PI / 2; k.position.set(s * 0.018, 0, 0.022); tg.add(k); } }
      prof(g, [[0.07, 0.02], [0.07, 0.0], [-0.04, 0.0], [-0.05, 0.02]], 0.03, M.blued, 0, 0.003);   // frame
      guard(g, -0.03, 0.002, M.blued);
      grip(g, 0.0, 0.002, M.blued, 0.06, 0.095, 0.03, 0.05);
      for (const s of [-1, 1]) prof(g, [[0.008, -0.01], [0.062, -0.085], [0.096, -0.085], [0.046, -0.01]], 0.004, M.wood, s * 0.0165, 0.001);
      box(g, 0.026, 0.01, 0.02, M.wood, 0, -0.098, 0.064);                           // mag base knob
      ironSights(g, 0.066, 0.05, -0.19, M.dotGreen, 'pistol');
      muzzleZ = -0.2; muzzleY = 0.042; sightY = 0.064; left = [-0.01, -0.07, 0.02];
      break;
    }
    case 'mp40': {
      // MP40: round receiver tube, bakelite lower, long straight mag ahead of the grip, resting bar under the barrel,
      // underfolding steel stock
      cyl(g, 0.022, 0.3, S, 0, 0.045, -0.06, 18);                                    // receiver tube (-0.21 .. 0.09)
      for (let i = 0; i < 6; i++) box(g, 0.046, 0.004, 0.01, M.black, 0, 0.045, -0.15 + i * 0.03);   // ribs
      prof(g, [[0.09, 0.026], [0.09, -0.004], [0.06, -0.014], [-0.075, -0.014], [-0.09, 0.026]], 0.04, M.polyBlack, 0, 0.005);   // bakelite lower
      box(g, 0.036, 0.04, 0.04, S, 0, 0.0, -0.12);                                   // mag well
      magObj = mag(g, -0.12, 0.2, 0.0, 0.026, 0.032, M.dark, -0.02);                // straight 32-round mag
      cyl(g, 0.011, 0.15, M.dark, 0, 0.045, -0.28, 14);                              // barrel
      box(g, 0.03, 0.014, 0.03, M.dark, 0, 0.022, -0.33);                            // resting bar
      cyl(g, 0.016, 0.02, M.dark, 0, 0.045, -0.35, 14); cyl(g, 0.0075, 0.004, M.black, 0, 0.045, -0.3605);
      box(g, 0.018, 0.026, 0.016, M.dark, 0, 0.068, -0.34);                          // front sight hood base
      { const bp = part('bolt', -0.03, 0.045, -0.06); pbox(bp, 0.02, 0.012, 0.012, M.steel, -0.032, 0.045, -0.06); }   // cocking knob (left)
      box(g, 0.003, 0.01, 0.15, M.black, -0.022, 0.045, -0.08);                      // cocking slot
      triggerGroup(g, 0.035, M.polyBlack, 0.25, -0.012);
      for (const s of [-1, 1]) box(g, 0.006, 0.008, 0.24, M.dark, s * 0.016, 0.004, 0.21);   // folding stock struts
      box(g, 0.036, 0.016, 0.02, M.dark, 0, 0.01, 0.09);                             // stock hinge
      prof(g, [[0.32, 0.02], [0.34, 0.02], [0.34, -0.06], [0.32, -0.06]], 0.04, M.dark, 0, 0.004);   // butt plate
      box(g, 0.042, 0.06, 0.012, M.grip, 0, -0.02, 0.344);
      box(g, 0.032, 0.012, 0.03, M.dark, 0, 0.07, 0.04);                             // rear sight base
      sling(g, 0.02, 0.07, 0.022);
      irons = { cy: 0.09, zr: 0.04, zf: -0.34 };
      optic(0.11, -0.05, 0.078, -0.14, 0.04); spot.side = true;
      muzzleZ = -0.362; muzzleY = 0.045; left = [-0.01, -0.05, -0.12];
      break;
    }
    case 'sten': {
      // Sten: bare steel tube receiver, perforated barrel shroud, magazine sticking out to the LEFT, skeleton tube stock
      cyl(g, 0.021, 0.28, M.dark, 0, 0.045, -0.04, 16);                              // receiver tube (-0.18 .. 0.1)
      cyl(g, 0.018, 0.12, M.dark, 0, 0.045, -0.24, 14);                              // barrel shroud
      for (let i = 0; i < 4; i++) for (const a of [0.6, 1.6, 2.6, -0.6, -1.6, -2.6]) box(g, 0.006, 0.003, 0.012, M.black, Math.cos(a) * 0.0178, 0.045 + Math.sin(a) * 0.0178, -0.2 - i * 0.026, 0, 0, a - Math.PI / 2);
      cyl(g, 0.012, 0.04, M.dark, 0, 0.045, -0.32, 12); cyl(g, 0.007, 0.004, M.black, 0, 0.045, -0.3405);
      box(g, 0.04, 0.03, 0.05, M.dark, -0.03, 0.045, -0.12);                         // mag housing (left)
      { const mp = magObj = part('mag', -0.05, 0.045, -0.12);                       // side mag
        pbox(mp, 0.17, 0.026, 0.036, M.dark, -0.13, 0.045, -0.12);
        pbox(mp, 0.008, 0.03, 0.04, M.black, -0.215, 0.045, -0.12);
        for (let i = 0; i < 3; i++) pbox(mp, 0.004, 0.028, 0.03, M.black, -0.08 - i * 0.04, 0.045, -0.12); }
      box(g, 0.03, 0.036, 0.09, M.dark, 0, 0.012, 0.04);                             // trigger housing
      guard(g, 0.03, -0.006);
      { const bp = part('bolt', 0.03, 0.045, 0.0); pbox(bp, 0.02, 0.012, 0.012, M.steel, 0.03, 0.045, 0.0); }
      box(g, 0.003, 0.008, 0.12, M.black, 0.021, 0.045, 0.02);
      cyl(g, 0.009, 0.24, M.dark, 0, 0.03, 0.21, 10).rotation.x = Math.PI / 2 + 0.12;   // tube stock
      box(g, 0.04, 0.08, 0.012, M.dark, 0, 0.0, 0.33);                               // butt T
      box(g, 0.036, 0.012, 0.02, M.dark, 0, 0.068, 0.07); box(g, 0.012, 0.024, 0.01, M.dark, 0, 0.068, -0.29);
      irons = { cy: 0.085, zr: 0.07, zf: -0.29 };
      muzzleZ = -0.342; muzzleY = 0.045; left = [-0.06, 0.03, -0.12];
      break;
    }
    case 'mp18': {
      // MP18: rifle-style wooden stock, round receiver, perforated barrel jacket, side-mounted magazine (left)
      prof(g, [[-0.16, 0.03], [0.04, 0.03], [0.1, 0.022], [0.34, 0.0], [0.342, -0.094], ['q', 0.33, -0.1, 0.315, -0.098], [0.13, -0.034], [0.08, -0.04], [0.04, -0.032], [-0.16, -0.026]], 0.05, M.wood, 0, 0.007);
      prof(g, [[0.34, 0.002], [0.352, 0.002], [0.352, -0.098], [0.34, -0.098]], 0.052, M.dark, 0, 0.003);
      cyl(g, 0.022, 0.28, S, 0, 0.05, -0.02, 16);                                    // receiver
      cyl(g, 0.021, 0.2, M.dark, 0, 0.05, -0.26, 16);                                // barrel jacket
      for (let i = 0; i < 5; i++) for (const a of [0.5, 1.5, 2.6, -0.5, -1.5, -2.6]) box(g, 0.007, 0.003, 0.014, M.black, Math.cos(a) * 0.0208, 0.05 + Math.sin(a) * 0.0208, -0.19 - i * 0.032, 0, 0, a - Math.PI / 2);
      cyl(g, 0.012, 0.03, M.dark, 0, 0.05, -0.375, 12); cyl(g, 0.007, 0.004, M.black, 0, 0.05, -0.391);
      box(g, 0.036, 0.03, 0.05, S, -0.03, 0.05, -0.13);                              // mag housing (left)
      { const mp = magObj = part('mag', -0.05, 0.05, -0.13);
        pbox(mp, 0.16, 0.024, 0.034, M.dark, -0.12, 0.05, -0.13); pbox(mp, 0.008, 0.028, 0.038, M.black, -0.2, 0.05, -0.13); }
      guard(g, 0.04, -0.03);
      { const bp = part('bolt', 0.03, 0.05, 0.04); pbox(bp, 0.018, 0.012, 0.012, M.steel, 0.03, 0.05, 0.04); }
      box(g, 0.026, 0.012, 0.03, M.dark, 0, 0.076, 0.02); box(g, 0.01, 0.022, 0.01, M.dark, 0, 0.074, -0.36);
      sling(g, -0.05, 0.25);
      irons = { cy: 0.094, zr: 0.02, zf: -0.36 };
      muzzleZ = -0.393; muzzleY = 0.05; left = [-0.02, -0.03, -0.2];
      break;
    }
    case 'stg44': {
      // StG 44: stamped steel receiver, long curved 30-round mag, gas cylinder under the barrel, wooden stock
      prof(g, [[0.08, 0.014], [0.08, 0.062], ['q', 0.08, 0.072, 0.07, 0.072], [-0.22, 0.072], [-0.24, 0.05], [-0.24, 0.014]], 0.044, S, 0, 0.005);   // upper
      prof(g, [[0.08, 0.016], [0.08, -0.008], [0.06, -0.014], [-0.06, -0.014], [-0.075, 0.016]], 0.046, S, 0, 0.004);   // trigger housing
      cyl(g, 0.017, 0.2, S, 0, 0.026, -0.34, 14);                                    // gas cylinder
      cyl(g, 0.011, 0.28, M.dark, 0, 0.05, -0.37, 14);                               // barrel
      cyl(g, 0.014, 0.03, M.dark, 0, 0.05, -0.5); cyl(g, 0.0075, 0.004, M.black, 0, 0.05, -0.5155);
      box(g, 0.03, 0.05, 0.03, M.dark, 0, 0.036, -0.45);                             // front sight / gas block
      box(g, 0.05, 0.04, 0.05, S, 0, 0.0, -0.1);                                     // mag well
      magObj = mag(g, -0.1, 0.22, 0.04, 0.028, 0.044, M.dark, -0.012, 0.06);          // long curved mag
      triggerGroup(g, 0.03, M.wood, 0.3, -0.012);
      solidStock(g, 0.08, 0.34, 0.064, 0.05, 0.0, -0.07, M.wood, 0.042);
      box(g, 0.03, 0.016, 0.06, M.dark, 0, 0.078, -0.06);                            // tangent rear sight
      { const bp = part('bolt', -0.03, 0.05, -0.16); pbox(bp, 0.02, 0.01, 0.012, M.steel, -0.03, 0.05, -0.16); }
      seams(g, 0.022, [0.03, 0.06], -0.22, 0.07); rivets(g, 0.022, 0.04, [-0.2, -0.14, 0.05]);
      ejectPort(g, 0.022, 0.05, -0.06, 0.05); sling(g, 0.0, 0.25);
      irons = { cy: 0.1, zr: -0.06, zf: -0.45 };
      optic(0.118, -0.1, 0.085, -0.2, 0.04); spot.side = true;
      under = { y: 0.008, z: -0.32 };
      muzzleZ = -0.518; muzzleY = 0.05; left = [-0.02, -0.02, -0.3];
      break;
    }
    case 'garand': {
      // M1 Garand: long wooden stock and upper handguards, receiver with the op-rod handle on the right,
      // aperture rear sight at the back of the receiver, gas cylinder at the muzzle, en-bloc clip
      prof(g, [[-0.5, 0.03], [-0.04, 0.03], [0.07, 0.024], [0.13, 0.02], [0.4, 0.002], [0.402, -0.1], ['q', 0.39, -0.108, 0.374, -0.106], [0.17, -0.052], [0.12, -0.066], ['q', 0.1, -0.07, 0.09, -0.05], [0.08, -0.032], [-0.06, -0.03], [-0.5, -0.006]], 0.052, M.wood, 0, 0.007);
      prof(g, [[0.399, 0.004], [0.41, 0.004], [0.41, -0.104], [0.399, -0.104]], 0.054, M.dark, 0, 0.003);
      box(g, 0.038, 0.06, 0.2, S, 0, 0.042, 0.0);                                    // receiver
      box(g, 0.036, 0.018, 0.17, M.wood, 0, 0.06, -0.2); box(g, 0.036, 0.018, 0.12, M.wood, 0, 0.06, -0.39);   // upper handguards
      cyl(g, 0.011, 0.42, M.dark, 0, 0.045, -0.4); cyl(g, 0.016, 0.06, M.dark, 0, 0.032, -0.6);   // barrel + gas cylinder
      box(g, 0.054, 0.07, 0.014, M.dark, 0, 0.025, -0.3); box(g, 0.054, 0.06, 0.012, M.dark, 0, 0.03, -0.46);   // bands
      { const bp = part('bolt', 0.024, 0.04, 0.02); pbox(bp, 0.012, 0.016, 0.03, M.steel, 0.026, 0.04, 0.02); pbox(bp, 0.006, 0.006, 0.2, M.dark, 0.022, 0.03, -0.1); }   // op-rod + handle
      { const clip = part('mag', 0, 0.06, -0.01); pbox(clip, 0.024, 0.016, 0.05, M.brass, 0, 0.068, -0.01); for (let i = 0; i < 4; i++) pbox(clip, 0.026, 0.004, 0.012, M.dark, 0, 0.074, -0.03 + i * 0.013); }
      guard(g, 0.06, -0.028);
      box(g, 0.02, 0.026, 0.02, M.dark, 0, 0.062, -0.63);                            // front sight base
      box(g, 0.05, 0.012, 0.09, M.dark, 0, -0.03, 0.02);                             // trigger housing
      sling(g, -0.08, 0.27, 0.024); box(g, 0.02, 0.012, 0.02, M.steel, 0, -0.03, -0.44);
      irons = { cy: 0.098, zr: 0.085, zf: -0.63 };
      optic(0.12, 0.0, 0.08, -0.08, 0.06); spot.side = true;
      muzzleZ = -0.64; muzzleY = 0.045; left = [-0.02, -0.04, -0.32];
      break;
    }
    case 'bar': {
      // BAR M1918: long steel receiver, wooden stock and gas-tube handguard, 20-round box mag, folded bipod, cone flash hider
      box(g, 0.05, 0.064, 0.32, S, 0, 0.04, -0.04);                                  // receiver (-0.2 .. 0.12)
      prof(g, [[-0.2, 0.024], [-0.43, 0.024], ['q', -0.44, 0.024, -0.44, 0.014], [-0.44, -0.012], ['q', -0.44, -0.02, -0.43, -0.02], [-0.2, -0.016]], 0.05, M.wood, 0, 0.006);   // handguard
      for (let z = -0.42; z < -0.22; z += 0.025) box(g, 0.052, 0.03, 0.006, M.black, 0, 0.004, z);
      cyl(g, 0.013, 0.36, M.dark, 0, 0.05, -0.38); cyl(g, 0.017, 0.07, M.black, 0, 0.05, -0.59, 14, 0.012);   // barrel + cone
      cyl(g, 0.012, 0.24, M.dark, 0, 0.02, -0.33);                                   // gas tube
      for (const s of [-1, 1]) box(g, 0.008, 0.008, 0.24, M.dark, s * 0.014, 0.02, -0.4, 0.05);   // folded bipod
      box(g, 0.03, 0.02, 0.02, M.dark, 0, 0.036, -0.52);
      magObj = mag(g, -0.05, 0.12, 0.0, 0.032, 0.07, M.dark, 0.012);
      triggerGroup(g, 0.07, M.wood, 0.25, 0.008);
      solidStock(g, 0.12, 0.4, 0.068, 0.055, 0.012, -0.075, M.wood, 0.044);
      { const bp = part('bolt', -0.03, 0.04, -0.1); pbox(bp, 0.02, 0.014, 0.014, M.steel, -0.032, 0.04, -0.1); }
      box(g, 0.034, 0.016, 0.04, M.dark, 0, 0.078, 0.08); box(g, 0.012, 0.026, 0.012, M.dark, 0, 0.074, -0.56);
      seams(g, 0.025, [0.02, 0.06], -0.18, 0.1); rivets(g, 0.025, 0.04, [-0.18, 0.02, 0.1]);
      ejectPort(g, 0.025, 0.05, -0.04, 0.06); sling(g, -0.02, 0.28);
      irons = { cy: 0.104, zr: 0.08, zf: -0.56 };
      optic(0.12, -0.04, 0.086, -0.15, 0.06); spot.side = true;
      muzzleZ = -0.625; muzzleY = 0.05; left = [-0.02, -0.03, -0.33];
      break;
    }
    case 'mg42': {
      // MG 42: stamped receiver with a hinged top cover, square perforated barrel jacket with an oval side opening,
      // muzzle booster, polymer stock, 50-round drum, folded bipod
      box(g, 0.052, 0.066, 0.28, S, 0, 0.045, -0.02);                                // receiver (-0.16 .. 0.12)
      { const cv = part('cover', 0, 0.08, 0.1); pbox(cv, 0.054, 0.014, 0.2, S, 0, 0.083, 0.0); pbox(cv, 0.034, 0.012, 0.03, M.dark, 0, 0.094, -0.06); }   // top cover (+ rear sight)
      box(g, 0.05, 0.05, 0.4, M.dark, 0, 0.05, -0.36);                               // barrel jacket (-0.56 .. -0.16)
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) box(g, 0.003, 0.016, 0.03, M.black, s * 0.0255, 0.05, -0.2 - i * 0.05);   // oval holes
      for (let i = 0; i < 6; i++) box(g, 0.03, 0.003, 0.03, M.black, 0, 0.0755, -0.2 - i * 0.05);
      box(g, 0.003, 0.03, 0.18, M.black, 0.0255, 0.048, -0.4);                       // barrel change opening
      cyl(g, 0.022, 0.05, M.black, 0, 0.05, -0.585, 14, 0.014);                      // muzzle booster
      for (const s of [-1, 1]) box(g, 0.008, 0.008, 0.26, M.dark, s * 0.018, 0.02, -0.42, 0.05);   // folded bipod
      box(g, 0.05, 0.02, 0.03, M.dark, 0, 0.02, -0.53);
      { const dm = magObj = part('mag', -0.06, 0.02, -0.06);                        // belt drum (left)
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 20), M.dark); drum.rotation.z = Math.PI / 2; drum.position.set(-0.01, -0.02, 0); dm.add(drum);
        pbox(dm, 0.03, 0.03, 0.04, M.dark, -0.035, 0.035, -0.06); }
      triggerGroup(g, 0.06, M.polyBlack, 0.3, 0.012);
      solidStock(g, 0.12, 0.42, 0.074, 0.06, 0.016, -0.06, M.polyBlack, 0.044);
      { const bp = part('bolt', 0.035, 0.045, -0.08); pbox(bp, 0.02, 0.016, 0.02, M.steel, 0.036, 0.045, -0.08); }
      box(g, 0.012, 0.04, 0.012, M.dark, 0, 0.09, -0.53);                            // tall front post base
      seams(g, 0.026, [0.03], -0.15, 0.1); sling(g, 0.0, 0.3);
      irons = { cy: 0.11, zr: -0.06, zf: -0.53 };
      optic(0.125, -0.04, 0.092, -0.14, 0.08);
      muzzleZ = -0.61; muzzleY = 0.05; left = [-0.02, -0.03, -0.06];
      break;
    }
    case 'lewis': {
      // Lewis Gun: fat cooling shroud over the barrel, flat pan magazine on top, wooden stock and grip, bipod
      box(g, 0.05, 0.07, 0.26, S, 0, 0.035, 0.0);                                    // receiver (-0.13 .. 0.13)
      cyl(g, 0.042, 0.44, M.dark, 0, 0.04, -0.35, 22);                               // cooling shroud
      for (let i = 0; i < 4; i++) cyl(g, 0.0435, 0.008, M.black, 0, 0.04, -0.17 - i * 0.12, 22);
      cyl(g, 0.028, 0.05, M.dark, 0, 0.04, -0.59, 18, 0.042);                        // shroud nose
      cyl(g, 0.012, 0.04, M.dark, 0, 0.04, -0.63);
      { const pm = magObj = part('mag', 0, 0.1, -0.02);                             // pan magazine
        const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 26), M.dark); pan.castShadow = true; pm.add(pan);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.036, 12), M.steel); pm.add(hub);
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pbox(pm, 0.01, 0.034, 0.06, M.black, Math.cos(a) * 0.05, 0.1, -0.02 + Math.sin(a) * 0.05, 0, a, 0); } }
      box(g, 0.03, 0.03, 0.03, M.dark, 0, 0.075, -0.02);                             // pan post
      triggerGroup(g, 0.08, M.wood, 0.25, 0.0);
      solidStock(g, 0.13, 0.42, 0.06, 0.05, 0.004, -0.07, M.wood, 0.044);
      for (const s of [-1, 1]) box(g, 0.009, 0.009, 0.28, M.dark, s * 0.026, -0.02, -0.46, 0.09);   // bipod
      { const bp = part('bolt', 0.03, 0.03, 0.04); pbox(bp, 0.02, 0.016, 0.016, M.steel, 0.032, 0.03, 0.04); }
      box(g, 0.012, 0.07, 0.014, M.dark, 0, 0.11, 0.1); box(g, 0.012, 0.07, 0.012, M.dark, 0, 0.11, -0.56);   // tall sight posts (clear the pan)
      sling(g, -0.02, 0.3);
      irons = { cy: 0.15, zr: 0.1, zf: -0.56 };
      muzzleZ = -0.65; muzzleY = 0.04; left = [-0.02, -0.03, -0.3];
      break;
    }
    case 'trench': {
      // M97 trench gun: humpback receiver with exposed hammer, ventilated heat shield over the barrel,
      // tube magazine, ribbed wooden pump, bayonet lug
      prof(g, [[0.07, 0.0], [0.07, 0.05], [0.04, 0.072], [-0.14, 0.072], [-0.15, 0.0]], 0.044, S, 0, 0.005);   // receiver
      box(g, 0.012, 0.02, 0.014, S, 0, 0.068, 0.07, -0.5);                           // hammer
      cyl(g, 0.013, 0.46, M.dark, 0, 0.05, -0.38);                                   // barrel
      prof(g, [[-0.16, 0.074], [-0.5, 0.074], ['q', -0.51, 0.074, -0.51, 0.06], [-0.51, 0.036], [-0.16, 0.036]], 0.036, M.dark, 0, 0.004);   // heat shield
      for (let i = 0; i < 7; i++) for (const s of [-1, 1]) box(g, 0.003, 0.014, 0.022, M.black, s * 0.0185, 0.056, -0.19 - i * 0.045);
      cyl(g, 0.011, 0.36, M.dark, 0, 0.016, -0.32);                                  // tube mag
      { const pp = part('pump', 0, 0.016, -0.24); pcyl(pp, 0.022, 0.14, M.wood, 0, 0.016, -0.24, 14); for (let i = 0; i < 6; i++) pcyl(pp, 0.0225, 0.006, M.black, 0, 0.016, -0.3 + i * 0.022, 14); }
      box(g, 0.02, 0.03, 0.03, M.dark, 0, 0.03, -0.53);                              // bayonet lug
      guard(g, 0.03, 0.0);
      prof(g, [[0.07, 0.05], [0.12, 0.044], [0.36, 0.026], [0.362, -0.08], ['q', 0.35, -0.088, 0.334, -0.086], [0.14, -0.024], [0.07, 0.0]], 0.046, M.wood, 0, 0.007);   // stock
      buttPad(g, 0.044, 0.1, -0.026, 0.37);
      sling(g, -0.03, 0.26);
      irons = { cy: 0.086, zr: 0.03, zf: -0.5 };
      muzzleZ = -0.615; muzzleY = 0.05; left = [-0.01, -0.02, -0.24];
      break;
    }
    case 'enfield': {
      // Lee-Enfield No.4: two-piece wood stock with handguard nearly to the muzzle, 10-round box mag, protected
      // aperture rear sight on the receiver bridge, front blade with ears
      prof(g, [[-0.56, 0.03], [-0.04, 0.03], [0.07, 0.024], [0.12, 0.02], [0.39, 0.002], [0.392, -0.1], ['q', 0.38, -0.108, 0.364, -0.106], [0.17, -0.05], [0.12, -0.064], ['q', 0.1, -0.068, 0.09, -0.05], [0.08, -0.032], [-0.06, -0.03], [-0.56, -0.006]], 0.05, M.wood, 0, 0.007);
      prof(g, [[0.389, 0.004], [0.4, 0.004], [0.4, -0.104], [0.389, -0.104]], 0.052, M.steel, 0, 0.003);
      box(g, 0.034, 0.016, 0.42, M.wood, 0, 0.054, -0.34);                           // full-length upper handguard
      cyl(g, 0.019, 0.22, S, 0, 0.042, -0.02);                                       // receiver
      cyl(g, 0.011, 0.12, M.dark, 0, 0.042, -0.62); cyl(g, 0.016, 0.03, M.dark, 0, 0.042, -0.57);   // muzzle + nose cap
      for (const zz of [-0.25, -0.45]) box(g, 0.054, 0.068, 0.012, M.dark, 0, 0.024, zz);
      box(g, 0.034, 0.05, 0.08, M.dark, 0, -0.034, -0.03);                           // box magazine
      { const bp = part('bolt', 0.02, 0.045, 0.07);
        pcyl(bp, 0.007, 0.07, M.steel, 0.0, 0.045, 0.06); pbox(bp, 0.045, 0.008, 0.008, M.steel, 0.028, 0.04, 0.075, 0, 0, -0.35);
        const kn = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), M.steel); kn.position.set(0.032, -0.012, 0.005); bp.add(kn); }
      guard(g, 0.05, -0.026);
      for (const s of [-1, 1]) box(g, 0.005, 0.024, 0.02, M.dark, s * 0.012, 0.075, 0.08);   // rear sight protectors
      box(g, 0.02, 0.022, 0.02, M.dark, 0, 0.06, -0.63);
      for (const s of [-1, 1]) box(g, 0.004, 0.02, 0.012, M.dark, s * 0.009, 0.076, -0.63);   // front sight ears
      sling(g, -0.08, 0.26, 0.024);
      irons = { cy: 0.09, zr: 0.08, zf: -0.63 };
      optic(0.112, -0.05, 0.077, -0.14, 0.04); spot.side = true;
      muzzleZ = -0.682; muzzleY = 0.042; left = [-0.02, -0.04, -0.34];
      break;
    }

    case 'annihilator': {
      // prototype rail rifle: angular armoured receiver, twin rails wrapped in glowing coils, energy-cell mag, skeleton stock
      prof(g, [[0.1, 0.0], [0.1, 0.085], [0.05, 0.1], [-0.3, 0.1], [-0.34, 0.08], [-0.34, 0.0], [-0.3, -0.02], [0.06, -0.02]], 0.07, S, 0, 0.008);   // receiver
      prof(g, [[0.0, 0.07], [-0.26, 0.07], [-0.26, 0.05], [0.0, 0.05]], 0.0715, M.black, 0, 0.002);   // side groove
      for (const s of [-1, 1]) {
        box(g, 0.004, 0.014, 0.24, M.plasma, s * 0.036, 0.06, -0.13);              // glowing side strips
        for (let z = -0.28; z < 0.06; z += 0.04) box(g, 0.006, 0.006, 0.006, M.steel, s * 0.036, 0.088, z);   // rivets
        for (let z = -0.25; z < -0.05; z += 0.018) box(g, 0.004, 0.03, 0.008, M.black, s * 0.0365, 0.018, z);   // cooling slots
      }
      // twin rails with coils between two armoured shrouds
      for (const y of [0.065, 0.02]) box(g, 0.022, 0.012, 0.42, M.steel, 0, y, -0.55);
      cyl(g, 0.008, 0.42, M.plasmaCore, 0, 0.0425, -0.55, 10);                     // charge core between the rails
      for (let i = 0; i < 9; i++) {
        const z = -0.38 - i * 0.038;
        box(g, 0.05, 0.062, 0.012, M.dark, 0, 0.0425, z);                           // coil frame
        box(g, 0.054, 0.012, 0.014, M.plasma, 0, 0.0425, z);                        // glowing coil band
      }
      box(g, 0.06, 0.08, 0.05, S, 0, 0.0425, -0.78);                                // muzzle block
      box(g, 0.062, 0.016, 0.052, M.plasma, 0, 0.0425, -0.78);
      for (let i = 0; i < 3; i++) box(g, 0.064, 0.006, 0.006, M.black, 0, 0.012 + i * 0.03, -0.8);   // vents
      cyl(g, 0.014, 0.012, M.plasmaCore, 0, 0.0425, -0.807, 12);                    // emitter
      // energy cell magazine (glowing window) + pistol grip
      magObj = mag(g, -0.12, 0.12, 0.05, 0.036, 0.06, M.dark, -0.02, 0.0);
      box(magObj, 0.038, 0.06, 0.03, M.plasma, 0, -0.06, 0);                       // glowing cell window (moves with the mag)
      triggerGroup(g, 0.03, M.grip, 0.3, -0.02);
      // skeleton stock
      prof(g, [[0.1, 0.085], [0.34, 0.07], [0.36, 0.06], [0.36, -0.04], [0.33, -0.04], [0.2, 0.0], [0.1, 0.0]], 0.04, M.dark, 0, 0.006, [[[0.15, 0.06], [0.3, 0.052], [0.3, 0.0], [0.2, 0.02], [0.15, 0.02]]]);
      box(g, 0.003, 0.012, 0.18, M.plasma, 0.0205, 0.06, 0.24);
      buttPad(g, 0.044, 0.1, 0.022, 0.37);
      rail(g, 0.101, -0.3, 0.06);
      irons = { cy: 0.124, zr: 0.04, zf: -0.3 };
      optic(0.135, -0.12, 0.105, -0.29, 0.05);
      under = { y: 0.0, z: -0.45 };
      muzzleZ = -0.82; muzzleY = 0.0425; left = [-0.02, -0.03, -0.42];
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
  // attachment camo (att.attSkin): 'black' (default), 'match' (same finish as the gun) or any weapon camo
  const attMat = att.attSkin && att.attSkin !== 'black' ? (att.attSkin === 'match' ? S : weaponSkinMaterial(att.attSkin)) : null;
  if (attMat) { M.dark = attMat; M.grip = attMat; }
  let opticKind = 'none', scoped = false;
  const want = att.optic || att.defOptic || (spot ? 'reddot' : 'none');
  if (want === 'irons' || (irons && (want === 'none' || !spot))) {
    if (irons) { ironSights(g, irons.cy, irons.zr, irons.zf, M.dotGreen, att.irons); sightY = irons.cy - 0.002; opticKind = 'irons'; }
    else if (spot) { // flip-up backup irons on the rail
      const cy = spot.railY + 0.026;
      for (const zz of [spot.rz1 - 0.02, spot.rz0 + 0.02]) box(g, 0.02, 0.016, 0.012, M.dark, 0, spot.railY + 0.012, zz);
      ironSights(g, cy, spot.rz1 - 0.02, spot.rz0 + 0.02, M.dotGreen, att.irons || 'aperture'); sightY = cy - 0.002; opticKind = 'irons';
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
  M.dark = M_DARK; M.grip = M_GRIP;
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
  g.userData = { ...g.userData, muzzle, sightY, adsZ, left, skin: S, parts, optic: opticKind, scoped,
    anchors: { optic: spot ? [0, spot.y, spot.z] : irons ? [0, irons.cy, (irons.zr + irons.zf) / 2] : null, under: under ? [0, under.y, under.z] : null } };
  return g;
}
// Weapon model for a weapon definition (applies its default sight unless an attachment overrides it).
export function buildWeapon(def, skinId, att = {}) { return buildGun(def.model, skinId, { defOptic: def.optic, irons: def.irons, ...att }); }

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
    // mixed primitives (indexed boxes/cylinders + non-indexed extrusions): merge everything as non-indexed
    let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    geo = geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
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
