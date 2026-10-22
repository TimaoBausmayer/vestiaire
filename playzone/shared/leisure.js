// LOISIRS : stand de tir (les armes ne s'utilisent QUE dans les lieux prévus).
// Règles pures, partagées entre le client et l'autorité (qui valide les tirs avec son horloge).
import { mulberry32, randInt, shuffle } from './rng.js';

// ------------------------------------------------------------------------------------- stand de tir
export const RANGE = {
  fee: 25,          // séance d'entraînement (arme de location + munitions comprises)
  duration: 40,     // secondes de tir
  countdown: 3,
  lanes: 4,
  compet: { fee: 100, prizes: [600, 300, 150], rivals: 7 },
};
export const RANGE_WEAPONS = {
  pistolet: { name: 'Pistolet de tir 9 mm', ammo: 36, cooldown: 0.28, sway: 0.010, icon: '🔫' },
  carabine: { name: 'Carabine .22 à lunette', ammo: 24, cooldown: 0.55, sway: 0.004, zoom: 1.9, icon: '🎯' },
};
// Points selon l'anneau touché (rapport distance au centre / rayon de la cible).
export const RING_POINTS = [[0.2, 10], [0.45, 7], [0.75, 4], [1.01, 2]];
export const ringPoints = (ratio) => (RING_POINTS.find(([r]) => ratio <= r) || [0, 0])[1];
export const HOSTAGE_PENALTY = -15;

// Cibles d'une séance : apparition (s après le top départ), durée visible, couloir, profondeur (0 = près,
// 1 = au fond), décalage latéral, mouvement, type (cible ronde, silhouette, otage à NE PAS toucher).
export function rangeTargets(seed, duration = RANGE.duration) {
  const rand = mulberry32(seed);
  const out = [];
  let t = 0.6;
  let i = 0;
  while (t < duration - 1.2) {
    const kind = rand() < 0.14 ? 'otage' : rand() < 0.45 ? 'silhouette' : 'cible';
    const depth = rand();
    out.push({
      i: i++, t: Math.round(t * 100) / 100, d: Math.round((2.6 - depth * 0.8 + rand() * 0.8) * 100) / 100,
      lane: randInt(rand, 0, RANGE.lanes - 1), depth: Math.round(depth * 100) / 100,
      off: Math.round((rand() - 0.5) * 100) / 100, move: rand() < 0.3 ? (rand() < 0.5 ? -1 : 1) : 0, kind,
    });
    t += 0.55 + rand() * 0.75;
  }
  return out;
}
// Score maximal possible (pour borner les déclarations).
export const rangeMax = (targets) => targets.filter((x) => x.kind !== 'otage').length * 10;

// La cible est-elle visible à l'instant `t` (avec une marge pour la latence réseau) ?
export const targetVisible = (tg, t, slack = 0) => t >= tg.t - slack && t <= tg.t + tg.d + slack;

// Rivaux PNJ de la compétition du jour : leur niveau s'adapte à celui du joueur (record personnel), pour
// que la compétition reste disputée. Ce sont des PNJ, affichés comme tels.
export const RIVAL_NAMES = ['Dédé la Gâchette', 'Mamie Turbo', 'Sergent Biscotte', 'Kevin', 'Lulu l\'Œil de Lynx', 'Gérard', 'Paulette', 'Le Maire', 'Josiane', 'Momo'];
export function rangeRivals(seed, best, n = RANGE.compet.rivals) {
  const rand = mulberry32(seed ^ 0x5bd1e995);
  const base = Math.max(60, Math.min(260, best || 90));
  const names = shuffle(rand, [...RIVAL_NAMES]).slice(0, n);
  return names.map((name) => ({ name, npc: true, score: Math.max(10, Math.round(base * (0.62 + rand() * 0.6))) }));
}
// Prix selon le classement (1er, 2e, 3e).
export const rangePrize = (rank) => RANGE.compet.prizes[rank - 1] || 0;
