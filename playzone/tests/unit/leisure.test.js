// Tests des loisirs : casino (PlayCoins uniquement, avantage de la maison, limite de pertes, auto-exclusion,
// âge), stand de tir (armes seulement sur place, tirs validés, compétition du soir et prix).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { slotRtp, bjValue, bjSettle, pokerHand, roulettePayout, CASINO } from '../../shared/casino.js';
import { rangeTargets, RANGE, RANGE_WEAPONS, rangeMax } from '../../shared/leisure.js';
import { mulberry32 } from '../../shared/rng.js';
import { occurrences } from '../../shared/calendar.js';
import { HOUR_MS } from '../../shared/clock.js';

const NOW = Date.parse('2026-10-20T12:00:00Z');
const auth = new Authority(buildContent(NOW));
const at = (id) => { const b = BUILDING_BY_ID[id]; return { x: b.x, y: 0, z: b.z }; };
const mk = (p, pos, now = NOW, session = {}, seed = 1) => ({ profile: p, session, now, pos: pos ? { ...pos } : null, zone: 'world', rand: mulberry32(seed), newId: () => 'x' });
const prof = (id) => { const p = auth.newProfile({ id, name: 'Joueur', appearance: {}, now: 0 }); p.coins = 50_000; p.body.age = 25; return p; };

test('règles du casino : la maison gagne sur la durée', () => {
  const rtp = slotRtp();
  assert.ok(rtp > 0.88 && rtp < 0.97, `machine à sous : ${rtp}`);
  assert.equal(bjValue(['A♠', 'R♥']), 21);
  assert.equal(bjValue(['A♠', 'A♥', '9♦']), 21);
  assert.equal(bjSettle(['A♠', 'R♥'], ['10♠', '9♥'], 100).payout, 250, 'blackjack payé 3 pour 2');
  assert.equal(bjSettle(['10♠', '8♥'], ['10♦', '8♣'], 100).payout, 100, 'égalité : mise rendue');
  assert.equal(roulettePayout('rouge', null, 0, 10), 0, 'le zéro fait perdre les chances simples');
  assert.equal(roulettePayout('numero', 17, 17, 10), 360);
  assert.equal(pokerHand(['D♠', 'D♥', '3♦', '7♣', '9♠']).mult, 1);
  assert.equal(pokerHand(['5♠', '5♥', '5♦', '9♣', '9♠']).id, 'full');
});

test('casino : seulement sur place, majeur, mises bornées, PlayCoins', () => {
  const p = prof('c1');
  assert.equal(auth.handle(mk(p, null), 'casino.slots', { bet: 50 }).ok, false, 'hors du casino');
  assert.equal(auth.handle(mk(p, at('casino')), 'casino.slots', { bet: 5 }).ok, false, 'mise trop petite');
  assert.equal(auth.handle(mk(p, at('casino')), 'casino.slots', { bet: CASINO.maxBet + 1 }).ok, false, 'mise trop grosse');
  const kid = prof('c2'); kid.body.age = 16;
  assert.equal(auth.handle(mk(kid, at('casino')), 'casino.slots', { bet: 50 }).ok, false, 'mineur refusé');
  const c0 = p.coins;
  const r = auth.handle(mk(p, at('casino')), 'casino.slots', { bet: 100 });
  assert.ok(r.ok);
  assert.equal(r.data.reels.length, 3);
  assert.equal(p.coins, c0 - 100 + r.data.paid);
  // sur 2 000 tours, on perd de l'argent (avantage de la maison)
  const q = prof('c3'); q.coins = 1_000_000; q.casino = { limit: 100_000 };
  const s = {};
  for (let i = 0; i < 2000; i++) auth.handle(mk(q, at('casino'), NOW, s, 1000 + i), 'casino.slots', { bet: 10 });
  assert.ok(q.coins < 1_000_000, `perte sur la durée : ${1_000_000 - q.coins} PC`);
});

