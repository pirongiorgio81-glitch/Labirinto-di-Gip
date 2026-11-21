// achievements.js
const STORAGE_KEY = 'labirinto_achievements';

export const ACHIEVEMENTS = [
  { id: 'first_kill', name: 'Primo Sangue', desc: 'Uccidi il tuo primo fantasma', icon: '💀' },
  { id: 'first_win', name: 'Primo Passo', desc: 'Completa il livello 1', icon: '🌱' },
  { id: 'level_5', name: 'Cuore Coraggioso', desc: 'Completa il livello 5', icon: '💗' },
  { id: 'level_10', name: 'Anima Temprata', desc: 'Completa il livello 10', icon: '🔥' },
  { id: 'finish', name: 'Vincitore', desc: 'Completa il gioco', icon: '👑' },
  { id: 'perfect', name: 'Senza un Graffio', desc: 'Completa un livello senza perdere vita', icon: '💎' },
  { id: 'hoarder_10', name: 'Accaparratore', desc: 'Raccogli 10 monete in un livello', icon: '🪙' },
  { id: 'hoarder_50', name: 'Tesoriere', desc: 'Accumula 50 monete totali', icon: '💰' },
  { id: 'no_shoot', name: "Pugni d'Acciaio", desc: 'Completa un livello senza sparare', icon: '🤜' },
  { id: 'editor', name: 'Architetto', desc: 'Salva un livello personalizzato', icon: '🏗️' },
  { id: 'first_death', name: 'Caduto', desc: 'Perdi per la prima volta', icon: '💔' },
];

export function loadUnlocked() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch(_) { return new Set(); }
}

export function unlock(id) {
  const unlocked = loadUnlocked();
  if (unlocked.has(id)) return false;
  if (!ACHIEVEMENTS.some(a => a.id === id)) return false;
  unlocked.add(id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked])); } catch(_) {}
  return true;
}

export function checkAndUnlock(context) {
  const newlyUnlocked = [];
  const tryUnlock = (id, condition) => {
    if (condition && unlock(id)) newlyUnlocked.push(id);
  };

  if (context.event === 'kill') {
    tryUnlock('first_kill', true);
  }
  if (context.event === 'gameover') {
    tryUnlock('first_death', true);
  }
  if (context.event === 'editor') {
    tryUnlock('editor', true);
  }
  if (context.event === 'win') {
    tryUnlock('first_win', context.levelNum === 1);
    tryUnlock('level_5', context.levelNum >= 5);
    tryUnlock('level_10', context.levelNum >= 10);
    tryUnlock('finish', !!context.isLast);
    tryUnlock('perfect', (context.hpLost || 0) === 0);
    tryUnlock('hoarder_10', (context.coinsLevel || 0) >= 10);
    tryUnlock('hoarder_50', (context.coinsTotal || 0) >= 50);
    tryUnlock('no_shoot', (context.shotsFired || 0) === 0);
  }
  return newlyUnlocked;
}

export function getUnlockedDetails() {
  const unlocked = loadUnlocked();
  return ACHIEVEMENTS.map(a => ({ ...a, unlocked: unlocked.has(a.id) }));
}

export function getProgress() {
  const unlocked = loadUnlocked();
  return { unlocked: unlocked.size, total: ACHIEVEMENTS.length };
}