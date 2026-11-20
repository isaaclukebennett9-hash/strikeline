// The original versions of a few maps, kept as "Classic" maps.
import { R, B, push, newCtx, rotBox, addRot, FH, WT, SLAB, wallRun, slab, band, building, stairRun, car, tree, palm, stall, barrel, crate, sandbags, bench, lamp, container, fountain, dumpster, barrier, mulberry, jumpPad, tank, armyTruck, watchtower } from './mapkit.js';

export function townClassic() {
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

export function harborClassic() {
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

export function killhouseClassic() {
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
