// Weapon definitions shared by client and server.
// dmg = per pellet, head = headshot multiplier, rpm = rounds per minute, falloff = [startDist, endDist, minMultiplier]
// cls = weapon class (for menus/challenges) · optic = default sight · anim = reload animation style
// Extra mechanics: bolt (bolt-action cycle seconds), pump (pump after each shot), shellTime (reload one shell at a time),
// flame (short-range fire stream + burning), dart (foam darts), slug, suppressed, burst.

const base = { head: 1.6, auto: false, pellets: 1, speed: 1, zoom: 1.3, ads: 0.17, anim: 'mag', optic: 'irons' };
const W = (o) => ({ ...base, ...o });

export const WEAPONS = {
  // =========================================================== SECONDARIES
  viper: W({ id: 'viper', name: 'P9 Viper', slot: 'secondary', cls: 'pistol', type: 'Pistol', model: 'pistol',
    dmg: 28, head: 2, rpm: 420, mag: 12, reserve: 72, reload: 1.3, spread: 0.014, adsSpread: 0.004, moveSpread: 0.02, recoil: 0.02, range: 80,
    falloff: [18, 50, 0.6], speed: 1.05, zoom: 1.2, ads: 0.12, snd: { f: 3200, d: 0.18, b: 160, v: 0.7 } }),
  magnum: W({ id: 'magnum', name: 'Kodiak .44', slot: 'secondary', cls: 'pistol', type: 'Revolver', model: 'revolver', anim: 'revolver',
    dmg: 60, head: 2, rpm: 140, mag: 6, reserve: 36, reload: 2.2, spread: 0.012, adsSpread: 0.002, moveSpread: 0.03, recoil: 0.07, range: 100,
    falloff: [25, 70, 0.6], speed: 1.0, zoom: 1.3, ads: 0.14, snd: { f: 1800, d: 0.4, b: 90, v: 1.0 } }),
  stinger: W({ id: 'stinger', name: 'Stinger MP', slot: 'secondary', cls: 'pistol', type: 'Machine Pistol', model: 'mpistol',
    dmg: 17, rpm: 1000, auto: true, mag: 20, reserve: 100, reload: 1.5, spread: 0.03, adsSpread: 0.014, moveSpread: 0.02, recoil: 0.012, range: 50,
    falloff: [10, 30, 0.5], speed: 1.05, zoom: 1.15, ads: 0.12, snd: { f: 3600, d: 0.12, b: 180, v: 0.6 } }),
  hawk: W({ id: 'hawk', name: 'Desert Hawk', slot: 'secondary', cls: 'pistol', type: 'Heavy Pistol', model: 'hawk',
    dmg: 50, head: 2, rpm: 200, mag: 7, reserve: 42, reload: 1.8, spread: 0.016, adsSpread: 0.003, moveSpread: 0.025, recoil: 0.06, range: 90,
    falloff: [22, 60, 0.65], speed: 1.0, zoom: 1.3, ads: 0.14, snd: { f: 1700, d: 0.38, b: 85, v: 1.0 } }),
  sawedoff: W({ id: 'sawedoff', name: 'Sawed-Off', slot: 'secondary', cls: 'pistol', type: 'Sawed-Off Shotgun', model: 'sawedoff', anim: 'break',
    dmg: 14, head: 1.3, rpm: 320, pellets: 10, mag: 2, reserve: 24, reload: 1.9, spread: 0.12, adsSpread: 0.1, moveSpread: 0.01, recoil: 0.1, range: 18,
    falloff: [4, 12, 0.25], speed: 1.05, zoom: 1.1, ads: 0.13, snd: { f: 1300, d: 0.5, b: 65, v: 1.15 } }),

  // =========================================================== SMGs
  vector: W({ id: 'vector', name: 'Vector-K', slot: 'primary', cls: 'smg', type: 'SMG', model: 'smg',
    dmg: 20, head: 1.5, rpm: 900, auto: true, mag: 32, reserve: 192, reload: 1.7, spread: 0.028, adsSpread: 0.008, moveSpread: 0.012, recoil: 0.011, range: 70,
    falloff: [12, 35, 0.55], speed: 1.1, zoom: 1.25, ads: 0.14, snd: { f: 3400, d: 0.14, b: 150, v: 0.7 } }),
  kestrel: W({ id: 'kestrel', name: 'Kestrel PDW', slot: 'primary', cls: 'smg', type: 'PDW', model: 'pdw',
    dmg: 22, rpm: 820, auto: true, mag: 40, reserve: 200, reload: 2.0, spread: 0.024, adsSpread: 0.006, moveSpread: 0.015, recoil: 0.012, range: 90,
    falloff: [16, 45, 0.6], speed: 1.06, zoom: 1.3, ads: 0.15, snd: { f: 3000, d: 0.16, b: 140, v: 0.75 } }),
  mp5: W({ id: 'mp5', name: 'MP5', slot: 'primary', cls: 'smg', type: 'SMG', model: 'mp5',
    dmg: 21, rpm: 800, auto: true, mag: 30, reserve: 180, reload: 1.9, spread: 0.022, adsSpread: 0.005, moveSpread: 0.012, recoil: 0.009, range: 75,
    falloff: [14, 40, 0.6], speed: 1.08, zoom: 1.3, ads: 0.14, snd: { f: 3300, d: 0.13, b: 150, v: 0.68 } }),
  ppsh: W({ id: 'ppsh', name: 'PPSh-41', slot: 'primary', cls: 'smg', type: 'SMG', model: 'ppsh',
    dmg: 18, head: 1.5, rpm: 1000, auto: true, mag: 71, reserve: 213, reload: 3.2, spread: 0.03, adsSpread: 0.008, moveSpread: 0.012, recoil: 0.01, range: 85,
    falloff: [16, 42, 0.6], speed: 1.04, zoom: 1.2, ads: 0.16, snd: { f: 3100, d: 0.12, b: 140, v: 0.7 } }),
  tommy: W({ id: 'tommy', name: 'M1928 Tommy', slot: 'primary', cls: 'smg', type: 'SMG', model: 'tommy',
    dmg: 24, head: 1.5, rpm: 700, auto: true, mag: 50, reserve: 150, reload: 3.0, spread: 0.03, adsSpread: 0.008, moveSpread: 0.014, recoil: 0.015, range: 65,
    falloff: [12, 32, 0.55], speed: 1.0, zoom: 1.2, ads: 0.16, snd: { f: 2500, d: 0.16, b: 120, v: 0.8 } }),
  bizon: W({ id: 'bizon', name: 'PP-19 Bizon', slot: 'primary', cls: 'smg', type: 'SMG', model: 'bizon',
    dmg: 19, head: 1.5, rpm: 680, auto: true, mag: 64, reserve: 192, reload: 2.6, spread: 0.026, adsSpread: 0.007, moveSpread: 0.012, recoil: 0.009, range: 65,
    falloff: [12, 34, 0.55], speed: 1.06, zoom: 1.25, ads: 0.15, snd: { f: 3200, d: 0.13, b: 150, v: 0.68 } }),
  skorpion: W({ id: 'skorpion', name: 'CZ Skorpion', slot: 'primary', cls: 'smg', type: 'SMG', model: 'skorpion',
    dmg: 16, head: 1.5, rpm: 1150, auto: true, mag: 30, reserve: 180, reload: 1.7, spread: 0.03, adsSpread: 0.012, moveSpread: 0.01, recoil: 0.011, range: 50,
    falloff: [8, 26, 0.5], speed: 1.12, zoom: 1.2, ads: 0.12, snd: { f: 3700, d: 0.1, b: 175, v: 0.62 } }),

  // =========================================================== ASSAULT RIFLES
  falcon: W({ id: 'falcon', name: 'AR-7 Falcon', slot: 'primary', cls: 'ar', type: 'Assault Rifle', model: 'rifle',
    dmg: 26, head: 1.8, rpm: 650, auto: true, mag: 30, reserve: 180, reload: 2.1, spread: 0.024, adsSpread: 0.003, moveSpread: 0.03, recoil: 0.016, range: 150,
    falloff: [30, 80, 0.7], speed: 0.95, zoom: 1.4, snd: { f: 2400, d: 0.22, b: 110, v: 0.85 } }),
  tri: W({ id: 'tri', name: 'M4 Tri-Burst', slot: 'primary', cls: 'ar', type: 'Burst Rifle', model: 'burst',
    dmg: 31, head: 1.8, rpm: 900, burst: 3, burstDelay: 0.32, auto: true, mag: 30, reserve: 180, reload: 2.0, spread: 0.02, adsSpread: 0.002, moveSpread: 0.03, recoil: 0.014, range: 150,
    falloff: [30, 80, 0.7], speed: 0.95, zoom: 1.5, snd: { f: 2600, d: 0.2, b: 120, v: 0.8 } }),
  ak47: W({ id: 'ak47', name: 'AK-47', slot: 'primary', cls: 'ar', type: 'Assault Rifle', model: 'ak',
    dmg: 33, head: 1.8, rpm: 600, auto: true, mag: 30, reserve: 180, reload: 2.5, spread: 0.028, adsSpread: 0.004, moveSpread: 0.03, recoil: 0.024, range: 160,
    falloff: [35, 90, 0.75], speed: 0.93, zoom: 1.35, ads: 0.19, snd: { f: 2100, d: 0.25, b: 100, v: 0.95 } }),
  ak12: W({ id: 'ak12', name: 'AK-12', slot: 'primary', cls: 'ar', type: 'Assault Rifle', model: 'ak12',
    dmg: 29, head: 1.8, rpm: 700, auto: true, mag: 30, reserve: 180, reload: 2.3, spread: 0.024, adsSpread: 0.003, moveSpread: 0.028, recoil: 0.017, range: 150,
    falloff: [30, 85, 0.7], speed: 0.95, zoom: 1.4, ads: 0.18, snd: { f: 2250, d: 0.23, b: 105, v: 0.9 } }),
  galil: W({ id: 'galil', name: 'Galil ACE', slot: 'primary', cls: 'ar', type: 'Assault Rifle', model: 'galil',
    dmg: 30, head: 1.8, rpm: 650, auto: true, mag: 35, reserve: 175, reload: 2.4, spread: 0.026, adsSpread: 0.0035, moveSpread: 0.03, recoil: 0.019, range: 150,
    falloff: [30, 85, 0.72], speed: 0.94, zoom: 1.4, ads: 0.18, snd: { f: 2300, d: 0.23, b: 105, v: 0.9 } }),
  famas: W({ id: 'famas', name: 'FAMAS', slot: 'primary', cls: 'ar', type: 'Assault Rifle', model: 'famas',
    dmg: 24, head: 1.8, rpm: 950, auto: true, mag: 30, reserve: 180, reload: 2.2, spread: 0.023, adsSpread: 0.003, moveSpread: 0.028, recoil: 0.013, range: 130,
    falloff: [26, 72, 0.68], speed: 0.96, zoom: 1.4, ads: 0.16, snd: { f: 2700, d: 0.18, b: 125, v: 0.8 } }),
  aug: W({ id: 'aug', name: 'AUG A3', slot: 'primary', cls: 'ar', type: 'Bullpup Rifle', model: 'aug',
    dmg: 27, head: 1.8, rpm: 680, auto: true, mag: 30, reserve: 180, reload: 2.6, spread: 0.022, adsSpread: 0.002, moveSpread: 0.028, recoil: 0.013, range: 160,
    falloff: [32, 90, 0.72], speed: 0.95, zoom: 1.4, ads: 0.17, snd: { f: 2500, d: 0.2, b: 115, v: 0.82 } }),
  g36c: W({ id: 'g36c', name: 'G36C', slot: 'primary', cls: 'ar', type: 'Carbine', model: 'g36',
    dmg: 25, head: 1.7, rpm: 750, auto: true, mag: 30, reserve: 180, reload: 2.0, spread: 0.023, adsSpread: 0.003, moveSpread: 0.026, recoil: 0.013, range: 130,
    falloff: [26, 72, 0.68], speed: 0.98, zoom: 1.4, ads: 0.16, snd: { f: 2600, d: 0.2, b: 120, v: 0.8 } }),
  asval: W({ id: 'asval', name: 'AS Val', slot: 'primary', cls: 'ar', type: 'Suppressed Rifle', model: 'asval', suppressed: true,
    dmg: 27, head: 1.9, rpm: 900, auto: true, mag: 20, reserve: 160, reload: 1.9, spread: 0.024, adsSpread: 0.004, moveSpread: 0.024, recoil: 0.014, range: 90,
    falloff: [18, 50, 0.6], speed: 1.0, zoom: 1.4, ads: 0.16, snd: { f: 1400, d: 0.1, b: 60, v: 0.35 } }),
  r4c: W({ id: 'r4c', name: 'R4-C', slot: 'primary', cls: 'ar', type: 'Assault Rifle', model: 'r4c',
    dmg: 30, head: 1.8, rpm: 860, auto: true, mag: 30, reserve: 180, reload: 2.2, spread: 0.026, adsSpread: 0.0035, moveSpread: 0.03, recoil: 0.021, range: 140,
    falloff: [28, 80, 0.7], speed: 0.95, zoom: 1.4, ads: 0.17, snd: { f: 2450, d: 0.21, b: 112, v: 0.86 } }),
  scarh: W({ id: 'scarh', name: 'SCAR-H', slot: 'primary', cls: 'ar', type: 'Battle Rifle', model: 'scarh',
    dmg: 41, head: 1.8, rpm: 550, auto: true, mag: 20, reserve: 140, reload: 2.4, spread: 0.028, adsSpread: 0.003, moveSpread: 0.034, recoil: 0.028, range: 180,
    falloff: [40, 110, 0.78], speed: 0.91, zoom: 1.5, ads: 0.2, snd: { f: 1900, d: 0.28, b: 92, v: 1.0 } }),
  fal: W({ id: 'fal', name: 'FN FAL', slot: 'primary', cls: 'ar', type: 'Battle Rifle', model: 'fal',
    dmg: 52, head: 2, rpm: 380, mag: 20, reserve: 120, reload: 2.4, spread: 0.026, adsSpread: 0.0018, moveSpread: 0.034, recoil: 0.036, range: 200,
    falloff: [45, 120, 0.8], speed: 0.91, zoom: 1.6, ads: 0.2, snd: { f: 1850, d: 0.3, b: 90, v: 1.0 } }),

  // =========================================================== LMGs
  hammer: W({ id: 'hammer', name: 'Hammer M60', slot: 'primary', cls: 'lmg', type: 'LMG', model: 'lmg', anim: 'belt',
    dmg: 24, rpm: 720, auto: true, mag: 100, reserve: 200, reload: 4.2, spread: 0.035, adsSpread: 0.006, moveSpread: 0.04, recoil: 0.014, range: 150,
    falloff: [30, 80, 0.7], speed: 0.85, zoom: 1.35, ads: 0.24, snd: { f: 2100, d: 0.26, b: 95, v: 0.9 } }),
  m249: W({ id: 'm249', name: 'M249 SAW', slot: 'primary', cls: 'lmg', type: 'LMG', model: 'm249', anim: 'belt',
    dmg: 23, rpm: 800, auto: true, mag: 100, reserve: 200, reload: 4.6, spread: 0.036, adsSpread: 0.006, moveSpread: 0.04, recoil: 0.013, range: 150,
    falloff: [30, 80, 0.7], speed: 0.84, zoom: 1.35, ads: 0.24, snd: { f: 2300, d: 0.22, b: 105, v: 0.88 } }),
  pkm: W({ id: 'pkm', name: 'PKM', slot: 'primary', cls: 'lmg', type: 'LMG', model: 'pkm', anim: 'belt',
    dmg: 30, rpm: 650, auto: true, mag: 100, reserve: 200, reload: 5.0, spread: 0.038, adsSpread: 0.007, moveSpread: 0.044, recoil: 0.019, range: 170,
    falloff: [35, 95, 0.75], speed: 0.82, zoom: 1.35, ads: 0.26, snd: { f: 1950, d: 0.28, b: 92, v: 0.95 } }),

  // =========================================================== SHOTGUNS
  breacher: W({ id: 'breacher', name: 'Breacher 12', slot: 'primary', cls: 'shotgun', type: 'Pump Shotgun', model: 'shotgun', anim: 'shells', pump: true, shellTime: 0.5,
    dmg: 13, head: 1.4, rpm: 75, pellets: 10, mag: 7, reserve: 42, reload: 2.6, spread: 0.075, adsSpread: 0.055, moveSpread: 0.01, recoil: 0.08, range: 40,
    falloff: [6, 20, 0.3], speed: 1.0, zoom: 1.15, snd: { f: 1400, d: 0.45, b: 70, v: 1.1 } }),
  // KSG fires slugs: one heavy round, accurate at range — two body shots up close, three far out
  ksg: W({ id: 'ksg', name: 'KSG 12', slot: 'primary', cls: 'shotgun', type: 'Pump Slug Shotgun', model: 'ksg', anim: 'shells', pump: true, shellTime: 0.42, slug: true,
    dmg: 64, head: 1.6, rpm: 85, mag: 14, reserve: 42, reload: 3, spread: 0.032, adsSpread: 0.004, moveSpread: 0.03, recoil: 0.08, range: 75,
    falloff: [18, 50, 0.55], speed: 1.0, zoom: 1.35, snd: { f: 1350, d: 0.45, b: 68, v: 1.1 } }),
  spas12: W({ id: 'spas12', name: 'SPAS-12', slot: 'primary', cls: 'shotgun', type: 'Pump Shotgun', model: 'spas12', anim: 'shells', pump: true, shellTime: 0.45,
    dmg: 15, head: 1.4, rpm: 80, pellets: 9, mag: 8, reserve: 40, reload: 2.8, spread: 0.066, adsSpread: 0.05, moveSpread: 0.01, recoil: 0.085, range: 38,
    falloff: [7, 22, 0.32], speed: 0.97, zoom: 1.15, snd: { f: 1300, d: 0.5, b: 66, v: 1.15 } }),
  benelli: W({ id: 'benelli', name: 'M4 Super 90', slot: 'primary', cls: 'shotgun', type: 'Semi-Auto Shotgun', model: 'benelli', anim: 'shells', shellTime: 0.4,
    dmg: 12, head: 1.4, rpm: 200, pellets: 8, mag: 7, reserve: 42, reload: 2.6, spread: 0.07, adsSpread: 0.052, moveSpread: 0.01, recoil: 0.06, range: 36,
    falloff: [6, 19, 0.3], speed: 0.98, zoom: 1.15, snd: { f: 1480, d: 0.38, b: 74, v: 1.05 } }),
  scorpion: W({ id: 'scorpion', name: 'Scorpion Auto', slot: 'primary', cls: 'shotgun', type: 'Auto Shotgun', model: 'autoshotgun',
    dmg: 10, head: 1.4, rpm: 260, auto: true, pellets: 8, mag: 10, reserve: 50, reload: 3.0, spread: 0.08, adsSpread: 0.06, moveSpread: 0.01, recoil: 0.05, range: 35,
    falloff: [5, 16, 0.3], speed: 0.95, zoom: 1.15, snd: { f: 1500, d: 0.35, b: 75, v: 1.0 } }),
  tcsg: W({ id: 'tcsg', name: 'TCSG12', slot: 'primary', cls: 'shotgun', type: 'Slug Shotgun', model: 'tcsg', slug: true,
    dmg: 55, head: 1.7, rpm: 240, mag: 10, reserve: 50, reload: 2.4, spread: 0.03, adsSpread: 0.004, moveSpread: 0.03, recoil: 0.05, range: 70,
    falloff: [15, 45, 0.55], speed: 0.98, zoom: 1.4, snd: { f: 1350, d: 0.42, b: 70, v: 1.1 } }),
  dbarrel: W({ id: 'dbarrel', name: 'Double Barrel', slot: 'primary', cls: 'shotgun', type: 'Break-Action', model: 'dbarrel', anim: 'break',
    dmg: 15, head: 1.4, rpm: 300, pellets: 12, mag: 2, reserve: 30, reload: 2.2, spread: 0.085, adsSpread: 0.065, moveSpread: 0.01, recoil: 0.1, range: 30,
    falloff: [6, 18, 0.3], speed: 1.0, zoom: 1.15, snd: { f: 1200, d: 0.55, b: 62, v: 1.2 } }),

  // =========================================================== MARKSMAN / SNIPERS
  marksman: W({ id: 'marksman', name: 'SR-25 Marksman', slot: 'primary', cls: 'dmr', type: 'Semi-Auto DMR', model: 'dmr', optic: 'acog',
    dmg: 44, head: 2, rpm: 330, mag: 20, reserve: 120, reload: 2.1, spread: 0.03, adsSpread: 0.001, moveSpread: 0.035, recoil: 0.028, range: 200,
    falloff: [50, 120, 0.8], speed: 0.97, zoom: 2.3, ads: 0.2, snd: { f: 2000, d: 0.32, b: 95, v: 0.95 } }),
  longbow: W({ id: 'longbow', name: 'Longbow .50', slot: 'primary', cls: 'sniper', type: 'Bolt-Action Sniper', model: 'sniper', optic: 'scope8', bolt: 0.95,
    dmg: 110, head: 2.5, rpm: 58, mag: 5, reserve: 30, reload: 3.0, spread: 0.09, adsSpread: 0.0, moveSpread: 0.06, recoil: 0.09, range: 300,
    falloff: [300, 301, 1], speed: 0.9, zoom: 6, ads: 0.26, snd: { f: 1500, d: 0.6, b: 60, v: 1.2 } }),
  kar98: W({ id: 'kar98', name: 'Kar98k', slot: 'primary', cls: 'sniper', type: 'Bolt-Action Rifle', model: 'kar98', optic: 'scope4', bolt: 0.8, anim: 'clip',
    dmg: 100, head: 2.2, rpm: 68, mag: 5, reserve: 30, reload: 2.6, spread: 0.06, adsSpread: 0.0, moveSpread: 0.05, recoil: 0.07, range: 250,
    falloff: [60, 150, 0.9], speed: 0.96, zoom: 3.5, ads: 0.21, snd: { f: 1700, d: 0.5, b: 70, v: 1.1 } }),

  // =========================================================== SPECIAL
  thumper: W({ id: 'thumper', name: 'Thumper RPG', slot: 'primary', cls: 'special', type: 'Launcher', model: 'rocket', optic: 'none', anim: 'rocket',
    dmg: 140, splash: 5.5, projectile: true, head: 1, rpm: 50, mag: 1, reserve: 6, reload: 2.4, spread: 0.02, adsSpread: 0.0, moveSpread: 0.03, recoil: 0.06, range: 200,
    falloff: [200, 201, 1], speed: 0.85, zoom: 1.3, ads: 0.25, snd: { f: 900, d: 0.6, b: 55, v: 1.0 } }),
  flamer: W({ id: 'flamer', name: 'Inferno Flamethrower', slot: 'primary', cls: 'special', type: 'Flamethrower', model: 'flamer', optic: 'none', anim: 'tank', flame: true,
    dmg: 9, head: 1, rpm: 600, auto: true, mag: 120, reserve: 240, reload: 3.0, spread: 0.1, adsSpread: 0.08, moveSpread: 0.02, recoil: 0.002, range: 12,
    falloff: [6, 12, 0.6], speed: 0.92, zoom: 1.1, snd: { f: 300, d: 0.12, b: 40, v: 0.5 } }),
  dartsniper: W({ id: 'dartsniper', name: 'Dart Ranger', slot: 'primary', cls: 'special', type: 'Foam Dart Sniper', model: 'dartsniper', optic: 'toyscope', dart: true, bolt: 0.7,
    dmg: 65, head: 2, rpm: 70, mag: 6, reserve: 36, reload: 2.4, spread: 0.04, adsSpread: 0.001, moveSpread: 0.04, recoil: 0.02, range: 120,
    falloff: [30, 90, 0.6], speed: 1.0, zoom: 2.6, snd: { f: 600, d: 0.14, b: 200, v: 0.55 } }),
  dartshotgun: W({ id: 'dartshotgun', name: 'Popper 2x4', slot: 'primary', cls: 'special', type: 'Foam Dart Shotgun', model: 'dartshotgun', dart: true, pump: true,
    dmg: 38, head: 1.5, rpm: 150, pellets: 2, mag: 8, reserve: 32, reload: 2.2, spread: 0.05, adsSpread: 0.03, moveSpread: 0.01, recoil: 0.04, range: 35,
    falloff: [8, 25, 0.5], speed: 1.03, zoom: 1.15, snd: { f: 650, d: 0.12, b: 210, v: 0.6 } }),

  // =========================================================== HOST PC ONLY (the developer's own PC hosting: see HOST_ONLY)
  annihilator: W({ id: 'annihilator', name: 'Annihilator', slot: 'primary', cls: 'special', type: 'Prototype Rail Rifle', model: 'annihilator', hostOnly: true,
    dmg: 150, head: 2, rpm: 750, auto: true, mag: 100, reserve: 900, reload: 0.8, spread: 0.003, adsSpread: 0, moveSpread: 0.002, recoil: 0.003, range: 400,
    falloff: [300, 400, 1], speed: 1.2, zoom: 1.4, ads: 0.1, snd: { f: 700, d: 0.35, b: 50, v: 1.15 } }),

  // =========================================================== WW1 / WW2 (era: shown in their own Armory tab and in their class tab)
  m1911: W({ id: 'm1911', name: 'M1911', slot: 'secondary', cls: 'pistol', type: 'Pistol', model: 'm1911', era: 'ww2',
    dmg: 38, head: 1.9, rpm: 300, mag: 7, reserve: 49, reload: 1.5, spread: 0.015, adsSpread: 0.004, moveSpread: 0.022, recoil: 0.038, range: 75,
    falloff: [16, 45, 0.6], speed: 1.04, zoom: 1.2, ads: 0.13, snd: { f: 2200, d: 0.24, b: 120, v: 0.85 } }),
  luger: W({ id: 'luger', name: 'Luger P08', slot: 'secondary', cls: 'pistol', type: 'Pistol', model: 'luger', era: 'ww2',
    dmg: 30, head: 2, rpm: 400, mag: 8, reserve: 56, reload: 1.4, spread: 0.012, adsSpread: 0.003, moveSpread: 0.02, recoil: 0.024, range: 80,
    falloff: [18, 50, 0.6], speed: 1.05, zoom: 1.25, ads: 0.12, snd: { f: 3000, d: 0.2, b: 150, v: 0.75 } }),
  mp40: W({ id: 'mp40', name: 'MP40', slot: 'primary', cls: 'smg', type: 'SMG', model: 'mp40', era: 'ww2',
    dmg: 23, head: 1.5, rpm: 550, auto: true, mag: 32, reserve: 192, reload: 2.2, spread: 0.022, adsSpread: 0.005, moveSpread: 0.012, recoil: 0.008, range: 75,
    falloff: [14, 40, 0.6], speed: 1.06, zoom: 1.25, ads: 0.15, snd: { f: 2600, d: 0.15, b: 130, v: 0.72 } }),
  sten: W({ id: 'sten', name: 'Sten Mk II', slot: 'primary', cls: 'smg', type: 'SMG', model: 'sten', era: 'ww2',
    dmg: 21, head: 1.5, rpm: 560, auto: true, mag: 32, reserve: 192, reload: 2.0, spread: 0.026, adsSpread: 0.007, moveSpread: 0.011, recoil: 0.01, range: 65,
    falloff: [12, 34, 0.55], speed: 1.1, zoom: 1.2, ads: 0.13, snd: { f: 2500, d: 0.14, b: 125, v: 0.7 } }),
  mp18: W({ id: 'mp18', name: 'MP18', slot: 'primary', cls: 'smg', type: 'SMG', model: 'mp18', era: 'ww1',
    dmg: 25, head: 1.5, rpm: 480, auto: true, mag: 32, reserve: 160, reload: 2.6, spread: 0.024, adsSpread: 0.005, moveSpread: 0.013, recoil: 0.011, range: 80,
    falloff: [16, 44, 0.6], speed: 1.0, zoom: 1.25, ads: 0.17, snd: { f: 2400, d: 0.16, b: 120, v: 0.75 } }),
  stg44: W({ id: 'stg44', name: 'StG 44', slot: 'primary', cls: 'ar', type: 'Assault Rifle', model: 'stg44', era: 'ww2',
    dmg: 32, head: 1.8, rpm: 560, auto: true, mag: 30, reserve: 180, reload: 2.5, spread: 0.027, adsSpread: 0.0035, moveSpread: 0.03, recoil: 0.02, range: 150,
    falloff: [30, 85, 0.72], speed: 0.93, zoom: 1.35, ads: 0.19, snd: { f: 2150, d: 0.24, b: 100, v: 0.92 } }),
  garand: W({ id: 'garand', name: 'M1 Garand', slot: 'primary', cls: 'ar', type: 'Semi-Auto Rifle', model: 'garand', era: 'ww2', anim: 'clip', ping: true,
    dmg: 52, head: 2, rpm: 380, mag: 8, reserve: 64, reload: 2.2, spread: 0.026, adsSpread: 0.0015, moveSpread: 0.035, recoil: 0.034, range: 200,
    falloff: [45, 120, 0.8], speed: 0.92, zoom: 1.5, ads: 0.2, snd: { f: 1800, d: 0.32, b: 88, v: 1.0 } }),
  bar: W({ id: 'bar', name: 'BAR M1918', slot: 'primary', cls: 'lmg', type: 'Automatic Rifle', model: 'bar', era: 'ww2',
    dmg: 34, head: 1.8, rpm: 520, auto: true, mag: 20, reserve: 160, reload: 2.5, spread: 0.032, adsSpread: 0.005, moveSpread: 0.04, recoil: 0.022, range: 170,
    falloff: [35, 95, 0.75], speed: 0.86, zoom: 1.35, ads: 0.23, snd: { f: 1900, d: 0.3, b: 90, v: 0.98 } }),
  mg42: W({ id: 'mg42', name: 'MG 42', slot: 'primary', cls: 'lmg', type: 'LMG', model: 'mg42', era: 'ww2', anim: 'belt',
    dmg: 24, rpm: 1150, auto: true, mag: 75, reserve: 150, reload: 4.6, spread: 0.04, adsSpread: 0.008, moveSpread: 0.045, recoil: 0.012, range: 160,
    falloff: [30, 85, 0.7], speed: 0.8, zoom: 1.3, ads: 0.27, snd: { f: 2600, d: 0.18, b: 110, v: 0.85 } }),
  lewis: W({ id: 'lewis', name: 'Lewis Gun', slot: 'primary', cls: 'lmg', type: 'LMG', model: 'lewis', era: 'ww1',
    dmg: 29, rpm: 560, auto: true, mag: 47, reserve: 141, reload: 3.6, spread: 0.036, adsSpread: 0.006, moveSpread: 0.042, recoil: 0.016, range: 160,
    falloff: [32, 90, 0.72], speed: 0.82, zoom: 1.3, ads: 0.25, snd: { f: 2000, d: 0.26, b: 95, v: 0.92 } }),
  trench: W({ id: 'trench', name: 'M97 Trench Gun', slot: 'primary', cls: 'shotgun', type: 'Pump Shotgun', model: 'trench', era: 'ww1', anim: 'shells', pump: true, shellTime: 0.48,
    dmg: 15, head: 1.4, rpm: 95, pellets: 9, mag: 5, reserve: 35, reload: 2.4, spread: 0.07, adsSpread: 0.052, moveSpread: 0.01, recoil: 0.085, range: 38,
    falloff: [7, 22, 0.32], speed: 1.0, zoom: 1.15, snd: { f: 1300, d: 0.5, b: 66, v: 1.15 } }),
  enfield: W({ id: 'enfield', name: 'Lee-Enfield No.4', slot: 'primary', cls: 'sniper', type: 'Bolt-Action Rifle', model: 'enfield', era: 'ww2', bolt: 0.55, anim: 'clip',
    dmg: 92, head: 2.2, rpm: 85, mag: 10, reserve: 40, reload: 2.8, spread: 0.06, adsSpread: 0.0, moveSpread: 0.05, recoil: 0.065, range: 230,
    falloff: [55, 140, 0.88], speed: 0.97, zoom: 1.6, ads: 0.19, snd: { f: 1750, d: 0.48, b: 72, v: 1.1 } }),

  // =========================================================== THROWABLES (G = lethal, Q = tactical)
  frag: W({ id: 'frag', name: 'Frag Grenade', slot: 'grenade', throwable: 'lethal', desc: 'Bounces, explodes after 2.4s', type: 'Grenade', model: 'none',
    dmg: 135, splash: 5.5, fuse: 2.4, head: 1, rpm: 60, mag: 0, reserve: 0, reload: 0, spread: 0, adsSpread: 0, moveSpread: 0, recoil: 0, range: 40, falloff: [40, 41, 1], snd: { f: 900, d: 0.6, b: 55, v: 1.0 } }),
  semtex: W({ id: 'semtex', name: 'Semtex', slot: 'grenade', throwable: 'lethal', desc: 'Sticks to walls and players, short fuse', type: 'Sticky Grenade', model: 'none',
    dmg: 130, splash: 4.5, fuse: 1.8, head: 1, rpm: 60, mag: 0, reserve: 0, reload: 0, spread: 0, adsSpread: 0, moveSpread: 0, recoil: 0, range: 40, falloff: [40, 41, 1], snd: { f: 900, d: 0.6, b: 55, v: 1.0 } }),
  molotov: W({ id: 'molotov', name: 'Molotov', slot: 'grenade', throwable: 'lethal', desc: 'Shatters into a pool of fire', type: 'Incendiary', model: 'none',
    dmg: 8, splash: 3.6, fuse: 6, head: 1, rpm: 60, mag: 0, reserve: 0, reload: 0, spread: 0, adsSpread: 0, moveSpread: 0, recoil: 0, range: 40, falloff: [40, 41, 1], snd: { f: 900, d: 0.6, b: 55, v: 1.0 } }),
  tknife: W({ id: 'tknife', name: 'Throwing Knife', slot: 'grenade', throwable: 'lethal', desc: 'One-hit kill on a direct hit', type: 'Throwing Knife', model: 'none',
    dmg: 150, head: 1, rpm: 60, mag: 0, reserve: 0, reload: 0, spread: 0, adsSpread: 0, moveSpread: 0, recoil: 0, range: 60, falloff: [60, 61, 1], snd: { f: 5000, d: 0.08, b: 0, v: 0.3 } }),
  smoke: W({ id: 'smoke', name: 'Smoke Grenade', slot: 'grenade', throwable: 'tactical', desc: 'Thick smoke wall for 14 seconds', type: 'Smoke', model: 'none',
    dmg: 0, fuse: 1.2, head: 1, rpm: 60, mag: 0, reserve: 0, reload: 0, spread: 0, adsSpread: 0, moveSpread: 0, recoil: 0, range: 40, falloff: [40, 41, 1], snd: { f: 900, d: 0.6, b: 55, v: 1.0 } }),
  flash: W({ id: 'flash', name: 'Flashbang', slot: 'grenade', throwable: 'tactical', desc: 'Blinds anyone looking at it', type: 'Flash', model: 'none',
    dmg: 0, fuse: 1.5, head: 1, rpm: 60, mag: 0, reserve: 0, reload: 0, spread: 0, adsSpread: 0, moveSpread: 0, recoil: 0, range: 40, falloff: [40, 41, 1], snd: { f: 900, d: 0.6, b: 55, v: 1.0 } }),
  stun: W({ id: 'stun', name: 'Stun Grenade', slot: 'grenade', throwable: 'tactical', desc: 'Slows movement and aim for 4 seconds', type: 'Stun', model: 'none',
    dmg: 0, fuse: 1.5, head: 1, rpm: 60, mag: 0, reserve: 0, reload: 0, spread: 0, adsSpread: 0, moveSpread: 0, recoil: 0, range: 40, falloff: [40, 41, 1], snd: { f: 900, d: 0.6, b: 55, v: 1.0 } }),
  airstrike: W({ id: 'airstrike', name: 'Airstrike', slot: 'grenade', type: 'Killstreak', model: 'none',
    dmg: 160, splash: 6.5, head: 1, rpm: 60, mag: 0, reserve: 0, reload: 0, spread: 0, adsSpread: 0, moveSpread: 0, recoil: 0, range: 100, falloff: [100, 101, 1], snd: { f: 900, d: 0.6, b: 55, v: 1.0 } }),

  // =========================================================== MELEE
  knife: W({ id: 'knife', name: 'Combat Knife', slot: 'melee', cls: 'melee', type: 'Melee', model: 'knife', melee: true, optic: 'none',
    dmg: 55, head: 1.5, rpm: 110, auto: true, mag: 0, reserve: 0, reload: 0, spread: 0, adsSpread: 0, moveSpread: 0, recoil: 0, range: 2.3,
    falloff: [10, 11, 1], speed: 1.15, zoom: 1, snd: { f: 5000, d: 0.08, b: 0, v: 0.3 } }),
};

