// maze.js
import { BFS_DIRS } from './constants.js';

export function genMaze(seed, nL, nE, MR, MC, options = {}) {
  const style = options.style || 'standard';
  let s = seed >>> 0;
  function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }

  const g = Array.from({ length: MR }, () => new Array(MC).fill(1));
  g[1][1] = 0;
  const stack = [[1, 1]];
  const dirs = [[0, 2], [2, 0], [0, -2], [-2, 0]];

  // --- Generazione base (recursive backtracker) ---
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const sh = dirs.slice();
    for (let i = sh.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = sh[i]; sh[i] = sh[j]; sh[j] = t;
    }
    let moved = false;
    for (let k = 0; k < sh.length; k++) {
      const dr = sh[k][0], dc = sh[k][1];
      const nr = r + dr, nc = c + dc;
      if (nr > 0 && nr < MR - 1 && nc > 0 && nc < MC - 1 && g[nr][nc] === 1) {
        g[r + dr / 2][c + dc / 2] = 0;
        g[nr][nc] = 0;
        stack.push([nr, nc]);
        moved = true;
        break;
      }
    }
    if (!moved) stack.pop();
  }

  // --- Applica stile ---
  function applyStyle() {
    if (style === 'braided' || style === 'sparse' || style === 'chaotic') {
      const deadEnds = [];
      for (let r = 1; r < MR - 1; r++) {
        for (let c = 1; c < MC - 1; c++) {
          if (g[r][c] !== 0) continue;
          let walls = 0;
          const neighbors = [];
          if (r > 1 && g[r - 1][c] === 1) { walls++; neighbors.push([r - 1, c]); }
          if (r < MR - 2 && g[r + 1][c] === 1) { walls++; neighbors.push([r + 1, c]); }
          if (c > 1 && g[r][c - 1] === 1) { walls++; neighbors.push([r, c - 1]); }
          if (c < MC - 2 && g[r][c + 1] === 1) { walls++; neighbors.push([r, c + 1]); }
          if (walls === 3) deadEnds.push({ r, c, neighbors });
        }
      }
      for (let i = deadEnds.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [deadEnds[i], deadEnds[j]] = [deadEnds[j], deadEnds[i]];
      }
      let toOpen = 0;
      if (style === 'braided') toOpen = Math.floor(deadEnds.length * 0.35);
      else if (style === 'sparse') toOpen = Math.floor(deadEnds.length * 0.55);
      else if (style === 'chaotic') toOpen = Math.floor(deadEnds.length * 0.45);
      for (let i = 0; i < toOpen && i < deadEnds.length; i++) {
        const de = deadEnds[i];
        const wall = de.neighbors[Math.floor(rnd() * de.neighbors.length)];
        g[wall[0]][wall[1]] = 0;
      }
    }

    if (style === 'dense' || style === 'chaotic') {
      const extraWalls = style === 'dense' ? Math.floor((MR * MC) * 0.03) : Math.floor((MR * MC) * 0.02);
      let placed = 0;
      let attempts = 0;
      while (placed < extraWalls && attempts < extraWalls * 10) {
        attempts++;
        const r = 1 + Math.floor(rnd() * (MR - 2));
        const c = 1 + Math.floor(rnd() * (MC - 2));
        if (g[r][c] !== 0) continue;
        if ((r === 1 && c === 1) || (r === MR - 2 && c === MC - 2)) continue;
        if (r === 1 && c === 2) continue;
        if (r === 2 && c === 1) continue;
        let openNeighbors = 0;
        if (g[r - 1][c] === 0) openNeighbors++;
        if (g[r + 1][c] === 0) openNeighbors++;
        if (g[r][c - 1] === 0) openNeighbors++;
        if (g[r][c + 1] === 0) openNeighbors++;
        if (openNeighbors >= 3) {
          g[r][c] = 1;
          placed++;
        }
      }
    }
  }

  applyStyle();

  // --- Piazzamento uscita e partenza ---
  g[1][1] = 4;
  g[MR - 2][MC - 2] = 3;

  // --- Verifica raggiungibilità ---
  function isReachable() {
    const q = [[1, 1]];
    const seen = new Set(['1,1']);
    while (q.length) {
      const [r, c] = q.shift();
      if (r === MR - 2 && c === MC - 2) return true;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= MR || nc < 0 || nc >= MC) continue;
        if (g[nr][nc] === 1) continue;
        const k = nr + ',' + nc;
        if (seen.has(k)) continue;
        seen.add(k);
        q.push([nr, nc]);
      }
    }
    return false;
  }

  if (!isReachable()) {
    let r = 1, c = 1;
    while (r !== MR - 2 || c !== MC - 2) {
      if (c < MC - 2) { c++; if (g[r][c] === 1) g[r][c] = 0; }
      else if (r < MR - 2) { r++; if (g[r][c] === 1) g[r][c] = 0; }
    }
    g[MR - 2][MC - 2] = 3;
    g[1][1] = 4;
  }

  function getReachableWithoutDoor() {
    const q = [[1, 1]];
    const seen = new Set(['1,1']);
    while (q.length) {
      const [r, c] = q.shift();
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= MR || nc < 0 || nc >= MC) continue;
        if (g[nr][nc] === 1 || g[nr][nc] === 3) continue;
        const k = nr + ',' + nc;
        if (seen.has(k)) continue;
        seen.add(k);
        q.push([nr, nc]);
      }
    }
    return seen;
  }

  const reachable = getReachableWithoutDoor();

  // --- Candidati per nemici e foglie ---
  const vp = [];
  for (let r = 1; r < MR - 1; r++) {
    for (let c = 1; c < MC - 1; c++) {
      if (g[r][c] === 0 && reachable.has(r + ',' + c)) {
        let w = 0;
        if (g[r - 1][c] === 1) w++;
        if (g[r + 1][c] === 1) w++;
        if (g[r][c - 1] === 1) w++;
        if (g[r][c + 1] === 1) w++;
        vp.push({ r, c, w });
      }
    }
  }
  vp.sort((a, b) => (b.w - a.w) || ((b.r + b.c) - (a.r + a.c)));

  const ex = new Set();
  const addEx = (r, c) => {
    ex.add(r + ',' + c); ex.add((r - 1) + ',' + c); ex.add((r + 1) + ',' + c);
    ex.add(r + ',' + (c - 1)); ex.add(r + ',' + (c + 1));
  };
  addEx(1, 1);
  addEx(MR - 2, MC - 2);

  const cand = vp.filter(p => !ex.has(p.r + ',' + p.c));
  const isOpp = (p) => (p.r + p.c) >= (MR + MC) / 2;
  cand.sort((a, b) => {
    const ao = isOpp(a) ? 1 : 0, bo = isOpp(b) ? 1 : 0;
    if (bo !== ao) return bo - ao;
    return (b.w - a.w) || ((b.r + b.c) - (a.r + a.c));
  });

  // ✅ FIX SPAWN — Zona di esclusione dedicata ai nemici (raggio 4 dal via)
  // Impedisce ai fantasmi di spawnare addosso al giocatore nei primi secondi.
  const enemyEx = new Set();
  const ENEMY_EXCL_RADIUS = 4;
  for (let dr = -ENEMY_EXCL_RADIUS; dr <= ENEMY_EXCL_RADIUS; dr++) {
    for (let dc = -ENEMY_EXCL_RADIUS; dc <= ENEMY_EXCL_RADIUS; dc++) {
      if (Math.abs(dr) + Math.abs(dc) <= ENEMY_EXCL_RADIUS) {
        enemyEx.add((1 + dr) + ',' + (1 + dc));
      }
    }
  }
  const enemyCand = cand.filter(p => !enemyEx.has(p.r + ',' + p.c));

  const usedForEnemies = new Set();
  let i = 0;
  for (let k = 0; k < nE && i < enemyCand.length; k++, i++) {
    const p = enemyCand[i];
    g[p.r][p.c] = 7;
    usedForEnemies.add(p.r + ',' + p.c);
  }

  // --- Foglie ---
  const leafPool = cand.filter(p => !usedForEnemies.has(p.r + ',' + p.c));
  const quadOf = (p) => (p.r < MR / 2 ? 0 : 2) + (p.c < MC / 2 ? 0 : 1);
  const quads = [[], [], [], []];
  for (const p of leafPool) quads[quadOf(p)].push(p);

  const pickedLeaves = [];
  const minDist = nL <= 4 ? 7 : (nL <= 6 ? 5 : 4);
  const isFarEnough = (p, list) => list.every(q => Math.abs(p.r - q.r) + Math.abs(p.c - q.c) >= minDist);
  const farFromStart = (p) => (Math.abs(p.r - 1) + Math.abs(p.c - 1)) >= 3;

  const order = [1, 3, 2, 0];
  let safety = 0;
  while (pickedLeaves.length < nL && safety < 500) {
    safety++;
    let progressed = false;
    for (const q of order) {
      if (pickedLeaves.length >= nL) break;
      const pool = quads[q];
      if (!pool || pool.length === 0) continue;
      let candidate = null;
      for (const p of pool) {
        if (pickedLeaves.includes(p)) continue;
        if (!farFromStart(p)) continue;
        if (isFarEnough(p, pickedLeaves)) { candidate = p; break; }
      }
      if (!candidate) {
        for (const p of pool) {
          if (pickedLeaves.includes(p)) continue;
          if (isFarEnough(p, pickedLeaves)) { candidate = p; break; }
        }
      }
      if (!candidate) {
        for (const p of pool) {
          if (pickedLeaves.includes(p)) continue;
          candidate = p; break;
        }
      }
      if (candidate) { pickedLeaves.push(candidate); progressed = true; }
    }
    if (!progressed) break;
  }

  if (pickedLeaves.length < nL) {
    for (let r = 1; r < MR - 1 && pickedLeaves.length < nL; r++) {
      for (let c = 1; c < MC - 1 && pickedLeaves.length < nL; c++) {
        if (g[r][c] !== 0) continue;
        if (!reachable.has(r + ',' + c)) continue;
        if (ex.has(r + ',' + c)) continue;
        if (pickedLeaves.some(p => p.r === r && p.c === c)) continue;
        pickedLeaves.push({ r, c });
      }
    }
  }

  for (const p of pickedLeaves) g[p.r][p.c] = 2;

  // --- Forzieri nei vicoli ciechi rimanenti ---
  const deads = [];
  for (let r = 1; r < MR - 1; r++) {
    for (let c = 1; c < MC - 1; c++) {
      if (g[r][c] !== 0) continue;
      if (!reachable.has(r + ',' + c)) continue;
      if (ex.has(r + ',' + c)) continue;
      let n = 0;
      if (g[r - 1][c] !== 1 && g[r - 1][c] !== 3) n++;
      if (g[r + 1][c] !== 1 && g[r + 1][c] !== 3) n++;
      if (g[r][c - 1] !== 1 && g[r][c - 1] !== 3) n++;
      if (g[r][c + 1] !== 1 && g[r][c + 1] !== 3) n++;
      if (n === 1) deads.push([r, c]);
    }
  }
  for (let k = deads.length - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    const t = deads[k]; deads[k] = deads[j]; deads[j] = t;
  }
  const rewards = ['heart', 'shield', 'ammo'];
  const chests = [];
  const nC = Math.min(3, deads.length);
  for (let k = 0; k < nC; k++) {
    const [r, c] = deads[k];
    if (g[r][c] !== 0) continue;
    g[r][c] = 5;
    const reward = rewards[Math.floor(rnd() * rewards.length)];
    chests.push({ r, c, reward });
  }

  return { g, chests, reachable };
}

