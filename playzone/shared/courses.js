// COURSES : course à pied (piste d'athlétisme autour du Stade des Crampons), cyclisme (boucle des Hauts),
// Formule 1 (circuit de l'Académie F1) et ski (station du Mont-Pinard). Règles pures partagées.
// Toujours un ESSAI GRATUIT avant de prendre une adhésion. Plus on pratique, plus on progresse
// (compétence du sport + endurance du corps), et plus les adversaires PNJ sont relevés.
import { PITCH } from './sports.js';
import { mulberry32 } from './rng.js';

// ------------------------------------------------------------------------------ tracés (boucles fermées)
function roundedRect(cx, cz, hx, hz, r, n = 6) {
  const pts = [];
  const corners = [[hx - r, hz - r, 0], [-(hx - r), hz - r, Math.PI / 2], [-(hx - r), -(hz - r), Math.PI], [hx - r, -(hz - r), Math.PI * 1.5]];
  for (const [ox, oz, a0] of corners) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push({ x: cx + ox + Math.cos(a) * r, z: cz + oz + Math.sin(a) * r }); }
  return pts;
}
// piste d'athlétisme (400 m environ) autour du terrain de foot ; départ en bas à droite
export const ATHLE = { cx: PITCH.x, cz: PITCH.z, hx: PITCH.w / 2 + 6, hz: PITCH.d / 2 + 5, r: 13, w: 4.4 };
export const ROUTES = {
  piste: { name: 'Piste d\'athlétisme du Stade des Crampons', pts: roundedRect(ATHLE.cx, ATHLE.cz, ATHLE.hx, ATHLE.hz, ATHLE.r).reverse(), width: ATHLE.w },
  hauts: { name: 'Boucle cycliste des Hauts', width: 9, pts: [{ x: 450, z: -430 }, { x: 140, z: -430 }, { x: 140, z: -700 }, { x: 560, z: -700 }, { x: 560, z: -430 }] },
  bouees: { name: 'Parcours de bouées de la Côte des Villas', width: 14, pts: [{ x: 360, z: 128 }, { x: 520, z: 128 }, { x: 572, z: 165 }, { x: 520, z: 205 }, { x: 440, z: 185 }, { x: 360, z: 208 }, { x: 318, z: 168 }] },
  f1: { name: 'Circuit de l\'Académie F1', width: 13, pts: [{ x: 640, z: -748 }, { x: 790, z: -748 }, { x: 806, z: -762 }, { x: 806, z: -792 }, { x: 790, z: -806 }, { x: 735, z: -812 }, { x: 722, z: -826 }, { x: 735, z: -840 }, { x: 790, z: -846 }, { x: 806, z: -862 }, { x: 806, z: -888 }, { x: 790, z: -902 }, { x: 640, z: -902 }, { x: 622, z: -886 }, { x: 622, z: -764 }] },
};
// longueurs cumulées
for (const r of Object.values(ROUTES)) {
  r.cum = [0];
  for (let i = 1; i <= r.pts.length; i++) { const a = r.pts[i - 1], b = r.pts[i % r.pts.length]; r.cum.push(r.cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z)); }
  r.len = r.cum[r.pts.length];
  // portes de contrôle : un point tous les ~ len/8, dans l'ordre
  const n = Math.max(4, Math.min(10, Math.round(r.len / 60)));
  r.gates = Array.from({ length: n }, (_, k) => routeAt(r, (k / n) * r.len));
}
export function routeAt(r, s) {
  s = ((s % r.len) + r.len) % r.len;
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < s) i++;
  const a = r.pts[i - 1], b = r.pts[i % r.pts.length];
  const seg = r.cum[i] - r.cum[i - 1] || 1, t = (s - r.cum[i - 1]) / seg;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
}
// distance d'un point au tracé
export function distToRoute(r, x, z) {
  let best = Infinity;
  for (let i = 0; i < r.pts.length; i++) {
    const a = r.pts[i], b = r.pts[(i + 1) % r.pts.length];
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    best = Math.min(best, Math.hypot(a.x + dx * t - x, a.z + dz * t - z));
  }
  return best;
}
export const GATE_R = { piste: 7, hauts: 12, f1: 16, bouees: 14 };

