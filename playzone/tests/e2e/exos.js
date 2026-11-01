// Appli Sport : exercices partout (taper, alterner, tenir l'équilibre), records, palmarès.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-x', name: 'Athlète', createdAt: 0, coins: 500, xp: 6000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=10&auto=solo&qualite=low', { timeout: 90000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const step = (s) => ev(([s]) => window.playzone.debugStep(s), [s]);
const prof = () => ev(() => window.playzone.profile);
await ev(() => { const g = window.playzone; g.player.teleport(0, 12, 0); g.debugStep(0.5); });
// l'appli
await ev(() => window.playzone.phone.open('sport'));
await sleep(500);
const txt = await page.locator('.phone, .ph-screen, body').first().innerText();
check(/Programme du jour/.test(txt) && /Burpees/.test(txt) && /palmarès/i.test(txt), 'appli Sport : programme du jour, 8 exercices, palmarès');
await ev(() => window.playzone.phone.close());
// squats : taper vite
await ev(() => window.playzone.workout.start('squats'));
await sleep(400); await step(0.2);
check(await ev(() => window.playzone.player.seated?.pose === 'squat'), 'posture de squat');
for (let i = 0; i < 40; i++) { await page.keyboard.press('Space'); await step(0.08); await sleep(60); }
await page.screenshot({ path: 'tests/e2e/out/exos-squats.png' });
await ev(() => window.playzone.workout.stop()); await step(0.2); await sleep(700);
let w = (await prof()).workout;
check(w?.best?.squats > 3, `squats enregistrés (record ${w?.best?.squats})`);
// jumping jacks : alterner J / L
await ev(() => window.playzone.workout.start('jacks'));
await sleep(400); await step(0.2);
for (let i = 0; i < 24; i++) { await page.keyboard.press(i % 2 ? 'KeyL' : 'KeyJ'); await step(0.1); await sleep(80); }
await ev(() => window.playzone.workout.stop()); await step(0.2); await sleep(700);
w = (await prof()).workout;
check(w?.best?.jacks >= 5, `jumping jacks (record ${w?.best?.jacks})`);
// gainage : garder l'aiguille dans le vert (le test la maintient au centre)
await ev(() => window.playzone.workout.start('gainage'));
await sleep(400); await step(0.2);
check(await ev(() => window.playzone.player.seated?.pose === 'pushup'), 'position de planche');
for (let i = 0; i < 12; i++) { await ev(() => { const s = window.playzone.workout.s; if (s) { s.needle = 0.5; s.drift = 0; } window.playzone.debugStep(0.5); }); await sleep(450); }
await ev(() => window.playzone.workout.stop()); await step(0.2); await sleep(700);
w = (await prof()).workout;
check(w?.best?.gainage >= 4, `gainage tenu ${w?.best?.gainage} s`);
// bouger arrête l'exercice
await ev(() => window.playzone.workout.start('burpees'));
await sleep(400); await step(0.2);
await page.keyboard.down('KeyW'); await step(0.4); await page.keyboard.up('KeyW'); await sleep(500);
check(await ev(() => !window.playzone.workout.s), 'marcher arrête l\'exercice');
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'EXOS OK' : 'EXOS ÉCHEC');
process.exit(ok ? 0 : 1);
