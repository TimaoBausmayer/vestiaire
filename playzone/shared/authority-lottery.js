// AUTORITÉ — LOTO : un ticket par jour réel, tirage côté autorité (1 chance sur 100).
import { LOTTO, lottoDay, defaultLotto, ticketNumbers } from './lottery.js';

const err = (error) => ({ ok: false, error });
export const LOTTERY_HANDLERS = {
  'loto.play'(ctx) {
    const p = ctx.profile;
    p.lotto = { ...defaultLotto(), ...(p.lotto || {}) };
    const L = p.lotto, day = lottoDay(ctx.now);
    if (L.day === day) return err('Un seul ticket par jour ! Reviens demain pour le prochain tirage.');
    if (p.justice?.jail) return err('Pas de loto en prison.');
    const cost = p.admin ? 0 : LOTTO.price;
    if (p.coins < cost) return err(`Le ticket coûte ${LOTTO.price} PC.`);
    this.addCoins(p, -cost);
    const win = ctx.rand() < 1 / LOTTO.odds;
    const seed = Math.floor(ctx.rand() * 2 ** 31);
    const mine = ticketNumbers(seed), drawn = win ? mine : ticketNumbers(seed ^ 0x5bd1e995);
    L.day = day; L.played++;
    if (win) { L.wins++; L.won += LOTTO.prize; this.addCoins(p, LOTTO.prize); }
    L.last.unshift({ at: ctx.now, mine, drawn, win });
    L.last.length = Math.min(L.last.length, LOTTO.history);
    return { ok: true, changed: true, data: { win, mine, drawn, prize: win ? LOTTO.prize : 0, cost } };
  },
};