// ------------------------------------------------------------------------------ station de ski du Mont-Pinard
// 5 pistes côte à côte qui descendent du nord (sommet) vers le sud (front de neige) : verte, bleue,
// rouge (bosses), noire (le Mur), snowpark (tremplins). 2 télésièges. Le relief est une fonction
// pure (la glisse et les sauts en découlent : gravité selon la pente).
export const SKI = { x1: -820, x2: -580, top: -912, bottom: -738, hut: { x: -700, z: -729 } };
export const PISTES = {
  verte: { name: 'Les Marmottes', color: 'verte', icon: '🟢', cx: -790, w: 40, top: -845, H: 26, lift: 0 },
  bleue: { name: 'Le Chamois', color: 'bleue', icon: '🔵', cx: -740, w: 40, top: -905, H: 55, lift: 0, bumps: true },
  rouge: { name: 'La Raclette (bosses)', color: 'rouge', icon: '🔴', cx: -690, w: 36, top: -905, H: 56, lift: 1, moguls: true },
  noire: { name: 'Le Mur de Mamie', color: 'noire', icon: '⚫', cx: -640, w: 34, top: -910, H: 64, lift: 1, steep: true },
  park: { name: 'Snowpark (tremplins)', color: 'park', icon: '🏂', cx: -598, w: 30, top: -900, H: 44, lift: 1, kickers: true },
};
export const LIFTS = [{ x: -765, top: -905, name: 'Télésiège des Marmottes' }, { x: -665, top: -908, name: 'Télésiège du Mur' }];
// tremplins du snowpark et bosses de la bleue : { z (lèvre), len, h }
export const KICKERS = [{ z: -868, len: 7, h: 2.2 }, { z: -836, len: 8, h: 2.8 }, { z: -800, len: 9, h: 3.4 }, { z: -768, len: 7, h: 2.4 }];
const BUMPS = [{ z: -860, len: 6, h: 1.2 }, { z: -810, len: 6, h: 1.4 }, { z: -770, len: 5, h: 1.0 }];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function pisteY(P, x, z) {
  const u = clamp01((SKI.bottom - z) / (SKI.bottom - P.top));   // 1 au départ, 0 en bas
  let y = P.H * (P.steep ? Math.pow(u, 0.72) : P.bumps ? Math.pow(u, 1.12) : u);
  if (z < P.top) y = P.H;                                         // plateau de départ
  if (P.moguls && u > 0.08 && u < 0.92) y += 0.55 * Math.sin(x * 0.62) * Math.sin(z * 0.58);
  const ramps = P.kickers ? KICKERS : P.bumps ? BUMPS : null;
  if (ramps && Math.abs(x - P.cx) < P.w / 2 - 3) for (const k of ramps) { const t = (z - (k.z - k.len)) / k.len; if (t > 0 && t <= 1) y += k.h * Math.pow(t, 1.6); }
  return y;
}
const LANES = Object.values(PISTES).sort((a, b) => a.cx - b.cx);
// Hauteur de la neige en (x, z) : piste la plus proche, crêtes entre les pistes, retombée sur les côtés.
export function skiSurf(x, z) {
  if (z > SKI.bottom + 4 || z < SKI.top - 20 || x < SKI.x1 - 12 || x > SKI.x2 + 12) return 0;
  let a = LANES[0], b = null;
  for (let i = 0; i < LANES.length; i++) { if (x >= LANES[i].cx) { a = LANES[i]; b = LANES[i + 1] || null; } }
  if (x < LANES[0].cx) { a = LANES[0]; b = null; }
  let y;
  if (b && x > a.cx + a.w / 2 && x < b.cx - b.w / 2) {
    // séparation boisée entre deux pistes : petite crête
    const t = (x - (a.cx + a.w / 2)) / ((b.cx - b.w / 2) - (a.cx + a.w / 2));
    y = pisteY(a, a.cx + a.w / 2, z) * (1 - t) + pisteY(b, b.cx - b.w / 2, z) * t + Math.sin(t * Math.PI) * 2.5;
  } else if (b && x >= b.cx - b.w / 2) y = pisteY(b, x, z);
  else y = pisteY(a, x, z);
  // bords de la station
  const out = Math.max(0, SKI.x1 - x, x - SKI.x2);
  if (out > 0) y *= Math.max(0, 1 - out / 12);
  if (z < SKI.top) y *= Math.max(0, 1 - (SKI.top - z) / 20);
  if (z > SKI.bottom) y = 0;
  return Math.max(0, y);
}
export const skiY = (z, x = -740) => skiSurf(x, z);
export const pisteAt = (x) => LANES.reduce((best, p) => (Math.abs(x - p.cx) < Math.abs(x - best.cx) ? p : best), LANES[0]);
// slalom sur la rouge : 10 portes
export const SKI_GATES = Array.from({ length: 10 }, (_, i) => ({ x: PISTES.rouge.cx + (i % 2 ? 8 : -8), z: PISTES.rouge.top + 20 + i * 15 }));
export const BIGAIR_MAX = 2600;

