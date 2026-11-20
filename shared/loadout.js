// Perks (one per slot, three slots) and killstreaks (pick three, earned by kills in one life, activated by the
// player when ready). Shared by the client (Armory, effects, HUD) and the server (validation, effects).

export const PERKS = {
  1: [
    { id: 'scavenger', name: 'Scavenger', desc: 'Every kill refills a magazine of reserve ammo and gives back a lethal', lvl: 1 },
    { id: 'lightweight', name: 'Lightweight', desc: '+7% movement speed and no fall damage', lvl: 6 },
    { id: 'flak', name: 'Flak Jacket', desc: '-45% damage from explosions and fire', lvl: 12 },
  ],
  2: [
    { id: 'quickhands', name: 'Quick Hands', desc: '-25% reload time and faster weapon swaps', lvl: 1 },
    { id: 'stopping', name: 'Stopping Power', desc: '+15% bullet damage', lvl: 4 },
    { id: 'hardline', name: 'Hardline', desc: 'Killstreaks need one kill fewer', lvl: 15 },
  ],
  3: [
    { id: 'steadyaim', name: 'Steady Aim', desc: '-35% hip-fire spread and -15% recoil', lvl: 1 },
    { id: 'ghost', name: 'Ghost', desc: 'Hidden from enemy Radar, and firing does not show you on enemy minimaps', lvl: 9 },
    { id: 'coldblood', name: 'Cold-Blooded', desc: 'Enemies cannot see your name tag', lvl: 18 },
  ],
};
export const PERK_IDS = Object.values(PERKS).flat().map(p => p.id);
export const perkInfo = id => Object.values(PERKS).flat().find(p => p.id === id);

export const STREAKS = {
  radar: { name: 'Radar', kills: 4, lvl: 1, desc: 'Shows enemies on your team\'s minimaps for 25 s' },
  armor: { name: 'Armor Up', kills: 5, lvl: 1, desc: 'Body armour that soaks up the next 60 damage' },
  jammer: { name: 'Jammer', kills: 6, lvl: 8, desc: 'Scrambles enemy minimaps for 20 s' },
  airstrike: { name: 'Airstrike', kills: 7, lvl: 1, desc: 'Bombs drop on enemy positions' },
  mortar: { name: 'Mortar Barrage', kills: 8, lvl: 14, desc: 'Six shells land where you are aiming' },
  aradar: { name: 'Advanced Radar', kills: 10, lvl: 22, desc: 'Shows every enemy, even Ghosts, for 40 s' },
};
export const STREAK_IDS = Object.keys(STREAKS);
export const DEFAULT_PERKS = ['scavenger', 'quickhands', 'steadyaim'];
export const DEFAULT_STREAKS = ['radar', 'armor', 'airstrike'];
export const streakCost = (id, perks = []) => Math.max(2, STREAKS[id].kills - (perks.includes('hardline') ? 1 : 0));

// Validate a loadout sent by a player: one perk per slot, three different killstreaks.
export function cleanPerks(list) {
  const out = [];
  for (let s = 1; s <= 3; s++) { const id = Array.isArray(list) ? list[s - 1] : null; out.push(PERKS[s].some(p => p.id === id) ? id : DEFAULT_PERKS[s - 1]); }
  return out;
}
export function cleanStreaks(list) {
  const out = (Array.isArray(list) ? list : []).filter((id, i, a) => STREAKS[id] && a.indexOf(id) === i).slice(0, 3);
  for (const d of DEFAULT_STREAKS) if (out.length < 3 && !out.includes(d)) out.push(d);
  return out.sort((a, b) => STREAKS[a].kills - STREAKS[b].kills);
}
