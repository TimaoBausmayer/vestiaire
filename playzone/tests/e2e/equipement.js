// Avocat (à l'arrestation et depuis le téléphone), mécano mobile (réparation sur place, plus chère
// qu'au garage), équipement de wingfoil à la carte (ailes, foils, couleurs), mise à l'eau « où on
// veut » (lac), jet ski sur place, téléphone (recherche d'appli, raccourcis, Météo).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, justice: { licence: { code: true, permis: true } }, id: 'solo-q', name: 'Equipe', createdAt: 0, coins: 80000, xp: 40000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=15&auto=solo&qualite=medium');
await page.waitForFunction(() => window.playzone?.player, null, { timeout: 90000 });
await sleep(3000);
const ev = (fn, arg) => page.evaluate(fn, arg);
const req = (type, payload) => ev(([t, p]) => window.playzone.net.request(t, p).then((r) => ({ ok: true, r }), (e) => ({ ok: false, e: e.message })), [type, payload]);
const coins = () => ev(() => window.playzone.profile.coins);
const closeAll = () => ev(() => { window.playzone.ui.closeAll(); window.playzone.phone?.close(); });
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };

// 1) avocat au moment de l'arrestation : pas de prison, on reste sur place
await ev(() => { const g = window.playzone; g.player.teleport(40, 0, 0); g.debugStep(0.2); });
await req('crime.report', { type: 'coups', witnessed: true });
const c0 = await coins();
const pos0 = await ev(() => ({ ...window.playzone.player.pos }));
await ev(() => { window.playzone.police.arrestMe('Contrôle !'); });
await sleep(400);
check(await page.getByText(/Appeler Maître Plaidetout/).count() > 0, 'interpellation : proposition d\'avocat');
await page.getByText(/Appeler Maître Plaidetout/).click(); await sleep(800);
const j1 = await ev(() => ({ stars: window.playzone.profile.justice.stars, jail: !!window.playzone.profile.justice.jail, pos: { ...window.playzone.player.pos } }));
const c1 = await coins();
check(!j1.jail && j1.stars === 0 && Math.hypot(j1.pos.x - pos0.x, j1.pos.z - pos0.z) < 3, 'avocat : affaire classée, pas de prison, on reste sur place');
check(c0 - c1 > 600, `honoraires payés : ${c0 - c1} PC`);
await closeAll();
// 2) avocat depuis le téléphone pendant une poursuite
await req('crime.report', { type: 'coups', witnessed: true });
await ev(() => window.playzone.phone.open('avocat')); await sleep(1500);
await page.getByText(/Appeler Maître Plaidetout/).click(); await sleep(600);
check(await ev(() => window.playzone.profile.justice.stars) === 0, 'appli Avocat : poursuite arrêtée depuis le téléphone');
await closeAll();

// 3) mécano mobile : réparation sur place, plus chère qu'au garage
await ev(() => { const g = window.playzone; g.player.teleport(172, -160, 0); g.debugStep(0.1); });
const buy = await req('shop.buy', { itemId: 'berline' });
check(buy.ok, `berline achetée ${buy.ok ? '' : buy.e}`);
await ev(() => { const g = window.playzone; g.player.teleport(60, 0, Math.PI / 2); g.debugStep(0.1); g.vehicles.summon(g.profile.vehicles.find((v) => v.model === 'berline').id); g.debugStep(0.3); });
await page.keyboard.press('KeyE'); await ev(() => window.playzone.debugStep(0.2));
const dmg = await ev(async () => { const { repairCost, mobileRepairCost } = await import('/shared/property.js'); const v = window.playzone.vehicles.current; v.sim.damage = 0.5; return { garage: repairCost(v.model, 0.5), mobile: mobileRepairCost(v.model, 0.5) }; });
await ev(() => window.playzone.debugStep(0.3));
await sleep(300);
check(await ev(() => getComputedStyle(document.querySelector('.dash .fix')).display !== 'none'), 'bouton 🔧 « Réparer ici » sur le compteur');
const c2 = await coins();
await page.locator('.dash .fix').click(); await sleep(600);
const c3 = await coins();
check(await ev(() => window.playzone.vehicles.current.sim.damage) === 0 && c2 - c3 === dmg.mobile && dmg.mobile > dmg.garage, `réparé sur place : ${dmg.mobile} PC (garage : ${dmg.garage} PC)`);
await ev(() => { const g = window.playzone; g.vehicles.exit(true); g.debugStep(0.3); });

