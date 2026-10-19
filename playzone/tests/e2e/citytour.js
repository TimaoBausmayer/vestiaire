// Visite de la grande ville : plusieurs vues aériennes et au sol (contrôle visuel).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
const hour = process.argv[2] || '11';
const only = process.argv[3] ? process.argv[3].split(',') : null;
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-v', name: 'Vue', createdAt: 0, coins: 500, xp: 0, rep: 0, appearance: {} })));
await page.goto(url + `index.html?heure=${hour}&auto=solo&qualite=high`);
await sleep(5000);
const VIEWS = {
  affaires: [[150, 30, 60], [235, 0, -40]], tilleuls: [[-40, 45, -130], [-20, 0, -230]], commerce: [[150, 35, -120], [210, 0, -230]],
  port: [[190, 25, 40], [230, 0, 100]], campagne: [[-150, 35, 20], [-230, 0, -50]], industrie: [[-150, 40, -150], [-220, 0, -240]],
  loisirs: [[20, 40, -300], [0, 0, -385]], prison: [[-180, 40, -320], [-220, 0, -385]], circuit: [[150, 40, -320], [220, 0, -385]],
  rue: [[-40, 3, -186], [-10, 1.5, -186]], centre: [[14, 9, 30], [0, 2, 0]],
};
for (const [name, [cam, look]] of Object.entries(VIEWS)) {
  if (only && !only.includes(name)) continue;
  await page.evaluate(([cam, look]) => {
    const g = window.playzone; const V = g.engine.camera.position.constructor;
    g.player.teleport(look[0], look[2] + 3, 0);
    g.cam.override = { pos: new V(...cam), look: new V(...look) };
    g.engine.camera.position.set(...cam);
    g.debugStep(0.6);
  }, [cam, look]);
  await sleep(1200);
  await page.screenshot({ path: `tests/e2e/out/city-${name}-${hour}.png` });
  const info = await page.evaluate(() => { const r = window.playzone.engine.renderer; return { calls: r.info.render.calls, tris: r.info.render.triangles }; });
  console.log(name, JSON.stringify(info));
}
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
