// Les habitants réagissent à ce qu'on leur écrit : barre « Parler » (Entrée), « suis-moi » → il suit,
// « danse » → il danse, « assieds-toi » → il s'assoit, insulte → il se fâche / s'en va.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-n', name: 'Chef', createdAt: 0, coins: 500, xp: 300, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=14&auto=solo&qualite=medium');
await page.waitForFunction(() => window.playzone?.player, null, { timeout: 90000 });
await sleep(3000);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const step = (n, dt = 0.1) => ev(([n, dt]) => { for (let i = 0; i < n; i++) window.playzone.debugStep(dt); }, [n, dt]);
const say = async (t) => { await page.keyboard.press('Enter'); await sleep(150); await page.locator('.speak-bar input').fill(t); await page.locator('.speak-bar input').press('Enter'); await sleep(200); };

// un passant tout près
const name = await ev(() => { const g = window.playzone; const n = g.npcs.list.find((x) => x.def.kind === 'crowd' && x.avatar.root.visible && !x.home); window.__n = n; g.player.teleport(n.pos.x + 2, n.pos.z, -Math.PI / 2); g.debugStep(0.1); return n.def.name; });
const N = () => ev(() => { const n = window.__n, P = window.playzone.player.pos; return { cmd: n.cmd?.type || null, d: Math.hypot(n.pos.x - P.x, n.pos.z - P.z) }; });
// 1) suis-moi : il suit le joueur
await say('Suis-moi !');
check((await N()).cmd === 'follow', `${name} : « suis-moi » → il me suit`);
await ev(() => { const g = window.playzone; for (let i = 0; i < 60; i++) { g.player.pos.x += 0.25; g.debugStep(0.05); } });
await step(40);
const f = await N();
check(f.d < 5, `toujours derrière moi après 15 m de marche (${f.d.toFixed(1)} m)`);
await ev(() => { const g = window.playzone, n = window.__n; g.cam.yaw = Math.atan2(g.player.pos.x - n.pos.x, g.player.pos.z - n.pos.z) + 2.6; g.cam.dist = 7; g.cam.pitch = 0.25; g.debugStep(0.1); });
await sleep(800);
await page.screenshot({ path: 'tests/e2e/out/pnj-suit.png' });
// 2) danse
await say('Allez, danse !');
check((await N()).cmd === 'dance', 'danse → il danse');
await step(10);
await page.screenshot({ path: 'tests/e2e/out/pnj-danse.png' });
// 3) dans la discussion : assieds-toi
await ev(() => window.playzone.npcs.talk(window.__n));
await page.getByText('⌨️ Écrire').click();
await page.locator('.dlg-input').fill('Assieds-toi un peu');
await page.locator('.dlg-input').press('Enter'); await sleep(300);
check((await N()).cmd === 'sit', 'dans la discussion, « assieds-toi » → il s\'assoit');
// 4) insulte : il se fâche ou part, puis refuse les demandes
await say('espèce d\'idiot');
const ins = await N();
check(['angry', 'leave'].includes(ins.cmd), `insulte → ${ins.cmd === 'angry' ? 'il se fâche' : 'il s\'en va'}`);
await say('espèce de crétin'); await step(5);
await say('suis-moi');
check((await N()).cmd === 'refuse', 'vexé : il refuse de me suivre');
// 5) dégage
await say('Dégage !');
const d0 = (await N()).d;
await step(60);
check((await N()).d > d0 + 5, 'dégage → il s\'éloigne');

console.log(ok ? 'OK' : 'ÉCHEC');
const errs = errors.filter((e) => !/status of 404|AudioContext/.test(e));
console.log(errs.length ? errs.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
