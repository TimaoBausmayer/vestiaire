// KARTING DU CIRCUIT TURBO-MAMIE : règles partagées (formules, adhésions, karts, tracé, chronos,
// pilotes PNJ). Les tours sont validés par l'autorité avec les positions qu'elle connaît.
import { CITY_POI } from './city.js';
import { mulberry32, shuffle } from './rng.js';

export const TRACK = CITY_POI.circuit;           // ovale arrondi : centre, demi-axes
// Point de la ligne médiane pour l'angle a (même formule que le décor du circuit).
export function trackPoint(a, C = TRACK) {
  const c = Math.cos(a), s = Math.sin(a);
  const k = 1 / Math.pow(Math.abs(c) ** 4 + Math.abs(s) ** 4, 0.25);
  return { x: C.x + c * k * C.rx, z: C.z + s * k * C.rz };
}
// Échantillonnage du tracé : longueur cumulée (on roule dans le sens des angles décroissants à
// partir de la ligne de départ, en bas de l'ovale : a = π/2).
const N = 360;
export const START_A = Math.PI / 2;
export const TRACK_SAMPLES = (() => {
  const pts = [];
  let len = 0, prev = null;
  for (let i = 0; i <= N; i++) {
    const a = START_A - (i / N) * Math.PI * 2;
    const p = trackPoint(a);
    if (prev) len += Math.hypot(p.x - prev.x, p.z - prev.z);
    pts.push({ ...p, s: len, a });
    prev = p;
  }
  return pts;
})();
export const TRACK_LENGTH = TRACK_SAMPLES[N].s;
// Position et cap sur le tracé à l'abscisse curviligne s (m), décalage latéral `lat` (m, + = extérieur).
export function trackAt(s, lat = 0) {
  s = ((s % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
  let lo = 0, hi = N;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TRACK_SAMPLES[m].s <= s) lo = m; else hi = m; }
  const a = TRACK_SAMPLES[lo], b = TRACK_SAMPLES[hi], k = (s - a.s) / Math.max(1e-6, b.s - a.s);
  const x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k;
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
  // normale vers l'extérieur de l'ovale
  let nx = dz / l, nz = -dx / l;
  if ((x - TRACK.x) * nx + (z - TRACK.z) * nz < 0) { nx = -nx; nz = -nz; }
  return { x: x + nx * lat, z: z + nz * lat, yaw: Math.atan2(dx, dz), curve: Math.abs(Math.cos(a.a)) > 0.75 ? 1 : 0 };
}
// Portes de chronométrage (dans l'ordre) : la porte 0 est la ligne de départ / arrivée.
export const GATES = Array.from({ length: 8 }, (_, i) => trackAt((i / 8) * TRACK_LENGTH));
export const GATE_R = 9;
export const MIN_LAP = 11;     // s : en dessous, le tour est impossible (triche)
export const RACE_LAPS = 4;
export const COUNTDOWN = 4;    // feux de départ (s)

