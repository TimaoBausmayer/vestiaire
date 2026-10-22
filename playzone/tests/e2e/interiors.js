// Intérieurs visitables : on entre par la porte, vue "maison de poupée", personnel, comptoirs,
// manger, s'asseoir, panier du supermarché, concession, activités (hôpital, quiz) + captures.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, justice: { licence: { code: true, permis: true } }, id: 'solo-i', name: 'Visiteur', createdAt: 0, coins: 300000, xp: 40000, rep: 0, appearance: {}, needs: { faim: 30, energie: 30, humeur: 50, at: 0 } })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
// entrer dans un bâtiment : on se place devant la porte et on marche vers l'intérieur
async function enter(id) {
  await ev(async ([id]) => {
    const { BUILDING_BY_ID } = await import('/shared/world-layout.js');
    const g = window.playzone, b = BUILDING_BY_ID[id];
    const fx = Math.sign(b.door.x - b.x) * (Math.abs(b.door.x - b.x) > Math.abs(b.door.z - b.z) ? 1 : 0), fz = Math.sign(b.door.z - b.z) * (Math.abs(b.door.z - b.z) >= Math.abs(b.door.x - b.x) ? 1 : 0);
    g.player.teleport(b.door.x + fx * 1, b.door.z + fz * 1, Math.atan2(-fx, -fz));
    g.cam.yaw = Math.atan2(fx, fz);
    g.debugStep(0.8); // chargement de l'intérieur
    window.__dir = [-fx, -fz];
  }, [id]);
  await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(1.6)); await page.keyboard.up('KeyW');
  await ev(() => window.playzone.debugStep(1.0));
  return ev(() => ({ inside: window.playzone.interiors.inside?.id, loaded: [...window.playzone.interiors.loaded.keys()].length }));
}
const spot = (re) => ev(([re]) => { const g = window.playzone; for (const d of g.interactions.list) { const l = typeof d.label === 'function' ? d.label() : d.label; if (new RegExp(re).test(l || '')) { const x = typeof d.x === 'function' ? d.x() : d.x, z = typeof d.z === 'function' ? d.z() : d.z; g.player.teleport(x, z, g.player.yaw); g.debugStep(0.2); return l; } } return null; }, [re]);
const shot = async (name) => { await ev(() => window.playzone.debugStep(0.6)); await sleep(700); await page.screenshot({ path: `tests/e2e/out/int-${name}.png` }); };

// 1) Pizzeria : entrer, vue intérieure, commander, manger, s'asseoir
let r = await enter('pizzeria');
check(r.inside === 'pizzeria', `entré dans la pizzeria (${JSON.stringify(r)})`);
check(await ev(async () => { const { CUT } = await import('/src/core/materials.js'); return CUT.uCutB.value > 0 && CUT.uCutRoof.value === 1; }), 'toit et murs escamotés (vue maison de poupée)');
await shot('pizzeria');
const faim0 = await ev(() => window.playzone.life.status.faim);
const lab = await spot('Commander :');
check(!!lab, `comptoir trouvé : ${lab}`);
await page.keyboard.press('KeyE'); await sleep(600);
await page.screenshot({ path: 'tests/e2e/out/int-pizzeria-menu.png' });
await page.locator('.card', { hasText: 'Pizza Margherita' }).getByRole('button', { name: /Acheter et manger/ }).click();
await sleep(900);
await page.keyboard.press('Escape'); await sleep(300);
await ev(() => window.playzone.debugStep(1.2));
const faim1 = await ev(() => window.playzone.life.status.faim);
check(faim1 > faim0 + 40, `manger une pizza remplit la faim (${Math.round(faim0)} -> ${Math.round(faim1)})`);
await spot('S\'asseoir'); await page.keyboard.press('KeyE'); await ev(() => window.playzone.debugStep(0.5));
check(await ev(() => !!window.playzone.player.seated), 'assis à une table');
await shot('pizzeria-assis');
await page.keyboard.down('KeyS'); await ev(() => window.playzone.debugStep(0.3)); await page.keyboard.up('KeyS');
check(await ev(() => !window.playzone.player.seated), 'on se relève en bougeant');
// 2) Hyper Bazar : panier + caisse
r = await enter('hyper');
check(r.inside === 'hyper', 'entré à l\'Hyper Bazar');
await shot('hyper');
const coins0 = await ev(() => window.playzone.profile.coins);
await ev(() => { const g = window.playzone; g.basket.add('pomme', 3, 'supermarket'); g.basket.add('chips', 2, 'supermarket'); g.basket.add('glace-pot', 1, 'supermarket'); });
await spot('Passer en caisse'); await page.keyboard.press('KeyE'); await sleep(800);
const after = await ev(() => ({ coins: window.playzone.profile.coins, inv: window.playzone.profile.inventory }));
check(after.inv.pomme >= 3 && after.inv.chips >= 2 && coins0 - after.coins === 3 * 2 + 2 * 3 + 7, `panier payé en caisse (${coins0} -> ${after.coins} PC)`);
// 3) Concession : acheter une voiture exposée
r = await enter('concession');
check(r.inside === 'concession', 'entré à la concession');
await ev(() => window.playzone.debugStep(1));
await shot('concession');
const carLab = await spot('Fusée GT|Mammouth|Familiale|Coupé|Pomme');
check(!!carLab, `voiture exposée : ${carLab}`);
await page.keyboard.press('KeyE'); await sleep(500);
await page.getByRole('button', { name: /Acheter \(/ }).click(); await sleep(900);
const cars = await ev(() => window.playzone.profile.vehicles.map((v) => v.model));
check(cars.length > 0, `voiture achetée : ${cars.join(', ')}`);
await page.keyboard.press('Escape');
// 4) Hôpital : consultation
r = await enter('hopital');
const en0 = await ev(() => window.playzone.life.refresh().st.energie);
await spot('Consultation'); await page.keyboard.press('KeyE'); await sleep(900);
const en1 = await ev(() => window.playzone.life.refresh().st.energie);
check(en1 > en0 + 20, `consultation : énergie ${Math.round(en0)} -> ${Math.round(en1)}`);
await page.keyboard.press('Escape');
await shot('hopital');
// 5) captures d'autres intérieurs
for (const id of (process.argv[2] ? process.argv[2].split(',') : ['police', 'boulangerie', 'garage', 'maison-t3', 'arcade', 'cinema', 'cafe', 'animalerie', 'tour', 'ecole', 'fringues', 'meubles'])) {
  r = await enter(id);
  if (r.inside !== id) console.log('  (pas entré dans', id, JSON.stringify(r), ')');
  await shot(id);
}
const loaded = await ev(() => window.playzone.interiors.loaded.size);
check(loaded <= 8, `intérieurs chargés à la demande seulement (${loaded} en mémoire)`);
const info = await ev(() => { const r = window.playzone.engine.renderer; return { calls: r.info.render.calls, tris: r.info.render.triangles }; });
console.log('  rendu intérieur :', JSON.stringify(info));
console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
