// save.js
//
// Persistenza dello stato di gioco su localStorage.
//
// ── NOTA SU lTot (#25) ──────────────────────────────────────────────────────
// Salviamo anche `state.lTot` nel JSON, ma al CARICAMENTO non lo usiamo per
// sovrascrivere `state.lTot`: la fonte autorevole è SEMPRE `leaves.length`
// del livello corrente. Motivo:
//   Se l'utente salva una partita (es. 4 foglie), poi edita il livello nell'editor
//   riducendolo a 2 foglie, e infine ricarica la pagina, ripristinare lTot=4
//   renderebbe il livello IMPOSSIBILE (la porta richiede 4 foglie ma ce ne sono 2).
//   Viceversa con lTot=6 e foglie=4 si creerebbe un softlock permanente.
// Per lo stesso motivo `state.lCol` viene ricalcolato contando le foglie che
// risultano effettivamente raccolte nel livello corrente, invece di fidarsi
// ciecamente di `s.lCol`.
//
// Il campo `lTot` resta comunque nel JSON per debug/tooling ed è utile a
// eventuali statistiche o export futuri.
// ────────────────────────────────────────────────────────────────────────────
//
// ── NOTA SU Bug 3 (pause ↔ shop) ────────────────────────────────────────────
// `saveState()` salva SOLO `labirinto_state` (la fotografia della partita in
// corso, con HP/shield/ammo correnti). NON tocca più `labirinto_hp`,
// `labirinto_shields`, `labirinto_ammo`, `labirinto_coins`: quelle chiavi
// rappresentano i valori BASE del livello (inclusi gli acquisti dallo shop)
// e devono restare stabili finché il livello non viene vinto (dove è
// `winLevel()` a volerli aggiornare per passarli al livello successivo).
// Altrimenti una pausa con HP danneggiati "congelerebbe" il danno come nuovo
// valore base, facendo perdere gli acquisti shop al riavvio.
// ────────────────────────────────────────────────────────────────────────────

import { pulseSaveIndicator, updateHUD } from './ui.js';
import { CS } from './constants.js';

export function saveState(level, player, state, coins, leaves, chests, enemies, hearts) {
  try {
    const coinsTaken = [];
    const leavesTaken = [];
    const chestsOpened = [];
    const enemiesState = [];
    const heartsTaken = [];

    for (const co of coins) if (co.taken) coinsTaken.push(co.r + ',' + co.c);
    for (const lf of leaves) if (lf.taken) leavesTaken.push(lf.r + ',' + lf.c);
    for (const ch of chests) if (ch.opened) chestsOpened.push(ch.r + ',' + ch.c);
    // hp dei nemici corazzati incluso (#6)
    for (const e of enemies) enemiesState.push({ r: e.r, c: e.c, alive: !!e.alive && !e.dying, hp: e.hp });
    for (const hc of hearts) if (hc.taken) heartsTaken.push(hc.r + ',' + hc.c);

    const obj = {
      level: level.index,
      r: player.r,
      c: player.c,
      moves: state.moves,
      elapsed: state.elapsed,
      hp: player.hp,
      shields: player.shields,
      ammo: player.ammo,
      lCol: state.lCol,
      lTot: typeof state.lTot === 'number' ? state.lTot : leaves.length, // #25
      coinsLevel: state.coinsLevel,
      coinsTaken,
      leavesTaken,
      chestsOpened,
      enemiesState,
      heartsTaken,
      playerDir: player.fDir,
      doorOpen: !!state.doorOpen,
      gameover: !!state.gameover
    };
    localStorage.setItem('labirinto_state', JSON.stringify(obj));
    // ✅ FIX BUG 3 — Non scrivere più qui labirinto_hp/_shields/_ammo/_coins.
    //    Sono le chiavi "base" del livello (con acquisti shop) e devono restare
    //    intatte durante la pausa. Lo stato corrente è già dentro labirinto_state.
  } catch (e) {}
  pulseSaveIndicator();
}

