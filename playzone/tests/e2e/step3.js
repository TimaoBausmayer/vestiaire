// Étape 3 : PNJ, animaux, trafic, canards dorés.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-t', name: 'Testeur', createdAt: 0, coins: 500, xp: 0, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo');
await sleep(5000);
const step = (s) => page.evaluate((s) => window.playzone.debugStep(s), s);
const shot = async (name, js) => { await page.evaluate(js); await step(0.2); await sleep(700); await page.screenshot({ path: `tests/e2e/out/${name}.png` }); };
const info = await page.evaluate(() => {
  const g = window.playzone;
  return { npcs: g.npcs.list.length, animals: g.animals.list.length, species: [...new Set(g.animals.list.map((a) => a.species))].length, cars: g.traffic.cars.length };
});
console.log('monde :', info);
// les voitures roulent ?
const c0 = await page.evaluate(() => window.playzone.traffic.cars.map((c) => c.s));
await step(2);
const c1 = await page.evaluate(() => window.playzone.traffic.cars.map((c) => c.s));
console.log('voitures en mouvement :', c0.filter((s, i) => Math.abs(c1[i] - s) > 1).length, '/', c0.length);
// pigeons : s'envolent quand on approche
const pigeon = await page.evaluate(() => { const p = window.playzone.animals.list.find((a) => a.species === 'pigeon'); return { x: p.pos.x, z: p.pos.z }; });
await page.evaluate((p) => window.playzone.player.teleport(p.x + 1, p.z + 1, 0), pigeon);
await step(1.2);
const flying = await page.evaluate(() => window.playzone.animals.list.filter((a) => a.species === 'pigeon' && a.alt > 0.5).length);
console.log('pigeons envolés après approche :', flying);
// dialogue avec un PNJ (le maire)
await page.evaluate(() => { const g = window.playzone; g.player.teleport(11, -11.5, Math.PI); });
await step(0.3);
const label = await page.locator('.prompt').textContent();
console.log('invite près du maire :', label);
await page.keyboard.press('KeyE');
await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/s3-dialog.png' });
await page.getByRole('button', { name: '💡 Un conseil ?' }).click();
console.log('conseil :', await page.locator('.dialog-box p').textContent());
await page.getByRole('button', { name: 'Au revoir' }).click();
// canard doré
const before = await page.evaluate(() => window.playzone.profile.coins);
await page.evaluate(() => { const g = window.playzone; g.player.teleport(-20, -56, 0); });
await step(0.2);
await page.keyboard.press('KeyE');
await sleep(500);
const after = await page.evaluate(() => ({ coins: window.playzone.profile.coins, secrets: window.playzone.profile.secrets }));
console.log('canard doré : PC', before, '->', after.coins, after.secrets);
await shot('s3-place', () => { const g = window.playzone; g.player.teleport(0, 20, Math.PI); g.cam.yaw = 0; g.cam.dist = 14; g.cam.pitch = 0.45; });
await shot('s3-ferme', () => { const g = window.playzone; g.player.teleport(-66, 20, -1.57); g.cam.yaw = 1.2; g.cam.dist = 13; g.cam.pitch = 0.35; });
await shot('s3-poulailler', () => { const g = window.playzone; g.player.teleport(-64, -22, -1.57); g.cam.yaw = 1.57; g.cam.dist = 9; g.cam.pitch = 0.35; });
await shot('s3-etang', () => { const g = window.playzone; g.player.teleport(-18, -106, -2.2); g.cam.yaw = 0.9; g.cam.dist = 12; g.cam.pitch = 0.45; });
await shot('s3-foret', () => { const g = window.playzone; const w = g.animals.list.find((a) => a.species === 'loup'); g.player.teleport(w.pos.x + 6, w.pos.z + 6, 0); g.cam.yaw = 0.8; g.cam.dist = 10; g.cam.pitch = 0.35; });
console.log(errors.length ? errors.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close();
