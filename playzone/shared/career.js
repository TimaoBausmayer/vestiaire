// CARRIÈRES SPORTIVES : une carrière par sport, de Amateur à Légende. Chaque compétition rapporte
// des points de carrière selon la place ; en montant de division, les primes sont multipliées,
// un sponsor verse un salaire chaque jour de jeu, et les adversaires PNJ deviennent plus forts.
// Règles pures partagées (client + autorité).
import { todayKey } from './rules.js';

export const CAREER_SPORTS = {
  course: { name: 'Athlétisme', icon: '🏃' },
  foot: { name: 'Football', icon: '⚽' },
  velo: { name: 'Cyclisme', icon: '🚴' },
  route: { name: 'Vélo de route', icon: '🚴‍♂️' },
  vtt: { name: 'VTT', icon: '🚵' },
  f1: { name: 'Formule 1', icon: '🏎️' },
  karting: { name: 'Karting', icon: '🏁' },
  ski: { name: 'Ski', icon: '⛷️' },
  jetski: { name: 'Jet ski', icon: '🚤' },
  tennis: { name: 'Tennis', icon: '🎾' },
  natation: { name: 'Natation', icon: '🏊' },
  golf: { name: 'Mini-golf', icon: '⛳' },
  boxe: { name: 'Boxe', icon: '🥊' },
};

// pts = points de carrière nécessaires ; mult = multiplicateur des primes ; salary = PC par jour de jeu
export const DIVISIONS = [
  { id: 'amateur', name: 'Amateur', pts: 0, mult: 1, salary: 0, npc: 0 },
  { id: 'regional', name: 'Régional', pts: 80, mult: 1.2, salary: 40, npc: 0.05 },
  { id: 'national', name: 'National', pts: 220, mult: 1.5, salary: 120, npc: 0.1 },
  { id: 'pro', name: 'Pro', pts: 480, mult: 2, salary: 300, npc: 0.16 },
  { id: 'elite', name: 'Élite mondiale', pts: 900, mult: 3, salary: 700, npc: 0.22 },
  { id: 'legende', name: 'Légende', pts: 1500, mult: 4, salary: 1500, npc: 0.28 },
];

export function divisionOf(pts = 0) {
  let i = 0;
  while (i + 1 < DIVISIONS.length && pts >= DIVISIONS[i + 1].pts) i++;
  return { i, ...DIVISIONS[i], next: DIVISIONS[i + 1] || null };
}

export function careerOf(p, sport) {
  p.career = p.career || {};
  const c = p.career[sport] = { pts: 0, comps: 0, wins: 0, podiums: 0, ...(p.career[sport] || {}) };
  return c;
}
export const careerDiv = (p, sport) => divisionOf(p.career?.[sport]?.pts || 0);

// Points selon la place (of = nombre de participants ; of <= 1 = entraînement chronométré)
export function careerPoints(rank, of) {
  if (!of || of <= 1) return 2;
  if (of === 2) return rank === 1 ? 30 : 6;   // duel (tennis, boxe)
  if (rank === 1) return 40;
  if (rank === 2) return 28;
  if (rank === 3) return 22;
  if (rank <= Math.ceil(of / 2)) return 12;
  return 5;
}

// Enregistre un résultat. Renvoie { pts, total, div, up } (up = nom de la nouvelle division).
export function careerResult(p, sport, rank, of, fixed = null) {
  const c = careerOf(p, sport);
  const before = divisionOf(c.pts).i;
  const pts = fixed ?? careerPoints(rank, of);
  c.pts += pts;
  if (of > 1) { c.comps++; if (rank === 1) c.wins++; if (rank <= 3) c.podiums++; }
  const d = divisionOf(c.pts);
  return { pts, total: c.pts, div: d.name, up: d.i > before ? d.name : null, sport };
}

// Salaire de sponsor du jour : la somme des salaires de toutes les carrières.
export function dailySalary(p) {
  let s = 0;
  for (const k of Object.keys(CAREER_SPORTS)) s += careerDiv(p, k).salary;
  return s;
}
export const salaryClaimable = (p, now) => dailySalary(p) > 0 && p.career?.salaryDay !== todayKey(now);
