// LOTO DE PLAYZONE : un ticket par jour réel (heure de Paris), 10 PC, une chance sur 100 de gagner
// 1 000 000 PC. Le tirage est fait par l'autorité (le client ne fait que l'animation).
export const LOTTO = { price: 10, prize: 1_000_000, odds: 100, history: 30 };
// jour « humain » : change à minuit, heure de Paris (UTC+1 / +2 en été : on prend +1, un décalage d'une heure au pire)
export const lottoDay = (now) => Math.floor((now + 3600_000) / 86400_000);
export const nextDrawIn = (now) => (lottoDay(now) + 1) * 86400_000 - 3600_000 - now;
export const defaultLotto = () => ({ day: -1, played: 0, wins: 0, won: 0, last: [] });
// numéros affichés sur le ticket (6 numéros de 1 à 49), cosmétiques mais stables pour un jour donné
export function ticketNumbers(seed) {
  const out = []; let s = seed >>> 0;
  while (out.length < 6) { s = (s * 1664525 + 1013904223) >>> 0; const n = 1 + (s % 49); if (!out.includes(n)) out.push(n); }
  return out.sort((a, b) => a - b);
}
