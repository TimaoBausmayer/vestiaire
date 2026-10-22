// CASINO ROYAL POMME : règles pures (partagées client / autorité). On joue UNIQUEMENT avec des PlayCoins,
// la monnaie du jeu : aucun argent réel n'entre ni ne sort. Avantage de la maison réaliste (la banque
// gagne sur la durée), limite de pertes par jour et auto-exclusion pour garder le jeu raisonnable.

export const CASINO = { minBet: 10, maxBet: 5000, minAge: 18, defaultLimit: 5000, excludeHours: 24 };

// ------------------------------------------------------------------------------------- machine à sous
// 3 rouleaux, symboles pondérés. Taux de retour ≈ 92 % (vérifié par énumération dans les tests).
export const SLOT_SYMBOLS = [
  { id: 'cerise', emoji: '🍒', w: 28 },
  { id: 'citron', emoji: '🍋', w: 24 },
  { id: 'cloche', emoji: '🔔', w: 18 },
  { id: 'pasteque', emoji: '🍉', w: 14 },
  { id: 'etoile', emoji: '⭐', w: 9 },
  { id: 'diamant', emoji: '💎', w: 5 },
  { id: 'sept', emoji: '7️⃣', w: 2 },
];
// Multiplicateurs (mise × n) pour trois symboles identiques ; deux ou une cerise paient un peu.
export const SLOT_PAYS = { cerise: 6, citron: 8, cloche: 15, pasteque: 30, etoile: 80, diamant: 250, sept: 1000 };
export const SLOT_CHERRY = { two: 2, one: 0.5 };
const SLOT_TOTAL = SLOT_SYMBOLS.reduce((s, x) => s + x.w, 0);

export function slotSymbol(rand) {
  let r = rand() * SLOT_TOTAL;
  for (const s of SLOT_SYMBOLS) { r -= s.w; if (r < 0) return s.id; }
  return SLOT_SYMBOLS[0].id;
}

// Multiplicateur gagné pour une combinaison de 3 symboles.
export function slotMultiplier(reels) {
  const [a, b, c] = reels;
  if (a === b && b === c) return SLOT_PAYS[a];
  const cherries = reels.filter((x) => x === 'cerise').length;
  if (cherries === 2) return SLOT_CHERRY.two;
  if (cherries === 1 && a === 'cerise') return SLOT_CHERRY.one;
  return 0;
}

// Retour théorique au joueur (somme exacte sur toutes les combinaisons).
export function slotRtp() {
  let rtp = 0;
  for (const a of SLOT_SYMBOLS) for (const b of SLOT_SYMBOLS) for (const c of SLOT_SYMBOLS) {
    rtp += (a.w * b.w * c.w) / SLOT_TOTAL ** 3 * slotMultiplier([a.id, b.id, c.id]);
  }
  return rtp;
}

// ------------------------------------------------------------------------------------- roulette
// Roulette européenne (un seul zéro : avantage de la maison 2,7 %).
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const ROULETTE_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const ROULETTE_BETS = {
  rouge: { label: 'Rouge', pays: 1, wins: (n) => RED.has(n) },
  noir: { label: 'Noir', pays: 1, wins: (n) => n > 0 && !RED.has(n) },
  pair: { label: 'Pair', pays: 1, wins: (n) => n > 0 && n % 2 === 0 },
  impair: { label: 'Impair', pays: 1, wins: (n) => n % 2 === 1 },
  manque: { label: '1 à 18', pays: 1, wins: (n) => n >= 1 && n <= 18 },
  passe: { label: '19 à 36', pays: 1, wins: (n) => n >= 19 },
  d1: { label: '1re douzaine', pays: 2, wins: (n) => n >= 1 && n <= 12 },
  d2: { label: '2e douzaine', pays: 2, wins: (n) => n >= 13 && n <= 24 },
  d3: { label: '3e douzaine', pays: 2, wins: (n) => n >= 25 },
  numero: { label: 'Plein (un numéro)', pays: 35, wins: (n, v) => n === v },
};
export const rouletteColor = (n) => (n === 0 ? 'vert' : RED.has(n) ? 'rouge' : 'noir');

// Gain total rendu (mise comprise) pour une mise sur la roulette ; 0 si perdu.
export function roulettePayout(kind, value, n, bet) {
  const b = ROULETTE_BETS[kind];
  if (!b || !b.wins(n, value)) return 0;
  return bet * (b.pays + 1);
}

