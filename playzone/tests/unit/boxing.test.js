// Tests de la boxe : il faut être au club, adversaires débloqués un par un, victoire trop rapide refusée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { OPPONENTS, minWinSeconds } from '../../shared/boxing.js';
import { PITCHES, pitchAt } from '../../shared/sports.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const auth = new Authority(buildContent(NOW));
const session = {};
const mkctx = (profile, pos, now = NOW) => ({ profile, session, now, pos, rand: mulberry32(3), newId: () => 'x' });
const club = () => { const b = BUILDING_BY_ID['boxe-1']; return { x: b.x, y: 0, z: b.z }; };

test('boxe : club, sac, adversaires dans l\'ordre, victoire validée par la durée', () => {
  const p = auth.newProfile({ id: 'bx1', name: 'Rocky', appearance: {}, now: 0 }); p.coins = 10_000;
  assert.ok(!auth.handle(mkctx(p, { x: 0, y: 0, z: 0 }), 'boxing.bag', { hits: 30 }).ok, 'hors du club : refusé');
  const m0 = p.body.muscle;
  let r = auth.handle(mkctx(p, club()), 'boxing.bag', { hits: 999 });
  assert.ok(r.ok, r.error);
  assert.ok(p.body.muscle > m0 && p.body.muscle - m0 <= 60 * 0.035 + 1e-9, 'gain plafonné');
  assert.ok(!auth.handle(mkctx(p, club()), 'boxing.start', { opp: OPPONENTS[2].id }).ok, 'adversaire 3 verrouillé');
  r = auth.handle(mkctx(p, club()), 'boxing.start', { opp: OPPONENTS[0].id });
  assert.ok(r.ok, r.error);
  r = auth.handle(mkctx(p, club(), NOW + 1000), 'boxing.end', { won: true, ko: true });
  assert.ok(r.ok && !r.data.won, 'victoire en 1 s : refusée');
  auth.handle(mkctx(p, club(), NOW + 2000), 'boxing.start', { opp: OPPONENTS[0].id });
  const c0 = p.coins, secs = minWinSeconds(OPPONENTS[0], p.body.muscle) + 1;
  r = auth.handle(mkctx(p, club(), NOW + 2000 + secs * 1000), 'boxing.end', { won: true, ko: false });
  assert.ok(r.ok && r.data.won, 'victoire acceptée');
  assert.equal(p.coins - c0, OPPONENTS[0].prize);
  assert.equal(p.sports.boxing.beaten, 0);
  assert.ok(auth.handle(mkctx(p, club(), NOW + 100_000), 'boxing.start', { opp: OPPONENTS[1].id }).ok, 'adversaire 2 débloqué');
});

test('clubs de foot de quartier : chaque club a son terrain', () => {
  assert.ok(PITCHES.length >= 7);
  for (const pt of PITCHES) {
    assert.ok(BUILDING_BY_ID[pt.club], `club-house ${pt.club}`);
    assert.equal(pitchAt(pt.x + 10, pt.z + 5)?.id, pt.id);
  }
});
