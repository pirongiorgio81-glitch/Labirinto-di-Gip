// game/movement.js
import * as UI from '../ui.js';

export function initMovement(G) {
  const { MR, MC, CS, MAX_HP, MAX_SH, MAX_AM, DIRS } = G;

  function cellFree(r, c) {
    if (r < 0 || r >= MR || c < 0 || c >= MC) return false;
    const v = G.maze[r][c];
    if (v === 1) return false;
    if (v === 3 && !G.state.doorOpen) return false;
    return true;
  }

  function pickupsAt(r, c) {
    if (G.state.isEditor) return;
    for (const co of G.coins) {
      if (!co.taken && co.r === r && co.c === c) {
        co.taken = true; G.scene.remove(co.sprite);
        G.state.coinsLevel++; G.state.coinsTotal++;
        G.burstParticles(c * CS, 0.55, r * CS, 0xffd54a, 12);
        G.audio.play('coin');
        try { localStorage.setItem('labirinto_coins', String(G.state.coinsTotal)); } catch (_) {}
        if (!G.state.coinToastShown) { G.state.coinToastShown = true; UI.toast('Monete: ' + G.state.coinsTotal, 1800); }
        UI.updateHUD(G.player, G.state); break;
      }
    }
    for (const hc of G.hearts) {
      if (!hc.taken && hc.r === r && hc.c === c) {
        hc.taken = true; G.scene.remove(hc.sprite);
        G.player.hp = Math.min(MAX_HP, G.player.hp + 1);
        G.burstParticles(c * CS, 0.6, r * CS, 0xff4d88, 10);
        G.audio.play('chest'); UI.toast('+1 Vita'); UI.updateHUD(G.player, G.state); break;
      }
    }
    for (const lf of G.leaves) {
      if (!lf.taken && lf.r === r && lf.c === c) {
        lf.taken = true; G.scene.remove(lf.sprite);
        G.state.lCol++;
        G.burstParticles(c * CS, 0.85, r * CS, 0x66bb6a, 10);
        G.audio.play('leaf'); UI.toast('Foglia ' + G.state.lCol + '/' + G.state.lTot);
        UI.updateHUD(G.player, G.state);
        if (G.levelNum === 1 && G.state.lCol === 1 && !G.state._tutLeafShown) {
          G.state._tutLeafShown = true;
          setTimeout(() => UI.toast('Raccogli tutte le foglie per aprire la porta!', 3000), 800);
        }
        if (G.state.lCol >= G.state.lTot) openDoor();
        break;
      }
    }
    for (const ch of G.chests) {
      if (!ch.opened && ch.r === r && ch.c === c) {
        ch.opened = true;
        ch.opening = 0.45;
        G.burstParticles(c * CS, 0.9, r * CS, 0xff5080, 15);
        if (ch.reward === 'heart') { G.player.hp = Math.min(MAX_HP, G.player.hp + 1); UI.toast('+1 Vita'); }
        else if (ch.reward === 'shield') { G.player.shields = Math.min(MAX_SH, G.player.shields + 1); UI.toast('+1 Scudo'); }
        else { G.player.ammo = Math.min(MAX_AM, G.player.ammo + 3); UI.toast('+3 Munizioni'); }
        G.audio.play('chest'); UI.updateHUD(G.player, G.state); break;
      }
    }
    if (G.maze[r][c] === 3 && G.state.doorOpen) G.winLevel();
  }

  function tryMove(dir) {
    if (!G.introDone || (G.state.paused && !G.state.isEditor) || G.state.gameover || G.state.won) return;
    if (!DIRS[dir]) return;

    if (G.player.fDir !== dir) {
      G.player.fDir = dir;
      G.player.turnDelay = performance.now() + 120;
      G.player.isMovingTimer = 0;
      return;
    }
    if (performance.now() < G.player.turnDelay) return;

    const [dr, dc] = DIRS[dir];
    const nr = G.player.r + dr, nc = G.player.c + dc;

    if (!G.state.isEditor) {
      const en = G.enemies.find(e => e.alive && !e.dying && e.r === nr && e.c === nc);
      if (en) { G.melee(performance.now()); return; }
    }

    if (!cellFree(nr, nc)) {
      if (!G.state.isEditor) {
        G.audio.play('bump');
        if (window.navigator && window.navigator.vibrate) {
          try { window.navigator.vibrate([50, 30, 50]); } catch (e) {}
        }
      }
      return;
    }

    G.player.r = nr; G.player.c = nc; G.state.moves++;
    G.player.isMovingTimer = 0.22;
    UI.updateHUD(G.player, G.state); pickupsAt(nr, nc);

    if (G.levelNum === 1 && G.state.moves === 1 && !G.state._tutMoveShown) {
      G.state._tutMoveShown = true;
      setTimeout(() => UI.toast('Muoviti con le frecce o la D-pad!', 2500), 400);
    }
  }

  function openDoor() {
    if (G.state.doorOpen) return;
    G.state.doorOpen = true;
    G.doorGroup.visible = true;
    G.audio.play('door');
    UI.toast('PORTA APERTA!', 2200);
  }

  G.cellFree = cellFree;
  G.pickupsAt = pickupsAt;
  G.tryMove = tryMove;
  G.openDoor = openDoor;
}