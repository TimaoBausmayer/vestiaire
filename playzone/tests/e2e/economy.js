// Économie : liquide affiché, distributeur de billets (retrait / dépôt), paiement en espèces dans une
// boutique, appli Banque (livret), horloge du jeu (jour de la semaine, 10 min = 1 h), nuit sautée en solo.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-e', name: 'Econome', createdAt: 0, coins: 5000, cash: 20, xp: 500, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);

check(/💵 20/.test(await page.locator('.chip.money').textContent()), 'liquide affiché à côté du compte');
const clock = await page.locator('.hud-zone .clock').textContent();
check(/(Lun|Mar|Mer|Jeu|Ven|Sam|Dim)\. \d\d:\d\d/.test(clock), `horloge avec jour de la semaine : ${clock}`);
// distributeur
const atm = await ev(async () => { const { ATMS } = await import('/shared/property.js'); const g = window.playzone; const a = ATMS.find((x) => x.id === 'atm-banque'); g.player.teleport(a.x + Math.sin(a.ry) * 1.1, a.z + Math.cos(a.ry) * 1.1, a.ry + Math.PI); g.cam.yaw = a.ry + 0.6; g.cam.dist = 6; g.debugStep(0.4); return g.interactions.label(); });
check(/Distributeur/.test(atm || ''), `distributeur dans la rue : ${atm}`);
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/eco-distributeur.png' });
const c0 = (await prof()).coins;
await page.keyboard.press('KeyE'); await sleep(500);
await page.getByRole('button', { name: '200 PC', exact: true }).click(); await sleep(500);
let p = await prof();
check(p.cash === 220 && p.coins === c0 - 200, `retrait de 200 PC (compte ${c0} -> ${p.coins}, liquide ${p.cash})`);
await page.screenshot({ path: 'tests/e2e/out/eco-retrait.png' });
await page.keyboard.press('Escape');
// paiement en espèces aux Fringues
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; const b = BUILDING_BY_ID.fringues; g.player.teleport(b.x, b.z, 0); g.debugStep(1.2); for (const d of g.interactions.list) { const l = typeof d.label === 'function' ? d.label() : d.label; if (/Acheter : Fringues/.test(l || '')) { g.player.teleport(d.x, d.z, 0); g.debugStep(0.3); break; } } });
await page.keyboard.press('KeyE'); await sleep(600);
await page.getByRole('button', { name: /Espèces/ }).click(); await sleep(200);
await page.locator('.card', { hasText: 'Casquette Rouge Vif' }).getByRole('button', { name: 'Acheter' }).click(); await sleep(700);
p = await prof();
check(p.cash === 160 && p.coins === c0 - 200 && p.inventory.casquette === 1, `casquette payée en espèces (liquide ${p.cash}, compte ${p.coins})`);
await page.screenshot({ path: 'tests/e2e/out/eco-especes.png' });
await page.getByRole('button', { name: /Carte/ }).click();
await page.keyboard.press('Escape');
// appli Banque : livret
await ev(() => window.playzone.phone.open('bank')); await sleep(400);
await page.getByRole('button', { name: '+1 000 au livret' }).click(); await sleep(400);
p = await prof();
check(p.savings === 1000 && p.coins === c0 - 1200, `1 000 PC placés sur le livret (${p.savings})`);
await page.screenshot({ path: 'tests/e2e/out/eco-banque.png' });
await ev(() => window.playzone.phone.close());
// nuit sautée en dormant (solo)
const before = await ev(() => { const g = window.playzone; const dn = g.world.dayNight; dn.shift = 0; const { hour } = dn; return hour; });
const res = await ev(async () => {
  const g = window.playzone, dn = g.world.dayNight;
  const { HOUR_MS } = await import('/src/world/daynight.js');
  // on se place à 23 h
  dn.shift = ((23 - dn.hour + 24) % 24) * HOUR_MS; dn.update(g.now());
  const at = dn.hour;
  g.net.request = ((orig) => async (t, pl) => (t === 'home.use' ? { needs: { faim: 50, energie: 100, humeur: 50, hygiene: 50 } } : orig(t, pl)))(g.net.request.bind(g.net));
  const { sleep: doSleep } = await import('/src/life/home-life.js');
  await doSleep(g, null);
  dn.update(g.now());
  return { at, after: dn.hour, saved: localStorage.getItem('playzone.timeShift') };
});
check(Math.round(res.at) === 23 && Math.abs(res.after - 7) < 0.05 && !!res.saved, `dormir à 23 h → réveil à 7 h (${res.after.toFixed(2)} h)`);
void before;

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
