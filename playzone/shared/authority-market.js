// AUTORITÉ — MARCHÉS : achats aux stands (liquide ou carte), négociation avec les vendeurs.
// Le marché doit être ouvert (créneau du calendrier) et le joueur devant le stand.
import { liveOf, CAL_BY_ID } from './calendar.js';
import { calTime } from './authority-calendar.js';
import { marketStalls, haggle, STALL_R } from './market.js';

const err = (error) => ({ ok: false, error });

function stallOf(self, ctx, occ, stallId) {
  const o = liveOf((e) => e.kind === 'market', calTime(ctx)).find((x) => x.occ === occ);
  if (!o) return { e: 'Le marché est fermé : les horaires sont dans l\'Agenda.' };
  const st = marketStalls(occ, CAL_BY_ID[o.id].market, self.content.items).find((s) => s.id === stallId);
  if (!st) return { e: 'Stand introuvable.' };
  const pos = ctx.pos;
  if (!pos || Math.hypot(pos.x - st.slot.x, pos.z - st.slot.z) > STALL_R + 3) return { e: 'Approche-toi du stand.' };
  return { st };
}

export const MARKET_HANDLERS = {
  // Proposer une remise (off = 0.05..0.5) sur un article : le vendeur accepte, refuse ou fait une contre-offre.
  'market.haggle'(ctx, { occ, stall, item, off }) {
    const { st, e } = stallOf(this, ctx, occ, stall);
    if (e) return err(e);
    const it = st.items.find((x) => x.id === item);
    if (!it) return err('Cet article n\'est pas sur ce stand.');
    const o = Math.max(0, Math.min(0.5, Number(off) || 0));
    const hs = ((ctx.session.haggle ||= {})[`${occ}|${stall}`] ||= { tries: 0, deals: {} });
    const r = haggle(st.vendor, o, hs.tries, ctx.profile.rep);
    if (r.done) return { ok: true, data: { ok: false, done: true, say: r.say } };
    hs.tries++;
    if (r.ok) hs.deals[item] = Math.max(1, Math.round(it.price * (1 - o)));
    return { ok: true, data: { ok: r.ok, say: r.say, counter: r.counter, price: hs.deals[item] ?? it.price, tries: hs.tries } };
  },

  'market.buy'(ctx, { occ, stall, item, pay }) {
    const p = ctx.profile;
    const { st, e } = stallOf(this, ctx, occ, stall);
    if (e) return err(e);
    const it = st.items.find((x) => x.id === item), def = this.content.items[item];
    if (!it || !def) return err('Cet article n\'est pas sur ce stand.');
    const price = ctx.session.haggle?.[`${occ}|${stall}`]?.deals?.[item] ?? it.price;
    // quantités par client et par marché
    if (p.market?.occ !== occ) p.market = { occ, bought: {} };
    const key = `${stall}|${item}`;
    if ((p.market.bought[key] || 0) >= it.qty) return err('Le vendeur n\'en a plus pour toi aujourd\'hui.');
    const max = def.max ?? (def.slot ? 1 : def.consumable ? 99 : 20);
    if ((p.inventory[item] || 0) >= max) return err('Tu en as déjà assez !');
    if (!this.canPay(p, price, pay)) return err(pay === 'cash' ? 'Pas assez de liquide (il y a des distributeurs autour de la place).' : 'Pas assez de PlayCoins.');
    this.charge(p, price, pay);
    p.inventory[item] = (p.inventory[item] || 0) + 1;
    p.market.bought[key] = (p.market.bought[key] || 0) + 1;
    return { ok: true, changed: true, data: { price, count: p.inventory[item], saved: it.base - price } };
  },
};
