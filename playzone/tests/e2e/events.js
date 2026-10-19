// Étape 7 : événements publics (invasion de poulets, soirée DJ, chasse aux citrouilles).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-t', name: 'Testeur', createdAt: 0, coins: 1000, xp: 0, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=19.6&auto=solo');
await sleep(5000);
const ev = (fn, arg) => page.evaluate(fn, arg);
const coins = () => ev(() => window.playzone.profile.coins);
let ok = true;
async function trigger(name) {
  await ev(() => { const g = window.playzone; g.net.events.lastEndAt = 0; g.player.teleport(13, -13.2, Math.PI); g.debugStep(0.2); });
  await page.keyboard.press('KeyE'); await sleep(600);
  await page.locator('.card', { hasText: name }).getByRole('button', { name: 'Organiser' }).click();
  await sleep(800);
}
// 1) Invasion
const c0 = await coins();
await trigger('Invasion de poulets');
const st = await ev(() => window.playzone.events.current);
console.log('événement :', st?.name, '· poulets :', st?.n, '· PC après organisation', await coins());
await sleep(6000);
let caught = 0;
for (let k = 0; k < 4; k++) {
  const c = await ev(() => { const e = window.playzone.events; const list = e.chickens.filter((x) => x && x.landed); return list[0] ? { x: list[0].pos.x, z: list[0].pos.z } : null; });
  if (!c) { await sleep(1000); continue; }
  await ev((c) => { const g = window.playzone; g.player.teleport(c.x + 0.8, c.z, 0); g.debugStep(0.05); }, c);
  if (k === 0) { await ev(() => { const g = window.playzone; g.cam.yaw = 0.5; g.cam.dist = 10; g.cam.pitch = 0.5; }); await sleep(600); await page.screenshot({ path: 'tests/e2e/out/s7-invasion.png' }); }
  await page.keyboard.press('KeyE'); await sleep(500);
  caught = await ev(() => window.playzone.events.chickens.filter((x) => x === null).length);
}
console.log('poulets attrapés :', caught);
ok = ok && caught >= 2;
await ev(() => window.playzone.net.events.end(Date.now()));
await sleep(800);
const c1 = await coins();
console.log('PC :', c0, '->', c1, '(podium compris)');
// 2) Soirée DJ
await trigger('Soirée DJ');
await ev(() => { const g = window.playzone; g.player.teleport(0, -9, Math.PI); g.debugStep(0.1); });
await page.keyboard.press('Digit1');
await sleep(500);
await ev(() => { const g = window.playzone; g.cam.yaw = 0.3; g.cam.dist = 12; g.cam.pitch = 0.35; });
await sleep(1000);
await page.screenshot({ path: 'tests/e2e/out/s7-dj.png' });
const r0 = await ev(() => window.playzone.profile.rep);
await sleep(7500);
const r1 = await ev(() => window.playzone.profile.rep);
console.log('réputation en dansant :', r0, '->', r1);
ok = ok && r1 > r0;
await ev(() => window.playzone.net.events.end(Date.now()));
await sleep(500);
// 3) Chasse aux citrouilles (pack Halloween actif en octobre 2026)
const has = await ev(() => !!window.playzone.net.content.events['chasse-citrouilles']);
if (has) {
  await trigger('Chasse aux citrouilles');
  const p = await ev(() => { const pk = window.playzone.events.pumpkins.find((x) => x); return { x: pk.x, z: pk.z }; });
  await ev((p) => { const g = window.playzone; g.player.teleport(p.x + 1, p.z, 0); g.debugStep(0.1); g.cam.yaw = 0.7; g.cam.dist = 8; }, p);
  await sleep(600);
  await page.screenshot({ path: 'tests/e2e/out/s7-citrouille.png' });
  const k0 = await coins();
  await page.keyboard.press('KeyE'); await sleep(600);
  const k1 = await coins();
  console.log('citrouille ramassée : PC', k0, '->', k1);
  ok = ok && k1 > k0;
} else console.log('pack Halloween inactif à cette date');
console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