// ------------------------------------------------------------------------------------- cartes
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];
// Paquet mélangé (Fisher-Yates) avec le générateur de l'autorité.
export function deck(rand, decks = 1) {
  const d = [];
  for (let k = 0; k < decks; k++) for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
export const rankOf = (c) => c.slice(0, -1);
export const suitOf = (c) => c.slice(-1);

// ------------------------------------------------------------------------------------- blackjack
// 6 jeux, le croupier tire jusqu'à 17 (reste sur 17 souple), blackjack payé 3 pour 2, doubler sur les
// deux premières cartes. Pas de séparation (règle de la maison, affichée).
export function bjValue(cards) {
  let v = 0, aces = 0;
  for (const c of cards) {
    const r = rankOf(c);
    if (r === 'A') { aces++; v += 11; } else if (['V', 'D', 'R', '10'].includes(r)) v += 10; else v += Number(r);
  }
  while (v > 21 && aces) { v -= 10; aces--; }
  return v;
}
export const isBlackjack = (cards) => cards.length === 2 && bjValue(cards) === 21;

// Le croupier joue (mutation de la main) ; renvoie sa valeur finale.
export function dealerPlay(dealer, draw) {
  while (bjValue(dealer) < 17) dealer.push(draw());
  return bjValue(dealer);
}

// Gain rendu (mise comprise) à la fin d'une main.
export function bjSettle(player, dealer, bet) {
  const pv = bjValue(player), dv = bjValue(dealer);
  if (pv > 21) return { result: 'perdu', payout: 0 };
  const pbj = isBlackjack(player), dbj = isBlackjack(dealer);
  if (pbj && !dbj) return { result: 'blackjack', payout: Math.floor(bet * 2.5) };
  if (dbj && !pbj) return { result: 'perdu', payout: 0 };
  if (dv > 21 || pv > dv) return { result: 'gagné', payout: bet * 2 };
  if (pv === dv) return { result: 'égalité', payout: bet };
  return { result: 'perdu', payout: 0 };
}

// ------------------------------------------------------------------------------------- vidéo poker
// « Valet ou mieux » : on reçoit 5 cartes, on garde celles qu'on veut, on retire une fois.
export const POKER_PAYS = [
  ['quinte-flush-royale', 'Quinte flush royale', 250],
  ['quinte-flush', 'Quinte flush', 50],
  ['carre', 'Carré', 25],
  ['full', 'Full', 9],
  ['couleur', 'Couleur', 6],
  ['quinte', 'Quinte', 4],
  ['brelan', 'Brelan', 3],
  ['deux-paires', 'Deux paires', 2],
  ['valets', 'Paire de valets ou mieux', 1],
];
const RANK_N = { A: 14, R: 13, D: 12, V: 11 };
const rankN = (c) => RANK_N[rankOf(c)] || Number(rankOf(c));

export function pokerHand(cards) {
  const ns = cards.map(rankN).sort((a, b) => a - b);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  const uniq = [...new Set(ns)];
  let straight = uniq.length === 5 && ns[4] - ns[0] === 4;
  if (!straight && uniq.length === 5 && ns.join() === '2,3,4,5,14') straight = true; // As-2-3-4-5
  const counts = {};
  for (const n of ns) counts[n] = (counts[n] || 0) + 1;
  const groups = Object.values(counts).sort((a, b) => b - a);
  let id = null;
  if (straight && flush) id = ns[0] === 10 ? 'quinte-flush-royale' : 'quinte-flush';
  else if (groups[0] === 4) id = 'carre';
  else if (groups[0] === 3 && groups[1] === 2) id = 'full';
  else if (flush) id = 'couleur';
  else if (straight) id = 'quinte';
  else if (groups[0] === 3) id = 'brelan';
  else if (groups[0] === 2 && groups[1] === 2) id = 'deux-paires';
  else if (groups[0] === 2 && Object.keys(counts).some((n) => counts[n] === 2 && Number(n) >= 11)) id = 'valets';
  const row = POKER_PAYS.find((r) => r[0] === id);
  return row ? { id, label: row[1], mult: row[2] } : { id: null, label: 'Rien', mult: 0 };
}

// ------------------------------------------------------------------------------------- jeu responsable
export function defaultCasino() { return { day: null, net: 0, limit: CASINO.defaultLimit, excludedUntil: 0, played: 0, won: 0, lost: 0, best: 0 }; }

// Remet les compteurs du jour à zéro si la date a changé.
export function casinoDay(c, now) {
  const day = new Date(now).toISOString().slice(0, 10);
  if (c.day !== day) { c.day = day; c.net = 0; }
  return c;
}

// Peut-on encore miser `bet` aujourd'hui (la perte nette ne doit pas dépasser la limite) ?
export function canBet(c, bet, now) {
  if (c.excludedUntil > now) return `Tu t'es exclu·e du casino jusqu'à ${new Date(c.excludedUntil).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`;
  if (-c.net + bet > c.limit) return `Limite de pertes du jour atteinte (${c.limit} PC). Reviens demain ou change ta limite à l'accueil.`;
  return null;
}
