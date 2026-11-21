// game/scene-builder.js
import * as THREE from 'three';
import { CS } from '../constants.js';
import * as Textures from '../textures.js';
import * as UI from '../ui.js';

export function buildScene(G) {
  const { MR, MC, theme, startR, startC } = G;

  const canvas = document.getElementById('game');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } catch (err) {
    document.getElementById('webgl-missing').style.display = 'flex';
    document.getElementById('lm').style.display = 'none';
    return null;
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    G.state.paused = true;
    try { UI.toast('Rendering perso. Ricarica la pagina.', 5000); } catch (_) {}
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.fog);
  scene.fog = new THREE.Fog(theme.fog, 24, 80);

  const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 400);
  camera.position.set(startC*CS - 6.5, 18, startR*CS + 13);
  camera.lookAt(startC*CS, 1, startR*CS);

  scene.add(new THREE.AmbientLight(0xe0c8d5, 1.0));
  const d1 = new THREE.DirectionalLight(0xfff4ec, 2.0); d1.position.set(20,40,14); scene.add(d1);
  const d2 = new THREE.DirectionalLight(theme.light, 0.8); d2.position.set(-18,30,-12); scene.add(d2);
  const p  = new THREE.PointLight(0xd880a8, 0.75, 140);
  p.position.set((MC*CS)/2, 22, (MR*CS)/2); scene.add(p);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(250, 250),
    new THREE.MeshStandardMaterial({ map: Textures.makeFloorTexture(theme), roughness:0.88, metalness:0.06 })
  );
  floor.rotation.x = -Math.PI/2;
  floor.position.set(((MC-1)*CS)/2, 0, ((MR-1)*CS)/2);
  scene.add(floor);

  const wallGeo = new THREE.BoxGeometry(CS, CS * 1.05, CS);
  const wallMat = new THREE.MeshStandardMaterial({ roughness:0.62, metalness:0.12, emissive:theme.fog, emissiveIntensity:0.15 });
  const wallBaseHSL = new THREE.Color(theme.wall).getHSL({ h:0, s:0, l:0 });
  let walls = null;

  function rebuildWalls() {
    if (walls) { scene.remove(walls); walls = null; }
    const pos = [];
    for (let r = 0; r < MR; r++) for (let c = 0; c < MC; c++) if (G.maze[r][c] === 1) pos.push([r,c]);
    walls = new THREE.InstancedMesh(wallGeo, wallMat, pos.length);
    walls.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const tmp = new THREE.Color();
    const dummy = new THREE.Object3D();
    for (let k = 0; k < pos.length; k++) {
      const [r,c] = pos[k];
      dummy.position.set(c*CS, CS*0.525, r*CS);
      dummy.updateMatrix();
      walls.setMatrixAt(k, dummy.matrix);
      tmp.setHSL((wallBaseHSL.h + r*0.009 + c*0.006) % 1, 0.5, 0.36);
      walls.setColorAt(k, tmp);
    }
    walls.instanceMatrix.needsUpdate = true;
    if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
    scene.add(walls);
    G.walls = walls;
  }
  rebuildWalls();

  return { renderer, scene, camera, floor, wallGeo, wallMat, wallBaseHSL, rebuildWalls };
}