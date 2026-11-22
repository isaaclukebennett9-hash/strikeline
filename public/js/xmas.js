// Christmas Update: snow on every map. Falling snow (stops under roofs), snow lying on the ground in drifts and patches,
// snow caps on every roof, wall and crate top, fairy lights along the roof edges and a few decorated Christmas trees.
// Everything here is visual only (no collision), so it can be switched off in Settings without touching gameplay.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
// value noise for the snow patches
const h2 = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = h2(i, j), b = h2(i + 1, j), c = h2(i, j + 1), d = h2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------------------------------------------------------------- height field: the highest thing above each 25 cm cell
function heightField(map, skip) {
  const half = map.size / 2 + 3, n = Math.min(768, Math.ceil(half * 2 / 0.25)), cell = half * 2 / n;
  const top = new Float32Array(n * n).fill(-1), wet = new Uint8Array(n * n);
  for (const b of map.boxes.concat(map.deco || [])) {
    const i0 = Math.max(0, Math.ceil((b.min[0] + half) / cell - 0.5)), i1 = Math.min(n - 1, Math.floor((b.max[0] + half) / cell - 0.5));
    const j0 = Math.max(0, Math.ceil((b.min[2] + half) / cell - 0.5)), j1 = Math.min(n - 1, Math.floor((b.max[2] + half) / cell - 0.5));
    if (i1 < i0 || j1 < j0) continue;
    const y = b.max[1], sk = skip(b.m);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * n + i; if (y > top[k]) top[k] = y; if (sk) wet[k] = 1; }
  }
  const at = (x, z) => { const i = Math.floor((x + half) / cell), j = Math.floor((z + half) / cell); return i < 0 || j < 0 || i >= n || j >= n ? -1 : top[j * n + i]; };
  return { n, cell, half, top, wet, at };
}

function snowMaterial() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 128);
  const r = rng(5);
  for (let i = 0; i < 900; i++) { const v = 228 + r() * 27 | 0; x.fillStyle = `rgb(${v - 6},${v - 2},${v})`; x.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.userData.own = true;
  return new THREE.MeshStandardMaterial({ color: '#e6edf6', map: t, roughness: 0.85, metalness: 0, emissive: new THREE.Color('#1c2430'), emissiveIntensity: 0.15 });
}

// ---------------------------------------------------------------- snow caps on top of everything that's open to the sky
function buildCaps(map, hf, skip, mat, group, shadows) {
  const geos = [], roofs = [];
  const colliders = new Set(map.boxes), { n, cell, half, top } = hf;
  const slab = (x0, x1, z0, z1, y, t) => { // a soft two-layer slab of snow on the rectangle
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ins = Math.min(Math.min(w, d) * 0.14, 0.3);
    geos.push(new THREE.BoxGeometry(w + 0.02, t * 0.6, d + 0.02).translate(cx, y + 0.003 + t * 0.3, cz));
    if (w - 2 * ins > 0.04 && d - 2 * ins > 0.04) geos.push(new THREE.BoxGeometry(w - 2 * ins, t * 0.55, d - 2 * ins).translate(cx, y + t * 0.6 + t * 0.27, cz));
  };
  for (const b of map.boxes.concat(map.deco || [])) {
    const y = b.max[1], w = b.max[0] - b.min[0], d = b.max[2] - b.min[2];
    if (y < 0.1 || w < 0.06 || d < 0.06 || skip(b.m)) continue;
    const t = clamp(Math.min(w, d) * 0.1, 0.035, 0.12);
    const i0 = Math.max(0, Math.ceil((b.min[0] + half) / cell - 0.5)), i1 = Math.min(n - 1, Math.floor((b.max[0] + half) / cell - 0.5));
    const j0 = Math.max(0, Math.ceil((b.min[2] + half) / cell - 0.5)), j1 = Math.min(n - 1, Math.floor((b.max[2] + half) / cell - 0.5));
    if (i1 < i0 || j1 < j0 || (i1 - i0 < 2 && j1 - j0 < 2)) { // too small for the grid: all or nothing
      const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      if (hf.at(cx, cz) <= y + 0.05) slab(b.min[0], b.max[0], b.min[2], b.max[2], y, t);
      continue;
    }
    // cover only the parts of the top that are open to the sky: rows of open cells, stacked into rectangles
    let openCells = 0, prev = null;
    const flush = r => { if (!r) return; const x0 = r.a === i0 ? b.min[0] : -half + r.a * cell, x1 = r.b === i1 ? b.max[0] : -half + (r.b + 1) * cell, z0 = r.j0 === j0 ? b.min[2] : -half + r.j0 * cell, z1 = r.j1 === j1 ? b.max[2] : -half + (r.j1 + 1) * cell; if (x1 - x0 > 0.05 && z1 - z0 > 0.05) slab(x0, x1, z0, z1, y, Math.min(t, clamp(Math.min(x1 - x0, z1 - z0) * 0.1, 0.035, 0.12))); };
    let open = new Map();
    for (let j = j0; j <= j1; j++) {
      const runs = new Map();
      for (let i = i0; i <= i1; i++) {
        if (top[j * n + i] > y + 0.05) continue;
        let e = i; while (e + 1 <= i1 && top[j * n + e + 1] <= y + 0.05) e++;
        runs.set(i + ',' + e, { a: i, b: e }); openCells += e - i + 1; i = e;
      }
      const next = new Map();
      for (const [k, r] of runs) { const o = open.get(k); if (o) { o.j1 = j; next.set(k, o); open.delete(k); } else next.set(k, { ...r, j0: j, j1: j }); }
      for (const o of open.values()) flush(o);
      open = next;
    }
    for (const o of open.values()) flush(o);
    if (y > 2.4 && y < 40 && w >= 2 && d >= 2 && colliders.has(b) && openCells > (i1 - i0 + 1) * (j1 - j0 + 1) * 0.5) roofs.push(b);
  }
  for (let i = 0; i < geos.length; i += 4000) { // merge in chunks so no single buffer gets huge
    const chunk = geos.slice(i, i + 4000), g = mergeGeometries(chunk, false);
    chunk.forEach(x => x.dispose());
    const uv = g.attributes.uv, p = g.attributes.position; // world-space UVs so the sparkle texture doesn't stretch
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (p.getX(k) + p.getY(k)) * 0.5, (p.getZ(k) + p.getY(k)) * 0.5);
    const m = new THREE.Mesh(g, mat); m.castShadow = shadows; m.receiveShadow = true; group.add(m);
  }
  return roofs;
}

