// Loisirs et calendrier : agenda du téléphone, panneau d'affichage en ville, casino (accueil et limite,
// machine à sous, roulette, blackjack, vidéo poker), stand de tir à la première personne, tournoi.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, justice: { licence: { code: true, permis: true } }, id: 'solo-l', name: 'Flambeur', createdAt: 0, coins: 30000, xp: 2000, rep: 0, appearance: {}, body: { age: 30 } })));
await page.goto(url + 'index.html?heure=20&auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const inside = (id) => ev(async ([id]) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID[id]; const g = window.playzone; g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has(id); i++) g.debugStep(0.3); g.debugStep(0.3); }, [id]);
const spotIn = (bid, re) => ev(([bid, re]) => { const g = window.playzone; const it = g.interiors.loaded.get(bid); for (const d of it.inters) { const l = typeof d.label === 'function' ? d.label() : d.label; if (new RegExp(re).test(l)) { g.player.teleport(d.x, d.z, g.player.yaw); g.debugStep(0.25); return l; } } return null; }, [bid, re]);
const closeAll = () => ev(() => { const g = window.playzone; for (const m of [...g.ui.stack]) m.close(); g.phone?.close?.(); });

// 1) agenda + panneau d'affichage
await ev(() => { const g = window.playzone; g.player.teleport(9, -12.5, Math.PI); g.debugStep(0.4); });
check(/Panneau des événements/.test(await ev(() => window.playzone.interactions.label()) || ''), 'panneau des événements sur la Grande Place');
await page.keyboard.press('KeyE'); await sleep(500);
const agenda = await page.locator('.phone-screen').textContent();
check(/Concours de tir du soir|Tournoi|Soirée DJ|Pluie de poulets|Rodéo/.test(agenda), 'agenda : événements datés listés');
await page.screenshot({ path: 'tests/e2e/out/lei-agenda.png' });
await ev(() => window.playzone.phone.close());

// 2) casino : accueil, limite, machine à sous, roulette, blackjack, vidéo poker
await inside('casino');
await ev(() => { const g = window.playzone; g.cam.dist = 14; g.cam.pitch = 0.9; g.debugStep(0.5); });
await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/lei-casino.png' });
check(/Accueil/.test(await spotIn('casino', 'Accueil') || ''), 'accueil du casino');
await page.keyboard.press('KeyE'); await sleep(400);
await page.locator('.modal .opt', { hasText: '2 000 PC' }).click(); await sleep(400);
check((await prof()).casino.limit === 2000, 'limite de pertes fixée à 2 000 PC');
await closeAll();
await spotIn('casino', 'Machine à sous'); await page.keyboard.press('KeyE'); await sleep(400);
const c0 = (await prof()).coins;
await page.getByRole('button', { name: /Tirer le levier/ }).click(); await sleep(1800);
let p = await prof();
check(p.casino.played === 1 && p.coins !== undefined, `machine à sous : un tour joué (${c0} → ${p.coins} PC)`);
await page.screenshot({ path: 'tests/e2e/out/lei-slots.png' });
await closeAll();
await spotIn('casino', 'roulette'); await page.keyboard.press('KeyE'); await sleep(400);
await page.locator('.rbet.rouge').click(); await page.locator('.rbet.d2').click();
await page.getByRole('button', { name: /Lancer la bille/ }).click();
// on attend la fin de l'animation de la bille (plus ou moins longue selon la vitesse du rendu)
await page.waitForFunction(() => /Sorti/.test([...document.querySelectorAll('.modal')].pop()?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
check((await prof()).casino.played === 2 && /Sorti/.test(await page.locator('.modal').last().textContent()), 'roulette : la bille est tombée');
await page.screenshot({ path: 'tests/e2e/out/lei-roulette.png' });
await closeAll();
await spotIn('casino', 'blackjack'); await page.keyboard.press('KeyE'); await sleep(400);
await page.getByRole('button', { name: /Distribuer/ }).click(); await sleep(500);
if (await page.getByRole('button', { name: 'Je reste' }).count()) { await page.getByRole('button', { name: 'Je reste' }).click(); await sleep(500); }
check(/GAGNÉ|PERDU|ÉGALITÉ|BLACKJACK/.test(await page.locator('.modal').last().textContent()), 'blackjack : main jouée jusqu\'au bout');
await page.screenshot({ path: 'tests/e2e/out/lei-blackjack.png' });
await closeAll();
await spotIn('casino', 'Vidéo poker'); await page.keyboard.press('KeyE'); await sleep(400);
await page.getByRole('button', { name: /Distribuer/ }).click(); await sleep(400);
await page.locator('.vp-slot').first().click(); await sleep(100);
await page.getByRole('button', { name: 'Tirer', exact: true }).click(); await sleep(400);
check((await prof()).casino.played === 4, 'vidéo poker : main jouée');
await closeAll();

// 3) stand de tir : séance d'entraînement à la première personne
await inside('stand-tir');
await spotIn('stand-tir', 'Stand de tir'); await page.keyboard.press('KeyE'); await sleep(400);
await page.locator('.list-item', { hasText: 'Entraînement' }).getByRole('button', { name: 'Tirer' }).click(); await sleep(600);
check(await ev(() => !!window.playzone.range), 'séance lancée (arme de location)');
await sleep(3300); // compte à rebours
let hits = 0;
for (let k = 0; k < 40 && hits < 4; k++) {
  const r = await ev(() => {
    const g = window.playzone, R = g.range;
    R.update(0.016);
    const m = R.meshes.find((x) => x.visible && !x.userData.hit && R.targets[x.userData.i].kind !== 'otage' && x.rotation.x > -0.2);
    if (!m) return null;
    m.updateMatrixWorld();
    const tg = R.targets[m.userData.i];
    const v = m.localToWorld(new (m.position.constructor)(0, tg.kind === 'cible' ? 1.55 : 1.25, 0.05));
    g.engine.camera.updateMatrixWorld();
    v.project(g.engine.camera);
    const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
    R.cool = 0;
    R.fire(x, y);
    return m.userData.hit ? 1 : 0;
  });
  if (r) hits++;
  await sleep(450);
}
await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/lei-tir.png' });
const score = await ev(() => window.playzone.range?.score);
check(hits >= 2 && score > 0, `cibles touchées : ${hits}, score ${score}`);
await ev(async () => { const g = window.playzone; const real = Date.now; const t = real(); Date.now = () => t + 45_000; try { await g.range.finish(); } finally { Date.now = real; } });
await sleep(600);
p = await prof();
check(p.leisure.range.plays === 1 && p.leisure.range.best > 0 && !(await ev(() => !!window.playzone.range)), `fin de séance : record ${p.leisure.range.best}, arme rendue`);
await page.screenshot({ path: 'tests/e2e/out/lei-tir-fin.png' });
await closeAll();

// 4) tournoi du calendrier : on se place pendant un tournoi de tartes et on s'inscrit depuis l'agenda
const shifted = await ev(async () => {
  const g = window.playzone;
  const { occurrences } = await import('/shared/calendar.js');
  const now = g.now();
  const o = occurrences(now, now + 7 * 24 * 600_000).find((x) => x.id === 'tournoi-tartes');
  const shift = o.start + 60_000 - now;
  g.world.dayNight.shift = shift;
  localStorage.setItem('playzone.timeShift', String(shift));
  return o.occ;
});
await ev(() => window.playzone.phone.open('events')); await sleep(400);
await page.locator('.agenda-item', { hasText: 'Tournoi de la Bataille de tartes' }).first().getByRole('button', { name: 'S\'inscrire' }).click(); await sleep(400);
check(!!(await prof()).calendar.reg[shifted], 'inscrit·e au tournoi de tartes (en cours)');
await page.screenshot({ path: 'tests/e2e/out/lei-tournoi.png' });
await ev(() => window.playzone.phone.close());
await ev(async () => { const { MINIGAME_SPOTS } = await import('/shared/world-layout.js'); const g = window.playzone; g.player.teleport(MINIGAME_SPOTS.pieToss.x, MINIGAME_SPOTS.pieToss.z + 1, 0); g.debugStep(0.3); });
await page.keyboard.press('KeyE'); await sleep(500);
check(/Tournoi en cours/.test(await page.locator('.modal').last().textContent()), 'le stand affiche le tournoi en cours');

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
