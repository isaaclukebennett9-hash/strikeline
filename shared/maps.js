// Map layouts built from axis-aligned boxes. Shared by client (rendering/collision) and server (bots/rockets).
// `boxes` collide, `deco` boxes are visual only (trims, canopies, leaves, signs...).

const R = (x0, y0, z0, x1, y1, z1, m) => ({ min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], m });
const B = (x, z, w, d, h, m, y = 0) => R(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, m);
function push(list, b) {
  if (b.max[0] - b.min[0] < 0.01 || b.max[1] - b.min[1] < 0.01 || b.max[2] - b.min[2] < 0.01) return;
  list.push(b);
}
const newCtx = () => ({ boxes: [], deco: [] });

function rotBox(b, times) {
  let { min, max } = b;
  for (let i = 0; i < times; i++) { // (x,z) -> (-z, x)
    const nmin = [-max[2], min[1], min[0]], nmax = [-min[2], max[1], max[0]];
    min = nmin; max = nmax;
  }
  return { min: [...min], max: [...max], m: b.m };
}
function addRot(dst, src, times) {
  for (const t of times) {
    for (const b of src.boxes) dst.boxes.push(rotBox(b, t));
    for (const b of src.deco) dst.deco.push(rotBox(b, t));
  }
}

// ================================================================ building generator
const FH = 3.2, WT = 0.3, SLAB = 0.25;

// Wall along `axis` ('x' or 'z') from a0..a1 at `fixed`, with rectangular openings {a,b,y0,y1}.
function wallRun(c, axis, a0, a1, fixed, y0, h, ops, m, t = WT, trim = 'trim') {
  const seg = (s0, s1, yb, yt, mat = m, th = t, dst = c.boxes) =>
    push(dst, axis === 'x' ? R(s0, yb, fixed - th / 2, s1, yt, fixed + th / 2, mat) : R(fixed - th / 2, yb, s0, fixed + th / 2, yt, s1, mat));
  const list = ops.filter(o => o.b > a0 + 0.1 && o.a < a1 - 0.1).sort((p, q) => p.a - q.a);
  let cur = a0;
  for (const o of list) {
    seg(cur, o.a, y0, y0 + h);
    seg(o.a, o.b, y0, y0 + o.y0);
    seg(o.a, o.b, y0 + o.y1, y0 + h);
    if (trim) {
      if (o.y0 > 0) seg(o.a - 0.1, o.b + 0.1, y0 + o.y0 - 0.08, y0 + o.y0 + 0.02, trim, t + 0.16, c.deco); // sill
      seg(o.a - 0.1, o.b + 0.1, y0 + o.y1 - 0.02, y0 + o.y1 + 0.12, trim, t + 0.1, c.deco);              // lintel
      seg(o.a - 0.1, o.a + 0.02, y0 + o.y0, y0 + o.y1, trim, t + 0.08, c.deco);                           // jambs
      seg(o.b - 0.02, o.b + 0.1, y0 + o.y0, y0 + o.y1, trim, t + 0.08, c.deco);
    }
    cur = o.b;
  }
  seg(cur, a1, y0, y0 + h);
}

function slab(c, x0, z0, x1, z1, y, m, hole) {
  const yb = y - SLAB;
  if (!hole) { push(c.boxes, R(x0, yb, z0, x1, y, z1, m)); return; }
  const [hx0, hz0, hx1, hz1] = hole;
  push(c.boxes, R(x0, yb, z0, x1, y, hz0, m));
  push(c.boxes, R(x0, yb, hz1, x1, y, z1, m));
  push(c.boxes, R(x0, yb, hz0, hx0, y, hz1, m));
  push(c.boxes, R(hx1, yb, hz0, x1, y, hz1, m));
}

// Edge band around a rectangle (decorative trim)
function band(c, x0, z0, x1, z1, y0, y1, out, m) {
  push(c.deco, R(x0 - out, y0, z0 - out, x1 + out, y1, z0 + 0.02, m));
  push(c.deco, R(x0 - out, y0, z1 - 0.02, x1 + out, y1, z1 + out, m));
  push(c.deco, R(x0 - out, y0, z0, x0 + 0.02, y1, z1, m));
  push(c.deco, R(x1 - 0.02, y0, z0, x1 + out, y1, z1, m));
}

/**
 * Multi-storey building with doors, windows, interior stairs (switch-back along the north wall),
 * floor slabs, optional partition walls, an accessible roof with parapet.
 * o: { x, z, w, d, floors, fh, m, floorM, roofM, doors:{s,n,e,w:[offset | {c,w,h}]}, roof, windows, winGap, winY, partition }
 */
