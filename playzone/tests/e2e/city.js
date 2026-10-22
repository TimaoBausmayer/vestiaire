// Grande ville : quartiers, GPS (itinéraire sur les routes), circulation (voies, feux), bâtiments creux
// où l'on entre vraiment par la porte, murs solides.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-c', name: 'Explo', createdAt: 0, coins: 500, xp: 0, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=low');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
// zone affichée
await ev(() => { const g = window.playzone; g.player.teleport(160, 8, 0); g.debugStep(0.3); });
check((await ev(() => window.playzone.hud.zoneName.textContent)).includes('Lumière'), 'nom du quartier d\'affaires affiché');
// GPS vers l'hôpital depuis la place
const gps = await ev(() => {
  const g = window.playzone; g.player.teleport(0, 12, 0); g.debugStep(0.1);
  const d = { x: 250, z: -16, name: 'Hôpital' };
  g.phone.goTo(d); g.debugStep(0.6);
  return { pts: g.gps.route?.length, rem: Math.round(g.gps.remaining()), ribbon: g.gps.ribbon.geometry.attributes.position?.count };
});
console.log('  itinéraire :', JSON.stringify(gps));
check(gps.pts > 3 && gps.rem > 250 && gps.ribbon > 0, 'GPS : itinéraire par les routes + ruban au sol');
await page.screenshot({ path: 'tests/e2e/out/city-gps.png' });
// carte du téléphone
await page.keyboard.press('KeyM'); await sleep(900);
await page.screenshot({ path: 'tests/e2e/out/city-phone-map.png' });
await ev(() => window.playzone.phone.close());
// circulation : les voitures roulent et s'arrêtent aux feux
const t0 = await ev(() => window.playzone.traffic.cars.map((c) => [c.pos.x, c.pos.z]));
await ev(() => window.playzone.debugStep(6));
const t1 = await ev(() => window.playzone.traffic.cars.map((c) => [c.pos.x, c.pos.z]));
const moved = t0.filter((p, i) => Math.hypot(p[0] - t1[i][0], p[1] - t1[i][1]) > 5).length;
check(moved > t0.length * 0.4, `circulation : ${moved}/${t0.length} voitures ont roulé`);
let redStops = 0;
for (let k = 0; k < 6; k++) {
  redStops = Math.max(redStops, await ev(() => {
    const g = window.playzone; const t = g.now() / 1000; let n = 0;
    for (const c of g.traffic.cars) if (c && !c.seg.turn && c.seg.light && c.speed < 0.3 && c.seg.len - c.s < 4 && window.__ls) n++;
    return n;
  }));
  await ev(() => window.playzone.debugStep(2));
}
const stoppedAtLights = await ev(async () => {
  const { lightState } = await import('/src/world/traffic.js');
  const { ROAD_GRAPH } = await import('/shared/city.js');   // importé avant la boucle : pas d'attente entre le test du segment et son usage
  const g = window.playzone; const t = g.now() / 1000; let n = 0, viol = 0;
  for (let k = 0; k < 40; k++) {
    g.debugStep(0.25);
    for (const c of g.traffic.cars) {
      if (!c || !c.seg || c.seg.turn || !c.seg.light || c.seg.to === undefined) continue;
      const st = lightState(ROAD_GRAPH.nodes[c.seg.to], g.now() / 1000, c.seg.axis);
      if (st === 'R' && c.seg.len - c.s < 3 && c.speed < 0.5) n++;
    }
  }
  return n;
});
check(stoppedAtLights > 0, `des voitures s'arrêtent au feu rouge (${stoppedAtLights} observations)`);
// entrer par la porte de la pizzeria (bâtiment creux)
const enter = await ev(() => {
  const g = window.playzone;
  const b = g.world && (window.__b = null);
  return true;
});
const door = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID.pizzeria; return { x: b.door.x, z: b.door.z, bx: b.x, bz: b.z, w: b.w, d: b.d }; });
await ev(([d]) => { const g = window.playzone; g.player.teleport(d.x, d.z - 2, 0); g.cam.yaw = Math.PI; g.debugStep(0.2); }, [door]);
await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(2.2)); await page.keyboard.up('KeyW');
const inside = await ev(([d]) => { const p = window.playzone.player.pos; return { x: p.x, z: p.z, in: Math.abs(p.x - d.bx) < d.w / 2 - 0.3 && Math.abs(p.z - d.bz) < d.d / 2 - 0.3 }; }, [door]);
check(inside.in, `entré dans la pizzeria par la porte (${inside.x.toFixed(1)}, ${inside.z.toFixed(1)})`);
await ev(() => { const g = window.playzone; g.cam.pitch = 0.9; g.cam.dist = 9; g.debugStep(0.5); });
await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/city-inside-pizzeria.png' });
// les murs bloquent : on fonce vers le mur du fond
await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(4)); await page.keyboard.up('KeyW');
const wall = await ev(([d]) => { const p = window.playzone.player.pos; return { z: p.z, inside: Math.abs(p.z - d.bz) < d.d / 2 }; }, [door]);
check(wall.inside, `le mur du fond arrête le joueur (z=${wall.z.toFixed(1)})`);
console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