// ---------------------------------------------------------------- ground: patchy snow cover, heavier against walls, plus drifts
function buildGround(map, hf, mat, group, r) {
  const { n, cell, half, top, wet } = hf;
  // how much tall wall is near each cell (summed-area table over a ~1.5 m radius) so snow piles up against walls
  const tall = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j < n; j++) { let row = 0; for (let i = 0; i < n; i++) { row += top[j * n + i] > 1.2 ? 1 : 0; tall[(j + 1) * (n + 1) + i + 1] = tall[j * (n + 1) + i + 1] + row; } }
  const R = Math.max(2, Math.round(1.5 / cell));
  const near = (i, j) => { const a = Math.max(0, i - R), b = Math.max(0, j - R), c = Math.min(n, i + R + 1), d = Math.min(n, j + R + 1); return (tall[d * (n + 1) + c] - tall[b * (n + 1) + c] - tall[d * (n + 1) + a] + tall[b * (n + 1) + a]) / ((c - a) * (d - b)); };
  const cv = document.createElement('canvas'); cv.width = cv.height = n;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(n, n), px = img.data;
  const drifts = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, o = k * 4, x = -half + (i + 0.5) * cell, z = -half + (j + 0.5) * cell;
    let a = 0, edge = 0;
    if (top[k] <= 0.08 && !wet[k]) {
      const nw = near(i, j);
      const c = vnoise(x * 0.16, z * 0.16) * 0.62 + vnoise(x * 0.55 + 31, z * 0.55 + 17) * 0.26 + vnoise(x * 2.1, z * 2.1) * 0.12 + Math.min(1, nw * 2.6) * 0.42;
      a = smooth(0.5, 0.56, c); edge = smooth(0.5, 0.7, c);
      if (nw > 0.08 && nw < 0.4 && c > 0.66 && (i + j * 7) % 23 === 0 && r() < 0.5) drifts.push([x, z]);
    }
    const v = 236 - (1 - edge) * 42 - (vnoise(x * 1.3, z * 1.3) * 12);
    px[o] = v - 5; px[o + 1] = v - 2; px[o + 2] = Math.min(255, v + 2); px[o + 3] = a * 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.userData.own = true; tex.anisotropy = 4;
  const gm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.85, metalness: 0, emissive: new THREE.Color('#1c2430'), emissiveIntensity: 0.12, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2), gm);
  plane.rotation.x = -Math.PI / 2; plane.position.y = 0.05; plane.receiveShadow = true; plane.renderOrder = 1;
  group.add(plane);
  // drifts: low, soft mounds of snow banked up near walls
  if (drifts.length) {
    const list = drifts.sort(() => r() - 0.5).slice(0, 260);
    const geo = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const im = new THREE.InstancedMesh(geo, mat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    list.forEach(([x, z], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI);
      s.set(0.7 + r() * 1.3, 0.12 + r() * 0.22, 0.45 + r() * 0.7); p.set(x, 0.02, z);
      im.setMatrixAt(i, m4.compose(p, q, s));
    });
    im.receiveShadow = true; group.add(im);
  }
}

