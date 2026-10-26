// Grand Casino de PLAYZONE (40 jeux) et casinos de quartier (16 jeux) : salle des jeux, une partie de
// plusieurs jeux (tirage par l'autorité, PlayCoins uniquement).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-cj', name: 'Flambeur', createdAt: 0, coins: 50000, xp: 3000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=21&auto=solo&qualite=medium');
await page.waitForFunction(() => window.playzone?.player, null, { timeout: 90000 });
await sleep(3000);
await page.addStyleTag({ content: '.modal, .panel { animation: none !important; }' });
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const enter = (id) => ev(async (id) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone, b = BUILDING_BY_ID[id]; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has(id); i++) g.debugStep(0.3); return g.interiors.loaded.get(id).inters.map((x) => (typeof x.label === 'function' ? x.label() : x.label)).filter((l) => /jeux/i.test(l || '')); }, id);

// 1) Grand Casino : 6 salles + le catalogue complet
const spots = await enter('grand-casino');
check(spots.length >= 7, `Grand Casino : ${spots.length} comptoirs de jeux (${spots.join(' · ')})`);
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone, it = g.interiors.loaded.get('grand-casino'); const sp = it.inters.find((x) => /40 jeux/.test(x.label)); g.player.teleport(sp.x, sp.z, Math.PI); g.debugStep(0.3); void BUILDING_BY_ID; });
await page.keyboard.press('KeyE'); await sleep(500);
const n = await page.locator('.hall-game').count();
check(n === 40, `catalogue : ${n} jeux différents`);
await ev(() => { const g = window.playzone; g.cam.pitch = 0.5; g.debugStep(0.2); });
await sleep(600);
await page.screenshot({ path: 'tests/e2e/out/casino-catalogue.png' });
// 2) quelques parties
let played = 0;
for (const name of ['Crash', 'Plinko', 'Baccarat', 'Course de chevaux', 'Poker aux dés', 'Ticket à gratter']) {
  if (!(await page.locator('.hall-game', { hasText: name }).count())) { await ev(() => { for (const m of [...window.playzone.ui.stack]) m.close(); }); await ev(() => { for (const m of [...window.playzone.ui.stack]) m.close(); }); await page.keyboard.press('KeyE'); await sleep(400); }
  await page.locator('.hall-game', { hasText: name }).first().click(); await sleep(300);
  const c0 = await ev(() => window.playzone.profile.coins);
  await page.locator('.casino-table .btn.big').click(); await sleep(1300);
  const msg = await page.locator('.casino-table .game-msg').textContent();
  const show = await page.locator('.casino-table .game-show').textContent();
  const c1 = await ev(() => window.playzone.profile.coins);
  if (/Gagné|Perdu|rendue/.test(msg) && c1 !== undefined) played++;
  console.log(`   ${name} : ${show.slice(0, 70)} → ${msg} (${c0} → ${c1})`);
  if (name === 'Plinko') await page.screenshot({ path: 'tests/e2e/out/casino-plinko.png' });
  await page.locator('.casino-table .btn.ghost.small').click(); await sleep(300);
}
check(played === 6, `${played} jeux joués (résultat tiré par l'autorité)`);
await ev(() => { for (const m of [...window.playzone.ui.stack]) m.close(); });
// 3) casino de quartier : 16 jeux
await enter('casino');
await ev(() => { const g = window.playzone, it = g.interiors.loaded.get('casino'); const sp = it.inters.find((x) => /16 jeux/.test(x.label)); g.player.teleport(sp.x, sp.z, Math.PI); g.debugStep(0.3); });
await page.keyboard.press('KeyE'); await sleep(500);
const n2 = await page.locator('.hall-game').count();
check(n2 >= 15, `Casino Royal Pomme : ${n2} jeux`);

console.log(ok ? 'OK' : 'ÉCHEC');
const errs = errors.filter((e) => !/status of 404|AudioContext/.test(e));
console.log(errs.length ? errs.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
