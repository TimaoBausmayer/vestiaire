import { h, clear } from '../ui/dom.js';
import { VEHICLES } from '../../shared/content/vehicles.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import {
  usedOffers, resaleValue, RENTALS, RENTAL_DURATIONS, rentalPrice, HOUSING, HOUSING_BY_ID, DEPOSIT_RATE, LOAN_RATE,
  loanHourly, sellValue, hourlyBills, secondHandOffers, secondHandBuys, SECOND_HAND,
} from '../../shared/property.js';
import { vehicleIcon, vehicleName } from '../vehicles/vehicles.js';
import { testDrivePanel } from '../vehicles/testdrive.js';

// PANNEAUX DES COMMERCES "PROPRIÉTÉ" : occasions, location, agence immobilière, dépôt-vente, casse.
// Tout achat ou vente passe par l'autorité (validation de la position, de l'argent, de l'unicité).

const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const kmh = (m) => Math.round(VEHICLES[m].max * 3.6);

async function act(g, type, payload, ok) {
  try { const r = await g.net.request(type, payload); g.sfx('cash'); if (ok) g.ui.toast(ok(r), 'money', 4500); return r; } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad', 4000); return null; }
}

function tabs(list, cur, onPick) {
  return h('div.tabs', list.map(([k, v]) => h(`button.tab${cur === k ? '.active' : ''}`, { onclick: () => onPick(k) }, v)));
}

// Liste "revendre mes véhicules" (concession, occasions, casse).
function sellVehicles(g, body, refresh, factor = 1, label = 'Revendre') {
  const mine = g.profile.vehicles.filter((v) => !v.rentUntil);
  if (!mine.length) { body.append(h('p.muted', 'Tu n\'as aucun véhicule à vendre.')); return; }
  for (const v of mine) {
    const wv = g.vehicles.owned.get(v.id);
    const price = factor === 1 ? resaleValue(v) : Math.max(20, Math.round(resaleValue(v) * factor));
    body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, vehicleIcon(v.model)),
      h('div.grow', h('div.t', vehicleName(v.model)), h('div.d', `${fmt(v.km || 0)} km · état ${Math.round((1 - (v.damage || 0)) * 100)} %${wv ? '' : ' · (garé ailleurs : pas grave, on vient le chercher)'}`)),
      h('button.btn.small', { onclick: async () => {
        if (!(await g.ui.confirm(`${label} ?`, `${vehicleName(v.model)} contre ${fmt(price)} PC ? C'est définitif.`, label))) return;
        if (g.vehicles.current?.data?.id === v.id) g.vehicles.exit(true);
        if (await act(g, 'vehicle.sell', { vehicleId: v.id }, (r) => `💸 Vendu : +${fmt(r.gain)} PC`)) refresh();
      } }, `${fmt(price)} PC`)));
  }
}

// ------------------------------------------------------------------------------------ concession
export function dealerPanel(g, b, openNew) {
  g.ui.dialog({ name: 'Commercial·e', role: b.name, text: 'Bienvenue ! Vous voulez du neuf, ou on reprend votre vieille guimbarde ?', choices: [
    { label: '🚗 Voir les voitures neuves', action: (m) => { m.close(); openNew(); } },
    { label: '🔑 Essai gratuit (3 min)', action: (m) => { m.close(); testDrivePanel(g, b, b.shop); } },
    { label: '💸 Faire reprendre un véhicule', action: (m) => { m.close(); const mm = g.ui.modal({ title: '💸 Reprise', sub: 'Prix selon le modèle, le kilométrage et les bosses.', build: (body) => sellVehicles(g, body, () => mm.refresh()) }); } },
    { label: 'Au revoir', ghost: true, action: (m) => m.close() },
  ] });
}

