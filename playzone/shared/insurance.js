// ASSURANCE AUTO : chaque véhicule possédé peut être assuré (au tiers, tiers plus, tous risques).
// La prime se paie par semaine de jeu et dépend du prix du véhicule et du bonus-malus : chaque
// sinistre déclaré l'augmente, chaque semaine sans sinistre le baisse. L'assurance prend en charge
// une partie des réparations (moins une franchise) et la dépanneuse.
import { CYCLE_MS } from './clock.js';
import { VEHICLES } from './content/vehicles.js';

export const WEEK_MS = CYCLE_MS * 7;
export const PLANS = {
  tiers: { name: 'Au tiers', icon: '🛡️', desc: 'Le minimum légal : rouler sans assurance, c\'est une amende si la police te contrôle après un accident. Ne paie pas tes réparations.', cover: 0, tow: false, franchise: 0, rate: 0.0035, min: 25 },
  plus: { name: 'Tiers plus', icon: '🛡️🛡️', desc: 'Réparations remboursées à 50 % (franchise 50 PC) et dépanneuse gratuite.', cover: 0.5, tow: true, franchise: 50, rate: 0.007, min: 45 },
  tous: { name: 'Tous risques', icon: '🛡️🛡️🛡️', desc: 'Réparations remboursées à 90 % (franchise 100 PC), dépanneuse gratuite, véhicule coulé ou volé remis en état gratuitement.', cover: 0.9, tow: true, franchise: 100, rate: 0.012, min: 80 },
};
export const BONUS_MIN = 0.5, BONUS_MAX = 2.5;

const base = (model) => VEHICLES[model]?.price || 20000;
export function premium(model, plan, bonus = 1) {
  const P = PLANS[plan];
  if (!P) return 0;
  return Math.max(P.min, Math.round((base(model) * P.rate * bonus) / 5) * 5);
}
// Contrat actif sur ce véhicule ?
export const activeIns = (v, now) => (v?.ins && v.ins.until > now ? v.ins : null);
export const insurable = (model) => ['car', 'moto', 'scooter'].includes(VEHICLES[model]?.kind) && (VEHICLES[model]?.price || 0) > 0;

// Ce que le joueur paie réellement pour une réparation de `cost` PC.
export function insuredCost(v, cost, now) {
  const ins = activeIns(v, now), P = ins && PLANS[ins.plan];
  if (!P || !P.cover || cost <= 0) return { pay: cost, covered: 0, plan: ins?.plan || null };
  const pay = Math.min(cost, Math.max(P.franchise, Math.round(cost * (1 - P.cover))));
  return { pay, covered: cost - pay, plan: ins.plan };
}
export const towFree = (v, now) => !!PLANS[activeIns(v, now)?.plan]?.tow;
