// Massive maps (~175–185 m): Shipyard, Suburbs, Canyon Town.
import {
  R, B, push, newCtx, FH, building, stairRun, car, tree, palm, stall, barrel, crate, sandbags, bench, lamp, container, fountain, dumpster, barrier,
  mulberry, jumpPad, armyTruck, watchtower, placeRot, place, gableRoof, house, fence, hedge, pool, cliff, mesa, bollard, pallets, pipeStack, rails,
  gantry, semiTruck, waterTower, acUnit, trafficLight, busStop, playground, goalPosts, hoop, gazebo, stepDome, tent, mineCart, plankBridge, wallSign,
  billboard, slabHoles, stairFlight, railing,
} from './mapkit.js';

const road = (c, x0, z0, x1, z1, m = 'asphalt') => push(c.deco, R(x0, 0, z0, x1, 0.035, z1, m));
function lightTower(c, x, z, h = 10) {
  push(c.boxes, B(x, z, 0.3, 0.3, h, 'metal_dark')); push(c.deco, B(x, z, 0.8, 0.8, 0.3, 'metal_dark'));
  push(c.deco, B(x, z, 2.2, 0.5, 0.6, 'metal_dark', h)); for (const s of [-0.6, 0.6]) push(c.deco, B(x + s, z - 0.27, 0.6, 0.05, 0.4, 'lamp', h + 0.1));
}
function fuelTank(c, x, z, h = 7) { // octagonal-ish tank with a ladder and a rim
  push(c.boxes, B(x, z, 6, 4.2, h, 'fueltank')); push(c.boxes, B(x, z, 4.2, 6, h, 'fueltank'));
  push(c.deco, B(x, z, 6.1, 4.3, 0.15, 'metal_dark', h)); push(c.deco, B(x, z, 4.3, 6.1, 0.15, 'metal_dark', h));
  push(c.deco, B(x, z, 3.6, 3.6, 0.5, 'fueltank', h)); push(c.deco, B(x - 3.05, z, 0.08, 0.6, h, 'metal_dark'));
  push(c.deco, B(x, z, 6.1, 4.3, 0.12, 'metal_dark', h * 0.5));
}

