// Navigation graph for bots: walkable points on a 1m grid (ground, interiors, upper floors, roofs),
// connected where a simulated walk between them actually succeeds (so stairs and doorways work).
import { moveBody, PLAYER } from './physics.js';

const STEP = 0.5;
const cache = {};

function blocked(x, y, z, r, h, boxes) {
  for (const b of boxes)
    if (x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2] && y + h > b.min[1] && y < b.max[1]) return true;
  return false;
}

export function buildNav(map) {
  if (cache[map.id]) return cache[map.id];
  const half = map.size / 2 - 0.5;
  const nodes = [];              // {x,y,z}
  const cols = new Map();        // column key -> node indices
  const key = (i, j) => i * 4096 + j;
  const n = Math.floor((half * 2) / STEP);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -half + 0.25 + i * STEP, z = -half + 0.25 + j * STEP;
    const boxes = map.query(x - 1, z - 1, x + 1, z + 1);
    const hs = new Set([0]);
    for (const b of boxes) if (b.m !== 'wall' && x >= b.min[0] - 0.01 && x <= b.max[0] + 0.01 && z >= b.min[2] - 0.01 && z <= b.max[2] + 0.01) hs.add(b.max[1]); // (1 cm slack: tread edges)
    const lifted = new Set();
    for (let h of hs) {
      // a body standing here rests on the highest step-up-able surface under its footprint
      for (let it = 0; it < 4; it++) {
        let nh = h;
        for (const b of boxes) if (b.m !== 'wall' && x + 0.35 > b.min[0] && x - 0.35 < b.max[0] && z + 0.35 > b.min[2] && z - 0.35 < b.max[2] && b.max[1] > nh && b.max[1] <= h + PLAYER.stepUp && b.min[1] < h + PLAYER.stepUp) nh = b.max[1]; // (thin stair treads count too)
        if (nh === h) break;
        h = nh;
      }
      lifted.add(h);
    }
    for (const h of lifted) {
      if (h > 14) continue;
      if (blocked(x, h + 0.45, z, 0.2, PLAYER.height - 0.5, boxes)) continue; // ignore small steps next to the point
      const id = nodes.length;
      nodes.push({ x, y: h, z, i, j, e: [] });
      const k = key(i, j);
      if (!cols.has(k)) cols.set(k, []);
      cols.get(k).push(id);
    }
  }
  // edges via short walk simulation
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const body = { pos: [0, 0, 0], vel: [0, 0, 0], onGround: true, height: PLAYER.height };
  for (const a of nodes) {
    const boxes = map.query(a.x - 2.5, a.z - 2.5, a.x + 2.5, a.z + 2.5);
    for (const [di, dj] of dirs) {
      const list = cols.get(key(a.i + di, a.j + dj));
      if (!list) continue;
      for (const bi of list) {
        const b = nodes[bi];
        if (b.y - a.y > 1.0 || a.y - b.y > 3.5) continue;
        // fast path: same floor height and a clear body-sized gap at the midpoint and the destination
        if (a.y === b.y) {
          const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, y = a.y + 0.02, h = PLAYER.height - 0.04;
          if (!blocked(mx, y, mz, PLAYER.radius, h, boxes) && !blocked(b.x, y, b.z, PLAYER.radius, h, boxes)) { a.e.push(bi); continue; }
        }
        body.pos[0] = a.x; body.pos[1] = a.y; body.pos[2] = a.z;
        body.vel[0] = body.vel[1] = body.vel[2] = 0; body.onGround = true;
        let ok = false;
        for (let s = 0; s < 24; s++) {
          const dx = b.x - body.pos[0], dz = b.z - body.pos[2], d = Math.hypot(dx, dz);
          if (d < 0.12) { body.vel[0] = body.vel[2] = 0; } else { body.vel[0] = dx / d * 5; body.vel[2] = dz / d * 5; }
          moveBody(body, 1 / 30, boxes);
          if (d < 0.12 && body.onGround) { ok = true; break; }
        }
        if (ok && Math.abs(body.pos[1] - b.y) < PLAYER.stepUp + 0.02) a.e.push(bi); // (one stair step of slack: bodies can rest on a tread edge)
      }
    }
  }
  // keep nodes that are reachable from open ground AND can get back to it (strongly connected with a seed)
  const rev = nodes.map(() => []);
  nodes.forEach((nd, u) => { for (const v of nd.e) rev[v].push(u); });
  const flood = (start, adj) => {
    const seen = new Uint8Array(nodes.length); const stack = [start]; seen[start] = 1;
    while (stack.length) { const u = stack.pop(); for (const v of adj(u)) if (!seen[v]) { seen[v] = 1; stack.push(v); } }
    return seen;
  };
  // seed from a spawn point (always open ground)
  const sp = map.spawns[0] || [0, 0, 0];
  let seed = 0, sd = Infinity;
  nodes.forEach((nd, s) => { const d = (nd.x - sp[0]) ** 2 + nd.y ** 2 * 4 + (nd.z - sp[2]) ** 2; if (d < sd && nd.e.length) { sd = d; seed = s; } });
  const fwd = flood(seed, u => nodes[u].e), back = flood(seed, u => rev[u]);
  const best = 1, comp = new Int32Array(nodes.length);
  const main = [];
  for (let s = 0; s < nodes.length; s++) if (fwd[s] && back[s]) { comp[s] = best; main.push(s); }
  const nav = { nodes, cols, main, key, half };

  nav.nearest = (x, y, z) => {
    const ci = Math.round((x + half - 0.25) / STEP), cj = Math.round((z + half - 0.25) / STEP);
    let bestId = -1, bd = Infinity;
    for (let r = 0; r <= 6 && bestId < 0; r++)
      for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
        const list = cols.get(key(ci + di, cj + dj)); if (!list) continue;
        for (const id of list) {
          if (comp[id] !== best) continue;
          const nd = nodes[id], d = (nd.x - x) ** 2 + ((nd.y - y) * 2) ** 2 + (nd.z - z) ** 2;
          if (d < bd) { bd = d; bestId = id; }
        }
      }
    return bestId;
  };

  // A* search, returns array of node ids (excluding start) or null
  // Typed-array scratch space reused by every search (fast, no per-search allocation).
  const N = nodes.length;
  const NX = new Float32Array(N), NY = new Float32Array(N), NZ = new Float32Array(N);
  for (let i = 0; i < N; i++) { NX[i] = nodes[i].x; NY[i] = nodes[i].y; NZ[i] = nodes[i].z; }
  const G = new Float64Array(N), PREV = new Int32Array(N), SEEN = new Uint32Array(N), DONE = new Uint32Array(N);
  let CAP = Math.max(1024, N * 2), HF = new Float64Array(CAP), HI = new Int32Array(CAP), stamp = 0;
  const W = 1.4; // weighted A*: slightly longer routes, far fewer nodes explored
  nav.path = (from, to, maxIter = 40000) => {
    if (from < 0 || to < 0) return null;
    if (from === to) return [to];
    stamp++;
    const tx = NX[to], ty = NY[to], tz = NZ[to];
    const h = (id) => W * Math.hypot(NX[id] - tx, (NY[id] - ty) * 1.5, NZ[id] - tz);
    let n = 0;
    const push = (f, id) => {
      if (n >= CAP) { CAP *= 2; const nf = new Float64Array(CAP), ni = new Int32Array(CAP); nf.set(HF); ni.set(HI); HF = nf; HI = ni; }
      let i = n++;
      while (i > 0) { const p = (i - 1) >> 1; if (HF[p] <= f) break; HF[i] = HF[p]; HI[i] = HI[p]; i = p; }
      HF[i] = f; HI[i] = id;
    };
    const pop = () => {
      const top = HI[0], lf = HF[--n], li = HI[n];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1; if (l >= n) break;
        const c = l + 1 < n && HF[l + 1] < HF[l] ? l + 1 : l;
        if (HF[c] >= lf) break;
        HF[i] = HF[c]; HI[i] = HI[c]; i = c;
      }
      HF[i] = lf; HI[i] = li;
      return top;
    };
    G[from] = 0; SEEN[from] = stamp; push(h(from), from);
    let it = 0;
    while (n > 0 && it++ < maxIter) {
      const u = pop();
      if (u === to) {
        const out = []; let cur = to;
        while (cur !== from) { out.push(cur); cur = PREV[cur]; }
        return out.reverse();
      }
      if (DONE[u] === stamp) continue;
      DONE[u] = stamp;
      const gu = G[u], ux = NX[u], uy = NY[u], uz = NZ[u], e = nodes[u].e;
      for (let k = 0; k < e.length; k++) {
        const v = e[k];
        if (DONE[v] === stamp) continue;
        const ng = gu + Math.hypot(ux - NX[v], uy - NY[v], uz - NZ[v]);
        if (SEEN[v] !== stamp || ng < G[v]) { SEEN[v] = stamp; G[v] = ng; PREV[v] = u; push(ng + h(v), v); }
      }
    }
    return null;
  };
  nav.randomNode = (filter) => {
    for (let k = 0; k < 30; k++) { const id = main[Math.floor(Math.random() * main.length)]; if (!filter || filter(nodes[id])) return id; }
    return main[Math.floor(Math.random() * main.length)];
  };
  return (cache[map.id] = nav);
}