// ---------------------------------------------------------------- fairy lights along roof edges
const BULB_COLS = ['#ff3b3b', '#3bff6a', '#ffd23b', '#3bb8ff'];
function buildLights(roofs, group, r) {
  const pts = [[], [], [], []];
  let total = 0;
  for (const b of roofs) total += 2 * ((b.max[0] - b.min[0]) + (b.max[2] - b.min[2]));
  const gap = Math.max(0.42, total / 3200);
  for (const b of roofs) {
    const y = b.max[1] - 0.07, o = 0.05, x0 = b.min[0] - o, x1 = b.max[0] + o, z0 = b.min[2] - o, z1 = b.max[2] + o;
    const edges = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
    let k = (r() * 4) | 0;
    for (const [ax, az, bx, bz] of edges) {
      const len = Math.hypot(bx - ax, bz - az), cnt = Math.floor(len / gap);
      for (let i = 0; i < cnt; i++) { const t = (i + 0.5) / cnt; pts[k++ % 4].push([ax + (bx - ax) * t, y - Math.sin(t * cnt * Math.PI) * 0.0 - (i % 2) * 0.05, az + (bz - az) * t]); }
    }
  }
  const geo = new THREE.SphereGeometry(0.045, 8, 6), mats = [], m4 = new THREE.Matrix4();
  pts.forEach((list, c) => {
    if (!list.length) return;
    const mat = new THREE.MeshBasicMaterial({ color: BULB_COLS[c] }); mat.userData.base = new THREE.Color(BULB_COLS[c]); mat.userData.phase = c * 1.7;
    const im = new THREE.InstancedMesh(c ? geo.clone() : geo, mat, list.length);
    list.forEach((p, i) => im.setMatrixAt(i, m4.makeTranslation(p[0], p[1], p[2])));
    group.add(im); mats.push(mat);
  });
  return mats;
}

