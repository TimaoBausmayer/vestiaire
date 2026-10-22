// PROPRIÉTÉ : logements (location, achat comptant ou à crédit), véhicules d'occasion, locations de
// véhicules, réparations, carburant, factures. Règles pures partagées client / serveur (l'autorité
// valide tout, le client s'en sert pour afficher les mêmes prix).
import { BUILDINGS, BUILDING_BY_ID, facingVector } from './world-layout.js';
import { VEHICLES, CAR_PAINTS } from './content/vehicles.js';
import { mulberry32, hashString } from './rng.js';
import { todayKey } from './rules.js';

// ------------------------------------------------------------------------------------ véhicules
export const FUEL_PRICE = 2;          // PC par litre
export const TOW_FEE = 150;           // dépanneuse : amène ton véhicule jusqu'à toi
export const REPAIR_SHOPS = ['repair', 'vehicles'];
export const SELL_SHOPS = ['cars-new', 'cars-used', 'vehicles', 'bikes'];

const round5 = (n) => Math.round(n / 5) * 5;
export const vehicleBase = (model) => VEHICLES[model]?.price || 3000;
export const repairCost = (model, damage) => (damage <= 0.005 ? 0 : Math.max(25, round5(vehicleBase(model) * 0.16 * damage)));
// Valeur de revente : moitié du prix de base, moins l'usure (kilométrage) et les dégâts.
export function resaleValue(v) {
  const km = v.km || 0;
  const wear = Math.max(0.35, 1 - km / 300_000);
  return Math.max(20, Math.round((vehicleBase(v.model) * 0.5 * wear * (1 - 0.6 * (v.damage || 0))) / 10) * 10);
}

// Voitures d'occasion du jour (même liste pour tout le monde, renouvelée chaque jour).
const USED_MODELS = Object.keys(VEHICLES).filter((m) => VEHICLES[m].price > 0 && ['car', 'moto', 'scooter'].includes(VEHICLES[m].kind));
export function usedOffers(now) {
  const day = todayKey(now);
  const r = mulberry32(hashString(`occaz-${day}`));
  const out = [];
  for (let i = 0; i < 7; i++) {
    const model = USED_MODELS[Math.floor(r() * USED_MODELS.length)];
    const km = Math.round((15 + r() * 170) * 1000 / 500) * 500;
    const damage = Math.round(r() * r() * 0.4 * 100) / 100;
    const color = CAR_PAINTS[Math.floor(r() * CAR_PAINTS.length)];
    const quality = Math.max(0.3, 1 - km / 260_000) * (1 - 0.35 * damage);
    const price = Math.max(150, Math.round((vehicleBase(model) * (0.38 + 0.4 * quality)) / 10) * 10);
    const seller = ['Gérard', 'Mamie Turbo', 'Kévin', 'Josiane', 'un garagiste louche', 'un pilote retraité', 'la cousine du maire'][Math.floor(r() * 7)];
    out.push({ id: `${day}-${i}`, model, km, damage, color, price, seller });
  }
  return out;
}

// Location Rapido : prix par tranche de 10 minutes réelles.
export const RENTALS = [
  { model: 'citadine', per10: 60 }, { model: 'berline', per10: 90 }, { model: 'suv', per10: 140 },
  { model: 'fourgon', per10: 110 }, { model: 'moto', per10: 120 }, { model: 'coupe', per10: 280 }, { model: 'sportive', per10: 450 },
];
export const RENTAL_DURATIONS = [10, 20, 30, 60];
export const rentalPrice = (model, minutes) => (RENTALS.find((r) => r.model === model)?.per10 || 0) * Math.ceil(minutes / 10);

// Point de livraison devant un bâtiment (sur la chaussée, le long de la façade).
export function deliverySpot(b, k = 0) {
  const [fx, fz] = facingVector(b.facing);
  const half = (fx !== 0 ? b.w : b.d) / 2;
  const along = (k % 3 - 1) * 5.5;
  return { x: b.x + fx * (half + 6.5) + -fz * along, z: b.z + fz * (half + 6.5) + fx * along, yaw: Math.atan2(-fz, fx) };
}

