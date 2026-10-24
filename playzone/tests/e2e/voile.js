// Club de voile du Cap Venteux : spot toujours venté (≥ 15 nœuds), dériveurs (Optimist, 49er...),
// gîte et dessalage sans rappel, kitesurf avec sauts, voilerie (achat d'un Laser, navigation sur le lac).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-v', name: 'Marin', createdAt: 0, coins: 60000, xp: 60000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=13&auto=solo&qualite=medium');
await page.waitForFunction(() => window.playzone?.player, null, { timeout: 90000 });
await sleep(3000);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const step = (n, dt = 0.1) => ev(([n, dt]) => { for (let i = 0; i < n; i++) window.playzone.debugStep(dt); }, [n, dt]);
// cap au travers du vent, du côté du large
const beam = () => ev(async () => {
  const { groundHeight, WATER_LEVEL } = await import('/shared/world-layout.js');
  const s = window.playzone.sailing.s;
  const deep = (yaw) => { let n = 0; for (let d = 10; d <= 90; d += 10) if (groundHeight(s.x + Math.sin(yaw) * d, s.z + Math.cos(yaw) * d) < WATER_LEVEL - 1) n++; return n; };
  const a = s.wind.dir + Math.PI / 2, b = s.wind.dir - Math.PI / 2; s.yaw = deep(a) >= deep(b) ? a : b;
});
const toClub = () => ev(async () => {
  const { BUILDING_BY_ID } = await import('/shared/world-layout.js');
  const g = window.playzone, b = BUILDING_BY_ID['club-voile'];
  g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has(b.id); i++) g.debugStep(0.3);
  const d = g.interiors.loaded.get(b.id).inters.find((x) => /Club de voile/.test(typeof x.label === 'function' ? x.label() : x.label));
  g.player.teleport(d.x, d.z, 0); g.debugStep(0.3); return g.interactions.label();
});

