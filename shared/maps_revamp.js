// Revamped versions of the original maps: bigger, more detailed, more vertical.
import {
  R, B, push, newCtx, addRot, FH, building, stairRun, car, tree, palm, stall, barrel, crate, sandbags, bench, lamp, container, fountain, dumpster, barrier,
  mulberry, jumpPad, watchtower, placeRot, place, gableRoof, fence, hedge, cliff, bollard, pallets, pipeStack, rails, gantry, semiTruck, waterTower,
  acUnit, trafficLight, busStop, stepDome, tent, plankBridge, wallSign, billboard, slabHoles, stairFlight, railing,
} from './mapkit.js';

const ground = (c, x0, z0, x1, z1, m) => push(c.deco, R(x0, 0, z0, x1, 0.035, z1, m));
// Ground-floor arcade along one face: posts + a covered walkway roof (face points -z before rotation).
function arcade(c, x, z, rot, len, depth = 2.4, h = 3.0, m = 'stone') {
  placeRot(c, x, z, rot, (t) => {
    for (let a = -len / 2; a <= len / 2 + 0.01; a += 3) push(t.boxes, B(a, -depth, 0.4, 0.4, h, m));
    push(t.deco, R(-len / 2 - 0.3, h, -depth - 0.3, len / 2 + 0.3, h + 0.3, 0, m));
    push(t.deco, R(-len / 2 - 0.3, h + 0.3, -depth - 0.3, len / 2 + 0.3, h + 0.4, -depth + 0.1, 'trim'));
  });
}
function cafeTables(c, x, z, n = 3) {
  for (let i = 0; i < n; i++) {
    const tx = x + (i % 2) * 2.6, tz = z + Math.floor(i / 2) * 2.6;
    push(c.boxes, B(tx, tz, 0.9, 0.9, 0.75, 'wood')); push(c.deco, B(tx, tz, 0.08, 0.08, 2.2, 'metal_dark', 0.75));
    push(c.deco, B(tx, tz, 2.2, 2.2, 0.12, i % 2 ? 'awning_red' : 'awning_green', 2.4)); push(c.deco, B(tx, tz, 1.5, 1.5, 0.12, i % 2 ? 'awning_red' : 'awning_green', 2.52));
  }
}
// Exterior fire escape: zig-zag flights with landings up a facade (stairs run along x, outside face at z, going outward -z).
function fireEscape(c, x, z, floors, side = -1) {
  // two lanes (so the flight above never blocks your head), landings at alternating ends spanning both lanes
  const zA = z + side * 0.75, zB = z + side * 1.95, zIn = z + side * 0.15, zOut = z + side * 2.6;
  for (let f = 0; f < floors; f++) {
    const dir = f % 2 ? -1 : 1, base = f * FH, x0 = dir > 0 ? x - 2.2 : x + 2.2;
    stairFlight(c, x0, f % 2 ? zB : zA, dir, 0, 1.1, 8, FH / 8, 'metal_grate', base, 0.55);
    const lx = x0 + dir * 4.4, la = Math.min(lx, lx + dir * 1.3), lb = Math.max(lx, lx + dir * 1.3);
    push(c.boxes, R(la, base + FH - 0.15, Math.min(zIn, zOut), lb, base + FH, Math.max(zIn, zOut), 'metal_grate'));
    railing(c, la, zOut, lb, zOut, base + FH, 1.0, 'metal_dark');
  }
}

