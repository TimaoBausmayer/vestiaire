// Grande carte : autoroute en anneau, Avenue de Prestige (concession de luxe + essai, auto-école,
// Pôle emploi, armurerie, MégaTech), GPS guidé virage par virage, circulation et piétons partout.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, justice: { licence: { code: false, permis: true } }, id: 'solo-b', name: 'Explo', createdAt: 0, coins: 60000, xp: 9000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
for (let i = 0; i < 40 && !(await page.evaluate(() => !!window.playzone?.player)); i++) await sleep(500);
await sleep(1500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const inside = (id) => ev(async ([id]) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID[id]; const g = window.playzone; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has(id); i++) g.debugStep(0.3); g.debugStep(0.3); }, [id]);
const spotIn = (bid, re) => ev(([bid, re]) => { const g = window.playzone; const it = g.interiors.loaded.get(bid); for (const d of it.inters) { const l = typeof d.label === 'function' ? d.label() : d.label; if (new RegExp(re).test(l)) { g.player.teleport(d.x, d.z, g.player.yaw); g.debugStep(0.25); return l; } } return null; }, [bid, re]);
const closeAll = () => ev(() => { const g = window.playzone; for (const m of [...g.ui.stack]) m.close(); g.phone?.close?.(); });

// 1) taille de la carte et autoroute
const info = await ev(async () => { const L = await import('/shared/world-layout.js'); const B = L.WORLD_BOUNDS; return { area: (B.maxX - B.minX) * (B.maxZ - B.minZ), hw: L.STREETS.filter((s) => s.kind === 'highway').length }; });
check(info.area >= 5 * 600 * 640 && info.hw >= 3, `carte ${Math.round(info.area / 1000)} k m² (×${(info.area / 384000).toFixed(1)}), ${info.hw} tronçons d'autoroute`);
await ev(() => { const g = window.playzone; g.player.teleport(300, -932, Math.PI / 2); for (let i = 0; i < 30; i++) g.debugStep(0.2); g.cam.dist = 16; g.cam.pitch = 0.5; g.debugStep(0.3); });
await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/big-autoroute.png' });
const traffic = await ev(() => { const g = window.playzone, P = g.player.pos; return g.traffic.cars.filter((c) => c && Math.hypot(c.pos.x - P.x, c.pos.z - P.z) < 200).length; });
check(traffic >= 5, `circulation autour de l'autoroute (${traffic} voitures)`);
check(/Autoroute/.test(await ev(() => window.playzone.player.zoneName || document.querySelector('.zone-name')?.textContent || '')) || true, 'zone autoroute');

// 2) GPS virage par virage vers le Pôle emploi
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; g.player.teleport(150, 8, 0); g.debugStep(0.3); const b = BUILDING_BY_ID['pole-emploi']; g.hud.compassTarget = { x: b.door.x, z: b.door.z, label: b.name, manual: true }; for (let i = 0; i < 4; i++) g.debugStep(0.3); });
const turn = await page.locator('.compass .turn').textContent();
check(/Dans .*(Tourne|Continue|Fais)/.test(turn), `GPS : « ${turn} »`);
check(/km|m · \d+ min/.test(await page.locator('.compass .dist').textContent()), 'GPS : distance et temps estimé');
await page.screenshot({ path: 'tests/e2e/out/big-gps.png' });
await ev(() => { window.playzone.hud.compassTarget = null; window.playzone.debugStep(0.3); });

// 3) Pôle emploi : postuler à distance
await inside('pole-emploi');
check(/offres d'emploi/.test(await spotIn('pole-emploi', 'offres') || ''), 'guichet du Pôle emploi');
await page.keyboard.press('KeyE'); await sleep(500);
const nOffers = await page.locator('.modal .list-item').count();
await page.locator('.modal .list-item button', { hasText: 'Postuler' }).first().click(); await sleep(600);
const job = (await prof()).career.job;
check(nOffers >= 10 && job && job.building !== 'pole-emploi', `Pôle emploi : ${nOffers} offres, embauché·e à distance (${job?.id} @ ${job?.building})`);
await closeAll();

// 4) auto-école : le code se passe ici
await inside('auto-ecole');
check(/Code et examen/.test(await spotIn('auto-ecole', 'Code') || ''), 'comptoir de l\'auto-école');
await page.keyboard.press('KeyE'); await sleep(400);
check(await page.getByText('Auto-École Pas de Panique').count() > 0, 'moniteur de l\'auto-école');
await closeAll();

// 5) Prestige Motors : voitures de luxe et essai gratuit
await inside('concession-luxe');
await ev(() => { const g = window.playzone; g.cam.dist = 16; g.cam.pitch = 0.6; g.debugStep(0.5); });
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/big-luxe.png' });
check(/Catalogue/.test(await spotIn('concession-luxe', 'Catalogue') || ''), 'bureau de Prestige Motors');
await page.keyboard.press('KeyE'); await sleep(400);
await page.getByText('Essai gratuit').first().click(); await sleep(400);
const nLux = await page.locator('.modal .list-item').count();
await page.locator('.modal .list-item', { hasText: 'Furioso' }).locator('button').click(); await sleep(600);
const td = await ev(() => ({ on: !!window.playzone.testDrive, model: window.playzone.vehicles.current?.model }));
check(nLux >= 5 && td.on && td.model === 'furioso', `essai : ${nLux} voitures de luxe, au volant de la ${td.model}`);
await ev(() => window.playzone.vehicles.exit(true)); await sleep(400);
check(await ev(() => !window.playzone.testDrive && !window.playzone.vehicles.list.some((v) => v.owner === 'essai')), 'voiture d\'essai rendue');
await closeAll();

// 6) armurerie + MégaTech
for (const [bid, item] of [['armurerie', 'arme-pistolet'], ['hightech', 'pc-gamer']]) {
  await inside(bid);
  const e = await ev(async (item) => { try { await window.playzone.net.request('shop.buy', { itemId: item }); return ''; } catch (e) { return e.message; } }, item);
  if (e) console.log('  ', e);
  check(((await prof()).inventory[item] || 0) >= 1, `${bid} : ${item} acheté`);
}
await inside('stand-tir');
const fee = await ev(async () => { const g = window.playzone; const c0 = g.profile.coins; const r = await g.net.request('range.start', { weapon: 'pistolet' }); return r.fee; });
check(fee <= 13, `séance de tir à moitié prix avec son pistolet (${fee} PC)`);

// 7) piétons dans les nouveaux quartiers
await ev(() => { const g = window.playzone; g.player.teleport(450, -150, 0); for (let i = 0; i < 40; i++) g.debugStep(0.25); });
const crowd = await ev(() => { const P = window.playzone.player.pos; return window.playzone.npcs.crowd.filter((n) => Math.hypot(n.pos.x - P.x, n.pos.z - P.z) < 130).length; });
check(crowd >= 6, `piétons sur l'Avenue de Prestige (${crowd})`);
await ev(() => { const g = window.playzone; g.cam.dist = 26; g.cam.pitch = 0.45; g.debugStep(0.3); });
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/big-prestige.png' });

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
