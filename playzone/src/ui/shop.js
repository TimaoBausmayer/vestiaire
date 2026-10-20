import { h, clear, fmt } from './dom.js';
import { levelFromXp } from '../../shared/rules.js';
import { COLORS } from '../../shared/appearance.js';
import { VEHICLES } from '../../shared/content/vehicles.js';

// Boutiques physiques (on entre dedans et on va au comptoir) + garde-robe (accessible partout).
const SHOPS = {
  clothes: { title: 'Fringues & Frites', sub: 'Mode, accessoires et frites (les frites ne sont pas à vendre).', tabs: { hat: 'Chapeaux', glasses: 'Visage', top: 'Hauts', bottom: 'Bas', back: 'Dos' } },
  furniture: { title: 'Meubles Mous', sub: 'Tout pour un logement confortable (et un peu bizarre).', tabs: null },
  pets: { title: 'Animalerie Poil-Poil', sub: 'Adoptions responsables et croquettes douteuses.', tabs: { adopt: 'Adopter', care: 'Soins' } },
  vehicles: { title: 'Garage Roule-Toujours', sub: 'Véhicules garantis 3 jours (ou 3 virages).', tabs: null },
  'cars-new': { title: 'Concession Auto Paillettes', sub: 'Voitures neuves, brillantes, avec l\'odeur du neuf (en option).' },
  bikes: { title: 'Deux-Roues Express', sub: 'Vélos, motos et casques. Le vent dans les cheveux (sauf avec le casque).' },
  electronics: { title: 'Pixel & Câbles', sub: 'Électronique pour la maison. Câbles vendus séparément (et emmêlés).' },
  'pet-acc': { title: 'Croquette Center', sub: 'Tout pour gâter votre animal (il vous gâtera en poils sur le canapé).' },
  supermarket: { title: 'Hyper Bazar', sub: 'Remplis ton panier dans les rayons, paie à la caisse.' },
  superette: { title: 'Supérette du Coin', sub: 'Petite mais costaude.' },
  station: { title: 'Boutique de la station', sub: 'Snacks et boissons pour la route.' },
};
export const FOOD_SHOPS = new Set(['bakery', 'cafe', 'cafe2', 'paillote', 'burger', 'pizzeria', 'tacos', 'homard', 'poisson', 'supermarket', 'superette', 'farm', 'station', 'cinema']);
export const soldIn = (it, shopId) => it.available && (it.shop === shopId || (it.also || []).includes(shopId));

function priceTag(price) { return h('div.price', h('span.coin', { style: { width: '18px', height: '18px', fontSize: '8px', display: 'inline-grid', placeItems: 'center', borderRadius: '50%', background: '#ffd23f', color: '#7a4a00' } }, 'PC'), fmt(price)); }

