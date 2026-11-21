// customLevels.js
import { BFS_DIRS } from './constants.js';

const STORAGE_KEY = 'labirinto_custom_levels';

export function loadAllCustomLevels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (_) {
    return {};
  }
}

export function loadCustomLevel(levelIndex) {
  const all = loadAllCustomLevels();
  const data = all[levelIndex];
  if (!data || !Array.isArray(data.walls) || data.walls.length === 0) return null;
  return data;
}

export function saveCustomLevel(levelIndex, data) {
  const all = loadAllCustomLevels();
  all[levelIndex] = data;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch (_) {}
}

export function removeCustomLevel(levelIndex) {
  const all = loadAllCustomLevels();
  delete all[levelIndex];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch (_) {}
}

export function applyCustomLevelToGrid(custom, maze, MR, MC) {
  for (let r = 0; r < MR; r++) {
    const row = (custom.walls && custom.walls[r]) ? custom.walls[r] : '';
    for (let c = 0; c < MC; c++) {
      maze[r][c] = row[c] === '1' ? 1 : 0;
    }
  }
  
  // Controllo di sicurezza per la partenza
  let sr = 1, sc = 1;
  if (custom.start && custom.start.length === 2) {
    const tr = parseInt(custom.start[0], 10);
    const tc = parseInt(custom.start[1], 10);
    if (!isNaN(tr) && !isNaN(tc) && tr > 0 && tr < MR - 1 && tc > 0 && tc < MC - 1) {
      sr = tr; sc = tc;
    }
  }
  maze[sr][sc] = 4;

  // Controllo di sicurezza per l'uscita
  let er = MR - 2, ec = MC - 2;
  if (custom.exit && custom.exit.length === 2) {
    const tr = parseInt(custom.exit[0], 10);
    const tc = parseInt(custom.exit[1], 10);
    if (!isNaN(tr) && !isNaN(tc) && tr > 0 && tr < MR - 1 && tc > 0 && tc < MC - 1) {
      er = tr; ec = tc;
    }
  }
  maze[er][ec] = 3;
}

export function computeReachableSet(maze, MR, MC, startR, startC, ignoreExit = true) {
  const seen = new Set();
  if (startR < 0 || startR >= MR || startC < 0 || startC >= MC) return seen;

  const q = [[startR, startC]];
  seen.add(startR + ',' + startC);
  while (q.length) {
    const [r, c] = q.shift();
    for (const [dr, dc] of BFS_DIRS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= MR || nc < 0 || nc >= MC) continue;
      if (maze[nr][nc] === 1) continue;
      if (ignoreExit && maze[nr][nc] === 3) continue;
      const k = nr + ',' + nc;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([nr, nc]);
    }
  }
  return seen;
}

export function buildPickupKeys(custom) {
  const set = new Set();
  const add = (r, c) => set.add(r + ',' + c);
  (custom.leaves || []).forEach(([r, c]) => add(r, c));
  (custom.ghosts || []).forEach(g => add(g.r, g.c));
  (custom.chests || []).forEach(ch => add(ch.r, ch.c));
  (custom.hearts || []).forEach(([r, c]) => add(r, c));
  (custom.coins || []).forEach(([r, c]) => add(r, c));
  if (custom.start) add(custom.start[0], custom.start[1]);
  if (custom.exit) add(custom.exit[0], custom.exit[1]);
  return set;
}

// ✅ FIX DETERMINISMO — accetta un `seed` opzionale; se fornito, usa RNG
// deterministico identico a quello di game.js/maze.js. Così i cuori generati
// automaticamente per un livello custom (senza hearts definiti) finiscono
// sempre nelle stesse celle, partita dopo partita.
export function pickHeartPositions(maze, pickupKeys, reachableSet, MR, MC, count = 2, seed = 12345) {
  let rngState = (seed >>> 0) || 12345;
  const rnd = () => {
    rngState = (rngState * 9301 + 49297) % 233280;
    return rngState / 233280;
  };

  const free = [];
  for (let r = 1; r < MR - 1; r++) {
    for (let c = 1; c < MC - 1; c++) {
      if (maze[r][c] !== 0) continue;
      if (pickupKeys.has(r + ',' + c)) continue;
      if (reachableSet && !reachableSet.has(r + ',' + c)) continue;
      if ((Math.abs(r - 1) + Math.abs(c - 1)) < 4) continue;
      free.push([r, c]);
    }
  }
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  return free.slice(0, Math.min(count, free.length)).map(([r, c]) => ({ r, c }));
}