// Mesure du coût de rendu (appels de dessin, triangles) à plusieurs endroits animés.
import { staticServer, launch, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-t', name: 'Perf', createdAt: 0, coins: 300, xp: 0, rep: 0, appearance: {} })));
for (const q of ['high', 'low']) {
  await page.goto(url + `index.html?heure=12&auto=solo&qualite=${q}`);
  await sleep(5000);
  for (const [name, x, z] of [['Grande Place', 0, 14], ['Ferme', -70, 20], ['Parc', 0, -70], ['Plage', 0, 75]]) {
    const r = await page.evaluate(([x, z]) => { const g = window.playzone; g.player.teleport(x, z, Math.PI); g.cam.yaw = 0; g.debugStep(0.3); g.engine.renderer.render(g.engine.scene, g.engine.camera); const i = g.engine.renderer.info.render; return { calls: i.calls, tris: i.triangles }; }, [x, z]);
    console.log(`qualité ${q.padEnd(4)} · ${name.padEnd(12)} : ${String(r.calls).padStart(4)} appels de dessin, ${(r.tris / 1000).toFixed(0)} k triangles`);
  }
}
await browser.close(); srv.close();
