// Tests de l'autorité partagée (économie, métiers, mini-jeux, triche refusée).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID, POI, MINIGAME_SPOTS, SECRETS } from '../../shared/world-layout.js';
import { pieTargets, invasionChickenPos } from '../../shared/minigame-logic.js';
import { EventDirector } from '../../shared/events-director.js';
import { mulberry32 } from '../../shared/rng.js';
import { censor, isClean, hasPersonalInfo } from '../../shared/chat-filter.js';

const content = buildContent(Date.parse('2026-10-19T12:00:00Z'));
const auth = new Authority(content);
let idn = 0;
function mkctx(profile, pos, now = 1_000_000) {
  return { profile, session: {}, now, pos, rand: mulberry32(42), newId: () => `id${++idn}`, leaderboard: null };
}
const at = (b) => ({ x: b.door.x, y: 0, z: b.door.z });

test('création de profil et nom filtré', () => {
  assert.throws(() => auth.newProfile({ id: 'a', name: 'ab', appearance: {}, now: 0 }));
  assert.throws(() => auth.newProfile({ id: 'a', name: 'merde', appearance: {}, now: 0 }));
  const p = auth.newProfile({ id: 'a', name: 'Lulu', appearance: { hat: 'couronne' }, now: 0 });
  assert.equal(p.coins, 200);
  assert.equal(p.appearance.hat, null, 'un chapeau non possédé est refusé');
});

test('achat : position, argent, niveau, puis équipement', () => {
  const p = auth.newProfile({ id: 'b', name: 'Bob', appearance: {}, now: 0 });
  const ctxFar = mkctx(p, { x: 0, y: 0, z: 0 });
  assert.equal(auth.handle(ctxFar, 'shop.buy', { itemId: 'casquette' }).ok, false, 'loin de la boutique');
  const ctx = mkctx(p, at(BUILDING_BY_ID.fringues));
  assert.equal(auth.handle(ctx, 'shop.buy', { itemId: 'haut-de-forme' }).error, 'Niveau 3 requis.');
  const r = auth.handle(ctx, 'shop.buy', { itemId: 'casquette' });
  assert.ok(r.ok);
  assert.equal(p.coins, 140);
  assert.equal(auth.handle(ctx, 'shop.buy', { itemId: 'casquette' }).ok, false, 'pas deux fois le même chapeau');
  auth.handle(ctx, 'avatar.update', { appearance: { ...p.appearance, hat: 'casquette' } });
  assert.equal(p.appearance.hat, 'casquette');
  p.coins = 10;
  assert.equal(auth.handle(ctx, 'shop.buy', { itemId: 'bonnet' }).error, 'Pas assez de PlayCoins.');
  const s = auth.handle(ctx, 'shop.sell', { itemId: 'casquette' });
  assert.ok(s.ok);
  assert.equal(p.coins, 10 + 24);
  assert.equal(p.appearance.hat, null, 'objet vendu = déséquipé');
});

test('livreur : le colis doit être récupéré puis livré devant la bonne porte', () => {
  const p = auth.newProfile({ id: 'c', name: 'Cléo', appearance: {}, now: 0 });
  const ctx = mkctx(p, { x: POI.depot.x, y: 0, z: POI.depot.z });
  const st = auth.handle(ctx, 'job.start', { jobId: 'delivery', missionId: 'standard' });
  assert.ok(st.ok, st.error);
  const m = st.data.mission;
  assert.equal(auth.handle(ctx, 'job.step', { missionId: m.id, action: 'deliver', stop: m.stops[0].id }).ok, false, 'pas encore ramassé');
  assert.ok(auth.handle(ctx, 'job.step', { missionId: m.id, action: 'pickup' }).ok);
  assert.equal(auth.handle(ctx, 'job.step', { missionId: m.id, action: 'deliver', stop: m.stops[0].id }).ok, false, 'pas devant la porte');
  ctx.pos = { x: m.stops[0].x, y: 0, z: m.stops[0].z };
  ctx.now += 30_000;
  const d = auth.handle(ctx, 'job.step', { missionId: m.id, action: 'deliver', stop: m.stops[0].id });
  assert.ok(d.ok && d.data.done);
  assert.equal(p.coins, 200 + 35);
  assert.equal(p.jobs.delivery.missions, 1);
  assert.equal(auth.handle(ctx, 'job.start', { jobId: 'delivery', missionId: 'tournee' }).ok, false, 'niveau 3 requis');
});

test('pompier : le feu ne s\'éteint pas plus vite que la lance ne le permet', () => {
  const p = auth.newProfile({ id: 'd', name: 'Dédé', appearance: {}, now: 0 });
  const ctx = mkctx(p, at(BUILDING_BY_ID.caserne));
  const m = auth.handle(ctx, 'job.start', { jobId: 'firefighter', missionId: 'poubelle' }).data.mission;
  const f = m.fires[0];
  ctx.pos = { x: f.x + 3, y: 0, z: f.z };
  auth.onPosition(ctx);
  assert.equal(auth.handle(ctx, 'job.step', { missionId: m.id, action: 'extinguish', fire: 0 }).ok, false, 'trop rapide');
  ctx.now += 2000;
  const r = auth.handle(ctx, 'job.step', { missionId: m.id, action: 'extinguish', fire: 0 });
  assert.ok(r.ok && r.data.done, r.error);
});