function building(c, o) {
  const fh = o.fh || FH, floors = o.floors || 1, m = o.m || 'brick';
  const fm = o.floorM || 'floor_wood', rm = o.roofM || 'roof';
  const { x, z, w, d } = o;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const ix0 = x0 + WT, ix1 = x1 - WT, iz0 = z0 + WT, iz1 = z1 - WT;
  const roofAccess = o.roof !== false;
  const steps = Math.round(fh / 0.4), sh = fh / steps, sd = 0.55, run = steps * sd;
  const flights = floors - 1 + (roofAccess ? 1 : 0);
  // Leave a run-up space before the first step and a landing after the last, so every flight can be
  // walked onto head-on (instead of squeezing on from the side and turning on the first step).
  const room = ix1 - ix0, LAND = 0.85;
  const approach = Math.max(0.25, Math.min(1.0, room - run - 0.1 - LAND));
  const sx = ix0 + approach;
  const lane = k => (k % 2 === 0 ? [iz1 - 1.2, iz1] : [iz1 - 2.4, iz1 - 1.2]);
  const holes = [];
  for (let f = 0; f < flights; f++) {
    const [lz0, lz1] = lane(f), dir = f % 2 === 0 ? 1 : -1;
    const start = dir > 0 ? sx : sx + run + 0.1;
    for (let i = 0; i < steps; i++) {
      const cx = start + dir * (i * sd + sd / 2);
      push(c.boxes, R(cx - sd / 2, f * fh, lz0, cx + sd / 2, f * fh + (i + 1) * sh, lz1, o.stairM || 'stone'));
    }
    holes[f + 1] = dir > 0 ? [sx - 0.05, lz0, sx + run, lz1] : [start - run, lz0, start + 0.05, lz1];
  }

  const [wy0, wy1] = o.winY || [1.0, 2.2];
  const doorOps = side => (o.doors?.[side] || []).map(dd => {
    const dc = typeof dd === 'number' ? dd : dd.c, dw = dd.w || 1.4, dh = dd.h || 2.4;
    return { c: dc, a: dc - dw / 2, b: dc + dw / 2, y0: 0, y1: dh };
  });
  const winOps = (len, avoid) => {
    if (o.windows === false) return [];
    const n = Math.max(0, Math.floor((len - 1.0) / (o.winGap || 2.8)));
    const out = [];
    for (let i = 0; i < n; i++) {
      const cc = -len / 2 + (len / n) * (i + 0.5);
      if (avoid.some(a => Math.abs(a.c - cc) < (a.b - a.a) / 2 + 0.9)) continue;
      out.push({ c: cc, a: cc - 0.6, b: cc + 0.6, y0: wy0, y1: wy1 });
    }
    return out;
  };
  const sides = [
    ['s', 'x', x0, x1, z0 + WT / 2, x, w],
    ['n', 'x', x0, x1, z1 - WT / 2, x, w],
    ['w', 'z', iz0, iz1, x0 + WT / 2, z, d - 2 * WT],
    ['e', 'z', iz0, iz1, x1 - WT / 2, z, d - 2 * WT],
  ];
  for (let f = 0; f < floors; f++) {
    const y = f * fh;
    if (o.walls === false) {
      // unfinished concrete frame: columns around the edge, safety rails on upper floors
      const nx = Math.max(1, Math.round(w / 4)), nz = Math.max(1, Math.round(d / 4));
      for (let i = 0; i <= nx; i++) for (const cz of [z0 + 0.2, z1 - 0.2]) push(c.boxes, B(x0 + 0.2 + (w - 0.4) * i / nx, cz, 0.4, 0.4, fh, m, y));
      for (let j = 1; j < nz; j++) for (const cx of [x0 + 0.2, x1 - 0.2]) push(c.boxes, B(cx, z0 + 0.2 + (d - 0.4) * j / nz, 0.4, 0.4, fh, m, y));
      if (f > 0) {
        push(c.boxes, R(x0 + 0.4, y, z0, x1 - 0.4, y + 1.0, z0 + 0.08, 'metal_dark'));
        push(c.boxes, R(x0 + 0.4, y, z1 - 0.08, x1 - 0.4, y + 1.0, z1, 'metal_dark'));
        push(c.boxes, R(x0, y, z0 + 0.4, x0 + 0.08, y + 1.0, z1 - 0.4, 'metal_dark'));
        push(c.boxes, R(x1 - 0.08, y, z0 + 0.4, x1, y + 1.0, z1 - 0.4, 'metal_dark'));
      }
    } else for (const [side, axis, a0, a1, fixed, center, len] of sides) {
      const doors = f === 0 ? doorOps(side) : [];
      // no windows that open straight onto the staircase (north wall / back of the side walls) or onto a partition wall
      const stairsHere = f < flights, sx1 = sx + run + 0.1;
      const px = o.partition !== undefined ? x + o.partition : null, pzEnd = flights > 0 ? iz1 - 2.5 : iz1;
      const blocked = (wa, wb) => {
        if (side === 's' || side === 'n') {
          if (side === 'n' && stairsHere && wb > sx - 0.4 && wa < sx1 + 0.4) return true;
          if (px !== null && wb > px - 0.5 && wa < px + 0.5 && (side === 's' || pzEnd >= iz1 - 0.01)) return true;
          return false;
        }
        return stairsHere && wb > iz1 - 2.6;
      };
      const wins = winOps(len, doors).filter(op => !blocked(op.a + center, op.b + center));
      const ops = [...doors, ...wins].map(op => ({ ...op, a: op.a + center, b: op.b + center }));
      wallRun(c, axis, a0, a1, fixed, y, fh, ops, m);
    }
    if (f > 0) { slab(c, x0, z0, x1, z1, y, fm, holes[f]); band(c, x0, z0, x1, z1, y - 0.34, y + 0.05, 0.08, 'trim'); }
    else push(c.deco, R(ix0, 0, iz0, ix1, 0.05, iz1, fm));
    if (o.partition !== undefined) {
      const px = x + o.partition, zEnd = flights > 0 ? iz1 - 2.5 : iz1, mid = (iz0 + zEnd) / 2;
      wallRun(c, 'z', iz0, zEnd, px, y, fh, [{ a: mid - 0.7, b: mid + 0.7, y0: 0, y1: 2.4 }], o.innerM || 'plaster_white', 0.2, null);
    }
  }
  const top = floors * fh;
  slab(c, x0, z0, x1, z1, top, rm, roofAccess ? holes[floors] : null);
  band(c, x0, z0, x1, z1, top - 0.3, top, 0.12, 'trim');
  const pt = 0.25, ph = roofAccess ? 0.95 : 0.4;
  push(c.boxes, R(x0, top, z0, x1, top + ph, z0 + pt, m));
  push(c.boxes, R(x0, top, z1 - pt, x1, top + ph, z1, m));
  push(c.boxes, R(x0, top, z0 + pt, x0 + pt, top + ph, z1 - pt, m));
  push(c.boxes, R(x1 - pt, top, z0 + pt, x1, top + ph, z1 - pt, m));
  push(c.deco, R(x0 - 0.05, top + ph, z0 - 0.05, x1 + 0.05, top + ph + 0.08, z0 + pt + 0.05, 'trim'));
  push(c.deco, R(x0 - 0.05, top + ph, z1 - pt - 0.05, x1 + 0.05, top + ph + 0.08, z1 + 0.05, 'trim'));
  push(c.deco, R(x0 - 0.05, top + ph, z0, x0 + pt + 0.05, top + ph + 0.08, z1, 'trim'));
  push(c.deco, R(x1 - pt - 0.05, top + ph, z0, x1 + 0.05, top + ph + 0.08, z1, 'trim'));
  if (roofAccess) { // stair hut cover + roof clutter
    push(c.boxes, B(ix1 - 1.0, iz0 + 1.0, 1.0, 1.0, 0.8, 'metal', top)); // AC unit
    push(c.deco, B(ix1 - 1.0, iz0 + 1.53, 0.7, 0.06, 0.6, 'metal_dark', top + 0.1));
  }
  return { x0, z0, x1, z1, top };
}

