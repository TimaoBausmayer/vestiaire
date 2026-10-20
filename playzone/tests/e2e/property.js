// Propriété : voiture neuve livrée garée, clés et verrouillage, stationnement mémorisé, plein à la pompe,
// réparation au garage, location, occasion, louer une maison et la meubler, appartement à crédit
// (ascenseur), factures horaires.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-p', name: 'Proprio', createdAt: 0, coins: 900000, xp: 60000, rep: 0, appearance: {}, inventory: { canape: 1, tele: 1, plante: 2 } })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
const req = (type, payload) => ev(([t, p]) => window.playzone.net.request(t, p).then((r) => ({ ok: true, r }), (e) => ({ ok: false, e: e.message })), [type, payload]);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const tp = (x, z, yaw = 0) => ev(([x, z, yaw]) => { const g = window.playzone; g.player.teleport(x, z, yaw); g.debugStep(0.3); }, [x, z, yaw]);
const inside = async (id) => { await ev(async ([id]) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID[id]; const g = window.playzone; g.player.teleport(b.x, b.z, 0); g.debugStep(1.2); }, [id]); };
const spot = (re) => ev(([re]) => { const g = window.playzone; for (const d of g.interactions.list) { const l = typeof d.label === 'function' ? d.label() : d.label; if ((!d.enabled || d.enabled()) && new RegExp(re).test(l || '')) { const x = typeof d.x === 'function' ? d.x() : d.x, z = typeof d.z === 'function' ? d.z() : d.z; g.player.teleport(x, z, g.player.yaw); g.debugStep(0.25); return l; } } return null; }, [re]);
const shot = async (name) => { await ev(() => window.playzone.debugStep(0.5)); await sleep(600); await page.screenshot({ path: `tests/e2e/out/prop-${name}.png` }); };
const prof = () => ev(() => window.playzone.profile);

