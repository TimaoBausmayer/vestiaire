// Corrections demandées : arrivée en prison au sol (pas sur le toit), évasion par tunnel, foule de
// piétons qui marchent dans toute la ville, pas de chiens errants, code admin à la mairie, téléphone
// tenu en main, réseau social PlayGram, sprint lié à l'endurance, caméra libre dans les magasins.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, justice: { licence: { code: true, permis: true } }, id: 'solo-f', name: 'Testeur', createdAt: 0, coins: 900, cash: 100, xp: 500, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };

// 1) foule : des piétons qui marchent partout, pas de chiens errants
await ev(() => { const g = window.playzone; g.player.teleport(175, 8, 0); g.debugStep(0.5); });
const crowd = await ev(() => window.playzone.npcs.crowd.length);
const p0 = await ev(() => window.playzone.npcs.crowd.map((n) => [n.pos.x, n.pos.z]));
await ev(() => { for (let i = 0; i < 60; i++) window.playzone.debugStep(0.1); });
const moved = await ev((p0) => window.playzone.npcs.crowd.filter((n, i) => Math.hypot(n.pos.x - p0[i][0], n.pos.z - p0[i][1]) > 1).length, p0);
const near = await ev(() => { const P = window.playzone.player.pos; return window.playzone.npcs.crowd.filter((n) => Math.hypot(n.pos.x - P.x, n.pos.z - P.z) < 80).length; });
check(crowd >= 20 && moved >= crowd * 0.5 && near >= 6, `foule : ${crowd} piétons, ${moved} en marche, ${near} autour du joueur dans la ville`);
const dogs = await ev(() => (window.playzone.animals?.list || []).filter((a) => a.species === 'chien').length);
check(dogs === 0, `aucun chien errant (${dogs})`);
await ev(() => { const g = window.playzone; g.cam.dist = 12; g.cam.pitch = 0.35; g.debugStep(0.3); });
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/fix-foule.png' });

// 2) sprint : l'endurance baisse en courant
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
await ev(() => { for (let i = 0; i < 40; i++) window.playzone.debugStep(0.1); });
const st = await ev(() => window.playzone.player.stamina);
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
check(st < 0.8, `sprint : endurance ${Math.round(st * 100)} %`);

// 3) téléphone tenu en main + PlayGram
await ev(() => window.playzone.phone.open('social')); await sleep(400);
check(await ev(() => window.playzone.player.onPhone && !!window.playzone.avatar.held), 'le personnage tient son téléphone');
await page.locator('.sg-compose textarea').fill('Première journée à PLAYZONE !');
await page.getByRole('button', { name: '📸 Photo' }).click(); await sleep(400);
await page.getByRole('button', { name: 'Publier' }).click(); await sleep(500);
const posts = await ev(() => window.playzone.profile.social?.posts || []);
check(posts.length === 1 && posts[0].photo?.startsWith('data:image/jpeg'), 'publication PlayGram avec photo');
await page.screenshot({ path: 'tests/e2e/out/fix-playgram.png' });
await ev(() => window.playzone.phone.close());
check(await ev(() => !window.playzone.player.onPhone), 'téléphone rangé');

// 4) admin : code à la mairie
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; const b = BUILDING_BY_ID.mairie; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has('mairie'); i++) g.debugStep(0.3); const d = g.interiors.loaded.get('mairie').inters.find((x) => /Guichet spécial/.test(x.label)); g.player.teleport(d.x, d.z, 0); g.debugStep(0.3); });
check(/Guichet spécial/.test(await ev(() => window.playzone.interactions.label()) || ''), 'guichet spécial à la mairie');
await page.keyboard.press('KeyE'); await sleep(400);
await page.locator('.modal input').fill('Timao3049Bausmayer'); await page.getByRole('button', { name: 'Valider' }).click(); await sleep(500);
let p = await ev(() => window.playzone.profile);
check(p.admin && p.coins >= 10_000_000, `admin : ${p.coins.toLocaleString('fr-FR')} PC`);
await ev(() => window.playzone.phone.open('admin')); await sleep(300);
await page.getByRole('button', { name: /Tout débloquer/ }).click(); await sleep(400);
p = await ev(() => window.playzone.profile);
check((p.inventory.couronne || 0) >= 1 && p.coins >= 10_000_000, 'tout débloqué, argent toujours au maximum');
await ev(() => window.playzone.phone.close());

// 5) prison : on arrive au sol, dans la salle commune ; évasion par tunnel
await ev(async () => { const g = window.playzone; await g.net.request('admin.lock', {}); await g.net.request('crime.report', { type: 'coups', witnessed: true }); const r = await g.net.request('police.arrest', {}); if (r.at) g.player.teleport(r.at.x, r.at.z, Math.PI); for (let i = 0; i < 20; i++) g.debugStep(0.1); });
const y = await ev(() => window.playzone.player.pos.y);
check(y < 1, `en prison au sol (y = ${y.toFixed(2)})`);
await ev(() => { const g = window.playzone; g.cam.dist = 7; g.debugStep(0.5); });
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/fix-prison.png' });
let escaped = false;
for (let k = 0; k < 12 && !escaped; k++) escaped = await ev(async () => { const g = window.playzone; g.profile.cooldowns['jail:escape'] = 0; try { return (await g.net.request('jail.escape', {})).escaped; } catch { return false; } });
check(escaped, 'évasion possible en creusant le tunnel en plusieurs fois');

// 6) police : prévenue par un témoin, arrive après un délai
await ev(async () => { const g = window.playzone; g.player.teleport(150, 8, 0); g.debugStep(0.5); });
check(await ev(() => window.playzone.police.units.length === 0), 'pas de police instantanée');

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
