// Corps et santé : barre de santé, chute → blessure → soins à l'hôpital, pompes au clavier, machine de
// la salle de sport (tourne seule), coiffeur, chaussures de luxe, torse nu musclé, appli Santé.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-s', name: 'Musclor', createdAt: 0, coins: 20000, xp: 3000, rep: 0, appearance: {}, inventory: { 'baskets-luxe': 1 }, body: { muscle: 70, weight: 74 } })));
await page.goto(url + 'index.html?heure=11&auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const inside = (id) => ev(async ([id]) => { const { BUILDING_BY_ID, BUILDINGS } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID[id] || BUILDINGS.find((x) => x.interior === id); const g = window.playzone; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has(b.id); i++) g.debugStep(0.3); g.debugStep(0.3); return b.id; }, [id]);
const spotIn = (bid, re) => ev(([bid, re]) => { const g = window.playzone; const it = g.interiors.loaded.get(bid); for (const d of it.inters) { const l = typeof d.label === 'function' ? d.label() : d.label; if (new RegExp(re).test(l)) { g.player.teleport(d.x, d.z, g.player.yaw); g.debugStep(0.25); return l; } } return null; }, [bid, re]);

check(await ev(() => !!document.querySelector('.needs .need.sante')), 'barre de santé ❤️ dans les jauges');
// 1) chute de 12 m → fracture
await ev(() => { const g = window.playzone; g.player.teleport(30, 60, 0); g.debugStep(0.5); g.player.teleportedAt = 0; g.player.pos.y += 12; g.player.grounded = false; g.player.vel.y = 0; });
await ev(() => window.playzone.debugStep(2.5));
await sleep(500);
let p = await prof();
check(p.body.injury?.kind === 'fracture' && p.body.health < 80, `chute de 12 m : ${p.body.injury?.kind}, santé ${Math.round(p.body.health)}`);
check(await ev(() => window.playzone.player.bodyNoJump === true), 'fracture : impossible de sauter');
await page.screenshot({ path: 'tests/e2e/out/body-fracture.png' });
// 2) soins à l'hôpital
const hosp = await inside('hopital');
await spotIn(hosp, 'Urgences'); await page.keyboard.press('KeyE'); await sleep(400);
await page.getByRole('button', { name: /Me soigner/ }).click(); await sleep(600);
p = await prof();
check(!p.body.injury && p.body.health === 100, 'soigné·e aux urgences');
await page.locator('.dialog-box button').first().click();
// 3) salle de sport : abonnement, banc de musculation qui tourne seul, pompes
const gym = await inside('gym');
await spotIn(gym, 'Accueil'); await page.keyboard.press('KeyE'); await sleep(400);
await page.locator('.list-item', { hasText: 'Pass journée' }).getByRole('button').click(); await sleep(500);
await page.keyboard.press('Escape');
check((await prof()).body.gymUntil > Date.now(), 'pass journée acheté');
await spotIn(gym, 'Banc de musculation'); await page.keyboard.press('KeyE'); await sleep(600);
check(await ev(() => !!window.playzone.body.machine && !!window.playzone.player.seated), 'machine lancée (le personnage s\'entraîne seul)');
await ev(() => { const g = window.playzone; g.cam.dist = 6; g.cam.pitch = 0.6; g.debugStep(0.5); });
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/body-banc.png' });
const m0 = (await prof()).body.muscle;
await ev(() => { const g = window.playzone; g.body.machine.at -= 4 * 60_000; }); // 4 minutes plus tard
await ev(async () => { const g = window.playzone; const real = Date.now; const t = real(); Date.now = () => t + 4 * 60_000; try { await g.body.stopMachine(); } finally { Date.now = real; } });
await sleep(400);
check((await prof()).body.muscle > m0 + 0.5, 'muscles gagnés sur le banc');
await spotIn(gym, 'pompes'); await page.keyboard.press('KeyE'); await sleep(300);
const need = await ev(async () => { const { tapsPerPushup } = await import('/shared/body.js'); return tapsPerPushup(window.playzone.profile.body.muscle); });
for (let i = 0; i < need * 5; i++) { await page.keyboard.press('Space'); await sleep(140); }
await page.screenshot({ path: 'tests/e2e/out/body-pompes.png' });
await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(0.3)); await page.keyboard.up('KeyW');
await sleep(700);
check(((await prof()).stats.pushups || 0) >= 4, `pompes au clavier (${need} appuis par pompe) : ${(await prof()).stats.pushups}`);
// 4) coiffeur
await inside('coiffeur');
await spotIn('coiffeur', 'Coiffeur'); await page.keyboard.press('KeyE'); await sleep(400);
await page.getByRole('button', { name: 'Afro', exact: true }).click(); await sleep(200);
await page.getByRole('button', { name: /Valider/ }).click(); await sleep(600);
check((await prof()).appearance.hair === 'afro', 'nouvelle coupe chez le coiffeur');
// 5) baskets de luxe et torse nu musclé
await ev(() => window.playzone.net.request('avatar.update', { appearance: { ...window.playzone.profile.appearance, feet: 'baskets-luxe' } }));
await ev(() => window.playzone.net.request('body.shirt', { off: true }));
await ev(() => { const g = window.playzone; g.player.teleport(-40, -190, Math.PI); g.cam.yaw = 0; g.cam.dist = 3.6; g.cam.pitch = 0.15; g.debugStep(0.6); });
await sleep(600);
await page.screenshot({ path: 'tests/e2e/out/body-torse.png' });
p = await prof();
check(p.appearance.feet === 'baskets-luxe' && p.body.shirtless, 'baskets de luxe et torse nu');
// 6) appli Santé
await ev(() => window.playzone.phone.open('health')); await sleep(400);
const txt = await page.locator('.phone-screen').textContent();
check(/Attirance/.test(txt) && /Muscles/.test(txt) && /Âge/.test(txt), 'appli Santé : poids, muscles, âge, attirance');
await page.screenshot({ path: 'tests/e2e/out/body-appli.png' });

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
