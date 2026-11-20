// Map layouts built from axis-aligned boxes. Shared by client (rendering/collision) and server (bots/rockets).
import { R, B, push, newCtx, rotBox, addRot, FH, WT, SLAB, wallRun, slab, band, building, stairRun, car, tree, palm, stall, barrel, crate, sandbags, bench, lamp, container, fountain, dumpster, barrier, mulberry, jumpPad, tank, armyTruck, watchtower, placeRot, fence, stepDome, waterTower, acUnit, trafficLight, busStop, billboard } from './mapkit.js';
import { townClassic, harborClassic, killhouseClassic } from './maps_classic.js';
import { shipyard, suburbs, canyonTown } from './maps_big.js';
import { oldTown, harborNew, neonNew, frostNew, duneNew, constructionNew, killhouseNew } from './maps_revamp.js';

// ================================================================ maps






function downtown() {
  const c = newCtx(), rnd = mulberry(20261119), allRoofs = [];
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
    allRoofs.push(...roofs.filter(Boolean));
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
    const along = rnd() < 0.5, col = pk(['car_red', 'car_blue']);
    const [cx, cz, hw, hd] = along ? [t, s + side, 2.15, 1.0] : [s + side, t, 1.0, 2.15];
    if ((c.doorways || []).some(([a0, b0, a1, b1]) => cx + hw > a0 && cx - hw < a1 && cz + hd > b0 && cz - hd < b1)) continue; // don't park across a doorway
    car(c, cx, cz, along ? 1 : 0, col);
  }
  for (const s of [-30, 30]) for (const t of [-45, -15, 15, 45]) { lamp(c, s - 3.7, t + 4); lamp(c, t + 4, s + 3.7); }
  // bus
  push(c.boxes, B(-15, -2.6, 10, 2.6, 2.6, 'bus', 0.3)); push(c.deco, B(-15, -2.6, 9.4, 2.65, 0.9, 'car_glass', 1.5));
  for (const dx of [-3.5, 3.5]) push(c.deco, B(-15 + dx, -2.6, 1.0, 2.7, 0.8, 'tire'));
  fountain(c, 0, 0);
  for (const [x, z] of [[-30, 8], [30, -8], [8, 30], [-8, -30], [22, 0], [-22, 0]]) jumpPad(c, x, z);
  // ---- street dressing (own random stream so the block layout above never changes)
  const r2 = mulberry(5150521);
  const free = (x, z, r) => !c.boxes.some(b => x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2] && b.min[1] < 3 && b.max[1] > 0.3);
  for (const sx of [-30, 0, 30]) for (const sz of [-30, 0, 30]) for (const [dx, dz] of [[-4.6, -4.6], [4.6, 4.6]]) if (free(sx + dx, sz + dz, 0.4)) trafficLight(c, sx + dx, sz + dz);
  for (const [x, z, r] of [[-45, -25.2, 0], [15, -25.2, 0], [-15, 25.2, 2], [45, 25.2, 2]]) if (free(x, z, 2.2)) busStop(c, x, z, r);
  for (const bx of [-45, -15, 15, 45]) for (const bz of [-45, -15, 15, 45]) for (const [ox, oz] of [[-7, -10.2], [7, -10.2], [-7, 10.2], [7, 10.2], [-10.2, 0], [10.2, 0]]) {
    const x = bx + ox, z = bz + oz;
    if (r2() < 0.45 && free(x, z, 1.2)) { push(c.boxes, B(x, z, 1.3, 1.3, 0.5, 'stone')); tree(c, x, z, 0.65); }
  }
  for (const r of allRoofs) {
    const k = r2();
    if (k < 0.25) waterTower(c, r.x + r.w / 2 - 2, r.z - r.d / 2 + 2, r.top);
    else if (k < 0.5) acUnit(c, r.x - r.w / 2 + 1.6, r.z + r.d / 2 - 1.4, r.top);
    if (r.floors >= 3 && r2() < 0.5) billboard(c, r.x, r.z, r2() < 0.5 ? 0 : 1, r.top + 1.4, 6, 2.6, 'billboard', r.top);
  }
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
  // helicopter on the helipad
  placeRot(q, 0, 44, 0, (t) => {
    push(t.boxes, B(0, 0, 1.9, 5.2, 1.9, 'tank', 0.5)); push(t.deco, B(0, -2.3, 1.7, 1.2, 1.2, 'car_glass', 0.9));
    push(t.boxes, R(-0.3, 1.2, 2.6, 0.3, 1.7, 7.2, 'tank')); push(t.deco, B(0, 7, 0.15, 1.0, 1.4, 'tank', 1.4)); push(t.deco, R(-1.1, 1.9, 6.7, 1.1, 2.0, 7.3, 'tank'));
    for (const s of [-1.0, 1.0]) { push(t.deco, R(s - 0.06, 0, -2.6, s + 0.06, 0.1, 2.4, 'metal_dark')); push(t.deco, B(s, -1.2, 0.08, 0.08, 0.5, 'metal_dark')); push(t.deco, B(s, 1.2, 0.08, 0.08, 0.5, 'metal_dark')); }
    push(t.deco, B(0, 0, 0.25, 0.25, 0.5, 'metal_dark', 2.4)); push(t.deco, R(-5.5, 2.9, -0.15, 5.5, 2.98, 0.15, 'metal_dark')); push(t.deco, R(-0.15, 2.9, -5.5, 0.15, 2.98, 5.5, 'metal_dark'));
  });
  // radar station with a dome
  building(q, { x: 56, z: 22, w: 8, d: 8, floors: 1, m: 'bunker', roof: false, roofM: 'metal_roof', floorM: 'concrete_floor', doors: { w: [0] }, winY: [1.4, 2.2] });
  stepDome(q, 56, 22, 3.4, FH + 0.3, 'panel_white', 'neon_orange');
  // comms tower (lattice, visual) + bunker with firing slits + trenches
  for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) push(q.boxes, B(-60 + dx, 8 + dz, 0.3, 0.3, 18, 'metal_dark'));
  for (let y = 3; y < 18; y += 3) { push(q.deco, R(-61.3, y, 6.75, -58.7, y + 0.15, 6.85, 'metal')); push(q.deco, R(-61.3, y, 9.15, -58.7, y + 0.15, 9.25, 'metal')); }
  push(q.deco, B(-60, 8, 0.2, 0.2, 6, 'metal', 18)); push(q.deco, B(-60, 8, 0.4, 0.4, 0.4, 'taillight', 24)); push(q.deco, B(-59, 8, 1.2, 0.1, 1.2, 'panel_white', 15));
  building(q, { x: -40, z: 60, w: 9, d: 6.4, floors: 1, m: 'bunker', floorM: 'concrete_floor', doors: { s: [-2.5] }, winY: [1.5, 1.95], winGap: 1.8 });
  for (let k = 0; k < 6; k++) { const x = -22 + k * 9; sandbags(q, x, 56.5, 7, 0.9); sandbags(q, x + 4.5, 63.5, 7, 0.9); sandbags(q, x + (k % 2 ? 3.6 : -3.6), 60, 0.9, 5.5); }
  // perimeter fence with a checkpoint
  fence(q, -68, 67, 68, 67, 'metal_grate', 2.2, [0]);
  push(q.boxes, B(4.5, 65, 2.6, 2.4, 2.6, 'portacabin')); push(q.deco, B(4.5, 65, 3.0, 2.8, 0.2, 'metal_roof', 2.6)); push(q.deco, R(-0.8, 0.9, 66.85, 3, 1.05, 67.05, 'barrier'));
  // motor pool + obstacle course
  armyTruck(q, 58, 4); armyTruck(q, 64, 4);
  for (let z = 14; z <= 38; z += 6) push(q.boxes, B(-62 + (z % 12 ? 2 : -2), z, 4, 0.4, 1.2, 'wood'));
  for (let z = 17; z <= 35; z += 6) { for (let i = 0; i < 3; i++) push(q.boxes, B(-66 + i * 0.8, z, 0.75, 0.75, 0.75, 'tire')); push(q.boxes, B(-58, z, 0.4, 3.5, 0.4, 'bark', 0.5)); }
  const c = newCtx();
  addRot(c, q, [0, 2]);
  // HQ in the middle + parade ground with flag
  push(c.deco, R(-14, 0, -12, 14, 0.04, 12, 'asphalt'));
  building(c, { x: 0, z: 0, w: 14, d: 10, floors: 3, m: 'concrete_panel', doors: { s: [0], e: [0], w: [0], n: [5.7] }, floorM: 'floor_tile', partition: 2 });
  push(c.deco, B(9, -8, 0.15, 0.15, 9, 'metal')); push(c.deco, R(9.1, 7.4, -8.05, 11.4, 8.8, -7.95, 'flag'));
  for (const [x, z] of [[-20, 0], [20, 0]]) barrier(c, x, z, 1, 5);
  return c;
}


