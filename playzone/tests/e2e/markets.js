// Marchés et jeux de cour : un marché du calendrier s'installe sur la Grande Place (stands, vendeurs,
// flâneurs), négociation puis achat ; jeux de cour au parc des Tilleuls (loup, cherche, cache-cache).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-m', name: 'Chineuse', createdAt: 0, coins: 9000, cash: 800, xp: 1200, rep: 50, appearance: {} })));
await page.goto(url + 'index.html?heure=10&auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);

// 1) marché d'occasion : on se place pendant le créneau
await ev(async () => {
  const g = window.playzone; const { occurrences } = await import('/shared/calendar.js');
  const now = g.now(); const o = occurrences(now, now + 7 * 24 * 600_000).find((x) => x.id === 'marche-samedi');
  const shift = o.start + 60_000 - now; g.world.dayNight.shift = shift; localStorage.setItem('playzone.timeShift', String(shift));
  g.player.teleport(0, 12, Math.PI); g.markets.t = 0; g.debugStep(0.2); g.debugStep(2.5);
});
const stalls = await ev(() => window.playzone.markets.cur?.stalls.length || 0);
check(stalls >= 4, `marché installé : ${stalls} stands`);
await ev(() => { const g = window.playzone; g.player.teleport(6, 10, 0); g.cam.yaw = Math.PI * 0.75; g.cam.dist = 16; g.cam.pitch = 0.7; g.debugStep(1.5); });
await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/mar-marche.png' });
const label = await ev(() => { const g = window.playzone, st = g.markets.cur.stalls[0], s = st.slot; g.player.teleport(s.x + Math.sin(s.ry) * 1.6, s.z + Math.cos(s.ry) * 1.6, s.ry + Math.PI); g.debugStep(0.3); return g.interactions.label(); });
check(/Stand/.test(label || ''), `devant un stand : ${label}`);
await page.keyboard.press('KeyE'); await sleep(500);
await page.locator('select.haggle').first().selectOption('0.1'); await sleep(600);
await page.screenshot({ path: 'tests/e2e/out/mar-stand.png' });
const said = await page.locator('.vendor-say').textContent();
check(said.length > 10, `le vendeur répond : ${said.slice(0, 60)}…`);
const before = await prof();
await page.locator('.modal .list-item').first().getByRole('button', { name: 'Acheter' }).click(); await sleep(600);
const after = await prof();
const item = await ev(() => window.playzone.markets.cur.stalls[0].items[0].id);
check((after.inventory[item] || 0) === (before.inventory[item] || 0) + 1 && (after.coins < before.coins || after.cash < before.cash), `objet acheté au marché : ${item}`);
await ev(() => { for (const m of [...window.playzone.ui.stack]) m.close(); });

// 2) jeux de cour : le loup
await ev(async () => { const { PLAYGROUND: P } = await import('/shared/playground.js'); const g = window.playzone; g.player.teleport(P.x - 8, P.z - P.d / 2 - 0.2, 0); g.debugStep(0.4); });
check(/Jeux de cour/.test(await ev(() => window.playzone.interactions.label()) || ''), 'panneau des jeux de cour au parc');
await page.keyboard.press('KeyE'); await sleep(400);
await page.locator('.list-item', { hasText: 'Le loup' }).getByRole('button', { name: 'Jouer' }).click(); await sleep(600);
await ev(() => { window.playzone.cour.cur.start -= 3000; });
await sleep(1500);
await ev(() => { const g = window.playzone; g.cam.dist = 12; g.cam.pitch = 0.75; g.debugStep(0.3); });
await page.screenshot({ path: 'tests/e2e/out/mar-loup.png' });
for (let k = 0; k < 6; k++) {
  await ev(() => { const g = window.playzone, n = g.cour.cur?.npcs.find((x) => !x.out); if (!n) return; const p = n.av.root.position; g.player.teleport(p.x + 0.3, p.z, 0); g.debugStep(0.05); });
  await sleep(1700);
}
await sleep(1200);
let p = await prof();
check(p.minigames['cour-loup']?.best >= 5, `loup : ${p.minigames['cour-loup']?.best} habitants touchés`);
await page.screenshot({ path: 'tests/e2e/out/mar-loup-fin.png' });
await ev(() => { for (const m of [...window.playzone.ui.stack]) m.close(); window.playzone.cour.cleanup(); });

// 3) cache-cache : on cherche les habitants
await ev(async () => { const { PLAYGROUND: P } = await import('/shared/playground.js'); const g = window.playzone; g.player.teleport(P.x - 8, P.z - P.d / 2 - 0.2, 0); g.debugStep(0.3); });
await page.keyboard.press('KeyE'); await sleep(400);
await page.locator('.list-item', { hasText: 'cherche-les' }).getByRole('button', { name: 'Jouer' }).click(); await sleep(500);
await ev(() => { const g = window.playzone; g.cour.cur.start -= 10_000; for (let i = 0; i < 60; i++) g.cour.update(0.1); });
for (let k = 0; k < 2; k++) {
  await ev(() => { const g = window.playzone, n = g.cour.cur.npcs.find((x) => !x.out); const p = n.av.root.position; g.player.teleport(p.x + 1, p.z, 0); g.debugStep(0.2); });
  await page.keyboard.press('KeyE'); await sleep(1700);
}
check(await ev(() => window.playzone.cour.cur?.found) === 2, 'cache-cache : 2 habitants trouvés (touche E)');
await ev(() => window.playzone.cour.finish(false)); await sleep(800);
await ev(() => { for (const m of [...window.playzone.ui.stack]) m.close(); window.playzone.cour.cleanup(); });

// 4) cache-cache : le PNJ chercheur repère le joueur visible devant lui
await ev(async () => { const { PLAYGROUND: P } = await import('/shared/playground.js'); const g = window.playzone; g.player.teleport(P.x - 8, P.z - P.d / 2 - 0.2, 0); g.debugStep(0.3); });
await page.keyboard.press('KeyE'); await sleep(400);
await page.locator('.list-item', { hasText: 'cache-toi' }).getByRole('button', { name: 'Jouer' }).click(); await sleep(500);
const seen = await ev(() => { const g = window.playzone, c = g.cour.cur; c.start -= 22_000; g.cour.update(0.1); const s = c.seeker, sp = s.av.root.position; s.yaw = 0; g.player.teleport(sp.x, sp.z + 4, 0); return g.cour.sees(s, g.player.pos); });
check(seen, 'le chercheur voit un joueur à découvert devant lui');
await ev(() => { window.playzone.cour.finish(false); }); await sleep(600);

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
