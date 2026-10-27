// Carte plus équipée : nouveaux commerces et maisons, parcs (banc, balançoire, toboggan, basket, fontaine,
// glace), zoo (animaux dans leurs enclos), musée (œuvres à admirer).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-p', name: 'Promeneur', createdAt: 0, coins: 5000, xp: 60000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=11&auto=solo&qualite=low', { timeout: 90000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const step = (s) => ev(([s]) => window.playzone.debugStep(s), [s]);
const tp = (x, z, yaw = 0) => ev(([x, z, yaw]) => { const g = window.playzone; g.player.teleport(x, z, yaw); g.debugStep(0.5); }, [x, z, yaw]);
const near = (re) => ev(([re]) => { const g = window.playzone; const P = g.player.pos; const it = [...g.interactions.list].filter((d) => new RegExp(re).test(typeof d.label === 'function' ? d.label() : d.label)).map((d) => ({ d, x: typeof d.x === 'function' ? d.x() : d.x, z: typeof d.z === 'function' ? d.z() : d.z })).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0]; if (!it) return null; g.player.teleport(it.x, it.z, g.player.yaw); g.debugStep(0.2); it.d.action(); return true; }, [re]);
const shot = async (name, cam) => { await ev(([c]) => { const g = window.playzone; Object.assign(g.cam, c); g.debugStep(0.6); }, [cam]); await sleep(700); await page.screenshot({ path: `tests/e2e/out/parcs-${name}.png` }); };
const prof = () => ev(() => window.playzone.profile);

const n = await ev(async () => { const { BUILDINGS } = await import('/shared/world-layout.js'); return BUILDINGS.filter((b) => /^plus-/.test(b.id)).length; });
check(n >= 50, `${n} nouveaux bâtiments dans les quartiers vides`);
// parc avec aire de jeux
await tp(520, -200);
const c0 = (await prof()).coins;
check(await near('glace'), '🍦 glace au kiosque'); await sleep(400);
check((await prof()).coins === c0 - 4, 'la glace coûte 4 PC');
check(await near('balançoire'), '🎠 balançoire'); await sleep(400);
for (let i = 0; i < 5; i++) await step(0.2);
check(await ev(() => !!window.playzone.player.seated?.swing), 'on se balance');
await shot('jeux', { yaw: 0.8, dist: 14, pitch: 0.4 });
await page.keyboard.down('KeyW'); await step(0.4); await page.keyboard.up('KeyW');
check(await near('toboggan'), '🛝 toboggan'); await sleep(1600);
check(await near('asseoir sur le banc'), '🪑 banc'); await step(0.3);
check(await ev(() => !!window.playzone.player.seated), 'assis sur le banc');
// basket et fontaine
await tp(100, -500);
check(await near('panier'), '🏀 tir au panier'); await sleep(1500);
await shot('basket', { yaw: 1.2, dist: 14, pitch: 0.35 });
await tp(-60, -1380);
check(await near('fontaine'), '🪙 vœu à la fontaine'); await sleep(400);
await shot('fontaine', { yaw: 0.5, dist: 16, pitch: 0.4 });
// zoo
await tp(30, -1140, Math.PI / 2);
await step(1);
const zoo = await ev(() => { const g = window.playzone; const by = {}; for (const a of g.animals.list) if (['lion', 'elephant', 'girafe', 'zebre', 'singe', 'pingouin'].includes(a.species)) by[a.species] = (by[a.species] || 0) + 1; return by; });
check(Object.keys(zoo).length === 6, `animaux du zoo : ${JSON.stringify(zoo)}`);
check(await near('Savane des lions'), '🔎 observer les lions'); await sleep(400);
await page.keyboard.press('Escape');
await tp(49, -1146, Math.PI);
await shot('zoo-lions', { yaw: 0, dist: 12, pitch: 0.35 });
await tp(140, -1146, Math.PI);
await shot('zoo-girafes', { yaw: 0.2, dist: 16, pitch: 0.25 });
const lions = await ev(() => window.playzone.animals.list.filter((a) => a.species === 'lion').every((a) => a.pos.x > 30 && a.pos.x < 68 && a.pos.z > -1190 && a.pos.z < -1150));
check(lions, 'les lions restent dans leur enclos');
// musée
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID.musee; const g = window.playzone; g.player.teleport(b.x, b.z, 0); g.debugStep(1.2); });
const art = await ev(() => { const g = window.playzone; const it = g.interiors.loaded.get('musee'); const s = it && [...it.inters].find((i) => /Rigolosaurus/.test(typeof i.label === 'function' ? i.label() : i.label)); if (!s) return null; g.player.teleport(typeof s.x === 'function' ? s.x() : s.x, typeof s.z === 'function' ? s.z() : s.z, Math.PI); g.debugStep(0.3); s.action(); return true; });
check(art, '🦖 musée : admirer le dinosaure'); await sleep(500);
check(((await prof()).discovered || []).includes('art:dino'), 'œuvre découverte');
await shot('musee', { yaw: 0.6, dist: 7, pitch: 0.3 });
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'PARCS OK' : 'PARCS ÉCHEC');
process.exit(ok ? 0 : 1);
