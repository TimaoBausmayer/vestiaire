// Logique déterministe des mini-jeux et des événements : à partir d'une graine, client et serveur
// calculent exactement les mêmes cibles, poulets et positions. Le serveur peut donc vérifier chaque
// action (une cible touchée existait-elle vraiment à ce moment ? le poulet était-il là ?).
import { mulberry32, range } from './rng.js';
import { MINIGAME_SPOTS, POI } from './world-layout.js';

// ---------- Bataille de tartes : planning des cibles
export function pieTargets(seed, duration = 40, count = 40) {
  const rand = mulberry32(seed);
  const T = MINIGAME_SPOTS.pieToss.targets;
  const list = [];
  for (let i = 0; i < count; i++) {
    const t = 1 + (i / count) * (duration - 3) + range(rand, -0.4, 0.4);
    const r = rand();
    const type = r < 0.12 ? 'gold' : r < 0.27 ? 'mamie' : 'normal';
    const row = Math.floor(rand() * 3);
    list.push({
      i, t: Math.max(0.5, t), d: type === 'gold' ? 1.8 : 2.8 + rand() * 1.2, type,
      x: range(rand, T.x1 + 2, T.x2 - 2), z: T.z1 + 3 + row * ((T.z2 - T.z1 - 6) / 2),
      vx: rand() < 0.5 ? 0 : range(rand, -3, 3),
    });
  }
  return list;
}

export function pieTargetPos(tg, t) {
  const T = MINIGAME_SPOTS.pieToss.targets;
  let x = tg.x + tg.vx * (t - tg.t);
  // rebond sur les bords
  const span = T.x2 - T.x1 - 4;
  let rel = x - (T.x1 + 2);
  rel = ((rel % (2 * span)) + 2 * span) % (2 * span);
  x = T.x1 + 2 + (rel > span ? 2 * span - rel : rel);
  return { x, z: tg.z };
}

export const PIE_POINTS = { normal: 1, gold: 3, mamie: -2 };

// ---------- Course de poulets : position de départ des poulets dans l'enclos
export function raceChickens(seed, n) {
  const rand = mulberry32(seed);
  const pen = MINIGAME_SPOTS.chickenRace.pen;
  const out = [];
  for (let i = 0; i < n; i++) {
    let x, z;
    do { x = pen.x + range(rand, -pen.w / 2 + 1.5, pen.w / 2 - 1.5); z = pen.z + range(rand, -pen.d / 2 + 1.5, pen.d / 2 - 1.5); }
    while (Math.hypot(x - pen.x, z - pen.z) < 4);
    out.push({ i, x, z });
  }
  return out;
}

// ---------- Invasion de poulets (événement public) : trajectoires déterministes
export function invasionChickenCount(players) { return Math.max(18, Math.min(60, 14 + players * 6)); }

export function invasionChickens(seed, n) {
  const rand = mulberry32(seed);
  const list = [];
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, r = 3 + rand() * 17;
    list.push({
      i, land: 1.5 + i * 0.35 + rand() * 1.5,             // secondes avant l'atterrissage
      cx: Math.cos(a) * r, cz: Math.sin(a) * r,
      fa: 0.25 + rand() * 0.35, fb: 0.2 + rand() * 0.3, pa: rand() * 6.28, pb: rand() * 6.28,
      ra: 2 + rand() * 4, rb: 2 + rand() * 4, golden: rand() < 0.1,
    });
  }
  return list;
}

// Position d'un poulet d'invasion t secondes après le début de l'événement (null s'il n'a pas atterri).
export function invasionChickenPos(c, t) {
  const tt = t - c.land;
  let x = c.cx + Math.sin(tt * c.fa + c.pa) * c.ra;
  let z = c.cz + Math.cos(tt * c.fb + c.pb) * c.rb;
  // reste sur la place, en évitant la fontaine
  x = Math.max(-21, Math.min(21, x)); z = Math.max(-21, Math.min(21, z));
  const d = Math.hypot(x - POI.fountain.x, z - POI.fountain.z);
  if (d < POI.fountain.r + 0.8) { const k = (POI.fountain.r + 0.8) / (d || 1); x *= k; z *= k; }
  const y = tt < 0 ? Math.min(40, -tt * 18) : 0;
  return { x, y, z, landed: tt >= 0 };
}

// ---------- Chasse aux citrouilles (pack Halloween) : emplacements candidats sur toute la carte
export const PUMPKIN_SPOTS = [
  [8, -20], [-12, 20], [-30, 0], [30, 5], [0, 40], [0, -50], [-50, 30], [50, -30], [70, 0], [100, 22],
  [118, -40], [90, 56], [-70, -4], [-84, 30], [-110, -20], [-100, 60], [-30, -90], [10, -110], [44, -86], [-56, 72],
  [20, 76], [60, 74], [-95, 80], [86, -70], [110, -110], [-80, -80], [-118, -60], [36, 54], [-40, 56], [-60, -40],
];

export function pumpkinSet(seed, n) {
  const rand = mulberry32(seed);
  const spots = PUMPKIN_SPOTS.map((p, i) => ({ i, x: p[0], z: p[1], k: rand() }));
  spots.sort((a, b) => a.k - b.k);
  return spots.slice(0, n).map((p, idx) => ({ i: idx, x: p.x, z: p.z }));
}

