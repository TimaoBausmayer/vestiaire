// Mini-golf : parcours complet de 9 trous (un robot vise et tape), carte de score, record.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-g', name: 'Golfeur', createdAt: 0, coins: 500, xp: 6000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=11&auto=solo&qualite=low', { timeout: 90000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID.minigolf; const g = window.playzone; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(1); });
await ev(() => window.playzone.golf.desk());
await sleep(300);
await page.locator('.dialog-box button', { hasText: 'Jouer' }).first().click();
await sleep(600);
check(await ev(() => !!window.playzone.golf.s), 'parcours lancé');
let shot = 0;
for (let i = 0; i < 4000; i++) {
  const st = await ev(() => {
    const g = window.playzone, gf = g.golf, s = gf.s; if (!s) return null;
    if (!s.moving && s.sunk <= 0) {
      const H = s.H, cx = s.c.x + H.cup[0], cz = s.c.z + H.cup[1], d = Math.hypot(cx - s.b.x, cz - s.b.z);
      s.aim = Math.atan2(cx - s.b.x, cz - s.b.z) + (Math.random() - 0.5) * 0.25;
      gf.shoot(Math.min(1, Math.sqrt(2 * 1.15 * d) / 7.5 + 0.02));
      return 'shot';
    }
    g.debugStep(1 / 30);
    return s.hole;
  });
  if (st === null) break;
  if (st === 'shot') { shot++; if (shot === 6) await page.screenshot({ path: 'tests/e2e/out/golf.png' }); await sleep(120); }
}
await sleep(1500);
const G = (await prof()).sports.golf;
check(G?.rounds === 1 && G.best >= 9 && G.best <= 54, `parcours terminé : ${G?.best} coups (par 24), ${G?.aces} trou(s) en un`);
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'GOLF OK' : 'GOLF ÉCHEC');
process.exit(ok ? 0 : 1);
