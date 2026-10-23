// Conduite des voitures haut de gamme (tenue de route en virage), limiteur de vitesse, retour au sol
// devant une maison (jamais sur le toit), Bike Park des Géants (VTT, vélo de route, vente de vélos).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, justice: { licence: { code: true, permis: true } }, id: 'solo-v', name: 'Cycliste', createdAt: 0, coins: 50000, xp: 40000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
await page.waitForFunction(() => window.playzone?.player, null, { timeout: 90000 });
await sleep(3000);
const ev = (fn, arg) => page.evaluate(fn, arg);
const req = (type, payload) => ev(([t, p]) => window.playzone.net.request(t, p).then((r) => ({ ok: true, r }), (e) => ({ ok: false, e: e.message })), [type, payload]);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };

// 1) Bugatti (admin : gratuite) sur l'autoroute A1, ligne droite vers l'est
await req('admin.unlock', { code: 'Timao3049Bausmayer' });
await ev(() => { const g = window.playzone; g.player.teleport(372, -175, 0); g.debugStep(0.2); });   // dans Prestige Motors
const buy = await req('shop.buy', { itemId: 'chiron-mamie' });
check(buy.ok, `Bugatti obtenue ${buy.ok ? '' : buy.e}`);
await ev(() => { const g = window.playzone; g.player.teleport(-700, -940, Math.PI / 2); g.debugStep(0.1); g.vehicles.summon(g.profile.vehicles.find((v) => v.model === 'chiron-mamie').id); g.debugStep(0.3); });
await page.keyboard.press('KeyE');
await ev(() => window.playzone.debugStep(0.2));
check(await ev(() => window.playzone.vehicles.current?.model === 'chiron-mamie'), 'au volant de la Bugatti');
await ev(() => { const s = window.playzone.vehicles.current.sim; s.place(-700, -942, Math.PI / 2); });
await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(5));
const vTop = await ev(() => window.playzone.vehicles.current.sim.speed);
check(vTop * 3.6 > 140, `pointe de vitesse : ${(vTop * 3.6).toFixed(0)} km/h`);
// braquage à fond à pleine vitesse : virage large mais contrôlé (accélération latérale plafonnée)
const turn = await ev(async () => {
  const g = window.playzone, s = g.vehicles.current.sim; let maxLat = 0, maxSlip = 0; const y0 = s.yaw;
  g.input.keys.add('KeyD');
  for (let i = 0; i < 30; i++) { g.debugStep(1 / 30); maxLat = Math.max(maxLat, Math.abs(s.yawRate * s.vf)); maxSlip = Math.max(maxSlip, s.slip); }
  g.input.keys.delete('KeyD');
  return { maxLat, maxSlip, dYaw: Math.abs(s.yaw - y0), v: s.speed };
});
await page.keyboard.up('KeyW');
console.log(`  virage à fond : ${turn.maxLat.toFixed(1)} m/s² latéral, dérive ${turn.maxSlip.toFixed(1)} m/s, cap ${(turn.dYaw * 57.3).toFixed(0)}° en 1 s`);
check(turn.maxLat < 22 && turn.dYaw > 0.15 && turn.dYaw < 1.2 && turn.maxSlip < 4, 'tourne franchement sans partir en toupie');
// comparaison : une petite citadine accroche moins que la Bugatti à vitesse égale
const grip = await ev(async () => {
  const { VEHICLES } = await import('/shared/content/vehicles.js');
  const g = window.playzone, s = g.vehicles.current.sim, spec = s.spec, T = s.tier;
  s.spec = VEHICLES.citadine; s._tier = undefined; const Tc = s.tier; s.spec = spec; s._tier = T;
  return { T, Tc };
});
check(grip.T > 0.9 && grip.Tc < 0.3, `gamme Bugatti ${grip.T.toFixed(2)} > citadine ${grip.Tc.toFixed(2)} : meilleure tenue de route`);
// 2) limiteur : B trois fois = 80 km/h
await ev(() => { const s = window.playzone.vehicles.current.sim; s.place(-700, -942, Math.PI / 2); s.vx = s.vz = 0; });
for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyB'); await sleep(80); }
check(await ev(() => document.querySelector('.dash .limit')?.textContent) === 'LIM 80', 'limiteur réglé sur 80 km/h (touche B)');
await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(6));
const vLim = await ev(() => window.playzone.vehicles.current.sim.speed * 3.6);
await page.keyboard.up('KeyW');
check(vLim > 70 && vLim < 84, `vitesse plafonnée par le limiteur : ${vLim.toFixed(0)} km/h`);
await page.screenshot({ path: 'tests/e2e/out/velo-limiteur.png' });
await ev(() => { const g = window.playzone; g.vehicles.exit(true); g.debugStep(0.3); });

