// BOUTIQUE PREMIUM (STRUCTURE SEULEMENT) : catalogue de packs payants en euros. Aucun paiement réel
// n'est branché : l'achat affiche « paiement indisponible ». Pour le brancher plus tard, il faudra un
// prestataire de paiement côté serveur (vérification du reçu AVANT de créditer quoi que ce soit).
// L'admin peut recevoir n'importe quel pack gratuitement (mode admin).
export const PREMIUM_PACKS = [
  { id: 'pc-s', name: 'Petit sac de PlayCoins', euros: 0.99, icon: '💰', gives: { coins: 10_000 }, desc: '10 000 PC' },
  { id: 'pc-m', name: 'Coffre de PlayCoins', euros: 4.99, icon: '🪙', gives: { coins: 60_000 }, desc: '60 000 PC (+20 % offerts)' },
  { id: 'pc-l', name: 'Montagne de PlayCoins', euros: 19.99, icon: '🏔️', gives: { coins: 300_000 }, desc: '300 000 PC (+50 % offerts)' },
  { id: 'vip', name: 'Pass VIP (30 jours)', euros: 7.99, icon: '👑', gives: { vipDays: 30 }, desc: 'Couronne, salaire +20 %, essais illimités' },
  { id: 'starter', name: 'Pack de démarrage', euros: 2.99, icon: '🎁', gives: { coins: 20_000, items: ['wingfoil'] }, desc: '20 000 PC + un wingfoil' },
  { id: 'luxe', name: 'Pack Luxe', euros: 49.99, icon: '🏎️', gives: { coins: 500_000, vehicle: 'furioso' }, desc: '500 000 PC + Taureau Furioso V12' },
];
export const PREMIUM_BY_ID = Object.fromEntries(PREMIUM_PACKS.map((p) => [p.id, p]));
export const PAYMENTS_ENABLED = false;