test('cuisinier : seule la recette exacte paie', () => {
  const p = auth.newProfile({ id: 'e', name: 'Émile', appearance: {}, now: 0 });
  const ctx = mkctx(p, { x: POI.foodCounter.x, y: 0, z: POI.foodCounter.z });
  const m = auth.handle(ctx, 'job.start', { jobId: 'cook', missionId: 'service' }).data.mission;
  ctx.now += 5000;
  const bad = auth.handle(ctx, 'job.step', { missionId: m.id, action: 'serve', order: 0, stack: ['pain-bas', 'pain-haut'] });
  assert.equal(bad.data.result.ok, false);
  ctx.now += 5000;
  const good = auth.handle(ctx, 'job.step', { missionId: m.id, action: 'serve', order: 1, stack: m.orders[1].recipe });
  assert.equal(good.data.result.ok, true);
  assert.ok(good.data.result.pay >= 14);
});

test('tartes : une cible inexistante ou touchée au mauvais moment est refusée', () => {
  const p = auth.newProfile({ id: 'f', name: 'Fanny', appearance: {}, now: 0 });
  const spot = MINIGAME_SPOTS.pieToss;
  const ctx = mkctx(p, { x: spot.x, y: 0, z: spot.z });
  const { seed } = auth.handle(ctx, 'mg.start', { id: 'tartes' }).data;
  const targets = pieTargets(seed, 40, 40);
  const tg = targets.find((t) => t.type === 'normal' && t.t > 5);
  ctx.now += 3000 + 1000; // t = 1 s : la cible n'est pas encore là
  assert.equal(auth.handle(ctx, 'mg.event', { kind: 'hit', target: tg.i }).ok, false);
  ctx.now = 1_000_000 + 3000 + (tg.t + 0.5) * 1000;
  assert.ok(auth.handle(ctx, 'mg.event', { kind: 'hit', target: tg.i }).ok);
  assert.equal(auth.handle(ctx, 'mg.event', { kind: 'hit', target: tg.i }).ok, false, 'pas deux fois');
  assert.equal(auth.handle(ctx, 'mg.finish', {}).ok, false, 'partie pas finie');
  ctx.now = 1_000_000 + 3000 + 40_000;
  const fin = auth.handle(ctx, 'mg.finish', {});
  assert.ok(fin.ok);
  assert.equal(fin.data.score, 1);
  assert.equal(fin.data.coins, 12);
});

test('parcours : le serveur chronomètre lui-même via les positions', () => {
  const p = auth.newProfile({ id: 'g', name: 'Gaby', appearance: {}, now: 0 });
  const spot = MINIGAME_SPOTS.obstacle;
  const ctx = mkctx(p, { x: spot.x, y: 0, z: spot.z });
  auth.handle(ctx, 'mg.start', { id: 'parcours' });
  assert.equal(auth.handle(ctx, 'mg.finish', {}).ok, false);
  let now = ctx.now + 3000;
  for (const cp of spot.checkpoints) { now += 5000; ctx.now = now; ctx.pos = { x: cp.x, y: cp.y, z: cp.z }; auth.onPosition(ctx); }
  const fin = auth.handle(ctx, 'mg.finish', {});
  assert.ok(fin.ok, fin.error);
  assert.equal(fin.data.score, 30);
  assert.equal(fin.data.medal, 'or');
});

test('objets secrets et rendements décroissants', () => {
  const p = auth.newProfile({ id: 'h', name: 'Hugo', appearance: {}, now: 0 });
  const s = SECRETS[0];
  const ctx = mkctx(p, { x: s.x, y: s.y, z: s.z });
  assert.ok(auth.handle(ctx, 'secret.collect', { id: s.id }).ok);
  assert.equal(auth.handle(ctx, 'secret.collect', { id: s.id }).ok, false);
});

test('événement invasion : on n\'attrape qu\'un poulet réellement proche', () => {
  const p = auth.newProfile({ id: 'i', name: 'Inès', appearance: {}, now: 0 });
  let ended = null;
  const dir = new EventDirector(() => content, { rand: mulberry32(1), playerCount: () => 1, onEnd: (r) => { ended = r; }, now: 0 });
  const ctx = mkctx(p, { x: POI.eventBoard.x, y: 0, z: POI.eventBoard.z });
  ctx.events = dir;
  assert.ok(auth.handle(ctx, 'event.trigger', { eventId: 'invasion' }).ok);
  assert.equal(p.coins, 50);
  const c = dir.current.chickens[0];
  ctx.now += (c.land + 2) * 1000;
  const cp = invasionChickenPos(c, (ctx.now - dir.current.startsAt) / 1000);
  ctx.pos = { x: cp.x + 20, y: 0, z: cp.z };
  assert.equal(auth.handle(ctx, 'event.action', { kind: 'catch', chicken: 0 }).ok, false);
  ctx.pos = { x: cp.x + 1, y: 0, z: cp.z };
  assert.ok(auth.handle(ctx, 'event.action', { kind: 'catch', chicken: 0 }).ok);
  dir.tick(ctx.now + 100_000);
  assert.equal(ended.podium[0].name, 'Inès');
});

test('filtre du chat', () => {
  assert.equal(isClean('bonjour tout le monde'), true);
  assert.equal(isClean('m3rde alors'), false);
  assert.equal(censor('quel connard'), 'quel *******');
  assert.equal(isClean('je suis en retard'), true);
  assert.equal(hasPersonalInfo('appelle moi au 06 12 34 56 78'), true);
  assert.equal(hasPersonalInfo('va sur www.site.com'), true);
});
