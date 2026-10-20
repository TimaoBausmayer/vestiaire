// Tests du corps : blessures, KO et hôpital, poids selon l'alimentation, muscles (pompes, machines),
// âge (vieillissement, clinique), coiffeur, parfum, attirance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID, BUILDINGS } from '../../shared/world-layout.js';
import { bodyEffects, attractiveness, AGE_MINUTES } from '../../shared/body.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const content = buildContent(NOW);
const auth = new Authority(content);
const at = (b) => ({ x: b.x, y: 0, z: b.z });
const mk = (p, pos, now = NOW, session = {}) => ({ profile: p, session, now, pos, zone: 'world', rand: mulberry32(5), newId: () => 'x' });
const gym = BUILDINGS.find((b) => b.interior === 'gym');
const hosp = BUILDING_BY_ID.hopital;
const prof = (id) => { const p = auth.newProfile({ id, name: 'Sportif', appearance: {}, now: 0, age: 25 }); p.coins = 100_000; return p; };

test('âge de départ choisi, vieillissement en jouant, clinique', () => {
  const p = prof('a1');
  assert.equal(p.body.age, 25);
  auth.startSession(p, NOW);
  let t = NOW;
  for (let i = 0; i < AGE_MINUTES / 3 + 1; i++) { t += 3 * 60_000; auth.handle(mk(p, null, t), 'bills.tick', {}); }
  assert.equal(p.body.age, 26, 'un an de plus après 6 h de jeu');
  assert.equal(auth.handle(mk(p, { x: 0, y: 0, z: 0 }), 'clinic.age', { action: 'choose', age: 30 }).ok, false, 'à la clinique seulement');
  assert.ok(auth.handle(mk(p, at(hosp)), 'clinic.age', { action: 'choose', age: 30 }).ok);
  assert.ok(auth.handle(mk(p, at(hosp)), 'clinic.age', { action: 'freeze' }).ok);
  for (let i = 0; i < AGE_MINUTES / 3 + 1; i++) { t += 3 * 60_000; auth.handle(mk(p, null, t), 'bills.tick', {}); }
  assert.equal(p.body.age, 30, 'âge figé');
});

test('chutes et accidents : blessures, KO, hôpital', () => {
  const p = prof('a2');
  assert.equal(auth.handle(mk(p, null), 'body.hurt', { cause: 'fall', value: 3 }).data.kind, undefined, 'petite chute : rien');
  const r = auth.handle(mk(p, null, NOW + 5000), 'body.hurt', { cause: 'fall', value: 10 });
  assert.equal(r.data.kind, 'fracture');
  assert.ok(bodyEffects(p.body).noJump && bodyEffects(p.body).speed < 0.7, 'fracture : lent, pas de saut');
  assert.equal(auth.handle(mk(p, null, NOW + 5500), 'body.hurt', { cause: 'fall', value: 10 }).changed, false, 'pas deux blessures d\'affilée');
  // soins à l'hôpital
  assert.equal(auth.handle(mk(p, { x: 0, y: 0, z: 0 }), 'hospital.treat', {}).ok, false);
  const c0 = p.coins;
  const t = auth.handle(mk(p, at(hosp)), 'hospital.treat', {});
  assert.ok(t.ok && !p.body.injury && p.body.health === 100);
  assert.ok(c0 - p.coins >= 480);
  // KO : santé à zéro → réveil à l'hôpital, facture
  p.body.health = 0;
  const ko = auth.handle(mk(p, null), 'body.ko', {});
  assert.ok(ko.ok && p.body.health === 60 && ko.data.at);
});

test('trop manger fait grossir, ne pas manger fait maigrir', () => {
  const p = prof('a3');
  p.inventory['menu-geant'] = 10;
  p.needs = { faim: 95, energie: 80, humeur: 80, hygiene: 80, at: NOW };
  const w0 = p.body.weight;
  auth.handle(mk(p, null), 'food.eat', { itemId: 'menu-geant' });
  assert.ok(p.body.weight > w0, 'grossit en mangeant sans faim');
  p.needs = { faim: 0, energie: 80, humeur: 80, hygiene: 80, at: NOW };
  auth.startSession(p, NOW);
  for (let i = 1; i <= 40; i++) auth.handle(mk(p, null, NOW + i * 60_000), 'bills.tick', {});
  assert.ok(p.body.weight < w0, 'maigrit sans manger');
});

test('pompes (rythme limité) et salle de sport (abonnement, machine)', () => {
  const p = prof('a4');
  const s = {};
  const m0 = p.body.muscle;
  const r = auth.handle(mk(p, null, NOW, s), 'body.pushups', { reps: 30 });
  assert.ok(r.ok && r.data.reps <= 30);
  const r2 = auth.handle(mk(p, null, NOW + 1200, s), 'body.pushups', { reps: 30 });
  assert.ok(r2.data.reps <= 3, 'pas plus vite qu\'une pompe toutes les 0,6 s');
  assert.ok(p.body.muscle > m0);
  assert.match(auth.handle(mk(p, at(gym), NOW, s), 'gym.start', { machine: 'banc' }).error, /abonnement/);
  assert.ok(auth.handle(mk(p, at(gym), NOW, s), 'gym.pass', { kind: 'jour' }).ok);
  assert.ok(auth.handle(mk(p, at(gym), NOW, s), 'gym.start', { machine: 'banc' }).ok);
  const m1 = p.body.muscle;
  const st = auth.handle(mk(p, at(gym), NOW + 5 * 60_000, s), 'gym.stop', {});
  assert.ok(st.ok && st.data.minutes > 4 && p.body.muscle > m1 + 1, `muscles +${st.data.muscle.toFixed(2)}`);
});

test('coiffeur, parfum et attirance', () => {
  const p = prof('a5');
  const base = attractiveness(p, content.items, NOW).total;
  assert.equal(auth.handle(mk(p, { x: 0, y: 0, z: 0 }), 'hair.cut', { hair: 'afro', hairColor: p.appearance.hairColor }).ok, false);
  assert.ok(auth.handle(mk(p, at(BUILDING_BY_ID.coiffeur)), 'hair.cut', { hair: 'afro', hairColor: p.appearance.hairColor }).ok);
  assert.equal(p.appearance.hair, 'afro');
  p.inventory['parfum-paillettes'] = 1;
  assert.ok(auth.handle(mk(p, null), 'perfume.use', { itemId: 'parfum-paillettes' }).ok);
  p.inventory['baskets-luxe'] = 1; p.inventory['veste-luxe'] = 1;
  auth.handle(mk(p, null), 'avatar.update', { appearance: { ...p.appearance, feet: 'baskets-luxe', top: 'veste-luxe' } });
  assert.equal(p.appearance.feet, 'baskets-luxe');
  const after = attractiveness(p, content.items, NOW + 1000).total;
  assert.ok(after >= base + 25, `plus attirant (${base} -> ${after})`);
  const dirty = attractiveness(p, content.items, NOW + 1000, 10).total;
  assert.ok(dirty <= after - 20, 'la saleté fait fuir');
});
