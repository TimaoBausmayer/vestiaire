// Loto : un ticket par jour réel, 10 PC, 1 chance sur 100 de gagner 1 000 000 PC ; discussion avec les PNJ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { LOTTO, lottoDay } from '../../shared/lottery.js';
import { npcReply } from '../../shared/chat.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const auth = new Authority(buildContent(NOW));
const mk = (p, now = NOW, seed = 1) => ({ profile: p, session: {}, now, pos: null, zone: 'world', rand: mulberry32(seed), newId: () => 'x' });

test('loto : 10 PC, un ticket par jour réel, environ 1 % de gagnants', () => {
  const p = auth.newProfile({ id: 'l1', name: 'Joueur', appearance: {}, now: 0 });
  p.coins = 100;
  const r = auth.handle(mk(p), 'loto.play', {});
  assert.ok(r.ok && r.data.mine.length === 6);
  assert.equal(p.coins, 100 - LOTTO.price + (r.data.win ? LOTTO.prize : 0));
  assert.equal(auth.handle(mk(p, NOW + 3600_000), 'loto.play', {}).ok, false, 'un seul ticket par jour');
  const tomorrow = (lottoDay(NOW) + 1) * 86400_000;   // minuit (heure de Paris) le lendemain
  assert.ok(auth.handle(mk(p, tomorrow, 2), 'loto.play', {}).ok, 'le lendemain, on rejoue');
  let wins = 0;
  for (let k = 0; k < 3000; k++) {
    const q = auth.newProfile({ id: `l${k}`, name: 'Joueur', appearance: {}, now: 0 }); q.coins = 10;
    if (auth.handle(mk(q, NOW, 1000 + k), 'loto.play', {}).data.win) { wins++; assert.equal(q.coins, LOTTO.prize); }
  }
  assert.ok(wins > 10 && wins < 60, `${wins} gagnants sur 3000`);
});

test('discussion : le PNJ comprend salutations, prénom, chemin, météo, insultes', () => {
  const mem = {}, who = { name: 'Gisèle', role: 'Boulangère' }, ctx = { hour: 15, kts: 18, pos: { x: 0, z: 0 } };
  assert.match(npcReply('Bonjour !', who, ctx, mem), /Bonjour|Salut|Coucou/);
  assert.match(npcReply('je m\'appelle Timao', who, ctx, mem), /Timao/);
  assert.equal(mem.playerName, 'Timao');
  assert.match(npcReply('Où est la banque ?', who, ctx, mem), /Banque.* m/);
  assert.match(npcReply('Il fait quel temps ?', who, ctx, mem), /18 nœuds/);
  assert.match(npcReply('Comment tu t\'appelles ?', who, ctx, mem), /Gisèle/);
  npcReply('espèce d\'idiot', who, ctx, mem); npcReply('t\'es nul', who, ctx, mem);
  assert.match(npcReply('Bonjour ?', who, ctx, mem), /\.\.\.|plus|ailleurs/, 'vexé·e après des insultes');
});

test('téléportation payante (gratuite pour l\'admin) ; l\'admin ne se blesse pas et n\'a jamais faim', async () => {
  const { teleportCost } = await import('../../shared/teleport.js');
  const p = auth.newProfile({ id: 'tp1', name: 'Voyageur', appearance: {}, now: 0 }); p.coins = 10_000;
  const ctx = { ...mk(p), pos: { x: 0, y: 0, z: 0 } };
  const cost = teleportCost(ctx.pos, { x: 1000, z: -1000 });
  const r = auth.handle(ctx, 'teleport', { x: 1000, z: -1000 });
  assert.ok(r.ok && r.data.cost === cost && cost >= 400 && p.coins === 10_000 - cost && ctx.pos.x === 1000);
  assert.equal(auth.handle({ ...mk(p), pos: { x: 0, y: 0, z: 0 } }, 'teleport', { x: 99999, z: 0 }).ok, false, 'hors carte');
  p.justice.stars = 2;
  assert.equal(auth.handle({ ...mk(p), pos: { x: 0, y: 0, z: 0 } }, 'teleport', { x: 10, z: 10 }).ok, false, 'recherché·e : bloqué');
  const a = auth.newProfile({ id: 'tp2', name: 'Patron', appearance: {}, now: 0 }); a.admin = true;
  assert.equal(auth.handle({ ...mk(a), pos: { x: 0, y: 0, z: 0 } }, 'teleport', { x: 500, z: 300 }).data.cost, 0);
  a.needs.faim = 3; a.body.health = 20; a.body.injury = { kind: 'fracture', until: NOW + 1e6 };
  auth.handle({ ...mk(a, NOW + 3600_000), pos: { x: 0, y: 0, z: 0 } }, 'body.hurt', { kind: 'fracture' });
  assert.ok(a.needs.faim === 100 && a.body.health === 100 && !a.body.injury, JSON.stringify([a.needs, a.body.health, a.body.injury]));
});