// ================================================================ props
function stairRun(c, x, z, dx, dz, w, steps, stepH, m, base = 0, sd = 0.55) {
  for (let i = 0; i < steps; i++) {
    const cx = x + dx * (i * sd + sd / 2), cz = z + dz * (i * sd + sd / 2);
    push(c.boxes, B(cx, cz, dx ? sd : w, dz ? sd : w, (i + 1) * stepH, m, base));
  }
}
function car(c, x, z, rot, col) {
  const L = (lx, lz) => (rot ? [x + lz, z + lx] : [x + lx, z + lz]);
  const S = (w, d) => (rot ? [d, w] : [w, d]);
  let [cx, cz] = L(0, 0), [w, d] = S(2.0, 4.3);
  push(c.boxes, B(cx, cz, w, d, 0.75, col, 0.3));
  [cx, cz] = L(0, 0.2); [w, d] = S(1.8, 2.3);
  push(c.boxes, B(cx, cz, w, d, 0.6, 'car_glass', 1.05));
  [w, d] = S(1.82, 1.6); push(c.deco, B(cx, cz, w, d, 0.12, col, 1.6));
  for (const [lx, lz] of [[-0.95, -1.4], [0.95, -1.4], [-0.95, 1.4], [0.95, 1.4]]) {
    const [wx, wz] = L(lx, lz), [ww, wd] = S(0.25, 0.7);
    push(c.deco, B(wx, wz, ww, wd, 0.62, 'tire'));
  }
  for (const s of [-0.65, 0.65]) {
    const [lx, lz] = L(s, -2.16), [ww, wd] = S(0.4, 0.04); push(c.deco, B(lx, lz, ww, wd, 0.14, 'headlight', 0.75));
    const [bx, bz] = L(s, 2.16); push(c.deco, B(bx, bz, ww, wd, 0.12, 'taillight', 0.75));
  }
  [cx, cz] = L(0, -2.17); [w, d] = S(1.9, 0.08); push(c.deco, B(cx, cz, w, d, 0.15, 'metal_dark', 0.35));
}
function tree(c, x, z, s = 1) {
  push(c.boxes, B(x, z, 0.4, 0.4, 2.6 * s, 'bark'));
  push(c.deco, B(x, z, 2.8 * s, 2.8 * s, 1.3 * s, 'leaves', 2.2 * s));
  push(c.deco, B(x + 0.3, z - 0.2, 2.0 * s, 2.0 * s, 1.0 * s, 'leaves', 3.4 * s));
  push(c.deco, B(x - 0.2, z + 0.3, 1.2 * s, 1.2 * s, 0.7 * s, 'leaves', 4.3 * s));
  push(c.deco, B(x + 1.1 * s, z + 0.6, 1.0 * s, 1.0 * s, 0.8 * s, 'leaves', 1.9 * s));
}
function palm(c, x, z) {
  push(c.boxes, B(x, z, 0.35, 0.35, 2.2, 'bark'));
  push(c.deco, B(x + 0.15, z, 0.3, 0.3, 2.4, 'bark', 2.2));
  const t = 4.6;
  push(c.deco, B(x + 0.15, z, 0.6, 0.6, 0.4, 'palm', t));
  for (const [dx, dz, w, d] of [[1.3, 0, 2.4, 0.5], [-1.0, 0, 2.4, 0.5], [0.15, 1.2, 0.5, 2.4], [0.15, -1.2, 0.5, 2.4]])
    push(c.deco, B(x + dx, z + dz, w, d, 0.12, 'palm', t + 0.15));
  for (const [dx, dz] of [[2.4, 0], [-2.1, 0], [0.15, 2.3], [0.15, -2.3]]) push(c.deco, B(x + dx, z + dz, 0.5, 0.5, 0.12, 'palm', t - 0.25));
}
function stall(c, x, z, rot, awn) {
  const [w, d] = rot ? [1.1, 2.8] : [2.8, 1.1];
  push(c.boxes, B(x, z, w, d, 1.0, 'wood'));
  push(c.deco, B(x, z, w + 0.05, d + 0.05, 0.08, 'trim', 1.0));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) push(c.deco, B(x + dx * (w / 2 + 0.1), z + dz * (d / 2 + 0.4 * (rot ? 0 : 1) + 0.1), 0.08, 0.08, 2.4, 'wood'));
  push(c.deco, B(x, z, w + 0.6, d + 1.2, 0.12, awn, 2.4));
  push(c.deco, B(x - (rot ? 0 : 0.6), z - (rot ? 0.6 : 0), 0.5, 0.5, 0.3, 'fruit', 1.0));
  push(c.deco, B(x + (rot ? 0 : 0.5), z + (rot ? 0.5 : 0), 0.6, 0.5, 0.25, 'crate', 1.0));
}
const barrel = (c, x, z, m = 'barrel_blue') => { push(c.boxes, B(x, z, 0.7, 0.7, 1.0, m)); push(c.deco, B(x, z, 0.74, 0.74, 0.06, 'metal_dark', 0.3)); push(c.deco, B(x, z, 0.74, 0.74, 0.06, 'metal_dark', 0.7)); };
const crate = (c, x, z, s = 1.2, y = 0) => push(c.boxes, B(x, z, s, s, s, 'crate', y));
const sandbags = (c, x, z, w, d) => { push(c.boxes, B(x, z, w, d, 0.9, 'sandbag')); };
const bench = (c, x, z, rot) => { push(c.boxes, B(x, z, rot ? 0.5 : 1.8, rot ? 1.8 : 0.5, 0.5, 'wood')); };
function lamp(c, x, z, head = 'lamp') {
  push(c.deco, B(x, z, 0.14, 0.14, 4.2, 'metal_dark'));
  push(c.deco, B(x, z, 0.5, 0.5, 0.25, 'metal_dark', 4.2));
  push(c.deco, B(x, z, 0.36, 0.36, 0.08, head, 4.12));
  push(c.boxes, B(x, z, 0.2, 0.2, 2.0, 'metal_dark'));
}
function container(c, x, z, rot, m, y = 0) {
  push(c.boxes, B(x, z, rot ? 6 : 2.5, rot ? 2.5 : 6, 2.6, m, y));
  push(c.deco, B(x, z, rot ? 6.05 : 2.55, rot ? 2.55 : 6.05, 0.14, 'metal_dark', y + 2.5));
}
function fountain(c, x, z) {
  for (const [dx, dz, w, d] of [[0, -3, 6.4, 0.4], [0, 3, 6.4, 0.4], [-3, 0, 0.4, 5.6], [3, 0, 0.4, 5.6]]) push(c.boxes, B(x + dx, z + dz, w, d, 0.7, 'stone'));
  push(c.deco, B(x, z, 5.5, 5.5, 0.5, 'water'));
  push(c.boxes, B(x, z, 1.0, 1.0, 1.6, 'stone'));
  push(c.deco, B(x, z, 1.8, 1.8, 0.2, 'stone', 1.6));
  push(c.boxes, B(x, z, 0.5, 0.5, 2.6, 'stone'));
  push(c.deco, B(x, z, 0.9, 0.9, 0.2, 'stone', 2.6));
}
const dumpster = (c, x, z, rot) => { push(c.boxes, B(x, z, rot ? 1.2 : 2, rot ? 2 : 1.2, 1.3, 'dumpster')); push(c.deco, B(x, z, rot ? 1.3 : 2.1, rot ? 2.1 : 1.3, 0.1, 'metal_dark', 1.3)); };
const barrier = (c, x, z, rot, len = 3) => push(c.boxes, B(x, z, rot ? 0.6 : len, rot ? len : 0.6, 1.0, 'barrier'));

// ================================================================ maps
function town() {
  const q = newCtx();
  building(q, { x: 18, z: 10, w: 10, d: 8, floors: 2, m: 'plaster_yellow', doors: { w: [0], s: [2] }, partition: 0.5 });
  building(q, { x: 8, z: 22, w: 9, d: 7, floors: 1, m: 'brick', doors: { s: [0], e: [0] } });
  building(q, { x: 26, z: 26, w: 8, d: 8, floors: 3, m: 'brick_dark', doors: { s: [0], w: [0] } });
  car(q, 11, 2.6, 1, 'car_red');
  stall(q, 5, 13, 0, 'awning_red');
  tree(q, 31, 8); tree(q, 31, 15, 0.9);
  crate(q, 23, 18.5); crate(q, 24.3, 18.6, 1.0); crate(q, 23.6, 18.5, 0.9, 1.2);
  barrel(q, 13.5, 16); barrel(q, 14.3, 16.6, 'barrel_red');
  bench(q, 7, 7.5, 0);
  lamp(q, 11.5, 11.5);
  sandbags(q, 2.5, 30, 4, 0.8);
  push(q.deco, R(13.5, 0, 15, 33, 0.04, 17, 'road'));
  const c = newCtx();
  addRot(c, q, [0, 1, 2, 3]);
  fountain(c, 0, 0);
  push(c.deco, R(-11, 0, -11, 11, 0.04, 11, 'cobble'));
  return c;
}

