import { h, clear, fmt } from '../ui/dom.js';
import { liveOf, CAL_BY_ID, minutesUntil } from '../../shared/calendar.js';
import { calNow } from '../events/agenda.js';

// Socle commun des mini-jeux : présentation (règles + classement), compte à rebours, partie,
// fin, résultats (calculés et validés par l'autorité), récompenses, rejouer.
// Pour créer un mini-jeu : étendre cette classe, implémenter onStart/onUpdate/onEnd et l'enregistrer
// dans minigames/index.js ; ajouter sa définition (règles, récompenses) dans un pack de contenu.
export class Minigame {
  constructor(game, def, spot) {
    this.game = game;
    this.def = def;
    this.spot = spot;
    this.state = 'idle'; // idle | countdown | playing | finishing
    this.t = 0;
    this.score = 0;
  }

  get active() { return this.state !== 'idle'; }

  scoreLabel(s) { return this.def.kind === 'time' ? `${s.toFixed(2)} s` : `${s} pt${Math.abs(s) > 1 ? 's' : ''}`; }

  // Fenêtre de présentation
  async openIntro() {
    const g = this.game;
    const m = g.ui.modal({
      title: `${this.def.emoji} ${this.def.name}`, sub: 'Mini-jeu', width: 'min(560px, 96vw)',
      build: (b) => {
        b.append(h('p', this.def.rules));
        const st = g.profile.minigames[this.def.id];
        b.append(h('div.stat-grid',
          h('div.stat', h('b', st?.best != null ? this.scoreLabel(st.best) : '—'), h('span', 'Ton record')),
          h('div.stat', h('b', String(st?.plays || 0)), h('span', 'Parties jouées')),
          h('div.stat', h('b', this.rewardText()), h('span', 'Récompense'))));
        const now = calNow(g);
        for (const o of liveOf((e) => e.kind === 'minigame' && e.minigame === this.def.id, now)) {
          const ev = CAL_BY_ID[o.id], reg = !!g.profile.calendar?.reg?.[o.occ];
          b.append(h('div.list-item', { style: { marginTop: '12px', background: 'linear-gradient(90deg, rgba(255,210,63,.3), rgba(139,92,246,.3))' } }, h('span', { style: { fontSize: '24px' } }, ev.emoji),
            h('div.grow', h('div.t', `Tournoi en cours : ${ev.name}`), h('div.d', `Encore ${minutesUntil(o.end, now)} min réelles · prix ${ev.rewards.podium.join(' / ')} PC · ton meilleur score du créneau compte.`)),
            reg ? h('span.pill.ok', 'Inscrit·e') : h('button.btn.small', { onclick: async () => { try { await g.net.request('cal.register', { occ: o.occ }); g.sfx('success'); m.refresh(); } catch (e) { g.ui.toast(e.message, 'bad'); } } }, 'S\'inscrire')));
        }
        b.append(h('h3', { style: { marginTop: '16px' } }, 'Classement'), this.boardEl = h('div.muted', 'Chargement…'));
        this.loadBoard(this.boardEl);
      },
      foot: (f) => f.append(h('button.btn.ghost', { onclick: () => m.close() }, 'Plus tard'), h('button.btn.big', { onclick: () => { m.close(); this.start(); } }, '▶ Jouer')),
    });
  }

  rewardText() {
    const r = this.def.reward;
    if (this.def.kind === 'time') return `${r.finish_pc}–${r.gold_pc} PC`;
    return `${r.base}–${r.cap} PC`;
  }

  async loadBoard(el) {
    try {
      const { top } = await this.game.net.request('mg.board', { id: this.def.id });
      clear(el);
      el.classList.remove('muted');
      if (!top.length) { el.append(h('p.muted', 'Personne n\'a encore joué. Sois le premier !')); return; }
      const me = this.game.profile.id;
      el.append(h('table.board', h('tr', h('th', '#'), h('th', 'Joueur'), h('th', { style: { textAlign: 'right' } }, this.def.kind === 'time' ? 'Temps' : 'Score')),
        top.map((r, i) => h(`tr${r.id === me ? '.me' : ''}`, h('td', String(i + 1)), h('td', r.name, r.npc ? h('span.pill', { style: { marginLeft: '6px' } }, 'PNJ') : null), h('td.num', this.scoreLabel(r.score))))));
    } catch (e) { el.textContent = e.message; }
  }

