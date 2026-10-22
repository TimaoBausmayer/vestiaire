// AUTORITÉ — BOUTIQUE PREMIUM : structure seulement. Sans prestataire de paiement, rien n'est vendu
// contre de l'argent réel ; l'admin peut se servir gratuitement.
import { PREMIUM_BY_ID, PAYMENTS_ENABLED } from './premium.js';
import { VEHICLES } from './content/vehicles.js';

const err = (error) => ({ ok: false, error });

export const PREMIUM_HANDLERS = {
  'premium.buy'(ctx, { id }) {
    const p = ctx.profile, pack = PREMIUM_BY_ID[id];
    if (!pack) return err('Pack inconnu.');
    if (!p.admin && !PAYMENTS_ENABLED) return err('Paiement réel indisponible : la boutique premium est en construction. Rien n\'a été débité.');
    if (!p.admin) return err('Paiement non vérifié.');   // un futur paiement devra être vérifié côté serveur
    const g = pack.gives;
    if (g.coins) this.addCoins(p, g.coins);
    for (const it of g.items || []) p.inventory[it] = Math.max(1, p.inventory[it] || 0);
    if (g.vipDays) p.vipUntil = Math.max(ctx.now, p.vipUntil || 0) + g.vipDays * 24 * 3600_000;
    if (g.vehicle && VEHICLES[g.vehicle] && !p.vehicles.some((v) => v.model === g.vehicle)) p.vehicles.push({ id: ctx.newId(), model: g.vehicle, color: VEHICLES[g.vehicle].paint || '#e63946', damage: 0, fuel: VEHICLES[g.vehicle].fuel ?? 0, km: 0, locked: true, park: null });
    return { ok: true, changed: true, data: { id, free: true } };
  },
};
