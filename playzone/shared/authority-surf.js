// AUTORITÉ — SURF : session libre ou compétition (2 meilleures vagues sur 4 min contre des PNJ).
// Planche possédée, location ou premier cours gratuit. Score plafonné par la durée réelle.
import { BUILDING_BY_ID } from './world-layout.js';
import { SURF, BOARDS, RENTAL, bestBoard, CONTEST, contestField } from './surf.js';
import { randInt } from './rng.js';
import { careerResult, prizeMult } from './career.js';
import { applyNeeds, needsStatus } from './needs.js';

const err = (error) => ({ ok: false, error });
const S = (p) => (p.sports.surf = { skill: 5, trial: false, sessions: 0, waves: 0, best: 0, bestWave: 0, contests: 0, wins: 0, ...(p.sports.surf || {}) });
const atSpot = (self, ctx) => self.atBuilding(ctx, BUILDING_BY_ID['surf-school'], 6) || self.atBuilding(ctx, BUILDING_BY_ID['surf-shop'], 6)
  || (ctx.pos && ctx.pos.x > SURF.x1 - 40 && ctx.pos.x < SURF.x2 + 40 && ctx.pos.z > 55 && ctx.pos.z < SURF.zSpawn);

export const SURF_HANDLERS = {
  'surf.start'(ctx, { mode = 'libre' }) {
    const p = ctx.profile, s = S(p);
    if (!atSpot(this, ctx)) return err('Le surf se lance depuis l\'École de surf de la Plage des Orteils.');
    if (p.body.injury && p.body.injury.kind !== 'bosse' && !p.admin) return err('Pas de surf avec une blessure.');
    let board = bestBoard(p.inventory), paid = 0, trial = false;
    if (!board) {
      board = RENTAL.board;
      if (!s.trial || p.admin) { s.trial = true; trial = !p.admin; }
      else { if (p.coins < RENTAL.price) return err(`Location de planche : ${RENTAL.price} PC.`); this.addCoins(p, -RENTAL.price); paid = RENTAL.price; }
    }
    let field = null;
    if (mode === 'contest') {
      const fee = p.admin ? 0 : CONTEST.fee;
      if (p.coins < fee) return err(`Inscription : ${fee} PC.`);
      this.addCoins(p, -fee); paid += fee;
      field = contestField(randInt(ctx.rand, 1, 99999), s.skill);
    }
    s.sessions++;
    ctx.session.surf = { at: ctx.now, mode, field };
    return { ok: true, changed: true, data: { board, stats: BOARDS[board], paid, trial, field, mode, skill: s.skill } };
  },
  'surf.end'(ctx, { waves, scores, airs, tubes }) {
    const p = ctx.profile, s = S(p), ses = ctx.session.surf;
    if (!ses) return err('Aucune session de surf.');
    ctx.session.surf = null;
    const secs = (ctx.now - ses.at) / 1000;
    const n = Math.max(0, Math.min(Math.floor(secs / 8) + 1, 40, Math.floor(Number(waves) || 0)));
    // notes des vagues : au plus 3 000 par vague et 260 par seconde de session
    const sc = (Array.isArray(scores) ? scores : []).slice(0, n).map((x) => Math.max(0, Math.min(3000, Math.floor(Number(x) || 0))));
    let total = sc.reduce((a, b) => a + b, 0);
    if (total > secs * 260) { const k = secs * 260 / total; for (let i = 0; i < sc.length; i++) sc[i] = Math.floor(sc[i] * k); total = sc.reduce((a, b) => a + b, 0); }
    const bestWave = sc.length ? Math.max(...sc) : 0;
    s.waves += n;
    s.bestWave = Math.max(s.bestWave, bestWave);
    s.best = Math.max(s.best, total);
    s.skill = Math.min(100, Math.round((s.skill + Math.min(4, n * 0.35 + (Number(tubes) || 0) * 0.3 + (Number(airs) || 0) * 0.3) * (1 - s.skill / 130)) * 10) / 10);
    // ramer, ça muscle et ça fatigue
    p.body.endurance = Math.min(100, (p.body.endurance ?? 15) + Math.min(3, secs / 90));
    p.body.muscle = Math.min(100, p.body.muscle + Math.min(1.5, secs / 240));
    p.body.weight = Math.max(45, p.body.weight - Math.min(0.6, secs / 600));
    applyNeeds(p.needs, ctx.now, { energie: -Math.min(25, secs / 12), hygiene: 8, humeur: 10 + Math.min(15, n * 2) });
    const data = { waves: n, total, bestWave, skill: s.skill, needs: needsStatus(p.needs, ctx.now) };
    if (ses.mode === 'contest' && ses.field) {
      const two = [...sc].sort((a, b) => b - a).slice(0, CONTEST.waves).reduce((a, b) => a + b, 0);
      if (secs < 60) return { ok: true, changed: true, data: { ...data, contest: { abandon: true } } };
      const place = 1 + ses.field.filter((f) => f.score > two).length;
      const prize = Math.round((CONTEST.prizes[place - 1] || 0) * prizeMult(p, 'surf', ctx.now));
      if (prize) this.addCoins(p, prize);
      s.contests++; if (place === 1) { s.wins++; p.rep = (p.rep || 0) + 3; }
      const career = careerResult(p, 'surf', place, ses.field.length + 1);
      Object.assign(data, { contest: { two, place, of: ses.field.length + 1, prize, field: ses.field }, career });
    } else if (n > 0) data.career = careerResult(p, 'surf', 0, 0, Math.min(10, Math.round(bestWave / 300)));
    this.addXp?.(p, Math.min(80, 10 + n * 4));
    return { ok: true, changed: true, data };
  },
};
