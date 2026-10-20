import { h } from '../ui/dom.js';
import { JOBS, JOB_BY_ID2 as JOBS_BY_ID, TRAININGS, wagePerMinute } from '../../shared/careers.js';
import { jobsAt } from '../../shared/authority-careers.js';
import { BUILDING_BY_ID, BUILDINGS } from '../../shared/world-layout.js';
import { Beacon } from '../jobs/beacon.js';

// CARRIÈRE (côté client) : offres d'emploi dans les bâtiments, pointer, tâches de service (balise),
// paie au temps passé sur place, augmentations, démission ; école : formations et examens ; appli Travail.

const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
export const perHourReal = (job, raise = 0) => Math.round(wagePerMinute(job, raise) * 60);
const BOSS = {
  yes: ['« Vous le méritez. Ne le dites à personne. »', '« Accordé ! Mais je veux voir plus de sourires. »'],
  no: ['« Pas cette fois. Continuez comme ça et on en reparle. »', '« Hmm... non. Mais j\'aime votre audace. »'],
  angry: ['« Une augmentation ? Avec VOTRE travail ? »', '« Retournez travailler avant que je change d\'avis sur votre contrat. »'],
  tooSoon: ['« Vous me l\'avez déjà demandé ! Travaillez encore un peu. »'],
  max: ['« Vous gagnez déjà plus que moi. »'],
  fired: ['« C\'en est trop. VOUS ÊTES VIRÉ·E ! »'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Career {
  constructor(game) {
    this.game = game;
    this.shift = null;
    this.t = 0;
    this.beacon = new Beacon(game.engine.scene, '#7ac74f');
    this.beacon.g.visible = false;
    this.taskPos = null;
    game.interactions.add({
      r: 1.7, priority: 6,
      x: () => this.taskPos?.x ?? 1e9, z: () => this.taskPos?.z ?? 1e9,
      enabled: () => !!this.shift?.task && !!this.taskPos,
      label: () => `✅ ${this.shift?.task?.name || ''}`,
      action: () => this.doTask(),
    });
  }

  get job() { return this.game.profile.career?.job; }

  // ------------------------------------------------------------------ service
  async clockIn() {
    const g = this.game;
    try {
      const r = await g.net.request('career.clockIn', {});
      this.shift = r.shift;
      g.sfx('beep');
      g.ui.toast(`💼 Service commencé ! Reste sur place : tu es payé·e au temps passé. Des tâches vont apparaître (balise verte).`, 'good', 5000);
      this.render();
    } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad'); }
  }

  async clockOut() {
    const g = this.game;
    try {
      const r = await g.net.request('career.clockOut', {});
      this.shift = null;
      this.taskPos = null; this.beacon.g.visible = false;
      g.hud.track('career', null);
      g.sfx('cash');
      g.ui.toast(`💼 Fin de service : ${fmt(r.earned)} PC gagnés · ${r.done} tâche(s) faite(s)${r.missed ? `, ${r.missed} ratée(s)` : ''}${r.garnished ? ` · ${r.garnished} PC retenus pour tes dettes` : ''}.`, 'money', 5500);
    } catch (e) { g.ui.toast(e.message, 'bad'); }
  }

  async doTask() {
    const g = this.game;
    g.player.setPose(['cook', 'carry', 'pet', 'hold-forward'][Math.floor(Math.random() * 4)], 1.4);
    try {
      const r = await g.net.request('career.task', {});
      this.shift = r.shift;
      this.taskPos = null; this.beacon.g.visible = false;
      if (r.late) g.ui.toast('⌛ Trop tard pour cette tâche : le patron fronce les sourcils.', 'bad');
      else { g.sfx('success'); g.ui.toast(`✅ Bien joué ! Performance ${r.perf} % · prime +${r.tip} PC`, 'money', 2500); }
      this.render();
    } catch (e) { g.ui.toast(e.message, 'bad'); }
  }

  async askRaise() {
    const g = this.game;
    try {
      const r = await g.net.request('career.raise', {});
      const text = r.answer === 'tooSoon' ? `${pick(BOSS.tooSoon)} (encore ${r.left} min de travail)` : r.answer === 'yes' ? `${pick(BOSS.yes)} (+${Math.round(r.raise * 100)} % au total)` : pick(BOSS[r.answer]);
      g.ui.dialog({ name: 'Le patron', role: 'Bureau du chef', text, choices: [{ label: r.answer === 'fired' ? '😱 Noooon' : 'D\'accord', ghost: true, action: (m) => m.close() }] });
      g.sfx(r.answer === 'yes' ? 'levelup' : r.answer === 'fired' ? 'fail' : 'beep');
      if (r.answer === 'fired') this.endShift();
    } catch (e) { g.ui.toast(e.message, 'bad'); }
  }

  endShift() { this.shift = null; this.taskPos = null; this.beacon.g.visible = false; this.game.hud.track('career', null); }

  // Position de la tâche : un des points d'intérêt de l'intérieur du lieu de travail.
  placeTask() {
    const g = this.game, sh = this.shift;
    if (!sh?.task) { this.taskPos = null; this.beacon.g.visible = false; return; }
    const it = g.interiors?.loaded.get(sh.building);
    if (!it) { this.taskPos = null; this.beacon.g.visible = false; return; }
    const pts = [...it.inters.map((i) => ({ x: i.x, z: i.z })), ...it.people.map((p) => ({ x: p.x, z: p.z }))].filter((q) => typeof q.x === 'number');
    if (!pts.length) return;
    const q = pts[sh.task.slot % pts.length];
    this.taskPos = { x: q.x + 0.4, z: q.z + 0.4 };
    this.beacon.at(this.taskPos.x, 0.05, this.taskPos.z);
  }

  render() {
    const g = this.game, sh = this.shift, j = this.job;
    if (!sh || !j) { g.hud.track('career', null); return; }
    const job = JOBS_BY_ID[j.id];
    const mins = Math.floor((g.now() - sh.at) / 60000);
    const left = sh.task ? Math.max(0, Math.round((sh.task.due - g.now()) / 1000)) : null;
    g.hud.track('career', { title: `💼 ${job.name} — en service`, text: `${mins} min · ${fmt(sh.earned)} PC gagnés · performance ${j.perf} %${sh.task ? ` · 📌 ${sh.task.name} (${left} s)` : ''}` });
  }

  async tick() {
    const g = this.game;
    try {
      const r = await g.net.request('career.tick', {});
      if (r.fired) { this.endShift(); g.sfx('fail'); g.ui.dialog({ name: 'Le patron', role: 'Ressources humaines', text: '« Vos absences et vos tâches oubliées... c\'est fini. Vous êtes renvoyé·e. »', choices: [{ label: 'Snif', ghost: true, action: (m) => m.close() }] }); return; }
      if (r.missed) g.ui.toast('😬 Tâche oubliée ! Ta performance baisse.', 'bad', 3000);
      if (r.away) g.ui.toast('🚶 Tu as quitté ton poste pendant le service : ta performance baisse.', 'bad', 3500);
      if (r.shift) { this.shift = r.shift; this.placeTask(); }
      const tr = g.profile.career?.training;
      if (tr) g.hud.track('training', tr.ready ? { title: `🎓 ${TRAININGS[tr.id].name}`, text: 'Formation terminée : passe l\'examen à l\'école !' } : { title: `🎓 ${TRAININGS[tr.id].name}`, text: `Présence à l'école : ${Math.floor(tr.ms / 60000)} / ${TRAININGS[tr.id].minutes} min`, bar: tr.ms / (TRAININGS[tr.id].minutes * 60000) });
      else g.hud.track('training', null);
    } catch { /* hors ligne */ }
    this.render();
  }

  update(dt, t) {
    this.beacon.update(t);
    this.t -= dt;
    const busy = this.shift || this.game.profile.career?.training;
    if (this.t <= 0 && busy) { this.t = 10; this.tick(); }
    if (this.shift && !this.taskPos && this.shift.task) this.placeTask();
    this._r = (this._r || 0) + dt;
    if (this._r > 1) { this._r = 0; this.render(); }
  }
}

// ------------------------------------------------------------------------------------ panneaux
// Offres d'emploi d'un bâtiment (et pointage si c'est son lieu de travail).
export function jobPanel(g, b) {
  const m = g.ui.modal({
    title: `💼 Emplois — ${b.name}`, sub: 'Salaires par heure de jeu (10 min réelles). Plus c\'est dur, plus ça paie. Payé au temps passé sur place.',
    build: (body) => {
      const p = g.profile, c = p.career, cur = c.job;
      if (cur && cur.building === b.id) {
        const job = JOBS_BY_ID[cur.id];
        body.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, '🪪'),
          h('div.grow', h('div.t', `Ton poste : ${job.name}`), h('div.d', `${fmt(job.wage * (1 + cur.raise))} PC / h de jeu (≈ ${fmt(perHourReal(job, cur.raise))} PC / h réelle) · augmentations +${Math.round(cur.raise * 100)} % · performance ${cur.perf} %`)),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
            g.career.shift ? h('button.btn.small', { onclick: () => { m.close(); g.career.clockOut(); } }, '⏹️ Fin de service') : h('button.btn.small', { onclick: () => { m.close(); g.career.clockIn(); } }, '▶️ Pointer (commencer)'),
            h('button.btn.small.ghost', { onclick: () => { m.close(); g.career.askRaise(); } }, '💰 Demander une augmentation'),
            h('button.btn.small.ghost', { onclick: async () => { if (await g.ui.confirm('Démissionner ?', 'Tu quittes ce poste.', 'Démissionner')) { try { await g.net.request('career.quit', {}); g.career.endShift(); m.refresh(); } catch (e) { g.ui.toast(e.message, 'bad'); } } } }, 'Démissionner'))));
      }
      for (const job of jobsAt(b)) {
        if (cur && cur.building === b.id && cur.id === job.id) continue;
        const ok = !job.needs || c.diplomas.includes(job.needs);
        body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, '📄'),
          h('div.grow', h('div.t', job.name), h('div.d', `${fmt(job.wage)} PC / h de jeu (≈ ${fmt(perHourReal(job))} PC / h réelle) · pénibilité ${stars(job.hard)}`),
            h('div.d', job.needs ? `${ok ? '✅' : '❌'} Diplôme : ${TRAININGS[job.needs].name}` : 'Aucun diplôme demandé')),
          h('button.btn.small', { disabled: !ok, onclick: async () => {
            if (cur && !(await g.ui.confirm('Changer d\'emploi ?', `Tu quittes ton poste actuel (${JOBS_BY_ID[cur.id].name}).`, 'Postuler'))) return;
            try { await g.net.request('career.apply', { jobId: job.id, buildingId: b.id }); g.career.endShift(); g.sfx('levelup'); g.ui.toast(`🎉 Embauché·e : ${job.name} ! Pointe pour commencer ton service.`, 'good', 4500); m.refresh(); } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad', 4500); }
          } }, ok ? 'Postuler' : 'Diplôme requis')));
      }
    },
  });
}

