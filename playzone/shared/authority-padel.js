// AUTORITÉ — PADEL : location du court, match en double contre une paire PNJ, victoire validée par la durée.
import { BUILDING_BY_ID } from './world-layout.js';
import { PADEL, PADEL_COURTS, PADEL_BY_ID, PADEL_FEE, PADEL_MIN_SECS, defaultPadel } from './padel.js';
import { careerResult, prizeMult } from './career.js';

const err = (error) => ({ ok: false, error });
const T = (p) => (p.sports.padel = { ...defaultPadel(), ...(p.sports.padel || {}) });
const atClub = (self, ctx) => self.atBuilding(ctx, BUILDING_BY_ID['padel-club'], 4) || (ctx.pos && PADEL_COURTS.some((k) => Math.abs(ctx.pos.x - k.x) < PADEL.W / 2 + 4 && Math.abs(ctx.pos.z - k.z) < PADEL.L / 2 + 4));

export const PADEL_HANDLERS = {
  'padel.start'(ctx, { opp }) {
    const p = ctx.profile, t = T(p), O = PADEL_BY_ID[opp];
    if (!O) return err('Adversaires inconnus.');
    if (!atClub(this, ctx)) return err('Il faut être au Padel Club des Plaines.');
    if (O.rank > t.beaten + 1 && !p.admin) return err('Bats d\'abord les paires précédentes.');
    if (p.body.injury && p.body.injury.kind !== 'bosse' && !p.admin) return err('Pas de padel avec une blessure.');
    const fee = p.admin ? 0 : PADEL_FEE;
    if (p.coins < fee) return err(`La location du court coûte ${PADEL_FEE} PC.`);
    this.addCoins(p, -fee);
    ctx.session.padel = { opp, at: ctx.now };
    return { ok: true, changed: true, data: { fee } };
  },
  'padel.end'(ctx, { won }) {
    const p = ctx.profile, t = T(p), s = ctx.session.padel;
    if (!s) return err('Aucun match en cours.');
    ctx.session.padel = null;
    const O = PADEL_BY_ID[s.opp], secs = (ctx.now - s.at) / 1000;
    const win = !!won && secs >= PADEL_MIN_SECS;
    t.matches++;
    p.body.endurance = Math.min(100, (p.body.endurance ?? 15) + Math.min(3, secs / 60));
    if (!win) return { ok: true, changed: true, data: { won: false, career: careerResult(p, 'padel', 2, 2) } };
    t.wins++;
    const first = O.rank > t.beaten;
    t.beaten = Math.max(t.beaten, O.rank);
    const prize = Math.round(O.prize * (first ? 1 : 0.4) * prizeMult(p, 'padel', ctx.now));
    this.addCoins(p, prize); this.addXp?.(p, O.xp);
    return { ok: true, changed: true, data: { won: true, prize, first, xp: O.xp, career: careerResult(p, 'padel', 1, 2) } };
  },
};