// ====================================================================================== SHIPYARD
function buildShip(c) {
  // Hull from x=-74 (stern) to x=-26, bow taper to x=-14. Beam 14 (z -42..-28). Main deck at y=8.
  const X0 = -74, X1 = -26, Z0 = -42, Z1 = -28, H = 8, T = 0.5;
  const side = (z0, z1, gaps) => { // a hull side split around construction openings
    let cur = X0;
    for (const [a, b] of [...gaps, [X1, X1]]) {
      push(c.boxes, R(cur, 0, z0, a, 4.5, z1, 'hull_red')); push(c.boxes, R(cur, 4.5, z0, a, H, z1, 'hull_dark'));
      if (b > a) { push(c.boxes, R(a, 3.2, z0, b, 4.5, z1, 'hull_red')); push(c.boxes, R(a, 4.5, z0, b, H, z1, 'hull_dark'));
        for (const xx of [a, b]) push(c.deco, R(xx - 0.12, 0, z0 - 0.15, xx + 0.12, 3.3, z1 + 0.15, 'hazard'));
        push(c.deco, R(a - 0.12, 3.2, z0 - 0.15, b + 0.12, 3.4, z1 + 0.15, 'hazard')); }
      cur = b;
    }
  };
  side(Z0, Z0 + T, [[-54, -50]]); side(Z1 - T, Z1, [[-44, -40]]);
  push(c.boxes, R(X0, 0, Z0, X0 + T, 4.5, Z1, 'hull_red')); push(c.boxes, R(X0, 4.5, Z0, X0 + T, H, Z1, 'hull_dark'));   // stern
  push(c.boxes, R(X1 - T, 0, Z0, X1, H, Z1, 'hull_dark'));                                                              // forward bulkhead
  // bow: solid tapered blocks, deck on top + raised forecastle
  const steps = [[-26, -23, 14], [-23, -20, 11.5], [-20, -17, 8.5], [-17, -14.5, 5]];
  for (const [a, b, w] of steps) { push(c.boxes, R(a, 0, -35 - w / 2, b, 4.5, -35 + w / 2, 'hull_red')); push(c.boxes, R(a, 4.5, -35 - w / 2, b, H, -35 + w / 2, 'hull_dark')); }
  push(c.boxes, R(-22, H, -40, -15, H + 1.4, -30, 'hull_dark')); push(c.deco, R(-22.05, H + 1.4, -40.05, -14.95, H + 1.5, -29.95, 'deck'));
  stairRun(c, -23.8, -35, 1, 0, 3, 3, 0.47, 'deck', H, 0.6);
  push(c.deco, B(-19, -35, 1.2, 1.2, 1.0, 'metal_dark', H + 1.4)); push(c.deco, B(-16, -35, 0.6, 0.6, 1.4, 'metal_dark', H + 1.4)); // winch + bollard
  for (const s of [-1, 1]) push(c.deco, B(-18.5, -35 + s * 4.6, 1.4, 0.3, 1.6, 'metal_dark', 5.6)); // anchors
  // boot topping, waterline band and portholes on the outside
  for (const [z, o] of [[Z0, -1], [Z1, 1]]) {
    push(c.deco, R(X0, 0, z + o * 0.02 - (o < 0 ? 0.04 : 0), X1, 0.7, z + o * 0.06, 'metal_dark'));
    push(c.deco, R(X0, 4.45, z - 0.06, X1, 4.6, z + 0.06, 'trim'));
    for (let x = X0 + 3; x < X1 - 1; x += 3) if (!(x > -55 && x < -49) && !(x > -45 && x < -39)) push(c.deco, B(x, z, 0.5, 0.14, 0.5, 'car_glass', 6.0));
  }
  // hold: tween-deck ledges at y=4, cross catwalk, stairs
  push(c.boxes, R(-64.5, 3.75, Z0 + T, X1 - T, 4, -39, 'metal_grate'));
  push(c.boxes, R(X0 + T, 3.75, -31, -34, 4, Z1 - T, 'metal_grate'));
  push(c.boxes, R(-51, 3.75, -39, -49, 4, -31, 'metal_grate'));
  railing(c, -64.5, -39, X1 - T, -39, 4); railing(c, X0 + T, -31, -34, -31, 4);
  stairFlight(c, -70, -40.5, 1, 0, 2, 10, 0.4, 'metal_grate', 0);            // floor -> south ledge
  stairFlight(c, -28.5, -29.6, -1, 0, 2, 10, 0.4, 'metal_grate', 0);          // floor -> north ledge
  stairFlight(c, -40, -40.4, 1, 0, 1.8, 10, 0.4, 'metal_grate', 4);           // south ledge -> deck
  stairFlight(c, -60.5, -29.6, 1, 0, 1.8, 10, 0.4, 'metal_grate', 4);        // north ledge -> deck (comes up in front of the bridge, not inside it)
  for (const [x, z, col] of [[-62, -35, 'container_red'], [-44, -36, 'container_green'], [-36, -34, 'container_blue']]) container(c, x, z, 1, col);
  container(c, -62, -35, 1, 'container_blue', 2.6); crate(c, -56, -33); crate(c, -56.8, -36, 1.0); pallets(c, -46, -31);
  // main deck with hatch openings + stair holes
  const holes = [[-60, -38, -53, -32], [-46, -38, -32, -32], [-40.5, -41.6, -34.2, -39.2], [-61, -30.8, -54.7, -28.4]]; // (clear of the bridge so its doors open onto deck)
  slabHoles(c, X0, Z0, X1, Z1, H, 'deck', holes);
  for (const [a, b, d, e] of holes.slice(0, 2)) { // hatch coamings
    push(c.boxes, R(a - 0.3, H, b - 0.3, e === -32 ? d + 0.3 : d + 0.3, H + 0.7, b, 'hull_dark')); push(c.boxes, R(a - 0.3, H, e, d + 0.3, H + 0.7, e + 0.3, 'hull_dark'));
    push(c.boxes, R(a - 0.3, H, b, a, H + 0.7, e, 'hull_dark')); push(c.boxes, R(d, H, b, d + 0.3, H + 0.7, e, 'hull_dark'));
    for (let x = a; x < d; x += 3) push(c.deco, R(x + 0.2, H + 0.7, b - 0.35, x + 0.35, H + 0.75, e + 0.35, 'metal_dark'));
  }
  // deck railings (gap at the gangway, x -31..-29 on the south side)
  railing(c, X0, Z0 + 0.1, -31, Z0 + 0.1, H); railing(c, -29, Z0 + 0.1, -14.5, Z0 + 0.1, H); railing(c, X0, Z1 - 0.1, -14.5, Z1 - 0.1, H);
  railing(c, X0 + 0.1, Z0, X0 + 0.1, Z1, H);
  // deck cranes (visual) + vents
  for (const x of [-50, -30]) { push(c.boxes, B(x, -30.5, 1.4, 1.4, 4.5, 'crane', H)); push(c.deco, R(x - 0.3, H + 4.2, -30.8, x + 9, H + 4.8, -30.2, 'crane')); push(c.deco, B(x + 8.6, -30.5, 0.06, 0.06, 4, 'metal_dark', H + 0.4)); }
  for (const x of [-60, -42, -28]) { push(c.boxes, B(x, -40.6, 0.8, 0.8, 1.6, 'metal', H)); push(c.deco, B(x, -40.6, 1.0, 1.0, 0.3, 'metal_dark', H + 1.6)); }
  // superstructure on the stern: 2 floors, bridge wings, funnel, mast
  place(c, 0, H, 0, (t) => building(t, { x: -68, z: -35, w: 11, d: 12, floors: 2, m: 'panel_white', roof: false, roofM: 'metal_roof', floorM: 'floor_tile', doors: { e: [0, { c: 3.5, w: 1.2 }] }, winY: [1.1, 2.3], winGap: 2.2 }));
  push(c.deco, R(-70, H + FH - 0.1, -43.5, -66, H + FH + 0.1, -26.5, 'panel_white'));
  for (const s of [-43.5, -26.5]) push(c.deco, R(-70, H + FH + 0.1, s - 0.04, -66, H + FH + 1.1, s + 0.04, 'metal'));
  push(c.deco, B(-70.5, -35, 3.4, 4.2, 4.5, 'hull_red', H + 2 * FH + 0.4)); push(c.deco, B(-70.5, -35, 3.5, 4.3, 0.8, 'metal_dark', H + 2 * FH + 4.9));
  push(c.deco, B(-66, -35, 0.25, 0.25, 6, 'metal_dark', H + 2 * FH + 0.4)); push(c.deco, R(-66.1, H + 2 * FH + 5, -36.6, -65.9, H + 2 * FH + 5.2, -33.4, 'metal_dark'));
  push(c.deco, B(-66, -35, 1.6, 0.4, 0.3, 'metal', H + 2 * FH + 6.2));
  // gangway: dock-side stair tower up to the deck
  stairFlight(c, -30, -61.3, 0, 1, 2, 20, 0.4, 'metal_grate', 0, 0.55);
  push(c.boxes, R(-31, H - 0.2, -50.3, -29, H, -42, 'metal_grate'));
  railing(c, -31.05, -50.3, -31.05, -42, H); railing(c, -28.95, -50.3, -28.95, -42, H);
  for (const z of [-60, -55, -50]) for (const x of [-31.1, -28.9]) push(c.deco, B(x, z, 0.14, 0.14, (z + 61.3) / 0.55 * 0.4 + 1, 'metal_dark'));
}
export function shipyard() {
  const c = newCtx(), rnd = mulberry(91184);
  // quay, water and the fence along the edge
  push(c.deco, R(-92, 0, -92, 92, 0.03, -74, 'water'));
  push(c.deco, R(-92, 0, -74.6, 92, 0.12, -73.4, 'stone'));
  for (let x = -88; x <= 88; x += 4) push(c.boxes, R(x - 2, 0, -74.1, x + 2, 3.0, -73.9, 'metal_grate'));
  for (let x = -86; x <= 86; x += 8) bollard(c, x, -72.6);
  for (const x of [22, 58]) { // ship-to-shore cranes: portal legs on the quay, boom out over the water
    for (const sx of [-6, 6]) for (const sz of [-71.5, -61]) push(c.boxes, B(x + sx, sz, 1.2, 1.2, 20, 'crane'));
    for (const sx of [-6, 6]) push(c.deco, R(x + sx - 0.7, 20, -92, x + sx + 0.7, 21.5, -54, 'crane'));
    push(c.deco, R(x - 6.7, 18.8, -72.1, x + 6.7, 20, -70.9, 'crane')); push(c.deco, R(x - 6.7, 18.8, -61.6, x + 6.7, 20, -60.4, 'crane'));
    push(c.deco, B(x, -57, 8, 5, 4, 'panel_white', 21.5)); push(c.deco, B(x, -84, 4, 3, 1.4, 'metal_dark', 19)); push(c.deco, B(x + 2.6, -82, 2, 2, 1.8, 'panel_white', 17.6));
    push(c.deco, B(x, -84, 0.08, 0.08, 13, 'metal_dark', 6)); push(c.deco, B(x, -84, 2.6, 1.0, 0.4, 'metal_dark', 5.6));
  }
  for (const [x, col] of [[10, 'container_red'], [16.5, 'container_blue'], [34, 'container_green'], [46, 'container_red'], [70, 'container_blue']]) container(c, x, -67.5, 1, col);
  container(c, 16.5, -67.5, 1, 'container_green', 2.6);
  // ---- dry dock with the ship
  push(c.deco, R(-84, 0, -60, -10, 0.04, -10, 'concrete_floor'));
  for (const [x0, z0, x1, z1] of [[-84, -60.5, -36, -59.5], [-24, -60.5, -10, -59.5], [-84, -10.5, -52, -9.5], [-40, -10.5, -10, -9.5], [-84.5, -60, -83.5, -10], [-10.5, -60, -9.5, -40], [-10.5, -30, -9.5, -10]])
    push(c.boxes, R(x0, 0, z0, x1, 1.1, z1, 'concrete'));
  for (let x = -70; x <= -24; x += 6) for (const z of [-44, -26]) push(c.boxes, B(x, z, 1.6, 2, 0.5, 'wood'));
  buildShip(c);
  gantry(c, -45, -35, 36, 24);
  // ---- container yard (two 10 m lanes for the yard gantries)
  push(c.deco, R(6, 0, -70, 88, 0.04, -10, 'asphalt'));
  const cols = [12, 19, 36, 43, 50, 67, 74, 81], rows = [-63, -55, -47, -39, -31, -23, -15];
  const colors = ['container_red', 'container_blue', 'container_green'];
  const access = { '12,-55': 4.75, '36,-39': 28.75, '67,-23': 59.75, '12,-31': 4.75 }; // stairs up onto these single stacks
  for (const zr of rows) for (const xc of cols) {
    const acc = access[xc + ',' + zr];
    if (rnd() < 0.14 && acc === undefined) continue;
    const n = acc !== undefined ? 1 : 1 + Math.floor(rnd() * 3);
    if (acc !== undefined) stairFlight(c, acc, zr, 1, 0, 1.6, 7, 2.6 / 7, 'metal_grate', 0, 0.6);
    for (let k = 0; k < n; k++) container(c, xc, zr, 1, colors[Math.floor(rnd() * 3)], k * 2.6);
  }
  for (const x of [27.5, 58.5]) gantry(c, x, -39, 58, 15);
  for (const x of [27.5, 58.5]) for (const sx of [-4, 4]) push(c.deco, R(x + sx - 0.12, 0.02, -70, x + sx + 0.12, 0.1, -8, 'metal'));
  // ---- road + rail through the middle
  road(c, -92, 0, 92, 9); for (let x = -88; x <= 88; x += 6) push(c.deco, R(x, 0.04, 4.35, x + 3, 0.05, 4.65, 'paint_white'));
  rails(c, -92, 15, 92);
  for (const [x, cols2] of [[-60, ['container_red', 'container_blue']], [-30, ['container_green']], [10, ['container_blue', 'container_red']], [48, ['container_red']]]) {
    push(c.boxes, R(x - 7, 0.3, 13.8, x + 7, 1.2, 16.2, 'metal_dark'));
    for (const s of [-5, 5]) push(c.deco, B(x + s, 15, 1.6, 2.6, 0.7, 'tire'));
    cols2.forEach((col, i) => container(c, x - 3.2 + i * 6.4, 15, 1, col, 1.2));
  }
  semiTruck(c, -14, 6.5, 1, 'container_red'); semiTruck(c, 30, 2.5, 3, 'container_blue'); semiTruck(c, 70, 6.5, 1, 'container_green');
  for (const x of [-70, -40, -10, 20, 50, 80]) lightTower(c, x, -2, 11);
  // ---- warehouses, office, workshop
  building(c, { x: -55, z: 52, w: 34, d: 20, fh: 7.5, floors: 1, roof: false, m: 'metal_corr', roofM: 'metal_roof', floorM: 'concrete_floor',
    doors: { s: [{ c: -8, w: 5, h: 5.5 }, { c: 8, w: 5, h: 5.5 }], e: [0], w: [0] }, winY: [5.2, 6.6], winGap: 5 });
  push(c.boxes, R(-71.7, 3.4, 56, -43.9, 3.65, 61.7, 'metal_grate')); railing(c, -71.7, 56, -43.9, 56, 3.65); railing(c, -43.9, 56, -43.9, 57, 3.65);
  stairFlight(c, -38.9, 59.6, -1, 0, 1.6, 9, 3.65 / 9, 'metal_grate', 0, 0.55); // up to the mezzanine along the north wall
  for (const x of [-64, -56, -48]) for (const z of [45, 50]) { push(c.boxes, B(x, z, 5, 1.2, 0.12, 'metal', 1.4)); push(c.boxes, B(x, z, 5, 1.2, 0.12, 'metal', 2.8)); for (const sx of [-2.4, 2.4]) push(c.boxes, B(x + sx, z, 0.12, 1.2, 3.6, 'metal_dark')); crate(c, x - 1, z, 1.0, 0); crate(c, x + 1.2, z, 1.0, 1.52); }
  building(c, { x: 4, z: 58, w: 30, d: 18, fh: 7, floors: 1, roof: false, m: 'metal_corr', roofM: 'metal_roof', floorM: 'concrete_floor',
    doors: { s: [{ c: 0, w: 6, h: 5.5 }], e: [2], w: [-2] }, winY: [4.8, 6.2], winGap: 5 });
  for (const [x, z] of [[-6, 54], [-3, 61], [10, 55], [13, 61]]) { pallets(c, x, z, 2); }
  container(c, 4, 61, 1, 'container_red'); push(c.boxes, B(12, 50.5, 1.4, 2.4, 1.4, 'forklift')); push(c.deco, B(12, 49.1, 1.2, 0.15, 2.6, 'metal_dark'));
  building(c, { x: 48, z: 54, w: 16, d: 12, floors: 3, m: 'concrete_panel', floorM: 'floor_tile', doors: { s: [0], w: [0] }, partition: 2.5 });
  waterTower(c, 52, 50.5, 9.6); acUnit(c, 44, 50, 9.6);
  building(c, { x: -78, z: 20, w: 12, d: 16, floors: 1, fh: 5, roof: false, m: 'metal_corr', roofM: 'metal_roof', floorM: 'concrete_floor', doors: { e: [{ c: 0, w: 4, h: 4 }], s: [0] }, winY: [3, 4.2] });
  for (let i = 0; i < 4; i++) car(c, 34 + i * 3.2, 38, 0, ['car_red', 'car_blue', 'car_glass', 'car_red'][i]);
  // ---- fuel tank farm with a catwalk across the tops
  for (const [x, z] of [[70, 30], [80, 30], [70, 44], [80, 44]]) fuelTank(c, x, z, 7);
  push(c.boxes, R(74, 6.8, 29, 76, 7, 45, 'metal_grate')); push(c.boxes, R(65, 6.8, 36, 85, 7, 38, 'metal_grate'));
  railing(c, 74, 29, 74, 36, 7); railing(c, 76, 29, 76, 36, 7);
  stairFlight(c, 75, 59.5, 0, -1, 1.6, 18, 7 / 18, 'metal_grate', 0, 0.55); push(c.boxes, R(74, 6.8, 45, 76, 7, 49.6, 'metal_grate'));
  for (const z of [24, 51]) pipeStack(c, 75, z, 1);
  // ---- scrap / steel yard (west) + misc cover
  for (const [x, z] of [[-80, -2], [-72, 34], [-30, 30], [-18, 40], [20, 32], [30, 72], [-80, 74], [60, 74]]) { pipeStack(c, x, z, Math.floor(rnd() * 2)); }
  for (let i = 0; i < 16; i++) { const x = -88 + rnd() * 176, z = 22 + rnd() * 60; if (Math.abs(x + 55) < 19 && z > 40) continue; if (Math.abs(x - 4) < 17 && z > 47) continue; if (x > 38 && x < 58 && z > 46) continue; if (x > 64 && z < 52) continue; if (z > 29 && z < 35.5 && x < 31) continue; if (x > -36 && x < -8 && z > 71) continue; if (x > 26 && x < 42 && z > 68) continue; if (x < -58 && z > 62) continue; pallets(c, x, z, 1 + Math.floor(rnd() * 3)); }
  for (const [x, z] of [[-6, 24], [-48, 26], [40, 24], [-86, 50], [86, 66]]) { barrel(c, x, z); barrel(c, x + 0.8, z + 0.3, 'barrel_red'); }
  for (const [x, z] of [[-20, 72], [26, 44], [-86, 30]]) { crate(c, x, z, 1.4); crate(c, x + 1.5, z + 0.2); crate(c, x + 0.7, z, 1.0, 1.4); }
  // ---- elevated pipe rack with a catwalk on top (x -70..24 at z 32), stairs at both ends
  const PZ = 32.2, PY = 4.5;
  for (let x = -70; x <= 24; x += 6) for (const s of [-1.1, 1.1]) push(c.boxes, B(x, PZ + s, 0.35, 0.35, PY - 0.2, 'metal_dark'));
  for (let x = -70; x <= 24; x += 6) push(c.deco, R(x - 0.2, PY - 0.9, PZ - 1.3, x + 0.2, PY - 0.6, PZ + 1.3, 'metal_dark'));
  push(c.boxes, R(-70, PY - 0.2, PZ - 1.2, 24, PY, PZ + 1.2, 'metal_grate'));
  railing(c, -70, PZ - 1.2, 24, PZ - 1.2, PY); railing(c, -70, PZ + 1.2, 24, PZ + 1.2, PY);
  for (const [dz, dy] of [[-0.7, 3.0], [0, 2.95], [0.7, 3.0]]) push(c.deco, R(-70, dy, PZ + dz - 0.22, 24, dy + 0.44, PZ + dz + 0.22, dz ? 'metal' : 'fueltank'));
  stairFlight(c, 24 + 11 * 0.55, PZ, -1, 0, 1.6, 11, PY / 11, 'metal_grate', 0, 0.55);
  stairFlight(c, -70 - 11 * 0.55, PZ, 1, 0, 1.6, 11, PY / 11, 'metal_grate', 0, 0.55);
  // ---- ship assembly hall: open-ended shed with hull blocks and scaffold stairs
  building(c, { x: -22, z: 80, w: 26, d: 16, fh: 9, floors: 1, roof: false, m: 'metal_corr', roofM: 'metal_roof', floorM: 'concrete_floor',
    doors: { e: [{ c: 0, w: 9, h: 7 }], w: [{ c: 0, w: 9, h: 7 }], s: [-6, 6] }, winY: [6.5, 8], winGap: 4 });
  for (const x of [-29, -15]) {
    push(c.boxes, B(x, 81, 8, 6, 2.2, 'hull_red')); push(c.boxes, B(x, 81, 8, 6, 1.8, 'hull_dark', 2.2)); push(c.deco, B(x, 81, 8.1, 6.1, 0.08, 'deck', 4.0));
    stairFlight(c, x - 1.5, 73.0, 0, 1, 1.4, 10, 0.4, 'metal_grate', 0, 0.55);
  }
  push(c.deco, B(-22, 80, 0.3, 14, 0.6, 'crane', 7.6)); push(c.deco, B(-22, 80, 2, 1.2, 0.8, 'metal_dark', 6.8));
  // ---- north-west container cluster
  for (const [x, z, n, col] of [[-82, 66, 2, 'container_blue'], [-82, 74, 1, 'container_red'], [-82, 82, 3, 'container_green'], [-72, 70, 1, 'container_green'], [-72, 78, 2, 'container_red'], [-62, 86, 1, 'container_blue']])
    for (let k = 0; k < n; k++) container(c, x, z, 0, k % 2 ? 'container_red' : col, k * 2.6);
  stairFlight(c, -72, 70 - 3 - 4.2, 0, 1, 1.6, 7, 2.6 / 7, 'metal_grate', 0, 0.6);
  // ---- canteen, steel plate stacks, barriers
  building(c, { x: 34, z: 78, w: 12, d: 8, floors: 1, m: 'portacabin', roof: false, roofM: 'metal_roof', floorM: 'floor_tile', doors: { s: [-2], w: [0] } });
  for (const x of [28, 32, 36]) { push(c.boxes, B(x, 71, 2.2, 0.8, 0.75, 'wood')); push(c.boxes, B(x, 70.1, 2.2, 0.35, 0.45, 'wood')); push(c.boxes, B(x, 71.9, 2.2, 0.35, 0.45, 'wood')); }
  for (const [x, z, h] of [[-4, 26, 1.0], [14, 24, 1.6], [-58, 22, 1.2], [40, 66, 0.8], [62, 20, 1.4]]) { push(c.boxes, B(x, z, 6, 3, h, 'metal')); push(c.deco, B(x, z, 6.05, 3.05, 0.06, 'metal_dark', h * 0.5)); }
  for (const [x, z, r] of [[-30, 20, 0], [-20, 20, 0], [0, 40, 1], [26, 46, 1], [-88, 6, 1]]) barrier(c, x, z, r, 4);
  push(c.boxes, B(86, 4.5, 3, 3, 2.6, 'portacabin')); push(c.deco, B(86, 4.5, 3.4, 3.4, 0.2, 'metal_roof', 2.6)); // gate booth
  for (const x of [-60, -2, 50]) busStop(c, x, 11.2, 2);
  jumpPad(c, -10, -64); jumpPad(c, 86, -20);
  return c;
}

