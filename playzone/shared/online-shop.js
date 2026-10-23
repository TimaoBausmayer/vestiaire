// ACHATS EN LIGNE (« PlayAzon ») : presque tout ce qui se vend en boutique se commande depuis le
// téléphone, payé par carte (PlayCoins). Plus la livraison est rapide, plus elle coûte cher.
// Les délais sont en temps de jeu (1 jour de jeu = 4 heures réelles ; dormir les raccourcit).
import { CYCLE_MS, HOUR_MS } from './clock.js';

export const DELIVERY = {
  express: { name: 'Ultra express (drone, tout de suite)', icon: '🚁', delay: 0, rate: 0.5, min: 150 },
  h6: { name: 'Coursier dans 6 heures', icon: '🛵', delay: 6 * HOUR_MS, rate: 0.3, min: 60 },
  j1: { name: 'Livraison en 1 jour', icon: '🚚', delay: CYCLE_MS, rate: 0.15, min: 30 },
  j2: { name: 'Livraison en 2 jours', icon: '📦', delay: 2 * CYCLE_MS, rate: 0.06, min: 10 },
  eco: { name: 'Économique (4 jours, gratuite)', icon: '🐌', delay: 4 * CYCLE_MS, rate: 0, min: 0 },
};
export const deliveryFee = (price, opt) => (DELIVERY[opt] ? Math.max(DELIVERY[opt].min, Math.round(price * DELIVERY[opt].rate)) : null);
export const MAX_ORDERS = 20;

// Ce qui ne s'achète pas en ligne : animaux (il faut les rencontrer), services sur place, location.
export function orderable(it) {
  return !!(it && it.available && it.shop && !it.pet && !it.special?.startsWith?.('home') && it.price > 0);
}
// Temps restant avant livraison, en texte (heures de jeu).
export function etaText(ms) {
  if (ms <= 0) return 'arrive maintenant';
  const hours = ms / HOUR_MS;
  if (hours < 1) return 'dans moins d\'une heure';
  if (hours < 24) return `dans ${Math.ceil(hours)} h`;
  const d = Math.floor(hours / 24), hr = Math.round(hours - d * 24);
  return `dans ${d} j${hr ? ` ${hr} h` : ''}`;
}
