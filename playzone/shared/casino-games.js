// JEUX DU CASINO (règles pures, partagées client / autorité). On joue UNIQUEMENT avec des PlayCoins, la
// monnaie du jeu. Chaque jeu se résout d'un coup côté autorité : play(rand, choix) → { mult, show } où
// mult est ce que rapporte la mise (0 = perdu, 1 = mise rendue, 2 = doublée...). Tous les jeux gardent un
// avantage pour la maison (taux de retour entre ~85 % et ~99 %, vérifié par simulation dans les tests).
// Quatre jeux ont leur propre table (roulette, blackjack, vidéo poker, machine « Pomme d'Or ») : `panel`.
import { slotSymbol, slotMultiplier } from './casino.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];
const card = (rand) => ({ r: 1 + Math.floor(rand() * 13), s: Math.floor(rand() * 4) });
const cardTxt = (c) => `${RANKS[c.r - 1]}${SUITS[c.s]}`;
const hi = (c) => (c.r === 1 ? 14 : c.r);                  // l'as est la plus forte carte
const d6 = (rand) => 1 + Math.floor(rand() * 6);
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const pickW = (rand, items) => { const tot = items.reduce((s, x) => s + x.w, 0); let r = rand() * tot; for (const x of items) { r -= x.w; if (r < 0) return x; } return items[items.length - 1]; };
const ch = (...a) => a.map(([id, label, hint]) => ({ id, label, hint }));
const pick = (rand, n, of) => { const s = new Set(); while (s.size < n) s.add(1 + Math.floor(rand() * of)); return [...s]; };

