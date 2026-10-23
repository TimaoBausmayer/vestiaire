// Conduite : acheter une voiture, l'appeler, monter (portière), accélérer, freiner, frein à main,
// percuter un mur (dégâts + bosses), état sauvegardé par l'autorité, descendre.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, justice: { licence: { code: true, permis: true } }, id: 'solo-d', name: 'Pilote', createdAt: 0, coins: 50000, xp: 20000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
await sleep(5000);
const ev = (fn, arg) => page.evaluate(fn, arg);
const req = (type, payload) => ev(([t, p]) => window.playzone.net.request(t, p).then((r) => ({ ok: true, r }), (e) => ({ ok: false, e: e.message })), [type, payload]);
let ok = true;
const check = (cond, msg) => { console.log(cond ? '✔' : '✘', msg); if (!cond) ok = false; };
// achat à la concession (dans le showroom)
await ev(() => { const g = window.playzone; g.player.teleport(172, -160, 0); g.debugStep(0.1); });
const buy = await req('shop.buy', { itemId: 'berline' });
check(buy.ok, `achat berline ${buy.ok ? '' : buy.e}`);
// appel sur l'avenue est (route dégagée), cap à l'est
await ev(() => { const g = window.playzone; g.player.teleport(60, 0, Math.PI / 2); g.debugStep(0.1); g.vehicles.summon(g.profile.vehicles.find((v) => v.model === 'berline').id); g.debugStep(0.3); });
const near = await ev(() => window.playzone.vehicles.nearest?.model);
check(near === 'berline', `voiture à portée de portière (${near})`);
await page.keyboard.press('KeyE');
await ev(() => window.playzone.debugStep(0.2));
check(await ev(() => window.playzone.vehicles.driving), 'monté dans la voiture');
// circulation traversable pendant les mesures (une voiture arrêtée au feu fausserait l'accélération)
const ghostTraffic = (on) => ev((on) => { for (const c of window.playzone.traffic?.cars || []) for (const k of c?.colliders || []) k.enabled = !on; }, on);
await ghostTraffic(true);
// accélération
const p0 = await ev(() => ({ ...window.playzone.player.pos }));
await page.keyboard.down('KeyW');
await ev(() => window.playzone.debugStep(3));
const st = await ev(() => { const s = window.playzone.vehicles.current.sim; return { v: s.speed, x: s.pos.x, z: s.pos.z }; });
console.log(`  vitesse après 3 s : ${(st.v * 3.6).toFixed(0)} km/h`);
check(st.v > 15, 'accélère (> 54 km/h en 3 s)');
await ev(() => { const g = window.playzone; g.cam.override = null; g.debugStep(0.1); });
await page.screenshot({ path: 'tests/e2e/out/drive-1.png' });
// freinage (sur l'avenue est, ligne droite)
await page.keyboard.up('KeyW');
const place = (x, z, yaw) => ev(([x, z, yaw]) => { const g = window.playzone; g.vehicles.current.sim.place(x, z, yaw); g.debugStep(0.05); }, [x, z, yaw]);
await place(40, 0, Math.PI / 2);
await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(2.5)); await page.keyboard.up('KeyW');
const v0 = await ev(() => window.playzone.vehicles.current.sim.speed);
await page.keyboard.down('KeyS');
await ev(() => window.playzone.debugStep(0.6));
const braking = await ev(() => { const s = window.playzone.vehicles.current.sim; return { v: s.speed, light: window.playzone.vehicles.current.visual.u.uBrake.value }; });
await page.screenshot({ path: 'tests/e2e/out/drive-2-frein.png' });
await page.keyboard.up('KeyS');
check(braking.light === 1 && braking.v < v0 - 5, `freine (feux stop : ${braking.light}, ${(v0 * 3.6).toFixed(0)} -> ${(braking.v * 3.6).toFixed(0)} km/h en 0,6 s)`);
await page.keyboard.down('KeyS'); await ev(() => window.playzone.debugStep(3)); await page.keyboard.up('KeyS');
const rev = await ev(() => { const s = window.playzone.vehicles.current.sim; return { vf: s.vf, rev: window.playzone.vehicles.current.visual.u.uRev.value }; });
check(rev.vf < -1 && rev.rev === 1, `marche arrière (feux de recul : ${rev.rev})`);
// virage au frein à main : dérapage + traces
await place(40, 0, Math.PI / 2);
await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(2));
await page.keyboard.down('KeyD'); await page.keyboard.down('Space');
await ev(() => window.playzone.debugStep(0.4));
const drift = await ev(() => { const s = window.playzone.vehicles.current.sim; return { slip: s.slip, skid: s.skid }; });
await page.screenshot({ path: 'tests/e2e/out/drive-3-derapage.png' });
await page.keyboard.up('KeyD'); await page.keyboard.up('Space'); await page.keyboard.up('KeyW');
check(drift.skid > 0.3, `dérapage au frein à main (glisse ${drift.slip.toFixed(1)} m/s)`);
await ghostTraffic(false);
// choc contre un mur : on vise un bâtiment à pleine vitesse
await ev(() => { const g = window.playzone; const v = g.vehicles.current; v.sim.place(78, -2, -Math.PI / 2 + Math.PI); v.sim.yaw = Math.PI / 2; });
// on vise la Résidence (x=72, z=22) depuis le nord : cap sud
await ev(() => { const g = window.playzone; const v = g.vehicles.current; v.sim.place(72, 4, 0); g.cam.yaw = Math.PI; });
await page.keyboard.down('KeyW');
await ev(() => window.playzone.debugStep(2.5));
await page.keyboard.up('KeyW');
const dmg = await ev(() => { const v = window.playzone.vehicles.current; return { d: v.sim.damage, dents: v.visual.u.uDents.value.filter((x) => x.w > 0).length, z: v.sim.pos.z }; });
console.log(`  après le choc : dégâts ${(dmg.d * 100).toFixed(0)} %, bosses ${dmg.dents}, z=${dmg.z.toFixed(1)}`);
check(dmg.d > 0.05 && dmg.dents > 0 && dmg.z < 14.5, 'le mur arrête la voiture, dégâts et bosses');
await ev(() => { const g = window.playzone; const v = g.vehicles.current; g.cam.override = { pos: v.pos.clone().add(new (v.pos.constructor)(4, 2.2, -2)), look: v.pos.clone().add(new (v.pos.constructor)(0, 0.8, 1.5)) }; g.debugStep(0.3); });
await sleep(600);
await page.screenshot({ path: 'tests/e2e/out/drive-4-choc.png' });
await ev(() => { window.playzone.cam.override = null; });
// descendre : état sauvegardé
await page.keyboard.press('KeyE');
await ev(() => window.playzone.debugStep(0.5));
await sleep(300);
const saved = await ev(() => { const g = window.playzone; const v = g.profile.vehicles.find((x) => x.model === 'berline'); return { driving: g.vehicles.driving, damage: v.damage, fuel: v.fuel }; });
check(!saved.driving && saved.damage > 0.05 && saved.fuel < 55, `descendu, état enregistré (dégâts ${(saved.damage * 100).toFixed(0)} %, carburant ${saved.fuel} L)`);
// l'autorité refuse une "réparation gratuite"
const cheat = await req('vehicle.state', { vehicleId: await ev(() => window.playzone.profile.vehicles.find((x) => x.model === 'berline').id), damage: 0, fuel: 55 });
const after = await ev(() => window.playzone.profile.vehicles.find((x) => x.model === 'berline'));
check(after.damage > 0.05 && after.fuel < 55, `réparation/plein gratuits ignorés par l'autorité (${after.damage}, ${after.fuel})`);
// le joueur ne traverse pas la voiture garée
await ev(() => { const g = window.playzone; const v = g.vehicles.summoned; g.player.teleport(v.pos.x + 3, v.pos.z, -Math.PI / 2); });
await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(1.5)); await page.keyboard.up('KeyW');
const blocked = await ev(() => { const g = window.playzone; const v = g.vehicles.summoned; return Math.hypot(g.player.pos.x - v.pos.x, g.player.pos.z - v.pos.z); });
check(blocked > 0.8, `on ne traverse pas une voiture garée (distance au centre ${blocked.toFixed(2)} m)`);
console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