// ====================================================================================== OLD TOWN
export function oldTown() {
  const c = newCtx(), rnd = mulberry(3301);
  ground(c, -13, -11, 13, 11, 'cobble');
  ground(c, -44, -3, 44, 3, 'cobble'); ground(c, -3, -44, 3, 44, 'cobble');
  fountain(c, 0, 0);
  // clock tower on the north side of the plaza (stairs to an open top)
  building(c, { x: 0, z: 15, w: 6.4, d: 6.4, floors: 4, m: 'stone', floorM: 'floor_wood', doors: { s: [0] }, winGap: 2.4 });
  for (const s of [-1, 1]) { push(c.deco, B(s * 3.25, 15, 0.1, 1.6, 1.6, 'trim', 9.0)); push(c.deco, B(0, 15 + s * 3.25, 1.6, 0.1, 1.6, 'trim', 9.0)); push(c.deco, B(s * 3.3, 15, 0.06, 0.16, 0.6, 'metal_dark', 9.8)); }
  for (const [dx, dz] of [[-2.9, -2.9], [2.9, -2.9], [-2.9, 2.9], [2.9, 2.9]]) push(c.deco, B(dx, 15 + dz, 0.4, 0.4, 2.6, 'stone', 12.8));
  for (let k = 0; k < 4; k++) push(c.deco, B(0, 15, 6.6 - k * 1.5, 6.6 - k * 1.5, 0.7, 'roof_slate', 15.4 + k * 0.7));
  // church at the north end
  building(c, { x: 0, z: 34, w: 12, d: 15, floors: 1, fh: 6.4, m: 'stone', roof: false, floorM: 'floor_wood', doors: { s: [{ c: 0, w: 2.6, h: 3.6 }], e: [3] }, winY: [2.4, 5.2], winGap: 3.2 });
  gableRoof(c, -6, 26.5, 6, 41.5, 6.4, 'roof_slate', false);
  // blocks around the plaza: mixed flat (roof access) and pitched buildings
  const M = ['plaster_yellow', 'plaster_white', 'brick', 'brick_dark'];
  const blocks = [
    [-24, 21, 12, 10, 2, { s: [0], e: [0] }, true], [-37, 23, 10, 12, 3, { s: [0] }, false],
    [23, 21, 14, 10, 2, { s: [-3], w: [0] }, false], [37, 24, 8, 12, 3, { w: [0] }, true],
    [-23, -21, 14, 10, 3, { n: [0], e: [0] }, true], [-37, -23, 8, 10, 2, { n: [0] }, false],
    [24, -21, 12, 10, 2, { n: [2], w: [0] }, true], [37, -23, 8, 10, 2, { n: [0] }, false],
    [-29, 0, 10, 14, 2, { e: [3], w: [-3] }, true], [29, 0, 10, 14, 3, { w: [-3], e: [3] }, true],
  ];
  blocks.forEach(([x, z, w, d, fl, doors, flat], i) => {
    building(c, { x, z, w, d, floors: fl, m: M[i % 4], floorM: i % 2 ? 'floor_wood' : 'floor_tile', doors, roof: flat, partition: w >= 12 ? 1 : undefined });
    if (!flat) gableRoof(c, x - w / 2, z - d / 2, x + w / 2, z + d / 2, fl * FH, i % 3 ? 'roof_red' : 'roof_slate', w >= d);
    // window boxes with flowers under upper windows
    for (let k = -w / 2 + 1.6; k < w / 2 - 1; k += 2.8) push(c.deco, B(x + k, z - d / 2 - 0.15, 1.0, 0.3, 0.25, 'leaves', FH + 0.75));
  });
  arcade(c, 24, -16, 2, 12); arcade(c, -23, -16, 2, 12); // covered walkways facing the plaza
  wallSign(c, 23, 15.95, 0, 3.0, 4, 0.7, 'wood', 'wood'); wallSign(c, -24, 15.95, 0, 3.0, 4, 0.7, 'neon_orange', 'trim');
  // plaza dressing
  cafeTables(c, -10, 5, 4); cafeTables(c, 8, -9, 3);
  stall(c, 7, 7, 0, 'awning_red'); stall(c, -8, -7, 1, 'awning_green');
  for (const [x, z] of [[-11, -9], [11, 9]]) tree(c, x, z, 0.9);
  for (const [x, z] of [[-12, 10.5], [12, -10.5], [-12, -10.5], [12, 10.5]]) lamp(c, x, z);
  for (const [x, z, r] of [[-5, 10.5, 0], [5, -10.5, 0], [-12.5, 3, 1], [12.5, -3, 1]]) bench(c, x, z, r);
  // canal along the south with two little bridges
  push(c.deco, R(-44, 0, -40, 44, 0.3, -35, 'water'));
  for (const z of [-40.3, -35]) for (const [a, b] of [[-44, -17.2], [-12.8, 12.8], [17.2, 44]]) push(c.boxes, R(a, 0, z, b, 0.7, z + 0.3, 'stone'));
  for (const bx of [-15, 15]) { push(c.boxes, R(bx - 2.2, 0, -41.2, bx + 2.2, 0.5, -34.1, 'stone')); push(c.boxes, R(bx - 2.2, 0.5, -41.2, bx - 1.9, 1.3, -34.1, 'stone')); push(c.boxes, R(bx + 1.9, 0.5, -41.2, bx + 2.2, 1.3, -34.1, 'stone')); }
  for (const x of [-30, 0, 30]) { push(c.boxes, R(x - 1.2, 0.1, -39.4, x + 1.2, 0.6, -36, 'wood')); push(c.deco, B(x, -37.7, 0.1, 0.1, 1.4, 'wood', 0.6)); } // moored rowing boats
  for (const [x, z] of [[-26, -42], [-6, -42.5], [22, -42], [38, -42.5]]) { crate(c, x, z); barrel(c, x + 1.3, z); }
  // alleys: clutter + an arch over the west street
  for (const [x, z] of [[-31, 12], [31, 12], [-31, -12], [31, -12], [-12, 30], [12, 30], [-16, -32], [16, -32]]) { crate(c, x, z, 1.1); if (rnd() < 0.6) barrel(c, x + 1.2, z + 0.3, rnd() < 0.5 ? 'barrel_red' : 'barrel_blue'); }
  push(c.boxes, R(-44, 4.4, -3, -36.5, 5.4, 3, 'stone')); push(c.boxes, B(-40, -3, 1, 1, 4.4, 'stone')); push(c.boxes, B(-40, 3, 1, 1, 4.4, 'stone'));
  car(c, 20, 31, 0, 'car_red'); car(c, -20, -31, 0, 'car_blue');
  for (const [x, z] of [[-20, 40], [20, 40], [-40, 38], [40, 38]]) tree(c, x, z, 0.8 + rnd() * 0.3);
  return c;
}