test('roulette, blackjack et vidéo poker validés par l\'autorité', () => {
  const p = prof('c4');
  const r = auth.handle(mk(p, at('casino')), 'casino.roulette', { bets: [{ kind: 'rouge', amount: 50 }, { kind: 'numero', value: 7, amount: 10 }] });
  assert.ok(r.ok && r.data.n >= 0 && r.data.n <= 36);
  assert.equal(auth.handle(mk(p, at('casino')), 'casino.roulette', { bets: [{ kind: 'numero', value: 40, amount: 10 }] }).ok, false);
  const s = {};
  const d = auth.handle(mk(p, at('casino'), NOW, s, 7), 'casino.bj.deal', { bet: 100 });
  assert.ok(d.ok);
  if (!d.data.over) {
    assert.equal(d.data.dealer[1], '?', 'carte cachée du croupier');
    const st = auth.handle(mk(p, at('casino'), NOW, s), 'casino.bj.stand', {});
    assert.ok(st.ok && st.data.over && st.data.dealerValue >= 17);
  }
  const vs = {};
  const v = auth.handle(mk(p, at('casino'), NOW, vs, 9), 'casino.poker.deal', { bet: 20 });
  assert.equal(v.data.cards.length, 5);
  const w = auth.handle(mk(p, at('casino'), NOW, vs, 9), 'casino.poker.draw', { hold: [true, true, false, false, false] });
  assert.deepEqual(w.data.cards.slice(0, 2), v.data.cards.slice(0, 2), 'cartes gardées');
  assert.equal(w.data.paid, 20 * w.data.hand.mult);
});

test('jeu responsable : limite de pertes du jour et auto-exclusion', () => {
  const p = prof('c5');
  auth.handle(mk(p, at('casino')), 'casino.limit', { limit: 200 });
  const s = {};
  let refused = null;
  for (let i = 0; i < 400 && !refused; i++) {
    const r = auth.handle(mk(p, at('casino'), NOW, s, 50 + i), 'casino.slots', { bet: 50 });
    if (!r.ok) refused = r.error;
  }
  assert.match(refused || '', /Limite de pertes/);
  assert.ok(-p.casino.net <= 200);
  const q = prof('c6');
  auth.handle(mk(q, at('casino')), 'casino.exclude', {});
  assert.match(auth.handle(mk(q, at('casino')), 'casino.slots', { bet: 10 }).error, /exclu/);
  assert.ok(auth.handle(mk(q, at('casino'), NOW + 25 * 3600_000), 'casino.slots', { bet: 10 }).ok, 'exclusion levée après 24 h');
});

test('stand de tir : armes seulement sur place, tirs validés, compétition', () => {
  const p = prof('t1');
  assert.equal(auth.handle(mk(p, null), 'range.start', { weapon: 'pistolet' }).ok, false, 'pas d\'arme dans la rue');
  const s = {};
  const c0 = p.coins;
  const off = occurrences(NOW, NOW + 30 * HOUR_MS).find((o) => o.id === 'tir-du-soir').start - HOUR_MS;
  assert.match(auth.handle(mk(p, at('stand-tir'), off, s), 'range.start', { weapon: 'pistolet', compet: true }).error, /18 h à 20 h/, 'compétition seulement le soir');
  const T = off + HOUR_MS + 60_000;
  const st = auth.handle(mk(p, at('stand-tir'), T, s), 'range.start', { weapon: 'pistolet', compet: true });
  assert.ok(st.ok);
  assert.equal(p.coins, c0 - RANGE.compet.fee);
  const targets = rangeTargets(st.data.seed);
  const t0 = T + RANGE.countdown * 1000;
  let shots = 0;
  for (const tg of targets) {
    if (shots >= RANGE_WEAPONS.pistolet.ammo) break;
    if (tg.kind === 'otage') continue;
    const r = auth.handle(mk(p, at('stand-tir'), t0 + (tg.t + 0.2) * 1000, s), 'range.shot', { i: tg.i, ratio: 0.1 });
    assert.ok(r.ok);
    shots++;
  }
  // une cible déjà touchée ou pas encore visible ne rapporte rien
  const late = targets.at(-1);
  const early = auth.handle(mk(p, at('stand-tir'), t0 + 100, s), 'range.shot', { i: late.i, ratio: 0 });
  assert.ok(!early.ok || early.data.pts === 0);
  const fin = auth.handle(mk(p, at('stand-tir'), t0 + (RANGE.duration + 0.5) * 1000, s), 'range.finish', {});
  assert.ok(fin.ok);
  assert.ok(fin.data.score > 0 && fin.data.score <= rangeMax(targets));
  assert.ok(fin.data.compet.rivals.some((x) => x.me) && fin.data.compet.rivals.filter((x) => x.npc).length === RANGE.compet.rivals, 'rivaux PNJ affichés comme tels');
  assert.equal(p.leisure.range.plays, 1);
});
