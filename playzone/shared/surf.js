// SURF : des vagues arrivent du large vers la Plage des Orteils (nord = plage, sud = large).
// Chaque vague se lève, puis déferle sur le récif à partir de son sommet : la partie cassée
// (mousse) s'élargit des deux côtés ; on surfe l'épaule encore lisse, juste devant la partie qui casse.
// Modèle pur (client + autorité) : la même fonction donne la hauteur d'eau pour le décor et la glisse.

export const SURF = {
  x1: -95, x2: 32,          // largeur du spot (entre l'Île aux Mouettes et le ponton)
  zShore: 96,               // bord de l'eau
  zBreak: 175,              // les vagues déferlent à partir d'ici (récif)
  zSpawn: 300,              // elles naissent au large
  speed: 4.2,               // vitesse des vagues (m/s, vers la plage)
  period: 10,               // une vague toutes les 10 s
  peel: 3.4,                // vitesse à laquelle la vague casse sur les côtés (m/s)
  school: { x: -58, z: 78 },
};
export const WAVE_LIFE = (SURF.zSpawn - SURF.zShore + 8) / SURF.speed;

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// houle du moment (0,7 à 2,3 m), qui varie lentement dans la journée
export function swell(t) { const h = t / 3_600_000; return 1.5 + 0.55 * Math.sin(h * 0.9) + 0.25 * Math.sin(h * 2.3 + 1); }
export const swellLabel = (H) => (H < 0.9 ? 'petite houle' : H < 1.4 ? 'houle moyenne' : H < 1.9 ? 'belle houle' : 'grosse houle !');

// vague n° i à l'instant t (secondes de jeu `ts`, houle `sw`)
export function waveAt(i, ts, sw) {
  const age = ts - i * SURF.period;
  if (age < 0 || age > WAVE_LIFE) return null;
  const zc = SURF.zSpawn - SURF.speed * age;
  const H = sw * (0.75 + 0.5 * hash(i));
  const peak = SURF.x1 + 15 + hash(i + 0.37) * (SURF.x2 - SURF.x1 - 30);
  const tb = Math.max(0, (SURF.zBreak - zc) / SURF.speed);           // temps depuis le début du déferlement
  const half = zc < SURF.zBreak ? SURF.peel * tb : -1;                 // demi-largeur de la partie cassée
  const grow = Math.min(1, 0.35 + 0.65 * (SURF.zSpawn - zc) / (SURF.zSpawn - SURF.zBreak));
  const fade = zc < 125 ? Math.max(0.25, (zc - SURF.zShore) / 29) : 1; // près du bord, il ne reste que la mousse
  return { i, zc, H: H * grow * fade, peak, half, broken: half >= 0 };
}
// vagues vivantes
export function wavesAt(ts, sw) {
  const out = [], n = Math.floor(ts / SURF.period);
  for (let i = n; i > n - Math.ceil(WAVE_LIFE / SURF.period) - 1; i--) { const w = waveAt(i, ts, sw); if (w) out.push(w); }
  return out;
}
// profil d'une vague : d = z - zc (négatif = devant, côté plage). Face avant raide, dos en pente douce.
export function profile(d, H) {
  const front = 4 + H * 2.2, back = 12 + H * 3;
  if (d < 0) { const u = Math.max(0, 1 + d / front); return u * u * (3 - 2 * u); }
  return Math.exp(-(d / back) * (d / back) * 2.2);
}
// atténuation sur les côtés du spot (les vagues meurent au-delà)
export const sideFade = (x) => Math.max(0, Math.min(1, (x - SURF.x1 + 25) / 25, (SURF.x2 + 25 - x) / 25));
export function waterHeight(x, z, waves) {
  let y = 0;
  const sf = sideFade(x);
  if (sf <= 0) return 0;
  for (const w of waves) y = Math.max(y, w.H * profile(z - w.zc, w.H));
  return y * sf;
}
// pente de la face (0 à 1) à la position f = zc - z (0 = crête, front = bas de la vague)
export function faceSlope(f, H) { const front = 4 + H * 2.2; if (f < 0 || f > front) return 0; const u = 1 - f / front; return 6 * u * (1 - u) * 1.5 * Math.min(1, H / 1.2); }
// position par rapport à la partie cassée : < 0 dedans (mousse), > 0 sur l'épaule lisse
export function shoulderDist(w, x) { if (!w.broken) return Infinity; return Math.abs(x - w.peak) - w.half; }

// Planches (inventaire du Surf Shop) : plus grande = décolle plus facilement, plus petite = plus vive
export const BOARDS = {
  'surf-mousse': { name: 'Planche en mousse 8\'', takeoff: 1.5, turn: 0.8, speed: 0.9, spin: 0.7, price: 180 },
  'surf-long': { name: 'Longboard 9\'2', takeoff: 1.3, turn: 0.75, speed: 1.05, spin: 0.6, price: 650 },
  'surf-fish': { name: 'Fish 5\'10 (rapide)', takeoff: 1.05, turn: 1.1, speed: 1.15, spin: 1, price: 820 },
  'surf-short': { name: 'Shortboard pro 5\'11', takeoff: 0.85, turn: 1.35, speed: 1.1, spin: 1.35, price: 1100 },
};
export const RENTAL = { board: 'surf-mousse', price: 25 };
export const bestBoard = (inv = {}) => ['surf-short', 'surf-fish', 'surf-long', 'surf-mousse'].find((k) => (inv[k] || 0) > 0) || null;
export const CONTEST = { secs: 240, waves: 2, npcs: 5, fee: 20, prizes: [900, 450, 220] };
// adversaires PNJ d'une compétition : meilleures notes sur 2 vagues
export function contestField(seed, level) {
  const out = [], names = ['Kelly Slatepoisson', 'Laird Ham-Iton', 'Stéphanie Gilmoule', 'Jérémy Florès-du-Coin', 'Mick Fanfaronning', 'Johanne Defayette', 'Gabriel Medinette', 'Carissa Marrante'];
  for (let k = 0; k < CONTEST.npcs; k++) {
    const r = hash(seed + k * 7.3), lvl = Math.min(1.1, 0.2 + level / 120 + r * 0.45);
    out.push({ name: names[(seed + k) % names.length], score: Math.round(300 + lvl * 2600 * (0.8 + hash(seed * 3 + k) * 0.4)) });
  }
  return out;
}
