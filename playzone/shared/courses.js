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
export const GATE_R = { piste: 7, hauts: 12, f1: 16 };

// ------------------------------------------------------------------------------ station de ski du Mont-Pinard
// La piste descend du nord (sommet, z = top) vers le sud (arrivée, z = bottom).
export const SKI = { x1: -800, x2: -620, top: -905, bottom: -738, height: 55, hut: { x: -700, z: -729 }, liftX: -638 };
export const skiY = (z) => SKI.height * Math.max(0, Math.min(1, (SKI.bottom - z) / (SKI.bottom - SKI.top)));
export const SKI_GATES = Array.from({ length: 10 }, (_, i) => ({ x: -710 + (i % 2 ? 16 : -16), z: SKI.top + 22 + i * 14.2 }));

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
  ski: {
    name: 'Ski', icon: '⛷️', place: 'ski-hut', route: null, how: 'ski', ref: 15, vmax: 34,
    member: { name: 'Forfait saison du Mont-Pinard', price: 400, days: 14 },
    day: 60,   // forfait journée (1 jour de jeu)
    modes: {
      libre: { name: 'Descente libre', laps: 1, npcs: 0, fee: 0, prizes: [] },
      slalom: { name: 'Slalom chronométré (10 portes)', laps: 1, npcs: 0, fee: 0, prizes: [], gates: true },
      course: { name: 'Compétition de slalom (contre 7 skieurs PNJ)', laps: 1, npcs: 7, fee: 15, prizes: [300, 150, 75], gates: true },
    },
  },
};
export const SKI_LEN = Math.hypot(SKI.bottom - SKI.top, SKI.height);
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
    out.push({ name: `${NPC_FIRST[Math.floor(rand() * NPC_FIRST.length)]} ${NPC_LAST[Math.floor(rand() * NPC_LAST.length)]}`, lvl, laps, total: laps[laps.length - 1] });
  }
  return out;
}
export const fmtTime = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`);
