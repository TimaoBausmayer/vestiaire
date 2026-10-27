// Boîtes de nuit (danse en rythme, cocktail, VIP, DJ, ambiance) et salles de sport très équipées.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-n', name: 'Fêtard', createdAt: 0, coins: 5000, xp: 60000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=23&auto=solo&qualite=low', { timeout: 90000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const step = (s) => ev(([s]) => window.playzone.debugStep(s), [s]);
const prof = () => ev(() => window.playzone.profile);
const enter = (id) => ev(async ([id]) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID[id]; const g = window.playzone; g.player.teleport(b.x, b.z, 0); g.debugStep(1.2); return g.interiors.inside?.id; }, [id]);
const spot = (id, re) => ev(([id, re]) => { const g = window.playzone; const it = g.interiors.loaded.get(id); const s = it && [...it.inters].find((i) => new RegExp(re).test(typeof i.label === 'function' ? i.label() : i.label)); if (!s) return null; g.player.teleport(typeof s.x === 'function' ? s.x() : s.x, typeof s.z === 'function' ? s.z() : s.z, g.player.yaw); g.debugStep(0.2); s.action(); return true; }, [id, re]);
const labels = (id) => ev(([id]) => [...(window.playzone.interiors.loaded.get(id)?.inters || [])].map((i) => (typeof i.label === 'function' ? i.label() : i.label)).join(' | '), [id]);

// boîte de nuit
check(await enter('club-1') === 'club-1', 'dans la boîte de nuit « Le Bounce »');
await step(0.5);
check(await ev(() => !!window.playzone.nightclub.inClub && !!window.playzone.nightclub.fx), 'musique et lumières allumées');
const c0 = (await prof()).coins;
check(await spot('club-1', 'cocktail'), '🍹 cocktail'); await sleep(400);
check((await prof()).coins === c0 - 12, 'cocktail : 12 PC');
check(await spot('club-1', 'DJ'), '🎧 DJ'); await sleep(300);
check(await spot('club-1', 'Danser'), '💃 danse lancée');
// on tape pile dans le tempo
const { lead, period } = await ev(async () => (await import('/src/leisure/nightclub-beat.js')).BEAT);
for (let i = 0; i < 24; i++) await ev(([i, lead, period]) => { const nc = window.playzone.nightclub; if (!nc.d) return; nc.d.t = lead + i * period + 0.02; nc.tap(); }, [i, lead, period]);
await ev(([e]) => { const nc = window.playzone.nightclub; if (nc.d) nc.d.t = e; }, [lead + period * 24 + 0.1]);
await step(1); await sleep(600);
const p = await prof();
check(p.stats.danceBest >= 20, `score de danse ${p.stats.danceBest}`);
await page.screenshot({ path: 'tests/e2e/out/nuit-club.png' });
check(await spot('club-1', 'VIP'), '🍾 carré VIP'); await sleep(400);
check((await prof()).stats.vip === 1, 'VIP réservé');
// sortie : ambiance coupée
await ev(() => { const g = window.playzone; g.player.teleport(g.player.pos.x + 60, g.player.pos.z, 0); g.debugStep(1); });
check(await ev(() => !window.playzone.nightclub.inClub), 'en sortant, la fête s\'arrête');

// salle de sport très équipée
await enter('gym-1');
await step(0.5);
const L = await labels('gym-1');
const want = ['Rameur', 'elliptique', 'Presse', 'traction', 'Haltères', 'Kettlebell', 'Cordes', 'abdos', 'zumba', 'yoga', 'Sauna'];
check(want.every((w) => L.includes(w)), `équipements : ${want.filter((w) => !L.includes(w)).join(', ') || 'tous présents'}`);
await ev(() => window.playzone.net.request('gym.pass', { kind: 'jour' }).catch(() => null));
for (const [re, pose] of [['Rameur', 'row'], ['traction', 'pullup'], ['zumba', 'dance'], ['Sauna', 'sit']]) {
  await spot('gym-1', re); await sleep(400); await step(0.4);
  const s = await ev(() => { const P = window.playzone.player; return P.seated && { pose: P.seated.pose, machine: P.seated.machine }; });
  check(s?.pose === pose, `${re} : posture ${s?.pose}`);
  if (re === 'traction') await page.screenshot({ path: 'tests/e2e/out/nuit-gym.png' });
  await page.keyboard.down('KeyW'); await step(0.3); await page.keyboard.up('KeyW'); await sleep(500);
}
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'NUIT OK' : 'NUIT ÉCHEC');
process.exit(ok ? 0 : 1);
