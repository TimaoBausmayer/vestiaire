// Clubs (4 par sport, réputations) et nouveaux stades d'athlétisme.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-cl', name: 'Licencié', createdAt: 0, coins: 20000, xp: 20000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=11&auto=solo&qualite=high', { timeout: 120000 });
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const n = await ev(async () => { const { SPORT_CLUBS } = await import('/shared/clubs.js'); return Object.entries(SPORT_CLUBS).map(([k, l]) => [k, l.length, [...new Set(l.map((c) => c.stars))].length]); });
check(n.length >= 12 && n.every(([, c, s]) => c >= 4 && s >= 3), `${n.length} sports, 4 clubs ou plus chacun, réputations variées`);
// petit club gratuit : OK ; grand club : division exigée
const j1 = await ev(() => window.playzone.net.request('club.join', { sport: 'foot', club: 'mouettes' }).catch((e) => ({ err: e.message })));
check(j1.club && !j1.fee, `club de foot ★ rejoint gratuitement (${j1.club})`);
const j5 = await ev(() => window.playzone.net.request('club.join', { sport: 'foot', club: 'crampons' }).catch((e) => ({ err: e.message })));
check(!!j5.err && /division/.test(j5.err), `grand club refusé sans division : « ${j5.err} »`);
await ev(() => { const p = window.playzone.profile; p.career = p.career || {}; p.career.foot = { pts: 500 }; });
const j5b = await ev(() => window.playzone.net.request('club.join', { sport: 'foot', club: 'crampons' }).catch((e) => ({ err: e.message })));
check(j5b.club && j5b.fee === 900, `en division Pro : FC Crampons rejoint (cotisation ${j5b.fee} PC)`);
const mult = await ev(async () => { const { prizeMult } = await import('/shared/career.js'); return prizeMult(window.playzone.profile, 'foot'); });
check(mult >= 3, `primes multipliées (division × club) : ×${mult}`);
// Appli Sport : section clubs + sélecteur
const txt = await ev(() => { const d = document.createElement('div'); window.playzone.phone.app_sport(d); return d.textContent; });
check(/Mes clubs/.test(txt) && /FC Crampons/.test(txt), 'Appli Sport : section Mes clubs');
// nouveaux stades d'athlétisme : meeting depuis le Stade de l'Est
const st = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['athle-est']; const g = window.playzone; g.player.teleport(b.door.x, b.door.z, 0); g.debugStep(1); await g.races.start('course', 'est-meeting'); await new Promise((r) => setTimeout(r, 600)); const s = g.races.s; return s ? { route: s.route.name, npcs: s.npcs.length, d: Math.hypot(g.player.pos.x - 920, g.player.pos.z + 440) } : null; });
check(st && st.npcs === 8 && st.d < 50, `meeting du Stade de l'Est lancé (${st?.route}, ${st?.npcs} PNJ)`);
await sleep(1200);
await page.screenshot({ path: 'tests/e2e/out/clubs-stade-est.png' });
await ev(() => window.playzone.races.finish(true));
const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'CLUBS OK' : 'CLUBS ÉCHEC');
process.exit(ok ? 0 : 1);
