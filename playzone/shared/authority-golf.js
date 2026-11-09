// AUTORITÉ — MINI-GOLF : entrée du parcours, carte de score validée (coups possibles, durée), prime.
import { BUILDING_BY_ID } from './world-layout.js';
import { careerResult, careerDiv, prizeMult } from './career.js';
import { GOLF, HOLES, PAR, MAX_STROKES, defaultGolf, golfPrize } from './golf.js';

const err = (error) => ({ ok: false, error });
const G = (p) => (p.sports.golf = { ...defaultGolf(), ...(p.sports.golf || {}) });
const atGolf = (self, ctx) => self.atBuilding(ctx, BUILDING_BY_ID.minigolf, 4) || (ctx.pos && Math.abs(ctx.pos.x - GOLF.x) < GOLF.w / 2 + 6 && Math.abs(ctx.pos.z - GOLF.z) < GOLF.d / 2 + 6);

export const GOLF_HANDLERS = {
  'golf.start'(ctx) {
    const p = ctx.profile;
    if (!atGolf(this, ctx)) return err('Il faut être au mini-golf.');
    const fee = p.admin ? 0 : GOLF.fee;
    if (p.coins < fee) return err(`Le parcours coûte ${GOLF.fee} PC.`);
    this.addCoins(p, -fee);
    ctx.session.golf = { at: ctx.now };
    return { ok: true, changed: true, data: { fee } };
  },
  'golf.end'(ctx, { strokes }) {
    const p = ctx.profile, g = G(p), s = ctx.session.golf;
    if (!s) return err('Aucun parcours en cours.');
    ctx.session.golf = null;
    if (!Array.isArray(strokes) || strokes.length !== HOLES.length) return { ok: true, changed: false, data: { done: false } };
    const card = strokes.map((n) => Math.max(1, Math.min(MAX_STROKES, Math.floor(Number(n) || MAX_STROKES))));
    const secs = (ctx.now - s.at) / 1000;
    if (secs < card.reduce((a, n) => a + n, 0) * 1.5) return err('Parcours trop rapide : carte refusée.');
    const total = card.reduce((a, n) => a + n, 0), aces = card.filter((n) => n === 1).length;
    g.rounds++; g.aces += aces;
    const record = !g.best || total < g.best;
    if (record) g.best = total;
    const prize = Math.round(golfPrize(total, aces) * prizeMult(p, 'golf'));
    // carrière : la carte compte comme une compétition (plus on est sous le par, mieux on est classé)
    const career = careerResult(p, 'golf', 0, 0, Math.max(3, Math.min(45, 10 + (PAR - total) * 4 + aces * 5)));
    if (prize) this.addCoins(p, prize);
    this.addXp?.(p, 30 + Math.max(0, PAR - total) * 5);
    return { ok: true, changed: true, data: { done: true, total, par: PAR, aces, record, prize, career } };
  },
};
