import { h, fmt } from '../ui/dom.js';
import { JOBS, JOB_LEVELS, jobLevel } from '../../shared/content/jobs.js';
import { BUILDING_BY_ID, POI } from '../../shared/world-layout.js';
import { DeliveryJob } from './delivery.js';
import { FirefighterJob } from './firefighter.js';
import { CookJob } from './cook.js';
export { Beacon } from './beacon.js';

// Métiers : postes de travail, missions, uniforme, suivi, améliorations.
const IMPL = { delivery: DeliveryJob, firefighter: FirefighterJob, cook: CookJob };

export class Jobs {
  constructor(game) {
    this.game = game;
    this.active = null;   // instance du métier en service
    for (const job of JOBS) {
      const st = job.station === 'burger' ? POI.foodCounter : BUILDING_BY_ID[job.station].door;
      game.interactions.add({ x: st.x, z: st.z, r: 3.4, priority: 1, label: () => (this.active?.job.id === job.id ? `${job.emoji} Mission en cours (${job.name})` : `${job.emoji} Travailler : ${job.name}`), action: () => this.openStation(job) });
    }
  }

  openStation(job) {
    const g = this.game;
    const m = g.ui.modal({
      title: `${job.emoji} ${job.name}`, sub: job.desc, width: 'min(720px, 96vw)',
      build: (b) => {
        const p = g.profile, js = p.jobs[job.id];
        const lv = jobLevel(js.xp);
        const next = JOB_LEVELS[lv] ?? null;
        b.append(h('div.stat-grid',
          h('div.stat', h('b', `Niveau ${lv}`), h('span', next ? `${js.xp} / ${next} XP` : 'Niveau maximum')),
          h('div.stat', h('b', String(js.missions)), h('span', 'Missions réussies')),
          h('div.stat', h('b', `+${Math.round((lv - 1) * 10)} %`), h('span', 'Bonus de paie (niveau)'))));
        if (this.active) {
          b.append(h('p', { style: { marginTop: '14px' } }, this.active.job.id === job.id ? 'Tu es déjà en mission pour ce métier.' : `Tu es en mission comme ${this.active.job.name}. Termine-la ou abandonne-la d'abord.`),
            h('button.btn.coral', { onclick: () => { this.cancel(); m.refresh(); } }, 'Abandonner la mission en cours'));
        }
        b.append(h('h3', { style: { marginTop: '16px' } }, 'Missions'));
        b.append(h('div.grid', job.missions.map((mt) => {
          const locked = lv < mt.level;
          return h(`div.card${locked ? '.locked' : ''}`,
            h('div.title', mt.name), h('div.desc', mt.desc),
            h('div.price', locked ? `🔒 Niveau ${mt.level}` : `≈ ${this.payPreview(job, mt, lv)} PC`),
            h('button.btn.small', { disabled: locked || !!this.active, onclick: () => { m.close(); this.start(job, mt); } }, 'Commencer'));
        })));
        b.append(h('h3', { style: { marginTop: '16px' } }, 'Améliorations'));
        b.append(h('div.grid', job.upgrades.map((up) => {
          const owned = js.upgrades.includes(up.id), locked = lv < up.level;
          return h(`div.card${owned ? '.owned' : ''}${locked ? '.locked' : ''}`,
            owned ? h('span.badge', 'Acquis') : null,
            h('div.title', up.name), h('div.desc', up.desc),
            h('div.price', locked ? `🔒 Niveau ${up.level}` : `${fmt(up.price)} PC`),
            owned ? null : h('button.btn.small.teal', {
              disabled: locked || p.coins < up.price,
              onclick: async () => { try { await g.net.request('job.upgrade', { jobId: job.id, upgradeId: up.id }); g.sfx('coin'); g.ui.toast(`${up.name} : acheté !`, 'money'); m.refresh(); } catch (e) { g.ui.toast(e.message, 'bad'); } },
            }, 'Acheter'));
        })));
      },
    });
  }

  payPreview(job, mt, lv) {
    const mult = 1 + 0.1 * (lv - 1);
    if (job.id === 'cook') return `${Math.round(mt.payPerOrder * mult * mt.orders)}-${Math.round(mt.payPerOrder * mult * mt.orders * 1.5)}`;
    return Math.round(mt.pay * mult);
  }

  async start(job, mt) {
    const g = this.game;
    let data;
    try { data = await g.net.request('job.start', { jobId: job.id, missionId: mt.id }); } catch (e) { g.ui.toast(e.message, 'bad'); return; }
    const Impl = IMPL[job.id];
    this.active = new Impl(g, this, job, mt, data.mission);
    const ups = g.profile.jobs[job.id].upgrades;
    g.player.speedBonus = ups.includes('baskets') || ups.includes('bottes') ? 1.12 : 1;
    g.setUniform(job.uniform);
    g.sfx('whistle');
    g.ui.toast(`${job.emoji} Mission : ${mt.name}`, 'good');
    this.active.begin();
  }

  // Fin de mission (succès) : récompense + nettoyage.
  complete(data) {
    const g = this.game;
    const a = this.active;
    g.reward(data, a.job.name);
    for (const n of data.notes || []) g.ui.toast(n, '', 4500);
    g.fx.confetti(g.player.pos, 40);
    g.sfx('success');
    this.stop();
  }

  async cancel() {
    if (!this.active) return;
    await this.game.net.request('job.cancel').catch(() => {});
    this.game.ui.toast('Mission abandonnée.', 'bad');
    this.stop();
  }

  stop() {
    const g = this.game;
    this.active?.end();
    this.active = null;
    g.player.speedBonus = 1;
    g.setUniform(null);
    g.hud.track('job', null);
    g.hud.compassTarget = null;
  }

  update(dt, t) { this.active?.update(dt, t); }

  mapMarkers() { return this.active?.markers() || []; }
}
