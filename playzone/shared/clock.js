// HORLOGE DU JEU (partagée client / serveur) : 10 minutes réelles = 1 heure de jeu, une journée dure
// 4 heures réelles, une semaine 28 heures réelles. Un « mois » de jeu = 4 semaines (28 jours de jeu).
export const HOUR_MS = 10 * 60 * 1000;
export const CYCLE_MS = 24 * HOUR_MS;
export const DAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
export const DAYS_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export function gameHour(nowMs) { return (7 + (nowMs % CYCLE_MS) / HOUR_MS) % 24; }
// Numéro du jour de jeu (le jour 0 est un lundi).
export function gameDay(nowMs) { return Math.floor((nowMs + 7 * HOUR_MS) / CYCLE_MS); }
export const weekday = (day) => ((day % 7) + 7) % 7;
export const dayName = (nowMs) => DAYS[weekday(gameDay(nowMs))];
export const gameWeek = (day) => Math.floor(day / 7);
export const gameMonth = (day) => Math.floor(day / 28);
export const dayOfMonth = (day) => ((day % 28) + 28) % 28;
// Heure réelle (ms) correspondant au jour de jeu `day` à l'heure `hour` (0..24).
export const realAt = (day, hour) => day * CYCLE_MS - 7 * HOUR_MS + hour * HOUR_MS;

export function formatHour(h) {
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
