// game/level-loader.js
import { MR, MC, START_AMMO } from '../constants.js';
import { genMaze, genCoins } from '../maze.js';
import {
  loadCustomLevel, applyCustomLevelToGrid, computeReachableSet,
  buildPickupKeys, pickHeartPositions
} from '../customLevels.js';

export function loadLevelData(G) {
  const { levelNum, LEVEL, baseILevel, leavesLevel, ammoLevel } = G;
  const customLevel = loadCustomLevel(levelNum);

  let maze, leavesData, ghostsData, chestsData, heartPositions, coinsData, reachableNoDoor;
  let startR = 1, startC = 1, exitR = MR - 2, exitC = MC - 2;

  if (customLevel) {
    maze = Array.from({ length: MR }, () => new Array(MC).fill(1));
    applyCustomLevelToGrid(customLevel, maze, MR, MC);

    for (let r = 0; r < MR; r++) for (let c = 0; c < MC; c++) {
      if (maze[r][c] === 4) { startR = r; startC = c; }
      if (maze[r][c] === 3) { exitR  = r; exitC  = c; }
    }
    reachableNoDoor = computeReachableSet(maze, MR, MC, startR, startC, true);

    const occupied = new Set();
    const isFreeCell = (r, c) =>
      r >= 0 && r < MR && c >= 0 && c < MC &&
      maze[r][c] === 0 && !occupied.has(r + ',' + c);

    leavesData = (customLevel.leaves || []).map(([r,c]) => ({ r, c })).filter(({r,c}) => isFreeCell(r,c));
    leavesData.forEach(({r,c}) => occupied.add(r + ',' + c));

    ghostsData = (customLevel.ghosts || [])
      .map(g => ({ r:g.r, c:g.c, type:g.type || 'hunter' }))
      .filter(g => isFreeCell(g.r, g.c));
    ghostsData.forEach(g => occupied.add(g.r + ',' + g.c));

    chestsData = (customLevel.chests || [])
      .map(ch => ({ r:ch.r, c:ch.c, reward:ch.reward || 'heart' }))
      .filter(ch => isFreeCell(ch.r, ch.c));
    chestsData.forEach(ch => occupied.add(ch.r + ',' + ch.c));

    heartPositions = (customLevel.hearts || []).map(([r,c]) => [r,c]).filter(([r,c]) => isFreeCell(r,c));
    heartPositions.forEach(([r,c]) => occupied.add(r + ',' + c));

    const customCoins = (customLevel.coins || []).map(([r,c]) => [r,c]).filter(([r,c]) => isFreeCell(r,c));
    customCoins.forEach(([r,c]) => occupied.add(r + ',' + c));

    if (customCoins.length > 0) {
      coinsData = customCoins;
    } else {
      const pickupKeys = buildPickupKeys(customLevel);
      coinsData = genCoins(maze, pickupKeys, reachableNoDoor, MR, MC);
    }

    if (heartPositions.length === 0) {
      const pickupKeys = buildPickupKeys(customLevel);
      for (const [r,c] of coinsData) pickupKeys.add(r + ',' + c);
      heartPositions = pickHeartPositions(maze, pickupKeys, reachableNoDoor, MR, MC, 2, LEVEL.seed)
        .map(h => [h.r, h.c]);
    }
  } else {
    const mazeResult = genMaze(LEVEL.seed, leavesLevel, LEVEL.enemies, MR, MC, { style: G.mazeStyle });
    maze = mazeResult.g;
    reachableNoDoor = mazeResult.reachable || null;

    leavesData = []; ghostsData = [];
    const pickupKeys = new Set();
    for (let r = 0; r < MR; r++) for (let c = 0; c < MC; c++) {
      if (maze[r][c] === 2)      { leavesData.push({ r, c }); pickupKeys.add(r+','+c); maze[r][c] = 0; }
      else if (maze[r][c] === 7) { ghostsData.push({ r, c }); pickupKeys.add(r+','+c); maze[r][c] = 0; }
      else if (maze[r][c] === 4 || maze[r][c] === 3) { pickupKeys.add(r+','+c); }
    }
    chestsData = mazeResult.chests;
    for (const ch of chestsData) { maze[ch.r][ch.c] = 5; pickupKeys.add(ch.r+','+ch.c); }

    heartPositions = [];
    {
      const free = [];
      for (let r = 1; r < MR - 1; r++) for (let c = 1; c < MC - 1; c++) {
        if (maze[r][c] !== 0) continue;
        if (pickupKeys.has(r+','+c)) continue;
        if (reachableNoDoor && !reachableNoDoor.has(r+','+c)) continue;
        if (Math.abs(r-1) + Math.abs(c-1) < 4) continue;
        free.push([r,c]);
      }
      let rngState = Number(LEVEL.seed) || 12345;
      const random = () => (rngState = (rngState*9301 + 49297) % 233280) / 233280;
      for (let i = free.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [free[i], free[j]] = [free[j], free[i]];
      }
      const nHearts = Math.min(2, free.length);
      for (let i = 0; i < nHearts; i++) {
        const [r,c] = free[i];
        pickupKeys.add(r + ',' + c);
        heartPositions.push([r,c]);
      }
    }
    coinsData = genCoins(maze, pickupKeys, reachableNoDoor, MR, MC);
  }

  return { maze, leavesData, ghostsData, chestsData, heartPositions, coinsData,
           reachableNoDoor, startR, startC, exitR, exitC };
}

export function verifyNoOverlaps(G) {
  const occ = new Map();
  let issues = 0;
  const check = (r,c,label) => {
    const k = r + ',' + c;
    if (occ.has(k)) { console.warn(`[OVERLAP] ${label} @ (${r},${c}) collide con ${occ.get(k)}`); issues++; }
    else occ.set(k, label);
  };
  check(G.startR, G.startC, 'START');
  check(G.exitR,  G.exitC,  'EXIT');
  for (const ld of G.leavesData) check(ld.r, ld.c, 'LEAF');
  for (const g  of G.ghostsData) check(g.r, g.c, 'GHOST');
  for (const ch of G.chestsData) check(ch.r, ch.c, 'CHEST');
  for (const [r,c] of G.heartPositions) check(r,c,'HEART');
  for (const [r,c] of G.coinsData)      check(r,c,'COIN');
  if (issues > 0) console.warn(`[SAFETY NET] ${issues} sovrapposizioni nel livello ${G.levelNum}.`);
}