// ====================================================================================== SUBURBS
const SIDINGS = ['siding_white', 'siding_blue', 'siding_yellow', 'siding_sage'];
// Houses along one side of a block. side: 'n'|'s'|'e'|'w' = the road side. depth = lot depth into the block.
function lotRow(c, rnd, x0, z0, x1, z1, side, depth, lots) {
  const alongX = side === 'n' || side === 's';
  const a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1;
  const edge = side === 'n' ? z1 : side === 's' ? z0 : side === 'e' ? x1 : x0;
  const inward = side === 'n' || side === 'e' ? -1 : 1;
  const rot = { s: 0, e: 1, n: 2, w: 3 }[side];
  const L = (a1 - a0) / lots;
  const P = (a, d) => alongX ? [a, edge + inward * d] : [edge + inward * d, a];
  for (let i = 0; i < lots; i++) {
    const a = a0 + L * (i + 0.5);
    const w = 8.5 + Math.floor(rnd() * 3) * 0.5, d = 7.5 + rnd() * 1.0, floors = rnd() < 0.45 ? 2 : 1;
    const [hx, hz] = P(a - 1.5, 5 + d / 2);
    house(c, hx, hz, rot, { w, d, floors, m: SIDINGS[Math.floor(rnd() * 4)], roofM: rnd() < 0.55 ? 'roof_red' : 'roof_slate', doorX: -w / 4 });
    // driveway + car
    const da = a + w / 2 + 0.8;
    if (da + 1.6 < a0 + L * (i + 1)) {
      const [p0x, p0z] = P(da - 1.4, 0), [p1x, p1z] = P(da + 1.4, 9);
      push(c.deco, R(p0x, 0, p0z, p1x, 0.04, p1z, 'concrete_floor'));
      if (rnd() < 0.75) { const [cx, cz] = P(da, 4.5); car(c, cx, cz, alongX ? 0 : 1, ['car_red', 'car_blue', 'car_glass'][Math.floor(rnd() * 3)]); }
    }
    // walkway to the porch
    { const [p0x, p0z] = P(a - 1.5 - w / 4 - 0.7, 0), [p1x, p1z] = P(a - 1.5 - w / 4 + 0.7, 3.2); push(c.deco, R(p0x, 0, p0z, p1x, 0.04, p1z, 'paving')); }
    // lot boundary fence (towards the back) and back fence
    if (i > 0) { const [f0x, f0z] = P(a0 + L * i, 3), [f1x, f1z] = P(a0 + L * i, depth - 0.3); fence(c, f0x, f0z, f1x, f1z, 'fence_white', 1.1); }
    { const [f0x, f0z] = P(a0 + L * i + 0.2, depth - 0.3), [f1x, f1z] = P(a0 + L * (i + 1) - 0.2, depth - 0.3); fence(c, f0x, f0z, f1x, f1z, 'wood', 1.6, Math.abs(alongX ? f0z : f0x) > 86 ? [] : [ (alongX ? (f0x + f1x) : (f0z + f1z)) / 2 ]); } // (no back gate onto the map edge)
    // backyard: pool, tree, shed, bbq
    const back = 5 + d + 2.5, room = depth - back - 0.8;
    if (room > 5.5 && rnd() < 0.5) { const [px, pz] = P(a, back + room / 2); pool(c, px, pz, alongX ? 7 : room - 1.5, alongX ? room - 1.5 : 7); }
    else { const [tx, tz] = P(a + (rnd() - 0.5) * 6, back + room / 2); if (room > 2.5) tree(c, tx, tz, 0.8 + rnd() * 0.4); }
    if (room > 3 && rnd() < 0.5) { const [sx, sz] = P(a0 + L * (i + 1) - 2.2, depth - 2.2); push(c.boxes, B(sx, sz, 2.4, 2.4, 2.2, 'wood')); push(c.deco, B(sx, sz, 2.8, 2.8, 0.2, 'roof_slate', 2.2)); }
    // front hedge segments
    if (rnd() < 0.6) { const [h0x, h0z] = P(a0 + L * i + 0.6, 0.6), [h1x, h1z] = P(a - 1.5 - w / 4 - 1.2, 1.4); hedge(c, Math.min(h0x, h1x), Math.min(h0z, h1z), Math.max(h0x, h1x), Math.max(h0z, h1z), 0.9); }
  }
}
export function suburbs() {
  const c = newCtx(), rnd = mulberry(20261120);
  // roads: E-W at z = -50, 0, 50; N-S at x = -44, 44 (10 m wide) with sidewalks and lane paint
  for (const z of [-50, 0, 50]) { road(c, -88, z - 5, 88, z + 5); push(c.deco, R(-88, 0, z - 7.2, 88, 0.06, z - 5, 'paving')); push(c.deco, R(-88, 0, z + 5, 88, 0.06, z + 7.2, 'paving')); for (let x = -86; x < 86; x += 6) push(c.deco, R(x, 0.04, z - 0.12, x + 3, 0.05, z + 0.12, 'paint_white')); }
  for (const x of [-44, 44]) { road(c, x - 5, -88, x + 5, 88); push(c.deco, R(x - 7.2, 0, -88, x - 5, 0.06, 88, 'paving')); push(c.deco, R(x + 5, 0, -88, x + 7.2, 0.06, 88, 'paving')); for (let z = -86; z < 86; z += 6) push(c.deco, R(x - 0.12, 0.04, z, x + 0.12, 0.05, z + 3, 'paint_white')); }
  for (const x of [-44, 44]) for (const z of [-50, 0, 50]) { trafficLight(c, x - 6.2, z - 6.2); trafficLight(c, x + 6.2, z + 6.2); }
  for (const x of [-70, -20, 20, 70]) for (const z of [-50, 0, 50]) { lamp(c, x, z - 6.4); lamp(c, x + 10, z + 6.4); }
  // residential blocks (west + east columns, south-centre row)
  const W = [-88, -51.2], E = [51.2, 88];
  for (const [x0, x1, roadSide, backSide] of [[W[0], W[1], 'e', 'w'], [E[0], E[1], 'w', 'e']]) {
    lotRow(c, rnd, x0, -88, x1, -57.2, roadSide, 19, 2);
    const mid = x0 > 0 ? newCtx() : c; // east middle block is the gas station: build (and throw away) its lots so the rest of the layout stays the same
    lotRow(mid, rnd, x0, -42.8, x1, -7.2, roadSide, 19, 2);
    lotRow(mid, rnd, x0, -42.8, x1, -7.2, backSide, 17, 2);
    lotRow(c, rnd, x0, 57.2, x1, 88, roadSide, 19, 2);
  }
  lotRow(c, rnd, -36.8, -88, 36.8, -57.2, 'n', 30, 5);
  lotRow(c, rnd, W[0], 7.2, W[1], 42.8, 'e', 19, 2); lotRow(c, rnd, W[0], 7.2, W[1], 42.8, 'w', 17, 2);
  // ---- mall + parking (centre south block)
  building(c, { x: 0, z: -31, w: 48, d: 20, floors: 2, fh: 4.2, m: 'concrete_panel', floorM: 'floor_tile', roofM: 'roof',
    doors: { n: [-14, { c: 0, w: 4, h: 3.2 }, 14], s: [{ c: -15.5, w: 3.6, h: 3.4 }], e: [0], w: [0] }, winY: [0.9, 3.4], winGap: 3.2, partition: -6 });
  for (let k = -20; k <= 16; k += 9) if (Math.abs(k + 6) > 2) { // shop unit walls inside along the south wall
    push(c.boxes, R(k - 0.1, 0, -40.7, k + 0.1, 4.0, -35.5, 'plaster_white'));
  }
  for (const [x, col] of [[-18, 'neon_orange'], [0, 'neon_cyan'], [18, 'neon_orange']]) wallSign(c, x, -21, 2, 4.3, 7, 1.1, col);
  push(c.deco, R(-24.2, 4.2, -21.2, 24.2, 4.45, -20.4, 'metal_dark'));
  for (const x of [-16, 0, 16]) { acUnit(c, x, -36, 8.4); push(c.boxes, B(x, -28, 4, 3, 0.25, 'glass', 8.4)); }
  push(c.deco, R(-38, 0, -19, 38, 0.04, -7.5, 'asphalt'));
  for (let x = -34; x <= 34; x += 3.4) { push(c.deco, R(x, 0.04, -18.6, x + 0.12, 0.05, -14, 'paint_white')); push(c.deco, R(x, 0.04, -12.6, x + 0.12, 0.05, -8, 'paint_white')); }
  for (let i = 0; i < 22; i++) { if (rnd() < 0.45) continue; const row = i < 11 ? -16.3 : -10.3; car(c, -32.3 + (i % 11) * 6.8, row, 0, ['car_red', 'car_blue', 'car_glass'][Math.floor(rnd() * 3)]); }
  for (const x of [-26, 0, 26]) lamp(c, x, -13.3);
  semiTruck(c, -12, -46.5, 1, 'container_green'); dumpster(c, 6, -42.4, 0); dumpster(c, 9, -42.4, 0); pallets(c, 14, -43);
  // ---- park (centre block)
  push(c.deco, R(-37, 0, 7.2, 37, 0.04, 42.8, 'grass'));
  push(c.deco, R(-37, 0.04, 23.5, 37, 0.06, 26.5, 'paving')); push(c.deco, R(-1.5, 0.04, 7.2, 1.5, 0.06, 42.8, 'paving'));
  push(c.deco, B(-18, 34, 16, 9, 0.3, 'water')); for (const [dx, dz, w, d] of [[0, -4.7, 16.8, 0.6], [0, 4.7, 16.8, 0.6], [-8.4, 0, 0.6, 10], [8.4, 0, 0.6, 10]]) push(c.boxes, B(-18 + dx, 34 + dz, w, d, 0.45, 'stone'));
  gazebo(c, 18, 34); playground(c, 18, 14); fountain(c, 0, 25);
  for (const [x, z] of [[-30, 12], [-22, 16], [-8, 12], [-32, 20], [30, 20], [8, 40], [30, 40], [-6, 34], [34, 10]]) tree(c, x, z, 0.9 + rnd() * 0.4);
  for (const [x, z, r] of [[-10, 21.5, 0], [10, 21.5, 0], [-10, 28.5, 0], [10, 28.5, 0], [-4, 34, 1]]) bench(c, x, z, r);
  hedge(c, -36, 7.6, -20, 8.4, 1.0); hedge(c, 20, 7.6, 36, 8.4, 1.0);
  building(c, { x: -30, z: 17, w: 6, d: 4.4, floors: 1, m: 'brick', roof: false, doors: { e: [0] }, floorM: 'floor_tile' }); gableRoof(c, -33, 14.8, -27, 19.2, FH, 'roof_slate');
  // ---- school (centre north block): classrooms, gym, court, small pitch, bus
  building(c, { x: -14, z: 77, w: 38, d: 12, floors: 2, m: 'brick', floorM: 'floor_tile', doors: { s: [-10, { c: 2, w: 2.6, h: 2.6 }, 12], e: [0] }, partition: 0 });
  building(c, { x: 23, z: 75, w: 16, d: 18, floors: 1, fh: 6.5, m: 'concrete_panel', roof: false, roofM: 'metal_roof', floorM: 'floor_wood', doors: { s: [-3, 3], w: [2] }, winY: [4.3, 5.8], winGap: 3.2 });
  hoop(c, 23, 67.4, 0); hoop(c, 23, 82.6, 2);
  push(c.deco, R(-36, 0, 56.5, -6, 0.04, 68, 'grass')); goalPosts(c, -35, 62, 1); goalPosts(c, -7, 62, 3);
  push(c.deco, R(2, 0, 56.5, 34, 0.04, 64.5, 'asphalt')); hoop(c, 3.2, 60.5, 1); hoop(c, 32.8, 60.5, 3);
  // school bus parked at the kerb outside the fence (clear of the gates)
  push(c.boxes, R(-27, 0.3, 52.0, -15, 3.2, 54.5, 'bus')); push(c.deco, R(-26.8, 1.7, 51.95, -15.6, 2.5, 52.0, 'car_glass')); push(c.deco, R(-26.8, 1.7, 54.5, -15.6, 2.5, 54.55, 'car_glass'));
  for (const x of [-25.5, -17]) for (const z of [51.8, 54.7]) push(c.deco, B(x, z, 1.0, 0.3, 1.0, 'tire'));
  wallSign(c, -14, 70.9, 0, 6.6, 8, 1.0, 'neon_cyan', 'trim');
  fence(c, -37, 55.6, 37, 55.6, 'metal_grate', 1.8, [-30, -12, 0, 18, 28]);
  // ---- church + gas station (east column middle blocks)
  building(c, { x: 70, z: 25, w: 13, d: 20, floors: 1, fh: 6, m: 'stone', roof: false, floorM: 'floor_wood', doors: { w: [{ c: 0, w: 2.4, h: 3.4 }], e: [4] }, winY: [2, 5], winGap: 3.5 });
  gableRoof(c, 63.5, 15, 76.5, 35, 6, 'roof_slate', false);
  building(c, { x: 59.5, z: 11.5, w: 6, d: 6, floors: 3, m: 'stone', floorM: 'floor_wood', doors: { w: [0] } });
  for (let k = 0; k < 5; k++) push(c.boxes, B(59.5, 11.5, 2.8 - k * 0.55, 2.8 - k * 0.55, 1.0, 'roof_slate', 10.55 + k));
  for (let x = 54; x <= 86; x += 4) push(c.deco, B(x, 9.5, 0.6, 0.6, 0.8, 'stone')); // cemetery stones
  for (const [x, z] of [[56, 36], [56, 42]]) tree(c, x, z);
  // gas station
  push(c.deco, R(52, 0, -42, 86, 0.04, -9, 'concrete_floor'));
  for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 4], [6, 4]]) push(c.boxes, B(68 + dx, -26 + dz, 0.5, 0.5, 4.6, 'metal'));
  push(c.boxes, R(60, 4.6, -34, 76, 5.0, -20, 'metal_roof')); push(c.deco, R(59.95, 4.7, -34.05, 76.05, 4.95, -19.95, 'awning_red'));
  for (const dx of [-3, 3]) { push(c.boxes, B(68 + dx, -27, 0.9, 1.3, 1.7, 'pump')); push(c.deco, B(68 + dx, -27, 0.95, 1.35, 0.15, 'trim', 1.7)); }
  building(c, { x: 68, z: -14, w: 14, d: 7, floors: 1, m: 'plaster_white', floorM: 'floor_tile', doors: { s: [-2], w: [0] }, winY: [0.8, 2.4] });
  wallSign(c, 68, -17.5, 0, 2.8, 6, 0.8, 'neon_orange', 'trim');
  car(c, 65, -30, 0, 'car_blue'); dumpster(c, 82, -12, 1);
  billboard(c, 82, -40, 3, 4.5, 8, 3.5);
  // ---- loose cover across the streets
  for (const [x, z] of [[-30, -3], [10, 3], [30, -53], [-20, 47], [60, 2], [-62, -47]]) car(c, x, z, 1, ['car_red', 'car_blue'][Math.floor(rnd() * 2)]);
  for (const x of [-60, 20]) busStop(c, x, -42.6, 2);
  return c;
}