// ====================================================================================== HARBOR
function fishingBoat(c, x, z, rot) {
  placeRot(c, x, z, rot, (t) => {
    // hull along x, deck at 2.0, cabin aft, mast and booms
    push(t.boxes, R(-8, 0, -2.6, 6, 1.0, 2.6, 'hull_red')); push(t.boxes, R(-8, 1.0, -2.6, 6, 2.0, -2.2, 'panel_white')); push(t.boxes, R(-8, 1.0, 2.2, 6, 2.0, 2.6, 'panel_white'));
    push(t.boxes, R(-8.4, 1.0, -2.6, -8, 2.0, 2.6, 'panel_white'));
    for (const [a, b, w] of [[6, 7.6, 4.2], [7.6, 8.8, 2.6], [8.8, 9.6, 1.2]]) { push(t.boxes, R(a, 0, -w / 2, b, 1.0, w / 2, 'hull_red')); push(t.boxes, R(a, 1.0, -w / 2, b, 2.0, w / 2, 'panel_white')); }
    push(t.boxes, R(-8, 1.6, -2.2, 6, 2.0, 2.2, 'deck')); push(t.boxes, R(6, 1.6, -2.1, 9.6, 2.0, 2.1, 'deck'));
    place(t, 0, 2.0, 0, (u) => building(u, { x: -5, z: 0, w: 4.4, d: 3.6, floors: 1, fh: 2.4, m: 'panel_white', roof: false, roofM: 'metal_roof', floorM: 'deck', doors: { e: [0] }, winY: [1.0, 1.9], winGap: 1.6 }));
    push(t.deco, B(1.5, 0, 0.25, 0.25, 6, 'metal_dark', 2.0)); push(t.deco, R(1.5, 6.5, -0.08, 7, 6.65, 0.08, 'metal_dark'));
    push(t.deco, R(-8.05, 0.4, -2.65, 9.6, 0.55, 2.65, 'trim')); push(t.deco, B(-8.3, 0, 0.5, 0.5, 1.6, 'tire', 1.0));
    push(t.boxes, R(-1, 2.0, -1.6, 1, 2.8, 1.6, 'crate'));
  });
}
export function harborNew() {
  const c = newCtx(), rnd = mulberry(5150);
  const H = 48;
  // water across the south, quay edge, piers
  push(c.deco, R(-H, 0, -H, H, 0.3, -26, 'water'));
  push(c.boxes, R(-H, 0, -26.6, H, 0.35, -25.4, 'stone'));
  for (let x = -44; x <= 44; x += 6) bollard(c, x, -24.6);
  for (const px of [-28, 0, 28]) { push(c.boxes, R(px - 2, 0, -46, px + 2, 0.5, -26, 'wood')); for (let z = -44; z <= -28; z += 4) for (const s of [-1.9, 1.9]) push(c.deco, B(px + s, z, 0.3, 0.3, 1.2, 'wood')); railing(c, px - 2, -46, px - 2, -27, 0.5, 1.0, 'wood'); }
  fishingBoat(c, -18, -36, 1); fishingBoat(c, 16, -38, 3);
  stairFlight(c, -18, -23.9, 0, -1, 1.1, 5, 0.4, 'wood', 0, 0.5); // gangplank from the quay onto the west boat's bow
  // lighthouse on the breakwater (east), stairs to the lantern deck
  push(c.boxes, R(36, 0, -46, 46, 0.5, -36, 'stone'));
  building(c, { x: 41, z: -41, w: 6.4, d: 6.4, floors: 4, m: 'panel_white', floorM: 'floor_wood', doors: { w: [-1.6] }, winGap: 2.5 });
  for (let k = 0; k < 4; k++) push(c.deco, B(41, -41, 6.6, 6.6, 0.5, k % 2 ? 'barrel_red' : 'panel_white', 2 + k * 2.6));
  push(c.deco, B(41, -41, 3.2, 3.2, 2.0, 'glass', 13.75)); push(c.deco, B(41, -41, 1.4, 1.4, 1.2, 'lamp', 14.1)); stepDome(c, 41, -41, 1.8, 15.8, 'barrel_red', 'metal_dark');
  push(c.boxes, R(32, 0, -36.2, 35.5, 0.5, -25.4, 'stone')); railing(c, 32, -36, 32, -26.6, 0.5); railing(c, 35.5, -36, 35.5, -26.6, 0.5); // causeway to the breakwater
  // big warehouse with a mezzanine and catwalk (north-west)
  building(c, { x: -26, z: 18, w: 28, d: 16, floors: 1, fh: 6.5, roof: false, m: 'metal_corr', roofM: 'metal_roof', floorM: 'concrete_floor', doors: { s: [{ c: -7, w: 4, h: 4.5 }, { c: 7, w: 4, h: 4.5 }], e: [0] }, winY: [4.3, 5.6], winGap: 4 });
  push(c.boxes, R(-39.7, 3.0, 21.5, -18, 3.25, 25.7, 'metal_grate')); railing(c, -39.7, 21.5, -21, 21.5, 3.25); railing(c, -19, 21.5, -18, 21.5, 3.25);
  stairFlight(c, -20, 21.5 - 8 * 0.6, 0, 1, 1.4, 8, 3.25 / 8, 'metal_grate', 0, 0.6);
  for (const [x, z] of [[-34, 13], [-28, 13], [-22, 13]]) { pallets(c, x, z, 2); crate(c, x + 1.5, z + 1, 1.0); }
  container(c, -14, 15, 0, 'container_blue');
  // fish market hall (open sides) + stalls
  for (const [dx, dz] of [[-9, -5], [9, -5], [-9, 5], [9, 5], [0, -5], [0, 5]]) push(c.boxes, B(14 + dx, 14 + dz, 0.4, 0.4, 4.2, 'metal_dark'));
  push(c.deco, R(4, 4.2, 8.4, 24, 4.5, 19.6, 'metal_roof')); for (let k = 0; k < 3; k++) push(c.deco, R(4 + k * 0.6, 4.5 + k * 0.4, 8.4, 24 - k * 0.6, 4.9 + k * 0.4, 19.6, 'metal_roof'));
  for (const [x, z, r] of [[8, 11, 0], [14, 11, 0], [20, 11, 0], [8, 17, 0], [20, 17, 0]]) stall(c, x, z, r, rnd() < 0.5 ? 'awning_red' : 'awning_green');
  // harbour office (3 floors) and cafe
  building(c, { x: 34, z: 20, w: 12, d: 10, floors: 3, m: 'brick', floorM: 'floor_tile', doors: { s: [0], w: [2] }, partition: 2 });
  wallSign(c, 34, 14.95, 0, 3.0, 5, 0.7, 'neon_cyan', 'trim');
  building(c, { x: 34, z: 37, w: 10, d: 8, floors: 1, m: 'plaster_white', roof: false, floorM: 'floor_wood', doors: { s: [-2], w: [0] } }); gableRoof(c, 29, 33, 39, 41, FH, 'roof_red');
  cafeTables(c, 30, 28, 4);
  // container maze with stair access (east) + crane
  for (const [x, z, n, r, col] of [[-6, 30, 2, 0, 'container_red'], [-2, 32, 1, 0, 'container_green'], [4, 28, 2, 1, 'container_blue'], [4, 34, 1, 1, 'container_red'], [14, 32, 3, 0, 'container_green'], [-40, 38, 1, 1, 'container_blue'], [-28, 38, 2, 1, 'container_red']])
    for (let k = 0; k < n; k++) container(c, x, z, r, k % 2 ? 'container_blue' : col, k * 2.6);
  stairFlight(c, -2, 32 - 3 - 4.2, 0, 1, 1.6, 7, 2.6 / 7, 'metal_grate', 0, 0.6);
  for (const sx of [-10, 10]) push(c.boxes, B(sx - 12, -20, 1, 1, 15, 'crane'));
  push(c.deco, R(-22.6, 14, -20.7, -1.4, 15.4, -19.3, 'crane')); push(c.deco, B(-12, -20, 2.4, 2.4, 1.8, 'crane', 12.2)); push(c.deco, B(-14, -20, 0.08, 0.08, 9, 'metal_dark', 5.2)); push(c.deco, B(-14, -20, 2.6, 2.6, 0.6, 'container_green', 4.6));
  // quayside clutter
  push(c.boxes, B(-30, -14, 1.4, 2.4, 1.4, 'forklift')); push(c.deco, B(-30, -15.4, 1.2, 0.15, 2.6, 'metal_dark'));
  for (const [x, z] of [[-40, -18], [-4, -14], [24, -16], [40, -12], [-20, -8], [8, -6]]) { crate(c, x, z, 1.1); crate(c, x + 1.2, z + 0.2, 1.0); if (rnd() < 0.6) barrel(c, x, z + 1.4); }
  for (const [x, z] of [[-10, -12, 0], [20, -2, 1], [-36, 2, 0]]) barrier(c, x, z, 0, 4);
  semiTruck(c, -8, 6, 1, 'container_red'); car(c, 24, 2, 1, 'car_blue'); car(c, 42, 6, 0, 'car_red');
  for (const x of [-40, -16, 8, 32]) lamp(c, x, -22);
  return c;
}

