// Nouveaux métiers, Campus des Métiers (formations), magasins (maison, brico, jardin, sport, pharmacie,
// bijouterie) avec meubles 3D, villas de luxe à acheter.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-m', name: 'Bosseur', createdAt: 0, coins: 60000, xp: 9000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
for (let i = 0; i < 40 && !(await page.evaluate(() => !!window.playzone?.player)); i++) await sleep(500);
await sleep(1500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const inside = (id) => ev(async ([id]) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID[id]; const g = window.playzone; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has(id); i++) g.debugStep(0.3); g.debugStep(0.3); }, [id]);

const n = await ev(async () => { const { JOBS, TRAININGS } = await import('/shared/careers.js'); return [JOBS.length, Object.keys(TRAININGS).length]; });
check(n[0] >= 40 && n[1] >= 18, `${n[0]} métiers, ${n[1]} formations`);
await inside('pole-emploi');
const offers = await ev(async () => { const { BUILDINGS } = await import('/shared/world-layout.js'); const { jobsAt } = await import('/shared/authority-careers.js'); let k = 0; for (const b of BUILDINGS) k += jobsAt(b).length; return k; });
check(offers >= 100, `${offers} offres d'emploi dans la ville`);
// Campus : on s'inscrit à une formation
await inside('campus');
const tr = await ev(async () => { try { await window.playzone.net.request('career.train', { id: 'moniteur-sport' }); return window.playzone.profile.career.training?.id; } catch (e) { return e.message; } });
check(tr === 'moniteur-sport', `Campus des Métiers : inscription au brevet de moniteur de sports (${tr})`);
// magasins
for (const [b, item] of [['maison-deco', 'jacuzzi'], ['jardinerie', 'barbecue'], ['sport-shop', 'tapis-course'], ['pharmacie', 'trousse-secours'], ['bijouterie', 'bague-diamant'], ['bricolage', 'etabli']]) {
  await inside(b);
  const e = await ev(async (it) => { try { await window.playzone.net.request('shop.buy', { itemId: it }); return ''; } catch (e) { return e.message; } }, item);
  check(!e && ((await prof()).inventory[item] || 0) >= 1, `${b} : ${item} acheté ${e}`);
}
await inside('maison-deco');
await ev(() => { const g = window.playzone; g.cam.dist = 14; g.cam.pitch = 0.6; g.debugStep(0.4); });
await sleep(300);
await page.screenshot({ path: 'tests/e2e/out/metiers-maison.png' });
// villas
const villas = await ev(async () => { const { HOUSING } = await import('/shared/property.js'); return HOUSING.filter((h) => h.kind === 'villa').map((h) => h.price); });
check(villas.length >= 16 && Math.min(...villas) >= 1_000_000, `${villas.length} villas de luxe à vendre (dès ${Math.min(...villas).toLocaleString('fr-FR')} PC)`);

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
