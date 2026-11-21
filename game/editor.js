// game/editor.js
import * as THREE from 'three';
import * as UI from '../ui.js';
import * as Entities from '../entities.js';
import * as Achievements from '../achievements.js';
import { saveCustomLevel } from '../customLevels.js';

export function initEditor(G) {
  const { MR, MC, CS, DIRS } = G;
  const hudBtns = document.getElementById('hud-btns');
  const editorBtn = document.createElement('button');
  editorBtn.id = 'btn-editor';
  editorBtn.className = 'tbtn';
  editorBtn.style.background = 'linear-gradient(180deg, #e5aa34, #a2610b)';
  editorBtn.innerHTML = '<i class="fas fa-edit"></i><span>MODIFICA</span>';
  if (hudBtns && document.getElementById('btn-pause')) {
    hudBtns.insertBefore(editorBtn, document.getElementById('btn-pause'));
  }

  function buildEditorUI() {
    const panel = document.createElement('div');
    panel.id = 'editor-panel';
    panel.style.cssText = 'display:none; position:fixed; top: 110px; left: 50%; transform:translateX(-50%); background:rgba(30,0,15,0.95); padding:8px; border-radius:12px; border:1px solid #ff4f93; z-index:2000; display:flex; flex-wrap:nowrap; gap:8px; max-width:95vw; pointer-events:auto; align-items:center; box-shadow: 0 4px 15px rgba(0,0,0,0.5);';

    const toolWrap = document.createElement('div');
    toolWrap.style.cssText = 'display:flex; gap:6px; overflow-x:auto; flex:1; padding-bottom:4px;';

    const tools = [
      {id:'wall', icon:'🧱', name:'Muro'}, {id:'eraser', icon:'🧽', name:'Gomma'},
      {id:'leaf', icon:'🍃', name:'Foglia'}, {id:'ghost', icon:'👻', name:'Fantasma'},
      {id:'chest', icon:'📦', name:'Baule'}, {id:'heart', icon:'❤️', name:'Vita'},
      {id:'coin', icon:'🪙', name:'Moneta'}, {id:'start', icon:'🚩', name:'Partenza'},
      {id:'exit', icon:'🚪', name:'Uscita'}
    ];

    tools.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'editor-tool-btn';
      btn.dataset.tool = t.id;
      btn.innerHTML = `<span style="font-size:20px; pointer-events:none;">${t.icon}</span><br><span style="font-size:10px; color:#fff; pointer-events:none;">${t.name}</span>`;
      btn.style.cssText = 'min-width:60px; padding:6px; border-radius:8px; background:#4a0c25; border:2px solid transparent; cursor:pointer; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1.1; flex-shrink:0;';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        G.state.editorTool = t.id;
        document.querySelectorAll('.editor-tool-btn').forEach(b => {
          b.style.borderColor = b.dataset.tool === t.id ? '#55dc8b' : 'transparent';
        });
      });
      toolWrap.appendChild(btn);
    });
    panel.appendChild(toolWrap);

    const btnSave = document.createElement('button');
    btnSave.innerHTML = '💾<br>Salva';
    btnSave.style.cssText = 'padding:6px 10px; border-radius:8px; background:#55dc8b; color:#000; font-weight:bold; border:none; cursor:pointer; font-size:11px; display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0; line-height:1.2;';
    btnSave.addEventListener('click', () => { if (saveEditorLevel()) window.location.reload(); });
    panel.appendChild(btnSave);

    const btnCancel = document.createElement('button');
    btnCancel.innerHTML = '❌<br>Annulla';
    btnCancel.style.cssText = 'padding:6px 10px; border-radius:8px; background:#b33c4a; color:#fff; font-weight:bold; border:none; cursor:pointer; font-size:11px; display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0; line-height:1.2;';
    btnCancel.addEventListener('click', () => { window.location.reload(); });
    panel.appendChild(btnCancel);

    document.body.appendChild(panel);
    return panel;
  }

  function getEditorObjectAt(r, c) {
    if (G.leaves.some(l => l.r === r && l.c === c)) return { type: 'leaf' };
    if (G.enemies.some(e => e.r === r && e.c === c)) return { type: 'ghost' };
    if (G.chests.some(ch => ch.r === r && ch.c === c)) return { type: 'chest' };
    if (G.hearts.some(h => h.r === r && h.c === c)) return { type: 'heart' };
    if (G.coins.some(co => co.r === r && co.c === c)) return { type: 'coin' };
    return null;
  }

  function removeEditorObjectAt(r, c) {
    const l = G.leaves.find(l => l.r === r && l.c === c);
    if (l) { G.scene.remove(l.sprite); G.leaves.splice(G.leaves.indexOf(l), 1); }
    const e = G.enemies.find(e => e.r === r && e.c === c);
    if (e) { G.scene.remove(e.sprite); G.enemies.splice(G.enemies.indexOf(e), 1); }
    const ch = G.chests.find(ch => ch.r === r && ch.c === c);
    if (ch) { G.scene.remove(ch.group); G.chests.splice(G.chests.indexOf(ch), 1); }
    const h = G.hearts.find(h => h.r === r && h.c === c);
    if (h) { G.scene.remove(h.sprite); G.hearts.splice(G.hearts.indexOf(h), 1); }
    const co = G.coins.find(co => co.r === r && co.c === c);
    if (co) { G.scene.remove(co.sprite); G.coins.splice(G.coins.indexOf(co), 1); }
  }

  function applyEditorTool(r, c) {
    if (r < 0 || r >= MR || c < 0 || c >= MC) return;
    const tool = G.state.editorTool;

    if (tool === 'wall') {
      if (G.maze[r][c] === 1) G.maze[r][c] = 0;
      else {
        if (G.maze[r][c] === 4 || G.maze[r][c] === 3) return;
        removeEditorObjectAt(r, c);
        G.maze[r][c] = 1;
      }
      G.rebuildWalls();
    } else if (tool === 'eraser') {
      if (G.maze[r][c] === 4 || G.maze[r][c] === 3) return;
      if (G.maze[r][c] === 1) { G.maze[r][c] = 0; G.rebuildWalls(); }
      else { removeEditorObjectAt(r, c); }
    } else if (tool === 'start') {
      if (G.maze[r][c] === 3 || G.maze[r][c] === 1) return;
      for (let i=0; i<MR; i++) for (let j=0; j<MC; j++) if (G.maze[i][j] === 4) G.maze[i][j] = 0;
      removeEditorObjectAt(r, c);
      G.maze[r][c] = 4;
      G.player.r = r; G.player.c = c;
      G.player.x = c * CS; G.player.z = r * CS;
      G.playerGroup.position.set(G.player.x, 0, G.player.z);
      G.startR = r; G.startC = c;
    } else if (tool === 'exit') {
      if (G.maze[r][c] === 4 || G.maze[r][c] === 1) return;
      for (let i=0; i<MR; i++) for (let j=0; j<MC; j++) if (G.maze[i][j] === 3) G.maze[i][j] = 0;
      removeEditorObjectAt(r, c);
      G.maze[r][c] = 3;
      G.doorGroup.position.set(c * CS, 0, r * CS);
      G.exitR = r; G.exitC = c;
    } else {
      if (G.maze[r][c] === 1 || G.maze[r][c] === 4 || G.maze[r][c] === 3) return;
      const existing = getEditorObjectAt(r, c);
      if (existing) {
        if (existing.type === tool) { removeEditorObjectAt(r, c); return; }
        removeEditorObjectAt(r, c);
      }
      if (tool === 'leaf') {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.leafTex, transparent: true, depthWrite: false }));
        sp.scale.set(1.0, 1.0, 1); sp.position.set(c * CS, 0.85, r * CS);
        G.scene.add(sp);
        G.leaves.push({ r, c, sprite: sp, taken: false });
      } else if (tool === 'ghost') {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.ghostTex, transparent: true, depthWrite: false }));
        sp.scale.set(1.25, 1.25, 1); sp.position.set(c * CS, 1.05, r * CS);
        G.scene.add(sp);
        G.enemies.push({
          r, c, initialR: r, initialC: c, sprite: sp, alive: true, dying: 0,
          type: 'hunter', hp: 1, windup: false, windupShoot: 0,
          nextMove: performance.now() + 9999999, nextWhisper: 0,
          canShoot: false, nextShoot: 999999999
        });
      } else if (tool === 'chest') {
        const grp = Entities.makeChestMesh();
        grp.position.set(c * CS, 0, r * CS);
        G.scene.add(grp);
        G.chests.push({ r, c, group: grp, reward: 'heart', opened: false, opening: 0 });
      } else if (tool === 'heart') {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.heartTex, transparent: true, depthWrite: false }));
        sp.scale.set(0.62, 0.62, 1); sp.position.set(c * CS, 0.6, r * CS);
        G.scene.add(sp);
        G.hearts.push({ r, c, sprite: sp, taken: false });
      } else if (tool === 'coin') {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.coinTex, transparent: true, depthWrite: false }));
        sp.scale.set(0.46, 0.46, 1); sp.position.set(c * CS, 0.55, r * CS);
        G.scene.add(sp);
        G.coins.push({ r, c, sprite: sp, taken: false, phase: 0 });
      }
    }
    G.state.lTot = G.leaves.length;
    UI.updateHUD(G.player, G.state);
  }

  function saveEditorLevel() {
    if (G.leaves.length === 0) {
      UI.toast('Aggiungi almeno una foglia prima di salvare!', 3000);
      return false;
    }
    const wallsStr = G.maze.map(row => row.map(v => v === 1 ? '1' : '0').join(''));
    const data = {
      walls: wallsStr,
      start: [G.startR, G.startC],
      exit: [G.exitR, G.exitC],
      leaves: G.leaves.map(l => [l.r, l.c]),
      ghosts: G.enemies.map(e => ({ r: e.r, c: e.c, type: e.type })),
      chests: G.chests.map(ch => ({ r: ch.r, c: ch.c, reward: ch.reward })),
      hearts: G.hearts.map(h => [h.r, h.c]),
      coins: G.coins.map(co => [co.r, co.c])
    };
    saveCustomLevel(G.levelNum, data);

    const newly = Achievements.checkAndUnlock({ event: 'editor' });
    newly.forEach((id, i) => {
      const a = Achievements.ACHIEVEMENTS.find(x => x.id === id);
      if (a) setTimeout(() => UI.toast('🏆 ' + a.name + ' sbloccato!', 3000), i * 400);
    });
    return true;
  }

  window.addEventListener('editorAction', () => {
    if (!G.state.isEditor) return;
    const [dr, dc] = DIRS[G.player.fDir] || [0, 1];
    applyEditorTool(G.player.r + dr, G.player.c + dc);
  });

  editorBtn.addEventListener('click', () => {
    G.state.isEditor = !G.state.isEditor;
    const btnMelee = document.getElementById('btn-melee');
    const btnShoot = document.getElementById('btn-shoot');

    if (G.state.isEditor) {
      editorBtn.innerHTML = '<i class="fas fa-play"></i><span>GIOCA</span>';
      editorBtn.style.background = 'linear-gradient(180deg, #55dc8b, #1a8a4a)';
      G.state.paused = true;
      if (!G.editorPanel) G.editorPanel = buildEditorUI();
      G.editorPanel.style.display = 'flex';
      if (btnMelee) btnMelee.innerHTML = '<i class="fas fa-edit"></i><span>PIAZZA</span>';
      if (btnShoot) btnShoot.style.display = 'none';
      if (!G.state.editorTool) G.state.editorTool = 'wall';
      document.querySelectorAll('.editor-tool-btn').forEach(b => {
        b.style.borderColor = b.dataset.tool === G.state.editorTool ? '#55dc8b' : 'transparent';
      });
      UI.toast('EDITOR: Muoviti e premi PIAZZA per modificare la cella davanti.', 4000);
    } else {
      editorBtn.innerHTML = '<i class="fas fa-edit"></i><span>MODIFICA</span>';
      editorBtn.style.background = 'linear-gradient(180deg, #e5aa34, #a2610b)';
      G.state.paused = false;
      if (G.editorPanel) G.editorPanel.style.display = 'none';
      if (btnMelee) btnMelee.innerHTML = '<i class="fas fa-hand-rock"></i><span>TESTATA</span>';
      if (btnShoot) btnShoot.style.display = '';
      const now = performance.now();
      for (const e of G.enemies) {
        if (!e.alive) continue;
        if (e.nextMove > now + 60000) e.nextMove = now + G.baseILevel + 1000;
        if (e.nextShoot > now + 60000) e.nextShoot = now + G.baseILevel + 2000;
      }
    }
  });
}