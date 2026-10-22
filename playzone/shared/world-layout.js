// Plan de la carte de PLAYZONE : données pures, partagées entre le client (qui construit le monde 3D)
// et le serveur (qui s'en sert pour vérifier les positions : livraisons, incendies, stands...).
// Repère : X vers l'est, Z vers le sud, Y vers le haut. Unité ≈ 1 mètre.
// Le centre historique (-128..128) est complété par la grande ville décrite dans city.js.
import { BOUNDS, STREETS, streetRect, CITY_ZONES, CITY_BUILDINGS, CITY_POI, PARKINGS, GAS_STATIONS } from './city.js';

export { STREETS, STREET_BY_ID, ROAD_GRAPH, findRoute, nearestRoadPoint, nearestNode, PARKINGS, GAS_STATIONS, CITY_POI } from './city.js';
export const WORLD_BOUNDS = BOUNDS;     // la carte va de -900 à 900 (X) et de -1000 à 140 (Z)
export const WORLD_HALF = 128;          // demi-taille du centre historique (ancien plan)
export const WATER_LEVEL = -0.35;       // niveau de la mer et de l'étang
export const SEA_SLOPE_START = 90;      // au sud de ce Z, le sol descend dans la mer
export const PORT_QUAY = { x: 140, z: 102 }; // à l'est de x=140, le port a un quai droit à z=102

export const POND = { x: -30, z: -112, r: 9 };

// Le point est-il dans les limites jouables ?
export function inBounds(x, z, margin = 0) {
  return x >= BOUNDS.minX - margin && x <= BOUNDS.maxX + margin && z >= BOUNDS.minZ - margin && z <= BOUNDS.maxZ + margin;
}

// Hauteur du sol (le terrain est plat sauf la mer, le port et l'étang).
export function groundHeight(x, z) {
  let h = 0;
  if (x > PORT_QUAY.x && x < 300 && z > 56) { if (z > PORT_QUAY.z) h = -4.5; }
  else if (z > SEA_SLOPE_START) h = -Math.min(4.5, (z - SEA_SLOPE_START) * 0.2);
  // côtes est et ouest : l'île plonge dans la mer
  const edge = Math.max(-x + BOUNDS.minX, x - BOUNDS.maxX);
  if (edge > 0) h = Math.min(h, -Math.min(4.5, edge * 0.35));
  const d = Math.hypot(x - POND.x, z - POND.z);
  if (d < POND.r) {
    // petite île au centre de l'étang (un canard doré s'y cache)
    h = d < 1.6 ? 0.15 : Math.min(h, -Math.min(2.2, (POND.r - d) * 0.55));
  }
  return h;
}

export function isWater(x, z) {
  return groundHeight(x, z) < WATER_LEVEL - 0.05;
}

// Zones nommées (affichées à l'écran quand on y entre). La première qui contient le point gagne.
export const ZONES = [
  { id: 'place', name: 'Grande Place', rect: [-24, -24, 24, 24] },
  { id: 'centre', name: 'Centre-ville', rect: [-60, -60, 60, 56] },
  { id: 'parc', name: 'Parc de loisirs', rect: [-60, -136, 60, -60] },
  { id: 'foret', name: 'Forêt des Grognons', rect: [-136, -136, -60, -60] },
  { id: 'industrie', name: 'Zone des Ateliers', rect: [60, -136, 136, -60] },
  { id: 'ferme', name: 'Ferme Bidoche', rect: [-136, -60, -60, 56] },
  { id: 'residentiel', name: 'Quartier des Mouettes', rect: [60, -60, 136, 56] },
  { id: 'port', name: 'Port Rigolo', rect: [40, 56, 136, 140] },
  { id: 'plage', name: 'Plage des Orteils', rect: [-136, 56, 136, 140] },
  ...CITY_ZONES,
];

export function zoneAt(x, z) {
  for (const zn of ZONES) {
    const [x1, z1, x2, z2] = zn.rect;
    if (x >= x1 && x <= x2 && z >= z1 && z <= z2) return zn;
  }
  return ZONES[1];
}

