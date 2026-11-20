// Terrain maps: real hills instead of a flat floor. The ground is a height field built from 3 m columns whose
// heights step by at most 0.5 m between neighbours, so players and bots can walk up any slope (step-up is 0.55 m).
// Steeper spots are dressed as rock outcrops. The map exposes ground(x, z) so spawns and pickups sit on the hills.
import { R, B, push, newCtx, building, crate, sandbags, barrel, mulberry, FH } from './mapkit.js';

const CELL = 3, STEP = 0.5;

function heightField(size, fn, flats) {
  const n = Math.ceil(size / CELL), half = size / 2, H = [];
  for (let i = 0; i < n; i++) { H.push([]); for (let j = 0; j < n; j++) { const x = -half + (i + 0.5) * CELL, z = -half + (j + 0.5) * CELL; H[i].push(Math.max(0, Math.round(fn(x, z) / STEP) * STEP)); } }
  // flatten pads for buildings / the river (height 0 or a set level)
  for (const f of flats) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -half + (i + 0.5) * CELL, z = -half + (j + 0.5) * CELL;
    if (Math.abs(x - f.x) <= f.w / 2 + CELL * 0.5 && Math.abs(z - f.z) <= f.d / 2 + CELL * 0.5) H[i][j] = f.h ?? 0;
  }
  // limit slopes: no column more than one step above any neighbour (repeat until stable), so everything is walkable
  for (let it = 0; it < 60; it++) {
    let changed = false;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      let m = Infinity;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = H[i + di]?.[j + dj]; if (a !== undefined) m = Math.min(m, a); }
      if (H[i][j] > m + STEP) { H[i][j] = m + STEP; changed = true; }
    }
    if (!changed) break;
  }
  return { H, n, half };
}

// pine tree standing on height y
function pine(c, x, z, y, s = 1) {
  push(c.boxes, R(x - 0.2 * s, y, z - 0.2 * s, x + 0.2 * s, y + 2.2 * s, z + 0.2 * s, 'wood'));
  for (let k = 0; k < 4; k++) { const w = (2.6 - k * 0.55) * s, y0 = y + (1.6 + k * 1.05) * s; push(c.deco, R(x - w / 2, y0, z - w / 2, x + w / 2, y0 + 1.1 * s, z + w / 2, 'leaves')); }
  push(c.deco, R(x - 0.3 * s, y + 5.8 * s, z - 0.3 * s, x + 0.3 * s, y + 6.5 * s, z + 0.3 * s, 'leaves'));
}
function boulder(c, x, z, y, s, rnd) {
  push(c.boxes, R(x - 1.1 * s, y, z - 0.9 * s, x + 1.1 * s, y + 1.1 * s, z + 0.9 * s, 'rock_grey'));
  push(c.boxes, R(x - 0.7 * s + rnd() * 0.3, y + 1.1 * s, z - 0.6 * s, x + 0.6 * s, y + 1.6 * s, z + 0.5 * s, 'rock_grey'));
}

