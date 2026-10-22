// AUTORITÉ — CALENDRIER : inscriptions (places limitées), scores des tournois, résultats et prix.
// L'heure du calendrier est celle du jeu : en solo elle tient compte des nuits sautées (ctx.shift).
import { parseOcc, liveOf } from './calendar.js';
import { mulberry32, hashString, shuffle } from './rng.js';

const err = (error) => ({ ok: false, error });
export const calTime = (ctx) => ctx.now + (ctx.shift || 0);
export function defaultCalendar() { return { reg: {}, claimed: {}, history: [] }; }

const NPC_ENTRANTS = ['Mamie Turbo', 'Kevin', 'Coach Biscotte', 'Paulette', 'Gérard', 'Lulu', 'Momo', 'Josiane', 'Le Maire', 'Fermier Bidoche', 'Sandrine', 'Jean-Mi'];
// Niveau des PNJ par mini-jeu : score « moyen » (ou temps pour un chrono) et dispersion.
const NPC_LEVEL = {
  tartes: { base: 19, spread: 0.45 }, parcours: { base: 46, spread: 0.35, lower: true }, poulets: { base: 7, spread: 0.5 },
  'cour-cachette': { base: 55, spread: 0.45 }, 'cour-loup': { base: 4, spread: 0.4 }, 'cour-cherche': { base: 4, spread: 0.4 },
};

// Participants PNJ d'un tournoi (déterministes : tout le monde voit les mêmes).
export function tournamentNpcs(ev, occ) {
  const lv = NPC_LEVEL[ev.minigame];
  if (!lv) return [];
  const rand = mulberry32(hashString(`npc:${occ}`));
  const n = 4 + Math.floor(rand() * 3);
  return shuffle(rand, NPC_ENTRANTS).slice(0, n).map((name) => {
    const k = 1 + (rand() * 2 - 1) * lv.spread;
    const score = lv.lower ? Math.round(lv.base * (2 - k) * 100) / 100 : Math.max(1, Math.round(lv.base * k));
    return { name, score, npc: true };
  });
}

// Classement complet d'une occurrence (joueurs + PNJ).
export function tournamentRanking(ev, occ, top, meId) {
  const lower = NPC_LEVEL[ev.minigame]?.lower;
  const list = [...top.map((r) => ({ id: r.id, name: r.name, score: r.score, me: r.id === meId, npc: !!r.npc })), ...tournamentNpcs(ev, occ)];
  return list.sort((a, b) => (lower ? a.score - b.score : b.score - a.score));
}

// Appelé à la fin d'un mini-jeu : le score compte pour le tournoi en cours si on y est inscrit.
export function tournamentSubmit(ctx, mgId, score, lowerBetter) {
  const p = ctx.profile;
  const live = liveOf((e) => e.kind === 'minigame' && e.minigame === mgId, calTime(ctx));
  const out = [];
  for (const o of live) {
    if (!p.calendar.reg[o.occ]) continue;
    if (ctx.leaderboard) ctx.leaderboard.submit(`cal:${o.occ}`, p, score, lowerBetter);
    out.push(o.occ);
  }
  return out;
}

export const CALENDAR_HANDLERS = {
  'cal.register'(ctx, { occ }) {
    const p = ctx.profile, o = parseOcc(occ);
    if (!o) return err('Événement inconnu.');
    if (!o.ev.register) return err('Pas besoin de s\'inscrire : viens directement !');
    const now = calTime(ctx);
    if (now >= o.end) return err('Cet événement est terminé.');
    if (p.calendar.reg[occ]) return { ok: true, data: { already: true } };
    const taken = (ctx.calRegistry?.count(occ) || 0) + tournamentNpcs(o.ev, occ).length;
    if (o.ev.places && taken >= o.ev.places) return err('Complet ! Plus aucune place.');
    if (o.ev.price) {
      if (p.coins < o.ev.price) return err(`Inscription : ${o.ev.price} PC.`);
      this.addCoins(p, -o.ev.price);
    }
    p.calendar.reg[occ] = true;
    ctx.calRegistry?.add(occ, p.id);
    // on garde une trace raisonnable
    const keys = Object.keys(p.calendar.reg);
    if (keys.length > 40) delete p.calendar.reg[keys[0]];
    return { ok: true, changed: true, data: { places: o.ev.places, taken: taken + 1 } };
  },

  'cal.claim'(ctx, { occ }) {
    const p = ctx.profile, o = parseOcc(occ);
    if (!o || !p.calendar.reg[occ]) return err('Tu n\'étais pas inscrit·e à cet événement.');
    if (calTime(ctx) < o.end) return err('Le tournoi n\'est pas encore terminé.');
    const top = ctx.leaderboard ? ctx.leaderboard.top(`cal:${occ}`, 50) : [];
    const ranking = tournamentRanking(o.ev, occ, top, p.id);
    const idx = ranking.findIndex((x) => x.me);
    const place = idx >= 0 ? idx + 1 : null;
    let prize = 0;
    if (!p.calendar.claimed[occ]) {
      p.calendar.claimed[occ] = true;
      prize = place ? o.ev.rewards?.podium?.[place - 1] || 0 : 0;
      if (prize) this.addCoins(p, prize);
      if (place === 1) { p.rep += 5; if (!p.titles.includes(`Champion·ne : ${o.ev.name}`)) p.titles.push(`Champion·ne : ${o.ev.name}`); }
      p.calendar.history.push({ id: o.ev.id, occ, place, of: ranking.length, prize, at: ctx.now });
      if (p.calendar.history.length > 30) p.calendar.history.shift();
    }
    return { ok: true, changed: true, data: { place, prize, ranking } };
  },
};
