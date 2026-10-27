// BOXE : clubs de boxe (ring, sacs de frappe), combats d'entraînement contre 10 boxeurs PNJ de plus en
// plus forts. Règles pures partagées : le client fait le combat, l'autorité valide (durée minimale,
// adversaire débloqué) et paie.
export const BOX = {
  session: 15,          // PC par séance au sac (l'admin ne paie pas)
  bagSeconds: 15,       // durée d'une série au sac
  bagCd: 20_000,
  roundSec: 50, rounds: 3,
  playerHp: 100,
};
// hp : points de vie ; dmg : dégâts d'un coup ; speed : rythme d'attaque ; guard : chance de parer.
export const OPPONENTS = [
  { id: 'kevin', name: 'Kévin « Gant Mou »', hp: 55, dmg: 5, speed: 0.7, guard: 0.1, prize: 60, xp: 30, color: '#9ca3af' },
  { id: 'josiane', name: 'Josiane « La Tornade »', hp: 70, dmg: 6, speed: 0.85, guard: 0.15, prize: 110, xp: 45, color: '#f472b6' },
  { id: 'dede', name: 'Dédé « Le Mur »', hp: 100, dmg: 6, speed: 0.75, guard: 0.3, prize: 180, xp: 60, color: '#78716c' },
  { id: 'rocky', name: 'Rocky Balbouille', hp: 95, dmg: 8, speed: 0.95, guard: 0.2, prize: 280, xp: 80, color: '#dc2626' },
  { id: 'mamie', name: 'Mamie Turbo (oui, elle)', hp: 90, dmg: 9, speed: 1.15, guard: 0.25, prize: 400, xp: 100, color: '#c77dff' },
  { id: 'tyson', name: 'Mike Bisou', hp: 120, dmg: 10, speed: 1.05, guard: 0.25, prize: 600, xp: 130, color: '#111827' },
  { id: 'ali', name: 'Mo « Papillon » Ali-Baba', hp: 125, dmg: 10, speed: 1.3, guard: 0.35, prize: 900, xp: 160, color: '#facc15' },
  { id: 'ivan', name: 'Ivan Drago-Nouille', hp: 160, dmg: 12, speed: 1.0, guard: 0.3, prize: 1300, xp: 200, color: '#1d4ed8' },
  { id: 'apollo', name: 'Apollo Croissant', hp: 160, dmg: 13, speed: 1.25, guard: 0.35, prize: 2000, xp: 260, color: '#e11d48' },
  { id: 'champion', name: 'Le Champion de PLAYZONE', hp: 200, dmg: 15, speed: 1.35, guard: 0.4, prize: 4000, xp: 400, color: '#d4a017' },
];
export const OPP_BY_ID = Object.fromEntries(OPPONENTS.map((o, i) => [o.id, { ...o, rank: i }]));
export const defaultBoxing = () => ({ wins: 0, losses: 0, kos: 0, beaten: -1, bags: 0, xp: 0 });
// Coups du joueur : plus on est musclé·e, plus ça tape fort.
export const jabDmg = (muscle) => 5 + muscle * 0.07;
export const hookDmg = (muscle) => 11 + muscle * 0.14;
// Durée minimale plausible d'une victoire (dégâts max par seconde du joueur ~ 1 crochet / 0,55 s).
export const minWinSeconds = (opp, muscle) => Math.max(6, opp.hp / (hookDmg(muscle) / 0.55) * 0.8);
// Série au sac : gains selon le nombre de coups (plafonné).
export const bagGain = (hits) => { const k = Math.max(0, Math.min(60, hits | 0)); return { muscle: k * 0.035, endurance: k * 0.03, xp: Math.round(k * 0.6) }; };
