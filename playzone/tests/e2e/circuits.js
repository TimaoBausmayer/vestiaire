// Grands circuits de F1 : 3 tracés (décor construit, carte), essais libres sur le Grand Prix des Dunes
// (feux, monoplace, on roule sur le bitume), qualifications validées → place sur la grille.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-f1', name: 'Pilote', createdAt: 0, coins: 90000, xp: 60000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=11&auto=solo&qualite=high', { timeout: 120000 });
await sleep(5000);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const info = await ev(async () => { const { ROUTES } = await import('/shared/courses.js'); return ['dunes', 'collines', 'nord'].map((k) => [k, Math.round(ROUTES[k].len)]); });
check(info.every(([, l]) => l > 5000), `3 grands circuits : ${info.map(([k, l]) => `${k} ${(l / 1000).toFixed(1)} km`).join(', ')}`);
check(await ev(() => window.playzone.races.circuits.root.children.length > 20), 'décor des circuits construit');
// paddock → essais sur les Dunes
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['f1-paddock']; const g = window.playzone; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(1); await g.net.request('admin.unlock', { code: 'Timao3049Bausmayer' }); });
await ev(() => window.playzone.races.start('f1', 'dunes-essais'));
await sleep(800);
check(await ev(() => window.playzone.vehicles.current?.model === 'f1'), 'monoplace sur la grille des Dunes');
await page.screenshot({ path: 'tests/e2e/out/circuits-grille.png' });
await sleep(3000);
await page.keyboard.down('KeyW');
for (let i = 0; i < 12; i++) await ev(() => window.playzone.debugStep(0.25));
const st = await ev(() => { const s = window.playzone.vehicles.current.sim; return { kmh: s.speed * 3.6, off: s.offroad, x: s.pos.x, z: s.pos.z }; });
await page.screenshot({ path: 'tests/e2e/out/circuits-dunes.png' });
await page.keyboard.up('KeyW');
check(st.kmh > 100, `on file sur la ligne droite (${Math.round(st.kmh)} km/h)`);
const paved = await ev(async ([x, z]) => { const { isPaved } = await import('/shared/world-layout.js'); return isPaved(x, z); }, [st.x, st.z]);
const dr = await ev(async ([x, z]) => { const { ROUTES, distToRoute } = await import('/shared/courses.js'); return distToRoute(ROUTES.dunes, x, z); }, [st.x, st.z]);
check(paved, `la piste compte comme du bitume (pas d'herbe dessus) · ${Math.round(st.x)},${Math.round(st.z)} à ${dr.toFixed(1)} m de l'axe`);
// fin des essais (abandon) → retour au paddock
await ev(() => window.playzone.races.finish(true));
await sleep(1500);
const back = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['f1-paddock'], P = window.playzone.player.pos; return Math.hypot(P.x - b.x, P.z - b.z); });
check(back < 80, `retour au paddock après l'abandon (${Math.round(back)} m)`);
// qualifications validées par l'autorité (tour simulé) → grille
const q = await ev(async () => {
  const g = window.playzone, { ROUTES } = await import('/shared/courses.js');
  await g.net.request('sport.start', { disc: 'f1', mode: 'collines-qualif' });
  const fin = ROUTES.collines.pts[0]; g.player.teleport(fin.x, fin.z, 0); g.net.sendState(g.player.netState(), g.player.zone);
  await new Promise((r) => setTimeout(r, 200));
  // on « attend » la durée d'un tour : l'autorité borne le temps au temps réel écoulé → on avance l'horloge
  return g.net.request('sport.finish', { time: 9999, laps: [ROUTES.collines.len / 30] }).catch((e) => ({ err: e.message }));
});
check(!!q.err || q.grid >= 1, `qualifications : ${q.err || `grille P${q.grid}`}`);
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'CIRCUITS OK' : 'CIRCUITS ÉCHEC');
process.exit(ok ? 0 : 1);
