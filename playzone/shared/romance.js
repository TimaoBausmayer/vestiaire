// AMOUR : draguer un habitant, lui offrir des cadeaux, l'inviter en rendez-vous, se mettre en couple,
// le faire venir chez soi, voire le demander en mariage (bague en diamant). Règles pures partagées
// client / serveur : l'autorité tire au sort et valide.
export const LOVE = {
  flirtCd: 25_000,      // entre deux tentatives auprès de la même personne
  dateCd: 60_000,
  cuddleCd: 120_000,
  couple: 70,           // affection minimale pour se mettre en couple
  marry: 90,
  dateMin: 25,
  maxKnown: 40,         // nombre de personnes dont on retient l'affection
};
// Rendez-vous : prix (PlayCoins) et affection gagnée.
export const DATES = {
  cafe: { name: 'Un café en terrasse', emoji: '☕', price: 30, aff: 8, humeur: 10 },
  resto: { name: 'Dîner au restaurant', emoji: '🍽️', price: 140, aff: 15, humeur: 18 },
  cinema: { name: 'Une séance de cinéma', emoji: '🎬', price: 70, aff: 11, humeur: 14 },
  plage: { name: 'Balade sur la plage', emoji: '🏖️', price: 0, aff: 6, humeur: 12 },
};
// Cadeaux : objet de l'inventaire → affection gagnée.
export const GIFTS = { bouquet: 10, 'boite-chocolats': 8, 'peluche-coeur': 12, 'collier-or': 25, 'montre-luxe': 30, 'bague-diamant': 40, 'parfum-fleurs': 7 };
export const defaultLove = () => ({ aff: {}, partner: null, married: false, since: 0, dates: 0, cd: {} });
export const lovePhase = (a) => (a >= 90 ? 'fou amoureux' : a >= 70 ? 'amoureux' : a >= 45 ? 'sous le charme' : a >= 25 ? 'intéressé' : a > 0 ? 'curieux' : 'inconnu');
export const loveEmoji = (a) => (a >= 90 ? '💞' : a >= 70 ? '❤️' : a >= 45 ? '💗' : a >= 25 ? '🙂' : '🤝');
// Chance qu'un compliment marche : l'attirance (vêtements, parfum, coiffure, muscles...) et l'affection aident.
export const flirtChance = (attract, aff) => Math.max(0.12, Math.min(0.92, 0.2 + (attract / 100) * 0.6 + aff / 250));
export const FLIRT_YES = ['🥰 Oh... merci, c\'est trop mignon.', '😊 Tu sais parler, toi.', '😳 Tu me fais rougir !', '😄 Haha, t\'es drôle. J\'aime bien.', '💕 On pourrait se revoir, non ?'];
export const FLIRT_NO = ['😅 Euh... c\'est gentil mais non.', '🙄 Elle était nulle, celle-là.', '😐 Je suis pressé·e, désolé·e.', '🤨 Tu dis ça à tout le monde ?', '😬 Peut-être une autre fois...'];
