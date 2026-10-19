// Salon automobile : affiche tous les modèles de véhicules côte à côte (contrôle visuel) + conduite.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch({ width: 1280, height: 720 });
const page = await context.newPage();
const errors = watchConsole(page);
const hour = process.argv[2] || '11';
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-t', name: 'Testeur', createdAt: 0, coins: 90000, xp: 90000, rep: 0, appearance: {} })));
await page.goto(url + `index.html?heure=${hour}&auto=solo&qualite=high`);
await sleep(5000);
const ev = (fn, arg) => page.evaluate(fn, arg);
const models = await ev(async () => {
  const { CarVisual } = await import('/src/vehicles/car-models.js');
  const { VEHICLES, CAR_PAINTS } = await import('/src/../shared/content/vehicles.js');
  const g = window.playzone;
  const list = Object.keys(VEHICLES);
  window.__show = [];
  list.forEach((m, i) => {
    const v = new CarVisual(m, { paint: CAR_PAINTS[i % CAR_PAINTS.length], driver: i % 3 === 0 ? { skin: '#f1c27d', hair: '#3b2a1e', top: '#3d8ee8' } : null, driverKey: i % 3 === 0 ? 'x' : '' });
    const row = Math.floor(i / 6), col = i % 6;
    v.root.position.set(-30 + col * 7, 0, 50 + row * 9);
    v.root.rotation.y = -0.6;
    g.engine.scene.add(v.root);
    window.__show.push(v);
  });
  g.player.teleport(-12, 40, 0);
  g.cam.override = { pos: new (g.engine.camera.position.constructor)(-2, 9, 30), look: new (g.engine.camera.position.constructor)(-12, 0.5, 62) };
  g.debugStep(0.5);
  return list;
});
console.log('modèles :', models.join(', '));
await sleep(1500);
await page.screenshot({ path: `tests/e2e/out/cars-all-${hour}.png` });
// gros plans
const close = async (i, name, pos, look) => {
  await ev(([i, pos, look]) => { const g = window.playzone; const V = g.engine.camera.position.constructor; const r = window.__show[i].root.position; g.cam.override = { pos: new V(r.x + pos[0], pos[1], r.z + pos[2]), look: new V(r.x + look[0], look[1], r.z + look[2]) }; g.debugStep(1.5); }, [i, pos, look]);
  await sleep(900);
  await page.screenshot({ path: `tests/e2e/out/car-${name}-${hour}.png` });
};
for (const [i, name] of models.entries()) if (['berline', 'sportive', 'suv', 'police', 'pompiers', 'moto', 'citadine', 'bus', 'pickup'].includes(name)) await close(i, name, [4.5, 2.2, -3.5], [0, 0.8, 0]);
// la voiture conduite : dégâts
await ev(() => { const g = window.playzone; g.cam.override = null; for (const v of window.__show) v.root.visible = false; });
const r = await ev(async () => {
  const g = window.playzone;
  const id = g.profile.vehicles[0]?.id;
  return id;
});
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