// ---------------------------------------------------------------- Christmas trees with baubles, a star and presents
function makeTree(r, snowMat) {
  const g = new THREE.Group(), std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
  const add = (geo, mat, x = 0, y = 0, z = 0, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const pine = std('#1f5a32', { roughness: 0.85 }), dark = std('#173f25', { roughness: 0.9 });
  add(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 10), std('#5a3a22', { roughness: 0.95 }), 0, 0.3);
  add(new THREE.CylinderGeometry(0.42, 0.5, 0.18, 12), std('#8c1a1a'), 0, 0.09);                // tub
  const tiers = [[1.25, 1.2, 0.75], [1.0, 1.05, 1.45], [0.75, 0.9, 2.05], [0.48, 0.75, 2.6]];
  tiers.forEach(([rad, h, y], i) => {
    add(new THREE.ConeGeometry(rad, h, 14), i % 2 ? dark : pine, 0, y, 0, i * 0.4);
    const k = 0.38 * 1.05; add(new THREE.ConeGeometry(rad * k, h * k, 14), snowMat, 0, y + h / 2 - h * k / 2 + 0.01, 0, i * 0.4); // snow on the tip
    for (let k = 0; k < 8; k++) { // baubles round the bottom of each tier
      const a = k / 8 * Math.PI * 2 + i, rr = rad * 0.86, col = ['#d4142a', '#f2c14e', '#2f7bff', '#e8e8f0', '#b45cff'][(k + i) % 5];
      add(new THREE.SphereGeometry(0.06 - i * 0.008, 10, 8), std(col, { roughness: 0.15, metalness: 0.7 }), Math.cos(a) * rr, y - h * 0.42, Math.sin(a) * rr);
    }
  });
  // glowing light strand spiralling round the tree
  const bulbGeo = new THREE.SphereGeometry(0.03, 6, 5), bulbMats = BULB_COLS.map(c => new THREE.MeshBasicMaterial({ color: c }));
  for (let k = 0; k < 46; k++) {
    const t = k / 46, y = 0.35 + t * 2.4, rad = 1.2 * (1 - t) + 0.12, a = t * Math.PI * 7;
    add(k ? bulbGeo.clone() : bulbGeo, bulbMats[k % 4], Math.cos(a) * rad, y, Math.sin(a) * rad);
  }
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? 0.09 : 0.2; i ? star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  add(new THREE.ExtrudeGeometry(star, { depth: 0.04, bevelEnabled: false }).translate(0, 0, -0.02), new THREE.MeshStandardMaterial({ color: '#fff1a8', emissive: new THREE.Color('#ffd23b'), emissiveIntensity: 2.5 }), 0, 3.1);
  // presents round the base
  const cols = [['#c8102e', '#f2c14e'], ['#1d6b3a', '#f4efe4'], ['#2f5bd0', '#e8e8f0'], ['#f2c14e', '#c8102e'], ['#7a2fbf', '#f2c14e']];
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2 + r(), d = 0.85 + r() * 0.35, w = 0.28 + r() * 0.22, h = 0.2 + r() * 0.2, [c1, c2] = cols[k];
    const pg = new THREE.Group(); pg.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); pg.rotation.y = r() * Math.PI; g.add(pg);
    const box = (bw, bh, bd, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), std(c, { roughness: 0.45 })); m.castShadow = true; pg.add(m); return m; };
    box(w, h, w, c1); box(w + 0.01, h + 0.01, 0.05, c2); box(0.05, h + 0.01, w + 0.01, c2);
    for (const s of [-1, 1]) { const loop = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 10), std(c2, { roughness: 0.45 })); loop.position.set(s * 0.04, h / 2 + 0.03, 0); loop.rotation.set(0, Math.PI / 2, s * 0.6); pg.add(loop); }
  }
  return g;
}
function placeTrees(map, hf, group, r, snowMat) {
  const half = map.size / 2 - 3, want = map.size > 120 ? 4 : map.size > 60 ? 3 : 1, cands = [];
  const clear = (x, z, rad) => { for (let dx = -rad; dx <= rad; dx += 0.5) for (let dz = -rad; dz <= rad; dz += 0.5) if (hf.at(x + dx, z + dz) > 0.08) return false; return true; };
  for (let x = -half; x <= half; x += 2) for (let z = -half; z <= half; z += 2) {
    if (!clear(x, z, 1.5)) continue;
    let wall = false; for (const [dx, dz] of [[2.6, 0], [-2.6, 0], [0, 2.6], [0, -2.6]]) if (hf.at(x + dx, z + dz) > 2.5) wall = true;
    if (!wall) continue;
    if ((map.spawns || []).some(s => Math.hypot(s[0] - x, s[2] - z) < 4.5)) continue;
    if ((map.pickups || []).some(p => Math.hypot(p.x - x, p.z - z) < 3)) continue;
    cands.push([x, z]);
  }
  if (!cands.length) return;
  const picked = [cands.reduce((a, c) => (Math.hypot(c[0], c[1]) < Math.hypot(a[0], a[1]) ? c : a))];
  while (picked.length < Math.min(want, cands.length)) {
    let best = null, bd = -1;
    for (const c of cands) { let md = Infinity; for (const p of picked) md = Math.min(md, Math.hypot(c[0] - p[0], c[1] - p[1])); if (md > bd) { bd = md; best = c; } }
    if (bd < 12) break;
    picked.push(best);
  }
  for (const [x, z] of picked) { const t = makeTree(r, snowMat); t.position.set(x, 0, z); t.rotation.y = r() * Math.PI * 2; group.add(t); }
}

