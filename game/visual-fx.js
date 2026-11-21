// game/visual-fx.js
import * as Save from '../save.js';

export function initParticlesDOM() {
  const cont = document.getElementById('particles');
  if (!cont) return;
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    p.className = 'p';
    p.style.left = (Math.random() * 100) + '%';
    const dur = 5 + Math.random() * 7;
    p.style.animationDuration = dur + 's';
    p.style.animationDelay = (-Math.random() * dur) + 's';
    p.style.opacity = (0.4 + Math.random() * 0.6).toFixed(2);
    const sz = 3 + Math.random() * 3;
    p.style.width = sz + 'px';
    p.style.height = sz + 'px';
    cont.appendChild(p);
  }
}

export function initIntroHeartsDOM() {
  const cont = document.getElementById('intro-hearts');
  if (!cont) return;
  const set = ['💗', '💖', '💘', '💕', '💓', '🌸'];
  for (let i = 0; i < 22; i++) {
    const h = document.createElement('div');
    h.className = 'ih';
    h.textContent = set[Math.floor(Math.random() * set.length)];
    h.style.left = (Math.random() * 100) + '%';
    const dur = 3 + Math.random() * 3;
    const delay = Math.random() * 2.5;
    h.style.animationDuration = dur + 's';
    h.style.animationDelay = delay + 's';
    h.style.fontSize = (16 + Math.random() * 22) + 'px';
    cont.appendChild(h);
  }
}

export function initVisualFx(G) {
  const introEl = document.getElementById('intro-overlay');
  setTimeout(() => { if (introEl) introEl.classList.add('fade-out'); }, 1800);
  setTimeout(() => {
    if (introEl && introEl.parentNode) introEl.parentNode.removeChild(introEl);
    G.introDone = true;
    const t = performance.now();
    const grace = Math.max(2000, G.baseILevel + 1500);
    for (const e of G.enemies) {
      e.nextMove = t + grace;
      e.nextShoot = t + grace + Math.random() * 2000;
    }
    G.lastT = t;
    const restored = Save.loadState(G.LEVEL, G.player, G.state, G.coins, G.leaves, G.chests, G.enemies, G.hearts);
    const storyKey = 'labirinto_story_seen_' + G.levelNum;
    if (!restored && !localStorage.getItem(storyKey)) {
      const el = document.getElementById('story-line');
      if (el) {
        el.textContent = G.LEVEL.story;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 4000);
      }
      try { localStorage.setItem(storyKey, '1'); } catch (_) {}
    }
  }, 2400);
}