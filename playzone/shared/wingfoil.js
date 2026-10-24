// WINGFOIL : vent (météo marine), règles de glisse et de sauts. Partagé client / autorité.
// Le vent change avec l'heure du jeu (brise thermique l'après-midi) et d'un jour à l'autre.
import { HOUR_MS, gameDay, gameHour } from './clock.js';
import { mulberry32 } from './rng.js';

export const MIN_WIND = 10;          // nœuds : en dessous, l'aile ne porte pas
export const SURF_SPOT = { x: 430, z: 112 };    // mise à l'eau, devant le Surf Shop (Côte des Villas)
export const WING = { rental: 60, price: 1800, maxSpeed: 12, foilBoost: 1.6 };   // en vol, le foil va bien plus vite

// Vent à un instant (heure du jeu) : { kts, dir } — dir = d'où vient le vent (radians, 0 = du nord).
export function windAt(t) {
  const day = gameDay(t), hour = gameHour(t);
  const r = mulberry32(day * 7919 + 13);
  const base = 4 + r() * 16;                         // jour calme ... jour venteux
  const thermal = Math.max(0, Math.sin(((hour - 9) / 12) * Math.PI)) * (6 + r() * 8);   // brise de l'après-midi
  const gust = Math.sin(t / (HOUR_MS * 0.37)) * 2 + Math.sin(t / 47_000) * 1.5;
  const kts = Math.max(0, Math.round((base + thermal + gust) * 10) / 10);
  const dir = (r() * 0.9 + 1.2) + Math.sin(t / (HOUR_MS * 3)) * 0.25;   // plutôt du sud-ouest / ouest
  return { kts, dir };
}
export function windLabel(kts) {
  return kts < 6 ? 'pétole (pas de vent)' : kts < MIN_WIND ? 'petite brise (trop faible)' : kts < 16 ? 'bon vent' : kts < 24 ? 'vent fort' : 'tempête de fun';
}
// Prévisions des prochaines heures (pour la boutique et l'appli).
export function forecast(t, hours = 6) { return Array.from({ length: hours }, (_, i) => ({ h: Math.floor(gameHour(t + i * HOUR_MS)), ...windAt(t + i * HOUR_MS) })); }

// Hauteur maximale crédible d'un saut selon le vent.
export const maxJump = (kts) => 2 + kts * 0.28;
// points d'un saut : hauteur, rotations (360) et flips (salto avant / arrière), bonus pour les combos
export function jumpPoints(height, spins, flips = 0) { return Math.round(height * 10 + spins * 40 + (spins >= 2 ? 30 : 0) + flips * 60 + (spins && flips ? 50 : 0)); }
export function defaultWing() { return { sessions: 0, trial: false, best: 0, bestPoints: 0, jumps: 0, skill: 5 }; }
