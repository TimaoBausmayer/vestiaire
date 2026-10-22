// MARCHÉS PROGRAMMÉS (Grande Place) : stands, vendeurs avec leur caractère, prix du jour, négociation.
// Tout est déterministe pour une occurrence du calendrier : client et autorité voient les mêmes stands.
import { mulberry32, hashString, shuffle } from './rng.js';

// Emplacements des stands sur la Grande Place (devant : vers le centre).
export const STALL_SLOTS = [
  { x: 19, z: -6, ry: -Math.PI / 2 }, { x: 19, z: -1, ry: -Math.PI / 2 }, { x: 19, z: 4, ry: -Math.PI / 2 }, { x: 19, z: 9, ry: -Math.PI / 2 },
  { x: -8, z: 20, ry: Math.PI }, { x: -3, z: 20, ry: Math.PI }, { x: 3, z: 20, ry: Math.PI }, { x: 8, z: 20, ry: Math.PI },
  { x: -19, z: -6, ry: Math.PI / 2 }, { x: -19, z: -1, ry: Math.PI / 2 }, { x: -19, z: 4, ry: Math.PI / 2 },
];
export const STALL_R = 3.2;

// Vendeurs : marchandise, caractère (remise maximale acceptée, patience), répliques.
export const VENDORS = {
  maraicher: { name: 'Gégé le Maraîcher', emoji: '🥕', color: '#6a994e', goods: ['pomme', 'legumes', 'tomates', 'oeufs', 'fromage', 'miel'], maxOff: 0.2, patience: 3,
    hello: 'Mes tomates ont vu le soleil, elles ! Pas comme celles du supermarché.', yes: 'Allez, pour vous, c\'est cadeau... presque.', no: 'Vous voulez ma ruine ? J\'ai six poules à nourrir !' },
  boulanger: { name: 'Mireille la Boulangère', emoji: '🥖', color: '#bc6c25', goods: ['baguette', 'croissant', 'pain-choc', 'eclair', 'sandwich'], maxOff: 0.12, patience: 2,
    hello: 'Tout chaud, tout beau ! Le pain de la veille est en promo, mais c\'est un secret.', yes: 'Bon, d\'accord. Mais ne le dites pas à mon four.', no: 'À ce prix-là, je vous donne la farine et vous le faites vous-même.' },
  fripiere: { name: 'Josiane la Fripière', emoji: '👕', color: '#b5838d', goods: ['casquette', 'bonnet', 'paille', 'bandeau', 'cowboy', 'lunettes-rondes', 'lunettes-soleil', 'lunettes-coeur', 'sombrero'], maxOff: 0.25, patience: 3,
    hello: 'Essayez, essayez ! Ça vous va à ravir. Enfin, presque tout.', yes: 'Vendu ! Vous avez l\'œil, vous.', no: 'Ah non, ma chérie, c\'est du vintage, ça se respecte.' },
  brocanteur: { name: 'Dédé la Brocante', emoji: '🪑', color: '#7f5539', goods: ['chaise', 'lampe', 'tapis', 'etagere', 'nain-jardin', 'table', 'radio', 'plante'], used: true, maxOff: 0.3, patience: 2,
    hello: 'Tout a une histoire ! Celle-ci, c\'est une lampe qui a vu Mamie Turbo en 1987.', yes: 'Marché conclu, serrons-nous la main. Pas trop fort, j\'ai de l\'arthrose.', no: 'Vous me prenez pour un pigeon ? Les pigeons, c\'est la Grande Place.' },
  garagiste: { name: 'Tonton Jéjé (accessoires auto)', emoji: '🔧', color: '#495057', goods: ['peinture', 'casque-moto'], maxOff: 0.15, patience: 2,
    hello: 'Une peinture neuve, et votre voiture se croira en vacances.', yes: 'Je vous fais ça en cinq minutes. Enfin, la facture.', no: 'Ce prix-là, c\'est pour les clients qui ont une voiture qui démarre.' },
  collectionneuse: { name: 'Mme Paillettes (objets rares)', emoji: '💎', color: '#3a0ca3', goods: ['couronne', 'trone', 'statue-poulet', 'piano', 'boule-disco', 'aquarium'], rare: true, maxOff: 0.08, patience: 1,
    hello: 'Pièces uniques, mon chou. Ici, on ne touche qu\'avec les yeux. Et le portefeuille.', yes: 'Soit. Vous avez du goût, c\'est rare.', no: 'Oh, non. On ne marchande pas l\'exceptionnel.' },
  glacier: { name: 'Lulu les Lampions (nocturne)', emoji: '🏮', color: '#ff9f1c', goods: ['glace', 'cocktail', 'popcorn', 'barre-choco', 'peluche-poulet'], maxOff: 0.15, patience: 2,
    hello: 'Ce soir, tout brille ! Même les prix. Surtout les prix.', yes: 'Allez, c\'est la fête !', no: 'Ah non, la nuit, les prix dorment. Ils ne bougent plus.' },
  fringues2: { name: 'Kévin Sapes (fins de série)', emoji: '🧢', color: '#3d8ee8', goods: ['casquette', 'bonnet', 'haut-de-forme', 'hélice', 'oreilles-lapin', 'lunettes-soleil', 'masque-plongee'], maxOff: 0.3, patience: 3,
    hello: 'Tout doit disparaître ! Comme mes économies.', yes: 'Deal ! Tu reviens quand tu veux.', no: 'Frère, là tu me fais pleurer.' },
};

