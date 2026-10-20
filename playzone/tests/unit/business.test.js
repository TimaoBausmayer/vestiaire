// Tests des entreprises (création, gestion, faillite), marque de vêtements, bourse, investissements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { stockPrice, marketNews, companyHour, sharePrice, STOCKS } from '../../shared/business.js';
import { CompanyRegistry } from '../../server/companies.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const auth = new Authority(buildContent(NOW));
const mairie = BUILDING_BY_ID.mairie;
const at = (b) => ({ x: b.x, y: 0, z: b.z });
const mk = (p, pos, now = NOW, extra = {}) => ({ profile: p, session: {}, now, pos, zone: 'world', rand: mulberry32(9), newId: () => `id${Math.random()}`, ...extra });
const rich = (id, name = 'Patron') => { const p = auth.newProfile({ id, name, appearance: {}, now: 0 }); p.coins = 200_000; return p; };

test('créer une entreprise : à la mairie, capital minimum, nom filtré', () => {
  const p = rich('e1');
  assert.equal(auth.handle(mk(p, { x: 0, y: 0, z: 0 }), 'company.create', { name: 'Pizza Bob', sector: 'restaurant', capital: 5000 }).ok, false);
  assert.equal(auth.handle(mk(p, at(mairie)), 'company.create', { name: 'Pizza Bob', sector: 'restaurant', capital: 100 }).ok, false);
  assert.equal(auth.handle(mk(p, at(mairie)), 'company.create', { name: 'merde', sector: 'restaurant', capital: 5000 }).ok, false);
  const r = auth.handle(mk(p, at(mairie)), 'company.create', { name: 'Pizza Bob', sector: 'restaurant', capital: 10000 });
  assert.ok(r.ok, r.error);
  assert.equal(p.coins, 200_000 - 10_500);
});

test('une entreprise bien gérée gagne de l\'argent pendant qu\'on joue, une mal gérée fait faillite', () => {
  const good = rich('e2');
  auth.handle(mk(good, at(mairie)), 'company.create', { name: 'Burger Royal', sector: 'restaurant', capital: 20000 });
  for (const [a, v] of [['staff', 1], ['staff', 1], ['marketing', 3], ['quality', 0], ['quality', 0]]) assert.ok(auth.handle(mk(good, null), 'company.manage', { action: a, value: v }).ok);
  assert.ok(companyHour(good.company, NOW).profit > 0, 'rentable');
  auth.startSession(good, NOW);
  const cash0 = good.company.cash;
  for (let i = 1; i <= 60; i++) auth.handle(mk(good, null, NOW + i * 60_000), 'bills.tick', {});
  assert.ok(good.company.cash > cash0, `trésorerie en hausse (${Math.round(cash0)} -> ${Math.round(good.company.cash)})`);
  // dividendes
  const c0 = good.coins;
  assert.ok(auth.handle(mk(good, null), 'company.manage', { action: 'withdraw', value: 1000 }).ok);
  assert.equal(good.coins, c0 + 1000);
  // mauvaise gestion : 25 employés, aucune qualité, pub max
  const bad = rich('e3');
  auth.handle(mk(bad, at(mairie)), 'company.create', { name: 'Tech Ratée', sector: 'tech', capital: 5000 });
  for (let i = 0; i < 24; i++) auth.handle(mk(bad, null), 'company.manage', { action: 'staff', value: 1 });
  auth.handle(mk(bad, null), 'company.manage', { action: 'marketing', value: 5 });
  auth.startSession(bad, NOW);
  let t = NOW;
  for (let i = 0; i < 300 && !bad.company.bankrupt; i++) { t += 60_000; auth.handle(mk(bad, null, t), 'bills.tick', {}); }
  assert.ok(bad.company.bankrupt, 'faillite');
  assert.equal(bad.career.history.at(-1).end, 'faillite');
});

test('marque de vêtements : créer un modèle et le porter', () => {
  const p = rich('e4');
  auth.handle(mk(p, at(mairie)), 'company.create', { name: 'Moustache Wear', sector: 'mode', capital: 10000 });
  assert.ok(auth.handle(mk(p, null), 'company.design', { name: 'Sweat Royal', style: 'sweat', color: '#5b3fa6' }).ok);
  const h0 = companyHour(p.company, NOW).clients;
  assert.ok(auth.handle(mk(p, null), 'company.wear', { index: 0 }).ok);
  assert.equal(p.appearance.top, 'sweat');
  assert.equal(p.appearance.topColor, '#5b3fa6');
  assert.equal(p.brandWorn.brand, 'Moustache Wear');
  assert.ok(h0 >= 0);
});

test('bourse : cours déterministes, achat et revente avec frais, actualités', () => {
  for (const s of STOCKS) {
    const a = stockPrice(s.sym, NOW), b = stockPrice(s.sym, NOW);
    assert.equal(a, b);
    assert.ok(a > s.base * 0.3 && a < s.base * 3, `${s.sym} raisonnable (${a})`);
  }
  assert.notEqual(stockPrice('PLAY', NOW), stockPrice('PLAY', NOW + 3 * 3600_000));
  assert.ok(marketNews(NOW).length > 0);
  const p = rich('e5');
  const r = auth.handle(mk(p, null), 'stock.buy', { sym: 'PLAY', n: 10 });
  assert.ok(r.ok);
  const later = NOW + 90 * 60_000;
  const s = auth.handle(mk(p, null, later), 'stock.sell', { sym: 'PLAY', n: 10 });
  assert.ok(s.ok);
  assert.equal(p.stocks.PLAY, undefined);
  assert.ok(Math.abs(s.data.gain - stockPrice('PLAY', later) * 10 * 0.995) < 1);
});

test('investir dans l\'entreprise d\'un autre joueur (registre en ligne)', () => {
  const server = { db: { allProfiles: () => [], profileById: () => null, saveProfile: () => {} }, online: new Map() };
  const reg = new CompanyRegistry(server);
  const owner = rich('e6', 'Patronne');
  const inv = rich('e7', 'Investisseur');
  server.online.set(owner.id, { profile: owner, send: () => {}, dirty: false });
  auth.handle(mk(owner, at(mairie), NOW, { companies: reg }), 'company.create', { name: 'Glaces Polaires', sector: 'restaurant', capital: 20000 });
  assert.equal(auth.handle(mk(inv, null, NOW, { companies: reg }), 'invest.buy', { companyId: owner.company.id, n: 10 }).ok, false, 'pas encore d\'actions proposées');
  assert.ok(auth.handle(mk(owner, null, NOW, { companies: reg }), 'company.manage', { action: 'float', value: 250 }).ok);
  const cash0 = owner.company.cash;
  const price = sharePrice(owner.company, NOW);
  const r = auth.handle(mk(inv, null, NOW, { companies: reg }), 'invest.buy', { companyId: owner.company.id, n: 10 });
  assert.ok(r.ok, r.error);
  assert.equal(owner.company.cash, cash0 + Math.ceil(price * 10), 'l\'argent entre dans la trésorerie');
  assert.equal(owner.company.sold, 10);
  assert.equal(auth.handle(mk(owner, null, NOW, { companies: reg }), 'company.close', {}).ok, false, 'pas de fermeture avec des investisseurs');
  const s = auth.handle(mk(inv, null, NOW, { companies: reg }), 'invest.sell', { companyId: owner.company.id, n: 10 });
  assert.ok(s.ok, s.error);
  assert.equal(owner.company.sold, 0);
});
