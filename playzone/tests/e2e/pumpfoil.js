// Pumpfoil : sans aile ni vent. Espace plein de fois, en rythme, pour décoller sur le foil ; on reste
// en l'air tant qu'on pompe ; si on arrête, on retombe dans l'eau. Record du plus long vol.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-pf', name: 'Pompeur', createdAt: 0, coins: 5000, xp: 3000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=15&auto=solo&qualite=medium');
await page.waitForFunction(() => window.playzone?.player, null, { timeout: 90000 });
await sleep(3000);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const step = (n, dt = 0.1) => ev(([n, dt]) => { for (let i = 0; i < n; i++) window.playzone.debugStep(dt); }, [n, dt]);
const S = () => ev(() => { const g = window.playzone, s = g.wingfoil.s; return s && { pumps: s.pumps, beat: s.beat, y: s.y, cr: s.crashed, v: s.speed, tk: g.wingfoil.stats.takeoff, flight: s.flight, best: s.bestFlight, wing: g.wingfoil.wingMesh.visible, st: s.stamina }; });
// un coup de pompe (Espace) puis 0,4 s
const pump = async (n, gap = 0.4) => { for (let i = 0; i < n; i++) { await page.keyboard.press('Space'); await step(Math.round(gap / 0.1)); } };

// au Surf Shop, chez le moniteur
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone, b = BUILDING_BY_ID['surf-shop']; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has('surf-shop'); i++) g.debugStep(0.3); const d = g.interiors.loaded.get('surf-shop').inters.find((x) => /Acheter/.test(typeof x.label === 'function' ? x.label() : x.label)); g.player.teleport(d.x, d.z, 0); g.debugStep(0.3); });
await page.keyboard.press('KeyE'); await sleep(400);
await page.getByText(/Pumpfoil, sans vent/).click(); await sleep(1000);
let s = await S();
check(s && !s.wing, 'pumpfoil à l\'eau, sans aile (quel que soit le vent)');
// cap vers le large
await ev(() => { const s = window.playzone.wingfoil.s; s.yaw = 0; });
// 1) un seul coup ne suffit pas
await pump(1);
s = await S();
check(s.v < s.tk, `un seul coup de pompe : ${Math.round(s.v * 3.6)} km/h, pas encore en vol`);
// 2) plein de coups en rythme : on décolle
let n = 0;
while ((await S()).v <= (await S()).tk && n < 30) { await pump(1); n++; }
s = await S();
check(s.v > s.tk, `décollage après ${n + 1} coups de pompe (${Math.round(s.v * 3.6)} km/h) ${JSON.stringify(s)}`);
// 3) on continue à pomper : on reste en l'air
await pump(20);
s = await S();
check(s.v > s.tk && s.flight > 6, `toujours en vol en pompant : ${s.flight.toFixed(1)} s`);
await ev(() => { const g = window.playzone; g.cam.yaw = g.wingfoil.s.yaw + 2.2; g.cam.pitch = 0.18; g.cam.dist = 7; g.debugStep(0.1); });
await sleep(900);
await page.screenshot({ path: 'tests/e2e/out/pumpfoil-vol.png' });
// 4) spammer trop vite : moins efficace
const fast = await ev(() => { const s = window.playzone.wingfoil.s; return s.speed; });
// 5) on arrête de pomper : on retombe
await step(60);
s = await S();
check(s.v < s.tk && s.flight === 0, `sans pomper, on retombe dans l'eau (${Math.round(s.v * 3.6)} km/h)`);
void fast;
// 6) fin de session : record
await ev(() => window.playzone.wingfoil.stop()); await sleep(1200);
const best = await ev(() => window.playzone.profile.sports.wing.pumpBest);
check(best > 6, `record de vol en pumpfoil : ${best} s`);

console.log(ok ? 'OK' : 'ÉCHEC');
const errs = errors.filter((e) => !/status of 404|AudioContext/.test(e));
console.log(errs.length ? errs.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
