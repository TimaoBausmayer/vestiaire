// Piscine olympique : course de 50 m (le test nage en rythme J / L), classement, record ; nage libre.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-s', name: 'Nageur', createdAt: 0, coins: 500, xp: 6000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=14&auto=solo&qualite=low', { timeout: 90000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID.piscine; const g = window.playzone; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(1); });
await ev(() => window.playzone.swim.desk());
await sleep(400);
await page.locator('.modal button', { hasText: 'Plonger' }).first().click();
await sleep(800);
check(await ev(() => !!window.playzone.swim.r), 'course de 50 m lancée');
// départ, puis J / L à ~3 par seconde (en temps de jeu)
for (let i = 0; i < 700; i++) {
  const st = await ev(([i]) => { const g = window.playzone, r = g.swim.r; if (!r) return null; if (r.t >= 0 && i % 5 === 0) g.swim.stroke((Math.floor(i / 5) % 2) ? 1 : -1); g.debugStep(1 / 15); return { t: r.t, x: r.x, done: r.done }; }, [i]);
  if (!st) break;
  if (i === 200) await page.screenshot({ path: 'tests/e2e/out/natation.png' });
  if (i % 30 === 0) await sleep(40);
}
await sleep(1500);
const S = (await prof()).sports.swim;
check(S?.races === 1 && S.best > 0, `course terminée (${S?.best} s, ${S?.wins} victoire)`);
await page.keyboard.press('Escape');
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'NATATION OK' : 'NATATION ÉCHEC');
process.exit(ok ? 0 : 1);
