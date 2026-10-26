// AUTORITÉ — LOISIRS : casino (PlayCoins uniquement) et stand de tir (armes utilisables seulement sur place).
// Le hasard est tiré ICI (serveur en ligne) : le client ne connaît jamais les cartes ou la bille à l'avance.
import { BUILDINGS } from './world-layout.js';
import {
  CASINO, slotSymbol, slotMultiplier, ROULETTE_BETS, roulettePayout, deck, bjValue, isBlackjack, dealerPlay, bjSettle,
  pokerHand, defaultCasino, casinoDay, canBet,
} from './casino.js';
import {
  RANGE, RANGE_WEAPONS, rangeTargets, rangeMax, targetVisible, ringPoints, HOSTAGE_PENALTY, rangeRivals, rangePrize,
} from './leisure.js';
import { randInt } from './rng.js';
import { recordActivity } from './rules.js';
import { liveOcc } from './calendar.js';
import { calTime } from './authority-calendar.js';

import { GAMES, gamesFor } from './casino-games.js';
const err = (error) => ({ ok: false, error });
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const atKind = (self, ctx, interior) => BUILDINGS.some((b) => b.interior === interior && self.atBuilding(ctx, b, 1));
const COMPET_PER_HOUR = 3;

export function defaultLeisure() { return { range: { best: 0, plays: 0, wins: 0 } }; }

// ------------------------------------------------------------------------------------- casino
function gate(self, ctx, bet) {
  const p = ctx.profile;
  p.casino = { ...defaultCasino(), ...(p.casino || {}) };
  if (!atKind(self, ctx, 'casino')) return 'Les jeux d\'argent, c\'est au Casino Royal Pomme.';
  if ((p.body?.age ?? 18) < CASINO.minAge) return 'Casino interdit aux moins de 18 ans.';
  if (!Number.isInteger(bet) || bet < CASINO.minBet || bet > CASINO.maxBet) return `Mise entre ${CASINO.minBet} et ${CASINO.maxBet} PC.`;
  casinoDay(p.casino, ctx.now);
  const lim = canBet(p.casino, bet, ctx.now);
  if (lim) return lim;
  if (p.coins < bet) return 'Pas assez de PlayCoins sur ton compte.';
  return null;
}
// La mise est débitée au début du coup, le gain (mise comprise) crédité à la fin.
function stake(self, p, bet) { self.addCoins(p, -bet); p.casino.played++; }
function payout(self, p, bet, paid) {
  if (paid > 0) self.addCoins(p, paid);
  const net = paid - bet;
  p.casino.net += net;
  if (net > 0) { p.casino.won += net; p.casino.best = Math.max(p.casino.best, net); } else p.casino.lost -= net;
  return net;
}
const hideHole = (d) => [d[0], '?'];

function bjState(bj, over) {
  return { player: bj.player, dealer: over ? bj.dealer : hideHole(bj.dealer), value: bjValue(bj.player), dealerValue: over ? bjValue(bj.dealer) : null, bet: bj.bet, canDouble: !over && bj.player.length === 2 };
}
function bjFinish(self, ctx, bj) {
  const p = ctx.profile;
  if (bjValue(bj.player) <= 21 && !isBlackjack(bj.player)) dealerPlay(bj.dealer, () => bj.shoe[bj.k++]);
  const r = bjSettle(bj.player, bj.dealer, bj.bet);
  const net = payout(self, p, bj.bet, r.payout);
  ctx.session.bj = null;
  return { ok: true, changed: true, data: { ...bjState(bj, true), over: true, result: r.result, paid: r.payout, net, coins: p.coins } };
}

