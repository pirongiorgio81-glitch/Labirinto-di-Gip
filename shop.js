// shop.js — Logica dello Shop con anteprima 3D
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MAX_HP, MAX_AM } from './constants.js';

/* ============ CONFIGURAZIONE ============ */
const SHOP_CONFIG = {
  hp:   { cost: 500, amount: 1 },
  ammo: { cost: 300, amount: 3 },
  char: { cost: 1000 } // fallback (i costi reali sono su CHARACTERS)
};

const CHARACTERS = [
  { id: 'gip', name: 'Gip (Originale)', free: true, isGLB: true },
  { id: 'char1', name: 'Nelly',  file: 'char1.png', cost: 1000 },
  { id: 'char2', name: 'Milù',   file: 'char2.png', cost: 2000 },
  { id: 'char3', name: 'Micio',  file: 'char3.png', cost: 3000 },
  { id: 'char4', name: 'Pio',    file: 'char4.png', cost: 4000 },
  { id: 'char5', name: 'Bobo',   file: 'char5.png', cost: 5000 },
  { id: 'char6', name: 'Nelly2', file: 'char6.png', cost: 6000 }
];

/* ============ STATO ============ */
let coins = 0;
let purchased = [];
let active = 'gip';

/* ============ GESTIONE THREE.JS (Anteprima 3D) ============ */
let gridGipCleanup = null;
let modalGipCleanup = null;

function createGipPreview(containerId, width, height) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.className = 'modal-canvas';
  container.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch(e) {
    console.warn("WebGL non disponibile per l'anteprima 3D", e);
    container.innerHTML = '<div style="font-size:40px; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">💗</div>';
    return null;
  }

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 1, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 2);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  let model;
  const loader = new GLTFLoader();

  loader.load('./gip.glb', (gltf) => {
    model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);

    model.position.x = -center.x;
    model.position.z = -center.z;
    model.position.y = -box.min.y;

    const wrapper = new THREE.Group();
    wrapper.add(model);
    wrapper.scale.setScalar(1.8);
    wrapper.position.y = 0;

    scene.add(wrapper);
  }, undefined, () => {
    container.innerHTML = '<div style="font-size:40px; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">💗</div>';
  });

  let req;
  function animate() {
    req = requestAnimationFrame(animate);
    if (model) {
      model.rotation.y += 0.01;
    }
    renderer.render(scene, camera);
  }
  animate();

  return () => {
    cancelAnimationFrame(req);
    renderer.dispose();
  };
}

/* ============ STATO E SALVATAGGIO ============ */
function loadState(){
  try {
    const c = parseInt(localStorage.getItem('labirinto_coins') || '0', 10);
    coins = isNaN(c) || c < 0 ? 0 : c;

    const p = localStorage.getItem('labirinto_purchased_chars');
    if(p){
      try { purchased = JSON.parse(p); } catch(_) { purchased = []; }
    } else {
      purchased = [];
    }
    if(!Array.isArray(purchased)) purchased = [];

    active = localStorage.getItem('labirinto_active_char') || 'gip';
    if(active !== 'gip' && !purchased.includes(active)) active = 'gip';
  } catch(_) {
    coins = 0;
    purchased = [];
    active = 'gip';
  }
}

function saveCoins(){ try{ localStorage.setItem('labirinto_coins', String(coins)); }catch(_){} }
function savePurchased(){ try{ localStorage.setItem('labirinto_purchased_chars', JSON.stringify(purchased)); }catch(_){} }
function saveActive(){ try{ localStorage.setItem('labirinto_active_char', active); }catch(_){} }

/* ============ UI ============ */
function getCurrentHP(){
  const v = parseInt(localStorage.getItem('labirinto_hp') || '3', 10);
  return isNaN(v) || v < 1 ? 3 : v;
}
function getCurrentAmmo(){
  const v = parseInt(localStorage.getItem('labirinto_ammo') || '3', 10);
  return isNaN(v) || v < 0 ? 3 : v;
}

