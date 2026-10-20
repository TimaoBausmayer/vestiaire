// ENTREPRISES, MARQUES ET BOURSE (règles pures, partagées client / serveur).
// - Une entreprise tourne pendant que son patron joue (pas hors connexion) : clients, chiffre
//   d'affaires, salaires, loyer, publicité. Trésorerie trop négative = faillite.
// - Bourse : cours déterministes (même cours pour tout le monde, à la même heure), mais difficiles à
//   prévoir : plusieurs cycles superposés + annonces (« news ») qui font bouger un titre pendant un moment.
import { mulberry32, hashString } from './rng.js';
import { BASE_TOPS } from './appearance.js';

export const SECTORS = {
  restaurant: { name: 'Restaurant', emoji: '🍽️', demand: 1.0, ticket: 22, margin: 0.55, wage: 90, rent: 140 },
  boutique: { name: 'Boutique', emoji: '🛍️', demand: 0.9, ticket: 30, margin: 0.45, wage: 85, rent: 130 },
  mode: { name: 'Marque de vêtements', emoji: '👕', demand: 0.75, ticket: 45, margin: 0.5, wage: 95, rent: 120 },
  tech: { name: 'Start-up tech', emoji: '💻', demand: 0.6, ticket: 90, margin: 0.7, wage: 170, rent: 180 },
  transport: { name: 'Transport & livraison', emoji: '🚚', demand: 1.1, ticket: 18, margin: 0.4, wage: 100, rent: 100 },
};
export const COMPANY_MIN_CAPITAL = 5000;
export const COMPANY_FEE = 500;            // frais d'immatriculation (mairie)
export const BANKRUPT_AT = -3000;          // trésorerie en dessous : faillite
export const MAX_STAFF = 25;
export const SHARES = 1000;                // nombre d'actions d'une entreprise
export const MAX_FLOAT = 490;              // actions vendables aux investisseurs (49 %)
export const upgradeCost = (q) => 2500 * (q + 1) * (q + 1);
export const marketingCost = (lvl) => lvl * 70;      // par heure de jeu

// Vague de demande du secteur (déterministe) : 0,75 à 1,25.
export function sectorWave(sector, t) {
  const r = mulberry32(hashString(`sector-${sector}`));
  const p1 = (2 + r() * 3) * 3600_000, p2 = (30 + r() * 50) * 60_000, ph = r() * 6.28;
  return 1 + 0.17 * Math.sin((2 * Math.PI * t) / p1 + ph) + 0.08 * Math.sin((2 * Math.PI * t) / p2 + ph * 2);
}

// Résultat d'une heure de jeu (10 min réelles) pour l'entreprise c.
export function companyHour(c, t) {
  const s = SECTORS[c.sector];
  const capacity = 15 + c.staff * 30;
  const hype = c.sector === 'mode' ? Math.min(0.6, (c.collections?.length || 0) * 0.1) : 0;
  const appeal = s.demand * (0.6 + 0.18 * c.quality + 0.22 * c.marketing + Math.max(-0.4, Math.min(0.6, c.rep / 150)) + hype) * sectorWave(c.sector, t);
  const clients = Math.max(0, Math.min(capacity, 32 * appeal));
  const revenue = clients * s.ticket * (1 + 0.25 * c.quality);
  const costs = c.staff * s.wage + s.rent + marketingCost(c.marketing);
  return { clients: Math.round(clients), revenue: Math.round(revenue), gross: Math.round(revenue * s.margin), costs: Math.round(costs), profit: Math.round(revenue * s.margin - costs) };
}

// Valeur de l'entreprise : trésorerie + 30 heures de bénéfice + investissements (qualité).
export function companyValue(c, t) {
  if (c.bankrupt) return 0;
  const h = companyHour(c, t);
  let qv = 0; for (let q = 0; q < c.quality; q++) qv += upgradeCost(q) * 0.6;
  return Math.max(0, Math.round(c.cash + Math.max(0, h.profit) * 30 + qv + c.staff * 150));
}
export const sharePrice = (c, t) => Math.max(1, Math.round((companyValue(c, t) / SHARES) * 100) / 100);