function harbor() {
  const q = newCtx();
  building(q, { x: -16, z: 20, w: 24, d: 13, floors: 1, fh: 5.2, m: 'metal_corr', roof: false, roofM: 'metal_roof', floorM: 'concrete_floor',
    doors: { s: [{ c: -6, w: 3.6, h: 4 }, { c: 6, w: 3.6, h: 4 }], e: [0] }, winY: [3.4, 4.5], winGap: 4 });
  push(q.boxes, R(-27.7, 2.4, 23.4, -12.2, 2.65, 26.2, 'metal_grate'));      // mezzanine
  push(q.boxes, R(-27.7, 2.65, 23.35, -13.6, 3.6, 23.45, 'metal_dark'));    // railing
  stairRun(q, -8.35, 24.6, -1, 0, 1.6, 7, 2.65 / 7, 'metal_grate');
  crate(q, -22, 17); crate(q, -20.7, 17.2); crate(q, -21.4, 17.1, 1.0, 1.2); crate(q, -10, 16, 1.4);
  barrel(q, -26.5, 15); barrel(q, -25.6, 15.2); barrel(q, -26.1, 16, 'barrel_red');
  building(q, { x: 22, z: 22, w: 10, d: 8, floors: 2, m: 'concrete_panel', doors: { s: [0], w: [1] }, partition: 2.4, floorM: 'floor_tile' });
  container(q, 6, 30, 0, 'container_red'); container(q, 6, 30, 0, 'container_blue', 2.6);
  container(q, 10, 28, 0, 'container_green');
  container(q, 32, 6, 1, 'container_red');
  push(q.boxes, B(-10, 35.5, 1, 1, 14, 'crane')); push(q.boxes, B(10, 35.5, 1, 1, 14, 'crane'));
  push(q.deco, R(-10.6, 13, 34.8, 10.6, 14.4, 36.2, 'crane'));
  push(q.deco, B(2, 35.5, 2.2, 2.2, 1.8, 'crane', 11.2));
  push(q.boxes, B(16, 10, 1.4, 2.4, 1.4, 'forklift')); push(q.deco, B(16, 8.6, 1.2, 0.15, 2.6, 'metal_dark'));
  barrier(q, 2, 12, 0, 4); barrier(q, 12, 6, 1, 4);
  push(q.boxes, B(-2, 8, 1.2, 1.2, 0.3, 'wood')); crate(q, -2, 8, 1.1, 0.3);
  const c = newCtx();
  addRot(c, q, [0, 2]);
  sandbags(c, 0, 0, 3, 0.8); sandbags(c, 0, -2.5, 0.8, 3);
  crate(c, 3, 2); crate(c, -3, -2);
  return c;
}

function neon() {
  const q = newCtx();
  building(q, { x: 18, z: 9, w: 10, d: 8, floors: 2, m: 'plaster_dark', doors: { w: [0], s: [-2] }, floorM: 'floor_tile' });
  push(q.deco, R(12.75, 3.4, 7.2, 12.9, 4.3, 10.8, 'neon_pink'));
  push(q.deco, R(16, 2.75, 4.75, 20, 2.9, 4.85, 'neon_cyan'));
  building(q, { x: 24, z: 24, w: 10, d: 10, floors: 3, m: 'concrete_dark', doors: { s: [0], w: [2] } });
  for (const [cx, cz] of [[19, 19], [29, 19]]) push(q.deco, B(cx, cz, 0.18, 0.18, 9.6, 'neon_cyan'));
  push(q.deco, R(20, 7.0, 18.75, 28, 7.6, 18.9, 'neon_orange'));
  building(q, { x: 7, z: 23, w: 8, d: 6, floors: 1, m: 'brick_dark', doors: { s: [0] } });
  push(q.deco, R(4, 2.7, 19.85, 10, 3.0, 20, 'neon_pink'));
  car(q, 10, 4, 1, 'car_blue');
  dumpster(q, 14.5, 16, 0); dumpster(q, 31, 12, 1);
  barrier(q, 3, 30, 0, 3);
  push(q.boxes, B(12.4, 13.2, 0.8, 0.6, 1.9, 'vending'));
  lamp(q, 12, 2, 'neon_cyan'); lamp(q, 2, 14, 'neon_pink');
  crate(q, 30, 31); crate(q, 31.3, 31.2, 1.0);
  push(q.deco, R(0, 0, 16, 32, 0.04, 17.2, 'road_line'));
  const c = newCtx();
  addRot(c, q, [0, 1, 2, 3]);
  push(c.boxes, B(0, 0, 4, 4, 0.6, 'stone'));
  push(c.boxes, B(0, 0, 0.8, 0.8, 5, 'neon_pink'));
  for (const [x, z] of [[-4, 0], [4, 0], [0, 4], [0, -4]]) bench(c, x, z, x !== 0);
  return c;
}

function frost() {
  const q = newCtx();
  building(q, { x: -14, z: 14, w: 12, d: 9, floors: 2, m: 'panel_white', doors: { s: [-3], e: [0] }, partition: 1, floorM: 'floor_tile' });
  building(q, { x: 14, z: 20, w: 8, d: 6, floors: 1, m: 'bunker', doors: { s: [0], w: [0] }, floorM: 'concrete_floor' });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) push(q.boxes, B(26 + dx * 1.2, 26 + dz * 1.2, 0.25, 0.25, 12, 'metal_dark'));
  push(q.deco, B(26, 26, 2.8, 2.8, 0.2, 'metal_grate', 6)); push(q.deco, B(26, 26, 1.6, 1.6, 0.2, 'metal_grate', 12));
  push(q.deco, B(26, 26, 0.12, 0.12, 4, 'neon_orange', 12.2));
  container(q, 4, 24, 0, 'container_blue'); container(q, 28, 10, 1, 'container_red');
  push(q.boxes, B(6, 10, 4, 3, 0.9, 'snowpile')); push(q.boxes, B(-4, 26, 3, 2.5, 1.1, 'snowpile'));
  push(q.boxes, B(20, 4, 2.4, 1.4, 1.6, 'metal')); push(q.deco, B(20, 4, 2.0, 1.0, 0.4, 'metal_dark', 1.6));
  crate(q, -25, 4); crate(q, -25, 5.3, 1.0); barrel(q, -2, 14, 'barrel_red');
  sandbags(q, 10, 2, 3.5, 0.8); sandbags(q, -8, 4, 0.8, 3.5);
  push(q.boxes, B(-24, 24, 2.5, 2.5, 2.2, 'ice'));
  const c = newCtx();
  addRot(c, q, [0, 2]);
  push(c.boxes, B(0, 0, 6, 6, 1.2, 'concrete'));
  stairRun(c, 0, -5.2, 0, 1, 2, 3, 0.4, 'concrete');
  stairRun(c, 0, 5.2, 0, -1, 2, 3, 0.4, 'concrete');
  push(c.boxes, B(0, 0, 1.0, 1.0, 2.4, 'metal', 1.2));
  push(c.deco, B(0, 0, 3.2, 3.2, 0.25, 'panel_white', 3.6));
  return c;
}

