// Étages des immeubles : ascenseur du hall → palier (portes, voisins, vue), toit-terrasse, retour au hall ;
// nouveaux petits quartiers (maisons, immeubles, commerces).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-e', name: 'Voisin', createdAt: 0, coins: 5000, xp: 3000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=17&auto=solo&qualite=medium');
await page.waitForFunction(() => window.playzone?.player, null, { timeout: 90000 });
await sleep(3000);
await page.addStyleTag({ content: '.modal, .phone { animation: none !important; }' });
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };

// 0) nouveaux quartiers
const q = await ev(async () => { const { BUILDINGS } = await import('/shared/world-layout.js'); const n = (p) => BUILDINGS.filter((b) => b.id.startsWith(p)).length; return { m: n('q-maison'), i: n('q-immeuble'), s: n('q-shop') }; });
check(q.m >= 60 && q.i >= 20 && q.s >= 12, `petits quartiers : ${q.m} maisons, ${q.i} immeubles, ${q.s} commerces`);
// 1) hall de la Résidence des Tilleuls A → ascenseur
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone, b = BUILDING_BY_ID.immeuble1; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 30 && !g.interiors.loaded.has(b.id); i++) g.debugStep(0.3); const it = g.interiors.loaded.get(b.id); const sp = it.inters.find((x) => /ascenseur/i.test(typeof x.label === 'function' ? x.label() : x.label)); g.player.teleport(sp.x, sp.z, 0); g.debugStep(0.3); });
check(/ascenseur/i.test(await ev(() => window.playzone.interactions.label()) || ''), 'ascenseur dans le hall');
await page.keyboard.press('KeyE'); await sleep(500);
check(await page.locator('.lift-btn').count() >= 7, `tableau de l'ascenseur (${await page.locator('.lift-btn').count()} boutons)`);
await page.screenshot({ path: 'tests/e2e/out/etages-ascenseur.png' });
await page.locator('.lift-btn', { hasText: /^3$/ }).click();
await sleep(1200);
const at = await ev(() => ({ zone: window.playzone.player.zone, n: window.playzone.floors.at?.n }));
check(at.zone === 'home-etage' && at.n === 3, 'palier du 3e étage');
await ev(() => { const g = window.playzone; g.cam.yaw = 0.3; g.cam.pitch = 0.8; g.cam.dist = 10; for (let i = 0; i < 6; i++) g.debugStep(0.1); });
await sleep(800);
await page.screenshot({ path: 'tests/e2e/out/etages-palier.png' });
// sonner chez les voisins (jusqu'à ce que quelqu'un ouvre)
let opened = false;
for (const d of await ev(() => window.playzone.floors.inters.slice(1).map((x) => [x.x, x.z]))) {
  await ev(([x, z]) => { const g = window.playzone; g.player.teleport(x, z, 0, 0.02); g.debugStep(0.2); g.interactions.trigger(); }, d);
  await sleep(300);
  if (await page.locator('.dialog-box').count()) { opened = true; break; }
}
check(opened, 'un voisin ouvre la porte');
if (opened) { await page.getByText('⌨️ Discuter').click(); await page.locator('.dlg-input').fill('Bonjour, ça va ?'); await page.locator('.dlg-input').press('Enter'); await sleep(300); check(/Et toi|Bonjour|Salut|Coucou/.test(await page.locator('.dialog-box p').textContent()), 'discussion libre avec le voisin'); await page.getByText('Au revoir').last().click(); }
// 2) toit-terrasse
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); window.playzone.floors.panel(BUILDING_BY_ID.immeuble1); });
await sleep(400);
await page.locator('.lift-btn.roof').click();
await sleep(1200);
const roof = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone, b = BUILDING_BY_ID.immeuble1; for (let i = 0; i < 20; i++) g.debugStep(0.1); return { y: g.player.pos.y, h: b.h, zone: g.player.zone, inside: !!g.interiors.inside, label: g.interactions.label() }; });
check(Math.abs(roof.y - roof.h) < 0.8 && roof.zone === 'world' && !roof.inside, `sur le toit (${roof.y.toFixed(1)} m), on ne tombe pas`);
check(/redescendre/.test(roof.label || ''), 'ascenseur du toit');
await ev(() => { const g = window.playzone; g.cam.yaw = 2.3; g.cam.pitch = 0.3; g.cam.dist = 12; g.debugStep(0.3); });
await sleep(900);
await page.screenshot({ path: 'tests/e2e/out/etages-toit.png' });
// marcher vers le bord : le garde-corps retient
await ev(() => { const g = window.playzone; for (let i = 0; i < 40; i++) { g.player.vel.x = 6; g.debugStep(0.05); } });
check(await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); return window.playzone.player.pos.y > BUILDING_BY_ID.immeuble1.h - 1; }), 'le garde-corps empêche de tomber');
// 3) retour au hall
await page.keyboard.press('KeyE').catch(() => {});
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); window.playzone.floors.ground(BUILDING_BY_ID.immeuble1); });
await sleep(1000);
check(await ev(() => window.playzone.player.pos.y < 2 && window.playzone.player.zone === 'world'), 'retour au rez-de-chaussée');

console.log(ok ? 'OK' : 'ÉCHEC');
const errs = errors.filter((e) => !/status of 404|AudioContext/.test(e));
console.log(errs.length ? errs.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
