// Achats en ligne (appli PlayAzon) : recherche, livraison ultra express (immédiate et chère), livraison
// en 1 jour (moins chère, colis livré à l'heure prévue), annulation, véhicule livré devant chez soi.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-a', name: 'Acheteur', createdAt: 0, coins: 60000, xp: 40000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
await page.waitForFunction(() => window.playzone?.player, null, { timeout: 90000 });
await sleep(3000);
const ev = (fn, arg) => page.evaluate(fn, arg);
const req = (type, payload) => ev(([t, p]) => window.playzone.net.request(t, p).then((r) => ({ ok: true, r }), (e) => ({ ok: false, e: e.message })), [type, payload]);
const coins = () => ev(() => window.playzone.profile.coins);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };

// 1) appli : recherche et fiche article
await ev(() => window.playzone.phone.open('achats')); await sleep(1500);
await page.locator('.phone .ph-search').fill('aile pétole'); await sleep(300);
const found = await page.locator('.phone .list-item.clickable').allTextContents();
check(found.length === 1 && /Pétole/.test(found[0]), `recherche « aile pétole » : ${found.join(' | ')}`);
await page.locator('.phone .list-item.clickable').first().click(); await sleep(500);
const opts = await page.locator('.phone .list-item').count();
check(opts === 5, `5 modes de livraison proposés (${opts})`);
await page.screenshot({ path: 'tests/e2e/out/achats-fiche.png' });
// 2) ultra express : livré tout de suite, frais élevés
const fees = await ev(async () => { const { deliveryFee } = await import('/shared/online-shop.js'); return { ex: deliveryFee(2500, 'express'), j1: deliveryFee(2500, 'j1'), j2: deliveryFee(2500, 'j2'), eco: deliveryFee(2500, 'eco') }; });
check(fees.ex > fees.j1 && fees.j1 > fees.j2 && fees.j2 > fees.eco, `plus c'est rapide, plus c'est cher : ${fees.ex} > ${fees.j1} > ${fees.j2} > ${fees.eco} PC`);
const c0 = await coins();
await page.locator('.phone .list-item', { hasText: 'Ultra express' }).getByRole('button', { name: 'Commander' }).click(); await sleep(800);
const c1 = await coins();
check(await ev(() => window.playzone.profile.inventory['aile-7']) === 1 && c0 - c1 === 2500 + fees.ex, `ultra express : aile reçue tout de suite (${c0 - c1} PC)`);
// 3) livraison en 1 jour : colis en route, livré quand l'heure arrive
const o = await req('online.order', { itemId: 'canape-cuir', delivery: 'j1' });
check(o.ok && !o.r.delivered && (await ev(() => window.playzone.profile.orders.length)) === 1, 'canapé commandé en 1 jour : colis en route');
check(!(await ev(() => window.playzone.profile.inventory['canape-cuir'])), 'pas encore livré');
await ev(() => window.playzone.phone.render()); await sleep(600);
await page.screenshot({ path: 'tests/e2e/out/achats-colis.png' });
// le temps passe (un jour de jeu) : le colis arrive tout seul
await ev(async () => { const { CYCLE_MS } = await import('/shared/clock.js'); const g = window.playzone; g.world.dayNight.shift = (g.world.dayNight.shift || 0) + CYCLE_MS + 60_000; localStorage.setItem('playzone.timeShift', String(g.world.dayNight.shift)); });
await ev(() => window.playzone.debugStep(6));
await page.waitForFunction(() => (window.playzone.profile.inventory['canape-cuir'] || 0) === 1, null, { timeout: 20000 }).catch(() => {});
check(await ev(() => window.playzone.profile.inventory['canape-cuir']) === 1 && !(await ev(() => window.playzone.profile.orders.length)), 'un jour plus tard : canapé livré dans le sac');
// 4) annulation : article remboursé, pas la livraison
const o2 = await req('online.order', { itemId: 'billard', delivery: 'j2' });
const c2 = await coins();
const cancel = await req('online.cancel', { orderId: o2.r.order.id });
check(cancel.ok && (await coins()) - c2 === 4500, `commande annulée : ${cancel.r?.refund} PC remboursés`);
// 5) véhicule livré devant chez soi (ou devant le concessionnaire sans logement)
const car = await req('online.order', { itemId: 'citadine', delivery: 'express' });
check(car.ok && (await ev(() => window.playzone.profile.vehicles.some((v) => v.model === 'citadine' && v.park))), 'citadine livrée et garée');

console.log(ok ? 'OK' : 'ÉCHEC');
const errs = errors.filter((e) => !/status of 404|AudioContext/.test(e));
console.log(errs.length ? errs.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
