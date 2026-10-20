// AUTORITÉ — PROPRIÉTÉ : véhicules (stationnement, clés, réparation, plein, revente, occasions,
// locations) et logements (louer, acheter comptant ou à crédit, emménager, vendre), factures horaires.
// Fonctions appelées avec `this` = l'Authority (voir authority.js).
import { BUILDING_BY_ID, BUILDINGS, GAS_STATIONS, inBounds, dist2d } from './world-layout.js';
import { VEHICLES } from './content/vehicles.js';
import { levelFromXp } from './rules.js';
import {
  FUEL_PRICE, TOW_FEE, REPAIR_SHOPS, SELL_SHOPS, repairCost, resaleValue, usedOffers, RENTALS, RENTAL_DURATIONS, rentalPrice,
  deliverySpot, HOUSING_BY_ID, DEPOSIT_RATE, LOAN_RATE, loanHourly, sellValue, hourlyBills, EVICT_DEBT, homeSize,
  secondHandOffers, secondHandBuys, localInBuilding, SAVINGS_RATE,
} from './property.js';
import { HOME_INTERIOR } from './world-layout.js';
import { applyNeeds, needsStatus } from './needs.js';
import { RECIPE_BY_ID, recipeEffect, canCook } from './recipes.js';
import { DEFAULT_APPEARANCE } from './appearance.js';

const err = (error) => ({ ok: false, error });
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const atShop = (self, ctx, shops) => BUILDINGS.some((b) => shops.includes(b.shop) && self.atBuilding(ctx, b, 2));
const shopBuilding = (shop) => BUILDINGS.find((b) => b.shop === shop);

// Locations expirées : le véhicule retourne à l'agence.
export function expireRentals(p, now) {
  const before = p.vehicles.length;
  p.vehicles = p.vehicles.filter((v) => !v.rentUntil || v.rentUntil > now);
  return p.vehicles.length !== before;
}

// Déplace les meubles hors des limites d'un nouveau logement (déménagement).
function fitFurniture(p) {
  const S = homeSize(p);
  const hx = S.w / 2 - 0.6, hz = S.d / 2 - 0.6;
  for (const f of p.home.furniture) { f.x = Math.max(-hx, Math.min(hx, f.x)); f.z = Math.max(-hz, Math.min(hz, f.z)); }
}

function moveIn(p, id) {
  const h = HOUSING_BY_ID[id];
  p.home.place = id;
  if (h.kind === 'studio') p.home.size = p.home.size === 'appart' ? 'appart' : 'studio';
  fitFurniture(p);
}

const propOf = (p, id) => p.properties.find((x) => x.id === id);

