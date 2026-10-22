// AUTORITÉ — JEUX DE COUR (cache-cache, loup) : partie dans le parc, prises espacées dans le temps,
// score borné par la durée réelle de la partie, récompense plafonnée (rendements décroissants).
import { randInt } from './rng.js';
import { activityFactor, recordActivity } from './rules.js';
import { COUR_GAMES, courReward, inPlayground } from './playground.js';
import { tournamentSubmit } from './authority-calendar.js';

const err = (error) => ({ ok: false, error });

export const COUR_HANDLERS = {
  'cour.start'(ctx, { game }) {
    const G = COUR_GAMES[game];
    if (!G) return err('Jeu inconnu.');
    if (!ctx.pos || !inPlayground(ctx.pos.x, ctx.pos.z, 6)) return err('Les jeux de cour se jouent au parc des Tilleuls.');
    const seed = randInt(ctx.rand, 1, 2 ** 31 - 2);
    ctx.session.cour = { game, seed, startedAt: ctx.now, n: 0, last: 0 };
    return { ok: true, data: { seed, count: G.count, duration: G.duration, npcs: G.npcs } };
  },
  // Un habitant trouvé (cache-cache) ou touché (loup).
  'cour.catch'(ctx) {
    const c = ctx.session.cour;
    if (!c || c.game === 'cachette') return err('Aucune partie.');
    const G = COUR_GAMES[c.game], t = (ctx.now - c.startedAt) / 1000;
    if (t < G.count - 0.5 || t > G.count + G.duration + 3) return err('Pas maintenant.');
    if (c.n >= G.npcs || ctx.now - c.last < 1500) return { ok: true, data: { n: c.n } };
    if (!ctx.pos || !inPlayground(ctx.pos.x, ctx.pos.z, 8)) return err('Reste dans le parc !');
    c.n++; c.last = ctx.now;
    return { ok: true, data: { n: c.n } };
  },
  'cour.finish'(ctx, { survived }) {
    const p = ctx.profile, c = ctx.session.cour;
    if (!c) return err('Aucune partie.');
    ctx.session.cour = null;
    const G = COUR_GAMES[c.game], t = (ctx.now - c.startedAt) / 1000;
    let score = c.n;
    if (c.game === 'cachette') score = Math.max(0, Math.min(G.duration, Math.floor(Number(survived) || 0), Math.floor(t - G.count + 1)));
    const won = c.game === 'cachette' ? score >= G.duration : score >= G.npcs;
    const factor = activityFactor(p, `cour:${c.game}`, ctx.now);
    recordActivity(p, `cour:${c.game}`, ctx.now);
    const coins = this.addCoins(p, courReward(c.game, score) * factor);
    const lv = this.addXp(p, 8 + score * (c.game === 'cachette' ? 0.2 : 3));
    const st = ((p.minigames ||= {})[`cour-${c.game}`] ||= { best: null, plays: 0 });
    st.plays++;
    const record = st.best === null || score > st.best;
    if (record) st.best = score;
    let rank = null;
    if (ctx.leaderboard) rank = ctx.leaderboard.submit(`cour-${c.game}`, p, score, false);
    const tournament = tournamentSubmit(ctx, `cour-${c.game}`, score, false);
    return { ok: true, changed: true, data: { score, won, coins, record, best: st.best, rank, tournament, factor, ...lv } };
  },
  'cour.cancel'(ctx) { ctx.session.cour = null; return { ok: true, data: {} }; },
};