export function loadState(level, player, state, coins, leaves, chests, enemies, hearts) {
  try {
    const raw = localStorage.getItem('labirinto_state');
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || s.level !== level.index) return false;

    // ── Giocatore: posizione e statistiche ────────────────────────────────
    player.r = s.r;
    player.c = s.c;
    player.x = s.c * CS;
    player.z = s.r * CS;
    player.fDir = s.playerDir || 'down';
    player.hp     = Math.max(1, Math.min(99, s.hp));
    player.shields = Math.max(0, Math.min(99, s.shields));
    player.ammo   = Math.max(0, Math.min(99, s.ammo));

    // ── Stato livello ─────────────────────────────────────────────────────
    state.moves = s.moves || 0;
    state.elapsed = s.elapsed || 0;
    state.coinsLevel = s.coinsLevel || 0;
    state.coinToastShown = state.coinsLevel > 0;
    state.doorOpen = !!s.doorOpen;

    // #25: lTot autorevole = dimensione attuale di `leaves`
    // (ignoriamo deliberatamente s.lTot per evitare softlock — vedi nota sopra)
    state.lTot = leaves.length;

    // ── Ripristino monete ─────────────────────────────────────────────────
    const takenCoins = new Set(s.coinsTaken || []);
    for (const co of coins) {
      if (takenCoins.has(co.r + ',' + co.c) && !co.taken) {
        co.taken = true;
        co.sprite.parent?.remove(co.sprite);
      }
    }

    // ── Ripristino cuori raccolti ─────────────────────────────────────────
    const takenHearts = new Set(s.heartsTaken || []);
    for (const hc of hearts) {
      if (takenHearts.has(hc.r + ',' + hc.c) && !hc.taken) {
        hc.taken = true;
        hc.sprite.parent?.remove(hc.sprite);
      }
    }

    // ── Ripristino bauli aperti ───────────────────────────────────────────
    const openedChests = new Set(s.chestsOpened || []);
    for (const ch of chests) {
      if (openedChests.has(ch.r + ',' + ch.c) && !ch.opened) {
        ch.opened = true;
        ch.group.parent?.remove(ch.group);
      }
    }

    // ── Foglie: ripristino + ricalcolo coerente di lCol ───────────────────
    const takenLeaves = new Set(s.leavesTaken || []);
    state.lCol = 0;
    for (const lf of leaves) {
      if (takenLeaves.has(lf.r + ',' + lf.c) && !lf.taken) {
        lf.taken = true;
        lf.sprite.parent?.remove(lf.sprite);
      }
      if (lf.taken) state.lCol++;
    }

    // Self-healing: se tutte le foglie del livello corrente risultano raccolte
    // ma per qualche motivo la porta non era flaggata come aperta
    // (save vecchi, drift dopo editing del livello), la apriamo.
    // Vale anche per livelli con 0 foglie (0 >= 0).
    if (state.lCol >= state.lTot) state.doorOpen = true;

    // ── Nemici ────────────────────────────────────────────────────────────
    if (Array.isArray(s.enemiesState)) {
      for (let i = 0; i < enemies.length && i < s.enemiesState.length; i++) {
        const es = s.enemiesState[i];
        const e = enemies[i];
        e.r = es.r;
        e.c = es.c;
        // #6: ripristina gli HP dei nemici corazzati
        if (typeof es.hp === 'number') e.hp = es.hp;
        e.sprite.position.set(e.c * CS, 1.05, e.r * CS);
        if (es.alive === false) {
          e.alive = false;
          e.dying = 0;
          e.sprite.parent?.remove(e.sprite);
        }
      }
    }

    // Aggiorna l'HUD coi valori appena ripristinati.
    // Serve perché in game.js l'updateHUD iniziale avviene PRIMA che loadState()
    // venga chiamato (dentro il setTimeout dell'intro), quindi senza questo
    // l'HUD mostrerebbe i valori "nuova partita" fino al primo input.
    try { updateHUD(player, state); } catch (_) {}

    return true;
  } catch (e) {
    return false;
  }
}