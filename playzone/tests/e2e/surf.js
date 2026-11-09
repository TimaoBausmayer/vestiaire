// Surf : école de surf, vagues animées, cours gratuit, décollage sur une vague, glisse le long de
// l'épaule (points), fin de session validée par l'autorité, compétition.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-sf', name: 'Surfeur', createdAt: 0, coins: 5000, xp: 20000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=15&auto=solo&qualite=high', { timeout: 120000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['surf-school']; const g = window.playzone; g.player.teleport(b.door.x, b.door.z + 3, 0); g.cam.yaw = 0; g.cam.pitch = 0.25; g.debugStep(0.5); });
const nw = await ev(() => window.playzone.surf.waves.length);
check(nw >= 2, `vagues qui arrivent sur la plage (${nw})`);
await page.screenshot({ path: 'tests/e2e/out/surf-plage.png' });
await ev(() => window.playzone.surf.start('libre'));
await sleep(600);
check(await ev(() => window.playzone.surf.s?.state === 'paddle'), 'à l\'eau sur la planche (cours gratuit)');
// on se place devant une vague prête à déferler, face à la plage, en ramant
let rode = false;
for (let tries = 0; tries < 6 && !rode; tries++) {
  rode = await ev(async () => {
    const g = window.playzone, S = g.surf, s = S.s, { SURF } = await import('/shared/surf.js');
    // attendre qu'une vague approche du récif
    for (let k = 0; k < 400; k++) { const w = S.waves.find((q) => q.zc < SURF.zBreak + 20 && q.zc > SURF.zBreak - 5 && q.H > 0.5); if (w) { s.x = w.peak + 6; s.z = w.zc - 2.2; s.yaw = Math.PI; s.v = 2; s.state = 'paddle'; S.takeoff(); return s.state === 'ride'; } g.debugStep(0.1); }
    return false;
  });
}
check(rode, 'décollage sur la vague');
// glisse : on file le long de l'épaule (vers l'extérieur de la partie cassée), un peu en descente
const ride = await ev(async () => {
  const g = window.playzone, S = g.surf, s = S.s; let maxScore = 0, maxV = 0;
  const side = Math.sign(s.x - S.waves.find((q) => q.i === s.wave).peak) || 1;
  for (let k = 0; k < 150 && s.state === 'ride'; k++) {
    // cap : le long de la vague, légèrement vers la plage
    s.yaw = Math.PI - side * 1.25; g.debugStep(1 / 15); maxScore = Math.max(maxScore, s.score); maxV = Math.max(maxV, s.v);
  }
  return { maxScore, maxV, scores: s.scores.slice() };
});
await page.screenshot({ path: 'tests/e2e/out/surf-vague.png' });
check(ride.maxScore > 100 || ride.scores.some((x) => x > 100), `points sur la vague (${Math.round(Math.max(ride.maxScore, ...ride.scores, 0))} pts, ${Math.round(ride.maxV * 3.6)} km/h)`);
await sleep(8500);   // durée réelle minimale côté autorité
await ev(() => window.playzone.surf.stop());
await sleep(1200);
const p = await ev(() => window.playzone.profile.sports.surf);
check(p && p.sessions >= 1 && p.waves >= 1, `session validée : ${p?.waves} vague(s), niveau ${p?.skill}`);
await page.screenshot({ path: 'tests/e2e/out/surf-fin.png' });
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'SURF OK' : 'SURF ÉCHEC');
process.exit(ok ? 0 : 1);
