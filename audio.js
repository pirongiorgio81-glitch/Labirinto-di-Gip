// audio.js
export class AudioManager {
  constructor() {
    this.actx = null;
    this.sfxMaster = null;
    this.musicCtx = null;
    this.musicMaster = null;
    this.musicTimer = null;
    this.musicChordIdx = 0;
    this.musicPlaying = true;
    this.musicStarted = false;
    this.MUSIC_VOL = 0.75;

    try { if (localStorage.getItem('labirinto_music_muted') === '1') this.musicPlaying = false; } catch (e) {}

    this.MUSIC_CHORDS = [
      { freqs:[ 65.41, 130.81, 164.81, 196.00, 246.94], dur: 5.0 },
      { freqs:[110.00, 220.00, 261.63, 329.63, 392.00], dur: 5.0 },
      { freqs:[ 87.31, 174.61, 220.00, 261.63, 329.63], dur: 5.0 },
      { freqs:[ 98.00, 196.00, 246.94, 293.66, 392.00], dur: 5.0 },
      { freqs:[ 65.41, 130.81, 164.81, 196.00, 246.94], dur: 5.0 },
      { freqs:[ 82.41, 164.81, 196.00, 246.94, 293.66], dur: 5.0 },
      { freqs:[ 73.42, 146.83, 174.61, 220.00, 261.63], dur: 5.0 },
      { freqs:[ 98.00, 196.00, 246.94, 293.66, 349.23], dur: 5.5 }
    ];
    
    this.BIRD_NOTES = [
      [523.25, 659.25, 783.99],
      [659.25, 783.99, 1046.50],
      [523.25, 783.99, 1046.50],
      [880.00, 1046.50, 1318.51],
      [783.99, 987.77, 1174.66]
    ];

    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('touchstart', () => this.tryStartMusic(), { once: true, passive: true });
    document.addEventListener('click', () => this.tryStartMusic(), { once: true });
    document.addEventListener('keydown', () => this.tryStartMusic(), { once: true });

    window.addEventListener('storage', (e) => {
      if (e.key === 'labirinto_music_muted') {
        const muted = e.newValue === '1';
        if (muted && this.musicCtx) {
          this.fadeMusicTo(0, 0.5);
          this.musicPlaying = false;
          this.updateSfxMute();
        } else if (!muted) {
          this.musicPlaying = true;
          if (!this.musicCtx && this.musicStarted) {
            this.startMusicEngine();
          } else if (this.musicCtx) {
            this.fadeMusicTo(this.MUSIC_VOL * 0.40, 0.6);
          }
          this.updateSfxMute();
        }
      }
    });
  }

