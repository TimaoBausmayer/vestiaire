// Étape 6 : logement + déco, animal de compagnie, véhicule, téléphone.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-t', name: 'Testeur', createdAt: 0, coins: 20000, xp: 2000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo');
await sleep(5000);
const ev = (fn, arg) => page.evaluate(fn, arg);
const tp = (x, z, y) => ev(([x, z, y]) => { const g = window.playzone; g.player.teleport(x, z, 0, y); g.debugStep(0.1); }, [x, z, y]);
const req = (type, payload) => ev(([t, p]) => window.playzone.net.request(t, p).then((r) => ({ ok: true, r }), (e) => ({ ok: false, e: e.message })), [type, payload]);
let ok = true;
// achats : meubles, animal, véhicule, croquettes
await tp(18, 34.5);
for (const it of ['canape', 'tele', 'plante', 'boule-disco', 'agrandissement']) { const r = await req('shop.buy', { itemId: it }); if (!r.ok) { console.log('achat', it, r.e); ok = false; } }
await tp(-34.5, 18);
for (const it of ['pet-chien', 'croquettes', 'friandise', 'friandise']) { const r = await req('shop.buy', { itemId: it }); if (!r.ok) { console.log('achat', it, r.e); ok = false; } }
await tp(34.5, 18);
const rv = await req('shop.buy', { itemId: 'scooter' }); if (!rv.ok) { console.log('scooter', rv.e); ok = false; }
console.log('PC restants :', await ev(() => window.playzone.profile.coins));
// animal : il suit le joueur
await tp(0, 12);
await ev(() => window.playzone.debugStep(1.5));
const petInfo = await ev(() => { const f = window.playzone.pets.follower; const p = window.playzone.player.pos; return f ? { name: f.pet.name, dist: Math.hypot(f.anim.pos.x - p.x, f.anim.pos.z - p.z).toFixed(1) } : null; });
console.log('animal qui suit :', petInfo);
ok = ok && petInfo && petInfo.dist < 4;
const fed = await req('pet.feed', { petId: await ev(() => window.playzone.profile.activePet) });
const tr = await req('pet.train', { petId: await ev(() => window.playzone.profile.activePet) });
console.log('nourrir :', fed.ok, '· dressage :', tr.ok, tr.ok ? `séances ${tr.r.pet.trainings}` : tr.e);
await ev(() => { const g = window.playzone; g.cam.yaw = 2.3; g.cam.dist = 7; g.cam.pitch = 0.3; });
await sleep(800);
await page.screenshot({ path: 'tests/e2e/out/s6-chien.png' });
// logement
await tp(72, 12.5);
await page.keyboard.press('KeyE');
await sleep(1200);
const zone = await ev(() => window.playzone.player.zone);
console.log('zone après la porte :', zone);
ok = ok && zone.startsWith('home:');
const places = [['canape', 0, -4.5, 0], ['tele', 0, -1.8, 2], ['plante', 8, -5, 0], ['boule-disco', -5, 0, 0]];
for (const [itemId, x, z, r] of places) { const res = await req('home.place', { itemId, x, z, r }); if (!res.ok) { console.log('placement', itemId, res.e); ok = false; } }
const bad = await req('home.place', { itemId: 'canape', x: 0, z: 0, r: 0 });
console.log('placer un 2e canapé non possédé :', bad.ok ? 'ACCEPTÉ (bug)' : `refusé (${bad.e})`);
ok = ok && !bad.ok;
await ev(() => { const g = window.playzone; g.player.teleport(1002, 3, Math.PI); g.cam.yaw = 0.4; g.cam.pitch = 0.8; g.cam.dist = 13; g.debugStep(0.5); });
await sleep(1000);
await page.screenshot({ path: 'tests/e2e/out/s6-maison.png' });
// sortir puis conduire le scooter
await ev(() => { const g = window.playzone; g.home.exit(); });
await sleep(1200);
await ev(() => { const g = window.playzone; g.player.teleport(60, 0, Math.PI / 2); g.vehicles.summon(g.profile.vehicles[0].id); g.debugStep(0.2); });
await page.keyboard.press('KeyE');
await sleep(300);
const p0 = await ev(() => ({ ...window.playzone.player.pos }));
await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(2)); await page.keyboard.up('KeyW');
const p1 = await ev(() => ({ ...window.playzone.player.pos, driving: window.playzone.vehicles.driving }));
console.log('scooter : déplacé de', Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1), 'm en 2 s, en conduite :', p1.driving);
ok = ok && p1.driving && Math.hypot(p1.x - p0.x, p1.z - p0.z) > 8;
await ev(() => { const g = window.playzone; g.cam.yaw = g.vehicles.parked.yaw + 2.5; g.cam.dist = 6; g.cam.pitch = 0.25; g.debugStep(0.1); });
await sleep(800);
await page.screenshot({ path: 'tests/e2e/out/s6-scooter.png' });
// téléphone
await ev(() => window.playzone.vehicles.exit());
await page.keyboard.press('KeyP');
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/s6-phone.png' });
await page.locator('.app-icon', { hasText: 'Carte' }).click();
await sleep(900);
await page.screenshot({ path: 'tests/e2e/out/s6-phone-carte.png' });
console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
