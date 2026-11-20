// Map-building kit: box helpers, the building generator and props. Shared by every map file.
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
  // parapet, with optional gaps (o.parapetGaps: [{ side, c: offset from centre, w }]) e.g. where a roof bridge lands
  const pg = side => (o.parapetGaps || []).filter(g => g.side === side).map(g => ({ a: (side === 's' || side === 'n' ? x : z) + g.c - g.w / 2, b: (side === "s" || side === "n" ? x : z) + g.c + g.w / 2, y0: 0, y1: ph }));
  wallRun(c, 'x', x0, x1, z0 + pt / 2, top, ph, pg('s'), m, pt, null);
  wallRun(c, 'x', x0, x1, z1 - pt / 2, top, ph, pg('n'), m, pt, null);
  wallRun(c, 'z', z0 + pt, z1 - pt, x0 + pt / 2, top, ph, pg('w'), m, pt, null);
  wallRun(c, 'z', z0 + pt, z1 - pt, x1 - pt / 2, top, ph, pg('e'), m, pt, null);
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

// ================================================================ placement helpers
// Author something at the origin (facing -z), then rotate it by quarter turns (1 = faces +x, 2 = +z, 3 = -x) and move it.
function placeRot(c, x, z, rot, fn, dy = 0) {
  const t = newCtx(); fn(t);
  for (const k of ['boxes', 'deco']) for (const b0 of t[k]) {
    const b = rotBox(b0, ((rot % 4) + 4) % 4);
    c[k].push({ min: [b.min[0] + x, b.min[1] + dy, b.min[2] + z], max: [b.max[0] + x, b.max[1] + dy, b.max[2] + z], m: b.m });
  }
}
const place = (c, x, y, z, fn) => placeRot(c, x, z, 0, fn, y);

