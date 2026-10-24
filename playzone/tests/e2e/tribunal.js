// Justice : plaidoirie écrite à l'interpellation (la peine baisse), crime grave → audience au Palais de
// Justice devant trois juges, plaidoirie devant la cour, verdict, prison (le temps hors ligne compte au tiers).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-t', name: 'Accusé', createdAt: 0, coins: 20000, cash: 150, xp: 3000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
await page.waitForFunction(() => window.playzone?.player, null, { timeout: 90000 });
await sleep(3000);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const write = async (text) => { await page.locator('.ask textarea').waitFor({ timeout: 5000 }); await page.locator('.ask textarea').fill(text); await page.locator('.ask .panel-foot .btn').last().click(); await sleep(700); };

// 1) délit simple : plaidoirie auprès de l'agent
await ev(() => window.playzone.police.crime('coups', true));
await ev(() => window.playzone.police.crime('vol-voiture', true));
await sleep(300);
await ev(() => { window.playzone.police.arrestMe('Interpellé·e !'); });
await page.getByText(/Plaider ta cause/).waitFor({ timeout: 8000 });
check(/5 minutes/.test(await page.locator('.dialog-box').textContent()), 'risque : 5 minutes');
await page.getByText(/Plaider ta cause/).click();
await write('Je suis désolé monsieur l\'agent, il m\'a agressé et menacé, je devais me défendre. Je rembourserai les dégâts.');
const txt1 = await page.locator('.dialog-box').textContent();
check(/défense|menacé|regrett|réparer|excuser/i.test(txt1), `l'agent répond à mes arguments : ${txt1.slice(0, 140)}...`);
await page.screenshot({ path: 'tests/e2e/out/trib-plaidoirie.png' });
await page.getByText(/Suivre l'agent/).click();
await sleep(900);
let p = await prof();
check(p.justice.jail && p.justice.jail.minutes < 5, `peine réduite : ${p.justice.jail?.minutes} min au lieu de 5`);
await page.locator('.dialog-box button').first().click().catch(() => {});
await ev(() => { window.playzone.profile.justice.jail.until = Date.now() - 1000; window.playzone.debugStep(0.5); });
await sleep(900);
check(!(await prof()).justice.jail, 'libéré·e');

// 2) crime grave : tribunal
await ev(async () => { const g = window.playzone; await g.police.crime('vol-voiture', true); await g.police.crime('vol-voiture', true); await g.police.crime('agression-policier', true); });
await sleep(300);
await ev(() => { window.playzone.police.arrestMe('Arrêté·e après une course-poursuite !'); });
await page.getByText(/Être présenté·e au juge/).waitFor({ timeout: 8000 });
await page.getByText(/Être présenté·e au juge/).click();
await page.getByText(/Plaider devant la cour/).waitFor({ timeout: 8000 });
const inCourt = await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone, b = BUILDING_BY_ID.tribunal; for (let i = 0; i < 30 && !g.interiors.loaded.has(b.id); i++) g.debugStep(0.3); return { d: Math.hypot(g.player.pos.x - b.x, g.player.pos.z - b.z), judges: (g.interiors.loaded.get(b.id)?.people || []).filter((s) => s.role === 'juge').length, court: !!g.profile.justice.court }; });
check(inCourt.d < 3 && inCourt.court, 'au Palais de Justice, dans le box des accusé·es');
check(inCourt.judges === 3, `trois juges à l'estrade (${inCourt.judges})`);
await ev(() => { const g = window.playzone; g.cam.yaw = Math.PI; g.cam.dist = 7; g.cam.pitch = 0.35; g.debugStep(0.3); });
await sleep(900);
await page.screenshot({ path: 'tests/e2e/out/trib-audience.png' });
check(/Avocat .*×2/.test(await page.locator('.dialog-box').textContent()), 'avocat proposé au tarif tribunal (×2)');
const before = Number((await page.locator('.dialog-box').textContent()).match(/requiert (\d+(?:\.\d)?)/)?.[1]);
await page.getByText(/Plaider devant la cour/).click();
await write('Je plaide coupable et je regrette sincèrement. Ma mère était malade, je devais l\'emmener à l\'hôpital en urgence. Pardon.');
const txt2 = await page.locator('.dialog-box').textContent();
const after = Number(txt2.match(/envisagée : (\d+(?:\.\d)?)/)?.[1]);
check(after < before, `la cour réduit la peine : ${before} → ${after} min`);
await page.getByText(/Entendre le verdict/).click();
await sleep(1000);
p = await prof();
check(p.justice.jail?.court && p.justice.jail.minutes === after, `verdict : ${p.justice.jail?.minutes} min de prison`);
check(/délibéré/.test(await page.locator('.dialog-box').textContent()), 'verdict lu par la présidente');
await page.locator('.dialog-box button').first().click().catch(() => {});
check(await ev(async () => { const { inPrison } = await import('/shared/authority-justice.js'); return inPrison(window.playzone.player.pos); }), 'conduit·e en prison');
// 3) hors ligne : le temps compte au tiers
const off = await ev(async () => { const g = window.playzone, jl = g.profile.justice.jail; const u0 = jl.until; jl.lastSeen = Date.now() - 31 * 60_000; await g.net.request('jail.tick', {}); return (g.profile.justice.jail.until - u0) / 60_000; });
check(Math.abs(off - 20) < 0.6, `30 min hors ligne ne comptent que pour 10 (peine allongée de ${off.toFixed(1)} min)`);

console.log(ok ? 'OK' : 'ÉCHEC');
const errs = errors.filter((e) => !/status of 404|AudioContext/.test(e));
console.log(errs.length ? errs.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