export function openShop(game, shopId, building = null) {
  const conf = SHOPS[shopId] || { title: building?.name || 'Boutique', sub: FOOD_SHOPS.has(shopId) ? 'À consommer sur place ou à emporter. Vos jauges vous remercient.' : '' };
  const content = game.net.content;
  let tab = conf.tabs ? Object.keys(conf.tabs)[0] : null;
  let trying = null;
  const tabsEl = h('div.tabs');
  const m = game.ui.modal({
    title: conf.title, sub: conf.sub, tabs: conf.tabs ? tabsEl : null,
    build: (body) => build(body),
    onClose: () => { if (trying) game.refreshAvatar(); offProfile(); },
  });
  const offProfile = game.on('profile', () => m.refresh());

  function renderTabs() {
    if (!conf.tabs) return;
    clear(tabsEl);
    for (const [k, v] of Object.entries(conf.tabs)) tabsEl.append(h(`button.tab${tab === k ? '.active' : ''}`, { onclick: () => { tab = k; renderTabs(); m.refresh(); } }, v));
  }

  async function buy(it) {
    try {
      await game.net.request('shop.buy', { itemId: it.id });
      game.sfx('coin');
      game.ui.toast(`${it.emoji} ${it.name} : acheté !`, 'money');
      if (it.slot) {
        await game.net.request('avatar.update', { appearance: { ...game.profile.appearance, [it.slot]: it.id } });
        trying = null;
      }
      if (it.pet) game.ui.toast('Ton nouvel animal te suit ! Gère-le depuis l\'appli Animaux du téléphone.', 'good', 4500);
      if (it.vehicle) game.ui.toast('Véhicule acheté ! Il t\'attend garé devant la boutique (appli Garage : GPS). Touche K : clés.', 'good', 5000);
      if (it.furniture) game.ui.toast('Meuble livré chez toi : place-le depuis ton logement (bouton Déco).', 'good', 4500);
      return true;
    } catch (e) { game.sfx('error'); game.ui.toast(e.message, 'bad'); return false; }
  }

  async function eat(it) {
    try {
      const r = await game.net.request('food.eat', { itemId: it.id });
      game.eating?.play(it);
      game.emit('needs', r.needs);
      game.ui.toast(`${it.emoji} Miam ! 🍔 ${Math.round(r.needs.faim)} · ⚡ ${Math.round(r.needs.energie)} · 🙂 ${Math.round(r.needs.humeur)}`, 'good');
    } catch (e) { game.sfx('error'); game.ui.toast(e.message, 'bad'); }
  }

  async function sell(it) {
    if (!(await game.ui.confirm('Revendre ?', `Revendre « ${it.name} » pour ${Math.floor(it.price * 0.4)} PC ?`, 'Revendre'))) return;
    try { const r = await game.net.request('shop.sell', { itemId: it.id }); game.ui.toast(`Revendu : +${r.gain} PC`, 'money'); } catch (e) { game.ui.toast(e.message, 'bad'); }
  }

  function card(it) {
    const p = game.profile;
    const lv = levelFromXp(p.xp);
    const owned = p.inventory[it.id] || 0;
    const locked = (it.level && lv < it.level) || (it.rep && p.rep < it.rep);
    const ownedVehicle = it.vehicle && p.vehicles.some((v) => v.model === it.vehicle);
    const isOwned = it.slot ? owned > 0 : ownedVehicle || (it.special === 'home-upgrade' && p.home.size === 'appart');
    const c = h(`div.card${isOwned ? '.owned' : ''}${locked ? '.locked' : ''}`);
    if (it.seasonal) c.append(h('span.badge.season', 'Saison'));
    else if (isOwned) c.append(h('span.badge', 'Possédé'));
    else if (owned && !it.slot) c.append(h('span.badge', `x${owned}`));
    c.append(h('div.emoji', it.emoji), h('div.title', it.name), h('div.desc', it.desc));
    if (it.food) c.append(h('div.desc', { style: { color: '#7ae7c7' } }, `🍔 +${it.food.faim} · ⚡ ${it.food.energie >= 0 ? '+' : ''}${it.food.energie} · 🙂 ${it.food.humeur >= 0 ? '+' : ''}${it.food.humeur}${it.ingredient ? ' · à cuisiner' : ''}`));
    if (it.vehicle && VEHICLES[it.vehicle]) { const v = VEHICLES[it.vehicle]; c.append(h('div.desc', { style: { color: '#7ae7c7' } }, `${Math.round(v.max * 3.6)} km/h · ${v.seats} place${v.seats > 1 ? 's' : ''}${v.fuel ? ` · ${v.fuel} L` : ''}`)); }
    if (locked) c.append(h('div.desc', { style: { color: '#ffd23f' } }, `🔒 ${it.level ? `Niveau ${it.level}` : ''}${it.level && it.rep ? ' et ' : ''}${it.rep ? `${it.rep} réputation` : ''}`));
    c.append(priceTag(it.price));
    const row = h('div.row', { style: { flexWrap: 'wrap', gap: '6px' } });
    if (it.slot) {
      if (owned) {
        const worn = p.appearance[it.slot] === it.id;
        row.append(h('button.btn.small.teal', { onclick: () => game.net.request('avatar.update', { appearance: { ...p.appearance, [it.slot]: worn ? null : it.id } }).then(() => { trying = null; }) }, worn ? 'Retirer' : 'Porter'));
        row.append(h('button.btn.small.ghost', { onclick: () => sell(it) }, 'Revendre'));
      } else {
        row.append(h('button.btn.small', { disabled: locked || p.coins < it.price, onclick: () => buy(it) }, 'Acheter'));
        row.append(h('button.btn.small.ghost', { onclick: () => { trying = it.id; game.previewAppearance({ ...p.appearance, [it.slot]: it.id }); } }, 'Essayer'));
      }
    } else if (it.food) {
      row.append(h('button.btn.small', { disabled: p.coins < it.price, onclick: () => buy(it) }, 'Acheter'));
      if (!it.ingredient) row.append(h('button.btn.small.teal', { disabled: p.coins < it.price && !owned, onclick: async () => { if (owned || await buy(it)) eat(it); } }, owned ? `Manger (x${owned})` : 'Acheter et manger'));
    } else if (it.furniture) {
      row.append(h('button.btn.small', { disabled: locked || p.coins < it.price, onclick: () => buy(it) }, owned ? 'En racheter' : 'Acheter'));
      if (owned) row.append(h('button.btn.small.ghost', { onclick: () => sell(it) }, 'Revendre'));
    } else {
      row.append(h('button.btn.small', { disabled: locked || isOwned || p.coins < it.price, onclick: () => buy(it) }, isOwned ? 'Déjà à toi' : it.pet ? 'Adopter' : 'Acheter'));
    }
    c.append(row);
    return c;
  }

  function build(body) {
    renderTabs();
    const items = Object.values(content.items).filter((it) => soldIn(it, shopId));
    let list = items;
    if (shopId === 'clothes') list = items.filter((it) => it.slot === tab);
    if (shopId === 'pets') list = items.filter((it) => (tab === 'adopt' ? it.pet : !it.pet));
    const p = game.profile;
    if (shopId === 'pets' && tab === 'adopt') body.append(h('p.muted', `Tu as ${p.pets.length}/3 animaux. Chaque animal a besoin de croquettes, de câlins et d'un peu de dressage.`));
    if (shopId === 'pets' && tab === 'care') body.append(h('p.muted', `Dans ton sac : ${p.inventory.croquettes || 0} croquettes, ${p.inventory.friandise || 0} friandises.`));
    if (shopId === 'vehicles') body.append(h('p.muted', `Peintures en stock : ${p.inventory.peinture || 0}. Repeins tes véhicules depuis l'appli Garage du téléphone.`));
    body.append(h('div.grid', list.map(card)));
  }
}