// ====================================================================================== CANYON TOWN
function adobe(c, x, z, w, d, floors, doors, m = 'mudbrick', extra = {}) {
  building(c, { x, z, w, d, floors, m, roofM: 'mudroof', floorM: 'rug', doors, winGap: 3.0, ...extra });
  // wooden roof beams poking out of the walls (vigas)
  const top = floors * FH;
  for (let k = -w / 2 + 1; k < w / 2; k += 1.5) for (const s of [-1, 1]) push(c.deco, B(x + k, z + s * (d / 2 + 0.25), 0.18, 0.5, 0.18, 'wood', top - 0.6));
}
function cactus(c, x, z, h = 2.6) {
  push(c.boxes, B(x, z, 0.45, 0.45, h, 'hedge'));
  push(c.deco, B(x + 0.45, z, 0.5, 0.3, 0.3, 'hedge', h * 0.45)); push(c.deco, B(x + 0.6, z, 0.3, 0.3, 0.9, 'hedge', h * 0.45));
  push(c.deco, B(x - 0.4, z, 0.4, 0.3, 0.3, 'hedge', h * 0.6)); push(c.deco, B(x - 0.5, z, 0.3, 0.3, 0.7, 'hedge', h * 0.6));
}
function wagon(c, x, z, rot) {
  placeRot(c, x, z, rot, (t) => {
    push(t.boxes, R(-0.9, 0.6, -2, 0.9, 1.4, 2, 'wood')); for (const sz of [-1.4, 1.4]) for (const sx of [-1.0, 1.0]) push(t.deco, B(sx, sz, 0.12, 1.1, 1.1, 'wood'));
    for (const sz of [-1.6, 0, 1.6]) push(t.deco, R(-0.95, 1.4, sz - 0.06, 0.95, 2.6, sz + 0.06, 'wood')); push(t.deco, R(-1.0, 2.5, -1.8, 1.0, 2.7, 1.8, 'tent'));
  });
}
function boulders(c, x, z, rnd) { push(c.boxes, B(x, z, 1.6 + rnd(), 1.4 + rnd(), 1.0 + rnd() * 0.8, 'rock')); push(c.boxes, B(x + 1.1, z + 0.6, 1.0, 1.0, 0.7, 'rock')); }
export function canyonTown() {
  const c = newCtx(), rnd = mulberry(77117);
  // perimeter cliffs (leave the corners open for flanks)
  cliff(c, -92, 84, 92, 92, 16, rnd); cliff(c, -92, -92, 92, -84, 16, rnd);
  cliff(c, -92, -84, -84, 84, 16, rnd); cliff(c, 84, -84, 92, 84, 16, rnd);
  // dirt roads
  road(c, -84, -5, 84, 5, 'dirt'); road(c, -4, -84, 4, 84, 'dirt');
  // ---- town centre: main street of adobe buildings
  adobe(c, -16, -12, 10, 8, 2, { n: [2.5], e: [0] }, 'mudbrick', { parapetGaps: [{ side: 'n', c: 0, w: 2.2 }] });
  adobe(c, -29, -12, 9, 8, 1, { n: [1] }, 'sandstone');
  adobe(c, 14, -12, 12, 8, 2, { n: [-3, 3] }, 'mudbrick', { parapetGaps: [{ side: 'n', c: 0, w: 2.2 }] });
  adobe(c, 29, -12, 9, 8, 1, { n: [0], w: [0] }, 'sandstone');
  adobe(c, -16, 12, 10, 8, 2, { s: [2.5] }, 'sandstone', { parapetGaps: [{ side: 's', c: 0, w: 2.2 }] });
  adobe(c, -29, 12, 9, 8, 2, { s: [0], e: [0] });
  adobe(c, 16, 12, 14, 9, 2, { s: [-4.5, 3], w: [0] }, 'mudbrick', { parapetGaps: [{ side: 's', c: -2, w: 2.2 }] }); // saloon
  for (let x = 9.5; x <= 22.5; x += 2.6) push(c.deco, B(x, 7.15, 0.18, 0.18, FH, 'wood'));
  push(c.boxes, R(9, FH - 0.2, 6.4, 23, FH, 7.5, 'wood')); railing(c, 9, 6.45, 23, 6.45, FH, 1.0, 'wood'); // balcony
  wallSign(c, 16, 7.45, 0, FH + 1.3, 6, 0.9, 'wood', 'wood');
  adobe(c, 30, 12, 8, 8, 1, { s: [0] });
  plankBridge(c, -16, -8.3, -16, 8.3, 2 * FH, 2); // roof bridges across the street
  plankBridge(c, 14, -8.3, 14, 7.8, 2 * FH, 2);
  waterTower(c, 36, -2, 0); stall(c, -6, -8, 0, 'awning_red'); stall(c, 6, 8, 0, 'awning_green');
  for (const [x, z] of [[-8, 8.5], [24, -7.5], [-36, 6.5]]) { barrel(c, x, z, 'barrel_red'); crate(c, x + 1, z); }
  for (let x = -34; x <= 34; x += 8) { push(c.deco, B(x, -6.2, 0.15, 0.15, 1.0, 'wood')); push(c.deco, B(x, 6.2, 0.15, 0.15, 1.0, 'wood')); }
  wagon(c, -2, -2.2, 1); wagon(c, 40, 2, 0);
  for (const [dx, dz, w, d] of [[0, -1.2, 2.8, 0.4], [0, 1.2, 2.8, 0.4], [-1.2, 0, 0.4, 2], [1.2, 0, 0.4, 2]]) push(c.boxes, B(-40 + dx, dz, w, d, 0.9, 'stone')); // well
  for (const [x, z] of [[-41.2, -1.2], [-38.8, 1.2]]) push(c.deco, B(x, z, 0.2, 0.2, 2.4, 'wood')); push(c.deco, B(-40, 0, 3, 3, 0.2, 'mudroof', 2.4));
  // ---- domed hall (north of town)
  building(c, { x: 0, z: 34, w: 18, d: 18, floors: 1, fh: 6.4, m: 'plaster_white', roof: false, roofM: 'mudroof', floorM: 'tiles', doors: { s: [{ c: 0, w: 3, h: 4 }], e: [0], w: [0] }, winY: [3.2, 5.2], winGap: 3 });
  stepDome(c, 0, 34, 7.5, 6.8, 'plaster_white', 'neon_orange');
  for (const [dx, dz] of [[-8.6, -8.6], [8.6, -8.6], [-8.6, 8.6], [8.6, 8.6]]) { push(c.boxes, B(dx, 34 + dz, 2.2, 2.2, 9, 'sandstone')); push(c.deco, B(dx, 34 + dz, 2.6, 2.6, 0.4, 'trim', 9)); stepDome(c, dx, 34 + dz, 1.1, 9.4, 'plaster_white', 'metal'); }
  for (const [dx, dz] of [[-4, 30], [4, 30], [-4, 38], [4, 38]]) push(c.boxes, B(dx, dz, 0.8, 0.8, 6.4, 'stone'));
  push(c.boxes, B(0, 41, 8, 3, 0.45, 'stone'));
  // ---- fort (south-west)
  const FX = -54, FZ = -48, FW = 40, FD = 32, WH = 4.5, WT2 = 1.4;
  const fx0 = FX - FW / 2, fx1 = FX + FW / 2, fz0 = FZ - FD / 2, fz1 = FZ + FD / 2;
  const TW = 6.4; // corner towers
  for (const [x0, z0, x1, z1] of [[fx0 + TW, fz0, fx1 - TW, fz0 + WT2], [fx0 + TW, fz1 - WT2, fx1 - TW, fz1], [fx0, fz0 + TW, fx0 + WT2, fz1 - TW], [fx1 - WT2, fz0 + TW, fx1, FZ - 2.5], [fx1 - WT2, FZ + 2.5, fx1, fz1 - TW]])
    push(c.boxes, R(x0, 0, z0, x1, WH, z1, 'mudbrick'));
  push(c.boxes, R(fx1 - WT2, 3.6, FZ - 2.5, fx1, WH, FZ + 2.5, 'wood')); // gate lintel
  for (let x = fx0 + TW; x < fx1 - TW - 0.7; x += 1.6) { push(c.boxes, R(x, WH, fz0, x + 0.8, WH + 0.8, fz0 + 0.4, 'mudbrick')); push(c.boxes, R(x, WH, fz1 - 0.4, x + 0.8, WH + 0.8, fz1, 'mudbrick')); }
  for (let z = fz0 + TW; z < fz1 - TW - 0.7; z += 1.6) { push(c.boxes, R(fx0, WH, z, fx0 + 0.4, WH + 0.8, z + 0.8, 'mudbrick')); if (Math.abs(z + 0.4 - FZ) > 3) push(c.boxes, R(fx1 - 0.4, WH, z, fx1, WH + 0.8, z + 0.8, 'mudbrick')); }
  for (const [x, z, dr, off] of [[fx0 + 3.2, fz0 + 3.2, 'e', -0.95], [fx1 - 3.2, fz0 + 3.2, 'w', -0.95], [fx0 + 3.2, fz1 - 3.2, 's', 0], [fx1 - 3.2, fz1 - 3.2, 's', 0]]) building(c, { x, z, w: TW, d: TW, floors: 2, fh: 3.6, m: 'mudbrick', roofM: 'mudroof', floorM: 'rug', doors: { [dr]: [off] }, windows: false });
  stairFlight(c, fx0 + 8, fz0 + WT2 + 1, 1, 0, 1.4, 11, WH / 11, 'wood', 0, 0.55); push(c.boxes, R(fx0 + 14, WH - 0.2, fz0 + WT2, fx0 + 16, WH, fz0 + WT2 + 1.8, 'wood'));
  stairFlight(c, fx1 - 8, fz1 - WT2 - 1, -1, 0, 1.4, 11, WH / 11, 'wood', 0, 0.55); push(c.boxes, R(fx1 - 16, WH - 0.2, fz1 - WT2 - 1.8, fx1 - 14, WH, fz1 - WT2, 'wood'));
  adobe(c, FX - 4, FZ + 7, 14, 7, 1, { s: [-3, 3] }); adobe(c, FX + 8, FZ - 8, 8, 7, 1, { n: [0] }, 'sandstone');
  push(c.deco, B(FX + 4, FZ + 2, 0.18, 0.18, 9, 'wood')); push(c.deco, R(FX + 4.1, 7.6, FZ + 1.95, FX + 6.6, 9, FZ + 2.05, 'flag'));
  for (const [x, z] of [[FX - 10, FZ - 6], [FX + 2, FZ - 10], [FX + 12, FZ + 8]]) { crate(c, x, z, 1.3); crate(c, x + 1.4, z + 0.2); barrel(c, x, z + 1.5); }
  sandbags(c, fx1 + 4, FZ - 5, 0.9, 4); sandbags(c, fx1 + 4, FZ + 5, 0.9, 4);
  // ---- mine (south-east): two-tier mesa with a tunnel through the lower tier
  const MX0 = 34, MX1 = 70, MZ = -52;
  push(c.boxes, R(MX0, 0, MZ - 14, MX1, 7, MZ - 2.2, 'rock')); push(c.boxes, R(MX0, 0, MZ + 2.2, MX1, 7, MZ + 12, 'rock'));
  push(c.boxes, R(MX0, 3.8, MZ - 2.2, MX1, 7, MZ + 2.2, 'rock'));
  push(c.boxes, R(MX0 + 4, 7, MZ - 10, MX1 - 5, 13, MZ + 8, 'rock')); push(c.deco, R(MX0 - 0.06, 6.7, MZ - 14.06, MX1 + 0.06, 7.0, MZ + 12.06, 'rock_dark'));
  push(c.boxes, R(50, 0, MZ - 2.2, 56, 3.8, MZ - 2.0, 'rock')); // keep a solid wall segment in the tunnel side
  push(c.deco, R(MX0, 0.02, MZ - 2.2, MX1, 0.05, MZ + 2.2, 'dirt'));
  for (let x = MX0 + 1; x < MX1; x += 3) { for (const s of [-1.95, 1.95]) push(c.deco, B(x, MZ + s, 0.3, 0.3, 3.8, 'wood')); push(c.deco, B(x, MZ, 0.3, 4.2, 0.3, 'wood', 3.5)); }
  for (let x = MX0 + 2.5; x < MX1; x += 6) push(c.deco, B(x, MZ, 0.3, 0.3, 0.25, 'lamp', 3.25));
  rails(c, MX0 - 8, MZ, MX1 + 6); mineCart(c, 44, MZ, 1); mineCart(c, MX1 + 3, MZ, 1);
  for (const x of [MX0, MX1]) { push(c.deco, R(x - 0.3, 0, MZ - 2.6, x + 0.3, 4.4, MZ - 2.0, 'wood')); push(c.deco, R(x - 0.3, 0, MZ + 2.0, x + 0.3, 4.4, MZ + 2.6, 'wood')); push(c.deco, R(x - 0.35, 3.8, MZ - 2.6, x + 0.35, 4.5, MZ + 2.6, 'wood')); }
  stairRun(c, 40, MZ + 12 + 7.15, 0, -1, 2.4, 13, 7 / 13, 'rock', 0, 0.55); // rock stairs up to the lower tier
  for (const [x, z] of [[MX0 - 6, MZ - 6], [MX1 + 5, MZ + 8]]) { push(c.deco, B(x, z, 0.3, 0.3, 9, 'wood')); push(c.deco, B(x + 2, z, 0.3, 0.3, 9, 'wood')); push(c.deco, R(x - 0.2, 8.6, z - 0.2, x + 2.2, 9.1, z + 0.2, 'wood')); push(c.deco, B(x + 1, z, 1.2, 0.3, 1.2, 'metal_dark', 8.2)); }
  // ---- oasis (north-east)
  for (const [x, z, w, d] of [[56, 50, 16, 10], [50, 56, 8, 8], [63, 44, 7, 6]]) push(c.deco, B(x, z, w, d, 0.3, 'water'));
  for (const [x0, z0, x1, z1] of [[47.5, 44.5, 64.5, 45], [64, 40.5, 66.8, 41], [66.5, 41, 67, 47.5], [45.6, 51.6, 46.1, 60.6]]) push(c.boxes, R(x0, 0, z0, x1, 0.45, z1, 'stone'));
  for (const [x, z] of [[44, 46], [48, 62], [60, 58], [68, 52], [70, 40], [58, 38], [42, 54]]) palm(c, x, z);
  tent(c, 74, 60, 6, 4); tent(c, 36, 66, 5, 4, 'awning_red'); stall(c, 62, 66, 0, 'awning_green'); stall(c, 70, 30, 1, 'awning_red');
  // ---- mesas with a rope bridge (north-west)
  mesa(c, -54, 40, 14, 12, 8, rnd); mesa(c, -30, 58, 12, 12, 8, rnd);
  stairRun(c, -54, 40 - 6 - 6.6, 0, 1, 2.2, 11, 4.4 / 11, 'rock', 0, 0.6);
  stairRun(c, -30 + 6 + 6.6, 58, -1, 0, 2.2, 11, 4.4 / 11, 'rock', 0, 0.6);
  plankBridge(c, -48, 46, -36, 46, 4.4, 1.8); push(c.boxes, R(-36.2, 4.2, 45, -34.9, 4.4, 52.2, 'wood'));
  // ---- mission church with a bell tower, jail, stable + corral, market
  building(c, { x: 42, z: -18, w: 12, d: 16, floors: 1, fh: 5.5, m: 'plaster_white', roof: false, roofM: 'mudroof', floorM: 'tiles', doors: { w: [{ c: 0, w: 2.4, h: 3.4 }], n: [3] }, winY: [2.2, 4.4], winGap: 3.5 });
  for (let k = 0; k < 4; k++) push(c.deco, R(35.7, 5.5 + k * 0.7, -18 - 3.5 + k * 0.9, 36.1, 6.2 + k * 0.7, -18 + 3.5 - k * 0.9, 'plaster_white')); // stepped front gable
  push(c.deco, B(35.9, -18, 0.2, 0.2, 1.4, 'wood', 8.3)); push(c.deco, B(35.9, -18, 0.2, 0.9, 0.2, 'wood', 9.1));
  building(c, { x: 31.5, z: -30, w: 6, d: 6, floors: 3, m: 'plaster_white', roofM: 'mudroof', floorM: 'rug', doors: { s: [0] } });
  for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) push(c.deco, B(31.5 + dx, -30 + dz, 0.5, 0.5, 2.4, 'plaster_white', 10.55));
  push(c.deco, B(31.5, -30, 6.2, 6.2, 0.4, 'mudroof', 12.95)); push(c.deco, B(31.5, -30, 0.9, 0.9, 1.0, 'neon_orange', 11.8));
  adobe(c, -42, -18, 9, 7, 1, { n: [0] }, 'sandstone'); for (let x = -45.5; x <= -38.5; x += 0.7) push(c.deco, B(x, -21.6, 0.06, 0.06, 1.2, 'metal_dark', 1.0)); // jail with barred windows
  for (const [x0, z0, x1, z1] of [[-60, 20, -44, 20], [-60, 30, -50, 30], [-60, 20, -60, 30]]) fence(c, x0, z0, x1, z1, 'wood', 1.2);
  for (const [dx, dz] of [[-44, 21], [-44, 29], [-36, 21], [-36, 29]]) push(c.boxes, B(dx, dz, 0.25, 0.25, 3.2, 'wood'));
  push(c.deco, R(-44.4, 3.2, 20.4, -35.6, 3.45, 29.6, 'mudroof'));
  for (const [x, z] of [[-42, 23], [-39, 24], [-41, 27], [-55, 25]]) { push(c.boxes, B(x, z, 1.6, 1.0, 1.0, 'sand')); push(c.boxes, B(x + 0.3, z, 1.6, 1.0, 1.0, 'sand', 1.0)); }
  for (const [x, z, r, a] of [[16, 22, 0, 'awning_red'], [22, 22, 0, 'awning_green'], [28, 22, 0, 'awning_red'], [19, 28, 1, 'awning_green'], [25, 28, 1, 'awning_red']]) stall(c, x, z, r, a);
  adobe(c, -30, -30, 10, 8, 2, { s: [0], e: [0] }); adobe(c, 18, -30, 9, 8, 1, { n: [0] }, 'sandstone'); adobe(c, -30, 30, 9, 8, 1, { s: [0] }); adobe(c, 34, 26, 7, 7, 1, { w: [0] }, 'sandstone');
  // ---- rock ridges and hoodoos to break sightlines
  cliff(c, 14, 46, 32, 49.5, 7, rnd); cliff(c, -28, -82, -8, -78.5, 9, rnd); cliff(c, 62, -26, 65.5, -6, 8, rnd); cliff(c, -68, 2, -64.5, 22, 8, rnd);
  for (const [x, z, h] of [[-22, -42, 10], [22, -42, 11], [26, 62, 9], [-12, 64, 12], [-72, -24, 9], [74, -32, 10]]) {
    push(c.boxes, B(x, z, 2.6, 2.4, h * 0.6, 'rock')); push(c.boxes, B(x + 0.2, z - 0.1, 2.0, 1.9, h * 0.4, 'rock', h * 0.6));
    push(c.deco, B(x + 0.2, z, 3.2, 3.0, 0.9, 'rock_dark', h)); push(c.deco, B(x, z, 3.0, 2.8, 0.2, 'rock_dark', h * 0.55));
  }
  // ---- old railway trestle across the south (walkable, stairs at both ends)
  const TZ = -71, TY = 5;
  push(c.boxes, R(-30, TY - 0.25, TZ - 1.3, 30, TY, TZ + 1.3, 'wood'));
  for (let x = -30; x <= 30; x += 0.9) push(c.deco, B(x, TZ, 0.25, 2.5, 0.06, 'wood', TY));
  for (const s of [-0.72, 0.72]) push(c.deco, R(-30, TY + 0.06, TZ + s - 0.05, 30, TY + 0.16, TZ + s + 0.05, 'metal'));
  for (let x = -28; x <= 28; x += 4) { for (const s of [-1.1, 1.1]) push(c.boxes, B(x, TZ + s, 0.3, 0.3, TY - 0.25, 'wood')); push(c.deco, R(x - 0.1, 1.2, TZ - 1.2, x + 0.1, 1.45, TZ + 1.2, 'wood')); push(c.deco, R(x - 0.1, 3.2, TZ - 1.2, x + 0.1, 3.45, TZ + 1.2, 'wood')); }
  railing(c, -30, TZ - 1.3, 30, TZ - 1.3, TY, 1.0, 'wood'); railing(c, -30, TZ + 1.3, 30, TZ + 1.3, TY, 1.0, 'wood');
  stairFlight(c, 30 + 12 * 0.55, TZ, -1, 0, 2, 12, TY / 12, 'wood', 0, 0.55); stairFlight(c, -30 - 12 * 0.55, TZ, 1, 0, 2, 12, TY / 12, 'wood', 0, 0.55);
  mineCart(c, 8, TZ, 1, TY);
  // ---- scattered cover (skipped wherever something already stands)
  const free = (x, z, r) => !c.boxes.some(bb => x + r > bb.min[0] && x - r < bb.max[0] && z + r > bb.min[2] && z - r < bb.max[2]);
  for (let i = 0; i < 60; i++) { const x = -80 + rnd() * 160, z = -80 + rnd() * 160, k = rnd(); if (Math.abs(z) < 6 || Math.abs(x) < 5 || !free(x, z, 3)) continue; (k < 0.5 ? cactus : (cc, xx, zz) => boulders(cc, xx, zz, rnd))(c, x, z); }
  for (const [x, z, r] of [[-14, -36, 0], [8, 18, 1], [70, -4, 0], [-74, 30, 1]]) if (free(x, z, 2.5)) wagon(c, x, z, r);
  jumpPad(c, -78, -12); jumpPad(c, 78, 12);
  return c;
}
