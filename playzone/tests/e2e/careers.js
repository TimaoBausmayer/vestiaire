// Carrières : offres d'emploi dans un bâtiment, embauche, pointage, tâche de service (balise), paie au
// temps passé, augmentation refusée (trop tôt), école : formation chronométrée + examen, poste qualifié.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-w', name: 'Bosseur', createdAt: 0, coins: 8000, xp: 900, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=10&auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const inside = (id) => ev(async ([id]) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID[id]; const g = window.playzone; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has(id); i++) g.debugStep(0.3); g.debugStep(0.3); }, [id]);
const spotIn = (bid, re) => ev(([bid, re]) => { const g = window.playzone; const it = g.interiors.loaded.get(bid); for (const d of it.inters) { const l = typeof d.label === 'function' ? d.label() : d.label; if (new RegExp(re).test(l)) { g.player.teleport(d.x, d.z, g.player.yaw); g.debugStep(0.25); return l; } } return null; }, [bid, re]);
const prof = () => ev(() => window.playzone.profile);
// le temps passe : positions validées pendant `ms` (simulation à pas fixe)
const work = (ms) => ev(([ms]) => { const g = window.playzone; const t0 = Date.now(); const real = Date.now; let fake = t0; Date.now = () => fake; try { for (let t = 0; t < ms; t += 1000) { fake = t0 + t; g.net.sendState({ x: g.player.pos.x, y: g.player.pos.y, z: g.player.pos.z }, 'world'); } } finally { Date.now = real; } }, [ms]);

// 1) caissier·ère à l'Hyper Bazar
await inside('hyper');
check(/Emplois/.test(await spotIn('hyper', 'Emplois') || ''), 'tableau des offres d\'emploi dans le magasin');
await page.keyboard.press('KeyE'); await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/car-offres.png' });
await page.locator('.list-item', { hasText: 'Caissier' }).getByRole('button', { name: 'Postuler' }).click(); await sleep(600);
check((await prof()).career.job?.id === 'caissier', 'embauché·e comme caissier·ère');
await page.keyboard.press('Escape');
await spotIn('hyper', 'Emplois'); await page.keyboard.press('KeyE'); await sleep(400);
await page.getByRole('button', { name: /Pointer/ }).click(); await sleep(600);
check(await ev(() => !!window.playzone.career.shift), 'service commencé (pointage)');
// tâche : la balise verte indique où aller
await ev(() => { const g = window.playzone; g.career.placeTask(); });
const task = await ev(() => { const g = window.playzone; const c = g.career; if (!c.taskPos) return null; g.player.teleport(c.taskPos.x, c.taskPos.z, 0); g.debugStep(0.3); return g.interactions.label(); });
check(/✅/.test(task || ''), `tâche de service : ${task}`);
await ev(() => { const g = window.playzone; g.cam.dist = 9; g.cam.pitch = 0.8; });
await sleep(300);
await page.screenshot({ path: 'tests/e2e/out/car-tache.png' });
const c0 = (await prof()).coins;
await page.keyboard.press('KeyE'); await sleep(700);
const c1 = (await prof()).coins;
check(c1 > c0, `tâche faite : prime (+${c1 - c0} PC)`);
// 10 minutes de présence = une heure de jeu payée
await work(10 * 60_000);
const r = await ev(() => window.playzone.net.request('career.tick', {}));
const c2 = (await prof()).coins;
check(r.paid > 80, `salaire d'une heure de jeu travaillée (10 min réelles) : +${r.paid} PC`);
// augmentation demandée trop tôt
await spotIn('hyper', 'Emplois'); await page.keyboard.press('KeyE'); await sleep(400);
await page.getByRole('button', { name: /augmentation/ }).click(); await sleep(500);
check(/demandé|Travaillez|plus que moi|Pas cette fois|Accordé|mérite/.test(await page.locator('.dialog-box').textContent()), 'le patron répond à la demande d\'augmentation');
await page.screenshot({ path: 'tests/e2e/out/car-patron.png' });
await page.locator('.dialog-box button').first().click();
await ev(() => window.playzone.career.clockOut()); await sleep(500);
check(await ev(() => !window.playzone.career.shift), `fin de service (${c2} PC)`);
// 2) école : CAP Mécanique, formation chronométrée puis examen
const school = await ev(async () => { const { BUILDINGS } = await import('/shared/world-layout.js'); return BUILDINGS.find((b) => b.interior === 'school').id; });
await inside(school);
await spotIn(school, 'Formations'); await page.keyboard.press('KeyE'); await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/car-ecole.png' });
await page.locator('.list-item', { hasText: 'CAP Mécanique' }).getByRole('button', { name: 'S\'inscrire' }).click(); await sleep(500);
check((await prof()).career.training?.id === 'cap-meca', 'inscrit·e au CAP Mécanique');
await page.keyboard.press('Escape');
await work(7 * 60_000 + 3000);
check((await prof()).career.training?.ready, 'formation suivie (7 minutes de présence)');
await spotIn(school, 'Formations'); await page.keyboard.press('KeyE'); await sleep(400);
await page.getByRole('button', { name: 'Passer l\'examen' }).click(); await sleep(400);
const answers = await ev(async () => { const { TRAININGS } = await import('/shared/careers.js'); return TRAININGS['cap-meca'].questions.map((q) => q[1][q[2]]); });
for (const a of answers) await page.getByRole('button', { name: a, exact: true }).click();
await page.screenshot({ path: 'tests/e2e/out/car-examen.png' });
await page.getByRole('button', { name: 'Rendre la copie' }).click(); await sleep(600);
check((await prof()).career.diplomas.includes('cap-meca'), 'diplôme obtenu');
await page.locator('.dialog-box button').first().click();
// 3) poste qualifié au garage
await inside('piston');
await spotIn('piston', 'Emplois'); await page.keyboard.press('KeyE'); await sleep(400);
page.once('dialog', () => {});
await page.locator('.list-item', { hasText: 'Mécanicien' }).getByRole('button', { name: 'Postuler' }).click(); await sleep(400);
const confirmBtn = page.getByRole('button', { name: 'Postuler', exact: true }).last();
if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click();
await sleep(600);
console.log('  toasts :', (await page.locator('.toast').allTextContents()).slice(-2).join(' | '));
check((await prof()).career.job?.id === 'mecanicien', 'embauché·e comme mécanicien·ne (poste qualifié, mieux payé)');
await ev(() => window.playzone.phone.open('work')); await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/car-appli.png' });

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
