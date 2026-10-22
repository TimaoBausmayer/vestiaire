// Course à pied, cyclisme, F1, ski : essai gratuit puis adhésion, feux de départ, portes et tours,
// adversaires PNJ, résultats validés par l'autorité, progression (niveau + endurance), qualifs F1.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, justice: { licence: { code: true, permis: true } }, id: 'solo-c', name: 'Mollet', createdAt: 0, coins: 20000, xp: 3000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
for (let i = 0; i < 40 && !(await page.evaluate(() => !!window.playzone?.player)); i++) await sleep(500);
await sleep(1500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const closeAll = () => ev(() => { const g = window.playzone; for (const m of [...g.ui.stack]) m.close(); });
const toBuilding = (id) => ev(async (id) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; const b = BUILDING_BY_ID[id]; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(0.3); }, id);
// parcourt toutes les portes (tours) puis vieillit la course pour respecter le temps minimal
const runAll = (secs) => ev(async (secs) => {
  const g = window.playzone, R = g.races, s = R.s;
  for (let i = 0; i < 40; i++) g.debugStep(0.1);   // feux
  s.go -= secs * 1000; s.lapStart -= secs * 1000; g.net.session.race.go -= secs * 1000;
  let guard = 0;
  while (R.s && guard++ < 200) { const gt = s.route.gates[s.next]; if (s.v) s.v.sim.place(gt.x, gt.z, 0); else g.player.teleport(gt.x, gt.z, 0); g.debugStep(0.05); g.debugStep(0.05); }
  await new Promise((r) => setTimeout(r, 800));
}, secs);

// 1) course à pied : gratuite, séance + course contre des PNJ
await toBuilding('club-foot');
await ev(() => window.playzone.races.clubDesk()); await sleep(300);
await page.getByText('Course à pied (gratuit)').click(); await sleep(400);
check(await page.getByText('Course du quartier').count() > 0, 'accueil course à pied : séance, fractionné, course');
await closeAll();
const e0 = (await prof()).body.endurance ?? 15;
await ev(() => window.playzone.races.start('course', 'course')); await sleep(600);
check(await ev(() => window.playzone.races.s?.npcs.length === 7), 'course du quartier : 7 coureurs PNJ sur la piste');
await ev(() => { const g = window.playzone; for (let i = 0; i < 45; i++) g.debugStep(0.1); g.cam.dist = 12; g.cam.pitch = 0.4; g.debugStep(0.1); });
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/courses-piste.png' });
await runAll(150);
let p = await prof();
check(p.sports.course.races === 1 && (p.body.endurance ?? 15) > e0 && p.sports.course.skill > 5, `course validée : niveau ${p.sports.course.skill}, endurance ${Math.round(p.body.endurance)} (avant ${Math.round(e0)})`);
await closeAll();

// 2) cyclisme : essai gratuit, puis adhésion obligatoire
await toBuilding('club-foot');
await ev(() => window.playzone.races.start('velo', 'seance')); await sleep(600);
check(await ev(() => window.playzone.vehicles.current?.model === 'velo-course'), 'vélo de course prêté par le club (essai gratuit)');
await runAll(200);
p = await prof();
check(p.sports.velo.trial && p.sports.velo.best.seance > 0, `sortie vélo chronométrée (${p.sports.velo.best.seance} s)`);
await closeAll();
await toBuilding('club-foot');
const e1 = await ev(async () => { try { await window.playzone.net.request('sport.start', { disc: 'velo', mode: 'seance' }); return ''; } catch (e) { return e.message; } });
check(/essai gratuit est passé/.test(e1), 'après l\'essai : adhésion demandée');
await ev(() => window.playzone.net.request('sport.member', { disc: 'velo', kind: 'season' }));
check((await prof()).sports.velo.member?.until > Date.now(), 'licence du Vélo Club prise (150 PC)');

