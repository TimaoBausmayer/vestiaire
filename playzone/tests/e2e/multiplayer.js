// Étape 8 : deux navigateurs connectés au vrai serveur (comptes, visibilité, chat, invitation chez soi).
import { launch, watchConsole, sleep } from './lib.js';
import { startServer } from '../../server/index.js';
import { mkdirSync, rmSync } from 'node:fs';
mkdirSync('tests/e2e/out', { recursive: true });
rmSync('tests/e2e/out/mp.db', { force: true });
const srv = await startServer({ port: 0, dbFile: 'tests/e2e/out/mp.db', quiet: false, accountsPerIp: 50 });
const url = `http://127.0.0.1:${srv.port}/index.html?heure=12`;
const { browser, context: ctxA } = await launch();
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const A = await ctxA.newPage(), B = await ctxB.newPage();
const errA = watchConsole(A, 'A'), errB = watchConsole(B, 'B');
let ok = true;
const check = (cond, msg) => { console.log(`${cond ? '✔' : '✘'} ${msg}`); ok = ok && cond; };

async function join(page, name) {
  await page.goto(url);
  await page.getByText('Jouer en ligne').click({ timeout: 90000 });
  await page.getByPlaceholder('Ton pseudo').fill(name, { timeout: 60000 });
  await page.getByRole('button', { name: "C'est parti !" }).click();
  await page.waitForFunction(() => window.playzone?.playing, null, { timeout: 60000 });
}
// marche "réaliste" (8 m/s) pour passer la vérification de vitesse du serveur
async function walk(page, pts) {
  for (const [x, z] of pts) {
    for (;;) {
      const done = await page.evaluate(([x, z]) => {
        const g = window.playzone, p = g.player.pos;
        const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.4) return true;
        const k = Math.min(d, 0.8) / d;
        g.player.teleport(p.x + dx * k, p.z + dz * k, Math.atan2(dx, dz), 0);
        g.net.sendState(g.player.netState(), g.player.zone);
        return false;
      }, [x, z]);
      if (done) break;
      await sleep(100);
    }
  }
}

await join(A, 'Alice');
await join(B, 'Bob');
await sleep(2500);
const seen = await B.evaluate(() => window.playzone.remotes.all().map((r) => r.name));
check(seen.includes('Alice'), `Bob voit Alice (${seen.join(', ')})`);
// Alice se déplace : Bob voit le mouvement
await walk(A, [[3, 8]]);
await sleep(1200);
const posA = await B.evaluate(() => { const r = window.playzone.remotes.all().find((x) => x.name === 'Alice'); return r && { x: +r.pos.x.toFixed(1), z: +r.pos.z.toFixed(1) }; });
check(posA && Math.abs(posA.x - 3) < 0.6 && Math.abs(posA.z - 8) < 0.6, `Bob voit Alice arriver en (3, 8) : ${JSON.stringify(posA)}`);
// chat
await A.keyboard.press('Enter');
await A.keyboard.type('Salut Bob ! On fait une course de poulets ?');
await A.keyboard.press('Enter');
await sleep(1500);
const chatB = await B.locator('.chat-log').textContent();
check(chatB.includes('Salut Bob'), 'Bob reçoit le message d\'Alice dans le chat');
await B.evaluate(() => { const g = window.playzone; g.cam.yaw = 2.8; g.cam.dist = 8; g.cam.pitch = 0.3; });
await sleep(800);
await B.screenshot({ path: 'tests/e2e/out/s8-bob-voit-alice.png' });
// triche : Bob tente une téléportation -> corrigée par le serveur
await B.evaluate(() => { const g = window.playzone; g.player.teleport(100, 100, 0); g.net.sendState(g.player.netState(), 'world'); });
await sleep(1200);
const bpos = await B.evaluate(() => ({ x: window.playzone.player.pos.x, z: window.playzone.player.pos.z }));
check(Math.hypot(bpos.x, bpos.z - 12) < 15, `téléportation de Bob refusée par le serveur (renvoyé en ${bpos.x.toFixed(1)}, ${bpos.z.toFixed(1)})`);
// argent : vérifié côté serveur (bonus du jour)
const coinsB = await B.evaluate(() => window.playzone.profile.coins);
check(coinsB === 250, `Bob a 250 PC (200 de départ + 50 de bonus du jour validé par le serveur) : ${coinsB}`);
// invitation chez Alice
await walk(A, [[30, 0], [60, 0], [72, 12.5]]);
await walk(B, [[30, 1], [60, 1], [71, 12.5]]);
await A.evaluate(() => window.playzone.home.enter());
await sleep(1500);
await A.evaluate(() => { const g = window.playzone; const id = g.remotes.all().find((r) => r.name === 'Bob')?.id; g.net.send({ t: 'invite', kind: 'home', target: id }); });
await sleep(1200);
await B.locator('.toast button', { hasText: 'Accepter' }).first().click();
await sleep(2500);
const zoneB = await B.evaluate(() => window.playzone.player.zone);
const zoneA = await A.evaluate(() => window.playzone.player.zone);
check(zoneB === zoneA && zoneB.startsWith('home:'), `Bob est chez Alice (zones : ${zoneA} / ${zoneB})`);
await sleep(1500);
const seesInHome = await A.evaluate(() => window.playzone.remotes.all().filter((r) => r.zone === window.playzone.player.zone).map((r) => r.name));
check(seesInHome.includes('Bob'), `Alice voit Bob dans son logement (${seesInHome.join(', ')})`);
await A.evaluate(() => { const g = window.playzone; g.cam.yaw = 0.5; g.cam.pitch = 0.8; g.cam.dist = 11; });
await sleep(1000);
await A.screenshot({ path: 'tests/e2e/out/s8-alice-recoit-bob.png' });
// persistance : le profil est en base
await sleep(2500);
const rows = srv.db.db.prepare('SELECT name, profile FROM players').all().map((r) => ({ name: r.name, coins: JSON.parse(r.profile).coins }));
check(rows.length === 2, `profils sauvegardés en base SQLite : ${JSON.stringify(rows)}`);
console.log(ok ? 'OK' : 'ÉCHEC');
const errs = [...errA, ...errB].filter((e) => !/404/.test(e));
console.log(errs.join('\n') || 'Aucune erreur console');
await browser.close();
await srv.close();
process.exit(ok ? 0 : 1);
