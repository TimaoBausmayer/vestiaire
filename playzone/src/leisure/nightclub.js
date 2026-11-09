import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { BEAT } from './nightclub-beat.js';

// BOÎTES DE NUIT : musique et lumières quand on entre, danse en rythme (Espace / G / bouton dans le
// tempo), cocktails sans alcool au bar, carré VIP, demandes au DJ.
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SONGS = ['« Poulet Disco » (remix 2026)', '« Les Mouettes de la Nuit »', '« Turbo Mamie Dance »', '« Baguette Beat »', '« Danse des Pigeons » (version longue)'];

export class Nightclub {
  constructor(g) {
    this.g = g;
    this.inClub = null;
    this.d = null;   // danse en cours
    g.input.on('key', (e) => { if (this.d && (e.code === 'Space' || e.code === 'KeyG')) this.tap(); });
  }

  async req(kind, extra = {}) {
    const g = this.g;
    try { const r = await g.net.request('club.do', { kind, ...extra }); if (r.needs) g.emit('needs', r.needs); return r; } catch (e) { g.ui.toast(e.message, 'bad', 3000); g.sfx('error'); return null; }
  }

  async bar() { const r = await this.req('cocktail'); if (r) { this.g.sfx('cash'); this.g.ui.toast(`🍹 ${r.drink} ! Délicieux (et sans alcool). ${r.cost ? `-${r.cost} PC` : ''}`, 'good', 4000); } }
  async vip() { const r = await this.req('vip'); if (r) { this.g.clubShow?.boost(15, 'carré VIP !'); this.g.sfx('levelup'); this.g.ui.toast(`🍾 Carré VIP réservé pour 10 min ! Commande des bouteilles à ta table : les filles viendront te rejoindre. ${r.cost ? `-${fmt(r.cost)} PC` : ''}`, 'good', 6000); } }
  async dj() { const r = await this.req('dj'); if (r) this.g.clubShow?.boost(4); if (r) this.g.ui.toast(`🎧 Le DJ lance ${pick(SONGS)} ! La piste s'enflamme 🔥`, 'good', 4000); }

  // ------------------------------------------------------------------ danse en rythme
  dance() {
    const g = this.g;
    if (this.d) return;
    const d = this.d = { t: 0, next: BEAT.lead, hits: 0, miss: 0, streak: 0, beats: 0, el: null };
    d.ring = h('div.club-ring'); d.score = h('b', '0');
    d.el = h('div.club-dance', d.ring, h('div', '💃 Tape ', h('kbd', 'Espace'), ' en rythme !'), h('div', 'Score : ', d.score));
    d.btn = h('div.foot-btns', h('button', { onpointerdown: (e) => { e.preventDefault(); this.tap(); } }, '💃 En rythme !'));
    g.ui.root.append(d.el, d.btn);
    g.player.dance = 0; g.player.setPose('dance'); g.player.noJump = true;
    g.sound.music(true);
  }

  tap() {
    const d = this.d, g = this.g;
    if (!d) return;
    // écart au temps le plus proche
    const k = Math.round((d.t - BEAT.lead) / BEAT.period), off = Math.abs(d.t - (BEAT.lead + k * BEAT.period));
    if (k >= 0 && off < BEAT.window && d.lastBeat === k) return;   // déjà compté pour ce temps
    if (k >= 0 && off < BEAT.window) {
      d.lastBeat = k; d.hits++; d.streak++;
      if (d.streak % 4 === 0) { g.player.dance = (g.player.dance + 1) % 3; g.player.setPose('dance'); }
      d.ring.classList.remove('hit'); void d.ring.offsetWidth; d.ring.classList.add('hit');
      g.sfx('pop');
    } else { d.miss++; d.streak = 0; g.sfx('click'); }
    d.score.textContent = Math.max(0, d.hits - Math.floor(d.miss / 2));
  }

  async endDance() {
    const d = this.d, g = this.g;
    this.d = null;
    d.el.remove(); d.btn.remove();
    g.player.setPose('idle'); g.player.noJump = false;
    const score = Math.max(0, d.hits - Math.floor(d.miss / 2));
    const r = await this.req('dance', { score });
    if (!r) return;
    g.sfx(r.star ? 'levelup' : 'success');
    g.clubShow?.boost(r.score * 1.6, 'tu as enflammé la piste !');
    g.ui.toast(r.star ? `🌟 Roi / reine de la piste ! Score ${r.score} (record ${r.best}) · +1 réputation` : `💃 Belle danse ! Score ${r.score} (record ${r.best})`, 'good', 4500);
  }

  // ------------------------------------------------------------------ ambiance
  enter(b) {
    const g = this.g;
    this.inClub = b;
    g.sound.music(true);
    // le show lumière (lasers, écran LED, lyres, sol qui pulse...) est géré par ClubShow
    g.ui.toast(`🪩 Bienvenue au ${b.name} ! Danse sur la piste, cocktails au bar, carré VIP à droite.`, 'good', 4500);
  }

  leave() {
    const g = this.g;
    this.inClub = null;
    if (this.d) this.endDance();
    if (this.fx) { this.fx.removeFromParent(); this.fx = null; }
    g.sound.music(false);
  }

  update(dt, t) {
    const g = this.g, b = g.interiors?.inside;
    const isClub = b?.interior === 'club' || b?.interior === 'megaclub' ? b : null;
    if (isClub && this.inClub !== isClub) { if (this.inClub) this.leave(); this.enter(isClub); }
    else if (!isClub && this.inClub) this.leave();
    const d = this.d;
    if (d) {
      d.t += dt;
      const ph = ((d.t - BEAT.lead) % BEAT.period + BEAT.period) % BEAT.period / BEAT.period;
      d.ring.style.transform = `scale(${1.6 - ph * 0.6})`;
      d.ring.style.opacity = String(0.35 + (1 - ph) * 0.65);
      if (d.t >= BEAT.lead + BEAT.period * BEAT.count) this.endDance();
    }
  }
}
