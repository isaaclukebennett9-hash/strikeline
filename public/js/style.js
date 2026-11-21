// Graphics style, read once at start-up so every module builds the same look:
// 'realistic' (default: organic soldiers, weathered surfaces, cinematic colour grade) or 'classic' (the original
// blocky look, lighter on weak laptops). Changing it in Settings reloads the game.
import { store } from './progress.js';

export const STYLE = (() => {
  try { return JSON.parse(store.get('strikeline') || '{}').style === 'classic' ? 'classic' : 'realistic'; } catch { return 'realistic'; }
})();
export const REAL = STYLE === 'realistic';
