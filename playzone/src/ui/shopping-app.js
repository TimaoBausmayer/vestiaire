import { h, fmt } from './dom.js';
import { DELIVERY, deliveryFee, orderable, etaText } from '../../shared/online-shop.js';
import { BUILDINGS } from '../../shared/world-layout.js';
import { calNow } from '../events/agenda.js';

// Appli « PlayAzon » : on commande depuis le téléphone, on choisit la livraison (ultra express tout
// de suite, ou moins cher si on accepte d'attendre), on suit ses colis.

const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 4500); g.sfx('error'); return null; } };
let SHOP_NAMES = null;
const shopName = (id) => {
  if (!SHOP_NAMES) { SHOP_NAMES = {}; for (const b of BUILDINGS) if (b.shop && !SHOP_NAMES[b.shop]) SHOP_NAMES[b.shop] = b.name; }
  return SHOP_NAMES[id] || id;
};
const view = { q: '', shop: '', item: null, tab: 'shop' };

export function shoppingApp(g, b, phone) {
  const items = Object.values(g.net.content.items).filter(orderable);
  const orders = g.profile.orders || [];
  b.append(h('div.seg', h(`button${view.tab === 'shop' ? '.on' : ''}`, { onclick: () => { view.tab = 'shop'; view.item = null; phone.render(); } }, '🛒 Boutique'),
    h(`button${view.tab === 'orders' ? '.on' : ''}`, { onclick: () => { view.tab = 'orders'; phone.render(); } }, `📦 Mes colis${orders.length ? ` (${orders.length})` : ''}`)));
  if (view.tab === 'orders') return ordersView(g, b, phone, orders);
  if (view.item) return itemView(g, b, phone, g.net.content.items[view.item]);
  const search = h('input.ph-search', { placeholder: '🔍 Chercher un article (aile, canapé, pizza...)', value: view.q, onkeydown: (e) => e.stopPropagation(), oninput: (e) => { view.q = e.target.value; draw(); } });
  const shops = [...new Set(items.map((i) => i.shop))].sort((a, c) => shopName(a).localeCompare(shopName(c)));
  const cats = h('select.input', { onchange: (e) => { view.shop = e.target.value; draw(); } }, h('option', { value: '' }, 'Tous les magasins'), shops.map((s) => h('option', { value: s, selected: view.shop === s }, shopName(s))));
  const list = h('div');
  b.append(search, cats, list);
  function draw() {
    list.textContent = '';
    const q = view.q.trim().toLowerCase();
    const found = items.filter((i) => (!view.shop || i.shop === view.shop) && (!q || `${i.name} ${i.desc || ''}`.toLowerCase().includes(q)));
    if (!found.length) { list.append(h('p.muted', 'Aucun article trouvé.')); return; }
    for (const it of found.slice(0, 60)) {
      list.append(h('button.list-item.clickable', { onclick: () => { view.item = it.id; phone.render(); } }, h('span', { style: { fontSize: '24px' } }, it.emoji || '📦'),
        h('div.grow', h('div.t', it.name), h('div.d', shopName(it.shop))), h('span.pill', `${fmt(it.price)} PC`)));
    }
    if (found.length > 60) list.append(h('p.muted', `+ ${found.length - 60} autres articles : affine ta recherche.`));
  }
  draw();
}

function itemView(g, b, phone, it) {
  if (!it) { view.item = null; phone.render(); return; }
  const admin = !!g.profile.admin;
  b.append(h('button.btn.small.ghost', { onclick: () => { view.item = null; phone.render(); } }, '‹ Retour'),
    h('div.gear-card', h('div.big', `${it.emoji || '📦'} ${it.name}`), h('div.d', it.desc || ''), h('div.d', `Vendu par : ${shopName(it.shop)}${it.level ? ` · niveau ${it.level} requis` : ''}`), h('div.t', `${fmt(it.price)} PC`)));
  b.append(h('h4.gear-h', '🚚 Livraison (plus c\'est rapide, plus c\'est cher)'));
  for (const [id, D] of Object.entries(DELIVERY)) {
    const fee = deliveryFee(it.price, id), total = admin ? 0 : it.price + fee;
    b.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, D.icon),
      h('div.grow', h('div.t', D.name), h('div.d', `${fee ? `Livraison ${fmt(fee)} PC` : 'Livraison gratuite'} · total ${admin ? 'gratuit (admin)' : `${fmt(total)} PC`}`)),
      h('button.btn.small', { onclick: async () => {
        const r = await req(g, 'online.order', { itemId: it.id, delivery: id });
        if (!r) return;
        g.sfx('cash');
        g.ui.toast(r.delivered ? `🚁 Livré par drone : ${it.name} est à toi !` : `📦 Commande passée : ${it.name} arrive ${etaText(r.order.due - calNow(g))}.`, 'money', 4500);
        view.item = null; view.tab = r.delivered ? 'shop' : 'orders'; phone.render();
      } }, 'Commander')));
  }
  if (it.vehicle) b.append(h('p.muted', 'Les véhicules sont livrés devant chez toi (ou devant le concessionnaire si tu n\'as pas de logement).'));
}

function ordersView(g, b, phone, orders) {
  if (!orders.length) { b.append(h('p.muted', 'Aucun colis en route. Les colis arrivés sont rangés directement dans ton sac (ou ton garage).')); return; }
  const now = calNow(g), items = g.net.content.items;
  for (const o of [...orders].sort((a, c) => a.due - c.due)) {
    const it = items[o.itemId], D = DELIVERY[o.delivery], left = o.due - now;
    const prog = Math.max(0, Math.min(1, (now - o.at) / Math.max(1, o.due - o.at)));
    b.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, it?.emoji || '📦'),
      h('div.grow', h('div.t', it?.name || o.itemId), h('div.d', `${D?.icon || ''} ${D?.name || ''} · ${etaText(left)}`), h('div.gear-stat', h('div.bar', h('div', { style: { width: `${Math.round(prog * 100)}%` } })))),
      h('button.btn.small.ghost', { onclick: async () => { const r = await req(g, 'online.cancel', { orderId: o.id }); if (r) { g.ui.toast(`Commande annulée : ${fmt(r.refund)} PC remboursés (la livraison ne l'est pas).`, '', 4000); phone.render(); } } }, 'Annuler')));
  }
}

// Système : récupère les colis arrivés (toutes les quelques secondes s'il y en a d'attendus).
export class OnlineOrders {
  constructor(g) { this.g = g; this.t = 0; this.busy = false; }
  update(dt) {
    const g = this.g, orders = g.profile?.orders;
    this.t -= dt;
    if (this.t > 0 || this.busy || !orders?.length) return;
    this.t = 5;
    if (!orders.some((o) => o.due <= calNow(g))) return;
    this.busy = true;
    g.net.request('online.claim', {}).then((r) => {
      const items = g.net.content.items;
      for (const x of r.got || []) {
        const name = items[x.itemId]?.name || x.itemId;
        if (x.refunded) g.ui.toast(`📦 Colis « ${name} » non livrable (${x.why}) : ${fmt(x.refunded)} PC remboursés.`, 'bad', 5000);
        else { g.sfx('success'); g.ui.toast(`📦 Ding dong ! Colis livré : ${name}${items[x.itemId]?.vehicle ? ' (garé devant chez toi)' : ' (dans ton sac)'}.`, 'good', 5000); g.phone?.badge('achats'); }
      }
    }).catch(() => {}).finally(() => { this.busy = false; });
  }
}
