// Sons synthétisés en direct (Web Audio) : aucun fichier audio à télécharger.
// Effets (pièces, sauts, tartes, poulets...), ambiance, et musique de la soirée DJ.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.6;
    try { this.muted = localStorage.getItem('playzone.muted') === '1'; } catch { /* rien */ }
    this.loops = new Map();
    const unlock = () => { this.ensure(); this.ctx?.resume?.(); };
    addEventListener('pointerdown', unlock, { once: false, passive: true });
    addEventListener('keydown', unlock, { once: false });
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return this.ctx;
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('playzone.muted', m ? '1' : '0'); } catch { /* rien */ }
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  tone(type, f0, f1, dur, vol = 0.2, delay = 0, dest) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.2, filter = 'lowpass', freq = 1200, delay = 0, freqEnd) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = filter; f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name) {
    if (this.muted || !this.ensure() || this.ctx.state !== 'running') return;
    switch (name) {
      case 'coin': this.tone('square', 988, 988, 0.08, 0.08); this.tone('square', 1319, 1319, 0.22, 0.08, 0.07); break;
      case 'jump': this.tone('square', 300, 620, 0.14, 0.05); break;
      case 'land': this.noise(0.12, 0.12, 'lowpass', 400); break;
      case 'click': this.tone('triangle', 900, 700, 0.05, 0.08); break;
      case 'error': this.tone('sawtooth', 220, 180, 0.15, 0.06); this.tone('sawtooth', 165, 140, 0.2, 0.06, 0.12); break;
      case 'success': [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.1, i * 0.08)); break;
      case 'levelup': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.16, 0.06, i * 0.09)); break;
      case 'splat': this.noise(0.25, 0.3, 'lowpass', 900, 0, 200); this.tone('sine', 180, 60, 0.15, 0.15); break;
      case 'throw': this.noise(0.2, 0.12, 'bandpass', 600, 0, 2400); break;
      case 'cluck': this.tone('square', 700, 520, 0.06, 0.05); this.tone('square', 760, 540, 0.08, 0.05, 0.1); break;
      case 'quack': this.tone('sawtooth', 420, 300, 0.12, 0.06); this.tone('sawtooth', 400, 280, 0.12, 0.06, 0.15); break;
      case 'bark': this.noise(0.08, 0.15, 'bandpass', 700); this.tone('sawtooth', 300, 180, 0.12, 0.07); break;
      case 'meow': this.tone('sine', 600, 900, 0.15, 0.06); this.tone('sine', 900, 500, 0.25, 0.06, 0.15); break;
      case 'moo': this.tone('sawtooth', 140, 110, 0.7, 0.06); break;
      case 'honk': this.tone('square', 392, 392, 0.18, 0.05); this.tone('square', 494, 494, 0.18, 0.05); break;
      case 'bounce': this.tone('sine', 200, 900, 0.35, 0.15); break;
      case 'pop': this.tone('sine', 600, 1400, 0.08, 0.12); break;
      case 'whistle': this.tone('sine', 1800, 2200, 0.25, 0.08); this.tone('sine', 2200, 1800, 0.3, 0.08, 0.25); break;
      case 'beep': this.tone('square', 660, 660, 0.12, 0.06); break;
      case 'go': this.tone('square', 1320, 1320, 0.35, 0.07); break;
      case 'door': this.noise(0.18, 0.1, 'lowpass', 500); this.tone('triangle', 200, 150, 0.12, 0.08, 0.05); break;
      case 'hiss': this.noise(0.4, 0.12, 'highpass', 3000); break;
      case 'secret': [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone('sine', f, f, 0.25, 0.08, i * 0.07)); break;
      case 'fail': [392, 330, 262].forEach((f, i) => this.tone('triangle', f, f * 0.95, 0.25, 0.08, i * 0.15)); break;
      default: break;
    }
  }

  // Boucle continue (lance à incendie, feu...) : start/stop.
  loop(name, on) {
    if (!on) { const l = this.loops.get(name); if (l) { l.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08); setTimeout(() => l.s.stop(), 400); this.loops.delete(name); } return; }
    if (this.loops.has(name) || this.muted || !this.ensure()) return;
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter();
    f.type = name === 'water' ? 'bandpass' : 'lowpass';
    f.frequency.value = name === 'water' ? 1800 : 600;
    const g = c.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(name === 'water' ? 0.12 : 0.08, c.currentTime, 0.05);
    s.connect(f).connect(g).connect(this.master);
    s.start();
    this.loops.set(name, { s, g });
  }

  // Musique de la soirée DJ (boucle générée, 120 BPM).
  music(on) {
    if (!on) { this.musicOn = false; return; }
    if (this.musicOn || !this.ensure()) return;
    this.musicOn = true;
    const c = this.ctx;
    const bus = c.createGain(); bus.gain.value = 0.55; bus.connect(this.master);
    const step = 60 / 120 / 4;
    let next = c.currentTime + 0.1, i = 0;
    const bass = [55, 0, 55, 0, 65.4, 0, 55, 0, 73.4, 0, 73.4, 0, 65.4, 0, 49, 0];
    const chords = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]];
    const sched = () => {
      if (!this.musicOn) { bus.gain.setTargetAtTime(0, c.currentTime, 0.3); return; }
      while (next < c.currentTime + 0.2) {
        const s16 = i % 16, bar = Math.floor(i / 16) % 4;
        const t = next - c.currentTime;
        if (s16 % 4 === 0) this.tone('sine', 140, 45, 0.25, 0.35, t, bus);
        if (s16 % 2 === 1) { const n = c.createBufferSource(); n.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = c.createGain(); g.gain.setValueAtTime(0.06, next); g.gain.exponentialRampToValueAtTime(0.0001, next + 0.05); n.connect(f).connect(g).connect(bus); n.start(next); n.stop(next + 0.06); }
        if (bass[s16]) this.tone('sawtooth', bass[s16], bass[s16], step * 1.8, 0.09, t, bus);
        if (s16 === 2 || s16 === 10) chords[bar].forEach((f) => this.tone('square', f, f, step * 1.5, 0.025, t, bus));
        next += step; i++;
      }
      setTimeout(sched, 50);
    };
    sched();
  }
}
