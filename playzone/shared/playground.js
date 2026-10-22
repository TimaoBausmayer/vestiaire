// JEUX DE COUR (parc des Tilleuls) : cache-cache (se cacher ou chercher), loup (attraper les autres).
// En solo comme en ligne, les adversaires sont des PNJ (affichés comme tels).
export const PLAYGROUND = { x: -35, z: -221, w: 46, d: 14 };   // zone de jeu : moitié sud du parc (rectangle)
export const inPlayground = (x, z, m = 0) => Math.abs(x - PLAYGROUND.x) <= PLAYGROUND.w / 2 + m && Math.abs(z - PLAYGROUND.z) <= PLAYGROUND.d / 2 + m;

export const COUR_GAMES = {
  cachette: {
    name: 'Cache-cache : cache-toi !', emoji: '🙈', npcs: 4, count: 20, duration: 90,
    rules: 'Tu as 20 secondes pour te cacher dans le parc pendant qu\'un habitant compte. Ensuite il cherche : s\'il te voit (devant lui, à moins de 7 m) ou te frôle, tu es trouvé·e. Tiens 90 secondes ! Ne sors pas du parc.',
    reward: { base: 20, per: 1, cap: 140 },        // + 1 PC par seconde tenue
  },
  cherche: {
    name: 'Cache-cache : cherche-les !', emoji: '🔎', npcs: 6, count: 10, duration: 120,
    rules: '6 habitants se cachent pendant que tu comptes (10 s). Trouve-les en 2 minutes : approche-toi et appuie sur E. Certains changent de cachette quand tu arrives...',
    reward: { base: 10, per: 18, cap: 140 },       // par habitant trouvé
  },
  loup: {
    name: 'Le loup', emoji: '🐺', npcs: 6, count: 3, duration: 75,
    rules: 'Tu es le loup ! Touche les 6 habitants (fonce sur eux) avant la fin du temps. Ils courent, esquivent... et certains trichent un peu.',
    reward: { base: 10, per: 18, cap: 140 },
  },
};
// Récompense (PC) d'une partie selon le score (secondes tenues ou nombre d'attrapés).
export const courReward = (id, score) => Math.min(COUR_GAMES[id].reward.cap, COUR_GAMES[id].reward.base + score * COUR_GAMES[id].reward.per);
export const COUR_NAMES = ['Momo', 'Lulu', 'Kevin', 'Josiane', 'Nono', 'Paulette', 'Sandrine', 'Gégé', 'Fifi', 'Rico'];