// ====================================================================================== NEON DISTRICT
export function neonNew() {
  const c = newCtx();
  ground(c, -40, -4, 40, 4, 'asphalt'); ground(c, -4, -40, 4, 40, 'asphalt');
  for (let x = -38; x < 38; x += 5) push(c.deco, R(x, 0.04, -0.1, x + 2.4, 0.05, 0.1, 'road_line'));
  // elevated train viaduct along x at z = 12 with a station platform and two parked cars
  const VZ = 12, VY = 6;
  for (let x = -36; x <= 36; x += 8) for (const s of [-2.3, 2.3]) push(c.boxes, B(x, VZ + s, 0.9, 0.9, VY - 0.4, 'concrete'));
  push(c.boxes, R(-40, VY - 0.4, VZ - 3, 40, VY, VZ + 3, 'concrete_dark'));
  push(c.deco, R(-40, VY - 0.9, VZ - 3.1, 40, VY - 0.4, VZ + 3.1, 'neon_cyan'));
  railing(c, -40, VZ - 3, -7.1, VZ - 3, VY, 1.1, 'metal_dark'); railing(c, -4.9, VZ - 3, 40, VZ - 3, VY, 1.1, 'metal_dark');
  railing(c, -40, VZ + 3, 34.9, VZ + 3, VY, 1.1, 'metal_dark'); railing(c, 37.1, VZ + 3, 40, VZ + 3, VY, 1.1, 'metal_dark');
  for (const s of [-0.8, 0.8]) push(c.deco, R(-40, VY, VZ + s - 0.06, 40, VY + 0.14, VZ + s + 0.06, 'metal'));
  for (const [x0, x1] of [[-30, -16], [6, 22]]) { push(c.boxes, R(x0, VY + 0.3, VZ - 1.4, x1, VY + 3.1, VZ + 1.4, 'panel_white')); push(c.deco, R(x0 - 0.02, VY + 1.6, VZ - 1.42, x1 + 0.02, VY + 2.5, VZ + 1.42, 'car_glass')); push(c.deco, R(x0 - 0.02, VY + 0.9, VZ - 1.43, x1 + 0.02, VY + 1.1, VZ + 1.43, 'neon_orange')); }
  stairFlight(c, -6, VZ - 3 - 8.25, 0, 1, 2, 15, VY / 15, 'metal_grate', 0, 0.55); stairFlight(c, 36, VZ + 3 + 8.25, 0, -1, 2, 15, VY / 15, 'metal_grate', 0, 0.55);
  push(c.deco, R(-10, VY + 3.2, VZ - 3.4, 2, VY + 3.4, VZ + 0.6, 'metal_roof')); for (const x of [-9.6, 1.6]) push(c.deco, B(x, VZ - 3.2, 0.15, 0.15, 3.2, 'metal_dark', VY));
  wallSign(c, -4, VZ - 3.12, 0, VY + 2.0, 4, 0.6, 'neon_cyan');
  // city blocks (dark facades, fire escapes, flush neon signs, rooftop billboards)
  const blocks = [[-24, -20, 14, 12, 3, { n: [0], e: [-2] }], [-30, 28, 10, 10, 2, { s: [0], e: [0] }], [22, -22, 16, 12, 3, { n: [-3], w: [0] }], [26, 28, 12, 10, 2, { s: [0] }], [-10, 30, 6, 8, 1, { s: [0] }], [10, -32, 8, 8, 2, { n: [0] }]];
  const facade = ['plaster_dark', 'concrete_dark', 'brick_dark'];
  blocks.forEach(([x, z, w, d, fl, doors], i) => building(c, { x, z, w, d, floors: fl, m: facade[i % 3], floorM: 'floor_tile', doors, partition: w >= 14 ? 1.5 : undefined }));
  fireEscape(c, -24, -26, 3, -1); fireEscape(c, 22, -28, 3, -1);
  for (const [x, z, rot, y, w, h, col] of [[-24, -14.0, 2, 3.4, 6, 1.0, 'neon_cyan'], [-31.05, -20, 3, 4.5, 4, 0.8, 'neon_orange'], [22, -16.0, 2, 3.4, 8, 1.2, 'neon_orange'], [30.05, -22, 1, 5, 4, 0.8, 'neon_cyan'], [-30, 22.95, 0, 3.0, 5, 0.8, 'neon_pink'], [26, 22.95, 0, 3.0, 6, 0.8, 'neon_cyan']])
    wallSign(c, x, z, rot, y, w, h, col);
  billboard(c, -24, -22, 0, 10.6, 9, 3.6, 'billboard', 9.6); billboard(c, 22, -24, 0, 10.6, 10, 3.6, 'billboard', 9.6);
  for (const [x, z, y] of [[-20, -24, 9.6], [18, -18, 9.6], [-32, 30, 6.4], [30, 30, 6.4]]) acUnit(c, x, z, y);
  // street level: noodle stalls, vending machines, dumpsters, parked cars, lamps
  for (const [x, z, r, a] of [[-14, -8, 0, 'awning_red'], [-20, -8, 0, 'awning_green'], [12, 7, 0, 'awning_red'], [18, -9, 0, 'awning_green']]) stall(c, x, z, r, a);
  for (const [x, z] of [[-17, -14.4], [15, -16.4], [-26, 23.4]]) push(c.boxes, B(x, z, 0.8, 0.6, 1.9, 'vending'));
  for (const [x, z, r] of [[-36, -10, 1], [36, 8, 0], [-8, -36, 0], [8, 22, 1]]) dumpster(c, x, z, r);
  car(c, -12, 2.4, 1, 'car_blue'); car(c, 20, -2.4, 1, 'car_red'); car(c, 2.4, -22, 0, 'car_glass'); car(c, -2.4, 26, 0, 'car_blue');
  for (const [x, z, col] of [[-36, -5, 'neon_cyan'], [-12, 5, 'neon_orange'], [12, -5, 'neon_cyan'], [36, 5, 'neon_orange'], [5, -24, 'neon_cyan'], [-5, 24, 'neon_orange']]) lamp(c, x, z, col);
  // central mini plaza: raised planter ring with a holo pillar
  for (const [dx, dz, w, d] of [[0, -3.2, 6.8, 0.6], [0, 3.2, 6.8, 0.6], [-3.2, 0, 0.6, 5.8], [3.2, 0, 0.6, 5.8]]) push(c.boxes, B(dx, dz + 20, w, d, 0.7, 'stone'));
  push(c.deco, B(0, 20, 5.8, 5.8, 0.6, 'hedge')); push(c.boxes, B(0, 20, 0.6, 0.6, 3.2, 'metal_dark')); push(c.deco, B(0, 20, 1.6, 1.6, 0.1, 'neon_cyan', 3.2)); push(c.deco, B(0, 20, 1.0, 1.0, 0.1, 'neon_orange', 3.6));
  for (const [x, z] of [[-38, -30], [36, -36], [-36, 36], [38, 34], [0, -38]]) { crate(c, x, z, 1.1); barrel(c, x + 1.2, z, 'barrel_red'); }
  barrier(c, -4, -14, 1, 3); barrier(c, 4, 34, 1, 3);
  return c;
}

