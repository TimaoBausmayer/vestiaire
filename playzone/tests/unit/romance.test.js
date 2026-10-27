// Tests de l'amour (drague, cadeaux, rendez-vous, couple, mariage) et du jardin / de la baignade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { gardenOf, homeGroundsLocal, repairCost } from '../../shared/property.js';
import { LOVE } from '../../shared/romance.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const auth = new Authority(buildContent(NOW));
const mkctx = (profile, pos, now = NOW, seed = 7) => ({ profile, session: {}, now, pos, rand: mulberry32(seed), newId: () => 'x' });
const mk = (id) => { const p = auth.newProfile({ id, name: 'Romeo', appearance: {}, now: 0 }); p.coins = 50_000; p.xp = 50_000; return p; };

test('draguer : chance selon l\'attirance, pause entre deux essais, affection qui monte', () => {
  const p = mk('l1');
  let yes = 0, now = NOW;
  for (let i = 0; i < 30; i++) {
    now += LOVE.flirtCd + 1;
    const r = auth.handle(mkctx(p, null, now, i + 1), 'love.flirt', { id: 'gerard', name: 'Gérard' });
    assert.ok(r.ok, r.error);
    if (r.data.yes) yes++;
  }
  assert.ok(yes > 3 && yes < 30, `réussites ${yes}/30`);
  assert.ok(p.love.aff.gerard > 20, `affection ${p.love.aff.gerard}`);
  const again = auth.handle(mkctx(p, null, now + 1000), 'love.flirt', { id: 'gerard' });
  assert.ok(!again.ok, 'pause entre deux compliments');
});

test('cadeaux, rendez-vous payant, couple, câlin, mariage, rupture', () => {
  const p = mk('l2');
  p.inventory.bouquet = 3; p.inventory['bague-diamant'] = 1;
  let now = NOW;
  assert.ok(!auth.handle(mkctx(p, null, now), 'love.date', { id: 'zoe', kind: 'resto' }).ok, 'pas de rendez-vous avec une inconnue');
  for (let i = 0; i < 3; i++) { now += 16_000; const r = auth.handle(mkctx(p, null, now), 'love.gift', { id: 'zoe', itemId: 'bouquet' }); assert.ok(r.ok, r.error); }
  assert.equal(p.love.aff.zoe, 30);
  assert.ok(!p.inventory.bouquet, 'bouquets offerts');
  const c0 = p.coins;
  now += 61_000; let r = auth.handle(mkctx(p, null, now), 'love.date', { id: 'zoe', kind: 'resto' });
  assert.ok(r.ok, r.error);
  assert.equal(c0 - p.coins, 140, 'le restaurant se paie');
  r = auth.handle(mkctx(p, null, now), 'love.ask', { id: 'zoe', name: 'Zoé', role: 'Fleuriste' });
  assert.ok(r.ok && !r.data.yes, 'trop tôt pour être en couple');
  p.love.aff.zoe = 75;
  r = auth.handle(mkctx(p, null, now), 'love.ask', { id: 'zoe', name: 'Zoé', role: 'Fleuriste' });
  assert.ok(r.data.yes && p.love.partner.name === 'Zoé', 'en couple');
  assert.ok(!auth.handle(mkctx(p, null, now), 'love.ask', { id: 'gerard', name: 'Gérard' }).ok, 'pas deux couples à la fois');
  r = auth.handle(mkctx(p, null, now), 'love.cuddle', {});
  assert.ok(r.ok, r.error);
  assert.ok(!auth.handle(mkctx(p, null, now + 1000), 'love.cuddle', {}).ok, 'pause entre deux câlins');
  p.love.aff.zoe = 95;
  r = auth.handle(mkctx(p, null, now), 'love.propose', {});
  assert.ok(r.data.yes && p.love.married && !p.inventory['bague-diamant'], 'mariage avec la bague');
  r = auth.handle(mkctx(p, null, now), 'love.breakup', {});
  assert.ok(r.ok && !p.love.partner && !p.love.married);
});

