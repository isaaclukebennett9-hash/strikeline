// Game modes shared by client and server.
export const MODES = {
  ffa: { name: 'Free For All', short: 'FFA', teams: false, desc: 'Every operator for themselves. First to the kill limit wins.' },
  dm: { name: 'Deathmatch', short: 'DM', teams: false, desc: 'Classic deathmatch. No kill limit — most kills when the timer runs out wins.' },
  tdm: { name: 'Team Deathmatch', short: 'TDM', teams: true, desc: 'Alpha vs Bravo. First squad to the kill limit wins.' },
  kc: { name: 'Kill Confirmed', short: 'KC', teams: true, desc: 'Kills drop dog tags. Grab enemy tags to score, grab your team\'s to deny.' },
  gungame: { name: 'Gun Game', short: 'GUN', teams: false, desc: 'Each kill upgrades your gun. Get a kill with every weapon to win. Knife kills demote.' },
  infected: { name: 'Infected', short: 'INF', teams: true, desc: 'One player starts infected. Every survivor they knife joins the horde. Survive until the timer ends!' },
  roulette: { name: 'Gun Roulette', short: 'ROUL', teams: false, desc: 'Everyone gets the same random gun, and it changes every 45 seconds. First to the kill limit wins.' },
  hardpoint: { name: 'Hardpoint', short: 'HP', teams: true, desc: 'Stand in the zone to score for your team. The zone moves every 60 seconds.' },
};
export const MODE_ORDER = ['ffa', 'dm', 'tdm', 'kc', 'gungame', 'roulette', 'hardpoint', 'infected'];
export const TEAM_NAMES = ['ALPHA', 'BRAVO'];
export const TEAM_COLORS = ['#3d8bff', '#ff4a4a'];
export const teamName = (mode, t) => (mode === 'infected' ? ['SURVIVORS', 'INFECTED'] : TEAM_NAMES)[t] || '';
export const teamColor = (mode, t) => (mode === 'infected' ? ['#3d8bff', '#7dff3a'] : TEAM_COLORS)[t] || '#ffffff';
export const PICKUP_RESPAWN = { health: 15, ammo: 20, damage: 60, speed: 45 };
export const POWER_TIME = 15;
export const GUNGAME_LADDER = ['viper', 'sawedoff', 'magnum', 'skorpion', 'ppsh', 'mp5', 'ksg', 'dbarrel', 'ak47', 'famas', 'scarh', 'm249', 'kar98', 'flamer', 'thumper', 'knife'];
// Gun Roulette: the gun everyone holds, swapped for a different one every ROULETTE_TIME seconds
export const ROULETTE_POOL = ['viper', 'magnum', 'hawk', 'sawedoff', 'stinger', 'vector', 'mp5', 'ppsh', 'tommy', 'bizon', 'ak47', 'famas', 'scarh', 'aug', 'galil',
  'm249', 'mg42', 'ksg', 'dbarrel', 'spas12', 'kar98', 'marksman', 'longbow', 'garand', 'flamer', 'thumper', 'dartsniper', 'dartshotgun', 'fal', 'asval'];
export const ROULETTE_TIME = 45;
export const HARDPOINT_MULT = 8;     // hardpoint target = scoreLimit * 8 points
export const ZONE_RADIUS = 4.5;
export const ZONE_MOVE = 60;

export function targetScore(mode, scoreLimit) {
  if (mode === 'dm' || mode === 'infected') return 0; // no limit, timer only
  if (mode === 'gungame') return GUNGAME_LADDER.length;
  if (mode === 'hardpoint') return scoreLimit * HARDPOINT_MULT;
  return scoreLimit;
}