export function ridgeline() {
  const c = newCtx(), rnd = mulberry(424242), size = 164;
  const hill = (x, z, cx, cz, r, h) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r));
  // river valley running diagonally; hills on either side; a long ridge in the north-west
  const riverD = (x, z) => Math.abs((x - z * 0.55) - 8) / Math.hypot(1, 0.55);
  const fn = (x, z) => {
    let h = hill(x, z, -40, -38, 20, 8.5) + hill(x, z, 42, 36, 22, 9) + hill(x, z, 48, -46, 14, 6) + hill(x, z, -50, 44, 16, 5.5)
      + hill(x, z, 4, 58, 12, 4) + hill(x, z, -6, -62, 12, 4.5);
    h += 6 * Math.exp(-(((x + z) / Math.SQRT2 + 30) ** 2) / 120) * (Math.abs(x - z) < 120 ? 1 : 0) * Math.max(0, 1 - Math.abs((x - z) / Math.SQRT2 + 10) / 70);   // NW ridge
    h *= Math.min(1, riverD(x, z) / 18);                                              // valley floor near the river
    return h;
  };
  const flats = [
    { x: 14, z: -20, w: 22, d: 18 },   // farm in the valley
    { x: -4, z: 26, w: 16, d: 12 },    // barn
  ];
  const { H, n, half } = heightField(size, fn, flats);
  const ground = (x, z) => { const i = Math.floor((x + half) / CELL), j = Math.floor((z + half) / CELL); return H[i]?.[j] ?? 0; };
  // terrain columns, merged along x where heights match; grass on top layers, rock deeper down on high ground
  for (let j = 0; j < n; j++) {
    let i = 0;
    while (i < n) {
      const h = H[i][j]; let k = i + 1;
      while (k < n && H[k][j] === h) k++;
      if (h > 0) {
        const x0 = -half + i * CELL, x1 = -half + k * CELL, z0 = -half + j * CELL, z1 = z0 + CELL;
        if (h > 2.5) { push(c.boxes, R(x0, 0, z0, x1, h - 1, z1, 'rock_grey')); push(c.boxes, R(x0, h - 1, z0, x1, h, z1, 'grass')); }
        else push(c.boxes, R(x0, 0, z0, x1, h, z1, h > 1.5 ? 'grass' : 'grass'));
      }
      i = k;
    }
  }
  // river: water strip along the valley with a stone bed edge, crossed by a wooden bridge and stepping stones
  for (let t = -half + 2; t < half - 2; t += 3) {
    const z = t, x = 8 * Math.hypot(1, 0.55) + z * 0.55;
    if (Math.abs(x) > half - 3) continue;
    push(c.deco, R(x - 2.2, 0, z - 1.6, x + 2.2, 0.06, z + 1.6, 'water'));
  }
  const bx = 9 + 2 * 0.55, bz = 2;                                                    // bridge (low, walkable over the water)
  push(c.boxes, R(bx - 3.5, 0, bz - 1.4, bx + 3.5, 0.35, bz + 1.4, 'wood'));
  for (const s of [-1, 1]) for (let x = bx - 3.2; x <= bx + 3.2; x += 1.6) push(c.deco, R(x - 0.08, 0.35, bz + s * 1.3 - 0.08, x + 0.08, 1.3, bz + s * 1.3 + 0.08, 'wood'));
  for (const s of [-1, 1]) push(c.deco, R(bx - 3.5, 1.2, bz + s * 1.3 - 0.06, bx + 3.5, 1.32, bz + s * 1.3 + 0.06, 'wood'));
  for (const [x, z] of [[-14, -38], [-12.5, -36], [30, 38], [31.8, 40]]) push(c.boxes, R(x - 0.6, 0, z - 0.6, x + 0.6, 0.3, z + 0.6, 'rock_grey'));
  // farm: farmhouse, fenced yard, hay bales, tractor-ish trailer
  building(c, { x: 14, z: -24, w: 10, d: 8, floors: 2, m: 'plaster_white', doors: { s: [-2], e: [0] }, floorM: 'floor_wood', roofM: 'roof_red' });
  for (let x = 4; x <= 24; x += 2.5) { push(c.deco, R(x - 0.08, 0, -13.1, x + 0.08, 1.1, -12.9, 'wood')); }
  push(c.deco, R(4, 0.75, -13.06, 24, 0.9, -12.94, 'wood')); push(c.deco, R(4, 0.35, -13.06, 24, 0.5, -12.94, 'wood'));
  for (const [x, z] of [[8, -16], [9.4, -16], [8.7, -14.6], [20, -16]]) push(c.boxes, R(x - 0.6, 0, z - 0.6, x + 0.6, 1.0, z + 0.6, 'mudroof'));
  crate(c, 22, -18); barrel(c, 6, -20, 'barrel_red');
  // barn
  building(c, { x: -4, z: 26, w: 12, d: 9, floors: 1, fh: 5.2, m: 'wood', doors: { s: [{ c: 0, w: 3.2, h: 3.6 }], e: [0] }, floorM: 'floor_wood' });
  for (const [x, z] of [[-8, 33], [-6.8, 33], [3, 33]]) push(c.boxes, R(x - 0.6, 0, z - 0.6, x + 0.6, 1.0, z + 0.6, 'mudroof'));
  // hilltop watchtower on the north-east hill (stairs inside a frame)
  {
    const tx = 42, tz = 36, g = ground(tx, tz), th = 6;
    for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) push(c.boxes, R(tx + dx - 0.18, g, tz + dz - 0.18, tx + dx + 0.18, g + th, tz + dz + 0.18, 'wood'));
    push(c.boxes, R(tx - 2, g + th, tz - 2, tx + 2, g + th + 0.25, tz + 2, 'wood'));
    for (const [x0, z0, x1, z1] of [[-2, -2, 2, -1.85], [-2, 1.85, 2, 2], [-2, -2, -1.85, 2], [1.85, -0.6, 2, 2]]) push(c.boxes, R(tx + x0, g + th + 0.25, tz + z0, tx + x1, g + th + 1.25, tz + z1, 'wood'));
    push(c.deco, R(tx - 2.3, g + th + 2.6, tz - 2.3, tx + 2.3, g + th + 2.85, tz + 2.3, 'roof_red'));
    for (const [dx, dz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) push(c.deco, R(tx + dx - 0.08, g + th + 1.25, tz + dz - 0.08, tx + dx + 0.08, g + th + 2.6, tz + dz + 0.08, 'wood'));
    // staircase up the east side, rising southwards to the gap in the railing (solid underneath so nothing snags)
    const steps = 15, rise = (th + 0.25) / steps;
    for (let s = 0; s < steps; s++) { const z1 = tz - 0.75 + (steps - 1 - s) * 0.45 + 0.45, z0 = z1 - 0.45, top = g + (s + 1) * rise; push(c.boxes, R(tx + 2.0, Math.min(g, ground(tx + 2.6, (z0 + z1) / 2)), z0, tx + 3.3, top, z1, 'wood')); }
    push(c.boxes, R(tx + 2.0, g, tz - 2.0, tx + 3.3, g + th + 0.25, tz - 0.75, 'wood'));   // landing beside the gap
  }
  // ruined stone walls along the NW ridge
  for (const [x, z, w, d, h] of [[-40, -38, 8, 0.8, 2.4], [-44, -34, 0.8, 6, 1.8], [-36, -42, 0.8, 5, 3.0], [-30, -26, 6, 0.8, 1.6], [-50, -50, 5, 0.8, 2.2]]) {
    const g = ground(x, z); push(c.boxes, B(x, z, w, d, h, 'stone', g));
    if (h > 2) push(c.boxes, B(x + (w > d ? w * 0.2 : 0), z + (d > w ? d * 0.2 : 0), w > d ? w * 0.4 : d === 0.8 ? 0.8 : w, d > w ? d * 0.4 : 0.8, 0.8, 'stone', g + h));
  }
  // foxholes / sandbag nests on the south-east hill
  for (const [x, z] of [[48, -46], [44, -40]]) { const g = ground(x, z); for (const [dx, dz, w, d] of [[0, -1.6, 3.4, 0.7], [-1.6, 0, 0.7, 3.4], [1.6, 0, 0.7, 3.4]]) push(c.boxes, B(x + dx, z + dz, w, d, 0.9, 'sandbag', g)); }
  // woods + boulders on the slopes
  const taken = (x, z) => flats.some(f => Math.abs(x - f.x) < f.w / 2 + 3 && Math.abs(z - f.z) < f.d / 2 + 3) || Math.abs((x - z * 0.55) - 8) < 6;
  for (let k = 0; k < 120; k++) {
    const x = (rnd() - 0.5) * (size - 16), z = (rnd() - 0.5) * (size - 16);
    if (taken(x, z) || Math.hypot(x - 42, z - 36) < 6) continue;
    const g = ground(x, z);
    if (rnd() < 0.72) pine(c, x, z, g, 0.8 + rnd() * 0.5); else boulder(c, x, z, g, 0.7 + rnd() * 0.7, rnd);
  }
  // perimeter: cliffs and treeline instead of a bare wall
  // jagged, layered cliffs: each segment juts out by a different amount, with a lower ledge and a grassy top
  for (let t = -half; t < half; t += 4.5) {
    for (const [ax, sgn] of [['z', -1], ['z', 1], ['x', -1], ['x', 1]]) {
      const hh = 6 + rnd() * 9, jut = 2 + rnd() * 3.5, ledge = 1.5 + rnd() * 2.5, lh = 1.5 + rnd() * 2.5, len = 4.5 + rnd() * 1.5;
      const seg = (inA, outA, y0, y1, m, dst = c.boxes) => {     // inA/outA: distance in from the edge
        const a0 = t, a1 = t + len, e0 = sgn * (half - outA), e1 = sgn * (half - inA);
        if (ax === 'z') push(dst, R(a0, y0, Math.min(e0, e1), a1, y1, Math.max(e0, e1), m)); else push(dst, R(Math.min(e0, e1), y0, a0, Math.max(e0, e1), y1, a1, m));
      };
      seg(jut, 0, 0, hh, 'rock_grey');
      seg(jut + ledge, jut - 0.2, 0, lh, rnd() < 0.5 ? 'rock_grey' : 'stone');
      seg(jut - 0.4, 0, hh, hh + 0.5, 'grass', c.deco);
      if (rnd() < 0.4) seg(jut * 0.5, 0, hh, hh + 1.5 + rnd() * 2, 'rock_grey');
    }
  }
  c.ground = ground;
  return c;
}
