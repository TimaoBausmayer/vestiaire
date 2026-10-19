// Visite de la carte : téléporte le joueur à plusieurs endroits et prend une capture à chaque fois.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
import { mkdirSync } from 'node:fs';
mkdirSync('tests/e2e/out', { recursive: true });
const spots = JSON.parse(process.argv[2] || '[]');
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.goto(url + 'index.html?' + (process.env.QS || 'heure=12'));
await sleep(5000);
for (const s of spots) {
  await page.evaluate((s) => {
    const g = window.playzone;
    g.player.teleport(s.x, s.z, s.yaw ?? 0);
    g.cam.snap(g.player.pos, s.camYaw ?? (s.yaw ?? 0) + Math.PI);
    g.cam.pitch = s.pitch ?? 0.42; g.cam.dist = s.dist ?? 9;
    if (s.js) eval(s.js);
  }, s);
  await sleep(s.wait || 1500);
  await page.screenshot({ path: `tests/e2e/out/${s.name}.png` });
}
console.log(errors.length ? errors.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close();
