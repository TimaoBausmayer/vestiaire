// Vie quotidienne : cuisiner chez soi (mini-jeu de cuisson), se doucher, dormir dans son lit, propreté,
// commander à table au restaurant et manger assis, douche de la salle de sport.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({
  v: 1, id: 'solo-l', name: 'Cuistot', createdAt: 0, coins: 50000, xp: 3000, rep: 0, appearance: {},
  inventory: { oeufs: 3, legumes: 2, cuisiniere: 1, douche: 1, lit: 1 },
  properties: [{ id: 'maison-t3', how: 'rent', since: 0 }],
  home: { size: 'studio', place: 'maison-t3', furniture: [{ i: 'cuisiniere', x: 2.5, z: -3, r: 0 }, { i: 'douche', x: -3.4, z: -3.4, r: 0 }, { i: 'lit', x: -2.5, z: 1.5, r: 0 }] },
  needs: { faim: 15, energie: 12, humeur: 40, hygiene: 8, at: 0 },
})));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const inside = (id) => ev(async ([id]) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID[id]; const g = window.playzone; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has(id); i++) g.debugStep(0.3); g.debugStep(0.3); }, [id]);
const spotIn = (bid, re) => ev(([bid, re]) => { const g = window.playzone; const it = g.interiors.loaded.get(bid); for (const d of it.inters) { const l = typeof d.label === 'function' ? d.label() : d.label; if (new RegExp(re).test(l)) { g.player.teleport(d.x, d.z, g.player.yaw); g.debugStep(0.25); return l; } } return null; }, [bid, re]);
const needs = () => ev(() => { const g = window.playzone; g.life.refresh(); return g.life.status; });
const shot = async (name) => { await ev(() => window.playzone.debugStep(0.4)); await sleep(600); await page.screenshot({ path: `tests/e2e/out/life-${name}.png` }); };

check(await ev(() => document.querySelectorAll('.needs .need').length === 4), '4 jauges : faim, énergie, humeur, propreté');
await inside('maison-t3');
const n0 = await needs();
check(n0.hygiene < 20, `propreté basse au départ (${Math.round(n0.hygiene)})`);
await ev(() => window.playzone.debugStep(1.5));
await shot('mouches');
// 1) cuisiner une omelette (mini-jeu de cuisson)
check(!!await spotIn('maison-t3', 'Cuisiner'), 'cuisinière utilisable');
await page.keyboard.press('KeyE'); await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/life-recettes.png' });
await page.locator('.list-item', { hasText: 'Omelette aux légumes' }).getByRole('button', { name: 'Cuisiner' }).click();
await sleep(300);
check(await ev(() => !!document.querySelector('.cook-game')), 'mini-jeu de cuisson affiché');
await page.screenshot({ path: 'tests/e2e/out/life-cuisson.png' });
// on attend que l'aiguille passe au milieu
for (let i = 0; i < 200; i++) { const x = await ev(() => parseFloat(document.querySelector('.cook-needle')?.style.left || '0')); if (x > 42 && x < 58) break; await sleep(15); }
await page.keyboard.press('KeyE'); await sleep(1200);
const n1 = await needs();
const inv1 = await ev(() => window.playzone.profile.inventory);
check(n1.faim > n0.faim + 30 && inv1.oeufs === 2 && inv1.legumes === 1, `omelette mangée : faim ${Math.round(n0.faim)} -> ${Math.round(n1.faim)}, ingrédients consommés`);
await shot('omelette');
// 2) douche
await sleep(300);
check(!!await spotIn('maison-t3', 'douche'), 'douche utilisable');
await page.keyboard.press('KeyE'); await ev(() => window.playzone.debugStep(0.6)); await sleep(500);
const n2 = await needs();
check(n2.hygiene > 95, `tout propre (${Math.round(n2.hygiene)})`);
await shot('douche');
// 3) dormir
check(!!await spotIn('maison-t3', 'Dormir'), 'lit utilisable');
await page.keyboard.press('KeyE'); await sleep(700);
const n3 = await needs();
check(n3.energie > n2.energie + 50 && await ev(() => !!window.playzone.player.seated?.lie), `on dort dans son lit (énergie ${Math.round(n2.energie)} -> ${Math.round(n3.energie)})`);
await shot('dodo');
await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(0.3)); await page.keyboard.up('KeyW');
// 4) restaurant : s'asseoir, commander à table, manger assis
await inside('pizzeria');
await spotIn('pizzeria', 'asseoir'); await page.keyboard.press('KeyE'); await ev(() => window.playzone.debugStep(0.3));
const lab = await ev(() => { const g = window.playzone; g.debugStep(0.1); return g.interactions.label(); });
check(/Commander à table/.test(lab || ''), `assis : ${lab}`);
await page.keyboard.press('KeyE'); await sleep(600);
await page.locator('.card', { hasText: 'Pizza Margherita' }).getByRole('button', { name: /Acheter et manger/ }).click();
await sleep(700);
await page.keyboard.press('Escape'); await sleep(200);
check(await ev(() => { const g = window.playzone; return !!g.player.seated && g.player.pose === 'eat'; }), 'on mange assis à table');
await ev(() => { const g = window.playzone; g.cam.dist = 5; g.cam.pitch = 0.5; });
await shot('resto-assis');
// 5) douche des vestiaires à la salle de sport
await ev(() => { const g = window.playzone; g.profile.needs.hygiene = 5; g.profile.needs.at = Date.now(); });
const gym = await ev(async () => { const { BUILDINGS } = await import('/shared/world-layout.js'); return BUILDINGS.find((b) => b.interior === 'gym')?.id; });
await inside(gym);
check(!!await spotIn(gym, 'Douche des vestiaires'), 'douche des vestiaires');
await page.keyboard.press('KeyE'); await sleep(700);
check((await needs()).hygiene > 95, 'propre après la douche de la salle de sport');

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
