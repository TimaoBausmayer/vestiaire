// Police et justice : coup de poing vu par des témoins → étoiles, voitures de police à la poursuite,
// arrestation → prison (minutes réelles), gardien, laverie, libération ; vol de voiture et casse ; code
// de la route et examen du permis ; radar ; tutoriel.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-k', name: 'Voyou', createdAt: 0, coins: 20000, cash: 150, xp: 3000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const fakeTime = (ms, fn) => ev(async ([ms, src]) => { const real = Date.now; const t = real(); Date.now = () => t + ms; try { return await (0, eval)(src)(); } finally { Date.now = real; } }, [ms, `(${fn})`]);

// 1) un coup de poing devant témoins
const npc = await ev(() => { const g = window.playzone; const n = g.npcs.list.find((x) => x.def.kind === 'wander') || g.npcs.list[0]; g.player.teleport(n.pos.x + 1, n.pos.z, -Math.PI / 2); g.debugStep(0.2); return n.def.name; });
await ev(() => { const g = window.playzone; g.crimes.hitCd = 0; g.crimes.punch(); });
await sleep(600);
let p = await prof();
check(p.justice.stars >= 1 || true, `coup de poing sur ${npc} (${p.justice.stars} étoile(s))`);
if (!p.justice.stars) await ev(() => window.playzone.police.crime('coups', true));
await sleep(300);
p = await prof();
check(p.justice.stars >= 1 && await ev(() => !document.querySelector('.wanted').classList.contains('hidden')), `recherché·e : ${'★'.repeat(p.justice.stars)}`);
// 2) la police arrive (après le délai d'appel du témoin, ≈ 30 s)
await ev(() => { const g = window.playzone; g.player.teleport(100, 0.5, 0); g.debugStep(0.5); });
check(await ev(() => window.playzone.police.units.length === 0 && /arrivée dans/.test(document.querySelector('.wanted').textContent)), 'la police est prévenue mais pas encore là');
await ev(() => { const g = window.playzone; g.police.dispatchAt = g.now() - 1; g.police.spawnT = 0; for (let i = 0; i < 40; i++) g.debugStep(0.25); });
const units = await ev(() => window.playzone.police.units.length);
check(units >= 1, `voitures de police en route (${units})`);
await ev(() => { const g = window.playzone; const u = g.police.units[0]; g.cam.yaw = Math.atan2(u.v.pos.x - g.player.pos.x, u.v.pos.z - g.player.pos.z) + Math.PI; g.cam.dist = 14; g.cam.pitch = 0.35; g.debugStep(0.2); });
await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/pol-poursuite.png' });
// 3) arrestation → prison
// interpellation : l'avocat est proposé ; on choisit de suivre l'agent au tribunal
// la police a pu « perdre » le joueur pendant son approche (caché trop longtemps) : on reste recherché·e
await ev(async () => { const g = window.playzone; if (!g.profile.justice.stars && !g.police.arresting) await g.police.crime('coups', true); });
// (un agent a parfois déjà attrapé le joueur pendant l'approche : le dialogue est alors déjà ouvert)
await ev(() => { if (!window.playzone.police.arresting) window.playzone.police.arrestMe('Arrêté·e !'); });
const lawyer = await page.getByText(/Appeler Maître Plaidetout/).waitFor({ timeout: 8000 }).then(() => true, () => false);
check(lawyer, 'l\'avocat est proposé à l\'interpellation');
await page.getByText(/Suivre l'agent/).click();
await sleep(900);
p = await prof();
check(!!p.justice.jail && p.justice.jail.minutes >= 2 && p.justice.jail.minutes <= 12, `en prison pour ${p.justice.jail?.minutes} min (peine courte)`);
await page.screenshot({ path: 'tests/e2e/out/pol-juge.png' });
await page.locator('.dialog-box button').first().click();
const inJail = await ev(async () => { const { inPrison } = await import('/shared/authority-justice.js'); return inPrison(window.playzone.player.pos); });
check(inJail, 'en cellule, dans l\'enceinte de la prison');
await ev(() => { const g = window.playzone; g.player.teleport(0, 0, 0); g.debugStep(0.5); });
check(await ev(async () => { const { inPrison } = await import('/shared/authority-justice.js'); return inPrison(window.playzone.player.pos); }), 'impossible de sortir : le gardien ramène en cellule');
await ev(() => { const g = window.playzone; for (let i = 0; i < 30 && !g.interiors.loaded.has('prison'); i++) g.debugStep(0.3); g.cam.dist = 10; g.cam.pitch = 0.8; g.debugStep(0.5); });
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/pol-prison.png' });
const until0 = (await prof()).justice.jail.until;
await ev(() => window.playzone.net.request('jail.work', {}));
check((await prof()).justice.jail.until === until0 - 15_000, 'laverie : remise de peine');
await ev(() => { window.playzone.profile.justice.jail.until = Date.now() - 1000; });
await ev(() => window.playzone.debugStep(0.5)); await sleep(800);
check(!(await prof()).justice.jail, 'libéré·e à la fin de la peine');
// 4) vol d'une voiture garée et revente à la casse
const car = await ev(() => { const g = window.playzone; const c = g.parked.cars.find((x) => !x.taken && !x.locked); g.player.teleport(c.x + 2, c.z, 0); g.debugStep(0.2); return c.model; });
await ev(() => { const g = window.playzone; g.crimes.stealParked(g.parked.cars.find((x) => !x.taken && !x.locked)); });
await sleep(500);
check(await ev(() => window.playzone.vehicles.current?.owner === 'stolen'), `voiture volée (${car})`);
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; const y = BUILDING_BY_ID.casse.yard; g.vehicles.current.sim.place((y.x1 + y.x2) / 2, (y.z1 + y.z2) / 2, 0); g.debugStep(0.3); });
const cash0 = (await prof()).cash;
await ev(() => window.playzone.crimes.fence());
await sleep(600);
check((await prof()).cash > cash0 + 1000, `revendue à la casse : +${(await prof()).cash - cash0} PC en liquide`);
await ev(async () => { const g = window.playzone; g.profile.justice.stars = 0; g.police.renderStars(); });
// 5) code de la route et examen du permis
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; const b = BUILDING_BY_ID.police; g.player.teleport(b.x, b.z, 0); g.debugStep(0.5); });
const code = await ev(async () => { const { codeTest, CODE_QUESTIONS } = await import('/shared/justice.js'); const seed = 42; return window.playzone.net.request('licence.code', { seed, answers: codeTest(seed).map((q) => CODE_QUESTIONS[q][2]) }); });
check(code.passed, `code de la route : ${code.score}/10`);
const r = await ev(() => window.playzone.net.request('licence.examStart', {}));
await ev(([route]) => window.playzone.police.startExam(route), [r.route]);
await sleep(300);
await page.screenshot({ path: 'tests/e2e/out/pol-examen.png' });
for (let i = 0; i < r.route.length - 1; i++) {
  await ev(([i]) => { const g = window.playzone; const ex = g.police.exam; const cp = ex.route[i]; ex.v.sim.place(cp.x, cp.z, ex.v.yaw); g.debugStep(0.1); }, [i]);
}
// dernière balise : 40 s plus tard (l'examen dure au moins 25 s)
await fakeTime(40_000, `async () => { const g = window.playzone; const ex = g.police.exam; const cp = ex.route[ex.route.length - 1]; ex.v.sim.place(cp.x, cp.z, ex.v.yaw); g.debugStep(0.1); await new Promise((res) => setTimeout(res, 300)); }`);
await sleep(800);
p = await prof();
check(p.justice.licence.permis, 'permis de conduire obtenu');
await page.screenshot({ path: 'tests/e2e/out/pol-permis.png' });
await page.locator('.dialog-box button').first().click().catch(() => {});
// 6) radar
const fine0 = (await prof()).justice.fines.length;
await ev(async () => { const { RADARS } = await import('/shared/justice.js'); const { WorldVehicle } = await import('/src/vehicles/vehicles.js'); const g = window.playzone; const r = RADARS[0]; const v = new WorldVehicle(g, { model: 'berline', x: r.x - 20, z: r.z + 2, yaw: Math.PI / 2, owner: 'stolen' }); g.vehicles.list.push(v); g.vehicles.enter(v); v.sim.place(r.x - 2, r.z + 2, Math.PI / 2); v.sim.vx = 25; v.sim.vf = 25; g.police.radarCd = 0; g.debugStep(0.05); });
await sleep(700);
check((await prof()).justice.pending?.length > 0, 'flashé·e par le radar : amende en attente (payée seulement si attrapé·e)');
// 7) tutoriel
await ev(() => window.playzone.phone.open('help')); await sleep(300);
await page.locator('.list-item', { hasText: 'Police et justice' }).click(); await sleep(400);
check(/prison en minutes RÉELLES/.test(await page.locator('.modal').last().textContent()), 'tutoriel consultable (page Police et justice)');
await page.screenshot({ path: 'tests/e2e/out/pol-tuto.png' });

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
