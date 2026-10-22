import { h } from './dom.js';
import { PREMIUM_PACKS, PAYMENTS_ENABLED } from '../../shared/premium.js';

// Appli « Boutique » du téléphone : packs premium (structure). Le paiement réel n'est pas branché ;
// en mode admin, tout est gratuit.
export function premiumApp(g, b) {
  const admin = !!g.profile.admin;
  b.append(h('p.muted', admin ? '👑 Mode admin : tout est GRATUIT pour toi.' : PAYMENTS_ENABLED ? 'Achats sécurisés.' : '🚧 Boutique en construction : aucun paiement réel n\'est possible pour l\'instant (rien ne sera débité).'));
  b.append(h('div.list', PREMIUM_PACKS.map((pk) => h('div.list-item',
    h('span', { style: { fontSize: '28px' } }, pk.icon),
    h('div.grow', h('div.t', pk.name), h('div.d', pk.desc)),
    h('button.btn.small', { onclick: async () => {
      try { await g.net.request('premium.buy', { id: pk.id }); g.sfx('cash'); g.ui.toast(`🎁 ${pk.name} reçu (gratuit en mode admin) !`, 'good', 4000); }
      catch (e) { g.ui.toast(e.message, 'bad', 5000); }
    } }, admin ? 'Gratuit' : `${pk.euros.toFixed(2).replace('.', ',')} €`)))));
}