function dune() {
  const q = newCtx();
  building(q, { x: 16, z: 8, w: 8, d: 7, floors: 1, m: 'mudbrick', roofM: 'mudroof', floorM: 'rug', doors: { w: [0], s: [1] } });
  building(q, { x: 8, z: 20, w: 8, d: 8, floors: 2, m: 'mudbrick', roofM: 'mudroof', floorM: 'rug', doors: { s: [0] } });
  building(q, { x: 26, z: 22, w: 9, d: 8, floors: 1, m: 'sandstone', roofM: 'mudroof', floorM: 'rug', doors: { s: [0], w: [0] } });
  stall(q, 3, 11, 1, 'awning_green');
  palm(q, 28, 11); palm(q, 18, 30);
  barrel(q, 12, 14, 'barrel_red'); crate(q, 21, 15); crate(q, 22.2, 15.2, 1.0);
  push(q.boxes, B(31, 30, 5, 0.8, 1.3, 'sandstone'));
  push(q.boxes, B(2, 30, 0.8, 4, 1.3, 'sandstone'));
  push(q.deco, R(11.5, 3.1, 4.3, 14.5, 3.25, 6.5, 'awning_red'));
  const c = newCtx();
  addRot(c, q, [0, 1, 2, 3]);
  for (const [dx, dz, w, d] of [[0, -1.6, 3.6, 0.4], [0, 1.6, 3.6, 0.4], [-1.6, 0, 0.4, 2.8], [1.6, 0, 0.4, 2.8]]) push(c.boxes, B(dx, dz, w, d, 0.9, 'sandstone'));
  push(c.deco, B(0, 0, 2.7, 2.7, 0.2, 'water', 0.5));
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) push(c.boxes, B(x, z, 0.3, 0.3, 2.8, 'wood'));
  push(c.deco, B(0, 0, 4, 4, 0.2, 'mudroof', 2.8));
  return c;
}

function construction() {
  const q = newCtx();
  // unfinished 3-storey concrete frame with stairs to the roof
  building(q, { x: -14, z: 15, w: 12, d: 10, floors: 3, walls: false, m: 'concrete', floorM: 'concrete_floor', roofM: 'concrete_floor' });
  // finished site office (portacabin)
  building(q, { x: 17, z: 23, w: 8, d: 6, floors: 1, m: 'portacabin', roof: false, floorM: 'floor_tile', roofM: 'metal_roof', doors: { s: [0], w: [0] } });
  // scaffolding with stairs up to a walkway
  push(q.boxes, R(1.5, 2.8, 25, 10.6, 3.0, 27, 'metal_grate'));
  push(q.boxes, R(1.5, 3.0, 26.92, 10.6, 4.0, 27, 'metal_dark'));
  stairRun(q, 14.45, 26, -1, 0, 2, 7, 0.4, 'metal_grate');
  for (let x = 1.6; x <= 10.6; x += 3) for (const z of [25.05, 26.95]) push(q.deco, B(x, z, 0.1, 0.1, 5.5, 'metal_dark'));
  push(q.deco, R(1.5, 5.4, 24.95, 10.6, 5.5, 27.05, 'metal_dark'));
  // materials & machinery
  container(q, 25, 6, 1, 'container_blue'); container(q, 4, 11, 0, 'container_red');
  push(q.boxes, B(-2, 27, 4.5, 3, 1.3, 'dirt')); push(q.boxes, B(-2.5, 27, 2.5, 1.8, 2.0, 'dirt'));
  push(q.boxes, B(10, 4, 4, 1.4, 0.9, 'metal_dark'));                       // pipe stack
  for (let i = 0; i < 3; i++) push(q.deco, B(10, 3.55 + i * 0.45, 4.05, 0.4, 0.4, 'metal', 0.9));
  push(q.boxes, B(29, 29, 1.3, 1.3, 2.3, 'portaloo')); push(q.boxes, B(30.6, 29, 1.3, 1.3, 2.3, 'portaloo'));
  barrier(q, 6, 18, 1, 4); barrier(q, 20, 13, 0, 4);
  // cement mixer truck
  push(q.boxes, B(-26, 2, 2.4, 6.2, 1.5, 'forklift', 0.4)); push(q.boxes, B(-26, -0.3, 2.3, 1.8, 1.2, 'car_glass', 1.9));
  push(q.boxes, B(-26, 3.2, 2.0, 3.4, 1.9, 'mixer', 1.9));
  for (const [dx, dz] of [[-1.25, -1.6], [1.25, -1.6], [-1.25, 1.2], [1.25, 1.2], [-1.25, 3.4], [1.25, 3.4]]) push(q.deco, B(-26 + dx, 2 + dz, 0.3, 0.9, 0.9, 'tire'));
  crate(q, -6, 6); crate(q, -4.7, 6.2, 1.0); crate(q, -5.4, 6.1, 0.9, 1.2);
  sandbags(q, 22, 33, 4, 0.8);
  const c = newCtx();
  addRot(c, q, [0, 2]);
  // tower crane in the middle
  push(c.boxes, B(0, 0, 4, 4, 0.6, 'concrete'));
  push(c.boxes, B(0, 0, 1.4, 1.4, 22, 'crane'));
  push(c.deco, R(-17, 21.2, -0.5, 15, 22.4, 0.5, 'crane'));
  push(c.deco, B(-14.5, 0, 3, 2, 1.6, 'concrete', 20));
  push(c.deco, B(1.3, 0, 1.8, 1.8, 1.7, 'metal', 19.4));
  push(c.deco, B(12, 0, 0.1, 0.1, 12, 'metal_dark', 9.4));
  push(c.deco, B(12, 0, 1.6, 1.6, 0.8, 'crate', 8.6));
  return c;
}