// Baccarat : valeur d'une main (unités) et règles de la troisième carte.
const bacVal = (cs) => cs.reduce((s, c) => s + (c.r >= 10 ? 0 : c.r), 0) % 10;
function baccarat(rand) {
  const P = [card(rand), card(rand)], B = [card(rand), card(rand)];
  let p = bacVal(P), b = bacVal(B);
  if (p < 8 && b < 8) {
    let third = null;
    if (p <= 5) { third = card(rand); P.push(third); p = bacVal(P); }
    const t = third ? (third.r >= 10 ? 0 : third.r) : null;
    const draw = third === null ? b <= 5 : b <= 2 || (b === 3 && t !== 8) || (b === 4 && t >= 2 && t <= 7) || (b === 5 && t >= 4 && t <= 7) || (b === 6 && (t === 6 || t === 7));
    if (draw) { B.push(card(rand)); b = bacVal(B); }
  }
  return { P, B, p, b };
}
// Poker à 3 cartes : rang de la main (0 rien, 1 paire, 2 couleur, 3 suite, 4 brelan, 5 quinte flush)
function three(cs) {
  const v = cs.map(hi).sort((a, b) => a - b), flush = cs.every((c) => c.s === cs[0].s);
  const straight = (v[2] - v[1] === 1 && v[1] - v[0] === 1) || (v[0] === 2 && v[1] === 3 && v[2] === 14);
  if (v[0] === v[2]) return 4;
  if (straight && flush) return 5;
  if (straight) return 3;
  if (flush) return 2;
  if (v[0] === v[1] || v[1] === v[2]) return 1;
  return 0;
}
// Poker aux dés : figure de 5 dés
function diceHand(ds) {
  const n = [0, 0, 0, 0, 0, 0, 0]; ds.forEach((d) => n[d]++);
  const c = n.filter(Boolean).sort((a, b) => b - a), sorted = [...ds].sort().join('');
  if (c[0] === 5) return 'poker';
  if (c[0] === 4) return 'carre';
  if (c[0] === 3 && c[1] === 2) return 'full';
  if (sorted === '12345' || sorted === '23456') return 'suite';
  if (c[0] === 3) return 'brelan';
  if (c[0] === 2 && c[1] === 2) return 'deuxpaires';
  return c[0] === 2 ? 'paire' : 'rien';
}
const DICE_PAYS = { poker: 60, carre: 8, full: 4, suite: 4, brelan: 1.6, deuxpaires: 1, paire: 0, rien: 0 };
const DICE_NAMES = { poker: 'Poker (5 identiques) !', carre: 'Carré', full: 'Full', suite: 'Suite', brelan: 'Brelan', deuxpaires: 'Deux paires', paire: 'Une paire', rien: 'Rien' };
// Plinko / Pachinko : nombre de « droite » sur n rangées (loi binomiale), case → multiplicateur
const drop = (rand, rows) => { let k = 0; for (let i = 0; i < rows; i++) if (rand() < 0.5) k++; return k; };
const PLINKO = {
  faible: [5.2, 2, 1.1, 0.95, 0.5, 0.95, 1.1, 2, 5.2],
  moyen: [12, 3, 1.2, 0.7, 0.4, 0.7, 1.2, 3, 12],
  fort: [26, 4, 1.4, 0.3, 0.2, 0.3, 1.4, 4, 26],
};
const PACHINKO = [50, 10, 4, 1.7, 1, 0.55, 0.4, 0.55, 1, 1.7, 4, 10, 50];   // 13 cases (12 rangées)
// Courses : probabilités de victoire, cote = 0,92 / p
const HORSES = [['Éclair', 0.34], ['Tonnerre', 0.24], ['Bourrasque', 0.16], ['Caramel', 0.12], ['Patate', 0.08], ['Mamie Rapide', 0.06]];
const DOGS = [['Fusée', 0.22], ['Rocket', 0.18], ['Biscuit', 0.15], ['Comète', 0.13], ['Saucisse', 0.11], ['Flash', 0.09], ['Pantoufle', 0.07], ['Escargot', 0.05]];
const race = (rand, list) => { let r = rand(); for (let i = 0; i < list.length; i++) { r -= list[i][1]; if (r < 0) return i; } return list.length - 1; };
const odds = (p) => Math.round((0.92 / p) * 10) / 10;
// Machines à sous à thème (3 rouleaux, symboles pondérés)
const PHARAON = [{ id: '🏺', w: 30, x: 7 }, { id: '🐍', w: 24, x: 13 }, { id: '🐫', w: 18, x: 27 }, { id: '👁️', w: 10, x: 85 }, { id: '🔱', w: 6, x: 250 }, { id: '👑', w: 3, x: 1000 }];
const SAUVAGE = [{ id: '🍒', w: 26, x: 4 }, { id: '🍋', w: 22, x: 6.5 }, { id: '🍇', w: 16, x: 11.5 }, { id: '🍉', w: 12, x: 25 }, { id: '🔔', w: 7, x: 57 }, { id: '🃏', w: 6, x: 0 }];   // 🃏 = joker (remplace tout)
// Ticket à gratter : 9 cases, symboles pondérés ; 3 identiques ou plus = gain du symbole
const GRAT = [{ id: '🪙', w: 30, x: 1.8 }, { id: '💵', w: 22, x: 3.6 }, { id: '💰', w: 14, x: 10 }, { id: '💎', w: 6, x: 48 }, { id: '🍀', w: 3, x: 240 }];
const KENO_PAYS = { 3: [0, 0, 3, 45], 5: [0, 0, 1, 3.8, 22, 350], 7: [0, 0, 0.4, 1.7, 5, 30, 250, 2500] };
const BINGO_PAYS = [0, 0, 0, 1, 2.5, 9, 60];   // selon le nombre de numéros sortis (sur 6)