test('jardin derrière la maison : on y pose des meubles, pas au-delà ; baignade dans la piscine', () => {
  const G = gardenOf('maison-t3');
  assert.ok(G && G.depth >= 3 && G.z2 < 0, JSON.stringify(G));
  assert.equal(gardenOf('immeuble1-2'), null, 'pas de jardin en appartement');
  const p = mk('g1');
  p.home.place = 'maison-t3'; p.inventory.piscine = 1;
  const zIn = (G.z1 + G.z2) / 2;
  let r = auth.handle(mkctx(p, null), 'home.place', { itemId: 'piscine', x: 0, z: zIn, r: 0 });
  assert.ok(r.ok, r.error);
  assert.ok(!auth.handle(mkctx(p, null), 'home.move', { index: 0, x: 0, z: G.z1 - 3, r: 0 }).ok, 'au-delà du jardin : refusé');
  // baignade : il faut être chez soi, à côté de la piscine
  const b = BUILDING_BY_ID['maison-t3'];
  const far = auth.handle(mkctx(p, { x: b.x + 200, y: 0, z: b.z }), 'home.use', { what: 'swim' });
  assert.ok(!far.ok);
  // position monde du centre de la piscine (repère de la maison)
  let pos = null;
  for (let dx = -12; dx <= 12 && !pos; dx += 0.25) for (let dz = -16; dz <= 16 && !pos; dz += 0.25) { const l = homeGroundsLocal('maison-t3', b.x + dx, b.z + dz); if (l && Math.hypot(l.x, l.z - zIn) < 0.2) pos = { x: b.x + dx, y: 0, z: b.z + dz }; }
  assert.ok(pos, 'point du jardin trouvé');
  p.needs.humeur = 40;
  r = auth.handle(mkctx(p, pos), 'home.use', { what: 'swim' });
  assert.ok(r.ok, r.error);
  assert.ok(r.data.needs.humeur > 55, `ça détend (${r.data.needs.humeur})`);
});

test('réparations : moins chères qu\'avant mais pas gratuites', () => {
  const c = repairCost('berline', 1);
  assert.ok(c > 300 && c < 3000, `berline cassée : ${c} PC`);
  assert.equal(repairCost('berline', 0), 0);
});

test('atelier de garage chez soi : moitié prix, seulement devant sa maison', async () => {
  const { homeRepairCost } = await import('../../shared/property.js');
  const p = mk('gar1');
  p.home.place = 'maison-t3'; p.inventory['atelier-garage'] = 1;
  p.vehicles.push({ id: 'car1', model: 'berline', damage: 0.6 });
  const b = BUILDING_BY_ID['maison-t3'], at = { x: b.x + 8, y: 0, z: b.z + 8 };
  let r = auth.handle(mkctx(p, at), 'vehicle.repairHome', { vehicleId: 'car1', x: at.x, z: at.z });
  assert.ok(!r.ok, 'il faut l\'atelier posé chez soi');
  assert.ok(auth.handle(mkctx(p, null), 'home.place', { itemId: 'atelier-garage', x: 0, z: 0, r: 0 }).ok);
  r = auth.handle(mkctx(p, { x: b.x + 300, y: 0, z: b.z }), 'vehicle.repairHome', { vehicleId: 'car1', x: b.x + 300, z: b.z });
  assert.ok(!r.ok, 'loin de la maison : refusé');
  const c0 = p.coins;
  r = auth.handle(mkctx(p, at), 'vehicle.repairHome', { vehicleId: 'car1', x: at.x, z: at.z });
  assert.ok(r.ok, r.error);
  assert.equal(c0 - p.coins, homeRepairCost('berline', 0.6));
  assert.ok(homeRepairCost('berline', 0.6) < repairCost('berline', 0.6), 'moins cher qu\'au garage');
  assert.equal(p.vehicles[0].damage, 0);
});