// ================================================================ more props
// Stepped gable roof (ridge along x when ridgeX) on top of a rectangle; returns the ridge height.
function gableRoof(c, x0, z0, x1, z1, y, m = 'roof_red', ridgeX = true, oh = 0.35) {
  const span = ridgeX ? z1 - z0 : x1 - x0, steps = Math.max(3, Math.round(span / 2 / 0.55)), h = 0.38;
  for (let k = 0; k < steps; k++) {
    const ins = k * (span / 2) / steps;
    push(c.boxes, ridgeX ? R(x0 - oh, y + k * h, z0 - oh + ins, x1 + oh, y + (k + 1) * h, z1 + oh - ins, m)
                         : R(x0 - oh + ins, y + k * h, z0 - oh, x1 + oh - ins, y + (k + 1) * h, z1 + oh, m));
  }
  const top = y + steps * h, mz = (z0 + z1) / 2, mx = (x0 + x1) / 2;
  push(c.deco, ridgeX ? R(x0 - oh - 0.04, top, mz - 0.14, x1 + oh + 0.04, top + 0.1, mz + 0.14, 'trim') : R(mx - 0.14, top, z0 - oh - 0.04, mx + 0.14, top + 0.1, z1 + oh + 0.04, 'trim'));
  return top;
}
// Suburban house at (x,z) facing rot: walls with windows, doors, stepped roof, chimney, porch with posts.
function house(c, x, z, rot, o = {}) {
  const w = o.w || 9, d = o.d || 8, floors = o.floors || 1, m = o.m || 'siding_white', rm = o.roofM || 'roof_red';
  placeRot(c, x, z, rot, (t) => {
    const px = o.doorX ?? -w / 4;
    building(t, { x: 0, z: 0, w, d, floors, m, roof: false, floorM: 'floor_wood', roofM: 'roof', doors: { s: [px], n: o.backDoor === false ? [] : [w / 4] }, partition: floors > 1 || w >= 10 ? 0.6 : undefined, winGap: 2.6 });
    const top = floors * FH;
    gableRoof(t, -w / 2, -d / 2, w / 2, d / 2, top, rm, true);
    push(t.boxes, B(w / 2 - 1.4, d / 4, 0.9, 0.9, 3.0, 'brick', top)); push(t.deco, B(w / 2 - 1.4, d / 4, 1.05, 1.05, 0.12, 'stone', top + 3.0)); // chimney
    // porch: low deck, posts and a little roof over the front door
    push(t.boxes, R(px - 1.8, 0, -d / 2 - 1.8, px + 1.8, 0.22, -d / 2, 'wood'));
    for (const sx of [-1.65, 1.65]) push(t.deco, B(px + sx, -d / 2 - 1.65, 0.14, 0.14, 2.6, 'trim', 0.22));
    push(t.deco, R(px - 1.95, 2.8, -d / 2 - 1.95, px + 1.95, 2.95, -d / 2, rm));
    // plinth: a strip just outside the walls (not a slab over the whole footprint: that covered the floor indoors)
    const pw = 0.12, hw = w / 2, hd = d / 2;
    const strip = (zA, zB, doorC) => { // along x, broken where a door is
      const segs = doorC === null ? [[-hw - pw, hw + pw]] : [[-hw - pw, doorC - 0.75], [doorC + 0.75, hw + pw]];
      for (const [a, b] of segs) push(t.deco, R(a, 0, zA, b, 0.35, zB, 'stone'));
    };
    strip(-hd - pw, -hd, px);
    strip(hd, hd + pw, o.backDoor === false ? null : w / 4);
    push(t.deco, R(-hw - pw, 0, -hd, -hw, 0.35, hd, 'stone'));
    push(t.deco, R(hw, 0, -hd, hw + pw, 0.35, hd, 'stone'));
  });
}
// Low fence/wall along a straight line with optional gaps (centres along the line, 1.6 m wide).
function fence(c, x0, z0, x1, z1, m = 'fence_white', h = 1.0, gaps = []) {
  const ax = Math.abs(x1 - x0) >= Math.abs(z1 - z0) ? 'x' : 'z';
  const a0 = ax === 'x' ? Math.min(x0, x1) : Math.min(z0, z1), a1 = ax === 'x' ? Math.max(x0, x1) : Math.max(z0, z1), fixed = ax === 'x' ? z0 : x0;
  wallRun(c, ax, a0, a1, fixed, 0, h, gaps.map(g => ({ a: g - 0.8, b: g + 0.8, y0: 0, y1: h + 0.2 })), m, 0.1, null);
  for (let a = a0; a <= a1 + 0.01; a += 2) if (!gaps.some(g => Math.abs(g - a) < 0.9))
    push(c.deco, ax === 'x' ? B(a, fixed, 0.16, 0.16, h + 0.12, m) : B(fixed, a, 0.16, 0.16, h + 0.12, m));
}
const hedge = (c, x0, z0, x1, z1, h = 1.3) => push(c.boxes, R(x0, 0, z0, x1, h, z1, 'hedge'));
// Raised swimming pool: tiled basin, coping, water, ladder and a diving board.
function pool(c, x, z, w, d) {
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, t = 0.35, h = 0.45;
  for (const r of [R(x0, 0, z0, x1, h, z0 + t), R(x0, 0, z1 - t, x1, h, z1), R(x0, 0, z0 + t, x0 + t, h, z1 - t), R(x1 - t, 0, z0 + t, x1, h, z1 - t)]) push(c.boxes, { ...r, m: 'stone' });
  push(c.deco, R(x0 + t, 0, z0 + t, x1 - t, 0.03, z1 - t, 'pool_tile'));
  push(c.deco, R(x0 + t, 0.03, z0 + t, x1 - t, 0.34, z1 - t, 'water'));
  push(c.deco, R(x1 - t - 0.5, 0.2, z1 - t - 0.06, x1 - t - 0.44, 1.2, z1 - t, 'metal')); push(c.deco, R(x1 - t - 1.06, 0.2, z1 - t - 0.06, x1 - t - 1.0, 1.2, z1 - t, 'metal'));
  push(c.boxes, R(x - 0.3, h, z0 - 0.4, x + 0.3, h + 0.12, z0 + 1.4, 'trim'));
}
// Natural rock wall along a line: segments of varying height with inset strata and outcrops.
function cliff(c, x0, z0, x1, z1, h, rnd, m = 'rock', segLen = 4.5, band = m === 'rock' ? 'rock_dark' : m) {
  const ax = Math.abs(x1 - x0) >= Math.abs(z1 - z0) ? 'x' : 'z';
  const a0 = ax === 'x' ? Math.min(x0, x1) : Math.min(z0, z1), a1 = ax === 'x' ? Math.max(x0, x1) : Math.max(z0, z1);
  const t0 = ax === 'x' ? Math.min(z0, z1) : Math.min(x0, x1), t1 = ax === 'x' ? Math.max(z0, z1) : Math.max(x0, x1);
  const box = (sa, sb, ya, yb, ta, tb, mm, dst = c.boxes) => push(dst, ax === 'x' ? R(sa, ya, ta, sb, yb, tb, mm) : R(ta, ya, sa, tb, yb, sb, mm));
  for (let a = a0; a < a1 - 0.01;) {
    const b = Math.min(a1, a + segLen * (0.7 + rnd() * 0.6)), hh = h * (0.8 + rnd() * 0.35);
    box(a, b, 0, hh * 0.62, t0, t1, m);
    const i0 = rnd() * 0.9, i1 = rnd() * 0.9;
    box(a, b, hh * 0.62, hh, t0 + i0, t1 - i1, m);
    if (rnd() < 0.5) { const s0 = a + (b - a) * rnd() * 0.5, s1 = Math.min(b, s0 + (b - a) * (0.3 + rnd() * 0.4)); box(s0, s1, hh, hh + 0.8 + rnd() * 1.6, t0 + i0 + 0.4, t1 - i1 - 0.4, m); }
    box(a, b, hh * 0.6, hh * 0.64, t0 - 0.06, t1 + 0.06, band, c.deco);
    if (rnd() < 0.55) { const y = hh * (0.2 + rnd() * 0.3), mid = (a + b) / 2; box(mid - 0.8, mid + 0.8, y, y + 0.9, t0 - 0.5, t1 + 0.5, m, c.deco); }
    a = b;
  }
}
// Stacked mesa / rock outcrop with a darker strata band; tiers step in towards the top.
function mesa(c, x, z, w, d, h, rnd, m = 'rock') {
  push(c.boxes, B(x, z, w, d, h * 0.55, m));
  const iw = w - 1.5 - rnd() * 1.5, id = d - 1.5 - rnd() * 1.5;
  push(c.boxes, B(x + (rnd() - 0.5), z + (rnd() - 0.5), iw, id, h * 0.45, m, h * 0.55));
  push(c.deco, B(x, z, w + 0.1, d + 0.1, 0.25, 'rock_dark', h * 0.5));
  push(c.deco, B(x + (rnd() - 0.5) * w * 0.5, z - d / 2 - 0.3, 1.6, 0.8, 1.2, m, h * 0.25));
}
function bollard(c, x, z) { push(c.boxes, B(x, z, 0.35, 0.35, 0.7, 'metal_dark')); push(c.deco, B(x, z, 0.5, 0.5, 0.12, 'metal_dark', 0.6)); }
function pallets(c, x, z, n = 3) { for (let i = 0; i < n; i++) push(c.boxes, B(x, z, 1.2, 1.0, 0.16, 'wood', i * 0.17)); push(c.boxes, B(x, z, 1.1, 0.9, 0.9, 'crate', n * 0.17)); }
function pipeStack(c, x, z, rot) {
  placeRot(c, x, z, rot, (t) => { push(t.boxes, B(0, 0, 5, 1.6, 1.0, 'metal_dark')); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) push(t.deco, B(0, -0.5 + i * 0.5, 5.1, 0.42, 0.42, 'metal', 0.05 + j * 0.48)); });
}
function rails(c, x0, z, x1) { // railway track along x
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 0.9) push(c.deco, B(x, z, 0.3, 2.4, 0.06, 'wood', 0.02));
  for (const s of [-0.72, 0.72]) push(c.deco, R(Math.min(x0, x1), 0.08, z + s - 0.05, Math.max(x0, x1), 0.18, z + s + 0.05, 'metal'));
}
// Rail-mounted gantry crane spanning `span` along z: legs, girders, trolley, cab and hoist.
function gantry(c, x, z, span, h, m = 'crane') {
  for (const sx of [-4, 4]) for (const sz of [-span / 2, span / 2]) { push(c.boxes, B(x + sx, z + sz, 1.0, 1.0, h, m)); push(c.deco, B(x + sx, z + sz, 1.6, 1.6, 0.6, 'metal_dark')); }
  for (const sx of [-4, 4]) push(c.deco, R(x + sx - 0.6, h, z - span / 2 - 0.6, x + sx + 0.6, h + 1.4, z + span / 2 + 0.6, m));
  for (const sz of [-span / 2, span / 2]) push(c.deco, R(x - 4.6, h - 1.2, z + sz - 0.5, x + 4.6, h, z + sz + 0.5, m));
  const tz = z + span * 0.15;
  push(c.deco, B(x, tz, 9.6, 2.4, 1.2, 'metal_dark', h + 1.4)); push(c.deco, B(x + 2.2, tz + 1.6, 2.0, 1.6, 1.8, 'panel_white', h - 1.6));
  push(c.deco, B(x - 0.6, tz, 0.08, 0.08, h * 0.45, 'metal_dark', h * 0.55)); push(c.deco, B(x + 0.6, tz, 0.08, 0.08, h * 0.45, 'metal_dark', h * 0.55));
  push(c.deco, B(x, tz, 2.6, 1.0, 0.5, 'metal_dark', h * 0.55 - 0.5));
}
// Semi truck facing -z (cab + box trailer) — rotate with placeRot.
function semiTruck(c, x, z, rot, trailer = 'container_blue') {
  placeRot(c, x, z, rot, (t) => {
    push(t.boxes, R(-1.2, 0.4, -6.2, 1.2, 2.6, -4.2, 'car_red')); push(t.deco, R(-1.0, 1.7, -6.25, 1.0, 2.4, -6.2, 'car_glass'));
    push(t.boxes, R(-1.15, 0.4, -7.0, 1.15, 1.5, -6.2, 'car_red')); push(t.deco, R(-0.8, 0.6, -7.05, 0.8, 1.3, -7.0, 'metal_dark'));
    for (const sx of [-0.9, 0.9]) push(t.deco, B(sx, -7.03, 0.25, 0.04, 0.16, 'headlight', 1.0));
    push(t.boxes, R(-1.25, 1.0, -4.1, 1.25, 3.8, 6.2, trailer)); push(t.deco, R(-1.3, 3.7, -4.15, 1.3, 3.85, 6.25, 'metal_dark'));
    push(t.boxes, R(-1.0, 0.35, -6.4, 1.0, 1.0, 6.0, 'metal_dark'));
    for (const wz of [-6.3, -4.6, 3.6, 4.8]) for (const sx of [-1.05, 1.05]) push(t.deco, B(sx, wz, 0.35, 1.0, 1.0, 'tire'));
  });
}
function waterTower(c, x, z, y) {
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) push(c.deco, B(x + dx, z + dz, 0.16, 0.16, 2.2, 'metal_dark', y));
  push(c.boxes, B(x, z, 2.6, 2.6, 2.2, 'wood', y + 2.2)); push(c.deco, B(x, z, 2.7, 2.7, 0.1, 'metal_dark', y + 2.9)); push(c.deco, B(x, z, 2.7, 2.7, 0.1, 'metal_dark', y + 3.7));
  push(c.deco, B(x, z, 2.2, 2.2, 0.35, 'metal_roof', y + 4.4)); push(c.deco, B(x, z, 1.2, 1.2, 0.3, 'metal_roof', y + 4.75));
}
function acUnit(c, x, z, y) { push(c.boxes, B(x, z, 1.3, 0.9, 0.9, 'metal', y)); push(c.deco, B(x, z - 0.47, 0.9, 0.04, 0.6, 'metal_grate', y + 0.15)); }
function trafficLight(c, x, z) { push(c.boxes, B(x, z, 0.18, 0.18, 3.4, 'metal_dark')); push(c.deco, B(x, z, 0.36, 0.3, 1.0, 'metal_dark', 3.4)); for (const [i, col] of [[0, 'taillight'], [1, 'neon_orange'], [2, 'lamp']]) push(c.deco, B(x, z - 0.16, 0.18, 0.04, 0.18, col, 4.12 - i * 0.3)); }
function busStop(c, x, z, rot) {
  placeRot(c, x, z, rot, (t) => {
    push(t.boxes, R(-1.8, 0, 0.6, 1.8, 2.4, 0.7, 'car_glass')); push(t.deco, R(-2.0, 2.4, -0.6, 2.0, 2.55, 0.8, 'metal_roof'));
    for (const sx of [-1.85, 1.85]) push(t.deco, B(sx, 0.65, 0.12, 0.12, 2.4, 'metal_dark'));
    push(t.boxes, R(-1.4, 0, 0.1, 1.4, 0.48, 0.55, 'wood'));
  });
}
function playground(c, x, z) {
  stairRun(c, x - 2, z - 1.5, 0, 1, 0.9, 4, 0.4, 'wood');
  push(c.boxes, B(x - 2, z + 1.3, 1.6, 1.6, 0.15, 'wood', 1.45));
  for (const [dx, dz] of [[-0.7, 0.6], [0.7, 0.6], [-0.7, 2.0], [0.7, 2.0]]) push(c.boxes, B(x - 2 + dx, z + dz, 0.14, 0.14, 2.6, 'barrel_red'));
  push(c.deco, B(x - 2, z + 1.3, 1.9, 1.9, 0.12, 'awning_red', 2.6));
  for (let i = 0; i < 5; i++) push(c.boxes, B(x - 0.4 + i * 0.5, z + 1.3, 0.5, 0.9, 0.1, 'forklift', 1.45 - i * 0.29)); // slide
  for (const sx of [2.2, 4.8]) push(c.deco, B(x + sx, z, 0.12, 0.12, 2.6, 'metal_dark'));
  push(c.deco, R(x + 2.1, 2.55, z - 0.06, x + 4.9, 2.65, z + 0.06, 'metal_dark'));
  for (const sx of [2.9, 4.1]) { push(c.deco, B(sx + x, z, 0.03, 0.03, 1.9, 'metal', 0.65)); push(c.deco, B(sx + x, z, 0.5, 0.25, 0.06, 'wood', 0.6)); }
}
function goalPosts(c, x, z, rot) {
  placeRot(c, x, z, rot, (t) => { for (const sx of [-3.6, 3.6]) push(t.boxes, B(sx, 0, 0.14, 0.14, 2.4, 'trim')); push(t.deco, R(-3.67, 2.4, -0.07, 3.67, 2.52, 0.07, 'trim')); push(t.deco, R(-3.6, 0, 1.4, 3.6, 2.4, 1.44, 'metal_grate')); });
}
function hoop(c, x, z, rot) {
  placeRot(c, x, z, rot, (t) => { push(t.boxes, B(0, 0.8, 0.18, 0.18, 3.0, 'metal_dark')); push(t.deco, B(0, 0.62, 1.8, 0.08, 1.1, 'trim', 2.9)); push(t.deco, R(-0.35, 3.05, -0.2, 0.35, 3.1, 0.58, 'neon_orange')); });
}
function gazebo(c, x, z) {
  push(c.boxes, B(x, z, 5, 5, 0.3, 'wood'));
  for (const [dx, dz] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) push(c.boxes, B(x + dx, z + dz, 0.2, 0.2, 2.8, 'trim', 0.3));
  for (let k = 0; k < 4; k++) push(c.deco, B(x, z, 5.8 - k * 1.4, 5.8 - k * 1.4, 0.3, 'roof_slate', 3.1 + k * 0.3));
  for (const [dx, dz, w, d] of [[0, -2.3, 4.4, 0.1], [-2.3, 0, 0.1, 4.4], [2.3, 0, 0.1, 4.4]]) push(c.boxes, B(x + dx, z + dz, w, d, 0.8, 'trim', 0.3));
}
// Stepped dome (visual) on a square drum.
function stepDome(c, x, z, r, y, m = 'plaster_white', cap = 'metal', solid = false) { // solid: on a walkable roof, so you stand on it instead of inside it
  const n = 6;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI / 2, s = 2 * r * Math.cos(a); push(solid ? c.boxes : c.deco, B(x, z, s, s, r / n + 0.02, m, y + Math.sin(a) * r)); }
  push(c.deco, B(x, z, 0.3, 0.3, 1.4, cap, y + r)); push(c.deco, B(x, z, 0.6, 0.6, 0.3, cap, y + r + 0.4));
}
function tent(c, x, z, w, d, m = 'tent', h = 2.2) {
  push(c.boxes, B(x, z, w, d, h * 0.7, m)); push(c.boxes, B(x, z, w - 1, d + 0.2, h * 0.3, m, h * 0.7)); push(c.deco, B(x, z, 0.2, d + 0.3, 0.2, 'wood', h));
}
function mineCart(c, x, z, rot, dy = 0) {
  placeRot(c, x, z, rot, (t) => { push(t.boxes, B(0, 0, 1.2, 1.8, 0.9, 'metal_dark', 0.35)); push(t.deco, B(0, 0, 1.0, 1.6, 0.15, 'rock_dark', 1.25)); for (const [sx, sz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) push(t.deco, B(sx, sz, 0.12, 0.45, 0.45, 'metal')); }, dy);
}
// Plank bridge with rope rails between two points at height y (along x or z).
function plankBridge(c, x0, z0, x1, z1, y, w = 1.8) {
  const ax = Math.abs(x1 - x0) >= Math.abs(z1 - z0) ? 'x' : 'z';
  const a0 = ax === 'x' ? Math.min(x0, x1) : Math.min(z0, z1), a1 = ax === 'x' ? Math.max(x0, x1) : Math.max(z0, z1), f = ax === 'x' ? z0 : x0;
  const bx = (sa, sb, ya, yb, ta, tb, m, dst = c.boxes) => push(dst, ax === 'x' ? R(sa, ya, ta, sb, yb, tb, m) : R(ta, ya, sa, tb, yb, sb, m));
  bx(a0, a1, y - 0.18, y, f - w / 2, f + w / 2, 'wood');
  for (let a = a0; a < a1; a += 0.5) bx(a, a + 0.04, y, y + 0.01, f - w / 2, f + w / 2, 'metal_dark', c.deco);
  for (const s of [-1, 1]) { bx(a0, a1, y + 0.95, y + 1.05, f + s * w / 2 - 0.04, f + s * w / 2 + 0.04, 'rope'); bx(a0, a1, y, y + 1.0, f + s * w / 2 - 0.02, f + s * w / 2 + 0.02, 'rope'); }
  for (let a = a0; a <= a1; a += 2.5) for (const s of [-1, 1]) bx(a - 0.06, a + 0.06, y - 0.2, y + 1.1, f + s * w / 2 - 0.06, f + s * w / 2 + 0.06, 'wood', c.deco);
}
// Wall-mounted lit sign flush with a facade (face points -z before rotation).
function wallSign(c, x, z, rot, y, w, h, neon, back = 'metal_dark') {
  placeRot(c, x, z, rot, (t) => {
    push(t.deco, R(-w / 2, y, -0.12, w / 2, y + h, 0, back));
    push(t.deco, R(-w / 2 + 0.08, y + 0.08, -0.16, w / 2 - 0.08, y + h - 0.08, -0.12, neon));
  });
}
function billboard(c, x, z, rot, y, w, h, face = 'billboard', base = 0) {
  placeRot(c, x, z, rot, (t) => {
    push(t.deco, R(-w / 2, y, -0.1, w / 2, y + h, 0.1, 'metal_dark')); push(t.deco, R(-w / 2 + 0.15, y + 0.15, -0.14, w / 2 - 0.15, y + h - 0.15, -0.1, face));
    for (const sx of [-w / 3, w / 3]) push(t.deco, B(sx, 0.3, 0.2, 0.2, y - base, 'metal_dark', base));
    push(t.deco, R(-w / 2, y - 0.1, -0.6, w / 2, y, 0.1, 'metal_grate'));
  });
}

// Floor slab from x0..x1, z0..z1 (top at y, thickness th) with rectangular holes [hx0,hz0,hx1,hz1].
function slabHoles(c, x0, z0, x1, z1, y, m, holes = [], th = 0.3) {
  const xs = [...new Set([x0, x1, ...holes.flatMap(h => [h[0], h[2]])].filter(v => v >= x0 && v <= x1))].sort((a, b) => a - b);
  const zs = [...new Set([z0, z1, ...holes.flatMap(h => [h[1], h[3]])].filter(v => v >= z0 && v <= z1))].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    let start = null;
    for (let j = 0; j < zs.length; j++) {
      const inside = j < zs.length - 1 && !holes.some(h => (xs[i] + xs[i + 1]) / 2 > h[0] && (xs[i] + xs[i + 1]) / 2 < h[2] && (zs[j] + zs[j + 1]) / 2 > h[1] && (zs[j] + zs[j + 1]) / 2 < h[3]);
      if (inside && start === null) start = zs[j];
      if (!inside && start !== null) { push(c.boxes, R(xs[i], y - th, start, xs[i + 1], y, zs[j], m)); start = null; }
    }
  }
}
// Open stair flight with thin treads (you can walk underneath), side stringers and a handrail.
function stairFlight(c, x, z, dx, dz, w, steps, stepH, m = 'metal_grate', base = 0, sd = 0.55, rail = true) {
  for (let i = 0; i < steps; i++) {
    const cx = x + dx * (i * sd + sd / 2), cz = z + dz * (i * sd + sd / 2), top = base + (i + 1) * stepH;
    push(c.boxes, B(cx, cz, dx ? sd : w, dz ? sd : w, Math.min(0.2, top - base), m, top - Math.min(0.2, top - base)));
  }
  const len = steps * sd, ex = x + dx * len, ez = z + dz * len, h1 = base + steps * stepH;
  for (const s of [-1, 1]) {
    const ox = dz ? s * (w / 2 + 0.04) : 0, oz = dx ? s * (w / 2 + 0.04) : 0;
    for (let k = 0; k < steps; k += 2) {
      const cx = x + dx * (k * sd + sd / 2) + ox, cz = z + dz * (k * sd + sd / 2) + oz, top = base + (k + 1) * stepH;
      push(c.deco, B(cx, cz, dx ? sd * 2 : 0.08, dz ? sd * 2 : 0.08, 0.25, 'metal_dark', top - 0.3));
      if (rail) push(c.deco, B(cx, cz, dx ? sd * 2 : 0.05, dz ? sd * 2 : 0.05, 0.05, 'metal', top + 0.95));
    }
    if (rail) { push(c.deco, B(x + ox, z + oz, 0.06, 0.06, 1.0, 'metal', base)); push(c.deco, B(ex + ox, ez + oz, 0.06, 0.06, 1.0, 'metal', h1)); }
  }
}
// Thin railing (collides) along a straight line at height y.
function railing(c, x0, z0, x1, z1, y, h = 1.05, m = 'metal') {
  const ax = Math.abs(x1 - x0) >= Math.abs(z1 - z0) ? 'x' : 'z';
  if (ax === 'x') { push(c.boxes, R(Math.min(x0, x1), y, z0 - 0.04, Math.max(x0, x1), y + h, z0 + 0.04, m)); for (let a = Math.min(x0, x1); a <= Math.max(x0, x1); a += 1.5) push(c.deco, B(a, z0, 0.08, 0.1, h + 0.04, 'metal_dark', y)); }
  else { push(c.boxes, R(x0 - 0.04, y, Math.min(z0, z1), x0 + 0.04, y + h, Math.max(z0, z1), m)); for (let a = Math.min(z0, z1); a <= Math.max(z0, z1); a += 1.5) push(c.deco, B(x0, a, 0.1, 0.08, h + 0.04, 'metal_dark', y)); }
}

export { R, B, push, newCtx, rotBox, addRot, FH, WT, SLAB, wallRun, slab, band, building, stairRun, car, tree, palm, stall, barrel, crate, sandbags, bench, lamp, container, fountain, dumpster, barrier, mulberry, jumpPad, tank, armyTruck, watchtower,
  placeRot, place, gableRoof, house, fence, hedge, pool, cliff, mesa, bollard, pallets, pipeStack, rails, gantry, semiTruck, waterTower, acUnit, trafficLight, busStop, playground, goalPosts, hoop, gazebo, stepDome, tent, mineCart, plankBridge, wallSign, billboard, slabHoles, stairFlight, railing };