// Routes (rectangles de chaussée [x1, z1, x2, z2]) calculées à partir des rues de city.js.
export const RING = { inner: 24, outer: 32 };
export const ROADS = STREETS.map(streetRect);

// Bâtiments. door = point d'interaction devant la porte ; facing = direction de la façade.
// kind : shop | job | home | house | decor ; style sert uniquement au rendu.
export const BUILDINGS = [
  // --- Centre-ville, côté nord (façades vers le sud)
  { id: 'mairie', name: 'Mairie', kind: 'decor', interior: 'mairie', x: -20, z: -44, w: 26, d: 18, h: 12, facing: 'S', color: '#f2e6c9', roof: 'flat', roofColor: '#34407a', sign: 'MAIRIE', tower: true },
  { id: 'caserne', name: 'Caserne des Pompiers', kind: 'job', job: 'firefighter', interior: 'firestation', x: 20, z: -43, w: 22, d: 16, h: 9, facing: 'S', color: '#d8423a', roof: 'flat', roofColor: '#7a1f1a', sign: 'CASERNE', garageDoors: 2 },
  { id: 'cafe', name: 'Café du Pigeon Pensif', kind: 'shop', shop: 'cafe', interior: 'cafe', x: -45, z: -45, w: 15, d: 15, h: 7, facing: 'S', color: '#8fc9b9', roof: 'gable', roofColor: '#5a3d2b', sign: 'CAFÉ', awning: '#e4572e' },
  { id: 'banque', name: 'Banque PlayCoins', kind: 'service', interior: 'bank', x: 45, z: -45, w: 15, d: 15, h: 10, facing: 'S', color: '#e9d38b', roof: 'flat', roofColor: '#9c7a1c', sign: 'BANQUE PC', columns: true },
  // --- côté sud (façades vers le nord)
  { id: 'fringues', name: 'Fringues & Frites', kind: 'shop', shop: 'clothes', interior: 'shop', x: -18, z: 44, w: 20, d: 16, h: 8, facing: 'N', color: '#f49ac1', roof: 'flat', roofColor: '#a23b72', sign: 'FRINGUES & FRITES', awning: '#ffd23f' },
  { id: 'meubles', name: 'Meubles Mous', kind: 'shop', shop: 'furniture', interior: 'shop', x: 18, z: 44, w: 20, d: 16, h: 8, facing: 'N', color: '#c3b1e1', roof: 'flat', roofColor: '#5b4a8b', sign: 'MEUBLES MOUS', awning: '#2ec4b6' },
  { id: 'boulangerie', name: 'Boulangerie La Mie Câline', kind: 'shop', shop: 'bakery', interior: 'bakery', x: -45, z: 45, w: 15, d: 15, h: 7, facing: 'N', color: '#f6d6a8', roof: 'gable', roofColor: '#b5562d', sign: 'BOULANGERIE', awning: '#7b3f00' },
  { id: 'arcade', name: 'Salle d\'arcade Pixel', kind: 'service', interior: 'arcade', x: 45, z: 45, w: 15, d: 15, h: 7, facing: 'N', color: '#2b2d6e', roof: 'flat', roofColor: '#ff3fa4', sign: 'ARCADE', neon: true },
  // --- côté ouest (façades vers l'est)
  { id: 'burger', name: 'Le Burger Absurde', kind: 'job', job: 'cook', shop: 'burger', interior: 'fastfood', x: -44, z: -18, w: 18, d: 20, h: 8, facing: 'E', color: '#ffb547', roof: 'flat', roofColor: '#c4471f', sign: 'BURGER ABSURDE', awning: '#d62828' },
  { id: 'animalerie', name: 'Animalerie Poil-Poil', kind: 'shop', shop: 'pets', interior: 'shop', x: -44, z: 18, w: 18, d: 20, h: 8, facing: 'E', color: '#9ad17c', roof: 'gable', roofColor: '#3c6e2f', sign: 'ANIMALERIE', awning: '#f4a259' },
  // --- côté est (façades vers l'ouest)
  { id: 'colis', name: 'Colis Express', kind: 'job', job: 'delivery', interior: 'warehouse', x: 44, z: -18, w: 18, d: 20, h: 8, facing: 'W', color: '#ffd23f', roof: 'flat', roofColor: '#2d3a8c', sign: 'COLIS EXPRESS', garageDoors: 1 },
  { id: 'garage', name: 'Garage Roule-Toujours', kind: 'shop', shop: 'vehicles', interior: 'workshop', x: 44, z: 18, w: 18, d: 20, h: 8, facing: 'W', color: '#9aa5b1', roof: 'flat', roofColor: '#3b4252', sign: 'GARAGE', garageDoors: 2 },
  // --- Quartier des Mouettes
  { id: 'residence', name: 'Résidence Les Mouettes', kind: 'home', x: 72, z: 22, w: 18, d: 16, h: 16, facing: 'N', color: '#7fb7e6', roof: 'flat', roofColor: '#2f5d8a', sign: 'RÉSIDENCE LES MOUETTES', floors: 5 },
  // --- Ferme
  { id: 'grange', name: 'Grange Bidoche', kind: 'decor', interior: 'barn', x: -95, z: -25, w: 20, d: 16, h: 10, facing: 'S', color: '#b8322a', roof: 'gable', roofColor: '#5b2a1e', sign: 'FERME BIDOCHE', barn: true },
  { id: 'fermette', name: 'Maison du fermier', kind: 'decor', interior: 'house', x: -118, z: -24, w: 12, d: 10, h: 6, facing: 'E', color: '#efe3c2', roof: 'gable', roofColor: '#7a4b2a' },
  // --- Zone des Ateliers
  { id: 'entrepot1', name: 'Entrepôt Bric-à-Brac', kind: 'decor', interior: 'warehouse', x: 79, z: -96, w: 24, d: 18, h: 10, facing: 'S', color: '#8d99ae', roof: 'gable', roofColor: '#4a5568', sign: 'ATELIERS' },
  { id: 'entrepot2', name: 'Atelier Boulon', kind: 'decor', interior: 'workshop', x: 112, z: -88, w: 16, d: 22, h: 8, facing: 'W', color: '#b0a18f', roof: 'flat', roofColor: '#5a4e41', garageDoors: 1 },
  // --- Cabane secrète
  { id: 'cabane', name: 'Cabane mystérieuse', kind: 'decor', interior: 'cabin', x: -112, z: -112, w: 7, d: 6, h: 4, facing: 'E', color: '#6b4f3a', roof: 'gable', roofColor: '#3a2a1e', secret: true },
];