for (const id of ['tommy', 'ppsh', 'kar98']) WEAPONS[id].era = 'ww2';
export const ERA_NAMES = { ww1: 'WW1', ww2: 'WW2' };
export const CLASS_NAMES = { ar: 'Assault Rifles', smg: 'SMGs', lmg: 'LMGs', shotgun: 'Shotguns', dmr: 'Marksman', sniper: 'Snipers', special: 'Special', pistol: 'Secondaries' };
// Only usable by whoever plays on the PC that hosts from the developer's project folder (the server checks).
export const HOST_ONLY = Object.values(WEAPONS).filter(w => w.hostOnly).map(w => w.id);
export const PRIMARIES = Object.values(WEAPONS).filter(w => w.slot === 'primary' && !w.hostOnly).map(w => w.id);
export const SECONDARIES = Object.values(WEAPONS).filter(w => w.slot === 'secondary').map(w => w.id);
export const LETHALS = ['frag', 'semtex', 'molotov', 'tknife'];
export const TACTICALS = ['smoke', 'flash', 'stun'];
export const THROWABLE_KINDS = ['frag', 'semtex', 'molotov', 'tknife', 'smoke', 'flash', 'stun'];
export const BOT_WEAPONS = ['falcon', 'vector', 'marksman', 'hammer', 'kestrel', 'tri', 'ak47', 'mp5', 'm249', 'g36c', 'famas', 'scarh', 'ppsh', 'tommy', 'aug', 'galil', 'r4c', 'bizon', 'mp40', 'stg44', 'bar', 'sten'];