// ------------------------------------------------------------------------------------ bourse
export const STOCKS = [
  { sym: 'PLAY', name: 'PlayCorp', base: 120, vol: 0.2 },
  { sym: 'MAMA', name: 'Pizzas Mamma Mia-ou', base: 45, vol: 0.14 },
  { sym: 'PAIL', name: 'Auto Paillettes', base: 210, vol: 0.22 },
  { sym: 'CROQ', name: 'Croquette Center', base: 30, vol: 0.1 },
  { sym: 'PIGE', name: 'Pigeon Airlines', base: 75, vol: 0.32 },
  { sym: 'BANA', name: 'Banane Énergie', base: 18, vol: 0.38 },
  { sym: 'HYPR', name: 'Hyper Bazar', base: 95, vol: 0.08 },
  { sym: 'TACO', name: 'Tacos Tornade', base: 12, vol: 0.45 },
];
export const STOCK_BY_SYM = Object.fromEntries(STOCKS.map((s) => [s.sym, s]));
export const STOCK_FEE = 0.005;
const DAY = 4 * 3600_000; // journée de jeu
const NEWS_GOOD = ['annonce des résultats records', 'signe un contrat géant avec la mairie', 'lance un produit qui plaît à tout le monde', 'est recommandée par Mamie Turbo', 'rachète un concurrent'];
const NEWS_BAD = ['est accusée d\'avoir trop de pigeons dans ses bureaux', 'rate son lancement de produit', 'perd un procès contre un canard', 'voit son patron partir en vacances... pour toujours', 'subit une panne géante'];

// Annonces d'une journée de jeu (une par titre, à une heure tirée au sort, effet sur ~45 min).
function dayNews(day) {
  const r = mulberry32(hashString(`news-${day}`));
  return STOCKS.map((s) => {
    const good = r() < 0.5, mag = (0.05 + r() * 0.12) * (good ? 1 : -1);
    const at = day * DAY + Math.floor(r() * DAY);
    const list = good ? NEWS_GOOD : NEWS_BAD;
    return { sym: s.sym, at, mag, text: `${s.name} ${list[Math.floor(r() * list.length)]}` };
  });
}
function shockAt(sym, t) {
  const d = Math.floor(t / DAY);
  let k = 0;
  for (const day of [d - 1, d]) for (const n of dayNews(day)) {
    if (n.sym !== sym || t < n.at) continue;
    const age = (t - n.at) / 60_000;
    k += n.mag * (age < 3 ? age / 3 : Math.exp(-(age - 3) / 45));
  }
  return k;
}
export function stockPrice(sym, t) {
  const s = STOCK_BY_SYM[sym];
  if (!s) return 0;
  const r = mulberry32(hashString(`stock-${sym}`));
  const P = [(3 + r() * 4) * 3600_000, (60 + r() * 60) * 60_000, (15 + r() * 15) * 60_000];
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const w = 0.6 * Math.sin((2 * Math.PI * t) / P[0] + ph[0]) + 0.3 * Math.sin((2 * Math.PI * t) / P[1] + ph[1]) + 0.15 * Math.sin((2 * Math.PI * t) / P[2] + ph[2]);
  const trend = 0.08 * Math.sin((2 * Math.PI * t) / (7 * DAY) + ph[0] * 2);
  return Math.round(s.base * Math.exp(s.vol * w + trend + shockAt(sym, t)) * 100) / 100;
}
// Fil d'actualité : annonces passées (24 h de jeu) + rumeurs des 10 prochaines minutes.
export function marketNews(t) {
  const d = Math.floor(t / DAY);
  const all = [...dayNews(d - 1), ...dayNews(d)];
  const past = all.filter((n) => n.at <= t && t - n.at < DAY).sort((a, b) => b.at - a.at);
  const soon = all.filter((n) => n.at > t && n.at - t < 10 * 60_000).map((n) => ({ ...n, rumor: true, text: `Rumeur : ${STOCK_BY_SYM[n.sym].name} préparerait une annonce ${n.mag > 0 ? 'positive' : 'inquiétante'}...` }));
  return [...soon, ...past];
}

// ------------------------------------------------------------------------------------ marque de vêtements
export const BRAND_STYLES = BASE_TOPS;
export const BRAND_COST = 800;   // création d'une collection (prototype + atelier)
