// Shared movement + collision code (used by both the browser client and the server bots).

export const PLAYER = {
  radius: 0.35,
  height: 1.75,
  crouchHeight: 1.15,
  eye: 1.6,
  crouchEye: 1.05,
  stepUp: 0.55,
  gravity: 22,
  jump: 7.8,
};

export const JUMP_PAD = 18.5; // launch speed (~7.8m high)

function overlaps(px, py, pz, r, h, b) {
  return px + r > b.min[0] && px - r < b.max[0] &&
         pz + r > b.min[2] && pz - r < b.max[2] &&
         py + h > b.min[1] + 1e-4 && py < b.max[1] - 1e-4; // small tolerance: standing exactly on a top is not "inside"
}

function blockedAt(x, y, z, r, h, boxes) {
  for (const b of boxes) if (overlaps(x, y, z, r, h, b)) return true;
  return false;
}

// body: { pos:[x,y,z], vel:[x,y,z], onGround:bool, height:number }
export function moveBody(body, dt, boxes) {
  const r = PLAYER.radius;
  const h = body.height || PLAYER.height;
  const p = body.pos, v = body.vel;
  const wasGround = body.onGround;
  body.blocked = false;
  body.padded = false;

  for (const axis of [0, 2]) {
    const d = v[axis] * dt;
    if (d === 0) continue;
    p[axis] += d;
    for (const b of boxes) {
      if (!overlaps(p[0], p[1], p[2], r, h, b)) continue;
      const stepH = b.max[1] - p[1];
      if (wasGround && stepH > 0 && stepH <= PLAYER.stepUp &&
          !blockedAt(p[0], b.max[1] + 0.01, p[2], r, h - 0.02, boxes)) {
        p[1] = b.max[1];
        continue;
      }
      p[axis] = d > 0 ? b.min[axis] - r - 0.001 : b.max[axis] + r + 0.001;
      body.blocked = true;
    }
  }

  v[1] -= PLAYER.gravity * dt;
  if (v[1] < -40) v[1] = -40;
  const prevY = p[1];
  p[1] += v[1] * dt;
  body.onGround = false;
  for (const b of boxes) {
    if (!overlaps(p[0], p[1], p[2], r, h, b)) continue;
    if (v[1] <= 0 && prevY >= b.max[1] - 0.06) {
      p[1] = b.max[1]; v[1] = 0; body.onGround = true;
      if (b.m === 'jumppad') { v[1] = JUMP_PAD; body.onGround = false; body.padded = true; }
    } else if (v[1] > 0) {
      p[1] = b.min[1] - h - 0.001; v[1] = 0;
    }
  }
  if (p[1] <= 0) { p[1] = 0; v[1] = 0; body.onGround = true; }
}

export function canStand(body, boxes) {
  return !blockedAt(body.pos[0], body.pos[1] + 0.01, body.pos[2], PLAYER.radius, PLAYER.height - 0.02, boxes);
}

// Ray vs. axis-aligned boxes (+ floor plane at y=0). Returns {t, point, normal} or null.
export function raycastBoxes(o, d, maxT, boxes) {
  let best = maxT, nAxis = -1, nSign = 0;
  for (const b of boxes) {
    let tmin = 0, tmax = best, ax = -1, sg = 0, ok = true;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < b.min[i] || o[i] > b.max[i]) { ok = false; break; }
        continue;
      }
      const inv = 1 / d[i];
      let t1 = (b.min[i] - o[i]) * inv, t2 = (b.max[i] - o[i]) * inv, s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tmin) { tmin = t1; ax = i; sg = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) { ok = false; break; }
    }
    if (ok && ax >= 0 && tmin < best) { best = tmin; nAxis = ax; nSign = sg; }
  }
  if (d[1] < -1e-9) {
    const t = -o[1] / d[1];
    if (t >= 0 && t < best) { best = t; nAxis = 1; nSign = 1; }
  }
  if (nAxis < 0) return null;
  const normal = [0, 0, 0]; normal[nAxis] = nSign;
  return { t: best, point: [o[0] + d[0] * best, o[1] + d[1] * best, o[2] + d[2] * best], normal };
}