// ------------------------------------------------------------------------------ disciplines
// mode : how = 'foot' | 'bike' | 'f1' | 'ski' ; laps ; npcs ; fee ; prizes (1er, 2e, 3e)
export const DISC = {
  course: {
    name: 'Course à pied', icon: '🏃', place: 'club-foot', route: 'piste', how: 'foot', ref: 6.4, vmax: 13,
    member: null,  // la course à pied est gratuite
    modes: {
      seance: { name: 'Séance de footing (gratuite)', laps: 2, npcs: 0, fee: 0, prizes: [] },
      fractionne: { name: 'Fractionné : 4 tours à fond (gratuit)', laps: 4, npcs: 0, fee: 0, prizes: [] },
      course: { name: 'Course du quartier (contre des coureurs PNJ)', laps: 3, npcs: 7, fee: 0, prizes: [120, 60, 30] },
    },
  },
  velo: {
    name: 'Cyclisme', icon: '🚴', place: 'club-foot', route: 'hauts', how: 'bike', ref: 10.5, vmax: 24,
    member: { name: 'Licence du Vélo Club Pédale Douce', price: 150, days: 7 },
    modes: {
      seance: { name: 'Sortie d\'entraînement (1 tour)', laps: 1, npcs: 0, fee: 0, prizes: [] },
      course: { name: 'Grand Prix cycliste des Hauts (2 tours)', laps: 2, npcs: 9, fee: 20, prizes: [600, 300, 150] },
    },
  },
  f1: {
    name: 'Formule 1', icon: '🏎️', place: 'f1-paddock', route: 'f1', how: 'f1', ref: 30, vmax: 72,
    member: { name: 'Pilote de l\'Académie F1', price: 2500, days: 7 },
    modes: {
      essais: { name: 'Essais libres (3 tours)', laps: 3, npcs: 0, fee: 0, prizes: [] },
      qualif: { name: 'Qualifications (meilleur tour = place sur la grille)', laps: 3, npcs: 0, fee: 0, prizes: [], qualif: true },
      course: { name: 'Grand Prix de PLAYZONE (5 tours, 10 voitures)', laps: 5, npcs: 9, fee: 200, prizes: [8000, 4000, 2000] },
    },
  },
  jetski: {
    name: 'Jet ski', icon: '🚤', place: 'surf-shop', route: 'bouees', how: 'jet', ref: 15, vmax: 30, item: 'jetski',
    member: { name: 'Abonnement Jet Club (ou achète ton jet ski)', price: 300, days: 7 },
    modes: {
      balade: { name: 'Balade libre en mer (5 min)', laps: 0, npcs: 0, fee: 0, prizes: [], free: 300 },
      bouees: { name: 'Parcours de bouées chronométré (2 tours)', laps: 2, npcs: 0, fee: 0, prizes: [] },
      course: { name: 'Course de jet ski (3 tours, 6 pilotes PNJ)', laps: 3, npcs: 6, fee: 30, prizes: [500, 250, 120] },
    },
  },
  ski: {
    name: 'Ski', icon: '⛷️', place: 'ski-hut', route: null, how: 'ski', ref: 15, vmax: 34,
    member: { name: 'Forfait saison du Mont-Pinard', price: 400, days: 14 },
    day: 60,   // forfait journée (1 jour de jeu)
    modes: {
      libre: { name: 'Descente libre (choisis ta piste, ski ou snowboard)', laps: 1, npcs: 0, fee: 0, prizes: [] },
      slalom: { name: 'Slalom chronométré sur la rouge (10 portes)', laps: 1, npcs: 0, fee: 0, prizes: [], gates: true, piste: 'rouge' },
      descente: { name: 'Descente chronométrée du Mur (noire)', laps: 1, npcs: 0, fee: 0, prizes: [], piste: 'noire' },
      course: { name: 'Compétition de slalom (contre 7 skieurs PNJ)', laps: 1, npcs: 7, fee: 15, prizes: [300, 150, 75], gates: true, piste: 'rouge' },
      bigair: { name: 'Contest Big Air au snowpark (figures, contre 5 riders PNJ)', laps: 1, npcs: 5, fee: 15, prizes: [400, 200, 100], piste: 'park', score: true },
    },
  },
};
export const SKI_LEN = 100;   // descente la plus courte (verte), pour le temps minimal
export const discLen = (d, mode) => (DISC[d].how === 'ski' ? SKI_LEN : ROUTES[DISC[d].route].len * DISC[d].modes[mode].laps);
export function defaultDisc() { return { skill: 5, trial: false, member: null, races: 0, wins: 0, podiums: 0, best: {}, sessions: 0, grid: null }; }