// ------------------------------------------------------------------------------------ occasions
export function usedCarsPanel(g, b) {
  let tab = 'buy';
  const m = g.ui.modal({
    title: `🚙 ${b.name}`, sub: 'Les annonces changent chaque jour. Garanti sans vice caché (les vices sont bien visibles).',
    build: (body) => {
      body.append(tabs([['buy', 'Annonces du jour'], ['sell', 'Vendre mon véhicule']], tab, (k) => { tab = k; m.refresh(); }));
      if (tab === 'sell') { sellVehicles(g, body, () => m.refresh()); return; }
      const bought = new Set(g.profile.usedBought || []);
      for (const o of usedOffers(g.now())) {
        const s = VEHICLES[o.model];
        const sold = bought.has(o.id);
        body.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, vehicleIcon(o.model)),
          h('div.grow', h('div.t', `${s.name} `, h('span', { style: { display: 'inline-block', width: '11px', height: '11px', borderRadius: '50%', background: o.color, verticalAlign: 'middle' } })),
            h('div.d', `${fmt(o.km)} km · état ${Math.round((1 - o.damage) * 100)} % · ${kmh(o.model)} km/h · vendu par ${o.seller}`),
            h('div.d', `Neuve : ${fmt(s.price)} PC`)),
          h('button.btn.small', { disabled: sold, onclick: async () => {
            if (await act(g, 'vehicle.buyUsed', { offerId: o.id }, () => `🔑 ${s.name} achetée ! Elle t'attend garée devant l'agence (touche K pour la clé).`)) m.refresh();
          } }, sold ? 'Vendue' : `${fmt(o.price)} PC`)));
      }
    },
  });
}

// ------------------------------------------------------------------------------------ location
export function rentalPanel(g, b) {
  const m = g.ui.modal({
    title: `🔑 ${b.name}`, sub: 'Louez un véhicule pour quelques minutes. Il vous attend devant l\'agence. Rendu automatique à la fin du temps.',
    build: (body) => {
      const cur = g.profile.vehicles.find((v) => v.rentUntil);
      if (cur) {
        const left = Math.max(0, Math.round((cur.rentUntil - g.now()) / 1000));
        body.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, vehicleIcon(cur.model)),
          h('div.grow', h('div.t', `En location : ${vehicleName(cur.model)}`), h('div.d', `Encore ${Math.floor(left / 60)} min ${left % 60} s`)),
          h('button.btn.small.ghost', { onclick: async () => {
            if (g.vehicles.current?.data?.id === cur.id) g.vehicles.exit(true);
            if (await act(g, 'vehicle.return', { vehicleId: cur.id }, () => 'Véhicule rendu. Merci et à bientôt !')) m.refresh();
          } }, 'Rendre')));
      }
      for (const r of RENTALS) {
        const s = VEHICLES[r.model];
        body.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, vehicleIcon(r.model)),
          h('div.grow', h('div.t', s.name), h('div.d', `${kmh(r.model)} km/h · ${s.seats} places · ${r.per10} PC les 10 min`)),
          h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '200px' } }, RENTAL_DURATIONS.map((d) => h('button.btn.small', { disabled: !!cur, title: `${rentalPrice(r.model, d)} PC`, onclick: async () => {
            if (await act(g, 'vehicle.rent', { model: r.model, minutes: d }, (x) => `🔑 ${s.name} louée ${d} min (-${fmt(x.price)} PC). Elle t'attend devant l'agence !`)) m.refresh();
          } }, `${d} min`)))));
      }
    },
  });
}

// ------------------------------------------------------------------------------------ agence immobilière
const KIND_LABEL = { studio: 'Studio', appart: 'Appartement', maison: 'Maison', ferme: 'Ferme' };
export function homeLabel(id) { const x = HOUSING_BY_ID[id]; return x ? x.name : 'Studio'; }

export function immoPanel(g, b) {
  let tab = 'mine';
  const m = g.ui.modal({
    title: `🏡 ${b.name}`, sub: 'Louer (frais d\'agence : 2 h de loyer), acheter comptant, ou à crédit (apport 20 %, remboursé à chaque heure de jeu).',
    build: (body) => {
      const p = g.profile;
      const bills = hourlyBills(p);
      body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, '🏠'),
        h('div.grow', h('div.t', `Tu habites : ${homeLabel(p.home.place)}`), h('div.d', `Factures par heure de jeu : loyer ${bills.rent} + crédit ${bills.loans} + charges ${bills.charges} = ${bills.total} PC${p.debt > 0 ? ` · ⚠️ dette ${fmt(p.debt)} PC` : ''}`)),
        p.debt > 0 ? h('button.btn.small', { onclick: async () => { if (await act(g, 'bills.payDebt', {}, (r) => `Dette remboursée : -${fmt(r.paid)} PC`)) m.refresh(); } }, 'Payer ma dette') : null));
      body.append(tabs([['mine', 'Mes biens'], ['appart', 'Appartements'], ['maison', 'Maisons'], ['sea', 'Bord de mer'], ['ferme', 'Fermes']], tab, (k) => { tab = k; m.refresh(); }));
      if (tab === 'mine') { minePanel(g, body, () => m.refresh()); return; }
      const list = HOUSING.filter((x) => (tab === 'sea' ? x.sea : tab === 'maison' ? x.kind === 'maison' && !x.sea : x.kind === tab));
      for (const x of list) body.append(housingCard(g, x, () => m.refresh()));
    },
  });
}

