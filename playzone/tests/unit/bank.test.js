// Tests de la banque : distributeurs, liquide, paiement en espèces, livret d'épargne, échelle de temps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { ATMS } from '../../shared/property.js';
import { START_COINS, START_CASH } from '../../shared/rules.js';
import { mulberry32 } from '../../shared/rng.js';
import { gameHour, HOUR_MS, CYCLE_MS } from '../../src/world/daynight.js';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const auth = new Authority(buildContent(NOW));
const mk = (p, pos, now = NOW) => ({ profile: p, session: {}, now, pos, zone: 'world', rand: mulberry32(1), newId: () => 'x' });

test('nouveau joueur : argent sur le compte et un peu de liquide', () => {
  const p = auth.newProfile({ id: 'b0', name: 'Banquier', appearance: {}, now: 0 });
  assert.equal(p.coins, START_COINS);
  assert.equal(p.cash, START_CASH);
});

test('retrait et dépôt : seulement au distributeur ou à la banque', () => {
  const p = auth.newProfile({ id: 'b1', name: 'Retrait', appearance: {}, now: 0 });
  assert.equal(auth.handle(mk(p, { x: 0, y: 0, z: 0 }), 'bank.withdraw', { amount: 100 }).ok, false);
  const a = ATMS[0];
  const r = auth.handle(mk(p, { x: a.x, y: 0, z: a.z }), 'bank.withdraw', { amount: 300 });
  assert.ok(r.ok, r.error);
  assert.equal(p.coins, START_COINS - 300);
  assert.equal(p.cash, START_CASH + 300);
  const bank = BUILDING_BY_ID.banque;
  assert.ok(auth.handle(mk(p, { x: bank.x, y: 0, z: bank.z }), 'bank.deposit', { amount: 50 }).ok);
  assert.equal(p.cash, START_CASH + 250);
  assert.equal(auth.handle(mk(p, { x: a.x, y: 0, z: a.z }), 'bank.withdraw', { amount: 999999 }).ok, false, 'plafond de retrait');
});

test('payer en espèces dans une boutique', () => {
  const p = auth.newProfile({ id: 'b2', name: 'Espèces', appearance: {}, now: 0 });
  const f = BUILDING_BY_ID.fringues;
  const c0 = p.coins, cash0 = p.cash;
  assert.ok(auth.handle(mk(p, { x: f.door.x, y: 0, z: f.door.z }), 'shop.buy', { itemId: 'casquette', pay: 'cash' }).ok);
  assert.equal(p.coins, c0, 'compte inchangé');
  assert.equal(p.cash, cash0 - 60);
  p.cash = 5;
  assert.match(auth.handle(mk(p, { x: f.door.x, y: 0, z: f.door.z }), 'shop.buy', { itemId: 'bonnet', pay: 'cash' }).error, /liquide/);
});

test('livret d\'épargne : intérêts à chaque minute de jeu', () => {
  const p = auth.newProfile({ id: 'b3', name: 'Epargne', appearance: {}, now: 0 });
  p.coins = 100_000;
  assert.ok(auth.handle(mk(p, null), 'bank.save', { amount: 100_000 }).ok);
  auth.startSession(p, NOW);
  for (let i = 1; i <= 240; i++) auth.handle(mk(p, null, NOW + i * 60_000), 'bills.tick', {});
  assert.ok(p.savings > 101_900 && p.savings < 102_100, `≈ +2 % en une journée de jeu (${p.savings})`);
});

test('échelle de temps : 10 minutes réelles = 1 heure de jeu', () => {
  assert.equal(HOUR_MS, 600_000);
  assert.equal(CYCLE_MS, 24 * 600_000);
  const t0 = CYCLE_MS * 1000;
  assert.equal(gameHour(t0), 7);
  assert.equal(gameHour(t0 + 10 * 60_000), 8);
  assert.equal(gameHour(t0 + 17 * HOUR_MS), 0);
});
