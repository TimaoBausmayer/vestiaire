// AUTORITÉ — CARRIÈRES : postuler, pointer, être payé au temps de présence, tâches de service,
// performance, augmentations, licenciement, formations (présence à l'école) et examens.
// Fonctions appelées avec `this` = l'Authority.
import { BUILDING_BY_ID, BUILDINGS } from './world-layout.js';
import { JOB_BY_ID2 as JOBS, TRAININGS, wagePerMinute, MAX_RAISE, RAISE_STEP, RAISE_WORK_MIN } from './careers.js';

const err = (error) => ({ ok: false, error });
const insideB = (b, pos, m = 0.6) => !!(b && pos && Math.abs(pos.x - b.x) < b.w / 2 + m && Math.abs(pos.z - b.z) < b.d / 2 + m);
export const worksAt = (job, b) => !!b && (job.where.includes(b.interior) || job.where.includes(b.id));
export const jobsAt = (b) => Object.values(JOBS).filter((j) => worksAt(j, b));
const TASK_EVERY = [40_000, 75_000];   // une tâche toutes les 40 à 75 s
const TASK_DUE = 60_000;               // à faire en moins d'une minute
const FIRE_PERF = 15;

export function defaultCareer() { return { job: null, diplomas: [], training: null, fired: [], history: [] }; }

function newTask(ctx, sh) {
  const job = JOBS[sh.job];
  const name = job.tasks[Math.floor(ctx.rand() * job.tasks.length)];
  sh.task = { name, at: ctx.now, due: ctx.now + TASK_DUE, slot: Math.floor(ctx.rand() * 1000) };
  sh.nextTaskAt = ctx.now + TASK_EVERY[0] + ctx.rand() * (TASK_EVERY[1] - TASK_EVERY[0]);
}

// Présence au travail et à l'école (appelé à chaque position validée).
export function careerOnPosition(ctx) {
  const p = ctx.profile, s = ctx.session, now = ctx.now;
  const sh = s.shift;
  if (sh) {
    const dt = Math.max(0, Math.min(5000, now - (sh.lastAt || now)));
    sh.lastAt = now;
    if (insideB(BUILDING_BY_ID[sh.building], ctx.pos, 1.5)) sh.presentMs += dt; else sh.awayMs += dt;
  }
  const tr = p.career?.training;
  if (tr && !tr.ready) {
    const dt = Math.max(0, Math.min(5000, now - (s.trainAt || now)));
    s.trainAt = now;
    const atSchool = BUILDINGS.some((b) => b.interior === 'school' && insideB(b, ctx.pos, 0.5));
    if (atSchool) {
      tr.ms += dt;
      if (tr.ms >= TRAININGS[tr.id].minutes * 60_000) tr.ready = true;
    }
  }
}

// Paie le temps de présence accumulé (performance : 80 % à 115 % du salaire).
function payShift(self, ctx, sh) {
  const p = ctx.profile, j = p.career.job, job = JOBS[j.id];
  const mins = sh.presentMs / 60_000;
  sh.presentMs = 0;
  if (mins <= 0) return 0;
  const perfK = 0.8 + 0.35 * (j.perf / 100);
  let pay = Math.round(wagePerMinute(job, j.raise) * mins * perfK);
  j.worked += mins;
  j.sinceRaise += mins;
  // une partie du salaire rembourse les dettes (saisie sur salaire)
  if (p.debt > 0 && pay > 0) { const take = Math.min(p.debt, Math.floor(pay / 2)); p.debt -= take; pay -= take; sh.garnished = (sh.garnished || 0) + take; }
  self.addCoins(p, pay);
  sh.earned += pay;
  return pay;
}

function fire(ctx, why) {
  const p = ctx.profile, j = p.career.job;
  p.career.fired.push({ id: j.id, building: j.building, at: ctx.now, why });
  if (p.career.fired.length > 10) p.career.fired.shift();
  p.career.history.push({ id: j.id, building: j.building, from: j.since, to: ctx.now, end: 'renvoi' });
  p.career.job = null;
  ctx.session.shift = null;
}

