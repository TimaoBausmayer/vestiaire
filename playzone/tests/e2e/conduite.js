// Graphismes et conduite : herbe 3D, boîte de vitesses (rapports, régime), hors route (plus lent,
// poussière), caméra dynamique (champ de vision), drift, phares la nuit ; captures.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-c', name: 'Pilote', createdAt: 0, coins: 900000, xp: 60000, rep: 0, appearance: {}, justice: { licence: { code: true, permis: true } } })));
await page.goto(url + 'index.html?heure=11&auto=solo&qualite=high', { timeout: 120000 });
await sleep(5000);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const step = (s) => ev(([s]) => window.playzone.debugStep(s), [s]);
const shot = async (name) => { await sleep(500); await page.screenshot({ path: `tests/e2e/out/conduite-${name}.png` }); };
// herbe 3D dans un parc
await ev(() => { const g = window.playzone; g.player.teleport(-1200, -460, Math.PI); g.cam.yaw = Math.PI * 0.2; g.cam.pitch = 0.18; g.cam.dist = 6; g.debugStep(0.6); });
const n = await ev(() => window.playzone.grass.mesh.count);
check(n > 500, `herbe 3D autour du joueur (${n} touffes)`);
await shot('herbe');
// voiture : on la fait apparaître sur une route droite (avenue de Prestige) et on accélère
await ev(async () => { const g = window.playzone; const { WorldVehicle } = await import('/src/vehicles/vehicles.js'); });
const ent = await ev(() => { const g = window.playzone; const vs = g.vehicles; const v = vs.spawnTemp ? vs.spawnTemp('sportive', 0, 12, Math.PI / 2) : null; return !!v; });
if (!ent) {
  await ev(async () => { const g = window.playzone; await g.net.request('admin.unlock', { code: 'Timao3049Bausmayer' }); });
}
// on utilise une voiture de location du jeu de test si besoin : achat d'une sportive (admin = gratuit)
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID.concession; const g = window.playzone; g.player.teleport(b.x, b.z, 0); g.debugStep(1); await g.net.request('admin.unlock', { code: 'Timao3049Bausmayer' }); await g.net.request('shop.buy', { itemId: 'sportive' }); g.debugStep(1); });
await sleep(800);
const inCar = await ev(async () => { const g = window.playzone; const car = g.profile.vehicles[0]; const v = g.vehicles.owned.get(car.id); if (!v) return false; const d = v.doorPoint(); g.player.teleport(d.x, d.z, 0); g.debugStep(0.3); g.vehicles.tryEnter(v); g.debugStep(0.5); return !!g.vehicles.current; });
check(inCar, 'au volant d\'une sportive');
// accélération en ligne droite (la plus longue avenue) : rapports qui montent
const road = async () => ev(async () => { const { STREETS } = await import('/shared/world-layout.js'); const st = STREETS.filter((x) => x.axis === 'h').sort((a, b) => (b.x2 - b.x1) - (a.x2 - a.x1))[0]; const g = window.playzone, s = g.vehicles.current.sim; s.place(st.x1 + 60, st.z, Math.PI / 2); g.debugStep(0.1); });
await road();
const gears = [];
await page.keyboard.down('KeyW');
for (let i = 0; i < 40; i++) { await step(0.15); const st = await ev(() => { const s = window.playzone.vehicles.current.sim; return { gear: s.gear, rpm: s.rpm, kmh: s.speed * 3.6, off: s.offroad }; }); gears.push(st.gear); }
const fov = await ev(() => window.playzone.engine.camera.fov);
await page.keyboard.up('KeyW');
check(Math.max(...gears) >= 2, `les rapports passent (rapport max ${Math.max(...gears) + 1})`);
check(fov > 60.5, `champ de vision élargi avec la vitesse (${fov.toFixed(1)}°)`);
await page.keyboard.down('KeyW'); await step(0.5);
const dash = await page.locator('.dash .gear').innerText();
await page.keyboard.up('KeyW');
check(/^[1-7]$/.test(dash), `rapport affiché au tableau de bord : ${dash}`);
await shot('vitesse');
// hors route : herbe → plus lent, poussière
const off = await ev(() => { const g = window.playzone, s = g.vehicles.current.sim; s.place(-1200, -470, Math.PI); g.debugStep(0.2); return s.offroad; });
check(off, 'sur l\'herbe : hors route détecté');
await page.keyboard.down('KeyW'); await step(4); await page.keyboard.up('KeyW');
const vOff = await ev(() => window.playzone.vehicles.current.sim.speed * 3.6);
check(vOff < 140, `hors route, vitesse limitée (${vOff.toFixed(0)} km/h)`);
await page.keyboard.down('KeyW'); await step(0.6); await shot('herbe-poussiere'); await page.keyboard.up('KeyW');
// drift au frein à main
await ev(async () => { const { STREETS } = await import('/shared/world-layout.js'); const st = STREETS.filter((x) => x.axis === 'h').sort((a, b) => (b.x2 - b.x1) - (a.x2 - a.x1))[0]; const g = window.playzone, s = g.vehicles.current.sim; s.place(st.x1 + 60, st.z, Math.PI / 2); g.debugStep(0.1); });
await page.keyboard.down('KeyW'); await step(2.5);
await page.keyboard.down('KeyD'); await page.keyboard.down('Space'); await step(0.8);
const drifting = await ev(() => window.playzone.vehicles.drifting?.pts || 0);
await page.keyboard.up('Space'); await page.keyboard.up('KeyD'); await page.keyboard.up('KeyW');
check(drifting > 0, `drift détecté (${Math.round(drifting)} points en cours)`);
await step(1.5);
// nuit : phares
await ev(() => { const g = window.playzone; g.world.dayNight.forcedHour = 22; g.debugStep(1); });
await step(1);
const hl = await ev(() => window.playzone.vehicles.headLight.intensity);
check(hl > 10, `phares allumés la nuit (${hl.toFixed(0)})`);
await shot('nuit-phares');
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'CONDUITE OK' : 'CONDUITE ÉCHEC');
process.exit(ok ? 0 : 1);