export function genCoins(maze, pickupKeys, reachableSet, MR, MC, maxCoins = Infinity) {
  const cells = [];
  for (let r = 1; r < MR - 1; r++) {
    for (let c = 1; c < MC - 1; c++) {
      if (maze[r][c] !== 0) continue;
      const k = r + ',' + c;
      if (pickupKeys.has(k)) continue;
      if (reachableSet && !reachableSet.has(k)) continue;
      cells.push([r, c]);
    }
  }
  if (maxCoins !== Infinity && cells.length > maxCoins) {
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    cells.length = maxCoins;
  }
  return cells;
}

let _bfsGen = 0;
let _bfsVisited = null;
let _bfsPrevR = null;
let _bfsPrevC = null;
let _bfsQr = null;
let _bfsQc = null;

export function initBFS(MR, MC) {
  _bfsVisited = Array.from({ length: MR }, () => new Int32Array(MC));
  _bfsPrevR = new Int16Array(MR * MC);
  _bfsPrevC = new Int16Array(MR * MC);
  _bfsQr = new Int16Array(MR * MC);
  _bfsQc = new Int16Array(MR * MC);
}

export function bfsStep(from, to, maze, enemies, MR, MC) {
  if (from.r === to.r && from.c === to.c) return null;
  _bfsGen++;
  const gen = _bfsGen;
  let qHead = 0, qTail = 0;
  _bfsQr[qTail] = from.r; _bfsQc[qTail] = from.c; qTail++;
  _bfsVisited[from.r][from.c] = gen;

  while (qHead < qTail) {
    const r = _bfsQr[qHead], c = _bfsQc[qHead]; qHead++;
    if (r === to.r && c === to.c) break;
    for (let i = 0; i < 4; i++) {
      const nr = r + BFS_DIRS[i][0], nc = c + BFS_DIRS[i][1];
      if (nr < 0 || nr >= MR || nc < 0 || nc >= MC) continue;
      if (_bfsVisited[nr][nc] === gen) continue;
      const v = maze[nr][nc];
      if (v === 1) continue;
      if (!(nr === to.r && nc === to.c)) {
        if (enemies.some(o => o !== from && o.alive && !o.dying && o.r === nr && o.c === nc)) continue;
      }
      _bfsVisited[nr][nc] = gen;
      const idx = nr * MC + nc;
      _bfsPrevR[idx] = r; _bfsPrevC[idx] = c;
      _bfsQr[qTail] = nr; _bfsQc[qTail] = nc; qTail++;
    }
  }

  if (_bfsVisited[to.r][to.c] !== gen) return null;
  let curR = to.r, curC = to.c;
  while (true) {
    const idx = curR * MC + curC;
    const pr = _bfsPrevR[idx], pc = _bfsPrevC[idx];
    if (pr === from.r && pc === from.c) return [curR, curC];
    curR = pr; curC = pc;
  }
}