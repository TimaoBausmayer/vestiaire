// AUTORITÉ — TENNIS : location du court, match contre un PNJ, victoire validée par la durée.
import { BUILDING_BY_ID } from './world-layout.js';
import { careerResult, careerDiv } from './career.js';
import { TENNIS_CLUBS, T_OPP_BY_ID, TENNIS_FEE, MIN_WIN_SECS, defaultTennis, COURT } from './tennis.js';

const err = (error) => ({ ok: false, error });
const T = (p) => (p.sports.tennis = { ...defaultTennis(), ...(p.sports.tennis || {}) });
const atClub = (self, ctx) => TENNIS_CLUBS.some((c) => self.atBuilding(ctx, BUILDING_BY_ID[c.id], 4) || (ctx.pos && c.courts.some((k) => Math.abs(ctx.pos.x - k.x) < COURT.W / 2 + COURT.runX + 2 && Math.abs(ctx.pos.z - k.z) < COURT.L / 2 + COURT.runZ + 2)));

export const TENNIS_HANDLERS = {
  'tennis.start'(ctx, { opp }) {
    const p = ctx.profile, t = T(p), O = T_OPP_BY_ID[opp];
    if (!O) return err('Adversaire inconnu.');
    if (!atClub(this, ctx)) return err('Il faut être dans un club de tennis.');
    if (O.rank > t.beaten + 1 && !p.admin) return err('Bats d\'abord les adversaires précédents.');
    if (p.body.injury && p.body.injury.kind !== 'bosse' && !p.admin) return err('Tu es blessé·e : pas de tennis aujourd\'hui.');
    const fee = p.admin ? 0 : TENNIS_FEE;
    if (p.coins < fee) return err(`La location du court coûte ${TENNIS_FEE} PC.`);
    this.addCoins(p, -fee);
    ctx.session.tennis = { opp, at: ctx.now };
    return { ok: true, changed: true, data: { fee } };
  },
  'tennis.end'(ctx, { won, aces }) {
    const p = ctx.profile, t = T(p), s = ctx.session.tennis;
    if (!s) return err('Aucun match en cours.');
    ctx.session.tennis = null;
    const O = T_OPP_BY_ID[s.opp], secs = (ctx.now - s.at) / 1000;
    const win = !!won && secs >= MIN_WIN_SECS;
    t.matches++;
    t.aces += Math.max(0, Math.min(20, Math.floor(Number(aces) || 0)));
    p.body.endurance = Math.min(100, (p.body.endurance ?? 15) + Math.min(3, secs / 60));
    if (!win) { const career = careerResult(p, 'tennis', 2, 2); return { ok: true, changed: true, data: { won: false, career } }; }
    const career = careerResult(p, 'tennis', 1, 2);
    t.wins++;
    const first = O.rank > t.beaten;
    t.beaten = Math.max(t.beaten, O.rank);
    const prize = Math.round(O.prize * (first ? 1 : 0.4) * careerDiv(p, 'tennis').mult);
    this.addCoins(p, prize); this.addXp?.(p, O.xp);
    p.rep = (p.rep || 0) + (first ? 1 : 0);
    return { ok: true, changed: true, data: { won: true, prize, first, xp: O.xp, career } };
  },
};
