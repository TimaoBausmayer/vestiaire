// Tests des carrières : diplôme requis, formation (présence à l'école) + examen, pointage, paie au temps
// de présence, tâches, augmentation, renvoi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID, BUILDINGS } from '../../shared/world-layout.js';
import { TRAININGS, JOB_BY_ID2 as JOBS, wagePerMinute } from '../../shared/careers.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const auth = new Authority(buildContent(NOW));
const school = BUILDINGS.find((b) => b.interior === 'school');
const hyper = BUILDING_BY_ID.hyper;
const garage = BUILDING_BY_ID.piston;
const at = (b) => ({ x: b.x, y: 0, z: b.z });
function mk(p, session) { return (pos, now) => ({ profile: p, session, now, pos, zone: 'world', rand: mulberry32(3), newId: () => 'x' }); }
// avance le temps en restant au même endroit (positions validées toutes les secondes)
function stay(ctxf, pos, from, ms) { for (let t = from; t <= from + ms; t += 1000) auth.onPosition(ctxf(pos, t)); return from + ms; }

test('emploi sans diplôme : postuler, pointer, être payé au temps de présence', () => {
  const p = auth.newProfile({ id: 'c1', name: 'Caissier', appearance: {}, now: 0 });
  const ctx = mk(p, {});
  assert.equal(auth.handle(ctx({ x: 0, y: 0, z: 0 }, NOW), 'career.apply', { jobId: 'caissier', buildingId: 'hyper' }).ok, false, 'entretien sur place');
  assert.ok(auth.handle(ctx(at(hyper), NOW), 'career.apply', { jobId: 'caissier', buildingId: 'hyper' }).ok);
  assert.ok(auth.handle(ctx(at(hyper), NOW), 'career.clockIn', {}).ok);
  const c0 = p.coins;
  let t = stay(ctx, at(hyper), NOW, 10 * 60_000); // une heure de jeu
  const r = auth.handle(ctx(at(hyper), t), 'career.tick', {});
  assert.ok(r.ok);
  const expected = wagePerMinute(JOBS.caissier) * 10 * (0.8 + 0.35 * (p.career.job.perf / 100));
  assert.ok(Math.abs(p.coins - c0 - expected) < 3 + 0.2 * expected, `≈ salaire d'une heure de jeu (${p.coins - c0} / ${Math.round(expected)})`);
  // absent : pas payé
  const c1 = p.coins;
  t = stay(ctx, { x: 0, y: 0, z: 0 }, t, 5 * 60_000);
  auth.handle(ctx({ x: 0, y: 0, z: 0 }, t), 'career.tick', {});
  assert.ok(p.coins - c1 < 5, 'pas de salaire hors du lieu de travail');
});

test('poste qualifié : formation à l\'école, examen, puis embauche', () => {
  const p = auth.newProfile({ id: 'c2', name: 'Meca', appearance: {}, now: 0 });
  p.coins = 5000;
  const ctx = mk(p, {});
  assert.match(auth.handle(ctx(at(garage), NOW), 'career.apply', { jobId: 'mecanicien', buildingId: 'piston' }).error, /diplôme/);
  assert.ok(auth.handle(ctx(at(school), NOW), 'career.train', { id: 'cap-meca' }).ok);
  assert.equal(p.coins, 5000 - TRAININGS['cap-meca'].cost);
  // pas assez de présence : examen refusé
  assert.equal(auth.handle(ctx(at(school), NOW + 1000), 'career.exam', { answers: [0, 0, 1, 0] }).ok, false);
  const t = stay(ctx, at(school), NOW, TRAININGS['cap-meca'].minutes * 60_000 + 2000);
  // mauvaises réponses : échec, il faut réviser la moitié
  const bad = auth.handle(ctx(at(school), t), 'career.exam', { answers: [1, 1, 0, 1] });
  assert.ok(bad.ok && !bad.data.passed);
  const t2 = stay(ctx, at(school), t, TRAININGS['cap-meca'].minutes * 30_000 + 2000);
  const good = auth.handle(ctx(at(school), t2), 'career.exam', { answers: TRAININGS['cap-meca'].questions.map((q) => q[2]) });
  assert.ok(good.data.passed);
  assert.ok(p.career.diplomas.includes('cap-meca'));
  assert.ok(auth.handle(ctx(at(garage), t2), 'career.apply', { jobId: 'mecanicien', buildingId: 'piston' }).ok);
});

test('tâches, augmentation et renvoi', () => {
  const p = auth.newProfile({ id: 'c3', name: 'Serveur', appearance: {}, now: 0 });
  const piz = BUILDING_BY_ID.pizzeria;
  const session = {};
  const ctx = mk(p, session);
  auth.handle(ctx(at(piz), NOW), 'career.apply', { jobId: 'serveur', buildingId: 'pizzeria' });
  auth.handle(ctx(at(piz), NOW), 'career.clockIn', {});
  assert.ok(session.shift.task, 'une tâche dès le début');
  const r = auth.handle(ctx(at(piz), NOW + 5000), 'career.task', {});
  assert.ok(r.ok && r.data.tip > 0);
  // trop tôt pour une augmentation
  assert.equal(auth.handle(ctx(at(piz), NOW + 6000), 'career.raise', {}).data.answer, 'tooSoon');
  // excellent employé après 20 min : augmentation
  p.career.job.perf = 95; p.career.job.sinceRaise = 25;
  const up = auth.handle(ctx(at(piz), NOW + 7000), 'career.raise', {});
  assert.equal(up.data.answer, 'yes');
  assert.equal(p.career.job.raise, 0.1);
  // on ne fait plus rien : tâches ratées et absence → renvoi
  let t = NOW + 10_000;
  for (let i = 0; i < 40 && p.career.job; i++) { t = stay(ctx, { x: 0, y: 0, z: 0 }, t, 70_000); auth.handle(ctx({ x: 0, y: 0, z: 0 }, t), 'career.tick', {}); }
  assert.equal(p.career.job, null, 'renvoyé');
  assert.equal(p.career.fired.at(-1).id, 'serveur');
  assert.match(auth.handle(ctx(at(piz), t), 'career.apply', { jobId: 'serveur', buildingId: 'pizzeria' }).error, /renvoyé/);
});
