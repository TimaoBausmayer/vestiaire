// Paintball (équipes, Dernier debout avec zone) et laser game contre des bots IA.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-ar', name: 'Tireur', createdAt: 0, coins: 5000, xp: 20000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=14&auto=solo&qualite=high', { timeout: 120000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const go = (id) => ev(async (id) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID[id]; const g = window.playzone; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(0.5); }, id);
// --- paintball en équipes
await go('paintball-club');
await ev(() => window.playzone.arenas.start('paintball', 'equipes'));
await sleep(800);
check(await ev(() => window.playzone.arenas.m?.actors.length === 10), 'paintball 5 contre 5 lancé');
// tir du joueur : on vise un bot adverse visible (caméra orientée vers lui)
const shot = await ev(async () => {
  const g = window.playzone, A = g.arenas, m = A.m;
  const foe = m.actors.find((a) => !a.me && a.team !== m.me.team);
  // on place l'adversaire face à nous à découvert
  foe.pos.set(m.me.pos.x, 0, m.me.pos.z + (m.me.team === 0 ? 9 : -9));
  g.cam.yaw = Math.atan2(m.me.pos.x - foe.pos.x, m.me.pos.z - foe.pos.z); g.cam.pitch = 0.08;
  for (let k = 0; k < 30; k++) { foe.pos.set(m.me.pos.x, 0, m.me.pos.z + (m.me.team === 0 ? 9 : -9)); g.input.actionHeld = true; g.debugStep(1 / 30); }
  g.input.actionHeld = false; g.debugStep(0.5);
  return { kills: m.kills, ammo: m.ammo, splats: A.splats.length };
});
await page.screenshot({ path: 'tests/e2e/out/arenes-paintball.png' });
check(shot.ammo < 40, `on tire des billes (${40 - shot.ammo} tirées, ${shot.splats} taches de peinture)`);
check(shot.kills >= 1, `adversaire éliminé (${shot.kills})`);
// la partie se joue : les bots s'affrontent
const sim = await ev(() => { const g = window.playzone, m = g.arenas.m; for (let k = 0; k < 40 && g.arenas.m; k++) g.debugStep(0.5); const mm = g.arenas.m; return mm ? { score: mm.score.slice(), t: mm.t } : { over: true }; });
check(sim.over || sim.score[0] + sim.score[1] > 1, `les bots jouent (score ${sim.score ? sim.score.join('–') : 'fin'})`);
await sleep(41000 - 15000);
await ev(() => window.playzone.arenas.finish(false));
await sleep(1200);
const p1 = await ev(() => window.playzone.profile.sports.paintball);
check(p1 && p1.games >= 1, `partie validée (${p1?.kills} éliminations)`);
await page.locator('.dialog button, .modal button', { hasText: 'OK' }).first().click().catch(() => {});
// --- Dernier debout
await go('paintball-club');
await ev(() => window.playzone.arenas.start('paintball', 'survie'));
await sleep(700);
const br = await ev(() => { const g = window.playzone, m = g.arenas.m; for (let k = 0; k < 150 && g.arenas.m; k++) g.debugStep(0.5); const mm = g.arenas.m; return { alive: mm ? mm.actors.filter((a) => a.alive).length : 0, zone: !!(mm || m).zoneMesh, over: !mm }; });
await page.screenshot({ path: 'tests/e2e/out/arenes-zone.png' });
check(br.zone && (br.over || br.alive < 12), `zone qui rétrécit, ${br.over ? 'partie terminée' : `${br.alive} encore en jeu`}`);
await ev(() => window.playzone.arenas.m && window.playzone.arenas.finish(true));
await sleep(800);
await page.locator('.dialog button, .modal button', { hasText: 'OK' }).first().click().catch(() => {});
// --- laser game
await go('laser-game');
await ev(() => window.playzone.arenas.start('laser', 'equipes'));
await sleep(700);
const lz = await ev(() => { const g = window.playzone, m = g.arenas.m; let beams = 0; for (let k = 0; k < 120 && g.arenas.m; k++) { g.debugStep(0.25); beams = Math.max(beams, g.arenas.beams.length); } const mm = g.arenas.m; return { n: m.actors.length, beams, score: mm?.score.slice() }; });
await page.screenshot({ path: 'tests/e2e/out/arenes-laser.png' });
check(lz.n === 8 && lz.beams > 0, `laser game 4 contre 4, tirs laser visibles (score ${lz.score?.join('–')})`);
await ev(() => window.playzone.arenas.m && window.playzone.arenas.finish(true));
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'ARENES OK' : 'ARENES ÉCHEC');
process.exit(ok ? 0 : 1);
