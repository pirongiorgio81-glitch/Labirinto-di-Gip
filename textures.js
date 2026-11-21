// textures.js
//
// Generatori procedurali di texture (canvas 2D → THREE.CanvasTexture).
// Tutte le texture sono costruite a runtime: nessun asset esterno, nessuna
// richiesta di rete. Le uniche dipendenze sono `three` e le API DOM.
//
// ── NOTA SUI TEMI (#19) ─────────────────────────────────────────────────────
// `makeFloorTexture` accetta un parametro opzionale `theme`:
//   { floor: '#rrggbb', wall, fog, light }
// Usa solo `theme.floor` come colore base del pavimento, scurito in un gradiente
// per dare profondità. Se `theme` è assente (o `theme.floor` non è una stringa
// valida), ricade sul rosa "standard" originale (#7a4456) → retro-compatibile
// al 100% con qualsiasi chiamata preesistente.
// ────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

/**
 * Scurisce un colore esadecimale CSS di una quantità frazionaria (0..1).
 * Es: darken('#7a4456', 0.4) → '#4a2833' circa.
 * Usata internamente da makeFloorTexture per il gradiente.
 */
function darken(hex, amount) {
  if (typeof hex !== 'string' || hex.length !== 7 || hex[0] !== '#') {
    // fallback: nero
    return '#000000';
  }
  const n = parseInt(hex.slice(1), 16);
  if (isNaN(n)) return '#000000';
  const f = Math.max(0, Math.min(1, 1 - amount));
  const r = Math.round(((n >> 16) & 0xff) * f);
  const g = Math.round(((n >> 8) & 0xff) * f);
  const b = Math.round((n & 0xff) * f);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/**
 * Texture del pavimento.
 * @param {{floor?: string}} [theme] - opzionale, { floor: '#rrggbb' }
 * @returns {THREE.CanvasTexture}
 */
export function makeFloorTexture(theme) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');

  const base = (theme && typeof theme.floor === 'string' && theme.floor.length === 7)
    ? theme.floor
    : '#7a4456';

  const grd = ctx.createLinearGradient(0, 0, 256, 256);
  grd.addColorStop(0, base);
  grd.addColorStop(1, darken(base, 0.4));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);

  // Puntinatura scura per "usura"
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = 'rgba(20,0,10,' + (Math.random() * 0.10) + ')';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // Puntinatura chiara per "riflessi"
  for (let i = 0; i < 250; i++) {
    ctx.fillStyle = 'rgba(255,200,215,' + (Math.random() * 0.10) + ')';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(25, 25);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeLeafTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#66bb6a'; ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(64, 14);
  ctx.bezierCurveTo(116, 44, 116, 96, 64, 118);
  ctx.bezierCurveTo(12, 96, 12, 44, 64, 14);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#1b5e20'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(64, 22); ctx.lineTo(64, 112); ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = 40 + i * 15;
    ctx.beginPath(); ctx.moveTo(64, y); ctx.lineTo(40, y + 12);
    ctx.moveTo(64, y); ctx.lineTo(88, y + 12); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeGhostTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('👻', 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeCoinTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 96, 96);
  const glow = ctx.createRadialGradient(48, 48, 16, 48, 48, 46);
  glow.addColorStop(0, 'rgba(255,230,120,0.55)');
  glow.addColorStop(0.7, 'rgba(255,213,74,0.18)');
  glow.addColorStop(1, 'rgba(255,213,74,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 96, 96);
  const outer = ctx.createRadialGradient(38, 38, 4, 48, 48, 36);
  outer.addColorStop(0, '#fff4c4');
  outer.addColorStop(0.5, '#ffd54a');
  outer.addColorStop(1, '#b07c0e');
  ctx.beginPath(); ctx.arc(48, 48, 34, 0, Math.PI * 2); ctx.fillStyle = outer; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#6b4a06'; ctx.stroke();
  ctx.beginPath(); ctx.arc(48, 48, 24, 0, Math.PI * 2);
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(107,74,6,0.65)'; ctx.stroke();
  ctx.font = 'bold 30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#6b4a06'; ctx.fillText('★', 48, 50);
  ctx.beginPath(); ctx.ellipse(36, 32, 9, 5, -Math.PI/4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeContactTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  const grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  grd.addColorStop(0, 'rgba(60,20,40,0.55)');
  grd.addColorStop(0.5, 'rgba(40,10,25,0.25)');
  grd.addColorStop(1, 'rgba(20,0,10,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeDirectionalShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  const grd = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grd.addColorStop(0, 'rgba(0,0,0,0.45)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(32, 32, 30, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeHeartPickupTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const ctx = c.getContext('2d');
  const glow = ctx.createRadialGradient(48, 48, 10, 48, 48, 46);
  glow.addColorStop(0, 'rgba(255,80,140,0.75)');
  glow.addColorStop(1, 'rgba(255,80,140,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 96, 96);
  ctx.fillStyle = '#ff4d88'; ctx.strokeStyle = '#8b1040'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(48, 82);
  ctx.bezierCurveTo(10, 55, 15, 20, 48, 32);
  ctx.bezierCurveTo(81, 20, 86, 55, 48, 82);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeShieldTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(64, 64, 30, 64, 64, 62);
  grd.addColorStop(0, 'rgba(120,200,255,0)');
  grd.addColorStop(0.7, 'rgba(120,200,255,0.55)');
  grd.addColorStop(0.9, 'rgba(180,230,255,0.9)');
  grd.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}