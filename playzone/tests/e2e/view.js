// Vue fixe du monde (contrôle visuel) : node tests/e2e/view.js <sortie.png> <heure> <cx,cy,cz> <lx,ly,lz> [qualité] [script]
import { staticServer, launch, watchConsole, sleep } from './lib.js';
import { mkdirSync } from 'node:fs';
const [out = 'tests/e2e/out/view.png', hour = '11', cam = '14,9,30', look = '0,2,0', q = 'high', script = ''] = process.argv.slice(2);
mkdirSync('tests/e2e/out', { recursive: true });
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-v', name: 'Vue', createdAt: 0, coins: 500, xp: 0, rep: 0, appearance: {} })));
await page.goto(url + `index.html?heure=${hour}&auto=solo&qualite=${q}`);
await sleep(5000);
const r = await page.evaluate(([cam, look, script]) => {
  const g = window.playzone; const V = g.engine.camera.position.constructor;
  const c = cam.split(',').map(Number), l = look.split(',').map(Number);
  g.player.teleport(l[0], l[2] + 3, 0);
  g.cam.override = { pos: new V(...c), look: new V(...l) };
  g.engine.camera.position.set(...c);
  const res = script ? eval(script) : undefined;
  g.debugStep(0.3);
  return res;
}, [cam, look, script]);
if (r !== undefined) console.log('résultat:', JSON.stringify(r));
await sleep(1500);
await page.screenshot({ path: out });
const info = await page.evaluate(() => { const r = window.playzone.engine.renderer; return { calls: r.info.render.calls, tris: r.info.render.triangles }; });
console.log('rendu', JSON.stringify(info));
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
