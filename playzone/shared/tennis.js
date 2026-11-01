// TENNIS : 3 clubs (2 courts chacun), match en simple contre 6 adversaires PNJ de plus en plus forts.
// Le client simule les échanges ; l'autorité valide (durée minimale, adversaire débloqué) et paie.
export const COURT = { L: 23.77, W: 8.23, netH: 0.95, runX: 4.5, runZ: 6 };   // terrain de simple, long axe = z
export const TENNIS_CLUBS = [
  { id: 'tennis-1', name: 'Tennis Club des Affaires', x: 520, z: -260, facing: 'E', surface: '#3d6fb5' },
  { id: 'tennis-2', name: 'Roland-Gros-Pull (terre battue)', x: -160, z: -1410, facing: 'N', surface: '#c8643b' },
  { id: 'tennis-3', name: 'Tennis des Tilleuls (gazon)', x: -180, z: -510, facing: 'E', surface: '#4f9e3a' },
].map((c) => ({ ...c, courts: [{ x: c.x - 10.5, z: c.z + 3 }, { x: c.x + 10.5, z: c.z + 3 }] }));
export const TENNIS_OPPONENTS = [
  { id: 'debutant', name: 'Bernard « Revers de Mamie »', speed: 3.6, reach: 1.5, error: 0.3, power: 0.8, prize: 80, xp: 40, color: '#9ca3af' },
  { id: 'club', name: 'Sophie « Coup Droit »', speed: 4.2, reach: 1.6, error: 0.22, power: 0.9, prize: 160, xp: 60, color: '#f472b6' },
  { id: 'regional', name: 'Rafa Nadalle', speed: 4.8, reach: 1.7, error: 0.16, power: 1.0, prize: 320, xp: 90, color: '#f59e0b' },
  { id: 'national', name: 'Serena Williamsette', speed: 5.3, reach: 1.8, error: 0.12, power: 1.1, prize: 600, xp: 130, color: '#7c3aed' },
  { id: 'pro', name: 'Roger Fédérêveur', speed: 5.8, reach: 1.9, error: 0.08, power: 1.18, prize: 1100, xp: 180, color: '#dc2626' },
  { id: 'legende', name: 'Novak Djokovitchouette', speed: 6.3, reach: 2.0, error: 0.05, power: 1.25, prize: 2500, xp: 280, color: '#111827' },
];
export const T_OPP_BY_ID = Object.fromEntries(TENNIS_OPPONENTS.map((o, i) => [o.id, { ...o, rank: i }]));
export const GAMES_TO_WIN = 3;          // match court : premier à 3 jeux
export const TENNIS_FEE = 20;           // location du court
export const POINT_NAMES = ['0', '15', '30', '40'];
// Score d'un jeu (points gagnés par chacun) → texte ; null si le jeu continue.
export function gameScore(a, b) {
  if (a >= 3 && b >= 3) return a === b ? 'Égalité' : a > b ? 'Avantage toi' : 'Avantage adversaire';
  return `${POINT_NAMES[Math.min(a, 3)]} – ${POINT_NAMES[Math.min(b, 3)]}`;
}
export const gameWinner = (a, b) => (a >= 4 && a - b >= 2 ? 0 : b >= 4 && b - a >= 2 ? 1 : -1);
// Durée minimale plausible d'une victoire : 3 jeux × 4 points × ~2,5 s.
export const MIN_WIN_SECS = GAMES_TO_WIN * 4 * 2.5;
export const defaultTennis = () => ({ matches: 0, wins: 0, beaten: -1, aces: 0 });