export const KARTS = {
  kart: { name: 'Kart Loisir 270 cm³', need: null, extra: 0 },
  'kart-sport': { name: 'Kart Sport 390 cm³', need: 'mensuel', extra: 30 },
  'kart-pro': { name: 'Kart Pro 125 cm³ 2T', need: 'premium', extra: 0 },
};
export const MEMBERSHIPS = {
  decouverte: { name: 'Pass découverte', price: 120, days: 1, discount: 0.3, rank: 1, desc: '1 jour de jeu (4 h réelles) : −30 % sur les sessions.' },
  mensuel: { name: 'Adhésion mensuelle', price: 900, days: 28, discount: 0.5, rank: 2, desc: '1 mois de jeu (28 jours) : −50 %, Kart Sport, accès au championnat.' },
  premium: { name: 'Adhésion premium', price: 2200, days: 28, discount: 0.7, rank: 3, desc: '1 mois de jeu : −70 %, Kart Pro, championnat, chrono mis en avant.' },
};
// Formules (prix de base en PlayCoins, durée réelle en minutes).
export const FORMULAS = {
  libre: { name: 'Karting libre (découverte du circuit)', minutes: 5, price: 40, timed: false },
  'train-10': { name: 'Entraînement 10 min', minutes: 10, price: 70, timed: true },
  'train-15': { name: 'Entraînement 15 min', minutes: 15, price: 95, timed: true },
  'train-20': { name: 'Entraînement 20 min', minutes: 20, price: 120, timed: true },
};
// Courses : la course du jour (ouverte), le Grand Prix du vendredi et le championnat du mois.
export const RACES = {
  'course-jour': { name: 'Course du jour', laps: RACE_LAPS, fee: 60, prizes: [150, 80, 40], field: 5, levels: ['debutant', 'intermediaire', 'intermediaire', 'confirme', 'debutant'] },
  'kart-gp': { name: 'Grand Prix du vendredi', laps: 5, fee: 150, prizes: [900, 450, 220], field: 7, levels: ['intermediaire', 'confirme', 'confirme', 'expert', 'intermediaire', 'debutant', 'confirme'] },
  'kart-champ': { name: 'Championnat du mois', laps: 6, fee: 250, prizes: [2000, 1000, 500], field: 7, member: 'mensuel', levels: ['confirme', 'expert', 'expert', 'confirme', 'confirme', 'intermediaire', 'expert'] },
};
// Pilotes PNJ : vitesse moyenne (m/s), régularité, erreurs (tête-à-queue).
export const LEVELS = {
  debutant: { name: 'Débutant', speed: 11.2, spread: 0.07, mistake: 0.35 },
  intermediaire: { name: 'Intermédiaire', speed: 12.6, spread: 0.05, mistake: 0.18 },
  confirme: { name: 'Confirmé', speed: 13.8, spread: 0.035, mistake: 0.08 },
  expert: { name: 'Expert', speed: 14.9, spread: 0.02, mistake: 0.03 },
};
const DRIVERS = ['Mamie Turbo', 'Kevin', 'Coach Biscotte', 'Chloé la Biker', 'Momo', 'Lulu', 'Gérard', 'Paulette', 'Turbo Patrick', 'Josiane', 'Nono', 'Sandrine'];

// Grille et temps des pilotes PNJ pour une course (déterministe : client et autorité sont d'accord).
// laps[k] = temps cumulé à la fin du tour k+1 (s, depuis le départ).
export function raceField(seed, raceId) {
  const R = RACES[raceId], rand = mulberry32(seed);
  const names = shuffle(rand, DRIVERS);
  return R.levels.slice(0, R.field).map((lv, i) => {
    const L = LEVELS[lv];
    const laps = [], spins = [];
    let t = 0;
    for (let k = 0; k < R.laps; k++) {
      let lap = TRACK_LENGTH / (L.speed * (1 + (rand() * 2 - 1) * L.spread));
      if (k === 0) lap += 1.2 + i * 0.25;       // départ arrêté, depuis la grille
      const mistake = rand() < L.mistake ? 2 + rand() * 3 : 0;
      if (mistake) spins.push({ lap: k, dur: Math.round(mistake * 100) / 100, at: 0.25 + rand() * 0.5 });
      t += lap + mistake;
      laps.push(Math.round(t * 100) / 100);
    }
    return { name: names[i], level: lv, laps, spins, npc: true };
  });
}

// Prix d'une session pour ce joueur (adhésion, promotion du calendrier).
export function sessionPrice(base, member, promo = false) {
  const d = member ? MEMBERSHIPS[member.kind]?.discount || 0 : 0;
  const p = promo ? base * 0.5 : base;
  return Math.max(0, Math.round(p * (1 - d)));
}
export const memberOk = (member, need, now) => !need || (!!member && member.until > now && MEMBERSHIPS[member.kind].rank >= MEMBERSHIPS[need].rank);
export const fmtLap = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`);
