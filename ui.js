// ui.js
import { REDUCED_MOTION } from './constants.js';

let toastTO = 0;
let _lastTimerSec = -1;

// Cache del DOM
const DOM = {};

export function buildDOM(level, startHP, startAmmo) {
  const isLast = !!level.isLast;

  const winBlock = isLast
    ? `<div id="final-flash">
         <div class="hearts-row">💗 💖 💘 💕 💗</div>
         <div class="big">VITTORIA!</div>
         <div class="small">Il Labirinto è stato sconfitto…</div>
         <div class="hearts-row">💗 💖 💘 💕 💗</div>
       </div>`
    : `<div id="overlay-win" class="overlay">
         <div class="panel">
           <h2 style="color:#00c853; font-family:'Cinzel',serif; font-size:22px; letter-spacing:2px;">Livello Completato!</h2>
           <div class="winstats">Tempo: <span id="w-time">00:00</span></div>
           <div class="winstats">Mosse: <span id="w-moves">0</span></div>
           <div class="winstats coin-line"><i class="fas fa-coins"></i> <span id="w-coins">0</span> Monete in questo livello</div>
           <a href="shop.html" class="pbtn" style="margin-top:14px; display:inline-flex;">
             <i class="fas fa-store"></i> Vai allo Shop
           </a>
           <a href="${level.next}" class="pbtn" style="margin-top:14px">Livello ${level.index + 1} →</a>
         </div>
       </div>`;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="webgl-missing">WebGL non è disponibile su questo dispositivo/browser. Il gioco non può partire.</div>
    <div id="lm">Caricamento labirinto…</div>
    <div id="intro-overlay">
      <div class="intro-pulse"></div>
      <div class="intro-hearts" id="intro-hearts"></div>
      <h1 class="intro-title">${level.name}</h1>
      <div class="intro-divider"></div>
      <p class="intro-sub">Livello ${level.index}</p>
    </div>
    <div id="particles"></div>
    <canvas id="game"></canvas>
    <div id="hud">
      <div id="hud-bar">
        <div id="hud-row1">
          <div id="hud-level">Livello ${level.index} — ${level.name}</div>
          <div id="hud-btns">
            <div id="save-dot"></div>
            <a id="btn-menu" class="tbtn" href="index.html" aria-label="Menu">
              <i class="fas fa-home"></i><span>MENU</span>
            </a>
            <button id="btn-pause" class="tbtn" type="button" aria-label="Pausa">
              <i class="fas fa-pause"></i><span>PAUSA</span>
            </button>
            <button id="btn-mute" class="tbtn" type="button" aria-label="Musica" title="Musica">
              <i class="fas fa-volume-up"></i><span>MUSICA</span>
            </button>
            <button id="btn-mute-sfx" class="tbtn" type="button" aria-label="Effetti sonori" title="Effetti sonori">
              <i class="fas fa-bell"></i><span>SFX</span>
            </button>
          </div>
        </div>
        <div id="hud-row2">
          <div class="run-info timer"><i class="fas fa-clock"></i><span id="hud-timer">00:00</span></div>
          <div class="run-info moves"><i class="fas fa-shoe-prints"></i><span id="hud-moves">0</span></div>
          <div class="run-info coins"><i class="fas fa-coins"></i><span id="coins">0</span></div>
        </div>
        <div id="hud-row3">
          <div class="stat hp"><i class="fas fa-heart"></i><span id="hp">${startHP}</span></div>
          <div class="stat sh"><i class="fas fa-shield-alt"></i><span id="shields">0</span></div>
          <div class="stat am"><i class="fas fa-crosshairs"></i><span id="ammo">${startAmmo}</span></div>
          <div class="stat lf"><i class="fas fa-leaf"></i><span id="leaves">0/0</span></div>
        </div>
      </div>
    </div>
    <div id="controls">
      <div id="dpad">
        <button class="dbtn" data-dir="up" style="grid-area:u" type="button" aria-label="Su">▲</button>
        <button class="dbtn" data-dir="left" style="grid-area:l" type="button" aria-label="Sinistra">◀</button>
        <button class="dbtn" data-dir="down" style="grid-area:d" type="button" aria-label="Giù">▼</button>
        <button class="dbtn" data-dir="right" style="grid-area:r" type="button" aria-label="Destra">▶</button>
      </div>
      <div id="actions">
        <button id="btn-melee" class="abtn melee" type="button">
          <i class="fas fa-hand-rock"></i><span>TESTATA</span>
        </button>
        <button id="btn-shoot" class="abtn shoot" type="button">
          <i class="fas fa-crosshairs"></i><span>SPARO</span>
        </button>
      </div>
    </div>
    <div id="toast" role="status" aria-live="polite"></div>
    <div id="story-line" role="status" aria-live="polite"></div>
    <div id="overlay-pause" class="overlay">
      <div class="panel">
        <h2>Pausa</h2>
        <div class="winstats">Tempo: <span id="p-time">00:00</span></div>
        <div class="winstats">Mosse: <span id="p-moves">0</span></div>
        <div class="winstats">Foglie: <span id="p-leaves">0/0</span></div>
        <div class="winstats">Distanza uscita: <span id="p-dist">0</span></div>
        <button id="btn-resume" type="button">Riprendi</button>
        <button id="btn-restart" type="button">Ricomincia</button>
        <a href="index.html" class="pbtn gold" id="btn-menu-pause" style="margin-top:9px">Menu</a>
      </div>
    </div>
    ${winBlock}
  `);

  // Popola la cache DOM
  DOM.hp = document.getElementById('hp');
  DOM.shields = document.getElementById('shields');
  DOM.ammo = document.getElementById('ammo');
  DOM.leaves = document.getElementById('leaves');
  DOM.moves = document.getElementById('hud-moves');
  DOM.coins = document.getElementById('coins');
  DOM.timer = document.getElementById('hud-timer');
  DOM.toast = document.getElementById('toast');
  DOM.saveDot = document.getElementById('save-dot');
}

export function updateHUD(player, state) {
  if (DOM.hp) DOM.hp.textContent = player.hp;
  if (DOM.shields) DOM.shields.textContent = player.shields;
  if (DOM.ammo) DOM.ammo.textContent = player.ammo;
  if (DOM.leaves) DOM.leaves.textContent = state.lCol + '/' + state.lTot;
  if (DOM.moves) DOM.moves.textContent = state.moves;
  if (DOM.coins) DOM.coins.textContent = state.coinsTotal;
}

export function updateTimer(state) {
  const t = Math.floor(state.elapsed);
  if (t === _lastTimerSec) return;
  _lastTimerSec = t;
  if (!DOM.timer) return;
  const m = String(Math.floor(t / 60)).padStart(2, '0');
  const s = String(t % 60).padStart(2, '0');
  DOM.timer.textContent = m + ':' + s;
}

export function toast(msg, dur = 1600) {
  if (!DOM.toast) return;
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  clearTimeout(toastTO);
  toastTO = setTimeout(() => DOM.toast.classList.remove('show'), dur);
}

export function shake(amp, ms, state) {
  if (REDUCED_MOTION || localStorage.getItem('labirinto_disable_shake') === '1') return;
  state.shakeAmp = amp;
  state.shakeT = ms;
}

export function flashRed() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;background:rgba(255,40,80,0.35);z-index:150;pointer-events:none;transition:opacity .35s ease';
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '0'; });
  setTimeout(() => el.remove(), 400);
}

export function pulseSaveIndicator() {
  if (!DOM.saveDot) return;
  DOM.saveDot.style.background = '#66ff88';
  clearTimeout(DOM.saveDot._to);
  DOM.saveDot._to = setTimeout(() => { DOM.saveDot.style.background = 'transparent'; }, 300);
}