// Player progression.
//  • Player level (XP)  → unlocks weapons and throwables. Slow curve, max level 55.
//  • Weapon level (kills with that gun) → unlocks that gun's attachments (Gunsmith), up to weapon level 20.
//    Attachments can also be bought early with credits, even before the gun itself is unlocked.
//  • Credits → cosmetics only (weapon finishes, operators) and challenge swaps.
import { WEAPONS } from '/shared/weapons.js';

const KEY = 'strikeline_profile';
const DEFAULT = () => ({
  xp: 0, credits: 0, owned: [], att: {}, wkills: {},
  stats: { kills: 0, deaths: 0, wins: 0, matches: 0, headshots: 0, bestStreak: 0 },
  challenges: [], done: 0, v2: true,
});
// In the desktop app, saves live in the app (so they survive joining different hosts); otherwise in this browser.
const desk = window.strikelineStore;
export const store = {
  get: (k) => { try { return desk ? desk.get(k) ?? localStorage.getItem(k) : localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (desk) desk.set(k, v); else localStorage.setItem(k, v); } catch {} },
};
// ---------------------------------------------------------------- sealed save
// The profile is saved scrambled and signed (HMAC-SHA256), so opening the save file and changing numbers
// doesn't work: an edited save fails the check and is reset. The game runs on the player's own PC, so this
// stops casual editing, not someone who rewrites the game's code.
const SEAL_KEY = 'sl-7Qe!vR2#kzP9-strikeline-profile-seal-4bW0xN';
const SEALED_MARK = 'strikeline_sealed';
const K256 = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256(bytes) {
  const len = bytes.length, padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes); padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, len * 8 >>> 0); dv.setUint32(padded.length - 8, Math.floor(len / 0x20000000));
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]), W = new Uint32Array(64);
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = ror(W[i-15], 7) ^ ror(W[i-15], 18) ^ (W[i-15] >>> 3), s1 = ror(W[i-2], 17) ^ ror(W[i-2], 19) ^ (W[i-2] >>> 10);
      W[i] = W[i-16] + s0 + W[i-7] + s1;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + W[i] >>> 0;
      const t2 = (ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      h = g; g = f; f = e; e = d + t1 >>> 0; d = c; c = b; b = a; a = t1 + t2 >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32), odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i]);
  return out;
}
const enc = new TextEncoder(), dec = new TextDecoder();
const cat = (...arrs) => { const r = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0)); let o = 0; for (const a of arrs) { r.set(a, o); o += a.length; } return r; };
function hmac(msg) {
  let k = enc.encode(SEAL_KEY); if (k.length > 64) k = sha256(k);
  const ik = new Uint8Array(64), ok = new Uint8Array(64);
  for (let i = 0; i < 64; i++) { ik[i] = (k[i] || 0) ^ 0x36; ok[i] = (k[i] || 0) ^ 0x5c; }
  return sha256(cat(ok, sha256(cat(ik, msg))));
}
function keystream(nonce, n) {
  const out = new Uint8Array(n), base = enc.encode(SEAL_KEY);
  for (let i = 0, blk = 0; i < n; blk++) { const b = sha256(cat(base, nonce, enc.encode(':' + blk))); for (let j = 0; j < 32 && i < n; j++) out[i++] = b[j]; }
  return out;
}
const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = u => Array.from(u, b => b.toString(16).padStart(2, '0')).join('');
function seal(obj) {
  const data = enc.encode(JSON.stringify(obj)), nonce = new Uint8Array(12);
  crypto.getRandomValues(nonce);
  const ks = keystream(nonce, data.length);
  for (let i = 0; i < data.length; i++) data[i] ^= ks[i];
  const body = cat(nonce, data);
  return 'SL1.' + b64(body) + '.' + hex(hmac(body));
}
function unseal(s) {
  try {
    const [tag, b, mac] = s.split('.');
    if (tag !== 'SL1' || !b || !mac) return null;
    const body = unb64(b);
    if (body.length < 13 || hex(hmac(body)) !== mac) return null;
    const nonce = body.subarray(0, 12), data = body.slice(12), ks = keystream(nonce, data.length);
    for (let i = 0; i < data.length; i++) data[i] ^= ks[i];
    const obj = JSON.parse(dec.decode(data));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
  } catch { return null; }
}
const wasSealed = () => { try { return store.get(SEALED_MARK) === '1' || localStorage.getItem(SEALED_MARK) === '1'; } catch { return false; } };

