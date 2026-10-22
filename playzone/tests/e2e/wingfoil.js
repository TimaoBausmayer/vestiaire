// Wingfoil : vent (prévisions, minimum 10 nœuds), Surf Shop, essai gratuit, glisse sur le foil,
// sauts avec rotations validés par l'autorité, achat du wingfoil.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-w', name: 'Kéké', createdAt: 0, coins: 15000, xp: 3000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=15&auto=solo&qualite=medium');
for (let i = 0; i < 40 && !(await page.evaluate(() => !!window.playzone?.player)); i++) await sleep(500);
await sleep(1500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const step = (n, dt = 0.1) => ev(([n, dt]) => { for (let i = 0; i < n; i++) window.playzone.debugStep(dt); }, [n, dt]);
const setWind = (strong) => ev(async (strong) => { const W = await import('/shared/wingfoil.js'); const { HOUR_MS } = await import('/shared/clock.js'); const g = window.playzone; for (let k = 0; k < 2000; k++) { const sh = k * HOUR_MS / 3; const w = W.windAt(g.now() + sh).kts; if (strong ? w >= 18 : w < 7) { localStorage.setItem('playzone.timeShift', String(sh)); g.world.dayNight.shift = sh; return w; } } return -1; }, strong);
const toShop = () => ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; const b = BUILDING_BY_ID['surf-shop']; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has('surf-shop'); i++) g.debugStep(0.3); const d = g.interiors.loaded.get('surf-shop').inters.find((x) => /Acheter/.test(typeof x.label === 'function' ? x.label() : x.label)); g.player.teleport(d.x, d.z, 0); g.debugStep(0.3); });

// 1) pas de vent : refus avec prévisions
const calm = await setWind(false);
await toShop();
const e1 = await ev(async () => { try { await window.playzone.net.request('wing.start', { mode: 'trial' }); return ''; } catch (e) { return e.message; } });
check(/Pas assez de vent/.test(e1), `sans vent (${calm} nds) : « ${e1.slice(0, 60)}… »`);

// 2) vent fort : essai gratuit
const kts = await setWind(true);
await page.keyboard.press('KeyE'); await sleep(400);
check(await page.getByText('Prévisions').count() > 0, 'le moniteur donne le vent et les prévisions');
await page.getByText('Essai gratuit').first().click(); await sleep(800);
check(await ev(() => !!window.playzone.wingfoil.s), `essai gratuit sur l'eau (vent ${kts} nds)`);
// prendre le vent de travers et accélérer
// travers au vent, du côté du large (selon la direction du vent du jour, l'autre bord mène à la plage)
await ev(async () => {
  const { groundHeight, WATER_LEVEL } = await import('/shared/world-layout.js');
  const g = window.playzone, s = g.wingfoil.s;
  const deep = (yaw) => { let ok = 0; for (let d = 10; d <= 110; d += 10) { const x = s.x + Math.sin(yaw) * d, z = s.z + Math.cos(yaw) * d; if (groundHeight(x, z) < WATER_LEVEL - 1 && z < 230 && Math.abs(x) < 890) ok++; } return ok; };
  const a = s.wind.dir + Math.PI / 2, b = s.wind.dir - Math.PI / 2;
  s.yaw = deep(a) >= deep(b) ? a : b;
});
await page.keyboard.down('KeyW'); await step(120); await page.keyboard.up('KeyW');
const sp = await ev(() => window.playzone.wingfoil.s.speed);
check(sp > 6.5, `sur le foil : ${(sp * 3.6).toFixed(0)} km/h`);
await ev(() => { const g = window.playzone; g.cam.dist = 9; g.cam.pitch = 0.25; g.debugStep(0.2); });
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/wing-ride.png' });
// saut
await ev(() => window.playzone.wingfoil.jump());
await step(8, 0.05);
await sleep(200);
await page.screenshot({ path: 'tests/e2e/out/wing-jump.png' });
await step(60, 0.05); await sleep(600);
const W = (await prof()).sports.wing;
check(W.jumps >= 1 && W.best > 0.6, `saut validé : ${W.best} m (${W.bestPoints} pts)`);
await ev(() => window.playzone.wingfoil.stop()); await sleep(300);
check(await ev(() => !window.playzone.wingfoil.s && !window.playzone.player.external), 'retour à la plage');

// 3) essai déjà utilisé -> location ou achat
await toShop();
const e2 = await ev(async () => { try { await window.playzone.net.request('wing.start', { mode: 'trial' }); return ''; } catch (e) { return e.message; } });
check(/essai gratuit est déjà utilisé/.test(e2), 'un seul essai gratuit');
await ev(async () => { await window.playzone.net.request('shop.buy', { itemId: 'wingfoil' }); });
check(((await prof()).inventory.wingfoil || 0) === 1, 'wingfoil acheté (1 800 PC)');

// 4) jet ski : essai gratuit, parcours de bouées, course contre des PNJ (avec son propre jet ski)
await toShop();
await ev(() => window.playzone.jetski.start('bouees')); await sleep(500);
check(await ev(() => !!window.playzone.jetski.s && window.playzone.jetski.rig.visible), 'jet ski à l\'eau (essai gratuit)');
await ev(() => { const s = window.playzone.jetski.s; s.go -= 4000; s.lapStart -= 4000; window.playzone.net.session.race.go -= 4000; });
await page.keyboard.down('KeyW');
await ev(() => { for (let i = 0; i < 35; i++) window.playzone.debugStep(0.05); });
await page.keyboard.up('KeyW');
const jsp = await ev(() => { const s = window.playzone.jetski.s; return Math.hypot(s.vx, s.vz); });
check(jsp > 8, `jet ski : ${Math.round(jsp * 3.6)} km/h`);
await ev(() => { const g = window.playzone; g.cam.dist = 8; g.cam.pitch = 0.25; g.debugStep(0.1); });
await sleep(300);
await page.screenshot({ path: 'tests/e2e/out/jetski.png' });
await ev(async () => {
  const g = window.playzone, J = g.jetski, s = J.s, { ROUTES } = await import('/shared/courses.js'); const R = ROUTES.bouees;
  s.go -= 120000; s.lapStart -= 120000; g.net.session.race.go -= 120000;
  let guard = 0;
  while (J.s && guard++ < 100) { const gt = R.gates[s.next]; s.x = gt.x; s.z = gt.z; g.debugStep(0.05); }
  await new Promise((r) => setTimeout(r, 800));
});
const pj = await prof();
check(pj.sports.jetski?.best?.bouees > 0, `parcours de bouées : ${pj.sports.jetski?.best?.bouees} s`);
await ev(() => { const g = window.playzone; for (const m of [...g.ui.stack]) m.close(); });
await ev(async () => { await window.playzone.net.request('shop.buy', { itemId: 'jetski' }); });
await toShop();
await ev(() => window.playzone.jetski.start('course')); await sleep(500);
check(await ev(() => window.playzone.jetski.s?.npcs.length === 6), 'course : 6 jet skis PNJ (sans abonnement grâce à son jet ski)');
await ev(() => { for (let i = 0; i < 80; i++) window.playzone.debugStep(0.05); });
await sleep(200);
await page.screenshot({ path: 'tests/e2e/out/jetski-course.png' });
await ev(() => window.playzone.jetski.stop(true)); await sleep(300);

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
