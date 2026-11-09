// Téléphones : rayon chez MégaTech avec aperçu 3D, achat d'un modèle et d'une couleur, apparence du
// téléphone à l'écran (cadre, île / poinçon, brique rétro), photos de meilleure qualité.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-ph', name: 'Geek', createdAt: 0, coins: 40000, xp: 20000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=11&auto=solo&qualite=low', { timeout: 120000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID.hightech; const g = window.playzone; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(1); const { openPhoneStore } = await import('/src/ui/phone-store.js'); window.__st = openPhoneStore(g, b); });
await sleep(800);
check(await ev(() => !!document.querySelector('.ph-preview') && document.querySelectorAll('.ph-list .list-item').length >= 7), 'rayon téléphones : 7 modèles et aperçu 3D');
// choisir le Pro Max titane bleu
await page.locator('.ph-list .list-item', { hasText: 'Pro Max' }).click();
await sleep(300);
await page.locator('.ph-info button.opt', { hasText: 'titane bleu' }).click();
await sleep(700);
await page.screenshot({ path: 'tests/e2e/out/telephones-rayon.png' });
const c0 = await ev(() => window.playzone.profile.coins);
await page.locator('.ph-info button.btn', { hasText: 'Acheter' }).click();
await sleep(600);
const p = await ev(() => ({ ph: window.playzone.profile.phone, coins: window.playzone.profile.coins }));
check(p.ph?.model === 'pro' && p.ph.color === 'titane bleu' && c0 - p.coins === 12000, `PlayPhone 15 Pro Max titane bleu acheté (${c0 - p.coins} PC)`);
await ev(() => window.__st.close());
// téléphone à l'écran : cadre et île
await ev(() => window.playzone.phone.open());
await sleep(500);
const st = await ev(() => { const el = document.querySelector('.phone'); return { frame: el.style.getPropertyValue('--ph-frame'), screen: el.dataset.screen, w: el.style.width }; });
check(st.frame === '#3d5a80' && st.screen === 'island', `apparence : cadre ${st.frame}, écran ${st.screen}`);
await page.screenshot({ path: 'tests/e2e/out/telephones-pro.png' });
await ev(() => window.playzone.phone.close());
// la brique rétro
await ev(async () => { const g = window.playzone; await g.net.request('phone.buy', { model: 'brique', color: 'jaune' }); g.phone.open(); });
await sleep(1500);
check(await ev(() => document.querySelector('.phone').classList.contains('retro')), 'Nokio 3310 : écran rétro');
await page.screenshot({ path: 'tests/e2e/out/telephones-brique.png' });
await ev(() => window.playzone.phone.close());
// on reprend le Pro (déjà possédé : gratuit)
const re = await ev(() => window.playzone.net.request('phone.equip', { model: 'pro', color: 'titane noir' }));
check(re.model === 'pro', 'changer de téléphone parmi ceux qu\'on possède');
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'TELEPHONES OK' : 'TELEPHONES ÉCHEC');
process.exit(ok ? 0 : 1);
