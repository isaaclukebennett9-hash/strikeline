// Player progression.
//  • Player level (XP)  → unlocks weapons and throwables. Slow curve, max level 55.
//  • Weapon level (kills with that gun) → unlocks that gun's attachments (Gunsmith), up to weapon level 20.
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
export let profile = DEFAULT();
let migrate = false;
try { const raw = JSON.parse(store.get(KEY) || '{}'); migrate = Object.keys(raw).length > 0 && !raw.v2; profile = Object.assign(DEFAULT(), raw); } catch {}
export const saveProfile = () => store.set(KEY, JSON.stringify(profile));

// Old saves: refund credits spent on the removed weapon upgrades and on buying weapons early (weapons now unlock by level).
export let migrationRefund = 0;
if (migrate) {
  const UPG_COST = { mag: [250, 500, 900], reload: [250, 500, 900], recoil: [300, 600, 1000], barrel: [300, 600, 1000], grip: [200, 400, 800] };
  const OLD_PRICE = { breacher: 800, stinger: 900, kestrel: 1100, tri: 1400, hawk: 1600, scorpion: 2400, magnum: 1200, marksman: 1800, hammer: 2200, longbow: 2800, thumper: 3500 };
  for (const tiers of Object.values(profile.upgrades || {})) for (const [k, t] of Object.entries(tiers)) for (let i = 0; i < t; i++) migrationRefund += UPG_COST[k]?.[i] || 0;
  for (const k of profile.owned) migrationRefund += OLD_PRICE[k] || 0;
  profile.owned = profile.owned.filter(k => k.startsWith('ws:') || k.startsWith('op:'));
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
  asval: 28, fal: 30, pkm: 32, r4c: 34, dartshotgun: 36, flamer: 38, dartsniper: 40,
};
export const UNLOCKS = {
  ...Object.fromEntries(Object.entries(WEAPON_LEVELS).map(([k, l]) => [k, { level: l }])),
  // weapon finishes
  'ws:factory': { price: 0 }, 'ws:woodland': { price: 0 }, 'ws:arctic': { price: 1500 }, 'ws:crimson': { price: 2500 },
  'ws:carbon': { price: 3500, level: 5 }, 'ws:tiger': { price: 5000, level: 10 }, 'ws:neon': { price: 7000, level: 15 },
  'ws:galaxy': { price: 10000, level: 22 }, 'ws:inferno': { price: 14000, level: 30 }, 'ws:gold': { price: 25000, level: 40 },
  // operators
  'op:ranger': { price: 0 }, 'op:desert': { price: 0 }, 'op:cobalt': { price: 2000 }, 'op:crimson': { price: 3000 },
  'op:ghost': { price: 4500, level: 8 }, 'op:toxic': { price: 6000, level: 14 }, 'op:shadow': { price: 9000, level: 20 }, 'op:royal': { price: 14000, level: 28 },
  // developer skins: unlocked on this PC with the dev code (Skins screen)
  'ws:dev': { dev: true }, 'ws:glitch': { dev: true }, 'op:dev': { dev: true }, 'op:devgold': { dev: true },
};
const DEV_KEY = 'strikeline_dev', DEV_HASH = 3747645086;
const fnv = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
export const isDev = () => { try { return localStorage.getItem(DEV_KEY) === String(DEV_HASH); } catch { return false; } };
export function tryDevCode(code) {
  if (fnv(String(code || '').trim().toUpperCase()) !== DEV_HASH) return false;
  try { localStorage.setItem(DEV_KEY, String(DEV_HASH)); } catch {}
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
const NO_UNDER = new Set(['tommy', 'bizon', 'aug', 'ksg', 'kar98', 'pkm', 'tri', 'kestrel', 'longbow', 'breacher', 'hammer', 'dbarrel', 'sawedoff', 'magnum', 'viper', 'hawk', 'stinger']);
// Which Gunsmith slots a weapon has
export function slotsFor(wid) {
  const d = WEAPONS[wid];
  if (!d || d.melee || d.slot === 'grenade') return [];
  if (d.cls === 'special') return d.flame ? ['mag', 'perk'] : ['perk'];
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
export function setAtt(wid, slot, id) {
  const a = { ...(profile.att[wid] || {}) };
  if (!id) delete a[slot];
  else {
    const opt = optionsFor(wid, slot).find(o => o.id === id);
    if (!opt || weaponLevel(wid) < opt.lvl) return false;
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
export function addXP(amount) {
  const before = levelInfo().level;
  profile.xp += amount;
  profile.credits += Math.round(amount / 10);
  saveProfile();
  const after = levelInfo().level;
  return after > before ? after : 0;
}
ensureChallenges();