// PANIER DU SUPERMARCHÉ : on choisit des articles dans les rayons, on paie à la caisse.
export class Basket {
  constructor(game) { this.game = game; this.items = new Map(); this.shop = null; }
  get count() { let n = 0; for (const k of this.items.values()) n += k; return n; }
  total() { const it = this.game.net.content.items; let t = 0; for (const [id, k] of this.items) t += (it[id]?.price || 0) * k; return t; }
  add(id, d, shop) { if (shop && this.shop && shop !== this.shop) this.items.clear(); this.shop = shop || this.shop; const k = Math.max(0, Math.min(20, (this.items.get(id) || 0) + d)); if (k) this.items.set(id, k); else this.items.delete(id); this.game.hud.track('basket', this.count ? { title: `🧺 Panier · ${this.count} article${this.count > 1 ? 's' : ''}`, text: `Total : ${fmt(this.total())} PC — passe en caisse pour payer.` } : null); }
  async checkout(b) {
    const g = this.game;
    if (!this.count) { g.ui.toast('Ton panier est vide. Va dans les rayons !', 'bad'); return; }
    try {
      const r = await g.net.request('shop.buyMany', { items: [...this.items].map(([id, n]) => ({ id, n })) });
      g.sfx('coin');
      g.ui.toast(`💳 Payé ${fmt(r.total)} PC. Les articles sont dans ton sac (téléphone > Sac).`, 'money', 4500);
      this.items.clear();
      g.hud.track('basket', null);
    } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad'); }
    void b;
  }
}