// ====================================================================================== FROSTBITE
export function frostNew() {
  const c = newCtx(), rnd = mulberry(4404);
  // snow ridges on two edges and a frozen lake
  cliff(c, -44, 37, 20, 44, 7, rnd, 'snowpile', 5); cliff(c, 37, -44, 44, 10, 7, rnd, 'snowpile', 5);
  push(c.deco, R(-40, 0, -40, -14, 0.06, -18, 'ice'));
  for (const [x, z, w, d, h] of [[-34, -34, 2.4, 2, 1.4], [-24, -24, 3, 2.2, 1.0], [-18, -36, 2, 2, 1.8], [-36, -22, 2.6, 1.8, 1.2]]) push(c.boxes, B(x, z, w, d, h, 'ice'));
  // main lab (2 floors) connected to the dome observatory by an enclosed corridor
  building(c, { x: -14, z: 14, w: 16, d: 10, floors: 2, m: 'panel_white', floorM: 'floor_tile', doors: { s: [-4, 4], e: [3] }, partition: 1 });
  building(c, { x: 16, z: 22, w: 12, d: 12, floors: 1, fh: 4.8, m: 'panel_white', roof: false, roofM: 'metal_roof', floorM: 'floor_tile', doors: { s: [0], w: [-5] }, winY: [1.4, 3.2] });
  stepDome(c, 16, 22, 5.6, 4.8, 'panel_white', 'metal_dark'); push(c.deco, R(15.4, 7.5, 18, 16.6, 10.4, 26, 'metal_dark')); // dome + slot
  building(c, { x: 2, z: 17, w: 16, d: 3.4, floors: 1, fh: 3.0, m: 'bunker', roof: false, roofM: 'metal_roof', floorM: 'concrete_floor', doors: { w: [0], e: [0] }, windows: false }); // corridor
  // radar tower: lattice with stairs to a platform
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) push(c.boxes, B(28 + dx, -20 + dz, 0.3, 0.3, 9, 'metal_dark'));
  push(c.boxes, R(25.8, 8.8, -22.2, 30.2, 9, -17.8, 'metal_grate')); railing(c, 27.3, -22.2, 30.2, -22.2, 9); railing(c, 25.8, -17.8, 30.2, -17.8, 9); railing(c, 30.2, -22.2, 30.2, -17.8, 9); railing(c, 25.8, -22.2, 25.8, -17.8, 9);
  // zig-zag stair tower on the south side: lanes at z -23.0 and -24.2, landings at alternating ends
  stairFlight(c, 22, -23.0, 1, 0, 1.0, 8, 3 / 8, 'metal_grate', 0, 0.5); push(c.boxes, R(26, 2.85, -24.7, 27.2, 3, -22.5, 'metal_grate'));
  stairFlight(c, 26, -24.2, -1, 0, 1.0, 8, 3 / 8, 'metal_grate', 3, 0.5); push(c.boxes, R(20.8, 5.85, -24.7, 22, 6, -22.5, 'metal_grate'));
  stairFlight(c, 22, -23.0, 1, 0, 1.0, 8, 3 / 8, 'metal_grate', 6, 0.5); push(c.boxes, R(26, 8.85, -24.7, 27.2, 9, -21.9, 'metal_grate'));
  push(c.deco, B(28, -20, 0.4, 0.4, 3, 'metal', 9)); push(c.deco, R(25, 12.0, -20.3, 31, 12.6, -19.7, 'panel_white')); push(c.deco, B(28, -20, 0.2, 0.2, 0.6, 'neon_orange', 12.6));
  // vehicle hangar with snowcats
  building(c, { x: -26, z: -4, w: 14, d: 12, floors: 1, fh: 5, roof: false, m: 'metal_corr', roofM: 'metal_roof', floorM: 'concrete_floor', doors: { e: [{ c: 0, w: 6, h: 4 }], s: [-3] }, winY: [3.2, 4.3], winGap: 3.5 });
  for (const [x, z, r] of [[-28, -5, 0], [-10, -28, 1], [10, 2, 0]]) placeRot(c, x, z, r, (t) => { push(t.boxes, R(-1.2, 0.5, -2.4, 1.2, 1.6, 2.4, 'barrel_red')); push(t.boxes, R(-1.1, 1.6, -2.2, 1.1, 2.6, 0.2, 'barrel_red')); push(t.deco, R(-1.0, 1.9, -2.25, 1.0, 2.4, -2.2, 'car_glass')); for (const s of [-1.25, 1.25]) push(t.deco, R(s - 0.3, 0, -2.6, s + 0.3, 0.8, 2.6, 'tire')); });
  // fuel depot, antenna array, crates, containers
  for (const [x, z] of [[24, 4], [30, 4]]) { push(c.boxes, B(x, z, 3.2, 3.2, 3.4, 'fueltank')); push(c.deco, B(x, z, 3.4, 3.4, 0.2, 'metal_dark', 3.4)); }
  for (let i = 0; i < 4; i++) { push(c.boxes, B(-30 + i * 4, 28, 0.25, 0.25, 6, 'metal_dark')); push(c.deco, R(-31 + i * 4, 5.6, 27.9, -29 + i * 4, 5.75, 28.1, 'metal')); push(c.deco, B(-30 + i * 4, 28, 1.4, 0.1, 1.4, 'panel_white', 4.2)); }
  container(c, 4, 34, 1, 'container_blue'); container(c, 6, 31.4, 1, 'container_red'); container(c, 30, 16, 0, 'container_red'); container(c, -6, -18, 1, 'container_blue');
  stairFlight(c, -2.9, 34, 1, 0, 1.4, 7, 2.6 / 7, 'metal_grate', 0, 0.55);
  for (const [x, z, w, d, h] of [[2, -8, 4, 3, 0.9], [-8, 4, 3, 2.5, 1.1], [16, -6, 3.5, 2.5, 1.0], [-2, 26, 3, 2, 0.8], [26, 36, 4, 3, 1.2]]) push(c.boxes, B(x, z, w, d, h, 'snowpile'));
  for (const [x, z] of [[-4, -4], [12, -14], [-16, 2], [34, -4], [-34, 18]]) { crate(c, x, z); crate(c, x + 1.3, z + 0.2, 1.0); barrel(c, x, z + 1.4, 'barrel_red'); }
  sandbags(c, 0, -14, 4, 0.8); sandbags(c, -12, -12, 0.8, 4); sandbags(c, 14, 10, 4, 0.8);
  for (const [x, z] of [[-4, 8], [8, -18], [-22, 24]]) lamp(c, x, z);
  jumpPad(c, -38, 6);
  return c;
}