export const PROPERTY_HANDLERS = {
  // ---------------------------------------------------------------- véhicules
  // Stationnement : on retrouve son véhicule là où on l'a laissé (et on le verrouille).
  'vehicle.park'(ctx, { vehicleId, x, z, yaw, locked = true }) {
    const v = ctx.profile.vehicles.find((q) => q.id === vehicleId);
    if (!v) return err('Véhicule introuvable.');
    if (!num(x) || !num(z) || !num(yaw) || !inBounds(x, z)) return err('Position invalide.');
    if (ctx.pos && dist2d(ctx.pos.x, ctx.pos.z, x, z) > 14) return err('Trop loin du véhicule.');
    v.park = { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, yaw: Math.round(yaw * 1000) / 1000 };
    v.locked = !!locked;
    return { ok: true, changed: true, data: {} };
  },

  'vehicle.lock'(ctx, { vehicleId, locked }) {
    const v = ctx.profile.vehicles.find((q) => q.id === vehicleId);
    if (!v) return err('Véhicule introuvable.');
    v.locked = !!locked;
    return { ok: true, changed: true, data: { locked: v.locked } };
  },

  // Dépanneuse : le véhicule est amené près du joueur (payant).
  'vehicle.deliver'(ctx, { vehicleId }) {
    const p = ctx.profile, v = p.vehicles.find((q) => q.id === vehicleId);
    if (!v) return err('Véhicule introuvable.');
    if (p.coins < TOW_FEE) return err(`La dépanneuse coûte ${TOW_FEE} PC.`);
    this.addCoins(p, -TOW_FEE);
    v.park = null;
    return { ok: true, changed: true, data: { fee: TOW_FEE } };
  },

  // Réparation au garage (le véhicule doit être garé devant ou dedans).
  'vehicle.repair'(ctx, { vehicleId, x, z }) {
    const p = ctx.profile, v = p.vehicles.find((q) => q.id === vehicleId);
    if (!v) return err('Véhicule introuvable.');
    const shops = BUILDINGS.filter((b) => REPAIR_SHOPS.includes(b.shop));
    const b = shops.find((s) => this.atBuilding(ctx, s, 6));
    if (!b) return err('Il faut être dans un garage.');
    if (!num(x) || !num(z) || dist2d(x, z, b.x, b.z) > Math.max(b.w, b.d) / 2 + 16 || (ctx.pos && dist2d(ctx.pos.x, ctx.pos.z, x, z) > 18)) return err('Amène ton véhicule devant le garage.');
    const cost = repairCost(v.model, v.damage || 0);
    if (!cost) return err('Ton véhicule est déjà comme neuf !');
    if (p.coins < cost) return err(`La réparation coûte ${cost} PC.`);
    this.addCoins(p, -cost);
    v.damage = 0;
    return { ok: true, changed: true, data: { cost } };
  },

  // Plein d'essence à la pompe (litres demandés, plafonnés à la place dans le réservoir).
  'vehicle.refuel'(ctx, { vehicleId, liters, x, z }) {
    const p = ctx.profile, v = p.vehicles.find((q) => q.id === vehicleId);
    if (!v) return err('Véhicule introuvable.');
    const spec = VEHICLES[v.model];
    if (!spec?.fuel) return err('Ce véhicule roule à l\'huile de mollet !');
    if (!num(x) || !num(z)) return err('Position invalide.');
    const st = GAS_STATIONS.find((g) => Math.abs(x - g.x) < g.w / 2 + 5 && Math.abs(z - g.z) < g.d / 2 + 5);
    if (!st) return err('Il faut être à une pompe de station-service.');
    if (ctx.pos && dist2d(ctx.pos.x, ctx.pos.z, x, z) > 12) return err('Trop loin de la pompe.');
    const space = Math.max(0, spec.fuel - (v.fuel ?? spec.fuel));
    let l = Math.min(space, num(liters) ? Math.max(0, liters) : space);
    l = Math.min(l, Math.floor(p.coins / FUEL_PRICE));
    if (l < 0.5) return err(space < 0.5 ? 'Le réservoir est déjà plein.' : 'Pas assez de PlayCoins pour l\'essence.');
    l = Math.round(l * 10) / 10;
    const cost = Math.max(1, Math.round(l * FUEL_PRICE));
    this.addCoins(p, -cost);
    v.fuel = Math.round(((v.fuel ?? 0) + l) * 10) / 10;
    return { ok: true, changed: true, data: { liters: l, cost, station: st.name } };
  },

  // Revente à un concessionnaire / garage.
  'vehicle.sell'(ctx, { vehicleId }) {
    const p = ctx.profile, i = p.vehicles.findIndex((q) => q.id === vehicleId);
    if (i < 0) return err('Véhicule introuvable.');
    const v = p.vehicles[i];
    if (v.rentUntil) return err('Un véhicule de location ne se revend pas !');
    const scrap = !atShop(this, ctx, SELL_SHOPS) && atShop(this, ctx, ['scrapyard']);
    if (!scrap && !atShop(this, ctx, SELL_SHOPS)) return err('Il faut être chez un concessionnaire, chez Occaz\' du Siècle ou à la casse.');
    const gain = scrap ? Math.max(20, Math.round(resaleValue(v) * 0.4)) : resaleValue(v);
    p.vehicles.splice(i, 1);
    this.addCoins(p, gain);
    return { ok: true, changed: true, data: { gain } };
  },

  // Occasions du jour.
  'vehicle.buyUsed'(ctx, { offerId }) {
    const p = ctx.profile;
    const o = usedOffers(ctx.now).find((x) => x.id === offerId);
    if (!o) return err('Cette annonce n\'existe plus.');
    if (!atShop(this, ctx, ['cars-used'])) return err('Il faut être chez Occaz\' du Siècle.');
    p.usedBought ||= [];
    if (p.usedBought.includes(o.id)) return err('Tu l\'as déjà achetée !');
    const spec = VEHICLES[o.model];
    if (spec.level && levelFromXp(p.xp) < spec.level - 2) return err(`Niveau ${spec.level - 2} requis pour ce véhicule.`);
    if (p.vehicles.filter((v) => !v.rentUntil).length >= 8) return err('Ton garage est plein (8 véhicules).');
    if (p.coins < o.price) return err('Pas assez de PlayCoins.');
    this.addCoins(p, -o.price);
    p.usedBought.push(o.id);
    if (p.usedBought.length > 30) p.usedBought.shift();
    const b = shopBuilding('cars-used');
    const v = { id: ctx.newId(), model: o.model, color: o.color, damage: o.damage, fuel: Math.round(spec.fuel * 0.3), km: o.km, park: deliverySpot(b, p.vehicles.length), locked: true };
    p.vehicles.push(v);
    return { ok: true, changed: true, data: { vehicle: v } };
  },

  // Location Rapido : un véhicule pour quelques minutes réelles.
  'vehicle.rent'(ctx, { model, minutes }) {
    const p = ctx.profile;
    if (!RENTALS.some((r) => r.model === model) || !RENTAL_DURATIONS.includes(minutes)) return err('Location impossible.');
    if (!atShop(this, ctx, ['rental'])) return err('Il faut être à l\'agence Location Rapido.');
    if (p.vehicles.some((v) => v.rentUntil)) return err('Tu as déjà un véhicule en location. Rends-le d\'abord !');
    const price = rentalPrice(model, minutes);
    if (p.coins < price) return err('Pas assez de PlayCoins.');
    this.addCoins(p, -price);
    const b = shopBuilding('rental');
    const spec = VEHICLES[model];
    const v = { id: ctx.newId(), model, color: spec.paint || ['#f4f1ea', '#2b2d42', '#c0c0c8', '#1d3557'][Math.floor(ctx.rand() * 4)], damage: 0, fuel: spec.fuel, km: 0, rentUntil: ctx.now + minutes * 60_000, park: deliverySpot(b), locked: true };
    p.vehicles.push(v);
    return { ok: true, changed: true, data: { vehicle: v, price } };
  },

  'vehicle.return'(ctx, { vehicleId }) {
    const p = ctx.profile, i = p.vehicles.findIndex((q) => q.id === vehicleId && q.rentUntil);
    if (i < 0) return err('Location introuvable.');
    p.vehicles.splice(i, 1);
    return { ok: true, changed: true, data: {} };
  },

  // ---------------------------------------------------------------- objets d'occasion
  'shop.buyUsed'(ctx, { shop, offerId }) {
    const p = ctx.profile;
    const o = secondHandOffers(this.content.items, shop, ctx.now).find((x) => x.id === offerId);
    if (!o) return err('Cet article a déjà été vendu (ou n\'existe pas).');
    if (!atShop(this, ctx, [shop])) return err('Il faut être dans la boutique.');
    p.usedBought ||= [];
    if (p.usedBought.includes(o.id)) return err('Tu l\'as déjà acheté !');
    const it = this.content.items[o.itemId];
    if (it.slot && (p.inventory[it.id] || 0) >= 1) return err('Tu as déjà ce vêtement.');
    if ((p.inventory[it.id] || 0) >= (it.max ?? 20)) return err('Tu en as déjà assez !');
    if (p.coins < o.price) return err('Pas assez de PlayCoins.');
    this.addCoins(p, -o.price);
    p.usedBought.push(o.id);
    if (p.usedBought.length > 60) p.usedBought.shift();
    p.inventory[it.id] = (p.inventory[it.id] || 0) + 1;
    return { ok: true, changed: true, data: { itemId: it.id } };
  },

  // Dépôt-vente / fripes / brocante : rachètent tes objets un peu mieux que les boutiques neuves.
  'shop.sellUsed'(ctx, { shop, itemId }) {
    const p = ctx.profile, it = this.content.items[itemId];
    const gain = it ? secondHandBuys(shop, it) : 0;
    if (!gain) return err('Cette boutique ne rachète pas cet objet.');
    if (!atShop(this, ctx, [shop])) return err('Il faut être dans la boutique.');
    const have = p.inventory[itemId] || 0;
    const placed = p.home.furniture.filter((f) => f.i === itemId).length;
    if (have - placed <= 0) return err(placed ? 'Retire d\'abord ce meuble de ton logement.' : 'Tu ne possèdes pas cet objet.');
    p.inventory[itemId] = have - 1;
    for (const slot of ['hat', 'glasses', 'top', 'bottom', 'back']) if (p.appearance[slot] === itemId && p.inventory[itemId] === 0) p.appearance[slot] = DEFAULT_APPEARANCE[slot];
    this.addCoins(p, gain);
    return { ok: true, changed: true, data: { gain } };
  },

  // ---------------------------------------------------------------- logements
  'home.rent'(ctx, { id }) {
    const p = ctx.profile, h = HOUSING_BY_ID[id];
    if (!h) return err('Logement introuvable.');
    if (!atShop(this, ctx, ['immo'])) return err('Il faut passer à l\'agence immobilière.');
    if (propOf(p, id)) return err('Ce logement est déjà à toi.');
    const taken = h.kind !== 'studio' && ctx.housing?.owner(id, p.id);
    if (taken) return err(`Déjà occupé par ${taken}.`);
    const fee = h.rent * 2;
    if (p.coins < fee) return err(`Il faut ${fee} PC de frais d'agence (2 heures de loyer).`);
    this.addCoins(p, -fee);
    // on ne garde qu'une seule location à la fois : l'ancienne est rendue
    for (const old of p.properties.filter((x) => x.how === 'rent')) { p.properties.splice(p.properties.indexOf(old), 1); ctx.housing?.release(old.id, p.id); }
    p.properties.push({ id, how: 'rent', since: ctx.now });
    ctx.housing?.claim(id, p);
    moveIn(p, id);
    return { ok: true, changed: true, data: { fee } };
  },

  'home.buy'(ctx, { id, loan = false, move = true }) {
    const p = ctx.profile, h = HOUSING_BY_ID[id];
    if (!h) return err('Logement introuvable.');
    if (!atShop(this, ctx, ['immo'])) return err('Il faut passer à l\'agence immobilière.');
    const mine = propOf(p, id);
    if (mine && mine.how !== 'rent') return err('Il est déjà à toi !');
    const taken = h.kind !== 'studio' && ctx.housing?.owner(id, p.id);
    if (taken) return err(`Déjà occupé par ${taken}.`);
    if (p.properties.filter((x) => x.how !== 'rent').length >= 4) return err('Tu possèdes déjà 4 biens : le banquier fait une drôle de tête.');
    let pay = h.price, loanLeft = 0;
    if (loan) {
      if (levelFromXp(p.xp) < 3) return err('La banque prête à partir du niveau 3.');
      if (p.properties.some((x) => x.how === 'loan')) return err('Un seul crédit immobilier à la fois.');
      pay = Math.round(h.price * DEPOSIT_RATE);
      loanLeft = Math.round((h.price - pay) * (1 + LOAN_RATE));
    }
    if (p.coins < pay) return err(loan ? `Il faut un apport de ${pay.toLocaleString('fr-FR')} PC.` : 'Pas assez de PlayCoins.');
    this.addCoins(p, -pay);
    if (mine) p.properties.splice(p.properties.indexOf(mine), 1);
    p.properties.push({ id, how: loan ? 'loan' : 'own', since: ctx.now, paid: pay, ...(loan ? { loanLeft } : {}) });
    ctx.housing?.claim(id, p);
    if (move) moveIn(p, id);
    return { ok: true, changed: true, data: { paid: pay, loanLeft } };
  },

  'home.moveIn'(ctx, { id }) {
    const p = ctx.profile;
    if (!propOf(p, id)) return err('Ce logement n\'est pas à toi.');
    moveIn(p, id);
    return { ok: true, changed: true, data: {} };
  },

  // Rendre une location / vendre un bien. Si c'était le logement habité, retour au studio.
  'home.leave'(ctx, { id }) {
    const p = ctx.profile, pr = propOf(p, id), h = HOUSING_BY_ID[id];
    if (!pr || !h) return err('Ce logement n\'est pas à toi.');
    let gain = 0;
    if (pr.how !== 'rent') {
      if (!atShop(this, ctx, ['immo'])) return err('Pour vendre, passe à l\'agence immobilière.');
      gain = sellValue(h) - (pr.loanLeft || 0);
      if (gain < 0 && p.coins < -gain) return err('La vente ne couvre pas ton crédit : il te manque de l\'argent.');
      this.addCoins(p, gain);
    }
    p.properties.splice(p.properties.indexOf(pr), 1);
    ctx.housing?.release(id, p.id);
    if (p.home.place === id) {
      const other = p.properties[0];
      if (other) moveIn(p, other.id);
      else { p.properties.push({ id: 'studio', how: 'rent', since: ctx.now }); moveIn(p, 'studio'); }
    }
    return { ok: true, changed: true, data: { gain } };
  },

  // Rembourser son crédit plus vite.
  'home.repay'(ctx, { id, amount }) {
    const p = ctx.profile, pr = propOf(p, id);
    if (!pr || pr.how !== 'loan') return err('Aucun crédit sur ce logement.');
    const a = Math.min(pr.loanLeft, Math.floor(Math.max(0, num(amount) ? amount : 0)));
    if (a < 1) return err('Montant invalide.');
    if (p.coins < a) return err('Pas assez de PlayCoins.');
    this.addCoins(p, -a);
    pr.loanLeft -= a;
    if (pr.loanLeft <= 0) { pr.how = 'own'; delete pr.loanLeft; }
    return { ok: true, changed: true, data: { left: pr.loanLeft || 0 } };
  },

  // ---------------------------------------------------------------- vie à la maison
  // Cuisiner (cuisinière), se doucher (douche), dormir (lit) : il faut être chez soi, à côté du meuble.
  'home.use'(ctx, { what, recipe, quality }) {
    const p = ctx.profile;
    const need = { cook: 'cuisiniere', shower: 'douche', sleep: 'lit' }[what];
    if (!need) return err('Action inconnue.');
    // position locale dans le logement
    let local = null;
    if (ctx.zone === `home:${p.id}` && ctx.pos) local = { x: ctx.pos.x - HOME_INTERIOR.origin.x, z: ctx.pos.z - HOME_INTERIOR.origin.z };
    else {
      const h = HOUSING_BY_ID[p.home.place], b = h && BUILDING_BY_ID[h.building];
      if (b && ['maison', 'ferme'].includes(h.kind) && ctx.pos && Math.abs(ctx.pos.x - b.x) < b.w / 2 && Math.abs(ctx.pos.z - b.z) < b.d / 2) local = localInBuilding(b, ctx.pos.x, ctx.pos.z);
    }
    if (!local) return err('Il faut être chez toi.');
    const near = p.home.furniture.some((f) => f.i === need && Math.hypot(f.x - local.x, f.z - local.z) < 3.2);
    if (!near) return err({ cook: 'Il faut une cuisinière (Meubles Mous) et se mettre devant.', shower: 'Il faut une douche (Meubles Mous) et se mettre dedans.', sleep: 'Il faut un lit (Meubles Mous) et s\'en approcher.' }[what]);
    const cd = { cook: 15_000, shower: 30_000, sleep: 120_000 }[what];
    const key = `home:${what}`;
    const wait = (p.cooldowns[key] || 0) + cd - ctx.now;
    if (wait > 0) return err(`Encore ${Math.ceil(wait / 1000)} s.`);
    const data = {};
    if (what === 'cook') {
      const r = RECIPE_BY_ID[recipe];
      if (!r) return err('Recette inconnue.');
      if (!canCook(r, p.inventory)) return err('Il manque des ingrédients.');
      for (const [id, n] of Object.entries(r.needs)) p.inventory[id] -= n;
      const q = typeof quality === 'number' && Number.isFinite(quality) ? Math.max(0, Math.min(1, quality)) : 0.75;
      applyNeeds(p.needs, ctx.now, recipeEffect(r, q));
      p.stats.cooked = (p.stats.cooked || 0) + 1;
      data.recipe = r.id;
    } else if (what === 'shower') applyNeeds(p.needs, ctx.now, { hygiene: 100, humeur: 5 });
    else applyNeeds(p.needs, ctx.now, { energie: 70, humeur: 6, faim: -8 });
    p.cooldowns[key] = ctx.now;
    data.needs = needsStatus(p.needs, ctx.now);
    return { ok: true, changed: true, data };
  },

  // ---------------------------------------------------------------- factures (par minute de jeu)
  // Loyer, mensualités de crédit et charges, prélevés au prorata du temps joué (pas hors connexion).
  'bills.tick'(ctx) {
    const p = ctx.profile, b = p.bills;
    const mins = Math.min(3, Math.max(0, (ctx.now - (b.at || ctx.now)) / 60_000));
    b.at = ctx.now;
    if (mins <= 0) return { ok: true, changed: false, data: { due: 0 } };
    // intérêts du livret d'épargne
    if (p.savings > 0) p.savings = Math.round((p.savings + p.savings * SAVINGS_RATE * mins) * 100) / 100;
    const bills = hourlyBills(p);
    b.acc = (b.acc || 0) + bills.total * mins / 60;
    let due = Math.floor(b.acc);
    if (due < 1) return { ok: true, changed: true, data: { due: 0 } };
    b.acc -= due;
    // crédits : la part des mensualités réduit le capital restant
    for (const pr of p.properties) {
      if (pr.how !== 'loan') continue;
      const h = HOUSING_BY_ID[pr.id];
      const part = Math.min(pr.loanLeft, Math.round(loanHourly(h) * mins / 60));
      pr.loanLeft -= part;
      if (pr.loanLeft <= 0) { pr.how = 'own'; delete pr.loanLeft; }
    }
    const paid = Math.min(due, p.coins);
    this.addCoins(p, -paid);
    b.paid = (b.paid || 0) + paid;
    const data = { due, paid };
    if (paid < due) {
      p.debt = (p.debt || 0) + (due - paid);
      data.debt = p.debt;
      // expulsion d'une location trop impayée (le studio reste, la dette aussi)
      const rented = p.properties.find((x) => x.how === 'rent' && x.id !== 'studio');
      if (p.debt > EVICT_DEBT && rented) {
        p.properties.splice(p.properties.indexOf(rented), 1);
        ctx.housing?.release(rented.id, p.id);
        if (p.home.place === rented.id) { if (!propOf(p, 'studio')) p.properties.push({ id: 'studio', how: 'rent', since: ctx.now }); moveIn(p, 'studio'); }
        data.evicted = rented.id;
      }
    }
    return { ok: true, changed: true, data };
  },

  // Rembourser ses dettes.
  'bills.payDebt'(ctx) {
    const p = ctx.profile;
    if (!(p.debt > 0)) return err('Tu n\'as aucune dette. Bravo !');
    const a = Math.min(p.debt, p.coins);
    if (a < 1) return err('Pas assez de PlayCoins.');
    this.addCoins(p, -a);
    p.debt -= a;
    return { ok: true, changed: true, data: { paid: a, left: p.debt } };
  },
};

export { BUILDING_BY_ID };
