// Padel en double : un robot joue pour le joueur (se place près de la balle et frappe).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-pd', name: 'Padelero', createdAt: 0, coins: 800, xp: 6000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=15&auto=solo&qualite=high', { timeout: 120000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['padel-club']; const g = window.playzone; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(0.5); await g.padel.start('loisir'); });
await sleep(500);
check(await ev(() => window.playzone.padel.m?.bots.length === 3), 'match de padel en double lancé (partenaire + 2 adversaires)');
let shots = 0, walls = 0;
for (let round = 0; round < 6; round++) {
  const r = await ev(() => {
    const g = window.playzone; let shots = 0, walls = 0;
    for (let i = 0; i < 900; i++) {
      const m = g.padel.m; if (!m) break;
      const b = m.b, P = g.player.pos, k = m.k;
      if (m.state === 'serve' && m.server === 0 && m.swingT <= 0) g.padel.swing();
      else if (m.state === 'play' && m.hitter === 1 && b.z > k.z + 1 && b.x > k.x - 1 && b.y < 1.5 && m.bounces === 1 && m.swingT <= 0) { P.x = b.x + 0.9; P.z = b.z + 0.2; g.padel.swing(); shots++; }
      if (m.walled) walls++;
      g.debugStep(1 / 30);
    }
    return { shots, walls };
  });
  shots += r.shots; walls += r.walls;
  if (round === 0) await page.screenshot({ path: 'tests/e2e/out/padel-match.png' });
}
const res = await ev(() => window.playzone.padel.m ? { games: window.playzone.padel.m.games } : null);
check(shots > 3, `échanges joués (${shots} frappes du joueur, ${walls} images avec rebond sur vitre)`);
await sleep(31000);
await ev(() => window.playzone.padel.m && window.playzone.padel.end(true));
await sleep(1500);
const p = await ev(() => window.playzone.profile.sports.padel);
check(p && p.matches >= 1, `match enregistré (${p?.wins} victoire(s), score ${JSON.stringify(res?.games || 'fini')})`);
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'PADEL OK' : 'PADEL ÉCHEC');
process.exit(ok ? 0 : 1);
