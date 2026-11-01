// PISCINE OLYMPIQUE : bassin de 50 m, 8 couloirs, courses de crawl (50 m, 100 m avec virage)
// contre 5 nageurs PNJ de ton niveau, ou nage libre (entraînement). Règles pures partagées.
import { mulberry32 } from './rng.js';

export const POOL = { x: 192, z: -466, L: 50, W: 20, lanes: 8, waterY: 0.95, deckY: 1.0 };
export const laneZ = (i) => POOL.z - POOL.W / 2 + POOL.W / POOL.lanes * (i + 0.5);   // couloir 0..7
export const SWIM_VMAX = 3.1;    // m/s : personne ne va plus vite (validation)
export const SWIM_RACES = {
  '50': { name: '50 m nage libre', dist: 50, fee: 10, prizes: [300, 150, 80] },
  '100': { name: '100 m nage libre (avec virage)', dist: 100, fee: 15, prizes: [650, 320, 160] },
  libre: { name: 'Nage libre (entraînement, 2 minutes)', dist: 0, fee: 5, prizes: [] },
};
const FIRST = ['Léon', 'Camille', 'Florent', 'Laure', 'Yannick', 'Coralie', 'Alain', 'Fanny', 'Michou', 'Gégé'];
const LAST = ['Marchand-de-Sable', 'Manaudou-Lou', 'Bernardo', 'Agnel-Pied', 'Grand-Bain', 'Bouée', 'Palme', 'Dauphin'];
// Adversaires : vitesse (m/s) selon ton niveau en natation (0..100).
export function swimField(race, seed, skill = 0) {
  const R = SWIM_RACES[race], r = mulberry32(seed), out = [];
  if (!R.dist) return out;
  const strength = 0.2 + Math.min(1, skill / 100) * 0.7;
  for (let i = 0; i < 5; i++) {
    const lvl = Math.max(0.05, Math.min(1.1, strength + (r() - 0.55) * 0.5));
    const v = 1.35 + lvl * 1.2;
    out.push({ name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`, v: Math.round(v * 100) / 100, time: Math.round(R.dist / v * 100) / 100 });
  }
  return out;
}
// Vitesse maximale du joueur selon son endurance et son niveau de nageur.
export const swimCap = (endurance = 15, skill = 0) => Math.min(SWIM_VMAX, 1.7 + endurance / 100 * 0.9 + skill / 100 * 0.5);
export const defaultSwim = () => ({ races: 0, wins: 0, podiums: 0, best: null, best100: null, skill: 0 });
