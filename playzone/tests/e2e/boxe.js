// Sport partout : club de boxe (sac de frappe, combat sur le ring), salles de sport et clubs de foot
// de quartier (terrain du club), coup de poing de rue (enchaînement, KO du PNJ).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-b', name: 'Boxeur', createdAt: 0, coins: 50000, xp: 60000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=low');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const step = (s) => ev(([s]) => window.playzone.debugStep(s), [s]);
const prof = () => ev(() => window.playzone.profile);
const enter = (id) => ev(async ([id]) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID[id]; const g = window.playzone; g.player.teleport(b.x, b.z, 0); g.debugStep(1.2); return { inside: g.interiors.inside?.id }; }, [id]);
const spot = (id, re) => ev(([id, re]) => { const g = window.playzone; const it = g.interiors.loaded.get(id); const s = it && [...it.inters].find((i) => new RegExp(re).test(typeof i.label === 'function' ? i.label() : i.label)); if (!s) return null; const x = typeof s.x === 'function' ? s.x() : s.x, z = typeof s.z === 'function' ? s.z() : s.z; g.player.teleport(x, z, g.player.yaw); g.debugStep(0.2); s.action(); return true; }, [id, re]);

const { n: nb } = await ev(async () => { const { BUILDINGS } = await import('/shared/world-layout.js'); return { n: BUILDINGS.filter((b) => b.interior === 'boxing').length }; });
const counts = await ev(async () => { const { BUILDINGS } = await import('/shared/world-layout.js'); return { boxe: BUILDINGS.filter((b) => b.interior === 'boxing').length, gym: BUILDINGS.filter((b) => b.interior === 'gym').length, foot: BUILDINGS.filter((b) => b.shop === 'foot-club').length }; });
check(counts.boxe >= 8 && counts.gym >= 10 && counts.foot >= 7, `partout en ville : ${counts.boxe} clubs de boxe, ${counts.gym} salles de sport, ${counts.foot} clubs de foot`);

// club de boxe : sac de frappe
const st = await enter('boxe-1');
check(st.inside === 'boxe-1', `dans le club de boxe (${JSON.stringify(st)})`);
const m0 = (await prof()).body.muscle;
check(await spot('boxe-1', 'sac de frappe'), '« Taper dans le sac de frappe »');
for (let i = 0; i < 30; i++) { await page.keyboard.press('KeyG'); await step(0.15); }
await step(12); await sleep(600);
const p1 = await prof();
check(p1.sports.boxing?.bags === 1 && p1.body.muscle > m0, `série au sac : muscles ${m0.toFixed(2)} → ${p1.body.muscle.toFixed(2)}`);

// combat sur le ring (admin : jamais blessé)
await ev(() => window.playzone.net.request('admin.unlock', { code: 'Timao3049Bausmayer' }));
check(await spot('boxe-1', 'ring'), '« Monter sur le ring »');
await sleep(300);
await page.locator('.modal button', { hasText: 'Combattre' }).first().click();
await sleep(600);
const f0 = await ev(() => { const f = window.playzone.boxing.f; return f && { opp: f.O.name, hp: f.ohp }; });
check(!!f0, `combat lancé contre ${f0?.opp}`);
await page.screenshot({ path: 'tests/e2e/out/boxe-ring.png' });
await step(2.2);   // présentation
await sleep(6500); // durée minimale réelle d'un combat
for (let i = 0; i < 80 && (await ev(() => window.playzone.boxing.f?.phase)) === 'fight'; i++) {
  await ev(() => { const g = window.playzone, f = g.boxing.f; if (!f) return; const P = g.player.pos; const d = Math.hypot(f.o.x - P.x, f.o.z - P.z); if (d > 1.3) { P.x += (f.o.x - P.x) / d * (d - 1.1); P.z += (f.o.z - P.z) / d * (d - 1.1); } });
  await page.keyboard.press(i % 3 ? 'KeyG' : 'KeyH'); await step(0.35);
}
await page.screenshot({ path: 'tests/e2e/out/boxe-ko.png' });
await step(4); await sleep(800);
const B = (await prof()).sports.boxing;
check(B.wins === 1 && B.beaten === 0, `victoire enregistrée (${JSON.stringify(B)})`);
await page.keyboard.press('Escape');

// salle de sport de quartier
await enter('gym-3');
const gymSpots = await ev(() => [...(window.playzone.interiors.loaded.get('gym-3')?.inters || [])].map((i) => (typeof i.label === 'function' ? i.label() : i.label)).join(' | '));
check(/Banc de musculation/.test(gymSpots) && /abonnements/.test(gymSpots), 'salle de sport équipée (machines, accueil)');

// club de foot de quartier : son propre terrain
await enter('club-foot-mouettes');
await ev(() => { const g = window.playzone; const b = g.interiors.inside; g.races.clubDesk(b); });
await sleep(300);
await page.locator('.dialog-box button', { hasText: 'Football' }).first().click();
await sleep(400);
const title = await page.locator('.modal h2, .modal .title, .modal-title').first().innerText().catch(() => '');
const pitch = await ev(async () => { const { PITCH } = await import('/shared/sports.js'); return { x: PITCH.x, z: PITCH.z }; });
check(pitch.x === 350 && pitch.z === -40, `le club joue sur son terrain (${JSON.stringify(pitch)}) ${title}`);
await page.keyboard.press('Escape');

// coup de poing dans la rue : enchaînement et PNJ au tapis
await ev(() => window.playzone.net.request('admin.lock', {}));
const hit = await ev(() => { const g = window.playzone; const n = g.npcs.list[0]; g.player.teleport(n.pos.x + 1.2, n.pos.z, -Math.PI / 2); g.debugStep(0.1); g.crimes.hitCd = 0; g.crimes.punch(); const pose1 = g.player.pose; g.crimes.hitCd = 0; g.crimes.punch(); return { ko: n.state === 'ko', poses: [pose1, g.player.pose] }; });
check(hit.ko && hit.poses[0] !== hit.poses[1], `coup de poing : PNJ au tapis, gauche-droite (${JSON.stringify(hit)})`);

const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'BOXE OK' : 'BOXE ÉCHEC');
process.exit(ok ? 0 : 1);
