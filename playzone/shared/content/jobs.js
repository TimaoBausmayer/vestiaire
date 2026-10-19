// Métiers : missions, paie, XP, améliorations. Chaque métier a de vraies mécaniques de jeu
// (src/jobs/*.js côté client) et l'autorité (shared/authority.js) valide chaque étape.

export const JOB_LEVELS = [0, 100, 250, 500, 900, 1500, 2400, 3600, 5200, 7500]; // XP pour les niveaux 1 à 10

export const INGREDIENTS = {
  'pain-bas': { name: 'Pain (dessous)', emoji: '🍞', color: '#e9a23b' },
  'pain-haut': { name: 'Pain (dessus)', emoji: '🥯', color: '#f4b860' },
  steak: { name: 'Steak', emoji: '🥩', color: '#5b3a1e' },
  fromage: { name: 'Fromage', emoji: '🧀', color: '#ffd23f' },
  salade: { name: 'Salade', emoji: '🥬', color: '#7ac74f' },
  tomate: { name: 'Tomate', emoji: '🍅', color: '#e63946' },
  oignon: { name: 'Oignon', emoji: '🧅', color: '#e9d5ff' },
  cornichon: { name: 'Cornichon', emoji: '🥒', color: '#3f8f3a' },
  confiture: { name: 'Confiture', emoji: '🍓', color: '#c9184a' },
  chamallow: { name: 'Chamallow', emoji: '🍬', color: '#ffc8dd' },
};
export const FILLINGS = ['steak', 'fromage', 'salade', 'tomate', 'oignon', 'cornichon'];
export const ABSURD_FILLINGS = ['confiture', 'chamallow'];

export const JOBS = [
  {
    id: 'delivery', name: 'Livreur', emoji: '📦', station: 'colis', color: '#ffd23f',
    desc: 'Récupère les colis au dépôt Colis Express et livre-les aux bonnes adresses dans toute la ville.',
    uniform: { hat: 'casquette-livreur', top: 'gilet-livreur', topColor: '#ffd23f', back: 'sac-livreur' },
    missions: [
      { id: 'standard', name: 'Colis standard', level: 1, pay: 35, xp: 20, stops: 1, desc: 'Un colis, une adresse. Le grand classique.' },
      { id: 'express', name: 'Livraison express', level: 2, pay: 40, xp: 30, stops: 1, timed: true, desc: 'Un colis urgent : gros bonus si tu arrives avant la fin du chrono.' },
      { id: 'tournee', name: 'Tournée du quartier', level: 3, pay: 105, xp: 70, stops: 3, desc: 'Trois colis, trois adresses, dans l\'ordre que tu veux.' },
      { id: 'fragile', name: 'Colis fragile', level: 4, pay: 95, xp: 65, stops: 1, fragile: true, desc: 'Des œufs de collection. Chaque saut ou chute abîme le colis (et la paie).' },
    ],
    upgrades: [
      { id: 'gps', name: 'GPS bavard', price: 250, level: 1, desc: 'Chrono des livraisons express +25 %.' },
      { id: 'baskets', name: 'Baskets à ressorts', price: 350, level: 2, desc: '+12 % de vitesse pendant le service.' },
      { id: 'sac-xxl', name: 'Sac XXL', price: 600, level: 3, desc: '+25 % de paie sur les tournées.' },
    ],
  },
  {
    id: 'firefighter', name: 'Pompier', emoji: '🚒', station: 'caserne', color: '#ff5a5f',
    desc: 'Éteins les incendies avec ta lance à eau et porte secours aux habitants (et aux chats).',
    uniform: { hat: 'casque-pompier', top: 'uniforme-pompier', topColor: '#2b2d42' },
    missions: [
      { id: 'poubelle', name: 'Poubelle en feu', level: 1, pay: 30, xp: 20, fires: 1, hp: 50, trash: true, desc: 'Quelqu\'un a jeté une raclette encore chaude.' },
      { id: 'chat', name: 'Chat coincé dans un arbre', level: 1, pay: 40, xp: 25, cat: true, desc: 'Un chat refuse de descendre. Il a ses raisons.' },
      { id: 'incendie', name: 'Incendie de bâtiment', level: 2, pay: 75, xp: 50, fires: 1, hp: 140, desc: 'De la fumée sort d\'une fenêtre. Fonce !' },
      { id: 'grand-feu', name: 'Grand incendie', level: 4, pay: 190, xp: 130, fires: 3, hp: 140, desc: 'Trois foyers en même temps. Toute la ville compte sur toi.' },
    ],
    upgrades: [
      { id: 'lance-turbo', name: 'Lance turbo', price: 350, level: 1, desc: 'Ta lance éteint 40 % plus vite.' },
      { id: 'bottes', name: 'Bottes de course', price: 400, level: 2, desc: '+12 % de vitesse pendant le service.' },
      { id: 'casque-dore', name: 'Casque doré', price: 900, level: 4, desc: '+20 % de paie sur toutes les interventions.' },
    ],
  },
  {
    id: 'cook', name: 'Cuisinier', emoji: '🍔', station: 'burger', color: '#ff9f1c',
    desc: 'Au camion du Burger Absurde, assemble les commandes des clients avant qu\'ils perdent patience.',
    uniform: { hat: 'toque', top: 'tablier', topColor: '#f4f1ea' },
    missions: [
      { id: 'service', name: 'Service du midi', level: 1, orders: 3, fillings: [2, 3], patience: 50, payPerOrder: 14, xpPerOrder: 9, desc: 'Trois clients affamés. Rien d\'insurmontable.' },
      { id: 'rush', name: 'Coup de feu', level: 2, orders: 5, fillings: [2, 4], patience: 42, payPerOrder: 17, xpPerOrder: 11, desc: 'Cinq commandes, et ça s\'impatiente.' },
      { id: 'critique', name: 'Le critique gastronomique', level: 3, orders: 2, fillings: [5, 6], patience: 70, payPerOrder: 55, xpPerOrder: 35, absurd: true, desc: 'Un critique exigeant (et bizarre). Recettes longues, gros pourboire.' },
    ],
    upgrades: [
      { id: 'musique', name: 'Musique d\'ambiance', price: 300, level: 1, desc: 'Les clients patientent 25 % plus longtemps.' },
      { id: 'spatule-doree', name: 'Spatule dorée', price: 500, level: 2, desc: '+20 % de pourboires.' },
      { id: 'menu-xl', name: 'Menu XL', price: 800, level: 3, desc: '+30 % de paie sur chaque commande parfaite.' },
    ],
  },
];

export const JOB_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j]));

export function jobLevel(xp) {
  let lv = 1;
  for (let i = 0; i < JOB_LEVELS.length; i++) if (xp >= JOB_LEVELS[i]) lv = i + 1;
  return lv;
}
