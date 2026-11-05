// entities.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function makeProceduralHeart() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff4d88, emissive: 0x000000, emissiveIntensity: 0,
    roughness: 0.35, metalness: 0.15
  });
  const sphereL = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), mat);
  sphereL.position.set(-0.28, 0.35, 0);
  group.add(sphereL);
  const sphereR = sphereL.clone();
  sphereR.position.x = 0.28;
  group.add(sphereR);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 16), mat);
  cone.position.y = 0.05;
  cone.rotation.x = Math.PI;
  group.add(cone);
  group.scale.setScalar(1.6);
  group.position.y = 0.8;
  return group;
}

export function loadGipModel(playerGroup, GIP_SCALE, GIP_Y) {
  let activeChar = null;
  try { activeChar = localStorage.getItem('labirinto_active_char'); } catch (_) {}
  const VALID_CHARS = ['char1', 'char2', 'char3', 'char4', 'char5', 'char6'];

  function loadGLB() {
    const loader = new GLTFLoader();
    let done = false;
    loader.load('./gip.glb',
      (gltf) => {
        if (done) return; done = true;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3(); box.getCenter(center);
        model.position.x = -center.x;
        model.position.z = -center.z;
        model.position.y = -box.min.y;
        const wrapper = new THREE.Group();
        wrapper.add(model);
        wrapper.scale.setScalar(GIP_SCALE);
        wrapper.position.y = GIP_Y;
        playerGroup.add(wrapper);
      },
      undefined,
      () => {
        if (done) return; done = true;
        console.warn('gip.glb non caricato: uso il fallback procedurale (cuore).');
        playerGroup.add(makeProceduralHeart());
      }
    );
  }

  if (activeChar && VALID_CHARS.includes(activeChar)) {
    const texLoader = new THREE.TextureLoader();
    texLoader.load(
      activeChar + '.png',
      (texture) => {
        try {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;

          if (texture.image) {
            playerGroup.userData.staticAspect = texture.image.width / texture.image.height;
          }

          const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
          const sprite = new THREE.Sprite(material);
          sprite.scale.set(2.2, 2.2, 1);
          sprite.position.set(0, 1.1, 0);
          playerGroup.add(sprite);
          
          playerGroup.userData.playerSprite = sprite; 
          playerGroup.userData.staticMaterial = material; 

          texLoader.load(activeChar + '_walk.png', (walkTex) => {
            const img = walkTex.image;
            if (!img) return;
            
            const fw = Math.floor(img.width / 7);
            const fh = Math.floor(img.height / 2);
            if (!fw || !fh) return;

            playerGroup.userData.walkAspect = fw / fh;
            
            const walkMatsRight = [];
            const walkMatsLeft = [];
            
            for (let i = 0; i < 7; i++) {
              const rc = document.createElement('canvas');
              rc.width = fw; rc.height = fh;
              rc.getContext('2d').drawImage(img, i * fw, 0, fw, fh, 0, 0, fw, fh);
              const rTex = new THREE.CanvasTexture(rc);
              rTex.colorSpace = THREE.SRGBColorSpace;
              rTex.minFilter = THREE.LinearFilter;
              rTex.magFilter = THREE.LinearFilter;
              rTex.generateMipmaps = false;
              walkMatsRight.push(new THREE.SpriteMaterial({ map: rTex, transparent: true, depthWrite: false }));
              
              const lc = document.createElement('canvas');
              lc.width = fw; lc.height = fh;
              lc.getContext('2d').drawImage(img, i * fw, fh, fw, fh, 0, 0, fw, fh);
              const lTex = new THREE.CanvasTexture(lc);
              lTex.colorSpace = THREE.SRGBColorSpace;
              lTex.minFilter = THREE.LinearFilter;
              lTex.magFilter = THREE.LinearFilter;
              lTex.generateMipmaps = false;
              walkMatsLeft.push(new THREE.SpriteMaterial({ map: lTex, transparent: true, depthWrite: false }));
            }
            
            playerGroup.userData.walkMatsRight = walkMatsRight;
            playerGroup.userData.walkMatsLeft = walkMatsLeft;
            playerGroup.userData.animTimer = 0;
          }, undefined, () => {});
        } catch (err) {
          loadGLB();
        }
      },
      undefined,
      () => loadGLB()
    );
  } else {
    loadGLB();
  }
}

export function makeChestMesh() {
  const g = new THREE.Group();
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a1f30, roughness: 0.7, metalness: 0.15, emissive: 0x2a001a, emissiveIntensity: 0.4 });
  const woodMid  = new THREE.MeshStandardMaterial({ color: 0x6a3048, roughness: 0.6, metalness: 0.15 });
  const gold     = new THREE.MeshStandardMaterial({ color: 0xffc0cb, metalness: 0.95, roughness: 0.15, emissive: 0xff5080, emissiveIntensity: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.9), woodDark); body.position.y = 0.3; g.add(body);
  const lid  = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.9), woodMid);  lid.position.y = 0.71; g.add(lid);
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.7, 0.96), gold); s1.position.set(-0.38, 0.35, 0); g.add(s1);
  const s2 = s1.clone(); s2.position.x = 0.38; g.add(s2);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.06, 0.96), gold); rim.position.y = 0.62; g.add(rim);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.12), gold); lock.position.set(0, 0.42, 0.5); g.add(lock);
  const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  keyhole.rotation.x = Math.PI / 2; keyhole.position.set(0, 0.42, 0.57); g.add(keyhole);
  
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const gctx = glowCanvas.getContext('2d');
  const grd = gctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,140,180,0.85)');
  grd.addColorStop(0.45, 'rgba(255,80,140,0.30)');
  grd.addColorStop(1, 'rgba(255,60,130,0)');
  gctx.fillStyle = grd; gctx.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(glowCanvas); glowTex.colorSpace = THREE.SRGBColorSpace;
  
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06; g.add(glow);
  const chestLight = new THREE.PointLight(0xff5c98, 1.2, 6, 2); chestLight.position.set(0, 1.3, 0); g.add(chestLight);
  g.userData.glow = glow; g.userData.light = chestLight; g.userData.goldMat = gold;
  return g;
}

export function makeDoorGroup(CS, MC, MR) {
  const doorGroup = new THREE.Group();
  const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x8b4060, roughness: 0.65, metalness: 0.2 });
  const doorPanelMat = new THREE.MeshStandardMaterial({ color: 0xc96080, roughness: 0.5, metalness: 0.3, emissive: 0x3a0018, emissiveIntensity: 0.45 });
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 0.2), doorFrameMat); postL.position.set(-0.85, 1.2, 0); doorGroup.add(postL);
  const postR = postL.clone(); postR.position.x = 0.85; doorGroup.add(postR);
  const arch = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 0.22), doorFrameMat); arch.position.set(0, 2.3, 0); doorGroup.add(arch);
  
  const doorHinge = new THREE.Group(); doorHinge.position.set(-0.72, 0, 0); doorGroup.add(doorHinge);
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.44, 2.1, 0.1), doorPanelMat); doorPanel.position.set(0.72, 1.05, 0); doorHinge.add(doorPanel);
  
  doorGroup.position.set((MC - 2) * CS, 0, (MR - 2) * CS);
  doorGroup.rotation.y = Math.PI / 2;
  
  return { doorGroup, doorHinge, doorPanelMat };
}