export let profile = DEFAULT();
let migrate = false;
export let saveTampered = false; // the save had been edited outside the game, so progress was reset
{
  const rawStr = store.get(KEY);
  let raw = null;
  if (rawStr && rawStr.startsWith('SL1.')) raw = unseal(rawStr);
  else if (rawStr && !wasSealed()) { try { raw = JSON.parse(rawStr); } catch {} } // older plain saves: taken once, then sealed
  if (rawStr && !raw && rawStr !== '{}') { saveTampered = true; store.set(KEY + '_rejected', rawStr); }
  if (raw) { migrate = Object.keys(raw).length > 0 && !raw.v2; profile = Object.assign(DEFAULT(), raw); }
}
export const saveProfile = () => {
  store.set(KEY, seal(profile));
  store.set(SEALED_MARK, '1');
  try { localStorage.setItem(SEALED_MARK, '1'); } catch {}
};
saveProfile(); // seal existing plain saves straight away

// Old saves: refund credits spent on the removed weapon upgrades and on buying weapons early (weapons now unlock by level).
export let migrationRefund = 0;
if (migrate) {
  const UPG_COST = { mag: [250, 500, 900], reload: [250, 500, 900], recoil: [300, 600, 1000], barrel: [300, 600, 1000], grip: [200, 400, 800] };
  const OLD_PRICE = { breacher: 800, stinger: 900, kestrel: 1100, tri: 1400, hawk: 1600, scorpion: 2400, magnum: 1200, marksman: 1800, hammer: 2200, longbow: 2800, thumper: 3500 };
  for (const tiers of Object.values(profile.upgrades || {})) for (const [k, t] of Object.entries(tiers)) for (let i = 0; i < t; i++) migrationRefund += UPG_COST[k]?.[i] || 0;
  for (const k of profile.owned) migrationRefund += OLD_PRICE[k] || 0;
  profile.owned = profile.owned.filter(k => k.startsWith('ws:') || k.startsWith('op:') || k.startsWith('at:'));
  delete profile.upgrades;
  profile.credits += migrationRefund;
  profile.att = profile.att || {};
  profile.v2 = true;
  saveProfile();
}

// ---------------------------------------------------------------- player level
export const MAX_LEVEL = 55;
export const xpForLevel = lvl => 800 * (lvl - 1) + 160 * (lvl - 1) * (lvl - 1); // total XP needed to reach `lvl`
export function levelInfo(xp = profile.xp) {
  let lvl = 1;
  while (lvl < MAX_LEVEL && xp >= xpForLevel(lvl + 1)) lvl++;
  const cur = xpForLevel(lvl), next = xpForLevel(lvl + 1);
  return { level: lvl, into: xp - cur, need: next - cur, pct: lvl >= MAX_LEVEL ? 1 : (xp - cur) / (next - cur) };
}

