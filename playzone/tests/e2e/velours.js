// Le Velours : club privé fermé par un videur ; le code 49309117 tapé sur la carte du téléphone l'ouvre.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-ve', name: 'Fêtard', createdAt: 0, coins: 5000, xp: 20000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=23&auto=solo&qualite=high', { timeout: 120000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
// fermé : on ne passe pas la porte
const blocked = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['club-vip'], g = window.playzone; g.player.teleport(b.door.x - 4, b.door.z, Math.PI / 2); g.cam.yaw = -Math.PI / 2; g.cam.pitch = 0.2; g.debugStep(0.5); return g.vipClub.rope.enabled; });
check(blocked, 'sans le code, le cordon et le videur bloquent l\'entrée');
await page.screenshot({ path: 'tests/e2e/out/velours-porte.png' });
// code sur la carte du téléphone
await ev(() => window.playzone.phone.open('map'));
await sleep(500);
await page.locator('.map-code input').fill('49309117');
await page.locator('.map-code button').click();
await sleep(800);
check(await ev(() => !!window.playzone.profile.unlocks?.vip), 'code 49309117 accepté : club débloqué');
await ev(() => window.playzone.phone.close());
const inside = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['club-vip'], g = window.playzone; g.debugStep(0.3); const open = !g.vipClub.rope.enabled; g.player.teleport(b.x, b.z, Math.PI / 2); g.debugStep(1.5); return { in: open, inside: g.interiors?.inside?.id }; });
check(inside.in && inside.inside === 'club-vip', `cordon retiré, on entre au Velours (${inside.inside})`);
await page.screenshot({ path: 'tests/e2e/out/velours-dedans.png' });
// nouveau joueur : code donné directement au videur
await ev(() => { const p = window.playzone.profile; p.unlocks = {}; });
const door = await ev(async () => { const g = window.playzone, V = g.vipClub; V.askCode(); await new Promise((r) => setTimeout(r, 200)); const inp = document.querySelector('.modal input'); inp.value = '49309117'; inp.dispatchEvent(new Event('input')); document.querySelector('.modal .btn.block').click(); await new Promise((r) => setTimeout(r, 400)); g.debugStep(0.2); return { vip: !!g.profile.unlocks?.vip, rope: g.vipClub.rope.enabled }; });
check(door.vip && !door.rope, 'code donné au videur, à la porte : entrée ouverte');
const bad = await ev(() => window.playzone.net.request('secret.code', { code: '1234' }).then(() => false).catch(() => true));
check(bad, 'un mauvais code est refusé');
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'VELOURS OK' : 'VELOURS ÉCHEC');
process.exit(ok ? 0 : 1);
