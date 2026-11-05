// controls.js
export function setupControls(ctx) {
  const { player, state, tryMove, melee, shoot, togglePause } = ctx;
  const held = { up: false, down: false, left: false, right: false };
  let repeatTimer = null;

  const keyMap = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'
  };

  function startRepeat() {
    if (repeatTimer) return;
    repeatTimer = setInterval(() => {
      if (state.paused || state.gameover || state.won) return;
      for (const d of ['up', 'down', 'left', 'right']) {
        if (held[d]) { tryMove(d); break; }
      }
    }, 150);
  }

  function stopRepeat() {
    if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
  }

  function clearHeld() {
    held.up = held.down = held.left = held.right = false;
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat && e.code !== 'KeyZ' && e.code !== 'KeyX') return;
    if (keyMap[e.code]) {
      e.preventDefault();
      if (state.paused || state.gameover || state.won) return;
      const dir = keyMap[e.code];
      if (!held[dir]) { clearHeld(); held[dir] = true; tryMove(dir); startRepeat(); }
    } else if (e.code === 'KeyZ') {
      e.preventDefault();
      if (!state.paused && !state.gameover && !state.won) melee(performance.now());
    } else if (e.code === 'KeyX') {
      e.preventDefault();
      if (!state.paused && !state.gameover && !state.won) shoot(performance.now());
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault(); togglePause();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (keyMap[e.code]) {
      held[keyMap[e.code]] = false;
      if (!held.up && !held.down && !held.left && !held.right) stopRepeat();
    }
  });

  let touchStartX = 0, touchStartY = 0, isTouching = false, thisTouchIsSwipe = false, swipeDir = null;
  const swipeThreshold = 28;

  window.addEventListener('touchstart', (e) => {
    if (e.target.closest('#actions') || e.target.closest('#dpad') || e.target.closest('.panel') || e.target.closest('#hud-bar') || e.target.closest('.overlay')) return;
    touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
    isTouching = true; thisTouchIsSwipe = true; swipeDir = null;
    clearHeld(); stopRepeat();
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!isTouching || state.paused || state.gameover || state.won) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.hypot(dx, dy) >= swipeThreshold) {
      const newDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
      if (swipeDir !== newDir) { swipeDir = newDir; clearHeld(); held[newDir] = true; tryMove(newDir); }
      if (!repeatTimer) startRepeat();
    }
  }, { passive: false });

  function endTouch() { if (!thisTouchIsSwipe) return; thisTouchIsSwipe = false; isTouching = false; swipeDir = null; clearHeld(); stopRepeat(); }
  window.addEventListener('touchend', endTouch);
  window.addEventListener('touchcancel', endTouch);

  document.getElementById('btn-melee').addEventListener('pointerdown', (e) => { e.preventDefault(); if (!state.paused && !state.gameover && !state.won) melee(performance.now()); });
  document.getElementById('btn-shoot').addEventListener('pointerdown', (e) => { e.preventDefault(); if (!state.paused && !state.gameover && !state.won) shoot(performance.now()); });

  document.querySelectorAll('#dpad .dbtn').forEach((btn) => {
    const dir = btn.getAttribute('data-dir');
    if (!dir) return;
    const press = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (state.paused || state.gameover || state.won) return;
      clearHeld(); held[dir] = true; btn.classList.add('active'); tryMove(dir); startRepeat();
    };
    const release = (e) => {
      e.preventDefault(); e.stopPropagation();
      held[dir] = false; btn.classList.remove('active');
      if (!held.up && !held.down && !held.left && !held.right) stopRepeat();
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  });

  document.getElementById('btn-pause').addEventListener('click', togglePause);
  document.getElementById('btn-resume').addEventListener('click', togglePause);

  // I pulsanti restart/retry potrebbero non esistere in alcune schermate
  const restartBtn = document.getElementById('btn-restart');
  if (restartBtn) restartBtn.addEventListener('click', () => ctx.resetLevel());

  const retryBtn = document.getElementById('btn-retry');
  if (retryBtn) retryBtn.addEventListener('click', () => ctx.resetLevel());
}