// ====================================================================================== DUNE VILLAGE
export function duneNew() {
  const c = newCtx(), rnd = mulberry(6611);
  ground(c, -44, -3, 44, 3, 'dirt'); ground(c, -3, -44, 3, 44, 'dirt');
  // central well plaza
  for (const [dx, dz, w, d] of [[0, -1.6, 3.6, 0.4], [0, 1.6, 3.6, 0.4], [-1.6, 0, 0.4, 2.8], [1.6, 0, 0.4, 2.8]]) push(c.boxes, B(dx, dz, w, d, 0.9, 'sandstone'));
  push(c.deco, B(0, 0, 2.7, 2.7, 0.2, 'water', 0.5));
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) push(c.boxes, B(x, z, 0.3, 0.3, 2.8, 'wood'));
  push(c.deco, B(0, 0, 4, 4, 0.2, 'mudroof', 2.8));
  // houses with rooftop terraces linked by plank bridges (parapet gaps where bridges land)
  const H = (x, z, w, d, fl, doors, gaps = [], m = 'mudbrick') => building(c, { x, z, w, d, floors: fl, m, roofM: 'mudroof', floorM: 'rug', doors, parapetGaps: gaps, winGap: 3 });
  H(-14, -12, 10, 8, 2, { n: [0], e: [0] }, [{ side: 'e', c: 0, w: 2 }]);
  H(-1, -14, 8, 8, 2, { n: [2] }, [{ side: 'w', c: 2, w: 2 }, { side: 'e', c: 2, w: 2 }], 'sandstone');
  H(12, -12, 10, 8, 2, { n: [0] }, [{ side: 'w', c: 0, w: 2 }]);
  H(-14, 12, 10, 8, 2, { s: [0], e: [0] }, [{ side: 'e', c: 0, w: 2 }], 'sandstone');
  H(13, 13, 12, 8, 2, { s: [-2], w: [2] }, [{ side: 'w', c: -1, w: 2 }]);
  H(-30, -14, 9, 9, 1, { n: [0], e: [0] }); H(-30, 14, 9, 9, 2, { s: [0] }, [], 'sandstone');
  H(30, -14, 9, 9, 1, { n: [0], w: [0] }, [], 'sandstone'); H(30, 14, 9, 9, 1, { s: [0] });
  H(-14, -30, 10, 8, 1, { n: [0] }); H(14, -30, 10, 8, 2, { n: [0] }, [], 'sandstone'); H(-14, 30, 10, 8, 1, { s: [0] }, [], 'sandstone');
  plankBridge(c, -9, -12, -5, -12, 2 * FH, 1.8); plankBridge(c, 3, -12, 7, -12, 2 * FH, 1.8);
  plankBridge(c, -9, 12, 7, 12, 2 * FH, 1.8);
  // roof dressing: awnings, rugs drying, pots
  for (const [x, z, y] of [[-16, -12, 6.4], [12, -12, 6.4], [13, 13, 6.4], [-30, 14, 6.4]]) { for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) push(c.deco, B(x + dx, z + dz, 0.12, 0.12, 2.0, 'wood', y)); push(c.deco, B(x, z, 3.0, 3.0, 0.1, rnd() < 0.5 ? 'awning_red' : 'awning_green', y + 2.0)); }
  for (const [x, z] of [[-30, -14], [30, 14], [-14, -30]]) push(c.deco, B(x, z, 0.8, 0.8, 0.7, 'mudbrick', FH));
  // minaret (stairs to the top) + small domed mosque hall
  building(c, { x: 22, z: 30, w: 6.6, d: 6.6, floors: 4, m: 'sandstone', roofM: 'mudroof', floorM: 'rug', doors: { s: [0] }, winGap: 2.4 });
  stepDome(c, 22, 30, 1.6, 13.75, 'trim', 'neon_orange');
  building(c, { x: 33, z: 30, w: 10, d: 10, floors: 1, fh: 4.4, m: 'plaster_white', roof: false, roofM: 'mudroof', floorM: 'rug', doors: { s: [0], w: [0] }, winY: [2, 3.6] });
  stepDome(c, 33, 30, 4.2, 4.6, 'plaster_white', 'trim');
  // covered souk street along the west road with stalls and cloth awnings
  for (let z = -10; z <= 10; z += 5) { stall(c, -40, z, 1, rnd() < 0.5 ? 'awning_red' : 'awning_green'); push(c.deco, R(-44, 3.4, z - 2.4, -36, 3.5, z + 2.2, rnd() < 0.5 ? 'awning_red' : 'awning_green')); }
  // walled compound with a gate (south-west)
  for (const [x0, z0, x1, z1] of [[-44, -44, -22, -43], [-44, -26, -36, -25], [-30, -26, -22, -25], [-44, -44, -43, -25], [-23, -44, -22, -25]]) push(c.boxes, R(x0, 0, z0, x1, 2.6, z1, 'mudbrick'));
  for (let x = -44; x < -22; x += 1.4) push(c.deco, B(x + 0.35, -43.5, 0.5, 1.0, 0.4, 'mudbrick', 2.6));
  tent(c, -33, -36, 6, 4, 'awning_red'); crate(c, -26, -40); crate(c, -27.3, -40.2, 1.0); barrel(c, -40, -40);
  // palms, carts, cover
  for (const [x, z] of [[-38, 32], [-30, 38], [38, -36], [30, -40], [6, 38], [-6, -38], [40, 4], [-8, 22]]) palm(c, x, z);
  for (const [x, z] of [[8, 4], [-8, -4], [22, -4], [-22, 4], [4, 22], [-4, -22]]) { crate(c, x, z); barrel(c, x + 1.2, z + 0.4, 'barrel_red'); }
  for (const [x, z, w, d] of [[40, 22, 0.8, 5], [22, 42, 5, 0.8], [-42, 22, 0.8, 5]]) push(c.boxes, B(x, z, w, d, 1.3, 'sandstone'));
  return c;
}

