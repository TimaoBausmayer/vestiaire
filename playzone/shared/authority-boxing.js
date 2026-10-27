// AUTORITÉ — BOXE : séance au sac de frappe, combats d'entraînement sur le ring (club de boxe).
import { BUILDINGS } from './world-layout.js';
import { BOX, OPP_BY_ID, defaultBoxing, bagGain, minWinSeconds } from './boxing.js';
import { applyNeeds, needsStatus } from './needs.js';

const err = (error) => ({ ok: false, error });
const atClub = (self, ctx) => BUILDINGS.some((b) => b.interior === 'boxing' && self.atBuilding(ctx, b, 1));
const boxing = (p) => (p.sports.boxing = { ...defaultBoxing(), ...(p.sports.boxing || {}) });
const fee = (self, p) => {
  const c = p.admin ? 0 : BOX.session;
  if (p.coins < c) return `La séance coûte ${BOX.session} PC.`;
  self.addCoins(p, -c);
  return null;
};

export const BOXING_HANDLERS = {
  'boxing.bag'(ctx, { hits }) {
    const p = ctx.profile, B = boxing(p);
    if (!atClub(this, ctx)) return err('Il faut être dans un club de boxe.');
    const wait = (p.cooldowns['boxing:bag'] || 0) + BOX.bagCd - ctx.now;
    if (wait > 0 && !p.admin) return err(`Souffle un peu : encore ${Math.ceil(wait / 1000)} s.`);
    const f = fee(this, p); if (f) return err(f);
    const gain = bagGain(hits);
    p.cooldowns['boxing:bag'] = ctx.now;
    p.body.muscle = Math.min(100, p.body.muscle + gain.muscle);
    p.body.endurance = Math.min(100, (p.body.endurance ?? 15) + gain.endurance);
    B.bags++; B.xp += gain.xp;
    this.addXp?.(p, gain.xp);
    applyNeeds(p.needs, ctx.now, { energie: -10, faim: -6, hygiene: -12, humeur: 6 });
    return { ok: true, changed: true, data: { ...gain, total: p.body.muscle, needs: needsStatus(p.needs, ctx.now) } };
  },

  'boxing.start'(ctx, { opp }) {
    const p = ctx.profile, B = boxing(p), O = OPP_BY_ID[opp];
    if (!atClub(this, ctx)) return err('Il faut être dans un club de boxe.');
    if (!O) return err('Adversaire inconnu.');
    if (O.rank > B.beaten + 1 && !p.admin) return err('Bats d\'abord les adversaires précédents.');
    if ((p.needs?.energie ?? 100) < 10 && !p.admin) return err('Tu es trop fatigué·e pour boxer. Va dormir !');
    const f = fee(this, p); if (f) return err(f);
    ctx.session.boxing = { opp, at: ctx.now };
    return { ok: true, changed: true, data: { opp, at: ctx.now } };
  },

  'boxing.end'(ctx, { won, ko }) {
    const p = ctx.profile, B = boxing(p), S = ctx.session.boxing;
    if (!S) return err('Aucun combat en cours.');
    ctx.session.boxing = null;
    const O = OPP_BY_ID[S.opp], secs = (ctx.now - S.at) / 1000;
    const win = !!won && secs >= minWinSeconds(O, p.body.muscle);
    applyNeeds(p.needs, ctx.now, { energie: -18, faim: -10, hygiene: -20, humeur: win ? 15 : -5 });
    if (!win) { B.losses++; return { ok: true, changed: true, data: { won: false, needs: needsStatus(p.needs, ctx.now) } }; }
    B.wins++; if (ko) B.kos++;
    const first = O.rank > B.beaten;
    B.beaten = Math.max(B.beaten, O.rank);
    const prize = Math.round(O.prize * (first ? 1 : 0.4) * (ko ? 1.25 : 1));
    this.addCoins(p, prize);
    this.addXp?.(p, O.xp);
    B.xp += O.xp;
    p.body.muscle = Math.min(100, p.body.muscle + 0.6);
    return { ok: true, changed: true, data: { won: true, ko: !!ko, prize, first, xp: O.xp, needs: needsStatus(p.needs, ctx.now) } };
  },
};
