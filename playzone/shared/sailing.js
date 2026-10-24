// VOILE ET KITESURF au Club du Cap Venteux : un spot réputé pour son vent (toujours 15 nœuds et plus).
// Dériveurs de régate (Optimist, ILCA 6, Laser/ILCA 7, 420, 29er, 49er) et kitesurf. Règles partagées
// client / autorité : caractéristiques des supports, prix, location, adhésion.
//   max : vitesse max (m/s) · eff : rendement de la voile · stiff : raideur (résiste à la gîte)
//   hike : rappel / trapèze (réduit la gîte) · turn : vivacité · crew : équipiers · minSkill : niveau conseillé
export const CLUB = { x: -2380, z: 84 };                       // club-house (sur le quai du port)
export const SAIL_SPOT = { x: -2350, z: 230 };                 // plan d'eau devant le port
export const BOATS = {
  optimist: { name: 'Optimist', emoji: '⛵', len: 2.3, mast: 2.6, max: 5.5, eff: 0.55, stiff: 1.8, hike: 0.2, turn: 1.6, crew: 1, rent: 30, price: 1800, color: '#f8f9fa', sail: '#f4f1ea', desc: 'La petite caisse à savon pour débuter : stable, lente, impossible à rater.' },
  ilca6: { name: 'ILCA 6 (Laser Radial)', emoji: '⛵', len: 4.2, mast: 5.3, max: 8, eff: 0.7, stiff: 0.9, hike: 0.55, turn: 1.3, crew: 1, rent: 60, price: 5200, color: '#f8f9fa', sail: '#ffffff', desc: 'Le dériveur olympique en solitaire, version voile réduite : physique et précis.' },
  laser: { name: 'Laser (ILCA 7)', emoji: '⛵', len: 4.2, mast: 5.8, max: 8.8, eff: 0.74, stiff: 0.8, hike: 0.6, turn: 1.3, crew: 1, rent: 70, price: 5800, color: '#f8f9fa', sail: '#ffffff', desc: 'Grande voile pleine : plus rapide, mais il faut rappeler fort (Espace) dans la brise.' },
  '420': { name: '420', emoji: '⛵', len: 4.2, mast: 6.3, max: 9, eff: 0.76, stiff: 1, hike: 0.7, turn: 1.25, crew: 2, rent: 90, price: 8500, color: '#3a86ff', sail: '#f8f9fa', jib: true, desc: 'Le dériveur en double : barreur + équipier au trapèze, foc et spi.' },
  '29er': { name: '29er', emoji: '⛵', len: 4.4, mast: 6.3, max: 12.5, eff: 0.86, stiff: 0.7, hike: 0.85, turn: 1.4, crew: 2, rent: 140, price: 16000, color: '#e63946', sail: '#14141c', jib: true, level: 6, desc: 'Skiff de jeunes champions : planant, nerveux, double trapèze.' },
  '49er': { name: '49er', emoji: '🏁', len: 4.99, mast: 8.1, max: 16, eff: 0.95, stiff: 0.6, hike: 1, turn: 1.45, crew: 2, rent: 220, price: 32000, color: '#ffd23f', sail: '#14141c', jib: true, level: 10, desc: 'Le skiff olympique : une fusée qui dessale à la moindre erreur.' },
  kite: { name: 'Kitesurf (aile 9 m² + planche)', emoji: '🪂', len: 1.4, mast: 0, max: 15, eff: 0.9, stiff: 1.2, hike: 0.5, turn: 1.9, crew: 1, rent: 80, price: 2600, kite: true, color: '#ff9f1c', sail: '#ff3fa4', desc: 'Tracté par une aile de traction : vitesse et sauts géants (Espace, souris en l\'air).' },
};
export const BOAT_IDS = Object.keys(BOATS);
export const SAIL_MEMBER = { name: 'Licence du Club du Cap Venteux', price: 600, days: 7 };   // tous les bateaux du club en libre accès
export const SAIL_JUMP_MUL = 1.5;   // le kite saute plus haut que le wingfoil
export function defaultSail() { return { sessions: 0, trials: [], member: null, best: 0, bestPoints: 0, jumps: 0, skill: 5, capsizes: 0 }; }

// Bateaux vendus à la voilerie (on peut ensuite naviguer partout où il y a de l'eau, sans location).
export const SAIL_ITEMS = Object.entries(BOATS).map(([id, b]) => ({ id: `bateau-${id}`, boat: id, name: b.kite ? b.name : `Dériveur ${b.name}`, shop: 'voile', special: true, price: b.price, emoji: b.emoji, desc: b.desc, max: 1, ...(b.level ? { level: b.level } : {}) }));
export const ownsBoat = (p, id) => (p.inventory?.[`bateau-${id}`] || 0) > 0;

// Polaire simplifiée : puissance de la voile selon l'angle au vent (0 = face au vent).
export function sailPower(off, kite = false) {
  const dead = kite ? 0.85 : 0.75;                  // zone morte (« bout au vent ») : ~45°
  if (off < dead) return 0;
  if (off < 1.2) return 0.55 + (off - dead) / (1.2 - dead) * 0.3;   // près
  if (off < 2.0) return 0.85 + Math.sin((off - 1.2) / 0.8 * Math.PI) * 0.15;   // travers / largue
  return 0.85 - (off - 2.0) / 1.14 * (kite ? 0.45 : 0.25);         // grand largue / vent arrière
}