  ac() {
    if (!this.actx) this.actx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.actx.state === 'suspended') this.actx.resume();
    if (!this.sfxMaster) {
      this.sfxMaster = this.actx.createGain();
      this.sfxMaster.gain.value = this.musicPlaying ? 1 : 0;
      this.sfxMaster.connect(this.actx.destination);
    }
    return this.actx;
  }

  tone(f1, f2, type, dur, vol = 0.15) {
    try {
      const a = this.ac();
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, a.currentTime);
      if (f2 !== f1) o.frequency.linearRampToValueAtTime(f2, a.currentTime + dur);
      g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(vol, a.currentTime + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(g).connect(this.sfxMaster || a.destination);
      o.start();
      o.stop(a.currentTime + dur + 0.02);
    } catch (e) {}
  }

  updateSfxMute() {
    if (this.sfxMaster) {
      const target = this.musicPlaying ? 1 : 0;
      try {
        const t = this.actx.currentTime;
        this.sfxMaster.gain.cancelScheduledValues(t);
        this.sfxMaster.gain.setValueAtTime(this.sfxMaster.gain.value, t);
        this.sfxMaster.gain.linearRampToValueAtTime(target, t + 0.3);
      } catch (_) {}
    }
  }

  play(soundName) {
    const SND = {
      leaf:  () => this.tone(880, 1100, 'sine', 0.12, 0.12),
      coin:  () => { this.tone(880, 1318, 'sine', 0.18, 0.075); setTimeout(()=> this.tone(1318, 1760, 'sine', 0.14, 0.05), 70); },
      shoot: () => this.tone(200, 100, 'sawtooth', 0.15, 0.15),
      enemy_shoot: () => this.tone(240, 120, 'sawtooth', 0.15, 0.13),
      melee: () => this.tone(150, 80, 'triangle', 0.15, 0.18),
      melee_miss: () => this.tone(300, 200, 'triangle', 0.07, 0.10),
      noammo:() => this.tone(120, 100, 'square', 0.10, 0.12),
      hurt:  () => this.tone(90, 50, 'sawtooth', 0.25, 0.20),
      door:  () => this.tone(440, 660, 'sine', 0.28, 0.18),
      win:   () => { this.tone(523,523,'sine',0.14,0.18); setTimeout(()=>this.tone(659,659,'sine',0.14,0.18),150); setTimeout(()=>this.tone(784,784,'sine',0.28,0.20),300); },
      final: () => { this.tone(523,523,'sine',0.20,0.22); setTimeout(()=>this.tone(659,659,'sine',0.20,0.22),150); setTimeout(()=>this.tone(784,784,'sine',0.20,0.22),300); setTimeout(()=>this.tone(1047,1047,'sine',0.30,0.25),470); setTimeout(()=>this.tone(1318,1318,'sine',0.65,0.28),750); },
      gameover: () => this.tone(200,150,'sawtooth',0.5,0.20),
      bump:  () => this.tone(50, 40, 'square', 0.09, 0.10),
      chest: () => { this.tone(600,600,'sine',0.08,0.16); setTimeout(()=>this.tone(800,800,'sine',0.08,0.16),80); setTimeout(()=>this.tone(1000,1000,'sine',0.16,0.16),160); },
      whisper: () => this.tone(90, 60, 'sine', 0.35, 0.045)
    };
    if (SND[soundName]) SND[soundName]();
  }

  startMusicEngine() {
    if (this.musicCtx || !this.musicPlaying) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try { this.musicCtx = new Ctx(); } catch (e) { return; }
    if (this.musicCtx.state === 'suspended') this.musicCtx.resume();
    this.musicMaster = this.musicCtx.createGain();
    this.musicMaster.gain.value = 0;
    this.musicMaster.connect(this.musicCtx.destination);
    
    const t = this.musicCtx.currentTime;
    this.musicMaster.gain.setValueAtTime(0, t);
    this.musicMaster.gain.linearRampToValueAtTime(this.MUSIC_VOL * 0.40, t + 4);
    this.musicChordIdx = 0;
    this.playMusicChord();
    setTimeout(() => this.playBirdChirp(), 600);
  }

  fadeMusicTo(target, dur) {
    if (!this.musicCtx || !this.musicMaster) return;
    try {
      const t = this.musicCtx.currentTime;
      this.musicMaster.gain.cancelScheduledValues(t);
      this.musicMaster.gain.setValueAtTime(this.musicMaster.gain.value, t);
      this.musicMaster.gain.linearRampToValueAtTime(target, t + dur);
    } catch (_) {}
  }

  stopMusicEngine() {
    if (!this.musicCtx) return;
    this.fadeMusicTo(0, 0.8);
    if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; }
    setTimeout(() => {
      try { if (this.musicCtx) this.musicCtx.close(); } catch (e) {}
      this.musicCtx = null;
      this.musicMaster = null;
    }, 900);
  }

  playMusicChord() {
    if (!this.musicCtx || !this.musicPlaying) return;
    const chord = this.MUSIC_CHORDS[this.musicChordIdx];
    const startTime = this.musicCtx.currentTime + 0.08;
    const duration = chord.dur;
    const attack = 1.5;
    const release = 1.8;
    
    chord.freqs.forEach((freq, idx) => {
      [-4, 4].forEach((det) => {
        const osc = this.musicCtx.createOscillator();
        const gain = this.musicCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = det;
        const noteGain = idx === 0 ? 0.085 : (idx === 1 ? 0.060 : 0.030);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(noteGain, startTime + attack);
        gain.gain.setValueAtTime(noteGain, startTime + duration - release);
        gain.gain.linearRampToValueAtTime(0, startTime + duration);
        osc.connect(gain);
        gain.connect(this.musicMaster);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);
      });
    });
    
    if (Math.random() < 0.45) {
      setTimeout(() => this.playBirdChirp(), (duration * 1000) * (0.3 + Math.random() * 0.4));
    }
    this.musicChordIdx = (this.musicChordIdx + 1) % this.MUSIC_CHORDS.length;
    this.musicTimer = setTimeout(() => this.playMusicChord(), (duration - 0.4) * 1000);
  }

  playBirdChirp() {
    if (!this.musicCtx || !this.musicPlaying) return;
    const pattern = this.BIRD_NOTES[Math.floor(Math.random() * this.BIRD_NOTES.length)];
    const baseTime = this.musicCtx.currentTime + 0.05;
    pattern.forEach((freq, i) => {
      const start = baseTime + i * 0.13;
      const osc = this.musicCtx.createOscillator();
      const gain = this.musicCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 6;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.035, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
      osc.connect(gain);
      gain.connect(this.musicMaster);
      osc.start(start);
      osc.stop(start + 0.6);
    });
  }

  tryStartMusic() {
    if (this.musicStarted) return;
    this.musicStarted = true;
    if (this.musicPlaying) this.startMusicEngine();
  }
}