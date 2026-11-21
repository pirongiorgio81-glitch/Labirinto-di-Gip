// game/combat.js
import * as THREE from 'three';
import * as UI from '../ui.js';
import * as Achievements from '../achievements.js';

export function initCombat(G) {
  const { CS, DIRS } = G;

  function removeProjectile(i) {
    const p = G.projectiles[i]; if (!p) return;
    G.releaseProjectile(p.mesh);
    G.projectiles.splice(i, 1);
  }
  function removeEnemyProjectile(i) {
    const p = G.enemyProjectiles[i]; if (!p) return;
    G.releaseEnemyProjectile(p.mesh);
    G.enemyProjectiles.splice(i, 1);
  }
  function clearEnemyProjectiles() {
    for (let i = G.enemyProjectiles.length - 1; i >= 0; i--) removeEnemyProjectile(i);
  }

  function melee(now) {
    if (!G.introDone || G.state.isEditor || now - G.player.lastMelee < 300) return;
    G.player.lastMelee = now;
    const [dr, dc] = DIRS[G.player.fDir] || [0, 1];
    const tr = G.player.r + dr, tc = G.player.c + dc;
    let hit = false;
    for (const e of G.enemies) {
      if (e.alive && !e.dying && e.r === tr && e.c === tc) { killEnemy(e); hit = true; break; }
    }
    G.audio.play(hit ? 'melee' : 'melee_miss');

    if (!G.slashSprite) {
      const slashCanvas = document.createElement('canvas');
      slashCanvas.width = slashCanvas.height = 128;
      const sctx = slashCanvas.getContext('2d');
      const grad = sctx.createRadialGradient(64, 64, 8, 64, 64, 62);
      grad.addColorStop(0, 'rgba(255,180,210,0.95)');
      grad.addColorStop(0.6, 'rgba(255,107,157,0.55)');
      grad.addColorStop(1, 'rgba(255,77,136,0)');
      sctx.fillStyle = grad;
      sctx.beginPath();
      sctx.arc(64, 64, 62, 0, Math.PI * 2);
      sctx.fill();
      const slashTex = new THREE.CanvasTexture(slashCanvas);
      slashTex.colorSpace = THREE.SRGBColorSpace;
      G.slashMat = new THREE.SpriteMaterial({
        map: slashTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0
      });
      G.slashSprite = new THREE.Sprite(G.slashMat);
      G.scene.add(G.slashSprite);
    }

    G.slashSprite.position.set(G.player.x + dc * CS * 0.9, 1.0, G.player.z + dr * CS * 0.9);
    G.slashSprite.scale.set(1.8, 1.8, 1);
    G.slashMat.opacity = 0.95;

    const slashStart = performance.now();
    const myGen = ++G.slashGen;
    (function fadeSlash() {
      if (myGen !== G.slashGen) return;
      const p = (performance.now() - slashStart) / 180;
      if (p >= 1) { G.slashMat.opacity = 0; return; }
      G.slashMat.opacity = 0.95 * (1 - p);
      G.slashSprite.scale.setScalar(1.8 + p * 0.6);
      requestAnimationFrame(fadeSlash);
    })();
  }

  function shoot(now) {
    if (!G.introDone || G.state.isEditor || now - G.player.lastShoot < 500) return;
    if (G.player.ammo <= 0) { G.audio.play('noammo'); UI.toast('Niente munizioni'); return; }
    G.player.lastShoot = now;
    G.player.ammo--;
    G.state.shotsFired++;
    UI.updateHUD(G.player, G.state);
    G.audio.play('shoot');
    const [dr, dc] = DIRS[G.player.fDir] || [0, 1];
    const mesh = G.acquireProjectile();
    mesh.position.set(G.player.x + dc * CS * 0.55, 1.0, G.player.z + dr * CS * 0.55);
    G.scene.add(mesh);
    G.projectiles.push({ mesh, dx: dc, dz: dr, speed: 15, life: 1.0 });
  }

  function killEnemy(e) {
    if (!e.alive || e.dying) return;
    if (e.type === 'armored' && e.hp > 1) {
      e.hp--;
      const oldScale = e.sprite.scale.clone();
      const baseColor = e.type === 'armored' ? 0x8899ff : 0xffffff;
      e.sprite.material.color.setHex(0xff6080);
      e.sprite.scale.set(oldScale.x * 1.15, oldScale.y * 1.15, 1);
      G.state.hitStopUntil = performance.now() + 50;
      setTimeout(() => {
        if (e.sprite && e.sprite.material) {
          e.sprite.material.color.setHex(baseColor);
          e.sprite.scale.copy(oldScale);
        }
      }, 180);
      return;
    }
    e.dying = 0.55;
    e.sprite.material.transparent = true;
    G.state.killsInLevel++;

    const newly = Achievements.checkAndUnlock({ event: 'kill' });
    newly.forEach((id, i) => {
      const a = Achievements.ACHIEVEMENTS.find(x => x.id === id);
      if (a) setTimeout(() => UI.toast('🏆 ' + a.name + '!', 3000), i * 400);
    });
  }

  function damagePlayer() {
    if (G.state.isEditor) return;
    const now = performance.now();
    if (now < G.player.invulnUntil) return;
    G.player.invulnUntil = now + 1200;
    if (G.player.shields > 0) {
      G.player.shields--;
      G.audio.play('hurt');
      UI.toast('Scudo consumato');
      UI.flashRed(); UI.shake(5, 220, G.state);
    } else {
      G.player.hp--;
      G.state.hpLost++;
      G.audio.play('hurt');
      UI.flashRed();
      UI.shake(8, 300, G.state);
      if (navigator.vibrate) { try { navigator.vibrate(100); } catch (_) {} }
      if (G.player.hp <= 0) { UI.updateHUD(G.player, G.state); G.gameOver(); return; }
    }
    UI.updateHUD(G.player, G.state);
  }

  G.melee = melee;
  G.shoot = shoot;
  G.killEnemy = killEnemy;
  G.damagePlayer = damagePlayer;
  G.removeProjectile = removeProjectile;
  G.removeEnemyProjectile = removeEnemyProjectile;
  G.clearEnemyProjectiles = clearEnemyProjectiles;
            }
