// Demander le numéro (presque toujours oui) + appli Contacts : SMS, appel, « rejoins-moi ».
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-ct', name: 'Charmeur', createdAt: 0, coins: 500, xp: 2000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=15&auto=solo', { timeout: 120000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
// on demande le numéro à 10 habitants différents : presque tous disent oui
const r = await ev(async () => {
  const g = window.playzone; let yes = 0;
  const people = g.npcs.list.filter((n) => !n.def.crowd).slice(0, 10);
  for (const n of people) { const x = await g.net.request('love.number', { id: n.def.id || n.def.name, name: n.def.name, role: n.def.role }); if (x.yes) yes++; }
  return { yes, of: people.length, contacts: Object.keys(g.profile.love.contacts || {}).length };
});
check(r.yes >= 7, `numéro donné facilement (${r.yes}/${r.of} oui)`);
check(r.contacts === r.yes, `${r.contacts} contacts enregistrés`);
// dans le dialogue : bouton « Demander son numéro »
const label = await ev(async () => { const { loveChoices } = await import('/src/characters/romance-ui.js'); const g = window.playzone; const n = g.npcs.list.filter((x) => !x.def.crowd)[12]; return loveChoices(g, n, () => [])[0].label; });
check(/numéro/.test(label), `bouton dans le dialogue : « ${label} »`);
// appli Contacts
await ev(() => window.playzone.phone.open('contacts'));
await sleep(500);
check(await ev(() => document.querySelectorAll('.phone-screen .list-item').length >= 7), 'appli Contacts : la liste des numéros');
await page.screenshot({ path: 'tests/e2e/out/contacts.png' });
const id = await ev(() => Object.keys(window.playzone.profile.love.contacts)[0]);
const a0 = await ev((id) => window.playzone.profile.love.aff[id], id);
await ev(() => [...document.querySelectorAll('.phone-screen .list-item')][0].querySelector('button').click());
await sleep(2500);
await ev(() => [...document.querySelectorAll('.phone-screen .list-item')][0].querySelectorAll('button')[1].click());
await sleep(800);
const a1 = await ev((id) => window.playzone.profile.love.aff[id], id);
check(a1 > a0, `SMS + appel : affection ${a0} → ${a1}`);
await ev(() => [...document.querySelectorAll('.phone-screen .list-item')][0].querySelectorAll('button')[2].click());
await sleep(800);
check(await ev((id) => { const n = window.playzone.npcs.list.find((x) => (x.def.id || x.def.name) === id); const P = window.playzone.player.pos; return n && n.cmd?.type === 'follow' && Math.hypot(n.pos.x - P.x, n.pos.z - P.z) < 12; }, id), '« Rejoins-moi » : elle arrive et te suit');
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'CONTACTS OK' : 'CONTACTS ÉCHEC');
process.exit(ok ? 0 : 1);
