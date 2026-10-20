// Tests de la propriété : stationnement, réparation, plein, revente, occasions, locations, logements, factures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID, GAS_STATIONS } from '../../shared/world-layout.js';
import { usedOffers, HOUSING_BY_ID, HOUSING, repairCost, resaleValue, hourlyBills } from '../../shared/property.js';
import { mulberry32 } from '../../shared/rng.js';
import { HousingRegistry } from '../../server/world.js';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const auth = new Authority(buildContent(NOW));
let idn = 0;
const mkctx = (profile, pos, now = NOW, extra = {}) => ({ profile, session: {}, now, pos, rand: mulberry32(7), newId: () => `v${++idn}`, ...extra });
const inside = (id) => { const b = BUILDING_BY_ID[id]; return { x: b.x, y: 0, z: b.z }; };
const rich = (id) => { const p = auth.newProfile({ id, name: 'Riche', appearance: {}, now: 0 }); p.coins = 2_000_000; p.xp = 50_000; return p; };

test('achat de voiture neuve : livrée garée devant la concession, verrouillée', () => {
  const p = rich('c1');
  const r = auth.handle(mkctx(p, inside('concession')), 'shop.buy', { itemId: 'berline' });
  assert.ok(r.ok, r.error);
  const v = p.vehicles[0];
  assert.ok(v.park && v.locked, 'garée et verrouillée');
  const b = BUILDING_BY_ID.concession;
  assert.ok(Math.hypot(v.park.x - b.x, v.park.z - b.z) < 40, 'devant la concession');
});

test('stationnement, réparation et plein validés par la position', () => {
  const p = rich('c2');
  auth.handle(mkctx(p, inside('concession')), 'shop.buy', { itemId: 'berline' });
  const v = p.vehicles[0];
  v.damage = 0.5; v.fuel = 5;
  // garer loin du joueur : refusé
  assert.equal(auth.handle(mkctx(p, { x: 0, y: 0, z: 0 }), 'vehicle.park', { vehicleId: v.id, x: 100, z: 0, yaw: 0 }).ok, false);
  assert.ok(auth.handle(mkctx(p, { x: 100, y: 0, z: 0 }), 'vehicle.park', { vehicleId: v.id, x: 102, z: 0, yaw: 1 }).ok);
  // réparation hors garage : refusée
  assert.equal(auth.handle(mkctx(p, { x: 0, y: 0, z: 0 }), 'vehicle.repair', { vehicleId: v.id, x: 0, z: 0 }).ok, false);
  const g = BUILDING_BY_ID.piston;
  const c0 = p.coins;
  const rr = auth.handle(mkctx(p, { x: g.x, y: 0, z: g.z }), 'vehicle.repair', { vehicleId: v.id, x: g.x, z: g.z });
  assert.ok(rr.ok, rr.error);
  assert.equal(v.damage, 0);
  assert.equal(c0 - p.coins, repairCost('berline', 0.5));
  // plein : à la pompe seulement
  const st = GAS_STATIONS[0];
  assert.equal(auth.handle(mkctx(p, { x: 0, y: 0, z: 0 }), 'vehicle.refuel', { vehicleId: v.id, x: 0, z: 0 }).ok, false);
  const rf = auth.handle(mkctx(p, { x: st.x, y: 0, z: st.z }), 'vehicle.refuel', { vehicleId: v.id, x: st.x, z: st.z });
  assert.ok(rf.ok, rf.error);
  assert.equal(v.fuel, 55);
  assert.equal(auth.handle(mkctx(p, { x: st.x, y: 0, z: st.z }), 'vehicle.refuel', { vehicleId: v.id, x: st.x, z: st.z }).ok, false, 'déjà plein');
});

test('revente et occasions du jour (déterministes)', () => {
  const p = rich('c3');
  auth.handle(mkctx(p, inside('concession')), 'shop.buy', { itemId: 'citadine' });
  const v = p.vehicles[0];
  const val = resaleValue(v);
  assert.equal(auth.handle(mkctx(p, { x: 0, y: 0, z: 0 }), 'vehicle.sell', { vehicleId: v.id }).ok, false, 'loin du vendeur');
  const c0 = p.coins;
  assert.ok(auth.handle(mkctx(p, inside('occasions')), 'vehicle.sell', { vehicleId: v.id }).ok);
  assert.equal(p.coins - c0, val);
  const offers = usedOffers(NOW);
  assert.deepEqual(offers, usedOffers(NOW + 3600_000), 'même liste toute la journée');
  assert.notDeepEqual(offers.map((o) => o.model + o.km), usedOffers(NOW + 86400_000).map((o) => o.model + o.km));
  const o = offers[0];
  const r = auth.handle(mkctx(p, inside('occasions')), 'vehicle.buyUsed', { offerId: o.id });
  assert.ok(r.ok, r.error);
  assert.equal(p.vehicles.at(-1).km, o.km);
  assert.equal(auth.handle(mkctx(p, inside('occasions')), 'vehicle.buyUsed', { offerId: o.id }).ok, false, 'pas deux fois');
});