// Marchés : stands présents, réduction de base (les prix du jour varient autour).
export const MARKETS = {
  alimentaire: { name: 'Marché alimentaire', vendors: ['maraicher', 'boulanger', 'maraicher', 'glacier'], discount: [0.05, 0.25] },
  vetements: { name: 'Marché aux vêtements', vendors: ['fripiere', 'fringues2', 'fripiere', 'garagiste'], discount: [0.1, 0.35] },
  occasion: { name: 'Marché d\'occasion', vendors: ['brocanteur', 'brocanteur', 'fripiere', 'garagiste', 'collectionneuse'], discount: [0.3, 0.55] },
  nocturne: { name: 'Marché nocturne', vendors: ['glacier', 'fringues2', 'maraicher', 'collectionneuse'], discount: [0.05, 0.3] },
  brocante: { name: 'Grande brocante du mois', vendors: ['brocanteur', 'brocanteur', 'brocanteur', 'fripiere', 'fringues2', 'collectionneuse', 'garagiste', 'maraicher'], discount: [0.35, 0.6] },
};

// Stands d'une occurrence : emplacement, vendeur, articles (prix du jour, quantité par client).
export function marketStalls(occ, marketId, items) {
  const M = MARKETS[marketId];
  const rand = mulberry32(hashString(`marche:${occ}`));
  const slots = shuffle(rand, STALL_SLOTS.map((s, i) => ({ ...s, i })));
  return M.vendors.map((vid, k) => {
    const V = VENDORS[vid];
    const goods = shuffle(rand, V.goods.filter((id) => items[id])).slice(0, V.rare ? 3 : 5);
    const offer = goods[Math.floor(rand() * goods.length)];
    return {
      id: `${vid}-${k}`, vendor: vid, slot: slots[k],
      items: goods.map((id) => {
        const base = items[id].price;
        let off = M.discount[0] + rand() * (M.discount[1] - M.discount[0]);
        if (V.rare) off = 0.05 + rand() * 0.15;
        if (id === offer) off = Math.min(0.7, off + 0.15);  // offre du jour
        return { id, base, price: Math.max(1, Math.round(base * (1 - off))), flash: id === offer, qty: items[id].consumable ? 6 : 2 };
      }),
    };
  });
}

// Négociation : remise demandée (0..0.5), essais déjà faits sur ce stand, réputation du joueur.
export function haggle(vendorId, off, tries, rep = 0) {
  const V = VENDORS[vendorId];
  if (tries >= V.patience) return { ok: false, done: true, say: 'Bon, on ne va pas y passer la journée. Le prix affiché, sinon rien !' };
  const max = Math.max(0, V.maxOff + Math.min(0.05, Math.max(0, rep) / 2000) - tries * 0.03);
  if (off <= max + 1e-9) return { ok: true, off, say: V.yes };
  return { ok: false, counter: Math.round(Math.max(0, max - 0.02) * 100) / 100, say: V.no };
}