// 4) équipement de wingfoil : achats au Surf Shop, réglage dans le téléphone
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone, b = BUILDING_BY_ID['surf-shop']; g.player.teleport(b.x, b.z, 0); g.debugStep(0.3); });
for (const id of ['wingfoil', 'aile-7', 'foil-800', 'jetski']) { const r = await req('shop.buy', { itemId: id }); check(r.ok, `Surf Shop : ${id} acheté ${r.ok ? '' : r.e}`); }
const nItems = await ev(() => Object.values(window.playzone.net.content.items).filter((i) => i.shop === 'surf').length);
check(nItems >= 14, `Surf Shop : ${nItems} articles (ailes, planches, foils...)`);
await ev(() => window.playzone.phone.open('gear')); await sleep(1500);
await page.locator('.list-item', { hasText: 'Aile Pétole 7 m²' }).getByRole('button', { name: 'Équiper' }).click(); await sleep(500);
await page.locator('.field', { hasText: 'Aile' }).first().locator('.swatch').nth(3).click(); await sleep(500);
const gear = await ev(() => window.playzone.profile.gear);
check(gear?.wing === 'aile-7' && gear?.wingColor === '#3a86ff', `équipé : ${gear?.wing}, aile ${gear?.wingColor}`);
await page.screenshot({ path: 'tests/e2e/out/equip-app.png' });
await closeAll();

// 5) mise à l'eau « où on veut » : au bord du Lac des Grenouilles
await ev(async () => { const { LAKE } = await import('/shared/world-layout.js'); const g = window.playzone; g.player.teleport(LAKE.x, LAKE.z - LAKE.r / 1.3 - 4, 0); g.debugStep(0.3); });
// vent suffisant pour l'aile de 7 m² (6 nœuds)
const kts = await ev(async () => { const W = await import('/shared/wingfoil.js'); const { HOUR_MS } = await import('/shared/clock.js'); const g = window.playzone; for (let k = 0; k < 2000; k++) { const sh = k * HOUR_MS / 3; const w = W.windAt(g.now() + sh).kts; if (w >= 7 && w < 9) { g.world.dayNight.shift = sh; return w; } } return -1; });
await ev(() => window.playzone.wingfoil.launchHere()); await sleep(800);
const ride = await ev(async () => { const { LAKE } = await import('/shared/world-layout.js'); const s = window.playzone.wingfoil.s; return s ? { d: Math.hypot(s.x - LAKE.x, (s.z - LAKE.z) * 1.3), min: window.playzone.wingfoil.stats.minWind } : null; });
check(ride && ride.d < 160 && ride.min === 6, `wingfoil sur le lac avec l'aile 7 m² par ${kts} nœuds (minimum ${ride?.min})`);
await ev(() => { const g = window.playzone; g.cam.dist = 9; g.cam.pitch = 0.3; g.debugStep(0.3); });
await sleep(1200);
await page.screenshot({ path: 'tests/e2e/out/equip-lac.png' });
await ev(() => window.playzone.wingfoil.stop()); await sleep(400);
const back = await ev(async () => { const { LAKE } = await import('/shared/world-layout.js'); const P = window.playzone.player.pos; return Math.hypot(P.x - LAKE.x, P.z - (LAKE.z - LAKE.r / 1.3 - 4)); });
check(back < 5, 'retour sur la rive d\'où on était parti');
await ev(() => window.playzone.jetski.launchHere()); await sleep(800);
check(await ev(() => !!window.playzone.jetski.s), 'jet ski mis à l\'eau sur le lac');
await ev(() => window.playzone.jetski.stop(true)); await sleep(600);
await closeAll();

// 6) téléphone : recherche d'appli, raccourcis, Météo
await ev(() => window.playzone.phone.open()); await sleep(1500);
check(await page.locator('.quick-actions .qa').count() >= 2, `raccourcis : ${await page.locator('.quick-actions .qa').allTextContents()}`);
await page.locator('.ph-search').fill('mét'); await sleep(200);
const vis = await ev(() => [...document.querySelectorAll('.phone-apps .app-icon')].filter((e) => e.style.display !== 'none').map((e) => e.textContent));
check(vis.length === 1 && /Météo/.test(vis[0]), `recherche « mét » : ${vis.join(', ')}`);
await page.screenshot({ path: 'tests/e2e/out/equip-phone.png' });
await ev(() => window.playzone.phone.go('meteo')); await sleep(800);
check(await page.locator('.meteo .mcol').count() === 10, 'Météo : prévisions sur 10 heures');

console.log(ok ? 'OK' : 'ÉCHEC');
const errs = errors.filter((e) => !/status of 404|AudioContext/.test(e));
console.log(errs.length ? errs.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
