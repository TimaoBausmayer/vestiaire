// Tests des exercices partout : vitesse plafonnée, gains, records, programme du jour (bonus, série).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { dailyProgram, EXOS, PROGRAM_BONUS } from '../../shared/workout.js';
import { todayKey } from '../../shared/rules.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-11-01T12:00:00Z');
const auth = new Authority(buildContent(NOW));
const session = {};
const ctx = (p, now) => ({ profile: p, session, now, pos: { x: 0, y: 0, z: 0 }, rand: mulberry32(1), newId: () => 'x' });
const mk = () => { const p = auth.newProfile({ id: 'w1', name: 'Sportif', appearance: {}, now: 0 }); p.coins = 0; return p; };
const serie = (p, exo, amount, secs, t0) => { auth.handle(ctx(p, t0), 'workout.start', { exo }); return auth.handle(ctx(p, t0 + secs * 1000), 'workout.end', { amount }); };

test('série : plafonnée au rythme humain, gains, record', () => {
  const p = mk(), m0 = p.body.muscle;
  let r = serie(p, 'squats', 500, 10, NOW);
  assert.ok(r.ok, r.error);
  assert.ok(r.data.amount <= Math.ceil(10 * EXOS.squats.rate) + 1, `plafond (${r.data.amount})`);
  assert.ok(p.body.muscle > m0 && r.data.record);
  r = serie(p, 'squats', 3, 10, NOW + 20_000);
  assert.ok(!r.data.record, 'pas de record avec moins');
  r = serie(p, 'gainage', 999, 30, NOW + 60_000);
  assert.ok(r.data.amount <= 31, 'gainage : pas plus de secondes que la durée');
});

test('programme du jour : bonus quand les 3 exercices sont réussis, série de jours', () => {
  const p = mk(), day = todayKey(NOW), prog = dailyProgram(day);
  assert.equal(prog.length, 3);
  assert.deepEqual(prog, dailyProgram(day), 'même programme pour tout le monde');
  let t = NOW, last;
  for (const st of prog) { const secs = EXOS[st.id].unit === 'secs' ? st.target + 2 : Math.ceil(st.target / EXOS[st.id].rate) + 2; last = serie(p, st.id, st.target, secs, t); t += secs * 1000 + 5000; }
  assert.ok(last.data.program, 'programme validé');
  assert.equal(last.data.bonus, PROGRAM_BONUS.coins);
  assert.equal(p.coins, PROGRAM_BONUS.coins);
  // le lendemain : série de 2 jours
  const t2 = NOW + 86_400_000, prog2 = dailyProgram(todayKey(t2));
  t = t2;
  for (const st of prog2) { const secs = EXOS[st.id].unit === 'secs' ? st.target + 2 : Math.ceil(st.target / EXOS[st.id].rate) + 2; last = serie(p, st.id, st.target, secs, t); t += secs * 1000 + 5000; }
  assert.equal(last.data.streak, 2);
});
