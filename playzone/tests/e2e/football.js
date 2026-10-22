// Football : stade, club-house (inscription gratuite), essai gratuit, entraînements (tirs, slalom,
// passes, sprints), match contre des PNJ avec dribble, tir, passe, tacle ; progression des compétences.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-foot', name: 'Zizou', createdAt: 0, coins: 5000, xp: 500, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
for (let i = 0; i < 40 && !(await page.evaluate(() => !!window.playzone?.player)); i++) await sleep(500);
await sleep(1500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const step = (n, dt = 0.1) => ev(([n, dt]) => { for (let i = 0; i < n; i++) window.playzone.debugStep(dt); }, [n, dt]);

// 1) club-house
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; const b = BUILDING_BY_ID['club-foot']; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has('club-foot'); i++) g.debugStep(0.3); const d = g.interiors.loaded.get('club-foot').inters.find((x) => /Maison des Sports/.test(typeof x.label === 'function' ? x.label() : x.label)); g.player.teleport(d.x, d.z, 0); g.debugStep(0.3); });
check(/Maison des Sports/.test(await ev(() => window.playzone.interactions.label()) || ''), 'accueil de la Maison des Sports');
await page.keyboard.press('KeyE'); await sleep(400);
await page.getByText('Football (club gratuit)').click(); await sleep(400);
await page.locator('.modal .opt', { hasText: 'Matchs' }).click(); await sleep(300);
check(await page.getByText('(essai gratuit)').count() > 0, 'match amical d\'essai gratuit avant inscription');
await page.locator('.modal .opt', { hasText: 'Mon club' }).click(); await sleep(300);
await page.getByRole('button', { name: 'S\'inscrire (gratuit)' }).click(); await sleep(500);
const pj = await prof(); check(pj.sports.foot.club, `inscription gratuite au club (${pj.coins} PC)`);
await ev(() => { const g = window.playzone; for (const m of [...g.ui.stack]) m.close(); });

// 2) entraînement : tirs au but
await ev(() => window.playzone.football.startDrill('tirs')); await sleep(600);
await step(5);
check(await ev(() => window.playzone.football.s?.drill === 'tirs' && window.playzone.football.ball.visible), 'entraînement de tirs lancé, ballon sur le terrain');
await ev(() => { const g = window.playzone; g.cam.dist = 9; g.cam.pitch = 0.3; g.debugStep(0.2); });
await sleep(300);
await page.screenshot({ path: 'tests/e2e/out/foot-tirs.png' });
let goals = 0;
for (let k = 0; k < 10 && (await ev(() => !!window.playzone.football.s)); k++) {
  // le joueur va au ballon puis frappe
  await ev(() => { const g = window.playzone, f = g.football; if (!f.s) return; const b = f.s.ball; g.player.teleport(b.pos.x + 0.6, b.pos.z, -Math.PI / 2); g.debugStep(0.1); g.debugStep(0.1); if (f.s.ball.owner !== f.me()) f.giveBall(f.me()); f.shoot(0.6); });
  await step(40);
  goals = await ev(() => window.playzone.football.s?.score ?? -1);
}
await ev(async () => { const g = window.playzone, f = g.football; if (f.s) { f.s.balls = 0; f.s.t0 -= 20000; g.net.session.foot.at -= 20000; await f.finishDrill(); } });
await sleep(800);
const p1 = await prof();
check(p1.sports.foot.trainings === 1 && p1.sports.foot.skills.tir > 10 && (p1.body.endurance || 0) > 15, `entraînement validé : tir ${p1.sports.foot.skills.tir}, endurance ${Math.round(p1.body.endurance)}`);
await ev(() => { const g = window.playzone; for (const m of [...g.ui.stack]) m.close(); });

// 3) match amical 4 contre 4
await ev(async () => { const g = window.playzone; g.player.teleport(450, -545, 0); g.debugStep(0.2); await g.football.startMatch('amical'); });
await sleep(500);
const nAct = await ev(() => window.playzone.football.s?.actors.length);
check(nAct === 7, `match : ${nAct} joueurs PNJ + toi`);
// dribble : le ballon suit le joueur
await ev(() => { const f = window.playzone.football; f.s.pause = 0; f.giveBall(f.me()); });
await page.keyboard.down('KeyD'); await step(10); await page.keyboard.up('KeyD');
const drib = await ev(() => { const f = window.playzone.football, me = f.me(), b = f.s.ball; return { own: b.owner === me, d: Math.hypot(b.pos.x - me.pos.x, b.pos.z - me.pos.z) }; });
check(drib.d < 1.6, `dribble : ballon dans les pieds (${drib.d.toFixed(2)} m)`);
// l'IA joue : on la laisse jouer 40 s de jeu
const t0 = await ev(() => window.playzone.football.s.score.join('-'));
await ev(() => { const f = window.playzone.football; f.s.ball.owner = null; f.s.ball.pos.set(450, 0.22, -560); f.s.ball.vel.set(0, 0, 0); });
for (let i = 0; i < 4; i++) { await step(100); }
const st = await ev(() => { const f = window.playzone.football, s = f.s; return { moved: s.actors.filter((a) => Math.hypot(a.pos.x - a.home.x, a.pos.z - a.home.z) > 2).length, owner: s.ball.owner?.name || null, score: s.score.join('-'), bx: s.ball.pos.x }; });
check(st.moved >= 3, `l'IA joue (${st.moved} joueurs en mouvement, ballon : ${st.owner || 'libre'}, score ${st.score})`);
await ev(() => { const g = window.playzone; g.cam.dist = 22; g.cam.pitch = 0.6; g.debugStep(0.2); });
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/foot-match.png' });
// fin du match (on avance la fin pour le test : l'autorité vérifie la durée)
await ev(() => { const g = window.playzone, f = g.football; f.s.score = [2, 1]; f.s.myGoals = 1; g.net.session.foot.at -= 4 * 60_000; f.s.until = g.now() - 1; });
await step(5); await sleep(800);
const p2 = await prof();
check(p2.sports.foot.matches === 1, `match enregistré (${p2.sports.foot.wins} V / ${p2.sports.foot.losses} D, ${p2.sports.foot.goals} but)`);
check(!(await ev(() => !!window.playzone.football.s)), 'fin du match : joueurs PNJ rangés');

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
