// Fonds marins : profondeur du large, hauts-fonds des récifs, sous-marin, trésor quotidien, spots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { groundHeight, BUILDING_BY_ID } from '../../shared/world-layout.js';
import { REEFS, TREASURE, WRECK, SUBMARINE } from '../../shared/sea.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const auth = new Authority(buildContent(NOW));
const mk = (p, pos, now = NOW) => ({ profile: p, session: {}, now, pos: pos ? { y: 0, ...pos } : null, zone: 'world', rand: mulberry32(3), newId: () => 'x' });

test('la mer s\'approfondit au large, les récifs remontent', () => {
  assert.ok(groundHeight(0, 100) > -3 && groundHeight(0, 100) < 0, 'plage en pente douce');
  assert.ok(groundHeight(0, 330) < -12, `large profond (${groundHeight(0, 330).toFixed(1)} m)`);
  for (const r of REEFS.filter((x) => !x.wreck)) assert.ok(groundHeight(r.x, r.z) > -5.6 && groundHeight(r.x, r.z) < -4, `${r.name} : haut-fond (${groundHeight(r.x, r.z).toFixed(1)})`);
  assert.ok(groundHeight(WRECK.x, WRECK.z) < -12, 'l\'épave repose au fond');
});

test('sous-marin au Centre de plongée, trésor une fois par jour, spots découverts', () => {
  const p = auth.newProfile({ id: 's1', name: 'Plongeur', appearance: {}, now: 0 }); p.coins = 1000;
  const b = BUILDING_BY_ID.plongee;
  assert.equal(auth.handle(mk(p, { x: 0, z: 0 }), 'sub.start', {}).ok, false, 'loin du centre');
  const r = auth.handle(mk(p, { x: b.x, z: b.z }), 'sub.start', {});
  assert.ok(r.ok && p.coins === 1000 - SUBMARINE.rent);
  const t1 = auth.handle(mk(p, TREASURE), 'sea.treasure', {});
  assert.ok(t1.ok && t1.data.gain >= TREASURE.min && t1.data.gain <= TREASURE.max);
  assert.equal(auth.handle(mk(p, TREASURE, NOW + 3600_000), 'sea.treasure', {}).ok, false, 'vide jusqu\'à demain');
  assert.ok(auth.handle(mk(p, TREASURE, NOW + 86400_000), 'sea.treasure', {}).ok, 'rempli le lendemain');
  const reef = REEFS[0], xp = p.xp;
  assert.ok(auth.handle(mk(p, reef), 'sea.discover', { id: reef.id }).data.count === 1 && p.xp > xp);
  assert.ok(auth.handle(mk(p, reef), 'sea.discover', { id: reef.id }).data.already);
});