// ---------------------------------------------------------------- unlocks
// Weapons & throwables: by player level only. Cosmetics: bought with credits (some also need a level).
const WEAPON_LEVELS = {
  falcon: 1, vector: 1, viper: 1, knife: 1, frag: 1, smoke: 1,
  mp5: 2, flash: 2, breacher: 3, stinger: 3, ak47: 4, semtex: 4, kestrel: 5, tri: 6, magnum: 6,
  ppsh: 7, stun: 7, g36c: 8, marksman: 9, tknife: 9, ksg: 10, hawk: 11, galil: 11, hammer: 12,
  tommy: 13, molotov: 13, famas: 14, scorpion: 15, longbow: 16, aug: 17, sawedoff: 18, bizon: 19,
  thumper: 20, scarh: 21, dbarrel: 22, m249: 23, ak12: 24, kar98: 25, skorpion: 26, tcsg: 27,
  asval: 28, fal: 30, pkm: 32, r4c: 34, dartshotgun: 36, flamer: 38, dartsniper: 40, spas12: 17, benelli: 31,
  m1911: 5, mp40: 6, sten: 9, luger: 10, stg44: 12, trench: 14, garand: 16, bar: 20, enfield: 24, mg42: 29, mp18: 33, lewis: 37,
  foampistol: 2, ballblaster: 8, breakfoam: 13, foamlmg: 19, megabolt: 26, arcpistol: 15, photon: 21, lance: 35,
};
export const UNLOCKS = {
  ...Object.fromEntries(Object.entries(WEAPON_LEVELS).map(([k, l]) => [k, { level: l }])),
  // weapon finishes
  'ws:factory': { price: 0 }, 'ws:woodland': { price: 0 }, 'ws:desert': { price: 0 }, 'ws:arctic': { price: 1500 }, 'ws:crimson': { price: 2500 },
  'ws:urban': { price: 2000, level: 3 }, 'ws:jungle': { price: 3000, level: 7 }, 'ws:hex': { price: 6000, level: 12 }, 'ws:cobalt': { price: 8000, level: 18 },
  'ws:carbon': { price: 3500, level: 5 }, 'ws:tiger': { price: 5000, level: 10 }, 'ws:neon': { price: 7000, level: 15 },
  'ws:galaxy': { price: 10000, level: 22 }, 'ws:inferno': { price: 14000, level: 30 }, 'ws:gold': { price: 25000, level: 40 },
  'ws:dragon': { price: 6000, level: 8 }, 'ws:aurora': { price: 12000, level: 16 }, 'ws:gift': { price: 0 }, // gift bundle (1.6.16)
  // Christmas Update camos (Candy Cane is free)
  'ws:xcandy': { price: 0 }, 'ws:xsweater': { price: 2500 }, 'ws:xwrap': { price: 2000 }, 'ws:xginger': { price: 3000 },
  'ws:xfrost': { price: 5000 }, 'ws:xkrampus': { price: 6000 }, 'ws:xnut': { price: 4000 }, 'ws:xlights': { price: 8000 },
  // operators
  'op:ranger': { price: 0 }, 'op:desert': { price: 0 }, 'op:cobalt': { price: 2000 }, 'op:crimson': { price: 3000 },
  'op:ghost': { price: 4500, level: 8 }, 'op:toxic': { price: 6000, level: 14 }, 'op:shadow': { price: 9000, level: 20 }, 'op:royal': { price: 14000, level: 28 },
  'op:dragonheart': { price: 0 },
  // developer skins: unlocked on this PC with the dev code (Skins screen)
  'ws:dev': { dev: true }, 'ws:glitch': { dev: true }, 'op:dev': { dev: true }, 'op:devgold': { dev: true },
};
// Only the SHA-256 of the code lives here; the PC keeps the code itself, so the unlock can't be faked by copying a value from this file.
const DEV_KEY = 'strikeline_devcode', DEV_SHA = '592825ecebd9678f878dfce975fbb0509465067ff1f8966038b7b36d7cf067e6';
const shaHex = str => [...sha256(enc.encode(str))].map(v => v.toString(16).padStart(2, "0")).join("");
const normCode = code => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const checkCode = code => { const c = normCode(code); return c.length >= 12 && shaHex(c) === DEV_SHA; };
// Kept in the app's own save (like the profile), so it survives the game opening on a new address — a different
// local port or a friend's tunnel link each have their own empty browser storage. Browser storage is the fallback.
let devCache = null;
const readDevCode = () => { try { return store.get(DEV_KEY) || localStorage.getItem(DEV_KEY) || ''; } catch { return ''; } };
export const isDev = () => {
  if (devCache === null) {
    const c = readDevCode();
    devCache = checkCode(c);
    if (devCache && desk) { try { if (desk.get(DEV_KEY) !== c) desk.set(DEV_KEY, c); } catch {} } // older saves: copy into the app save
  }
  return devCache;
};
export const devCode = () => (isDev() ? readDevCode() : '');
export function tryDevCode(code) {
  if (!checkCode(code)) return false;
  store.set(DEV_KEY, normCode(code));
  try { localStorage.setItem(DEV_KEY, normCode(code)); localStorage.removeItem('strikeline_dev'); } catch {}
  devCache = true;
  return true;
}
const isCosmetic = key => key.startsWith('ws:') || key.startsWith('op:');
export const isUnlocked = key => {
  const u = UNLOCKS[key];
  if (!u) return true;
  if (u.dev) return isDev();
  if (isCosmetic(key)) return !u.price || profile.owned.includes(key);
  return levelInfo().level >= u.level;
};
export const canBuy = key => { const u = UNLOCKS[key]; return !!u && !u.dev && isCosmetic(key) && !isUnlocked(key) && levelInfo().level >= (u.level || 1); };
export function buy(key) {
  const u = UNLOCKS[key];
  if (!canBuy(key) || profile.credits < u.price) return false;
  profile.credits -= u.price;
  profile.owned.push(key);
  saveProfile();
  return true;
}
export function newUnlocksAt(level) {
  return Object.entries(UNLOCKS).filter(([k, u]) => u.level === level && !isCosmetic(k)).map(([k]) => k);
}