// ====================================================================================== CONSTRUCTION SITE
export function constructionNew() {
  const c = newCtx(), rnd = mulberry(7270);
  ground(c, -44, -44, 44, 44, 'dirt');
  ground(c, -44, -3, 44, 3, 'concrete_floor');
  // steel-frame tower: 4 storeys of open floors with stairs to the roof
  building(c, { x: -20, z: 18, w: 16, d: 12, floors: 4, walls: false, m: 'metal_dark', floorM: 'concrete_floor', roofM: 'concrete_floor' });
  for (let f = 1; f <= 4; f++) push(c.deco, R(-28.05, f * FH - 0.5, 11.95, -11.95, f * FH - 0.3, 24.05, 'crane')); // painted edge beams
  for (const [x, z] of [[-26, 14], [-14, 22]]) { pallets(c, x, z, 2); }
  push(c.boxes, B(-18, 14, 3, 2, 1.0, 'metal')); // rebar bundle on the ground floor
  // concrete core building (finished shell) with scaffolding stairs outside
  building(c, { x: 18, z: 20, w: 12, d: 10, floors: 2, m: 'concrete', floorM: 'concrete_floor', doors: { s: [0], w: [0] } });
  push(c.boxes, R(11.5, FH - 0.15, 13.4, 24.5, FH, 14.8, 'metal_grate')); railing(c, 11.5, 13.4, 24.5, 13.4, FH);
  stairFlight(c, 30.3, 14.1, -1, 0, 1.2, 8, FH / 8, 'metal_grate', 0, 0.725);
  for (let x = 11.5; x <= 24.5; x += 2.6) for (const z of [13.4, 14.8]) push(c.deco, B(x, z, 0.1, 0.1, 6.6, 'metal_dark'));
  // stacked site offices with an outside stair
  for (const [x, y] of [[30, 0], [33.5, 2.8], [37, 0]]) { push(c.boxes, B(x, -24, 6, 2.6, 2.8, 'portacabin', y)); push(c.deco, B(x, -24, 6.2, 2.8, 0.15, 'metal_roof', y + 2.8)); push(c.deco, B(x, -25.31, 1.2, 0.04, 0.8, 'car_glass', y + 1.3)); }
  stairFlight(c, 24.1, -26.4, 1, 0, 1.0, 7, 2.8 / 7, 'metal_grate', 0, 0.55);
  push(c.boxes, R(27.9, 2.65, -26.9, 29.6, 2.8, -25.3, 'metal_grate'));
  // tower crane in the middle (from the old map) with a hanging load
  push(c.boxes, B(0, 0, 4, 4, 0.6, 'concrete')); push(c.boxes, B(0, 0, 1.4, 1.4, 22, 'crane'));
  push(c.deco, R(-17, 21.2, -0.5, 15, 22.4, 0.5, 'crane')); push(c.deco, B(-14.5, 0, 3, 2, 1.6, 'concrete', 20)); push(c.deco, B(1.3, 0, 1.8, 1.8, 1.7, 'metal', 19.4));
  push(c.deco, B(12, 0, 0.1, 0.1, 12, 'metal_dark', 9.4)); push(c.deco, B(12, 0, 3.2, 1.2, 0.5, 'metal', 8.9));
  // excavation: dirt berms around a pit area with a ramp in
  for (const [x0, z0, x1, z1] of [[-40, -40, -14, -37], [-40, -22, -26, -19], [-40, -40, -37, -19], [-17, -40, -14, -19]]) push(c.boxes, R(x0, 0, z0, x1, 1.6, z1, 'dirt'));
  push(c.boxes, B(-30, -30, 4, 3, 0.9, 'metal_dark')); push(c.boxes, R(-36, 0, -31, -32, 1.2, -27, 'dirt'));
  placeRot(c, -22, -30, 0, (t) => { push(t.boxes, R(-1.4, 0.4, -2.6, 1.4, 1.8, 2.0, 'forklift')); push(t.boxes, R(-1.2, 1.8, 0.2, 1.2, 3.0, 2.0, 'forklift')); push(t.deco, R(-1.0, 2.2, 0.15, 1.0, 2.8, 0.2, 'car_glass')); push(t.deco, R(-0.2, 1.8, -5, 0.2, 2.2, -2.4, 'forklift')); push(t.deco, R(-0.8, 0.4, -5.4, 0.8, 1.2, -4.6, 'metal_dark')); for (const s of [-1.5, 1.5]) push(t.deco, R(s - 0.35, 0, -2.6, s + 0.35, 0.8, 2.4, 'tire')); }); // excavator
  // materials & machinery
  container(c, 30, 6, 1, 'container_blue'); container(c, 4, 11, 0, 'container_red'); container(c, -40, 6, 0, 'container_green');
  for (const [x, z, r] of [[12, -8, 0], [-8, -10, 1], [38, 32, 0]]) pipeStack(c, x, z, r);
  for (const [x, z] of [[-2, 28], [6, -30], [-34, 34]]) { push(c.boxes, B(x, z, 4.5, 3, 1.3, 'dirt')); push(c.boxes, B(x - 0.5, z, 2.5, 1.8, 2.0, 'dirt')); }
  for (const [x, z] of [[40, -40], [41.6, -40]]) push(c.boxes, B(x, z, 1.3, 1.3, 2.3, 'portaloo'));
  for (const [x, z, r] of [[6, 18, 1], [20, 6, 0], [-10, 6, 0], [-30, -10, 1], [10, -18, 0]]) barrier(c, x, z, r, 4);
  placeRot(c, -38, 20, 0, (t) => { push(t.boxes, R(-1.2, 0.4, -3.1, 1.2, 1.9, 3.1, 'forklift')); push(t.boxes, R(-1.15, 1.9, -3.1, 1.15, 3.1, -1.3, 'car_glass')); push(t.boxes, R(-1.0, 1.9, -1.0, 1.0, 3.8, 2.6, 'mixer')); for (const [dx, dz] of [[-1.25, -2.4], [1.25, -2.4], [-1.25, 1.2], [1.25, 1.2], [-1.25, 2.4], [1.25, 2.4]]) push(t.deco, B(dx, dz, 0.3, 0.9, 0.9, 'tire')); });
  for (const [x, z] of [[-6, -26], [26, -6], [-24, 2], [14, 34]]) { crate(c, x, z); crate(c, x + 1.3, z + 0.2, 1.0); crate(c, x + 0.6, z + 0.1, 0.9, 1.2); }
  sandbags(c, 22, 38, 4, 0.8); for (const x of [-36, 36]) lamp(c, x, -2.5);
  fence(c, -44, 42.5, 44, 42.5, 'metal_grate', 2.0, [-20, 10]);
  return c;
}