// Maisons du quartier : ce sont les adresses de livraison. Porte et façade calculées automatiquement.
const HOUSE_DEFS = [
  ['1 avenue des Mouettes', 64, -14, 'S'], ['3 avenue des Mouettes', 80, -14, 'S'],
  ['7 avenue des Mouettes', 110, -14, 'S'], ['9 avenue des Mouettes', 122, -14, 'S'],
  ['4 avenue des Mouettes', 87, 14, 'N'], ['8 avenue des Mouettes', 110, 14, 'N'],
  ['10 avenue des Mouettes', 122, 14, 'N'],
  ['2 rue du Crapaud', 86, -32, 'E'], ['4 rue du Crapaud', 86, -48, 'E'],
  ['1 rue du Crapaud', 106, -32, 'W'], ['3 rue du Crapaud', 106, -48, 'W'],
  ['6 rue du Crapaud', 86, 32, 'E'], ['8 rue du Crapaud', 86, 48, 'E'],
  ['5 rue du Crapaud', 106, 32, 'W'], ['7 rue du Crapaud', 106, 48, 'W'],
];
const HOUSE_COLORS = ['#f4d35e', '#ee964b', '#83c5be', '#e5989b', '#b5e48c', '#a2d2ff', '#ffc8dd', '#cdb4db'];
HOUSE_DEFS.forEach(([name, x, z, facing], i) => {
  BUILDINGS.push({
    id: `maison${i + 1}`, name, kind: 'house', interior: 'house', x, z, w: 10, d: 10, h: 5.5, facing,
    color: HOUSE_COLORS[i % HOUSE_COLORS.length], roof: 'gable', roofColor: ['#8c3b2f', '#3d5a80', '#6b4226', '#2a6f4e'][i % 4],
  });
});

