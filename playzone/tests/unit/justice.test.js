// Tests de la justice : délits et étoiles, vol à la tire, casse, braquage, amendes et points, semer la
// police, arrestation et prison (barème en minutes réelles), évasion, code et permis, policier joueur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { CRIMES, sentence, codeTest, CODE_QUESTIONS, EXAM_ROUTE, loseTime } from '../../shared/justice.js';
import { inPrison } from '../../shared/authority-justice.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const auth = new Authority(buildContent(NOW));
const at = (b) => ({ x: b.x, y: 0, z: b.z });
const mk = (p, pos, now = NOW, session = {}, seed = 1) => ({ profile: p, session, now, pos: pos ? { ...pos } : null, zone: 'world', rand: mulberry32(seed), newId: () => 'x' });
const prof = (id) => { const p = auth.newProfile({ id, name: 'Voyou', appearance: {}, now: 0 }); p.coins = 50_000; return p; };

test('barème : peines courtes (vol de voiture = 3 min)', () => {
  assert.equal(CRIMES.coups.jail, 2);
  assert.equal(CRIMES['vol-voiture'].jail, 3);
  assert.equal(sentence([{ type: 'coups' }, { type: 'vol-voiture' }]), 5);
  assert.equal(sentence(new Array(20).fill({ type: 'braquage' })), 12, 'plafonné');
});

test('délit vu par des témoins → étoiles ; semer la police', () => {
  const p = prof('j1');
  auth.handle(mk(p, null), 'crime.report', { type: 'coups', witnessed: false });
  assert.equal(p.justice.stars, 0, 'sans témoin : rien');
  auth.handle(mk(p, null), 'crime.report', { type: 'vol-voiture', witnessed: true, model: 'berline' });
  assert.equal(p.justice.stars, 2);
  assert.equal(auth.handle(mk(p, null, NOW + 5000), 'police.lose', {}).ok, false, 'trop tôt');
  const lost = auth.handle(mk(p, null, NOW + loseTime(2) * 1000 + 1000), 'police.lose', {});
  assert.ok(lost.ok && lost.data.bounty === 150 && p.cash >= 150, 'prime d\'évasion en liquide');
  assert.equal(p.justice.stars, 0);
  assert.equal(p.justice.record.at(-1).end, 'impuni');
  assert.equal(auth.handle(mk(p, null), 'crime.report', { type: 'braquage', witnessed: true }).ok, false, 'le braquage ne se déclare pas');
});

test('arrestation → prison en minutes réelles, butin saisi, libération, évasion', () => {
  const p = prof('j2');
  p.cash = 340; p.justice.loot = 100;
  auth.handle(mk(p, null), 'crime.report', { type: 'coups', witnessed: true });
  const ctx = mk(p, { x: 0, y: 0, z: 0 });
  const r = auth.handle(ctx, 'police.arrest', {});
  assert.ok(r.ok);
  assert.equal(r.data.minutes, 2);
  assert.equal(r.data.seized, 100, 'seul le butin est saisi');
  assert.equal(p.cash, 240);
  assert.ok(inPrison(ctx.pos), 'la position validée suit le joueur en cellule');
  assert.equal(auth.handle(mk(p, null, NOW + 60_000), 'jail.release', {}).ok, false, 'pas avant la fin');
  // laverie : remise de peine
  const w = auth.handle(mk(p, null, NOW + 61_000), 'jail.work', {});
  assert.ok(w.ok && p.justice.jail.until === NOW + 2 * 60_000 - 15_000);
  assert.ok(auth.handle(mk(p, null, NOW + 2 * 60_000), 'jail.release', {}).ok);
  // évasion (plusieurs essais avec un générateur qui finit par réussir)
  auth.handle(mk(p, null, NOW + 11 * 60_000), 'crime.report', { type: 'coups', witnessed: true });
  auth.handle(mk(p, null, NOW + 11 * 60_000), 'police.arrest', {});
  let escaped = false, t = NOW + 12 * 60_000;
  for (let k = 0; k < 30 && !escaped; k++) { t += 61_000; escaped = auth.handle(mk(p, null, t, {}, 100 + k), 'jail.escape', {}).data?.escaped; }
  assert.ok(escaped && p.justice.stars === 3 && !p.justice.jail, 'évadé·e et recherché·e');
});

