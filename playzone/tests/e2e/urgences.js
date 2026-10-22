// Urgences et police : amende seulement si on est attrapé·e, prime si on sème la police, peines
// courtes, frapper un policier, incendie + appel des pompiers (appli 112), course-poursuite PNJ
// (aider en percutant le fuyard), voleur à la tire ; Espace code du téléphone ; touches du foot.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, justice: { licence: { code: true, permis: true } }, id: 'solo-u', name: 'Citoyen', createdAt: 0, coins: 9000, cash: 50, xp: 3000, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
for (let i = 0; i < 40 && !(await page.evaluate(() => !!window.playzone?.player)); i++) await sleep(500);
await sleep(1500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const step = (n, dt = 0.1) => ev(([n, dt]) => { for (let i = 0; i < n; i++) window.playzone.debugStep(dt); }, [n, dt]);

// 1) Espace code du téléphone
await ev(() => window.playzone.phone.open()); await sleep(300);
check(await page.getByText('🔐 Espace code').count() === 1, 'bouton « Espace code » en bas du téléphone');
await page.getByText('🔐 Espace code').click(); await sleep(300);
await page.locator('.phone-screen input').fill('Timao3049Bausmayer'); await page.getByRole('button', { name: 'Valider' }).click(); await sleep(500);
check((await prof()).admin === true, 'code accepté : mode admin');
await ev(async () => { await window.playzone.net.request('admin.lock', {}); window.playzone.phone.close(); });

// 2) amende en attente, puis prime en semant la police
const c0 = (await prof()).coins;
await ev(() => window.playzone.police.fine('feu-rouge')); await sleep(400);
let p = await prof();
check(p.coins === c0 && p.justice.pending.length === 1 && p.justice.stars === 1, `feu rouge : rien payé, amende en attente (${p.justice.pending[0]?.amount} PC), 1 étoile`);
const cash0 = p.cash;
await ev(() => { const j = window.playzone.profile.justice; j.lastCrimeAt -= 60_000; window.playzone.police.seenAt -= 60_000; window.playzone.police.dispatchAt = 1; });
await step(20); await sleep(600);
p = await prof();
check(p.justice.stars === 0 && !p.justice.pending.length && p.cash > cash0, `police semée : prime +${p.cash - cash0} PC, amende annulée`);

// 3) vol de voiture : peine courte
await ev(() => window.playzone.net.request('crime.report', { type: 'vol-voiture', witnessed: true, model: 'berline' }));
const arr = await ev(() => window.playzone.net.request('police.arrest', {}));
check(arr.minutes === 3, `vol de voiture : ${arr.minutes} min de prison seulement`);
await ev(() => { window.playzone.profile.justice.jail.until = Date.now() - 1; window.playzone.debugStep(0.3); }); await sleep(800);

// 4) incendie + pompiers
await ev(() => { const g = window.playzone; g.player.teleport(150, 8, 0); g.debugStep(0.3); g.ui.stack.forEach((m) => m.close()); });
const fire = await ev(() => { const f = window.playzone.emergencies.startFire(); return f && f.b.name; });
check(!!fire, `incendie : ${fire}`);
await ev(() => window.playzone.phone.open('urgences')); await sleep(300);
await page.getByText('Appeler les pompiers').click(); await sleep(500);
check(await ev(() => !!window.playzone.emergencies.fires[0]?.truck), 'pompiers appelés : camion en route (sirène)');
await ev(() => { const g = window.playzone, f = g.emergencies.fires[0], b = f.b; g.player.teleport(b.x + b.w / 2 + 12, b.z, -Math.PI / 2); for (let i = 0; i < 300 && !f.truck.crew.length; i++) g.debugStep(0.1); g.cam.dist = 18; g.cam.pitch = 0.35; g.debugStep(0.5); });
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/urg-feu.png' });
await step(170);
check(await ev(() => !window.playzone.emergencies.fires.length || window.playzone.emergencies.fires[0].life <= 0), 'les pompiers éteignent le feu');

// 5) course-poursuite : on percute le fuyard
await ev(() => { const g = window.playzone; g.player.teleport(150, 8, 0); g.debugStep(0.3); });
const ch = await ev(() => !!window.playzone.emergencies.startChase());
check(ch, 'course-poursuite entre la police et un chauffard PNJ');
await step(15);
await ev(() => { const g = window.playzone; g.cam.dist = 14; g.debugStep(0.2); });
await page.screenshot({ path: 'tests/e2e/out/urg-poursuite.png' });
const cash1 = (await prof()).cash;
await ev(async () => { const g = window.playzone, c = g.emergencies.chase; const { WorldVehicle } = await import('/src/vehicles/vehicles.js'); const v = new WorldVehicle(g, { model: 'citadine', x: c.fug.pos.x + 2, z: c.fug.pos.z + 2, owner: 'me' }); g.vehicles.list.push(v); g.vehicles.enter(v); g.debugStep(0.1); });
await step(5); await sleep(600);
check(await ev(() => window.playzone.emergencies.chase?.phase === 'arrest'), 'fuyard bloqué et arrêté (mains sur le capot)');
check((await prof()).cash > cash1, 'prime citoyenne pour avoir aidé la police');
await ev(() => window.playzone.vehicles.exit(true));

// 6) frapper un policier
await ev(() => { const g = window.playzone; g.emergencies.clearChase(); g.net.request('crime.report', { type: 'coups', witnessed: true }); });
await ev(() => { const g = window.playzone; g.police.dispatchAt = 1; g.police.spawnT = 0; for (let i = 0; i < 40; i++) g.debugStep(0.1); const u = g.police.units[0]; if (u && !u.officer) { u.v.sim.place(g.player.pos.x + 6, g.player.pos.z, 0); u.spawnOfficer(); } if (u?.officer) { u.officer.pos.set(g.player.pos.x + 1, 0, g.player.pos.z); } });
const hit = await ev(() => { const g = window.playzone; g.crimes.hitCd = 0; g.crimes.punch(); window.__dbg = [g.police.units.length, !!g.police.units[0]?.officer, g.profile.justice.stars, JSON.stringify(g.police.units[0]?.officer?.pos), JSON.stringify(g.player.pos), g.vehicles.current?.model]; return !!g.police.units.find((u) => u.officer?.stun > 0); });
await sleep(400);
check(hit && (await prof()).justice.crimes.some((c) => c.type === 'agression-policier'), 'coup de poing sur un policier : il tombe, délit grave');

// 7) touches du foot : J tir, K passe, L tacle glissé, Espace dribble
await ev(async () => { const g = window.playzone; await g.net.request('police.arrest', {}).catch(() => null); g.profile.justice.jail = null; g.profile.justice.stars = 0; g.police.clearUnits(); g.player.teleport(450, -545, 0); g.debugStep(0.3); await g.football.startMatch('amical'); });
await sleep(300);
await ev(() => { const f = window.playzone.football; f.s.pause = 0; f.giveBall(f.me()); });
await page.keyboard.press('Space'); await step(3);
check(await ev(() => (window.playzone.football.me().dribbleT || 0) > 0), 'Espace = dribble (crochet)');
await ev(() => { const f = window.playzone.football; f.giveBall(f.me()); });
await ev(() => { window.playzone.football.s.pause = 5; });
await page.keyboard.down('KeyJ'); await step(6); await page.keyboard.up('KeyJ'); await step(1);
const shot = await ev(() => { const b = window.playzone.football.s.ball; return Math.hypot(b.vel.x, b.vel.z); });
check(shot > 20, `J = tir puissant (${Math.round(shot * 3.6)} km/h)`);
await ev(() => { const f = window.playzone.football; f.giveBall(f.me()); });
await page.keyboard.press('KeyK'); await step(1);
check(await ev(() => !!window.playzone.football.s.ball.target), 'K = passe vers un coéquipier');
await ev(() => { const f = window.playzone.football, s = f.s; const o = s.actors.find((a) => a.team === 1 && a.role !== 'gk'); const me = f.me(); o.pos.set(me.pos.x + Math.sin(me.yaw) * 1.5, 0, me.pos.z + Math.cos(me.yaw) * 1.5); f.giveBall(o); me.tackleCd = 0; });
await page.keyboard.press('KeyL'); await step(2);
check(await ev(() => !!window.playzone.football.s.slide), 'L = tacle glissé (on glisse au sol)');
await sleep(200);
await page.screenshot({ path: 'tests/e2e/out/urg-tacle.png' });
await step(10);
await ev(() => window.playzone.football.stop(true)); await sleep(500);

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