// ---------------------------------------------------------------- big-map helpers
function mulberry(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function jumpPad(c, x, z) {
  push(c.boxes, B(x, z, 1.8, 1.8, 0.16, 'jumppad'));
  push(c.deco, B(x, z, 2.2, 2.2, 0.08, 'metal_dark'));
}
function tank(c, x, z, rot) {
  const S = (w, d) => (rot ? [d, w] : [w, d]);
  let [w, d] = S(3.4, 6.2); push(c.boxes, B(x, z, w, d, 1.3, 'tank', 0.35));
  [w, d] = S(0.7, 6.6); const off = rot ? [0, 1.45] : [1.45, 0];
  push(c.deco, B(x + off[0], z + off[1], ...S(0.7, 6.6), 0.75, 'tire')); push(c.deco, B(x - off[0], z - off[1], ...S(0.7, 6.6), 0.75, 'tire'));
  [w, d] = S(2.4, 2.8); push(c.boxes, B(x, z + (rot ? 0 : 0.4), w, d, 0.95, 'tank', 1.65));
  [w, d] = S(0.28, 3.8); push(c.deco, B(rot ? x - 2.6 : x, rot ? z : z - 2.6, w, d, 0.28, 'tank', 2.0));
  push(c.deco, B(x + (rot ? 0.4 : 0.5), z + (rot ? 0.5 : 0.8), 0.6, 0.6, 0.35, 'metal_dark', 2.6));
}
// Army cargo truck facing -z: hood + cab with windows, canvas-covered cargo bed, six wheels, bumper and lights.
function armyTruck(c, x, z) {
  const zf = z - 3.7; // front bumper line
  push(c.boxes, R(x - 1.05, 0.35, zf + 0.15, x + 1.05, 0.95, z + 3.5, 'metal_dark'));            // chassis
  for (const dz of [0.95, 4.6, 5.95]) for (const s of [-1, 1])                                   // wheels + hubs
    { push(c.deco, B(x + s * 1.0, zf + dz, 0.38, 1.0, 1.0, 'tire')); push(c.deco, B(x + s * 1.2, zf + dz, 0.04, 0.4, 0.4, 'metal', 0.3)); }
  push(c.boxes, R(x - 1.05, 0.95, zf + 0.15, x + 1.05, 1.75, zf + 1.35, 'tank'));                // hood
  push(c.deco, R(x - 0.7, 1.0, zf + 0.11, x + 0.7, 1.6, zf + 0.15, 'metal_dark'));                // grille
  for (const s of [-1, 1]) push(c.deco, B(x + s * 0.85, zf + 0.12, 0.22, 0.04, 0.16, 'headlight', 1.35));
  push(c.boxes, R(x - 1.15, 0.45, zf, x + 1.15, 0.75, zf + 0.15, 'metal_dark'));                  // bumper
  push(c.boxes, R(x - 1.15, 0.95, zf + 1.35, x + 1.15, 2.85, zf + 3.1, 'tank'));                  // cab
  push(c.deco, R(x - 0.95, 2.0, zf + 1.31, x + 0.95, 2.65, zf + 1.35, 'car_glass'));             // windscreen
  push(c.deco, R(x - 0.06, 2.0, zf + 1.29, x + 0.06, 2.65, zf + 1.35, 'tank'));                  // centre pillar
  for (const s of [-1, 1]) {
    push(c.deco, R(x + s * 1.15 - 0.02, 1.95, zf + 1.6, x + s * 1.15 + 0.02, 2.6, zf + 2.75, 'car_glass')); // side windows
    push(c.deco, R(x + s * 1.15 - 0.02, 1.0, zf + 2.7, x + s * 1.15 + 0.02, 1.85, zf + 2.75, 'metal_dark')); // door seam
    push(c.deco, B(x + s * 1.3, zf + 1.55, 0.06, 0.06, 0.25, 'metal_dark', 2.3));                         // mirror
  }
  push(c.deco, R(x - 1.17, 2.85, zf + 1.33, x + 1.17, 2.92, zf + 3.12, 'metal_dark'));            // cab roof cap
  push(c.boxes, R(x - 1.2, 0.95, zf + 3.2, x + 1.2, 1.3, z + 3.6, 'tank'));                       // cargo bed floor
  push(c.boxes, R(x - 1.2, 1.3, zf + 3.2, x + 1.2, 3.05, z + 3.6, 'tent'));                       // canvas cover
  for (let k = 0; k < 4; k++) { const rz = zf + 3.35 + k * ((z + 3.45 - (zf + 3.35)) / 3);         // cover ribs
    push(c.deco, R(x - 1.24, 1.3, rz - 0.05, x + 1.24, 3.09, rz + 0.05, 'metal_dark')); }
  for (const s of [-1, 1]) push(c.deco, B(x + s * 0.8, z + 3.62, 0.25, 0.04, 0.12, 'taillight', 1.05));
}
function watchtower(c, x, z, sdir) {
  const H = 4.6;
  for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) push(c.boxes, B(x + dx, z + dz, 0.25, 0.25, H + 2.4, 'wood'));
  push(c.boxes, B(x, z, 3.2, 3.2, 0.3, 'wood', H - 0.3));
  for (const [dx, dz, w, d] of [[0, -1.55, 3.2, 0.1], [-1.55, 0, 0.1, 3.2], [1.55, 0, 0.1, 3.2]]) push(c.boxes, B(x + dx, z + dz, w, d, 1.0, 'wood', H));
  push(c.deco, B(x, z, 3.8, 3.8, 0.25, 'metal_roof', H + 2.4));
  const steps = 12, sh = H / steps, sd = 0.42;
  stairRun(c, x, z + 1.6 + steps * sd, 0, -1, 1.4, steps, sh, 'wood', 0, sd);
}

