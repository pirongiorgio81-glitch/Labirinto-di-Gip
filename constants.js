// constants.js
export const MR = 21, MC = 29, CS = 1.8;
export const MAX_HP = 99, MAX_SH = 99, MAX_AM = 99;
export const START_HP = 3;
export const START_AMMO = 3;
export const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const BFS_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export const DIFFICULTY_KEY = 'labirinto_difficulty';
export const MAX_LEVELS = { facile: 5, normale: 10, difficile: 15 };

export function getDifficulty() {
  try {
    const d = localStorage.getItem(DIFFICULTY_KEY);
    if (d === 'normale' || d === 'difficile') return d;
  } catch (_) {}
  return 'facile';
}

export function getMaxLevel() {
  return MAX_LEVELS[getDifficulty()] || 5;
}