function housingCard(g, x, refresh) {
  const p = g.profile;
  const mine = p.properties.find((q) => q.id === x.id);
  const deposit = Math.round(x.price * DEPOSIT_RATE);
  const area = Math.round(x.size.w * x.size.d);
  const bld = BUILDING_BY_ID[x.building];
  return h('div.list-item', h('span', { style: { fontSize: '24px' } }, x.kind === 'appart' ? '🏢' : x.sea ? '🏖️' : x.kind === 'ferme' ? '🚜' : '🏡'),
    h('div.grow', h('div.t', x.name), h('div.d', `${KIND_LABEL[x.kind]} · ${area} m² · ${x.district}`),
      h('div.d', `Prix : ${fmt(x.price)} PC · loyer : ${x.rent} PC/h · crédit : apport ${fmt(deposit)} PC puis ${loanHourly(x)} PC/h`)),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
      bld ? h('button.btn.small.ghost', { onclick: () => { g.ui.closeAll?.(); g.phone?.goTo({ x: bld.door.x, z: bld.door.z, name: x.name }); } }, '📍 Visiter') : null,
      mine ? h('span.pill', mine.how === 'rent' ? 'Loué' : 'À toi') : [
        h('button.btn.small', { onclick: async () => { if (await g.ui.confirm('Louer ?', `${x.name} : ${x.rent * 2} PC de frais d'agence, puis ${x.rent} PC par heure de jeu. Ta location actuelle sera rendue (tes meubles déménagent avec toi).`, 'Louer') && await act(g, 'home.rent', { id: x.id }, () => `🔑 Bienvenue chez toi : ${x.name} !`)) refresh(); } }, `Louer`),
        h('button.btn.small', { disabled: p.coins < x.price, onclick: async () => { if (await g.ui.confirm('Acheter comptant ?', `${x.name} pour ${fmt(x.price)} PC.`, 'Acheter') && await act(g, 'home.buy', { id: x.id }, () => `🏡 Félicitations, propriétaire de ${x.name} !`)) refresh(); } }, `Acheter`),
        h('button.btn.small.ghost', { disabled: p.coins < deposit, onclick: async () => { if (await g.ui.confirm('Acheter à crédit ?', `Apport : ${fmt(deposit)} PC. Reste à rembourser : ${fmt(Math.round((x.price - deposit) * (1 + LOAN_RATE)))} PC (intérêts compris), prélevés ${loanHourly(x)} PC par heure de jeu.`, 'Signer') && await act(g, 'home.buy', { id: x.id, loan: true }, () => `🏦 Crédit signé : ${x.name} est à toi !`)) refresh(); } }, 'Crédit'),
      ]));
}