export function openBasket(game, b) {
  const items = Object.values(game.net.content.items).filter((it) => soldIn(it, b.shop) && it.consumable);
  game.basket ||= new Basket(game);
  const m = game.ui.modal({
    title: `🧺 ${b.name} — rayons`, sub: 'Ajoute des articles au panier, puis passe en caisse.',
    build: (body) => {
      const bk = game.basket;
      body.append(h('p.muted', `Panier : ${bk.count} article(s) · ${fmt(bk.total())} PC · Tu as ${fmt(game.profile.coins)} PC`));
      body.append(h('div.grid', items.map((it) => {
        const k = bk.items.get(it.id) || 0;
        return h('div.card', h('div.emoji', it.emoji), h('div.title', it.name), h('div.desc', it.desc), priceTag(it.price),
          h('div.row', { style: { gap: '6px', alignItems: 'center' } },
            h('button.btn.small.ghost', { disabled: !k, onclick: () => { bk.add(it.id, -1, b.shop); m.refresh(); } }, '−'),
            h('span', { style: { minWidth: '22px', textAlign: 'center', fontWeight: 800 } }, String(k)),
            h('button.btn.small', { onclick: () => { bk.add(it.id, 1, b.shop); game.sfx('click'); m.refresh(); } }, '+')));
      })));
    },
  });
}

// Garde-robe : changer de tenue n'importe où avec les objets possédés.
export function openWardrobe(game) {
  const items = game.net.content.items;
  const slots = { hat: 'Chapeau', glasses: 'Visage', top: 'Haut', bottom: 'Bas', back: 'Dos' };
  const m = game.ui.modal({
    title: 'Garde-robe', sub: 'Tes vêtements et accessoires.',
    build: (body) => {
      const prof = game.profile;
      for (const [slot, label] of Object.entries(slots)) {
        const owned = Object.keys(prof.inventory).filter((id) => prof.inventory[id] > 0 && items[id]?.slot === slot);
        const base = slot === 'top' ? ['tshirt', 'sweat', 'debardeur'] : slot === 'bottom' ? ['jean', 'short'] : [null];
        const choices = [...base, ...owned];
        const name = (id) => (id === null ? 'Aucun' : items[id]?.name || { tshirt: 'T-shirt', sweat: 'Sweat', debardeur: 'Débardeur', jean: 'Pantalon', short: 'Short' }[id] || id);
        body.append(h('div.field', h('label', label), h('div.opt-row', choices.map((id) => h(`button.opt${prof.appearance[slot] === id ? '.sel' : ''}`, {
          onclick: () => game.net.request('avatar.update', { appearance: { ...game.profile.appearance, [slot]: id } }).then(() => m.refresh()),
        }, `${items[id]?.emoji || ''} ${name(id)}`)))));
      }
      const colorRow = (key, label) => h('div.field', h('label', label), h('div.swatches', COLORS.map((c) => h(`button.swatch${prof.appearance[key] === c ? '.sel' : ''}`, {
        style: { background: c }, onclick: () => game.net.request('avatar.update', { appearance: { ...game.profile.appearance, [key]: c } }).then(() => m.refresh()),
      }))));
      body.append(colorRow('topColor', 'Couleur du haut'), colorRow('bottomColor', 'Couleur du bas'), colorRow('shoes', 'Chaussures'));
      body.append(h('button.btn.ghost', { onclick: () => { m.close(); game.editLook(); } }, '✂️ Changer coiffure, visage, silhouette...'));
    },
  });
}
