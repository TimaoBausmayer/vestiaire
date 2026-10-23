// JUSTICE : délits (avec témoins), niveau de recherche (étoiles), amendes, points du permis, prison en
// minutes réelles (barème), code de la route et permis de conduire. Règles pures partagées.

export const MAX_STARS = 5;
// Barème : minutes de prison réelles, étoiles ajoutées.
export const CRIMES = {
  coups: { name: 'Coups et blessures', stars: 1, jail: 2 },
  'vol-tire': { name: 'Vol à la tire', stars: 1, jail: 2 },
  'vol-voiture': { name: 'Vol de voiture', stars: 2, jail: 3 },
  pieton: { name: 'Piéton renversé', stars: 2, jail: 3 },
  'grand-exces': { name: 'Grand excès de vitesse', stars: 1, jail: 1 },
  'sans-permis': { name: 'Conduite sans permis', stars: 1, jail: 1 },
  recel: { name: 'Recel de voiture volée', stars: 1, jail: 2 },
  braquage: { name: 'Braquage de banque', stars: 4, jail: 8 },
  evasion: { name: 'Évasion', stars: 3, jail: 4 },
  refus: { name: 'Refus d\'obtempérer', stars: 1, jail: 1 },
  infraction: { name: 'Infraction au code de la route', stars: 1, jail: 0 },
  'agression-policier': { name: 'Agression d\'un policier', stars: 2, jail: 3 },
};
export const MAX_JAIL = 12;   // minutes au maximum par condamnation (peines courtes : on revient vite au jeu)
export const FINES = {
  vitesse: { name: 'Excès de vitesse (radar)', amount: 90, points: 1 },
  'feu-rouge': { name: 'Feu rouge grillé', amount: 135, points: 4 },
  'sans-permis': { name: 'Conduite sans permis', amount: 750, points: 0 },
};
export const SPEED_LIMIT = { main: 50, street: 50, country: 80, highway: 130 };   // km/h
export const LICENCE = { code: 30, permis: 900, points: 12 };
// Prime quand on sème la police (argent liquide), selon le niveau de recherche. Pas plus d'une toutes les 4 min.
export const BOUNTY = [0, 60, 150, 300, 500, 800];
export const BOUNTY_COOLDOWN = 4 * 60_000;
// Aide à la police (arrêter un fuyard, attraper un voleur) : récompense.
export const ASSIST = { chase: 150, thief: 80, cooldown: 3 * 60_000 };

export function defaultJustice() {
  return { stars: 0, crimes: [], record: [], fines: [], points: LICENCE.points, licence: { code: false, permis: false }, jail: null, lastCrimeAt: 0, arrests: 0 };
}

// Peine pour une liste de délits : minutes de prison (plafonnées).
// Avocat (sur place, au moment de l'arrestation) : plus la peine serait lourde, plus il coûte cher.
export const lawyerCost = (minutes, stars) => 600 + minutes * 350 + stars * 250;
export function sentence(crimes) {
  const mins = crimes.reduce((s, c) => s + (CRIMES[c.type]?.jail || 0), 0);
  return Math.min(MAX_JAIL, mins);
}
// Temps sans être vu par la police pour la semer (secondes), selon les étoiles.
export const loseTime = (stars) => 10 + stars * 4;   // se cacher peu de temps suffit

// Code de la route : 10 questions tirées parmi celles-ci, 8 bonnes réponses pour réussir.
export const CODE_QUESTIONS = [
  ['En ville, la vitesse est limitée à...', ['50 km/h', '90 km/h', '130 km/h'], 0],
  ['Un feu orange fixe signifie...', ['Accélérer', 'S\'arrêter sauf si c\'est dangereux', 'Klaxonner'], 1],
  ['Un piéton s\'engage sur le passage. Je...', ['Le laisse passer', 'Klaxonne', 'Accélère'], 0],
  ['Au feu rouge, je...', ['M\'arrête à la ligne', 'Passe si personne', 'Passe en klaxonnant'], 0],
  ['Sur une route de campagne, la limite est...', ['80 km/h', '150 km/h', '30 km/h'], 0],
  ['Téléphoner en conduisant, c\'est...', ['Interdit', 'Autorisé', 'Conseillé'], 0],
  ['Une sirène de police derrière moi : je...', ['Me range et m\'arrête', 'Accélère', 'Fais demi-tour'], 0],
  ['La ceinture de sécurité...', ['Est obligatoire', 'Est optionnelle', 'Est décorative'], 0],
  ['Après avoir bu de l\'alcool, je...', ['Ne conduis pas', 'Conduis doucement', 'Conduis vite pour rentrer'], 0],
  ['Un panneau STOP oblige à...', ['Marquer l\'arrêt complet', 'Ralentir un peu', 'Klaxonner'], 0],
  ['Pour tourner à droite, je...', ['Mets mon clignotant', 'Freine sans prévenir', 'Ferme les yeux'], 0],
  ['La distance de sécurité sert à...', ['Pouvoir freiner à temps', 'Faire joli', 'Rien'], 0],
  ['Quand un camion de pompiers arrive avec sa sirène...', ['Je lui laisse le passage', 'Je fais la course', 'Je bloque la route'], 0],
  ['Un enfant joue au ballon près de la route : je...', ['Ralentis', 'Accélère', 'Klaxonne fort'], 0],
  ['Rouler la nuit sans phares, c\'est...', ['Dangereux et interdit', 'Économique', 'Normal'], 0],
  ['Les points du permis : on en a au départ...', ['12', '3', '100'], 0],
];
export function codeTest(seed) {
  // tirage déterministe de 10 questions (même tirage côté client et serveur)
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const idx = CODE_QUESTIONS.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, 10);
}
export const CODE_PASS = 8;

// Examen de conduite : parcours autour du commissariat (points de passage à franchir dans l'ordre).
export const EXAM_ROUTE = [{ x: 188, z: 2 }, { x: 212, z: -32 }, { x: 180, z: -72 }, { x: 138, z: -36 }, { x: 160, z: 2 }];
export const EXAM_START = { x: 160, z: 2.2, yaw: Math.PI / 2 };
export const EXAM_MIN_SECONDS = 25;
export const EXAM_MAX_ERRORS = 2;

// Radars fixes (vitesse) sur les grands axes.
export const RADARS = [
  { x: 75, z: 0, axis: 'h' }, { x: 0, z: -200, axis: 'v' }, { x: -140, z: -100, axis: 'v' }, { x: 210, z: -200, axis: 'v' }, { x: -100, z: -240, axis: 'h' }, { x: 100, z: -140, axis: 'h' },
];