// ---------------------------------------------------------------- weapon levels (kills with that gun)
export const MAX_WLEVEL = 20;
const killsForWLevel = l => Math.round(3 * (l - 1) + 0.45 * (l - 1) * (l - 1));
export function weaponLevelInfo(wid) {
  const k = profile.wkills[wid] || 0;
  let l = 1;
  while (l < MAX_WLEVEL && k >= killsForWLevel(l + 1)) l++;
  return { level: l, kills: k, next: l >= MAX_WLEVEL ? null : killsForWLevel(l + 1), cur: killsForWLevel(l) };
}
export const weaponLevel = wid => weaponLevelInfo(wid).level;

// ---------------------------------------------------------------- Gunsmith attachments
export const SLOT_NAMES = { optic: 'Optic', muzzle: 'Muzzle', barrel: 'Barrel', under: 'Underbarrel', mag: 'Magazine', ammo: 'Ammo Type', stock: 'Stock', grip: 'Rear Grip', perk: 'Proficiency' };
export const ATTACHMENTS = {
  optic: [
    { id: 'irons', name: 'Iron Sights', lvl: 1, pros: ['Clear, fast sight picture'] },
    { id: 'reddot', name: 'Reflex Sight', lvl: 2, pros: ['Precise dot reticle'] },
    { id: 'holo', name: 'Holographic', lvl: 5, pros: ['Large reticle, wide window'] },
    { id: 'acog', name: '2.5x Prism', lvl: 9, pros: ['2.5x magnification'], cons: ['Slower aim'] },
    { id: 'scope4', name: '4x Scope', lvl: 13, pros: ['4x magnification'], cons: ['Much slower aim'], classes: ['ar', 'dmr', 'sniper', 'lmg'] },
    { id: 'scope8', name: '8x Sniper Scope', lvl: 17, pros: ['8x magnification'], cons: ['Very slow aim'], classes: ['dmr', 'sniper'] },
  ],
  muzzle: [
    { id: 'flash', name: 'Flash Hider', lvl: 3, pros: ['-20% shot bloom'], m: { bloom: -0.2 } },
    { id: 'comp', name: 'Compensator', lvl: 7, pros: ['-15% recoil'], cons: ['+5% hip-fire spread'], m: { recoil: -0.15, spread: 0.05 } },
    { id: 'brake', name: 'Muzzle Brake', lvl: 11, pros: ['-10% recoil', '+10% range'], cons: ['-3% move speed'], m: { recoil: -0.1, range: 0.1, speed: -0.03 } },
    { id: 'suppressor', name: 'Suppressor', lvl: 15, pros: ['Quiet shots, no tracers'], cons: ['-15% range', 'Slower aim'], m: { suppressed: true, range: -0.15, ads: 0.08 } },
  ],
  barrel: [
    { id: 'short', name: 'Short Barrel', lvl: 4, pros: ['+15% aim speed', '+4% move speed'], cons: ['-20% range'], m: { ads: -0.15, speed: 0.04, range: -0.2 } },
    { id: 'long', name: 'Long Barrel', lvl: 10, pros: ['+25% range', '-10% recoil'], cons: ['+12% aim time'], m: { range: 0.25, recoil: -0.1, ads: 0.12 } },
  ],
  under: [
    { id: 'vgrip', name: 'Vertical Grip', lvl: 6, pros: ['-15% recoil'], cons: ['+5% aim time'], m: { recoil: -0.15, ads: 0.05 } },
    { id: 'laser', name: 'Tac Laser', lvl: 8, pros: ['-30% hip-fire spread'], m: { spread: -0.3 } },
    { id: 'agrip', name: 'Angled Grip', lvl: 12, pros: ['+15% aim speed'], m: { ads: -0.15 } },
    { id: 'bipod', name: 'Bipod', lvl: 18, pros: ['-30% recoil while crouched'], m: { crouchRecoil: -0.3 } },
  ],
  mag: [
    { id: 'ext', name: 'Extended Mag', lvl: 5, pros: ['+40% magazine size'], cons: ['+15% reload time'], m: { mag: 0.4, reload: 0.15 } },
    { id: 'fast', name: 'Fast Mag', lvl: 9, pros: ['-25% reload time'], m: { reload: -0.25 } },
    { id: 'big', name: 'High-Capacity', lvl: 16, pros: ['+100% magazine size'], cons: ['+30% reload time', '-5% move speed'], m: { mag: 1.0, reload: 0.3, speed: -0.05 } },
  ],
  ammo: [
    { id: 'fmj', name: 'FMJ Rounds', lvl: 7, pros: ['+20% range'], m: { range: 0.2 } },
    { id: 'hollow', name: 'Hollow Points', lvl: 14, pros: ['+12% damage up close'], cons: ['-15% range'], m: { dmgClose: 0.12, range: -0.15 } },
    { id: 'incendiary', name: 'Incendiary Rounds', lvl: 19, pros: ['Hits set enemies on fire'], cons: ['-10% damage'], m: { dmg: -0.1, incendiary: true } },
  ],
  stock: [
    { id: 'light', name: 'Lightweight Stock', lvl: 3, pros: ['+5% move speed', '+10% aim speed'], cons: ['+10% recoil'], m: { speed: 0.05, ads: -0.1, recoil: 0.1 } },
    { id: 'heavy', name: 'Heavy Stock', lvl: 11, pros: ['-15% recoil'], cons: ['-4% move speed'], m: { recoil: -0.15, speed: -0.04 } },
    { id: 'nostock', name: 'No Stock', lvl: 17, pros: ['+10% move speed', '+20% aim speed'], cons: ['+35% recoil'], m: { speed: 0.1, ads: -0.2, recoil: 0.35 } },
  ],
  grip: [
    { id: 'tape', name: 'Grip Tape', lvl: 2, pros: ['+8% aim speed'], m: { ads: -0.08 } },
    { id: 'stippled', name: 'Stippled Grip', lvl: 8, pros: ['-8% recoil'], m: { recoil: -0.08 } },
  ],
  perk: [
    { id: 'loaded', name: 'Fully Loaded', lvl: 4, pros: ['Spawn with +50% reserve ammo'], m: { reserve: 0.5 } },
    { id: 'quick', name: 'Quickdraw', lvl: 10, pros: ['+25% aim speed', 'Faster weapon swap'], cons: ['+10% recoil'], m: { ads: -0.25, recoil: 0.1, swap: true } },
    { id: 'steady', name: 'Steady Aim', lvl: 15, pros: ['-25% hip-fire spread', '-20% moving spread'], m: { spread: -0.25, moveSpread: -0.2 } },
    { id: 'sleight', name: 'Sleight of Hand', lvl: 20, pros: ['-30% reload time'], m: { reload: -0.3 } },
  ],
};
const NO_UNDER = new Set(['northstar', 'krampus', 'candycane', 'sten', 'mp18', 'mp40', 'lewis', 'trench', 'garand', 'enfield', 'mg42', 'bar', 'tommy', 'bizon', 'aug', 'ksg', 'kar98', 'pkm', 'tri', 'kestrel', 'longbow', 'breacher', 'spas12', 'hammer', 'dbarrel', 'sawedoff', 'magnum', 'viper', 'hawk', 'stinger']);
// Which Gunsmith slots a weapon has
export function slotsFor(wid) {
  const d = WEAPONS[wid];
  if (!d || d.melee || d.slot === 'grenade') return [];
  if (d.cls === 'special' || d.cls === 'energy' || d.cls === 'foam') return d.flame ? ['mag', 'perk'] : ['perk'];
  if (d.anim === 'break') return ['ammo', 'grip', 'perk'];
  if (d.cls === 'pistol') return ['muzzle', 'mag', 'ammo', 'grip', 'perk'];
  const s = ['optic', 'muzzle', 'barrel', 'under', 'mag', 'ammo', 'stock', 'grip', 'perk'];
  return s.filter(k => !(k === 'under' && NO_UNDER.has(wid)) && !(k === 'muzzle' && d.suppressed));
}
export function optionsFor(wid, slot) {
  const d = WEAPONS[wid];
  return (ATTACHMENTS[slot] || []).filter(a => !a.classes || a.classes.includes(d.cls));
}
export const getAtt = wid => profile.att[wid] || {};
// buying an attachment early (before reaching the weapon level, even before the gun unlocks)
const attKey = (wid, slot, id) => `at:${wid}:${slot}:${id}`;
export const attPrice = opt => 200 + opt.lvl * 150;
export const attOwned = (wid, slot, opt) => weaponLevel(wid) >= opt.lvl || profile.owned.includes(attKey(wid, slot, opt.id));
export function buyAtt(wid, slot, id) {
  const opt = optionsFor(wid, slot).find(o => o.id === id);
  if (!opt || attOwned(wid, slot, opt) || profile.credits < attPrice(opt)) return false;
  profile.credits -= attPrice(opt); profile.owned.push(attKey(wid, slot, id)); saveProfile();
  return true;
}
export function setAtt(wid, slot, id) {
  const a = { ...(profile.att[wid] || {}) };
  if (!id) delete a[slot];
  else {
    const opt = optionsFor(wid, slot).find(o => o.id === id);
    if (!opt || !attOwned(wid, slot, opt)) return false;
    a[slot] = id;
  }
  profile.att[wid] = a; saveProfile();
  return true;
}
const OPTIC_ZOOM = { acog: 2.3, scope4: 3.5, scope8: 6 }, OPTIC_ADS = { irons: 0, reddot: 0, holo: 0.01, toyscope: 0.02, acog: 0.03, scope4: 0.05, scope8: 0.09, none: 0 };
// Weapon definition with this player's attachments applied (client-side handling; the server caps damage).
export function attachedDef(wid, att = getAtt(wid)) {
  const base = WEAPONS[wid];
  if (!base || base.melee) return base;
  const d = { ...base, att: { ...att } };
  const sum = { recoil: 0, spread: 0, moveSpread: 0, ads: 0, speed: 0, mag: 0, reserve: 0, reload: 0, range: 0, dmg: 0, dmgClose: 0, bloom: 0, crouchRecoil: 0 };
  for (const [slot, id] of Object.entries(att)) {
    if (slot === 'optic' || !slotsFor(wid).includes(slot)) continue;
    const a = (ATTACHMENTS[slot] || []).find(x => x.id === id); if (!a?.m) continue;
    for (const [k, v] of Object.entries(a.m)) { if (typeof v === 'number') sum[k] += v; else d[k] = v; }
  }
  // optic: zoom + aim time
  const opt = slotsFor(wid).includes('optic') && att.optic ? att.optic : base.optic;
  d.optic = opt;
  const closeOptic = o => o === 'irons' || o === 'reddot' || o === 'holo';
  if (opt !== base.optic) {
    d.zoom = closeOptic(opt) ? (closeOptic(base.optic) ? base.zoom : 1.4) : (OPTIC_ZOOM[opt] || base.zoom);
    sum.ads += (OPTIC_ADS[opt] || 0) - (OPTIC_ADS[base.optic] || 0);
  }
  d.scope = opt === 'scope4' || opt === 'scope8';
  const k = (n) => Math.max(0.2, 1 + n);
  d.recoil = base.recoil * k(sum.recoil); d.spread = base.spread * k(sum.spread); d.moveSpread = base.moveSpread * k(sum.moveSpread);
  d.ads = Math.max(0.08, base.ads * (1 + sum.ads));
  d.speed = base.speed * (1 + sum.speed);
  if (base.anim !== 'break') d.mag = Math.max(1, Math.round(base.mag * (1 + sum.mag)));
  d.reserve = Math.round(base.reserve * (1 + sum.mag) * (1 + sum.reserve));
  d.reload = base.reload * k(sum.reload); if (base.shellTime) d.shellTime = base.shellTime * k(sum.reload);
  const r = k(sum.range); d.falloff = [base.falloff[0] * r, base.falloff[1] * r, base.falloff[2]]; d.range = base.range * Math.max(0.6, 1 + sum.range * 0.5);
  d.dmg = base.dmg * (1 + sum.dmg); d.dmgClose = sum.dmgClose; d.bloomMul = k(sum.bloom); d.crouchRecoil = k(sum.crouchRecoil);
  return d;
}
export const upgradedDef = (wid) => attachedDef(wid); // old name