function downtown() {
  const c = newCtx(), rnd = mulberry(20261119);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pk = arr => arr[Math.floor(rnd() * arr.length)];
  const centers = [-45, -15, 15, 45];
  const mats = ['brick', 'brick_dark', 'plaster_yellow', 'plaster_white', 'concrete_panel', 'plaster_dark'];
  for (const bx of centers) for (const bz of centers) {
    const key = `${bx},${bz}`;
    // curb around the block
    for (const [x0, z0, x1, z1] of [[bx - 11, bz - 11, bx + 11, bz - 10.7], [bx - 11, bz + 10.7, bx + 11, bz + 11], [bx - 11, bz - 10.7, bx - 10.7, bz + 10.7], [bx + 10.7, bz - 10.7, bx + 11, bz + 10.7]])
      push(c.boxes, R(x0, 0, z0, x1, 0.15, z1, 'stone'));
    if (key === '45,45') { // park
      push(c.deco, R(bx - 10.7, 0, bz - 10.7, bx + 10.7, 0.04, bz + 10.7, 'grass'));
      for (let i = 0; i < 9; i++) tree(c, bx + ri(-8, 8), bz + ri(-8, 8), 0.8 + rnd() * 0.5);
      push(c.deco, B(bx, bz, 6, 4, 0.3, 'water')); push(c.boxes, B(bx, bz - 2.3, 6.6, 0.5, 0.6, 'stone')); push(c.boxes, B(bx, bz + 2.3, 6.6, 0.5, 0.6, 'stone'));
      push(c.boxes, B(bx - 3.3, bz, 0.5, 4, 0.6, 'stone')); push(c.boxes, B(bx + 3.3, bz, 0.5, 4, 0.6, 'stone'));
      push(c.boxes, B(bx - 6, bz + 7, 1.2, 1.2, 1.6, 'stone')); push(c.deco, B(bx - 6, bz + 7, 0.5, 0.5, 1.4, 'metal', 1.6));
      for (const [dx, dz] of [[-5, -6], [5, -6], [6, 5]]) bench(c, bx + dx, bz + dz, dx > 0);
      continue;
    }
    push(c.deco, R(bx - 10.7, 0, bz - 10.7, bx + 10.7, 0.04, bz + 10.7, 'paving'));
    if (key === '-45,-45') { // gas station
      for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 0], [6, 0]]) push(c.boxes, B(bx + dx, bz + dz, 0.5, 0.5, 4.4, 'metal'));
      push(c.boxes, R(bx - 8, 4.4, bz - 8, bx + 8, 4.8, bz + 2, 'metal_roof'));
      push(c.deco, R(bx - 8.05, 4.5, bz - 8.05, bx + 8.05, 4.75, bz + 2.05, 'awning_red'));
      for (const dx of [-3, 3]) { push(c.boxes, B(bx + dx, bz - 3, 0.9, 1.3, 1.7, 'pump')); push(c.deco, B(bx + dx, bz - 3, 0.95, 1.35, 0.15, 'trim', 1.7)); }
      building(c, { x: bx, z: bz + 7, w: 12, d: 6, floors: 1, m: 'plaster_white', doors: { s: [-3] }, floorM: 'floor_tile' });
      car(c, bx - 3, bz - 6, 0, 'car_red');
      continue;
    }
    if (key === '45,-45') { // parking lot
      for (let i = -2; i <= 2; i++) for (const dz of [-6, 0, 6]) {
        push(c.deco, B(bx + i * 3.4 - 1.7, bz + dz, 0.12, 4.6, 0.02, 'paint_white', 0.045));
        if (rnd() < 0.6) car(c, bx + i * 3.4, bz + dz, 0, pk(['car_red', 'car_blue', 'car_glass']));
      }
      container(c, bx + 8, bz + 8, 1, 'container_green');
      continue;
    }
    const lots = [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]];
    const roofs = [];
    for (const [lx, lz] of lots) {
      const x = bx + lx, z = bz + lz;
      if (rnd() < 0.12) { dumpster(c, x, z - 2, rnd() < 0.5); crate(c, x + 2, z + 2); crate(c, x + 3.3, z + 2.2, 1.0); roofs.push(null); continue; }
      const w = pk([8, 9, 10]), d = pk([8, 9, 10]), floors = pk([1, 2, 2, 3, 3, 4]);
      const doors = { [lx < 0 ? 'w' : 'e']: [0], [lz < 0 ? 's' : 'n']: [lz < 0 ? 0 : w / 2 - 1.3] };
      building(c, { x, z, w, d, floors, m: pk(mats), doors, floorM: pk(['floor_wood', 'floor_tile']), partition: floors >= 2 && w >= 9 ? -1.5 : undefined });
      roofs.push({ x, z, w, d, top: floors * 3.2, floors });
      if (rnd() < 0.35) rnd(); // (was a rooftop neon sign — removed; keep the rolls so the rest of the layout doesn't shift)
    }
    // rooftop bridges between neighbours of the same height (vault over the parapet to cross)
    for (const [a, b, axis] of [[0, 1, 'x'], [2, 3, 'x'], [0, 2, 'z'], [1, 3, 'z']]) {
      const A = roofs[a], Bb = roofs[b];
      if (!A || !Bb || A.floors < 2 || A.floors !== Bb.floors) continue;
      const top = A.top;
      if (axis === 'x') push(c.boxes, R(A.x + A.w / 2 - 0.3, top - 0.15, A.z - 0.7, Bb.x - Bb.w / 2 + 0.3, top + 0.05, A.z + 0.7, 'wood'));
      else push(c.boxes, R(A.x - 0.7, top - 0.15, A.z + A.d / 2 - 0.3, A.x + 0.7, top + 0.05, Bb.z - Bb.d / 2 + 0.3, 'wood'));
    }
  }
  // road markings
  for (const s of [-30, 0, 30]) for (let t = -56; t <= 56; t += 4) {
    if ([-30, 0, 30].some(q => Math.abs(q - t) < 5)) continue;
    push(c.deco, B(t, s, 2, 0.18, 0.02, 'paint_white', 0.045));
    push(c.deco, B(s, t, 0.18, 2, 0.02, 'paint_white', 0.045));
  }
  // parked cars + street lamps
  for (let i = 0; i < 18; i++) {
    const s = pk([-30, 0, 30]), t = ri(-52, 52), side = pk([-2.6, 2.6]);
    if ([-30, 0, 30].some(q => Math.abs(q - t) < 6)) continue;
    if (rnd() < 0.5) car(c, t, s + side, 1, pk(['car_red', 'car_blue'])); else car(c, s + side, t, 0, pk(['car_red', 'car_blue']));
  }
  for (const s of [-30, 30]) for (const t of [-45, -15, 15, 45]) { lamp(c, s - 3.7, t + 4); lamp(c, t + 4, s + 3.7); }
  // bus
  push(c.boxes, B(-15, -2.6, 10, 2.6, 2.6, 'bus', 0.3)); push(c.deco, B(-15, -2.6, 9.4, 2.65, 0.9, 'car_glass', 1.5));
  for (const dx of [-3.5, 3.5]) push(c.deco, B(-15 + dx, -2.6, 1.0, 2.7, 0.8, 'tire'));
  fountain(c, 0, 0);
  for (const [x, z] of [[-30, 8], [30, -8], [8, 30], [-8, -30], [22, 0], [-22, 0]]) jumpPad(c, x, z);
  return c;
}

function militaryBase() {
  const q = newCtx();
  building(q, { x: -22, z: 36, w: 26, d: 16, fh: 7, floors: 1, roof: false, m: 'metal_corr', roofM: 'metal_roof', floorM: 'concrete_floor',
    doors: { s: [{ c: 0, w: 9, h: 5.6 }], e: [2] }, winY: [4.8, 6.0], winGap: 5 });
  // jet inside the hangar
  push(q.boxes, B(-22, 37, 1.8, 11, 1.7, 'jet', 0.9));
  push(q.boxes, R(-29, 1.4, 36.5, -15, 1.6, 39.5, 'jet')); // wings (solid)
  push(q.boxes, B(-22, 41.8, 0.25, 1.6, 2.4, 'jet', 2.4)); push(q.boxes, R(-24.5, 2.2, 41.3, -19.5, 2.35, 42.6, 'jet')); // tail fin + tailplane
  push(q.deco, B(-22, 31.9, 1.2, 1.4, 0.8, 'car_glass', 2.2));
  for (const [dx, dz] of [[0, 33], [-1.5, 38.5], [1.5, 38.5]]) push(q.deco, B(-22 + dx, dz, 0.3, 0.3, 0.9, 'tire'));
  crate(q, -32, 30); crate(q, -30.7, 30.2, 1.0); crate(q, -32, 30, 1.0, 1.2);
  // barracks
  building(q, { x: 20, z: 36, w: 16, d: 8, floors: 2, m: 'bunker', doors: { s: [-4, 4] }, partition: 1, floorM: 'floor_wood' });
  // tents, vehicles, fuel, sandbags
  for (const x of [4, 10]) { push(q.boxes, B(x, 22, 4.5, 4, 2.0, 'tent')); push(q.deco, B(x, 22, 4.7, 0.5, 0.6, 'tent', 2.0)); }
  tank(q, 36, 14, 0); tank(q, -40, 12, 1);
  armyTruck(q, 30, 23.5);
  for (const x of [46, 50.5]) { push(q.boxes, B(x, 32, 3.4, 3.4, 3.6, 'fueltank')); push(q.deco, B(x, 32, 3.6, 3.6, 0.2, 'metal_dark', 3.6)); }
  sandbags(q, -8, 18, 6, 0.9); sandbags(q, 12, 12, 0.9, 6); sandbags(q, -26, 16, 0.9, 5); sandbags(q, 26, 6, 6, 0.9);
  container(q, -46, 26, 0, 'container_green'); container(q, -46, 26, 0, 'container_blue', 2.6); container(q, -41, 28, 0, 'container_red');
  watchtower(q, 50, 50); watchtower(q, -50, 50);
  // helipad
  push(q.deco, R(-6, 0, 38, 6, 0.05, 50, 'concrete_floor'));
  for (const [x0, z0, x1, z1] of [[-2, 41, -1.2, 47], [1.2, 41, 2, 47], [-1.2, 43.6, 1.2, 44.4]]) push(q.deco, R(x0, 0.05, z0, x1, 0.07, z1, 'paint_white'));
  jumpPad(q, 10, 30.6); jumpPad(q, -36.6, 34);
  const c = newCtx();
  addRot(c, q, [0, 2]);
  // HQ in the middle + parade ground with flag
  push(c.deco, R(-14, 0, -12, 14, 0.04, 12, 'asphalt'));
  building(c, { x: 0, z: 0, w: 14, d: 10, floors: 3, m: 'concrete_panel', doors: { s: [0], e: [0], w: [0], n: [5.7] }, floorM: 'floor_tile', partition: 2 });
  push(c.deco, B(9, -8, 0.15, 0.15, 9, 'metal')); push(c.deco, R(9.1, 7.4, -8.05, 11.4, 8.8, -7.95, 'flag'));
  for (const [x, z] of [[-20, 0], [20, 0]]) barrier(c, x, z, 1, 5);
  return c;
}