// Bâtiments de la grande ville (affaires, commerces, Tilleuls, industrie, campagne...).
for (const b of CITY_BUILDINGS) BUILDINGS.push(b);

const FACING_VEC = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
export function facingVector(f) { return FACING_VEC[f]; }

// Point devant la porte d'un bâtiment (à 1,5 m de la façade).
for (const b of BUILDINGS) {
  const [fx, fz] = FACING_VEC[b.facing];
  const half = (fx !== 0 ? b.w : b.d) / 2;
  b.door = { x: b.x + fx * (half + 1.5), z: b.z + fz * (half + 1.5) };
}

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

// Bâtiment dont l'emprise contient le point (marge négative = à l'intérieur des murs).
export function buildingAt(x, z, margin = 0) {
  for (const b of BUILDINGS) if (Math.abs(x - b.x) < b.w / 2 + margin && Math.abs(z - b.z) < b.d / 2 + margin) return b;
  return null;
}

// Adresses de livraison : toutes les maisons + quelques lieux éloignés pour les missions longues.
export const ADDRESSES = [
  ...BUILDINGS.filter((b) => b.kind === 'house' && !b.district).map((b) => ({ id: b.id, name: b.name, x: b.door.x, z: b.door.z })),
  { id: 'grange', name: 'Grange Bidoche (Ferme)', x: BUILDING_BY_ID.grange.door.x, z: BUILDING_BY_ID.grange.door.z },
  { id: 'fermette', name: 'Maison du fermier', x: BUILDING_BY_ID.fermette.door.x, z: BUILDING_BY_ID.fermette.door.z },
  { id: 'cafe', name: 'Café du Pigeon Pensif', x: BUILDING_BY_ID.cafe.door.x, z: BUILDING_BY_ID.cafe.door.z },
  { id: 'boulangerie', name: 'Boulangerie La Mie Câline', x: BUILDING_BY_ID.boulangerie.door.x, z: BUILDING_BY_ID.boulangerie.door.z },
  { id: 'phare', name: 'Cabane du gardien de plage', x: -20, z: 74 },
  { id: 'ponton', name: 'Bout du ponton', x: 52, z: 118 },
  { id: 'atelier', name: 'Atelier Boulon', x: BUILDING_BY_ID.entrepot2.door.x, z: BUILDING_BY_ID.entrepot2.door.z },
];
export const ADDRESS_BY_ID = Object.fromEntries(ADDRESSES.map((a) => [a.id, a]));

// Points d'incendie possibles (façade du bâtiment, à mi-hauteur).
export const FIRE_SPOTS = BUILDINGS
  .filter((b) => !b.district && (b.kind === 'house' || ['cafe', 'boulangerie', 'banque', 'grange', 'arcade', 'fermette'].includes(b.id)))
  .map((b) => {
    const [fx, fz] = FACING_VEC[b.facing];
    const half = (fx !== 0 ? b.w : b.d) / 2;
    return { id: b.id, name: b.name, x: b.x + fx * (half + 0.2), y: b.h * 0.55, z: b.z + fz * (half + 0.2) };
  });
export const FIRE_SPOT_BY_ID = Object.fromEntries(FIRE_SPOTS.map((f) => [f.id, f]));

// Arbres du parc où un chat peut rester coincé (mission pompier).
export const CAT_TREES = [
  { id: 'arbre-parc-1', x: -8, z: -70 }, { id: 'arbre-parc-2', x: 52, z: -66 },
  { id: 'arbre-place', x: 16, z: 16 }, { id: 'arbre-plage', x: -60, z: 70 },
  { id: 'arbre-mouettes', x: 75, z: -56 },
];
export const CAT_TREE_BY_ID = Object.fromEntries(CAT_TREES.map((t) => [t.id, t]));