function minePanel(g, body, refresh) {
  const p = g.profile;
  for (const pr of p.properties) {
    const x = HOUSING_BY_ID[pr.id];
    if (!x) continue;
    const here = p.home.place === pr.id;
    const value = sellValue(x) - (pr.loanLeft || 0);
    body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, here ? '🏠' : '🗝️'),
      h('div.grow', h('div.t', x.name), h('div.d', pr.how === 'rent' ? `Location · ${x.rent} PC/h` : pr.how === 'loan' ? `Crédit : reste ${fmt(pr.loanLeft)} PC (${loanHourly(x)} PC/h)` : 'Propriétaire'),
        h('div.d', here ? 'Tu habites ici.' : 'Tu n\'y habites pas.')),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        !here ? h('button.btn.small', { onclick: async () => { if (await act(g, 'home.moveIn', { id: pr.id }, () => `📦 Déménagement terminé : bienvenue à ${x.name} !`)) refresh(); } }, 'Emménager') : null,
        pr.how === 'loan' ? h('button.btn.small.ghost', { onclick: async () => { const a = Math.min(pr.loanLeft, p.coins); if (a > 0 && await act(g, 'home.repay', { id: pr.id, amount: a }, (r) => (r.left ? `Remboursé ${fmt(a)} PC, reste ${fmt(r.left)} PC.` : '🎉 Crédit entièrement remboursé !'))) refresh(); } }, 'Rembourser') : null,
        pr.id !== 'studio' || p.properties.length > 1 ? h('button.btn.small.ghost', { onclick: async () => {
          const txt = pr.how === 'rent' ? `Rendre ${x.name} ?${here ? ' Tu retourneras dans un autre de tes logements (ou au studio).' : ''}` : `Vendre ${x.name} pour ${fmt(sellValue(x))} PC${pr.loanLeft ? ` (moins ${fmt(pr.loanLeft)} PC de crédit restant)` : ''} ?`;
          if (await g.ui.confirm(pr.how === 'rent' ? 'Rendre les clés ?' : 'Vendre ?', txt, pr.how === 'rent' ? 'Rendre' : 'Vendre') && await act(g, 'home.leave', { id: pr.id }, (r) => (r.gain ? `💰 Vendu : ${r.gain > 0 ? '+' : ''}${fmt(r.gain)} PC` : 'Clés rendues.'))) refresh();
        } }, pr.how === 'rent' ? 'Rendre' : `Vendre (${fmt(value)})`) : null)));
  }
}

// ------------------------------------------------------------------------------------ dépôt-vente, brocante, fripes
export function secondHandPanel(g, b) {
  let tab = 'buy';
  const items = g.net.content.items;
  const m = g.ui.modal({
    title: `${b.shop === 'clothes-used' ? '🧥' : b.shop === 'depot' ? '♻️' : '🏺'} ${b.name}`, sub: 'Objets d\'occasion : le stock change chaque jour. On rachète aussi tes affaires.',
    build: (body) => {
      body.append(tabs([['buy', 'Stock du jour'], ['sell', 'Vendre mes affaires']], tab, (k) => { tab = k; m.refresh(); }));
      const p = g.profile;
      if (tab === 'sell') {
        const mine = Object.keys(p.inventory).filter((id) => p.inventory[id] > 0 && items[id] && secondHandBuys(b.shop, items[id]));
        if (!mine.length) { body.append(h('p.muted', 'Rien que cette boutique rachète dans ton sac.')); return; }
        for (const id of mine) {
          const it = items[id], gain = secondHandBuys(b.shop, it);
          body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, it.emoji), h('div.grow', h('div.t', it.name), h('div.d', `Tu en as ${p.inventory[id]} · neuf : ${fmt(it.price)} PC`)),
            h('button.btn.small', { onclick: async () => { if (await act(g, 'shop.sellUsed', { shop: b.shop, itemId: id }, (r) => `${it.emoji} Vendu : +${r.gain} PC`)) m.refresh(); } }, `Vendre ${gain} PC`)));
        }
        return;
      }
      const bought = new Set(p.usedBought || []);
      const offers = secondHandOffers(items, b.shop, g.now());
      if (!offers.length) body.append(h('p.muted', 'Rayons vides aujourd\'hui. Revenez demain !'));
      for (const o of offers) {
        const it = items[o.itemId];
        const sold = bought.has(o.id);
        body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, it.emoji), h('div.grow', h('div.t', it.name), h('div.d', `${o.state} · neuf : ${fmt(it.price)} PC`)),
          h('button.btn.small', { disabled: sold, onclick: async () => { if (await act(g, 'shop.buyUsed', { shop: b.shop, offerId: o.id }, () => `${it.emoji} ${it.name} d'occasion : à toi !`)) m.refresh(); } }, sold ? 'Vendu' : `${o.price} PC`)));
      }
    },
  });
}
export const isSecondHand = (shop) => !!SECOND_HAND[shop];

// ------------------------------------------------------------------------------------ casse
export function scrapPanel(g, b) {
  const m = g.ui.modal({ title: `🔩 ${b.name}`, sub: 'On rachète tout, même les épaves. Surtout les épaves. (Prix : 40 % de la cote.)', build: (body) => sellVehicles(g, body, () => m.refresh(), 0.4, 'Vendre à la casse') });
}

export { clear };