test('vol à la tire, recel à la casse, braquage', () => {
  const p = prof('j3');
  let gains = 0, tries = 0;
  for (let k = 0; k < 10; k++) { const r = auth.handle(mk(p, null, NOW + k * 7000, {}, 50 + k), 'crime.pickpocket', {}); tries++; gains += r.data.loot || 0; }
  assert.ok(gains > 0 && p.cash >= gains, `butin ${gains}`);
  const s = {};
  auth.handle(mk(p, null, NOW, s), 'crime.report', { type: 'vol-voiture', witnessed: false, model: 'sportive' });
  const casse = BUILDING_BY_ID.casse;
  const y = casse.yard;
  assert.equal(auth.handle(mk(p, { x: 0, y: 0, z: 0 }, NOW, s), 'crime.fence', {}).ok, false);
  const f = auth.handle(mk(p, { x: (y.x1 + y.x2) / 2, y: 0, z: (y.z1 + y.z2) / 2 }, NOW, s), 'crime.fence', {});
  assert.ok(f.ok && f.data.gain > 5000);
  assert.equal(auth.handle(mk(p, { x: (y.x1 + y.x2) / 2, y: 0, z: (y.z1 + y.z2) / 2 }, NOW, s), 'crime.fence', {}).ok, false, 'une seule fois');
  const bank = BUILDING_BY_ID.banque;
  const rs = {};
  const start = auth.handle(mk(p, at(bank), NOW, rs), 'crime.robStart', {});
  assert.ok(start.ok && p.justice.stars >= 4);
  assert.equal(auth.handle(mk(p, at(bank), NOW + 5000, rs), 'crime.robLoot', {}).ok, false, 'il faut tenir 20 s');
  const loot = auth.handle(mk(p, at(bank), NOW + 21_000, rs), 'crime.robLoot', {});
  assert.ok(loot.ok && loot.data.loot >= 2500);
});

test('amendes, points, permis suspendu ; code et examen', () => {
  const p = prof('j4');
  const pol = BUILDING_BY_ID.police;
  // code : réponses justes
  const seed = 1234;
  const answers = codeTest(seed).map((qi) => CODE_QUESTIONS[qi][2]);
  assert.equal(auth.handle(mk(p, { x: 0, y: 0, z: 0 }), 'licence.code', { seed, answers }).ok, false, 'au commissariat');
  assert.ok(auth.handle(mk(p, at(pol)), 'licence.code', { seed, answers }).data.passed);
  const s = {};
  assert.ok(auth.handle(mk(p, at(pol), NOW, s), 'licence.examStart', {}).ok);
  assert.equal(auth.handle(mk(p, at(pol), NOW + 5000, s), 'licence.examEnd', { checkpoints: EXAM_ROUTE.length, errors: 0 }).data.passed, false, 'trop rapide = triche');
  auth.handle(mk(p, at(pol), NOW, s), 'licence.examStart', {});
  assert.ok(auth.handle(mk(p, at(pol), NOW + 60_000, s), 'licence.examEnd', { checkpoints: EXAM_ROUTE.length, errors: 1 }).data.passed);
  assert.ok(p.justice.licence.permis && p.justice.points === 12);
  // feux rouges : l'amende n'est due que si la police t'attrape
  const c0 = p.coins;
  for (let k = 0; k < 3; k++) auth.handle(mk(p, null, NOW + k * 30_000), 'police.fine', { type: 'feu-rouge' });
  assert.equal(p.justice.points, 12, 'pas encore retiré');
  assert.equal(p.coins, c0, 'rien payé tant qu\'on n\'est pas attrapé·e');
  assert.equal(p.justice.pending.length, 3);
  const r = auth.handle(mk(p, { x: 0, y: 0, z: 0 }, NOW + 100_000), 'police.arrest', {});
  assert.ok(r.data.fineOnly && !p.justice.jail, 'contrôle routier : amendes, pas de prison');
  assert.equal(p.coins, c0 - 3 * 135);
  assert.equal(p.justice.points, 0);
  assert.equal(p.justice.licence.permis, false, 'permis suspendu');
});

test('un policier condamné perd son poste', () => {
  const p = prof('j5');
  p.career.job = { id: 'policier', building: 'police', since: 0, raise: 0, perf: 60, worked: 0, sinceRaise: 0 };
  auth.handle(mk(p, null), 'crime.report', { type: 'coups', witnessed: true });
  const r = auth.handle(mk(p, null), 'police.arrest', {});
  assert.ok(r.data.fired && !p.career.job);
  assert.match(auth.handle(mk(p, at(BUILDING_BY_ID.police)), 'career.apply', { jobId: 'policier', buildingId: 'police' }).error, /Casier|diplôme/);
});

test('prison : l\'admin donne un billet au gardien et sort tout de suite', () => {
  const p = prof('j6');
  p.admin = true;
  auth.handle(mk(p, null), 'crime.report', { type: 'vol-voiture', witnessed: true, model: 'berline' });
  auth.handle(mk(p, { x: 0, y: 0, z: 0 }), 'police.arrest', {});
  assert.ok(p.justice.jail);
  const r = auth.handle(mk(p, { x: 0, y: 0, z: 0 }, NOW + 1000), 'jail.bribe', {});
  assert.ok(r.ok && r.data.freed && r.data.cost === 0 && !p.justice.jail);
  // un joueur normal paie en liquide (et peut échouer)
  const q = prof('j7');
  q.cash = 1000;
  auth.handle(mk(q, null), 'crime.report', { type: 'vol-voiture', witnessed: true, model: 'berline' });
  auth.handle(mk(q, { x: 0, y: 0, z: 0 }), 'police.arrest', {});
  const b = auth.handle(mk(q, { x: 0, y: 0, z: 0 }, NOW + 1000), 'jail.bribe', {});
  assert.ok(b.ok && b.data.cost === 300 && q.cash === 700);
});