export const CAREER_HANDLERS = {
  'career.apply'(ctx, { jobId, buildingId }) {
    const p = ctx.profile, job = JOBS[jobId], b = BUILDING_BY_ID[buildingId];
    if (!job || !b || !worksAt(job, b)) return err('Ce poste n\'existe pas ici.');
    if (!this.atBuilding(ctx, b, 1)) return err('Il faut venir sur place pour l\'entretien.');
    if (job.needs && !p.career.diplomas.includes(job.needs)) return err(`Il faut le diplôme : ${TRAININGS[job.needs].name} (école).`);
    const recent = p.career.fired.find((f) => f.id === jobId && f.building === buildingId && ctx.now - f.at < 30 * 60_000);
    if (recent) return err('« Vous ? On vous a renvoyé il y a moins d\'une demi-heure ! » Revenez plus tard.');
    if (p.record?.length && ['policier', 'banquier'].includes(jobId)) return err('Casier judiciaire : poste refusé.');
    if (p.career.job) { const o = p.career.job; p.career.history.push({ id: o.id, building: o.building, from: o.since, to: ctx.now, end: 'démission' }); }
    ctx.session.shift = null;
    p.career.job = { id: jobId, building: buildingId, since: ctx.now, raise: 0, perf: 60, worked: 0, sinceRaise: 0, raiseAskedAt: 0 };
    return { ok: true, changed: true, data: { job: p.career.job } };
  },

  'career.quit'(ctx) {
    const p = ctx.profile, j = p.career.job;
    if (!j) return err('Tu n\'as pas d\'emploi.');
    if (ctx.session.shift) payShift(this, ctx, ctx.session.shift);
    p.career.history.push({ id: j.id, building: j.building, from: j.since, to: ctx.now, end: 'démission' });
    p.career.job = null;
    ctx.session.shift = null;
    return { ok: true, changed: true, data: {} };
  },

  'career.clockIn'(ctx) {
    const p = ctx.profile, j = p.career.job;
    if (!j) return err('Tu n\'as pas d\'emploi.');
    if (ctx.session.shift) return err('Tu as déjà pointé.');
    if (!insideB(BUILDING_BY_ID[j.building], ctx.pos, 1.5)) return err('Il faut être sur ton lieu de travail pour pointer.');
    const sh = { job: j.id, building: j.building, at: ctx.now, lastAt: ctx.now, presentMs: 0, awayMs: 0, earned: 0, done: 0, missed: 0 };
    newTask(ctx, sh);
    ctx.session.shift = sh;
    return { ok: true, changed: false, data: { shift: publicShift(sh) } };
  },

  // Point régulier pendant le service : paie, nouvelles tâches, tâches ratées, absences.
  'career.tick'(ctx) {
    const p = ctx.profile, sh = ctx.session.shift, j = p.career.job;
    const data = { training: p.career.training };
    if (!sh || !j) return { ok: true, changed: !!p.career.training, data };
    if (sh.task && ctx.now > sh.task.due) { sh.missed++; j.perf = Math.max(0, j.perf - 6); sh.task = null; data.missed = true; }
    if (!sh.task && ctx.now >= sh.nextTaskAt) newTask(ctx, sh);
    if (sh.awayMs > 45_000) { j.perf = Math.max(0, j.perf - 5); sh.awayMs = 0; data.away = true; }
    data.paid = payShift(this, ctx, sh);
    if (j.perf <= FIRE_PERF) { fire(ctx, 'performance'); data.fired = true; return { ok: true, changed: true, data }; }
    data.shift = publicShift(sh);
    data.perf = j.perf;
    return { ok: true, changed: true, data };
  },

  'career.task'(ctx) {
    const p = ctx.profile, sh = ctx.session.shift, j = p.career.job;
    if (!sh || !sh.task) return err('Aucune tâche en cours.');
    if (!insideB(BUILDING_BY_ID[sh.building], ctx.pos, 1.5)) return err('Il faut être sur ton lieu de travail.');
    const late = ctx.now > sh.task.due;
    sh.task = null;
    if (late) { sh.missed++; j.perf = Math.max(0, j.perf - 3); return { ok: true, changed: true, data: { late: true, shift: publicShift(sh) } }; }
    sh.done++;
    j.perf = Math.min(100, j.perf + 4);
    const tip = Math.round(JOBS[j.id].wage * 0.05);
    this.addCoins(p, tip);
    sh.earned += tip;
    return { ok: true, changed: true, data: { tip, perf: j.perf, shift: publicShift(sh) } };
  },

  'career.clockOut'(ctx) {
    const sh = ctx.session.shift;
    if (!sh) return err('Tu n\'as pas pointé.');
    const paid = payShift(this, ctx, sh);
    ctx.session.shift = null;
    return { ok: true, changed: true, data: { paid, earned: sh.earned, done: sh.done, missed: sh.missed, garnished: sh.garnished || 0 } };
  },

  // Demander une augmentation au patron (au travail, assez de temps travaillé depuis la dernière demande).
  'career.raise'(ctx) {
    const p = ctx.profile, j = p.career.job;
    if (!j) return err('Tu n\'as pas d\'emploi.');
    if (!insideB(BUILDING_BY_ID[j.building], ctx.pos, 1.5)) return err('Le patron est sur ton lieu de travail.');
    if (j.raise >= MAX_RAISE) return { ok: true, changed: false, data: { answer: 'max' } };
    if (j.sinceRaise < RAISE_WORK_MIN) return { ok: true, changed: false, data: { answer: 'tooSoon', left: Math.ceil(RAISE_WORK_MIN - j.sinceRaise) } };
    j.sinceRaise = 0;
    j.raiseAskedAt = ctx.now;
    if (j.perf >= 85 || (j.perf >= 70 && ctx.rand() < 0.5)) { j.raise = Math.round((j.raise + RAISE_STEP) * 100) / 100; return { ok: true, changed: true, data: { answer: 'yes', raise: j.raise } }; }
    if (j.perf < 40) {
      j.perf = Math.max(0, j.perf - 12);
      if (j.perf <= FIRE_PERF + 10) { fire(ctx, 'insolence'); return { ok: true, changed: true, data: { answer: 'fired' } }; }
      return { ok: true, changed: true, data: { answer: 'angry' } };
    }
    return { ok: true, changed: true, data: { answer: 'no' } };
  },

  // ---------------------------------------------------------------- formations
  'career.train'(ctx, { id }) {
    const p = ctx.profile, t = TRAININGS[id];
    if (!t) return err('Formation inconnue.');
    if (!BUILDINGS.some((b) => b.interior === 'school' && this.atBuilding(ctx, b, 1))) return err('Les inscriptions se font à l\'école.');
    if (p.career.diplomas.includes(id)) return err('Tu as déjà ce diplôme.');
    if (p.career.training) return err('Termine d\'abord ta formation en cours.');
    if (p.coins < t.cost) return err(`La formation coûte ${t.cost} PC.`);
    this.addCoins(p, -t.cost);
    p.career.training = { id, ms: 0, ready: false, since: ctx.now };
    ctx.session.trainAt = ctx.now;
    return { ok: true, changed: true, data: { training: p.career.training } };
  },

  'career.exam'(ctx, { answers }) {
    const p = ctx.profile, tr = p.career.training;
    if (!tr) return err('Aucune formation en cours.');
    if (!tr.ready) return err('Il faut d\'abord suivre toute la formation (à l\'école).');
    if (!BUILDINGS.some((b) => b.interior === 'school' && this.atBuilding(ctx, b, 1))) return err('L\'examen se passe à l\'école.');
    const t = TRAININGS[tr.id];
    if (!Array.isArray(answers) || answers.length !== t.questions.length) return err('Copie incomplète.');
    const score = t.questions.reduce((n, q, i) => n + (answers[i] === q[2] ? 1 : 0), 0);
    const passed = score >= t.pass;
    if (passed) { p.career.diplomas.push(tr.id); p.career.training = null; this.addXp(p, 40); }
    else { tr.ready = false; tr.ms = Math.round(t.minutes * 60_000 * 0.5); ctx.session.trainAt = ctx.now; }
    return { ok: true, changed: true, data: { score, total: t.questions.length, passed, need: t.pass } };
  },
};

export function publicShift(sh) {
  return { job: sh.job, building: sh.building, at: sh.at, earned: sh.earned, done: sh.done, missed: sh.missed, task: sh.task };
}