// ---------------------------------------------------------------- falling snow (GPU animated, hidden under roofs)
function buildSnowfall(hf, count) {
  const pos = new Float32Array(count * 3), size = new Float32Array(count), seed = new Float32Array(count), r = rng(99);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (r() - 0.5) * 70; pos[i * 3 + 1] = r() * 32; pos[i * 3 + 2] = (r() - 0.5) * 70;
    size[i] = r() < 0.08 ? 0.09 + r() * 0.05 : 0.035 + r() * 0.04; seed[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const tex = new THREE.DataTexture(hf.top, hf.n, hf.n, THREE.RedFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uTop: { value: tex }, uHalf: { value: hf.half }, uScale: { value: 500 } },
    vertexShader: `
      uniform float uTime, uHalf, uScale; uniform vec3 uCam; uniform sampler2D uTop;
      attribute float aSize, aSeed; varying float vA;
      void main() {
        float t = uTime;
        vec3 p;
        p.y = mod(position.y - t * (1.0 + aSeed * 0.9), 32.0) + uCam.y - 10.0;
        p.x = position.x + sin(t * (0.5 + aSeed) + aSeed * 40.0) * 0.5 + t * 0.35;
        p.z = position.z + cos(t * (0.4 + aSeed * 0.7) + aSeed * 23.0) * 0.4 + t * 0.12;
        p.x = uCam.x + mod(p.x - uCam.x + 35.0, 70.0) - 35.0;
        p.z = uCam.z + mod(p.z - uCam.z + 35.0, 70.0) - 35.0;
        vec2 uv = (p.xz + uHalf) / (2.0 * uHalf);
        vA = 1.0;
        if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0 && p.y < max(texture2D(uTop, uv).r, 0.0)) vA = 0.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        vA *= smoothstep(48.0, 26.0, d) * smoothstep(0.25, 1.0, d);
        gl_PointSize = vA > 0.0 ? max(1.0, aSize * uScale / d) : 0.0;
      }`,
    fragmentShader: `
      varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0), smoothstep(0.5, 0.1, d) * vA * 0.92); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 2;
  return { pts, mat, tex };
}

// ---------------------------------------------------------------- public: build it all for a map
export function buildXmas(map, { fall = true, ground = true, skip = () => false, flakes = 7000, shadows = true } = {}) {
  const group = new THREE.Group(); group.name = 'xmas';
  const hf = heightField(map, skip), r = rng(hashStr(map.id));
  let snowfall = null, bulbs = [];
  if (ground) {
    const mat = snowMaterial();
    const roofs = buildCaps(map, hf, skip, mat, group, shadows);
    buildGround(map, hf, mat, group, r);
    bulbs = buildLights(roofs, group, r);
    placeTrees(map, hf, group, r, mat);
  }
  if (fall) { snowfall = buildSnowfall(hf, flakes); group.add(snowfall.pts); }
  return {
    group,
    update(t, cam, pxScale) {
      if (snowfall) { const u = snowfall.mat.uniforms; u.uTime.value = t; u.uCam.value.copy(cam); u.uScale.value = pxScale; }
      for (const m of bulbs) { const k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.1 + m.userData.phase)) ** 2; m.color.copy(m.userData.base).multiplyScalar(k); }
    },
    dispose() { snowfall?.tex.dispose(); },
  };
}

// ---------------------------------------------------------------- one-off effects: present confetti, snowball splats
const fxList = [];
let dotTex = null;
const roundDot = () => dotTex || (dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, '#fff'); g.addColorStop(0.6, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })());
function burst(scene, p, count, colors, speed, up, size, life, round = false) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), vel = [];
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    pos.set(p, i * 3);
    c.set(colors[i % colors.length]); col.set([c.r, c.g, c.b], i * 3);
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    vel.push([Math.cos(a) * s, up * (0.4 + Math.random()), Math.sin(a) * s]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, map: round ? roundDot() : null }));
  m.frustumCulled = false; scene.add(m);
  fxList.push({ m, vel, t: 0, life, scene });
}
export function confettiBurst(scene, p) { burst(scene, p, 220, ['#ff3b3b', '#3bff6a', '#ffd23b', '#3bb8ff', '#ff5bd6', '#ffffff'], 9, 7, 0.09, 2.2); }
export function snowSplat(scene, p) { burst(scene, p, 70, ['#ffffff', '#eaf3ff', '#dfe9f5'], 3.5, 3, 0.09, 0.9, true); }
export function updateXmasFx(dt) {
  for (let i = fxList.length - 1; i >= 0; i--) {
    const f = fxList[i]; f.t += dt;
    const a = f.m.geometry.attributes.position;
    for (let k = 0; k < f.vel.length; k++) {
      const v = f.vel[k]; v[1] -= 9 * dt; v[0] *= 0.985; v[2] *= 0.985;
      if (f.life > 1.5) { v[1] = Math.max(v[1], -1.6); v[0] += Math.sin(f.t * 6 + k) * dt * 2; } // confetti flutters down
      a.setXYZ(k, a.getX(k) + v[0] * dt, Math.max(0.03, a.getY(k) + v[1] * dt), a.getZ(k) + v[2] * dt);
    }
    a.needsUpdate = true;
    f.m.material.opacity = clamp((f.life - f.t) / 0.5, 0, 1);
    if (f.t >= f.life) { f.scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); fxList.splice(i, 1); }
  }
}
