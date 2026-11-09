// Boîte de nuit : beaucoup de fêtardes, drague, carré VIP + service bouteilles (sans alcool) qui
// fait venir les filles à la table et les fait craquer, jusqu'à se mettre en couple.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-bo', name: 'Noctambule', createdAt: 0, coins: 20000, xp: 20000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=23&auto=solo&qualite=high', { timeout: 120000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const n = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['club-1'], g = window.playzone; g.player.teleport(b.x, b.z, 0); g.debugStep(2); const it = g.interiors.loaded.get(b.id); return it ? it.people.filter((p) => p.role === 'fetarde').length : -1; });
check(n >= 10, `beaucoup de fêtardes dans la boîte (${n})`);
await page.screenshot({ path: 'tests/e2e/out/boite-piste.png' });
// sans carré VIP : pas de bouteille
const noVip = await ev(() => window.playzone.net.request('club.bottle', { size: 'bulles', girls: [] }).then(() => false).catch(() => true));
check(noVip, 'bouteilles réservées au carré VIP');
const vip = await ev(() => window.playzone.net.request('club.do', { kind: 'vip' }));
check(vip.until > 0, 'carré VIP réservé (10 min)');
// service bouteilles (Jéroboam : 4 filles)
const r = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['club-1'], g = window.playzone; const it = g.interiors.loaded.get(b.id); const girls = it.people.filter((p) => p.role === 'fetarde').slice(0, 4).map((p) => `club:${b.id}:${p.name}`); return g.net.request('club.bottle', { size: 'jeroboam', girls }); });
check(Object.keys(r.affs).length === 4 && Object.values(r.affs).every((a) => a >= 25), `Jéroboam : 4 filles à la table, affection ${Object.values(r.affs).join(' / ')}`);
// l'UI : spot du service bouteilles et dialogue des filles
await ev(async () => { const { runAction } = await import('/src/interiors/actions.js'); const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); runAction(window.playzone, 'clubbottle', { b: BUILDING_BY_ID['club-1'] }); });
await sleep(400);
check(await ev(() => /Service bouteilles/.test(document.querySelector('.modal')?.textContent || '')), 'menu du service bouteilles');
await page.screenshot({ path: 'tests/e2e/out/boite-bouteilles.png' });
await ev(() => document.querySelector('.modal .close-x')?.click());
// drague jusqu'au couple (bouteilles répétées, cooldown ignoré en admin)
await ev(() => window.playzone.net.request('admin.unlock', { code: 'Timao3049Bausmayer' }));
const couple = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['club-1'], g = window.playzone; const it = g.interiors.loaded.get(b.id); const p = it.people.find((q) => q.role === 'fetarde'); const id = `club:${b.id}:${p.name}`; for (let k = 0; k < 3; k++) await g.net.request('club.bottle', { size: 'jeroboam', girls: [id] }); return g.net.request('love.ask', { id, name: p.name, role: 'Fêtarde' }); });
check(couple.yes, `elle est tombée amoureuse : en couple avec ${couple.partner?.name}`);
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'BOITE OK' : 'BOITE ÉCHEC');
process.exit(ok ? 0 : 1);
