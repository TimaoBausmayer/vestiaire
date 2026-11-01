// MINI-GOLF « Le Trou Rigolo » : 9 trous dans une grille 3 × 3. Chaque trou = un green rectangulaire
// (repère local, centré sur la case), un départ, un trou, des obstacles (blocs rectangulaires,
// bumpers ronds, moulin qui tourne). Le client simule la balle ; l'autorité valide la carte de score.
export const GOLF = { x: 510, z: -70, w: 66, d: 48, cellW: 22, cellD: 16, fee: 10, greenY: 0.15 };
// case (i = 0..8) → centre dans le monde
export const holeCenter = (i) => ({ x: GOLF.x - GOLF.w / 2 + GOLF.cellW * (i % 3 + 0.5), z: GOLF.z - GOLF.d / 2 + GOLF.cellD * (Math.floor(i / 3) + 0.5) });
// green : [demi-largeur x, demi-longueur z] ; tee / cup : position locale ; blocks : [cx, cz, hw, hd] ; bumpers : [cx, cz, r]
export const HOLES = [
  { name: 'La Ligne Droite', par: 2, green: [2, 6.5], tee: [0, 5.5], cup: [0, -5.5], blocks: [], bumpers: [] },
  { name: 'Le Rocher', par: 2, green: [2.5, 6.5], tee: [0, 5.5], cup: [0, -5.5], blocks: [[0, 0, 1, 0.6]], bumpers: [] },
  { name: 'Le Zigzag', par: 3, green: [3, 6.5], tee: [-1.8, 5.5], cup: [1.8, -5.5], blocks: [[-0.9, 2, 2.1, 0.25], [0.9, -2, 2.1, 0.25]], bumpers: [] },
  { name: 'Le Flipper', par: 3, green: [3.5, 6.5], tee: [0, 5.5], cup: [0, -5.6], blocks: [], bumpers: [[-1.4, 2, 0.5], [1.3, 0.5, 0.5], [-0.6, -1.2, 0.55], [1.6, -3, 0.45], [-1.8, -3.6, 0.4]] },
  { name: 'Le Chas de l\'Aiguille', par: 2, green: [3, 6.5], tee: [0, 5.5], cup: [0, -5.5], blocks: [[-1.75, 0, 1.3, 0.25], [1.75, 0, 1.3, 0.25]], bumpers: [] },
  { name: 'Le Coude', par: 3, green: [4, 6.5], tee: [-2.8, 5.5], cup: [2.8, -5.5], blocks: [[1.3, 1.6, 2.7, 4.9]], bumpers: [] },
  { name: 'Le Labyrinthe', par: 3, green: [3.5, 6.5], tee: [-2.5, 5.5], cup: [2.5, -5.5], blocks: [[-1, 3, 2.5, 0.2], [1, 0, 2.5, 0.2], [-1, -3, 2.5, 0.2]], bumpers: [] },
  { name: 'Les Deux Portes', par: 3, green: [3, 6.5], tee: [2, 5.5], cup: [-2, -5.5], blocks: [[-1.2, 2.5, 1.8, 0.25], [1.2, -2, 1.8, 0.25]], bumpers: [[0, 0.3, 0.45]] },
  { name: 'Le Moulin', par: 3, green: [3, 6.5], tee: [0, 5.5], cup: [0, -5.6], blocks: [[-1.9, -1, 1.1, 0.4], [1.9, -1, 1.1, 0.4]], bumpers: [], mill: { cz: -1, len: 2.4, speed: 1.6 } },
];
export const PAR = HOLES.reduce((s, h) => s + h.par, 0);
export const MAX_STROKES = 6;
export const defaultGolf = () => ({ rounds: 0, best: null, aces: 0 });
// Prime : sous le par → 100 PC + 20 par coup de moins ; chaque trou en un coup : +50 PC.
export const golfPrize = (total, aces) => (total <= PAR ? 100 + (PAR - total) * 20 : 0) + aces * 50;
