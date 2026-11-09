// Boîte de nuit : beaucoup de fêtardes, drague, carré VIP + service bouteilles (sans alcool) qui
// fait venir les filles à la table et les fait craquer, jusqu'à se mettre en couple.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-bo', name: 'Noctambule', createdAt: 0, coins: 20000, xp: 20000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=23&auto=solo&qualite=high', { timeout: 120000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const n = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['club-1'], g = window.playzone; g.player.teleport(b.x, b.z, 0); g.debugStep(2); const it = g.interiors.loaded.get(b.id); return it ? it.people.filter((p) => p.role === 'fetarde').length : -1; });
check(n >= 10, `beaucoup de fêtardes dans la boîte (${n})`);
await page.screenshot({ path: 'tests/e2e/out/boite-piste.png' });
// sans carré VIP : pas de bouteille
const noVip = await ev(() => window.playzone.net.request('club.bottle', { size: 'bulles', girls: [] }).then(() => false).catch(() => true));
check(noVip, 'bouteilles réservées au carré VIP');
const vip = await ev(() => window.playzone.net.request('club.do', { kind: 'vip' }));
check(vip.until > 0, 'carré VIP réservé (10 min)');
// service bouteilles (Jéroboam : 4 filles)
const r = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['club-1'], g = window.playzone; const it = g.interiors.loaded.get(b.id); const girls = it.people.filter((p) => p.role === 'fetarde').slice(0, 4).map((p) => `club:${b.id}:${p.name}`); return g.net.request('club.bottle', { size: 'jeroboam', girls }); });
check(Object.keys(r.affs).length === 4 && Object.values(r.affs).every((a) => a >= 25), `Jéroboam : 4 filles à la table, affection ${Object.values(r.affs).join(' / ')}`);
// l'UI : spot du service bouteilles et dialogue des filles
await ev(async () => { const { runAction } = await import('/src/interiors/actions.js'); const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); runAction(window.playzone, 'clubbottle', { b: BUILDING_BY_ID['club-1'] }); });
await sleep(400);
check(await ev(() => /Service bouteilles/.test(document.querySelector('.modal')?.textContent || '')), 'menu du service bouteilles');
await page.screenshot({ path: 'tests/e2e/out/boite-bouteilles.png' });
await ev(() => document.querySelector('.modal .close-x')?.click());
// drague jusqu'au couple (bouteilles répétées, cooldown ignoré en admin)
await ev(() => window.playzone.net.request('admin.unlock', { code: 'Timao3049Bausmayer' }));
const couple = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['club-1'], g = window.playzone; const it = g.interiors.loaded.get(b.id); const p = it.people.find((q) => q.role === 'fetarde'); const id = `club:${b.id}:${p.name}`; for (let k = 0; k < 3; k++) await g.net.request('club.bottle', { size: 'jeroboam', girls: [id] }); return g.net.request('love.ask', { id, name: p.name, role: 'Fêtarde' }); });
check(couple.yes, `elle est tombée amoureuse : en couple avec ${couple.partner?.name}`);
// Le Velours : méga-boîte, 10 carrés VIP, 100 filles, 10 garçons
const mega = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['club-vip'], g = window.playzone; g.player.teleport(b.x, b.z + 10, Math.PI); g.debugStep(1); let it = g.interiors.loaded.get(b.id); for (let k = 0; k < 10 && !it; k++) { g.debugStep(0.5); it = g.interiors.loaded.get(b.id); } if (!it) return null; const t0 = performance.now(); g.debugStep(1); const ms = (performance.now() - t0) / 30; const girls = it.people.filter((p) => p.role === 'fetarde'); return { girls: girls.length, boys: it.people.filter((p) => p.role === 'fetard').length, vip: [...document.querySelectorAll('.prompt')].length, longHair: true, ms, names: new Set(girls.map((p) => p.name)).size }; });
check(mega && mega.girls === 150 && mega.boys === 15 && mega.names === 150, `Le Velours : ${mega?.girls} filles (prénoms uniques : ${mega?.names}), ${mega?.boys} garçons, ${mega?.ms?.toFixed(1)} ms par image`);
const booths = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; return [...g.interactions.list].filter((d) => typeof d.label === 'string' && /Carré VIP n°/.test(d.label) && /réserver/.test(d.label)).length; });
check(booths === 10, `10 carrés VIP (${booths})`);
await ev(() => { const g = window.playzone; g.cam.pitch = 0.75; g.cam.dist = 22; g.debugStep(0.5); });
await page.screenshot({ path: 'tests/e2e/out/boite-velours.png' });
// show lumière, popularité, filles qui viennent te parler, danse avec une fille
const show = await ev(async () => { const g = window.playzone, S = g.clubShow; g.debugStep(0.5); const out = { on: !!S.root, lasers: S.lasers?.length, beams: S.beams?.length }; S.boost(60); S.approachT = 0; g.debugStep(0.2); g.debugStep(6); const it = g.interiors.loaded.get('club-vip'); const near = it.people.filter((p) => p.role === 'fetarde' && Math.hypot(p.x - g.player.pos.x, p.z - g.player.pos.z) < 2.2).length; return { ...out, near, pop: Math.round(S.pop) }; });
check(show.on && show.lasers >= 10 && show.beams >= 10, `show : ${show.lasers} lasers, ${show.beams} lyres, écran LED`);
check(show.near >= 1, `popularité ${show.pop} : une fille est venue te parler (${show.near} à côté de toi)`);
const dance = await ev(async () => { const g = window.playzone, it = g.interiors.loaded.get('club-vip'), p = it.people.find((q) => q.role === 'fetarde'); return g.net.request('club.girl', { id: `club:club-vip:${p.name}`, kind: 'dance' }); });
check(dance.aff > 0, `danser avec elle : affection ${dance.aff}`);
await ev(() => { const g = window.playzone; g.cam.pitch = 0.35; g.cam.dist = 14; g.clubShow.drop = 1.2; g.debugStep(0.1); });
await page.screenshot({ path: 'tests/e2e/out/boite-show.png' });
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'BOITE OK' : 'BOITE ÉCHEC');
process.exit(ok ? 0 : 1);
