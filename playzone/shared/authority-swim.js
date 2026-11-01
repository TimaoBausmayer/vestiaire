// AUTORITÉ — NATATION : inscription à la piscine, résultat validé (temps possible), primes, progrès.
import { BUILDING_BY_ID } from './world-layout.js';
import { POOL, SWIM_RACES, SWIM_VMAX, swimField, defaultSwim } from './swim.js';
import { randInt } from './rng.js';
import { applyNeeds, needsStatus } from './needs.js';

const err = (error) => ({ ok: false, error });
const S = (p) => (p.sports.swim = { ...defaultSwim(), ...(p.sports.swim || {}) });
const atPool = (self, ctx) => self.atBuilding(ctx, BUILDING_BY_ID.piscine, 4) || (ctx.pos && Math.abs(ctx.pos.x - POOL.x) < POOL.L / 2 + 8 && Math.abs(ctx.pos.z - POOL.z) < POOL.W / 2 + 8);

export const SWIM_HANDLERS = {
  'swim.start'(ctx, { race }) {
    const p = ctx.profile, R = SWIM_RACES[race], s = S(p);
    if (!R) return err('Épreuve inconnue.');
    if (!atPool(this, ctx)) return err('Il faut être à la piscine olympique.');
    if (p.body.injury && p.body.injury.kind !== 'bosse' && !p.admin) return err('Pas de natation avec une blessure.');
    const fee = p.admin ? 0 : R.fee;
    if (p.coins < fee) return err(`L'entrée coûte ${R.fee} PC.`);
    this.addCoins(p, -fee);
    const seed = randInt(ctx.rand, 1, 2 ** 31 - 2);
    const field = swimField(race, seed, s.skill);
    ctx.session.swim = { race, at: ctx.now, field };
    return { ok: true, changed: true, data: { field, fee } };
  },
  'swim.end'(ctx, { time, abandon, meters }) {
    const p = ctx.profile, s = S(p), ses = ctx.session.swim;
    if (!ses) return err('Aucune course en cours.');
    ctx.session.swim = null;
    const R = SWIM_RACES[ses.race], real = (ctx.now - ses.at) / 1000;
    s.races++;
    const swum = R.dist ? (abandon ? 0 : R.dist) : Math.max(0, Math.min(real * SWIM_VMAX, Math.floor(Number(meters) || 0)));
    p.body.endurance = Math.min(100, (p.body.endurance ?? 15) + Math.min(4, swum / 40));
    p.body.weight = Math.max(45, p.body.weight - swum * 0.0015);
    s.skill = Math.min(100, Math.round((s.skill + swum / 60 * (1 - s.skill / 130)) * 10) / 10);
    applyNeeds(p.needs, ctx.now, { energie: -swum * 0.08, hygiene: 10, humeur: 4 });
    const data = { skill: s.skill, swum, needs: needsStatus(p.needs, ctx.now) };
    if (!R.dist || abandon) return { ok: true, changed: true, data };
    time = Number(time) || 0;
    if (!(time >= R.dist / SWIM_VMAX) || time > real + 2) return { ok: true, changed: true, data: { ...data, invalid: true } };
    const place = 1 + ses.field.filter((n) => n.time < time).length;
    const prize = R.prizes[place - 1] || 0;
    if (prize) this.addCoins(p, prize);
    if (place === 1) s.wins++;
    if (place <= 3) s.podiums++;
    const key = ses.race === '50' ? 'best' : 'best100';
    const record = !s[key] || time < s[key];
    if (record) s[key] = Math.round(time * 100) / 100;
    this.addXp?.(p, place === 1 ? 50 : 20);
    return { ok: true, changed: true, data: { ...data, place, prize, record, time } };
  },
};
