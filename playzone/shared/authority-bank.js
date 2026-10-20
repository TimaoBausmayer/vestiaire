// AUTORITÉ — BANQUE : compte (carte bancaire = profile.coins), argent liquide (profile.cash), livret
// d'épargne (profile.savings, intérêts par minute de jeu). Retraits et dépôts au distributeur ou à la
// banque ; virements vers le livret depuis l'appli Banque du téléphone.
import { BUILDING_BY_ID, dist2d } from './world-layout.js';
import { ATMS, WITHDRAW_MAX } from './property.js';

const err = (error) => ({ ok: false, error });
const amountOf = (a) => (typeof a === 'number' && Number.isFinite(a) ? Math.floor(a) : 0);

export function atCashPoint(self, ctx) {
  if (!ctx.pos) return false;
  if (ATMS.some((a) => dist2d(ctx.pos.x, ctx.pos.z, a.x, a.z) < 3)) return true;
  const bank = BUILDING_BY_ID.banque;
  return !!bank && self.atBuilding(ctx, bank, 1);
}

export const BANK_HANDLERS = {
  'bank.withdraw'(ctx, { amount }) {
    const p = ctx.profile, a = amountOf(amount);
    if (a < 1 || a > WITHDRAW_MAX) return err(`Retrait entre 1 et ${WITHDRAW_MAX} PC.`);
    if (!atCashPoint(this, ctx)) return err('Il faut un distributeur ou la banque.');
    if (p.coins < a) return err('Solde insuffisant.');
    p.coins -= a; p.cash = (p.cash || 0) + a;
    return { ok: true, changed: true, data: { cash: p.cash, coins: p.coins } };
  },
  'bank.deposit'(ctx, { amount }) {
    const p = ctx.profile, a = Math.min(amountOf(amount), p.cash || 0);
    if (a < 1) return err('Rien à déposer.');
    if (!atCashPoint(this, ctx)) return err('Il faut un distributeur ou la banque.');
    p.cash -= a; p.coins += a;
    return { ok: true, changed: true, data: { cash: p.cash, coins: p.coins } };
  },
  // Livret d'épargne (appli Banque) : l'argent y rapporte des intérêts à chaque minute de jeu.
  'bank.save'(ctx, { amount }) {
    const p = ctx.profile, a = amountOf(amount);
    if (a < 1 || p.coins < a) return err('Montant invalide.');
    p.coins -= a; p.savings = (p.savings || 0) + a;
    return { ok: true, changed: true, data: { savings: p.savings } };
  },
  'bank.unsave'(ctx, { amount }) {
    const p = ctx.profile, a = Math.min(amountOf(amount), Math.floor(p.savings || 0));
    if (a < 1) return err('Montant invalide.');
    p.savings -= a; p.coins += a;
    return { ok: true, changed: true, data: { savings: p.savings } };
  },
};
