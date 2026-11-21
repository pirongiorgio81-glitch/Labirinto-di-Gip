// game/game-flow.js
import * as UI from '../ui.js';
import * as Save from '../save.js';
import * as Achievements from '../achievements.js';

export function initGameFlow(G) {
  const { CS } = G;

  function saveProfileStats() {
    try {
      const p = JSON.parse(localStorage.getItem('labirinto_profile') || '{}');
      p.totalKills = (p.totalKills || 0) + G.state.killsInLevel;
      p.totalMoves = (p.totalMoves || 0) + G.state.moves;
      p.totalTime = (p.totalTime || 0) + Math.floor(G.state.elapsed);
      p.totalCoins = (p.totalCoins || 0) + G.state.coinsLevel;
      if (G.state.won) p.totalWins = (p.totalWins || 0) + 1;
      if (G.state.gameover) p.totalDeaths = (p.totalDeaths || 0) + 1;
      p.lastPlayed = Date.now();
      localStorage.setItem('labirinto_profile', JSON.stringify(p));
    } catch (_) {}
  }

  function gameOver() {
    if (G.state.gameover || G.state.isEditor) return;
    G.state.gameover = true;
    G.audio.play('gameover');
    saveProfileStats();
    Achievements.checkAndUnlock({ event: 'gameover' });
    Save.saveState(G.LEVEL, G.player, G.state, G.coins, G.leaves, G.chests, G.enemies, G.hearts);
    try {
      const cum = JSON.parse(localStorage.getItem('labirinto_cumulative') || '{"time":0,"moves":0,"coins":0}');
      cum.time += Math.floor(G.state.elapsed);
      cum.moves += G.state.moves;
      cum.coins += G.state.coinsLevel;
      localStorage.setItem('labirinto_cumulative', JSON.stringify(cum));
      localStorage.setItem('labirinto_last_result', JSON.stringify({ coins: cum.coins, level: G.LEVEL.index }));
      localStorage.setItem('labirinto_next_url', G.isFreePlay
        ? `level.html?l=${G.LEVEL.index}&free=1`
        : G.LEVEL.file);
    } catch (_) {}
    setTimeout(() => { if (G.state.gameover) window.location.replace('gameover.html'); }, 100);
  }

  function winLevel() {
    if (G.state.won || G.state.isEditor) return;
    G.state.won = true;
    try { localStorage.removeItem('labirinto_state'); } catch (_) {}

    try {
      localStorage.setItem('labirinto_hp', String(G.player.hp));
      localStorage.setItem('labirinto_shields', String(G.player.shields));
      localStorage.setItem('labirinto_ammo', String(G.player.ammo));
      localStorage.setItem('labirinto_coins', String(G.state.coinsTotal));
    } catch (_) {}

    try {
      const cum = JSON.parse(localStorage.getItem('labirinto_cumulative') || '{"time":0,"moves":0,"coins":0}');
      cum.time += Math.floor(G.state.elapsed);
      cum.moves += G.state.moves;
      cum.coins += G.state.coinsLevel;
      localStorage.setItem('labirinto_cumulative', JSON.stringify(cum));
      localStorage.setItem('labirinto_last_result', JSON.stringify({ coins: cum.coins, level: G.LEVEL.index }));
    } catch (_) {}

    saveProfileStats();

    const newly = Achievements.checkAndUnlock({
      event: 'win',
      levelNum: G.levelNum,
      isLast: G.LEVEL.isLast,
      hpLost: G.state.hpLost,
      shotsFired: G.state.shotsFired,
      coinsLevel: G.state.coinsLevel,
      coinsTotal: G.state.coinsTotal
    });
    newly.forEach((id, i) => {
      const a = Achievements.ACHIEVEMENTS.find(x => x.id === id);
      if (a) setTimeout(() => UI.toast('🏆 ' + a.name + ' sbloccato!', 3000), i * 400);
    });

    if (G.isFreePlay) {
      if (G.LEVEL.isLast) {
        G.audio.play('final');
        if (navigator.vibrate) { try { navigator.vibrate([100, 80, 100, 80, 300]); } catch (_) {} }
        const flash = document.getElementById('final-flash'); if (flash) flash.classList.add('show');
        setTimeout(() => { window.location.replace('level-picker.html'); }, 2400);
      } else {
        G.audio.play('win');
        try { localStorage.setItem('labirinto_next_url', 'level-picker.html'); } catch (_) {}
        document.getElementById('w-time').textContent = document.getElementById('hud-timer').textContent;
        document.getElementById('w-moves').textContent = String(G.state.moves);
        document.getElementById('w-coins').textContent = String(G.state.coinsLevel);
        document.getElementById('overlay-win').classList.add('show');
        setTimeout(() => { window.location.replace('level-picker.html'); }, 3000);
      }
    } else if (G.LEVEL.isLast) {
      G.audio.play('final');
      if (navigator.vibrate) { try { navigator.vibrate([100, 80, 100, 80, 300]); } catch (_) {} }
      const flash = document.getElementById('final-flash'); if (flash) flash.classList.add('show');
      try { localStorage.removeItem('labirinto_next_url'); } catch (_) {}
      setTimeout(() => { window.location.replace('vittoria.html'); }, 2400);
    } else {
      G.audio.play('win');
      try { localStorage.setItem('labirinto_next_url', G.LEVEL.next); } catch (_) {}
      document.getElementById('w-time').textContent = document.getElementById('hud-timer').textContent;
      document.getElementById('w-moves').textContent = String(G.state.moves);
      document.getElementById('w-coins').textContent = String(G.state.coinsLevel);
      document.getElementById('overlay-win').classList.add('show');
    }
  }

  function togglePause() {
    if (G.state.gameover || G.state.won || G.state.isEditor) return;
    G.state.paused = !G.state.paused;
    G.pausedByVisibility = false;
    document.getElementById('overlay-pause').classList.toggle('show', G.state.paused);
    if (G.state.paused) {
      G.audio.fadeMusicTo(0, 0.3);
      G.audio.suspend();
      document.getElementById('p-time').textContent = document.getElementById('hud-timer').textContent;
      document.getElementById('p-moves').textContent = String(G.state.moves);
      document.getElementById('p-leaves').textContent = G.state.lCol + '/' + G.state.lTot;
      document.getElementById('p-dist').textContent = String(Math.abs(G.player.r - G.exitR) + Math.abs(G.player.c - G.exitC));
      Save.saveState(G.LEVEL, G.player, G.state, G.coins, G.leaves, G.chests, G.enemies, G.hearts);
    } else {
      G.audio.resume();
      if (G.audio.musicPlaying) G.audio.fadeMusicTo(G.audio.MUSIC_VOL * 0.40, 0.6);
    }
  }

  function resetLevel() {
    G.state.paused = false; G.state.gameover = false; G.state.won = false;
    G.state.doorOpen = false; G.state.moves = 0; G.state.elapsed = 0;
    G.state.lCol = 0; G.state.coinsLevel = 0; G.state.coinToastShown = false;
    G.state.shakeT = 0; G.state.shakeAmp = 0; G.state._lastWhisper = 0;
    G.state._tutorialGhost = false; G.state._tutMoveShown = false; G.state._tutLeafShown = false;
    G.state.shotsFired = 0; G.state.hpLost = 0; G.state.killsInLevel = 0;
    G.pausedByVisibility = false;

    G.player.r = G.startR; G.player.c = G.startC;
    G.player.x = G.startC * CS; G.player.z = G.startR * CS;
    G.player.fDir = 'down';
    G.player.hp = G.levelStartHp;
    G.player.shields = G.levelStartShields;
    G.player.ammo = G.levelStartAmmo;
    G.player.invulnUntil = 0; G.player.lastMelee = 0; G.player.lastShoot = 0;
    G.player.isMovingTimer = 0; G.player.turnDelay = 0;

    if (G.state.lTot === 0) G.state.doorOpen = true;

    try {
      localStorage.setItem('labirinto_hp', String(G.levelStartHp));
      localStorage.setItem('labirinto_shields', String(G.levelStartShields));
      localStorage.setItem('labirinto_ammo', String(G.levelStartAmmo));
      localStorage.removeItem('labirinto_state');
    } catch (_) {}

    for (const co of G.coins) {
      if (co.taken) {
        co.taken = false;
        co.sprite.position.set(co.c * CS, 0.55, co.r * CS);
        co.sprite.scale.set(0.46, 0.46, 1);
        co.sprite.material.opacity = 0.95;
        G.scene.add(co.sprite);
      }
    }
    for (const lf of G.leaves) {
      if (lf.taken) { lf.sprite.position.set(lf.c * CS, 0.85, lf.r * CS); G.scene.add(lf.sprite); lf.taken = false; }
    }
    for (const hc of G.hearts) {
      if (hc.taken) { hc.sprite.position.set(hc.c * CS, 0.6, hc.r * CS); G.scene.add(hc.sprite); hc.taken = false; }
    }

    for (let idx = 0; idx < G.enemies.length; idx++) {
      const e = G.enemies[idx];
      e.r = e.initialR; e.c = e.initialC; e.alive = true; e.dying = 0;
      e.hp = e.type === 'armored' ? 2 : 1;
      e.windup = false; e.windupShoot = 0;
      e.nextMove = performance.now() + Math.max(2000, G.baseILevel + 1500);
      e.nextShoot = performance.now() + Math.max(2000, G.baseILevel + 1500);
      e.sprite.position.set(e.c * CS, 1.05, e.r * CS);
      e.sprite.scale.set(1.25, 1.25, 1);
      e.sprite.material.opacity = 1;
      e.sprite.material.color.setHex(e.type === 'armored' ? 0x8899ff : 0xffffff);
      G.scene.add(e.sprite);
    }

    for (const ch of G.chests) {
      if (ch.opened) {
        ch.opened = false; ch.opening = 0;
        const lid = ch.group.userData.lid;
        if (lid) lid.rotation.x = 0;
        ch.group.position.set(ch.c * CS, 0, ch.r * CS);
        G.scene.add(ch.group);
      }
    }
    G.doorHinge.rotation.y = 0;
    G.doorPanelMat.color.copy(G.closedColor);
    G.doorPanelMat.emissiveIntensity = 0.45;
    G.doorGroup.position.set(G.exitC * CS, 0, G.exitR * CS);

    for (let i = G.projectiles.length - 1; i >= 0; i--) G.removeProjectile(i);
    G.clearEnemyProjectiles();

    for (let i = G.particles.length - 1; i >= 0; i--) {
      G.releaseParticle(G.particles[i].sprite);
      G.particles.splice(i, 1);
    }

    G.playerGroup.position.set(G.player.x, 0, G.player.z);
    G.playerGroup.rotation.y = 0;
    G.camera.position.set(G.player.x - 6.5, 18, G.player.z + 13);
    G.camera.lookAt(G.player.x, 1, G.player.z);

    const winOverlay = document.getElementById('overlay-win');
    if (winOverlay) winOverlay.classList.remove('show');
    const pauseOverlay = document.getElementById('overlay-pause');
    if (pauseOverlay) pauseOverlay.classList.remove('show');

    UI.updateHUD(G.player, G.state);
    UI.updateTimer(G.state);
    G.lastT = performance.now();
    UI.toast('Riprova!', 1200);
  }

  G.saveProfileStats = saveProfileStats;
  G.gameOver = gameOver;
  G.winLevel = winLevel;
  G.togglePause = togglePause;
  G.resetLevel = resetLevel;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      G.audio.fadeMusicTo(0, 0.3);
      G.audio.suspend();
      if (!G.state.paused && !G.state.gameover && !G.state.won && G.introDone && !G.state.isEditor) {
        G.state.paused = true;
        G.pausedByVisibility = true;
        document.getElementById('overlay-pause').classList.add('show');
      }
    } else {
      if (G.state.paused && G.pausedByVisibility && !G.state.gameover && !G.state.won && !G.state.isEditor) {
        G.state.paused = false;
        G.pausedByVisibility = false;
        document.getElementById('overlay-pause').classList.remove('show');
      }
      if (!G.state.paused) G.audio.resume();
      if (G.audio.musicPlaying && !G.state.paused) G.audio.fadeMusicTo(G.audio.MUSIC_VOL * 0.40, 0.6);
    }
  });
}