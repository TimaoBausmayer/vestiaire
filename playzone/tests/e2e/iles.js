// Îles : navette depuis le ponton, arrivée sur l'île (terre ferme), merveilles à admirer (récompense),
// cascade des Géants, champ de lavande ; captures de chaque lieu.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-i', name: 'Explo', createdAt: 0, coins: 5000, xp: 60000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=17&auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
const req = (type, payload) => ev(([t, p]) => window.playzone.net.request(t, p).then((r) => ({ ok: true, r }), (e) => ({ ok: false, e: e.message })), [type, payload]);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const step = (s) => ev(([s]) => window.playzone.debugStep(s), [s]);
const tp = (x, z, yaw = 0) => ev(([x, z, yaw]) => { const g = window.playzone; g.player.teleport(x, z, yaw); g.debugStep(0.4); }, [x, z, yaw]);
const shot = async (name, cam) => { await ev(([c]) => { const g = window.playzone; Object.assign(g.cam, c); g.debugStep(0.6); }, [cam]); await sleep(700); await page.screenshot({ path: `tests/e2e/out/iles-${name}.png` }); };

// navette depuis le ponton
await tp(52, 116, Math.PI);
let r = await req('ferry.go', { to: 'phare' });
check(r.ok && r.r.cost === 60, `navette vers l'Île du Phare (${r.e || r.r.cost + ' PC'})`);
await ev(([d]) => { const g = window.playzone; g.player.teleport(d.x, d.z, d.yaw); g.debugStep(1); }, [r.r]);
const st = await ev(() => { const g = window.playzone, P = g.player; return { y: P.pos.y, swim: P.swimming, here: g.islands.here?.name }; });
check(!st.swim && st.y > 0.2 && st.here === 'Île du Phare', `sur l'île, au sec (${JSON.stringify(st)})`);
r = await req('ferry.go', { to: 'volcan' });
check(r.ok, 'depuis le ponton de l\'île, navette vers une autre île');
await tp(760, 225);
r = await req('ferry.go', { to: 'tortue' });
check(!r.ok, `pas de navette hors d'un ponton (${r.e})`);

// merveilles
await tp(768, 228, Math.PI);
r = await req('sight.visit', { id: 'phare' });
check(r.ok && r.r.first && r.r.coins === 200, `📸 sommet du phare découvert (+${r.r?.coins} PC)`);
await shot('phare', { yaw: 0.6, dist: 18, pitch: 0.25 });
r = await req('sight.visit', { id: 'phare' });
check(r.ok && !r.r.first, 'deuxième visite : pas de double récompense');
r = await req('sight.visit', { id: 'cratere' });
check(!r.ok, 'il faut être sur place pour admirer');
for (const [id, x, z, cam] of [['cratere', 1500, 352, { yaw: 2.6, dist: 22, pitch: 0.45 }], ['arche-coeur', 230, 249, { yaw: 3.1, dist: 10, pitch: 0.2 }], ['plage-secrete', -150, 238, { yaw: 0.4, dist: 16, pitch: 0.3 }], ['cascade-tortue', -1300, 345, { yaw: 3.14, dist: 14, pitch: 0.2 }], ['cascade-geants', 0, -2948, { yaw: 0, dist: 24, pitch: 0.2 }], ['lavande', -1200, -470, { yaw: 0, dist: 30, pitch: 0.35 }]]) {
  await tp(x, z, Math.PI);
  r = await req('sight.visit', { id });
  check(r.ok && r.r.first, `📸 ${id} découvert (${r.e || r.r.found + '/8'})`);
  await shot(id, cam);
}
await tp(52, 122, Math.PI);
r = await req('sight.visit', { id: 'ponton' });
check(r.ok && r.r.all && r.r.bonus === 3000, `les 8 merveilles : bonus explorateur (${JSON.stringify(r.r || r.e)})`);
// vue d'ensemble : îles au large depuis la plage
await tp(40, 80, Math.PI);
await shot('large', { yaw: Math.PI, dist: 30, pitch: 0.35 });
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'ILES OK' : 'ILES ÉCHEC');
process.exit(ok ? 0 : 1);