export const GAMES = {
  // ------------------------------------------------------------------ jeux à table dédiée
  slots: { name: 'Machine à sous « Pomme d\'Or »', emoji: '🎰', cat: 'Machines', panel: 'slots', desc: 'Trois rouleaux, cerises et 7️⃣ en or.' },
  roulette: { name: 'Roulette européenne', emoji: '🎡', cat: 'Tables', panel: 'roulette', desc: 'Rouge, noir, numéros, douzaines... un seul zéro.' },
  blackjack: { name: 'Blackjack', emoji: '🃏', cat: 'Cartes', panel: 'bj', desc: 'Approche 21 sans dépasser, bats le croupier.' },
  videopoker: { name: 'Vidéo poker', emoji: '🂡', cat: 'Cartes', panel: 'poker', desc: 'Garde tes meilleures cartes et tire.' },

  // ------------------------------------------------------------------ pièces et dés
  pile: { name: 'Pile ou face', emoji: '🪙', cat: 'Dés & pièces', desc: 'Le grand classique : ×1,95.', choices: ch(['pile', 'Pile'], ['face', 'Face']),
    play: (rand, c) => { const r = rand() < 0.5 ? 'pile' : 'face'; return { mult: r === c ? 1.95 : 0, show: r === 'pile' ? '🪙 PILE' : '🪙 FACE' }; } },
  de: { name: 'Le dé magique', emoji: '🎲', cat: 'Dés & pièces', desc: 'Devine le chiffre : ×5,7.', choices: ch(['1', '⚀ 1'], ['2', '⚁ 2'], ['3', '⚂ 3'], ['4', '⚃ 4'], ['5', '⚄ 5'], ['6', '⚅ 6']),
    play: (rand, c) => { const d = d6(rand); return { mult: String(d) === c ? 5.7 : 0, show: `${DIE[d]} ${d}` }; } },
  sept: { name: 'Sept haut, sept bas', emoji: '7️⃣', cat: 'Dés & pièces', desc: 'Deux dés : moins de 7 (×2,3), plus de 7 (×2,3) ou pile 7 (×5,75).', choices: ch(['bas', 'Moins de 7', '×2,3'], ['sept', 'Pile 7', '×5,75'], ['haut', 'Plus de 7', '×2,3']),
    play: (rand, c) => { const a = d6(rand), b = d6(rand), s = a + b; const r = s < 7 ? 'bas' : s > 7 ? 'haut' : 'sept'; return { mult: r === c ? (c === 'sept' ? 5.75 : 2.3) : 0, show: `${DIE[a]}${DIE[b]} = ${s}` }; } },
  sicbo: { name: 'Sic Bo', emoji: '🀄', cat: 'Dés & pièces', desc: 'Trois dés chinois : petit (4-10), grand (11-17) ou un triple.', choices: ch(['petit', 'Petit (4-10)', '×1,95'], ['grand', 'Grand (11-17)', '×1,95'], ['triple', 'N\'importe quel triple', '×33']),
    play: (rand, c) => { const ds = [d6(rand), d6(rand), d6(rand)], s = ds[0] + ds[1] + ds[2], tri = ds[0] === ds[1] && ds[1] === ds[2];
      const win = c === 'triple' ? tri : !tri && (c === 'petit' ? s <= 10 : s >= 11); return { mult: win ? (c === 'triple' ? 33 : 1.95) : 0, show: `${ds.map((d) => DIE[d]).join('')} = ${s}${tri ? ' (triple !)' : ''}` }; } },
  craps: { name: 'Craps', emoji: '🎲', cat: 'Dés & pièces', desc: 'Ligne de passe : 7 ou 11 gagnent, 2-3-12 perdent, sinon il faut refaire le point avant un 7.', choices: ch(['pass', 'Ligne de passe', '×2']),
    play: (rand) => { const roll = () => d6(rand) + d6(rand); let s = roll(); const log = [s];
      if (s === 7 || s === 11) return { mult: 2, show: `Lancer : ${s} — gagné d'entrée !` };
      if (s === 2 || s === 3 || s === 12) return { mult: 0, show: `Lancer : ${s} — craps, perdu.` };
      const point = s; for (let i = 0; i < 60; i++) { s = roll(); log.push(s); if (s === point) return { mult: 2, show: `Point ${point} : ${log.join(' → ')} — point refait !` }; if (s === 7) break; }
      return { mult: 0, show: `Point ${point} : ${log.join(' → ')} — sept, perdu.` }; } },
  chuck: { name: 'Chuck-a-luck (cage à dés)', emoji: '🪣', cat: 'Dés & pièces', desc: 'Choisis un chiffre : gagné une fois par dé qui le montre.', choices: ch(['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']),
    play: (rand, c) => { const ds = [d6(rand), d6(rand), d6(rand)], n = ds.filter((d) => String(d) === c).length; return { mult: n ? 1 + n : 0, show: `${ds.map((d) => DIE[d]).join(' ')} — ${n} fois le ${c}` }; } },
  desor: { name: 'Dés d\'or', emoji: '🥇', cat: 'Dés & pièces', desc: 'Devine la somme exacte de deux dés : plus elle est rare, plus ça paie.', choices: ch(...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => [String(s), String(s), `×${Math.round(0.95 * 36 / (6 - Math.abs(7 - s)) * 10) / 10}`])),
    play: (rand, c) => { const a = d6(rand), b = d6(rand), s = a + b, k = Number(c); return { mult: s === k ? Math.round(0.95 * 36 / (6 - Math.abs(7 - k)) * 10) / 10 : 0, show: `${DIE[a]}${DIE[b]} = ${s}` }; } },
  pokerdes: { name: 'Poker aux dés', emoji: '🎯', cat: 'Dés & pièces', desc: 'Cinq dés : paire, brelan, full, suite, carré... ou le POKER (×60).',
    play: (rand) => { const ds = [d6(rand), d6(rand), d6(rand), d6(rand), d6(rand)], hand = diceHand(ds); return { mult: DICE_PAYS[hand], show: `${ds.map((d) => DIE[d]).join('')} — ${DICE_NAMES[hand]}` }; } },
  twoup: { name: 'Two-up australien', emoji: '🇦🇺', cat: 'Dés & pièces', desc: 'Deux pièces lancées : deux faces ou deux piles ? Mixte = on relance (5 mixtes de suite : perdu).', choices: ch(['faces', 'Deux faces'], ['piles', 'Deux piles']),
    play: (rand, c) => { const log = []; for (let i = 0; i < 5; i++) { const a = rand() < 0.5, b = rand() < 0.5; log.push(`${a ? 'F' : 'P'}${b ? 'F' : 'P'}`); if (a === b) { const r = a ? 'faces' : 'piles'; return { mult: r === c ? 2 : 0, show: `${log.join(' · ')} — deux ${r} !` }; } } return { mult: 0, show: `${log.join(' · ')} — cinq mixtes, la maison gagne.` }; } },
  fantan: { name: 'Fan-tan', emoji: '🥢', cat: 'Dés & pièces', desc: 'Le croupier compte les perles par 4 : il en reste 1, 2, 3 ou 4 ?', choices: ch(['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']),
    play: (rand, c) => { const n = 20 + Math.floor(rand() * 60), r = ((n - 1) % 4) + 1; return { mult: String(r) === c ? 3.8 : 0, show: `${n} perles → reste ${r}` }; } },

  // ------------------------------------------------------------------ cartes
  baccarat: { name: 'Baccarat', emoji: '💼', cat: 'Cartes', desc: 'Le plus proche de 9 : Joueur (×2), Banquier (×1,95) ou Égalité (×9).', choices: ch(['joueur', 'Joueur', '×2'], ['banquier', 'Banquier', '×1,95'], ['egalite', 'Égalité', '×9']),
    play: (rand, c) => { const { P, B, p, b } = baccarat(rand); const r = p > b ? 'joueur' : b > p ? 'banquier' : 'egalite';
      const mult = r === c ? { joueur: 2, banquier: 1.95, egalite: 9 }[c] : r === 'egalite' ? 1 : 0;
      return { mult, show: `Joueur ${P.map(cardTxt).join(' ')} (${p}) · Banquier ${B.map(cardTxt).join(' ')} (${b})` }; } },
  dragon: { name: 'Dragon Tigre', emoji: '🐉', cat: 'Cartes', desc: 'Une carte chacun : la plus forte gagne (×2). Égalité : ×11.', choices: ch(['dragon', '🐉 Dragon', '×2'], ['tigre', '🐯 Tigre', '×2'], ['egalite', 'Égalité', '×11']),
    play: (rand, c) => { const a = card(rand), b = card(rand), r = hi(a) > hi(b) ? 'dragon' : hi(b) > hi(a) ? 'tigre' : 'egalite';
      return { mult: r === c ? (c === 'egalite' ? 11 : 2) : r === 'egalite' ? 0.5 : 0, show: `🐉 ${cardTxt(a)} contre 🐯 ${cardTxt(b)}` }; } },
  bataille: { name: 'La bataille', emoji: '⚔️', cat: 'Cartes', desc: 'Ta carte contre celle du croupier. Égalité : on récupère la moitié.', choices: ch(['jouer', 'Retourner ma carte', '×2']),
    play: (rand) => { const a = card(rand), b = card(rand); return { mult: hi(a) > hi(b) ? 2 : hi(a) === hi(b) ? 0.5 : 0, show: `Toi ${cardTxt(a)} · Croupier ${cardTxt(b)}` }; } },
  hilo: { name: 'Plus haut, plus bas', emoji: '↕️', cat: 'Cartes', desc: 'Une carte est retournée : la suivante sera-t-elle plus haute ou plus basse ? (Égalité : perdu.)', choices: ch(['haut', 'Plus haute', '×2,1'], ['bas', 'Plus basse', '×2,1']),
    play: (rand, c) => { const a = card(rand), b = card(rand), r = hi(b) > hi(a) ? 'haut' : hi(b) < hi(a) ? 'bas' : 'egal'; return { mult: r === c ? 2.1 : 0, show: `${cardTxt(a)} → ${cardTxt(b)}` }; } },
  reddog: { name: 'Red Dog', emoji: '🐕', cat: 'Cartes', desc: 'Deux cartes : la troisième tombera-t-elle entre les deux ? Plus l\'écart est petit, plus ça paie.', choices: ch(['jouer', 'Tirer la 3e carte']),
    play: (rand) => { const a = card(rand), b = card(rand), lo = Math.min(hi(a), hi(b)), up = Math.max(hi(a), hi(b)), gap = up - lo - 1;
      if (gap < 1) return { mult: gap === -1 ? 1 : 0, show: `${cardTxt(a)} ${cardTxt(b)} — ${gap === -1 ? 'paire : mise rendue' : 'cartes qui se suivent : perdu'}` };
      const t = card(rand), win = hi(t) > lo && hi(t) < up, pay = gap === 1 ? 7.5 : gap === 2 ? 5.5 : gap === 3 ? 3.8 : 2.6;
      return { mult: win ? pay : 0, show: `${cardTxt(a)} ${cardTxt(b)} → ${cardTxt(t)} (écart ${gap})` }; } },
  troiscartes: { name: 'Poker à trois cartes', emoji: '🎴', cat: 'Cartes', desc: 'Trois cartes : paire (×1,6), couleur (×3,5), suite (×6), brelan (×25), quinte flush (×35).',
    play: (rand) => { const cs = [card(rand), card(rand), card(rand)], r = three(cs); return { mult: [0, 1.6, 3.5, 6, 25, 35][r], show: `${cs.map(cardTxt).join(' ')} — ${['rien', 'paire', 'couleur', 'suite', 'brelan', 'quinte flush !'][r]}` }; } },
  andar: { name: 'Andar Bahar', emoji: '🇮🇳', cat: 'Cartes', desc: 'Un joker est retourné : de quel côté sortira la même valeur en premier ?', choices: ch(['andar', 'Andar (gauche)', '×1,9'], ['bahar', 'Bahar (droite)', '×2']),
    play: (rand, c) => { const j = card(rand); let k = 0; for (; k < 60; k++) if (card(rand).r === j.r) break; const r = k % 2 === 0 ? 'andar' : 'bahar';
      return { mult: r === c ? (c === 'andar' ? 1.9 : 2) : 0, show: `Joker ${cardTxt(j)} — trouvé à la ${k + 1}e carte, côté ${r}` }; } },
  devine: { name: 'Devine la carte', emoji: '🔮', cat: 'Cartes', desc: 'Couleur (×1,9), enseigne (×3,8) ou figure (V, D, R : ×4,1).', choices: ch(['rouge', 'Rouge ♥♦', '×1,9'], ['noir', 'Noire ♠♣', '×1,9'], ['pique', '♠', '×3,8'], ['coeur', '♥', '×3,8'], ['carreau', '♦', '×3,8'], ['trefle', '♣', '×3,8'], ['figure', 'Une figure', '×4,1']),
    play: (rand, c) => { const k = card(rand), red = k.s === 1 || k.s === 2, suit = ['pique', 'coeur', 'carreau', 'trefle'][k.s];
      const win = c === 'rouge' ? red : c === 'noir' ? !red : c === 'figure' ? k.r >= 11 : c === suit; return { mult: win ? (c === 'rouge' || c === 'noir' ? 1.9 : c === 'figure' ? 4.1 : 3.8) : 0, show: `🃏 ${cardTxt(k)}` }; } },

  // ------------------------------------------------------------------ roues, loteries, tirages
  roue: { name: 'La Grande Roue de la Fortune', emoji: '🎡', cat: 'Roues & loteries', desc: '54 cases : 1, 2, 5, 10, 20 ou la case étoile.', choices: ch(['1', '1 (24 cases)', '×2,1'], ['2', '2 (15 cases)', '×3,3'], ['5', '5 (7 cases)', '×7'], ['10', '10 (4 cases)', '×12'], ['20', '20 (2 cases)', '×24'], ['40', '⭐ (2 cases)', '×25']),
    play: (rand, c) => { const r = pickW(rand, [{ v: '1', w: 24 }, { v: '2', w: 15 }, { v: '5', w: 7 }, { v: '10', w: 4 }, { v: '20', w: 2 }, { v: '40', w: 2 }]).v; return { mult: r === c ? { 1: 2.1, 2: 3.3, 5: 7, 10: 12, 20: 24, 40: 25 }[c] : 0, show: `La roue s'arrête sur ${r === '40' ? '⭐' : r}` }; } },
  keno: { name: 'Keno', emoji: '🔢', cat: 'Roues & loteries', desc: 'Tes numéros (tirés au hasard pour toi) parmi 40 ; 10 boules sortent.', choices: ch(['3', '3 numéros'], ['5', '5 numéros'], ['7', '7 numéros']),
    play: (rand, c) => { const k = Number(c), mine = pick(rand, k, 40), drawn = pick(rand, 10, 40), hit = mine.filter((x) => drawn.includes(x)).length;
      return { mult: KENO_PAYS[k][hit] || 0, show: `Tes numéros ${mine.sort((a, b) => a - b).join(' ')} · ${hit} sortis sur ${k}` }; } },
  bingo: { name: 'Bingo express', emoji: '🅱️', cat: 'Roues & loteries', desc: 'Ton carton de 6 numéros (1-30), 12 boules tirées.',
    play: (rand) => { const mine = pick(rand, 6, 30), drawn = pick(rand, 12, 30), hit = mine.filter((x) => drawn.includes(x)).length; return { mult: BINGO_PAYS[hit], show: `Carton ${mine.sort((a, b) => a - b).join(' ')} · ${hit}/6 ${hit === 6 ? 'BINGO !' : ''}` }; } },
  loterie: { name: 'Loterie trois chiffres', emoji: '🎟️', cat: 'Roues & loteries', desc: 'Trois chiffres tirés pour toi : dans l\'ordre (×900) ou dans le désordre (×190).', choices: ch(['ordre', 'Dans l\'ordre', '×900'], ['desordre', 'Dans le désordre', '×190']),
    play: (rand, c) => { const mine = [0, 0, 0].map(() => Math.floor(rand() * 10)), d = [0, 0, 0].map(() => Math.floor(rand() * 10));
      const exact = mine.join('') === d.join(''), any = [...mine].sort().join('') === [...d].sort().join(''); return { mult: c === 'ordre' ? (exact ? 900 : 0) : any ? 190 : 0, show: `Ton ticket ${mine.join('')} · tirage ${d.join('')}` }; } },
  grattage: { name: 'Ticket à gratter', emoji: '🎫', cat: 'Roues & loteries', desc: 'Trois lignes de trois cases : chaque ligne de trois symboles identiques paie (le 🍀 ×240).',
    play: (rand) => { const cells = Array.from({ length: 9 }, () => pickW(rand, GRAT)); let tot = 0;
      for (let r = 0; r < 3; r++) { const [a, b, c] = cells.slice(r * 3, r * 3 + 3); if (a.id === b.id && b.id === c.id) tot += a.x; }
      return { mult: Math.round(tot * 100) / 100, show: [0, 1, 2].map((r) => cells.slice(r * 3, r * 3 + 3).map((x) => x.id).join('')).join(' | ') }; } },

  // ------------------------------------------------------------------ jeux d'arcade
  plinko: { name: 'Plinko', emoji: '🔻', cat: 'Arcade', desc: 'La bille rebondit sur 8 rangées de clous. Risque faible, moyen ou fort.', choices: ch(['faible', 'Risque faible'], ['moyen', 'Risque moyen'], ['fort', 'Risque fort']),
    play: (rand, c) => { const k = drop(rand, 8), m = PLINKO[c][k]; return { mult: m, show: `Case ${k + 1}/9 : ×${m}` }; } },
  pachinko: { name: 'Pachinko', emoji: '🎌', cat: 'Arcade', desc: 'La version japonaise : 12 rangées, les bords paient très gros.',
    play: (rand) => { const k = drop(rand, 12), m = PACHINKO[k]; return { mult: m, show: `Case ${k + 1}/13 : ×${m}` }; } },
  crash: { name: 'Crash', emoji: '🚀', cat: 'Arcade', desc: 'La fusée monte... et explose. Encaisse avant !', choices: ch(['1.5', 'Encaisser à ×1,5'], ['2', 'à ×2'], ['5', 'à ×5'], ['10', 'à ×10'], ['50', 'à ×50']),
    play: (rand, c) => { const crash = Math.max(1, Math.floor((0.96 / (1 - rand())) * 100) / 100), t = Number(c); return { mult: crash >= t ? t : 0, show: `La fusée explose à ×${crash.toFixed(2)}` }; } },
  ballon: { name: 'Le ballon qui éclate', emoji: '🎈', cat: 'Arcade', desc: 'Chaque coup de pompe multiplie le gain... ou fait éclater le ballon (1 chance sur 5).', choices: ch(...[1, 2, 3, 4, 5, 6].map((k) => [String(k), `${k} coup${k > 1 ? 's' : ''}`, `×${Math.round(0.95 / 0.8 ** k * 100) / 100}`])),
    play: (rand, c) => { const k = Number(c); for (let i = 1; i <= k; i++) if (rand() < 0.2) return { mult: 0, show: `💥 Éclaté au ${i}e coup de pompe !` }; return { mult: Math.round(0.95 / 0.8 ** k * 100) / 100, show: `🎈 Il a tenu ${k} coup${k > 1 ? 's' : ''} !` }; } },
  mines: { name: 'Champ de mines', emoji: '💣', cat: 'Arcade', desc: '9 cases, 3 mines. Combien de cases oses-tu retourner ?', choices: ch(...[1, 2, 3, 4].map((k) => [String(k), `${k} case${k > 1 ? 's' : ''}`])),
    play: (rand, c) => { const k = Number(c), mines = pick(rand, 3, 9), picks = pick(rand, k, 9), boom = picks.some((x) => mines.includes(x));
      const safe = [1, 6 / 9, 30 / 72, 120 / 504, 360 / 3024][k]; return { mult: boom ? 0 : Math.round((0.95 / safe) * 100) / 100, show: boom ? '💥 Boum ! Une mine.' : `✅ ${k} case${k > 1 ? 's' : ''} sans mine !` }; } },
  coffres: { name: 'Les trois coffres', emoji: '🧰', cat: 'Arcade', desc: 'Un seul des trois coffres contient le trésor (×2,85).', choices: ch(['1', 'Coffre 1'], ['2', 'Coffre 2'], ['3', 'Coffre 3']),
    play: (rand, c) => { const t = String(1 + Math.floor(rand() * 3)); return { mult: t === c ? 2.85 : 0, show: `Le trésor était dans le coffre ${t}` }; } },
  penalty: { name: 'Tir au but', emoji: '⚽', cat: 'Arcade', desc: 'Tire à gauche, au milieu ou à droite : le gardien plonge au hasard.', choices: ch(['gauche', '⬅️ Gauche'], ['milieu', '⬆️ Milieu'], ['droite', '➡️ Droite']),
    play: (rand, c) => { const k = ['gauche', 'milieu', 'droite'][Math.floor(rand() * 3)]; return { mult: k === c ? 0 : 1.44, show: k === c ? `🧤 Arrêté ! Le gardien a plongé ${k === 'milieu' ? 'au milieu' : `à ${k}`}.` : `⚽ BUT ! Le gardien est parti ${k === 'milieu' ? 'au milieu' : `à ${k}`}.` }; } },
  chifoumi: { name: 'Pierre, feuille, ciseaux', emoji: '✂️', cat: 'Arcade', desc: 'Contre le croupier : gagné ×1,85, égalité = mise rendue.', choices: ch(['pierre', '✊ Pierre'], ['feuille', '✋ Feuille'], ['ciseaux', '✌️ Ciseaux']),
    play: (rand, c) => { const k = ['pierre', 'feuille', 'ciseaux'][Math.floor(rand() * 3)], beats = { pierre: 'ciseaux', feuille: 'pierre', ciseaux: 'feuille' };
      return { mult: k === c ? 1 : beats[c] === k ? 1.85 : 0, show: `Le croupier joue ${{ pierre: '✊', feuille: '✋', ciseaux: '✌️' }[k]} ${k}` }; } },

  // ------------------------------------------------------------------ courses
  chevaux: { name: 'Course de chevaux', emoji: '🏇', cat: 'Courses', desc: 'Six chevaux, six cotes.', choices: ch(...HORSES.map(([n, p], i) => [String(i), n, `cote ×${odds(p)}`])),
    play: (rand, c) => { const w = race(rand, HORSES); return { mult: String(w) === c ? odds(HORSES[w][1]) : 0, show: `🏁 ${HORSES[w][0]} gagne la course !` }; } },
  levriers: { name: 'Course de lévriers', emoji: '🐕', cat: 'Courses', desc: 'Huit chiens, des cotes de ×4 à ×18.', choices: ch(...DOGS.map(([n, p], i) => [String(i), n, `×${odds(p)}`])),
    play: (rand, c) => { const w = race(rand, DOGS); return { mult: String(w) === c ? odds(DOGS[w][1]) : 0, show: `🏁 ${DOGS[w][0]} franchit la ligne en premier !` }; } },
  escargots: { name: 'Course d\'escargots', emoji: '🐌', cat: 'Courses', desc: 'Quatre escargots, une seule bave gagnante (×3,8).', choices: ch(['0', 'Turbo'], ['1', 'Gluant'], ['2', 'Paresse'], ['3', 'Slimy']),
    play: (rand, c) => { const w = Math.floor(rand() * 4); return { mult: String(w) === c ? 3.8 : 0, show: `🐌 ${['Turbo', 'Gluant', 'Paresse', 'Slimy'][w]} gagne... au bout de 3 heures.` }; } },

  // ------------------------------------------------------------------ machines à thème
  pharaon: { name: 'Machine « Trésor du Pharaon »', emoji: '🏺', cat: 'Machines', desc: 'Trois symboles égyptiens identiques. La couronne paie ×1000.',
    play: (rand) => { const r = [pickW(rand, PHARAON), pickW(rand, PHARAON), pickW(rand, PHARAON)]; const same = r[0].id === r[1].id && r[1].id === r[2].id;
      return { mult: same ? r[0].x : r.filter((x) => x.id === '👑').length === 2 ? 5 : 0, show: r.map((x) => x.id).join(' ') }; } },
  sauvage: { name: 'Machine « Fruits Sauvages »', emoji: '🃏', cat: 'Machines', desc: 'Le joker 🃏 remplace n\'importe quel fruit !',
    play: (rand) => { const r = [pickW(rand, SAUVAGE), pickW(rand, SAUVAGE), pickW(rand, SAUVAGE)]; const base = r.find((x) => x.id !== '🃏');
      const win = base && r.every((x) => x.id === '🃏' || x.id === base.id); return { mult: !base ? 80 : win ? base.x : 0, show: r.map((x) => x.id).join(' ') }; } },
};

// Machine « Pomme d'Or » jouable aussi via casino.play (même tirage que la table dédiée).
GAMES.slots.play = (rand) => { const reels = [slotSymbol(rand), slotSymbol(rand), slotSymbol(rand)]; return { mult: slotMultiplier(reels), show: reels.join(' '), reels }; };

export const GAME_IDS = Object.keys(GAMES);
// Le Grand Casino propose les 40 jeux ; les autres casinos une sélection de 16.
export const SMALL_CASINO_GAMES = ['slots', 'roulette', 'blackjack', 'videopoker', 'pile', 'de', 'sept', 'sicbo', 'baccarat', 'roue', 'keno', 'plinko', 'crash', 'chevaux', 'grattage', 'bataille'];
export const gamesFor = (b) => (b?.grand ? GAME_IDS : SMALL_CASINO_GAMES);
