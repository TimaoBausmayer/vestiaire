// EXERCICES PARTOUT (appli Sport) : 8 exercices sans matériel, chacun avec sa façon de jouer :
// tap (appuyer vite), alt (alterner gauche / droite), hold (tenir l'équilibre), beat (en rythme).
// Niveaux par exercice, records, programme du jour (3 exercices, même pour tout le monde ce jour-là).
import { mulberry32, hashString } from './rng.js';

export const EXOS = {
  pompes: { name: 'Pompes', emoji: '💪', mode: 'tap', pose: 'pushup', per: 6, rate: 1.6, gain: { muscle: 0.06, endurance: 0.01, energie: -0.4 }, unit: 'reps' },
  squats: { name: 'Squats', emoji: '🦵', mode: 'tap', pose: 'squat', per: 5, rate: 1.8, gain: { muscle: 0.05, endurance: 0.02, weight: -0.01, energie: -0.35 }, unit: 'reps' },
  burpees: { name: 'Burpees', emoji: '🔥', mode: 'tap', pose: 'burpee', per: 9, rate: 0.9, gain: { muscle: 0.07, endurance: 0.05, weight: -0.03, energie: -0.8 }, unit: 'reps' },
  jacks: { name: 'Jumping jacks', emoji: '⭐', mode: 'alt', pose: 'jacks', per: 2, rate: 3, gain: { muscle: 0.01, endurance: 0.03, weight: -0.015, energie: -0.25 }, unit: 'reps' },
  abdos: { name: 'Abdos (crunchs)', emoji: '🍫', mode: 'alt', pose: 'situp', per: 2, rate: 2, gain: { muscle: 0.045, weight: -0.008, energie: -0.3 }, unit: 'reps' },
  gainage: { name: 'Gainage (planche)', emoji: '🧱', mode: 'hold', pose: 'plank', gain: { muscle: 0.025, endurance: 0.02, energie: -0.25 }, unit: 'secs' },
  etirements: { name: 'Étirements', emoji: '🙆', mode: 'hold', pose: 'stretch', gain: { muscle: 0.004, humeur: 0.6, energie: 0.15 }, unit: 'secs' },
  corde: { name: 'Corde à sauter', emoji: '🪢', mode: 'beat', pose: 'rope', period: 0.5, window: 0.14, rate: 2.2, gain: { endurance: 0.04, weight: -0.02, muscle: 0.01, energie: -0.3 }, unit: 'reps' },
};
export const EXO_IDS = Object.keys(EXOS);
// Niveau d'un exercice : 0 → 10, selon l'XP cumulée (1 XP par répétition / seconde tenue).
export const EXO_LEVELS = [0, 30, 80, 160, 280, 450, 680, 980, 1350, 1800, 2400];
export const exoLevel = (xp = 0) => { let l = 0; while (l + 1 < EXO_LEVELS.length && xp >= EXO_LEVELS[l + 1]) l++; return l; };
// Appuis par répétition : moins quand on est musclé·e et quand on progresse dans l'exercice.
export const tapsPer = (exo, muscle = 30, lvl = 0) => Math.max(2, Math.round(EXOS[exo].per - muscle / 25 - lvl * 0.25));
// Programme du jour : 3 exercices et leurs objectifs (identique pour tout le monde ce jour-là).
export function dailyProgram(dayKey) {
  const r = mulberry32(hashString(`sport-${dayKey}`));
  const ids = [...EXO_IDS].sort(() => r() - 0.5).slice(0, 3);
  return ids.map((id) => ({ id, target: EXOS[id].unit === 'secs' ? 20 + Math.floor(r() * 4) * 10 : 10 + Math.floor(r() * 4) * 5 }));
}
export const PROGRAM_BONUS = { coins: 150, xp: 60 };
export const defaultWorkout = () => ({ xp: {}, best: {}, total: {}, day: null, done: {}, streak: 0, lastFull: null, sessions: 0 });
