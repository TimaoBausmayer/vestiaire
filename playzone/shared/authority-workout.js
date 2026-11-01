// AUTORITÉ — EXERCICES : séries validées selon la durée réelle (pas plus vite qu'un humain), gains
// sur le corps, niveaux, records, programme du jour (bonus et série de jours consécutifs).
import { EXOS, dailyProgram, PROGRAM_BONUS, defaultWorkout, exoLevel } from './workout.js';
import { applyNeeds, needsStatus } from './needs.js';
import { todayKey } from './rules.js';

const err = (error) => ({ ok: false, error });
const W = (p) => (p.workout = { ...defaultWorkout(), ...(p.workout || {}) });

export const WORKOUT_HANDLERS = {
  'workout.start'(ctx, { exo }) {
    if (!EXOS[exo]) return err('Exercice inconnu.');
    const p = ctx.profile;
    if (p.body.injury && p.body.injury.kind !== 'bosse' && !p.admin) return err('Pas de sport avec une blessure : repos ou hôpital d\'abord.');
    ctx.session.workout = { exo, at: ctx.now };
    return { ok: true, changed: false, data: {} };
  },

  'workout.end'(ctx, { amount }) {
    const p = ctx.profile, s = ctx.session.workout;
    if (!s) return err('Aucun exercice en cours.');
    ctx.session.workout = null;
    const E = EXOS[s.exo], secs = (ctx.now - s.at) / 1000;
    // plafond réaliste : pas plus de répétitions que le rythme humain, pas plus de secondes que la durée
    const max = E.unit === 'secs' ? secs + 1 : Math.ceil(secs * E.rate) + 1;
    const n = Math.max(0, Math.min(max, 300, Math.floor(Number(amount) || 0)));
    const w = W(p);
    if (n > 0) {
      const g = E.gain, b = p.body;
      b.muscle = Math.min(100, b.muscle + (g.muscle || 0) * n * (1 - b.muscle / 130));
      if (g.endurance) b.endurance = Math.min(100, (b.endurance ?? 15) + g.endurance * n);
      if (g.weight) b.weight = Math.max(45, b.weight + g.weight * n);
      applyNeeds(p.needs, ctx.now, { energie: (g.energie || 0) * n, humeur: 2 + Math.min(15, (g.humeur || 0) * n), hygiene: -Math.min(20, n * 0.3), faim: -Math.min(10, n * 0.12) });
      w.xp[s.exo] = (w.xp[s.exo] || 0) + n;
      w.total[s.exo] = (w.total[s.exo] || 0) + n;
      w.sessions++;
      this.addXp?.(p, Math.min(40, Math.ceil(n / 3)));
    }
    const record = n > (w.best[s.exo] || 0);
    if (record) w.best[s.exo] = n;
    // programme du jour
    const day = todayKey(ctx.now), prog = dailyProgram(day);
    if (w.day !== day) { w.day = day; w.done = {}; }
    const step = prog.find((x) => x.id === s.exo);
    if (step) w.done[s.exo] = Math.max(w.done[s.exo] || 0, n);
    const data = { amount: n, record, best: w.best[s.exo], level: exoLevel(w.xp[s.exo]), xpExo: w.xp[s.exo], needs: needsStatus(p.needs, ctx.now) };
    if (prog.every((x) => (w.done[x.id] || 0) >= x.target) && w.lastFull !== day) {
      const yesterday = todayKey(ctx.now - 86_400_000);
      w.streak = w.lastFull === yesterday ? w.streak + 1 : 1;
      w.lastFull = day;
      const bonus = PROGRAM_BONUS.coins + Math.min(10, w.streak - 1) * 25;
      this.addCoins(p, bonus); this.addXp?.(p, PROGRAM_BONUS.xp);
      Object.assign(data, { program: true, bonus, streak: w.streak });
    }
    return { ok: true, changed: true, data };
  },
};