function updateUI(){
  const coinsEl = document.getElementById('shop-coins');
  if(coinsEl) coinsEl.textContent = String(coins);
  const hpEl = document.getElementById('current-hp');
  const amEl = document.getElementById('current-ammo');
  if(hpEl) hpEl.textContent = String(getCurrentHP());
  if(amEl) amEl.textContent = String(getCurrentAmmo());

  const hpBtn = document.querySelector('[data-buy="hp"]');
  const amBtn = document.querySelector('[data-buy="ammo"]');
  if(hpBtn) hpBtn.disabled = coins < SHOP_CONFIG.hp.cost || getCurrentHP() >= MAX_HP;
  if(amBtn) amBtn.disabled = coins < SHOP_CONFIG.ammo.cost || getCurrentAmmo() >= MAX_AM;
}

function renderChars(){
  if (gridGipCleanup) {
    gridGipCleanup();
    gridGipCleanup = null;
  }

  const grid = document.getElementById('chars-grid');
  if(!grid) return;
  grid.innerHTML = '';

  CHARACTERS.forEach(ch => {
    const owned = purchased.includes(ch.id) || ch.free || ch.id === 'gip';
    const isActive = active === ch.id;
    const charCost = ch.cost || SHOP_CONFIG.char.cost;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'char-card' + (isActive ? ' active' : '') + (owned ? ' owned' : '');

    let thumbHtml;
    if (ch.isGLB) {
      thumbHtml = `<div class="char-thumb" id="gip-thumb-container"></div>`;
    } else {
      thumbHtml = `<div class="char-thumb"><img src="${ch.file}" alt="${ch.name}" loading="lazy" onerror="this.style.opacity='0.3'"></div>`;
    }

    card.innerHTML = `
      ${thumbHtml}
      <div class="char-name">${ch.name}</div>
      <div class="char-status">${
        isActive ? '✓ Equipaggiato'
        : owned  ? 'Posseduto'
        : ch.free ? 'Gratis'
        : '🔒 ' + charCost + ' ★'
      }</div>
    `;
    card.addEventListener('click', () => openCharModal(ch));
    grid.appendChild(card);
  });

  if (document.getElementById('gip-thumb-container')) {
    gridGipCleanup = createGipPreview('gip-thumb-container', 88, 88);
  }
}

/* ============ MODALE ============ */
let currentChar = null;

function openCharModal(ch){
  currentChar = ch;

  if (modalGipCleanup) {
    modalGipCleanup();
    modalGipCleanup = null;
  }

  const modal = document.getElementById('char-modal');
  const img = document.getElementById('modal-img');
  const gipContainer = document.getElementById('modal-gip-container');
  const name = document.getElementById('modal-name');
  const status = document.getElementById('modal-status');
  const price = document.getElementById('modal-price');
  const actionBtn = document.getElementById('modal-action-btn');

  if (!modal || !img || !gipContainer || !name || !status || !price || !actionBtn) return;

  name.textContent = ch.name;
  const owned = purchased.includes(ch.id) || ch.free || ch.id === 'gip';
  const isActive = active === ch.id;
  const charCost = ch.cost || SHOP_CONFIG.char.cost;

  if (ch.isGLB) {
    img.style.display = 'none';
    gipContainer.style.display = 'block';

    modalGipCleanup = createGipPreview('modal-gip-container', 180, 180);

    status.textContent = 'Personaggio originale 3D';
    price.textContent = '';
    actionBtn.textContent = isActive ? 'Equipaggiato' : 'Equipaggia';
    actionBtn.disabled = isActive;

    modal.classList.add('show');
    return;
  }

  gipContainer.style.display = 'none';
  img.style.display = 'block';
  img.src = ch.file;
  img.alt = ch.name;

  if(isActive){
    status.textContent = '✓ Attualmente equipaggiato';
    price.textContent = '';
    actionBtn.textContent = 'Equipaggiato';
    actionBtn.disabled = true;
  } else if(owned){
    status.textContent = ch.free ? 'Personaggio base' : '✓ Posseduto';
    price.textContent = (ch.free && !owned) ? 'Gratis' : '';
    actionBtn.textContent = 'Equipaggia';
    actionBtn.disabled = false;
  } else {
    status.textContent = 'Da acquistare';
    price.textContent = charCost + ' ★';
    actionBtn.textContent = 'Acquista (' + charCost + ' ★)';
    actionBtn.disabled = coins < charCost;
  }

  modal.classList.add('show');
}

