// Assurance auto (formules, prime, réparation remboursée, malus, dépanneuse gratuite) et notes discrètes
// en bas de l'écran pour les infractions / la réputation.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-as', name: 'Assuré', createdAt: 0, coins: 200000, xp: 20000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=11&auto=solo&qualite=low', { timeout: 120000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID.concession; const g = window.playzone; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(1); await g.net.request('shop.buy', { itemId: 'berline' }); g.debugStep(1); });
const id = await ev(() => window.playzone.profile.vehicles[0]?.id);
check(!!id, 'berline achetée');
const r = await ev((id) => window.playzone.net.request('insurance.subscribe', { vehicleId: id, plan: 'tous' }), id);
check(r.price > 0, `tous risques souscrite : ${r.price} PC / semaine`);
// panneau du garage : bouton assurance
const txt = await ev(async () => { const { garagePanel } = await import('/src/vehicles/vehicles.js'); const d = document.createElement('div'); garagePanel(window.playzone, d); return d.textContent; });
check(/Assuré/.test(txt) && /Gratuit \(assurance\)/.test(txt), 'garage : assuré + dépanneuse gratuite');
// réparation par le mécano mobile : l'assurance paie l'essentiel
const rep = await ev((id) => window.playzone.net.request('vehicle.repairHere', { vehicleId: id, damage: 0.6 }), id);
check(rep.covered > rep.cost, `réparation : payé ${rep.cost} PC, assurance ${rep.covered} PC`);
const bonus = await ev(() => window.playzone.profile.vehicles[0].ins.bonus);
check(bonus > 1, `malus après sinistre (${Math.round(bonus * 100)} %)`);
const tow = await ev((id) => window.playzone.net.request('vehicle.deliver', { vehicleId: id }), id);
check(tow.fee === 0, 'dépanneuse gratuite');
// notes discrètes
await ev(() => { const g = window.playzone; g.ui.toast('🚨 Feu rouge grillé : la police veut t\'arrêter ! Amende de 90 PC', 'bad', 3000); g.ui.toast('+2 réputation', 'good'); });
await sleep(300);
const n = await ev(() => ({ notes: document.querySelectorAll('.notes .note').length, toasts: [...document.querySelectorAll('.toasts .toast')].filter((t) => /Feu rouge|réputation/.test(t.textContent)).length, rep: !!document.querySelector('.rep-mini') }));
check(n.notes >= 2 && n.toasts === 0, `infractions / réputation en petit en bas (${n.notes} notes)`);
check(n.rep, 'réputation : pastille discrète en bas');
await page.screenshot({ path: 'tests/e2e/out/assurance-notes.png' });
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'ASSURANCE OK' : 'ASSURANCE ÉCHEC');
process.exit(ok ? 0 : 1);
