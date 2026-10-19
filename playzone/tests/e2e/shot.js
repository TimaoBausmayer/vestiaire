// Usage : node tests/e2e/shot.js <sortie.png> [script JS à évaluer dans la page] [attente ms]
import { staticServer, launch, watchConsole, sleep } from './lib.js';
import { mkdirSync } from 'node:fs';
const [out = 'tests/e2e/out/shot.png', script = '', wait = '4000'] = process.argv.slice(2);
mkdirSync('tests/e2e/out', { recursive: true });
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.goto(url + 'index.html' + (process.env.QS || ''));
await sleep(+wait);
if (script) { const r = await page.evaluate(script); if (r !== undefined) console.log('résultat:', JSON.stringify(r)); await sleep(1500); }
await page.screenshot({ path: out });
const fps = await page.evaluate(() => window.playzone?.engine?.fps?.toFixed(1));
const info = await page.evaluate(() => { const r = window.playzone?.engine?.renderer; return r ? { calls: r.info.render.calls, tris: r.info.render.triangles } : null; });
console.log('fps', fps, 'rendu', JSON.stringify(info));
console.log(errors.length ? errors.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close();
