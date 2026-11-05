// game.js
import * as THREE from 'three';
import { LEVELS } from './levels.js';
import { MR, MC, CS, MAX_HP, MAX_SH, MAX_AM, START_HP, START_AMMO, REDUCED_MOTION, getDifficulty, getMaxLevel } from './constants.js';
import { AudioManager } from './audio.js';
import { genMaze, genCoins, initBFS, bfsStep } from './maze.js';
import * as Textures from './textures.js';
import * as Entities from './entities.js';
import * as UI from './ui.js';
import * as Save from './save.js';
import { setupControls } from './controls.js';

export function initGame(levelNum) {
  const difficulty = getDifficulty();
  const maxLevel = getMaxLevel();

  if (levelNum < 1 || levelNum > maxLevel) {
    window.location.replace('index.html');
    return;
  }

  const baseLevel = LEVELS[levelNum];
  if (!baseLevel) throw new Error('Livello inesistente: ' + levelNum);

  const isLast = levelNum === maxLevel;
  const LEVEL = { ...baseLevel, isLast };

  const baseILevel = LEVEL.baseI;
  const leavesLevel = LEVEL.leaves;
  const ammoLevel = LEVEL.startAmmo || START_AMMO;
  const enemiesCanShoot = levelNum >= 8;
  const mazeStyle = LEVEL.style || 'standard';

  let introDone = false;

  const audio = new AudioManager();
  UI.buildDOM(LEVEL, START_HP, START_AMMO);
  initBFS(MR, MC);

  const mazeResult = genMaze(LEVEL.seed, leavesLevel, LEVEL.enemies, MR, MC, { style: mazeStyle });
  const maze = mazeResult.g;
  const reachableNoDoor = mazeResult.reachable || null;

  const leavesData = [], ghostsData = [], pickupKeys = new Set();
  for (let r = 0; r < MR; r++) {
    for (let c = 0; c < MC; c++) {
      if (maze[r][c] === 2) { leavesData.push({ r, c }); pickupKeys.add(r + ',' + c); maze[r][c] = 0; }
      else if (maze[r][c] === 7) { ghostsData.push({ r, c }); pickupKeys.add(r + ',' + c); maze[r][c] = 0; }
      else if (maze[r][c] === 4 || maze[r][c] === 3) { pickupKeys.add(r + ',' + c); }
    }
  }
  const chestsData = mazeResult.chests;
  for (const ch of chestsData) { maze[ch.r][ch.c] = 5; pickupKeys.add(ch.r + ',' + ch.c); }
  const coinsData = genCoins(maze, pickupKeys, reachableNoDoor, MR, MC);

  const canvas = document.getElementById('game');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } catch (err) {
    document.getElementById('webgl-missing').style.display = 'flex';
    document.getElementById('lm').style.display = 'none';
    throw new Error('WebGL non supportato');
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a0010);
  scene.fog = new THREE.Fog(0x1a0010, 24, 80);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(1 * CS - 6.5, 18, 1 * CS + 13);
  camera.lookAt(1 * CS, 1, 1 * CS);

  scene.add(new THREE.AmbientLight(0xe0c8d5, 1.0));
  const dLight = new THREE.DirectionalLight(0xfff4ec, 2.0); dLight.position.set(20, 40, 14); scene.add(dLight);
  const dLight2 = new THREE.DirectionalLight(0xffe0e8, 0.8); dLight2.position.set(-18, 30, -12); scene.add(dLight2);
  const pLightPurple = new THREE.PointLight(0xd880a8, 0.75, 140); pLightPurple.position.set((MC * CS) / 2, 22, (MR * CS) / 2); scene.add(pLightPurple);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(250, 250), new THREE.MeshStandardMaterial({ map: Textures.makeFloorTexture(), roughness: 0.88, metalness: 0.06 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(((MC - 1) * CS) / 2, 0, ((MR - 1) * CS) / 2);
  scene.add(floor);

  const wallPositions = [];
  for (let r = 0; r < MR; r++) for (let c = 0; c < MC; c++) if (maze[r][c] === 1) wallPositions.push([r, c]);
  
  const wallGeo = new THREE.BoxGeometry(CS, CS * 1.05, CS);
  const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.12, emissive: 0x1a0010, emissiveIntensity: 0.15 });
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, wallPositions.length);
  walls.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const tmpCol = new THREE.Color();
  const dummy = new THREE.Object3D();
  for (let k = 0; k < wallPositions.length; k++) {
    const [r, c] = wallPositions[k];
    dummy.position.set(c * CS, CS * 0.525, r * CS);
    dummy.updateMatrix();
    walls.setMatrixAt(k, dummy.matrix);
    tmpCol.setHSL((0.92 + r * 0.009 + c * 0.006) % 1, 0.5, 0.36);
    walls.setColorAt(k, tmpCol);
  }
  walls.instanceMatrix.needsUpdate = true;
  if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
  scene.add(walls);

  const playerGroup = new THREE.Group();
  scene.add(playerGroup);
  const playerLight = new THREE.PointLight(0xff4d88, 0.85, 18, 2); playerLight.position.set(0, 1.5, 0); playerGroup.add(playerLight);

  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: Textures.makeContactTexture(), transparent: true, depthWrite: false, opacity: 0.75 }));
  contactShadow.rotation.x = -Math.PI / 2; contactShadow.position.set(0, 0.04, 0); playerGroup.add(contactShadow);

  const dirShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({
      map: Textures.makeDirectionalShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.6
    })
  );
  dirShadow.rotation.x = -Math.PI / 2;
  dirShadow.position.set(0, 0.035, 0.9);
  playerGroup.add(dirShadow);

  const shieldAura = new THREE.Sprite(new THREE.SpriteMaterial({ map: Textures.makeShieldTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
  shieldAura.scale.set(2.4, 2.4, 1); shieldAura.position.y = 1.0; shieldAura.visible = false; playerGroup.add(shieldAura);

  Entities.loadGipModel(playerGroup, 2.5, 0.1);

  const coinTex = Textures.makeCoinTexture();
  const coins = coinsData.map(([r, c]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: coinTex, transparent: true, depthWrite: false, opacity: 0.95 }));
    sp.scale.set(0.46, 0.46, 1); sp.position.set(c * CS, 0.55, r * CS); scene.add(sp);
    return { r, c, sprite: sp, taken: false, phase: (r * 13 + c * 7) % 100 };
  });

  const leafTex = Textures.makeLeafTexture();
  const leaves = leavesData.map(ld => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: leafTex, transparent: true, depthWrite: false }));
    sp.scale.set(1.0, 1.0, 1); sp.position.set(ld.c * CS, 0.85, ld.r * CS); scene.add(sp);
    return { r: ld.r, c: ld.c, sprite: sp, taken: false };
  });

  const heartTex = Textures.makeHeartPickupTexture();
  const hearts = [];
  {
    const free = [];
    for (let r = 1; r < MR - 1; r++) {
      for (let c = 1; c < MC - 1; c++) {
        if (maze[r][c] !== 0 || pickupKeys.has(r + ',' + c) || (reachableNoDoor && !reachableNoDoor.has(r + ',' + c)) || coinsData.some(([rr, cc]) => rr === r && cc === c)) continue;
        free.push([r, c]);
      }
    }
    const nHearts = Math.min(2, free.length);
    for (let i = 0; i < nHearts; i++) {
      const idx = Math.floor(Math.random() * free.length);
      const [r, c] = free.splice(idx, 1)[0];
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
      sp.scale.set(0.62, 0.62, 1); sp.position.set(c * CS, 0.6, r * CS); scene.add(sp);
      hearts.push({ r, c, sprite: sp, taken: false });
    }
  }

  const ghostTex = Textures.makeGhostTexture();
  const enemies = ghostsData.map((gd, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ghostTex, transparent: true, depthWrite: false }));
    sp.scale.set(1.25, 1.25, 1); sp.position.set(gd.c * CS, 1.05, gd.r * CS); scene.add(sp);
    const type = (LEVEL.types && LEVEL.types[i]) || 'hunter';
    return {
      r: gd.r, c: gd.c, sprite: sp, alive: true, dying: 0, type,
      hp: type === 'armored' ? 2 : 1, windup: false,
      nextMove: performance.now() + baseILevel, nextWhisper: 0,
      canShoot: enemiesCanShoot,
      nextShoot: performance.now() + baseILevel + 2000 + Math.random() * 1500
    };
  });

  const chests = chestsData.map(ch => {
    const grp = Entities.makeChestMesh();
    grp.position.set(ch.c * CS, 0, ch.r * CS); scene.add(grp);
    return { r: ch.r, c: ch.c, group: grp, reward: ch.reward, opened: false };
  });

  const { doorGroup, doorHinge, doorPanelMat } = Entities.makeDoorGroup(CS, MC, MR);
  scene.add(doorGroup);
  doorGroup.visible = true;
  const closedColor = new THREE.Color(0xc96080);
  const openColor = new THREE.Color(0x00ff88);

  const state = {
    paused: false, gameover: false, won: false, doorOpen: false, moves: 0, elapsed: 0,
    lCol: 0, lTot: leaves.length, shakeT: 0, shakeAmp: 0, coinsLevel: 0, coinsTotal: 0,
    coinToastShown: false, _lastWhisper: 0, _tutorialGhost: false
  };
  
  const player = {
    r: 1, c: 1, x: 1 * CS, z: 1 * CS, fDir: 'down',
    hp: START_HP, shields: 0, ammo: ammoLevel, invulnUntil: 0, lastMelee: 0, lastShoot: 0,
    isMovingTimer: 0
  };

  try {
    const h = parseInt(localStorage.getItem('labirinto_hp') || String(START_HP), 10);
    const s = parseInt(localStorage.getItem('labirinto_shields') || '0', 10);
    const a = parseInt(localStorage.getItem('labirinto_ammo') || String(ammoLevel), 10);
    const cn = parseInt(localStorage.getItem('labirinto_coins') || '0', 10);
    player.hp = Math.min(isNaN(h) || h < 1 ? START_HP : h, MAX_HP);
    player.shields = Math.min(isNaN(s) ? 0 : s, MAX_SH);
    player.ammo = Math.min(isNaN(a) ? ammoLevel : Math.max(a, ammoLevel), MAX_AM);
    state.coinsTotal = isNaN(cn) ? 0 : Math.max(0, cn);
  } catch (e) {}

  const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  const projectiles = [];
  const enemyProjectiles = [];

  function cellFree(r, c) {
    if (r < 0 || r >= MR || c < 0 || c >= MC) return false;
    const v = maze[r][c];
    if (v === 1) return false;
    if (v === 3 && !state.doorOpen) return false;
    return true;
  }

  function pickupsAt(r, c) {
    for (const co of coins) {
      if (!co.taken && co.r === r && co.c === c) {
        co.taken = true; scene.remove(co.sprite); state.coinsLevel++; state.coinsTotal++;
        audio.play('coin'); try { localStorage.setItem('labirinto_coins', String(state.coinsTotal)); } catch(_) {}
        if (!state.coinToastShown) { state.coinToastShown = true; UI.toast('Monete: ' + state.coinsTotal, 1800); }
        UI.updateHUD(player, state); break;
      }
    }
    for (const hc of hearts) {
      if (!hc.taken && hc.r === r && hc.c === c) {
        hc.taken = true; scene.remove(hc.sprite); player.hp = Math.min(MAX_HP, player.hp + 1);
        audio.play('chest'); UI.toast('+1 Vita'); UI.updateHUD(player, state); break;
      }
    }
    for (const lf of leaves) {
      if (!lf.taken && lf.r === r && lf.c === c) {
        lf.taken = true; scene.remove(lf.sprite); state.lCol++;
        audio.play('leaf'); UI.toast('Foglia ' + state.lCol + '/' + state.lTot); UI.updateHUD(player, state);
        if (state.lCol >= state.lTot) openDoor(); break;
      }
    }
    for (const ch of chests) {
      if (!ch.opened && ch.r === r && ch.c === c) {
        ch.opened = true; scene.remove(ch.group);
        if (ch.reward === 'heart') { player.hp = Math.min(MAX_HP, player.hp + 1); UI.toast('+1 Vita'); }
        else if (ch.reward === 'shield') { player.shields = Math.min(MAX_SH, player.shields + 1); UI.toast('+1 Scudo'); }
        else { player.ammo = Math.min(MAX_AM, player.ammo + 3); UI.toast('+3 Munizioni'); }
        audio.play('chest'); UI.updateHUD(player, state); break;
      }
    }
    if (maze[r][c] === 3 && state.doorOpen) winLevel();
  }

  function tryMove(dir) {
    if (!introDone || state.paused || state.gameover || state.won) return;
    if (!DIRS[dir]) return;
    const [dr, dc] = DIRS[dir];
    player.fDir = dir;
    const nr = player.r + dr, nc = player.c + dc;
    const en = enemies.find(e => e.alive && !e.dying && e.r === nr && e.c === nc);
    if (en) { melee(performance.now()); return; }
    if (!cellFree(nr, nc)) { audio.play('bump'); return; }
    player.r = nr; player.c = nc; state.moves++; 
    player.isMovingTimer = 0.22;
    UI.updateHUD(player, state); pickupsAt(nr, nc);
  }

  function openDoor() {
    if (state.doorOpen) return;
    state.doorOpen = true; doorGroup.visible = true;
    audio.play('door'); UI.toast('PORTA APERTA!', 2200);
  }

  function melee(now) {
    if (!introDone || now - player.lastMelee < 300) return;
    player.lastMelee = now;
    const [dr, dc] = DIRS[player.fDir] || [0, 1];
    const tr = player.r + dr, tc = player.c + dc;
    let hit = false;
    for (const e of enemies) { if (e.alive && !e.dying && e.r === tr && e.c === tc) { killEnemy(e); hit = true; break; } }
    audio.play(hit ? 'melee' : 'melee_miss');

    const slashCanvas = document.createElement('canvas'); slashCanvas.width = slashCanvas.height = 128;
    const sctx = slashCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,180,210,0.95)'); grad.addColorStop(0.6, 'rgba(255,107,157,0.55)'); grad.addColorStop(1, 'rgba(255,77,136,0)');
    sctx.fillStyle = grad; sctx.beginPath(); sctx.arc(64, 64, 62, 0, Math.PI * 2); sctx.fill();
    const slashTex = new THREE.CanvasTexture(slashCanvas); slashTex.colorSpace = THREE.SRGBColorSpace;
    const slashMat = new THREE.SpriteMaterial({ map: slashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 });
    const slashSp = new THREE.Sprite(slashMat); slashSp.scale.set(1.8, 1.8, 1);
    slashSp.position.set(player.x + dc * CS * 0.9, 1.0, player.z + dr * CS * 0.9); scene.add(slashSp);
    
    const slashStart = performance.now();
    (function fadeSlash() {
      const p = (performance.now() - slashStart) / 180;
      if (p >= 1) { scene.remove(slashSp); slashMat.dispose(); slashTex.dispose(); return; }
      slashMat.opacity = 0.95 * (1 - p); slashSp.scale.setScalar(1.8 + p * 0.6); requestAnimationFrame(fadeSlash);
    })();
  }

  function shoot(now) {
    if (!introDone || now - player.lastShoot < 500) return;
    if (player.ammo <= 0) { audio.play('noammo'); UI.toast('Niente munizioni'); return; }
    player.lastShoot = now; player.ammo--; UI.updateHUD(player, state); audio.play('shoot');
    const [dr, dc] = DIRS[player.fDir] || [0, 1];
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff8ab8 }));
    mesh.position.set(player.x + dc * CS * 0.55, 1.0, player.z + dr * CS * 0.55); scene.add(mesh);
    projectiles.push({ mesh, dx: dc, dz: dr, speed: 15, life: 1.0 });
  }

  function removeProjectile(i) {
    const p = projectiles[i]; if (!p) return;
    scene.remove(p.mesh);
    p.mesh.traverse(child => { if (child.geometry) child.geometry.dispose(); if (child.material) child.material.dispose(); });
    projectiles.splice(i, 1);
  }

  function removeEnemyProjectile(i) {
    const p = enemyProjectiles[i]; if (!p) return;
    scene.remove(p.mesh);
    p.mesh.geometry.dispose(); p.mesh.material.dispose();
    enemyProjectiles.splice(i, 1);
  }

  function clearEnemyProjectiles() {
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) removeEnemyProjectile(i);
  }

  function killEnemy(e) {
    if (!e.alive || e.dying) return;
    if (e.type === 'armored' && e.hp > 1) {
      e.hp--;
      const oldScale = e.sprite.scale.clone();
      e.sprite.material.color.setHex(0xff6080); e.sprite.scale.set(oldScale.x * 1.15, oldScale.y * 1.15, 1);
      setTimeout(() => { if (e.sprite && e.sprite.material) { e.sprite.material.color.setHex(0xffffff); e.sprite.scale.copy(oldScale); } }, 180);
      return;
    }
    e.dying = 0.55; e.sprite.material.transparent = true;
  }

  function damagePlayer() {
    const now = performance.now();
    if (now < player.invulnUntil) return;
    player.invulnUntil = now + 1200;
    if (player.shields > 0) { player.shields--; audio.play('hurt'); UI.toast('Scudo consumato'); UI.flashRed(); UI.shake(5, 220, state); }
    else {
      player.hp--; audio.play('hurt'); UI.flashRed(); UI.shake(8, 300, state);
      if (navigator.vibrate) { try { navigator.vibrate(100); } catch (_) {} }
      if (player.hp <= 0) { UI.updateHUD(player, state); gameOver(); return; }
    }
    UI.updateHUD(player, state);
  }

  function gameOver() {
    if (state.gameover) return;
    state.gameover = true; audio.play('gameover'); 
    Save.saveState(LEVEL, player, state, coins, leaves, chests, enemies, hearts); 
    try { localStorage.setItem('labirinto_next_url', LEVEL.file); } catch (_) {}
    setTimeout(() => { if (state.gameover) window.location.replace('gameover.html'); }, 100);
  }

  function winLevel() {
    if (state.won) return;
    state.won = true;
    try { localStorage.removeItem('labirinto_state'); } catch (_) {}

    try {
      localStorage.setItem('labirinto_hp', String(player.hp));
      localStorage.setItem('labirinto_shields', String(player.shields));
      localStorage.setItem('labirinto_ammo', String(player.ammo));
      localStorage.setItem('labirinto_coins', String(state.coinsTotal));
    } catch (_) {}

    try {
      const cum = JSON.parse(localStorage.getItem('labirinto_cumulative') || '{"time":0,"moves":0,"coins":0}');
      cum.time += Math.floor(state.elapsed); cum.moves += state.moves; cum.coins += state.coinsLevel;
      localStorage.setItem('labirinto_cumulative', JSON.stringify(cum));
    } catch (_) {}

    if (LEVEL.isLast) {
      audio.play('final');
      if (navigator.vibrate) { try { navigator.vibrate([100, 80, 100, 80, 300]); } catch (_) {} }
      const flash = document.getElementById('final-flash'); if (flash) flash.classList.add('show');
      try { localStorage.removeItem('labirinto_next_url'); } catch (_) {}
      setTimeout(() => { window.location.replace('vittoria.html'); }, 2400);
    } else {
      audio.play('win');
      try { localStorage.setItem('labirinto_next_url', LEVEL.next); } catch (_) {}
      document.getElementById('w-time').textContent = document.getElementById('hud-timer').textContent;
      document.getElementById('w-moves').textContent = String(state.moves);
      document.getElementById('w-coins').textContent = String(state.coinsLevel);
      document.getElementById('overlay-win').classList.add('show');
    }
  }

  function togglePause() {
    if (state.gameover || state.won) return;
    state.paused = !state.paused;
    document.getElementById('overlay-pause').classList.toggle('show', state.paused);
    if (state.paused) {
      audio.fadeMusicTo(0, 0.3);
      document.getElementById('p-time').textContent = document.getElementById('hud-timer').textContent;
      document.getElementById('p-moves').textContent = String(state.moves);
      document.getElementById('p-leaves').textContent = state.lCol + '/' + state.lTot;
      document.getElementById('p-dist').textContent = String(Math.abs(player.r - (MR - 2)) + Math.abs(player.c - (MC - 2)));
      Save.saveState(LEVEL, player, state, coins, leaves, chests, enemies, hearts);
    } else {
      if (audio.musicPlaying) audio.fadeMusicTo(audio.MUSIC_VOL * 0.40, 0.6);
    }
  }

  function resetLevel() {
    state.paused = false; state.gameover = false; state.won = false; state.doorOpen = false; state.moves = 0; state.elapsed = 0;
    state.lCol = 0; state.coinsLevel = 0; state.coinToastShown = false; state.shakeT = 0; state.shakeAmp = 0; state._lastWhisper = 0; state._tutorialGhost = false;
    player.r = 1; player.c = 1; player.x = 1 * CS; player.z = 1 * CS; player.fDir = 'down'; player.hp = START_HP; player.shields = 0; player.ammo = ammoLevel; player.invulnUntil = 0; player.lastMelee = 0; player.lastShoot = 0; player.isMovingTimer = 0;
    try {
      localStorage.removeItem('labirinto_hp');
      localStorage.removeItem('labirinto_shields');
      localStorage.removeItem('labirinto_ammo');
      localStorage.removeItem('labirinto_state');
    } catch (_) {}
    
    for (const lf of leaves) { if (lf.taken) { lf.sprite.position.set(lf.c * CS, 0.85, lf.r * CS); scene.add(lf.sprite); lf.taken = false; } }
    for (const hc of hearts) { if (hc.taken) { hc.sprite.position.set(hc.c * CS, 0.6, hc.r * CS); scene.add(hc.sprite); hc.taken = false; } }
    for (let idx = 0; idx < enemies.length; idx++) {
      const e = enemies[idx]; const gd = ghostsData[idx];
      e.r = gd.r; e.c = gd.c; e.alive = true; e.dying = 0; e.hp = e.type === 'armored' ? 2 : 1; e.windup = false;
      e.nextMove = performance.now() + Math.max(2000, baseILevel + 1500);
      e.nextShoot = performance.now() + Math.max(2000, baseILevel + 1500);
      e.sprite.position.set(e.c * CS, 1.05, e.r * CS); e.sprite.scale.set(1.25, 1.25, 1); e.sprite.material.opacity = 1; scene.add(e.sprite);
    }
    for (const ch of chests) { if (ch.opened) { ch.opened = false; ch.group.position.set(ch.c * CS, 0, ch.r * CS); scene.add(ch.group); } }
    doorHinge.rotation.y = 0; doorPanelMat.color.copy(closedColor); doorPanelMat.emissiveIntensity = 0.45;
    for (let i = projectiles.length - 1; i >= 0; i--) removeProjectile(i);
    clearEnemyProjectiles();
    
    playerGroup.position.set(player.x, 0, player.z); playerGroup.rotation.y = 0;
    camera.position.set(player.x - 6.5, 18, player.z + 13); camera.lookAt(player.x, 1, player.z);

    const winOverlay = document.getElementById('overlay-win');
    if (winOverlay) winOverlay.classList.remove('show');
    const pauseOverlay = document.getElementById('overlay-pause');
    if (pauseOverlay) pauseOverlay.classList.remove('show');

    UI.updateHUD(player, state); UI.updateTimer(state); lastT = performance.now(); UI.toast('Riprova!', 1200);
  }

  setupControls({ player, state, tryMove, melee, shoot, togglePause, resetLevel });

  document.getElementById('btn-mute').addEventListener('click', () => {
    audio.musicPlaying = !audio.musicPlaying;
    try { localStorage.setItem('labirinto_music_muted', audio.musicPlaying ? '0' : '1'); } catch(_) {}
    audio.updateSfxMute();
    if (audio.musicPlaying) {
      if (!audio.musicCtx && audio.musicStarted) audio.startMusicEngine();
      else if (audio.musicCtx) audio.fadeMusicTo(audio.MUSIC_VOL * 0.40, 0.6);
    } else if (audio.musicCtx) {
      audio.fadeMusicTo(0, 0.4);
    }
    document.querySelector('#btn-mute i').className = audio.musicPlaying ? 'fas fa-volume-up' : 'fas fa-volume-mute';
  });

  const btnMenu = document.getElementById('btn-menu');
  if (btnMenu) {
    btnMenu.addEventListener('click', () => {
      Save.saveState(LEVEL, player, state, coins, leaves, chests, enemies, hearts);
    });
  }

  const camTarget = new THREE.Vector3();
  const dirAngle = { right: Math.PI / 2, down: 0, left: -Math.PI / 2, up: Math.PI };
  let lastT = performance.now();

  function update(dt, now) {
    const tX = player.c * CS, tZ = player.r * CS;
    const lerpF = REDUCED_MOTION ? 1 : (1 - Math.pow(0.0005, dt));
    player.x += (tX - player.x) * lerpF; player.z += (tZ - player.z) * lerpF;
    playerGroup.position.set(player.x, 0, player.z);
    
    let dy = (dirAngle[player.fDir] || 0) - playerGroup.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    playerGroup.rotation.y += dy * Math.min(1, dt * 10);

    if (player.isMovingTimer > 0) {
      player.isMovingTimer -= dt;
    }
    const isMoving = player.isMovingTimer > 0;

    if (playerGroup.userData.playerSprite) {
      const sprite = playerGroup.userData.playerSprite;
      const h = 2.2;
      const walkMatsRight = playerGroup.userData.walkMatsRight;
      const walkMatsLeft = playerGroup.userData.walkMatsLeft;

      if (isMoving && walkMatsRight && walkMatsLeft) {
        playerGroup.userData.animTimer = (playerGroup.userData.animTimer || 0) + dt;
        const fps = 12;
        const frame = Math.floor(playerGroup.userData.animTimer * fps) % 7;
        const isLeft = player.fDir === 'left';
        const mats = isLeft ? walkMatsLeft : walkMatsRight;
        
        if (mats && mats[frame]) {
          sprite.material = mats[frame];
        }
        
        const w = playerGroup.userData.walkAspect ? h * playerGroup.userData.walkAspect : h;
        sprite.scale.set(w, h, 1);
      } else if (playerGroup.userData.staticMaterial) {
        if (sprite.material !== playerGroup.userData.staticMaterial) {
          sprite.material = playerGroup.userData.staticMaterial;
        }
        const w = playerGroup.userData.staticAspect ? h * playerGroup.userData.staticAspect : h;
        sprite.scale.set(w, h, 1);
      }
    }

    const showShield = player.shields > 0 || now < player.invulnUntil;
    shieldAura.visible = showShield;
    if (showShield) {
      const p = 0.5 + 0.5 * Math.sin(now * 0.008);
      shieldAura.material.opacity = 0.45 + 0.35 * p; const s = 2.2 + 0.25 * p; shieldAura.scale.set(s, s, 1);
    }

    camTarget.set(player.x - 6.5, 18, player.z + 13);
    const camF = REDUCED_MOTION ? 1 : (1 - Math.pow(0.0005, dt));
    camera.position.x += (camTarget.x - camera.position.x) * camF;
    camera.position.y += (camTarget.y - camera.position.y) * camF;
    camera.position.z += (camTarget.z - camera.position.z) * camF;

    if (state.shakeT > 0 && !REDUCED_MOTION) {
      state.shakeT -= dt * 1000; const amp = state.shakeAmp * Math.max(0, state.shakeT / 300);
      camera.position.x += (Math.random() - 0.5) * amp * 0.5; camera.position.y += (Math.random() - 0.5) * amp * 0.5; camera.position.z += (Math.random() - 0.5) * amp * 0.5;
    }
    camera.lookAt(player.x, 1, player.z);

    doorHinge.rotation.y += ((state.doorOpen ? Math.PI / 2 : 0) - doorHinge.rotation.y) * Math.min(1, dt * 4);
    doorPanelMat.color.lerp(state.doorOpen ? openColor : closedColor, Math.min(1, dt * 4));
    if (state.doorOpen) doorPanelMat.emissiveIntensity = 0.5 + (0.5 + 0.5 * Math.sin(now * 0.006)) * 0.7;

    for (const ch of chests) {
      if (ch.opened || !ch.group.userData.glow || REDUCED_MOTION) continue;
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.004 + ch.c * 0.7);
      ch.group.userData.glow.material.opacity = 0.55 + 0.45 * pulse;
      ch.group.userData.glow.scale.set(0.92 + 0.14 * pulse, 0.92 + 0.14 * pulse, 1);
      if (ch.group.userData.light) ch.group.userData.light.intensity = 0.9 + 0.7 * pulse;
    }

    const tSec = now * 0.001;
    for (const co of coins) { if (!co.taken && !REDUCED_MOTION) { const phase = co.phase * 0.31 + tSec * 2.6; co.sprite.scale.set(Math.abs(Math.cos(phase)) * 0.46 + 0.10, 0.46, 1); co.sprite.position.y = 0.55 + Math.sin(phase * 0.5) * 0.08; co.sprite.material.opacity = 0.85 + 0.15 * Math.sin(phase * 1.3); } }
    for (const hc of hearts) { if (!hc.taken && !REDUCED_MOTION) hc.sprite.position.y = 0.6 + Math.sin(now * 0.003 + hc.r + hc.c) * 0.1; }
    
    for (const e of enemies) {
      if (!e.alive || e.dying > 0) continue;
      const dist = Math.abs(e.r - player.r) + Math.abs(e.c - player.c);
      if (dist <= 3 && now > (e.nextWhisper || 0) && now - state._lastWhisper > 800) {
        audio.play('whisper'); state._lastWhisper = now; e.nextWhisper = now + (dist === 1 ? 900 : dist === 2 ? 1400 : 2200);
      }
      if (now >= e.nextMove - 150 && now < e.nextMove && !e.windup) { e.windup = true; e.sprite.scale.set(1.5, 1.15, 1); }
    }

    for (const e of enemies) {
      if (e.dying > 0) {
        e.dying -= dt; e.sprite.scale.multiplyScalar(Math.pow(0.2, dt)); e.sprite.material.opacity = Math.max(0, e.sprite.material.opacity - dt * 2.2);
        if (e.dying <= 0) { e.alive = false; scene.remove(e.sprite); }
        continue;
      }
      if (!e.alive) continue;

      const dPlayer = Math.abs(e.r - player.r) + Math.abs(e.c - player.c);
      if (!state._tutorialGhost && dPlayer === 4) { state._tutorialGhost = true; UI.toast('Un fantasma! Usa TESTATA o SPARO per eliminarlo!', 3200); }
      
      if (e.canShoot && now >= (e.nextShoot || 0) && dPlayer >= 2 && dPlayer <= 7) {
        const edr = player.r - e.r;
        const edc = player.c - e.c;
        if (edr === 0 || edc === 0) {
          let clear = true;
          const steps = Math.max(Math.abs(edr), Math.abs(edc));
          const stepR = edr === 0 ? 0 : (edr > 0 ? 1 : -1);
          const stepC = edc === 0 ? 0 : (edc > 0 ? 1 : -1);
          for (let s = 1; s < steps; s++) {
            const rr = e.r + stepR * s;
            const cc = e.c + stepC * s;
            if (rr < 0 || rr >= MR || cc < 0 || cc >= MC || maze[rr][cc] === 1) { clear = false; break; }
            if (maze[rr][cc] === 3 && !state.doorOpen) { clear = false; break; }
          }
          if (clear) {
            const mesh = new THREE.Mesh(
              new THREE.SphereGeometry(0.22, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0xff3355 })
            );
            mesh.position.set(e.c * CS, 1.0, e.r * CS);
            scene.add(mesh);
            enemyProjectiles.push({ mesh, dx: stepC, dz: stepR, speed: 9, life: 2.0 });
            e.nextShoot = now + 2200 + Math.random() * 1800;
            audio.play('enemy_shoot');
          }
        }
      }

      if (now >= e.nextMove) {
        const speed = e.type === 'armored' ? baseILevel * 1.3 : baseILevel;
        e.nextMove = now + speed; e.windup = false; e.sprite.scale.set(1.25, 1.25, 1);
        if (dPlayer <= 1) { damagePlayer(); continue; }
        let step = null;
        if (e.type === 'wanderer' && Math.random() < 0.5) {
          const dirs = [[1,0],[-1,0],[0,1],[0,-1]].sort(() => Math.random() - 0.5);
          for (const [dr, dc] of dirs) { const nr = e.r + dr, nc = e.c + dc; if (nr > 0 && nr < MR - 1 && nc > 0 && nc < MC - 1 && maze[nr][nc] !== 1 && !enemies.some(o => o !== e && o.alive && !o.dying && o.r === nr && o.c === nc)) { step = [nr, nc]; break; } }
        } else { step = bfsStep(e, player, maze, enemies, MR, MC); }
        if (step) { e.r = step[0]; e.c = step[1]; e.sprite.position.set(e.c * CS, 1.05, e.r * CS); }
      }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]; p.life -= dt;
      p.mesh.position.x += p.dx * p.speed * dt; p.mesh.position.z += p.dz * p.speed * dt;
      const gr = Math.round(p.mesh.position.z / CS), gc = Math.round(p.mesh.position.x / CS);
      let dead = false;
      if (gr >= 0 && gr < MR && gc >= 0 && gc < MC) {
        const cell = maze[gr][gc];
        if (cell === 1 || (cell === 3 && !state.doorOpen)) {
          dead = true;
        } else {
          for (const e of enemies) { if (e.alive && !e.dying && e.r === gr && e.c === gc) { killEnemy(e); dead = true; break; } }
        }
      }
      if (p.life <= 0) dead = true;
      if (dead) removeProjectile(i);
    }

    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
      const p = enemyProjectiles[i];
      p.life -= dt;
      p.mesh.position.x += p.dx * p.speed * dt;
      p.mesh.position.z += p.dz * p.speed * dt;

      const gr = Math.round(p.mesh.position.z / CS);
      const gc = Math.round(p.mesh.position.x / CS);

      let dead = false;
      if (gr < 0 || gr >= MR || gc < 0 || gc >= MC) {
        dead = true;
      } else {
        const cell = maze[gr][gc];
        if (cell === 1 || (cell === 3 && !state.doorOpen)) {
          dead = true;
        } else if (gr === player.r && gc === player.c) {
          damagePlayer();
          dead = true;
        }
      }
      if (p.life <= 0) dead = true;
      if (dead) removeEnemyProjectile(i);
    }

    if (!state.paused && !state.gameover && !state.won) state.elapsed += dt;
    UI.updateTimer(state);
  }

  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - lastT) / 1000; lastT = now;
    if (dt > 0.05) dt = 0.05;
    if (introDone && !state.paused && !state.gameover && !state.won) update(dt, now);
    renderer.render(scene, camera);
  }

  function onResize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.fadeMusicTo(0, 0.3);
      if (!state.paused && !state.gameover && !state.won && introDone) { state.paused = true; document.getElementById('overlay-pause').classList.add('show'); }
    } else {
      if (state.paused && !state.gameover && !state.won) { state.paused = false; document.getElementById('overlay-pause').classList.remove('show'); }
      if (audio.musicPlaying && !state.paused) audio.fadeMusicTo(audio.MUSIC_VOL * 0.40, 0.6);
    }
  });

  playerGroup.position.set(player.x, 0, player.z);
  camera.position.set(player.x - 6.5, 18, player.z + 13); camera.lookAt(player.x, 1, player.z);
  UI.updateHUD(player, state); UI.updateTimer(state);

  (function initParticles() {
    const cont = document.getElementById('particles');
    if (!cont) return;
    for (let i = 0; i < 16; i++) {
      const p = document.createElement('div');
      p.className = 'p';
      p.style.left = (Math.random() * 100) + '%';
      const dur = 5 + Math.random() * 7;
      p.style.animationDuration = dur + 's';
      p.style.animationDelay = (-Math.random() * dur) + 's';
      p.style.opacity = (0.4 + Math.random() * 0.6).toFixed(2);
      const sz = 3 + Math.random() * 3;
      p.style.width = sz + 'px'; p.style.height = sz + 'px';
      cont.appendChild(p);
    }
  })();

  (function initIntroHearts() {
    const cont = document.getElementById('intro-hearts');
    if (!cont) return;
    const set = ['💗', '💖', '💘', '💕', '💓', '🌸'];
    for (let i = 0; i < 22; i++) {
      const h = document.createElement('div');
      h.className = 'ih';
      h.textContent = set[Math.floor(Math.random() * set.length)];
      h.style.left = (Math.random() * 100) + '%';
      const dur = 3 + Math.random() * 3;
      const delay = Math.random() * 2.5;
      h.style.animationDuration = dur + 's';
      h.style.animationDelay = delay + 's';
      h.style.fontSize = (16 + Math.random() * 22) + 'px';
      cont.appendChild(h);
    }
  })();

  let bootDone = false;
  function finishBoot() {
    if (bootDone) return;
    bootDone = true;
    const lm = document.getElementById('lm');
    if (lm) lm.style.display = 'none';
  }
  setTimeout(finishBoot, 400);
  setTimeout(finishBoot, 2500);

  const introEl = document.getElementById('intro-overlay');
  setTimeout(() => { if (introEl) introEl.classList.add('fade-out'); }, 1800);
  setTimeout(() => {
    if (introEl && introEl.parentNode) introEl.parentNode.removeChild(introEl);
    introDone = true;
    const t = performance.now(); const grace = Math.max(2000, baseILevel + 1500);
    for (const e of enemies) { e.nextMove = t + grace; e.nextShoot = t + grace + Math.random() * 2000; }
    lastT = t;
    const restored = Save.loadState(LEVEL, player, state, coins, leaves, chests, enemies, hearts);
    if (!restored) {
      const el = document.getElementById('story-line');
      if (el) { el.textContent = LEVEL.story; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 4000); }
    }
  }, 2400);

  requestAnimationFrame(loop);
}