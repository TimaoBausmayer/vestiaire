// Tennis : club, match contre le 1er adversaire (un robot joue pour le test), score, prime.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-t', name: 'Tennisman', createdAt: 0, coins: 500, xp: 6000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=15&auto=solo&qualite=low', { timeout: 90000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['tennis-1']; const g = window.playzone; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(1); });
await ev(() => { const g = window.playzone; g.tennis.desk({ id: 'tennis-1' }); });
await sleep(400);
await page.locator('.modal button', { hasText: 'Jouer' }).first().click();
await sleep(800);
check(await ev(() => !!window.playzone.tennis.m), 'match lancé');
const c0 = (await prof()).coins;

// robot : se place près de la balle quand elle vient, sert, frappe
let shots = 0, shot = false;
for (let i = 0; i < 2400; i++) {
  const st = await ev(() => {
    const g = window.playzone, m = g.tennis.m; if (!m) return null;
    const b = m.b, P = g.player.pos;
    if (m.state === 'serve' && m.server === 0) { g.tennis.swing(); return 'serve'; }
    if (m.state === 'play' && m.hitter === 1 && b.z > m.k.z + 1 && b.vz > 0) {
      // se placer à 0,9 m de la balle quand elle redescend
      if (b.y < 1.4 && (m.bounces === 1 || b.z > m.k.z + 8)) { P.x = b.x + 0.9; P.z = b.z + 0.2; g.tennis.swing(); return 'hit'; }
    }
    g.debugStep(1 / 30);
    const inf = m.info.textContent; if (inf && inf !== window.__lastInfo) { window.__lastInfo = inf; (window.__log = window.__log || []).push(inf + ` [rally ${m.rally}]`); }
    return m.state;
  });
  if (st === null) break;
  if (st === 'hit') shots++;
  if (st === 'play' && !shot) { shot = true; await page.screenshot({ path: 'tests/e2e/out/tennis-match.png' }); }
  if (i % 40 === 0) await sleep(30);
}
const info = await ev(() => { const m = window.playzone.tennis.m; return m ? { games: m.games, pts: m.pts, state: m.state } : null; });
const maxRally = Math.max(0, ...(await ev(() => window.__log || [])).map((l) => +(l.match(/rally (\d+)/)?.[1] || 0)));
check(maxRally >= 5, `vrais échanges (rallye le plus long : ${maxRally} coups)`);
if (info) await ev(() => window.playzone.tennis.end(false, true));
console.log((await ev(() => window.__log || [])).join('\n'));
console.log('frappes du robot', shots, 'état', JSON.stringify(info));
await sleep(1500);
const T = (await prof()).sports.tennis;
check(T?.matches === 1, `match enregistré (${JSON.stringify(T)})`);
check(shots > 5, `le robot a frappé ${shots} fois`);
await page.screenshot({ path: 'tests/e2e/out/tennis-fin.png' });
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'TENNIS OK' : 'TENNIS ÉCHEC');
process.exit(ok ? 0 : 1);
