// Tests de la vie quotidienne : propreté, cuisine (ingrédients, qualité), douche, sommeil — chez soi seulement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID, HOME_INTERIOR } from '../../shared/world-layout.js';
import { needsStatus } from '../../shared/needs.js';
import { RECIPES, recipeEffect } from '../../shared/recipes.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const auth = new Authority(buildContent(NOW));
const O = HOME_INTERIOR.origin;
const mk = (p, pos, zone = 'world', now = NOW) => ({ profile: p, session: {}, now, pos, zone, rand: mulberry32(1), newId: () => 'x' });
function profile() {
  const p = auth.newProfile({ id: 'l1', name: 'Cuistot', appearance: {}, now: 0 });
  p.coins = 100000;
  p.home.furniture = [{ i: 'cuisiniere', x: 2, z: -2, r: 0 }, { i: 'douche', x: -4, z: -3, r: 0 }, { i: 'lit', x: -4, z: 2, r: 0 }];
  p.needs = { faim: 20, energie: 15, humeur: 40, hygiene: 10, at: NOW };
  Object.assign(p.inventory, { oeufs: 2, legumes: 1, pates: 1 });
  return p;
}

test('la propreté baisse avec le temps de jeu', () => {
  const st = needsStatus({ faim: 90, energie: 90, humeur: 80, hygiene: 90, at: NOW }, NOW + 60 * 60_000);
  assert.ok(st.hygiene < 60 && st.hygiene > 40);
});

test('cuisiner : chez soi, devant la cuisinière, avec les ingrédients', () => {
  const p = profile();
  const room = (x, z) => ({ x: O.x + x, y: 0, z: O.z + z });
  assert.equal(auth.handle(mk(p, { x: 0, y: 0, z: 0 }), 'home.use', { what: 'cook', recipe: 'omelette', quality: 1 }).ok, false, 'pas dans la rue');
  assert.equal(auth.handle(mk(p, room(-5, 3), 'home:l1'), 'home.use', { what: 'cook', recipe: 'omelette', quality: 1 }).ok, false, 'trop loin de la cuisinière');
  const r = auth.handle(mk(p, room(2, -1), 'home:l1'), 'home.use', { what: 'cook', recipe: 'omelette-legumes', quality: 1 });
  assert.ok(r.ok, r.error);
  assert.equal(p.inventory.oeufs, 1);
  assert.equal(p.inventory.legumes, 0);
  assert.ok(r.data.needs.faim >= 20 + 50 - 1);
  // recette sans ingrédients
  assert.equal(auth.handle(mk(p, room(2, -1), 'home:l1', NOW + 60_000), 'home.use', { what: 'cook', recipe: 'crepes', quality: 1 }).error, 'Il manque des ingrédients.');
  // plat carbonisé : moins nourrissant, humeur en baisse
  const burnt = recipeEffect(RECIPES[0], 0);
  assert.ok(burnt.humeur < 0 && burnt.faim < RECIPES[0].food.faim);
});

test('douche et sommeil (avec temps de recharge), aussi dans une vraie maison', () => {
  const p = profile();
  const room = (x, z) => ({ x: O.x + x, y: 0, z: O.z + z });
  const s = auth.handle(mk(p, room(-4, -2.5), 'home:l1'), 'home.use', { what: 'shower' });
  assert.ok(s.ok, s.error);
  assert.equal(Math.round(s.data.needs.hygiene), 100);
  const z = auth.handle(mk(p, room(-4, 1.5), 'home:l1'), 'home.use', { what: 'sleep' });
  assert.ok(z.ok && z.data.needs.energie > 80);
  assert.equal(auth.handle(mk(p, room(-4, 1.5), 'home:l1', NOW + 10_000), 'home.use', { what: 'sleep' }).ok, false, 'pas deux nuits d\'affilée');
  // dans une maison louée : coordonnées locales du bâtiment
  p.properties = [{ id: 'maison-t3', how: 'rent', since: 0 }];
  p.home.place = 'maison-t3';
  p.home.furniture = [{ i: 'douche', x: 0, z: 0, r: 0 }];
  const b = BUILDING_BY_ID['maison-t3'];
  const ok = auth.handle(mk(p, { x: b.x, y: 0, z: b.z }, 'world', NOW + 200_000), 'home.use', { what: 'shower' });
  assert.ok(ok.ok, ok.error);
  const other = BUILDING_BY_ID['maison-t4'];
  assert.equal(auth.handle(mk(p, { x: other.x, y: 0, z: other.z }, 'world', NOW + 400_000), 'home.use', { what: 'shower' }).ok, false, 'pas chez le voisin');
});