const NPC_FIRST = ['Usain', 'Jojo', 'Mo', 'Paula', 'Eliud', 'Marie-Jo', 'Bernard', 'Fausto', 'Jeannie', 'Lance-Pierre', 'Ayrton', 'Alain', 'Lewis', 'Max', 'Michou', 'Fernando', 'Seb', 'Charlotte', 'Lindsey', 'Alberto', 'Mikaela', 'Tessa'];
const NPC_LAST = ['Bolide', 'Pédale', 'Mollet', 'Turbo', 'Chrono', 'Godasse', 'Patate', 'Freinard', 'Dérapage', 'Schuss', 'Raclette', 'Piston'];
// Adversaires PNJ : temps total (s) et temps par tour, selon le niveau du joueur (ils progressent avec lui).
export function npcField(disc, mode, seed, skill) {
  const D = DISC[disc], M = D.modes[mode], rand = mulberry32(seed);
  const len = discLen(disc, mode);
  const strength = 0.25 + Math.min(1, skill / 100) * 0.7;
  const out = [];
  for (let i = 0; i < M.npcs; i++) {
    const lvl = Math.max(0.05, Math.min(1.1, strength + (rand() - 0.55) * 0.5));
    const v = D.ref * (0.78 + lvl * 0.38);
    const total = len / v;
    const laps = [];
    let acc = 0;
    for (let k = 0; k < M.laps; k++) { acc += (total / M.laps) * (0.96 + rand() * 0.08); laps.push(Math.round(acc * 100) / 100); }
    out.push({ name: `${NPC_FIRST[Math.floor(rand() * NPC_FIRST.length)]} ${NPC_LAST[Math.floor(rand() * NPC_LAST.length)]}`, lvl, laps, total: laps[laps.length - 1], score: Math.round(150 + lvl * 1100 * (0.8 + rand() * 0.4)) });
  }
  return out;
}
export const fmtTime = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`);