// 3) F1 : qualifications puis Grand Prix (feux, 9 monoplaces PNJ)
await toBuilding('f1-paddock');
await ev(() => window.playzone.races.start('f1', 'qualif')); await sleep(600);
check(await ev(() => window.playzone.vehicles.current?.model === 'f1'), 'monoplace F1 (essai gratuit)');
await ev(() => { const g = window.playzone; g.cam.dist = 9; g.cam.pitch = 0.3; for (let i = 0; i < 10; i++) g.debugStep(0.1); });
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/courses-f1.png' });
await runAll(120);
p = await prof();
check(p.sports.f1.grid >= 1, `qualifications : départ P${p.sports.f1.grid} au Grand Prix`);
await closeAll();
await ev(() => window.playzone.net.request('sport.member', { disc: 'f1', kind: 'season' }).catch(() => null));
await toBuilding('f1-paddock');
await ev(() => window.playzone.races.start('f1', 'course')); await sleep(600);
check(await ev(() => window.playzone.races.s?.npcs.length === 9), 'Grand Prix : 10 monoplaces sur la grille');
await ev(() => { for (let i = 0; i < 70; i++) window.playzone.debugStep(0.1); });
await sleep(300);
await page.screenshot({ path: 'tests/e2e/out/courses-gp.png' });
await runAll(240);
p = await prof();
check(p.sports.f1.races === 1, `Grand Prix terminé (${p.sports.f1.wins} victoire, ${p.coins} PC)`);
await closeAll();

// 4) ski : essai gratuit, télésiège, slalom
await ev(async () => { const { SKI } = await import('/shared/courses.js'); const g = window.playzone; g.player.teleport(SKI.hut.x, SKI.hut.z + 2.5, Math.PI); g.debugStep(0.3); });
check(/Mont-Pinard/.test(await ev(() => window.playzone.interactions.label()) || ''), 'chalet de la station de ski');
await ev(() => window.playzone.ski.start('slalom', 'rouge', 'ski')); await sleep(600);
await ev(() => { const g = window.playzone; for (let i = 0; i < 60; i++) g.debugStep(0.1); g.cam.dist = 10; g.debugStep(0.1); });
await sleep(300);
await page.screenshot({ path: 'tests/e2e/out/courses-telesiege.png' });
check(await ev(() => window.playzone.ski.s?.phase === 'lift'), 'télésiège en route');
await ev(() => { const g = window.playzone; g.ski.s.t = 99; for (let i = 0; i < 40; i++) g.debugStep(0.1); });
check(await ev(() => window.playzone.ski.s?.phase === 'run'), 'départ du slalom');
await page.keyboard.down('KeyW');
await ev(() => { for (let i = 0; i < 60; i++) window.playzone.debugStep(0.1); });
await sleep(200);
await page.screenshot({ path: 'tests/e2e/out/courses-ski.png' });
const v = await ev(() => window.playzone.ski.s?.v || 0);
check(v > 8, `ça glisse : ${Math.round(v * 3.6)} km/h`);
await ev(() => { for (let i = 0; i < 400 && window.playzone.ski.s; i++) window.playzone.debugStep(0.1); });
await page.keyboard.up('KeyW');
await sleep(800);
p = await prof();
check(p.sports.ski.trial && p.sports.ski.best.slalom > 0, `slalom chronométré : ${p.sports.ski.best.slalom} s`);
await ev(() => { const g = window.playzone; for (const m of [...g.ui.stack]) m.close(); });

// 5) snowpark en snowboard : tremplins, sauts et figures (forfait journée après l'essai)
await ev(async () => { const { SKI } = await import('/shared/courses.js'); const g = window.playzone; g.player.teleport(SKI.hut.x, SKI.hut.z + 2.5, Math.PI); g.debugStep(0.3); await g.net.request('sport.member', { disc: 'ski', kind: 'day' }); });
await ev(() => window.playzone.ski.start('bigair', 'park', 'snowboard')); await sleep(500);
await ev(() => { const g = window.playzone; g.ski.s.t = 99; for (let i = 0; i < 40; i++) g.debugStep(0.1); });
check(await ev(() => window.playzone.ski.s?.P.color === 'park' && window.playzone.ski.board.visible), 'snowboard au sommet du snowpark');
await page.keyboard.down('KeyW');
let air = false;
for (let k = 0; k < 30 && !air; k++) { air = await ev(() => { const s = window.playzone.ski.s; for (let i = 0; i < 4; i++) window.playzone.debugStep(0.05); return !!s && s.air > 0.2; }); }
await ev(() => { const g = window.playzone; g.cam.dist = 9; g.cam.pitch = 0.2; g.debugStep(0.05); });
await sleep(200);
await page.screenshot({ path: 'tests/e2e/out/courses-snowpark.png' });
check(air, 'décollage sur un tremplin du snowpark');
await ev(() => { for (let i = 0; i < 600 && window.playzone.ski.s; i++) window.playzone.debugStep(0.05); });
await page.keyboard.up('KeyW');
await sleep(800);
p = await prof();
check(p.sports.ski.best.bigair > 0, `Big Air : ${p.sports.ski.best.bigair} pts de figures`);

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
