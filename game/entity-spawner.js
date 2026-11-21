// game/entity-spawner.js
import * as THREE from 'three';
import * as Textures from '../textures.js';
import * as Entities from '../entities.js';

export function spawnEntities(G) {
  const { MR, MC, CS, scene, LEVEL, baseILevel, enemiesCanShoot } = G;
  const { startR, startC, exitR, exitC } = G;
  const { leavesData, ghostsData, chestsData, heartPositions, coinsData } = G;

  const playerGroup = new THREE.Group();
  scene.add(playerGroup);

  const playerLight = new THREE.PointLight(0xff4d88, 0.85, 18, 2);
  playerLight.position.set(0, 1.5, 0);
  playerGroup.add(playerLight);

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({ map: Textures.makeContactTexture(), transparent: true, depthWrite: false, opacity: 0.75 })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.04, 0);
  playerGroup.add(contactShadow);

  const dirShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({ map: Textures.makeDirectionalShadowTexture(), transparent: true, depthWrite: false, opacity: 0.6 })
  );
  dirShadow.rotation.x = -Math.PI / 2;
  dirShadow.position.set(0, 0.035, 0.9);
  playerGroup.add(dirShadow);

  const shieldAura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: Textures.makeShieldTexture(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.7
  }));
  shieldAura.scale.set(2.4, 2.4, 1);
  shieldAura.position.y = 1.0;
  shieldAura.visible = false;
  playerGroup.add(shieldAura);

  Entities.loadGipModel(playerGroup, 2.5, 0.1);

  const coinTex = Textures.makeCoinTexture();
  const coins = coinsData.map(([r, c]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: coinTex, transparent: true, depthWrite: false, opacity: 0.95 }));
    sp.scale.set(0.46, 0.46, 1);
    sp.position.set(c * CS, 0.55, r * CS);
    scene.add(sp);
    return { r, c, sprite: sp, taken: false, phase: (r * 13 + c * 7) % 100 };
  });

  const leafTex = Textures.makeLeafTexture();
  const leaves = leavesData.map(ld => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: leafTex, transparent: true, depthWrite: false }));
    sp.scale.set(1.0, 1.0, 1);
    sp.position.set(ld.c * CS, 0.85, ld.r * CS);
    scene.add(sp);
    return { r: ld.r, c: ld.c, sprite: sp, taken: false };
  });

  const heartTex = Textures.makeHeartPickupTexture();
  const hearts = heartPositions.map(([r, c]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
    sp.scale.set(0.62, 0.62, 1);
    sp.position.set(c * CS, 0.6, r * CS);
    scene.add(sp);
    return { r, c, sprite: sp, taken: false };
  });

  const ghostTex = Textures.makeGhostTexture();
  const enemies = ghostsData.map((gd, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ghostTex, transparent: true, depthWrite: false }));
    sp.scale.set(1.25, 1.25, 1);
    sp.position.set(gd.c * CS, 1.05, gd.r * CS);
    scene.add(sp);
    const type = gd.type || (LEVEL.types && LEVEL.types[i]) || 'hunter';
    if (type === 'armored') sp.material.color.setHex(0x8899ff);
    return {
      r: gd.r, c: gd.c, initialR: gd.r, initialC: gd.c,
      sprite: sp, alive: true, dying: 0, type,
      hp: type === 'armored' ? 2 : 1, windup: false, windupShoot: 0,
      nextMove: performance.now() + baseILevel, nextWhisper: 0,
      canShoot: enemiesCanShoot,
      nextShoot: performance.now() + baseILevel + 2000 + Math.random() * 1500
    };
  });

  const chests = chestsData.map(ch => {
    const grp = Entities.makeChestMesh();
    grp.position.set(ch.c * CS, 0, ch.r * CS);
    scene.add(grp);
    return { r: ch.r, c: ch.c, group: grp, reward: ch.reward, opened: false, opening: 0 };
  });

  const { doorGroup, doorHinge, doorPanelMat } = Entities.makeDoorGroup(CS, MC, MR, exitR, exitC);
  scene.add(doorGroup);
  doorGroup.visible = true;
  const closedColor = new THREE.Color(0xc96080);
  const openColor = new THREE.Color(0x00ff88);

  return {
    playerGroup, playerLight, contactShadow, dirShadow, shieldAura,
    coinTex, leafTex, heartTex, ghostTex,
    coins, leaves, hearts, enemies, chests,
    doorGroup, doorHinge, doorPanelMat, closedColor, openColor
  };
}