// Lieux importants.
export const POI = {
  spawn: { x: 0, z: 12, ry: Math.PI },
  fountain: { x: 0, z: 0, r: 4.5 },
  djStage: { x: 0, z: -18 },
  danceFloor: { x: 0, z: -9, w: 14, d: 7 },
  eventBoard: { x: 13, z: -15 },
  foodTruck: { x: -15, z: 13 },          // poste du métier cuisinier
  foodCounter: { x: -12.4, z: 13 },      // comptoir (côté est du camion)
  depot: { x: BUILDING_BY_ID.colis.door.x, z: BUILDING_BY_ID.colis.door.z },
  fireStation: { x: BUILDING_BY_ID.caserne.door.x, z: BUILDING_BY_ID.caserne.door.z },
  homeDoor: { x: BUILDING_BY_ID.residence.door.x, z: BUILDING_BY_ID.residence.door.z },
  parkGate: { x: 0, z: -64 },
  beachParty: { x: 0, z: 80 },
  pier: { x: 52, z1: 84, z2: 124, w: 8 },
  trampoline: { x: 55, z: 50, targetY: 7.3 },
  ...CITY_POI,
};

// Stands de mini-jeux.
export const MINIGAME_SPOTS = {
  pieToss: { x: -30, z: -73, targets: { x1: -42, z1: -98, x2: -18, z2: -84 } },
  chickenRace: { x: 0, z: -88, pen: { x: 0, z: -101, w: 26, d: 20 }, basket: { x: 0, z: -101 } },
  obstacle: {
    x: 26, z: -70,
    // checkpoints du parcours (anneaux à traverser dans l'ordre)
    checkpoints: [
      { x: 26, z: -80, y: 0 }, { x: 26, z: -96, y: 0 }, { x: 34, z: -112, y: 3.2 },
      { x: 48, z: -116, y: 0 }, { x: 48, z: -98, y: 0 }, { x: 48, z: -80, y: 0 },
    ],
  },
};

// Intérieur du logement : en dehors de la carte, chaque joueur y voit SA maison (ou celle d'un ami qui l'invite).
export const HOME_INTERIOR = {
  origin: { x: 1000, z: 0 },
  sizes: { studio: { w: 14, d: 10 }, appart: { w: 20, d: 14 } },
  spawn: { x: 1000, z: 3 },
};

// Canards dorés cachés (objets secrets).
export const SECRETS = [
  { id: 'canard-mairie', x: -20, z: -57, y: 0.4, hint: 'Derrière un bâtiment très officiel.' },
  { id: 'canard-toit', x: 47, z: 47, y: 7.4, hint: 'Les rebonds mènent parfois très haut.' },
  { id: 'canard-ponton', x: 56, z: 123, y: 0.9, hint: 'Au bout de ce qui avance dans l\'eau.' },
  { id: 'canard-cabane', x: -109, z: -112, y: 0.4, hint: 'Une cabane que personne n\'avoue avoir construite.' },
  { id: 'canard-mais', x: -120, z: 52, y: 0.4, hint: 'Perdu dans les cultures.' },
  { id: 'canard-ile', x: -30, z: -112, y: 0.55, hint: 'Sur une île minuscule.' },
  { id: 'canard-grande-roue', x: -56, z: -122, y: 0.4, hint: 'Derrière ce qui tourne sans jamais avancer.' },
  { id: 'canard-jardin', x: 120, z: -56, y: 0.4, hint: 'Au fond d\'un jardin de banlieue.' },
  { id: 'canard-ateliers', x: 102, z: -129, y: 0.4, hint: 'Entre deux tôles.' },
  { id: 'canard-plage', x: -118, z: 88, y: 0.4, hint: 'Au bout du monde... enfin, de la plage.' },
];
export const SECRET_BY_ID = Object.fromEntries(SECRETS.map((s) => [s.id, s]));


export function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