// 1) le spot : toujours du vent
const winds = await ev(async () => { const { windAtPos, windAt } = await import('/shared/wingfoil.js'); const { HOUR_MS } = await import('/shared/clock.js'); let min = 99, minCity = 99; for (let k = 0; k < 200; k++) { const t = Date.now() + k * HOUR_MS * 0.7; min = Math.min(min, windAtPos(t, -2350, 230).kts); minCity = Math.min(minCity, windAt(t).kts); } return { min, minCity }; });
check(winds.min >= 15, `Cap Venteux : jamais moins de ${winds.min} nœuds (ailleurs, ça descend à ${winds.minCity})`);
// 2) club-house : liste des bateaux, essai gratuit en Optimist
check(/Club de voile/.test(await toClub() || ''), 'accueil du club de voile');
await page.keyboard.press('KeyE'); await sleep(600);
const txt = await page.locator('.modal').last().textContent();
check(['Optimist', 'ILCA 6', 'Laser', '420', '29er', '49er', 'Kitesurf'].every((n) => txt.includes(n)), 'Optimist, ILCA 6, Laser, 420, 29er, 49er, kitesurf proposés');
await page.locator('.modal .list-item', { hasText: 'Optimist' }).getByRole('button').click(); await sleep(1500);
check(await ev(() => window.playzone.sailing.s?.id === 'optimist'), 'Optimist à l\'eau (essai gratuit)');
await beam();
await step(80);
const v1 = await ev(() => window.playzone.sailing.s.speed);
check(v1 > 2.5, `au travers : ${Math.round(v1 * 3.6)} km/h`);
await ev(() => { const g = window.playzone; g.cam.dist = 10; g.cam.pitch = 0.3; g.debugStep(0.2); });
await sleep(1200);
await page.screenshot({ path: 'tests/e2e/out/voile-optimist.png' });
await ev(() => window.playzone.sailing.stop()); await sleep(500);
// 3) 49er sans rappel : ça dessale ; au rappel (Espace) : ça tient
await toClub();
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; await g.sailing.start('49er', g.sailing.launchFor(BUILDING_BY_ID['club-voile'])); });
await sleep(800);
await beam();
// on attend un moment de brise forte (≥ 22 nœuds) au Cap Venteux
await ev(async () => { const W = await import('/shared/wingfoil.js'); const { HOUR_MS } = await import('/shared/clock.js'); const g = window.playzone, s = g.sailing.s; for (let k = 0; k < 3000; k++) { const sh = k * HOUR_MS / 4; if (W.windAtPos(g.now() + sh, s.x, s.z).kts >= 22) { localStorage.setItem('playzone.timeShift', String(sh)); g.world.dayNight.shift = sh; break; } } });
await beam();
await ev(() => { const s = window.playzone.sailing.s; s.sheet = 1; s.speed = 8; });
const cap1 = await ev(() => { const g = window.playzone, s = g.sailing.s; for (let i = 0; i < 60; i++) g.debugStep(0.1); return s.capsizes; });
check(cap1 >= 1, `49er toute voile dehors sans rappel : dessalage (${cap1})`);
await page.screenshot({ path: 'tests/e2e/out/voile-dessale.png' });
await step(40);
await page.keyboard.down('Space');
const cap2 = await ev(() => { const g = window.playzone, s = g.sailing.s; const c0 = s.capsizes; for (let i = 0; i < 60; i++) g.debugStep(0.1); return { n: s.capsizes - c0, heel: s.heel, v: s.speed }; });
await ev(() => { const g = window.playzone; g.cam.dist = 11; g.cam.pitch = 0.28; g.debugStep(0.2); });
await sleep(1000);
await page.screenshot({ path: 'tests/e2e/out/voile-49er.png' });
await page.keyboard.up('Space');
check(cap2.n === 0, `au rappel : le 49er tient (gîte ${cap2.heel.toFixed(2)}, ${Math.round(cap2.v * 3.6)} km/h)`);
await ev(() => window.playzone.sailing.stop()); await sleep(500);
// 4) kitesurf : saut
await toClub();
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; await g.sailing.start('kite', g.sailing.launchFor(BUILDING_BY_ID['club-voile'])); });
await sleep(800);
await beam();
await step(60);
await ev(() => { const s = window.playzone.sailing.s; s.speed = Math.max(s.speed, 9); window.playzone.sailing.jump(); });
await step(6, 0.05);
await ev(() => { const g = window.playzone; g.cam.dist = 12; g.cam.pitch = 0.2; g.debugStep(0.05); });
await sleep(800);
await page.screenshot({ path: 'tests/e2e/out/voile-kite.png' });
await step(60, 0.05); await sleep(700);
const S = await ev(() => window.playzone.profile.sports.sail);
check(S.jumps >= 1 && S.best > 1, `kite : saut de ${S.best} m (${S.bestPoints} pts)`);
await ev(() => window.playzone.sailing.stop()); await sleep(500);
// 5) voilerie : achat d'un Laser, navigation sur le lac
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone, b = BUILDING_BY_ID['voilerie']; g.player.teleport(b.x, b.z, 0); g.debugStep(0.3); });
const buy = await ev(() => window.playzone.net.request('shop.buy', { itemId: 'bateau-laser' }).then(() => true, (e) => e.message));
check(buy === true, `Laser acheté à la voilerie ${buy === true ? '' : buy}`);
await ev(async () => { const { LAKE } = await import('/shared/world-layout.js'); const g = window.playzone; g.player.teleport(LAKE.x, LAKE.z - LAKE.r / 1.3 - 4, 0); g.debugStep(0.3); g.sailing.launchHere('laser'); });
await sleep(1000);
check(await ev(() => window.playzone.sailing.s?.id === 'laser'), 'son Laser à l\'eau sur le lac');
await ev(() => window.playzone.sailing.stop()); await sleep(400);

console.log(ok ? 'OK' : 'ÉCHEC');
const errs = errors.filter((e) => !/status of 404|AudioContext/.test(e));
console.log(errs.length ? errs.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