function killhouse() {
  const q = newCtx();
  q.boxes.push(B(5, 5, 6, 0.4, 3, 'plaster_white'), B(10, 8.5, 0.4, 6, 3, 'plaster_white'), B(14.5, 2, 4, 0.4, 3, 'plaster_white'), B(4, 13.5, 0.4, 5, 3, 'plaster_white'));
  crate(q, 8, 12.5); crate(q, 14.5, 14.5, 1.6);
  q.boxes.push(B(15, 9, 3, 0.4, 1.1, 'concrete'));
  barrel(q, 16.5, 6);
  for (const b of [...q.boxes]) if (b.max[1] >= 3) q.deco.push({ min: [b.min[0] - 0.02, 2.9, b.min[2] - 0.02], max: [b.max[0] + 0.02, 3.05, b.max[2] + 0.02], m: 'trim' });
  const c = newCtx();
  addRot(c, q, [0, 1, 2, 3]);
  crate(c, 0, 0, 2);
  return c;
}

export const MAPS = {
  town:      { name: 'Old Town',      size: 72, theme: 'town',      build: town,      desc: 'Plaza, shops and rooftops' },
  harbor:    { name: 'Harbor',        size: 80, theme: 'harbor',    build: harbor,    desc: 'Warehouses and container stacks' },
  neon:      { name: 'Neon District', size: 66, theme: 'neon',      build: neon,      desc: 'Night city blocks' },
  frost:     { name: 'Frostbite',     size: 64, theme: 'snow',      build: frost,     desc: 'Arctic research base' },
  dune:      { name: 'Dune Village',  size: 72, theme: 'desert',    build: dune,      desc: 'Mud-brick desert village' },
  construction: { name: 'Construction Site', size: 70, theme: 'construction', build: construction, desc: 'Unfinished tower, scaffolding and a crane' },
  downtown:  { name: 'Downtown',      size: 120, theme: 'city',     build: downtown,  desc: 'LARGE · City blocks, rooftop bridges, jump pads', big: true },
  base:      { name: 'Military Base', size: 116, theme: 'base',     build: militaryBase, desc: 'LARGE · Hangar, barracks, tanks, watchtowers', big: true },
  killhouse: { name: 'Killhouse',     size: 38, theme: 'killhouse', build: killhouse, desc: 'Small close-quarters arena' },
};
export const MAP_ORDER = ['downtown', 'base', 'town', 'harbor', 'neon', 'frost', 'dune', 'construction', 'killhouse'];

function overlapsAny(x, z, r, h, boxes) {
  for (const b of boxes)
    if (x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2] && b.min[1] < h) return true;
  return false;
}

const cache = {};
export function buildMap(id) {
  if (cache[id]) return cache[id];
  const def = MAPS[id] || MAPS.town;
  const half = def.size / 2;
  const ctx = def.build();
  const boxes = ctx.boxes;
  const wallH = 12;
  boxes.push(B(0, -half - 1, def.size + 4, 2, wallH, 'wall'));
  boxes.push(B(0, half + 1, def.size + 4, 2, wallH, 'wall'));
  boxes.push(B(-half - 1, 0, 2, def.size + 4, wallH, 'wall'));
  boxes.push(B(half + 1, 0, 2, def.size + 4, wallH, 'wall'));

  // spawn points / bot waypoints on open ground
  const cands = [];
  for (let x = -half + 2.5; x <= half - 2.5; x += 2.5)
    for (let z = -half + 2.5; z <= half - 2.5; z += 2.5)
      if (!overlapsAny(x, z, 0.9, 3.5, boxes)) cands.push([x, 0, z]);
  const spawns = [];
  if (cands.length) {
    spawns.push(cands.reduce((a, c) => (c[0] + c[2] < a[0] + a[2] ? c : a)));
    while (spawns.length < Math.min(def.big ? 36 : 24, cands.length)) {
      let best = null, bestD = -1;
      for (const c of cands) {
        let md = Infinity;
        for (const s of spawns) md = Math.min(md, (c[0] - s[0]) ** 2 + (c[2] - s[2]) ** 2);
        if (md > bestD) { bestD = md; best = c; }
      }
      spawns.push(best);
    }
  }
  // spatial grid so physics / line-of-sight only look at nearby boxes
  const CELL = 6, grid = new Map();
  boxes.forEach((b, i) => {
    for (let cx = Math.floor(b.min[0] / CELL); cx <= Math.floor(b.max[0] / CELL); cx++)
      for (let cz = Math.floor(b.min[2] / CELL); cz <= Math.floor(b.max[2] / CELL); cz++) {
        const k = cx * 1000 + cz;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
  });
  const stamp = new Int32Array(boxes.length);
  let tag = 0;
  const query = (x0, z0, x1, z1) => {
    tag++;
    const out = [];
    for (let cx = Math.floor(Math.min(x0, x1) / CELL); cx <= Math.floor(Math.max(x0, x1) / CELL); cx++)
      for (let cz = Math.floor(Math.min(z0, z1) / CELL); cz <= Math.floor(Math.max(z0, z1) / CELL); cz++) {
        const list = grid.get(cx * 1000 + cz);
        if (list) for (const i of list) if (stamp[i] !== tag) { stamp[i] = tag; out.push(boxes[i]); }
      }
    return out;
  };
  // pickups: power-ups near the middle, health & ammo spread around
  const pool = cands.filter(p => Math.abs(p[0]) < half - 4 && Math.abs(p[2]) < half - 4 && !spawns.some(s => Math.hypot(s[0] - p[0], s[2] - p[2]) < 3));
  const pickups = [];
  if (pool.length) {
    const picked = [pool.reduce((a, p) => (Math.hypot(p[0], p[2]) < Math.hypot(a[0], a[2]) ? p : a))];
    const n = def.big ? 16 : def.size < 45 ? 5 : 9;
    while (picked.length < Math.min(n, pool.length)) {
      let best = null, bd = -1;
      for (const p of pool) { let md = Infinity; for (const o of picked) md = Math.min(md, Math.hypot(p[0] - o[0], p[2] - o[2])); if (md > bd) { bd = md; best = p; } }
      picked.push(best);
    }
    const kinds = ['damage', 'speed'];
    picked.forEach((p, i) => pickups.push({ id: i, kind: kinds[i] || (i % 2 ? 'health' : 'ammo'), x: p[0], y: 0, z: p[2] }));
    if (def.size < 45) pickups[1].kind = 'health';
  }
  return (cache[id] = { id, name: def.name, size: def.size, big: !!def.big, theme: def.theme, boxes, deco: ctx.deco, spawns, waypoints: cands, query, pickups });
}