export const LEISURE_HANDLERS = {
  // Les 40 jeux du casino (16 dans les petits casinos) : tirage par l'autorité, mise débitée puis gain crédité.
  'casino.play'(ctx, { game, bet, choice }) {
    const p = ctx.profile, G = GAMES[game];
    if (!G || G.panel && game !== 'slots') return err('Jeu inconnu.');
    const e = gate(this, ctx, bet);
    if (e) return err(e);
    const b = BUILDINGS.find((x) => x.interior === 'casino' && this.atBuilding(ctx, x, 1));
    if (!gamesFor(b).includes(game)) return err('Ce jeu n\'existe qu\'au Grand Casino de PLAYZONE (Avenue de Prestige).');
    if (G.choices && !G.choices.some((c) => c.id === choice)) return err('Choisis sur quoi tu mises.');
    stake(this, p, bet);
    const r = G.play(ctx.rand, G.choices ? choice : null);
    const paid = Math.floor(bet * r.mult);
    const net = payout(this, p, bet, paid);
    p.casino.games = { ...(p.casino.games || {}), [game]: ((p.casino.games || {})[game] || 0) + 1 };
    return { ok: true, changed: true, data: { game, mult: r.mult, show: r.show, paid, net, coins: p.coins } };
  },

  'casino.slots'(ctx, { bet }) {
    const p = ctx.profile;
    const e = gate(this, ctx, bet);
    if (e) return err(e);
    stake(this, p, bet);
    const reels = [slotSymbol(ctx.rand), slotSymbol(ctx.rand), slotSymbol(ctx.rand)];
    const mult = slotMultiplier(reels);
    const paid = Math.floor(bet * mult);
    const net = payout(this, p, bet, paid);
    return { ok: true, changed: true, data: { reels, mult, paid, net, coins: p.coins } };
  },

  // Plusieurs mises sur le même lancer : [{ kind, value?, amount }]
  'casino.roulette'(ctx, { bets }) {
    const p = ctx.profile;
    if (!Array.isArray(bets) || !bets.length || bets.length > 8) return err('Place au moins une mise.');
    for (const b of bets) {
      if (!ROULETTE_BETS[b?.kind]) return err('Mise inconnue.');
      if (b.kind === 'numero' && !(Number.isInteger(b.value) && b.value >= 0 && b.value <= 36)) return err('Numéro entre 0 et 36.');
      if (!Number.isInteger(b.amount) || b.amount < CASINO.minBet) return err(`Mise minimale : ${CASINO.minBet} PC.`);
    }
    const total = bets.reduce((s, b) => s + b.amount, 0);
    const e = gate(this, ctx, total);
    if (e) return err(e);
    stake(this, p, total);
    const n = randInt(ctx.rand, 0, 36);
    const paid = bets.reduce((s, b) => s + roulettePayout(b.kind, b.value, n, b.amount), 0);
    const net = payout(this, p, total, paid);
    return { ok: true, changed: true, data: { n, paid, net, coins: p.coins } };
  },

  'casino.bj.deal'(ctx, { bet }) {
    const p = ctx.profile;
    if (ctx.session.bj) return err('Termine d\'abord la main en cours.');
    const e = gate(this, ctx, bet);
    if (e) return err(e);
    stake(this, p, bet);
    const shoe = deck(ctx.rand, 6);
    const bj = { bet, shoe, k: 4, player: [shoe[0], shoe[2]], dealer: [shoe[1], shoe[3]] };
    ctx.session.bj = bj;
    if (isBlackjack(bj.player) || isBlackjack(bj.dealer)) return bjFinish(this, ctx, bj);
    return { ok: true, changed: true, data: { ...bjState(bj, false), over: false, coins: p.coins } };
  },
  'casino.bj.hit'(ctx) {
    const bj = ctx.session.bj;
    if (!bj) return err('Aucune main en cours.');
    bj.player.push(bj.shoe[bj.k++]);
    if (bjValue(bj.player) >= 21) return bjFinish(this, ctx, bj);
    return { ok: true, data: { ...bjState(bj, false), over: false } };
  },
  'casino.bj.stand'(ctx) {
    const bj = ctx.session.bj;
    if (!bj) return err('Aucune main en cours.');
    return bjFinish(this, ctx, bj);
  },
  'casino.bj.double'(ctx) {
    const p = ctx.profile, bj = ctx.session.bj;
    if (!bj) return err('Aucune main en cours.');
    if (bj.player.length !== 2) return err('On ne double que sur les deux premières cartes.');
    const lim = canBet(p.casino, bj.bet * 2, ctx.now);
    if (lim) return err(lim);
    if (p.coins < bj.bet) return err('Pas assez de PlayCoins pour doubler.');
    this.addCoins(p, -bj.bet);
    bj.bet *= 2;
    bj.player.push(bj.shoe[bj.k++]);
    return bjFinish(this, ctx, bj);
  },

  // Vidéo poker « Valet ou mieux » : distribution, puis on garde des cartes et on retire une fois.
  'casino.poker.deal'(ctx, { bet }) {
    const p = ctx.profile;
    if (ctx.session.vp) return err('Termine d\'abord la main en cours.');
    const e = gate(this, ctx, bet);
    if (e) return err(e);
    stake(this, p, bet);
    const shoe = deck(ctx.rand, 1);
    ctx.session.vp = { bet, shoe, k: 5, cards: shoe.slice(0, 5) };
    return { ok: true, changed: true, data: { cards: ctx.session.vp.cards, hand: pokerHand(ctx.session.vp.cards), coins: p.coins } };
  },
  'casino.poker.draw'(ctx, { hold }) {
    const p = ctx.profile, vp = ctx.session.vp;
    if (!vp) return err('Aucune main en cours.');
    const keep = Array.isArray(hold) ? hold.slice(0, 5).map(Boolean) : [];
    vp.cards = vp.cards.map((c, i) => (keep[i] ? c : vp.shoe[vp.k++]));
    const hand = pokerHand(vp.cards);
    const paid = vp.bet * hand.mult;
    const net = payout(this, p, vp.bet, paid);
    ctx.session.vp = null;
    return { ok: true, changed: true, data: { cards: vp.cards, hand, paid, net, coins: p.coins } };
  },

  // Jeu responsable : limite de pertes par jour, auto-exclusion de 24 h.
  'casino.limit'(ctx, { limit }) {
    const p = ctx.profile;
    p.casino = { ...defaultCasino(), ...(p.casino || {}) };
    const l = num(limit);
    if (!(l >= 100 && l <= 100_000)) return err('Limite entre 100 et 100 000 PC.');
    p.casino.limit = Math.round(l);
    return { ok: true, changed: true, data: { casino: p.casino } };
  },
  'casino.exclude'(ctx) {
    const p = ctx.profile;
    p.casino = { ...defaultCasino(), ...(p.casino || {}) };
    p.casino.excludedUntil = ctx.now + CASINO.excludeHours * 3600_000;
    ctx.session.bj = null; ctx.session.vp = null;
    return { ok: true, changed: true, data: { casino: p.casino } };
  },

  // ----------------------------------------------------------------------------------- stand de tir
  'range.start'(ctx, { weapon, compet }) {
    const p = ctx.profile;
    if (!atKind(this, ctx, 'range')) return err('Les armes ne s\'utilisent qu\'au stand de tir.');
    if (!RANGE_WEAPONS[weapon]) return err('Arme inconnue.');
    if (p.justice?.jail) return err('Pas d\'arme en prison.');
    const fee = compet ? RANGE.compet.fee : (p.inventory[`arme-${weapon}`] || 0) > 0 ? Math.ceil(RANGE.fee / 2) : RANGE.fee;
    if (compet && !liveOcc('tir-du-soir', calTime(ctx))) return err('La compétition a lieu chaque soir de 18 h à 20 h (heure du jeu) : regarde l\'Agenda du téléphone.');
    if (compet) {
      const recent = (p.activity['range:compet'] || []).filter((t) => ctx.now - t < 3600_000);
      if (recent.length >= COMPET_PER_HOUR) return err(`Pas plus de ${COMPET_PER_HOUR} compétitions par heure : la prochaine dans ${Math.ceil((recent[0] + 3600_000 - ctx.now) / 60_000)} min.`);
    }
    if (p.coins < fee) return err(`Pas assez de PlayCoins (${fee} PC).`);
    this.addCoins(p, -fee);
    if (compet) recordActivity(p, 'range:compet', ctx.now);
    const seed = randInt(ctx.rand, 1, 2 ** 31 - 2);
    ctx.session.range = { seed, weapon, compet: !!compet, startedAt: ctx.now, shots: 0, lastShot: 0, hits: {}, score: 0, best: p.leisure.range.best };
    return { ok: true, changed: true, data: { seed, fee, countdown: RANGE.countdown, duration: RANGE.duration, ammo: RANGE_WEAPONS[weapon].ammo } };
  },
  'range.shot'(ctx, { i, ratio }) {
    const r = ctx.session.range;
    if (!r) return err('Aucune séance en cours.');
    const w = RANGE_WEAPONS[r.weapon];
    const t = (ctx.now - r.startedAt) / 1000 - RANGE.countdown;
    if (t < -0.3 || t > RANGE.duration + 1.5) return err('Séance terminée.');
    if (r.shots >= w.ammo) return err('Plus de munitions.');
    if (ctx.now - r.lastShot < w.cooldown * 600) return err('Trop rapide.');
    r.shots++; r.lastShot = ctx.now;
    if (i === null || i === undefined) return { ok: true, data: { score: r.score, shots: r.shots, pts: 0 } };
    const tg = (r.targets ||= rangeTargets(r.seed))[i];
    if (!tg || r.hits[i] !== undefined) return { ok: true, data: { score: r.score, shots: r.shots, pts: 0 } };
    if (!targetVisible(tg, t, 0.7)) return { ok: true, data: { score: r.score, shots: r.shots, pts: 0 } };
    const pts = tg.kind === 'otage' ? HOSTAGE_PENALTY : ringPoints(Math.max(0, Math.min(1, num(ratio) || 0)));
    r.hits[i] = pts;
    r.score += pts;
    return { ok: true, data: { score: r.score, shots: r.shots, pts } };
  },
  'range.finish'(ctx) {
    const p = ctx.profile, r = ctx.session.range;
    if (!r) return err('Aucune séance en cours.');
    const t = (ctx.now - r.startedAt) / 1000 - RANGE.countdown;
    if (t < RANGE.duration - 1 && r.shots < RANGE_WEAPONS[r.weapon].ammo) return err('La séance n\'est pas finie.');
    ctx.session.range = null;
    const score = Math.max(0, Math.min(r.score, rangeMax(r.targets || rangeTargets(r.seed))));
    const st = p.leisure.range;
    st.plays++;
    const record = score > st.best;
    if (record) st.best = score;
    const rank = ctx.leaderboard ? ctx.leaderboard.submit('tir', p, score, false) : null;
    const lv = this.addXp(p, 10 + Math.floor(score / 20));
    let compet = null;
    if (r.compet) {
      const rivals = rangeRivals(r.seed, r.best);
      const place = 1 + rivals.filter((x) => x.score > score).length;
      const prize = rangePrize(place);
      if (prize) this.addCoins(p, prize);
      if (place === 1) { st.wins++; p.rep += 3; }
      compet = { place, prize, rivals: [...rivals, { name: p.name, score, me: true }].sort((a, b) => b.score - a.score) };
    }
    return { ok: true, changed: true, data: { score, best: st.best, record, rank, compet, shots: r.shots, ...lv } };
  },
  'range.cancel'(ctx) { ctx.session.range = null; return { ok: true, data: {} }; },
};
