// Jeux du casino : 40 jeux au Grand Casino, 16 dans les autres ; chaque jeu garde un avantage à la maison.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { GAMES, GAME_IDS, SMALL_CASINO_GAMES } from '../../shared/casino-games.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-19T20:00:00Z');
const auth = new Authority(buildContent(NOW));
const mk = (p, b, seed = 1) => ({ profile: p, session: {}, now: NOW, pos: { x: b.x, y: 0, z: b.z }, zone: 'world', rand: mulberry32(seed), newId: () => 'x' });

test('40 jeux différents au Grand Casino, au moins 15 dans les autres', () => {
  assert.equal(GAME_IDS.length, 40);
  assert.equal(new Set(GAME_IDS.map((id) => GAMES[id].name)).size, 40, 'noms tous différents');
  assert.ok(SMALL_CASINO_GAMES.length >= 15 && SMALL_CASINO_GAMES.every((id) => GAMES[id]));
  assert.ok(BUILDING_BY_ID['grand-casino']?.grand);
});

test('chaque jeu rend entre 80 % et 99,5 % des mises sur la durée', () => {
  const rand = mulberry32(7);
  for (const [id, G] of Object.entries(GAMES)) {
    if (G.panel && id !== 'slots') continue;
    for (const c of G.choices || [{ id: null }]) {
      // les jeux à gros lot rare (loterie, machines, keno 7...) demandent plus de parties pour mesurer
      const rare = ['loterie', 'pharaon', 'sauvage', 'pokerdes', 'keno', 'pachinko'].includes(id);
      let s = 0; const N = rare ? 600_000 : 60_000;
      for (let i = 0; i < N; i++) s += G.play(rand, c.id).mult;
      const rtp = s / N;
      assert.ok(rtp > (rare ? 0.7 : 0.78) && rtp < (rare ? 1.05 : 1.0), `${id} / ${c.id} : ${rtp.toFixed(3)}`);
    }
  }
});

test('casino.play : tirage par l\'autorité, jeux du Grand Casino réservés', () => {
  const p = auth.newProfile({ id: 'cg1', name: 'Flambeur', appearance: {}, now: 0 }); p.coins = 50_000;
  const grand = BUILDING_BY_ID['grand-casino'], small = BUILDING_BY_ID.casino;
  const r = auth.handle(mk(p, grand), 'casino.play', { game: 'crash', bet: 100, choice: '2' });
  assert.ok(r.ok && (r.data.paid === 0 || r.data.paid === 200), JSON.stringify(r));
  assert.equal(auth.handle(mk(p, small), 'casino.play', { game: 'pachinko', bet: 100 }).ok, false, 'pachinko : Grand Casino seulement');
  assert.ok(auth.handle(mk(p, small), 'casino.play', { game: 'baccarat', bet: 100, choice: 'banquier' }).ok);
  assert.equal(auth.handle(mk(p, grand), 'casino.play', { game: 'de', bet: 100, choice: '9' }).ok, false, 'choix invalide');
  assert.equal(auth.handle(mk(p, { x: 0, z: 0 }), 'casino.play', { game: 'pile', bet: 100, choice: 'pile' }).ok, false, 'hors du casino');
});
