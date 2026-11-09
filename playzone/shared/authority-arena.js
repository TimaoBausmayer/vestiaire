// AUTORITÉ — PAINTBALL ET LASER GAME : inscription (à l'accueil), fin de partie plafonnée par la
// durée réelle, primes selon le résultat, carrière.
import { BUILDING_BY_ID } from './world-layout.js';
import { ARENAS, MODES, MAX_KILL_RATE } from './arena.js';
import { careerResult, prizeMult } from './career.js';
import { applyNeeds, needsStatus } from './needs.js';
import { randInt } from './rng.js';

const err = (error) => ({ ok: false, error });
const R = (p, k) => (p.sports[k] = { games: 0, wins: 0, kills: 0, best: 0, ...(p.sports[k] || {}) });

export const ARENA_HANDLERS = {
  'arena.start'(ctx, { arena, mode }) {
    const p = ctx.profile, A = ARENAS[arena], M = MODES[arena]?.[mode];
    if (!A || !M) return err('Partie inconnue.');
    const b = BUILDING_BY_ID[A.desk];
    const inside = ctx.pos && Math.abs(ctx.pos.x - A.cx) < A.w / 2 + 12 && Math.abs(ctx.pos.z - A.cz) < A.d / 2 + 12;
    if (!this.atBuilding(ctx, b, 6) && !inside) return err(`Inscris-toi à l'accueil : ${b.name}.`);
    if (p.body.injury && p.body.injury.kind !== 'bosse' && !p.admin) return err('Pas de partie avec une blessure.');
    const fee = p.admin ? 0 : M.fee;
    if (p.coins < fee) return err(`L'entrée coûte ${fee} PC.`);
    this.addCoins(p, -fee);
    const seed = randInt(ctx.rand, 1, 2 ** 31 - 2);
    ctx.session.arena = { arena, mode, at: ctx.now, seed };
    return { ok: true, changed: true, data: { seed, fee } };
  },
  'arena.end'(ctx, { kills, deaths, won, place, draw, abandon }) {
    const p = ctx.profile, s = ctx.session.arena;
    if (!s) return err('Aucune partie en cours.');
    ctx.session.arena = null;
    const M = MODES[s.arena][s.mode], rec = R(p, s.arena), secs = (ctx.now - s.at) / 1000;
    kills = Math.max(0, Math.min(Math.floor(secs * MAX_KILL_RATE) + 1, 80, Math.floor(Number(kills) || 0)));
    deaths = Math.max(0, Math.min(200, Math.floor(Number(deaths) || 0)));
    rec.games++; rec.kills += kills; rec.best = Math.max(rec.best, kills);
    applyNeeds(p.needs, ctx.now, { energie: -Math.min(20, secs / 15), humeur: 12, hygiene: s.arena === 'paintball' ? -15 : -5 });
    p.body.endurance = Math.min(100, (p.body.endurance ?? 15) + Math.min(2.5, secs / 120));
    const data = { kills, deaths, needs: needsStatus(p.needs, ctx.now) };
    if (abandon || secs < 40) return { ok: true, changed: true, data: { ...data, abandon: true } };
    let prize = 0, career = null;
    if (M.ffa) {
      place = Math.max(1, Math.min(M.ffa, Math.floor(Number(place) || M.ffa)));
      prize = M.prize[place] || 0;
      if (place === 1) rec.wins++;
      career = careerResult(p, s.arena, place, M.ffa);
    } else {
      const res = won ? 'win' : draw ? 'draw' : 'loss';
      prize = M.prize[res];
      if (won) rec.wins++;
      career = careerResult(p, s.arena, won ? 1 : 2, 2, won ? 30 : draw ? 12 : 6);
      place = null;
    }
    prize = Math.round((prize + kills * 5) * prizeMult(p, s.arena, ctx.now));
    if (prize) this.addCoins(p, prize);
    this.addXp?.(p, 20 + kills * 3 + (won || place === 1 ? 30 : 0));
    if (won || place === 1) p.rep = (p.rep || 0) + 1;
    return { ok: true, changed: true, data: { ...data, prize, place, won: !!won, career } };
  },
};
