// game.js
import * as THREE from 'three';
import { LEVELS } from './levels.js';
import {
  MR, MC, CS, MAX_HP, MAX_SH, MAX_AM,
  START_HP, START_AMMO, REDUCED_MOTION,
  getDifficulty, getMaxLevel
} from './constants.js';
import { AudioManager } from './audio.js';
import { initBFS } from './maze.js';
import * as UI from './ui.js';
import { setupControls } from './controls.js';

import { loadLevelData, verifyNoOverlaps } from './game/level-loader.js';
import { buildScene }               from './game/scene-builder.js';
import { buildPools }               from './game/pools.js';
import { spawnEntities }            from './game/entity-spawner.js';
import { initMovement }             from './game/movement.js';
import { initCombat }               from './game/combat.js';
import { initGameFlow }             from './game/game-flow.js';
import { initEditor }               from './game/editor.js';
import { initLoop }                 from './game/loop.js';
import { initVisualFx, initParticlesDOM, initIntroHeartsDOM }
       from './game/visual-fx.js';
import { initAudioButtons, initMenuButton } from './game/ui-buttons.js';

if (window.location.search.includes('reset=true')) {
  try {
    ['labirinto_custom_levels','labirinto_state','labirinto_hp',
     'labirinto_shields','labirinto_ammo'].forEach(k => localStorage.removeItem(k));
  } catch (_) {}
  window.location.href = window.location.pathname;
}