// École : formations (payantes, à suivre sur place) et examens.
export function schoolPanel(g) {
  const m = g.ui.modal({
    title: '🎓 Formations et diplômes', sub: 'Inscris-toi, reste dans l\'école le temps indiqué (minutes réelles), puis passe l\'examen.',
    build: (body) => {
      const c = g.profile.career, tr = c.training;
      if (tr) {
        const t = TRAININGS[tr.id];
        body.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, '📚'), h('div.grow', h('div.t', `En cours : ${t.name}`), h('div.d', tr.ready ? 'Formation terminée !' : `Présence : ${Math.floor(tr.ms / 60000)} / ${t.minutes} min (reste dans l'école)`)),
          h('button.btn.small', { disabled: !tr.ready, onclick: () => { m.close(); examPanel(g, tr.id); } }, 'Passer l\'examen')));
      }
      for (const [id, t] of Object.entries(TRAININGS)) {
        const has = c.diplomas.includes(id);
        const jobs = JOBS.filter((j) => j.needs === id).map((j) => j.name).join(', ');
        body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, has ? '🎓' : '📘'),
          h('div.grow', h('div.t', t.name), h('div.d', `${fmt(t.cost)} PC · ${t.minutes} min · examen ${t.pass}/${t.questions.length}`), h('div.d', `Débouchés : ${jobs}`)),
          h('button.btn.small', { disabled: has || !!tr, onclick: async () => {
            try { await g.net.request('career.train', { id }); g.sfx('cash'); g.ui.toast(`📚 Inscrit·e : ${t.name}. Reste ${t.minutes} min dans l'école.`, 'good', 4500); m.refresh(); } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad'); }
          } }, has ? 'Diplômé·e' : 'S\'inscrire')));
      }
    },
  });
}

