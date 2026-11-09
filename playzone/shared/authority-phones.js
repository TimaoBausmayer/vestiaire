// AUTORITÉ — TÉLÉPHONES : achat d'un modèle (dans un magasin high-tech), choix du modèle et de la
// couleur parmi ceux qu'on possède. L'ancien téléphone est gardé (on peut changer quand on veut).
import { PHONES, DEFAULT_PHONE, PHONE_SHOPS } from './phones.js';
import { BUILDINGS } from './world-layout.js';
export const ONLINE_FEE = 49;

const err = (error) => ({ ok: false, error });
const mine = (p) => (p.phone = { ...DEFAULT_PHONE, ...(p.phone || {}), owned: [...new Set([...(p.phone?.owned || []), 'basique'])] });

export const PHONE_HANDLERS = {
  // en magasin, ou en ligne depuis le téléphone (livraison express : +ONLINE_FEE PC)
  'phone.buy'(ctx, { model, color, online }) {
    const p = ctx.profile, P = PHONES[model];
    if (!P) return err('Modèle inconnu.');
    if (!P.colors[color]) return err('Couleur indisponible.');
    const inShop = BUILDINGS.some((b) => PHONE_SHOPS.includes(b.shop) && this.atBuilding(ctx, b, 4));
    if (!inShop && !online) return err('Les téléphones s\'achètent chez MégaTech ou Pixel & Câbles (ou en ligne sur PlayAzon).');
    const ph = mine(p);
    const price = p.admin || ph.owned.includes(model) ? 0 : P.price + (inShop ? 0 : ONLINE_FEE);
    if (p.coins < price) return err(`Ce téléphone coûte ${price} PC.`);
    this.addCoins(p, -price);
    if (!ph.owned.includes(model)) ph.owned.push(model);
    ph.model = model; ph.color = color;
    return { ok: true, changed: true, data: { price, model, color } };
  },
  'phone.equip'(ctx, { model, color }) {
    const p = ctx.profile, P = PHONES[model], ph = mine(p);
    if (!P || !ph.owned.includes(model)) return err('Tu ne possèdes pas ce téléphone.');
    if (color && !P.colors[color]) return err('Couleur indisponible.');
    ph.model = model; ph.color = color || Object.keys(P.colors)[0];
    return { ok: true, changed: true, data: { model, color: ph.color } };
  },
};