export function initGame(levelNum) {
  try {
    // ─── 1. Validazione livello ───────────────────────────────
    const difficulty = getDifficulty();
    const maxLevel   = getMaxLevel();
    const isFreePlay = new URLSearchParams(window.location.search).get('free') === '1';
    const MAX_ABSOLUTE_LEVEL = 15;

    if (levelNum < 1 || levelNum > (isFreePlay ? MAX_ABSOLUTE_LEVEL : maxLevel)) {
      window.location.replace('index.html'); return;
    }
    const baseLevel = LEVELS[levelNum];
    if (!baseLevel) throw new Error('Livello inesistente: ' + levelNum);

    const isLast = isFreePlay ? (levelNum === MAX_ABSOLUTE_LEVEL) : (levelNum === maxLevel);
    const LEVEL  = { ...baseLevel, isLast };
    const theme  = LEVEL.theme || { floor:'#7a4456', wall:0xffa8c8, fog:0x1a0010, light:0xffe0e8 };

    // ─── 2. Contesto globale G ────────────────────────────────
    const G = {
      levelNum, LEVEL, theme, isFreePlay, maxLevel, MAX_ABSOLUTE_LEVEL,
      baseILevel: LEVEL.baseI,
      leavesLevel: LEVEL.leaves,
      ammoLevel: LEVEL.startAmmo || START_AMMO,
      enemiesCanShoot: levelNum >= 8,
      mazeStyle: LEVEL.style || 'standard',
      disableParticles: localStorage.getItem('labirinto_disable_particles') === '1',
      disableShake:    localStorage.getItem('labirinto_disable_shake') === '1',
      introDone: false,
      pausedByVisibility: false,
      lastT: performance.now(),
      slashGen: 0, slashSprite: null, slashMat: null,
      editorPanel: null,
      MR, MC, CS, MAX_HP, MAX_SH, MAX_AM, START_HP, START_AMMO, REDUCED_MOTION,
      DIRS: { up:[-1,0], down:[1,0], left:[0,-1], right:[0,1] }
    };

    G.audio = new AudioManager();
    G.audio.ambientLevel = levelNum;
    window.addEventListener('beforeunload', () => {
      try { G.audio.stopMusicEngine(); } catch (_) {}
    });

    UI.buildDOM(LEVEL, START_HP, START_AMMO);
    initBFS(MR, MC);

    // ─── 3. Dati livello ──────────────────────────────────────
    Object.assign(G, loadLevelData(G));
    verifyNoOverlaps(G);

    // ─── 4. Scena 3D ──────────────────────────────────────────
    Object.assign(G, buildScene(G));

    // ─── 5. Stato + player ────────────────────────────────────
    G.state = {
      paused:false, gameover:false, won:false, doorOpen:false,
      moves:0, elapsed:0, lCol:0, lTot:G.leavesData.length, // <--- CORRETTO QUI
      shakeT:0, shakeAmp:0, coinsLevel:0, coinsTotal:0,
      coinToastShown:false, _lastWhisper:0, _tutorialGhost:false,
      isEditor:false, editorTool:'wall',
      shotsFired:0, hpLost:0, killsInLevel:0,
      _loopErrorShown:false, _tutMoveShown:false, _tutLeafShown:false,
      hitStopUntil:0
    };
    if (G.state.lTot === 0) G.state.doorOpen = true;

    G.player = {
      r:G.startR, c:G.startC, x:G.startC*CS, z:G.startR*CS, fDir:'down',
      hp:START_HP, shields:0, ammo:G.ammoLevel,
      invulnUntil:0, lastMelee:0, lastShoot:0, isMovingTimer:0, turnDelay:0
    };
    try {
      const h = parseInt(localStorage.getItem('labirinto_hp') || String(START_HP),10);
      const s = parseInt(localStorage.getItem('labirinto_shields') || '0',10);
      const a = parseInt(localStorage.getItem('labirinto_ammo') || String(G.ammoLevel),10);
      const cn = parseInt(localStorage.getItem('labirinto_coins') || '0',10);
      G.player.hp      = Math.min(isNaN(h)||h<1 ? START_HP : h, MAX_HP);
      G.player.shields = Math.min(isNaN(s) ? 0 : s, MAX_SH);
      G.player.ammo    = Math.min(isNaN(a) ? G.ammoLevel : Math.max(a, G.ammoLevel), MAX_AM);
      G.state.coinsTotal = isNaN(cn) ? 0 : Math.max(0, cn);
    } catch (_) {}

    G.levelStartHp      = G.player.hp;
    G.levelStartShields = G.player.shields;
    G.levelStartAmmo    = G.player.ammo;

    // ─── 6. Pool (proiettili/particelle) ──────────────────────
    Object.assign(G, buildPools(G));

    // ─── 7. Spawn entità ──────────────────────────────────────
    Object.assign(G, spawnEntities(G));

    // ─── 8. Init moduli (attaccano metodi a G) ────────────────
    initMovement(G);
    initCombat(G);
    initGameFlow(G);
    initEditor(G);

    // ─── 9. Controlli ─────────────────────────────────────────
    setupControls({
      player: G.player, state: G.state,
      tryMove: G.tryMove, melee: G.melee, shoot: G.shoot,
      togglePause: G.togglePause, resetLevel: G.resetLevel
    });

    // ─── 10. Bottoni + loop + FX ──────────────────────────────
    initAudioButtons(G);
    initMenuButton(G);
    initLoop(G);
    initParticlesDOM();
    initIntroHeartsDOM();
    initVisualFx(G);

    // fallback caricamento
    const hideLoader = () => { const lm = document.getElementById('lm'); if (lm) lm.style.display='none'; };
    setTimeout(hideLoader, 400);
    setTimeout(hideLoader, 2500);

  } catch (globalError) {
    console.error("Errore critico all'avvio:", globalError);
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#18000e;color:#ffb4d1;font-family:sans-serif;padding:20px;text-align:center;z-index:99999;">
        <h2 style="color:#ff4f93;margin-bottom:10px;">Ops! Errore all'avvio.</h2>
        <p style="font-size:14px;opacity:0.8;margin-bottom:20px;">${globalError.message}</p>
        <a href="?reset=true" style="padding:12px 24px;background:#c93d7d;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Ripristina il Gioco</a>
      </div>`;
  }
}