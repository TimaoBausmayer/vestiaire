// Amour : compliments, cadeau, rendez-vous, se mettre en couple, câlin, l'amoureux·se qui nous suit.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-a', name: 'Charmeur', createdAt: 0, coins: 50000, xp: 60000, rep: 0, appearance: {}, inventory: { bouquet: 2 } })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=low');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const step = (s) => ev(([s]) => window.playzone.debugStep(s), [s]);
await ev(() => window.playzone.net.request('admin.unlock', { code: 'Timao3049Bausmayer' }));   // admin : les compliments marchent toujours
// on va parler au premier habitant
const who = await ev(() => { const g = window.playzone; const n = g.npcs.list.find((x) => x.def.id === 'gerard') || g.npcs.list[0]; g.player.teleport(n.pos.x + 1.5, n.pos.z, 0); g.debugStep(0.2); g.npcs.talk(n); return { id: n.def.id || n.def.name, name: n.def.name }; });
await sleep(300);
const click = async (re) => { const b = page.locator('.dialog-box button', { hasText: re }).first(); if (!(await b.count())) return false; await b.click(); await sleep(350); return true; };
const flirt = () => click(/compliment/);
check(await flirt(), `« Faire un compliment » à ${who.name}`);
let txt = await page.locator('.dialog-box p').innerText();
check(/Affection/.test(txt), `réponse + affection (${txt.replace(/\n/g, ' ')})`);
const aff = () => ev(([id]) => window.playzone.profile.love?.aff?.[id] || 0, [who.id]);
const a1 = await aff();
check(a1 > 0, `l'affection monte (${a1})`);
// cadeau
check(await click(/Offrir un cadeau/), 'menu cadeau');
check(await click(/Bouquet/), 'offrir le bouquet');
const a2 = await aff();
check(a2 >= a1 + 10, `+10 avec le bouquet (${a1} → ${a2})`);
// compliments jusqu'au couple (admin : pas de pause)
for (let i = 0; i < 12 && (await aff()) < 72; i++) await ev(([id, name]) => window.playzone.net.request('love.flirt', { id, name }), [who.id, who.name]);
// dialogue rouvert pour voir les nouveaux choix
await page.keyboard.press('Escape');
const a3 = await aff();
console.log('affection après compliments', a3);
await ev(() => { const g = window.playzone; const n = g.npcs.list.find((x) => (x.def.id || x.def.name) === 'gerard') || g.npcs.list[0]; g.npcs.talk(n); });
await sleep(300);
check(a3 >= 72, `affection ${a3} après les compliments`);
{
  check(await click(/rendez-vous/), 'proposer un rendez-vous');
  check(await click(/café/), 'un café en terrasse');
  txt = await page.locator('.dialog-box p').innerText();
  check(/Affection/.test(txt), `rendez-vous réussi (${txt.replace(/\n/g, ' ')})`);
}
const a4 = await aff();
check(await click(/sortir ensemble/), 'demander de sortir ensemble');
const part = await ev(() => window.playzone.profile.love?.partner);
check(part?.name === who.name, `en couple avec ${part?.name}`);
check(await click(/câlin/), 'faire un câlin');
check(await click(/Viens avec moi/), '« Viens avec moi »');
await ev(() => { const g = window.playzone; g.player.teleport(g.player.pos.x + 12, g.player.pos.z, Math.PI / 2); });
for (let i = 0; i < 10; i++) await step(0.4);
const dist = await ev(() => { const g = window.playzone; const n = g.npcs.list.find((x) => (x.def.id || x.def.name) === 'gerard'); return Math.hypot(n.pos.x - g.player.pos.x, n.pos.z - g.player.pos.z); });
check(dist < 4, `l'amoureux·se nous suit (${dist.toFixed(1)} m)`);
const L = await ev(() => window.playzone.profile.love);
console.log('état amour', JSON.stringify({ aff: L.aff, partner: L.partner, dates: L.dates }));
check(L.dates >= 0, 'état amour enregistré dans le profil');
await page.screenshot({ path: 'tests/e2e/out/amour.png' });
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'AMOUR OK' : 'AMOUR ÉCHEC');
process.exit(ok ? 0 : 1);