export function falloffMult(def, dist) {
  const [a, b, m] = def.falloff;
  if (dist <= a) return 1;
  if (dist >= b) return m;
  return 1 - (1 - m) * ((dist - a) / (b - a));
}

// ---------------------------------------------------------------- iron sight styles (what you see when aiming without an optic)
// aperture: round rear peep + hooded front post · ring: hooded front ring + round rear peep (PPSh/MP5 style)
// notch: open tangent notch + eared front post (AK family) · ghost: thick ghost ring + winged post (shotguns)
// bead: front bead on a rib · pistol: three-dot · toy: chunky blaster sights
const IRONS = {
  viper: 'pistol', magnum: 'pistol', hawk: 'pistol', stinger: 'notch', sawedoff: 'bead', dbarrel: 'bead',
  ppsh: 'ring', mp5: 'ring', tommy: 'aperture', bizon: 'notch', skorpion: 'notch', ak47: 'notch', pkm: 'notch', asval: 'notch',
  hammer: 'notch', breacher: 'ghost', ksg: 'ghost', spas12: 'ghost', benelli: 'ghost', scorpion: 'ghost', tcsg: 'ghost', dartshotgun: 'toy', dartsniper: 'toy', kar98: 'notch',
  m1911: 'pistol', luger: 'pistol', mp40: 'notch', mp18: 'notch', stg44: 'notch', mg42: 'notch', trench: 'bead',
};
for (const w of Object.values(WEAPONS)) if (!w.throwable && !w.melee) w.irons = IRONS[w.id] || 'aperture';

