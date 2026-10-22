// Tests du karting : adhésions et réductions, sessions payantes, tours validés par les portes
// (ordre, temps minimal), course : grille PNJ déterministe, classement, prix, inscription obligatoire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { occurrences } from '../../shared/calendar.js';
import { HOUR_MS } from '../../shared/clock.js';
import { GATES, TRACK_LENGTH, raceField, RACES, FORMULAS, sessionPrice } from '../../shared/karting.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-22T09:00:00Z');
const auth = new Authority(buildContent(NOW));
const stand = BUILDING_BY_ID['circuit-stand'];
const atStand = { x: stand.door.x, y: 0, z: stand.door.z };
const mk = (p, pos, now, session) => ({ profile: p, session, now, pos: pos ? { ...pos } : null, zone: 'world', rand: mulberry32(9), newId: () => 'x' });
const prof = (id) => { const p = auth.newProfile({ id, name: 'Pilote', appearance: {}, now: 0 }); p.coins = 20_000; return p; };
// fait rouler le joueur sur `laps` tours en `lapSec` secondes chacun (positions aux portes)
function drive(p, s, t0, laps, lapSec) {
  let t = t0;
  const step = (lapSec * 1000) / GATES.length;
  for (let l = 0; l < laps; l++) for (let i = 0; i < GATES.length; i++) { auth.onPosition(mk(p, { x: GATES[i].x, y: 0, z: GATES[i].z }, t, s)); t += step; }
  auth.onPosition(mk(p, { x: GATES[0].x, y: 0, z: GATES[0].z }, t, s));
  return t;
}

test('tracé : longueur et portes', () => {
  assert.ok(TRACK_LENGTH > 280 && TRACK_LENGTH < 360, `${TRACK_LENGTH}`);
  assert.equal(GATES.length, 8);
});

test('adhésion : réductions sur les sessions', () => {
  assert.equal(sessionPrice(100, null), 100);
  assert.equal(sessionPrice(100, { kind: 'mensuel' }), 50);
  assert.equal(sessionPrice(100, { kind: 'premium' }, true), 15);
  const p = prof('k1');
  assert.equal(auth.handle(mk(p, null, NOW, {}), 'kart.member', { kind: 'mensuel' }).ok, false, 'à l\'accueil seulement');
  assert.ok(auth.handle(mk(p, atStand, NOW, {}), 'kart.member', { kind: 'mensuel' }).ok);
  assert.equal(p.karting.member.kind, 'mensuel');
  const s = {};
  const c0 = p.coins;
  const r = auth.handle(mk(p, atStand, NOW, s), 'kart.start', { formula: 'train-10', kart: 'kart-sport' });
  assert.ok(r.ok);
  assert.ok(c0 - p.coins <= FORMULAS['train-10'].price * 0.5 + 1, 'adhérent : moitié prix');
});

test('session : tours chronométrés, triche refusée', () => {
  const p = prof('k2');
  const s = {};
  assert.ok(auth.handle(mk(p, atStand, NOW, s), 'kart.start', { formula: 'train-10' }).ok);
  let t = drive(p, s, NOW + 5000, 3, 24);
  // tour impossible (5 s) : ignoré
  t = drive(p, s, t + 100, 1, 5);
  assert.equal(s.kart.laps.length, 3, `tours valides : ${s.kart.laps}`);
  // portes dans le désordre : pas de tour
  for (const i of [0, 4, 0]) auth.onPosition(mk(p, { x: GATES[i].x, y: 0, z: GATES[i].z }, (t += 15_000), s));
  assert.equal(s.kart.laps.length, 3);
  const f = auth.handle(mk(p, atStand, t, s), 'kart.finish', {});
  assert.ok(f.ok && Math.abs(f.data.best - 24) < 0.5);
  assert.equal(p.karting.best, f.data.best);
});

test('course du jour : grille PNJ, classement, prix', () => {
  const o = occurrences(NOW, NOW + 7 * 24 * HOUR_MS).find((x) => x.id === 'course-jour');
  const T = o.start + 60_000;
  const p = prof('k3');
  const s = {};
  assert.match(auth.handle(mk(p, atStand, o.start - HOUR_MS, s), 'kart.race', { race: 'course-jour' }).error, /pas de départ/);
  const r = auth.handle(mk(p, atStand, T, s), 'kart.race', { race: 'course-jour' });
  assert.ok(r.ok);
  assert.deepEqual(r.data.field, raceField(r.data.seed, 'course-jour'), 'grille identique côté client');
  // le joueur roule très vite : 4 tours de 15 s
  const t = drive(p, s, r.data.green + 500, RACES['course-jour'].laps, 15);
  const c0 = p.coins;
  const f = auth.handle(mk(p, atStand, t + 1000, s), 'kart.finish', {});
  assert.equal(f.data.place, 1);
  assert.equal(p.coins - c0, RACES['course-jour'].prizes[0]);
  assert.ok(f.data.ranking.filter((x) => x.npc).length === RACES['course-jour'].field);
});

test('Grand Prix : inscription obligatoire', () => {
  const o = occurrences(NOW, NOW + 14 * 24 * HOUR_MS).find((x) => x.id === 'kart-gp');
  const p = prof('k4');
  const T = o.start + 60_000;
  assert.match(auth.handle(mk(p, atStand, T, {}), 'kart.race', { race: 'kart-gp' }).error, /Inscription/);
  assert.ok(auth.handle(mk(p, atStand, T, {}), 'cal.register', { occ: o.occ }).ok);
  assert.ok(auth.handle(mk(p, atStand, T, {}), 'kart.race', { race: 'kart-gp' }).ok);
});