// ------------------------------------------------------------------------------------ logements
// Studio de départ (Résidence Les Mouettes), appartements (Résidences des Tilleuls, par l'ascenseur),
// maisons (on y entre vraiment, on y pose ses meubles). Loyer : PC par heure de jeu.
export const HOME_SIZES = { studio: { w: 14, d: 10 }, appart: { w: 20, d: 14 } };

function houseSize(b) {
  const W = b.facing === 'N' || b.facing === 'S' ? b.w : b.d;
  const D = b.facing === 'N' || b.facing === 'S' ? b.d : b.w;
  return { w: W - 1.2, d: D - 1.2 };
}

export const HOUSING = [];
HOUSING.push({ id: 'studio', name: 'Studio — Résidence Les Mouettes', kind: 'studio', building: 'residence', price: 90_000, rent: 40, size: HOME_SIZES.studio, district: 'Les Mouettes' });
for (const b of BUILDINGS) {
  if (b.interior === 'lobby' && /^immeuble/.test(b.id)) {
    for (let f = 2; f <= 4; f++) {
      HOUSING.push({ id: `${b.id}-${f}`, name: `Appartement ${f}e étage — ${b.name}`, kind: 'appart', building: b.id, floor: f, price: 150_000 + (f - 2) * 5_000, rent: 100 + (f - 2) * 5, size: HOME_SIZES.appart, district: 'Les Tilleuls' });
    }
  }
}
for (const b of BUILDINGS) {
  if (b.kind !== 'house' || !b.interior) continue;
  const r = mulberry32(hashString(b.id));
  const sea = /^maison\d/.test(b.id) || /^villa-mer/.test(b.id);
  const farm = b.district === 'campagne' || b.district === 'vignobles';
  const villa = b.district === 'villas';
  const base = /^villa-mer/.test(b.id) ? 1_800_000 : villa ? 1_150_000 : b.district === 'vignobles' ? 620_000 : b.district === 'hauts' ? 340_000 : sea ? 480_000 : farm ? 260_000 : 300_000;
  const price = Math.round((base * (0.95 + r() * 0.1)) / 1000) * 1000;
  HOUSING.push({
    id: b.id, name: `${villa ? 'Villa' : farm ? (b.district === 'vignobles' ? 'Domaine viticole' : 'Ferme') : 'Maison'} — ${b.name}${sea ? ' (bord de mer)' : ''}`, kind: villa ? 'villa' : farm ? 'ferme' : 'maison', building: b.id, sea,
    price, rent: Math.round(price / 1500), size: houseSize(b), district: { villas: 'Côte des Villas', hauts: 'Les Hauts de PLAYZONE', vignobles: 'Vignobles du Pinard', campagne: 'Campagne' }[b.district] || (sea ? 'Les Mouettes (bord de mer)' : 'Les Tilleuls'),
  });
}
export const HOUSING_BY_ID = Object.fromEntries(HOUSING.map((x) => [x.id, x]));
export const housingOf = (b) => HOUSING.find((x) => x.building === b?.id && x.kind !== 'appart' && x.kind !== 'studio');

export const DEPOSIT_RATE = 0.2;   // apport pour un crédit
export const LOAN_RATE = 0.1;      // intérêts totaux du crédit
export const loanHourly = (h) => Math.round(h.rent * 1.6);
export const sellValue = (h) => Math.round(h.price * 0.85);
export const CHARGES = 12;         // électricité, eau, internet : PC par heure de jeu
export const EVICT_DEBT = 2500;    // dette de loyer au-delà de laquelle on est expulsé (sauf studio)

// Facture horaire actuelle d'un profil (loyer du logement habité + crédits + charges).
export function hourlyBills(p) {
  let rent = 0, loans = 0;
  for (const pr of p.properties || []) {
    const h = HOUSING_BY_ID[pr.id];
    if (!h) continue;
    if (pr.how === 'rent') rent += h.rent;
    if (pr.how === 'loan') loans += loanHourly(h);
  }
  return { rent, loans, charges: CHARGES, total: rent + loans + CHARGES };
}