// ---------------------------------------------------------------- recoil patterns
// Every gun climbs and sways its own way. kick = extra climb on the first shots, settle = how much the climb
// calms down in a long spray (lower = easier to control), bias = steady drift (- left, + right), sway = side-to-side
// amount, rate = how fast the sway swings. Guns not listed get a pattern derived from their name, so no two match.
const RECOIL = {
  falcon: { kick: 0.25, settle: 0.7, bias: 0.15, sway: 0.35, rate: 0.9 },
  ak47: { kick: 0.45, settle: 0.95, bias: 0.55, sway: 0.5, rate: 0.6 },
  ak12: { kick: 0.3, settle: 0.75, bias: -0.25, sway: 0.3, rate: 1.1 },
  galil: { kick: 0.35, settle: 0.85, bias: 0.35, sway: 0.45, rate: 0.7 },
  famas: { kick: 0.15, settle: 0.8, bias: -0.1, sway: 0.65, rate: 1.6 },
  aug: { kick: 0.15, settle: 0.6, bias: 0.05, sway: 0.25, rate: 0.8 },
  g36c: { kick: 0.2, settle: 0.65, bias: -0.2, sway: 0.3, rate: 1.0 },
  asval: { kick: 0.35, settle: 0.9, bias: 0.3, sway: 0.55, rate: 1.4 },
  r4c: { kick: 0.4, settle: 0.9, bias: -0.45, sway: 0.4, rate: 1.2 },
  scarh: { kick: 0.5, settle: 0.95, bias: 0.25, sway: 0.4, rate: 0.5 },
  tri: { kick: 0.3, settle: 0.7, bias: 0, sway: 0.3, rate: 1.3 },
  vector: { kick: 0.05, settle: 0.65, bias: 0, sway: 0.3, rate: 2.2 },
  kestrel: { kick: 0.15, settle: 0.7, bias: 0.2, sway: 0.4, rate: 1.5 },
  mp5: { kick: 0.1, settle: 0.6, bias: -0.1, sway: 0.25, rate: 1.2 },
  ppsh: { kick: 0.2, settle: 0.85, bias: 0.4, sway: 0.7, rate: 2.0 },
  tommy: { kick: 0.4, settle: 0.95, bias: -0.15, sway: 0.35, rate: 0.7 },
  bizon: { kick: 0.1, settle: 0.6, bias: -0.3, sway: 0.35, rate: 1.0 },
  skorpion: { kick: 0.1, settle: 0.8, bias: 0.1, sway: 0.8, rate: 2.6 },
  stinger: { kick: 0.1, settle: 0.85, bias: -0.2, sway: 0.9, rate: 2.4 },
  hammer: { kick: 0.35, settle: 0.8, bias: 0.3, sway: 0.5, rate: 0.6 },
  m249: { kick: 0.25, settle: 0.7, bias: -0.25, sway: 0.55, rate: 0.9 },
  pkm: { kick: 0.45, settle: 0.85, bias: 0.4, sway: 0.45, rate: 0.5 },
};
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
for (const w of Object.values(WEAPONS)) {
  if (w.throwable || w.melee) continue;
  const r = hash(w.id), r2 = hash(w.id + 'x');
  w.rc = RECOIL[w.id] || { kick: 0.15 + r * 0.35, settle: 0.7 + r2 * 0.25, bias: (r2 - 0.5) * 0.8, sway: 0.25 + r * 0.4, rate: 0.6 + r2 * 1.4 };
  w.rc.phase = r * 6.283;
}
// Recoil for shot number n of a spray (0 = first shot): [vertical multiplier, horizontal amount (fraction of kick)]
export function recoilStep(def, n) {
  const p = def.rc; if (!p) return [1, (Math.random() - 0.5) * 0.6];
  const v = p.settle + (1 + p.kick - p.settle) * Math.exp(-n / 4);
  const h = p.bias * Math.min(1, n / 7) + p.sway * Math.sin(n * p.rate + p.phase) * Math.min(1, (n + 1) / 3) + (Math.random() - 0.5) * 0.12;
  return [v, h];
}

