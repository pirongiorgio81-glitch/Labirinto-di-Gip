// game/loop.js
import * as THREE from 'three';
import * as UI from '../ui.js';
import { bfsStep } from '../maze.js';

export function initLoop(G) {
  const { MR, MC, CS } = G;
  const camTarget = new THREE.Vector3();
  const dirAngle = { right: Math.PI / 2, down: 0, left: -Math.PI / 2, up: Math.PI };

  function update(dt, now) {
    const tX = G.player.c * CS, tZ = G.player.r * CS;
    const lerpF = G.REDUCED_MOTION ? 1 : (1 - Math.pow(0.0005, dt));
    G.player.x += (tX - G.player.x) * lerpF;
    G.player.z += (tZ - G.player.z) * lerpF;
    G.playerGroup.position.set(G.player.x, 0, G.player.z);

    let dy = (dirAngle[G.player.fDir] || 0) - G.playerGroup.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    G.playerGroup.rotation.y += dy * Math.min(1, dt * 10);

    if (G.player.isMovingTimer > 0) G.player.isMovingTimer -= dt;
    const isMoving = G.player.isMovingTimer > 0;

    if (G.playerGroup.userData.playerSprite) {
      const sprite = G.playerGroup.userData.playerSprite;
      const h = 2.2;
      const walkTex = G.playerGroup.userData.walkTexture;
      const walkMat = G.playerGroup.userData.walkMaterial;
      if (isMoving && walkTex && walkMat) {
        G.playerGroup.userData.animTimer = (G.playerGroup.userData.animTimer || 0) + dt;
        const frame = Math.floor(G.playerGroup.userData.animTimer * 12) % 7;
        walkTex.offset.x = frame / 7;
        walkTex.offset.y = (G.player.fDir === 'left') ? 0.5 : 0;
        if (sprite.material !== walkMat) sprite.material = walkMat;
        const w = G.playerGroup.userData.walkAspect ? h * G.playerGroup.userData.walkAspect : h;
        sprite.scale.set(w, h, 1);
      } else if (G.playerGroup.userData.staticMaterial) {
        if (sprite.material !== G.playerGroup.userData.staticMaterial)
          sprite.material = G.playerGroup.userData.staticMaterial;
        const w = G.playerGroup.userData.staticAspect ? h * G.playerGroup.userData.staticAspect : h;
        sprite.scale.set(w, h, 1);
      }
    }

    const showShield = G.player.shields > 0 || now < G.player.invulnUntil;
    G.shieldAura.visible = showShield;
    if (showShield) {
      const p = 0.5 + 0.5 * Math.sin(now * 0.008);
      G.shieldAura.material.opacity = 0.45 + 0.35 * p;
      const s = 2.2 + 0.25 * p;
      G.shieldAura.scale.set(s, s, 1);
    }

    camTarget.set(G.player.x - 6.5, 18, G.player.z + 13);
    const camF = G.REDUCED_MOTION ? 1 : (1 - Math.pow(0.0005, dt));
    G.camera.position.x += (camTarget.x - G.camera.position.x) * camF;
    G.camera.position.y += (camTarget.y - G.camera.position.y) * camF;
    G.camera.position.z += (camTarget.z - G.camera.position.z) * camF;

    if (G.state.shakeT > 0 && !G.REDUCED_MOTION && !G.disableShake) {
      G.state.shakeT -= dt * 1000;
      const amp = G.state.shakeAmp * Math.max(0, G.state.shakeT / 300);
      G.camera.position.x += (Math.random() - 0.5) * amp * 0.5;
      G.camera.position.y += (Math.random() - 0.5) * amp * 0.5;
      G.camera.position.z += (Math.random() - 0.5) * amp * 0.5;
    }
    G.camera.lookAt(G.player.x, 1, G.player.z);

    if (G.state.isEditor) { UI.updateTimer(G.state); return; }

    G.doorHinge.rotation.y += ((G.state.doorOpen ? Math.PI / 2 : 0) - G.doorHinge.rotation.y) * Math.min(1, dt * 4);
    G.doorPanelMat.color.lerp(G.state.doorOpen ? G.openColor : G.closedColor, Math.min(1, dt * 4));
    if (G.state.doorOpen) G.doorPanelMat.emissiveIntensity = 0.5 + (0.5 + 0.5 * Math.sin(now * 0.006)) * 0.7;

    for (const ch of G.chests) {
      if (ch.opening > 0) {
        ch.opening -= dt;
        const lid = ch.group.userData.lid;
        if (lid) lid.rotation.x = -Math.PI * 0.5 * Math.min(1, 1 - ch.opening / 0.45);
        if (ch.opening <= 0) G.scene.remove(ch.group);
      }
      if (ch.opened || !ch.group.userData.glow || G.REDUCED_MOTION) continue;
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.004 + ch.c * 0.7);
      ch.group.userData.glow.material.opacity = 0.55 + 0.45 * pulse;
      ch.group.userData.glow.scale.set(0.92 + 0.14 * pulse, 0.92 + 0.14 * pulse, 1);
      if (ch.group.userData.light) ch.group.userData.light.intensity = 0.9 + 0.7 * pulse;
    }

    const tSec = now * 0.001;
    for (const co of G.coins) {
      if (!co.taken && !G.REDUCED_MOTION) {
        const phase = co.phase * 0.31 + tSec * 2.6;
        co.sprite.scale.set(Math.abs(Math.cos(phase)) * 0.46 + 0.10, 0.46, 1);
        co.sprite.position.y = 0.55 + Math.sin(phase * 0.5) * 0.08;
        co.sprite.material.opacity = 0.85 + 0.15 * Math.sin(phase * 1.3);
      }
    }
    for (const hc of G.hearts) {
      if (!hc.taken && !G.REDUCED_MOTION) hc.sprite.position.y = 0.6 + Math.sin(now * 0.003 + hc.r + hc.c) * 0.1;
    }

    for (const e of G.enemies) {
      if (!e.alive || e.dying > 0) continue;
      const dist = Math.abs(e.r - G.player.r) + Math.abs(e.c - G.player.c);
      if (dist <= 3 && now > (e.nextWhisper || 0) && now - G.state._lastWhisper > 800) {
        G.audio.play('whisper');
        G.state._lastWhisper = now;
        e.nextWhisper = now + (dist === 1 ? 900 : dist === 2 ? 1400 : 2200);
      }
      if (now >= e.nextMove - 150 && now < e.nextMove && !e.windup) {
        e.windup = true;
        e.sprite.scale.set(1.5, 1.15, 1);
      }
      if (e.canShoot && now >= e.nextShoot - 200 && now < e.nextShoot && !e.windupShoot) {
        e.windupShoot = true;
        e.sprite.material.color.setHex(0xff3355);
      }
      if (e.windupShoot && now >= e.nextShoot) {
        e.windupShoot = false;
        e.sprite.material.color.setHex(e.type === 'armored' ? 0x8899ff : 0xffffff);
      }
    }

    for (const e of G.enemies) {
      if (e.dying > 0) {
        e.dying -= dt;
        e.sprite.scale.multiplyScalar(Math.pow(0.2, dt));
        e.sprite.material.opacity = Math.max(0, e.sprite.material.opacity - dt * 2.2);
        if (e.dying <= 0) { e.alive = false; G.scene.remove(e.sprite); }
        continue;
      }
      if (!e.alive) continue;

      const dPlayer = Math.abs(e.r - G.player.r) + Math.abs(e.c - G.player.c);
      if (G.levelNum === 1 && !G.state._tutorialGhost && dPlayer === 4) {
        G.state._tutorialGhost = true;
        UI.toast('Un fantasma! Usa TESTATA o SPARO per eliminarlo!', 3200);
      }

      if (e.canShoot && now >= (e.nextShoot || 0) && dPlayer >= 2 && dPlayer <= 7) {
        const edr = G.player.r - e.r;
        const edc = G.player.c - e.c;
        if (edr === 0 || edc === 0) {
          let clear = true;
          const steps = Math.max(Math.abs(edr), Math.abs(edc));
          const stepR = edr === 0 ? 0 : (edr > 0 ? 1 : -1);
          const stepC = edc === 0 ? 0 : (edc > 0 ? 1 : -1);
          for (let s = 1; s < steps; s++) {
            const rr = e.r + stepR * s;
            const cc = e.c + stepC * s;
            if (rr < 0 || rr >= MR || cc < 0 || cc >= MC || G.maze[rr][cc] === 1) { clear = false; break; }
            if (G.maze[rr][cc] === 3 && !G.state.doorOpen) { clear = false; break; }
          }
          if (clear) {
            const mesh = G.acquireEnemyProjectile();
            mesh.position.set(e.c * CS, 1.0, e.r * CS);
            G.scene.add(mesh);
            G.enemyProjectiles.push({ mesh, dx: stepC, dz: stepR, speed: 9, life: 2.0 });
            e.nextShoot = now + 2200 + Math.random() * 1800;
            G.audio.play('enemy_shoot');
          }
        }
      }

      if (now >= e.nextMove) {
        const speed = e.type === 'armored' ? G.baseILevel * 1.3 : G.baseILevel;
        e.nextMove = now + speed;
        e.windup = false;
        e.sprite.scale.set(1.25, 1.25, 1);
        if (dPlayer <= 1) { G.damagePlayer(); continue; }
        let step = null;
        if (e.type === 'wanderer' && Math.random() < 0.5) {
          const dirs = [[1,0],[-1,0],[0,1],[0,-1]].sort(() => Math.random() - 0.5);
          for (const [dr, dc] of dirs) {
            const nr = e.r + dr, nc = e.c + dc;
            if (nr > 0 && nr < MR - 1 && nc > 0 && nc < MC - 1 &&
                G.maze[nr][nc] !== 1 &&
                !G.enemies.some(o => o !== e && o.alive && !o.dying && o.r === nr && o.c === nc)) {
              step = [nr, nc]; break;
            }
          }
        } else {
          step = bfsStep(e, G.player, G.maze, G.enemies, MR, MC);
        }
        if (step) { e.r = step[0]; e.c = step[1]; e.sprite.position.set(e.c * CS, 1.05, e.r * CS); }
      }
    }

    for (let i = G.projectiles.length - 1; i >= 0; i--) {
      const p = G.projectiles[i];
      p.life -= dt;
      p.mesh.position.x += p.dx * p.speed * dt;
      p.mesh.position.z += p.dz * p.speed * dt;
      const gr = Math.round(p.mesh.position.z / CS);
      const gc = Math.round(p.mesh.position.x / CS);
      let dead = false;
      if (gr >= 0 && gr < MR && gc >= 0 && gc < MC) {
        const cell = G.maze[gr][gc];
        if (cell === 1 || (cell === 3 && !G.state.doorOpen)) dead = true;
        else {
          for (const e of G.enemies) {
            if (e.alive && !e.dying && e.r === gr && e.c === gc) { G.killEnemy(e); dead = true; break; }
          }
        }
      }
      if (p.life <= 0) dead = true;
      if (dead) G.removeProjectile(i);
    }

    for (let i = G.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = G.enemyProjectiles[i];
      p.life -= dt;
      p.mesh.position.x += p.dx * p.speed * dt;
      p.mesh.position.z += p.dz * p.speed * dt;
      const gr = Math.round(p.mesh.position.z / CS);
      const gc = Math.round(p.mesh.position.x / CS);
      let dead = false;
      if (gr < 0 || gr >= MR || gc < 0 || gc >= MC) dead = true;
      else {
        const cell = G.maze[gr][gc];
        if (cell === 1 || (cell === 3 && !G.state.doorOpen)) dead = true;
        else if (gr === G.player.r && gc === G.player.c) { G.damagePlayer(); dead = true; }
      }
      if (p.life <= 0) dead = true;
      if (dead) G.removeEnemyProjectile(i);
    }

    if (!G.state.paused && !G.state.gameover && !G.state.won) G.state.elapsed += dt;
    UI.updateTimer(G.state);
  }

  function loop(now) {
    requestAnimationFrame(loop);
    try {
      let dt = (now - G.lastT) / 1000;
      G.lastT = now;
      if (dt > 0.05) dt = 0.05;

      if (now < G.state.hitStopUntil) {
        G.renderer.render(G.scene, G.camera);
        return;
      }

      if (G.introDone && (!G.state.paused || G.state.isEditor) && !G.state.gameover && !G.state.won) {
        update(dt, now);
      }

      for (let i = G.particles.length - 1; i >= 0; i--) {
        const p = G.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          G.releaseParticle(p.sprite);
          G.particles.splice(i, 1);
          continue;
        }
        p.vy -= 8 * dt;
        p.sprite.position.x += p.vx * dt;
        p.sprite.position.y += p.vy * dt;
        p.sprite.position.z += p.vz * dt;
        p.sprite.material.opacity = p.life / p.maxLife;
      }

      G.renderer.render(G.scene, G.camera);
    } catch (e) {
      console.error('Loop error:', e);
      if (!G.state._loopErrorShown) {
        G.state._loopErrorShown = true;
        G.state.paused = true;
        try { UI.toast('Errore: ' + e.message, 4000); } catch (_) {}
      }
    }
  }

  function onResize() {
    G.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    G.renderer.setSize(window.innerWidth, window.innerHeight, false);
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

  G.update = update;
  requestAnimationFrame(loop);
}