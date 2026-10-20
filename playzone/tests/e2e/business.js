// Business : créer son entreprise à la mairie (marque de vêtements), la gérer depuis l'appli Business,
// créer et porter un modèle, la voir rapporter pendant qu'on joue, bourse (achat / revente, actualités).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-b', name: 'Patronne', createdAt: 0, coins: 80000, xp: 5000, rep: 10, appearance: {} })));
await page.goto(url + 'index.html?heure=11&auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);

// 1) mairie : registre du commerce
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; const b = BUILDING_BY_ID.mairie; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has('mairie'); i++) g.debugStep(0.3); const it = g.interiors.loaded.get('mairie'); const d = it.inters.find((x) => /Registre/.test(x.label)); g.player.teleport(d.x, d.z, 0); g.debugStep(0.3); });
check(/Registre du commerce/.test(await ev(() => window.playzone.interactions.label()) || ''), 'registre du commerce à la mairie');
await page.keyboard.press('KeyE'); await sleep(500);
await page.getByPlaceholder('Nom de l\'entreprise').fill('Moustache Wear');
await page.getByRole('button', { name: /Marque de vêtements/ }).click(); await sleep(200);
await page.getByRole('button', { name: '10 000 PC' }).click(); await sleep(200);
await page.screenshot({ path: 'tests/e2e/out/biz-creation.png' });
await page.getByRole('button', { name: /^Créer \(/ }).click(); await sleep(700);
let p = await prof();
check(p.company?.name === 'Moustache Wear' && p.company.sector === 'mode', 'entreprise créée : Moustache Wear (marque de vêtements)');
// 2) appli Business : embaucher, publicité, nouveau modèle, le porter
await ev(() => window.playzone.phone.open('business')); await sleep(400);
await page.getByRole('button', { name: '+ Embaucher' }).click(); await sleep(400);
await page.locator('.list-item', { hasText: 'Publicité' }).getByRole('button', { name: '3', exact: true }).click(); await sleep(400);
await page.getByPlaceholder('Nom du modèle').fill('Sweat Royal');
await page.getByRole('button', { name: 'Sweat', exact: true }).click();
await page.getByRole('button', { name: /^Créer \(800/ }).click(); await sleep(500);
p = await prof();
check(p.company.staff === 2 && p.company.marketing === 3 && p.company.collections.length === 1, `gestion : ${p.company.staff} employés, pub ${p.company.marketing}, ${p.company.collections.length} modèle`);
await page.getByRole('button', { name: 'Porter' }).first().click(); await sleep(500);
p = await prof();
check(p.appearance.top === 'sweat' && p.brandWorn?.brand === 'Moustache Wear', 'on porte son propre modèle');
await page.screenshot({ path: 'tests/e2e/out/biz-entreprise.png' });
// 3) l'entreprise tourne pendant qu'on joue (30 minutes simulées)
const cash0 = p.company.cash;
await ev(async () => { const g = window.playzone; const t0 = Date.now(); const real = Date.now; let fake = t0; Date.now = () => fake; try { for (let i = 1; i <= 30; i++) { fake = t0 + i * 60_000; await g.net.request('bills.tick', {}); } } finally { Date.now = real; } });
p = await prof();
check(p.company.history.length >= 2 && p.company.cash !== cash0, `l'entreprise a tourné : trésorerie ${Math.round(cash0)} -> ${Math.round(p.company.cash)} PC`);
// 4) bourse
await page.getByRole('button', { name: 'Bourse' }).click(); await sleep(400);
const c0 = (await prof()).coins;
await page.locator('.list-item', { hasText: 'PlayCorp' }).getByRole('button', { name: '+10', exact: true }).click(); await sleep(500);
p = await prof();
check(p.stocks?.PLAY?.n === 10 && p.coins < c0, `10 actions PlayCorp achetées (-${c0 - p.coins} PC)`);
check(await page.locator('text=Actualité de la bourse').count() === 1, 'actualité de la bourse affichée');
await page.screenshot({ path: 'tests/e2e/out/biz-bourse.png' });
await page.locator('.list-item', { hasText: 'PlayCorp' }).getByRole('button', { name: 'Tout vendre' }).click(); await sleep(500);
check(!(await prof()).stocks?.PLAY, 'actions revendues');
await page.getByRole('button', { name: 'Investir' }).click(); await sleep(300);
check(/En ligne, tu peux investir/.test(await page.locator('.phone-screen').textContent()), 'investir dans les entreprises des joueurs : expliqué (en ligne)');

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