export const MAPS = {
  shipyard:  { name: 'Shipyard',      size: 184, theme: 'shipyard', build: shipyard,  desc: 'MASSIVE · Boardable ship in dry dock, container yard, cranes, warehouses', big: true },
  suburbs:   { name: 'Suburbs',       size: 176, theme: 'suburb',   build: suburbs,   desc: 'MASSIVE · Houses with yards & pools, mall, school, park, church', big: true },
  canyon:    { name: 'Canyon Town',   size: 184, theme: 'canyon',   build: canyonTown, desc: 'MASSIVE · Cliff town, domed hall, fort, mine tunnel, oasis', big: true },
  downtown:  { name: 'Downtown',      size: 120, theme: 'city',     build: downtown,  desc: 'LARGE · City blocks, rooftop bridges, jump pads', big: true },
  base:      { name: 'Military Base', size: 140, theme: 'base',     build: militaryBase, desc: 'LARGE · Hangars, helicopters, radar dome, trenches, watchtowers', big: true },
  town:      { name: 'Old Town',      size: 88,  theme: 'town',     build: oldTown,   desc: 'Plaza, clock tower, church, canal and arcades' },
  harbor:    { name: 'Harbor',        size: 96,  theme: 'harbor',   build: harborNew, desc: 'Fishing boats, piers, lighthouse, fish market' },
  neon:      { name: 'Neon District', size: 80,  theme: 'neon',     build: neonNew,   desc: 'Night city under an elevated train line' },
  frost:     { name: 'Frostbite',     size: 88,  theme: 'snow',     build: frostNew,  desc: 'Research base, observatory dome, radar tower, frozen lake' },
  dune:      { name: 'Dune Village',  size: 88,  theme: 'desert',   build: duneNew,   desc: 'Rooftop bridges, souk, minaret and a walled compound' },
  construction: { name: 'Construction Site', size: 88, theme: 'construction', build: constructionNew, desc: 'Steel-frame tower, tower crane, excavation pit' },
  killhouse: { name: 'Killhouse',     size: 46,  theme: 'killhouse', build: killhouseNew, desc: 'Shoot house with an overwatch catwalk' },
  classic_town:      { name: 'Old Town (Classic)',  size: 72, theme: 'town',      build: townClassic,      desc: 'The original Old Town' },
  classic_harbor:    { name: 'Harbor (Classic)',    size: 80, theme: 'harbor',    build: harborClassic,    desc: 'The original Harbor' },
  classic_killhouse: { name: 'Killhouse (Classic)', size: 38, theme: 'killhouse', build: killhouseClassic, desc: 'The original Killhouse' },
};
export const MAP_ORDER = ['shipyard', 'suburbs', 'canyon', 'downtown', 'base', 'town', 'harbor', 'neon', 'frost', 'dune', 'construction', 'killhouse', 'classic_town', 'classic_harbor', 'classic_killhouse'];

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
    while (spawns.length < Math.min(def.size > 150 ? 44 : def.big ? 36 : 24, cands.length)) {
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
    const n = def.size > 150 ? 22 : def.big ? 16 : def.size < 45 ? 5 : 9;
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
