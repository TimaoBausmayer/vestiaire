// Fonds marins : récif, poissons, plongée à la nage (air), vue sous-marine ; sous-marin loué au Centre
// de plongée jusqu'à l'épave, coffre au trésor ; spots découverts.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-p', name: 'Plongeur', createdAt: 0, coins: 5000, xp: 3000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=13&auto=solo&qualite=medium');
await page.waitForFunction(() => window.playzone?.player, null, { timeout: 90000 });
await sleep(3000);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const step = (n, dt = 0.1) => ev(([n, dt]) => { for (let i = 0; i < n; i++) window.playzone.debugStep(dt); }, [n, dt]);

// 1) à la nage au-dessus du Récif des Coraux Rieurs, puis on plonge
await ev(async () => { const { REEFS } = await import('/shared/sea.js'); const g = window.playzone, r = REEFS[0]; g.player.teleport(r.x + 8, r.z - 6, 0); g.debugStep(0.5); });
await step(10);
check(await ev(() => window.playzone.player.swimming), 'à la nage au-dessus du récif');
check(await ev(() => window.playzone.sea.fish.count) >= 70, `bancs de poissons (${await ev(() => window.playzone.sea.fish.count)})`);
await page.keyboard.down('KeyC');
await step(20);
await page.keyboard.up('KeyC');
const d = await ev(() => ({ dive: window.playzone.sea.dive, under: window.playzone.sea.under, air: window.playzone.sea.air, y: window.playzone.player.pos.y }));
check(d.dive > 0.5 && d.under, `plongée : ${d.dive.toFixed(1)} m sous la surface, vue sous-marine`);
check(d.air < 1, `réserve d'air qui baisse (${Math.round(d.air * 100)} %)`);
await ev(() => { const g = window.playzone; g.cam.yaw = g.player.yaw + Math.PI; g.debugStep(0.3); });
await sleep(1200);
await page.screenshot({ path: 'tests/e2e/out/plongee-recif.png' });
const seen = await ev(() => window.playzone.profile.sea?.seen || []);
check(seen.includes('coraux'), 'spot découvert : Récif des Coraux Rieurs');
// à bout d'air : on remonte
await ev(() => { window.playzone.sea.air = 0.001; });
await step(8);
check(await ev(() => window.playzone.sea.dive === 0), 'à bout de souffle : retour à la surface');
await step(40);

// 2) sous-marin
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone, b = BUILDING_BY_ID.plongee; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 30 && !g.interiors.loaded.has(b.id); i++) g.debugStep(0.3); });
const lbl = await ev(() => { const g = window.playzone, it = g.interiors.loaded.get('plongee'); const sp = it.inters.find((x) => /sous-marin/.test(typeof x.label === 'function' ? x.label() : x.label)); g.player.teleport(sp.x, sp.z, 0); g.debugStep(0.3); return g.interactions.label(); });
check(/sous-marin/.test(lbl || ''), 'bureau de location du sous-marin');
await page.keyboard.press('KeyE'); await sleep(500);
await page.getByText(/Louer le sous-marin/).last().click();
await sleep(1500);
check(await ev(() => !!window.playzone.submarine.s), 'sous-marin à l\'eau');
// cap sur l'épave, en profondeur
await ev(async () => { const { WRECK } = await import('/shared/sea.js'); const g = window.playzone, s = g.submarine.s; s.x = WRECK.x - 14; s.z = WRECK.z - 16; s.yaw = Math.atan2(WRECK.x - s.x, WRECK.z - s.z); });
await page.keyboard.down('KeyC'); await step(60); await page.keyboard.up('KeyC');
const sub = await ev(() => ({ y: window.playzone.submarine.s.y, under: window.playzone.sea.under }));
check(sub.y < -8 && sub.under, `au fond : ${(-0.35 - sub.y).toFixed(1)} m de profondeur`);
await ev(() => { const g = window.playzone; g.cam.yaw = g.submarine.s.yaw + Math.PI + 0.5; g.cam.pitch = 0.15; g.debugStep(0.3); });
await sleep(1200);
await page.screenshot({ path: 'tests/e2e/out/plongee-epave.png' });
// coffre au trésor
const c0 = await ev(() => window.playzone.profile.coins);
await ev(async () => { const { TREASURE } = await import('/shared/sea.js'); const s = window.playzone.submarine.s; s.x = TREASURE.x - 2; s.z = TREASURE.z; window.playzone.debugStep(0.3); });
const tl = await ev(() => window.playzone.interactions.label());
check(/trésor/.test(tl || ''), 'coffre au trésor à portée');
await page.keyboard.press('KeyE'); await sleep(800);
const c1 = await ev(() => window.playzone.profile.coins);
check(c1 > c0, `trésor : +${c1 - c0} PC`);
await ev(() => window.playzone.submarine.stop()); await sleep(600);
check(await ev(() => !window.playzone.submarine.s && !window.playzone.player.external), 'retour au Centre de plongée');

console.log(ok ? 'OK' : 'ÉCHEC');
const errs = errors.filter((e) => !/status of 404|AudioContext/.test(e));
console.log(errs.length ? errs.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