// ====================================================================================== KILLHOUSE
export function killhouseNew() {
  // symmetric shoot house: room grid with doorways, a raised catwalk ring for overwatch, tyre walls and target stands
  const q = newCtx();
  const W = (x0, z0, x1, z1, gap) => { // wall with an optional doorway centred at `gap`
    const ax = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    if (gap === undefined) { push(q.boxes, ax ? R(x0, 0, z0 - 0.15, x1, 3, z0 + 0.15, 'plaster_white') : R(x0 - 0.15, 0, z0, x0 + 0.15, 3, z1, 'plaster_white')); return; }
    if (ax) { push(q.boxes, R(x0, 0, z0 - 0.15, gap - 0.7, 3, z0 + 0.15, 'plaster_white')); push(q.boxes, R(gap + 0.7, 0, z0 - 0.15, x1, 3, z0 + 0.15, 'plaster_white')); push(q.boxes, R(gap - 0.7, 2.3, z0 - 0.15, gap + 0.7, 3, z0 + 0.15, 'plaster_white')); }
    else { push(q.boxes, R(x0 - 0.15, 0, z0, x0 + 0.15, 3, gap - 0.7, 'plaster_white')); push(q.boxes, R(x0 - 0.15, 0, gap + 0.7, x0 + 0.15, 3, z1, 'plaster_white')); push(q.boxes, R(x0 - 0.15, 2.3, gap - 0.7, x0 + 0.15, 3, gap + 0.7, 'plaster_white')); }
  };
  W(4, 6, 12, 6, 8); W(12, 2, 12, 10, 6); W(4, 10, 10, 10); W(16, 4, 16, 14, 9); W(6, 14, 16, 14, 11);
  W(4, 18, 14, 18, 7); W(18, 18, 18, 21);
  crate(q, 8, 12.4); crate(q, 14.2, 7, 1.0); barrel(q, 6, 8); push(q.boxes, B(19, 9, 3, 0.4, 1.1, 'concrete'));
  for (const [x, z] of [[20, 4], [10, 20]]) { for (let i = 0; i < 3; i++) push(q.boxes, B(x + i * 0.8, z, 0.75, 0.75, 0.75, 'tire')); push(q.boxes, B(x + 0.8, z, 0.75, 0.75, 0.75, 'tire', 0.75)); }
  for (const [x, z] of [[14, 12], [7, 16]]) { push(q.deco, B(x, z, 0.06, 0.06, 1.0, 'wood')); push(q.deco, B(x, z, 0.6, 0.04, 0.9, 'crate', 1.0)); }
  for (const b of [...q.boxes]) if (b.max[1] >= 3 && b.m === 'plaster_white') q.deco.push({ min: [b.min[0] - 0.02, 2.9, b.min[2] - 0.02], max: [b.max[0] + 0.02, 3.05, b.max[2] + 0.02], m: 'trim' });
  const c = newCtx();
  addRot(c, q, [0, 1, 2, 3]);
  // raised catwalk ring around the centre + stairs in two corners
  const r0 = 2.6, r1 = 4.2, y = 3.2;
  for (const [x0, z0, x1, z1] of [[-r1, -r1, r1, -r0], [-r1, r0, r1, r1], [-r1, -r0, -r0, r0], [r0, -r0, r1, r0]]) push(c.boxes, R(x0, y - 0.15, z0, x1, y, z1, 'metal_grate'));
  for (const [x, z] of [[-r1, -r1], [r1, -r1], [-r1, r1], [r1, r1]]) push(c.boxes, B(x, z, 0.25, 0.25, y - 0.15, 'metal_dark'));
  railing(c, -r1, -r1, r1, -r1, y); railing(c, -r1, r1, r1, r1, y);
  railing(c, r1, -r1, r1, -4.05, y); railing(c, r1, -2.75, r1, r1, y); railing(c, -r1, -r1, -r1, 2.75, y); railing(c, -r1, 4.05, -r1, r1, y); // gaps where the stairs land
  stairFlight(c, r1 + 0.6 + 8 * 0.55, -3.4, -1, 0, 1.2, 8, y / 8, 'metal_grate', 0, 0.55); push(c.boxes, R(r1, y - 0.15, -4.0, r1 + 0.6, y, -2.8, 'metal_grate'));
  stairFlight(c, -r1 - 0.6 - 8 * 0.55, 3.4, 1, 0, 1.2, 8, y / 8, 'metal_grate', 0, 0.55); push(c.boxes, R(-r1 - 0.6, y - 0.15, 2.8, -r1, y, 4.0, 'metal_grate'));
  crate(c, 0, 0, 2);
  return c;
}