// ---------------------------------------------------------------- reload styles (first-person animation)
// insert: push (straight up into the well) · rock (hooked in at the front, rocked back: AK/FAL) · behind (bullpup,
// mag behind the grip) · drum (drum slides out forward) · helical (long mag slides along under the barrel)
// charge: what happens after an empty reload: bolt (pull the bolt/charging handle) · slap (HK slap at the front)
// · release (thumb the bolt release) · slide (rack a pistol slide) · none. roll: which way the gun is turned
// (+ right / - left), tilt: how far it is tipped up, bump: palm-slap the mag home.
const RELOAD = {
  viper: { insert: 'push', charge: 'slide', roll: 0.25, tilt: 0.25, bump: true },
  hawk: { insert: 'push', charge: 'slide', roll: 0.35, tilt: 0.3, bump: true },
  stinger: { insert: 'push', charge: 'slide', roll: -0.3, tilt: 0.2 },
  vector: { insert: 'push', charge: 'bolt', roll: -0.4, tilt: 0.2, bump: true },
  kestrel: { insert: 'push', charge: 'none', roll: 0.3, tilt: 0.15 },
  mp5: { insert: 'push', charge: 'slap', roll: 0.45, tilt: 0.3 },
  ppsh: { insert: 'drum', charge: 'bolt', roll: 0.5, tilt: 0.1 },
  tommy: { insert: 'drum', charge: 'bolt', roll: -0.45, tilt: 0.12 },
  bizon: { insert: 'helical', charge: 'bolt', roll: 0.35, tilt: 0.05 },
  skorpion: { insert: 'push', charge: 'bolt', roll: -0.35, tilt: 0.3 },
  falcon: { insert: 'push', charge: 'release', roll: 0.35, tilt: 0.22, bump: true },
  tri: { insert: 'push', charge: 'release', roll: 0.3, tilt: 0.25, bump: true },
  r4c: { insert: 'push', charge: 'release', roll: -0.32, tilt: 0.2, bump: true },
  ak47: { insert: 'rock', charge: 'bolt', roll: 0.55, tilt: 0.18 },
  ak12: { insert: 'rock', charge: 'bolt', roll: 0.4, tilt: 0.2 },
  galil: { insert: 'rock', charge: 'bolt', roll: -0.45, tilt: 0.16 },
  famas: { insert: 'behind', charge: 'bolt', roll: 0.3, tilt: -0.25 },
  aug: { insert: 'behind', charge: 'bolt', roll: -0.35, tilt: -0.3, bump: true },
  g36c: { insert: 'push', charge: 'slap', roll: 0.3, tilt: 0.25, bump: true },
  asval: { insert: 'push', charge: 'bolt', roll: 0.4, tilt: 0.22 },
  scarh: { insert: 'push', charge: 'bolt', roll: -0.38, tilt: 0.22, bump: true },
  fal: { insert: 'rock', charge: 'bolt', roll: -0.3, tilt: 0.2 },
  tcsg: { insert: 'push', charge: 'bolt', roll: 0.35, tilt: 0.25, bump: true },
  scorpion: { insert: 'push', charge: 'bolt', roll: -0.3, tilt: 0.15, bump: true },
  marksman: { insert: 'push', charge: 'release', roll: 0.28, tilt: 0.2, bump: true },
  longbow: { insert: 'push', charge: 'bolt', roll: 0.3, tilt: 0.15, bump: true },
};
for (const w of Object.values(WEAPONS)) {
  if (w.throwable || w.melee) continue;
  const r = hash(w.id + 'r');
  w.rl = RELOAD[w.id] || { insert: 'push', charge: r > 0.5 ? 'bolt' : 'release', roll: (r - 0.5) * 1.0, tilt: 0.2, bump: r > 0.3 };
}