export function examPanel(g, id) {
  const t = TRAININGS[id];
  const answers = new Array(t.questions.length).fill(-1);
  const m = g.ui.modal({
    title: `📝 Examen — ${t.name}`, sub: `Il faut ${t.pass} bonnes réponses sur ${t.questions.length}.`,
    build: (body) => {
      t.questions.forEach(([q, choices], i) => {
        body.append(h('div.field', h('label', `${i + 1}. ${q}`), h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } }, choices.map((c, k) => h(`button.btn.small${answers[i] === k ? '' : '.ghost'}`, { onclick: () => { answers[i] = k; m.refresh(); } }, c)))));
      });
      body.append(h('button.btn', { disabled: answers.includes(-1), style: { marginTop: '10px' }, onclick: async () => {
        try {
          const r = await g.net.request('career.exam', { answers });
          m.close();
          g.sfx(r.passed ? 'levelup' : 'fail');
          g.ui.dialog({ name: 'Le jury', role: t.name, text: r.passed ? `Bravo ! ${r.score}/${r.total} : diplôme obtenu ! 🎓 De nouveaux emplois s'ouvrent à toi.` : `${r.score}/${r.total}... il en fallait ${r.need}. Révise encore un peu à l'école (la moitié de la formation) et retente !`, choices: [{ label: 'OK', ghost: true, action: (x) => x.close() }] });
        } catch (e) { g.ui.toast(e.message, 'bad'); }
      } }, 'Rendre la copie'));
    },
  });
}