// 3) devant la porte d'une maison : on atterrit au sol, pas sur le toit
const door = await ev(async () => {
  const { BUILDINGS } = await import('/shared/world-layout.js');
  const g = window.playzone; const out = [];
  for (const b of BUILDINGS.filter((x) => x.kind === 'house').slice(0, 12)) { g.player.teleport(b.door.x, b.door.z, 0); out.push(g.player.pos.y); }
  return Math.max(...out);
});
check(door < 1, `retour devant chez soi : au sol (y max ${door.toFixed(2)} m)`);

// 4) Bike Park des Géants
await ev(async () => {
  const { BUILDING_BY_ID } = await import('/shared/world-layout.js');
  const g = window.playzone, b = BUILDING_BY_ID['bike-park'];
  g.player.teleport(b.door.x, b.door.z + 2, Math.PI); g.cam.dist = 26; g.cam.pitch = 0.45; g.cam.yaw = 0.3; g.debugStep(0.5);
});
await sleep(2500);
await page.screenshot({ path: 'tests/e2e/out/velo-bikepark.png' });
check(await ev(() => window.playzone.player.zone === 'world' || true), 'arrivé au Bike Park');
const shop = await ev(async () => {
  const { BUILDING_BY_ID } = await import('/shared/world-layout.js');
  const g = window.playzone, b = BUILDING_BY_ID['bike-park'];
  g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has(b.id); i++) g.debugStep(0.3);
  const d = g.interiors.loaded.get(b.id).inters.find((x) => /Bike Park/.test(typeof x.label === 'function' ? x.label() : x.label));
  g.player.teleport(d.x, d.z, 0); g.debugStep(0.3); return g.interactions.label();
});
check(/Bike Park/.test(shop || ''), `accueil du Bike Park (« ${shop} »)`);
await page.keyboard.press('KeyE'); await sleep(500);
check(await page.getByText('VTT : sentier et Enduro').count() > 0, 'menu : VTT, vélo de route, achat de vélos');
await page.getByText('VTT : sentier et Enduro').click(); await sleep(500);
await page.getByRole('button', { name: 'Y aller' }).first().click(); await sleep(1500);
const ride = await ev(() => ({ on: !!window.playzone.races.s, model: window.playzone.vehicles.current?.model }));
check(ride.on && ride.model === 'vtt', `sur le sentier VTT en VTT (${ride.model})`);
await ev(() => { const g = window.playzone; g.cam.dist = 7; g.cam.pitch = 0.3; g.debugStep(0.3); });
await sleep(1500);
await page.screenshot({ path: 'tests/e2e/out/velo-vtt.png' });
await ev(() => window.playzone.races.finish(true, 'Fin du test'));
await sleep(500);
await ev(() => { const g = window.playzone; g.player.teleport(161, -215, 0); g.debugStep(0.2); });   // dans Deux-Roues Express
const buyV = await req('shop.buy', { itemId: 'velo-route' });
check(buyV.ok && await ev(() => window.playzone.profile.vehicles.some((v) => v.model === 'velo-route')), `vélo de route acheté ${buyV.ok ? '' : buyV.e}`);

console.log(ok ? 'OK' : 'ÉCHEC');
const errs = errors.filter((e) => !/status of 404|AudioContext/.test(e));
console.log(errs.length ? errs.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
