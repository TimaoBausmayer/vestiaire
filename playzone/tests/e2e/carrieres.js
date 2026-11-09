// Carrières et athlétisme : spécialité, 100 m (ligne droite) contre 7 PNJ, footing qui fait progresser,
// poids qui monte en mangeant trop, match de foot perso (3 contre 3, 2 min), Appli Sport, salaire.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-ca', name: 'Athlète', createdAt: 0, coins: 5000, xp: 20000, rep: 0, appearance: {}, inventory: { burger: 6, 'menu-geant': 4 } })));
await page.goto(url + 'index.html?heure=11&auto=solo&qualite=low', { timeout: 120000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
// spécialité
await ev(() => window.playzone.net.request('athle.profil', { profil: 'sprinteur' }));
check((await prof()).body.profil === 'sprinteur', 'spécialité sprinteur choisie');
const sf = await ev(async () => { const { sprintFactor } = await import('/shared/athlete.js'); const b = window.playzone.profile.body; return [sprintFactor(b), sprintFactor({ ...b, profil: 'endurance' })]; });
check(sf[0] > sf[1], `le sprinteur va plus vite en pointe (${sf[0].toFixed(3)} vs ${sf[1].toFixed(3)})`);
// 100 m : départ au club, on court tout droit vers l'arrivée
const v0 = (await prof()).body.vitesse ?? 10;
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['club-foot']; const g = window.playzone; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(1); });
await ev(() => window.playzone.races.start('course', 'sprint100'));
await sleep(3400);
await ev(() => { const g = window.playzone; g.debugStep(0.1); });
await page.keyboard.down('ShiftLeft');
for (let i = 0; i < 140; i++) {
  const st = await ev(() => { const g = window.playzone, s = g.races.s; if (!s) return 'fin'; const P = g.player.pos; const yaw = Math.PI / 2; g.cam.yaw = yaw + Math.PI; g.player.yaw = yaw; return P.x.toFixed(0); });
  if (st === 'fin') break;
  await page.keyboard.down('KeyW'); await ev(() => window.playzone.debugStep(0.1));
  if (i === 6) await page.screenshot({ path: 'tests/e2e/out/carrieres-100m.png' });
}
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
await sleep(1500);
const p1 = await prof();
check((p1.sports.course.races || 0) >= 1, `100 m couru (${p1.sports.course.races} course)`);
check((p1.body.vitesse ?? 10) > v0, `la vitesse progresse (${v0} → ${(p1.body.vitesse).toFixed(2)})`);
check((p1.career?.course?.pts || 0) > 0, `points de carrière athlétisme : ${p1.career?.course?.pts}`);
await page.locator('.modal button, .dialog button', { hasText: 'OK' }).first().click().catch(() => {});
// footing en ville : l'autorité valide les mètres
await sleep(11000);
const e0 = (await prof()).body.endurance ?? 15;
const run = await ev(() => window.playzone.net.request('athle.run', { meters: 500 }));
check(run.meters > 0 && run.endurance > e0, `footing : +${(run.endurance - e0).toFixed(2)} endurance (${run.meters} m)`);
// manger trop : on grossit
const w0 = (await prof()).body.weight;
for (let i = 0; i < 4; i++) await ev(() => window.playzone.net.request('food.eat', { itemId: 'menu-geant' }).catch(() => null));
const w1 = (await prof()).body.weight;
check(w1 > w0 + 0.5, `trop manger fait grossir (${w0.toFixed(1)} → ${w1.toFixed(1)} kg)`);
// carrière : simulation d'une promotion → salaire de sponsor
await ev(() => { const p = window.playzone.profile; p.career.course.pts = 230; });
const sal = await ev(() => window.playzone.net.request('career.salary', {}).catch((e) => ({ err: e.message })));
check(sal.amount > 0 || /déjà|sponsor/.test(sal.err || ''), `salaire de sponsor : ${sal.amount ?? sal.err}`);
// match de foot perso contre des bots
const fm = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['club-foot']; const g = window.playzone; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(1); await g.net.request('foot.join', {}).catch(() => {}); return g.net.request('foot.matchStart', { kind: 'organise', strength: 0.3, size: 3, mins: 2 }); });
check(fm.size === 3 && fm.mins === 2, `match perso : ${fm.size} contre ${fm.size}, ${fm.mins} min`);
await ev(() => window.playzone.net.request('foot.matchEnd', { abandon: true }));
// Appli Sport
await ev(() => { const g = window.playzone; g.phone.open(); g.phone.openApp ? g.phone.openApp('sport') : null; });
await sleep(500);
const appOk = await ev(() => { const g = window.playzone; const d = document.createElement('div'); g.phone.app_sport(d); return d.textContent; });
check(/Mes carrières/.test(appOk) && /Ma spécialité/.test(appOk) && /Poids/.test(appOk), 'Appli Sport : physique, spécialité, carrières');
await ev(() => { const g = window.playzone; g.phone.close?.(); });
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'CARRIERES OK' : 'CARRIERES ÉCHEC');
process.exit(ok ? 0 : 1);