// ---------------------------------------------------------------- challenges
const cls = (w) => WEAPONS[w]?.cls;
const POOL = [
  { id: 'kills', text: n => `Get ${n} kills`, goals: [15, 30, 50], ev: 'kill', reward: 400 },
  { id: 'hs', text: n => `Get ${n} headshot kills`, goals: [5, 10, 15], ev: 'kill', f: e => e.head, reward: 500 },
  { id: 'smg', text: n => `Get ${n} kills with SMGs`, goals: [10, 20], ev: 'kill', f: e => cls(e.w) === 'smg', reward: 450 },
  { id: 'ar', text: n => `Get ${n} kills with assault rifles`, goals: [10, 20], ev: 'kill', f: e => cls(e.w) === 'ar', reward: 450 },
  { id: 'pistol', text: n => `Get ${n} kills with secondaries`, goals: [4, 8], ev: 'kill', f: e => cls(e.w) === 'pistol', reward: 500 },
  { id: 'shotgun', text: n => `Get ${n} shotgun kills`, goals: [6, 12], ev: 'kill', f: e => cls(e.w) === 'shotgun', reward: 500, needs: ['breacher'] },
  { id: 'sniper', text: n => `Get ${n} kills with marksman or sniper rifles`, goals: [5, 10], ev: 'kill', f: e => cls(e.w) === 'sniper' || cls(e.w) === 'dmr', reward: 550, needs: ['marksman'] },
  { id: 'lmg', text: n => `Get ${n} kills with LMGs`, goals: [8, 15], ev: 'kill', f: e => cls(e.w) === 'lmg', reward: 550, needs: ['hammer'] },
  { id: 'special', text: n => `Get ${n} kills with special weapons`, goals: [3, 6], ev: 'kill', f: e => cls(e.w) === 'special', reward: 650, needs: ['thumper'] },
  { id: 'knife', text: n => `Get ${n} knife kills`, goals: [2, 4], ev: 'kill', f: e => e.w === 'knife', reward: 550 },
  { id: 'nade', text: n => `Get ${n} kills with lethal throwables`, goals: [2, 4], ev: 'kill', f: e => ['frag', 'semtex', 'molotov', 'tknife'].includes(e.w), reward: 550 },
  { id: 'tknife', text: n => `Get ${n} throwing knife kills`, goals: [1, 3], ev: 'kill', f: e => e.w === 'tknife', reward: 700, needs: ['tknife'] },
  { id: 'streak', text: n => `Get a ${n} kill streak`, goals: [3, 5, 7], ev: 'streak', reward: 600, max: true },
  { id: 'win', text: n => `Win ${n} match${n > 1 ? 'es' : ''}`, goals: [1, 2, 3], ev: 'win', reward: 600 },
  { id: 'play', text: n => `Finish ${n} matches`, goals: [2, 3, 5], ev: 'match', reward: 400 },
  { id: 'zone', text: n => `Hold the Hardpoint for ${n} seconds`, goals: [45, 90], ev: 'zone', reward: 500 },
  { id: 'tdm', text: n => `Get ${n} kills in Team Deathmatch`, goals: [15, 25], ev: 'kill', f: e => e.mode === 'tdm', reward: 450 },
  { id: 'gg', text: n => `Reach gun ${n} in Gun Game`, goals: [6, 10], ev: 'gg', reward: 550, max: true },
  { id: 'points', text: n => `Earn ${n} points`, goals: [4000, 8000], ev: 'xp', reward: 450 },
  { id: 'assist', text: n => `Get ${n} assists`, goals: [6, 12], ev: 'assist', reward: 400 },
  { id: 'slide', text: n => `Get ${n} kills while sliding`, goals: [3, 6], ev: 'kill', f: e => e.sliding, reward: 600 },
  { id: 'confirm', text: n => `Confirm ${n} kills in Kill Confirmed`, goals: [6, 12], ev: 'confirm', reward: 500 },
  { id: 'airstrike', text: n => `Get ${n} kills with an Airstrike`, goals: [1, 3], ev: 'kill', f: e => e.w === 'airstrike', reward: 700 },
];
function newChallenge(exclude) {
  const options = POOL.filter(p => !exclude.includes(p.id) && (!p.needs || p.needs.every(isUnlocked)));
  const p = options[Math.floor(Math.random() * options.length)];
  const gi = Math.floor(Math.random() * p.goals.length);
  return { id: p.id, goal: p.goals[gi], progress: 0, reward: p.reward + gi * 200 };
}
export function ensureChallenges() {
  profile.challenges = profile.challenges.filter(c => POOL.some(p => p.id === c.id));
  while (profile.challenges.length < 3) profile.challenges.push(newChallenge(profile.challenges.map(c => c.id)));
  saveProfile();
}
export const challengeText = c => POOL.find(p => p.id === c.id)?.text(c.goal) || c.id;
// Feed a game event; returns list of completed challenges (already rewarded & replaced)
export function challengeEvent(ev, data = {}, amount = 1) {
  const done = [];
  for (let i = 0; i < profile.challenges.length; i++) {
    const c = profile.challenges[i], p = POOL.find(x => x.id === c.id);
    if (!p || p.ev !== ev || (p.f && !p.f(data))) continue;
    c.progress = p.max ? Math.max(c.progress, amount) : c.progress + amount;
    if (c.progress >= c.goal) {
      profile.credits += c.reward;
      profile.xp += Math.round(c.reward / 2);
      profile.done++;
      done.push({ text: challengeText(c), reward: c.reward });
      profile.challenges[i] = newChallenge(profile.challenges.map(x => x.id));
    }
  }
  saveProfile();
  return done;
}
export function rerollChallenge(i) {
  if (profile.credits < 150) return false;
  profile.credits -= 150;
  profile.challenges[i] = newChallenge(profile.challenges.map(x => x.id));
  saveProfile();
  return true;
}
// XP in, credits out (1 credit per 10 XP)
// Levelling was too quick. Raising the level curve would take levels away from existing players, so matches give
// less XP instead (credits are unchanged).
export const XP_RATE = 0.6;
export function addCredits(n) { profile.credits += Math.max(0, Math.round(n) || 0); saveProfile(); }
export function addXP(amount) {
  const before = levelInfo().level;
  profile.xp += Math.max(1, Math.round(amount * XP_RATE));
  profile.credits += Math.round(amount / 10);
  saveProfile();
  const after = levelInfo().level;
  return after > before ? after : 0;
}
ensureChallenges();
