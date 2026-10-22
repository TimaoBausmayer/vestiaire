// Tests du calendrier : horloge du jeu, occurrences (hebdo, rares), inscriptions et places, tournois
// (score pendant le créneau, classement avec PNJ, prix une seule fois), manches programmées et PNJ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { gameDay, gameHour, realAt, weekday, HOUR_MS } from '../../shared/clock.js';
import { occurrences, CAL_BY_ID, liveOcc } from '../../shared/calendar.js';
import { tournamentNpcs } from '../../shared/authority-calendar.js';
import { EventDirector } from '../../shared/events-director.js';
import { mulberry32 } from '../../shared/rng.js';

const NOW = Date.parse('2026-10-22T09:00:00Z');
const content = buildContent(NOW);
const auth = new Authority(content);

class Boards {
  constructor() { this.d = {}; }
  submit(k, p, score, lower) { const l = (this.d[k] ||= []); const e = l.find((x) => x.id === p.id); if (!e) l.push({ id: p.id, name: p.name, score }); else if (lower ? score < e.score : score > e.score) e.score = score; return 1; }
  top(k, n) { return (this.d[k] || []).slice(0, n); }
}
const boards = new Boards();
const mk = (p, now, session = {}) => ({ profile: p, session, now, pos: null, zone: 'world', rand: mulberry32(3), newId: () => 'x', leaderboard: boards });

test('horloge : jour et heure de jeu réversibles', () => {
  for (const [d, h] of [[1000, 0], [1000, 7.5], [1001, 23.9], [20000, 12]]) {
    const t = realAt(d, h);
    assert.equal(gameDay(t), d);
    assert.ok(Math.abs(gameHour(t) - h) < 1e-6);
  }
});

test('occurrences : jours de la semaine, ordre, identifiants stables', () => {
  const list = occurrences(NOW, NOW + 7 * 24 * HOUR_MS);
  assert.ok(list.length >= 10);
  for (const o of list) {
    const ev = CAL_BY_ID[o.id];
    if (ev.days) assert.ok(ev.days.includes(weekday(o.day)), `${o.id} un ${weekday(o.day)}`);
    assert.equal(o.start, realAt(o.day, ev.start));
  }
  for (let i = 1; i < list.length; i++) assert.ok(list[i].start >= list[i - 1].start);
  assert.deepEqual(occurrences(NOW, NOW + 3 * HOUR_MS).map((o) => o.occ), occurrences(NOW, NOW + 3 * HOUR_MS).map((o) => o.occ));
});

test('tournoi : inscription, score dans le créneau, classement avec PNJ, prix une fois', () => {
  const o = occurrences(NOW, NOW + 7 * 24 * HOUR_MS).find((x) => x.id === 'tournoi-tartes');
  const p = auth.newProfile({ id: 'cal1', name: 'Tarte', appearance: {}, now: 0 });
  const during = o.start + 60_000;
  assert.ok(liveOcc('tournoi-tartes', during));
  assert.ok(auth.handle(mk(p, during), 'cal.register', { occ: o.occ }).ok);
  // une partie de tartes jouée pendant le tournoi : le score compte pour l'occurrence
  const npcs = tournamentNpcs(CAL_BY_ID['tournoi-tartes'], o.occ);
  assert.ok(npcs.length >= 4 && npcs.every((x) => x.npc));
  const best = Math.max(...npcs.map((x) => x.score)) + 5;
  boards.submit(`cal:${o.occ}`, p, best, false);
  assert.equal(auth.handle(mk(p, during), 'cal.claim', { occ: o.occ }).ok, false, 'pas avant la fin');
  const c0 = p.coins;
  const r = auth.handle(mk(p, o.end + 1000), 'cal.claim', { occ: o.occ });
  assert.ok(r.ok);
  assert.equal(r.data.place, 1);
  assert.equal(p.coins - c0, CAL_BY_ID['tournoi-tartes'].rewards.podium[0]);
  auth.handle(mk(p, o.end + 2000), 'cal.claim', { occ: o.occ });
  assert.equal(p.coins - c0, CAL_BY_ID['tournoi-tartes'].rewards.podium[0], 'prix versé une seule fois');
  assert.equal(p.calendar.history.at(-1).place, 1);
});

test('places limitées', () => {
  const o = occurrences(NOW, NOW + 7 * 24 * HOUR_MS).find((x) => x.id === 'tournoi-tartes');
  const full = { count: () => 100, add() {} };
  const p = auth.newProfile({ id: 'cal2', name: 'Retard', appearance: {}, now: 0 });
  const r = auth.handle({ ...mk(p, o.start), calRegistry: full }, 'cal.register', { occ: o.occ });
  assert.match(r.error, /Complet/);
});

test('événement de la Grande Place lancé par le calendrier, avec des PNJ qui jouent', () => {
  const o = occurrences(NOW, NOW + 7 * 24 * HOUR_MS).find((x) => x.id === 'fete-poulets');
  let started = null, ended = null;
  const dir = new EventDirector(() => content, { rand: mulberry32(5), playerCount: () => 1, onStart: (s) => { started = s; }, onEnd: (r) => { ended = r; }, now: o.start - 1000 });
  dir.tick(o.start - 500);
  assert.equal(dir.current, null, 'rien avant le créneau');
  dir.tick(o.start + 1000);
  assert.equal(started?.occ, o.occ);
  assert.ok(started.npcs.length >= 3, 'des PNJ participent');
  for (let t = o.start + 1000; t < o.start + 120_000 && !ended; t += 1000) dir.tick(t);
  assert.ok(ended, 'la manche se termine');
  assert.ok(ended.ranking.some((r) => r.npc), 'les PNJ apparaissent dans le classement');
});
