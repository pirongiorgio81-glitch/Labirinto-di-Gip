// level-picker.js — Genera la griglia dei 15 livelli in modalità "sbocca livelli"
import { LEVELS } from './levels.js';

const MAX_LEVEL = 15;
const grid = document.getElementById('levels-grid');
if (grid) {
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const level = LEVELS[i];
    if (!level) continue;

    const btn = document.createElement('a');
    btn.className = 'level-btn';
    btn.href = `level.html?l=${i}&free=1`;
    btn.innerHTML = `
      <span class="lv-num">${i}</span>
      <span class="lv-name">${level.name}</span>
    `;
    grid.appendChild(btn);
  }
}