export function homeSize(p) {
  const place = p.home?.place || 'studio';
  if (place === 'studio') return p.home?.size === 'appart' ? HOME_SIZES.appart : HOME_SIZES.studio;
  return HOUSING_BY_ID[place]?.size || HOME_SIZES.studio;
}
export { BUILDING_BY_ID };

// ------------------------------------------------------------------------------------ occasions (objets)
// Brocantes, fripes, dépôt-vente : un stock du jour (déterministe), moins cher que le neuf.
export const SECOND_HAND = {
  'furniture-used': { kinds: ['furniture'], buys: 0.45 },
  brocante: { kinds: ['furniture', 'misc'], buys: 0.45 },
  'clothes-used': { kinds: ['clothes'], buys: 0.45 },
  depot: { kinds: ['furniture', 'clothes', 'misc'], buys: 0.5 },
};
const STATES = [['Comme neuf', 0.72], ['Bon état', 0.6], ['Un peu usé', 0.5], ['Vintage (rayé)', 0.42]];
const kindOf = (it) => (it.furniture ? 'furniture' : it.slot ? 'clothes' : 'misc');
export const resellable = (it) => !!it && it.price > 0 && !it.consumable && !it.pet && !it.vehicle && !it.special;
export function secondHandOffers(items, shop, now) {
  const conf = SECOND_HAND[shop];
  if (!conf) return [];
  const pool = Object.values(items).filter((it) => resellable(it) && it.available && it.shop && conf.kinds.includes(kindOf(it))).sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!pool.length) return [];
  const day = todayKey(now);
  const r = mulberry32(hashString(`${shop}-${day}`));
  const out = [], used = new Set();
  for (let i = 0; i < 9 && used.size < pool.length; i++) {
    let it;
    do it = pool[Math.floor(r() * pool.length)]; while (used.has(it.id));
    used.add(it.id);
    const [state, k] = STATES[Math.floor(r() * STATES.length)];
    out.push({ id: `${shop}-${day}-${i}`, itemId: it.id, state, price: Math.max(5, Math.round(it.price * k)) });
  }
  return out;
}
export const secondHandBuys = (shop, it) => (SECOND_HAND[shop]?.kinds.includes(kindOf(it)) && resellable(it) ? Math.floor(it.price * SECOND_HAND[shop].buys) : 0);

// Coordonnées locales d'un point dans un bâtiment (x le long de la façade, z vers la porte).
const ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
export function localInBuilding(b, x, z) {
  const th = ROT[b.facing] || 0, c = Math.cos(th), s = Math.sin(th), dx = x - b.x, dz = z - b.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

// ------------------------------------------------------------------------------------ banque, liquide
// Distributeurs de billets contre la façade de quelques bâtiments (retrait / dépôt d'espèces).
const ATM_AT = ['banque', 'hyper', 'superette', 'cinema', 'tour', 'mairie', 'station-lumiere', 'station-pompe', 'station-navets', 'pizzeria', 'homard', 'bowling', 'hopital'];
export const ATMS = ATM_AT.map((id) => BUILDING_BY_ID[id]).filter(Boolean).map((b) => {
  const [fx, fz] = facingVector(b.facing);
  const half = (fx !== 0 ? b.w : b.d) / 2, side = Math.min(3.4, (fx !== 0 ? b.d : b.w) / 2 - 0.9);
  return { id: `atm-${b.id}`, name: `Distributeur — ${b.name}`, x: b.x + fx * (half + 0.35) - fz * side, z: b.z + fz * (half + 0.35) + fx * side, ry: Math.atan2(fx, fz) };
});
export const WITHDRAW_MAX = 2000;
export const SAVINGS_RATE = 0.02 / 240;   // livret : 2 % par journée de jeu (4 h réelles), par minute jouée
