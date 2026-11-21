// game/pools.js
import * as THREE from 'three';

export function buildPools(G) {
  const projectiles = [];
  const enemyProjectiles = [];
  const particles = [];

  const projGeo = new THREE.SphereGeometry(0.25, 10, 10);
  const projMat = new THREE.MeshBasicMaterial({ color: 0xff8ab8 });
  const projPool = [];
  const enemyProjGeo = new THREE.SphereGeometry(0.22, 8, 8);
  const enemyProjMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
  const enemyProjPool = [];
  const particlePool = [];

  function acquireProjectile() { return projPool.pop() || new THREE.Mesh(projGeo, projMat); }
  function releaseProjectile(mesh) { G.scene.remove(mesh); projPool.push(mesh); }
  function acquireEnemyProjectile() { return enemyProjPool.pop() || new THREE.Mesh(enemyProjGeo, enemyProjMat); }
  function releaseEnemyProjectile(mesh) { G.scene.remove(mesh); enemyProjPool.push(mesh); }

  function acquireParticle() {
    if (particlePool.length > 0) {
      const sp = particlePool.pop();
      sp.visible = true;
      return sp;
    }
    const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 1 });
    return new THREE.Sprite(mat);
  }
  function releaseParticle(sp) {
    sp.parent?.remove(sp);
    sp.visible = false;
    particlePool.push(sp);
  }

  function burstParticles(x, y, z, color, count = 10) {
    if (G.disableParticles) return;
    for (let i = 0; i < count; i++) {
      const sp = acquireParticle();
      sp.material.color.setHex(color);
      sp.material.opacity = 1;
      sp.scale.setScalar(0.15 + Math.random() * 0.15);
      sp.position.set(x, y, z);
      G.scene.add(sp);
      particles.push({
        sprite: sp,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 3,
        vz: (Math.random() - 0.5) * 4,
        life: 0.7, maxLife: 0.7
      });
    }
  }

  return {
    projectiles, enemyProjectiles, particles,
    acquireProjectile, releaseProjectile,
    acquireEnemyProjectile, releaseEnemyProjectile,
    acquireParticle, releaseParticle, burstParticles
  };
}