// 1) voiture neuve : livrée garée et verrouillée devant la concession
await inside('concession');
let r = await req('shop.buy', { itemId: 'berline' });
check(r.ok, `achat d'une berline ${r.e || ''}`);
let car = (await prof()).vehicles[0];
check(car?.park && car.locked, 'garée devant la concession, verrouillée');
await tp(car.park.x + 4, car.park.z + 4);
await ev(() => window.playzone.debugStep(1.2));
check(await ev(([id]) => window.playzone.vehicles.owned.has(id), [car.id]), 'la voiture apparaît dans le monde à sa place');
await ev(([id]) => { const g = window.playzone; const v = g.vehicles.owned.get(id); g.cam.yaw = v.yaw + 2.4; g.cam.dist = 8; g.cam.pitch = 0.3; }, [car.id]);
await shot('livraison');
// monter (déverrouille automatiquement), rouler un peu, descendre : position mémorisée
await ev(([id]) => { const g = window.playzone; const v = g.vehicles.owned.get(id); const d = v.doorPoint(); g.player.teleport(d.x, d.z, 0); g.debugStep(0.3); }, [car.id]);
await page.keyboard.press('KeyE'); await ev(() => window.playzone.debugStep(0.3));
check(await ev(() => window.playzone.vehicles.driving), 'au volant (clés dans la poche)');
await ev(() => { const g = window.playzone; g.vehicles.current.sim.place(194, -36, 0); g.debugStep(0.2); }); // station Pleins Gaz
await page.keyboard.press('KeyE'); await ev(() => window.playzone.debugStep(1.0));
await sleep(500);
car = (await prof()).vehicles[0];
check(!await ev(() => window.playzone.vehicles.driving) && Math.hypot(car.park.x - 194, car.park.z + 36) < 1 && car.locked, `garée et verrouillée là où on l'a laissée (${car.park.x.toFixed(1)}, ${car.park.z.toFixed(1)})`);
// 2) plein d'essence à la pompe
await ev(([id]) => { const g = window.playzone; const v = g.vehicles.owned.get(id); v.sim.fuel = 8; g.vehicles.saveState(v); }, [car.id]);
await sleep(300);
const fuelLab = await ev(() => { const g = window.playzone; g.debugStep(0.2); return g.interactions.label(); });
check(/Faire le plein/.test(fuelLab || ''), `pompe proposée : ${fuelLab}`);
const c0 = (await prof()).coins;
await page.keyboard.press('KeyE'); await sleep(800);
let p = await prof();
check(p.vehicles[0].fuel === 55 && c0 - p.coins === Math.round(47 * 2), `réservoir plein, payé ${c0 - p.coins} PC`);
await ev(() => { const g = window.playzone; g.cam.yaw = 2.2; g.cam.dist = 11; g.cam.pitch = 0.35; });
await shot('pompe');
// 3) réparation au Garage du Piston Fou
await ev(([id]) => { const g = window.playzone; const v = g.vehicles.owned.get(id); v.sim.damage = 0.55; v.visual.dent(0.8, 0.7, 2, 0.8); g.vehicles.saveState(v); }, [car.id]);
await ev(async ([id]) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID.piston; const g = window.playzone; const v = g.vehicles.owned.get(id); v.sim.place(b.door.x + 6, b.door.z, Math.PI / 2); g.vehicles.park(v); }, [car.id]);
await inside('piston');
const repLab = await spot('Atelier');
check(!!repLab, `comptoir de l'atelier : ${repLab}`);
await page.keyboard.press('KeyE'); await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/prop-garage.png' });
await page.getByRole('button', { name: /Réparer \(/ }).click(); await sleep(800);
p = await prof();
check(p.vehicles[0].damage === 0, `réparée (${p.coins} PC restants)`);
await page.keyboard.press('Escape');
// 4) location : une sportive pour 10 minutes
await inside('location');
await spot('Louer un véhicule'); await page.keyboard.press('KeyE'); await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/prop-location.png' });
await page.locator('.list-item', { hasText: 'Fusée GT' }).getByRole('button', { name: '10 min' }).click(); await sleep(800);
p = await prof();
const rented = p.vehicles.find((v) => v.rentUntil);
check(rented?.model === 'sportive' && rented.rentUntil - Date.now() > 9 * 60_000, 'sportive louée 10 minutes');
await page.keyboard.press('Escape');
// 5) occasion du jour
await inside('occasions');
await spot('voitures d\'occasion'); await page.keyboard.press('KeyE'); await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/prop-occasions.png' });
const nb = (await prof()).vehicles.length;
await page.locator('.list-item').first().getByRole('button').click(); await sleep(800);
check((await prof()).vehicles.length === nb + 1, 'voiture d\'occasion achetée');
await page.keyboard.press('Escape');
// 6) agence : louer une maison, y entrer, la meubler
await inside('immo');
await spot('annonces immobilières'); await page.keyboard.press('KeyE'); await sleep(500);
await page.getByRole('button', { name: 'Maisons', exact: true }).click(); await sleep(300);
await page.screenshot({ path: 'tests/e2e/out/prop-agence.png' });
await page.keyboard.press('Escape');
r = await req('home.rent', { id: 'maison-t3' });
check(r.ok && (await prof()).home.place === 'maison-t3', 'maison louée, on y habite');
await inside('maison-t3');
await ev(() => window.playzone.debugStep(1.0));
const st = await ev(() => { const g = window.playzone; const it = g.interiors.loaded.get('maison-t3'); return { inside: g.interiors.inside?.id, staff: it?.people.length, deco: !!g.home.decoBtn }; });
check(st.inside === 'maison-t3' && st.staff === 0 && st.deco, `chez soi : maison vide, bouton Décorer (${JSON.stringify(st)})`);
for (const [id, dx] of [['canape', -1.5], ['tele', 1.8]]) {
  await ev(([id, dx]) => { const g = window.playzone; const b = g.interiors.inside; g.player.teleport(b.x + dx, b.z, 0); g.debugStep(0.1); g.home.startGhost(id); g.debugStep(0.1); }, [id, dx]);
  await ev(() => window.playzone.home.confirmGhost());
  await sleep(500);
}
await ev(() => window.playzone.debugStep(0.6));
p = await prof();
check(p.home.furniture.length === 2, `2 meubles posés dans la maison (${p.home.furniture.map((f) => f.i).join(', ')})`);
const mine = await ev(() => { const it = window.playzone.interiors.loaded.get('maison-t3'); return { labels: it.inters.map((i) => (typeof i.label === 'function' ? i.label() : i.label)), staff: it.people.length }; });
check(mine.labels.some((l) => /Regarder la télé/.test(l)) && mine.labels.some((l) => /asseoir/.test(l)) && mine.staff === 0, `meubles utilisables chez soi : ${mine.labels.join(' | ')}`);
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; const b = BUILDING_BY_ID['maison-t3']; g.player.teleport(b.x + 1, b.z + 1, Math.PI); g.cam.yaw = 0.5; g.debugStep(0.3); });
await shot('maison-meublee');
// 7) appartement à crédit + ascenseur
r = await req('home.buy', { id: 'immeuble1-2', loan: true });
check(!r.ok, 'il faut être à l\'agence pour signer');
await inside('immo');
r = await req('home.buy', { id: 'immeuble1-2', loan: true });
check(r.ok && r.r.loanLeft > 100000, `appartement acheté à crédit (reste ${r.r?.loanLeft} PC)`);
await inside('immeuble1');
await spot('ascenseur'); await page.keyboard.press('KeyE'); await sleep(900);
await ev(() => window.playzone.debugStep(0.5));
check(await ev(() => window.playzone.player.zone.startsWith('home:')), 'l\'ascenseur monte à l\'appartement');
await shot('appartement');
await spot('Sortir'); await page.keyboard.press('KeyE'); await sleep(900);
check(await ev(() => window.playzone.player.zone === 'world'), 'retour dans le hall');
// 8) factures : une minute de jeu
await ev(() => { window.playzone.profile.bills.at = Date.now() - 60_000; });
const c1 = (await prof()).coins;
r = await req('bills.tick', {});
p = await prof();
check(r.ok && r.r.paid > 0 && c1 - p.coins === r.r.paid, `factures prélevées : ${r.r?.paid} PC pour une minute (loyer + crédit + charges)`);

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
