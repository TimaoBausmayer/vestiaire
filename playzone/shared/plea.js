// PLAIDOIRIE : le joueur écrit librement pour s'expliquer (à l'agent qui l'arrête, ou au juge). Le texte
// est analysé par thèmes (regrets, urgence, légitime défense, aveu, faim, mensonge, insultes...) et la
// réponse s'y adapte. Une bonne explication réduit la peine ; mentir ou insulter l'alourdit.

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const THEMES = [
  { id: 'regret', words: ['desole', 'pardon', 'excuse', 'regrette', 'plus jamais', 'je ne recommencerai', 'erreur', 'honte', 'navre'], weight: 0.18,
    reply: ['Vos regrets ont l\'air sincères.', 'Je note que vous regrettez.', 'Bon. Ça compte, de s\'excuser.'] },
  { id: 'urgence', words: ['urgence', 'hopital', 'malade', 'accouche', 'enceinte', 'bebe', 'ambulance', 'blesse', 'mourant', 'medecin', 'crise cardiaque', 'secours'], weight: 0.3, for: ['grand-exces', 'exces', 'feu-rouge', 'sans-permis', 'vol-voiture', 'infraction'],
    reply: ['Une urgence médicale ? Ça change beaucoup de choses.', 'Si quelqu\'un était en danger, je peux le comprendre.'] },
  { id: 'defense', words: ['defendre', 'legitime defense', 'attaque', 'agresse', 'menace', 'il m\'a frappe', 'il a commence', 'proteger', 'sauver'], weight: 0.3, for: ['coups', 'agression-policier'],
    reply: ['La légitime défense, ça se plaide.', 'S\'il vous a menacé·e d\'abord, ce n\'est pas la même histoire.'] },
  { id: 'faim', words: ['faim', 'manger', 'pauvre', 'nourrir', 'mes enfants', 'plus d\'argent', 'chomage', 'loyer', 'dettes'], weight: 0.22, for: ['vol-tire', 'vol-voiture', 'braquage', 'recel'],
    reply: ['La misère n\'excuse pas tout... mais elle explique beaucoup.', 'Si vous aviez faim, je vais en tenir compte.'] },
  { id: 'aveu', words: ['j\'avoue', 'c\'est moi', 'je reconnais', 'j\'assume', 'je plaide coupable', 'oui j\'ai'], weight: 0.15,
    reply: ['L\'honnêteté, ça se récompense.', 'Au moins, vous ne mentez pas.'] },
  { id: 'reparer', words: ['rembourser', 'reparer', 'payer les degats', 'rendre', 'travaux d\'interet', 'aider', 'benevolat'], weight: 0.15,
    reply: ['Vouloir réparer, c\'est un bon début.', 'Proposer de rembourser, c\'est apprécié.'] },
  { id: 'mensonge', words: ['c\'est pas moi', 'ce n\'est pas moi', 'pigeon', 'j\'ai rien fait', 'je n\'ai rien fait', 'innocent', 'complot', 'mon jumeau'], weight: -0.12,
    reply: ['Les témoins disent pourtant le contraire...', 'Hmm. Le pigeon a bon dos.'] },
  { id: 'insulte', words: ['con', 'idiot', 'debile', 'nul', 'ta gueule', 'merde', 'connard', 'abruti', 'flic de', 'cretin'], weight: -0.3,
    reply: ['Outrage ! Ça ne va pas arranger votre cas.', 'Je vais faire comme si je n\'avais rien entendu... non, en fait, je l\'ai entendu.'] },
  { id: 'pot-de-vin', words: ['billet', 'argent pour vous', 'on peut s\'arranger', 'je vous paie', 'cadeau'], weight: -0.2,
    reply: ['Tentative de corruption ? Vraiment ?', 'Rangez votre portefeuille, je ne suis pas à vendre.'] },
];
const pick = (a, seed) => a[Math.abs(seed) % a.length];

// Analyse d'une plaidoirie. crimes : types des délits reprochés. Renvoie { factor, themes, reply }.
//   factor > 0 : réduction de peine (jusqu'à 60 %) ; < 0 : aggravation
export function analyzePlea(text, crimes = [], judge = false) {
  const t = norm(text).slice(0, 600);
  const words = t.split(/[^a-z']+/).filter(Boolean);
  const found = [];
  let factor = 0;
  for (const th of THEMES) {
    // expressions : recherchées telles quelles ; mots : exacts (courts) ou par radical (« rembourserai »)
    const hit = (w) => (w.includes(' ') || w.includes('\'') ? t.includes(w) : words.some((x) => x === w || (w.length >= 5 && x.startsWith(w.slice(0, -1)))));
    if (!th.words.some((w) => hit(norm(w)))) continue;
    const relevant = !th.for || crimes.some((c) => th.for.includes(c));
    factor += relevant ? th.weight : th.weight * (th.weight > 0 ? 0.35 : 1);
    found.push(th.id);
  }
  // une explication développée et polie compte un peu ; trois mots, non
  if (t.length > 80 && factor >= 0) factor += 0.05;
  if (t.length < 12) factor = Math.min(factor, 0.05);
  factor = Math.max(-0.4, Math.min(judge ? 0.5 : 0.6, Math.round(factor * 100) / 100));
  const seed = t.length * 31 + words.length;
  const parts = found.map((id) => pick(THEMES.find((x) => x.id === id).reply, seed + id.length));
  let reply;
  if (!found.length) reply = t.length < 12 ? 'C\'est tout ce que vous avez à dire ? Ça ne m\'aide pas beaucoup.' : 'Je vous écoute... mais rien de tout ça ne change vraiment les faits.';
  else reply = parts.slice(0, 3).join(' ');
  if (factor >= 0.3) reply += judge ? ' La cour se montrera clémente.' : ' Je vais demander une peine réduite.';
  else if (factor > 0) reply += ' J\'en tiendrai un peu compte.';
  else if (factor < 0) reply += judge ? ' La cour alourdit la peine.' : ' Ça va vous coûter plus cher.';
  return { factor, themes: found, reply };
}

// Crime grave : jugé au tribunal (audience avec juges) plutôt qu'au commissariat.
export const GRAVE_MINUTES = 6;
export const isGrave = (crimes, minutes) => minutes >= GRAVE_MINUTES || crimes.some((c) => c === 'braquage' || c === 'homicide');
// Prison : le temps passé hors du jeu ne compte qu'au tiers (10 min de peine = 30 min hors ligne).
export const OFFLINE_RATE = 1 / 3;
