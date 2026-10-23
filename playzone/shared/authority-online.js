// AUTORITÉ — ACHATS EN LIGNE : commande payée tout de suite (prix + livraison), colis livré à l'heure
// prévue (temps de jeu). Ultra express = livré immédiatement. Les véhicules sont livrés devant chez soi.
import { DELIVERY, deliveryFee, orderable, MAX_ORDERS } from './online-shop.js';
import { levelFromXp } from './rules.js';
import { VEHICLES } from './content/vehicles.js';
import { BUILDING_BY_ID } from './world-layout.js';
import { deliverySpot } from './property.js';
import { calTime } from './authority-calendar.js';

const err = (error) => ({ ok: false, error });

// Remet l'article au joueur (même règles qu'en boutique). Renvoie un message d'erreur ou null.
function grant(self, ctx, it) {
  const p = ctx.profile;
  if (it.vehicle) {
    if (p.vehicles.some((v) => v.model === it.vehicle && !v.rentUntil)) return 'Tu possèdes déjà ce véhicule.';
    if (p.vehicles.filter((v) => !v.rentUntil).length >= 8) return 'Ton garage est plein (8 véhicules).';
    const home = BUILDING_BY_ID[p.home?.place], shop = Object.values(BUILDING_BY_ID).find((b) => b.shop === it.shop);
    const spec = VEHICLES[it.vehicle];
    p.vehicles.push({ id: ctx.newId(), model: it.vehicle, color: it.color || spec?.paint || '#e63946', damage: 0, fuel: spec?.fuel ?? 0, km: 0, locked: true, park: home ? deliverySpot(home, p.vehicles.length) : shop ? deliverySpot(shop, p.vehicles.length) : null });
    return null;
  }
  const max = it.max ?? (it.slot ? 1 : it.consumable ? 99 : 20);
  if ((p.inventory[it.id] || 0) >= max) return 'Tu en as déjà assez !';
  p.inventory[it.id] = (p.inventory[it.id] || 0) + 1;
  return null;
}

export const ONLINE_HANDLERS = {
  'online.order'(ctx, { itemId, delivery }) {
    const p = ctx.profile, it = this.content.items[itemId], D = DELIVERY[delivery];
    if (!orderable(it)) return err('Cet article ne se vend pas en ligne.');
    if (!D) return err('Mode de livraison inconnu.');
    if (p.justice?.jail) return err('Pas de colis en prison !');
    const lv = levelFromXp(p.xp);
    if (it.level && lv < it.level) return err(`Niveau ${it.level} requis.`);
    if (it.rep && p.rep < it.rep) return err(`${it.rep} points de réputation requis.`);
    p.orders ||= [];
    if (p.orders.length >= MAX_ORDERS) return err('Trop de colis en attente : attends d\'en recevoir quelques-uns.');
    // pas deux fois le même véhicule ou objet unique en route
    if ((it.vehicle || it.max === 1) && p.orders.some((o) => o.itemId === itemId)) return err('Cet article est déjà en cours de livraison.');
    const fee = deliveryFee(it.price, delivery), total = p.admin ? 0 : it.price + fee;
    if (p.coins < total) return err(`Il faut ${total} PC (article ${it.price} + livraison ${fee}).`);
    if (!D.delay) {
      const e = grant(this, ctx, it);
      if (e) return err(e);
      this.addCoins(p, -total);
      return { ok: true, changed: true, data: { delivered: true, total, fee } };
    }
    // vérification à l'avance (pour ne pas payer un colis impossible à recevoir)
    if (it.vehicle && p.vehicles.some((v) => v.model === it.vehicle && !v.rentUntil)) return err('Tu possèdes déjà ce véhicule.');
    this.addCoins(p, -total);
    const o = { id: ctx.newId(), itemId, delivery, total, due: calTime(ctx) + D.delay, at: calTime(ctx) };
    p.orders.push(o);
    return { ok: true, changed: true, data: { delivered: false, total, fee, order: o } };
  },
  // Colis arrivés : remis au joueur (s'ils ne peuvent pas l'être, ils sont remboursés).
  'online.claim'(ctx) {
    const p = ctx.profile, now = calTime(ctx), got = [];
    if (!p.orders?.length) return { ok: true, changed: false, data: { got } };
    const keep = [];
    for (const o of p.orders) {
      if (o.due > now) { keep.push(o); continue; }
      const it = this.content.items[o.itemId];
      const e = it ? grant(this, ctx, it) : 'Article retiré de la vente.';
      if (e) { this.addCoins(p, o.total); got.push({ itemId: o.itemId, refunded: o.total, why: e }); } else got.push({ itemId: o.itemId });
    }
    p.orders = keep;
    return { ok: true, changed: got.length > 0, data: { got } };
  },
  // Annulation : l'article est remboursé, pas la livraison.
  'online.cancel'(ctx, { orderId }) {
    const p = ctx.profile, i = (p.orders || []).findIndex((o) => o.id === orderId);
    if (i < 0) return err('Commande introuvable.');
    const o = p.orders[i], it = this.content.items[o.itemId];
    const refund = Math.min(o.total, it?.price ?? o.total);
    p.orders.splice(i, 1);
    this.addCoins(p, refund);
    return { ok: true, changed: true, data: { refund } };
  },
};
