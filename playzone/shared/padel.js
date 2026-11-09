// PADEL : court de 20 × 10 m entouré de vitres (3 m) et de grillage, en double : toi et un
// partenaire IA contre une paire PNJ. La balle peut rebondir sur les vitres APRÈS avoir touché le sol.
export const PADEL = { L: 20, W: 10, netH: 0.88, glass: 3, fence: 4, serviceZ: 6.95 };
export const PADEL_CLUB = { id: 'padel-club', name: 'Padel Club des Plaines', x: 950, z: -200 };
export const PADEL_COURTS = [{ x: 950 - 8, z: -200 }, { x: 950 + 8, z: -200 }];
export const PADEL_PAIRS = [
  { id: 'loisir', name: 'Les Cousins Raquette', speed: 3.6, reach: 1.5, error: 0.28, power: 0.85, prize: 90, xp: 40, color: '#9ca3af' },
  { id: 'club', name: 'Duo Bandeja', speed: 4.2, reach: 1.6, error: 0.2, power: 0.95, prize: 180, xp: 60, color: '#f472b6' },
  { id: 'regional', name: 'Les Frères Víbora', speed: 4.8, reach: 1.7, error: 0.14, power: 1.05, prize: 350, xp: 90, color: '#f59e0b' },
  { id: 'national', name: 'Paquito & Lola Smash', speed: 5.3, reach: 1.8, error: 0.1, power: 1.12, prize: 700, xp: 130, color: '#7c3aed' },
  { id: 'pro', name: 'Les Rois de la Vitre', speed: 5.9, reach: 1.95, error: 0.06, power: 1.2, prize: 1500, xp: 200, color: '#dc2626' },
].map((o, i) => ({ ...o, rank: i }));
export const PADEL_BY_ID = Object.fromEntries(PADEL_PAIRS.map((o) => [o.id, o]));
export const PADEL_FEE = 25;
export const PADEL_GAMES = 3;
export const PADEL_MIN_SECS = PADEL_GAMES * 4 * 2.5;
export const defaultPadel = () => ({ matches: 0, wins: 0, beaten: -1 });
