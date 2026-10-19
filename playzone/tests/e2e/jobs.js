// Étape 5 : les 3 métiers joués de bout en bout.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const which = process.argv[2] || 'all';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-t', name: 'Testeur', createdAt: 0, coins: 500, xp: 0, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo');
await sleep(5000);
const ev = (fn, arg) => page.evaluate(fn, arg);
const tp = (x, z, y) => ev(([x, z, y]) => { const g = window.playzone; g.player.teleport(x, z, 0, y); g.debugStep(0.1); }, [x, z, y]);
const coins = () => ev(() => window.playzone.profile.coins);
let ok = true;

async function startMission(x, z, name) {
  await tp(x, z);
  await page.keyboard.press('KeyE');
  await sleep(600);
  await page.locator('.card', { hasText: name }).getByRole('button', { name: 'Commencer' }).click();
  await sleep(600);
}

if (which === 'all' || which === 'livreur') {
  const c0 = await coins();
  await startMission(36.5, -18, 'Colis standard');
  await page.screenshot({ path: 'tests/e2e/out/s5-livreur-start.png' });
  await tp(36.5, -18);
  await page.keyboard.press('KeyE'); await sleep(500);
  const stop = await ev(() => window.playzone.jobs.active.m.stops[0]);
  await tp(stop.x, stop.z);
  await ev(() => { const g = window.playzone; g.cam.yaw = 0.6; g.cam.dist = 7; });
  await sleep(500);
  await page.screenshot({ path: 'tests/e2e/out/s5-livreur-porte.png' });
  await page.keyboard.press('KeyE'); await sleep(800);
  const c1 = await coins();
  console.log(`LIVREUR : livré à ${stop.name}, PC ${c0} -> ${c1}`);
  ok = ok && c1 > c0;
}

if (which === 'all' || which === 'pompier') {
  const c0 = await coins();
  await startMission(20, -34.5, 'Poubelle en feu');
  const f = await ev(() => window.playzone.jobs.active.m.fires[0]);
  await tp(f.x + 5, f.z + 3);
  await ev(() => { const g = window.playzone; g.cam.yaw = 0.9; g.cam.dist = 9; });
  await page.keyboard.down('KeyF');
  await sleep(900);
  await page.screenshot({ path: 'tests/e2e/out/s5-pompier.png' });
  let done = false;
  // on avance la simulation à pas fixe (indépendant de la vitesse du rendu logiciel)
  for (let i = 0; i < 30 && !done; i++) { done = await ev(() => { const g = window.playzone; g.debugStep(0.5); return !g.jobs.active; }); }
  await page.keyboard.up('KeyF');
  const c1 = await coins();
  console.log(`POMPIER : feu « ${f.name} » éteint = ${done}, PC ${c0} -> ${c1}`);
  ok = ok && done && c1 > c0;
  // chat dans l'arbre
  const c2 = await coins();
  await startMission(20, -34.5, 'Chat coincé');
  const tree = await ev(() => window.playzone.jobs.active.m.tree);
  await tp(tree.x + 1.5, tree.z);
  await ev(() => { const g = window.playzone; g.cam.yaw = 1.2; g.cam.dist = 8; g.cam.pitch = 0.2; });
  await sleep(600);
  await page.screenshot({ path: 'tests/e2e/out/s5-chat.png' });
  await page.keyboard.press('KeyE');
  await sleep(4000);
  const c3 = await coins();
  console.log(`POMPIER : chat sauvé, PC ${c2} -> ${c3}`);
  ok = ok && c3 > c2;
}

if (which === 'all' || which === 'cuisinier') {
  const c0 = await coins();
  await startMission(-11.2, 13, 'Service du midi');
  await sleep(1500);
  await page.screenshot({ path: 'tests/e2e/out/s5-cuisinier.png' });
  const KEYS = ['pain-bas', 'pain-haut', 'steak', 'fromage', 'salade', 'tomate', 'oignon', 'cornichon', 'confiture', 'chamallow'];
  for (let o = 0; o < 3; o++) {
    const recipe = await ev(() => { const a = window.playzone.jobs.active; return a ? a.order.recipe : null; });
    if (!recipe) break;
    // 2e commande volontairement ratée pour vérifier le refus
    const toType = o === 1 ? ['pain-bas', 'pain-haut'] : recipe;
    for (const k of toType) { const i = KEYS.indexOf(k); await page.keyboard.press(`Digit${(i + 1) % 10}`); await sleep(120); }
    if (o === 0) await page.screenshot({ path: 'tests/e2e/out/s5-cuisinier-burger.png' });
    await page.keyboard.press('Enter');
    await sleep(1400);
  }
  await sleep(800);
  const c1 = await coins();
  const toasts = await page.locator('.toast').allTextContents();
  console.log(`CUISINIER : PC ${c0} -> ${c1} ·`, toasts.filter((t) => /parfaites|Cuisinier/.test(t)).join(' | '));
  ok = ok && c1 > c0;
}
console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