test('location de véhicule : limitée dans le temps', () => {
  const p = rich('c4');
  const ctx = mkctx(p, inside('location'));
  const r = auth.handle(ctx, 'vehicle.rent', { model: 'sportive', minutes: 10 });
  assert.ok(r.ok, r.error);
  assert.equal(auth.handle(ctx, 'vehicle.rent', { model: 'citadine', minutes: 10 }).ok, false, 'une seule location');
  assert.equal(auth.handle(mkctx(p, inside('occasions')), 'vehicle.sell', { vehicleId: r.data.vehicle.id }).ok, false, 'pas de revente');
  // 11 minutes plus tard : rendue automatiquement
  auth.handle(mkctx(p, inside('location'), NOW + 11 * 60_000), 'bills.tick', {});
  assert.equal(p.vehicles.length, 0);
});

test('logements : prix réalistes, location, achat, crédit, vente', () => {
  assert.ok(HOUSING.filter((h) => h.kind === 'maison' && h.sea).every((h) => h.price >= 450_000), 'bord de mer ≈ 500 000');
  assert.ok(HOUSING.filter((h) => h.kind === 'maison' && !h.sea).every((h) => h.price < 330_000 && h.price > 270_000), 'ailleurs ≈ 300 000');
  assert.ok(HOUSING.filter((h) => h.kind === 'appart').every((h) => h.price >= 150_000 && h.price < 170_000), 'appartements ≈ 150 000');
  const p = rich('h1');
  const agence = inside('immo');
  assert.equal(auth.handle(mkctx(p, { x: 0, y: 0, z: 0 }), 'home.rent', { id: 'maison-t3' }).ok, false, 'il faut aller à l\'agence');
  assert.ok(auth.handle(mkctx(p, agence), 'home.rent', { id: 'maison-t3' }).ok);
  assert.equal(p.home.place, 'maison-t3');
  assert.ok(!p.properties.some((x) => x.id === 'studio'), 'le studio est rendu');
  // achat comptant d'une autre maison
  const r = auth.handle(mkctx(p, agence), 'home.buy', { id: 'maison2' });
  assert.ok(r.ok, r.error);
  assert.equal(p.home.place, 'maison2');
  // crédit : apport de 20 %
  const h = HOUSING_BY_ID['immeuble1-2'];
  const c0 = p.coins;
  assert.ok(auth.handle(mkctx(p, agence), 'home.buy', { id: h.id, loan: true, move: false }).ok);
  assert.equal(c0 - p.coins, Math.round(h.price * 0.2));
  // vente : 85 % moins le crédit restant
  const c1 = p.coins;
  const pr = p.properties.find((x) => x.id === h.id);
  assert.ok(auth.handle(mkctx(p, agence), 'home.leave', { id: h.id }).ok);
  assert.equal(p.coins - c1, Math.round(h.price * 0.85) - pr.loanLeft);
});

test('meubles : limités à la taille du logement habité', () => {
  const p = rich('h2');
  p.inventory.canape = 1;
  const big = auth.handle(mkctx(p, inside('residence')), 'home.place', { itemId: 'canape', x: 6, z: 0, r: 0 });
  assert.ok(big.ok, 'le studio fait 14 m');
  auth.handle(mkctx(p, inside('immo')), 'home.rent', { id: 'maison-t1' });
  assert.ok(Math.abs(p.home.furniture[0].x) <= HOUSING_BY_ID['maison-t1'].size.w / 2, 'meuble ramené dans la maison');
});

test('factures : loyer + charges au prorata du temps de jeu, dette puis expulsion', () => {
  const p = rich('b1');
  auth.handle(mkctx(p, inside('immo')), 'home.rent', { id: 'maison-t5' });
  auth.startSession(p, NOW);
  const bill = hourlyBills(p);
  const c0 = p.coins;
  // 30 appels d'une minute = 30 minutes de jeu
  for (let i = 1; i <= 30; i++) auth.handle(mkctx(p, null, NOW + i * 60_000), 'bills.tick', {});
  const paid = c0 - p.coins;
  assert.ok(Math.abs(paid - bill.total / 2) <= 2, `moitié de la facture horaire (${paid} / ${bill.total})`);
  // déconnecté 5 heures : on ne paie que 3 minutes au maximum
  const c1 = p.coins;
  auth.handle(mkctx(p, null, NOW + 31 * 60_000 + 5 * 3600_000), 'bills.tick', {});
  assert.ok(c1 - p.coins <= Math.ceil(bill.total * 3 / 60) + 1);
  // fauché : dette, puis expulsion vers le studio
  p.coins = 0;
  let t = NOW + 6 * 3600_000;
  auth.startSession(p, t);
  for (let i = 0; i < 400 && p.home.place !== 'studio'; i++) { t += 3 * 60_000; auth.handle(mkctx(p, null, t), 'bills.tick', {}); }
  assert.equal(p.home.place, 'studio');
  assert.ok(p.debt > 0);
});

test('registre des logements en ligne : une maison = un seul joueur', () => {
  const reg = new HousingRegistry({ allProfiles: () => [] });
  const a = rich('r1'), b = rich('r2');
  b.name = 'Bertrand';
  assert.ok(auth.handle(mkctx(b, inside('immo'), NOW, { housing: reg }), 'home.buy', { id: 'maison5' }).ok);
  const r = auth.handle(mkctx(a, inside('immo'), NOW, { housing: reg }), 'home.buy', { id: 'maison5' });
  assert.equal(r.ok, false);
  assert.match(r.error, /Bertrand/);
  auth.handle(mkctx(b, inside('immo'), NOW, { housing: reg }), 'home.leave', { id: 'maison5' });
  assert.ok(auth.handle(mkctx(a, inside('immo'), NOW, { housing: reg }), 'home.buy', { id: 'maison5' }).ok, 'libérée après la vente');
});
