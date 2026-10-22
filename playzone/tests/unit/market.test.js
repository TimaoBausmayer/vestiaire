// Tests des marchés (stands du jour, achat en liquide, négociation, quantités) et des jeux de cour
// (partie au parc, prises espacées, score borné par la durée réelle).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { occurrences, CAL_BY_ID } from '../../shared/calendar.js';
import { HOUR_MS } from '../../shared/clock.js';
import { marketStalls, haggle, VENDORS } from '../../shared/market.js';
import { PLAYGROUND, COUR_GAMES } from '../../shared/playground.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-22T09:00:00Z');
const content = buildContent(NOW);
const auth = new Authority(content);
const mk = (p, pos, now, session) => ({ profile: p, session, now, pos: pos ? { ...pos } : null, zone: 'world', rand: mulberry32(4), newId: () => 'x' });
const prof = (id) => { const p = auth.newProfile({ id, name: 'Chineur', appearance: {}, now: 0 }); p.coins = 10_000; p.cash = 2000; return p; };

test('marché : stands déterministes, offre du jour, prix réduits', () => {
  const o = occurrences(NOW, NOW + 7 * 24 * HOUR_MS).find((x) => CAL_BY_ID[x.id].kind === 'market');
  const a = marketStalls(o.occ, CAL_BY_ID[o.id].market, content.items);
  const b = marketStalls(o.occ, CAL_BY_ID[o.id].market, content.items);
  assert.deepEqual(a, b);
  for (const st of a) for (const it of st.items) assert.ok(it.price <= it.base);
  assert.ok(a.some((st) => st.items.some((it) => it.flash)));
});

test('négociation : le caractère du vendeur compte', () => {
  assert.equal(haggle('maraicher', 0.1, 0).ok, true);
  assert.equal(haggle('collectionneuse', 0.2, 0).ok, false);
  assert.equal(haggle('brocanteur', 0.1, VENDORS.brocanteur.patience).done, true, 'patience épuisée');
});

test('achat au stand : ouvert, devant le stand, liquide, quantité limitée', () => {
  const o = occurrences(NOW, NOW + 7 * 24 * HOUR_MS).find((x) => CAL_BY_ID[x.id].kind === 'market');
  const st = marketStalls(o.occ, CAL_BY_ID[o.id].market, content.items)[0];
  const it = st.items[0];
  const front = { x: st.slot.x + Math.sin(st.slot.ry) * 1.6, y: 0, z: st.slot.z + Math.cos(st.slot.ry) * 1.6 };
  const p = prof('m1'), s = {};
  assert.match(auth.handle(mk(p, front, o.start - HOUR_MS, s), 'market.buy', { occ: o.occ, stall: st.id, item: it.id }).error, /fermé/);
  const T = o.start + 60_000;
  assert.match(auth.handle(mk(p, { x: 100, y: 0, z: 100 }, T, s), 'market.buy', { occ: o.occ, stall: st.id, item: it.id }).error, /Approche/);
  const h = auth.handle(mk(p, front, T, s), 'market.haggle', { occ: o.occ, stall: st.id, item: it.id, off: 0.05 });
  assert.ok(h.ok);
  const cash0 = p.cash;
  const r = auth.handle(mk(p, front, T, s), 'market.buy', { occ: o.occ, stall: st.id, item: it.id, pay: 'cash' });
  assert.ok(r.ok, r.error);
  assert.equal(cash0 - p.cash, h.data.ok ? h.data.price : it.price, 'prix négocié payé en liquide');
  assert.equal(p.inventory[it.id] >= 1, true);
  for (let i = 0; i < 10; i++) auth.handle(mk(p, front, T, s), 'market.buy', { occ: o.occ, stall: st.id, item: it.id });
  assert.ok(p.market.bought[`${st.id}|${it.id}`] <= it.qty);
});

test('jeux de cour : au parc seulement, prises espacées, score borné', () => {
  const p = prof('c1'), s = {};
  const park = { x: PLAYGROUND.x, y: 0, z: PLAYGROUND.z };
  assert.equal(auth.handle(mk(p, { x: 0, y: 0, z: 0 }, NOW, s), 'cour.start', { game: 'loup' }).ok, false);
  assert.ok(auth.handle(mk(p, park, NOW, s), 'cour.start', { game: 'loup' }).ok);
  const G = COUR_GAMES.loup;
  for (let i = 0; i < 20; i++) auth.handle(mk(p, park, NOW + (G.count + 1) * 1000 + i * 200, s), 'cour.catch', {});
  assert.equal(s.cour.n, 3, 'pas plus d\'une prise toutes les 1,5 s');
  const f = auth.handle(mk(p, park, NOW + (G.count + 10) * 1000, s), 'cour.finish', {});
  assert.equal(f.data.score, 3);
  assert.equal(f.data.won, false);
  // cache-cache : on ne peut pas déclarer plus que le temps réellement écoulé
  const s2 = {};
  auth.handle(mk(p, park, NOW, s2), 'cour.start', { game: 'cachette' });
  const f2 = auth.handle(mk(p, park, NOW + (COUR_GAMES.cachette.count + 30) * 1000, s2), 'cour.finish', { survived: 90 });
  assert.ok(f2.data.score <= 31 && !f2.data.won);
});
