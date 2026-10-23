// Grande carte ×4 : nouvelles régions (Nordville, lac, Marmottes, port Grand-Large, aéroport)
// et boutique premium (structure : refus sans paiement, gratuit pour l'admin).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-x', name: 'Explo', createdAt: 0, coins: 5000, xp: 0, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
await page.waitForFunction(() => window.playzone?.player, null, { timeout: 60000 });
await sleep(3000);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const { BOUNDS } = await ev(() => import('/shared/city.js'));
check(BOUNDS.maxX - BOUNDS.minX >= 3600 && BOUNDS.maxZ - BOUNDS.minZ >= 2400, `carte ${BOUNDS.maxX - BOUNDS.minX} × ${BOUNDS.maxZ - BOUNDS.minZ} m`);
const spots = { nordville: [20, -1380, Math.PI], lac: [-1100, -1250, Math.PI], marmottes: [-1350, -280, Math.PI / 2], 'grand-large': [1400, 60, Math.PI], aeroport: null };
const air = await ev(async () => { const { BUILDINGS } = await import('/shared/world-layout.js'); const b = BUILDINGS.find((x) => /aeroport|airport/.test(x.id)); return b ? [b.x, b.z + 40, 0] : null; });
spots.aeroport = air;
for (const [k, s] of Object.entries(spots)) {
  if (!s) { check(false, `${k} introuvable`); continue; }
  await ev(([x, z, yaw]) => { const g = window.playzone; g.player.teleport(x, z, yaw); g.cam.dist = 14; g.cam.pitch = 0.35; g.debugStep(0.6); }, s);
  await sleep(1500);
  const y = await ev(() => window.playzone.player.pos.y);
  check(Number.isFinite(y) && y > -2, `${k} : sol à ${y.toFixed(1)} m`);
  await page.screenshot({ path: `tests/e2e/out/region-${k}.png` });
}
// Massif des Géants : falaise infranchissable, à pied comme en voiture
await ev(() => { const g = window.playzone; g.player.teleport(300, -2940, Math.PI); g.cam.yaw = 0; g.cam.dist = 16; g.cam.pitch = 0.15; g.debugStep(0.3); });
await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(5)); await page.keyboard.up('KeyW');
const foot = await ev(() => ({ z: window.playzone.player.pos.z, y: window.playzone.player.pos.y }));
check(foot.z > -2966 && foot.y < 3, `à pied : bloqué au pied de la falaise (z=${foot.z.toFixed(1)}, y=${foot.y.toFixed(1)})`);
await sleep(1500);
await page.screenshot({ path: 'tests/e2e/out/region-falaise.png' });
const car = await ev(async () => { const { WorldVehicle } = await import('/src/vehicles/vehicles.js'); const g = window.playzone; const v = new WorldVehicle(g, { model: 'suv', x: 300, z: -2930, yaw: Math.PI, owner: 'stolen' }); g.vehicles.list.push(v); g.vehicles.enter(v); v.sim.place(300, -2930, Math.PI); v.sim.vx = 0; v.sim.vz = -30; v.sim.vf = 30; for (let i = 0; i < 60; i++) g.debugStep(1 / 20); const r = { z: v.sim.pos.z, y: v.sim.pos.y }; g.vehicles.exit(true); return r; });
check(car.z > -2968 && car.y < 3, `en 4x4 à 108 km/h : arrêté par la falaise (z=${car.z.toFixed(1)})`);
const d = await ev(async () => { const { destinations } = await import('/src/ui/gps.js'); return destinations(window.playzone.profile).map((x) => x.id); }).catch(() => []);
check(['nordville', 'lac', 'marmottes', 'grand-large'].every((x) => d.includes(x)), 'GPS : destinations des nouvelles régions');
const cBefore = await ev(() => window.playzone.profile.coins);
const refused = await ev(() => window.playzone.net.request('premium.buy', { id: 'pc-s' }).then(() => 'ok', (e) => e.message));
check(/indisponible/.test(refused), `boutique premium sans paiement : « ${refused.slice(0, 50)}… »`);
const c0 = await ev(() => window.playzone.profile.coins);
check(c0 === cBefore, 'rien n\'a été crédité');
await ev(() => window.playzone.net.request('admin.unlock', { code: 'Timao3049Bausmayer' }).catch(() => null));
const adm = await ev(() => window.playzone.profile.admin);
if (adm) {
  const r = await ev(() => window.playzone.net.request('premium.buy', { id: 'luxe' }).then(() => 'ok', (e) => e.message));
  check(r === 'ok' && await ev(() => window.playzone.profile.vehicles.some((v) => v.model === 'furioso')), 'admin : Pack Luxe gratuit, Furioso reçue');
}
await ev(() => window.playzone.phone.open?.('premium'));
await sleep(2500);
await page.screenshot({ path: 'tests/e2e/out/premium.png' });
check(/Pack Luxe/.test(await page.textContent('body')), 'appli Boutique 💎 dans le téléphone');
console.log(ok ? 'OK' : 'ÉCHEC'); const errs = errors.filter((e) => !/status of 404/.test(e));   // sonde du serveur (api/status) en mode solo
console.log(errs.length ? errs.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close(); process.exit(ok ? 0 : 1);