function closeModal(){
  const modal = document.getElementById('char-modal');
  if(modal) modal.classList.remove('show');

  if (modalGipCleanup) {
    modalGipCleanup();
    modalGipCleanup = null;
  }

  currentChar = null;
}

/* ============ EVENTI ============ */
function bindEvents(){
  const actionBtn = document.getElementById('modal-action-btn');
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      if(!currentChar) return;
      const ch = currentChar;
      const owned = purchased.includes(ch.id) || ch.free || ch.id === 'gip';
      const charCost = ch.cost || SHOP_CONFIG.char.cost;

      if(owned){
        active = ch.id;
        saveActive();
        updateUI();
        renderChars();
        closeModal();
      } else {
        if(coins < charCost) return;
        coins -= charCost;
        saveCoins();
        if(!purchased.includes(ch.id)) purchased.push(ch.id);
        savePurchased();
        active = ch.id;
        saveActive();
        updateUI();
        renderChars();
        closeModal();
      }
    });
  }

  const closeBtn = document.getElementById('modal-close');
  if(closeBtn) closeBtn.addEventListener('click', closeModal);

  const cancelBtn = document.getElementById('modal-cancel-btn');
  if(cancelBtn) cancelBtn.addEventListener('click', closeModal);

  const charModal = document.getElementById('char-modal');
  if(charModal) {
    charModal.addEventListener('click', (e) => {
      if(e.target.id === 'char-modal') closeModal();
    });
  }

  document.querySelectorAll('[data-buy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.buy;
      const cfg = SHOP_CONFIG[type];
      if(!cfg) return;
      if(coins < cfg.cost) return;

      if(type === 'hp'){
        const cur = getCurrentHP();
        const next = Math.min(MAX_HP, cur + cfg.amount);
        if(next === cur) return;
        try{ localStorage.setItem('labirinto_hp', String(next)); }catch(_){}
      } else if(type === 'ammo'){
        const cur = getCurrentAmmo();
        const next = Math.min(MAX_AM, cur + cfg.amount);
        if(next === cur) return;
        try{ localStorage.setItem('labirinto_ammo', String(next)); }catch(_){}
      }

      coins -= cfg.cost;
      saveCoins();
      updateUI();
    });
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      tab.classList.add('active');
      const target = document.getElementById('tab-' + tab.dataset.tab);
      if(target) target.classList.remove('hidden');
    });
  });

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') closeModal();
  });

  const resetPurchasesBtn = document.getElementById('reset-purchases-btn');
  if (resetPurchasesBtn) {
    resetPurchasesBtn.addEventListener('click', () => {
      if (confirm('Sei sicuro di voler resettare tutti gli acquisti dei personaggi? Dovrai riacquistarli.')) {
        purchased = [];
        active = 'gip';
        savePurchased();
        saveActive();
        updateUI();
        renderChars();
        alert('Acquisti personaggi resettati. Tutti i personaggi (tranne Gip) sono di nuovo acquistabili.');
      }
    });
  }

  // ✅ Azzera salvadanaio — tocca SOLO labirinto_coins
  // (non labirinto_cumulative / labirinto_last_result, che sono della run corrente)
  const resetSavingsBtn = document.getElementById('reset-savings-btn');
  if (resetSavingsBtn) {
    resetSavingsBtn.addEventListener('click', () => {
      if (confirm('Sei sicuro di voler azzerare il salvadanaio?\nPerderai tutte le monete accumulate finora (incluso il saldo spendibile nello shop).')) {
        coins = 0;
        saveCoins();
        updateUI();
        renderChars();
        alert('Salvadanaio azzerato. Riparti da 0 ★.');
      }
    });
  }
}

function setupContinueButton(){
  const nextUrl = localStorage.getItem('labirinto_next_url');
  const btn = document.getElementById('continue-btn');
  if(nextUrl && btn){
    btn.href = nextUrl;
    btn.hidden = false;
  }
}

/* ============ INIT ============ */
try {
  loadState();
  updateUI();
  renderChars();
  bindEvents();
  setupContinueButton();
} catch (err) {
  console.error("Errore nell'inizializzazione dello shop:", err);
}

window.addEventListener('beforeunload', () => {
  if (gridGipCleanup) gridGipCleanup();
  if (modalGipCleanup) modalGipCleanup();
});