// Appli Travail du téléphone.
export function workApp(g, b) {
  const c = g.profile.career, j = c.job;
  if (j) {
    const job = JOBS_BY_ID[j.id], bld = BUILDING_BY_ID[j.building];
    b.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, '🪪'), h('div.grow', h('div.t', `${job.name} — ${bld?.name}`), h('div.d', `${fmt(job.wage * (1 + j.raise))} PC / h de jeu · performance ${j.perf} % · ${Math.round(j.worked)} min travaillées`)),
      bld ? h('button.btn.small.ghost', { onclick: () => g.phone.goTo({ x: bld.door.x, z: bld.door.z, name: bld.name }) }, '📍 GPS') : null));
  } else b.append(h('p', 'Pas d\'emploi pour l\'instant. Les offres sont affichées dans les commerces, bureaux, hôpital, garages... (point « 💼 Emplois »). Les postes qualifiés demandent un diplôme (école).'));
  b.append(h('h4', 'Diplômes'));
  b.append(h('p.muted', c.diplomas.length ? c.diplomas.map((d) => `🎓 ${TRAININGS[d].name}`).join(' · ') : 'Aucun pour l\'instant.'));
  if (c.training) b.append(h('p.muted', `📚 En formation : ${TRAININGS[c.training.id].name} (${Math.floor(c.training.ms / 60000)} / ${TRAININGS[c.training.id].minutes} min)`));
  const school = BUILDINGS.find((x) => x.interior === 'school');
  if (school) b.append(h('button.btn.small.ghost', { onclick: () => g.phone.goTo({ x: school.door.x, z: school.door.z, name: school.name }) }, '📍 GPS vers l\'école'));
  b.append(h('h4', { style: { marginTop: '12px' } }, 'Les métiers de la ville'));
  for (const job of [...JOBS].sort((a, x) => a.wage - x.wage)) b.append(h('div.d', { style: { padding: '2px 0' } }, `${job.name} — ${fmt(job.wage)} PC/h de jeu · ${stars(job.hard)}${job.needs ? ` · ${TRAININGS[job.needs].name}` : ''}`));
  if (c.history.length) { b.append(h('h4', { style: { marginTop: '12px' } }, 'Historique')); for (const x of c.history.slice(-6).reverse()) b.append(h('div.d', `${JOBS_BY_ID[x.id]?.name || x.id} — ${x.end}`)); }
}
