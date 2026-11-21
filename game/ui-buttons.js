// game/ui-buttons.js
import * as Save from '../save.js';

export function initAudioButtons(G) {
  const btnMusic = document.getElementById('btn-mute');
  const btnSfx = document.getElementById('btn-mute-sfx');
  function refreshAudioButtons() {
    const mi = btnMusic && btnMusic.querySelector('i');
    const si = btnSfx && btnSfx.querySelector('i');
    if (mi) mi.className = G.audio.musicPlaying ? 'fas fa-volume-up' : 'fas fa-volume-mute';
    if (si) si.className = G.audio.sfxMuted ? 'fas fa-bell-slash' : 'fas fa-bell';
  }
  refreshAudioButtons();
  if (btnMusic) btnMusic.addEventListener('click', () => { G.audio.toggleMusic(); refreshAudioButtons(); });
  if (btnSfx) btnSfx.addEventListener('click', () => { G.audio.toggleSfx(); refreshAudioButtons(); });
}

export function initMenuButton(G) {
  const btnMenu = document.getElementById('btn-menu');
  if (btnMenu) {
    btnMenu.addEventListener('click', () => {
      if (G.state.isEditor) { G.state.isEditor = false; }
      Save.saveState(G.LEVEL, G.player, G.state, G.coins, G.leaves, G.chests, G.enemies, G.hearts);
    });
  }
}