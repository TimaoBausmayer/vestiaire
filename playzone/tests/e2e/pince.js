// Jeu de pince jouable (salle d'arcade) + remplir ses jauges contre des PlayCoins.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-pi', name: 'Pinceur', createdAt: 0, coins: 2000, xp: 3000, rep: 0, appearance: {}, needs: { faim: 20, energie: 30, humeur: 40, hygiene: 10, at: Date.now() } })));
await page.goto(url + 'index.html?heure=15&auto=solo', { timeout: 120000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };

// 1) Remplir les jauges : clic sur la barre des besoins → panneau → « Tout remplir »
const before = await ev(() => ({ coins: window.playzone.profile.coins }));
await page.click('.needs');
await sleep(300);
check(await ev(() => /Tout remplir/.test(document.querySelector('.modal')?.textContent || '')), 'panneau « remplir mes jauges » ouvert en cliquant sur les besoins');
await page.screenshot({ path: 'tests/e2e/out/jauges.png' });
await ev(() => [...document.querySelectorAll('.modal button')].find((b) => /Tout remplir/.test(b.textContent)).click());
await sleep(700);
const after = await ev(async () => { const { needsStatus } = await import('/shared/needs.js'); const g = window.playzone; return { coins: g.profile.coins, n: needsStatus(g.profile.needs, Date.now()) }; });
check(after.n.faim > 95 && after.n.hygiene > 95 && after.n.energie > 95, `jauges remplies (faim ${after.n.faim | 0}, hygiène ${after.n.hygiene | 0}, énergie ${after.n.energie | 0})`);
check(after.coins < before.coins, `payé en PlayCoins (${before.coins - after.coins} PC)`);
await ev(() => window.playzone.ui.closeAll?.() ?? document.querySelectorAll('.modal .close-x').forEach((b) => b.click()));

// 2) Jeu de pince : on entre dans l'arcade et on joue pour de vrai
await ev(async () => { const { BUILDINGS } = await import('/shared/world-layout.js'); const b = BUILDINGS.find((x) => x.interior === 'arcade'); const g = window.playzone; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(0.5); const { openClaw } = await import('/src/leisure/claw.js'); openClaw(g, b); });
await sleep(400);
check(await ev(() => !!window.playzone.clawGame), 'machine à pince ouverte');
let wins = 0, plays = 0;
for (let i = 0; i < 12 && wins < 1; i++) {
  const c0 = await ev(() => window.playzone.profile.coins);
  await ev(() => window.playzone.clawGame.start());
  await sleep(300);
  // vise la peluche la plus proche avec les flèches
  const tx = await ev(() => 120 + Math.random() * 200);
  await page.keyboard.down(tx > 180 ? 'ArrowRight' : 'ArrowLeft'); await sleep(Math.abs(tx - 180) / 150 * 1000); await page.keyboard.up(tx > 180 ? 'ArrowRight' : 'ArrowLeft');
  await page.keyboard.press('Space');
  if (i === 0) { await sleep(900); await page.screenshot({ path: 'tests/e2e/out/pince.png' }); }
  for (let k = 0; k < 40 && !(await ev(() => window.playzone.clawGame.state?.done)); k++) await sleep(250);
  plays++;
  if (i === 0) check(c0 - await ev(() => window.playzone.profile.coins) === 5, 'une partie coûte 5 PC');
  const inv = await ev(() => window.playzone.profile.inventory);
  wins = (inv['peluche-coeur'] || 0) + (inv['peluche-poulet'] || 0) + ((await ev(() => window.playzone.profile.stats.claw)) || 0);
}
check(plays >= 1, `${plays} partie(s) jouée(s), ${wins} lot(s) gagné(s)`);
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'PINCE OK' : 'PINCE ÉCHEC');
process.exit(ok ? 0 : 1);