  async start() {
    const g = this.game;
    if (g.minigames.current) return;
    try {
      const r = await g.net.request('mg.start', { id: this.def.id });
      this.seed = r.seed;
    } catch (e) { g.ui.toast(e.message, 'bad'); return; }
    g.minigames.current = this;
    this.state = 'countdown';
    this.startedAt = performance.now(); // horloge réelle, alignée sur celle de l'autorité (3 s de compte à rebours)
    this.t = -3;
    this.score = 0;
    this.hud = h('div.mg-hud', this.timeBox = h('div.box', h('b', '0'), h('span', this.def.kind === 'time' ? 'Temps' : 'Temps restant')), this.scoreBox = h('div.box', h('b', '0'), h('span', this.def.kind === 'time' ? 'Anneaux' : 'Score')));
    g.ui.root.append(this.hud);
    this.cd = h('div.countdown');
    g.ui.root.append(this.cd);
    this.lastCd = null;
    this.onStart();
  }

  setScore(s) { this.score = s; this.scoreBox.querySelector('b').textContent = String(s); }

  update(dt) {
    if (this.state === 'idle') return;
    this.t = (performance.now() - this.startedAt) / 1000 - 3;
    if (this.state === 'countdown') {
      const n = Math.ceil(-this.t);
      if (n !== this.lastCd) {
        this.lastCd = n;
        clear(this.cd);
        this.cd.append(h('span', n > 0 ? String(n) : 'GO !'));
        this.game.sfx(n > 0 ? 'beep' : 'go');
      }
      if (this.t >= 0) { this.state = 'playing'; setTimeout(() => this.cd?.remove(), 700); this.onGo?.(); }
    }
    if (this.state === 'playing') {
      const tb = this.timeBox.querySelector('b');
      tb.textContent = this.def.duration ? String(Math.max(0, Math.ceil(this.def.duration - this.t))) : this.t.toFixed(1);
      if (this.def.duration && this.t >= this.def.duration + 0.3) this.finish();
      // abandon si on s'éloigne trop du stand (sauf parcours)
      if (this.maxDist && Math.hypot(this.game.player.pos.x - this.spot.x, this.game.player.pos.z - this.spot.z) > this.maxDist) this.cancel('Tu t\'es éloigné du stand : partie abandonnée.');
    }
    this.onUpdate(dt);
  }

  async finish() {
    if (this.state !== 'playing') return;
    this.state = 'finishing';
    const g = this.game;
    let res;
    try { res = await g.net.request('mg.finish', {}); } catch (e) { g.ui.toast(e.message, 'bad'); this.cleanup(); return; }
    this.cleanup();
    g.sfx(res.coins > 0 ? 'success' : 'fail');
    if (res.record || res.medal) g.fx.confetti(g.player.pos);
    g.reward(res, this.def.name);
    this.showResults(res);
  }

  cancel(msg) {
    if (this.state === 'idle') return;
    this.game.net.request('mg.cancel').catch(() => {});
    if (msg) this.game.ui.toast(msg, 'bad');
    this.cleanup();
  }

  cleanup() {
    this.state = 'idle';
    this.hud?.remove();
    this.cd?.remove();
    this.game.minigames.current = null;
    this.onEnd();
  }

  showResults(res) {
    const g = this.game;
    const m = g.ui.modal({
      title: res.medal ? `Médaille d'${res.medal} !` : res.record ? 'Nouveau record !' : 'Partie terminée', sub: this.def.name, width: 'min(560px, 96vw)',
      build: (b) => {
        b.append(h('div.stat-grid',
          h('div.stat', h('b', this.scoreLabel(res.score)), h('span', 'Résultat')),
          h('div.stat', h('b', `+${fmt(res.coins)} PC`), h('span', 'Gagné')),
          h('div.stat', h('b', `+${res.xp} XP`), h('span', 'Expérience')),
          h('div.stat', h('b', res.rank ? `#${res.rank}` : '—'), h('span', 'Classement'))));
        if (res.tournament?.length) b.append(h('p', `🏆 Score enregistré pour le tournoi en cours : résultat et prix dans l'Agenda à la fin du créneau.`));
        if (res.factor < 1) b.append(h('p.muted', `Tu as beaucoup joué à ce jeu cette heure-ci : récompense à ${Math.round(res.factor * 100)} %. Essaie d'autres activités !`));
        b.append(h('h3', { style: { marginTop: '14px' } }, 'Classement'), this.boardEl = h('div.muted', 'Chargement…'));
        this.loadBoard(this.boardEl);
      },
      foot: (f) => f.append(h('button.btn.ghost', { onclick: () => m.close() }, 'Fermer'), h('button.btn', { onclick: () => { m.close(); this.start(); } }, '↻ Rejouer')),
    });
  }

  // À surcharger
  onStart() {}
  onUpdate() {}
  onEnd() {}
  mapMarkers() { return []; }
}
